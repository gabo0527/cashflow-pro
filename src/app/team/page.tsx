'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search, Download, Plus, Edit2, X, Users, Mail, Phone,
  Eye, EyeOff, Briefcase, DollarSign, Trash2, BarChart3,
  FileText, Building2, MapPin, Upload, Calendar, Clock,
  CheckCircle, AlertCircle, RefreshCw, ExternalLink, TrendingUp,
  User, UserCheck, Filter, ChevronDown, ChevronRight, Link2
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
  id: string; name: string; email: string; phone: string | null; role: string | null
  status: 'active' | 'inactive'; employment_type: 'employee' | 'contractor'
  start_date: string | null; entity_name: string | null; entity_type: string | null
  address: string | null; bank_name: string | null; account_type: string | null
  routing_number: string | null; account_number: string | null; payment_method: string | null
  cost_type: 'hourly' | 'lump_sum'; cost_amount: number | null
}

interface BillRate {
  id: string; team_member_id: string; client_id: string; rate: number
  is_active: boolean; notes: string | null
  team_member_name?: string; client_name?: string
}

interface CostOverride {
  id: string; team_member_id: string; client_id: string; month: string
  fixed_amount: number; notes: string | null
  team_member_name?: string; client_name?: string
}

interface Project { id: string; name: string; client_id: string | null; client_name?: string; status: string; budget: number }
interface Client { id: string; name: string }
interface TimeEntry { id: string; contractor_id: string; project_id: string; hours: number; billable_hours: number | null; is_billable: boolean; date: string }

// ============ CONSTANTS ============
const STATUS_OPTIONS = [{ id: 'active', label: 'Active' }, { id: 'inactive', label: 'Inactive' }]
const EMPLOYMENT_TYPES = [
  { id: 'employee', label: 'W-2 Employee', icon: UserCheck, color: 'blue' },
  { id: 'contractor', label: '1099 Contractor', icon: User, color: 'purple' },
]
const ENTITY_TYPES = [
  { id: 'individual', label: 'Individual' }, { id: 'llc', label: 'LLC' },
  { id: 'corp', label: 'Corporation' }, { id: 's_corp', label: 'S-Corp' }, { id: 'partnership', label: 'Partnership' },
]
const COST_TYPES = [
  { id: 'hourly', label: 'Hourly (T&M)', description: 'Paid per hour worked' },
  { id: 'lump_sum', label: 'Monthly Fixed', description: 'Fixed amount per month' },
]
const ACCOUNT_TYPES = [{ id: 'checking', label: 'Checking' }, { id: 'savings', label: 'Savings' }]
const PAYMENT_METHODS = [
  { id: 'ach', label: 'ACH Transfer' }, { id: 'wire', label: 'Wire Transfer' },
  { id: 'check', label: 'Check' }, { id: 'zelle', label: 'Zelle' },
]
const CHART_COLORS = { cost: '#ef4444', revenue: '#10b981', margin: '#3b82f6' }

