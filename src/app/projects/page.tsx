'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  Search, Filter, Download, ChevronDown, ChevronRight, ChevronUp,
  FolderOpen, Plus, Edit2, X, Users, DollarSign, TrendingUp, TrendingDown,
  BarChart3, Target, Calendar, Trash2, AlertTriangle, Activity,
  Clock, Zap, ArrowUpRight, ArrowDownRight, Building2, Briefcase,
  AlertCircle, CheckCircle, Eye, EyeOff, RefreshCw
} from 'lucide-react'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart as RechartsPie, Pie
} from 'recharts'
import { supabase, getCurrentUser, fetchProjects, fetchClients } from '@/lib/supabase'

// ============ GLASSMORPHISM THEME ============
const THEME = {
  glass: 'bg-slate-900/70 backdrop-blur-xl',
  glassBorder: 'border-white/[0.08]',
  glassHover: 'hover:bg-white/[0.05] hover:border-white/[0.12]',
  textPrimary: 'text-white',
  textSecondary: 'text-slate-300',
  textMuted: 'text-slate-400',
  textDim: 'text-slate-500',
}

const COLORS = {
  emerald: '#10b981',
  rose: '#f43f5e',
  amber: '#f59e0b',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  orange: '#f97316',
}

// ============ TYPES ============
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

interface Client {
  id: string
  name: string
}

// ============ UTILITIES ============
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

const formatCompactCurrency = (value: number): string => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`
  return `$${value}`
}

const formatPercent = (value: number): string => `${value.toFixed(1)}%`

// ============ HEALTH SCORE ============
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
  if (score >= 80) return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', fill: '#10b981', label: 'Healthy' }
  if (score >= 60) return { bg: 'bg-amber-500/20', text: 'text-amber-400', fill: '#f59e0b', label: 'Warning' }
  return { bg: 'bg-rose-500/20', text: 'text-rose-400', fill: '#ef4444', label: 'At Risk' }
}

// Status configurations
const STATUS_OPTIONS = [
  { id: 'active', label: 'Active', color: 'emerald' },
  { id: 'completed', label: 'Completed', color: 'blue' },
  { id: 'on_hold', label: 'On Hold', color: 'amber' },
  { id: 'archived', label: 'Archived', color: 'slate' },
]

const getStatusStyle = (status: string) => {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    active: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    completed: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
    on_hold: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
    archived: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
  }
  return styles[status] || styles.active
}

// ============ COMPONENTS ============

// Glass Metric Card
function MetricCard({ label, value, subtitle, icon: Icon, color = 'emerald', trend }: { 
  label: string; value: string | number; subtitle?: string; icon: any; color?: string; trend?: 'up' | 'down' | null
}) {
  const colorMap: { [key: string]: string } = {
    emerald: 'text-emerald-400',
    rose: 'text-rose-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    slate: 'text-slate-300',
  }

  return (
    <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-4 ${THEME.glassHover} transition-all`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`text-xs font-medium ${THEME.textMuted} uppercase tracking-wide`}>{label}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className={`text-2xl font-semibold ${colorMap[color]}`}>{value}</p>
            {trend && (
              <span className={trend === 'up' ? 'text-emerald-400' : 'text-rose-400'}>
                {trend === 'up' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              </span>
            )}
          </div>
          {subtitle && <p className={`text-xs ${THEME.textDim} mt-0.5`}>{subtitle}</p>}
        </div>
        <div className="p-2 rounded-lg bg-white/[0.05]">
          <Icon size={18} className={THEME.textMuted} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  )
}

