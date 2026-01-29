'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  Search, Filter, Download, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  FolderOpen, Plus, Edit2, X, Users, DollarSign, TrendingUp, TrendingDown,
  BarChart3, Target, Calendar, GitBranch, Trash2, AlertTriangle, Activity,
  Clock, Zap, PieChart, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  Cell, PieChart as RechartsPie, Pie, LineChart, Line, Area, AreaChart, ComposedChart
} from 'recharts'
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
  parent_id?: string
  is_change_order?: boolean
  co_number?: number
  description?: string
  budgeted_hours?: number
  actual_hours?: number
  billed_hours?: number
  hourly_rate?: number
  percent_complete?: number
}

interface TimesheetEntry {
  id: string
  project_id: string
  hours: number
  billable: boolean
  date: string
}

interface Client {
  id: string
  name: string
}

// Formatting utilities
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

const formatPercent = (value: number): string => `${value.toFixed(1)}%`

// Status and type configurations
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
    active: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    completed: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    on_hold: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
    archived: { bg: 'bg-slate-500/20', text: 'text-slate-400' },
  }
  return styles[status] || styles.active
}

// Health Score Calculation (0-100)
const calculateHealthScore = (project: Project): number => {
  let score = 100
  
  // Margin component (40 points)
  const margin = project.budget > 0 ? ((project.budget - project.spent) / project.budget) * 100 : 0
  if (margin < 0) score -= 40
  else if (margin < 10) score -= 30
  else if (margin < 20) score -= 15
  else if (margin < 30) score -= 5
  
  // Burn rate vs completion (30 points)
  const burnRate = project.budget > 0 ? (project.spent / project.budget) * 100 : 0
  const completion = project.percent_complete || burnRate * 0.9
  const burnDelta = burnRate - completion
  if (burnDelta > 20) score -= 30
  else if (burnDelta > 10) score -= 20
  else if (burnDelta > 5) score -= 10
  
  // Timeline (20 points)
  if (project.end_date) {
    const endDate = new Date(project.end_date)
    const today = new Date()
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysRemaining < 0 && project.status === 'active') score -= 20
    else if (daysRemaining < 7 && completion < 90) score -= 10
  }
  
  // Utilization (10 points)
  if (project.budgeted_hours && project.actual_hours) {
    const hoursUtilization = (project.actual_hours / project.budgeted_hours) * 100
    if (hoursUtilization > 110) score -= 10
    else if (hoursUtilization > 100) score -= 5
  }
  
  return Math.max(0, Math.min(100, score))
}

const getHealthColor = (score: number) => {
  if (score >= 80) return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', fill: '#10b981' }
  if (score >= 60) return { bg: 'bg-amber-500/20', text: 'text-amber-400', fill: '#f59e0b' }
  return { bg: 'bg-rose-500/20', text: 'text-rose-400', fill: '#ef4444' }
}

