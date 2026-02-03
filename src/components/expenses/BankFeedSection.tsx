'use client'

import React, { useState, useMemo } from 'react'
import {
  Search, ChevronDown, ChevronUp, Check, X, SkipForward,
  Landmark, ArrowRight, CreditCard, AlertCircle, CheckCircle2, RefreshCw
} from 'lucide-react'
import {
  THEME, EXPENSE_CATEGORIES, getCategoryConfig,
  formatCurrency, formatDateShort
} from './shared'

interface BankFeedSectionProps {
  transactions: any[]
  expenses: any[]
  projects: any[]
  onCategorizeTransaction: (transactionId: string, expenseData: any) => void
  onSkipTransaction: (transactionId: string) => void
  onSyncQBO: () => void
  isSyncing: boolean
}

export default function BankFeedSection({
  transactions, expenses, projects, onCategorizeTransaction, onSkipTransaction, onSyncQBO, isSyncing
}: BankFeedSectionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'pending' | 'categorized' | 'skipped' | 'all'>('pending')
  const [sortField, setSortField] = useState('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Uncategorized = negative transactions (withdrawals) that aren't linked to an expense
  const processedTransactions = useMemo(() => {
    // Get expense-linked transaction IDs
    const linkedTransactionIds = new Set(expenses.filter(e => e.transaction_id).map(e => e.transaction_id))
    
    return transactions
      .filter(t => t.amount < 0) // Only withdrawals/expenses
      .map(t => ({
        ...t,
        displayAmount: Math.abs(t.amount),
        status: t.skipped ? 'skipped' : linkedTransactionIds.has(t.id) ? 'categorized' : 'pending'
      }))
  }, [transactions, expenses])

  // Filter & sort
  const filteredTransactions = useMemo(() => {
    let result = [...processedTransactions]

    // Status filter
    if (filterStatus !== 'all') {
      result = result.filter(t => t.status === filterStatus)
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(t =>
        t.description?.toLowerCase().includes(q) ||
        t.memo?.toLowerCase().includes(q)
      )
    }

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortField], bVal = b[sortField]
      if (sortField === 'date') { aVal = new Date(aVal).getTime(); bVal = new Date(bVal).getTime() }
      if (sortField === 'amount') { aVal = a.displayAmount; bVal = b.displayAmount }
      return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
    })

    return result
  }, [processedTransactions, filterStatus, searchQuery, sortField, sortDir])

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  // Metrics
  const metrics = useMemo(() => ({
    pending: processedTransactions.filter(t => t.status === 'pending').length,
    categorized: processedTransactions.filter(t => t.status === 'categorized').length,
    skipped: processedTransactions.filter(t => t.status === 'skipped').length,
    pendingAmount: processedTransactions.filter(t => t.status === 'pending').reduce((s, t) => s + t.displayAmount, 0)
  }), [processedTransactions])

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-5`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${THEME.textMuted}`}>Pending Review</p>
              <p className="text-2xl font-semibold text-amber-400 mt-1">{metrics.pending}</p>
              <p className={`text-xs ${THEME.textDim} mt-1`}>{formatCurrency(metrics.pendingAmount)} uncategorized</p>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10">
              <AlertCircle size={20} className="text-amber-400" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-5`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${THEME.textMuted}`}>Categorized</p>
              <p className="text-2xl font-semibold text-emerald-400 mt-1">{metrics.categorized}</p>
              <p className={`text-xs ${THEME.textDim} mt-1`}>Linked to expenses</p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10">
              <CheckCircle2 size={20} className="text-emerald-400" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-5`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${THEME.textMuted}`}>Skipped</p>
              <p className="text-2xl font-semibold text-slate-400 mt-1">{metrics.skipped}</p>
              <p className={`text-xs ${THEME.textDim} mt-1`}>Transfers, duplicates</p>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.05]">
              <SkipForward size={20} className={THEME.textMuted} strokeWidth={1.5} />
            </div>
          </div>
        </div>

        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-5`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${THEME.textMuted}`}>Bank Sync</p>
              <p className="text-lg font-semibold text-slate-300 mt-1">QuickBooks</p>
              <p className={`text-xs ${THEME.textDim} mt-1`}>Connected</p>
            </div>
            <button 
              onClick={onSyncQBO}
              disabled={isSyncing}
              className="p-2.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={20} className={`text-blue-400 ${isSyncing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Review Table */}
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
          <div>
            <h2 className={`text-sm font-semibold ${THEME.textPrimary}`}>Bank Transactions</h2>
            <p className={`text-xs ${THEME.textDim} mt-0.5`}>Review and categorize transactions from your bank feed</p>
          </div>
          <button 
            onClick={onSyncQBO}
            disabled={isSyncing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg text-sm font-medium hover:bg-blue-500/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            {isSyncing ? 'Syncing...' : 'Sync QBO'}
          </button>
        </div>

        {/* Filters */}
        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 border-b ${THEME.glassBorder}`}>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setFilterStatus('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === 'pending' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/[0.05] text-slate-400 hover:text-white'
              }`}
            >
              Pending ({metrics.pending})
            </button>
            <button 
              onClick={() => setFilterStatus('categorized')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === 'categorized' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/[0.05] text-slate-400 hover:text-white'
              }`}
            >
              Categorized ({metrics.categorized})
            </button>
            <button 
              onClick={() => setFilterStatus('skipped')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === 'skipped' ? 'bg-slate-500/20 text-slate-300 border border-slate-500/30' : 'bg-white/[0.05] text-slate-400 hover:text-white'
              }`}
            >
              Skipped ({metrics.skipped})
            </button>
            <button 
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === 'all' ? 'bg-white/[0.1] text-white border border-white/20' : 'bg-white/[0.05] text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              placeholder="Search transactions..."
              className="bg-white/[0.05] border border-white/[0.1] rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" 
            />
          </div>
        </div>

        {/* Column Headers */}
        <div className={`flex items-center gap-3 py-2.5 px-4 bg-white/[0.03] border-b ${THEME.glassBorder} text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>
          <button onClick={() => handleSort('date')} className="w-24 shrink-0 flex items-center gap-1 hover:text-white transition-colors">
            Date {sortField === 'date' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <div className="flex-1 min-w-0">Description</div>
          <div className="w-24 shrink-0">Category</div>
          <button onClick={() => handleSort('amount')} className="w-28 text-right shrink-0 flex items-center justify-end gap-1 hover:text-white transition-colors">
            Amount {sortField === 'amount' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <div className="w-24 shrink-0">Status</div>
          <div className="w-48 shrink-0 text-center">Actions</div>
        </div>

        {/* Transaction List */}
        <div className="max-h-[500px] overflow-y-auto">
          {filteredTransactions.length > 0 ? filteredTransactions.map(transaction => (
            <TransactionRow 
              key={transaction.id}
              transaction={transaction}
              projects={projects}
              onCategorize={onCategorizeTransaction}
              onSkip={onSkipTransaction}
            />
          )) : (
            <div className={`flex flex-col items-center justify-center py-16 gap-4`}>
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 size={28} className="text-emerald-400" />
              </div>
              <div className="text-center">
                <p className={`font-medium ${THEME.textSecondary}`}>
                  {filterStatus === 'pending' ? 'All caught up!' : 'No transactions found'}
                </p>
                <p className={`text-sm ${THEME.textDim} mt-1`}>
                  {filterStatus === 'pending' ? 'No pending transactions to review' : 'Try adjusting your filters'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Transaction Row with Quick Categorize
function TransactionRow({ transaction, projects, onCategorize, onSkip }: {
  transaction: any
  projects: any[]
  onCategorize: (transactionId: string, expenseData: any) => void
  onSkip: (transactionId: string) => void
}) {
  const [showCategorize, setShowCategorize] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof EXPENSE_CATEGORIES>('overhead')
  const [selectedSubcategory, setSelectedSubcategory] = useState('software')
  const [selectedProject, setSelectedProject] = useState('')

  const handleCategoryChange = (cat: keyof typeof EXPENSE_CATEGORIES) => {
    setSelectedCategory(cat)
    setSelectedSubcategory(EXPENSE_CATEGORIES[cat].subcategories[0].id)
  }

  const handleConfirm = () => {
    onCategorize(transaction.id, {
      category: selectedCategory,
      subcategory: selectedSubcategory,
      project_id: selectedProject || null,
      description: transaction.description,
      amount: transaction.displayAmount,
      date: transaction.date,
      vendor: transaction.memo || transaction.description,
      status: 'paid',
      transaction_id: transaction.id
    })
    setShowCategorize(false)
  }

  const statusConfig = {
    pending: { label: 'Pending', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
    categorized: { label: 'Done', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    skipped: { label: 'Skipped', bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' }
  }
  const status = statusConfig[transaction.status as keyof typeof statusConfig]

  return (
    <div className={`border-b border-white/[0.05] ${showCategorize ? 'bg-white/[0.02]' : ''}`}>
      {/* Main Row */}
      <div className="flex items-center gap-3 py-3 px-4 hover:bg-white/[0.03] transition-colors">
        <div className="w-24 shrink-0">
          <p className={`text-sm ${THEME.textMuted}`}>{formatDateShort(transaction.date)}</p>
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${THEME.textPrimary} truncate`}>{transaction.description}</p>
          {transaction.memo && <p className={`text-xs ${THEME.textDim} truncate`}>{transaction.memo}</p>}
        </div>
        <div className="w-24 shrink-0">
          <span className={`text-xs ${THEME.textDim}`}>{transaction.category || '—'}</span>
        </div>
        <div className="w-28 text-right shrink-0">
          <p className="text-sm font-semibold text-rose-400">{formatCurrency(transaction.displayAmount)}</p>
        </div>
        <div className="w-24 shrink-0">
          <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${status.bg} ${status.text} border ${status.border}`}>
            {status.label}
          </span>
        </div>
        <div className="w-48 shrink-0 flex items-center justify-center gap-2">
          {transaction.status === 'pending' && (
            <>
              <button
                onClick={() => setShowCategorize(!showCategorize)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium hover:bg-emerald-500/20 transition-colors"
              >
                <ArrowRight size={12} /> Categorize
              </button>
              <button
                onClick={() => onSkip(transaction.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] text-slate-400 rounded-lg text-xs font-medium hover:bg-white/[0.08] hover:text-white transition-colors"
              >
                <SkipForward size={12} /> Skip
              </button>
            </>
          )}
          {transaction.status === 'skipped' && (
            <button
              onClick={() => setShowCategorize(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.05] text-slate-400 rounded-lg text-xs font-medium hover:bg-white/[0.08] hover:text-white transition-colors"
            >
              Recategorize
            </button>
          )}
        </div>
      </div>

      {/* Categorize Panel */}
      {showCategorize && (
        <div className={`px-4 pb-4 pt-2 bg-white/[0.02] border-t border-white/[0.05]`}>
          <div className="flex items-end gap-4">
            {/* Category */}
            <div className="flex-1">
              <label className={`block text-xs font-medium ${THEME.textDim} mb-1.5`}>Category</label>
              <div className="flex gap-1">
                {Object.values(EXPENSE_CATEGORIES).map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryChange(cat.id as keyof typeof EXPENSE_CATEGORIES)}
                    className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                      selectedCategory === cat.id
                        ? `${cat.bgClass} ${cat.textClass} border ${cat.borderClass}`
                        : 'bg-white/[0.05] text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Subcategory */}
            <div className="w-44">
              <label className={`block text-xs font-medium ${THEME.textDim} mb-1.5`}>Type</label>
              <select
                value={selectedSubcategory}
                onChange={(e) => setSelectedSubcategory(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                {EXPENSE_CATEGORIES[selectedCategory].subcategories.map(sub => (
                  <option key={sub.id} value={sub.id} className="bg-slate-900">{sub.name}</option>
                ))}
              </select>
            </div>

            {/* Project */}
            <div className="w-44">
              <label className={`block text-xs font-medium ${THEME.textDim} mb-1.5`}>Project</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="" className="bg-slate-900">No project</option>
                {projects.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>)}
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowCategorize(false)}
                className="p-2 bg-white/[0.05] text-slate-400 rounded-lg hover:bg-white/[0.08] hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
              <button
                onClick={handleConfirm}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
              >
                <Check size={14} /> Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
