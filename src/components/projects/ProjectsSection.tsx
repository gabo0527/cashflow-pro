'use client'

// PROJECTS LIST — Blueprint rebuild (revenue-only)
// Row layout: Project | Status | Type | Basis | Recognized | Hours | Ends
// Removed: Spent, Margin, Burn, effective rate — cost layers in later, admin-only.

import React, { useMemo, useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import {
  Building2, ChevronDown, ChevronRight, Search, Plus, ArrowUpDown,
  ArrowUp, ArrowDown, Trash2, Edit2, FilePlus2, Eye,
} from 'lucide-react'
import {
  BLUEPRINT, PROJECT_STATUSES, getContractType,
  formatCompactCurrency, formatDateShort, StatusBadge,
  calcProjectRevenue, buildRateLookups, todayISO, daysUntil,
  getProjectPhases, phaseForDate, entryRevenue, calcNteBurn, monthKeyOf, monthLabel,
} from './shared'

import { MultiSelect } from '@/components/commercial/CommercialDocuments'

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
    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md" style={{ ...AR, background: ls ? BLUEPRINT.blueSoft : BLUEPRINT.copperSoft, color: ls ? BLUEPRINT.blue : BLUEPRINT.copper }}>
      {ls ? 'Monthly fee' : 'T&M'}
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
  if (days < 0) return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Ended {formatDateShort(end)}</span>
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
  const [statuses,setStatuses] = useState<string[]>(['active'])
  const [selectedClients,setSelectedClients] = useState<string[]>([])
  const [selectedProjects,setSelectedProjects] = useState<string[]>([])
  const [models,setModels] = useState<string[]>(['time_and_materials','lump_sum'])
  const [groupLevels,setGroupLevels] = useState<string[]>(['client'])
  useEffect(()=>setSelectedClients([...clients.map(c=>c.id),'none']),[clients])
  useEffect(()=>setSelectedProjects(projects.filter(p=>!p.is_change_order).map(p=>p.id)),[projects])
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
      const rev = calcProjectRevenue(p, pEntries, rateCardLookup, assignmentLookup, today, projectTerms)
      // Current-month Budget burn chip for projects under an active monthly-Budget phase
      let burn: { pct: number; nte: number } | null = null
      let basisLabel = rev.basisLabel
      const phases = getProjectPhases(p, projectTerms, today)
      const cur = phaseForDate(phases, today)
      if (cur?.terms === 'tm_nte' && cur.nte_amount) {
        const usage = calcNteBurn(cur, p, pEntries, rateCardLookup, assignmentLookup, `${curMonth}-01`, today)
        burn = { pct: usage.pct || 0, nte: cur.nte_amount }
        basisLabel = cur.budget_cadence === 'overall' ? `${formatCompactCurrency(cur.nte_amount)} overall budget` : `${formatCompactCurrency(cur.nte_amount)}/mo Budget`
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
        budget_cadence: cur?.budget_cadence,
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
    result = result.filter(p=>statuses.includes(p.status)&&selectedClients.includes(p.client_id||'none')&&selectedProjects.includes(p.id)&&models.includes(p.contractType))
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
  }, [withCOs, statuses, selectedClients, selectedProjects, models, searchQuery, sortField, sortDir])

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
      style={{ minWidth:1000, gridTemplateColumns: 'minmax(190px,2.4fr) 95px 90px minmax(150px,1.3fr) 105px 65px 135px 110px' }}>
      <div className={`flex items-center gap-2 min-w-0 ${isCO ? 'pl-7' : ''}`}>
        {isCO && <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0" style={AR}>CO</span>}
        <button onClick={() => onViewProject?.(p.id)} className="font-semibold text-slate-900 truncate text-left hover:underline" style={{ textDecorationColor: BLUEPRINT.blue }}>
          {p.name}
        </button>
      </div>
      <div className="text-right"><StatusBadge status={p.status} /></div>
      <div className="text-right"><TypeBadge type={p.contractType} /></div>
      <div className="text-right text-[12.5px] text-slate-500">
        {p.basisLabel}
        {p.burn && (
          <span className="ml-1.5 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full tabular-nums align-middle"
            style={{ fontFamily: BLUEPRINT.fontDisplay, background: p.burn.pct > 100 ? '#fee2e2' : p.burn.pct >= 80 ? BLUEPRINT.copperSoft : '#f1f5f9', color: p.burn.pct > 100 ? '#dc2626' : p.burn.pct >= 80 ? BLUEPRINT.copper : '#64748b' }}
            title={`${p.budget_cadence==='overall'?'Cumulative usage':'Current-month usage'}: ${p.burn.pct.toFixed(1)}% of budget`}>
            {p.burn.pct.toFixed(0)}%
          </span>
        )}
      </div>
      <div className="text-right font-bold text-slate-900 tabular-nums" style={AR}>{formatCompactCurrency(p.recognized)}</div>
      <div className="text-right tabular-nums text-slate-600">{p.actualHours > 0 ? Math.round(p.actualHours).toLocaleString() : '—'}</div>
      <div className="text-right"><EndsChip project={p} type={p.contractType} today={today} /></div>
      <div className="flex items-center justify-end gap-1 opacity-100 transition-opacity">
        {onViewProject && <button onClick={() => onViewProject(p.id)} title="View" className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500"><Eye size={14} /></button>}
        {!isCO && <button onClick={() => onAddChangeOrder(p.id, p.name)} title="Add change order" className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500"><FilePlus2 size={14} /></button>}
        <button onClick={() => onEditProject(p)} title="Edit" className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500"><Edit2 size={14} /></button>
        <button onClick={() => onDeleteProject(p.id, p.name)} title="Delete" className="p-1.5 rounded-md hover:bg-rose-100 text-slate-500 hover:text-rose-600"><Trash2 size={14} /></button>
      </div>
    </div>
  )

  function renderGroups(rows:any[],level=0,path=''):React.ReactNode {
    if(level===groupLevels.length) return rows.map(p=><React.Fragment key={p.id}><Row p={p}/>{p.changeOrders.map((co:any)=><Row key={co.id} p={co} isCO/>)}</React.Fragment>)
    const grouping=groupLevels[level], groups=new Map<string,any[]>()
    rows.forEach(p=>{const label=grouping==='client'?p.clientName:grouping==='model'?p.contractType==='lump_sum'?'Monthly fee':'T&M':PROJECT_STATUSES[p.status]?.label||p.status;groups.set(label,[...(groups.get(label)||[]),p])})
    return Array.from(groups).map(([label,items])=>{const key=path+'/'+grouping+':'+label;return <section key={key}><button onClick={()=>toggleClient(key)} aria-expanded={!collapsedClients.has(key)} className="commercial-group" style={{paddingLeft:16+level*14}}>{collapsedClients.has(key)?<ChevronRight size={14}/>:<ChevronDown size={14}/>}<strong>{label}</strong><span>{items.length} projects</span><b className="ml-auto tabular-nums">{formatCompactCurrency(items.reduce((total,p)=>total+p.recognized+p.changeOrders.reduce((sum:number,co:any)=>sum+co.recognized,0),0))}</b></button>{!collapsedClients.has(key)&&renderGroups(items,level+1,key)}</section>})
  }

  return (
    <div className="space-y-4">
      {/* TOOLBAR */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search projects or clients…"
            className="pl-9 pr-3 py-2 w-[240px] bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
        </div>
        <MultiSelect label="Status" choices={Object.entries(PROJECT_STATUSES).map(([id,status])=>({id,label:status.label}))} selected={statuses} onChange={setStatuses}/>
        <MultiSelect label="Clients" choices={[...clients.map(c=>({id:c.id,label:c.name})),{id:'none',label:'No client'}]} selected={selectedClients} onChange={setSelectedClients}/>
        <MultiSelect label="Projects" choices={projects.filter(p=>!p.is_change_order).map(p=>({id:p.id,label:p.name}))} selected={selectedProjects} onChange={setSelectedProjects}/>
        <MultiSelect label="Billing model" choices={[{id:'time_and_materials',label:'T&M'},{id:'lump_sum',label:'Monthly fee'}]} selected={models} onChange={setModels}/>
        <button onClick={onAddProject}
          className="ml-auto flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:-translate-y-px"
          style={{ background: BLUEPRINT.blue }}>
          <Plus size={15} /> Add Project
        </button>
      </div>

      <div className="commercial-grouping"><span>Group by</span>{groupLevels.map((level,index)=><span className="commercial-group-chip" key={level}>{level==='client'?'Client':level==='model'?'Billing model':'Status'}<button disabled={index===0} aria-label={`Move ${level} earlier`} onClick={()=>setGroupLevels(old=>{const next=[...old];[next[index-1],next[index]]=[next[index],next[index-1]];return next})}><ArrowUp size={12}/></button><button disabled={index===groupLevels.length-1} aria-label={`Move ${level} later`} onClick={()=>setGroupLevels(old=>{const next=[...old];[next[index+1],next[index]]=[next[index],next[index+1]];return next})}><ArrowDown size={12}/></button></span>)}<MultiSelect label="Choose levels" choices={[{id:'client',label:'Client'},{id:'status',label:'Status'},{id:'model',label:'Billing model'}]} selected={groupLevels} onChange={setGroupLevels}/><span className="text-xs text-slate-500">{filtered.length} selected projects · change orders included</span></div>
      {/* TABLE */}
      <div className="projects-commercial-table bg-white border border-slate-200 rounded-2xl overflow-x-auto">
        <div className="grid gap-2 px-4 py-2.5 text-[10px] font-bold uppercase text-slate-400 bg-slate-50 border-b border-slate-200"
          style={{ minWidth:1000, gridTemplateColumns: 'minmax(190px,2.4fr) 95px 90px minmax(150px,1.3fr) 105px 65px 135px 110px', letterSpacing: '0.1em', ...AR }}>
          <button onClick={() => toggleSort('name')} className="flex items-center gap-1 text-left uppercase">Client / Project <SortIcon field="name" /></button>
          <div className="text-right">Status</div>
          <div className="text-right">Type</div>
          <div className="text-right">Basis</div>
          <button onClick={() => toggleSort('recognized')} className="flex items-center justify-end gap-1 uppercase">Recognized <SortIcon field="recognized" /></button>
          <button onClick={() => toggleSort('hours')} className="flex items-center justify-end gap-1 uppercase">Hours <SortIcon field="hours" /></button>
          <button onClick={() => toggleSort('ends')} className="flex items-center justify-end gap-1 uppercase">Ends <SortIcon field="ends" /></button>
          <div />
        </div>

        {filtered.length === 0 ? <div className="py-14 text-center text-slate-400 text-sm">No projects match this view</div> : renderGroups(filtered)}

        {byClient.length > 0 && (
          <div className="grid gap-2 px-4 py-3 bg-slate-50 border-t-2 border-slate-200 text-[13.5px] font-bold"
            style={{ minWidth:1000, gridTemplateColumns: 'minmax(190px,2.4fr) 95px 90px minmax(150px,1.3fr) 105px 65px 135px 110px' }}>
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
