'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search, Download, Plus, Edit2, X, Users, Mail, Phone,
  Eye, EyeOff, Briefcase, DollarSign, Trash2, BarChart3,
  FileText, Building2, MapPin, Upload, Calendar, Clock,
  CheckCircle, AlertCircle, RefreshCw, ExternalLink, TrendingUp,
  User, UserCheck, Filter, ChevronDown, ChevronRight
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend
} from 'recharts'
import { supabase, getCurrentUser } from '@/lib/supabase'

// ============ THEME ============
const THEME = {
  glass: 'bg-slate-900/70 backdrop-blur-xl',
  glassBorder: 'border-white/[0.08]',
  textPrimary: 'text-white',
  textSecondary: 'text-slate-300',
  textMuted: 'text-slate-400',
  textDim: 'text-slate-500',
}

// ============ TOAST ============
interface Toast { id: number; type: 'success' | 'error' | 'info'; message: string }

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div key={toast.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg backdrop-blur-xl border ${
          toast.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
          toast.type === 'error' ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' :
          'bg-blue-500/20 border-blue-500/30 text-blue-400'
        }`}>
          {toast.type === 'success' && <CheckCircle size={18} />}
          {toast.type === 'error' && <AlertCircle size={18} />}
          {toast.type === 'info' && <AlertCircle size={18} />}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => onDismiss(toast.id)} className="ml-2 hover:opacity-70"><X size={16} /></button>
        </div>
      ))}
    </div>
  )
}

// ============ TYPES ============
interface TeamMember {
  id: string
  name: string
  email: string
  phone: string | null
  role: string | null
  status: 'active' | 'inactive'
  employment_type: 'employee' | 'contractor'
  start_date: string | null
  entity_name: string | null
  entity_type: string | null
  address: string | null
  bank_name: string | null
  account_type: string | null
  routing_number: string | null
  account_number: string | null
  payment_method: string | null
  cost_type: string | null
  cost_amount: number | null
}

interface ProjectAssignment {
  id: string
  team_member_id: string
  project_id: string
  project_name: string
  client_id: string | null
  client_name: string
  payment_type: 'lump_sum' | 'tm'
  rate: number
  bill_rate?: number
}

interface Project {
  id: string
  name: string
  client_id: string | null
  client_name?: string
  status: string
  budget: number
}

interface Client {
  id: string
  name: string
}

interface TimeEntry {
  id: string
  team_member_id: string
  project_id: string
  hours: number
  billable_hours: number | null
  is_billable: boolean
  date: string
}

// ============ CONSTANTS ============
const STATUS_OPTIONS = [
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
]

const EMPLOYMENT_TYPES = [
  { id: 'employee', label: 'W-2 Employee', icon: UserCheck, color: 'blue' },
  { id: 'contractor', label: '1099 Contractor', icon: User, color: 'purple' },
]

const ENTITY_TYPES = [
  { id: 'individual', label: 'Individual' },
  { id: 'llc', label: 'LLC' },
  { id: 'corp', label: 'Corporation' },
  { id: 's_corp', label: 'S-Corp' },
  { id: 'partnership', label: 'Partnership' },
]

const PAYMENT_TYPES = [
  { id: 'lump_sum', label: 'Lump Sum' },
  { id: 'tm', label: 'T&M (Hourly)' },
]

const ACCOUNT_TYPES = [
  { id: 'checking', label: 'Checking' },
  { id: 'savings', label: 'Savings' },
]

const PAYMENT_METHODS = [
  { id: 'ach', label: 'ACH Transfer' },
  { id: 'wire', label: 'Wire Transfer' },
  { id: 'check', label: 'Check' },
  { id: 'zelle', label: 'Zelle' },
]

const CHART_COLORS = {
  cost: '#ef4444',
  revenue: '#10b981',
  margin: '#3b82f6',
}

// ============ UTILITIES ============
const formatCurrency = (value: number): string => 
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)

const formatCompactCurrency = (value: number): string => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`
  return `$${value.toFixed(0)}`
}

const maskNumber = (num: string | null): string => {
  if (!num) return '—'
  return '•••• ' + num.slice(-4)
}

