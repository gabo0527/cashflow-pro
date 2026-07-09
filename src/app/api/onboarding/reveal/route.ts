// src/app/api/onboarding/reveal/route.ts
// ============================================================
// ADMIN REVEAL of one encrypted field (bank/tax number).
// - Verifies the caller is an admin
// - Decrypts a single field from a pending change OR a live
//   team_members record
// - Logs the reveal to the audit trail (who peeked at what, when)
// Returns the plaintext for that one field only.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/contractor-auth'
import { isAdminEmail } from '@/lib/admin-allowlist'
import { decryptField, maskValue } from '@/lib/field-crypto'

const REVEALABLE = ['tax_id', 'routing_number', 'account_number', 'swift_code', 'clabe', 'iban', 'bank_id', 'recipient_account']

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return null
  const admin = getSupabaseAdmin()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user?.email) return null
  return isAdminEmail(data.user.email) ? data.user.email : null
}

export async function POST(req: NextRequest) {
  const adminEmail = await verifyAdmin(req)
  if (!adminEmail) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  let body: { field?: string; changeId?: string; contractorId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { field, changeId, contractorId } = body
  if (!field || !REVEALABLE.includes(field)) {
    return NextResponse.json({ error: 'Field not revealable' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  let encrypted = ''
  let targetContractor = contractorId || ''

  if (changeId) {
    const { data } = await supabase.from('contractor_profile_changes').select('contractor_id, payload').eq('id', changeId).single()
    if (data) { encrypted = (data.payload || {})[field] || ''; targetContractor = data.contractor_id }
  } else if (contractorId) {
    const { data } = await supabase.from('team_members').select(field).eq('id', contractorId).single()
    if (data) encrypted = (data as any)[field] || ''
  } else {
    return NextResponse.json({ error: 'Missing changeId or contractorId' }, { status: 400 })
  }

  if (!encrypted) {
    return NextResponse.json({ value: '' })
  }

  let value = ''
  try {
    value = decryptField(encrypted)
  } catch {
    return NextResponse.json({ error: 'Could not decrypt' }, { status: 500 })
  }

  // Audit the reveal (masked, so the log itself never stores the full secret)
  await supabase.from('profile_audit_log').insert({
    contractor_id: targetContractor || null,
    changed_by: adminEmail,
    field,
    old_value: null,
    new_value: maskValue(value),
    action: 'reveal',
  })

  return NextResponse.json({ value })
}
