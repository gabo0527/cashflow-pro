'use client'

import React, { useState, useMemo } from 'react'
import {
  Search, ChevronDown, ChevronUp, Check, X, SkipForward,
  Landmark, ArrowRight, CreditCard, AlertCircle, CheckCircle2, RefreshCw,
  ArrowDownLeft, ArrowUpRight, Filter, User
} from 'lucide-react'
import {
  THEME, EXPENSE_CATEGORIES, INCOME_CATEGORIES, TRANSFER_CATEGORY,
  getCategoryConfig, getCategoriesForDirection, CARDHOLDERS,
  formatCurrency, formatDateShort, shortAccountName
} from './shared'

interface BankFeedSectionProps {
  transactions: any[]
  expenses: any[]
  projects: any[]
  clients: any[]
  categories: typeof EXPENSE_CATEGORIES
  onCategorizeTransaction: (transactionId: string, data: any) => void
  onSkipTransaction: (transactionId: string) => void
  onSyncQBO: () => void
  isSyncing: boolean
  syncStatus?: string
}

export default function BankFeedSection({
  transactions, expenses, projects, clients, categories, onCategorizeTransaction, onSkipTransaction, onSyncQBO, isSyncing, syncStatus
}: BankFeedSectionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'pending' | 'categorized' | 'skipped' | 'all'>('pending')
  const [filterDirection, setFilterDirection] = useState<'all' | 'inflow' | 'outflow'>('all')
  const [filterAccount, setFilterAccount] = useState<string>('all')
  const [sortField, setSortField] = useState('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const processedTransactions = useMemo(() => {
    const linkedTransactionIds = new Set(expenses.filter(e => e.transaction_id).map(e => e.transaction_id))
    return transactions.map(t => ({
      ...t,
      displayAmount: Math.abs(t.amount),
      isInflow: t.amount >= 0,
      status: t.skipped ? 'skipped' : (linkedTransactionIds.has(t.id) || t.category) ? 'categorized' : 'pending',
      shortAccount: shortAccountName(t.account_name || ''),
    }))
  }, [transactions, expenses])

  const accounts = useMemo(() => {
    const accts = new Set(processedTransactions.map(t => t.account_name).filter(Boolean))
    return Array.from(accts)
  }, [processedTransactions])

  const filteredTransactions = useMemo(() => {
    let result = [...processedTransactions]
    if (filterDirection === 'inflow') result = result.filter(t => t.isInflow)
    else if (filterDirection === 'outflow') result = result.filter(t => !t.isInflow)
    if (filterAccount !== 'all') result = result.filter(t => t.account_name === filterAccount)
    if (filterStatus !== 'all') result = result.filter(t => t.status === filterStatus)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(t => t.description?.toLowerCase().includes(q) || t.payee?.toLowerCase().includes(q) || t.memo?.toLowerCase().includes(q))
    }
    result.sort((a, b) => {
      let aVal = a[sortField], bVal = b[sortField]
      if (sortField === 'date') { aVal = new Date(aVal).getTime(); bVal = new Date(bVal).getTime() }
      if (sortField === 'amount') { aVal = a.displayAmount; bVal = b.displayAmount }
      return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
    })
    return result
  }, [processedTransactions, filterDirection, filterAccount, filterStatus, searchQuery, sortField, sortDir])

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const metrics = useMemo(() => {
    const pending = processedTransactions.filter(t => t.status === 'pending')
    const categorized = processedTransactions.filter(t => t.status === 'categorized')
    const skipped = processedTransactions.filter(t => t.status === 'skipped')
    return {
      pending: pending.length,
      categorized: categorized.length,
      skipped: skipped.length,
      pendingAmount: pending.reduce((s, t) => s + t.displayAmount, 0),
      totalInflows: processedTransactions.filter(t => t.isInflow).length,
      totalOutflows: processedTransactions.filter(t => !t.isInflow).length,
      inflowAmount: processedTransactions.filter(t => t.isInflow).reduce((s, t) => s + t.displayAmount, 0),
      outflowAmount: processedTransactions.filter(t => !t.isInflow).reduce((s, t) => s + t.displayAmount, 0),
    }
  }, [processedTransactions])

  const pillClass = (active: boolean, variant: 'amber' | 'emerald' | 'slate' | 'teal' = 'teal') => {
    const colors = {
      amber: active ? 'bg-amber-50 text-amber-700 border border-amber-200 shadow-sm' : '',
      emerald: active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm' : '',
      slate: active ? 'bg-slate-100 text-slate-700 border border-slate-300 shadow-sm' : '',
      teal: active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm' : '',
    }
    return `px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
      active ? colors[variant] : 'bg-white text-slate-400 border border-slate-200 hover:text-slate-600 hover:bg-slate-50'
    }`
  }

  return (
    <div className="space-y-5">
      {/* Header Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${THEME.card} p-5`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${THEME.textMuted}`}>Pending Review</p>
              <p className="text-2xl font-semibold text-amber-600 mt-1 tabular-nums">{metrics.pending}</p>
              <p className={`text-xs ${THEME.textDim} mt-1 tabular-nums`}>{formatCurrency(metrics.pendingAmount)} uncategorized</p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50"><AlertCircle size={20} className="text-amber-600" strokeWidth={1.5} /></div>
          </div>
        </div>
        <div className={`${THEME.card} p-5`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${THEME.textMuted}`}>Categorized</p>
              <p className="text-2xl font-semibold text-emerald-600 mt-1 tabular-nums">{metrics.categorized}</p>
              <p className={`text-xs ${THEME.textDim} mt-1`}>Linked to expenses</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50"><CheckCircle2 size={20} className="text-emerald-600" strokeWidth={1.5} /></div>
          </div>
        </div>
        <div className={`${THEME.card} p-5`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${THEME.textMuted}`}>Inflows</p>
              <p className="text-2xl font-semibold text-emerald-600 mt-1 tabular-nums">{metrics.totalInflows}</p>
              <p className={`text-xs ${THEME.textDim} mt-1 tabular-nums`}>{formatCurrency(metrics.inflowAmount)} received</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50"><ArrowDownLeft size={20} className="text-emerald-600" strokeWidth={1.5} /></div>
          </div>
        </div>
        <div className={`${THEME.card} p-5`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${THEME.textMuted}`}>Bank Sync</p>
              <p className="text-lg font-semibold text-slate-700 mt-1">QuickBooks</p>
              <p className={`text-xs ${THEME.textDim} mt-1`}>Connected</p>
            </div>
            <button onClick={onSyncQBO} disabled={isSyncing}
              className="p-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50">
              <RefreshCw size={20} className={`text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className={`${THEME.card} overflow-hidden`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.border}`}>
          <div>
            <h2 className={`text-sm font-semibold ${THEME.textPrimary}`}>Bank Transactions</h2>
            <p className={`text-xs ${THEME.textDim} mt-0.5`}>Review and categorize transactions from your bank feed</p>
          </div>
          <div className="flex items-center gap-3">
            {syncStatus && (
              <span className={`text-xs font-medium ${syncStatus.startsWith('Done') ? 'text-emerald-600' : 'text-blue-600'}`}>{syncStatus}</span>
            )}
            <button onClick={onSyncQBO} disabled={isSyncing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors disabled:opacity-50">
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? 'Syncing...' : 'Sync QBO'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className={`flex flex-col gap-3 px-6 py-4 border-b ${THEME.border}`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setFilterStatus('pending')} className={pillClass(filterStatus === 'pending', 'amber')}>Pending ({metrics.pending})</button>
              <button onClick={() => setFilterStatus('categorized')} className={pillClass(filterStatus === 'categorized', 'emerald')}>Categorized ({metrics.categorized})</button>
              <button onClick={() => setFilterStatus('skipped')} className={pillClass(filterStatus === 'skipped', 'slate')}>Skipped ({metrics.skipped})</button>
              <button onClick={() => setFilterStatus('all')} className={pillClass(filterStatus === 'all', 'teal')}>All</button>
              <div className="w-px h-5 bg-slate-200 mx-1" />
              <button onClick={() => setFilterDirection('all')} className={pillClass(filterDirection === 'all', 'teal')}>All</button>
              <button onClick={() => setFilterDirection('inflow')} className={pillClass(filterDirection === 'inflow', 'emerald')}>
                <span className="flex items-center gap-1"><ArrowDownLeft size={11} /> Inflows ({metrics.totalInflows})</span>
              </button>
              <button onClick={() => setFilterDirection('outflow')} className={pillClass(filterDirection === 'outflow', 'amber')}>
                <span className="flex items-center gap-1"><ArrowUpRight size={11} /> Outflows ({metrics.totalOutflows})</span>
              </button>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder="Search transactions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className={`${THEME.input} pl-9 pr-4 py-2 w-64`} />
            </div>
          </div>
          {accounts.length > 1 && (
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim}`}>Account:</span>
              <button onClick={() => setFilterAccount('all')} className={pillClass(filterAccount === 'all', 'teal')}>All Accounts</button>
              {accounts.map(acct => (
                <button key={acct} onClick={() => setFilterAccount(acct)} className={pillClass(filterAccount === acct, 'teal')}>{shortAccountName(acct)}</button>
              ))}
            </div>
          )}
        </div>

        {/* Table Header */}
        <div className={`grid grid-cols-[80px_1fr_100px_100px_100px_90px_180px] gap-2 items-center px-4 py-2.5 border-b ${THEME.border} bg-slate-50`}>
          <button onClick={() => handleSort('date')} className={`text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim} text-left flex items-center gap-1 hover:text-slate-600`}>
            Date {sortField === 'date' && (sortDir === 'desc' ? <ChevronDown size={10} /> : <ChevronUp size={10} />)}
          </button>
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim}`}>Description</span>
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim}`}>Account</span>
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim}`}>Category</span>
          <button onClick={() => handleSort('amount')} className={`text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim} text-right flex items-center justify-end gap-1 hover:text-slate-600`}>
            Amount {sortField === 'amount' && (sortDir === 'desc' ? <ChevronDown size={10} /> : <ChevronUp size={10} />)}
          </button>
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim} text-center`}>Status</span>
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim} text-center`}>Actions</span>
        </div>

        {/* Rows */}
        <div className="max-h-[600px] overflow-y-auto">
          {filteredTransactions.length > 0 ? (
            filteredTransactions.map(t => (
              <TransactionRow key={t.id} transaction={t} projects={projects} clients={clients} categories={categories}
                onCategorize={onCategorizeTransaction} onSkip={onSkipTransaction} />
            ))
          ) : (
            <div className="py-16 text-center">
              <Landmark size={32} className={`${THEME.textDim} mx-auto mb-3`} strokeWidth={1} />
              <p className={`font-medium ${THEME.textSecondary}`}>{filterStatus === 'pending' ? 'All caught up!' : 'No transactions found'}</p>
              <p className={`text-sm ${THEME.textDim} mt-1`}>{filterStatus === 'pending' ? 'No pending transactions to review' : 'Try adjusting your filters'}</p>
            </div>
          )}
        </div>

        {filteredTransactions.length > 0 && (
          <div className={`px-6 py-3 border-t ${THEME.border} bg-slate-50`}>
            <p className={`text-xs ${THEME.textDim}`}>
              Showing {filteredTransactions.length} of {processedTransactions.length} transactions
              {filterDirection !== 'all' && ` (${filterDirection}s only)`}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ============ TRANSACTION ROW ============
function TransactionRow({ transaction, projects, clients, categories, onCategorize, onSkip }: {
  transaction: any; projects: any[]; clients: any[]; categories: typeof EXPENSE_CATEGORIES
  onCategorize: (transactionId: string, data: any) => void; onSkip: (transactionId: string) => void
}) {
  const [showCategorize, setShowCategorize] = useState(false)
  const isInflow = transaction.isInflow
  const isCC = transaction.account_name?.toLowerCase().includes('credit') || transaction.account_name?.toLowerCase().includes('bofa')

  const defaultCat = isInflow ? 'clientPayments' : 'overhead'
  const defaultSub = isInflow ? 'invoicePayment' : (categories.overhead?.subcategories?.[0]?.id || 'software')

  const [selectedCategory, setSelectedCategory] = useState(defaultCat)
  const [selectedSubcategory, setSelectedSubcategory] = useState(defaultSub)
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedCardholder, setSelectedCardholder] = useState('')

  const activeCats = isInflow ? { ...INCOME_CATEGORIES, ...TRANSFER_CATEGORY } : { ...categories, ...TRANSFER_CATEGORY }
  const allMerged = { ...categories, ...INCOME_CATEGORIES, ...TRANSFER_CATEGORY }

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat)
    const catConfig = allMerged[cat as keyof typeof allMerged]
    if (catConfig?.subcategories?.length) setSelectedSubcategory(catConfig.subcategories[0].id)
  }

  const handleConfirm = () => {
    onCategorize(transaction.id, {
      category: selectedCategory, subcategory: selectedSubcategory,
      project_id: selectedProject || null, client_id: selectedClient || null,
      cardholder: selectedCardholder || null, description: transaction.description,
      amount: transaction.displayAmount, date: transaction.date,
      vendor: transaction.payee || transaction.description,
      type: isInflow ? 'income' : 'expense',
      transaction_id: transaction.id, account_name: transaction.account_name,
    })
    setShowCategorize(false)
  }

  const statusConfig = {
    pending:     { label: 'Pending', bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200' },
    categorized: { label: 'Done',    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    skipped:     { label: 'Skipped', bg: 'bg-slate-100',  text: 'text-slate-600',   border: 'border-slate-300' },
  }
  const status = statusConfig[transaction.status as keyof typeof statusConfig]

  return (
    <div className={`border-b border-slate-100 ${showCategorize ? 'bg-slate-50' : ''}`}>
      <div className="grid grid-cols-[80px_1fr_100px_100px_100px_90px_180px] gap-2 items-center py-3 px-4 hover:bg-slate-50 transition-colors">
        <p className={`text-sm ${THEME.textMuted} tabular-nums`}>{formatDateShort(transaction.date)}</p>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`shrink-0 w-5 h-5 rounded flex items-center justify-center ${isInflow ? 'bg-emerald-50' : 'bg-rose-50'}`}>
              {isInflow ? <ArrowDownLeft size={11} className="text-emerald-600" /> : <ArrowUpRight size={11} className="text-rose-600" />}
            </span>
            <p className={`text-sm ${THEME.textPrimary} truncate`}>{transaction.description}</p>
          </div>
          {transaction.payee && transaction.payee !== transaction.description && (
            <p className={`text-xs ${THEME.textDim} truncate ml-7`}>{transaction.payee}</p>
          )}
        </div>
        <span className={`text-xs ${THEME.textDim} truncate`}>{transaction.shortAccount}</span>
        <span className="text-xs">
          {transaction.category ? (
            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${getCategoryConfig(transaction.category).bgClass} ${getCategoryConfig(transaction.category).textClass}`}>
              {getCategoryConfig(transaction.category).label}
            </span>
          ) : <span className={THEME.textDim}>—</span>}
        </span>
        <div className="text-right">
          <p className={`text-sm font-semibold tabular-nums ${isInflow ? 'text-emerald-600' : 'text-rose-600'}`}>
            {isInflow ? '+' : '-'}{formatCurrency(transaction.displayAmount)}
          </p>
        </div>
        <div className="text-center">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${status.bg} ${status.text} border ${status.border}`}>{status.label}</span>
        </div>
        <div className="flex items-center justify-center gap-2">
          {transaction.status === 'pending' && (
            <>
              <button onClick={() => setShowCategorize(!showCategorize)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors">
                <ArrowRight size={12} /> Categorize
              </button>
              <button onClick={() => onSkip(transaction.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-500 border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-100 hover:text-slate-700 transition-colors">
                <SkipForward size={12} /> Skip
              </button>
            </>
          )}
          {transaction.status === 'skipped' && (
            <button onClick={() => setShowCategorize(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-500 border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-100 hover:text-slate-700 transition-colors">
              Recategorize
            </button>
          )}
        </div>
      </div>

      {/* Categorize Panel */}
      {showCategorize && (
        <div className="px-4 pb-4 pt-3 bg-slate-50 border-t border-slate-200">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className={`block text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim} mb-1.5`}>Category</label>
              <div className="flex flex-wrap gap-1">
                {Object.values(activeCats).map(cat => (
                  <button key={cat.id} onClick={() => handleCategoryChange(cat.id)}
                    className={`px-2.5 py-1.5 rounded text-xs font-medium transition-all ${
                      selectedCategory === cat.id
                        ? `${cat.bgClass} ${cat.textClass} border ${cat.borderClass} shadow-sm`
                        : 'bg-white text-slate-400 border border-slate-200 hover:text-slate-600'
                    }`}>{cat.label}</button>
                ))}
              </div>
            </div>
            <div className="w-44">
              <label className={`block text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim} mb-1.5`}>Type</label>
              <select value={selectedSubcategory} onChange={(e) => setSelectedSubcategory(e.target.value)}
                className={`w-full ${THEME.input} px-2.5 py-1.5 text-xs`}>
                {allMerged[selectedCategory as keyof typeof allMerged]?.subcategories.map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.name}</option>
                ))}
              </select>
            </div>
            {selectedCategory !== 'transfer' && (
              <div className="w-40">
                <label className={`block text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim} mb-1.5`}>Client</label>
                <select value={selectedClient} onChange={(e) => { setSelectedClient(e.target.value); setSelectedProject('') }}
                  className={`w-full ${THEME.input} px-2.5 py-1.5 text-xs`}>
                  <option value="">No client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            {selectedCategory !== 'transfer' && selectedClient && (
              <div className="w-44">
                <label className={`block text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim} mb-1.5`}>
                  Project <span className={`font-normal ${THEME.textDim}`}>(optional)</span>
                </label>
                <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
                  className={`w-full ${THEME.input} px-2.5 py-1.5 text-xs`}>
                  <option value="">All projects (client-level)</option>
                  {projects.filter(p => p.client_id === selectedClient).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {!selectedProject && <p className={`text-[10px] ${THEME.textDim} mt-1`}>Client P&L only — won't affect project GM</p>}
              </div>
            )}
            {isCC && (
              <div className="w-40">
                <label className={`block text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim} mb-1.5`}>Cardholder</label>
                <select value={selectedCardholder} onChange={(e) => setSelectedCardholder(e.target.value)}
                  className={`w-full ${THEME.input} px-2.5 py-1.5 text-xs`}>
                  <option value="">Unknown</option>
                  {CARDHOLDERS.map(ch => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setShowCategorize(false)}
                className="p-2 bg-white text-slate-400 border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-600 transition-colors">
                <X size={16} />
              </button>
              <button onClick={handleConfirm}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors shadow-sm">
                <Check size={14} /> Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
