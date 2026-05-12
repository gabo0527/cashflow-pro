// ============================================================
// CONTRACTOR AUTH: START LOGIN
// ============================================================
// Called by the contractor portal's "Sign In" button.
// 1. Receives the typed email
// 2. Confirms email exists in team_members and is active
// 3. Builds a Google OAuth URL with the email pre-filled
// 4. Redirects the browser to Google
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { lookupContractor, buildGoogleAuthUrl, signOAuthState } from '@/lib/contractor-auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const rawEmail = typeof body.email === 'string' ? body.email : ''
    const email = rawEmail.toLowerCase().trim()

    if (!email) {
      return NextResponse.json({ error: 'Please enter your email' }, { status: 400 })
    }

    // Confirm contractor exists and is active
    const contractor = await lookupContractor(email)
    if (!contractor) {
      return NextResponse.json(
        { error: 'Email not found. Contact your administrator.' },
        { status: 404 }
      )
    }

    // Determine the absolute redirect URI based on the request origin.
    // This makes the route work for both www.vantagefp.co and vantagefp.co.
    const origin = new URL(req.url).origin
    const redirectUri = `${origin}/api/contractor-auth/callback`

    // Sign a state token that Google will echo back. We verify it on
    // callback to (a) confirm the request came from us and (b) recover
    // the originally typed email.
    const state = await signOAuthState(email)

    const authUrl = buildGoogleAuthUrl({
      redirectUri,
      loginHint: email,
      state
    })

    return NextResponse.json({ url: authUrl })
  } catch (err) {
    console.error('contractor-auth/start error:', err)
    return NextResponse.json({ error: 'Login could not be started. Try again.' }, { status: 500 })
  }
}
