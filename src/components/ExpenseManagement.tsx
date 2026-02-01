'use client'

// ============================================================
// EXPENSE MANAGEMENT - Leadership/Admin Component
// Glassmorphism Dark Theme — matches Time Tracking page
// ============================================================

import React, { useState, useEffect, useMemo } from 'react'
import {
  Receipt, Search, Filter, ChevronDown, Check, X, Clock,
  DollarSign, Plane, Hotel, Car, Coffee, MoreHorizontal,
  Paperclip, FileText, Image as ImageIcon, Download,
  ThumbsUp, ThumbsDown, Eye, Plus, CreditCard, Building2,
  Wallet, Landmark, AlertCircle, Loader2, Upload
} from 'lucide-react'

// ============ GLASSMORPHISM THEME ============
const THEME = {
  glass: 'bg-slate-900/70 backdrop-blur-xl',
  glassBorder: 'border-white/[0.08]',
  glassHover: 'hover:bg-white/[0.05] hover:border-white/[0.12]',
  textPrimary: 'text-white',
  textSecondary: 'text-slate-300',
  textMuted: 'text-slate-400',
  textDim: 'text-slate-500',
}

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
  travel: { label: 'Travel', icon: Plane, color: 'text-blue-400', bg: 'bg-blue-500/15' },
  lodging: { label: 'Lodging', icon: Hotel, color: 'text-indigo-400', bg: 'bg-indigo-500/15' },
  transportation: { label: 'Transport', icon: Car, color: 'text-cyan-400', bg: 'bg-cyan-500/15' },
  meal: { label: 'Meal', icon: Coffee, color: 'text-amber-400', bg: 'bg-amber-500/15' },
  other: { label: 'Other', icon: MoreHorizontal, color: 'text-slate-400', bg: 'bg-slate-500/15' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  draft: { label: 'Draft', color: 'text-slate-400', bg: 'bg-slate-500/20', dot: 'bg-slate-400' },
  submitted: { label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-500/20', dot: 'bg-amber-400' },
  pending: { label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-500/20', dot: 'bg-amber-400' },
  approved: { label: 'Approved', color: 'text-emerald-400', bg: 'bg-emerald-500/20', dot: 'bg-emerald-400' },
  rejected: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-500/20', dot: 'bg-red-400' },
  reimbursed: { label: 'Reimbursed', color: 'text-blue-400', bg: 'bg-blue-500/20', dot: 'bg-blue-400' },
}

const PAYMENT_METHODS: Record<string, { label: string; icon: any; color: string }> = {
  main_bank: { label: 'Main Bank', icon: Landmark, color: 'text-blue-400' },
  debit_card: { label: 'Debit Card', icon: CreditCard, color: 'text-purple-400' },
  corporate_card: { label: 'Corporate Card', icon: Building2, color: 'text-emerald-400' },
  personal_card: { label: 'Personal Card', icon: Wallet, color: 'text-orange-400' },
}

type StatusFilter = 'all' | 'submitted' | 'approved' | 'rejected' | 'reimbursed'
type SourceFilter = 'all' | 'employee' | 'admin'

// ============ COMPONENT ============
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
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Pending Review', amount: stats.pendingAmount, sub: `${stats.pendingCount} claims`, color: 'text-amber-400', icon: Clock },
          { label: 'Approved', amount: stats.approvedAmount, sub: null, color: 'text-emerald-400', icon: Check },
          { label: 'Needs Reimbursement', amount: stats.reimbursementAmount, sub: null, color: 'text-orange-400', icon: Wallet },
          { label: 'Total Claims', amount: claims.reduce((s, c) => s + c.amount, 0), sub: `${claims.length} claims`, color: 'text-blue-400', icon: Receipt },
        ].map((stat, i) => (
          <div key={i} className={`p-4 rounded-xl ${THEME.glass} border ${THEME.glassBorder}`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-medium ${THEME.textMuted} uppercase tracking-wide`}>{stat.label}</span>
              <stat.icon size={16} className={THEME.textDim} />
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>
              ${stat.amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
            {stat.sub && <p className={`text-xs mt-1 ${THEME.textDim}`}>{stat.sub}</p>}
          </div>
        ))}
      </div>

      {/* Filters Bar */}
      <div className={`p-4 rounded-xl border ${THEME.glass} ${THEME.glassBorder}`}>
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search size={18} className={`absolute left-3 top-1/2 -translate-y-1/2 ${THEME.textDim}`} />
            <input
              type="text"
              placeholder="Search by vendor, employee, project..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 bg-white/[0.05] border ${THEME.glassBorder} rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30`}
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={`px-4 py-2.5 bg-white/[0.05] border ${THEME.glassBorder} rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30`}
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
            className={`px-4 py-2.5 bg-white/[0.05] border ${THEME.glassBorder} rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30`}
          >
            <option value="all">All Sources</option>
            <option value="employee">Employee Claims</option>
            <option value="admin">Leadership / Internal</option>
          </select>

          {/* Add Expense */}
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={18} /> Add Expense
          </button>
        </div>
      </div>

      {/* Claims Table */}
      <div className={`rounded-xl border ${THEME.glass} ${THEME.glassBorder} overflow-hidden`}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
          </div>
        ) : filteredClaims.length === 0 ? (
          <div className="text-center py-16">
            <Receipt className={`h-12 w-12 ${THEME.textDim} mx-auto mb-3`} />
            <p className={THEME.textMuted}>No expense claims found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className={`text-left px-4 py-3 font-medium ${THEME.textMuted}`}>Status</th>
                  <th className={`text-left px-4 py-3 font-medium ${THEME.textMuted}`}>Date</th>
                  <th className={`text-left px-4 py-3 font-medium ${THEME.textMuted}`}>Employee</th>
                  <th className={`text-left px-4 py-3 font-medium ${THEME.textMuted}`}>Category</th>
                  <th className={`text-left px-4 py-3 font-medium ${THEME.textMuted}`}>Description</th>
                  <th className={`text-left px-4 py-3 font-medium ${THEME.textMuted}`}>Project</th>
                  <th className={`text-left px-4 py-3 font-medium ${THEME.textMuted}`}>Payment</th>
                  <th className={`text-left px-4 py-3 font-medium ${THEME.textMuted}`}>Billable</th>
                  <th className={`text-left px-4 py-3 font-medium ${THEME.textMuted}`}>Receipt</th>
                  <th className={`text-right px-4 py-3 font-medium ${THEME.textMuted}`}>Amount</th>
                  <th className={`text-center px-4 py-3 font-medium ${THEME.textMuted}`}>Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y divide-white/[0.05]`}>
                {filteredClaims.map(claim => {
                  const cat = EXPENSE_CATEGORIES[claim.category] || EXPENSE_CATEGORIES.other
                  const status = STATUS_CONFIG[claim.status] || STATUS_CONFIG.pending
                  const payment = PAYMENT_METHODS[claim.payment_method] || PAYMENT_METHODS.personal_card
                  const CatIcon = cat.icon
                  const PayIcon = payment.icon

                  return (
                    <tr key={claim.id} className="hover:bg-white/[0.03] transition-colors">
                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                      </td>

                      {/* Date */}
                      <td className={`px-4 py-3 ${THEME.textSecondary} whitespace-nowrap`}>
                        {new Date(claim.expense_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>

                      {/* Employee */}
                      <td className="px-4 py-3">
                        <div>
                          <p className={`font-medium ${THEME.textPrimary}`}>{claim.team_member_name}</p>
                          {claim.submitted_by_role === 'admin' && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-medium">ADMIN</span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <CatIcon size={14} className={cat.color} />
                          <span className={THEME.textSecondary}>{cat.label}</span>
                        </div>
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3">
                        <p className={`${THEME.textSecondary} truncate max-w-[200px]`}>{claim.vendor || claim.description || '—'}</p>
                      </td>

                      {/* Project */}
                      <td className={`px-4 py-3 ${THEME.textMuted} truncate max-w-[150px]`}>
                        {claim.project_name || '—'}
                      </td>

                      {/* Payment Method */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <PayIcon size={14} className={payment.color} />
                          <span className={`text-xs ${THEME.textMuted}`}>{payment.label}</span>
                        </div>
                      </td>

                      {/* Billable */}
                      <td className="px-4 py-3 text-center">
                        {claim.billable ? (
                          <Check size={16} className="text-emerald-400 mx-auto" />
                        ) : (
                          <X size={16} className="text-slate-600 mx-auto" />
                        )}
                      </td>

                      {/* Receipt */}
                      <td className="px-4 py-3 text-center">
                        {claim.receipt_url || claim.attachment_filename ? (
                          <button 
                            onClick={() => setSelectedClaim(claim)}
                            className="p-1.5 hover:bg-white/[0.08] rounded-lg transition-colors mx-auto"
                          >
                            {claim.attachment_type?.includes('pdf') ? (
                              <FileText size={16} className="text-red-400" />
                            ) : (
                              <ImageIcon size={16} className="text-blue-400" />
                            )}
                          </button>
                        ) : (
                          <span className={`text-xs ${THEME.textDim}`}>—</span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-emerald-400">${claim.amount.toFixed(2)}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        {claim.status === 'submitted' && (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => updateStatus(claim.id, 'approved')}
                              disabled={processing === claim.id}
                              className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors"
                              title="Approve"
                            >
                              {processing === claim.id ? <Loader2 size={16} className="animate-spin" /> : <ThumbsUp size={16} />}
                            </button>
                            <button
                              onClick={() => updateStatus(claim.id, 'rejected')}
                              disabled={processing === claim.id}
                              className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
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
                            className="text-xs px-2 py-1 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedClaim(null)}>
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-2xl max-w-lg w-full max-h-[80vh] overflow-auto shadow-2xl`} onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center justify-between p-4 border-b ${THEME.glassBorder}`}>
              <h3 className={`font-semibold ${THEME.textPrimary}`}>Receipt - {selectedClaim.vendor || 'Expense'}</h3>
              <button onClick={() => setSelectedClaim(null)} className="p-2 hover:bg-white/[0.08] rounded-lg">
                <X size={18} className={THEME.textMuted} />
              </button>
            </div>
            <div className="p-4">
              {selectedClaim.receipt_url && (
                selectedClaim.attachment_type?.includes('pdf') ? (
                  <div className="flex items-center gap-3 p-6 bg-white/[0.03] rounded-xl">
                    <FileText size={32} className="text-red-400" />
                    <div>
                      <p className={`font-medium ${THEME.textPrimary}`}>{selectedClaim.attachment_filename || 'Receipt.pdf'}</p>
                      <p className={`text-sm ${THEME.textMuted}`}>PDF Document</p>
                    </div>
                  </div>
                ) : (
                  <img src={selectedClaim.receipt_url} alt="Receipt" className="w-full rounded-xl" />
                )
              )}
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className={THEME.textMuted}>Amount</span><span className="font-semibold text-emerald-400">${selectedClaim.amount.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className={THEME.textMuted}>Date</span><span className={THEME.textSecondary}>{new Date(selectedClaim.expense_date).toLocaleDateString()}</span></div>
                <div className="flex justify-between"><span className={THEME.textMuted}>Employee</span><span className={THEME.textSecondary}>{selectedClaim.team_member_name}</span></div>
                <div className="flex justify-between"><span className={THEME.textMuted}>Category</span><span className={THEME.textSecondary}>{EXPENSE_CATEGORIES[selectedClaim.category]?.label || selectedClaim.category}</span></div>
                {selectedClaim.project_name && <div className="flex justify-between"><span className={THEME.textMuted}>Project</span><span className={THEME.textSecondary}>{selectedClaim.project_name}</span></div>}
                {selectedClaim.description && <div className="flex justify-between"><span className={THEME.textMuted}>Notes</span><span className={THEME.textSecondary}>{selectedClaim.description}</span></div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
