'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  TrendingUp, TrendingDown, DollarSign, Clock, Users, 
  AlertTriangle, ChevronRight, Calendar,
  ArrowUpRight, ArrowDownRight, Receipt, 
  AlertCircle, CheckCircle2, RefreshCw, FileText, Briefcase
} from 'lucide-react'
import Link from 'next/link'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart, ReferenceLine
} from 'recharts'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// ============ GLASSMORPHISM DESIGN SYSTEM ============
const THEME = {
  // Glass effects
  glass: 'bg-slate-900/70 backdrop-blur-xl',
  glassBorder: 'border-white/[0.08]',
  glassHover: 'hover:bg-white/[0.05] hover:border-white/[0.12]',
  
  // Text
  textPrimary: 'text-white',
  textSecondary: 'text-slate-300',
  textMuted: 'text-slate-400',
  textDim: 'text-slate-500',
  
  // Accent - Emerald
  accent: '#10B981',
  accentLight: '#34d399',
  
  // Semantic
  positive: '#10B981',
  negative: '#EF4444',
  warning: '#F59E0B',
  
  // Chart palette
  chart: {
    primary: '#10B981',
    secondary: '#64748b',
    tertiary: '#475569',
    negative: '#EF4444',
    grid: 'rgba(255,255,255,0.06)',
    axis: '#64748b',
  }
}

// ============ UTILITY FUNCTIONS ============
const formatCurrency = (value: number, compact = false): string => {
  if (compact && Math.abs(value) >= 1000000) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value)
  }
  if (compact && Math.abs(value) >= 10000) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 0 }).format(value)
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

