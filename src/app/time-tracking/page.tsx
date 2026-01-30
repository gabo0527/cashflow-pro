'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  Search, Filter, Download, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Clock, Plus, Edit2, X, Check, Trash2, Calendar, Users, DollarSign, BarChart3,
  TrendingUp, TrendingDown, Target, PieChart, Activity, Building2, User, Briefcase
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

// Types
interface TimeEntry {
  id: string
  date: string
  hours: number
  team_member_id: string
  team_member_name: string
  project_id: string
  project_name: string
  client_id: string
  client_name: string
  bill_rate: number
  notes: string | null
}

interface TeamMember {
  id: string
  name: string
  email: string
  status: string
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

// Date presets
type DatePreset = 'this_week' | 'last_week' | 'mtd' | 'last_month' | 'qtd' | 'ytd' | 'custom'

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'this_week', label: 'This Week' },
  { id: 'last_week', label: 'Last Week' },
  { id: 'mtd', label: 'Month to Date' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'qtd', label: 'Quarter to Date' },
  { id: 'ytd', label: 'Year to Date' },
  { id: 'custom', label: 'Custom Range' },
]

// View tabs
type ViewTab = 'trends' | 'byClient' | 'byEmployee' | 'detailed'

const VIEW_TABS: { id: ViewTab; label: string; icon: React.ReactNode }[] = [
  { id: 'trends', label: 'Trends', icon: <Activity size={16} /> },
  { id: 'byClient', label: 'By Client', icon: <Building2 size={16} /> },
  { id: 'byEmployee', label: 'By Employee', icon: <Users size={16} /> },
  { id: 'detailed', label: 'Detailed', icon: <Calendar size={16} /> },
]

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

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
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatShortDate = (dateStr: string): string => {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// Date utilities
const getDateRange = (preset: DatePreset, customStart?: string, customEnd?: string): { start: string; end: string } => {
  const today = new Date()
  let start: Date
  let end: Date = today

  switch (preset) {
    case 'this_week':
      start = new Date(today)
      const dayOfWeek = start.getDay()
      start.setDate(start.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
      break
    case 'last_week':
      start = new Date(today)
      start.setDate(start.getDate() - start.getDay() - 6)
      end = new Date(start)
      end.setDate(end.getDate() + 6)
      break
    case 'mtd':
      start = new Date(today.getFullYear(), today.getMonth(), 1)
      break
    case 'last_month':
      start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      end = new Date(today.getFullYear(), today.getMonth(), 0)
      break
    case 'qtd':
      const quarter = Math.floor(today.getMonth() / 3)
      start = new Date(today.getFullYear(), quarter * 3, 1)
      break
    case 'ytd':
      start = new Date(today.getFullYear(), 0, 1)
      break
    case 'custom':
      return { start: customStart || today.toISOString().split('T')[0], end: customEnd || today.toISOString().split('T')[0] }
    default:
      start = new Date(today.getFullYear(), today.getMonth(), 1)
  }
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] }
}

const getPriorPeriodRange = (start: string, end: string): { start: string; end: string } => {
  const startDate = new Date(start)
  const endDate = new Date(end)
  const duration = endDate.getTime() - startDate.getTime()
  const priorEnd = new Date(startDate.getTime() - 1)
  const priorStart = new Date(priorEnd.getTime() - duration)
  return { start: priorStart.toISOString().split('T')[0], end: priorEnd.toISOString().split('T')[0] }
}

