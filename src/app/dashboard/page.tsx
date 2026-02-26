'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  TrendingUp, TrendingDown, DollarSign, Clock, Users, 
  AlertTriangle, ChevronRight, ChevronDown, Calendar,
  ArrowUpRight, ArrowDownRight, Receipt, 
  AlertCircle, CheckCircle2, RefreshCw, FileText, Briefcase
} from 'lucide-react'
import Link from 'next/link'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, AreaChart, ReferenceLine, Line, ComposedChart
} from 'recharts'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// ============ INSTITUTIONAL THEME ============
const CHART = {
  emerald: '#10b981',
  blue: '#3b82f6',
  gray: '#6b7280',
  rose: '#f43f5e',
  amber: '#f59e0b',
  orange: '#f97316',
  red: '#ef4444',
  darkRed: '#dc2626',
  grid: '#f3f4f6',
  axis: '#6b7280',
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

// ============ REUSABLE COMPONENTS ============

// Left-accent MetricCard
function MetricCard({ label, value, subValue, trend, trendLabel, icon: Icon, href, accentColor = 'bg-emerald-500' }: { 
  label: string; value: string; subValue?: string; trend?: number; trendLabel?: string; icon: any; href?: string; accentColor?: string
}) {
  const content = (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden transition-all hover:border-gray-300 hover:shadow-md group">
      <div className="flex">
        <div className={`w-1 ${accentColor} shrink-0`} />
        <div className="flex-1 p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
              <p className="text-2xl font-semibold tracking-tight text-gray-900 tabular-nums">{value}</p>
              {subValue && <p className="text-xs text-gray-500">{subValue}</p>}
              {trend !== undefined && (
                <div className="flex items-center gap-1.5 pt-0.5">
                  {trend >= 0 ? <ArrowUpRight size={13} className="text-emerald-600" /> : <ArrowDownRight size={13} className="text-rose-600" />}
                  <span className={`text-xs font-medium tabular-nums ${trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{Math.abs(trend).toFixed(1)}%</span>
                  {trendLabel && <span className="text-xs text-gray-400">{trendLabel}</span>}
                </div>
              )}
            </div>
            <div className="p-2 rounded-lg bg-gray-50 group-hover:bg-gray-100 transition-colors">
              <Icon size={18} className="text-gray-400" strokeWidth={1.5} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
  if (href) return <Link href={href} className="block">{content}</Link>
  return content
}

// Section Card
function Section({ title, subtitle, action, children, badge, noPadding = false, fillHeight = false }: { 
  title: string; subtitle?: string; action?: { label: string; href: string }; children: React.ReactNode
  badge?: string | number; noPadding?: boolean; fillHeight?: boolean
}) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl overflow-hidden transition-all hover:shadow-md ${fillHeight ? 'h-full flex flex-col' : ''}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
            {badge !== undefined && (
              <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-md bg-gray-100 text-gray-500 border border-gray-200">{badge}</span>
            )}
          </div>
          {subtitle && <p className="text-xs mt-0.5 text-gray-500">{subtitle}</p>}
        </div>
        {action && (
          <Link href={action.href} className="text-xs font-medium text-gray-500 hover:text-emerald-600 flex items-center gap-0.5 transition-colors">
            {action.label}<ChevronRight size={14} />
          </Link>
        )}
      </div>
      <div className={`${fillHeight ? 'flex-1' : ''} ${noPadding ? '' : 'p-5'}`}>{children}</div>
    </div>
  )
}

// Health Ring
function HealthRing({ score, size = 100 }: { score: number; size?: number }) {
  const strokeWidth = 6
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (score / 100) * circumference
  const getColor = (s: number) => s >= 70 ? CHART.emerald : s >= 40 ? CHART.amber : CHART.red

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={getColor(score)} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-700 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-gray-900">{score}</span>
        <span className="text-[10px] font-medium text-gray-400">/ 100</span>
      </div>
    </div>
  )
}

// Progress Bar
function ProgressBar({ value, max = 100, color = CHART.emerald }: { value: number; max?: number; color?: string }) {
  const percentage = Math.min((value / max) * 100, 100)
  return (
    <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden relative">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percentage}%`, backgroundColor: color }} />
    </div>
  )
}

// Team Row
function TeamRow({ name, hours, target = 40 }: { name: string; hours: number; target?: number }) {
  const utilization = (hours / target) * 100
  const color = utilization >= 80 ? CHART.emerald : utilization >= 50 ? CHART.amber : CHART.gray
  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-100 last:border-0">
      <div className="w-24 min-w-0"><p className="text-sm font-medium text-gray-600 truncate">{name}</p></div>
      <div className="flex-1"><ProgressBar value={utilization} color={color} /></div>
      <div className="text-right w-16"><p className="text-sm font-semibold tabular-nums" style={{ color }}>{hours}h</p></div>
    </div>
  )
}

// Alert Row
function AlertRow({ type, message, detail, action }: { 
  type: 'error' | 'warning' | 'success'; message: string; detail?: string; action?: { label: string; href: string }
}) {
  const config = {
    error: { icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
    warning: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    success: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  }
  const { icon: Icon, color, bg, border } = config[type]
  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg ${bg} border ${border}`}>
      <Icon size={16} className={`${color} mt-0.5 flex-shrink-0`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{message}</p>
        {detail && <p className="text-xs mt-0.5 text-gray-500">{detail}</p>}
      </div>
      {action && <Link href={action.href} className="text-xs font-medium text-gray-500 hover:text-emerald-600 transition-colors">{action.label}</Link>}
    </div>
  )
}

// Chart Tooltip
const ChartTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-[11px] text-gray-500 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>{entry.name}: {formatter ? formatter(entry.value) : entry.value}</p>
      ))}
    </div>
  )
}

const selectClass = "appearance-none bg-white border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer transition-colors"

// ============ MAIN DASHBOARD ============
export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [bills, setBills] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [timeEntries, setTimeEntries] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'ytd'>('ytd')
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

        const [invRes, billsRes, expRes, projRes, timeRes, teamRes] = await Promise.all([
          supabase.from('invoices').select('*').eq('company_id', profile.company_id).order('invoice_date', { ascending: false }),
          supabase.from('bills').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
          supabase.from('expenses').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
          supabase.from('projects').select('*').eq('company_id', profile.company_id),
          supabase.from('time_entries').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
          supabase.from('team_members').select('*').eq('company_id', profile.company_id),
        ])

        setInvoices(invRes.data || [])
        setBills(billsRes.data || [])
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

  // ============ PERIOD RANGE ============
  const periodRange = useMemo(() => {
    const now = new Date()
    let endDate = selectedYear < currentYear ? new Date(selectedYear, 11, 31, 23, 59, 59) : now
    let startDate: Date

    switch (period) {
      case 'week':
        startDate = selectedYear < currentYear ? new Date(selectedYear, 11, 24) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
        break
      case 'month':
        startDate = selectedYear < currentYear ? new Date(selectedYear, 11, 1) : new Date(now.getFullYear(), now.getMonth(), 1)
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
      case 'ytd': default:
        startDate = new Date(selectedYear, 0, 1)
    }

    const weeksInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) || 4
    return { startDate, endDate, weeksInPeriod }
  }, [period, selectedYear, currentYear])

  // ============ FILTERED DATA ============
  const filteredInvoices = useMemo(() => invoices.filter(inv => { const d = new Date(inv.invoice_date); return d >= periodRange.startDate && d <= periodRange.endDate }), [invoices, periodRange])
  const filteredBills = useMemo(() => bills.filter(bill => { const d = new Date(bill.date); return d >= periodRange.startDate && d <= periodRange.endDate }), [bills, periodRange])
  const filteredExpenses = useMemo(() => expenses.filter(exp => { const d = new Date(exp.date); return d >= periodRange.startDate && d <= periodRange.endDate }), [expenses, periodRange])
  const filteredTimeEntries = useMemo(() => timeEntries.filter(te => { const d = new Date(te.date); return d >= periodRange.startDate && d <= periodRange.endDate }), [timeEntries, periodRange])

  // ============ METRICS ============
  const metrics = useMemo(() => {
    const totalRevenue = filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0)
    const directCosts = filteredBills.reduce((sum, bill) => sum + (parseFloat(bill.amount) || 0), 0)
    const overhead = filteredExpenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0)
    const totalExpenses = directCosts + overhead
    const grossProfit = totalRevenue - directCosts
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
    const netProfit = grossProfit - overhead
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

    const openInvoices = invoices.filter(inv => (parseFloat(inv.balance_due) || 0) > 0)
    const totalAR = openInvoices.reduce((sum, inv) => sum + (parseFloat(inv.balance_due) || 0), 0)
    const overdueInvoices = openInvoices.filter(inv => new Date(inv.due_date) < new Date())
    const overdueAR = overdueInvoices.reduce((sum, inv) => sum + (parseFloat(inv.balance_due) || 0), 0)

    const openBills = bills.filter(bill => {
      const balance = parseFloat(bill.balance) || (parseFloat(bill.amount) - (parseFloat(bill.paid_amount) || 0))
      return balance > 0
    })
    const totalAP = openBills.reduce((sum, bill) => sum + (parseFloat(bill.balance) || (parseFloat(bill.amount) - (parseFloat(bill.paid_amount) || 0))), 0)

    const totalHours = filteredTimeEntries.reduce((sum, te) => sum + (parseFloat(te.hours) || 0), 0)
    const billableHours = filteredTimeEntries.filter(te => te.is_billable).reduce((sum, te) => sum + (parseFloat(te.hours) || 0), 0)
    const billableRate = totalHours > 0 ? (billableHours / totalHours) * 100 : 0

    const arScore = totalAR > 0 ? Math.max(0, 100 - (overdueAR / totalAR) * 100) : 100
    const marginScore = Math.min(100, Math.max(0, grossMargin * 2))
    const utilizationScore = Math.min(100, billableRate)
    const healthScore = Math.round((arScore * 0.3) + (marginScore * 0.4) + (utilizationScore * 0.3))

    return {
      totalRevenue, directCosts, overhead, totalExpenses,
      grossProfit, grossMargin, netProfit, netMargin,
      totalAR, overdueAR, totalAP, openInvoicesCount: openInvoices.length,
      totalHours, billableHours, billableRate, healthScore,
      arScore, marginScore, utilizationScore
    }
  }, [filteredInvoices, filteredBills, filteredExpenses, filteredTimeEntries, invoices, bills])

  // ============ PREVIOUS PERIOD TRENDS (#1) ============
  const trends = useMemo(() => {
    const duration = periodRange.endDate.getTime() - periodRange.startDate.getTime()
    const prevStart = new Date(periodRange.startDate.getTime() - duration)
    const prevEnd = new Date(periodRange.startDate.getTime() - 1)

    const prevInv = invoices.filter(inv => { const d = new Date(inv.invoice_date); return d >= prevStart && d <= prevEnd })
    const prevBills = bills.filter(bill => { const d = new Date(bill.date); return d >= prevStart && d <= prevEnd })
    const prevExp = expenses.filter(exp => { const d = new Date(exp.date); return d >= prevStart && d <= prevEnd })
    const prevTime = timeEntries.filter(te => { const d = new Date(te.date); return d >= prevStart && d <= prevEnd })

    const prevRevenue = prevInv.reduce((s, inv) => s + (parseFloat(inv.amount) || 0), 0)
    const prevExpenses = prevBills.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0) + prevExp.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0)
    const prevHours = prevTime.reduce((s, te) => s + (parseFloat(te.hours) || 0), 0)

    const pct = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0

    return {
      revenue: pct(metrics.totalRevenue, prevRevenue),
      expenses: pct(metrics.totalExpenses, prevExpenses),
      hours: pct(metrics.totalHours, prevHours),
    }
  }, [invoices, bills, expenses, timeEntries, periodRange, metrics])

  // ============ CHART DATA ============
  const revenueExpenseData = useMemo(() => {
    const months: { [key: string]: { revenue: number; expenses: number } } = {}
    filteredInvoices.forEach(inv => {
      const month = new Date(inv.invoice_date).toLocaleString('en-US', { month: 'short' })
      if (!months[month]) months[month] = { revenue: 0, expenses: 0 }
      months[month].revenue += parseFloat(inv.amount) || 0
    })
    filteredBills.forEach(bill => {
      const month = new Date(bill.date).toLocaleString('en-US', { month: 'short' })
      if (!months[month]) months[month] = { revenue: 0, expenses: 0 }
      months[month].expenses += parseFloat(bill.amount) || 0
    })
    filteredExpenses.forEach(exp => {
      const month = new Date(exp.date).toLocaleString('en-US', { month: 'short' })
      if (!months[month]) months[month] = { revenue: 0, expenses: 0 }
      months[month].expenses += parseFloat(exp.amount) || 0
    })
    const monthOrder = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return Object.entries(months).map(([month, data]) => ({ month, revenue: data.revenue, expenses: data.expenses, netIncome: data.revenue - data.expenses }))
      .sort((a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month)).slice(-6)
  }, [filteredInvoices, filteredBills, filteredExpenses])

  const arAgingData = useMemo(() => {
    const now = new Date()
    const aging = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0 }
    invoices.filter(inv => (parseFloat(inv.balance_due) || 0) > 0).forEach(inv => {
      const balance = parseFloat(inv.balance_due) || 0
      const days = Math.floor((now.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24))
      if (days <= 0) aging.current += balance
      else if (days <= 30) aging.days1to30 += balance
      else if (days <= 60) aging.days31to60 += balance
      else if (days <= 90) aging.days61to90 += balance
      else aging.days90plus += balance
    })
    return [
      { name: 'Current', value: aging.current, color: CHART.emerald },
      { name: '1-30 Days', value: aging.days1to30, color: CHART.amber },
      { name: '31-60 Days', value: aging.days31to60, color: CHART.orange },
      { name: '61-90 Days', value: aging.days61to90, color: CHART.red },
      { name: '90+ Days', value: aging.days90plus, color: CHART.darkRed },
    ].filter(d => d.value > 0)
  }, [invoices])

  const teamUtilization = useMemo(() => {
    const memberHours: { [key: string]: number } = {}
    filteredTimeEntries.forEach(te => {
      const member = teamMembers.find(m => m.id === te.team_member_id || m.id === te.contractor_id)
      const name = member?.name || te.contractor_name || 'Unknown'
      memberHours[name] = (memberHours[name] || 0) + (parseFloat(te.hours) || 0)
    })
    return Object.entries(memberHours).map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours).slice(0, 5)
  }, [filteredTimeEntries, teamMembers])

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

  const alerts = useMemo(() => {
    const list: { type: 'error' | 'warning' | 'success'; message: string; detail?: string; action?: { label: string; href: string } }[] = []
    if (metrics.overdueAR > 0) list.push({ type: 'error', message: `${formatCurrency(metrics.overdueAR)} overdue`, detail: 'Requires immediate attention', action: { label: 'Review', href: '/invoices' } })
    if (metrics.grossMargin < 30 && metrics.totalRevenue > 0) list.push({ type: 'warning', message: `Gross margin at ${metrics.grossMargin.toFixed(1)}%`, detail: 'Below 30% target', action: { label: 'Analyze', href: '/projects' } })
    if (metrics.totalAP > 50000) list.push({ type: 'warning', message: `${formatCurrency(metrics.totalAP)} in AP`, detail: 'Outstanding contractor bills', action: { label: 'Review', href: '/invoices' } })
    if (list.length === 0) list.push({ type: 'success', message: 'All metrics healthy', detail: 'No action required' })
    return list
  }, [metrics])

  const recentInvoices = useMemo(() => {
    return invoices.filter(inv => (parseFloat(inv.balance_due) || 0) > 0)
      .map(inv => ({ ...inv, daysOverdue: Math.max(0, Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24))) }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue).slice(0, 5)
  }, [invoices])

  // ============ LOADING ============
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw size={24} className="text-emerald-500 animate-spin" />
          <p className="text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  // ============ RENDER ============
  const hasData = invoices.length > 0 || bills.length > 0 || expenses.length > 0 || timeEntries.length > 0

  if (!hasData) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-sm mt-0.5 text-gray-500">Financial overview</p>
        </div>
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'radial-gradient(circle, #9ca3af 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="relative">
            <Briefcase size={36} className="text-gray-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-700 mb-2">No financial data yet</h2>
            <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">Connect QuickBooks or add your first invoice to populate your dashboard with live metrics, charts, and alerts.</p>
            <div className="flex items-center justify-center gap-3">
              <Link href="/settings" className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-500 transition-colors">Connect QuickBooks</Link>
              <Link href="/invoices" className="px-5 py-2.5 bg-white border border-gray-200 text-sm font-medium text-gray-600 rounded-lg hover:border-gray-300 transition-colors">Add Invoice</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-sm mt-0.5 text-gray-500">Financial overview for {selectedYear}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Year */}
          <div className="relative">
            <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className={selectClass}>
              {availableYears.map(year => <option key={year} value={year} className="bg-white">{year}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>

          {/* Period toggle — institutional pill */}
          <div className="flex bg-gray-100 border border-gray-200 rounded-lg p-0.5">
            {(['week', 'month', 'quarter', 'ytd'] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  period === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {p === 'ytd' ? 'YTD' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* [FIX #8] Active date range indicator */}
      <div className="flex items-center gap-2 -mt-3">
        <span className="text-[11px] text-gray-400">
          {periodRange.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – {periodRange.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>

      {/* KPI Cards — with trends (#1) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Revenue" value={formatCurrency(metrics.totalRevenue)}
          subValue={`Gross Margin: ${metrics.grossMargin.toFixed(1)}%`} trend={trends.revenue} trendLabel="vs prior" icon={DollarSign} href="/invoices" accentColor="bg-emerald-500" />
        <MetricCard label="Expenses" value={formatCurrency(metrics.totalExpenses)}
          subValue={`Direct: ${formatCurrency(metrics.directCosts)} | OH: ${formatCurrency(metrics.overhead)}`} trend={trends.expenses} trendLabel="vs prior" icon={Receipt} href="/expenses" accentColor="bg-rose-500" />
        <MetricCard label="Outstanding AR" value={formatCurrency(metrics.totalAR)}
          subValue={`${metrics.openInvoicesCount} open invoices`} icon={FileText} href="/invoices" accentColor="bg-blue-500" />
        <MetricCard label="Team Hours" value={`${metrics.totalHours.toFixed(0)}h`}
          subValue={`${metrics.billableRate.toFixed(0)}% billable`} trend={trends.hours} trendLabel="vs prior" icon={Users} href="/team" accentColor="bg-amber-500" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-12 gap-4">
        {/* Revenue vs Expenses */}
        <div className="col-span-12 lg:col-span-8">
          <Section title="Revenue vs Expenses" subtitle="Monthly comparison">
            <div className="h-64">
              {revenueExpenseData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={revenueExpenseData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v)} />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                    <Bar dataKey="revenue" name="Revenue" fill={CHART.emerald} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" name="Expenses" fill={CHART.gray} radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="netIncome" name="Net Income" stroke={CHART.amber} strokeWidth={2} dot={{ fill: CHART.amber, r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">No data for selected period</div>
              )}
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: CHART.emerald }} /><span className="text-xs text-gray-500">Revenue</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: CHART.gray }} /><span className="text-xs text-gray-500">Expenses</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-0.5 rounded" style={{ backgroundColor: CHART.amber }} /><span className="text-xs text-gray-500">Net Income</span></div>
            </div>
          </Section>
        </div>

        {/* Health + AR */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <Section title="Financial Health">
            <div className="flex items-center gap-5">
              <HealthRing score={metrics.healthScore} size={90} />
              <div className="flex-1 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Gross Margin</span><span className="font-medium text-gray-900">{metrics.grossMargin.toFixed(1)}%</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Net Margin</span><span className="font-medium text-gray-900">{metrics.netMargin.toFixed(1)}%</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Utilization</span><span className="font-medium text-gray-900">{metrics.billableRate.toFixed(0)}%</span></div>
              </div>
            </div>
            {/* [FIX #3] Factor breakdown bars */}
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2.5">
              {[
                { label: 'AR Health', score: metrics.arScore, weight: '30%' },
                { label: 'Margin', score: metrics.marginScore, weight: '40%' },
                { label: 'Utilization', score: metrics.utilizationScore, weight: '30%' },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-3">
                  <span className="text-[11px] text-gray-400 w-16 shrink-0">{f.label}</span>
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(f.score, 100)}%`, backgroundColor: f.score >= 70 ? CHART.emerald : f.score >= 40 ? CHART.amber : CHART.red }} />
                  </div>
                  <span className="text-[11px] font-semibold text-gray-600 tabular-nums w-8 text-right">{Math.round(f.score)}</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="AR Aging">
            {arAgingData.length > 0 ? (
              <div className="space-y-3">
                {/* [FIX #4] Stacked proportion bar */}
                <div className="flex w-full h-3 rounded-full overflow-hidden bg-gray-100">
                  {arAgingData.map((item, i) => (
                    <div key={i} className="h-full transition-all" style={{ width: `${(item.value / metrics.totalAR) * 100}%`, backgroundColor: item.color }} />
                  ))}
                </div>
                {/* [FIX #4] Overdue warning */}
                {(() => {
                  const aged60 = arAgingData.filter(d => d.name === '31-60 Days' || d.name === '61-90 Days' || d.name === '90+ Days').reduce((s, d) => s + d.value, 0)
                  const pct60 = metrics.totalAR > 0 ? (aged60 / metrics.totalAR) * 100 : 0
                  return pct60 > 30 ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                      <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                      <span className="text-[11px] text-amber-700">{pct60.toFixed(0)}% of AR is past 60 days</span>
                    </div>
                  ) : null
                })()}
                {arAgingData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm text-gray-600">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 tabular-nums">{metrics.totalAR > 0 ? ((item.value / metrics.totalAR) * 100).toFixed(0) : 0}%</span>
                      <span className="text-sm font-semibold text-gray-900 tabular-nums">{formatCurrency(item.value)}</span>
                    </div>
                  </div>
                ))}
                <div className="pt-3 mt-1 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-500">Total AR</span>
                    <span className="text-sm font-bold text-gray-900 tabular-nums">{formatCurrency(metrics.totalAR)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-20 text-gray-400 text-sm">No outstanding AR</div>
            )}
          </Section>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-12 gap-4">
        {/* Team Utilization */}
        <div className="col-span-12 lg:col-span-6">
          <Section title="Team Utilization" subtitle="Hours logged this period" action={{ label: 'View Team', href: '/team' }}>
            {teamUtilization.length > 0 ? (
              <div>
                {teamUtilization.map((member, i) => <TeamRow key={i} name={member.name} hours={member.hours} />)}
                <div className="flex items-center justify-between pt-3 mt-2 border-t border-gray-200">
                  <span className="text-xs text-gray-400">Team avg {(teamUtilization.reduce((sum, m) => sum + m.hours, 0) / teamUtilization.length).toFixed(0)}h / 40h target</span>
                  <span className="text-[10px] text-gray-400">{teamUtilization.length} member{teamUtilization.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm py-8">No time entries</div>
            )}
          </Section>
        </div>

        {/* Cash Forecast */}
        <div className="col-span-12 lg:col-span-6">
          <Section title="90-Day Cash Forecast" subtitle="Projected cash position">
            {/* [FIX #5] Breach warning */}
            {cashForecastData.some(w => w.projected < 50000) && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg">
                <AlertTriangle size={13} className="text-rose-600 shrink-0" />
                <span className="text-[11px] text-rose-700">Cash drops below $50K threshold during forecast period</span>
              </div>
            )}
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashForecastData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART.emerald} stopOpacity={0.15}/>
                      <stop offset="95%" stopColor={CHART.emerald} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="week" tick={{ fill: CHART.axis, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: CHART.axis, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v)} />} cursor={{ stroke: 'rgba(0,0,0,0.06)', strokeWidth: 1 }} />
                  <ReferenceLine y={50000} stroke={CHART.amber} strokeDasharray="5 5" strokeWidth={1} label={{ value: 'Min $50K', position: 'right', fill: CHART.amber, fontSize: 10 }} />
                  <Area type="monotone" dataKey="projected" name="Projected" stroke={CHART.emerald} strokeWidth={2} fill="url(#cashGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-2 pt-2 border-t border-gray-200">
              <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART.emerald }} /><span className="text-xs text-gray-400">Projected</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 border-t border-dashed" style={{ borderColor: CHART.amber }} /><span className="text-xs text-gray-400">Min Cash</span></div>
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
              {alerts.map((alert, i) => <AlertRow key={i} {...alert} />)}
            </div>
          </Section>
        </div>

        {/* Open Invoices */}
        <div className="col-span-12 lg:col-span-8">
          <Section title="Open Invoices" badge={metrics.openInvoicesCount} action={{ label: 'View All', href: '/invoices' }} noPadding>
            {recentInvoices.length > 0 ? (
              <div>
                {/* [FIX #6] Summary strip */}
                <div className="flex items-center gap-4 px-5 py-2.5 bg-gray-50/50 border-b border-gray-200">
                  <span className="text-xs text-gray-500">Total: <span className="font-semibold text-gray-900">{formatCurrency(metrics.totalAR)}</span></span>
                  {metrics.overdueAR > 0 && <span className="text-xs text-rose-600">Overdue: <span className="font-semibold">{formatCurrency(metrics.overdueAR)}</span></span>}
                </div>
                <div className="flex items-center px-5 py-2 border-b border-gray-200">
                  <div className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Client</div>
                  <div className="w-24 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Invoice</div>
                  <div className="w-24 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Due</div>
                  <div className="w-28 text-[11px] font-semibold uppercase tracking-wider text-right text-gray-400">Balance</div>
                  <div className="w-24 text-[11px] font-semibold uppercase tracking-wider text-right text-gray-400">Status</div>
                </div>
                {recentInvoices.map((inv) => (
                  <div key={inv.id} className="flex items-center px-5 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 text-sm font-medium truncate text-gray-600">{inv.client || '—'}</div>
                    <div className="w-24 text-sm text-gray-500">{inv.invoice_number || 'Draft'}</div>
                    <div className="w-24 text-sm text-gray-500">{formatDate(inv.due_date)}</div>
                    <div className="w-28 text-sm font-medium text-right tabular-nums text-gray-900">{formatCurrency(parseFloat(inv.balance_due) || 0)}</div>
                    <div className="w-24 text-right">
                      {inv.daysOverdue > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide bg-rose-50 text-rose-600 border border-rose-200">{inv.daysOverdue}d overdue</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-500 border border-gray-200">Current</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm py-12">No open invoices</div>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}
