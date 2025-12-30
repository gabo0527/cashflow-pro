import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// QuickBooks API base URL
const QB_API_BASE = 'https://quickbooks.api.intuit.com/v3/company'

// Helper to parse "Customer:Project" format
function parseCustomerProject(raw: string): { client: string; project: string | null } {
  if (!raw) return { client: '', project: null }
  
  const colonIndex = raw.indexOf(':')
  if (colonIndex > 0) {
    return {
      client: raw.substring(0, colonIndex).trim(),
      project: raw.substring(colonIndex + 1).trim() || null
    }
  }
  return { client: raw.trim(), project: null }
}

// Helper to parse invoice status
function parseInvoiceStatus(balance: number, dueDate: string | null): { status: string; statusDetail: string; daysOverdue: number } {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  if (balance === 0) {
    return { status: 'paid', statusDetail: 'Paid', daysOverdue: 0 }
  }
  
  if (!dueDate) {
    return { status: 'pending', statusDetail: 'Pending', daysOverdue: 0 }
  }
  
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays > 0) {
    return { status: 'overdue', statusDetail: `Overdue ${diffDays} days`, daysOverdue: diffDays }
  } else if (diffDays === 0) {
    return { status: 'due_today', statusDetail: 'Due today', daysOverdue: 0 }
  } else if (diffDays >= -1) {
    return { status: 'due_soon', statusDetail: 'Due tomorrow', daysOverdue: 0 }
  } else if (diffDays >= -7) {
    return { status: 'due_soon', statusDetail: `Due in ${Math.abs(diffDays)} days`, daysOverdue: 0 }
  }
  
  return { status: 'pending', statusDetail: `Due in ${Math.abs(diffDays)} days`, daysOverdue: 0 }
}

