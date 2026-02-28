'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  FileText, Receipt, Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, Clock, DollarSign, Download, Eye, Building2,
  Loader2, X, Calendar, TrendingUp,
  ExternalLink, Tag, Ban, Layers
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jmahfgpbtjeomuepfozf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYWhmZ3BidGplb211ZXBmb3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0OTAxNzcsImV4cCI6MjA4MTA2NjE3N30.3SVDvWCGIYYHV57BpKjpDJVCZLKzuRv8B_VietQDxUQ'
)

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
  id: string; team_member_id: string; invoice_number: string; invoice_date: string
  due_date: string; period_start: string; period_end: string; total_amount: number
  status: string; payment_terms: string; receipt_url: string | null; notes: string | null
  submitted_at: string; reviewed_at: string | null; paid_at: string | null
  contractor_invoice_lines: InvoiceLine[]
}
interface InvoiceLine {
  id: string; invoice_id: string; client_id: string; project_id: string | null
  description: string; hours: number | null; rate: number | null; amount: number; allocation_pct: number | null
}
interface ContractorExpense {
  id: string; team_member_id: string; project_id: string | null; client_id: string | null
  date: string; category: string; description: string; amount: number; receipt_url: string | null
  status: string; submitted_at: string; reviewed_at: string | null; notes: string | null; is_billable: boolean | null
}
interface TeamMember { id: string; name: string; email: string }
interface Client { id: string; name: string }
interface Project { id: string; name: string; client_id: string }

