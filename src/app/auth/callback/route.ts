import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { isAdminEmail } from '@/lib/admin-allowlist'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  // Keep a provider rejection visible after returning to login. Do not forward
  // raw provider descriptions, authorization codes, or tokens into logs.
  if (url.searchParams.has('error') || url.searchParams.has('error_code')) {
    const blocked = url.searchParams.get('error_code') === 'user_banned' ||
      /\b(banned|disabled)\b/i.test(url.searchParams.get('error_description') || '')
    return NextResponse.redirect(new URL(`/login?error=${blocked ? 'account_disabled' : 'auth_failed'}`, url.origin))
  }
  if (!code) return NextResponse.redirect(new URL('/login', url.origin))

  const cookieStore = cookies()
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(new URL('/login?error=auth_failed', url.origin))

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/login?error=no_email', url.origin))
  }
  if (!isAdminEmail(user.email)) {
    await supabase.auth.signOut()
    return NextResponse.redirect(new URL('/contractor-portal', url.origin))
  }
  return NextResponse.redirect(new URL('/', url.origin))
}