// Helper function to fetch all pages from QB (handles pagination)
async function fetchAllFromQB(
  realmId: string, 
  accessToken: string, 
  query: string, 
  entityName: string
): Promise<any[]> {
  const allResults: any[] = []
  let startPosition = 1
  const maxResults = 1000
  let hasMore = true

  while (hasMore) {
    const pagedQuery = `${query} STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`
    console.log(`Fetching ${entityName}: page starting at ${startPosition}`)
    
    const response = await fetch(
      `${QB_API_BASE}/${realmId}/query?query=${encodeURIComponent(pagedQuery)}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      console.error(`QB query failed for ${entityName}:`, await response.text())
      break
    }

    const data = await response.json()
    const items = data.QueryResponse?.[entityName] || []
    allResults.push(...items)
    
    console.log(`Fetched ${items.length} ${entityName} (total: ${allResults.length})`)

    if (items.length < maxResults) {
      hasMore = false
    } else {
      startPosition += maxResults
    }
  }

  return allResults
}

export async function POST(request: NextRequest) {
  try {
    const { companyId, syncType } = await request.json()
    
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 })
    }

    // Get QuickBooks credentials from company_settings
    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('qbo_realm_id, qbo_access_token, qbo_refresh_token, qbo_token_expires_at')
      .eq('company_id', companyId)
      .single()

    if (settingsError || !settings || !settings.qbo_access_token) {
      return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 400 })
    }

    // Decrypt the access token
    const { decryptToken } = await import('@/lib/qbo-encryption')
    let accessToken = decryptToken(settings.qbo_access_token)
    
    // Check if token needs refresh
    const tokenExpiry = new Date(settings.qbo_token_expires_at)
    
    if (tokenExpiry < new Date()) {
      return NextResponse.json({ error: 'Token expired, please reconnect' }, { status: 401 })
    }

    const realmId = settings.qbo_realm_id
    const results = {
      bankTransactions: { synced: 0, skipped: 0, errors: 0 },
      invoices: { synced: 0, skipped: 0, errors: 0 }
    }

    // ========================================
    // SYNC BANK TRANSACTIONS (Cash Basis)
    // Pulls: Purchases, Deposits, Transfers, Payments, SalesReceipts
    // These are the transactions that hit your bank accounts
    // ========================================
    if (!syncType || syncType === 'all' || syncType === 'bank') {
      try {
        // 1. PURCHASES (Expenses - checks, credit cards, etc.)
        const purchases = await fetchAllFromQB(
          realmId,
          accessToken,
          `SELECT * FROM Purchase ORDER BY TxnDate DESC`,
          'Purchase'
        )

        for (const purchase of purchases) {
          const qbId = `PUR-${purchase.Id}`
          const amount = -Math.abs(purchase.TotalAmt || 0)
          
          let payee = purchase.EntityRef?.name || ''
          let description = ''
          let qbCategory = ''
          
          if (purchase.Line && purchase.Line.length > 0) {
            const firstLine = purchase.Line[0]
            description = firstLine.Description || ''
            if (firstLine.AccountBasedExpenseLineDetail) {
              qbCategory = firstLine.AccountBasedExpenseLineDetail.AccountRef?.name || ''
            }
          }
          
          if (!description) description = purchase.PrivateNote || payee || 'Purchase'

          const { error } = await supabase
            .from('transactions')
            .upsert({
              company_id: companyId,
              qb_id: qbId,
              date: purchase.TxnDate,
              description: description,
              amount: amount,
              payee: payee,
              qb_category: qbCategory,
              category: 'opex',
              type: 'expense',
              account_name: purchase.AccountRef?.name || '',
              sync_source: 'quickbooks',
              synced_at: new Date().toISOString()
            }, { onConflict: 'company_id,qb_id', ignoreDuplicates: false })

          if (error) results.bankTransactions.errors++
          else results.bankTransactions.synced++
        }

        // 2. DEPOSITS (Income to bank)
        const deposits = await fetchAllFromQB(realmId, accessToken,
          `SELECT * FROM Deposit ORDER BY TxnDate DESC`,
          'Deposit'
        )

        for (const deposit of deposits) {
          const qbId = `DEP-${deposit.Id}`
          const amount = Math.abs(deposit.TotalAmt || 0)
          let description = deposit.PrivateNote || 'Deposit'
          let payee = ''
          
          if (deposit.Line && deposit.Line.length > 0) {
            const firstLine = deposit.Line[0]
            if (firstLine.DepositLineDetail?.Entity) {
              payee = firstLine.DepositLineDetail.Entity.name || ''
            }
          }

          const { error } = await supabase
            .from('transactions')
            .upsert({
              company_id: companyId,
              qb_id: qbId,
              date: deposit.TxnDate,
              description: description,
              amount: amount,
              payee: payee,
              qb_category: 'Income',
              category: 'revenue',
              type: 'income',
              account_name: deposit.DepositToAccountRef?.name || '',
              sync_source: 'quickbooks',
              synced_at: new Date().toISOString()
            }, { onConflict: 'company_id,qb_id', ignoreDuplicates: false })

          if (error) results.bankTransactions.errors++
          else results.bankTransactions.synced++
        }

        // 3. TRANSFERS between accounts
        const transfers = await fetchAllFromQB(realmId, accessToken,
          `SELECT * FROM Transfer ORDER BY TxnDate DESC`,
          'Transfer'
        )

        for (const transfer of transfers) {
          const qbId = `TRF-${transfer.Id}`
          const amount = -Math.abs(transfer.Amount || 0)

          const { error } = await supabase
            .from('transactions')
            .upsert({
              company_id: companyId,
              qb_id: qbId,
              date: transfer.TxnDate,
              description: `Transfer: ${transfer.FromAccountRef?.name || ''} → ${transfer.ToAccountRef?.name || ''}`,
              amount: amount,
              payee: '',
              qb_category: 'Transfer',
              category: 'opex',
              type: 'transfer',
              account_name: transfer.FromAccountRef?.name || '',
              sync_source: 'quickbooks',
              synced_at: new Date().toISOString()
            }, { onConflict: 'company_id,qb_id', ignoreDuplicates: false })

          if (error) results.bankTransactions.errors++
          else results.bankTransactions.synced++
        }

        // 4. PAYMENTS received (invoice payments)
        const payments = await fetchAllFromQB(realmId, accessToken,
          `SELECT * FROM Payment ORDER BY TxnDate DESC`,
          'Payment'
        )

        for (const payment of payments) {
          const qbId = `PMT-${payment.Id}`
          const amount = Math.abs(payment.TotalAmt || 0)
          const customerName = payment.CustomerRef?.name || ''

          const { error } = await supabase
            .from('transactions')
            .upsert({
              company_id: companyId,
              qb_id: qbId,
              date: payment.TxnDate,
              description: `Payment Received - ${customerName}`,
              amount: amount,
              payee: customerName,
              qb_category: 'Payment',
              category: 'revenue',
              type: 'income',
              account_name: payment.DepositToAccountRef?.name || 'Undeposited Funds',
              sync_source: 'quickbooks',
              synced_at: new Date().toISOString()
            }, { onConflict: 'company_id,qb_id', ignoreDuplicates: false })

          if (error) results.bankTransactions.errors++
          else results.bankTransactions.synced++
        }

        // 5. SALES RECEIPTS (direct sales, not invoiced)
        const salesReceipts = await fetchAllFromQB(realmId, accessToken,
          `SELECT * FROM SalesReceipt ORDER BY TxnDate DESC`,
          'SalesReceipt'
        )

        for (const receipt of salesReceipts) {
          const qbId = `SR-${receipt.Id}`
          const amount = Math.abs(receipt.TotalAmt || 0)
          const customerName = receipt.CustomerRef?.name || ''

          const { error } = await supabase
            .from('transactions')
            .upsert({
              company_id: companyId,
              qb_id: qbId,
              date: receipt.TxnDate,
              description: `Sales Receipt - ${customerName}`,
              amount: amount,
              payee: customerName,
              qb_category: 'Sales',
              category: 'revenue',
              type: 'income',
              account_name: receipt.DepositToAccountRef?.name || '',
              sync_source: 'quickbooks',
              synced_at: new Date().toISOString()
            }, { onConflict: 'company_id,qb_id', ignoreDuplicates: false })

          if (error) results.bankTransactions.errors++
          else results.bankTransactions.synced++
        }

      } catch (bankError) {
        console.error('Bank sync error:', bankError)
      }
    }

    // ========================================
    // SYNC INVOICES (Accrual Basis - Sales)
    // From: Sales & Get Paid → Invoices
    // ========================================
    if (!syncType || syncType === 'all' || syncType === 'invoices') {
      try {
        const invoices = await fetchAllFromQB(realmId, accessToken,
          `SELECT * FROM Invoice ORDER BY TxnDate DESC`,
          'Invoice'
        )

        console.log(`Found ${invoices.length} invoices`)

        for (const invoice of invoices) {
          const qbInvoiceId = invoice.Id
          const customerProjectRaw = invoice.CustomerRef?.name || ''
          const { client, project } = parseCustomerProject(customerProjectRaw)
          const balance = invoice.Balance || 0
          const totalAmount = invoice.TotalAmt || 0
          const { status, statusDetail, daysOverdue } = parseInvoiceStatus(balance, invoice.DueDate)

          // Insert into accrual_transactions
          const { error: accrualError } = await supabase
            .from('accrual_transactions')
            .upsert({
              company_id: companyId,
              qb_invoice_id: qbInvoiceId,
              invoice_number: invoice.DocNumber || '',
              date: invoice.TxnDate,
              customer_project_raw: customerProjectRaw,
              client: client,
              project: project,
              amount: totalAmount,
              status: status,
              status_detail: statusDetail,
              days_overdue: daysOverdue,
              type: 'revenue',
              category: 'revenue',
              description: `Invoice #${invoice.DocNumber || qbInvoiceId}`,
              sync_source: 'quickbooks',
              synced_at: new Date().toISOString()
            }, { onConflict: 'company_id,qb_invoice_id', ignoreDuplicates: false })

          if (accrualError) {
            console.error('Accrual upsert error:', accrualError)
            results.invoices.errors++
            continue
          }

          // Also insert into invoices table
          await supabase
            .from('invoices')
            .upsert({
              company_id: companyId,
              qb_invoice_id: qbInvoiceId,
              invoice_number: invoice.DocNumber || '',
              customer_project_raw: customerProjectRaw,
              client: client,
              project: project,
              amount: totalAmount,
              amount_paid: totalAmount - balance,
              balance_due: balance,
              invoice_date: invoice.TxnDate,
              due_date: invoice.DueDate,
              status: status,
              status_detail: statusDetail,
              days_overdue: daysOverdue,
              sync_source: 'quickbooks',
              synced_at: new Date().toISOString()
            }, { onConflict: 'company_id,qb_invoice_id', ignoreDuplicates: false })

          results.invoices.synced++
        }

      } catch (invoiceError) {
        console.error('Invoice sync error:', invoiceError)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Sync completed',
      results,
      syncedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('QB Sync error:', error)
    return NextResponse.json({ 
      error: 'Sync failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

// GET endpoint to check sync status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId')

  if (!companyId) {
    return NextResponse.json({ error: 'Company ID required' }, { status: 400 })
  }

  const { data: lastTransaction } = await supabase
    .from('transactions')
    .select('synced_at')
    .eq('company_id', companyId)
    .eq('sync_source', 'quickbooks')
    .order('synced_at', { ascending: false })
    .limit(1)
    .single()

  const { data: lastInvoice } = await supabase
    .from('accrual_transactions')
    .select('synced_at')
    .eq('company_id', companyId)
    .eq('sync_source', 'quickbooks')
    .order('synced_at', { ascending: false })
    .limit(1)
    .single()

  const { count: transactionCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('sync_source', 'quickbooks')

  const { count: invoiceCount } = await supabase
    .from('accrual_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('sync_source', 'quickbooks')

  return NextResponse.json({
    lastSync: {
      transactions: lastTransaction?.synced_at,
      invoices: lastInvoice?.synced_at
    },
    counts: {
      transactions: transactionCount || 0,
      invoices: invoiceCount || 0
    }
  })
}
