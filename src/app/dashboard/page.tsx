'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  TrendingUp, TrendingDown, DollarSign, Clock, Users, 
  AlertTriangle, ChevronRight, ChevronDown, ChevronUp, Calendar,
  ArrowUpRight, ArrowDownRight, Receipt, Timer, Target, Briefcase,
  Activity, PieChart, BarChart3, Zap, AlertCircle, CheckCircle2,
  RefreshCw, Filter, Download
} from 'lucide-react'
import Link from 'next/link'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, LineChart, Line, Area, AreaChart, 
  Legend, ComposedChart, ReferenceLine
} from 'recharts'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/supabase'

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// ============ VANTAGE LOGO (Updated for Light Theme) ============
function VantageLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { icon: 28, fontSize: 18 },
    md: { icon: 32, fontSize: 22 },
    lg: { icon: 40, fontSize: 28 }
  }
  const s = sizes[size]
  
  return (
    <div className="flex items-center gap-2.5">
      <svg width={s.icon} height={s.icon} viewBox="0 0 48 48" fill="none">
        <rect x="6" y="32" width="6" height="10" rx="1.5" fill="#10B981"/>
        <rect x="14" y="24" width="6" height="18" rx="1.5" fill="#10B981" opacity="0.85"/>
        <rect x="22" y="16" width="6" height="26" rx="1.5" fill="#10B981" opacity="0.7"/>
        <rect x="30" y="24" width="6" height="18" rx="1.5" fill="#10B981" opacity="0.85"/>
        <rect x="38" y="32" width="6" height="10" rx="1.5" fill="#10B981"/>
      </svg>
      <span style={{ fontSize: s.fontSize, fontWeight: 600, letterSpacing: '-0.02em' }}>
        <span style={{ 
          background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontWeight: 700
        }}>V</span>
        <span className="text-slate-800">antage</span>
      </span>
    </div>
  )
}

// ============ DESIGN SYSTEM - Option B (Slate Navy) ============
const COLORS = {
  // Primary accent (CTAs, active states)
  accent: '#334155',
  accentHover: '#1E293B',
  accentLight: '#475569',
  
  // Semantic
  positive: '#10B981',
  positiveLight: '#ECFDF5',
  positiveDark: '#059669',
  negative: '#F43F5E',
  negativeLight: '#FFF1F2',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  
  // Text
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  
  // Surfaces
  surface: '#FFFFFF',
  pageBg: '#F8FAFC',
  border: '#E2E8F0',
  borderSubtle: '#F1F5F9',
  
  // Chart colors (semantic)
  chartPositive: '#10B981',
  chartNegative: '#F43F5E',
  chartWarning: '#F59E0B',
  chartNeutral: '#64748B',
  chartGrid: '#E2E8F0',
  chartAxis: '#94A3B8',
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

const getHealthColor = (score: number): string => {
  if (score >= 80) return COLORS.positive
  if (score >= 60) return COLORS.warning
  return COLORS.negative
}

const getStatusColor = (value: number, thresholds: { good: number; warning: number }, inverse = false): string => {
  if (inverse) {
    if (value <= thresholds.good) return COLORS.positive
    if (value <= thresholds.warning) return COLORS.warning
    return COLORS.negative
  }
  if (value >= thresholds.good) return COLORS.positive
  if (value >= thresholds.warning) return COLORS.warning
  return COLORS.negative
}

// ============ COMPONENTS ============

// Financial Health Score Ring
function HealthScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const strokeWidth = 8
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (score / 100) * circumference
  const color = getHealthColor(score)
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={COLORS.border} strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-slate-800">{score}</span>
        <span className="text-xs text-slate-400">/ 100</span>
      </div>
    </div>
  )
}

