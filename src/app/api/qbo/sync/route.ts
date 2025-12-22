// Save as: src/app/api/qbo/sync/route.ts

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    
    // Get QBO credentials
    const { data: settings, error: settingsError } = await supabase
      .from('company_settings')
      .select('qbo_realm_id, qbo_access_token, qbo_refresh_token, qbo_token_expires_at')
      .eq('company_id', companyId)
      .single()
    
    if (settingsError || !settings?.qbo_access_token) {
      return NextResponse.json({ error: 'QBO not connected' }, { status: 400 })
    }
    
    // Check if token needs refresh
    let accessToken = settings.qbo_access_token
    if (new Date(settings.qbo_token_expires_at) < new Date()) {
      const refreshResult = await refreshToken(settings.qbo_refresh_token, companyId, supabase)
      if (!refreshResult.success) {
        return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 })
      }
      accessToken = refreshResult.accessToken
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

async function refreshToken(refreshToken: string, companyId: string, supabase: any) {
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
    
    // Update tokens in database
    await supabase
      .from('company_settings')
      .update({
        qbo_access_token: tokens.access_token,
        qbo_refresh_token: tokens.refresh_token,
        qbo_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      })
      .eq('company_id', companyId)
    
    return { success: true, accessToken: tokens.access_token }
  } catch (err) {
    console.error('Token refresh error:', err)
    return { success: false }
  }
}

async function syncBankTransactions(baseUrl: string, accessToken: string, companyId: string, supabase: any) {
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
      const purchaseData = await purchaseResponse.json()
      const purchases = purchaseData.QueryResponse?.Purchase || []
      
      for (const purchase of purchases) {
        const result = await insertTransaction(supabase, companyId, {
          qbo_transaction_id: purchase.Id,
          date: purchase.TxnDate,
          description: purchase.PrivateNote || purchase.DocNumber || `QBO Purchase ${purchase.Id}`,
          amount: -Math.abs(purchase.TotalAmt), // Expenses are negative
          type: 'actual',
          source: 'qbo'
        })
        if (result.added) added++
        else skipped++
      }
    }
    
    // Query deposits (income)
    const depositQuery = encodeURIComponent("SELECT * FROM Deposit WHERE TxnDate > '2024-01-01' MAXRESULTS 500")
    const depositResponse = await fetch(`${baseUrl}/query?query=${depositQuery}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })
    
    if (depositResponse.ok) {
      const depositData = await depositResponse.json()
      const deposits = depositData.QueryResponse?.Deposit || []
      
      for (const deposit of deposits) {
        const result = await insertTransaction(supabase, companyId, {
          qbo_transaction_id: `DEP-${deposit.Id}`,
          date: deposit.TxnDate,
          description: deposit.PrivateNote || `QBO Deposit ${deposit.Id}`,
          amount: Math.abs(deposit.TotalAmt), // Deposits are positive
          type: 'actual',
          source: 'qbo'
        })
        if (result.added) added++
        else skipped++
      }
    }
    
  } catch (err) {
    console.error('Error syncing bank transactions:', err)
  }
  
  return { added, skipped }
}

async function syncInvoices(baseUrl: string, accessToken: string, companyId: string, supabase: any) {
  let added = 0
  let skipped = 0
  
  try {
    // Query invoices
    const invoiceQuery = encodeURIComponent("SELECT * FROM Invoice WHERE TxnDate > '2024-01-01' MAXRESULTS 500")
    const invoiceResponse = await fetch(`${baseUrl}/query?query=${invoiceQuery}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })
    
    if (invoiceResponse.ok) {
      const invoiceData = await invoiceResponse.json()
      const invoices = invoiceData.QueryResponse?.Invoice || []
      
      // Get customer names for mapping
      const customerMap = new Map()
      const customerQuery = encodeURIComponent("SELECT * FROM Customer MAXRESULTS 500")
      const customerResponse = await fetch(`${baseUrl}/query?query=${customerQuery}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      })
      
      if (customerResponse.ok) {
        const customerData = await customerResponse.json()
        const customers = customerData.QueryResponse?.Customer || []
        customers.forEach((c: any) => customerMap.set(c.Id, c.DisplayName))
      }
      
      for (const invoice of invoices) {
        const customerName = customerMap.get(invoice.CustomerRef?.value) || 'Unknown Customer'
        
        const result = await insertAccrualTransaction(supabase, companyId, {
          qbo_invoice_id: invoice.Id,
          date: invoice.TxnDate,
          due_date: invoice.DueDate,
          description: `Invoice #${invoice.DocNumber || invoice.Id} - ${customerName}`,
          amount: Math.abs(invoice.TotalAmt),
          type: 'revenue',
          client: customerName,
          invoice_number: invoice.DocNumber || invoice.Id,
          status: invoice.Balance > 0 ? 'pending' : 'paid',
          source: 'qbo'
        })
        if (result.added) added++
        else skipped++
      }
    }
    
  } catch (err) {
    console.error('Error syncing invoices:', err)
  }
  
  return { added, skipped }
}

