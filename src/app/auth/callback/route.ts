import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { isAdminEmail } from '@/lib/admin-allowlist'

// ============================================================
// AUTH CALLBACK
// ============================================================
// Google sends users here after they sign in to the main
// Vantage admin platform.
//
// Flow:
// 1. Exchange the OAuth code for a Supabase session
// 2. Check if the authenticated email is in the admin allowlist
// 3. If yes -> redirect to / (admin dashboard)
// 4. If no  -> sign them out, redirect to /contractor-portal
//
// This is the PRIMARY gate that blocks unauthorized logins.
// The middleware.ts file provides a secondary gate that
// catches any pre-existing sessions.
// ============================================================

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (!code) {
    // No code = no login. Send back to login page.
    return NextResponse.redirect(new URL('/login', requestUrl.origin))
  }

  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  // 1. Exchange the OAuth code for a session
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    console.error('OAuth exchange failed:', exchangeError)
    return NextResponse.redirect(new URL('/login?error=auth_failed', requestUrl.origin))
  }

  // 2. Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    // Should never happen, but just in case
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=no_email', requestUrl.origin))
  }

  // 3. Check admin allowlist
  if (!isAdminEmail(user.email)) {
    // Not an admin — sign them out and send to contractor portal
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/contractor-portal', requestUrl.origin))
  }

  // 4. Authorized admin — proceed to dashboard
  return NextResponse.redirect(new URL('/', requestUrl.origin))
}
