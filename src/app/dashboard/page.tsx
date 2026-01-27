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
  'https://jmahfgpbtjeomuepfozf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYWhmZ3BidGplb211ZXBmb3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0OTAxNzcsImV4cCI6MjA4MTA2NjE3N30.3SVDvWCGIYYHV57BpKjpDJVCZLKzuRv8B_VietQDxUQ'
)

// ============ DESIGN SYSTEM ============
const COLORS = {
  // Primary palette
  primary: '#3b82f6',
  primaryLight: '#60a5fa',
  primaryDark: '#2563eb',
  
  // Status colors
  success: '#10b981',
  successLight: '#34d399',
  warning: '#f59e0b',
  warningLight: '#fbbf24',
  danger: '#ef4444',
  dangerLight: '#f87171',
  
  // Accent colors for charts
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  pink: '#ec4899',
  orange: '#f97316',
  indigo: '#6366f1',
  teal: '#14b8a6',
  
  // Neutral
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a'
  }
}

const CHART_COLORS = [COLORS.primary, COLORS.success, COLORS.warning, COLORS.purple, COLORS.cyan, COLORS.pink, COLORS.orange]

// ============ UTILITY FUNCTIONS ============
const formatCurrency = (value: number, compact = false): string => {
  if (compact && Math.abs(value) >= 1000000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value)
  }
  if (compact && Math.abs(value) >= 10000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 0
    }).format(value)
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

const formatNumber = (value: number, decimals = 1): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  }).format(value)
}

const formatPercent = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric'
  })
}

const getHealthColor = (score: number): string => {
  if (score >= 80) return COLORS.success
  if (score >= 60) return COLORS.warning
  return COLORS.danger
}

const getStatusColor = (value: number, thresholds: { good: number; warning: number }, inverse = false): string => {
  if (inverse) {
    if (value <= thresholds.good) return COLORS.success
    if (value <= thresholds.warning) return COLORS.warning
    return COLORS.danger
  }
  if (value >= thresholds.good) return COLORS.success
  if (value >= thresholds.warning) return COLORS.warning
  return COLORS.danger
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
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={COLORS.slate[700]}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-slate-100">{score}</span>
        <span className="text-xs text-slate-400">/ 100</span>
      </div>
    </div>
  )
}

