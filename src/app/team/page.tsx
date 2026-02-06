'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search, Download, Plus, Edit2, X, Users, Mail, Phone,
  Eye, EyeOff, Briefcase, DollarSign, Trash2, BarChart3,
  FileText, Building2, MapPin, Upload, Calendar, Clock,
  CheckCircle, AlertCircle, RefreshCw, ExternalLink, TrendingUp,
  User, UserCheck, Filter, ChevronDown, ChevronRight, Link2, Unlink
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

interface Contract {
  id: string
  team_member_id: string
  client_id: string | null
  name: string | null
  contract_type: 'tm' | 'lump_sum'
  cost_rate: number
  total_amount: number
  baseline_hours: number
  allocation_method: 'by_hours' | 'fixed'
  period_type: 'monthly' | 'quarterly' | 'annual' | 'project'
  start_date: string | null
  end_date: string | null
  is_active: boolean
  is_default: boolean
  // Enriched fields
  team_member_name?: string
  client_name?: string
  projects?: ContractProject[]
}

interface ContractProject {
  id: string
  contract_id: string
  project_id: string
  fixed_amount: number | null
  allocation_pct: number | null
  bill_rate: number | null
  project_name?: string
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
  contractor_id: string
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

const CONTRACT_TYPES = [
  { id: 'tm', label: 'T&M (Hourly)', description: 'Pay per hour worked' },
  { id: 'lump_sum', label: 'Lump Sum', description: 'Fixed amount per period' },
]

const PERIOD_TYPES = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'annual', label: 'Annual' },
  { id: 'project', label: 'Project-based' },
]

