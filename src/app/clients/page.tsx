'use client'

// ============================================================
// CLIENTS — portfolio list (Blueprint rebuild)
// ============================================================
// Every number on this page is computed live from clients,
// projects, team_project_assignments, team_members, and
// time_entries. No invoice or transaction tables are read.
//
// Features: live KPIs with count-ups · identity-colored rows ·
// contract-mix chips · hours micro-bars · last-activity signal ·
// sortable columns · "/" jumps to search · row actions
// (Edit / Archive / Delete) · passive archive suggestion for
// active clients with zero active projects · archived clients
// in a collapsed strip · rows navigate to /clients/[id].
// ============================================================

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, Plus, X, Loader2, MoreHorizontal, Pencil, Archive as ArchiveIcon,
  Trash2, ChevronRight, ChevronDown, ArrowUpDown, CheckCircle, AlertCircle, Download
} from 'lucide-react'
import { supabase, getCurrentUser } from '@/lib/supabase'

// ============ TYPES ============
interface Client { id: string; name: string; contact_name?: string; email?: string; phone?: string; payment_terms: string; status: string; created_at?: string; notes?: string }
interface Project { id: string; client_id?: string; status: string; billing_model?: string }
interface Assignment { team_member_id: string; project_id: string }
interface Member { id: string; name: string }
interface Toast { id: number; type: 'success' | 'error'; message: string }

