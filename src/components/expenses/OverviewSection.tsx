'use client'

import React, { useMemo, useState } from 'react'
import {
  Receipt, DollarSign, TrendingUp, TrendingDown, Briefcase,
  PieChart as PieIcon, BarChart3, Wallet, Users, Building2,
  CreditCard, Landmark, Calendar, ArrowDownLeft, ArrowUpRight
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell
} from 'recharts'
import {
  THEME, COLORS, EXPENSE_CATEGORIES,
  formatCurrency, MetricCard, ExpenseBar, CustomTooltip,
  shortAccountName, CARDHOLDERS
} from './shared'

type ViewType = 'category' | 'client' | 'project' | 'account' | 'cardholder'
type PeriodType = 'monthly' | 'quarterly' | 'ytd' | 'custom'

interface OverviewSectionProps {
  expenses: any[]
  transactions: any[]
  projects: any[]
  clients: any[]
  selectedYear: number
  selectedMonth: string
  categories?: typeof EXPENSE_CATEGORIES
}

// Quarter helpers
const QUARTERS = [
  { label: 'Q1', months: [0, 1, 2] },
  { label: 'Q2', months: [3, 4, 5] },
  { label: 'Q3', months: [6, 7, 8] },
  { label: 'Q4', months: [9, 10, 11] },
]

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const VIEW_COLORS = [
  '#0d9488', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b',
  '#f43f5e', '#06b6d4', '#f97316', '#22c55e', '#64748b',
  '#ec4899', '#14b8a6', '#a855f7', '#eab308', '#6366f1',
]

