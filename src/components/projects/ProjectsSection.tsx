'use client'

import React, { useMemo, useState, forwardRef, useImperativeHandle } from 'react'
import {
  Building2, Briefcase, ChevronDown, ChevronRight, Search,
  Plus, ArrowUpDown, ArrowUp, ArrowDown, Upload, Trash2,
  Edit2, AlertTriangle, CheckCircle2, Clock, DollarSign,
  TrendingUp, Users, Filter, Eye, EyeOff
} from 'lucide-react'
import {
  THEME, COLORS, PROJECT_STATUSES, getContractType, getServiceLine,
  calculateProjectEconomics, getMonthsActive,
  formatCurrency, formatPercent, formatCompactCurrency,
  StatusBadge, ContractBadge, MarginBadge, ProgressBar, MarginIndicator,
  ContractType
} from './shared'

interface ProjectsSectionProps {
  projects: any[]
  clients: any[]
  timesheets: any[]
  onAddProject: () => void
  onEditProject: (project: any) => void
  onDeleteProject: (id: string, name: string) => void
  onAddChangeOrder: (parentId: string, parentName: string) => void
  onViewProject?: (projectId: string) => void
}

export interface ProjectsSectionHandle {
  scrollToProject: (id: string) => void
}

const ProjectsSection = forwardRef<ProjectsSectionHandle, ProjectsSectionProps>(({
  projects, clients, timesheets, onAddProject, onEditProject, onDeleteProject, onAddChangeOrder, onViewProject
}, ref) => {
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<string>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())
  const [allExpanded, setAllExpanded] = useState(true)

  useImperativeHandle(ref, () => ({
    scrollToProject: (id: string) => {
      const el = document.getElementById(`project-${id}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }))

  // Enrich projects
  const enrichedProjects = useMemo(() => {
    const hoursMap = new Map<string, number>()
    timesheets.forEach(t => hoursMap.set(t.project_id, (hoursMap.get(t.project_id) || 0) + (t.hours || 0)))

    return projects.map(p => {
      const budget = p.budget || 0
      const spent = p.spent || 0
      const actualHours = hoursMap.get(p.id) || 0
      const contractType = getContractType(p)
      const serviceLine = getServiceLine(p)
      const margin = budget > 0 ? ((budget - spent) / budget) * 100 : 0
      const burnRate = budget > 0 ? (spent / budget) * 100 : 0
      const effectiveRate = actualHours > 0 ? spent / actualHours : 0

      const cos = projects.filter(co => co.parent_id === p.id && co.is_change_order)
      const clientName = clients.find(c => c.id === p.client_id)?.name || 'No Client'

      return {
        ...p, margin, burnRate, actualHours, effectiveRate, contractType, serviceLine,
        budgetedHours: p.budgeted_hours || 0,
        changeOrders: cos, clientName,
      }
    })
  }, [projects, clients, timesheets])

  // Filter + Sort
  const filtered = useMemo(() => {
    let result = enrichedProjects.filter(p => !p.is_change_order)
    if (statusFilter !== 'all') result = result.filter(p => p.status === statusFilter)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q))
    }
    result.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'name': cmp = a.name.localeCompare(b.name); break
        case 'budget': cmp = (a.budget || 0) - (b.budget || 0); break
        case 'margin': cmp = a.margin - b.margin; break
        case 'cpi': cmp = a.burnRate - b.burnRate; break
        case 'burn': cmp = a.burnRate - b.burnRate; break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return result
  }, [enrichedProjects, statusFilter, searchQuery, sortField, sortDir])

  // Group by client
  const clientGroups = useMemo(() => {
    const groups = new Map<string, typeof filtered>()
    filtered.forEach(p => {
      const existing = groups.get(p.clientName) || []
      existing.push(p)
      groups.set(p.clientName, existing)
    })
    const sorted = Array.from(groups.entries())
      .map(([name, projs]) => ({
        name,
        projects: projs,
        totalBudget: projs.reduce((sum, p) => sum + (p.budget || 0), 0),
        totalSpent: projs.reduce((sum, p) => sum + (p.spent || 0), 0),
        avgMargin: projs.length > 0 ? projs.reduce((sum, p) => sum + p.margin, 0) / projs.length : 0,
        flaggedCount: projs.filter(p => p.margin < 10 && p.spent > 0).length,
      }))
      .sort((a, b) => b.totalBudget - a.totalBudget)
    return sorted
  }, [filtered])

  // Expand/collapse
  React.useEffect(() => {
    if (allExpanded) setExpandedClients(new Set(clientGroups.map(g => g.name)))
    else setExpandedClients(new Set())
  }, [clientGroups, allExpanded])

  const toggleClient = (name: string) => {
    const next = new Set(expandedClients)
    if (next.has(name)) next.delete(name); else next.add(name)
    setExpandedClients(next)
  }

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    enrichedProjects.filter(p => !p.is_change_order).forEach(p => counts[p.status] = (counts[p.status] || 0) + 1)
    return counts
  }, [enrichedProjects])

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="text-slate-300" />
    return sortDir === 'asc' ? <ArrowUp size={12} className="text-emerald-600" /> : <ArrowDown size={12} className="text-emerald-600" />
  }

  return (
    <div className="space-y-4">
      {/* Status Tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {['active', 'completed', 'on_hold', 'archived'].map(status => {
          const config = PROJECT_STATUSES[status as keyof typeof PROJECT_STATUSES]
          const count = statusCounts[status] || 0
          return (
            <button key={status} onClick={() => setStatusFilter(status)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                statusFilter === status
                  ? `${config.bg} ${config.text} border ${config.border}`
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 border border-transparent'
              }`}>
              {config.label}
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                statusFilter === status ? 'bg-white/60' : 'bg-slate-100 text-slate-500'
              }`}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Table Card */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Projects by Client</h3>
            <p className="text-xs text-slate-400">{clientGroups.length} clients • {filtered.length} projects</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search projects..."
                className="pl-8 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 w-48" />
            </div>
            <button onClick={() => setAllExpanded(!allExpanded)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200">
              {allExpanded ? <EyeOff size={14} /> : <Eye size={14} />}
              {allExpanded ? 'Collapse' : 'Expand'}
            </button>
            <button onClick={onAddProject}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm">
              <Plus size={14} />Add Project
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200 bg-slate-50">
          <div className="w-8 shrink-0"></div>
          <div className="flex-1 cursor-pointer flex items-center gap-1 hover:text-slate-600" onClick={() => toggleSort('name')}>Client / Project <SortIcon field="name" /></div>
          <div className="w-24 shrink-0 text-left">Status</div>
          <div className="w-28 shrink-0 text-right cursor-pointer flex items-center justify-end gap-1 hover:text-slate-600" onClick={() => toggleSort('budget')}>Contract <SortIcon field="budget" /></div>
          <div className="w-24 shrink-0 text-right">Spent</div>
          <div className="w-20 shrink-0 text-right cursor-pointer flex items-center justify-end gap-1 hover:text-slate-600" onClick={() => toggleSort('margin')}>Margin <SortIcon field="margin" /></div>
          <div className="w-16 shrink-0 text-center">Type</div>
          <div className="w-24 shrink-0 text-right">Hours</div>
          <div className="w-16 shrink-0 text-center">Burn</div>
          <div className="w-24 shrink-0 text-right">Actions</div>
        </div>

        {/* Client Groups */}
        <div className="divide-y divide-slate-100">
          {clientGroups.map(({ name: clientName, projects: clientProjects, totalBudget, totalSpent, avgMargin, flaggedCount }) => (
            <div key={clientName}>
              {/* Client Row */}
              <div className="flex items-center gap-3 py-3 px-4 bg-slate-50/50 hover:bg-slate-100 cursor-pointer transition-colors border-b border-slate-100"
                onClick={() => toggleClient(clientName)}>
                <div className="w-8 shrink-0 flex items-center justify-center">
                  {expandedClients.has(clientName) ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <Building2 size={14} className="text-emerald-600 shrink-0" />
                  <span className="font-semibold text-slate-800">{clientName}</span>
                  <span className="text-xs text-slate-400">{clientProjects.length} projects</span>
                  {flaggedCount > 0 && <span className="text-xs text-rose-600 font-medium">• {flaggedCount} thin margin</span>}
                </div>
                <div className="w-24 shrink-0"></div>
                <div className="w-28 shrink-0 text-right font-semibold text-slate-700">{formatCurrency(totalBudget)}</div>
                <div className="w-24 shrink-0 text-right text-rose-600">{formatCurrency(totalSpent)}</div>
                <div className="w-20 shrink-0 text-right">
                  <span className={`font-semibold ${avgMargin >= 20 ? 'text-emerald-600' : avgMargin >= 10 ? 'text-amber-600' : 'text-rose-600'}`}>{formatPercent(avgMargin)}</span>
                </div>
                <div className="w-16 shrink-0"></div>
                <div className="w-24 shrink-0"></div>
                <div className="w-16 shrink-0"></div>
                <div className="w-24 shrink-0"></div>
              </div>

              {/* Project Rows */}
              {expandedClients.has(clientName) && clientProjects.map(project => (
                <React.Fragment key={project.id}>
                  <ProjectRow
                    project={project}
                    onEdit={() => onEditProject(project)}
                    onDelete={() => onDeleteProject(project.id, project.name)}
                    onAddCO={() => onAddChangeOrder(project.id, project.name)}
                    onView={onViewProject ? () => onViewProject(project.id) : undefined}
                  />
                  {project.changeOrders?.map((co: any) => (
                    <ProjectRow key={co.id} project={co} isChangeOrder
                      onEdit={() => onEditProject(co)}
                      onDelete={() => onDeleteProject(co.id, co.name)}
                      onAddCO={() => {}}
                      onView={onViewProject ? () => onViewProject(co.id) : undefined}
                    />
                  ))}
                </React.Fragment>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 border-t-2 border-slate-300 bg-slate-50 text-sm font-semibold">
            <div className="w-8 shrink-0"></div>
            <div className="flex-1 text-slate-700">{clientGroups.length} clients • {filtered.length} projects</div>
            <div className="w-24 shrink-0"></div>
            <div className="w-28 shrink-0 text-right text-slate-900">{formatCurrency(filtered.reduce((s, p) => s + (p.budget || 0), 0))}</div>
            <div className="w-24 shrink-0 text-right text-rose-600">{formatCurrency(filtered.reduce((s, p) => s + (p.spent || 0), 0))}</div>
            <div className="w-20 shrink-0 text-right">
              {(() => {
                const tb = filtered.reduce((s, p) => s + (p.budget || 0), 0)
                const ts = filtered.reduce((s, p) => s + (p.spent || 0), 0)
                const m = tb > 0 ? ((tb - ts) / tb) * 100 : 0
                return <span className={m >= 20 ? 'text-emerald-600' : m >= 10 ? 'text-amber-600' : 'text-rose-600'}>{formatPercent(m)}</span>
              })()}
            </div>
            <div className="w-16 shrink-0"></div>
            <div className="w-24 shrink-0"></div>
            <div className="w-16 shrink-0"></div>
            <div className="w-24 shrink-0"></div>
          </div>
        )}
      </div>
    </div>
  )
})

ProjectsSection.displayName = 'ProjectsSection'
export default ProjectsSection
export type { ProjectsSectionProps }

// ============ PROJECT ROW ============
function ProjectRow({ project, isChangeOrder = false, onEdit, onDelete, onAddCO, onView }: {
  project: any; isChangeOrder?: boolean
  onEdit: () => void; onDelete: () => void; onAddCO: () => void; onView?: () => void
}) {
  return (
    <div id={`project-${project.id}`} className={`flex items-center gap-3 py-3 px-4 hover:bg-slate-50 transition-colors border-b border-slate-100 ${isChangeOrder ? 'bg-slate-50/50' : ''}`}>
      <div className="w-8 shrink-0"></div>
      <div className={`flex-1 min-w-0 flex items-center gap-2 ${isChangeOrder ? 'pl-8' : ''}`}>
        {isChangeOrder && <div className="w-4 h-px bg-slate-200" />}
        <Briefcase size={14} className={THEME.textDim} />
        <span onClick={onView} className={`font-medium ${THEME.textPrimary} truncate ${onView ? 'cursor-pointer hover:text-emerald-600 hover:underline transition-colors' : ''}`}>{project.name}</span>
        {isChangeOrder && <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-cyan-50 text-cyan-600 shrink-0">CO</span>}
      </div>
      <div className="w-24 shrink-0"><StatusBadge status={project.status} /></div>
      <div className="w-28 shrink-0 text-right"><span className={`font-medium ${THEME.textPrimary}`}>{formatCurrency(project.budget)}</span></div>
      <div className="w-24 shrink-0 text-right"><span className="text-rose-600">{formatCurrency(project.spent)}</span></div>
      <div className="w-20 shrink-0 text-right">
        <span className={`font-semibold ${project.margin >= 20 ? 'text-emerald-600' : project.margin >= 10 ? 'text-amber-600' : 'text-rose-600'}`}>{formatPercent(project.margin)}</span>
      </div>
      <div className="w-16 shrink-0 text-center">
        <ContractBadge type={project.contractType || 'lump_sum'} />
      </div>
      <div className="w-24 shrink-0 text-right">
        <span className="text-slate-600">{project.actualHours || 0}</span>
        {project.budgetedHours > 0 && <span className="text-slate-300">/{project.budgetedHours}</span>}
      </div>
      <div className="w-16 shrink-0 text-center">
        <span className={`text-xs font-semibold tabular-nums ${project.burnRate > 90 ? 'text-rose-600' : project.burnRate > 70 ? 'text-amber-600' : 'text-slate-500'}`}>
          {project.budget > 0 ? `${project.burnRate.toFixed(0)}%` : '—'}
        </span>
      </div>
      <div className="w-24 shrink-0 flex items-center justify-end gap-1">
        {!isChangeOrder && (
          <button onClick={onAddCO} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-emerald-600" title="Add Change Order"><Plus size={14} /></button>
        )}
        <button onClick={onEdit} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-600" title="Edit"><Edit2 size={14} /></button>
        <button onClick={onDelete} className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-rose-600" title="Delete"><Trash2 size={14} /></button>
      </div>
    </div>
  )
}
