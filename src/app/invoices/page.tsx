'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  Search, Filter, Download, ChevronDown, ChevronLeft, ChevronRight,
  FileText, AlertTriangle, Clock, CheckCircle, DollarSign, X, Calendar
} from 'lucide-react'
import { supabase, getCurrentUser, fetchInvoices, fetchProjects, fetchClients } from '@/lib/supabase'

// Types
interface Invoice {
  id: string
  invoice_number: string
  invoice_date: string
  due_date: string
  client: string
  project?: string
  amount: number
  amount_paid: number
  balance_due: number
  days_overdue?: number
}

interface Project {
  id: string
  name: string
}

interface Client {
  id: string
  name: string
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  })
}

// Derive status from data
const getInvoiceStatus = (invoice: Invoice): { label: string; color: string; bg: string } => {
  if (invoice.balance_due <= 0) {
    return { label: 'Paid', color: 'text-emerald-500', bg: 'bg-emerald-500/20' }
  }
  if (invoice.amount_paid > 0) {
    return { label: 'Partial', color: 'text-blue-500', bg: 'bg-blue-500/20' }
  }
  if ((invoice.days_overdue || 0) > 0) {
    return { label: 'Overdue', color: 'text-rose-500', bg: 'bg-rose-500/20' }
  }
  return { label: 'Current', color: 'text-slate-400', bg: 'bg-slate-500/20' }
}

// Aging bucket helper
const getAgingBucket = (daysOverdue: number): string => {
  if (daysOverdue <= 0) return 'current'
  if (daysOverdue <= 30) return '1-30'
  if (daysOverdue <= 60) return '31-60'
  if (daysOverdue <= 90) return '61-90'
  return '90+'
}

const AGING_BUCKETS = [
  { id: 'current', label: 'Current', color: 'emerald' },
  { id: '1-30', label: '1-30 Days', color: 'amber' },
  { id: '31-60', label: '31-60 Days', color: 'orange' },
  { id: '61-90', label: '61-90 Days', color: 'rose' },
  { id: '90+', label: '90+ Days', color: 'red' },
]

