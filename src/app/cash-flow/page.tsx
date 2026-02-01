'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  TrendingUp, TrendingDown, DollarSign, CreditCard, Wallet, Building2,
  ChevronRight, ChevronDown, ChevronUp, Plus, RefreshCw, ArrowUpRight, 
  ArrowDownRight, Percent, Receipt, PiggyBank
} from 'lucide-react'
import Link from 'next/link'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// ============ GLASSMORPHISM THEME ============
const THEME = {
  glass: 'bg-slate-900/70 backdrop-blur-xl',
  glassBorder: 'border-white/[0.08]',
  glassHover: 'hover:bg-white/[0.05] hover:border-white/[0.12]',
  textPrimary: 'text-white',
  textSecondary: 'text-slate-300',
  textMuted: 'text-slate-400',
  textDim: 'text-slate-500',
  chart: {
    primary: '#10B981',
    secondary: '#64748b',
    negative: '#EF4444',
    grid: 'rgba(255,255,255,0.06)',
    axis: '#64748b',
  }
}

// ============ UTILITIES ============
const formatCurrency = (value: number, compact = false): string => {
  if (compact && Math.abs(value) >= 1000000) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value)
  }
  if (compact && Math.abs(value) >= 10000) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 0 }).format(value)
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ============ COMPONENTS ============

