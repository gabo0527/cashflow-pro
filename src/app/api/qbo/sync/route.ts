// Save as: src/app/api/qbo/sync/route.ts

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { encryptToken, decryptToken } from '@/lib/qbo-encryption'

const QBO_CLIENT_ID = process.env.QBO_CLIENT_ID
const QBO_CLIENT_SECRET = process.env.QBO_CLIENT_SECRET

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Date filter - adjust as needed
const SYNC_START_DATE = '2023-01-01'

export async function POST(request: Request) {
  try {
    const { companyId, syncType } = await request.json()
    
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get QBO credentials (encrypted)
    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('qbo_realm_id, qbo_access_token, qbo_refresh_token, qbo_token_expires_at')
      .eq('company_id', companyId)
      .single()
    
    if (settingsError || !settings?.qbo_access_token) {
      return NextResponse.json({ error: 'QBO not connected' }, { status: 400 })
    }
    
    // Decrypt tokens
    let accessToken: string
    try {
      accessToken = decryptToken(settings.qbo_access_token)
    } catch (err) {
      console.error('Token decryption failed:', err)
      return NextResponse.json({ error: 'Token decryption failed' }, { status: 500 })
    }
    
    // Check if token needs refresh
    if (new Date(settings.qbo_token_expires_at) < new Date()) {
      const decryptedRefreshToken = decryptToken(settings.qbo_refresh_token)
      const refreshResult = await refreshToken(decryptedRefreshToken, companyId, supabase)
      if (!refreshResult.success) {
        return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 })
      }
      accessToken = refreshResult.accessToken!
    }
    
    const realmId = settings.qbo_realm_id
    const baseUrl = `https://quickbooks.api.intuit.com/v3/company/${realmId}`
    
    const results = {
      transactions: { added: 0, skipped: 0, errors: [] as string[] },
      invoices: { added: 0, skipped: 0, errors: [] as string[] }
    }
    
    // Sync bank transactions
    if (!syncType || syncType === 'transactions' || syncType === 'all') {
      const txResult = await syncBankTransactions(baseUrl, accessToken, companyId, supabase)
      results.transactions = txResult
    }
    
    // Sync invoices
    if (!syncType || syncType === 'invoices' || syncType === 'all') {
      const invResult = await syncInvoices(baseUrl, accessToken, companyId, supabase)
      results.invoices = invResult
    }
    
    return NextResponse.json({ 
      success: true, 
      results,
      message: `Synced ${results.transactions.added} transactions and ${results.invoices.added} invoices`
    })
    
  } catch (err) {
    console.error('QBO sync error:', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}

async function refreshToken(
  refreshToken: string, 
  companyId: string, 
  supabase: any
): Promise<{ success: boolean; accessToken?: string }> {
  try {
    const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    })
    
    if (!response.ok) {
      return { success: false }
    }
    
    const tokens = await response.json()
    
    // Encrypt new tokens before storage
    const encryptedAccessToken = encryptToken(tokens.access_token)
    const encryptedRefreshToken = encryptToken(tokens.refresh_token)
    
    // Update encrypted tokens in database
    await supabase
      .from('company_settings')
      .update({
        qbo_access_token: encryptedAccessToken,
        qbo_refresh_token: encryptedRefreshToken,
        qbo_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      })
      .eq('company_id', companyId)
    
    return { success: true, accessToken: tokens.access_token }
  } catch (err) {
    console.error('Token refresh error:', err)
    return { success: false }
  }
}

