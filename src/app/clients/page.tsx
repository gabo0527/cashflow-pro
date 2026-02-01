'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  Search, Filter, Download, ChevronDown, ChevronRight, ChevronUp,
  Users, Plus, Edit2, X, Archive, Building2, DollarSign, FileText,
  Mail, Phone, AlertTriangle, TrendingUp, TrendingDown, Clock,
  Star, Target, Activity, AlertCircle, CheckCircle, Zap, RefreshCw,
  Calendar, Briefcase, ArrowUpRight, ArrowDownRight, Eye, Crown,
  ExternalLink, PieChart as PieChartIcon
} from 'lucide-react'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, Legend
} from 'recharts'
import { supabase, getCurrentUser, fetchClients, fetchProjects, fetchInvoices } from '@/lib/supabase'
import Link from 'next/link'

// ============ GLASSMORPHISM THEME ============
const THEME = {
  glass: 'bg-slate-900/70 backdrop-blur-xl',
  glassBorder: 'border-white/[0.08]',
  glassHover: 'hover:bg-white/[0.05] hover:border-white/[0.12]',
  textPrimary: 'text-white',
  textSecondary: 'text-slate-300',
  textMuted: 'text-slate-400',
  textDim: 'text-slate-500',
}

// ============ TYPES ============
interface Client {
  id: string
  name: string
  contact_name?: string
  email?: string
  phone?: string
  payment_terms: string
  status: 'active' | 'inactive' | 'archived'
  created_at?: string
  notes?: string
}

interface Project {
  id: string
  name: string
  client: string
  client_id?: string
  status: string
  budget: number
  spent: number
  start_date?: string
}

interface Invoice {
  id: string
  client: string
  client_id?: string
  amount: number
  amount_paid: number
  balance_due: number
  invoice_date: string
  due_date?: string
  paid_date?: string
  status?: string
}

interface EnrichedClient extends Client {
  healthScore: number
  tier: 'A' | 'B' | 'C'
  ltv: number
  concentration: number
  avgPayDays: number
  margin: number
  activeProjects: number
  totalProjects: number
  totalRevenue: number
  outstandingAR: number
  lastActivity: string | null
  riskFlags: string[]
}

// ============ UTILITIES ============
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

