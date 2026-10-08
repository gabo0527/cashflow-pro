'use client'

// Client portfolio presentation uses the existing client, scope and timesheet feeds.

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { getProjectPhases, phaseForDate, getContractType } from '@/components/projects/shared'
import { supabase, getCurrentUser } from '@/lib/supabase'
import ClientPortfolio from '@/components/clients/ClientPortfolio'

// ============ TYPES ============
interface Client { id: string; name: string; contact_name?: string; email?: string; phone?: string; payment_terms: string; status: string; created_at?: string; notes?: string }
interface Project { name?: string; id: string; client_id?: string; status: string; billing_model?: string; budget_type?: string }
interface Assignment { team_member_id: string; project_id: string }
interface Member { id: string; name: string }
interface Toast { id: number; type: 'success' | 'error'; message: string }

// ============ HELPERS ============
const localToday = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` }
const monthStart = () => localToday().slice(0, 8) + '01'
const termsLabel = (t: string) => (t || '').replace(/^net[_\s-]?(\d+)$/i, 'Net $1').replace(/^NET(\d+)$/i, 'Net $1') || '—'

const emptyForm = { name: '', contact_name: '', email: '', phone: '', payment_terms: 'net_30', status: 'active', notes: '' }

export default function ClientsPage() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [terms,setTerms] = useState<any[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [hoursByClient, setHoursByClient] = useState<Record<string, number>>({})
  const [lastByClient, setLastByClient] = useState<Record<string, string>>({})

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

  // ============ LOAD ============
  const load = useCallback(async () => {
    try {
      const { user } = await getCurrentUser()
      if (!user) { setLoading(false); return }
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) { setLoading(false); return }
      setCompanyId(profile.company_id)

      const [{ data: c }, { data: p }, { data: m }, {data:pt}] = await Promise.all([
        supabase.from('clients').select('id, name, contact_name, email, phone, payment_terms, status, created_at, notes').eq('company_id', profile.company_id).order('name'),
        supabase.from('projects').select('*').eq('company_id', profile.company_id),
        supabase.from('team_members').select('id, name'),
        supabase.from('project_terms').select('*').eq('company_id',profile.company_id),
      ])
      setClients(c || [])
      setProjects(p || [])
      setTerms(pt||[])
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
        if ((phaseForDate(getProjectPhases(p,terms),localToday())?.terms || (getContractType(p)==='lump_sum'?'lump_sum':'tm_open')) !== 'lump_sum') map[p.client_id].tm++
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
  }, [projects, assignments, terms])

  const memberName = (id: string) => members.find(m => m.id === id)?.name || '?'

  const totalActiveProjects = projects.filter(p => p.status === 'active').length
  const resourcesDeployed = useMemo(() => {
    const s = new Set<string>()
    Object.values(perClient).forEach(v => v.resources.forEach(r => s.add(r)))
    return s.size
  }, [perClient])
  const hoursMTD = Object.values(hoursByClient).reduce((s, v) => s + v, 0)
  const openAdd = () => { setEditing(null); setForm({ ...emptyForm }); setShowModal(true) }
  const openEdit = (c: Client) => {
    setEditing(c)
    setForm({ name: c.name, contact_name: c.contact_name || '', email: c.email || '', phone: c.phone || '', payment_terms: c.payment_terms || 'net_30', status: c.status, notes: c.notes || '' })
    setShowModal(true)
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
    const { error } = await supabase.from('clients').update({ status }).eq('id', c.id)
    if (error) { toast('error', 'Failed to update status'); return }
    setClients(prev => prev.map(x => (x.id === c.id ? { ...x, status } : x)))
    toast('success', status === 'archived' ? `${c.name} archived` : `${c.name} is ${status}`)
  }
  const deleteClient = async (c: Client) => {
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

  // ============ RENDER ============
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#eef1f4]"><Loader2 size={22} className="animate-spin text-slate-300" /></div>
  }

  return (
    <div className="min-h-screen bg-[#eef1f4] p-4 md:p-6">
      <ClientPortfolio
        clients={clients.map(c => ({ ...c,
          ...(perClient[c.id] || { active: 0, tm: 0, ls: 0, resources: [] }),
          resources: (perClient[c.id]?.resources || []).map(memberName),
          hours: hoursByClient[c.id] || 0, lastActivity: lastByClient[c.id],
          scopes: projects.filter(p => p.client_id === c.id && p.status === 'active').map(p => ({ id: p.id, name: p.name || 'Unnamed scope' })),
        }))}
        totals={{ scopes: totalActiveProjects, resources: resourcesDeployed, hours: hoursMTD }}
        onAdd={openAdd} onExport={exportCsv}
        onEdit={id => { const client = clients.find(c => c.id === id); if (client) openEdit(client) }}
        onStatus={(id, status) => { const client = clients.find(c => c.id === id); if (client) setStatus(client, status) }}
        onDelete={id => { const client = clients.find(c => c.id === id); if (client) deleteClient(client) }}
      />

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
