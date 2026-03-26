/**
 * Agent: Timesheet Reconciler
 *
 * Runs weekly. Compares contractor hours vs project budgets,
 * flags overruns, identifies missing submissions, drafts reminders.
 *
 * Uses: Claude (analysis/reasoning) with OpenAI fallback.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { aiRequest } from '@/lib/ai-router'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Types ───────────────────────────────────────────────────────────────────

interface MemberStatus {
  member_id: string
  name: string
  email: string
  status: 'submitted' | 'missing' | 'partial'
  hours_logged: number
  expected_hours: number
  projects: { name: string; hours: number }[]
}

interface ProjectBudgetCheck {
  project_id: string
  project_name: string
  client_name: string
  budget_hours: number | null
  hours_used: number
  hours_this_week: number
  burn_pct: number | null
  status: 'on_track' | 'warning' | 'over_budget'
}

// Weekly hours broken down by client — used by Sage to build the breakdown table
interface WeeklyClientRow {
  week_start: string
  week_label: string
  clients: Record<string, number> // client_name → hours
  total: number
}

interface ReconciliationReport {
  week: { start: string; end: string }
  team_summary: {
    total_members: number
    submitted: number
    missing: number
    partial: number
    total_hours: number
  }
  members: MemberStatus[]
  budget_alerts: ProjectBudgetCheck[]
  weekly_by_client: WeeklyClientRow[]   // NEW — weekly breakdown by client
  client_totals: Record<string, number> // NEW — period total per client
  reminders: { to: string; email: string; message: string }[]
  ai_analysis: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeekRange(weeksAgo = 0): { start: string; end: string; label: string } {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) - weeksAgo * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { start: fmt(monday), end: fmt(sunday), label: `${fmt(monday)} to ${fmt(sunday)}` }
}

// Get the Sunday-based week start for a given date string (matches contractor portal logic)
function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay() // 0 = Sunday
  d.setDate(d.getDate() - day)
  return d.toISOString().split('T')[0]
}

function weekLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Core Logic ──────────────────────────────────────────────────────────────

async function reconcileWeek(companyId: string, weeksAgo = 0): Promise<ReconciliationReport> {
  const week = getWeekRange(weeksAgo)

  // 1. Get all active contractors
  const { data: members } = await supabase
    .from('team_members')
    .select('id, name, email, employment_type, cost_type, cost_amount')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .in('employment_type', ['1099', 'contractor'])

  if (!members?.length) {
    return {
      week: { start: week.start, end: week.end },
      team_summary: { total_members: 0, submitted: 0, missing: 0, partial: 0, total_hours: 0 },
      members: [],
      budget_alerts: [],
      weekly_by_client: [],
      client_totals: {},
      reminders: [],
      ai_analysis: 'No active contractors found.',
    }
  }

  // 2. Get all time entries for the week
  // FIX: column is contractor_id, not member_id
  const { data: entries } = await supabase
    .from('time_entries')
    .select('contractor_id, project_id, hours, date')
    .eq('company_id', companyId)
    .gte('date', week.start)
    .lte('date', week.end)

  // 3. Get projects + clients
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, client_id, budget_hours, status')
    .eq('company_id', companyId)
    .eq('status', 'active')

  const { data: clients } = await supabase
    .from('clients')
    .select('id, name')
    .eq('company_id', companyId)

  const projectMap: Record<string, any> = {}
  ;(projects || []).forEach(p => { projectMap[p.id] = p })
  const clientMap: Record<string, string> = {}
  ;(clients || []).forEach(c => { clientMap[c.id] = c.name })

  // 4. Build member statuses
  // FIX: filter by contractor_id (not member_id)
  const memberStatuses: MemberStatus[] = members.map(m => {
    const memberEntries = (entries || []).filter(e => e.contractor_id === m.id)
    const totalHours = memberEntries.reduce((s, e) => s + (e.hours || 0), 0)

    const byProject: Record<string, number> = {}
    memberEntries.forEach(e => {
      const pName = projectMap[e.project_id]?.name || 'Unknown'
      byProject[pName] = (byProject[pName] || 0) + (e.hours || 0)
    })

    const expectedHours = 40
    let status: 'submitted' | 'missing' | 'partial' = 'missing'
    if (totalHours >= expectedHours * 0.9) status = 'submitted'
    else if (totalHours > 0) status = 'partial'

    return {
      member_id: m.id,
      name: m.name,
      email: m.email,
      status,
      hours_logged: totalHours,
      expected_hours: expectedHours,
      projects: Object.entries(byProject).map(([name, hours]) => ({ name, hours })),
    }
  })

  // 5. Weekly breakdown by client
  // Groups entries by their week-start date, then by client — so Sage can show
  // a proper "Week of Mar 2 | GOOGL: 69.5h | CADC: 35.3h" table
  const weekBuckets: Record<string, WeeklyClientRow> = {}

  ;(entries || []).forEach(e => {
    const ws = getWeekStart(e.date)
    const clientName = clientMap[projectMap[e.project_id]?.client_id] || 'Unassigned'

    if (!weekBuckets[ws]) {
      weekBuckets[ws] = { week_start: ws, week_label: weekLabel(ws), clients: {}, total: 0 }
    }
    weekBuckets[ws].clients[clientName] = (weekBuckets[ws].clients[clientName] || 0) + (e.hours || 0)
    weekBuckets[ws].total += e.hours || 0
  })

  const weeklyByClient = Object.entries(weekBuckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([_, row]) => row)

  // Period totals per client
  const clientTotals: Record<string, number> = {}
  weeklyByClient.forEach(row => {
    Object.entries(row.clients).forEach(([client, hrs]) => {
      clientTotals[client] = (clientTotals[client] || 0) + hrs
    })
  })

  // 6. Check project budgets (all-time hours vs budget)
  const { data: allEntries } = await supabase
    .from('time_entries')
    .select('project_id, hours')
    .eq('company_id', companyId)

  const hoursByProject: Record<string, number> = {}
  ;(allEntries || []).forEach(e => {
    hoursByProject[e.project_id] = (hoursByProject[e.project_id] || 0) + (e.hours || 0)
  })

  const weekHoursByProject: Record<string, number> = {}
  ;(entries || []).forEach(e => {
    weekHoursByProject[e.project_id] = (weekHoursByProject[e.project_id] || 0) + (e.hours || 0)
  })

  const budgetAlerts: ProjectBudgetCheck[] = (projects || [])
    .filter(p => p.budget_hours && p.budget_hours > 0)
    .map(p => {
      const used = hoursByProject[p.id] || 0
      const thisWeek = weekHoursByProject[p.id] || 0
      const burnPct = (used / p.budget_hours) * 100
      return {
        project_id: p.id,
        project_name: p.name,
        client_name: clientMap[p.client_id] || 'Unknown',
        budget_hours: p.budget_hours,
        hours_used: used,
        hours_this_week: thisWeek,
        burn_pct: Math.round(burnPct * 10) / 10,
        status:
          burnPct >= 100 ? ('over_budget' as const)
          : burnPct >= 80 ? ('warning' as const)
          : ('on_track' as const),
      }
    })
    .filter(p => p.status !== 'on_track')
    .sort((a, b) => (b.burn_pct || 0) - (a.burn_pct || 0))

  // 7. Generate reminders for missing/partial
  const needsReminder = memberStatuses.filter(m => m.status !== 'submitted')
  const reminders = needsReminder.map(m => ({
    to: m.name,
    email: m.email,
    message:
      m.status === 'missing'
        ? `Hi ${m.name.split(' ')[0]}, this is a reminder to submit your timesheet for the week of ${week.label}. Please log your hours in the contractor portal at vantagefp.co.`
        : `Hi ${m.name.split(' ')[0]}, your timesheet for ${week.label} shows ${m.hours_logged}h logged but we expected ~${m.expected_hours}h. Please review and update if needed.`,
  }))

  // 8. AI analysis
  const summary = {
    total_members: members.length,
    submitted: memberStatuses.filter(m => m.status === 'submitted').length,
    missing: memberStatuses.filter(m => m.status === 'missing').length,
    partial: memberStatuses.filter(m => m.status === 'partial').length,
    total_hours: memberStatuses.reduce((s, m) => s + m.hours_logged, 0),
  }

  const clientBreakdownText = weeklyByClient.length > 0
    ? weeklyByClient.map(row =>
        `  Week of ${row.week_label}: ${Object.entries(row.clients).map(([c, h]) => `${c} ${h.toFixed(1)}h`).join(' | ')} (total ${row.total.toFixed(1)}h)`
      ).join('\n')
    : '  No hours logged this week.'

  let aiAnalysis = ''
  try {
    const aiResult = await aiRequest({
      messages: [{
        role: 'user',
        content: `Analyze this weekly timesheet reconciliation for an Owner's Representative consulting firm.

WEEK: ${week.label}

TEAM SUMMARY:
- ${summary.total_members} contractors, ${summary.submitted} submitted, ${summary.missing} missing, ${summary.partial} partial
- Total hours logged: ${summary.total_hours}

MEMBERS:
${memberStatuses.map(m => `- ${m.name}: ${m.status} (${m.hours_logged}h) — ${m.projects.map(p => `${p.name}: ${p.hours}h`).join(', ') || 'no entries'}`).join('\n')}

WEEKLY HOURS BY CLIENT:
${clientBreakdownText}

CLIENT PERIOD TOTALS:
${Object.entries(clientTotals).map(([c, h]) => `- ${c}: ${h.toFixed(1)}h`).join('\n') || '  None'}

BUDGET ALERTS:
${budgetAlerts.length > 0 ? budgetAlerts.map(b => `- ${b.project_name} (${b.client_name}): ${b.hours_used}/${b.budget_hours}h = ${b.burn_pct}% — ${b.status}`).join('\n') : 'No budget alerts.'}

Give a concise executive summary (3-5 sentences). Flag anything the owner should act on immediately. Prioritize issues by financial impact.`,
      }],
      systemPrompt:
        'You are a financial operations analyst for a consulting firm. Be direct, specific, and action-oriented. Use actual numbers.',
      taskType: 'analysis',
      maxTokens: 500,
    })
    aiAnalysis = aiResult.content
  } catch {
    aiAnalysis = `${summary.submitted}/${summary.total_members} timesheets submitted. ${summary.missing} missing. ${budgetAlerts.length} budget alerts.`
  }

  return {
    week: { start: week.start, end: week.end },
    team_summary: summary,
    members: memberStatuses,
    budget_alerts: budgetAlerts,
    weekly_by_client: weeklyByClient,
    client_totals: clientTotals,
    reminders,
    ai_analysis: aiAnalysis,
  }
}

// ─── API Route ───────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { action, companyId, weeksAgo } = await request.json()

    if (!companyId) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 })
    }

    if (action === 'reconcile') {
      const report = await reconcileWeek(companyId, weeksAgo || 0)
      return NextResponse.json(report)
    }

    if (action === 'missing-report') {
      const report = await reconcileWeek(companyId, weeksAgo || 0)
      return NextResponse.json({
        week: report.week,
        missing: report.members.filter(m => m.status === 'missing'),
        partial: report.members.filter(m => m.status === 'partial'),
        reminders: report.reminders,
      })
    }

    if (action === 'budget-check') {
      const report = await reconcileWeek(companyId, weeksAgo || 0)
      return NextResponse.json({
        week: report.week,
        alerts: report.budget_alerts,
        ai_analysis: report.ai_analysis,
      })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: reconcile, missing-report, or budget-check' },
      { status: 400 }
    )
  } catch (error) {
    console.error('[Agent: Timesheet Reconciler]', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
