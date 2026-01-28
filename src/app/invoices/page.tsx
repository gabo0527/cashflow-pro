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
  'https://jmahfgpbtjeomuepfozf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYWhmZ3BidGplb211ZXBmb3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0OTAxNzcsImV4cCI6MjA4MTA2NjE3N30.3SVDvWCGIYYHV57BpKjpDJVCZLKzuRv8B_VietQDxUQ'
)

// ============ DESIGN SYSTEM ============
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
  slate: {
    50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
    400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155',
    800: '#1e293b', 900: '#0f172a'
  }
}

// Status colors and labels
const STATUS_CONFIG = {
  paid: { label: 'Paid', color: COLORS.emerald, bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  partial: { label: 'Partial', color: COLORS.blue, bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  current: { label: 'Current', color: COLORS.slate[400], bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
  overdue_1_30: { label: 'Overdue', color: COLORS.amber, bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  overdue_31_60: { label: 'Overdue 30+', color: COLORS.orange, bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  overdue_61_90: { label: 'Overdue 60+', color: COLORS.rose, bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  overdue_90_plus: { label: 'Overdue 90+', color: '#be123c', bg: 'bg-rose-600/10', text: 'text-rose-500', border: 'border-rose-600/30' },
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

// Metric Card
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
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', icon: 'text-emerald-500' },
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', icon: 'text-blue-500' },
    rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', icon: 'text-rose-500' },
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', icon: 'text-amber-500' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', icon: 'text-purple-500' },
    slate: { bg: 'bg-slate-500/10', border: 'border-slate-500/20', text: 'text-slate-300', icon: 'text-slate-400' },
    cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400', icon: 'text-cyan-500' }
  }
  const c = colorMap[color]

  return (
    <div className={`${c.bg} ${c.border} border rounded-xl p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">{label}</p>
          <p className={`text-2xl font-bold ${c.text} mt-1`}>{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.value >= 0 ? <TrendingUp size={14} className="text-emerald-500" /> : <TrendingDown size={14} className="text-rose-500" />}
              <span className={`text-xs font-medium ${trend.value >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{Math.abs(trend.value).toFixed(1)}%</span>
              <span className="text-xs text-slate-500">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={`${c.bg} p-2.5 rounded-lg`}>
          <Icon size={20} className={c.icon} />
        </div>
      </div>
    </div>
  )
}

// Status Badge
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

// Aging Bar
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
    <div className="flex items-center gap-4 py-2">
      <div className="w-24 shrink-0">
        <p className="text-sm text-slate-400">{label}</p>
      </div>
      <div className="flex-1 h-5 bg-slate-700/30 rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      <div className="w-28 text-right shrink-0">
        <p className="text-sm font-semibold text-slate-200">{formatCurrency(amount)}</p>
      </div>
      <div className="w-16 text-right shrink-0">
        <p className="text-xs text-slate-500">{count} inv</p>
      </div>
      <div className="w-12 text-right shrink-0">
        <p className="text-xs text-slate-400">{percent.toFixed(0)}%</p>
      </div>
    </div>
  )
}

// Custom Tooltip
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

// Editable Select Component
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
        className="flex items-center gap-1 text-sm text-slate-300 hover:text-slate-100 transition-colors group"
      >
        <span className={selectedOption ? '' : 'text-slate-500 italic'}>{selectedOption?.name || placeholder}</span>
        <Edit2 size={12} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
            <div className="p-2 border-b border-slate-700">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full bg-slate-700/50 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              <button
                onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }}
                className="w-full px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-700/50 transition-colors"
              >
                — None —
              </button>
              {filteredOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { onChange(opt.id); setIsOpen(false); setSearch(''); }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 transition-colors ${
                    opt.id === value ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-300'
                  }`}
                >
                  {opt.name}
                </button>
              ))}
              {filteredOptions.length === 0 && (
                <p className="px-3 py-2 text-sm text-slate-500">No matches</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Invoice Row Component
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
    <div className={`flex items-center gap-3 py-3 px-4 hover:bg-slate-800/30 transition-colors border-b border-slate-700/30 ${isSelected ? 'bg-emerald-500/5' : ''}`}>
      {/* Checkbox */}
      <div className="w-8 shrink-0">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(invoice.id)}
          className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
        />
      </div>
      
      {/* Invoice # */}
      <div className="w-20 shrink-0">
        <p className="text-sm font-medium text-emerald-400">#{invoice.invoice_number}</p>
      </div>
      
      {/* Date */}
      <div className="w-24 shrink-0">
        <p className="text-sm text-slate-400">{formatDateShort(invoice.invoice_date)}</p>
      </div>
      
      {/* Due Date */}
      <div className="w-24 shrink-0">
        <p className={`text-sm ${status.includes('overdue') ? 'text-rose-400' : 'text-slate-400'}`}>
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
        <p className="text-xs text-slate-500 truncate" title={invoice.qbo_customer}>
          {invoice.qbo_customer || '—'}
        </p>
      </div>
      
      {/* Amount */}
      <div className="w-24 text-right shrink-0">
        <p className="text-sm font-medium text-slate-200">{formatCurrency(invoice.amount)}</p>
      </div>
      
      {/* Paid */}
      <div className="w-20 text-right shrink-0">
        <p className="text-sm text-slate-500">{formatCurrency(invoice.amount - invoice.balance)}</p>
      </div>
      
      {/* Balance */}
      <div className="w-24 text-right shrink-0">
        <p className={`text-sm font-semibold ${invoice.balance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
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
            className="px-2 py-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors"
            title="Record Payment"
          >
            + Pay
          </button>
        )}
        <button className="p-1 hover:bg-slate-700 rounded transition-colors" title="More actions">
          <MoreHorizontal size={16} className="text-slate-500" />
        </button>
      </div>
    </div>
  )
}