// ============ HELPERS ============
const fmt$ = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
const fmtDate = (d: string) => { if (!d) return '—'; return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
const fmtDateS = (d: string) => { if (!d) return '—'; return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }

// ============ 5-STATUS WORKFLOW ============
const ALL_STATUSES = ['pending', 'approved', 'scheduled', 'paid', 'rejected'] as const
const STATUS_CFG: Record<string, { label: string; bg: string; text: string; border: string; selectBg: string; icon: any }> = {
  submitted: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', selectBg: '#fffbeb', icon: Clock },
  pending: { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', selectBg: '#fffbeb', icon: Clock },
  approved: { label: 'Approved', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', selectBg: '#eff6ff', icon: CheckCircle },
  scheduled: { label: 'Scheduled', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', selectBg: '#faf5ff', icon: Calendar },
  paid: { label: 'Paid', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', selectBg: '#ecfdf5', icon: DollarSign },
  rejected: { label: 'Rejected', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', selectBg: '#fef2f2', icon: XCircle },
}

const EXPENSE_CATEGORIES: Record<string, string> = {
  travel: 'Travel', hotel: 'Hotel', meal: 'Meal', transportation: 'Transportation',
  software_equipment: 'Software / Equipment', materials: 'Materials', software: 'Software',
  meals: 'Meals', equipment: 'Equipment', other: 'Other',
}

const OVERHEAD_NAMES = ['mano cg', 'mano cg llc', 'manogc', 'mano']
const isOverhead = (name?: string) => name ? OVERHEAD_NAMES.some(n => name.toLowerCase().includes(n)) : false

// ============ COMPONENTS ============

function StatusDropdown({ status, onChange, disabled }: { status: string; onChange: (s: string) => void; disabled?: boolean }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending
  return (
    <select
      value={status === 'submitted' ? 'pending' : status}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className={`px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-colors disabled:opacity-50 ${cfg.bg} ${cfg.text} ${cfg.border}`}
      style={{ backgroundColor: cfg.selectBg }}
    >
      {ALL_STATUSES.map(s => (
        <option key={s} value={s}>{STATUS_CFG[s].label}</option>
      ))}
    </select>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.pending
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <cfg.icon size={10} />{cfg.label}
    </span>
  )
}

function BillableBadge({ isBillable, isOH }: { isBillable: boolean; isOH: boolean }) {
  if (isOH && !isBillable) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500 border border-gray-200 uppercase tracking-wide">
      <Building2 size={9} /> Overhead
    </span>
  )
  if (isBillable) return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wide">
      <Tag size={9} /> Billable
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-50 text-gray-400 border border-gray-200 uppercase tracking-wide">
      <Ban size={9} /> Non-billable
    </span>
  )
}

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

const selClass = (active: boolean) =>
  `px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-colors cursor-pointer ${
    active ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-white border-gray-200 text-gray-700'
  }`

function getRowBorder(status: string): string {
  if (status === 'submitted' || status === 'pending') return 'border-l-2 border-l-amber-400'
  if (status === 'approved') return 'border-l-2 border-l-blue-400'
  if (status === 'scheduled') return 'border-l-2 border-l-purple-400'
  if (status === 'paid') return 'border-l-2 border-l-emerald-400'
  if (status === 'rejected') return 'border-l-2 border-l-red-300'
  return 'border-l-2 border-l-transparent'
}

// ============ GROUPING ENGINE ============
type GroupDimension = 'none' | 'client' | 'status' | 'contractor'

interface GroupNode {
  key: string
  label: string
  sublabel?: string
  isOverhead?: boolean
  total: number
  count: number
  pendingCount: number
  children: GroupNode[]
  items: any[]
}

function buildGroups(
  items: any[],
  dimensions: GroupDimension[],
  resolvers: {
    client: (item: any) => { id: string; name: string }
    contractor: (item: any) => { id: string; name: string }
    status: (item: any) => string
    amount: (item: any) => number
  }
): GroupNode[] {
  const filtered = dimensions.filter(d => d !== 'none')
  if (filtered.length === 0) {
    return [{ key: '_all', label: '', total: items.reduce((s, i) => s + resolvers.amount(i), 0), count: items.length, pendingCount: items.filter(i => ['pending', 'submitted'].includes(resolvers.status(i))).length, children: [], items }]
  }
  const [dim, ...rest] = filtered

  const groups: Record<string, { label: string; isOverhead?: boolean; items: any[] }> = {}
  items.forEach(item => {
    let key: string, label: string, oh = false
    if (dim === 'client') {
      const c = resolvers.client(item); key = c.id || '_unassigned'; label = c.name || 'Unassigned'; oh = isOverhead(label)
    } else if (dim === 'contractor') {
      const c = resolvers.contractor(item); key = c.id || '_unknown'; label = c.name || 'Unknown'
    } else {
      const s = resolvers.status(item); key = s === 'submitted' ? 'pending' : s; label = STATUS_CFG[key]?.label || key
    }
    if (!groups[key]) groups[key] = { label, isOverhead: oh, items: [] }
    groups[key].items.push(item)
  })

  return Object.entries(groups)
    .map(([key, g]) => {
      const total = g.items.reduce((s, i) => s + resolvers.amount(i), 0)
      const pendingCount = g.items.filter(i => ['pending', 'submitted'].includes(resolvers.status(i))).length
      const children = rest.length > 0 ? buildGroups(g.items, rest, resolvers) : []
      return { key, label: g.label, isOverhead: g.isOverhead, total, count: g.items.length, pendingCount, children, items: rest.length > 0 ? [] : g.items }
    })
    .sort((a, b) => {
      if (a.isOverhead && !b.isOverhead) return 1
      if (!a.isOverhead && b.isOverhead) return -1
      if (dim === 'status') {
        const order = ['pending', 'approved', 'scheduled', 'paid', 'rejected']
        return order.indexOf(a.key) - order.indexOf(b.key)
      }
      return b.total - a.total
    })
}

// ============ GROUP ACCORDION ============
function GroupAccordion({ node, depth, collapsed, onToggle, renderItems }: {
  node: GroupNode; depth: number; collapsed: Set<string>; onToggle: (k: string) => void; renderItems: (items: any[]) => React.ReactNode
}) {
  const isOpen = !collapsed.has(node.key)
  const indent = depth > 0
  const cfg = STATUS_CFG[node.key]
  const statusColor = cfg ? { bg: cfg.bg, text: cfg.text, border: cfg.border } : null

  return (
    <div className={`bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm ${indent ? 'ml-4 mt-2' : ''}`}>
      <button onClick={() => onToggle(node.key)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          {isOpen ? <ChevronDown size={15} className="text-gray-400" /> : <ChevronRight size={15} className="text-gray-400" />}
          {statusColor ? (
            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusColor.bg} ${statusColor.text} ${statusColor.border}`}>
              {node.label}
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${node.isOverhead ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-700'}`}>
                {node.label.charAt(0).toUpperCase()}
              </div>
              <span className="text-gray-900 text-sm font-semibold">{node.label}</span>
              {node.isOverhead && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase">Overhead</span>}
            </div>
          )}
          <span className="text-gray-400 text-xs">{node.count} item{node.count !== 1 ? 's' : ''}</span>
          {node.pendingCount > 0 && (
            <span className="text-amber-700 text-[10px] font-semibold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              {node.pendingCount} pending
            </span>
          )}
        </div>
        <span className="text-gray-900 text-sm font-semibold vN">{fmt$(node.total)}</span>
      </button>
      {isOpen && (
        <>
          {node.children.length > 0 ? (
            <div className="px-2 pb-2">
              {node.children.map(child => (
                <GroupAccordion key={child.key} node={child} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} renderItems={renderItems} />
              ))}
            </div>
          ) : (
            renderItems(node.items)
          )}
        </>
      )}
    </div>
  )
}

// ============ GROUP-BY SELECTOR ============
function GroupBySelector({ dimensions, onChange }: { dimensions: GroupDimension[]; onChange: (d: GroupDimension[]) => void }) {
  const options: { id: GroupDimension; label: string }[] = [
    { id: 'client', label: 'Client' },
    { id: 'status', label: 'Status' },
    { id: 'contractor', label: 'Contractor' },
  ]
  const activeDims = dimensions.filter(d => d !== 'none')

  const addDim = (dim: 'client' | 'status' | 'contractor') => {
    if (activeDims.includes(dim)) return
    onChange([...activeDims, dim])
  }
  const removeDim = (idx: number) => {
    const next = [...activeDims]
    next.splice(idx, 1)
    onChange(next.length > 0 ? next : ['none'])
  }
  const clearAll = () => onChange(['none'])

  return (
    <div className="flex items-center gap-1.5">
      <Layers size={13} className="text-gray-400" />
      <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">Group:</span>
      {activeDims.length === 0 || (activeDims.length === 1 && activeDims[0] === 'none') ? (
        <span className="text-xs text-gray-400 italic">None</span>
      ) : (
        activeDims.map((dim, i) => (
          <span key={dim} className="inline-flex items-center gap-1">
            {i > 0 && <span className="text-gray-300 text-xs">›</span>}
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              {options.find(o => o.id === dim)?.label}
              <button onClick={() => removeDim(i)} className="hover:text-red-500 ml-0.5"><X size={10} /></button>
            </span>
          </span>
        ))
      )}
      {activeDims.length < 3 && (
        <div className="flex items-center gap-0.5 ml-1">
          {options.filter(o => !activeDims.includes(o.id)).map(o => (
            <button key={o.id} onClick={() => addDim(o.id)}
              className="px-2 py-0.5 rounded-md text-[10px] font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200">
              + {o.label}
            </button>
          ))}
        </div>
      )}
      {activeDims.length > 0 && activeDims[0] !== 'none' && (
        <button onClick={clearAll} className="text-[10px] text-gray-400 hover:text-gray-600 ml-1">Clear</button>
      )}
    </div>
  )
}

// ============ MAIN COMPONENT ============
export default function ContractorManagement() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'expenses'>('invoices')
  const [loading, setLoading] = useState(true)
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

  // Date range
  const [dateRange, setDateRange] = useState<'month' | 'quarter' | 'year' | 'all'>('month')
  const [refDate, setRefDate] = useState(new Date())

  // Grouping
  const [invGroupDims, setInvGroupDims] = useState<GroupDimension[]>(['client'])
  const [expGroupDims, setExpGroupDims] = useState<GroupDimension[]>(['client'])

  // Accordion collapse state
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const toggleCollapse = (key: string) => setCollapsed(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  // Invoice detail expansion
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null)

  // Attachment preview
  const [previewFiles, setPreviewFiles] = useState<string[]>([])
  const [previewIndex, setPreviewIndex] = useState(0)
  const previewUrl = previewFiles.length > 0 ? previewFiles[previewIndex] : null

  // Processing
  const [processing, setProcessing] = useState<string | null>(null)

  const memberMap = useMemo(() => { const m: Record<string, string> = {}; teamMembers.forEach(t => { m[t.id] = t.name }); return m }, [teamMembers])
  const clientMap = useMemo(() => { const m: Record<string, string> = {}; clients.forEach(c => { m[c.id] = c.name }); return m }, [clients])

  // Date range
  const dateFilter = useMemo(() => {
    const d = refDate
    if (dateRange === 'month') {
      const s = new Date(d.getFullYear(), d.getMonth(), 1); const e = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      return { start: s.toISOString().split('T')[0], end: e.toISOString().split('T')[0], label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }
    }
    if (dateRange === 'quarter') {
      const q = Math.floor(d.getMonth() / 3); const s = new Date(d.getFullYear(), q * 3, 1); const e = new Date(d.getFullYear(), q * 3 + 3, 0)
      return { start: s.toISOString().split('T')[0], end: e.toISOString().split('T')[0], label: `Q${q + 1} ${d.getFullYear()}` }
    }
    if (dateRange === 'year') return { start: `${d.getFullYear()}-01-01`, end: `${d.getFullYear()}-12-31`, label: `${d.getFullYear()}` }
    return { start: '2020-01-01', end: '2099-12-31', label: 'All Time' }
  }, [dateRange, refDate])

  const navigateDate = (dir: -1 | 1) => {
    const d = new Date(refDate)
    if (dateRange === 'month') d.setMonth(d.getMonth() + dir)
    else if (dateRange === 'quarter') d.setMonth(d.getMonth() + dir * 3)
    else if (dateRange === 'year') d.setFullYear(d.getFullYear() + dir)
    setRefDate(d)
  }

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
      const rawExp = expRes.data || []; const cl = clientRes.data || []
      setExpenses(rawExp.map((e: any) => ({
        ...e,
        is_billable: e.is_billable !== null && e.is_billable !== undefined
          ? e.is_billable
          : (e.client_id ? !isOverhead(cl.find((c: any) => c.id === e.client_id)?.name) : false)
      })))
      setTeamMembers(teamRes.data || [])
      setClients(cl)
      setProjects(projRes.data || [])
      setLoading(false)
    }
    load()
  }, [])

  // ============ FILTERED DATA ============
  const filteredInvoices = useMemo(() => {
    let r = [...invoices]
    if (dateRange !== 'all') r = r.filter(inv => inv.period_start >= dateFilter.start && inv.period_end <= dateFilter.end)
    if (searchQuery) { const q = searchQuery.toLowerCase(); r = r.filter(inv => inv.invoice_number.toLowerCase().includes(q) || (memberMap[inv.team_member_id] || '').toLowerCase().includes(q)) }
    if (filterStatus !== 'all') r = r.filter(inv => filterStatus === 'pending' ? ['submitted', 'pending'].includes(inv.status) : inv.status === filterStatus)
    if (filterMember !== 'all') r = r.filter(inv => inv.team_member_id === filterMember)
    if (filterClient !== 'all') r = r.filter(inv => inv.contractor_invoice_lines?.some((l: any) => l.client_id === filterClient))
    return r
  }, [invoices, dateFilter, dateRange, searchQuery, filterStatus, filterMember, filterClient, memberMap])

  const filteredExpenses = useMemo(() => {
    let r = [...expenses]
    if (dateRange !== 'all') r = r.filter(e => e.date >= dateFilter.start && e.date <= dateFilter.end)
    if (searchQuery) { const q = searchQuery.toLowerCase(); r = r.filter(e => e.description.toLowerCase().includes(q) || (memberMap[e.team_member_id] || '').toLowerCase().includes(q)) }
    if (filterStatus !== 'all') r = r.filter(e => e.status === filterStatus)
    if (filterMember !== 'all') r = r.filter(e => e.team_member_id === filterMember)
    if (filterClient !== 'all') r = r.filter(e => e.client_id === filterClient)
    return r
  }, [expenses, dateFilter, dateRange, searchQuery, filterStatus, filterMember, filterClient, memberMap])

  // ============ GROUPED DATA ============
  const invResolvers = useMemo(() => ({
    client: (inv: ContractorInvoice) => {
      const lines = inv.contractor_invoice_lines || []
      if (lines.length === 0) return { id: '', name: 'Unassigned' }
      const ct: Record<string, number> = {}; lines.forEach(l => { ct[l.client_id] = (ct[l.client_id] || 0) + l.amount })
      const top = Object.entries(ct).sort((a, b) => b[1] - a[1])[0]
      return { id: top?.[0] || '', name: clientMap[top?.[0] || ''] || 'Unknown' }
    },
    contractor: (inv: ContractorInvoice) => ({ id: inv.team_member_id, name: memberMap[inv.team_member_id] || 'Unknown' }),
    status: (inv: ContractorInvoice) => inv.status === 'submitted' ? 'pending' : inv.status,
    amount: (inv: ContractorInvoice) => inv.total_amount,
  }), [clientMap, memberMap])

  const expResolvers = useMemo(() => ({
    client: (exp: ContractorExpense) => ({ id: exp.client_id || '', name: exp.client_id ? (clientMap[exp.client_id] || 'Unknown') : 'Unassigned' }),
    contractor: (exp: ContractorExpense) => ({ id: exp.team_member_id, name: memberMap[exp.team_member_id] || 'Unknown' }),
    status: (exp: ContractorExpense) => exp.status,
    amount: (exp: ContractorExpense) => exp.amount,
  }), [clientMap, memberMap])

  const invGroups = useMemo(() => buildGroups(filteredInvoices, invGroupDims, invResolvers), [filteredInvoices, invGroupDims, invResolvers])
  const expGroups = useMemo(() => buildGroups(filteredExpenses, expGroupDims, expResolvers), [filteredExpenses, expGroupDims, expResolvers])

  // ============ METRICS ============
  const invMetrics = useMemo(() => {
    const p = filteredInvoices.filter(i => ['submitted', 'pending'].includes(i.status))
    const a = filteredInvoices.filter(i => i.status === 'approved')
    const s = filteredInvoices.filter(i => i.status === 'scheduled')
    const d = filteredInvoices.filter(i => i.status === 'paid')
    return {
      total: filteredInvoices.reduce((s, i) => s + i.total_amount, 0),
      pendingCount: p.length, pendingAmt: p.reduce((s, i) => s + i.total_amount, 0),
      approvedAmt: a.reduce((s, i) => s + i.total_amount, 0), approvedCount: a.length,
      scheduledAmt: s.reduce((s2, i) => s2 + i.total_amount, 0), scheduledCount: s.length,
      paidAmt: d.reduce((s, i) => s + i.total_amount, 0),
    }
  }, [filteredInvoices])

  const expMetrics = useMemo(() => {
    const p = filteredExpenses.filter(e => e.status === 'pending')
    const a = filteredExpenses.filter(e => e.status === 'approved')
    const pd = filteredExpenses.filter(e => e.status === 'paid')
    const b = filteredExpenses.filter(e => e.is_billable && e.status !== 'rejected')
    return {
      total: filteredExpenses.reduce((s, e) => s + e.amount, 0),
      pendingCount: p.length, pendingAmt: p.reduce((s, e) => s + e.amount, 0),
      approvedAmt: a.reduce((s, e) => s + e.amount, 0), approvedCount: a.length,
      paidAmt: pd.reduce((s, e) => s + e.amount, 0), paidCount: pd.length,
      billableAmt: b.reduce((s, e) => s + e.amount, 0), billableCount: b.length,
    }
  }, [filteredExpenses])

  // ============ ACTIONS ============
  const changeInvStatus = async (id: string, status: string) => {
    setProcessing(id)
    const updates: any = { status, reviewed_at: new Date().toISOString() }
    if (status === 'paid') updates.paid_at = new Date().toISOString()
    const { error } = await supabase.from('contractor_invoices').update(updates).eq('id', id)
    if (!error) setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates } : inv))
    setProcessing(null)
  }

  const changeExpStatus = async (id: string, status: string) => {
    setProcessing(id)
    const updates: any = { status, reviewed_at: new Date().toISOString() }
    const { error } = await supabase.from('contractor_expenses').update(updates).eq('id', id)
    if (!error) setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
    setProcessing(null)
  }

  const toggleBillable = async (id: string, current: boolean) => {
    const { error } = await supabase.from('contractor_expenses').update({ is_billable: !current }).eq('id', id)
    if (!error) setExpenses(prev => prev.map(e => e.id === id ? { ...e, is_billable: !current } : e))
  }

  const bulkApproveInv = async () => {
    const pend = filteredInvoices.filter(i => ['submitted', 'pending'].includes(i.status)); setProcessing('bulk')
    for (const inv of pend) {
      const u = { status: 'approved', reviewed_at: new Date().toISOString() }
      const { error } = await supabase.from('contractor_invoices').update(u).eq('id', inv.id)
      if (!error) setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, ...u } : i))
    }
    setProcessing(null)
  }

  const bulkApproveExp = async () => {
    const pend = filteredExpenses.filter(e => e.status === 'pending'); setProcessing('bulk')
    for (const exp of pend) {
      const u = { status: 'approved', reviewed_at: new Date().toISOString() }
      const { error } = await supabase.from('contractor_expenses').update(u).eq('id', exp.id)
      if (!error) setExpenses(prev => prev.map(e => e.id === exp.id ? { ...e, ...u } : e))
    }
    setProcessing(null)
  }

  const openPreview = async (path: string) => {
    const paths = path.split(',').map(p => p.trim()).filter(Boolean); const urls: string[] = []
    for (const fp of paths) {
      let url: string | null = null
      const { data } = await supabase.storage.from('contractor-uploads').createSignedUrl(fp, 3600)
      if (data?.signedUrl) url = data.signedUrl
      if (!url) { const { data: d2 } = await supabase.storage.from('public').createSignedUrl(fp, 3600); if (d2?.signedUrl) url = d2.signedUrl }
      if (!url) { const { data: d3 } = await supabase.storage.from('Receipts').createSignedUrl(fp, 3600); if (d3?.signedUrl) url = d3.signedUrl }
      if (!url) { const { data: d4 } = supabase.storage.from('contractor-uploads').getPublicUrl(fp); if (d4?.publicUrl) url = d4.publicUrl }
      if (url) urls.push(url)
    }
    if (urls.length > 0) { setPreviewFiles(urls); setPreviewIndex(0) }
  }
  const closePreview = () => { setPreviewFiles([]); setPreviewIndex(0) }

  // ============ INVOICE ROW GRID ============
  const invGrid = 'grid-cols-[1fr_120px_90px_100px_120px_110px]'

  const renderInvoiceRows = (items: ContractorInvoice[]) => (
    <>
      <div className={`grid ${invGrid} gap-2 px-5 py-2 border-b border-gray-200 bg-gray-50`}>
        {['Invoice', 'Contractor', 'Period', 'Amount', 'Status', 'Actions'].map(h => (
          <span key={h} className={`vLbl text-[10px] ${THEME.textDim} font-bold uppercase ${h === 'Amount' ? 'text-right' : ''}`}>{h}</span>
        ))}
      </div>
      {items.map(inv => {
        const lines = inv.contractor_invoice_lines || []
        const isExp = expandedInvoice === inv.id
        const canReject = !['paid', 'rejected'].includes(inv.status)
        return (
          <div key={inv.id} className="border-b border-gray-100 last:border-0">
            <div className={`grid ${invGrid} gap-2 px-5 py-3 items-center ${THEME.cardHover} transition-colors ${getRowBorder(inv.status)}`}>
              <div className="flex items-center gap-2 min-w-0">
                <button onClick={() => setExpandedInvoice(isExp ? null : inv.id)} className="text-gray-400 hover:text-gray-700 vBtn shrink-0">
                  {isExp ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
                <div className="min-w-0">
                  <p className="text-gray-900 text-sm font-medium truncate">{inv.invoice_number}</p>
                  <p className="text-gray-400 text-[11px]">Submitted {fmtDate(inv.submitted_at?.split('T')[0] || inv.invoice_date)}</p>
                </div>
              </div>
              <span className="text-gray-600 text-sm truncate">{memberMap[inv.team_member_id] || '—'}</span>
              <span className="text-gray-400 text-xs vN">{fmtDateS(inv.period_start)} – {fmtDateS(inv.period_end)}</span>
              <span className="text-gray-900 text-sm font-medium text-right vN">{fmt$(inv.total_amount)}</span>
              <StatusDropdown status={inv.status} onChange={s => changeInvStatus(inv.id, s)} disabled={processing === inv.id} />
              <div className="flex items-center gap-1.5">
                {inv.receipt_url && (
                  <button onClick={() => openPreview(inv.receipt_url!)} className="p-1 rounded text-emerald-600 hover:text-emerald-500 hover:bg-emerald-50 vBtn" title="View receipt">
                    <Eye size={14} />
                  </button>
                )}
                {canReject && (
                  <button onClick={() => changeInvStatus(inv.id, 'rejected')} disabled={processing === inv.id}
                    className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 vBtn disabled:opacity-50" title="Reject">
                    <XCircle size={14} />
                  </button>
                )}
              </div>
            </div>
            {isExp && lines.length > 0 && (
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                <p className={`vLbl text-[10px] ${THEME.textDim} font-bold uppercase mb-2`}>Line Items</p>
                <table className="w-full text-sm">
                  <thead><tr className="text-gray-400 text-xs">
                    <th className="text-left pb-1.5 font-medium">Client</th><th className="text-left pb-1.5 font-medium">Description</th>
                    <th className="text-right pb-1.5 font-medium">Hours</th><th className="text-right pb-1.5 font-medium">Rate</th>
                    <th className="text-right pb-1.5 font-medium">%</th><th className="text-right pb-1.5 font-medium">Amount</th>
                  </tr></thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={i} className="border-t border-gray-200">
                        <td className="py-1.5 text-gray-700">{clientMap[l.client_id] || '—'}</td>
                        <td className="py-1.5 text-gray-500">{l.description}</td>
                        <td className="py-1.5 text-right text-gray-700 vN">{l.hours?.toFixed(1) || '—'}</td>
                        <td className="py-1.5 text-right text-gray-500 vN">{l.rate ? fmt$(l.rate) : '—'}</td>
                        <td className="py-1.5 text-right text-gray-500 vN">{l.allocation_pct ? `${l.allocation_pct}%` : '—'}</td>
                        <td className="py-1.5 text-right text-gray-900 font-medium vN">{fmt$(l.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-300">
                      <td colSpan={5} className="py-1.5 text-right text-gray-500 text-xs font-medium pr-4">Total</td>
                      <td className="py-1.5 text-right text-gray-900 font-semibold vN">{fmt$(lines.reduce((s, l) => s + l.amount, 0))}</td>
                    </tr>
                  </tbody>
                </table>
                {inv.notes && <p className="mt-2 text-xs text-gray-400 italic">Note: {inv.notes}</p>}
              </div>
            )}
          </div>
        )
      })}
    </>
  )

  // ============ EXPENSE ROW GRID ============
  const expGrid = 'grid-cols-[1fr_110px_110px_70px_70px_80px_85px_120px_80px]'

  const renderExpenseRows = (items: ContractorExpense[]) => (
    <>
      <div className={`grid ${expGrid} gap-2 px-5 py-2 border-b border-gray-200 bg-gray-50`}>
        {['Description', 'Contractor', 'Client', 'Date', 'Category', 'Amount', 'Billable', 'Status', 'Actions'].map(h => (
          <span key={h} className={`vLbl text-[10px] ${THEME.textDim} font-bold uppercase ${h === 'Amount' ? 'text-right' : ''}`}>{h}</span>
        ))}
      </div>
      {items.map(exp => {
        const cn = exp.client_id ? (clientMap[exp.client_id] || '—') : '—'
        const oh = isOverhead(cn); const bill = exp.is_billable ?? false
        const canReject = !['paid', 'rejected'].includes(exp.status)
        return (
          <div key={exp.id} className={`grid ${expGrid} gap-2 px-5 py-3 items-center border-b border-gray-100 last:border-0 ${THEME.cardHover} transition-colors ${getRowBorder(exp.status)}`}>
            <p className="text-gray-900 text-sm truncate">{exp.description}</p>
            <span className="text-gray-600 text-sm truncate">{memberMap[exp.team_member_id] || '—'}</span>
            <div className="flex items-center gap-1.5 min-w-0">
              <div className={`w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold shrink-0 ${oh ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-700'}`}>
                {cn !== '—' ? cn.charAt(0).toUpperCase() : '?'}
              </div>
              <span className={`text-xs truncate ${oh ? 'text-gray-500' : 'text-gray-700 font-medium'}`}>{cn}</span>
            </div>
            <span className="text-gray-400 text-xs vN">{fmtDateS(exp.date)}</span>
            <span className="text-xs text-gray-500">{EXPENSE_CATEGORIES[exp.category] || 'Other'}</span>
            <span className="text-gray-900 text-sm font-medium text-right vN">{fmt$(exp.amount)}</span>
            <button onClick={() => toggleBillable(exp.id, bill)} title={bill ? 'Click to mark non-billable' : 'Click to mark billable'}>
              <BillableBadge isBillable={bill} isOH={oh && !bill} />
            </button>
            <StatusDropdown status={exp.status} onChange={s => changeExpStatus(exp.id, s)} disabled={processing === exp.id} />
            <div className="flex items-center gap-1.5">
              {exp.receipt_url && (
                <button onClick={() => openPreview(exp.receipt_url!)} className="p-1 rounded text-emerald-600 hover:text-emerald-500 hover:bg-emerald-50 vBtn" title="View receipt">
                  <Eye size={14} />
                </button>
              )}
              {canReject && (
                <button onClick={() => changeExpStatus(exp.id, 'rejected')} disabled={processing === exp.id}
                  className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 vBtn disabled:opacity-50" title="Reject">
                  <XCircle size={14} />
                </button>
              )}
            </div>
          </div>
        )
      })}
    </>
  )

  // ============ RENDER ============
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={22} className="text-emerald-500 animate-spin" /></div>

  const isNoGroup = (dims: GroupDimension[]) => dims.length === 0 || (dims.length === 1 && dims[0] === 'none')

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
          { id: 'invoices' as const, label: 'AP Invoices', icon: FileText, count: invMetrics.pendingCount },
          { id: 'expenses' as const, label: 'Expenses', icon: Receipt, count: expMetrics.pendingCount },
        ].map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); clearFilters() }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium vBtn border-b-2 -mb-px transition-all duration-300 ${
              activeTab === tab.id ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300'
            }`}>
            <tab.icon size={15} />
            {tab.label}
            {tab.count > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">{tab.count}</span>}
          </button>
        ))}
      </div>

      {/* ===================== AP INVOICES ===================== */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <MetricCard label="Total AP" value={fmt$(invMetrics.total)} icon={DollarSign} accentColor="#2563eb" sub={`${filteredInvoices.length} invoices`} />
            <MetricCard label="Pending" value={fmt$(invMetrics.pendingAmt)} icon={Clock} accentColor="#d97706" sub={`${invMetrics.pendingCount} awaiting`} highlight={invMetrics.pendingCount > 0} />
            <MetricCard label="Approved" value={fmt$(invMetrics.approvedAmt)} icon={CheckCircle} accentColor="#3b82f6" sub={`${invMetrics.approvedCount} approved`} />
            <MetricCard label="Scheduled" value={fmt$(invMetrics.scheduledAmt)} icon={Calendar} accentColor="#8b5cf6" sub={`${invMetrics.scheduledCount} queued`} />
          </div>

          {invMetrics.pendingCount > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-amber-600" />
                <span className="text-sm text-amber-800 font-medium">{invMetrics.pendingCount} invoice{invMetrics.pendingCount !== 1 ? 's' : ''} pending — {fmt$(invMetrics.pendingAmt)}</span>
              </div>
              <button onClick={bulkApproveInv} disabled={processing === 'bulk'}
                className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 disabled:opacity-50 vBtn flex items-center gap-1.5">
                {processing === 'bulk' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} Approve All
              </button>
            </div>
          )}

          {/* Filters + Date + Group By */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-xs">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Search invoices..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" />
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selClass(filterStatus !== 'all')}>
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option><option value="approved">Approved</option>
                  <option value="scheduled">Scheduled</option><option value="paid">Paid</option><option value="rejected">Rejected</option>
                </select>
                <select value={filterMember} onChange={e => setFilterMember(e.target.value)} className={selClass(filterMember !== 'all')}>
                  <option value="all">All Contractors</option>
                  {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className={selClass(filterClient !== 'all')}>
                  <option value="all">All Clients</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {hasActiveFilters && <button onClick={clearFilters} className="px-2.5 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 vBtn flex items-center gap-1"><X size={12} /> Clear</button>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 rounded-lg border border-gray-200">
                  {(['month', 'quarter', 'year', 'all'] as const).map(r => (
                    <button key={r} onClick={() => setDateRange(r)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${dateRange === r ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
                      {r === 'all' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
                {dateRange !== 'all' && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => navigateDate(-1)} className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-500"><ChevronLeft size={14} /></button>
                    <span className="text-gray-900 text-sm font-medium px-3 py-1.5 bg-white border border-gray-200 rounded-lg min-w-[120px] text-center vN">{dateFilter.label}</span>
                    <button onClick={() => navigateDate(1)} className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-500"><ChevronRight size={14} /></button>
                  </div>
                )}
              </div>
            </div>
            <GroupBySelector dimensions={invGroupDims} onChange={d => { setInvGroupDims(d); setCollapsed(new Set()) }} />
          </div>

          {/* Invoice List */}
          {filteredInvoices.length > 0 ? (
            <div className="space-y-3">
              {isNoGroup(invGroupDims) ? (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  {renderInvoiceRows(filteredInvoices)}
                </div>
              ) : (
                invGroups.map(g => (
                  <GroupAccordion key={g.key} node={g} depth={0} collapsed={collapsed} onToggle={toggleCollapse} renderItems={(items) => renderInvoiceRows(items as ContractorInvoice[])} />
                ))
              )}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl text-center py-12">
              <FileText size={32} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500 font-medium">No invoices for {dateFilter.label}</p>
              <p className="text-xs text-gray-400 mt-1">Invoices appear here when contractors submit them through the Contractor Portal</p>
            </div>
          )}
        </div>
      )}

      {/* ===================== EXPENSES ===================== */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-3">
            <MetricCard label="Total Expenses" value={fmt$(expMetrics.total)} icon={Receipt} accentColor="#2563eb" sub={`${filteredExpenses.length} items`} />
            <MetricCard label="Pending" value={fmt$(expMetrics.pendingAmt)} icon={Clock} accentColor="#d97706" sub={`${expMetrics.pendingCount} awaiting`} highlight={expMetrics.pendingCount > 0} />
            <MetricCard label="Approved" value={fmt$(expMetrics.approvedAmt)} icon={CheckCircle} accentColor="#3b82f6" sub={`${expMetrics.approvedCount} approved`} />
            <MetricCard label="Paid" value={fmt$(expMetrics.paidAmt)} icon={DollarSign} accentColor="#059669" sub={`${expMetrics.paidCount} paid`} />
            <MetricCard label="Billable" value={fmt$(expMetrics.billableAmt)} icon={Tag} accentColor="#059669" sub={`${expMetrics.billableCount} tagged`} />
          </div>

          {expMetrics.pendingCount > 0 && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-amber-600" />
                <span className="text-sm text-amber-800 font-medium">{expMetrics.pendingCount} expense{expMetrics.pendingCount !== 1 ? 's' : ''} pending — {fmt$(expMetrics.pendingAmt)}</span>
              </div>
              <button onClick={bulkApproveExp} disabled={processing === 'bulk'}
                className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 disabled:opacity-50 vBtn flex items-center gap-1.5">
                {processing === 'bulk' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} Approve All
              </button>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-xs">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Search expenses..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" />
                </div>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selClass(filterStatus !== 'all')}>
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option><option value="approved">Approved</option>
                  <option value="scheduled">Scheduled</option><option value="paid">Paid</option><option value="rejected">Rejected</option>
                </select>
                <select value={filterMember} onChange={e => setFilterMember(e.target.value)} className={selClass(filterMember !== 'all')}>
                  <option value="all">All Contractors</option>
                  {teamMembers.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className={selClass(filterClient !== 'all')}>
                  <option value="all">All Clients</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {hasActiveFilters && <button onClick={clearFilters} className="px-2.5 py-2 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 vBtn flex items-center gap-1"><X size={12} /> Clear</button>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 rounded-lg border border-gray-200">
                  {(['month', 'quarter', 'year', 'all'] as const).map(r => (
                    <button key={r} onClick={() => setDateRange(r)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${dateRange === r ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}>
                      {r === 'all' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>
                {dateRange !== 'all' && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => navigateDate(-1)} className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-500"><ChevronLeft size={14} /></button>
                    <span className="text-gray-900 text-sm font-medium px-3 py-1.5 bg-white border border-gray-200 rounded-lg min-w-[120px] text-center vN">{dateFilter.label}</span>
                    <button onClick={() => navigateDate(1)} className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-500"><ChevronRight size={14} /></button>
                  </div>
                )}
              </div>
            </div>
            <GroupBySelector dimensions={expGroupDims} onChange={d => { setExpGroupDims(d); setCollapsed(new Set()) }} />
          </div>

          {filteredExpenses.length > 0 ? (
            <div className="space-y-3">
              {isNoGroup(expGroupDims) ? (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  {renderExpenseRows(filteredExpenses)}
                </div>
              ) : (
                expGroups.map(g => (
                  <GroupAccordion key={g.key} node={g} depth={0} collapsed={collapsed} onToggle={toggleCollapse} renderItems={(items) => renderExpenseRows(items as ContractorExpense[])} />
                ))
              )}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl text-center py-12">
              <Receipt size={32} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm text-gray-500 font-medium">No expenses for {dateFilter.label}</p>
            </div>
          )}
        </div>
      )}

      {/* ===================== ATTACHMENT PREVIEW ===================== */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md vFade" onClick={closePreview}>
          <div className="relative bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xl flex flex-col" style={{ width: '80vw', height: '85vh', maxWidth: '1200px' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <span className="text-gray-900 text-sm font-medium">Attachment Preview</span>
                {previewFiles.length > 1 && <span className="text-gray-400 text-xs vN">{previewIndex + 1} of {previewFiles.length}</span>}
              </div>
              <div className="flex items-center gap-2">
                {previewFiles.length > 1 && (
                  <div className="flex items-center gap-1 mr-2">
                    <button onClick={() => setPreviewIndex(i => Math.max(0, i - 1))} disabled={previewIndex === 0} className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 disabled:opacity-30"><ChevronLeft size={14} /></button>
                    <button onClick={() => setPreviewIndex(i => Math.min(previewFiles.length - 1, i + 1))} disabled={previewIndex === previewFiles.length - 1} className="p-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-500 disabled:opacity-30"><ChevronRight size={14} /></button>
                  </div>
                )}
                <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-600 text-xs flex items-center gap-1.5"><ExternalLink size={12} /> Open</a>
                <a href={previewUrl} download className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-gray-600 text-xs flex items-center gap-1.5"><Download size={12} /> Download</a>
                <button onClick={closePreview} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 vBtn"><X size={16} /></button>
              </div>
            </div>
            <div className="flex-1 bg-gray-100 overflow-hidden relative">
              {previewUrl.match(/\.(jpg|jpeg|png|gif|webp|heic)$/i) || previewUrl.includes('image') ? (
                <div className="h-full flex items-center justify-center p-4"><img src={previewUrl} alt="Attachment" className="max-h-full max-w-full object-contain rounded-lg shadow-lg" /></div>
              ) : (<iframe src={previewUrl} className="w-full h-full" title="Document preview" />)}
              {previewFiles.length > 1 && previewIndex > 0 && (
                <button onClick={() => setPreviewIndex(i => i - 1)} className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow-lg text-gray-600 vBtn"><ChevronLeft size={20} /></button>
              )}
              {previewFiles.length > 1 && previewIndex < previewFiles.length - 1 && (
                <button onClick={() => setPreviewIndex(i => i + 1)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow-lg text-gray-600 vBtn"><ChevronRight size={20} /></button>
              )}
            </div>
            {previewFiles.length > 1 && (
              <div className="flex items-center gap-2 px-5 py-2.5 border-t border-gray-200 bg-gray-50 overflow-x-auto">
                {previewFiles.map((f, i) => (
                  <button key={i} onClick={() => setPreviewIndex(i)}
                    className={`flex-shrink-0 w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xs font-medium transition-colors ${
                      i === previewIndex ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                    }`}>
                    {(f.match(/\.(jpg|jpeg|png|gif|webp|heic)/i) || f.includes('image')) ? <Eye size={14} /> : <FileText size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
