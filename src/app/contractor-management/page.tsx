'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  FileText, Receipt, Search, Filter, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Clock, DollarSign, Download, Eye, Paperclip, User, Building2,
  AlertCircle, Loader2, X, MoreHorizontal, Calendar, TrendingUp, TrendingDown,
  CreditCard, ArrowUpRight, ExternalLink
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart as RechartsPie, Pie
} from 'recharts'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jmahfgpbtjeomuepfozf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYWhmZ3BidGplb211ZXBmb3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0OTAxNzcsImV4cCI6MjA4MTA2NjE3N30.3SVDvWCGIYYHV57BpKjpDJVCZLKzuRv8B_VietQDxUQ'
)

// ============ DESIGN SYSTEM — Light Slate + Emerald ============
const THEME = {
  card: 'bg-white border-gray-200',
  cardHover: 'hover:bg-gray-50',
  border: 'border-gray-200',
  textPrimary: 'text-gray-900',
  textSecondary: 'text-gray-600',
  textMuted: 'text-gray-500',
  textDim: 'text-gray-400',
}

// ============ TYPES ============
interface ContractorInvoice {
  id: string
  team_member_id: string
  invoice_number: string
  invoice_date: string
  due_date: string
  period_start: string
  period_end: string
  total_amount: number
  status: string
  payment_terms: string
  receipt_url: string | null
  notes: string | null
  submitted_at: string
  reviewed_at: string | null
  paid_at: string | null
  contractor_invoice_lines: InvoiceLine[]
}

interface InvoiceLine {
  id: string
  invoice_id: string
  client_id: string
  project_id: string | null
  description: string
  hours: number | null
  rate: number | null
  amount: number
  allocation_pct: number | null
}

interface ContractorExpense {
  id: string
  team_member_id: string
  project_id: string | null
  client_id: string | null
  date: string
  category: string
  description: string
  amount: number
  receipt_url: string | null
  status: string
  submitted_at: string
  reviewed_at: string | null
  notes: string | null
}

interface TeamMember { id: string; name: string; email: string }
interface Client { id: string; name: string }
interface Project { id: string; name: string; client_id: string }

// ============ HELPERS ============
const formatCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
const formatDate = (d: string) => { if (!d) return '—'; return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
const formatDateCompact = (d: string) => { if (!d) return '—'; return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }

// [FIX #1] Light-theme status badges
const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon: any }> = {
  submitted: { label: 'Submitted', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: Clock },
  pending: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: Clock },
  approved: { label: 'Approved', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle },
  rejected: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: XCircle },
  paid: { label: 'Paid', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', icon: DollarSign },
}

const EXPENSE_CATEGORIES: Record<string, { label: string }> = {
  travel: { label: 'Travel' },
  hotel: { label: 'Hotel' },
  meal: { label: 'Meal' },
  transportation: { label: 'Transportation' },
  software_equipment: { label: 'Software / Equipment' },
  materials: { label: 'Materials' },
  software: { label: 'Software' },
  meals: { label: 'Meals' },
  equipment: { label: 'Equipment' },
  other: { label: 'Other' },
}

// ============ STATUS BADGE ============
function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}>
      <config.icon size={10} />
      {config.label}
    </span>
  )
}

// [FIX #1] MetricCard — compact, light theme, amber highlight for pending
function MetricCard({ label, value, sub, icon: Icon, accentColor = '#059669', highlight = false }: {
  label: string; value: string; sub?: string; icon: any; accentColor?: string; highlight?: boolean
}) {
  return (
    <div className={`vCard relative p-4 rounded-xl border overflow-hidden shadow-sm ${highlight ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-gray-200'}`}>
      <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full" style={{ backgroundColor: accentColor }} />
      <div className="pl-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className={`vLbl text-[10px] font-bold uppercase ${highlight ? 'text-amber-600' : THEME.textDim}`}>{label}</span>
          <Icon size={15} className={highlight ? 'text-amber-500' : THEME.textDim} />
        </div>
        <p className={`text-2xl font-semibold vN ${highlight ? 'text-amber-700' : 'text-gray-900'}`}>{value}</p>
        {sub && <p className={`text-xs mt-0.5 ${highlight ? 'text-amber-600' : THEME.textDim}`}>{sub}</p>}
      </div>
    </div>
  )
}

// ============ SHARED STYLES ============
// [FIX #10] Active filter gets emerald tint
const getSelectClass = (isActive: boolean) =>
  `px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-colors cursor-pointer ${
    isActive ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-white border-gray-200 text-gray-700'
  }`

// [FIX #4] Optimized grid — merged Attachment into Actions
const invoiceGridCols = 'grid-cols-[1fr_130px_90px_110px_100px_200px]'
const expenseGridCols = 'grid-cols-[1fr_130px_100px_80px_100px_200px]'

