'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search, Filter, Download, Plus, Edit2, X, Users, Mail, Phone,
  Eye, EyeOff, Briefcase, DollarSign, Trash2, BarChart3, FileText,
  Layers, Building2, MapPin, CreditCard, Upload, ExternalLink,
  Calendar, Clock, CheckCircle, AlertCircle, RefreshCw, ChevronRight
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
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
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg backdrop-blur-xl border ${
            toast.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
            toast.type === 'error' ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' :
            'bg-blue-500/20 border-blue-500/30 text-blue-400'
          }`}
        >
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
  services: string[]
}

interface ProjectAssignment {
  id: string
  team_member_id: string
  project_id: string
  project_name: string
  client_name: string
  service: string | null
  payment_type: 'lump_sum' | 'tm'
  rate: number
}

interface Project {
  id: string
  name: string
  client_id: string | null
  client_name: string | null
  status: string
}

interface TimeEntry {
  id: string
  team_member_id: string
  project_id: string
  hours: number
  date: string
}

interface TeamDocument {
  id: string
  team_member_id: string
  document_type: string
  file_name: string
  file_url: string
  related_project_id: string | null
  created_at: string
}

// ============ CONSTANTS ============
const STATUS_OPTIONS = [
  { id: 'active', label: 'Active', color: 'emerald' },
  { id: 'inactive', label: 'Inactive', color: 'slate' },
]

const ENTITY_TYPES = [
  { id: 'individual', label: 'Individual' },
  { id: 'llc', label: 'LLC' },
  { id: 'corp', label: 'Corporation' },
  { id: 's_corp', label: 'S-Corp' },
  { id: 'partnership', label: 'Partnership' },
]

const COST_TYPES = [
  { id: 'Lump Sum', label: 'Lump Sum (Monthly)' },
  { id: 'T&M', label: 'Time & Materials (Hourly)' },
]

const PAYMENT_METHODS = [
  { id: 'ach', label: 'ACH Transfer' },
  { id: 'wire', label: 'Wire Transfer' },
  { id: 'check', label: 'Check' },
  { id: 'zelle', label: 'Zelle' },
]

const ACCOUNT_TYPES = [
  { id: 'checking', label: 'Checking' },
  { id: 'savings', label: 'Savings' },
]

const DOCUMENT_TYPES = [
  { id: 'NDA', label: 'NDA' },
  { id: 'MPSA', label: 'MPSA' },
  { id: 'PO', label: 'Purchase Order' },
  { id: 'Schedule', label: 'Schedule/SOW' },
  { id: 'W9', label: 'W-9' },
  { id: 'Other', label: 'Other' },
]

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

// ============ UTILITIES ============
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

const maskNumber = (value: string | null): string => {
  if (!value) return '—'
  return '••••' + value.slice(-4)
}

const getStatusStyle = (status: string) => {
  if (status === 'active') return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' }
  return { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' }
}

// ============ DETAIL FLYOUT ============
function MemberDetailFlyout({
  member,
  assignments,
  documents,
  projects,
  timeEntries,
  onClose,
  onEdit,
  onAddAssignment,
  onRemoveAssignment,
  addToast
}: {
  member: TeamMember
  assignments: ProjectAssignment[]
  documents: TeamDocument[]
  projects: Project[]
  timeEntries: TimeEntry[]
  onClose: () => void
  onEdit: () => void
  onAddAssignment: (data: any) => Promise<void>
  onRemoveAssignment: (id: string) => Promise<void>
  addToast: (type: Toast['type'], message: string) => void
}) {
  const [showBanking, setShowBanking] = useState(false)
  const [assignForm, setAssignForm] = useState({ project_id: '', payment_type: 'tm' as 'lump_sum' | 'tm', rate: '' })

  const memberAssignments = assignments.filter(a => a.team_member_id === member.id)
  const memberDocs = documents.filter(d => d.team_member_id === member.id)
  
  // Calculate MTD hours and cost
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  const mtdEntries = timeEntries.filter(t => t.team_member_id === member.id && t.date >= monthStart)
  const mtdHours = mtdEntries.reduce((sum, t) => sum + (t.hours || 0), 0)
  const mtdCost = member.cost_type === 'T&M' && member.cost_amount
    ? mtdHours * member.cost_amount
    : member.cost_amount || 0

  const handleAddAssignment = async () => {
    if (!assignForm.project_id) return
    const project = projects.find(p => p.id === assignForm.project_id)
    await onAddAssignment({
      team_member_id: member.id,
      project_id: assignForm.project_id,
      payment_type: assignForm.payment_type,
      rate: parseFloat(assignForm.rate) || 0,
      project_name: project?.name,
      client_name: project?.client_name,
    })
    setAssignForm({ project_id: '', payment_type: 'tm', rate: '' })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-end z-50" onClick={onClose}>
      <div 
        className={`w-full max-w-xl h-full ${THEME.glass} border-l ${THEME.glassBorder} overflow-y-auto`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`sticky top-0 ${THEME.glass} border-b ${THEME.glassBorder} px-6 py-4 z-10`}>
          <div className="flex items-start justify-between">
            <div>
              <h2 className={`text-lg font-semibold ${THEME.textPrimary}`}>{member.name}</h2>
              <p className={`text-sm ${THEME.textMuted}`}>{member.role || 'Team Member'}</p>
              {member.entity_name && (
                <p className={`text-xs ${THEME.textDim} mt-1`}>{member.entity_name} ({ENTITY_TYPES.find(t => t.id === member.entity_type)?.label || member.entity_type})</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onEdit} className="p-2 rounded-lg hover:bg-white/[0.08] transition-colors">
                <Edit2 size={18} className={THEME.textMuted} />
              </button>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.08] transition-colors">
                <X size={20} className={THEME.textMuted} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-white/[0.03] text-center">
              <p className="text-lg font-semibold text-white">{mtdHours.toFixed(1)}</p>
              <p className={`text-xs ${THEME.textMuted}`}>Hours (MTD)</p>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.03] text-center">
              <p className="text-lg font-semibold text-orange-400">{formatCurrency(mtdCost)}</p>
              <p className={`text-xs ${THEME.textMuted}`}>Cost (MTD)</p>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.03] text-center">
              <p className="text-lg font-semibold text-emerald-400">{memberAssignments.length}</p>
              <p className={`text-xs ${THEME.textMuted}`}>Projects</p>
            </div>
          </div>

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

          {/* Cost Structure */}
          <div className="space-y-3">
            <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Cost Structure</h3>
            <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.08]">
              <div className="flex items-center justify-between">
                <span className={THEME.textMuted}>Type</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  member.cost_type === 'Lump Sum' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
                }`}>{member.cost_type || 'Not set'}</span>
              </div>
              {member.cost_amount && (
                <div className="flex items-center justify-between mt-2">
                  <span className={THEME.textMuted}>Rate</span>
                  <span className="text-orange-400 font-semibold">
                    {formatCurrency(member.cost_amount)}{member.cost_type === 'T&M' ? '/hr' : '/mo'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Banking Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Banking Information</h3>
              <button
                onClick={() => setShowBanking(!showBanking)}
                className={`text-xs ${THEME.textMuted} hover:text-white flex items-center gap-1`}
              >
                {showBanking ? <EyeOff size={14} /> : <Eye size={14} />}
                {showBanking ? 'Hide' : 'Show'}
              </button>
            </div>
            {member.bank_name ? (
              <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.08] space-y-2">
                <div className="flex justify-between">
                  <span className={THEME.textMuted}>Bank</span>
                  <span className={THEME.textSecondary}>{member.bank_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className={THEME.textMuted}>Account Type</span>
                  <span className={THEME.textSecondary}>{ACCOUNT_TYPES.find(t => t.id === member.account_type)?.label || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className={THEME.textMuted}>Routing #</span>
                  <span className="font-mono text-sm">{showBanking ? member.routing_number : maskNumber(member.routing_number)}</span>
                </div>
                <div className="flex justify-between">
                  <span className={THEME.textMuted}>Account #</span>
                  <span className="font-mono text-sm">{showBanking ? member.account_number : maskNumber(member.account_number)}</span>
                </div>
                <div className="flex justify-between">
                  <span className={THEME.textMuted}>Payment Method</span>
                  <span className={THEME.textSecondary}>{PAYMENT_METHODS.find(m => m.id === member.payment_method)?.label || '—'}</span>
                </div>
              </div>
            ) : (
              <p className={`text-sm ${THEME.textMuted} p-4 rounded-lg bg-white/[0.03] text-center`}>No banking info on file</p>
            )}
          </div>

          {/* Project Assignments */}
          <div className="space-y-3">
            <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Project Assignments ({memberAssignments.length})</h3>
            {memberAssignments.length > 0 ? (
              <div className="space-y-2">
                {memberAssignments.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                    <div>
                      <p className={`text-sm ${THEME.textPrimary}`}>{a.project_name}</p>
                      <p className={`text-xs ${THEME.textDim}`}>{a.client_name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          a.payment_type === 'lump_sum' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
                        }`}>{a.payment_type === 'lump_sum' ? 'LS' : 'T&M'}</span>
                        <p className={`text-sm ${THEME.textSecondary} mt-1`}>
                          {formatCurrency(a.rate)}{a.payment_type === 'tm' ? '/hr' : '/mo'}
                        </p>
                      </div>
                      <button
                        onClick={() => onRemoveAssignment(a.id)}
                        className="p-1.5 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-sm ${THEME.textMuted} p-4 rounded-lg bg-white/[0.03] text-center`}>No project assignments</p>
            )}
            
            {/* Add Assignment */}
            <div className="p-4 rounded-lg bg-white/[0.02] border border-dashed border-white/[0.1] space-y-3">
              <p className={`text-xs font-medium ${THEME.textMuted}`}>Add Assignment</p>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={assignForm.project_id}
                  onChange={e => setAssignForm(p => ({ ...p, project_id: e.target.value }))}
                  className="col-span-2 px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
                >
                  <option value="">Select project...</option>
                  {projects.filter(p => p.status === 'active').map(p => (
                    <option key={p.id} value={p.id}>{p.client_name ? `${p.client_name} - ` : ''}{p.name}</option>
                  ))}
                </select>
                <select
                  value={assignForm.payment_type}
                  onChange={e => setAssignForm(p => ({ ...p, payment_type: e.target.value as any }))}
                  className="px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
                >
                  <option value="tm">T&M</option>
                  <option value="lump_sum">Lump Sum</option>
                </select>
                <input
                  type="number"
                  value={assignForm.rate}
                  onChange={e => setAssignForm(p => ({ ...p, rate: e.target.value }))}
                  placeholder={assignForm.payment_type === 'tm' ? '$/hr' : '$/mo'}
                  className="px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
                />
              </div>
              <button
                onClick={handleAddAssignment}
                disabled={!assignForm.project_id}
                className="w-full px-3 py-2 text-sm font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 disabled:opacity-50 transition-colors"
              >
                Add Assignment
              </button>
            </div>
          </div>

          {/* Documents */}
          <div className="space-y-3">
            <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Documents ({memberDocs.length})</h3>
            {memberDocs.length > 0 ? (
              <div className="space-y-2">
                {memberDocs.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                    <div className="flex items-center gap-3">
                      <FileText size={16} className={THEME.textMuted} />
                      <div>
                        <p className={`text-sm ${THEME.textPrimary}`}>{doc.file_name}</p>
                        <p className={`text-xs ${THEME.textDim}`}>{doc.document_type}</p>
                      </div>
                    </div>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                      <ExternalLink size={14} />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p className={`text-sm ${THEME.textMuted} p-4 rounded-lg bg-white/[0.03] text-center`}>No documents uploaded</p>
            )}
            <button className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-white/[0.03] border border-dashed border-white/[0.1] rounded-lg text-slate-400 hover:bg-white/[0.05] hover:text-white transition-colors">
              <Upload size={14} /> Upload Document
            </button>
          </div>
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
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])
  const [documents, setDocuments] = useState<TeamDocument[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)

  // UI State
  const [activeTab, setActiveTab] = useState('directory')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [selectedMemberDetail, setSelectedMemberDetail] = useState<TeamMember | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Toast
  const [toasts, setToasts] = useState<Toast[]>([])
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  // Form State
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', role: '', status: 'active',
    start_date: '', entity_name: '', entity_type: '', address: '',
    bank_name: '', account_type: '', routing_number: '', account_number: '',
    payment_method: '', cost_type: 'Lump Sum', cost_amount: ''
  })

  // Load Data
  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await getCurrentUser()
        const user = result?.user
        if (!user) { setLoading(false); return }

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single()

        if (!profile?.company_id) { setLoading(false); return }
        setCompanyId(profile.company_id)

        const [membersRes, projectsRes, clientsRes, assignmentsRes, timeRes, docsRes] = await Promise.all([
          supabase.from('team_members').select('*').eq('company_id', profile.company_id).order('name'),
          supabase.from('projects').select('id, name, client_id, status').eq('company_id', profile.company_id),
          supabase.from('clients').select('id, name').eq('company_id', profile.company_id),
          supabase.from('project_assignments').select('*').eq('company_id', profile.company_id),
          supabase.from('timesheet_entries').select('id, team_member_id, project_id, hours, date').eq('company_id', profile.company_id),
          supabase.from('team_member_documents').select('*'),
        ])

        const clientMap = new Map((clientsRes.data || []).map(c => [c.id, c.name]))
        
        setTeamMembers(membersRes.data || [])
        setProjects((projectsRes.data || []).map(p => ({
          ...p,
          client_name: clientMap.get(p.client_id) || null
        })))
        setClients(clientsRes.data || [])
        
        // Enrich assignments with names
        const enrichedAssignments = (assignmentsRes.data || []).map(a => {
          const project = projectsRes.data?.find(p => p.id === a.project_id)
          return {
            ...a,
            project_name: project?.name || 'Unknown',
            client_name: clientMap.get(project?.client_id) || ''
          }
        })
        setAssignments(enrichedAssignments)
        setTimeEntries(timeRes.data || [])
        setDocuments(docsRes.data || [])
      } catch (error) {
        console.error('Error loading data:', error)
        addToast('error', 'Failed to load team data')
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
        if (!m.name?.toLowerCase().includes(q) && !m.email?.toLowerCase().includes(q) && !m.role?.toLowerCase().includes(q)) return false
      }
      if (selectedStatus !== 'all' && m.status !== selectedStatus) return false
      return true
    })
  }, [teamMembers, searchQuery, selectedStatus])

  // Summary
  const summary = useMemo(() => {
    const active = teamMembers.filter(m => m.status === 'active')
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const mtdEntries = timeEntries.filter(t => t.date >= monthStart)
    const mtdHours = mtdEntries.reduce((sum, t) => sum + (t.hours || 0), 0)
    
    let mtdCost = 0
    active.forEach(m => {
      const memberEntries = mtdEntries.filter(t => t.team_member_id === m.id)
      const memberHours = memberEntries.reduce((sum, t) => sum + (t.hours || 0), 0)
      if (m.cost_type === 'T&M' && m.cost_amount) {
        mtdCost += memberHours * m.cost_amount
      } else if (m.cost_amount) {
        mtdCost += m.cost_amount
      }
    })

    return {
      total: teamMembers.length,
      active: active.length,
      mtdHours,
      mtdCost,
      avgCostPerHour: mtdHours > 0 ? mtdCost / mtdHours : 0
    }
  }, [teamMembers, timeEntries])

  // Handlers
  const resetForm = () => {
    setFormData({
      name: '', email: '', phone: '', role: '', status: 'active',
      start_date: '', entity_name: '', entity_type: '', address: '',
      bank_name: '', account_type: '', routing_number: '', account_number: '',
      payment_method: '', cost_type: 'Lump Sum', cost_amount: ''
    })
    setEditingMember(null)
  }

  const openAddMember = () => {
    resetForm()
    setShowMemberModal(true)
  }

  const openEditMember = (member: TeamMember) => {
    setEditingMember(member)
    setFormData({
      name: member.name || '',
      email: member.email || '',
      phone: member.phone || '',
      role: member.role || '',
      status: member.status || 'active',
      start_date: member.start_date || '',
      entity_name: member.entity_name || '',
      entity_type: member.entity_type || '',
      address: member.address || '',
      bank_name: member.bank_name || '',
      account_type: member.account_type || '',
      routing_number: member.routing_number || '',
      account_number: member.account_number || '',
      payment_method: member.payment_method || '',
      cost_type: member.cost_type || 'Lump Sum',
      cost_amount: member.cost_amount?.toString() || ''
    })
    setShowMemberModal(true)
    setSelectedMemberDetail(null)
  }

  const saveMember = async () => {
    if (!companyId || !formData.name || !formData.email) return

    setIsSaving(true)
    try {
      const data = {
        company_id: companyId,
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        role: formData.role || null,
        status: formData.status,
        start_date: formData.start_date || null,
        entity_name: formData.entity_name || null,
        entity_type: formData.entity_type || null,
        address: formData.address || null,
        bank_name: formData.bank_name || null,
        account_type: formData.account_type || null,
        routing_number: formData.routing_number || null,
        account_number: formData.account_number || null,
        payment_method: formData.payment_method || null,
        cost_type: formData.cost_type || null,
        cost_amount: formData.cost_amount ? parseFloat(formData.cost_amount) : null
      }

      if (editingMember) {
        const { error } = await supabase.from('team_members').update(data).eq('id', editingMember.id)
        if (error) throw error
        setTeamMembers(prev => prev.map(m => m.id === editingMember.id ? { ...m, ...data } as TeamMember : m))
        addToast('success', 'Team member updated')
      } else {
        const { data: newMember, error } = await supabase.from('team_members').insert(data).select().single()
        if (error) throw error
        setTeamMembers(prev => [...prev, newMember])
        addToast('success', 'Team member added')
      }

      setShowMemberModal(false)
      resetForm()
    } catch (error: any) {
      console.error('Error saving member:', error)
      addToast('error', `Failed to save: ${error.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const deleteMember = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return

    try {
      const { error } = await supabase.from('team_members').delete().eq('id', id)
      if (error) throw error
      setTeamMembers(prev => prev.filter(m => m.id !== id))
      addToast('success', 'Team member deleted')
    } catch (error: any) {
      addToast('error', `Failed to delete: ${error.message}`)
    }
  }

  const addAssignment = async (data: any) => {
    if (!companyId) return

    try {
      const { data: newAssignment, error } = await supabase
        .from('project_assignments')
        .insert({
          company_id: companyId,
          team_member_id: data.team_member_id,
          project_id: data.project_id,
          payment_type: data.payment_type,
          rate: data.rate
        })
        .select()
        .single()

      if (error) throw error

      setAssignments(prev => [...prev, {
        ...newAssignment,
        project_name: data.project_name,
        client_name: data.client_name
      }])
      addToast('success', 'Assignment added')
    } catch (error: any) {
      addToast('error', `Failed to add assignment: ${error.message}`)
    }
  }

  const removeAssignment = async (id: string) => {
    try {
      const { error } = await supabase.from('project_assignments').delete().eq('id', id)
      if (error) throw error
      setAssignments(prev => prev.filter(a => a.id !== id))
      addToast('success', 'Assignment removed')
    } catch (error: any) {
      addToast('error', `Failed to remove: ${error.message}`)
    }
  }

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Role', 'Entity', 'Status', 'Cost Type', 'Cost Amount']
    const rows = teamMembers.map(m => [
      m.name, m.email, m.phone || '', m.role || '', m.entity_name || '', m.status, m.cost_type || '', m.cost_amount || ''
    ])
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n')
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
          <p className={`text-sm ${THEME.textMuted} mt-1`}>Manage team members, assignments, and costs</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 border border-white/[0.1] rounded-lg text-sm font-medium text-slate-300 hover:bg-white/[0.05]">
            <Download size={14} /> Export
          </button>
          <button onClick={openAddMember} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 shadow-lg shadow-emerald-500/20">
            <Plus size={14} /> Add Member
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-1.5 inline-flex gap-1`}>
        {[
          { id: 'directory', label: 'Directory', icon: Users },
          { id: 'profitability', label: 'Profitability', icon: BarChart3 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : `${THEME.textMuted} hover:text-white hover:bg-white/[0.05]`
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-4`}>
          <p className={`text-xs font-medium ${THEME.textMuted} uppercase`}>Total Members</p>
          <p className="text-2xl font-bold text-white mt-1">{summary.total}</p>
        </div>
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-4`}>
          <p className={`text-xs font-medium ${THEME.textMuted} uppercase`}>Active</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{summary.active}</p>
        </div>
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-4`}>
          <p className={`text-xs font-medium ${THEME.textMuted} uppercase`}>Hours (MTD)</p>
          <p className="text-2xl font-bold text-white mt-1">{summary.mtdHours.toFixed(1)}</p>
        </div>
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-4`}>
          <p className={`text-xs font-medium ${THEME.textMuted} uppercase`}>Labor Cost (MTD)</p>
          <p className="text-2xl font-bold text-orange-400 mt-1">{formatCurrency(summary.mtdCost)}</p>
        </div>
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-4`}>
          <p className={`text-xs font-medium ${THEME.textMuted} uppercase`}>Cost/Hour</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{formatCurrency(summary.avgCostPerHour)}</p>
        </div>
      </div>

      {/* Directory Tab */}
      {activeTab === 'directory' && (
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
          {/* Search & Filters */}
          <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
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
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-slate-200"
            >
              <option value="all">All Status</option>
              {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>

          {/* Table */}
          <table className="w-full text-sm">
            <thead>
              <tr className={`bg-white/[0.02] border-b ${THEME.glassBorder}`}>
                <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium`}>Name</th>
                <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium`}>Role</th>
                <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium`}>Entity</th>
                <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium`}>Projects</th>
                <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium`}>Status</th>
                <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Hours (MTD)</th>
                <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Cost</th>
                <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium w-24`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length > 0 ? filteredMembers.map(member => {
                const memberAssignments = assignments.filter(a => a.team_member_id === member.id)
                const now = new Date()
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
                const mtdHours = timeEntries.filter(t => t.team_member_id === member.id && t.date >= monthStart).reduce((s, t) => s + (t.hours || 0), 0)
                const statusStyle = getStatusStyle(member.status)

                return (
                  <tr
                    key={member.id}
                    className="border-b border-white/[0.05] hover:bg-white/[0.03] cursor-pointer"
                    onClick={() => setSelectedMemberDetail(member)}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className={`font-medium ${THEME.textPrimary}`}>{member.name}</p>
                        <p className={`text-xs ${THEME.textDim}`}>{member.email}</p>
                      </div>
                    </td>
                    <td className={`px-4 py-3 ${THEME.textSecondary}`}>{member.role || '—'}</td>
                    <td className={`px-4 py-3 ${THEME.textMuted}`}>
                      {member.entity_name ? (
                        <div>
                          <p className={THEME.textSecondary}>{member.entity_name}</p>
                          <p className={`text-xs ${THEME.textDim}`}>{ENTITY_TYPES.find(t => t.id === member.entity_type)?.label}</p>
                        </div>
                      ) : '—'}
                    </td>
                    <td className={`px-4 py-3 text-center ${THEME.textSecondary}`}>{memberAssignments.length}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                        {member.status}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right ${THEME.textSecondary}`}>{mtdHours.toFixed(1)}</td>
                    <td className={`px-4 py-3 text-right`}>
                      {member.cost_amount ? (
                        <span className="text-orange-400 font-medium">
                          {formatCurrency(member.cost_amount)}{member.cost_type === 'T&M' ? '/hr' : '/mo'}
                        </span>
                      ) : <span className={THEME.textDim}>—</span>}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setSelectedMemberDetail(member)} className="p-1.5 rounded hover:bg-white/[0.08] text-slate-500 hover:text-blue-400">
                          <Eye size={14} />
                        </button>
                        <button onClick={() => openEditMember(member)} className="p-1.5 rounded hover:bg-white/[0.08] text-slate-500 hover:text-slate-300">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => deleteMember(member.id, member.name)} className="p-1.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={8} className={`px-4 py-12 text-center ${THEME.textMuted}`}>
                    No team members found
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Footer */}
          <div className={`flex items-center justify-between px-6 py-3 border-t ${THEME.glassBorder} bg-white/[0.02]`}>
            <p className={`text-sm ${THEME.textMuted}`}>{filteredMembers.length} members</p>
          </div>
        </div>
      )}

      {/* Profitability Tab - Placeholder */}
      {activeTab === 'profitability' && (
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-8 text-center`}>
          <BarChart3 size={48} className="mx-auto text-slate-600 mb-4" />
          <p className={THEME.textMuted}>Profitability analysis coming soon</p>
          <p className={`text-sm ${THEME.textDim} mt-1`}>Track team costs vs revenue by project and client</p>
        </div>
      )}

      {/* Detail Flyout */}
      {selectedMemberDetail && (
        <MemberDetailFlyout
          member={selectedMemberDetail}
          assignments={assignments}
          documents={documents}
          projects={projects}
          timeEntries={timeEntries}
          onClose={() => setSelectedMemberDetail(null)}
          onEdit={() => openEditMember(selectedMemberDetail)}
          onAddAssignment={addAssignment}
          onRemoveAssignment={removeAssignment}
          addToast={addToast}
        />
      )}

      {/* Member Modal */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
              <h3 className={`text-lg font-semibold ${THEME.textPrimary}`}>
                {editingMember ? 'Edit Member' : 'Add Member'}
              </h3>
              <button onClick={() => { setShowMemberModal(false); resetForm() }} className="p-1 hover:bg-white/[0.05] rounded-lg">
                <X size={20} className={THEME.textMuted} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h4 className={`text-sm font-semibold ${THEME.textSecondary}`}>Basic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs ${THEME.textMuted} mb-1`}>Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className={`block text-xs ${THEME.textMuted} mb-1`}>Email *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className={`block text-xs ${THEME.textMuted} mb-1`}>Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className={`block text-xs ${THEME.textMuted} mb-1`}>Role</label>
                    <input
                      type="text"
                      value={formData.role}
                      onChange={e => setFormData(p => ({ ...p, role: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className={`block text-xs ${THEME.textMuted} mb-1`}>Start Date</label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={e => setFormData(p => ({ ...p, start_date: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className={`block text-xs ${THEME.textMuted} mb-1`}>Status</label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
                    >
                      {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id} className="bg-slate-900">{s.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Entity Info */}
              <div className="space-y-4">
                <h4 className={`text-sm font-semibold ${THEME.textSecondary}`}>Entity Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs ${THEME.textMuted} mb-1`}>Entity Name</label>
                    <input
                      type="text"
                      value={formData.entity_name}
                      onChange={e => setFormData(p => ({ ...p, entity_name: e.target.value }))}
                      placeholder="e.g., John Doe LLC"
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className={`block text-xs ${THEME.textMuted} mb-1`}>Entity Type</label>
                    <select
                      value={formData.entity_type}
                      onChange={e => setFormData(p => ({ ...p, entity_type: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
                    >
                      <option value="" className="bg-slate-900">Select...</option>
                      {ENTITY_TYPES.map(t => <option key={t.id} value={t.id} className="bg-slate-900">{t.label}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={`block text-xs ${THEME.textMuted} mb-1`}>Address</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={e => setFormData(p => ({ ...p, address: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Cost Structure */}
              <div className="space-y-4">
                <h4 className={`text-sm font-semibold ${THEME.textSecondary}`}>Cost Structure</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs ${THEME.textMuted} mb-1`}>Cost Type</label>
                    <select
                      value={formData.cost_type}
                      onChange={e => setFormData(p => ({ ...p, cost_type: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
                    >
                      {COST_TYPES.map(t => <option key={t.id} value={t.id} className="bg-slate-900">{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs ${THEME.textMuted} mb-1`}>
                      Amount ({formData.cost_type === 'T&M' ? '/hr' : '/mo'})
                    </label>
                    <input
                      type="number"
                      value={formData.cost_amount}
                      onChange={e => setFormData(p => ({ ...p, cost_amount: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Banking Info */}
              <div className="space-y-4">
                <h4 className={`text-sm font-semibold ${THEME.textSecondary}`}>Banking Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-xs ${THEME.textMuted} mb-1`}>Bank Name</label>
                    <input
                      type="text"
                      value={formData.bank_name}
                      onChange={e => setFormData(p => ({ ...p, bank_name: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className={`block text-xs ${THEME.textMuted} mb-1`}>Account Type</label>
                    <select
                      value={formData.account_type}
                      onChange={e => setFormData(p => ({ ...p, account_type: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
                    >
                      <option value="" className="bg-slate-900">Select...</option>
                      {ACCOUNT_TYPES.map(t => <option key={t.id} value={t.id} className="bg-slate-900">{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-xs ${THEME.textMuted} mb-1`}>Routing Number</label>
                    <input
                      type="text"
                      value={formData.routing_number}
                      onChange={e => setFormData(p => ({ ...p, routing_number: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className={`block text-xs ${THEME.textMuted} mb-1`}>Account Number</label>
                    <input
                      type="text"
                      value={formData.account_number}
                      onChange={e => setFormData(p => ({ ...p, account_number: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className={`block text-xs ${THEME.textMuted} mb-1`}>Payment Method</label>
                    <select
                      value={formData.payment_method}
                      onChange={e => setFormData(p => ({ ...p, payment_method: e.target.value }))}
                      className="w-full px-3 py-2 bg-white/[0.05] border border-white/[0.08] rounded-lg text-sm text-white"
                    >
                      <option value="" className="bg-slate-900">Select...</option>
                      {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id} className="bg-slate-900">{m.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${THEME.glassBorder} bg-white/[0.02]`}>
              <button onClick={() => { setShowMemberModal(false); resetForm() }} className={`px-4 py-2 text-sm font-medium ${THEME.textMuted} hover:text-white`}>
                Cancel
              </button>
              <button
                onClick={saveMember}
                disabled={!formData.name || !formData.email || isSaving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
              >
                {isSaving && <RefreshCw size={14} className="animate-spin" />}
                {editingMember ? 'Save Changes' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
