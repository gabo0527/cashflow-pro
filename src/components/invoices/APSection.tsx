'use client'

import React, { useState, useMemo, useEffect, forwardRef, useImperativeHandle } from 'react'
import {
  DollarSign, Clock, AlertTriangle, TrendingDown, Users,
  ChevronDown, ChevronUp, Search, Plus, Briefcase,
  MoreHorizontal, Trash2, X, CheckCircle2
} from 'lucide-react'
import {
  PieChart as RePieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts'
import {
  COLORS, PIE_COLORS,
  formatCurrency, formatDateShort, getInvoiceStatus, getDaysOverdue,
  MetricCard, StatusBadge, AgingBar, CustomTooltip,
  EditableSelect, CollapsibleSection, PaymentModal
} from './shared'

interface APSectionProps {
  bills: any[]; clients: any[]; projects: any[]; teamMembers: any[]
  selectedYear: number | 'all'; companyId: string | null
  onAddBill: (bill: any) => void; onUpdateBill: (id: string, updates: any) => void
  onDeleteBill: (id: string) => void; onRecordPayment: (id: string, amount: number) => void
  triggerAddModal?: boolean; onAddModalClose?: () => void
}

export interface APSectionHandle { openAddModal: () => void }

const APSection = forwardRef<APSectionHandle, APSectionProps>(({
  bills, clients, projects, teamMembers, selectedYear, companyId,
  onAddBill, onUpdateBill, onDeleteBill, onRecordPayment,
  triggerAddModal, onAddModalClose
}, ref) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterVendor, setFilterVendor] = useState('all')
  const [sortField, setSortField] = useState('due_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [selectedBills, setSelectedBills] = useState<string[]>([])
  const [paymentBill, setPaymentBill] = useState<any>(null)
  const [showAddModal, setShowAddModal] = useState(false)

  useImperativeHandle(ref, () => ({ openAddModal: () => setShowAddModal(true) }))
  useEffect(() => { if (triggerAddModal) { setShowAddModal(true); onAddModalClose?.() } }, [triggerAddModal, onAddModalClose])

  const vendors = useMemo(() => {
    const v = new Set<string>()
    bills.forEach(b => { if (b.vendor_name) v.add(b.vendor_name) })
    return Array.from(v).sort()
  }, [bills])

  const filteredBills = useMemo(() => {
    let result = [...bills]
    if (selectedYear !== 'all') result = result.filter(b => new Date(b.date).getFullYear() === selectedYear)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(b => b.bill_number?.toLowerCase().includes(q) || b.vendor_name?.toLowerCase().includes(q) || b.notes?.toLowerCase().includes(q))
    }
    if (filterStatus !== 'all') {
      result = result.filter(b => {
        const status = getInvoiceStatus(b.due_date, b.amount, b.balance)
        if (filterStatus === 'unpaid') return b.balance > 0
        if (filterStatus === 'paid') return b.balance === 0
        if (filterStatus === 'overdue') return status.includes('overdue')
        return true
      })
    }
    if (filterVendor !== 'all') result = result.filter(b => b.vendor_name === filterVendor)
    result.sort((a, b) => {
      let aVal = a[sortField], bVal = b[sortField]
      if (['date', 'due_date'].includes(sortField)) { aVal = new Date(aVal).getTime(); bVal = new Date(bVal).getTime() }
      return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
    })
    return result
  }, [bills, selectedYear, searchQuery, filterStatus, filterVendor, sortField, sortDir])

  const apMetrics = useMemo(() => {
    const unpaid = bills.filter(b => b.balance > 0)
    const totalAP = unpaid.reduce((sum, b) => sum + b.balance, 0)
    const aging = { current: { amount: 0, count: 0 }, days_1_30: { amount: 0, count: 0 }, days_31_60: { amount: 0, count: 0 }, days_61_90: { amount: 0, count: 0 }, days_90_plus: { amount: 0, count: 0 } }
    unpaid.forEach(b => {
      const status = getInvoiceStatus(b.due_date, b.amount, b.balance)
      if (status === 'current') { aging.current.amount += b.balance; aging.current.count++ }
      else if (status === 'overdue_1_30') { aging.days_1_30.amount += b.balance; aging.days_1_30.count++ }
      else if (status === 'overdue_31_60') { aging.days_31_60.amount += b.balance; aging.days_31_60.count++ }
      else if (status === 'overdue_61_90') { aging.days_61_90.amount += b.balance; aging.days_61_90.count++ }
      else if (status === 'overdue_90_plus') { aging.days_90_plus.amount += b.balance; aging.days_90_plus.count++ }
    })
    const overdueTotal = aging.days_1_30.amount + aging.days_31_60.amount + aging.days_61_90.amount + aging.days_90_plus.amount
    return { totalAP, unpaidCount: unpaid.length, overdueTotal, aging }
  }, [bills])

  const apByVendor = useMemo(() => {
    const vendorAP: Record<string, number> = {}
    bills.filter(b => b.balance > 0).forEach(b => { const name = b.vendor_name || 'Unassigned'; vendorAP[name] = (vendorAP[name] || 0) + b.balance })
    return Object.entries(vendorAP).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [bills])

  const handleSort = (field: string) => { if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); else { setSortField(field); setSortDir('asc') } }
  const handleSelectAll = () => setSelectedBills(prev => prev.length === filteredBills.length ? [] : filteredBills.map(b => b.id))

  const AP_PIE_COLORS = ['#e11d48', '#d97706', '#7c3aed', '#2563eb', '#0891b2']
  const selectClass = "bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 cursor-pointer"

  return (
    <div className="space-y-5">
      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Total AP" value={formatCurrency(apMetrics.totalAP)} subtitle={`${apMetrics.unpaidCount} unpaid bills`} icon={DollarSign} color="rose" />
        <MetricCard label="Current" value={formatCurrency(apMetrics.aging.current.amount)} subtitle={`${apMetrics.aging.current.count} bills`} icon={CheckCircle2} color="emerald" />
        <MetricCard label="Overdue" value={formatCurrency(apMetrics.overdueTotal)} subtitle="Past due date" icon={AlertTriangle} color="amber" />
        <MetricCard label="Total Committed" value={formatCurrency(bills.reduce((s, b) => s + b.amount, 0))} subtitle="All contractor costs" icon={Users} color="purple" />
      </div>

      {/* Aging & Charts */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">AP Aging</h2>
                <p className="text-xs text-slate-400 mt-0.5">Outstanding payables by age</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Total Outstanding</p>
                <p className="text-xl font-semibold text-red-600">{formatCurrency(apMetrics.totalAP)}</p>
              </div>
            </div>
            <div className="space-y-1">
              <AgingBar label="Current" amount={apMetrics.aging.current.amount} total={apMetrics.totalAP} count={apMetrics.aging.current.count} color={COLORS.emerald} />
              <AgingBar label="1-30 days" amount={apMetrics.aging.days_1_30.amount} total={apMetrics.totalAP} count={apMetrics.aging.days_1_30.count} color={COLORS.amber} />
              <AgingBar label="31-60 days" amount={apMetrics.aging.days_31_60.amount} total={apMetrics.totalAP} count={apMetrics.aging.days_31_60.count} color={COLORS.orange} />
              <AgingBar label="61-90 days" amount={apMetrics.aging.days_61_90.amount} total={apMetrics.totalAP} count={apMetrics.aging.days_61_90.count} color={COLORS.rose} />
              <AgingBar label="90+ days" amount={apMetrics.aging.days_90_plus.amount} total={apMetrics.totalAP} count={apMetrics.aging.days_90_plus.count} color="#be123c" />
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm h-full">
            <h2 className="text-sm font-semibold text-slate-900 mb-4">AP by Vendor</h2>
            {apByVendor.length > 0 ? (
              <>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie data={apByVendor} cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3} dataKey="value">
                        {apByVendor.map((_, i) => <Cell key={i} fill={AP_PIE_COLORS[i % AP_PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-2">
                  {apByVendor.slice(0, 5).map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: AP_PIE_COLORS[i % AP_PIE_COLORS.length] }} />
                        <span className="text-xs text-slate-600 truncate max-w-32">{item.name}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-900">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-40 text-slate-400 text-sm">No outstanding AP</div>
            )}
          </div>
        </div>
      </div>

      {/* Bills Table */}
      <CollapsibleSection
        title="Bills"
        subtitle={`${filteredBills.filter(b => b.balance > 0).length} unpaid • ${filteredBills.filter(b => b.balance === 0).length} paid`}
        badge={filteredBills.length}
        defaultExpanded={true}
        noPadding
        action={{ label: 'Add Bill', onClick: () => setShowAddModal(true) }}
      >
        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Briefcase size={14} className="text-red-500" />
            <span className="text-xs text-slate-400">Contractor invoices → Direct costs for GM</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search bills..."
                className="bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" />
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={selectClass}>
              <option value="all">All Status</option>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
            <select value={filterVendor} onChange={(e) => setFilterVendor(e.target.value)} className={selectClass}>
              <option value="all">All Vendors</option>
              {vendors.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedBills.length > 0 && (
          <div className="flex items-center gap-4 px-6 py-3 bg-red-50 border-b border-red-200">
            <span className="text-sm font-medium text-red-700">{selectedBills.length} selected</span>
            <button onClick={async () => { for (const id of selectedBills) { const b = bills.find(x => x.id === id); if (b && b.balance > 0) onRecordPayment(id, b.balance) }; setSelectedBills([]) }}
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Mark as Paid</button>
            <button onClick={async () => { if (!confirm(`Delete ${selectedBills.length} bills?`)) return; for (const id of selectedBills) onDeleteBill(id); setSelectedBills([]) }}
              className="text-sm text-red-600 hover:text-red-700 transition-colors">Delete</button>
          </div>
        )}

        {/* Column Headers */}
        <div className="flex items-center gap-3 py-2.5 px-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-400 uppercase tracking-wider">
          <div className="w-8 shrink-0">
            <input type="checkbox" checked={selectedBills.length === filteredBills.length && filteredBills.length > 0} onChange={handleSelectAll}
              className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/30 cursor-pointer" />
          </div>
          <button onClick={() => handleSort('bill_number')} className="w-20 shrink-0 flex items-center gap-1 hover:text-slate-700 transition-colors">
            Bill # {sortField === 'bill_number' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <button onClick={() => handleSort('date')} className="w-20 shrink-0 flex items-center gap-1 hover:text-slate-700 transition-colors">
            Date {sortField === 'date' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <button onClick={() => handleSort('due_date')} className="w-20 shrink-0 flex items-center gap-1 hover:text-slate-700 transition-colors">
            Due {sortField === 'due_date' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <div className="w-36 shrink-0">Vendor / Contractor</div>
          <div className="w-36 shrink-0">Project</div>
          <div className="flex-1">Notes</div>
          <button onClick={() => handleSort('amount')} className="w-24 text-right shrink-0 flex items-center justify-end gap-1 hover:text-slate-700 transition-colors">
            Amount {sortField === 'amount' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <button onClick={() => handleSort('balance')} className="w-24 text-right shrink-0 flex items-center justify-end gap-1 hover:text-slate-700 transition-colors">
            Balance {sortField === 'balance' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <div className="w-24 shrink-0">Status</div>
          <div className="w-20 shrink-0"></div>
        </div>

        {/* Bill List */}
        <div className="max-h-[500px] overflow-y-auto">
          {filteredBills.length > 0 ? filteredBills.map(bill => {
            const status = getInvoiceStatus(bill.due_date, bill.amount, bill.balance)
            const daysOverdue = getDaysOverdue(bill.due_date)
            return (
              <div key={bill.id} className={`flex items-center gap-3 py-3 px-4 hover:bg-slate-50 transition-colors border-b border-slate-100 ${selectedBills.includes(bill.id) ? 'bg-red-50/50' : ''}`}>
                <div className="w-8 shrink-0">
                  <input type="checkbox" checked={selectedBills.includes(bill.id)} onChange={() => setSelectedBills(prev => prev.includes(bill.id) ? prev.filter(i => i !== bill.id) : [...prev, bill.id])}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500/30 cursor-pointer" />
                </div>
                <div className="w-20 shrink-0"><p className="text-sm font-medium text-red-600">#{bill.bill_number || '—'}</p></div>
                <div className="w-20 shrink-0"><p className="text-sm text-slate-500">{formatDateShort(bill.date)}</p></div>
                <div className="w-20 shrink-0"><p className={`text-sm ${status.includes('overdue') ? 'text-red-600 font-medium' : 'text-slate-500'}`}>{formatDateShort(bill.due_date)}</p></div>
                <div className="w-36 shrink-0"><p className="text-sm text-slate-700 truncate">{bill.vendor_name || '—'}</p></div>
                <div className="w-36 shrink-0"><EditableSelect value={bill.project_id || ''} options={projects} onChange={(v) => onUpdateBill(bill.id, { project_id: v || null })} placeholder="Assign" /></div>
                <div className="flex-1 min-w-0"><p className="text-xs text-slate-400 truncate">{bill.notes || '—'}</p></div>
                <div className="w-24 text-right shrink-0"><p className="text-sm font-medium text-slate-900">{formatCurrency(bill.amount)}</p></div>
                <div className="w-24 text-right shrink-0"><p className={`text-sm font-semibold ${bill.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCurrency(bill.balance)}</p></div>
                <div className="w-24 shrink-0"><StatusBadge status={status} daysOverdue={daysOverdue} /></div>
                <div className="w-20 shrink-0 flex items-center justify-end gap-1">
                  {bill.balance > 0 && (
                    <button onClick={() => setPaymentBill(bill)} className="px-2 py-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors">+ Pay</button>
                  )}
                  <button onClick={() => onDeleteBill(bill.id)} className="p-1 hover:bg-slate-100 rounded transition-colors">
                    <Trash2 size={14} className="text-slate-400 hover:text-red-500 transition-colors" />
                  </button>
                </div>
              </div>
            )
          }) : (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                <Briefcase size={28} className="text-red-500" />
              </div>
              <div className="text-center">
                <p className="font-medium text-slate-600">No bills found</p>
                <p className="text-sm text-slate-400 mt-1">Add contractor bills to track your direct costs</p>
              </div>
              <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors">
                <Plus size={16} /> Add Your First Bill
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {filteredBills.length > 0 && (
          <div className="flex items-center justify-between px-6 py-3 bg-slate-50 border-t border-slate-200">
            <p className="text-sm text-slate-500">Showing {filteredBills.length} bills</p>
            <div className="flex items-center gap-6 text-sm">
              <div><span className="text-slate-500">Total: </span><span className="font-semibold text-slate-900">{formatCurrency(filteredBills.reduce((s, b) => s + b.amount, 0))}</span></div>
              <div><span className="text-slate-500">Balance: </span><span className="font-semibold text-red-600">{formatCurrency(filteredBills.reduce((s, b) => s + b.balance, 0))}</span></div>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {paymentBill && (
        <PaymentModal invoice={{ ...paymentBill, invoice_number: paymentBill.bill_number }} onClose={() => setPaymentBill(null)}
          onSave={(id, amount) => { onRecordPayment(id, amount); setPaymentBill(null) }} type="bill" />
      )}

      {showAddModal && (
        <AddBillModal onClose={() => setShowAddModal(false)} projects={projects} teamMembers={teamMembers}
          onSave={(bill) => { onAddBill(bill); setShowAddModal(false) }} />
      )}
    </div>
  )
})

APSection.displayName = 'APSection'
export default APSection

// ============ ADD BILL MODAL ============
function AddBillModal({ onClose, projects, teamMembers, onSave }: {
  onClose: () => void; projects: any[]; teamMembers: any[]; onSave: (bill: any) => void
}) {
  const [billNumber, setBillNumber] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [projectId, setProjectId] = useState('')
  const [notes, setNotes] = useState('')

  const handleSave = () => {
    onSave({
      bill_number: billNumber || `BILL-${Date.now().toString().slice(-6)}`,
      vendor_name: vendorName, amount: parseFloat(amount) || 0, date,
      due_date: dueDate || date, project_id: projectId || null, notes,
      balance: parseFloat(amount) || 0, paid_amount: 0, status: 'unpaid'
    })
  }

  const inputClass = "w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg mx-4 overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Add Contractor Bill</h3>
            <p className="text-xs text-slate-400 mt-0.5">Track direct costs for gross margin calculation</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1.5">Bill #</label>
              <input type="text" value={billNumber} onChange={(e) => setBillNumber(e.target.value)} placeholder="Auto-generated" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1.5">Amount <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={`${inputClass} pl-7`} />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1.5">Vendor / Contractor <span className="text-red-500">*</span></label>
            <input type="text" value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Enter contractor or vendor name" className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1.5">Bill Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} cursor-pointer`} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-500 mb-1.5">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`${inputClass} cursor-pointer`} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1.5">Project</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`${inputClass} cursor-pointer`}>
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <p className="text-xs text-slate-400 mt-1.5">Links cost to project for gross margin calculation</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1.5">Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional description" className={inputClass} />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!amount || !vendorName}
            className="px-5 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
            Add Bill
          </button>
        </div>
      </div>
    </div>
  )
}
