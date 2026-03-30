// src/app/api/qbo/sync/route.ts
// Invoices + Bank Transactions (Purchase, Deposit, Transfer) via QBO
// Chunked per entity — each POST call handles one entity type to stay under Vercel 10s free tier limit
// Supported entity values: 'Invoice' | 'Purchase' | 'Deposit' | 'Transfer'

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

// ─── Entity → direction/type map (for reference) ─────────────────────────────
// Purchase      → debit    / expense      (checks, CC charges, cash expenses)
// Deposit       → credit   / income       (bank deposits, misc income)
// Transfer      → transfer / transfer     (bank-to-bank, CC payments)
// Payment       → credit   / payment      (customer payments received)
// BillPayment   → debit    / bill_payment (paying vendor bills)
// JournalEntry  → mixed    / journal      (manual accounting entries)

// ─── Bank Transaction Sync ───────────────────────────────────────────────────

/**
 * Normalize QBO line items into a human-readable description.
 * Falls back to payee name, memo, or entity type.
 */
function buildDescription(txn: any, entityType: string): string {
  const lines = txn.Line || []
  const lineDesc = lines
    .map((l: any) => l.Description || l.AccountBasedExpenseLineDetail?.AccountRef?.name || '')
    .filter(Boolean)
    .join('; ')
  return lineDesc || txn.PrivateNote || txn.EntityRef?.name || txn.PaymentMethodRef?.name || entityType
}

/**
 * Pull Purchase transactions (expenses, checks, credit card charges).
 * direction = 'debit', amount stored as negative.
 */
async function syncPurchases(
  accessToken: string, realmId: string, companyId: string, supabase: any
): Promise<{ entity: string; synced: number; skipped: number; errors: number }> {
  let synced = 0, skipped = 0, errors = 0

  const rows = await qboQuery(
    accessToken, realmId,
    `SELECT * FROM Purchase WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC MAXRESULTS 500`,
    'Purchase'
  )
  console.log(`QBO Purchase: ${rows.length} found`)

  for (const row of rows) {
    try {
      const qbId = `purchase_${row.Id}`
      const amount = -(Math.abs(row.TotalAmt || 0)) // expenses are negative
      const payee = row.EntityRef?.name || row.AccountRef?.name || ''
      const description = buildDescription(row, 'Purchase')
      const qbCategory = row.AccountRef?.name || row.Line?.[0]?.AccountBasedExpenseLineDetail?.AccountRef?.name || ''
      const accountName = row.AccountRef?.name || ''

      const { error } = await supabase.from('transactions').upsert({
        company_id: companyId,
        qb_id: qbId,
        sync_source: 'quickbooks',
        synced_at: new Date().toISOString(),
        date: row.TxnDate,
        description,
        amount,
        payee,
        qb_category: qbCategory,
        account_name: accountName,
        direction: 'debit',
        type: 'expense',
      }, { onConflict: 'qb_id', ignoreDuplicates: false })

      if (error) { console.error(`Purchase upsert ${row.Id}:`, error.message); errors++ }
      else synced++
    } catch (e: any) { console.error('Purchase parse error:', e.message); errors++ }
  }

  return { entity: 'Purchase', synced, skipped, errors }
}

/**
 * Pull Deposit transactions (bank deposits, income received).
 * direction = 'credit', amount stored as positive.
 */
async function syncDeposits(
  accessToken: string, realmId: string, companyId: string, supabase: any
): Promise<{ entity: string; synced: number; skipped: number; errors: number }> {
  let synced = 0, skipped = 0, errors = 0

  const rows = await qboQuery(
    accessToken, realmId,
    `SELECT * FROM Deposit WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC MAXRESULTS 500`,
    'Deposit'
  )
  console.log(`QBO Deposit: ${rows.length} found`)

  for (const row of rows) {
    try {
      const qbId = `deposit_${row.Id}`
      const amount = Math.abs(row.TotalAmt || 0)
      const lines = row.Line || []
      const payee = lines[0]?.LinkedTxn?.[0]?.TxnType || lines[0]?.DepositLineDetail?.Entity?.name || ''
      const description = lines.map((l: any) => l.Description || '').filter(Boolean).join('; ') || 'Deposit'
      const accountName = row.DepositToAccountRef?.name || ''

      const { error } = await supabase.from('transactions').upsert({
        company_id: companyId,
        qb_id: qbId,
        sync_source: 'quickbooks',
        synced_at: new Date().toISOString(),
        date: row.TxnDate,
        description,
        amount,
        payee,
        qb_category: 'Deposit',
        account_name: accountName,
        direction: 'credit',
        type: 'income',
      }, { onConflict: 'qb_id', ignoreDuplicates: false })

      if (error) { console.error(`Deposit upsert ${row.Id}:`, error.message); errors++ }
      else synced++
    } catch (e: any) { console.error('Deposit parse error:', e.message); errors++ }
  }

  return { entity: 'Deposit', synced, skipped, errors }
}

