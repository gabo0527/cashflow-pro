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
//          body: { project_id, week_ending, daily_hours, daily_descriptions, note }
//          → creates or updates one draft row (upsert)
//   DELETE /api/timesheet-drafts?project_id=...&week_ending=YYYY-MM-DD
//          → removes one draft row
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { readSessionFromCookie, getSupabaseAdmin } from '@/lib/contractor-auth'
import { cleanDailyEntry, validISODate, weekDates } from '@/lib/timesheet-daily'
import { contractorTimesheetProjects } from '@/lib/contractor-timesheet-projects'

export const dynamic = 'force-dynamic'

// ------------------------------------------------------------
// Validation helpers
// ------------------------------------------------------------

function isValidDate(value: unknown): value is string {
  return validISODate(value)
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
    .select('id, project_id, week_ending, daily_hours, daily_descriptions, note, updated_at')
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

  const { project_id, week_ending, daily_hours, daily_descriptions, note } = body ?? {}

  if (typeof project_id !== 'string' || project_id.length === 0) {
    return NextResponse.json({ error: 'Invalid or missing project_id' }, { status: 400 })
  }
  if (!isValidDate(week_ending)) {
    return NextResponse.json({ error: 'Invalid or missing week_ending' }, { status: 400 })
  }

  const cleanedNote =
    typeof note === 'string' && note.trim().length > 0 ? note.trim().slice(0, 2000) : null

  const supabase = getSupabaseAdmin()
  let daily: ReturnType<typeof cleanDailyEntry>
  try {
    const dates = weekDates(week_ending)
    const { permitted } = await contractorTimesheetProjects(supabase, session.contractorId)
    const assignment = permitted.get(project_id)
    if (!assignment) return NextResponse.json({ error: 'Project is not assigned to you' }, { status: 403 })
    daily = cleanDailyEntry(daily_hours, daily_descriptions, dates, assignment.required)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Invalid timesheet' }, { status: 400 })
  }
  const cleanedHours = daily.daily_hours

  // If the draft has no hours and no note, treat the save as a delete
  // so empty rows never accumulate.
  if (Object.keys(cleanedHours).length === 0 && Object.keys(daily.daily_descriptions).length === 0 && !cleanedNote) {
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
        daily_descriptions: daily.daily_descriptions,
        note: cleanedNote,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'team_member_id,project_id,week_ending' }
    )
    .select('id, project_id, week_ending, daily_hours, daily_descriptions, note, updated_at')
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