const formatNumber = (value: number, decimals = 1): string => {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(value)
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ============ COMPONENTS ============

// Glass Metric Card
function MetricCard({ 
  label, 
  value, 
  subValue, 
  trend, 
  trendLabel,
  icon: Icon,
  href 
}: { 
  label: string
  value: string
  subValue?: string
  trend?: number
  trendLabel?: string
  icon: any
  href?: string
}) {
  const content = (
    <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-5 transition-all duration-200 ${THEME.glassHover}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className={`text-sm font-medium ${THEME.textMuted}`}>{label}</p>
          <p className={`text-2xl font-semibold tracking-tight ${THEME.textPrimary}`}>{value}</p>
          {subValue && (
            <p className={`text-xs ${THEME.textDim}`}>{subValue}</p>
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
        <div className="p-2.5 rounded-lg bg-white/[0.05]">
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
  badge,
  noPadding = false,
  fillHeight = false
}: { 
  title: string
  subtitle?: string
  action?: { label: string; href: string }
  children: React.ReactNode
  badge?: string | number
  noPadding?: boolean
  fillHeight?: boolean
}) {
  return (
    <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden ${fillHeight ? 'h-full flex flex-col' : ''}`}>
      <div className={`flex items-center justify-between px-5 py-4 border-b ${THEME.glassBorder}`}>
        <div>
          <div className="flex items-center gap-2">
            <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>{title}</h3>
            {badge !== undefined && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-white/[0.08] text-slate-300">
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className={`text-xs mt-0.5 ${THEME.textDim}`}>{subtitle}</p>}
        </div>
        {action && (
          <Link 
            href={action.href} 
            className={`text-xs font-medium ${THEME.textMuted} hover:text-white flex items-center gap-0.5 transition-colors`}
          >
            {action.label}
            <ChevronRight size={14} />
          </Link>
        )}
      </div>
      <div className={`${fillHeight ? 'flex-1' : ''} ${noPadding ? '' : 'p-5'}`}>
        {children}
      </div>
    </div>
  )
}

// Health Score Ring - Glass style
function HealthRing({ score, size = 100 }: { score: number; size?: number }) {
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (score / 100) * circumference
  
  const getColor = (s: number) => {
    if (s >= 70) return THEME.positive
    if (s >= 40) return THEME.warning
    return THEME.negative
  }
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle 
          cx={size / 2} 
          cy={size / 2} 
          r={radius} 
          fill="none" 
          stroke="rgba(255,255,255,0.08)" 
          strokeWidth={strokeWidth} 
        />
        <circle 
          cx={size / 2} 
          cy={size / 2} 
          r={radius} 
          fill="none" 
          stroke={getColor(score)} 
          strokeWidth={strokeWidth} 
          strokeDasharray={circumference} 
          strokeDashoffset={offset} 
          strokeLinecap="round" 
          className="transition-all duration-700 ease-out" 
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold ${THEME.textPrimary}`}>{score}</span>
        <span className={`text-[10px] font-medium ${THEME.textDim}`}>/ 100</span>
      </div>
    </div>
  )
}

// Progress Bar - Glass style
function ProgressBar({ value, max = 100, color = THEME.accent }: { value: number; max?: number; color?: string }) {
  const percentage = Math.min((value / max) * 100, 100)
  
  return (
    <div className="w-full h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
      <div 
        className="h-full rounded-full transition-all duration-500" 
        style={{ width: `${percentage}%`, backgroundColor: color }} 
      />
    </div>
  )
}

// Team Member Row - Glass style
function TeamRow({ name, hours, target = 40 }: { name: string; hours: number; target?: number }) {
  const utilization = (hours / target) * 100
  const color = utilization >= 80 ? THEME.positive : utilization >= 50 ? THEME.warning : THEME.chart.secondary
  
  return (
    <div className="flex items-center gap-4 py-3 border-b border-white/[0.05] last:border-0">
      <div className="w-24 min-w-0">
        <p className={`text-sm font-medium ${THEME.textSecondary} truncate`}>{name}</p>
      </div>
      <div className="flex-1">
        <ProgressBar value={utilization} color={color} />
      </div>
      <div className="text-right w-16">
        <p className="text-sm font-semibold tabular-nums" style={{ color }}>{hours}h</p>
      </div>
    </div>
  )
}

// Alert Item - Glass style
function AlertRow({ type, message, detail, action }: { 
  type: 'error' | 'warning' | 'success'
  message: string
  detail?: string
  action?: { label: string; href: string }
}) {
  const config = {
    error: { icon: AlertCircle, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
    warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    success: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  }
  const { icon: Icon, color, bg, border } = config[type]
  
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${bg} border ${border}`}>
      <Icon size={16} className={`${color} mt-0.5 flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${THEME.textPrimary}`}>{message}</p>
        {detail && <p className={`text-xs mt-0.5 ${THEME.textMuted}`}>{detail}</p>}
      </div>
      {action && (
        <Link href={action.href} className={`text-xs font-medium ${THEME.textMuted} hover:text-white transition-colors`}>
          {action.label}
        </Link>
      )}
    </div>
  )
}

// Custom Tooltip - Glass style
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

// ============ MAIN DASHBOARD ============
export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [timeEntries, setTimeEntries] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'ytd'>('month')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  const availableYears = [2026, 2025, 2024, 2023]
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await getCurrentUser()
        const user = result?.user
        if (!user) { setLoading(false); return }

        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
        if (!profile?.company_id) { setLoading(false); return }

        setCompanyId(profile.company_id)

        const [txRes, invRes, expRes, projRes, timeRes, teamRes] = await Promise.all([
          supabase.from('transactions').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
          supabase.from('invoices').select('*').eq('company_id', profile.company_id).order('invoice_date', { ascending: false }),
          supabase.from('expenses').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
          supabase.from('projects').select('*').eq('company_id', profile.company_id),
          supabase.from('time_entries').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
          supabase.from('team_members').select('*').eq('company_id', profile.company_id),
        ])

        setTransactions(txRes.data || [])
        setInvoices(invRes.data || [])
        setExpenses(expRes.data || [])
        setProjects(projRes.data || [])
        setTimeEntries(timeRes.data || [])
        setTeamMembers(teamRes.data || [])
      } catch (error) {
        console.error('Error loading dashboard:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Period calculations
  const periodRange = useMemo(() => {
    const now = new Date()
    let endDate = selectedYear < currentYear ? new Date(selectedYear, 11, 31, 23, 59, 59) : now
    let startDate: Date
    
    switch (period) {
      case 'week':
        startDate = selectedYear < currentYear 
          ? new Date(selectedYear, 11, 24) 
          : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
        break
      case 'month':
        startDate = selectedYear < currentYear 
          ? new Date(selectedYear, 11, 1) 
          : new Date(now.getFullYear(), now.getMonth(), 1)
        if (selectedYear < currentYear) endDate = new Date(selectedYear, 11, 31, 23, 59, 59)
        break
      case 'quarter':
        if (selectedYear < currentYear) {
          startDate = new Date(selectedYear, 9, 1)
          endDate = new Date(selectedYear, 11, 31, 23, 59, 59)
        } else {
          const quarterStart = Math.floor(now.getMonth() / 3) * 3
          startDate = new Date(now.getFullYear(), quarterStart, 1)
        }
        break
      case 'ytd':
      default:
        startDate = new Date(selectedYear, 0, 1)
    }
    
    const weeksInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) || 4
    return { startDate, endDate, weeksInPeriod }
  }, [period, selectedYear, currentYear])

  // Filtered data
  const filteredInvoices = useMemo(() => invoices.filter(inv => {
    const d = new Date(inv.invoice_date)
    return d >= periodRange.startDate && d <= periodRange.endDate
  }), [invoices, periodRange])

  const filteredExpenses = useMemo(() => expenses.filter(exp => {
    const d = new Date(exp.date)
    return d >= periodRange.startDate && d <= periodRange.endDate
  }), [expenses, periodRange])

  const filteredTimeEntries = useMemo(() => timeEntries.filter(te => {
    const d = new Date(te.date)
    return d >= periodRange.startDate && d <= periodRange.endDate
  }), [timeEntries, periodRange])

  // Metrics
  const metrics = useMemo(() => {
    const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || parseFloat(inv.total) || 0), 0)
    const directCosts = filteredExpenses.filter(e => e.expense_type === 'direct_cost').reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
    const overhead = filteredExpenses.filter(e => e.expense_type === 'overhead').reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
    const totalExpenses = directCosts + overhead
    
    const grossProfit = totalRevenue - directCosts
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
    const netProfit = grossProfit - overhead
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
    
    const openInvoices = invoices.filter(inv => (parseFloat(inv.balance_due) || parseFloat(inv.balance) || 0) > 0)
    const totalAR = openInvoices.reduce((sum, inv) => sum + (parseFloat(inv.balance_due) || parseFloat(inv.balance) || 0), 0)
    const overdueInvoices = openInvoices.filter(inv => new Date(inv.due_date) < new Date())
    const overdueAR = overdueInvoices.reduce((sum, inv) => sum + (parseFloat(inv.balance_due) || parseFloat(inv.balance) || 0), 0)
    
    const totalHours = filteredTimeEntries.reduce((sum, te) => sum + (parseFloat(te.hours) || 0), 0)
    const billableHours = filteredTimeEntries.filter(te => te.billable).reduce((sum, te) => sum + (parseFloat(te.hours) || 0), 0)
    const billableRate = totalHours > 0 ? (billableHours / totalHours) * 100 : 0
    
    // Health score
    const arScore = totalAR > 0 ? Math.max(0, 100 - (overdueAR / totalAR) * 100) : 100
    const marginScore = Math.min(100, grossMargin * 2)
    const utilizationScore = Math.min(100, billableRate)
    const healthScore = Math.round((arScore * 0.3) + (marginScore * 0.4) + (utilizationScore * 0.3))
    
    return {
      totalRevenue, directCosts, overhead, totalExpenses,
      grossProfit, grossMargin, netProfit, netMargin,
      totalAR, overdueAR, openInvoicesCount: openInvoices.length,
      totalHours, billableHours, billableRate, healthScore
    }
  }, [filteredInvoices, filteredExpenses, filteredTimeEntries, invoices])

  // Chart data - Revenue vs Expenses
  const revenueExpenseData = useMemo(() => {
    const months: { [key: string]: { revenue: number; expenses: number } } = {}
    
    filteredInvoices.forEach(inv => {
      const month = new Date(inv.invoice_date).toLocaleString('en-US', { month: 'short' })
      if (!months[month]) months[month] = { revenue: 0, expenses: 0 }
      months[month].revenue += parseFloat(inv.total_amount) || parseFloat(inv.total) || 0
    })
    
    filteredExpenses.forEach(exp => {
      const month = new Date(exp.date).toLocaleString('en-US', { month: 'short' })
      if (!months[month]) months[month] = { revenue: 0, expenses: 0 }
      months[month].expenses += parseFloat(exp.amount) || 0
    })
    
    return Object.entries(months).map(([month, data]) => ({
      month,
      revenue: data.revenue,
      expenses: data.expenses,
    })).slice(-6)
  }, [filteredInvoices, filteredExpenses])

  // AR Aging
  const arAgingData = useMemo(() => {
    const aging = { current: 0, overdue: 0 }
    const now = new Date()
    
    invoices.filter(inv => (parseFloat(inv.balance_due) || parseFloat(inv.balance) || 0) > 0).forEach(inv => {
      const balance = parseFloat(inv.balance_due) || parseFloat(inv.balance) || 0
      if (new Date(inv.due_date) >= now) aging.current += balance
      else aging.overdue += balance
    })
    
    return [
      { name: 'Current', value: aging.current, color: THEME.chart.primary },
      { name: 'Overdue', value: aging.overdue, color: THEME.chart.negative },
    ].filter(d => d.value > 0)
  }, [invoices])

  // Team utilization
  const teamUtilization = useMemo(() => {
    const memberHours: { [key: string]: number } = {}
    
    filteredTimeEntries.forEach(te => {
      const member = teamMembers.find(m => m.id === te.team_member_id || m.id === te.contractor_id)
      const name = member?.name || te.contractor_name || 'Unknown'
      memberHours[name] = (memberHours[name] || 0) + (parseFloat(te.hours) || 0)
    })
    
    return Object.entries(memberHours)
      .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5)
  }, [filteredTimeEntries, teamMembers])

  // Cash forecast
  const cashForecastData = useMemo(() => {
    const weeks = []
    let cash = metrics.totalRevenue > 0 ? metrics.totalRevenue * 0.3 : 50000
    const weeklyNet = (metrics.totalRevenue - metrics.totalExpenses) / (periodRange.weeksInPeriod || 4)
    
    for (let i = 0; i < 12; i++) {
      cash += weeklyNet * 0.9
      weeks.push({ week: `W${i + 1}`, projected: Math.max(0, cash), threshold: 50000 })
    }
    return weeks
  }, [metrics, periodRange])

  // Alerts
  const alerts = useMemo(() => {
    const list: { type: 'error' | 'warning' | 'success'; message: string; detail?: string; action?: { label: string; href: string } }[] = []
    
    if (metrics.overdueAR > 0) {
      list.push({
        type: 'error',
        message: `${formatCurrency(metrics.overdueAR)} overdue`,
        detail: 'Requires immediate attention',
        action: { label: 'Review', href: '/invoices' }
      })
    }
    
    if (metrics.grossMargin < 30 && metrics.totalRevenue > 0) {
      list.push({
        type: 'warning',
        message: `Gross margin at ${metrics.grossMargin.toFixed(1)}%`,
        detail: 'Below 30% target',
        action: { label: 'Analyze', href: '/projects' }
      })
    }
    
    if (list.length === 0) {
      list.push({
        type: 'success',
        message: 'All metrics healthy',
        detail: 'No action required'
      })
    }
    
    return list
  }, [metrics])

  // Recent invoices
  const recentInvoices = useMemo(() => {
    return invoices
      .filter(inv => (parseFloat(inv.balance_due) || parseFloat(inv.balance) || 0) > 0)
      .map(inv => ({
        ...inv,
        daysOverdue: Math.max(0, Math.floor((new Date().getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24)))
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 5)
  }, [invoices])

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw size={24} className="text-emerald-500 animate-spin" />
          <p className={`text-sm ${THEME.textMuted}`}>Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-xl font-semibold ${THEME.textPrimary}`}>Dashboard</h1>
          <p className={`text-sm mt-0.5 ${THEME.textMuted}`}>Financial overview for {selectedYear}</p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Year selector */}
          <div className="relative">
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="appearance-none bg-white/[0.05] border border-white/[0.1] rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 cursor-pointer"
            >
              {availableYears.map(year => (
                <option key={year} value={year} className="bg-slate-900">{year}</option>
              ))}
            </select>
            <ChevronRight size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 text-slate-500 pointer-events-none" />
          </div>
          
          {/* Period tabs */}
          <div className="flex bg-white/[0.05] border border-white/[0.1] rounded-lg p-1">
            {(['week', 'month', 'quarter', 'ytd'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  period === p 
                    ? 'bg-emerald-500 text-white' 
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                {p === 'ytd' ? 'YTD' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Revenue"
          value={formatCurrency(metrics.totalRevenue, true)}
          subValue={`Gross Margin: ${metrics.grossMargin.toFixed(1)}%`}
          icon={DollarSign}
          href="/invoices"
        />
        <MetricCard
          label="Expenses"
          value={formatCurrency(metrics.totalExpenses, true)}
          subValue={`Direct: ${formatCurrency(metrics.directCosts, true)} | OH: ${formatCurrency(metrics.overhead, true)}`}
          icon={Receipt}
          href="/expenses"
        />
        <MetricCard
          label="Outstanding AR"
          value={formatCurrency(metrics.totalAR, true)}
          subValue={`${metrics.openInvoicesCount} open invoices`}
          trend={metrics.overdueAR > 0 ? -(metrics.overdueAR / Math.max(metrics.totalAR, 1) * 100) : undefined}
          trendLabel={metrics.overdueAR > 0 ? 'overdue' : undefined}
          icon={FileText}
          href="/invoices"
        />
        <MetricCard
          label="Team Hours"
          value={`${formatNumber(metrics.totalHours, 0)}h`}
          subValue={`${metrics.billableRate.toFixed(0)}% billable`}
          icon={Users}
          href="/team"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-12 gap-4">
        {/* Revenue vs Expenses */}
        <div className="col-span-12 lg:col-span-8">
          <Section title="Revenue vs Expenses" subtitle="Monthly comparison">
            <div className="h-52">
              {revenueExpenseData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueExpenseData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={THEME.chart.grid} vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: THEME.chart.axis, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: THEME.chart.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v)} />} />
                    <Bar dataKey="revenue" name="Revenue" fill={THEME.chart.primary} radius={[4, 4, 0, 0]} barSize={24} />
                    <Bar dataKey="expenses" name="Expenses" fill={THEME.chart.secondary} radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className={`flex items-center justify-center h-full ${THEME.textMuted} text-sm`}>No data for selected period</div>
              )}
            </div>
            <div className={`flex items-center gap-6 mt-3 pt-3 border-t ${THEME.glassBorder}`}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: THEME.chart.primary }} />
                <span className={`text-xs ${THEME.textMuted}`}>Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: THEME.chart.secondary }} />
                <span className={`text-xs ${THEME.textMuted}`}>Expenses</span>
              </div>
            </div>
          </Section>
        </div>

        {/* Health + AR */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          {/* Health Score */}
          <Section title="Financial Health">
            <div className="flex items-center gap-5">
              <HealthRing score={metrics.healthScore} size={90} />
              <div className="flex-1 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className={THEME.textMuted}>Gross Margin</span>
                  <span className={`font-medium ${THEME.textPrimary}`}>{metrics.grossMargin.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={THEME.textMuted}>Net Margin</span>
                  <span className={`font-medium ${THEME.textPrimary}`}>{metrics.netMargin.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={THEME.textMuted}>Utilization</span>
                  <span className={`font-medium ${THEME.textPrimary}`}>{metrics.billableRate.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </Section>

          {/* AR Aging */}
          <Section title="AR Aging">
            {arAgingData.length > 0 ? (
              <div className="space-y-3">
                {arAgingData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className={`text-sm ${THEME.textSecondary}`}>{item.name}</span>
                    </div>
                    <span className={`text-sm font-semibold ${THEME.textPrimary}`}>{formatCurrency(item.value)}</span>
                  </div>
                ))}
                <div className={`pt-3 mt-1 border-t ${THEME.glassBorder}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${THEME.textMuted}`}>Total AR</span>
                    <span className={`text-sm font-bold ${THEME.textPrimary}`}>{formatCurrency(metrics.totalAR)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`flex items-center justify-center h-20 ${THEME.textMuted} text-sm`}>No outstanding AR</div>
            )}
          </Section>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-12 gap-4">
        {/* Team Utilization */}
        <div className="col-span-12 lg:col-span-6">
          <Section title="Team Utilization" subtitle="Hours logged this period" action={{ label: 'View Team', href: '/team' }}>
            <div>
              {teamUtilization.length > 0 ? (
                <div>
                  {teamUtilization.map((member, i) => (
                    <TeamRow key={i} name={member.name} hours={member.hours} />
                  ))}
                  <div className={`flex items-center justify-between pt-3 mt-2 border-t ${THEME.glassBorder}`}>
                    <span className={`text-xs ${THEME.textDim}`}>Team Average</span>
                    <span className={`text-sm font-medium ${THEME.textSecondary}`}>
                      {(teamUtilization.reduce((sum, m) => sum + m.hours, 0) / teamUtilization.length).toFixed(0)}h
                      <span className={`${THEME.textDim} font-normal ml-1`}>/ 40h</span>
                    </span>
                  </div>
                </div>
              ) : (
                <div className={`flex items-center justify-center h-full ${THEME.textMuted} text-sm`}>No time entries</div>
              )}
            </div>
          </Section>
        </div>

        {/* Cash Forecast */}
        <div className="col-span-12 lg:col-span-6">
          <Section title="90-Day Cash Forecast" subtitle="Projected cash position">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashForecastData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={THEME.chart.primary} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={THEME.chart.primary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={THEME.chart.grid} vertical={false} />
                  <XAxis dataKey="week" tick={{ fill: THEME.chart.axis, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: THEME.chart.axis, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v)} />} />
                  <ReferenceLine y={50000} stroke={THEME.warning} strokeDasharray="5 5" strokeWidth={1} />
                  <Area type="monotone" dataKey="projected" name="Projected" stroke={THEME.chart.primary} strokeWidth={2} fill="url(#cashGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className={`flex items-center gap-4 mt-2 pt-2 border-t ${THEME.glassBorder}`}>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: THEME.chart.primary }} />
                <span className={`text-xs ${THEME.textDim}`}>Projected</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 border-t border-dashed" style={{ borderColor: THEME.warning }} />
                <span className={`text-xs ${THEME.textDim}`}>Threshold</span>
              </div>
            </div>
          </Section>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-12 gap-4">
        {/* Alerts */}
        <div className="col-span-12 lg:col-span-4">
          <Section title="Alerts" badge={alerts.filter(a => a.type !== 'success').length || undefined}>
            <div className="space-y-2">
              {alerts.map((alert, i) => (
                <AlertRow key={i} {...alert} />
              ))}
            </div>
          </Section>
        </div>

        {/* Open Invoices */}
        <div className="col-span-12 lg:col-span-8">
          <Section title="Open Invoices" badge={metrics.openInvoicesCount} action={{ label: 'View All', href: '/invoices' }} noPadding>
            <div>
              {recentInvoices.length > 0 ? (
                <div>
                  {/* Header */}
                  <div className={`flex items-center px-5 py-2 bg-white/[0.03] border-b ${THEME.glassBorder}`}>
                    <div className={`flex-1 text-xs font-medium uppercase tracking-wider ${THEME.textDim}`}>Client</div>
                    <div className={`w-24 text-xs font-medium uppercase tracking-wider ${THEME.textDim}`}>Invoice</div>
                    <div className={`w-24 text-xs font-medium uppercase tracking-wider ${THEME.textDim}`}>Due</div>
                    <div className={`w-28 text-xs font-medium uppercase tracking-wider text-right ${THEME.textDim}`}>Amount</div>
                    <div className={`w-24 text-xs font-medium uppercase tracking-wider text-right ${THEME.textDim}`}>Status</div>
                  </div>
                  {/* Rows */}
                  {recentInvoices.map((inv) => (
                    <div key={inv.id} className={`flex items-center px-5 py-3 border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors`}>
                      <div className={`flex-1 text-sm font-medium truncate ${THEME.textSecondary}`}>{inv.client_name || '—'}</div>
                      <div className={`w-24 text-sm ${THEME.textMuted}`}>{inv.invoice_number || inv.doc_number || 'Draft'}</div>
                      <div className={`w-24 text-sm ${THEME.textMuted}`}>{formatDate(inv.due_date)}</div>
                      <div className={`w-28 text-sm font-medium text-right tabular-nums ${THEME.textPrimary}`}>
                        {formatCurrency(parseFloat(inv.balance_due) || parseFloat(inv.balance) || 0)}
                      </div>
                      <div className="w-24 text-right">
                        {inv.daysOverdue > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-500/15 text-rose-400 border border-rose-500/20">
                            {inv.daysOverdue}d
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/[0.05] text-slate-400 border border-white/[0.1]">
                            Current
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`flex items-center justify-center h-full ${THEME.textMuted} text-sm py-12`}>No open invoices</div>
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
