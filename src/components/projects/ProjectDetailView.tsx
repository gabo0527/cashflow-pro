'use client'

// PROJECT DETAIL — Blueprint rebuild (revenue-only)
// LS: month-by-month recognition timeline with hard stop at end date.
// T&M: revenue from submitted hours × resolved rates (Time Tracking mirror).
// Removed: Financials/AR tab (dead QBO data), cost, margin, spent.

import React, { useMemo, useState } from 'react'
import { X, ArrowLeft, Clock, Users, BarChart3, Edit2, AlertTriangle } from 'lucide-react'
import {
  BLUEPRINT, PROJECT_STATUSES, getContractType, getServiceLine,
  formatCurrency, formatCompactCurrency, formatDateShort,
  calcLSRecognition, entryRevenue, buildRateLookups, resolveBillRate,
  todayISO, monthKeyOf, monthLabel, monthRange, daysUntil, StatusBadge,
} from './shared'

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
  const [activeTab, setActiveTab] = useState<'overview' | 'hours' | 'resources'>('overview')

  const today = todayISO()
  const curMonth = monthKeyOf(today)
  const contractType = getContractType(project)
  const isLS = contractType === 'lump_sum'
  const serviceLine = getServiceLine(project)
  const { rateCardLookup, assignmentLookup } = useMemo(() => buildRateLookups(billRates, assignments), [billRates, assignments])

  const entries = useMemo(() => timesheets.filter(t => t.project_id === project.id), [timesheets, project.id])
  const ls = useMemo(() => isLS ? calcLSRecognition(project, today) : null, [isLS, project, today])

  // Revenue totals
  const rev = useMemo(() => {
    if (isLS && ls) return { recognized: ls.recognized, thisMonth: ls.recognizedMonths.includes(curMonth) ? ls.monthlyFee : 0 }
    let recognized = 0, thisMonth = 0
    entries.forEach(e => {
      const r = entryRevenue(e, project, rateCardLookup, assignmentLookup)
      recognized += r
      if (monthKeyOf(e.date) === curMonth) thisMonth += r
    })
    return { recognized, thisMonth }
  }, [isLS, ls, entries, project, rateCardLookup, assignmentLookup, curMonth])

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
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md" style={{ ...AR, background: isLS ? BLUEPRINT.blueSoft : '#f3e8ff', color: isLS ? BLUEPRINT.blue : '#7c3aed' }}>{isLS ? 'LUMP SUM' : 'T&M'}</span>
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
