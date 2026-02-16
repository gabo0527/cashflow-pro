// Save as: src/app/api/qbo/sync/route.ts
// Upgraded: auto token refresh, full pagination, sage_learned_patterns auto-categorization
// Preserves: writes to transactions + accrual_transactions + invoices (same as before)

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getQBOAccessToken, qboQuery } from '@/lib/qbo-client'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ============ HELPERS ============

function parseCustomerProject(raw: string): { client: string; project: string | null } {
  if (!raw) return { client: '', project: null }
  const idx = raw.indexOf(':')
  if (idx > 0) return { client: raw.substring(0, idx).trim(), project: raw.substring(idx + 1).trim() || null }
  return { client: raw.trim(), project: null }
}

function parseInvoiceStatus(balance: number, dueDate: string | null): { status: string; statusDetail: string; daysOverdue: number } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (balance === 0) return { status: 'paid', statusDetail: 'Paid', daysOverdue: 0 }
  if (!dueDate) return { status: 'pending', statusDetail: 'Pending', daysOverdue: 0 }

  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays > 0) return { status: 'overdue', statusDetail: `Overdue ${diffDays} days`, daysOverdue: diffDays }
  if (diffDays === 0) return { status: 'due_today', statusDetail: 'Due today', daysOverdue: 0 }
  if (diffDays >= -1) return { status: 'due_soon', statusDetail: 'Due tomorrow', daysOverdue: 0 }
  if (diffDays >= -7) return { status: 'due_soon', statusDetail: `Due in ${Math.abs(diffDays)} days`, daysOverdue: 0 }
  return { status: 'pending', statusDetail: `Due in ${Math.abs(diffDays)} days`, daysOverdue: 0 }
}

function normalizeVendor(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
}

// ============ AUTO-CATEGORIZE using sage_learned_patterns ============

async function loadLearnedPatterns(supabase: any, companyId: string) {
  try {
    const { data } = await supabase
      .from('sage_learned_patterns')
      .select('vendor_normalized, category, sub_category, confidence')
      .eq('company_id', companyId)
      .neq('status', 'rejected')
    return data || []
  } catch {
    return [] // Table may not exist yet — safe fallback
  }
}

function categorizeTransaction(
  payee: string,
  qbCategory: string,
  amount: number,
  patterns: any[]
): { category: string; subcategory: string | null } {
  const normalized = normalizeVendor(payee)

  // 1. Learned patterns (highest priority — Sage-approved)
  for (const p of patterns) {
    if (p.vendor_normalized && normalized.includes(p.vendor_normalized)) {
      return { category: p.category, subcategory: p.sub_category }
    }
  }

  // 2. QBO category hints
  const qbCat = (qbCategory || '').toLowerCase()
  if (qbCat.includes('payroll') || qbCat.includes('salary') || qbCat.includes('wages')) return { category: 'direct_costs', subcategory: 'Payroll' }
  if (qbCat.includes('contract') || qbCat.includes('subcontract')) return { category: 'direct_costs', subcategory: 'Contract Labor' }
  if (qbCat.includes('insurance')) return { category: 'overhead', subcategory: 'Insurance' }
  if (qbCat.includes('rent') || qbCat.includes('lease')) return { category: 'overhead', subcategory: 'Rent' }
  if (qbCat.includes('travel')) return { category: 'opex', subcategory: 'Travel' }
  if (qbCat.includes('office') || qbCat.includes('supply')) return { category: 'opex', subcategory: 'Office Supplies' }
  if (qbCat.includes('software') || qbCat.includes('subscription')) return { category: 'opex', subcategory: 'Software & Tools' }
  if (qbCat.includes('advertising') || qbCat.includes('marketing')) return { category: 'opex', subcategory: 'Marketing' }
  if (qbCat.includes('legal') || qbCat.includes('professional')) return { category: 'opex', subcategory: 'Professional Services' }
  if (qbCat.includes('income') || qbCat.includes('revenue') || qbCat.includes('sales')) return { category: 'revenue', subcategory: null }

  // 3. Known vendor patterns
  if (normalized.includes('gusto')) return { category: 'direct_costs', subcategory: 'Payroll' }
  if (normalized.includes('adp') || normalized.includes('paychex')) return { category: 'direct_costs', subcategory: 'Payroll' }
  if (normalized.includes('github') || normalized.includes('vercel') || normalized.includes('aws') || normalized.includes('google cloud')) return { category: 'opex', subcategory: 'Software & Tools' }
  if (normalized.includes('slack') || normalized.includes('zoom') || normalized.includes('notion')) return { category: 'opex', subcategory: 'Software & Tools' }

  // 4. Amount sign fallback
  if (amount > 0) return { category: 'revenue', subcategory: null }
  return { category: 'opex', subcategory: null }
}

// ============ SYNC BANK TRANSACTIONS ============