// KPI Card with trend
function KPICard({ 
  title, 
  value, 
  subtitle,
  trend,
  trendLabel,
  icon: Icon, 
  color = 'blue',
  size = 'default',
  href
}: { 
  title: string
  value: string
  subtitle?: string
  trend?: number
  trendLabel?: string
  icon: any
  color?: 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'cyan'
  size?: 'default' | 'compact'
  href?: string
}) {
  const colorMap = {
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', icon: 'text-blue-500' },
    green: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', icon: 'text-emerald-500' },
    red: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', icon: 'text-rose-500' },
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', icon: 'text-amber-500' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', icon: 'text-purple-500' },
    cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400', icon: 'text-cyan-500' }
  }
  
  const colors = colorMap[color]
  const isCompact = size === 'compact'
  
  const content = (
    <div className={`${colors.bg} ${colors.border} border rounded-xl ${isCompact ? 'p-4' : 'p-5'} hover:border-opacity-40 transition-all duration-200`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-slate-400 ${isCompact ? 'text-xs' : 'text-sm'}`}>{title}</p>
          <p className={`font-bold ${colors.text} ${isCompact ? 'text-xl mt-0.5' : 'text-2xl mt-1'} truncate`}>{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1 truncate">{subtitle}</p>}
          {trend !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {trend >= 0 ? (
                <ArrowUpRight size={14} className="text-emerald-500" />
              ) : (
                <ArrowDownRight size={14} className="text-rose-500" />
              )}
              <span className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {Math.abs(trend).toFixed(1)}%
              </span>
              {trendLabel && <span className="text-xs text-slate-500">{trendLabel}</span>}
            </div>
          )}
        </div>
        <div className={`${colors.bg} p-2.5 rounded-lg ml-3`}>
          <Icon size={isCompact ? 18 : 20} className={colors.icon} />
        </div>
      </div>
    </div>
  )
  
  if (href) {
    return <Link href={href} className="block">{content}</Link>
  }
  return content
}

// Section Container
function Section({ 
  title, 
  subtitle,
  action,
  children,
  className = '',
  collapsible = false,
  defaultExpanded = true,
  badge
}: { 
  title: string
  subtitle?: string
  action?: { label: string; href: string } | React.ReactNode
  children: React.ReactNode
  className?: string
  collapsible?: boolean
  defaultExpanded?: boolean
  badge?: string | number
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  
  return (
    <div className={`bg-slate-800/50 backdrop-blur border border-slate-700/50 rounded-2xl overflow-hidden ${className}`}>
      <div 
        className={`flex items-center justify-between px-5 py-4 ${collapsible ? 'cursor-pointer hover:bg-slate-700/30' : ''}`}
        onClick={collapsible ? () => setExpanded(!expanded) : undefined}
      >
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-100">{title}</h2>
              {badge !== undefined && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-700 text-slate-300">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {action && !collapsible && (
            typeof action === 'object' && 'href' in action ? (
              <Link href={action.href} className="text-sm text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1">
                {action.label} <ChevronRight size={16} />
              </Link>
            ) : action
          )}
          {collapsible && (
            expanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />
          )}
        </div>
      </div>
      {(!collapsible || expanded) && (
        <div className="px-5 pb-5">
          {children}
        </div>
      )}
    </div>
  )
}

// Progress Bar
function ProgressBar({ 
  value, 
  max = 100, 
  color = COLORS.primary,
  showLabel = true,
  size = 'default',
  label
}: { 
  value: number
  max?: number
  color?: string
  showLabel?: boolean
  size?: 'small' | 'default'
  label?: string
}) {
  const percentage = Math.min((value / max) * 100, 100)
  const height = size === 'small' ? 'h-1.5' : 'h-2'
  
  return (
    <div className="w-full">
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-1">
          {label && <span className="text-xs text-slate-400">{label}</span>}
          {showLabel && <span className="text-xs font-medium text-slate-300">{percentage.toFixed(0)}%</span>}
        </div>
      )}
      <div className={`w-full ${height} bg-slate-700 rounded-full overflow-hidden`}>
        <div 
          className={`${height} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

// Utilization Gauge
function UtilizationGauge({ name, hours, target = 40, rate }: { name: string; hours: number; target?: number; rate?: number }) {
  const utilization = (hours / target) * 100
  const color = getStatusColor(utilization, { good: 70, warning: 50 })
  
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="w-28 truncate">
        <p className="text-sm font-medium text-slate-200 truncate">{name}</p>
        {rate && <p className="text-xs text-slate-500">${rate}/hr</p>}
      </div>
      <div className="flex-1">
        <ProgressBar value={utilization} color={color} showLabel={false} size="small" />
      </div>
      <div className="text-right w-20">
        <p className="text-sm font-semibold" style={{ color }}>{hours}h</p>
        <p className="text-xs text-slate-500">{utilization.toFixed(0)}%</p>
      </div>
    </div>
  )
}

// Alert Item
function AlertItem({ 
  type, 
  title, 
  subtitle,
  action
}: { 
  type: 'danger' | 'warning' | 'info' | 'success'
  title: string
  subtitle?: string
  action?: { label: string; href: string }
}) {
  const config = {
    danger: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', icon: AlertCircle, iconColor: 'text-rose-500' },
    warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: AlertTriangle, iconColor: 'text-amber-500' },
    info: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: Activity, iconColor: 'text-blue-500' },
    success: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2, iconColor: 'text-emerald-500' }
  }
  
  const { bg, border, icon: Icon, iconColor } = config[type]
  
  return (
    <div className={`${bg} ${border} border rounded-xl p-3 flex items-start gap-3`}>
      <div className={`p-1.5 rounded-lg ${bg}`}>
        <Icon size={16} className={iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200">{title}</p>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action && (
        <Link href={action.href} className="text-xs text-blue-400 hover:text-blue-300 font-medium whitespace-nowrap">
          {action.label}
        </Link>
      )}
    </div>
  )
}

