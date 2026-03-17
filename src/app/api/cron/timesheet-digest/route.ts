// src/app/api/cron/timesheet-digest/route.ts
// ============================================================
// Weekly Timesheet Digest — Runs every Monday at 8:00 AM
// Sends admin a summary of who submitted timesheets last week
// and who didn't.
//
// Vercel cron config (vercel.json):
// {
//   "crons": [{ "path": "/api/cron/timesheet-digest", "schedule": "0 8 * * 1" }]
// }
// ============================================================

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendAdminTimesheetDigestEmail } from "@/lib/email"

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  )
}

export async function GET(request: Request) {
  // Security: verify this is called by Vercel cron (or allow manual trigger in dev)
  const authHeader = request.headers.get("authorization")
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = getSupabase()

  try {
    // Get prior week range (Monday–Sunday)
    const now = new Date()
    const dayOfWeek = now.getDay() // 0=Sun, 1=Mon
    // Start of last week (last Monday)
    const lastMonday = new Date(now)
    lastMonday.setDate(now.getDate() - ((dayOfWeek === 0 ? 7 : dayOfWeek) + 6))
    lastMonday.setHours(0, 0, 0, 0)
    // End of last week (last Sunday)
    const lastSunday = new Date(lastMonday)
    lastSunday.setDate(lastMonday.getDate() + 6)
    lastSunday.setHours(23, 59, 59, 999)

    const weekStart = lastMonday.toISOString().split("T")[0]
    const weekEnd = lastSunday.toISOString().split("T")[0]
    const weekLabel = `${lastMonday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${lastSunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`

    // Fetch all active contractors
    const { data: team, error: teamErr } = await supabase
      .from("team_members")
      .select("id, name, email")
      .eq("status", "active")

    if (teamErr || !team?.length) {
      console.error("Timesheet digest: failed to fetch team", teamErr)
      return NextResponse.json({ error: "Failed to fetch team" }, { status: 500 })
    }

    // Fetch all time entries for the week — time_entries use Monday-dated weeks
    const { data: timeEntries } = await supabase
      .from("time_entries")
      .select("contractor_id, hours, billable_hours, project_id, date")
      .gte("date", weekStart)
      .lte("date", weekEnd)

    // Fetch project names for display
    const { data: projects } = await supabase
      .from("projects")
      .select("id, name")

    const projectMap: Record<string, string> = {}
    projects?.forEach(p => { projectMap[p.id] = p.name })

    // Build per-contractor summary
    const contractors = team.map(member => {
      const entries = (timeEntries || []).filter(e => e.contractor_id === member.id)
      const totalHours = entries.reduce((s, e) => s + (e.hours || 0), 0)

      // Group by project
      const byProject: Record<string, number> = {}
      entries.forEach(e => {
        const name = projectMap[e.project_id] || "Unassigned"
        byProject[name] = (byProject[name] || 0) + (e.hours || 0)
      })

      return {
        name: member.name,
        submitted: totalHours > 0,
        totalHours,
        projects: Object.entries(byProject).map(([name, hours]) => ({ name, hours })),
      }
    })

    const result = await sendAdminTimesheetDigestEmail({
      weekLabel,
      weekStart,
      contractors,
    })

    if (!result.success) {
      console.error("Timesheet digest send failed:", result.error)
      return NextResponse.json({ error: "Email send failed" }, { status: 500 })
    }

    const submitted = contractors.filter(c => c.submitted).length
    console.log(`Timesheet digest sent: ${submitted}/${contractors.length} submitted for ${weekLabel}`)

    return NextResponse.json({
      success: true,
      week: weekLabel,
      submitted,
      total: contractors.length,
      emailId: result.id,
    })
  } catch (err) {
    console.error("Timesheet digest cron error:", err)
    return NextResponse.json({ error: "Internal error", details: (err as Error).message }, { status: 500 })
  }
}
