'use client'

import React, { useState, useEffect } from 'react'
import { Building2, Users, Shield, Link2, CreditCard, Database, Bell, ChevronRight, Check, X, Trash2, Edit2, Eye, EyeOff, RefreshCw, Copy, ExternalLink, Key, Lock, Mail, Smartphone, FileText, Download, UserPlus, CheckCircle2, Info, Loader2, Save, Plus, Scale, AlertTriangle } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { PERMISSION_MATRIX } from '@/lib/permissions'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')

// ============ TYPES ============
interface Company { id: string; name: string; legal_name?: string; ein?: string; address?: string; city?: string; state?: string; zip?: string; country?: string; industry?: string; fiscal_year_start?: string; currency?: string; timezone?: string; logo_url?: string; created_at: string }
interface TeamMember { id: string; name: string; email: string; role: string | null; permission_role: 'owner' | 'admin' | 'member' | 'viewer' | 'employee'; status: 'active' | 'inactive' | 'invited' }

const ALL_FEATURES = [
  { id: 'dashboard', label: 'Dashboard' }, { id: 'cash_flow', label: 'Cash Flow' }, { id: 'invoices', label: 'Invoices' },
  { id: 'expenses', label: 'Expenses' }, { id: 'time_tracking', label: 'Time' }, { id: 'team', label: 'Team' },
  { id: 'projects', label: 'Projects' }, { id: 'clients', label: 'Clients' }, { id: 'reports', label: 'Reports' },
  { id: 'forecast', label: 'Forecast' }, { id: 'sage', label: 'Sage' }, { id: 'settings', label: 'Settings' },
]

const SETTINGS_SECTIONS = [
  { id: 'company', label: 'Company Profile', icon: Building2 },
  { id: 'team', label: 'Team & Permissions', icon: Users },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'integrations', label: 'Integrations', icon: Link2 },
  { id: 'billing', label: 'Billing & Plan', icon: CreditCard },
  { id: 'data', label: 'Data & Privacy', icon: Database },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'legal', label: 'Legal', icon: Scale },
]

const INDUSTRIES = ['Consulting', 'Technology', 'Construction', 'Healthcare', 'Legal', 'Marketing', 'Financial Services', 'Real Estate', 'Manufacturing', 'Other']
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (ET)' }, { value: 'America/Chicago', label: 'Central (CT)' },
  { value: 'America/Denver', label: 'Mountain (MT)' }, { value: 'America/Los_Angeles', label: 'Pacific (PT)' },
  { value: 'America/Puerto_Rico', label: 'Atlantic (AT)' }, { value: 'Europe/Madrid', label: 'CET' }, { value: 'Europe/London', label: 'GMT' }
]

// ============ SHARED UI (Institutional Theme) ============
function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-[#111827] rounded-xl border border-white/[0.06] ${className}`}>{children}</div>
}

function SectionHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between">
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      {action}
    </div>
  )
}

function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-400">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-600">{hint}</p>}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', disabled = false }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled}
      className="w-full px-3 py-2 bg-[#0B0F1A] border border-white/[0.08] rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500/40 focus:ring-1 focus:ring-teal-500/20 disabled:opacity-50 transition-colors" />
  )
}

