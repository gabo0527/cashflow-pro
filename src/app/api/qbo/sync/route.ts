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
    
    // Sync invoices to accrual_transactions
    if (!syncType || syncType === 'invoices' || syncType === 'all') {
      const invResult = await syncInvoicesToAccrual(baseUrl, accessToken, companyId, supabase)
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
    
    // 3. Query Bills (accounts payable - expenses)
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
    
  } catch (err) {
    console.error('Sync transactions error:', err)
    errors.push(`General error: ${err}`)
  }
  
  console.log(`Transaction sync complete: ${added} added, ${skipped} skipped`)
  return { added, skipped, errors }
}

async function syncInvoicesToAccrual(
  baseUrl: string, 
  accessToken: string, 
  companyId: string, 
  supabase: any
) {
  let added = 0
  let skipped = 0
  const errors: string[] = []
  
  try {
    console.log('Querying Invoices for accrual_transactions...')
    const invoiceData = await queryQBO(baseUrl, accessToken,
      `SELECT * FROM Invoice WHERE TxnDate >= '${SYNC_START_DATE}' MAXRESULTS 1000`)
    
    if (invoiceData?.QueryResponse?.Invoice) {
      const invoices = invoiceData.QueryResponse.Invoice
      console.log(`Found ${invoices.length} invoices`)
      
      for (const invoice of invoices) {
        // Extract project from CustomerRef name or line items
        // Common pattern: "Customer Name - Project" or use Class if available
        const customerName = invoice.CustomerRef?.name || 'Unknown'
        
        // Try to extract project from customer name (if format is "Client - Project")
        let project = ''
        let description = customerName
        
        if (customerName.includes(' - ')) {
          const parts = customerName.split(' - ')
          description = parts[0].trim()
          project = parts.slice(1).join(' - ').trim()
        } else {
          // Use customer name as description, leave project for manual assignment
          description = customerName
          project = ''
        }
        
        // Determine type based on amount (positive = revenue)
        const type = invoice.TotalAmt >= 0 ? 'revenue' : 'direct_cost'
        
        const accrualData = {
          company_id: companyId,
          qbo_invoice_id: invoice.Id,
          date: invoice.TxnDate,
          type: type,
          description: description,
          amount: invoice.TotalAmt,
          project: project || null,
          invoice_number: invoice.DocNumber || null,
          notes: invoice.CustomerMemo?.value || null,
          source: 'quickbooks'
        }
        
        // Check if this invoice already exists
        const { data: existing } = await supabase
          .from('accrual_transactions')
          .select('id')
          .eq('company_id', companyId)
          .eq('qbo_invoice_id', invoice.Id)
          .single()
        
        if (existing) {
          // Update existing record
          const { error } = await supabase
            .from('accrual_transactions')
            .update(accrualData)
            .eq('id', existing.id)
          
          if (!error) added++
          else {
            skipped++
            errors.push(`Invoice ${invoice.Id} update: ${error.message}`)
          }
        } else {
          // Insert new record
          const { error } = await supabase
            .from('accrual_transactions')
            .insert(accrualData)
          
          if (!error) added++
          else {
            skipped++
            errors.push(`Invoice ${invoice.Id} insert: ${error.message}`)
          }
        }
      }
    }
    
  } catch (err) {
    console.error('Sync invoices to accrual error:', err)
    errors.push(`General error: ${err}`)
  }
  
  console.log(`Invoice sync to accrual complete: ${added} added, ${skipped} skipped`)
  return { added, skipped, errors }
}
