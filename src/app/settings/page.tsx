'use client'

import React, { useState, useEffect } from 'react'
import { Building2, Users, Shield, Link2, CreditCard, Database, Bell, ChevronRight, Check, X, Trash2, Edit2, Eye, EyeOff, RefreshCw, Copy, ExternalLink, Key, Lock, Mail, Smartphone, FileText, Download, UserPlus, CheckCircle2, Info, Loader2, Save, Plus, Scale } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { PERMISSION_MATRIX } from '@/lib/permissions'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '')

interface Company { id: string; name: string; legal_name?: string; ein?: string; address?: string; city?: string; state?: string; zip?: string; country?: string; industry?: string; fiscal_year_start?: string; currency?: string; timezone?: string; logo_url?: string; created_at: string }
interface TeamMember { id: string; name: string; email: string; role: string | null; permission_role: 'owner'|'admin'|'member'|'viewer'|'employee'; status: 'active'|'inactive'|'invited' }

const ALL_FEATURES = [
  { id: 'dashboard', label: 'Dashboard' }, { id: 'cash_flow', label: 'Cash Flow' }, { id: 'invoices', label: 'Invoices' },
  { id: 'expenses', label: 'Expenses' }, { id: 'time_tracking', label: 'Time' }, { id: 'team', label: 'Team' },
  { id: 'projects', label: 'Projects' }, { id: 'clients', label: 'Clients' }, { id: 'reports', label: 'Reports' },
  { id: 'forecast', label: 'Forecast' }, { id: 'sage', label: 'Sage' }, { id: 'settings', label: 'Settings' },
]

const SETTINGS_SECTIONS = [
  { id: 'company', label: 'Company Profile', icon: Building2 }, { id: 'team', label: 'Team & Permissions', icon: Users },
  { id: 'security', label: 'Security', icon: Shield }, { id: 'integrations', label: 'Integrations', icon: Link2 },
  { id: 'billing', label: 'Billing & Plan', icon: CreditCard }, { id: 'data', label: 'Data & Privacy', icon: Database },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'legal', label: 'Legal', icon: Scale },
]
const INDUSTRIES = ['Consulting','Technology','Construction','Healthcare','Legal','Marketing','Financial Services','Real Estate','Manufacturing','Other']
const TIMEZONES = [{ value: 'America/New_York', label: 'Eastern (ET)' },{ value: 'America/Chicago', label: 'Central (CT)' },{ value: 'America/Denver', label: 'Mountain (MT)' },{ value: 'America/Los_Angeles', label: 'Pacific (PT)' },{ value: 'America/Puerto_Rico', label: 'Atlantic (AT)' },{ value: 'Europe/Madrid', label: 'CET' },{ value: 'Europe/London', label: 'GMT' }]

