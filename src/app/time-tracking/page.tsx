'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { 
  Search, Filter, Download, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Clock, Plus, Edit2, X, Check, Trash2, Calendar, Users, DollarSign, BarChart3,
  TrendingUp, TrendingDown, Target, PieChart, Activity, Building2, User, Briefcase,
  CheckCircle, AlertCircle, RefreshCw, Eye, EyeOff, ArrowUpDown, Percent, Layers,
  Lock, Unlock
} from 'lucide-react'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart as RechartsPie, Pie, LineChart, Line, Legend, Area, AreaChart
} from 'recharts'
import { getCurrentUser } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jmahfgpbtjeomuepfozf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYWhmZ3BidGplb211ZXBmb3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0OTAxNzcsImV4cCI6MjA4MTA2NjE3N30.3SVDvWCGIYYHV57BpKjpDJVCZLKzuRv8B_VietQDxUQ'
)

// ============ TYPES ============
interface TimeEntry {
  id: string
  date: string
  hours: number           // Actual hours (submitted by contractor) → drives COST
  billable_hours: number  // Adjusted hours (set by manager) → drives REVENUE
  is_billable: boolean
  team_member_id: string
  team_member_name: string
  project_id: string
  project_name: string
  client_id: string
  client_name: string
  bill_rate: number       // Revenue rate (what client pays per hour)
  cost_rate: number       // Cost rate (what you pay contractor per hour)
  notes: string | null
}

interface TeamMember {
  id: string
  name: string
  email: string
  status: string
  employment_type: string
}

interface Project {
  id: string
  name: string
  client: string
  client_id: string
  bill_rate?: number
}

interface Client {
  id: string
  name: string
}

interface ProjectAssignment {
  id: string
  team_member_id: string
  project_id: string
  payment_type: 'lump_sum' | 'tm'
  rate: number       // Cost rate
  bill_rate?: number // Revenue rate
}

// ============ CONSTANTS ============
type DatePreset = 'this_week' | 'last_week' | 'mtd' | 'last_month' | 'qtd' | 'ytd' | 'custom'

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'this_week', label: 'This Week' },
  { id: 'last_week', label: 'Last Week' },
  { id: 'mtd', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'qtd', label: 'This Quarter' },
  { id: 'ytd', label: 'This Year' },
  { id: 'custom', label: 'Custom Range' },
]

type ViewTab = 'trends' | 'byClient' | 'byEmployee' | 'detailed' | 'profitability'

const VIEW_TABS: { id: ViewTab; label: string; icon: React.ReactNode }[] = [
  { id: 'trends', label: 'Trends', icon: <Activity size={16} /> },
  { id: 'byClient', label: 'By Client', icon: <Building2 size={16} /> },
  { id: 'byEmployee', label: 'By Employee', icon: <Users size={16} /> },
  { id: 'detailed', label: 'Detailed', icon: <Calendar size={16} /> },
  { id: 'profitability', label: 'Profitability', icon: <BarChart3 size={16} /> },
]

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

// ============ THEME ============
const THEME = {
  glass: 'bg-slate-900/70 backdrop-blur-xl',
  glassBorder: 'border-white/[0.08]',
  glassHover: 'hover:bg-white/[0.05] hover:border-white/[0.12]',
  textPrimary: 'text-white',
  textSecondary: 'text-slate-300',
  textMuted: 'text-slate-400',
  textDim: 'text-slate-500',
}

// ============ UTILITIES ============
const formatCurrency = (value: number): string => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
const formatCompactCurrency = (value: number): string => { if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`; if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`; return `$${value.toFixed(0)}` }

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '—'
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatShortDate = (dateStr: string): string => {
  if (!dateStr) return '—'
  const [year, month, day] = dateStr.split('-').map(Number)
  return `${month}/${day}`
}

const getDateRange = (preset: DatePreset, customStart?: string, customEnd?: string): { start: string; end: string } => {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const day = today.getDate()
  let startStr: string, endStr: string
  switch (preset) {
    case 'this_week':
      const thisWeekStart = new Date(year, month, day)
      const dow = thisWeekStart.getDay()
      thisWeekStart.setDate(thisWeekStart.getDate() - (dow === 0 ? 6 : dow - 1))
      const thisWeekEnd = new Date(thisWeekStart); thisWeekEnd.setDate(thisWeekEnd.getDate() + 6)
      startStr = `${thisWeekStart.getFullYear()}-${String(thisWeekStart.getMonth() + 1).padStart(2, '0')}-${String(thisWeekStart.getDate()).padStart(2, '0')}`
      endStr = `${thisWeekEnd.getFullYear()}-${String(thisWeekEnd.getMonth() + 1).padStart(2, '0')}-${String(thisWeekEnd.getDate()).padStart(2, '0')}`
      break
    case 'last_week':
      const lastWeekEnd = new Date(year, month, day)
      const ldow = lastWeekEnd.getDay()
      lastWeekEnd.setDate(lastWeekEnd.getDate() - (ldow === 0 ? 7 : ldow))
      const lastWeekStart = new Date(lastWeekEnd); lastWeekStart.setDate(lastWeekStart.getDate() - 6)
      startStr = `${lastWeekStart.getFullYear()}-${String(lastWeekStart.getMonth() + 1).padStart(2, '0')}-${String(lastWeekStart.getDate()).padStart(2, '0')}`
      endStr = `${lastWeekEnd.getFullYear()}-${String(lastWeekEnd.getMonth() + 1).padStart(2, '0')}-${String(lastWeekEnd.getDate()).padStart(2, '0')}`
      break
    case 'mtd':
      startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const lastDay = new Date(year, month + 1, 0).getDate()
      endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      break
    case 'last_month':
      const lmYear = month === 0 ? year - 1 : year; const lmMonth = month === 0 ? 12 : month
      startStr = `${lmYear}-${String(lmMonth).padStart(2, '0')}-01`
      const lmLastDay = new Date(lmYear, lmMonth, 0).getDate()
      endStr = `${lmYear}-${String(lmMonth).padStart(2, '0')}-${String(lmLastDay).padStart(2, '0')}`
      break
    case 'qtd':
      const quarter = Math.floor(month / 3); const qStartMonth = quarter * 3
      startStr = `${year}-${String(qStartMonth + 1).padStart(2, '0')}-01`
      const qEndMonth = qStartMonth + 2; const qLastDay = new Date(year, qEndMonth + 1, 0).getDate()
      endStr = `${year}-${String(qEndMonth + 1).padStart(2, '0')}-${String(qLastDay).padStart(2, '0')}`
      break
    case 'ytd':
      startStr = `${year}-01-01`; endStr = `${year}-12-31`; break
    case 'custom':
      startStr = customStart || `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      endStr = customEnd || `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      break
    default:
      startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`
      endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  return { start: startStr, end: endStr }
}

const getPriorPeriodRange = (start: string, end: string): { start: string; end: string } => {
  const startDate = new Date(start); const endDate = new Date(end)
  const duration = endDate.getTime() - startDate.getTime()
  const priorEnd = new Date(startDate.getTime() - 1); const priorStart = new Date(priorEnd.getTime() - duration)
  return { start: priorStart.toISOString().split('T')[0], end: priorEnd.toISOString().split('T')[0] }
}

const getWeekColumns = (start: string, end: string): { start: string; end: string; label: string }[] => {
  const weeks: { start: string; end: string; label: string }[] = []
  const startDate = new Date(start); const endDate = new Date(end)
  let current = new Date(startDate)
  const dayOfWeek = current.getDay()
  if (dayOfWeek !== 0) current.setDate(current.getDate() + (7 - dayOfWeek))
  while (current <= endDate || (current.getMonth() === endDate.getMonth() && current.getFullYear() === endDate.getFullYear())) {
    const weekEnd = current.toISOString().split('T')[0]
    const weekStart = new Date(current); weekStart.setDate(weekStart.getDate() - 6)
    weeks.push({ start: weekStart.toISOString().split('T')[0], end: weekEnd, label: formatShortDate(weekEnd) })
    current.setDate(current.getDate() + 7)
    if (current > endDate) break
  }
  return weeks
}

// ============ TOAST ============
interface Toast { id: number; type: 'success' | 'error' | 'info'; message: string }
function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div key={toast.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg backdrop-blur-xl border ${
          toast.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' :
          toast.type === 'error' ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' : 'bg-blue-500/20 border-blue-500/30 text-blue-400'
        }`}>
          {toast.type === 'success' && <CheckCircle size={18} />}
          {toast.type === 'error' && <AlertCircle size={18} />}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => onDismiss(toast.id)} className="ml-2 hover:opacity-70"><X size={16} /></button>
        </div>
      ))}
    </div>
  )
}