async function queryQBO(baseUrl: string, accessToken: string, query: string) {
  const encodedQuery = encodeURIComponent(query)
  const response = await fetch(`${baseUrl}/query?query=${encodedQuery}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error(`QBO query failed: ${query}`, errorText)
    return null
  }
  
  return response.json()
}

async function syncBankTransactions(
  baseUrl: string, 
  accessToken: string, 
  companyId: string, 
  supabase: any
) {
  let added = 0
  let skipped = 0
  const errors: string[] = []
  
  try {
    // 1. Query Purchases (expenses, checks, credit card charges)
    console.log('Querying Purchases...')
    const purchaseData = await queryQBO(baseUrl, accessToken, 
      `SELECT * FROM Purchase WHERE TxnDate >= '${SYNC_START_DATE}' MAXRESULTS 1000`)
    
    if (purchaseData?.QueryResponse?.Purchase) {
      const purchases = purchaseData.QueryResponse.Purchase
      console.log(`Found ${purchases.length} purchases`)
      
      for (const purchase of purchases) {
        const txData = {
          company_id: companyId,
          qbo_id: `purchase_${purchase.Id}`,
          date: purchase.TxnDate,
          description: purchase.PrivateNote || purchase.DocNumber || purchase.EntityRef?.name || 'Purchase',
          amount: -Math.abs(purchase.TotalAmt),
          type: 'expense',
          category: purchase.AccountRef?.name || 'Uncategorized',
          source: 'quickbooks'
        }
        
        const { error } = await supabase
          .from('transactions')
          .upsert(txData, { onConflict: 'company_id,qbo_id' })
        
        if (!error) added++
        else {
          skipped++
          errors.push(`Purchase ${purchase.Id}: ${error.message}`)
        }
      }
    }
    
    // 2. Query Deposits (bank deposits)
    console.log('Querying Deposits...')
    const depositData = await queryQBO(baseUrl, accessToken,
      `SELECT * FROM Deposit WHERE TxnDate >= '${SYNC_START_DATE}' MAXRESULTS 1000`)
    
    if (depositData?.QueryResponse?.Deposit) {
      const deposits = depositData.QueryResponse.Deposit
      console.log(`Found ${deposits.length} deposits`)
      
      for (const deposit of deposits) {
        const txData = {
          company_id: companyId,
          qbo_id: `deposit_${deposit.Id}`,
          date: deposit.TxnDate,
          description: deposit.PrivateNote || 'Deposit',
          amount: Math.abs(deposit.TotalAmt),
          type: 'income',
          category: 'Revenue',
          source: 'quickbooks'
        }
        
        const { error } = await supabase
          .from('transactions')
          .upsert(txData, { onConflict: 'company_id,qbo_id' })
        
        if (!error) added++
        else {
          skipped++
          errors.push(`Deposit ${deposit.Id}: ${error.message}`)
        }
      }
    }
    
    // 3. Query Sales Receipts (direct sales/payments received)
    console.log('Querying Sales Receipts...')
    const salesData = await queryQBO(baseUrl, accessToken,
      `SELECT * FROM SalesReceipt WHERE TxnDate >= '${SYNC_START_DATE}' MAXRESULTS 1000`)
    
    if (salesData?.QueryResponse?.SalesReceipt) {
      const receipts = salesData.QueryResponse.SalesReceipt
      console.log(`Found ${receipts.length} sales receipts`)
      
      for (const receipt of receipts) {
        const txData = {
          company_id: companyId,
          qbo_id: `salesreceipt_${receipt.Id}`,
          date: receipt.TxnDate,
          description: receipt.CustomerRef?.name || receipt.DocNumber || 'Sales Receipt',
          amount: Math.abs(receipt.TotalAmt),
          type: 'income',
          category: 'Revenue',
          source: 'quickbooks'
        }
        
        const { error } = await supabase
          .from('transactions')
          .upsert(txData, { onConflict: 'company_id,qbo_id' })
        
        if (!error) added++
        else {
          skipped++
          errors.push(`SalesReceipt ${receipt.Id}: ${error.message}`)
        }
      }
    }
    
    // 4. Query Payments (customer payments on invoices)
    console.log('Querying Payments...')
    const paymentData = await queryQBO(baseUrl, accessToken,
      `SELECT * FROM Payment WHERE TxnDate >= '${SYNC_START_DATE}' MAXRESULTS 1000`)
    
    if (paymentData?.QueryResponse?.Payment) {
      const payments = paymentData.QueryResponse.Payment
      console.log(`Found ${payments.length} payments`)
      
      for (const payment of payments) {
        const txData = {
          company_id: companyId,
          qbo_id: `payment_${payment.Id}`,
          date: payment.TxnDate,
          description: payment.CustomerRef?.name || 'Payment Received',
          amount: Math.abs(payment.TotalAmt),
          type: 'income',
          category: 'Revenue',
          source: 'quickbooks'
        }
        
        const { error } = await supabase
          .from('transactions')
          .upsert(txData, { onConflict: 'company_id,qbo_id' })
        
        if (!error) added++
        else {
          skipped++
          errors.push(`Payment ${payment.Id}: ${error.message}`)
        }
      }
    }
    
    // 5. Query Bills (accounts payable)
    console.log('Querying Bills...')
    const billData = await queryQBO(baseUrl, accessToken,
      `SELECT * FROM Bill WHERE TxnDate >= '${SYNC_START_DATE}' MAXRESULTS 1000`)
    
    if (billData?.QueryResponse?.Bill) {
      const bills = billData.QueryResponse.Bill
      console.log(`Found ${bills.length} bills`)
      
      for (const bill of bills) {
        const txData = {
          company_id: companyId,
          qbo_id: `bill_${bill.Id}`,
          date: bill.TxnDate,
          description: bill.VendorRef?.name || bill.DocNumber || 'Bill',
          amount: -Math.abs(bill.TotalAmt),
          type: 'expense',
          category: 'Accounts Payable',
          source: 'quickbooks'
        }
        
        const { error } = await supabase
          .from('transactions')
          .upsert(txData, { onConflict: 'company_id,qbo_id' })
        
        if (!error) added++
        else {
          skipped++
          errors.push(`Bill ${bill.Id}: ${error.message}`)
        }
      }
    }
    
    // 6. Query Bill Payments (payments made to vendors)
    console.log('Querying Bill Payments...')
    const billPaymentData = await queryQBO(baseUrl, accessToken,
      `SELECT * FROM BillPayment WHERE TxnDate >= '${SYNC_START_DATE}' MAXRESULTS 1000`)
    
    if (billPaymentData?.QueryResponse?.BillPayment) {
      const billPayments = billPaymentData.QueryResponse.BillPayment
      console.log(`Found ${billPayments.length} bill payments`)
      
      for (const bp of billPayments) {
        const txData = {
          company_id: companyId,
          qbo_id: `billpayment_${bp.Id}`,
          date: bp.TxnDate,
          description: bp.VendorRef?.name || 'Bill Payment',
          amount: -Math.abs(bp.TotalAmt),
          type: 'expense',
          category: 'Bill Payment',
          source: 'quickbooks'
        }
        
        const { error } = await supabase
          .from('transactions')
          .upsert(txData, { onConflict: 'company_id,qbo_id' })
        
        if (!error) added++
        else {
          skipped++
          errors.push(`BillPayment ${bp.Id}: ${error.message}`)
        }
      }
    }
    
    // 7. Query Expenses (direct expenses)
    console.log('Querying Expenses...')
    const expenseData = await queryQBO(baseUrl, accessToken,
      `SELECT * FROM Purchase WHERE PaymentType = 'Cash' AND TxnDate >= '${SYNC_START_DATE}' MAXRESULTS 1000`)
    
    // Note: Expenses in QBO are stored as Purchase with PaymentType
    // Already captured in Purchase query above
    
  } catch (err) {
    console.error('Sync transactions error:', err)
    errors.push(`General error: ${err}`)
  }
  
  console.log(`Transaction sync complete: ${added} added, ${skipped} skipped`)
  return { added, skipped, errors }
}

async function syncInvoices(
  baseUrl: string, 
  accessToken: string, 
  companyId: string, 
  supabase: any
) {
  let added = 0
  let skipped = 0
  const errors: string[] = []
  
  try {
    console.log('Querying Invoices...')
    const invoiceData = await queryQBO(baseUrl, accessToken,
      `SELECT * FROM Invoice WHERE TxnDate >= '${SYNC_START_DATE}' MAXRESULTS 1000`)
    
    if (invoiceData?.QueryResponse?.Invoice) {
      const invoices = invoiceData.QueryResponse.Invoice
      console.log(`Found ${invoices.length} invoices`)
      
      for (const invoice of invoices) {
        const invData = {
          company_id: companyId,
          qbo_id: invoice.Id,
          invoice_number: invoice.DocNumber,
          customer_name: invoice.CustomerRef?.name || 'Unknown',
          date: invoice.TxnDate,
          due_date: invoice.DueDate,
          amount: invoice.TotalAmt,
          balance: invoice.Balance,
          status: invoice.Balance === 0 ? 'paid' : (new Date(invoice.DueDate) < new Date() ? 'overdue' : 'pending'),
          source: 'quickbooks'
        }
        
        const { error } = await supabase
          .from('invoices')
          .upsert(invData, { onConflict: 'company_id,qbo_id' })
        
        if (!error) added++
        else {
          skipped++
          errors.push(`Invoice ${invoice.Id}: ${error.message}`)
        }
      }
    }
    
  } catch (err) {
    console.error('Sync invoices error:', err)
    errors.push(`General error: ${err}`)
  }
  
  console.log(`Invoice sync complete: ${added} added, ${skipped} skipped`)
  return { added, skipped, errors }
}
