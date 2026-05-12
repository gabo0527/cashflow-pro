// ============================================================
// CONTRACTOR PORTAL AUTHENTICATION HELPERS
// ============================================================
// This file contains the foundation functions used by the
// contractor portal authentication API routes. None of these
// functions are called from the browser — they only run on
// the server (Vercel serverless functions).
//
// Key concepts:
// - Google OAuth: We send users to Google to log in, Google
//   sends them back with a code, we exchange the code for the
//   user's verified email.
// - JWT: After verifying the user, we create a signed token
//   (JWT) and store it in a cookie. The cookie proves the user
//   is logged in. The signature prevents tampering.
// - Supabase Service Role: We use the admin Supabase key
//   server-side to look up team_members, bypassing RLS.
// ============================================================

import { SignJWT, jwtVerify } from 'jose'
import { OAuth2Client } from 'google-auth-library'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// ============================================================
// CONSTANTS
// ============================================================

const COOKIE_NAME = 'contractor_session'
const COOKIE_PATH = '/contractor-portal'
const SESSION_DURATION_HOURS = 8

// ============================================================
// ENVIRONMENT VARIABLES (read once, fail loudly if missing)
// ============================================================

function getEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

// ============================================================
// SUPABASE ADMIN CLIENT (server-side only, bypasses RLS)
// ============================================================

export function getSupabaseAdmin() {
  // Allow either NEXT_PUBLIC_SUPABASE_URL env var or the hardcoded project URL
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmahfgpbtjeomuepfozf.supabase.co'
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

// ============================================================
// GOOGLE OAUTH HELPERS
// ============================================================

export function getGoogleOAuthClient(redirectUri: string) {
  return new OAuth2Client({
    clientId: getEnv('GOOGLE_OAUTH_CLIENT_ID'),
    clientSecret: getEnv('GOOGLE_OAUTH_CLIENT_SECRET'),
    redirectUri
  })
}

// Build the URL we redirect users to so they can sign in with Google
export function buildGoogleAuthUrl(opts: {
  redirectUri: string
  loginHint: string
  state: string
}) {
  const client = getGoogleOAuthClient(opts.redirectUri)
  return client.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    login_hint: opts.loginHint,
    prompt: 'select_account',
    state: opts.state
  })
}

// Exchange the code Google sends back for the user's verified email
export async function verifyGoogleCode(code: string, redirectUri: string): Promise<{ email: string } | null> {
  try {
    const client = getGoogleOAuthClient(redirectUri)
    const { tokens } = await client.getToken(code)
    if (!tokens.id_token) return null

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: getEnv('GOOGLE_OAUTH_CLIENT_ID')
    })
    const payload = ticket.getPayload()
    if (!payload?.email || !payload.email_verified) return null
    return { email: payload.email.toLowerCase().trim() }
  } catch (err) {
    console.error('verifyGoogleCode error:', err)
    return null
  }
}

// ============================================================
// JWT SESSION HELPERS
// ============================================================

export interface ContractorSession {
  contractorId: string
  email: string
  name: string
}

function getJwtSecretBytes(): Uint8Array {
  return new TextEncoder().encode(getEnv('JWT_SECRET'))
}

export async function signSession(payload: ContractorSession): Promise<string> {
  return await new SignJWT({
    contractorId: payload.contractorId,
    email: payload.email,
    name: payload.name
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_HOURS}h`)
    .sign(getJwtSecretBytes())
}

export async function verifySession(token: string): Promise<ContractorSession | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretBytes())
    if (
      typeof payload.contractorId === 'string' &&
      typeof payload.email === 'string' &&
      typeof payload.name === 'string'
    ) {
      return {
        contractorId: payload.contractorId,
        email: payload.email,
        name: payload.name
      }
    }
    return null
  } catch {
    return null
  }
}

// ============================================================
// COOKIE HELPERS (server-side)
// ============================================================

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: COOKIE_PATH,
    maxAge: SESSION_DURATION_HOURS * 60 * 60
  })
}

export async function clearSessionCookie() {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: COOKIE_PATH,
    maxAge: 0
  })
}

export async function readSessionFromCookie(): Promise<ContractorSession | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return await verifySession(token)
}

// ============================================================
// CONTRACTOR LOOKUP (used by login + callback)
// ============================================================

export interface ContractorRecord {
  id: string
  name: string
  email: string
  status: string
}

export async function lookupContractor(email: string): Promise<ContractorRecord | null> {
  const normalized = email.toLowerCase().trim()
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('team_members')
    .select('id, name, email, status')
    .eq('email', normalized)
    .eq('status', 'active')
    .single()
  if (error || !data) return null
  return data as ContractorRecord
}

// ============================================================
// STATE TOKEN (CSRF protection for OAuth flow)
// ============================================================
// We sign a short-lived JWT that carries the email the user
// typed. Google echoes this back in the `state` parameter.
// On callback we verify the state matches and pull out the
// original email so we can confirm Google returned the same one.

export async function signOAuthState(email: string): Promise<string> {
  return await new SignJWT({ email: email.toLowerCase().trim(), kind: 'oauth_state' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(getJwtSecretBytes())
}

export async function verifyOAuthState(state: string): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(state, getJwtSecretBytes())
    if (payload.kind !== 'oauth_state' || typeof payload.email !== 'string') return null
    return { email: payload.email }
  } catch {
    return null
  }
}
