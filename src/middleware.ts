import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { isAdminEmail } from '@/lib/admin-allowlist'

// ============================================================
// MIDDLEWARE — ADMIN ALLOWLIST GATE
// ============================================================
// Runs on every request to the app. Two jobs:
//
// 1. Pass through public/contractor routes without checking auth
// 2. For everything else, check if the user has a Supabase
//    session AND if their email is in the admin allowlist.
//    If they have a session but are NOT an admin -> redirect
//    to /contractor-portal (and they stay signed out of admin).
//
// This is the SECONDARY gate. The PRIMARY gate is in
// auth/callback/route.ts which blocks unauthorized users at
// login. This middleware catches anyone who somehow already
// has a session (e.g. logged in before the allowlist existed).
// ============================================================

// Paths that should NOT be gated by the admin check
const PUBLIC_PATHS = [
  '/login',
  '/auth/callback',
  '/contractor-portal',
  '/api/contractor-auth',
  '/timesheet',
  '/favicon.ico',
  '/_next',
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname.startsWith(path))
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Skip public paths entirely
  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  // Initialize Supabase client for middleware
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  // Get the current session (if any)
  const { data: { session } } = await supabase.auth.getSession()

  // No session = unauthenticated user, let them through to login
  // (The pages themselves redirect to /login if needed)
  if (!session) {
    return res
  }

  // Session exists — check if user is in admin allowlist
  const email = session.user?.email
  if (!isAdminEmail(email)) {
    // Not an admin — redirect to contractor portal
    // Note: we don't sign them out here (would require setting cookies)
    // Their session will be terminated when they hit /auth/callback
    // or naturally expire. For now, they just can't access admin routes.
    const url = req.nextUrl.clone()
    url.pathname = '/contractor-portal'
    return NextResponse.redirect(url)
  }

  // Authorized admin — let them through
  return res
}

// ============================================================
// MATCHER CONFIG
// ============================================================
// Run middleware on all routes EXCEPT:
// - /_next/static (static files)
// - /_next/image (image optimization)
// - /favicon.ico
// - public files (anything with a file extension)
// ============================================================
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
}