// Glass KPI Card
function MetricCard({ 
  label, 
  value, 
  subValue, 
  trend, 
  trendLabel,
  icon: Icon,
  href,
  valueColor = 'text-white'
}: { 
  label: string
  value: string
  subValue?: string
  trend?: number
  trendLabel?: string
  icon: any
  href?: string
  valueColor?: string
}) {
  const content = (
    <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-6 transition-all duration-200 ${THEME.glassHover} group`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <p className={`text-sm font-medium ${THEME.textMuted}`}>{label}</p>
          <p className={`text-2xl font-semibold tracking-tight ${valueColor}`}>{value}</p>
          {subValue && (
            <p className={`text-xs mt-1 ${THEME.textDim}`}>{subValue}</p>
          )}
          {trend !== undefined && (
            <div className="flex items-center gap-1.5 pt-1">
              {trend >= 0 ? (
                <ArrowUpRight size={14} className="text-emerald-400" />
              ) : (
                <ArrowDownRight size={14} className="text-rose-400" />
              )}
              <span className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {Math.abs(trend).toFixed(1)}%
              </span>
              {trendLabel && <span className={`text-xs ${THEME.textDim}`}>{trendLabel}</span>}
            </div>
          )}
        </div>
        <div className="p-2.5 rounded-lg bg-white/[0.05] group-hover:bg-white/[0.08] transition-colors">
          <Icon size={20} className={THEME.textMuted} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  )
  
  if (href) return <Link href={href} className="block">{content}</Link>
  return content
}

// Glass Section Card
function Section({ 
  title, 
  subtitle, 
  action, 
  children,
  noPadding = false,
  collapsible = false,
  defaultExpanded = true,
  badge
}: { 
  title: string
  subtitle?: string
  action?: { label: string; href?: string; onClick?: () => void }
  children: React.ReactNode
  noPadding?: boolean
  collapsible?: boolean
  defaultExpanded?: boolean
  badge?: string | number
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
      <div 
        className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder} ${collapsible ? 'cursor-pointer hover:bg-white/[0.03] transition-colors' : ''}`}
        onClick={collapsible ? () => setIsExpanded(!isExpanded) : undefined}
      >
        <div className="flex items-center gap-3">
          {collapsible && (
            <div className={THEME.textMuted}>
              {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>{title}</h3>
              {badge !== undefined && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-white/[0.08] text-slate-300">{badge}</span>
              )}
            </div>
            {subtitle && <p className={`text-xs mt-0.5 ${THEME.textDim}`}>{subtitle}</p>}
          </div>
        </div>
        {action && !collapsible && (
          action.onClick ? (
            <button 
              onClick={action.onClick}
              className={`text-xs font-medium ${THEME.textMuted} hover:text-white flex items-center gap-0.5 transition-colors`}
            >
              {action.label}
              <ChevronRight size={14} />
            </button>
          ) : (
            <Link 
              href={action.href || '#'} 
              className={`text-xs font-medium ${THEME.textMuted} hover:text-white flex items-center gap-0.5 transition-colors`}
            >
              {action.label}
              <ChevronRight size={14} />
            </Link>
          )
        )}
      </div>
      {(!collapsible || isExpanded) && (
        <div className={noPadding ? '' : 'p-6'}>
          {children}
        </div>
      )}
    </div>
  )
}

// Glass P&L Row
function PLRow({ 
  label, 
  value, 
  percentage, 
  type,
  indent = false,
  bold = false
}: { 
  label: string
  value: number
  percentage?: number
  type: 'positive' | 'negative' | 'neutral' | 'muted'
  indent?: boolean
  bold?: boolean
}) {
  const colorMap = {
    positive: 'text-emerald-400',
    negative: 'text-rose-400',
    neutral: 'text-white',
    muted: 'text-slate-400'
  }
  const barColorMap = {
    positive: '#10B981',
    negative: '#EF4444',
    neutral: '#64748b',
    muted: 'rgba(255,255,255,0.1)'
  }
  
  return (
    <div className={`flex items-center justify-between py-3.5 ${indent ? 'pl-6' : ''}`}>
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <span className={`text-sm ${bold ? `font-semibold ${THEME.textPrimary}` : indent ? THEME.textMuted : `font-medium ${THEME.textSecondary}`}`}>
          {label}
        </span>
        {percentage !== undefined && (
          <div className="flex-1 max-w-40 hidden sm:block">
            <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-500"
                style={{ 
                  width: `${Math.min(Math.abs(percentage), 100)}%`,
                  backgroundColor: barColorMap[type]
                }}
              />
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-sm tabular-nums ${bold ? 'font-bold' : 'font-semibold'} ${colorMap[type]}`}>
          {formatCurrency(value)}
        </span>
        {percentage !== undefined && (
          <span className={`text-xs w-12 text-right tabular-nums ${THEME.textDim}`}>{percentage.toFixed(1)}%</span>
        )}
      </div>
    </div>
  )
}

// Glass Chart Tooltip
const ChartTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-lg px-3 py-2 shadow-xl`}>
      <p className={`text-xs ${THEME.textDim} mb-1`}>{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  )
}

// ============ MAIN COMPONENT ============
export default function CashFlowPage() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [companySettings, setCompanySettings] = useState<any>(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('en-US', { month: 'long' }))
  const [showAllTransactions, setShowAllTransactions] = useState(false)

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const years = [2026, 2025, 2024, 2023]

  // Data fetching - matches original page tables
  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await getCurrentUser()
        const user = result?.user
        if (!user) { setLoading(false); return }

        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
        if (!profile?.company_id) { setLoading(false); return }

        setCompanyId(profile.company_id)

        // Pull from same tables as original Cash Flow page
        const [txRes, invRes, expRes, projRes, clientRes, settingsRes] = await Promise.all([
          supabase.from('transactions').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
          supabase.from('invoices').select('*').eq('company_id', profile.company_id).order('invoice_date', { ascending: false }),
          supabase.from('expenses').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
          supabase.from('projects').select('*').eq('company_id', profile.company_id),
          supabase.from('clients').select('*').eq('company_id', profile.company_id),
          supabase.from('company_settings').select('*').eq('company_id', profile.company_id).single()
        ])

        setTransactions(txRes.data || [])
        setInvoices(invRes.data || [])
        setExpenses(expRes.data || [])
        setProjects(projRes.data || [])
        setClients(clientRes.data || [])
        setCompanySettings(settingsRes.data)
      } catch (error) {
        console.error('Error loading cash flow:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Period filtering
  const periodRange = useMemo(() => {
    const monthIndex = months.indexOf(selectedMonth)
    const startDate = new Date(selectedYear, monthIndex, 1)
    const endDate = new Date(selectedYear, monthIndex + 1, 0, 23, 59, 59)
    return { startDate, endDate }
  }, [selectedYear, selectedMonth])

  const filteredInvoices = useMemo(() => invoices.filter(inv => {
    const d = new Date(inv.invoice_date || inv.created_at)
    return d >= periodRange.startDate && d <= periodRange.endDate
  }), [invoices, periodRange])

  const filteredExpenses = useMemo(() => expenses.filter(exp => {
    const d = new Date(exp.date)
    return d >= periodRange.startDate && d <= periodRange.endDate
  }), [expenses, periodRange])

  const filteredTransactions = useMemo(() => transactions.filter(tx => {
    const d = new Date(tx.date)
    return d >= periodRange.startDate && d <= periodRange.endDate
  }), [transactions, periodRange])

  // Metrics calculation - matches original logic
  const metrics = useMemo(() => {
    // Cash position from company settings
    const cashOnHand = companySettings?.beginning_balance || 0
    
    // Credit card debt from transactions (negative CC transactions)
    const creditCardDebt = Math.abs(
      transactions
        .filter(tx => tx.account_type === 'credit_card' && tx.amount < 0)
        .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0)
    )
    
    const netPosition = cashOnHand - creditCardDebt

    // Revenue from invoices
    const revenue = filteredInvoices.reduce((sum, inv) => 
      sum + (parseFloat(inv.amount) || parseFloat(inv.total_amount) || 0), 0)

    // Expenses breakdown - uses category field (directCosts vs overhead)
    const directCosts = filteredExpenses
      .filter(e => e.category === 'directCosts')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
    
    const overhead = filteredExpenses
      .filter(e => e.category === 'overhead')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
    
    const totalExpenses = directCosts + overhead

    // Profit calculations
    const grossProfit = revenue - directCosts
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0
    const netProfit = grossProfit - overhead
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0

    // Open invoices (current state, not period filtered)
    const openInvoices = invoices.filter(inv => 
      (parseFloat(inv.balance_due) || parseFloat(inv.balance) || 0) > 0
    )
    const totalAR = openInvoices.reduce((sum, inv) => 
      sum + (parseFloat(inv.balance_due) || parseFloat(inv.balance) || 0), 0)
    const overdueAR = openInvoices
      .filter(inv => new Date(inv.due_date) < new Date())
      .reduce((sum, inv) => sum + (parseFloat(inv.balance_due) || parseFloat(inv.balance) || 0), 0)

    // Expense by category for breakdown
    const expenseByCategory: { [key: string]: number } = {}
    filteredExpenses.forEach(exp => {
      const cat = exp.description || exp.vendor || 'Other'
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + (parseFloat(exp.amount) || 0)
    })

    // Previous month comparison
    const prevMonthIndex = months.indexOf(selectedMonth) - 1
    const prevYear = prevMonthIndex < 0 ? selectedYear - 1 : selectedYear
    const prevMonth = prevMonthIndex < 0 ? 11 : prevMonthIndex
    const prevStart = new Date(prevYear, prevMonth, 1)
    const prevEnd = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59)
    
    const prevRevenue = invoices.filter(inv => {
      const d = new Date(inv.invoice_date || inv.created_at)
      return d >= prevStart && d <= prevEnd
    }).reduce((sum, inv) => sum + (parseFloat(inv.amount) || parseFloat(inv.total_amount) || 0), 0)
    
    const revenueChange = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0

    return {
      cashOnHand,
      creditCardDebt,
      netPosition,
      revenue,
      directCosts,
      overhead,
      totalExpenses,
      grossProfit,
      grossMargin,
      netProfit,
      netMargin,
      totalAR,
      overdueAR,
      openInvoicesCount: openInvoices.length,
      expenseByCategory,
      revenueChange
    }
  }, [companySettings, transactions, filteredInvoices, filteredExpenses, invoices, selectedMonth, selectedYear])

  // Revenue by project
  const revenueByProject = useMemo(() => {
    const projectRevenue: { [key: string]: number } = {}
    
    filteredInvoices.forEach(inv => {
      const project = projects.find(p => p.id === inv.project_id)
      const name = project?.name || 'Unassigned'
      projectRevenue[name] = (projectRevenue[name] || 0) + (parseFloat(inv.amount) || parseFloat(inv.total_amount) || 0)
    })

    // Glass theme colors
    const colors = ['#10B981', '#64748b', '#94a3b8', '#cbd5e1', '#475569']
    
    return Object.entries(projectRevenue)
      .map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }))
      .filter(p => p.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [filteredInvoices, projects])

  // Display transactions (limited unless expanded)
  const displayTransactions = useMemo(() => {
    const sorted = [...filteredTransactions].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    return showAllTransactions ? sorted : sorted.slice(0, 5)
  }, [filteredTransactions, showAllTransactions])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw size={24} className="text-emerald-500 animate-spin" />
          <p className={`text-sm ${THEME.textMuted}`}>Loading cash flow...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-xl font-semibold ${THEME.textPrimary}`}>Cash Flow</h1>
          <p className={`text-sm mt-1 ${THEME.textMuted}`}>Real-time cash position & profitability</p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Year selector */}
          <div className="relative">
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="appearance-none bg-white/[0.05] border border-white/[0.1] rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 cursor-pointer"
            >
              {years.map(year => (
                <option key={year} value={year} className="bg-slate-900">{year}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
          
          {/* Month selector */}
          <div className="relative">
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none bg-white/[0.05] border border-white/[0.1] rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 cursor-pointer"
            >
              {months.map(month => (
                <option key={month} value={month} className="bg-slate-900">{month}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>

          {/* Sync button */}
          <button className="flex items-center gap-2 px-4 py-2 border border-white/[0.1] rounded-lg text-sm font-medium text-slate-300 hover:bg-white/[0.05] hover:border-white/[0.15] transition-colors">
            <RefreshCw size={14} />
            Sync QBO
          </button>

          {/* Add Entry */}
          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20">
            <Plus size={14} />
            Add Entry
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Cash on Hand"
          value={formatCurrency(metrics.cashOnHand)}
          subValue="Bank accounts"
          icon={Wallet}
          valueColor="text-emerald-400"
        />
        <MetricCard
          label="Credit Card Debt"
          value={formatCurrency(metrics.creditCardDebt)}
          subValue="Outstanding balance"
          icon={CreditCard}
          valueColor="text-rose-400"
        />
        <MetricCard
          label="Net Position"
          value={formatCurrency(metrics.netPosition)}
          subValue="Cash - CC debt"
          trend={metrics.revenueChange}
          trendLabel="vs last month"
          icon={DollarSign}
          valueColor={metrics.netPosition >= 0 ? 'text-emerald-400' : 'text-rose-400'}
        />
        <MetricCard
          label="Gross Margin"
          value={`${metrics.grossMargin.toFixed(1)}%`}
          subValue={formatCurrency(metrics.grossProfit)}
          icon={Percent}
          valueColor={metrics.grossMargin >= 30 ? 'text-emerald-400' : metrics.grossMargin >= 15 ? 'text-amber-400' : 'text-rose-400'}
        />
      </div>

      {/* P&L + Revenue by Project */}
      <div className="grid grid-cols-12 gap-6">
        {/* Profit & Loss */}
        <div className="col-span-12 lg:col-span-8">
          <Section title="Profit & Loss" subtitle={`${selectedMonth} ${selectedYear}`}>
            <div className="divide-y divide-white/[0.05]">
              <PLRow label="Revenue" value={metrics.revenue} percentage={100} type="positive" bold />
              <PLRow label="Contractor Labor" value={metrics.directCosts} percentage={metrics.revenue > 0 ? (metrics.directCosts / metrics.revenue) * 100 : 0} type="negative" indent />
              <div className="h-px bg-white/[0.1] my-1" />
              <PLRow label="Gross Profit" value={metrics.grossProfit} percentage={metrics.grossMargin} type={metrics.grossProfit >= 0 ? 'positive' : 'negative'} bold />
              <PLRow label="Overhead" value={metrics.overhead} percentage={metrics.revenue > 0 ? (metrics.overhead / metrics.revenue) * 100 : 0} type="muted" indent />
              <div className="h-px bg-white/[0.1] my-1" />
              <PLRow label="Net Profit" value={metrics.netProfit} percentage={metrics.netMargin} type={metrics.netProfit >= 0 ? 'positive' : 'negative'} bold />
            </div>
          </Section>
        </div>

        {/* Revenue by Project */}
        <div className="col-span-12 lg:col-span-4">
          <Section title="Revenue by Project" action={{ label: 'View All', href: '/projects' }}>
            {revenueByProject.length > 0 ? (
              <>
                <div className="h-44 -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueByProject}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {revenueByProject.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v)} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2.5 mt-2">
                  {revenueByProject.map((project, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                        <span className={`${THEME.textSecondary} truncate`}>{project.name}</span>
                      </div>
                      <span className={`font-semibold ${THEME.textPrimary} tabular-nums shrink-0 ml-3`}>{formatCurrency(project.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className={`flex items-center justify-center h-44 ${THEME.textMuted} text-sm`}>
                No project revenue this period
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* Expense Breakdown */}
      {Object.keys(metrics.expenseByCategory).length > 0 && (
        <Section title="Expense Breakdown" subtitle="By vendor/description">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {Object.entries(metrics.expenseByCategory)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 5)
              .map(([category, amount], i) => {
                const colors = ['#EF4444', '#F59E0B', '#10B981', '#64748b', '#94a3b8']
                return (
                  <div key={i} className="bg-white/[0.03] border border-white/[0.08] rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors[i] }} />
                      <span className={`text-xs ${THEME.textMuted} truncate`}>{category}</span>
                    </div>
                    <span className={`text-lg font-semibold ${THEME.textPrimary}`}>{formatCurrency(amount)}</span>
                  </div>
                )
              })}
          </div>
        </Section>
      )}

      {/* Transactions - Collapsible */}
      <Section 
        title="Transactions" 
        subtitle={`${filteredTransactions.length} this period`}
        collapsible
        defaultExpanded={true}
        badge={filteredTransactions.length}
        noPadding
      >
        <div>
          {/* Header */}
          <div className={`flex items-center px-6 py-3 bg-white/[0.03] border-b ${THEME.glassBorder}`}>
            <div className={`flex-1 text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>Description</div>
            <div className={`w-24 text-xs font-medium ${THEME.textDim} uppercase tracking-wider hidden sm:block`}>Date</div>
            <div className={`w-32 text-xs font-medium ${THEME.textDim} uppercase tracking-wider text-right`}>Amount</div>
          </div>
          
          {/* Rows */}
          {displayTransactions.length > 0 ? (
            <>
              {displayTransactions.map((tx, i) => (
                <div key={i} className="flex items-center px-6 py-3.5 border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${THEME.textSecondary} truncate`}>{tx.description || tx.name || 'Transaction'}</p>
                    <p className={`text-xs ${THEME.textDim} sm:hidden`}>{formatDate(tx.date)}</p>
                  </div>
                  <div className={`w-24 text-sm ${THEME.textMuted} hidden sm:block`}>{formatDate(tx.date)}</div>
                  <div className={`w-32 text-sm font-semibold text-right tabular-nums ${(parseFloat(tx.amount) || 0) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {formatCurrency(parseFloat(tx.amount) || 0)}
                  </div>
                </div>
              ))}
              
              {/* Show more/less toggle */}
              {filteredTransactions.length > 5 && (
                <button 
                  onClick={() => setShowAllTransactions(!showAllTransactions)}
                  className={`w-full px-6 py-3 text-sm font-medium ${THEME.textMuted} hover:text-white hover:bg-white/[0.03] transition-colors flex items-center justify-center gap-1`}
                >
                  {showAllTransactions ? (
                    <>Show Less <ChevronUp size={14} /></>
                  ) : (
                    <>Show All {filteredTransactions.length} Transactions <ChevronDown size={14} /></>
                  )}
                </button>
              )}
            </>
          ) : (
            <div className={`flex items-center justify-center py-12 ${THEME.textMuted} text-sm`}>
              No transactions this period
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}
