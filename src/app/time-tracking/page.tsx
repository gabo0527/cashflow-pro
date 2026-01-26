'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  Search, Filter, Download, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Clock, Plus, Edit2, X, Check, Trash2, Calendar, Users, DollarSign, BarChart3
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { supabase, getCurrentUser, fetchProjects, fetchClients } from '@/lib/supabase'

// Types
interface TimeEntry {
  id: string
  date: string
  hours: number
  team_member_id: string
  team_member_name: string
  team_member_email: string
  project_id: string
  project_name: string
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
  bill_rate?: number
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

const getWeekDates = (date: Date): { start: string; end: string } => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0]
  }
}

const getMonthDates = (date: Date): { start: string; end: string } => {
  const year = date.getFullYear()
  const month = date.getMonth()
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  }
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

// Collapsible Section Component
function CollapsibleSection({ 
  title, 
  children, 
  defaultExpanded = true,
  badge,
  icon
}: { 
  title: string
  children: React.ReactNode
  defaultExpanded?: boolean
  badge?: string | number
  icon?: React.ReactNode
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  
  return (
    <div className="rounded-xl border bg-slate-800 border-slate-700 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-slate-400">{icon}</span>}
          <h3 className="text-sm font-medium text-slate-100">{title}</h3>
          {badge !== undefined && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300">
              {badge}
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>
      {isExpanded && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  )
}

export default function TimeTrackingPage() {
  // Data state
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)

  // View state
  const [viewMode, setViewMode] = useState<'weekly' | 'monthly'>('weekly')
  const [currentDate, setCurrentDate] = useState(new Date())

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTeamMember, setSelectedTeamMember] = useState<string>('all')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)

  // Modal state
  const [showEntryModal, setShowEntryModal] = useState(false)
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    team_member_id: '',
    project_id: '',
    hours: '',
    notes: '',
  })

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

        // Fetch team members
        const { data: teamData } = await supabase
          .from('team_members')
          .select('*')
          .eq('company_id', profile.company_id)

        // Fetch projects
        const { data: projData } = await supabase
          .from('projects')
          .select('*')
          .eq('company_id', profile.company_id)

        // Fetch clients
        const { data: clientData } = await supabase
          .from('clients')
          .select('*')
          .eq('company_id', profile.company_id)

        // Fetch time entries with joins
        const { data: entriesData } = await supabase
          .from('time_entries')
          .select(`
            *,
            team_members (id, name, email),
            projects (id, name, client, bill_rate)
          `)
          .eq('company_id', profile.company_id)
          .order('date', { ascending: false })

        // Transform entries
        const transformedEntries = (entriesData || []).map((e: any) => ({
          id: e.id,
          date: e.date,
          hours: e.hours || 0,
          team_member_id: e.team_member_id,
          team_member_name: e.team_members?.name || 'Unknown',
          team_member_email: e.team_members?.email || '',
          project_id: e.project_id,
          project_name: e.projects?.name || 'Unknown',
          client_name: e.projects?.client || '',
          bill_rate: e.bill_rate || e.projects?.bill_rate || 0,
          notes: e.notes || null,
        }))

        setTeamMembers((teamData || []).map((t: any) => ({
          id: t.id,
          name: t.name || '',
          email: t.email || '',
          status: t.status || 'active',
        })))

        setProjects((projData || []).map((p: any) => ({
          id: p.id,
          name: p.name || '',
          client: p.client || '',
          bill_rate: p.bill_rate || 0,
        })))

        setClients((clientData || []).map((c: any) => ({
          id: c.id,
          name: c.name || '',
        })))

        setEntries(transformedEntries)
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Date range based on view mode
  const dateRange = useMemo(() => {
    if (viewMode === 'weekly') {
      return getWeekDates(currentDate)
    } else {
      return getMonthDates(currentDate)
    }
  }, [viewMode, currentDate])

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      // Date range filter
      if (entry.date < dateRange.start || entry.date > dateRange.end) return false

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!entry.team_member_name?.toLowerCase().includes(query) && 
            !entry.project_name?.toLowerCase().includes(query) &&
            !entry.notes?.toLowerCase().includes(query)) return false
      }

      // Team member filter
      if (selectedTeamMember !== 'all' && entry.team_member_id !== selectedTeamMember) return false

      // Project filter
      if (selectedProject !== 'all' && entry.project_id !== selectedProject) return false

      // Client filter
      if (selectedClient !== 'all' && entry.client_name !== selectedClient) return false

      return true
    }).sort((a, b) => b.date.localeCompare(a.date))
  }, [entries, dateRange, searchQuery, selectedTeamMember, selectedProject, selectedClient])

  // Summary calculations
  const summary = useMemo(() => {
    const totalHours = filteredEntries.reduce((sum, e) => sum + e.hours, 0)
    const billableAmount = filteredEntries.reduce((sum, e) => sum + (e.hours * e.bill_rate), 0)
    const uniqueProjects = new Set(filteredEntries.map(e => e.project_id)).size
    const uniqueMembers = new Set(filteredEntries.map(e => e.team_member_id)).size

    return {
      totalHours,
      billableAmount,
      uniqueProjects,
      uniqueMembers,
      avgRate: totalHours > 0 ? billableAmount / totalHours : 0,
    }
  }, [filteredEntries])

  // Chart data - Hours by Project
  const hoursByProjectData = useMemo(() => {
    const byProject: Record<string, number> = {}
    filteredEntries.forEach(e => {
      byProject[e.project_name] = (byProject[e.project_name] || 0) + e.hours
    })
    return Object.entries(byProject)
      .map(([name, hours]) => ({ name: name.length > 15 ? name.substring(0, 15) + '...' : name, hours }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8)
  }, [filteredEntries])

  // Chart data - Hours by Team Member
  const hoursByMemberData = useMemo(() => {
    const byMember: Record<string, number> = {}
    filteredEntries.forEach(e => {
      byMember[e.team_member_name] = (byMember[e.team_member_name] || 0) + e.hours
    })
    return Object.entries(byMember)
      .map(([name, hours]) => ({ name, hours }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8)
  }, [filteredEntries])

  // Navigation
  const navigatePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate)
    if (viewMode === 'weekly') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
    }
    setCurrentDate(newDate)
  }

  const getPeriodLabel = () => {
    if (viewMode === 'weekly') {
      const { start, end } = dateRange
      return `${formatDate(start)} - ${formatDate(end)}`
    } else {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    }
  }

  // Form handlers
  const openAddEntry = () => {
    setEditingEntry(null)
    setFormData({
      date: new Date().toISOString().split('T')[0],
      team_member_id: '',
      project_id: '',
      hours: '',
      notes: '',
    })
    setShowEntryModal(true)
  }

  const openEditEntry = (entry: TimeEntry) => {
    setEditingEntry(entry)
    setFormData({
      date: entry.date,
      team_member_id: entry.team_member_id,
      project_id: entry.project_id,
      hours: entry.hours.toString(),
      notes: entry.notes || '',
    })
    setShowEntryModal(true)
  }

  const saveEntry = async () => {
    if (!companyId || !formData.team_member_id || !formData.project_id || !formData.hours) return

    const project = projects.find(p => p.id === formData.project_id)
    
    try {
      const entryData = {
        company_id: companyId,
        date: formData.date,
        team_member_id: formData.team_member_id,
        project_id: formData.project_id,
        hours: parseFloat(formData.hours) || 0,
        bill_rate: project?.bill_rate || 0,
        notes: formData.notes || null,
      }

      if (editingEntry) {
        const { error } = await supabase
          .from('time_entries')
          .update(entryData)
          .eq('id', editingEntry.id)

        if (error) throw error

        // Refresh data
        const teamMember = teamMembers.find(t => t.id === formData.team_member_id)
        setEntries(prev => prev.map(e => 
          e.id === editingEntry.id ? {
            ...e,
            ...entryData,
            team_member_name: teamMember?.name || '',
            team_member_email: teamMember?.email || '',
            project_name: project?.name || '',
            client_name: project?.client || '',
          } : e
        ))
      } else {
        const { data, error } = await supabase
          .from('time_entries')
          .insert(entryData)
          .select()
          .single()

        if (error) throw error

        const teamMember = teamMembers.find(t => t.id === formData.team_member_id)
        const newEntry: TimeEntry = {
          id: data.id,
          date: data.date,
          hours: data.hours,
          team_member_id: data.team_member_id,
          team_member_name: teamMember?.name || '',
          team_member_email: teamMember?.email || '',
          project_id: data.project_id,
          project_name: project?.name || '',
          client_name: project?.client || '',
          bill_rate: data.bill_rate,
          notes: data.notes,
        }
        setEntries(prev => [newEntry, ...prev])
      }

      setShowEntryModal(false)
    } catch (error) {
      console.error('Error saving entry:', error)
    }
  }

  const deleteEntry = async (entryId: string) => {
    if (!confirm('Delete this time entry?')) return

    try {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', entryId)

      if (error) throw error

      setEntries(prev => prev.filter(e => e.id !== entryId))
    } catch (error) {
      console.error('Error deleting entry:', error)
    }
  }

  // Export
  const exportToExcel = () => {
    const headers = ['Date', 'Team Member', 'Email', 'Project', 'Client', 'Hours', 'Rate', 'Amount', 'Notes']
    const rows = filteredEntries.map(e => [
      e.date, e.team_member_name, e.team_member_email, e.project_name, e.client_name,
      e.hours, e.bill_rate, e.hours * e.bill_rate, e.notes || ''
    ])
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `time-entries-${dateRange.start}-${dateRange.end}.csv`
    link.click()
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedTeamMember('all')
    setSelectedProject('all')
    setSelectedClient('all')
  }

  const hasActiveFilters = searchQuery || selectedTeamMember !== 'all' || selectedProject !== 'all' || selectedClient !== 'all'

  // Get unique clients from projects
  const uniqueClients = useMemo(() => {
    const clientSet = new Set(projects.map(p => p.client).filter(Boolean))
    return Array.from(clientSet)
  }, [projects])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Time Tracking</h1>
          <p className="text-sm mt-1 text-slate-400">Track hours and billable time</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={18} />
            Export
          </button>
          <button
            onClick={openAddEntry}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={18} />
            Add Entry
          </button>
        </div>
      </div>

      {/* Period Navigation */}
      <div className="flex items-center justify-between p-4 rounded-xl border bg-slate-800 border-slate-700">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigatePeriod('prev')}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-lg font-medium text-slate-100 min-w-[200px] text-center">
            {getPeriodLabel()}
          </span>
          <button
            onClick={() => navigatePeriod('next')}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('weekly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'weekly' ? 'bg-blue-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setViewMode('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'monthly' ? 'bg-blue-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-100'
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <CollapsibleSection title="Summary" badge={`${summary.totalHours} hrs`} icon={<Clock size={16} />}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="p-4 rounded-lg bg-slate-900/50">
            <p className="text-xs font-medium text-slate-400">Total Hours</p>
            <p className="text-xl font-semibold mt-1 text-blue-500">{summary.totalHours.toFixed(1)}</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/50">
            <p className="text-xs font-medium text-slate-400">Billable Amount</p>
            <p className="text-xl font-semibold mt-1 text-emerald-500">{formatCurrency(summary.billableAmount)}</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/50">
            <p className="text-xs font-medium text-slate-400">Avg Rate</p>
            <p className="text-xl font-semibold mt-1 text-slate-100">{formatCurrency(summary.avgRate)}/hr</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/50">
            <p className="text-xs font-medium text-slate-400">Projects</p>
            <p className="text-xl font-semibold mt-1 text-slate-100">{summary.uniqueProjects}</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/50">
            <p className="text-xs font-medium text-slate-400">Team Members</p>
            <p className="text-xl font-semibold mt-1 text-slate-100">{summary.uniqueMembers}</p>
          </div>
        </div>
      </CollapsibleSection>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CollapsibleSection title="Hours by Project" icon={<BarChart3 size={16} />}>
          <div className="h-48">
            {hoursByProjectData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hoursByProjectData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                  <Bar dataKey="hours" name="Hours" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                    {hoursByProjectData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">No data</div>
            )}
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Hours by Team Member" icon={<Users size={16} />}>
          <div className="h-48">
            {hoursByMemberData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hoursByMemberData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} />
                  <Bar dataKey="hours" name="Hours" fill="#10b981" radius={[0, 4, 4, 0]}>
                    {hoursByMemberData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">No data</div>
            )}
          </div>
        </CollapsibleSection>
      </div>

      {/* Time Entries Table */}
      <CollapsibleSection title="Time Entries" badge={filteredEntries.length} icon={<Calendar size={16} />}>
        {/* Search and Filters */}
        <div className="space-y-3 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search entries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showFilters || hasActiveFilters ? 'bg-blue-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-100'}`}
            >
              <Filter size={16} />
              Filters
            </button>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-100">
                <X size={16} /> Clear
              </button>
            )}
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-700">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Team Member</label>
                <select value={selectedTeamMember} onChange={(e) => setSelectedTeamMember(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100">
                  <option value="all">All Team Members</option>
                  {teamMembers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Project</label>
                <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100">
                  <option value="all">All Projects</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Client</label>
                <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100">
                  <option value="all">All Clients</option>
                  {uniqueClients.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="px-4 py-3 text-left font-medium text-slate-400">Date</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Team Member</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Project</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Client</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">Hours</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">Rate</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Notes</th>
                <th className="px-4 py-3 text-center font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.length > 0 ? (
                filteredEntries.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-700 hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">{formatDate(entry.date)}</td>
                    <td className="px-4 py-3 text-slate-100">{entry.team_member_name}</td>
                    <td className="px-4 py-3 text-slate-100">{entry.project_name}</td>
                    <td className="px-4 py-3 text-slate-400">{entry.client_name || '—'}</td>
                    <td className="px-4 py-3 text-right text-blue-500 font-medium">{entry.hours}</td>
                    <td className="px-4 py-3 text-right text-slate-400">{formatCurrency(entry.bill_rate)}</td>
                    <td className="px-4 py-3 text-right text-emerald-500 font-medium">{formatCurrency(entry.hours * entry.bill_rate)}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-[150px] truncate" title={entry.notes}>{entry.notes || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEditEntry(entry)} className="p-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600" title="Edit">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => deleteEntry(entry.id)} className="p-1.5 rounded bg-rose-500/20 text-rose-500 hover:bg-rose-500/30" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">No time entries found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      {/* Entry Modal */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">
              {editingEntry ? 'Edit Time Entry' : 'Add Time Entry'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Date *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Team Member *</label>
                <select
                  value={formData.team_member_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, team_member_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                >
                  <option value="">Select team member...</option>
                  {teamMembers.filter(t => t.status === 'active').map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Project *</label>
                <select
                  value={formData.project_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, project_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                >
                  <option value="">Select project...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.client ? `${p.client} - ` : ''}{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Hours *</label>
                <input
                  type="text"
                  value={formData.hours}
                  onChange={(e) => setFormData(prev => ({ ...prev, hours: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                  placeholder="8"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes (optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 resize-none"
                  rows={2}
                  placeholder="Description of work..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEntryModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEntry}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
              >
                {editingEntry ? 'Save Changes' : 'Add Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
