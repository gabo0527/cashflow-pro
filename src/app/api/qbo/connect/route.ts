// Save as: src/app/api/qbo/connect/route.ts

import { NextResponse } from 'next/server'

const QBO_CLIENT_ID = process.env.QBO_CLIENT_ID
const REDIRECT_URI = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}/api/qbo/callback`
  : 'https://cashflow-pro-jet.vercel.app/api/qbo/callback'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const companyId = searchParams.get('companyId')
  
  if (!QBO_CLIENT_ID) {
    return NextResponse.json({ error: 'QBO_CLIENT_ID not configured' }, { status: 500 })
  }
  
  if (!companyId) {
    return NextResponse.json({ error: 'companyId is required' }, { status: 400 })
  }
  
  // Build Intuit OAuth URL
  const scopes = [
    'com.intuit.quickbooks.accounting'
  ].join(' ')
  
  // State parameter to pass companyId through OAuth flow
  const state = Buffer.from(JSON.stringify({ companyId })).toString('base64')
  
  const authUrl = new URL('https://appcenter.intuit.com/connect/oauth2')
  authUrl.searchParams.set('client_id', QBO_CLIENT_ID)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', scopes)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('state', state)
  
  return NextResponse.redirect(authUrl.toString())
}
