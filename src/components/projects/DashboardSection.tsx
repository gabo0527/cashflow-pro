'use client'

import React, { useMemo, useState } from 'react'
import {
  Briefcase, DollarSign, TrendingUp, Clock, Receipt, AlertTriangle,
  ArrowUpRight, BarChart3, PieChart as PieChartIcon, Users, Timer, Layers
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart, CartesianGrid, Legend
} from 'recharts'
import {
  THEME, COLORS, getContractType, getServiceLine, SERVICE_LINE_COLORS,
  calculateProjectEconomics, calculateLS, calculateTM, getMonthsActive,
  formatCurrency, formatCompactCurrency, formatPercent, formatVariance,
  getPeriodRange, filterByPeriod, ContractType,
  KPICard, ContractBadge, MarginIndicator, VarianceIndicator, ProgressBar,
  SlicerButton, CustomTooltip, WaterfallItem, EmptyState
} from './shared'

interface DashboardSectionProps {
  projects: any[]; clients: any[]; expenses: any[]
  invoices: any[]; timesheets: any[]
  onDrillDown?: (type: string, id: string) => void
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

    // Enrich each project
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
    const { enriched, ts, inv } = data

    const totalFees = enriched.reduce((s, p) => s + p.totalContract, 0)
    const totalCosts = enriched.reduce((s, p) => s + p.totalCosts, 0)
    const grossProfit = totalFees - totalCosts
    const portfolioMargin = totalFees > 0 ? (grossProfit / totalFees) * 100 : 0

    // LS: Fee Earned across portfolio
    const lsProjects = enriched.filter(p => p.contractType === 'lump_sum')
    const totalFeeEarned = lsProjects.reduce((s, p) => s + (p.ls?.feeEarned || 0), 0)
    const totalLSCosts = lsProjects.reduce((s, p) => s + p.totalCosts, 0)
    const lsOverUnder = totalFeeEarned - totalLSCosts

    // T&M: Billed vs Cap
    const tmProjects = enriched.filter(p => p.contractType === 'time_and_materials')
    const totalBilled = tmProjects.reduce((s, p) => s + (p.tm?.billed || 0), 0)
    const totalCap = tmProjects.reduce((s, p) => s + (p.tm?.cap || 0), 0)

    // Hours
    const totalHours = ts.reduce((s, t) => s + (t.hours || 0), 0)
    const billableHours = ts.filter(t => t.billable).reduce((s, t) => s + (t.hours || 0), 0)
    const utilization = totalHours > 0 ? (billableHours / totalHours) * 100 : 0