async function syncBankTransactions(
  accessToken: string,
  realmId: string,
  companyId: string,
  supabase: any,
  patterns: any[]
): Promise<{ synced: number; errors: number }> {
  let synced = 0
  let errors = 0
  const START_DATE = '2026-01-01'

  const txnTypes = [
    { query: `SELECT * FROM Purchase WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC`, entity: 'Purchase', prefix: 'PUR' },
    { query: `SELECT * FROM Deposit WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC`, entity: 'Deposit', prefix: 'DEP' },
    { query: `SELECT * FROM Transfer WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC`, entity: 'Transfer', prefix: 'TRF' },
    { query: `SELECT * FROM Payment WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC`, entity: 'Payment', prefix: 'PMT' },
    { query: `SELECT * FROM SalesReceipt WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC`, entity: 'SalesReceipt', prefix: 'SR' },
  ]

  for (const { query, entity, prefix } of txnTypes) {
    try {
      // Full pagination via qboQuery
      const items = await qboQuery(accessToken, realmId, query, entity)

      for (const item of items) {
        try {
          const qbId = `${prefix}-${item.Id}`
          let amount = 0, payee = '', description = '', qbCategory = '', accountName = ''

          if (entity === 'Purchase') {
            amount = -Math.abs(item.TotalAmt || 0)
            payee = item.EntityRef?.name || ''
            accountName = item.AccountRef?.name || ''
            const line = item.Line?.[0]
            description = line?.Description || ''
            if (line?.AccountBasedExpenseLineDetail) qbCategory = line.AccountBasedExpenseLineDetail.AccountRef?.name || ''
            if (line?.ItemBasedExpenseLineDetail) qbCategory = qbCategory || line.ItemBasedExpenseLineDetail.ItemRef?.name || ''
            if (!description) description = item.PrivateNote || payee || 'Purchase'
          } else if (entity === 'Deposit') {
            amount = Math.abs(item.TotalAmt || 0)
            accountName = item.DepositToAccountRef?.name || ''
            const line = item.Line?.[0]
            payee = line?.DepositLineDetail?.Entity?.name || ''
            description = line?.Description || item.PrivateNote || 'Deposit'
            if (line?.DepositLineDetail?.AccountRef) qbCategory = line.DepositLineDetail.AccountRef.name || ''
          } else if (entity === 'Transfer') {
            amount = item.Amount || 0
            accountName = item.FromAccountRef?.name || ''
            description = `Transfer: ${item.FromAccountRef?.name || '?'} → ${item.ToAccountRef?.name || '?'}`
            payee = 'Internal Transfer'
            qbCategory = 'Transfer'
          } else if (entity === 'Payment') {
            amount = Math.abs(item.TotalAmt || 0)
            payee = item.CustomerRef?.name || ''
            description = `Payment Received - ${payee}`
            accountName = item.DepositToAccountRef?.name || 'Undeposited Funds'
            qbCategory = 'Payment'
          } else if (entity === 'SalesReceipt') {
            amount = Math.abs(item.TotalAmt || 0)
            payee = item.CustomerRef?.name || ''
            description = item.Line?.[0]?.Description || `Sales Receipt - ${payee}`
            accountName = item.DepositToAccountRef?.name || ''
            qbCategory = 'Sales'
          }

          // Skip zero-amount
          if (amount === 0 && entity !== 'Transfer') continue

          // Auto-categorize (learned patterns → QBO hints → vendor rules → amount sign)
          const { category, subcategory } = categorizeTransaction(payee, qbCategory, amount, patterns)

          // Parse client/project from customer payments
          const { client, project } = (entity === 'Payment' || entity === 'SalesReceipt' || entity === 'Deposit')
            ? parseCustomerProject(payee) : { client: '', project: null }

          const { error } = await supabase.from('transactions').upsert({
            company_id: companyId,
            qb_id: qbId,
            date: item.TxnDate,
            description,
            amount,
            payee,
            qb_category: qbCategory,
            category,
            subcategory: subcategory || null,
            type: 'actual',
            client: client || null,
            project: project || null,
            account_name: accountName,
            sync_source: 'quickbooks',
            synced_at: new Date().toISOString(),
          }, { onConflict: 'company_id,qb_id', ignoreDuplicates: false })

          if (error) { console.error(`Upsert error ${qbId}:`, error.message); errors++ }
          else synced++
        } catch (e: any) { console.error(`Error processing ${entity} ${item.Id}:`, e.message); errors++ }
      }
    } catch (e: any) {
      console.error(`Error fetching ${entity}:`, e.message)
      if (e.message === 'QBO_TOKEN_EXPIRED') throw e // Bubble up auth errors
    }
  }

  return { synced, errors }
}

// ============ SYNC INVOICES ============

