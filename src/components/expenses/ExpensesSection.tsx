'use client'

import React, { useState, useMemo, forwardRef, useImperativeHandle } from 'react'
import {
  Search, ChevronDown, ChevronUp, Trash2, Receipt, Plus, X
} from 'lucide-react'
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
          teamMembers={teamMembers}
          onSave={onAddExpense} 
        />
      )}
    </div>
  )
})

ExpensesSection.displayName = 'ExpensesSection'
export default ExpensesSection

// Add Expense Modal
function AddExpenseModal({ onClose, projects, teamMembers, onSave }: {
  onClose: () => void
  projects: any[]
  teamMembers: any[]
  onSave: (expense: any) => void
}) {
  const [category, setCategory] = useState<keyof typeof EXPENSE_CATEGORIES>('overhead')
  const [subcategory, setSubcategory] = useState('software')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [vendor, setVendor] = useState('')
  const [projectId, setProjectId] = useState('')
  const [status, setStatus] = useState<'paid' | 'pending'>('paid')

  const handleCategoryChange = (newCategory: string) => {
    const cat = newCategory as keyof typeof EXPENSE_CATEGORIES
    setCategory(cat)
    setSubcategory(EXPENSE_CATEGORIES[cat].subcategories[0].id)
  }

  const handleSave = () => {
    onSave({
      category,
      subcategory,
      amount: parseFloat(amount) || 0,
      date,
      description,
      vendor,
      project_id: projectId || null,
      status
    })
    onClose()
  }

  const currentCategory = EXPENSE_CATEGORIES[category]

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-2xl w-full max-w-lg mx-4 overflow-hidden shadow-2xl`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
          <div>
            <h3 className={`text-lg font-semibold ${THEME.textPrimary}`}>Add Expense</h3>
            <p className={`text-xs ${THEME.textDim} mt-0.5`}>Track business and personal expenses</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/[0.05] rounded-lg transition-colors">
            <X size={20} className={THEME.textMuted} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Category Selection */}
          <div>
            <label className={`block text-sm font-medium ${THEME.textMuted} mb-2`}>Category</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.values(EXPENSE_CATEGORIES).map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`py-2.5 px-3 rounded-lg text-xs font-medium transition-colors ${
                    category === cat.id 
                      ? `${cat.bgClass} ${cat.textClass} border ${cat.borderClass}` 
                      : 'bg-white/[0.05] text-slate-400 border border-transparent hover:bg-white/[0.08]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <p className={`text-xs ${THEME.textDim} mt-2`}>{currentCategory.description}</p>
          </div>

          {/* Subcategory */}
          <div>
            <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Type</label>
            <select 
              value={subcategory} 
              onChange={(e) => setSubcategory(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
            >
              {currentCategory.subcategories.map(sub => (
                <option key={sub.id} value={sub.id} className="bg-slate-900">{sub.name}</option>
              ))}
            </select>
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-4">
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
            <div>
              <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Date</label>
              <input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer" 
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Description <span className="text-rose-400">*</span></label>
            <input 
              type="text" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="What was this expense for?"
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" 
            />
          </div>

          {/* Vendor */}
          <div>
            <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Vendor / Payee</label>
            <input 
              type="text" 
              value={vendor} 
              onChange={(e) => setVendor(e.target.value)} 
              placeholder="Who did you pay?"
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" 
            />
          </div>

          {/* Project */}
          <div>
            <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Project</label>
            <select 
              value={projectId} 
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
            >
              <option value="" className="bg-slate-900">No project (general expense)</option>
              {projects.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>)}
            </select>
            <p className={`text-xs ${THEME.textDim} mt-1.5`}>Project-linked expenses auto-associate with the client</p>
          </div>

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

        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${THEME.glassBorder} bg-white/[0.02]`}>
          <button onClick={onClose} className={`px-4 py-2 text-sm font-medium ${THEME.textMuted} hover:text-white transition-colors`}>
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={!amount || !description}
            className="px-5 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-emerald-500/20"
          >
            Add Expense
          </button>
        </div>
      </div>
    </div>
  )
}
