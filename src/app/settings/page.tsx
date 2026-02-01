'use client'

import React, { useState, useEffect } from 'react'
import { 
  Building2, Users, Shield, Link2, CreditCard, Database, Bell, 
  ChevronRight, Check, X, Plus, Trash2, Edit2, Eye, EyeOff,
  RefreshCw, AlertTriangle, Copy, ExternalLink, Key, Lock,
  Mail, Smartphone, Globe, FileText, Download, Upload, Clock,
  UserPlus, Settings2, Zap, CheckCircle2, XCircle, Info
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// ============ TYPES ============
interface Company {
  id: string
  name: string
  legal_name?: string
  ein?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  country?: string
  industry?: string
  fiscal_year_start?: string
  currency?: string
  timezone?: string
  logo_url?: string
  created_at: string
}

interface TeamMember {
  id: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  status: 'active' | 'invited' | 'disabled'
  last_login?: string
  two_factor_enabled?: boolean
}

interface Integration {
  id: string
  name: string
  type: 'quickbooks' | 'xero' | 'plaid' | 'stripe' | 'slack'
  status: 'connected' | 'disconnected' | 'error'
  last_sync?: string
  account_name?: string
}

interface AuditLog {
  id: string
  user_name: string
  action: string
  details: string
  timestamp: string
  ip_address?: string
}

// ============ SETTINGS SECTIONS ============
const SETTINGS_SECTIONS = [
  { id: 'company', label: 'Company Profile', icon: Building2 },
  { id: 'team', label: 'Team & Permissions', icon: Users },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'integrations', label: 'Integrations', icon: Link2 },
  { id: 'billing', label: 'Billing & Plan', icon: CreditCard },
  { id: 'data', label: 'Data & Privacy', icon: Database },
  { id: 'notifications', label: 'Notifications', icon: Bell },
]

const ROLE_PERMISSIONS = {
  owner: { label: 'Owner', description: 'Full access, can delete company', color: 'text-purple-400' },
  admin: { label: 'Admin', description: 'Full access except billing & delete', color: 'text-emerald-400' },
  member: { label: 'Member', description: 'Can edit data, view reports', color: 'text-blue-400' },
  viewer: { label: 'Viewer', description: 'Read-only access', color: 'text-slate-400' },
}

const INDUSTRIES = [
  'Consulting', 'Technology', 'Construction', 'Healthcare', 'Legal', 
  'Marketing', 'Financial Services', 'Real Estate', 'Manufacturing', 'Other'
]

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Puerto_Rico', label: 'Atlantic Time (AT)' },
  { value: 'Europe/Madrid', label: 'Central European Time (CET)' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT)' },
]

// ============ COMPONENTS ============
function SectionCard({ children, className = '' }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`bg-slate-900/70 backdrop-blur-xl rounded-xl border border-white/[0.08] ${className}`}>
      {children}
    </div>
  )
}

function SectionHeader({ title, description }: { title: string, description?: string }) {
  return (
    <div className="px-6 py-4 border-b border-white/[0.08]">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
    </div>
  )
}

function FormField({ label, children, hint }: { label: string, children: React.ReactNode, hint?: string }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-slate-300">{label}</label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', disabled = false }: { 
  value: string, onChange: (v: string) => void, placeholder?: string, type?: string, disabled?: boolean 
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/[0.08] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
    />
  )
}

function Select({ value, onChange, options, placeholder }: { 
  value: string, onChange: (v: string) => void, options: { value: string, label: string }[], placeholder?: string 
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-2.5 bg-slate-800/50 border border-white/[0.08] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 appearance-none"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
    </select>
  )
}

