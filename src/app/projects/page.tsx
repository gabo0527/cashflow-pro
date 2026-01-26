'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  Search, Filter, Download, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  FolderOpen, Plus, Edit2, X, Check, Users, DollarSign, TrendingUp,
  BarChart3, Target, Calendar, MoreHorizontal, GitBranch, Trash2
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { supabase, getCurrentUser, fetchProjects, fetchClients } from '@/lib/supabase'

// Types
interface Project {
  id: string
  name: string
  client: string
  client_id?: string
  status: string
  budget_type: 'lump_sum' | 'nte' | 'tm'
  budget: number
  spent: number
  start_date?: string
  end_date?: string
  resources: number
  parent_id?: string // For Change Orders
  is_change_order?: boolean
  co_number?: number
  description?: string
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

const formatCompactCurrency = (value: number): string => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`
  return `$${value}`
}

const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`
}

const STATUS_OPTIONS = [
  { id: 'active', label: 'Active', color: 'emerald' },
  { id: 'completed', label: 'Completed', color: 'blue' },
  { id: 'on_hold', label: 'On Hold', color: 'amber' },
  { id: 'archived', label: 'Archived', color: 'slate' },
]

const BUDGET_TYPES = [
  { id: 'lump_sum', label: 'Lump Sum', description: 'Fixed fee project' },
  { id: 'nte', label: 'NTE', description: 'Not to exceed cap' },
  { id: 'tm', label: 'T&M', description: 'Time & Materials' },
]

const getStatusStyle = (status: string) => {
  const styles: Record<string, { bg: string; text: string }> = {
    active: { bg: 'bg-emerald-500/20', text: 'text-emerald-500' },
    completed: { bg: 'bg-blue-500/20', text: 'text-blue-500' },
    on_hold: { bg: 'bg-amber-500/20', text: 'text-amber-500' },
    archived: { bg: 'bg-slate-500/20', text: 'text-slate-400' },
  }
  return styles[status] || styles.active
}

const getBudgetLabel = (type: string) => {
  const labels: Record<string, string> = {
    lump_sum: 'Budget',
    nte: 'NTE Cap',
    tm: 'Spent',
  }
  return labels[type] || 'Budget'
}

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

