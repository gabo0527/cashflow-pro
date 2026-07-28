'use client'

// PROJECTS DASHBOARD — Blueprint rebuild (revenue-only)
// LS: monthly fee recognized once a month starts, hard stop at end date.
// T&M: billable_hours ?? hours × resolved rate (exact Time Tracking mirror).
// No cost, no margin, no invoices/AR — cost layers in later, admin-only.

import React, { useMemo, useState, useEffect, useRef } from 'react'
import { FolderKanban, AlertTriangle } from 'lucide-react'
import {
  THEME, BLUEPRINT, SlicerButton, EmptyState,
  getContractType, getServiceLine, SERVICE_LINE_COLORS,
  formatCurrency, formatCompactCurrency,
  calcLSRecognition, entryRevenue, buildRateLookups,
  getRenewalWatch, todayISO, monthKeyOf, monthLabel, monthRange, formatDateShort,
} from './shared'

const AR = { fontFamily: BLUEPRINT.fontDisplay }

// Lightweight count-up for KPI values
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

function KpiValue({ amount, compact = true }: { amount: number; compact?: boolean }) {
  const v = useCountUp(amount)
  return <span className="tabular-nums">{compact ? formatCompactCurrency(v) : formatCurrency(v)}</span>
}

interface Props {
  projects: any[]
  clients: any[]
  timesheets: any[]
  billRates?: any[]
  assignments?: any[]
  expenses?: any[]   // legacy prop — unused (cost hidden)
  invoices?: any[]   // legacy prop — unused (dead QBO data)
  onDrillDown: (type: string, id: string) => void
}

type Period = 'this_month' | 'qtd' | 'ytd' | 'all'
const PERIOD_LABELS: Record<Period, string> = { this_month: 'This Month', qtd: 'Quarter to Date', ytd: 'Year to Date', all: 'All Time' }