/**
 * Pull Transfer transactions (bank-to-bank, CC payments).
 * Stored as direction = 'transfer'.
 */
async function syncTransfers(
  accessToken: string, realmId: string, companyId: string, supabase: any
): Promise<{ entity: string; synced: number; skipped: number; errors: number }> {
  let synced = 0, skipped = 0, errors = 0

  const rows = await qboQuery(
    accessToken, realmId,
    `SELECT * FROM Transfer WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC MAXRESULTS 500`,
    'Transfer'
  )
  console.log(`QBO Transfer: ${rows.length} found`)

  for (const row of rows) {
    try {
      const qbId = `transfer_${row.Id}`
      const amount = Math.abs(row.Amount || 0)
      const fromAccount = row.FromAccountRef?.name || ''
      const toAccount = row.ToAccountRef?.name || ''
      const description = `Transfer: ${fromAccount} → ${toAccount}`

      const { error } = await supabase.from('transactions').upsert({
        company_id: companyId,
        qb_id: qbId,
        sync_source: 'quickbooks',
        synced_at: new Date().toISOString(),
        date: row.TxnDate,
        description,
        amount,
        payee: toAccount,
        qb_category: 'Transfer',
        account_name: fromAccount,
        direction: 'transfer',
        type: 'transfer',
      }, { onConflict: 'qb_id', ignoreDuplicates: false })

      if (error) { console.error(`Transfer upsert ${row.Id}:`, error.message); errors++ }
      else synced++
    } catch (e: any) { console.error('Transfer parse error:', e.message); errors++ }
  }

  return { entity: 'Transfer', synced, skipped, errors }
}

/**
 * Pull Payment transactions (customer payments received).
 * direction = 'credit', type = 'payment'
 */
async function syncPayments(
  accessToken: string, realmId: string, companyId: string, supabase: any
): Promise<{ entity: string; synced: number; skipped: number; errors: number }> {
  let synced = 0, skipped = 0, errors = 0

  const rows = await qboQuery(
    accessToken, realmId,
    `SELECT * FROM Payment WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC MAXRESULTS 500`,
    'Payment'
  )
  console.log(`QBO Payment: ${rows.length} found`)

  for (const row of rows) {
    try {
      const qbId = `payment_${row.Id}`
      const amount = Math.abs(row.TotalAmt || 0)
      const payee = row.CustomerRef?.name || ''

      const { error } = await supabase.from('transactions').upsert({
        company_id: companyId,
        qb_id: qbId,
        sync_source: 'quickbooks',
        synced_at: new Date().toISOString(),
        date: row.TxnDate,
        description: `Payment received: ${payee}`,
        amount,
        payee,
        qb_category: 'Customer Payment',
        account_name: row.DepositToAccountRef?.name || '',
        direction: 'credit',
        type: 'payment',
      }, { onConflict: 'qb_id', ignoreDuplicates: false })

      if (error) { console.error(`Payment upsert ${row.Id}:`, error.message); errors++ }
      else synced++
    } catch (e: any) { console.error('Payment parse error:', e.message); errors++ }
  }

  return { entity: 'Payment', synced, skipped, errors }
}

/**
 * Pull BillPayment transactions (paying vendor/contractor bills).
 * direction = 'debit', type = 'bill_payment'
 */
async function syncBillPayments(
  accessToken: string, realmId: string, companyId: string, supabase: any
): Promise<{ entity: string; synced: number; skipped: number; errors: number }> {
  let synced = 0, skipped = 0, errors = 0

  const rows = await qboQuery(
    accessToken, realmId,
    `SELECT * FROM BillPayment WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC MAXRESULTS 500`,
    'BillPayment'
  )
  console.log(`QBO BillPayment: ${rows.length} found`)

  for (const row of rows) {
    try {
      const qbId = `billpayment_${row.Id}`
      const amount = -(Math.abs(row.TotalAmt || 0))
      const payee = row.VendorRef?.name || ''
      const accountName = row.CheckPayment?.BankAccountRef?.name || row.CreditCardPayment?.CCAccountRef?.name || ''

      const { error } = await supabase.from('transactions').upsert({
        company_id: companyId,
        qb_id: qbId,
        sync_source: 'quickbooks',
        synced_at: new Date().toISOString(),
        date: row.TxnDate,
        description: `Bill payment: ${payee}`,
        amount,
        payee,
        qb_category: 'Bill Payment',
        account_name: accountName,
        direction: 'debit',
        type: 'bill_payment',
      }, { onConflict: 'qb_id', ignoreDuplicates: false })

      if (error) { console.error(`BillPayment upsert ${row.Id}:`, error.message); errors++ }
      else synced++
    } catch (e: any) { console.error('BillPayment parse error:', e.message); errors++ }
  }

  return { entity: 'BillPayment', synced, skipped, errors }
}

/**
 * Pull JournalEntry transactions (manual entries — overhead allocations, adjustments).
 * Each debit/credit line becomes its own row for full cash flow visibility.
 */
