'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { 
  FileText, Download, Filter, Calendar, ChevronRight, ChevronDown, ChevronUp,
  DollarSign, TrendingUp, TrendingDown, Users, Clock, Briefcase, PieChart,
  BarChart3, Table2, Eye, Printer, Mail, Save, Plus, X, Search,
  Building2, FolderOpen, Receipt, AlertTriangle, CheckCircle2, ArrowUpRight,
  ArrowDownRight, Layers, LayoutGrid, GripVertical
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/supabase'

// Supabase client
const supabase = createClient(
  'https://jmahfgpbtjeomuepfozf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYWhmZ3BidGplb211ZXBmb3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0OTAxNzcsImV4cCI6MjA4MTA2NjE3N30.3SVDvWCGIYYHV57BpKjpDJVCZLKzuRv8B_VietQDxUQ'
)

// ============ DESIGN SYSTEM ============
const COLORS = {
  primary: '#10b981', // Changed to emerald
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
}

// ============ GLASSMORPHISM THEME ============
const THEME = {
  glass: 'bg-slate-900/70 backdrop-blur-xl',
  glassBorder: 'border-white/[0.08]',
  glassHover: 'hover:bg-white/[0.05]',
  textPrimary: 'text-white',
  textSecondary: 'text-slate-300',
  textMuted: 'text-slate-400',
}

// ============ UTILITY FUNCTIONS ============
const formatCurrency = (value: number): string => {
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
  return `${value.toFixed(1)}%`
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  })
}

// Date range helpers
const getDateRange = (preset: string): { start: Date; end: Date } => {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  let start = new Date()
  
  switch (preset) {
    case 'this_week':
      start = new Date(now)
      start.setDate(now.getDate() - now.getDay())
      break
    case 'last_week':
      start = new Date(now)
      start.setDate(now.getDate() - now.getDay() - 7)
      end.setDate(now.getDate() - now.getDay() - 1)
      break
    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      break
    case 'last_month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      end.setDate(0) // Last day of previous month
      break
    case 'this_quarter':
      const quarter = Math.floor(now.getMonth() / 3)
      start = new Date(now.getFullYear(), quarter * 3, 1)
      break
    case 'last_quarter':
      const lastQuarter = Math.floor(now.getMonth() / 3) - 1
      const lqYear = lastQuarter < 0 ? now.getFullYear() - 1 : now.getFullYear()
      const lqMonth = lastQuarter < 0 ? 9 : lastQuarter * 3
      start = new Date(lqYear, lqMonth, 1)
      end.setMonth(lqMonth + 3)
      end.setDate(0)
      break
    case 'ytd':
      start = new Date(now.getFullYear(), 0, 1)
      break
    case 'last_year':
      start = new Date(now.getFullYear() - 1, 0, 1)
      end.setFullYear(now.getFullYear() - 1, 11, 31)
      break
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1)
  }
  
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

// ============ REPORT DEFINITIONS ============
interface ReportDefinition {
  id: string
  name: string
  description: string
  category: string
  icon: any
  color: string
}

const REPORT_CATEGORIES = [
  { id: 'financial', name: 'Financial Statements', icon: FileText },
  { id: 'expense', name: 'Expense Analysis', icon: TrendingDown },
  { id: 'revenue', name: 'Revenue', icon: TrendingUp },
  { id: 'ar', name: 'AR & Collections', icon: Receipt },
  { id: 'client', name: 'Client Profitability', icon: Building2 },
  { id: 'project', name: 'Project Reports', icon: FolderOpen },
  { id: 'utilization', name: 'Team Utilization', icon: Users },
  { id: 'labor', name: 'Labor Cost', icon: Clock },
]

