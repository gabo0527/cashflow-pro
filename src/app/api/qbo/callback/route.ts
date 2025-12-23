// Save as: src/app/api/qbo/callback/route.ts

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { encryptToken } from '@/lib/qbo-encryption'

const QBO_CLIENT_ID = process.env.QBO_CLIENT_ID
const QBO_CLIENT_SECRET = process.env.QBO_CLIENT_SECRET
const REDIRECT_URI = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}/api/qbo/callback`
  : 'https://cashflow-pro-jet.vercel.app/api/qbo/callback'

const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'https://cashflow-pro-jet.vercel.app'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const realmId = searchParams.get('realmId')
  const error = searchParams.get('error')
  
  // Handle user denial
  if (error) {
    return NextResponse.redirect(
      `${BASE_URL}/?tab=settings&qbo_error=${encodeURIComponent(error)}`
    )
  }
  
  if (!code || !state || !realmId) {
    return NextResponse.redirect(
      `${BASE_URL}/?tab=settings&qbo_error=missing_params`
    )
  }
  
  try {
    // Decode state to get companyId
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    const companyId = stateData.companyId
    
    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI
      })
    })
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Token exchange failed:', errorText)
      return NextResponse.redirect(
        `${BASE_URL}/?tab=settings&qbo_error=token_exchange_failed`
      )
    }
    
    const tokens = await tokenResponse.json()
    
    // ENCRYPT tokens before storage (Intuit security requirement)
    const encryptedAccessToken = encryptToken(tokens.access_token)
    const encryptedRefreshToken = encryptToken(tokens.refresh_token)
    
    // Store encrypted tokens in Supabase
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Check if settings exist for this company
    const { data: existing } = await supabase
      .from('company_settings')
      .select('id')
      .eq('company_id', companyId)
      .single()
    
    const qboData = {
      qbo_realm_id: realmId,
      qbo_access_token: encryptedAccessToken,
      qbo_refresh_token: encryptedRefreshToken,
      qbo_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      qbo_connected_at: new Date().toISOString()
    }
    
    if (existing) {
      await supabase
        .from('company_settings')
        .update(qboData)
        .eq('company_id', companyId)
    } else {
      await supabase
        .from('company_settings')
        .insert({
          company_id: companyId,
          ...qboData
        })
    }
    
    return NextResponse.redirect(
      `${BASE_URL}/?tab=settings&qbo_success=true`
    )
    
  } catch (err) {
    console.error('QBO callback error:', err)
    return NextResponse.redirect(
      `${BASE_URL}/?tab=settings&qbo_error=callback_failed`
    )
  }
}
