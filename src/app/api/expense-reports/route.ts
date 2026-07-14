// ============================================================
// EXPENSE REPORTS API (trips)
// ============================================================
// Path: src/app/api/expense-reports/route.ts
//
// Manages trip-based expense reports for the contractor portal.
// The expense_reports table has RLS enabled with ZERO policies,
// so the browser can never query it directly — all access goes
// through this route with the service role key, and identity
// always comes from the verified contractor_session cookie.
//
// PRIVACY RULE: the `billable` column is admin-only. It is never
// selected, returned, or accepted by any handler in this file.
//
// Lifecycle: draft → submitted → approved → invoiced → paid
//   - Contractors control: create/edit/delete drafts, submit.
//   - Admin controls (elsewhere): approve/reject, billable, paid.
//
// Endpoints:
//   GET    /api/expense-reports
//            → all of this contractor's reports, each with its
//              expense lines and computed totals
//   POST   { action:'create', title, client_id?, description?, trip_start?, trip_end? }
//   POST   { action:'submit', report_id }
//            → flips report + all draft lines to 'submitted',
//              sends ONE admin notification for the whole report
//   PATCH  { report_id, ...fields }   (draft reports only)
//   DELETE ?report_id=...             (draft reports only; removes lines too)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { readSessionFromCookie, getSupabaseAdmin } from '@/lib/contractor-auth'
import { sendAdminExpenseSubmittedEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

const REPORT_COLUMNS =
  'id, client_id, title, description, status, trip_start, trip_end, invoice_id, invoiced_at, submitted_at, created_at'
const LINE_COLUMNS =
  'id, report_id, date, description, merchant, category, amount, currency, original_amount, fx_rate, fx_date, line_items, receipt_url, status'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const cleanText = (v: any, max: number) => (typeof v === 'string' && v.trim().length > 0 ? v.trim().slice(0, max) : null)
const cleanDate = (v: any) => (typeof v === 'string' && DATE_RE.test(v) ? v : null)

// ------------------------------------------------------------
// GET — list reports with lines and totals
// ------------------------------------------------------------
export async function GET() {
  const session = await readSessionFromCookie()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data: reports, error } = await supabase
    .from('expense_reports')
    .select(REPORT_COLUMNS)
    .eq('team_member_id', session.contractorId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('expense-reports GET error:', error)
    return NextResponse.json({ error: 'Failed to load reports' }, { status: 500 })
  }

  const ids = (reports || []).map((r: any) => r.id)
  let linesByReport: Record<string, any[]> = {}
  if (ids.length > 0) {
    const { data: lines, error: le } = await supabase
      .from('contractor_expenses')
      .select(LINE_COLUMNS)
      .eq('team_member_id', session.contractorId)
      .in('report_id', ids)
      .order('date', { ascending: true })
    if (le) {
      console.error('expense-reports GET lines error:', le)
      return NextResponse.json({ error: 'Failed to load report lines' }, { status: 500 })
    }
    ;(lines || []).forEach((ln: any) => {
      if (!linesByReport[ln.report_id]) linesByReport[ln.report_id] = []
      linesByReport[ln.report_id].push(ln)
    })
  }

  const withTotals = (reports || []).map((r: any) => {
    const lines = linesByReport[r.id] || []
    const total = Math.round(lines.reduce((s: number, ln: any) => s + (ln.amount || 0), 0) * 100) / 100
    return { ...r, lines, line_count: lines.length, total }
  })

  return NextResponse.json({ reports: withTotals })
}

