'use client'

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  DollarSign, Clock, AlertTriangle, TrendingUp,
  ChevronDown, ChevronUp, Search, Zap, CheckCircle2,
  MoreHorizontal, Trash2, ChevronRight, Layers, List
} from 'lucide-react'
import {
  PieChart as RePieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts'
import {
  THEME, COLORS, PIE_COLORS,
  formatCurrency, formatDateShort, getInvoiceStatus, getDaysOverdue, getPaymentProbability,
  MetricCard, StatusBadge, ProbabilityBadge, AgingBar, CustomTooltip,
  CollapsibleSection, PaymentModal
} from './shared'

// ============ SINGLE SHARED DROPDOWN ============
interface DropdownState {
  open: boolean; invoiceId: string; field: 'client_id' | 'project_id' | 'action'
  options: { id: string; name: string }[]; currentValue: string; pos: { top: number; left: number }
}
const EMPTY_DROPDOWN: DropdownState = { open: false, invoiceId: '', field: 'client_id', options: [], currentValue: '', pos: { top: 0, left: 0 } }

// ============ DATE PERIOD HELPERS ============
type DatePeriod = 'all' | 'ytd' | 'q1' | 'q2' | 'q3' | 'q4' | 'jan' | 'feb' | 'mar' | 'apr' | 'may' | 'jun' | 'jul' | 'aug' | 'sep' | 'oct' | 'nov' | 'dec'

const PERIOD_OPTIONS: { value: DatePeriod; label: string }[] = [
  { value: 'all', label: 'All Time' }, { value: 'ytd', label: 'Year to Date' },
  { value: 'q1', label: 'Q1 (Jan–Mar)' }, { value: 'q2', label: 'Q2 (Apr–Jun)' },
  { value: 'q3', label: 'Q3 (Jul–Sep)' }, { value: 'q4', label: 'Q4 (Oct–Dec)' },
  { value: 'jan', label: 'January' }, { value: 'feb', label: 'February' }, { value: 'mar', label: 'March' },
  { value: 'apr', label: 'April' }, { value: 'may', label: 'May' }, { value: 'jun', label: 'June' },
  { value: 'jul', label: 'July' }, { value: 'aug', label: 'August' }, { value: 'sep', label: 'September' },
  { value: 'oct', label: 'October' }, { value: 'nov', label: 'November' }, { value: 'dec', label: 'December' },
]

function getDateRange(period: DatePeriod, year: number): { start: Date; end: Date } | null {
  if (period === 'all') return null
  const monthMap: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 }
  if (period === 'ytd') return { start: new Date(year, 0, 1), end: new Date() }
  if (period === 'q1') return { start: new Date(year, 0, 1), end: new Date(year, 2, 31) }
  if (period === 'q2') return { start: new Date(year, 3, 1), end: new Date(year, 5, 30) }
  if (period === 'q3') return { start: new Date(year, 6, 1), end: new Date(year, 8, 30) }
  if (period === 'q4') return { start: new Date(year, 9, 1), end: new Date(year, 11, 31) }
  const m = monthMap[period]
  if (m !== undefined) return { start: new Date(year, m, 1), end: new Date(year, m + 1, 0) }
  return null
}

// ============ MAIN COMPONENT ============
interface ARSectionProps {
  invoices: any[]; clients: any[]; projects: any[]; selectedYear: number | 'all'
  onUpdateInvoice: (id: string, updates: any) => void
  onRecordPayment: (id: string, amount: number) => void
  onDeleteInvoice?: (id: string) => void
}