function Sel({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 bg-[#0B0F1A] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-teal-500/40 appearance-none cursor-pointer">
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!enabled)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-teal-500' : 'bg-slate-700'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function StatusBadge({ status }: { status: string }) {
  const s: Record<string, string> = {
    connected: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    active: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    inactive: 'bg-red-500/10 text-red-400 border-red-500/20',
    invited: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  }
  return <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide border ${s[status] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>{status}</span>
}

function ComingSoonBadge() {
  return <span className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded">Coming Soon</span>
}

// ============ COMPANY PROFILE ============
function CompanyProfileSection({ company, onSave }: { company: Company | null; onSave: (c: Partial<Company>) => void }) {
  const [form, setForm] = useState({
    name: company?.name || '', legal_name: company?.legal_name || '', ein: company?.ein || '',
    address: company?.address || '', city: company?.city || '', state: company?.state || '',
    zip: company?.zip || '', country: company?.country || 'US', industry: company?.industry || '',
    fiscal_year_start: company?.fiscal_year_start || '01', currency: company?.currency || 'USD',
    timezone: company?.timezone || 'America/New_York'
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000) }

  return (
    <div className="space-y-6">
      <SectionCard>
        <SectionHeader title="Company Information" description="Basic details about your business" />
        <div className="p-5"><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Company Name" hint="Display name shown in sidebar"><Input value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="Vantage" /></FormField>
          <FormField label="Legal Name"><Input value={form.legal_name} onChange={v => setForm({ ...form, legal_name: v })} placeholder="Vantage Consulting LLC" /></FormField>
          <FormField label="EIN / Tax ID"><Input value={form.ein} onChange={v => setForm({ ...form, ein: v })} placeholder="XX-XXXXXXX" /></FormField>
          <FormField label="Industry"><Sel value={form.industry} onChange={v => setForm({ ...form, industry: v })} options={INDUSTRIES.map(i => ({ value: i, label: i }))} placeholder="Select industry" /></FormField>
        </div></div>
      </SectionCard>
      <SectionCard>
        <SectionHeader title="Address" />
        <div className="p-5 space-y-4">
          <FormField label="Street Address"><Input value={form.address} onChange={v => setForm({ ...form, address: v })} placeholder="123 Business St" /></FormField>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FormField label="City"><Input value={form.city} onChange={v => setForm({ ...form, city: v })} placeholder="San Juan" /></FormField>
            <FormField label="State"><Input value={form.state} onChange={v => setForm({ ...form, state: v })} placeholder="PR" /></FormField>
            <FormField label="ZIP"><Input value={form.zip} onChange={v => setForm({ ...form, zip: v })} placeholder="00901" /></FormField>
            <FormField label="Country"><Sel value={form.country} onChange={v => setForm({ ...form, country: v })} options={[{ value: 'US', label: 'United States' }, { value: 'PR', label: 'Puerto Rico' }, { value: 'ES', label: 'Spain' }]} /></FormField>
          </div>
        </div>
      </SectionCard>
      <SectionCard>
        <SectionHeader title="Financial Settings" />
        <div className="p-5"><div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Fiscal Year Start"><Sel value={form.fiscal_year_start} onChange={v => setForm({ ...form, fiscal_year_start: v })} options={[{ value: '01', label: 'January' }, { value: '04', label: 'April' }, { value: '07', label: 'July' }, { value: '10', label: 'October' }]} /></FormField>
          <FormField label="Currency"><Sel value={form.currency} onChange={v => setForm({ ...form, currency: v })} options={[{ value: 'USD', label: 'USD ($)' }, { value: 'EUR', label: 'EUR (€)' }]} /></FormField>
          <FormField label="Timezone"><Sel value={form.timezone} onChange={v => setForm({ ...form, timezone: v })} options={TIMEZONES} /></FormField>
        </div></div>
      </SectionCard>
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving} className="px-5 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:bg-slate-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors">
          {saving ? <RefreshCw size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}{saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// ============ TEAM & PERMISSIONS (Supabase-wired) ============
function TeamSection({ companyId }: { companyId: string }) {
  const [members, setMembers] = useState<TeamMember[]>([]); const [loading, setLoading] = useState(true)
  const [editingRole, setEditingRole] = useState<string | null>(null); const [processing, setProcessing] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false); const [inviteForm, setInviteForm] = useState({ name: '', email: '', permission_role: 'employee' })

  useEffect(() => { loadMembers() }, [companyId])
  const loadMembers = async () => { setLoading(true); const { data } = await supabase.from('team_members').select('id,name,email,role,permission_role,status').eq('company_id', companyId).order('name'); if (data) setMembers(data.map((d: any) => ({ ...d, permission_role: d.permission_role || 'employee', status: d.status || 'active' }))); setLoading(false) }
  const updatePermRole = async (id: string, role: string) => { setProcessing(id); const { error } = await supabase.from('team_members').update({ permission_role: role }).eq('id', id).select(); if (!error) setMembers(p => p.map(m => m.id === id ? { ...m, permission_role: role as any } : m)); else alert(`Error: ${error.message}`); setProcessing(null); setEditingRole(null) }
  const updateStatus = async (id: string, status: string) => { setProcessing(id); const { error } = await supabase.from('team_members').update({ status }).eq('id', id).select(); if (!error) setMembers(p => p.map(m => m.id === id ? { ...m, status: status as any } : m)); setProcessing(null) }
  const removeMember = async (id: string) => { const m = members.find(x => x.id === id); if (!confirm(`Remove ${m?.name}? This cannot be undone.`)) return; setProcessing(id); const { error } = await supabase.from('team_members').delete().eq('id', id); if (!error) setMembers(p => p.filter(x => x.id !== id)); else alert(`Error: ${error.message}`); setProcessing(null) }
  const handleInvite = async () => { if (!inviteForm.name || !inviteForm.email) return; setProcessing('invite'); const { data, error } = await supabase.from('team_members').insert({ company_id: companyId, name: inviteForm.name, email: inviteForm.email, permission_role: inviteForm.permission_role, status: 'active' }).select().single(); if (!error && data) { setMembers(p => [...p, { ...data, permission_role: data.permission_role || 'employee' }]); setInviteForm({ name: '', email: '', permission_role: 'employee' }); setShowInvite(false) } else alert(`Error: ${error?.message}`); setProcessing(null) }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-teal-400 animate-spin" /></div>
  return (
    <div className="space-y-6">
      <SectionCard>
        <SectionHeader title="Team Members" description={`${members.length} members`} action={
          <button onClick={() => setShowInvite(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 text-xs font-medium rounded-lg border border-teal-500/20 transition-colors"><UserPlus size={12} /> Add Member</button>
        } />
        <div className="divide-y divide-white/[0.04]">{members.map(member => { const perm = PERMISSION_MATRIX[member.permission_role] || PERMISSION_MATRIX.employee; return (
          <div key={member.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-white/[0.015] transition-colors group">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-xs font-semibold text-teal-400">{member.name.split(' ').map(n => n[0]).join('').substring(0, 2)}</div>
              <div><div className="flex items-center gap-2"><span className="text-sm text-white font-medium">{member.name}</span>{member.role && <span className="text-[11px] text-slate-600">({member.role})</span>}</div><p className="text-xs text-slate-500">{member.email}</p></div>
            </div>
            <div className="flex items-center gap-3">
              {editingRole === member.id ? (
                <select value={member.permission_role} onChange={e => updatePermRole(member.id, e.target.value)} className="px-2 py-1 bg-[#0B0F1A] border border-white/[0.12] rounded-lg text-xs text-white focus:ring-1 focus:ring-teal-500/40" autoFocus onBlur={() => setEditingRole(null)}>
                  {member.permission_role === 'owner' && <option value="owner">Owner</option>}
                  <option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option><option value="employee">Employee</option>
                </select>
              ) : (
                <button onClick={() => member.permission_role !== 'owner' ? setEditingRole(member.id) : null}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 uppercase tracking-wide border transition-colors ${member.permission_role === 'owner' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 cursor-default' : member.permission_role === 'admin' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20 hover:bg-teal-500/20 cursor-pointer' : member.permission_role === 'member' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20 cursor-pointer' : member.permission_role === 'viewer' ? 'bg-slate-500/10 text-slate-400 border-slate-500/20 hover:bg-slate-500/20 cursor-pointer' : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20 cursor-pointer'}`}
                  title={member.permission_role !== 'owner' ? 'Click to change role' : ''}>{perm.label}{member.permission_role !== 'owner' && <Edit2 size={9} />}</button>
              )}
              <StatusBadge status={member.status} />
              {member.permission_role !== 'owner' && <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {member.status === 'active' ? <button onClick={() => updateStatus(member.id, 'inactive')} className="p-1.5 text-slate-500 hover:text-amber-400 rounded transition-colors" title="Deactivate"><EyeOff size={13} /></button> : <button onClick={() => updateStatus(member.id, 'active')} className="p-1.5 text-slate-500 hover:text-emerald-400 rounded transition-colors" title="Activate"><Eye size={13} /></button>}
                <button onClick={() => removeMember(member.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded transition-colors" title="Remove">{processing === member.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}</button>
              </div>}
            </div>
          </div>) })}</div>
      </SectionCard>

      {showInvite && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowInvite(false)}><div className="bg-[#111827] border border-white/[0.08] rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-white mb-4">Add Team Member</h3>
        <div className="space-y-4">
          <FormField label="Full Name"><Input value={inviteForm.name} onChange={v => setInviteForm(p => ({ ...p, name: v }))} placeholder="John Smith" /></FormField>
          <FormField label="Email"><Input value={inviteForm.email} onChange={v => setInviteForm(p => ({ ...p, email: v }))} placeholder="john@company.com" type="email" /></FormField>
          <FormField label="Permission Role" hint="Controls which pages this person can access"><Sel value={inviteForm.permission_role} onChange={v => setInviteForm(p => ({ ...p, permission_role: v }))} options={[{ value: 'admin', label: 'Admin — Full access except billing' }, { value: 'member', label: 'Member — Edit data, view reports' }, { value: 'viewer', label: 'Viewer — Read-only dashboards' }, { value: 'employee', label: 'Employee — Timesheet & expenses only' }]} /></FormField>
        </div>
        <div className="flex justify-end gap-3 mt-6"><button onClick={() => setShowInvite(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button><button onClick={handleInvite} disabled={!inviteForm.name || !inviteForm.email || processing === 'invite'} className="px-4 py-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors">{processing === 'invite' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add Member</button></div>
      </div></div>}

      <SectionCard>
        <SectionHeader title="Role Permissions" description="What each role can access throughout the app" />
        <div className="p-5 overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="border-b border-white/[0.06]"><th className="text-left py-2 pr-4 text-xs text-slate-500 font-medium">Role</th>{ALL_FEATURES.map(f => <th key={f.id} className="text-center px-1 py-2 text-[10px] text-slate-600 font-medium">{f.label}</th>)}</tr></thead>
          <tbody>{Object.entries(PERMISSION_MATRIX).map(([k, p]) => <tr key={k} className="border-b border-white/[0.03]"><td className="py-2.5 pr-4"><span className={`text-xs font-medium ${p.color}`}>{p.label}</span><p className="text-[10px] text-slate-600 mt-0.5">{p.description}</p></td>{ALL_FEATURES.map(f => <td key={f.id} className="text-center px-1 py-2.5">{p.access.includes(f.id) ? <Check size={12} className="text-teal-400 mx-auto" /> : <X size={12} className="text-slate-700 mx-auto" />}</td>)}</tr>)}</tbody></table>
          <p className="text-[11px] text-slate-600 mt-3 flex items-center gap-1"><Info size={10} /> Employees access /timesheet only — no admin interface.</p>
        </div>
      </SectionCard>
    </div>
  )
}

// ============ SECURITY (Persists to company_settings) ============
function SecuritySection({ companyId }: { companyId: string }) {
  const [twoFactor, setTwoFactor] = useState(true); const [timeout, setTimeout_] = useState('24'); const [ipWhitelist, setIpWhitelist] = useState(false)
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false)
  const [auditLogs, setAuditLogs] = useState<any[]>([]); const [loadingLogs, setLoadingLogs] = useState(true)

  useEffect(() => { if (companyId) { loadSecuritySettings(); loadAuditLogs() } }, [companyId])

  const loadSecuritySettings = async () => {
    const { data } = await supabase.from('company_settings').select('security_settings').eq('company_id', companyId).single()
    if (data?.security_settings) { const s = data.security_settings; if (s.two_factor !== undefined) setTwoFactor(s.two_factor); if (s.session_timeout) setTimeout_(s.session_timeout); if (s.ip_whitelist !== undefined) setIpWhitelist(s.ip_whitelist) }
  }

  const loadAuditLogs = async () => {
    setLoadingLogs(true)
    try { const { data } = await supabase.from('audit_logs').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(20); if (data) setAuditLogs(data) } catch { /* table may not exist yet */ }
    setLoadingLogs(false)
  }

  const saveSettings = async () => {
    setSaving(true)
    await supabase.from('company_settings').upsert({ company_id: companyId, security_settings: { two_factor: twoFactor, session_timeout: timeout, ip_whitelist: ipWhitelist } }, { onConflict: 'company_id' })
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-6">
      <SectionCard>
        <SectionHeader title="Authentication" description="Configure how users sign in" />
        <div className="p-5 divide-y divide-white/[0.04]">
          <div className="flex items-center justify-between py-3"><div><p className="text-sm text-white font-medium">Two-Factor Authentication (2FA)</p><p className="text-xs text-slate-500">Require 2FA for all team members</p></div><Toggle enabled={twoFactor} onChange={setTwoFactor} /></div>
          <div className="flex items-center justify-between py-3"><div><p className="text-sm text-white font-medium">Session Timeout</p><p className="text-xs text-slate-500">Auto-logout after inactivity</p></div><div className="w-40"><Sel value={timeout} onChange={setTimeout_} options={[{ value: '1', label: '1 hour' }, { value: '8', label: '8 hours' }, { value: '24', label: '24 hours' }, { value: '168', label: '7 days' }]} /></div></div>
          <div className="flex items-center justify-between py-3"><div><p className="text-sm text-white font-medium">IP Whitelist</p><p className="text-xs text-slate-500">Restrict access to specific IPs</p></div><Toggle enabled={ipWhitelist} onChange={setIpWhitelist} /></div>
        </div>
      </SectionCard>
      <div className="flex justify-end"><button onClick={saveSettings} disabled={saving} className="px-5 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:bg-slate-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors">{saving ? <RefreshCw size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}{saved ? 'Saved!' : 'Save Security Settings'}</button></div>

      <SectionCard>
        <SectionHeader title="SSO / SAML" description="Enterprise authentication" />
        <div className="p-5"><div className="flex items-center justify-between p-4 bg-[#0B0F1A] border border-white/[0.06] rounded-lg">
          <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center"><Key size={16} className="text-blue-400" /></div><div><p className="text-sm text-white font-medium">SAML 2.0 / SSO</p><p className="text-xs text-slate-500">Okta, Azure AD, Google Workspace</p></div></div>
          <ComingSoonBadge />
        </div></div>
      </SectionCard>

      <SectionCard>
        <SectionHeader title="Audit Log" description={auditLogs.length > 0 ? `${auditLogs.length} recent events` : 'Activity tracking'} />
        {loadingLogs ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-teal-400 animate-spin" /></div> : auditLogs.length > 0 ? (
          <div className="divide-y divide-white/[0.04]">{auditLogs.map((l: any) => (
            <div key={l.id} className="px-5 py-3 flex items-center justify-between hover:bg-white/[0.015] transition-colors">
              <div className="flex items-center gap-3"><div className="w-7 h-7 rounded-lg bg-white/[0.03] flex items-center justify-center">{l.action === 'login' ? <Lock size={12} className="text-slate-400" /> : <FileText size={12} className="text-slate-400" />}</div><div><p className="text-xs text-white">{l.action}</p><p className="text-[11px] text-slate-500">{l.user_name}{l.details ? ` · ${l.details}` : ''}</p></div></div>
              <div className="text-right"><p className="text-[11px] text-slate-500">{new Date(l.created_at).toLocaleString()}</p>{l.ip_address && <p className="text-[10px] text-slate-600">{l.ip_address}</p>}</div>
            </div>))}</div>
        ) : <div className="px-5 py-8 text-center"><p className="text-xs text-slate-500">No audit logs yet. Activity will be tracked as your team uses the platform.</p></div>}
      </SectionCard>
    </div>
  )
}

// ============ INTEGRATIONS ============
function IntegrationsSection({ companyId }: { companyId: string }) {
  const [syncing, setSyncing] = useState<string | null>(null); const [lastSync, setLastSync] = useState<string | null>(null)
  useEffect(() => { if (companyId) loadSyncStatus() }, [companyId])
  const loadSyncStatus = async () => { const { data } = await supabase.from('company_settings').select('qbo_last_sync').eq('company_id', companyId).single(); if (data?.qbo_last_sync) setLastSync(data.qbo_last_sync) }
  const triggerSync = async (type: string) => { setSyncing(type); try { const res = await fetch('/api/quickbooks/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }) }); if (res.ok) { const now = new Date().toISOString(); setLastSync(now); await supabase.from('company_settings').upsert({ company_id: companyId, qbo_last_sync: now }, { onConflict: 'company_id' }) } } catch (err) { console.error('Sync error:', err) } setSyncing(null) }

  const integrations = [
    { type: 'quickbooks', name: 'QuickBooks Online', desc: 'Sync invoices & expenses', icon: '📊', connected: true },
    { type: 'xero', name: 'Xero', desc: 'Connect Xero accounting', icon: '📘', connected: false },
    { type: 'plaid', name: 'Plaid', desc: 'Direct bank feed', icon: '🏦', connected: false },
    { type: 'stripe', name: 'Stripe', desc: 'Accept payments', icon: '💳', connected: false },
    { type: 'slack', name: 'Slack', desc: 'Get notifications in Slack', icon: '💬', connected: false },
  ]

  return (
    <div className="space-y-6">
      <SectionCard>
        <SectionHeader title="Connected Integrations" />
        <div className="p-5"><div className="flex items-center justify-between p-4 bg-[#0B0F1A] border border-white/[0.06] rounded-lg">
          <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-lg">📊</div><div><div className="flex items-center gap-2"><span className="text-sm text-white font-medium">QuickBooks Online</span><StatusBadge status="connected" /></div><p className="text-xs text-slate-500">{lastSync ? `Last synced ${new Date(lastSync).toLocaleString()}` : 'Connected'}</p></div></div>
          <div className="flex items-center gap-2"><button onClick={() => triggerSync('all')} disabled={syncing !== null} className="p-2 text-slate-400 hover:text-teal-400 transition-colors disabled:opacity-50" title="Sync now"><RefreshCw size={15} className={syncing === 'all' ? 'animate-spin' : ''} /></button><button className="px-3 py-1.5 text-red-400 hover:bg-red-500/10 rounded-lg text-xs transition-colors">Disconnect</button></div>
        </div></div>
      </SectionCard>
      <SectionCard>
        <SectionHeader title="Available Integrations" />
        <div className="p-5 space-y-3">{integrations.map(a => (
          <div key={a.type} className="flex items-center justify-between p-4 bg-[#0B0F1A] border border-white/[0.06] rounded-lg">
            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center text-lg">{a.icon}</div><div><p className="text-sm text-white font-medium">{a.name}</p><p className="text-xs text-slate-500">{a.desc}</p></div></div>
            {a.connected ? <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 size={12} /> Connected</span> : <ComingSoonBadge />}
          </div>
        ))}</div>
      </SectionCard>
      <SectionCard>
        <SectionHeader title="API Access" />
        <div className="p-5"><div className="p-4 bg-[#0B0F1A] border border-white/[0.06] rounded-lg text-center"><Key size={20} className="text-slate-500 mx-auto mb-2" /><p className="text-sm text-slate-400">API access coming soon</p><p className="text-xs text-slate-600 mt-1">Programmatic access to your Vantage data</p></div></div>
      </SectionCard>
    </div>
  )
}

// ============ BILLING ============
function BillingSection() {
  return (
    <div className="space-y-6">
      <SectionCard>
        <SectionHeader title="Current Plan" />
        <div className="p-5"><div className="flex items-center justify-between"><div><h4 className="text-lg font-semibold text-white">Founder Access</h4><p className="text-xs text-slate-500 mt-0.5">Full platform access during development</p></div><span className="px-2.5 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded text-[10px] font-medium uppercase tracking-wide">Active</span></div></div>
      </SectionCard>
      <SectionCard>
        <SectionHeader title="Plans & Pricing" description="Subscription tiers will be available at public launch" />
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[
            { name: 'Starter', price: 0, features: ['Up to 3 users', '5 projects', 'Basic reports'] },
            { name: 'Professional', price: 49, features: ['Up to 15 users', 'Unlimited projects', 'Advanced reports', 'Integrations'] },
            { name: 'Enterprise', price: 199, features: ['Unlimited users', 'Custom reports', 'SSO/SAML', 'API access', 'Priority support'] },
          ].map(p => (
            <div key={p.name} className="p-5 bg-[#0B0F1A] border border-white/[0.06] rounded-lg">
              <h4 className="text-sm font-semibold text-white">{p.name}</h4>
              <div className="mt-2"><span className="text-2xl font-bold text-white">${p.price}</span><span className="text-xs text-slate-500">/mo</span></div>
              <ul className="mt-3 space-y-1.5">{p.features.map(f => <li key={f} className="flex items-center gap-2 text-xs text-slate-400"><Check size={11} className="text-teal-400/60" />{f}</li>)}</ul>
            </div>
          ))}</div>
          <p className="text-[11px] text-slate-600 mt-4 flex items-center gap-1"><Info size={10} /> Billing will be enabled at public launch. You currently have full access.</p>
        </div>
      </SectionCard>
    </div>
  )
}

// ============ DATA & PRIVACY (Real exports + real danger zone) ============
function DataPrivacySection({ companyId }: { companyId: string }) {
  const [exporting, setExporting] = useState<string | null>(null); const [retention, setRetention] = useState('forever')
  const [confirmReset, setConfirmReset] = useState(false); const [resetInput, setResetInput] = useState(''); const [resetting, setResetting] = useState(false)

  const exportTable = async (table: string) => {
    setExporting(table)
    try {
      const { data, error } = await supabase.from(table).select('*').eq('company_id', companyId)
      if (error) throw error
      if (!data || data.length === 0) { alert(`No data found in ${table}`); setExporting(null); return }
      const headers = Object.keys(data[0])
      const csv = [headers.join(','), ...data.map(row => headers.map(h => { const val = row[h]; if (val === null || val === undefined) return ''; const str = String(val); return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str }).join(','))].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${table}_export_${new Date().toISOString().split('T')[0]}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
    } catch (err: any) { alert(`Export failed: ${err.message}`) }
    setExporting(null)
  }

  const exportAll = async () => { for (const t of ['transactions', 'invoices', 'projects', 'time_entries', 'clients', 'expense_claims', 'team_members']) { await exportTable(t); await new Promise(r => setTimeout(r, 500)) } }

  const handleReset = async () => {
    if (resetInput !== 'DELETE ALL DATA') return
    setResetting(true)
    try { for (const t of ['transactions', 'invoices', 'time_entries', 'expense_claims']) { await supabase.from(t).delete().eq('company_id', companyId) }; alert('All financial data has been reset. Team members, projects, and clients preserved.'); setConfirmReset(false); setResetInput('') } catch (err: any) { alert(`Reset failed: ${err.message}`) }
    setResetting(false)
  }

  const EXPORT_TABLES = [{ key: 'transactions', label: 'Transactions' }, { key: 'invoices', label: 'Invoices' }, { key: 'projects', label: 'Projects' }, { key: 'time_entries', label: 'Time Entries' }, { key: 'clients', label: 'Clients' }, { key: 'expense_claims', label: 'Expense Claims' }, { key: 'team_members', label: 'Team Members' }]

  return (
    <div className="space-y-6">
      <SectionCard>
        <SectionHeader title="Data Export" description="Download your data in CSV format" />
        <div className="p-5 space-y-3">
          {EXPORT_TABLES.map(t => (
            <div key={t.key} className="flex items-center justify-between p-3 bg-[#0B0F1A] border border-white/[0.06] rounded-lg">
              <div className="flex items-center gap-2.5"><Database size={13} className="text-slate-500" /><span className="text-sm text-white">{t.label}</span></div>
              <button onClick={() => exportTable(t.key)} disabled={exporting !== null} className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 disabled:opacity-50 transition-colors">{exporting === t.key ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Export CSV</button>
            </div>
          ))}
          <button onClick={exportAll} disabled={exporting !== null} className="w-full py-2.5 border border-teal-500/20 text-teal-400 hover:bg-teal-500/10 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"><Download size={14} /> Export All Tables</button>
        </div>
      </SectionCard>
      <SectionCard>
        <SectionHeader title="Data Retention" />
        <div className="p-5"><FormField label="Retention Period" hint="How long to keep historical data"><Sel value={retention} onChange={setRetention} options={[{ value: 'forever', label: 'Forever (recommended)' }, { value: '7years', label: '7 Years' }, { value: '5years', label: '5 Years' }, { value: '3years', label: '3 Years' }]} /></FormField></div>
      </SectionCard>
      <SectionCard>
        <SectionHeader title="Danger Zone" />
        <div className="p-5"><div className="flex items-center justify-between p-4 border border-amber-500/20 rounded-lg bg-amber-500/[0.03]"><div><p className="text-sm text-white font-medium">Reset Financial Data</p><p className="text-xs text-slate-500 mt-0.5">Deletes transactions, invoices, time entries, expenses. Team, projects, clients preserved.</p></div><button onClick={() => setConfirmReset(true)} className="px-3 py-1.5 border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 rounded-lg text-xs font-medium transition-colors">Reset Data</button></div></div>
      </SectionCard>
      {confirmReset && <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setConfirmReset(false)}><div className="bg-[#111827] border border-red-500/20 rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4"><div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center"><AlertTriangle size={20} className="text-red-400" /></div><div><h3 className="text-base font-semibold text-white">Reset All Financial Data</h3><p className="text-xs text-slate-500">This action cannot be undone</p></div></div>
        <p className="text-sm text-slate-300 mb-4">This will permanently delete all transactions, invoices, time entries, and expense claims. Team members, projects, and clients will be preserved.</p>
        <FormField label="Type DELETE ALL DATA to confirm"><Input value={resetInput} onChange={setResetInput} placeholder="DELETE ALL DATA" /></FormField>
        <div className="flex justify-end gap-3 mt-6"><button onClick={() => { setConfirmReset(false); setResetInput('') }} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">Cancel</button><button onClick={handleReset} disabled={resetInput !== 'DELETE ALL DATA' || resetting} className="px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:bg-slate-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors">{resetting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Reset Data</button></div>
      </div></div>}
    </div>
  )
}

// ============ NOTIFICATIONS (Persists to Supabase) ============
function NotificationsSection({ companyId }: { companyId: string }) {
  const [notifs, setNotifs] = useState({ invoice_paid: true, invoice_overdue: true, weekly_summary: true, low_cash: true, time_reminder: false, new_team_member: true, expense_submitted: true, expense_approved: true })
  const [channels, setChannels] = useState({ email: true, push: false, slack: false })
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [email, setEmail] = useState('')

  useEffect(() => { (async () => {
    const { data: { user } } = await supabase.auth.getUser(); if (user?.email) setEmail(user.email)
    const { data } = await supabase.from('company_settings').select('notification_preferences').eq('company_id', companyId).single()
    if (data?.notification_preferences) { const p = data.notification_preferences; setNotifs(prev => ({ ...prev, ...p })); if (p.channels) setChannels(prev => ({ ...prev, ...p.channels })) }
  })() }, [companyId])

  const savePrefs = async () => { setSaving(true); await supabase.from('company_settings').upsert({ company_id: companyId, notification_preferences: { ...notifs, channels } }, { onConflict: 'company_id' }); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000) }

  const opts = [
    { key: 'invoice_paid', label: 'Invoice Paid', desc: 'When a client pays' }, { key: 'invoice_overdue', label: 'Invoice Overdue', desc: 'When invoice becomes overdue' },
    { key: 'weekly_summary', label: 'Weekly Summary', desc: 'Weekly email with key metrics' }, { key: 'low_cash', label: 'Low Cash Alert', desc: 'When cash drops below threshold' },
    { key: 'time_reminder', label: 'Time Reminder', desc: 'Daily reminder to log time' }, { key: 'new_team_member', label: 'New Team Member', desc: 'When someone joins' },
    { key: 'expense_submitted', label: 'Expense Submitted', desc: 'When employee submits expense' }, { key: 'expense_approved', label: 'Expense Processed', desc: 'When your expense is approved/rejected' },
  ]

  return (
    <div className="space-y-6">
      <SectionCard><SectionHeader title="Email Notifications" description="Choose what to be notified about" /><div className="divide-y divide-white/[0.04]">{opts.map(o => (
        <div key={o.key} className="px-5 py-3.5 flex items-center justify-between"><div><p className="text-sm text-white font-medium">{o.label}</p><p className="text-xs text-slate-500">{o.desc}</p></div><Toggle enabled={notifs[o.key as keyof typeof notifs]} onChange={v => setNotifs(p => ({ ...p, [o.key]: v }))} /></div>
      ))}</div></SectionCard>
      <SectionCard><SectionHeader title="Channels" description="Where to receive notifications" /><div className="p-5 space-y-3">
        <div className="flex items-center justify-between p-3.5 bg-[#0B0F1A] border border-white/[0.06] rounded-lg"><div className="flex items-center gap-3"><Mail size={16} className="text-teal-400" /><div><p className="text-sm text-white">Email</p><p className="text-xs text-slate-500">{email || 'Your login email'}</p></div></div><Toggle enabled={channels.email} onChange={v => setChannels(p => ({ ...p, email: v }))} /></div>
        <div className="flex items-center justify-between p-3.5 bg-[#0B0F1A] border border-white/[0.06] rounded-lg"><div className="flex items-center gap-3"><Smartphone size={16} className="text-slate-400" /><div><p className="text-sm text-white">Push Notifications</p><p className="text-xs text-slate-500">Mobile app</p></div></div><ComingSoonBadge /></div>
        <div className="flex items-center justify-between p-3.5 bg-[#0B0F1A] border border-white/[0.06] rounded-lg"><div className="flex items-center gap-3"><span className="text-base">💬</span><div><p className="text-sm text-white">Slack</p><p className="text-xs text-slate-500">Get alerts in Slack</p></div></div><ComingSoonBadge /></div>
      </div></SectionCard>
      <div className="flex justify-end"><button onClick={savePrefs} disabled={saving} className="px-5 py-2.5 bg-teal-500 hover:bg-teal-600 disabled:bg-slate-700 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors">{saving ? <RefreshCw size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}{saved ? 'Saved!' : 'Save Preferences'}</button></div>
    </div>
  )
}

// ============ LEGAL ============
function LegalSection() {
  const docs = [{ title: 'Terms of Service', desc: 'Usage terms, liability, and service conditions', href: '/terms', updated: 'February 1, 2026' }, { title: 'Privacy Policy', desc: 'How we collect, use, and protect your data', href: '/privacy', updated: 'February 1, 2026' }]
  return (
    <div className="space-y-6">
      <SectionCard><SectionHeader title="Legal Documents" description="Review our terms and policies" /><div className="divide-y divide-white/[0.04]">{docs.map(d => (
        <a key={d.href} href={d.href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.015] transition-colors group">
          <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center"><FileText size={15} className="text-slate-500 group-hover:text-teal-400 transition-colors" /></div><div><p className="text-sm text-white font-medium">{d.title}</p><p className="text-xs text-slate-500">{d.desc}</p></div></div>
          <div className="flex items-center gap-3"><span className="text-[11px] text-slate-600">Updated {d.updated}</span><ExternalLink size={13} className="text-slate-600 group-hover:text-teal-400 transition-colors" /></div>
        </a>))}</div></SectionCard>
      <SectionCard><SectionHeader title="Contact" description="Reach our legal and privacy teams" /><div className="p-5 space-y-3">
        <div className="flex items-center justify-between p-3.5 bg-[#0B0F1A] border border-white/[0.06] rounded-lg"><div className="flex items-center gap-3"><Mail size={15} className="text-slate-400" /><div><p className="text-sm text-white">Legal Inquiries</p><p className="text-xs text-slate-500">Terms, compliance, and general legal questions</p></div></div><a href="mailto:legal@vantagefp.co" className="text-teal-400 text-xs font-medium hover:underline">legal@vantagefp.co</a></div>
        <div className="flex items-center justify-between p-3.5 bg-[#0B0F1A] border border-white/[0.06] rounded-lg"><div className="flex items-center gap-3"><Shield size={15} className="text-slate-400" /><div><p className="text-sm text-white">Privacy & Data Requests</p><p className="text-xs text-slate-500">Data access, deletion, and privacy concerns</p></div></div><a href="mailto:privacy@vantagefp.co" className="text-teal-400 text-xs font-medium hover:underline">privacy@vantagefp.co</a></div>
      </div></SectionCard>
      <SectionCard><SectionHeader title="Data Processing" description="Infrastructure and compliance" /><div className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 bg-[#0B0F1A] border border-white/[0.06] rounded-lg text-center"><p className="text-teal-400 font-semibold text-base">TLS 1.2+</p><p className="text-[11px] text-slate-500 mt-1">Encryption in Transit</p></div>
          <div className="p-4 bg-[#0B0F1A] border border-white/[0.06] rounded-lg text-center"><p className="text-teal-400 font-semibold text-base">AES-256</p><p className="text-[11px] text-slate-500 mt-1">Encryption at Rest</p></div>
          <div className="p-4 bg-[#0B0F1A] border border-white/[0.06] rounded-lg text-center"><p className="text-teal-400 font-semibold text-base">RLS</p><p className="text-[11px] text-slate-500 mt-1">Row-Level Isolation</p></div>
        </div>
        <div className="p-4 bg-[#0B0F1A] border border-white/[0.06] rounded-lg"><p className="text-xs text-slate-400 leading-relaxed">Your financial data is stored on Supabase (PostgreSQL) with Row Level Security ensuring complete data isolation between organizations. Application hosted on Vercel. Authentication handled via Google OAuth 2.0 — we never store passwords. All connections are HTTPS-only.</p></div>
      </div></SectionCard>
    </div>
  )
}

// ============ MAIN ============
export default function SettingsPage() {
  const [section, setSection] = useState('company'); const [company, setCompany] = useState<Company | null>(null); const [companyId, setCompanyId] = useState<string | null>(null); const [loading, setLoading] = useState(true)

  useEffect(() => { (async () => {
    try { const { data: { user } } = await supabase.auth.getUser(); if (!user) { setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
    if (profile?.company_id) { setCompanyId(profile.company_id); const { data } = await supabase.from('companies').select('*').eq('id', profile.company_id).single(); if (data) setCompany(data) }
    } catch (e) { console.error(e) } finally { setLoading(false) }
  })() }, [])

  const handleSaveCompany = async (updates: Partial<Company>) => { if (!company) return; const { error } = await supabase.from('companies').update(updates).eq('id', company.id); if (!error) { setCompany({ ...company, ...updates }); window.dispatchEvent(new CustomEvent('company-updated', { detail: updates })) } }

  const render = () => { switch (section) {
    case 'company': return <CompanyProfileSection company={company} onSave={handleSaveCompany} />
    case 'team': return companyId ? <TeamSection companyId={companyId} /> : null
    case 'security': return companyId ? <SecuritySection companyId={companyId} /> : null
    case 'integrations': return companyId ? <IntegrationsSection companyId={companyId} /> : null
    case 'billing': return <BillingSection />
    case 'data': return companyId ? <DataPrivacySection companyId={companyId} /> : null
    case 'notifications': return companyId ? <NotificationsSection companyId={companyId} /> : null
    case 'legal': return <LegalSection />
    default: return null
  }}

  if (loading) return <div className="flex items-center justify-center h-[calc(100vh-120px)]"><Loader2 className="w-6 h-6 text-teal-400 animate-spin" /></div>

  return (
    <div className="space-y-6">
      <div><h1 className="text-xl font-bold text-white">Settings</h1><p className="text-xs text-slate-500 mt-1">Configure your account and preferences</p></div>
      <div className="flex gap-6">
        <div className="w-56 flex-shrink-0"><nav className="bg-[#111827] rounded-xl border border-white/[0.06] overflow-hidden sticky top-6">
          {SETTINGS_SECTIONS.map(s => <button key={s.id} onClick={() => setSection(s.id)} className={`w-full flex items-center gap-2.5 px-4 py-3 text-left text-sm transition-all ${section === s.id ? 'bg-teal-500/10 text-teal-400 border-l-2 border-teal-400' : 'text-slate-400 hover:bg-white/[0.03] hover:text-white border-l-2 border-transparent'}`}><s.icon size={15} /><span className="font-medium">{s.label}</span></button>)}
        </nav></div>
        <div className="flex-1 min-w-0">{render()}</div>
      </div>
    </div>
  )
}
