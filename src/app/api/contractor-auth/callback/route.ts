// ============================================================
// CONTRACTOR AUTH: GOOGLE CALLBACK
// ============================================================
// Google sends users here after they sign in.
// 1. Verify the state token matches what we issued
// 2. Exchange the code for the user's verified Google email
// 3. Confirm the verified email matches what they originally typed
// 4. Confirm contractor still exists in team_members and is active
// 5. Sign a session JWT and set it as an HTTP-only cookie
// 6. Redirect to /contractor-portal
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import {
  verifyGoogleCode,
  verifyOAuthState,
  lookupContractor,
  signSession,
  setSessionCookie
} from '@/lib/contractor-auth'

function redirectWithError(origin: string, message: string) {
  const url = new URL('/contractor-portal', origin)
  url.searchParams.set('auth_error', message)
  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin
  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const googleError = url.searchParams.get('error')

    if (googleError) {
      return redirectWithError(origin, 'Sign-in was cancelled.')
    }
    if (!code || !state) {
      return redirectWithError(origin, 'Invalid sign-in request.')
    }

    // 1. Verify state token (CSRF + recover original email)
    const stateData = await verifyOAuthState(state)
    if (!stateData) {
      return redirectWithError(origin, 'Sign-in session expired. Please try again.')
    }
    const expectedEmail = stateData.email

    // 2. Exchange code for verified Google email
    const redirectUri = `${origin}/api/contractor-auth/callback`
    const googleResult = await verifyGoogleCode(code, redirectUri)
    if (!googleResult) {
      return redirectWithError(origin, 'Could not verify Google account.')
    }

    // 3. Confirm verified email matches what was typed
    if (googleResult.email !== expectedEmail) {
      return redirectWithError(
        origin,
        `You signed in as ${googleResult.email} but entered ${expectedEmail}. Please sign in with the matching Google account.`
      )
    }

    // 4. Re-confirm contractor record is still active
    const contractor = await lookupContractor(googleResult.email)
    if (!contractor) {
      return redirectWithError(origin, 'Your account is no longer active. Contact your administrator.')
    }

    // 5. Sign session and set cookie
    const token = await signSession({
      contractorId: contractor.id,
      email: contractor.email,
      name: contractor.name
    })
    await setSessionCookie(token)

    // 6. Redirect to portal
    return NextResponse.redirect(new URL('/contractor-portal', origin))
  } catch (err) {
    console.error('contractor-auth/callback error:', err)
    return redirectWithError(origin, 'Sign-in failed. Please try again.')
  }
}
