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
}

export default function BankFeedSection({
  transactions, expenses, projects, clients, categories, onCategorizeTransaction, onSkipTransaction, onSyncQBO, isSyncing
}: BankFeedSectionProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'pending' | 'categorized' | 'skipped' | 'all'>('pending')
  const [filterDirection, setFilterDirection] = useState<'all' | 'inflow' | 'outflow'>('all')
  const [filterAccount, setFilterAccount] = useState<string>('all')
  const [sortField, setSortField] = useState('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Process ALL transactions (inflows + outflows)
  const processedTransactions = useMemo(() => {
    const linkedTransactionIds = new Set(expenses.filter(e => e.transaction_id).map(e => e.transaction_id))
    
    return transactions.map(t => ({
      ...t,
      displayAmount: Math.abs(t.amount),
      isInflow: t.amount >= 0,
      status: t.skipped ? 'skipped' 
        : (linkedTransactionIds.has(t.id) || t.category) ? 'categorized' 
        : 'pending',
      shortAccount: shortAccountName(t.account_name || ''),
    }))
  }, [transactions, expenses])

  // Unique accounts for filter
  const accounts = useMemo(() => {
    const accts = new Set(processedTransactions.map(t => t.account_name).filter(Boolean))
    return Array.from(accts)
  }, [processedTransactions])

  // Filter & sort
  const filteredTransactions = useMemo(() => {
    let result = [...processedTransactions]

    // Direction filter
    if (filterDirection === 'inflow') result = result.filter(t => t.isInflow)
    else if (filterDirection === 'outflow') result = result.filter(t => !t.isInflow)

    // Account filter
    if (filterAccount !== 'all') result = result.filter(t => t.account_name === filterAccount)

    // Status filter
    if (filterStatus !== 'all') result = result.filter(t => t.status === filterStatus)

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(t =>
        t.description?.toLowerCase().includes(q) ||
        t.payee?.toLowerCase().includes(q) ||
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
  }, [processedTransactions, filterDirection, filterAccount, filterStatus, searchQuery, sortField, sortDir])

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  // Metrics
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
      amber: active ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' : '',
      emerald: active ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25' : '',
      slate: active ? 'bg-slate-700/60 text-slate-200 border border-slate-600/50' : '',
      teal: active ? 'bg-teal-500/15 text-teal-400 border border-teal-500/25' : '',
    }
    return `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
      active ? colors[variant] : 'bg-slate-800/40 text-slate-500 border border-slate-800/60 hover:text-slate-300 hover:bg-slate-800/60'
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
              <p className="text-2xl font-semibold text-amber-400 mt-1 tabular-nums">{metrics.pending}</p>
              <p className={`text-xs ${THEME.textDim} mt-1 tabular-nums`}>{formatCurrency(metrics.pendingAmount)} uncategorized</p>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10">
              <AlertCircle size={20} className="text-amber-400" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        <div className={`${THEME.card} p-5`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${THEME.textMuted}`}>Categorized</p>
              <p className="text-2xl font-semibold text-emerald-400 mt-1 tabular-nums">{metrics.categorized}</p>
              <p className={`text-xs ${THEME.textDim} mt-1`}>Linked to expenses</p>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10">
              <CheckCircle2 size={20} className="text-emerald-400" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        <div className={`${THEME.card} p-5`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${THEME.textMuted}`}>Inflows</p>
              <p className="text-2xl font-semibold text-teal-400 mt-1 tabular-nums">{metrics.totalInflows}</p>
              <p className={`text-xs ${THEME.textDim} mt-1 tabular-nums`}>{formatCurrency(metrics.inflowAmount)} received</p>
            </div>
            <div className="p-2.5 rounded-lg bg-teal-500/10">
              <ArrowDownLeft size={20} className="text-teal-400" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        <div className={`${THEME.card} p-5`}>
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
      <div className={`${THEME.card} overflow-hidden`}>
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

        {/* Filters Row */}
        <div className={`flex flex-col gap-3 px-6 py-4 border-b ${THEME.glassBorder}`}>
          {/* Row 1: Status + Direction */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status filters */}
              <button onClick={() => setFilterStatus('pending')} className={pillClass(filterStatus === 'pending', 'amber')}>
                Pending ({metrics.pending})
              </button>
              <button onClick={() => setFilterStatus('categorized')} className={pillClass(filterStatus === 'categorized', 'emerald')}>
                Categorized ({metrics.categorized})
              </button>
              <button onClick={() => setFilterStatus('skipped')} className={pillClass(filterStatus === 'skipped', 'slate')}>
                Skipped ({metrics.skipped})
              </button>
              <button onClick={() => setFilterStatus('all')} className={pillClass(filterStatus === 'all', 'teal')}>
                All
              </button>

              {/* Divider */}
              <div className="w-px h-5 bg-slate-800/80 mx-1" />

              {/* Direction filters */}
              <button onClick={() => setFilterDirection('all')} className={pillClass(filterDirection === 'all', 'teal')}>
                All
              </button>
              <button onClick={() => setFilterDirection('inflow')} className={pillClass(filterDirection === 'inflow', 'emerald')}>
                <span className="flex items-center gap-1"><ArrowDownLeft size={11} /> Inflows ({metrics.totalInflows})</span>
              </button>
              <button onClick={() => setFilterDirection('outflow')} className={pillClass(filterDirection === 'outflow', 'amber')}>
                <span className="flex items-center gap-1"><ArrowUpRight size={11} /> Outflows ({metrics.totalOutflows})</span>
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${THEME.input} pl-9 pr-4 py-2 w-64`}
              />
            </div>
          </div>

          {/* Row 2: Account filter */}
          {accounts.length > 1 && (
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim}`}>Account:</span>
              <button onClick={() => setFilterAccount('all')} className={pillClass(filterAccount === 'all', 'teal')}>
                All Accounts
              </button>
              {accounts.map(acct => (
                <button key={acct} onClick={() => setFilterAccount(acct)} className={pillClass(filterAccount === acct, 'teal')}>
                  {shortAccountName(acct)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Table Header */}
        <div className={`grid grid-cols-[80px_1fr_100px_100px_100px_90px_180px] gap-2 items-center px-4 py-2.5 border-b ${THEME.glassBorder} bg-slate-800/20`}>
          <button onClick={() => handleSort('date')} className={`text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim} text-left flex items-center gap-1 hover:text-slate-300`}>
            Date {sortField === 'date' && (sortDir === 'desc' ? <ChevronDown size={10} /> : <ChevronUp size={10} />)}
          </button>
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim}`}>Description</span>
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim}`}>Account</span>
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim}`}>Category</span>
          <button onClick={() => handleSort('amount')} className={`text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim} text-right flex items-center justify-end gap-1 hover:text-slate-300`}>
            Amount {sortField === 'amount' && (sortDir === 'desc' ? <ChevronDown size={10} /> : <ChevronUp size={10} />)}
          </button>
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim} text-center`}>Status</span>
          <span className={`text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim} text-center`}>Actions</span>
        </div>

        {/* Transaction Rows */}
        <div className="max-h-[600px] overflow-y-auto">
          {filteredTransactions.length > 0 ? (
            filteredTransactions.map(t => (
              <TransactionRow
                key={t.id}
                transaction={t}
                projects={projects}
                clients={clients}
                categories={categories}
                onCategorize={onCategorizeTransaction}
                onSkip={onSkipTransaction}
              />
            ))
          ) : (
            <div className="py-16 text-center">
              <Landmark size={32} className={`${THEME.textDim} mx-auto mb-3`} strokeWidth={1} />
              <p className={`font-medium ${THEME.textSecondary}`}>
                {filterStatus === 'pending' ? 'All caught up!' : 'No transactions found'}
              </p>
              <p className={`text-sm ${THEME.textDim} mt-1`}>
                {filterStatus === 'pending' ? 'No pending transactions to review' : 'Try adjusting your filters'}
              </p>
            </div>
          )}
        </div>

        {/* Footer count */}
        {filteredTransactions.length > 0 && (
          <div className={`px-6 py-3 border-t ${THEME.glassBorder} bg-slate-800/20`}>
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
  transaction: any
  projects: any[]
  clients: any[]
  categories: typeof EXPENSE_CATEGORIES
  onCategorize: (transactionId: string, data: any) => void
  onSkip: (transactionId: string) => void
}) {
  const [showCategorize, setShowCategorize] = useState(false)
  const isInflow = transaction.isInflow
  const isCC = transaction.account_name?.toLowerCase().includes('credit')

  // Default category based on direction
  const defaultCat = isInflow ? 'clientPayments' : 'overhead'
  const defaultSub = isInflow ? 'invoicePayment' : (categories.overhead?.subcategories?.[0]?.id || 'software')

  const [selectedCategory, setSelectedCategory] = useState(defaultCat)
  const [selectedSubcategory, setSelectedSubcategory] = useState(defaultSub)
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedCardholder, setSelectedCardholder] = useState('')

  // Use custom categories for outflows, income categories for inflows
  const activeCats = isInflow
    ? { ...INCOME_CATEGORIES, ...TRANSFER_CATEGORY }
    : { ...categories, ...TRANSFER_CATEGORY }

  // Merged for lookups (need all for getCategoryConfig calls)
  const allMerged = { ...categories, ...INCOME_CATEGORIES, ...TRANSFER_CATEGORY }

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat)
    const catConfig = allMerged[cat as keyof typeof allMerged]
    if (catConfig?.subcategories?.length) {
      setSelectedSubcategory(catConfig.subcategories[0].id)
    }
  }

  const handleConfirm = () => {
    onCategorize(transaction.id, {
      category: selectedCategory,
      subcategory: selectedSubcategory,
      project_id: selectedProject || null,
      client_id: selectedClient || null,
      cardholder: selectedCardholder || null,
      description: transaction.description,
      amount: isInflow ? transaction.displayAmount : transaction.displayAmount,
      date: transaction.date,
      vendor: transaction.payee || transaction.description,
      type: isInflow ? 'income' : 'expense',
      transaction_id: transaction.id,
      account_name: transaction.account_name,
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
    <div className={`border-b border-slate-800/40 ${showCategorize ? 'bg-slate-800/20' : ''}`}>
      {/* Main Row */}
      <div className="grid grid-cols-[80px_1fr_100px_100px_100px_90px_180px] gap-2 items-center py-3 px-4 hover:bg-slate-800/20 transition-colors">
        <p className={`text-sm ${THEME.textMuted} tabular-nums`}>{formatDateShort(transaction.date)}</p>
        
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {/* Direction indicator */}
            <span className={`shrink-0 w-5 h-5 rounded flex items-center justify-center ${
              isInflow ? 'bg-emerald-500/10' : 'bg-rose-500/10'
            }`}>
              {isInflow 
                ? <ArrowDownLeft size={11} className="text-emerald-400" /> 
                : <ArrowUpRight size={11} className="text-rose-400" />}
            </span>
            <p className={`text-sm ${THEME.textPrimary} truncate`}>{transaction.description}</p>
          </div>
          {transaction.payee && transaction.payee !== transaction.description && (
            <p className={`text-xs ${THEME.textDim} truncate ml-7`}>{transaction.payee}</p>
          )}
        </div>

        <span className={`text-xs ${THEME.textDim} truncate`}>{transaction.shortAccount}</span>

        <span className={`text-xs ${THEME.textDim}`}>
          {transaction.category ? (
            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${getCategoryConfig(transaction.category).bgClass} ${getCategoryConfig(transaction.category).textClass}`}>
              {getCategoryConfig(transaction.category).label}
            </span>
          ) : '—'}
        </span>

        <div className="text-right">
          <p className={`text-sm font-semibold tabular-nums ${isInflow ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isInflow ? '+' : '-'}{formatCurrency(transaction.displayAmount)}
          </p>
        </div>

        <div className="text-center">
          <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${status.bg} ${status.text} border ${status.border}`}>
            {status.label}
          </span>
        </div>

        <div className="flex items-center justify-center gap-2">
          {transaction.status === 'pending' && (
            <>
              <button
                onClick={() => setShowCategorize(!showCategorize)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/10 text-teal-400 border border-teal-500/30 rounded-lg text-xs font-medium hover:bg-teal-500/20 transition-colors"
              >
                <ArrowRight size={12} /> Categorize
              </button>
              <button
                onClick={() => onSkip(transaction.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 text-slate-400 border border-slate-800/80 rounded-lg text-xs font-medium hover:bg-slate-800/70 hover:text-white transition-colors"
              >
                <SkipForward size={12} /> Skip
              </button>
            </>
          )}
          {transaction.status === 'skipped' && (
            <button
              onClick={() => setShowCategorize(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/50 text-slate-400 border border-slate-800/80 rounded-lg text-xs font-medium hover:bg-slate-800/70 hover:text-white transition-colors"
            >
              Recategorize
            </button>
          )}
        </div>
      </div>

      {/* Categorize Panel */}
      {showCategorize && (
        <div className={`px-4 pb-4 pt-3 bg-slate-800/20 border-t border-slate-800/40`}>
          <div className="flex flex-wrap items-end gap-3">
            {/* Category */}
            <div className="flex-1 min-w-[200px]">
              <label className={`block text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim} mb-1.5`}>Category</label>
              <div className="flex flex-wrap gap-1">
                {Object.values(activeCats).map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryChange(cat.id)}
                    className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                      selectedCategory === cat.id
                        ? `${cat.bgClass} ${cat.textClass} border ${cat.borderClass}`
                        : 'bg-slate-800/40 text-slate-500 border border-slate-800/60 hover:text-slate-300'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Subcategory */}
            <div className="w-44">
              <label className={`block text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim} mb-1.5`}>Type</label>
              <select
                value={selectedSubcategory}
                onChange={(e) => setSelectedSubcategory(e.target.value)}
                className={`w-full ${THEME.input} px-2.5 py-1.5 text-xs`}
              >
                {allMerged[selectedCategory as keyof typeof allMerged]?.subcategories.map(sub => (
                  <option key={sub.id} value={sub.id} className="bg-slate-900">{sub.name}</option>
                ))}
              </select>
            </div>

            {/* Client (always available except transfers) */}
            {selectedCategory !== 'transfer' && (
              <div className="w-40">
                <label className={`block text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim} mb-1.5`}>Client</label>
                <select
                  value={selectedClient}
                  onChange={(e) => { setSelectedClient(e.target.value); setSelectedProject('') }}
                  className={`w-full ${THEME.input} px-2.5 py-1.5 text-xs`}
                >
                  <option value="" className="bg-slate-900">No client</option>
                  {clients.map(c => <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>)}
                </select>
              </div>
            )}

            {/* Project (filtered by selected client, optional — client-only = client P&L) */}
            {selectedCategory !== 'transfer' && selectedClient && (
              <div className="w-44">
                <label className={`block text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim} mb-1.5`}>
                  Project <span className={`font-normal ${THEME.textDim}`}>(optional)</span>
                </label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className={`w-full ${THEME.input} px-2.5 py-1.5 text-xs`}
                >
                  <option value="" className="bg-slate-900">All projects (client-level)</option>
                  {projects.filter(p => p.client_id === selectedClient).map(p => (
                    <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>
                  ))}
                </select>
                {!selectedProject && (
                  <p className={`text-[10px] ${THEME.textDim} mt-1`}>Client P&L only — won't affect project GM</p>
                )}
              </div>
            )}

            {/* Cardholder (for CC accounts) */}
            {isCC && (
              <div className="w-40">
                <label className={`block text-[11px] font-semibold uppercase tracking-wider ${THEME.textDim} mb-1.5`}>Cardholder</label>
                <select
                  value={selectedCardholder}
                  onChange={(e) => setSelectedCardholder(e.target.value)}
                  className={`w-full ${THEME.input} px-2.5 py-1.5 text-xs`}
                >
                  <option value="" className="bg-slate-900">Unknown</option>
                  {CARDHOLDERS.map(ch => <option key={ch.id} value={ch.id} className="bg-slate-900">{ch.name}</option>)}
                </select>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setShowCategorize(false)}
                className="p-2 bg-slate-800/50 text-slate-400 border border-slate-800/80 rounded-lg hover:bg-slate-800/70 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
              <button
                onClick={handleConfirm}
                className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-500 transition-colors"
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