const formatCompactCurrency = (value: number): string => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`
  return `$${value}`
}

const formatPercent = (value: number): string => `${value.toFixed(1)}%`

const daysSince = (date: string | null): number => {
  if (!date) return 999
  const diff = new Date().getTime() - new Date(date).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

// ============ CONSTANTS ============
const STATUS_OPTIONS = [
  { id: 'active', label: 'Active', color: 'emerald' },
  { id: 'inactive', label: 'Inactive', color: 'amber' },
  { id: 'archived', label: 'Archived', color: 'slate' },
]

const PAYMENT_TERMS = [
  { id: 'due_on_receipt', label: 'Due on Receipt', days: 0 },
  { id: 'net_15', label: 'Net 15', days: 15 },
  { id: 'net_30', label: 'Net 30', days: 30 },
  { id: 'net_45', label: 'Net 45', days: 45 },
  { id: 'net_60', label: 'Net 60', days: 60 },
]

const TIER_CONFIG = {
  A: { label: 'Tier A', color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30', icon: Crown },
  B: { label: 'Tier B', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30', icon: Star },
  C: { label: 'Tier C', color: 'text-slate-400', bg: 'bg-slate-500/20', border: 'border-slate-500/30', icon: Building2 },
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

const getStatusStyle = (status: string) => {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    active: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
    inactive: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
    archived: { bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30' },
  }
  return styles[status] || styles.active
}

const getHealthColor = (score: number) => {
  if (score >= 80) return { bg: 'bg-emerald-500/20', text: 'text-emerald-400', fill: '#10b981' }
  if (score >= 60) return { bg: 'bg-amber-500/20', text: 'text-amber-400', fill: '#f59e0b' }
  return { bg: 'bg-rose-500/20', text: 'text-rose-400', fill: '#ef4444' }
}

// ============ CLIENT HEALTH SCORE CALCULATION ============
function calculateClientHealth(
  client: Client,
  projects: Project[],
  invoices: Invoice[],
  totalPortfolioRevenue: number
): { score: number; flags: string[] } {
  const flags: string[] = []
  let score = 100

  const clientProjects = projects.filter(p => p.client?.toLowerCase() === client.name?.toLowerCase())
  const clientInvoices = invoices.filter(i => i.client?.toLowerCase() === client.name?.toLowerCase())
  
  // 1. Payment Behavior (40 points)
  const termsDays = PAYMENT_TERMS.find(t => t.id === client.payment_terms)?.days || 30
  const paidInvoices = clientInvoices.filter(i => i.paid_date && i.invoice_date)
  
  if (paidInvoices.length > 0) {
    const avgPayDays = paidInvoices.reduce((sum, inv) => {
      const invoiceDate = new Date(inv.invoice_date)
      const paidDate = new Date(inv.paid_date!)
      return sum + Math.max(0, (paidDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
    }, 0) / paidInvoices.length
    
    if (avgPayDays > termsDays + 30) {
      score -= 40
      flags.push('Slow payer (30+ days late)')
    } else if (avgPayDays > termsDays + 15) {
      score -= 25
      flags.push('Late payments')
    } else if (avgPayDays > termsDays) {
      score -= 10
    }
  }

  // Outstanding AR penalty
  const outstandingAR = clientInvoices.reduce((sum, i) => sum + (i.balance_due || 0), 0)
  const totalBilled = clientInvoices.reduce((sum, i) => sum + (i.amount || 0), 0)
  if (totalBilled > 0 && outstandingAR / totalBilled > 0.5) {
    score -= 15
    flags.push('High outstanding AR')
  }

  // 2. Profitability (30 points)
  const totalBudget = clientProjects.reduce((sum, p) => sum + (p.budget || 0), 0)
  const totalSpent = clientProjects.reduce((sum, p) => sum + (p.spent || 0), 0)
  const margin = totalBudget > 0 ? ((totalBudget - totalSpent) / totalBudget) * 100 : 0
  
  if (margin < 0) {
    score -= 30
    flags.push('Negative margin')
  } else if (margin < 10) {
    score -= 20
    flags.push('Low margin (<10%)')
  } else if (margin < 20) {
    score -= 10
  }

  // 3. Engagement (20 points)
  const activeProjects = clientProjects.filter(p => p.status === 'active').length
  const lastInvoiceDate = clientInvoices.length > 0 
    ? clientInvoices.sort((a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime())[0]?.invoice_date
    : null
  const daysSinceActivity = daysSince(lastInvoiceDate)
  
  if (activeProjects === 0 && daysSinceActivity > 180) {
    score -= 20
    flags.push('No activity in 6+ months')
  } else if (activeProjects === 0 && daysSinceActivity > 90) {
    score -= 10
    flags.push('Dormant (90+ days)')
  }

  // 4. Concentration Risk (10 points)
  const clientRevenue = clientInvoices.reduce((sum, i) => sum + (i.amount || 0), 0)
  const concentration = totalPortfolioRevenue > 0 ? (clientRevenue / totalPortfolioRevenue) * 100 : 0
  
  if (concentration > 30) {
    score -= 10
    flags.push('High concentration (>30%)')
  } else if (concentration > 20) {
    score -= 5
    flags.push('Concentration risk (>20%)')
  }

  return { score: Math.max(0, Math.min(100, score)), flags }
}

// Calculate Client Tier based on LTV + Margin + Engagement
function calculateTier(ltv: number, margin: number, activeProjects: number, maxLTV: number): 'A' | 'B' | 'C' {
  const ltvScore = maxLTV > 0 ? (ltv / maxLTV) * 40 : 0
  const marginScore = margin >= 20 ? 30 : margin >= 10 ? 20 : margin >= 0 ? 10 : 0
  const engagementScore = activeProjects >= 3 ? 30 : activeProjects >= 1 ? 20 : 10
  
  const totalScore = ltvScore + marginScore + engagementScore
  
  if (totalScore >= 70) return 'A'
  if (totalScore >= 40) return 'B'
  return 'C'
}

// ============ COMPONENTS ============

// Glass Metric Card
function MetricCard({ label, value, subtitle, icon: Icon, color = 'emerald', trend }: { 
  label: string; value: string | number; subtitle?: string; icon: any; color?: string; trend?: 'up' | 'down' | null
}) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400',
    rose: 'text-rose-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    slate: 'text-slate-300',
  }

  return (
    <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-4 ${THEME.glassHover} transition-all`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`text-xs font-medium ${THEME.textMuted} uppercase tracking-wide`}>{label}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className={`text-2xl font-semibold ${colorMap[color] || colorMap.emerald}`}>{value}</p>
            {trend && (
              <span className={trend === 'up' ? 'text-emerald-400' : 'text-rose-400'}>
                {trend === 'up' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
              </span>
            )}
          </div>
          {subtitle && <p className={`text-xs ${THEME.textDim} mt-0.5`}>{subtitle}</p>}
        </div>
        <div className="p-2 rounded-lg bg-white/[0.05]">
          <Icon size={18} className={THEME.textMuted} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  )
}

// Custom Tooltip for Charts
const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-lg px-3 py-2 shadow-xl`}>
      <p className={`text-xs ${THEME.textDim} mb-1`}>{payload[0]?.payload?.fullName || label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm font-medium" style={{ color: entry.color || entry.fill }}>
          {entry.name}: {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  )
}

// Tier Badge
function TierBadge({ tier }: { tier: 'A' | 'B' | 'C' }) {
  const config = TIER_CONFIG[tier]
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${config.bg} ${config.color} border ${config.border}`}>
      <Icon size={12} />
      {tier}
    </span>
  )
}

