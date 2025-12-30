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

// Helper to categorize QB transactions
function categorizeTransaction(qbCategory: string | null, amount: number): string {
  if (!qbCategory) return amount > 0 ? 'revenue' : 'opex'
  
  const cat = qbCategory.toLowerCase()
  
  // Revenue indicators
  if (cat.includes('income') || cat.includes('sales') || cat.includes('revenue')) {
    return 'revenue'
  }
  
  // Overhead indicators
  if (cat.includes('rent') || cat.includes('utilities') || cat.includes('insurance') ||
      cat.includes('office') || cat.includes('admin') || cat.includes('internet')) {
    return 'overhead'
  }
  
  // Default to opex for expenses
  return amount > 0 ? 'revenue' : 'opex'
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

export async function POST(request: NextRequest) {
  try {
    const { companyId, syncType } = await request.json()
    
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID required' }, { status: 400 })
    }

    // Get QuickBooks credentials
    const { data: qbConnection, error: connError } = await supabase
      .from('quickbooks_connections')
      .select('*')
      .eq('company_id', companyId)
      .single()

    if (connError || !qbConnection) {
      return NextResponse.json({ error: 'QuickBooks not connected' }, { status: 400 })
    }

    // Check if token needs refresh
    let accessToken = qbConnection.access_token
    const tokenExpiry = new Date(qbConnection.token_expires_at)
    
    if (tokenExpiry < new Date()) {
      // Refresh token logic here (implement separately)
      return NextResponse.json({ error: 'Token expired, please reconnect' }, { status: 401 })
    }

    const realmId = qbConnection.realm_id
    const results = {
      bankTransactions: { synced: 0, skipped: 0, errors: 0 },
      invoices: { synced: 0, skipped: 0, errors: 0 }
    }

    // ========================================
    // SYNC BANK TRANSACTIONS (Cash Basis)
    // ========================================
    if (!syncType || syncType === 'all' || syncType === 'bank') {
      try {
        // Query purchases (expenses)
        const purchaseQuery = `SELECT * FROM Purchase WHERE TxnDate >= '2024-01-01' MAXRESULTS 1000`
        const purchaseResponse = await fetch(
          `${QB_API_BASE}/${realmId}/query?query=${encodeURIComponent(purchaseQuery)}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json'
            }
          }
        )

        if (purchaseResponse.ok) {
          const purchaseData = await purchaseResponse.json()
          const purchases = purchaseData.QueryResponse?.Purchase || []

          for (const purchase of purchases) {
            const qbId = purchase.Id
            const amount = -Math.abs(purchase.TotalAmt || 0) // Expenses are negative
            
            // Get payee name
            let payee = ''
            if (purchase.EntityRef) {
              payee = purchase.EntityRef.name || ''
            }

            // Get category from line items
            let qbCategory = ''
            if (purchase.Line && purchase.Line[0]?.AccountBasedExpenseLineDetail) {
              const accountRef = purchase.Line[0].AccountBasedExpenseLineDetail.AccountRef
              qbCategory = accountRef?.name || ''
            }

            const category = categorizeTransaction(qbCategory, amount)

            const transactionData = {
              company_id: companyId,
              qb_id: qbId,
              date: purchase.TxnDate,
              description: purchase.PrivateNote || purchase.Line?.[0]?.Description || '',
              amount: amount,
              payee: payee,
              qb_category: qbCategory,
              category: category,
              type: 'expense',
              account_name: purchase.AccountRef?.name || '',
              sync_source: 'quickbooks',
              synced_at: new Date().toISOString()
            }

            // Upsert to prevent duplicates
            const { error: upsertError } = await supabase
              .from('transactions')
              .upsert(transactionData, { 
                onConflict: 'company_id,qb_id',
                ignoreDuplicates: false 
              })

            if (upsertError) {
              console.error('Transaction upsert error:', upsertError)
              results.bankTransactions.errors++
            } else {
              results.bankTransactions.synced++
            }
          }
        }

        // Query deposits/payments (income)
        const depositQuery = `SELECT * FROM Deposit WHERE TxnDate >= '2024-01-01' MAXRESULTS 1000`
        const depositResponse = await fetch(
          `${QB_API_BASE}/${realmId}/query?query=${encodeURIComponent(depositQuery)}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json'
            }
          }
        )

        if (depositResponse.ok) {
          const depositData = await depositResponse.json()
          const deposits = depositData.QueryResponse?.Deposit || []

          for (const deposit of deposits) {
            const qbId = `DEP-${deposit.Id}`
            const amount = Math.abs(deposit.TotalAmt || 0)

            const transactionData = {
              company_id: companyId,
              qb_id: qbId,
              date: deposit.TxnDate,
              description: deposit.PrivateNote || 'Deposit',
              amount: amount,
              payee: '',
              qb_category: 'Deposits',
              category: 'revenue',
              type: 'income',
              account_name: deposit.DepositToAccountRef?.name || '',
              sync_source: 'quickbooks',
              synced_at: new Date().toISOString()
            }

            const { error: upsertError } = await supabase
              .from('transactions')
              .upsert(transactionData, { 
                onConflict: 'company_id,qb_id',
                ignoreDuplicates: false 
              })

            if (upsertError) {
              results.bankTransactions.errors++
            } else {
              results.bankTransactions.synced++
            }
          }
        }

      } catch (bankError) {
        console.error('Bank sync error:', bankError)
      }
    }

    // ========================================
    // SYNC INVOICES (Accrual Basis)
    // ========================================
    if (!syncType || syncType === 'all' || syncType === 'invoices') {
      try {
        const invoiceQuery = `SELECT * FROM Invoice WHERE TxnDate >= '2024-01-01' MAXRESULTS 1000`
        const invoiceResponse = await fetch(
          `${QB_API_BASE}/${realmId}/query?query=${encodeURIComponent(invoiceQuery)}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json'
            }
          }
        )

        if (invoiceResponse.ok) {
          const invoiceData = await invoiceResponse.json()
          const invoices = invoiceData.QueryResponse?.Invoice || []

          for (const invoice of invoices) {
            const qbInvoiceId = invoice.Id
            const customerProjectRaw = invoice.CustomerRef?.name || ''
            const { client, project } = parseCustomerProject(customerProjectRaw)
            const balance = invoice.Balance || 0
            const totalAmount = invoice.TotalAmt || 0
            const { status, statusDetail, daysOverdue } = parseInvoiceStatus(balance, invoice.DueDate)

            // Insert into accrual_transactions
            const accrualData = {
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
            }

            const { error: accrualError } = await supabase
              .from('accrual_transactions')
              .upsert(accrualData, { 
                onConflict: 'company_id,qb_invoice_id',
                ignoreDuplicates: false 
              })

            if (accrualError) {
              console.error('Accrual upsert error:', accrualError)
              results.invoices.errors++
              continue
            }

            // Also insert/update in invoices table for detailed tracking
            const invoiceTableData = {
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
            }

            await supabase
              .from('invoices')
              .upsert(invoiceTableData, { 
                onConflict: 'company_id,qb_invoice_id',
                ignoreDuplicates: false 
              })

            results.invoices.synced++
          }
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

  // Get last sync info
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

  // Get counts
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
