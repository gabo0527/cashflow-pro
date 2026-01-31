'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  FileText, DollarSign, Clock, AlertTriangle, TrendingUp, TrendingDown,
  Plus, ChevronDown, ChevronUp, Filter, Download, Search, RefreshCw,
  MoreHorizontal, Edit2, Check, X, Send, CreditCard, Calendar,
  Building2, Briefcase, AlertCircle, CheckCircle2, ExternalLink,
  ChevronRight, Eye, Mail, Trash2
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

// ============ DESIGN SYSTEM - V2 LIGHT THEME ============
const COLORS = {
  emerald: '#10b981',
  emeraldLight: '#34d399',
  blue: '#3b82f6',
  blueLight: '#60a5fa',
  rose: '#f43f5e',
  roseLight: '#fb7185',
  amber: '#f59e0b',
  amberLight: '#fbbf24',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  orange: '#f97316',
  // V2 theme - monochrome with emerald accent
  gray: {
    50: '#f9fafb', 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db',
    400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151',
    800: '#1f2937', 900: '#111827'
  }
}

// Status colors and labels - Updated for light theme
const STATUS_CONFIG = {
  paid: { label: 'Paid', color: COLORS.emerald, bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  partial: { label: 'Partial', color: COLORS.blue, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  current: { label: 'Current', color: COLORS.gray[400], bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
  overdue_1_30: { label: 'Overdue', color: COLORS.amber, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  overdue_31_60: { label: 'Overdue 30+', color: COLORS.orange, bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  overdue_61_90: { label: 'Overdue 60+', color: COLORS.rose, bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  overdue_90_plus: { label: 'Overdue 90+', color: '#be123c', bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300' },
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

// Calculate invoice status based on due date and balance
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

// Calculate days overdue
const getDaysOverdue = (dueDate: string): number => {
  const today = new Date()
  const due = new Date(dueDate)
  const diffDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

// ============ COMPONENTS ============

// Metric Card - V2 Light Theme
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
    emerald: { text: 'text-emerald-600', icon: 'text-gray-400' },
    blue: { text: 'text-blue-600', icon: 'text-gray-400' },
    rose: { text: 'text-rose-500', icon: 'text-gray-400' },
    amber: { text: 'text-amber-600', icon: 'text-gray-400' },
    purple: { text: 'text-purple-600', icon: 'text-gray-400' },
    slate: { text: 'text-gray-600', icon: 'text-gray-400' },
    cyan: { text: 'text-cyan-600', icon: 'text-gray-400' }
  }
  const c = colorMap[color]

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-gray-300 transition-all" style={{ boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)' }}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className={`text-2xl font-semibold ${c.text} mt-1`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.value >= 0 ? <TrendingUp size={14} className="text-emerald-500" /> : <TrendingDown size={14} className="text-rose-500" />}
              <span className={`text-xs font-medium ${trend.value >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>{Math.abs(trend.value).toFixed(1)}%</span>
              <span className="text-xs text-gray-400">{trend.label}</span>
            </div>
          )}
        </div>
        <div className="p-2.5 rounded-lg bg-gray-50">
          <Icon size={20} className={c.icon} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  )
}

// Status Badge - V2 Light Theme
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

// Aging Bar - V2 Light Theme
function AgingBar({ 
  label, 
  amount, 
  total, 
  count,
  color 
}: { 
  label: string
  amount: number
  total: number
  count: number
  color: string
}) {
  const percent = total > 0 ? (amount / total) * 100 : 0
  
  return (
    <div className="flex items-center gap-4 py-2.5">
      <div className="w-24 shrink-0">
        <p className="text-sm text-gray-600">{label}</p>
      </div>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      <div className="w-28 text-right shrink-0">
        <p className="text-sm font-semibold text-gray-900">{formatCurrency(amount)}</p>
      </div>
      <div className="w-16 text-right shrink-0">
        <p className="text-xs text-gray-400">{count} inv</p>
      </div>
      <div className="w-12 text-right shrink-0">
        <p className="text-xs text-gray-500">{percent.toFixed(0)}%</p>
      </div>
    </div>
  )
}

// Custom Tooltip - V2 Light Theme
const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  )
}

// Editable Select Component - V2 Light Theme
function EditableSelect({ 
  value, 
  options, 
  onChange,
  placeholder = 'Select...'
}: { 
  value: string
  options: { id: string; name: string }[]
  onChange: (value: string) => void
  placeholder?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  
  const filteredOptions = options.filter(opt => 
    opt.name.toLowerCase().includes(search.toLowerCase())
  )
  
  const selectedOption = options.find(opt => opt.id === value)
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-sm text-gray-700 hover:text-gray-900 transition-colors group"
      >
        <span className={selectedOption ? '' : 'text-gray-400 italic'}>{selectedOption?.name || placeholder}</span>
        <Edit2 size={12} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              <button
                onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }}
                className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-50 transition-colors"
              >
                — None —
              </button>
              {filteredOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { onChange(opt.id); setIsOpen(false); setSearch(''); }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                    opt.id === value ? 'text-emerald-600 bg-emerald-50' : 'text-gray-700'
                  }`}
                >
                  {opt.name}
                </button>
              ))}
              {filteredOptions.length === 0 && (
                <p className="px-3 py-2 text-sm text-gray-400">No matches</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Invoice Row Component - V2 Light Theme
function InvoiceRow({ 
  invoice, 
  clients,
  projects,
  onUpdate,
  isSelected,
  onSelect
}: { 
  invoice: any
  clients: any[]
  projects: any[]
  onUpdate: (id: string, updates: any) => void
  isSelected: boolean
  onSelect: (id: string) => void
}) {
  const status = getInvoiceStatus(invoice.due_date, invoice.amount, invoice.balance)
  const daysOverdue = getDaysOverdue(invoice.due_date)
  const client = clients.find(c => c.id === invoice.client_id)
  const project = projects.find(p => p.id === invoice.project_id)
  
  return (
    <div className={`flex items-center gap-3 py-3 px-4 hover:bg-gray-50 transition-colors border-b border-gray-100 ${isSelected ? 'bg-emerald-50' : 'bg-white'}`}>
      {/* Checkbox */}
      <div className="w-8 shrink-0">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(invoice.id)}
          className="w-4 h-4 rounded border-gray-300 bg-white text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
        />
      </div>
      
      {/* Invoice # */}
      <div className="w-20 shrink-0">
        <p className="text-sm font-medium text-emerald-600">#{invoice.invoice_number}</p>
      </div>
      
      {/* Date */}
      <div className="w-24 shrink-0">
        <p className="text-sm text-gray-500">{formatDateShort(invoice.invoice_date)}</p>
      </div>
      
      {/* Due Date */}
      <div className="w-24 shrink-0">
        <p className={`text-sm ${status.includes('overdue') ? 'text-rose-500 font-medium' : 'text-gray-500'}`}>
          {formatDateShort(invoice.due_date)}
        </p>
      </div>
      
      {/* Client (Editable) */}
      <div className="w-28 shrink-0">
        <EditableSelect
          value={invoice.client_id || ''}
          options={clients}
          onChange={(value) => onUpdate(invoice.id, { client_id: value })}
          placeholder="Assign"
        />
      </div>
      
      {/* Project (Editable) */}
      <div className="w-40 shrink-0">
        <EditableSelect
          value={invoice.project_id || ''}
          options={projects}
          onChange={(value) => onUpdate(invoice.id, { project_id: value })}
          placeholder="Assign"
        />
      </div>
      
      {/* QBO Customer (Original) */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 truncate" title={invoice.qbo_customer}>
          {invoice.qbo_customer || '—'}
        </p>
      </div>
      
      {/* Amount */}
      <div className="w-24 text-right shrink-0">
        <p className="text-sm font-medium text-gray-900">{formatCurrency(invoice.amount)}</p>
      </div>
      
      {/* Paid */}
      <div className="w-20 text-right shrink-0">
        <p className="text-sm text-gray-400">{formatCurrency(invoice.amount - invoice.balance)}</p>
      </div>
      
      {/* Balance */}
      <div className="w-24 text-right shrink-0">
        <p className={`text-sm font-semibold ${invoice.balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
          {formatCurrency(invoice.balance)}
        </p>
      </div>
      
      {/* Status */}
      <div className="w-28 shrink-0">
        <StatusBadge status={status} daysOverdue={daysOverdue} />
      </div>
      
      {/* Actions */}
      <div className="w-20 shrink-0 flex items-center justify-end gap-1">
        {invoice.balance > 0 && (
          <button 
            className="px-2 py-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors"
            title="Record Payment"
          >
            + Pay
          </button>
        )}
        <button className="p-1 hover:bg-gray-100 rounded transition-colors" title="More actions">
          <MoreHorizontal size={16} className="text-gray-400" />
        </button>
      </div>
    </div>
  )
}

// Record Payment Modal - V2 Light Theme
function RecordPaymentModal({ 
  isOpen, 
  onClose, 
  invoice,
  onSave 
}: { 
  isOpen: boolean
  onClose: () => void
  invoice: any
  onSave: (invoiceId: string, amount: number, date: string) => void
}) {
  const [amount, setAmount] = useState(invoice?.balance?.toString() || '')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    if (invoice) {
      setAmount(invoice.balance.toString())
    }
  }, [invoice])

  if (!isOpen || !invoice) return null

  const handleSave = () => {
    onSave(invoice.id, parseFloat(amount), date)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md mx-4 overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Record Payment</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-400" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Invoice #{invoice.invoice_number}</p>
                <p className="text-lg font-semibold text-gray-900 mt-1">{invoice.qbo_customer}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Balance Due</p>
                <p className="text-lg font-bold text-amber-600">{formatCurrency(invoice.balance)}</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-white border border-gray-200 rounded-lg pl-7 pr-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={!amount || parseFloat(amount) <= 0}
            className="px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Record Payment
          </button>
        </div>
      </div>
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

        // Transform invoices to ensure proper field mapping
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

    // Year filter
    if (selectedYear !== 'all') {
      result = result.filter(inv => {
        const year = new Date(inv.invoice_date).getFullYear()
        return year === selectedYear
      })
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(inv => 
        inv.invoice_number?.toString().toLowerCase().includes(q) ||
        inv.qbo_customer?.toLowerCase().includes(q) ||
        clients.find(c => c.id === inv.client_id)?.name?.toLowerCase().includes(q)
      )
    }

    // Status filter
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

    // Client filter
    if (filterClient !== 'all') {
      result = result.filter(inv => inv.client_id === filterClient)
    }

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]
      
      if (sortField === 'invoice_date' || sortField === 'due_date') {
        aVal = new Date(aVal).getTime()
        bVal = new Date(bVal).getTime()
      }
      
      if (sortDir === 'asc') {
        return aVal > bVal ? 1 : -1
      } else {
        return aVal < bVal ? 1 : -1
      }
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

    // DSO calculation
    const paidInvoices = invoices.filter(inv => inv.balance === 0 && inv.paid_date && inv.invoice_date)
    const dso = paidInvoices.length > 0 
      ? paidInvoices.reduce((sum, inv) => {
          const days = Math.floor((new Date(inv.paid_date).getTime() - new Date(inv.invoice_date).getTime()) / (1000 * 60 * 60 * 24))
          return sum + Math.max(0, days)
        }, 0) / paidInvoices.length
      : 0

    // Collection rate (paid within 90 days)
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

    return {
      totalAR,
      unpaidCount: unpaid.length,
      overdueTotal,
      aging,
      dso,
      collectionRate
    }
  }, [invoices])

  // AR by Client
  const arByClient = useMemo(() => {
    const clientAR: { [key: string]: number } = {}
    
    invoices.filter(inv => inv.balance > 0).forEach(inv => {
      const client = clients.find(c => c.id === inv.client_id)
      const clientName = client?.name || inv.qbo_customer || 'Unassigned'
      clientAR[clientName] = (clientAR[clientName] || 0) + inv.balance
    })

    return Object.entries(clientAR)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [invoices, clients])

  // Handlers
  const handleUpdateInvoice = (id: string, updates: any) => {
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates } : inv))
  }

  const handleSelectInvoice = (id: string) => {
    setSelectedInvoices(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedInvoices.length === filteredInvoices.length) {
      setSelectedInvoices([])
    } else {
      setSelectedInvoices(filteredInvoices.map(inv => inv.id))
    }
  }

  const handleRecordPayment = (invoiceId: string, amount: number, date: string) => {
    setInvoices(prev => prev.map(inv => {
      if (inv.id === invoiceId) {
        const newBalance = Math.max(0, inv.balance - amount)
        return { ...inv, balance: newBalance }
      }
      return inv
    }))
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
          <p className="text-gray-500 text-sm">Loading invoices...</p>
        </div>
      </div>
    )
  }

  // Pie chart colors - monochrome with emerald
  const pieColors = [COLORS.emerald, COLORS.gray[500], COLORS.gray[400], COLORS.gray[300], COLORS.gray[200]]

  return (
    <div className="space-y-6 pb-8">
      {/* ============ HEADER ============ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Invoices & AR</h1>
          <p className="text-sm text-gray-500 mt-1">Accounts receivable management & aging analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="appearance-none bg-white border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
            >
              <option value="all">All Time</option>
              {[2026, 2025, 2024, 2023].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors">
            <RefreshCw size={14} />
            Sync QBO
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors">
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      {/* ============ METRICS ============ */}
      <div className="grid grid-cols-5 gap-4">
        <MetricCard
          label="Total AR"
          value={formatCurrency(arMetrics.totalAR)}
          subtitle={`${arMetrics.unpaidCount} unpaid invoices`}
          icon={DollarSign}
          color="amber"
        />
        <MetricCard
          label="Current"
          value={formatCurrency(arMetrics.aging.current.amount)}
          subtitle={`${arMetrics.aging.current.count} invoices`}
          icon={CheckCircle2}
          color="emerald"
        />
        <MetricCard
          label="Overdue"
          value={formatCurrency(arMetrics.overdueTotal)}
          subtitle="Past due date"
          icon={AlertTriangle}
          color="rose"
        />
        <MetricCard
          label="Avg DSO"
          value={`${arMetrics.dso.toFixed(0)} days`}
          subtitle="Days sales outstanding"
          icon={Clock}
          color="blue"
        />
        <MetricCard
          label="Collection Rate"
          value={`${arMetrics.collectionRate.toFixed(0)}%`}
          subtitle="Paid on time (90d)"
          icon={TrendingUp}
          color={arMetrics.collectionRate >= 80 ? 'emerald' : arMetrics.collectionRate >= 60 ? 'amber' : 'rose'}
        />
      </div>

      {/* ============ AGING & CHARTS ============ */}
      <div className="grid grid-cols-12 gap-6">
        {/* Aging Breakdown */}
        <div className="col-span-12 lg:col-span-8">
          <div className="bg-white border border-gray-200 rounded-xl p-6" style={{ boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">AR Aging</h2>
                <p className="text-xs text-gray-400 mt-0.5">Outstanding balance by age</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Total Outstanding</p>
                <p className="text-xl font-semibold text-amber-600">{formatCurrency(arMetrics.totalAR)}</p>
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
          <div className="bg-white border border-gray-200 rounded-xl p-6 h-full" style={{ boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)' }}>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">AR by Client</h2>
            {arByClient.length > 0 ? (
              <>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={arByClient}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={55}
                        paddingAngle={3}
                        dataKey="value"
                      >
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
                        <span className="text-xs text-gray-600 truncate max-w-24">{item.name}</span>
                      </div>
                      <span className="text-xs font-semibold text-gray-900">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No outstanding AR</div>
            )}
          </div>
        </div>
      </div>

      {/* ============ INVOICE TABLE ============ */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)' }}>
        {/* Table Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-gray-900">Invoices</h2>
            <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium text-gray-600">{filteredInvoices.length}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoices..."
                className="bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-1.5 text-sm text-gray-700 w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="all">All Status</option>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
              <option value="current">Current</option>
              <option value="overdue">Overdue</option>
            </select>
            <select
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="all">All Clients</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedInvoices.length > 0 && (
          <div className="flex items-center gap-4 px-6 py-3 bg-emerald-50 border-b border-emerald-100">
            <span className="text-sm font-medium text-emerald-700">{selectedInvoices.length} selected</span>
            <button className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Mark as Paid</button>
            <button className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Assign Client</button>
            <button className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Assign Project</button>
            <button className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Export</button>
          </div>
        )}
        
        {/* Column Headers */}
        <div className="flex items-center gap-3 py-2.5 px-4 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
          <div className="w-8 shrink-0">
            <input
              type="checkbox"
              checked={selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded border-gray-300 bg-white text-emerald-500 focus:ring-emerald-500"
            />
          </div>
          <button onClick={() => handleSort('invoice_number')} className="w-20 shrink-0 flex items-center gap-1 hover:text-gray-700 transition-colors">
            Inv # {sortField === 'invoice_number' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <button onClick={() => handleSort('invoice_date')} className="w-24 shrink-0 flex items-center gap-1 hover:text-gray-700 transition-colors">
            Date {sortField === 'invoice_date' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <button onClick={() => handleSort('due_date')} className="w-24 shrink-0 flex items-center gap-1 hover:text-gray-700 transition-colors">
            Due {sortField === 'due_date' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <div className="w-28 shrink-0">Client</div>
          <div className="w-40 shrink-0">Project</div>
          <div className="flex-1">QBO Customer</div>
          <button onClick={() => handleSort('amount')} className="w-24 text-right shrink-0 flex items-center justify-end gap-1 hover:text-gray-700 transition-colors">
            Amount {sortField === 'amount' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <div className="w-20 text-right shrink-0">Paid</div>
          <button onClick={() => handleSort('balance')} className="w-24 text-right shrink-0 flex items-center justify-end gap-1 hover:text-gray-700 transition-colors">
            Balance {sortField === 'balance' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <div className="w-28 shrink-0">Status</div>
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
                onUpdate={handleUpdateInvoice}
                isSelected={selectedInvoices.includes(invoice.id)}
                onSelect={handleSelectInvoice}
              />
            ))
          ) : (
            <div className="flex items-center justify-center py-12 text-gray-400">
              No invoices found
            </div>
          )}
        </div>

        {/* Footer Summary */}
        <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Showing {filteredInvoices.length} of {invoices.length} invoices
          </p>
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-gray-500">Total Amount: </span>
              <span className="font-semibold text-gray-900">{formatCurrency(filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0))}</span>
            </div>
            <div>
              <span className="text-gray-500">Total Balance: </span>
              <span className="font-semibold text-amber-600">{formatCurrency(filteredInvoices.reduce((sum, inv) => sum + inv.balance, 0))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============ MODALS ============ */}
      <RecordPaymentModal
        isOpen={showPaymentModal}
        onClose={() => { setShowPaymentModal(false); setSelectedInvoiceForPayment(null); }}
        invoice={selectedInvoiceForPayment}
        onSave={handleRecordPayment}
      />
    </div>
  )
}
