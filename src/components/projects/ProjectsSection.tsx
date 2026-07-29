'use client'

// PROJECTS LIST — Blueprint rebuild (revenue-only)
// Row layout: Project | Status | Type | Basis | Recognized | Hours | Ends
// Removed: Spent, Margin, Burn, effective rate — cost layers in later, admin-only.

import React, { useMemo, useState, forwardRef, useImperativeHandle } from 'react'
import {
  Building2, ChevronDown, ChevronRight, Search, Plus, ArrowUpDown,
  ArrowUp, ArrowDown, Trash2, Edit2, FilePlus2, Eye,
} from 'lucide-react'
import {
  BLUEPRINT, PROJECT_STATUSES, getContractType,
  formatCompactCurrency, formatDateShort, StatusBadge,
  calcProjectRevenue, buildRateLookups, todayISO, daysUntil,
  getProjectPhases, phaseForDate, entryRevenue, monthKeyOf, monthLabel,
} from './shared'

const AR = { fontFamily: BLUEPRINT.fontDisplay }

interface ProjectsSectionProps {
  projects: any[]
  clients: any[]
  timesheets: any[]
  billRates?: any[]
  assignments?: any[]
  projectTerms?: any[]
  onAddProject: () => void
  onEditProject: (project: any) => void
  onDeleteProject: (id: string, name: string) => void
  onAddChangeOrder: (parentId: string, parentName: string) => void
  onViewProject?: (projectId: string) => void
}

export interface ProjectsSectionHandle {
  scrollToProject: (id: string) => void
}

function TypeBadge({ type }: { type: string }) {
  const ls = type === 'lump_sum'
  return (
    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md" style={{ ...AR, background: ls ? BLUEPRINT.blueSoft : '#f3e8ff', color: ls ? BLUEPRINT.blue : '#7c3aed' }}>
      {ls ? 'LS' : 'T&M'}
    </span>
  )
}

function EndsChip({ project, type, today }: { project: any; type: string; today: string }) {
  const end = (project.end_date || '').slice(0, 10)
  if (!end) {
    if (type === 'lump_sum' && (project.fixed_amount || 0) > 0 && project.status === 'active')
      return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 whitespace-nowrap">No end date</span>
    return <span className="text-slate-300">—</span>
  }
  const days = daysUntil(end, today)
  if (days < 0) return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 whitespace-nowrap">Ended {formatDateShort(end)}</span>
  const soon = days <= 60
  return (
    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap tabular-nums"
      style={soon ? { background: BLUEPRINT.copperSoft, color: BLUEPRINT.copper } : { background: '#f1f5f9', color: '#64748b' }}>
      {formatDateShort(end)} · {days}d{soon ? ' ⚠' : ''}
    </span>
  )
}

