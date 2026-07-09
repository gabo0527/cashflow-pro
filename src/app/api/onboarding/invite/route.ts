// src/app/api/onboarding/invite/route.ts
// ============================================================
// ADMIN INVITE a contractor to self-onboard.
// - Verifies the caller is an admin
// - Sets onboarding_status = 'invited'
// - Sends the branded invite email (Resend) -> portal login
// - Audit-logs the invite
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/contractor-auth'
import { isAdminEmail } from '@/lib/admin-allowlist'
import { Resend } from 'resend'

const FROM_EMAIL = process.env.EMAIL_FROM || 'Vantage <notifications@vantagefp.co>'

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return null
  const admin = getSupabaseAdmin()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user?.email) return null
  return isAdminEmail(data.user.email) ? data.user.email : null
}

function inviteHtml(name: string, url: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;background:#e7eaee;font-family:'Instrument Sans',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#1b2431,#10151c);padding:26px 32px;">
      <div style="font-size:20px;font-weight:800;color:#ffffff;font-family:Arial,sans-serif;">Vantage<span style="color:#ea8a2f;">FP</span></div>
    </div>
    <div style="padding:30px 32px;color:#334155;">
      <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#2563eb;margin-bottom:10px;">Contractor Onboarding &middot; Mano CG LLC</div>
      <h1 style="font-size:22px;margin:0 0 14px;color:#0f172a;font-family:Arial,sans-serif;">You're invited to get set up</h1>
      <p style="font-size:14px;line-height:1.6;margin:0 0 14px;">Hi ${name},</p>
      <p style="font-size:14px;line-height:1.6;margin:0 0 18px;">Mano CG has invited you to the contractor portal. Complete a short onboarding to set up your profile, payment details, and tax form.</p>
      <a href="${url}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 26px;border-radius:10px;">Start onboarding &rarr;</a>
      <div style="border-left:3px solid #2563eb;background:#f3f7ff;border-radius:0 8px 8px 0;padding:11px 14px;font-size:13px;color:#334155;margin:22px 0;">Your login is <b>this email address</b> &mdash; no password. You'll use the same login going forward to submit time and view documents.</div>
    </div>
    <div style="padding:18px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11.5px;color:#94a3b8;">Mano CG LLC &middot; vantagefp.co</div>
  </div></body></html>`
}

export async function POST(req: NextRequest) {
  const adminEmail = await verifyAdmin(req)
  if (!adminEmail) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
  }

  let body: { contractorId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { contractorId } = body
  if (!contractorId) {
    return NextResponse.json({ error: 'Missing contractorId' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data: c, error: cErr } = await supabase.from('team_members').select('id, name, email').eq('id', contractorId).single()
  if (cErr || !c?.email) {
    return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
  }

  await supabase.from('team_members').update({ onboarding_status: 'invited' }).eq('id', contractorId)

  const url = 'https://vantagefp.co/contractor-portal'
  let emailSent = false
  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: FROM_EMAIL,
      to: c.email,
      subject: 'You are invited to onboard - Mano CG',
      html: inviteHtml(c.name || 'there', url),
    })
    emailSent = true
  } catch {
    // Email failure should not block the invite; status is already set.
  }

  await supabase.from('profile_audit_log').insert({
    contractor_id: contractorId, changed_by: adminEmail, field: 'onboarding', old_value: null, new_value: 'invited', action: 'invite',
  })

  return NextResponse.json({ ok: true, emailSent })
}
