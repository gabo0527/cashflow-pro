'use client'

// ============================================================
// CLIENT DETAIL PAGE — /clients/[id]
// ============================================================
// Blueprint client workspace. Everything on this page is
// computed live from clients, projects, bill_rates,
// team_project_assignments, team_members, and time_entries.
// No invoice tables are read anywhere.
//
// Tabs:
//   Overview — KPIs (sparkline, last activity), projects ledger
//              with T&M/LS chips, burn-vs-NTE / schedule bars,
//              expandable resources with admin-only rates
//   History  — completed projects grouped by end-date year as an
//              accordion of dark bands; pick two years to compare
//              Hours / Blended rate / Invoiced total
//   Documents — placeholder for the contracts/NDA roadmap item
// ============================================================

import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Plus, Archive, Pencil, Loader2,
  AlertTriangle, X, FileText
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// ============ TYPES ============
interface Client { id: string; name: string; contact_name?: string; email?: string; phone?: string; payment_terms: string; status: string; created_at?: string; notes?: string }
interface Project { id: string; name: string; client_id?: string; status: string; billing_model?: string; budget?: number; budget_type?: string; fixed_amount?: number; bill_rate?: number; start_date?: string; end_date?: string; spent?: number }
interface BillRate { id: string; team_member_id: string; client_id: string; rate: number; is_active: boolean; revenue_type?: string; revenue_amount?: number }
interface Assignment { team_member_id: string; project_id: string }
interface Member { id: string; name: string; role?: string }
interface TimeEntry { id: string; team_member_id: string; project_id?: string; client_id?: string; date: string; hours: number; billable_hours?: number | null; status: string }

// ============ HELPERS ============
const fmt$ = (v: number) => '$' + Math.round(v).toLocaleString('en-US')
const fmtH = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 1 })
const isTM = (p: Project) => (p.billing_model || 'per_resource') === 'per_resource'

// Deterministic identity color per client (stable across pages)
const IDENTITY = ['#4f46e5', '#0e7490', '#b45309', '#166534', '#9d174d', '#1d4ed8', '#7c2d12', '#0f766e']
const clientColor = (id: string) => {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return IDENTITY[h % IDENTITY.length]
}

