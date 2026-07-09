// src/app/api/onboarding/review/route.ts
// ============================================================
// ADMIN REVIEW of a pending onboarding/profile submission.
// - Verifies the caller is an admin (Supabase token + allowlist)
// - approve: writes the proposed values to team_members (sensitive
//   values stay encrypted as stored), sets active, logs audit
// - reject: marks rejected, returns contractor to 'invited'
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/contractor-auth'
import { isAdminEmail } from '@/lib/admin-allowlist'

// Only these keys are copied into team_members on approve.
const SYNC_FIELDS = [
  'name', 'entity_name', 'entity_type', 'residency_status', 'address', 'city', 'state', 'zip', 'country',
  'ap_contact_name', 'ap_email', 'ap_phone', 'payment_method',
  'bank_name', 'account_type', 'routing_number', 'account_number', 'swift_code', 'clabe', 'iban',
  'intermediary_bank', 'bank_address', 'bank_id_type', 'bank_id', 'bank_address_1', 'bank_address_2', 'bank_address_3',
  'recipient_name', 'recipient_account', 'recipient_address_1', 'recipient_address_2', 'recipient_address_3',
  'tax_id', 'tax_id_type', 'tax_form_type', 'w9_url', 'w8ben_url', 'w8bene_url',
]

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

  let body: { changeId?: string; action?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { changeId, action } = body
  if (!changeId || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ error: 'Missing changeId or action' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data: change, error: cErr } = await supabase
    .from('contractor_profile_changes')
    .select('*')
    .eq('id', changeId)
    .eq('status', 'pending')
    .single()
  if (cErr || !change) {
    return NextResponse.json({ error: 'Pending submission not found' }, { status: 404 })
  }

  const now = new Date().toISOString()

  if (action === 'approve') {
    const payload = change.payload || {}
    const update: Record<string, any> = {}
    for (const k of SYNC_FIELDS) {
      if (payload[k] !== undefined && payload[k] !== null && payload[k] !== '') update[k] = payload[k]
    }
    update.onboarding_status = 'active'

    const { error: upErr } = await supabase.from('team_members').update(update).eq('id', change.contractor_id)
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

    await supabase.from('contractor_profile_changes').update({ status: 'approved', reviewed_by: adminEmail, reviewed_at: now }).eq('id', changeId)
    await supabase.from('profile_audit_log').insert({ contractor_id: change.contractor_id, changed_by: adminEmail, field: 'onboarding', old_value: null, new_value: 'approved', action: 'approve' })
    // NOTE: contractor notification wired alongside the invite email.
    return NextResponse.json({ ok: true, status: 'approved' })
  }

  // reject
  await supabase.from('contractor_profile_changes').update({ status: 'rejected', reviewed_by: adminEmail, reviewed_at: now }).eq('id', changeId)
  await supabase.from('team_members').update({ onboarding_status: 'invited' }).eq('id', change.contractor_id)
  await supabase.from('profile_audit_log').insert({ contractor_id: change.contractor_id, changed_by: adminEmail, field: 'onboarding', old_value: null, new_value: 'rejected', action: 'reject' })
  return NextResponse.json({ ok: true, status: 'rejected' })
}