// Shared UI
function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <div className={`bg-slate-900/70 backdrop-blur-xl rounded-xl border border-white/[0.08] ${className}`}>{children}</div> }
function SectionHeader({ title, description }: { title: string; description?: string }) { return <div className="px-6 py-4 border-b border-white/[0.08]"><h3 className="text-lg font-semibold text-white">{title}</h3>{description && <p className="text-sm text-slate-400 mt-1">{description}</p>}</div> }
function FormField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) { return <div className="space-y-2"><label className="block text-sm font-medium text-slate-300">{label}</label>{children}{hint && <p className="text-xs text-slate-500">{hint}</p>}</div> }
function Input({ value, onChange, placeholder, type = 'text', disabled = false }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean }) { return <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/[0.08] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50" /> }
function Sel({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string }) { return <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/[0.08] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">{placeholder && <option value="">{placeholder}</option>}{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> }
function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) { return <button onClick={() => onChange(!enabled)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} /></button> }
function StatusBadge({ status }: { status: string }) { const s: Record<string,string> = { connected:'bg-emerald-500/20 text-emerald-400', active:'bg-emerald-500/20 text-emerald-400', inactive:'bg-red-500/20 text-red-400', invited:'bg-amber-500/20 text-amber-400' }; return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s[status]||'bg-slate-500/20 text-slate-400'}`}>{status.charAt(0).toUpperCase()+status.slice(1)}</span> }

// ====== COMPANY PROFILE ======
function CompanyProfileSection({ company, onSave }: { company: Company|null; onSave: (c: Partial<Company>) => void }) {
  const [form, setForm] = useState({ name: company?.name||'', legal_name: company?.legal_name||'', ein: company?.ein||'', address: company?.address||'', city: company?.city||'', state: company?.state||'', zip: company?.zip||'', country: company?.country||'US', industry: company?.industry||'', fiscal_year_start: company?.fiscal_year_start||'01', currency: company?.currency||'USD', timezone: company?.timezone||'America/New_York' })
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false)
  const handleSave = async () => { setSaving(true); await onSave(form); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000) }
  return (<div className="space-y-6">
    <SectionCard><SectionHeader title="Company Information" description="Basic details about your business" /><div className="p-6 space-y-6"><div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <FormField label="Company Name" hint="Display name shown in sidebar"><Input value={form.name} onChange={v => setForm({...form, name: v})} placeholder="Vantage" /></FormField>
      <FormField label="Legal Name"><Input value={form.legal_name} onChange={v => setForm({...form, legal_name: v})} placeholder="Vantage Consulting LLC" /></FormField>
      <FormField label="EIN / Tax ID"><Input value={form.ein} onChange={v => setForm({...form, ein: v})} placeholder="XX-XXXXXXX" /></FormField>
      <FormField label="Industry"><Sel value={form.industry} onChange={v => setForm({...form, industry: v})} options={INDUSTRIES.map(i => ({value:i,label:i}))} placeholder="Select industry" /></FormField>
    </div></div></SectionCard>
    <SectionCard><SectionHeader title="Address" /><div className="p-6 space-y-6">
      <FormField label="Street Address"><Input value={form.address} onChange={v => setForm({...form, address: v})} placeholder="123 Business St" /></FormField>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <FormField label="City"><Input value={form.city} onChange={v => setForm({...form, city: v})} placeholder="San Juan" /></FormField>
        <FormField label="State"><Input value={form.state} onChange={v => setForm({...form, state: v})} placeholder="PR" /></FormField>
        <FormField label="ZIP"><Input value={form.zip} onChange={v => setForm({...form, zip: v})} placeholder="00901" /></FormField>
        <FormField label="Country"><Sel value={form.country} onChange={v => setForm({...form, country: v})} options={[{value:'US',label:'United States'},{value:'PR',label:'Puerto Rico'},{value:'ES',label:'Spain'}]} /></FormField>
      </div>
    </div></SectionCard>
    <SectionCard><SectionHeader title="Financial Settings" /><div className="p-6"><div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <FormField label="Fiscal Year Start"><Sel value={form.fiscal_year_start} onChange={v => setForm({...form, fiscal_year_start: v})} options={[{value:'01',label:'January'},{value:'04',label:'April'},{value:'07',label:'July'},{value:'10',label:'October'}]} /></FormField>
      <FormField label="Currency"><Sel value={form.currency} onChange={v => setForm({...form, currency: v})} options={[{value:'USD',label:'USD ($)'},{value:'EUR',label:'EUR (€)'}]} /></FormField>
      <FormField label="Timezone"><Sel value={form.timezone} onChange={v => setForm({...form, timezone: v})} options={TIMEZONES} /></FormField>
    </div></div></SectionCard>
    <div className="flex justify-end"><button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 text-white font-medium rounded-lg flex items-center gap-2">{saving ? <RefreshCw size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : <Check size={16} />}{saved ? 'Saved!' : 'Save Changes'}</button></div>
  </div>)
}

// ====== TEAM & PERMISSIONS — FROM SUPABASE ======
function TeamSection({ companyId }: { companyId: string }) {
  const [members, setMembers] = useState<TeamMember[]>([]); const [loading, setLoading] = useState(true)
  const [editingRole, setEditingRole] = useState<string|null>(null); const [processing, setProcessing] = useState<string|null>(null)
  const [showInvite, setShowInvite] = useState(false); const [inviteForm, setInviteForm] = useState({ name:'', email:'', permission_role:'employee' })

  useEffect(() => { loadMembers() }, [companyId])
  const loadMembers = async () => { setLoading(true); const { data } = await supabase.from('team_members').select('id,name,email,role,permission_role,status').eq('company_id', companyId).order('name'); if (data) setMembers(data.map((d:any) => ({...d, permission_role: d.permission_role||'employee', status: d.status||'active'}))); setLoading(false) }

  const updatePermRole = async (id: string, role: string) => { setProcessing(id); const { error } = await supabase.from('team_members').update({permission_role:role}).eq('id',id).select(); if (!error) setMembers(p => p.map(m => m.id===id ? {...m, permission_role:role as any} : m)); else alert(`Error: ${error.message}`); setProcessing(null); setEditingRole(null) }
  const updateStatus = async (id: string, status: string) => { setProcessing(id); const { error } = await supabase.from('team_members').update({status}).eq('id',id).select(); if (!error) setMembers(p => p.map(m => m.id===id ? {...m, status:status as any} : m)); setProcessing(null) }
  const removeMember = async (id: string) => { const m = members.find(x=>x.id===id); if (!confirm(`Remove ${m?.name}?`)) return; setProcessing(id); const { error } = await supabase.from('team_members').delete().eq('id',id); if (!error) setMembers(p => p.filter(x => x.id!==id)); else alert(`Error: ${error.message}`); setProcessing(null) }
  const handleInvite = async () => { if (!inviteForm.name||!inviteForm.email) return; setProcessing('invite'); const { data, error } = await supabase.from('team_members').insert({company_id:companyId, name:inviteForm.name, email:inviteForm.email, permission_role:inviteForm.permission_role, status:'active'}).select().single(); if (!error&&data) { setMembers(p => [...p, {...data, permission_role:data.permission_role||'employee'}]); setInviteForm({name:'',email:'',permission_role:'employee'}); setShowInvite(false) } else alert(`Error: ${error?.message}`); setProcessing(null) }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-emerald-500 animate-spin" /></div>
  return (<div className="space-y-6">
    <SectionCard>
      <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between"><div><h3 className="text-lg font-semibold text-white">Team Members</h3><p className="text-sm text-slate-400 mt-1">{members.length} members</p></div><button onClick={() => setShowInvite(true)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg flex items-center gap-2"><UserPlus size={16} /> Add Member</button></div>
      <div className="divide-y divide-white/[0.08]">{members.map(member => { const perm = PERMISSION_MATRIX[member.permission_role]||PERMISSION_MATRIX.employee; return (
        <div key={member.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white font-medium text-sm">{member.name.split(' ').map(n=>n[0]).join('').substring(0,2)}</div>
            <div><div className="flex items-center gap-2"><span className="text-white font-medium">{member.name}</span>{member.role && <span className="text-xs text-slate-500">({member.role})</span>}</div><p className="text-sm text-slate-400">{member.email}</p></div>
          </div>
          <div className="flex items-center gap-3">
            {editingRole===member.id ? (
              <select value={member.permission_role} onChange={e => updatePermRole(member.id, e.target.value)} className="px-3 py-1.5 bg-slate-800 border border-white/[0.12] rounded-lg text-sm text-white focus:ring-2 focus:ring-emerald-500/50" autoFocus onBlur={() => setEditingRole(null)}>
                {member.permission_role==='owner' && <option value="owner">Owner</option>}
                <option value="admin">Admin</option><option value="member">Member</option><option value="viewer">Viewer</option><option value="employee">Employee</option>
              </select>
            ) : (
              <button onClick={() => member.permission_role!=='owner' ? setEditingRole(member.id) : null} className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${member.permission_role==='owner'?'bg-purple-500/20 text-purple-400 cursor-default':member.permission_role==='admin'?'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 cursor-pointer':member.permission_role==='member'?'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 cursor-pointer':member.permission_role==='viewer'?'bg-slate-500/20 text-slate-400 hover:bg-slate-500/30 cursor-pointer':'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 cursor-pointer'}`} title={member.permission_role!=='owner'?'Click to change role':''}>{perm.label}{member.permission_role!=='owner' && <Edit2 size={10} />}</button>
            )}
            <StatusBadge status={member.status} />
            {member.permission_role!=='owner' && <div className="flex items-center gap-1">
              {member.status==='active' ? <button onClick={() => updateStatus(member.id,'inactive')} className="p-1.5 text-slate-400 hover:text-amber-400 rounded" title="Deactivate"><EyeOff size={14} /></button> : <button onClick={() => updateStatus(member.id,'active')} className="p-1.5 text-slate-400 hover:text-emerald-400 rounded" title="Activate"><Eye size={14} /></button>}
              <button onClick={() => removeMember(member.id)} className="p-1.5 text-slate-400 hover:text-red-400 rounded" title="Remove"><Trash2 size={14} /></button>
            </div>}
          </div>
        </div>) })}</div>
    </SectionCard>

    {showInvite && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"><div className="bg-slate-900 border border-white/[0.08] rounded-xl p-6 w-full max-w-md">
      <h3 className="text-lg font-semibold text-white mb-4">Add Team Member</h3>
      <div className="space-y-4">
        <FormField label="Full Name"><Input value={inviteForm.name} onChange={v => setInviteForm(p=>({...p,name:v}))} placeholder="John Smith" /></FormField>
        <FormField label="Email"><Input value={inviteForm.email} onChange={v => setInviteForm(p=>({...p,email:v}))} placeholder="john@company.com" type="email" /></FormField>
        <FormField label="Permission Role" hint="Controls which pages this person can access"><Sel value={inviteForm.permission_role} onChange={v => setInviteForm(p=>({...p,permission_role:v}))} options={[{value:'admin',label:'Admin — Full access except billing'},{value:'member',label:'Member — Edit data, view reports'},{value:'viewer',label:'Viewer — Read-only dashboards'},{value:'employee',label:'Employee — Timesheet & expenses only'}]} /></FormField>
      </div>
      <div className="flex justify-end gap-3 mt-6"><button onClick={() => setShowInvite(false)} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button><button onClick={handleInvite} disabled={!inviteForm.name||!inviteForm.email||processing==='invite'} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium rounded-lg flex items-center gap-2">{processing==='invite' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add Member</button></div>
    </div></div>}

    <SectionCard><SectionHeader title="Role Permissions" description="What each role can access throughout the app" />
      <div className="p-6 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-white/[0.08]"><th className="text-left py-2 pr-4 text-slate-400 font-medium">Role</th>{ALL_FEATURES.map(f => <th key={f.id} className="text-center px-1 py-2 text-slate-500 font-medium text-[11px]">{f.label}</th>)}</tr></thead>
        <tbody>{Object.entries(PERMISSION_MATRIX).map(([k,p]) => <tr key={k} className="border-b border-white/[0.05]"><td className="py-3 pr-4"><span className={`font-medium ${p.color}`}>{p.label}</span><p className="text-xs text-slate-500 mt-0.5">{p.description}</p></td>{ALL_FEATURES.map(f => <td key={f.id} className="text-center px-1 py-3">{p.access.includes(f.id) ? <Check size={14} className="text-emerald-400 mx-auto" /> : <X size={14} className="text-slate-700 mx-auto" />}</td>)}</tr>)}</tbody></table>
        <p className="text-xs text-slate-500 mt-4 flex items-center gap-1"><Info size={12} /> Employees access /timesheet only — no admin interface.</p>
      </div>
    </SectionCard>
  </div>)
}