// ============ HELPERS ============
const IDENTITY = ['#4f46e5', '#0e7490', '#b45309', '#166534', '#9d174d', '#1d4ed8', '#7c2d12', '#0f766e']
const clientColor = (id: string) => {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return IDENTITY[h % IDENTITY.length]
}
const initials = (name: string) => name.split(' ').map(w => w.charAt(0)).join('').slice(0, 2).toUpperCase()
const fmtH = (v: number) => v.toLocaleString('en-US', { maximumFractionDigits: 1 })
const localToday = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` }
const monthStart = () => localToday().slice(0, 8) + '01'
const termsLabel = (t: string) => (t || '').replace(/^net[_\s-]?(\d+)$/i, 'Net $1').replace(/^NET(\d+)$/i, 'Net $1') || '—'

function useCountUp(target: number, duration = 700) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      setVal(target * (1 - Math.pow(1 - t, 3)))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return val
}

const emptyForm = { name: '', contact_name: '', email: '', phone: '', payment_terms: 'net_30', status: 'active', notes: '' }

export default function ClientsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [hoursByClient, setHoursByClient] = useState<Record<string, number>>({})
  const [lastByClient, setLastByClient] = useState<Record<string, string>>({})

  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<'name' | 'projects' | 'hours' | 'activity'>('hours')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showArchived, setShowArchived] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)

  const [toasts, setToasts] = useState<Toast[]>([])
  const toast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3800)
  }, [])

  // "/" focuses search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault(); searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ============ LOAD ============
  const load = useCallback(async () => {
    try {
      const { user } = await getCurrentUser()
      if (!user) { setLoading(false); return }
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) { setLoading(false); return }
      setCompanyId(profile.company_id)

      const [{ data: c }, { data: p }, { data: m }] = await Promise.all([
        supabase.from('clients').select('id, name, contact_name, email, phone, payment_terms, status, created_at, notes').eq('company_id', profile.company_id).order('name'),
        supabase.from('projects').select('id, client_id, status, billing_model').eq('company_id', profile.company_id),
        supabase.from('team_members').select('id, name'),
      ])
      setClients(c || [])
      setProjects(p || [])
      setMembers(m || [])

      const projIds = (p || []).map((x: any) => x.id)
      if (projIds.length > 0) {
        const { data: a } = await supabase.from('team_project_assignments').select('team_member_id, project_id').in('project_id', projIds)
        setAssignments(a || [])
      }

      // Hours MTD + last activity per client, drafts excluded
      const ninety = new Date(Date.now() - 90 * 86400000)
      const since = `${ninety.getFullYear()}-${String(ninety.getMonth() + 1).padStart(2, '0')}-${String(ninety.getDate()).padStart(2, '0')}`
      const { data: te } = await supabase.from('time_entries')
        .select('client_id, date, hours, status')
        .gte('date', since)
        .neq('status', 'draft')
      const ms = monthStart()
      const hrs: Record<string, number> = {}
      const last: Record<string, string> = {}
      ;(te || []).forEach((e: any) => {
        if (!e.client_id) return
        if (e.date >= ms) hrs[e.client_id] = (hrs[e.client_id] || 0) + (e.hours || 0)
        if (!last[e.client_id] || e.date > last[e.client_id]) last[e.client_id] = e.date
      })
      setHoursByClient(hrs)
      setLastByClient(last)
    } catch (err) {
      console.error('clients load error:', err)
      toast('error', 'Failed to load clients')
    } finally { setLoading(false) }
  }, [toast])
  useEffect(() => { load() }, [load])

  // ============ DERIVED ============
  const perClient = useMemo(() => {
    const map: Record<string, { active: number; tm: number; ls: number; resources: string[] }> = {}
    const projClient: Record<string, string> = {}
    projects.forEach(p => {
      if (!p.client_id) return
      projClient[p.id] = p.client_id
      if (!map[p.client_id]) map[p.client_id] = { active: 0, tm: 0, ls: 0, resources: [] }
      if (p.status === 'active') {
        map[p.client_id].active++
        if ((p.billing_model || 'per_resource') === 'per_resource') map[p.client_id].tm++
        else map[p.client_id].ls++
      }
    })
    const resSets: Record<string, Set<string>> = {}
    const activeProjIds = new Set(projects.filter(p => p.status === 'active').map(p => p.id))
    assignments.forEach(a => {
      const cid = projClient[a.project_id]
      if (!cid || !activeProjIds.has(a.project_id)) return
      if (!resSets[cid]) resSets[cid] = new Set()
      resSets[cid].add(a.team_member_id)
    })
    Object.entries(resSets).forEach(([cid, set]) => { if (map[cid]) map[cid].resources = Array.from(set) })
    return map
  }, [projects, assignments])

  const memberName = (id: string) => members.find(m => m.id === id)?.name || '?'

  const activeClients = clients.filter(c => c.status !== 'archived')
  const archivedClients = clients.filter(c => c.status === 'archived')
  const totalActiveProjects = projects.filter(p => p.status === 'active').length
  const resourcesDeployed = useMemo(() => {
    const s = new Set<string>()
    Object.values(perClient).forEach(v => v.resources.forEach(r => s.add(r)))
    return s.size
  }, [perClient])
  const hoursMTD = Object.values(hoursByClient).reduce((s, v) => s + v, 0)
  const maxHours = Math.max(...activeClients.map(c => hoursByClient[c.id] || 0), 1)

  const filtered = useMemo(() => {
    let rows = activeClients.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
    const val = (c: Client) => {
      if (sortField === 'name') return c.name.toLowerCase()
      if (sortField === 'projects') return perClient[c.id]?.active || 0
      if (sortField === 'hours') return hoursByClient[c.id] || 0
      return lastByClient[c.id] || ''
    }
    rows.sort((a, b) => {
      const A = val(a), B = val(b)
      const cmp = A < B ? -1 : A > B ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
    return rows
  }, [activeClients, search, sortField, sortDir, perClient, hoursByClient, lastByClient])

  const activityLabel = (cid: string) => {
    const d = lastByClient[cid]
    if (!d) return { label: '—', warm: false }
    const days = Math.floor((Date.now() - new Date(d + 'T00:00:00').getTime()) / 86400000)
    return { label: days === 0 ? 'today' : `${days}d ago`, warm: days <= 7 }
  }

  const sortBtn = (field: typeof sortField) => () => {
    if (sortField === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir(field === 'name' ? 'asc' : 'desc') }
  }

  // ============ ACTIONS ============
  const openAdd = () => { setEditing(null); setForm({ ...emptyForm }); setShowModal(true) }
  const openEdit = (c: Client) => {
    setEditing(c)
    setForm({ name: c.name, contact_name: c.contact_name || '', email: c.email || '', phone: c.phone || '', payment_terms: c.payment_terms || 'net_30', status: c.status, notes: c.notes || '' })
    setShowModal(true); setMenuFor(null)
  }
  const saveClient = async () => {
    if (!form.name.trim() || saving || !companyId) return
    setSaving(true)
    const data = { company_id: companyId, name: form.name.trim(), contact_name: form.contact_name || null, email: form.email || null, phone: form.phone || null, payment_terms: form.payment_terms, status: form.status, notes: form.notes || null }
    try {
      if (editing) {
        const { error } = await supabase.from('clients').update(data).eq('id', editing.id)
        if (error) throw error
        setClients(prev => prev.map(c => (c.id === editing.id ? { ...c, ...data } as Client : c)))
        toast('success', 'Client updated')
      } else {
        const { data: created, error } = await supabase.from('clients').insert(data).select().single()
        if (error) throw error
        setClients(prev => [...prev, created as Client].sort((a, b) => a.name.localeCompare(b.name)))
        toast('success', 'Client added')
      }
      setShowModal(false)
    } catch (err) {
      console.error('save client error:', err)
      toast('error', 'Failed to save client')
    } finally { setSaving(false) }
  }
  const setStatus = async (c: Client, status: string) => {
    setMenuFor(null)
    const { error } = await supabase.from('clients').update({ status }).eq('id', c.id)
    if (error) { toast('error', 'Failed to update status'); return }
    setClients(prev => prev.map(x => (x.id === c.id ? { ...x, status } : x)))
    toast('success', status === 'archived' ? `${c.name} archived` : `${c.name} is ${status}`)
  }
  const deleteClient = async (c: Client) => {
    setMenuFor(null)
    if (!confirm(`Delete ${c.name}? Projects keep their data but lose the client link. This cannot be undone.`)) return
    try {
      await supabase.from('projects').update({ client_id: null }).eq('client_id', c.id)
      const { error } = await supabase.from('clients').delete().eq('id', c.id)
      if (error) throw error
      setClients(prev => prev.filter(x => x.id !== c.id))
      toast('success', `${c.name} deleted`)
    } catch (err) {
      console.error('delete client error:', err)
      toast('error', 'Failed to delete client')
    }
  }
  const exportCsv = () => {
    const head = 'Name,Contact,Email,Phone,Terms,Status,Active Projects,Resources,Hours MTD'
    const rows = clients.map(c => {
      const pc = perClient[c.id]
      return [c.name, c.contact_name || '', c.email || '', c.phone || '', termsLabel(c.payment_terms), c.status, pc?.active || 0, pc?.resources.length || 0, hoursByClient[c.id] || 0]
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    })
    const blob = new Blob([[head, ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `vantage-clients-${localToday()}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
  }

  const cClients = useCountUp(activeClients.length)
  const cProjects = useCountUp(totalActiveProjects)
  const cRes = useCountUp(resourcesDeployed)
  const cHours = useCountUp(hoursMTD)

  // ============ RENDER ============
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#eef1f4]"><Loader2 size={22} className="animate-spin text-slate-300" /></div>
  }

  return (
    <div className="min-h-screen bg-[#eef1f4] p-6" style={{ backgroundImage: 'linear-gradient(rgba(15,23,42,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.022) 1px, transparent 1px)', backgroundSize: '26px 26px' }} onClick={() => setMenuFor(null)}>
      <div className="max-w-[1180px] mx-auto flex flex-col gap-4">

        {/* HERO */}
        <div className="rounded-2xl relative overflow-hidden px-7 py-6 flex items-center justify-between gap-4 flex-wrap" style={{ background: 'linear-gradient(135deg,#1b2431,#10151c)', animation: 'vfadeup .5s cubic-bezier(.22,1,.36,1) both' }}>
          <div className="absolute inset-0" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 13px)' }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(70% 240% at 0% 0%, rgba(59,130,246,0.2), transparent 60%)' }} />
          <div className="relative z-10">
            <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-blue-400" style={{ fontFamily: 'Archivo, sans-serif' }}>Portfolio</div>
            <h1 className="text-white text-[26px] font-extrabold uppercase tracking-wide mt-1" style={{ fontFamily: 'Archivo, sans-serif' }}>Clients</h1>
            <p className="text-[12px] text-slate-400 mt-0.5">{activeClients.length} active engagements · live from projects, assignments, and time tracking</p>
          </div>
          <div className="relative z-10 flex gap-2">
            <button onClick={exportCsv} className="px-3.5 py-2 rounded-[10px] text-[12px] font-semibold text-slate-300 border border-white/10 bg-white/5 inline-flex items-center gap-1.5"><Download size={12} /> Export</button>
            <button onClick={openAdd} className="px-4 py-2 rounded-[10px] text-[12.5px] font-semibold text-white bg-blue-600 shadow-lg shadow-blue-600/25 inline-flex items-center gap-1.5"><Plus size={13} /> Add client</button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {[
            { label: 'Active clients', val: Math.round(cClients), sub: `${clients.length} total · ${archivedClients.length} archived`, grad: 'linear-gradient(90deg,#2563eb,#60a5fa)' },
            { label: 'Active projects', val: Math.round(cProjects), sub: `across ${Object.values(perClient).filter(v => v.active > 0).length} clients`, grad: 'linear-gradient(90deg,#0ea5e9,#7dd3fc)' },
            { label: 'Resources deployed', val: Math.round(cRes), sub: 'on client work now', grad: 'linear-gradient(90deg,#ea8a2f,#f6b57a)' },
            { label: 'Hours this month', val: fmtH(cHours), sub: `since ${monthStart().slice(5).replace('-', '/')} · submitted`, grad: 'linear-gradient(90deg,#10b981,#6ee7b7)' },
          ].map((k, i) => (
            <div key={k.label} className="bg-white border border-slate-200/60 rounded-xl p-4 shadow-sm relative overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition-all" style={{ animation: `vfadeup .5s cubic-bezier(.22,1,.36,1) ${0.05 * (i + 1)}s both` }}>
              <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: k.grad }} />
              <div className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-400">{k.label}</div>
              <div className="text-[28px] font-extrabold text-slate-900 mt-1 tabular-nums" style={{ fontFamily: 'Archivo, sans-serif' }}>{k.val}</div>
              <div className="text-[10.5px] text-slate-400 mt-0.5">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* TABLE */}
        <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm overflow-hidden" style={{ animation: 'vfadeup .5s cubic-bezier(.22,1,.36,1) .25s both' }}>
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 flex-wrap" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(15,23,42,0.022) 0 1px, transparent 1px 12px)' }}>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-[10px] px-3 py-2 w-[260px]">
              <Search size={13} className="text-slate-400" />
              <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder='Search clients…  ( / )' className="bg-transparent outline-none text-[12px] w-full placeholder:text-slate-400" />
            </div>
            <span className="text-[10.5px] text-slate-400">{filtered.length} shown</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr>
                  {([
                    ['name', 'Client', 'left'], [null, 'Terms', 'left'], ['projects', 'Active projects', 'right'],
                    [null, 'Contract mix', 'left'], [null, 'Resources', 'right'], ['hours', 'Hours MTD', 'right'], ['activity', 'Last activity', 'right'], [null, '', 'left'],
                  ] as const).map(([field, label, align], i) => (
                    <th key={i} className={`px-5 py-2.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-slate-400 bg-slate-50 border-b border-slate-200/70 whitespace-nowrap ${align === 'right' ? 'text-right' : 'text-left'}`}>
                      {field ? (
                        <button onClick={sortBtn(field)} className="inline-flex items-center gap-1 uppercase tracking-[0.08em] font-semibold hover:text-slate-600">
                          {label} <ArrowUpDown size={9} className={sortField === field ? 'text-blue-500' : 'text-slate-300'} />
                        </button>
                      ) : label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, idx) => {
                  const pc = perClient[c.id] || { active: 0, tm: 0, ls: 0, resources: [] }
                  const hrs = hoursByClient[c.id] || 0
                  const act = activityLabel(c.id)
                  const color = clientColor(c.id)
                  const suggestArchive = c.status === 'active' && pc.active === 0
                  return (
                    <tr key={c.id} onClick={() => router.push(`/clients/${c.id}`)} className="cursor-pointer hover:bg-slate-50/70 transition-colors group" style={{ animation: `vfadeup .4s cubic-bezier(.22,1,.36,1) ${Math.min(0.3 + idx * 0.04, 0.7)}s both` }}>
                      <td className="px-5 py-3.5 border-t border-slate-100">
                        <div className="flex items-center flex-wrap gap-y-1">
                          <span className="w-8 h-8 rounded-[9px] text-white inline-flex items-center justify-center font-bold text-[12px] mr-3" style={{ background: color, fontFamily: 'Archivo, sans-serif' }}>{c.name.charAt(0).toUpperCase()}</span>
                          <span className="font-semibold text-[13px] text-slate-900">{c.name}</span>
                          {suggestArchive && (
                            <span onClick={e => e.stopPropagation()} className="ml-2.5 inline-flex items-center gap-1.5 text-[9px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5">
                              No active projects — <button onClick={() => setStatus(c, 'archived')} className="underline font-bold">Archive</button>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 border-t border-slate-100 text-[12px] text-slate-600 whitespace-nowrap">{termsLabel(c.payment_terms)}</td>
                      <td className="px-5 py-3.5 border-t border-slate-100 text-right"><span className="font-bold text-slate-900 tabular-nums" style={{ fontFamily: 'Archivo, sans-serif' }}>{pc.active}</span></td>
                      <td className="px-5 py-3.5 border-t border-slate-100 whitespace-nowrap">
                        {pc.tm > 0 && <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded border mr-1.5 tabular-nums" style={{ color: '#c2660c', background: 'rgba(234,138,47,0.07)', borderColor: '#f6d3b3' }}>T&M · {pc.tm}</span>}
                        {pc.ls > 0 && <span className="text-[9.5px] font-semibold px-1.5 py-0.5 rounded border tabular-nums" style={{ color: '#0369a1', background: 'rgba(14,165,233,0.06)', borderColor: '#bae6fd' }}>LS · {pc.ls}</span>}
                        {pc.tm === 0 && pc.ls === 0 && <span className="text-slate-300 text-[11px]">—</span>}
                      </td>
                      <td className="px-5 py-3.5 border-t border-slate-100 text-right whitespace-nowrap">
                        {pc.resources.length === 0 ? <span className="text-slate-300 text-[11px]">—</span> : (
                          <span className="inline-flex flex-row-reverse">
                            {pc.resources.length > 4 && <span className="w-[22px] h-[22px] rounded-full bg-slate-100 border-2 border-white -ml-1.5 inline-flex items-center justify-center text-[8px] font-bold text-slate-500">+{pc.resources.length - 4}</span>}
                            {pc.resources.slice(0, 4).reverse().map(rid => (
                              <span key={rid} title={memberName(rid)} className="w-[22px] h-[22px] rounded-full bg-slate-200 border-2 border-white -ml-1.5 first:ml-0 inline-flex items-center justify-center text-[8px] font-bold text-slate-600">{initials(memberName(rid))}</span>
                            ))}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 border-t border-slate-100 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-2 justify-end">
                          <span className="font-bold text-slate-900 tabular-nums text-[12.5px]" style={{ fontFamily: 'Archivo, sans-serif' }}>{hrs > 0 ? fmtH(hrs) : '—'}</span>
                          {hrs > 0 && <span className="w-[46px] h-[5px] bg-slate-100 rounded-full overflow-hidden inline-block"><span className="block h-full rounded-full" style={{ width: `${Math.round((hrs / maxHours) * 100)}%`, background: color }} /></span>}
                        </span>
                      </td>
                      <td className={`px-5 py-3.5 border-t border-slate-100 text-right text-[11.5px] whitespace-nowrap ${act.warm ? 'text-emerald-700 font-semibold' : 'text-slate-400'}`}>{act.label}</td>
                      <td className="px-3 py-3.5 border-t border-slate-100 whitespace-nowrap text-right relative">
                        <button onClick={e => { e.stopPropagation(); setMenuFor(menuFor === c.id ? null : c.id) }} className="w-7 h-7 rounded-lg text-slate-300 group-hover:text-slate-500 group-hover:border group-hover:border-slate-200 group-hover:bg-white inline-flex items-center justify-center">
                          <MoreHorizontal size={14} />
                        </button>
                        <ChevronRight size={14} className="inline text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all ml-0.5" />
                        {menuFor === c.id && (
                          <div onClick={e => e.stopPropagation()} className="absolute right-8 top-10 z-30 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 w-[150px] text-left">
                            <button onClick={() => openEdit(c)} className="w-full text-left px-3.5 py-2 text-[12px] text-slate-600 hover:bg-slate-50 inline-flex items-center gap-2"><Pencil size={12} /> Edit</button>
                            <button onClick={() => setStatus(c, 'archived')} className="w-full text-left px-3.5 py-2 text-[12px] text-slate-600 hover:bg-slate-50 inline-flex items-center gap-2"><ArchiveIcon size={12} /> Archive</button>
                            <button onClick={() => deleteClient(c)} className="w-full text-left px-3.5 py-2 text-[12px] text-red-600 hover:bg-red-50 inline-flex items-center gap-2"><Trash2 size={12} /> Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-10 text-center text-[12px] text-slate-400 border-t border-slate-100">No clients match.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ARCHIVED STRIP */}
          {archivedClients.length > 0 && (
            <>
              <button onClick={() => setShowArchived(v => !v)} className="w-full flex items-center justify-between px-5 py-3 border-t border-slate-100 hover:bg-slate-50/70">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-400">Archived · {archivedClients.length} client{archivedClients.length === 1 ? '' : 's'}</span>
                <ChevronDown size={13} className={`text-slate-400 transition-transform ${showArchived ? 'rotate-180' : ''}`} />
              </button>
              {showArchived && archivedClients.map(c => (
                <div key={c.id} onClick={() => router.push(`/clients/${c.id}`)} className="flex items-center justify-between gap-3 px-5 py-2.5 border-t border-slate-100 cursor-pointer hover:bg-slate-50/70">
                  <span className="flex items-center">
                    <span className="w-7 h-7 rounded-lg bg-slate-300 text-white inline-flex items-center justify-center font-bold text-[11px] mr-3" style={{ fontFamily: 'Archivo, sans-serif' }}>{c.name.charAt(0).toUpperCase()}</span>
                    <span className="text-[12.5px] text-slate-400 font-medium">{c.name}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <button onClick={e => { e.stopPropagation(); setStatus(c, 'active') }} className="text-[10.5px] font-semibold text-blue-600 border border-blue-200 rounded-md px-2.5 py-1 hover:bg-blue-50">Restore</button>
                    <button onClick={e => { e.stopPropagation(); deleteClient(c) }} className="text-[10.5px] font-semibold text-red-500 border border-red-200 rounded-md px-2.5 py-1 hover:bg-red-50">Delete</button>
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* CLIENT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-[440px] max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(15,23,42,0.022) 0 1px, transparent 1px 12px)' }}>
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">{editing ? 'Edit client' : 'New client'}</span>
              <button onClick={() => setShowModal(false)} className="text-slate-400"><X size={15} /></button>
            </div>
            <div className="p-5 flex flex-col gap-3.5">
              <div>
                <label className="block text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-1">Name</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[12.5px] outline-none focus:border-blue-400" placeholder="Client name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-1">Contact</label>
                  <input value={form.contact_name} onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[12.5px] outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-1">Payment terms</label>
                  <select value={form.payment_terms} onChange={e => setForm(p => ({ ...p, payment_terms: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[12.5px] outline-none focus:border-blue-400 bg-white">
                    {['net_15', 'net_30', 'net_45', 'net_60', 'net_90', 'due_on_receipt'].map(t => <option key={t} value={t}>{t === 'due_on_receipt' ? 'Due on receipt' : termsLabel(t)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-1">Email</label>
                  <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[12.5px] outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-1">Phone</label>
                  <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[12.5px] outline-none focus:border-blue-400" />
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[12.5px] outline-none focus:border-blue-400 bg-white">
                  <option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option>
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[12.5px] outline-none focus:border-blue-400 resize-none" />
              </div>
              <button onClick={saveClient} disabled={saving || !form.name.trim()} className="w-full py-2.5 bg-blue-600 text-white rounded-[10px] text-[12.5px] font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : editing ? 'Save changes' : 'Add client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOASTS */}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-[12.5px] font-medium ${t.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            {t.type === 'success' ? <CheckCircle size={13} /> : <AlertCircle size={13} />} {t.message}
          </div>
        ))}
      </div>

      <style jsx global>{`@keyframes vfadeup { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </div>
  )
}
