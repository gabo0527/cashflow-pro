// Save as: src/app/api/qbo/sync/route.ts
// Chunked sync — one entity per call to stay under Vercel 10s free tier timeout
// Client chains: Purchase → Deposit → Transfer → Payment → SalesReceipt → JournalEntry → Invoice

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getQBOAccessToken, qboQuery } from '@/lib/qbo-client'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const START_DATE = '2024-01-01'

// ============ HELPERS ============

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

// ============ ENTITY PARSERS ============

const ENTITY_CONFIG: Record<string, {
  query: string; prefix: string;
  parse: (item: any) => { amount: number; payee: string; description: string; accountName: string }
}> = {
  Purchase: {
    query: `SELECT * FROM Purchase WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC`,
    prefix: 'PUR',
    parse: (item) => ({
      amount: -Math.abs(item.TotalAmt || 0),
      payee: item.EntityRef?.name || '',
      description: item.Line?.[0]?.Description || item.PrivateNote || item.EntityRef?.name || 'Purchase',
      accountName: item.AccountRef?.name || '',
    }),
  },
  Deposit: {
    query: `SELECT * FROM Deposit WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC`,
    prefix: 'DEP',
    parse: (item) => ({
      amount: Math.abs(item.TotalAmt || 0),
      payee: item.Line?.[0]?.DepositLineDetail?.Entity?.name || '',
      description: item.Line?.[0]?.Description || item.PrivateNote || 'Deposit',
      accountName: item.DepositToAccountRef?.name || '',
    }),
  },
  Transfer: {
    query: `SELECT * FROM Transfer WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC`,
    prefix: 'TRF',
    parse: (item) => ({
      amount: -(item.Amount || 0),
      payee: 'Internal Transfer',
      description: `Transfer: ${item.FromAccountRef?.name || '?'} → ${item.ToAccountRef?.name || '?'}`,
      accountName: item.FromAccountRef?.name || '',
    }),
  },
  Payment: {
    query: `SELECT * FROM Payment WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC`,
    prefix: 'PMT',
    parse: (item) => ({
      amount: Math.abs(item.TotalAmt || 0),
      payee: item.CustomerRef?.name || '',
      description: `Payment Received - ${item.CustomerRef?.name || ''}`,
      accountName: item.DepositToAccountRef?.name || 'Undeposited Funds',
    }),
  },
  SalesReceipt: {
    query: `SELECT * FROM SalesReceipt WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC`,
    prefix: 'SR',
    parse: (item) => ({
      amount: Math.abs(item.TotalAmt || 0),
      payee: item.CustomerRef?.name || '',
      description: item.Line?.[0]?.Description || `Sales Receipt - ${item.CustomerRef?.name || ''}`,
      accountName: item.DepositToAccountRef?.name || '',
    }),
  },
  JournalEntry: {
    query: `SELECT * FROM JournalEntry WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC`,
    prefix: 'JE',
    parse: (item) => {
      const line = item.Line?.[0]
      const detail = line?.JournalEntryLineDetail
      const isDebit = detail?.PostingType === 'Debit'
      return {
        amount: isDebit ? -Math.abs(line?.Amount || 0) : Math.abs(line?.Amount || 0),
        payee: detail?.Entity?.EntityRef?.name || '',
        description: line?.Description || item.PrivateNote || 'Journal Entry',
        accountName: detail?.AccountRef?.name || '',
      }
    },
  },
}

const BANK_ENTITIES = ['Purchase', 'Deposit', 'Transfer', 'Payment', 'SalesReceipt', 'JournalEntry']

// ============ SYNC ONE BANK ENTITY ============