// ====== SECURITY ======
function SecuritySection() {
  const [twoFactor, setTwoFactor] = useState(true); const [timeout, setTimeout_] = useState('24'); const [ipWhitelist, setIpWhitelist] = useState(false)
  const logs = [{id:'1',user_name:'Gabriel Vazquez',action:'Login',details:'Successful login',timestamp:'2026-02-01T10:30:00Z',ip_address:'192.168.1.1'},{id:'2',user_name:'Gabriel Vazquez',action:'Invoice Created',details:'INV-2026-0042 for $12,500',timestamp:'2026-02-01T09:15:00Z',ip_address:'192.168.1.1'},{id:'3',user_name:'Travis Swank',action:'Time Entry',details:'Logged 8 hours to Project Alpha',timestamp:'2026-01-31T17:00:00Z',ip_address:'192.168.1.2'}]
  return (<div className="space-y-6">
    <SectionCard><SectionHeader title="Authentication" description="Configure how users sign in" /><div className="p-6 space-y-6">
      <div className="flex items-center justify-between"><div><p className="text-white font-medium">Two-Factor Authentication (2FA)</p><p className="text-sm text-slate-400">Require 2FA for all team members</p></div><Toggle enabled={twoFactor} onChange={setTwoFactor} /></div>
      <div className="flex items-center justify-between"><div><p className="text-white font-medium">Session Timeout</p><p className="text-sm text-slate-400">Auto-logout after inactivity</p></div><div className="w-48"><Sel value={timeout} onChange={setTimeout_} options={[{value:'1',label:'1 hour'},{value:'8',label:'8 hours'},{value:'24',label:'24 hours'},{value:'168',label:'7 days'}]} /></div></div>
      <div className="flex items-center justify-between"><div><p className="text-white font-medium">IP Whitelist</p><p className="text-sm text-slate-400">Restrict access to specific IPs</p></div><Toggle enabled={ipWhitelist} onChange={setIpWhitelist} /></div>
    </div></SectionCard>
    <SectionCard><SectionHeader title="SSO" description="Enterprise authentication" /><div className="p-6"><div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-white/[0.08]"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center"><Key size={20} className="text-blue-400" /></div><div><p className="text-white font-medium">SAML 2.0 / SSO</p><p className="text-sm text-slate-400">Okta, Azure AD, Google Workspace</p></div></div><button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg">Configure</button></div><p className="text-xs text-slate-500 mt-3 flex items-center gap-1"><Info size={12} /> Available on Enterprise plan</p></div></SectionCard>
    <SectionCard><SectionHeader title="Audit Log" /><div className="divide-y divide-white/[0.08]">{logs.map(l => <div key={l.id} className="px-6 py-3 flex items-center justify-between hover:bg-white/[0.02]"><div className="flex items-center gap-4"><div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">{l.action==='Login'?<Lock size={14}/>:<FileText size={14}/>}</div><div><p className="text-white text-sm">{l.action}</p><p className="text-xs text-slate-400">{l.user_name} • {l.details}</p></div></div><div className="text-right"><p className="text-xs text-slate-400">{new Date(l.timestamp).toLocaleString()}</p>{l.ip_address&&<p className="text-xs text-slate-500">{l.ip_address}</p>}</div></div>)}</div><div className="px-6 py-4 border-t border-white/[0.08]"><button className="text-emerald-400 text-sm font-medium flex items-center gap-1">View Full Log <ChevronRight size={14} /></button></div></SectionCard>
  </div>)
}

// ====== INTEGRATIONS ======
function IntegrationsSection() {
  const connected = [{id:'1',name:'QuickBooks Online',type:'quickbooks',status:'connected' as const,last_sync:'2026-02-01T10:00:00Z',account_name:'Vantage Consulting'}]
  const available = [{type:'quickbooks',name:'QuickBooks Online',desc:'Sync invoices & expenses',icon:'📊'},{type:'xero',name:'Xero',desc:'Connect Xero accounting',icon:'📘'},{type:'plaid',name:'Plaid',desc:'Direct bank feed',icon:'🏦'},{type:'stripe',name:'Stripe',desc:'Accept payments',icon:'💳'},{type:'slack',name:'Slack',desc:'Get notifications in Slack',icon:'💬'}]
  return (<div className="space-y-6">
    <SectionCard><SectionHeader title="Connected Integrations" /><div className="divide-y divide-white/[0.08]">{connected.map(i => <div key={i.id} className="px-6 py-4 flex items-center justify-between"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-2xl">📊</div><div><div className="flex items-center gap-2"><span className="text-white font-medium">{i.name}</span><StatusBadge status={i.status} /></div><p className="text-sm text-slate-400">{i.account_name}</p></div></div><div className="flex items-center gap-2"><button className="p-2 text-slate-400 hover:text-emerald-400"><RefreshCw size={18} /></button><button className="px-3 py-1.5 text-red-400 hover:bg-red-500/10 rounded-lg text-sm">Disconnect</button></div></div>)}</div></SectionCard>
    <SectionCard><SectionHeader title="Available" /><div className="p-6 grid gap-4">{available.map(a => {const c=connected.find(x=>x.type===a.type); return <div key={a.type} className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-white/[0.08]"><div className="flex items-center gap-4"><div className="w-12 h-12 rounded-xl bg-slate-700/50 flex items-center justify-center text-2xl">{a.icon}</div><div><p className="text-white font-medium">{a.name}</p><p className="text-sm text-slate-400">{a.desc}</p></div></div>{c?<span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm flex items-center gap-1"><CheckCircle2 size={14}/> Connected</span>:<button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg">Connect</button>}</div>})}</div></SectionCard>
    <SectionCard><SectionHeader title="API Access" /><div className="p-6"><div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg"><div><p className="text-white font-medium">API Key</p><p className="text-sm text-slate-400 font-mono">vnt_live_••••••••••••••••</p></div><div className="flex gap-2"><button className="p-2 text-slate-400 hover:text-white"><Copy size={16}/></button><button className="p-2 text-slate-400 hover:text-white"><RefreshCw size={16}/></button></div></div></div></SectionCard>
  </div>)
}

// ====== BILLING ======
function BillingSection() {
  const plans = [{id:'starter',name:'Starter',price:0,features:['Up to 3 users','5 projects','Basic reports']},{id:'professional',name:'Professional',price:49,features:['Up to 15 users','Unlimited projects','Advanced reports','Integrations']},{id:'enterprise',name:'Enterprise',price:199,features:['Unlimited users','Custom reports','SSO/SAML','API access']}]
  return (<div className="space-y-6">
    <SectionCard><SectionHeader title="Current Plan" /><div className="p-6"><div className="flex items-center justify-between"><div><h4 className="text-xl font-semibold text-white">Professional</h4><p className="text-slate-400">$49/month</p></div><span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-medium">Active</span></div></div></SectionCard>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{plans.map(p => <div key={p.id} className={`bg-slate-900/70 rounded-xl border p-6 ${p.id==='professional'?'border-emerald-500':'border-white/[0.08]'}`}><h4 className="text-lg font-semibold text-white">{p.name}</h4><div className="mt-2"><span className="text-3xl font-bold text-white">${p.price}</span><span className="text-slate-400">/mo</span></div><ul className="mt-4 space-y-2">{p.features.map(f=><li key={f} className="flex items-center gap-2 text-sm text-slate-300"><Check size={14} className="text-emerald-400"/>{f}</li>)}</ul><button className={`w-full mt-6 py-2.5 rounded-lg font-medium ${p.id==='professional'?'bg-emerald-500/20 text-emerald-400 cursor-default':'bg-emerald-500 hover:bg-emerald-600 text-white'}`} disabled={p.id==='professional'}>{p.id==='professional'?'Current Plan':'Upgrade'}</button></div>)}</div>
    <SectionCard><SectionHeader title="Payment Method" /><div className="p-6 flex items-center justify-between"><div className="flex items-center gap-4"><div className="w-12 h-8 bg-slate-700 rounded flex items-center justify-center text-white text-xs font-medium">VISA</div><div><p className="text-white">•••• 4242</p><p className="text-sm text-slate-400">Expires 12/27</p></div></div><button className="text-emerald-400 text-sm font-medium">Update</button></div></SectionCard>
  </div>)
}

// ====== DATA & PRIVACY ======
function DataPrivacySection() {
  const [retention, setRetention] = useState('forever')
  return (<div className="space-y-6">
    <SectionCard><SectionHeader title="Data Export" /><div className="p-6 space-y-4">{['transactions','invoices','projects','time_entries','clients','expense_claims'].map(t=><div key={t} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"><div className="flex items-center gap-3"><Database size={16} className="text-slate-400"/><span className="text-white capitalize">{t.replace('_',' ')}</span></div><button className="flex items-center gap-1 text-emerald-400 text-sm"><Download size={14}/> Export CSV</button></div>)}<button className="w-full py-3 border border-emerald-500 text-emerald-400 hover:bg-emerald-500/10 rounded-lg font-medium flex items-center justify-center gap-2"><Download size={16}/> Export All (ZIP)</button></div></SectionCard>
    <SectionCard><SectionHeader title="Danger Zone" /><div className="p-6 space-y-4"><div className="flex items-center justify-between p-4 border border-amber-500/30 rounded-lg bg-amber-500/5"><div><p className="text-white font-medium">Reset All Data</p><p className="text-sm text-slate-400">Delete all transactions, invoices, projects</p></div><button className="px-4 py-2 border border-amber-500 text-amber-500 hover:bg-amber-500/10 rounded-lg font-medium">Reset</button></div><div className="flex items-center justify-between p-4 border border-red-500/30 rounded-lg bg-red-500/5"><div><p className="text-white font-medium">Delete Company</p><p className="text-sm text-slate-400">Permanently delete everything</p></div><button className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500/10 rounded-lg font-medium">Delete</button></div></div></SectionCard>
  </div>)
}

// ====== NOTIFICATIONS — PERSISTS TO SUPABASE ======
function NotificationsSection({ companyId }: { companyId: string }) {
  const [notifs, setNotifs] = useState({invoice_paid:true,invoice_overdue:true,weekly_summary:true,low_cash:true,time_reminder:false,new_team_member:true,expense_submitted:true,expense_approved:true})
  const [channels, setChannels] = useState({email:true,push:false,slack:false})
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const [email, setEmail] = useState('')

  useEffect(() => { (async () => {
    const { data: { user } } = await supabase.auth.getUser(); if (user?.email) setEmail(user.email)
    const { data } = await supabase.from('company_settings').select('notification_preferences').eq('company_id',companyId).single()
    if (data?.notification_preferences) { const p = data.notification_preferences; setNotifs(prev => ({...prev,...p})); if (p.channels) setChannels(prev => ({...prev,...p.channels})) }
  })() }, [companyId])

  const savePrefs = async () => { setSaving(true); await supabase.from('company_settings').upsert({company_id:companyId, notification_preferences:{...notifs,channels}},{onConflict:'company_id'}); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000) }

  const opts = [{key:'invoice_paid',label:'Invoice Paid',desc:'When a client pays'},{key:'invoice_overdue',label:'Invoice Overdue',desc:'When invoice becomes overdue'},{key:'weekly_summary',label:'Weekly Summary',desc:'Weekly email with key metrics'},{key:'low_cash',label:'Low Cash Alert',desc:'When cash drops below threshold'},{key:'time_reminder',label:'Time Reminder',desc:'Daily reminder to log time'},{key:'new_team_member',label:'New Team Member',desc:'When someone joins'},{key:'expense_submitted',label:'Expense Submitted',desc:'When employee submits expense'},{key:'expense_approved',label:'Expense Processed',desc:'When your expense is approved/rejected'}]

  return (<div className="space-y-6">
    <SectionCard><SectionHeader title="Email Notifications" description="Choose what to be notified about" /><div className="divide-y divide-white/[0.08]">{opts.map(o=><div key={o.key} className="px-6 py-4 flex items-center justify-between"><div><p className="text-white font-medium">{o.label}</p><p className="text-sm text-slate-400">{o.desc}</p></div><Toggle enabled={notifs[o.key as keyof typeof notifs]} onChange={v => setNotifs(p=>({...p,[o.key]:v}))} /></div>)}</div></SectionCard>
    <SectionCard><SectionHeader title="Channels" description="Where to receive notifications" /><div className="p-6 space-y-4">
      <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg"><div className="flex items-center gap-3"><Mail size={20} className="text-slate-400"/><div><p className="text-white">Email</p><p className="text-sm text-slate-400">{email||'Your login email'}</p></div></div><Toggle enabled={channels.email} onChange={v=>setChannels(p=>({...p,email:v}))} /></div>
      <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg"><div className="flex items-center gap-3"><Smartphone size={20} className="text-slate-400"/><div><p className="text-white">Push Notifications</p><p className="text-sm text-slate-400">Mobile app</p></div></div><Toggle enabled={channels.push} onChange={v=>setChannels(p=>({...p,push:v}))} /></div>
      <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg"><div className="flex items-center gap-3"><span className="text-xl">💬</span><div><p className="text-white">Slack</p><p className="text-sm text-slate-400">Get alerts in Slack</p></div></div><Toggle enabled={channels.slack} onChange={v=>setChannels(p=>({...p,slack:v}))} /></div>
      <p className="text-xs text-slate-500 flex items-center gap-1"><Info size={12}/> Push & Slack require integrations to be connected.</p>
    </div></SectionCard>
    <div className="flex justify-end"><button onClick={savePrefs} disabled={saving} className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 text-white font-medium rounded-lg flex items-center gap-2">{saving?<RefreshCw size={16} className="animate-spin"/>:saved?<CheckCircle2 size={16}/>:<Save size={16}/>}{saved?'Saved!':'Save Preferences'}</button></div>
  </div>)
}

// ====== LEGAL ======
function LegalSection() {
  const docs = [
    { title: 'Terms of Service', desc: 'Usage terms, liability, and service conditions', href: '/terms', updated: 'February 1, 2026' },
    { title: 'Privacy Policy', desc: 'How we collect, use, and protect your data', href: '/privacy', updated: 'February 1, 2026' },
  ]
  return (<div className="space-y-6">
    <SectionCard><SectionHeader title="Legal Documents" description="Review our terms and policies" /><div className="divide-y divide-white/[0.08]">
      {docs.map(d => <a key={d.href} href={d.href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors group">
        <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-lg bg-slate-800/50 flex items-center justify-center"><FileText size={18} className="text-slate-400 group-hover:text-emerald-400 transition-colors" /></div><div><p className="text-white font-medium">{d.title}</p><p className="text-sm text-slate-400">{d.desc}</p></div></div>
        <div className="flex items-center gap-3"><span className="text-xs text-slate-500">Updated {d.updated}</span><ExternalLink size={16} className="text-slate-500 group-hover:text-emerald-400 transition-colors" /></div>
      </a>)}
    </div></SectionCard>
    <SectionCard><SectionHeader title="Contact" description="Reach our legal and privacy teams" /><div className="p-6 space-y-4">
      <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg"><div className="flex items-center gap-3"><Mail size={18} className="text-slate-400" /><div><p className="text-white font-medium">Legal Inquiries</p><p className="text-sm text-slate-400">Terms, compliance, and general legal questions</p></div></div><a href="mailto:legal@vantagefp.co" className="text-emerald-400 text-sm font-medium hover:underline">legal@vantagefp.co</a></div>
      <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg"><div className="flex items-center gap-3"><Shield size={18} className="text-slate-400" /><div><p className="text-white font-medium">Privacy & Data Requests</p><p className="text-sm text-slate-400">Data access, deletion, and privacy concerns</p></div></div><a href="mailto:privacy@vantagefp.co" className="text-emerald-400 text-sm font-medium hover:underline">privacy@vantagefp.co</a></div>
    </div></SectionCard>
    <SectionCard><SectionHeader title="Data Processing" description="Infrastructure and compliance" /><div className="p-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-800/50 rounded-lg text-center"><p className="text-emerald-400 font-semibold text-lg">TLS 1.2+</p><p className="text-xs text-slate-400 mt-1">Encryption in Transit</p></div>
        <div className="p-4 bg-slate-800/50 rounded-lg text-center"><p className="text-emerald-400 font-semibold text-lg">AES-256</p><p className="text-xs text-slate-400 mt-1">Encryption at Rest</p></div>
        <div className="p-4 bg-slate-800/50 rounded-lg text-center"><p className="text-emerald-400 font-semibold text-lg">RLS</p><p className="text-xs text-slate-400 mt-1">Row-Level Isolation</p></div>
      </div>
      <div className="p-4 bg-slate-800/50 rounded-lg"><p className="text-sm text-slate-300 leading-relaxed">Your financial data is stored on Supabase (PostgreSQL) with Row Level Security ensuring complete data isolation between organizations. Application hosted on Vercel. Authentication handled via Google OAuth 2.0 — we never store passwords. All connections are HTTPS-only.</p></div>
    </div></SectionCard>
  </div>)
}

// ====== MAIN ======
export default function SettingsPage() {
  const [section, setSection] = useState('company'); const [company, setCompany] = useState<Company|null>(null); const [companyId, setCompanyId] = useState<string|null>(null); const [loading, setLoading] = useState(true)

  useEffect(() => { (async () => {
    try { const { data: { user } } = await supabase.auth.getUser(); if (!user) { setLoading(false); return }
    const { data: profile } = await supabase.from('profiles').select('company_id').eq('id',user.id).single()
    if (profile?.company_id) { setCompanyId(profile.company_id); const { data } = await supabase.from('companies').select('*').eq('id',profile.company_id).single(); if (data) setCompany(data) }
    } catch(e) { console.error(e) } finally { setLoading(false) }
  })() }, [])

  const handleSaveCompany = async (updates: Partial<Company>) => { if (!company) return; const { error } = await supabase.from('companies').update(updates).eq('id',company.id); if (!error) { setCompany({...company,...updates}); window.dispatchEvent(new CustomEvent('company-updated', { detail: updates })) } }

  const render = () => { switch(section) {
    case 'company': return <CompanyProfileSection company={company} onSave={handleSaveCompany} />
    case 'team': return companyId ? <TeamSection companyId={companyId} /> : null
    case 'security': return <SecuritySection />
    case 'integrations': return <IntegrationsSection />
    case 'billing': return <BillingSection />
    case 'data': return <DataPrivacySection />
    case 'notifications': return companyId ? <NotificationsSection companyId={companyId} /> : null
    case 'legal': return <LegalSection />
    default: return null
  }}

  if (loading) return <div className="flex items-center justify-center h-[calc(100vh-120px)]"><RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" /></div>

  return (<div className="space-y-6">
    <div><h1 className="text-2xl font-semibold text-white">Settings</h1><p className="text-sm text-slate-400 mt-1">Configure your account and preferences</p></div>
    <div className="flex gap-6">
      <div className="w-64 flex-shrink-0"><nav className="bg-slate-900/70 backdrop-blur-xl rounded-xl border border-white/[0.08] overflow-hidden">
        {SETTINGS_SECTIONS.map(s => <button key={s.id} onClick={() => setSection(s.id)} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${section===s.id ? 'bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500' : 'text-slate-300 hover:bg-white/[0.05] border-l-2 border-transparent'}`}><s.icon size={18}/><span className="font-medium">{s.label}</span></button>)}
      </nav></div>
      <div className="flex-1 min-w-0">{render()}</div>
    </div>
  </div>)
}
