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

// ============ THEME (matching existing pages) ============
const THEME = {
  glass: 'bg-slate-900/70 backdrop-blur-xl',
  glassBorder: 'border-white/[0.08]',
  glassHover: 'hover:bg-white/[0.05] hover:border-white/[0.12]',
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
  status: string // submitted, approved, rejected, paid
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
  status: string // pending, approved, rejected, paid
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

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  submitted: { label: 'Submitted', bg: 'bg-blue-500/10', text: 'text-blue-400', icon: Clock },
  pending: { label: 'Pending', bg: 'bg-amber-500/10', text: 'text-amber-400', icon: Clock },
  approved: { label: 'Approved', bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: CheckCircle },
  rejected: { label: 'Rejected', bg: 'bg-red-500/10', text: 'text-red-400', icon: XCircle },
  paid: { label: 'Paid', bg: 'bg-emerald-500/15', text: 'text-emerald-300', icon: DollarSign },
}

const EXPENSE_CATEGORIES: Record<string, { label: string; icon: string }> = {
  travel: { label: 'Travel', icon: '✈️' },
  materials: { label: 'Materials', icon: '📦' },
  software: { label: 'Software', icon: '💻' },
  meals: { label: 'Meals', icon: '🍽️' },
  equipment: { label: 'Equipment', icon: '🔧' },
  other: { label: 'Other', icon: '📋' },
}

// ============ STATUS BADGE ============
function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      <config.icon size={10} />
      {config.label}
    </span>
  )
}