// [FIX #2] Row urgency border
function getRowBorder(status: string): string {
  if (status === 'submitted' || status === 'pending') return 'border-l-2 border-l-amber-400'
  if (status === 'approved') return 'border-l-2 border-l-emerald-400'
  return 'border-l-2 border-l-transparent'
}

// ============ MAIN COMPONENT ============
export default function ContractorManagement() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'expenses'>('invoices')
  const [loading, setLoading] = useState(true)

  // Data
  const [invoices, setInvoices] = useState<ContractorInvoice[]>([])
  const [expenses, setExpenses] = useState<ContractorExpense[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterMember, setFilterMember] = useState('all')
  const [filterClient, setFilterClient] = useState('all')
  const [groupBy, setGroupBy] = useState<'none' | 'contractor' | 'client'>('none')

  // Date range
  const [dateRange, setDateRange] = useState<'month' | 'quarter' | 'year' | 'all'>('month')
  const [refDate, setRefDate] = useState(new Date())

  // Invoice detail
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null)

  // Attachment preview — multi-file navigation
  const [previewFiles, setPreviewFiles] = useState<string[]>([])
  const [previewIndex, setPreviewIndex] = useState(0)
  const previewUrl = previewFiles.length > 0 ? previewFiles[previewIndex] : null

  // Action state
  const [processing, setProcessing] = useState<string | null>(null)

  const memberMap = useMemo(() => { const m: Record<string, string> = {}; teamMembers.forEach(t => { m[t.id] = t.name }); return m }, [teamMembers])
  const clientMap = useMemo(() => { const m: Record<string, string> = {}; clients.forEach(c => { m[c.id] = c.name }); return m }, [clients])
  const projectMap = useMemo(() => { const m: Record<string, string> = {}; projects.forEach(p => { m[p.id] = p.name }); return m }, [projects])

  // Date range calculation
  const dateFilter = useMemo(() => {
    const d = refDate
    if (dateRange === 'month') {
      const start = new Date(d.getFullYear(), d.getMonth(), 1)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0], label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }
    }
    if (dateRange === 'quarter') {
      const q = Math.floor(d.getMonth() / 3)
      const start = new Date(d.getFullYear(), q * 3, 1)
      const end = new Date(d.getFullYear(), q * 3 + 3, 0)
      return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0], label: `Q${q + 1} ${d.getFullYear()}` }
    }
    if (dateRange === 'year') {
      return { start: `${d.getFullYear()}-01-01`, end: `${d.getFullYear()}-12-31`, label: `${d.getFullYear()}` }
    }
    return { start: '2020-01-01', end: '2099-12-31', label: 'All Time' }
  }, [dateRange, refDate])

  // Navigate date
  const navigateDate = (dir: -1 | 1) => {
    const d = new Date(refDate)
    if (dateRange === 'month') d.setMonth(d.getMonth() + dir)
    else if (dateRange === 'quarter') d.setMonth(d.getMonth() + dir * 3)
    else if (dateRange === 'year') d.setFullYear(d.getFullYear() + dir)
    setRefDate(d)
  }

  // [FIX #10] Check if any filter is active
  const hasActiveFilters = filterStatus !== 'all' || filterMember !== 'all' || filterClient !== 'all' || searchQuery !== ''
  const clearFilters = () => { setSearchQuery(''); setFilterStatus('all'); setFilterMember('all'); setFilterClient('all') }

  // ============ LOAD DATA ============
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [invRes, expRes, teamRes, clientRes, projRes] = await Promise.all([
        supabase.from('contractor_invoices').select('*, contractor_invoice_lines(*)').order('submitted_at', { ascending: false }),
        supabase.from('contractor_expenses').select('*').order('date', { ascending: false }),
        supabase.from('team_members').select('id, name, email').eq('status', 'active'),
        supabase.from('clients').select('id, name'),
        supabase.from('projects').select('id, name, client_id'),
      ])
      setInvoices(invRes.data || [])
      setExpenses(expRes.data || [])
      setTeamMembers(teamRes.data || [])
      setClients(clientRes.data || [])
      setProjects(projRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  // ============ FILTERED INVOICES ============
  const filteredInvoices = useMemo(() => {
    let result = [...invoices]
    if (dateRange !== 'all') {
      result = result.filter(inv => inv.period_start >= dateFilter.start && inv.period_end <= dateFilter.end)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(inv =>
        inv.invoice_number.toLowerCase().includes(q) ||
        (memberMap[inv.team_member_id] || '').toLowerCase().includes(q)
      )
    }
    if (filterStatus !== 'all') result = result.filter(inv => inv.status === filterStatus)
    if (filterMember !== 'all') result = result.filter(inv => inv.team_member_id === filterMember)
    if (filterClient !== 'all') {
      result = result.filter(inv => inv.contractor_invoice_lines?.some((l: any) => l.client_id === filterClient))
    }
    return result
  }, [invoices, dateFilter, dateRange, searchQuery, filterStatus, filterMember, filterClient, memberMap])

  // ============ GROUPED INVOICES ============
  const groupedInvoices = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'all', label: '', invoices: filteredInvoices, total: filteredInvoices.reduce((s, i) => s + i.total_amount, 0) }]
    const groups: Record<string, { label: string; invoices: ContractorInvoice[]; total: number }> = {}
    filteredInvoices.forEach(inv => {
      if (groupBy === 'contractor') {
        const key = inv.team_member_id
        const label = memberMap[key] || 'Unknown'
        if (!groups[key]) groups[key] = { label, invoices: [], total: 0 }
        groups[key].invoices.push(inv)
        groups[key].total += inv.total_amount
      } else {
        const lines = inv.contractor_invoice_lines || []
        if (lines.length === 0) {
          const key = '_unassigned'
          if (!groups[key]) groups[key] = { label: 'Unassigned', invoices: [], total: 0 }
          if (!groups[key].invoices.find(i => i.id === inv.id)) groups[key].invoices.push(inv)
          groups[key].total += inv.total_amount
        } else {
          const clientTotals: Record<string, number> = {}
          lines.forEach((l: any) => { clientTotals[l.client_id] = (clientTotals[l.client_id] || 0) + l.amount })
          const primaryClient = Object.entries(clientTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || '_unassigned'
          const key = primaryClient
          const label = clientMap[key] || 'Unknown'
          if (!groups[key]) groups[key] = { label, invoices: [], total: 0 }
          groups[key].invoices.push(inv)
          groups[key].total += inv.total_amount
        }
      }
    })
    return Object.entries(groups).sort((a, b) => b[1].total - a[1].total).map(([key, g]) => ({ key, ...g }))
  }, [filteredInvoices, groupBy, memberMap, clientMap])

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const toggleGroup = (key: string) => setCollapsedGroups(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  // ============ FILTERED EXPENSES ============
  const filteredExpenses = useMemo(() => {
    let result = [...expenses]
    if (dateRange !== 'all') {
      result = result.filter(exp => exp.date >= dateFilter.start && exp.date <= dateFilter.end)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(exp =>
        exp.description.toLowerCase().includes(q) ||
        (memberMap[exp.team_member_id] || '').toLowerCase().includes(q)
      )
    }
    if (filterStatus !== 'all') result = result.filter(exp => exp.status === filterStatus)
    if (filterMember !== 'all') result = result.filter(exp => exp.team_member_id === filterMember)
    if (filterClient !== 'all') result = result.filter(exp => exp.client_id === filterClient)
    return result
  }, [expenses, dateFilter, dateRange, searchQuery, filterStatus, filterMember, filterClient, memberMap])

  // ============ METRICS ============
  const invoiceMetrics = useMemo(() => {
    const pending = filteredInvoices.filter(i => i.status === 'submitted')
    const approved = filteredInvoices.filter(i => i.status === 'approved')
    const paid = filteredInvoices.filter(i => i.status === 'paid')
    const total = filteredInvoices.reduce((s, i) => s + i.total_amount, 0)
    const pendingAmt = pending.reduce((s, i) => s + i.total_amount, 0)
    const approvedAmt = approved.reduce((s, i) => s + i.total_amount, 0)
    const paidAmt = paid.reduce((s, i) => s + i.total_amount, 0)
    return { total, pendingCount: pending.length, pendingAmt, approvedAmt, paidAmt }
  }, [filteredInvoices])

  const expenseMetrics = useMemo(() => {
    const pending = filteredExpenses.filter(e => e.status === 'pending')
    const approved = filteredExpenses.filter(e => e.status === 'approved')
    const total = filteredExpenses.reduce((s, e) => s + e.amount, 0)
    const pendingAmt = pending.reduce((s, e) => s + e.amount, 0)
    return { total, pendingCount: pending.length, pendingAmt, approvedAmt: approved.reduce((s, e) => s + e.amount, 0) }
  }, [filteredExpenses])

  // ============ ACTIONS ============
  const updateInvoiceStatus = async (id: string, status: string) => {
    setProcessing(id)
    const updates: any = { status, reviewed_at: new Date().toISOString() }
    if (status === 'paid') updates.paid_at = new Date().toISOString()
    const { error } = await supabase.from('contractor_invoices').update(updates).eq('id', id)
    if (!error) {
      setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates } : inv))
    }
    setProcessing(null)
  }

  const updateExpenseStatus = async (id: string, status: string) => {
    setProcessing(id)
    const updates: any = { status, reviewed_at: new Date().toISOString() }
    const { error } = await supabase.from('contractor_expenses').update(updates).eq('id', id)
    if (!error) {
      setExpenses(prev => prev.map(exp => exp.id === id ? { ...exp, ...updates } : exp))
    }
    setProcessing(null)
  }

  // [FIX #3] Bulk approve all pending invoices
  const bulkApproveInvoices = async () => {
    const pendingInvs = filteredInvoices.filter(i => i.status === 'submitted')
    setProcessing('bulk')
    for (const inv of pendingInvs) {
      const updates = { status: 'approved', reviewed_at: new Date().toISOString() }
      const { error } = await supabase.from('contractor_invoices').update(updates).eq('id', inv.id)
      if (!error) {
        setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, ...updates } : i))
      }
    }
    setProcessing(null)
  }

  // [FIX #3] Bulk approve all pending expenses
  const bulkApproveExpenses = async () => {
    const pendingExps = filteredExpenses.filter(e => e.status === 'pending')
    setProcessing('bulk')
    for (const exp of pendingExps) {
      const updates = { status: 'approved', reviewed_at: new Date().toISOString() }
      const { error } = await supabase.from('contractor_expenses').update(updates).eq('id', exp.id)
      if (!error) {
        setExpenses(prev => prev.map(e => e.id === exp.id ? { ...e, ...updates } : e))
      }
    }
    setProcessing(null)
  }

  /** Resolve signed URLs for ALL files in a comma-separated receipt_url */
  const openPreview = async (path: string) => {
    const paths = path.split(',').map(p => p.trim()).filter(Boolean)
    const resolvedUrls: string[] = []

    for (const filePath of paths) {
      let url: string | null = null
      const { data } = await supabase.storage.from('contractor-uploads').createSignedUrl(filePath, 3600)
      if (data?.signedUrl) { url = data.signedUrl }
      if (!url) {
        const { data: d2 } = await supabase.storage.from('public').createSignedUrl(filePath, 3600)
        if (d2?.signedUrl) url = d2.signedUrl
      }
      if (!url) {
        const { data: d3 } = await supabase.storage.from('Receipts').createSignedUrl(filePath, 3600)
        if (d3?.signedUrl) url = d3.signedUrl
      }
      if (!url) {
        const { data: d4 } = supabase.storage.from('contractor-uploads').getPublicUrl(filePath)
        if (d4?.publicUrl) url = d4.publicUrl
      }
      if (url) resolvedUrls.push(url)
    }

    if (resolvedUrls.length > 0) {
      setPreviewFiles(resolvedUrls)
      setPreviewIndex(0)
    }
  }

  const closePreview = () => { setPreviewFiles([]); setPreviewIndex(0) }

  // ============ RENDER ============
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={22} className="text-emerald-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Contractor Management</h1>
          <p className={`text-[13px] mt-1 ${THEME.textDim}`}>AP invoices and expenses from your team</p>
        </div>
        <a href="/timesheet" target="_blank" rel="noopener noreferrer"
          className={`flex items-center gap-2 px-4 py-2 ${THEME.card} border hover:bg-gray-50 rounded-lg text-gray-600 text-sm transition-colors`}>
          <ExternalLink size={14} /> Contractor Portal
        </a>
      </div>

      {/* Tabs */}
      <div className={`flex items-center gap-0 border-b ${THEME.border}`}>
        {[
          { id: 'invoices' as const, label: 'AP Invoices', icon: FileText, count: invoiceMetrics.pendingCount },
          { id: 'expenses' as const, label: 'Expenses', icon: Receipt, count: expenseMetrics.pendingCount },
        ].map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); clearFilters() }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium vBtn border-b-2 -mb-px transition-all duration-300 ${
              activeTab === tab.id ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300'
            }`}>
            <tab.icon size={15} />
            {tab.label}
            {tab.count > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ===================== AP INVOICES TAB ===================== */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          {/* Metrics — [FIX #1] Pending card highlighted */}
          <div className="grid grid-cols-4 gap-3">
            <MetricCard label="Total AP" value={formatCurrency(invoiceMetrics.total)} icon={DollarSign} accentColor="#2563eb" sub={`${filteredInvoices.length} invoices`} />
            <MetricCard label="Pending Review" value={formatCurrency(invoiceMetrics.pendingAmt)} icon={Clock} accentColor="#d97706" sub={`${invoiceMetrics.pendingCount} awaiting`} highlight={invoiceMetrics.pendingCount > 0} />
            <MetricCard label="Approved" value={formatCurrency(invoiceMetrics.approvedAmt)} icon={CheckCircle} accentColor="#059669" />
            <MetricCard label="Paid" value={formatCurrency(invoiceMetrics.paidAmt)} icon={CreditCard} accentColor="#059669" />
          </div>

          {/* [FIX #3] Batch action bar for pending invoices */}
          {invoiceMetrics.pendingCount > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-amber-600" />
                <span className="text-sm text-amber-800 font-medium">{invoiceMetrics.pendingCount} invoice{invoiceMetrics.pendingCount !== 1 ? 's' : ''} pending review — {formatCurrency(invoiceMetrics.pendingAmt)} total</span>
              </div>
              <button onClick={bulkApproveInvoices} disabled={processing === 'bulk'}
                className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 disabled:opacity-50 vBtn flex items-center gap-1.5">
                {processing === 'bulk' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                Approve All
              </button>
            </div>
          )}

          {/* [FIX #7] Filters + Date Range + Group By — date moved inline */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-xs">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search invoices..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" />
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={getSelectClass(filterStatus !== 'all')}>
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="paid">Paid</option>
              </select>
              <select value={filterMember} onChange={e => setFilterMember(e.target.value)} className={getSelectClass(filterMember !== 'all')}>
                <option value="all">All Contractors</option>
                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className={getSelectClass(filterClient !== 'all')}>
                <option value="all">All Clients</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {/* [FIX #10] Clear filters button */}
              {hasActiveFilters && (
                <button onClick={clearFilters} className="px-2.5 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 vBtn flex items-center gap-1">
                  <X size={12} /> Clear
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Date range */}
              <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 rounded-lg border border-gray-200">
                {['month', 'quarter', 'year', 'all'].map(r => (
                  <button key={r} onClick={() => setDateRange(r as any)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${dateRange === r ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
                    {r === 'all' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
              {dateRange !== 'all' && (
                <div className="flex items-center gap-1">
                  <button onClick={() => navigateDate(-1)} className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"><ChevronLeft size={14} /></button>
                  <span className="text-gray-900 text-sm font-medium px-3 py-1.5 bg-white border border-gray-200 rounded-lg min-w-[120px] text-center vN">{dateFilter.label}</span>
                  <button onClick={() => navigateDate(1)} className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"><ChevronRight size={14} /></button>
                </div>
              )}
              {/* Group by */}
              <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 rounded-lg border border-gray-200">
                <span className="text-[10px] text-gray-400 px-1.5 uppercase tracking-wider">Group:</span>
                {[{ id: 'none' as const, label: 'None' }, { id: 'contractor' as const, label: 'Contractor' }, { id: 'client' as const, label: 'Client' }].map(g => (
                  <button key={g.id} onClick={() => { setGroupBy(g.id); setCollapsedGroups(new Set()) }}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${groupBy === g.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Invoice List (grouped) */}
          {filteredInvoices.length > 0 ? groupedInvoices.map(group => {
            // [FIX #6] Count pending in each group
            const groupPending = group.invoices.filter(i => i.status === 'submitted').length
            return (
            <div key={group.key} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              {/* [FIX #6] Group header with status breakdown */}
              {groupBy !== 'none' && (
                <button onClick={() => toggleGroup(group.key)}
                  className={`w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors border-b border-gray-200`}>
                  <div className="flex items-center gap-3">
                    {collapsedGroups.has(group.key) ? <ChevronRight size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                    <span className="text-gray-900 text-sm font-semibold">{group.label}</span>
                    <span className="text-gray-400 text-xs">{group.invoices.length} invoice{group.invoices.length !== 1 ? 's' : ''}</span>
                    {groupPending > 0 && (
                      <span className="text-amber-700 text-xs font-medium bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">{groupPending} pending</span>
                    )}
                  </div>
                  <span className="text-gray-900 text-sm font-semibold vN">{formatCurrency(group.total)}</span>
                </button>
              )}
              {!collapsedGroups.has(group.key) && (<>
                {/* [FIX #4] Optimized grid headers — Attachment merged into Actions */}
                <div className={`grid ${invoiceGridCols} gap-2 px-5 py-2.5 border-b border-gray-200 bg-gray-50`}>
                  <span className={`vLbl text-[10px] ${THEME.textDim} font-bold uppercase`}>Invoice</span>
                  <span className={`vLbl text-[10px] ${THEME.textDim} font-bold uppercase`}>{groupBy === 'contractor' ? 'Client' : 'Contractor'}</span>
                  <span className={`vLbl text-[10px] ${THEME.textDim} font-bold uppercase`}>Period</span>
                  <span className={`vLbl text-[10px] ${THEME.textDim} font-bold uppercase text-right`}>Amount</span>
                  <span className={`vLbl text-[10px] ${THEME.textDim} font-bold uppercase`}>Status</span>
                  <span className={`vLbl text-[10px] ${THEME.textDim} font-bold uppercase`}>Actions</span>
                </div>
                {group.invoices.map(inv => {
                  const lines = inv.contractor_invoice_lines || []
                  const isExpanded = expandedInvoice === inv.id
                  const isProcessing = processing === inv.id
                  const secondCol = groupBy === 'contractor'
                    ? (lines.length > 0 ? clientMap[lines[0].client_id] || '—' : '—')
                    : (memberMap[inv.team_member_id] || '—')
                  return (
                    <div key={inv.id} className={`border-b border-gray-100 last:border-0`}>
                      {/* [FIX #2] Row urgency border */}
                      <div className={`grid ${invoiceGridCols} gap-2 px-5 py-3 items-center ${THEME.cardHover} transition-colors ${getRowBorder(inv.status)}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <button onClick={() => setExpandedInvoice(isExpanded ? null : inv.id)} className="text-gray-400 hover:text-gray-700 vBtn">
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                          <div className="min-w-0">
                            <p className="text-gray-900 text-sm font-medium truncate">{inv.invoice_number}</p>
                            <p className="text-gray-400 text-xs">Submitted {formatDate(inv.submitted_at?.split('T')[0] || inv.invoice_date)}</p>
                          </div>
                        </div>
                        <span className="text-gray-600 text-sm truncate">{secondCol}</span>
                        <span className="text-gray-400 text-xs vN">{formatDateCompact(inv.period_start)} – {formatDateCompact(inv.period_end)}</span>
                        <span className="text-gray-900 text-sm font-medium text-right vN">{formatCurrency(inv.total_amount)}</span>
                        <StatusBadge status={inv.status} />
                        {/* [FIX #4] Merged actions + attachment column */}
                        <div className="flex items-center gap-1.5">
                          {inv.receipt_url && (
                            <button onClick={() => openPreview(inv.receipt_url!)}
                              className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-500 text-xs vBtn">
                              <Eye size={12} /> View
                            </button>
                          )}
                          {/* [FIX #3] Larger approve button */}
                          {inv.status === 'submitted' && (
                            <>
                              <button onClick={() => updateInvoiceStatus(inv.id, 'approved')} disabled={isProcessing}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 disabled:opacity-50 vBtn">
                                {isProcessing ? <Loader2 size={12} className="animate-spin" /> : 'Approve'}
                              </button>
                              <button onClick={() => updateInvoiceStatus(inv.id, 'rejected')} disabled={isProcessing}
                                className="px-2.5 py-1.5 rounded-lg vBtn bg-white text-gray-500 text-xs font-medium hover:text-red-600 hover:bg-red-50 border border-gray-200 disabled:opacity-50">
                                Reject
                              </button>
                            </>
                          )}
                          {inv.status === 'approved' && (
                            <button onClick={() => updateInvoiceStatus(inv.id, 'paid')} disabled={isProcessing}
                              className="px-3 py-1.5 rounded-lg vBtn bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 border border-emerald-200 disabled:opacity-50">
                              Mark Paid
                            </button>
                          )}
                          {(inv.status === 'paid' || inv.status === 'rejected') && (
                            <span className="text-gray-400 text-xs">{inv.status === 'paid' ? formatDate(inv.paid_at?.split('T')[0] || '') : 'Rejected'}</span>
                          )}
                        </div>
                      </div>
                      {/* [FIX #5] Expanded detail — clear bg, total row */}
                      {isExpanded && lines.length > 0 && (
                        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                          <p className={`vLbl text-[10px] ${THEME.textDim} font-bold uppercase mb-2`}>Line Items</p>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-gray-400 text-xs">
                                <th className="text-left pb-1.5 font-medium">Client</th>
                                <th className="text-left pb-1.5 font-medium">Description</th>
                                <th className="text-right pb-1.5 font-medium">Hours</th>
                                <th className="text-right pb-1.5 font-medium">Rate</th>
                                <th className="text-right pb-1.5 font-medium">%</th>
                                <th className="text-right pb-1.5 font-medium">Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {lines.map((line: any, i: number) => (
                                <tr key={i} className="border-t border-gray-200">
                                  <td className="py-1.5 text-gray-700">{clientMap[line.client_id] || line.description?.split(' - ')[0] || '—'}</td>
                                  <td className="py-1.5 text-gray-500">{line.description}</td>
                                  <td className="py-1.5 text-right text-gray-700 vN">{line.hours ? line.hours.toFixed(1) : '—'}</td>
                                  <td className="py-1.5 text-right text-gray-500 vN">{line.rate ? formatCurrency(line.rate) : '—'}</td>
                                  <td className="py-1.5 text-right text-gray-500 vN">{line.allocation_pct ? `${line.allocation_pct}%` : '—'}</td>
                                  <td className="py-1.5 text-right text-gray-900 font-medium vN">{formatCurrency(line.amount)}</td>
                                </tr>
                              ))}
                              {/* [FIX #5] Total row */}
                              <tr className="border-t-2 border-gray-300">
                                <td colSpan={5} className="py-1.5 text-right text-gray-500 text-xs font-medium pr-4">Total</td>
                                <td className="py-1.5 text-right text-gray-900 font-semibold vN">{formatCurrency(lines.reduce((s: number, l: any) => s + l.amount, 0))}</td>
                              </tr>
                            </tbody>
                          </table>
                          {inv.notes && <p className="mt-2 text-xs text-gray-400 italic">Note: {inv.notes}</p>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </>)}
            </div>
          )}) : (
            /* [FIX #8] Better empty state */
            <div className="bg-white border border-gray-200 rounded-xl text-center py-12">
              <FileText size={32} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500 font-medium">No invoices for {dateFilter.label}</p>
              <p className="text-xs text-gray-400 mt-1">Invoices appear here when contractors submit them through the Contractor Portal</p>
              <a href="/timesheet" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-xs text-emerald-600 hover:text-emerald-500 font-medium">
                <ExternalLink size={12} /> Open Contractor Portal
              </a>
            </div>
          )}
        </div>
      )}

      {/* ===================== EXPENSES TAB ===================== */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          {/* Metrics */}
          <div className="grid grid-cols-4 gap-3">
            <MetricCard label="Total Expenses" value={formatCurrency(expenseMetrics.total)} icon={Receipt} accentColor="#2563eb" sub={`${filteredExpenses.length} items`} />
            <MetricCard label="Pending Review" value={formatCurrency(expenseMetrics.pendingAmt)} icon={Clock} accentColor="#d97706" sub={`${expenseMetrics.pendingCount} awaiting`} highlight={expenseMetrics.pendingCount > 0} />
            <MetricCard label="Approved" value={formatCurrency(expenseMetrics.approvedAmt)} icon={CheckCircle} accentColor="#059669" />
            <MetricCard label="Billable" value={formatCurrency(filteredExpenses.filter(e => e.client_id && e.status === 'approved').reduce((s, e) => s + e.amount, 0))} icon={TrendingUp} accentColor="#059669" sub="Tagged to a client" />
          </div>

          {/* [FIX #3] Batch action bar for pending expenses */}
          {expenseMetrics.pendingCount > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-amber-600" />
                <span className="text-sm text-amber-800 font-medium">{expenseMetrics.pendingCount} expense{expenseMetrics.pendingCount !== 1 ? 's' : ''} pending review — {formatCurrency(expenseMetrics.pendingAmt)} total</span>
              </div>
              <button onClick={bulkApproveExpenses} disabled={processing === 'bulk'}
                className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 disabled:opacity-50 vBtn flex items-center gap-1.5">
                {processing === 'bulk' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                Approve All
              </button>
            </div>
          )}

          {/* Filters + Date Range */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-xs">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search expenses..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" />
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={getSelectClass(filterStatus !== 'all')}>
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <select value={filterMember} onChange={e => setFilterMember(e.target.value)} className={getSelectClass(filterMember !== 'all')}>
                <option value="all">All Contractors</option>
                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className={getSelectClass(filterClient !== 'all')}>
                <option value="all">All Clients</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="px-2.5 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 vBtn flex items-center gap-1">
                  <X size={12} /> Clear
                </button>
              )}
            </div>
            {/* Date range */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 rounded-lg border border-gray-200">
                {['month', 'quarter', 'year', 'all'].map(r => (
                  <button key={r} onClick={() => setDateRange(r as any)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${dateRange === r ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
                    {r === 'all' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
                  </button>
                ))}
              </div>
              {dateRange !== 'all' && (
                <div className="flex items-center gap-1">
                  <button onClick={() => navigateDate(-1)} className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"><ChevronLeft size={14} /></button>
                  <span className="text-gray-900 text-sm font-medium px-3 py-1.5 bg-white border border-gray-200 rounded-lg min-w-[120px] text-center vN">{dateFilter.label}</span>
                  <button onClick={() => navigateDate(1)} className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors"><ChevronRight size={14} /></button>
                </div>
              )}
            </div>
          </div>

          {/* Expense List */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className={`grid ${expenseGridCols} gap-2 px-5 py-2.5 border-b border-gray-200 bg-gray-50`}>
              <span className={`vLbl text-[10px] ${THEME.textDim} font-bold uppercase`}>Description</span>
              <span className={`vLbl text-[10px] ${THEME.textDim} font-bold uppercase`}>Contractor</span>
              <span className={`vLbl text-[10px] ${THEME.textDim} font-bold uppercase`}>Date</span>
              <span className={`vLbl text-[10px] ${THEME.textDim} font-bold uppercase`}>Category</span>
              <span className={`vLbl text-[10px] ${THEME.textDim} font-bold uppercase text-right`}>Amount</span>
              <span className={`vLbl text-[10px] ${THEME.textDim} font-bold uppercase`}>Actions</span>
            </div>

            {filteredExpenses.length > 0 ? filteredExpenses.map(exp => {
              const cat = EXPENSE_CATEGORIES[exp.category] || EXPENSE_CATEGORIES.other
              const isProcessing = processing === exp.id
              return (
                <div key={exp.id} className={`grid ${expenseGridCols} gap-2 px-5 py-3 items-center border-b border-gray-100 last:border-0 ${THEME.cardHover} transition-colors ${getRowBorder(exp.status)}`}>
                  <div className="min-w-0">
                    <p className="text-gray-900 text-sm truncate">{exp.description}</p>
                    {exp.client_id && <p className="text-gray-400 text-xs">{clientMap[exp.client_id] || '—'}</p>}
                  </div>
                  <span className="text-gray-600 text-sm truncate">{memberMap[exp.team_member_id] || '—'}</span>
                  <span className="text-gray-400 text-xs vN">{formatDateCompact(exp.date)}</span>
                  <span className="text-xs text-gray-500">{cat.label}</span>
                  <span className="text-gray-900 text-sm font-medium text-right vN">{formatCurrency(exp.amount)}</span>
                  <div className="flex items-center gap-1.5">
                    {/* [FIX #4] Attachment view merged into actions */}
                    {exp.receipt_url && (() => {
                      const files = exp.receipt_url!.split(',').filter(Boolean)
                      return (
                        <button onClick={() => openPreview(exp.receipt_url!)}
                          className="p-1 rounded text-emerald-600 hover:text-emerald-500 flex items-center gap-1 vBtn">
                          <Eye size={12} />{files.length > 1 && <span className="text-xs">{files.length}</span>}
                        </button>
                      )
                    })()}
                    {exp.status === 'pending' && (
                      <>
                        <button onClick={() => updateExpenseStatus(exp.id, 'approved')} disabled={isProcessing}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 disabled:opacity-50 vBtn">
                          {isProcessing ? <Loader2 size={12} className="animate-spin" /> : 'Approve'}
                        </button>
                        <button onClick={() => updateExpenseStatus(exp.id, 'rejected')} disabled={isProcessing}
                          className="px-2.5 py-1.5 rounded-lg vBtn bg-white text-gray-500 text-xs font-medium hover:text-red-600 hover:bg-red-50 border border-gray-200 disabled:opacity-50">
                          Reject
                        </button>
                      </>
                    )}
                    {exp.status === 'approved' && <StatusBadge status={exp.status} />}
                    {exp.status === 'rejected' && <StatusBadge status={exp.status} />}
                  </div>
                </div>
              )
            }) : (
              <div className="text-center py-12">
                <Receipt size={32} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm text-gray-500 font-medium">No expenses for {dateFilter.label}</p>
                <p className="text-xs text-gray-400 mt-1">Expenses appear here when contractors submit them through the portal</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== ATTACHMENT PREVIEW MODAL ===================== */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md vFade" onClick={closePreview}>
          <div className="relative bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xl flex flex-col" style={{ width: '80vw', height: '85vh', maxWidth: '1200px' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <span className="text-gray-900 text-sm font-medium">Attachment Preview</span>
                {previewFiles.length > 1 && (
                  <span className="text-gray-400 text-xs vN">{previewIndex + 1} of {previewFiles.length}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* [FIX #9] File navigation */}
                {previewFiles.length > 1 && (
                  <div className="flex items-center gap-1 mr-2">
                    <button onClick={() => setPreviewIndex(i => Math.max(0, i - 1))} disabled={previewIndex === 0}
                      className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors disabled:opacity-30">
                      <ChevronLeft size={14} />
                    </button>
                    <button onClick={() => setPreviewIndex(i => Math.min(previewFiles.length - 1, i + 1))} disabled={previewIndex === previewFiles.length - 1}
                      className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors disabled:opacity-30">
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-600 text-xs flex items-center gap-1.5 transition-colors">
                  <ExternalLink size={12} /> Open
                </a>
                <a href={previewUrl} download className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-600 text-xs flex items-center gap-1.5 transition-colors">
                  <Download size={12} /> Download
                </a>
                <button onClick={closePreview} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 vBtn">
                  <X size={16} />
                </button>
              </div>
            </div>
            {/* Content */}
            <div className="flex-1 bg-gray-100 overflow-hidden relative">
              {previewUrl.match(/\.(jpg|jpeg|png|gif|webp|heic)$/i) || previewUrl.includes('image') ? (
                <div className="h-full flex items-center justify-center p-4">
                  <img src={previewUrl} alt="Attachment" className="max-h-full max-w-full object-contain rounded-lg shadow-lg" />
                </div>
              ) : (
                <iframe src={previewUrl} className="w-full h-full" title="Document preview" />
              )}
              {/* Overlay arrows */}
              {previewFiles.length > 1 && previewIndex > 0 && (
                <button onClick={() => setPreviewIndex(i => i - 1)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow-lg text-gray-600 vBtn">
                  <ChevronLeft size={20} />
                </button>
              )}
              {previewFiles.length > 1 && previewIndex < previewFiles.length - 1 && (
                <button onClick={() => setPreviewIndex(i => i + 1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow-lg text-gray-600 vBtn">
                  <ChevronRight size={20} />
                </button>
              )}
            </div>
            {/* [FIX #9] Thumbnail strip with file type indicators */}
            {previewFiles.length > 1 && (
              <div className="flex items-center gap-2 px-5 py-2.5 border-t border-gray-200 bg-gray-50 overflow-x-auto">
                {previewFiles.map((fileUrl, i) => {
                  const isImage = fileUrl.match(/\.(jpg|jpeg|png|gif|webp|heic)/i) || fileUrl.includes('image')
                  return (
                    <button key={i} onClick={() => setPreviewIndex(i)}
                      className={`flex-shrink-0 w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xs font-medium transition-colors ${
                        i === previewIndex ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}>
                      {isImage ? <Eye size={14} /> : <FileText size={14} />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
