// Save as: src/app/api/qbo/sync/route.ts
// Clean rebuild — two streams:
//   1. QBO Invoices  → invoices table (AR, revenue, DSO)
//   2. QBO Bank Feed → transactions table (cash in/out, no categories)
// No bills, no vendors, no accrual_transactions, no QBO categories imported.

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

function computeInvoiceStatus(balance: number, dueDate: string | null): {
  status: string; statusDetail: string; daysOverdue: number
} {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (balance <= 0) return { status: 'paid', statusDetail: 'Paid', daysOverdue: 0 }
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

// ============ CLIENT / PROJECT ID MATCHING ============

async function buildLookups(supabase: any, companyId: string) {
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .eq('company_id', companyId)

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, client_id')
    .eq('company_id', companyId)

  const clientMap: Record<string, string> = {}
  for (const c of (clients || [])) {
    clientMap[c.name.toLowerCase().trim()] = c.id
  }

  const projectMap: Record<string, string> = {}
  for (const p of (projects || [])) {
    projectMap[p.name.toLowerCase().trim()] = p.id
  }

  return { clientMap, projectMap }
}

function resolveClientId(clientName: string, clientMap: Record<string, string>): string | null {
  if (!clientName) return null
  return clientMap[clientName.toLowerCase().trim()] || null
}

function resolveProjectId(projectName: string | null, projectMap: Record<string, string>): string | null {
  if (!projectName) return null
  return projectMap[projectName.toLowerCase().trim()] || null
}

// ============ STREAM 1: SYNC INVOICES ============

async function syncInvoices(
  accessToken: string,
  realmId: string,
  companyId: string,
  supabase: any,
  clientMap: Record<string, string>,
  projectMap: Record<string, string>
): Promise<{ synced: number; skipped: number; errors: number; unmatchedClients: string[] }> {
  let synced = 0, skipped = 0, errors = 0
  const unmatchedClients = new Set<string>()

  // Pull ALL invoices — full AR picture, no date filter
  const invoices = await qboQuery(
    accessToken, realmId,
    `SELECT * FROM Invoice ORDER BY TxnDate DESC`,
    'Invoice'
  )

  console.log(`QBO: Found ${invoices.length} total invoices`)

  for (const inv of invoices) {
    try {
      const customerProjectRaw = inv.CustomerRef?.name || ''
      const { client, project } = parseCustomerProject(customerProjectRaw)
      const totalAmount = inv.TotalAmt || 0
      const balance = inv.Balance || 0
      const amountPaid = totalAmount - balance
      const { status, statusDetail, daysOverdue } = computeInvoiceStatus(balance, inv.DueDate)

      const clientId = resolveClientId(client, clientMap)
      const projectId = resolveProjectId(project, projectMap)

      if (client && !clientId) unmatchedClients.add(client)

      const { error } = await supabase.from('invoices').upsert({
        company_id: companyId,
        qb_invoice_id: inv.Id,
        invoice_number: inv.DocNumber || '',
        customer_project_raw: customerProjectRaw,
        client,
        project,
        client_id: clientId,
        project_id: projectId,
        amount: totalAmount,
        amount_paid: amountPaid,
        balance_due: balance,
        invoice_date: inv.TxnDate,
        due_date: inv.DueDate || null,
        paid_date: balance <= 0 ? inv.TxnDate : null,
        status,
        status_detail: statusDetail,
        days_overdue: daysOverdue,
        sync_source: 'quickbooks',
        synced_at: new Date().toISOString(),
      }, { onConflict: 'company_id,qb_invoice_id', ignoreDuplicates: false })

      if (error) {
        console.error(`Invoice upsert error (${inv.DocNumber}):`, error.message)
        errors++
      } else {
        synced++
      }
    } catch (e: any) {
      console.error(`Error processing invoice ${inv.Id}:`, e.message)
      errors++
    }
  }

  return { synced, skipped, errors, unmatchedClients: Array.from(unmatchedClients) }
}

// ============ STREAM 2: SYNC BANK FEED ============

async function syncBankFeed(
  accessToken: string,
  realmId: string,
  companyId: string,
  supabase: any
): Promise<{ synced: number; skipped: number; errors: number }> {
  let synced = 0, skipped = 0, errors = 0
  const START_DATE = '2024-01-01'

  const streams = [
    {
      query: `SELECT * FROM Purchase WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC`,
      entity: 'Purchase',
      prefix: 'PUR',
      parse: (item: any) => ({
        amount: -Math.abs(item.TotalAmt || 0),
        payee: item.EntityRef?.name || '',
        description: item.Line?.[0]?.Description || item.PrivateNote || item.EntityRef?.name || 'Purchase',
        accountName: item.AccountRef?.name || '',
      }),
    },
    {
      query: `SELECT * FROM Deposit WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC`,
      entity: 'Deposit',
      prefix: 'DEP',
      parse: (item: any) => ({
        amount: Math.abs(item.TotalAmt || 0),
        payee: item.Line?.[0]?.DepositLineDetail?.Entity?.name || '',
        description: item.Line?.[0]?.Description || item.PrivateNote || 'Deposit',
        accountName: item.DepositToAccountRef?.name || '',
      }),
    },
    {
      query: `SELECT * FROM Transfer WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC`,
      entity: 'Transfer',
      prefix: 'TRF',
      parse: (item: any) => ({
        amount: -(item.Amount || 0),
        payee: 'Internal Transfer',
        description: `Transfer: ${item.FromAccountRef?.name || '?'} → ${item.ToAccountRef?.name || '?'}`,
        accountName: item.FromAccountRef?.name || '',
      }),
    },
    {
      query: `SELECT * FROM Payment WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC`,
      entity: 'Payment',
      prefix: 'PMT',
      parse: (item: any) => ({
        amount: Math.abs(item.TotalAmt || 0),
        payee: item.CustomerRef?.name || '',
        description: `Payment Received - ${item.CustomerRef?.name || ''}`,
        accountName: item.DepositToAccountRef?.name || 'Undeposited Funds',
      }),
    },
    {
      query: `SELECT * FROM SalesReceipt WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC`,
      entity: 'SalesReceipt',
      prefix: 'SR',
      parse: (item: any) => ({
        amount: Math.abs(item.TotalAmt || 0),
        payee: item.CustomerRef?.name || '',
        description: item.Line?.[0]?.Description || `Sales Receipt - ${item.CustomerRef?.name || ''}`,
        accountName: item.DepositToAccountRef?.name || '',
      }),
    },
    {
      query: `SELECT * FROM JournalEntry WHERE TxnDate >= '${START_DATE}' ORDER BY TxnDate DESC`,
      entity: 'JournalEntry',
      prefix: 'JE',
      parse: (item: any) => {
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
  ]

  for (const stream of streams) {
    try {
      const items = await qboQuery(accessToken, realmId, stream.query, stream.entity)
      console.log(`QBO Bank: ${items.length} ${stream.entity}`)

      for (const item of items) {
        try {
          const qbId = `${stream.prefix}-${item.Id}`
          const parsed = stream.parse(item)

          if (parsed.amount === 0 && stream.entity !== 'Transfer') {
            skipped++
            continue
          }

          // Raw bank feed — only update QBO-sourced fields, NEVER overwrite user categorizations
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

          if (error) {
            console.error(`Txn upsert error ${qbId}:`, error.message)
            errors++
          } else {
            synced++
          }
        } catch (e: any) {
          console.error(`Error processing ${stream.entity} ${item.Id}:`, e.message)
          errors++
        }
      }
    } catch (e: any) {
      console.error(`Error fetching ${stream.entity}:`, e.message)
      if (e.message === 'QBO_TOKEN_EXPIRED') throw e
    }
  }

  return { synced, skipped, errors }
}

// ============ POST: TRIGGER SYNC ============

export async function POST(request: NextRequest) {
  try {
    const { companyId, syncType } = await request.json()

    if (!companyId) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 })
    }

    const auth = await getQBOAccessToken(companyId)
    if (!auth.success) {
      return NextResponse.json({ error: auth.error, reconnect: true }, { status: 401 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Build name → ID lookups for client/project matching
    const { clientMap, projectMap } = await buildLookups(supabase, companyId)
    console.log(`Lookups: ${Object.keys(clientMap).length} clients, ${Object.keys(projectMap).length} projects`)

    const results: any = { invoices: null, bank: null }

    // Stream 1: Invoices → invoices table
    if (!syncType || syncType === 'all' || syncType === 'invoices') {
      results.invoices = await syncInvoices(auth.accessToken, auth.realmId, companyId, supabase, clientMap, projectMap)
      await supabase.from('company_settings').update({
        qbo_last_invoice_sync: new Date().toISOString(),
      }).eq('company_id', companyId)
    }

    // Stream 2: Bank Feed → transactions table
    if (!syncType || syncType === 'all' || syncType === 'bank') {
      results.bank = await syncBankFeed(auth.accessToken, auth.realmId, companyId, supabase)
      await supabase.from('company_settings').update({
        qbo_last_bank_sync: new Date().toISOString(),
      }).eq('company_id', companyId)
    }

    const totalSynced = (results.invoices?.synced || 0) + (results.bank?.synced || 0)
    const totalErrors = (results.invoices?.errors || 0) + (results.bank?.errors || 0)

    return NextResponse.json({
      success: true,
      results,
      summary: {
        totalSynced,
        totalErrors,
        unmatchedClients: results.invoices?.unmatchedClients || [],
      },
      syncedAt: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('QBO sync error:', err)
    const isAuthErr = err.message === 'QBO_TOKEN_EXPIRED'
    return NextResponse.json(
      {
        error: isAuthErr ? 'Session expired — please reconnect QuickBooks' : (err.message || 'Sync failed'),
        reconnect: isAuthErr,
      },
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
    connected,
    connectedAt: settings?.qbo_connected_at || null,
    tokenExpiresAt: settings?.qbo_token_expires_at || null,
    lastInvoiceSync: settings?.qbo_last_invoice_sync || null,
    lastBankSync: settings?.qbo_last_bank_sync || null,
    counts: {
      invoices: invoiceCount || 0,
      transactions: txnCount || 0,
    },
  })
}