async function syncInvoices(
  accessToken: string,
  realmId: string,
  companyId: string,
  supabase: any
): Promise<{ synced: number; errors: number }> {
  let synced = 0
  let errors = 0
  const START_DATE = '2026-01-01'

  // Full pagination
  const invoices = await qboQuery(
    accessToken, realmId,
    `SELECT * FROM Invoice WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC`,
    'Invoice'
  )

  for (const inv of invoices) {
    try {
      const customerProjectRaw = inv.CustomerRef?.name || ''
      const { client, project } = parseCustomerProject(customerProjectRaw)
      const balance = inv.Balance || 0
      const totalAmount = inv.TotalAmt || 0
      const { status, statusDetail, daysOverdue } = parseInvoiceStatus(balance, inv.DueDate)

      // Write to accrual_transactions (preserving existing behavior)
      const { error: accrualErr } = await supabase.from('accrual_transactions').upsert({
        company_id: companyId,
        qb_invoice_id: inv.Id,
        invoice_number: inv.DocNumber || '',
        date: inv.TxnDate,
        customer_project_raw: customerProjectRaw,
        client,
        project,
        amount: totalAmount,
        status,
        status_detail: statusDetail,
        days_overdue: daysOverdue,
        type: 'revenue',
        category: 'revenue',
        description: `Invoice #${inv.DocNumber || inv.Id}`,
        sync_source: 'quickbooks',
        synced_at: new Date().toISOString(),
      }, { onConflict: 'company_id,qb_invoice_id', ignoreDuplicates: false })

      if (accrualErr) {
        console.error('Accrual upsert error:', accrualErr.message)
        errors++
        continue
      }

      // Also write to invoices table (preserving existing behavior)
      await supabase.from('invoices').upsert({
        company_id: companyId,
        qb_invoice_id: inv.Id,
        invoice_number: inv.DocNumber || '',
        customer_project_raw: customerProjectRaw,
        client,
        project,
        amount: totalAmount,
        amount_paid: totalAmount - balance,
        balance_due: balance,
        invoice_date: inv.TxnDate,
        due_date: inv.DueDate,
        status,
        status_detail: statusDetail,
        days_overdue: daysOverdue,
        sync_source: 'quickbooks',
        synced_at: new Date().toISOString(),
      }, { onConflict: 'company_id,qb_invoice_id', ignoreDuplicates: false })

      synced++
    } catch (e: any) { console.error(`Error processing invoice ${inv.Id}:`, e.message); errors++ }
  }

  return { synced, errors }
}

// ============ POST: TRIGGER SYNC ============

export async function POST(request: NextRequest) {
  try {
    const { companyId, syncType } = await request.json()
    // syncType: 'bank' | 'invoices' | 'all' (default)

    if (!companyId) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 })
    }

    // Get valid token (auto-refreshes if expired)
    const auth = await getQBOAccessToken(companyId)
    if (!auth.success) {
      return NextResponse.json({ error: auth.error, reconnect: true }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const results: any = { bank: null, invoices: null }

    // Load learned patterns for auto-categorization
    const patterns = await loadLearnedPatterns(supabase, companyId)
    console.log(`Loaded ${patterns.length} learned patterns`)

    if (!syncType || syncType === 'all' || syncType === 'bank') {
      results.bank = await syncBankTransactions(auth.accessToken, auth.realmId, companyId, supabase, patterns)

      // Save last sync timestamp
      await supabase.from('company_settings').update({
        qbo_last_bank_sync: new Date().toISOString(),
      }).eq('company_id', companyId).then(() => {})
    }

    if (!syncType || syncType === 'all' || syncType === 'invoices') {
      results.invoices = await syncInvoices(auth.accessToken, auth.realmId, companyId, supabase)

      await supabase.from('company_settings').update({
        qbo_last_invoice_sync: new Date().toISOString(),
      }).eq('company_id', companyId).then(() => {})
    }

    return NextResponse.json({
      success: true,
      results,
      syncedAt: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('QBO sync error:', err)
    const isAuthErr = err.message === 'QBO_TOKEN_EXPIRED'
    return NextResponse.json(
      { error: isAuthErr ? 'Session expired, please reconnect QuickBooks' : (err.message || 'Sync failed'), reconnect: isAuthErr },
      { status: isAuthErr ? 401 : 500 }
    )
  }
}

// ============ GET: SYNC STATUS ============

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId')

  if (!companyId) {
    return NextResponse.json({ error: 'companyId required' }, { status: 400 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: settings } = await supabase
    .from('company_settings')
    .select('qbo_realm_id, qbo_connected_at, qbo_token_expires_at, qbo_last_bank_sync, qbo_last_invoice_sync')
    .eq('company_id', companyId)
    .single()

  const connected = !!settings?.qbo_realm_id

  const { count: txnCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('sync_source', 'quickbooks')

  const { count: invCount } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('sync_source', 'quickbooks')

  return NextResponse.json({
    connected,
    connectedAt: settings?.qbo_connected_at || null,
    lastBankSync: settings?.qbo_last_bank_sync || null,
    lastInvoiceSync: settings?.qbo_last_invoice_sync || null,
    counts: { transactions: txnCount || 0, invoices: invCount || 0 },
  })
}