export default function ProjectsPage() {
  // Data state
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)

  // Modal state
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [isAddingCO, setIsAddingCO] = useState(false)
  const [parentProjectId, setParentProjectId] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    client_id: '',
    status: 'active',
    budget_type: 'lump_sum' as 'lump_sum' | 'nte' | 'tm',
    budget: '',
    spent: '',
    start_date: '',
    end_date: '',
    resources: '',
    description: '',
  })

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)

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

        const [projRes, clientRes] = await Promise.all([
          fetchProjects(profile.company_id),
          fetchClients(profile.company_id)
        ])

        const clientsData = clientRes.data || []

        // Transform projects data with defaults and client names
        const transformedProjects = (projRes.data || []).map((p: any) => {
          const clientObj = clientsData.find((c: any) => c.id === p.client_id)
          return {
            id: p.id,
            name: p.name || '',
            client: clientObj?.name || '',
            client_id: p.client_id,
            status: p.status || 'active',
            budget_type: p.budget_type || 'lump_sum',
            budget: p.budget || 0,
            spent: p.spent || 0,
            start_date: p.start_date,
            end_date: p.end_date,
            resources: p.resources || 0,
            parent_id: p.parent_id,
            is_change_order: p.is_change_order || false,
            co_number: p.co_number,
            description: p.description,
          }
        })

        setProjects(transformedProjects)
        setClients(clientsData)
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Get unique years from projects
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    projects.forEach(p => {
      if (p.start_date) years.add(p.start_date.substring(0, 4))
    })
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [projects])

  // Filter and organize projects (with COs nested)
  const organizedProjects = useMemo(() => {
    // First filter
    const filtered = projects.filter(p => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!p.name?.toLowerCase().includes(query) && !p.client?.toLowerCase().includes(query)) return false
      }
      if (selectedClient !== 'all' && p.client !== selectedClient) return false
      if (selectedStatus !== 'all' && p.status !== selectedStatus) return false
      if (selectedYear !== 'all' && p.start_date && !p.start_date.startsWith(selectedYear)) return false
      return true
    })

    // Separate parent projects and COs
    const parents = filtered.filter(p => !p.is_change_order)
    const changeOrders = filtered.filter(p => p.is_change_order)

    // Build nested structure
    const result: (Project & { changeOrders?: Project[] })[] = []
    
    parents.forEach(parent => {
      const cos = changeOrders.filter(co => co.parent_id === parent.id)
      result.push({ ...parent, changeOrders: cos })
    })

    // Sort by status (active first) then name
    return result.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1
      if (a.status !== 'active' && b.status === 'active') return 1
      return a.name.localeCompare(b.name)
    })
  }, [projects, searchQuery, selectedClient, selectedStatus, selectedYear])

  // Summary calculations
  const summary = useMemo(() => {
    const activeProjects = projects.filter(p => p.status === 'active' && !p.is_change_order)
    const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0)
    const totalSpent = projects.reduce((sum, p) => sum + (p.spent || 0), 0)
    const totalResources = activeProjects.reduce((sum, p) => sum + (p.resources || 0), 0)
    
    const margins = projects
      .filter(p => p.budget > 0)
      .map(p => ((p.budget - p.spent) / p.budget) * 100)
    const avgMargin = margins.length > 0 ? margins.reduce((a, b) => a + b, 0) / margins.length : 0

    return {
      activeCount: activeProjects.length,
      totalBudget,
      totalSpent,
      totalResources,
      avgMargin,
      remaining: totalBudget - totalSpent
    }
  }, [projects])

  // Chart data - Budget vs Spent
  const budgetChartData = useMemo(() => {
    return organizedProjects
      .filter(p => !p.is_change_order && p.budget > 0)
      .slice(0, 10)
      .map(p => {
        const totalBudget = p.budget + (p.changeOrders?.reduce((sum, co) => sum + co.budget, 0) || 0)
        const totalSpent = p.spent + (p.changeOrders?.reduce((sum, co) => sum + co.spent, 0) || 0)
        return {
          name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
          budget: totalBudget,
          spent: totalSpent,
        }
      })
  }, [organizedProjects])

  // Chart data - Margin by Project
  const marginChartData = useMemo(() => {
    return organizedProjects
      .filter(p => !p.is_change_order && p.budget > 0)
      .slice(0, 10)
      .map(p => {
        const totalBudget = p.budget + (p.changeOrders?.reduce((sum, co) => sum + co.budget, 0) || 0)
        const totalSpent = p.spent + (p.changeOrders?.reduce((sum, co) => sum + co.spent, 0) || 0)
        const margin = ((totalBudget - totalSpent) / totalBudget) * 100
        return {
          name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
          margin: Math.round(margin * 10) / 10,
          fill: margin >= 20 ? '#10b981' : margin >= 0 ? '#f59e0b' : '#ef4444'
        }
      })
      .sort((a, b) => b.margin - a.margin)
  }, [organizedProjects])

  // Pagination
  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return organizedProjects.slice(start, start + pageSize)
  }, [organizedProjects, currentPage, pageSize])

  const totalPages = Math.ceil(organizedProjects.length / pageSize)

  // Form handlers
  const openAddProject = () => {
    setEditingProject(null)
    setIsAddingCO(false)
    setParentProjectId(null)
    setFormData({
      name: '', client_id: '', status: 'active', budget_type: 'lump_sum',
      budget: '', spent: '', start_date: '', end_date: '', resources: '', description: ''
    })
    setShowProjectModal(true)
  }

  const openAddCO = (parentId: string, parentName: string) => {
    setEditingProject(null)
    setIsAddingCO(true)
    setParentProjectId(parentId)
    const parent = projects.find(p => p.id === parentId)
    const existingCOs = projects.filter(p => p.parent_id === parentId).length
    setFormData({
      name: `${parentName} - CO${existingCOs + 1}`,
      client_id: parent?.client_id || '',
      status: 'active',
      budget_type: parent?.budget_type || 'lump_sum',
      budget: '', spent: '', start_date: '', end_date: '', 
      resources: '', description: ''
    })
    setShowProjectModal(true)
  }

  const openEditProject = (project: Project) => {
    setEditingProject(project)
    setIsAddingCO(false)
    setParentProjectId(null)
    setFormData({
      name: project.name,
      client_id: project.client_id || '',
      status: project.status,
      budget_type: project.budget_type,
      budget: project.budget.toString(),
      spent: project.spent.toString(),
      start_date: project.start_date || '',
      end_date: project.end_date || '',
      resources: project.resources.toString(),
      description: project.description || '',
    })
    setShowProjectModal(true)
  }

  const saveProject = async () => {
    if (!companyId || !formData.name) return

    try {
      // Only include columns that exist in the database
      const projectData: any = {
        company_id: companyId,
        name: formData.name,
        client_id: formData.client_id || null,
        status: formData.status,
        budget: parseFloat(formData.budget) || 0,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
      }

      if (editingProject) {
        // Don't include company_id in update
        const { company_id, ...updateData } = projectData
        const { error } = await supabase
          .from('projects')
          .update(updateData)
          .eq('id', editingProject.id)

        if (error) throw error

        // Get client name for display
        const clientName = clients.find(c => c.id === formData.client_id)?.name || ''
        setProjects(prev => prev.map(p => 
          p.id === editingProject.id ? { 
            ...p, 
            ...updateData, 
            client: clientName,
            budget_type: formData.budget_type,
            spent: parseFloat(formData.spent) || 0,
            resources: parseInt(formData.resources) || 0,
            description: formData.description,
          } as Project : p
        ))
      } else {
        const { data, error } = await supabase
          .from('projects')
          .insert(projectData)
          .select()
          .single()

        if (error) throw error

        // Get client name for display
        const clientName = clients.find(c => c.id === formData.client_id)?.name || ''
        setProjects(prev => [...prev, { 
          ...data, 
          client: clientName,
          budget_type: formData.budget_type || 'lump_sum',
          spent: 0,
          resources: 0,
        } as Project])
      }

      setShowProjectModal(false)
    } catch (error) {
      console.error('Error saving project:', error)
    }
  }

  const updateStatus = async (projectId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus })
        .eq('id', projectId)

      if (error) throw error

      setProjects(prev => prev.map(p => 
        p.id === projectId ? { ...p, status: newStatus } : p
      ))
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const deleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(`Are you sure you want to delete "${projectName}"? This will also delete any change orders.`)) return
    
    try {
      // First delete any change orders
      await supabase
        .from('projects')
        .delete()
        .eq('parent_id', projectId)
      
      // Then delete the project
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)

      if (error) throw error

      setProjects(prev => prev.filter(p => p.id !== projectId && p.parent_id !== projectId))
    } catch (error) {
      console.error('Error deleting project:', error)
    }
  }

  // Export
  const exportToExcel = () => {
    const headers = ['Project', 'Client', 'Status', 'Type', 'Budget', 'Spent', 'Remaining', 'Margin %', 'Resources', 'Start', 'End']
    const rows = projects.map(p => {
      const remaining = p.budget - p.spent
      const margin = p.budget > 0 ? ((remaining / p.budget) * 100).toFixed(1) : '0'
      return [p.name, p.client, p.status, p.budget_type, p.budget, p.spent, remaining, margin, p.resources, p.start_date || '', p.end_date || '']
    })
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `projects-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedClient('all')
    setSelectedStatus('all')
    setSelectedYear('all')
  }

  const hasActiveFilters = searchQuery || selectedClient !== 'all' || selectedStatus !== 'all' || selectedYear !== 'all'

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
          <h1 className="text-2xl font-semibold text-slate-100">Projects</h1>
          <p className="text-sm mt-1 text-slate-400">Track budgets, resources, and profitability</p>
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
            onClick={openAddProject}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={18} />
            Add Project
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <CollapsibleSection title="Summary" badge={summary.activeCount + ' active'} icon={<Target size={16} />}>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="p-4 rounded-lg bg-slate-900/50">
            <p className="text-xs font-medium text-slate-400">Active Projects</p>
            <p className="text-xl font-semibold mt-1 text-blue-500">{summary.activeCount}</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/50">
            <p className="text-xs font-medium text-slate-400">Total Budget</p>
            <p className="text-xl font-semibold mt-1 text-slate-100">{formatCurrency(summary.totalBudget)}</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/50">
            <p className="text-xs font-medium text-slate-400">Total Spent</p>
            <p className="text-xl font-semibold mt-1 text-rose-500">{formatCurrency(summary.totalSpent)}</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/50">
            <p className="text-xs font-medium text-slate-400">Avg Margin</p>
            <p className={`text-xl font-semibold mt-1 ${summary.avgMargin >= 20 ? 'text-emerald-500' : summary.avgMargin >= 0 ? 'text-amber-500' : 'text-rose-500'}`}>
              {formatPercent(summary.avgMargin)}
            </p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/50">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-slate-400" />
              <p className="text-xs font-medium text-slate-400">Active Resources</p>
            </div>
            <p className="text-xl font-semibold mt-1 text-slate-100">{summary.totalResources}</p>
          </div>
        </div>
      </CollapsibleSection>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Budget vs Spent Chart */}
        <CollapsibleSection title="Budget vs Spent" icon={<BarChart3 size={16} />}>
          <div className="h-64">
            {budgetChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={budgetChartData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={formatCompactCurrency} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="budget" name="Budget" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="spent" name="Spent" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">No project data</div>
            )}
          </div>
        </CollapsibleSection>

        {/* Margin Chart */}
        <CollapsibleSection title="Margin by Project" icon={<TrendingUp size={16} />}>
          <div className="h-64">
            {marginChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={marginChartData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={['auto', 'auto']} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} formatter={(value: number) => `${value}%`} />
                  <Bar dataKey="margin" name="Margin %" radius={[0, 4, 4, 0]}>
                    {marginChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">No project data</div>
            )}
          </div>
        </CollapsibleSection>
      </div>

      {/* Projects Table */}
      <CollapsibleSection title="Projects" badge={organizedProjects.length} icon={<FolderOpen size={16} />}>
        {/* Search and Filters */}
        <div className="space-y-3 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search projects or clients..."
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
                <label className="block text-xs font-medium text-slate-400 mb-1">Client</label>
                <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100">
                  <option value="all">All Clients</option>
                  {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
                <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100">
                  <option value="all">All Statuses</option>
                  {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Year</label>
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100">
                  <option value="all">All Years</option>
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
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
                <th className="px-4 py-3 text-left font-medium text-slate-400">Project</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Client</th>
                <th className="px-4 py-3 text-center font-medium text-slate-400">Status</th>
                <th className="px-4 py-3 text-center font-medium text-slate-400">Type</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">Budget</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">Spent</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">Remaining</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">Margin</th>
                <th className="px-4 py-3 text-center font-medium text-slate-400">Resources</th>
                <th className="px-4 py-3 text-center font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProjects.length > 0 ? (
                paginatedProjects.map((project) => {
                  const statusStyle = getStatusStyle(project.status)
                  const totalBudget = project.budget + (project.changeOrders?.reduce((sum, co) => sum + co.budget, 0) || 0)
                  const totalSpent = project.spent + (project.changeOrders?.reduce((sum, co) => sum + co.spent, 0) || 0)
                  const remaining = totalBudget - totalSpent
                  const margin = totalBudget > 0 ? (remaining / totalBudget) * 100 : 0

                  return (
                    <React.Fragment key={project.id}>
                      {/* Parent Project Row */}
                      <tr className="border-t border-slate-700 hover:bg-slate-700/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-100">{project.name}</span>
                            {project.changeOrders && project.changeOrders.length > 0 && (
                              <span className="px-1.5 py-0.5 text-xs rounded bg-slate-700 text-slate-400">
                                +{project.changeOrders.length} CO
                              </span>
                            )}
                          </div>
                          {project.description && <p className="text-xs text-slate-500 mt-0.5">{project.description}</p>}
                        </td>
                        <td className="px-4 py-3 text-slate-300">{project.client || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <select
                            value={project.status}
                            onChange={(e) => updateStatus(project.id, e.target.value)}
                            className={`px-2 py-1 rounded text-xs font-medium border-0 cursor-pointer ${statusStyle.bg} ${statusStyle.text}`}
                          >
                            {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs text-slate-400">{BUDGET_TYPES.find(b => b.id === project.budget_type)?.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-100 font-medium">{formatCurrency(totalBudget)}</td>
                        <td className="px-4 py-3 text-right text-rose-500">{formatCurrency(totalSpent)}</td>
                        <td className={`px-4 py-3 text-right font-medium ${remaining >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{formatCurrency(remaining)}</td>
                        <td className={`px-4 py-3 text-right font-medium ${margin >= 20 ? 'text-emerald-500' : margin >= 0 ? 'text-amber-500' : 'text-rose-500'}`}>{formatPercent(margin)}</td>
                        <td className="px-4 py-3 text-center text-slate-300">{project.resources || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openEditProject(project)} className="p-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600" title="Edit">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => openAddCO(project.id, project.name)} className="p-1.5 rounded bg-blue-500/20 text-blue-500 hover:bg-blue-500/30" title="Add Change Order">
                              <GitBranch size={14} />
                            </button>
                            <button onClick={() => deleteProject(project.id, project.name)} className="p-1.5 rounded bg-red-500/20 text-red-500 hover:bg-red-500/30" title="Delete">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Change Order Rows */}
                      {project.changeOrders?.map((co) => {
                        const coStatusStyle = getStatusStyle(co.status)
                        const coRemaining = co.budget - co.spent
                        const coMargin = co.budget > 0 ? (coRemaining / co.budget) * 100 : 0

                        return (
                          <tr key={co.id} className="border-t border-slate-700/50 bg-slate-900/30 hover:bg-slate-700/20">
                            <td className="px-4 py-2 pl-8">
                              <div className="flex items-center gap-2">
                                <GitBranch size={12} className="text-slate-500" />
                                <span className="text-slate-300 text-xs">{co.name}</span>
                                <span className="px-1.5 py-0.5 text-xs rounded bg-amber-500/20 text-amber-500">CO{co.co_number}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-slate-400 text-xs">{co.client}</td>
                            <td className="px-4 py-2 text-center">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${coStatusStyle.bg} ${coStatusStyle.text}`}>{STATUS_OPTIONS.find(s => s.id === co.status)?.label}</span>
                            </td>
                            <td className="px-4 py-2 text-center text-xs text-slate-500">{BUDGET_TYPES.find(b => b.id === co.budget_type)?.label}</td>
                            <td className="px-4 py-2 text-right text-slate-300 text-xs">{formatCurrency(co.budget)}</td>
                            <td className="px-4 py-2 text-right text-rose-400 text-xs">{formatCurrency(co.spent)}</td>
                            <td className={`px-4 py-2 text-right text-xs ${coRemaining >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(coRemaining)}</td>
                            <td className={`px-4 py-2 text-right text-xs ${coMargin >= 20 ? 'text-emerald-400' : coMargin >= 0 ? 'text-amber-400' : 'text-rose-400'}`}>{formatPercent(coMargin)}</td>
                            <td className="px-4 py-2 text-center text-slate-400 text-xs">{co.resources || '—'}</td>
                            <td className="px-4 py-2">
                              <button onClick={() => openEditProject(co)} className="p-1 rounded bg-slate-700 text-slate-400 hover:bg-slate-600 mx-auto block">
                                <Edit2 size={12} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </React.Fragment>
                  )
                })
              ) : (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-slate-400">No projects found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3">
            <p className="text-sm text-slate-400">Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, organizedProjects.length)} of {organizedProjects.length}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50"><ChevronLeft size={18} /></button>
              <span className="text-sm text-slate-300">Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50"><ChevronRight size={18} /></button>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">
              {editingProject ? 'Edit Project' : isAddingCO ? 'Add Change Order' : 'Add Project'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Project Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Enter project name"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Client</label>
                <select
                  value={formData.client_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, client_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                  disabled={isAddingCO}
                >
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                  >
                    {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Budget Type</label>
                  <select
                    value={formData.budget_type}
                    onChange={(e) => setFormData(prev => ({ ...prev, budget_type: e.target.value as any }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                  >
                    {BUDGET_TYPES.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{getBudgetLabel(formData.budget_type)}</label>
                  <input
                    type="number"
                    value={formData.budget}
                    onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Spent</label>
                  <input
                    type="number"
                    value={formData.spent}
                    onChange={(e) => setFormData(prev => ({ ...prev, spent: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Resources (headcount)</label>
                <input
                  type="number"
                  value={formData.resources}
                  onChange={(e) => setFormData(prev => ({ ...prev, resources: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Description / Service</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 resize-none"
                  rows={2}
                  placeholder="Brief description of services..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowProjectModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveProject}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
              >
                {editingProject ? 'Save Changes' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