async function insertTransaction(supabase: any, companyId: string, tx: any) {
  // Check for duplicate using date + amount (± 1 day, ± $0.01)
  const txDate = new Date(tx.date)
  const dayBefore = new Date(txDate)
  dayBefore.setDate(dayBefore.getDate() - 1)
  const dayAfter = new Date(txDate)
  dayAfter.setDate(dayAfter.getDate() + 1)
  
  // First check by QBO ID if exists
  if (tx.qbo_transaction_id) {
    const { data: existingQbo } = await supabase
      .from('transactions')
      .select('id')
      .eq('company_id', companyId)
      .eq('qbo_transaction_id', tx.qbo_transaction_id)
      .single()
    
    if (existingQbo) {
      return { added: false }
    }
  }
  
  // Then check by date + amount
  const { data: existingMatch } = await supabase
    .from('transactions')
    .select('id')
    .eq('company_id', companyId)
    .gte('date', dayBefore.toISOString().split('T')[0])
    .lte('date', dayAfter.toISOString().split('T')[0])
    .gte('amount', tx.amount - 0.01)
    .lte('amount', tx.amount + 0.01)
    .limit(1)
  
  if (existingMatch && existingMatch.length > 0) {
    return { added: false }
  }
  
  // Insert new transaction
  const { error } = await supabase
    .from('transactions')
    .insert({
      company_id: companyId,
      qbo_transaction_id: tx.qbo_transaction_id,
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
      source: tx.source || 'qbo',
      category: null,
      project: null
    })
  
  return { added: !error }
}

async function insertAccrualTransaction(supabase: any, companyId: string, tx: any) {
  // Check for duplicate by QBO invoice ID
  if (tx.qbo_invoice_id) {
    const { data: existingQbo } = await supabase
      .from('accrual_transactions')
      .select('id')
      .eq('company_id', companyId)
      .eq('qbo_invoice_id', tx.qbo_invoice_id)
      .single()
    
    if (existingQbo) {
      return { added: false }
    }
  }
  
  // Check by invoice number + client
  if (tx.invoice_number && tx.client) {
    const { data: existingMatch } = await supabase
      .from('accrual_transactions')
      .select('id')
      .eq('company_id', companyId)
      .ilike('description', `%${tx.invoice_number}%`)
      .ilike('client', `%${tx.client}%`)
      .limit(1)
    
    if (existingMatch && existingMatch.length > 0) {
      return { added: false }
    }
  }
  
  // Insert new invoice
  const { error } = await supabase
    .from('accrual_transactions')
    .insert({
      company_id: companyId,
      qbo_invoice_id: tx.qbo_invoice_id,
      date: tx.date,
      due_date: tx.due_date,
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
      client: tx.client,
      status: tx.status,
      source: tx.source || 'qbo',
      project: null
    })
  
  return { added: !error }
}
