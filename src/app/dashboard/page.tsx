'use client'

import React, { useState, useEffect } from 'react'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  FileText, 
  Clock, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight
} from 'lucide-react'
import Link from 'next/link'
import { cn, formatCurrency, formatPercent, colors, getAgingColor } from '@/lib/utils'
import { 
  fetchTransactions, 
  fetchInvoices, 
  fetchProjects,
  fetchClients,
  fetchTimeEntries,
  Transaction,
  Invoice,
  Project
} from '@/lib/supabase'

interface DashboardProps {
  companyId?: string
  theme?: 'light' | 'dark'
}

interface KPICardProps {
  title: string
  value: string
  subtitle?: string
  trend?: { value: number; label: string }
  icon: React.ReactNode
  iconColor: string
  theme: 'light' | 'dark'
  href?: string
}

function KPICard({ title, value, subtitle, trend, icon, iconColor, theme, href }: KPICardProps) {
  const isDark = theme === 'dark'
  const bgClass = isDark ? 'bg-slate-800' : 'bg-white'
  const borderClass = isDark ? 'border-slate-700' : 'border-slate-200'
  const textClass = isDark ? 'text-slate-100' : 'text-slate-800'
  const textMutedClass = isDark ? 'text-slate-400' : 'text-slate-500'

  const content = (
    <div className={cn('p-6 rounded-xl border', bgClass, borderClass, href && 'hover:border-blue-500/50 transition-colors cursor-pointer')}>
      <div className="flex items-start justify-between">
        <div>
          <p className={cn('text-sm font-medium', textMutedClass)}>{title}</p>
          <p className={cn('text-2xl font-semibold mt-1', textClass)}>{value}</p>
          {subtitle && <p className={cn('text-sm mt-1', textMutedClass)}>{subtitle}</p>}
          {trend && (
            <div className={cn('flex items-center gap-1 mt-2 text-sm', trend.value >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
              {trend.value >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              <span>{formatPercent(Math.abs(trend.value))} {trend.label}</span>
            </div>
          )}
        </div>
        <div className={cn('p-3 rounded-lg')} style={{ backgroundColor: `${iconColor}20` }}>
          <div style={{ color: iconColor }}>{icon}</div>
        </div>
      </div>
      {href && (
        <div className={cn('flex items-center gap-1 mt-4 text-sm font-medium text-blue-500')}>
          <span>View details</span>
          <ChevronRight size={16} />
        </div>
      )}
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}

interface AlertItemProps {
  title: string
  description: string
  type: 'warning' | 'danger' | 'info'
  theme: 'light' | 'dark'
  href?: string
}

function AlertItem({ title, description, type, theme, href }: AlertItemProps) {
  const isDark = theme === 'dark'
  const bgClass = isDark ? 'bg-slate-800' : 'bg-white'
  const textClass = isDark ? 'text-slate-100' : 'text-slate-800'
  const textMutedClass = isDark ? 'text-slate-400' : 'text-slate-500'
  
  const typeColors = {
    warning: colors.warning,
    danger: colors.danger,
    info: colors.primary
  }
  
  const content = (
    <div className={cn('flex items-start gap-3 p-4 rounded-lg', bgClass, href && 'hover:ring-1 hover:ring-blue-500/50 transition-all cursor-pointer')}>
      <div className="p-2 rounded-lg" style={{ backgroundColor: `${typeColors[type]}20` }}>
        <AlertTriangle size={18} style={{ color: typeColors[type] }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('font-medium', textClass)}>{title}</p>
        <p className={cn('text-sm', textMutedClass)}>{description}</p>
      </div>
      {href && <ChevronRight size={18} className={textMutedClass} />}
    </div>
  )
  
  if (href) {
    return <Link href={href}>{content}</Link>
  }
  return content
}

export default function DashboardPage({ companyId, theme = 'dark' }: DashboardProps) {
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  
  const isDark = theme === 'dark'
  const bgClass = isDark ? 'bg-slate-800' : 'bg-white'
  const borderClass = isDark ? 'border-slate-700' : 'border-slate-200'
  const textClass = isDark ? 'text-slate-100' : 'text-slate-800'
  const textMutedClass = isDark ? 'text-slate-400' : 'text-slate-500'

  useEffect(() => {
    const loadData = async () => {
      if (!companyId) return
      
      try {
        const [txRes, invRes, projRes] = await Promise.all([
          fetchTransactions(companyId),
          fetchInvoices(companyId),
          fetchProjects(companyId)
        ])
        
        setTransactions(txRes.data || [])
        setInvoices(invRes.data || [])
        setProjects(projRes.data || [])
      } catch (error) {
        console.error('Error loading dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [companyId])

  // Calculate KPIs
  const currentMonth = new Date().toISOString().slice(0, 7)
  const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7)
  
  const currentMonthTx = transactions.filter(t => t.date?.startsWith(currentMonth))
  const lastMonthTx = transactions.filter(t => t.date?.startsWith(lastMonth))
  
  const revenue = transactions.filter(t => t.category === 'revenue').reduce((sum, t) => sum + (t.amount || 0), 0)
  const currentMonthRevenue = currentMonthTx.filter(t => t.category === 'revenue').reduce((sum, t) => sum + (t.amount || 0), 0)
  const lastMonthRevenue = lastMonthTx.filter(t => t.category === 'revenue').reduce((sum, t) => sum + (t.amount || 0), 0)
  const revenueTrend = lastMonthRevenue > 0 ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0
  
  const expenses = transactions.filter(t => ['opex', 'overhead', 'investment'].includes(t.category || '')).reduce((sum, t) => sum + Math.abs(t.amount || 0), 0)
  const currentMonthExpenses = currentMonthTx.filter(t => ['opex', 'overhead', 'investment'].includes(t.category || '')).reduce((sum, t) => sum + Math.abs(t.amount || 0), 0)
  const lastMonthExpenses = lastMonthTx.filter(t => ['opex', 'overhead', 'investment'].includes(t.category || '')).reduce((sum, t) => sum + Math.abs(t.amount || 0), 0)
  const expensesTrend = lastMonthExpenses > 0 ? ((currentMonthExpenses - lastMonthExpenses) / lastMonthExpenses) * 100 : 0
  
  const netCash = revenue - expenses
  
  // AR calculations
  const totalAR = invoices.reduce((sum, inv) => sum + (inv.balance_due || 0), 0)
  const overdueAR = invoices.filter(inv => (inv.days_overdue || 0) > 0).reduce((sum, inv) => sum + (inv.balance_due || 0), 0)
  const arOver60 = invoices.filter(inv => (inv.days_overdue || 0) > 60).reduce((sum, inv) => sum + (inv.balance_due || 0), 0)
  
  // Project stats
  const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'in-progress').length
  
  // Alerts
  const alerts: AlertItemProps[] = []
  
  if (arOver60 > 0) {
    alerts.push({
      title: `${formatCurrency(arOver60)} AR over 60 days`,
      description: `${invoices.filter(inv => (inv.days_overdue || 0) > 60).length} invoices need attention`,
      type: 'danger',
      theme,
      href: '/invoices?filter=overdue'
    })
  }
  
  if (overdueAR > 0 && arOver60 === 0) {
    alerts.push({
      title: `${formatCurrency(overdueAR)} in overdue invoices`,
      description: `${invoices.filter(inv => (inv.days_overdue || 0) > 0).length} invoices past due`,
      type: 'warning',
      theme,
      href: '/invoices?filter=overdue'
    })
  }
  
  if (netCash < 0) {
    alerts.push({
      title: 'Negative cash flow',
      description: `Net cash flow is ${formatCurrency(netCash)}`,
      type: 'danger',
      theme,
      href: '/cash-flow'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className={cn('text-2xl font-semibold', textClass)}>Dashboard</h1>
        <p className={cn('text-sm mt-1', textMutedClass)}>Financial overview and key metrics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Revenue"
          value={formatCurrency(revenue, true)}
          trend={revenueTrend !== 0 ? { value: revenueTrend, label: 'vs last month' } : undefined}
          icon={<TrendingUp size={24} />}
          iconColor={colors.revenue}
          theme={theme}
          href="/cash-flow?filter=revenue"
        />
        <KPICard
          title="Total Expenses"
          value={formatCurrency(expenses, true)}
          trend={expensesTrend !== 0 ? { value: -expensesTrend, label: 'vs last month' } : undefined}
          icon={<TrendingDown size={24} />}
          iconColor={colors.directCost}
          theme={theme}
          href="/cash-flow?filter=expenses"
        />
        <KPICard
          title="Net Cash Flow"
          value={formatCurrency(netCash, true)}
          subtitle={netCash >= 0 ? 'Positive' : 'Negative'}
          icon={<DollarSign size={24} />}
          iconColor={netCash >= 0 ? colors.revenue : colors.danger}
          theme={theme}
          href="/cash-flow"
        />
        <KPICard
          title="Accounts Receivable"
          value={formatCurrency(totalAR, true)}
          subtitle={overdueAR > 0 ? `${formatCurrency(overdueAR, true)} overdue` : 'All current'}
          icon={<FileText size={24} />}
          iconColor={overdueAR > 0 ? colors.warning : colors.primary}
          theme={theme}
          href="/invoices"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Stats */}
        <div className={cn('p-6 rounded-xl border', bgClass, borderClass)}>
          <h2 className={cn('font-semibold mb-4', textClass)}>Quick Stats</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className={textMutedClass}>Active Projects</span>
              <span className={cn('font-semibold', textClass)}>{activeProjects}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={textMutedClass}>Total Clients</span>
              <span className={cn('font-semibold', textClass)}>{projects.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={textMutedClass}>Transactions (MTD)</span>
              <span className={cn('font-semibold', textClass)}>{currentMonthTx.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className={textMutedClass}>Open Invoices</span>
              <span className={cn('font-semibold', textClass)}>{invoices.filter(i => (i.balance_due || 0) > 0).length}</span>
            </div>
          </div>
        </div>

        {/* Alerts */}
        <div className={cn('p-6 rounded-xl border lg:col-span-2', bgClass, borderClass)}>
          <h2 className={cn('font-semibold mb-4', textClass)}>Alerts & Actions</h2>
          {alerts.length > 0 ? (
            <div className="space-y-3">
              {alerts.map((alert, i) => (
                <AlertItem key={i} {...alert} />
              ))}
            </div>
          ) : (
            <div className={cn('text-center py-8', textMutedClass)}>
              <p>No alerts at this time</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className={cn('p-6 rounded-xl border', bgClass, borderClass)}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={cn('font-semibold', textClass)}>Recent Transactions</h2>
          <Link href="/cash-flow" className="text-sm text-blue-500 hover:text-blue-400 font-medium flex items-center gap-1">
            View all <ChevronRight size={16} />
          </Link>
        </div>
        
        {transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={cn('text-left text-sm', textMutedClass)}>
                  <th className="pb-3 font-medium">Date</th>
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium">Category</th>
                  <th className="pb-3 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {transactions.slice(0, 5).map((tx) => (
                  <tr key={tx.id} className={cn('border-t', borderClass)}>
                    <td className={cn('py-3', textMutedClass)}>{tx.date}</td>
                    <td className={cn('py-3', textClass)}>{tx.description || '—'}</td>
                    <td className="py-3">
                      <span 
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                        style={{ 
                          backgroundColor: `${tx.category === 'revenue' ? colors.revenue : tx.category === 'overhead' ? colors.overhead : colors.directCost}20`,
                          color: tx.category === 'revenue' ? colors.revenue : tx.category === 'overhead' ? colors.overhead : colors.directCost
                        }}
                      >
                        {tx.category || 'uncategorized'}
                      </span>
                    </td>
                    <td className={cn('py-3 text-right tabular-nums font-medium', tx.amount >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
                      {formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={cn('text-center py-8', textMutedClass)}>
            <p>No transactions yet</p>
            <Link href="/cash-flow" className="text-blue-500 hover:text-blue-400 text-sm mt-2 inline-block">
              Add your first transaction
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