const getStatusStyle = (status: string) => {
  if (status === 'active') return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' }
  return { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' }
}

const getEmploymentStyle = (type: string) => {
  if (type === 'employee') return { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' }
  return { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' }
}

// ============ MEMBER DETAIL FLYOUT ============
function MemberDetailFlyout({
  member,
  assignments,
  onClose,
  onEdit,
}: {
  member: TeamMember
  assignments: ProjectAssignment[]
  onClose: () => void
  onEdit: () => void
}) {
  const [showBanking, setShowBanking] = useState(false)
  const memberAssignments = assignments.filter(a => a.team_member_id === member.id)
  const empStyle = getEmploymentStyle(member.employment_type)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-end z-50" onClick={onClose}>
      <div className={`w-full max-w-xl h-full ${THEME.glass} border-l ${THEME.glassBorder} overflow-y-auto`} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`sticky top-0 ${THEME.glass} border-b ${THEME.glassBorder} px-6 py-4 z-10`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`text-lg font-semibold ${THEME.textPrimary}`}>{member.name}</h2>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${empStyle.bg} ${empStyle.text}`}>
                  {member.employment_type === 'employee' ? 'W-2' : '1099'}
                </span>
              </div>
              <p className={`text-sm ${THEME.textMuted} mt-0.5`}>{member.role || 'No role'}</p>
              {member.entity_name && (
                <p className={`text-xs ${THEME.textDim} mt-1 flex items-center gap-1`}>
                  <Building2 size={12} /> {member.entity_name}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onEdit} className="p-2 rounded-lg hover:bg-white/[0.08]">
                <Edit2 size={16} className={THEME.textMuted} />
              </button>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.08]">
                <X size={18} className={THEME.textMuted} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Contact Info */}
          <div className="space-y-3">
            <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Contact Information</h3>
            <div className="space-y-2">
              <a href={`mailto:${member.email}`} className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm">
                <Mail size={14} /> {member.email}
              </a>
              {member.phone && (
                <p className={`flex items-center gap-2 text-sm ${THEME.textSecondary}`}>
                  <Phone size={14} /> {member.phone}
                </p>
              )}
              {member.address && (
                <p className={`flex items-center gap-2 text-sm ${THEME.textMuted}`}>
                  <MapPin size={14} /> {member.address}
                </p>
              )}
              {member.start_date && (
                <p className={`flex items-center gap-2 text-sm ${THEME.textMuted}`}>
                  <Calendar size={14} /> Started {new Date(member.start_date).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          {/* Banking Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Banking Information</h3>
              {member.bank_name && (
                <button onClick={() => setShowBanking(!showBanking)} className={`text-xs ${THEME.textMuted} hover:text-white flex items-center gap-1`}>
                  {showBanking ? <EyeOff size={14} /> : <Eye size={14} />} {showBanking ? 'Hide' : 'Show'}
                </button>
              )}
            </div>
            {member.bank_name ? (
              <div className="p-4 rounded-lg bg-white/[0.03] space-y-2">
                <div className="flex justify-between"><span className={THEME.textMuted}>Bank</span><span className={THEME.textPrimary}>{member.bank_name}</span></div>
                <div className="flex justify-between"><span className={THEME.textMuted}>Account Type</span><span className={THEME.textPrimary}>{ACCOUNT_TYPES.find(t => t.id === member.account_type)?.label || '—'}</span></div>
                <div className="flex justify-between"><span className={THEME.textMuted}>Routing #</span><span className="font-mono text-sm">{showBanking ? member.routing_number : maskNumber(member.routing_number)}</span></div>
                <div className="flex justify-between"><span className={THEME.textMuted}>Account #</span><span className="font-mono text-sm">{showBanking ? member.account_number : maskNumber(member.account_number)}</span></div>
                <div className="flex justify-between"><span className={THEME.textMuted}>Payment</span><span className={THEME.textPrimary}>{PAYMENT_METHODS.find(m => m.id === member.payment_method)?.label || '—'}</span></div>
              </div>
            ) : (
              <p className={`text-sm ${THEME.textMuted} p-4 rounded-lg bg-white/[0.03] text-center`}>No banking info on file</p>
            )}
          </div>

          {/* Contracts Summary */}
          <div className="space-y-3">
            <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Active Contracts ({memberAssignments.length})</h3>
            {memberAssignments.length > 0 ? (
              <div className="space-y-2">
                {memberAssignments.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                    <div>
                      <p className={`text-sm font-medium ${THEME.textPrimary}`}>{a.project_name}</p>
                      <p className={`text-xs ${THEME.textDim}`}>{a.client_name}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-0.5 rounded ${a.payment_type === 'lump_sum' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {a.payment_type === 'lump_sum' ? 'LS' : 'T&M'}
                      </span>
                      <p className={`text-sm text-orange-400 mt-0.5`}>
                        {formatCurrency(a.rate)}{a.payment_type === 'tm' ? '/hr' : '/mo'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-sm ${THEME.textMuted} text-center py-4`}>No active contracts</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ CONTRACT MODAL ============
function ContractModal({
  isOpen,
  onClose,
  onSave,
  editingContract,
  teamMembers,
  projects,
  clients,
}: {
  isOpen: boolean
  onClose: () => void
  onSave: (data: any) => Promise<void>
  editingContract: ProjectAssignment | null
  teamMembers: TeamMember[]
  projects: Project[]
  clients: Client[]
}) {
  const [form, setForm] = useState({
    team_member_id: '',
    client_id: '',
    project_id: '',
    payment_type: 'tm' as 'lump_sum' | 'tm',
    rate: '',
    bill_rate: '',
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (editingContract) {
      setForm({
        team_member_id: editingContract.team_member_id,
        client_id: editingContract.client_id || '',
        project_id: editingContract.project_id,
        payment_type: editingContract.payment_type,
        rate: editingContract.rate.toString(),
        bill_rate: editingContract.bill_rate?.toString() || '',
      })
    } else {
      setForm({ team_member_id: '', client_id: '', project_id: '', payment_type: 'tm', rate: '', bill_rate: '' })
    }
  }, [editingContract, isOpen])

  const filteredProjects = form.client_id 
    ? projects.filter(p => p.client_id === form.client_id)
    : projects

  const handleSave = async () => {
    if (!form.team_member_id || !form.project_id) return
    setIsSaving(true)
    try {
      await onSave({
        ...form,
        rate: parseFloat(form.rate) || 0,
        bill_rate: form.bill_rate ? parseFloat(form.bill_rate) : null,
      })
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-2xl w-full max-w-lg`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
          <h3 className={`text-lg font-semibold ${THEME.textPrimary}`}>
            {editingContract ? 'Edit Contract' : 'New Contract'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-white/[0.05] rounded-lg">
            <X size={20} className={THEME.textMuted} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className={`block text-xs ${THEME.textMuted} mb-1`}>Team Member *</label>
            <select
              value={form.team_member_id}
              onChange={e => setForm(p => ({ ...p, team_member_id: e.target.value }))}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
            >
              <option value="">Select team member...</option>
              {teamMembers.filter(m => m.status === 'active').map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={`block text-xs ${THEME.textMuted} mb-1`}>Client</label>
            <select
              value={form.client_id}
              onChange={e => setForm(p => ({ ...p, client_id: e.target.value, project_id: '' }))}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
            >
              <option value="">All clients...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className={`block text-xs ${THEME.textMuted} mb-1`}>Project *</label>
            <select
              value={form.project_id}
              onChange={e => setForm(p => ({ ...p, project_id: e.target.value }))}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
            >
              <option value="">Select project...</option>
              {filteredProjects.map(p => (
                <option key={p.id} value={p.id}>{p.client_name ? `${p.client_name} - ` : ''}{p.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs ${THEME.textMuted} mb-1`}>Payment Type</label>
              <select
                value={form.payment_type}
                onChange={e => setForm(p => ({ ...p, payment_type: e.target.value as any }))}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
              >
                {PAYMENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-xs ${THEME.textMuted} mb-1`}>
                Cost Rate ({form.payment_type === 'lump_sum' ? '/mo' : '/hr'})
              </label>
              <input
                type="number"
                value={form.rate}
                onChange={e => setForm(p => ({ ...p, rate: e.target.value }))}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
                placeholder="0"
              />
            </div>
          </div>

          {form.payment_type === 'tm' && (
            <div>
              <label className={`block text-xs ${THEME.textMuted} mb-1`}>Bill Rate (/hr) — What client pays</label>
              <input
                type="number"
                value={form.bill_rate}
                onChange={e => setForm(p => ({ ...p, bill_rate: e.target.value }))}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
                placeholder="Optional — used for profitability"
              />
            </div>
          )}
        </div>

        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${THEME.glassBorder} bg-white/[0.02]`}>
          <button onClick={onClose} className={`px-4 py-2 text-sm font-medium ${THEME.textMuted} hover:text-white`}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!form.team_member_id || !form.project_id || isSaving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
          >
            {isSaving && <RefreshCw size={14} className="animate-spin" />}
            {editingContract ? 'Save Changes' : 'Create Contract'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ MEMBER MODAL ============
function MemberModal({
  isOpen,
  onClose,
  onSave,
  editingMember,
}: {
  isOpen: boolean
  onClose: () => void
  onSave: (data: any) => Promise<void>
  editingMember: TeamMember | null
}) {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', role: '', status: 'active',
    employment_type: 'contractor', start_date: '',
    entity_name: '', entity_type: '', address: '',
    bank_name: '', account_type: '', routing_number: '', account_number: '', payment_method: '',
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (editingMember) {
      setForm({
        name: editingMember.name || '',
        email: editingMember.email || '',
        phone: editingMember.phone || '',
        role: editingMember.role || '',
        status: editingMember.status || 'active',
        employment_type: editingMember.employment_type || 'contractor',
        start_date: editingMember.start_date || '',
        entity_name: editingMember.entity_name || '',
        entity_type: editingMember.entity_type || '',
        address: editingMember.address || '',
        bank_name: editingMember.bank_name || '',
        account_type: editingMember.account_type || '',
        routing_number: editingMember.routing_number || '',
        account_number: editingMember.account_number || '',
        payment_method: editingMember.payment_method || '',
      })
    } else {
      setForm({
        name: '', email: '', phone: '', role: '', status: 'active',
        employment_type: 'contractor', start_date: '',
        entity_name: '', entity_type: '', address: '',
        bank_name: '', account_type: '', routing_number: '', account_number: '', payment_method: '',
      })
    }
  }, [editingMember, isOpen])

  const handleSave = async () => {
    if (!form.name || !form.email) return
    setIsSaving(true)
    try {
      await onSave(form)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
          <h3 className={`text-lg font-semibold ${THEME.textPrimary}`}>
            {editingMember ? 'Edit Team Member' : 'Add Team Member'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-white/[0.05] rounded-lg">
            <X size={20} className={THEME.textMuted} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <h4 className={`text-sm font-semibold ${THEME.textPrimary} mb-3`}>Basic Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs ${THEME.textMuted} mb-1`}>Name *</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" />
              </div>
              <div>
                <label className={`block text-xs ${THEME.textMuted} mb-1`}>Email *</label>
                <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" />
              </div>
              <div>
                <label className={`block text-xs ${THEME.textMuted} mb-1`}>Phone</label>
                <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" />
              </div>
              <div>
                <label className={`block text-xs ${THEME.textMuted} mb-1`}>Role</label>
                <input type="text" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" placeholder="e.g., Project Manager" />
              </div>
              <div>
                <label className={`block text-xs ${THEME.textMuted} mb-1`}>Employment Type</label>
                <select value={form.employment_type} onChange={e => setForm(p => ({ ...p, employment_type: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white">
                  {EMPLOYMENT_TYPES.map(t => <option key={t.id} value={t.id} className="bg-slate-900">{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={`block text-xs ${THEME.textMuted} mb-1`}>Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white">
                  {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id} className="bg-slate-900">{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className={`block text-xs ${THEME.textMuted} mb-1`}>Start Date</label>
                <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" />
              </div>
            </div>
          </div>

          {/* Entity Info - Only for contractors */}
          {form.employment_type === 'contractor' && (
            <div className={`pt-4 border-t ${THEME.glassBorder}`}>
              <h4 className={`text-sm font-semibold ${THEME.textPrimary} mb-3`}>Entity Information (1099)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs ${THEME.textMuted} mb-1`}>Entity Name</label>
                  <input type="text" value={form.entity_name} onChange={e => setForm(p => ({ ...p, entity_name: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" placeholder="e.g., Smith Consulting LLC" />
                </div>
                <div>
                  <label className={`block text-xs ${THEME.textMuted} mb-1`}>Entity Type</label>
                  <select value={form.entity_type} onChange={e => setForm(p => ({ ...p, entity_type: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white">
                    <option value="" className="bg-slate-900">Select...</option>
                    {ENTITY_TYPES.map(t => <option key={t.id} value={t.id} className="bg-slate-900">{t.label}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={`block text-xs ${THEME.textMuted} mb-1`}>Address</label>
                  <input type="text" value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" placeholder="123 Main St, City, State ZIP" />
                </div>
              </div>
            </div>
          )}

          {/* Banking */}
          <div className={`pt-4 border-t ${THEME.glassBorder}`}>
            <h4 className={`text-sm font-semibold ${THEME.textPrimary} mb-3`}>Banking Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-xs ${THEME.textMuted} mb-1`}>Bank Name</label>
                <input type="text" value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" />
              </div>
              <div>
                <label className={`block text-xs ${THEME.textMuted} mb-1`}>Account Type</label>
                <select value={form.account_type} onChange={e => setForm(p => ({ ...p, account_type: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white">
                  <option value="" className="bg-slate-900">Select...</option>
                  {ACCOUNT_TYPES.map(t => <option key={t.id} value={t.id} className="bg-slate-900">{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={`block text-xs ${THEME.textMuted} mb-1`}>Routing Number</label>
                <input type="text" value={form.routing_number} onChange={e => setForm(p => ({ ...p, routing_number: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" />
              </div>
              <div>
                <label className={`block text-xs ${THEME.textMuted} mb-1`}>Account Number</label>
                <input type="text" value={form.account_number} onChange={e => setForm(p => ({ ...p, account_number: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" />
              </div>
              <div>
                <label className={`block text-xs ${THEME.textMuted} mb-1`}>Payment Method</label>
                <select value={form.payment_method} onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white">
                  <option value="" className="bg-slate-900">Select...</option>
                  {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id} className="bg-slate-900">{m.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${THEME.glassBorder} bg-white/[0.02]`}>
          <button onClick={onClose} className={`px-4 py-2 text-sm font-medium ${THEME.textMuted} hover:text-white`}>Cancel</button>
          <button onClick={handleSave} disabled={!form.name || !form.email || isSaving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50">
            {isSaving && <RefreshCw size={14} className="animate-spin" />}
            {editingMember ? 'Save Changes' : 'Add Member'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ MAIN PAGE ============
export default function TeamPage() {
  const [loading, setLoading] = useState(true)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Toast
  const [toasts, setToasts] = useState<Toast[]>([])
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  // UI State
  const [activeTab, setActiveTab] = useState<'directory' | 'contracts' | 'profitability'>('directory')
  const [searchQuery, setSearchQuery] = useState('')
  const [employmentFilter, setEmploymentFilter] = useState<'all' | 'employee' | 'contractor'>('all')
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [showContractModal, setShowContractModal] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [editingContract, setEditingContract] = useState<ProjectAssignment | null>(null)
  const [selectedMemberDetail, setSelectedMemberDetail] = useState<TeamMember | null>(null)

  // Load Data
  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await getCurrentUser()
        const user = result?.user
        if (!user) { setLoading(false); return }

        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
        if (!profile?.company_id) { setLoading(false); return }

        setCompanyId(profile.company_id)

        const [membersRes, projectsRes, clientsRes, assignmentsRes, timeRes] = await Promise.all([
          supabase.from('team_members').select('*').eq('company_id', profile.company_id).order('name'),
          supabase.from('projects').select('*').eq('company_id', profile.company_id),
          supabase.from('clients').select('id, name').eq('company_id', profile.company_id),
          supabase.from('project_assignments').select('*').eq('company_id', profile.company_id),
          supabase.from('time_entries').select('*').eq('company_id', profile.company_id),
        ])

        setTeamMembers(membersRes.data || [])
        setClients(clientsRes.data || [])
        
        const clientMap = new Map((clientsRes.data || []).map(c => [c.id, c.name]))
        setProjects((projectsRes.data || []).map(p => ({
          ...p,
          budget: parseFloat(p.budget) || 0,
          client_name: clientMap.get(p.client_id) || '',
        })))

        // Enrich assignments
        const projectMap = new Map((projectsRes.data || []).map(p => [p.id, p]))
        setAssignments((assignmentsRes.data || []).map(a => {
          const project = projectMap.get(a.project_id)
          return {
            ...a,
            project_name: project?.name || 'Unknown',
            client_id: project?.client_id,
            client_name: clientMap.get(project?.client_id) || '',
          }
        }))

        setTimeEntries(timeRes.data || [])
      } catch (error) {
        console.error('Error loading data:', error)
        addToast('error', 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [addToast])

  // Filtered Members
  const filteredMembers = useMemo(() => {
    return teamMembers.filter(m => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!m.name?.toLowerCase().includes(q) && !m.email?.toLowerCase().includes(q)) return false
      }
      if (employmentFilter !== 'all' && m.employment_type !== employmentFilter) return false
      return true
    })
  }, [teamMembers, searchQuery, employmentFilter])

  // Grouped members by employment type
  const groupedMembers = useMemo(() => ({
    employees: filteredMembers.filter(m => m.employment_type === 'employee'),
    contractors: filteredMembers.filter(m => m.employment_type === 'contractor'),
  }), [filteredMembers])

  // Summary stats
  const summary = useMemo(() => {
    const active = teamMembers.filter(m => m.status === 'active')
    const employees = teamMembers.filter(m => m.employment_type === 'employee')
    const contractors = teamMembers.filter(m => m.employment_type === 'contractor')
    
    // Calculate costs from assignments
    let totalMonthlyCost = 0
    assignments.forEach(a => {
      if (a.payment_type === 'lump_sum') {
        totalMonthlyCost += a.rate
      }
      // T&M costs calculated from time entries
    })

    return { total: teamMembers.length, active: active.length, employees: employees.length, contractors: contractors.length, totalMonthlyCost }
  }, [teamMembers, assignments])

  // Profitability data
  const profitabilityData = useMemo(() => {
    const memberStats = teamMembers.map(member => {
      const memberAssignments = assignments.filter(a => a.team_member_id === member.id)
      const memberTime = timeEntries.filter(t => t.team_member_id === member.id)
      
      let totalCost = 0
      let totalRevenue = 0
      
      memberAssignments.forEach(a => {
        const projectTime = memberTime.filter(t => t.project_id === a.project_id)
        const actualHours = projectTime.reduce((sum, t) => sum + (t.hours || 0), 0)
        const billableHours = projectTime.reduce((sum, t) => sum + (t.billable_hours || t.hours || 0), 0)
        
        if (a.payment_type === 'lump_sum') {
          totalCost += a.rate
        } else {
          totalCost += actualHours * a.rate
        }
        
        if (a.bill_rate) {
          totalRevenue += billableHours * a.bill_rate
        }
      })
      
      return {
        id: member.id,
        name: member.name,
        cost: totalCost,
        revenue: totalRevenue,
        margin: totalRevenue - totalCost,
        marginPct: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
      }
    }).filter(m => m.cost > 0 || m.revenue > 0)

    return memberStats
  }, [teamMembers, assignments, timeEntries])

  // Handlers
  const handleSaveMember = async (data: any) => {
    if (!companyId) return
    try {
      if (editingMember) {
        const { error } = await supabase.from('team_members').update(data).eq('id', editingMember.id)
        if (error) throw error
        setTeamMembers(prev => prev.map(m => m.id === editingMember.id ? { ...m, ...data } : m))
        addToast('success', 'Team member updated')
      } else {
        const { data: newMember, error } = await supabase.from('team_members').insert({ company_id: companyId, ...data }).select().single()
        if (error) throw error
        setTeamMembers(prev => [...prev, newMember])
        addToast('success', 'Team member added')
      }
      setEditingMember(null)
    } catch (error: any) {
      addToast('error', `Failed to save: ${error.message}`)
      throw error
    }
  }

  const handleSaveContract = async (data: any) => {
    if (!companyId) return
    const project = projects.find(p => p.id === data.project_id)
    try {
      if (editingContract) {
        const { error } = await supabase.from('project_assignments').update(data).eq('id', editingContract.id)
        if (error) throw error
        setAssignments(prev => prev.map(a => a.id === editingContract.id ? { ...a, ...data, project_name: project?.name, client_name: project?.client_name } : a))
        addToast('success', 'Contract updated')
      } else {
        const { data: newAssignment, error } = await supabase.from('project_assignments').insert({ company_id: companyId, ...data }).select().single()
        if (error) throw error
        setAssignments(prev => [...prev, { ...newAssignment, project_name: project?.name, client_name: project?.client_name || '' }])
        addToast('success', 'Contract created')
      }
      setEditingContract(null)
    } catch (error: any) {
      addToast('error', `Failed to save: ${error.message}`)
      throw error
    }
  }

  const handleDeleteMember = async (id: string) => {
    if (!confirm('Delete this team member?')) return
    try {
      const { error } = await supabase.from('team_members').delete().eq('id', id)
      if (error) throw error
      setTeamMembers(prev => prev.filter(m => m.id !== id))
      addToast('success', 'Team member deleted')
    } catch (error: any) {
      addToast('error', `Failed to delete: ${error.message}`)
    }
  }

  const handleDeleteContract = async (id: string) => {
    if (!confirm('Delete this contract?')) return
    try {
      const { error } = await supabase.from('project_assignments').delete().eq('id', id)
      if (error) throw error
      setAssignments(prev => prev.filter(a => a.id !== id))
      addToast('success', 'Contract deleted')
    } catch (error: any) {
      addToast('error', `Failed to delete: ${error.message}`)
    }
  }

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Type', 'Entity', 'Status', 'Role']
    const rows = teamMembers.map(m => [m.name, m.email, m.employment_type, m.entity_name, m.status, m.role])
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c || ''}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `team-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    addToast('success', 'Export complete')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
          <p className={`text-sm ${THEME.textMuted}`}>Loading team...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-xl font-semibold ${THEME.textPrimary}`}>Team</h1>
          <p className={`text-sm ${THEME.textMuted} mt-1`}>Manage team members, contracts, and profitability</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 border border-white/[0.1] rounded-lg text-sm font-medium text-slate-300 hover:bg-white/[0.05]">
            <Download size={14} /> Export
          </button>
          {activeTab === 'directory' && (
            <button onClick={() => { setEditingMember(null); setShowMemberModal(true) }} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 shadow-lg shadow-emerald-500/20">
              <Plus size={14} /> Add Member
            </button>
          )}
          {activeTab === 'contracts' && (
            <button onClick={() => { setEditingContract(null); setShowContractModal(true) }} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 shadow-lg shadow-emerald-500/20">
              <Plus size={14} /> New Contract
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-1.5 inline-flex gap-1`}>
        {[
          { id: 'directory', label: 'Directory', icon: Users },
          { id: 'contracts', label: 'Contracts', icon: FileText },
          { id: 'profitability', label: 'Profitability', icon: BarChart3 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg'
                : `${THEME.textMuted} hover:text-white hover:bg-white/[0.05]`
            }`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-4`}>
          <p className={`text-xs font-medium ${THEME.textMuted} uppercase`}>Total Members</p>
          <p className="text-2xl font-bold text-white mt-1">{summary.total}</p>
          <p className={`text-xs ${THEME.textDim} mt-1`}>{summary.active} active</p>
        </div>
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-4`}>
          <p className={`text-xs font-medium ${THEME.textMuted} uppercase`}>W-2 Employees</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{summary.employees}</p>
        </div>
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-4`}>
          <p className={`text-xs font-medium ${THEME.textMuted} uppercase`}>1099 Contractors</p>
          <p className="text-2xl font-bold text-purple-400 mt-1">{summary.contractors}</p>
        </div>
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-4`}>
          <p className={`text-xs font-medium ${THEME.textMuted} uppercase`}>Active Contracts</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{assignments.length}</p>
        </div>
      </div>

      {/* Directory Tab */}
      {activeTab === 'directory' && (
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
          {/* Filters */}
          <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="bg-white/[0.05] border border-white/[0.1] rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 w-64"
                />
              </div>
              <div className="flex items-center gap-1 p-1 bg-white/[0.03] rounded-lg">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'employee', label: 'W-2' },
                  { id: 'contractor', label: '1099' },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setEmploymentFilter(f.id as any)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      employmentFilter === f.id
                        ? 'bg-white/[0.1] text-white'
                        : `${THEME.textMuted} hover:text-white`
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <p className={`text-sm ${THEME.textMuted}`}>{filteredMembers.length} members</p>
          </div>

          {/* Grouped Table */}
          {employmentFilter === 'all' ? (
            <div>
              {/* Employees Section */}
              {groupedMembers.employees.length > 0 && (
                <div>
                  <div className={`px-6 py-3 bg-blue-500/5 border-b ${THEME.glassBorder}`}>
                    <div className="flex items-center gap-2">
                      <UserCheck size={16} className="text-blue-400" />
                      <span className="text-sm font-medium text-blue-400">W-2 Employees ({groupedMembers.employees.length})</span>
                    </div>
                  </div>
                  <MemberTable members={groupedMembers.employees} assignments={assignments} onView={setSelectedMemberDetail} onEdit={m => { setEditingMember(m); setShowMemberModal(true) }} onDelete={handleDeleteMember} />
                </div>
              )}
              
              {/* Contractors Section */}
              {groupedMembers.contractors.length > 0 && (
                <div>
                  <div className={`px-6 py-3 bg-purple-500/5 border-b border-t ${THEME.glassBorder}`}>
                    <div className="flex items-center gap-2">
                      <User size={16} className="text-purple-400" />
                      <span className="text-sm font-medium text-purple-400">1099 Contractors ({groupedMembers.contractors.length})</span>
                    </div>
                  </div>
                  <MemberTable members={groupedMembers.contractors} assignments={assignments} onView={setSelectedMemberDetail} onEdit={m => { setEditingMember(m); setShowMemberModal(true) }} onDelete={handleDeleteMember} />
                </div>
              )}
            </div>
          ) : (
            <MemberTable members={filteredMembers} assignments={assignments} onView={setSelectedMemberDetail} onEdit={m => { setEditingMember(m); setShowMemberModal(true) }} onDelete={handleDeleteMember} />
          )}

          {filteredMembers.length === 0 && (
            <div className={`px-6 py-12 text-center ${THEME.textMuted}`}>No team members found</div>
          )}
        </div>
      )}

      {/* Contracts Tab */}
      {activeTab === 'contracts' && (
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
          <div className={`px-6 py-4 border-b ${THEME.glassBorder}`}>
            <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Active Contracts</h3>
            <p className={`text-xs ${THEME.textMuted} mt-1`}>Per-client/project cost agreements</p>
          </div>

          {assignments.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className={`bg-white/[0.02] border-b ${THEME.glassBorder}`}>
                  <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium`}>Team Member</th>
                  <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium`}>Client</th>
                  <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium`}>Project</th>
                  <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium`}>Type</th>
                  <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Cost Rate</th>
                  <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Bill Rate</th>
                  <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium w-20`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map(a => {
                  const member = teamMembers.find(m => m.id === a.team_member_id)
                  return (
                    <tr key={a.id} className="border-b border-white/[0.05] hover:bg-white/[0.03]">
                      <td className={`px-4 py-3 font-medium ${THEME.textPrimary}`}>{member?.name || 'Unknown'}</td>
                      <td className={`px-4 py-3 ${THEME.textSecondary}`}>{a.client_name || '—'}</td>
                      <td className={`px-4 py-3 ${THEME.textSecondary}`}>{a.project_name}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          a.payment_type === 'lump_sum' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {a.payment_type === 'lump_sum' ? 'Lump Sum' : 'T&M'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-orange-400 font-medium">
                          {formatCurrency(a.rate)}<span className={`text-xs ${THEME.textDim}`}>{a.payment_type === 'tm' ? '/hr' : '/mo'}</span>
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right ${a.bill_rate ? 'text-emerald-400' : THEME.textMuted}`}>
                        {a.bill_rate ? `${formatCurrency(a.bill_rate)}/hr` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setEditingContract(a); setShowContractModal(true) }} className="p-1.5 rounded hover:bg-white/[0.08] text-slate-500 hover:text-slate-300">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDeleteContract(a.id)} className="p-1.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className={`px-6 py-12 text-center ${THEME.textMuted}`}>
              <FileText size={48} className="mx-auto text-slate-600 mb-4" />
              <p>No contracts yet</p>
              <button
                onClick={() => { setEditingContract(null); setShowContractModal(true) }}
                className="mt-4 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30"
              >
                Create First Contract
              </button>
            </div>
          )}
        </div>
      )}

      {/* Profitability Tab */}
      {activeTab === 'profitability' && (
        <div className="space-y-6">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-6`}>
            <h3 className={`text-sm font-semibold ${THEME.textPrimary} mb-4`}>Team Profitability</h3>
            {profitabilityData.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profitabilityData} margin={{ left: 20, right: 20 }}>
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => formatCompactCurrency(v)} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                      formatter={(value: number, name: string) => [formatCurrency(value), name === 'cost' ? 'Cost' : 'Revenue']}
                    />
                    <Legend />
                    <Bar dataKey="cost" name="Cost" fill={CHART_COLORS.cost} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS.revenue} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className={`text-center py-12 ${THEME.textMuted}`}>
                <BarChart3 size={48} className="mx-auto text-slate-600 mb-4" />
                <p>No profitability data yet</p>
                <p className={`text-xs ${THEME.textDim} mt-1`}>Add contracts with bill rates to see profitability</p>
              </div>
            )}
          </div>

          {profitabilityData.length > 0 && (
            <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
              <div className={`px-6 py-4 border-b ${THEME.glassBorder}`}>
                <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Margin by Team Member</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className={`bg-white/[0.02] border-b ${THEME.glassBorder}`}>
                    <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium`}>Name</th>
                    <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Cost</th>
                    <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Revenue</th>
                    <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Margin</th>
                    <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {profitabilityData.map(row => (
                    <tr key={row.id} className="border-b border-white/[0.05]">
                      <td className={`px-4 py-3 font-medium ${THEME.textPrimary}`}>{row.name}</td>
                      <td className="px-4 py-3 text-right text-rose-400">{formatCurrency(row.cost)}</td>
                      <td className="px-4 py-3 text-right text-emerald-400">{formatCurrency(row.revenue)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${row.margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatCurrency(row.margin)}
                      </td>
                      <td className={`px-4 py-3 text-right ${row.marginPct >= 20 ? 'text-emerald-400' : row.marginPct >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {row.marginPct.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <MemberModal
        isOpen={showMemberModal}
        onClose={() => { setShowMemberModal(false); setEditingMember(null) }}
        onSave={handleSaveMember}
        editingMember={editingMember}
      />

      <ContractModal
        isOpen={showContractModal}
        onClose={() => { setShowContractModal(false); setEditingContract(null) }}
        onSave={handleSaveContract}
        editingContract={editingContract}
        teamMembers={teamMembers}
        projects={projects}
        clients={clients}
      />

      {selectedMemberDetail && (
        <MemberDetailFlyout
          member={selectedMemberDetail}
          assignments={assignments}
          onClose={() => setSelectedMemberDetail(null)}
          onEdit={() => { setEditingMember(selectedMemberDetail); setShowMemberModal(true); setSelectedMemberDetail(null) }}
        />
      )}
    </div>
  )
}

// ============ MEMBER TABLE COMPONENT ============
function MemberTable({
  members,
  assignments,
  onView,
  onEdit,
  onDelete,
}: {
  members: TeamMember[]
  assignments: ProjectAssignment[]
  onView: (m: TeamMember) => void
  onEdit: (m: TeamMember) => void
  onDelete: (id: string) => void
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className={`bg-white/[0.02] border-b ${THEME.glassBorder}`}>
          <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium`}>Name</th>
          <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium`}>Role</th>
          <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium`}>Entity</th>
          <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium`}>Contracts</th>
          <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium`}>Status</th>
          <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium w-24`}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {members.map(member => {
          const memberAssignments = assignments.filter(a => a.team_member_id === member.id)
          const statusStyle = getStatusStyle(member.status)
          
          return (
            <tr key={member.id} className="border-b border-white/[0.05] hover:bg-white/[0.03] cursor-pointer" onClick={() => onView(member)}>
              <td className="px-4 py-3">
                <div>
                  <p className={`font-medium ${THEME.textPrimary}`}>{member.name}</p>
                  <p className={`text-xs ${THEME.textDim}`}>{member.email}</p>
                </div>
              </td>
              <td className={`px-4 py-3 ${THEME.textSecondary}`}>{member.role || '—'}</td>
              <td className={`px-4 py-3 ${THEME.textMuted}`}>
                {member.entity_name || (member.employment_type === 'employee' ? 'N/A' : '—')}
              </td>
              <td className="px-4 py-3 text-center">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  memberAssignments.length > 0 ? 'bg-blue-500/10 text-blue-400' : `bg-white/[0.05] ${THEME.textMuted}`
                }`}>
                  {memberAssignments.length}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={`px-2 py-1 rounded text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                  {member.status}
                </span>
              </td>
              <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-center gap-1">
                  <button onClick={() => onView(member)} className="p-1.5 rounded hover:bg-white/[0.08] text-slate-500 hover:text-blue-400">
                    <Eye size={14} />
                  </button>
                  <button onClick={() => onEdit(member)} className="p-1.5 rounded hover:bg-white/[0.08] text-slate-500 hover:text-slate-300">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => onDelete(member.id)} className="p-1.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400">
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
