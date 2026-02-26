'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { 
  TrendingUp, TrendingDown, DollarSign, CreditCard, Wallet, Building2,
  ChevronRight, ChevronDown, ChevronUp, Plus, RefreshCw, ArrowUpRight, 
  ArrowDownRight, Percent, Receipt, PiggyBank, FileText, Users,
  AlertCircle, Clock, ArrowRight, X, Cloud
} from 'lucide-react'
import Link from 'next/link'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, ComposedChart, Line, ReferenceLine
} from 'recharts'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/supabase'
import QBOSyncButton from '@/components/QBOSyncButton'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// ============ INSTITUTIONAL THEME ============
const CHART_COLORS = {
  emerald: '#10b981',
  blue: '#3b82f6',
  gray: '#6b7280',
  rose: '#f43f5e',
  amber: '#f59e0b',
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

// Left-accent MetricCard (institutional)
function MetricCard({ 
  label, value, subValue, trend, trendLabel, icon: Icon, href, accentColor = 'bg-emerald-500'
}: { 
  label: string; value: string; subValue?: string; trend?: number; trendLabel?: string
  icon: any; href?: string; accentColor?: string
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

// Section Card (institutional)
function Section({ 
  title, subtitle, action, children, noPadding = false, collapsible = false, defaultExpanded = true, badge
}: { 
  title: string; subtitle?: string; action?: { label: string; href?: string; onClick?: () => void }
  children: React.ReactNode; noPadding?: boolean; collapsible?: boolean; defaultExpanded?: boolean; badge?: string | number
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden transition-all hover:shadow-md">
      <div 
        className={`flex items-center justify-between px-5 py-4 border-b border-gray-200 ${collapsible ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}`}
        onClick={collapsible ? () => setIsExpanded(!isExpanded) : undefined}
      >
        <div className="flex items-center gap-3">
          {collapsible && (
            <div className="text-gray-500">
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
              {badge !== undefined && (
                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-md bg-gray-100 text-gray-500 border border-gray-200">{badge}</span>
              )}
            </div>
            {subtitle && <p className="text-xs mt-0.5 text-gray-500">{subtitle}</p>}
          </div>
        </div>
        {action && !collapsible && (
          action.onClick ? (
            <button onClick={action.onClick} className="text-xs font-medium text-gray-500 hover:text-emerald-600 flex items-center gap-0.5 transition-colors">
              {action.label}<ChevronRight size={14} />
            </button>
          ) : (
            <Link href={action.href || '#'} className="text-xs font-medium text-gray-500 hover:text-emerald-600 flex items-center gap-0.5 transition-colors">
              {action.label}<ChevronRight size={14} />
            </Link>
          )
        )}
      </div>
      {(!collapsible || isExpanded) && (
        <div className={noPadding ? '' : 'p-5'}>{children}</div>
      )}
    </div>
  )
}

// P&L Row with progress bar
function PLRow({ label, value, percentage, type, indent = false, bold = false }: { 
  label: string; value: number; percentage?: number
  type: 'positive' | 'negative' | 'neutral' | 'muted'; indent?: boolean; bold?: boolean
}) {
  const colorMap = { positive: 'text-emerald-600', negative: 'text-rose-600', neutral: 'text-gray-900', muted: 'text-gray-500' }
  const barColorMap = { positive: CHART_COLORS.emerald, negative: CHART_COLORS.rose, neutral: CHART_COLORS.gray, muted: '#e5e7eb' }
  const isSubtotal = bold && (label === 'Gross Profit' || label === 'Net Profit')

  return (
    <div className={`flex items-center justify-between py-3 ${indent ? 'pl-5' : ''} ${isSubtotal ? 'border-l-[3px] border-l-emerald-500 bg-emerald-50/50 pl-4 -mx-5 px-5' : ''}`}>
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <span className={`text-sm ${bold ? 'font-semibold text-gray-900' : indent ? 'text-gray-500' : 'font-medium text-gray-600'}`}>{label}</span>
        {percentage !== undefined && (
          <div className="flex-1 max-w-32 hidden sm:block">
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(Math.abs(percentage), 100)}%`, backgroundColor: barColorMap[type] }} />
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-sm tabular-nums ${bold ? 'font-bold' : 'font-semibold'} ${colorMap[type]}`}>{formatCurrency(value)}</span>
        {percentage !== undefined && (
          <span className="text-xs w-12 text-right tabular-nums text-gray-400">{percentage.toFixed(1)}%</span>
        )}
      </div>
    </div>
  )
}

// Chart Tooltip (institutional)
const ChartTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-[11px] text-gray-500 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  )
}

// Styled selects
const selectClass = "appearance-none bg-white border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer transition-colors"
const inputClass = "w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"

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
  const [selectedMonth, setSelectedMonth] = useState('Full Year')
  const [showAllTransactions, setShowAllTransactions] = useState(false)
  const [txFilter, setTxFilter] = useState<'all' | 'inflows' | 'outflows'>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newTransaction, setNewTransaction] = useState({
    description: '', amount: '', date: new Date().toISOString().split('T')[0], category: 'income', type: 'deposit'
  })

  const months = ['Full Year', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const years = [2026, 2025, 2024, 2023]

  // ============ DATA FETCHING ============
  const loadData = useCallback(async () => {
    try {
      const result = await getCurrentUser()
      const user = result?.user
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) { setLoading(false); return }

      setCompanyId(profile.company_id)

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
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Reload after QBO sync
  const handleSyncComplete = useCallback(() => {
    loadData()
  }, [loadData])

  // ============ PERIOD FILTERING ============
  const periodRange = useMemo(() => {
    if (selectedMonth === 'Full Year') {
      return { startDate: new Date(selectedYear, 0, 1), endDate: new Date(selectedYear, 11, 31, 23, 59, 59), monthIndex: -1, isFullYear: true }
    }
    const monthIndex = months.indexOf(selectedMonth) - 1
    return { startDate: new Date(selectedYear, monthIndex, 1), endDate: new Date(selectedYear, monthIndex + 1, 0, 23, 59, 59), monthIndex, isFullYear: false }
  }, [selectedYear, selectedMonth])

  const filteredInvoices = useMemo(() => invoices.filter(inv => {
    const d = new Date(inv.invoice_date); return d >= periodRange.startDate && d <= periodRange.endDate
  }), [invoices, periodRange])

  const filteredBills = useMemo(() => bills.filter(bill => {
    const d = new Date(bill.date); return d >= periodRange.startDate && d <= periodRange.endDate
  }), [bills, periodRange])

  const filteredExpenses = useMemo(() => expenses.filter(exp => {
    const d = new Date(exp.date); return d >= periodRange.startDate && d <= periodRange.endDate
  }), [expenses, periodRange])

  const filteredTransactions = useMemo(() => transactions.filter(tx => {
    const d = new Date(tx.date); return d >= periodRange.startDate && d <= periodRange.endDate
  }), [transactions, periodRange])

  // ============ METRICS CALCULATION ============
  const metrics = useMemo(() => {
    const beginningBalance = parseFloat(companySettings?.beginning_balance) || 0
    const transactionSum = transactions.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0)
    const cashPosition = beginningBalance + transactionSum

    const openInvoices = invoices.filter(inv => (parseFloat(inv.balance_due) || 0) > 0)
    const totalAR = openInvoices.reduce((sum, inv) => sum + (parseFloat(inv.balance_due) || 0), 0)
    const overdueAR = openInvoices.filter(inv => new Date(inv.due_date) < new Date()).reduce((sum, inv) => sum + (parseFloat(inv.balance_due) || 0), 0)

    const openBills = bills.filter(bill => {
      const balance = parseFloat(bill.balance) || (parseFloat(bill.amount) - (parseFloat(bill.paid_amount) || 0))
      return balance > 0
    })
    const totalAP = openBills.reduce((sum, bill) => sum + (parseFloat(bill.balance) || (parseFloat(bill.amount) - (parseFloat(bill.paid_amount) || 0))), 0)

    const netWorkingCapital = totalAR - totalAP

    const revenue = filteredInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0)
    const directCosts = filteredBills.reduce((sum, bill) => sum + (parseFloat(bill.amount) || 0), 0)
    const overhead = filteredExpenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0)
    const grossProfit = revenue - directCosts
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0
    const netProfit = grossProfit - overhead
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0

    const prevMonthIndex = periodRange.monthIndex - 1
    const prevYear = prevMonthIndex < 0 ? selectedYear - 1 : selectedYear
    const prevMonth = prevMonthIndex < 0 ? 11 : prevMonthIndex
    const prevStart = new Date(prevYear, prevMonth, 1)
    const prevEnd = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59)
    const prevRevenue = invoices.filter(inv => { const d = new Date(inv.invoice_date); return d >= prevStart && d <= prevEnd }).reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0)
    const revenueChange = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0

    const periodInflows = filteredTransactions.filter(tx => (parseFloat(tx.amount) || 0) > 0).reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0)
    const periodOutflows = Math.abs(filteredTransactions.filter(tx => (parseFloat(tx.amount) || 0) < 0).reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0))
    const netCashFlow = periodInflows - periodOutflows

    const avgMonthlyBurn = periodRange.isFullYear
      ? (directCosts + overhead) / Math.max(new Date().getMonth() + 1, 1)
      : directCosts + overhead
    const runway = avgMonthlyBurn > 0 ? cashPosition / avgMonthlyBurn : Infinity

    const dso = metrics.revenue > 0 ? Math.round((metrics.totalAR / (metrics.revenue / (periodRange.isFullYear ? 365 : 30))) * 1) : 0
    const dpo = metrics.directCosts > 0 ? Math.round((metrics.totalAP / (metrics.directCosts / (periodRange.isFullYear ? 365 : 30))) * 1) : 0

    return {
      cashPosition, totalAR, overdueAR, totalAP, netWorkingCapital,
      revenue, directCosts, overhead, grossProfit, grossMargin, netProfit, netMargin, revenueChange,
      periodInflows, periodOutflows, netCashFlow,
      openInvoicesCount: openInvoices.length, openBillsCount: openBills.length,
      runway, avgMonthlyBurn, dso, dpo
    }
  }, [companySettings, transactions, invoices, bills, filteredInvoices, filteredBills, filteredExpenses, filteredTransactions, periodRange, selectedYear])

  // ============ CHART DATA ============
  const cashFlowTrendData = useMemo(() => {
    const data: { month: string; inflows: number; outflows: number; net: number; cumulative: number }[] = []
    const monthCount = periodRange.isFullYear ? 12 : 6
    const startMonth = periodRange.isFullYear ? 0 : periodRange.monthIndex - 5
    let cumulative = parseFloat(companySettings?.beginning_balance) || 0

    for (let i = 0; i < monthCount; i++) {
      const monthIdx = periodRange.isFullYear ? i : startMonth + i
      const d = new Date(selectedYear, monthIdx, 1)
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      const monthName = d.toLocaleString('en-US', { month: 'short' })

      const monthTx = transactions.filter(tx => { const txDate = new Date(tx.date); return txDate >= monthStart && txDate <= monthEnd })
      const inflows = monthTx.filter(tx => (parseFloat(tx.amount) || 0) > 0).reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0)
      const outflows = Math.abs(monthTx.filter(tx => (parseFloat(tx.amount) || 0) < 0).reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0))
      cumulative += (inflows - outflows)
      data.push({ month: monthName, inflows, outflows, net: inflows - outflows, cumulative })
    }
    return data
  }, [transactions, selectedYear, periodRange, companySettings])

  const revenueVsCostsData = useMemo(() => {
    const data: { month: string; revenue: number; directCosts: number; overhead: number }[] = []
    const monthCount = periodRange.isFullYear ? 12 : 6
    const startMonth = periodRange.isFullYear ? 0 : periodRange.monthIndex - 5

    for (let i = 0; i < monthCount; i++) {
      const monthIdx = periodRange.isFullYear ? i : startMonth + i
      const d = new Date(selectedYear, monthIdx, 1)
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      const monthName = d.toLocaleString('en-US', { month: 'short' })

      const monthRevenue = invoices.filter(inv => { const invDate = new Date(inv.invoice_date); return invDate >= monthStart && invDate <= monthEnd }).reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0)
      const monthDirectCosts = bills.filter(bill => { const billDate = new Date(bill.date); return billDate >= monthStart && billDate <= monthEnd }).reduce((sum, bill) => sum + (parseFloat(bill.amount) || 0), 0)
      const monthOverhead = expenses.filter(exp => { const expDate = new Date(exp.date); return expDate >= monthStart && expDate <= monthEnd }).reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0)
      data.push({ month: monthName, revenue: monthRevenue, directCosts: monthDirectCosts, overhead: monthOverhead })
    }
    return data
  }, [invoices, bills, expenses, selectedYear, periodRange])

  const revenueByProject = useMemo(() => {
    const projectRevenue: { [key: string]: number } = {}
    filteredInvoices.forEach(inv => {
      const project = projects.find(p => p.id === inv.project_id)
      const name = project?.name || 'Unassigned'
      projectRevenue[name] = (projectRevenue[name] || 0) + (parseFloat(inv.amount) || 0)
    })
    const colors = [CHART_COLORS.emerald, CHART_COLORS.blue, CHART_COLORS.amber, CHART_COLORS.gray, '#94a3b8']
    return Object.entries(projectRevenue).map(([name, value], i) => ({ name, value, color: colors[i % colors.length] })).filter(p => p.value > 0).sort((a, b) => b.value - a.value).slice(0, 5)
  }, [filteredInvoices, projects])

  const topAR = useMemo(() => {
    const clientAR: { [key: string]: { amount: number; daysOverdue: number } } = {}
    invoices.filter(inv => (parseFloat(inv.balance_due) || 0) > 0).forEach(inv => {
      const name = inv.client || 'Unknown'
      const balance = parseFloat(inv.balance_due) || 0
      const days = Math.max(0, Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24)))
      if (!clientAR[name]) clientAR[name] = { amount: 0, daysOverdue: 0 }
      clientAR[name].amount += balance
      clientAR[name].daysOverdue = Math.max(clientAR[name].daysOverdue, days)
    })
    return Object.entries(clientAR).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.amount - a.amount).slice(0, 5)
  }, [invoices])

  const topAP = useMemo(() => {
    const vendorAP: { [key: string]: { amount: number; daysOverdue: number } } = {}
    bills.filter(bill => {
      const bal = parseFloat(bill.balance) || (parseFloat(bill.amount) - (parseFloat(bill.paid_amount) || 0))
      return bal > 0
    }).forEach(bill => {
      const name = bill.vendor || bill.contractor || 'Unknown'
      const bal = parseFloat(bill.balance) || (parseFloat(bill.amount) - (parseFloat(bill.paid_amount) || 0))
      const days = Math.max(0, Math.floor((Date.now() - new Date(bill.due_date).getTime()) / (1000 * 60 * 60 * 24)))
      if (!vendorAP[name]) vendorAP[name] = { amount: 0, daysOverdue: 0 }
      vendorAP[name].amount += bal
      vendorAP[name].daysOverdue = Math.max(vendorAP[name].daysOverdue, days)
    })
    return Object.entries(vendorAP).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.amount - a.amount).slice(0, 5)
  }, [bills])

  const displayTransactions = useMemo(() => {
    let filtered = [...filteredTransactions]
    if (txFilter === 'inflows') filtered = filtered.filter(tx => (parseFloat(tx.amount) || 0) > 0)
    if (txFilter === 'outflows') filtered = filtered.filter(tx => (parseFloat(tx.amount) || 0) < 0)
    const sorted = filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return showAllTransactions ? sorted : sorted.slice(0, 8)
  }, [filteredTransactions, showAllTransactions, txFilter])

  // Handle adding new transaction
  const handleAddTransaction = async () => {
    if (!companyId || !newTransaction.description || !newTransaction.amount) return
    setSaving(true)
    try {
      const amount = newTransaction.type === 'withdrawal' ? -Math.abs(parseFloat(newTransaction.amount)) : Math.abs(parseFloat(newTransaction.amount))
      const { data, error } = await supabase.from('transactions').insert({
        company_id: companyId, description: newTransaction.description, amount, date: newTransaction.date,
        category: newTransaction.category, type: newTransaction.type, sync_source: 'manual'
      }).select().single()

      if (error) throw error
      setTransactions(prev => [data, ...prev])
      setNewTransaction({ description: '', amount: '', date: new Date().toISOString().split('T')[0], category: 'income', type: 'deposit' })
      setShowAddModal(false)
    } catch (error) {
      console.error('Error adding transaction:', error)
      alert('Failed to add transaction.')
    } finally {
      setSaving(false)
    }
  }

  // ============ LOADING ============
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

  // ============ RENDER ============
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">Cash Flow</h1>
          <p className="text-sm mt-1 text-gray-500">Cash position, working capital & profitability</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Year selector */}
          <div className="relative">
            <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className={selectClass}>
              {years.map(y => <option key={y} value={y} className="bg-white">{y}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>

          {/* Month selector */}
          <div className="relative">
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className={selectClass}>
              {months.map(m => <option key={m} value={m} className="bg-white">{m}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          </div>

          {/* QBO Sync Button (real) */}
          {companyId && (
            <QBOSyncButton companyId={companyId} syncType="bank" onSyncComplete={handleSyncComplete} />
          )}

          {/* Add Entry */}
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-500 transition-colors">
            <Plus size={14} />
            Add Entry
          </button>
        </div>
      </div>

      {/* [FIX #7] Active period display */}
      <div className="flex items-center gap-2 -mt-3">
        <span className="text-[11px] text-gray-400">
          {periodRange.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – {periodRange.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Cash Position" value={formatCurrency(metrics.cashPosition)}
          subValue={metrics.runway !== Infinity ? `~${metrics.runway.toFixed(1)} months runway` : 'Available cash'} icon={Wallet}
          accentColor={metrics.cashPosition >= 0 ? 'bg-emerald-500' : 'bg-rose-500'} />
        <MetricCard label="AR Outstanding" value={formatCurrency(metrics.totalAR)} subValue={`${metrics.openInvoicesCount} open invoices`}
          icon={FileText} href="/invoices" accentColor="bg-blue-500" />
        <MetricCard label="AP Outstanding" value={formatCurrency(metrics.totalAP)} subValue={`${metrics.openBillsCount} unpaid bills`}
          icon={Receipt} href="/invoices" accentColor="bg-amber-500" />
        <MetricCard label="Net Working Capital" value={formatCurrency(metrics.netWorkingCapital)}
          subValue={`DSO: ${metrics.dso}d · DPO: ${metrics.dpo}d`}
          trend={metrics.revenueChange} trendLabel="rev vs prior" icon={TrendingUp}
          accentColor={metrics.netWorkingCapital >= 0 ? 'bg-emerald-500' : 'bg-rose-500'} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-12 gap-4">
        {/* Cash Flow Trend */}
        <div className="col-span-12 lg:col-span-6">
          <Section title="Cash Flow Trend" subtitle={periodRange.isFullYear ? `${selectedYear} by month` : 'Inflows vs Outflows (6 months)'}>
            <div className="h-64">
              {cashFlowTrendData.some(d => d.inflows > 0 || d.outflows > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={cashFlowTrendData} margin={{ top: 10, right: 40, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART_COLORS.emerald} stopOpacity={0.08} />
                        <stop offset="95%" stopColor={CHART_COLORS.emerald} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: CHART_COLORS.axis, fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v)} />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                    <Bar yAxisId="left" dataKey="inflows" name="Inflows" fill={CHART_COLORS.emerald} radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="left" dataKey="outflows" name="Outflows" fill={CHART_COLORS.rose} radius={[4, 4, 0, 0]} />
                    <Line yAxisId="left" type="monotone" dataKey="net" name="Net" stroke={CHART_COLORS.blue} strokeWidth={2} dot={{ fill: CHART_COLORS.blue, strokeWidth: 0, r: 3 }} />
                    <Area yAxisId="right" type="monotone" dataKey="cumulative" name="Cumulative" stroke={CHART_COLORS.gray} strokeWidth={1} strokeDasharray="4 4" fill="url(#cumGrad)" dot={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">No transaction data available</div>
              )}
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: CHART_COLORS.emerald }} /><span className="text-xs text-gray-500">Inflows</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: CHART_COLORS.rose }} /><span className="text-xs text-gray-500">Outflows</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-0.5 rounded" style={{ backgroundColor: CHART_COLORS.blue }} /><span className="text-xs text-gray-500">Net</span></div>
              <div className="flex items-center gap-2"><div className="w-3 border-t border-dashed" style={{ borderColor: CHART_COLORS.gray }} /><span className="text-xs text-gray-500">Cumulative</span></div>
            </div>
          </Section>
        </div>

        {/* Revenue vs Costs */}
        <div className="col-span-12 lg:col-span-6">
          <Section title="Revenue vs Costs" subtitle={periodRange.isFullYear ? `${selectedYear} by month` : 'Monthly comparison (6 months)'}>
            <div className="h-64">
              {revenueVsCostsData.some(d => d.revenue > 0 || d.directCosts > 0) ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueVsCostsData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v)} />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                    <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS.emerald} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="directCosts" name="Direct Costs" fill={CHART_COLORS.amber} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="overhead" name="Overhead" fill={CHART_COLORS.gray} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-sm">No revenue/cost data available</div>
              )}
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: CHART_COLORS.emerald }} /><span className="text-xs text-gray-500">Revenue</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: CHART_COLORS.amber }} /><span className="text-xs text-gray-500">Direct Costs</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded" style={{ backgroundColor: CHART_COLORS.gray }} /><span className="text-xs text-gray-500">Overhead</span></div>
            </div>
          </Section>
        </div>
      </div>

      {/* P&L + Revenue by Project */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8">
          <Section title="Profit & Loss" subtitle={selectedMonth === 'Full Year' ? `${selectedYear}` : `${selectedMonth} ${selectedYear}`}>
            <div className="divide-y divide-gray-100">
              <PLRow label="Revenue" value={metrics.revenue} percentage={100} type="positive" bold />
              <PLRow label="Direct Costs (Contractors)" value={metrics.directCosts} percentage={metrics.revenue > 0 ? (metrics.directCosts / metrics.revenue) * 100 : 0} type="negative" indent />
              <div className="h-px bg-gray-200 my-1" />
              <PLRow label="Gross Profit" value={metrics.grossProfit} percentage={metrics.grossMargin} type={metrics.grossProfit >= 0 ? 'positive' : 'negative'} bold />
              <PLRow label="Overhead (Operating)" value={metrics.overhead} percentage={metrics.revenue > 0 ? (metrics.overhead / metrics.revenue) * 100 : 0} type="muted" indent />
              <div className="h-px bg-gray-200 my-1" />
              <PLRow label="Net Profit" value={metrics.netProfit} percentage={metrics.netMargin} type={metrics.netProfit >= 0 ? 'positive' : 'negative'} bold />
            </div>

            {/* Period Cash Flow Summary */}
            <div className="mt-5 pt-5 border-t border-gray-200">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">Period Cash Flow</h4>
              {/* [FIX #3] Waterfall bar */}
              {(metrics.periodInflows > 0 || metrics.periodOutflows > 0) && (() => {
                const max = Math.max(metrics.periodInflows, metrics.periodOutflows)
                const inW = max > 0 ? (metrics.periodInflows / max) * 100 : 0
                const outW = max > 0 ? (metrics.periodOutflows / max) * 100 : 0
                return (
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-gray-400 w-10">In</span>
                      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${inW}%` }} /></div>
                      <span className="text-xs font-semibold text-emerald-600 tabular-nums w-24 text-right">{formatCurrency(metrics.periodInflows)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-gray-400 w-10">Out</span>
                      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden"><div className="h-full rounded-full bg-rose-500 transition-all duration-500" style={{ width: `${outW}%` }} /></div>
                      <span className="text-xs font-semibold text-rose-600 tabular-nums w-24 text-right">{formatCurrency(metrics.periodOutflows)}</span>
                    </div>
                    <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
                      <span className="text-[10px] text-gray-400 w-10">Net</span>
                      <div className="flex-1" />
                      <span className={`text-sm font-bold tabular-nums w-24 text-right ${metrics.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(metrics.netCashFlow)}</span>
                    </div>
                  </div>
                )
              })()}
              </div>
            </div>
          </Section>
        </div>

        {/* Revenue by Project */}
        <div className="col-span-12 lg:col-span-4">
          <Section title="Revenue by Project" action={{ label: 'View All', href: '/projects' }}>
            {revenueByProject.length > 0 ? (
              <>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={revenueByProject} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                        {revenueByProject.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip formatter={(v: number) => formatCurrency(v)} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-2">
                  {revenueByProject.map((project, i) => {
                    const total = revenueByProject.reduce((s, p) => s + p.value, 0)
                    const pct = total > 0 ? (project.value / total) * 100 : 0
                    return (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
                        <span className="text-gray-600 truncate">{project.name}</span>
                        <span className="text-[10px] text-gray-400 tabular-nums shrink-0">{pct.toFixed(0)}%</span>
                      </div>
                      <span className="font-semibold text-gray-900 tabular-nums shrink-0 ml-3">{formatCurrency(project.value)}</span>
                    </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No project revenue this period</div>
            )}
          </Section>
        </div>
      </div>

      {/* AR/AP */}
      <div className="grid grid-cols-12 gap-4">
        {/* Top AR */}
        <div className="col-span-12 lg:col-span-6">
          <Section title="Accounts Receivable" subtitle="Who owes you" badge={metrics.openInvoicesCount} action={{ label: 'View All', href: '/invoices' }} noPadding>
            {topAR.length > 0 ? (
              <div>
                {/* [FIX #4] Concentration warning */}
                {topAR.length > 0 && metrics.totalAR > 0 && topAR[0].amount / metrics.totalAR > 0.5 && (
                  <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 border-b border-amber-200">
                    <AlertCircle size={13} className="text-amber-600 shrink-0" />
                    <span className="text-[11px] text-amber-700">{topAR[0].name} is {((topAR[0].amount / metrics.totalAR) * 100).toFixed(0)}% of total AR — high concentration risk</span>
                  </div>
                )}
                <div className="flex items-center px-5 py-2 bg-gray-50 border-b border-gray-200">
                  <div className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Client</div>
                  <div className="w-24 text-[11px] font-semibold uppercase tracking-wider text-right text-gray-400">Balance</div>
                  <div className="w-20 text-[11px] font-semibold uppercase tracking-wider text-right text-gray-400">Status</div>
                </div>
                {topAR.map((item, i) => (
                  <div key={i} className="flex items-center px-5 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 text-sm font-medium text-gray-600 truncate">{item.name}</div>
                    <div className="w-24 text-sm font-semibold text-right tabular-nums text-gray-900">{formatCurrency(item.amount)}</div>
                    <div className="w-20 text-right">
                      {item.daysOverdue > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide bg-rose-50 text-rose-600 border border-rose-200">{item.daysOverdue}d late</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide bg-emerald-50 text-emerald-600 border border-emerald-200">Current</span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-5 py-3 bg-gray-50">
                  <span className="text-sm font-medium text-gray-500">Total AR</span>
                  <span className="text-sm font-bold text-gray-900 tabular-nums">{formatCurrency(metrics.totalAR)}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-gray-400 text-sm">No outstanding receivables</div>
            )}
          </Section>
        </div>

        {/* Top AP */}
        <div className="col-span-12 lg:col-span-6">
          <Section title="Accounts Payable" subtitle="Who you owe" badge={metrics.openBillsCount} action={{ label: 'View All', href: '/invoices' }} noPadding>
            {topAP.length > 0 ? (
              <div>
                {/* [FIX #4] AP Concentration warning */}
                {topAP.length > 0 && metrics.totalAP > 0 && topAP[0].amount / metrics.totalAP > 0.5 && (
                  <div className="flex items-center gap-2 px-5 py-2.5 bg-amber-50 border-b border-amber-200">
                    <AlertCircle size={13} className="text-amber-600 shrink-0" />
                    <span className="text-[11px] text-amber-700">{topAP[0].name} is {((topAP[0].amount / metrics.totalAP) * 100).toFixed(0)}% of total AP — vendor concentration risk</span>
                  </div>
                )}
                <div className="flex items-center px-5 py-2 bg-gray-50 border-b border-gray-200">
                  <div className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Vendor</div>
                  <div className="w-24 text-[11px] font-semibold uppercase tracking-wider text-right text-gray-400">Balance</div>
                  <div className="w-20 text-[11px] font-semibold uppercase tracking-wider text-right text-gray-400">Status</div>
                </div>
                {topAP.map((item, i) => (
                  <div key={i} className="flex items-center px-5 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 text-sm font-medium text-gray-600 truncate">{item.name}</div>
                    <div className="w-24 text-sm font-semibold text-right tabular-nums text-amber-600">{formatCurrency(item.amount)}</div>
                    <div className="w-20 text-right">
                      {item.daysOverdue > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide bg-rose-50 text-rose-600 border border-rose-200">{item.daysOverdue}d late</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-500 border border-gray-200">Current</span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-5 py-3 bg-gray-50">
                  <span className="text-sm font-medium text-gray-500">Total AP</span>
                  <span className="text-sm font-bold text-amber-600 tabular-nums">{formatCurrency(metrics.totalAP)}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12 text-gray-400 text-sm">No outstanding payables</div>
            )}
          </Section>
        </div>
      </div>

      {/* Transactions */}
      <Section title="Recent Transactions" subtitle={`${filteredTransactions.length} this period`} collapsible defaultExpanded badge={filteredTransactions.length} noPadding>
        <div>
          {/* [FIX #8] Filter chips */}
          <div className="flex items-center gap-2 px-5 py-2.5 border-b border-gray-200">
            {(['all', 'inflows', 'outflows'] as const).map(f => (
              <button key={f} onClick={() => setTxFilter(f)}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                  txFilter === f ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                {f === 'all' ? 'All' : f === 'inflows' ? 'Inflows' : 'Outflows'}
              </button>
            ))}
          </div>
          <div className="flex items-center px-5 py-2 bg-gray-50 border-b border-gray-200">
            <div className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Description</div>
            <div className="w-28 text-[11px] font-semibold uppercase tracking-wider text-gray-400 hidden sm:block">Category</div>
            <div className="w-24 text-[11px] font-semibold uppercase tracking-wider text-gray-400 hidden sm:block">Date</div>
            <div className="w-28 text-[11px] font-semibold uppercase tracking-wider text-right text-gray-400">Amount</div>
          </div>

          {displayTransactions.length > 0 ? (
            <>
              {displayTransactions.map((tx, i) => (
                <div key={i} className="flex items-center px-5 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-600 truncate">{tx.description || tx.name || 'Transaction'}</p>
                    <p className="text-xs text-gray-400 sm:hidden">{formatDate(tx.date)}</p>
                  </div>
                  <div className="w-28 hidden sm:block">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-500 border border-gray-200">
                      {tx.category || tx.type || 'Other'}
                    </span>
                  </div>
                  <div className="w-24 text-sm text-gray-500 hidden sm:block">{formatDate(tx.date)}</div>
                  <div className={`w-28 text-sm font-semibold text-right tabular-nums ${(parseFloat(tx.amount) || 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {formatCurrency(parseFloat(tx.amount) || 0)}
                  </div>
                </div>
              ))}

              {filteredTransactions.length > 8 && (
                <button onClick={() => setShowAllTransactions(!showAllTransactions)}
                  className="w-full px-5 py-3 text-sm font-medium text-gray-500 hover:text-emerald-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1">
                  {showAllTransactions ? <>Show Less <ChevronUp size={14} /></> : <>Show All {filteredTransactions.length} Transactions <ChevronDown size={14} /></>}
                </button>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">No transactions this period</div>
          )}
        </div>
      </Section>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Add Transaction</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-4">
              {/* Type Toggle */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Type</label>
                <div className="flex bg-gray-50 border border-gray-200 rounded-lg p-1">
                  <button type="button" onClick={() => setNewTransaction(prev => ({ ...prev, type: 'deposit' }))}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${newTransaction.type === 'deposit' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                    Income / Deposit
                  </button>
                  <button type="button" onClick={() => setNewTransaction(prev => ({ ...prev, type: 'withdrawal' }))}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${newTransaction.type === 'withdrawal' ? 'bg-rose-600 text-white' : 'text-gray-500 hover:text-gray-900'}`}>
                    Expense / Withdrawal
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Description</label>
                <input type="text" value={newTransaction.description} onChange={(e) => setNewTransaction(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="e.g., Client payment, Office supplies" className={inputClass} />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Amount</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span>
                  <input type="number" value={newTransaction.amount} onChange={(e) => setNewTransaction(prev => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00" min="0" step="0.01" className={`${inputClass} pl-7`} />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Date</label>
                <input type="date" value={newTransaction.date} onChange={(e) => setNewTransaction(prev => ({ ...prev, date: e.target.value }))} className={inputClass} />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Category</label>
                <select value={newTransaction.category} onChange={(e) => setNewTransaction(prev => ({ ...prev, category: e.target.value }))} className={selectClass + ' w-full'}>
                  <option value="income" className="bg-white">Income</option>
                  <option value="expense" className="bg-white">Expense</option>
                  <option value="payroll" className="bg-white">Payroll</option>
                  <option value="transfer" className="bg-white">Transfer</option>
                  <option value="refund" className="bg-white">Refund</option>
                  <option value="other" className="bg-white">Other</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
              <button onClick={handleAddTransaction} disabled={saving || !newTransaction.description || !newTransaction.amount}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {saving ? <><RefreshCw size={14} className="animate-spin" />Saving...</> : <><Plus size={14} />Add Transaction</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
