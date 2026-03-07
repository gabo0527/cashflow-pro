// src/app/api/plaid/link-token/route.ts
// Creates a Plaid Link token — browser uses this to open Plaid's hosted UI

import { NextRequest, NextResponse } from 'next/server'
import { createLinkToken } from '@/lib/plaid-client'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl        = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { companyId, institution } = await request.json()

    if (!companyId)   return NextResponse.json({ error: 'companyId required' }, { status: 400 })
    if (!institution) return NextResponse.json({ error: 'institution required (firstbank|bofa)' }, { status: 400 })

    // Verify company exists
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: settings } = await supabase
      .from('company_settings')
      .select('company_id')
      .eq('company_id', companyId)
      .single()

    if (!settings) return NextResponse.json({ error: 'Company not found' }, { status: 404 })

    const linkToken = await createLinkToken(companyId, institution)
    return NextResponse.json({ link_token: linkToken, institution })

  } catch (err: any) {
    console.error('Plaid link-token error:', err)
    return NextResponse.json({ error: err.message || 'Failed to create link token' }, { status: 500 })
  }
}