const REPORTS: ReportDefinition[] = [
  // Financial Statements
  { id: 'pnl_cash', name: 'P&L (Cash Basis)', description: 'Profit & Loss based on actual cash received/paid', category: 'financial', icon: FileText, color: COLORS.primary },
  { id: 'pnl_accrual', name: 'P&L (Accrual Basis)', description: 'Profit & Loss based on invoiced/billed amounts', category: 'financial', icon: FileText, color: COLORS.primary },
  { id: 'cash_flow', name: 'Cash Flow Statement', description: 'Cash inflows and outflows by period', category: 'financial', icon: DollarSign, color: COLORS.success },
  
  // Expense Analysis
  { id: 'category_spending', name: 'Category Spending', description: 'Spending breakdown by category (Software, Rent, etc.)', category: 'expense', icon: PieChart, color: COLORS.danger },
  { id: 'expense_trend', name: 'Expense Trend', description: 'Month-over-month expense comparison', category: 'expense', icon: TrendingDown, color: COLORS.danger },
  { id: 'budget_vs_actual', name: 'Budget vs Actual', description: 'Compare actual spending against budget', category: 'expense', icon: BarChart3, color: COLORS.warning },
  
  // Revenue
  { id: 'revenue_by_client', name: 'Revenue by Client', description: 'Total revenue breakdown by client', category: 'revenue', icon: Building2, color: COLORS.success },
  { id: 'revenue_by_project', name: 'Revenue by Project', description: 'Revenue breakdown by project', category: 'revenue', icon: FolderOpen, color: COLORS.success },
  { id: 'revenue_trend', name: 'Revenue Trend', description: 'Monthly revenue over time', category: 'revenue', icon: TrendingUp, color: COLORS.success },
  
  // AR & Collections
  { id: 'ar_aging_summary', name: 'AR Aging Summary', description: 'Receivables by aging bucket (Current, 30, 60, 90+)', category: 'ar', icon: Receipt, color: COLORS.warning },
  { id: 'ar_aging_detail', name: 'AR Aging Detail', description: 'Detailed aging by client and invoice', category: 'ar', icon: Table2, color: COLORS.warning },
  { id: 'dso_trend', name: 'DSO Trend', description: 'Days Sales Outstanding over time', category: 'ar', icon: Clock, color: COLORS.warning },
  { id: 'payment_history', name: 'Client Payment History', description: 'Payment patterns by client', category: 'ar', icon: CheckCircle2, color: COLORS.success },
  
  // Client Profitability
  { id: 'client_profitability', name: 'Client Profitability', description: 'Revenue minus cost per client', category: 'client', icon: DollarSign, color: COLORS.purple },
  { id: 'client_ranking', name: 'Client Ranking', description: 'Clients ranked by margin %', category: 'client', icon: BarChart3, color: COLORS.purple },
  { id: 'client_ltv', name: 'Client Lifetime Value', description: 'Historical value per client', category: 'client', icon: TrendingUp, color: COLORS.purple },
  
  // Project Reports
  { id: 'project_profitability', name: 'Project Profitability', description: 'Margin analysis by project', category: 'project', icon: FolderOpen, color: COLORS.cyan },
  { id: 'project_budget_actual', name: 'Project Budget vs Actual', description: 'Budget utilization by project', category: 'project', icon: BarChart3, color: COLORS.cyan },
  { id: 'project_hours', name: 'Project Hours Summary', description: 'Hours logged by project', category: 'project', icon: Clock, color: COLORS.cyan },
  
  // Team Utilization
  { id: 'utilization_summary', name: 'Utilization Summary', description: 'Team utilization % overview', category: 'utilization', icon: Users, color: COLORS.primary },
  { id: 'utilization_detail', name: 'Utilization by Team Member', description: 'Individual utilization rates', category: 'utilization', icon: Table2, color: COLORS.primary },
  { id: 'realization_rate', name: 'Realization Rate', description: 'Invoiced vs potential revenue', category: 'utilization', icon: DollarSign, color: COLORS.primary },
  { id: 'billable_nonbillable', name: 'Billable vs Non-Billable', description: 'Hours split by billability', category: 'utilization', icon: PieChart, color: COLORS.primary },
  
  // Labor Cost
  { id: 'labor_cost_summary', name: 'Labor Cost Summary', description: 'Total labor costs overview', category: 'labor', icon: DollarSign, color: COLORS.danger },
  { id: 'labor_by_member', name: 'Labor Cost by Team Member', description: 'Cost breakdown by person', category: 'labor', icon: Users, color: COLORS.danger },
  { id: 'labor_by_project', name: 'Labor Cost by Project', description: 'Labor allocated to each project', category: 'labor', icon: FolderOpen, color: COLORS.danger },
  { id: 'labor_by_client', name: 'Labor Cost by Client', description: 'Labor cost per client', category: 'labor', icon: Building2, color: COLORS.danger },
]

// ============ COMPONENTS ============

// Date Range Picker
function DateRangePicker({ 
  value, 
  onChange,
  customStart,
  customEnd,
  onCustomChange
}: { 
  value: string
  onChange: (v: string) => void
  customStart?: string
  customEnd?: string
  onCustomChange?: (start: string, end: string) => void
}) {
  const [showCustom, setShowCustom] = useState(value === 'custom')
  
  const presets = [
    { id: 'this_week', label: 'This Week' },
    { id: 'last_week', label: 'Last Week' },
    { id: 'this_month', label: 'This Month' },
    { id: 'last_month', label: 'Last Month' },
    { id: 'this_quarter', label: 'This Quarter' },
    { id: 'last_quarter', label: 'Last Quarter' },
    { id: 'ytd', label: 'Year to Date' },
    { id: 'last_year', label: 'Last Year' },
    { id: 'custom', label: 'Custom Range' },
  ]
  
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setShowCustom(e.target.value === 'custom')
        }}
        className="bg-slate-900/70 backdrop-blur-xl border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-emerald-500/30 focus:border-transparent"
      >
        {presets.map(p => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
      
      {showCustom && onCustomChange && (
        <>
          <input
            type="date"
            value={customStart || ''}
            onChange={(e) => onCustomChange(e.target.value, customEnd || '')}
            className="bg-slate-900/70 backdrop-blur-xl border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-emerald-500/30"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={customEnd || ''}
            onChange={(e) => onCustomChange(customStart || '', e.target.value)}
            className="bg-slate-900/70 backdrop-blur-xl border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-emerald-500/30"
          />
        </>
      )}
    </div>
  )
}