// KPI Card Component - matching Expenses style
function KPICard({ 
  label, 
  value, 
  subValue, 
  icon,
  valueColor = 'text-slate-100'
}: { 
  label: string
  value: string | number
  subValue?: string
  icon?: React.ReactNode
  valueColor?: string
}) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className={`text-2xl font-semibold mt-1 ${valueColor}`}>{value}</p>
          {subValue && <p className="text-xs text-slate-500 mt-0.5">{subValue}</p>}
        </div>
        {icon && <div className="text-slate-500">{icon}</div>}
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  // Data state
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [timesheetData, setTimesheetData] = useState<TimesheetEntry[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [selectedRisk, setSelectedRisk] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [groupByClient, setGroupByClient] = useState(true)

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
    budgeted_hours: '',
    hourly_rate: '',
    percent_complete: '',
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

        const [projRes, clientRes, timesheetRes] = await Promise.all([
          fetchProjects(profile.company_id),
          fetchClients(profile.company_id),
          supabase
            .from('timesheet_entries')
            .select('id, project_id, hours, billable, date')
            .eq('company_id', profile.company_id)
        ])

        const clientsData = clientRes.data || []
        const timesheets = timesheetRes.data || []
        setTimesheetData(timesheets)

        // Aggregate hours per project
        const hoursMap = new Map<string, { actual: number; billed: number }>()
        timesheets.forEach((t: any) => {
          const existing = hoursMap.get(t.project_id) || { actual: 0, billed: 0 }
          existing.actual += t.hours || 0
          if (t.billable) existing.billed += t.hours || 0
          hoursMap.set(t.project_id, existing)
        })

        // Transform projects data
        const transformedProjects = (projRes.data || []).map((p: any) => {
          const clientObj = clientsData.find((c: any) => c.id === p.client_id)
          const hours = hoursMap.get(p.id) || { actual: 0, billed: 0 }
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
            budgeted_hours: p.budgeted_hours || 0,
            actual_hours: hours.actual,
            billed_hours: hours.billed,
            hourly_rate: p.hourly_rate || (p.budget && hours.actual ? p.budget / hours.actual : 0),
            percent_complete: p.percent_complete || 0,
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

  // Get unique years
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    projects.forEach(p => {
      if (p.start_date) years.add(p.start_date.substring(0, 4))
    })
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [projects])

  // Enhanced project calculations with health scores
  const enrichedProjects = useMemo(() => {
    return projects.map(p => ({
      ...p,
      healthScore: calculateHealthScore(p),
      margin: p.budget > 0 ? ((p.budget - p.spent) / p.budget) * 100 : 0,
      burnRate: p.budget > 0 ? (p.spent / p.budget) * 100 : 0,
      effectiveRate: p.actual_hours && p.actual_hours > 0 ? p.spent / p.actual_hours : 0,
      riskLevel: calculateHealthScore(p) >= 80 ? 'low' : calculateHealthScore(p) >= 60 ? 'medium' : 'high' as 'low' | 'medium' | 'high'
    }))
  }, [projects])

  // Filter and organize projects
  const organizedProjects = useMemo(() => {
    const filtered = enrichedProjects.filter(p => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!p.name?.toLowerCase().includes(query) && !p.client?.toLowerCase().includes(query)) return false
      }
      if (selectedClient !== 'all' && p.client !== selectedClient) return false
      if (selectedStatus !== 'all' && p.status !== selectedStatus) return false
      if (selectedYear !== 'all' && p.start_date && !p.start_date.startsWith(selectedYear)) return false
      if (selectedRisk !== 'all' && p.riskLevel !== selectedRisk) return false
      return true
    })

    const parents = filtered.filter(p => !p.is_change_order)
    const changeOrders = filtered.filter(p => p.is_change_order)

    const result: (typeof enrichedProjects[0] & { changeOrders?: typeof enrichedProjects })[] = []
    
    parents.forEach(parent => {
      const cos = changeOrders.filter(co => co.parent_id === parent.id)
      result.push({ ...parent, changeOrders: cos })
    })

    return result.sort((a, b) => {
      if (a.status === 'active' && b.status !== 'active') return -1
      if (a.status !== 'active' && b.status === 'active') return 1
      return a.name.localeCompare(b.name)
    })
  }, [enrichedProjects, searchQuery, selectedClient, selectedStatus, selectedYear, selectedRisk])

  // Group by client
  const projectsByClient = useMemo(() => {
    const grouped = new Map<string, typeof organizedProjects>()
    organizedProjects.forEach(p => {
      const clientName = p.client || 'No Client'
      const existing = grouped.get(clientName) || []
      existing.push(p)
      grouped.set(clientName, existing)
    })
    return Array.from(grouped.entries()).sort((a, b) => {
      const aTotal = a[1].reduce((sum, p) => sum + p.budget, 0)
      const bTotal = b[1].reduce((sum, p) => sum + p.budget, 0)
      return bTotal - aTotal
    })
  }, [organizedProjects])

  // CFO Summary Calculations
  const cfoMetrics = useMemo(() => {
    const activeProjects = enrichedProjects.filter(p => p.status === 'active' && !p.is_change_order)
    const allProjects = enrichedProjects.filter(p => !p.is_change_order)
    
    const totalContractValue = allProjects.reduce((sum, p) => sum + (p.budget || 0), 0)
    const totalSpent = allProjects.reduce((sum, p) => sum + (p.spent || 0), 0)
    const totalActualHours = allProjects.reduce((sum, p) => sum + (p.actual_hours || 0), 0)
    const totalBilledHours = allProjects.reduce((sum, p) => sum + (p.billed_hours || 0), 0)
    
    // Weighted Portfolio Margin
    const weightedMargin = totalContractValue > 0
      ? allProjects.reduce((sum, p) => sum + (p.margin * (p.budget / totalContractValue)), 0)
      : 0
    
    // Utilization Rate
    const totalResources = activeProjects.reduce((sum, p) => sum + (p.resources || 0), 0)
    const availableHours = totalResources * 160
    const utilizationRate = availableHours > 0 ? (totalActualHours / availableHours) * 100 : 0
    
    // Realization Rate
    const realizationRate = totalActualHours > 0 ? (totalBilledHours / totalActualHours) * 100 : 0
    
    // At-Risk Projects
    const atRiskProjects = activeProjects.filter(p => p.healthScore < 60)
    
    // Average Health Score
    const avgHealthScore = activeProjects.length > 0
      ? activeProjects.reduce((sum, p) => sum + p.healthScore, 0) / activeProjects.length
      : 0

    return {
      activeCount: activeProjects.length,
      totalContractValue,
      totalSpent,
      weightedMargin,
      utilizationRate,
      realizationRate,
      atRiskCount: atRiskProjects.length,
      atRiskProjects,
      totalResources,
      avgHealthScore,
      totalActualHours,
    }
  }, [enrichedProjects])

  // Client Concentration Data
  const clientConcentrationData = useMemo(() => {
    const clientTotals = new Map<string, number>()
    organizedProjects.forEach(p => {
      const client = p.client || 'No Client'
      clientTotals.set(client, (clientTotals.get(client) || 0) + p.budget)
    })
    
    const total = Array.from(clientTotals.values()).reduce((a, b) => a + b, 0)
    const colors = ['#f97316', '#06b6d4', '#10b981', '#8b5cf6', '#ec4899', '#64748b']
    
    return Array.from(clientTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value], idx) => ({
        name: name.length > 12 ? name.substring(0, 12) + '...' : name,
        value,
        percent: total > 0 ? (value / total) * 100 : 0,
        fill: colors[idx % colors.length]
      }))
  }, [organizedProjects])

  // Health Distribution Data
  const healthDistribution = useMemo(() => {
    const healthy = enrichedProjects.filter(p => p.healthScore >= 80 && !p.is_change_order).length
    const warning = enrichedProjects.filter(p => p.healthScore >= 60 && p.healthScore < 80 && !p.is_change_order).length
    const atRisk = enrichedProjects.filter(p => p.healthScore < 60 && !p.is_change_order).length
    return [
      { name: 'Healthy', value: healthy, fill: '#10b981' },
      { name: 'Warning', value: warning, fill: '#f59e0b' },
      { name: 'At Risk', value: atRisk, fill: '#ef4444' },
    ]
  }, [enrichedProjects])

  // Margin Chart Data
  const marginChartData = useMemo(() => {
    return organizedProjects
      .filter(p => !p.is_change_order && p.budget > 0)
      .slice(0, 8)
      .map(p => ({
        name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
        margin: Math.round(p.margin * 10) / 10,
        fill: p.healthScore >= 80 ? '#10b981' : p.healthScore >= 60 ? '#f59e0b' : '#ef4444'
      }))
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
      budget: '', spent: '', start_date: '', end_date: '', resources: '', 
      description: '', budgeted_hours: '', hourly_rate: '', percent_complete: ''
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
      resources: '', description: '', budgeted_hours: '', hourly_rate: '', percent_complete: ''
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
      budgeted_hours: project.budgeted_hours?.toString() || '',
      hourly_rate: project.hourly_rate?.toString() || '',
      percent_complete: project.percent_complete?.toString() || '',
    })
    setShowProjectModal(true)
  }

  const saveProject = async () => {
    if (!companyId || !formData.name) return

    try {
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
        const { company_id, ...updateData } = projectData
        const { error } = await supabase
          .from('projects')
          .update(updateData)
          .eq('id', editingProject.id)

        if (error) throw error

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
            budgeted_hours: parseFloat(formData.budgeted_hours) || 0,
            hourly_rate: parseFloat(formData.hourly_rate) || 0,
            percent_complete: parseFloat(formData.percent_complete) || 0,
          } as Project : p
        ))
      } else {
        const { data, error } = await supabase
          .from('projects')
          .insert(projectData)
          .select()
          .single()

        if (error) throw error

        const clientName = clients.find(c => c.id === formData.client_id)?.name || ''
        setProjects(prev => [...prev, { 
          ...data, 
          client: clientName,
          budget_type: formData.budget_type || 'lump_sum',
          spent: 0,
          resources: 0,
          actual_hours: 0,
          billed_hours: 0,
        } as Project])
      }

      setShowProjectModal(false)
    } catch (error) {
      console.error('Error saving project:', error)
    }
  }

  const deleteProject = async (projectId: string, projectName: string) => {
    if (!confirm(`Delete "${projectName}" and all change orders?`)) return
    
    try {
      await supabase.from('projects').delete().eq('parent_id', projectId)
      const { error } = await supabase.from('projects').delete().eq('id', projectId)
      if (error) throw error
      setProjects(prev => prev.filter(p => p.id !== projectId && p.parent_id !== projectId))
    } catch (error) {
      console.error('Error deleting project:', error)
    }
  }

  const exportToExcel = () => {
    const headers = ['Project', 'Client', 'Status', 'Type', 'Budget', 'Spent', 'Remaining', 'Margin %', 'Health Score', 'Hours (Actual)', 'Hours (Budgeted)', 'Effective Rate', 'Resources', 'Start', 'End']
    const rows = enrichedProjects.map(p => {
      const remaining = p.budget - p.spent
      return [
        p.name, p.client, p.status, p.budget_type, 
        p.budget, p.spent, remaining, p.margin.toFixed(1), 
        p.healthScore, p.actual_hours || 0, p.budgeted_hours || 0,
        p.effectiveRate.toFixed(2), p.resources, 
        p.start_date || '', p.end_date || ''
      ]
    })
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `projects-cfo-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedClient('all')
    setSelectedStatus('all')
    setSelectedYear('all')
    setSelectedRisk('all')
  }

  const hasActiveFilters = searchQuery || selectedClient !== 'all' || selectedStatus !== 'all' || selectedYear !== 'all' || selectedRisk !== 'all'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Project Analytics</h1>
          <p className="text-sm mt-1 text-slate-400">CFO-level portfolio insights and profitability tracking</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded-lg text-sm font-medium text-slate-200 transition-colors"
          >
            <Download size={18} />
            Export
          </button>
          <button
            onClick={openAddProject}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-medium text-white transition-colors"
          >
            <Plus size={18} />
            Add Project
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard 
          label="Active Projects" 
          value={cfoMetrics.activeCount}
          subValue={`${formatCompactCurrency(cfoMetrics.totalContractValue)} total value`}
          icon={<FolderOpen size={20} />}
          valueColor="text-blue-400"
        />
        <KPICard 
          label="Portfolio Margin" 
          value={formatPercent(cfoMetrics.weightedMargin)}
          subValue="Weighted average"
          icon={<TrendingUp size={20} />}
          valueColor={cfoMetrics.weightedMargin >= 20 ? 'text-emerald-400' : cfoMetrics.weightedMargin >= 10 ? 'text-amber-400' : 'text-rose-400'}
        />
        <KPICard 
          label="Utilization" 
          value={formatPercent(cfoMetrics.utilizationRate)}
          subValue={`${cfoMetrics.totalActualHours.toLocaleString()} hrs logged`}
          icon={<Activity size={20} />}
          valueColor={cfoMetrics.utilizationRate >= 75 ? 'text-emerald-400' : cfoMetrics.utilizationRate >= 60 ? 'text-amber-400' : 'text-rose-400'}
        />
        <KPICard 
          label="Realization" 
          value={formatPercent(cfoMetrics.realizationRate)}
          subValue="Billed / Worked"
          icon={<Zap size={20} />}
          valueColor={cfoMetrics.realizationRate >= 90 ? 'text-emerald-400' : cfoMetrics.realizationRate >= 80 ? 'text-amber-400' : 'text-rose-400'}
        />
        <KPICard 
          label="At-Risk Projects" 
          value={cfoMetrics.atRiskCount}
          subValue={cfoMetrics.atRiskCount > 0 ? 'Needs attention' : 'All healthy'}
          icon={<AlertTriangle size={20} />}
          valueColor={cfoMetrics.atRiskCount > 0 ? 'text-rose-400' : 'text-emerald-400'}
        />
        <KPICard 
          label="Avg Health Score" 
          value={Math.round(cfoMetrics.avgHealthScore)}
          subValue="Portfolio health"
          icon={<Target size={20} />}
          valueColor={cfoMetrics.avgHealthScore >= 80 ? 'text-emerald-400' : cfoMetrics.avgHealthScore >= 60 ? 'text-amber-400' : 'text-rose-400'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Margin by Project */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-100 mb-4">Margin by Project</h3>
          <div className="h-56">
            {marginChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={marginChartData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} 
                    formatter={(value: number) => [`${value}%`, 'Margin']}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Bar dataKey="margin" radius={[0, 4, 4, 0]}>
                    {marginChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">No project data</div>
            )}
          </div>
        </div>

        {/* Client Concentration */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-semibold text-slate-100">Client Concentration</h3>
            {clientConcentrationData.some(c => c.percent > 30) && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-400">⚠️ Risk</span>
            )}
          </div>
          <div className="h-56">
            {clientConcentrationData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={clientConcentrationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${percent.toFixed(0)}%`}
                    labelLine={false}
                  >
                    {clientConcentrationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} 
                    formatter={(value: number) => formatCurrency(value)}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">No client data</div>
            )}
          </div>
        </div>

        {/* Portfolio Health */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-100 mb-4">Portfolio Health</h3>
          <div className="space-y-4">
            {healthDistribution.map((item, idx) => {
              const total = healthDistribution.reduce((a, b) => a + b.value, 0) || 1
              const percent = (item.value / total) * 100
              return (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.fill }} />
                  <span className="text-sm text-slate-300 w-16">{item.name}</span>
                  <div className="flex-1 bg-slate-700 rounded-full h-5 overflow-hidden">
                    <div 
                      className="h-full rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                      style={{ width: `${Math.max(percent, 8)}%`, backgroundColor: item.fill }}
                    >
                      <span className="text-xs font-medium text-white">{item.value}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-6 pt-4 border-t border-slate-700">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Average Score</span>
              <span className={`font-semibold ${cfoMetrics.avgHealthScore >= 80 ? 'text-emerald-400' : cfoMetrics.avgHealthScore >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
                {Math.round(cfoMetrics.avgHealthScore)}/100
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Projects Table Section */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl">
        {/* Table Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-100">All Projects</h3>
            <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300">{organizedProjects.length}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 w-64"
              />
            </div>
            <button
              onClick={() => setGroupByClient(!groupByClient)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${groupByClient ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              <Users size={16} />
              Group by Client
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${showFilters || hasActiveFilters ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
            >
              <Filter size={16} />
              Filters
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-b border-slate-700 bg-slate-800/50">
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            >
              <option value="all">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            >
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            >
              <option value="all">All Years</option>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            >
              <option value="all">All Risk Levels</option>
              <option value="low">Low Risk (80+)</option>
              <option value="medium">Medium Risk (60-79)</option>
              <option value="high">High Risk (&lt;60)</option>
            </select>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="col-span-full md:col-span-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-300">
                <X size={16} /> Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-4 py-3 text-left font-medium text-slate-400">Project</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Client</th>
                <th className="px-4 py-3 text-center font-medium text-slate-400">Status</th>
                <th className="px-4 py-3 text-center font-medium text-slate-400">Health</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">Contract</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">Spent</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">Margin</th>
                <th className="px-4 py-3 text-center font-medium text-slate-400">Burn %</th>
                <th className="px-4 py-3 text-center font-medium text-slate-400">Hours</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">$/hr</th>
                <th className="px-4 py-3 text-center font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groupByClient ? (
                projectsByClient.map(([clientName, clientProjects]) => (
                  <React.Fragment key={clientName}>
                    {/* Client Header Row */}
                    <tr className="bg-slate-900/50">
                      <td colSpan={11} className="px-4 py-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users size={14} className="text-slate-500" />
                            <span className="font-medium text-slate-200">{clientName}</span>
                            <span className="text-xs text-slate-500">({clientProjects.length} project{clientProjects.length !== 1 ? 's' : ''})</span>
                          </div>
                          <span className="text-sm font-medium text-slate-400">
                            {formatCurrency(clientProjects.reduce((sum, p) => sum + p.budget, 0))}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {/* Project Rows */}
                    {clientProjects.map(project => {
                      const statusStyle = getStatusStyle(project.status)
                      const healthColor = getHealthColor(project.healthScore)
                      const burnRate = project.budget > 0 ? (project.spent / project.budget) * 100 : 0
                      
                      return (
                        <React.Fragment key={project.id}>
                          <tr className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-100">{project.name}</span>
                                {project.riskLevel === 'high' && <AlertTriangle size={14} className="text-rose-400" />}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-400">{project.client}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                                {STATUS_OPTIONS.find(s => s.id === project.status)?.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex items-center justify-center w-9 h-6 rounded text-xs font-bold ${healthColor.bg} ${healthColor.text}`}>
                                {project.healthScore}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-100">{formatCurrency(project.budget)}</td>
                            <td className="px-4 py-3 text-right text-rose-400">{formatCurrency(project.spent)}</td>
                            <td className={`px-4 py-3 text-right font-semibold ${project.margin >= 20 ? 'text-emerald-400' : project.margin >= 10 ? 'text-amber-400' : 'text-rose-400'}`}>
                              {formatPercent(project.margin)}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-14 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${burnRate > 100 ? 'bg-rose-500' : burnRate > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(burnRate, 100)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-slate-500 w-8">{burnRate.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-slate-400 text-xs">
                              {project.actual_hours || 0}/{project.budgeted_hours || '—'}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-400">
                              {project.effectiveRate > 0 ? `$${project.effectiveRate.toFixed(0)}` : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1">
                                <button 
                                  onClick={() => openAddCO(project.id, project.name)}
                                  className="p-1.5 rounded hover:bg-slate-600 text-slate-500 hover:text-slate-300"
                                  title="Add Change Order"
                                >
                                  <Plus size={14} />
                                </button>
                                <button 
                                  onClick={() => openEditProject(project)} 
                                  className="p-1.5 rounded hover:bg-slate-600 text-slate-500 hover:text-slate-300"
                                  title="Edit"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button 
                                  onClick={() => deleteProject(project.id, project.name)}
                                  className="p-1.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400"
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {/* Change Orders */}
                          {project.changeOrders?.map(co => {
                            const coStatusStyle = getStatusStyle(co.status)
                            const coHealthColor = getHealthColor(co.healthScore)
                            const coBurnRate = co.budget > 0 ? (co.spent / co.budget) * 100 : 0
                            return (
                              <tr key={co.id} className="border-b border-slate-700/30 bg-slate-900/30 hover:bg-slate-700/20">
                                <td className="px-4 py-2">
                                  <div className="flex items-center gap-2 pl-6">
                                    <GitBranch size={12} className="text-slate-600" />
                                    <span className="text-slate-400 text-xs">{co.name}</span>
                                    <span className="px-1.5 py-0.5 text-xs rounded bg-amber-500/20 text-amber-400">CO{co.co_number}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-slate-500 text-xs">{co.client}</td>
                                <td className="px-4 py-2 text-center">
                                  <span className={`px-2 py-0.5 rounded text-xs ${coStatusStyle.bg} ${coStatusStyle.text}`}>
                                    {STATUS_OPTIONS.find(s => s.id === co.status)?.label}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-center">
                                  <span className={`inline-flex items-center justify-center w-7 h-5 rounded text-xs font-medium ${coHealthColor.bg} ${coHealthColor.text}`}>
                                    {co.healthScore}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right text-slate-400 text-xs">{formatCurrency(co.budget)}</td>
                                <td className="px-4 py-2 text-right text-rose-400/70 text-xs">{formatCurrency(co.spent)}</td>
                                <td className={`px-4 py-2 text-right text-xs font-medium ${co.margin >= 20 ? 'text-emerald-400' : co.margin >= 10 ? 'text-amber-400' : 'text-rose-400'}`}>
                                  {formatPercent(co.margin)}
                                </td>
                                <td className="px-4 py-2">
                                  <div className="flex items-center justify-center gap-2">
                                    <div className="w-10 bg-slate-700 rounded-full h-1 overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full ${coBurnRate > 100 ? 'bg-rose-500' : 'bg-slate-500'}`}
                                        style={{ width: `${Math.min(coBurnRate, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-slate-600 w-6">{coBurnRate.toFixed(0)}%</span>
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-center text-slate-500 text-xs">
                                  {co.actual_hours || 0}/{co.budgeted_hours || '—'}
                                </td>
                                <td className="px-4 py-2 text-right text-slate-500 text-xs">
                                  {co.effectiveRate > 0 ? `$${co.effectiveRate.toFixed(0)}` : '—'}
                                </td>
                                <td className="px-4 py-2">
                                  <button 
                                    onClick={() => openEditProject(co)} 
                                    className="p-1 rounded hover:bg-slate-600 text-slate-600 hover:text-slate-400 mx-auto block"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </React.Fragment>
                      )
                    })}
                  </React.Fragment>
                ))
              ) : (
                paginatedProjects.map(project => {
                  const statusStyle = getStatusStyle(project.status)
                  const healthColor = getHealthColor(project.healthScore)
                  const burnRate = project.budget > 0 ? (project.spent / project.budget) * 100 : 0
                  
                  return (
                    <tr key={project.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-100">{project.name}</span>
                          {project.riskLevel === 'high' && <AlertTriangle size={14} className="text-rose-400" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{project.client}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                          {STATUS_OPTIONS.find(s => s.id === project.status)?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center w-9 h-6 rounded text-xs font-bold ${healthColor.bg} ${healthColor.text}`}>
                          {project.healthScore}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-100">{formatCurrency(project.budget)}</td>
                      <td className="px-4 py-3 text-right text-rose-400">{formatCurrency(project.spent)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${project.margin >= 20 ? 'text-emerald-400' : project.margin >= 10 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {formatPercent(project.margin)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-14 bg-slate-700 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${burnRate > 100 ? 'bg-rose-500' : burnRate > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${Math.min(burnRate, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 w-8">{burnRate.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-400 text-xs">
                        {project.actual_hours || 0}/{project.budgeted_hours || '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400">
                        {project.effectiveRate > 0 ? `$${project.effectiveRate.toFixed(0)}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => openAddCO(project.id, project.name)}
                            className="p-1.5 rounded hover:bg-slate-600 text-slate-500 hover:text-slate-300"
                          >
                            <Plus size={14} />
                          </button>
                          <button 
                            onClick={() => openEditProject(project)} 
                            className="p-1.5 rounded hover:bg-slate-600 text-slate-500 hover:text-slate-300"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={() => deleteProject(project.id, project.name)}
                            className="p-1.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
              {organizedProjects.length === 0 && (
                <tr><td colSpan={11} className="px-4 py-12 text-center text-slate-500">No projects found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!groupByClient && totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-700">
            <p className="text-sm text-slate-400">Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, organizedProjects.length)} of {organizedProjects.length}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50">
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm text-slate-400 px-3">Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50">
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
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
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
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
                  <label className="block text-sm text-slate-400 mb-1">Contract Value</label>
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
                  <label className="block text-sm text-slate-400 mb-1">Budgeted Hours</label>
                  <input
                    type="number"
                    value={formData.budgeted_hours}
                    onChange={(e) => setFormData(prev => ({ ...prev, budgeted_hours: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">% Complete</label>
                  <input
                    type="number"
                    value={formData.percent_complete}
                    onChange={(e) => setFormData(prev => ({ ...prev, percent_complete: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                    placeholder="0"
                    min="0"
                    max="100"
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
                <label className="block text-sm text-slate-400 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 resize-none"
                  rows={2}
                  placeholder="Brief description..."
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
                className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-medium text-white transition-colors"
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
