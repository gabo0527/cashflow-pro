'use client'

// PROJECT DETAIL — Blueprint rebuild (revenue-only)
// LS: month-by-month recognition timeline with hard stop at end date.
// T&M: revenue from submitted hours × resolved rates (Time Tracking mirror).
// Removed: Financials/AR tab (dead QBO data), cost, margin, spent.

import React, { useMemo, useState, useEffect, useCallback } from 'react'
import { X, ArrowLeft, Clock, Users, BarChart3, Edit2, AlertTriangle, Layers, Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  BLUEPRINT, PROJECT_STATUSES, getContractType, getServiceLine,
  formatCurrency, formatCompactCurrency, formatDateShort,
  calcLSRecognition, entryRevenue, buildRateLookups, resolveBillRate,
  todayISO, monthKeyOf, monthLabel, monthRange, daysUntil, StatusBadge,
  getProjectPhases, phaseForDate, calcNteBurn, phaseLSRecognition,
  PHASE_LABELS, sortPhases,
} from './shared'
import type { ProjectPhase, PhaseTerms } from './shared'

const AR = { fontFamily: BLUEPRINT.fontDisplay }

interface ProjectDetailViewProps {
  project: any; client: any; timesheets: any[]
  expenses?: any[]   // legacy — unused (cost hidden)
  invoices?: any[]   // legacy — unused (dead QBO data)
  teamMembers: any[]; changeOrders: any[]
  billRates?: any[]; assignments?: any[]
  onClose: () => void; onEdit: () => void
}