const ALLOCATION_METHODS = [
  { id: 'by_hours', label: 'By Hours', description: 'Split by actual hours worked' },
  { id: 'fixed', label: 'Fixed Amounts', description: 'Manually assign amounts per project' },
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

const CHART_COLORS = { cost: '#ef4444', revenue: '#10b981', margin: '#3b82f6' }

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

const getContractTypeStyle = (type: string) => {
  if (type === 'tm') return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'T&M' }
  return { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Lump Sum' }
}

// ============ MEMBER DETAIL FLYOUT ============
function MemberDetailFlyout({
  member, contracts, projects, onClose, onEdit
}: {
  member: TeamMember; contracts: Contract[]; projects: Project[]
  onClose: () => void; onEdit: () => void
}) {
  const [showBanking, setShowBanking] = useState(false)
  const memberContracts = contracts.filter(c => c.team_member_id === member.id && c.is_active)
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
              {member.phone && <p className={`flex items-center gap-2 text-sm ${THEME.textSecondary}`}><Phone size={14} /> {member.phone}</p>}
              {member.address && <p className={`flex items-center gap-2 text-sm ${THEME.textMuted}`}><MapPin size={14} /> {member.address}</p>}
              {member.start_date && <p className={`flex items-center gap-2 text-sm ${THEME.textMuted}`}><Calendar size={14} /> Started {new Date(member.start_date).toLocaleDateString()}</p>}
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
            <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Active Contracts ({memberContracts.length})</h3>
            {memberContracts.length > 0 ? (
              <div className="space-y-2">
                {memberContracts.map(c => {
                  const typeStyle = getContractTypeStyle(c.contract_type)
                  return (
                    <div key={c.id} className="p-3 rounded-lg bg-white/[0.03]">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`text-sm font-medium ${THEME.textPrimary}`}>
                            {c.name || (c.client_name ? `${c.client_name} Contract` : 'Default Rate')}
                          </p>
                          <p className={`text-xs ${THEME.textDim}`}>
                            {c.is_default ? 'Applies to all work' : c.client_name || 'Specific projects'}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs px-2 py-0.5 rounded ${typeStyle.bg} ${typeStyle.text}`}>
                            {typeStyle.label}
                          </span>
                          <p className={`text-sm text-orange-400 mt-0.5`}>
                            {c.contract_type === 'tm' 
                              ? `${formatCurrency(c.cost_rate)}/hr` 
                              : `${formatCurrency(c.total_amount)}/${c.period_type.slice(0,3)}`}
                          </p>
                        </div>
                      </div>
                      {c.projects && c.projects.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/[0.05]">
                          <p className={`text-xs ${THEME.textDim} mb-1`}>Linked projects:</p>
                          <div className="flex flex-wrap gap-1">
                            {c.projects.map(p => (
                              <span key={p.id} className="text-xs px-2 py-0.5 rounded bg-white/[0.05] text-slate-300">
                                {p.project_name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
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
  isOpen, onClose, onSave, editingContract, teamMembers, projects, clients
}: {
  isOpen: boolean; onClose: () => void; onSave: (data: any, projectIds: string[], projectAmounts: Record<string, number>, projectBillRates: Record<string, number>) => Promise<void>
  editingContract: Contract | null; teamMembers: TeamMember[]; projects: Project[]; clients: Client[]
}) {
  const [form, setForm] = useState({
    team_member_id: '',
    client_id: '',
    name: '',
    contract_type: 'tm' as 'tm' | 'lump_sum',
    cost_rate: '',
    total_amount: '',
    baseline_hours: '172',
    allocation_method: 'by_hours' as 'by_hours' | 'fixed',
    period_type: 'monthly' as 'monthly' | 'quarterly' | 'annual' | 'project',
    start_date: '',
    end_date: '',
    is_default: false,
  })
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [projectAmounts, setProjectAmounts] = useState<Record<string, number>>({})
  const [projectBillRates, setProjectBillRates] = useState<Record<string, number>>({})
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (editingContract) {
      setForm({
        team_member_id: editingContract.team_member_id,
        client_id: editingContract.client_id || '',
        name: editingContract.name || '',
        contract_type: editingContract.contract_type,
        cost_rate: editingContract.cost_rate?.toString() || '',
        total_amount: editingContract.total_amount?.toString() || '',
        baseline_hours: editingContract.baseline_hours?.toString() || '172',
        allocation_method: editingContract.allocation_method || 'by_hours',
        period_type: editingContract.period_type || 'monthly',
        start_date: editingContract.start_date || '',
        end_date: editingContract.end_date || '',
        is_default: editingContract.is_default || false,
      })
      if (editingContract.projects) {
        setSelectedProjects(editingContract.projects.map(p => p.project_id))
        const amounts: Record<string, number> = {}
        const billRates: Record<string, number> = {}
        editingContract.projects.forEach(p => { 
          if (p.fixed_amount) amounts[p.project_id] = p.fixed_amount
          if (p.bill_rate) billRates[p.project_id] = p.bill_rate
        })
        setProjectAmounts(amounts)
        setProjectBillRates(billRates)
      }
    } else {
      setForm({
        team_member_id: '', client_id: '', name: '', contract_type: 'tm',
        cost_rate: '', total_amount: '', baseline_hours: '172',
        allocation_method: 'by_hours', period_type: 'monthly',
        start_date: '', end_date: '', is_default: false,
      })
      setSelectedProjects([])
      setProjectAmounts({})
      setProjectBillRates({})
    }
  }, [editingContract, isOpen])

  const filteredProjects = form.client_id 
    ? projects.filter(p => p.client_id === form.client_id)
    : projects

  // Clear selected projects that don't match the client when client changes
  useEffect(() => {
    if (form.client_id) {
      const validProjectIds = new Set(filteredProjects.map(p => p.id))
      setSelectedProjects(prev => prev.filter(id => validProjectIds.has(id)))
    }
  }, [form.client_id, filteredProjects])

  const effectiveRate = form.contract_type === 'lump_sum' && form.total_amount && form.baseline_hours
    ? parseFloat(form.total_amount) / parseFloat(form.baseline_hours)
    : null

  const handleSave = async () => {
    if (!form.team_member_id) return
    if (form.contract_type === 'tm' && !form.cost_rate) return
    if (form.contract_type === 'lump_sum' && !form.total_amount) return

    setIsSaving(true)
    try {
      await onSave({
        ...form,
        cost_rate: parseFloat(form.cost_rate) || 0,
        total_amount: parseFloat(form.total_amount) || 0,
        baseline_hours: parseFloat(form.baseline_hours) || 172,
        client_id: form.client_id || null,
        is_active: true,
      }, selectedProjects, projectAmounts, projectBillRates)
      onClose()
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-2xl w-full max-w-2xl my-8`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
          <h3 className={`text-lg font-semibold ${THEME.textPrimary}`}>
            {editingContract ? 'Edit Contract' : 'New Contract'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-white/[0.05] rounded-lg">
            <X size={20} className={THEME.textMuted} />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Team Member */}
          <div>
            <label className={`block text-xs ${THEME.textMuted} mb-1`}>Team Member *</label>
            <select value={form.team_member_id} onChange={e => setForm(p => ({ ...p, team_member_id: e.target.value }))}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white">
              <option value="">Select team member...</option>
              {teamMembers.filter(m => m.status === 'active').map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.employment_type === 'employee' ? 'W-2' : '1099'})</option>
              ))}
            </select>
          </div>

          {/* Contract Type Toggle */}
          <div>
            <label className={`block text-xs ${THEME.textMuted} mb-2`}>Contract Type *</label>
            <div className="grid grid-cols-2 gap-3">
              {CONTRACT_TYPES.map(t => (
                <button key={t.id} type="button"
                  onClick={() => setForm(p => ({ ...p, contract_type: t.id as any }))}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    form.contract_type === t.id
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-white/[0.08] hover:border-white/[0.15]'
                  }`}>
                  <p className={`text-sm font-medium ${form.contract_type === t.id ? 'text-emerald-400' : THEME.textPrimary}`}>{t.label}</p>
                  <p className={`text-xs ${THEME.textDim} mt-0.5`}>{t.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* T&M Fields */}
          {form.contract_type === 'tm' && (
            <>
              <div>
                <label className={`block text-xs ${THEME.textMuted} mb-1`}>Cost Rate ($/hr) * — What you pay them</label>
                <input type="number" value={form.cost_rate} onChange={e => setForm(p => ({ ...p, cost_rate: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" placeholder="150" />
              </div>

              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_default} onChange={e => setForm(p => ({ ...p, is_default: e.target.checked, client_id: '' }))}
                    className="w-4 h-4 rounded border-white/[0.2] bg-white/[0.05] text-emerald-500 focus:ring-emerald-500/50" />
                  <span className={`text-sm ${THEME.textSecondary}`}>Default rate for all work</span>
                </label>
              </div>

              {!form.is_default && (
                <div>
                  <label className={`block text-xs ${THEME.textMuted} mb-1`}>Scope (Client)</label>
                  <select value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white">
                    <option value="">All clients (general rate)</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <p className={`text-xs ${THEME.textDim} mt-1`}>Leave empty for a general rate, or select to limit to one client</p>
                </div>
              )}

              {/* Project Links for T&M */}
              {!form.is_default && (
                <div>
                  <label className={`block text-xs ${THEME.textMuted} mb-2`}>Project Assignments — Bill Rates</label>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {filteredProjects.map(p => {
                      const isSelected = selectedProjects.includes(p.id)
                      return (
                        <div key={p.id} className={`p-3 rounded-lg border transition-all ${isSelected ? 'bg-white/[0.05] border-emerald-500/30' : 'border-white/[0.08]'}`}>
                          <div className="flex items-center gap-3">
                            <input type="checkbox" checked={isSelected}
                              onChange={e => {
                                if (e.target.checked) setSelectedProjects(prev => [...prev, p.id])
                                else {
                                  setSelectedProjects(prev => prev.filter(id => id !== p.id))
                                  setProjectBillRates(prev => { const n = { ...prev }; delete n[p.id]; return n })
                                }
                              }}
                              className="w-4 h-4 rounded border-white/[0.2] bg-white/[0.05] text-emerald-500" />
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${THEME.textPrimary}`}>{p.name}</p>
                              <p className={`text-xs ${THEME.textDim}`}>{p.client_name}</p>
                            </div>
                            {isSelected && (
                              <div className="w-28">
                                <input type="number" placeholder="$/hr"
                                  value={projectBillRates[p.id] || ''}
                                  onChange={e => setProjectBillRates(prev => ({ ...prev, [p.id]: parseFloat(e.target.value) || 0 }))}
                                  className="w-full px-2 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded text-sm text-white text-right" />
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {selectedProjects.length === 0 && (
                    <p className={`text-xs ${THEME.textDim} mt-2`}>Select projects to assign this contractor and set bill rates</p>
                  )}
                </div>
              )}
            </>
          )}

          {/* Lump Sum Fields */}
          {form.contract_type === 'lump_sum' && (
            <>
              <div>
                <label className={`block text-xs ${THEME.textMuted} mb-1`}>Contract Name</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
                  placeholder="e.g., Emily - 2025 Support Package" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={`block text-xs ${THEME.textMuted} mb-1`}>Total Amount *</label>
                  <input type="number" value={form.total_amount} onChange={e => setForm(p => ({ ...p, total_amount: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" placeholder="35000" />
                </div>
                <div>
                  <label className={`block text-xs ${THEME.textMuted} mb-1`}>Baseline Hours</label>
                  <input type="number" value={form.baseline_hours} onChange={e => setForm(p => ({ ...p, baseline_hours: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" placeholder="172" />
                </div>
                <div>
                  <label className={`block text-xs ${THEME.textMuted} mb-1`}>Period</label>
                  <select value={form.period_type} onChange={e => setForm(p => ({ ...p, period_type: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white">
                    {PERIOD_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {effectiveRate && (
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-sm text-blue-400">
                    Effective Cost Rate: <span className="font-semibold">${effectiveRate.toFixed(2)}/hr</span>
                    <span className={`${THEME.textDim} ml-2`}>({formatCurrency(parseFloat(form.total_amount))} ÷ {form.baseline_hours} hrs)</span>
                  </p>
                </div>
              )}

              <div>
                <label className={`block text-xs ${THEME.textMuted} mb-1`}>Client (Optional)</label>
                <select value={form.client_id} onChange={e => setForm(p => ({ ...p, client_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white">
                  <option value="">All clients / Multiple projects</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              {/* Allocation Method */}
              <div>
                <label className={`block text-xs ${THEME.textMuted} mb-2`}>Cost Allocation Method</label>
                <div className="grid grid-cols-2 gap-3">
                  {ALLOCATION_METHODS.map(m => (
                    <button key={m.id} type="button"
                      onClick={() => setForm(p => ({ ...p, allocation_method: m.id as any }))}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        form.allocation_method === m.id
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-white/[0.08] hover:border-white/[0.15]'
                      }`}>
                      <p className={`text-sm font-medium ${form.allocation_method === m.id ? 'text-blue-400' : THEME.textPrimary}`}>{m.label}</p>
                      <p className={`text-xs ${THEME.textDim} mt-0.5`}>{m.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Project Links */}
              <div>
                <label className={`block text-xs ${THEME.textMuted} mb-2`}>Linked Projects — Assign Bill Rates</label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredProjects.map(p => {
                    const isSelected = selectedProjects.includes(p.id)
                    return (
                      <div key={p.id} className={`p-3 rounded-lg border transition-all ${isSelected ? 'bg-white/[0.05] border-emerald-500/30' : 'border-white/[0.08]'}`}>
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={isSelected}
                            onChange={e => {
                              if (e.target.checked) setSelectedProjects(prev => [...prev, p.id])
                              else {
                                setSelectedProjects(prev => prev.filter(id => id !== p.id))
                                setProjectAmounts(prev => { const n = { ...prev }; delete n[p.id]; return n })
                                setProjectBillRates(prev => { const n = { ...prev }; delete n[p.id]; return n })
                              }
                            }}
                            className="w-4 h-4 rounded border-white/[0.2] bg-white/[0.05] text-emerald-500" />
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${THEME.textPrimary}`}>{p.name}</p>
                            <p className={`text-xs ${THEME.textDim}`}>{p.client_name}</p>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center gap-4">
                            <div className="flex-1">
                              <label className={`block text-xs ${THEME.textDim} mb-1`}>Bill Rate ($/hr)</label>
                              <input type="number" placeholder="240"
                                value={projectBillRates[p.id] || ''}
                                onChange={e => setProjectBillRates(prev => ({ ...prev, [p.id]: parseFloat(e.target.value) || 0 }))}
                                className="w-full px-2 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded text-sm text-white" />
                            </div>
                            {form.allocation_method === 'fixed' && (
                              <div className="flex-1">
                                <label className={`block text-xs ${THEME.textDim} mb-1`}>Fixed Cost ($)</label>
                                <input type="number" placeholder="0"
                                  value={projectAmounts[p.id] || ''}
                                  onChange={e => setProjectAmounts(prev => ({ ...prev, [p.id]: parseFloat(e.target.value) || 0 }))}
                                  className="w-full px-2 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded text-sm text-white" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {selectedProjects.length === 0 && (
                  <p className={`text-xs ${THEME.textDim} mt-2`}>Select projects and assign bill rates for revenue tracking</p>
                )}
              </div>
            </>
          )}

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs ${THEME.textMuted} mb-1`}>Start Date</label>
              <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" />
            </div>
            <div>
              <label className={`block text-xs ${THEME.textMuted} mb-1`}>End Date</label>
              <input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" />
            </div>
          </div>
        </div>

        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${THEME.glassBorder} bg-white/[0.02]`}>
          <button onClick={onClose} className={`px-4 py-2 text-sm font-medium ${THEME.textMuted} hover:text-white`}>Cancel</button>
          <button onClick={handleSave}
            disabled={!form.team_member_id || isSaving || (form.contract_type === 'tm' && !form.cost_rate) || (form.contract_type === 'lump_sum' && !form.total_amount)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50">
            {isSaving && <RefreshCw size={14} className="animate-spin" />}
            {editingContract ? 'Save Changes' : 'Create Contract'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ MEMBER MODAL ============
function MemberModal({ isOpen, onClose, onSave, editingMember }: {
  isOpen: boolean; onClose: () => void; onSave: (data: any) => Promise<void>; editingMember: TeamMember | null
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
        name: editingMember.name || '', email: editingMember.email || '', phone: editingMember.phone || '',
        role: editingMember.role || '', status: editingMember.status || 'active',
        employment_type: editingMember.employment_type || 'contractor',
        start_date: editingMember.start_date || '',
        entity_name: editingMember.entity_name || '', entity_type: editingMember.entity_type || '',
        address: editingMember.address || '', bank_name: editingMember.bank_name || '',
        account_type: editingMember.account_type || '', routing_number: editingMember.routing_number || '',
        account_number: editingMember.account_number || '', payment_method: editingMember.payment_method || '',
      })
    } else {
      setForm({
        name: '', email: '', phone: '', role: '', status: 'active', employment_type: 'contractor', start_date: '',
        entity_name: '', entity_type: '', address: '', bank_name: '', account_type: '', routing_number: '', account_number: '', payment_method: '',
      })
    }
  }, [editingMember, isOpen])

  const handleSave = async () => {
    if (!form.name || !form.email) return
    setIsSaving(true)
    try { await onSave(form); onClose() } finally { setIsSaving(false) }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
          <h3 className={`text-lg font-semibold ${THEME.textPrimary}`}>{editingMember ? 'Edit Team Member' : 'Add Team Member'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/[0.05] rounded-lg"><X size={20} className={THEME.textMuted} /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Full Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" /></div>
            <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Email *</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Phone</label>
              <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" /></div>
            <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Role / Title</label>
              <input value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Employment Type</label>
              <select value={form.employment_type} onChange={e => setForm(p => ({ ...p, employment_type: e.target.value }))}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white">
                {EMPLOYMENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select></div>
            <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white">
                {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select></div>
            <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Start Date</label>
              <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" /></div>
          </div>

          {form.employment_type === 'contractor' && (
            <>
              <div className={`pt-4 border-t ${THEME.glassBorder}`}>
                <h4 className={`text-sm font-medium ${THEME.textSecondary} mb-3`}>Entity Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Entity Name</label>
                    <input value={form.entity_name} onChange={e => setForm(p => ({ ...p, entity_name: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" placeholder="LLC or DBA name" /></div>
                  <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Entity Type</label>
                    <select value={form.entity_type} onChange={e => setForm(p => ({ ...p, entity_type: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white">
                      <option value="">Select...</option>
                      {ENTITY_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select></div>
                </div>
                <div className="mt-4"><label className={`block text-xs ${THEME.textMuted} mb-1`}>Address</label>
                  <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" /></div>
              </div>

              <div className={`pt-4 border-t ${THEME.glassBorder}`}>
                <h4 className={`text-sm font-medium ${THEME.textSecondary} mb-3`}>Payment Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Bank Name</label>
                    <input value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" /></div>
                  <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Account Type</label>
                    <select value={form.account_type} onChange={e => setForm(p => ({ ...p, account_type: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white">
                      <option value="">Select...</option>
                      {ACCOUNT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Routing Number</label>
                    <input value={form.routing_number} onChange={e => setForm(p => ({ ...p, routing_number: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white font-mono" /></div>
                  <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Account Number</label>
                    <input value={form.account_number} onChange={e => setForm(p => ({ ...p, account_number: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white font-mono" /></div>
                </div>
                <div className="mt-4"><label className={`block text-xs ${THEME.textMuted} mb-1`}>Preferred Payment Method</label>
                  <select value={form.payment_method} onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))}
                    className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white">
                    <option value="">Select...</option>
                    {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select></div>
              </div>
            </>
          )}
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
  const [companyId, setCompanyId] = useState<string | null>(null)
  
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [contractProjects, setContractProjects] = useState<ContractProject[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  
  const [activeTab, setActiveTab] = useState<'directory' | 'contracts' | 'profitability'>('directory')
  const [searchQuery, setSearchQuery] = useState('')
  const [employmentFilter, setEmploymentFilter] = useState<'all' | 'employee' | 'contractor'>('all')
  
  const [toasts, setToasts] = useState<Toast[]>([])
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const [showMemberModal, setShowMemberModal] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [showContractModal, setShowContractModal] = useState(false)
  const [editingContract, setEditingContract] = useState<Contract | null>(null)
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

        const [membersRes, projectsRes, clientsRes, contractsRes, contractProjectsRes, timeRes] = await Promise.all([
          supabase.from('team_members').select('*').eq('company_id', profile.company_id).order('name'),
          supabase.from('projects').select('*').eq('company_id', profile.company_id),
          supabase.from('clients').select('id, name').eq('company_id', profile.company_id),
          supabase.from('team_member_contracts').select('*').eq('company_id', profile.company_id).order('created_at', { ascending: false }),
          supabase.from('contract_projects').select('*'),
          supabase.from('time_entries').select('*').eq('company_id', profile.company_id),
        ])

        setTeamMembers(membersRes.data || [])
        setClients(clientsRes.data || [])
        
        const clientMap = new Map((clientsRes.data || []).map(c => [c.id, c.name]))
        const memberMap = new Map((membersRes.data || []).map(m => [m.id, m.name]))
        
        setProjects((projectsRes.data || []).map(p => ({
          ...p,
          budget: parseFloat(p.budget) || 0,
          client_name: clientMap.get(p.client_id) || '',
        })))

        const projectMap = new Map((projectsRes.data || []).map(p => [p.id, p.name]))
        
        // Enrich contract projects
        const enrichedContractProjects = (contractProjectsRes.data || []).map(cp => ({
          ...cp,
          project_name: projectMap.get(cp.project_id) || 'Unknown',
        }))
        setContractProjects(enrichedContractProjects)

        // Enrich contracts with member/client names and linked projects
        const contractProjectsByContract = enrichedContractProjects.reduce((acc, cp) => {
          if (!acc[cp.contract_id]) acc[cp.contract_id] = []
          acc[cp.contract_id].push(cp)
          return acc
        }, {} as Record<string, ContractProject[]>)

        setContracts((contractsRes.data || []).map(c => ({
          ...c,
          team_member_name: memberMap.get(c.team_member_id) || 'Unknown',
          client_name: clientMap.get(c.client_id) || '',
          projects: contractProjectsByContract[c.id] || [],
        })))

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

  // Summary stats
  const summary = useMemo(() => {
    const active = teamMembers.filter(m => m.status === 'active')
    const employees = teamMembers.filter(m => m.employment_type === 'employee')
    const contractors = teamMembers.filter(m => m.employment_type === 'contractor')
    const activeContracts = contracts.filter(c => c.is_active)
    return { total: teamMembers.length, active: active.length, employees: employees.length, contractors: contractors.length, activeContracts: activeContracts.length }
  }, [teamMembers, contracts])

  // Profitability data
  const profitabilityData = useMemo(() => {
    return teamMembers.map(member => {
      const memberContracts = contracts.filter(c => c.team_member_id === member.id && c.is_active)
      const memberTime = timeEntries.filter(t => t.contractor_id === member.id)
      
      let totalCost = 0
      let totalRevenue = 0
      const totalHours = memberTime.reduce((sum, t) => sum + (t.hours || 0), 0)
      
      memberContracts.forEach(c => {
        // Calculate hours for this contract's scope
        let scopeHours = totalHours
        if (c.client_id) {
          scopeHours = memberTime.filter(t => {
            const proj = projects.find(p => p.id === t.project_id)
            return proj?.client_id === c.client_id
          }).reduce((sum, t) => sum + (t.hours || 0), 0)
        }

        // Calculate cost
        if (c.contract_type === 'lump_sum') {
          totalCost += c.total_amount
        } else {
          totalCost += scopeHours * c.cost_rate
        }

        // Calculate revenue using bill_rate from contract_projects
        if (c.projects && c.projects.length > 0) {
          c.projects.forEach(cp => {
            const projectTime = memberTime.filter(t => t.project_id === cp.project_id)
            const projectHours = projectTime.reduce((sum, t) => sum + (t.hours || 0), 0)
            if (cp.bill_rate && cp.bill_rate > 0) {
              totalRevenue += projectHours * cp.bill_rate
            }
          })
        }
      })

      const margin = totalRevenue - totalCost
      const marginPct = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0

      return {
        id: member.id,
        name: member.name,
        hours: totalHours,
        cost: totalCost,
        revenue: totalRevenue,
        margin,
        marginPct,
      }
    }).filter(m => m.cost > 0 || m.revenue > 0 || m.hours > 0)
  }, [teamMembers, contracts, timeEntries, projects])

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

  const handleSaveContract = async (data: any, projectIds: string[], projectAmounts: Record<string, number>, projectBillRates: Record<string, number>) => {
    if (!companyId) return
    try {
      const contractData = { company_id: companyId, ...data }
      
      if (editingContract) {
        const { error } = await supabase.from('team_member_contracts').update(contractData).eq('id', editingContract.id)
        if (error) throw error

        // Update project links
        await supabase.from('contract_projects').delete().eq('contract_id', editingContract.id)
        if (projectIds.length > 0) {
          const projectLinks = projectIds.map(pid => ({
            contract_id: editingContract.id,
            project_id: pid,
            fixed_amount: projectAmounts[pid] || null,
            bill_rate: projectBillRates[pid] || null,
          }))
          await supabase.from('contract_projects').insert(projectLinks)
        }

        const memberName = teamMembers.find(m => m.id === data.team_member_id)?.name
        const clientName = clients.find(c => c.id === data.client_id)?.name
        const projectsEnriched = projectIds.map(pid => ({
          id: '', contract_id: editingContract.id, project_id: pid,
          fixed_amount: projectAmounts[pid] || null, allocation_pct: null,
          bill_rate: projectBillRates[pid] || null,
          project_name: projects.find(p => p.id === pid)?.name,
        }))

        setContracts(prev => prev.map(c => c.id === editingContract.id ? {
          ...c, ...contractData, team_member_name: memberName, client_name: clientName, projects: projectsEnriched
        } : c))
        addToast('success', 'Contract updated')
      } else {
        const { data: newContract, error } = await supabase.from('team_member_contracts').insert(contractData).select().single()
        if (error) throw error

        // Add project links
        if (projectIds.length > 0) {
          const projectLinks = projectIds.map(pid => ({
            contract_id: newContract.id,
            project_id: pid,
            fixed_amount: projectAmounts[pid] || null,
            bill_rate: projectBillRates[pid] || null,
          }))
          await supabase.from('contract_projects').insert(projectLinks)
        }

        const memberName = teamMembers.find(m => m.id === data.team_member_id)?.name
        const clientName = clients.find(c => c.id === data.client_id)?.name
        const projectsEnriched = projectIds.map(pid => ({
          id: '', contract_id: newContract.id, project_id: pid,
          fixed_amount: projectAmounts[pid] || null, allocation_pct: null,
          bill_rate: projectBillRates[pid] || null,
          project_name: projects.find(p => p.id === pid)?.name,
        }))

        setContracts(prev => [...prev, { ...newContract, team_member_name: memberName, client_name: clientName, projects: projectsEnriched }])
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
      const { error } = await supabase.from('team_member_contracts').delete().eq('id', id)
      if (error) throw error
      setContracts(prev => prev.filter(c => c.id !== id))
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
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-emerald-500/20 text-emerald-400' : `${THEME.textMuted} hover:text-white hover:bg-white/[0.05]`
            }`}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-4`}>
          <p className={`text-xs ${THEME.textMuted} uppercase tracking-wider`}>Total Members</p>
          <p className={`text-2xl font-bold ${THEME.textPrimary} mt-1`}>{summary.total}</p>
          <p className={`text-xs ${THEME.textDim}`}>{summary.active} active</p>
        </div>
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-4`}>
          <p className={`text-xs ${THEME.textMuted} uppercase tracking-wider`}>W-2 Employees</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{summary.employees}</p>
        </div>
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-4`}>
          <p className={`text-xs ${THEME.textMuted} uppercase tracking-wider`}>1099 Contractors</p>
          <p className="text-2xl font-bold text-purple-400 mt-1">{summary.contractors}</p>
        </div>
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-4`}>
          <p className={`text-xs ${THEME.textMuted} uppercase tracking-wider`}>Active Contracts</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{summary.activeContracts}</p>
        </div>
      </div>

      {/* Directory Tab */}
      {activeTab === 'directory' && (
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
          {/* Filters */}
          <div className={`px-4 py-3 border-b ${THEME.glassBorder} flex flex-wrap items-center gap-3`}>
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${THEME.textDim}`} />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white placeholder-slate-500"
                placeholder="Search team members..." />
            </div>
            <select value={employmentFilter} onChange={e => setEmploymentFilter(e.target.value as any)}
              className="px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white">
              <option value="all">All Types</option>
              <option value="employee">W-2 Only</option>
              <option value="contractor">1099 Only</option>
            </select>
          </div>

          {filteredMembers.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className={`bg-white/[0.02] border-b ${THEME.glassBorder}`}>
                  <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium`}>Name</th>
                  <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium`}>Role</th>
                  <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium`}>Type</th>
                  <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium`}>Contracts</th>
                  <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium`}>Status</th>
                  <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium w-24`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map(member => {
                  const memberContracts = contracts.filter(c => c.team_member_id === member.id && c.is_active)
                  const statusStyle = getStatusStyle(member.status)
                  const empStyle = getEmploymentStyle(member.employment_type)
                  
                  return (
                    <tr key={member.id} className="border-b border-white/[0.05] hover:bg-white/[0.03] cursor-pointer" onClick={() => setSelectedMemberDetail(member)}>
                      <td className="px-4 py-3">
                        <div>
                          <p className={`font-medium ${THEME.textPrimary}`}>{member.name}</p>
                          <p className={`text-xs ${THEME.textDim}`}>{member.email}</p>
                        </div>
                      </td>
                      <td className={`px-4 py-3 ${THEME.textSecondary}`}>{member.role || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${empStyle.bg} ${empStyle.text}`}>
                          {member.employment_type === 'employee' ? 'W-2' : '1099'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          memberContracts.length > 0 ? 'bg-orange-500/10 text-orange-400' : `bg-white/[0.05] ${THEME.textMuted}`
                        }`}>
                          {memberContracts.length}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                          {member.status}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setSelectedMemberDetail(member)} className="p-1.5 rounded hover:bg-white/[0.08] text-slate-500 hover:text-blue-400">
                            <Eye size={14} />
                          </button>
                          <button onClick={() => { setEditingMember(member); setShowMemberModal(true) }} className="p-1.5 rounded hover:bg-white/[0.08] text-slate-500 hover:text-slate-300">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDeleteMember(member.id)} className="p-1.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400">
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
              <Users size={48} className="mx-auto text-slate-600 mb-4" />
              <p>No team members found</p>
              <button onClick={() => { setEditingMember(null); setShowMemberModal(true) }}
                className="mt-4 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30">
                Add First Member
              </button>
            </div>
          )}
        </div>
      )}

      {/* Contracts Tab */}
      {activeTab === 'contracts' && (
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
          <div className={`px-6 py-4 border-b ${THEME.glassBorder}`}>
            <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Active Contracts</h3>
            <p className={`text-xs ${THEME.textDim} mt-0.5`}>Per-member cost agreements (T&M and Lump Sum)</p>
          </div>

          {contracts.filter(c => c.is_active).length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className={`bg-white/[0.02] border-b ${THEME.glassBorder}`}>
                  <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium`}>Team Member</th>
                  <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium`}>Contract</th>
                  <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium`}>Type</th>
                  <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Cost</th>
                  <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Bill Rate</th>
                  <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium`}>Scope</th>
                  <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium w-20`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {contracts.filter(c => c.is_active).map(c => {
                  const typeStyle = getContractTypeStyle(c.contract_type)
                  const effectiveCostRate = c.contract_type === 'lump_sum' && c.baseline_hours > 0
                    ? c.total_amount / c.baseline_hours
                    : c.cost_rate
                  const margin = c.bill_rate > 0 && effectiveCostRate > 0 
                    ? ((c.bill_rate - effectiveCostRate) / c.bill_rate * 100).toFixed(0)
                    : null
                  return (
                    <tr key={c.id} className="border-b border-white/[0.05] hover:bg-white/[0.03]">
                      <td className={`px-4 py-3 font-medium ${THEME.textPrimary}`}>{c.team_member_name}</td>
                      <td className="px-4 py-3">
                        <p className={THEME.textSecondary}>{c.name || (c.is_default ? 'Default Rate' : c.client_name || 'Custom')}</p>
                        {c.projects && c.projects.length > 0 && (
                          <p className={`text-xs ${THEME.textDim}`}>{c.projects.length} project{c.projects.length > 1 ? 's' : ''} linked</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${typeStyle.bg} ${typeStyle.text}`}>
                          {typeStyle.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-rose-400">
                          {c.contract_type === 'tm' 
                            ? `${formatCurrency(c.cost_rate)}/hr` 
                            : formatCurrency(c.total_amount)}
                        </span>
                        {c.contract_type === 'lump_sum' && (
                          <p className={`text-xs ${THEME.textDim}`}>~${effectiveCostRate.toFixed(0)}/hr</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {c.bill_rate > 0 ? (
                          <>
                            <span className="text-emerald-400">${c.bill_rate}/hr</span>
                            {margin && <p className={`text-xs ${parseInt(margin) >= 20 ? 'text-emerald-400' : 'text-amber-400'}`}>{margin}% margin</p>}
                          </>
                        ) : (
                          <span className={THEME.textDim}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.is_default ? (
                          <span className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400">All</span>
                        ) : c.client_name ? (
                          <span className={`text-xs ${THEME.textMuted}`}>{c.client_name}</span>
                        ) : (
                          <span className={`text-xs ${THEME.textDim}`}>Custom</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setEditingContract(c); setShowContractModal(true) }} className="p-1.5 rounded hover:bg-white/[0.08] text-slate-500 hover:text-slate-300">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDeleteContract(c.id)} className="p-1.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400">
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
              <button onClick={() => { setEditingContract(null); setShowContractModal(true) }}
                className="mt-4 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30">
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
                      labelStyle={{ color: '#fff' }}
                      formatter={(value: number, name: string) => [formatCurrency(value), name === 'cost' ? 'Cost' : 'Revenue']}
                      cursor={false}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar dataKey="cost" name="Cost" fill={CHART_COLORS.cost} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS.revenue} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className={`text-center py-12 ${THEME.textMuted}`}>
                <BarChart3 size={48} className="mx-auto text-slate-600 mb-4" />
                <p>No cost data yet</p>
                <p className={`text-xs ${THEME.textDim} mt-1`}>Add contracts to track team costs</p>
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
                    <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Hours</th>
                    <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Cost</th>
                    <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Revenue</th>
                    <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Margin</th>
                    <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {profitabilityData.map(row => (
                    <tr key={row.id} className="border-b border-white/[0.05]">
                      <td className={`px-4 py-3 font-medium ${THEME.textPrimary}`}>{row.name}</td>
                      <td className={`px-4 py-3 text-right ${THEME.textSecondary}`}>{row.hours.toFixed(1)}</td>
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
          contracts={contracts}
          projects={projects}
          onClose={() => setSelectedMemberDetail(null)}
          onEdit={() => { setEditingMember(selectedMemberDetail); setShowMemberModal(true); setSelectedMemberDetail(null) }}
        />
      )}
    </div>
  )
}
