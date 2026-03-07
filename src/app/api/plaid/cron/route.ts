// src/app/api/plaid/cron/route.ts
// Hourly auto-sync via Supabase pg_cron
// Protected by CRON_SECRET
//
// pg_cron job (run in Supabase SQL editor):
// SELECT cron.schedule(
//   'plaid-hourly-sync',
//   '0 * * * *',
//   $$
//   SELECT net.http_post(
//     url := 'https://vantagefp.co/api/plaid/cron',
//     headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_CRON_SECRET"}'::jsonb,
//     body := '{}'::jsonb
//   )
//   $$
// );

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getPlaidTokens, fetchTransactions, PlaidAccountMapping } from '@/lib/plaid-client'

const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const CRON_SECRET        = process.env.CRON_SECRET!

// Incremental — only pull last 2 days on cron (fast, catches all settlements)
const CRON_DAYS_BACK = 2

function getDateRange() {
  const end   = new Date()
  const start = new Date(Date.now() - CRON_DAYS_BACK * 24 * 60 * 60 * 1000)
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
  let synced = 0, errors = 0

  for (const txn of transactions) {
    try {
      if (txn.pending) continue

      const mapping = accountMappings.find(
        m => m.plaidAccountId === txn.plaid_account_id && m.institution === institution
      )
      const internalAccountId = mapping?.internalAccountId || (
        institution === 'firstbank' ? 'checking_7801' : 'bofa_cc_gabriel'
      )

      const { error } = await supabase.from('transactions').upsert({
        company_id:           companyId,
        plaid_transaction_id: txn.plaid_transaction_id,
        date:                 txn.date,
        description:          txn.description,
        amount:               txn.amount,
        payee:                txn.payee,
        account_id:           internalAccountId,
        cardholder:           mapping?.cardholder || null,
        type:                 txn.amount >= 0 ? 'income' : 'expense',
        sync_source:          'plaid',
        synced_at:            new Date().toISOString(),
      }, { onConflict: 'company_id,plaid_transaction_id', ignoreDuplicates: false })

      if (error) errors++
      else synced++
    } catch (_e) { errors++ }
  }

  return { institution, synced, errors, total: transactions.length }
}

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase   = createClient(supabaseUrl, supabaseServiceKey)
  const startedAt  = new Date().toISOString()
  const { startDate, endDate } = getDateRange()

  // Get all companies with Plaid connected
  const { data: companies } = await supabase
    .from('company_settings')
    .select('company_id')
    .eq('plaid_connected', true)

  if (!companies?.length) {
    return NextResponse.json({ message: 'No Plaid-connected companies', synced: 0 })
  }

  const allResults = []

  for (const { company_id } of companies) {
    try {
      const tokens = await getPlaidTokens(company_id)
      if (!tokens) continue

      const accountMappings = tokens.accountMappings || []
      const companyResults  = []

      if (tokens.firstbank) {
        const r = await syncInstitution(tokens.firstbank, 'firstbank', company_id, supabase, accountMappings, startDate, endDate)
        companyResults.push(r)
      }

      if (tokens.bofa) {
        const r = await syncInstitution(tokens.bofa, 'bofa', company_id, supabase, accountMappings, startDate, endDate)
        companyResults.push(r)
      }

      const totalSynced = companyResults.reduce((s, r) => s + r.synced, 0)
      const totalErrors = companyResults.reduce((s, r) => s + r.errors, 0)

      // Update last sync
      await supabase
        .from('company_settings')
        .update({ plaid_last_sync: new Date().toISOString() })
        .eq('company_id', company_id)

      // Write to sync_log — optional, ignore errors
      try {
        await supabase.from('sync_log').insert({
          company_id,
          source:         'plaid_cron',
          started_at:     startedAt,
          completed_at:   new Date().toISOString(),
          records_synced: totalSynced,
          records_total:  companyResults.reduce((s, r) => s + r.total, 0),
          status:         totalErrors > 0 ? 'partial' : 'success',
          error_message:  totalErrors > 0 ? `${totalErrors} errors` : null,
        })
      } catch (_e) {}

      allResults.push({ company_id, success: true, results: companyResults })

    } catch (err: any) {
      console.error(`Plaid cron error for ${company_id}:`, err.message)
      allResults.push({ company_id, success: false, error: err.message })
    }
  }

  return NextResponse.json({
    success:             true,
    ran_at:              startedAt,
    companies_processed: allResults.length,
    results:             allResults,
  })
}
