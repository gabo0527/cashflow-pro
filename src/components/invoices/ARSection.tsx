'use client'

import React, { useState, useMemo } from 'react'
import {
  DollarSign, Clock, AlertTriangle, TrendingUp,
  ChevronDown, ChevronUp, Search, Zap, CheckCircle2,
  MoreHorizontal
} from 'lucide-react'
import {
  PieChart as RePieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts'
import {
  THEME, COLORS, PIE_COLORS,
  formatCurrency, formatDateShort, getInvoiceStatus, getDaysOverdue, getPaymentProbability,
  MetricCard, StatusBadge, ProbabilityBadge, AgingBar, CustomTooltip,
  EditableSelect, CollapsibleSection, PaymentModal
} from './shared'

interface ARSectionProps {
  invoices: any[]
  clients: any[]
  projects: any[]
  selectedYear: number | 'all'
  onUpdateInvoice: (id: string, updates: any) => void
  onRecordPayment: (id: string, amount: number) => void
}

export default function ARSection({ invoices, clients, projects, selectedYear, onUpdateInvoice, onRecordPayment }: ARSectionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterClient, setFilterClient] = useState('all')
  const [sortField, setSortField] = useState('due_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([])
  const [paymentInvoice, setPaymentInvoice] = useState<any>(null)

  // Filtered & sorted
  const filteredInvoices = useMemo(() => {
    let result = [...invoices]
    if (selectedYear !== 'all') result = result.filter(inv => new Date(inv.invoice_date).getFullYear() === selectedYear)
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
    if (filterClient !== 'all') result = result.filter(inv => inv.client_id === filterClient)
    result.sort((a, b) => {
      let aVal = a[sortField], bVal = b[sortField]
      if (['invoice_date', 'due_date'].includes(sortField)) { aVal = new Date(aVal).getTime(); bVal = new Date(bVal).getTime() }
      return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
    })
    return result
  }, [invoices, selectedYear, searchQuery, filterStatus, filterClient, sortField, sortDir, clients])

  // AR Metrics
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

  // AR by Client
  const arByClient = useMemo(() => {
    const clientAR: Record<string, number> = {}
    invoices.filter(inv => inv.balance > 0).forEach(inv => {
      const client = clients.find(c => c.id === inv.client_id)
      const name = client?.name || inv.qbo_customer || 'Unassigned'
      clientAR[name] = (clientAR[name] || 0) + inv.balance
    })
    return Object.entries(clientAR).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [invoices, clients])

  const handleSort = (field: string) => { if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); else { setSortField(field); setSortDir('asc') } }
  const handleSelectAll = () => setSelectedInvoices(prev => prev.length === filteredInvoices.length ? [] : filteredInvoices.map(i => i.id))

  const handleBulkMarkPaid = async () => {
    for (const id of selectedInvoices) {
      const inv = invoices.find(i => i.id === id)
      if (inv && inv.balance > 0) onRecordPayment(id, inv.balance)
    }
    setSelectedInvoices([])
  }

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-5 gap-4">
        <MetricCard label="Total AR" value={formatCurrency(arMetrics.totalAR)} subtitle={`${arMetrics.unpaidCount} unpaid invoices`} icon={DollarSign} color="amber" />
        <MetricCard label="Current" value={formatCurrency(arMetrics.aging.current.amount)} subtitle={`${arMetrics.aging.current.count} invoices`} icon={CheckCircle2} color="emerald" />
        <MetricCard label="Overdue" value={formatCurrency(arMetrics.overdueTotal)} subtitle="Past due date" icon={AlertTriangle} color="rose" />
        <MetricCard label="Avg DSO" value={`${arMetrics.dso.toFixed(0)} days`} subtitle="Days sales outstanding" icon={Clock} color="blue" />
        <MetricCard label="Collection Rate" value={`${arMetrics.collectionRate.toFixed(0)}%`} subtitle="Paid on time (180d)" icon={TrendingUp} color={arMetrics.collectionRate >= 80 ? 'emerald' : arMetrics.collectionRate >= 60 ? 'amber' : 'rose'} />
      </div>

      {/* Aging & Charts */}
      <div className="grid grid-cols-12 gap-6">
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

        <div className="col-span-12 lg:col-span-4">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-6 h-full`}>
            <h2 className={`text-sm font-semibold ${THEME.textPrimary} mb-4`}>AR by Client</h2>
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
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
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

      {/* Invoice Table */}
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
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search invoices..."
                className="bg-white/[0.05] border border-white/[0.1] rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
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
              {clients.map(c => <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>)}
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedInvoices.length > 0 && (
          <div className="flex items-center gap-4 px-6 py-3 bg-emerald-500/10 border-b border-emerald-500/20">
            <span className="text-sm font-medium text-emerald-400">{selectedInvoices.length} selected</span>
            <button onClick={handleBulkMarkPaid} className={`text-sm ${THEME.textSecondary} hover:text-white transition-colors`}>Mark as Paid</button>
            <button className={`text-sm ${THEME.textSecondary} hover:text-white transition-colors`}>Send Reminder</button>
            <button onClick={() => {
              const csv = ['Invoice #,Date,Due,Client,Project,Amount,Balance,Status']
              filteredInvoices.filter(i => selectedInvoices.includes(i.id)).forEach(i => {
                const client = clients.find(c => c.id === i.client_id)
                const project = projects.find(p => p.id === i.project_id)
                csv.push(`${i.invoice_number},${i.invoice_date},${i.due_date},"${client?.name || ''}","${project?.name || ''}",${i.amount},${i.balance},${getInvoiceStatus(i.due_date, i.amount, i.balance)}`)
              })
              const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
              const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'invoices-export.csv'; a.click()
            }} className={`text-sm ${THEME.textSecondary} hover:text-white transition-colors`}>Export</button>
          </div>
        )}

        {/* Column Headers */}
        <div className={`flex items-center gap-3 py-2.5 px-4 bg-white/[0.03] border-b ${THEME.glassBorder} text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>
          <div className="w-8 shrink-0"><input type="checkbox" checked={selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0} onChange={handleSelectAll} className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/30" /></div>
          <button onClick={() => handleSort('invoice_number')} className="w-20 shrink-0 flex items-center gap-1 hover:text-white transition-colors">Inv # {sortField === 'invoice_number' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</button>
          <div className="w-14 shrink-0 flex items-center gap-1"><Zap size={10} className="text-emerald-400" /> Prob</div>
          <button onClick={() => handleSort('invoice_date')} className="w-20 shrink-0 flex items-center gap-1 hover:text-white transition-colors">Date {sortField === 'invoice_date' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</button>
          <button onClick={() => handleSort('due_date')} className="w-20 shrink-0 flex items-center gap-1 hover:text-white transition-colors">Due {sortField === 'due_date' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</button>
          <div className="w-28 shrink-0">Client</div>
          <div className="w-36 shrink-0">Project</div>
          <div className="flex-1">QBO Customer</div>
          <button onClick={() => handleSort('amount')} className="w-24 text-right shrink-0 flex items-center justify-end gap-1 hover:text-white transition-colors">Amount {sortField === 'amount' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</button>
          <button onClick={() => handleSort('balance')} className="w-24 text-right shrink-0 flex items-center justify-end gap-1 hover:text-white transition-colors">Balance {sortField === 'balance' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</button>
          <div className="w-24 shrink-0">Status</div>
          <div className="w-20 shrink-0"></div>
        </div>

        {/* Invoice List */}
        <div className="max-h-[500px] overflow-y-auto">
          {filteredInvoices.length > 0 ? filteredInvoices.map(invoice => {
            const status = getInvoiceStatus(invoice.due_date, invoice.amount, invoice.balance)
            const daysOverdue = getDaysOverdue(invoice.due_date)
            const client = clients.find(c => c.id === invoice.client_id)
            const project = projects.find(p => p.id === invoice.project_id)
            const probability = invoice.balance > 0 ? getPaymentProbability(invoice, invoices) : null

            return (
              <div key={invoice.id} className={`flex items-center gap-3 py-3 px-4 hover:bg-white/[0.03] transition-colors border-b border-white/[0.05] ${selectedInvoices.includes(invoice.id) ? 'bg-emerald-500/10' : ''}`}>
                <div className="w-8 shrink-0"><input type="checkbox" checked={selectedInvoices.includes(invoice.id)} onChange={() => setSelectedInvoices(prev => prev.includes(invoice.id) ? prev.filter(i => i !== invoice.id) : [...prev, invoice.id])} className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/30" /></div>
                <div className="w-20 shrink-0"><p className="text-sm font-medium text-emerald-400">#{invoice.invoice_number}</p></div>
                <div className="w-14 shrink-0">{probability ? <ProbabilityBadge score={probability.score} color={probability.color} /> : <span className="text-xs text-emerald-400">✓</span>}</div>
                <div className="w-20 shrink-0"><p className={`text-sm ${THEME.textMuted}`}>{formatDateShort(invoice.invoice_date)}</p></div>
                <div className="w-20 shrink-0"><p className={`text-sm ${status.includes('overdue') ? 'text-rose-400 font-medium' : THEME.textMuted}`}>{formatDateShort(invoice.due_date)}</p></div>
                <div className="w-28 shrink-0"><EditableSelect value={invoice.client_id || ''} options={clients} onChange={(v) => onUpdateInvoice(invoice.id, { client_id: v })} placeholder="Assign" /></div>
                <div className="w-36 shrink-0"><EditableSelect value={invoice.project_id || ''} options={projects} onChange={(v) => onUpdateInvoice(invoice.id, { project_id: v })} placeholder="Assign" /></div>
                <div className="flex-1 min-w-0"><p className={`text-xs ${THEME.textDim} truncate`} title={invoice.qbo_customer}>{invoice.qbo_customer || '—'}</p></div>
                <div className="w-24 text-right shrink-0"><p className={`text-sm font-medium ${THEME.textPrimary}`}>{formatCurrency(invoice.amount)}</p></div>
                <div className="w-24 text-right shrink-0"><p className={`text-sm font-semibold ${invoice.balance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{formatCurrency(invoice.balance)}</p></div>
                <div className="w-24 shrink-0"><StatusBadge status={status} daysOverdue={daysOverdue} /></div>
                <div className="w-20 shrink-0 flex items-center justify-end gap-1">
                  {invoice.balance > 0 && (
                    <button onClick={() => setPaymentInvoice(invoice)} className="px-2 py-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors">+ Pay</button>
                  )}
                  <button className="p-1 hover:bg-white/[0.05] rounded transition-colors"><MoreHorizontal size={16} className={THEME.textMuted} /></button>
                </div>
              </div>
            )
          }) : (
            <div className={`flex items-center justify-center py-12 ${THEME.textMuted}`}>No invoices found</div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-6 py-3 bg-white/[0.03] border-t ${THEME.glassBorder}`}>
          <p className={`text-sm ${THEME.textMuted}`}>Showing {filteredInvoices.length} of {invoices.length} invoices</p>
          <div className="flex items-center gap-6 text-sm">
            <div><span className={THEME.textMuted}>Total: </span><span className={`font-semibold ${THEME.textPrimary}`}>{formatCurrency(filteredInvoices.reduce((s, i) => s + i.amount, 0))}</span></div>
            <div><span className={THEME.textMuted}>Balance: </span><span className="font-semibold text-amber-400">{formatCurrency(filteredInvoices.reduce((s, i) => s + i.balance, 0))}</span></div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Payment Modal */}
      {paymentInvoice && (
        <PaymentModal invoice={paymentInvoice} onClose={() => setPaymentInvoice(null)}
          onSave={(id, amount) => { onRecordPayment(id, amount); setPaymentInvoice(null) }} />
      )}
    </div>
  )
}
