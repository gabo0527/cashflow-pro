// Save as: src/app/api/qbo/sync/route.ts

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { encryptToken, decryptToken } from '@/lib/qbo-encryption'

const QBO_CLIENT_ID = process.env.QBO_CLIENT_ID
const QBO_CLIENT_SECRET = process.env.QBO_CLIENT_SECRET

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

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
      transactions: { added: 0, skipped: 0 },
      invoices: { added: 0, skipped: 0 }
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

async function syncBankTransactions(
  baseUrl: string, 
  accessToken: string, 
  companyId: string, 
  supabase: any
) {
  let added = 0
  let skipped = 0
  
  try {
    // Query purchases (expenses/payments)
    const purchaseQuery = encodeURIComponent("SELECT * FROM Purchase WHERE TxnDate > '2024-01-01' MAXRESULTS 500")
    const purchaseResponse = await fetch(`${baseUrl}/query?query=${purchaseQuery}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })
    
    if (purchaseResponse.ok) {
      const data = await purchaseResponse.json()
      const purchases = data.QueryResponse?.Purchase || []
      
      for (const purchase of purchases) {
        const txData = {
          company_id: companyId,
          qbo_id: purchase.Id,
          date: purchase.TxnDate,
          description: purchase.PrivateNote || purchase.DocNumber || 'Purchase',
          amount: -Math.abs(purchase.TotalAmt), // Expenses are negative
          type: 'expense',
          category: purchase.AccountRef?.name || 'Uncategorized',
          source: 'quickbooks'
        }
        
        // Upsert (insert or update if exists)
        const { error } = await supabase
          .from('transactions')
          .upsert(txData, { onConflict: 'company_id,qbo_id' })
        
        if (!error) {
          added++
        } else {
          skipped++
        }
      }
    }
    
    // Query deposits/sales receipts (income)
    const depositQuery = encodeURIComponent("SELECT * FROM Deposit WHERE TxnDate > '2024-01-01' MAXRESULTS 500")
    const depositResponse = await fetch(`${baseUrl}/query?query=${depositQuery}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })
    
    if (depositResponse.ok) {
      const data = await depositResponse.json()
      const deposits = data.QueryResponse?.Deposit || []
      
      for (const deposit of deposits) {
        const txData = {
          company_id: companyId,
          qbo_id: deposit.Id,
          date: deposit.TxnDate,
          description: deposit.PrivateNote || 'Deposit',
          amount: Math.abs(deposit.TotalAmt), // Income is positive
          type: 'income',
          category: 'Revenue',
          source: 'quickbooks'
        }
        
        const { error } = await supabase
          .from('transactions')
          .upsert(txData, { onConflict: 'company_id,qbo_id' })
        
        if (!error) {
          added++
        } else {
          skipped++
        }
      }
    }
    
  } catch (err) {
    console.error('Sync transactions error:', err)
  }
  
  return { added, skipped }
}

async function syncInvoices(
  baseUrl: string, 
  accessToken: string, 
  companyId: string, 
  supabase: any
) {
  let added = 0
  let skipped = 0
  
  try {
    const invoiceQuery = encodeURIComponent("SELECT * FROM Invoice WHERE TxnDate > '2024-01-01' MAXRESULTS 500")
    const response = await fetch(`${baseUrl}/query?query=${invoiceQuery}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })
    
    if (response.ok) {
      const data = await response.json()
      const invoices = data.QueryResponse?.Invoice || []
      
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
        
        if (!error) {
          added++
        } else {
          skipped++
        }
      }
    }
    
  } catch (err) {
    console.error('Sync invoices error:', err)
  }
  
  return { added, skipped }
}
