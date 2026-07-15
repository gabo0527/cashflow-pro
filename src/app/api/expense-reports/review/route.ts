// src/app/api/expense-reports/review/route.ts
// ============================================================
// ADMIN REVIEW of contractor expense reports.
// - Verifies the caller is an admin (Supabase token + allowlist),
//   identical pattern to /api/onboarding/review
// - GET: list all expense reports (admin view — includes the
//   admin-only `billable` flag, which contractor routes never see)
// - POST approve: report + all its lines -> 'approved',
//   stamps approved_at, stores billable + optional note
// - POST reject: report + all its lines -> 'rejected',
//   stores the note the contractor will see
// - POST set_billable: flip the internal billable flag alone
//
// The contractor-facing /api/expense-reports route never selects
// billable, approved_by, or review internals beyond status and
// review_note. This route is the ONLY writer of report decisions.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/contractor-auth'
import { isAdminEmail } from '@/lib/admin-allowlist'

export const dynamic = 'force-dynamic'

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return null
  const admin = getSupabaseAdmin()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user?.email) return null
  return isAdminEmail(data.user.email) ? data.user.email : null
}

// ------------------------------------------------------------
// GET — all reports for the admin Expenses view
// ------------------------------------------------------------
export async function GET(req: NextRequest) {
  const adminEmail = await verifyAdmin(req)
  if (!adminEmail) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('expense_reports')
    .select('id, team_member_id, client_id, title, description, status, billable, trip_start, trip_end, invoice_id, invoiced_at, submitted_at, approved_at, review_note, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('review GET error:', error)
    return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 })
  }
  return NextResponse.json({ reports: data || [] })
}

// ------------------------------------------------------------
// POST — approve / reject / set_billable
// ------------------------------------------------------------
export async function POST(req: NextRequest) {
  const adminEmail = await verifyAdmin(req)
  if (!adminEmail) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })

  let body: { report_id?: string; action?: string; billable?: boolean; note?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const reportId = body.report_id
  const action = body.action
  if (!reportId || !action) {
    return NextResponse.json({ error: 'Missing report_id or action' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data: report, error: re } = await supabase
    .from('expense_reports')
    .select('id, team_member_id, status')
    .eq('id', reportId)
    .single()
  if (re || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })

  const now = new Date().toISOString()
  const note = typeof body.note === 'string' && body.note.trim().length > 0 ? body.note.trim().slice(0, 500) : null

  // ---------- SET BILLABLE (internal flag only, any status) ----------
  if (action === 'set_billable') {
    if (typeof body.billable !== 'boolean') {
      return NextResponse.json({ error: 'billable must be true or false' }, { status: 400 })
    }
    const { error } = await supabase
      .from('expense_reports')
      .update({ billable: body.billable, updated_at: now })
      .eq('id', reportId)
    if (error) {
      console.error('set_billable error:', error)
      return NextResponse.json({ error: 'Failed to update billable flag' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, billable: body.billable })
  }

  // ---------- APPROVE / REJECT ----------
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: "Invalid action. Use 'approve', 'reject', or 'set_billable'." }, { status: 400 })
  }
  if (report.status !== 'submitted') {
    return NextResponse.json({ error: `Only submitted reports can be reviewed (this one is '${report.status}')` }, { status: 400 })
  }
  if (action === 'reject' && !note) {
    return NextResponse.json({ error: 'A short note is required when rejecting, so the contractor knows why' }, { status: 400 })
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected'

  // Lines first: if this fails, the report stays 'submitted' and the
  // action can simply be retried — never a half-decided state where
  // the report is approved but its lines are not.
  const { error: le } = await supabase
    .from('contractor_expenses')
    .update({ status: newStatus })
    .eq('report_id', reportId)
    .eq('team_member_id', report.team_member_id)
  if (le) {
    console.error('review lines update error:', le)
    return NextResponse.json({ error: 'Failed to update report lines — retry the action' }, { status: 500 })
  }

  const updates: Record<string, any> = { status: newStatus, review_note: note, updated_at: now }
  if (action === 'approve') {
    updates.approved_at = now
    if (typeof body.billable === 'boolean') updates.billable = body.billable
  }
  const { error: se } = await supabase.from('expense_reports').update(updates).eq('id', reportId)
  if (se) {
    console.error('review report update error:', se)
    return NextResponse.json({ error: 'Lines updated but report update failed — retry the action' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, status: newStatus, approved_at: action === 'approve' ? now : null })
}
