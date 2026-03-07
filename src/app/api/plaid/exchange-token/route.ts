// src/app/api/plaid/exchange-token/route.ts
// Called after user completes Plaid Link — exchanges public token for access token
// Access token is encrypted with AES-256-GCM before storing in Supabase

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { exchangePublicToken, encryptToken, plaidClient } from '@/lib/plaid-client'

const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Maps Plaid account names/types to our internal account IDs
function mapAccount(account: any, institution: 'firstbank' | 'bofa'): {
  internalAccountId: string
  cardholder?: string
} {
  const name = (account.name || '').toLowerCase()
  const mask = account.mask || ''
  const type = account.type || ''
  const sub  = account.subtype || ''

  if (institution === 'firstbank') {
    return { internalAccountId: 'checking_7801' }
  }

  // BofA — map by last 4 digits
  if (mask === '3739') return { internalAccountId: 'bofa_cc_gabriel',  cardholder: 'gabriel' }
  if (mask === '0518') return { internalAccountId: 'bofa_cc_rodrigo',  cardholder: 'rodrigo' }
  if (mask === '5943') return { internalAccountId: 'bofa_cc_marcus',   cardholder: 'marcus'  }

  // Fallback — credit card without matching mask
  if (type === 'credit' || sub === 'credit card') {
    return { internalAccountId: 'bofa_cc_gabriel', cardholder: 'gabriel' }
  }

  return { internalAccountId: 'bofa_cc_gabriel' }
}

export async function POST(request: NextRequest) {
  try {
    const { companyId, publicToken, institution } = await request.json()

    if (!companyId)   return NextResponse.json({ error: 'companyId required' },   { status: 400 })
    if (!publicToken) return NextResponse.json({ error: 'publicToken required' },  { status: 400 })
    if (!institution) return NextResponse.json({ error: 'institution required' },  { status: 400 })

    // Exchange public token → access token
    const { accessToken, itemId } = await exchangePublicToken(publicToken)

    // Fetch accounts for this Item to build mapping
    const accountsRes = await plaidClient.accountsGet({ access_token: accessToken })
    const accounts    = accountsRes.data.accounts

    const accountMappings = accounts.map(a => ({
      plaidAccountId:    a.account_id,
      institution,
      ...mapAccount(a, institution as 'firstbank' | 'bofa'),
    }))

    // Encrypt access token
    const encryptedToken = encryptToken(accessToken)

    // Store in Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get existing mappings to merge
    const { data: existing } = await supabase
      .from('company_settings')
      .select('plaid_account_mappings')
      .eq('company_id', companyId)
      .single()

    const existingMappings: any[] = existing?.plaid_account_mappings || []
    // Remove old mappings for this institution, add new ones
    const mergedMappings = [
      ...existingMappings.filter((m: any) => m.institution !== institution),
      ...accountMappings,
    ]

    const updatePayload: any = {
      plaid_account_mappings: mergedMappings,
      plaid_connected:        true,
      updated_at:             new Date().toISOString(),
    }

    if (institution === 'firstbank') {
      updatePayload.plaid_token_firstbank_enc = encryptedToken
      updatePayload.plaid_item_firstbank      = itemId
    } else {
      updatePayload.plaid_token_bofa_enc = encryptedToken
      updatePayload.plaid_item_bofa      = itemId
    }

    const { error } = await supabase
      .from('company_settings')
      .update(updatePayload)
      .eq('company_id', companyId)

    if (error) {
      console.error('Supabase update error:', error)
      return NextResponse.json({ error: 'Failed to save token' }, { status: 500 })
    }

    return NextResponse.json({
      success:      true,
      institution,
      accountCount: accounts.length,
      accounts:     accountMappings.map(m => ({
        internalAccountId: m.internalAccountId,
        cardholder:        m.cardholder,
      })),
    })

  } catch (err: any) {
    console.error('Plaid exchange-token error:', err)
    return NextResponse.json({ error: err.message || 'Token exchange failed' }, { status: 500 })
  }
}
