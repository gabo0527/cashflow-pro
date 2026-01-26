'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  Search, Filter, Download, ChevronDown, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, DollarSign, Calendar, X, Check, Edit2
} from 'lucide-react'
import { supabase, getCurrentUser, fetchTransactions, fetchProjects, fetchClients } from '@/lib/supabase'

// Types
interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  category: string
  sub_category?: string
  project?: string
  client?: string
}

interface Project {
  id: string
  name: string
  client_id?: string
}

interface Client {
  id: string
  name: string
}

// Category configuration
const CATEGORIES = [
  { id: 'revenue', label: 'Revenue', color: 'emerald' },
  { id: 'opex', label: 'OpEx / Direct Cost', color: 'rose' },
  { id: 'overhead', label: 'Overhead', color: 'amber' },
  { id: 'investment', label: 'Investment / CapEx', color: 'blue' },
]

const SUB_CATEGORIES: Record<string, string[]> = {
  revenue: ['Retainer', 'Project Fee', 'Reimbursement', 'Consulting', 'Other Revenue'],
  opex: ['Labor', 'Software', 'Materials', 'Contractors', 'Travel', 'Other Direct'],
  overhead: ['Rent', 'Insurance', 'Utilities', 'Office Supplies', 'Subscriptions', 'Other Overhead'],
  investment: ['Equipment', 'Software License', 'Training', 'Other CapEx'],
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

const formatMonth = (dateStr: string): string => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

const getCategoryColor = (category: string, type: 'bg' | 'text' = 'text'): string => {
  const colors: Record<string, Record<string, string>> = {
    revenue: { bg: 'bg-emerald-500/20', text: 'text-emerald-500' },
    opex: { bg: 'bg-rose-500/20', text: 'text-rose-500' },
    overhead: { bg: 'bg-amber-500/20', text: 'text-amber-500' },
    investment: { bg: 'bg-blue-500/20', text: 'text-blue-500' },
  }
  return colors[category]?.[type] || (type === 'bg' ? 'bg-slate-500/20' : 'text-slate-500')
}

export default function CashFlowPage() {
  // Data state
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(25)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<Transaction>>({})

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const { user } = await getCurrentUser()
        if (!user) return

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single()

        if (!profile?.company_id) {
          setLoading(false)
          return
        }

        setCompanyId(profile.company_id)

        const [txRes, projRes, clientRes] = await Promise.all([
          fetchTransactions(profile.company_id),
          fetchProjects(profile.company_id),
          fetchClients(profile.company_id)
        ])

        setTransactions(txRes.data || [])
        setProjects(projRes.data || [])
        setClients(clientRes.data || [])
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesDescription = tx.description?.toLowerCase().includes(query)
        const matchesAmount = tx.amount?.toString().includes(query)
        if (!matchesDescription && !matchesAmount) return false
      }

      // Date filter
      if (dateRange.start && tx.date < dateRange.start) return false
      if (dateRange.end && tx.date > dateRange.end) return false

      // Category filter
      if (selectedCategory !== 'all' && tx.category !== selectedCategory) return false

      // Project filter
      if (selectedProject !== 'all' && tx.project !== selectedProject) return false

      // Client filter
      if (selectedClient !== 'all' && tx.client !== selectedClient) return false

      return true
    }).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  }, [transactions, searchQuery, dateRange, selectedCategory, selectedProject, selectedClient])

  // Summary calculations
  const summary = useMemo(() => {
    const totalIn = filteredTransactions
      .filter(tx => tx.category === 'revenue')
      .reduce((sum, tx) => sum + (tx.amount || 0), 0)
    
    const totalOut = filteredTransactions
      .filter(tx => ['opex', 'overhead', 'investment'].includes(tx.category || ''))
      .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0)

    const opex = filteredTransactions
      .filter(tx => tx.category === 'opex')
      .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0)

    const overhead = filteredTransactions
      .filter(tx => tx.category === 'overhead')
      .reduce((sum, tx) => sum + Math.abs(tx.amount || 0), 0)

    return {
      totalIn,
      totalOut,
      net: totalIn - totalOut,
      opex,
      overhead,
      count: filteredTransactions.length
    }
  }, [filteredTransactions])

  // Pagination
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredTransactions.slice(start, start + pageSize)
  }, [filteredTransactions, currentPage, pageSize])

  const totalPages = Math.ceil(filteredTransactions.length / pageSize)

  // Edit handlers
  const startEdit = (tx: Transaction) => {
    setEditingId(tx.id)
    setEditValues({
      category: tx.category,
      sub_category: tx.sub_category,
      project: tx.project,
      client: tx.client
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValues({})
  }

  const saveEdit = async (id: string) => {
    if (!companyId) return
    
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          category: editValues.category,
          sub_category: editValues.sub_category,
          project: editValues.project,
          client: editValues.client
        })
        .eq('id', id)

      if (error) throw error

      setTransactions(prev => prev.map(tx => 
        tx.id === id ? { ...tx, ...editValues } : tx
      ))
      setEditingId(null)
      setEditValues({})
    } catch (error) {
      console.error('Error updating transaction:', error)
    }
  }

  // Export to Excel
  const exportToExcel = () => {
    const headers = ['Date', 'Month', 'Description', 'Amount', 'Category', 'Sub-Category', 'Project', 'Client']
    const rows = filteredTransactions.map(tx => [
      tx.date,
      formatMonth(tx.date),
      tx.description,
      tx.amount,
      tx.category,
      tx.sub_category || '',
      tx.project || '',
      tx.client || ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `cash-flow-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  // Clear filters
  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCategory('all')
    setSelectedProject('all')
    setSelectedClient('all')
    setDateRange({
      start: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    })
  }

  const hasActiveFilters = searchQuery || selectedCategory !== 'all' || selectedProject !== 'all' || selectedClient !== 'all'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Cash Flow</h1>
          <p className="text-sm mt-1 text-slate-400">Track and categorize transactions</p>
        </div>
        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
        >
          <Download size={18} />
          Export Excel
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl border bg-slate-800 border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Cash In</p>
              <p className="text-2xl font-semibold mt-1 text-emerald-500">{formatCurrency(summary.totalIn)}</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/20">
              <TrendingUp size={22} className="text-emerald-500" />
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl border bg-slate-800 border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Cash Out</p>
              <p className="text-2xl font-semibold mt-1 text-rose-500">{formatCurrency(summary.totalOut)}</p>
            </div>
            <div className="p-3 rounded-lg bg-rose-500/20">
              <TrendingDown size={22} className="text-rose-500" />
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl border bg-slate-800 border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Net Cash Flow</p>
              <p className={`text-2xl font-semibold mt-1 ${summary.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {formatCurrency(summary.net)}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${summary.net >= 0 ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
              <DollarSign size={22} className={summary.net >= 0 ? 'text-emerald-500' : 'text-rose-500'} />
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl border bg-slate-800 border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Transactions</p>
              <p className="text-2xl font-semibold mt-1 text-blue-500">{summary.count.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/20">
              <Calendar size={22} className="text-blue-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="p-4 rounded-xl border bg-slate-800 border-slate-700 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by description or amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-blue-500 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
            }`}
          >
            <Filter size={18} />
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-white" />
            )}
          </button>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-100 transition-colors"
            >
              <X size={18} />
              Clear
            </button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-700">
            {/* Date Range */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Start Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">End Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>

            {/* Project */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Project</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="all">All Projects</option>
                {projects.map(proj => (
                  <option key={proj.id} value={proj.name}>{proj.name}</option>
                ))}
              </select>
            </div>

            {/* Client */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Client</label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="all">All Clients</option>
                {clients.map(client => (
                  <option key={client.id} value={client.name}>{client.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Transactions Table */}
      <div className="rounded-xl border bg-slate-800 border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="px-4 py-3 text-left font-medium text-slate-400">Date</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Month</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400 min-w-[200px]">Description</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Category</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Sub-Category</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Project</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Client</th>
                <th className="px-4 py-3 text-center font-medium text-slate-400 w-20">Edit</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTransactions.length > 0 ? (
                paginatedTransactions.map((tx) => (
                  <tr key={tx.id} className="border-t border-slate-700 hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{tx.date}</td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{formatMonth(tx.date)}</td>
                    <td className="px-4 py-3 text-slate-100 max-w-xs truncate" title={tx.description}>
                      {tx.description || '—'}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${
                      tx.amount >= 0 ? 'text-emerald-500' : 'text-rose-500'
                    }`}>
                      {formatCurrency(tx.amount)}
                    </td>
                    
                    {/* Editable cells */}
                    {editingId === tx.id ? (
                      <>
                        <td className="px-4 py-3">
                          <select
                            value={editValues.category || ''}
                            onChange={(e) => setEditValues(prev => ({ 
                              ...prev, 
                              category: e.target.value,
                              sub_category: '' // Reset sub-category when category changes
                            }))}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                          >
                            <option value="">Select...</option>
                            {CATEGORIES.map(cat => (
                              <option key={cat.id} value={cat.id}>{cat.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={editValues.sub_category || ''}
                            onChange={(e) => setEditValues(prev => ({ ...prev, sub_category: e.target.value }))}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                            disabled={!editValues.category}
                          >
                            <option value="">Select...</option>
                            {editValues.category && SUB_CATEGORIES[editValues.category]?.map(sub => (
                              <option key={sub} value={sub}>{sub}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={editValues.project || ''}
                            onChange={(e) => setEditValues(prev => ({ ...prev, project: e.target.value }))}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                          >
                            <option value="">Select...</option>
                            {projects.map(proj => (
                              <option key={proj.id} value={proj.name}>{proj.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={editValues.client || ''}
                            onChange={(e) => setEditValues(prev => ({ ...prev, client: e.target.value }))}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-xs"
                          >
                            <option value="">Select...</option>
                            {clients.map(client => (
                              <option key={client.id} value={client.name}>{client.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => saveEdit(tx.id)}
                              className="p-1.5 rounded bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-1.5 rounded bg-slate-600 text-slate-300 hover:bg-slate-500"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3">
                          {tx.category && (
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${getCategoryColor(tx.category, 'bg')} ${getCategoryColor(tx.category, 'text')}`}>
                              {CATEGORIES.find(c => c.id === tx.category)?.label || tx.category}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{tx.sub_category || '—'}</td>
                        <td className="px-4 py-3 text-slate-300 text-xs">{tx.project || '—'}</td>
                        <td className="px-4 py-3 text-slate-300 text-xs">{tx.client || '—'}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => startEdit(tx)}
                            className="p-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600 mx-auto block"
                          >
                            <Edit2 size={14} />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                    No transactions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
            <p className="text-sm text-slate-400">
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredTransactions.length)} of {filteredTransactions.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm text-slate-300">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
