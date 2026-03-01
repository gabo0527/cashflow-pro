'use client'

import React, { useMemo, useState } from 'react'
import {
  Briefcase, DollarSign, TrendingUp, TrendingDown, Users,
  AlertTriangle, Target, Activity, Clock, Building2, Zap,
  ChevronRight, ArrowUpRight, ArrowDownRight, FileText,
  CheckCircle2, XCircle, Calendar, BarChart3
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart, Line
} from 'recharts'
import {
  THEME, COLORS, PROJECT_STATUSES, getHealthConfig, calculateHealthScore, getHealthScore,
  formatCurrency, formatCompactCurrency, formatPercent,
  KPICard, CustomTooltip, WaterfallItem, SlicerButton, InsightBadge
} from './shared'

interface DashboardSectionProps {
  projects: any[]
  clients: any[]
  expenses: any[]
  invoices: any[]
  timesheets: any[]
  onDrillDown?: (type: string, id: string) => void
}

export default function DashboardSection({
  projects, clients, expenses, invoices, timesheets, onDrillDown
}: DashboardSectionProps) {
  const [selectedClient, setSelectedClient] = useState('all')
  const [selectedPeriod, setSelectedPeriod] = useState('ytd')

  const filteredProjects = useMemo(() => {
    let result = projects.filter(p => p.status !== 'archived')
    if (selectedClient !== 'all') result = result.filter(p => p.client_id === selectedClient)
    return result
  }, [projects, selectedClient])

  // Enrich with calculations + health reasons
  const enrichedProjects = useMemo(() => {
    // Hours per project from timesheets
    const hoursMap = new Map<string, { actual: number; billed: number }>()
    timesheets.forEach(t => {
      const existing = hoursMap.get(t.project_id) || { actual: 0, billed: 0 }
      existing.actual += t.hours || 0
      if (t.billable) existing.billed += t.hours || 0
      hoursMap.set(t.project_id, existing)
    })

    return filteredProjects.map(p => {
      const hours = hoursMap.get(p.id) || { actual: 0, billed: 0 }
      const health = calculateHealthScore({ ...p, actual_hours: hours.actual })
      const margin = p.budget > 0 ? ((p.budget - p.spent) / p.budget) * 100 : 0
      const burnRate = p.budget > 0 ? (p.spent / p.budget) * 100 : 0
      const effectiveRate = hours.actual > 0 ? p.spent / hours.actual : 0

      // Change orders for this project
      const cos = projects.filter(co => co.parent_id === p.id && co.is_change_order)
      const coValue = cos.reduce((sum, co) => sum + (co.budget || 0), 0)
      const totalContractWithCOs = (p.budget || 0) + coValue

      return {
        ...p,
        actual_hours: hours.actual,
        billed_hours: hours.billed,
        healthScore: health.score,
        healthReasons: health.reasons,
        margin,
        burnRate,
        effectiveRate,
        changeOrderCount: cos.length,
        changeOrderValue: coValue,
        totalContractWithCOs,
        client: clients.find(c => c.id === p.client_id)?.name || 'No Client'
      }
    })
  }, [filteredProjects, projects, clients, timesheets])

  // ============ PORTFOLIO METRICS ============
  const metrics = useMemo(() => {
    const active = enrichedProjects.filter(p => p.status === 'active' && !p.is_change_order)
    const prospects = enrichedProjects.filter(p => p.status === 'prospect')

    const totalContract = active.reduce((sum, p) => sum + (p.totalContractWithCOs || p.budget || 0), 0)
    const totalSpent = active.reduce((sum, p) => sum + (p.spent || 0), 0)
    const totalRemaining = totalContract - totalSpent

    const weightedMargin = totalContract > 0
      ? active.reduce((sum, p) => {
          const pBudget = p.totalContractWithCOs || p.budget || 0
          return sum + (pBudget > 0 ? ((pBudget - (p.spent || 0)) / pBudget) * 100 * (pBudget / totalContract) : 0)
        }, 0)
      : 0

    // Hours
    const totalHours = active.reduce((sum, p) => sum + (p.actual_hours || 0), 0)
    const totalBudgetedHours = active.reduce((sum, p) => sum + (p.budgeted_hours || 0), 0)

    // Health
    const atRisk = active.filter(p => p.healthScore < 60)
    const atRiskValue = atRisk.reduce((sum, p) => sum + (p.budget || 0), 0)
    const healthy = active.filter(p => p.healthScore >= 80)

    // Pipeline
    const pipelineValue = prospects.reduce((sum, p) => sum + (p.budget || 0), 0)

    // Direct costs from expenses table (using new category key)
    const projectExpenses = expenses.filter(e =>
      e.category === 'directCost' &&
      enrichedProjects.some(p => p.id === e.project_id)
    )
    const totalDirectCosts = projectExpenses.reduce((sum, e) => sum + e.amount, 0)

    // Invoicing
    const projectInvoices = invoices.filter(inv => enrichedProjects.some(p => p.id === inv.project_id))
    const totalInvoiced = projectInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)
    const totalCollected = projectInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.amount || 0), 0)
    const realization = totalContract > 0 ? (totalInvoiced / totalContract) * 100 : 0

    // Change orders
    const totalCOs = active.reduce((sum, p) => sum + p.changeOrderCount, 0)
    const totalCOValue = active.reduce((sum, p) => sum + p.changeOrderValue, 0)

    return {
      activeCount: active.length, prospectCount: prospects.length,
      totalContract, totalSpent, totalRemaining, weightedMargin,
      totalHours, totalBudgetedHours,
      atRiskCount: atRisk.length, atRiskValue, healthyCount: healthy.length,
      pipelineValue, totalDirectCosts, totalInvoiced, totalCollected, realization,
      totalCOs, totalCOValue,
    }
  }, [enrichedProjects, expenses, invoices])

  // ============ CLIENT OPTIONS ============
  const clientOptions = useMemo(() => {
    const counts = new Map<string, number>()
    projects.forEach(p => { if (p.client_id) counts.set(p.client_id, (counts.get(p.client_id) || 0) + 1) })
    return clients.map(c => ({ id: c.id, label: c.name, count: counts.get(c.id) || 0 })).filter(c => c.count > 0)
  }, [projects, clients])

  // ============ CLIENT REVENUE CHART ============
  const clientRevenueData = useMemo(() => {
    const totals = new Map<string, { name: string; contract: number; spent: number }>()
    enrichedProjects.filter(p => p.status === 'active' && !p.is_change_order).forEach(p => {
      const clientName = p.client || 'No Client'
      const existing = totals.get(clientName) || { name: clientName, contract: 0, spent: 0 }
      existing.contract += p.totalContractWithCOs || p.budget || 0
      existing.spent += p.spent || 0
      totals.set(clientName, existing)
    })
    return Array.from(totals.values())
      .map(c => ({ ...c, margin: c.contract > 0 ? ((c.contract - c.spent) / c.contract) * 100 : 0 }))
      .sort((a, b) => b.contract - a.contract).slice(0, 8)
  }, [enrichedProjects])

  // ============ HEALTH DISTRIBUTION ============
  const healthDistribution = useMemo(() => {
    const active = enrichedProjects.filter(p => p.status === 'active' && !p.is_change_order)
    return [
      { name: 'Healthy', value: active.filter(p => p.healthScore >= 80).length, color: COLORS.emerald },
      { name: 'Warning', value: active.filter(p => p.healthScore >= 60 && p.healthScore < 80).length, color: COLORS.amber },
      { name: 'At Risk', value: active.filter(p => p.healthScore < 60).length, color: COLORS.rose },
    ].filter(d => d.value > 0)
  }, [enrichedProjects])

  // ============ BURN VS COMPLETION ============
  const burnVsCompletion = useMemo(() => {
    return enrichedProjects
      .filter(p => p.status === 'active' && !p.is_change_order && p.budget > 0)
      .map(p => ({
        name: p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name,
        burn: Math.round(p.burnRate),
        completion: p.percent_complete || 0,
        delta: Math.round(p.burnRate - (p.percent_complete || 0)),
      }))
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 8)
  }, [enrichedProjects])

  // ============ TOP / BOTTOM PERFORMERS ============
  const { topPerformers, needsAttention } = useMemo(() => {
    const active = enrichedProjects.filter(p => p.status === 'active' && !p.is_change_order && p.budget > 0)
    const sorted = [...active].sort((a, b) => b.margin - a.margin)
    return {
      topPerformers: sorted.slice(0, 5),
      needsAttention: [...active].sort((a, b) => a.healthScore - b.healthScore).slice(0, 5).filter(p => p.healthScore < 80)
    }
  }, [enrichedProjects])

  // ============ PORTFOLIO INSIGHTS (decision support) ============
  const insights = useMemo(() => {
    const msgs: { type: 'warning' | 'danger' | 'info' | 'success'; message: string }[] = []
    const active = enrichedProjects.filter(p => p.status === 'active' && !p.is_change_order)

    if (metrics.atRiskCount > 0) msgs.push({ type: 'danger', message: `${metrics.atRiskCount} project${metrics.atRiskCount > 1 ? 's' : ''} at risk — ${formatCurrency(metrics.atRiskValue)} in contract value exposed` })
    if (metrics.realization < 50 && metrics.totalContract > 0) msgs.push({ type: 'warning', message: `Realization at ${metrics.realization.toFixed(0)}% — ${formatCurrency(metrics.totalContract - metrics.totalInvoiced)} un-invoiced` })
    if (metrics.weightedMargin < 15 && active.length > 0) msgs.push({ type: 'warning', message: `Portfolio margin at ${metrics.weightedMargin.toFixed(1)}% — below 15% target` })

    // Projects burning faster than completing
    const overburning = active.filter(p => p.burnRate - (p.percent_complete || 0) > 15)
    if (overburning.length > 0) msgs.push({ type: 'warning', message: `${overburning.length} project${overburning.length > 1 ? 's' : ''} burning faster than progress — review resource allocation` })

    // Past deadline
    const pastDeadline = active.filter(p => p.end_date && new Date(p.end_date) < new Date())
    if (pastDeadline.length > 0) msgs.push({ type: 'danger', message: `${pastDeadline.length} project${pastDeadline.length > 1 ? 's' : ''} past deadline — consider change orders` })

    if (metrics.healthyCount === active.length && active.length > 0) msgs.push({ type: 'success', message: 'All projects healthy — portfolio performing well' })
    if (metrics.totalCOs > 0) msgs.push({ type: 'info', message: `${metrics.totalCOs} active change orders adding ${formatCurrency(metrics.totalCOValue)} to portfolio` })

    return msgs.slice(0, 4)
  }, [enrichedProjects, metrics])

  // ============ REALIZATION BY PROJECT ============
  const realizationByProject = useMemo(() => {
    return enrichedProjects
      .filter(p => p.status === 'active' && !p.is_change_order && p.budget > 0)
      .map(p => {
        const pInvoices = invoices.filter(inv => inv.project_id === p.id)
        const invoiced = pInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0)
        const collected = pInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.amount || 0), 0)
        return {
          name: p.name.length > 20 ? p.name.slice(0, 20) + '…' : p.name,
          contract: p.totalContractWithCOs || p.budget,
          invoiced,
          collected,
          realization: p.budget > 0 ? (invoiced / p.budget) * 100 : 0,
        }
      })
      .sort((a, b) => b.contract - a.contract)
      .slice(0, 6)
  }, [enrichedProjects, invoices])

  return (
    <div className="space-y-6">
      {/* Slicers */}
      <div className="flex items-center gap-3 flex-wrap">
        <SlicerButton label="Client" value={selectedClient} options={clientOptions} onChange={setSelectedClient} allLabel="All Clients" />
        <SlicerButton label="Period" value={selectedPeriod}
          options={[{ id: 'ytd', label: 'Year to Date' }, { id: 'q1', label: 'Q1 2026' }, { id: 'all', label: 'All Time' }]}
          onChange={setSelectedPeriod}
        />
        {selectedClient !== 'all' && (
          <button onClick={() => setSelectedClient('all')} className="text-xs text-emerald-600 hover:text-emerald-700 transition-colors">Clear filters</button>
        )}
      </div>

      {/* Portfolio Insights */}
      {insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {insights.map((ins, i) => <InsightBadge key={i} type={ins.type} message={ins.message} />)}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <KPICard label="Active Projects" value={metrics.activeCount} subtitle={`${formatCompactCurrency(metrics.totalContract)} total`} icon={Briefcase} color="emerald" />
        <KPICard label="Portfolio Margin" value={formatPercent(metrics.weightedMargin)} subtitle="Weighted average" icon={TrendingUp}
          color={metrics.weightedMargin >= 20 ? 'emerald' : metrics.weightedMargin >= 10 ? 'amber' : 'rose'} />
        <KPICard label="Remaining Budget" value={formatCompactCurrency(metrics.totalRemaining)}
          subtitle={`${metrics.totalContract > 0 ? formatPercent(100 - (metrics.totalSpent / metrics.totalContract * 100)) : '0%'} of contracts`} icon={DollarSign} color="blue" />
        <KPICard label="Realization" value={formatPercent(metrics.realization)} subtitle={`${formatCompactCurrency(metrics.totalInvoiced)} invoiced`} icon={Target}
          color={metrics.realization >= 80 ? 'emerald' : metrics.realization >= 50 ? 'amber' : 'rose'} />
        <KPICard label="At Risk Value" value={formatCompactCurrency(metrics.atRiskValue)} subtitle={`${metrics.atRiskCount} projects`} icon={AlertTriangle}
          color={metrics.atRiskCount > 0 ? 'rose' : 'emerald'} />
        <KPICard label="Pipeline" value={formatCompactCurrency(metrics.pipelineValue)} subtitle={`${metrics.prospectCount} prospects`} icon={Zap} color="cyan" />
      </div>

      {/* Row 1: Contract by Client + Health */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Contract Value by Client</h3>
                <p className="text-xs text-slate-400 mt-0.5">Active projects — includes change orders</p>
              </div>
            </div>
            <div className="h-64">
              {clientRevenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={clientRevenueData} layout="vertical" margin={{ left: 80 }}>
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompactCurrency(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                    <Bar dataKey="contract" name="Contract" fill={COLORS.emerald} radius={[0, 4, 4, 0]} barSize={18} />
                    <Bar dataKey="spent" name="Spent" fill={COLORS.rose} radius={[0, 4, 4, 0]} barSize={18} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">No project data</div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm h-full">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Portfolio Health</h3>
            {healthDistribution.length > 0 ? (
              <>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={healthDistribution} cx="50%" cy="50%" innerRadius={42} outerRadius={62} paddingAngle={4} dataKey="value">
                        {healthDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-4">
                  {healthDistribution.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-sm text-slate-600">{item.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-900">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-40 text-slate-400">No active projects</div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Burn vs Completion + Realization by Project */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-slate-900">Burn Rate vs Completion</h3>
              <p className="text-xs text-slate-400 mt-0.5">Projects burning faster than progressing need attention</p>
            </div>
            <div className="h-56">
              {burnVsCompletion.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={burnVsCompletion} layout="vertical" margin={{ left: 100 }}>
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip content={<CustomTooltip formatter={(v: number) => `${v}%`} />} />
                    <Bar dataKey="burn" name="Burn %" fill={COLORS.rose} radius={[0, 4, 4, 0]} barSize={10} />
                    <Bar dataKey="completion" name="Complete %" fill={COLORS.emerald} radius={[0, 4, 4, 0]} barSize={10} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">No budget data</div>
              )}
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-slate-900">Revenue Recognition</h3>
              <p className="text-xs text-slate-400 mt-0.5">Contract → Invoiced → Collected</p>
            </div>
            <div className="h-56">
              {realizationByProject.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={realizationByProject} layout="vertical" margin={{ left: 100 }}>
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompactCurrency(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                    <Bar dataKey="contract" name="Contract" fill={COLORS.blue} radius={[0, 4, 4, 0]} barSize={8} opacity={0.3} />
                    <Bar dataKey="invoiced" name="Invoiced" fill={COLORS.amber} radius={[0, 4, 4, 0]} barSize={8} />
                    <Bar dataKey="collected" name="Collected" fill={COLORS.emerald} radius={[0, 4, 4, 0]} barSize={8} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">No invoice data</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Financial Waterfall + Top Performers + Needs Attention */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Financial Summary</h3>
            <div className="space-y-1">
              <WaterfallItem label="Contract Value" value={metrics.totalContract} type="start" showBar={false} />
              {metrics.totalCOValue > 0 && <WaterfallItem label="Change Orders" value={metrics.totalCOValue} type="add" showBar={false} />}
              <WaterfallItem label="Direct Costs" value={metrics.totalDirectCosts} type="subtract" showBar={false} />
              <WaterfallItem label="Labor (Spent)" value={Math.max(0, metrics.totalSpent - metrics.totalDirectCosts)} type="subtract" showBar={false} />
              <div className="border-t border-slate-200 my-2" />
              <WaterfallItem label="Gross Profit" value={metrics.totalRemaining} type="total" showBar={false} />
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Portfolio Margin</span>
                <span className={`text-lg font-bold ${metrics.weightedMargin >= 20 ? 'text-emerald-600' : metrics.weightedMargin >= 10 ? 'text-amber-600' : 'text-rose-600'}`}>
                  {formatPercent(metrics.weightedMargin)}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-slate-500">Collected</span>
                <span className="text-sm font-semibold text-slate-700">{formatCurrency(metrics.totalCollected)}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm text-slate-500">Outstanding AR</span>
                <span className="text-sm font-semibold text-amber-600">{formatCurrency(metrics.totalInvoiced - metrics.totalCollected)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm h-full">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Top Performers</h3>
            {topPerformers.length > 0 ? (
              <div className="space-y-2.5">
                {topPerformers.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors" onClick={() => onDrillDown?.('project', p.id)}>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'}`}>{i + 1}</span>
                      <div>
                        <p className="text-sm font-medium text-slate-700 truncate max-w-[140px]">{p.name}</p>
                        <p className="text-xs text-slate-400">{p.client}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600">{formatPercent(p.margin)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-8">No active projects</p>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm h-full">
            <h3 className="text-sm font-semibold text-slate-900 mb-4">Needs Attention</h3>
            {needsAttention.length > 0 ? (
              <div className="space-y-2.5">
                {needsAttention.map(p => (
                  <div key={p.id} className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 cursor-pointer transition-colors" onClick={() => onDrillDown?.('project', p.id)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={14} className="text-rose-500 shrink-0" />
                        <p className="text-sm font-medium text-slate-700 truncate max-w-[140px]">{p.name}</p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${getHealthConfig(p.healthScore).bg} ${getHealthConfig(p.healthScore).text}`}>{p.healthScore}</span>
                    </div>
                    {p.healthReasons?.length > 0 && (
                      <p className="text-xs text-rose-600 mt-1.5 ml-6">{p.healthReasons[0]}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 size={20} className="text-emerald-600" />
                </div>
                <p className="text-sm text-slate-500">All projects healthy!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
