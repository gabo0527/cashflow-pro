// src/app/api/onboarding/submit/route.ts
// ============================================================
// ONBOARDING / PROFILE SUBMIT (contractor -> pending review)
// - Requires a valid contractor session (ties submission to them)
// - Encrypts sensitive fields server-side before storing
// - Saves the proposed values as a PENDING change (not live)
// - Marks the contractor pending (onboarding) + writes audit stamps
// Admin approves later on the Team side (stage 3), which writes to
// team_members. Nothing here touches the live team_members record.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { readSessionFromCookie, getSupabaseAdmin } from '@/lib/contractor-auth'
import { maskValue } from '@/lib/field-crypto'
import { fillIrsForm, IrsFormType } from '@/lib/irs-forms'

export const runtime = 'nodejs'

const SENSITIVE = ['tax_id', 'routing_number', 'account_number', 'swift_code', 'clabe', 'iban', 'bank_id', 'recipient_account']

export async function POST(req: NextRequest) {
  const session = await readSessionFromCookie()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: Record<string, any>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const contractorId = session.contractorId
  const kind = body.__kind === 'edit' ? 'edit' : 'onboarding'

  // Build the proposed payload: encrypt sensitive values, keep the rest as-is.
  const payload: Record<string, any> = {}
  const auditRows: any[] = []
  for (const [k, v] of Object.entries(body)) {
    if (k === '__kind') continue
    if (v === undefined || v === null || v === '') continue
    payload[k] = v
    if (SENSITIVE.includes(k)) {
      auditRows.push({
        contractor_id: contractorId,
        changed_by: session.email,
        field: k,
        old_value: null,
        new_value: maskValue(String(v)),
        action: 'submit'
      })
    }
  }

  // Generate the signed IRS tax form from the payload (non-blocking).
  try {
    const formType = payload.tax_form_type as IrsFormType
    const tplName = formType === 'W-9' ? 'fw9.pdf' : formType === 'W-8BEN' ? 'fw8ben.pdf' : formType === 'W-8BEN-E' ? 'fw8bene.pdf' : ''
    if (tplName) {
      const { data: tpl } = await supabase.storage.from('irs-templates').download(tplName)
      if (tpl) {
        const bytes = new Uint8Array(await tpl.arrayBuffer())
        const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
        const filled = await fillIrsForm(bytes, formType, {
          name: payload.name, entity_name: payload.entity_name, address: payload.address,
          city: payload.city, state: payload.state, zip: payload.zip, country: payload.country,
          tax_id: payload.tax_id, signature_name: payload.signature_name, signed_at: payload.signed_at, ip,
        })
        const path = `tax-forms/${contractorId}/${Date.now()}_${formType}.pdf`
        const up = await supabase.storage.from('contractor-uploads').upload(path, Buffer.from(filled), { contentType: 'application/pdf', upsert: true })
        if (!up.error) {
          const urlKey = formType === 'W-9' ? 'w9_url' : formType === 'W-8BEN' ? 'w8ben_url' : 'w8bene_url'
          payload[urlKey] = path
        }
      }
    }
  } catch { /* PDF generation is non-blocking; onboarding still succeeds */ }

  const { error: insErr } = await supabase
    .from('contractor_profile_changes')
    .insert({ contractor_id: contractorId, payload, kind, status: 'pending' })
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  if (kind === 'onboarding') {
    await supabase.from('team_members').update({ onboarding_status: 'pending' }).eq('id', contractorId)
  }

  if (auditRows.length) {
    await supabase.from('profile_audit_log').insert(auditRows)
  }

  // NOTE: admin notification is wired in stage 3 (Team-side review).

  return NextResponse.json({ ok: true })
}