// Custom Tooltip for Charts
const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null
  
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
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
  const [projects, setProjects] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [timeEntries, setTimeEntries] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [companySettings, setCompanySettings] = useState<any>(null)
  
  // Time period filter
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'ytd'>('month')

  useEffect(() => {
    const loadData = async () => {
      try {
        const { user } = await getCurrentUser()
        if (!user) return

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single()

        if (!profile?.company_id) {
          setLoading(false)
          return
        }

        setCompanyId(profile.company_id)

        // Fetch all data in parallel
        const [txRes, invRes, projRes, clientRes, timeRes, teamRes, settingsRes] = await Promise.all([
          supabase.from('transactions').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
          supabase.from('invoices').select('*').eq('company_id', profile.company_id).order('invoice_date', { ascending: false }),
          supabase.from('projects').select('*').eq('company_id', profile.company_id),
          supabase.from('clients').select('*').eq('company_id', profile.company_id),
          supabase.from('time_entries').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
          supabase.from('team_members').select('*').eq('company_id', profile.company_id),
          supabase.from('company_settings').select('*').eq('company_id', profile.company_id).single()
        ])

        setTransactions(txRes.data || [])
        setInvoices(invRes.data || [])
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

  // ============ CALCULATED METRICS ============
  const metrics = useMemo(() => {
    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()

    // Revenue & Expenses
    const revenue = transactions
      .filter(t => t.category === 'revenue')
      .reduce((sum, t) => sum + (t.amount || 0), 0)
    
    const expenses = transactions
      .filter(t => ['opex', 'overhead', 'cogs'].includes(t.category || ''))
      .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0)

    const cogs = transactions
      .filter(t => t.category === 'cogs')
      .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0)

    const netCash = revenue - expenses
    const grossProfit = revenue - cogs
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0
    const opexRatio = revenue > 0 ? (expenses / revenue) * 100 : 0

    // Cash metrics
    const currentCash = companySettings?.beginning_balance || 0
    const monthlyBurn = expenses / Math.max(1, new Set(transactions.filter(t => t.category !== 'revenue').map(t => t.date?.substring(0, 7))).size)
    const cashRunway = monthlyBurn > 0 ? currentCash / monthlyBurn : 99

    // AR metrics
    const totalAR = invoices.reduce((sum, inv) => sum + (inv.balance_due || 0), 0)
    const overdueAR = invoices
      .filter(inv => (inv.days_overdue || 0) > 0)
      .reduce((sum, inv) => sum + (inv.balance_due || 0), 0)
    
    // AR Aging buckets
    const arCurrent = invoices.filter(inv => (inv.days_overdue || 0) <= 0 && (inv.balance_due || 0) > 0).reduce((sum, inv) => sum + (inv.balance_due || 0), 0)
    const ar30 = invoices.filter(inv => (inv.days_overdue || 0) > 0 && (inv.days_overdue || 0) <= 30).reduce((sum, inv) => sum + (inv.balance_due || 0), 0)
    const ar60 = invoices.filter(inv => (inv.days_overdue || 0) > 30 && (inv.days_overdue || 0) <= 60).reduce((sum, inv) => sum + (inv.balance_due || 0), 0)
    const ar90 = invoices.filter(inv => (inv.days_overdue || 0) > 60).reduce((sum, inv) => sum + (inv.balance_due || 0), 0)

    // DSO calculation
    const paidInvoices = invoices.filter(inv => inv.paid_date && inv.invoice_date)
    const avgDSO = paidInvoices.length > 0 
      ? paidInvoices.reduce((sum, inv) => {
          const days = Math.floor((new Date(inv.paid_date).getTime() - new Date(inv.invoice_date).getTime()) / (1000 * 60 * 60 * 24))
          return sum + Math.max(0, days)
        }, 0) / paidInvoices.length
      : 0

    // Time tracking
    const totalHours = timeEntries.reduce((sum, t) => sum + (t.hours || 0), 0)
    const billableAmount = timeEntries.reduce((sum, t) => sum + ((t.hours || 0) * (t.bill_rate || 0)), 0)
    
    // WIP (unbilled hours)
    const wipAmount = billableAmount // Simplified - would need to track invoiced vs uninvoiced
    
    // Utilization (assuming 40hr weeks, 4 weeks)
    const activeTeamCount = teamMembers.filter(m => m.status === 'active').length
    const availableHours = activeTeamCount * 40 * 4 // Monthly available hours
    const utilization = availableHours > 0 ? (totalHours / availableHours) * 100 : 0
    
    // Effective bill rate
    const effectiveBillRate = totalHours > 0 ? billableAmount / totalHours : 0

    // Projects
    const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'in-progress').length

    // Financial Health Score (0-100)
    let healthScore = 50 // Base
    if (grossMargin >= 30) healthScore += 15
    else if (grossMargin >= 20) healthScore += 10
    else if (grossMargin >= 10) healthScore += 5
    
    if (cashRunway >= 6) healthScore += 15
    else if (cashRunway >= 3) healthScore += 10
    else if (cashRunway >= 1) healthScore += 5
    
    if (utilization >= 70) healthScore += 10
    else if (utilization >= 50) healthScore += 5
    
    if (overdueAR === 0) healthScore += 10
    else if (overdueAR < totalAR * 0.2) healthScore += 5
    
    healthScore = Math.min(100, Math.max(0, healthScore))

    return {
      revenue,
      expenses,
      netCash,
      grossProfit,
      grossMargin,
      opexRatio,
      currentCash,
      monthlyBurn,
      cashRunway,
      totalAR,
      overdueAR,
      arCurrent,
      ar30,
      ar60,
      ar90,
      avgDSO,
      totalHours,
      billableAmount,
      wipAmount,
      utilization,
      effectiveBillRate,
      activeProjects,
      healthScore,
      openInvoices: invoices.filter(i => (i.balance_due || 0) > 0).length
    }
  }, [transactions, invoices, timeEntries, projects, teamMembers, companySettings])

  // Cash Flow Chart Data (6 months)
  const cashFlowData = useMemo(() => {
    const months: { [key: string]: { month: string; revenue: number; expenses: number; net: number } } = {}
    const now = new Date()
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = d.toLocaleDateString('en-US', { month: 'short' })
      const fullKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      months[fullKey] = { month: key, revenue: 0, expenses: 0, net: 0 }
    }

    transactions.forEach(tx => {
      const key = tx.date?.substring(0, 7)
      if (months[key]) {
        if (tx.category === 'revenue') {
          months[key].revenue += tx.amount || 0
        } else if (['opex', 'overhead', 'cogs'].includes(tx.category || '')) {
          months[key].expenses += Math.abs(tx.amount || 0)
        }
      }
    })

    return Object.values(months).map(m => ({
      ...m,
      net: m.revenue - m.expenses
    }))
  }, [transactions])

  // 90-Day Cash Forecast
  const cashForecastData = useMemo(() => {
    const data = []
    let runningCash = metrics.currentCash
    const avgWeeklyInflow = metrics.revenue / 12 // Simplified weekly average
    const avgWeeklyOutflow = metrics.expenses / 12
    
    for (let week = 0; week <= 12; week++) {
      const date = new Date()
      date.setDate(date.getDate() + (week * 7))
      
      // Add some variance for realistic projection
      const variance = 0.9 + Math.random() * 0.2
      const weeklyNet = (avgWeeklyInflow - avgWeeklyOutflow) * variance
      
      if (week > 0) runningCash += weeklyNet
      
      data.push({
        week: week === 0 ? 'Now' : `W${week}`,
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        projected: Math.max(0, runningCash),
        threshold: companySettings?.balance_alert_threshold || 50000
      })
    }
    
    return data
  }, [metrics, companySettings])

  // Project Profitability
  const projectProfitability = useMemo(() => {
    const projectData: { [key: string]: { name: string; revenue: number; cost: number; hours: number; margin: number } } = {}
    
    // Get hours and labor cost per project
    timeEntries.forEach(entry => {
      const project = projects.find(p => p.id === entry.project_id)
      const projectName = project?.name || 'Unknown'
      if (!projectData[projectName]) {
        projectData[projectName] = { name: projectName, revenue: 0, cost: 0, hours: 0, margin: 0 }
      }
      projectData[projectName].hours += entry.hours || 0
      projectData[projectName].revenue += (entry.hours || 0) * (entry.bill_rate || 0)
      // Assume cost rate is 40% of bill rate for labor
      projectData[projectName].cost += (entry.hours || 0) * (entry.bill_rate || 0) * 0.4
    })
    
    // Calculate margins
    Object.values(projectData).forEach(p => {
      p.margin = p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0
    })
    
    return Object.values(projectData)
      .filter(p => p.hours > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)
  }, [timeEntries, projects])

  // Team Utilization
  const teamUtilization = useMemo(() => {
    const memberHours: { [key: string]: { name: string; hours: number; rate: number } } = {}
    
    timeEntries.forEach(entry => {
      const member = teamMembers.find(m => m.id === entry.contractor_id)
      const memberName = member?.name || 'Unknown'
      if (!memberHours[memberName]) {
        memberHours[memberName] = { name: memberName, hours: 0, rate: member?.bill_rate || 0 }
      }
      memberHours[memberName].hours += entry.hours || 0
    })
    
    return Object.values(memberHours)
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5)
  }, [timeEntries, teamMembers])

  // AR Aging Data
  const arAgingData = useMemo(() => [
    { name: 'Current', value: metrics.arCurrent, color: COLORS.success },
    { name: '1-30 Days', value: metrics.ar30, color: COLORS.warning },
    { name: '31-60 Days', value: metrics.ar60, color: COLORS.orange },
    { name: '60+ Days', value: metrics.ar90, color: COLORS.danger }
  ].filter(d => d.value > 0), [metrics])

  // Alerts
  const alerts = useMemo(() => {
    const list: { type: 'danger' | 'warning' | 'info' | 'success'; title: string; subtitle?: string; action?: { label: string; href: string } }[] = []
    
    if (metrics.ar90 > 0) {
      list.push({
        type: 'danger',
        title: `${formatCurrency(metrics.ar90)} over 60 days past due`,
        subtitle: 'Immediate follow-up recommended',
        action: { label: 'View', href: '/invoices' }
      })
    }
    
    if (metrics.overdueAR > 0 && metrics.ar90 === 0) {
      list.push({
        type: 'warning',
        title: `${formatCurrency(metrics.overdueAR)} in overdue invoices`,
        subtitle: `${invoices.filter(inv => (inv.days_overdue || 0) > 0).length} invoices need attention`,
        action: { label: 'View', href: '/invoices' }
      })
    }

    if (metrics.cashRunway < 3 && metrics.cashRunway > 0) {
      list.push({
        type: 'warning',
        title: `Cash runway: ${metrics.cashRunway.toFixed(1)} months`,
        subtitle: 'Consider reviewing expenses or accelerating collections'
      })
    }

    if (metrics.utilization < 50 && teamMembers.length > 0) {
      list.push({
        type: 'info',
        title: `Team utilization at ${metrics.utilization.toFixed(0)}%`,
        subtitle: 'Capacity available for new projects',
        action: { label: 'View Team', href: '/team' }
      })
    }

    // Check for projects over budget
    const overBudgetProjects = projects.filter(p => {
      if (!p.budget || p.budget <= 0) return false
      const projectHours = timeEntries.filter(t => t.project_id === p.id)
      const spent = projectHours.reduce((sum, t) => sum + ((t.hours || 0) * (t.bill_rate || 0)), 0)
      return spent / p.budget > 0.9
    })
    
    if (overBudgetProjects.length > 0) {
      list.push({
        type: 'warning',
        title: `${overBudgetProjects.length} project(s) near budget limit`,
        subtitle: overBudgetProjects.slice(0, 2).map(p => p.name).join(', '),
        action: { label: 'View', href: '/projects' }
      })
    }

    if (list.length === 0) {
      list.push({
        type: 'success',
        title: 'All systems healthy',
        subtitle: 'No critical alerts at this time'
      })
    }

    return list
  }, [metrics, invoices, projects, timeEntries, teamMembers])

  // Recent Activity
  const recentInvoices = useMemo(() => {
    return invoices
      .filter(inv => (inv.balance_due || 0) > 0)
      .slice(0, 4)
      .map(inv => {
        const client = clients.find(c => c.id === inv.client_id)
        return { ...inv, client_name: client?.name || 'Unknown' }
      })
  }, [invoices, clients])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* ============ HEADER ============ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            Financial overview • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
            {(['week', 'month', 'quarter', 'ytd'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  period === p 
                    ? 'bg-blue-500 text-white' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {p === 'ytd' ? 'YTD' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ============ HEALTH SCORE + PRIMARY KPIs ============ */}
      <div className="grid grid-cols-12 gap-4">
        {/* Health Score Card */}
        <div className="col-span-12 lg:col-span-3">
          <div className="bg-gradient-to-br from-slate-800 to-slate-800/50 border border-slate-700/50 rounded-2xl p-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-medium text-slate-400">Financial Health</h3>
                <p className="text-xs text-slate-500 mt-0.5">Overall score</p>
              </div>
              <Zap size={20} className="text-amber-500" />
            </div>
            <div className="flex items-center justify-center py-2">
              <HealthScoreRing score={metrics.healthScore} size={140} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-700/50">
              <div className="text-center">
                <p className="text-lg font-bold text-slate-100">{metrics.grossMargin.toFixed(0)}%</p>
                <p className="text-xs text-slate-500">Gross Margin</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-slate-100">{metrics.cashRunway.toFixed(1)}mo</p>
                <p className="text-xs text-slate-500">Cash Runway</p>
              </div>
            </div>
          </div>
        </div>

        {/* Primary KPIs */}
        <div className="col-span-12 lg:col-span-9">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KPICard
              title="Revenue"
              value={formatCurrency(metrics.revenue, true)}
              icon={TrendingUp}
              color="green"
              href="/cash-flow"
            />
            <KPICard
              title="Expenses"
              value={formatCurrency(metrics.expenses, true)}
              icon={TrendingDown}
              color="red"
              href="/cash-flow"
            />
            <KPICard
              title="Net Cash Flow"
              value={formatCurrency(metrics.netCash, true)}
              icon={DollarSign}
              color={metrics.netCash >= 0 ? 'green' : 'red'}
              href="/cash-flow"
            />
            <KPICard
              title="Accounts Receivable"
              value={formatCurrency(metrics.totalAR, true)}
              subtitle={metrics.overdueAR > 0 ? `${formatCurrency(metrics.overdueAR)} overdue` : 'All current'}
              icon={Receipt}
              color={metrics.overdueAR > 0 ? 'amber' : 'blue'}
              href="/invoices"
            />
            <KPICard
              title="Billable Hours"
              value={formatNumber(metrics.totalHours, 0)}
              subtitle={`${formatCurrency(metrics.billableAmount)} value`}
              icon={Clock}
              color="purple"
              href="/time-tracking"
            />
            <KPICard
              title="Utilization"
              value={`${metrics.utilization.toFixed(0)}%`}
              subtitle={`${teamMembers.filter(m => m.status === 'active').length} active members`}
              icon={Users}
              color={metrics.utilization >= 70 ? 'green' : metrics.utilization >= 50 ? 'amber' : 'cyan'}
              href="/team"
            />
          </div>
        </div>
      </div>

      {/* ============ CHARTS ROW 1 ============ */}
      <div className="grid grid-cols-12 gap-4">
        {/* Cash Flow Trend */}
        <div className="col-span-12 lg:col-span-8">
          <Section title="Cash Flow Trend" subtitle="Last 6 months" action={{ label: 'Details', href: '/cash-flow' }}>
            <div className="h-72">
              {cashFlowData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={cashFlowData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.slate[700]} vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fill: COLORS.slate[400], fontSize: 12 }} 
                      axisLine={{ stroke: COLORS.slate[700] }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: COLORS.slate[400], fontSize: 12 }} 
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                    <Bar dataKey="revenue" name="Revenue" fill={COLORS.success} radius={[4, 4, 0, 0]} barSize={24} />
                    <Bar dataKey="expenses" name="Expenses" fill={COLORS.danger} radius={[4, 4, 0, 0]} barSize={24} />
                    <Line type="monotone" dataKey="net" name="Net" stroke={COLORS.primary} strokeWidth={2} dot={{ fill: COLORS.primary, r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  No transaction data available
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* AR Aging */}
        <div className="col-span-12 lg:col-span-4">
          <Section title="AR Aging" subtitle={`${formatCurrency(metrics.totalAR)} total`} action={{ label: 'View', href: '/invoices' }}>
            <div className="h-44">
              {arAgingData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={arAgingData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {arAgingData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                  </RePieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                  No outstanding AR
                </div>
              )}
            </div>
            <div className="space-y-2 mt-2">
              {arAgingData.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-400 text-xs">{item.name}</span>
                  </div>
                  <span className="font-medium text-slate-200 text-xs">{formatCurrency(item.value)}</span>
                </div>
              ))}
              {metrics.avgDSO > 0 && (
                <div className="flex items-center justify-between text-sm pt-2 border-t border-slate-700/50">
                  <span className="text-slate-500 text-xs">Avg. DSO</span>
                  <span className="font-medium text-slate-300 text-xs">{metrics.avgDSO.toFixed(0)} days</span>
                </div>
              )}
            </div>
          </Section>
        </div>
      </div>

      {/* ============ CHARTS ROW 2 ============ */}
      <div className="grid grid-cols-12 gap-4">
        {/* Project Profitability */}
        <div className="col-span-12 lg:col-span-6">
          <Section title="Project Profitability" subtitle="Revenue & margin by project" action={{ label: 'View All', href: '/projects' }}>
            <div className="h-64">
              {projectProfitability.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={projectProfitability} 
                    layout="vertical" 
                    margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.slate[700]} horizontal={false} />
                    <XAxis 
                      type="number" 
                      tick={{ fill: COLORS.slate[400], fontSize: 11 }} 
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                    />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      tick={{ fill: COLORS.slate[400], fontSize: 11 }} 
                      width={80} 
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                    <Bar dataKey="revenue" name="Revenue" fill={COLORS.primary} radius={[0, 4, 4, 0]} barSize={18}>
                      {projectProfitability.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.margin >= 40 ? COLORS.success : entry.margin >= 20 ? COLORS.primary : COLORS.warning} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  No project data available
                </div>
              )}
            </div>
            {projectProfitability.length > 0 && (
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-700/50">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.success }} />
                  <span className="text-xs text-slate-500">40%+ margin</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.primary }} />
                  <span className="text-xs text-slate-500">20-40%</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS.warning }} />
                  <span className="text-xs text-slate-500">&lt;20%</span>
                </div>
              </div>
            )}
          </Section>
        </div>

        {/* Team Utilization */}
        <div className="col-span-12 lg:col-span-6">
          <Section title="Team Utilization" subtitle="Hours logged this period" action={{ label: 'View Team', href: '/team' }}>
            <div className="space-y-1">
              {teamUtilization.length > 0 ? (
                teamUtilization.map((member, i) => (
                  <UtilizationGauge 
                    key={i} 
                    name={member.name} 
                    hours={member.hours} 
                    target={40}
                    rate={member.rate}
                  />
                ))
              ) : (
                <div className="flex items-center justify-center h-48 text-slate-500">
                  No time entries available
                </div>
              )}
            </div>
            {teamUtilization.length > 0 && (
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700/50">
                <span className="text-xs text-slate-500">Team Average</span>
                <span className="text-sm font-semibold text-slate-200">
                  {(teamUtilization.reduce((sum, m) => sum + m.hours, 0) / teamUtilization.length).toFixed(0)}h
                  <span className="text-slate-500 font-normal ml-1">/ 40h target</span>
                </span>
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* ============ BOTTOM ROW ============ */}
      <div className="grid grid-cols-12 gap-4">
        {/* Alerts */}
        <div className="col-span-12 lg:col-span-4">
          <Section title="Alerts & Insights" badge={alerts.filter(a => a.type === 'danger' || a.type === 'warning').length || undefined}>
            <div className="space-y-3">
              {alerts.map((alert, i) => (
                <AlertItem key={i} {...alert} />
              ))}
            </div>
          </Section>
        </div>

        {/* Cash Forecast */}
        <div className="col-span-12 lg:col-span-4">
          <Section title="90-Day Cash Forecast" subtitle="Projected cash position">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashForecastData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.slate[700]} vertical={false} />
                  <XAxis 
                    dataKey="week" 
                    tick={{ fill: COLORS.slate[400], fontSize: 10 }} 
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fill: COLORS.slate[400], fontSize: 10 }} 
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                  <ReferenceLine 
                    y={cashForecastData[0]?.threshold || 50000} 
                    stroke={COLORS.warning} 
                    strokeDasharray="5 5"
                    label={{ value: 'Threshold', fill: COLORS.warning, fontSize: 10, position: 'right' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="projected" 
                    name="Projected Cash"
                    stroke={COLORS.primary} 
                    strokeWidth={2}
                    fill="url(#cashGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>

        {/* Open Invoices */}
        <div className="col-span-12 lg:col-span-4">
          <Section title="Open Invoices" badge={metrics.openInvoices} action={{ label: 'View All', href: '/invoices' }}>
            {recentInvoices.length > 0 ? (
              <div className="space-y-2">
                {recentInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-200 truncate">{inv.client_name}</p>
                      <p className="text-xs text-slate-500">
                        {inv.invoice_number || 'Draft'} • Due {formatDate(inv.due_date)}
                      </p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-sm font-semibold text-slate-100">{formatCurrency(inv.balance_due || 0)}</p>
                      {(inv.days_overdue || 0) > 0 && (
                        <p className="text-xs text-rose-400">{inv.days_overdue}d overdue</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
                No open invoices
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}
