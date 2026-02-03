'use client'

import React, { useState, useMemo, forwardRef, useImperativeHandle } from 'react'
import {
  Search, ChevronDown, ChevronUp, ChevronRight, Plus, Edit2,
  Trash2, Building2, Briefcase, AlertTriangle, Eye, EyeOff,
  Download, Filter, MoreHorizontal, X
} from 'lucide-react'
import {
  THEME, COLORS, PROJECT_STATUSES, getStatusConfig, getHealthConfig,
  calculateHealthScore, formatCurrency, formatPercent, formatDateShort,
  StatusBadge, HealthBadge, ProgressBar, MarginIndicator, CollapsibleSection, EmptyState
} from './shared'

interface ProjectsSectionProps {
  projects: any[]
  clients: any[]
  timesheets: any[]
  onAddProject: () => void
  onEditProject: (project: any) => void
  onDeleteProject: (id: string, name: string) => void
  onAddChangeOrder: (parentId: string, parentName: string) => void
}

export interface ProjectsSectionHandle {
  openAddModal: () => void
}

const ProjectsSection = forwardRef<ProjectsSectionHandle, ProjectsSectionProps>(({
  projects, clients, timesheets, onAddProject, onEditProject, onDeleteProject, onAddChangeOrder
}, ref) => {
  // Status tabs
  const [activeStatus, setActiveStatus] = useState<'active' | 'completed' | 'on_hold' | 'archived'>('active')
  
  // Search & filters
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<'name' | 'budget' | 'margin' | 'health'>('budget')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  
  // Client expansion
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())
  const [allExpanded, setAllExpanded] = useState(true)

  useImperativeHandle(ref, () => ({
    openAddModal: onAddProject
  }))

  // Enrich projects with calculated fields
  const enrichedProjects = useMemo(() => {
    // Get hours per project from timesheets
    const hoursMap = new Map<string, { actual: number; billed: number }>()
    timesheets.forEach(t => {
      const existing = hoursMap.get(t.project_id) || { actual: 0, billed: 0 }
      existing.actual += t.hours || 0
      if (t.billable) existing.billed += t.hours || 0
      hoursMap.set(t.project_id, existing)
    })

    return projects.map(p => {
      const hours = hoursMap.get(p.id) || { actual: 0, billed: 0 }
      const healthScore = calculateHealthScore(p)
      const margin = p.budget > 0 ? ((p.budget - p.spent) / p.budget) * 100 : 0
      const burnRate = p.budget > 0 ? (p.spent / p.budget) * 100 : 0
      const effectiveRate = hours.actual > 0 ? p.spent / hours.actual : 0

      return {
        ...p,
        actual_hours: hours.actual,
        billed_hours: hours.billed,
        healthScore,
        margin,
        burnRate,
        effectiveRate,
        client: clients.find(c => c.id === p.client_id)?.name || 'No Client'
      }
    })
  }, [projects, clients, timesheets])

  // Filter by status tab
  const statusFilteredProjects = useMemo(() => {
    return enrichedProjects.filter(p => p.status === activeStatus && !p.is_change_order)
  }, [enrichedProjects, activeStatus])

  // Apply search and sort
  const filteredProjects = useMemo(() => {
    let result = [...statusFilteredProjects]

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.client?.toLowerCase().includes(q)
      )
    }

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]
      if (sortField === 'health') { aVal = a.healthScore; bVal = b.healthScore }
      return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
    })

    return result
  }, [statusFilteredProjects, searchQuery, sortField, sortDir])

  // Group by client
  const projectsByClient = useMemo(() => {
    const grouped = new Map<string, any[]>()
    const changeOrders = enrichedProjects.filter(p => p.is_change_order && p.status === activeStatus)

    filteredProjects.forEach(p => {
      const clientName = p.client || 'No Client'
      const existing = grouped.get(clientName) || []
      
      // Attach change orders
      const cos = changeOrders.filter(co => co.parent_id === p.id)
      existing.push({ ...p, changeOrders: cos })
      grouped.set(clientName, existing)
    })

    // Sort clients by total budget
    return Array.from(grouped.entries()).sort((a, b) => {
      const aTotal = a[1].reduce((sum, p) => sum + p.budget, 0)
      const bTotal = b[1].reduce((sum, p) => sum + p.budget, 0)
      return bTotal - aTotal
    })
  }, [filteredProjects, enrichedProjects, activeStatus])

  // Counts per status
  const statusCounts = useMemo(() => ({
    active: enrichedProjects.filter(p => p.status === 'active' && !p.is_change_order).length,
    completed: enrichedProjects.filter(p => p.status === 'completed' && !p.is_change_order).length,
    on_hold: enrichedProjects.filter(p => p.status === 'on_hold' && !p.is_change_order).length,
    archived: enrichedProjects.filter(p => p.status === 'archived' && !p.is_change_order).length,
  }), [enrichedProjects])

  // Totals for footer
  const totals = useMemo(() => ({
    contract: filteredProjects.reduce((sum, p) => sum + (p.budget || 0), 0),
    spent: filteredProjects.reduce((sum, p) => sum + (p.spent || 0), 0),
    margin: filteredProjects.length > 0
      ? filteredProjects.reduce((sum, p) => sum + p.margin, 0) / filteredProjects.length
      : 0
  }), [filteredProjects])

  // Handlers
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const toggleClient = (clientName: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev)
      if (next.has(clientName)) next.delete(clientName)
      else next.add(clientName)
      return next
    })
  }

  const toggleAllClients = () => {
    if (allExpanded) {
      setExpandedClients(new Set())
    } else {
      setExpandedClients(new Set(projectsByClient.map(([name]) => name)))
    }
    setAllExpanded(!allExpanded)
  }

  // Initialize expanded state
  React.useEffect(() => {
    if (allExpanded) {
      setExpandedClients(new Set(projectsByClient.map(([name]) => name)))
    }
  }, [projectsByClient, allExpanded])

  return (
    <div className="space-y-6">
      {/* Status Tabs */}
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-1.5 inline-flex gap-1`}>
        {(['active', 'completed', 'on_hold', 'archived'] as const).map(status => {
          const config = getStatusConfig(status)
          const count = statusCounts[status]
          const isActive = activeStatus === status
          
          return (
            <button
              key={status}
              onClick={() => setActiveStatus(status)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? `${config.bg} ${config.text} border ${config.border} shadow-lg`
                  : `${THEME.textMuted} hover:text-white hover:bg-white/[0.05]`
              }`}
            >
              {config.label}
              {count > 0 && (
                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                  isActive ? 'bg-white/20' : 'bg-white/[0.08]'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Projects Table */}
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
          <div>
            <h2 className={`text-sm font-semibold ${THEME.textPrimary}`}>Projects by Client</h2>
            <p className={`text-xs ${THEME.textDim} mt-0.5`}>
              {projectsByClient.length} clients • {filteredProjects.length} projects
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="bg-white/[0.05] border border-white/[0.1] rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <button
              onClick={toggleAllClients}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${THEME.textMuted} hover:text-white transition-colors`}
            >
              {allExpanded ? <EyeOff size={14} /> : <Eye size={14} />}
              {allExpanded ? 'Collapse' : 'Expand'}
            </button>
            <button
              onClick={onAddProject}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 transition-colors"
            >
              <Plus size={14} /> Add Project
            </button>
          </div>
        </div>

        {/* Column Headers */}
        <div className={`flex items-center gap-3 py-2.5 px-4 bg-white/[0.03] border-b ${THEME.glassBorder} text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>
          <div className="w-8 shrink-0"></div>
          <button onClick={() => handleSort('name')} className="flex-1 min-w-0 flex items-center gap-1 hover:text-white transition-colors">
            Client / Project {sortField === 'name' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <button onClick={() => handleSort('health')} className="w-16 shrink-0 text-center flex items-center justify-center gap-1 hover:text-white transition-colors">
            Health {sortField === 'health' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <button onClick={() => handleSort('budget')} className="w-28 shrink-0 text-right flex items-center justify-end gap-1 hover:text-white transition-colors">
            Contract {sortField === 'budget' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <div className="w-24 shrink-0 text-right">Spent</div>
          <button onClick={() => handleSort('margin')} className="w-20 shrink-0 text-right flex items-center justify-end gap-1 hover:text-white transition-colors">
            Margin {sortField === 'margin' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <div className="w-28 shrink-0 text-center">Burn %</div>
          <div className="w-24 shrink-0 text-center">Hours</div>
          <div className="w-20 shrink-0 text-right">$/HR</div>
          <div className="w-24 shrink-0 text-center">Actions</div>
        </div>

        {/* Project List */}
        <div className="max-h-[600px] overflow-y-auto">
          {projectsByClient.length > 0 ? (
            projectsByClient.map(([clientName, clientProjects]) => (
              <React.Fragment key={clientName}>
                {/* Client Row */}
                <ClientRow
                  clientName={clientName}
                  projects={clientProjects}
                  isExpanded={expandedClients.has(clientName)}
                  onToggle={() => toggleClient(clientName)}
                />
                
                {/* Project Rows */}
                {expandedClients.has(clientName) && clientProjects.map(project => (
                  <React.Fragment key={project.id}>
                    <ProjectRow
                      project={project}
                      onEdit={() => onEditProject(project)}
                      onDelete={() => onDeleteProject(project.id, project.name)}
                      onAddCO={() => onAddChangeOrder(project.id, project.name)}
                    />
                    {/* Change Orders */}
                    {project.changeOrders?.map((co: any) => (
                      <ProjectRow
                        key={co.id}
                        project={co}
                        isChangeOrder
                        onEdit={() => onEditProject(co)}
                        onDelete={() => onDeleteProject(co.id, co.name)}
                        onAddCO={() => {}}
                      />
                    ))}
                  </React.Fragment>
                ))}
              </React.Fragment>
            ))
          ) : (
            <EmptyState
              icon={Briefcase}
              title={`No ${getStatusConfig(activeStatus).label.toLowerCase()} projects`}
              description={activeStatus === 'active' ? 'Create your first project to get started' : 'No projects with this status'}
              action={activeStatus === 'active' ? { label: 'Add Project', onClick: onAddProject } : undefined}
            />
          )}
        </div>

        {/* Footer */}
        {filteredProjects.length > 0 && (
          <div className={`flex items-center justify-between px-6 py-3 border-t ${THEME.glassBorder} bg-white/[0.02]`}>
            <p className={`text-sm ${THEME.textMuted}`}>
              {projectsByClient.length} clients • {filteredProjects.length} projects
            </p>
            <div className="flex items-center gap-6 text-sm">
              <div>
                <span className={THEME.textMuted}>Contract: </span>
                <span className={`font-semibold ${THEME.textPrimary}`}>{formatCurrency(totals.contract)}</span>
              </div>
              <div>
                <span className={THEME.textMuted}>Spent: </span>
                <span className="font-semibold text-rose-400">{formatCurrency(totals.spent)}</span>
              </div>
              <div>
                <span className={THEME.textMuted}>Avg Margin: </span>
                <MarginIndicator margin={totals.margin} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

ProjectsSection.displayName = 'ProjectsSection'
export default ProjectsSection

// Client Summary Row
function ClientRow({ clientName, projects, isExpanded, onToggle }: {
  clientName: string
  projects: any[]
  isExpanded: boolean
  onToggle: () => void
}) {
  const totalBudget = projects.reduce((sum, p) => sum + (p.budget || 0), 0)
  const totalSpent = projects.reduce((sum, p) => sum + (p.spent || 0), 0)
  const totalHours = projects.reduce((sum, p) => sum + (p.actual_hours || 0), 0)
  const margin = totalBudget > 0 ? ((totalBudget - totalSpent) / totalBudget) * 100 : 0
  const avgHealth = projects.length > 0 ? projects.reduce((sum, p) => sum + p.healthScore, 0) / projects.length : 0
  const atRiskCount = projects.filter(p => p.healthScore < 60).length
  const effectiveRate = totalHours > 0 ? totalSpent / totalHours : 0

  return (
    <div
      onClick={onToggle}
      className="flex items-center gap-3 py-3 px-4 bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer transition-colors border-b border-white/[0.08]"
    >
      <div className="w-8 shrink-0">
        <div className={`p-1 rounded transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
          <ChevronRight size={16} className={THEME.textMuted} />
        </div>
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center shrink-0">
          <Building2 size={16} className="text-emerald-400" />
        </div>
        <div>
          <p className={`font-semibold ${THEME.textPrimary}`}>{clientName}</p>
          <p className={`text-xs ${THEME.textDim}`}>
            {projects.length} project{projects.length !== 1 ? 's' : ''}
            {atRiskCount > 0 && <span className="text-rose-400 ml-2">• {atRiskCount} at risk</span>}
          </p>
        </div>
      </div>
      <div className="w-16 shrink-0 text-center">
        <span className={`text-sm font-medium ${getHealthConfig(avgHealth).text}`}>{Math.round(avgHealth)}</span>
      </div>
      <div className="w-28 shrink-0 text-right">
        <span className={`font-semibold ${THEME.textPrimary}`}>{formatCurrency(totalBudget)}</span>
      </div>
      <div className="w-24 shrink-0 text-right">
        <span className="text-rose-400">{formatCurrency(totalSpent)}</span>
      </div>
      <div className="w-20 shrink-0 text-right">
        <MarginIndicator margin={margin} />
      </div>
      <div className="w-28 shrink-0">
        <ProgressBar value={totalSpent} max={totalBudget} />
      </div>
      <div className="w-24 shrink-0 text-center">
        <span className={`text-sm ${THEME.textMuted}`}>{totalHours.toLocaleString()}</span>
      </div>
      <div className="w-20 shrink-0 text-right">
        <span className={`text-sm ${THEME.textSecondary}`}>{effectiveRate > 0 ? `$${effectiveRate.toFixed(0)}` : '—'}</span>
      </div>
      <div className="w-24 shrink-0"></div>
    </div>
  )
}

// Project Row
function ProjectRow({ project, isChangeOrder = false, onEdit, onDelete, onAddCO }: {
  project: any
  isChangeOrder?: boolean
  onEdit: () => void
  onDelete: () => void
  onAddCO: () => void
}) {
  return (
    <div className={`flex items-center gap-3 py-3 px-4 hover:bg-white/[0.03] transition-colors border-b border-white/[0.05] ${isChangeOrder ? 'bg-white/[0.01]' : ''}`}>
      <div className="w-8 shrink-0"></div>
      <div className={`flex-1 min-w-0 flex items-center gap-2 ${isChangeOrder ? 'pl-8' : ''}`}>
        {isChangeOrder && <div className="w-4 h-px bg-white/10" />}
        <Briefcase size={14} className={THEME.textDim} />
        <span className={`font-medium ${THEME.textPrimary} truncate`}>{project.name}</span>
        {project.healthScore < 60 && <AlertTriangle size={14} className="text-rose-400 shrink-0" />}
        {isChangeOrder && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-cyan-500/20 text-cyan-400 shrink-0">CO</span>
        )}
      </div>
      <div className="w-16 shrink-0 text-center">
        <HealthBadge score={project.healthScore} />
      </div>
      <div className="w-28 shrink-0 text-right">
        <span className={`font-medium ${THEME.textPrimary}`}>{formatCurrency(project.budget)}</span>
      </div>
      <div className="w-24 shrink-0 text-right">
        <span className="text-rose-400">{formatCurrency(project.spent)}</span>
      </div>
      <div className="w-20 shrink-0 text-right">
        <MarginIndicator margin={project.margin} />
      </div>
      <div className="w-28 shrink-0">
        <ProgressBar value={project.spent} max={project.budget} />
      </div>
      <div className="w-24 shrink-0 text-center">
        <span className={`text-sm ${THEME.textMuted}`}>
          {project.actual_hours || 0}
          {project.budgeted_hours ? `/${project.budgeted_hours}` : ''}
        </span>
      </div>
      <div className="w-20 shrink-0 text-right">
        <span className={`text-sm ${THEME.textSecondary}`}>
          {project.effectiveRate > 0 ? `$${project.effectiveRate.toFixed(0)}` : '—'}
        </span>
      </div>
      <div className="w-24 shrink-0 flex items-center justify-center gap-0.5">
        {!isChangeOrder && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddCO(); }}
            className="p-1.5 rounded hover:bg-white/[0.08] text-slate-500 hover:text-emerald-400 transition-colors"
            title="Add Change Order"
          >
            <Plus size={14} />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-1.5 rounded hover:bg-white/[0.08] text-slate-500 hover:text-slate-300 transition-colors"
          title="Edit"
        >
          <Edit2 size={14} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  )
}