const localToday = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` }
const monthStart = () => localToday().slice(0, 8) + '01'

const daysAgo = (dateStr?: string | null) => {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  return diff
}

// Count-up hook for KPI numerals
function useCountUp(target: number, duration = 700) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setVal(target * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}

export default function ClientDetailPage() {
  const params = useParams()
  const router = useRouter()
  const clientId = String(params?.id || '')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [rates, setRates] = useState<BillRate[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [entries, setEntries] = useState<TimeEntry[]>([])

  const [tab, setTab] = useState<'overview' | 'history'>('overview')
  const [typeFilter, setTypeFilter] = useState<'all' | 'tm' | 'ls'>('all')
  const [openProject, setOpenProject] = useState<string | null>(null)
  const [openYears, setOpenYears] = useState<Set<number>>(new Set())
  const [compareYears, setCompareYears] = useState<number[]>([])
  const [archiving, setArchiving] = useState(false)

  // ============ LOAD ============
  useEffect(() => {
    if (!clientId) return
    const load = async () => {
      try {
        const [{ data: c }, { data: p }, { data: r }, { data: m }] = await Promise.all([
          supabase.from('clients').select('*').eq('id', clientId).single(),
          supabase.from('projects').select('*').eq('client_id', clientId),
          supabase.from('bill_rates').select('*').eq('client_id', clientId).eq('is_active', true),
          supabase.from('team_members').select('id, name, role'),
        ])
        if (!c) { setError('Client not found'); setLoading(false); return }
        setClient(c)
        setProjects(p || [])
        setRates(r || [])
        setMembers(m || [])

        const projectIds = (p || []).map((x: Project) => x.id)
        if (projectIds.length > 0) {
          const [{ data: a }, { data: te }] = await Promise.all([
            supabase.from('team_project_assignments').select('team_member_id, project_id').in('project_id', projectIds),
            supabase.from('time_entries').select('id, team_member_id, project_id, client_id, date, hours, billable_hours, status')
              .in('project_id', projectIds).neq('status', 'draft'),
          ])
          setAssignments(a || [])
          setEntries(te || [])
        }
      } catch (err: any) {
        console.error('client detail load error:', err)
        setError('Failed to load client')
      } finally { setLoading(false) }
    }
    load()
  }, [clientId])

  // ============ DERIVED ============
  const accent = useMemo(() => clientColor(clientId), [clientId])
  const memberName = (id: string) => members.find(m => m.id === id)?.name || 'Unknown'
  const memberRole = (id: string) => members.find(m => m.id === id)?.role || ''
  const rateFor = (memberId: string) => rates.find(r => r.team_member_id === memberId)?.rate || 0

  const activeProjects = useMemo(() => projects.filter(p => p.status === 'active'), [projects])
  const completedProjects = useMemo(() => projects.filter(p => p.status === 'completed'), [projects])

  const ms = monthStart()
  const hoursMTDByProject = useMemo(() => {
    const map: Record<string, number> = {}
    entries.forEach(e => { if (e.date >= ms && e.project_id) map[e.project_id] = (map[e.project_id] || 0) + (e.hours || 0) })
    return map
  }, [entries, ms])
  const hoursMTD = useMemo(() => Object.values(hoursMTDByProject).reduce((s, v) => s + v, 0), [hoursMTDByProject])

  const resourceIds = useMemo(() => {
    const activeIds = new Set(activeProjects.map(p => p.id))
    return Array.from(new Set(assignments.filter(a => activeIds.has(a.project_id)).map(a => a.team_member_id)))
  }, [assignments, activeProjects])

  const lastEntry = useMemo(() => {
    let best: TimeEntry | null = null
    entries.forEach(e => { if (!best || e.date > best.date) best = e })
    return best as TimeEntry | null
  }, [entries])
  const lastDays = daysAgo(lastEntry?.date || null)

  // 8-week sparkline (hours per ISO-ish week bucket, local dates)
  const spark = useMemo(() => {
    const buckets: number[] = new Array(8).fill(0)
    const now = new Date()
    entries.forEach(e => {
      const d = new Date(e.date + 'T00:00:00')
      const weeksBack = Math.floor((now.getTime() - d.getTime()) / (7 * 86400000))
      if (weeksBack >= 0 && weeksBack < 8) buckets[7 - weeksBack] += e.hours || 0
    })
    const max = Math.max(...buckets, 1)
    return buckets.map(b => Math.round((b / max) * 100))
  }, [entries])

  // Project revenue basis: T&M = Σ member hours × member's client rate; LS = fixed_amount || budget
  const projectHoursAll = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    entries.forEach(e => {
      if (!e.project_id) return
      if (!map[e.project_id]) map[e.project_id] = {}
      const h = (e.billable_hours ?? e.hours) || 0
      map[e.project_id][e.team_member_id] = (map[e.project_id][e.team_member_id] || 0) + h
    })
    return map
  }, [entries])

  const projectRevenue = (p: Project) => {
    if (!isTM(p)) return p.fixed_amount || p.budget || 0
    const byMember = projectHoursAll[p.id] || {}
    return Object.entries(byMember).reduce((s, [mid, h]) => s + h * rateFor(mid), 0)
  }
  const projectHours = (p: Project) => Object.values(projectHoursAll[p.id] || {}).reduce((s, h) => s + h, 0)
  const projectBurn = (p: Project) => {
    const cap = p.budget || 0
    if (!cap) return null
    const spent = projectRevenue(p)
    return { spent, cap, pct: Math.min(100, Math.round((spent / cap) * 100)) }
  }
  const schedulePct = (p: Project) => {
    if (!p.start_date || !p.end_date) return null
    const s = new Date(p.start_date).getTime(), e = new Date(p.end_date).getTime(), now = Date.now()
    if (e <= s) return null
    return Math.max(0, Math.min(100, Math.round(((now - s) / (e - s)) * 100)))
  }

  // History: completed projects by end_date year
  const years = useMemo(() => {
    const map: Record<number, Project[]> = {}
    completedProjects.forEach(p => {
      const y = p.end_date ? Number(p.end_date.slice(0, 4)) : new Date().getFullYear()
      if (!map[y]) map[y] = []
      map[y].push(p)
    })
    return Object.entries(map)
      .map(([y, ps]) => {
        const tm = ps.filter(isTM).reduce((s, p) => s + projectRevenue(p), 0)
        const ls = ps.filter(p => !isTM(p)).reduce((s, p) => s + projectRevenue(p), 0)
        const hours = ps.reduce((s, p) => s + projectHours(p), 0)
        return { year: Number(y), projects: ps, tm, ls, total: tm + ls, hours }
      })
      .sort((a, b) => b.year - a.year)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedProjects, projectHoursAll, rates])

  useEffect(() => { if (years.length > 0 && openYears.size === 0) setOpenYears(new Set([years[0].year])) }, [years]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredProjects = activeProjects.filter(p => typeFilter === 'all' ? true : typeFilter === 'tm' ? isTM(p) : !isTM(p))
  const tmCount = activeProjects.filter(isTM).length
  const lsCount = activeProjects.length - tmCount
  const maxMTD = Math.max(...activeProjects.map(p => hoursMTDByProject[p.id] || 0), 1)

  const toggleCompare = (year: number) => {
    setCompareYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev.slice(-1), year])
  }
  const cmp = useMemo(() => {
    if (compareYears.length !== 2) return null
    const [b, a] = [...compareYears].sort((x, y) => x - y)
    const A = years.find(y => y.year === Math.max(...compareYears))
    const B = years.find(y => y.year === Math.min(...compareYears))
    if (!A || !B) return null
    const blended = (y: typeof A) => (y.hours > 0 ? y.total / y.hours : 0)
    const delta = (x: number, y: number) => (y > 0 ? Math.round(((x - y) / y) * 100) : null)
    return {
      A, B,
      rows: [
        { label: 'Hours', a: fmtH(A.hours), b: fmtH(B.hours), d: delta(A.hours, B.hours) },
        { label: 'Blended rate', a: `$${Math.round(blended(A))}/h`, b: `$${Math.round(blended(B))}/h`, d: delta(blended(A), blended(B)) },
        { label: 'Invoiced total', a: fmt$(A.total), b: fmt$(B.total), d: delta(A.total, B.total) },
      ],
    }
  }, [compareYears, years])

  const archiveClient = async () => {
    if (!client || archiving) return
    if (!confirm(`Archive ${client.name}? It moves out of the active list; all data is kept.`)) return
    setArchiving(true)
    const { error: e } = await supabase.from('clients').update({ status: 'archived' }).eq('id', client.id)
    if (e) setError('Failed to archive client')
    else router.push('/clients')
    setArchiving(false)
  }

  // Count-ups
  const cActive = useCountUp(activeProjects.length)
  const cRes = useCountUp(resourceIds.length)
  const cHours = useCountUp(hoursMTD)

  // ============ RENDER ============
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#eef1f4]"><Loader2 size={22} className="animate-spin text-slate-300" /></div>
  }
  if (error || !client) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#eef1f4]">
        <p className="text-[13px] text-slate-500">{error || 'Client not found'}</p>
        <Link href="/clients" className="text-[12.5px] font-semibold text-blue-600">Back to Clients</Link>
      </div>
    )
  }

  const soft = accent + '14'

  return (
    <div className="min-h-screen bg-[#eef1f4] p-6" style={{ backgroundImage: 'linear-gradient(rgba(15,23,42,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.022) 1px, transparent 1px)', backgroundSize: '26px 26px' }}>
      <div className="max-w-[1080px] mx-auto flex flex-col gap-3.5">

        {/* ============ HERO ============ */}
        <div className="rounded-2xl relative overflow-hidden p-6" style={{ background: 'linear-gradient(135deg,#1b2431,#10151c)', animation: 'vfadeup .5s cubic-bezier(.22,1,.36,1) both' }}>
          <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 13px)' }} />
          <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: accent }} />
          <div className="relative z-10">
            <Link href="/clients" className="text-[11px] text-slate-400 hover:text-slate-200 inline-flex items-center gap-1 mb-2.5">
              <ChevronLeft size={12} /> Clients
            </Link>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-extrabold text-lg" style={{ background: accent, fontFamily: 'Archivo, sans-serif' }}>
                  {client.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h1 className="text-white text-2xl font-extrabold uppercase tracking-wide" style={{ fontFamily: 'Archivo, sans-serif' }}>{client.name}</h1>
                  <div className="text-[11.5px] text-slate-400 mt-0.5">
                    {client.payment_terms || '—'}
                    {client.created_at ? ` · client since ${new Date(client.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ''}
                    {lastDays !== null ? ` · last activity ${lastDays === 0 ? 'today' : `${lastDays}d ago`}` : ''}
                    <span className="ml-2 inline-flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-[0.09em] px-2 py-0.5 rounded border align-middle" style={{ fontFamily: 'Archivo, sans-serif', color: client.status === 'active' ? '#34d399' : '#94a3b8', background: client.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(148,163,184,0.12)', borderColor: client.status === 'active' ? 'rgba(52,211,153,0.35)' : 'rgba(148,163,184,0.3)' }}>
                      {client.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Link href="/clients" className="px-3.5 py-2 rounded-[10px] text-[12px] font-semibold text-slate-300 border border-white/10 bg-white/5 inline-flex items-center gap-1.5"><Pencil size={12} /> Edit</Link>
                <button onClick={archiveClient} disabled={archiving} className="px-3.5 py-2 rounded-[10px] text-[12px] font-semibold text-slate-300 border border-white/10 bg-white/5 inline-flex items-center gap-1.5 disabled:opacity-50"><Archive size={12} /> Archive</button>
                <Link href="/projects" className="px-4 py-2 rounded-[10px] text-[12px] font-semibold text-white inline-flex items-center gap-1.5" style={{ background: accent }}><Plus size={13} /> New project</Link>
              </div>
            </div>
          </div>
        </div>

        {/* ============ TABS ============ */}
        <div className="flex gap-1 bg-white border border-slate-200/60 rounded-xl p-1 w-fit">
          {([['overview', 'Overview'], ['history', 'History']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className="px-4 py-2 rounded-[9px] text-[12.5px] font-semibold transition-colors"
              style={tab === id ? { background: soft, color: accent } : { color: '#64748b' }}>
              {label}
            </button>
          ))}
          <span className="px-4 py-2 text-[12.5px] font-semibold text-slate-300 inline-flex items-center gap-1.5"><FileText size={12} /> Documents · soon</span>
        </div>

        {tab === 'overview' && (
          <>
            {/* ============ KPIs ============ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white border border-slate-200/60 rounded-xl p-4 shadow-sm">
                <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">Active projects</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums" style={{ fontFamily: 'Archivo, sans-serif' }}>{Math.round(cActive)}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{tmCount} T&M · {lsCount} Lump Sum</div>
              </div>
              <div className="bg-white border border-slate-200/60 rounded-xl p-4 shadow-sm">
                <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">Resources on client</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums" style={{ fontFamily: 'Archivo, sans-serif' }}>{Math.round(cRes)}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">{resourceIds.slice(0, 3).map(id => memberName(id).split(' ')[0]).join(' · ') || '—'}</div>
              </div>
              <div className="bg-white border border-slate-200/60 rounded-xl p-4 shadow-sm">
                <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">Hours this month</div>
                <div className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums" style={{ fontFamily: 'Archivo, sans-serif' }}>{fmtH(cHours)}</div>
                <div className="flex items-end gap-[2px] h-5 mt-1.5">
                  {spark.map((h, i) => (
                    <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${Math.max(8, h)}%`, background: i === spark.length - 1 ? accent : soft }} />
                  ))}
                </div>
              </div>
              <div className="bg-white border border-slate-200/60 rounded-xl p-4 shadow-sm">
                <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-400">Last activity</div>
                <div className="text-xl font-extrabold text-slate-900 mt-1" style={{ fontFamily: 'Archivo, sans-serif' }}>{lastDays === null ? '—' : lastDays === 0 ? 'Today' : `${lastDays}d ago`}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">{lastEntry ? `${memberName(lastEntry.team_member_id).split(' ')[0]} · ${lastEntry.date}` : 'no time logged yet'}</div>
              </div>
            </div>

            {/* ============ PROJECTS LEDGER ============ */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Projects — {activeProjects.length} active</span>
              <div className="flex gap-1.5">
                {([['all', `All · ${activeProjects.length}`, '#2563eb'], ['tm', `T&M · ${tmCount}`, '#c2660c'], ['ls', `LS · ${lsCount}`, '#0369a1']] as const).map(([id, label, color]) => (
                  <button key={id} onClick={() => setTypeFilter(id)} className="text-[9.5px] font-semibold px-2 py-1 rounded-md border tabular-nums transition-all"
                    style={typeFilter === id ? { color: '#fff', background: color, borderColor: color } : { color, background: `${color}0d`, borderColor: `${color}40` }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm overflow-hidden">
              {filteredProjects.length === 0 ? (
                <div className="p-8 text-center text-[12px] text-slate-400">No active projects{typeFilter !== 'all' ? ' of this type' : ''}.</div>
              ) : filteredProjects.map(p => {
                const burn = isTM(p) ? projectBurn(p) : null
                const sched = !isTM(p) ? schedulePct(p) : null
                const mtd = hoursMTDByProject[p.id] || 0
                const projMembers = assignments.filter(a => a.project_id === p.id).map(a => a.team_member_id)
                const open = openProject === p.id
                const nteHot = burn && burn.pct >= 80
                return (
                  <div key={p.id} className="border-t first:border-t-0 border-slate-100">
                    <button onClick={() => setOpenProject(open ? null : p.id)} className="w-full text-left px-5 py-3.5 grid grid-cols-1 md:grid-cols-[1fr_130px_190px_28px] gap-3 items-center hover:bg-slate-50/60 transition-colors"
                      style={{ borderLeft: `3px solid ${open ? accent : 'transparent'}` }}>
                      <div>
                        <div className="text-[13px] font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                          {p.name}
                          <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded border" style={isTM(p) ? { color: '#c2660c', background: 'rgba(234,138,47,0.07)', borderColor: '#f6d3b3' } : { color: '#0369a1', background: 'rgba(14,165,233,0.06)', borderColor: '#bae6fd' }}>
                            {isTM(p) ? 'T&M' : 'Lump Sum'}
                          </span>
                          {nteHot && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5"><AlertTriangle size={9} /> NTE {burn!.pct}%</span>}
                        </div>
                        <div className="text-[10.5px] text-slate-400 mt-0.5">
                          {p.start_date ? new Date(p.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                          {p.end_date ? ` — ${new Date(p.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ' — ongoing'}
                          {projMembers.length > 0 ? ` · ${projMembers.slice(0, 3).map(id => memberName(id).split(' ')[0]).join(' · ')}` : ''}
                        </div>
                      </div>
                      <div>
                        <div className="text-[8.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">Hours MTD</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-bold text-slate-900 tabular-nums text-[13px]" style={{ fontFamily: 'Archivo, sans-serif' }}>{fmtH(mtd)}</span>
                          <div className="w-[52px] h-[5px] bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.round((mtd / maxMTD) * 100)}%`, background: accent }} /></div>
                        </div>
                      </div>
                      <div>
                        {burn ? (
                          <>
                            <div className="text-[8.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">Burn vs NTE · {burn.pct}%</div>
                            <div className="h-[5px] bg-slate-100 rounded-full overflow-hidden mt-1"><div className="h-full rounded-full" style={{ width: `${burn.pct}%`, background: nteHot ? '#ea8a2f' : accent }} /></div>
                            <div className="text-[10px] text-slate-400 mt-0.5 tabular-nums">{fmt$(burn.spent)} / {fmt$(burn.cap)}</div>
                          </>
                        ) : sched !== null ? (
                          <>
                            <div className="text-[8.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">Schedule · {sched}% elapsed</div>
                            <div className="h-[5px] bg-slate-100 rounded-full overflow-hidden mt-1"><div className="h-full rounded-full" style={{ width: `${sched}%`, background: accent }} /></div>
                            <div className="text-[10px] text-slate-400 mt-0.5 tabular-nums">{!isTM(p) ? `contract ${fmt$(p.fixed_amount || p.budget || 0)}` : ''}</div>
                          </>
                        ) : (
                          <div className="text-[10px] text-slate-300">{!isTM(p) ? `contract ${fmt$(p.fixed_amount || p.budget || 0)}` : 'no cap set'}</div>
                        )}
                      </div>
                      <ChevronRight size={15} className="text-slate-300 transition-transform justify-self-end" style={open ? { transform: 'rotate(90deg)', color: accent } : undefined} />
                    </button>
                    {open && (
                      <div className="px-5 pb-4 pt-1 bg-slate-50/50 border-t border-dashed border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                          <div className="text-[8.5px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-1 flex items-center gap-2">
                            Resources · rates from rate cards
                            <span className="text-[8px] font-bold uppercase tracking-[0.07em] px-1.5 py-0.5 rounded border" style={{ color: '#c2660c', background: 'rgba(234,138,47,0.06)', borderColor: '#f6d3b3' }}>Admin only</span>
                          </div>
                          {projMembers.length === 0 ? <p className="text-[11px] text-slate-400 py-2">No resources assigned.</p> : projMembers.map(mid => (
                            <div key={mid} className="flex items-center justify-between gap-3 py-1.5 border-b last:border-b-0 border-slate-100 text-[11.5px] text-slate-600">
                              <span>{memberName(mid)} <span className="text-[10px] text-slate-400">· {memberRole(mid) || 'Resource'}{projectHoursAll[p.id]?.[mid] ? ` · ${fmtH(projectHoursAll[p.id][mid])} h` : ''}</span></span>
                              <span className="font-bold text-slate-900 tabular-nums" style={{ fontFamily: 'Archivo, sans-serif' }}>{rateFor(mid) > 0 ? `$${rateFor(mid)}/h` : '—'}</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <div className="text-[8.5px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-1">Project basis</div>
                          <div className="flex items-center justify-between py-1.5 border-b border-slate-100 text-[11.5px] text-slate-600"><span>Hours to date (billable basis)</span><span className="font-bold text-slate-900 tabular-nums" style={{ fontFamily: 'Archivo, sans-serif' }}>{fmtH(projectHours(p))} h</span></div>
                          <div className="flex items-center justify-between py-1.5 text-[11.5px] text-slate-600"><span>{isTM(p) ? 'Revenue basis (hours × rates)' : 'Contract amount'}</span><span className="font-bold text-slate-900 tabular-nums" style={{ fontFamily: 'Archivo, sans-serif' }}>{fmt$(projectRevenue(p))}</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {tab === 'history' && (
          <>
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Completed projects by year</span>
              <span className="text-[10px] text-slate-400">{compareYears.length === 2 ? 'comparing 2 years' : 'tap Compare on two years'}</span>
            </div>

            {years.length === 0 ? (
              <div className="bg-white border border-slate-200/60 rounded-xl p-8 text-center text-[12px] text-slate-400">
                No completed projects yet. When a project is marked completed with an end date, it files here under its year.
              </div>
            ) : years.map(y => {
              const open = openYears.has(y.year)
              const selected = compareYears.includes(y.year)
              return (
                <div key={y.year} className="bg-white border border-slate-200/60 rounded-xl shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between gap-3 px-5 py-3 cursor-pointer relative overflow-hidden flex-wrap" style={{ background: 'linear-gradient(135deg,#1b2431,#10151c)' }}
                    onClick={() => setOpenYears(prev => { const next = new Set(prev); next.has(y.year) ? next.delete(y.year) : next.add(y.year); return next })}>
                    <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 13px)' }} />
                    <div className="relative flex items-center gap-2.5">
                      <ChevronRight size={14} className="text-slate-400 transition-transform" style={open ? { transform: 'rotate(90deg)', color: '#fff' } : undefined} />
                      <span className="text-white font-extrabold text-base" style={{ fontFamily: 'Archivo, sans-serif' }}>{y.year}</span>
                      <button onClick={e => { e.stopPropagation(); toggleCompare(y.year) }}
                        className="text-[8.5px] font-bold uppercase tracking-[0.08em] px-1.5 py-0.5 rounded border"
                        style={selected ? { color: '#10151c', background: '#f6b57a', borderColor: '#f6b57a' } : { color: '#93c5fd', background: 'rgba(59,130,246,0.12)', borderColor: 'rgba(147,197,253,0.35)' }}>
                        {selected ? `${compareYears.indexOf(y.year) === 0 ? 'A' : 'B'} · comparing` : 'Compare'}
                      </button>
                    </div>
                    <div className="relative flex gap-4 text-[10.5px] text-slate-400 flex-wrap">
                      {y.tm > 0 && <span>T&M <b className="text-[#f6b57a] tabular-nums" style={{ fontFamily: 'Archivo, sans-serif' }}>{fmt$(y.tm)}</b></span>}
                      {y.ls > 0 && <span>LS <b className="text-white tabular-nums" style={{ fontFamily: 'Archivo, sans-serif' }}>{fmt$(y.ls)}</b></span>}
                      <span>Total <b className="text-white tabular-nums" style={{ fontFamily: 'Archivo, sans-serif' }}>{fmt$(y.total)}</b></span>
                      <span>Hours <b className="text-white tabular-nums" style={{ fontFamily: 'Archivo, sans-serif' }}>{fmtH(y.hours)}</b></span>
                    </div>
                  </div>
                  {open && y.projects.map(p => (
                    <div key={p.id} className="grid grid-cols-[1fr_80px_110px] gap-3 px-5 py-2.5 border-t border-slate-100 text-[12px] text-slate-600 items-center">
                      <span>{p.name} <span className="text-[10px] text-slate-400">· {isTM(p) ? 'T&M' : 'Lump Sum'}{p.start_date ? ` · ${new Date(p.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}` : ''}{p.end_date ? `–${new Date(p.end_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' })}` : ''}</span></span>
                      <span className="text-right text-[10.5px] text-slate-400 tabular-nums">{isTM(p) ? `${fmtH(projectHours(p))} h` : '—'}</span>
                      <span className="text-right font-bold text-slate-900 tabular-nums" style={{ fontFamily: 'Archivo, sans-serif' }}>{fmt$(projectRevenue(p))}</span>
                    </div>
                  ))}
                </div>
              )
            })}

            {cmp && (
              <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(15,23,42,0.022) 0 1px, transparent 1px 12px)' }}>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Comparing {cmp.A.year} vs {cmp.B.year}</span>
                  <button onClick={() => setCompareYears([])} className="text-[10px] font-semibold text-slate-400 border border-slate-200 rounded-md px-2 py-1 inline-flex items-center gap-1"><X size={10} /> Clear</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3">
                  {cmp.rows.map((r, i) => (
                    <div key={r.label} className={`px-5 py-3.5 ${i > 0 ? 'sm:border-l border-t sm:border-t-0 border-slate-100' : ''}`}>
                      <div className="text-[9px] font-semibold uppercase tracking-[0.09em] text-slate-400">{r.label}</div>
                      <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                        <span className="font-extrabold text-slate-900 text-[16px] tabular-nums" style={{ fontFamily: 'Archivo, sans-serif' }}>{r.a}</span>
                        <span className="font-bold text-slate-400 text-[12px] tabular-nums" style={{ fontFamily: 'Archivo, sans-serif' }}>vs {r.b}</span>
                        {r.d !== null && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums ${r.d >= 0 ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`}>{r.d >= 0 ? '+' : ''}{r.d}%</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-2.5 border-t border-dashed border-slate-200 bg-slate-50/60 text-[10px] text-slate-400 leading-relaxed">
                  Blended rate = invoiced total ÷ logged hours across all contract types. A falling blended rate flags margin pressure even when revenue grows.
                </div>
              </div>
            )}
          </>
        )}

      </div>
      <style jsx global>{`@keyframes vfadeup { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </div>
  )
}
