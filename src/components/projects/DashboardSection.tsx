'use client'

import React, { useMemo, useState } from 'react'
import {
  Briefcase, DollarSign, TrendingUp, AlertTriangle,
  BarChart3, PieChart as PieChartIcon, Receipt
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart, CartesianGrid, Legend
} from 'recharts'
import {
  THEME, COLORS, getContractType, getServiceLine, SERVICE_LINE_COLORS,
  calculateProjectEconomics, getMonthsActive,
  formatCurrency, formatCompactCurrency, formatPercent,
  getPeriodRange, filterByPeriod,
  MarginIndicator, VarianceIndicator,
  SlicerButton, CustomTooltip, WaterfallItem, EmptyState
} from './shared'

interface DashboardSectionProps {
  projects: any[]; clients: any[]; expenses: any[]
  invoices: any[]; timesheets: any[]
  onDrillDown?: (type: string, id: string) => void
}

// ============ PREMIUM KPI CARD ============
function MetricCard({ label, value, detail, accent = 'emerald', alert }: {
  label: string; value: string; detail?: string; accent?: string; alert?: boolean
}) {
  const accentBar: Record<string, string> = {
    emerald: 'bg-emerald-500', blue: 'bg-blue-500', amber: 'bg-amber-500',
    rose: 'bg-rose-500', slate: 'bg-slate-300', purple: 'bg-purple-500',
  }
  return (
    <div className={`relative bg-white rounded-2xl border ${alert ? 'border-rose-200' : 'border-slate-100'} shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)] transition-all duration-200 overflow-hidden`}>
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${accentBar[accent] || accentBar.emerald}`} />
      <div className="px-5 pt-5 pb-4">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-3">{label}</p>
        <p className={`text-[28px] font-bold tracking-tight leading-none ${alert ? 'text-rose-600' : 'text-slate-900'}`}>{value}</p>
        {detail && <p className="text-[13px] text-slate-400 mt-2 leading-snug">{detail}</p>}
      </div>
    </div>
  )
}

export default function DashboardSection({ projects, clients, expenses, invoices, timesheets, onDrillDown }: DashboardSectionProps) {
  const [selectedClient, setSelectedClient] = useState('all')
  const [selectedPeriod, setSelectedPeriod] = useState('ytd')

  const periodRange = useMemo(() => getPeriodRange(selectedPeriod), [selectedPeriod])

  const clientOptions = useMemo(() => {
    const unique = Array.from(new Set(projects.map(p => p.client_id).filter(Boolean)))
      .map(id => clients.find(c => c.id === id)).filter(Boolean)
    return [{ id: 'all', label: 'All Clients' }, ...unique.map(c => ({ id: c.id, label: c.name }))]
  }, [projects, clients])

  // ============ FILTERED + ENRICHED ============
  const data = useMemo(() => {
    let fp = projects.filter(p => !p.is_change_order)
    if (selectedClient !== 'all') fp = fp.filter(p => p.client_id === selectedClient)
    const active = fp.filter(p => p.status === 'active')
    const allIds = fp.map(p => p.id)

    const ts = filterByPeriod(timesheets.filter(t => allIds.includes(t.project_id)), 'date', periodRange)
    const exp = filterByPeriod(expenses.filter(e => allIds.includes(e.project_id)), 'date', periodRange)
    const inv = filterByPeriod(invoices.filter(i => allIds.includes(i.project_id)), 'date', periodRange)
    const cos = projects.filter(p => p.is_change_order && allIds.includes(p.parent_id))

    const enriched = active.map(p => {
      const projectCOs = cos.filter(co => co.parent_id === p.id)
      const coValue = projectCOs.reduce((s, co) => s + (co.budget || 0), 0)
      const coSpent = projectCOs.reduce((s, co) => s + (co.spent || 0), 0)
      const projectTS = ts.filter(t => t.project_id === p.id)
      const totalHours = projectTS.reduce((s, t) => s + (t.hours || 0), 0)
      const billableHours = projectTS.filter(t => t.billable).reduce((s, t) => s + (t.hours || 0), 0)
      const contractType = getContractType(p)
      const serviceLine = getServiceLine(p)
      const clientName = clients.find(c => c.id === p.client_id)?.name || 'No Client'
      const econ = calculateProjectEconomics(p, { coValue, coSpent, totalHours, billableHours, billRate: p.bill_rate, monthsActive: getMonthsActive(p.start_date) })

      return { ...p, ...econ, clientName, serviceLine, totalHours, billableHours, coValue, coSpent, coCount: projectCOs.length }
    })

    return { fp, active, enriched, cos, ts, exp, inv }
  }, [projects, clients, expenses, invoices, timesheets, selectedClient, periodRange])

  // ============ PORTFOLIO METRICS ============
  const m = useMemo(() => {
    const { enriched, inv } = data

    const totalRevenue = enriched.reduce((s, p) => s + p.totalContract, 0)
    const totalCosts = enriched.reduce((s, p) => s + p.totalCosts, 0)
    const grossProfit = totalRevenue - totalCosts
    const portfolioMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

    const lsProjects = enriched.filter(p => p.contractType === 'lump_sum')
    const tmProjects = enriched.filter(p => p.contractType === 'time_and_materials')

    const totalInvoiced = inv.reduce((s, i) => s + (i.amount || 0), 0)
    const totalCollected = inv.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0)
    const arOutstanding = totalInvoiced - totalCollected

    const losingMoney = enriched.filter(p => p.margin < 0 && p.totalCosts > 0)

    return {
      activeCount: enriched.length, lsCount: lsProjects.length, tmCount: tmProjects.length,
      totalRevenue, totalCosts, grossProfit, portfolioMargin,
      totalInvoiced, totalCollected, arOutstanding,
      losingMoney,
    }
  }, [data])

  // ============ CHART DATA ============

  const serviceLineData = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; cost: number; profit: number; count: number }>()
    data.enriched.forEach(p => {
      const ex = map.get(p.serviceLine) || { name: p.serviceLine, revenue: 0, cost: 0, profit: 0, count: 0 }
      ex.revenue += p.totalContract; ex.cost += p.totalCosts; ex.profit += p.grossProfit; ex.count++
      map.set(p.serviceLine, ex)
    })
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
  }, [data.enriched])

  const clientProgramData = useMemo(() => {
    const map = new Map<string, { name: string; id: string; revenue: number; cost: number; margin: number; projects: number; lsCount: number; tmCount: number }>()
    data.enriched.forEach(p => {
      const ex = map.get(p.clientName) || { name: p.clientName, id: p.client_id, revenue: 0, cost: 0, margin: 0, projects: 0, lsCount: 0, tmCount: 0 }
      ex.revenue += p.totalContract; ex.cost += p.totalCosts; ex.projects++
      if (p.contractType === 'lump_sum') ex.lsCount++; else ex.tmCount++
      map.set(p.clientName, ex)
    })
    return Array.from(map.values()).map(c => ({ ...c, margin: c.revenue > 0 ? ((c.revenue - c.cost) / c.revenue) * 100 : 0, profit: c.revenue - c.cost })).sort((a, b) => b.revenue - a.revenue)
  }, [data.enriched])

  const slColors = Object.values(SERVICE_LINE_COLORS)

  return (
    <div className="space-y-6">
      {/* Slicers */}
      <div className="flex items-center gap-3 flex-wrap">
        <SlicerButton label="Client" value={selectedClient} options={clientOptions} onChange={setSelectedClient} />
        <SlicerButton label="Period" value={selectedPeriod}
          options={[
            { id: 'ytd', label: 'Year to Date' },
            { id: 'q1', label: 'Q1 2026' }, { id: 'q2', label: 'Q2 2026' },
            { id: 'jan', label: 'January' }, { id: 'feb', label: 'February' }, { id: 'mar', label: 'March' },
            { id: 'apr', label: 'April' }, { id: 'may', label: 'May' }, { id: 'jun', label: 'June' },
            { id: 'last30', label: 'Last 30 Days' }, { id: 'last90', label: 'Last 90 Days' },
            { id: 'all', label: 'All Time' },
          ]}
          onChange={setSelectedPeriod}
        />
      </div>

      {/* Alerts */}
      {m.losingMoney.length > 0 && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertTriangle size={16} className="text-rose-500 shrink-0" />
          <span className="text-sm text-rose-700">
            <strong>{m.losingMoney.length} project{m.losingMoney.length !== 1 ? 's' : ''} over budget</strong> — {m.losingMoney.map(p => p.name).slice(0, 3).join(', ')}{m.losingMoney.length > 3 ? ` +${m.losingMoney.length - 3} more` : ''}
          </span>
        </div>
      )}

      {/* KPI Row — one row, five cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          label="Active Projects"
          value={String(m.activeCount)}
          detail={m.lsCount > 0 && m.tmCount > 0 ? `${m.lsCount} Lump Sum · ${m.tmCount} T&M` : m.tmCount > 0 ? `${m.tmCount} T&M` : `${m.lsCount} projects`}
          accent="blue"
        />
        <MetricCard
          label="Total Revenue"
          value={formatCompactCurrency(m.totalRevenue)}
          detail={m.totalCosts > 0 ? `${formatCompactCurrency(m.totalCosts)} in costs` : 'No costs recorded'}
          accent="slate"
        />
        <MetricCard
          label="Gross Profit"
          value={formatCompactCurrency(m.grossProfit)}
          detail={`${formatPercent(m.portfolioMargin)} margin`}
          accent={m.portfolioMargin >= 20 ? 'emerald' : m.portfolioMargin >= 10 ? 'amber' : 'rose'}
          alert={m.grossProfit < 0}
        />
        <MetricCard
          label="Invoiced"
          value={formatCompactCurrency(m.totalInvoiced)}
          detail={`${formatCompactCurrency(m.totalCollected)} collected`}
          accent="blue"
        />
        <MetricCard
          label="AR Outstanding"
          value={formatCompactCurrency(m.arOutstanding)}
          detail={m.arOutstanding > 0 ? 'Invoiced but unpaid' : 'All caught up'}
          accent={m.arOutstanding > 0 ? 'amber' : 'emerald'}
        />
      </div>

      {/* Charts Row 1 — Revenue by Service Line + Mix */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h3 className="text-sm font-semibold text-slate-900 mb-0.5">Revenue by Service Line</h3>
          <p className="text-xs text-slate-400 mb-5">Which services generate the most revenue?</p>
          <div style={{ height: Math.max(160, serviceLineData.length * 44 + 40) }}>
            {serviceLineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={serviceLineData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompactCurrency(v)} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#334155', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} width={130} />
                  <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="revenue" name="Revenue" fill={COLORS.blue} radius={[0, 6, 6, 0]} barSize={14} />
                  <Bar dataKey="cost" name="Cost" fill="#fda4af" radius={[0, 6, 6, 0]} barSize={14} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : <EmptyState icon={BarChart3} message="No active projects" />}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h3 className="text-sm font-semibold text-slate-900 mb-0.5">Service Line Mix</h3>
          <p className="text-xs text-slate-400 mb-5">Revenue by discipline</p>
          {serviceLineData.length > 0 ? (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={serviceLineData} cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={2} dataKey="revenue" nameKey="name" strokeWidth={0}>
                    {serviceLineData.map((d, i) => <Cell key={i} fill={SERVICE_LINE_COLORS[d.name] || slColors[i % slColors.length]} />)}
                  </Pie><Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} /></PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-3">
                {serviceLineData.slice(0, 6).map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: SERVICE_LINE_COLORS[d.name] || slColors[i % slColors.length] }} />
                      <span className="text-[13px] text-slate-600">{d.name}</span>
                    </div>
                    <span className={`text-[13px] font-semibold tabular-nums ${d.profit >= 0 ? 'text-slate-700' : 'text-rose-600'}`}>{formatCompactCurrency(d.revenue)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <EmptyState icon={PieChartIcon} message="No data" />}
        </div>
      </div>

      {/* Financial Summary + Client P&L */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4 bg-white border border-slate-100 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h3 className="text-sm font-semibold text-slate-900 mb-5">Financial Summary</h3>
          <div className="space-y-0">
            <WaterfallItem label="Total Revenue" value={formatCurrency(m.totalRevenue)} />
            <WaterfallItem label="(−) Total Costs" value={`(${formatCurrency(m.totalCosts)})`} />
            <WaterfallItem label="Gross Profit" value={formatCurrency(m.grossProfit)} isTotal />
            <div className="my-4" />
            <WaterfallItem label="Invoiced" value={formatCurrency(m.totalInvoiced)} />
            <WaterfallItem label="(−) Collected" value={`(${formatCurrency(m.totalCollected)})`} />
            <WaterfallItem label="AR Outstanding" value={formatCurrency(m.arOutstanding)} isTotal />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8 bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">Client P&L</h3>
            <p className="text-xs text-slate-400 mt-0.5">Total relationship across all projects — click to filter</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Client</th>
                  <th className="text-center px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Projects</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Revenue</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Costs</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Profit</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Margin</th>
                </tr>
              </thead>
              <tbody>
                {clientProgramData.map(c => (
                  <tr key={c.name} className="border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer transition-colors"
                    onClick={() => setSelectedClient(c.id || 'all')}>
                    <td className="px-5 py-3">
                      <span className="font-medium text-slate-800">{c.name}</span>
                    </td>
                    <td className="text-center px-3 py-3">
                      <span className="text-slate-500">{c.projects}</span>
                      {c.lsCount > 0 && c.tmCount > 0 && (
                        <span className="text-[10px] text-slate-400 ml-1">({c.lsCount}LS/{c.tmCount}TM)</span>
                      )}
                    </td>
                    <td className="text-right px-3 py-3 tabular-nums text-slate-700 font-medium">{formatCompactCurrency(c.revenue)}</td>
                    <td className="text-right px-3 py-3 tabular-nums text-slate-500">{formatCompactCurrency(c.cost)}</td>
                    <td className="text-right px-3 py-3"><VarianceIndicator value={c.profit} /></td>
                    <td className="text-right px-4 py-3"><MarginIndicator value={c.margin} /></td>
                  </tr>
                ))}
              </tbody>
              {clientProgramData.length > 1 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50/80">
                    <td className="px-5 py-3 font-semibold text-slate-900">Total</td>
                    <td className="text-center px-3 py-3 text-slate-500">{m.activeCount}</td>
                    <td className="text-right px-3 py-3 font-bold text-slate-900 tabular-nums">{formatCompactCurrency(m.totalRevenue)}</td>
                    <td className="text-right px-3 py-3 font-semibold text-slate-700 tabular-nums">{formatCompactCurrency(m.totalCosts)}</td>
                    <td className="text-right px-3 py-3"><VarianceIndicator value={m.grossProfit} /></td>
                    <td className="text-right px-4 py-3"><MarginIndicator value={m.portfolioMargin} /></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
