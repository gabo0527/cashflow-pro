import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { isAdminEmail, ADMIN_EMAILS } from '@/lib/admin-allowlist'

// ============================================================
// AUTH CALLBACK — WITH DIAGNOSTIC LOGGING
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
// TEMPORARY: Console.log statements added to debug why
// non-admin users are getting through. Remove after fixed.
// ============================================================

export async function GET(request: Request) {
  console.log('[AUTH CALLBACK] === Request started ===')
  
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  console.log('[AUTH CALLBACK] Request URL:', requestUrl.toString())
  console.log('[AUTH CALLBACK] Origin:', requestUrl.origin)
  console.log('[AUTH CALLBACK] Code present:', !!code)

  if (!code) {
    console.log('[AUTH CALLBACK] No code, redirecting to /login')
    return NextResponse.redirect(new URL('/login', requestUrl.origin))
  }

  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  // 1. Exchange the OAuth code for a session
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    console.error('[AUTH CALLBACK] OAuth exchange failed:', exchangeError)
    return NextResponse.redirect(new URL('/login?error=auth_failed', requestUrl.origin))
  }

  console.log('[AUTH CALLBACK] OAuth exchange successful')

  // 2. Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  console.log('[AUTH CALLBACK] User email from Supabase:', user?.email)
  console.log('[AUTH CALLBACK] User ID:', user?.id)
  console.log('[AUTH CALLBACK] ADMIN_EMAILS list:', JSON.stringify(ADMIN_EMAILS))

  if (!user?.email) {
    console.log('[AUTH CALLBACK] No email found, signing out and redirecting')
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=no_email', requestUrl.origin))
  }

  // 3. Check admin allowlist
  const isAdmin = isAdminEmail(user.email)
  console.log('[AUTH CALLBACK] isAdminEmail result:', isAdmin, 'for email:', user.email)

  if (!isAdmin) {
    console.log('[AUTH CALLBACK] NOT AN ADMIN - signing out and redirecting to /contractor-portal')
    await supabase.auth.signOut()
    const redirectUrl = new URL('/contractor-portal', requestUrl.origin)
    console.log('[AUTH CALLBACK] Redirect URL:', redirectUrl.toString())
    return NextResponse.redirect(redirectUrl)
  }

  // 4. Authorized admin — proceed to dashboard
  console.log('[AUTH CALLBACK] IS ADMIN - redirecting to /')
  return NextResponse.redirect(new URL('/', requestUrl.origin))
}
