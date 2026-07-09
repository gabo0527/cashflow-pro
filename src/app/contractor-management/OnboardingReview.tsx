'use client'
// src/app/contractor-management/OnboardingReview.tsx
// Self-contained admin onboarding panel: review pending submissions
// (approve/reject, reveal sensitive fields) and invite active
// contractors to self-onboard. Calls /api/onboarding/{review,reveal,invite}.

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader2, Check, X, Mail, Eye, EyeOff, FileText } from 'lucide-react'

type Props = { teamMembers: any[]; onChanged: () => void }

const SENS_LABELS: Record<string, string> = {
  tax_id: 'Tax ID', routing_number: 'Routing #', account_number: 'Account #',
  swift_code: 'SWIFT', clabe: 'CLABE', iban: 'IBAN', bank_id: 'Bank ID', recipient_account: 'Recipient Acct',
}

export default function OnboardingReview({ teamMembers, onChanged }: Props) {
  const [pending, setPending] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Record<string, boolean>>({})

  const memberById: Record<string, any> = {}
  teamMembers.forEach(m => { memberById[m.id] = m })

  const loadPending = async () => {
    setLoading(true)
    const { data } = await supabase.from('contractor_profile_changes').select('*').eq('status', 'pending').order('submitted_at', { ascending: false })
    setPending(data || [])
    setLoading(false)
  }
  useEffect(() => { loadPending() }, [])

  const authHeaders = async () => {
    const { data } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }
  }

  const invite = async (id: string) => {
    setBusy(id)
    try {
      const res = await fetch('/api/onboarding/invite', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ contractorId: id }) })
      if (!res.ok) throw new Error()
      onChanged()
    } catch { alert('Invite failed') } finally { setBusy(null) }
  }

  const markOnboarded = async (id: string) => {
    setBusy(id)
    try {
      const { error } = await supabase.from('team_members').update({ onboarding_status: 'active' }).eq('id', id)
      if (error) throw error
      onChanged()
    } catch { alert('Failed to update') } finally { setBusy(null) }
  }

  const viewDoc = async (path: string) => {
    try {
      const res = await fetch('/api/onboarding/doc-url', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ path }) })
      if (!res.ok) throw new Error()
      const d = await res.json()
      window.open(d.url, '_blank')
    } catch { alert('Could not open document') }
  }

  const review = async (changeId: string, action: 'approve' | 'reject') => {
    setBusy(changeId)
    try {
      const res = await fetch('/api/onboarding/review', { method: 'POST', headers: await authHeaders(), body: JSON.stringify({ changeId, action }) })
      if (!res.ok) throw new Error()
      await loadPending(); onChanged()
    } catch { alert('Action failed') } finally { setBusy(null) }
  }

  const toggleReveal = (key: string) => setRevealed(prev => ({ ...prev, [key]: !prev[key] }))
  const maskVal = (v: any) => { const s = v ? String(v) : ''; return s.length > 4 ? '\u2022\u2022\u2022\u2022' + s.slice(-4) : (s ? '\u2022\u2022\u2022\u2022' : '\u2014') }

  const Fld = ({ label, value }: { label: string; value: any }) => (
    <div>
      <div className="text-[10px] uppercase tracking-[0.04em] text-gray-400">{label}</div>
      <div className="text-[13px] font-medium mt-0.5 text-slate-800">{value || '—'}</div>
    </div>
  )
  const Sens = ({ changeId, field, value }: { changeId: string; field: string; value: any }) => {
    const key = `${changeId}:${field}`
    const shown = revealed[key]
    return (
      <div>
        <div className="text-[10px] uppercase tracking-[0.04em] text-gray-400">{SENS_LABELS[field]}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[13px] font-mono text-slate-800">{shown ? (value || '\u2014') : maskVal(value)}</span>
          <button onClick={() => toggleReveal(key)} className="flex items-center gap-1 text-[11px] text-blue-600 border border-gray-200 rounded-md px-2 py-0.5 hover:bg-blue-50">
            {shown ? <><EyeOff size={11} /> Hide</> : <><Eye size={11} /> Reveal</>}
          </button>
        </div>
      </div>
    )
  }

  const activeMembers = teamMembers.filter(m => (m.onboarding_status || 'active') === 'active')
  const invitedMembers = teamMembers.filter(m => m.onboarding_status === 'invited' || m.onboarding_status === 'onboarding')

  return (
    <div className="space-y-4">
      {/* Pending review */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden" style={{ boxShadow: '0 12px 30px -22px rgba(15,23,42,.3)' }}>
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-gray-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Pending review</span>
          <span className="text-[11px] text-gray-400">{pending.length} awaiting approval</span>
        </div>
        {loading ? (
          <div className="p-6 flex justify-center"><Loader2 className="animate-spin text-gray-400" size={20} /></div>
        ) : pending.length === 0 ? (
          <div className="p-6 text-center text-[13px] text-gray-400">No submissions waiting.</div>
        ) : pending.map(ch => {
          const m = memberById[ch.contractor_id] || {}
          const p = ch.payload || {}
          const wire = p.payment_method === 'Wire'
          return (
            <div key={ch.id} className="border-t border-gray-100">
              <div className="flex items-center gap-3 px-5 py-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-extrabold text-[13px]" style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>{(m.name || '?').slice(0, 2).toUpperCase()}</div>
                <div>
                  <div className="text-[13.5px] font-semibold">{m.name || p.name || 'Contractor'}</div>
                  <div className="text-[11px] text-gray-400">{p.entity_name || '—'} · {ch.kind}</div>
                </div>
                <span className="ml-auto text-[9px] font-semibold uppercase tracking-[0.04em] rounded-md px-2 py-1 text-amber-700" style={{ background: 'rgba(217,119,6,.16)', border: '1px solid rgba(217,119,6,.32)', fontFamily: "'JetBrains Mono', monospace" }}>Pending</span>
              </div>
              <div className="px-5 pb-4 space-y-4" style={{ background: '#fafbff' }}>
                <div>
                  <div className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-gray-400 mb-2 pt-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Identity</div>
                  <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
                    <Fld label="Legal Entity" value={p.entity_name} />
                    <Fld label="Entity Type" value={p.entity_type} />
                    <Fld label="Residency" value={p.residency_status} />
                    <Fld label="AP Email" value={p.ap_email} />
                    <Fld label="Address" value={p.address} />
                    <Fld label="Tax ID Type" value={p.tax_id_type} />
                    {p.tax_id && <Sens changeId={ch.id} field="tax_id" value={p.tax_id} />}
                  </div>
                </div>
                <div>
                  <div className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-gray-400 mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Payment · {p.payment_method || 'ACH'}</div>
                  <div className="grid grid-cols-2 gap-x-5 gap-y-2.5">
                    <Fld label="Bank" value={p.bank_name} />
                    {!wire && <Fld label="Account Type" value={p.account_type} />}
                    {!wire && p.routing_number && <Sens changeId={ch.id} field="routing_number" value={p.routing_number} />}
                    {!wire && p.account_number && <Sens changeId={ch.id} field="account_number" value={p.account_number} />}
                    {wire && <Fld label="Bank ID Type" value={p.bank_id_type} />}
                    {wire && p.bank_id && <Sens changeId={ch.id} field="bank_id" value={p.bank_id} />}
                    {wire && <Fld label="Recipient Name" value={p.recipient_name} />}
                    {wire && p.recipient_account && <Sens changeId={ch.id} field="recipient_account" value={p.recipient_account} />}
                  </div>
                </div>
                <div>
                  <div className="text-[9.5px] font-semibold uppercase tracking-[0.06em] text-gray-400 mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Tax form</div>
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-gray-200">
                    <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100"><FileText size={15} /></div>
                    <div>
                      <div className="text-[12.5px] font-semibold">Form {p.tax_form_type || '—'}</div>
                      <div className="text-[11px] text-gray-400">e-signed "{p.signature_name || '—'}"{p.signed_at ? ` · ${new Date(p.signed_at).toLocaleDateString()}` : ''}</div>
                    </div>
                    {(p.w9_url || p.w8ben_url || p.w8bene_url) && <button onClick={() => viewDoc(p.w9_url || p.w8ben_url || p.w8bene_url)} className="ml-auto text-[11.5px] font-semibold text-blue-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-blue-50">View PDF</button>}
                  </div>
                </div>
                <div className="flex justify-end gap-2.5 pt-1">
                  <button onClick={() => review(ch.id, 'reject')} disabled={busy === ch.id} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-bold text-rose-600 bg-white disabled:opacity-40" style={{ border: '1px solid rgba(225,29,72,.3)' }}><X size={14} /> Reject</button>
                  <button onClick={() => review(ch.id, 'approve')} disabled={busy === ch.id} className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40">
                    {busy === ch.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve &amp; sync
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Invite */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden" style={{ boxShadow: '0 12px 30px -22px rgba(15,23,42,.3)' }}>
        <div className="px-5 py-3 border-b border-gray-100">
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-gray-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>Invite to onboard</span>
        </div>
        {invitedMembers.map(m => (
          <div key={m.id} className="flex items-center gap-3 px-5 py-2.5 border-t border-gray-100">
            <div className="text-[13px] font-medium">{m.name}</div>
            <div className="text-[11px] text-gray-400">{m.email}</div>
            <span className="ml-auto text-[9px] font-semibold uppercase tracking-[0.04em] rounded-md px-2 py-1 text-blue-600" style={{ background: 'rgba(37,99,235,.14)', border: '1px solid rgba(37,99,235,.3)', fontFamily: "'JetBrains Mono', monospace" }}>Invited</span>
            <button onClick={() => markOnboarded(m.id)} disabled={busy === m.id} className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40"><Check size={13} /> Mark onboarded</button>
            <button onClick={() => invite(m.id)} disabled={busy === m.id} className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40"><Mail size={13} /> Resend</button>
          </div>
        ))}
        {activeMembers.map(m => (
          <div key={m.id} className="flex items-center gap-3 px-5 py-2.5 border-t border-gray-100">
            <div className="text-[13px] font-medium">{m.name}</div>
            <div className="text-[11px] text-gray-400">{m.email}</div>
            <button onClick={() => invite(m.id)} disabled={busy === m.id} className="ml-auto flex items-center gap-1.5 text-[12px] font-semibold text-white bg-blue-600 rounded-lg px-3 py-1.5 hover:bg-blue-700 disabled:opacity-40">
              {busy === m.id ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />} Invite to onboard
            </button>
          </div>
        ))}
        {teamMembers.length === 0 && <div className="p-5 text-[13px] text-gray-400">No contractors yet.</div>}
      </div>
    </div>
  )
}
