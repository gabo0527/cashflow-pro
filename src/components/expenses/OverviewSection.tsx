'use client'

import React, { useMemo } from 'react'
import {
  Receipt, DollarSign, TrendingUp, TrendingDown, Briefcase,
  PieChart as PieIcon, BarChart3, Wallet
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, Legend
} from 'recharts'
import {
  THEME, COLORS, EXPENSE_CATEGORIES,
  formatCurrency, MetricCard, ExpenseBar, CustomTooltip
} from './shared'

interface OverviewSectionProps {
  expenses: any[]
  projects: any[]
  selectedYear: number
  selectedMonth: string
  categories?: typeof EXPENSE_CATEGORIES
}

export default function OverviewSection({ expenses, projects, selectedYear, selectedMonth, categories = EXPENSE_CATEGORIES }: OverviewSectionProps) {
  
  // Use custom categories or default
  const CATS = categories
  
  // Filter expenses by period
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const date = new Date(exp.date)
      if (date.getFullYear() !== selectedYear) return false
      if (selectedMonth !== 'all') {
        const monthIndex = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(selectedMonth)
        if (date.getMonth() !== monthIndex) return false
      }
      return true
    })
  }, [expenses, selectedYear, selectedMonth])

  // Calculate metrics
  const metrics = useMemo(() => {
    const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0)
    const directCosts = filteredExpenses.filter(e => e.category === 'directCosts').reduce((sum, e) => sum + e.amount, 0)
    const overhead = filteredExpenses.filter(e => e.category === 'overhead').reduce((sum, e) => sum + e.amount, 0)
    const otherBusiness = filteredExpenses.filter(e => e.category === 'otherBusiness').reduce((sum, e) => sum + e.amount, 0)
    const personal = filteredExpenses.filter(e => e.category === 'personal').reduce((sum, e) => sum + e.amount, 0)
    const pending = filteredExpenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0)
    const pendingCount = filteredExpenses.filter(e => e.status === 'pending').length

    // By subcategory
    const bySubcategory: Record<string, { name: string; amount: number; category: string }> = {}
    filteredExpenses.forEach(exp => {
      const cat = CATS[exp.category as keyof typeof CATS]
      const subcat = cat?.subcategories.find(s => s.id === exp.subcategory)
      const key = `${exp.category}-${exp.subcategory}`
      if (!bySubcategory[key]) {
        bySubcategory[key] = { name: subcat?.name || exp.subcategory, amount: 0, category: exp.category }
      }
      bySubcategory[key].amount += exp.amount
    })

    // By project
    const byProject: Record<string, { name: string; amount: number }> = {}
    filteredExpenses.filter(e => e.project_id).forEach(exp => {
      const proj = projects.find(p => p.id === exp.project_id)
      if (proj) {
        if (!byProject[proj.id]) byProject[proj.id] = { name: proj.name, amount: 0 }
        byProject[proj.id].amount += exp.amount
      }
    })

    return {
      total,
      directCosts,
      overhead,
      otherBusiness,
      personal,
      pending,
      pendingCount,
      bySubcategory: Object.values(bySubcategory).sort((a, b) => b.amount - a.amount),
      byProject: Object.values(byProject).sort((a, b) => b.amount - a.amount)
    }
  }, [filteredExpenses, projects, CATS])

  // Monthly chart data
  const monthlyData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return months.map((month, i) => {
      const monthExpenses = expenses.filter(exp => {
        const date = new Date(exp.date)
        return date.getFullYear() === selectedYear && date.getMonth() === i
      })
      return {
        month,
        directCosts: monthExpenses.filter(e => e.category === 'directCosts').reduce((s, e) => s + e.amount, 0),
        overhead: monthExpenses.filter(e => e.category === 'overhead').reduce((s, e) => s + e.amount, 0),
        otherBusiness: monthExpenses.filter(e => e.category === 'otherBusiness').reduce((s, e) => s + e.amount, 0),
        personal: monthExpenses.filter(e => e.category === 'personal').reduce((s, e) => s + e.amount, 0),
      }
    })
  }, [expenses, selectedYear])

  // Category pie data
  const categoryPieData = useMemo(() => {
    return [
      { name: CATS.directCosts.label, value: metrics.directCosts, color: CATS.directCosts.hex },
      { name: CATS.overhead.label, value: metrics.overhead, color: CATS.overhead.hex },
      { name: CATS.otherBusiness.label, value: metrics.otherBusiness, color: CATS.otherBusiness.hex },
      { name: CATS.personal.label, value: metrics.personal, color: CATS.personal.hex },
    ].filter(d => d.value > 0)
  }, [metrics, CATS])

  const periodLabel = selectedMonth === 'all' ? `${selectedYear}` : `${selectedMonth.charAt(0).toUpperCase() + selectedMonth.slice(1)} ${selectedYear}`

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard 
          label="Total Expenses" 
          value={formatCurrency(metrics.total)} 
          subtitle={periodLabel}
          icon={Receipt} 
          color="slate" 
        />
        <MetricCard 
          label="Direct Costs" 
          value={formatCurrency(metrics.directCosts)} 
          subtitle="Affects Gross Margin"
          icon={Briefcase} 
          color="rose" 
        />
        <MetricCard 
          label="Overhead" 
          value={formatCurrency(metrics.overhead)} 
          subtitle="Operating expenses"
          icon={DollarSign} 
          color="amber" 
        />
        <MetricCard 
          label="Other Business" 
          value={formatCurrency(metrics.otherBusiness)} 
          subtitle="Non-operational"
          icon={TrendingDown} 
          color="blue" 
        />
        <MetricCard 
          label="Pending" 
          value={formatCurrency(metrics.pending)} 
          subtitle={`${metrics.pendingCount} expenses`}
          icon={Wallet} 
          color={metrics.pendingCount > 0 ? 'amber' : 'emerald'} 
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-12 gap-6">
        {/* Monthly Trend */}
        <div className="col-span-12 lg:col-span-8">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-6`}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className={`text-sm font-semibold ${THEME.textPrimary}`}>Monthly Expenses</h2>
                <p className={`text-xs ${THEME.textDim} mt-0.5`}>{selectedYear} breakdown</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATS.directCosts.hex }} />
                  <span className={THEME.textMuted}>Direct</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATS.overhead.hex }} />
                  <span className={THEME.textMuted}>Overhead</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATS.otherBusiness.hex }} />
                  <span className={THEME.textMuted}>Other</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATS.personal.hex }} />
                  <span className={THEME.textMuted}>Personal</span>
                </div>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} barCategoryGap="20%">
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="directCosts" name="Direct Costs" stackId="a" fill={CATS.directCosts.hex} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="overhead" name="Overhead" stackId="a" fill={CATS.overhead.hex} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="otherBusiness" name="Other Business" stackId="a" fill={CATS.otherBusiness.hex} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="personal" name="Personal" stackId="a" fill={CATS.personal.hex} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="col-span-12 lg:col-span-4">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-6 h-full`}>
            <h2 className={`text-sm font-semibold ${THEME.textPrimary} mb-4`}>By Category</h2>
            {categoryPieData.length > 0 ? (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie data={categoryPieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                        {categoryPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-4">
                  {categoryPieData.map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className={`text-xs ${THEME.textSecondary}`}>{item.name}</span>
                      </div>
                      <span className={`text-xs font-semibold ${THEME.textPrimary}`}>{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className={`flex items-center justify-center h-44 ${THEME.textMuted} text-sm`}>No expenses yet</div>
            )}
          </div>
        </div>
      </div>

      {/* By Subcategory & By Project */}
      <div className="grid grid-cols-12 gap-6">
        {/* By Subcategory */}
        <div className="col-span-12 lg:col-span-6">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-6`}>
            <h2 className={`text-sm font-semibold ${THEME.textPrimary} mb-4`}>Top Expense Types</h2>
            {metrics.bySubcategory.length > 0 ? (
              <div className="space-y-1">
                {metrics.bySubcategory.slice(0, 6).map((item, i) => {
                  const cat = CATS[item.category as keyof typeof CATS]
                  return (
                    <ExpenseBar key={i} label={item.name} amount={item.amount} total={metrics.total} color={cat?.hex || COLORS.slate} />
                  )
                })}
              </div>
            ) : (
              <p className={`text-sm ${THEME.textMuted} text-center py-8`}>No expenses yet</p>
            )}
          </div>
        </div>

        {/* By Project */}
        <div className="col-span-12 lg:col-span-6">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-6`}>
            <h2 className={`text-sm font-semibold ${THEME.textPrimary} mb-4`}>By Project</h2>
            {metrics.byProject.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {metrics.byProject.slice(0, 6).map((proj, i) => (
                  <div key={i} className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-4 hover:bg-white/[0.05] transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <Briefcase size={18} className="text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${THEME.textSecondary} truncate`}>{proj.name}</p>
                        <p className="text-lg font-bold text-emerald-400">{formatCurrency(proj.amount)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-sm ${THEME.textMuted} text-center py-8`}>No project expenses yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
