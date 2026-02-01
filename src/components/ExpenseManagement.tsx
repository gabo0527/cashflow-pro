'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Receipt, Search, ChevronDown, ChevronRight, Check, X, Clock,
  DollarSign, Plane, Hotel, Car, Coffee, MoreHorizontal,
  FileText, Image as ImageIcon,
  ThumbsUp, ThumbsDown, Plus, CreditCard, Building2,
  Wallet, Landmark, Loader2, User, FolderKanban, Edit2, Save,
  Trash2
} from 'lucide-react'

const THEME = {
  glass: 'bg-slate-900/70 backdrop-blur-xl',
  glassBorder: 'border-white/[0.08]',
  textPrimary: 'text-white',
  textSecondary: 'text-slate-300',
  textMuted: 'text-slate-400',
  textDim: 'text-slate-500',
}

interface ExpenseClaimRow {
  id: string; expense_date: string; vendor: string | null; amount: number; category: string
  description: string | null; billable: boolean; status: string; payment_method: string
  receipt_url: string | null; attachment_filename: string | null; attachment_type: string | null
  submitted_by_role: string; submitted_at: string | null; team_member_id: string
  team_member_name: string; team_member_email: string; project_id: string | null
  project_name: string | null; client_id: string | null; client_name: string | null
}