const ProjectsSection = forwardRef<ProjectsSectionHandle, ProjectsSectionProps>(({
  projects, clients, timesheets, billRates = [], assignments = [], projectTerms = [],
  onAddProject, onEditProject, onDeleteProject, onAddChangeOrder, onViewProject
}, ref) => {
  const [statusFilter, setStatusFilter] = useState<string>('active')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<string>('recognized')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [collapsedClients, setCollapsedClients] = useState<Set<string>>(new Set())

  const today = todayISO()

  useImperativeHandle(ref, () => ({
    scrollToProject: (id: string) => {
      const el = document.getElementById(`project-${id}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }))

  const { rateCardLookup, assignmentLookup } = useMemo(() => buildRateLookups(billRates, assignments), [billRates, assignments])

  // Enrich: revenue engine per project (COs carry their own recognition)
  const enriched = useMemo(() => {
    const entriesByProject: Record<string, any[]> = {}
    timesheets.forEach(t => { (entriesByProject[t.project_id] = entriesByProject[t.project_id] || []).push(t) })
    const curMonth = monthKeyOf(today)
    return projects.map(p => {
      const pEntries = entriesByProject[p.id] || []
      const rev = calcProjectRevenue(p, pEntries, rateCardLookup, assignmentLookup, today)
      // Current-month NTE burn chip for projects under an active monthly-NTE phase
      let burn: { pct: number; nte: number } | null = null
      let basisLabel = rev.basisLabel
      const phases = getProjectPhases(p, projectTerms, today)
      const cur = phaseForDate(phases, today)
      if (cur?.terms === 'tm_nte' && cur.nte_amount) {
        let billed = 0
        pEntries.forEach(e => {
          const d = (e.date || '').slice(0, 10)
          if (monthKeyOf(d) !== curMonth) return
          if (d < cur.effective_start || (cur.effective_end && d > cur.effective_end)) return
          billed += entryRevenue(e, p, rateCardLookup, assignmentLookup)
        })
        burn = { pct: (billed / cur.nte_amount) * 100, nte: cur.nte_amount }
        basisLabel = `${formatCompactCurrency(cur.nte_amount)}/mo NTE`
      } else if (cur?.terms === 'lump_sum' && cur.monthly_fee) {
        basisLabel = `${formatCompactCurrency(cur.monthly_fee)} / mo`
      }
      return {
        ...p,
        contractType: rev.type,
        recognized: rev.recognized,
        thisMonth: rev.thisMonth,
        basisLabel,
        burn,
        actualHours: rev.hours,
        clientName: clients.find(c => c.id === p.client_id)?.name || 'No Client',
        changeOrders: [] as any[],
      }
    })
  }, [projects, clients, timesheets, rateCardLookup, assignmentLookup, projectTerms, today])

  // Attach COs to parents (CO revenue shown on its own indented row)
  const withCOs = useMemo(() => {
    const parents = enriched.filter(p => !p.is_change_order)
    const coByParent: Record<string, any[]> = {}
    enriched.filter(p => p.is_change_order && p.parent_id).forEach(co => { (coByParent[co.parent_id] = coByParent[co.parent_id] || []).push(co) })
    return parents.map(p => ({ ...p, changeOrders: coByParent[p.id] || [] }))
  }, [enriched])

  // Filter + sort
  const filtered = useMemo(() => {
    let result = withCOs
    if (statusFilter !== 'all') result = result.filter(p => p.status === statusFilter)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p => p.name?.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q))
    }
    const dir = sortDir === 'asc' ? 1 : -1
    const val = (p: any) => {
      if (sortField === 'name') return p.name || ''
      if (sortField === 'hours') return p.actualHours
      if (sortField === 'ends') return p.end_date || '9999-12-31'
      return p.recognized + p.changeOrders.reduce((s: number, co: any) => s + co.recognized, 0)
    }
    return [...result].sort((a, b) => { const av = val(a), bv = val(b); return (av < bv ? -1 : av > bv ? 1 : 0) * dir })
  }, [withCOs, statusFilter, searchQuery, sortField, sortDir])

  // Group by client, ordered by client total
  const byClient = useMemo(() => {
    const groups: Record<string, { id: string; name: string; rows: any[]; total: number }> = {}
    filtered.forEach(p => {
      const key = p.client_id || 'none'
      if (!groups[key]) groups[key] = { id: key, name: p.clientName, rows: [], total: 0 }
      groups[key].rows.push(p)
      groups[key].total += p.recognized + p.changeOrders.reduce((s: number, co: any) => s + co.recognized, 0)
    })
    return Object.values(groups).sort((a, b) => b.total - a.total)
  }, [filtered])

  const toggleClient = (id: string) => setCollapsedClients(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir(field === 'name' ? 'asc' : 'desc') }
  }
  const SortIcon = ({ field }: { field: string }) => sortField !== field
    ? <ArrowUpDown size={11} className="opacity-40" />
    : sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />

  const grandTotal = byClient.reduce((s, g) => s + g.total, 0)
  const statusOptions = ['active', 'prospect', 'on_hold', 'completed', 'archived', 'all']

  const Row = ({ p, isCO = false }: { p: any; isCO?: boolean }) => (
    <div id={`project-${p.id}`}
      className="group grid items-center gap-2 px-4 py-3 border-b border-slate-100 bg-white hover:bg-slate-50 transition-colors text-[13.5px]"
      style={{ gridTemplateColumns: '2.4fr 0.9fr 0.55fr 1fr 1fr 0.7fr 1.1fr 0.9fr' }}>
      <div className={`flex items-center gap-2 min-w-0 ${isCO ? 'pl-7' : ''}`}>
        {isCO && <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0" style={AR}>CO</span>}
        <button onClick={() => onViewProject?.(p.id)} className="font-semibold text-slate-900 truncate text-left hover:underline" style={{ textDecorationColor: BLUEPRINT.blue }}>
          {p.name}
        </button>
      </div>
      <div className="text-right"><StatusBadge status={p.status} /></div>
      <div className="text-right"><TypeBadge type={p.contractType} /></div>
      <div className="text-right text-[12.5px] text-slate-500 whitespace-nowrap">
        {p.basisLabel}
        {p.burn && (
          <span className="ml-1.5 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full tabular-nums align-middle"
            style={{ fontFamily: BLUEPRINT.fontDisplay, background: p.burn.pct > 100 ? '#fee2e2' : p.burn.pct >= 80 ? BLUEPRINT.copperSoft : '#f1f5f9', color: p.burn.pct > 100 ? '#dc2626' : p.burn.pct >= 80 ? BLUEPRINT.copper : '#64748b' }}
            title={`${monthLabel(monthKeyOf(todayISO()))} billed vs monthly NTE — never capped`}>
            {p.burn.pct.toFixed(0)}%
          </span>
        )}
      </div>
      <div className="text-right font-bold text-slate-900 tabular-nums" style={AR}>{formatCompactCurrency(p.recognized)}</div>
      <div className="text-right tabular-nums text-slate-600">{p.actualHours > 0 ? Math.round(p.actualHours).toLocaleString() : '—'}</div>
      <div className="text-right"><EndsChip project={p} type={p.contractType} today={today} /></div>
      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onViewProject && <button onClick={() => onViewProject(p.id)} title="View" className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500"><Eye size={14} /></button>}
        {!isCO && <button onClick={() => onAddChangeOrder(p.id, p.name)} title="Add change order" className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500"><FilePlus2 size={14} /></button>}
        <button onClick={() => onEditProject(p)} title="Edit" className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500"><Edit2 size={14} /></button>
        <button onClick={() => onDeleteProject(p.id, p.name)} title="Delete" className="p-1.5 rounded-md hover:bg-rose-100 text-slate-500 hover:text-rose-600"><Trash2 size={14} /></button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search projects or clients…"
            className="pl-9 pr-3 py-2 w-[240px] bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
        </div>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
          {statusOptions.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-md text-[12px] font-semibold capitalize transition-colors ${statusFilter === s ? 'text-white' : 'text-slate-500 hover:bg-slate-100'}`}
              style={statusFilter === s ? { background: BLUEPRINT.blue } : undefined}>
              {s === 'all' ? 'All' : (PROJECT_STATUSES[s]?.label || s)}
            </button>
          ))}
        </div>
        <button onClick={onAddProject}
          className="ml-auto flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:-translate-y-px"
          style={{ background: BLUEPRINT.blue }}>
          <Plus size={15} /> Add Project
        </button>
      </div>

      {/* TABLE */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="grid gap-2 px-4 py-2.5 text-[10px] font-bold uppercase text-slate-400 bg-slate-50 border-b border-slate-200"
          style={{ gridTemplateColumns: '2.4fr 0.9fr 0.55fr 1fr 1fr 0.7fr 1.1fr 0.9fr', letterSpacing: '0.1em', ...AR }}>
          <button onClick={() => toggleSort('name')} className="flex items-center gap-1 text-left uppercase">Client / Project <SortIcon field="name" /></button>
          <div className="text-right">Status</div>
          <div className="text-right">Type</div>
          <div className="text-right">Basis</div>
          <button onClick={() => toggleSort('recognized')} className="flex items-center justify-end gap-1 uppercase">Recognized <SortIcon field="recognized" /></button>
          <button onClick={() => toggleSort('hours')} className="flex items-center justify-end gap-1 uppercase">Hours <SortIcon field="hours" /></button>
          <button onClick={() => toggleSort('ends')} className="flex items-center justify-end gap-1 uppercase">Ends <SortIcon field="ends" /></button>
          <div />
        </div>

        {byClient.length === 0 ? (
          <div className="py-14 text-center text-slate-400 text-sm">No projects match this view</div>
        ) : byClient.map(group => (
          <div key={group.id}>
            <button onClick={() => toggleClient(group.id)}
              className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-100/70 border-b border-slate-200 hover:bg-slate-100 transition-colors">
              {collapsedClients.has(group.id) ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
              <Building2 size={13} className="text-slate-400" />
              <span className="font-bold text-[13px] text-slate-700">{group.name}</span>
              <span className="text-[11.5px] text-slate-400">· {group.rows.length} project{group.rows.length !== 1 ? 's' : ''}</span>
              <span className="ml-auto font-extrabold text-slate-900 tabular-nums text-[13.5px]" style={AR}>{formatCompactCurrency(group.total)}</span>
            </button>
            {!collapsedClients.has(group.id) && group.rows.map(p => (
              <React.Fragment key={p.id}>
                <Row p={p} />
                {p.changeOrders.map((co: any) => <Row key={co.id} p={co} isCO />)}
              </React.Fragment>
            ))}
          </div>
        ))}

        {byClient.length > 0 && (
          <div className="grid gap-2 px-4 py-3 bg-slate-50 border-t-2 border-slate-200 text-[13.5px] font-bold"
            style={{ gridTemplateColumns: '2.4fr 0.9fr 0.55fr 1fr 1fr 0.7fr 1.1fr 0.9fr' }}>
            <div>Total · {filtered.length} project{filtered.length !== 1 ? 's' : ''}</div>
            <div /><div /><div />
            <div className="text-right tabular-nums" style={AR}>{formatCompactCurrency(grandTotal)}</div>
            <div className="text-right tabular-nums text-slate-600">{Math.round(filtered.reduce((s, p) => s + p.actualHours, 0)).toLocaleString()}</div>
            <div /><div />
          </div>
        )}
      </div>
    </div>
  )
})

ProjectsSection.displayName = 'ProjectsSection'
export default ProjectsSection