    // Invoicing
    const totalInvoiced = inv.reduce((s, i) => s + (i.amount || 0), 0)
    const totalCollected = inv.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0)
    const arOutstanding = totalInvoiced - totalCollected
    const backlog = totalFees - totalInvoiced

    // Burn
    const totalMonthlyBurn = enriched.reduce((s, p) => s + p.monthlyBurn, 0)
    const portfolioRunway = totalMonthlyBurn > 0 ? (totalFees - totalCosts) / totalMonthlyBurn : 0

    // Pipeline
    const prospects = data.fp.filter(p => p.status === 'prospect')

    // Trouble
    const losingMoney = enriched.filter(p => p.margin < 0)
    const lsBehind = lsProjects.filter(p => p.ls && p.ls.overUnder < 0 && p.ls.costs > 0)

    return {
      activeCount: enriched.length, totalFees, totalCosts, grossProfit, portfolioMargin,
      lsCount: lsProjects.length, tmCount: tmProjects.length,
      totalFeeEarned, totalLSCosts, lsOverUnder,
      totalBilled, totalCap,
      totalHours, billableHours, utilization,
      totalInvoiced, totalCollected, arOutstanding, backlog,
      totalMonthlyBurn, portfolioRunway,
      pipelineValue: prospects.reduce((s, p) => s + (p.budget || 0), 0), prospectCount: prospects.length,
      losingMoney, lsBehind,
    }
  }, [data])

  // ============ CHART DATA ============

  // Service Line Revenue
  const serviceLineData = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; cost: number; profit: number; count: number }>()
    data.enriched.forEach(p => {
      const ex = map.get(p.serviceLine) || { name: p.serviceLine, revenue: 0, cost: 0, profit: 0, count: 0 }
      ex.revenue += p.totalContract; ex.cost += p.totalCosts; ex.profit += p.grossProfit; ex.count++
      map.set(p.serviceLine, ex)
    })
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
  }, [data.enriched])

  // Client Program P&L
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

  // LS Fee Earned vs Costs
  const lsFeeData = useMemo(() => {
    return data.enriched
      .filter(p => p.contractType === 'lump_sum' && p.totalContract > 0)
      .map(p => ({
        name: p.name.length > 22 ? p.name.substring(0, 22) + '…' : p.name,
        feeEarned: p.ls?.feeEarned || 0,
        costs: p.totalCosts,
        id: p.id,
      }))
      .sort((a, b) => (a.feeEarned - a.costs) - (b.feeEarned - b.costs))
      .slice(0, 10)
  }, [data.enriched])

  // T&M Billed vs Cap
  const tmCapData = useMemo(() => {
    return data.enriched
      .filter(p => p.contractType === 'time_and_materials' && p.totalContract > 0)
      .map(p => ({
        name: p.name.length > 22 ? p.name.substring(0, 22) + '…' : p.name,
        billed: p.tm?.billed || 0,
        cap: p.tm?.cap || 0,
        id: p.id,
      }))
      .sort((a, b) => (b.billed / (b.cap || 1)) - (a.billed / (a.cap || 1)))
      .slice(0, 10)
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
        <div className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 border border-rose-200 rounded-lg">
          <AlertTriangle size={16} className="text-rose-600 shrink-0" />
          <span className="text-sm text-rose-700"><strong>{m.losingMoney.length} project{m.losingMoney.length !== 1 ? 's' : ''} losing money</strong> — costs exceed fees on {m.losingMoney.map(p => p.name).slice(0, 3).join(', ')}{m.losingMoney.length > 3 ? ` +${m.losingMoney.length - 3} more` : ''}</span>
        </div>
      )}
      {m.lsBehind.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertTriangle size={16} className="text-amber-600 shrink-0" />
          <span className="text-sm text-amber-700"><strong>{m.lsBehind.length} LS project{m.lsBehind.length !== 1 ? 's' : ''} costs ahead of fee earned</strong> — spending faster than completing scope</span>
        </div>
      )}

      {/* KPI Row 1 — Portfolio */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPICard label="Active Engagements" value={String(m.activeCount)} subtitle={`${m.lsCount} LS • ${m.tmCount} T&M`} icon={Briefcase} color="blue" />
        <KPICard label="Total Fees" value={formatCompactCurrency(m.totalFees)} subtitle={`${formatCompactCurrency(m.totalCosts)} in costs`} icon={DollarSign} color="slate" />
        <KPICard label="Gross Profit" value={formatCompactCurrency(m.grossProfit)} subtitle={`${formatPercent(m.portfolioMargin)} margin`} icon={TrendingUp} color={m.portfolioMargin >= 20 ? 'emerald' : m.portfolioMargin >= 10 ? 'amber' : 'rose'} />
        <KPICard label="Backlog" value={formatCompactCurrency(m.backlog)} subtitle="Fees contracted, not yet invoiced" icon={Layers} color="blue" />
        <KPICard label="AR Outstanding" value={formatCompactCurrency(m.arOutstanding)} subtitle={`${formatCompactCurrency(m.totalInvoiced)} invoiced total`} icon={Receipt} color={m.arOutstanding > 0 ? 'amber' : 'emerald'} />
      </div>

      {/* KPI Row 2 — LS vs T&M */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="LS: Fee Earned" value={formatCompactCurrency(m.totalFeeEarned)} subtitle={m.lsOverUnder >= 0 ? `${formatCurrency(m.lsOverUnder)} under budget` : `${formatCurrency(Math.abs(m.lsOverUnder))} over budget`} icon={BarChart3} color={m.lsOverUnder >= 0 ? 'emerald' : 'rose'} />
        <KPICard label="T&M: Billed vs Cap" value={m.totalCap > 0 ? formatPercent((m.totalBilled / m.totalCap) * 100) : '—'} subtitle={`${formatCompactCurrency(m.totalBilled)} of ${formatCompactCurrency(m.totalCap)} cap`} icon={Clock} color={m.totalBilled > 0 ? 'purple' : 'slate'} />
        <KPICard label="Monthly Burn" value={formatCompactCurrency(m.totalMonthlyBurn)} subtitle={m.portfolioRunway > 0 ? `${m.portfolioRunway.toFixed(1)} months of budget remaining` : 'No data'} icon={Timer} color={m.portfolioRunway > 3 ? 'emerald' : m.portfolioRunway > 1 ? 'amber' : 'rose'} />
        <KPICard label="Pipeline" value={formatCompactCurrency(m.pipelineValue)} subtitle={`${m.prospectCount} prospect${m.prospectCount !== 1 ? 's' : ''}`} icon={ArrowUpRight} color="cyan" />
      </div>

      {/* Charts Row 1 — Service Lines + Client Concentration */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Revenue & Profit by Service Line</h3>
          <p className="text-xs text-slate-400 mb-4">Which services make money across all clients?</p>
          <div style={{ height: Math.max(160, serviceLineData.length * 44 + 40) }}>
            {serviceLineData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={serviceLineData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompactCurrency(v)} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#334155', fontSize: 12, fontWeight: 500 }} axisLine={false} tickLine={false} width={130} />
                  <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="revenue" name="Fee" fill={COLORS.blue} radius={[0, 4, 4, 0]} barSize={12} />
                  <Bar dataKey="cost" name="Cost" fill={COLORS.rose} radius={[0, 4, 4, 0]} barSize={12} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : <EmptyState icon={BarChart3} message="No active projects" />}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-1">Service Line Mix</h3>
          <p className="text-xs text-slate-400 mb-4">Revenue concentration by discipline</p>
          {serviceLineData.length > 0 ? (
            <>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={serviceLineData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="revenue" nameKey="name">
                    {serviceLineData.map((d, i) => <Cell key={i} fill={SERVICE_LINE_COLORS[d.name] || slColors[i % slColors.length]} />)}
                  </Pie><Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} /></PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-2">
                {serviceLineData.slice(0, 6).map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SERVICE_LINE_COLORS[d.name] || slColors[i % slColors.length] }} />
                      <span className="text-slate-600">{d.name}</span>
                    </div>
                    <span className={`font-medium tabular-nums ${d.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCompactCurrency(d.profit)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <EmptyState icon={PieChartIcon} message="No data" />}
        </div>
      </div>

      {/* Charts Row 2 — LS Fee Earned + T&M Cap */}
      <div className="grid grid-cols-12 gap-6">
        {lsFeeData.length > 0 && (
          <div className="col-span-12 lg:col-span-6 bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Lump Sum: Fee Earned vs Costs</h3>
            <p className="text-xs text-slate-400 mb-4">Am I spending ahead of what I've earned on fixed-fee work?</p>
            <div style={{ height: Math.max(120, lsFeeData.length * 36 + 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={lsFeeData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompactCurrency(v)} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#334155', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} width={150} />
                  <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="feeEarned" name="Fee Earned (% Complete × Fee)" fill={COLORS.blue} radius={[0, 4, 4, 0]} barSize={10} />
                  <Bar dataKey="costs" name="Costs to Date" fill={COLORS.rose} radius={[0, 4, 4, 0]} barSize={10} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {tmCapData.length > 0 && (
          <div className={`col-span-12 ${lsFeeData.length > 0 ? 'lg:col-span-6' : 'lg:col-span-12'} bg-white border border-slate-200 rounded-xl p-5`}>
            <h3 className="text-sm font-semibold text-slate-900 mb-1">T&M: Billed Against Cap</h3>
            <p className="text-xs text-slate-400 mb-4">How much of the contract ceiling have I consumed?</p>
            <div style={{ height: Math.max(120, tmCapData.length * 36 + 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={tmCapData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompactCurrency(v)} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#334155', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} width={150} />
                  <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="billed" name="Billed" fill={COLORS.purple} radius={[0, 4, 4, 0]} barSize={10} />
                  <Bar dataKey="cap" name="Contract Cap" fill={COLORS.slate} radius={[0, 4, 4, 0]} barSize={10} opacity={0.4} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {lsFeeData.length === 0 && tmCapData.length === 0 && (
          <div className="col-span-12 bg-white border border-slate-200 rounded-xl p-5">
            <EmptyState icon={BarChart3} message="No LS or T&M data to display — add budget data to your projects" />
          </div>
        )}
      </div>

      {/* Client Program P&L + Waterfall */}
      <div className="grid grid-cols-12 gap-6">
        {/* Waterfall */}
        <div className="col-span-12 lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Financial Summary</h3>
          <div className="space-y-0">
            <WaterfallItem label="Total Fees (Contracted)" value={formatCurrency(m.totalFees)} />
            <WaterfallItem label="(−) Total Costs" value={`(${formatCurrency(m.totalCosts)})`} />
            <WaterfallItem label="Gross Profit" value={formatCurrency(m.grossProfit)} isTotal />
            <div className="my-3" />
            <WaterfallItem label="Total Invoiced" value={formatCurrency(m.totalInvoiced)} />
            <WaterfallItem label="(−) Collected" value={`(${formatCurrency(m.totalCollected)})`} />
            <WaterfallItem label="AR Outstanding" value={formatCurrency(m.arOutstanding)} isTotal />
            <div className="my-3" />
            <WaterfallItem label="Backlog (uninvoiced)" value={formatCurrency(m.backlog)} />
            <WaterfallItem label="Monthly Burn Rate" value={formatCurrency(m.totalMonthlyBurn)} />
            <WaterfallItem label="Budget Runway" value={`${m.portfolioRunway.toFixed(1)} months`} isTotal />
          </div>
        </div>

        {/* Client Program P&L */}
        <div className="col-span-12 lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-900">Client Program P&L</h3>
            <p className="text-xs text-slate-400">Total relationship across all workstreams — click to filter</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-2 text-[11px] font-semibold text-slate-400 uppercase">Client</th>
                  <th className="text-center px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase">Scope</th>
                  <th className="text-right px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase">Fees</th>
                  <th className="text-right px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase">Costs</th>
                  <th className="text-right px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase">Profit</th>
                  <th className="text-right px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase">Margin</th>
                </tr>
              </thead>
              <tbody>
                {clientProgramData.map(c => (
                  <tr key={c.name} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedClient(c.id || 'all')}>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-slate-700">{c.name}</span>
                    </td>
                    <td className="text-center px-3 py-2.5">
                      <span className="text-xs text-slate-500">{c.projects} project{c.projects !== 1 ? 's' : ''}</span>
                      {c.lsCount > 0 && <span className="ml-1 text-[10px] font-bold text-blue-600">{c.lsCount}LS</span>}
                      {c.tmCount > 0 && <span className="ml-1 text-[10px] font-bold text-purple-600">{c.tmCount}T&M</span>}
                    </td>
                    <td className="text-right px-3 py-2.5 tabular-nums text-slate-700">{formatCompactCurrency(c.revenue)}</td>
                    <td className="text-right px-3 py-2.5 tabular-nums text-slate-700">{formatCompactCurrency(c.cost)}</td>
                    <td className="text-right px-3 py-2.5"><VarianceIndicator value={c.profit} /></td>
                    <td className="text-right px-3 py-2.5"><MarginIndicator value={c.margin} /></td>
                  </tr>
                ))}
              </tbody>
              {clientProgramData.length > 1 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50">
                    <td className="px-4 py-2.5 font-semibold text-slate-900">Total</td>
                    <td className="text-center px-3 py-2.5 text-xs text-slate-500">{m.activeCount} projects</td>
                    <td className="text-right px-3 py-2.5 font-semibold text-slate-900 tabular-nums">{formatCompactCurrency(m.totalFees)}</td>
                    <td className="text-right px-3 py-2.5 font-semibold text-slate-900 tabular-nums">{formatCompactCurrency(m.totalCosts)}</td>
                    <td className="text-right px-3 py-2.5"><VarianceIndicator value={m.grossProfit} /></td>
                    <td className="text-right px-3 py-2.5"><MarginIndicator value={m.portfolioMargin} /></td>
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
