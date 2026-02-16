// Save as: src/lib/qbo-client.ts
// QBO API Client with automatic token refresh + paginated queries
// Uses existing @/lib/qbo-encryption (AES-256-GCM)

import { createClient } from '@supabase/supabase-js'
import { encryptToken, decryptToken } from '@/lib/qbo-encryption'

const QBO_CLIENT_ID = process.env.QBO_CLIENT_ID!
const QBO_CLIENT_SECRET = process.env.QBO_CLIENT_SECRET!
const QB_API_BASE = 'https://quickbooks.api.intuit.com/v3/company'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// ============ TOKEN REFRESH ============

async function refreshAccessToken(
  encryptedRefreshToken: string,
  companyId: string
): Promise<{ accessToken: string; success: boolean; error?: string }> {
  let refreshToken: string
  try {
    refreshToken = decryptToken(encryptedRefreshToken)
  } catch (err) {
    console.error('Failed to decrypt refresh token:', err)
    return { accessToken: '', success: false, error: 'Failed to decrypt refresh token' }
  }

  const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('QBO token refresh failed:', response.status, errText)
    return { accessToken: '', success: false, error: `Token refresh failed (${response.status})` }
  }

  const tokens = await response.json()

  // Re-encrypt and save new tokens to Supabase
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const { error: updateErr } = await supabase.from('company_settings').update({
    qbo_access_token: encryptToken(tokens.access_token),
    qbo_refresh_token: encryptToken(tokens.refresh_token),
    qbo_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  }).eq('company_id', companyId)

  if (updateErr) console.error('Failed to save refreshed tokens:', updateErr)
  else console.log(`QBO tokens auto-refreshed for company ${companyId}`)

  return { accessToken: tokens.access_token, success: true }
}

// ============ GET VALID ACCESS TOKEN (auto-refresh if expired) ============

export async function getQBOAccessToken(companyId: string): Promise<{
  accessToken: string; realmId: string; success: boolean; error?: string
}> {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: settings, error } = await supabase
    .from('company_settings')
    .select('qbo_realm_id, qbo_access_token, qbo_refresh_token, qbo_token_expires_at')
    .eq('company_id', companyId)
    .single()

  if (error || !settings?.qbo_access_token) {
    return { accessToken: '', realmId: '', success: false, error: 'QuickBooks not connected' }
  }
  if (!settings.qbo_realm_id) {
    return { accessToken: '', realmId: '', success: false, error: 'Missing QBO realm ID' }
  }

  // Check if token is still valid (5 min buffer)
  const expiresAt = new Date(settings.qbo_token_expires_at)
  const isExpired = expiresAt.getTime() - (5 * 60 * 1000) < Date.now()

  if (!isExpired) {
    try {
      return { accessToken: decryptToken(settings.qbo_access_token), realmId: settings.qbo_realm_id, success: true }
    } catch {
      // Decrypt failed — fall through to refresh
    }
  }

  // Auto-refresh
  console.log(`QBO token expired for ${companyId}, auto-refreshing...`)
  const result = await refreshAccessToken(settings.qbo_refresh_token, companyId)
  if (!result.success) return { accessToken: '', realmId: '', success: false, error: result.error }
  return { accessToken: result.accessToken, realmId: settings.qbo_realm_id, success: true }
}

// ============ QBO QUERY WITH FULL PAGINATION ============

export async function qboQuery(
  accessToken: string,
  realmId: string,
  baseQuery: string,
  entityName: string
): Promise<any[]> {
  const maxResults = 1000
  let startPosition = 1
  let allResults: any[] = []
  let hasMore = true

  while (hasMore) {
    const query = `${baseQuery} STARTPOSITION ${startPosition} MAXRESULTS ${maxResults}`
    const url = `${QB_API_BASE}/${realmId}/query?query=${encodeURIComponent(query)}`

    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' },
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(`QBO query failed for ${entityName} (${response.status}):`, errText)
      if (response.status === 401) throw new Error('QBO_TOKEN_EXPIRED')
      throw new Error(`QBO query failed (${response.status})`)
    }

    const data = await response.json()
    const items = data.QueryResponse?.[entityName] || []
    allResults.push(...items)
    console.log(`QBO: ${items.length} ${entityName} (total: ${allResults.length})`)

    hasMore = items.length >= maxResults
    startPosition += maxResults
  }

  return allResults
}
