'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  TrendingUp, TrendingDown, DollarSign, CreditCard, Wallet, PiggyBank,
  ChevronRight, ChevronDown, Plus, RefreshCw, Building2, ArrowUpRight, 
  ArrowDownRight, Percent, MoreHorizontal, ExternalLink
} from 'lucide-react'
import Link from 'next/link'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// ============ THEME ============
const THEME = {
  pageBg: '#F9FAFB',
  cardBg: '#FFFFFF',
  cardBorder: '#E5E7EB',
  cardShadow: '0 1px 3px 0 rgb(0 0 0 / 0.04)',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  accent: '#10B981',
  accentLight: '#D1FAE5',
  positive: '#10B981',
  negative: '#EF4444',
  warning: '#F59E0B',
  chart: {
    primary: '#10B981',
    secondary: '#6B7280',
    tertiary: '#D1D5DB',
    negative: '#EF4444',
    grid: '#F3F4F6',
    axis: '#9CA3AF',
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

// KPI Card - Light theme
function KPICard({ 
  label, 
  value, 
  subValue, 
  trend, 
  trendLabel,
  icon: Icon,
  href,
  valueColor
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
    <div 
      className="bg-white border border-gray-200 rounded-xl p-5 transition-all duration-200 hover:shadow-md hover:border-gray-300"
      style={{ boxShadow: THEME.cardShadow }}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className={`text-2xl font-semibold tracking-tight ${valueColor || 'text-gray-900'}`}>{value}</p>
          {subValue && (
            <p className="text-xs text-gray-400">{subValue}</p>
          )}
          {trend !== undefined && (
            <div className="flex items-center gap-1.5 pt-1">
              {trend >= 0 ? (
                <ArrowUpRight size={14} className="text-emerald-500" />
              ) : (
                <ArrowDownRight size={14} className="text-red-500" />
              )}
              <span className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {Math.abs(trend).toFixed(1)}%
              </span>
              {trendLabel && <span className="text-xs text-gray-400">{trendLabel}</span>}
            </div>
          )}
        </div>
        <div className="p-2">
          <Icon size={20} className="text-gray-400" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  )
  
  if (href) return <Link href={href} className="block">{content}</Link>
  return content
}

// Section Card
function Section({ 
  title, 
  subtitle, 
  action, 
  children,
  noPadding = false,
  headerRight
}: { 
  title: string
  subtitle?: string
  action?: { label: string; href?: string; onClick?: () => void }
  children: React.ReactNode
  noPadding?: boolean
  headerRight?: React.ReactNode
}) {
  return (
    <div 
      className="rounded-xl flex flex-col bg-white border border-gray-200"
      style={{ boxShadow: THEME.cardShadow }}
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {headerRight}
          {action && (
            action.onClick ? (
              <button 
                onClick={action.onClick}
                className="text-xs font-medium text-gray-500 hover:text-gray-700 flex items-center gap-0.5 transition-colors"
              >
                {action.label}
                <ChevronRight size={14} />
              </button>
            ) : (
              <Link 
                href={action.href || '#'} 
                className="text-xs font-medium text-gray-500 hover:text-gray-700 flex items-center gap-0.5 transition-colors"
              >
                {action.label}
                <ChevronRight size={14} />
              </Link>
            )
          )}
        </div>
      </div>
      <div className={noPadding ? '' : 'p-5'}>
        {children}
      </div>
    </div>
  )
}

// Profit/Loss Row
function PLRow({ 
  label, 
  value, 
  percentage, 
  color,
  indent = false
}: { 
  label: string
  value: number
  percentage?: number
  color: 'positive' | 'negative' | 'neutral' | 'muted'
  indent?: boolean
}) {
  const colorMap = {
    positive: 'text-emerald-600',
    negative: 'text-red-500',
    neutral: 'text-gray-900',
    muted: 'text-gray-500'
  }
  const barColorMap = {
    positive: '#10B981',
    negative: '#EF4444',
    neutral: '#6B7280',
    muted: '#D1D5DB'
  }
  
  return (
    <div className={`flex items-center justify-between py-3 border-b border-gray-50 last:border-0 ${indent ? 'pl-4' : ''}`}>
      <div className="flex items-center gap-3 flex-1">
        <span className={`text-sm ${indent ? 'text-gray-500' : 'font-medium text-gray-700'}`}>{label}</span>
        {percentage !== undefined && (
          <div className="flex-1 max-w-32">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all"
                style={{ 
                  width: `${Math.min(Math.abs(percentage), 100)}%`,
                  backgroundColor: barColorMap[color]
                }}
              />
            </div>
          </div>
        )}
      </div>
      <div className="text-right">
        <span className={`text-sm font-semibold tabular-nums ${colorMap[color]}`}>
          {formatCurrency(value)}
        </span>
        {percentage !== undefined && (
          <span className="text-xs text-gray-400 ml-2">{percentage.toFixed(0)}%</span>
        )}
      </div>
    </div>
  )
}

// Account Row
function AccountRow({ 
  name, 
  balance, 
  type,
  isManual
}: { 
  name: string
  balance: number
  type: 'checking' | 'credit' | 'savings'
  isManual?: boolean
}) {
  const typeConfig = {
    checking: { color: 'bg-emerald-500', icon: Building2 },
    credit: { color: 'bg-rose-500', icon: CreditCard },
    savings: { color: 'bg-blue-500', icon: PiggyBank }
  }
  const config = typeConfig[type]
  
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        <span className="text-sm text-gray-700">{name}</span>
        {isManual && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Manual</span>
        )}
      </div>
      <span className={`text-sm font-semibold tabular-nums ${balance < 0 ? 'text-red-500' : 'text-gray-900'}`}>
        {formatCurrency(balance)}
      </span>
    </div>
  )
}

