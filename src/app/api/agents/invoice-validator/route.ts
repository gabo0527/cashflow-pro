/**
 * Agent: Invoice Validator
 * 
 * Validates contractor-submitted invoices against time entries.
 * Auto-approves clean invoices, flags discrepancies for review.
 * 
 * Uses: OpenAI (structured output) for validation logic,
 *        Claude (fallback) if OpenAI unavailable.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { aiStructured } from '@/lib/ai-router'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Types ───────────────────────────────────────────────────────────────────

interface ValidationResult {
  invoice_id: string
  invoice_number: string
  contractor_name: string
  status: 'clean' | 'discrepancy' | 'error'
  auto_approved: boolean
  total_invoiced: number
  total_expected: number
  variance: number
  variance_pct: number
  issues: {
    type: 'hours_mismatch' | 'rate_mismatch' | 'missing_entries' | 'extra_entries' | 'period_mismatch'
    severity: 'low' | 'medium' | 'high'
    description: string
    line_description?: string
    invoiced_value?: number
    expected_value?: number
  }[]
  recommendation: string
}

// ─── Core Validation Logic ───────────────────────────────────────────────────

async function validateInvoice(invoiceId: string): Promise<ValidationResult> {
  // 1. Fetch the invoice with line items
  const { data: invoice, error: invErr } = await supabase
    .from('contractor_invoices')
    .select('*, contractor_invoice_lines(*)')
    .eq('id', invoiceId)
    .single()

  if (invErr || !invoice) {
    throw new Error(`Invoice not found: ${invoiceId}`)
  }

  // 2. Fetch the contractor/member
  const { data: member } = await supabase
    .from('team_members')
    .select('id, name, email')
    .eq('id', invoice.member_id)
    .single()

  // 3. Fetch time entries for the invoice period
  const { data: timeEntries } = await supabase
    .from('time_entries')
    .select('*')
    .eq('member_id', invoice.member_id)
    .gte('date', invoice.period_start)
    .lte('date', invoice.period_end)

  // 4. Fetch project assignments for rates
  const { data: assignments } = await supabase
    .from('project_assignments')
    .select('*, projects(name, client_id, clients(name))')
    .eq('member_id', invoice.member_id)

  const lines = invoice.contractor_invoice_lines || []
  const entries = timeEntries || []
  const assigns = assignments || []

  // 5. Build comparison data for AI analysis
  const comparisonData = {
    invoice: {
      id: invoice.id,
      number: invoice.invoice_number,
      period: `${invoice.period_start} to ${invoice.period_end}`,
      total: invoice.total_amount,
      lines: lines.map((l: any) => ({
        description: l.description,
        hours: l.hours,
        rate: l.rate,
        amount: l.amount,
        allocation_pct: l.allocation_pct,
      })),
    },
    timeEntries: {
      totalHours: entries.reduce((s: number, e: any) => s + (e.hours || 0), 0),
      byProject: Object.entries(
        entries.reduce((acc: Record<string, number>, e: any) => {
          const proj = assigns.find((a: any) => a.project_id === e.project_id)
          const name = (proj as any)?.projects?.name || e.project_id
          acc[name] = (acc[name] || 0) + (e.hours || 0)
          return acc
        }, {} as Record<string, number>)
      ).map(([project, hours]) => ({ project, hours })),
      entryCount: entries.length,
    },
    assignments: assigns.map((a: any) => ({
      project: (a as any).projects?.name || a.project_id,
      client: (a as any).projects?.clients?.name || '',
      billRate: a.bill_rate,
      costRate: a.cost_rate,
    })),
  }

  // 6. Quick math check before calling AI
  const totalInvoiceHours = lines.reduce((s: number, l: any) => s + (Number(l.hours) || 0), 0)
  const totalTimeHours = entries.reduce((s: number, e: any) => s + (e.hours || 0), 0)
  const hoursDiff = Math.abs(totalInvoiceHours - totalTimeHours)
  const amountDiff = Math.abs(invoice.total_amount - calculateExpected(entries, assigns))

  // If perfect match (within 0.5h and $10), auto-approve without AI call
  if (hoursDiff <= 0.5 && amountDiff <= 10) {
    return {
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      contractor_name: member?.name || 'Unknown',
      status: 'clean',
      auto_approved: true,
      total_invoiced: invoice.total_amount,
      total_expected: calculateExpected(entries, assigns),
      variance: amountDiff,
      variance_pct: invoice.total_amount > 0 ? (amountDiff / invoice.total_amount) * 100 : 0,
      issues: [],
      recommendation: 'Invoice matches time entries exactly. Auto-approved.',
    }
  }

  // 7. Use AI for complex validation
  const aiResult = await aiStructured<{
    status: 'clean' | 'discrepancy'
    issues: {
      type: string
      severity: string
      description: string
      line_description?: string
      invoiced_value?: number
      expected_value?: number
    }[]
    recommendation: string
  }>(
    `Validate this contractor invoice against their time entries.

INVOICE DATA:
${JSON.stringify(comparisonData.invoice, null, 2)}

TIME ENTRIES (source of truth):
${JSON.stringify(comparisonData.timeEntries, null, 2)}

RATE ASSIGNMENTS:
${JSON.stringify(comparisonData.assignments, null, 2)}

Rules:
- Time entries are the source of truth for hours worked
- Each invoice line should match hours × rate for that project
- Allocation percentages should reflect actual hours distribution
- Flag any hours on the invoice not supported by time entries
- Flag any rate discrepancies vs assignment rates
- Variance under 2% is acceptable (rounding)

Return JSON with: status, issues array, and recommendation.`,
    'You are an accounts payable validation agent for a consulting firm. Be precise and flag real discrepancies, not rounding differences.'
  )

  const expectedTotal = calculateExpected(entries, assigns)
  const variance = Math.abs(invoice.total_amount - expectedTotal)

  return {
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    contractor_name: member?.name || 'Unknown',
    status: aiResult.data.status,
    auto_approved: aiResult.data.status === 'clean',
    total_invoiced: invoice.total_amount,
    total_expected: expectedTotal,
    variance,
    variance_pct: invoice.total_amount > 0 ? (variance / invoice.total_amount) * 100 : 0,
    issues: aiResult.data.issues.map(i => ({
      type: i.type as any,
      severity: i.severity as any,
      description: i.description,
      line_description: i.line_description,
      invoiced_value: i.invoiced_value,
      expected_value: i.expected_value,
    })),
    recommendation: aiResult.data.recommendation,
  }
}

function calculateExpected(entries: any[], assignments: any[]): number {
  return entries.reduce((total: number, entry: any) => {
    const assign = assignments.find((a: any) => a.project_id === entry.project_id)
    const rate = assign?.cost_rate || assign?.bill_rate || 0
    return total + (entry.hours || 0) * rate
  }, 0)
}

// ─── API Route ───────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { invoiceId, invoiceIds, action } = await request.json()

    // Single invoice validation
    if (action === 'validate' && invoiceId) {
      const result = await validateInvoice(invoiceId)

      // Auto-approve if clean
      if (result.auto_approved) {
        await supabase
          .from('contractor_invoices')
          .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: 'agent:invoice-validator' })
          .eq('id', invoiceId)
      }

      return NextResponse.json(result)
    }

    // Batch validation (multiple invoices)
    if (action === 'validate-batch' && invoiceIds?.length) {
      const results: ValidationResult[] = []
      for (const id of invoiceIds) {
        try {
          const result = await validateInvoice(id)
          if (result.auto_approved) {
            await supabase
              .from('contractor_invoices')
              .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: 'agent:invoice-validator' })
              .eq('id', id)
          }
          results.push(result)
        } catch (err) {
          results.push({
            invoice_id: id,
            invoice_number: 'Unknown',
            contractor_name: 'Unknown',
            status: 'error',
            auto_approved: false,
            total_invoiced: 0,
            total_expected: 0,
            variance: 0,
            variance_pct: 0,
            issues: [{ type: 'missing_entries', severity: 'high', description: (err as Error).message }],
            recommendation: 'Error during validation. Review manually.',
          })
        }
      }

      const summary = {
        total: results.length,
        auto_approved: results.filter(r => r.auto_approved).length,
        needs_review: results.filter(r => r.status === 'discrepancy').length,
        errors: results.filter(r => r.status === 'error').length,
      }

      return NextResponse.json({ summary, results })
    }

    // Validate all pending invoices
    if (action === 'validate-pending') {
      const { data: pending } = await supabase
        .from('contractor_invoices')
        .select('id')
        .eq('status', 'submitted')

      if (!pending?.length) {
        return NextResponse.json({ summary: { total: 0, auto_approved: 0, needs_review: 0, errors: 0 }, results: [] })
      }

      // Recursive call with batch
      const batchReq = new NextRequest(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate-batch', invoiceIds: pending.map(p => p.id) }),
      })
      return POST(batchReq)
    }

    return NextResponse.json({ error: 'Invalid action. Use: validate, validate-batch, or validate-pending' }, { status: 400 })

  } catch (error) {
    console.error('[Agent: Invoice Validator]', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
