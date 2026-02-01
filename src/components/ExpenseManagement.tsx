'use client'

// ============================================================
// EXPENSE MANAGEMENT - Leadership/Admin Component
// Add as a tab inside Time Tracking page or as a standalone page
// Only visible to users with role === 'admin' in team_members
// ============================================================

import React, { useState, useEffect, useMemo } from 'react'
import {
  Receipt, Search, Filter, ChevronDown, Check, X, Clock,
  DollarSign, Plane, Hotel, Car, Coffee, MoreHorizontal,
  Paperclip, FileText, Image as ImageIcon, Download,
  ThumbsUp, ThumbsDown, Eye, Plus, CreditCard, Building2,
  Wallet, Landmark, AlertCircle, Loader2, Upload
} from 'lucide-react'

// ============ TYPES ============
interface ExpenseClaimRow {
  id: string
  expense_date: string
  vendor: string | null
  amount: number
  category: string
  description: string | null
  billable: boolean
  status: string
  payment_method: string
  receipt_url: string | null
  attachment_filename: string | null
  attachment_type: string | null
  submitted_by_role: string
  submitted_at: string | null
  team_member_name: string
  team_member_email: string
  project_name: string | null
  client_name: string | null
}

// ============ CONSTANTS ============
const EXPENSE_CATEGORIES: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  travel: { label: 'Travel', icon: Plane, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  lodging: { label: 'Lodging', icon: Hotel, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  transportation: { label: 'Transport', icon: Car, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  meal: { label: 'Meal', icon: Coffee, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  other: { label: 'Other', icon: MoreHorizontal, color: 'text-slate-400', bg: 'bg-slate-500/10' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  draft: { label: 'Draft', color: 'text-slate-500', bg: 'bg-slate-100', dot: 'bg-slate-400' },
  submitted: { label: 'Pending', color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-400' },
  pending: { label: 'Pending', color: 'text-amber-600', bg: 'bg-amber-50', dot: 'bg-amber-400' },
  approved: { label: 'Approved', color: 'text-emerald-600', bg: 'bg-emerald-50', dot: 'bg-emerald-400' },
  rejected: { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-50', dot: 'bg-red-400' },
  reimbursed: { label: 'Reimbursed', color: 'text-blue-600', bg: 'bg-blue-50', dot: 'bg-blue-400' },
}

const PAYMENT_METHODS: Record<string, { label: string; icon: any; color: string }> = {
  main_bank: { label: 'Main Bank', icon: Landmark, color: 'text-blue-500' },
  debit_card: { label: 'Debit Card', icon: CreditCard, color: 'text-purple-500' },
  corporate_card: { label: 'Corporate Card', icon: Building2, color: 'text-emerald-500' },
  personal_card: { label: 'Personal Card', icon: Wallet, color: 'text-orange-500' },
}

type StatusFilter = 'all' | 'submitted' | 'approved' | 'rejected' | 'reimbursed'
type SourceFilter = 'all' | 'employee' | 'admin'

// ============ COMPONENT ============
// Props: pass supabase client and company_id from parent
export default function ExpenseManagement({ 
  supabase, 
  companyId,
  currentUserId
}: { 
  supabase: any
  companyId: string 
  currentUserId: string
}) {
  const [claims, setClaims] = useState<ExpenseClaimRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClaim, setSelectedClaim] = useState<ExpenseClaimRow | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    loadClaims()
  }, [companyId])

  const loadClaims = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('expense_claims')
        .select(`
          id, expense_date, vendor, amount, category, description, billable,
          status, payment_method, receipt_url, attachment_filename, attachment_type,
          submitted_by_role, submitted_at, project_id, team_member_id,
          team_members(name, email),
          projects(name, clients(name))
        `)
        .eq('company_id', companyId)
        .order('expense_date', { ascending: false })

      if (data) {
        setClaims(data.map((d: any) => ({
          id: d.id,
          expense_date: d.expense_date,
          vendor: d.vendor,
          amount: d.amount,
          category: d.category,
          description: d.description,
          billable: d.billable || false,
          status: d.status,
          payment_method: d.payment_method || 'personal_card',
          receipt_url: d.receipt_url,
          attachment_filename: d.attachment_filename,
          attachment_type: d.attachment_type,
          submitted_by_role: d.submitted_by_role || 'employee',
          submitted_at: d.submitted_at,
          team_member_name: d.team_members?.name || 'Unknown',
          team_member_email: d.team_members?.email || '',
          project_name: d.projects?.name || null,
          client_name: d.projects?.clients?.name || null,
        })))
      }
    } catch (err) {
      console.error('Error loading claims:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredClaims = useMemo(() => {
    return claims.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (sourceFilter !== 'all' && c.submitted_by_role !== sourceFilter) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          c.vendor?.toLowerCase().includes(q) ||
          c.team_member_name.toLowerCase().includes(q) ||
          c.project_name?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [claims, statusFilter, sourceFilter, searchQuery])

  const stats = useMemo(() => {
    const pending = claims.filter(c => c.status === 'submitted')
    const approved = claims.filter(c => c.status === 'approved')
    const needsReimbursement = claims.filter(c => c.status === 'approved' && c.payment_method === 'personal_card')
    return {
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, c) => s + c.amount, 0),
      approvedAmount: approved.reduce((s, c) => s + c.amount, 0),
      reimbursementAmount: needsReimbursement.reduce((s, c) => s + c.amount, 0),
    }
  }, [claims])

  const updateStatus = async (claimId: string, newStatus: string) => {
    setProcessing(claimId)
    try {
      const updateData: any = { status: newStatus }
      if (newStatus === 'approved') {
        updateData.approved_by = currentUserId
        updateData.approved_at = new Date().toISOString()
      }
      
      const { error } = await supabase
        .from('expense_claims')
        .update(updateData)
        .eq('id', claimId)

      if (!error) {
        setClaims(prev => prev.map(c => c.id === claimId ? { ...c, status: newStatus } : c))
      }
    } catch (err) {
      console.error('Error updating status:', err)
    } finally {
      setProcessing(null)
    }
  }

  // ============ RENDER ============
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending Review', value: stats.pendingCount, amount: stats.pendingAmount, color: 'text-amber-500', bg: 'bg-amber-500/10', icon: Clock },
          { label: 'Approved', value: null, amount: stats.approvedAmount, color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: Check },
          { label: 'Needs Reimbursement', value: null, amount: stats.reimbursementAmount, color: 'text-orange-500', bg: 'bg-orange-500/10', icon: Wallet },
          { label: 'Total Claims', value: claims.length, amount: claims.reduce((s, c) => s + c.amount, 0), color: 'text-blue-500', bg: 'bg-blue-500/10', icon: Receipt },
        ].map((stat, i) => (
          <div key={i} className="bg-white/60 backdrop-blur-sm rounded-xl border border-slate-200/60 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon size={18} className={stat.color} />
              </div>
              <span className="text-sm text-slate-500">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">${stat.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            {stat.value !== null && <p className="text-sm text-slate-400">{stat.value} claims</p>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-slate-200/60 p-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by vendor, employee, project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            <option value="all">All Statuses</option>
            <option value="submitted">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="reimbursed">Reimbursed</option>
          </select>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
            <option value="all">All Sources</option>
            <option value="employee">Employee Claims</option>
            <option value="admin">Leadership / Internal</option>
          </select>

          {/* Add Internal Expense */}
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={18} /> Add Expense
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-slate-200/60 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
          </div>
        ) : filteredClaims.length === 0 ? (
          <div className="text-center py-16">
            <Receipt className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No expense claims found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80">
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Employee</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Description</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Project</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Payment</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Billable</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Receipt</th>
                  <th className="text-right px-4 py-3 font-medium text-slate-500">Amount</th>
                  <th className="text-center px-4 py-3 font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClaims.map(claim => {
                  const cat = EXPENSE_CATEGORIES[claim.category] || EXPENSE_CATEGORIES.other
                  const status = STATUS_CONFIG[claim.status] || STATUS_CONFIG.pending
                  const payment = PAYMENT_METHODS[claim.payment_method] || PAYMENT_METHODS.personal_card
                  const CatIcon = cat.icon
                  const PayIcon = payment.icon

                  return (
                    <tr key={claim.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {new Date(claim.expense_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>

                      {/* Employee */}
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{claim.team_member_name}</p>
                          {claim.submitted_by_role === 'admin' && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-medium">ADMIN</span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <CatIcon size={14} className={cat.color} />
                          <span className="text-slate-700">{cat.label}</span>
                        </div>
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3">
                        <p className="text-slate-700 truncate max-w-[200px]">{claim.vendor || claim.description || '—'}</p>
                      </td>

                      {/* Project */}
                      <td className="px-4 py-3 text-slate-600 truncate max-w-[150px]">
                        {claim.project_name || '—'}
                      </td>

                      {/* Payment Method */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <PayIcon size={14} className={payment.color} />
                          <span className="text-xs text-slate-600">{payment.label}</span>
                        </div>
                      </td>

                      {/* Billable */}
                      <td className="px-4 py-3 text-center">
                        {claim.billable ? (
                          <Check size={16} className="text-emerald-500 mx-auto" />
                        ) : (
                          <X size={16} className="text-slate-300 mx-auto" />
                        )}
                      </td>

                      {/* Receipt */}
                      <td className="px-4 py-3 text-center">
                        {claim.receipt_url || claim.attachment_filename ? (
                          <button 
                            onClick={() => setSelectedClaim(claim)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors mx-auto"
                          >
                            {claim.attachment_type?.includes('pdf') ? (
                              <FileText size={16} className="text-red-400" />
                            ) : (
                              <ImageIcon size={16} className="text-blue-400" />
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-slate-900">${claim.amount.toFixed(2)}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        {claim.status === 'submitted' && (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => updateStatus(claim.id, 'approved')}
                              disabled={processing === claim.id}
                              className="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Approve"
                            >
                              {processing === claim.id ? <Loader2 size={16} className="animate-spin" /> : <ThumbsUp size={16} />}
                            </button>
                            <button
                              onClick={() => updateStatus(claim.id, 'rejected')}
                              disabled={processing === claim.id}
                              className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                              title="Reject"
                            >
                              <ThumbsDown size={16} />
                            </button>
                          </div>
                        )}
                        {claim.status === 'approved' && claim.payment_method === 'personal_card' && (
                          <button
                            onClick={() => updateStatus(claim.id, 'reimbursed')}
                            disabled={processing === claim.id}
                            className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            Mark Paid
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receipt Preview Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedClaim(null)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Receipt - {selectedClaim.vendor || 'Expense'}</h3>
              <button onClick={() => setSelectedClaim(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <div className="p-4">
              {selectedClaim.receipt_url && (
                selectedClaim.attachment_type?.includes('pdf') ? (
                  <div className="flex items-center gap-3 p-6 bg-slate-50 rounded-xl">
                    <FileText size={32} className="text-red-400" />
                    <div>
                      <p className="font-medium text-slate-900">{selectedClaim.attachment_filename || 'Receipt.pdf'}</p>
                      <p className="text-sm text-slate-500">PDF Document</p>
                    </div>
                  </div>
                ) : (
                  <img src={selectedClaim.receipt_url} alt="Receipt" className="w-full rounded-xl" />
                )
              )}
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-semibold">${selectedClaim.amount.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Date</span><span>{new Date(selectedClaim.expense_date).toLocaleDateString()}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Employee</span><span>{selectedClaim.team_member_name}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Category</span><span>{EXPENSE_CATEGORIES[selectedClaim.category]?.label || selectedClaim.category}</span></div>
                {selectedClaim.project_name && <div className="flex justify-between"><span className="text-slate-500">Project</span><span>{selectedClaim.project_name}</span></div>}
                {selectedClaim.description && <div className="flex justify-between"><span className="text-slate-500">Notes</span><span>{selectedClaim.description}</span></div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
