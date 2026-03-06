// Save as: src/app/api/qbo/cron/route.ts
// Called by Supabase pg_cron every 60 minutes — chains all entities automatically
// Protected by CRON_SECRET so only Supabase can call it

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getQBOAccessToken, qboQuery } from '@/lib/qbo-client'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const CRON_SECRET = process.env.CRON_SECRET!

const START_DATE = '2024-01-01'

function parseCustomerProject(raw: string): { client: string; project: string | null } {
  if (!raw) return { client: '', project: null }
  const idx = raw.indexOf(':')
  if (idx > 0) return { client: raw.substring(0, idx).trim(), project: raw.substring(idx + 1).trim() || null }
  return { client: raw.trim(), project: null }
}

function computeInvoiceStatus(balance: number, dueDate: string | null) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  if (balance <= 0) return { status: 'paid', statusDetail: 'Paid', daysOverdue: 0 }
  if (!dueDate) return { status: 'pending', statusDetail: 'Pending', daysOverdue: 0 }
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays > 0) return { status: 'overdue', statusDetail: `Overdue ${diffDays} days`, daysOverdue: diffDays }
  if (diffDays === 0) return { status: 'due_today', statusDetail: 'Due today', daysOverdue: 0 }
  if (diffDays >= -7) return { status: 'due_soon', statusDetail: `Due in ${Math.abs(diffDays)} days`, daysOverdue: 0 }
  return { status: 'pending', statusDetail: `Due in ${Math.abs(diffDays)} days`, daysOverdue: 0 }
}

// Sync invoices only (cron focuses on invoices — the most time-sensitive data)
async function cronSyncInvoices(
  accessToken: string, realmId: string, companyId: string, supabase: any
) {
  const { data: clients } = await supabase.from('clients').select('id, name').eq('company_id', companyId)
  const { data: projects } = await supabase.from('projects').select('id, name').eq('company_id', companyId)

  const clientMap: Record<string, string> = {}
  for (const c of (clients || [])) clientMap[c.name.toLowerCase().trim()] = c.id
  const projectMap: Record<string, string> = {}
  for (const p of (projects || [])) projectMap[p.name.toLowerCase().trim()] = p.id

  // Only fetch invoices modified in last 2 hours (incremental sync — fast and safe)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString().replace('T', ' ').split('.')[0]
  const invoices = await qboQuery(
    accessToken, realmId,
    `SELECT * FROM Invoice WHERE MetaData.LastUpdatedTime >= '${twoHoursAgo}' ORDER BY MetaData.LastUpdatedTime DESC`,
    'Invoice'
  )

  let synced = 0, errors = 0
  for (const inv of invoices) {
    try {
      const customerProjectRaw = inv.CustomerRef?.name || ''
      const { client, project } = parseCustomerProject(customerProjectRaw)
      const totalAmount = inv.TotalAmt || 0
      const balance = inv.Balance || 0
      const { status, statusDetail, daysOverdue } = computeInvoiceStatus(balance, inv.DueDate)
      const clientId = clientMap[client.toLowerCase().trim()] || null
      const projectId = project ? (projectMap[project.toLowerCase().trim()] || null) : null

      const { error } = await supabase.from('invoices').upsert({
        company_id: companyId,
        qb_invoice_id: inv.Id,
        invoice_number: inv.DocNumber || '',
        customer_project_raw: customerProjectRaw,
        client, project,
        client_id: clientId, project_id: projectId,
        amount: totalAmount,
        amount_paid: totalAmount - balance,
        balance_due: balance,
        invoice_date: inv.TxnDate,
        due_date: inv.DueDate || null,
        paid_date: balance <= 0 ? inv.TxnDate : null,
        status, status_detail: statusDetail, days_overdue: daysOverdue,
        sync_source: 'quickbooks',
        synced_at: new Date().toISOString(),
      }, { onConflict: 'company_id,qb_invoice_id', ignoreDuplicates: false })

      if (error) errors++
      else synced++
    } catch { errors++ }
  }

  return { synced, errors, total: invoices.length }
}

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const startedAt = new Date().toISOString()

  // Get all connected companies
  const { data: companies } = await supabase
    .from('company_settings')
    .select('company_id')
    .not('qbo_realm_id', 'is', null)
    .not('qbo_refresh_token', 'is', null)

  if (!companies?.length) {
    return NextResponse.json({ message: 'No connected companies', synced: 0 })
  }

  const results = []

  for (const { company_id } of companies) {
    try {
      const auth = await getQBOAccessToken(company_id)
      if (!auth.success) {
        results.push({ company_id, success: false, error: auth.error })
        continue
      }

      const result = await cronSyncInvoices(auth.accessToken, auth.realmId, company_id, supabase)

      // Update last sync timestamp
      await supabase.from('company_settings')
        .update({ qbo_last_invoice_sync: new Date().toISOString() })
        .eq('company_id', company_id)

      // Write to sync_log
      await supabase.from('sync_log').insert({
        company_id,
        source: 'qbo_cron',
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        records_synced: result.synced,
        records_total: result.total,
        status: result.errors > 0 ? 'partial' : 'success',
        error_message: result.errors > 0 ? `${result.errors} errors` : null,
      })

      results.push({ company_id, success: true, ...result })
    } catch (err: any) {
      results.push({ company_id, success: false, error: err.message })

      await supabase.from('sync_log').insert({
        company_id,
        source: 'qbo_cron',
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        records_synced: 0,
        status: 'error',
        error_message: err.message,
      })
    }
  }

  return NextResponse.json({
    success: true,
    ran_at: startedAt,
    companies_processed: results.length,
    results,
  })
}
