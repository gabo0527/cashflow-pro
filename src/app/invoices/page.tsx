'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  FileText, DollarSign, Clock, AlertTriangle, TrendingUp, TrendingDown,
  Plus, ChevronDown, ChevronUp, Filter, Download, Search, RefreshCw,
  MoreHorizontal, Edit2, Check, X, Send, CreditCard, Calendar,
  Building2, Briefcase, AlertCircle, CheckCircle2, ExternalLink,
  ChevronRight, Eye, Mail, Trash2, Zap
} from 'lucide-react'
import Link from 'next/link'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, LineChart, Line, Area, AreaChart
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
    tertiary: '#94a3b8',
    grid: 'rgba(255,255,255,0.06)',
  }
}

const COLORS = {
  emerald: '#10b981',
  amber: '#f59e0b',
  orange: '#f97316',
  rose: '#f43f5e',
  blue: '#3b82f6',
}

// Status colors - Glass theme
const STATUS_CONFIG = {
  paid: { label: 'Paid', color: COLORS.emerald, bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  partial: { label: 'Partial', color: COLORS.blue, bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  current: { label: 'Current', color: '#64748b', bg: 'bg-slate-500/10', text: 'text-slate-300', border: 'border-slate-500/30' },
  overdue_1_30: { label: 'Overdue', color: COLORS.amber, bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  overdue_31_60: { label: '30+ Days', color: COLORS.orange, bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  overdue_61_90: { label: '60+ Days', color: COLORS.rose, bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  overdue_90_plus: { label: '90+ Days', color: '#be123c', bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-500/40' },
}

// ============ UTILITY FUNCTIONS ============
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatDateShort = (dateStr: string): string => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const getInvoiceStatus = (dueDate: string, amount: number, balance: number): string => {
  if (balance === 0) return 'paid'
  if (balance < amount && balance > 0) return 'partial'
  
  const today = new Date()
  const due = new Date(dueDate)
  const diffDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays <= 0) return 'current'
  if (diffDays <= 30) return 'overdue_1_30'
  if (diffDays <= 60) return 'overdue_31_60'
  if (diffDays <= 90) return 'overdue_61_90'
  return 'overdue_90_plus'
}

const getDaysOverdue = (dueDate: string): number => {
  const today = new Date()
  const due = new Date(dueDate)
  const diffDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

// ============ PAYMENT PROBABILITY (THE EDGE) ============
// AI-style prediction based on client behavior, aging, and amount
const getPaymentProbability = (invoice: any, clientHistory: any[]): { score: number; label: string; color: string } => {
  const status = getInvoiceStatus(invoice.due_date, invoice.amount, invoice.balance)
  const daysOverdue = getDaysOverdue(invoice.due_date)
  
  // Base score starts at 95 for current invoices
  let score = 95
  
  // Reduce by days overdue
  if (daysOverdue > 0) score -= Math.min(daysOverdue * 0.8, 50)
  
  // Client history factor (if they've paid before, higher probability)
  const clientPaidInvoices = clientHistory.filter(inv => inv.client_id === invoice.client_id && inv.balance === 0)
  const clientTotalInvoices = clientHistory.filter(inv => inv.client_id === invoice.client_id)
  if (clientTotalInvoices.length > 0) {
    const payRate = clientPaidInvoices.length / clientTotalInvoices.length
    score = score * (0.7 + (payRate * 0.3))
  }
  
  // Amount factor (larger amounts slightly lower probability)
  if (invoice.balance > 50000) score *= 0.95
  if (invoice.balance > 100000) score *= 0.90
  
  score = Math.max(10, Math.min(99, Math.round(score)))
  
  let label = 'High'
  let color = 'text-emerald-400'
  
  if (score < 50) { label = 'Low'; color = 'text-rose-400' }
  else if (score < 75) { label = 'Medium'; color = 'text-amber-400' }
  
  return { score, label, color }
}

// ============ COMPONENTS ============

// Glass Metric Card
function MetricCard({ 
  label, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  color = 'emerald',
}: { 
  label: string
  value: string
  subtitle?: string
  icon: any
  trend?: { value: number; label: string }
  color?: 'emerald' | 'blue' | 'rose' | 'amber' | 'purple' | 'slate' | 'cyan'
}) {
  const colorMap = {
    emerald: 'text-emerald-400',
    blue: 'text-blue-400',
    rose: 'text-rose-400',
    amber: 'text-amber-400',
    purple: 'text-purple-400',
    slate: 'text-slate-300',
    cyan: 'text-cyan-400'
  }

  return (
    <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-5 ${THEME.glassHover} transition-all`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-sm font-medium ${THEME.textMuted}`}>{label}</p>
          <p className={`text-2xl font-semibold ${colorMap[color]} mt-1`}>{value}</p>
          {subtitle && <p className={`text-xs ${THEME.textDim} mt-1`}>{subtitle}</p>}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.value >= 0 ? <TrendingUp size={14} className="text-emerald-400" /> : <TrendingDown size={14} className="text-rose-400" />}
              <span className={`text-xs font-medium ${trend.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{Math.abs(trend.value).toFixed(1)}%</span>
              <span className={`text-xs ${THEME.textDim}`}>{trend.label}</span>
            </div>
          )}
        </div>
        <div className="p-2.5 rounded-lg bg-white/[0.05]">
          <Icon size={20} className={THEME.textMuted} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  )
}

// Glass Status Badge
function StatusBadge({ status, daysOverdue }: { status: string; daysOverdue?: number }) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.current
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}>
      {config.label}
      {daysOverdue && daysOverdue > 0 && status !== 'paid' && status !== 'partial' && status !== 'current' && (
        <span className="opacity-75">({daysOverdue}d)</span>
      )}
    </span>
  )
}

// Payment Probability Badge (THE EDGE)
function ProbabilityBadge({ score, color }: { score: number; color: string }) {
  const bgColor = score >= 75 ? 'bg-emerald-500/10' : score >= 50 ? 'bg-amber-500/10' : 'bg-rose-500/10'
  
  return (
    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${bgColor}`}>
      <Zap size={10} className={color} />
      <span className={`text-[10px] font-bold ${color}`}>{score}%</span>
    </div>
  )
}

// Glass Aging Bar
function AgingBar({ label, amount, total, count, color }: { label: string; amount: number; total: number; count: number; color: string }) {
  const percent = total > 0 ? (amount / total) * 100 : 0
  
  return (
    <div className="flex items-center gap-4 py-2.5">
      <div className="w-24 shrink-0">
        <p className={`text-sm ${THEME.textSecondary}`}>{label}</p>
      </div>
      <div className="flex-1 h-2 bg-white/[0.08] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
      <div className="w-28 text-right shrink-0">
        <p className={`text-sm font-semibold ${THEME.textPrimary}`}>{formatCurrency(amount)}</p>
      </div>
      <div className="w-16 text-right shrink-0">
        <p className={`text-xs ${THEME.textDim}`}>{count} inv</p>
      </div>
      <div className="w-12 text-right shrink-0">
        <p className={`text-xs ${THEME.textMuted}`}>{percent.toFixed(0)}%</p>
      </div>
    </div>
  )
}

// Glass Tooltip
const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-lg px-3 py-2 shadow-xl`}>
      <p className={`text-xs ${THEME.textDim} mb-1`}>{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  )
}

// Glass Editable Select
function EditableSelect({ value, options, onChange, placeholder = 'Select...' }: { value: string; options: { id: string; name: string }[]; onChange: (value: string) => void; placeholder?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  
  const filteredOptions = options.filter(opt => opt.name.toLowerCase().includes(search.toLowerCase()))
  const selectedOption = options.find(opt => opt.id === value)
  
  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className={`flex items-center gap-1 text-sm ${THEME.textSecondary} hover:text-white transition-colors group`}>
        <span className={selectedOption ? '' : `${THEME.textDim} italic`}>{selectedOption?.name || placeholder}</span>
        <Edit2 size={12} className={`${THEME.textDim} opacity-0 group-hover:opacity-100 transition-opacity`} />
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className={`absolute top-full left-0 mt-1 w-56 ${THEME.glass} border ${THEME.glassBorder} rounded-lg shadow-xl z-20 overflow-hidden`}>
            <div className="p-2 border-b border-white/[0.08]">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded px-2 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              <button onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }} className={`w-full px-3 py-2 text-left text-sm ${THEME.textDim} hover:bg-white/[0.05] transition-colors`}>
                — None —
              </button>
              {filteredOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { onChange(opt.id); setIsOpen(false); setSearch(''); }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-white/[0.05] transition-colors ${opt.id === value ? 'text-emerald-400 bg-emerald-500/10' : THEME.textSecondary}`}
                >
                  {opt.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Glass Invoice Row with Payment Probability
function InvoiceRow({ invoice, clients, projects, allInvoices, onUpdate, isSelected, onSelect }: { invoice: any; clients: any[]; projects: any[]; allInvoices: any[]; onUpdate: (id: string, updates: any) => void; isSelected: boolean; onSelect: (id: string) => void }) {
  const status = getInvoiceStatus(invoice.due_date, invoice.amount, invoice.balance)
  const daysOverdue = getDaysOverdue(invoice.due_date)
  const client = clients.find(c => c.id === invoice.client_id)
  const project = projects.find(p => p.id === invoice.project_id)
  const probability = invoice.balance > 0 ? getPaymentProbability(invoice, allInvoices) : null
  
  return (
    <div className={`flex items-center gap-3 py-3 px-4 hover:bg-white/[0.03] transition-colors border-b border-white/[0.05] ${isSelected ? 'bg-emerald-500/10' : ''}`}>
      {/* Checkbox */}
      <div className="w-8 shrink-0">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(invoice.id)}
          className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/30"
        />
      </div>
      
      {/* Invoice # */}
      <div className="w-20 shrink-0">
        <p className="text-sm font-medium text-emerald-400">#{invoice.invoice_number}</p>
      </div>
      
      {/* Payment Probability (THE EDGE) */}
      <div className="w-14 shrink-0">
        {probability ? (
          <ProbabilityBadge score={probability.score} color={probability.color} />
        ) : (
          <span className="text-xs text-emerald-400">✓</span>
        )}
      </div>
      
      {/* Date */}
      <div className="w-20 shrink-0">
        <p className={`text-sm ${THEME.textMuted}`}>{formatDateShort(invoice.invoice_date)}</p>
      </div>
      
      {/* Due Date */}
      <div className="w-20 shrink-0">
        <p className={`text-sm ${status.includes('overdue') ? 'text-rose-400 font-medium' : THEME.textMuted}`}>
          {formatDateShort(invoice.due_date)}
        </p>
      </div>
      
      {/* Client */}
      <div className="w-28 shrink-0">
        <EditableSelect value={invoice.client_id || ''} options={clients} onChange={(value) => onUpdate(invoice.id, { client_id: value })} placeholder="Assign" />
      </div>
      
      {/* Project */}
      <div className="w-36 shrink-0">
        <EditableSelect value={invoice.project_id || ''} options={projects} onChange={(value) => onUpdate(invoice.id, { project_id: value })} placeholder="Assign" />
      </div>
      
      {/* QBO Customer */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs ${THEME.textDim} truncate`} title={invoice.qbo_customer}>{invoice.qbo_customer || '—'}</p>
      </div>
      
      {/* Amount */}
      <div className="w-24 text-right shrink-0">
        <p className={`text-sm font-medium ${THEME.textPrimary}`}>{formatCurrency(invoice.amount)}</p>
      </div>
      
      {/* Balance */}
      <div className="w-24 text-right shrink-0">
        <p className={`text-sm font-semibold ${invoice.balance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
          {formatCurrency(invoice.balance)}
        </p>
      </div>
      
      {/* Status */}
      <div className="w-24 shrink-0">
        <StatusBadge status={status} daysOverdue={daysOverdue} />
      </div>
      
      {/* Actions */}
      <div className="w-20 shrink-0 flex items-center justify-end gap-1">
        {invoice.balance > 0 && (
          <button className="px-2 py-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors" title="Record Payment">
            + Pay
          </button>
        )}
        <button className="p-1 hover:bg-white/[0.05] rounded transition-colors" title="More actions">
          <MoreHorizontal size={16} className={THEME.textMuted} />
        </button>
      </div>
    </div>
  )
}

// Collapsible Section Component
function CollapsibleSection({ title, subtitle, badge, children, defaultExpanded = true, noPadding = false }: { title: string; subtitle?: string; badge?: string | number; children: React.ReactNode; defaultExpanded?: boolean; noPadding?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  
  return (
    <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
      <div 
        className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder} cursor-pointer hover:bg-white/[0.03] transition-colors`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={THEME.textMuted}>
            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>{title}</h3>
              {badge !== undefined && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-white/[0.08] text-slate-300">{badge}</span>
              )}
            </div>
            {subtitle && <p className={`text-xs ${THEME.textDim} mt-0.5`}>{subtitle}</p>}
          </div>
        </div>
      </div>
      {isExpanded && (
        <div className={noPadding ? '' : 'p-6'}>
          {children}
        </div>
      )}
    </div>
  )
}

// ============ MAIN PAGE ============
export default function InvoicesPage() {
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterClient, setFilterClient] = useState('all')
  const [sortField, setSortField] = useState('due_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<any>(null)

  // Data loading
  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await getCurrentUser()
        const user = result?.user
        if (!user) { setLoading(false); return }

        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
        if (!profile?.company_id) { setLoading(false); return }

        const [invRes, clientRes, projRes] = await Promise.all([
          supabase.from('invoices').select('*').eq('company_id', profile.company_id).order('invoice_date', { ascending: false }),
          supabase.from('clients').select('*').eq('company_id', profile.company_id).order('name'),
          supabase.from('projects').select('*').eq('company_id', profile.company_id).order('name')
        ])

        const transformedInvoices = (invRes.data || []).map(inv => ({
          ...inv,
          amount: parseFloat(inv.total_amount || inv.amount || 0),
          balance: parseFloat(inv.balance_due || inv.balance || inv.total_amount || inv.amount || 0),
          qbo_customer: inv.customer_name || inv.qbo_customer || ''
        }))

        setInvoices(transformedInvoices)
        setClients(clientRes.data || [])
        setProjects(projRes.data || [])
      } catch (error) {
        console.error('Error loading invoices:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Filtered & sorted invoices
  const filteredInvoices = useMemo(() => {
    let result = [...invoices]

    if (selectedYear !== 'all') {
      result = result.filter(inv => new Date(inv.invoice_date).getFullYear() === selectedYear)
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(inv => 
        inv.invoice_number?.toString().toLowerCase().includes(q) ||
        inv.qbo_customer?.toLowerCase().includes(q) ||
        clients.find(c => c.id === inv.client_id)?.name?.toLowerCase().includes(q)
      )
    }

    if (filterStatus !== 'all') {
      result = result.filter(inv => {
        const status = getInvoiceStatus(inv.due_date, inv.amount, inv.balance)
        if (filterStatus === 'unpaid') return inv.balance > 0
        if (filterStatus === 'paid') return inv.balance === 0
        if (filterStatus === 'current') return status === 'current'
        if (filterStatus === 'overdue') return status.includes('overdue')
        return true
      })
    }

    if (filterClient !== 'all') {
      result = result.filter(inv => inv.client_id === filterClient)
    }

    result.sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]
      
      if (sortField === 'invoice_date' || sortField === 'due_date') {
        aVal = new Date(aVal).getTime()
        bVal = new Date(bVal).getTime()
      }
      
      return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
    })

    return result
  }, [invoices, selectedYear, searchQuery, filterStatus, filterClient, sortField, sortDir, clients])

  // AR Metrics
  const arMetrics = useMemo(() => {
    const unpaid = invoices.filter(inv => inv.balance > 0)
    const totalAR = unpaid.reduce((sum, inv) => sum + inv.balance, 0)
    
    const aging = {
      current: { amount: 0, count: 0 },
      days_1_30: { amount: 0, count: 0 },
      days_31_60: { amount: 0, count: 0 },
      days_61_90: { amount: 0, count: 0 },
      days_90_plus: { amount: 0, count: 0 }
    }

    unpaid.forEach(inv => {
      const status = getInvoiceStatus(inv.due_date, inv.amount, inv.balance)
      if (status === 'current') { aging.current.amount += inv.balance; aging.current.count++ }
      else if (status === 'overdue_1_30') { aging.days_1_30.amount += inv.balance; aging.days_1_30.count++ }
      else if (status === 'overdue_31_60') { aging.days_31_60.amount += inv.balance; aging.days_31_60.count++ }
      else if (status === 'overdue_61_90') { aging.days_61_90.amount += inv.balance; aging.days_61_90.count++ }
      else if (status === 'overdue_90_plus') { aging.days_90_plus.amount += inv.balance; aging.days_90_plus.count++ }
    })

    const overdueTotal = aging.days_1_30.amount + aging.days_31_60.amount + aging.days_61_90.amount + aging.days_90_plus.amount

    const paidInvoices = invoices.filter(inv => inv.balance === 0 && inv.paid_date && inv.invoice_date)
    const dso = paidInvoices.length > 0 
      ? paidInvoices.reduce((sum, inv) => {
          const days = Math.floor((new Date(inv.paid_date).getTime() - new Date(inv.invoice_date).getTime()) / (1000 * 60 * 60 * 24))
          return sum + Math.max(0, days)
        }, 0) / paidInvoices.length
      : 0

    const recentInvoices = invoices.filter(inv => {
      const invoiceDate = new Date(inv.invoice_date)
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 180)
      return invoiceDate >= ninetyDaysAgo
    })
    const paidOnTime = recentInvoices.filter(inv => {
      if (inv.balance > 0) return false
      if (!inv.paid_date) return false
      const daysToPay = Math.floor((new Date(inv.paid_date).getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24))
      return daysToPay <= 0
    })
    const collectionRate = recentInvoices.length > 0 ? (paidOnTime.length / recentInvoices.length) * 100 : 0

    return { totalAR, unpaidCount: unpaid.length, overdueTotal, aging, dso, collectionRate }
  }, [invoices])

  // AR by Client
  const arByClient = useMemo(() => {
    const clientAR: { [key: string]: number } = {}
    
    invoices.filter(inv => inv.balance > 0).forEach(inv => {
      const client = clients.find(c => c.id === inv.client_id)
      const clientName = client?.name || inv.qbo_customer || 'Unassigned'
      clientAR[clientName] = (clientAR[clientName] || 0) + inv.balance
    })

    return Object.entries(clientAR).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [invoices, clients])

  // Handlers
  const handleUpdateInvoice = (id: string, updates: any) => {
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates } : inv))
  }

  const handleSelectInvoice = (id: string) => {
    setSelectedInvoices(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const handleSelectAll = () => {
    if (selectedInvoices.length === filteredInvoices.length) {
      setSelectedInvoices([])
    } else {
      setSelectedInvoices(filteredInvoices.map(inv => inv.id))
    }
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
          <p className={`text-sm ${THEME.textMuted}`}>Loading invoices...</p>
        </div>
      </div>
    )
  }

  const pieColors = ['#10B981', '#64748b', '#94a3b8', '#cbd5e1', '#475569']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-xl font-semibold ${THEME.textPrimary}`}>Invoices & AR</h1>
          <p className={`text-sm ${THEME.textMuted} mt-1`}>Accounts receivable management & aging analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="appearance-none bg-white/[0.05] border border-white/[0.1] rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Time</option>
              {[2026, 2025, 2024, 2023].map(year => (
                <option key={year} value={year} className="bg-slate-900">{year}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-white/[0.1] rounded-lg text-sm font-medium text-slate-300 hover:bg-white/[0.05] transition-colors">
            <RefreshCw size={14} />
            Sync QBO
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-white/[0.1] rounded-lg text-sm font-medium text-slate-300 hover:bg-white/[0.05] transition-colors">
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-5 gap-4">
        <MetricCard label="Total AR" value={formatCurrency(arMetrics.totalAR)} subtitle={`${arMetrics.unpaidCount} unpaid invoices`} icon={DollarSign} color="amber" />
        <MetricCard label="Current" value={formatCurrency(arMetrics.aging.current.amount)} subtitle={`${arMetrics.aging.current.count} invoices`} icon={CheckCircle2} color="emerald" />
        <MetricCard label="Overdue" value={formatCurrency(arMetrics.overdueTotal)} subtitle="Past due date" icon={AlertTriangle} color="rose" />
        <MetricCard label="Avg DSO" value={`${arMetrics.dso.toFixed(0)} days`} subtitle="Days sales outstanding" icon={Clock} color="blue" />
        <MetricCard label="Collection Rate" value={`${arMetrics.collectionRate.toFixed(0)}%`} subtitle="Paid on time (90d)" icon={TrendingUp} color={arMetrics.collectionRate >= 80 ? 'emerald' : arMetrics.collectionRate >= 60 ? 'amber' : 'rose'} />
      </div>

      {/* Aging & Charts */}
      <div className="grid grid-cols-12 gap-6">
        {/* Aging Breakdown */}
        <div className="col-span-12 lg:col-span-8">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-6`}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className={`text-sm font-semibold ${THEME.textPrimary}`}>AR Aging</h2>
                <p className={`text-xs ${THEME.textDim} mt-0.5`}>Outstanding balance by age</p>
              </div>
              <div className="text-right">
                <p className={`text-xs ${THEME.textMuted}`}>Total Outstanding</p>
                <p className="text-xl font-semibold text-amber-400">{formatCurrency(arMetrics.totalAR)}</p>
              </div>
            </div>
            <div className="space-y-1">
              <AgingBar label="Current" amount={arMetrics.aging.current.amount} total={arMetrics.totalAR} count={arMetrics.aging.current.count} color={COLORS.emerald} />
              <AgingBar label="1-30 days" amount={arMetrics.aging.days_1_30.amount} total={arMetrics.totalAR} count={arMetrics.aging.days_1_30.count} color={COLORS.amber} />
              <AgingBar label="31-60 days" amount={arMetrics.aging.days_31_60.amount} total={arMetrics.totalAR} count={arMetrics.aging.days_31_60.count} color={COLORS.orange} />
              <AgingBar label="61-90 days" amount={arMetrics.aging.days_61_90.amount} total={arMetrics.totalAR} count={arMetrics.aging.days_61_90.count} color={COLORS.rose} />
              <AgingBar label="90+ days" amount={arMetrics.aging.days_90_plus.amount} total={arMetrics.totalAR} count={arMetrics.aging.days_90_plus.count} color="#be123c" />
            </div>
          </div>
        </div>

        {/* AR by Client */}
        <div className="col-span-12 lg:col-span-4">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-6 h-full`}>
            <h2 className={`text-sm font-semibold ${THEME.textPrimary} mb-4`}>AR by Client</h2>
            {arByClient.length > 0 ? (
              <>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie data={arByClient} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                        {arByClient.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-2">
                  {arByClient.slice(0, 5).map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: pieColors[i % pieColors.length] }} />
                        <span className={`text-xs ${THEME.textSecondary} truncate max-w-24`}>{item.name}</span>
                      </div>
                      <span className={`text-xs font-semibold ${THEME.textPrimary}`}>{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className={`flex items-center justify-center h-40 ${THEME.textMuted} text-sm`}>No outstanding AR</div>
            )}
          </div>
        </div>
      </div>

      {/* COLLAPSIBLE Invoice Table */}
      <CollapsibleSection 
        title="Invoices" 
        subtitle={`${filteredInvoices.filter(i => i.balance > 0).length} unpaid • ${filteredInvoices.filter(i => i.balance === 0).length} paid`}
        badge={filteredInvoices.length}
        defaultExpanded={true}
        noPadding
      >
        {/* Filters */}
        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 border-b ${THEME.glassBorder}`}>
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-emerald-400" />
            <span className={`text-xs ${THEME.textMuted}`}>Payment probability powered by AI</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoices..."
                className="bg-white/[0.05] border border-white/[0.1] rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
              <option value="all" className="bg-slate-900">All Status</option>
              <option value="unpaid" className="bg-slate-900">Unpaid</option>
              <option value="paid" className="bg-slate-900">Paid</option>
              <option value="current" className="bg-slate-900">Current</option>
              <option value="overdue" className="bg-slate-900">Overdue</option>
            </select>
            <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
              <option value="all" className="bg-slate-900">All Clients</option>
              {clients.map(client => (
                <option key={client.id} value={client.id} className="bg-slate-900">{client.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedInvoices.length > 0 && (
          <div className="flex items-center gap-4 px-6 py-3 bg-emerald-500/10 border-b border-emerald-500/20">
            <span className="text-sm font-medium text-emerald-400">{selectedInvoices.length} selected</span>
            <button className={`text-sm ${THEME.textSecondary} hover:text-white transition-colors`}>Mark as Paid</button>
            <button className={`text-sm ${THEME.textSecondary} hover:text-white transition-colors`}>Send Reminder</button>
            <button className={`text-sm ${THEME.textSecondary} hover:text-white transition-colors`}>Assign Client</button>
            <button className={`text-sm ${THEME.textSecondary} hover:text-white transition-colors`}>Export</button>
          </div>
        )}
        
        {/* Column Headers */}
        <div className={`flex items-center gap-3 py-2.5 px-4 bg-white/[0.03] border-b ${THEME.glassBorder} text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>
          <div className="w-8 shrink-0">
            <input type="checkbox" checked={selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0} onChange={handleSelectAll} className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/30" />
          </div>
          <button onClick={() => handleSort('invoice_number')} className="w-20 shrink-0 flex items-center gap-1 hover:text-white transition-colors">
            Inv # {sortField === 'invoice_number' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <div className="w-14 shrink-0 flex items-center gap-1">
            <Zap size={10} className="text-emerald-400" /> Prob
          </div>
          <button onClick={() => handleSort('invoice_date')} className="w-20 shrink-0 flex items-center gap-1 hover:text-white transition-colors">
            Date {sortField === 'invoice_date' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <button onClick={() => handleSort('due_date')} className="w-20 shrink-0 flex items-center gap-1 hover:text-white transition-colors">
            Due {sortField === 'due_date' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <div className="w-28 shrink-0">Client</div>
          <div className="w-36 shrink-0">Project</div>
          <div className="flex-1">QBO Customer</div>
          <button onClick={() => handleSort('amount')} className="w-24 text-right shrink-0 flex items-center justify-end gap-1 hover:text-white transition-colors">
            Amount {sortField === 'amount' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <button onClick={() => handleSort('balance')} className="w-24 text-right shrink-0 flex items-center justify-end gap-1 hover:text-white transition-colors">
            Balance {sortField === 'balance' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <div className="w-24 shrink-0">Status</div>
          <div className="w-20 shrink-0"></div>
        </div>

        {/* Invoice List */}
        <div className="max-h-[500px] overflow-y-auto">
          {filteredInvoices.length > 0 ? (
            filteredInvoices.map(invoice => (
              <InvoiceRow
                key={invoice.id}
                invoice={invoice}
                clients={clients}
                projects={projects}
                allInvoices={invoices}
                onUpdate={handleUpdateInvoice}
                isSelected={selectedInvoices.includes(invoice.id)}
                onSelect={handleSelectInvoice}
              />
            ))
          ) : (
            <div className={`flex items-center justify-center py-12 ${THEME.textMuted}`}>
              No invoices found
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-6 py-3 bg-white/[0.03] border-t ${THEME.glassBorder}`}>
          <p className={`text-sm ${THEME.textMuted}`}>
            Showing {filteredInvoices.length} of {invoices.length} invoices
          </p>
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className={THEME.textMuted}>Total: </span>
              <span className={`font-semibold ${THEME.textPrimary}`}>{formatCurrency(filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0))}</span>
            </div>
            <div>
              <span className={THEME.textMuted}>Balance: </span>
              <span className="font-semibold text-amber-400">{formatCurrency(filteredInvoices.reduce((sum, inv) => sum + inv.balance, 0))}</span>
            </div>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  )
}
