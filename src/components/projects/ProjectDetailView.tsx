'use client'

import React, { useMemo, useState } from 'react'
import {
  X, Briefcase, Clock, Users, DollarSign, TrendingUp,
  ArrowLeft, CheckCircle2, BarChart3, Activity, Receipt, Layers
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid
} from 'recharts'
import {
  THEME, COLORS, getContractType, getServiceLine, getMonthsActive,
  calculateProjectEconomics,
  formatCurrency, formatCompactCurrency, formatPercent, formatDateShort, formatVariance,
  KPICard, ContractBadge, MarginBadge, MarginIndicator, VarianceIndicator,
  ProgressBar, StatusBadge, CustomTooltip, WaterfallItem, ContractType
} from './shared'

interface ProjectDetailViewProps {
  project: any; client: any; timesheets: any[]; expenses: any[]
  invoices: any[]; teamMembers: any[]; changeOrders: any[]
  onClose: () => void; onEdit: () => void
}

export default function ProjectDetailView({
  project, client, timesheets, expenses, invoices, teamMembers, changeOrders, onClose, onEdit
}: ProjectDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'hours' | 'resources' | 'financials'>('overview')

  const contractType = getContractType(project)
  const serviceLine = getServiceLine(project)
  const coValue = changeOrders.reduce((s, co) => s + (co.budget || 0), 0)
  const coSpent = changeOrders.reduce((s, co) => s + (co.spent || 0), 0)

  // ============ HOURS ============
  const hours = useMemo(() => {
    const pts = timesheets.filter(t => t.project_id === project.id)
    const total = pts.reduce((s, t) => s + (t.hours || 0), 0)
    const billable = pts.filter(t => t.billable).reduce((s, t) => s + (t.hours || 0), 0)
    const nonBillable = total - billable
    const billableRatio = total > 0 ? (billable / total) * 100 : 0
    const budgeted = project.budgeted_hours || 0
    const remaining = budgeted - total
    const utilization = budgeted > 0 ? (total / budgeted) * 100 : 0

    const weekly: { week: string; billable: number; nonBillable: number }[] = []
    const now = new Date()
    for (let i = 7; i >= 0; i--) {
      const ws = new Date(now); ws.setDate(ws.getDate() - (i * 7) - ws.getDay())
      const we = new Date(ws); we.setDate(we.getDate() + 6)
      const label = ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const entries = pts.filter(t => { const d = new Date(t.date); return d >= ws && d <= we })
      weekly.push({
        week: label,
        billable: entries.filter(t => t.billable).reduce((s, t) => s + (t.hours || 0), 0),
        nonBillable: entries.filter(t => !t.billable).reduce((s, t) => s + (t.hours || 0), 0),
      })
    }
    return { total, billable, nonBillable, billableRatio, budgeted, remaining, utilization, weekly }
  }, [timesheets, project])

  // ============ ECONOMICS ============
  const econ = useMemo(() => calculateProjectEconomics(project, {
    coValue, coSpent, totalHours: hours.total, billableHours: hours.billable,
    billRate: project.bill_rate, monthsActive: getMonthsActive(project.start_date),
  }), [project, coValue, coSpent, hours])

  // ============ RESOURCES ============
  const resources = useMemo(() => {
    const pts = timesheets.filter(t => t.project_id === project.id)
    const byMember = new Map<string, { id: string; name: string; hours: number; billable: number; cost: number }>()
    pts.forEach(t => {
      const mid = t.contractor_id || t.user_id || 'unknown'
      const member = teamMembers.find(m => m.id === mid)
      const ex = byMember.get(mid) || { id: mid, name: member?.name || 'Unknown', hours: 0, billable: 0, cost: 0 }
      ex.hours += t.hours || 0
      if (t.billable) ex.billable += t.hours || 0
      ex.cost += (t.hours || 0) * (t.cost_rate || member?.cost_rate || 0)
      byMember.set(mid, ex)
    })
    return Array.from(byMember.values()).sort((a, b) => b.hours - a.hours).map(m => ({
      ...m,
      pct: hours.total > 0 ? (m.hours / hours.total) * 100 : 0,
      costPerHour: m.hours > 0 ? m.cost / m.hours : 0,
      billableRatio: m.hours > 0 ? (m.billable / m.hours) * 100 : 0,
    }))
  }, [timesheets, project, teamMembers, hours.total])

  const projectExpenses = expenses.filter(e => e.project_id === project.id)
  const expenseTotal = projectExpenses.reduce((s, e) => s + (e.amount || 0), 0)
  const laborCost = resources.reduce((s, r) => s + r.cost, 0)

  const invMetrics = useMemo(() => {
    const pinv = invoices.filter(inv => inv.project_id === project.id)
    const total = pinv.reduce((s, inv) => s + (inv.amount || 0), 0)
    const paid = pinv.filter(inv => inv.status === 'paid').reduce((s, inv) => s + (inv.amount || 0), 0)
    return { total, paid, outstanding: total - paid, realization: econ.totalContract > 0 ? (total / econ.totalContract) * 100 : 0, count: pinv.length, list: pinv }
  }, [invoices, project, econ.totalContract])

  const wip = econ.totalCosts - invMetrics.total

  const resourcePieData = resources.slice(0, 6).map(r => ({ name: r.name.split(' ')[0], value: r.hours }))
  const resourceColors = [COLORS.emerald, COLORS.blue, COLORS.amber, COLORS.cyan, COLORS.purple, COLORS.orange]

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { id: 'hours' as const, label: 'Hours', icon: Clock },
    { id: 'resources' as const, label: 'Resources', icon: Users },
    { id: 'financials' as const, label: 'Financials', icon: DollarSign },
  ]

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-start justify-center z-50 overflow-y-auto py-8">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-5xl mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><ArrowLeft size={18} className="text-slate-500" /></button>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-semibold text-slate-900">{project.name}</h2>
                <StatusBadge status={project.status} />
                <ContractBadge type={contractType} />
                <MarginBadge value={econ.margin} />
              </div>
              <p className="text-sm text-slate-400 mt-0.5">
                {client?.name || 'No Client'} • {serviceLine}
                {project.start_date && ` • ${formatDateShort(project.start_date)}`}
                {project.end_date && ` – ${formatDateShort(project.end_date)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="px-3 py-1.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors">Edit</button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><X size={18} className="text-slate-400" /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 border-b border-slate-200 px-6">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all ${
                activeTab === tab.id ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
              <tab.icon size={14} />{tab.label}
            </button>
          ))}
        </div>

        <div className="p-6 max-h-[70vh] overflow-y-auto">

          {/* ============ OVERVIEW ============ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Contract-Specific Analysis */}
              {contractType === 'lump_sum' && econ.ls && (
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-700">LUMP SUM</span>
                    <span className="text-xs text-slate-400">Fixed fee — profitability depends on delivery efficiency</span>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500 block">Fee</span>
                      <span className="text-lg font-bold text-slate-900 tabular-nums">{formatCompactCurrency(econ.ls.fee)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">% Complete</span>
                      <span className="text-lg font-bold text-slate-900 tabular-nums">{econ.ls.pctComplete}%</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Fee Earned</span>
                      <span className="text-lg font-bold text-blue-600 tabular-nums">{formatCompactCurrency(econ.ls.feeEarned)}</span>
                      <p className="text-xs text-slate-400 mt-0.5">{econ.ls.pctComplete}% × {formatCompactCurrency(econ.ls.fee)}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Costs to Date</span>
                      <span className="text-lg font-bold text-rose-600 tabular-nums">{formatCompactCurrency(econ.ls.costs)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Over / Under</span>
                      <span className={`text-lg font-bold tabular-nums ${econ.ls.overUnder >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatVariance(econ.ls.overUnder)}
                      </span>
                      <p className="text-xs text-slate-400 mt-0.5">{econ.ls.overUnder >= 0 ? 'Under budget — good' : 'Over budget — costs ahead of earned'}</p>
                    </div>
                  </div>
                  {/* Projected at completion */}
                  <div className="mt-4 pt-4 border-t border-blue-200/50 grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500 block">Projected Total Cost</span>
                      <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(econ.ls.projectedTotalCost)}</span>
                      <p className="text-xs text-slate-400">If current cost pace holds</p>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Projected Profit</span>
                      <span className={`font-bold tabular-nums ${econ.ls.projectedProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(econ.ls.projectedProfit)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Projected Margin</span>
                      <MarginIndicator value={econ.ls.projectedMargin} />
                      <p className="text-xs text-slate-400">vs {formatPercent(econ.ls.marginOnEarned)} on earned</p>
                    </div>
                  </div>
                </div>
              )}

              {contractType === 'time_and_materials' && econ.tm && (
                <div className="bg-purple-50/50 border border-purple-100 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-purple-100 text-purple-700">TIME & MATERIALS</span>
                    <span className="text-xs text-slate-400">Billing hours against a contract cap</span>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-sm">
                    <div>
                      <span className="text-slate-500 block">Contract Cap</span>
                      <span className="text-lg font-bold text-slate-900 tabular-nums">{formatCompactCurrency(econ.tm.cap)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Billed</span>
                      <span className="text-lg font-bold text-purple-600 tabular-nums">{formatCompactCurrency(econ.tm.billed)}</span>
                      <p className="text-xs text-slate-400 mt-0.5">{econ.tm.billableHours} hrs × ${econ.tm.billRate}/hr</p>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Cap Remaining</span>
                      <span className={`text-lg font-bold tabular-nums ${econ.tm.capRemaining > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatCompactCurrency(econ.tm.capRemaining)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Cap Used</span>
                      <span className="text-lg font-bold text-slate-900 tabular-nums">{formatPercent(econ.tm.capUtilization)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Margin on Billed</span>
                      <MarginIndicator value={econ.tm.margin} />
                      <p className="text-xs text-slate-400 mt-0.5">{formatCurrency(econ.tm.profit)} profit</p>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-purple-200/50">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">Cap Utilization</span>
                      <span className="font-semibold text-slate-700">{formatPercent(econ.tm.capUtilization)}</span>
                    </div>
                    <ProgressBar value={econ.tm.billed} max={econ.tm.cap} size="md" color="blue" />
                    {econ.tm.hoursRemainingAtCap > 0 && (
                      <p className="text-xs text-slate-400 mt-2">~{econ.tm.hoursRemainingAtCap.toFixed(0)} hours of capacity remaining at current cost rate</p>
                    )}
                  </div>
                </div>
              )}

              {/* Standard KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard label="Total Contract" value={formatCompactCurrency(econ.totalContract)} subtitle={changeOrders.length > 0 ? `+${changeOrders.length} COs (${formatCompactCurrency(coValue)})` : 'Base contract'} icon={Briefcase} color="blue" />
                <KPICard label="Gross Profit" value={formatCompactCurrency(econ.grossProfit)} subtitle={`${formatPercent(econ.margin)} margin`} icon={TrendingUp} color={econ.margin >= 20 ? 'emerald' : econ.margin >= 10 ? 'amber' : 'rose'} />
                <KPICard label="Monthly Burn" value={formatCompactCurrency(econ.monthlyBurn)} subtitle={econ.monthsRemaining > 0 ? `${econ.monthsRemaining.toFixed(1)} months runway` : 'No data'} icon={Clock} color={econ.monthsRemaining > 3 ? 'emerald' : econ.monthsRemaining > 1 ? 'amber' : 'rose'} />
                <KPICard label="Realization" value={formatPercent(invMetrics.realization)} subtitle={`${formatCurrency(invMetrics.total)} invoiced`} icon={Receipt} color={invMetrics.realization >= 80 ? 'emerald' : 'amber'} />
              </div>

              {/* Budget Burn + Hours side by side */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-slate-50 rounded-xl p-5">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Budget Burn</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-600">Spent</span>
                        <span className="font-semibold text-slate-900">{formatCurrency(econ.totalCosts)} of {formatCurrency(econ.totalContract)}</span>
                      </div>
                      <ProgressBar value={econ.totalCosts} max={econ.totalContract} size="md" />
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                      <span className="text-slate-500">Remaining</span>
                      <span className="font-semibold text-slate-700">{formatCurrency(econ.remaining)}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-5">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Hours</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-slate-600">Hours Logged</span>
                        <span className="font-semibold text-slate-900">{hours.total.toLocaleString()}{hours.budgeted > 0 ? ` of ${hours.budgeted}` : ''}</span>
                      </div>
                      {hours.budgeted > 0 && <ProgressBar value={hours.total} max={hours.budgeted} size="md" color="blue" />}
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                      <span className="text-slate-500">Billable ratio</span>
                      <span className={`font-semibold ${hours.billableRatio >= 80 ? 'text-emerald-600' : hours.billableRatio >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>{formatPercent(hours.billableRatio)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Change Orders */}
              {changeOrders.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Change Orders ({changeOrders.length}) — {formatCurrency(coValue)}</h4>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {changeOrders.map(co => {
                      const coMargin = co.budget > 0 ? ((co.budget - (co.spent || 0)) / co.budget) * 100 : 0
                      return (
                        <div key={co.id} className="flex items-center justify-between px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-cyan-50 text-cyan-700 border border-cyan-200">CO</span>
                            <span className="text-sm font-medium text-slate-700">{co.name}</span>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <span className="text-slate-500">{formatCurrency(co.budget || 0)}</span>
                            <MarginIndicator value={coMargin} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============ HOURS ============ */}
          {activeTab === 'hours' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard label="Total Hours" value={hours.total.toLocaleString()} subtitle={hours.budgeted > 0 ? `${hours.remaining.toFixed(0)} remaining` : 'No budget set'} icon={Clock} color="blue" />
                <KPICard label="Billable" value={hours.billable.toLocaleString()} subtitle={`${formatPercent(hours.billableRatio)} ratio`} icon={CheckCircle2} color="emerald" />
                <KPICard label="Non-Billable" value={hours.nonBillable.toLocaleString()} subtitle={`${formatPercent(100 - hours.billableRatio)} of total`} icon={Activity} color={hours.billableRatio < 70 ? 'amber' : 'slate'} />
                <KPICard label="Cost / Hour" value={hours.total > 0 ? `$${(econ.totalCosts / hours.total).toFixed(0)}` : '—'} subtitle="What each hour costs me" icon={DollarSign} color="purple" />
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h4 className="text-sm font-semibold text-slate-900 mb-4">Weekly Hours (Last 8 Weeks)</h4>
                <div className="h-52">
                  {hours.weekly.some(w => w.billable > 0 || w.nonBillable > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hours.weekly} margin={{ left: 0, right: 0, top: 5, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="week" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip formatter={(v: number) => `${v.toFixed(1)} hrs`} />} />
                        <Bar dataKey="billable" name="Billable" fill={COLORS.emerald} radius={[4, 4, 0, 0]} stackId="a" />
                        <Bar dataKey="nonBillable" name="Non-Billable" fill={COLORS.slate} radius={[4, 4, 0, 0]} stackId="a" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="flex items-center justify-center h-full text-slate-400">No timesheet data</div>}
                </div>
              </div>

              {hours.budgeted > 0 && (
                <div className="bg-slate-50 rounded-xl p-5">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-slate-700">Hours Budget</span>
                    <span className={`font-bold ${hours.utilization > 100 ? 'text-rose-600' : hours.utilization > 85 ? 'text-amber-600' : 'text-emerald-600'}`}>{formatPercent(hours.utilization)}</span>
                  </div>
                  <ProgressBar value={hours.total} max={hours.budgeted} size="md" />
                  <div className="flex justify-between text-xs text-slate-400 mt-2">
                    <span>{hours.total.toLocaleString()} used</span>
                    <span>{hours.remaining > 0 ? `${hours.remaining.toFixed(0)} remaining` : `${Math.abs(hours.remaining).toFixed(0)} over`}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============ RESOURCES ============ */}
          {activeTab === 'resources' && (
            <div className="space-y-6">
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-12 lg:col-span-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-5 h-full">
                    <h4 className="text-sm font-semibold text-slate-900 mb-4">Hours Distribution</h4>
                    {resourcePieData.length > 0 ? (
                      <>
                        <div className="h-40">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart><Pie data={resourcePieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                              {resourcePieData.map((_, i) => <Cell key={i} fill={resourceColors[i % resourceColors.length]} />)}
                            </Pie><Tooltip content={<CustomTooltip formatter={(v: number) => `${v.toFixed(1)} hrs`} />} /></PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="space-y-1.5 mt-3">
                          {resourcePieData.map((r, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: resourceColors[i % resourceColors.length] }} />
                                <span className="text-slate-600">{r.name}</span>
                              </div>
                              <span className="font-medium text-slate-900 tabular-nums">{r.value.toFixed(1)}h</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No team data</div>}
                  </div>
                </div>
                <div className="col-span-12 lg:col-span-8">
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-slate-200 bg-slate-50">
                      <h4 className="text-sm font-semibold text-slate-900">Team Allocation</h4>
                    </div>
                    {resources.length > 0 ? (
                      <>
                        <div className="flex items-center gap-3 px-5 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                          <div className="flex-1">Name</div>
                          <div className="w-16 text-right">Hours</div>
                          <div className="w-16 text-right">Billable</div>
                          <div className="w-16 text-right">Ratio</div>
                          <div className="w-16 text-right">Cost/Hr</div>
                          <div className="w-20 text-right">Total Cost</div>
                          <div className="w-20 text-center">% of Project</div>
                        </div>
                        <div className="divide-y divide-slate-50">
                          {resources.map(r => (
                            <div key={r.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                              <div className="flex-1"><span className="text-sm font-medium text-slate-700">{r.name}</span></div>
                              <div className="w-16 text-right text-sm font-medium text-slate-900 tabular-nums">{r.hours.toFixed(1)}</div>
                              <div className="w-16 text-right text-sm text-emerald-600 tabular-nums">{r.billable.toFixed(1)}</div>
                              <div className="w-16 text-right">
                                <span className={`text-sm font-medium ${r.billableRatio >= 80 ? 'text-emerald-600' : r.billableRatio >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>{formatPercent(r.billableRatio)}</span>
                              </div>
                              <div className="w-16 text-right text-sm text-slate-600 tabular-nums">{r.costPerHour > 0 ? `$${r.costPerHour.toFixed(0)}` : '—'}</div>
                              <div className="w-20 text-right text-sm text-slate-700 tabular-nums">{formatCompactCurrency(r.cost)}</div>
                              <div className="w-20">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                    <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${r.pct}%` }} />
                                  </div>
                                  <span className="text-xs text-slate-400 w-8 text-right tabular-nums">{r.pct.toFixed(0)}%</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        {resources.length > 0 && (
                          <div className="flex items-center gap-3 px-5 py-3 border-t-2 border-slate-200 bg-slate-50">
                            <div className="flex-1 font-semibold text-sm text-slate-900">Total</div>
                            <div className="w-16 text-right text-sm font-bold text-slate-900 tabular-nums">{hours.total.toFixed(1)}</div>
                            <div className="w-16 text-right text-sm font-bold text-emerald-600 tabular-nums">{hours.billable.toFixed(1)}</div>
                            <div className="w-16 text-right"><span className="text-sm font-bold text-slate-900">{formatPercent(hours.billableRatio)}</span></div>
                            <div className="w-16"></div>
                            <div className="w-20 text-right text-sm font-bold text-slate-900 tabular-nums">{formatCompactCurrency(laborCost)}</div>
                            <div className="w-20"></div>
                          </div>
                        )}
                      </>
                    ) : <div className="flex items-center justify-center py-12 text-slate-400 text-sm">No team members logged time</div>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============ FINANCIALS ============ */}
          {activeTab === 'financials' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <KPICard label="Contract" value={formatCompactCurrency(econ.totalContract)} subtitle={coValue > 0 ? `Base: ${formatCompactCurrency(econ.totalContract - coValue)}` : 'No COs'} icon={Briefcase} color="blue" />
                <KPICard label="Total Cost" value={formatCompactCurrency(econ.totalCosts)} subtitle={`${econ.totalContract > 0 ? ((econ.totalCosts / econ.totalContract) * 100).toFixed(0) : 0}% of fee`} icon={DollarSign} color="rose" />
                <KPICard label="Invoiced" value={formatCompactCurrency(invMetrics.total)} subtitle={`${invMetrics.count} invoice${invMetrics.count !== 1 ? 's' : ''}`} icon={Receipt} color="amber" />
                <KPICard label="Collected" value={formatCompactCurrency(invMetrics.paid)} subtitle={invMetrics.outstanding > 0 ? `${formatCurrency(invMetrics.outstanding)} AR` : 'Fully collected'} icon={CheckCircle2} color="emerald" />
                <KPICard label="WIP" value={formatCompactCurrency(Math.abs(wip))} subtitle={wip > 0 ? 'Costs ahead of billing' : wip < 0 ? 'Billing ahead of costs' : 'Balanced'} icon={Activity} color={wip > 0 ? 'amber' : 'emerald'} />
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* P&L */}
                <div className="bg-slate-50 rounded-xl p-5">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Project P&L</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-slate-600">Fee (Contract)</span><span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(econ.totalContract)}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-600">(−) Labor</span><span className="font-medium text-slate-700 tabular-nums">({formatCurrency(laborCost)})</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-600">(−) Direct Expenses</span><span className="font-medium text-slate-700 tabular-nums">({formatCurrency(expenseTotal)})</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-600">(−) Other Costs</span><span className="font-medium text-slate-700 tabular-nums">({formatCurrency(Math.max(0, econ.totalCosts - laborCost - expenseTotal))})</span></div>
                    <div className="border-t-2 border-slate-300 pt-2 flex justify-between text-sm">
                      <span className="font-semibold text-slate-900">Gross Profit</span>
                      <span className={`font-bold tabular-nums ${econ.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(econ.grossProfit)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Gross Margin</span>
                      <MarginIndicator value={econ.margin} />
                    </div>
                  </div>
                </div>

                {/* Billing */}
                <div className="bg-slate-50 rounded-xl p-5">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Billing & Collections</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1"><span className="text-slate-600">Invoiced</span><span className="font-medium text-slate-700">{formatPercent(invMetrics.realization)}</span></div>
                      <ProgressBar value={invMetrics.total} max={econ.totalContract} size="md" color="amber" showLabel={false} />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1"><span className="text-slate-600">Collected</span><span className="font-medium text-slate-700">{econ.totalContract > 0 ? formatPercent((invMetrics.paid / econ.totalContract) * 100) : '0%'}</span></div>
                      <ProgressBar value={invMetrics.paid} max={econ.totalContract} size="md" color="emerald" showLabel={false} />
                    </div>
                    <div className="border-t border-slate-200 pt-3 space-y-2">
                      <div className="flex justify-between text-sm"><span className="text-slate-500">Backlog (uninvoiced)</span><span className="font-semibold text-slate-700 tabular-nums">{formatCurrency(econ.totalContract - invMetrics.total)}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-slate-500">WIP</span>
                        <span className={`font-semibold tabular-nums ${wip > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{formatCurrency(Math.abs(wip))}</span>
                      </div>
                      {wip > 0 && <p className="text-xs text-amber-600">Costs are {formatCurrency(wip)} ahead of billing — time to invoice</p>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoices */}
              {invMetrics.list.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-slate-200 bg-slate-50"><h4 className="text-sm font-semibold text-slate-900">Invoices ({invMetrics.count})</h4></div>
                  <div className="divide-y divide-slate-100">
                    {invMetrics.list.map(inv => (
                      <div key={inv.id} className="flex items-center justify-between px-5 py-3">
                        <div>
                          <span className="text-sm font-medium text-slate-700">{inv.invoice_number || `INV-${inv.id?.slice(0, 6)}`}</span>
                          <span className="text-xs text-slate-400 ml-2">{formatDateShort(inv.date || inv.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`px-2 py-0.5 text-[11px] font-semibold rounded ${inv.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : inv.status === 'overdue' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{inv.status || 'pending'}</span>
                          <span className="text-sm font-semibold text-slate-900 tabular-nums">{formatCurrency(inv.amount || 0)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