const getWeekColumns = (start: string, end: string): { start: string; label: string }[] => {
  const weeks: { start: string; label: string }[] = []
  const startDate = new Date(start)
  const endDate = new Date(end)
  let current = new Date(startDate)
  const dayOfWeek = current.getDay()
  current.setDate(current.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  while (current <= endDate) {
    weeks.push({ start: current.toISOString().split('T')[0], label: formatShortDate(current.toISOString().split('T')[0]) })
    current.setDate(current.getDate() + 7)
  }
  return weeks
}

// KPI Card
function KPICard({ title, value, format = 'number', trend, trendLabel, icon, color = 'blue' }: { 
  title: string; value: number; format?: 'number' | 'currency' | 'percent' | 'hours'
  trend?: number; trendLabel?: string; icon?: React.ReactNode; color?: 'blue' | 'emerald' | 'amber' | 'purple' | 'rose'
}) {
  const colorClasses = { blue: 'text-blue-500', emerald: 'text-emerald-500', amber: 'text-amber-500', purple: 'text-purple-500', rose: 'text-rose-500' }
  const formatValue = () => {
    switch (format) {
      case 'currency': return formatCurrency(value)
      case 'percent': return `${value.toFixed(1)}%`
      case 'hours': return `${value.toFixed(1)}`
      default: return value.toLocaleString()
    }
  }
  return (
    <div className="p-4 rounded-xl bg-slate-800 border border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{title}</span>
        {icon && <span className="text-slate-500">{icon}</span>}
      </div>
      <p className={`text-2xl font-bold ${colorClasses[color]}`}>{formatValue()}</p>
      {trend !== undefined && (
        <div className="flex items-center gap-1 mt-1">
          {trend >= 0 ? <TrendingUp size={14} className="text-emerald-500" /> : <TrendingDown size={14} className="text-rose-500" />}
          <span className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{trend >= 0 ? '+' : ''}{trend.toFixed(1)}%</span>
          {trendLabel && <span className="text-xs text-slate-500">{trendLabel}</span>}
        </div>
      )}
    </div>
  )
}

// Collapsible Section
function CollapsibleSection({ title, children, defaultExpanded = true, badge, badgeColor = 'slate', rightContent, icon }: { 
  title: string; children: React.ReactNode; defaultExpanded?: boolean; badge?: string | number
  badgeColor?: 'slate' | 'blue' | 'emerald' | 'amber'; rightContent?: React.ReactNode; icon?: React.ReactNode
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const badgeColors = { slate: 'bg-slate-700 text-slate-300', blue: 'bg-blue-500/20 text-blue-400', emerald: 'bg-emerald-500/20 text-emerald-400', amber: 'bg-amber-500/20 text-amber-400' }
  return (
    <div className="rounded-xl border bg-slate-800 border-slate-700 overflow-hidden">
      <button onClick={() => setIsExpanded(!isExpanded)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/50 transition-colors">
        <div className="flex items-center gap-2">
          {icon && <span className="text-slate-400">{icon}</span>}
          <h3 className="text-sm font-medium text-slate-100">{title}</h3>
          {badge !== undefined && <span className={`px-2 py-0.5 text-xs rounded-full ${badgeColors[badgeColor]}`}>{badge}</span>}
        </div>
        <div className="flex items-center gap-3">
          {rightContent}
          {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
        </div>
      </button>
      {isExpanded && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  )
}

// Editable Cell
function EditableCell({ value, onSave }: { value: number; onSave: (newValue: number) => void }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value.toString())
  const handleSave = () => {
    const newValue = parseFloat(editValue) || 0
    if (newValue !== value) onSave(newValue)
    setIsEditing(false)
  }
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') { setEditValue(value.toString()); setIsEditing(false) }
  }
  if (isEditing) {
    return (
      <input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleSave} onKeyDown={handleKeyDown}
        className="w-16 px-1 py-0.5 text-right bg-slate-900 border border-blue-500 rounded text-sm text-slate-100 focus:outline-none" autoFocus step="0.5" />
    )
  }
  return (
    <button onClick={() => { setEditValue(value.toString()); setIsEditing(true) }} className="px-1 py-0.5 rounded hover:bg-slate-600 text-slate-300 transition-colors" title="Click to edit">
      {value.toFixed(1)}
    </button>
  )
}

export default function TimeTrackingPage() {
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
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
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], team_member_id: '', project_id: '', hours: '', notes: '' })

  const dateRange = useMemo(() => getDateRange(datePreset, customStartDate, customEndDate), [datePreset, customStartDate, customEndDate])
  const priorPeriod = useMemo(() => getPriorPeriodRange(dateRange.start, dateRange.end), [dateRange])

  useEffect(() => {
    const loadData = async () => {
      try {
        const { user } = await getCurrentUser()
        if (!user) return
        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
        if (!profile?.company_id) { setLoading(false); return }
        setCompanyId(profile.company_id)

        const { data: teamData } = await supabase.from('team_members').select('*').eq('company_id', profile.company_id)
        const { data: projData } = await supabase.from('projects').select('*').eq('company_id', profile.company_id)
        const { data: clientData } = await supabase.from('clients').select('*').eq('company_id', profile.company_id)
        const { data: entriesData } = await supabase.from('time_entries').select('*').eq('company_id', profile.company_id).order('date', { ascending: false })

        const projectMap: Record<string, any> = {}; (projData || []).forEach((p: any) => { projectMap[p.id] = p })
        const clientMap: Record<string, any> = {}; (clientData || []).forEach((c: any) => { clientMap[c.id] = c })
        const teamMemberMap: Record<string, any> = {}; (teamData || []).forEach((t: any) => { teamMemberMap[t.id] = t })

        const transformedEntries = (entriesData || []).map((e: any) => {
          const project = projectMap[e.project_id]
          const clientId = project?.client_id || ''
          const clientName = clientId ? clientMap[clientId]?.name || '' : ''
          return {
            id: e.id, date: e.date, hours: e.hours || 0, team_member_id: e.contractor_id || e.user_id || '',
            team_member_name: teamMemberMap[e.contractor_id]?.name || 'Unknown', project_id: e.project_id,
            project_name: project?.name || 'Unknown', client_id: clientId, client_name: clientName, bill_rate: e.bill_rate || 0, notes: e.description || null
          }
        })

        setTeamMembers((teamData || []).map((t: any) => ({ id: t.id, name: t.name || '', email: t.email || '', status: t.status || 'active' })))
        setProjects((projData || []).map((p: any) => ({ id: p.id, name: p.name || '', client: p.client || '', client_id: p.client_id || '', bill_rate: p.bill_rate || 0 })))
        setClients((clientData || []).map((c: any) => ({ id: c.id, name: c.name || '' })))
        setEntries(transformedEntries)
        if (clientData && clientData.length > 0) setExpandedClients(new Set([clientData[0].id]))
      } catch (error) { console.error('Error loading data:', error) }
      finally { setLoading(false) }
    }
    loadData()
  }, [])

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

  const kpis = useMemo(() => {
    const totalHours = filteredEntries.reduce((sum, e) => sum + e.hours, 0)
    const totalRevenue = filteredEntries.reduce((sum, e) => sum + (e.hours * e.bill_rate), 0)
    const avgRate = totalHours > 0 ? totalRevenue / totalHours : 0
    const priorHours = priorPeriodEntries.reduce((sum, e) => sum + e.hours, 0)
    const priorRevenue = priorPeriodEntries.reduce((sum, e) => sum + (e.hours * e.bill_rate), 0)
    const activeMembers = teamMembers.filter(m => m.status === 'active')
    const totalCapacity = activeMembers.length * 160
    const utilization = totalCapacity > 0 ? (totalHours / totalCapacity) * 100 : 0
    const hoursTrend = priorHours > 0 ? ((totalHours - priorHours) / priorHours) * 100 : 0
    const revenueTrend = priorRevenue > 0 ? ((totalRevenue - priorRevenue) / priorRevenue) * 100 : 0
    return { totalHours, totalRevenue, avgRate, utilization, hoursTrend, revenueTrend, uniqueClients: new Set(filteredEntries.map(e => e.client_id).filter(Boolean)).size }
  }, [filteredEntries, priorPeriodEntries, teamMembers])

  const weekColumns = useMemo(() => getWeekColumns(dateRange.start, dateRange.end), [dateRange])

  const dataByClient = useMemo(() => {
    const clientData: Record<string, { id: string; name: string; totalHours: number; totalRevenue: number
      projects: Record<string, { id: string; name: string; members: Record<string, { id: string; name: string; rate: number; weekHours: Record<string, number>; totalHours: number; totalRevenue: number; weekEntries: Record<string, { id: string; hours: number }[]> }>; totalHours: number; totalRevenue: number }>
    }> = {}

    filteredEntries.forEach(entry => {
      const clientId = entry.client_id || 'unassigned'
      const clientName = entry.client_name || 'Unassigned'
      if (!clientData[clientId]) clientData[clientId] = { id: clientId, name: clientName, totalHours: 0, totalRevenue: 0, projects: {} }
      if (!clientData[clientId].projects[entry.project_id]) clientData[clientId].projects[entry.project_id] = { id: entry.project_id, name: entry.project_name, members: {}, totalHours: 0, totalRevenue: 0 }
      const project = clientData[clientId].projects[entry.project_id]
      if (!project.members[entry.team_member_id]) project.members[entry.team_member_id] = { id: entry.team_member_id, name: entry.team_member_name, rate: entry.bill_rate, weekHours: {}, totalHours: 0, totalRevenue: 0, weekEntries: {} }
      const member = project.members[entry.team_member_id]
      const weekCol = weekColumns.find((w, i) => {
        const weekStart = new Date(w.start); const nextWeek = weekColumns[i + 1]
        const nextWeekStart = nextWeek ? new Date(nextWeek.start) : new Date(dateRange.end); nextWeekStart.setDate(nextWeekStart.getDate() + 1)
        const entryDate = new Date(entry.date); return entryDate >= weekStart && entryDate < nextWeekStart
      })
      if (weekCol) { 
        member.weekHours[weekCol.start] = (member.weekHours[weekCol.start] || 0) + entry.hours
        if (!member.weekEntries[weekCol.start]) member.weekEntries[weekCol.start] = []
        member.weekEntries[weekCol.start].push({ id: entry.id, hours: entry.hours })
      }
      member.totalHours += entry.hours; member.totalRevenue += entry.hours * entry.bill_rate
      if (entry.bill_rate > member.rate) member.rate = entry.bill_rate
    })

    Object.values(clientData).forEach(client => {
      Object.values(client.projects).forEach(project => {
        Object.values(project.members).forEach(member => { project.totalHours += member.totalHours; project.totalRevenue += member.totalRevenue })
        client.totalHours += project.totalHours; client.totalRevenue += project.totalRevenue
      })
    })
    return Object.values(clientData).sort((a, b) => b.totalRevenue - a.totalRevenue)
  }, [filteredEntries, weekColumns, dateRange])

  const dataByEmployee = useMemo(() => {
    const employeeData: Record<string, { id: string; name: string; totalHours: number; totalRevenue: number; clients: Record<string, { name: string; hours: number; revenue: number }> }> = {}
    filteredEntries.forEach(entry => {
      if (!employeeData[entry.team_member_id]) employeeData[entry.team_member_id] = { id: entry.team_member_id, name: entry.team_member_name, totalHours: 0, totalRevenue: 0, clients: {} }
      const emp = employeeData[entry.team_member_id]; emp.totalHours += entry.hours; emp.totalRevenue += entry.hours * entry.bill_rate
      const clientKey = entry.client_id || 'unassigned'
      if (!emp.clients[clientKey]) emp.clients[clientKey] = { name: entry.client_name || 'Unassigned', hours: 0, revenue: 0 }
      emp.clients[clientKey].hours += entry.hours; emp.clients[clientKey].revenue += entry.hours * entry.bill_rate
    })
    return Object.values(employeeData).sort((a, b) => b.totalHours - a.totalHours)
  }, [filteredEntries])

  const revenueByClientData = useMemo(() => dataByClient.map((c, i) => ({ name: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name, value: c.totalRevenue, fill: CHART_COLORS[i % CHART_COLORS.length] })), [dataByClient])

  const weeklyTrendData = useMemo(() => weekColumns.map(week => {
    const weekEnd = new Date(week.start); weekEnd.setDate(weekEnd.getDate() + 6); const weekEndStr = weekEnd.toISOString().split('T')[0]
    const weekEntries = filteredEntries.filter(e => e.date >= week.start && e.date <= weekEndStr)
    return { week: week.label, hours: weekEntries.reduce((sum, e) => sum + e.hours, 0), revenue: weekEntries.reduce((sum, e) => sum + (e.hours * e.bill_rate), 0) }
  }), [weekColumns, filteredEntries])

  const updateEntryHours = async (weekEntries: { id: string; hours: number }[], newTotalHours: number) => {
    if (!companyId || !weekEntries || weekEntries.length === 0) return
    try {
      const currentTotal = weekEntries.reduce((sum, e) => sum + e.hours, 0)
      if (currentTotal === newTotalHours) return
      
      if (weekEntries.length === 1) {
        // Single entry - update directly
        const { error } = await supabase.from('time_entries').update({ hours: newTotalHours }).eq('id', weekEntries[0].id)
        if (error) throw error
        setEntries(prev => prev.map(e => e.id === weekEntries[0].id ? { ...e, hours: newTotalHours } : e))
      } else {
        // Multiple entries - adjust the first entry to make up the difference
        const diff = newTotalHours - currentTotal
        const newFirstHours = Math.max(0, weekEntries[0].hours + diff)
        const { error } = await supabase.from('time_entries').update({ hours: newFirstHours }).eq('id', weekEntries[0].id)
        if (error) throw error
        setEntries(prev => prev.map(e => e.id === weekEntries[0].id ? { ...e, hours: newFirstHours } : e))
      }
    } catch (error) { console.error('Error updating entry:', error) }
  }

  const toggleClient = (clientId: string) => setExpandedClients(prev => { const next = new Set(prev); if (next.has(clientId)) next.delete(clientId); else next.add(clientId); return next })
  const toggleProject = (projectId: string) => setExpandedProjects(prev => { const next = new Set(prev); if (next.has(projectId)) next.delete(projectId); else next.add(projectId); return next })

  const exportToExcel = () => {
    const headers = ['Date', 'Employee', 'Client', 'Project', 'Hours', 'Rate', 'Amount']
    const rows = filteredEntries.map(e => [e.date, e.team_member_name, e.client_name, e.project_name, e.hours, e.bill_rate, e.hours * e.bill_rate])
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob)
    link.download = `time-analytics-${dateRange.start}-to-${dateRange.end}.csv`; link.click()
  }

  const getFilterTitle = () => {
    if (selectedClient !== 'all') return clients.find(c => c.id === selectedClient)?.name || ''
    if (selectedEmployee !== 'all') return teamMembers.find(t => t.id === selectedEmployee)?.name || ''
    return 'All Clients'
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Time Analytics</h1>
          <p className="text-sm mt-1 text-slate-400">{getFilterTitle()}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportToExcel} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"><Download size={18} />Export</button>
          <button onClick={() => setShowEntryModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"><Plus size={18} />Add Entry</button>
        </div>
      </div>

      {/* Date Range & Filters */}
      <div className="p-4 rounded-xl border bg-slate-800 border-slate-700">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <button onClick={() => setShowDatePicker(!showDatePicker)} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors">
              <Calendar size={16} />{DATE_PRESETS.find(p => p.id === datePreset)?.label}<ChevronDown size={16} />
            </button>
            {showDatePicker && (
              <div className="absolute top-full left-0 mt-2 w-64 p-3 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50">
                <div className="space-y-1">
                  {DATE_PRESETS.map(preset => (
                    <button key={preset.id} onClick={() => { setDatePreset(preset.id); if (preset.id !== 'custom') setShowDatePicker(false) }}
                      className={`w-full text-left px-3 py-2 rounded text-sm ${datePreset === preset.id ? 'bg-blue-500 text-white' : 'text-slate-300 hover:bg-slate-700'}`}>{preset.label}</button>
                  ))}
                </div>
                {datePreset === 'custom' && (
                  <div className="mt-3 pt-3 border-t border-slate-700 space-y-2">
                    <div><label className="text-xs text-slate-400">Start</label><input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="w-full mt-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-slate-100" /></div>
                    <div><label className="text-xs text-slate-400">End</label><input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="w-full mt-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-slate-100" /></div>
                    <button onClick={() => setShowDatePicker(false)} className="w-full mt-2 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 rounded text-sm font-medium">Apply</button>
                  </div>
                )}
              </div>
            )}
          </div>
          <span className="text-slate-400 text-sm">{formatDate(dateRange.start)} — {formatDate(dateRange.end)}</span>
          <div className="h-6 w-px bg-slate-700" />
          <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100">
            <option value="all">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100">
            <option value="all">All Employees</option>
            {teamMembers.filter(t => t.status === 'active').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-100">
            <option value="all">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {(selectedClient !== 'all' || selectedEmployee !== 'all' || selectedProject !== 'all') && (
            <button onClick={() => { setSelectedClient('all'); setSelectedEmployee('all'); setSelectedProject('all') }} className="flex items-center gap-1 px-3 py-2 text-sm text-slate-400 hover:text-slate-200"><X size={14} />Clear</button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard title="Total Hours" value={kpis.totalHours} format="hours" trend={kpis.hoursTrend} trendLabel="vs prior" icon={<Clock size={16} />} color="blue" />
        <KPICard title="Revenue" value={kpis.totalRevenue} format="currency" trend={kpis.revenueTrend} trendLabel="vs prior" icon={<DollarSign size={16} />} color="emerald" />
        <KPICard title="Utilization" value={kpis.utilization} format="percent" icon={<Target size={16} />} color="amber" />
        <KPICard title="Avg Rate" value={kpis.avgRate} format="currency" icon={<TrendingUp size={16} />} color="purple" />
        <KPICard title="Active Clients" value={kpis.uniqueClients} icon={<Building2 size={16} />} color="blue" />
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-700 pb-2">
        {VIEW_TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Trends View */}
      {activeTab === 'trends' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CollapsibleSection title="Revenue by Client" icon={<PieChart size={16} />}>
            <div className="h-64">
              {revenueByClientData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie><Pie data={revenueByClientData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {revenueByClientData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                  </Pie><Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} /></RechartsPie>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-full text-slate-400">No data</div>}
            </div>
          </CollapsibleSection>
          <CollapsibleSection title="Weekly Trend" icon={<Activity size={16} />}>
            <div className="h-64">
              {weeklyTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis yAxisId="hours" orientation="left" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis yAxisId="revenue" orientation="right" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} formatter={(value: number, name: string) => [name === 'revenue' ? formatCurrency(value) : `${value.toFixed(1)} hrs`, name === 'revenue' ? 'Revenue' : 'Hours']} />
                    <Area yAxisId="hours" type="monotone" dataKey="hours" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} name="Hours" />
                    <Area yAxisId="revenue" type="monotone" dataKey="revenue" stroke="#10b981" fill="#10b981" fillOpacity={0.2} name="Revenue" />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-full text-slate-400">No data</div>}
            </div>
          </CollapsibleSection>
          <CollapsibleSection title="Hours by Employee" icon={<Users size={16} />}>
            <div className="h-64">
              {dataByEmployee.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataByEmployee.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} formatter={(value: number) => [`${value.toFixed(1)} hrs`, 'Hours']} />
                    <Bar dataKey="totalHours" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-full text-slate-400">No data</div>}
            </div>
          </CollapsibleSection>
          <CollapsibleSection title="Hours by Project" icon={<Briefcase size={16} />}>
            <div className="h-64">
              {filteredEntries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={Object.values(filteredEntries.reduce((acc, e) => { if (!acc[e.project_id]) acc[e.project_id] = { name: e.project_name.substring(0, 15), hours: 0 }; acc[e.project_id].hours += e.hours; return acc }, {} as Record<string, { name: string; hours: number }>)).sort((a, b) => b.hours - a.hours).slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} formatter={(value: number) => [`${value.toFixed(1)} hrs`, 'Hours']} />
                    <Bar dataKey="hours" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-full text-slate-400">No data</div>}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* By Client View */}
      {activeTab === 'byClient' && (
        <div className="space-y-3">
          {dataByClient.length > 0 ? dataByClient.map((client, clientIndex) => (
            <div key={client.id} className="rounded-xl border bg-slate-800 border-slate-700 overflow-hidden">
              <button onClick={() => toggleClient(client.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/50 transition-colors">
                <div className="flex items-center gap-3">
                  {expandedClients.has(client.id) ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                  <Building2 size={18} style={{ color: CHART_COLORS[clientIndex % CHART_COLORS.length] }} />
                  <h3 className="text-base font-semibold text-slate-100">{client.name}</h3>
                </div>
                <div className="flex items-center gap-6">
                  <span className="text-sm text-blue-400">{client.totalHours.toFixed(1)} hrs</span>
                  <span className="text-sm font-medium text-emerald-400">{formatCurrency(client.totalRevenue)}</span>
                </div>
              </button>
              {expandedClients.has(client.id) && (
                <div className="border-t border-slate-700">
                  {Object.values(client.projects).map((project, projectIndex) => (
                    <div key={project.id} className="border-b border-slate-700/50 last:border-b-0">
                      <button onClick={() => toggleProject(project.id)} className="w-full flex items-center justify-between px-6 py-2 hover:bg-slate-700/30 transition-colors">
                        <div className="flex items-center gap-2">
                          {expandedProjects.has(project.id) ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${['bg-blue-500/20 text-blue-400', 'bg-emerald-500/20 text-emerald-400', 'bg-amber-500/20 text-amber-400', 'bg-purple-500/20 text-purple-400', 'bg-rose-500/20 text-rose-400'][projectIndex % 5]}`}>{project.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                          <span className="text-slate-400">{project.totalHours.toFixed(1)} hrs</span>
                          <span className="text-emerald-400">{formatCurrency(project.totalRevenue)}</span>
                        </div>
                      </button>
                      {expandedProjects.has(project.id) && (
                        <div className="px-6 pb-3 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead><tr className="border-b border-slate-700">
                              <th className="px-2 py-2 text-left text-slate-400 font-medium w-32">Name</th>
                              <th className="px-2 py-2 text-right text-slate-400 font-medium w-20">Rate</th>
                              {weekColumns.map(week => <th key={week.start} className="px-2 py-2 text-right text-slate-400 font-medium w-16">{week.label}</th>)}
                              <th className="px-2 py-2 text-right text-slate-400 font-medium w-20">Total</th>
                              <th className="px-2 py-2 text-right text-slate-400 font-medium w-24">Amount</th>
                            </tr></thead>
                            <tbody>
                              {Object.values(project.members).sort((a, b) => b.totalHours - a.totalHours).map(member => (
                                <tr key={member.id} className="border-b border-slate-700/30 hover:bg-slate-700/20">
                                  <td className="px-2 py-2 text-slate-200">{member.name}</td>
                                  <td className="px-2 py-2 text-right text-slate-400">{formatCurrency(member.rate)}</td>
                                  {weekColumns.map(week => (
                                    <td key={week.start} className="px-2 py-2 text-right">
                                      <EditableCell value={member.weekHours[week.start] || 0} onSave={(newValue) => { const entries = member.weekEntries[week.start]; if (entries && entries.length > 0) updateEntryHours(entries, newValue) }} />
                                    </td>
                                  ))}
                                  <td className="px-2 py-2 text-right text-blue-400 font-medium">{member.totalHours.toFixed(1)}</td>
                                  <td className="px-2 py-2 text-right text-emerald-400 font-medium">{formatCurrency(member.totalRevenue)}</td>
                                </tr>
                              ))}
                              <tr className="bg-slate-900/30 font-medium">
                                <td className="px-2 py-2 text-slate-300">SITE TOTAL</td>
                                <td className="px-2 py-2"></td>
                                {weekColumns.map(week => { const weekTotal = Object.values(project.members).reduce((sum, m) => sum + (m.weekHours[week.start] || 0), 0); return <td key={week.start} className="px-2 py-2 text-right text-slate-300">{weekTotal.toFixed(1)}</td> })}
                                <td className="px-2 py-2 text-right text-blue-400">{project.totalHours.toFixed(1)}</td>
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
          )) : <div className="text-center py-12 text-slate-400">No time entries for this period</div>}
          {dataByClient.length > 0 && (
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-between">
              <span className="text-lg font-semibold text-slate-100">GRAND TOTAL</span>
              <div className="flex items-center gap-8">
                <span className="text-lg font-semibold text-blue-400">{kpis.totalHours.toFixed(1)} hrs</span>
                <span className="text-lg font-semibold text-emerald-400">{formatCurrency(kpis.totalRevenue)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* By Employee View */}
      {activeTab === 'byEmployee' && (
        <div className="space-y-3">
          {dataByEmployee.map((employee, index) => (
            <CollapsibleSection key={employee.id} title={employee.name} icon={<User size={16} style={{ color: CHART_COLORS[index % CHART_COLORS.length] }} />} badge={`${employee.totalHours.toFixed(1)} hrs`} badgeColor="blue" rightContent={<span className="text-emerald-400 font-medium mr-4">{formatCurrency(employee.totalRevenue)}</span>} defaultExpanded={index === 0}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-medium text-slate-400 uppercase mb-2">By Client</h4>
                  <div className="space-y-2">
                    {Object.entries(employee.clients).sort((a, b) => b[1].hours - a[1].hours).map(([clientId, data], i) => (
                      <div key={clientId} className="flex items-center justify-between p-2 rounded bg-slate-900/50">
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} /><span className="text-sm text-slate-200">{data.name}</span></div>
                        <div className="flex items-center gap-4 text-sm"><span className="text-blue-400">{data.hours.toFixed(1)} hrs</span><span className="text-emerald-400">{formatCurrency(data.revenue)}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-medium text-slate-400 uppercase mb-2">Distribution</h4>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie><Pie data={Object.entries(employee.clients).map(([id, data], i) => ({ name: data.name, value: data.hours, fill: CHART_COLORS[i % CHART_COLORS.length] }))} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value">
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

      {/* Detailed View */}
      {activeTab === 'detailed' && (
        <CollapsibleSection title="Time Entries" badge={filteredEntries.length} icon={<Calendar size={16} />}>
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-900/50">
                <th className="px-4 py-3 text-left font-medium text-slate-400">Date</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Employee</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Client</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Project</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">Hours</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">Rate</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Notes</th>
              </tr></thead>
              <tbody>
                {filteredEntries.length > 0 ? filteredEntries.slice(0, 100).map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-700 hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{formatDate(entry.date)}</td>
                    <td className="px-4 py-3 text-slate-100">{entry.team_member_name}</td>
                    <td className="px-4 py-3 text-slate-400">{entry.client_name || '—'}</td>
                    <td className="px-4 py-3 text-slate-100">{entry.project_name}</td>
                    <td className="px-4 py-3 text-right text-blue-500 font-medium">{entry.hours}</td>
                    <td className="px-4 py-3 text-right text-slate-400">{formatCurrency(entry.bill_rate)}</td>
                    <td className="px-4 py-3 text-right text-emerald-500 font-medium">{formatCurrency(entry.hours * entry.bill_rate)}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-[150px] truncate">{entry.notes || '—'}</td>
                  </tr>
                )) : <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-400">No time entries found</td></tr>}
              </tbody>
            </table>
          </div>
          {filteredEntries.length > 100 && <p className="text-center text-sm text-slate-400 mt-2">Showing first 100 of {filteredEntries.length} entries</p>}
        </CollapsibleSection>
      )}

      {/* Entry Modal */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">Add Time Entry</h3>
            <div className="space-y-4">
              <div><label className="block text-sm text-slate-400 mb-1">Date *</label><input type="date" value={formData.date} onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100" /></div>
              <div><label className="block text-sm text-slate-400 mb-1">Employee *</label><select value={formData.team_member_id} onChange={(e) => setFormData(prev => ({ ...prev, team_member_id: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"><option value="">Select...</option>{teamMembers.filter(t => t.status === 'active').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div><label className="block text-sm text-slate-400 mb-1">Project *</label><select value={formData.project_id} onChange={(e) => setFormData(prev => ({ ...prev, project_id: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"><option value="">Select...</option>{projects.map(p => <option key={p.id} value={p.id}>{p.client ? `${p.client} - ` : ''}{p.name}</option>)}</select></div>
              <div><label className="block text-sm text-slate-400 mb-1">Hours *</label><input type="number" value={formData.hours} onChange={(e) => setFormData(prev => ({ ...prev, hours: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100" placeholder="8" step="0.5" /></div>
              <div><label className="block text-sm text-slate-400 mb-1">Notes</label><textarea value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 resize-none" rows={2} placeholder="Description..." /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowEntryModal(false)} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium">Cancel</button>
              <button onClick={() => setShowEntryModal(false)} className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium">Add Entry</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