const EXPENSE_CATEGORIES: Record<string, { label: string; icon: any; color: string }> = {
  travel: { label: 'Travel', icon: Plane, color: 'text-blue-400' },
  lodging: { label: 'Lodging', icon: Hotel, color: 'text-indigo-400' },
  transportation: { label: 'Transport', icon: Car, color: 'text-cyan-400' },
  meal: { label: 'Meal', icon: Coffee, color: 'text-amber-400' },
  other: { label: 'Other', icon: MoreHorizontal, color: 'text-slate-400' },
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
  corporate_card: { label: 'Corp Card', icon: Building2, color: 'text-emerald-400' },
  personal_card: { label: 'Personal', icon: Wallet, color: 'text-orange-400' },
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

const formatCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
const formatDate = (d: string) => { if (!d) return '—'; const [y, m, day] = d.split('-').map(Number); return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }

type StatusFilter = 'all' | 'submitted' | 'approved' | 'rejected' | 'reimbursed'

export default function ExpenseManagement({ supabase, companyId, currentUserId }: { supabase: any; companyId: string; currentUserId: string }) {
  const [claims, setClaims] = useState<ExpenseClaimRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<ExpenseClaimRow>>({})
  const [selectedClaim, setSelectedClaim] = useState<ExpenseClaimRow | null>(null)
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [projects, setProjects] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])

  useEffect(() => { loadClaims() }, [companyId])

  const loadClaims = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.from('expense_claims')
        .select('id, expense_date, vendor, amount, category, description, billable, status, payment_method, receipt_url, attachment_filename, attachment_type, submitted_by_role, submitted_at, project_id, team_member_id')
        .eq('company_id', companyId).order('expense_date', { ascending: false })
      if (error) { console.error('Query error:', error); setLoading(false); return }

      const { data: teamData } = await supabase.from('team_members').select('id, name, email').eq('company_id', companyId)
      const { data: projectData } = await supabase.from('projects').select('id, name, client_id').eq('company_id', companyId)
      const { data: clientData } = await supabase.from('clients').select('id, name').eq('company_id', companyId)

      setProjects(projectData || [])
      setClients(clientData || [])

      const teamMap: Record<string, any> = {}; (teamData || []).forEach((t: any) => { teamMap[t.id] = t })
      const projectMap: Record<string, any> = {}; (projectData || []).forEach((p: any) => { projectMap[p.id] = p })
      const clientMap: Record<string, any> = {}; (clientData || []).forEach((c: any) => { clientMap[c.id] = c })

      if (data) {
        const mapped = data.map((d: any) => {
          const project = d.project_id ? projectMap[d.project_id] : null
          const clientId = project?.client_id || null
          return {
            id: d.id, expense_date: d.expense_date, vendor: d.vendor, amount: d.amount,
            category: d.category, description: d.description, billable: d.billable || false,
            status: d.status, payment_method: d.payment_method || 'personal_card',
            receipt_url: d.receipt_url, attachment_filename: d.attachment_filename,
            attachment_type: d.attachment_type, submitted_by_role: d.submitted_by_role || 'employee',
            submitted_at: d.submitted_at, team_member_id: d.team_member_id,
            team_member_name: teamMap[d.team_member_id]?.name || 'Unknown',
            team_member_email: teamMap[d.team_member_id]?.email || '',
            project_id: d.project_id, project_name: project?.name || null,
            client_id: clientId, client_name: clientId ? clientMap[clientId]?.name || null : null,
          }
        })
        setClaims(mapped)
        const firstClient = mapped.find((c: any) => c.client_id)?.client_id
        if (firstClient) setExpandedClients(new Set([firstClient]))
      }
    } catch (err) { console.error('Error:', err) }
    finally { setLoading(false) }
  }

  const filteredClaims = useMemo(() => claims.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return c.vendor?.toLowerCase().includes(q) || c.team_member_name.toLowerCase().includes(q) || c.project_name?.toLowerCase().includes(q) || c.client_name?.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
    }
    return true
  }), [claims, statusFilter, searchQuery])

  const stats = useMemo(() => {
    const pending = claims.filter(c => c.status === 'submitted')
    const approved = claims.filter(c => c.status === 'approved')
    const needsReimb = claims.filter(c => c.status === 'approved' && c.payment_method === 'personal_card')
    return { pendingCount: pending.length, pendingAmount: pending.reduce((s, c) => s + c.amount, 0), approvedAmount: approved.reduce((s, c) => s + c.amount, 0), reimbursementAmount: needsReimb.reduce((s, c) => s + c.amount, 0) }
  }, [claims])

  const groupedData = useMemo(() => {
    const groups: Record<string, { id: string; name: string; totalAmount: number; count: number; projects: Record<string, { id: string; name: string; totalAmount: number; count: number; employees: Record<string, { id: string; name: string; totalAmount: number; claims: ExpenseClaimRow[] }> }> }> = {}
    filteredClaims.forEach(claim => {
      const cId = claim.client_id || 'unassigned', cName = claim.client_name || 'Unassigned'
      const pId = claim.project_id || 'unassigned', pName = claim.project_name || 'Unassigned'
      const eId = claim.team_member_id
      if (!groups[cId]) groups[cId] = { id: cId, name: cName, totalAmount: 0, count: 0, projects: {} }
      if (!groups[cId].projects[pId]) groups[cId].projects[pId] = { id: pId, name: pName, totalAmount: 0, count: 0, employees: {} }
      if (!groups[cId].projects[pId].employees[eId]) groups[cId].projects[pId].employees[eId] = { id: eId, name: claim.team_member_name, totalAmount: 0, claims: [] }
      groups[cId].totalAmount += claim.amount; groups[cId].count++
      groups[cId].projects[pId].totalAmount += claim.amount; groups[cId].projects[pId].count++
      groups[cId].projects[pId].employees[eId].totalAmount += claim.amount
      groups[cId].projects[pId].employees[eId].claims.push(claim)
    })
    return Object.values(groups).sort((a, b) => b.totalAmount - a.totalAmount)
  }, [filteredClaims])

  const updateStatus = async (claimId: string, newStatus: string) => {
    setProcessing(claimId)
    try {
      const upd: any = { status: newStatus }
      if (newStatus === 'approved') { upd.approved_by = currentUserId; upd.approved_at = new Date().toISOString() }
      const { error } = await supabase.from('expense_claims').update(upd).eq('id', claimId)
      if (!error) setClaims(prev => prev.map(c => c.id === claimId ? { ...c, status: newStatus } : c))
    } catch (err) { console.error(err) }
    finally { setProcessing(null) }
  }

  const startEdit = (claim: ExpenseClaimRow) => {
    setEditingId(claim.id)
    setEditData({ expense_date: claim.expense_date, vendor: claim.vendor, amount: claim.amount, category: claim.category, description: claim.description, billable: claim.billable, payment_method: claim.payment_method, project_id: claim.project_id })
  }
  const cancelEdit = () => { setEditingId(null); setEditData({}) }

  const saveEdit = async (claimId: string) => {
    setProcessing(claimId)
    try {
      const { error } = await supabase.from('expense_claims').update({
        expense_date: editData.expense_date, vendor: editData.vendor, amount: editData.amount,
        category: editData.category, description: editData.description, billable: editData.billable,
        payment_method: editData.payment_method, project_id: editData.project_id || null,
      }).eq('id', claimId)
      if (!error) {
        const project = projects.find((p: any) => p.id === editData.project_id)
        const client = project ? clients.find((c: any) => c.id === project.client_id) : null
        setClaims(prev => prev.map(c => c.id === claimId ? {
          ...c, expense_date: editData.expense_date || c.expense_date, vendor: editData.vendor ?? c.vendor,
          amount: editData.amount ?? c.amount, category: editData.category || c.category,
          description: editData.description ?? c.description, billable: editData.billable ?? c.billable,
          payment_method: editData.payment_method || c.payment_method,
          project_id: editData.project_id ?? c.project_id, project_name: project?.name || null,
          client_id: project?.client_id || null, client_name: client?.name || null,
        } : c))
        setEditingId(null); setEditData({})
      }
    } catch (err) { console.error(err) }
    finally { setProcessing(null) }
  }

  const deleteClaim = async (claimId: string) => {
    if (!confirm('Delete this expense claim?')) return
    setProcessing(claimId)
    try {
      const { error } = await supabase.from('expense_claims').delete().eq('id', claimId)
      if (!error) setClaims(prev => prev.filter(c => c.id !== claimId))
    } catch (err) { console.error(err) }
    finally { setProcessing(null) }
  }

  const toggleClient = (id: string) => setExpandedClients(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleProject = (id: string) => setExpandedProjects(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const inputClass = `px-2 py-1 bg-white/[0.08] border ${THEME.glassBorder} rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50`
  const selectClass = inputClass

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 text-emerald-500 animate-spin" /></div>

  return (
    <div className="space-y-4">
      {/* Stats */}
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
            <p className={`text-2xl font-bold ${stat.color}`}>{formatCurrency(stat.amount)}</p>
            {stat.sub && <p className={`text-xs mt-1 ${THEME.textDim}`}>{stat.sub}</p>}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className={`p-4 rounded-xl border ${THEME.glass} ${THEME.glassBorder}`}>
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={18} className={`absolute left-3 top-1/2 -translate-y-1/2 ${THEME.textDim}`} />
            <input type="text" placeholder="Search vendor, employee, client, project..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2.5 bg-white/[0.05] border ${THEME.glassBorder} rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30`} />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={`px-4 py-2.5 bg-white/[0.05] border ${THEME.glassBorder} rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30`}>
            <option value="all">All Statuses</option>
            <option value="submitted">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="reimbursed">Reimbursed</option>
          </select>
          <button className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium flex items-center gap-2 transition-colors">
            <Plus size={18} /> Add Expense
          </button>
        </div>
      </div>

      {/* Grouped: Client > Project > Employee */}
      {groupedData.length === 0 ? (
        <div className={`rounded-xl border ${THEME.glass} ${THEME.glassBorder} text-center py-16`}>
          <Receipt className={`h-12 w-12 ${THEME.textDim} mx-auto mb-3`} />
          <p className={THEME.textMuted}>No expense claims found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedData.map((cg, ci) => (
            <div key={cg.id} className={`rounded-xl border ${THEME.glass} ${THEME.glassBorder} overflow-hidden`}>
              {/* Client */}
              <button onClick={() => toggleClient(cg.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors">
                <div className="flex items-center gap-3">
                  {expandedClients.has(cg.id) ? <ChevronDown size={18} className={THEME.textMuted} /> : <ChevronRight size={18} className={THEME.textMuted} />}
                  <Building2 size={18} style={{ color: CHART_COLORS[ci % CHART_COLORS.length] }} />
                  <h3 className={`text-base font-semibold ${THEME.textPrimary}`}>{cg.name}</h3>
                  <span className={`px-2 py-0.5 text-xs rounded-full bg-white/[0.08] ${THEME.textMuted}`}>{cg.count}</span>
                </div>
                <span className="text-emerald-400 font-semibold">{formatCurrency(cg.totalAmount)}</span>
              </button>

              {expandedClients.has(cg.id) && (
                <div className={`border-t ${THEME.glassBorder}`}>
                  {Object.values(cg.projects).sort((a, b) => b.totalAmount - a.totalAmount).map((pg, pi) => (
                    <div key={pg.id} className={`border-b ${THEME.glassBorder} last:border-b-0`}>
                      {/* Project */}
                      <button onClick={() => toggleProject(`${cg.id}-${pg.id}`)} className="w-full flex items-center justify-between px-6 py-2.5 hover:bg-white/[0.03] transition-colors">
                        <div className="flex items-center gap-2">
                          {expandedProjects.has(`${cg.id}-${pg.id}`) ? <ChevronDown size={14} className={THEME.textDim} /> : <ChevronRight size={14} className={THEME.textDim} />}
                          <FolderKanban size={14} className={THEME.textMuted} />
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${['bg-blue-500/20 text-blue-400', 'bg-emerald-500/20 text-emerald-400', 'bg-amber-500/20 text-amber-400', 'bg-purple-500/20 text-purple-400'][pi % 4]}`}>{pg.name}</span>
                          <span className={`text-xs ${THEME.textDim}`}>{pg.count} claims</span>
                        </div>
                        <span className="text-sm text-emerald-400 font-medium">{formatCurrency(pg.totalAmount)}</span>
                      </button>

                      {/* Employees */}
                      {expandedProjects.has(`${cg.id}-${pg.id}`) && (
                        <div className="px-6 pb-3">
                          {Object.values(pg.employees).sort((a, b) => b.totalAmount - a.totalAmount).map(emp => (
                            <div key={emp.id} className="mb-3 last:mb-0">
                              <div className="flex items-center gap-2 mb-2 px-2">
                                <User size={14} className={THEME.textMuted} />
                                <span className={`text-sm font-medium ${THEME.textSecondary}`}>{emp.name}</span>
                                <span className={`text-xs ${THEME.textDim}`}>— {formatCurrency(emp.totalAmount)}</span>
                              </div>
                              <div className={`overflow-x-auto rounded-lg border ${THEME.glassBorder}`}>
                                <table className="w-full text-sm">
                                  <thead><tr className="bg-white/[0.02]">
                                    <th className={`px-3 py-2 text-left font-medium ${THEME.textDim} w-20`}>Status</th>
                                    <th className={`px-3 py-2 text-left font-medium ${THEME.textDim} w-24`}>Date</th>
                                    <th className={`px-3 py-2 text-left font-medium ${THEME.textDim}`}>Category</th>
                                    <th className={`px-3 py-2 text-left font-medium ${THEME.textDim}`}>Vendor</th>
                                    <th className={`px-3 py-2 text-left font-medium ${THEME.textDim}`}>Payment</th>
                                    <th className={`px-3 py-2 text-center font-medium ${THEME.textDim} w-14`}>Bill</th>
                                    <th className={`px-3 py-2 text-center font-medium ${THEME.textDim} w-12`}>Rcpt</th>
                                    <th className={`px-3 py-2 text-right font-medium ${THEME.textDim} w-24`}>Amount</th>
                                    <th className={`px-3 py-2 text-center font-medium ${THEME.textDim} w-32`}>Actions</th>
                                  </tr></thead>
                                  <tbody className="divide-y divide-white/[0.04]">
                                    {emp.claims.map(claim => {
                                      const isEditing = editingId === claim.id
                                      const st = STATUS_CONFIG[claim.status] || STATUS_CONFIG.pending
                                      const cat = EXPENSE_CATEGORIES[isEditing ? (editData.category || claim.category) : claim.category] || EXPENSE_CATEGORIES.other
                                      const pay = PAYMENT_METHODS[isEditing ? (editData.payment_method || claim.payment_method) : claim.payment_method] || PAYMENT_METHODS.personal_card
                                      const CatIcon = cat.icon; const PayIcon = pay.icon

                                      return (
                                        <tr key={claim.id} className="hover:bg-white/[0.03] transition-colors">
                                          <td className="px-3 py-2"><span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${st.bg} ${st.color}`}><span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}</span></td>
                                          <td className="px-3 py-2">{isEditing ? <input type="date" value={editData.expense_date || ''} onChange={(e) => setEditData(p => ({ ...p, expense_date: e.target.value }))} className={`${inputClass} w-32`} /> : <span className={THEME.textSecondary}>{formatDate(claim.expense_date)}</span>}</td>
                                          <td className="px-3 py-2">{isEditing ? <select value={editData.category || ''} onChange={(e) => setEditData(p => ({ ...p, category: e.target.value }))} className={`${selectClass} w-28`}>{Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select> : <div className="flex items-center gap-1.5"><CatIcon size={13} className={cat.color} /><span className={THEME.textSecondary}>{cat.label}</span></div>}</td>
                                          <td className="px-3 py-2">{isEditing ? <input type="text" value={editData.vendor || ''} onChange={(e) => setEditData(p => ({ ...p, vendor: e.target.value }))} className={`${inputClass} w-36`} placeholder="Vendor..." /> : <span className={`${THEME.textSecondary} truncate max-w-[160px] block`}>{claim.vendor || claim.description || '—'}</span>}</td>
                                          <td className="px-3 py-2">{isEditing ? <select value={editData.payment_method || ''} onChange={(e) => setEditData(p => ({ ...p, payment_method: e.target.value }))} className={`${selectClass} w-28`}>{Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select> : <div className="flex items-center gap-1"><PayIcon size={13} className={pay.color} /><span className={`text-xs ${THEME.textMuted}`}>{pay.label}</span></div>}</td>
                                          <td className="px-3 py-2 text-center">{isEditing ? <button onClick={() => setEditData(p => ({ ...p, billable: !p.billable }))} className={`p-1 rounded ${editData.billable ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.05] text-slate-600'}`}><Check size={14} /></button> : (claim.billable ? <Check size={14} className="text-emerald-400 mx-auto" /> : <X size={14} className="text-slate-600 mx-auto" />)}</td>
                                          <td className="px-3 py-2 text-center">{claim.receipt_url || claim.attachment_filename ? <button onClick={() => setSelectedClaim(claim)} className="p-1 hover:bg-white/[0.08] rounded">{claim.attachment_type?.includes('pdf') ? <FileText size={14} className="text-red-400" /> : <ImageIcon size={14} className="text-blue-400" />}</button> : <span className={`text-xs ${THEME.textDim}`}>—</span>}</td>
                                          <td className="px-3 py-2 text-right">{isEditing ? <input type="number" value={editData.amount ?? ''} onChange={(e) => setEditData(p => ({ ...p, amount: parseFloat(e.target.value) || 0 }))} className={`${inputClass} w-24 text-right`} step="0.01" /> : <span className="font-semibold text-emerald-400">${claim.amount.toFixed(2)}</span>}</td>
                                          <td className="px-3 py-2">
                                            <div className="flex items-center justify-center gap-1">
                                              {isEditing ? (<>
                                                <button onClick={() => saveEdit(claim.id)} disabled={processing === claim.id} className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded" title="Save">{processing === claim.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}</button>
                                                <button onClick={cancelEdit} className="p-1.5 text-slate-400 hover:bg-white/[0.08] rounded" title="Cancel"><X size={14} /></button>
                                              </>) : (<>
                                                <button onClick={() => startEdit(claim)} className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded" title="Edit"><Edit2 size={14} /></button>
                                                {claim.status === 'submitted' && (<>
                                                  <button onClick={() => updateStatus(claim.id, 'approved')} disabled={processing === claim.id} className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded" title="Approve">{processing === claim.id ? <Loader2 size={14} className="animate-spin" /> : <ThumbsUp size={14} />}</button>
                                                  <button onClick={() => updateStatus(claim.id, 'rejected')} disabled={processing === claim.id} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded" title="Reject"><ThumbsDown size={14} /></button>
                                                </>)}
                                                {claim.status === 'approved' && claim.payment_method === 'personal_card' && <button onClick={() => updateStatus(claim.id, 'reimbursed')} disabled={processing === claim.id} className="text-[11px] px-1.5 py-0.5 text-blue-400 hover:bg-blue-500/20 rounded">Paid</button>}
                                                <button onClick={() => deleteClaim(claim.id)} className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded" title="Delete"><Trash2 size={14} /></button>
                                              </>)}
                                            </div>
                                          </td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Grand Total */}
          <div className={`p-4 rounded-xl ${THEME.glass} border ${THEME.glassBorder} flex items-center justify-between`}>
            <span className={`text-lg font-semibold ${THEME.textPrimary}`}>GRAND TOTAL</span>
            <div className="flex items-center gap-6">
              <span className={`text-sm ${THEME.textMuted}`}>{filteredClaims.length} claims</span>
              <span className="text-lg font-semibold text-emerald-400">{formatCurrency(filteredClaims.reduce((s, c) => s + c.amount, 0))}</span>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {selectedClaim && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedClaim(null)}>
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-2xl max-w-lg w-full max-h-[80vh] overflow-auto shadow-2xl`} onClick={(e) => e.stopPropagation()}>
            <div className={`flex items-center justify-between p-4 border-b ${THEME.glassBorder}`}>
              <h3 className={`font-semibold ${THEME.textPrimary}`}>Receipt — {selectedClaim.vendor || 'Expense'}</h3>
              <button onClick={() => setSelectedClaim(null)} className="p-2 hover:bg-white/[0.08] rounded-lg"><X size={18} className={THEME.textMuted} /></button>
            </div>
            <div className="p-4">
              {selectedClaim.receipt_url && (selectedClaim.attachment_type?.includes('pdf') ? (
                <div className="flex items-center gap-3 p-6 bg-white/[0.03] rounded-xl"><FileText size={32} className="text-red-400" /><div><p className={`font-medium ${THEME.textPrimary}`}>{selectedClaim.attachment_filename || 'Receipt.pdf'}</p><p className={`text-sm ${THEME.textMuted}`}>PDF Document</p></div></div>
              ) : <img src={selectedClaim.receipt_url} alt="Receipt" className="w-full rounded-xl" />)}
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className={THEME.textMuted}>Amount</span><span className="font-semibold text-emerald-400">${selectedClaim.amount.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className={THEME.textMuted}>Date</span><span className={THEME.textSecondary}>{formatDate(selectedClaim.expense_date)}</span></div>
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