async function syncEntity(
  accessToken: string, realmId: string, companyId: string, supabase: any, entityName: string
) {
  const config = ENTITY_CONFIG[entityName]
  if (!config) throw new Error(`Unknown entity: ${entityName}`)

  let synced = 0, skipped = 0, errors = 0
  const items = await qboQuery(accessToken, realmId, config.query, entityName)
  console.log(`QBO: ${items.length} ${entityName}`)

  for (const item of items) {
    try {
      const qbId = `${config.prefix}-${item.Id}`
      const parsed = config.parse(item)
      if (parsed.amount === 0 && entityName !== 'Transfer') { skipped++; continue }

      const { error } = await supabase.from('transactions').upsert({
        company_id: companyId,
        qb_id: qbId,
        date: item.TxnDate,
        description: parsed.description,
        amount: parsed.amount,
        payee: parsed.payee,
        account_name: parsed.accountName,
        type: parsed.amount >= 0 ? 'income' : 'expense',
        sync_source: 'quickbooks',
        synced_at: new Date().toISOString(),
      }, { onConflict: 'company_id,qb_id', ignoreDuplicates: false })

      if (error) { console.error(`Txn upsert error ${qbId}:`, error.message); errors++ }
      else { synced++ }
    } catch (e: any) { errors++ }
  }

  return { entity: entityName, synced, skipped, errors }
}

// ============ SYNC INVOICES ============

async function syncInvoices(
  accessToken: string, realmId: string, companyId: string, supabase: any,
  clientMap: Record<string, string>, projectMap: Record<string, string>
) {
  let synced = 0, errors = 0
  const unmatchedClients = new Set<string>()

  const invoices = await qboQuery(accessToken, realmId, `SELECT * FROM Invoice ORDER BY TxnDate DESC`, 'Invoice')
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

      if (error) { errors++ } else { synced++ }
    } catch (e: any) { errors++ }
  }

  return { entity: 'Invoice', synced, skipped: 0, errors, unmatchedClients: Array.from(unmatchedClients) }
}

// ============ POST ============

export async function POST(request: NextRequest) {
  try {
    const { companyId, syncType, entity } = await request.json()
    if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })

    const auth = await getQBOAccessToken(companyId)
    if (!auth.success) return NextResponse.json({ error: auth.error, reconnect: true }, { status: 401 })

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Single entity sync (chunked mode — used by client chaining)
    if (entity) {
      if (entity === 'Invoice') {
        const { clientMap, projectMap } = await buildLookups(supabase, companyId)
        const result = await syncInvoices(auth.accessToken, auth.realmId, companyId, supabase, clientMap, projectMap)
        await supabase.from('company_settings').update({ qbo_last_invoice_sync: new Date().toISOString() }).eq('company_id', companyId)
        return NextResponse.json({ success: true, result })
      } else {
        const result = await syncEntity(auth.accessToken, auth.realmId, companyId, supabase, entity)
        if (entity === BANK_ENTITIES[BANK_ENTITIES.length - 1]) {
          await supabase.from('company_settings').update({ qbo_last_bank_sync: new Date().toISOString() }).eq('company_id', companyId)
        }
        return NextResponse.json({ success: true, result })
      }
    }

    // Return sync plan for client to chain
    const entities = syncType === 'invoices' ? ['Invoice']
      : syncType === 'bank' ? [...BANK_ENTITIES]
      : [...BANK_ENTITIES, 'Invoice']

    return NextResponse.json({ success: true, entities, message: 'Chain these entities one at a time' })
  } catch (err: any) {
    console.error('QBO sync error:', err)
    const isAuthErr = err.message === 'QBO_TOKEN_EXPIRED'
    return NextResponse.json(
      { error: isAuthErr ? 'Session expired — reconnect QuickBooks' : (err.message || 'Sync failed'), reconnect: isAuthErr },
      { status: isAuthErr ? 401 : 500 }
    )
  }
}

// ============ GET: STATUS ============

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId')
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { data: settings } = await supabase.from('company_settings')
    .select('qbo_realm_id, qbo_connected_at, qbo_token_expires_at, qbo_last_bank_sync, qbo_last_invoice_sync')
    .eq('company_id', companyId).single()

  const { count: invoiceCount } = await supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('sync_source', 'quickbooks')
  const { count: txnCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('sync_source', 'quickbooks')

  return NextResponse.json({
    connected: !!settings?.qbo_realm_id,
    lastInvoiceSync: settings?.qbo_last_invoice_sync || null,
    lastBankSync: settings?.qbo_last_bank_sync || null,
    counts: { invoices: invoiceCount || 0, transactions: txnCount || 0 },
  })
}
