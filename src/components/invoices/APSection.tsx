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
  THEME, COLORS, PIE_COLORS,
  formatCurrency, formatDateShort, getInvoiceStatus, getDaysOverdue,
  MetricCard, StatusBadge, AgingBar, CustomTooltip,
  EditableSelect, CollapsibleSection, PaymentModal
} from './shared'

interface APSectionProps {
  bills: any[]
  clients: any[]
  projects: any[]
  teamMembers: any[]
  selectedYear: number | 'all'
  companyId: string | null
  onAddBill: (bill: any) => void
  onUpdateBill: (id: string, updates: any) => void
  onDeleteBill: (id: string) => void
  onRecordPayment: (id: string, amount: number) => void
  triggerAddModal?: boolean
  onAddModalClose?: () => void
}

export interface APSectionHandle {
  openAddModal: () => void
}

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

  // Expose openAddModal via ref
  useImperativeHandle(ref, () => ({
    openAddModal: () => setShowAddModal(true)
  }))

  // Handle external trigger
  useEffect(() => {
    if (triggerAddModal) {
      setShowAddModal(true)
      onAddModalClose?.()
    }
  }, [triggerAddModal, onAddModalClose])

  // Unique vendors
  const vendors = useMemo(() => {
    const v = new Set<string>()
    bills.forEach(b => { if (b.vendor_name) v.add(b.vendor_name) })
    return Array.from(v).sort()
  }, [bills])

  // Filtered & sorted
  const filteredBills = useMemo(() => {
    let result = [...bills]
    if (selectedYear !== 'all') result = result.filter(b => new Date(b.date).getFullYear() === selectedYear)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(b =>
        b.bill_number?.toLowerCase().includes(q) ||
        b.vendor_name?.toLowerCase().includes(q) ||
        b.notes?.toLowerCase().includes(q)
      )
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

  // AP Metrics
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

  // AP by Vendor
  const apByVendor = useMemo(() => {
    const vendorAP: Record<string, number> = {}
    bills.filter(b => b.balance > 0).forEach(b => {
      const name = b.vendor_name || 'Unassigned'
      vendorAP[name] = (vendorAP[name] || 0) + b.balance
    })
    return Object.entries(vendorAP).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [bills])

  const handleSort = (field: string) => { 
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('asc') } 
  }
  const handleSelectAll = () => setSelectedBills(prev => prev.length === filteredBills.length ? [] : filteredBills.map(b => b.id))

  const AP_PIE_COLORS = ['#f43f5e', '#f59e0b', '#8b5cf6', '#3b82f6', '#06b6d4']

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total AP" value={formatCurrency(apMetrics.totalAP)} subtitle={`${apMetrics.unpaidCount} unpaid bills`} icon={DollarSign} color="rose" />
        <MetricCard label="Current" value={formatCurrency(apMetrics.aging.current.amount)} subtitle={`${apMetrics.aging.current.count} bills`} icon={CheckCircle2} color="emerald" />
        <MetricCard label="Overdue" value={formatCurrency(apMetrics.overdueTotal)} subtitle="Past due date" icon={AlertTriangle} color="amber" />
        <MetricCard label="Total Committed" value={formatCurrency(bills.reduce((s, b) => s + b.amount, 0))} subtitle="All contractor costs" icon={Users} color="purple" />
      </div>

      {/* Aging & Charts */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-6`}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className={`text-sm font-semibold ${THEME.textPrimary}`}>AP Aging</h2>
                <p className={`text-xs ${THEME.textDim} mt-0.5`}>Outstanding payables by age</p>
              </div>
              <div className="text-right">
                <p className={`text-xs ${THEME.textMuted}`}>Total Outstanding</p>
                <p className="text-xl font-semibold text-rose-400">{formatCurrency(apMetrics.totalAP)}</p>
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
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-6 h-full`}>
            <h2 className={`text-sm font-semibold ${THEME.textPrimary} mb-4`}>AP by Vendor</h2>
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
                        <span className={`text-xs ${THEME.textSecondary} truncate max-w-28`}>{item.name}</span>
                      </div>
                      <span className={`text-xs font-semibold ${THEME.textPrimary}`}>{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className={`flex items-center justify-center h-40 ${THEME.textMuted} text-sm`}>No outstanding AP</div>
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
        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 border-b ${THEME.glassBorder}`}>
          <div className="flex items-center gap-2">
            <Briefcase size={14} className="text-rose-400" />
            <span className={`text-xs ${THEME.textMuted}`}>Contractor invoices → Direct costs for GM</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search bills..."
                className="bg-white/[0.05] border border-white/[0.1] rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer">
              <option value="all" className="bg-slate-900">All Status</option>
              <option value="unpaid" className="bg-slate-900">Unpaid</option>
              <option value="paid" className="bg-slate-900">Paid</option>
              <option value="overdue" className="bg-slate-900">Overdue</option>
            </select>
            <select value={filterVendor} onChange={(e) => setFilterVendor(e.target.value)} className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer">
              <option value="all" className="bg-slate-900">All Vendors</option>
              {vendors.map(v => <option key={v} value={v} className="bg-slate-900">{v}</option>)}
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedBills.length > 0 && (
          <div className="flex items-center gap-4 px-6 py-3 bg-rose-500/10 border-b border-rose-500/20">
            <span className="text-sm font-medium text-rose-400">{selectedBills.length} selected</span>
            <button onClick={async () => {
              for (const id of selectedBills) { const b = bills.find(x => x.id === id); if (b && b.balance > 0) onRecordPayment(id, b.balance) }
              setSelectedBills([])
            }} className={`text-sm ${THEME.textSecondary} hover:text-white transition-colors`}>Mark as Paid</button>
            <button onClick={async () => {
              if (!confirm(`Delete ${selectedBills.length} bills?`)) return
              for (const id of selectedBills) onDeleteBill(id)
              setSelectedBills([])
            }} className={`text-sm ${THEME.textSecondary} hover:text-rose-400 transition-colors`}>Delete</button>
          </div>
        )}

        {/* Column Headers */}
        <div className={`flex items-center gap-3 py-2.5 px-4 bg-white/[0.03] border-b ${THEME.glassBorder} text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>
          <div className="w-8 shrink-0">
            <input type="checkbox" checked={selectedBills.length === filteredBills.length && filteredBills.length > 0} onChange={handleSelectAll} 
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/30 cursor-pointer" />
          </div>
          <button onClick={() => handleSort('bill_number')} className="w-20 shrink-0 flex items-center gap-1 hover:text-white transition-colors">
            Bill # {sortField === 'bill_number' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <button onClick={() => handleSort('date')} className="w-20 shrink-0 flex items-center gap-1 hover:text-white transition-colors">
            Date {sortField === 'date' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <button onClick={() => handleSort('due_date')} className="w-20 shrink-0 flex items-center gap-1 hover:text-white transition-colors">
            Due {sortField === 'due_date' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <div className="w-36 shrink-0">Vendor / Contractor</div>
          <div className="w-36 shrink-0">Project</div>
          <div className="flex-1">Notes</div>
          <button onClick={() => handleSort('amount')} className="w-24 text-right shrink-0 flex items-center justify-end gap-1 hover:text-white transition-colors">
            Amount {sortField === 'amount' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <button onClick={() => handleSort('balance')} className="w-24 text-right shrink-0 flex items-center justify-end gap-1 hover:text-white transition-colors">
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
              <div key={bill.id} className={`flex items-center gap-3 py-3 px-4 hover:bg-white/[0.03] transition-colors border-b border-white/[0.05] ${selectedBills.includes(bill.id) ? 'bg-rose-500/10' : ''}`}>
                <div className="w-8 shrink-0">
                  <input type="checkbox" checked={selectedBills.includes(bill.id)} onChange={() => setSelectedBills(prev => prev.includes(bill.id) ? prev.filter(i => i !== bill.id) : [...prev, bill.id])} 
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/30 cursor-pointer" />
                </div>
                <div className="w-20 shrink-0"><p className="text-sm font-medium text-rose-400">#{bill.bill_number || '—'}</p></div>
                <div className="w-20 shrink-0"><p className={`text-sm ${THEME.textMuted}`}>{formatDateShort(bill.date)}</p></div>
                <div className="w-20 shrink-0"><p className={`text-sm ${status.includes('overdue') ? 'text-rose-400 font-medium' : THEME.textMuted}`}>{formatDateShort(bill.due_date)}</p></div>
                <div className="w-36 shrink-0"><p className={`text-sm ${THEME.textSecondary} truncate`}>{bill.vendor_name || '—'}</p></div>
                <div className="w-36 shrink-0"><EditableSelect value={bill.project_id || ''} options={projects} onChange={(v) => onUpdateBill(bill.id, { project_id: v || null })} placeholder="Assign" /></div>
                <div className="flex-1 min-w-0"><p className={`text-xs ${THEME.textDim} truncate`}>{bill.notes || '—'}</p></div>
                <div className="w-24 text-right shrink-0"><p className={`text-sm font-medium ${THEME.textPrimary}`}>{formatCurrency(bill.amount)}</p></div>
                <div className="w-24 text-right shrink-0"><p className={`text-sm font-semibold ${bill.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{formatCurrency(bill.balance)}</p></div>
                <div className="w-24 shrink-0"><StatusBadge status={status} daysOverdue={daysOverdue} /></div>
                <div className="w-20 shrink-0 flex items-center justify-end gap-1">
                  {bill.balance > 0 && (
                    <button onClick={() => setPaymentBill(bill)} className="px-2 py-1 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-colors">+ Pay</button>
                  )}
                  <button onClick={() => onDeleteBill(bill.id)} className="p-1 hover:bg-white/[0.05] rounded transition-colors">
                    <Trash2 size={14} className={`${THEME.textDim} hover:text-rose-400 transition-colors`} />
                  </button>
                </div>
              </div>
            )
          }) : (
            <div className={`flex flex-col items-center justify-center py-16 gap-4`}>
              <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center">
                <Briefcase size={28} className="text-rose-400" />
              </div>
              <div className="text-center">
                <p className={`font-medium ${THEME.textSecondary}`}>No bills found</p>
                <p className={`text-sm ${THEME.textDim} mt-1`}>Add contractor bills to track your direct costs</p>
              </div>
              <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-rose-500/10 text-rose-400 border border-rose-500/30 rounded-lg text-sm font-medium hover:bg-rose-500/20 transition-colors">
                <Plus size={16} /> Add Your First Bill
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {filteredBills.length > 0 && (
          <div className={`flex items-center justify-between px-6 py-3 bg-white/[0.03] border-t ${THEME.glassBorder}`}>
            <p className={`text-sm ${THEME.textMuted}`}>Showing {filteredBills.length} bills</p>
            <div className="flex items-center gap-6 text-sm">
              <div><span className={THEME.textMuted}>Total: </span><span className={`font-semibold ${THEME.textPrimary}`}>{formatCurrency(filteredBills.reduce((s, b) => s + b.amount, 0))}</span></div>
              <div><span className={THEME.textMuted}>Balance: </span><span className="font-semibold text-rose-400">{formatCurrency(filteredBills.reduce((s, b) => s + b.balance, 0))}</span></div>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Payment Modal */}
      {paymentBill && (
        <PaymentModal 
          invoice={{ ...paymentBill, invoice_number: paymentBill.bill_number }} 
          onClose={() => setPaymentBill(null)}
          onSave={(id, amount) => { onRecordPayment(id, amount); setPaymentBill(null) }}
          type="bill"
        />
      )}

      {/* Add Bill Modal */}
      {showAddModal && (
        <AddBillModal 
          onClose={() => setShowAddModal(false)} 
          projects={projects} 
          teamMembers={teamMembers}
          onSave={(bill) => { onAddBill(bill); setShowAddModal(false) }} 
        />
      )}
    </div>
  )
})

APSection.displayName = 'APSection'
export default APSection

// Add Bill Modal
function AddBillModal({ onClose, projects, teamMembers, onSave }: { 
  onClose: () => void
  projects: any[]
  teamMembers: any[]
  onSave: (bill: any) => void 
}) {
  const [billNumber, setBillNumber] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState('')
  const [projectId, setProjectId] = useState('')
  const [notes, setNotes] = useState('')

  const handleSave = () => {
    const bill = {
      bill_number: billNumber || `BILL-${Date.now().toString().slice(-6)}`,
      vendor_name: vendorName,
      amount: parseFloat(amount) || 0,
      date,
      due_date: dueDate || date,
      project_id: projectId || null,
      notes,
      balance: parseFloat(amount) || 0,
      paid_amount: 0,
      status: 'unpaid'
    }
    onSave(bill)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-2xl w-full max-w-lg mx-4 overflow-hidden shadow-2xl`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
          <div>
            <h3 className={`text-lg font-semibold ${THEME.textPrimary}`}>Add Contractor Bill</h3>
            <p className={`text-xs ${THEME.textDim} mt-0.5`}>Track direct costs for gross margin calculation</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/[0.05] rounded-lg transition-colors">
            <X size={20} className={THEME.textMuted} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Bill #</label>
              <input type="text" value={billNumber} onChange={(e) => setBillNumber(e.target.value)} placeholder="Auto-generated"
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
            <div>
              <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Amount <span className="text-rose-400">*</span></label>
              <div className="relative">
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${THEME.textDim}`}>$</span>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg pl-7 pr-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
              </div>
            </div>
          </div>
          
          <div>
            <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Vendor / Contractor <span className="text-rose-400">*</span></label>
            <input type="text" value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Enter contractor or vendor name"
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Bill Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer" />
            </div>
            <div>
              <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer" />
            </div>
          </div>
          
          <div>
            <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Project</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer">
              <option value="" className="bg-slate-900">Select project...</option>
              {projects.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>)}
            </select>
            <p className={`text-xs ${THEME.textDim} mt-1.5`}>Links cost to project for gross margin calculation</p>
          </div>
          
          <div>
            <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional description"
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
          </div>
        </div>
        
        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${THEME.glassBorder} bg-white/[0.02]`}>
          <button onClick={onClose} className={`px-4 py-2 text-sm font-medium ${THEME.textMuted} hover:text-white transition-colors`}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={!amount || !vendorName}
            className="px-5 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-emerald-500/20">
            Add Bill
          </button>
        </div>
      </div>
    </div>
  )
}