export default function ProjectDetailView({
  project, client, timesheets, teamMembers, changeOrders, billRates = [], assignments = [], onClose, onEdit
}: ProjectDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'terms' | 'hours' | 'resources'>('overview')
  const [termRows, setTermRows] = useState<any[]>([])
  const [termsLoaded, setTermsLoaded] = useState(false)

  const loadTerms = useCallback(async () => {
    const { data, error } = await supabase.from('project_terms').select('*').eq('project_id', project.id).order('effective_start')
    if (!error) setTermRows(data || [])
    setTermsLoaded(true)
  }, [project.id])
  useEffect(() => { loadTerms() }, [loadTerms])

  const today = todayISO()
  const curMonth = monthKeyOf(today)
  const contractType = getContractType(project)
  const isLS = contractType === 'lump_sum'
  const serviceLine = getServiceLine(project)
  const { rateCardLookup, assignmentLookup } = useMemo(() => buildRateLookups(billRates, assignments), [billRates, assignments])

  const entries = useMemo(() => timesheets.filter(t => t.project_id === project.id), [timesheets, project.id])
  const phases = useMemo(() => getProjectPhases(project, termRows, today), [project, termRows, today])
  const currentPhase = useMemo(() => phaseForDate(phases, today), [phases, today])
  const hasRealTerms = termRows.length > 0
  const ls = useMemo(() => isLS ? calcLSRecognition(project, today) : null, [isLS, project, today])

  // Revenue totals
  // Phase-aware: LS months from lump_sum phases; T&M entries priced only when
  // their date falls under a T&M phase. With no terms rows, the fallback phase
  // mirrors the project's settings, so behavior matches the legacy engine.
  const rev = useMemo(() => {
    const lsPart = phaseLSRecognition(phases, project, today)
    let recognized = lsPart.recognized, thisMonth = lsPart.thisMonth
    entries.forEach(e => {
      const ph = phaseForDate(phases, (e.date || '').slice(0, 10))
      if (!ph || ph.terms === 'lump_sum') return
      const r = entryRevenue(e, project, rateCardLookup, assignmentLookup)
      recognized += r
      if (monthKeyOf(e.date) === curMonth) thisMonth += r
    })
    return { recognized, thisMonth }
  }, [phases, entries, project, rateCardLookup, assignmentLookup, curMonth, today])

  // Current-month NTE burn for the active phase (enforcement view)
  const monthBurn = useMemo(() => {
    if (!currentPhase || currentPhase.terms !== 'tm_nte' || !currentPhase.nte_amount) return null
    const mStart = `${curMonth}-01`
    const mEnd = today
    return calcNteBurn(currentPhase, project, entries, rateCardLookup, assignmentLookup, mStart, mEnd)
  }, [currentPhase, project, entries, rateCardLookup, assignmentLookup, curMonth, today])

  const coRecognized = useMemo(() => changeOrders.map(co => {
    const coLS = getContractType(co) === 'lump_sum' ? calcLSRecognition(co, today) : null
    if (coLS) return { co, recognized: coLS.recognized, note: `${formatCompactCurrency(coLS.monthlyFee)}/mo` }
    const coEntries = timesheets.filter(t => t.project_id === co.id)
    const r = coEntries.reduce((s, e) => s + entryRevenue(e, co, rateCardLookup, assignmentLookup), 0)
    return { co, recognized: r, note: 'T&M' }
  }), [changeOrders, timesheets, rateCardLookup, assignmentLookup, today])

  // Hours
  const hoursTotal = entries.reduce((s, e) => s + (e.hours || 0), 0)
  const billableTotal = entries.reduce((s, e) => s + (e.billable_hours != null ? e.billable_hours : (e.hours || 0)), 0)

  // ============ LS RECOGNITION TIMELINE (start → end, month by month) ============
  const lsTimeline = useMemo(() => {
    if (!isLS || !ls || ls.missingStartDate) return []
    const start = monthKeyOf((project.start_date || '').slice(0, 10))
    const endKey = ls.missingEndDate ? (curMonth > start ? curMonth : start) : monthKeyOf((project.end_date || '').slice(0, 10))
    return monthRange(start, endKey).map(mk => ({
      mk, label: monthLabel(mk), year: mk.slice(2, 4),
      recognized: ls.recognizedMonths.includes(mk),
      current: mk === curMonth,
    }))
  }, [isLS, ls, project, curMonth])

  // ============ T&M MONTHLY REVENUE ============
  const tmMonthly = useMemo(() => {
    if (isLS) return []
    const map: Record<string, number> = {}
    entries.forEach(e => { const mk = monthKeyOf(e.date); map[mk] = (map[mk] || 0) + entryRevenue(e, project, rateCardLookup, assignmentLookup) })
    return Object.entries(map).sort(([a], [b]) => a < b ? -1 : 1).slice(-12)
      .map(([mk, val]) => ({ mk, label: `${monthLabel(mk)} '${mk.slice(2, 4)}`, val, current: mk === curMonth }))
  }, [isLS, entries, project, rateCardLookup, assignmentLookup, curMonth])
  const tmMax = Math.max(...tmMonthly.map(m => m.val), 1)

  // ============ WEEKLY HOURS (last 8 Mon–Sun weeks, string math) ============
  const weeklyHours = useMemo(() => {
    const p = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const t = p(today); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)) // this week's Monday
    const weeks: { start: string; end: string; label: string; actual: number; billable: number }[] = []
    for (let i = 7; i >= 0; i--) {
      const ws = new Date(t); ws.setDate(ws.getDate() - i * 7)
      const we = new Date(ws); we.setDate(we.getDate() + 6)
      weeks.push({ start: iso(ws), end: iso(we), label: `${ws.getMonth() + 1}/${ws.getDate()}`, actual: 0, billable: 0 })
    }
    entries.forEach(e => {
      const d = (e.date || '').slice(0, 10)
      const w = weeks.find(w => d >= w.start && d <= w.end)
      if (w) { w.actual += e.hours || 0; w.billable += e.billable_hours != null ? e.billable_hours : (e.hours || 0) }
    })
    return weeks
  }, [entries, today])
  const whMax = Math.max(...weeklyHours.map(w => Math.max(w.actual, w.billable)), 1)

  // ============ RESOURCES ============
  const resources = useMemo(() => {
    const map: Record<string, { id: string; name: string; hours: number; billable: number; revenue: number; rate: number }> = {}
    entries.forEach(e => {
      const mid = e.contractor_id || e.user_id || ''
      if (!map[mid]) map[mid] = { id: mid, name: teamMembers.find(m => m.id === mid)?.name || 'Unknown', hours: 0, billable: 0, revenue: 0, rate: resolveBillRate(e, project, rateCardLookup, assignmentLookup) }
      map[mid].hours += e.hours || 0
      map[mid].billable += e.billable_hours != null ? e.billable_hours : (e.hours || 0)
      map[mid].revenue += entryRevenue(e, project, rateCardLookup, assignmentLookup)
    })
    return Object.values(map).sort((a, b) => b.hours - a.hours)
  }, [entries, teamMembers, project, rateCardLookup, assignmentLookup])

  const endDays = project.end_date ? daysUntil((project.end_date || '').slice(0, 10), today) : null
  const basis = isLS
    ? (ls && ls.monthlyFee > 0 ? `${formatCompactCurrency(ls.monthlyFee)} / mo` : 'No fee set')
    : (project.billing_model === 'per_scope' && project.bill_rate ? `$${project.bill_rate} / hr` : 'Resource rates')

  const kpi = (label: string, value: React.ReactNode, detail?: React.ReactNode, color = BLUEPRINT.blue) => (
    <div className="relative bg-white border border-slate-200 rounded-2xl px-5 py-4 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: color }} />
      <div className="text-[10.5px] font-bold uppercase text-slate-400 mb-2" style={{ ...AR, letterSpacing: '0.12em' }}>{label}</div>
      <div className="text-[24px] font-extrabold text-slate-900 leading-none tabular-nums" style={AR}>{value}</div>
      {detail && <div className="text-[12px] text-slate-400 mt-2">{detail}</div>}
    </div>
  )

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { id: 'terms' as const, label: 'Terms', icon: Layers },
    { id: 'hours' as const, label: 'Hours', icon: Clock },
    { id: 'resources' as const, label: 'Resources', icon: Users },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-slate-50 rounded-2xl w-full max-w-[1080px] shadow-2xl" style={{ animation: 'bpRise .3s ease' }}>
        {/* HEADER */}
        <div className="rounded-t-2xl px-6 pt-5 pb-4 text-white relative overflow-hidden" style={{ background: BLUEPRINT.midnight }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 8px)' }} />
          <div className="relative flex items-start gap-3">
            <button onClick={onClose} className="p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors mt-0.5"><ArrowLeft size={18} /></button>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase" style={{ ...AR, letterSpacing: '0.16em', color: '#93c5fd' }}>{client?.name || 'No Client'} · {serviceLine}</div>
              <h2 className="text-[22px] font-extrabold uppercase tracking-wide mt-0.5 truncate" style={AR}>{project.name}</h2>
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={project.status} />
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md" style={{ ...AR, background: currentPhase?.terms === 'lump_sum' ? BLUEPRINT.blueSoft : currentPhase?.terms === 'tm_nte' ? BLUEPRINT.copperSoft : '#f3e8ff', color: currentPhase?.terms === 'lump_sum' ? BLUEPRINT.blue : currentPhase?.terms === 'tm_nte' ? BLUEPRINT.copper : '#7c3aed' }}>{(PHASE_LABELS[currentPhase?.terms || (isLS ? 'lump_sum' : 'tm_open')] || '').toUpperCase()}</span>
                {currentPhase?.auto && <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800" style={AR}>AUTO · TERMS UNDEFINED</span>}
                <span className="text-[12px] text-slate-300">{basis}</span>
                {project.start_date && <span className="text-[12px] text-slate-400">· {formatDateShort(project.start_date)} → {project.end_date ? formatDateShort(project.end_date) : 'open'}</span>}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-semibold transition-colors hover:bg-white/20" style={{ background: 'rgba(255,255,255,0.1)' }}><Edit2 size={13} /> Edit</button>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors"><X size={18} /></button>
            </div>
          </div>
        </div>

        {/* NTE BURN ALERT — current month over 80% */}
        {monthBurn && monthBurn.pct != null && monthBurn.pct >= 80 && (
          <div className="mx-6 mt-4 rounded-xl border px-4 py-2.5 flex items-center gap-3 text-[12.5px]"
            style={monthBurn.pct > 100 ? { background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' } : { background: '#fff7ed', borderColor: '#fed7aa', color: '#9a3412' }}>
            <AlertTriangle size={15} className="shrink-0" style={{ color: monthBurn.pct > 100 ? '#dc2626' : BLUEPRINT.copper }} />
            <span><b>{monthLabel(curMonth)} NTE burn: {monthBurn.pct.toFixed(1)}%</b> — {formatCurrency(monthBurn.billed)} of {formatCurrency(currentPhase?.nte_amount || 0)} monthly cap{monthBurn.pct > 100 ? ` · OVER by ${formatCurrency(monthBurn.billed - (currentPhase?.nte_amount || 0))}` : ''}. Never capped — hours keep billing.</span>
            <button onClick={() => setActiveTab('terms')} className="ml-auto shrink-0 text-[11px] font-bold underline">View terms</button>
          </div>
        )}

        {/* FLAGS */}
        {isLS && ls && (ls.missingEndDate || ls.missingStartDate || ls.monthlyFee <= 0) && (
          <div className="mx-6 mt-4 rounded-xl border px-4 py-2.5 flex items-center gap-2.5 text-[12.5px] text-amber-800" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
            <AlertTriangle size={15} className="text-amber-500 shrink-0" />
            <span>
              {ls.monthlyFee <= 0 && <b>No monthly fee set. </b>}
              {ls.missingStartDate && <b>No start date. </b>}
              {ls.missingEndDate && !ls.missingStartDate && <b>No end date — recognition runs open-ended until one is set. </b>}
              Lump sum can't reconcile without fee + dates. <button onClick={onEdit} className="underline font-semibold">Fix in Edit</button>
            </span>
          </div>
        )}

        {/* KPI STRIP */}
        <div className="px-6 pt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpi('Recognized to Date', formatCompactCurrency(rev.recognized), isLS && ls ? `${ls.recognizedMonths.length} month${ls.recognizedMonths.length !== 1 ? 's' : ''} × ${formatCompactCurrency(ls.monthlyFee)}` : `${Math.round(billableTotal).toLocaleString()} billable hrs`)}
          {kpi(`This Month · ${monthLabel(curMonth)}`, formatCompactCurrency(rev.thisMonth), isLS ? 'Full month recognized once started' : 'Hours submitted so far × rate')}
          {kpi('Hours Logged', Math.round(hoursTotal).toLocaleString(), `${Math.round(billableTotal).toLocaleString()} billable`, BLUEPRINT.midnight)}
          {kpi('Ends', endDays == null ? '—' : endDays < 0 ? 'Ended' : `${endDays}d`, project.end_date ? formatDateShort(project.end_date) : 'No end date', endDays != null && endDays >= 0 && endDays <= 60 ? BLUEPRINT.copper : BLUEPRINT.midnight)}
        </div>

        {/* TABS */}
        <div className="px-6 mt-4 flex gap-1 border-b border-slate-200">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors"
              style={activeTab === t.id ? { color: BLUEPRINT.blue, borderColor: BLUEPRINT.blue } : { color: '#94a3b8', borderColor: 'transparent' }}>
              <t.icon size={14} /> {t.label}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-4">
          {/* ============ OVERVIEW ============ */}
          {activeTab === 'overview' && (
            <>
              {isLS && ls && lsTimeline.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <h3 className="text-[14px] font-bold text-slate-900" style={AR}>Recognition Timeline</h3>
                  <p className="text-[12px] text-slate-400 mb-4">
                    Each block = one month at {formatCompactCurrency(ls.monthlyFee)}. Solid = recognized. Recognition {ls.ended ? `stopped ${formatDateShort(project.end_date)}` : ls.missingEndDate ? 'runs open-ended (set an end date)' : `stops ${formatDateShort(project.end_date)}`}.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {lsTimeline.map(m => (
                      <div key={m.mk} title={`${m.label} '${m.year}${m.recognized ? ` — ${formatCurrency(ls.monthlyFee)}` : ' — not yet'}`}
                        className="w-[52px] rounded-lg px-1.5 py-2 text-center border transition-all"
                        style={m.recognized
                          ? { background: BLUEPRINT.blue, borderColor: BLUEPRINT.blue, color: '#fff', outline: m.current ? `2px solid ${BLUEPRINT.emerald}` : 'none', outlineOffset: 1 }
                          : { background: 'repeating-linear-gradient(135deg, rgba(148,163,184,0.07) 0 1px, transparent 1px 6px)', borderColor: '#e2e8f0', borderStyle: 'dashed', color: '#cbd5e1' }}>
                        <div className="text-[10.5px] font-bold" style={AR}>{m.label}</div>
                        <div className="text-[9px] opacity-70">'{m.year}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[13px]">
                    <span className="text-slate-500">{ls.recognizedMonths.length} of {ls.missingEndDate ? '?' : lsTimeline.length} months recognized</span>
                    <span className="font-extrabold text-slate-900 tabular-nums" style={AR}>{formatCurrency(ls.recognized)}{!ls.missingEndDate && <span className="text-slate-400 font-medium"> of {formatCurrency(lsTimeline.length * ls.monthlyFee)} contract</span>}</span>
                  </div>
                </div>
              )}

              {!isLS && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <h3 className="text-[14px] font-bold text-slate-900" style={AR}>Revenue by Month</h3>
                  <p className="text-[12px] text-slate-400 mb-4">Submitted hours × rate — nothing projected.</p>
                  {tmMonthly.length === 0 ? <div className="py-8 text-center text-slate-400 text-sm">No billable hours yet</div> : (
                    <div className="flex items-end gap-2 h-[150px]">
                      {tmMonthly.map(m => (
                        <div key={m.mk} className="flex-1 h-full flex flex-col justify-end items-center min-w-0">
                          <div className="text-[9.5px] font-bold text-slate-500 mb-1 tabular-nums">{formatCompactCurrency(m.val)}</div>
                          <div className="w-full max-w-[40px] rounded-t-md transition-all hover:brightness-110"
                            style={{ height: `${Math.max((m.val / tmMax) * 100, 3)}%`, background: BLUEPRINT.copper, outline: m.current ? `2px solid ${BLUEPRINT.emerald}` : 'none', outlineOffset: 2 }} />
                          <div className="text-[10px] font-semibold mt-1.5 text-slate-400 whitespace-nowrap">{m.label}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {coRecognized.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <h3 className="text-[14px] font-bold text-slate-900 mb-3" style={AR}>Change Orders</h3>
                  {coRecognized.map(({ co, recognized, note }) => (
                    <div key={co.id} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0 text-[13.5px]">
                      <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500" style={AR}>CO</span>
                      <span className="font-semibold text-slate-800 truncate">{co.name}</span>
                      <span className="text-[12px] text-slate-400">{note}{co.end_date ? ` · ends ${formatDateShort(co.end_date)}` : ''}</span>
                      <span className="ml-auto font-bold tabular-nums" style={AR}>{formatCompactCurrency(recognized)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ============ CONTRACT TERMS ============ */}
          {activeTab === 'terms' && (
            <TermsPanel project={project} phases={phases} termRows={termRows} entries={entries}
              rateCardLookup={rateCardLookup} assignmentLookup={assignmentLookup}
              today={today} onChanged={loadTerms} loaded={termsLoaded} />
          )}

          {/* ============ HOURS ============ */}
          {activeTab === 'hours' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h3 className="text-[14px] font-bold text-slate-900" style={AR}>Weekly Hours · last 8 weeks</h3>
              <p className="text-[12px] text-slate-400 mb-4">Mon–Sun weeks, matching Time Tracking. Actual (midnight) vs billable (blue).</p>
              <div className="flex items-end gap-3 h-[160px]">
                {weeklyHours.map(w => (
                  <div key={w.start} className="flex-1 h-full flex flex-col justify-end items-center">
                    <div className="w-full flex items-end justify-center gap-1 h-full">
                      <div className="w-[16px] rounded-t" title={`Actual: ${w.actual.toFixed(1)}h`} style={{ height: `${(w.actual / whMax) * 100}%`, background: BLUEPRINT.midnight, minHeight: w.actual > 0 ? 3 : 0 }} />
                      <div className="w-[16px] rounded-t" title={`Billable: ${w.billable.toFixed(1)}h`} style={{ height: `${(w.billable / whMax) * 100}%`, background: BLUEPRINT.blue, minHeight: w.billable > 0 ? 3 : 0 }} />
                    </div>
                    <div className="text-[10px] font-semibold mt-1.5 text-slate-400">{w.label}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-3 text-[12px] text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: BLUEPRINT.midnight }} />Actual submitted</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: BLUEPRINT.blue }} />Billable (after review)</span>
              </div>
            </div>
          )}

          {/* ============ RESOURCES ============ */}
          {activeTab === 'resources' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h3 className="text-[14px] font-bold text-slate-900 mb-3" style={AR}>Resources on Project</h3>
              {resources.length === 0 ? <div className="py-8 text-center text-slate-400 text-sm">No hours submitted yet</div> : (
                <table className="w-full text-[13.5px]">
                  <thead>
                    <tr className="text-[10.5px] font-bold uppercase text-slate-400" style={{ letterSpacing: '0.1em' }}>
                      <th className="text-left py-2 border-b border-slate-100">Resource</th>
                      <th className="text-right py-2 border-b border-slate-100">Actual Hrs</th>
                      <th className="text-right py-2 border-b border-slate-100">Billable Hrs</th>
                      {!isLS && <th className="text-right py-2 border-b border-slate-100">Rate</th>}
                      {!isLS && <th className="text-right py-2 border-b border-slate-100">Revenue</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {resources.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-2.5 border-b border-slate-50 font-semibold text-slate-800">{r.name}</td>
                        <td className="py-2.5 border-b border-slate-50 text-right tabular-nums">{r.hours.toFixed(1)}</td>
                        <td className="py-2.5 border-b border-slate-50 text-right tabular-nums">{r.billable.toFixed(1)}</td>
                        {!isLS && <td className="py-2.5 border-b border-slate-50 text-right tabular-nums text-slate-500">{r.rate > 0 ? `$${r.rate}` : '—'}</td>}
                        {!isLS && <td className="py-2.5 border-b border-slate-50 text-right font-bold tabular-nums" style={AR}>{formatCompactCurrency(r.revenue)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {isLS && <p className="text-[11.5px] text-slate-400 mt-3">Lump sum scope — revenue comes from the monthly fee, not hours. Hours shown for utilization reference only.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


// ============ CONTRACT TERMS PANEL ============
// Phases CRUD on project_terms. NTE is MONTHLY; burn is range-aware, never capped.
function TermsPanel({ project, phases, termRows, entries, rateCardLookup, assignmentLookup, today, onChanged, loaded }: {
  project: any; phases: ProjectPhase[]; termRows: any[]; entries: any[]
  rateCardLookup: Record<string, any>; assignmentLookup: Record<string, any>
  today: string; onChanged: () => void; loaded: boolean
}) {
  const empty = { terms: 'tm_nte' as PhaseTerms, effective_start: '', effective_end: '', amount: '' }
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState(empty)
  const [saving, setSaving] = useState(false)

  const startEdit = (row: any) => {
    setForm({
      terms: row.terms,
      effective_start: (row.effective_start || '').slice(0, 10),
      effective_end: row.effective_end ? (row.effective_end || '').slice(0, 10) : '',
      amount: (row.terms === 'lump_sum' ? row.monthly_fee : row.nte_amount)?.toString() || '',
    })
    setEditing(row.id)
  }
  const startNew = () => {
    // Prefill start = day after the last saved phase's end (if any)
    const saved = sortPhases(phases.filter(p => !p.auto))
    const last = saved[saved.length - 1]
    let start = ''
    if (last?.effective_end) {
      const [y, m, d] = last.effective_end.split('-').map(Number)
      const nx = new Date(y, m - 1, d); nx.setDate(nx.getDate() + 1)
      start = `${nx.getFullYear()}-${String(nx.getMonth() + 1).padStart(2, '0')}-${String(nx.getDate()).padStart(2, '0')}`
    }
    setForm({ ...empty, effective_start: start })
    setEditing('new')
  }

  const save = async () => {
    if (!form.effective_start) { alert('Start date is required.'); return }
    const amt = parseFloat(form.amount) || null
    if (form.terms === 'tm_nte' && !amt) { alert('NTE phases need a monthly NTE amount.'); return }
    if (form.terms === 'lump_sum' && !amt) { alert('Lump sum phases need a monthly fee.'); return }
    setSaving(true)
    const payload: any = {
      terms: form.terms,
      effective_start: form.effective_start,
      effective_end: form.effective_end || null,
      nte_amount: form.terms === 'tm_nte' ? amt : null,
      monthly_fee: form.terms === 'lump_sum' ? amt : null,
    }
    let error
    if (editing === 'new') {
      payload.project_id = project.id
      payload.company_id = project.company_id || null
      ;({ error } = await supabase.from('project_terms').insert(payload))
    } else {
      ;({ error } = await supabase.from('project_terms').update(payload).eq('id', editing))
    }
    setSaving(false)
    if (error) { alert(`Error: ${error.message}`); return }
    setEditing(null); setForm(empty); onChanged()
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this phase? Billing history is not affected, but burn/recognition for its window will recalculate.')) return
    const { error } = await supabase.from('project_terms').delete().eq('id', id)
    if (error) { alert(`Error: ${error.message}`); return }
    onChanged()
  }

  const statusOf = (ph: ProjectPhase) => {
    if (ph.auto) return { label: 'AUTO · TERMS UNDEFINED', bg: '#fef3c7', color: '#92400e' }
    if (ph.effective_start > today) return { label: 'UPCOMING', bg: '#f1f5f9', color: '#64748b' }
    if (ph.effective_end && ph.effective_end < today) return { label: 'ENDED', bg: '#f1f5f9', color: '#64748b' }
    return { label: 'ACTIVE', bg: '#d1fae5', color: '#065F46' }
  }
  const termsColor = (t: PhaseTerms) => t === 'lump_sum'
    ? { bg: BLUEPRINT.blueSoft, color: BLUEPRINT.blue }
    : t === 'tm_nte' ? { bg: BLUEPRINT.copperSoft, color: BLUEPRINT.copper } : { bg: '#f3e8ff', color: '#7c3aed' }

  const inputCls = 'bg-white border border-slate-200 rounded-lg text-[13px] text-slate-900 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 outline-none w-full px-2.5 py-1.5'

  const editorRow = (
    <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-4 mb-2.5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-[10.5px] font-bold text-slate-500 mb-1 uppercase" style={AR}>Terms</label>
          <select value={form.terms} onChange={e => setForm(f => ({ ...f, terms: e.target.value as PhaseTerms }))} className={inputCls}>
            <option value="tm_nte">T&M with NTE</option>
            <option value="tm_open">Open T&M</option>
            <option value="lump_sum">Lump Sum</option>
          </select>
        </div>
        <div>
          <label className="block text-[10.5px] font-bold text-slate-500 mb-1 uppercase" style={AR}>Start</label>
          <input type="date" value={form.effective_start} onChange={e => setForm(f => ({ ...f, effective_start: e.target.value }))} className={inputCls} />
        </div>
        <div>
          <label className="block text-[10.5px] font-bold text-slate-500 mb-1 uppercase" style={AR}>End <span className="normal-case font-medium text-slate-400">(blank = open)</span></label>
          <input type="date" value={form.effective_end} onChange={e => setForm(f => ({ ...f, effective_end: e.target.value }))} className={inputCls} />
        </div>
        {form.terms !== 'tm_open' && (
          <div>
            <label className="block text-[10.5px] font-bold text-slate-500 mb-1 uppercase" style={AR}>{form.terms === 'tm_nte' ? 'Monthly NTE ($)' : 'Monthly Fee ($)'}</label>
            <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder={form.terms === 'tm_nte' ? 'e.g. 23000' : 'e.g. 14000'} className={inputCls} />
          </div>
        )}
      </div>
      {form.terms === 'tm_nte' && <p className="text-[11px] text-slate-500 mt-2">Monthly cap — burn resets every month. Never blocks billing; over 100% shows red.</p>}
      {form.terms === 'lump_sum' && <p className="text-[11px] text-slate-500 mt-2">Monthly fee, recognized in full once each month starts. Stops at phase end.</p>}
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={() => { setEditing(null); setForm(empty) }} className="px-3 py-1.5 text-[12px] font-semibold text-slate-500 hover:text-slate-700">Cancel</button>
        <button onClick={save} disabled={saving} className="px-3.5 py-1.5 rounded-lg text-[12px] font-bold text-white disabled:opacity-50" style={{ background: BLUEPRINT.blue }}>{saving ? 'Saving…' : editing === 'new' ? 'Add Phase' : 'Save Phase'}</button>
      </div>
    </div>
  )

  // Burn detail for the NTE phase covering today (or the most recent one)
  const burnPhase = phases.filter(p => p.terms === 'tm_nte' && p.nte_amount).slice(-1)[0] || null
  const burn = useMemo(() => {
    if (!burnPhase) return null
    const end = burnPhase.effective_end && burnPhase.effective_end < today ? burnPhase.effective_end : today
    return calcNteBurn(burnPhase, project, entries, rateCardLookup, assignmentLookup, burnPhase.effective_start, end)
  }, [burnPhase, project, entries, rateCardLookup, assignmentLookup, today])

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center">
          <div>
            <h3 className="text-[14px] font-bold text-slate-900" style={AR}>Contract Terms</h3>
            <p className="text-[12px] text-slate-400">Billing phases over the project's life — history is never overwritten</p>
          </div>
          {editing === null && (
            <button onClick={startNew} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold text-white" style={{ background: BLUEPRINT.blue }}>
              <Plus size={13} /> Add Phase
            </button>
          )}
        </div>
        <div className="mt-4">
          {!loaded ? <div className="py-6 text-center text-slate-400 text-sm animate-pulse">Loading terms…</div> : (
            <>
              {editing === 'new' && editorRow}
              {phases.map((ph, i) => {
                const st = statusOf(ph)
                const tc = termsColor(ph.terms)
                if (editing && editing === ph.id) return <React.Fragment key={ph.id || i}>{editorRow}</React.Fragment>
                return (
                  <div key={ph.id || `auto-${i}`} className={`flex items-center gap-3.5 px-4 py-3 border rounded-xl mb-2 ${st.label === 'ACTIVE' ? 'border-blue-200 bg-blue-50/30' : 'border-slate-200 bg-white'}`}>
                    <span className="w-[22px] h-[22px] rounded-lg flex items-center justify-center text-[11px] font-extrabold text-white shrink-0" style={{ ...AR, background: st.label === 'ACTIVE' ? BLUEPRINT.blue : '#94a3b8' }}>{i + 1}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13.5px] font-bold text-slate-900">{PHASE_LABELS[ph.terms]}</span>
                        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full" style={{ ...AR, background: tc.bg, color: tc.color }}>{ph.terms === 'tm_nte' ? 'NTE' : ph.terms === 'lump_sum' ? 'LS' : 'OPEN'}</span>
                        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full" style={{ ...AR, background: st.bg, color: st.color }}>{st.label}</span>
                      </div>
                      <div className="text-[11.5px] text-slate-500 mt-0.5">{formatDateShort(ph.effective_start)} → {ph.effective_end ? formatDateShort(ph.effective_end) : 'open'}</div>
                    </div>
                    <div className="ml-auto text-right shrink-0">
                      <div className="text-[14px] font-extrabold tabular-nums" style={AR}>
                        {ph.terms === 'tm_open' ? <span className="text-slate-400">—</span> : formatCompactCurrency((ph.terms === 'tm_nte' ? ph.nte_amount : ph.monthly_fee) || 0)}
                        {ph.terms !== 'tm_open' && <span className="text-[10px] text-slate-400 font-semibold">/mo{ph.terms === 'tm_nte' ? ' NTE' : ''}</span>}
                      </div>
                    </div>
                    {!ph.auto && ph.id && editing === null && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => startEdit(termRows.find(r => r.id === ph.id))} title="Edit" className="p-1.5 rounded-md hover:bg-slate-100 text-slate-500"><Edit2 size={13} /></button>
                        <button onClick={() => remove(ph.id!)} title="Delete" className="p-1.5 rounded-md hover:bg-rose-50 text-slate-500 hover:text-rose-600"><Trash2 size={13} /></button>
                      </div>
                    )}
                    {ph.auto && <button onClick={startNew} className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-md" style={{ color: BLUEPRINT.blue, background: BLUEPRINT.blueSoft }}>Define →</button>}
                  </div>
                )
              })}
            </>
          )}
        </div>
      </div>

      {burnPhase && burn && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="text-[14px] font-bold text-slate-900" style={AR}>Monthly NTE Burn · {formatCompactCurrency(burnPhase.nte_amount || 0)}/mo cap</h3>
          <p className="text-[12px] text-slate-400 mb-4">Each month scored against its own cap. Copper ≥80% · red over 100% · never capped.</p>
          <div className="space-y-2.5">
            {burn.months.map(m => {
              const pct = m.pct || 0
              const color = pct > 100 ? '#dc2626' : pct >= 80 ? BLUEPRINT.copper : BLUEPRINT.blue
              return (
                <div key={m.mk} className="flex items-center gap-3">
                  <div className="w-[64px] text-[12px] font-bold text-slate-600" style={AR}>{monthLabel(m.mk)} '{m.mk.slice(2, 4)}</div>
                  <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden relative">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
                    <div className="absolute top-[-2px] bottom-[-2px] w-[2px] bg-slate-900/25" style={{ left: '80%' }} />
                  </div>
                  <div className="w-[150px] text-right text-[12px] tabular-nums">
                    <b style={{ color: pct > 100 ? '#dc2626' : '#334155' }}>{formatCompactCurrency(m.billed)}</b>
                    <span className="text-slate-400"> / {formatCompactCurrency(m.nte || 0)} · </span>
                    <b style={{ ...AR, color }}>{pct.toFixed(0)}%</b>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[13px]">
            <span className="text-slate-500">Phase to date · {burn.months.length} month{burn.months.length !== 1 ? 's' : ''}</span>
            <span className="font-extrabold tabular-nums" style={{ ...AR, color: burn.over ? '#dc2626' : '#0f172a' }}>
              {formatCurrency(burn.billed)} of {formatCurrency(burn.denom)} · {burn.pct?.toFixed(1)}%{burn.over ? ` · OVER by ${formatCurrency(burn.billed - burn.denom)}` : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