export default function DashboardSection({ projects, clients, timesheets, billRates = [], assignments = [], onDrillDown }: Props) {
  const [selectedClient, setSelectedClient] = useState('all')
  const [period, setPeriod] = useState<Period>('ytd')

  const today = todayISO()
  const curMonth = monthKeyOf(today)
  const curYear = today.slice(0, 4)

  // Months included in the selected period (through the current month — never future)
  const periodMonths = useMemo(() => {
    if (period === 'this_month') return [curMonth]
    if (period === 'qtd') {
      const m = Number(curMonth.slice(5, 7)); const qStart = m - ((m - 1) % 3)
      return monthRange(`${curYear}-${String(qStart).padStart(2, '0')}`, curMonth)
    }
    if (period === 'ytd') return monthRange(`${curYear}-01`, curMonth)
    return null // all time
  }, [period, curMonth, curYear])

  const { rateCardLookup, assignmentLookup } = useMemo(() => buildRateLookups(billRates, assignments), [billRates, assignments])
  const projectById = useMemo(() => { const m: Record<string, any> = {}; projects.forEach(p => { m[p.id] = p }); return m }, [projects])
  const clientById = useMemo(() => { const m: Record<string, any> = {}; clients.forEach(c => { m[c.id] = c }); return m }, [clients])

  // Scope: client slicer applies everywhere; prospects/archived never earn LS recognition
  const scopedProjects = useMemo(() => projects.filter(p =>
    (selectedClient === 'all' || p.client_id === selectedClient)
  ), [projects, selectedClient])
  const revenueProjects = useMemo(() => scopedProjects.filter(p => !['prospect', 'archived'].includes(p.status || 'active')), [scopedProjects])

  const scopedEntries = useMemo(() => timesheets.filter(e => {
    const p = projectById[e.project_id]
    if (!p) return false
    if (selectedClient !== 'all' && p.client_id !== selectedClient) return false
    return true
  }), [timesheets, projectById, selectedClient])

  // ============ PER-PROJECT REVENUE (period-aware) ============
  const perProject = useMemo(() => {
    const inPeriod = (mk: string) => !periodMonths || periodMonths.includes(mk)
    const map: Record<string, { project: any; type: string; recognized: number; thisMonth: number; hours: number }> = {}
    revenueProjects.forEach(p => {
      map[p.id] = { project: p, type: getContractType(p), recognized: 0, thisMonth: 0, hours: 0 }
      if (getContractType(p) === 'lump_sum') {
        const ls = calcLSRecognition(p, today)
        const counted = ls.recognizedMonths.filter(inPeriod)
        map[p.id].recognized = counted.length * ls.monthlyFee
        map[p.id].thisMonth = ls.recognizedMonths.includes(curMonth) ? ls.monthlyFee : 0
      }
    })
    scopedEntries.forEach(e => {
      const row = map[e.project_id]
      if (!row) return
      row.hours += e.hours || 0
      if (row.type !== 'lump_sum') {
        const mk = monthKeyOf(e.date)
        const rev = entryRevenue(e, row.project, rateCardLookup, assignmentLookup)
        if (inPeriod(mk)) row.recognized += rev
        if (mk === curMonth) row.thisMonth += rev
      }
    })
    return Object.values(map)
  }, [revenueProjects, scopedEntries, periodMonths, rateCardLookup, assignmentLookup, today, curMonth])

  // ============ KPIS ============
  const kpis = useMemo(() => {
    const active = revenueProjects.filter(p => p.status === 'active' && !p.is_change_order)
    const lsCount = active.filter(p => getContractType(p) === 'lump_sum').length
    const recognized = perProject.reduce((s, r) => s + r.recognized, 0)
    const monthLS = perProject.filter(r => r.type === 'lump_sum').reduce((s, r) => s + r.thisMonth, 0)
    const monthTM = perProject.filter(r => r.type !== 'lump_sum').reduce((s, r) => s + r.thisMonth, 0)
    // Run rate: sum of monthly fees on active, unexpired LS scopes
    const runningLS = revenueProjects.filter(p => p.status === 'active' && getContractType(p) === 'lump_sum')
      .map(p => calcLSRecognition(p, today)).filter(ls => !ls.ended)
    const runRate = runningLS.reduce((s, ls) => s + ls.monthlyFee, 0)
    return { activeCount: active.length, lsCount, tmCount: active.length - lsCount, recognized, monthLS, monthTM, runRate }
  }, [revenueProjects, perProject, today])

  // Renewal watch + data-quality flags
  const renewals = useMemo(() => getRenewalWatch(scopedProjects, today, 60), [scopedProjects, today])
  const missingEnd = useMemo(() => revenueProjects.filter(p =>
    p.status === 'active' && getContractType(p) === 'lump_sum' && !p.end_date && (p.fixed_amount || 0) > 0
  ), [revenueProjects, today])
  const runRateAfter = useMemo(() => {
    if (renewals.length === 0) return null
    const expiring = renewals.reduce((s, r) => s + (r.project.fixed_amount || 0), 0)
    return { drop: kpis.runRate - expiring, firstDate: renewals[0].project.end_date }
  }, [renewals, kpis.runRate])

  // ============ MONTHLY RECOGNITION CHART (current year, ghost future) ============
  const monthly = useMemo(() => {
    const months = monthRange(`${curYear}-01`, `${curYear}-12`)
    return months.map(mk => {
      let ls = 0, tm = 0
      if (mk <= curMonth) {
        revenueProjects.forEach(p => {
          if (getContractType(p) === 'lump_sum') {
            const rec = calcLSRecognition(p, today)
            if (rec.recognizedMonths.includes(mk)) ls += rec.monthlyFee
          }
        })
        scopedEntries.forEach(e => {
          const p = projectById[e.project_id]
          if (p && getContractType(p) !== 'lump_sum' && monthKeyOf(e.date) === mk)
            tm += entryRevenue(e, p, rateCardLookup, assignmentLookup)
        })
      }
      return { mk, label: monthLabel(mk), ls, tm, total: ls + tm, future: mk > curMonth, current: mk === curMonth }
    })
  }, [curYear, curMonth, revenueProjects, scopedEntries, projectById, rateCardLookup, assignmentLookup, today])
  const chartMax = Math.max(...monthly.map(m => m.total), 1)

  // ============ SERVICE LINE + CLIENT BREAKDOWNS ============
  const byServiceLine = useMemo(() => {
    const map: Record<string, number> = {}
    perProject.forEach(r => { const sl = getServiceLine(r.project); map[sl] = (map[sl] || 0) + r.recognized })
    return Object.entries(map).map(([name, val]) => ({ name, val })).filter(x => x.val > 0).sort((a, b) => b.val - a.val)
  }, [perProject])
  const slMax = Math.max(...byServiceLine.map(s => s.val), 1)

  const byClient = useMemo(() => {
    const map: Record<string, { id: string; name: string; count: number; ls: number; tm: number; recognized: number; thisMonth: number }> = {}
    perProject.forEach(r => {
      const cid = r.project.client_id || 'none'
      if (!map[cid]) map[cid] = { id: cid, name: clientById[cid]?.name || 'Unassigned', count: 0, ls: 0, tm: 0, recognized: 0, thisMonth: 0 }
      if (!r.project.is_change_order) { map[cid].count++; r.type === 'lump_sum' ? map[cid].ls++ : map[cid].tm++ }
      map[cid].recognized += r.recognized
      map[cid].thisMonth += r.thisMonth
    })
    return Object.values(map).sort((a, b) => b.recognized - a.recognized)
  }, [perProject, clientById])
  const totalRecognized = byClient.reduce((s, c) => s + c.recognized, 0)
  const totalThisMonth = byClient.reduce((s, c) => s + c.thisMonth, 0)

  const clientOptions = [{ id: 'all', label: 'All Clients' }, ...clients.map(c => ({ id: c.id, label: c.name }))]
  const periodOptions = (Object.keys(PERIOD_LABELS) as Period[]).map(p => ({ id: p, label: PERIOD_LABELS[p] }))

  const kpiCards = [
    { label: 'Active Projects', color: BLUEPRINT.midnight, node: <span className="tabular-nums">{kpis.activeCount}</span>, detail: <><b className="text-slate-600">{kpis.lsCount}</b> Lump Sum · <b className="text-slate-600">{kpis.tmCount}</b> T&M</> },
    { label: `Recognized · ${PERIOD_LABELS[period]}`, color: BLUEPRINT.blue, node: <KpiValue amount={kpis.recognized} />, detail: <>Earned to date only — no future months</> },
    { label: `This Month · ${monthLabel(curMonth)}`, color: BLUEPRINT.blue, node: <KpiValue amount={kpis.monthLS + kpis.monthTM} />, detail: <><b className="text-slate-600">{formatCompactCurrency(kpis.monthLS)}</b> LS · <b className="text-slate-600">{formatCompactCurrency(kpis.monthTM)}</b> T&M so far</> },
    { label: 'LS Run Rate', color: BLUEPRINT.copper, node: <><KpiValue amount={kpis.runRate} /><span className="text-base text-slate-400 font-semibold">/mo</span></>, detail: runRateAfter ? <>Drops to <b className="text-slate-600">{formatCompactCurrency(runRateAfter.drop)}</b> after {formatDateShort(runRateAfter.firstDate)} unless renewed</> : <>Active lump-sum scopes</> },
  ]

  return (
    <div className="space-y-5">
      {/* RENEWAL WATCH */}
      {(renewals.length > 0 || missingEnd.length > 0) && (
        <div className="rounded-xl border px-4 py-3 flex items-start gap-3 text-[13px]"
          style={{ background: '#fff7ed', borderColor: '#fed7aa', borderLeft: `3px solid ${BLUEPRINT.copper}` }}>
          <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: BLUEPRINT.copper }} />
          <div className="text-[#9a3412] leading-relaxed">
            {renewals.length > 0 && (
              <div><b>{renewals.length} lump-sum scope{renewals.length > 1 ? 's' : ''} end{renewals.length === 1 ? 's' : ''} within 60 days</b> — {renewals.map(r => `${r.project.name} (${formatDateShort(r.project.end_date)} · ${r.days}d)`).join(', ')}. Revenue stops accruing at end date.</div>
            )}
            {missingEnd.length > 0 && (
              <div className="mt-0.5"><b>{missingEnd.length} lump-sum scope{missingEnd.length > 1 ? 's have' : ' has'} no end date</b> — {missingEnd.map(p => p.name).join(', ')}. LS can't reconcile without one; recognition runs open-ended until set.</div>
            )}
          </div>
          <span className="ml-auto shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
            style={{ color: BLUEPRINT.copper, background: BLUEPRINT.copperSoft, ...AR, letterSpacing: '0.08em' }}>RENEWAL WATCH</span>
        </div>
      )}

      {/* SLICERS */}
      <div className="flex flex-wrap gap-2">
        <SlicerButton label="Client" value={selectedClient} options={clientOptions} onChange={setSelectedClient} />
        <SlicerButton label="Period" value={period} options={periodOptions} onChange={(v) => setPeriod(v as Period)} />
      </div>

      {/* KPI STRIP */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {kpiCards.map((k, i) => (
          <div key={k.label} className="relative bg-white border border-slate-200 rounded-2xl px-5 py-4 overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-900/[0.06]"
            style={{ animation: `bpRise .45s ease ${i * 0.06}s backwards` }}>
            <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: k.color }} />
            <div className="text-[10.5px] font-bold uppercase text-slate-400 mb-2" style={{ ...AR, letterSpacing: '0.12em' }}>{k.label}</div>
            <div className="text-[28px] font-extrabold text-slate-900 leading-none" style={AR}>{k.node}</div>
            <div className="text-[12px] text-slate-400 mt-2">{k.detail}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* MONTHLY RECOGNITION */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="text-[14px] font-bold text-slate-900" style={AR}>Revenue Recognized by Month</h3>
          <p className="text-[12px] text-slate-400 mb-4">Only months that have occurred count — future months stay empty until they happen.</p>
          <div className="flex items-end gap-2 h-[180px]">
            {monthly.map(m => (
              <div key={m.mk} className="flex-1 h-full flex flex-col justify-end items-center min-w-0">
                {!m.future && m.total > 0 && <div className="text-[9.5px] font-bold text-slate-500 mb-1 tabular-nums">{formatCompactCurrency(m.total)}</div>}
                {m.future ? (
                  <div className="w-full max-w-[34px] h-full rounded-t-md border-[1.5px] border-dashed border-slate-200 border-b-0" style={{ background: 'repeating-linear-gradient(135deg, rgba(148,163,184,0.05) 0 1px, transparent 1px 7px)' }} />
                ) : (
                  <div className="w-full max-w-[34px] rounded-t-md overflow-hidden flex flex-col justify-end transition-all hover:brightness-110"
                    style={{ height: `${Math.max((m.total / chartMax) * 100, m.total > 0 ? 3 : 0)}%`, outline: m.current ? `2px solid ${BLUEPRINT.emerald}` : 'none', outlineOffset: 2 }}
                    title={`${m.label}: ${formatCurrency(m.total)} (LS ${formatCurrency(m.ls)} · T&M ${formatCurrency(m.tm)})`}>
                    {m.tm > 0 && <div style={{ height: `${(m.tm / m.total) * 100}%`, background: BLUEPRINT.copper }} />}
                    {m.ls > 0 && <div style={{ height: `${(m.ls / m.total) * 100}%`, background: BLUEPRINT.blue }} />}
                  </div>
                )}
                <div className={`text-[10.5px] font-semibold mt-1.5 ${m.current ? 'font-bold' : ''}`} style={{ color: m.future ? '#e2e8f0' : m.current ? BLUEPRINT.emerald : '#94a3b8' }}>{m.label}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3.5 text-[12px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: BLUEPRINT.blue }} />Lump Sum (monthly fee)</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: BLUEPRINT.copper }} />T&M (hours × rate)</span>
            <span className="ml-auto text-[10px] font-bold" style={{ color: BLUEPRINT.emerald, letterSpacing: '0.1em', ...AR }}>● CURRENT MONTH</span>
          </div>
        </div>

        {/* SERVICE LINE */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="text-[14px] font-bold text-slate-900" style={AR}>Revenue by Service Line</h3>
          <p className="text-[12px] text-slate-400 mb-4">{PERIOD_LABELS[period]} recognized</p>
          {byServiceLine.length === 0 ? <EmptyState icon={FolderKanban} message="No recognized revenue yet" /> : (
            <div className="space-y-3">
              {byServiceLine.map(sl => (
                <div key={sl.name} className="flex items-center gap-2.5">
                  <div className="w-[120px] text-[12.5px] font-medium text-slate-700 truncate">{sl.name}</div>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(sl.val / slMax) * 100}%`, background: SERVICE_LINE_COLORS[sl.name] || BLUEPRINT.blue }} />
                  </div>
                  <div className="w-[60px] text-right text-[12px] font-bold text-slate-700 tabular-nums" style={AR}>{formatCompactCurrency(sl.val)}</div>
                </div>
              ))}
              <div className="pt-3 mt-1 border-t border-slate-100 flex justify-between text-[13px]">
                <span className="text-slate-500 font-semibold">Total recognized</span>
                <span className="font-extrabold text-slate-900 tabular-nums" style={AR}>{formatCompactCurrency(totalRecognized)}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CLIENT REVENUE TABLE */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="text-[14px] font-bold text-slate-900" style={AR}>Revenue by Client</h3>
        <p className="text-[12px] text-slate-400 mb-3">Recognized {PERIOD_LABELS[period].toLowerCase()} · click a row to filter the page</p>
        {byClient.length === 0 ? <EmptyState icon={FolderKanban} message="No revenue in this view" /> : (
          <table className="w-full text-[13.5px]">
            <thead>
              <tr className="text-[10.5px] font-bold uppercase text-slate-400" style={{ letterSpacing: '0.1em' }}>
                <th className="text-left py-2 px-3 border-b border-slate-100">Client</th>
                <th className="text-right py-2 px-3 border-b border-slate-100">Projects</th>
                <th className="text-right py-2 px-3 border-b border-slate-100">Mix</th>
                <th className="text-right py-2 px-3 border-b border-slate-100">This Month</th>
                <th className="text-right py-2 px-3 border-b border-slate-100">Recognized</th>
                <th className="text-right py-2 px-3 border-b border-slate-100">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {byClient.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => setSelectedClient(selectedClient === c.id ? 'all' : c.id)}>
                  <td className="py-3 px-3 border-b border-slate-50 font-semibold text-slate-900">{c.name}</td>
                  <td className="py-3 px-3 border-b border-slate-50 text-right tabular-nums">{c.count}</td>
                  <td className="py-3 px-3 border-b border-slate-50 text-right whitespace-nowrap">
                    {c.ls > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mr-1" style={{ background: BLUEPRINT.blueSoft, color: BLUEPRINT.blue }}>{c.ls} LS</span>}
                    {c.tm > 0 && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: BLUEPRINT.copperSoft, color: BLUEPRINT.copper }}>{c.tm} TM</span>}
                  </td>
                  <td className="py-3 px-3 border-b border-slate-50 text-right tabular-nums">{formatCompactCurrency(c.thisMonth)}</td>
                  <td className="py-3 px-3 border-b border-slate-50 text-right font-bold tabular-nums" style={AR}>{formatCompactCurrency(c.recognized)}</td>
                  <td className="py-3 px-3 border-b border-slate-50 text-right tabular-nums text-slate-500">{totalRecognized > 0 ? `${((c.recognized / totalRecognized) * 100).toFixed(0)}%` : '—'}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold">
                <td className="py-3 px-3 border-t-2 border-slate-200">Total</td>
                <td className="py-3 px-3 border-t-2 border-slate-200 text-right tabular-nums">{byClient.reduce((s, c) => s + c.count, 0)}</td>
                <td className="py-3 px-3 border-t-2 border-slate-200" />
                <td className="py-3 px-3 border-t-2 border-slate-200 text-right tabular-nums">{formatCompactCurrency(totalThisMonth)}</td>
                <td className="py-3 px-3 border-t-2 border-slate-200 text-right tabular-nums" style={AR}>{formatCompactCurrency(totalRecognized)}</td>
                <td className="py-3 px-3 border-t-2 border-slate-200 text-right tabular-nums">100%</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <style jsx global>{`
        @keyframes bpRise { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  )
}
