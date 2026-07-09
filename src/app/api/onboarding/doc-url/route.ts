// src/app/api/onboarding/doc-url/route.ts
// Returns a short-lived signed URL for a stored document path.
// Admins can view any path; a contractor can view their own tax-forms path.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, readSessionFromCookie } from '@/lib/contractor-auth'
import { isAdminEmail } from '@/lib/admin-allowlist'

export const runtime = 'nodejs'

async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return false
  const { data } = await getSupabaseAdmin().auth.getUser(token)
  return !!(data.user?.email && isAdminEmail(data.user.email))
}

export async function POST(req: NextRequest) {
  let body: { path?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const path = body.path
  if (!path || typeof path !== 'string') {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 })
  }

  let allowed = await isAdmin(req)
  if (!allowed) {
    const session = await readSessionFromCookie()
    if (session && path.startsWith(`tax-forms/${session.contractorId}/`)) allowed = true
  }
  if (!allowed) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  const { data, error } = await getSupabaseAdmin().storage.from('contractor-uploads').createSignedUrl(path, 300)
  if (error || !data) {
    return NextResponse.json({ error: 'Could not sign URL' }, { status: 500 })
  }
  return NextResponse.json({ url: data.signedUrl })
}