// ============ KPI CARD ============
function KPICard({ title, value, format = 'number', trend, trendLabel, icon, color = 'blue' }: { 
  title: string; value: number; format?: 'number' | 'currency' | 'percent' | 'hours'
  trend?: number; trendLabel?: string; icon?: React.ReactNode; color?: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'orange'
}) {
  const colorClasses: Record<string, string> = { blue: 'text-blue-400', emerald: 'text-emerald-400', amber: 'text-amber-400', purple: 'text-purple-400', rose: 'text-rose-400', orange: 'text-orange-400' }
  const formatValue = () => {
    switch (format) {
      case 'currency': return formatCurrency(value)
      case 'percent': return `${value.toFixed(1)}%`
      case 'hours': return `${value.toFixed(1)}`
      default: return value.toLocaleString()
    }
  }
  return (
    <div className={`p-4 rounded-xl ${THEME.glass} border ${THEME.glassBorder}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-medium ${THEME.textMuted} uppercase tracking-wide`}>{title}</span>
        {icon && <span className={THEME.textDim}>{icon}</span>}
      </div>
      <p className={`text-2xl font-bold ${colorClasses[color] || 'text-blue-400'}`}>{formatValue()}</p>
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-1">
          {trend >= 0 ? <TrendingUp size={14} className="text-emerald-400" /> : <TrendingDown size={14} className="text-rose-400" />}
          <span className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{trend >= 0 ? '+' : ''}{trend.toFixed(1)}%</span>
          {trendLabel && <span className={`text-xs ${THEME.textDim}`}>{trendLabel}</span>}
        </div>
      )}
    </div>
  )
}