// KPI Card - Light theme
function KPICard({ title, value, subtitle, trend, trendLabel, icon: Icon, color = 'default', href }: { 
  title: string; value: string; subtitle?: string; trend?: number; trendLabel?: string; icon: any; color?: 'default' | 'positive' | 'negative' | 'warning'; href?: string
}) {
  const colorConfig = {
    default: { iconBg: 'bg-slate-100', iconColor: 'text-slate-600' },
    positive: { iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
    negative: { iconBg: 'bg-rose-50', iconColor: 'text-rose-600' },
    warning: { iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
  }
  const config = colorConfig[color]
  
  const content = (
    <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md hover:border-slate-300 transition-all duration-200 h-full">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-500 text-sm">{title}</p>
          <p className="font-bold text-slate-800 text-2xl mt-1 truncate">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1 truncate">{subtitle}</p>}
          {trend !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {trend >= 0 ? <ArrowUpRight size={14} className="text-emerald-500" /> : <ArrowDownRight size={14} className="text-rose-500" />}
              <span className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{Math.abs(trend).toFixed(1)}%</span>
              {trendLabel && <span className="text-xs text-slate-400">{trendLabel}</span>}
            </div>
          )}
        </div>
        <div className={`${config.iconBg} p-2.5 rounded-lg ml-3`}>
          <Icon size={20} className={config.iconColor} />
        </div>
      </div>
    </div>
  )
  
  if (href) return <Link href={href} className="block h-full">{content}</Link>
  return content
}

// Section Container - Light theme
function Section({ title, subtitle, action, children, className = '', badge, minHeight }: { 
  title: string; subtitle?: string; action?: { label: string; href: string }; children: React.ReactNode; className?: string; badge?: string | number; minHeight?: string
}) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col h-full shadow-sm ${className}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            {badge !== undefined && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600">{badge}</span>
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        {action && (
          <Link href={action.href} className="text-sm text-slate-600 hover:text-slate-800 font-medium flex items-center gap-1 transition-colors">
            {action.label} <ChevronRight size={16} />
          </Link>
        )}
      </div>
      <div className={`px-5 py-4 flex-1 ${minHeight || ''}`}>
        {children}
      </div>
    </div>
  )
}

