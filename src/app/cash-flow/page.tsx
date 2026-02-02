'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  TrendingUp, TrendingDown, DollarSign, CreditCard, Wallet, Building2,
  ChevronRight, ChevronDown, ChevronUp, Plus, RefreshCw, ArrowUpRight, 
  ArrowDownRight, Percent, Receipt, PiggyBank, FileText, Users,
  AlertCircle, Clock, ArrowRight
} from 'lucide-react'
import Link from 'next/link'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, ComposedChart, Line, ReferenceLine
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
    secondary: '#3B82F6',
    tertiary: '#64748b',
    negative: '#EF4444',
    warning: '#F59E0B',
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
    <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-5 transition-all duration-200 ${THEME.glassHover} group`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className={`text-sm font-medium ${THEME.textMuted}`}>{label}</p>
          <p className={`text-2xl font-semibold tracking-tight ${valueColor}`}>{value}</p>
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
        className={`flex items-center justify-between px-5 py-4 border-b ${THEME.glassBorder} ${collapsible ? 'cursor-pointer hover:bg-white/[0.03] transition-colors' : ''}`}
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
        <div className={noPadding ? '' : 'p-5'}>
          {children}
        </div>
      )}
    </div>
  )
}

// P&L Row with progress bar
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
    <div className={`flex items-center justify-between py-3 ${indent ? 'pl-5' : ''}`}>
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <span className={`text-sm ${bold ? `font-semibold ${THEME.textPrimary}` : indent ? THEME.textMuted : `font-medium ${THEME.textSecondary}`}`}>
          {label}
        </span>
        {percentage !== undefined && (
          <div className="flex-1 max-w-32 hidden sm:block">
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

// Chart Tooltip
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
  const [bills, setBills] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [companySettings, setCompanySettings] = useState<any>(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString('en-US', { month: 'long' }))
  const [showAllTransactions, setShowAllTransactions] = useState(false)

  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const years = [2026, 2025, 2024, 2023]

  // ============ DATA FETCHING ============
  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await getCurrentUser()
        const user = result?.user
        if (!user) { setLoading(false); return }

        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
        if (!profile?.company_id) { setLoading(false); return }

        setCompanyId(profile.company_id)

        // Fetch all relevant tables including bills for AP
        const [txRes, invRes, billsRes, expRes, projRes, clientRes, settingsRes] = await Promise.all([
          supabase.from('transactions').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
          supabase.from('invoices').select('*').eq('company_id', profile.company_id).order('invoice_date', { ascending: false }),
          supabase.from('bills').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
          supabase.from('expenses').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
          supabase.from('projects').select('*').eq('company_id', profile.company_id),
          supabase.from('clients').select('*').eq('company_id', profile.company_id),
          supabase.from('company_settings').select('*').eq('company_id', profile.company_id).single()
        ])

        setTransactions(txRes.data || [])
        setInvoices(invRes.data || [])
        setBills(billsRes.data || [])
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

  // ============ PERIOD FILTERING ============
  const periodRange = useMemo(() => {
    const monthIndex = months.indexOf(selectedMonth)
    const startDate = new Date(selectedYear, monthIndex, 1)
    const endDate = new Date(selectedYear, monthIndex + 1, 0, 23, 59, 59)
    return { startDate, endDate, monthIndex }
  }, [selectedYear, selectedMonth])

  const filteredInvoices = useMemo(() => invoices.filter(inv => {
    const d = new Date(inv.invoice_date)
    return d >= periodRange.startDate && d <= periodRange.endDate
  }), [invoices, periodRange])

  const filteredBills = useMemo(() => bills.filter(bill => {
    const d = new Date(bill.date)
    return d >= periodRange.startDate && d <= periodRange.endDate
  }), [bills, periodRange])

  const filteredExpenses = useMemo(() => expenses.filter(exp => {
    const d = new Date(exp.date)
    return d >= periodRange.startDate && d <= periodRange.endDate
  }), [expenses, periodRange])

  const filteredTransactions = useMemo(() => transactions.filter(tx => {
    const d = new Date(tx.date)
    return d >= periodRange.startDate && d <= periodRange.endDate
  }), [transactions, periodRange])

  // ============ METRICS CALCULATION ============
  // Data Model:
  // - Revenue = invoices.amount (what clients owe/paid)
  // - Direct Costs = bills.amount (contractor/vendor invoices - AP)
  // - Overhead = expenses.amount (bank transactions - rent, utilities, etc.)
  // - Cash Position = company_settings.beginning_balance + sum(transactions.amount)
  
  const metrics = useMemo(() => {
    // Cash Position
    const beginningBalance = parseFloat(companySettings?.beginning_balance) || 0
    const transactionSum = transactions.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0)
    const cashPosition = beginningBalance + transactionSum
    
    // AR - Outstanding invoices (balance_due > 0)
    const openInvoices = invoices.filter(inv => (parseFloat(inv.balance_due) || 0) > 0)
    const totalAR = openInvoices.reduce((sum, inv) => sum + (parseFloat(inv.balance_due) || 0), 0)
    const overdueAR = openInvoices
      .filter(inv => new Date(inv.due_date) < new Date())
      .reduce((sum, inv) => sum + (parseFloat(inv.balance_due) || 0), 0)
    
    // AP - Outstanding bills (balance > 0 or amount - paid_amount)
    const openBills = bills.filter(bill => {
      const balance = parseFloat(bill.balance) || (parseFloat(bill.amount) - (parseFloat(bill.paid_amount) || 0))
      return balance > 0
    })
    const totalAP = openBills.reduce((sum, bill) => {
      return sum + (parseFloat(bill.balance) || (parseFloat(bill.amount) - (parseFloat(bill.paid_amount) || 0)))
    }, 0)
    const overdueAP = openBills
      .filter(bill => new Date(bill.due_date) < new Date())
      .reduce((sum, bill) => {
        return sum + (parseFloat(bill.balance) || (parseFloat(bill.amount) - (parseFloat(bill.paid_amount) || 0)))
      }, 0)
    
    // Net Working Capital
    const netWorkingCapital = totalAR - totalAP
    
    // Period P&L
    const revenue = filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0)
    const directCosts = filteredBills.reduce((sum, bill) => sum + (parseFloat(bill.amount) || 0), 0)
    const overhead = filteredExpenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0)
    
    const grossProfit = revenue - directCosts
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0
    const netProfit = grossProfit - overhead
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0

    // Previous month comparison
    const prevMonthIndex = periodRange.monthIndex - 1
    const prevYear = prevMonthIndex < 0 ? selectedYear - 1 : selectedYear
    const prevMonth = prevMonthIndex < 0 ? 11 : prevMonthIndex
    const prevStart = new Date(prevYear, prevMonth, 1)
    const prevEnd = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59)
    
    const prevRevenue = invoices.filter(inv => {
      const d = new Date(inv.invoice_date)
      return d >= prevStart && d <= prevEnd
    }).reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0)
    
    const revenueChange = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0

    // Period cash flow
    const periodInflows = filteredTransactions.filter(tx => (parseFloat(tx.amount) || 0) > 0)
      .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0)
    const periodOutflows = Math.abs(filteredTransactions.filter(tx => (parseFloat(tx.amount) || 0) < 0)
      .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0))
    const netCashFlow = periodInflows - periodOutflows

    return {
      cashPosition,
      totalAR,
      overdueAR,
      totalAP,
      overdueAP,
      netWorkingCapital,
      revenue,
      directCosts,
      overhead,
      grossProfit,
      grossMargin,
      netProfit,
      netMargin,
      revenueChange,
      periodInflows,
      periodOutflows,
      netCashFlow,
      openInvoicesCount: openInvoices.length,
      openBillsCount: openBills.length
    }
  }, [companySettings, transactions, invoices, bills, filteredInvoices, filteredBills, filteredExpenses, filteredTransactions, periodRange, selectedYear])

  // ============ CHART DATA ============
  
  // Cash Flow Trend (6 months)
  const cashFlowTrendData = useMemo(() => {
    const data: { month: string; inflows: number; outflows: number; net: number }[] = []
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(selectedYear, periodRange.monthIndex - i, 1)
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      const monthName = d.toLocaleString('en-US', { month: 'short' })
      
      const monthTx = transactions.filter(tx => {
        const txDate = new Date(tx.date)
        return txDate >= monthStart && txDate <= monthEnd
      })
      
      const inflows = monthTx.filter(tx => (parseFloat(tx.amount) || 0) > 0)
        .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0)
      const outflows = Math.abs(monthTx.filter(tx => (parseFloat(tx.amount) || 0) < 0)
        .reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0))
      
      data.push({
        month: monthName,
        inflows,
        outflows,
        net: inflows - outflows
      })
    }
    
    return data
  }, [transactions, selectedYear, periodRange])

  // Revenue vs Costs by Month
  const revenueVsCostsData = useMemo(() => {
    const data: { month: string; revenue: number; directCosts: number; overhead: number }[] = []
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(selectedYear, periodRange.monthIndex - i, 1)
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      const monthName = d.toLocaleString('en-US', { month: 'short' })
      
      const monthRevenue = invoices.filter(inv => {
        const invDate = new Date(inv.invoice_date)
        return invDate >= monthStart && invDate <= monthEnd
      }).reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0)
      
      const monthDirectCosts = bills.filter(bill => {
        const billDate = new Date(bill.date)
        return billDate >= monthStart && billDate <= monthEnd
      }).reduce((sum, bill) => sum + (parseFloat(bill.amount) || 0), 0)
      
      const monthOverhead = expenses.filter(exp => {
        const expDate = new Date(exp.date)
        return expDate >= monthStart && expDate <= monthEnd
      }).reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0)
      
      data.push({
        month: monthName,
        revenue: monthRevenue,
        directCosts: monthDirectCosts,
        overhead: monthOverhead
      })
    }
    
    return data
  }, [invoices, bills, expenses, selectedYear, periodRange])

  // Revenue by Project (current period)
  const revenueByProject = useMemo(() => {
    const projectRevenue: { [key: string]: number } = {}
    
    filteredInvoices.forEach(inv => {
      const project = projects.find(p => p.id === inv.project_id)
      const name = project?.name || 'Unassigned'
      projectRevenue[name] = (projectRevenue[name] || 0) + (parseFloat(inv.amount) || 0)
    })

    const colors = ['#10B981', '#3B82F6', '#F59E0B', '#64748b', '#94a3b8']
    
    return Object.entries(projectRevenue)
      .map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }))
      .filter(p => p.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [filteredInvoices, projects])

  // Top AR (who owes you)
  const topAR = useMemo(() => {
    const clientAR: { [key: string]: { amount: number; daysOverdue: number } } = {}
    
    invoices.filter(inv => (parseFloat(inv.balance_due) || 0) > 0).forEach(inv => {
      const clientName = inv.client || 'Unknown'
      const balance = parseFloat(inv.balance_due) || 0
      const daysOverdue = Math.max(0, Math.floor((new Date().getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24)))
      
      if (!clientAR[clientName]) {
        clientAR[clientName] = { amount: 0, daysOverdue: 0 }
      }
      clientAR[clientName].amount += balance
      clientAR[clientName].daysOverdue = Math.max(clientAR[clientName].daysOverdue, daysOverdue)
    })
    
    return Object.entries(clientAR)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
  }, [invoices])

  // Top AP (who you owe)
  const topAP = useMemo(() => {
    const vendorAP: { [key: string]: { amount: number; daysOverdue: number } } = {}
    
    bills.filter(bill => {
      const balance = parseFloat(bill.balance) || (parseFloat(bill.amount) - (parseFloat(bill.paid_amount) || 0))
      return balance > 0
    }).forEach(bill => {
      const vendorName = bill.vendor || bill.contractor || 'Unknown'
      const balance = parseFloat(bill.balance) || (parseFloat(bill.amount) - (parseFloat(bill.paid_amount) || 0))
      const daysOverdue = Math.max(0, Math.floor((new Date().getTime() - new Date(bill.due_date).getTime()) / (1000 * 60 * 60 * 24)))
      
      if (!vendorAP[vendorName]) {
        vendorAP[vendorName] = { amount: 0, daysOverdue: 0 }
      }
      vendorAP[vendorName].amount += balance
      vendorAP[vendorName].daysOverdue = Math.max(vendorAP[vendorName].daysOverdue, daysOverdue)
    })
    
    return Object.entries(vendorAP)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5)
  }, [bills])

  // Display transactions
  const displayTransactions = useMemo(() => {
    const sorted = [...filteredTransactions].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    return showAllTransactions ? sorted : sorted.slice(0, 8)
  }, [filteredTransactions, showAllTransactions])

  // ============ LOADING ============
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

  // ============ RENDER ============
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-xl font-semibold ${THEME.textPrimary}`}>Cash Flow</h1>
          <p className={`text-sm mt-1 ${THEME.textMuted}`}>Cash position, working capital & profitability</p>
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

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Cash Position"
          value={formatCurrency(metrics.cashPosition)}
          subValue="Available cash"
          icon={Wallet}
          valueColor={metrics.cashPosition >= 0 ? 'text-emerald-400' : 'text-rose-400'}
        />
        <MetricCard
          label="AR Outstanding"
          value={formatCurrency(metrics.totalAR)}
          subValue={`${metrics.openInvoicesCount} open invoices`}
          icon={FileText}
          href="/invoices"
          valueColor="text-blue-400"
        />
        <MetricCard
          label="AP Outstanding"
          value={formatCurrency(metrics.totalAP)}
          subValue={`${metrics.openBillsCount} unpaid bills`}
          icon={Receipt}
          href="/invoices"
          valueColor="text-amber-400"
        />
        <MetricCard
          label="Net Working Capital"
          value={formatCurrency(metrics.netWorkingCapital)}
          subValue="AR - AP"
          trend={metrics.revenueChange}
          trendLabel="vs last month"
          icon={TrendingUp}
          valueColor={metrics.netWorkingCapital >= 0 ? 'text-emerald-400' : 'text-rose-400'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-12 gap-4">
        {/* Cash Flow Trend */}
        <div className="col-span-12 lg:col-span-6">
          <Section title="Cash Flow Trend" subtitle="Inflows vs Outflows (6 months)">
            <div className="h-64">
              {cashFlowTrendData.some(d => d.inflows > 0 || d.outflows > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={cashFlowTrendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={THEME.chart.grid} vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: THEME.chart.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: THEME.chart.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v)} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="inflows" name="Inflows" fill={THEME.chart.primary} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="outflows" name="Outflows" fill={THEME.chart.negative} radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="net" name="Net" stroke={THEME.chart.secondary} strokeWidth={2} dot={{ fill: THEME.chart.secondary, strokeWidth: 0, r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className={`flex items-center justify-center h-full ${THEME.textMuted} text-sm`}>
                  No transaction data available
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.05]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: THEME.chart.primary }} />
                <span className={`text-xs ${THEME.textMuted}`}>Inflows</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: THEME.chart.negative }} />
                <span className={`text-xs ${THEME.textMuted}`}>Outflows</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 rounded" style={{ backgroundColor: THEME.chart.secondary }} />
                <span className={`text-xs ${THEME.textMuted}`}>Net</span>
              </div>
            </div>
          </Section>
        </div>

        {/* Revenue vs Costs */}
        <div className="col-span-12 lg:col-span-6">
          <Section title="Revenue vs Costs" subtitle="Monthly comparison (6 months)">
            <div className="h-64">
              {revenueVsCostsData.some(d => d.revenue > 0 || d.directCosts > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueVsCostsData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={THEME.chart.grid} vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: THEME.chart.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: THEME.chart.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v)} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="revenue" name="Revenue" fill={THEME.chart.primary} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="directCosts" name="Direct Costs" fill={THEME.chart.warning} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="overhead" name="Overhead" fill={THEME.chart.tertiary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className={`flex items-center justify-center h-full ${THEME.textMuted} text-sm`}>
                  No revenue/cost data available
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/[0.05]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: THEME.chart.primary }} />
                <span className={`text-xs ${THEME.textMuted}`}>Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: THEME.chart.warning }} />
                <span className={`text-xs ${THEME.textMuted}`}>Direct Costs</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: THEME.chart.tertiary }} />
                <span className={`text-xs ${THEME.textMuted}`}>Overhead</span>
              </div>
            </div>
          </Section>
        </div>
      </div>

      {/* P&L + Revenue by Project */}
      <div className="grid grid-cols-12 gap-4">
        {/* Profit & Loss */}
        <div className="col-span-12 lg:col-span-8">
          <Section title="Profit & Loss" subtitle={`${selectedMonth} ${selectedYear}`}>
            <div className="divide-y divide-white/[0.05]">
              <PLRow label="Revenue" value={metrics.revenue} percentage={100} type="positive" bold />
              <PLRow label="Direct Costs (Contractors)" value={metrics.directCosts} percentage={metrics.revenue > 0 ? (metrics.directCosts / metrics.revenue) * 100 : 0} type="negative" indent />
              <div className="h-px bg-white/[0.1] my-1" />
              <PLRow label="Gross Profit" value={metrics.grossProfit} percentage={metrics.grossMargin} type={metrics.grossProfit >= 0 ? 'positive' : 'negative'} bold />
              <PLRow label="Overhead (Operating)" value={metrics.overhead} percentage={metrics.revenue > 0 ? (metrics.overhead / metrics.revenue) * 100 : 0} type="muted" indent />
              <div className="h-px bg-white/[0.1] my-1" />
              <PLRow label="Net Profit" value={metrics.netProfit} percentage={metrics.netMargin} type={metrics.netProfit >= 0 ? 'positive' : 'negative'} bold />
            </div>
            
            {/* Period Cash Flow Summary */}
            <div className="mt-5 pt-5 border-t border-white/[0.08]">
              <h4 className={`text-xs font-medium uppercase tracking-wider ${THEME.textDim} mb-3`}>Period Cash Flow</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/[0.03] rounded-lg p-3">
                  <p className={`text-xs ${THEME.textMuted} mb-1`}>Inflows</p>
                  <p className="text-lg font-semibold text-emerald-400">{formatCurrency(metrics.periodInflows)}</p>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3">
                  <p className={`text-xs ${THEME.textMuted} mb-1`}>Outflows</p>
                  <p className="text-lg font-semibold text-rose-400">{formatCurrency(metrics.periodOutflows)}</p>
                </div>
                <div className="bg-white/[0.03] rounded-lg p-3">
                  <p className={`text-xs ${THEME.textMuted} mb-1`}>Net Cash Flow</p>
                  <p className={`text-lg font-semibold ${metrics.netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(metrics.netCashFlow)}
                  </p>
                </div>
              </div>
            </div>
          </Section>
        </div>

        {/* Revenue by Project */}
        <div className="col-span-12 lg:col-span-4">
          <Section title="Revenue by Project" action={{ label: 'View All', href: '/projects' }}>
            {revenueByProject.length > 0 ? (
              <>
                <div className="h-40 -mx-2">
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
                <div className="space-y-2 mt-2">
                  {revenueByProject.map((project, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                        <span className={`${THEME.textSecondary} truncate`}>{project.name}</span>
                      </div>
                      <span className={`font-semibold ${THEME.textPrimary} tabular-nums shrink-0 ml-3`}>{formatCurrency(project.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className={`flex items-center justify-center h-40 ${THEME.textMuted} text-sm`}>
                No project revenue this period
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* AR/AP Summary Row */}
      <div className="grid grid-cols-12 gap-4">
        {/* Top AR */}
        <div className="col-span-12 lg:col-span-6">
          <Section title="Accounts Receivable" subtitle="Who owes you" badge={metrics.openInvoicesCount} action={{ label: 'View All', href: '/invoices' }} noPadding>
            {topAR.length > 0 ? (
              <div>
                <div className={`flex items-center px-5 py-2 bg-white/[0.03] border-b ${THEME.glassBorder}`}>
                  <div className={`flex-1 text-xs font-medium uppercase tracking-wider ${THEME.textDim}`}>Client</div>
                  <div className={`w-24 text-xs font-medium uppercase tracking-wider text-right ${THEME.textDim}`}>Balance</div>
                  <div className={`w-20 text-xs font-medium uppercase tracking-wider text-right ${THEME.textDim}`}>Status</div>
                </div>
                {topAR.map((item, i) => (
                  <div key={i} className="flex items-center px-5 py-3 border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors">
                    <div className={`flex-1 text-sm font-medium ${THEME.textSecondary} truncate`}>{item.name}</div>
                    <div className={`w-24 text-sm font-semibold text-right tabular-nums ${THEME.textPrimary}`}>{formatCurrency(item.amount)}</div>
                    <div className="w-20 text-right">
                      {item.daysOverdue > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-500/15 text-rose-400 border border-rose-500/20">
                          {item.daysOverdue}d late
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                          Current
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-5 py-3 bg-white/[0.02]">
                  <span className={`text-sm font-medium ${THEME.textMuted}`}>Total AR</span>
                  <span className={`text-sm font-bold ${THEME.textPrimary}`}>{formatCurrency(metrics.totalAR)}</span>
                </div>
              </div>
            ) : (
              <div className={`flex items-center justify-center py-12 ${THEME.textMuted} text-sm`}>
                No outstanding receivables
              </div>
            )}
          </Section>
        </div>

        {/* Top AP */}
        <div className="col-span-12 lg:col-span-6">
          <Section title="Accounts Payable" subtitle="Who you owe" badge={metrics.openBillsCount} action={{ label: 'View All', href: '/invoices' }} noPadding>
            {topAP.length > 0 ? (
              <div>
                <div className={`flex items-center px-5 py-2 bg-white/[0.03] border-b ${THEME.glassBorder}`}>
                  <div className={`flex-1 text-xs font-medium uppercase tracking-wider ${THEME.textDim}`}>Vendor</div>
                  <div className={`w-24 text-xs font-medium uppercase tracking-wider text-right ${THEME.textDim}`}>Balance</div>
                  <div className={`w-20 text-xs font-medium uppercase tracking-wider text-right ${THEME.textDim}`}>Status</div>
                </div>
                {topAP.map((item, i) => (
                  <div key={i} className="flex items-center px-5 py-3 border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors">
                    <div className={`flex-1 text-sm font-medium ${THEME.textSecondary} truncate`}>{item.name}</div>
                    <div className={`w-24 text-sm font-semibold text-right tabular-nums text-amber-400`}>{formatCurrency(item.amount)}</div>
                    <div className="w-20 text-right">
                      {item.daysOverdue > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-500/15 text-rose-400 border border-rose-500/20">
                          {item.daysOverdue}d late
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/[0.05] text-slate-400 border border-white/[0.1]">
                          Current
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-5 py-3 bg-white/[0.02]">
                  <span className={`text-sm font-medium ${THEME.textMuted}`}>Total AP</span>
                  <span className={`text-sm font-bold text-amber-400`}>{formatCurrency(metrics.totalAP)}</span>
                </div>
              </div>
            ) : (
              <div className={`flex items-center justify-center py-12 ${THEME.textMuted} text-sm`}>
                No outstanding payables
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* Transactions */}
      <Section 
        title="Recent Transactions" 
        subtitle={`${filteredTransactions.length} this period`}
        collapsible
        defaultExpanded={true}
        badge={filteredTransactions.length}
        noPadding
      >
        <div>
          {/* Header */}
          <div className={`flex items-center px-5 py-2 bg-white/[0.03] border-b ${THEME.glassBorder}`}>
            <div className={`flex-1 text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>Description</div>
            <div className={`w-28 text-xs font-medium ${THEME.textDim} uppercase tracking-wider hidden sm:block`}>Category</div>
            <div className={`w-24 text-xs font-medium ${THEME.textDim} uppercase tracking-wider hidden sm:block`}>Date</div>
            <div className={`w-28 text-xs font-medium ${THEME.textDim} uppercase tracking-wider text-right`}>Amount</div>
          </div>
          
          {/* Rows */}
          {displayTransactions.length > 0 ? (
            <>
              {displayTransactions.map((tx, i) => (
                <div key={i} className="flex items-center px-5 py-3 border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${THEME.textSecondary} truncate`}>{tx.description || tx.name || 'Transaction'}</p>
                    <p className={`text-xs ${THEME.textDim} sm:hidden`}>{formatDate(tx.date)}</p>
                  </div>
                  <div className={`w-28 hidden sm:block`}>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/[0.05] ${THEME.textMuted} border border-white/[0.08]`}>
                      {tx.category || tx.type || 'Other'}
                    </span>
                  </div>
                  <div className={`w-24 text-sm ${THEME.textMuted} hidden sm:block`}>{formatDate(tx.date)}</div>
                  <div className={`w-28 text-sm font-semibold text-right tabular-nums ${(parseFloat(tx.amount) || 0) < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {formatCurrency(parseFloat(tx.amount) || 0)}
                  </div>
                </div>
              ))}
              
              {filteredTransactions.length > 8 && (
                <button 
                  onClick={() => setShowAllTransactions(!showAllTransactions)}
                  className={`w-full px-5 py-3 text-sm font-medium ${THEME.textMuted} hover:text-white hover:bg-white/[0.03] transition-colors flex items-center justify-center gap-1`}
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
