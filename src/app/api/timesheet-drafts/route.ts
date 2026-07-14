// ============================================================
// TIMESHEET DRAFTS API
// ============================================================
// Path: src/app/api/timesheet-drafts/route.ts
//
// Handles private timesheet drafts for the contractor portal.
// Drafts live in the `timesheet_drafts` table and NEVER touch
// `time_entries` until the contractor submits the week.
//
// Security model:
// - The `timesheet_drafts` table has RLS enabled with zero
//   policies, so the browser can never query it directly.
// - All access goes through this route using the service role
//   key, and the contractor's identity always comes from the
//   verified `contractor_session` cookie — never from the
//   request body.
//
// Endpoints:
//   GET    /api/timesheet-drafts?week_ending=YYYY-MM-DD
//          → returns all of this contractor's drafts for that week
//   POST   /api/timesheet-drafts
//          body: { project_id, week_ending, daily_hours, note }
//          → creates or updates one draft row (upsert)
//   DELETE /api/timesheet-drafts?project_id=...&week_ending=YYYY-MM-DD
//          → removes one draft row
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { readSessionFromCookie, getSupabaseAdmin } from '@/lib/contractor-auth'

export const dynamic = 'force-dynamic'

// ------------------------------------------------------------
// Validation helpers
// ------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && DATE_RE.test(value)
}

// daily_hours must be an object like { "2026-07-13": 8, "2026-07-14": 6.5 }
// Every key must be a date string, every value a number 0–24.
function validateDailyHours(value: unknown): { [date: string]: number } | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const cleaned: { [date: string]: number } = {}
  for (const [key, raw] of Object.entries(value)) {
    if (!DATE_RE.test(key)) return null
    const num = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(num) || num < 0 || num > 24) return null
    if (num > 0) cleaned[key] = num
  }
  return cleaned
}

// ------------------------------------------------------------
// GET — load all drafts for one week
// ------------------------------------------------------------

export async function GET(request: NextRequest) {
  const session = await readSessionFromCookie()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const weekEnding = request.nextUrl.searchParams.get('week_ending')
  if (!isValidDate(weekEnding)) {
    return NextResponse.json({ error: 'Invalid or missing week_ending' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('timesheet_drafts')
    .select('id, project_id, week_ending, daily_hours, note, updated_at')
    .eq('team_member_id', session.contractorId)
    .eq('week_ending', weekEnding)

  if (error) {
    console.error('timesheet-drafts GET error:', error)
    return NextResponse.json({ error: 'Failed to load drafts' }, { status: 500 })
  }

  return NextResponse.json({ drafts: data ?? [] })
}

// ------------------------------------------------------------
// POST — save (create or update) one draft
// ------------------------------------------------------------

export async function POST(request: NextRequest) {
  const session = await readSessionFromCookie()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { project_id, week_ending, daily_hours, note } = body ?? {}

  if (typeof project_id !== 'string' || project_id.length === 0) {
    return NextResponse.json({ error: 'Invalid or missing project_id' }, { status: 400 })
  }
  if (!isValidDate(week_ending)) {
    return NextResponse.json({ error: 'Invalid or missing week_ending' }, { status: 400 })
  }

  const cleanedHours = validateDailyHours(daily_hours)
  if (cleanedHours === null) {
    return NextResponse.json(
      { error: 'daily_hours must be an object of date keys and hour values between 0 and 24' },
      { status: 400 }
    )
  }

  const cleanedNote =
    typeof note === 'string' && note.trim().length > 0 ? note.trim().slice(0, 2000) : null

  const supabase = getSupabaseAdmin()

  // If the draft has no hours and no note, treat the save as a delete
  // so empty rows never accumulate.
  if (Object.keys(cleanedHours).length === 0 && !cleanedNote) {
    const { error } = await supabase
      .from('timesheet_drafts')
      .delete()
      .eq('team_member_id', session.contractorId)
      .eq('project_id', project_id)
      .eq('week_ending', week_ending)

    if (error) {
      console.error('timesheet-drafts POST (empty→delete) error:', error)
      return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, deleted: true })
  }

  const { data, error } = await supabase
    .from('timesheet_drafts')
    .upsert(
      {
        team_member_id: session.contractorId,
        project_id,
        week_ending,
        daily_hours: cleanedHours,
        note: cleanedNote,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'team_member_id,project_id,week_ending' }
    )
    .select('id, project_id, week_ending, daily_hours, note, updated_at')
    .single()

  if (error) {
    console.error('timesheet-drafts POST error:', error)
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, draft: data })
}

// ------------------------------------------------------------
// DELETE — remove one draft
// ------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  const session = await readSessionFromCookie()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const projectId = request.nextUrl.searchParams.get('project_id')
  const weekEnding = request.nextUrl.searchParams.get('week_ending')

  if (!projectId) {
    return NextResponse.json({ error: 'Invalid or missing project_id' }, { status: 400 })
  }
  if (!isValidDate(weekEnding)) {
    return NextResponse.json({ error: 'Invalid or missing week_ending' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('timesheet_drafts')
    .delete()
    .eq('team_member_id', session.contractorId)
    .eq('project_id', projectId)
    .eq('week_ending', weekEnding)

  if (error) {
    console.error('timesheet-drafts DELETE error:', error)
    return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
