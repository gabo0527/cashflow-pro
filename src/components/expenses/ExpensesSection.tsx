'use client'

import React, { useState, useMemo, forwardRef, useImperativeHandle } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
  Search, ChevronDown, ChevronUp, Trash2, Receipt, Plus, X
} from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmahfgpbtjeomuepfozf.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYWhmZ3BidGplb211ZXBmb3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0OTAxNzcsImV4cCI6MjA4MTA2NjE3N30.3SVDvWCGIYYHV57BpKjpDJVCZLKzuRv8B_VietQDxUQ'
)
import {
  THEME, EXPENSE_CATEGORIES, getCategoryConfig, getSubcategoryConfig,
  formatCurrency, formatDateShort, 
  CategoryBadge, StatusBadge, CategorySelect, SubcategorySelect, EditableSelect, CollapsibleSection
} from './shared'

interface ExpensesSectionProps {
  expenses: any[]
  projects: any[]
  clients: any[]
  teamMembers: any[]
  selectedYear: number
  selectedMonth: string
  companyId: string | null
  onAddExpense: (expense: any) => void
  onUpdateExpense: (id: string, updates: any) => void
  onDeleteExpense: (id: string) => void
}

export interface ExpensesSectionHandle {
  openAddModal: () => void
}

const ExpensesSection = forwardRef<ExpensesSectionHandle, ExpensesSectionProps>(({
  expenses, projects, clients, teamMembers, selectedYear, selectedMonth, companyId,
  onAddExpense, onUpdateExpense, onDeleteExpense
}, ref) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [sortField, setSortField] = useState('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([])
  const [showAddModal, setShowAddModal] = useState(false)

  useImperativeHandle(ref, () => ({
    openAddModal: () => setShowAddModal(true)
  }))

  // Filter & sort
  const filteredExpenses = useMemo(() => {
    let result = [...expenses]

    // Year filter
    result = result.filter(exp => new Date(exp.date).getFullYear() === selectedYear)

    // Month filter
    if (selectedMonth !== 'all') {
      const monthIndex = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(selectedMonth)
      result = result.filter(exp => new Date(exp.date).getMonth() === monthIndex)
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(exp =>
        exp.description?.toLowerCase().includes(q) ||
        exp.vendor?.toLowerCase().includes(q)
      )
    }

    // Category filter
    if (filterCategory !== 'all') {
      result = result.filter(exp => exp.category === filterCategory)
    }

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortField], bVal = b[sortField]
      if (sortField === 'date') { aVal = new Date(aVal).getTime(); bVal = new Date(bVal).getTime() }
      return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
    })

    return result
  }, [expenses, selectedYear, selectedMonth, searchQuery, filterCategory, sortField, sortDir])

  // Metrics
  const metrics = useMemo(() => {
    return {
      directCosts: filteredExpenses.filter(e => e.category === 'directCosts').reduce((s, e) => s + e.amount, 0),
      overhead: filteredExpenses.filter(e => e.category === 'overhead').reduce((s, e) => s + e.amount, 0),
      otherBusiness: filteredExpenses.filter(e => e.category === 'otherBusiness').reduce((s, e) => s + e.amount, 0),
      personal: filteredExpenses.filter(e => e.category === 'personal').reduce((s, e) => s + e.amount, 0),
      total: filteredExpenses.reduce((s, e) => s + e.amount, 0)
    }
  }, [filteredExpenses])

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const handleSelectAll = () => {
    setSelectedExpenses(prev => 
      prev.length === filteredExpenses.length ? [] : filteredExpenses.map(e => e.id)
    )
  }

  const handleSelectExpense = (id: string) => {
    setSelectedExpenses(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedExpenses.length} expenses?`)) return
    for (const id of selectedExpenses) {
      onDeleteExpense(id)
    }
    setSelectedExpenses([])
  }

  const handleBulkMarkPaid = async () => {
    for (const id of selectedExpenses) {
      onUpdateExpense(id, { status: 'paid' })
    }
    setSelectedExpenses([])
  }

  // Get client from project
  const getClientFromProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (!project) return null
    return clients.find(c => c.id === project.client_id)
  }

  return (
    <div className="space-y-6">
      <CollapsibleSection
        title="All Expenses"
        subtitle={`${filteredExpenses.filter(e => e.category === 'directCosts').length} direct • ${filteredExpenses.filter(e => e.category === 'overhead').length} overhead • ${filteredExpenses.filter(e => e.category === 'otherBusiness').length} other • ${filteredExpenses.filter(e => e.category === 'personal').length} personal`}
        badge={filteredExpenses.length}
        defaultExpanded={true}
        noPadding
        action={{ label: 'Add Expense', onClick: () => setShowAddModal(true) }}
      >
        {/* Filters */}
        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 border-b ${THEME.glassBorder}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                placeholder="Search expenses..."
                className="bg-white/[0.05] border border-white/[0.1] rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" 
              />
            </div>
            <select 
              value={filterCategory} 
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Categories</option>
              <option value="directCosts" className="bg-slate-900">Direct Costs</option>
              <option value="overhead" className="bg-slate-900">Overhead</option>
              <option value="otherBusiness" className="bg-slate-900">Other Business</option>
              <option value="personal" className="bg-slate-900">Personal</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedExpenses.length > 0 && (
          <div className="flex items-center gap-4 px-6 py-3 bg-emerald-500/10 border-b border-emerald-500/20">
            <span className="text-sm font-medium text-emerald-400">{selectedExpenses.length} selected</span>
            <button onClick={handleBulkMarkPaid} className={`text-sm ${THEME.textSecondary} hover:text-white transition-colors`}>
              Mark as Paid
            </button>
            <button onClick={handleBulkDelete} className={`text-sm ${THEME.textSecondary} hover:text-rose-400 transition-colors`}>
              Delete
            </button>
          </div>
        )}

        {/* Column Headers */}
        <div className={`flex items-center gap-3 py-2.5 px-4 bg-white/[0.03] border-b ${THEME.glassBorder} text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>
          <div className="w-8 shrink-0">
            <input 
              type="checkbox" 
              checked={selectedExpenses.length === filteredExpenses.length && filteredExpenses.length > 0} 
              onChange={handleSelectAll} 
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/30 cursor-pointer" 
            />
          </div>
          <button onClick={() => handleSort('date')} className="w-20 shrink-0 flex items-center gap-1 hover:text-white transition-colors">
            Date {sortField === 'date' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <div className="flex-1 min-w-0">Description</div>
          <div className="w-28 shrink-0">Category</div>
          <div className="w-36 shrink-0">Type</div>
          <div className="w-32 shrink-0">Project</div>
          <div className="w-24 shrink-0">Client</div>
          <button onClick={() => handleSort('amount')} className="w-24 text-right shrink-0 flex items-center justify-end gap-1 hover:text-white transition-colors">
            Amount {sortField === 'amount' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <div className="w-20 shrink-0">Status</div>
          <div className="w-12 shrink-0"></div>
        </div>

        {/* Expense List */}
        <div className="max-h-[500px] overflow-y-auto">
          {filteredExpenses.length > 0 ? filteredExpenses.map(expense => {
            const client = getClientFromProject(expense.project_id)
            const catConfig = getCategoryConfig(expense.category)

            return (
              <div 
                key={expense.id} 
                className={`flex items-center gap-3 py-3 px-4 hover:bg-white/[0.03] transition-colors border-b border-white/[0.05] ${selectedExpenses.includes(expense.id) ? 'bg-emerald-500/10' : ''}`}
              >
                <div className="w-8 shrink-0">
                  <input 
                    type="checkbox" 
                    checked={selectedExpenses.includes(expense.id)} 
                    onChange={() => handleSelectExpense(expense.id)} 
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/30 cursor-pointer" 
                  />
                </div>
                <div className="w-20 shrink-0">
                  <p className={`text-sm ${THEME.textMuted}`}>{formatDateShort(expense.date)}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${THEME.textPrimary} truncate`}>{expense.description}</p>
                  {expense.vendor && <p className={`text-xs ${THEME.textDim} truncate`}>{expense.vendor}</p>}
                </div>
                <div className="w-28 shrink-0">
                  <CategorySelect 
                    value={expense.category} 
                    onChange={(cat) => {
                      const defaultSub = EXPENSE_CATEGORIES[cat as keyof typeof EXPENSE_CATEGORIES].subcategories[0].id
                      onUpdateExpense(expense.id, { category: cat, subcategory: defaultSub })
                    }} 
                  />
                </div>
                <div className="w-36 shrink-0">
                  <SubcategorySelect 
                    categoryId={expense.category} 
                    value={expense.subcategory} 
                    onChange={(sub) => onUpdateExpense(expense.id, { subcategory: sub })} 
                  />
                </div>
                <div className="w-32 shrink-0">
                  <EditableSelect 
                    value={expense.project_id || ''} 
                    options={projects} 
                    onChange={(val) => onUpdateExpense(expense.id, { project_id: val || null })} 
                    placeholder="Assign" 
                  />
                </div>
                <div className="w-24 shrink-0">
                  {client ? (
                    <p className={`text-xs ${THEME.textMuted} truncate`}>{client.name}</p>
                  ) : (
                    <span className={`text-xs ${THEME.textDim}`}>—</span>
                  )}
                </div>
                <div className="w-24 text-right shrink-0">
                  <p className={`text-sm font-semibold`} style={{ color: catConfig.hex }}>{formatCurrency(expense.amount)}</p>
                </div>
                <div className="w-20 shrink-0">
                  <button 
                    onClick={() => onUpdateExpense(expense.id, { status: expense.status === 'paid' ? 'pending' : 'paid' })}
                    className="cursor-pointer"
                  >
                    <StatusBadge status={expense.status} />
                  </button>
                </div>
                <div className="w-12 shrink-0 flex items-center justify-end">
                  <button 
                    onClick={() => onDeleteExpense(expense.id)} 
                    className="p-1 hover:bg-white/[0.05] rounded transition-colors"
                  >
                    <Trash2 size={14} className={`${THEME.textDim} hover:text-rose-400 transition-colors`} />
                  </button>
                </div>
              </div>
            )
          }) : (
            <div className={`flex flex-col items-center justify-center py-16 gap-4`}>
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <Receipt size={28} className="text-emerald-400" />
              </div>
              <div className="text-center">
                <p className={`font-medium ${THEME.textSecondary}`}>No expenses found</p>
                <p className={`text-sm ${THEME.textDim} mt-1`}>Add expenses or import from bank transactions</p>
              </div>
              <button 
                onClick={() => setShowAddModal(true)} 
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-medium hover:bg-emerald-500/20 transition-colors"
              >
                <Plus size={16} /> Add Expense
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {filteredExpenses.length > 0 && (
          <div className={`flex items-center justify-between px-6 py-3 bg-white/[0.03] border-t ${THEME.glassBorder}`}>
            <p className={`text-sm ${THEME.textMuted}`}>Showing {filteredExpenses.length} expenses</p>
            <div className="flex items-center gap-4 text-sm">
              <div><span className={THEME.textMuted}>Direct: </span><span className="font-semibold text-rose-400">{formatCurrency(metrics.directCosts)}</span></div>
              <div><span className={THEME.textMuted}>Overhead: </span><span className="font-semibold text-amber-400">{formatCurrency(metrics.overhead)}</span></div>
              <div><span className={THEME.textMuted}>Other: </span><span className="font-semibold text-blue-400">{formatCurrency(metrics.otherBusiness)}</span></div>
              <div><span className={THEME.textMuted}>Personal: </span><span className="font-semibold text-cyan-400">{formatCurrency(metrics.personal)}</span></div>
              <div className="pl-2 border-l border-white/[0.1]"><span className={THEME.textMuted}>Total: </span><span className={`font-semibold ${THEME.textPrimary}`}>{formatCurrency(metrics.total)}</span></div>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Add Expense Modal */}
      {showAddModal && (
        <AddExpenseModal 
          onClose={() => setShowAddModal(false)} 
          projects={projects}
          clients={clients}
          teamMembers={teamMembers}
          companyId={companyId}
          onSave={onAddExpense} 
        />
      )}
    </div>
  )
})

ExpensesSection.displayName = 'ExpensesSection'
export default ExpensesSection

// Simplified expense types — "what" the expense is
const QUICK_EXPENSE_TYPES = [
  { id: 'travel', label: 'Travel' },
  { id: 'hotel', label: 'Hotel' },
  { id: 'meal', label: 'Meal' },
  { id: 'transportation', label: 'Transportation' },
  { id: 'software_equipment', label: 'Software / Equipment' },
  { id: 'other', label: 'Other' },
] as const

// Map expense type → accounting subcategory (for P&L)
const TYPE_TO_SUBCATEGORY: Record<string, { direct: string; overhead: string }> = {
  travel: { direct: 'projectExpense', overhead: 'travel' },
  hotel: { direct: 'projectExpense', overhead: 'travel' },
  meal: { direct: 'projectExpense', overhead: 'travel' },
  transportation: { direct: 'projectExpense', overhead: 'travel' },
  software_equipment: { direct: 'equipment', overhead: 'software' },
  other: { direct: 'projectExpense', overhead: 'otherOverhead' },
}

// Add Expense Modal
function AddExpenseModal({ onClose, projects, clients, teamMembers, companyId, onSave }: {
  onClose: () => void
  projects: any[]
  clients: any[]
  teamMembers: any[]
  companyId: string | null
  onSave: (expense: any) => void
}) {
  const [expenseType, setExpenseType] = useState('travel')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [vendor, setVendor] = useState('')
  const [projectId, setProjectId] = useState('')
  const [billable, setBillable] = useState(false)
  const [status, setStatus] = useState<'paid' | 'pending'>('paid')
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)

  // Find the internal/company client (Mano CG)
  const getClientForProject = (pid: string) => {
    const project = projects.find((p: any) => p.id === pid)
    if (!project) return null
    return clients.find((c: any) => c.id === project.client_id) || null
  }

  const isInternalClient = (client: any) => {
    if (!client) return false
    const name = (client.name || '').toLowerCase()
    // Match company's own entity — Mano CG, Mano Consulting, etc.
    return name.includes('mano') || name.includes('internal') || name.includes('overhead')
  }

  const selectedClient = projectId ? getClientForProject(projectId) : null

  // Auto-toggle billable when project changes
  const handleProjectChange = (val: string) => {
    setProjectId(val)
    if (!val) { setBillable(false); return }
    const client = getClientForProject(val)
    // Internal client (Mano CG) → overhead, external client → billable
    setBillable(!isInternalClient(client))
  }

  // Derive accounting category from billable flag
  const getAccountingCategory = () => {
    const sub = TYPE_TO_SUBCATEGORY[expenseType] || TYPE_TO_SUBCATEGORY.other
    if (billable) return { category: 'directCosts', subcategory: sub.direct }
    return { category: 'overhead', subcategory: sub.overhead }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter(f => 
        f.type === 'application/pdf' || f.type.startsWith('image/')
      )
      setFiles(prev => [...prev, ...newFiles])
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => 
      f.type === 'application/pdf' || f.type.startsWith('image/')
    )
    setFiles(prev => [...prev, ...droppedFiles])
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleSave = async () => {
    if (!amount || (!description && expenseType !== 'other')) return

    setUploading(true)
    
    // Upload files to Supabase storage if any
    const uploadedUrls: string[] = []
    for (const file of files) {
      try {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`
        const filePath = `expenses/${fileName}`
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('Receipts')
          .upload(filePath, file)
        
        if (!uploadError && uploadData) {
          uploadedUrls.push(filePath)
        }
      } catch (err) {
        console.error('File upload error:', err)
      }
    }

    const { category, subcategory } = getAccountingCategory()

    onSave({
      category,
      subcategory,
      expense_type: expenseType,
      amount: parseFloat(amount) || 0,
      date,
      description,
      vendor,
      project_id: projectId || null,
      is_billable: billable,
      status,
      receipt_urls: uploadedUrls.length > 0 ? uploadedUrls : null,
    })
    setUploading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-2xl w-full max-w-lg mx-4 overflow-hidden shadow-2xl max-h-[90vh] flex flex-col`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder} shrink-0`}>
          <div>
            <h3 className={`text-lg font-semibold ${THEME.textPrimary}`}>New Expense</h3>
            <p className={`text-xs ${THEME.textDim} mt-0.5`}>Submit and track expense reports</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/[0.05] rounded-lg transition-colors">
            <X size={20} className={THEME.textMuted} />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Date & Category Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Date</label>
              <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" 
              />
            </div>
            <div>
              <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Category</label>
              <select 
                value={expenseType} 
                onChange={(e) => setExpenseType(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
              >
                {QUICK_EXPENSE_TYPES.map(t => (
                  <option key={t.id} value={t.id} className="bg-slate-900">{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Amount <span className="text-rose-400">*</span></label>
            <div className="relative">
              <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${THEME.textDim}`}>$</span>
              <input 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                placeholder="0.00"
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg pl-7 pr-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" 
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>
              Description {expenseType === 'other' && <span className="text-rose-400">*</span>}
            </label>
            <input 
              type="text" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder={expenseType === 'other' ? 'Describe the expense...' : 'What was this expense for?'}
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" 
            />
          </div>

          {/* File Upload — Multi-file (PDF, JPEG, PNG) */}
          <div>
            <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Receipts / Documents</label>
            <div 
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className={`border-2 border-dashed ${files.length > 0 ? 'border-emerald-500/30' : 'border-white/[0.1]'} rounded-lg p-4 text-center transition-colors hover:border-white/[0.2]`}
            >
              <input 
                type="file" 
                id="receipt-upload"
                onChange={handleFileChange}
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                className="hidden"
              />
              <label htmlFor="receipt-upload" className="cursor-pointer">
                <Receipt size={24} className={`mx-auto ${THEME.textDim} mb-2`} />
                <p className={`text-sm ${THEME.textMuted}`}>Drop files here or <span className="text-emerald-400 hover:underline">browse</span></p>
                <p className={`text-xs ${THEME.textDim} mt-1`}>PDF, JPEG, PNG — multiple files allowed</p>
              </label>
            </div>
            {/* File List */}
            {files.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-3 bg-white/[0.03] rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        file.type === 'application/pdf' ? 'bg-rose-500/15 text-rose-400' : 'bg-blue-500/15 text-blue-400'
                      }`}>
                        {file.type === 'application/pdf' ? 'PDF' : 'IMG'}
                      </span>
                      <span className={`text-sm ${THEME.textSecondary} truncate`}>{file.name}</span>
                      <span className={`text-xs ${THEME.textDim} shrink-0`}>{formatFileSize(file.size)}</span>
                    </div>
                    <button onClick={() => removeFile(i)} className="p-1 hover:bg-white/[0.05] rounded transition-colors shrink-0">
                      <X size={14} className={THEME.textDim} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Project & Billable */}
          <div>
            <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Project</label>
            <select 
              value={projectId} 
              onChange={(e) => handleProjectChange(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
            >
              <option value="" className="bg-slate-900">No project</option>
              {projects.map(p => {
                const cl = clients.find((c: any) => c.id === p.client_id)
                return <option key={p.id} value={p.id} className="bg-slate-900">{p.name}{cl ? ` (${cl.name})` : ''}</option>
              })}
            </select>
          </div>

          {/* Billable Indicator — auto-derived from client */}
          {projectId && (
            <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg border ${
              billable 
                ? 'bg-emerald-500/10 border-emerald-500/20' 
                : 'bg-amber-500/10 border-amber-500/20'
            }`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${billable ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <div>
                  <span className={`text-xs font-medium ${billable ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {billable ? 'Direct Cost' : 'Overhead'} — {selectedClient?.name || 'Unknown'}
                  </span>
                  <p className={`text-xs ${THEME.textDim} mt-0.5`}>
                    {billable ? 'Billable to client at cost → hits Gross Margin' : 'Company expense → Operating Costs'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setBillable(!billable)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  billable 
                    ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30' 
                    : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                }`}
              >
                Override
              </button>
            </div>
          )}

          {/* Status */}
          <div>
            <label className={`block text-sm font-medium ${THEME.textMuted} mb-2`}>Status</label>
            <div className="flex gap-2">
              <button 
                onClick={() => setStatus('paid')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  status === 'paid' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/[0.05] text-slate-400 border border-transparent'
                }`}
              >
                Paid
              </button>
              <button 
                onClick={() => setStatus('pending')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  status === 'pending' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/[0.05] text-slate-400 border border-transparent'
                }`}
              >
                Pending
              </button>
            </div>
          </div>
        </div>

        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${THEME.glassBorder} bg-white/[0.02] shrink-0`}>
          <button onClick={onClose} className={`px-4 py-2 text-sm font-medium ${THEME.textMuted} hover:text-white transition-colors`}>
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={!amount || (expenseType === 'other' && !description) || uploading}
            className="px-5 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-emerald-500/20"
          >
            {uploading ? 'Uploading...' : 'Submit Expense'}
          </button>
        </div>
      </div>
    </div>
  )
}
