// ============================================================
// CONTRACTOR AUTH: SESSION CHECK
// ============================================================
// Called by the contractor portal page on mount.
// - If a valid session cookie is present: returns contractor info
// - If no session or invalid: returns 401
//
// The portal uses this to decide:
//   - 401  → show login screen
//   - 200  → load portal data for that contractor
// ============================================================

import { NextResponse } from 'next/server'
import { readSessionFromCookie } from '@/lib/contractor-auth'

export async function GET() {
  const session = await readSessionFromCookie()
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
  return NextResponse.json({
    authenticated: true,
    contractor: {
      id: session.contractorId,
      email: session.email,
      name: session.name
    }
  })
}