export default function OverviewSection({
  expenses, transactions, projects, clients, selectedYear, selectedMonth, categories = EXPENSE_CATEGORIES
}: OverviewSectionProps) {
  const CATS = categories

  // View & period state
  const [activeView, setActiveView] = useState<ViewType>('category')
  const [periodType, setPeriodType] = useState<PeriodType>('monthly')
  const [selectedQuarter, setSelectedQuarter] = useState<string>('Q1')
  const [customStart, setCustomStart] = useState(`${selectedYear}-01-01`)
  const [customEnd, setCustomEnd] = useState(`${selectedYear}-12-31`)

  // ============ DATE FILTERING ============
  const filterByDate = (items: any[], dateField = 'date') => {
    return items.filter(item => {
      const d = new Date(item[dateField])
      const year = d.getFullYear()
      const month = d.getMonth()

      if (year !== selectedYear && periodType !== 'custom') return false

      switch (periodType) {
        case 'monthly':
          if (selectedMonth !== 'all') {
            const mi = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(selectedMonth)
            return month === mi
          }
          return true
        case 'quarterly': {
          const q = QUARTERS.find(q => q.label === selectedQuarter)
          return q ? q.months.includes(month) : true
        }
        case 'ytd': {
          const now = new Date()
          return d <= now
        }
        case 'custom': {
          const start = new Date(customStart)
          const end = new Date(customEnd)
          end.setHours(23, 59, 59, 999)
          return d >= start && d <= end
        }
        default:
          return true
      }
    })
  }

  const filteredExpenses = useMemo(() => filterByDate(expenses), [expenses, selectedYear, selectedMonth, periodType, selectedQuarter, customStart, customEnd])
  const filteredTransactions = useMemo(() => filterByDate(transactions), [transactions, selectedYear, selectedMonth, periodType, selectedQuarter, customStart, customEnd])

  // ============ CORE METRICS ============
  const metrics = useMemo(() => {
    const total = filteredExpenses.reduce((s, e) => s + e.amount, 0)
    const directCosts = filteredExpenses.filter(e => e.category === 'directCosts').reduce((s, e) => s + e.amount, 0)
    const overhead = filteredExpenses.filter(e => e.category === 'overhead').reduce((s, e) => s + e.amount, 0)
    const otherBusiness = filteredExpenses.filter(e => e.category === 'otherBusiness').reduce((s, e) => s + e.amount, 0)
    const personal = filteredExpenses.filter(e => e.category === 'personal').reduce((s, e) => s + e.amount, 0)

    // Transaction-level metrics
    const allTxn = filteredTransactions
    const totalInflows = allTxn.filter(t => t.amount >= 0).reduce((s, t) => s + t.amount, 0)
    const totalOutflows = allTxn.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
    const netCashFlow = totalInflows - totalOutflows

    return { total, directCosts, overhead, otherBusiness, personal, totalInflows, totalOutflows, netCashFlow }
  }, [filteredExpenses, filteredTransactions])

  // ============ VIEW-SPECIFIC DATA ============

  // By Category
  const byCategoryData = useMemo(() => {
    const cats = [
      { name: CATS.directCosts?.label || 'Direct Costs', amount: metrics.directCosts, color: CATS.directCosts?.hex || COLORS.rose },
      { name: CATS.overhead?.label || 'Overhead', amount: metrics.overhead, color: CATS.overhead?.hex || COLORS.amber },
      { name: CATS.otherBusiness?.label || 'Other Business', amount: metrics.otherBusiness, color: CATS.otherBusiness?.hex || COLORS.blue },
      { name: CATS.personal?.label || 'Personal', amount: metrics.personal, color: CATS.personal?.hex || COLORS.cyan },
    ].filter(d => d.amount > 0)
    return cats
  }, [metrics, CATS])

  // By Client
  const byClientData = useMemo(() => {
    const map: Record<string, { name: string; amount: number }> = {}
    // From expenses with client_id
    filteredExpenses.filter(e => e.client_id).forEach(e => {
      const c = clients.find(cl => cl.id === e.client_id)
      const name = c?.name || 'Unknown'
      if (!map[name]) map[name] = { name, amount: 0 }
      map[name].amount += e.amount
    })
    // From categorized transactions with client_id
    filteredTransactions.filter(t => t.client_id && t.amount < 0).forEach(t => {
      const c = clients.find(cl => cl.id === t.client_id)
      const name = c?.name || 'Unknown'
      // Only add if not already counted via expenses
      if (!map[name]) map[name] = { name, amount: 0 }
      // Avoid double-counting: skip if transaction was already linked to an expense
      // The expense path already counted it, so we skip here
    })
    const noClient = filteredExpenses.filter(e => !e.client_id).reduce((s, e) => s + e.amount, 0)
    if (noClient > 0) map['General / Unassigned'] = { name: 'General / Unassigned', amount: noClient }
    return Object.values(map).sort((a, b) => b.amount - a.amount)
  }, [filteredExpenses, filteredTransactions, clients])

  // By Project
  const byProjectData = useMemo(() => {
    const map: Record<string, { name: string; amount: number; client: string }> = {}
    filteredExpenses.filter(e => e.project_id).forEach(e => {
      const p = projects.find(pr => pr.id === e.project_id)
      const c = clients.find(cl => cl.id === (p?.client_id || e.client_id))
      const name = p?.name || 'Unknown'
      if (!map[name]) map[name] = { name, amount: 0, client: c?.name || '' }
      map[name].amount += e.amount
    })
    return Object.values(map).sort((a, b) => b.amount - a.amount)
  }, [filteredExpenses, projects, clients])

  // By Account
  const byAccountData = useMemo(() => {
    const map: Record<string, { name: string; inflows: number; outflows: number }> = {}
    filteredTransactions.forEach(t => {
      const acct = shortAccountName(t.account_name || '') || 'Unknown'
      if (!map[acct]) map[acct] = { name: acct, inflows: 0, outflows: 0 }
      if (t.amount >= 0) map[acct].inflows += t.amount
      else map[acct].outflows += Math.abs(t.amount)
    })
    return Object.values(map).sort((a, b) => (b.inflows + b.outflows) - (a.inflows + a.outflows))
  }, [filteredTransactions])

  // By Cardholder
  const byCardholderData = useMemo(() => {
    const map: Record<string, { name: string; amount: number; count: number }> = {}
    filteredTransactions.filter(t => t.cardholder && t.amount < 0).forEach(t => {
      const ch = CARDHOLDERS.find(c => c.id === t.cardholder)
      const name = ch?.name || t.cardholder
      if (!map[name]) map[name] = { name, amount: 0, count: 0 }
      map[name].amount += Math.abs(t.amount)
      map[name].count++
    })
    return Object.values(map).sort((a, b) => b.amount - a.amount)
  }, [filteredTransactions])

  // Monthly chart data
  const monthlyChartData = useMemo(() => {
    return MONTH_NAMES.map((month, i) => {
      const me = expenses.filter(e => {
        const d = new Date(e.date)
        return d.getFullYear() === selectedYear && d.getMonth() === i
      })
      return {
        month,
        directCosts: me.filter(e => e.category === 'directCosts').reduce((s, e) => s + e.amount, 0),
        overhead: me.filter(e => e.category === 'overhead').reduce((s, e) => s + e.amount, 0),
        otherBusiness: me.filter(e => e.category === 'otherBusiness').reduce((s, e) => s + e.amount, 0),
        personal: me.filter(e => e.category === 'personal').reduce((s, e) => s + e.amount, 0),
      }
    })
  }, [expenses, selectedYear])

  // Quarterly chart data
  const quarterlyChartData = useMemo(() => {
    return QUARTERS.map(q => {
      const qExpenses = expenses.filter(e => {
        const d = new Date(e.date)
        return d.getFullYear() === selectedYear && q.months.includes(d.getMonth())
      })
      return {
        quarter: q.label,
        directCosts: qExpenses.filter(e => e.category === 'directCosts').reduce((s, e) => s + e.amount, 0),
        overhead: qExpenses.filter(e => e.category === 'overhead').reduce((s, e) => s + e.amount, 0),
        otherBusiness: qExpenses.filter(e => e.category === 'otherBusiness').reduce((s, e) => s + e.amount, 0),
        personal: qExpenses.filter(e => e.category === 'personal').reduce((s, e) => s + e.amount, 0),
      }
    })
  }, [expenses, selectedYear])

  const chartData = periodType === 'quarterly' ? quarterlyChartData : monthlyChartData
  const chartKey = periodType === 'quarterly' ? 'quarter' : 'month'

  // Period label
  const periodLabel = useMemo(() => {
    switch (periodType) {
      case 'monthly': return selectedMonth === 'all' ? `${selectedYear}` : `${selectedMonth.charAt(0).toUpperCase() + selectedMonth.slice(1)} ${selectedYear}`
      case 'quarterly': return `${selectedQuarter} ${selectedYear}`
      case 'ytd': return `YTD ${selectedYear}`
      case 'custom': return `${customStart} – ${customEnd}`
    }
  }, [periodType, selectedYear, selectedMonth, selectedQuarter, customStart, customEnd])

  // ============ PILL HELPER ============
  const pillClass = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
      active ? 'bg-teal-500/15 text-teal-400 border border-teal-500/25' : 'bg-slate-800/40 text-slate-500 border border-slate-800/60 hover:text-slate-300 hover:bg-slate-800/60'
    }`

  const selectClass = "appearance-none bg-slate-800/60 border border-slate-800/80 rounded-lg pl-3 pr-8 py-1.5 text-xs font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500/30 cursor-pointer"

  // ============ RENDER ============
  return (
    <div className="space-y-5">

      {/* Period Controls */}
      <div className={`${THEME.card} px-5 py-3.5`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Period type pills */}
          <div className="flex items-center gap-2">
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim} mr-1`}>Period:</span>
            {(['monthly', 'quarterly', 'ytd', 'custom'] as PeriodType[]).map(p => (
              <button key={p} onClick={() => setPeriodType(p)} className={pillClass(periodType === p)}>
                {p === 'monthly' ? 'Monthly' : p === 'quarterly' ? 'Quarterly' : p === 'ytd' ? 'YTD' : 'Custom'}
              </button>
            ))}
          </div>

          {/* Period-specific controls */}
          <div className="flex items-center gap-2">
            {periodType === 'quarterly' && (
              <div className="flex items-center gap-1">
                {QUARTERS.map(q => (
                  <button key={q.label} onClick={() => setSelectedQuarter(q.label)} className={pillClass(selectedQuarter === q.label)}>
                    {q.label}
                  </button>
                ))}
              </div>
            )}
            {periodType === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                  className={`${THEME.input} px-2 py-1.5 text-xs`} />
                <span className={`text-xs ${THEME.textDim}`}>to</span>
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                  className={`${THEME.input} px-2 py-1.5 text-xs`} />
              </div>
            )}
            <span className={`text-xs ${THEME.textMuted} ml-2`}>{periodLabel}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard label="Total Outflows" value={formatCurrency(metrics.total)} subtitle={periodLabel} icon={ArrowUpRight} color="rose" />
        <MetricCard label="Direct Costs" value={formatCurrency(metrics.directCosts)} subtitle="Affects Gross Margin" icon={Briefcase} color="rose" />
        <MetricCard label="Overhead" value={formatCurrency(metrics.overhead)} subtitle="Operating expenses" icon={DollarSign} color="amber" />
        <MetricCard label="Total Inflows" value={formatCurrency(metrics.totalInflows)} subtitle="Payments received" icon={ArrowDownLeft} color="emerald" />
        <MetricCard label="Net Cash Flow" value={formatCurrency(metrics.netCashFlow)} subtitle={periodLabel} icon={TrendingUp}
          color={metrics.netCashFlow >= 0 ? 'emerald' : 'rose'} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-12 gap-5">
        {/* Trend Chart */}
        <div className="col-span-12 lg:col-span-8">
          <div className={`${THEME.card} p-6`}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className={`text-sm font-semibold ${THEME.textPrimary}`}>
                  {periodType === 'quarterly' ? 'Quarterly' : 'Monthly'} Expenses
                </h2>
                <p className={`text-xs ${THEME.textDim} mt-0.5`}>{selectedYear} breakdown by category</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {[
                  { label: 'Direct', hex: CATS.directCosts?.hex || COLORS.rose },
                  { label: 'Overhead', hex: CATS.overhead?.hex || COLORS.amber },
                  { label: 'Other', hex: CATS.otherBusiness?.hex || COLORS.blue },
                  { label: 'Personal', hex: CATS.personal?.hex || COLORS.cyan },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: l.hex }} />
                    <span className={THEME.textMuted}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barCategoryGap="20%">
                  <XAxis dataKey={chartKey} tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="directCosts" name="Direct Costs" stackId="a" fill={CATS.directCosts?.hex || COLORS.rose} />
                  <Bar dataKey="overhead" name="Overhead" stackId="a" fill={CATS.overhead?.hex || COLORS.amber} />
                  <Bar dataKey="otherBusiness" name="Other Business" stackId="a" fill={CATS.otherBusiness?.hex || COLORS.blue} />
                  <Bar dataKey="personal" name="Personal" stackId="a" fill={CATS.personal?.hex || COLORS.cyan} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* View Selector + Breakdown Panel */}
        <div className="col-span-12 lg:col-span-4">
          <div className={`${THEME.card} p-5 h-full flex flex-col`}>
            {/* View tabs */}
            <div className="flex flex-wrap gap-1 mb-4">
              {([
                { id: 'category', label: 'Category', icon: PieIcon },
                { id: 'client', label: 'Client', icon: Building2 },
                { id: 'project', label: 'Project', icon: Briefcase },
                { id: 'account', label: 'Account', icon: Landmark },
                { id: 'cardholder', label: 'Cardholder', icon: CreditCard },
              ] as { id: ViewType; label: string; icon: any }[]).map(v => (
                <button key={v.id} onClick={() => setActiveView(v.id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                    activeView === v.id
                      ? 'bg-teal-500/15 text-teal-400 border border-teal-500/25'
                      : 'bg-slate-800/40 text-slate-500 border border-slate-800/60 hover:text-slate-300'
                  }`}>
                  <v.icon size={11} />
                  {v.label}
                </button>
              ))}
            </div>

            {/* Breakdown content */}
            <div className="flex-1 overflow-y-auto">
              {activeView === 'category' && (
                <BreakdownList
                  items={byCategoryData.map((d, i) => ({ name: d.name, value: d.amount, color: d.color }))}
                  total={metrics.total}
                  emptyMessage="No categorized expenses"
                />
              )}

              {activeView === 'client' && (
                <BreakdownList
                  items={byClientData.map((d, i) => ({ name: d.name, value: d.amount, color: VIEW_COLORS[i % VIEW_COLORS.length] }))}
                  total={metrics.total}
                  emptyMessage="No client-assigned expenses"
                />
              )}

              {activeView === 'project' && (
                <BreakdownList
                  items={byProjectData.map((d, i) => ({
                    name: d.name,
                    subtitle: d.client,
                    value: d.amount,
                    color: VIEW_COLORS[i % VIEW_COLORS.length]
                  }))}
                  total={metrics.total}
                  emptyMessage="No project-assigned expenses"
                />
              )}

              {activeView === 'account' && (
                <div className="space-y-3">
                  {byAccountData.length > 0 ? byAccountData.map((acct, i) => (
                    <div key={i} className="bg-slate-800/30 border border-slate-800/60 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Landmark size={14} className="text-teal-400" />
                          <span className={`text-sm font-medium ${THEME.textPrimary}`}>{acct.name}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className={`text-[10px] uppercase tracking-wider ${THEME.textDim}`}>Inflows</p>
                          <p className="text-sm font-semibold text-emerald-400 tabular-nums">{formatCurrency(acct.inflows)}</p>
                        </div>
                        <div>
                          <p className={`text-[10px] uppercase tracking-wider ${THEME.textDim}`}>Outflows</p>
                          <p className="text-sm font-semibold text-rose-400 tabular-nums">{formatCurrency(acct.outflows)}</p>
                        </div>
                      </div>
                    </div>
                  )) : <EmptyState message="No account data" />}
                </div>
              )}

              {activeView === 'cardholder' && (
                <BreakdownList
                  items={byCardholderData.map((d, i) => ({
                    name: d.name,
                    subtitle: `${d.count} transactions`,
                    value: d.amount,
                    color: VIEW_COLORS[i % VIEW_COLORS.length]
                  }))}
                  total={byCardholderData.reduce((s, d) => s + d.amount, 0)}
                  emptyMessage="No cardholder data — assign cardholders in Bank Feed"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Detail Tables Row */}
      <div className="grid grid-cols-12 gap-5">
        {/* Top Expense Types */}
        <div className="col-span-12 lg:col-span-6">
          <div className={`${THEME.card} p-6`}>
            <h2 className={`text-sm font-semibold ${THEME.textPrimary} mb-4`}>Top Expense Types</h2>
            {filteredExpenses.length > 0 ? (
              <div className="space-y-1">
                {(() => {
                  const bySubcat: Record<string, { name: string; amount: number; category: string }> = {}
                  filteredExpenses.forEach(e => {
                    const cat = CATS[e.category as keyof typeof CATS]
                    const sub = cat?.subcategories?.find((s: any) => s.id === e.subcategory)
                    const key = `${e.category}-${e.subcategory}`
                    if (!bySubcat[key]) bySubcat[key] = { name: sub?.name || e.subcategory || 'Other', amount: 0, category: e.category }
                    bySubcat[key].amount += e.amount
                  })
                  return Object.values(bySubcat).sort((a, b) => b.amount - a.amount).slice(0, 8).map((item, i) => {
                    const cat = CATS[item.category as keyof typeof CATS]
                    return <ExpenseBar key={i} label={item.name} amount={item.amount} total={metrics.total} color={cat?.hex || COLORS.slate} />
                  })
                })()}
              </div>
            ) : <EmptyState message="No expenses yet" />}
          </div>
        </div>

        {/* By Project */}
        <div className="col-span-12 lg:col-span-6">
          <div className={`${THEME.card} p-6`}>
            <h2 className={`text-sm font-semibold ${THEME.textPrimary} mb-4`}>By Project</h2>
            {byProjectData.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {byProjectData.slice(0, 6).map((proj, i) => (
                  <div key={i} className="bg-slate-800/30 border border-slate-800/60 rounded-lg p-4 hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center shrink-0">
                        <Briefcase size={18} className="text-teal-400" />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${THEME.textSecondary} truncate`}>{proj.name}</p>
                        {proj.client && <p className={`text-[10px] ${THEME.textDim} truncate`}>{proj.client}</p>}
                        <p className="text-lg font-bold text-teal-400 tabular-nums">{formatCurrency(proj.amount)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState message="No project expenses yet" />}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ REUSABLE BREAKDOWN LIST ============
function BreakdownList({ items, total, emptyMessage }: {
  items: { name: string; subtitle?: string; value: number; color: string }[]
  total: number
  emptyMessage: string
}) {
  if (!items.length) return <EmptyState message={emptyMessage} />

  // Mini donut
  const pieData = items.slice(0, 6).map(d => ({ name: d.name, value: d.value, color: d.color }))

  return (
    <div>
      {pieData.length > 1 && (
        <div className="h-36 mb-3">
          <ResponsiveContainer width="100%" height="100%">
            <RePieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
            </RePieChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="space-y-2">
        {items.map((item, i) => {
          const pct = total > 0 ? (item.value / total * 100).toFixed(0) : '0'
          return (
            <div key={i} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <div className="min-w-0">
                  <p className={`text-xs font-medium ${THEME.textSecondary} truncate`}>{item.name}</p>
                  {item.subtitle && <p className={`text-[10px] ${THEME.textDim} truncate`}>{item.subtitle}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-xs font-semibold tabular-nums ${THEME.textPrimary}`}>{formatCurrency(item.value)}</span>
                <span className={`text-[10px] tabular-nums ${THEME.textDim} w-8 text-right`}>{pct}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className={`flex items-center justify-center py-10 text-sm ${THEME.textMuted}`}>{message}</div>
}