export default function InvoicesPage() {
  // Data state
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [selectedBucket, setSelectedBucket] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(25)

  // Payment modal
  const [paymentModal, setPaymentModal] = useState<{ invoice: Invoice; amount: string } | null>(null)

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

        const [invRes, projRes, clientRes] = await Promise.all([
          fetchInvoices(profile.company_id),
          fetchProjects(profile.company_id),
          fetchClients(profile.company_id)
        ])

        setInvoices(invRes.data || [])
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

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesNumber = inv.invoice_number?.toLowerCase().includes(query)
        const matchesClient = inv.client?.toLowerCase().includes(query)
        const matchesAmount = inv.amount?.toString().includes(query)
        if (!matchesNumber && !matchesClient && !matchesAmount) return false
      }

      // Client filter
      if (selectedClient !== 'all' && inv.client !== selectedClient) return false

      // Project filter
      if (selectedProject !== 'all' && inv.project !== selectedProject) return false

      // Aging bucket filter
      if (selectedBucket !== 'all') {
        const bucket = getAgingBucket(inv.days_overdue || 0)
        // Special case: if filtering for non-current, exclude paid invoices
        if (selectedBucket !== 'current' && inv.balance_due <= 0) return false
        if (bucket !== selectedBucket) return false
      }

      return true
    }).sort((a, b) => {
      // Sort by days overdue (most overdue first), then by date
      const aOverdue = a.days_overdue || 0
      const bOverdue = b.days_overdue || 0
      if (bOverdue !== aOverdue) return bOverdue - aOverdue
      return (b.invoice_date || '').localeCompare(a.invoice_date || '')
    })
  }, [invoices, searchQuery, selectedClient, selectedProject, selectedBucket])

  // Aging summary (only unpaid invoices)
  const agingSummary = useMemo(() => {
    const unpaidInvoices = invoices.filter(inv => inv.balance_due > 0)
    
    const buckets: Record<string, number> = {
      current: 0,
      '1-30': 0,
      '31-60': 0,
      '61-90': 0,
      '90+': 0,
    }

    unpaidInvoices.forEach(inv => {
      const bucket = getAgingBucket(inv.days_overdue || 0)
      buckets[bucket] += inv.balance_due || 0
    })

    return buckets
  }, [invoices])

  // Summary calculations
  const summary = useMemo(() => {
    const totalAR = invoices.reduce((sum, inv) => sum + (inv.balance_due || 0), 0)
    const totalOverdue = invoices
      .filter(inv => (inv.days_overdue || 0) > 0 && inv.balance_due > 0)
      .reduce((sum, inv) => sum + (inv.balance_due || 0), 0)
    
    // Collected this month
    const currentMonth = new Date().toISOString().slice(0, 7)
    const collectedThisMonth = invoices
      .filter(inv => inv.amount_paid > 0)
      .reduce((sum, inv) => sum + (inv.amount_paid || 0), 0)

    const overdueCount = invoices.filter(inv => (inv.days_overdue || 0) > 0 && inv.balance_due > 0).length

    return { totalAR, totalOverdue, collectedThisMonth, overdueCount }
  }, [invoices])

  // Pagination
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredInvoices.slice(start, start + pageSize)
  }, [filteredInvoices, currentPage, pageSize])

  const totalPages = Math.ceil(filteredInvoices.length / pageSize)

  // Record payment
  const recordPayment = async () => {
    if (!paymentModal || !companyId) return
    
    const amount = parseFloat(paymentModal.amount)
    if (isNaN(amount) || amount <= 0) return

    try {
      const newAmountPaid = (paymentModal.invoice.amount_paid || 0) + amount
      const newBalanceDue = paymentModal.invoice.amount - newAmountPaid

      const { error } = await supabase
        .from('invoices')
        .update({
          amount_paid: newAmountPaid,
          balance_due: Math.max(0, newBalanceDue)
        })
        .eq('id', paymentModal.invoice.id)

      if (error) throw error

      setInvoices(prev => prev.map(inv => 
        inv.id === paymentModal.invoice.id 
          ? { ...inv, amount_paid: newAmountPaid, balance_due: Math.max(0, newBalanceDue) }
          : inv
      ))
      setPaymentModal(null)
    } catch (error) {
      console.error('Error recording payment:', error)
    }
  }

  // Mark as paid
  const markAsPaid = async (invoice: Invoice) => {
    if (!companyId) return

    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          amount_paid: invoice.amount,
          balance_due: 0
        })
        .eq('id', invoice.id)

      if (error) throw error

      setInvoices(prev => prev.map(inv => 
        inv.id === invoice.id 
          ? { ...inv, amount_paid: invoice.amount, balance_due: 0 }
          : inv
      ))
    } catch (error) {
      console.error('Error marking as paid:', error)
    }
  }

  // Export to Excel
  const exportToExcel = () => {
    const headers = ['Invoice #', 'Date', 'Due Date', 'Client', 'Project', 'Amount', 'Paid', 'Balance', 'Days Overdue', 'Status']
    const rows = filteredInvoices.map(inv => {
      const status = getInvoiceStatus(inv)
      return [
        inv.invoice_number,
        inv.invoice_date,
        inv.due_date,
        inv.client,
        inv.project || '',
        inv.amount,
        inv.amount_paid,
        inv.balance_due,
        inv.days_overdue || 0,
        status.label
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `invoices-ar-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  // Clear filters
  const clearFilters = () => {
    setSearchQuery('')
    setSelectedClient('all')
    setSelectedProject('all')
    setSelectedBucket('all')
  }

  const hasActiveFilters = searchQuery || selectedClient !== 'all' || selectedProject !== 'all' || selectedBucket !== 'all'

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
          <h1 className="text-2xl font-semibold text-slate-100">Invoices & AR</h1>
          <p className="text-sm mt-1 text-slate-400">Track receivables and aging</p>
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
              <p className="text-sm font-medium text-slate-400">Total AR</p>
              <p className="text-2xl font-semibold mt-1 text-blue-500">{formatCurrency(summary.totalAR)}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/20">
              <FileText size={22} className="text-blue-500" />
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl border bg-slate-800 border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Overdue</p>
              <p className="text-2xl font-semibold mt-1 text-rose-500">{formatCurrency(summary.totalOverdue)}</p>
              <p className="text-xs text-slate-500 mt-1">{summary.overdueCount} invoices</p>
            </div>
            <div className="p-3 rounded-lg bg-rose-500/20">
              <AlertTriangle size={22} className="text-rose-500" />
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl border bg-slate-800 border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Current</p>
              <p className="text-2xl font-semibold mt-1 text-emerald-500">{formatCurrency(agingSummary.current)}</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/20">
              <CheckCircle size={22} className="text-emerald-500" />
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl border bg-slate-800 border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Collected (MTD)</p>
              <p className="text-2xl font-semibold mt-1 text-emerald-500">{formatCurrency(summary.collectedThisMonth)}</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/20">
              <DollarSign size={22} className="text-emerald-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Aging Buckets */}
      <div className="p-4 rounded-xl border bg-slate-800 border-slate-700">
        <h3 className="text-sm font-medium text-slate-400 mb-3">Aging Summary</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {AGING_BUCKETS.map(bucket => {
            const amount = agingSummary[bucket.id] || 0
            const isSelected = selectedBucket === bucket.id
            const colorMap: Record<string, string> = {
              emerald: 'border-emerald-500 bg-emerald-500/10',
              amber: 'border-amber-500 bg-amber-500/10',
              orange: 'border-orange-500 bg-orange-500/10',
              rose: 'border-rose-500 bg-rose-500/10',
              red: 'border-red-500 bg-red-500/10',
            }
            const textMap: Record<string, string> = {
              emerald: 'text-emerald-500',
              amber: 'text-amber-500',
              orange: 'text-orange-500',
              rose: 'text-rose-500',
              red: 'text-red-500',
            }
            
            return (
              <button
                key={bucket.id}
                onClick={() => setSelectedBucket(isSelected ? 'all' : bucket.id)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  isSelected 
                    ? colorMap[bucket.color]
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <p className="text-xs font-medium text-slate-400">{bucket.label}</p>
                <p className={`text-lg font-semibold mt-1 ${textMap[bucket.color]}`}>
                  {formatCurrency(amount)}
                </p>
              </button>
            )
          })}
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
              placeholder="Search by invoice #, client, or amount..."
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-700">
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

            {/* Aging Bucket */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Aging</label>
              <select
                value={selectedBucket}
                onChange={(e) => setSelectedBucket(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="all">All</option>
                {AGING_BUCKETS.map(bucket => (
                  <option key={bucket.id} value={bucket.id}>{bucket.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Invoices Table */}
      <div className="rounded-xl border bg-slate-800 border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="px-4 py-3 text-left font-medium text-slate-400">Invoice #</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Date</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Due Date</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Client</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Project</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">Amount</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">Paid</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">Balance</th>
                <th className="px-4 py-3 text-center font-medium text-slate-400">Status</th>
                <th className="px-4 py-3 text-center font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedInvoices.length > 0 ? (
                paginatedInvoices.map((inv) => {
                  const status = getInvoiceStatus(inv)
                  return (
                    <tr key={inv.id} className="border-t border-slate-700 hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-slate-100 font-medium">{inv.invoice_number || '—'}</td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{formatDate(inv.invoice_date)}</td>
                      <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{formatDate(inv.due_date)}</td>
                      <td className="px-4 py-3 text-slate-100">{inv.client || '—'}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{inv.project || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-100 font-medium whitespace-nowrap">
                        {formatCurrency(inv.amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-500 whitespace-nowrap">
                        {formatCurrency(inv.amount_paid || 0)}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium whitespace-nowrap ${
                        inv.balance_due > 0 ? 'text-amber-500' : 'text-slate-400'
                      }`}>
                        {formatCurrency(inv.balance_due)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${status.bg} ${status.color}`}>
                          {status.label}
                          {(inv.days_overdue || 0) > 0 && inv.balance_due > 0 && (
                            <span className="ml-1">({inv.days_overdue}d)</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {inv.balance_due > 0 && (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setPaymentModal({ invoice: inv, amount: '' })}
                              className="px-2 py-1 text-xs rounded bg-blue-500/20 text-blue-500 hover:bg-blue-500/30"
                            >
                              + Payment
                            </button>
                            <button
                              onClick={() => markAsPaid(inv)}
                              className="px-2 py-1 text-xs rounded bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30"
                            >
                              Paid
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                    No invoices found
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
              Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredInvoices.length)} of {filteredInvoices.length}
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

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Record Payment</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-400">Invoice</p>
                <p className="text-slate-100 font-medium">{paymentModal.invoice.invoice_number}</p>
              </div>
              
              <div>
                <p className="text-sm text-slate-400">Balance Due</p>
                <p className="text-amber-500 font-medium">{formatCurrency(paymentModal.invoice.balance_due)}</p>
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Payment Amount</label>
                <input
                  type="number"
                  value={paymentModal.amount}
                  onChange={(e) => setPaymentModal(prev => prev ? { ...prev, amount: e.target.value } : null)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setPaymentModal(null)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={recordPayment}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
              >
                Record Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
