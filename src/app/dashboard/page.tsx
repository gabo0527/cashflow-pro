'use client'

// DASHBOARD — Blueprint rebuild (Phase A)
// A snapshot of what LIVES in Vantage: recognized revenue (same engine as
// Projects), live hours, and an Action Items queue. All dead-source data
// removed: QBO invoices, AR, expenses, margins, cash forecast.

import React, { useState, useEffect, useMemo, useRef } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  BLUEPRINT, THEME,
  getContractType, calcLSRecognition, entryRevenue, buildRateLookups,
  getRenewalWatch, todayISO, monthKeyOf, monthLabel, monthRange,
  formatCurrency, formatCompactCurrency, formatDateShort,
} from '@/components/projects/shared'

const AR = { fontFamily: BLUEPRINT.fontDisplay }

function useCountUp(target: number, duration = 700) {
  const [val, setVal] = useState(0)
  const prev = useRef(0)
  useEffect(() => {
    const from = prev.current; prev.current = target
    if (from === target) { setVal(target); return }
    const t0 = performance.now(); let raf = 0
    const tick = (t: number) => {
      const p = Math.min((t - t0) / duration, 1)
      setVal(from + (target - from) * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}
function Money({ v }: { v: number }) { const n = useCountUp(v); return <span className="tabular-nums">{formatCompactCurrency(n)}</span> }
function Num({ v }: { v: number }) { const n = useCountUp(v); return <span className="tabular-nums">{Math.round(n).toLocaleString()}</span> }

export default function DashboardPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [entries, setEntries] = useState<any[]>([])
  const [billRates, setBillRates] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [pendingExpenses, setPendingExpenses] = useState<any[]>([])
  const [pendingProfileChanges, setPendingProfileChanges] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [pRes, cRes, tmRes, tsRes, brRes, aRes, erRes, pcRes] = await Promise.allSettled([
          supabase.from('projects').select('*'),
          supabase.from('clients').select('id, name'),
          supabase.from('team_members').select('id, name, status, employment_type'),
          supabase.from('time_entries').select('*'),
          supabase.from('bill_rates').select('*'),
          supabase.from('team_project_assignments').select('*'),
          supabase.from('expense_reports').select('id, title, status, submitted_at, client_id').eq('status', 'submitted'),
          supabase.from('contractor_profile_changes').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        ])
        const val = (r: any) => (r.status === 'fulfilled' && !r.value.error ? r.value.data || [] : [])
        setProjects(val(pRes).map((p: any) => ({ ...p, fixed_amount: parseFloat(p.fixed_amount) || 0 })))
        setClients(val(cRes))
        setTeamMembers(val(tmRes))
        setEntries(val(tsRes))
        setBillRates(val(brRes))
        setAssignments(val(aRes))
        setPendingExpenses(val(erRes))
        setPendingProfileChanges(pcRes.status === 'fulfilled' && !pcRes.value.error ? (pcRes.value.count || 0) : 0)
      } catch (e) { console.error(e) } finally { setLoading(false) }
    }
    load()
  }, [])

  const today = todayISO()
  const curMonth = monthKeyOf(today)
  const curYear = today.slice(0, 4)

  const { rateCardLookup, assignmentLookup } = useMemo(() => buildRateLookups(billRates, assignments), [billRates, assignments])
  const projectById = useMemo(() => { const m: Record<string, any> = {}; projects.forEach(p => { m[p.id] = p }); return m }, [projects])
  const revenueProjects = useMemo(() => projects.filter(p => !['prospect', 'archived'].includes(p.status || 'active')), [projects])

  // Current Mon–Sun week (string math, matches Time Tracking)
  const week = useMemo(() => {
    const [y, m, d] = today.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7))
    const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    const start = iso(dt); dt.setDate(dt.getDate() + 6)
    return { start, end: iso(dt) }
  }, [today])

  // ============ REVENUE (recognition engine) ============
  const rev = useMemo(() => {
    let ytd = 0, monthLS = 0, monthTM = 0
    const byMonth: Record<string, { ls: number; tm: number }> = {}
    monthRange(`${curYear}-01`, `${curYear}-12`).forEach(mk => { byMonth[mk] = { ls: 0, tm: 0 } })

    revenueProjects.forEach(p => {
      if (getContractType(p) === 'lump_sum') {
        const ls = calcLSRecognition(p, today)
        ls.recognizedMonths.forEach(mk => {
          if (mk.startsWith(curYear)) { byMonth[mk].ls += ls.monthlyFee; ytd += ls.monthlyFee }
          if (mk === curMonth) monthLS += ls.monthlyFee
        })
      }
    })
    entries.forEach(e => {
      const p = projectById[e.project_id]
      if (!p || getContractType(p) === 'lump_sum' || ['prospect', 'archived'].includes(p.status || 'active')) return
      const mk = monthKeyOf(e.date)
      const r = entryRevenue(e, p, rateCardLookup, assignmentLookup)
      if (mk.startsWith(curYear) && mk <= curMonth) { byMonth[mk].tm += r; ytd += r }
      if (mk === curMonth) monthTM += r
    })

    const runningLS = revenueProjects
      .filter(p => p.status === 'active' && getContractType(p) === 'lump_sum')
      .map(p => calcLSRecognition(p, today)).filter(ls => !ls.ended)
    const runRate = runningLS.reduce((s, ls) => s + ls.monthlyFee, 0)

    return { ytd, monthLS, monthTM, byMonth, runRate }
  }, [revenueProjects, entries, projectById, rateCardLookup, assignmentLookup, today, curMonth, curYear])

  // ============ HOURS ============
  const hours = useMemo(() => {
    let monthActual = 0, monthBillable = 0, ytdActual = 0
    const activeThisMonth = new Set<string>()
    const weekByMember: Record<string, number> = {}
    entries.forEach(e => {
      const d = (e.date || '').slice(0, 10)
      const mk = monthKeyOf(d)
      if (mk.startsWith(curYear)) ytdActual += e.hours || 0
      if (mk === curMonth) {
        monthActual += e.hours || 0
        monthBillable += e.billable_hours != null ? e.billable_hours : (e.hours || 0)
        activeThisMonth.add(e.contractor_id || e.user_id || '')
      }
      if (d >= week.start && d <= week.end) {
        const mid = e.contractor_id || e.user_id || ''
        weekByMember[mid] = (weekByMember[mid] || 0) + (e.hours || 0)
      }
    })
    return { monthActual, monthBillable, ytdActual, activeCount: activeThisMonth.size, weekByMember }
  }, [entries, curMonth, curYear, week])

  const activeMembers = useMemo(() => teamMembers.filter(m => (m.status || 'active') === 'active'), [teamMembers])
  const weekRows = useMemo(() => activeMembers
    .map(m => ({ id: m.id, name: m.name, hrs: hours.weekByMember[m.id] || 0 }))
    .sort((a, b) => b.hrs - a.hrs), [activeMembers, hours.weekByMember])
  const weekMax = Math.max(...weekRows.map(r => r.hrs), 1)
  const missingThisWeek = weekRows.filter(r => r.hrs === 0)

  // ============ ACTION ITEMS ============
  const renewals = useMemo(() => getRenewalWatch(projects, today, 60), [projects, today])
  const missingEnd = useMemo(() => revenueProjects.filter(p =>
    p.status === 'active' && getContractType(p) === 'lump_sum' && !p.end_date && (p.fixed_amount || 0) > 0
  ), [revenueProjects])
  const runRateDrop = renewals.reduce((s, r) => s + (r.project.fixed_amount || 0), 0)

  type ActionItem = { color: string; title: string; detail: string; href: string; cta: string }
  const actionItems: ActionItem[] = useMemo(() => {
    const items: ActionItem[] = []
    renewals.forEach(r => items.push({
      color: BLUEPRINT.copper,
      title: `${r.project.name} ends in ${r.days} day${r.days !== 1 ? 's' : ''}`,
      detail: `${formatCompactCurrency(r.project.fixed_amount || 0)}/mo lump sum · ${formatDateShort(r.project.end_date)} — renew or run rate drops`,
      href: '/projects', cta: 'View',
    }))
    if (missingEnd.length > 0) items.push({
      color: '#f59e0b',
      title: `${missingEnd.length} LS scope${missingEnd.length > 1 ? 's' : ''} missing end date`,
      detail: `${missingEnd.map(p => p.name).join(', ')} — can't reconcile without one`,
      href: '/projects', cta: 'Fix',
    })
    if (missingThisWeek.length > 0) items.push({
      color: BLUEPRINT.blue,
      title: `${missingThisWeek.length} timesheet${missingThisWeek.length > 1 ? 's' : ''} missing this week`,
      detail: `${missingThisWeek.map(r => r.name.split(' ')[0]).join(', ')} — no hours since Monday`,
      href: '/time-tracking', cta: 'Review',
    })
    pendingExpenses.forEach(er => items.push({
      color: BLUEPRINT.emerald,
      title: 'Expense report pending review',
      detail: `${er.title || 'Untitled'} · submitted ${er.submitted_at ? formatDateShort(er.submitted_at.slice(0, 10)) : '—'}`,
      href: '/contractor-management', cta: 'Review',
    }))
    if (pendingProfileChanges > 0) items.push({
      color: BLUEPRINT.emerald,
      title: `${pendingProfileChanges} onboarding change${pendingProfileChanges > 1 ? 's' : ''} pending approval`,
      detail: 'Contractor profile / document updates awaiting review',
      href: '/contractor-management', cta: 'Review',
    })
    return items
  }, [renewals, missingEnd, missingThisWeek, pendingExpenses, pendingProfileChanges])

  // Chart series
  const monthly = useMemo(() => monthRange(`${curYear}-01`, `${curYear}-12`).map(mk => ({
    mk, label: monthLabel(mk),
    ls: rev.byMonth[mk]?.ls || 0, tm: rev.byMonth[mk]?.tm || 0,
    total: (rev.byMonth[mk]?.ls || 0) + (rev.byMonth[mk]?.tm || 0),
    future: mk > curMonth, current: mk === curMonth,
  })), [rev.byMonth, curMonth, curYear])
  const chartMax = Math.max(...monthly.map(m => m.total), 1)

  const activeProjects = projects.filter(p => p.status === 'active' && !p.is_change_order).length
  const pipeline = projects.filter(p => p.status === 'prospect' && !p.is_change_order).length
  const contractors = activeMembers.filter(m => (m.employment_type || 'contractor') === 'contractor').length

  const todayNice = useMemo(() => {
    const [y, m, d] = today.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    return { day: dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }), week: `Week ${Math.ceil(((dt.getTime() - new Date(y, 0, 1).getTime()) / 86400000 + new Date(y, 0, 1).getDay() + 1) / 7)} · ${y}` }
  }, [today])

  const snapshot = [
    { n: activeProjects, l: 'Active Projects', href: '/projects' },
    { n: clients.length, l: 'Clients', href: '/clients' },
    { n: contractors, l: 'Contractors', href: '/contractor-management' },
    { n: pipeline, l: 'Pipeline', href: '/projects' },
    { n: Math.round(hours.ytdActual), l: 'Hours YTD', href: '/time-tracking' },
    { n: renewals.length, l: 'Renewals ≤60d', href: '/projects' },
  ]

  if (loading) return <div className={`min-h-screen ${THEME.bgAlt} flex items-center justify-center`}><div className="animate-pulse text-slate-400">Loading dashboard...</div></div>

  return (
    <div className={`min-h-screen ${THEME.bgAlt}`}>
      <div className="max-w-[1320px] mx-auto px-6 py-6">
        {/* BANNER */}
        <div className="rounded-2xl px-6 py-5 mb-5 relative overflow-hidden flex items-center" style={{ background: BLUEPRINT.midnight }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 8px)' }} />
          <div className="relative">
            <div className="text-[10px] font-bold uppercase" style={{ ...AR, letterSpacing: '0.16em', color: '#93c5fd' }}>Command</div>
            <h1 className="text-white text-[26px] font-extrabold uppercase tracking-wide mt-1" style={AR}>Dashboard</h1>
            <p className="text-[13px] text-slate-400 mt-0.5">What lives in Vantage right now — recognized revenue, hours, and what needs you</p>
          </div>
          <div className="relative ml-auto text-right">
            <div className="text-white font-bold text-[15px]" style={AR}>{todayNice.day}</div>
            <div className="text-[12px] text-slate-400">{todayNice.week}</div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
          {[
            { color: BLUEPRINT.blue, label: 'Recognized Revenue · YTD', node: <Money v={rev.ytd} />, detail: <>Jan–{monthLabel(curMonth)} · earned only, no future months</> },
            { color: BLUEPRINT.blue, label: `This Month · ${monthLabel(curMonth)}`, node: <Money v={rev.monthLS + rev.monthTM} />, detail: <><b className="text-slate-600">{formatCompactCurrency(rev.monthLS)}</b> LS · <b className="text-slate-600">{formatCompactCurrency(rev.monthTM)}</b> T&M so far</> },
            { color: BLUEPRINT.copper, label: 'LS Run Rate', node: <><Money v={rev.runRate} /><span className="text-[15px] text-slate-400 font-semibold">/mo</span></>, detail: runRateDrop > 0 ? <>Drops to <b className="text-slate-600">{formatCompactCurrency(rev.runRate - runRateDrop)}</b> after {formatDateShort(renewals[0].project.end_date)} unless renewed</> : <>Active lump-sum scopes</> },
            { color: BLUEPRINT.midnight, label: 'Hours This Month', node: <Num v={hours.monthActual} />, detail: <><b className="text-slate-600">{Math.round(hours.monthBillable).toLocaleString()}</b> billable · {hours.activeCount} resource{hours.activeCount !== 1 ? 's' : ''} active</> },
          ].map((k, i) => (
            <div key={k.label} className="relative bg-white border border-slate-200 rounded-2xl px-5 py-4 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/[0.06]"
              style={{ animation: `bpRise .45s ease ${i * 0.06}s backwards` }}>
              <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: k.color }} />
              <div className="text-[10.5px] font-bold uppercase text-slate-400 mb-2" style={{ ...AR, letterSpacing: '0.12em' }}>{k.label}</div>
              <div className="text-[27px] font-extrabold text-slate-900 leading-none" style={AR}>{k.node}</div>
              <div className="text-[12px] text-slate-400 mt-2">{k.detail}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.9fr_1.1fr] gap-4">
          <div className="space-y-4">
            {/* MONTHLY CHART */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h3 className="text-[14px] font-bold text-slate-900" style={AR}>Revenue Recognized by Month</h3>
              <p className="text-[12px] text-slate-400 mb-4">Same engine as Projects — LS monthly fees + T&M hours × rates</p>
              <div className="flex items-end gap-2 h-[160px]">
                {monthly.map(m => (
                  <div key={m.mk} className="flex-1 h-full flex flex-col justify-end items-center min-w-0">
                    {!m.future && m.total > 0 && <div className="text-[9px] font-bold text-slate-500 mb-1 tabular-nums">{formatCompactCurrency(m.total)}</div>}
                    {m.future ? (
                      <div className="w-full max-w-[32px] h-full rounded-t-md border-[1.5px] border-dashed border-slate-200 border-b-0" />
                    ) : (
                      <div className="w-full max-w-[32px] rounded-t-md overflow-hidden flex flex-col justify-end transition-all hover:brightness-110"
                        style={{ height: `${Math.max((m.total / chartMax) * 100, m.total > 0 ? 3 : 0)}%`, outline: m.current ? `2px solid ${BLUEPRINT.emerald}` : 'none', outlineOffset: 2 }}
                        title={`${m.label}: ${formatCurrency(m.total)} (LS ${formatCurrency(m.ls)} · T&M ${formatCurrency(m.tm)})`}>
                        {m.tm > 0 && <div style={{ height: `${(m.tm / m.total) * 100}%`, background: BLUEPRINT.copper }} />}
                        {m.ls > 0 && <div style={{ height: `${(m.ls / m.total) * 100}%`, background: BLUEPRINT.blue }} />}
                      </div>
                    )}
                    <div className="text-[10px] font-semibold mt-1.5" style={{ color: m.future ? '#e2e8f0' : m.current ? BLUEPRINT.emerald : '#94a3b8' }}>{m.label}{m.current ? ' ●' : ''}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-3 text-[12px] text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: BLUEPRINT.blue }} />Lump Sum</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: BLUEPRINT.copper }} />T&M</span>
              </div>
            </div>

            {/* HOURS THIS WEEK */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h3 className="text-[14px] font-bold text-slate-900" style={AR}>Hours This Week · {formatDateShort(week.start)} – {formatDateShort(week.end)}</h3>
              <p className="text-[12px] text-slate-400 mb-4">Submitted so far · copper = nothing submitted yet</p>
              {weekRows.length === 0 ? <div className="py-6 text-center text-slate-400 text-sm">No active resources</div> : weekRows.map(r => (
                <div key={r.id} className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-[120px] text-[12.5px] font-semibold text-slate-700 truncate">{r.name}</div>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max((r.hrs / weekMax) * 100, r.hrs > 0 ? 2 : 0)}%`, background: r.hrs > 0 ? BLUEPRINT.blue : BLUEPRINT.copper }} />
                  </div>
                  <div className="w-[46px] text-right text-[12px] font-bold tabular-nums" style={{ color: r.hrs > 0 ? '#334155' : BLUEPRINT.copper }}>{r.hrs.toFixed(1)}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {/* ACTION ITEMS */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <div className="flex items-center gap-2">
                <h3 className="text-[14px] font-bold text-slate-900" style={AR}>Action Items</h3>
                <span className="ml-auto text-[11px] font-extrabold px-2.5 py-0.5 rounded-full" style={{ ...AR, background: actionItems.length > 0 ? BLUEPRINT.copperSoft : '#d1fae5', color: actionItems.length > 0 ? BLUEPRINT.copper : '#065f46' }}>{actionItems.length}</span>
              </div>
              <p className="text-[12px] text-slate-400 mb-2">Everything that needs a decision or a nudge</p>
              {actionItems.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">All clear — nothing pending 🎯</div>
              ) : actionItems.map((a, i) => (
                <div key={i} className="flex items-start gap-2.5 py-2.5 border-b border-slate-100 last:border-0">
                  <span className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: a.color }} />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-slate-900 leading-snug">{a.title}</div>
                    <div className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">{a.detail}</div>
                  </div>
                  <Link href={a.href} className="ml-auto shrink-0 text-[11px] font-bold px-2 py-1 rounded-md transition-colors hover:bg-blue-50" style={{ color: BLUEPRINT.blue }}>
                    {a.cta} →
                  </Link>
                </div>
              ))}
            </div>

            {/* PORTFOLIO SNAPSHOT */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h3 className="text-[14px] font-bold text-slate-900" style={AR}>Portfolio Snapshot</h3>
              <p className="text-[12px] text-slate-400 mb-3">Click through to any module</p>
              <div className="grid grid-cols-2 gap-2.5">
                {snapshot.map(s => (
                  <Link key={s.l} href={s.href} className="block bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-3 transition-all hover:border-blue-200 hover:bg-blue-50/60">
                    <div className="text-[20px] font-extrabold text-slate-900 tabular-nums" style={AR}>{s.n.toLocaleString()}</div>
                    <div className="text-[11px] font-semibold text-slate-500 mt-0.5">{s.l}</div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <style jsx global>{`
        @keyframes bpRise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  )
}
