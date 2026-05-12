// ============================================================
// CONTRACTOR AUTH: LOGOUT
// ============================================================
// Clears the session cookie. Called by the portal's logout button.
// ============================================================

import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/contractor-auth'

export async function POST() {
  await clearSessionCookie()
  return NextResponse.json({ success: true })
}