// Glass Tooltip
const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-lg px-3 py-2 shadow-xl`}>
      <p className={`text-xs ${THEME.textDim} mb-1`}>{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm font-medium" style={{ color: entry.color || entry.fill }}>
          {entry.name}: {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  )
}

// Client Summary Row (THE EDGE - Client-level P&L)
function ClientSummaryRow({ 
  clientName, 
  projects, 
  isExpanded, 
  onToggle 
}: { 
  clientName: string
  projects: any[]
  isExpanded: boolean
  onToggle: () => void
}) {
  const activeProjects = projects.filter(p => p.status === 'active')
  const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0)
  const totalSpent = projects.reduce((sum, p) => sum + p.spent, 0)
  const totalHours = projects.reduce((sum, p) => sum + (p.actual_hours || 0), 0)
  const totalBilledHours = projects.reduce((sum, p) => sum + (p.billed_hours || 0), 0)
  const margin = totalBudget > 0 ? ((totalBudget - totalSpent) / totalBudget) * 100 : 0
  const effectiveRate = totalHours > 0 ? totalSpent / totalHours : 0
  const avgHealth = projects.length > 0 ? projects.reduce((sum, p) => sum + p.healthScore, 0) / projects.length : 0
  const atRiskCount = projects.filter(p => p.healthScore < 60).length

  const healthColor = avgHealth >= 80 ? 'text-emerald-400' : avgHealth >= 60 ? 'text-amber-400' : 'text-rose-400'
  const marginColor = margin >= 20 ? 'text-emerald-400' : margin >= 10 ? 'text-amber-400' : 'text-rose-400'

  return (
    <tr 
      className="bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer transition-colors border-b border-white/[0.08]"
      onClick={onToggle}
    >
      <td className="px-4 py-3" colSpan={2}>
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
            <ChevronRight size={16} className={THEME.textMuted} />
          </div>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center">
            <Building2 size={16} className="text-emerald-400" />
          </div>
          <div>
            <p className={`font-semibold ${THEME.textPrimary}`}>{clientName}</p>
            <p className={`text-xs ${THEME.textDim}`}>
              {activeProjects.length} active • {projects.length} total
              {atRiskCount > 0 && <span className="text-rose-400 ml-2">• {atRiskCount} at risk</span>}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`text-sm font-medium ${healthColor}`}>{Math.round(avgHealth)}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className={`font-semibold ${THEME.textPrimary}`}>{formatCurrency(totalBudget)}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-rose-400">{formatCurrency(totalSpent)}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className={`font-semibold ${marginColor}`}>{formatPercent(margin)}</span>
      </td>
      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <div className="w-16 bg-white/[0.08] rounded-full h-1.5 overflow-hidden">
            <div 
              className={`h-full rounded-full ${totalBudget > 0 && (totalSpent/totalBudget) > 1 ? 'bg-rose-500' : (totalSpent/totalBudget) > 0.8 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min((totalSpent / totalBudget) * 100, 100)}%` }}
            />
          </div>
          <span className={`text-xs ${THEME.textDim} w-10`}>{totalBudget > 0 ? Math.round((totalSpent/totalBudget)*100) : 0}%</span>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`text-sm ${THEME.textMuted}`}>{totalHours.toLocaleString()}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className={`text-sm ${THEME.textSecondary}`}>{effectiveRate > 0 ? `$${effectiveRate.toFixed(0)}` : '—'}</span>
      </td>
      <td className="px-4 py-3"></td>
    </tr>
  )
}

// Project Row
function ProjectRow({ 
  project, 
  isNested = false,
  onEdit,
  onDelete,
  onAddCO
}: { 
  project: any
  isNested?: boolean
  onEdit: (p: any) => void
  onDelete: (id: string, name: string) => void
  onAddCO: (id: string, name: string) => void
}) {
  const statusStyle = getStatusStyle(project.status)
  const healthColor = getHealthColor(project.healthScore)
  const burnRate = project.budget > 0 ? (project.spent / project.budget) * 100 : 0
  const margin = project.margin || (project.budget > 0 ? ((project.budget - project.spent) / project.budget) * 100 : 0)
  const marginColor = margin >= 20 ? 'text-emerald-400' : margin >= 10 ? 'text-amber-400' : 'text-rose-400'

  return (
    <tr className={`border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors ${isNested ? 'bg-white/[0.01]' : ''}`}>
      <td className="px-4 py-3">
        <div className={`flex items-center gap-2 ${isNested ? 'pl-12' : ''}`}>
          {isNested && <div className="w-4 h-px bg-white/10" />}
          <Briefcase size={14} className={THEME.textDim} />
          <span className={`font-medium ${THEME.textPrimary}`}>{project.name}</span>
          {project.riskLevel === 'high' && <AlertTriangle size={14} className="text-rose-400" />}
          {project.is_change_order && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-500/20 text-purple-400">CO</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${statusStyle.bg} ${statusStyle.text} border ${statusStyle.border}`}>
          {STATUS_OPTIONS.find(s => s.id === project.status)?.label}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`inline-flex items-center justify-center w-9 h-6 rounded text-xs font-bold ${healthColor.bg} ${healthColor.text}`}>
          {project.healthScore}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className={`font-medium ${THEME.textPrimary}`}>{formatCurrency(project.budget)}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="text-rose-400">{formatCurrency(project.spent)}</span>
      </td>
      <td className={`px-4 py-3 text-right font-semibold ${marginColor}`}>
        {formatPercent(margin)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-center gap-2">
          <div className="w-16 bg-white/[0.08] rounded-full h-1.5 overflow-hidden">
            <div 
              className={`h-full rounded-full ${burnRate > 100 ? 'bg-rose-500' : burnRate > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${Math.min(burnRate, 100)}%` }}
            />
          </div>
          <span className={`text-xs ${THEME.textDim} w-10`}>{burnRate.toFixed(0)}%</span>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`text-sm ${THEME.textMuted}`}>
          {project.actual_hours || 0}{project.budgeted_hours ? `/${project.budgeted_hours}` : ''}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <span className={`text-sm ${THEME.textSecondary}`}>
          {project.effectiveRate > 0 ? `$${project.effectiveRate.toFixed(0)}` : '—'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-center gap-0.5">
          {!project.is_change_order && (
            <button 
              onClick={(e) => { e.stopPropagation(); onAddCO(project.id, project.name); }}
              className="p-1.5 rounded hover:bg-white/[0.08] text-slate-500 hover:text-emerald-400 transition-colors"
              title="Add Change Order"
            >
              <Plus size={14} />
            </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(project); }}
            className="p-1.5 rounded hover:bg-white/[0.08] text-slate-500 hover:text-slate-300 transition-colors"
            title="Edit"
          >
            <Edit2 size={14} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(project.id, project.name); }}
            className="p-1.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// Portfolio Pulse Card (THE EDGE - Replaces confusing "Portfolio Health")