// ============ UTILITIES ============
const formatCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
const formatCurrencyDecimal = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
const formatCompactCurrency = (v: number) => { if (v >= 1e6) return `$${(v/1e6).toFixed(1)}M`; if (v >= 1e3) return `$${(v/1e3).toFixed(0)}k`; return `$${v.toFixed(0)}` }
const maskNumber = (num: string | null) => num ? '•••• ' + num.slice(-4) : '—'
const getStatusStyle = (s: string) => s === 'active' ? { bg: 'bg-emerald-500/10', text: 'text-emerald-400' } : { bg: 'bg-slate-500/10', text: 'text-slate-400' }
const getEmploymentStyle = (t: string) => t === 'employee' ? { bg: 'bg-blue-500/10', text: 'text-blue-400' } : { bg: 'bg-purple-500/10', text: 'text-purple-400' }
const getCurrentMonth = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}` }
const formatMonth = (m: string) => { const [y, mo] = m.split('-'); return new Date(parseInt(y), parseInt(mo)-1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }

// ============ MEMBER DETAIL FLYOUT ============
function MemberDetailFlyout({ member, billRates, clients, onClose, onEdit }: {
  member: TeamMember; billRates: BillRate[]; clients: Client[]; onClose: () => void; onEdit: () => void
}) {
  const [showBanking, setShowBanking] = useState(false)
  const memberRates = billRates.filter(r => r.team_member_id === member.id && r.is_active)
  const empStyle = getEmploymentStyle(member.employment_type)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-end z-50" onClick={onClose}>
      <div className={`w-full max-w-xl h-full ${THEME.glass} border-l ${THEME.glassBorder} overflow-y-auto`} onClick={e => e.stopPropagation()}>
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
              <button onClick={onEdit} className="p-2 rounded-lg hover:bg-white/[0.08]"><Edit2 size={16} className={THEME.textMuted} /></button>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.08]"><X size={18} className={THEME.textMuted} /></button>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Contact</h3>
            <div className="space-y-2">
              <a href={`mailto:${member.email}`} className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"><Mail size={14} /> {member.email}</a>
              {member.phone && <p className={`flex items-center gap-2 text-sm ${THEME.textSecondary}`}><Phone size={14} /> {member.phone}</p>}
              {member.address && <p className={`flex items-center gap-2 text-sm ${THEME.textMuted}`}><MapPin size={14} /> {member.address}</p>}
              {member.start_date && <p className={`flex items-center gap-2 text-sm ${THEME.textMuted}`}><Calendar size={14} /> Started {new Date(member.start_date).toLocaleDateString()}</p>}
            </div>
          </div>
          <div className="space-y-3">
            <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Cost Structure</h3>
            <div className="p-4 rounded-lg bg-white/[0.03] space-y-2">
              <div className="flex justify-between"><span className={THEME.textMuted}>Type</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${member.cost_type === 'hourly' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>
                  {member.cost_type === 'hourly' ? 'T&M' : 'Monthly Fixed'}
                </span>
              </div>
              <div className="flex justify-between"><span className={THEME.textMuted}>Amount</span>
                <span className="text-orange-400 font-medium">{member.cost_amount ? (member.cost_type === 'hourly' ? `$${member.cost_amount}/hr` : `${formatCurrency(member.cost_amount)}/mo`) : '—'}</span>
              </div>
              {member.cost_type === 'lump_sum' && member.cost_amount && (
                <div className="flex justify-between"><span className={THEME.textMuted}>Eff. Rate</span><span className={THEME.textDim}>~${(member.cost_amount/172).toFixed(0)}/hr</span></div>
              )}
            </div>
          </div>
          <div className="space-y-3">
            <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Bill Rates ({memberRates.length})</h3>
            {memberRates.length > 0 ? (
              <div className="space-y-2">
                {memberRates.map(r => {
                  const cr = member.cost_type === 'hourly' ? (member.cost_amount||0) : ((member.cost_amount||0)/172)
                  const mg = r.rate > 0 ? ((r.rate-cr)/r.rate*100) : 0
                  return (
                    <div key={r.id} className="p-3 rounded-lg bg-white/[0.03] flex items-center justify-between">
                      <div><p className={`text-sm font-medium ${THEME.textPrimary}`}>{r.client_name}</p>
                        <p className={`text-xs ${mg >= 20 ? 'text-emerald-400' : mg >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>{mg.toFixed(0)}% margin</p></div>
                      <span className="text-emerald-400 font-medium">${r.rate}/hr</span>
                    </div>
                  )
                })}
              </div>
            ) : <p className={`text-sm ${THEME.textMuted} text-center py-4`}>No bill rates set</p>}
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Banking</h3>
              {member.bank_name && <button onClick={() => setShowBanking(!showBanking)} className={`text-xs ${THEME.textMuted} hover:text-white flex items-center gap-1`}>
                {showBanking ? <EyeOff size={14} /> : <Eye size={14} />} {showBanking ? 'Hide' : 'Show'}
              </button>}
            </div>
            {member.bank_name ? (
              <div className="p-4 rounded-lg bg-white/[0.03] space-y-2">
                <div className="flex justify-between"><span className={THEME.textMuted}>Bank</span><span className={THEME.textPrimary}>{member.bank_name}</span></div>
                <div className="flex justify-between"><span className={THEME.textMuted}>Type</span><span className={THEME.textPrimary}>{ACCOUNT_TYPES.find(t=>t.id===member.account_type)?.label||'—'}</span></div>
                <div className="flex justify-between"><span className={THEME.textMuted}>Routing</span><span className="font-mono text-sm">{showBanking?member.routing_number:maskNumber(member.routing_number)}</span></div>
                <div className="flex justify-between"><span className={THEME.textMuted}>Account</span><span className="font-mono text-sm">{showBanking?member.account_number:maskNumber(member.account_number)}</span></div>
                <div className="flex justify-between"><span className={THEME.textMuted}>Method</span><span className={THEME.textPrimary}>{PAYMENT_METHODS.find(m=>m.id===member.payment_method)?.label||'—'}</span></div>
              </div>
            ) : <p className={`text-sm ${THEME.textMuted} p-4 rounded-lg bg-white/[0.03] text-center`}>No banking info</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ BILL RATE MODAL ============
function BillRateModal({ isOpen, onClose, onSave, editingRate, teamMembers, clients }: {
  isOpen: boolean; onClose: () => void; onSave: (data: any) => Promise<void>
  editingRate: BillRate | null; teamMembers: TeamMember[]; clients: Client[]
}) {
  const [form, setForm] = useState({ team_member_id: '', client_id: '', rate: '', notes: '' })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (editingRate) {
      setForm({ team_member_id: editingRate.team_member_id, client_id: editingRate.client_id, rate: editingRate.rate.toString(), notes: editingRate.notes || '' })
    } else {
      setForm({ team_member_id: '', client_id: '', rate: '', notes: '' })
    }
  }, [editingRate, isOpen])

  const selectedMember = teamMembers.find(m => m.id === form.team_member_id)
  const costRate = selectedMember ? (selectedMember.cost_type === 'hourly' ? (selectedMember.cost_amount||0) : ((selectedMember.cost_amount||0)/172)) : 0
  const billRate = parseFloat(form.rate) || 0
  const margin = billRate > 0 ? ((billRate-costRate)/billRate*100) : 0

  const handleSave = async () => {
    if (!form.team_member_id || !form.client_id || !form.rate) return
    setIsSaving(true)
    try { await onSave({ ...form, rate: parseFloat(form.rate)||0, is_active: true }); onClose() } finally { setIsSaving(false) }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-2xl w-full max-w-lg`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
          <h3 className={`text-lg font-semibold ${THEME.textPrimary}`}>{editingRate ? 'Edit Bill Rate' : 'Add Bill Rate'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/[0.05] rounded-lg"><X size={20} className={THEME.textMuted} /></button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className={`block text-xs ${THEME.textMuted} mb-1`}>Team Member *</label>
            <select value={form.team_member_id} onChange={e => setForm(p=>({...p,team_member_id:e.target.value}))} disabled={!!editingRate}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white disabled:opacity-50">
              <option value="">Select team member...</option>
              {teamMembers.filter(m=>m.status==='active').map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className={`block text-xs ${THEME.textMuted} mb-1`}>Client *</label>
            <select value={form.client_id} onChange={e => setForm(p=>({...p,client_id:e.target.value}))} disabled={!!editingRate}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white disabled:opacity-50">
              <option value="">Select client...</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={`block text-xs ${THEME.textMuted} mb-1`}>Bill Rate ($/hr) * — What you charge the client</label>
            <input type="number" value={form.rate} onChange={e => setForm(p=>({...p,rate:e.target.value}))}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" placeholder="185" />
          </div>
          {form.team_member_id && billRate > 0 && (
            <div className={`p-4 rounded-lg border ${margin >= 20 ? 'bg-emerald-500/10 border-emerald-500/20' : margin >= 0 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
              <div className="flex justify-between text-sm"><span className={THEME.textSecondary}>Cost Rate</span><span className="text-orange-400">${costRate.toFixed(2)}/hr</span></div>
              <div className="flex justify-between text-sm mt-1"><span className={THEME.textSecondary}>Bill Rate</span><span className="text-emerald-400">${billRate.toFixed(2)}/hr</span></div>
              <div className={`flex justify-between text-sm mt-2 pt-2 border-t ${THEME.glassBorder}`}>
                <span className="font-medium text-white">Gross Margin</span>
                <span className={`font-semibold ${margin >= 20 ? 'text-emerald-400' : margin >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>{margin.toFixed(1)}% (${(billRate-costRate).toFixed(2)}/hr)</span>
              </div>
            </div>
          )}
          <div>
            <label className={`block text-xs ${THEME.textMuted} mb-1`}>Notes</label>
            <input value={form.notes} onChange={e => setForm(p=>({...p,notes:e.target.value}))}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" placeholder="Optional..." />
          </div>
        </div>
        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${THEME.glassBorder} bg-white/[0.02]`}>
          <button onClick={onClose} className={`px-4 py-2 text-sm font-medium ${THEME.textMuted} hover:text-white`}>Cancel</button>
          <button onClick={handleSave} disabled={!form.team_member_id||!form.client_id||!form.rate||isSaving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50">
            {isSaving && <RefreshCw size={14} className="animate-spin" />}{editingRate ? 'Save Changes' : 'Add Rate'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ COST OVERRIDE MODAL ============
function CostOverrideModal({ isOpen, onClose, onSave, teamMembers, clients, selectedMonth }: {
  isOpen: boolean; onClose: () => void; onSave: (data: any) => Promise<void>
  teamMembers: TeamMember[]; clients: Client[]; selectedMonth: string
}) {
  const [form, setForm] = useState({ team_member_id: '', client_id: '', fixed_amount: '', notes: '' })
  const [isSaving, setIsSaving] = useState(false)
  useEffect(() => { setForm({ team_member_id: '', client_id: '', fixed_amount: '', notes: '' }) }, [isOpen])

  const lumpSumMembers = teamMembers.filter(m => m.cost_type === 'lump_sum' && m.status === 'active')

  const handleSave = async () => {
    if (!form.team_member_id || !form.client_id || !form.fixed_amount) return
    setIsSaving(true)
    try { await onSave({ team_member_id: form.team_member_id, client_id: form.client_id, month: selectedMonth, fixed_amount: parseFloat(form.fixed_amount)||0, notes: form.notes||null }); onClose() } finally { setIsSaving(false) }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-2xl w-full max-w-lg`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
          <div>
            <h3 className={`text-lg font-semibold ${THEME.textPrimary}`}>Cost Override</h3>
            <p className={`text-xs ${THEME.textMuted}`}>Override auto-distribution for {formatMonth(selectedMonth)}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/[0.05] rounded-lg"><X size={20} className={THEME.textMuted} /></button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className={`block text-xs ${THEME.textMuted} mb-1`}>Team Member (Fixed-Cost Only) *</label>
            <select value={form.team_member_id} onChange={e => setForm(p=>({...p,team_member_id:e.target.value}))}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white">
              <option value="">Select...</option>
              {lumpSumMembers.map(m=><option key={m.id} value={m.id}>{m.name} ({formatCurrency(m.cost_amount||0)}/mo)</option>)}
            </select>
          </div>
          <div>
            <label className={`block text-xs ${THEME.textMuted} mb-1`}>Client *</label>
            <select value={form.client_id} onChange={e => setForm(p=>({...p,client_id:e.target.value}))}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white">
              <option value="">Select...</option>
              {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={`block text-xs ${THEME.textMuted} mb-1`}>Fixed Amount ($) *</label>
            <input type="number" value={form.fixed_amount} onChange={e => setForm(p=>({...p,fixed_amount:e.target.value}))}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" placeholder="20000" />
            <p className={`text-xs ${THEME.textDim} mt-1`}>Overrides auto-calculated allocation for this month only</p>
          </div>
          <div>
            <label className={`block text-xs ${THEME.textMuted} mb-1`}>Notes</label>
            <input value={form.notes} onChange={e => setForm(p=>({...p,notes:e.target.value}))}
              className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" placeholder="Per CEO request..." />
          </div>
        </div>
        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${THEME.glassBorder} bg-white/[0.02]`}>
          <button onClick={onClose} className={`px-4 py-2 text-sm font-medium ${THEME.textMuted} hover:text-white`}>Cancel</button>
          <button onClick={handleSave} disabled={!form.team_member_id||!form.client_id||!form.fixed_amount||isSaving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
            {isSaving && <RefreshCw size={14} className="animate-spin" />}Set Override
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
    cost_type: 'hourly' as 'hourly' | 'lump_sum', cost_amount: '',
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (editingMember) {
      setForm({
        name: editingMember.name||'', email: editingMember.email||'', phone: editingMember.phone||'',
        role: editingMember.role||'', status: editingMember.status||'active',
        employment_type: editingMember.employment_type||'contractor', start_date: editingMember.start_date||'',
        entity_name: editingMember.entity_name||'', entity_type: editingMember.entity_type||'',
        address: editingMember.address||'', bank_name: editingMember.bank_name||'',
        account_type: editingMember.account_type||'', routing_number: editingMember.routing_number||'',
        account_number: editingMember.account_number||'', payment_method: editingMember.payment_method||'',
        cost_type: editingMember.cost_type||'hourly', cost_amount: editingMember.cost_amount?.toString()||'',
      })
    } else {
      setForm({ name:'',email:'',phone:'',role:'',status:'active',employment_type:'contractor',start_date:'',
        entity_name:'',entity_type:'',address:'',bank_name:'',account_type:'',routing_number:'',account_number:'',
        payment_method:'',cost_type:'hourly',cost_amount:'' })
    }
  }, [editingMember, isOpen])

  const handleSave = async () => {
    if (!form.name || !form.email) return
    setIsSaving(true)
    try { await onSave({ ...form, cost_amount: parseFloat(form.cost_amount)||0 }); onClose() } finally { setIsSaving(false) }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-2xl w-full max-w-2xl my-8 flex flex-col max-h-[90vh]`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
          <h3 className={`text-lg font-semibold ${THEME.textPrimary}`}>{editingMember ? 'Edit Team Member' : 'Add Team Member'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/[0.05] rounded-lg"><X size={20} className={THEME.textMuted} /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Full Name *</label>
              <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" /></div>
            <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Email *</label>
              <input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Phone</label>
              <input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" /></div>
            <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Role / Title</label>
              <input value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))} className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Employment Type</label>
              <select value={form.employment_type} onChange={e=>setForm(p=>({...p,employment_type:e.target.value}))}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white">
                {EMPLOYMENT_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
              </select></div>
            <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Status</label>
              <select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white">
                {STATUS_OPTIONS.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
              </select></div>
            <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Start Date</label>
              <input type="date" value={form.start_date} onChange={e=>setForm(p=>({...p,start_date:e.target.value}))}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" /></div>
          </div>

          {/* Cost Structure */}
          <div className={`pt-4 border-t ${THEME.glassBorder}`}>
            <h4 className={`text-sm font-medium ${THEME.textSecondary} mb-3`}>Cost Structure — What You Pay Them</h4>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {COST_TYPES.map(t=>(
                <button key={t.id} type="button" onClick={()=>setForm(p=>({...p,cost_type:t.id as any}))}
                  className={`p-3 rounded-lg border text-left transition-all ${form.cost_type===t.id?'border-orange-500 bg-orange-500/10':'border-white/[0.08] hover:border-white/[0.15]'}`}>
                  <p className={`text-sm font-medium ${form.cost_type===t.id?'text-orange-400':THEME.textPrimary}`}>{t.label}</p>
                  <p className={`text-xs ${THEME.textDim} mt-0.5`}>{t.description}</p>
                </button>
              ))}
            </div>
            <div>
              <label className={`block text-xs ${THEME.textMuted} mb-1`}>{form.cost_type==='hourly'?'Hourly Rate ($/hr)':'Monthly Amount ($/mo)'}</label>
              <input type="number" value={form.cost_amount} onChange={e=>setForm(p=>({...p,cost_amount:e.target.value}))}
                className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
                placeholder={form.cost_type==='hourly'?'75':'35000'} />
              {form.cost_type==='lump_sum' && form.cost_amount && (
                <p className={`text-xs ${THEME.textDim} mt-1`}>Effective rate: ~${(parseFloat(form.cost_amount)/172).toFixed(2)}/hr (172 hrs/mo)</p>
              )}
            </div>
          </div>

          {form.employment_type === 'contractor' && (
            <>
              <div className={`pt-4 border-t ${THEME.glassBorder}`}>
                <h4 className={`text-sm font-medium ${THEME.textSecondary} mb-3`}>Entity Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Entity Name</label>
                    <input value={form.entity_name} onChange={e=>setForm(p=>({...p,entity_name:e.target.value}))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" placeholder="LLC or DBA" /></div>
                  <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Entity Type</label>
                    <select value={form.entity_type} onChange={e=>setForm(p=>({...p,entity_type:e.target.value}))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white">
                      <option value="">Select...</option>{ENTITY_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
                    </select></div>
                </div>
                <div className="mt-4"><label className={`block text-xs ${THEME.textMuted} mb-1`}>Address</label>
                  <input value={form.address} onChange={e=>setForm(p=>({...p,address:e.target.value}))}
                    className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" /></div>
              </div>
              <div className={`pt-4 border-t ${THEME.glassBorder}`}>
                <h4 className={`text-sm font-medium ${THEME.textSecondary} mb-3`}>Payment Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Bank Name</label>
                    <input value={form.bank_name} onChange={e=>setForm(p=>({...p,bank_name:e.target.value}))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white" /></div>
                  <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Account Type</label>
                    <select value={form.account_type} onChange={e=>setForm(p=>({...p,account_type:e.target.value}))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white">
                      <option value="">Select...</option>{ACCOUNT_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
                    </select></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Routing Number</label>
                    <input value={form.routing_number} onChange={e=>setForm(p=>({...p,routing_number:e.target.value}))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white font-mono" /></div>
                  <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Account Number</label>
                    <input value={form.account_number} onChange={e=>setForm(p=>({...p,account_number:e.target.value}))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white font-mono" /></div>
                </div>
                <div className="mt-4"><label className={`block text-xs ${THEME.textMuted} mb-1`}>Payment Method</label>
                  <select value={form.payment_method} onChange={e=>setForm(p=>({...p,payment_method:e.target.value}))}
                    className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white">
                    <option value="">Select...</option>{PAYMENT_METHODS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
                  </select></div>
              </div>
            </>
          )}
        </div>
        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${THEME.glassBorder} bg-white/[0.02]`}>
          <button onClick={onClose} className={`px-4 py-2 text-sm font-medium ${THEME.textMuted} hover:text-white`}>Cancel</button>
          <button onClick={handleSave} disabled={!form.name||!form.email||isSaving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50">
            {isSaving && <RefreshCw size={14} className="animate-spin" />}{editingMember ? 'Save Changes' : 'Add Member'}
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
  const [billRates, setBillRates] = useState<BillRate[]>([])
  const [costOverrides, setCostOverrides] = useState<CostOverride[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])

  const [activeTab, setActiveTab] = useState<'directory' | 'rates' | 'profitability'>('directory')
  const [searchQuery, setSearchQuery] = useState('')
  const [employmentFilter, setEmploymentFilter] = useState<'all' | 'employee' | 'contractor'>('all')
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [profitView, setProfitView] = useState<'summary' | 'revenue' | 'cost'>('summary')

  const [toasts, setToasts] = useState<Toast[]>([])
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const [showMemberModal, setShowMemberModal] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [showRateModal, setShowRateModal] = useState(false)
  const [editingRate, setEditingRate] = useState<BillRate | null>(null)
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [selectedMemberDetail, setSelectedMemberDetail] = useState<TeamMember | null>(null)

  // ---- DATA LOADING ----
  useEffect(() => {
    async function loadData() {
      try {
        const result = await getCurrentUser()
        const user = result?.user
        if (!user) { setLoading(false); return }
        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
        if (!profile?.company_id) { setLoading(false); return }
        setCompanyId(profile.company_id)

        const [membersRes, clientsRes, projectsRes, billRatesRes, costOverridesRes, timeRes] = await Promise.all([
          supabase.from('team_members').select('*').eq('company_id', profile.company_id).order('name'),
          supabase.from('clients').select('id, name').eq('company_id', profile.company_id).order('name'),
          supabase.from('projects').select('id, name, client_id, status, budget').eq('company_id', profile.company_id),
          supabase.from('bill_rates').select('*').eq('company_id', profile.company_id),
          supabase.from('cost_overrides').select('*').eq('company_id', profile.company_id),
          supabase.from('time_entries').select('id, contractor_id, project_id, hours, billable_hours, is_billable, date').eq('company_id', profile.company_id),
        ])

        const clientMap = new Map((clientsRes.data || []).map(c => [c.id, c.name]))
        const memberMap = new Map((membersRes.data || []).map(m => [m.id, m.name]))

        setTeamMembers(membersRes.data || [])
        setClients(clientsRes.data || [])
        setProjects((projectsRes.data || []).map(p => ({ ...p, client_name: clientMap.get(p.client_id) || '' })))
        setBillRates((billRatesRes.data || []).map(r => ({
          ...r, team_member_name: memberMap.get(r.team_member_id) || 'Unknown', client_name: clientMap.get(r.client_id) || 'Unknown',
        })))
        setCostOverrides((costOverridesRes.data || []).map(o => ({
          ...o, team_member_name: memberMap.get(o.team_member_id) || 'Unknown', client_name: clientMap.get(o.client_id) || 'Unknown',
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

  // ---- COMPUTED ----
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

  const summary = useMemo(() => {
    const active = teamMembers.filter(m => m.status === 'active')
    return {
      total: teamMembers.length, active: active.length,
      employees: teamMembers.filter(m => m.employment_type === 'employee').length,
      contractors: teamMembers.filter(m => m.employment_type === 'contractor').length,
      activeRates: billRates.filter(r => r.is_active).length,
    }
  }, [teamMembers, billRates])

  // ---- PROFITABILITY ENGINE ----
  const profitabilityData = useMemo(() => {
    const monthEntries = timeEntries.filter(t => t.date?.startsWith(selectedMonth))
    const monthOverrides = costOverrides.filter(o => o.month === selectedMonth)
    const projectClientMap = new Map(projects.map(p => [p.id, p.client_id || '']))

    return teamMembers.map(member => {
      const memberTime = monthEntries.filter(t => t.contractor_id === member.id)
      const totalHours = memberTime.reduce((sum, t) => sum + (t.hours || 0), 0)
      if (totalHours === 0 && !member.cost_amount) return null

      // Group hours by client
      const hoursByClient: Record<string, number> = {}
      memberTime.forEach(t => {
        const clientId = projectClientMap.get(t.project_id) || 'unknown'
        hoursByClient[clientId] = (hoursByClient[clientId] || 0) + (t.hours || 0)
      })

      // REVENUE by client = hours × bill rate
      const revenueByClient: Record<string, number> = {}
      let totalRevenue = 0
      Object.entries(hoursByClient).forEach(([clientId, hours]) => {
        const rate = billRates.find(r => r.team_member_id === member.id && r.client_id === clientId && r.is_active)
        const rev = hours * (rate?.rate || 0)
        revenueByClient[clientId] = rev
        totalRevenue += rev
      })

      // COST by client
      const costByClient: Record<string, number> = {}
      let totalCost = 0

      if (member.cost_type === 'hourly') {
        Object.entries(hoursByClient).forEach(([clientId, hours]) => {
          const cost = hours * (member.cost_amount || 0)
          costByClient[clientId] = cost
          totalCost += cost
        })
      } else {
        // Lump sum: check overrides first, then auto-distribute remainder by hours
        const memberOverrides = monthOverrides.filter(o => o.team_member_id === member.id)
        const overrideMap = new Map(memberOverrides.map(o => [o.client_id, o.fixed_amount]))
        let overrideTotal = 0
        const overriddenClients = new Set<string>()

        memberOverrides.forEach(o => {
          costByClient[o.client_id] = o.fixed_amount
          overrideTotal += o.fixed_amount
          overriddenClients.add(o.client_id)
        })

        const remainingCost = (member.cost_amount || 0) - overrideTotal
        const nonOverrideHours = Object.entries(hoursByClient)
          .filter(([cid]) => !overriddenClients.has(cid))
          .reduce((sum, [, h]) => sum + h, 0)

        Object.entries(hoursByClient).forEach(([clientId, hours]) => {
          if (!overriddenClients.has(clientId) && nonOverrideHours > 0) {
            costByClient[clientId] = (hours / nonOverrideHours) * remainingCost
          }
        })

        totalCost = member.cost_amount || 0
      }

      const margin = totalRevenue - totalCost
      const marginPct = totalRevenue > 0 ? (margin / totalRevenue) * 100 : (totalCost > 0 ? -100 : 0)

      return { id: member.id, name: member.name, costType: member.cost_type, hours: totalHours,
        cost: totalCost, revenue: totalRevenue, margin, marginPct,
        hoursByClient, revenueByClient, costByClient }
    }).filter(Boolean) as Array<{
      id: string; name: string; costType: string; hours: number; cost: number; revenue: number
      margin: number; marginPct: number
      hoursByClient: Record<string, number>; revenueByClient: Record<string, number>; costByClient: Record<string, number>
    }>
  }, [teamMembers, billRates, costOverrides, timeEntries, projects, selectedMonth])

  const profitClients = useMemo(() => {
    const ids = new Set<string>()
    profitabilityData.forEach(m => {
      Object.keys(m.revenueByClient).forEach(id => ids.add(id))
      Object.keys(m.costByClient).forEach(id => ids.add(id))
    })
    return Array.from(ids).map(id => ({ id, name: clients.find(c => c.id === id)?.name || 'Unknown' })).sort((a, b) => a.name.localeCompare(b.name))
  }, [profitabilityData, clients])

  const profitTotals = useMemo(() => {
    const c = profitabilityData.reduce((s, m) => s + m.cost, 0)
    const r = profitabilityData.reduce((s, m) => s + m.revenue, 0)
    return { cost: c, revenue: r, margin: r - c, marginPct: r > 0 ? ((r - c) / r * 100) : 0 }
  }, [profitabilityData])

  // ---- HANDLERS ----
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
    } catch (error: any) { addToast('error', `Failed to save: ${error.message}`); throw error }
  }

  const handleSaveRate = async (data: any) => {
    if (!companyId) return
    try {
      const memberName = teamMembers.find(m => m.id === data.team_member_id)?.name
      const clientName = clients.find(c => c.id === data.client_id)?.name
      if (editingRate) {
        const { error } = await supabase.from('bill_rates').update({ rate: data.rate, notes: data.notes }).eq('id', editingRate.id)
        if (error) throw error
        setBillRates(prev => prev.map(r => r.id === editingRate.id ? { ...r, rate: data.rate, notes: data.notes, team_member_name: memberName, client_name: clientName } : r))
        addToast('success', 'Bill rate updated')
      } else {
        const { data: newRate, error } = await supabase.from('bill_rates').insert({ company_id: companyId, ...data }).select().single()
        if (error) throw error
        setBillRates(prev => [...prev, { ...newRate, team_member_name: memberName, client_name: clientName }])
        addToast('success', 'Bill rate added')
      }
      setEditingRate(null)
    } catch (error: any) { addToast('error', `Failed to save: ${error.message}`); throw error }
  }

  const handleDeleteRate = async (id: string) => {
    try {
      const { error } = await supabase.from('bill_rates').delete().eq('id', id)
      if (error) throw error
      setBillRates(prev => prev.filter(r => r.id !== id))
      addToast('success', 'Bill rate removed')
    } catch (error: any) { addToast('error', `Failed to delete: ${error.message}`) }
  }

  const handleSaveOverride = async (data: any) => {
    if (!companyId) return
    try {
      const { data: newOverride, error } = await supabase.from('cost_overrides')
        .upsert({ company_id: companyId, ...data }, { onConflict: 'company_id,team_member_id,client_id,month' })
        .select().single()
      if (error) throw error
      const memberName = teamMembers.find(m => m.id === data.team_member_id)?.name
      const clientName = clients.find(c => c.id === data.client_id)?.name
      setCostOverrides(prev => {
        const idx = prev.findIndex(o => o.team_member_id === data.team_member_id && o.client_id === data.client_id && o.month === data.month)
        const enriched = { ...newOverride, team_member_name: memberName, client_name: clientName }
        if (idx >= 0) { const u = [...prev]; u[idx] = enriched; return u }
        return [...prev, enriched]
      })
      addToast('success', 'Cost override saved')
    } catch (error: any) { addToast('error', `Failed to save: ${error.message}`); throw error }
  }

  const handleDeleteOverride = async (id: string) => {
    try {
      const { error } = await supabase.from('cost_overrides').delete().eq('id', id)
      if (error) throw error
      setCostOverrides(prev => prev.filter(o => o.id !== id))
      addToast('success', 'Override removed')
    } catch (error: any) { addToast('error', `Failed to delete: ${error.message}`) }
  }

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Type', 'Entity', 'Status', 'Role', 'Cost Type', 'Cost Amount']
    const rows = teamMembers.map(m => [m.name, m.email, m.employment_type, m.entity_name, m.status, m.role, m.cost_type, m.cost_amount])
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c || ''}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `team-${new Date().toISOString().split('T')[0]}.csv`; a.click()
    addToast('success', 'Export complete')
  }

  const prevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
  }
  const nextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
        <p className={`text-sm ${THEME.textMuted}`}>Loading team...</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-xl font-semibold ${THEME.textPrimary}`}>Team</h1>
          <p className={`text-sm ${THEME.textMuted} mt-1`}>Manage team members, rates, and profitability</p>
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
          {activeTab === 'rates' && (
            <button onClick={() => { setEditingRate(null); setShowRateModal(true) }} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 shadow-lg shadow-emerald-500/20">
              <Plus size={14} /> Add Bill Rate
            </button>
          )}
          {activeTab === 'profitability' && (
            <button onClick={() => setShowOverrideModal(true)} className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 shadow-lg shadow-orange-500/20">
              <Edit2 size={14} /> Cost Override
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-1.5 inline-flex gap-1`}>
        {([
          { id: 'directory' as const, label: 'Directory', icon: Users },
          { id: 'rates' as const, label: 'Rates', icon: DollarSign },
          { id: 'profitability' as const, label: 'Profitability', icon: BarChart3 },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-emerald-500/20 text-emerald-400' : `${THEME.textMuted} hover:text-white hover:bg-white/[0.05]`
            }`}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
          <p className={`text-xs ${THEME.textMuted} uppercase tracking-wider`}>Active Bill Rates</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{summary.activeRates}</p>
        </div>
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-4`}>
          <p className={`text-xs ${THEME.textMuted} uppercase tracking-wider`}>GM% ({formatMonth(selectedMonth).split(' ')[0]})</p>
          <p className={`text-2xl font-bold mt-1 ${profitTotals.marginPct >= 20 ? 'text-emerald-400' : profitTotals.marginPct >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>
            {profitTotals.revenue > 0 ? `${profitTotals.marginPct.toFixed(1)}%` : '—'}
          </p>
        </div>
      </div>

      {/* ============ DIRECTORY TAB ============ */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${THEME.textDim}`} />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name or email..."
                className={`w-full pl-9 pr-4 py-2 bg-white/[0.05] border ${THEME.glassBorder} rounded-lg text-sm text-white placeholder:text-slate-500`} />
            </div>
            <div className="flex gap-1">
              {(['all', 'employee', 'contractor'] as const).map(f => (
                <button key={f} onClick={() => setEmploymentFilter(f)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${employmentFilter === f ? 'bg-white/[0.1] text-white' : `${THEME.textDim} hover:text-white`}`}>
                  {f === 'all' ? 'All' : f === 'employee' ? 'W-2' : '1099'}
                </button>
              ))}
            </div>
          </div>

          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
            <table className="w-full text-sm">
              <thead>
                <tr className={`bg-white/[0.02] border-b ${THEME.glassBorder}`}>
                  <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium`}>Name</th>
                  <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium`}>Type</th>
                  <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium`}>Role</th>
                  <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Cost</th>
                  <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium`}>Status</th>
                  <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium w-20`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map(m => {
                  const stStyle = getStatusStyle(m.status)
                  const empStyle = getEmploymentStyle(m.employment_type)
                  const rateCount = billRates.filter(r => r.team_member_id === m.id && r.is_active).length
                  return (
                    <tr key={m.id} className="border-b border-white/[0.05] hover:bg-white/[0.03] cursor-pointer"
                      onClick={() => setSelectedMemberDetail(m)}>
                      <td className="px-4 py-3">
                        <p className={`font-medium ${THEME.textPrimary}`}>{m.name}</p>
                        <p className={`text-xs ${THEME.textDim}`}>{m.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${empStyle.bg} ${empStyle.text}`}>
                          {m.employment_type === 'employee' ? 'W-2' : '1099'}
                        </span>
                      </td>
                      <td className={`px-4 py-3 ${THEME.textSecondary}`}>{m.role || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-orange-400 font-medium">
                          {m.cost_amount ? (m.cost_type === 'hourly' ? `$${m.cost_amount}/hr` : `${formatCurrency(m.cost_amount)}/mo`) : '—'}
                        </span>
                        {rateCount > 0 && <p className={`text-xs ${THEME.textDim}`}>{rateCount} bill rate{rateCount > 1 ? 's' : ''}</p>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${stStyle.bg} ${stStyle.text}`}>{m.status}</span>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center">
                          <button onClick={() => { setEditingMember(m); setShowMemberModal(true) }} className="p-1.5 rounded hover:bg-white/[0.08] text-slate-500 hover:text-slate-300">
                            <Edit2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredMembers.length === 0 && (
                  <tr><td colSpan={6} className={`px-4 py-12 text-center ${THEME.textMuted}`}>No team members found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============ RATES TAB ============ */}
      {activeTab === 'rates' && (
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
          <div className={`px-6 py-4 border-b ${THEME.glassBorder}`}>
            <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Bill Rate Card</h3>
            <p className={`text-xs ${THEME.textMuted} mt-0.5`}>What you charge each client for your team&#39;s time</p>
          </div>
          {billRates.filter(r => r.is_active).length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className={`bg-white/[0.02] border-b ${THEME.glassBorder}`}>
                  <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium`}>Team Member</th>
                  <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium`}>Client</th>
                  <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Cost Rate</th>
                  <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Bill Rate</th>
                  <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Margin</th>
                  <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium w-20`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {billRates.filter(r => r.is_active).map(r => {
                  const member = teamMembers.find(m => m.id === r.team_member_id)
                  const costRate = member ? (member.cost_type === 'hourly' ? (member.cost_amount||0) : ((member.cost_amount||0)/172)) : 0
                  const margin = r.rate > 0 ? ((r.rate - costRate) / r.rate * 100) : 0
                  const spread = r.rate - costRate
                  return (
                    <tr key={r.id} className="border-b border-white/[0.05] hover:bg-white/[0.03]">
                      <td className={`px-4 py-3 font-medium ${THEME.textPrimary}`}>
                        {r.team_member_name}
                        <p className={`text-xs ${THEME.textDim}`}>{member?.cost_type === 'lump_sum' ? 'Fixed Monthly' : 'T&M'}</p>
                      </td>
                      <td className={`px-4 py-3 ${THEME.textSecondary}`}>{r.client_name}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-orange-400">${costRate.toFixed(2)}/hr</span>
                        {member?.cost_type === 'lump_sum' && <p className={`text-xs ${THEME.textDim}`}>{formatCurrency(member.cost_amount||0)}/mo</p>}
                      </td>
                      <td className="px-4 py-3 text-right"><span className="text-emerald-400 font-medium">${r.rate}/hr</span></td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${margin >= 20 ? 'text-emerald-400' : margin >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>{margin.toFixed(0)}%</span>
                        <p className={`text-xs ${spread >= 0 ? 'text-emerald-400/60' : 'text-rose-400/60'}`}>${spread.toFixed(2)}/hr</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setEditingRate(r); setShowRateModal(true) }} className="p-1.5 rounded hover:bg-white/[0.08] text-slate-500 hover:text-slate-300"><Edit2 size={14} /></button>
                          <button onClick={() => handleDeleteRate(r.id)} className="p-1.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className={`px-6 py-12 text-center ${THEME.textMuted}`}>
              <DollarSign size={48} className="mx-auto text-slate-600 mb-4" />
              <p>No bill rates configured yet</p>
              <p className={`text-xs ${THEME.textDim} mt-1`}>Add rates to start tracking profitability</p>
              <button onClick={() => { setEditingRate(null); setShowRateModal(true) }}
                className="mt-4 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-500/30">
                Add First Bill Rate
              </button>
            </div>
          )}
        </div>
      )}

      {/* ============ PROFITABILITY TAB ============ */}
      {activeTab === 'profitability' && (
        <div className="space-y-6">
          {/* Month Navigator + View Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={prevMonth} className={`p-2 rounded-lg border ${THEME.glassBorder} hover:bg-white/[0.05] ${THEME.textMuted}`}>
                <ChevronDown size={16} className="rotate-90" />
              </button>
              <span className={`text-lg font-semibold ${THEME.textPrimary}`}>{formatMonth(selectedMonth)}</span>
              <button onClick={nextMonth} className={`p-2 rounded-lg border ${THEME.glassBorder} hover:bg-white/[0.05] ${THEME.textMuted}`}>
                <ChevronDown size={16} className="-rotate-90" />
              </button>
            </div>
            <div className="flex gap-1 bg-white/[0.03] rounded-lg p-1">
              {([
                { id: 'summary' as const, label: 'Summary', color: 'text-emerald-400' },
                { id: 'revenue' as const, label: 'Revenue', color: 'text-blue-400' },
                { id: 'cost' as const, label: 'Cost', color: 'text-orange-400' },
              ]).map(v => (
                <button key={v.id} onClick={() => setProfitView(v.id)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${profitView === v.id ? `bg-white/[0.1] ${v.color}` : `${THEME.textDim} hover:text-white`}`}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          {profitabilityData.length > 0 && (
            <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-6`}>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profitabilityData} margin={{ left: 20, right: 20 }}>
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => formatCompactCurrency(v)} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} labelStyle={{ color: '#fff' }}
                      formatter={(value: number, name: string) => [formatCurrency(value), name === 'cost' ? 'Cost' : 'Revenue']} cursor={false} />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar dataKey="cost" name="Cost" fill={CHART_COLORS.cost} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS.revenue} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* SUMMARY VIEW (Green) */}
          {profitView === 'summary' && profitabilityData.length > 0 && (
            <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
              <div className={`px-6 py-4 border-b ${THEME.glassBorder} flex items-center gap-2`}>
                <div className="w-3 h-3 rounded bg-emerald-400" />
                <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Direct Cost Analysis — {formatMonth(selectedMonth)}</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className={`bg-white/[0.02] border-b ${THEME.glassBorder}`}>
                    <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium`}>Name</th>
                    <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Hours</th>
                    <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Total Cost</th>
                    <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Total Rev</th>
                    <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Delta</th>
                    <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>GM %</th>
                  </tr>
                </thead>
                <tbody>
                  {profitabilityData.map(row => (
                    <tr key={row.id} className="border-b border-white/[0.05]">
                      <td className={`px-4 py-3 font-medium ${THEME.textPrimary}`}>
                        {row.name}
                        <span className={`ml-2 text-xs ${THEME.textDim}`}>{row.costType === 'lump_sum' ? 'Fixed' : 'T&M'}</span>
                      </td>
                      <td className={`px-4 py-3 text-right ${THEME.textSecondary}`}>{row.hours.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-orange-400">{formatCurrencyDecimal(row.cost)}</td>
                      <td className="px-4 py-3 text-right text-blue-400">{formatCurrencyDecimal(row.revenue)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${row.margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrencyDecimal(row.margin)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${row.marginPct >= 20 ? 'text-emerald-400' : row.marginPct >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>{row.marginPct.toFixed(1)}%</td>
                    </tr>
                  ))}
                  <tr className={`bg-white/[0.03] border-t-2 ${THEME.glassBorder} font-bold`}>
                    <td className={`px-4 py-3 ${THEME.textPrimary}`}>Total</td>
                    <td className={`px-4 py-3 text-right ${THEME.textSecondary}`}>{profitabilityData.reduce((s,m)=>s+m.hours,0).toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-orange-400">{formatCurrencyDecimal(profitTotals.cost)}</td>
                    <td className="px-4 py-3 text-right text-blue-400">{formatCurrencyDecimal(profitTotals.revenue)}</td>
                    <td className={`px-4 py-3 text-right ${profitTotals.margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrencyDecimal(profitTotals.margin)}</td>
                    <td className={`px-4 py-3 text-right ${profitTotals.marginPct >= 20 ? 'text-emerald-400' : 'text-amber-400'}`}>{profitTotals.marginPct.toFixed(1)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* REVENUE VIEW (Blue) */}
          {profitView === 'revenue' && profitabilityData.length > 0 && (
            <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
              <div className={`px-6 py-4 border-b ${THEME.glassBorder} flex items-center gap-2`}>
                <div className="w-3 h-3 rounded bg-blue-400" />
                <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Revenue by Client — {formatMonth(selectedMonth)}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`bg-white/[0.02] border-b ${THEME.glassBorder}`}>
                      <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium sticky left-0 bg-slate-900/95 z-10`}>Name</th>
                      {profitClients.map(c => (
                        <th key={c.id} className={`px-4 py-3 text-right ${THEME.textDim} font-medium whitespace-nowrap`}>{c.name}</th>
                      ))}
                      <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitabilityData.map(row => (
                      <tr key={row.id} className="border-b border-white/[0.05]">
                        <td className={`px-4 py-3 font-medium ${THEME.textPrimary} sticky left-0 bg-slate-900/95 z-10`}>{row.name}</td>
                        {profitClients.map(c => {
                          const val = row.revenueByClient[c.id] || 0
                          return <td key={c.id} className={`px-4 py-3 text-right ${val > 0 ? 'text-blue-400' : THEME.textDim}`}>{val > 0 ? formatCurrencyDecimal(val) : '—'}</td>
                        })}
                        <td className="px-4 py-3 text-right text-blue-400 font-medium">{formatCurrencyDecimal(row.revenue)}</td>
                      </tr>
                    ))}
                    <tr className={`bg-white/[0.03] border-t-2 ${THEME.glassBorder} font-bold`}>
                      <td className={`px-4 py-3 ${THEME.textPrimary} sticky left-0 bg-slate-900/95 z-10`}>Total</td>
                      {profitClients.map(c => {
                        const total = profitabilityData.reduce((s, m) => s + (m.revenueByClient[c.id] || 0), 0)
                        return <td key={c.id} className="px-4 py-3 text-right text-blue-400">{formatCurrencyDecimal(total)}</td>
                      })}
                      <td className="px-4 py-3 text-right text-blue-400 font-bold">{formatCurrencyDecimal(profitTotals.revenue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* COST VIEW (Orange) */}
          {profitView === 'cost' && profitabilityData.length > 0 && (
            <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
              <div className={`px-6 py-4 border-b ${THEME.glassBorder} flex items-center gap-2`}>
                <div className="w-3 h-3 rounded bg-orange-400" />
                <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Cost by Client — {formatMonth(selectedMonth)}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`bg-white/[0.02] border-b ${THEME.glassBorder}`}>
                      <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium sticky left-0 bg-slate-900/95 z-10`}>Name</th>
                      {profitClients.map(c => (
                        <th key={c.id} className={`px-4 py-3 text-right ${THEME.textDim} font-medium whitespace-nowrap`}>{c.name}</th>
                      ))}
                      <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitabilityData.map(row => (
                      <tr key={row.id} className="border-b border-white/[0.05]">
                        <td className={`px-4 py-3 font-medium ${THEME.textPrimary} sticky left-0 bg-slate-900/95 z-10`}>{row.name}</td>
                        {profitClients.map(c => {
                          const val = row.costByClient[c.id] || 0
                          const isOverride = costOverrides.some(o => o.team_member_id === row.id && o.client_id === c.id && o.month === selectedMonth)
                          return (
                            <td key={c.id} className={`px-4 py-3 text-right ${val > 0 ? 'text-orange-400' : THEME.textDim}`}>
                              {val > 0 ? formatCurrencyDecimal(val) : '—'}
                              {isOverride && <span className="ml-1 text-amber-500 text-xs" title="Manual override">⚡</span>}
                            </td>
                          )
                        })}
                        <td className="px-4 py-3 text-right text-orange-400 font-medium">{formatCurrencyDecimal(row.cost)}</td>
                      </tr>
                    ))}
                    <tr className={`bg-white/[0.03] border-t-2 ${THEME.glassBorder} font-bold`}>
                      <td className={`px-4 py-3 ${THEME.textPrimary} sticky left-0 bg-slate-900/95 z-10`}>Total</td>
                      {profitClients.map(c => {
                        const total = profitabilityData.reduce((s, m) => s + (m.costByClient[c.id] || 0), 0)
                        return <td key={c.id} className="px-4 py-3 text-right text-orange-400">{formatCurrencyDecimal(total)}</td>
                      })}
                      <td className="px-4 py-3 text-right text-orange-400 font-bold">{formatCurrencyDecimal(profitTotals.cost)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Active overrides for this month */}
              {costOverrides.filter(o => o.month === selectedMonth).length > 0 && (
                <div className={`px-6 py-4 border-t ${THEME.glassBorder}`}>
                  <p className={`text-xs font-medium ${THEME.textMuted} mb-2`}>⚡ Active Overrides — {formatMonth(selectedMonth)}</p>
                  <div className="flex flex-wrap gap-2">
                    {costOverrides.filter(o => o.month === selectedMonth).map(o => (
                      <div key={o.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <span className="text-xs text-amber-400">{o.team_member_name} → {o.client_name}: {formatCurrency(o.fixed_amount)}</span>
                        <button onClick={() => handleDeleteOverride(o.id)} className="text-amber-500/50 hover:text-rose-400"><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {profitabilityData.length === 0 && (
            <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-12 text-center`}>
              <BarChart3 size={48} className="mx-auto text-slate-600 mb-4" />
              <p className={THEME.textMuted}>No data for {formatMonth(selectedMonth)}</p>
              <p className={`text-xs ${THEME.textDim} mt-1`}>Time entries and bill rates needed to calculate profitability</p>
            </div>
          )}
        </div>
      )}

      {/* ============ MODALS ============ */}
      <MemberModal isOpen={showMemberModal} onClose={() => { setShowMemberModal(false); setEditingMember(null) }}
        onSave={handleSaveMember} editingMember={editingMember} />
      <BillRateModal isOpen={showRateModal} onClose={() => { setShowRateModal(false); setEditingRate(null) }}
        onSave={handleSaveRate} editingRate={editingRate} teamMembers={teamMembers} clients={clients} />
      <CostOverrideModal isOpen={showOverrideModal} onClose={() => setShowOverrideModal(false)}
        onSave={handleSaveOverride} teamMembers={teamMembers} clients={clients} selectedMonth={selectedMonth} />
      {selectedMemberDetail && (
        <MemberDetailFlyout member={selectedMemberDetail} billRates={billRates} clients={clients}
          onClose={() => setSelectedMemberDetail(null)}
          onEdit={() => { setEditingMember(selectedMemberDetail); setShowMemberModal(true); setSelectedMemberDetail(null) }} />
      )}
    </div>
  )
}