// Health Score Badge
function HealthBadge({ score }: { score: number }) {
  const color = getHealthColor(score)
  return (
    <span className={`inline-flex items-center justify-center w-9 h-6 rounded text-xs font-bold ${color.bg} ${color.text}`}>
      {Math.round(score)}
    </span>
  )
}

// Risk Indicator
function RiskIndicator({ flags }: { flags: string[] }) {
  if (flags.length === 0) return <CheckCircle size={14} className="text-emerald-400" />
  
  return (
    <div className="relative group">
      <AlertTriangle size={14} className="text-rose-400 cursor-help" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-lg px-3 py-2 shadow-xl min-w-[180px]`}>
          <p className={`text-xs font-medium ${THEME.textPrimary} mb-1`}>Risk Alerts</p>
          {flags.map((flag, i) => (
            <p key={i} className={`text-xs ${THEME.textMuted}`}>• {flag}</p>
          ))}
        </div>
      </div>
    </div>
  )
}

// Collapsible Section Component
function CollapsibleSection({ 
  title, 
  children, 
  defaultExpanded = true,
  badge,
  icon
}: { 
  title: string
  children: React.ReactNode
  defaultExpanded?: boolean
  badge?: string | number
  icon?: React.ReactNode
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  
  return (
    <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon && <span className={THEME.textMuted}>{icon}</span>}
          <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>{title}</h3>
          {badge !== undefined && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-white/[0.08] text-slate-300">
              {badge}
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp size={18} className={THEME.textMuted} /> : <ChevronDown size={18} className={THEME.textMuted} />}
      </button>
      {isExpanded && <div className="px-5 pb-5">{children}</div>}
    </div>
  )
}

// Client Detail Flyout
function ClientDetailFlyout({ 
  client, 
  projects, 
  invoices, 
  onClose 
}: { 
  client: EnrichedClient
  projects: Project[]
  invoices: Invoice[]
  onClose: () => void 
}) {
  const clientProjects = projects.filter(p => p.client?.toLowerCase() === client.name?.toLowerCase())
  const clientInvoices = invoices.filter(i => i.client?.toLowerCase() === client.name?.toLowerCase())
  const tierConfig = TIER_CONFIG[client.tier]
  const healthColor = getHealthColor(client.healthScore)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-end z-50" onClick={onClose}>
      <div 
        className={`w-full max-w-lg h-full ${THEME.glass} border-l ${THEME.glassBorder} overflow-y-auto`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`sticky top-0 ${THEME.glass} border-b ${THEME.glassBorder} px-6 py-4 z-10`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className={`text-lg font-semibold ${THEME.textPrimary}`}>{client.name}</h2>
                <TierBadge tier={client.tier} />
              </div>
              <p className={`text-sm ${THEME.textMuted} mt-0.5`}>{client.contact_name || 'No contact'}</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors">
              <X size={20} className={THEME.textMuted} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Health & Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-xl ${healthColor.bg} border ${THEME.glassBorder}`}>
              <p className={`text-xs font-medium ${THEME.textMuted}`}>Health Score</p>
              <p className={`text-3xl font-bold ${healthColor.text} mt-1`}>{Math.round(client.healthScore)}</p>
              <p className={`text-xs ${THEME.textDim} mt-1`}>
                {client.healthScore >= 80 ? 'Excellent' : client.healthScore >= 60 ? 'Good' : 'Needs Attention'}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <p className={`text-xs font-medium ${THEME.textMuted}`}>Lifetime Value</p>
              <p className={`text-2xl font-bold ${THEME.textPrimary} mt-1`}>{formatCurrency(client.ltv)}</p>
              <p className={`text-xs ${THEME.textDim} mt-1`}>{formatPercent(client.concentration)} of portfolio</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-white/[0.03]">
              <p className={`text-lg font-semibold ${client.margin >= 20 ? 'text-emerald-400' : client.margin >= 10 ? 'text-amber-400' : 'text-rose-400'}`}>{formatPercent(client.margin)}</p>
              <p className={`text-xs ${THEME.textMuted}`}>Margin</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-white/[0.03]">
              <p className={`text-lg font-semibold ${client.avgPayDays > 45 ? 'text-rose-400' : client.avgPayDays > 30 ? 'text-amber-400' : THEME.textPrimary}`}>{client.avgPayDays > 0 ? `${Math.round(client.avgPayDays)}d` : '—'}</p>
              <p className={`text-xs ${THEME.textMuted}`}>Avg Pay</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-white/[0.03]">
              <p className={`text-lg font-semibold ${THEME.textPrimary}`}>{client.activeProjects}</p>
              <p className={`text-xs ${THEME.textMuted}`}>Active</p>
            </div>
          </div>

          {/* Risk Flags */}
          {client.riskFlags.length > 0 && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-rose-400" />
                <p className="text-sm font-medium text-rose-400">Risk Alerts</p>
              </div>
              <div className="space-y-1">
                {client.riskFlags.map((flag, i) => (
                  <p key={i} className={`text-sm ${THEME.textMuted}`}>• {flag}</p>
                ))}
              </div>
            </div>
          )}

          {/* Contact Info */}
          <div className="space-y-3">
            <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Contact Information</h3>
            <div className="space-y-2">
              {client.email && (
                <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm">
                  <Mail size={14} /> {client.email}
                </a>
              )}
              {client.phone && (
                <p className={`flex items-center gap-2 text-sm ${THEME.textSecondary}`}>
                  <Phone size={14} /> {client.phone}
                </p>
              )}
              <p className={`flex items-center gap-2 text-sm ${THEME.textMuted}`}>
                <Calendar size={14} /> {PAYMENT_TERMS.find(t => t.id === client.payment_terms)?.label || 'Net 30'}
              </p>
            </div>
          </div>

          {/* Recent Projects */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Projects ({clientProjects.length})</h3>
              <Link href="/projects" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                View all <ExternalLink size={12} />
              </Link>
            </div>
            {clientProjects.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {clientProjects.slice(0, 5).map(project => {
                  const margin = project.budget > 0 ? ((project.budget - project.spent) / project.budget) * 100 : 0
                  const statusStyle = getStatusStyle(project.status)
                  return (
                    <div key={project.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03]">
                      <div className="flex items-center gap-2">
                        <Briefcase size={14} className={THEME.textDim} />
                        <span className={`text-sm ${THEME.textPrimary}`}>{project.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${statusStyle.bg} ${statusStyle.text}`}>
                          {project.status}
                        </span>
                      </div>
                      <span className={`text-sm font-medium ${margin >= 20 ? 'text-emerald-400' : margin >= 10 ? 'text-amber-400' : 'text-rose-400'}`}>
                        {formatPercent(margin)}
                      </span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className={`text-sm ${THEME.textMuted}`}>No projects</p>
            )}
          </div>

          {/* Notes */}
          {client.notes && (
            <div className="space-y-2">
              <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Notes</h3>
              <p className={`text-sm ${THEME.textMuted} p-3 rounded-lg bg-white/[0.03]`}>{client.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============ MAIN PAGE ============
export default function ClientsPage() {
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedTier, setSelectedTier] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [quickFilter, setQuickFilter] = useState<'all' | 'at-risk' | 'top-tier' | 'needs-followup'>('all')

  // Modal & Detail state
  const [showClientModal, setShowClientModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [selectedClientDetail, setSelectedClientDetail] = useState<EnrichedClient | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    payment_terms: 'net_30',
    status: 'active',
    notes: '',
  })

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const { user } = await getCurrentUser()
        if (!user) return

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single()

        if (!profile?.company_id) {
          setLoading(false)
          return
        }

        setCompanyId(profile.company_id)

        const [clientRes, projRes, invRes] = await Promise.all([
          fetchClients(profile.company_id),
          fetchProjects(profile.company_id),
          fetchInvoices(profile.company_id)
        ])

        setClients((clientRes.data || []).map((c: any) => ({
          id: c.id,
          name: c.name || '',
          contact_name: c.contact_name || '',
          email: c.email || '',
          phone: c.phone || '',
          payment_terms: c.payment_terms || 'net_30',
          status: c.status || 'active',
          created_at: c.created_at,
          notes: c.notes || '',
        })))
        
        setProjects((projRes.data || []).map((p: any) => ({
          id: p.id,
          name: p.name || '',
          client: p.client || '',
          client_id: p.client_id,
          status: p.status || 'active',
          budget: p.budget || 0,
          spent: p.spent || 0,
          start_date: p.start_date,
        })))
        
        setInvoices((invRes.data || []).map((i: any) => ({
          id: i.id,
          client: i.client || '',
          client_id: i.client_id,
          amount: i.amount || 0,
          amount_paid: i.amount_paid || 0,
          balance_due: i.balance_due || 0,
          invoice_date: i.invoice_date || '',
          due_date: i.due_date,
          paid_date: i.paid_date,
          status: i.status,
        })))
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Calculate total portfolio revenue for concentration
  const totalPortfolioRevenue = useMemo(() => {
    return invoices.reduce((sum, i) => sum + (i.amount || 0), 0)
  }, [invoices])

  // Enrich clients with calculated metrics
  const enrichedClients = useMemo((): EnrichedClient[] => {
    const maxLTV = Math.max(...clients.map(c => 
      invoices.filter(i => i.client?.toLowerCase() === c.name?.toLowerCase()).reduce((sum, i) => sum + (i.amount || 0), 0)
    ), 1)

    return clients.map(client => {
      const clientProjects = projects.filter(p => p.client?.toLowerCase() === client.name?.toLowerCase())
      const clientInvoices = invoices.filter(i => i.client?.toLowerCase() === client.name?.toLowerCase())
      
      const activeProjects = clientProjects.filter(p => p.status === 'active').length
      const totalProjects = clientProjects.length
      const totalRevenue = clientInvoices.reduce((sum, i) => sum + (i.amount || 0), 0)
      const outstandingAR = clientInvoices.reduce((sum, i) => sum + (i.balance_due || 0), 0)
      
      const totalBudget = clientProjects.reduce((sum, p) => sum + (p.budget || 0), 0)
      const totalSpent = clientProjects.reduce((sum, p) => sum + (p.spent || 0), 0)
      const margin = totalBudget > 0 ? ((totalBudget - totalSpent) / totalBudget) * 100 : 0
      
      const concentration = totalPortfolioRevenue > 0 ? (totalRevenue / totalPortfolioRevenue) * 100 : 0
      
      // Calculate avg pay days
      const paidInvoices = clientInvoices.filter(i => i.paid_date && i.invoice_date)
      const avgPayDays = paidInvoices.length > 0 
        ? paidInvoices.reduce((sum, inv) => {
            const invoiceDate = new Date(inv.invoice_date)
            const paidDate = new Date(inv.paid_date!)
            return sum + Math.max(0, (paidDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
          }, 0) / paidInvoices.length
        : 0

      // Last activity
      const lastInvoice = clientInvoices.sort((a, b) => 
        new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()
      )[0]
      const lastActivity = lastInvoice?.invoice_date || null

      // Health score
      const { score: healthScore, flags: riskFlags } = calculateClientHealth(client, projects, invoices, totalPortfolioRevenue)
      
      // Tier
      const tier = calculateTier(totalRevenue, margin, activeProjects, maxLTV)

      return {
        ...client,
        healthScore,
        tier,
        ltv: totalRevenue,
        concentration,
        avgPayDays,
        margin,
        activeProjects,
        totalProjects,
        totalRevenue,
        outstandingAR,
        lastActivity,
        riskFlags,
      }
    })
  }, [clients, projects, invoices, totalPortfolioRevenue])

  // Apply filters
  const filteredClients = useMemo(() => {
    return enrichedClients.filter(client => {
      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!client.name?.toLowerCase().includes(query) && 
            !client.contact_name?.toLowerCase().includes(query) &&
            !client.email?.toLowerCase().includes(query)) return false
      }
      
      // Status filter
      if (selectedStatus !== 'all' && client.status !== selectedStatus) return false
      
      // Tier filter
      if (selectedTier !== 'all' && client.tier !== selectedTier) return false
      
      // Quick filters
      if (quickFilter === 'at-risk' && client.healthScore >= 60) return false
      if (quickFilter === 'top-tier' && client.tier !== 'A') return false
      if (quickFilter === 'needs-followup' && daysSince(client.lastActivity) < 30) return false
      
      return true
    }).sort((a, b) => {
      // Active first, then by LTV
      if (a.status === 'active' && b.status !== 'active') return -1
      if (a.status !== 'active' && b.status === 'active') return 1
      return b.ltv - a.ltv
    })
  }, [enrichedClients, searchQuery, selectedStatus, selectedTier, quickFilter])

  // Summary metrics
  const summary = useMemo(() => {
    const active = enrichedClients.filter(c => c.status === 'active')
    const atRisk = enrichedClients.filter(c => c.healthScore < 60)
    const topTier = enrichedClients.filter(c => c.tier === 'A')
    const needsFollowup = enrichedClients.filter(c => daysSince(c.lastActivity) > 30)
    
    const totalLTV = enrichedClients.reduce((sum, c) => sum + c.ltv, 0)
    const totalAR = enrichedClients.reduce((sum, c) => sum + c.outstandingAR, 0)
    const avgMargin = active.length > 0 
      ? active.reduce((sum, c) => sum + c.margin, 0) / active.length 
      : 0

    return {
      totalClients: enrichedClients.length,
      activeClients: active.length,
      atRiskCount: atRisk.length,
      topTierCount: topTier.length,
      needsFollowup: needsFollowup.length,
      totalLTV,
      totalAR,
      avgMargin,
    }
  }, [enrichedClients])

  // Client concentration chart data
  const concentrationData = useMemo(() => {
    return enrichedClients
      .filter(c => c.ltv > 0)
      .sort((a, b) => b.ltv - a.ltv)
      .slice(0, 6)
      .map((c, i) => ({
        name: c.name.length > 12 ? c.name.substring(0, 12) + '...' : c.name,
        fullName: c.name,
        value: c.ltv,
        concentration: c.concentration,
        fill: c.concentration > 20 ? '#ef4444' : CHART_COLORS[i % CHART_COLORS.length]
      }))
  }, [enrichedClients])

  // AR by Client chart data
  const arChartData = useMemo(() => {
    return enrichedClients
      .filter(c => c.outstandingAR > 0)
      .sort((a, b) => b.outstandingAR - a.outstandingAR)
      .slice(0, 8)
      .map((c, i) => ({
        name: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
        fullName: c.name,
        ar: c.outstandingAR,
      }))
  }, [enrichedClients])

  // Handlers
  const openAddClient = () => {
    setEditingClient(null)
    setFormData({ name: '', contact_name: '', email: '', phone: '', payment_terms: 'net_30', status: 'active', notes: '' })
    setShowClientModal(true)
  }

  const openEditClient = (client: EnrichedClient) => {
    setEditingClient(client)
    setFormData({
      name: client.name,
      contact_name: client.contact_name || '',
      email: client.email || '',
      phone: client.phone || '',
      payment_terms: client.payment_terms || 'net_30',
      status: client.status,
      notes: client.notes || '',
    })
    setShowClientModal(true)
  }

  const saveClient = async () => {
    if (!companyId || !formData.name) return

    try {
      const clientData = {
        company_id: companyId,
        name: formData.name,
        contact_name: formData.contact_name || null,
        email: formData.email || null,
        phone: formData.phone || null,
        payment_terms: formData.payment_terms,
        status: formData.status,
        notes: formData.notes || null,
      }

      if (editingClient) {
        const { error } = await supabase.from('clients').update(clientData).eq('id', editingClient.id)
        if (error) throw error
        setClients(prev => prev.map(c => c.id === editingClient.id ? { ...c, ...clientData } as Client : c))
      } else {
        const { data, error } = await supabase.from('clients').insert(clientData).select().single()
        if (error) throw error
        setClients(prev => [...prev, data as Client])
      }

      setShowClientModal(false)
    } catch (error) {
      console.error('Error saving client:', error)
    }
  }

  const updateStatus = async (clientId: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('clients').update({ status: newStatus }).eq('id', clientId)
      if (error) throw error
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, status: newStatus as Client['status'] } : c))
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const archiveClient = async (clientId: string) => {
    await updateStatus(clientId, 'archived')
  }

  const exportToCSV = () => {
    const headers = ['Client', 'Tier', 'Health', 'Contact', 'Email', 'LTV', 'Margin %', 'Avg Pay Days', 'AR', 'Active Projects', 'Status']
    const rows = enrichedClients.map(c => [
      c.name, c.tier, c.healthScore, c.contact_name, c.email, c.ltv, 
      c.margin.toFixed(1), c.avgPayDays.toFixed(0), c.outstandingAR, c.activeProjects, c.status
    ])
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `clients-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
          <p className={`text-sm ${THEME.textMuted}`}>Loading clients...</p>
        </div>
      </div>
    )
  }

  const hasActiveFilters = searchQuery || selectedStatus !== 'all' || selectedTier !== 'all' || quickFilter !== 'all'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-xl font-semibold ${THEME.textPrimary}`}>Client Intelligence</h1>
          <p className={`text-sm ${THEME.textMuted} mt-1`}>Relationship health, lifetime value, and portfolio insights</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportToCSV} className="flex items-center gap-2 px-4 py-2 border border-white/[0.1] rounded-lg text-sm font-medium text-slate-300 hover:bg-white/[0.05] transition-colors">
            <Download size={14} />Export
          </button>
          <button onClick={openAddClient} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors">
            <Plus size={14} />Add Client
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard label="Total Clients" value={summary.totalClients} subtitle={`${summary.activeClients} active`} icon={Building2} color="blue" />
        <MetricCard label="Lifetime Value" value={formatCompactCurrency(summary.totalLTV)} subtitle="All time revenue" icon={DollarSign} color="emerald" />
        <MetricCard label="Outstanding AR" value={formatCompactCurrency(summary.totalAR)} subtitle="Open balances" icon={FileText} color={summary.totalAR > 0 ? 'amber' : 'emerald'} />
        <MetricCard label="Avg Margin" value={formatPercent(summary.avgMargin)} subtitle="Active clients" icon={TrendingUp} color={summary.avgMargin >= 20 ? 'emerald' : summary.avgMargin >= 10 ? 'amber' : 'rose'} />
        <MetricCard label="Top Tier" value={summary.topTierCount} subtitle="A-tier clients" icon={Crown} color="purple" />
        <MetricCard label="At Risk" value={summary.atRiskCount} subtitle="Health < 60" icon={AlertTriangle} color={summary.atRiskCount > 0 ? 'rose' : 'emerald'} />
      </div>

      {/* Quick Filters & Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Filters */}
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-5`}>
          <h3 className={`text-sm font-semibold ${THEME.textPrimary} mb-4`}>Quick Filters</h3>
          <div className="space-y-2">
            {[
              { id: 'all', label: 'All Clients', count: enrichedClients.length, icon: Users },
              { id: 'top-tier', label: 'Top Tier (A)', count: summary.topTierCount, icon: Crown },
              { id: 'at-risk', label: 'At Risk', count: summary.atRiskCount, icon: AlertTriangle },
              { id: 'needs-followup', label: 'Needs Follow-up', count: summary.needsFollowup, icon: Clock },
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setQuickFilter(filter.id as any)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  quickFilter === filter.id 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <filter.icon size={14} />
                  <span>{filter.label}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  quickFilter === filter.id ? 'bg-emerald-500/30' : 'bg-white/[0.08]'
                }`}>
                  {filter.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Revenue Concentration Chart */}
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-5 lg:col-span-2`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Revenue Concentration</h3>
            {concentrationData.some(c => c.concentration > 20) && (
              <span className="px-2 py-1 text-xs rounded-full bg-amber-500/20 text-amber-400">
                ⚠️ Concentration Risk
              </span>
            )}
          </div>
          <div className="h-48">
            {concentrationData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={concentrationData} layout="vertical" margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => formatCompactCurrency(v)} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                  <Bar dataKey="value" name="LTV" radius={[0, 4, 4, 0]}>
                    {concentrationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className={`flex items-center justify-center h-full ${THEME.textMuted}`}>No revenue data</div>
            )}
          </div>
          <p className={`text-xs ${THEME.textDim} mt-2`}>
            Red bars indicate clients with &gt;20% revenue concentration
          </p>
        </div>
      </div>

      {/* Outstanding AR Chart */}
      <CollapsibleSection title="Outstanding AR by Client" icon={<FileText size={16} />} badge={arChartData.length}>
        <div className="h-56">
          {arChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={arChartData} layout="vertical" margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => formatCompactCurrency(v)} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                <Bar dataKey="ar" name="Outstanding" fill="#f59e0b" radius={[0, 4, 4, 0]}>
                  {arChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={index < 3 ? '#ef4444' : '#f59e0b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className={`flex items-center justify-center h-full ${THEME.textMuted}`}>No outstanding AR</div>
          )}
        </div>
      </CollapsibleSection>

      {/* Clients Table */}
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
        {/* Table Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
          <div className="flex items-center gap-3">
            <Users size={16} className={THEME.textMuted} />
            <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Clients</h3>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full bg-white/[0.08] ${THEME.textSecondary}`}>
              {filteredClients.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 bg-white/[0.05] border border-white/[0.1] rounded-lg text-sm text-slate-200 placeholder-slate-500 w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                showFilters || hasActiveFilters ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.05] text-slate-300 hover:bg-white/[0.08]'
              }`}
            >
              <Filter size={14} />
              Filters
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className={`px-6 py-3 border-b ${THEME.glassBorder} bg-white/[0.02]`}>
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1.5 bg-white/[0.05] border border-white/[0.1] rounded-lg text-sm text-slate-200 focus:outline-none"
              >
                <option value="all" className="bg-slate-900">All Status</option>
                {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id} className="bg-slate-900">{s.label}</option>)}
              </select>
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="px-3 py-1.5 bg-white/[0.05] border border-white/[0.1] rounded-lg text-sm text-slate-200 focus:outline-none"
              >
                <option value="all" className="bg-slate-900">All Tiers</option>
                <option value="A" className="bg-slate-900">Tier A</option>
                <option value="B" className="bg-slate-900">Tier B</option>
                <option value="C" className="bg-slate-900">Tier C</option>
              </select>
              {hasActiveFilters && (
                <button 
                  onClick={() => { setSearchQuery(''); setSelectedStatus('all'); setSelectedTier('all'); setQuickFilter('all'); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${THEME.textMuted} hover:text-white transition-colors`}
                >
                  <X size={14} /> Clear All
                </button>
              )}
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${THEME.glassBorder} bg-white/[0.02]`}>
                <th className={`px-4 py-3 text-left font-medium ${THEME.textMuted} text-xs uppercase tracking-wide`}>Client</th>
                <th className={`px-4 py-3 text-center font-medium ${THEME.textMuted} text-xs uppercase tracking-wide`}>Tier</th>
                <th className={`px-4 py-3 text-center font-medium ${THEME.textMuted} text-xs uppercase tracking-wide`}>Health</th>
                <th className={`px-4 py-3 text-right font-medium ${THEME.textMuted} text-xs uppercase tracking-wide`}>LTV</th>
                <th className={`px-4 py-3 text-right font-medium ${THEME.textMuted} text-xs uppercase tracking-wide`}>Margin</th>
                <th className={`px-4 py-3 text-center font-medium ${THEME.textMuted} text-xs uppercase tracking-wide`}>Concentration</th>
                <th className={`px-4 py-3 text-center font-medium ${THEME.textMuted} text-xs uppercase tracking-wide`}>Pay Days</th>
                <th className={`px-4 py-3 text-right font-medium ${THEME.textMuted} text-xs uppercase tracking-wide`}>AR</th>
                <th className={`px-4 py-3 text-center font-medium ${THEME.textMuted} text-xs uppercase tracking-wide`}>Projects</th>
                <th className={`px-4 py-3 text-center font-medium ${THEME.textMuted} text-xs uppercase tracking-wide`}>Status</th>
                <th className={`px-4 py-3 text-center font-medium ${THEME.textMuted} text-xs uppercase tracking-wide`}>Risk</th>
                <th className={`px-4 py-3 text-center font-medium ${THEME.textMuted} text-xs uppercase tracking-wide w-24`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length > 0 ? (
                filteredClients.map(client => {
                  const statusStyle = getStatusStyle(client.status)
                  const marginColor = client.margin >= 20 ? 'text-emerald-400' : client.margin >= 10 ? 'text-amber-400' : 'text-rose-400'
                  const concentrationColor = client.concentration > 20 ? 'text-rose-400' : client.concentration > 10 ? 'text-amber-400' : 'text-slate-300'
                  
                  return (
                    <tr 
                      key={client.id} 
                      className={`border-b border-white/[0.05] hover:bg-white/[0.03] transition-colors cursor-pointer`}
                      onClick={() => setSelectedClientDetail(client)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                            <Building2 size={14} className="text-blue-400" />
                          </div>
                          <div>
                            <p className={`font-medium ${THEME.textPrimary}`}>{client.name}</p>
                            <p className={`text-xs ${THEME.textDim}`}>{client.contact_name || 'No contact'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <TierBadge tier={client.tier} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <HealthBadge score={client.healthScore} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${THEME.textPrimary}`}>{formatCurrency(client.ltv)}</span>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${marginColor}`}>
                        {formatPercent(client.margin)}
                      </td>
                      <td className={`px-4 py-3 text-center ${concentrationColor}`}>
                        {formatPercent(client.concentration)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm ${client.avgPayDays > 45 ? 'text-rose-400' : client.avgPayDays > 30 ? 'text-amber-400' : 'text-slate-300'}`}>
                          {client.avgPayDays > 0 ? `${Math.round(client.avgPayDays)}d` : '—'}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${client.outstandingAR > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {formatCurrency(client.outstandingAR)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm ${THEME.textSecondary}`}>
                          {client.activeProjects} / {client.totalProjects}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <select
                          value={client.status}
                          onChange={(e) => updateStatus(client.id, e.target.value)}
                          className={`px-2 py-1 rounded-md text-xs font-medium cursor-pointer border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border} bg-transparent`}
                        >
                          {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id} className="bg-slate-900">{s.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <RiskIndicator flags={client.riskFlags} />
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => setSelectedClientDetail(client)}
                            className="p-1.5 rounded hover:bg-white/[0.08] text-slate-500 hover:text-blue-400 transition-colors"
                            title="View Details"
                          >
                            <Eye size={14} />
                          </button>
                          <button 
                            onClick={() => openEditClient(client)}
                            className="p-1.5 rounded hover:bg-white/[0.08] text-slate-500 hover:text-slate-300 transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          {client.status !== 'archived' && (
                            <button 
                              onClick={() => archiveClient(client.id)}
                              className="p-1.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
                              title="Archive"
                            >
                              <Archive size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={12} className={`px-4 py-12 text-center ${THEME.textMuted}`}>
                    No clients found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-6 py-3 border-t ${THEME.glassBorder} bg-white/[0.02]`}>
          <p className={`text-sm ${THEME.textMuted}`}>
            {filteredClients.length} of {enrichedClients.length} clients
          </p>
          <div className="flex items-center gap-6 text-sm">
            <div><span className={THEME.textMuted}>LTV: </span><span className={`font-semibold ${THEME.textPrimary}`}>{formatCurrency(filteredClients.reduce((s, c) => s + c.ltv, 0))}</span></div>
            <div><span className={THEME.textMuted}>AR: </span><span className="font-semibold text-amber-400">{formatCurrency(filteredClients.reduce((s, c) => s + c.outstandingAR, 0))}</span></div>
          </div>
        </div>
      </div>

      {/* Client Detail Flyout */}
      {selectedClientDetail && (
        <ClientDetailFlyout
          client={selectedClientDetail}
          projects={projects}
          invoices={invoices}
          onClose={() => setSelectedClientDetail(null)}
        />
      )}

      {/* Client Modal */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-2xl w-full max-w-lg mx-4 overflow-hidden`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
              <h3 className={`text-lg font-semibold ${THEME.textPrimary}`}>
                {editingClient ? 'Edit Client' : 'Add Client'}
              </h3>
              <button onClick={() => setShowClientModal(false)} className="p-1 hover:bg-white/[0.05] rounded-lg transition-colors">
                <X size={20} className={THEME.textMuted} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Client Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  placeholder="Company name"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Primary Contact</label>
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  placeholder="Contact name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Payment Terms</label>
                  <select
                    value={formData.payment_terms}
                    onChange={(e) => setFormData(prev => ({ ...prev, payment_terms: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    {PAYMENT_TERMS.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id} className="bg-slate-900">{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  rows={3}
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${THEME.glassBorder} bg-white/[0.02]`}>
              <button onClick={() => setShowClientModal(false)} className={`px-4 py-2 text-sm font-medium ${THEME.textMuted} hover:text-white transition-colors`}>
                Cancel
              </button>
              <button 
                onClick={saveClient} 
                disabled={!formData.name}
                className="px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {editingClient ? 'Save Changes' : 'Create Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