// ============ COLLAPSIBLE SECTION ============
function CollapsibleSection({ title, children, defaultExpanded = true, badge, badgeColor = 'slate', rightContent, icon }: { 
  title: string; children: React.ReactNode; defaultExpanded?: boolean; badge?: string | number
  badgeColor?: 'slate' | 'blue' | 'emerald' | 'amber'; rightContent?: React.ReactNode; icon?: React.ReactNode
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const badgeColors: Record<string, string> = { slate: 'bg-white/[0.08] text-slate-300', blue: 'bg-blue-500/20 text-blue-400', emerald: 'bg-emerald-500/20 text-emerald-400', amber: 'bg-amber-500/20 text-amber-400' }
  return (
    <div className={`rounded-xl border ${THEME.glass} ${THEME.glassBorder} overflow-hidden`}>
      <button onClick={() => setIsExpanded(!isExpanded)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors">
        <div className="flex items-center gap-2">
          {icon && <span className={THEME.textMuted}>{icon}</span>}
          <h3 className={`text-sm font-medium ${THEME.textPrimary}`}>{title}</h3>
          {badge !== undefined && <span className={`px-2 py-0.5 text-xs rounded-full ${badgeColors[badgeColor]}`}>{badge}</span>}
        </div>
        <div className="flex items-center gap-3">
          {rightContent}
          {isExpanded ? <ChevronUp size={18} className={THEME.textMuted} /> : <ChevronDown size={18} className={THEME.textMuted} />}
        </div>
      </button>
      {isExpanded && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  )
}

// ============ EDITABLE CELL — for billable_hours only ============
function EditableBillableCell({ actualHours, billableHours, onSave }: { 
  actualHours: number; billableHours: number; onSave: (newValue: number) => void 
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(billableHours.toString())
  const isAdjusted = billableHours !== actualHours

  const handleSave = () => {
    const newValue = parseFloat(editValue) || 0
    if (newValue !== billableHours) onSave(newValue)
    setIsEditing(false)
  }
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') { setEditValue(billableHours.toString()); setIsEditing(false) }
  }

  if (isEditing) {
    return (
      <input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleSave} onKeyDown={handleKeyDown}
        className="w-16 px-1 py-0.5 text-right bg-slate-900/50 border border-orange-500/50 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30" autoFocus step="0.5" />
    )
  }
  return (
    <button onClick={() => { setEditValue(billableHours.toString()); setIsEditing(true) }}
      className={`px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 ${
        isAdjusted ? 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20' : 'text-slate-300 hover:bg-white/[0.08]'
      }`} title={isAdjusted ? `Adjusted from ${actualHours.toFixed(1)}` : 'Click to adjust billable hours'}>
      {billableHours.toFixed(1)}
      {isAdjusted && <Edit2 size={10} className="text-orange-400" />}
    </button>
  )
}

// ============ MAIN PAGE ============
export default function TimeTrackingPage() {
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)

  const [datePreset, setDatePreset] = useState<DatePreset>('mtd')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [showDatePicker, setShowDatePicker] = useState(false)

  const [activeTab, setActiveTab] = useState<ViewTab>('byClient')
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

  const [showEntryModal, setShowEntryModal] = useState(false)
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], team_member_id: '', project_id: '', hours: '', billable_hours: '', notes: '', is_billable: true })

  // Toast
  const [toasts, setToasts] = useState<Toast[]>([])
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const dateRange = useMemo(() => getDateRange(datePreset, customStartDate, customEndDate), [datePreset, customStartDate, customEndDate])
  const priorPeriod = useMemo(() => getPriorPeriodRange(dateRange.start, dateRange.end), [dateRange])

  // ============ DATA LOADING ============
  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await getCurrentUser()
        const user = result?.user
        if (!user) return
        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
        if (!profile?.company_id) { setLoading(false); return }
        setCompanyId(profile.company_id)

        const [teamRes, projRes, clientRes, entriesRes, assignRes] = await Promise.all([
          supabase.from('team_members').select('*').eq('company_id', profile.company_id),
          supabase.from('projects').select('*').eq('company_id', profile.company_id),
          supabase.from('clients').select('*').eq('company_id', profile.company_id),
          supabase.from('time_entries').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
          supabase.from('project_assignments').select('*').eq('company_id', profile.company_id),
        ])

        const projectMap: Record<string, any> = {}; (projRes.data || []).forEach((p: any) => { projectMap[p.id] = p })
        const clientMap: Record<string, any> = {}; (clientRes.data || []).forEach((c: any) => { clientMap[c.id] = c })
        const teamMemberMap: Record<string, any> = {}; (teamRes.data || []).forEach((t: any) => { teamMemberMap[t.id] = t })

        // Build assignment lookup: key = `${team_member_id}_${project_id}`
        const assignmentLookup: Record<string, ProjectAssignment> = {}
        ;(assignRes.data || []).forEach((a: any) => {
          assignmentLookup[`${a.team_member_id}_${a.project_id}`] = a
        })

        const transformedEntries = (entriesRes.data || []).map((e: any) => {
          const project = projectMap[e.project_id]
          const clientId = project?.client_id || ''
          const clientName = clientId ? clientMap[clientId]?.name || '' : ''
          const teamMemberId = e.contractor_id || e.user_id || ''
          
          // Get cost rate from assignment
          const assignment = assignmentLookup[`${teamMemberId}_${e.project_id}`]
          const costRate = assignment?.rate || 0
          const billRate = e.bill_rate || assignment?.bill_rate || 0
          
          return {
            id: e.id,
            date: e.date,
            hours: e.hours || 0,
            billable_hours: e.billable_hours != null ? e.billable_hours : (e.hours || 0), // Default to actual if no override
            is_billable: e.is_billable !== false,
            team_member_id: teamMemberId,
            team_member_name: teamMemberMap[teamMemberId]?.name || 'Unknown',
            project_id: e.project_id,
            project_name: project?.name || 'Unknown',
            client_id: clientId,
            client_name: clientName,
            bill_rate: billRate,
            cost_rate: costRate,
            notes: e.description || null
          }
        })

        setTeamMembers((teamRes.data || []).map((t: any) => ({ id: t.id, name: t.name || '', email: t.email || '', status: t.status || 'active', employment_type: t.employment_type || 'contractor' })))
        setProjects((projRes.data || []).map((p: any) => ({ id: p.id, name: p.name || '', client: p.client || '', client_id: p.client_id || '', bill_rate: p.bill_rate || 0 })))
        setClients((clientRes.data || []).map((c: any) => ({ id: c.id, name: c.name || '' })))
        setAssignments(assignRes.data || [])
        setEntries(transformedEntries)
        if (clientRes.data && clientRes.data.length > 0) setExpandedClients(new Set([clientRes.data[0].id]))
      } catch (error) { console.error('Error loading data:', error) }
      finally { setLoading(false) }
    }
    loadData()
  }, [])

  // ============ FILTERS ============
  const filteredEntries = useMemo(() => entries.filter(entry => {
    if (entry.date < dateRange.start || entry.date > dateRange.end) return false
    if (selectedClient !== 'all' && entry.client_id !== selectedClient) return false
    if (selectedEmployee !== 'all' && entry.team_member_id !== selectedEmployee) return false
    if (selectedProject !== 'all' && entry.project_id !== selectedProject) return false
    return true
  }), [entries, dateRange, selectedClient, selectedEmployee, selectedProject])

  const priorPeriodEntries = useMemo(() => entries.filter(entry => {
    if (entry.date < priorPeriod.start || entry.date > priorPeriod.end) return false
    if (selectedClient !== 'all' && entry.client_id !== selectedClient) return false
    if (selectedEmployee !== 'all' && entry.team_member_id !== selectedEmployee) return false
    if (selectedProject !== 'all' && entry.project_id !== selectedProject) return false
    return true
  }), [entries, priorPeriod, selectedClient, selectedEmployee, selectedProject])

  // ============ KPIs — DUAL LAYER ============
  const kpis = useMemo(() => {
    const totalActualHours = filteredEntries.reduce((sum, e) => sum + e.hours, 0)
    const totalBillableHours = filteredEntries.reduce((sum, e) => sum + (e.is_billable ? e.billable_hours : 0), 0)
    const totalCost = filteredEntries.reduce((sum, e) => sum + (e.hours * e.cost_rate), 0)
    const totalRevenue = filteredEntries.reduce((sum, e) => sum + (e.is_billable ? e.billable_hours * e.bill_rate : 0), 0)
    const grossMargin = totalRevenue - totalCost
    const marginPct = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0
    const avgBillRate = totalBillableHours > 0 ? totalRevenue / totalBillableHours : 0
    const avgCostRate = totalActualHours > 0 ? totalCost / totalActualHours : 0

    const priorHours = priorPeriodEntries.reduce((sum, e) => sum + e.hours, 0)
    const priorRevenue = priorPeriodEntries.reduce((sum, e) => sum + (e.is_billable ? (e.billable_hours || e.hours) * e.bill_rate : 0), 0)
    const priorCost = priorPeriodEntries.reduce((sum, e) => sum + (e.hours * e.cost_rate), 0)
    
    const activeMembers = teamMembers.filter(m => m.status === 'active')
    const totalCapacity = activeMembers.length * 160
    const utilization = totalCapacity > 0 ? (totalActualHours / totalCapacity) * 100 : 0

    const hoursTrend = priorHours > 0 ? ((totalActualHours - priorHours) / priorHours) * 100 : 0
    const revenueTrend = priorRevenue > 0 ? ((totalRevenue - priorRevenue) / priorRevenue) * 100 : 0
    const costTrend = priorCost > 0 ? ((totalCost - priorCost) / priorCost) * 100 : 0

    return { totalActualHours, totalBillableHours, totalCost, totalRevenue, grossMargin, marginPct, avgBillRate, avgCostRate, utilization, hoursTrend, revenueTrend, costTrend, uniqueClients: new Set(filteredEntries.map(e => e.client_id).filter(Boolean)).size }
  }, [filteredEntries, priorPeriodEntries, teamMembers])

  const weekColumns = useMemo(() => getWeekColumns(dateRange.start, dateRange.end), [dateRange])

  // ============ BY CLIENT DATA ============
  const dataByClient = useMemo(() => {
    const clientData: Record<string, { id: string; name: string; totalActualHours: number; totalBillableHours: number; totalCost: number; totalRevenue: number
      projects: Record<string, { id: string; name: string; members: Record<string, { id: string; name: string; billRate: number; costRate: number; weekActualHours: Record<string, number>; weekBillableHours: Record<string, number>; totalActualHours: number; totalBillableHours: number; totalCost: number; totalRevenue: number; weekEntries: Record<string, { id: string; hours: number; billable_hours: number }[]> }>; totalActualHours: number; totalBillableHours: number; totalCost: number; totalRevenue: number }>
    }> = {}

    filteredEntries.forEach(entry => {
      const clientId = entry.client_id || 'unassigned'
      const clientName = entry.client_name || 'Unassigned'
      if (!clientData[clientId]) clientData[clientId] = { id: clientId, name: clientName, totalActualHours: 0, totalBillableHours: 0, totalCost: 0, totalRevenue: 0, projects: {} }
      if (!clientData[clientId].projects[entry.project_id]) clientData[clientId].projects[entry.project_id] = { id: entry.project_id, name: entry.project_name, members: {}, totalActualHours: 0, totalBillableHours: 0, totalCost: 0, totalRevenue: 0 }
      const project = clientData[clientId].projects[entry.project_id]
      if (!project.members[entry.team_member_id]) project.members[entry.team_member_id] = { id: entry.team_member_id, name: entry.team_member_name, billRate: entry.bill_rate, costRate: entry.cost_rate, weekActualHours: {}, weekBillableHours: {}, totalActualHours: 0, totalBillableHours: 0, totalCost: 0, totalRevenue: 0, weekEntries: {} }
      const member = project.members[entry.team_member_id]
      
      const weekCol = weekColumns.find(w => {
        const entryDate = new Date(entry.date); const weekStart = new Date(w.start); const weekEnd = new Date(w.end); weekEnd.setHours(23, 59, 59)
        return entryDate >= weekStart && entryDate <= weekEnd
      })
      if (weekCol) {
        member.weekActualHours[weekCol.end] = (member.weekActualHours[weekCol.end] || 0) + entry.hours
        member.weekBillableHours[weekCol.end] = (member.weekBillableHours[weekCol.end] || 0) + entry.billable_hours
        if (!member.weekEntries[weekCol.end]) member.weekEntries[weekCol.end] = []
        member.weekEntries[weekCol.end].push({ id: entry.id, hours: entry.hours, billable_hours: entry.billable_hours })
      }
      member.totalActualHours += entry.hours
      member.totalBillableHours += entry.billable_hours
      member.totalCost += entry.hours * entry.cost_rate
      member.totalRevenue += entry.is_billable ? entry.billable_hours * entry.bill_rate : 0
      if (entry.bill_rate > member.billRate) member.billRate = entry.bill_rate
      if (entry.cost_rate > member.costRate) member.costRate = entry.cost_rate
    })

    Object.values(clientData).forEach(client => {
      Object.values(client.projects).forEach(project => {
        Object.values(project.members).forEach(member => {
          project.totalActualHours += member.totalActualHours; project.totalBillableHours += member.totalBillableHours
          project.totalCost += member.totalCost; project.totalRevenue += member.totalRevenue
        })
        client.totalActualHours += project.totalActualHours; client.totalBillableHours += project.totalBillableHours
        client.totalCost += project.totalCost; client.totalRevenue += project.totalRevenue
      })
    })
    return Object.values(clientData).sort((a, b) => b.totalRevenue - a.totalRevenue)
  }, [filteredEntries, weekColumns])

  // ============ BY EMPLOYEE DATA ============
  const dataByEmployee = useMemo(() => {
    const employeeData: Record<string, { id: string; name: string; empType: string; totalActualHours: number; totalBillableHours: number; totalCost: number; totalRevenue: number; clients: Record<string, { name: string; actualHours: number; billableHours: number; cost: number; revenue: number }> }> = {}
    filteredEntries.forEach(entry => {
      if (!employeeData[entry.team_member_id]) {
        const member = teamMembers.find(m => m.id === entry.team_member_id)
        employeeData[entry.team_member_id] = { id: entry.team_member_id, name: entry.team_member_name, empType: member?.employment_type || 'contractor', totalActualHours: 0, totalBillableHours: 0, totalCost: 0, totalRevenue: 0, clients: {} }
      }
      const emp = employeeData[entry.team_member_id]
      emp.totalActualHours += entry.hours; emp.totalBillableHours += entry.billable_hours
      emp.totalCost += entry.hours * entry.cost_rate; emp.totalRevenue += entry.is_billable ? entry.billable_hours * entry.bill_rate : 0
      const clientKey = entry.client_id || 'unassigned'
      if (!emp.clients[clientKey]) emp.clients[clientKey] = { name: entry.client_name || 'Unassigned', actualHours: 0, billableHours: 0, cost: 0, revenue: 0 }
      emp.clients[clientKey].actualHours += entry.hours; emp.clients[clientKey].billableHours += entry.billable_hours
      emp.clients[clientKey].cost += entry.hours * entry.cost_rate; emp.clients[clientKey].revenue += entry.is_billable ? entry.billable_hours * entry.bill_rate : 0
    })
    return Object.values(employeeData).sort((a, b) => b.totalActualHours - a.totalActualHours)
  }, [filteredEntries, teamMembers])

  // ============ PROFITABILITY DATA ============
  const profitabilityByProject = useMemo(() => {
    const projectData: Record<string, { id: string; name: string; clientName: string; actualHours: number; billableHours: number; cost: number; revenue: number; margin: number; marginPct: number }> = {}
    filteredEntries.forEach(entry => {
      if (!projectData[entry.project_id]) projectData[entry.project_id] = { id: entry.project_id, name: entry.project_name, clientName: entry.client_name, actualHours: 0, billableHours: 0, cost: 0, revenue: 0, margin: 0, marginPct: 0 }
      const p = projectData[entry.project_id]
      p.actualHours += entry.hours; p.billableHours += entry.billable_hours
      p.cost += entry.hours * entry.cost_rate; p.revenue += entry.is_billable ? entry.billable_hours * entry.bill_rate : 0
    })
    return Object.values(projectData).map(p => ({ ...p, margin: p.revenue - p.cost, marginPct: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue) * 100 : 0 })).sort((a, b) => b.margin - a.margin)
  }, [filteredEntries])

  const revenueByClientData = useMemo(() => dataByClient.map((c, i) => ({ name: c.name, value: c.totalRevenue, fill: CHART_COLORS[i % CHART_COLORS.length] })), [dataByClient])

  const weeklyTrendData = useMemo(() => weekColumns.map(week => {
    const weekEntries = filteredEntries.filter(e => {
      const entryDate = new Date(e.date); const weekStart = new Date(week.start); const weekEnd = new Date(week.end); weekEnd.setHours(23, 59, 59)
      return entryDate >= weekStart && entryDate <= weekEnd
    })
    return {
      week: week.label,
      actualHours: weekEntries.reduce((sum, e) => sum + e.hours, 0),
      billableHours: weekEntries.reduce((sum, e) => sum + e.billable_hours, 0),
      cost: weekEntries.reduce((sum, e) => sum + (e.hours * e.cost_rate), 0),
      revenue: weekEntries.reduce((sum, e) => sum + (e.is_billable ? e.billable_hours * e.bill_rate : 0), 0),
    }
  }), [weekColumns, filteredEntries])

  // ============ ACTIONS ============
  const saveNewEntry = async () => {
    if (!companyId || !formData.team_member_id || !formData.project_id || !formData.hours) return
    try {
      const project = projects.find(p => p.id === formData.project_id)
      const teamMember = teamMembers.find(t => t.id === formData.team_member_id)
      const assignment = assignments.find(a => a.team_member_id === formData.team_member_id && a.project_id === formData.project_id)
      const billRate = assignment?.bill_rate || project?.bill_rate || 0
      const costRate = assignment?.rate || 0
      const hours = parseFloat(formData.hours)
      const billableHours = formData.billable_hours ? parseFloat(formData.billable_hours) : hours

      const { data, error } = await supabase.from('time_entries').insert({
        company_id: companyId, date: formData.date, contractor_id: formData.team_member_id,
        project_id: formData.project_id, hours, billable_hours: billableHours,
        is_billable: formData.is_billable, bill_rate: billRate, description: formData.notes || null
      }).select().single()

      if (error) throw error

      const newEntry: TimeEntry = {
        id: data.id, date: formData.date, hours, billable_hours: billableHours,
        is_billable: formData.is_billable, team_member_id: formData.team_member_id,
        team_member_name: teamMember?.name || 'Unknown', project_id: formData.project_id,
        project_name: project?.name || 'Unknown', client_id: project?.client_id || '',
        client_name: clients.find(c => c.id === project?.client_id)?.name || '',
        bill_rate: billRate, cost_rate: costRate, notes: formData.notes || null
      }
      setEntries(prev => [newEntry, ...prev])
      setShowEntryModal(false)
      setFormData({ date: new Date().toISOString().split('T')[0], team_member_id: '', project_id: '', hours: '', billable_hours: '', notes: '', is_billable: true })
      addToast('success', 'Time entry added')
    } catch (error: any) { console.error('Error saving entry:', error); addToast('error', `Failed to save: ${error.message}`) }
  }

  const updateBillableHours = async (entryId: string, newBillableHours: number) => {
    try {
      const { error } = await supabase.from('time_entries').update({ billable_hours: newBillableHours }).eq('id', entryId)
      if (error) throw error
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, billable_hours: newBillableHours } : e))
      addToast('success', 'Billable hours updated')
    } catch (error: any) { console.error('Error updating:', error); addToast('error', `Failed to update: ${error.message}`) }
  }

  const deleteEntry = async (entryId: string) => {
    if (!companyId) return
    if (!confirm('Delete this time entry?')) return
    try {
      const { error } = await supabase.from('time_entries').delete().eq('id', entryId)
      if (error) throw error
      setEntries(prev => prev.filter(e => e.id !== entryId))
      addToast('success', 'Entry deleted')
    } catch (error: any) { console.error('Error deleting:', error); addToast('error', `Failed to delete: ${error.message}`) }
  }

  const toggleClient = (clientId: string) => setExpandedClients(prev => { const next = new Set(prev); if (next.has(clientId)) next.delete(clientId); else next.add(clientId); return next })
  const toggleProject = (projectId: string) => setExpandedProjects(prev => { const next = new Set(prev); if (next.has(projectId)) next.delete(projectId); else next.add(projectId); return next })

  const exportToCSV = () => {
    const headers = ['Date', 'Employee', 'Client', 'Project', 'Actual Hours', 'Billable Hours', 'Cost Rate', 'Bill Rate', 'Cost', 'Revenue', 'Margin', 'Notes']
    const rows = filteredEntries.map(e => [
      e.date, e.team_member_name, e.client_name, e.project_name, e.hours, e.billable_hours,
      e.cost_rate, e.bill_rate, (e.hours * e.cost_rate).toFixed(2), (e.billable_hours * e.bill_rate).toFixed(2),
      ((e.billable_hours * e.bill_rate) - (e.hours * e.cost_rate)).toFixed(2), e.notes || ''
    ])
    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob)
    link.download = `time-analytics-${dateRange.start}-to-${dateRange.end}.csv`; link.click()
    addToast('success', 'Export complete')
  }

  const getFilterTitle = () => {
    if (selectedClient !== 'all') return clients.find(c => c.id === selectedClient)?.name || ''
    if (selectedEmployee !== 'all') return teamMembers.find(t => t.id === selectedEmployee)?.name || ''
    return 'All Clients'
  }

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" /></div>

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-semibold ${THEME.textPrimary}`}>Time Analytics</h1>
          <p className={`text-sm mt-1 ${THEME.textMuted}`}>{getFilterTitle()}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportToCSV} className={`flex items-center gap-2 px-4 py-2 ${THEME.glass} border ${THEME.glassBorder} hover:bg-white/[0.08] rounded-lg text-sm font-medium text-white transition-colors`}><Download size={18} />Export</button>
          <button onClick={() => setShowEntryModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-emerald-500/20"><Plus size={18} />Add Entry</button>
        </div>
      </div>

      {/* Date Range & Filters */}
      <div className={`p-4 rounded-xl border ${THEME.glass} ${THEME.glassBorder} relative z-20`}>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <button onClick={() => setShowDatePicker(!showDatePicker)} className={`flex items-center gap-2 px-4 py-2 bg-white/[0.05] border ${THEME.glassBorder} hover:bg-white/[0.08] rounded-lg text-sm font-medium text-white transition-colors`}>
              <Calendar size={16} />{DATE_PRESETS.find(p => p.id === datePreset)?.label}<ChevronDown size={16} />
            </button>
            {showDatePicker && (
              <div className={`absolute top-full left-0 mt-2 w-64 p-3 ${THEME.glass} border ${THEME.glassBorder} rounded-lg shadow-xl z-[100]`}>
                <div className="space-y-1">
                  {DATE_PRESETS.map(preset => (
                    <button key={preset.id} onClick={() => { setDatePreset(preset.id); if (preset.id !== 'custom') setShowDatePicker(false) }}
                      className={`w-full text-left px-3 py-2 rounded text-sm ${datePreset === preset.id ? 'bg-emerald-500 text-white' : 'text-slate-300 hover:bg-white/[0.08]'}`}>{preset.label}</button>
                  ))}
                </div>
                {datePreset === 'custom' && (
                  <div className={`mt-3 pt-3 border-t ${THEME.glassBorder} space-y-2`}>
                    <div><label className={`text-xs ${THEME.textMuted}`}>Start</label><input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className={`w-full mt-1 px-2 py-1 bg-white/[0.05] border ${THEME.glassBorder} rounded text-sm text-white`} /></div>
                    <div><label className={`text-xs ${THEME.textMuted}`}>End</label><input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className={`w-full mt-1 px-2 py-1 bg-white/[0.05] border ${THEME.glassBorder} rounded text-sm text-white`} /></div>
                    <button onClick={() => setShowDatePicker(false)} className="w-full mt-2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 rounded text-sm font-medium">Apply</button>
                  </div>
                )}
              </div>
            )}
          </div>
          <span className={`text-sm ${THEME.textSecondary}`}>{formatDate(dateRange.start)} — {formatDate(dateRange.end)}</span>
          <div className="h-6 w-px bg-white/[0.08]" />
          <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className={`px-3 py-2 bg-white/[0.05] border ${THEME.glassBorder} rounded-lg text-sm text-white`}>
            <option value="all">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className={`px-3 py-2 bg-white/[0.05] border ${THEME.glassBorder} rounded-lg text-sm text-white`}>
            <option value="all">All Employees</option>
            {teamMembers.filter(t => t.status === 'active').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} className={`px-3 py-2 bg-white/[0.05] border ${THEME.glassBorder} rounded-lg text-sm text-white`}>
            <option value="all">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {(selectedClient !== 'all' || selectedEmployee !== 'all' || selectedProject !== 'all') && (
            <button onClick={() => { setSelectedClient('all'); setSelectedEmployee('all'); setSelectedProject('all') }} className={`flex items-center gap-1 px-3 py-2 text-sm ${THEME.textMuted} hover:text-white`}><X size={14} />Clear</button>
          )}
        </div>
      </div>

      {/* KPI Cards — 7 metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-3 relative z-10">
        <KPICard title="Actual Hours" value={kpis.totalActualHours} format="hours" trend={kpis.hoursTrend} trendLabel="vs prior" icon={<Clock size={16} />} color="blue" />
        <KPICard title="Billable Hours" value={kpis.totalBillableHours} format="hours" icon={<Layers size={16} />} color="purple" />
        <KPICard title="Revenue" value={kpis.totalRevenue} format="currency" trend={kpis.revenueTrend} trendLabel="vs prior" icon={<DollarSign size={16} />} color="emerald" />
        <KPICard title="Cost" value={kpis.totalCost} format="currency" trend={kpis.costTrend} trendLabel="vs prior" icon={<TrendingDown size={16} />} color="rose" />
        <KPICard title="Gross Margin" value={kpis.grossMargin} format="currency" icon={<TrendingUp size={16} />} color={kpis.grossMargin >= 0 ? 'emerald' : 'rose'} />
        <KPICard title="Margin %" value={kpis.marginPct} format="percent" icon={<Percent size={16} />} color={kpis.marginPct >= 20 ? 'emerald' : kpis.marginPct >= 0 ? 'amber' : 'rose'} />
        <KPICard title="Utilization" value={kpis.utilization} format="percent" icon={<Target size={16} />} color="amber" />
      </div>

      {/* View Tabs */}
      <div className={`flex items-center gap-2 border-b ${THEME.glassBorder} pb-2 relative z-10`}>
        {VIEW_TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-emerald-500 text-white' : `${THEME.glass} border ${THEME.glassBorder} text-slate-300 hover:bg-white/[0.08]`}`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ============ TRENDS VIEW ============ */}
      {activeTab === 'trends' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CollapsibleSection title="Revenue by Client" icon={<PieChart size={16} />}>
            <div className="h-64">
              {revenueByClientData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie data={revenueByClientData} cx="35%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                      {revenueByClientData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }} />
                    <Legend layout="vertical" align="right" verticalAlign="middle" formatter={(value) => {
                      const item = revenueByClientData.find(d => d.name === value)
                      const total = revenueByClientData.reduce((sum, d) => sum + d.value, 0)
                      const pct = item ? ((item.value / total) * 100).toFixed(0) : 0
                      return <span className="text-slate-300 text-sm">{value} ({pct}%)</span>
                    }} />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-full text-slate-500">No data</div>}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Weekly Cost vs Revenue" icon={<Activity size={16} />}>
            <div className="h-64">
              {weeklyTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => formatCompactCurrency(v)} />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }} formatter={(value: number, name: string) => [formatCurrency(value), name === 'cost' ? 'Cost' : 'Revenue']} />
                    <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.15} name="Revenue" />
                    <Area type="monotone" dataKey="cost" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} name="Cost" />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-full text-slate-500">No data</div>}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Hours by Employee" icon={<Users size={16} />}>
            <div className="h-64">
              {dataByEmployee.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataByEmployee.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }} />
                    <Bar dataKey="totalActualHours" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Actual" />
                    <Bar dataKey="totalBillableHours" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Billable" />
                    <Legend />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-full text-slate-500">No data</div>}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Hours by Project" icon={<Briefcase size={16} />}>
            <div className="h-64">
              {filteredEntries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={Object.values(filteredEntries.reduce((acc, e) => { if (!acc[e.project_id]) acc[e.project_id] = { name: e.project_name.substring(0, 15), hours: 0 }; acc[e.project_id].hours += e.hours; return acc }, {} as Record<string, { name: string; hours: number }>)).sort((a, b) => b.hours - a.hours).slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }} formatter={(value: number) => [`${value.toFixed(1)} hrs`, 'Hours']} />
                    <Bar dataKey="hours" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-full text-slate-500">No data</div>}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* ============ BY CLIENT VIEW ============ */}
      {activeTab === 'byClient' && (
        <div className="space-y-3">
          {dataByClient.length > 0 ? dataByClient.map((client, clientIndex) => (
            <div key={client.id} className={`rounded-xl border ${THEME.glass} ${THEME.glassBorder} overflow-hidden`}>
              <button onClick={() => toggleClient(client.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors">
                <div className="flex items-center gap-3">
                  {expandedClients.has(client.id) ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                  <Building2 size={18} style={{ color: CHART_COLORS[clientIndex % CHART_COLORS.length] }} />
                  <h3 className="text-base font-semibold text-white">{client.name}</h3>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right">
                    <span className="text-blue-400">{client.totalActualHours.toFixed(1)} hrs</span>
                    {client.totalBillableHours !== client.totalActualHours && (
                      <span className="text-orange-400 ml-2">({client.totalBillableHours.toFixed(1)} billed)</span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-rose-400">{formatCurrency(client.totalCost)}</span>
                    <span className="text-slate-600 mx-1">/</span>
                    <span className="text-emerald-400 font-medium">{formatCurrency(client.totalRevenue)}</span>
                  </div>
                  {client.totalRevenue > 0 && (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      (((client.totalRevenue - client.totalCost) / client.totalRevenue) * 100) >= 20
                        ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {(((client.totalRevenue - client.totalCost) / client.totalRevenue) * 100).toFixed(0)}% margin
                    </span>
                  )}
                </div>
              </button>
              {expandedClients.has(client.id) && (
                <div className={`border-t ${THEME.glassBorder}`}>
                  {Object.values(client.projects).map((project, projectIndex) => (
                    <div key={project.id} className={`border-b ${THEME.glassBorder} last:border-b-0`}>
                      <button onClick={() => toggleProject(project.id)} className="w-full flex items-center justify-between px-6 py-2 hover:bg-white/[0.03] transition-colors">
                        <div className="flex items-center gap-2">
                          {expandedProjects.has(project.id) ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${['bg-blue-500/20 text-blue-400', 'bg-emerald-500/20 text-emerald-400', 'bg-amber-500/20 text-amber-400', 'bg-purple-500/20 text-purple-400', 'bg-rose-500/20 text-rose-400'][projectIndex % 5]}`}>{project.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-blue-400">{project.totalActualHours.toFixed(1)} hrs</span>
                          <span className="text-rose-400">{formatCurrency(project.totalCost)}</span>
                          <span className="text-emerald-400">{formatCurrency(project.totalRevenue)}</span>
                        </div>
                      </button>
                      {expandedProjects.has(project.id) && (
                        <div className="px-6 pb-3 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead><tr className={`border-b ${THEME.glassBorder}`}>
                              <th className={`px-2 py-2 text-left ${THEME.textMuted} font-medium w-32`}>Name</th>
                              <th className={`px-2 py-2 text-right ${THEME.textMuted} font-medium w-20`}>Cost Rate</th>
                              <th className={`px-2 py-2 text-right ${THEME.textMuted} font-medium w-20`}>Bill Rate</th>
                              {weekColumns.map(week => <th key={week.end} className={`px-2 py-2 text-right ${THEME.textMuted} font-medium w-16`}>{week.label}</th>)}
                              <th className={`px-2 py-2 text-right ${THEME.textMuted} font-medium w-20`}>Actual</th>
                              <th className={`px-2 py-2 text-right ${THEME.textMuted} font-medium w-20`}>Billed</th>
                              <th className={`px-2 py-2 text-right ${THEME.textMuted} font-medium w-24`}>Cost</th>
                              <th className={`px-2 py-2 text-right ${THEME.textMuted} font-medium w-24`}>Revenue</th>
                            </tr></thead>
                            <tbody>
                              {Object.values(project.members).sort((a, b) => b.totalActualHours - a.totalActualHours).map(member => (
                                <tr key={member.id} className={`border-b ${THEME.glassBorder} border-opacity-30 hover:bg-white/[0.03]`}>
                                  <td className="px-2 py-2 text-slate-200">{member.name}</td>
                                  <td className="px-2 py-2 text-right text-rose-400 text-xs">{formatCurrency(member.costRate)}</td>
                                  <td className="px-2 py-2 text-right text-emerald-400 text-xs">{formatCurrency(member.billRate)}</td>
                                  {weekColumns.map(week => (
                                    <td key={week.end} className="px-2 py-2 text-right text-slate-300">
                                      {(member.weekActualHours[week.end] || 0).toFixed(1)}
                                      {member.weekBillableHours[week.end] && member.weekBillableHours[week.end] !== member.weekActualHours[week.end] && (
                                        <span className="text-orange-400 text-xs ml-0.5">({member.weekBillableHours[week.end]?.toFixed(1)})</span>
                                      )}
                                    </td>
                                  ))}
                                  <td className="px-2 py-2 text-right text-blue-400 font-medium">{member.totalActualHours.toFixed(1)}</td>
                                  <td className={`px-2 py-2 text-right font-medium ${member.totalBillableHours !== member.totalActualHours ? 'text-orange-400' : 'text-slate-400'}`}>
                                    {member.totalBillableHours.toFixed(1)}
                                  </td>
                                  <td className="px-2 py-2 text-right text-rose-400">{formatCurrency(member.totalCost)}</td>
                                  <td className="px-2 py-2 text-right text-emerald-400 font-medium">{formatCurrency(member.totalRevenue)}</td>
                                </tr>
                              ))}
                              <tr className="bg-white/[0.02] font-medium">
                                <td className="px-2 py-2 text-slate-300" colSpan={3}>PROJECT TOTAL</td>
                                {weekColumns.map(week => {
                                  const weekTotal = Object.values(project.members).reduce((sum, m) => sum + (m.weekActualHours[week.end] || 0), 0)
                                  return <td key={week.end} className="px-2 py-2 text-right text-slate-300">{weekTotal.toFixed(1)}</td>
                                })}
                                <td className="px-2 py-2 text-right text-blue-400">{project.totalActualHours.toFixed(1)}</td>
                                <td className="px-2 py-2 text-right text-orange-400">{project.totalBillableHours.toFixed(1)}</td>
                                <td className="px-2 py-2 text-right text-rose-400">{formatCurrency(project.totalCost)}</td>
                                <td className="px-2 py-2 text-right text-emerald-400">{formatCurrency(project.totalRevenue)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )) : <div className={`text-center py-12 ${THEME.textMuted}`}>No time entries for this period</div>}
          {dataByClient.length > 0 && (
            <div className={`p-4 rounded-xl ${THEME.glass} border ${THEME.glassBorder} flex items-center justify-between`}>
              <span className={`text-lg font-semibold ${THEME.textPrimary}`}>GRAND TOTAL</span>
              <div className="flex items-center gap-6">
                <span className="text-lg font-semibold text-blue-400">{kpis.totalActualHours.toFixed(1)} hrs</span>
                <span className="text-lg text-rose-400">{formatCurrency(kpis.totalCost)}</span>
                <span className="text-lg font-semibold text-emerald-400">{formatCurrency(kpis.totalRevenue)}</span>
                <span className={`text-lg font-bold ${kpis.grossMargin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(kpis.grossMargin)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ BY EMPLOYEE VIEW ============ */}
      {activeTab === 'byEmployee' && (
        <div className="space-y-3">
          {dataByEmployee.map((employee, index) => (
            <CollapsibleSection
              key={employee.id}
              title={employee.name}
              icon={<User size={16} style={{ color: CHART_COLORS[index % CHART_COLORS.length] }} />}
              badge={`${employee.totalActualHours.toFixed(1)} hrs`}
              badgeColor="blue"
              rightContent={
                <div className="flex items-center gap-4 mr-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${employee.empType === 'employee' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
                    {employee.empType === 'employee' ? 'W-2' : '1099'}
                  </span>
                  <span className="text-rose-400 text-sm">{formatCurrency(employee.totalCost)}</span>
                  <span className="text-emerald-400 font-medium text-sm">{formatCurrency(employee.totalRevenue)}</span>
                  {employee.totalRevenue > 0 && (
                    <span className={`text-xs font-medium ${((employee.totalRevenue - employee.totalCost) / employee.totalRevenue * 100) >= 20 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {((employee.totalRevenue - employee.totalCost) / employee.totalRevenue * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              }
              defaultExpanded={index === 0}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-medium text-slate-400 uppercase mb-2">By Client</h4>
                  <div className="space-y-2">
                    {Object.entries(employee.clients).sort((a, b) => b[1].actualHours - a[1].actualHours).map(([clientId, data], i) => (
                      <div key={clientId} className="flex items-center justify-between p-2 rounded bg-white/[0.03]">
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} /><span className="text-sm text-slate-200">{data.name}</span></div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-blue-400">{data.actualHours.toFixed(1)} hrs</span>
                          {data.billableHours !== data.actualHours && <span className="text-orange-400">({data.billableHours.toFixed(1)} billed)</span>}
                          <span className="text-rose-400">{formatCurrency(data.cost)}</span>
                          <span className="text-emerald-400">{formatCurrency(data.revenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-medium text-slate-400 uppercase mb-2">Distribution</h4>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie><Pie data={Object.entries(employee.clients).map(([id, data], i) => ({ name: data.name, value: data.actualHours, fill: CHART_COLORS[i % CHART_COLORS.length] }))} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value">
                        {Object.entries(employee.clients).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie><Tooltip formatter={(value: number) => `${value.toFixed(1)} hrs`} /></RechartsPie>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </CollapsibleSection>
          ))}
        </div>
      )}

      {/* ============ DETAILED VIEW ============ */}
      {activeTab === 'detailed' && (
        <CollapsibleSection title="Time Entries" badge={filteredEntries.length} icon={<Calendar size={16} />}>
          <div className="mb-3 flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="flex items-center gap-1"><Lock size={12} /><span>Actual Hours = cost (contractor submitted)</span></div>
              <span className="text-slate-600">|</span>
              <div className="flex items-center gap-1"><Edit2 size={12} className="text-orange-400" /><span className="text-orange-400">Billable Hours = revenue (click to adjust)</span></div>
            </div>
          </div>
          <div className={`overflow-x-auto rounded-lg border ${THEME.glassBorder}`}>
            <table className="w-full text-sm">
              <thead><tr className="bg-white/[0.02]">
                <th className={`px-3 py-3 text-left font-medium ${THEME.textMuted}`}>Date</th>
                <th className={`px-3 py-3 text-left font-medium ${THEME.textMuted}`}>Employee</th>
                <th className={`px-3 py-3 text-left font-medium ${THEME.textMuted}`}>Client</th>
                <th className={`px-3 py-3 text-left font-medium ${THEME.textMuted}`}>Project</th>
                <th className={`px-3 py-3 text-right font-medium text-blue-400`}>Actual Hrs</th>
                <th className={`px-3 py-3 text-right font-medium text-orange-400`}>Billable Hrs</th>
                <th className={`px-3 py-3 text-right font-medium text-rose-400`}>Cost Rate</th>
                <th className={`px-3 py-3 text-right font-medium text-emerald-400`}>Bill Rate</th>
                <th className={`px-3 py-3 text-right font-medium text-rose-400`}>Cost</th>
                <th className={`px-3 py-3 text-right font-medium text-emerald-400`}>Revenue</th>
                <th className={`px-3 py-3 text-right font-medium ${THEME.textMuted}`}>Margin</th>
                <th className={`px-3 py-3 text-left font-medium ${THEME.textMuted}`}>Notes</th>
                <th className={`px-3 py-3 text-center font-medium ${THEME.textMuted}`}>⚡</th>
              </tr></thead>
              <tbody>
                {filteredEntries.length > 0 ? filteredEntries.slice(0, 100).map((entry) => {
                  const cost = entry.hours * entry.cost_rate
                  const revenue = entry.is_billable ? entry.billable_hours * entry.bill_rate : 0
                  const margin = revenue - cost
                  return (
                    <tr key={entry.id} className={`border-t ${THEME.glassBorder} hover:bg-white/[0.03]`}>
                      <td className={`px-3 py-2.5 ${THEME.textSecondary} whitespace-nowrap text-xs`}>{formatDate(entry.date)}</td>
                      <td className={`px-3 py-2.5 ${THEME.textPrimary}`}>{entry.team_member_name}</td>
                      <td className={`px-3 py-2.5 ${THEME.textMuted} text-xs`}>{entry.client_name || '—'}</td>
                      <td className={`px-3 py-2.5 ${THEME.textPrimary} text-xs`}>{entry.project_name}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-blue-400 flex items-center justify-end gap-1">
                          <Lock size={10} className="text-slate-600" />{entry.hours.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <EditableBillableCell
                          actualHours={entry.hours}
                          billableHours={entry.billable_hours}
                          onSave={(newValue) => updateBillableHours(entry.id, newValue)}
                        />
                      </td>
                      <td className={`px-3 py-2.5 text-right text-xs ${THEME.textMuted}`}>{formatCurrency(entry.cost_rate)}</td>
                      <td className={`px-3 py-2.5 text-right text-xs ${THEME.textMuted}`}>{formatCurrency(entry.bill_rate)}</td>
                      <td className="px-3 py-2.5 text-right text-rose-400 text-xs">{formatCurrency(cost)}</td>
                      <td className="px-3 py-2.5 text-right text-emerald-400 text-xs">{formatCurrency(revenue)}</td>
                      <td className={`px-3 py-2.5 text-right text-xs font-medium ${margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(margin)}</td>
                      <td className={`px-3 py-2.5 ${THEME.textMuted} text-xs max-w-[120px] truncate`}>{entry.notes || '—'}</td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => deleteEntry(entry.id)} className="p-1.5 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                }) : <tr><td colSpan={13} className={`px-4 py-12 text-center ${THEME.textMuted}`}>No time entries found</td></tr>}
              </tbody>
            </table>
          </div>
          {filteredEntries.length > 100 && <p className="text-center text-sm text-slate-400 mt-2">Showing first 100 of {filteredEntries.length} entries</p>}
        </CollapsibleSection>
      )}

      {/* ============ PROFITABILITY VIEW ============ */}
      {activeTab === 'profitability' && (
        <div className="space-y-6">
          {/* Margin Chart */}
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-6`}>
            <h3 className={`text-sm font-semibold ${THEME.textPrimary} mb-4`}>Profitability by Project</h3>
            {profitabilityByProject.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profitabilityByProject.slice(0, 10)} margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => formatCompactCurrency(v)} />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}
                      formatter={(value: number, name: string) => [formatCurrency(value), name]} />
                    <Legend />
                    <Bar dataKey="cost" name="Cost" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <div className={`text-center py-12 ${THEME.textMuted}`}><BarChart3 size={48} className="mx-auto text-slate-600 mb-4" /><p>No profitability data yet</p></div>}
          </div>

          {/* Margin Table */}
          {profitabilityByProject.length > 0 && (
            <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
              <div className={`px-6 py-4 border-b ${THEME.glassBorder}`}>
                <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Margin Detail by Project</h3>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="bg-white/[0.02]">
                  <th className={`px-4 py-3 text-left font-medium ${THEME.textMuted}`}>Project</th>
                  <th className={`px-4 py-3 text-left font-medium ${THEME.textMuted}`}>Client</th>
                  <th className={`px-4 py-3 text-right font-medium text-blue-400`}>Actual Hrs</th>
                  <th className={`px-4 py-3 text-right font-medium text-orange-400`}>Billed Hrs</th>
                  <th className={`px-4 py-3 text-right font-medium text-rose-400`}>Cost</th>
                  <th className={`px-4 py-3 text-right font-medium text-emerald-400`}>Revenue</th>
                  <th className={`px-4 py-3 text-right font-medium ${THEME.textMuted}`}>Margin</th>
                  <th className={`px-4 py-3 text-right font-medium ${THEME.textMuted}`}>Margin %</th>
                </tr></thead>
                <tbody>
                  {profitabilityByProject.map(row => (
                    <tr key={row.id} className={`border-t ${THEME.glassBorder} hover:bg-white/[0.03]`}>
                      <td className={`px-4 py-3 font-medium ${THEME.textPrimary}`}>{row.name}</td>
                      <td className={`px-4 py-3 ${THEME.textMuted}`}>{row.clientName || '—'}</td>
                      <td className="px-4 py-3 text-right text-blue-400">{row.actualHours.toFixed(1)}</td>
                      <td className={`px-4 py-3 text-right ${row.billableHours !== row.actualHours ? 'text-orange-400' : THEME.textSecondary}`}>{row.billableHours.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-rose-400">{formatCurrency(row.cost)}</td>
                      <td className="px-4 py-3 text-right text-emerald-400">{formatCurrency(row.revenue)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${row.margin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(row.margin)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          row.marginPct >= 30 ? 'bg-emerald-500/20 text-emerald-400' :
                          row.marginPct >= 15 ? 'bg-amber-500/20 text-amber-400' :
                          row.marginPct >= 0 ? 'bg-orange-500/20 text-orange-400' : 'bg-rose-500/20 text-rose-400'
                        }`}>
                          {row.marginPct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-white/[0.03] font-medium">
                    <td className={`px-4 py-3 ${THEME.textPrimary}`} colSpan={2}>TOTAL</td>
                    <td className="px-4 py-3 text-right text-blue-400">{kpis.totalActualHours.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-orange-400">{kpis.totalBillableHours.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-rose-400">{formatCurrency(kpis.totalCost)}</td>
                    <td className="px-4 py-3 text-right text-emerald-400">{formatCurrency(kpis.totalRevenue)}</td>
                    <td className={`px-4 py-3 text-right font-bold ${kpis.grossMargin >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(kpis.grossMargin)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`px-2 py-1 rounded text-sm font-bold ${kpis.marginPct >= 20 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                        {kpis.marginPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============ ENTRY MODAL ============ */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-6 w-full max-w-lg shadow-2xl`}>
            <h3 className={`text-lg font-semibold ${THEME.textPrimary} mb-4`}>Add Time Entry</h3>
            <div className="space-y-4">
              <div><label className={`block text-sm ${THEME.textMuted} mb-1`}>Date *</label><input type="date" value={formData.date} onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))} className={`w-full px-3 py-2 bg-white/[0.05] border ${THEME.glassBorder} rounded-lg text-white`} /></div>
              <div><label className={`block text-sm ${THEME.textMuted} mb-1`}>Employee *</label><select value={formData.team_member_id} onChange={(e) => setFormData(prev => ({ ...prev, team_member_id: e.target.value }))} className={`w-full px-3 py-2 bg-white/[0.05] border ${THEME.glassBorder} rounded-lg text-white`}><option value="">Select...</option>{teamMembers.filter(t => t.status === 'active').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div><label className={`block text-sm ${THEME.textMuted} mb-1`}>Project *</label><select value={formData.project_id} onChange={(e) => setFormData(prev => ({ ...prev, project_id: e.target.value }))} className={`w-full px-3 py-2 bg-white/[0.05] border ${THEME.glassBorder} rounded-lg text-white`}><option value="">Select...</option>{projects.map(p => <option key={p.id} value={p.id}>{p.client ? `${p.client} - ` : ''}{p.name}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm ${THEME.textMuted} mb-1`}>Actual Hours *</label>
                  <input type="number" value={formData.hours} onChange={(e) => setFormData(prev => ({ ...prev, hours: e.target.value }))} className={`w-full px-3 py-2 bg-white/[0.05] border ${THEME.glassBorder} rounded-lg text-white`} placeholder="8" step="0.5" />
                  <p className="text-xs text-slate-500 mt-1">What contractor worked</p>
                </div>
                <div>
                  <label className={`block text-sm text-orange-400 mb-1`}>Billable Hours</label>
                  <input type="number" value={formData.billable_hours} onChange={(e) => setFormData(prev => ({ ...prev, billable_hours: e.target.value }))} className={`w-full px-3 py-2 bg-white/[0.05] border border-orange-500/20 rounded-lg text-white`} placeholder="Same as actual" step="0.5" />
                  <p className="text-xs text-slate-500 mt-1">What you bill client (optional)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={formData.is_billable} onChange={(e) => setFormData(prev => ({ ...prev, is_billable: e.target.checked }))} className="rounded bg-white/[0.05] border-white/[0.1]" />
                <label className={`text-sm ${THEME.textMuted}`}>Billable</label>
              </div>
              <div><label className={`block text-sm ${THEME.textMuted} mb-1`}>Notes</label><textarea value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} className={`w-full px-3 py-2 bg-white/[0.05] border ${THEME.glassBorder} rounded-lg text-white resize-none`} rows={2} placeholder="Description..." /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowEntryModal(false)} className={`flex-1 px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] border ${THEME.glassBorder} rounded-lg text-sm font-medium`}>Cancel</button>
              <button onClick={saveNewEntry} className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-sm font-medium shadow-lg shadow-emerald-500/20">Add Entry</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
