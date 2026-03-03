/**
 * Agent: Project Health Monitor
 * 
 * Tracks burn rate vs budget, margin erosion, scope creep signals.
 * Outputs weekly digest with green/yellow/red per project.
 * 
 * Uses: Claude (analysis) with OpenAI fallback.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { aiRequest } from '@/lib/ai-router'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Types ───────────────────────────────────────────────────────────────────

type HealthStatus = 'green' | 'yellow' | 'red'

interface ProjectHealth {
  project_id: string
  project_name: string
  client_name: string
  contract_type: string
  status: HealthStatus
  signals: string[]

  // Financial
  total_revenue: number
  total_cost: number
  gross_margin_pct: number
  target_margin_pct: number

  // Budget burn
  budget_hours: number | null
  hours_used: number
  burn_rate_pct: number | null
  
  // Revenue recognition
  total_invoiced: number
  total_collected: number
  ar_outstanding: number

  // Trend (last 4 weeks)
  weekly_hours: number[]
  hours_trend: 'increasing' | 'stable' | 'decreasing'
  
  // Scope creep
  team_count: number
  avg_weekly_hours: number
}

interface HealthReport {
  generated_at: string
  portfolio_summary: {
    total_projects: number
    green: number
    yellow: number
    red: number
    total_revenue: number
    total_cost: number
    blended_margin: number
    total_ar: number
  }
  projects: ProjectHealth[]
  ai_digest: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeeksAgoDate(weeks: number): string {
  const d = new Date()
  d.setDate(d.getDate() - weeks * 7)
  return d.toISOString().split('T')[0]
}

function calculateTrend(values: number[]): 'increasing' | 'stable' | 'decreasing' {
  if (values.length < 2) return 'stable'
  const recent = values.slice(-2).reduce((a, b) => a + b, 0) / 2
  const older = values.slice(0, 2).reduce((a, b) => a + b, 0) / Math.min(2, values.slice(0, 2).length)
  if (recent > older * 1.15) return 'increasing'
  if (recent < older * 0.85) return 'decreasing'
  return 'stable'
}

// ─── Core Logic ──────────────────────────────────────────────────────────────

async function analyzeHealth(companyId: string): Promise<HealthReport> {
  // 1. Get all active projects
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, client_id, contract_type, status, budget, budget_hours')
    .eq('company_id', companyId)
    .eq('status', 'active')

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .eq('company_id', companyId)

  const clientMap: Record<string, string> = {}
  ;(clients || []).forEach(c => { clientMap[c.id] = c.name })

  // 2. Get all time entries (for hours and costs)
  const { data: allEntries } = await supabase
    .from('time_entries')
    .select('project_id, member_id, hours, date')
    .eq('company_id', companyId)

  // 3. Get last 4 weeks of entries for trends
  const fourWeeksAgo = getWeeksAgoDate(4)
  const recentEntries = (allEntries || []).filter(e => e.date >= fourWeeksAgo)

  // 4. Get contractor invoice lines for actual costs
  const { data: invoiceLines } = await supabase
    .from('contractor_invoice_lines')
    .select('project_id, hours, amount')

  // 5. Get project expenses
  const { data: projectExpenses } = await supabase
    .from('project_expenses')
    .select('project_id, amount')

  // 6. Get invoices for revenue tracking
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, amount, status, project_id, client_id')
    .eq('company_id', companyId)

  // 7. Get bill rates for revenue estimation
  const { data: billRates } = await supabase
    .from('bill_rates')
    .select('client_id, rate, cost_type, cost_amount')
    .eq('is_active', true)

  const rateByClient: Record<string, number> = {}
  ;(billRates || []).forEach(br => {
    if (br.rate) rateByClient[br.client_id] = br.rate
  })

  // 8. Build per-project health
  const projectHealths: ProjectHealth[] = (projects || []).map(p => {
    const pEntries = (allEntries || []).filter(e => e.project_id === p.id)
    const totalHours = pEntries.reduce((s, e) => s + (e.hours || 0), 0)

    // Costs from invoice lines
    const pInvoiceLines = (invoiceLines || []).filter(l => l.project_id === p.id)
    const invoiceLineCost = pInvoiceLines.reduce((s, l) => s + (l.amount || 0), 0)

    // Costs from project expenses
    const pExpenses = (projectExpenses || []).filter(e => e.project_id === p.id)
    const expenseCost = pExpenses.reduce((s, e) => s + (e.amount || 0), 0)

    const totalCost = invoiceLineCost + expenseCost

    // Revenue: from invoices or estimated from hours × bill rate
    const pInvoices = (invoices || []).filter(i => i.project_id === p.id || i.client_id === p.client_id)
    const invoicedAmount = pInvoices.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
    const collectedAmount = pInvoices.filter(i => i.status === 'paid').reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
    
    const billRate = rateByClient[p.client_id] || 0
    const estimatedRevenue = p.budget || (totalHours * billRate) || invoicedAmount
    const totalRevenue = estimatedRevenue > 0 ? estimatedRevenue : invoicedAmount

    // Margin
    const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0
    const targetMargin = 50 // Default target

    // Budget burn
    const burnPct = p.budget_hours ? (totalHours / p.budget_hours) * 100 : null

    // Weekly hours trend (last 4 weeks)
    const weeklyHours: number[] = []
    for (let w = 3; w >= 0; w--) {
      const weekStart = getWeeksAgoDate(w + 1)
      const weekEnd = getWeeksAgoDate(w)
      const weekHrs = recentEntries
        .filter(e => e.project_id === p.id && e.date >= weekStart && e.date < weekEnd)
        .reduce((s, e) => s + (e.hours || 0), 0)
      weeklyHours.push(weekHrs)
    }

    // Team members on project
    const uniqueMembers = new Set(pEntries.map(e => e.member_id))
    const avgWeekly = totalHours > 0 ? totalHours / Math.max(1, Math.ceil(pEntries.length / 5)) : 0

    // Determine health status + signals
    const signals: string[] = []
    let status: string = 'green'

    // Budget burn checks
    if (burnPct !== null) {
      if (burnPct >= 100) {
        signals.push(`Over budget: ${Math.round(burnPct)}% of hours used`)
        status = 'red'
      } else if (burnPct >= 80) {
        signals.push(`High burn: ${Math.round(burnPct)}% of budget hours used`)
        if (status !== 'red') status = 'yellow'
      }
    }

    // Margin erosion
    if (grossMargin < 20 && totalRevenue > 0) {
      signals.push(`Low margin: ${Math.round(grossMargin)}% (target: ${targetMargin}%)`)
      status = 'red'
    } else if (grossMargin < 35 && totalRevenue > 0) {
      signals.push(`Margin below target: ${Math.round(grossMargin)}% (target: ${targetMargin}%)`)
      if (status !== 'red') status = 'yellow'
    }

    // Scope creep: hours trending up without budget increase
    const hoursTrend = calculateTrend(weeklyHours)
    if (hoursTrend === 'increasing' && burnPct && burnPct > 60) {
      signals.push('Hours trending up — potential scope creep')
      if (status !== 'red') status = 'yellow'
    }

    // AR risk
    const arOutstanding = invoicedAmount - collectedAmount
    if (arOutstanding > totalRevenue * 0.5 && arOutstanding > 10000) {
      signals.push(`High AR: $${Math.round(arOutstanding).toLocaleString()} outstanding`)
      if (status !== 'red') status = 'yellow'
    }

    // No activity
    if (weeklyHours.slice(-2).every(h => h === 0) && totalHours > 0) {
      signals.push('No hours logged in last 2 weeks')
      if (status !== 'red') status = 'yellow'
    }

    if (signals.length === 0) {
      signals.push('On track')
    }

    return {
      project_id: p.id,
      project_name: p.name,
      client_name: clientMap[p.client_id] || 'Unknown',
      contract_type: p.contract_type || 'unknown',
      status: status as HealthStatus,
      signals,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_cost: Math.round(totalCost * 100) / 100,
      gross_margin_pct: Math.round(grossMargin * 10) / 10,
      target_margin_pct: targetMargin,
      budget_hours: p.budget_hours,
      hours_used: Math.round(totalHours * 10) / 10,
      burn_rate_pct: burnPct !== null ? Math.round(burnPct * 10) / 10 : null,
      total_invoiced: Math.round(invoicedAmount * 100) / 100,
      total_collected: Math.round(collectedAmount * 100) / 100,
      ar_outstanding: Math.round((invoicedAmount - collectedAmount) * 100) / 100,
      weekly_hours: weeklyHours,
      hours_trend: hoursTrend,
      team_count: uniqueMembers.size,
      avg_weekly_hours: Math.round(avgWeekly * 10) / 10,
    }
  })

  // Sort: red first, then yellow, then green
  const sortOrder: Record<HealthStatus, number> = { red: 0, yellow: 1, green: 2 }
  projectHealths.sort((a, b) => sortOrder[a.status] - sortOrder[b.status])

  // 9. Portfolio summary
  const totalRev = projectHealths.reduce((s, p) => s + p.total_revenue, 0)
  const totalCost = projectHealths.reduce((s, p) => s + p.total_cost, 0)
  const totalAR = projectHealths.reduce((s, p) => s + p.ar_outstanding, 0)

  const summary = {
    total_projects: projectHealths.length,
    green: projectHealths.filter(p => p.status === 'green').length,
    yellow: projectHealths.filter(p => p.status === 'yellow').length,
    red: projectHealths.filter(p => p.status === 'red').length,
    total_revenue: Math.round(totalRev * 100) / 100,
    total_cost: Math.round(totalCost * 100) / 100,
    blended_margin: totalRev > 0 ? Math.round(((totalRev - totalCost) / totalRev) * 1000) / 10 : 0,
    total_ar: Math.round(totalAR * 100) / 100,
  }

  // 10. AI digest
  let aiDigest = ''
  try {
    const redYellow = projectHealths.filter(p => p.status !== 'green')
    const aiResult = await aiRequest({
      messages: [{
        role: 'user',
        content: `Generate a weekly project health digest for the owner of an Owner's Representative consulting firm.

PORTFOLIO OVERVIEW:
- ${summary.total_projects} active projects: ${summary.green} green, ${summary.yellow} yellow, ${summary.red} red
- Total revenue: $${Math.round(totalRev).toLocaleString()} | Total cost: $${Math.round(totalCost).toLocaleString()}
- Blended margin: ${summary.blended_margin}% | AR outstanding: $${Math.round(totalAR).toLocaleString()}

${redYellow.length > 0 ? `PROJECTS REQUIRING ATTENTION:
${redYellow.map(p => `[${p.status.toUpperCase()}] ${p.project_name} (${p.client_name})
  - Margin: ${p.gross_margin_pct}% | Hours: ${p.hours_used}${p.budget_hours ? '/' + p.budget_hours : ''} | AR: $${Math.round(p.ar_outstanding).toLocaleString()}
  - Signals: ${p.signals.join('; ')}
  - Trend: hours ${p.hours_trend} over last 4 weeks (${p.weekly_hours.join(', ')}h)`).join('\n\n')}` : 'All projects green — no immediate concerns.'}

GREEN PROJECTS:
${projectHealths.filter(p => p.status === 'green').map(p => `- ${p.project_name} (${p.client_name}): ${p.gross_margin_pct}% margin`).join('\n')}

Write a concise Monday morning briefing (5-7 sentences). Lead with what needs immediate attention. Include specific numbers and recommended actions. End with one portfolio-level insight.`
      }],
      systemPrompt: 'You are a VP-level project controller at a consulting firm. Be direct, use exact numbers, prioritize by financial impact. No fluff.',
      taskType: 'analysis',
      maxTokens: 700,
    })
    aiDigest = aiResult.content
  } catch (err) {
    aiDigest = `Portfolio: ${summary.green} green, ${summary.yellow} yellow, ${summary.red} red. Blended margin: ${summary.blended_margin}%. AR: $${Math.round(totalAR).toLocaleString()}.`
  }

  return {
    generated_at: new Date().toISOString(),
    portfolio_summary: summary,
    projects: projectHealths,
    ai_digest: aiDigest,
  }
}

// ─── API Route ───────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { action, companyId } = await request.json()

    if (!companyId) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 })
    }

    if (action === 'full-report') {
      const report = await analyzeHealth(companyId)
      return NextResponse.json(report)
    }

    if (action === 'digest') {
      const report = await analyzeHealth(companyId)
      return NextResponse.json({
        portfolio_summary: report.portfolio_summary,
        flagged_projects: report.projects.filter(p => p.status !== 'green'),
        ai_digest: report.ai_digest,
      })
    }

    if (action === 'project-detail') {
      const { projectId } = await request.json()
      const report = await analyzeHealth(companyId)
      const project = report.projects.find(p => p.project_id === projectId)
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      return NextResponse.json(project)
    }

    return NextResponse.json({ error: 'Invalid action. Use: full-report, digest, or project-detail' }, { status: 400 })

  } catch (error) {
    console.error('[Agent: Project Health Monitor]', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