function PortfolioPulse({ metrics, topPerformer, needsAttention }: {
  metrics: any
  topPerformer: any | null
  needsAttention: any | null
}) {
  return (
    <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-5`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Portfolio Pulse</h3>
        <span className={`text-xs px-2 py-1 rounded-full ${
          metrics.avgHealthScore >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
          metrics.avgHealthScore >= 60 ? 'bg-amber-500/20 text-amber-400' :
          'bg-rose-500/20 text-rose-400'
        }`}>
          {metrics.avgHealthScore >= 80 ? 'Healthy' : metrics.avgHealthScore >= 60 ? 'Needs Attention' : 'At Risk'}
        </span>
      </div>
      
      <div className="space-y-4">
        {/* $ at Risk */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-rose-400" />
            <span className={`text-sm ${THEME.textMuted}`}>Value at Risk</span>
          </div>
          <span className={`font-semibold ${metrics.atRiskValue > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {formatCurrency(metrics.atRiskValue)}
          </span>
        </div>
        
        {/* Avg Portfolio Margin */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-emerald-400" />
            <span className={`text-sm ${THEME.textMuted}`}>Portfolio Margin</span>
          </div>
          <span className={`font-semibold ${
            metrics.weightedMargin >= 20 ? 'text-emerald-400' : 
            metrics.weightedMargin >= 10 ? 'text-amber-400' : 'text-rose-400'
          }`}>
            {formatPercent(metrics.weightedMargin)}
          </span>
        </div>
        
        {/* Divider */}
        <div className={`border-t ${THEME.glassBorder} my-3`} />
        
        {/* Top Performer */}
        {topPerformer && (
          <div>
            <p className={`text-xs ${THEME.textDim} mb-1`}>⭐ Top Performer</p>
            <div className="flex items-center justify-between">
              <span className={`text-sm ${THEME.textSecondary} truncate max-w-[120px]`}>{topPerformer.name}</span>
              <span className="text-sm font-medium text-emerald-400">{formatPercent(topPerformer.margin)}</span>
            </div>
          </div>
        )}
        
        {/* Needs Attention */}
        {needsAttention && (
          <div>
            <p className={`text-xs ${THEME.textDim} mb-1`}>⚠️ Needs Attention</p>
            <div className="flex items-center justify-between">
              <span className={`text-sm ${THEME.textSecondary} truncate max-w-[120px]`}>{needsAttention.name}</span>
              <span className="text-sm font-medium text-rose-400">{formatPercent(needsAttention.margin)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ============ MAIN PAGE ============
export default function ProjectsPage() {
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedRisk, setSelectedRisk] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  
  // Client expansion state
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())
  const [showAllProjects, setShowAllProjects] = useState(false)

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
        
        // Auto-expand all clients initially
        const clientNames = new Set(transformedProjects.map((p: any) => p.client || 'No Client'))
        setExpandedClients(clientNames as Set<string>)
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Enhanced project calculations
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

  // Filter projects
  const filteredProjects = useMemo(() => {
    return enrichedProjects.filter(p => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!p.name?.toLowerCase().includes(query) && !p.client?.toLowerCase().includes(query)) return false
      }
      if (selectedStatus !== 'all' && p.status !== selectedStatus) return false
      if (selectedRisk !== 'all' && p.riskLevel !== selectedRisk) return false
      return true
    })
  }, [enrichedProjects, searchQuery, selectedStatus, selectedRisk])

  // Group by client (THE EDGE - Client-first view)
  const projectsByClient = useMemo(() => {
    const grouped = new Map<string, typeof filteredProjects>()
    
    // Get parent projects (not change orders)
    const parentProjects = filteredProjects.filter(p => !p.is_change_order)
    const changeOrders = filteredProjects.filter(p => p.is_change_order)
    
    parentProjects.forEach(p => {
      const clientName = p.client || 'No Client'
      const existing = grouped.get(clientName) || []
      
      // Attach change orders to parent
      const cos = changeOrders.filter(co => co.parent_id === p.id)
      existing.push({ ...p, changeOrders: cos })
      grouped.set(clientName, existing)
    })
    
    // Sort clients by total budget (descending)
    return Array.from(grouped.entries()).sort((a, b) => {
      const aTotal = a[1].reduce((sum, p) => sum + p.budget, 0)
      const bTotal = b[1].reduce((sum, p) => sum + p.budget, 0)
      return bTotal - aTotal
    })
  }, [filteredProjects])

  // CFO Metrics
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
    const atRiskValue = atRiskProjects.reduce((sum, p) => sum + p.budget, 0)
    
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
      atRiskValue,
      avgHealthScore,
      totalActualHours,
    }
  }, [enrichedProjects])

  // Top Performer & Needs Attention
  const { topPerformer, needsAttention } = useMemo(() => {
    const activeWithBudget = enrichedProjects.filter(p => p.status === 'active' && p.budget > 0 && !p.is_change_order)
    if (activeWithBudget.length === 0) return { topPerformer: null, needsAttention: null }
    
    const sorted = [...activeWithBudget].sort((a, b) => b.margin - a.margin)
    return {
      topPerformer: sorted[0],
      needsAttention: sorted[sorted.length - 1].margin < 20 ? sorted[sorted.length - 1] : null
    }
  }, [enrichedProjects])

  // Client Revenue Chart Data
  const clientRevenueData = useMemo(() => {
    const clientTotals = new Map<string, { budget: number; spent: number }>()
    enrichedProjects.filter(p => !p.is_change_order).forEach(p => {
      const client = p.client || 'No Client'
      const existing = clientTotals.get(client) || { budget: 0, spent: 0 }
      existing.budget += p.budget
      existing.spent += p.spent
      clientTotals.set(client, existing)
    })
    
    const total = Array.from(clientTotals.values()).reduce((a, b) => a + b.budget, 0)
    
    return Array.from(clientTotals.entries())
      .sort((a, b) => b[1].budget - a[1].budget)
      .slice(0, 6)
      .map(([name, data]) => ({
        name: name.length > 15 ? name.substring(0, 15) + '...' : name,
        budget: data.budget,
        spent: data.spent,
        margin: data.budget > 0 ? ((data.budget - data.spent) / data.budget) * 100 : 0,
        percent: total > 0 ? (data.budget / total) * 100 : 0
      }))
  }, [enrichedProjects])

  // Margin Distribution Data
  const marginDistributionData = useMemo(() => {
    const activeWithBudget = enrichedProjects.filter(p => p.status === 'active' && p.budget > 0 && !p.is_change_order)
    const healthy = activeWithBudget.filter(p => p.margin >= 20).length
    const warning = activeWithBudget.filter(p => p.margin >= 10 && p.margin < 20).length
    const atRisk = activeWithBudget.filter(p => p.margin < 10).length
    
    return [
      { name: '≥20%', value: healthy, fill: '#10b981', label: 'Healthy' },
      { name: '10-20%', value: warning, fill: '#f59e0b', label: 'Warning' },
      { name: '<10%', value: atRisk, fill: '#ef4444', label: 'At Risk' },
    ]
  }, [enrichedProjects])

  // Handlers
  const toggleClient = (clientName: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev)
      if (next.has(clientName)) next.delete(clientName)
      else next.add(clientName)
      return next
    })
  }

  const expandAllClients = () => {
    setExpandedClients(new Set(projectsByClient.map(([name]) => name)))
  }

  const collapseAllClients = () => {
    setExpandedClients(new Set())
  }

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
        spent: parseFloat(formData.spent) || 0,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        resources: parseInt(formData.resources) || 0,
        budgeted_hours: parseFloat(formData.budgeted_hours) || 0,
        percent_complete: parseFloat(formData.percent_complete) || 0,
      }

      if (isAddingCO && parentProjectId) {
        projectData.parent_id = parentProjectId
        projectData.is_change_order = true
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
          p.id === editingProject.id ? { ...p, ...updateData, client: clientName } as Project : p
        ))
      } else {
        const { data, error } = await supabase
          .from('projects')
          .insert(projectData)
          .select()
          .single()

        if (error) throw error

        const clientName = clients.find(c => c.id === formData.client_id)?.name || ''
        setProjects(prev => [...prev, { ...data, client: clientName, actual_hours: 0, billed_hours: 0 } as Project])
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

  const exportToCSV = () => {
    const headers = ['Client', 'Project', 'Status', 'Budget', 'Spent', 'Margin %', 'Health Score', 'Hours', 'Effective Rate']
    const rows = enrichedProjects.map(p => [
      p.client, p.name, p.status, p.budget, p.spent, 
      p.margin.toFixed(1), p.healthScore, p.actual_hours || 0, 
      p.effectiveRate.toFixed(2)
    ])
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `projects-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
          <p className={`text-sm ${THEME.textMuted}`}>Loading projects...</p>
        </div>
      </div>
    )
  }

  const hasActiveFilters = searchQuery || selectedStatus !== 'all' || selectedRisk !== 'all'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-xl font-semibold ${THEME.textPrimary}`}>Project Analytics</h1>
          <p className={`text-sm ${THEME.textMuted} mt-1`}>Client-level portfolio insights and profitability</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 border border-white/[0.1] rounded-lg text-sm font-medium text-slate-300 hover:bg-white/[0.05] transition-colors">
            <Download size={14} />Export
          </button>
          <button onClick={openAddProject} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors">
            <Plus size={14} />Add Project
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard 
          label="Active Projects" 
          value={cfoMetrics.activeCount}
          subtitle={`${formatCompactCurrency(cfoMetrics.totalContractValue)} total`}
          icon={FolderOpen}
          color="blue"
        />
        <MetricCard 
          label="Portfolio Margin" 
          value={formatPercent(cfoMetrics.weightedMargin)}
          subtitle="Weighted average"
          icon={TrendingUp}
          color={cfoMetrics.weightedMargin >= 20 ? 'emerald' : cfoMetrics.weightedMargin >= 10 ? 'amber' : 'rose'}
        />
        <MetricCard 
          label="Utilization" 
          value={formatPercent(cfoMetrics.utilizationRate)}
          subtitle={`${cfoMetrics.totalActualHours.toLocaleString()} hrs logged`}
          icon={Activity}
          color={cfoMetrics.utilizationRate >= 75 ? 'emerald' : cfoMetrics.utilizationRate >= 60 ? 'amber' : 'rose'}
        />
        <MetricCard 
          label="Realization" 
          value={formatPercent(cfoMetrics.realizationRate)}
          subtitle="Billed / Worked"
          icon={Zap}
          color={cfoMetrics.realizationRate >= 90 ? 'emerald' : cfoMetrics.realizationRate >= 80 ? 'amber' : 'rose'}
        />
        <MetricCard 
          label="At-Risk Value" 
          value={formatCompactCurrency(cfoMetrics.atRiskValue)}
          subtitle={`${cfoMetrics.atRiskCount} project${cfoMetrics.atRiskCount !== 1 ? 's' : ''}`}
          icon={AlertTriangle}
          color={cfoMetrics.atRiskCount > 0 ? 'rose' : 'emerald'}
        />
        <MetricCard 
          label="Health Score" 
          value={Math.round(cfoMetrics.avgHealthScore)}
          subtitle="Portfolio average"
          icon={Target}
          color={cfoMetrics.avgHealthScore >= 80 ? 'emerald' : cfoMetrics.avgHealthScore >= 60 ? 'amber' : 'rose'}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Client Revenue Breakdown */}
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-5 lg:col-span-2`}>
          <h3 className={`text-sm font-semibold ${THEME.textPrimary} mb-4`}>Revenue by Client</h3>
          <div className="h-56">
            {clientRevenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={clientRevenueData} layout="vertical" margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => formatCompactCurrency(v)} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                  <Bar dataKey="budget" name="Contract" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="spent" name="Spent" fill="#f43f5e" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className={`flex items-center justify-center h-full ${THEME.textMuted}`}>No project data</div>
            )}
          </div>
        </div>

        {/* Portfolio Pulse (THE EDGE) */}
        <PortfolioPulse 
          metrics={cfoMetrics} 
          topPerformer={topPerformer} 
          needsAttention={needsAttention} 
        />
      </div>

      {/* Projects Table - Client-First View */}
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
        {/* Table Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
          <div className="flex items-center gap-3">
            <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Projects by Client</h3>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full bg-white/[0.08] ${THEME.textSecondary}`}>
              {projectsByClient.length} clients • {filteredProjects.filter(p => !p.is_change_order).length} projects
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-white/[0.05] border border-white/[0.1] rounded-lg text-sm text-slate-200 placeholder-slate-500 w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <button
              onClick={() => expandedClients.size > 0 ? collapseAllClients() : expandAllClients()}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-white/[0.05] ${THEME.textSecondary} hover:bg-white/[0.08]`}
            >
              {expandedClients.size > 0 ? <EyeOff size={14} /> : <Eye size={14} />}
              {expandedClients.size > 0 ? 'Collapse' : 'Expand'}
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showFilters || hasActiveFilters ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.08]'
              }`}
            >
              <Filter size={14} />
              Filters
              {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className={`px-6 py-3 border-b ${THEME.glassBorder} bg-white/[0.02]`}>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1.5 bg-white/[0.05] border border-white/[0.1] rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="all" className="bg-slate-900">All Status</option>
                {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id} className="bg-slate-900">{s.label}</option>)}
              </select>
              <select
                value={selectedRisk}
                onChange={(e) => setSelectedRisk(e.target.value)}
                className="px-3 py-1.5 bg-white/[0.05] border border-white/[0.1] rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              >
                <option value="all" className="bg-slate-900">All Risk Levels</option>
                <option value="low" className="bg-slate-900">Low (80+)</option>
                <option value="medium" className="bg-slate-900">Medium (60-79)</option>
                <option value="high" className="bg-slate-900">High (&lt;60)</option>
              </select>
              {hasActiveFilters && (
                <button 
                  onClick={() => { setSearchQuery(''); setSelectedStatus('all'); setSelectedRisk('all'); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${THEME.textMuted} hover:text-white transition-colors`}
                >
                  <X size={14} /> Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${THEME.glassBorder} bg-white/[0.02]`}>
                <th className={`px-4 py-3 text-left font-medium ${THEME.textMuted} text-xs uppercase tracking-wide`} colSpan={2}>Client / Project</th>
                <th className={`px-4 py-3 text-center font-medium ${THEME.textMuted} text-xs uppercase tracking-wide`}>Health</th>
                <th className={`px-4 py-3 text-right font-medium ${THEME.textMuted} text-xs uppercase tracking-wide`}>Contract</th>
                <th className={`px-4 py-3 text-right font-medium ${THEME.textMuted} text-xs uppercase tracking-wide`}>Spent</th>
                <th className={`px-4 py-3 text-right font-medium ${THEME.textMuted} text-xs uppercase tracking-wide`}>Margin</th>
                <th className={`px-4 py-3 text-center font-medium ${THEME.textMuted} text-xs uppercase tracking-wide`}>Burn %</th>
                <th className={`px-4 py-3 text-center font-medium ${THEME.textMuted} text-xs uppercase tracking-wide`}>Hours</th>
                <th className={`px-4 py-3 text-right font-medium ${THEME.textMuted} text-xs uppercase tracking-wide`}>$/hr</th>
                <th className={`px-4 py-3 text-center font-medium ${THEME.textMuted} text-xs uppercase tracking-wide w-28`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projectsByClient.length > 0 ? (
                projectsByClient.map(([clientName, clientProjects]) => (
                  <React.Fragment key={clientName}>
                    {/* Client Summary Row */}
                    <ClientSummaryRow
                      clientName={clientName}
                      projects={clientProjects}
                      isExpanded={expandedClients.has(clientName)}
                      onToggle={() => toggleClient(clientName)}
                    />
                    
                    {/* Project Rows (if expanded) */}
                    {expandedClients.has(clientName) && clientProjects.map(project => (
                      <React.Fragment key={project.id}>
                        <ProjectRow 
                          project={project} 
                          isNested 
                          onEdit={openEditProject}
                          onDelete={deleteProject}
                          onAddCO={openAddCO}
                        />
                        {/* Change Orders */}
                        {project.changeOrders?.map((co: any) => (
                          <ProjectRow 
                            key={co.id}
                            project={co} 
                            isNested 
                            onEdit={openEditProject}
                            onDelete={deleteProject}
                            onAddCO={openAddCO}
                          />
                        ))}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className={`px-4 py-12 text-center ${THEME.textMuted}`}>
                    No projects found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-6 py-3 border-t ${THEME.glassBorder} bg-white/[0.02]`}>
          <p className={`text-sm ${THEME.textMuted}`}>
            {projectsByClient.length} clients • {filteredProjects.filter(p => !p.is_change_order).length} projects
          </p>
          <div className="flex items-center gap-6 text-sm">
            <div><span className={THEME.textMuted}>Contract: </span><span className={`font-semibold ${THEME.textPrimary}`}>{formatCurrency(cfoMetrics.totalContractValue)}</span></div>
            <div><span className={THEME.textMuted}>Spent: </span><span className="font-semibold text-rose-400">{formatCurrency(cfoMetrics.totalSpent)}</span></div>
            <div><span className={THEME.textMuted}>Margin: </span><span className={`font-semibold ${cfoMetrics.weightedMargin >= 20 ? 'text-emerald-400' : cfoMetrics.weightedMargin >= 10 ? 'text-amber-400' : 'text-rose-400'}`}>{formatPercent(cfoMetrics.weightedMargin)}</span></div>
          </div>
        </div>
      </div>

      {/* Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-2xl w-full max-w-lg mx-4 overflow-hidden`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
              <h3 className={`text-lg font-semibold ${THEME.textPrimary}`}>
                {editingProject ? 'Edit Project' : isAddingCO ? 'Add Change Order' : 'Add Project'}
              </h3>
              <button onClick={() => setShowProjectModal(false)} className="p-1 hover:bg-white/[0.05] rounded-lg transition-colors">
                <X size={20} className={THEME.textMuted} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Project Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  placeholder="Enter project name"
                />
              </div>
              
              {!isAddingCO && (
                <div>
                  <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Client</label>
                  <select
                    value={formData.client_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, client_id: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <option value="" className="bg-slate-900">Select client...</option>
                    {clients.map(c => <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>)}
                  </select>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Budget</label>
                  <div className="relative">
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${THEME.textDim}`}>$</span>
                    <input
                      type="number"
                      value={formData.budget}
                      onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                      className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg pl-7 pr-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Spent</label>
                  <div className="relative">
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${THEME.textDim}`}>$</span>
                    <input
                      type="number"
                      value={formData.spent}
                      onChange={(e) => setFormData(prev => ({ ...prev, spent: e.target.value }))}
                      className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg pl-7 pr-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Start Date</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>End Date</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Budgeted Hours</label>
                  <input
                    type="number"
                    value={formData.budgeted_hours}
                    onChange={(e) => setFormData(prev => ({ ...prev, budgeted_hours: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>% Complete</label>
                  <input
                    type="number"
                    value={formData.percent_complete}
                    onChange={(e) => setFormData(prev => ({ ...prev, percent_complete: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    placeholder="0"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
              
              <div>
                <label className={`block text-sm font-medium ${THEME.textMuted} mb-2`}>Status</label>
                <div className="flex gap-2">
                  {STATUS_OPTIONS.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setFormData(prev => ({ ...prev, status: s.id }))}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-colors ${
                        formData.status === s.id 
                          ? `${getStatusStyle(s.id).bg} ${getStatusStyle(s.id).text} border ${getStatusStyle(s.id).border}`
                          : 'bg-white/[0.05] text-slate-400 border border-transparent hover:bg-white/[0.08]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${THEME.glassBorder} bg-white/[0.02]`}>
              <button onClick={() => setShowProjectModal(false)} className={`px-4 py-2 text-sm font-medium ${THEME.textMuted} hover:text-white transition-colors`}>
                Cancel
              </button>
              <button 
                onClick={saveProject} 
                disabled={!formData.name}
                className="px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