function Toggle({ enabled, onChange }: { enabled: boolean, onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function StatusBadge({ status }: { status: 'connected' | 'disconnected' | 'error' | 'active' | 'invited' | 'disabled' }) {
  const styles = {
    connected: 'bg-emerald-500/20 text-emerald-400',
    active: 'bg-emerald-500/20 text-emerald-400',
    disconnected: 'bg-slate-500/20 text-slate-400',
    invited: 'bg-amber-500/20 text-amber-400',
    disabled: 'bg-red-500/20 text-red-400',
    error: 'bg-red-500/20 text-red-400',
  }
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// ============ COMPANY PROFILE SECTION ============
function CompanyProfileSection({ company, onSave }: { company: Company | null, onSave: (c: Partial<Company>) => void }) {
  const [form, setForm] = useState({
    name: company?.name || '',
    legal_name: company?.legal_name || '',
    ein: company?.ein || '',
    address: company?.address || '',
    city: company?.city || '',
    state: company?.state || '',
    zip: company?.zip || '',
    country: company?.country || 'US',
    industry: company?.industry || '',
    fiscal_year_start: company?.fiscal_year_start || '01',
    currency: company?.currency || 'USD',
    timezone: company?.timezone || 'America/New_York',
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <SectionCard>
        <SectionHeader title="Company Information" description="Basic details about your business" />
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField label="Company Name" hint="Display name used throughout the app">
              <Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Acme Consulting" />
            </FormField>
            <FormField label="Legal Name" hint="Official registered business name">
              <Input value={form.legal_name} onChange={(v) => setForm({ ...form, legal_name: v })} placeholder="Acme Consulting LLC" />
            </FormField>
            <FormField label="EIN / Tax ID">
              <Input value={form.ein} onChange={(v) => setForm({ ...form, ein: v })} placeholder="XX-XXXXXXX" />
            </FormField>
            <FormField label="Industry">
              <Select 
                value={form.industry} 
                onChange={(v) => setForm({ ...form, industry: v })} 
                options={INDUSTRIES.map(i => ({ value: i, label: i }))}
                placeholder="Select industry"
              />
            </FormField>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeader title="Address" />
        <div className="p-6 space-y-6">
          <FormField label="Street Address">
            <Input value={form.address} onChange={(v) => setForm({ ...form, address: v })} placeholder="123 Business St" />
          </FormField>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <FormField label="City">
              <Input value={form.city} onChange={(v) => setForm({ ...form, city: v })} placeholder="San Juan" />
            </FormField>
            <FormField label="State">
              <Input value={form.state} onChange={(v) => setForm({ ...form, state: v })} placeholder="PR" />
            </FormField>
            <FormField label="ZIP">
              <Input value={form.zip} onChange={(v) => setForm({ ...form, zip: v })} placeholder="00901" />
            </FormField>
            <FormField label="Country">
              <Select 
                value={form.country} 
                onChange={(v) => setForm({ ...form, country: v })} 
                options={[{ value: 'US', label: 'United States' }, { value: 'ES', label: 'Spain' }]}
              />
            </FormField>
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeader title="Financial Settings" description="Configure how financial data is displayed" />
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField label="Fiscal Year Start">
              <Select 
                value={form.fiscal_year_start} 
                onChange={(v) => setForm({ ...form, fiscal_year_start: v })} 
                options={[
                  { value: '01', label: 'January' }, { value: '04', label: 'April' },
                  { value: '07', label: 'July' }, { value: '10', label: 'October' }
                ]}
              />
            </FormField>
            <FormField label="Currency">
              <Select 
                value={form.currency} 
                onChange={(v) => setForm({ ...form, currency: v })} 
                options={[{ value: 'USD', label: 'USD ($)' }, { value: 'EUR', label: 'EUR (€)' }]}
              />
            </FormField>
            <FormField label="Timezone">
              <Select 
                value={form.timezone} 
                onChange={(v) => setForm({ ...form, timezone: v })} 
                options={TIMEZONES}
              />
            </FormField>
          </div>
        </div>
      </SectionCard>

      <div className="flex justify-end">
        <button 
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {saving ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
          Save Changes
        </button>
      </div>
    </div>
  )
}

// ============ TEAM SECTION ============
function TeamSection() {
  const [members, setMembers] = useState<TeamMember[]>([
    { id: '1', name: 'Gabriel Vazquez', email: 'gabriel@example.com', role: 'owner', status: 'active', two_factor_enabled: true, last_login: '2026-02-01T10:30:00Z' },
    { id: '2', name: 'Travis Swank', email: 'travis@example.com', role: 'admin', status: 'active', two_factor_enabled: false, last_login: '2026-01-31T15:45:00Z' },
  ])
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member')

  const handleInvite = () => {
    if (!inviteEmail) return
    setMembers([...members, {
      id: `temp_${Date.now()}`,
      name: inviteEmail.split('@')[0],
      email: inviteEmail,
      role: inviteRole,
      status: 'invited',
    }])
    setInviteEmail('')
    setShowInvite(false)
  }

  return (
    <div className="space-y-6">
      <SectionCard>
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Team Members</h3>
            <p className="text-sm text-slate-400 mt-1">{members.length} members</p>
          </div>
          <button 
            onClick={() => setShowInvite(true)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            <UserPlus size={16} /> Invite Member
          </button>
        </div>
        <div className="divide-y divide-white/[0.08]">
          {members.map(member => (
            <div key={member.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white font-medium">
                  {member.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{member.name}</span>
                    <span className={`text-xs ${ROLE_PERMISSIONS[member.role].color}`}>
                      {ROLE_PERMISSIONS[member.role].label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {member.two_factor_enabled && (
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <Shield size={12} /> 2FA
                  </span>
                )}
                <StatusBadge status={member.status} />
                {member.role !== 'owner' && (
                  <button className="p-2 text-slate-400 hover:text-red-400 transition-colors">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {showInvite && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-slate-900 border border-white/[0.08] rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Invite Team Member</h3>
            <div className="space-y-4">
              <FormField label="Email Address">
                <Input value={inviteEmail} onChange={setInviteEmail} placeholder="team@example.com" type="email" />
              </FormField>
              <FormField label="Role">
                <Select 
                  value={inviteRole}
                  onChange={(v) => setInviteRole(v as 'admin' | 'member' | 'viewer')}
                  options={[
                    { value: 'admin', label: 'Admin - Full access except billing' },
                    { value: 'member', label: 'Member - Edit data, view reports' },
                    { value: 'viewer', label: 'Viewer - Read-only access' },
                  ]}
                />
              </FormField>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowInvite(false)} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button onClick={handleInvite} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors">
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}

      <SectionCard>
        <SectionHeader title="Role Permissions" description="What each role can access" />
        <div className="p-6 space-y-4">
          {Object.entries(ROLE_PERMISSIONS).map(([key, perm]) => (
            <div key={key} className="flex items-center justify-between py-2">
              <div>
                <span className={`font-medium ${perm.color}`}>{perm.label}</span>
                <p className="text-sm text-slate-400">{perm.description}</p>
              </div>
              <div className="flex gap-2">
                {['Dashboard', 'Invoices', 'Projects', 'Reports', 'Settings'].map(feature => (
                  <span 
                    key={feature}
                    className={`px-2 py-1 rounded text-xs ${
                      (key === 'owner' || key === 'admin') ? 'bg-emerald-500/20 text-emerald-400' :
                      (key === 'member' && feature !== 'Settings') ? 'bg-emerald-500/20 text-emerald-400' :
                      (key === 'viewer' && ['Dashboard', 'Reports'].includes(feature)) ? 'bg-blue-500/20 text-blue-400' :
                      'bg-slate-700/50 text-slate-500'
                    }`}
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

// ============ SECURITY SECTION ============
function SecuritySection() {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true)
  const [sessionTimeout, setSessionTimeout] = useState('24')
  const [ipWhitelist, setIpWhitelist] = useState(false)
  const [auditLogs] = useState<AuditLog[]>([
    { id: '1', user_name: 'Gabriel Vazquez', action: 'Login', details: 'Successful login', timestamp: '2026-02-01T10:30:00Z', ip_address: '192.168.1.1' },
    { id: '2', user_name: 'Gabriel Vazquez', action: 'Invoice Created', details: 'INV-2026-0042 for $12,500', timestamp: '2026-02-01T09:15:00Z', ip_address: '192.168.1.1' },
    { id: '3', user_name: 'Travis Swank', action: 'Time Entry', details: 'Logged 8 hours to Project Alpha', timestamp: '2026-01-31T17:00:00Z', ip_address: '192.168.1.2' },
  ])

  return (
    <div className="space-y-6">
      <SectionCard>
        <SectionHeader title="Authentication" description="Configure how users sign in" />
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Two-Factor Authentication (2FA)</p>
              <p className="text-sm text-slate-400">Require 2FA for all team members</p>
            </div>
            <Toggle enabled={twoFactorEnabled} onChange={setTwoFactorEnabled} />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Session Timeout</p>
              <p className="text-sm text-slate-400">Auto-logout after inactivity</p>
            </div>
            <div className="w-48">
              <Select 
                value={sessionTimeout}
                onChange={setSessionTimeout}
                options={[
                  { value: '1', label: '1 hour' },
                  { value: '8', label: '8 hours' },
                  { value: '24', label: '24 hours' },
                  { value: '168', label: '7 days' },
                ]}
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">IP Whitelist</p>
              <p className="text-sm text-slate-400">Restrict access to specific IP addresses</p>
            </div>
            <Toggle enabled={ipWhitelist} onChange={setIpWhitelist} />
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeader title="Single Sign-On (SSO)" description="Enterprise authentication" />
        <div className="p-6">
          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-white/[0.08]">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <Key size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-white font-medium">SAML 2.0 / SSO</p>
                <p className="text-sm text-slate-400">Connect with Okta, Azure AD, Google Workspace</p>
              </div>
            </div>
            <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors">
              Configure
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
            <Info size={12} /> Available on Enterprise plan
          </p>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeader title="Audit Log" description="Recent activity in your account" />
        <div className="divide-y divide-white/[0.08]">
          {auditLogs.map(log => (
            <div key={log.id} className="px-6 py-3 flex items-center justify-between hover:bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                  {log.action === 'Login' ? <Lock size={14} /> : <FileText size={14} />}
                </div>
                <div>
                  <p className="text-white text-sm">{log.action}</p>
                  <p className="text-xs text-slate-400">{log.user_name} • {log.details}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleString()}</p>
                {log.ip_address && <p className="text-xs text-slate-500">{log.ip_address}</p>}
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-white/[0.08]">
          <button className="text-emerald-400 hover:text-emerald-300 text-sm font-medium flex items-center gap-1">
            View Full Audit Log <ChevronRight size={14} />
          </button>
        </div>
      </SectionCard>
    </div>
  )
}

// ============ INTEGRATIONS SECTION ============
function IntegrationsSection() {
  const [integrations, setIntegrations] = useState<Integration[]>([
    { id: '1', name: 'QuickBooks Online', type: 'quickbooks', status: 'connected', last_sync: '2026-02-01T10:00:00Z', account_name: 'Vantage Consulting' },
  ])

  const availableIntegrations = [
    { type: 'quickbooks', name: 'QuickBooks Online', description: 'Sync invoices, expenses, and chart of accounts', icon: '📊' },
    { type: 'xero', name: 'Xero', description: 'Connect your Xero accounting software', icon: '📘' },
    { type: 'plaid', name: 'Plaid', description: 'Direct bank feed for real-time transactions', icon: '🏦' },
    { type: 'stripe', name: 'Stripe', description: 'Accept payments and sync revenue', icon: '💳' },
    { type: 'slack', name: 'Slack', description: 'Get notifications in your Slack workspace', icon: '💬' },
  ]

  const handleDisconnect = (id: string) => {
    setIntegrations(integrations.map(i => i.id === id ? { ...i, status: 'disconnected' as const } : i))
  }

  const handleSync = (id: string) => {
    setIntegrations(integrations.map(i => i.id === id ? { ...i, last_sync: new Date().toISOString() } : i))
  }

  return (
    <div className="space-y-6">
      <SectionCard>
        <SectionHeader title="Connected Integrations" description="Manage your active connections" />
        {integrations.filter(i => i.status === 'connected').length > 0 ? (
          <div className="divide-y divide-white/[0.08]">
            {integrations.filter(i => i.status === 'connected').map(integration => (
              <div key={integration.id} className="px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-2xl">
                    📊
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{integration.name}</span>
                      <StatusBadge status={integration.status} />
                    </div>
                    <p className="text-sm text-slate-400">
                      {integration.account_name} • Last synced {integration.last_sync ? new Date(integration.last_sync).toLocaleString() : 'Never'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleSync(integration.id)}
                    className="p-2 text-slate-400 hover:text-emerald-400 transition-colors"
                    title="Sync Now"
                  >
                    <RefreshCw size={18} />
                  </button>
                  <button 
                    onClick={() => handleDisconnect(integration.id)}
                    className="px-3 py-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-8 text-center">
            <p className="text-slate-400">No integrations connected yet</p>
          </div>
        )}
      </SectionCard>

      <SectionCard>
        <SectionHeader title="Available Integrations" description="Connect additional services" />
        <div className="p-6 grid gap-4">
          {availableIntegrations.map(integration => {
            const isConnected = integrations.find(i => i.type === integration.type && i.status === 'connected')
            return (
              <div 
                key={integration.type}
                className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-white/[0.08] hover:border-white/[0.15] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-slate-700/50 flex items-center justify-center text-2xl">
                    {integration.icon}
                  </div>
                  <div>
                    <p className="text-white font-medium">{integration.name}</p>
                    <p className="text-sm text-slate-400">{integration.description}</p>
                  </div>
                </div>
                {isConnected ? (
                  <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm font-medium flex items-center gap-1">
                    <CheckCircle2 size={14} /> Connected
                  </span>
                ) : (
                  <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors">
                    Connect
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeader title="API Access" description="Programmatic access to your data" />
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
            <div>
              <p className="text-white font-medium">API Key</p>
              <p className="text-sm text-slate-400 font-mono">vnt_live_••••••••••••••••</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 text-slate-400 hover:text-white transition-colors" title="Copy">
                <Copy size={16} />
              </button>
              <button className="p-2 text-slate-400 hover:text-white transition-colors" title="Regenerate">
                <RefreshCw size={16} />
              </button>
            </div>
          </div>
          <a href="#" className="text-emerald-400 hover:text-emerald-300 text-sm font-medium flex items-center gap-1">
            View API Documentation <ExternalLink size={14} />
          </a>
        </div>
      </SectionCard>
    </div>
  )
}

// ============ BILLING SECTION ============
function BillingSection() {
  const currentPlan = 'professional'
  
  const plans = [
    { id: 'starter', name: 'Starter', price: 0, features: ['Up to 3 users', '5 projects', 'Basic reports', 'Email support'] },
    { id: 'professional', name: 'Professional', price: 49, features: ['Up to 15 users', 'Unlimited projects', 'Advanced reports', 'Priority support', 'Integrations'] },
    { id: 'enterprise', name: 'Enterprise', price: 199, features: ['Unlimited users', 'Unlimited projects', 'Custom reports', 'Dedicated support', 'SSO/SAML', 'API access', 'Audit logs'] },
  ]

  return (
    <div className="space-y-6">
      <SectionCard>
        <SectionHeader title="Current Plan" />
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xl font-semibold text-white">Professional</h4>
              <p className="text-slate-400">$49/month • Billed monthly</p>
            </div>
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-medium">Active</span>
          </div>
          <div className="mt-4 pt-4 border-t border-white/[0.08] flex items-center justify-between">
            <p className="text-sm text-slate-400">Next billing date: March 1, 2026</p>
            <button className="text-emerald-400 hover:text-emerald-300 text-sm font-medium">
              View Invoices
            </button>
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map(plan => (
          <div 
            key={plan.id}
            className={`bg-slate-900/70 backdrop-blur-xl rounded-xl border p-6 ${
              plan.id === currentPlan ? 'border-emerald-500' : 'border-white/[0.08]'
            }`}
          >
            <h4 className="text-lg font-semibold text-white">{plan.name}</h4>
            <div className="mt-2">
              <span className="text-3xl font-bold text-white">${plan.price}</span>
              <span className="text-slate-400">/month</span>
            </div>
            <ul className="mt-4 space-y-2">
              {plan.features.map(feature => (
                <li key={feature} className="flex items-center gap-2 text-sm text-slate-300">
                  <Check size={14} className="text-emerald-400" /> {feature}
                </li>
              ))}
            </ul>
            <button 
              className={`w-full mt-6 py-2.5 rounded-lg font-medium transition-colors ${
                plan.id === currentPlan 
                  ? 'bg-emerald-500/20 text-emerald-400 cursor-default' 
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white'
              }`}
              disabled={plan.id === currentPlan}
            >
              {plan.id === currentPlan ? 'Current Plan' : 'Upgrade'}
            </button>
          </div>
        ))}
      </div>

      <SectionCard>
        <SectionHeader title="Payment Method" />
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-8 bg-slate-700 rounded flex items-center justify-center text-white text-xs font-medium">
              VISA
            </div>
            <div>
              <p className="text-white">•••• •••• •••• 4242</p>
              <p className="text-sm text-slate-400">Expires 12/27</p>
            </div>
          </div>
          <button className="text-emerald-400 hover:text-emerald-300 text-sm font-medium">
            Update
          </button>
        </div>
      </SectionCard>
    </div>
  )
}

// ============ DATA & PRIVACY SECTION ============
function DataPrivacySection() {
  const [dataRetention, setDataRetention] = useState('forever')

  return (
    <div className="space-y-6">
      <SectionCard>
        <SectionHeader title="Data Export" description="Download a copy of your data" />
        <div className="p-6 space-y-4">
          {['transactions', 'invoices', 'projects', 'time_entries', 'clients'].map(table => (
            <div key={table} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Database size={16} className="text-slate-400" />
                <span className="text-white capitalize">{table.replace('_', ' ')}</span>
              </div>
              <button className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 text-sm">
                <Download size={14} /> Export CSV
              </button>
            </div>
          ))}
          <button className="w-full py-3 border border-emerald-500 text-emerald-400 hover:bg-emerald-500/10 rounded-lg font-medium transition-colors flex items-center justify-center gap-2">
            <Download size={16} /> Export All Data (ZIP)
          </button>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeader title="Data Retention" description="How long we keep your data" />
        <div className="p-6">
          <FormField label="Retention Period">
            <Select 
              value={dataRetention}
              onChange={setDataRetention}
              options={[
                { value: '1year', label: '1 year' },
                { value: '3years', label: '3 years' },
                { value: '7years', label: '7 years (recommended for tax)' },
                { value: 'forever', label: 'Keep forever' },
              ]}
            />
          </FormField>
          <p className="text-xs text-slate-500 mt-2">
            Data older than the retention period will be archived and available upon request.
          </p>
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeader title="Danger Zone" description="Irreversible actions" />
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-4 border border-amber-500/30 rounded-lg bg-amber-500/5">
            <div>
              <p className="text-white font-medium">Reset All Data</p>
              <p className="text-sm text-slate-400">Delete all transactions, invoices, and projects</p>
            </div>
            <button className="px-4 py-2 border border-amber-500 text-amber-500 hover:bg-amber-500/10 rounded-lg font-medium transition-colors">
              Reset Data
            </button>
          </div>
          <div className="flex items-center justify-between p-4 border border-red-500/30 rounded-lg bg-red-500/5">
            <div>
              <p className="text-white font-medium">Delete Company</p>
              <p className="text-sm text-slate-400">Permanently delete this company and all data</p>
            </div>
            <button className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500/10 rounded-lg font-medium transition-colors">
              Delete Company
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

// ============ NOTIFICATIONS SECTION ============
function NotificationsSection() {
  const [notifications, setNotifications] = useState({
    invoice_paid: true,
    invoice_overdue: true,
    weekly_summary: true,
    low_cash: true,
    time_reminder: false,
    new_team_member: true,
  })

  const updateNotification = (key: string, value: boolean) => {
    setNotifications({ ...notifications, [key]: value })
  }

  const notificationOptions = [
    { key: 'invoice_paid', label: 'Invoice Paid', description: 'When a client pays an invoice' },
    { key: 'invoice_overdue', label: 'Invoice Overdue', description: 'When an invoice becomes overdue' },
    { key: 'weekly_summary', label: 'Weekly Summary', description: 'Weekly email with key metrics' },
    { key: 'low_cash', label: 'Low Cash Alert', description: 'When cash drops below threshold' },
    { key: 'time_reminder', label: 'Time Tracking Reminder', description: 'Daily reminder to log time' },
    { key: 'new_team_member', label: 'New Team Member', description: 'When someone joins the team' },
  ]

  return (
    <div className="space-y-6">
      <SectionCard>
        <SectionHeader title="Email Notifications" description="Choose what you want to be notified about" />
        <div className="divide-y divide-white/[0.08]">
          {notificationOptions.map(opt => (
            <div key={opt.key} className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-white font-medium">{opt.label}</p>
                <p className="text-sm text-slate-400">{opt.description}</p>
              </div>
              <Toggle 
                enabled={notifications[opt.key as keyof typeof notifications]} 
                onChange={(v) => updateNotification(opt.key, v)} 
              />
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeader title="Notification Channels" description="Where to receive notifications" />
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Mail size={20} className="text-slate-400" />
              <div>
                <p className="text-white">Email</p>
                <p className="text-sm text-slate-400">gabriel@example.com</p>
              </div>
            </div>
            <StatusBadge status="active" />
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Smartphone size={20} className="text-slate-400" />
              <div>
                <p className="text-white">Push Notifications</p>
                <p className="text-sm text-slate-400">Mobile app notifications</p>
              </div>
            </div>
            <button className="text-emerald-400 hover:text-emerald-300 text-sm font-medium">
              Enable
            </button>
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-xl">💬</span>
              <div>
                <p className="text-white">Slack</p>
                <p className="text-sm text-slate-400">Get alerts in Slack</p>
              </div>
            </div>
            <button className="text-emerald-400 hover:text-emerald-300 text-sm font-medium">
              Connect
            </button>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

// ============ MAIN PAGE ============
export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('company')
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setLoading(false); return }
        
        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
        if (profile?.company_id) {
          const { data: companyData } = await supabase.from('companies').select('*').eq('id', profile.company_id).single()
          if (companyData) setCompany(companyData)
        }
      } catch (error) {
        console.error('Error loading settings:', error)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  const handleSaveCompany = async (updates: Partial<Company>) => {
    if (!company) return
    await supabase.from('companies').update(updates).eq('id', company.id)
    setCompany({ ...company, ...updates })
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'company': return <CompanyProfileSection company={company} onSave={handleSaveCompany} />
      case 'team': return <TeamSection />
      case 'security': return <SecuritySection />
      case 'integrations': return <IntegrationsSection />
      case 'billing': return <BillingSection />
      case 'data': return <DataPrivacySection />
      case 'notifications': return <NotificationsSection />
      default: return null
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">Configure your account and preferences</p>
      </div>

      <div className="flex gap-6">
        <div className="w-64 flex-shrink-0">
          <nav className="bg-slate-900/70 backdrop-blur-xl rounded-xl border border-white/[0.08] overflow-hidden">
            {SETTINGS_SECTIONS.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                  activeSection === section.id 
                    ? 'bg-emerald-500/10 text-emerald-400 border-l-2 border-emerald-500' 
                    : 'text-slate-300 hover:bg-white/[0.05] border-l-2 border-transparent'
                }`}
              >
                <section.icon size={18} />
                <span className="font-medium">{section.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 min-w-0">
          {renderSection()}
        </div>
      </div>
    </div>
  )
}