// ------------------------------------------------------------
// POST — create draft report, or submit a report
// ------------------------------------------------------------
export async function POST(request: NextRequest) {
  const session = await readSessionFromCookie()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // ---------- CREATE ----------
  if (body?.action === 'create') {
    const title = cleanText(body.title, 140)
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

    // company_id comes from the contractor's own record, never the client
    const { data: member } = await supabase
      .from('team_members')
      .select('company_id')
      .eq('id', session.contractorId)
      .single()

    const { data, error } = await supabase
      .from('expense_reports')
      .insert({
        team_member_id: session.contractorId,
        company_id: member?.company_id || null,
        client_id: typeof body.client_id === 'string' && body.client_id.length > 0 ? body.client_id : null,
        title,
        description: cleanText(body.description, 1000),
        trip_start: cleanDate(body.trip_start),
        trip_end: cleanDate(body.trip_end),
        status: 'draft',
      })
      .select(REPORT_COLUMNS)
      .single()

    if (error) {
      console.error('expense-reports create error:', error)
      return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, report: { ...data, lines: [], line_count: 0, total: 0 } })
  }

  // ---------- SUBMIT ----------
  if (body?.action === 'submit') {
    const reportId = body.report_id
    if (typeof reportId !== 'string' || reportId.length === 0) {
      return NextResponse.json({ error: 'Missing report_id' }, { status: 400 })
    }

    const { data: report, error: re } = await supabase
      .from('expense_reports')
      .select('id, title, description, status')
      .eq('id', reportId)
      .eq('team_member_id', session.contractorId)
      .single()
    if (re || !report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    if (report.status !== 'draft') {
      return NextResponse.json({ error: 'Only draft reports can be submitted' }, { status: 400 })
    }

    const { data: lines, error: le } = await supabase
      .from('contractor_expenses')
      .select('id, amount')
      .eq('team_member_id', session.contractorId)
      .eq('report_id', reportId)
    if (le) {
      console.error('expense-reports submit lines error:', le)
      return NextResponse.json({ error: 'Failed to read report lines' }, { status: 500 })
    }
    if (!lines || lines.length === 0) {
      return NextResponse.json({ error: 'Add at least one expense before submitting' }, { status: 400 })
    }

    const now = new Date().toISOString()

    const { error: ue } = await supabase
      .from('contractor_expenses')
      .update({ status: 'submitted', submitted_at: now })
      .eq('team_member_id', session.contractorId)
      .eq('report_id', reportId)
    if (ue) {
      console.error('expense-reports submit lines update error:', ue)
      return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 })
    }

    const { error: se } = await supabase
      .from('expense_reports')
      .update({ status: 'submitted', submitted_at: now, updated_at: now })
      .eq('id', reportId)
      .eq('team_member_id', session.contractorId)
    if (se) {
      console.error('expense-reports submit update error:', se)
      return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 })
    }

    // ONE admin notification per report — never per receipt.
    // Non-blocking: a mail hiccup must not fail the submission.
    const total = Math.round(lines.reduce((s: number, ln: any) => s + (ln.amount || 0), 0) * 100) / 100
    sendAdminExpenseSubmittedEmail({
      contractorName: session.name,
      contractorEmail: session.email,
      expenseDescription: `Expense report: ${report.title} (${lines.length} item${lines.length === 1 ? '' : 's'})`,
      expenseAmount: total,
      expenseDate: now.split('T')[0],
      category: 'Expense report',
      notes: report.description || undefined,
    }).catch(err => console.warn('Report admin notification failed (non-blocking):', err))

    return NextResponse.json({ ok: true, status: 'submitted', total })
  }

  return NextResponse.json({ error: "Invalid action. Use 'create' or 'submit'." }, { status: 400 })
}

// ------------------------------------------------------------
// PATCH — edit a draft report's header fields
// ------------------------------------------------------------
export async function PATCH(request: NextRequest) {
  const session = await readSessionFromCookie()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const reportId = body?.report_id
  if (typeof reportId !== 'string' || reportId.length === 0) {
    return NextResponse.json({ error: 'Missing report_id' }, { status: 400 })
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() }
  if ('title' in body) {
    const t = cleanText(body.title, 140)
    if (!t) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 })
    updates.title = t
  }
  if ('description' in body) updates.description = cleanText(body.description, 1000)
  if ('client_id' in body) updates.client_id = typeof body.client_id === 'string' && body.client_id.length > 0 ? body.client_id : null
  if ('trip_start' in body) updates.trip_start = cleanDate(body.trip_start)
  if ('trip_end' in body) updates.trip_end = cleanDate(body.trip_end)

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('expense_reports')
    .update(updates)
    .eq('id', reportId)
    .eq('team_member_id', session.contractorId)
    .eq('status', 'draft')
    .select(REPORT_COLUMNS)
    .single()

  if (error || !data) {
    console.error('expense-reports PATCH error:', error)
    return NextResponse.json({ error: 'Report not found or not editable' }, { status: 400 })
  }
  return NextResponse.json({ ok: true, report: data })
}

// ------------------------------------------------------------
// DELETE — remove a draft report and its lines
// ------------------------------------------------------------
export async function DELETE(request: NextRequest) {
  const session = await readSessionFromCookie()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const reportId = request.nextUrl.searchParams.get('report_id')
  if (!reportId) return NextResponse.json({ error: 'Missing report_id' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  const { data: report } = await supabase
    .from('expense_reports')
    .select('id, status')
    .eq('id', reportId)
    .eq('team_member_id', session.contractorId)
    .single()
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  if (report.status !== 'draft') {
    return NextResponse.json({ error: 'Only draft reports can be deleted' }, { status: 400 })
  }

  // Lines first (FK), then the report
  const { error: le } = await supabase
    .from('contractor_expenses')
    .delete()
    .eq('team_member_id', session.contractorId)
    .eq('report_id', reportId)
  if (le) {
    console.error('expense-reports DELETE lines error:', le)
    return NextResponse.json({ error: 'Failed to delete report lines' }, { status: 500 })
  }

  const { error: se } = await supabase
    .from('expense_reports')
    .delete()
    .eq('id', reportId)
    .eq('team_member_id', session.contractorId)
  if (se) {
    console.error('expense-reports DELETE error:', se)
    return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
