// src/app/api/qbo/sync/route.ts
// Invoices ONLY — bank feed removed. Plaid handles all bank/CC transactions.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getQBOAccessToken, qboQuery } from '@/lib/qbo-client'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const START_DATE = '2026-01-01'

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

async function buildLookups(supabase: any, companyId: string) {
  const { data: clients } = await supabase.from('clients').select('id, name').eq('company_id', companyId)
  const { data: projects } = await supabase.from('projects').select('id, name, client_id').eq('company_id', companyId)
  const clientMap: Record<string, string> = {}
  for (const c of (clients || [])) clientMap[c.name.toLowerCase().trim()] = c.id
  const projectMap: Record<string, string> = {}
  for (const p of (projects || [])) projectMap[p.name.toLowerCase().trim()] = p.id
  return { clientMap, projectMap }
}

async function syncInvoices(
  accessToken: string, realmId: string, companyId: string, supabase: any,
  clientMap: Record<string, string>, projectMap: Record<string, string>
) {
  let synced = 0, errors = 0
  const unmatchedClients = new Set<string>()

  const invoices = await qboQuery(
    accessToken, realmId,
    `SELECT * FROM Invoice WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC`,
    'Invoice'
  )
  console.log(`QBO: ${invoices.length} Invoices`)

  for (const inv of invoices) {
    try {
      const customerProjectRaw = inv.CustomerRef?.name || ''
      const { client, project } = parseCustomerProject(customerProjectRaw)
      const totalAmount = inv.TotalAmt || 0
      const balance = inv.Balance || 0
      const { status, statusDetail, daysOverdue } = computeInvoiceStatus(balance, inv.DueDate)
      const clientId = clientMap[client.toLowerCase().trim()] || null
      const projectId = project ? (projectMap[project.toLowerCase().trim()] || null) : null
      if (client && !clientId) unmatchedClients.add(client)

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

      if (error) { console.error(`Invoice upsert error ${inv.Id}:`, error.message); errors++ }
      else { synced++ }
    } catch (e: any) { console.error('Invoice parse error:', e.message); errors++ }
  }

  return { entity: 'Invoice', synced, skipped: 0, errors, unmatchedClients: Array.from(unmatchedClients) }
}

export async function POST(request: NextRequest) {
  try {
    const { companyId, entity } = await request.json()
    if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })

    const auth = await getQBOAccessToken(companyId)
    if (!auth.success) return NextResponse.json({ error: auth.error, reconnect: true }, { status: 401 })

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Silently no-op any legacy bank entity calls — prevents accidental re-sync
    if (entity && entity !== 'Invoice') {
      return NextResponse.json({
        success: true,
        result: { entity, synced: 0, skipped: 0, errors: 0 },
        message: 'Bank sync disabled — use Plaid',
      })
    }

    const { clientMap, projectMap } = await buildLookups(supabase, companyId)
    const result = await syncInvoices(auth.accessToken, auth.realmId, companyId, supabase, clientMap, projectMap)

    await supabase.from('company_settings')
      .update({ qbo_last_invoice_sync: new Date().toISOString() })
      .eq('company_id', companyId)

    return NextResponse.json({ success: true, result, entities: ['Invoice'] })

  } catch (err: any) {
    console.error('QBO sync error:', err)
    const isAuthErr = err.message === 'QBO_TOKEN_EXPIRED'
    return NextResponse.json(
      { error: isAuthErr ? 'Session expired — reconnect QuickBooks' : (err.message || 'Sync failed'), reconnect: isAuthErr },
      { status: isAuthErr ? 401 : 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId')
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { data: settings } = await supabase
    .from('company_settings')
    .select('qbo_realm_id, qbo_connected_at, qbo_token_expires_at, qbo_last_invoice_sync')
    .eq('company_id', companyId)
    .single()

  const { count: invoiceCount } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('sync_source', 'quickbooks')

  return NextResponse.json({
    connected: !!settings?.qbo_realm_id,
    lastInvoiceSync: settings?.qbo_last_invoice_sync || null,
    bankFeed: 'plaid',
    counts: { invoices: invoiceCount || 0 },
  })
}
