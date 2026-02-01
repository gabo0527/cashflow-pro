// src/middleware.ts
// ============================================================
// NEXT.JS MIDDLEWARE — Server-side auth guard
// Runs BEFORE page loads. Redirects unauthenticated users to /login.
// Client-side permission checks happen in useAuth hook (more granular).
// ============================================================

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/terms', '/privacy', '/auth/callback']

// Static assets and API routes to skip
const SKIP_PATTERNS = [
  '/_next',
  '/favicon',
  '/api/',
  '/static/',
  '.ico',
  '.png',
  '.jpg',
  '.svg',
  '.css',
  '.js',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static assets and API routes
  if (SKIP_PATTERNS.some(pattern => pathname.includes(pattern))) {
    return NextResponse.next()
  }

  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    return NextResponse.next()
  }

  // Check for Supabase auth token in cookies
  // Supabase stores session in cookies named sb-<project-ref>-auth-token
  const cookies = request.cookies
  const hasAuthCookie = Array.from(cookies.getAll()).some(cookie => 
    cookie.name.includes('auth-token') || 
    cookie.name.includes('sb-') 
  )

  if (!hasAuthCookie) {
    // No auth cookie — redirect to login
    const loginUrl = new URL('/login', request.url)
    // Preserve the intended destination so we can redirect after login
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Auth cookie exists — allow through
  // Fine-grained permission checks happen client-side in useAuth hook
  // (middleware can't easily query Supabase for permission_role without service key)
  return NextResponse.next()
}

// Only run middleware on app routes (not static files)
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}