export default function ARSection({ invoices, clients, projects, selectedYear, onUpdateInvoice, onRecordPayment, onDeleteInvoice }: ARSectionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterClient, setFilterClient] = useState('all')
  const [sortField, setSortField] = useState('due_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])
  const [paymentInvoice, setPaymentInvoice] = useState<any>(null)
  const [datePeriod, setDatePeriod] = useState<DatePeriod>('all')
  const [viewMode, setViewMode] = useState<'flat' | 'grouped'>('grouped')
  const [collapsedClients, setCollapsedClients] = useState<Set<string>>(new Set())

  const [dropdown, setDropdown] = useState<DropdownState>(EMPTY_DROPDOWN)
  const [ddSearch, setDdSearch] = useState('')
  const ddRef = useRef<HTMLDivElement>(null)
  const ddSearchRef = useRef<HTMLInputElement>(null)
  const closeDropdown = useCallback(() => { setDropdown(EMPTY_DROPDOWN); setDdSearch('') }, [])

  const openDropdown = useCallback((e: React.MouseEvent<HTMLButtonElement>, invoiceId: string, field: 'client_id' | 'project_id', options: { id: string; name: string }[], currentValue: string) => {
    e.preventDefault(); e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const dropW = 224, dropH = 260
    const top = rect.bottom + 4 + dropH > window.innerHeight ? Math.max(8, rect.top - dropH - 4) : rect.bottom + 4
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - dropW - 8)
    setDropdown({ open: true, invoiceId, field, options, currentValue, pos: { top, left } })
    setDdSearch('')
    setTimeout(() => ddSearchRef.current?.focus(), 50)
  }, [])

  useEffect(() => {
    if (!dropdown.open) return
    const handle = (e: MouseEvent) => { if (ddRef.current?.contains(e.target as Node)) return; closeDropdown() }
    const id = setTimeout(() => document.addEventListener('mouseup', handle), 100)
    return () => { clearTimeout(id); document.removeEventListener('mouseup', handle) }
  }, [dropdown.open, closeDropdown])

  const handleDropdownSelect = useCallback((optionId: string) => {
    onUpdateInvoice(dropdown.invoiceId, { [dropdown.field]: optionId || null }); closeDropdown()
  }, [dropdown.invoiceId, dropdown.field, onUpdateInvoice, closeDropdown])

  const [actionMenu, setActionMenu] = useState<{ open: boolean; invoiceId: string; invoice: any; pos: { top: number; left: number } }>({ open: false, invoiceId: '', invoice: null, pos: { top: 0, left: 0 } })
  const actionRef = useRef<HTMLDivElement>(null)

  const openActionMenu = useCallback((e: React.MouseEvent, invoice: any) => {
    e.preventDefault(); e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setActionMenu({ open: true, invoiceId: invoice.id, invoice, pos: { top: rect.bottom + 4, left: Math.min(rect.right - 160, window.innerWidth - 168) } })
  }, [])

  useEffect(() => {
    if (!actionMenu.open) return
    const handle = (e: MouseEvent) => { if (actionRef.current?.contains(e.target as Node)) return; setActionMenu(prev => ({ ...prev, open: false })) }
    const id = setTimeout(() => document.addEventListener('mouseup', handle), 100)
    return () => { clearTimeout(id); document.removeEventListener('mouseup', handle) }
  }, [actionMenu.open])

  const currentYear = typeof selectedYear === 'number' ? selectedYear : new Date().getFullYear()

  const filteredInvoices = useMemo(() => {
    let result = [...invoices]
    if (selectedYear !== 'all') result = result.filter(inv => new Date(inv.invoice_date).getFullYear() === selectedYear)
    const range = getDateRange(datePeriod, currentYear)
    if (range) result = result.filter(inv => { const d = new Date(inv.invoice_date); return d >= range.start && d <= range.end })
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(inv =>
        inv.invoice_number?.toString().toLowerCase().includes(q) ||
        inv.client?.toLowerCase().includes(q) ||
        inv.customer_project_raw?.toLowerCase().includes(q) ||
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
    if (filterClient !== 'all') result = result.filter(inv => inv.client_id === filterClient)
    result.sort((a, b) => {
      let aVal = a[sortField], bVal = b[sortField]
      if (['invoice_date', 'due_date'].includes(sortField)) { aVal = new Date(aVal || 0).getTime(); bVal = new Date(bVal || 0).getTime() }
      if (typeof aVal === 'string') { aVal = aVal.toLowerCase(); bVal = (bVal || '').toLowerCase() }
      return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
    })
    return result
  }, [invoices, selectedYear, datePeriod, currentYear, searchQuery, filterStatus, filterClient, sortField, sortDir, clients])

  const groupedInvoices = useMemo(() => {
    const groups: Record<string, { clientName: string; clientId: string | null; invoices: any[]; totalAmount: number; totalBalance: number }> = {}
    filteredInvoices.forEach(inv => {
      const client = clients.find(c => c.id === inv.client_id)
      const key = inv.client_id || 'unassigned'
      const name = client?.name || inv.client || 'Unassigned'
      if (!groups[key]) groups[key] = { clientName: name, clientId: inv.client_id, invoices: [], totalAmount: 0, totalBalance: 0 }
      groups[key].invoices.push(inv)
      groups[key].totalAmount += inv.amount
      groups[key].totalBalance += inv.balance
    })
    return Object.values(groups).sort((a, b) => b.totalBalance - a.totalBalance)
  }, [filteredInvoices, clients])

  const arMetrics = useMemo(() => {
    const unpaid = invoices.filter(inv => inv.balance > 0)
    const totalAR = unpaid.reduce((sum, inv) => sum + inv.balance, 0)
    const aging = { current: { amount: 0, count: 0 }, days_1_30: { amount: 0, count: 0 }, days_31_60: { amount: 0, count: 0 }, days_61_90: { amount: 0, count: 0 }, days_90_plus: { amount: 0, count: 0 } }
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
      ? paidInvoices.reduce((sum, inv) => sum + Math.max(0, Math.floor((new Date(inv.paid_date).getTime() - new Date(inv.invoice_date).getTime()) / (1000 * 60 * 60 * 24))), 0) / paidInvoices.length
      : 0
    const recentInvoices = invoices.filter(inv => { const d = new Date(inv.invoice_date); const ago = new Date(); ago.setDate(ago.getDate() - 180); return d >= ago })
    const paidOnTime = recentInvoices.filter(inv => { if (inv.balance > 0 || !inv.paid_date) return false; return Math.floor((new Date(inv.paid_date).getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24)) <= 0 })
    const collectionRate = recentInvoices.length > 0 ? (paidOnTime.length / recentInvoices.length) * 100 : 0
    return { totalAR, unpaidCount: unpaid.length, overdueTotal, aging, dso, collectionRate }
  }, [invoices])

  const arByClient = useMemo(() => {
    const clientAR: Record<string, number> = {}
    invoices.filter(inv => inv.balance > 0).forEach(inv => {
      const client = clients.find(c => c.id === inv.client_id)
      const name = client?.name || inv.client || 'Unassigned'
      clientAR[name] = (clientAR[name] || 0) + inv.balance
    })
    return Object.entries(clientAR).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [invoices, clients])

  const handleSort = (field: string) => { if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); else { setSortField(field); setSortDir('asc') } }
  const handleSelectAll = () => setSelectedInvoices(prev => prev.length === filteredInvoices.length ? [] : filteredInvoices.map(i => i.id))
  const handleBulkMarkPaid = () => { for (const id of selectedInvoices) { const inv = invoices.find(i => i.id === id); if (inv && inv.balance > 0) onRecordPayment(id, inv.balance) }; setSelectedInvoices([]) }
  const handleBulkDelete = () => { if (!onDeleteInvoice) return; if (!confirm(`Delete ${selectedInvoices.length} invoice(s)?`)) return; for (const id of selectedInvoices) onDeleteInvoice(id); setSelectedInvoices([]) }
  const toggleClientCollapse = (key: string) => { setCollapsedClients(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n }) }

  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients])
  const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects])

  const selectClass = "bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 cursor-pointer"

  const renderRow = (invoice: any) => {
    const status = getInvoiceStatus(invoice.due_date, invoice.amount, invoice.balance)
    const daysOverdue = getDaysOverdue(invoice.due_date)
    const probability = invoice.balance > 0 ? getPaymentProbability(invoice, invoices) : null
    const client = clientMap.get(invoice.client_id)
    const project = projectMap.get(invoice.project_id)
    const isSelected = selectedInvoices.includes(invoice.id)

    return (
      <div key={invoice.id}
        className={`grid grid-cols-[32px_72px_52px_72px_72px_1fr_1fr_100px_100px_80px_48px] items-center gap-2 py-2.5 px-4 hover:bg-slate-50 transition-colors border-b border-slate-100 ${isSelected ? 'bg-emerald-50/50' : ''}`}>
        <div>
          <input type="checkbox" checked={isSelected}
            onChange={() => setSelectedInvoices(prev => prev.includes(invoice.id) ? prev.filter(i => i !== invoice.id) : [...prev, invoice.id])}
            className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/30 cursor-pointer" />
        </div>
        <div><span className="text-sm font-medium text-emerald-600">#{invoice.invoice_number}</span></div>
        <div>{probability ? <ProbabilityBadge score={probability.score} color={probability.color} /> : <span className="text-xs text-emerald-600">✓</span>}</div>
        <div><span className="text-xs text-slate-500">{formatDateShort(invoice.invoice_date)}</span></div>
        <div><span className={`text-xs ${status.includes('overdue') ? 'text-red-600 font-medium' : 'text-slate-500'}`}>{formatDateShort(invoice.due_date)}</span></div>
        <div className="min-w-0">
          <button onClick={(e) => openDropdown(e, invoice.id, 'client_id', clients, invoice.client_id || '')}
            className={`text-xs px-1.5 py-1 rounded truncate max-w-full block text-left cursor-pointer ${
              client ? 'text-slate-700 hover:bg-slate-100' : 'text-emerald-600/70 hover:text-emerald-600 hover:bg-emerald-50 italic'
            }`}>
            {client?.name || 'Assign'}
          </button>
        </div>
        <div className="min-w-0">
          <button onClick={(e) => {
              const filtered = invoice.client_id ? projects.filter(p => p.client_id === invoice.client_id || !p.client_id) : projects
              openDropdown(e, invoice.id, 'project_id', filtered, invoice.project_id || '')
            }}
            className={`text-xs px-1.5 py-1 rounded truncate max-w-full block text-left cursor-pointer ${
              project ? 'text-slate-700 hover:bg-slate-100' : 'text-emerald-600/70 hover:text-emerald-600 hover:bg-emerald-50 italic'
            }`}>
            {project?.name || 'Assign'}
          </button>
        </div>
        <div className="text-right"><span className="text-sm font-medium text-slate-900">{formatCurrency(invoice.amount)}</span></div>
        <div className="text-right"><span className={`text-sm font-semibold ${invoice.balance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{formatCurrency(invoice.balance)}</span></div>
        <div><StatusBadge status={status} daysOverdue={daysOverdue} /></div>
        <div className="flex items-center justify-end">
          <button onClick={(e) => openActionMenu(e, invoice)} className="p-1 hover:bg-slate-100 rounded transition-colors">
            <MoreHorizontal size={16} className="text-slate-400" />
          </button>
        </div>
      </div>
    )
  }

  const ddFiltered = useMemo(() => {
    if (!dropdown.open) return []
    const q = ddSearch.toLowerCase()
    return dropdown.options.filter(o => o.name.toLowerCase().includes(q))
  }, [dropdown.open, dropdown.options, ddSearch])

  return (
    <div className="space-y-5">
      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard label="Total AR" value={formatCurrency(arMetrics.totalAR)} subtitle={`${arMetrics.unpaidCount} unpaid invoices`} icon={DollarSign} color="amber" />
        <MetricCard label="Current" value={formatCurrency(arMetrics.aging.current.amount)} subtitle={`${arMetrics.aging.current.count} invoices`} icon={CheckCircle2} color="emerald" />
        <MetricCard label="Overdue" value={formatCurrency(arMetrics.overdueTotal)} subtitle="Past due date" icon={AlertTriangle} color="rose" />
        <MetricCard label="Avg DSO" value={`${arMetrics.dso.toFixed(0)} days`} subtitle="Days sales outstanding" icon={Clock} color="blue" />
        <MetricCard label="Collection Rate" value={`${arMetrics.collectionRate.toFixed(0)}%`} subtitle="Paid on time (180d)" icon={TrendingUp} color={arMetrics.collectionRate >= 80 ? 'emerald' : arMetrics.collectionRate >= 60 ? 'amber' : 'rose'} />
      </div>

      {/* Aging & Charts */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">AR Aging</h2>
                <p className="text-xs text-slate-400 mt-0.5">Outstanding balance by age</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Total Outstanding</p>
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

        <div className="col-span-12 lg:col-span-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm h-full">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">AR by Client</h2>
            {arByClient.length > 0 ? (
              <>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie data={arByClient} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                        {arByClient.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-2">
                  {arByClient.slice(0, 5).map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-xs text-slate-600 truncate max-w-32">{item.name}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-900">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No outstanding AR</div>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Table */}
      <CollapsibleSection
        title="Invoices"
        subtitle={`${filteredInvoices.filter(i => i.balance > 0).length} unpaid • ${filteredInvoices.filter(i => i.balance === 0).length} paid`}
        badge={filteredInvoices.length}
        defaultExpanded={true}
        noPadding
      >
        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-emerald-500" />
            <span className="text-xs text-slate-400">Payment probability powered by AI</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search invoices..."
                className="bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 w-40 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" />
            </div>
            <select value={datePeriod} onChange={(e) => setDatePeriod(e.target.value as DatePeriod)} className={selectClass}>
              {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectClass}>
              <option value="all">All Status</option>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
              <option value="current">Current</option>
              <option value="overdue">Overdue</option>
            </select>
            <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)} className={selectClass}>
              <option value="all">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg overflow-hidden">
              <button onClick={() => setViewMode('flat')} className={`p-1.5 transition-colors ${viewMode === 'flat' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Flat list"><List size={14} /></button>
              <button onClick={() => setViewMode('grouped')} className={`p-1.5 transition-colors ${viewMode === 'grouped' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Group by client"><Layers size={14} /></button>
            </div>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedInvoices.length > 0 && (
          <div className="flex items-center gap-4 px-4 py-2.5 bg-emerald-50 border-b border-emerald-200">
            <span className="text-xs font-medium text-emerald-700">{selectedInvoices.length} selected</span>
            <button onClick={handleBulkMarkPaid} className="text-xs text-slate-600 hover:text-slate-900 transition-colors">Mark as Paid</button>
            <button onClick={handleBulkDelete} className="text-xs text-red-600 hover:text-red-700 transition-colors">Delete</button>
            <button onClick={() => {
              const csv = ['Invoice #,Date,Due,Client,Project,Amount,Balance,Status']
              filteredInvoices.filter(i => selectedInvoices.includes(i.id)).forEach(i => {
                csv.push(`${i.invoice_number},${i.invoice_date},${i.due_date},"${clientMap.get(i.client_id)?.name || i.client || ''}","${projectMap.get(i.project_id)?.name || i.project || ''}",${i.amount},${i.balance},${getInvoiceStatus(i.due_date, i.amount, i.balance)}`)
              })
              const blob = new Blob([csv.join('\n')], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'invoices-export.csv'; a.click()
            }} className="text-xs text-slate-600 hover:text-slate-900 transition-colors">Export</button>
          </div>
        )}

        {/* Column Headers */}
        <div className="grid grid-cols-[32px_72px_52px_72px_72px_1fr_1fr_100px_100px_80px_48px] items-center gap-2 py-2 px-4 bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <div>
            <input type="checkbox" checked={selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0} onChange={handleSelectAll}
              className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/30 cursor-pointer" />
          </div>
          <button onClick={() => handleSort('invoice_number')} className="flex items-center gap-0.5 hover:text-slate-700 transition-colors">
            Inv # {sortField === 'invoice_number' && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
          </button>
          <div className="flex items-center gap-0.5" title="Payment probability"><Zap size={8} className="text-emerald-500" /> Prob</div>
          <button onClick={() => handleSort('invoice_date')} className="flex items-center gap-0.5 hover:text-slate-700 transition-colors">
            Date {sortField === 'invoice_date' && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
          </button>
          <button onClick={() => handleSort('due_date')} className="flex items-center gap-0.5 hover:text-slate-700 transition-colors">
            Due {sortField === 'due_date' && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
          </button>
          <div>Client</div>
          <div>Project</div>
          <button onClick={() => handleSort('amount')} className="flex items-center justify-end gap-0.5 hover:text-slate-700 transition-colors">
            Amount {sortField === 'amount' && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
          </button>
          <button onClick={() => handleSort('balance')} className="flex items-center justify-end gap-0.5 hover:text-slate-700 transition-colors">
            Balance {sortField === 'balance' && (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
          </button>
          <div>Status</div>
          <div></div>
        </div>

        {/* Invoice Rows */}
        <div className="max-h-[600px] overflow-y-auto">
          {filteredInvoices.length > 0 ? (
            viewMode === 'flat' ? (
              filteredInvoices.map(renderRow)
            ) : (
              groupedInvoices.map(group => {
                const key = group.clientId || 'unassigned'
                const collapsed = collapsedClients.has(key)
                return (
                  <div key={key}>
                    <button onClick={() => toggleClientCollapse(key)}
                      className="w-full grid grid-cols-[32px_1fr_100px_100px_80px_48px] items-center gap-2 py-2.5 px-4 bg-slate-50 hover:bg-slate-100 border-b border-slate-200 transition-colors">
                      <div className="flex items-center"><ChevronRight size={14} className={`text-slate-400 transition-transform ${collapsed ? '' : 'rotate-90'}`} /></div>
                      <div className="flex items-center gap-2 text-left">
                        <span className="text-sm font-semibold text-slate-900">{group.clientName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-500 font-medium">{group.invoices.length}</span>
                      </div>
                      <div className="text-right"><span className="text-sm font-medium text-slate-900">{formatCurrency(group.totalAmount)}</span></div>
                      <div className="text-right"><span className="text-sm font-semibold text-amber-600">{formatCurrency(group.totalBalance)}</span></div>
                      <div></div><div></div>
                    </button>
                    {!collapsed && group.invoices.map(renderRow)}
                  </div>
                )
              })
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center"><DollarSign size={28} className="text-emerald-500" /></div>
              <div className="text-center">
                <p className="font-medium text-slate-600">No invoices found</p>
                <p className="text-sm text-slate-400 mt-1">Sync with QuickBooks to import invoices</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {filteredInvoices.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200">
            <p className="text-xs text-slate-400">Showing {filteredInvoices.length} of {invoices.length} invoices</p>
            <div className="flex items-center gap-6 text-sm">
              <div><span className="text-slate-500">Total: </span><span className="font-semibold text-slate-900">{formatCurrency(filteredInvoices.reduce((s, i) => s + i.amount, 0))}</span></div>
              <div><span className="text-slate-500">Balance: </span><span className="font-semibold text-amber-600">{formatCurrency(filteredInvoices.reduce((s, i) => s + i.balance, 0))}</span></div>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Assign Dropdown */}
      {dropdown.open && (
        <div ref={ddRef} className="fixed z-[9999] bg-white border border-slate-200 rounded-lg shadow-xl py-1"
          style={{ top: dropdown.pos.top, left: dropdown.pos.left, width: 224 }}>
          <div className="px-2 py-1.5">
            <input ref={ddSearchRef} type="text" value={ddSearch} onChange={e => setDdSearch(e.target.value)} placeholder="Search..."
              className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-400" />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {dropdown.currentValue && (
              <button onClick={() => handleDropdownSelect('')}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-50 italic">Clear assignment</button>
            )}
            {ddFiltered.map(o => (
              <button key={o.id} onClick={() => handleDropdownSelect(o.id)}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-emerald-50 transition-colors truncate ${
                  o.id === dropdown.currentValue ? 'text-emerald-600 font-medium bg-emerald-50' : 'text-slate-700'
                }`}>
                {o.name}
              </button>
            ))}
            {ddFiltered.length === 0 && <p className="px-3 py-2 text-xs text-slate-400">No matches</p>}
          </div>
        </div>
      )}

      {/* Action Menu */}
      {actionMenu.open && (
        <div ref={actionRef} className="fixed z-[9999] bg-white border border-slate-200 rounded-lg shadow-xl py-1 w-40"
          style={{ top: actionMenu.pos.top, left: actionMenu.pos.left }}>
          {actionMenu.invoice?.balance > 0 && (
            <button onClick={() => { setPaymentInvoice(actionMenu.invoice); setActionMenu(prev => ({ ...prev, open: false })) }}
              className="w-full text-left px-3 py-1.5 text-xs text-emerald-600 hover:bg-emerald-50 flex items-center gap-2">
              <DollarSign size={12} /> Record Payment
            </button>
          )}
          {onDeleteInvoice && (
            <button onClick={() => {
              if (confirm('Delete this invoice?')) onDeleteInvoice(actionMenu.invoiceId)
              setActionMenu(prev => ({ ...prev, open: false }))
            }}
              className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2">
              <Trash2 size={12} /> Delete Invoice
            </button>
          )}
        </div>
      )}

      {/* Payment Modal */}
      {paymentInvoice && (
        <PaymentModal invoice={paymentInvoice} onClose={() => setPaymentInvoice(null)}
          onSave={(id, amount) => { onRecordPayment(id, amount); setPaymentInvoice(null) }} type="invoice" />
      )}
    </div>
  )
}