// ============ METRIC CARD ============
function MetricCard({ label, value, sub, icon: Icon, color = 'emerald' }: { label: string; value: string; sub?: string; icon: any; color?: string }) {
  const colors: Record<string, string> = {
    emerald: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
    blue: 'from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-400',
    amber: 'from-amber-500/10 to-amber-500/5 border-amber-500/20 text-amber-400',
    red: 'from-red-500/10 to-red-500/5 border-red-500/20 text-red-400',
  }
  return (
    <div className={`bg-gradient-to-br ${colors[color]} border rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400 font-medium">{label}</span>
        <Icon size={16} className={colors[color].split(' ').pop()} />
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
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

  // Attachment preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

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
    // Date filter on period
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
        // Group by client — an invoice can span multiple clients via line items
        const lines = inv.contractor_invoice_lines || []
        if (lines.length === 0) {
          const key = '_unassigned'
          if (!groups[key]) groups[key] = { label: 'Unassigned', invoices: [], total: 0 }
          if (!groups[key].invoices.find(i => i.id === inv.id)) groups[key].invoices.push(inv)
          groups[key].total += inv.total_amount
        } else {
          // Dedupe: assign invoice to the client with the largest line amount
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

  const openPreview = (path: string) => {
    const { data } = supabase.storage.from('contractor-uploads').getPublicUrl(path)
    if (data?.publicUrl) setPreviewUrl(data.publicUrl)
  }

  // ============ RENDER ============
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="text-emerald-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Contractor Management</h1>
          <p className="text-slate-400 text-sm mt-0.5">AP invoices and expenses from your team</p>
        </div>
        <a href="/timesheet" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-slate-300 text-sm transition-colors">
          <ExternalLink size={14} /> Contractor Portal
        </a>
      </div>

      {/* Tabs + Date Range */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 p-1 bg-slate-800/50 rounded-xl">
          {[
            { id: 'invoices' as const, label: 'AP Invoices', icon: FileText, count: invoiceMetrics.pendingCount },
            { id: 'expenses' as const, label: 'Expenses', icon: Receipt, count: expenseMetrics.pendingCount },
          ].map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearchQuery(''); setFilterStatus('all'); setFilterMember('all'); setFilterClient('all') }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id ? 'bg-emerald-500/15 text-emerald-400' : 'text-slate-400 hover:text-white'
              }`}>
              <tab.icon size={16} />
              {tab.label}
              {tab.count > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Date range selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-0.5 bg-slate-800/50 rounded-lg">
            {['month', 'quarter', 'year', 'all'].map(r => (
              <button key={r} onClick={() => setDateRange(r as any)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${dateRange === r ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                {r === 'all' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
          {dateRange !== 'all' && (
            <div className="flex items-center gap-1">
              <button onClick={() => navigateDate(-1)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400"><ChevronLeft size={14} /></button>
              <span className="text-white text-sm font-medium px-3 py-1 bg-slate-800 rounded-lg min-w-[120px] text-center">{dateFilter.label}</span>
              <button onClick={() => navigateDate(1)} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400"><ChevronRight size={14} /></button>
            </div>
          )}
        </div>
      </div>

      {/* ===================== AP INVOICES TAB ===================== */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          {/* Metrics */}
          <div className="grid grid-cols-4 gap-4">
            <MetricCard label="Total AP" value={formatCurrency(invoiceMetrics.total)} icon={DollarSign} color="blue" sub={`${filteredInvoices.length} invoices`} />
            <MetricCard label="Pending Review" value={formatCurrency(invoiceMetrics.pendingAmt)} icon={Clock} color="amber" sub={`${invoiceMetrics.pendingCount} awaiting`} />
            <MetricCard label="Approved" value={formatCurrency(invoiceMetrics.approvedAmt)} icon={CheckCircle} color="emerald" />
            <MetricCard label="Paid" value={formatCurrency(invoiceMetrics.paidAmt)} icon={CreditCard} color="emerald" />
          </div>

          {/* Filters + Group By */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-xs">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input type="text" placeholder="Search invoices..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="paid">Paid</option>
              </select>
              <select value={filterMember} onChange={e => setFilterMember(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                <option value="all">All Contractors</option>
                {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
                className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
                <option value="all">All Clients</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {/* Group by toggle */}
            <div className="flex items-center gap-1 p-0.5 bg-slate-800/50 rounded-lg shrink-0">
              <span className="text-[10px] text-slate-500 px-1.5">Group:</span>
              {[{ id: 'none' as const, label: 'None' }, { id: 'contractor' as const, label: 'Contractor' }, { id: 'client' as const, label: 'Client' }].map(g => (
                <button key={g.id} onClick={() => { setGroupBy(g.id); setCollapsedGroups(new Set()) }}
                  className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${groupBy === g.id ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Invoice List (grouped) */}
          {filteredInvoices.length > 0 ? groupedInvoices.map(group => (
            <div key={group.key} className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
              {/* Group header (only if grouping is active) */}
              {groupBy !== 'none' && (
                <button onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/40 hover:bg-slate-800/60 transition-colors border-b border-white/[0.06]">
                  <div className="flex items-center gap-3">
                    {collapsedGroups.has(group.key) ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                    <span className="text-white text-sm font-semibold">{group.label}</span>
                    <span className="text-slate-500 text-xs">{group.invoices.length} invoice{group.invoices.length !== 1 ? 's' : ''}</span>
                  </div>
                  <span className="text-white text-sm font-bold">{formatCurrency(group.total)}</span>
                </button>
              )}
              {/* Table header + rows */}
              {!collapsedGroups.has(group.key) && (<>
                <div className="grid grid-cols-[1fr_140px_100px_120px_100px_100px_140px] gap-2 px-4 py-2.5 border-b border-white/[0.06] text-xs text-slate-500 font-medium uppercase tracking-wider">
                  <span>Invoice</span>
                  <span>{groupBy === 'contractor' ? 'Client' : 'Contractor'}</span>
                  <span>Period</span>
                  <span className="text-right">Amount</span>
                  <span>Status</span>
                  <span>Attachment</span>
                  <span>Actions</span>
                </div>
                {group.invoices.map(inv => {
                  const lines = inv.contractor_invoice_lines || []
                  const isExpanded = expandedInvoice === inv.id
                  const isProcessing = processing === inv.id
                  // For client grouping show contractor, for contractor grouping show primary client
                  const secondCol = groupBy === 'contractor'
                    ? (lines.length > 0 ? clientMap[lines[0].client_id] || '—' : '—')
                    : (memberMap[inv.team_member_id] || '—')
                  return (
                    <div key={inv.id} className="border-b border-white/[0.04] last:border-0">
                      <div className="grid grid-cols-[1fr_140px_100px_120px_100px_100px_140px] gap-2 px-4 py-3 items-center hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <button onClick={() => setExpandedInvoice(isExpanded ? null : inv.id)} className="text-slate-400 hover:text-white">
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                          <div className="min-w-0">
                            <p className="text-white text-sm font-medium truncate">{inv.invoice_number}</p>
                            <p className="text-slate-500 text-xs">Submitted {formatDate(inv.submitted_at?.split('T')[0] || inv.invoice_date)}</p>
                          </div>
                        </div>
                        <span className="text-slate-300 text-sm truncate">{secondCol}</span>
                        <span className="text-slate-400 text-xs">{formatDateCompact(inv.period_start)} – {formatDateCompact(inv.period_end)}</span>
                        <span className="text-white text-sm font-medium text-right">{formatCurrency(inv.total_amount)}</span>
                        <StatusBadge status={inv.status} />
                        <div>
                          {inv.receipt_url ? (
                            <button onClick={() => openPreview(inv.receipt_url!)}
                              className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs">
                              <Eye size={12} /> View
                            </button>
                          ) : <span className="text-slate-600 text-xs">None</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {inv.status === 'submitted' && (
                            <>
                              <button onClick={() => updateInvoiceStatus(inv.id, 'approved')} disabled={isProcessing}
                                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-medium hover:bg-emerald-500/25 disabled:opacity-50 transition-colors">
                                {isProcessing ? <Loader2 size={12} className="animate-spin" /> : 'Approve'}
                              </button>
                              <button onClick={() => updateInvoiceStatus(inv.id, 'rejected')} disabled={isProcessing}
                                className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 disabled:opacity-50 transition-colors">
                                Reject
                              </button>
                            </>
                          )}
                          {inv.status === 'approved' && (
                            <button onClick={() => updateInvoiceStatus(inv.id, 'paid')} disabled={isProcessing}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs font-medium hover:bg-emerald-500/25 disabled:opacity-50 transition-colors">
                              Mark Paid
                            </button>
                          )}
                          {(inv.status === 'paid' || inv.status === 'rejected') && (
                            <span className="text-slate-600 text-xs">{inv.status === 'paid' ? formatDate(inv.paid_at?.split('T')[0] || '') : 'Rejected'}</span>
                          )}
                        </div>
                      </div>
                      {isExpanded && lines.length > 0 && (
                        <div className="bg-slate-800/30 px-6 py-3 border-t border-white/[0.04]">
                          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Line Items</p>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-slate-500 text-xs">
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
                                <tr key={i} className="border-t border-white/[0.04]">
                                  <td className="py-1.5 text-slate-300">{clientMap[line.client_id] || line.description?.split(' - ')[0] || '—'}</td>
                                  <td className="py-1.5 text-slate-400">{line.description}</td>
                                  <td className="py-1.5 text-right text-slate-300">{line.hours ? line.hours.toFixed(1) : '—'}</td>
                                  <td className="py-1.5 text-right text-slate-400">{line.rate ? formatCurrency(line.rate) : '—'}</td>
                                  <td className="py-1.5 text-right text-slate-400">{line.allocation_pct ? `${line.allocation_pct}%` : '—'}</td>
                                  <td className="py-1.5 text-right text-white font-medium">{formatCurrency(line.amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {inv.notes && <p className="mt-2 text-xs text-slate-500 italic">Note: {inv.notes}</p>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </>)}
            </div>
          )) : (
            <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl text-center py-12 text-slate-500`}>
              <FileText size={32} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm">No invoices found</p>
            </div>
          )}
        </div>
      )}

      {/* ===================== EXPENSES TAB ===================== */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          {/* Metrics */}
          <div className="grid grid-cols-4 gap-4">
            <MetricCard label="Total Expenses" value={formatCurrency(expenseMetrics.total)} icon={Receipt} color="blue" sub={`${filteredExpenses.length} items`} />
            <MetricCard label="Pending Review" value={formatCurrency(expenseMetrics.pendingAmt)} icon={Clock} color="amber" sub={`${expenseMetrics.pendingCount} awaiting`} />
            <MetricCard label="Approved" value={formatCurrency(expenseMetrics.approvedAmt)} icon={CheckCircle} color="emerald" />
            <MetricCard label="Billable" value={formatCurrency(filteredExpenses.filter(e => e.client_id && e.status === 'approved').reduce((s, e) => s + e.amount, 0))} icon={TrendingUp} color="emerald" sub="Tagged to a client" />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" placeholder="Search expenses..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <select value={filterMember} onChange={e => setFilterMember(e.target.value)}
              className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
              <option value="all">All Contractors</option>
              {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
              className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
              <option value="all">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Expense List */}
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
            <div className="grid grid-cols-[1fr_130px_100px_80px_100px_80px_140px] gap-2 px-4 py-2.5 border-b border-white/[0.06] text-xs text-slate-500 font-medium uppercase tracking-wider">
              <span>Description</span>
              <span>Contractor</span>
              <span>Date</span>
              <span>Category</span>
              <span className="text-right">Amount</span>
              <span>Status</span>
              <span>Actions</span>
            </div>

            {filteredExpenses.length > 0 ? filteredExpenses.map(exp => {
              const cat = EXPENSE_CATEGORIES[exp.category] || EXPENSE_CATEGORIES.other
              const isProcessing = processing === exp.id
              return (
                <div key={exp.id} className="grid grid-cols-[1fr_130px_100px_80px_100px_80px_140px] gap-2 px-4 py-3 items-center border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors">
                  <div className="min-w-0">
                    <p className="text-white text-sm truncate">{exp.description}</p>
                    {exp.client_id && <p className="text-slate-500 text-xs">{clientMap[exp.client_id] || '—'}</p>}
                  </div>
                  <span className="text-slate-300 text-sm truncate">{memberMap[exp.team_member_id] || '—'}</span>
                  <span className="text-slate-400 text-xs">{formatDate(exp.date)}</span>
                  <span className="text-xs">{cat.icon} {cat.label}</span>
                  <span className="text-white text-sm font-medium text-right">{formatCurrency(exp.amount)}</span>
                  <StatusBadge status={exp.status} />
                  <div className="flex items-center gap-1.5">
                    {exp.receipt_url && (
                      <button onClick={() => openPreview(exp.receipt_url!)}
                        className="p-1 rounded text-blue-400 hover:text-blue-300"><Eye size={12} /></button>
                    )}
                    {exp.status === 'pending' && (
                      <>
                        <button onClick={() => updateExpenseStatus(exp.id, 'approved')} disabled={isProcessing}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-medium hover:bg-emerald-500/25 disabled:opacity-50 transition-colors">
                          {isProcessing ? <Loader2 size={12} className="animate-spin" /> : 'Approve'}
                        </button>
                        <button onClick={() => updateExpenseStatus(exp.id, 'rejected')} disabled={isProcessing}
                          className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 disabled:opacity-50 transition-colors">
                          Reject
                        </button>
                      </>
                    )}
                    {exp.status === 'approved' && (
                      <span className="text-emerald-500/60 text-xs">Approved</span>
                    )}
                  </div>
                </div>
              )
            }) : (
              <div className="text-center py-12 text-slate-500">
                <Receipt size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm">No expenses found</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== ATTACHMENT PREVIEW MODAL ===================== */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setPreviewUrl(null)}>
          <div className="relative w-[95vw] h-[92vh] mx-4 bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <span className="text-white text-sm font-medium">Attachment Preview</span>
              <div className="flex items-center gap-2">
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-xs flex items-center gap-1.5 transition-colors">
                  <ExternalLink size={12} /> Open
                </a>
                <a href={previewUrl} download className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 text-xs flex items-center gap-1.5 transition-colors">
                  <Download size={12} /> Download
                </a>
                <button onClick={() => setPreviewUrl(null)} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>
            {/* Content */}
            <div className="flex-1 bg-slate-950" style={{ height: 'calc(92vh - 52px)' }}>
              {previewUrl.match(/\.(jpg|jpeg|png|gif|webp|heic)$/i) || previewUrl.includes('image') ? (
                <div className="h-full flex items-center justify-center p-4">
                  <img src={previewUrl} alt="Attachment" className="max-h-full max-w-full object-contain rounded-lg" />
                </div>
              ) : (
                <iframe src={previewUrl} className="w-full h-full" title="Document preview" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