// Progress Bar - Light theme
function ProgressBar({ value, max = 100, color = COLORS.accent, showLabel = true, size = 'default', label }: { 
  value: number; max?: number; color?: string; showLabel?: boolean; size?: 'small' | 'default'; label?: string
}) {
  const percentage = Math.min((value / max) * 100, 100)
  const height = size === 'small' ? 'h-1.5' : 'h-2'
  
  return (
    <div className="w-full">
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-xs text-slate-500">{label}</span>}
          {showLabel && <span className="text-xs font-medium text-slate-600">{percentage.toFixed(0)}%</span>}
        </div>
      )}
      <div className={`w-full ${height} bg-slate-100 rounded-full overflow-hidden`}>
        <div className={`${height} rounded-full transition-all duration-500`} style={{ width: `${percentage}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

// Utilization Gauge - Light theme
function UtilizationGauge({ name, hours, target = 40, rate }: { name: string; hours: number; target?: number; rate?: number }) {
  const utilization = (hours / target) * 100
  const color = getStatusColor(utilization, { good: 70, warning: 50 })
  
  return (
    <div className="flex items-center gap-4 py-2.5">
      <div className="w-28 truncate">
        <p className="text-sm font-medium text-slate-700 truncate">{name}</p>
        {rate && <p className="text-xs text-slate-400">${rate}/hr</p>}
      </div>
      <div className="flex-1">
        <ProgressBar value={utilization} color={color} showLabel={false} size="small" />
      </div>
      <div className="text-right w-20">
        <p className="text-sm font-semibold" style={{ color }}>{hours}h</p>
        <p className="text-xs text-slate-400">{utilization.toFixed(0)}%</p>
      </div>
    </div>
  )
}

// Alert Item - Light theme
function AlertItem({ type, title, subtitle, action }: { type: 'danger' | 'warning' | 'info' | 'success'; title: string; subtitle?: string; action?: { label: string; href: string } }) {
  const config = {
    danger: { bg: 'bg-rose-50', border: 'border-rose-100', icon: AlertCircle, iconColor: 'text-rose-500' },
    warning: { bg: 'bg-amber-50', border: 'border-amber-100', icon: AlertTriangle, iconColor: 'text-amber-500' },
    info: { bg: 'bg-blue-50', border: 'border-blue-100', icon: Activity, iconColor: 'text-blue-500' },
    success: { bg: 'bg-emerald-50', border: 'border-emerald-100', icon: CheckCircle2, iconColor: 'text-emerald-500' }
  }
  const { bg, border, icon: Icon, iconColor } = config[type]
  
  return (
    <div className={`${bg} ${border} border rounded-lg p-3 flex items-start gap-3`}>
      <div className={`p-1.5 rounded-md ${bg}`}>
        <Icon size={16} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700">{title}</p>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && (
        <Link href={action.href} className="text-xs text-slate-600 hover:text-slate-800 font-medium whitespace-nowrap">
          {action.label}
        </Link>
      )}
    </div>
  )
}

// Custom Tooltip - Light theme
const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
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
  const [clients, setClients] = useState<any[]>([])
  const [timeEntries, setTimeEntries] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [companySettings, setCompanySettings] = useState<any>(null)
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'ytd'>('month')
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  const availableYears = [2026, 2025, 2024, 2023]
  const currentYear = new Date().getFullYear()
  const isCurrentYear = selectedYear === currentYear

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await getCurrentUser()
        const user = result?.user
        if (!user) { setLoading(false); return }

        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
        if (!profile?.company_id) { setLoading(false); return }

        setCompanyId(profile.company_id)

        const [txRes, invRes, expRes, projRes, clientRes, timeRes, teamRes, settingsRes] = await Promise.all([
          supabase.from('transactions').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
          supabase.from('invoices').select('*').eq('company_id', profile.company_id).order('invoice_date', { ascending: false }),
          supabase.from('expenses').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
          supabase.from('projects').select('*').eq('company_id', profile.company_id),
          supabase.from('clients').select('*').eq('company_id', profile.company_id),
          supabase.from('time_entries').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
          supabase.from('team_members').select('*').eq('company_id', profile.company_id),
          supabase.from('company_settings').select('*').eq('company_id', profile.company_id).single()
        ])

        setTransactions(txRes.data || [])
        setInvoices(invRes.data || [])
        setExpenses(expRes.data || [])
        setProjects(projRes.data || [])
        setClients(clientRes.data || [])
        setTimeEntries(timeRes.data || [])
        setTeamMembers(teamRes.data || [])
        setCompanySettings(settingsRes.data)
      } catch (error) {
        console.error('Error loading dashboard:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // ============ PERIOD DATE RANGE ============
  const periodRange = useMemo(() => {
    const now = new Date()
    let endDate: Date
    let startDate: Date
    let weeksInPeriod: number
    
    if (selectedYear < currentYear) {
      endDate = new Date(selectedYear, 11, 31, 23, 59, 59)
    } else {
      endDate = now
    }
    
    switch (period) {
      case 'week':
        if (selectedYear < currentYear) {
          startDate = new Date(selectedYear, 11, 24)
          weeksInPeriod = 1
        } else {
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
          weeksInPeriod = 1
        }
        break
      case 'month':
        if (selectedYear < currentYear) {
          startDate = new Date(selectedYear, 11, 1)
          endDate = new Date(selectedYear, 11, 31, 23, 59, 59)
          weeksInPeriod = 4
        } else {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          weeksInPeriod = 4
        }
        break
      case 'quarter':
        if (selectedYear < currentYear) {
          startDate = new Date(selectedYear, 9, 1)
          endDate = new Date(selectedYear, 11, 31, 23, 59, 59)
          weeksInPeriod = 13
        } else {
          const quarterStart = Math.floor(now.getMonth() / 3) * 3
          startDate = new Date(now.getFullYear(), quarterStart, 1)
          weeksInPeriod = 13
        }
        break
      case 'ytd':
      default:
        startDate = new Date(selectedYear, 0, 1)
        weeksInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
    }
    
    return { startDate, endDate, weeksInPeriod }
  }, [period, selectedYear, currentYear])

  // ============ FILTERED DATA ============
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const txDate = new Date(t.date)
      return txDate >= periodRange.startDate && txDate <= periodRange.endDate
    })
  }, [transactions, periodRange])

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const invDate = new Date(inv.invoice_date)
      return invDate >= periodRange.startDate && invDate <= periodRange.endDate
    })
  }, [invoices, periodRange])

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const expDate = new Date(exp.date)
      return expDate >= periodRange.startDate && expDate <= periodRange.endDate
    })
  }, [expenses, periodRange])

  const filteredTimeEntries = useMemo(() => {
    return timeEntries.filter(te => {
      const teDate = new Date(te.date)
      return teDate >= periodRange.startDate && teDate <= periodRange.endDate
    })
  }, [timeEntries, periodRange])

  // ============ METRICS CALCULATIONS ============
  const metrics = useMemo(() => {
    // Revenue from invoices
    const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || parseFloat(inv.total) || 0), 0)
    
    // Expenses by category
    const directCosts = filteredExpenses.filter(e => e.expense_type === 'direct_cost').reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
    const overhead = filteredExpenses.filter(e => e.expense_type === 'overhead').reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
    const totalExpenses = directCosts + overhead
    
    // Margins
    const grossProfit = totalRevenue - directCosts
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
    const netProfit = grossProfit - overhead
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
    
    // AR Metrics
    const openInvoices = invoices.filter(inv => inv.status === 'open' || inv.status === 'overdue' || (parseFloat(inv.balance_due) || parseFloat(inv.balance) || 0) > 0)
    const totalAR = openInvoices.reduce((sum, inv) => sum + (parseFloat(inv.balance_due) || parseFloat(inv.balance) || 0), 0)
    const overdueInvoices = openInvoices.filter(inv => {
      const dueDate = new Date(inv.due_date)
      return dueDate < new Date()
    })
    const overdueAR = overdueInvoices.reduce((sum, inv) => sum + (parseFloat(inv.balance_due) || parseFloat(inv.balance) || 0), 0)
    
    // DSO
    const avgDSO = openInvoices.length > 0 ? openInvoices.reduce((sum, inv) => {
      const invDate = new Date(inv.invoice_date)
      const daysSince = Math.floor((new Date().getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24))
      return sum + daysSince
    }, 0) / openInvoices.length : 0
    
    // Team metrics
    const totalHours = filteredTimeEntries.reduce((sum, te) => sum + (parseFloat(te.hours) || 0), 0)
    const billableHours = filteredTimeEntries.filter(te => te.billable).reduce((sum, te) => sum + (parseFloat(te.hours) || 0), 0)
    const billableRate = totalHours > 0 ? (billableHours / totalHours) * 100 : 0
    
    // Cash position (simplified - from transactions)
    const cashIn = filteredTransactions.filter(t => t.type === 'income' || t.amount > 0).reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0)
    const cashOut = filteredTransactions.filter(t => t.type === 'expense' || t.amount < 0).reduce((sum, t) => sum + Math.abs(parseFloat(t.amount) || 0), 0)
    const netCash = cashIn - cashOut
    
    // Health Score
    const arScore = totalAR > 0 ? Math.max(0, 100 - (overdueAR / totalAR) * 100) : 100
    const marginScore = Math.min(100, grossMargin * 2)
    const utilizationScore = Math.min(100, billableRate)
    const healthScore = Math.round((arScore * 0.3) + (marginScore * 0.4) + (utilizationScore * 0.3))
    
    return {
      totalRevenue,
      directCosts,
      overhead,
      totalExpenses,
      grossProfit,
      grossMargin,
      netProfit,
      netMargin,
      totalAR,
      overdueAR,
      avgDSO,
      openInvoices: openInvoices.length,
      totalHours,
      billableHours,
      billableRate,
      cashIn,
      cashOut,
      netCash,
      healthScore
    }
  }, [filteredTransactions, filteredInvoices, filteredExpenses, filteredTimeEntries, invoices])

  // ============ CHART DATA ============
  const revenueExpenseData = useMemo(() => {
    const months: { [key: string]: { revenue: number; directCosts: number; overhead: number } } = {}
    
    filteredInvoices.forEach(inv => {
      const month = new Date(inv.invoice_date).toLocaleString('en-US', { month: 'short' })
      if (!months[month]) months[month] = { revenue: 0, directCosts: 0, overhead: 0 }
      months[month].revenue += parseFloat(inv.total_amount) || parseFloat(inv.total) || 0
    })
    
    filteredExpenses.forEach(exp => {
      const month = new Date(exp.date).toLocaleString('en-US', { month: 'short' })
      if (!months[month]) months[month] = { revenue: 0, directCosts: 0, overhead: 0 }
      if (exp.expense_type === 'direct_cost') {
        months[month].directCosts += parseFloat(exp.amount) || 0
      } else {
        months[month].overhead += parseFloat(exp.amount) || 0
      }
    })
    
    return Object.entries(months).map(([month, data]) => ({
      month,
      revenue: data.revenue,
      directCosts: data.directCosts,
      overhead: data.overhead,
      grossProfit: data.revenue - data.directCosts
    })).slice(-6)
  }, [filteredInvoices, filteredExpenses])

  const arAgingData = useMemo(() => {
    const aging = { current: 0, days30: 0, days60: 0, days90: 0 }
    const now = new Date()
    
    invoices.filter(inv => (parseFloat(inv.balance_due) || parseFloat(inv.balance) || 0) > 0).forEach(inv => {
      const dueDate = new Date(inv.due_date)
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      const balance = parseFloat(inv.balance_due) || parseFloat(inv.balance) || 0
      
      if (daysOverdue <= 0) aging.current += balance
      else if (daysOverdue <= 30) aging.days30 += balance
      else if (daysOverdue <= 60) aging.days60 += balance
      else aging.days90 += balance
    })
    
    return [
      { name: 'Current', value: aging.current, color: COLORS.chartPositive },
      { name: '1-30 Days', value: aging.days30, color: COLORS.warning },
      { name: '31-60 Days', value: aging.days60, color: '#F97316' },
      { name: '60+ Days', value: aging.days90, color: COLORS.chartNegative }
    ].filter(d => d.value > 0)
  }, [invoices])

  const projectProfitability = useMemo(() => {
    const projectData: { [key: string]: { revenue: number; costs: number } } = {}
    
    filteredInvoices.forEach(inv => {
      const project = inv.project_name || inv.project || 'Unassigned'
      if (!projectData[project]) projectData[project] = { revenue: 0, costs: 0 }
      projectData[project].revenue += parseFloat(inv.total_amount) || parseFloat(inv.total) || 0
    })
    
    filteredExpenses.filter(e => e.expense_type === 'direct_cost').forEach(exp => {
      const project = exp.project_name || exp.project || 'Unassigned'
      if (!projectData[project]) projectData[project] = { revenue: 0, costs: 0 }
      projectData[project].costs += parseFloat(exp.amount) || 0
    })
    
    return Object.entries(projectData)
      .map(([name, data]) => ({
        name: name.length > 15 ? name.substring(0, 15) + '...' : name,
        revenue: data.revenue,
        costs: data.costs,
        margin: data.revenue > 0 ? ((data.revenue - data.costs) / data.revenue) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
  }, [filteredInvoices, filteredExpenses])

  const teamUtilization = useMemo(() => {
    const memberHours: { [key: string]: { hours: number; rate: number } } = {}
    
    filteredTimeEntries.forEach(te => {
      const member = teamMembers.find(m => m.id === te.team_member_id || m.id === te.contractor_id)
      const name = member?.name || te.contractor_name || 'Unknown'
      if (!memberHours[name]) memberHours[name] = { hours: 0, rate: member?.hourly_rate || 0 }
      memberHours[name].hours += parseFloat(te.hours) || 0
    })
    
    return Object.entries(memberHours)
      .map(([name, data]) => ({ name, hours: Math.round(data.hours * 10) / 10, rate: data.rate }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 6)
  }, [filteredTimeEntries, teamMembers])

  const cashForecastData = useMemo(() => {
    const weeks = []
    let runningCash = metrics.netCash > 0 ? metrics.netCash : 50000
    const weeklyBurn = metrics.totalExpenses / (periodRange.weeksInPeriod || 4)
    const weeklyIncome = metrics.totalRevenue / (periodRange.weeksInPeriod || 4)
    
    for (let i = 0; i < 12; i++) {
      runningCash += (weeklyIncome * 0.9) - weeklyBurn
      weeks.push({
        week: `W${i + 1}`,
        projected: Math.max(0, runningCash),
        threshold: 50000
      })
    }
    return weeks
  }, [metrics, periodRange])

  const alerts = useMemo(() => {
    const alertList: { type: 'danger' | 'warning' | 'info' | 'success'; title: string; subtitle?: string; action?: { label: string; href: string } }[] = []
    
    if (metrics.overdueAR > 0) {
      alertList.push({
        type: 'danger',
        title: `${formatCurrency(metrics.overdueAR)} in overdue invoices`,
        subtitle: 'Requires immediate attention',
        action: { label: 'Review', href: '/invoices' }
      })
    }
    
    if (metrics.grossMargin < 30) {
      alertList.push({
        type: 'warning',
        title: `Gross margin at ${metrics.grossMargin.toFixed(1)}%`,
        subtitle: 'Below 30% target threshold',
        action: { label: 'Analyze', href: '/projects' }
      })
    }
    
    if (metrics.billableRate < 60) {
      alertList.push({
        type: 'warning',
        title: `Billable utilization at ${metrics.billableRate.toFixed(0)}%`,
        subtitle: 'Team capacity underutilized',
        action: { label: 'View Team', href: '/team' }
      })
    }
    
    if (alertList.length === 0) {
      alertList.push({
        type: 'success',
        title: 'All metrics within healthy ranges',
        subtitle: 'No immediate action required'
      })
    }
    
    return alertList
  }, [metrics])

  const recentInvoices = useMemo(() => {
    return invoices
      .filter(inv => (parseFloat(inv.balance_due) || parseFloat(inv.balance) || 0) > 0)
      .map(inv => ({
        ...inv,
        days_overdue: Math.max(0, Math.floor((new Date().getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24)))
      }))
      .sort((a, b) => b.days_overdue - a.days_overdue)
      .slice(0, 5)
  }, [invoices])

  // ============ LOADING STATE ============
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw size={32} className="text-slate-400 animate-spin" />
          <p className="text-slate-500 font-medium">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // ============ RENDER ============
  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-6">
      {/* ============ HEADER ============ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Financial overview for {selectedYear}</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Year Selector */}
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          
          {/* Period Selector */}
          <div className="flex bg-white border border-slate-200 rounded-lg p-1">
            {(['week', 'month', 'quarter', 'ytd'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  period === p 
                    ? 'bg-slate-800 text-white' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p === 'ytd' ? 'YTD' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ============ KPI ROW ============ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          title="Revenue" 
          value={formatCurrency(metrics.totalRevenue, true)} 
          subtitle={`Gross Margin: ${metrics.grossMargin.toFixed(1)}%`}
          icon={DollarSign} 
          color="positive"
          href="/invoices"
        />
        <KPICard 
          title="Total Expenses" 
          value={formatCurrency(metrics.totalExpenses, true)} 
          subtitle={`Direct: ${formatCurrency(metrics.directCosts, true)} | OH: ${formatCurrency(metrics.overhead, true)}`}
          icon={Receipt} 
          color="negative"
          href="/expenses"
        />
        <KPICard 
          title="Outstanding AR" 
          value={formatCurrency(metrics.totalAR, true)} 
          subtitle={`${metrics.openInvoices} open invoices`}
          trend={metrics.overdueAR > 0 ? -(metrics.overdueAR / metrics.totalAR * 100) : 0}
          trendLabel={metrics.overdueAR > 0 ? 'overdue' : ''}
          icon={Clock} 
          color={metrics.overdueAR > 0 ? 'warning' : 'default'}
          href="/invoices"
        />
        <KPICard 
          title="Team Hours" 
          value={`${formatNumber(metrics.totalHours, 0)}h`} 
          subtitle={`${metrics.billableRate.toFixed(0)}% billable`}
          icon={Users} 
          color="default"
          href="/team"
        />
      </div>

      {/* ============ CHARTS ROW 1 ============ */}
      <div className="grid grid-cols-12 gap-4">
        {/* Revenue & Expenses Chart */}
        <div className="col-span-12 lg:col-span-8">
          <Section title="Revenue vs Expenses" subtitle="Monthly comparison">
            <div className="h-64">
              {revenueExpenseData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={revenueExpenseData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.chartGrid} vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: COLORS.chartAxis, fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: COLORS.chartAxis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                    <Bar dataKey="revenue" name="Revenue" fill={COLORS.chartPositive} radius={[4, 4, 0, 0]} barSize={32} />
                    <Bar dataKey="directCosts" name="Direct Costs" fill={COLORS.chartNegative} radius={[4, 4, 0, 0]} barSize={32} />
                    <Bar dataKey="overhead" name="Overhead" fill={COLORS.chartNeutral} radius={[4, 4, 0, 0]} barSize={32} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">No data for selected period</div>
              )}
            </div>
            <div className="flex items-center gap-6 mt-3 pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.chartPositive }} /><span className="text-xs text-slate-500">Revenue</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.chartNegative }} /><span className="text-xs text-slate-500">Direct Costs</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS.chartNeutral }} /><span className="text-xs text-slate-500">Overhead</span></div>
            </div>
          </Section>
        </div>

        {/* Financial Health + AR Aging */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          {/* Health Score */}
          <Section title="Financial Health">
            <div className="flex items-center gap-6">
              <HealthScoreRing score={metrics.healthScore} size={100} />
              <div className="flex-1 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Gross Margin</span>
                  <span className="font-semibold" style={{ color: getStatusColor(metrics.grossMargin, { good: 40, warning: 25 }) }}>{metrics.grossMargin.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Net Margin</span>
                  <span className="font-semibold" style={{ color: getStatusColor(metrics.netMargin, { good: 20, warning: 10 }) }}>{metrics.netMargin.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Utilization</span>
                  <span className="font-semibold" style={{ color: getStatusColor(metrics.billableRate, { good: 70, warning: 50 }) }}>{metrics.billableRate.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </Section>

          {/* AR Aging */}
          <Section title="AR Aging" subtitle="Outstanding by age">
            <div className="h-32">
              {arAgingData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie data={arAgingData} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={2} dataKey="value">
                      {arAgingData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                  </RePieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm">No outstanding AR</div>
              )}
            </div>
            <div className="space-y-1.5 mt-2">
              {arAgingData.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-500 text-xs">{item.name}</span>
                  </div>
                  <span className="font-medium text-slate-700 text-xs">{formatCurrency(item.value)}</span>
                </div>
              ))}
              {metrics.avgDSO > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-slate-400 text-xs">Avg. DSO</span>
                  <span className="font-medium text-slate-600 text-xs">{metrics.avgDSO.toFixed(0)} days</span>
                </div>
              )}
            </div>
          </Section>
        </div>
      </div>

      {/* ============ CHARTS ROW 2 ============ */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-6">
          <Section title="Project Profitability" subtitle="Revenue & margin by project" action={{ label: 'View All', href: '/projects' }}>
            <div className="h-56">
              {projectProfitability.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={projectProfitability} layout="vertical" margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.chartGrid} horizontal={false} />
                    <XAxis type="number" tick={{ fill: COLORS.chartAxis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                    <YAxis dataKey="name" type="category" tick={{ fill: COLORS.textSecondary, fontSize: 11 }} width={80} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                    <Bar dataKey="revenue" name="Revenue" fill={COLORS.chartPositive} radius={[0, 4, 4, 0]} barSize={16}>
                      {projectProfitability.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.margin >= 40 ? COLORS.chartPositive : entry.margin >= 20 ? COLORS.accent : COLORS.warning} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">No project data available</div>
              )}
            </div>
            {projectProfitability.length > 0 && (
              <div className="flex items-center gap-4 mt-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.chartPositive }} /><span className="text-xs text-slate-400">40%+ margin</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.accent }} /><span className="text-xs text-slate-400">20-40%</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.warning }} /><span className="text-xs text-slate-400">&lt;20%</span></div>
              </div>
            )}
          </Section>
        </div>

        <div className="col-span-12 lg:col-span-6">
          <Section title="Team Utilization" subtitle="Hours logged this period" action={{ label: 'View Team', href: '/team' }}>
            <div className="min-h-[224px]">
              {teamUtilization.length > 0 ? (
                <div className="space-y-1">
                  {teamUtilization.map((member, i) => (
                    <UtilizationGauge key={i} name={member.name} hours={member.hours} target={40} rate={member.rate} />
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">No time entries available</div>
              )}
            </div>
            {teamUtilization.length > 0 && (
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-400">Team Average</span>
                <span className="text-sm font-semibold text-slate-700">
                  {(teamUtilization.reduce((sum, m) => sum + m.hours, 0) / teamUtilization.length).toFixed(0)}h
                  <span className="text-slate-400 font-normal ml-1">/ 40h target</span>
                </span>
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* ============ BOTTOM ROW ============ */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-4">
          <Section title="Alerts & Insights" badge={alerts.filter(a => a.type === 'danger' || a.type === 'warning').length || undefined}>
            <div className="space-y-2.5 min-h-[200px]">
              {alerts.map((alert, i) => <AlertItem key={i} {...alert} />)}
            </div>
          </Section>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <Section title="90-Day Cash Forecast" subtitle="Projected cash position">
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashForecastData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.chartPositive} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={COLORS.chartPositive} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.chartGrid} vertical={false} />
                  <XAxis dataKey="week" tick={{ fill: COLORS.chartAxis, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: COLORS.chartAxis, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                  <ReferenceLine y={50000} stroke={COLORS.warning} strokeDasharray="5 5" />
                  <Area type="monotone" dataKey="projected" name="Projected" stroke={COLORS.chartPositive} strokeWidth={2} fill="url(#cashGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-xs text-slate-400">Projected</span></div>
              <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-amber-500" style={{ borderStyle: 'dashed' }} /><span className="text-xs text-slate-400">Alert threshold</span></div>
            </div>
          </Section>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <Section title="Open Invoices" badge={metrics.openInvoices} action={{ label: 'View All', href: '/invoices' }}>
            <div className="min-h-[200px]">
              {recentInvoices.length > 0 ? (
                <div className="space-y-0">
                  {recentInvoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-700 truncate">{inv.client_name}</p>
                        <p className="text-xs text-slate-400">{inv.invoice_number || inv.doc_number || 'Draft'} • Due {formatDate(inv.due_date)}</p>
                      </div>
                      <div className="text-right ml-3">
                        <p className="text-sm font-semibold text-slate-800">{formatCurrency(parseFloat(inv.balance_due) || parseFloat(inv.balance) || 0)}</p>
                        {(inv.days_overdue || 0) > 0 && <p className="text-xs text-rose-500">{inv.days_overdue}d overdue</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm">No open invoices</div>
              )}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}
