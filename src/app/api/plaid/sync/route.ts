// src/app/api/plaid/sync/route.ts
// Pulls transactions from Plaid for all connected institutions
// Maps Plaid account IDs → internal account IDs + cardholders

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getPlaidTokens, fetchTransactions, PlaidAccountMapping } from '@/lib/plaid-client'

const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const START_DATE = '2026-01-01'

function getDateRange(daysBack?: number): { startDate: string; endDate: string } {
  const end   = new Date()
  const start = daysBack
    ? new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000)
    : new Date(START_DATE)

  return {
    startDate: start.toISOString().split('T')[0],
    endDate:   end.toISOString().split('T')[0],
  }
}

async function syncInstitution(
  accessToken: string,
  institution: 'firstbank' | 'bofa',
  companyId: string,
  supabase: any,
  accountMappings: PlaidAccountMapping[],
  startDate: string,
  endDate: string
) {
  const transactions = await fetchTransactions(accessToken, startDate, endDate)
  console.log(`Plaid ${institution}: ${transactions.length} transactions`)

  let synced = 0, skipped = 0, errors = 0

  for (const txn of transactions) {
    try {
      // Skip pending transactions — wait for them to settle
      if (txn.pending) { skipped++; continue }

      // Find account mapping for this Plaid account
      const mapping = accountMappings.find(
        m => m.plaidAccountId === txn.plaid_account_id && m.institution === institution
      )

      const internalAccountId = mapping?.internalAccountId || (
        institution === 'firstbank' ? 'checking_7801' : 'bofa_cc_gabriel'
      )
      const cardholder = mapping?.cardholder || null

      const { error } = await supabase.from('transactions').upsert({
        company_id:           companyId,
        plaid_transaction_id: txn.plaid_transaction_id,
        date:                 txn.date,
        description:          txn.description,
        amount:               txn.amount,
        payee:                txn.payee,
        account_id:           internalAccountId,
        cardholder:           cardholder,
        type:                 txn.amount >= 0 ? 'income' : 'expense',
        sync_source:          'plaid',
        is_categorized:       false,
        synced_at:            new Date().toISOString(),
      }, {
        onConflict:       'company_id,plaid_transaction_id',
        ignoreDuplicates: false,  // Update if amount/description changed
      })

      if (error) {
        console.error(`Txn upsert error ${txn.plaid_transaction_id}:`, error.message)
        errors++
      } else {
        synced++
      }
    } catch (e: any) {
      console.error('Transaction parse error:', e.message)
      errors++
    }
  }

  return { institution, synced, skipped, errors, total: transactions.length }
}

export async function POST(request: NextRequest) {
  try {
    const { companyId, daysBack, institution: specificInstitution } = await request.json()
    if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })

    const tokens = await getPlaidTokens(companyId)
    if (!tokens) return NextResponse.json({ error: 'No Plaid tokens found' }, { status: 404 })

    const { startDate, endDate } = getDateRange(daysBack)
    const supabase               = createClient(supabaseUrl, supabaseServiceKey)
    const accountMappings        = tokens.accountMappings || []
    const results                = []

    // Sync First Bank PR
    if (tokens.firstbank && (!specificInstitution || specificInstitution === 'firstbank')) {
      const result = await syncInstitution(
        tokens.firstbank, 'firstbank', companyId, supabase, accountMappings, startDate, endDate
      )
      results.push(result)
    }

    // Sync Bank of America
    if (tokens.bofa && (!specificInstitution || specificInstitution === 'bofa')) {
      const result = await syncInstitution(
        tokens.bofa, 'bofa', companyId, supabase, accountMappings, startDate, endDate
      )
      results.push(result)
    }

    if (results.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No connected institutions found. Connect via Plaid Link first.',
        connected: { firstbank: !!tokens.firstbank, bofa: !!tokens.bofa },
      })
    }

    // Update last sync timestamp
    await supabase
      .from('company_settings')
      .update({ plaid_last_sync: new Date().toISOString() })
      .eq('company_id', companyId)

    const totalSynced = results.reduce((s, r) => s + r.synced, 0)
    const totalErrors = results.reduce((s, r) => s + r.errors, 0)

    return NextResponse.json({
      success: true,
      synced:  totalSynced,
      errors:  totalErrors,
      range:   { startDate, endDate },
      results,
    })

  } catch (err: any) {
    console.error('Plaid sync error:', err)
    return NextResponse.json({ error: err.message || 'Sync failed' }, { status: 500 })
  }
}

// GET — sync status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId')
  if (!companyId) return NextResponse.json({ error: 'companyId required' }, { status: 400 })

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { data } = await supabase
    .from('company_settings')
    .select('plaid_connected, plaid_last_sync, plaid_item_firstbank, plaid_item_bofa')
    .eq('company_id', companyId)
    .single()

  const { count: txnCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('sync_source', 'plaid')

  return NextResponse.json({
    connected:       !!data?.plaid_connected,
    lastSync:        data?.plaid_last_sync || null,
    institutions: {
      firstbank: !!data?.plaid_item_firstbank,
      bofa:      !!data?.plaid_item_bofa,
    },
    transactionCount: txnCount || 0,
  })
}
