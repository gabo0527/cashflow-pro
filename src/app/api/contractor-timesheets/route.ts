import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, readSessionFromCookie } from '@/lib/contractor-auth'
import { contractorTimesheetProjects } from '@/lib/contractor-timesheet-projects'
import { cleanDailyEntry, dailySubmissionRows, weekDates } from '@/lib/timesheet-daily'

export const dynamic = 'force-dynamic'

// Submit every project in a week together. The session owns the contractor ID;
// the database operation replaces the week and clears drafts in one transaction.
export async function POST(request: NextRequest) {
  const session = await readSessionFromCookie()
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let body: any
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  let dates: string[]
  try { dates = weekDates(body?.week_ending) } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (!Array.isArray(body?.projects)) {
    return NextResponse.json({ error: 'projects must be an array' }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  try {
    const { member, permitted } = await contractorTimesheetProjects(supabase, session.contractorId)
    const seen = new Set<string>()
    const entries: ReturnType<typeof dailySubmissionRows> = []
    for (const project of body.projects) {
      const assignment = permitted.get(project?.project_id)
      if (!assignment) return NextResponse.json({ error: 'Project is not assigned to you' }, { status: 403 })
      if (seen.has(assignment.project_id)) return NextResponse.json({ error: 'Duplicate project' }, { status: 400 })
      seen.add(assignment.project_id)
      const daily = cleanDailyEntry(project.daily_hours, project.daily_descriptions, dates, assignment.required)
      entries.push(...dailySubmissionRows(assignment.project_id, daily, assignment.rate))
    }
    // The portal submits the full grid. Reject an incomplete payload so omitted
    // projects cannot silently lose their already-submitted hours.
    if (seen.size !== permitted.size) {
      return NextResponse.json({ error: 'Reload the timesheet and submit all assigned projects together' }, { status: 400 })
    }
    const { data, error } = await supabase.rpc('replace_contractor_timesheet', {
      p_contractor_id: session.contractorId,
      p_company_id: member.company_id || null,
      p_week_ending: body.week_ending,
      p_entries: entries,
    })
    if (error) {
      console.error('Contractor timesheet submit failed:', error)
      return NextResponse.json({ error: error.message === 'This week has been invoiced and is locked'
        ? error.message : 'Unable to submit timesheet. Your saved entries have been preserved.' }, { status: 400 })
    }
    return NextResponse.json({ ok: true, entries: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to submit timesheet' }, { status: 400 })
  }
}