// Record Payment Modal
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100">Record Payment</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-lg transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="bg-slate-700/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Invoice #{invoice.invoice_number}</p>
                <p className="text-lg font-semibold text-slate-100 mt-1">{invoice.qbo_customer}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">Balance Due</p>
                <p className="text-lg font-bold text-amber-400">{formatCurrency(invoice.balance)}</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Payment Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-7 pr-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Payment Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700 bg-slate-800/50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors">
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
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterClient, setFilterClient] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<any>(null)
  const [sortField, setSortField] = useState<string>('due_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Sample clients - will connect to your clients table
  const [clients, setClients] = useState([
    { id: 'c1', name: 'GOOGL' },
    { id: 'c2', name: 'YONDR' },
    { id: 'c3', name: 'SDP' },
    { id: 'c4', name: 'CADC' },
    { id: 'c5', name: 'P1' },
  ])

  // Sample projects - will connect to your projects table
  const [projects, setProjects] = useState([
    { id: 'p1', name: 'gCLS - Doc Control', client_id: 'c1' },
    { id: 'p2', name: 'gCLS - QA/QC', client_id: 'c1' },
    { id: 'p3', name: 'gCLS - Commissioning', client_id: 'c1' },
    { id: 'p4', name: 'Yondr Supply Chain', client_id: 'c2' },
    { id: 'p5', name: 'SDP Buildout', client_id: 'c3' },
    { id: 'p6', name: 'CADC Phase 1', client_id: 'c4' },
    { id: 'p7', name: 'P1 - OFCI Management', client_id: 'c5' },
  ])

  // Sample invoices (matches your screenshot)
  const [invoices, setInvoices] = useState([
    { id: '1', invoice_number: '5166', invoice_date: '2025-11-29', due_date: '2026-01-28', qbo_customer: 'Google Cable Landing Stations', amount: 76170, balance: 76170, client_id: 'c1', project_id: 'p1' },
    { id: '2', invoice_number: '5165', invoice_date: '2025-11-29', due_date: '2026-01-28', qbo_customer: 'Google Cable Landing Stations', amount: 62575, balance: 62575, client_id: 'c1', project_id: 'p2' },
    { id: '3', invoice_number: '5160', invoice_date: '2025-11-29', due_date: '2026-01-28', qbo_customer: 'Google Cable Landing Stations', amount: 84644, balance: 84644, client_id: 'c1', project_id: '' },
    { id: '4', invoice_number: '5162', invoice_date: '2025-11-29', due_date: '2026-01-28', qbo_customer: 'Google Cable Landing Stations', amount: 78330, balance: 78330, client_id: 'c1', project_id: '' },
    { id: '5', invoice_number: '5161', invoice_date: '2025-11-29', due_date: '2026-01-28', qbo_customer: 'Google Cable Landing Stations', amount: 30673, balance: 30673, client_id: 'c1', project_id: '' },
    { id: '6', invoice_number: '5159', invoice_date: '2025-11-29', due_date: '2025-12-29', qbo_customer: 'CADC', amount: 2700, balance: 0, client_id: 'c4', project_id: 'p6' },
    { id: '7', invoice_number: '5152', invoice_date: '2025-11-29', due_date: '2025-12-29', qbo_customer: 'SDP', amount: 29050, balance: 29050, client_id: 'c3', project_id: 'p5' },
    { id: '8', invoice_number: '5141', invoice_date: '2025-10-27', due_date: '2025-12-11', qbo_customer: 'Yondr Supply Chain Support', amount: 7787, balance: 7787, client_id: 'c2', project_id: 'p4' },
    { id: '9', invoice_number: '5147', invoice_date: '2025-10-30', due_date: '2025-11-29', qbo_customer: 'P1 - OFCI & Schedule Management', amount: 29151, balance: 29151, client_id: 'c5', project_id: 'p7' },
    { id: '10', invoice_number: '5133', invoice_date: '2025-09-29', due_date: '2025-10-29', qbo_customer: 'P1 - OFCI & Schedule Management', amount: 26683, balance: 26683, client_id: 'c5', project_id: 'p7' },
    { id: '11', invoice_number: '5132', invoice_date: '2025-09-29', due_date: '2025-10-29', qbo_customer: 'P1 - OFCI & Schedule Management', amount: 6643, balance: 6642, client_id: 'c5', project_id: 'p7' },
  ])

  useEffect(() => {
    setTimeout(() => setLoading(false), 500)
  }, [])

  // Calculate AR metrics
  const arMetrics = useMemo(() => {
    const unpaidInvoices = invoices.filter(inv => inv.balance > 0)
    const totalAR = unpaidInvoices.reduce((sum, inv) => sum + inv.balance, 0)
    
    // Aging buckets
    const aging = {
      current: { amount: 0, count: 0 },
      days_1_30: { amount: 0, count: 0 },
      days_31_60: { amount: 0, count: 0 },
      days_61_90: { amount: 0, count: 0 },
      days_90_plus: { amount: 0, count: 0 },
    }
    
    unpaidInvoices.forEach(inv => {
      const status = getInvoiceStatus(inv.due_date, inv.amount, inv.balance)
      if (status === 'current') { aging.current.amount += inv.balance; aging.current.count++ }
      else if (status === 'overdue_1_30') { aging.days_1_30.amount += inv.balance; aging.days_1_30.count++ }
      else if (status === 'overdue_31_60') { aging.days_31_60.amount += inv.balance; aging.days_31_60.count++ }
      else if (status === 'overdue_61_90') { aging.days_61_90.amount += inv.balance; aging.days_61_90.count++ }
      else if (status === 'overdue_90_plus') { aging.days_90_plus.amount += inv.balance; aging.days_90_plus.count++ }
    })
    
    const overdueTotal = aging.days_1_30.amount + aging.days_31_60.amount + aging.days_61_90.amount + aging.days_90_plus.amount
    
    // Calculate DSO
    const totalSales = invoices.reduce((sum, inv) => sum + inv.amount, 0)
    const dso = totalSales > 0 ? (totalAR / totalSales) * 365 : 0
    
    // Collection rate
    const last90Days = new Date()
    last90Days.setDate(last90Days.getDate() - 90)
    const recentInvoices = invoices.filter(inv => new Date(inv.invoice_date) >= last90Days)
    const paidOnTime = recentInvoices.filter(inv => {
      const status = getInvoiceStatus(inv.due_date, inv.amount, inv.balance)
      return status === 'paid'
    }).length
    const collectionRate = recentInvoices.length > 0 ? (paidOnTime / recentInvoices.length) * 100 : 0
    
    return { totalAR, aging, overdueTotal, dso, collectionRate, unpaidCount: unpaidInvoices.length }
  }, [invoices])

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    let filtered = [...invoices]
    
    if (selectedYear !== 'all') {
      filtered = filtered.filter(inv => new Date(inv.invoice_date).getFullYear() === selectedYear)
    }
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(inv => {
        const status = getInvoiceStatus(inv.due_date, inv.amount, inv.balance)
        if (filterStatus === 'unpaid') return inv.balance > 0
        if (filterStatus === 'paid') return status === 'paid'
        if (filterStatus === 'overdue') return status.includes('overdue')
        if (filterStatus === 'current') return status === 'current'
        return true
      })
    }
    
    if (filterClient !== 'all') {
      filtered = filtered.filter(inv => inv.client_id === filterClient)
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(inv => 
        inv.invoice_number.toLowerCase().includes(q) ||
        inv.qbo_customer.toLowerCase().includes(q) ||
        clients.find(c => c.id === inv.client_id)?.name.toLowerCase().includes(q) ||
        projects.find(p => p.id === inv.project_id)?.name.toLowerCase().includes(q)
      )
    }
    
    filtered.sort((a, b) => {
      let aVal: any = a[sortField as keyof typeof a]
      let bVal: any = b[sortField as keyof typeof b]
      if (sortField === 'due_date' || sortField === 'invoice_date') {
        aVal = new Date(aVal as string).getTime()
        bVal = new Date(bVal as string).getTime()
      }
      if (sortDir === 'asc') return aVal > bVal ? 1 : -1
      return aVal < bVal ? 1 : -1
    })
    
    return filtered
  }, [invoices, selectedYear, filterStatus, filterClient, searchQuery, sortField, sortDir, clients, projects])

  // AR by client chart data
  const arByClient = useMemo(() => {
    const byClient: { [key: string]: number } = {}
    invoices.filter(inv => inv.balance > 0).forEach(inv => {
      const clientName = clients.find(c => c.id === inv.client_id)?.name || 'Unassigned'
      byClient[clientName] = (byClient[clientName] || 0) + inv.balance
    })
    return Object.entries(byClient)
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
          <p className="text-slate-400 text-sm">Loading invoices...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* ============ HEADER ============ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Invoices & AR</h1>
          <p className="text-sm text-slate-400 mt-1">Accounts receivable management & aging analysis</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            <option value="all">All Time</option>
            {[2026, 2025, 2024, 2023].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <button className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:border-slate-600 transition-colors">
            <RefreshCw size={16} />
            Sync QBO
          </button>
          <button className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:border-slate-600 transition-colors">
            <Download size={16} />
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
      <div className="grid grid-cols-12 gap-4">
        {/* Aging Breakdown */}
        <div className="col-span-12 lg:col-span-8">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">AR Aging</h2>
                <p className="text-sm text-slate-500 mt-0.5">Outstanding balance by age</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">Total Outstanding</p>
                <p className="text-xl font-bold text-amber-400">{formatCurrency(arMetrics.totalAR)}</p>
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
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 h-full">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">AR by Client</h2>
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
                          <Cell key={`cell-${index}`} fill={[COLORS.amber, COLORS.blue, COLORS.purple, COLORS.cyan, COLORS.emerald][index % 5]} />
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
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: [COLORS.amber, COLORS.blue, COLORS.purple, COLORS.cyan, COLORS.emerald][i % 5] }} />
                        <span className="text-xs text-slate-400">{item.name}</span>
                      </div>
                      <span className="text-xs font-medium text-slate-200">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No outstanding AR</div>
            )}
          </div>
        </div>
      </div>

      {/* ============ INVOICE TABLE ============ */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        {/* Table Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-5 py-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-100">Invoices</h2>
            <span className="px-2 py-0.5 bg-slate-700 rounded text-xs font-medium text-slate-300">{filteredInvoices.length}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoices..."
                className="bg-slate-700/50 border border-slate-600 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 w-48 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
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
              className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
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
          <div className="flex items-center gap-4 px-5 py-3 bg-emerald-500/10 border-b border-emerald-500/20">
            <span className="text-sm text-emerald-400">{selectedInvoices.length} selected</span>
            <button className="text-sm text-slate-300 hover:text-white transition-colors">Mark as Paid</button>
            <button className="text-sm text-slate-300 hover:text-white transition-colors">Assign Client</button>
            <button className="text-sm text-slate-300 hover:text-white transition-colors">Assign Project</button>
            <button className="text-sm text-slate-300 hover:text-white transition-colors">Export</button>
          </div>
        )}
        
        {/* Column Headers */}
        <div className="flex items-center gap-3 py-2 px-4 bg-slate-800/80 border-b border-slate-700/50 text-xs font-medium text-slate-500 uppercase tracking-wider">
          <div className="w-8 shrink-0">
            <input
              type="checkbox"
              checked={selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
            />
          </div>
          <button onClick={() => handleSort('invoice_number')} className="w-20 shrink-0 flex items-center gap-1 hover:text-slate-300 transition-colors">
            Inv # {sortField === 'invoice_number' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <button onClick={() => handleSort('invoice_date')} className="w-24 shrink-0 flex items-center gap-1 hover:text-slate-300 transition-colors">
            Date {sortField === 'invoice_date' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <button onClick={() => handleSort('due_date')} className="w-24 shrink-0 flex items-center gap-1 hover:text-slate-300 transition-colors">
            Due {sortField === 'due_date' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <div className="w-28 shrink-0">Client</div>
          <div className="w-40 shrink-0">Project</div>
          <div className="flex-1">QBO Customer</div>
          <button onClick={() => handleSort('amount')} className="w-24 text-right shrink-0 flex items-center justify-end gap-1 hover:text-slate-300 transition-colors">
            Amount {sortField === 'amount' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <div className="w-20 text-right shrink-0">Paid</div>
          <button onClick={() => handleSort('balance')} className="w-24 text-right shrink-0 flex items-center justify-end gap-1 hover:text-slate-300 transition-colors">
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
            <div className="flex items-center justify-center py-12 text-slate-500">
              No invoices found
            </div>
          )}
        </div>

        {/* Footer Summary */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-800/80 border-t border-slate-700/50">
          <p className="text-sm text-slate-400">
            Showing {filteredInvoices.length} of {invoices.length} invoices
          </p>
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-slate-500">Total Amount: </span>
              <span className="font-semibold text-slate-200">{formatCurrency(filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0))}</span>
            </div>
            <div>
              <span className="text-slate-500">Total Balance: </span>
              <span className="font-semibold text-amber-400">{formatCurrency(filteredInvoices.reduce((sum, inv) => sum + inv.balance, 0))}</span>
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