// Report Card
function ReportCard({ 
  report, 
  onClick 
}: { 
  report: ReportDefinition
  onClick: () => void
}) {
  const Icon = report.icon
  
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl border border-white/[0.08] bg-slate-900/70 backdrop-blur-xl hover:bg-white/[0.08] hover:border-white/[0.12] transition-all group"
    >
      <div className="flex items-start gap-3">
        <div 
          className="p-2.5 rounded-lg"
          style={{ backgroundColor: `${report.color}20` }}
        >
          <Icon size={20} style={{ color: report.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white group-hover:text-white">{report.name}</h3>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{report.description}</p>
        </div>
        <ChevronRight size={18} className="text-slate-600 group-hover:text-slate-400 mt-1" />
      </div>
    </button>
  )
}

// Section Header
function SectionHeader({ 
  title, 
  icon: Icon,
  count,
  expanded,
  onToggle
}: { 
  title: string
  icon: any
  count: number
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-white/[0.03] hover:bg-slate-900/70 backdrop-blur-xl transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon size={18} className="text-slate-400" />
        <span className="font-medium text-slate-200">{title}</span>
        <span className="text-xs text-slate-500 bg-white/[0.05] px-2 py-0.5 rounded-full">{count}</span>
      </div>
      {expanded ? (
        <ChevronUp size={18} className="text-slate-400" />
      ) : (
        <ChevronDown size={18} className="text-slate-400" />
      )}
    </button>
  )
}

// ============ REPORT VIEWER COMPONENTS ============

// AR Aging Report
function ARAgingReport({ 
  invoices, 
  clients,
  dateRange 
}: { 
  invoices: any[]
  clients: any[]
  dateRange: { start: Date; end: Date }
}) {
  const clientMap = useMemo(() => {
    const map: { [key: string]: string } = {}
    clients.forEach(c => { map[c.id] = c.name })
    return map
  }, [clients])

  const agingData = useMemo(() => {
    const buckets = {
      current: { label: 'Current', min: -999, max: 0, amount: 0, count: 0, invoices: [] as any[] },
      days30: { label: '1-30 Days', min: 1, max: 30, amount: 0, count: 0, invoices: [] as any[] },
      days60: { label: '31-60 Days', min: 31, max: 60, amount: 0, count: 0, invoices: [] as any[] },
      days90: { label: '61-90 Days', min: 61, max: 90, amount: 0, count: 0, invoices: [] as any[] },
      over90: { label: '90+ Days', min: 91, max: 9999, amount: 0, count: 0, invoices: [] as any[] },
    }

    invoices
      .filter(inv => (inv.balance_due || 0) > 0)
      .forEach(inv => {
        const daysOverdue = inv.days_overdue || 0
        const balance = inv.balance_due || 0
        
        for (const [key, bucket] of Object.entries(buckets)) {
          if (daysOverdue >= bucket.min && daysOverdue <= bucket.max) {
            bucket.amount += balance
            bucket.count++
            bucket.invoices.push({
              ...inv,
              client_name: clientMap[inv.client_id] || 'Unknown'
            })
            break
          }
        }
      })

    return buckets
  }, [invoices, clientMap])

  const totalAR = Object.values(agingData).reduce((sum, b) => sum + b.amount, 0)

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        {Object.entries(agingData).map(([key, bucket]) => (
          <div key={key} className="p-4 rounded-xl border border-white/[0.08] bg-slate-900/70 backdrop-blur-xl">
            <p className="text-xs font-medium text-slate-400">{bucket.label}</p>
            <p className="text-xl font-bold text-white mt-1">{formatCurrency(bucket.amount)}</p>
            <p className="text-xs text-slate-500 mt-1">{bucket.count} invoices</p>
            <div className="mt-2 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full"
                style={{ 
                  width: `${totalAR > 0 ? (bucket.amount / totalAR) * 100 : 0}%`,
                  backgroundColor: key === 'current' ? COLORS.success : 
                    key === 'days30' ? COLORS.warning :
                    key === 'days60' ? '#f97316' :
                    COLORS.danger
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Detail Table */}
      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
        <div className="bg-slate-900/70 backdrop-blur-xl px-4 py-3 border-b border-white/[0.08]">
          <h3 className="font-medium text-slate-200">Aging Detail by Client</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.03]">
                <th className="text-left px-4 py-3 font-medium text-slate-400">Client</th>
                <th className="text-right px-4 py-3 font-medium text-slate-400">Current</th>
                <th className="text-right px-4 py-3 font-medium text-slate-400">1-30</th>
                <th className="text-right px-4 py-3 font-medium text-slate-400">31-60</th>
                <th className="text-right px-4 py-3 font-medium text-slate-400">61-90</th>
                <th className="text-right px-4 py-3 font-medium text-slate-400">90+</th>
                <th className="text-right px-4 py-3 font-medium text-slate-400">Total</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Group by client
                const byClient: { [key: string]: { name: string; current: number; days30: number; days60: number; days90: number; over90: number; total: number } } = {}
                
                Object.values(agingData).forEach(bucket => {
                  bucket.invoices.forEach(inv => {
                    if (!byClient[inv.client_id]) {
                      byClient[inv.client_id] = { 
                        name: inv.client_name, 
                        current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 
                      }
                    }
                    const days = inv.days_overdue || 0
                    const amount = inv.balance_due || 0
                    byClient[inv.client_id].total += amount
                    if (days <= 0) byClient[inv.client_id].current += amount
                    else if (days <= 30) byClient[inv.client_id].days30 += amount
                    else if (days <= 60) byClient[inv.client_id].days60 += amount
                    else if (days <= 90) byClient[inv.client_id].days90 += amount
                    else byClient[inv.client_id].over90 += amount
                  })
                })

                return Object.values(byClient)
                  .sort((a, b) => b.total - a.total)
                  .map((row, i) => (
                    <tr key={i} className="border-t border-white/[0.08]/50 hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-medium text-slate-200">{row.name}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{row.current > 0 ? formatCurrency(row.current) : '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{row.days30 > 0 ? formatCurrency(row.days30) : '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{row.days60 > 0 ? formatCurrency(row.days60) : '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-300">{row.days90 > 0 ? formatCurrency(row.days90) : '—'}</td>
                      <td className="px-4 py-3 text-right text-rose-400">{row.over90 > 0 ? formatCurrency(row.over90) : '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-white">{formatCurrency(row.total)}</td>
                    </tr>
                  ))
              })()}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-white/[0.12] bg-slate-900/70 backdrop-blur-xl">
                <td className="px-4 py-3 font-semibold text-white">Total</td>
                <td className="px-4 py-3 text-right font-semibold text-white">{formatCurrency(agingData.current.amount)}</td>
                <td className="px-4 py-3 text-right font-semibold text-white">{formatCurrency(agingData.days30.amount)}</td>
                <td className="px-4 py-3 text-right font-semibold text-white">{formatCurrency(agingData.days60.amount)}</td>
                <td className="px-4 py-3 text-right font-semibold text-white">{formatCurrency(agingData.days90.amount)}</td>
                <td className="px-4 py-3 text-right font-semibold text-rose-400">{formatCurrency(agingData.over90.amount)}</td>
                <td className="px-4 py-3 text-right font-bold text-white">{formatCurrency(totalAR)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

// Category Spending Report
function CategorySpendingReport({ 
  transactions, 
  dateRange 
}: { 
  transactions: any[]
  dateRange: { start: Date; end: Date }
}) {
  const categoryData = useMemo(() => {
    const categories: { [key: string]: { amount: number; count: number; transactions: any[] } } = {}
    
    transactions
      .filter(t => {
        const txDate = new Date(t.date)
        return txDate >= dateRange.start && txDate <= dateRange.end && t.amount < 0
      })
      .forEach(t => {
        const cat = t.category || 'Uncategorized'
        if (!categories[cat]) {
          categories[cat] = { amount: 0, count: 0, transactions: [] }
        }
        categories[cat].amount += Math.abs(t.amount || 0)
        categories[cat].count++
        categories[cat].transactions.push(t)
      })

    return Object.entries(categories)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.amount - a.amount)
  }, [transactions, dateRange])

  const totalSpending = categoryData.reduce((sum, c) => sum + c.amount, 0)

  // Monthly breakdown
  const monthlyData = useMemo(() => {
    const months: { [key: string]: { [cat: string]: number } } = {}
    
    transactions
      .filter(t => {
        const txDate = new Date(t.date)
        return txDate >= dateRange.start && txDate <= dateRange.end && t.amount < 0
      })
      .forEach(t => {
        const month = t.date?.substring(0, 7)
        const cat = t.category || 'Uncategorized'
        if (!months[month]) months[month] = {}
        if (!months[month][cat]) months[month][cat] = 0
        months[month][cat] += Math.abs(t.amount || 0)
      })

    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, cats]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        ...cats
      }))
  }, [transactions, dateRange])

  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="p-4 rounded-xl border border-white/[0.08] bg-slate-900/70 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">Total Spending</p>
            <p className="text-3xl font-bold text-white">{formatCurrency(totalSpending)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">Categories</p>
            <p className="text-3xl font-bold text-white">{categoryData.length}</p>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
        <div className="bg-slate-900/70 backdrop-blur-xl px-4 py-3 border-b border-white/[0.08]">
          <h3 className="font-medium text-slate-200">Spending by Category</h3>
        </div>
        <div className="divide-y divide-slate-700/50">
          {categoryData.map((cat) => (
            <div key={cat.name}>
              <button
                onClick={() => setExpandedCategory(expandedCategory === cat.name ? null : cat.name)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedCategory === cat.name ? (
                    <ChevronDown size={16} className="text-slate-400" />
                  ) : (
                    <ChevronRight size={16} className="text-slate-400" />
                  )}
                  <span className="font-medium text-slate-200 capitalize">{cat.name}</span>
                  <span className="text-xs text-slate-500">{cat.count} transactions</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-2 bg-white/[0.05] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${(cat.amount / totalSpending) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-slate-400 w-12 text-right">
                    {((cat.amount / totalSpending) * 100).toFixed(0)}%
                  </span>
                  <span className="font-semibold text-white w-24 text-right">
                    {formatCurrency(cat.amount)}
                  </span>
                </div>
              </button>
              
              {expandedCategory === cat.name && (
                <div className="bg-slate-900/50 px-4 py-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-500">
                        <th className="py-2 font-medium">Date</th>
                        <th className="py-2 font-medium">Description</th>
                        <th className="py-2 font-medium text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cat.transactions.slice(0, 10).map((t: any, i: number) => (
                        <tr key={i} className="border-t border-slate-800">
                          <td className="py-2 text-slate-400">{formatDate(t.date)}</td>
                          <td className="py-2 text-slate-300">{t.description || '—'}</td>
                          <td className="py-2 text-right text-rose-400">{formatCurrency(Math.abs(t.amount))}</td>
                        </tr>
                      ))}
                      {cat.transactions.length > 10 && (
                        <tr>
                          <td colSpan={3} className="py-2 text-center text-slate-500 text-xs">
                            + {cat.transactions.length - 10} more transactions
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Utilization Report
function UtilizationReport({ 
  timeEntries, 
  teamMembers,
  dateRange 
}: { 
  timeEntries: any[]
  teamMembers: any[]
  dateRange: { start: Date; end: Date }
}) {
  const utilizationData = useMemo(() => {
    // Calculate working days in range
    const days = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
    const workingDays = Math.floor(days * 5 / 7) // Rough estimate
    const availableHoursPerPerson = workingDays * 8

    const memberData: { [key: string]: { name: string; billableHours: number; nonBillableHours: number; totalHours: number; billableAmount: number } } = {}

    timeEntries
      .filter(t => {
        const txDate = new Date(t.date)
        return txDate >= dateRange.start && txDate <= dateRange.end
      })
      .forEach(t => {
        const member = teamMembers.find(m => m.id === t.contractor_id)
        const memberId = t.contractor_id || 'unknown'
        const memberName = member?.name || 'Unknown'
        
        if (!memberData[memberId]) {
          memberData[memberId] = { 
            name: memberName, 
            billableHours: 0, 
            nonBillableHours: 0, 
            totalHours: 0,
            billableAmount: 0
          }
        }
        
        const hours = t.hours || 0
        const isBillable = t.billable !== false
        
        memberData[memberId].totalHours += hours
        if (isBillable) {
          memberData[memberId].billableHours += hours
          memberData[memberId].billableAmount += hours * (t.bill_rate || 0)
        } else {
          memberData[memberId].nonBillableHours += hours
        }
      })

    return {
      availableHoursPerPerson,
      members: Object.values(memberData).map(m => ({
        ...m,
        utilization: availableHoursPerPerson > 0 ? (m.totalHours / availableHoursPerPerson) * 100 : 0,
        billableUtilization: availableHoursPerPerson > 0 ? (m.billableHours / availableHoursPerPerson) * 100 : 0,
      })).sort((a, b) => b.billableUtilization - a.billableUtilization)
    }
  }, [timeEntries, teamMembers, dateRange])

  const totals = useMemo(() => {
    const totalBillable = utilizationData.members.reduce((sum, m) => sum + m.billableHours, 0)
    const totalNonBillable = utilizationData.members.reduce((sum, m) => sum + m.nonBillableHours, 0)
    const totalHours = utilizationData.members.reduce((sum, m) => sum + m.totalHours, 0)
    const totalAmount = utilizationData.members.reduce((sum, m) => sum + m.billableAmount, 0)
    const totalAvailable = utilizationData.availableHoursPerPerson * utilizationData.members.length
    
    return {
      billableHours: totalBillable,
      nonBillableHours: totalNonBillable,
      totalHours,
      billableAmount: totalAmount,
      avgUtilization: totalAvailable > 0 ? (totalHours / totalAvailable) * 100 : 0,
      avgBillableUtilization: totalAvailable > 0 ? (totalBillable / totalAvailable) * 100 : 0,
    }
  }, [utilizationData])

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-white/[0.08] bg-slate-900/70 backdrop-blur-xl">
          <p className="text-xs font-medium text-slate-400">Billable Utilization</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{formatPercent(totals.avgBillableUtilization)}</p>
          <p className="text-xs text-slate-500 mt-1">{formatNumber(totals.billableHours)} billable hours</p>
        </div>
        <div className="p-4 rounded-xl border border-white/[0.08] bg-slate-900/70 backdrop-blur-xl">
          <p className="text-xs font-medium text-slate-400">Total Utilization</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{formatPercent(totals.avgUtilization)}</p>
          <p className="text-xs text-slate-500 mt-1">{formatNumber(totals.totalHours)} total hours</p>
        </div>
        <div className="p-4 rounded-xl border border-white/[0.08] bg-slate-900/70 backdrop-blur-xl">
          <p className="text-xs font-medium text-slate-400">Billable Value</p>
          <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totals.billableAmount)}</p>
          <p className="text-xs text-slate-500 mt-1">At current rates</p>
        </div>
        <div className="p-4 rounded-xl border border-white/[0.08] bg-slate-900/70 backdrop-blur-xl">
          <p className="text-xs font-medium text-slate-400">Non-Billable Hours</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{formatNumber(totals.nonBillableHours)}</p>
          <p className="text-xs text-slate-500 mt-1">{formatPercent(totals.totalHours > 0 ? (totals.nonBillableHours / totals.totalHours) * 100 : 0)} of total</p>
        </div>
      </div>

      {/* Detail Table */}
      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
        <div className="bg-slate-900/70 backdrop-blur-xl px-4 py-3 border-b border-white/[0.08]">
          <h3 className="font-medium text-slate-200">Utilization by Team Member</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/[0.03]">
              <th className="text-left px-4 py-3 font-medium text-slate-400">Team Member</th>
              <th className="text-right px-4 py-3 font-medium text-slate-400">Billable Hrs</th>
              <th className="text-right px-4 py-3 font-medium text-slate-400">Non-Billable</th>
              <th className="text-right px-4 py-3 font-medium text-slate-400">Total Hrs</th>
              <th className="text-right px-4 py-3 font-medium text-slate-400">Available</th>
              <th className="text-center px-4 py-3 font-medium text-slate-400">Billable Util.</th>
              <th className="text-right px-4 py-3 font-medium text-slate-400">Value</th>
            </tr>
          </thead>
          <tbody>
            {utilizationData.members.map((member, i) => (
              <tr key={i} className="border-t border-white/[0.08]/50 hover:bg-white/[0.03]">
                <td className="px-4 py-3 font-medium text-slate-200">{member.name}</td>
                <td className="px-4 py-3 text-right text-emerald-400">{formatNumber(member.billableHours)}</td>
                <td className="px-4 py-3 text-right text-amber-400">{formatNumber(member.nonBillableHours)}</td>
                <td className="px-4 py-3 text-right text-slate-300">{formatNumber(member.totalHours)}</td>
                <td className="px-4 py-3 text-right text-slate-500">{formatNumber(utilizationData.availableHoursPerPerson)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-20 h-2 bg-white/[0.05] rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full"
                        style={{ 
                          width: `${Math.min(member.billableUtilization, 100)}%`,
                          backgroundColor: member.billableUtilization >= 70 ? COLORS.success : 
                            member.billableUtilization >= 50 ? COLORS.warning : COLORS.danger
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium" style={{
                      color: member.billableUtilization >= 70 ? COLORS.success : 
                        member.billableUtilization >= 50 ? COLORS.warning : COLORS.danger
                    }}>
                      {formatPercent(member.billableUtilization)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-medium text-white">{formatCurrency(member.billableAmount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-white/[0.12] bg-slate-900/70 backdrop-blur-xl">
              <td className="px-4 py-3 font-semibold text-white">Total / Average</td>
              <td className="px-4 py-3 text-right font-semibold text-emerald-400">{formatNumber(totals.billableHours)}</td>
              <td className="px-4 py-3 text-right font-semibold text-amber-400">{formatNumber(totals.nonBillableHours)}</td>
              <td className="px-4 py-3 text-right font-semibold text-white">{formatNumber(totals.totalHours)}</td>
              <td className="px-4 py-3 text-right text-slate-500">—</td>
              <td className="px-4 py-3 text-center font-semibold text-emerald-400">{formatPercent(totals.avgBillableUtilization)}</td>
              <td className="px-4 py-3 text-right font-bold text-white">{formatCurrency(totals.billableAmount)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// Client Profitability Report
function ClientProfitabilityReport({ 
  invoices, 
  timeEntries,
  clients,
  projects,
  dateRange 
}: { 
  invoices: any[]
  timeEntries: any[]
  clients: any[]
  projects: any[]
  dateRange: { start: Date; end: Date }
}) {
  const profitabilityData = useMemo(() => {
    const clientData: { [key: string]: { 
      name: string
      revenue: number
      laborCost: number
      hours: number
      invoiceCount: number
    }} = {}

    // Initialize clients
    clients.forEach(c => {
      clientData[c.id] = { name: c.name, revenue: 0, laborCost: 0, hours: 0, invoiceCount: 0 }
    })

    // Add revenue from invoices
    invoices
      .filter(inv => {
        const invDate = new Date(inv.invoice_date)
        return invDate >= dateRange.start && invDate <= dateRange.end
      })
      .forEach(inv => {
        if (clientData[inv.client_id]) {
          clientData[inv.client_id].revenue += inv.total_amount || 0
          clientData[inv.client_id].invoiceCount++
        }
      })

    // Add labor cost from time entries
    // First map projects to clients
    const projectClientMap: { [key: string]: string } = {}
    projects.forEach(p => { projectClientMap[p.id] = p.client_id })

    timeEntries
      .filter(t => {
        const txDate = new Date(t.date)
        return txDate >= dateRange.start && txDate <= dateRange.end
      })
      .forEach(t => {
        const clientId = projectClientMap[t.project_id]
        if (clientId && clientData[clientId]) {
          const hours = t.hours || 0
          // Assume labor cost is 40% of bill rate (or use cost_rate if available)
          const costRate = t.cost_rate || (t.bill_rate || 0) * 0.4
          clientData[clientId].laborCost += hours * costRate
          clientData[clientId].hours += hours
        }
      })

    return Object.values(clientData)
      .filter(c => c.revenue > 0 || c.hours > 0)
      .map(c => ({
        ...c,
        grossProfit: c.revenue - c.laborCost,
        margin: c.revenue > 0 ? ((c.revenue - c.laborCost) / c.revenue) * 100 : 0,
        effectiveRate: c.hours > 0 ? c.revenue / c.hours : 0,
      }))
      .sort((a, b) => b.grossProfit - a.grossProfit)
  }, [invoices, timeEntries, clients, projects, dateRange])

  const totals = useMemo(() => {
    const revenue = profitabilityData.reduce((sum, c) => sum + c.revenue, 0)
    const laborCost = profitabilityData.reduce((sum, c) => sum + c.laborCost, 0)
    const hours = profitabilityData.reduce((sum, c) => sum + c.hours, 0)
    return {
      revenue,
      laborCost,
      hours,
      grossProfit: revenue - laborCost,
      margin: revenue > 0 ? ((revenue - laborCost) / revenue) * 100 : 0,
    }
  }, [profitabilityData])

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-white/[0.08] bg-slate-900/70 backdrop-blur-xl">
          <p className="text-xs font-medium text-slate-400">Total Revenue</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{formatCurrency(totals.revenue)}</p>
        </div>
        <div className="p-4 rounded-xl border border-white/[0.08] bg-slate-900/70 backdrop-blur-xl">
          <p className="text-xs font-medium text-slate-400">Total Labor Cost</p>
          <p className="text-2xl font-bold text-rose-400 mt-1">{formatCurrency(totals.laborCost)}</p>
        </div>
        <div className="p-4 rounded-xl border border-white/[0.08] bg-slate-900/70 backdrop-blur-xl">
          <p className="text-xs font-medium text-slate-400">Gross Profit</p>
          <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totals.grossProfit)}</p>
        </div>
        <div className="p-4 rounded-xl border border-white/[0.08] bg-slate-900/70 backdrop-blur-xl">
          <p className="text-xs font-medium text-slate-400">Avg Margin</p>
          <p className="text-2xl font-bold mt-1" style={{ 
            color: totals.margin >= 40 ? COLORS.success : totals.margin >= 20 ? COLORS.warning : COLORS.danger 
          }}>
            {formatPercent(totals.margin)}
          </p>
        </div>
      </div>

      {/* Detail Table */}
      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
        <div className="bg-slate-900/70 backdrop-blur-xl px-4 py-3 border-b border-white/[0.08]">
          <h3 className="font-medium text-slate-200">Client Profitability Detail</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/[0.03]">
              <th className="text-left px-4 py-3 font-medium text-slate-400">Client</th>
              <th className="text-right px-4 py-3 font-medium text-slate-400">Revenue</th>
              <th className="text-right px-4 py-3 font-medium text-slate-400">Labor Cost</th>
              <th className="text-right px-4 py-3 font-medium text-slate-400">Gross Profit</th>
              <th className="text-center px-4 py-3 font-medium text-slate-400">Margin</th>
              <th className="text-right px-4 py-3 font-medium text-slate-400">Hours</th>
              <th className="text-right px-4 py-3 font-medium text-slate-400">Eff. Rate</th>
            </tr>
          </thead>
          <tbody>
            {profitabilityData.map((client, i) => (
              <tr key={i} className="border-t border-white/[0.08]/50 hover:bg-white/[0.03]">
                <td className="px-4 py-3 font-medium text-slate-200">{client.name}</td>
                <td className="px-4 py-3 text-right text-emerald-400">{formatCurrency(client.revenue)}</td>
                <td className="px-4 py-3 text-right text-rose-400">{formatCurrency(client.laborCost)}</td>
                <td className="px-4 py-3 text-right font-medium text-white">{formatCurrency(client.grossProfit)}</td>
                <td className="px-4 py-3 text-center">
                  <span className="px-2 py-0.5 rounded text-xs font-medium" style={{
                    backgroundColor: client.margin >= 40 ? `${COLORS.success}20` : 
                      client.margin >= 20 ? `${COLORS.warning}20` : `${COLORS.danger}20`,
                    color: client.margin >= 40 ? COLORS.success : 
                      client.margin >= 20 ? COLORS.warning : COLORS.danger
                  }}>
                    {formatPercent(client.margin)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-slate-300">{formatNumber(client.hours)}</td>
                <td className="px-4 py-3 text-right text-slate-300">${formatNumber(client.effectiveRate)}/hr</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// P&L Report
function PnLReport({ 
  transactions, 
  invoices,
  basis,
  dateRange,
  comparisonRange
}: { 
  transactions: any[]
  invoices: any[]
  basis: 'cash' | 'accrual'
  dateRange: { start: Date; end: Date }
  comparisonRange?: { start: Date; end: Date }
}) {
  const pnlData = useMemo(() => {
    let revenue = 0
    let cogs = 0
    let opex = 0
    let overhead = 0

    if (basis === 'cash') {
      // Cash basis - use actual transactions
      transactions
        .filter(t => {
          const txDate = new Date(t.date)
          return txDate >= dateRange.start && txDate <= dateRange.end
        })
        .forEach(t => {
          const amount = t.amount || 0
          switch (t.category) {
            case 'revenue': revenue += amount; break
            case 'cogs': cogs += Math.abs(amount); break
            case 'opex': opex += Math.abs(amount); break
            case 'overhead': overhead += Math.abs(amount); break
          }
        })
    } else {
      // Accrual basis - use invoices for revenue
      invoices
        .filter(inv => {
          const invDate = new Date(inv.invoice_date)
          return invDate >= dateRange.start && invDate <= dateRange.end
        })
        .forEach(inv => {
          revenue += inv.total_amount || 0
        })

      // Still use transactions for expenses
      transactions
        .filter(t => {
          const txDate = new Date(t.date)
          return txDate >= dateRange.start && txDate <= dateRange.end && t.category !== 'revenue'
        })
        .forEach(t => {
          const amount = Math.abs(t.amount || 0)
          switch (t.category) {
            case 'cogs': cogs += amount; break
            case 'opex': opex += amount; break
            case 'overhead': overhead += amount; break
          }
        })
    }

    const grossProfit = revenue - cogs
    const operatingIncome = grossProfit - opex
    const netIncome = operatingIncome - overhead

    return {
      revenue,
      cogs,
      grossProfit,
      grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
      opex,
      operatingIncome,
      overhead,
      netIncome,
      netMargin: revenue > 0 ? (netIncome / revenue) * 100 : 0,
    }
  }, [transactions, invoices, basis, dateRange])

  const rows = [
    { label: 'Revenue', value: pnlData.revenue, indent: 0, bold: true, color: 'text-emerald-400' },
    { label: 'Cost of Goods Sold', value: -pnlData.cogs, indent: 1, color: 'text-rose-400' },
    { label: 'Gross Profit', value: pnlData.grossProfit, indent: 0, bold: true, border: true },
    { label: `Gross Margin`, value: pnlData.grossMargin, indent: 1, isPercent: true, color: 'text-slate-400' },
    { label: 'Operating Expenses', value: -pnlData.opex, indent: 1, color: 'text-rose-400' },
    { label: 'Operating Income', value: pnlData.operatingIncome, indent: 0, bold: true, border: true },
    { label: 'Overhead / G&A', value: -pnlData.overhead, indent: 1, color: 'text-rose-400' },
    { label: 'Net Income', value: pnlData.netIncome, indent: 0, bold: true, border: true, highlight: true },
    { label: 'Net Margin', value: pnlData.netMargin, indent: 1, isPercent: true, color: 'text-slate-400' },
  ]

  return (
    <div className="space-y-6">
      {/* Basis Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">Basis:</span>
        <span className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-medium capitalize">
          {basis}
        </span>
      </div>

      {/* P&L Statement */}
      <div className="rounded-xl border border-white/[0.08] overflow-hidden">
        <div className="bg-slate-900/70 backdrop-blur-xl px-4 py-3 border-b border-white/[0.08]">
          <h3 className="font-medium text-slate-200">
            Profit & Loss Statement ({basis === 'cash' ? 'Cash Basis' : 'Accrual Basis'})
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {dateRange.start.toLocaleDateString()} - {dateRange.end.toLocaleDateString()}
          </p>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {rows.map((row, i) => (
              <tr 
                key={i} 
                className={`
                  ${row.border ? 'border-t-2 border-white/[0.12]' : 'border-t border-white/[0.08]/50'}
                  ${row.highlight ? 'bg-slate-900/70 backdrop-blur-xl' : ''}
                `}
              >
                <td 
                  className={`px-4 py-3 ${row.bold ? 'font-semibold' : ''} ${row.color || 'text-slate-200'}`}
                  style={{ paddingLeft: `${16 + row.indent * 24}px` }}
                >
                  {row.label}
                </td>
                <td className={`px-4 py-3 text-right ${row.bold ? 'font-semibold' : ''} ${row.color || 'text-white'}`}>
                  {row.isPercent 
                    ? formatPercent(row.value)
                    : formatCurrency(row.value)
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============ MAIN REPORTS PAGE ============
export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  
  // Data
  const [transactions, setTransactions] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [timeEntries, setTimeEntries] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  
  // UI State
  const [activeView, setActiveView] = useState<'library' | 'report' | 'builder'>('library')
  const [selectedReport, setSelectedReport] = useState<ReportDefinition | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['financial', 'ar', 'expense'])
  const [searchQuery, setSearchQuery] = useState('')
  
  // Filters
  const [datePreset, setDatePreset] = useState('this_month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [pnlBasis, setPnlBasis] = useState<'cash' | 'accrual'>('cash')
  
  // Computed date range
  const dateRange = useMemo(() => {
    if (datePreset === 'custom' && customStart && customEnd) {
      return { start: new Date(customStart), end: new Date(customEnd) }
    }
    return getDateRange(datePreset)
  }, [datePreset, customStart, customEnd])

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

        const [txRes, invRes, projRes, clientRes, timeRes, teamRes] = await Promise.all([
          supabase.from('transactions').select('*').eq('company_id', profile.company_id),
          supabase.from('invoices').select('*').eq('company_id', profile.company_id),
          supabase.from('projects').select('*').eq('company_id', profile.company_id),
          supabase.from('clients').select('*').eq('company_id', profile.company_id),
          supabase.from('time_entries').select('*').eq('company_id', profile.company_id),
          supabase.from('team_members').select('*').eq('company_id', profile.company_id)
        ])

        setTransactions(txRes.data || [])
        setInvoices(invRes.data || [])
        setProjects(projRes.data || [])
        setClients(clientRes.data || [])
        setTimeEntries(timeRes.data || [])
        setTeamMembers(teamRes.data || [])
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const filteredReports = useMemo(() => {
    if (!searchQuery) return REPORTS
    const q = searchQuery.toLowerCase()
    return REPORTS.filter(r => 
      r.name.toLowerCase().includes(q) || 
      r.description.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q)
    )
  }, [searchQuery])

  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => 
      prev.includes(catId) 
        ? prev.filter(c => c !== catId)
        : [...prev, catId]
    )
  }

  const openReport = (report: ReportDefinition) => {
    setSelectedReport(report)
    setActiveView('report')
  }

  const handleExportPDF = async () => {
    // For now, trigger print dialog
    window.print()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-sm text-slate-400 mt-1">Financial analysis and insights</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveView('library')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeView === 'library' 
                ? 'bg-emerald-500 text-white' 
                : 'bg-white/[0.05] border border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
            }`}
          >
            <Layers size={16} className="inline mr-2" />
            Report Library
          </button>
          <button
            onClick={() => setActiveView('builder')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeView === 'builder' 
                ? 'bg-emerald-500 text-white' 
                : 'bg-white/[0.05] border border-white/[0.08] text-slate-300 hover:bg-white/[0.08]'
            }`}
          >
            <LayoutGrid size={16} className="inline mr-2" />
            Report Builder
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl border border-white/[0.08] bg-slate-900/70 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-slate-400" />
          <DateRangePicker
            value={datePreset}
            onChange={setDatePreset}
            customStart={customStart}
            customEnd={customEnd}
            onCustomChange={(start, end) => {
              setCustomStart(start)
              setCustomEnd(end)
            }}
          />
        </div>
        
        {activeView === 'report' && selectedReport?.id.startsWith('pnl') && (
          <div className="flex items-center gap-2 ml-4 pl-4 border-l border-white/[0.08]">
            <span className="text-sm text-slate-400">Basis:</span>
            <button
              onClick={() => setPnlBasis('cash')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pnlBasis === 'cash' 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.1]'
              }`}
            >
              Cash
            </button>
            <button
              onClick={() => setPnlBasis('accrual')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pnlBasis === 'accrual' 
                  ? 'bg-emerald-500 text-white' 
                  : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.1]'
              }`}
            >
              Accrual
            </button>
          </div>
        )}
        
        <div className="flex-1" />
        
        {activeView === 'report' && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 text-sm font-medium transition-colors"
            >
              <Download size={16} />
              Export PDF
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      {activeView === 'library' && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-900/70 backdrop-blur-xl border border-white/[0.08] text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-emerald-500/30 focus:border-transparent"
            />
          </div>

          {/* Report Categories */}
          <div className="space-y-3">
            {REPORT_CATEGORIES.map(cat => {
              const catReports = filteredReports.filter(r => r.category === cat.id)
              if (catReports.length === 0) return null
              
              return (
                <div key={cat.id} className="rounded-xl border border-white/[0.08] overflow-hidden">
                  <SectionHeader
                    title={cat.name}
                    icon={cat.icon}
                    count={catReports.length}
                    expanded={expandedCategories.includes(cat.id)}
                    onToggle={() => toggleCategory(cat.id)}
                  />
                  
                  {expandedCategories.includes(cat.id) && (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-white/[0.02]">
                      {catReports.map(report => (
                        <ReportCard 
                          key={report.id} 
                          report={report}
                          onClick={() => openReport(report)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeView === 'report' && selectedReport && (
        <div className="space-y-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm">
            <button 
              onClick={() => setActiveView('library')}
              className="text-slate-400 hover:text-slate-200"
            >
              Reports
            </button>
            <ChevronRight size={16} className="text-slate-600" />
            <span className="text-slate-200">{selectedReport.name}</span>
          </div>

          {/* Report Title */}
          <div className="flex items-center gap-4">
            <div 
              className="p-3 rounded-xl"
              style={{ backgroundColor: `${selectedReport.color}20` }}
            >
              <selectedReport.icon size={24} style={{ color: selectedReport.color }} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{selectedReport.name}</h2>
              <p className="text-sm text-slate-400">{selectedReport.description}</p>
            </div>
          </div>

          {/* Report Content */}
          <div className="print:bg-white print:text-black">
            {selectedReport.id === 'ar_aging_summary' || selectedReport.id === 'ar_aging_detail' ? (
              <ARAgingReport 
                invoices={invoices} 
                clients={clients}
                dateRange={dateRange}
              />
            ) : selectedReport.id === 'category_spending' ? (
              <CategorySpendingReport 
                transactions={transactions}
                dateRange={dateRange}
              />
            ) : selectedReport.id === 'utilization_summary' || selectedReport.id === 'utilization_detail' ? (
              <UtilizationReport 
                timeEntries={timeEntries}
                teamMembers={teamMembers}
                dateRange={dateRange}
              />
            ) : selectedReport.id === 'client_profitability' || selectedReport.id === 'client_ranking' ? (
              <ClientProfitabilityReport 
                invoices={invoices}
                timeEntries={timeEntries}
                clients={clients}
                projects={projects}
                dateRange={dateRange}
              />
            ) : selectedReport.id.startsWith('pnl') ? (
              <PnLReport 
                transactions={transactions}
                invoices={invoices}
                basis={pnlBasis}
                dateRange={dateRange}
              />
            ) : (
              <div className="text-center py-12 text-slate-500">
                <FileText size={48} className="mx-auto mb-4 opacity-50" />
                <p>Report view coming soon</p>
                <p className="text-sm mt-1">This report type is under development</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeView === 'builder' && (
        <div className="rounded-xl border border-white/[0.08] bg-slate-900/70 backdrop-blur-xl p-8">
          <div className="text-center">
            <LayoutGrid size={48} className="mx-auto mb-4 text-slate-600" />
            <h3 className="text-lg font-semibold text-slate-200">Custom Report Builder</h3>
            <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
              Drag and drop data widgets to create custom reports. Save templates for recurring use.
            </p>
            <p className="text-xs text-blue-400 mt-4">Coming in next release</p>
          </div>
        </div>
      )}
    </div>
  )
}