// Expense Category Card
function ExpenseCard({ 
  category, 
  amount, 
  color 
}: { 
  category: string
  amount: number
  color: string
}) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs text-gray-500">{category}</span>
      </div>
      <span className="text-lg font-semibold text-gray-900">{formatCurrency(amount)}</span>
    </div>
  )
}

// Chart Tooltip
const ChartTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
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
  const [invoices, setInvoices] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('en-US', { month: 'long' }))

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const years = [2026, 2025, 2024, 2023]

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await getCurrentUser()
        const user = result?.user
        if (!user) { setLoading(false); return }

        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
        if (!profile?.company_id) { setLoading(false); return }

        setCompanyId(profile.company_id)

        const [invRes, expRes, txRes, projRes, accRes] = await Promise.all([
          supabase.from('invoices').select('*').eq('company_id', profile.company_id),
          supabase.from('expenses').select('*').eq('company_id', profile.company_id),
          supabase.from('transactions').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
          supabase.from('projects').select('*').eq('company_id', profile.company_id),
          supabase.from('accounts').select('*').eq('company_id', profile.company_id)
        ])

        setInvoices(invRes.data || [])
        setExpenses(expRes.data || [])
        setTransactions(txRes.data || [])
        setProjects(projRes.data || [])
        setAccounts(accRes.data || [])
      } catch (error) {
        console.error('Error loading data:', error)
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
    const d = new Date(inv.invoice_date)
    return d >= periodRange.startDate && d <= periodRange.endDate
  }), [invoices, periodRange])

  const filteredExpenses = useMemo(() => expenses.filter(exp => {
    const d = new Date(exp.date)
    return d >= periodRange.startDate && d <= periodRange.endDate
  }), [expenses, periodRange])

  // Metrics
  const metrics = useMemo(() => {
    // Cash position from accounts
    const bankAccounts = accounts.filter(a => a.account_type === 'checking' || a.account_type === 'savings')
    const creditCards = accounts.filter(a => a.account_type === 'credit_card')
    
    const cashOnHand = bankAccounts.reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0)
    const creditCardDebt = Math.abs(creditCards.reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0))
    const netPosition = cashOnHand - creditCardDebt

    // Revenue from invoices
    const revenue = filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || parseFloat(inv.total) || 0), 0)

    // Expenses breakdown
    const directCosts = filteredExpenses
      .filter(e => e.expense_type === 'direct_cost')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
    const overhead = filteredExpenses
      .filter(e => e.expense_type === 'overhead')
      .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
    const totalExpenses = directCosts + overhead

    // Profit calculations
    const grossProfit = revenue - directCosts
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0
    const netProfit = grossProfit - overhead
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0

    // Expense categories
    const expenseByCategory: { [key: string]: number } = {}
    filteredExpenses.forEach(exp => {
      const cat = exp.category || 'Other'
      expenseByCategory[cat] = (expenseByCategory[cat] || 0) + (parseFloat(exp.amount) || 0)
    })

    // Previous month comparison
    const prevMonthIndex = months.indexOf(selectedMonth) - 1
    const prevYear = prevMonthIndex < 0 ? selectedYear - 1 : selectedYear
    const prevMonth = prevMonthIndex < 0 ? 11 : prevMonthIndex
    const prevStart = new Date(prevYear, prevMonth, 1)
    const prevEnd = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59)
    
    const prevRevenue = invoices.filter(inv => {
      const d = new Date(inv.invoice_date)
      return d >= prevStart && d <= prevEnd
    }).reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || parseFloat(inv.total) || 0), 0)
    
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
      expenseByCategory,
      revenueChange
    }
  }, [accounts, filteredInvoices, filteredExpenses, invoices, selectedMonth, selectedYear])

  // Revenue by project
  const revenueByProject = useMemo(() => {
    const projectRevenue: { [key: string]: number } = {}
    
    filteredInvoices.forEach(inv => {
      const project = projects.find(p => p.id === inv.project_id)
      const name = project?.name || 'Unassigned'
      projectRevenue[name] = (projectRevenue[name] || 0) + (parseFloat(inv.total_amount) || parseFloat(inv.total) || 0)
    })

    const colors = [THEME.chart.primary, '#6B7280', '#9CA3AF', '#D1D5DB', '#E5E7EB', '#F3F4F6']
    
    return Object.entries(projectRevenue)
      .map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }))
      .filter(p => p.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [filteredInvoices, projects])

  // Recent transactions
  const recentTransactions = useMemo(() => {
    return transactions.slice(0, 8).map(tx => ({
      ...tx,
      formattedDate: formatDate(tx.date)
    }))
  }, [transactions])

  // Expense category colors - subtle palette
  const categoryColors: { [key: string]: string } = {
    'Contractor Labor': '#EF4444',
    'Rent & Utilities': '#F59E0B',
    'Materials': '#10B981',
    'Software & Subscriptions': '#6B7280',
    'Travel & Entertainment': '#9CA3AF',
    'Other': '#D1D5DB'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw size={24} className="text-emerald-500 animate-spin" />
          <p className="text-sm text-gray-500">Loading cash flow...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Cash Flow</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time cash position & profitability</p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Year selector */}
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          
          {/* Month selector */}
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200"
          >
            {months.map(month => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>

          {/* Sync button */}
          <button className="flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <RefreshCw size={14} />
            Sync QBO
          </button>

          {/* Add Entry */}
          <button className="flex items-center gap-2 px-3 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors">
            <Plus size={14} />
            Add Entry
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-12 gap-4 mb-6">
        <div className="col-span-12 lg:col-span-9">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label="Cash on Hand"
              value={formatCurrency(metrics.cashOnHand)}
              subValue="Bank accounts"
              icon={Wallet}
              valueColor="text-emerald-600"
            />
            <KPICard
              label="Credit Card Debt"
              value={formatCurrency(metrics.creditCardDebt)}
              subValue={`${accounts.filter(a => a.account_type === 'credit_card').length} cards`}
              icon={CreditCard}
              valueColor="text-red-500"
            />
            <KPICard
              label="Net Position"
              value={formatCurrency(metrics.netPosition)}
              subValue="Cash - CC debt"
              trend={metrics.revenueChange}
              trendLabel="vs last month"
              icon={DollarSign}
              valueColor={metrics.netPosition >= 0 ? 'text-emerald-600' : 'text-red-500'}
            />
            <KPICard
              label="Gross Margin"
              value={`${metrics.grossMargin.toFixed(1)}%`}
              subValue={formatCurrency(metrics.grossProfit)}
              icon={Percent}
              valueColor={metrics.grossMargin >= 30 ? 'text-emerald-600' : metrics.grossMargin >= 15 ? 'text-amber-500' : 'text-red-500'}
            />
          </div>
        </div>

        {/* Accounts Panel */}
        <div className="col-span-12 lg:col-span-3">
          <Section title="Accounts" action={{ label: '+ Add', onClick: () => {} }}>
            <div className="max-h-36 overflow-y-auto">
              {accounts.length > 0 ? (
                accounts.map((acc, i) => (
                  <AccountRow
                    key={i}
                    name={acc.name}
                    balance={parseFloat(acc.balance) || 0}
                    type={acc.account_type === 'credit_card' ? 'credit' : acc.account_type === 'savings' ? 'savings' : 'checking'}
                    isManual={acc.is_manual}
                  />
                ))
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">No accounts connected</p>
              )}
            </div>
          </Section>
        </div>
      </div>

      {/* P&L + Revenue by Project */}
      <div className="grid grid-cols-12 gap-4 mb-6">
        {/* Profit & Loss */}
        <div className="col-span-12 lg:col-span-8">
          <Section title="Profit & Loss" subtitle={`${selectedMonth} ${selectedYear}`}>
            <div className="space-y-0">
              <PLRow label="Revenue" value={metrics.revenue} percentage={100} color="positive" />
              <PLRow label="Contractor Labor" value={metrics.directCosts} percentage={metrics.revenue > 0 ? (metrics.directCosts / metrics.revenue) * 100 : 0} color="negative" indent />
              <div className="border-t border-gray-200 my-2" />
              <PLRow label="Gross Profit" value={metrics.grossProfit} percentage={metrics.grossMargin} color={metrics.grossProfit >= 0 ? 'positive' : 'negative'} />
              <PLRow label="Overhead" value={metrics.overhead} percentage={metrics.revenue > 0 ? (metrics.overhead / metrics.revenue) * 100 : 0} color="muted" indent />
              <div className="border-t border-gray-200 my-2" />
              <PLRow label="Net Profit" value={metrics.netProfit} percentage={metrics.netMargin} color={metrics.netProfit >= 0 ? 'positive' : 'negative'} />
            </div>
          </Section>
        </div>

        {/* Revenue by Project */}
        <div className="col-span-12 lg:col-span-4">
          <Section title="Revenue by Project" action={{ label: '+ Add', href: '/projects' }}>
            {revenueByProject.length > 0 ? (
              <>
                <div className="h-40 mb-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueByProject}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={65}
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
                <div className="space-y-2">
                  {revenueByProject.map((project, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
                        <span className="text-gray-600 truncate max-w-28">{project.name}</span>
                      </div>
                      <span className="font-medium text-gray-900 tabular-nums">{formatCurrency(project.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                No project revenue data
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* Expense Breakdown */}
      <div className="mb-6">
        <Section title="Expense Breakdown" subtitle="Direct costs vs. overhead">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(metrics.expenseByCategory).length > 0 ? (
              Object.entries(metrics.expenseByCategory)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([category, amount], i) => (
                  <ExpenseCard
                    key={i}
                    category={category}
                    amount={amount}
                    color={categoryColors[category] || '#6B7280'}
                  />
                ))
            ) : (
              <div className="col-span-5 text-center py-8 text-gray-400 text-sm">
                No expenses for this period
              </div>
            )}
          </div>
        </Section>
      </div>

      {/* Transactions */}
      <Section title="Transactions" action={{ label: 'View All', href: '/transactions' }} noPadding>
        <div>
          {/* Header */}
          <div className="flex items-center px-5 py-2 bg-gray-50 border-b border-gray-200">
            <div className="flex-1 text-xs font-medium text-gray-400 uppercase tracking-wider">Description</div>
            <div className="w-24 text-xs font-medium text-gray-400 uppercase tracking-wider">Date</div>
            <div className="w-24 text-xs font-medium text-gray-400 uppercase tracking-wider">Account</div>
            <div className="w-28 text-xs font-medium text-gray-400 uppercase tracking-wider text-right">Amount</div>
          </div>
          {/* Rows */}
          {recentTransactions.length > 0 ? (
            recentTransactions.map((tx, i) => (
              <div key={i} className="flex items-center px-5 py-3 bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <div className="flex-1 text-sm text-gray-800 truncate">{tx.description || tx.name || 'Transaction'}</div>
                <div className="w-24 text-sm text-gray-500">{tx.formattedDate}</div>
                <div className="w-24 text-sm text-gray-500 truncate">{tx.account_name || '—'}</div>
                <div className={`w-28 text-sm font-medium text-right tabular-nums ${(parseFloat(tx.amount) || 0) < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                  {formatCurrency(parseFloat(tx.amount) || 0)}
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
              No transactions found
            </div>
          )}
        </div>
      </Section>
    </div>
  )
}