async function syncJournalEntries(
  accessToken: string, realmId: string, companyId: string, supabase: any
): Promise<{ entity: string; synced: number; skipped: number; errors: number }> {
  let synced = 0, skipped = 0, errors = 0

  const rows = await qboQuery(
    accessToken, realmId,
    `SELECT * FROM JournalEntry WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC MAXRESULTS 500`,
    'JournalEntry'
  )
  console.log(`QBO JournalEntry: ${rows.length} found`)

  for (const row of rows) {
    for (const line of (row.Line || [])) {
      try {
        const detail = line.JournalEntryLineDetail || {}
        const postingType = detail.PostingType || ''
        if (!postingType) continue

        const qbId = `journal_${row.Id}_${line.Id}`
        const lineAmount = Math.abs(line.Amount || 0)
        const amount = postingType === 'Debit' ? -lineAmount : lineAmount
        const direction = postingType === 'Debit' ? 'debit' : 'credit'
        const accountName = detail.AccountRef?.name || ''

        const { error } = await supabase.from('transactions').upsert({
          company_id: companyId,
          qb_id: qbId,
          sync_source: 'quickbooks',
          synced_at: new Date().toISOString(),
          date: row.TxnDate,
          description: line.Description || row.PrivateNote || `Journal Entry ${row.DocNumber || row.Id}`,
          amount,
          payee: detail.Entity?.name || '',
          qb_category: accountName,
          account_name: accountName,
          direction,
          type: 'journal',
        }, { onConflict: 'qb_id', ignoreDuplicates: false })

        if (error) { console.error(`JournalEntry upsert ${row.Id}_${line.Id}:`, error.message); errors++ }
        else synced++
      } catch (e: any) { console.error('JournalEntry line error:', e.message); errors++ }
    }
  }

  return { entity: 'JournalEntry', synced, skipped, errors }
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

    // Default to Invoice if no entity specified (backwards compat)
    const target = entity || 'Invoice'

    let result: { entity: string; synced: number; skipped: number; errors: number; unmatchedClients?: string[] }

    if (target === 'Invoice') {
      const { clientMap, projectMap } = await buildLookups(supabase, companyId)
      result = await syncInvoices(auth.accessToken, auth.realmId, companyId, supabase, clientMap, projectMap)
      await supabase.from('company_settings')
        .update({ qbo_last_invoice_sync: new Date().toISOString() })
        .eq('company_id', companyId)
    } else if (target === 'Purchase') {
      result = await syncPurchases(auth.accessToken, auth.realmId, companyId, supabase)
      await supabase.from('company_settings')
        .update({ qbo_last_bank_sync: new Date().toISOString() })
        .eq('company_id', companyId)
    } else if (target === 'Deposit') {
      result = await syncDeposits(auth.accessToken, auth.realmId, companyId, supabase)
      await supabase.from('company_settings')
        .update({ qbo_last_bank_sync: new Date().toISOString() })
        .eq('company_id', companyId)
    } else if (target === 'Transfer') {
      result = await syncTransfers(auth.accessToken, auth.realmId, companyId, supabase)
      await supabase.from('company_settings')
        .update({ qbo_last_bank_sync: new Date().toISOString() })
        .eq('company_id', companyId)
    } else if (target === 'Payment') {
      result = await syncPayments(auth.accessToken, auth.realmId, companyId, supabase)
      await supabase.from('company_settings')
        .update({ qbo_last_bank_sync: new Date().toISOString() })
        .eq('company_id', companyId)
    } else if (target === 'BillPayment') {
      result = await syncBillPayments(auth.accessToken, auth.realmId, companyId, supabase)
      await supabase.from('company_settings')
        .update({ qbo_last_bank_sync: new Date().toISOString() })
        .eq('company_id', companyId)
    } else if (target === 'JournalEntry') {
      result = await syncJournalEntries(auth.accessToken, auth.realmId, companyId, supabase)
      await supabase.from('company_settings')
        .update({ qbo_last_bank_sync: new Date().toISOString() })
        .eq('company_id', companyId)
    } else {
      return NextResponse.json({ error: `Unknown entity: ${target}` }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      result,
      message: `${result.entity}: ${result.synced} synced, ${result.errors} errors`,
    })

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
    .select('qbo_realm_id, qbo_connected_at, qbo_token_expires_at, qbo_last_invoice_sync, qbo_last_bank_sync')
    .eq('company_id', companyId)
    .single()

  const { count: invoiceCount } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('sync_source', 'quickbooks')

  const { count: txnCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('sync_source', 'quickbooks')

  return NextResponse.json({
    connected: !!settings?.qbo_realm_id,
    lastInvoiceSync: settings?.qbo_last_invoice_sync || null,
    lastBankSync: settings?.qbo_last_bank_sync || null,
    counts: { invoices: invoiceCount || 0, transactions: txnCount || 0 },
    // Entity sequence for chunked sync — call each one individually
    entities: ['Purchase', 'Deposit', 'Transfer', 'Payment', 'BillPayment', 'JournalEntry', 'Invoice'],
  })
}
