'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { 
  Search, Filter, Download, ChevronDown, ChevronRight, ChevronUp,
  Users, Plus, Edit2, X, Archive, Building2, DollarSign, FileText,
  Mail, Phone, AlertTriangle, TrendingUp, TrendingDown, Clock,
  Star, Target, Activity, AlertCircle, CheckCircle, Zap, RefreshCw,
  Calendar, Briefcase, ArrowUpRight, ArrowDownRight, Eye, Crown,
  ExternalLink, PieChart as PieChartIcon, Calculator, Percent, Upload
} from 'lucide-react'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, Legend
} from 'recharts'
import { supabase, getCurrentUser, fetchClients, fetchProjects, fetchInvoices, fetchTransactions } from '@/lib/supabase'
import Link from 'next/link'

// ============ INSTITUTIONAL THEME ============
const THEME = {
  glass: 'bg-white',
  glassBorder: 'border-slate-200',
  glassHover: 'hover:bg-slate-50 hover:border-slate-300',
  textPrimary: 'text-slate-900',
  textSecondary: 'text-slate-600',
  textMuted: 'text-slate-500',
  textDim: 'text-slate-400',
}

// ============ TOAST NOTIFICATION ============
interface Toast {
  id: number
  type: 'success' | 'error' | 'info'
  message: string
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg backdrop-blur-xl border ${
            toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
            toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
            'bg-blue-50 border-blue-200 text-blue-700'
          }`}
        >
          {toast.type === 'success' && <CheckCircle size={18} />}
          {toast.type === 'error' && <AlertCircle size={18} />}
          {toast.type === 'info' && <AlertCircle size={18} />}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => onDismiss(toast.id)} className="ml-2 hover:opacity-70">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
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

interface Transaction {
  id: string
  description: string
  amount: number
  date: string
  category?: string
  subcategory?: string
  payee?: string
  project?: string
  client?: string
  type?: string
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
  A: { label: 'Tier A', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: Crown },
  B: { label: 'Tier B', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', icon: Star },
  C: { label: 'Tier C', color: 'text-slate-500', bg: 'bg-slate-100', border: 'border-slate-300', icon: Building2 },
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

const getStatusStyle = (status: string) => {
  const styles: Record<string, { bg: string; text: string; border: string }> = {
    active: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
    inactive: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' },
    archived: { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-300' },
  }
  return styles[status] || styles.active
}

const getHealthColor = (score: number) => {
  if (score >= 80) return { bg: 'bg-emerald-50', text: 'text-emerald-600', fill: '#10b981' }
  if (score >= 60) return { bg: 'bg-amber-50', text: 'text-amber-600', fill: '#f59e0b' }
  return { bg: 'bg-red-50', text: 'text-red-600', fill: '#ef4444' }
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

  const clientProjects = projects.filter(p => p.client_id === client.id || p.client?.toLowerCase() === client.name?.toLowerCase())
  const clientInvoices = invoices.filter(i => i.client_id === client.id || i.client?.toLowerCase() === client.name?.toLowerCase())
  
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
  if (outstandingAR > 50000) {
    score -= 15
    flags.push(`High AR (${formatCurrency(outstandingAR)})`)
  } else if (outstandingAR > 20000) {
    score -= 8
  }

  // 2. Revenue Concentration (20 points)
  const clientRevenue = clientInvoices.reduce((sum, i) => sum + (i.amount || 0), 0)
  const concentration = totalPortfolioRevenue > 0 ? (clientRevenue / totalPortfolioRevenue) * 100 : 0
  if (concentration > 30) {
    score -= 20
    flags.push(`High concentration (${concentration.toFixed(0)}%)`)
  } else if (concentration > 20) {
    score -= 10
    flags.push('Revenue concentration risk')
  }

  // 3. Project Performance (25 points)
  const activeProjects = clientProjects.filter(p => p.status === 'active')
  const totalBudget = activeProjects.reduce((sum, p) => sum + (p.budget || 0), 0)
  const totalSpent = activeProjects.reduce((sum, p) => sum + (p.spent || 0), 0)
  const margin = totalBudget > 0 ? ((totalBudget - totalSpent) / totalBudget) * 100 : 0

  if (margin < 0) {
    score -= 25
    flags.push('Negative margin')
  } else if (margin < 10) {
    score -= 15
    flags.push('Low margin')
  } else if (margin < 20) {
    score -= 5
  }

  // 4. Activity (15 points)
  const lastInvoice = clientInvoices.sort((a, b) => 
    new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()
  )[0]
  const daysSinceActivity = lastInvoice ? daysSince(lastInvoice.invoice_date) : 999

  if (daysSinceActivity > 90) {
    score -= 15
    flags.push('No activity (90+ days)')
  } else if (daysSinceActivity > 60) {
    score -= 10
    flags.push('Low activity')
  } else if (daysSinceActivity > 30) {
    score -= 5
  }

  return { score: Math.max(0, Math.min(100, score)), flags }
}

// ============ COMPONENTS ============

// Tier Badge
function TierBadge({ tier }: { tier: 'A' | 'B' | 'C' }) {
  const config = TIER_CONFIG[tier]
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${config.bg} ${config.color} border ${config.border}`}>
      <Icon size={10} /> {tier}
    </span>
  )
}

// Health Badge
function HealthBadge({ score }: { score: number }) {
  const config = getHealthColor(score)
  return (
    <span className={`inline-flex items-center justify-center w-10 h-6 rounded text-xs font-bold ${config.bg} ${config.text}`}>
      {Math.round(score)}
    </span>
  )
}

// Risk Indicator
function RiskIndicator({ flags }: { flags: string[] }) {
  if (flags.length === 0) return <CheckCircle size={16} className="text-emerald-600 mx-auto" />
  return (
    <div className="relative group">
      <AlertTriangle size={16} className="text-red-600 mx-auto cursor-help" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-white border border-slate-200 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
        <p className="text-xs text-red-600 font-semibold mb-1">Risk Alerts</p>
        {flags.map((f, i) => <p key={i} className="text-xs text-slate-500">• {f}</p>)}
      </div>
    </div>
  )
}

// Custom Tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-slate-600">{payload[0]?.payload?.fullName || label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-semibold text-slate-900">
          {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  )
}

// Client Detail Flyout
function ClientDetailFlyout({ client, projects, invoices, onClose }: { 
  client: EnrichedClient
  projects: Project[]
  invoices: Invoice[]
  onClose: () => void 
}) {
  const clientProjects = projects.filter(p => p.client_id === client.id || p.client?.toLowerCase() === client.name?.toLowerCase())
  const healthColor = getHealthColor(client.healthScore)

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-end z-50" onClick={onClose}>
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
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
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
            <div className="p-4 rounded-xl bg-slate-100/30 border border-slate-200">
              <p className={`text-xs font-medium ${THEME.textMuted}`}>Lifetime Value</p>
              <p className={`text-2xl font-bold ${THEME.textPrimary} mt-1`}>{formatCurrency(client.ltv)}</p>
              <p className={`text-xs ${THEME.textDim} mt-1`}>{formatPercent(client.concentration)} of portfolio</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-slate-100/30">
              <p className={`text-lg font-semibold ${client.margin >= 20 ? 'text-emerald-600' : client.margin >= 10 ? 'text-amber-600' : 'text-red-600'}`}>{formatPercent(client.margin)}</p>
              <p className={`text-xs ${THEME.textMuted}`}>Margin</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-slate-100/30">
              <p className={`text-lg font-semibold ${client.avgPayDays > 45 ? 'text-red-600' : client.avgPayDays > 30 ? 'text-amber-600' : THEME.textPrimary}`}>{client.avgPayDays > 0 ? `${Math.round(client.avgPayDays)}d` : '—'}</p>
              <p className={`text-xs ${THEME.textMuted}`}>Avg Pay</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-slate-100/30">
              <p className={`text-lg font-semibold ${THEME.textPrimary}`}>{client.activeProjects}</p>
              <p className={`text-xs ${THEME.textMuted}`}>Active</p>
            </div>
          </div>

          {/* Risk Flags */}
          {client.riskFlags.length > 0 && (
            <div className="p-4 rounded-xl bg-red-50 border border-rose-500/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-red-600" />
                <p className="text-sm font-medium text-red-600">Risk Alerts</p>
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
                <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-blue-600 hover:text-blue-300 text-sm">
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
              <Link href="/projects" className="text-xs text-blue-600 hover:text-blue-300 flex items-center gap-1">
                View all <ExternalLink size={12} />
              </Link>
            </div>
            {clientProjects.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {clientProjects.slice(0, 5).map(project => {
                  const margin = project.budget > 0 ? ((project.budget - project.spent) / project.budget) * 100 : 0
                  const statusStyle = getStatusStyle(project.status)
                  return (
                    <div key={project.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-100/30">
                      <div className="flex items-center gap-2">
                        <Briefcase size={14} className={THEME.textDim} />
                        <span className={`text-sm ${THEME.textPrimary}`}>{project.name}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${statusStyle.bg} ${statusStyle.text}`}>
                          {project.status}
                        </span>
                      </div>
                      <span className={`text-sm font-medium ${margin >= 20 ? 'text-emerald-600' : margin >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
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
              <p className={`text-sm ${THEME.textMuted} p-3 rounded-lg bg-slate-100/30`}>{client.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Import Modal
function ImportModal({ onClose, onImport }: { onClose: () => void; onImport: (clients: any[]) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<any[]>([])
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload')
  const [error, setError] = useState<string | null>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFile(file)
    setError(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const rows = text.split('\n').map(row => 
          row.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
        )

        if (rows.length < 2) {
          setError('File must have at least a header row and one data row')
          return
        }

        const headers = rows[0].map(h => h.toLowerCase().replace(/\s+/g, '_'))
        const data = rows.slice(1)
          .filter(row => row.some(cell => cell))
          .map(row => {
            const obj: Record<string, string> = {}
            headers.forEach((header, i) => {
              if (header === 'name' || header === 'client_name' || header === 'company') {
                obj.name = row[i] || ''
              } else if (header === 'contact' || header === 'contact_name') {
                obj.contact_name = row[i] || ''
              } else if (header === 'email') {
                obj.email = row[i] || ''
              } else if (header === 'phone') {
                obj.phone = row[i] || ''
              } else if (header === 'payment_terms' || header === 'terms') {
                obj.payment_terms = row[i] || 'net_30'
              } else if (header === 'notes') {
                obj.notes = row[i] || ''
              }
            })
            return obj
          })
          .filter(row => row.name)

        if (data.length === 0) {
          setError('No valid client data found. Make sure you have a "name" column.')
          return
        }

        setParsedData(data)
        setStep('preview')
      } catch (err) {
        setError('Failed to parse CSV file')
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    setStep('importing')
    try {
      await onImport(parsedData)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Import failed')
      setStep('preview')
    }
  }

  const downloadTemplate = () => {
    const csv = 'Name,Contact Name,Email,Phone,Payment Terms,Notes\nAcme Corp,John Smith,john@acme.com,(555) 123-4567,net_30,Important client'
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'clients-template.csv'
    a.click()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-2xl w-full max-w-lg mx-4 overflow-hidden`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
          <h3 className={`text-lg font-semibold ${THEME.textPrimary}`}>Import Clients</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-50 rounded-lg transition-colors">
            <X size={20} className={THEME.textMuted} />
          </button>
        </div>

        <div className="p-6">
          {step === 'upload' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-emerald-200 transition-colors">
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" id="csv-upload" />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                    <Upload size={24} className="text-emerald-600" />
                  </div>
                  <p className={`font-medium ${THEME.textSecondary}`}>Click to upload CSV</p>
                  <p className={`text-sm ${THEME.textDim} mt-1`}>or drag and drop</p>
                </label>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-rose-500/20 text-red-600 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={downloadTemplate}
                className={`text-sm ${THEME.textMuted} hover:text-emerald-600 transition-colors flex items-center gap-1`}
              >
                <Download size={14} /> Download template
              </button>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <FileText size={16} className="text-emerald-600" />
                <span className={THEME.textSecondary}>{file?.name}</span>
                <span className={THEME.textDim}>• {parsedData.length} clients</span>
              </div>

              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className={`bg-slate-100/30 sticky top-0`}>
                    <tr>
                      <th className={`px-3 py-2 text-left ${THEME.textDim} font-medium`}>Name</th>
                      <th className={`px-3 py-2 text-left ${THEME.textDim} font-medium`}>Contact</th>
                      <th className={`px-3 py-2 text-left ${THEME.textDim} font-medium`}>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-t border-white/[0.05]">
                        <td className={`px-3 py-2 ${THEME.textSecondary}`}>{row.name}</td>
                        <td className={`px-3 py-2 ${THEME.textMuted}`}>{row.contact_name || '—'}</td>
                        <td className={`px-3 py-2 ${THEME.textMuted}`}>{row.email || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {parsedData.length > 10 && (
                <p className={`text-sm ${THEME.textDim} text-center`}>...and {parsedData.length - 10} more</p>
              )}

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-rose-500/20 text-red-600 text-sm">
                  {error}
                </div>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="py-8 text-center">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
              <p className={THEME.textSecondary}>Importing clients...</p>
            </div>
          )}
        </div>

        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${THEME.glassBorder} bg-slate-100/30`}>
          <button onClick={onClose} className={`px-4 py-2 text-sm font-medium ${THEME.textMuted} hover:text-slate-900 transition-colors`}>
            Cancel
          </button>
          {step === 'preview' && (
            <button
              onClick={handleImport}
              className="px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
            >
              Import {parsedData.length} Clients
            </button>
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
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([])
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])
  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedTier, setSelectedTier] = useState<string>('all')
  const [quickFilter, setQuickFilter] = useState<'all' | 'at-risk' | 'top-tier' | 'needs-followup'>('all')

  // Modal state
  const [showClientModal, setShowClientModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [selectedClientDetail, setSelectedClientDetail] = useState<EnrichedClient | null>(null)
  const [isSaving, setIsSaving] = useState(false)

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
        const result = await getCurrentUser()
        const user = result?.user
        if (!user) { setLoading(false); return }

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single()

        if (!profile?.company_id) { setLoading(false); return }

        setCompanyId(profile.company_id)

        const [clientRes, projRes, invRes, txnRes] = await Promise.all([
          fetchClients(profile.company_id),
          fetchProjects(profile.company_id),
          fetchInvoices(profile.company_id),
          fetchTransactions(profile.company_id)
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
          budget: parseFloat(p.budget) || 0,
          spent: parseFloat(p.spent) || 0,
          start_date: p.start_date,
        })))

        setInvoices((invRes.data || []).map((i: any) => ({
          id: i.id,
          client: i.client || '',
          client_id: i.client_id,
          amount: parseFloat(i.amount || i.total_amount) || 0,
          amount_paid: parseFloat(i.amount_paid) || 0,
          balance_due: parseFloat(i.balance_due) || 0,
          invoice_date: i.invoice_date || '',
          due_date: i.due_date,
          paid_date: i.paid_date,
          status: i.status,
        })))

        const expenseTransactions = (txnRes.data || [])
          .filter((t: any) => t.amount < 0)
          .map((t: any) => ({
            id: t.id,
            description: t.description || '',
            amount: Math.abs(t.amount || 0),
            date: t.date || '',
            category: t.category,
            subcategory: t.subcategory,
            payee: t.payee,
            project: t.project,
            client: t.client,
            type: t.type,
          }))
        setTransactions(expenseTransactions)
      } catch (error) {
        console.error('Error loading data:', error)
        addToast('error', 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [addToast])

  // Calculate total portfolio revenue
  const totalPortfolioRevenue = useMemo(() => {
    return invoices.reduce((sum, i) => sum + (i.amount || 0), 0)
  }, [invoices])

  // Enrich clients
  const enrichedClients = useMemo((): EnrichedClient[] => {
    const maxLTV = Math.max(...clients.map(c => 
      invoices.filter(i => i.client_id === c.id || i.client?.toLowerCase() === c.name?.toLowerCase()).reduce((sum, i) => sum + (i.amount || 0), 0)
    ), 1)

    return clients.map(client => {
      const clientProjects = projects.filter(p => p.client_id === client.id || p.client?.toLowerCase() === client.name?.toLowerCase())
      const clientInvoices = invoices.filter(i => i.client_id === client.id || i.client?.toLowerCase() === client.name?.toLowerCase())
      
      const activeProjects = clientProjects.filter(p => p.status === 'active').length
      const totalProjects = clientProjects.length
      const totalRevenue = clientInvoices.reduce((sum, i) => sum + (i.amount || 0), 0)
      const outstandingAR = clientInvoices.reduce((sum, i) => sum + (i.balance_due || 0), 0)
      
      const totalBudget = clientProjects.reduce((sum, p) => sum + (p.budget || 0), 0)
      const totalSpent = clientProjects.reduce((sum, p) => sum + (p.spent || 0), 0)
      const margin = totalBudget > 0 ? ((totalBudget - totalSpent) / totalBudget) * 100 : 0
      
      const concentration = totalPortfolioRevenue > 0 ? (totalRevenue / totalPortfolioRevenue) * 100 : 0
      
      const paidInvoices = clientInvoices.filter(i => i.paid_date && i.invoice_date)
      const avgPayDays = paidInvoices.length > 0 
        ? paidInvoices.reduce((sum, inv) => {
            const invoiceDate = new Date(inv.invoice_date)
            const paidDate = new Date(inv.paid_date!)
            return sum + Math.max(0, (paidDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24))
          }, 0) / paidInvoices.length
        : 0

      const lastInvoice = clientInvoices.sort((a, b) => 
        new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime()
      )[0]
      const lastActivity = lastInvoice?.invoice_date || null

      const { score, flags } = calculateClientHealth(client, projects, invoices, totalPortfolioRevenue)
      
      // Tier calculation
      let tier: 'A' | 'B' | 'C' = 'C'
      const ltvPercentile = totalRevenue / maxLTV
      if (ltvPercentile > 0.3 || totalRevenue > 100000) tier = 'A'
      else if (ltvPercentile > 0.1 || totalRevenue > 25000) tier = 'B'

      return {
        ...client,
        healthScore: score,
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
        riskFlags: flags,
      }
    })
  }, [clients, projects, invoices, totalPortfolioRevenue])

  // Filter clients
  const filteredClients = useMemo(() => {
    return enrichedClients.filter(client => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!client.name?.toLowerCase().includes(q) && 
            !client.contact_name?.toLowerCase().includes(q) &&
            !client.email?.toLowerCase().includes(q)) return false
      }
      if (selectedStatus !== 'all' && client.status !== selectedStatus) return false
      if (selectedTier !== 'all' && client.tier !== selectedTier) return false
      if (quickFilter === 'at-risk' && client.healthScore >= 60) return false
      if (quickFilter === 'top-tier' && client.tier !== 'A') return false
      if (quickFilter === 'needs-followup' && daysSince(client.lastActivity) <= 30) return false
      return true
    }).sort((a, b) => {
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

  // Chart data
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

  const arChartData = useMemo(() => {
    return enrichedClients
      .filter(c => c.outstandingAR > 0)
      .sort((a, b) => b.outstandingAR - a.outstandingAR)
      .slice(0, 8)
      .map(c => ({
        name: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
        fullName: c.name,
        ar: c.outstandingAR,
      }))
  }, [enrichedClients])

  // Handlers
  const resetForm = () => {
    setFormData({ name: '', contact_name: '', email: '', phone: '', payment_terms: 'net_30', status: 'active', notes: '' })
    setEditingClient(null)
  }

  const openAddClient = () => {
    resetForm()
    setShowClientModal(true)
  }

  const openEditClient = (client: EnrichedClient) => {
    setEditingClient(client)
    setFormData({
      name: client.name,
      contact_name: client.contact_name || '',
      email: client.email || '',
      phone: client.phone || '',
      payment_terms: client.payment_terms,
      status: client.status,
      notes: client.notes || '',
    })
    setShowClientModal(true)
  }

  const saveClient = async () => {
    if (!companyId || !formData.name) return

    setIsSaving(true)
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
        addToast('success', 'Client updated successfully')
      } else {
        const { data, error } = await supabase.from('clients').insert(clientData).select().single()
        if (error) throw error
        setClients(prev => [...prev, data as Client])
        addToast('success', 'Client created successfully')
      }

      setShowClientModal(false)
      resetForm()
    } catch (error: any) {
      console.error('Error saving client:', error)
      addToast('error', `Failed to save client: ${error.message || 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleImportClients = async (importData: any[]) => {
    if (!companyId) throw new Error('No company ID')

    let successCount = 0
    const errors: string[] = []

    for (const row of importData) {
      try {
        const { data, error } = await supabase
          .from('clients')
          .insert({
            company_id: companyId,
            name: row.name,
            contact_name: row.contact_name || null,
            email: row.email || null,
            phone: row.phone || null,
            payment_terms: row.payment_terms || 'net_30',
            status: 'active',
            notes: row.notes || null,
          })
          .select()
          .single()

        if (error) throw error
        setClients(prev => [...prev, data as Client])
        successCount++
      } catch (err: any) {
        errors.push(`${row.name}: ${err.message}`)
      }
    }

    if (successCount > 0) {
      addToast('success', `Imported ${successCount} clients`)
    }
    if (errors.length > 0) {
      addToast('error', `${errors.length} failed: ${errors[0]}`)
    }
  }

  const updateStatus = async (clientId: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('clients').update({ status: newStatus }).eq('id', clientId)
      if (error) throw error
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, status: newStatus as Client['status'] } : c))
      addToast('success', 'Status updated')
    } catch (error: any) {
      console.error('Error updating status:', error)
      addToast('error', `Failed to update status: ${error.message}`)
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
    addToast('success', 'Export complete')
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

  return (
    <div className="space-y-6">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-xl font-semibold ${THEME.textPrimary}`}>Client Intelligence</h1>
          <p className={`text-sm ${THEME.textMuted} mt-1`}>Relationship health, lifetime value, and portfolio insights</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Download size={14} /> Export
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <Upload size={14} /> Import
          </button>
          <button
            onClick={openAddClient}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
          >
            <Plus size={14} /> Add Client
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-4 border-l-2 border-l-teal-500`}>
          <p className={`text-xs font-medium ${THEME.textMuted} uppercase tracking-wide`}>Total Clients</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{summary.totalClients}</p>
          <p className={`text-xs ${THEME.textDim} mt-1`}>{summary.activeClients} active</p>
        </div>
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-4 border-l-2 border-l-emerald-500`}>
          <p className={`text-xs font-medium ${THEME.textMuted} uppercase tracking-wide`}>Lifetime Value</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCompactCurrency(summary.totalLTV)}</p>
          <p className={`text-xs ${THEME.textDim} mt-1`}>All time revenue</p>
        </div>
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-4 border-l-2 border-l-amber-500`}>
          <p className={`text-xs font-medium ${THEME.textMuted} uppercase tracking-wide`}>Outstanding AR</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatCompactCurrency(summary.totalAR)}</p>
          <p className={`text-xs ${THEME.textDim} mt-1`}>Open balances</p>
        </div>
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-4 border-l-2 border-l-blue-500`}>
          <p className={`text-xs font-medium ${THEME.textMuted} uppercase tracking-wide`}>Avg Margin</p>
          <p className={`text-2xl font-bold ${summary.avgMargin >= 20 ? 'text-emerald-600' : summary.avgMargin >= 10 ? 'text-amber-600' : 'text-red-600'} mt-1`}>{formatPercent(summary.avgMargin)}</p>
          <p className={`text-xs ${THEME.textDim} mt-1`}>Active clients</p>
        </div>
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-4 border-l-2 border-l-amber-400`}>
          <p className={`text-xs font-medium ${THEME.textMuted} uppercase tracking-wide`}>Top Tier</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{summary.topTierCount}</p>
          <p className={`text-xs ${THEME.textDim} mt-1`}>A-tier clients</p>
        </div>
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-4 border-l-2 ${summary.atRiskCount > 0 ? 'border-l-rose-500' : 'border-l-emerald-500'}`}>
          <p className={`text-xs font-medium ${THEME.textMuted} uppercase tracking-wide`}>At Risk</p>
          <p className={`text-2xl font-bold ${summary.atRiskCount > 0 ? 'text-red-600' : 'text-emerald-600'} mt-1`}>{summary.atRiskCount}</p>
          <p className={`text-xs ${THEME.textDim} mt-1`}>Health &lt; 60</p>
        </div>
      </div>

      {/* Filters & Charts Row */}
      <div className="grid grid-cols-12 gap-6">
        {/* Quick Filters */}
        <div className="col-span-12 lg:col-span-4">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-5`}>
            <h3 className={`text-sm font-semibold ${THEME.textPrimary} mb-4`}>Quick Filters</h3>
            <div className="space-y-2">
              {[
                { id: 'all', label: 'All Clients', icon: Users, count: enrichedClients.length },
                { id: 'top-tier', label: 'Top Tier (A)', icon: Crown, count: summary.topTierCount },
                { id: 'at-risk', label: 'At Risk', icon: AlertTriangle, count: summary.atRiskCount },
                { id: 'needs-followup', label: 'Needs Follow-up', icon: Clock, count: summary.needsFollowup },
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setQuickFilter(filter.id as any)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                    quickFilter === filter.id
                      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                      : 'hover:bg-slate-50 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <filter.icon size={16} />
                    <span className="text-sm font-medium">{filter.label}</span>
                  </div>
                  <span className={`text-sm ${quickFilter === filter.id ? 'text-emerald-600' : THEME.textDim}`}>
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Revenue Concentration Chart */}
        <div className="col-span-12 lg:col-span-8">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-5`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Revenue Concentration</h3>
            </div>
            {concentrationData.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={concentrationData} layout="vertical" margin={{ left: 80 }}>
                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompactCurrency(v)} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={16} background={{ fill: 'rgba(255,255,255,0.03)', radius: 4 }}>
                      {concentrationData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className={`flex items-center justify-center h-48 ${THEME.textMuted}`}>No revenue data</div>
            )}
            <p className={`text-xs ${THEME.textDim} mt-2`}>Red bars indicate clients with &gt;20% revenue concentration</p>
          </div>
        </div>
      </div>

      {/* AR by Client */}
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
          <div className="flex items-center gap-2">
            <FileText size={18} className={THEME.textMuted} />
            <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Outstanding AR by Client</h3>
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600">
              {arChartData.length}
            </span>
          </div>
        </div>
        {arChartData.length > 0 ? (
          <div className="p-6">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={arChartData} margin={{ left: 100 }} layout="vertical">
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompactCurrency(v)} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="ar" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={14} background={{ fill: 'rgba(255,255,255,0.03)', radius: 4 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className={`flex items-center justify-center py-12 ${THEME.textMuted}`}>No outstanding AR</div>
        )}
      </div>

      {/* Client Table */}
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b ${THEME.glassBorder}`}>
          <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>All Clients</h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clients..."
                className="bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-700 placeholder-slate-400 w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-white">All Status</option>
              {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id} className="bg-white">{s.label}</option>)}
            </select>
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-white">All Tiers</option>
              <option value="A" className="bg-white">Tier A</option>
              <option value="B" className="bg-white">Tier B</option>
              <option value="C" className="bg-white">Tier C</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={`bg-slate-100/30 border-b ${THEME.glassBorder}`}>
                <th className={`px-4 py-3 text-left ${THEME.textDim} font-medium`}>Client</th>
                <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium w-16`}>Tier</th>
                <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium w-16`}>Health</th>
                <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>LTV</th>
                <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>Margin</th>
                <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium`}>Avg Pay</th>
                <th className={`px-4 py-3 text-right ${THEME.textDim} font-medium`}>AR</th>
                <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium`}>Projects</th>
                <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium`}>Status</th>
                <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium w-16`}>Risk</th>
                <th className={`px-4 py-3 text-center ${THEME.textDim} font-medium w-24`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length > 0 ? (
                filteredClients.map(client => {
                  const statusStyle = getStatusStyle(client.status)
                  return (
                    <tr
                      key={client.id}
                      className={`border-b border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer`}
                      onClick={() => setSelectedClientDetail(client)}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className={`font-medium ${THEME.textPrimary}`}>{client.name}</p>
                          <p className={`text-xs ${THEME.textDim}`}>{client.contact_name || client.email || '—'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <TierBadge tier={client.tier} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <HealthBadge score={client.healthScore} />
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${THEME.textPrimary}`}>
                        {formatCurrency(client.ltv)}
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${client.margin >= 20 ? 'text-emerald-600' : client.margin >= 10 ? 'text-amber-600' : 'text-red-600'}`}>
                        {formatPercent(client.margin)}
                      </td>
                      <td className={`px-4 py-3 text-center ${client.avgPayDays > 45 ? 'text-red-600' : client.avgPayDays > 30 ? 'text-amber-600' : THEME.textMuted}`}>
                        {client.avgPayDays > 0 ? `${Math.round(client.avgPayDays)}d` : '—'}
                      </td>
                      <td className={`px-4 py-3 text-right ${client.outstandingAR > 0 ? 'text-amber-600' : THEME.textMuted}`}>
                        {client.outstandingAR > 0 ? formatCurrency(client.outstandingAR) : '—'}
                      </td>
                      <td className={`px-4 py-3 text-center ${THEME.textSecondary}`}>
                        {client.activeProjects}/{client.totalProjects}
                      </td>
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <select
                          value={client.status}
                          onChange={(e) => updateStatus(client.id, e.target.value)}
                          className={`px-2 py-1 rounded-md text-xs font-medium cursor-pointer border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border} bg-transparent`}
                        >
                          {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id} className="bg-white">{s.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <RiskIndicator flags={client.riskFlags} />
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => setSelectedClientDetail(client)}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
                            title="View Details"
                          >
                            <Eye size={14} />
                          </button>
                          <button 
                            onClick={() => openEditClient(client)}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          {client.status !== 'archived' && (
                            <button 
                              onClick={() => archiveClient(client.id)}
                              className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
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
                  <td colSpan={11} className={`px-4 py-12 text-center ${THEME.textMuted}`}>
                    No clients found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-6 py-3 border-t ${THEME.glassBorder} bg-slate-100/30`}>
          <p className={`text-sm ${THEME.textMuted}`}>
            {filteredClients.length} of {enrichedClients.length} clients
          </p>
          <div className="flex items-center gap-6 text-sm">
            <div><span className={THEME.textMuted}>LTV: </span><span className={`font-semibold ${THEME.textPrimary}`}>{formatCurrency(filteredClients.reduce((s, c) => s + c.ltv, 0))}</span></div>
            <div><span className={THEME.textMuted}>AR: </span><span className="font-semibold text-amber-600">{formatCurrency(filteredClients.reduce((s, c) => s + c.outstandingAR, 0))}</span></div>
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

      {/* Import Modal */}
      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImportClients}
        />
      )}

      {/* Client Modal */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-2xl w-full max-w-lg mx-4 overflow-hidden`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
              <h3 className={`text-lg font-semibold ${THEME.textPrimary}`}>
                {editingClient ? 'Edit Client' : 'Add Client'}
              </h3>
              <button onClick={() => setShowClientModal(false)} className="p-1 hover:bg-slate-50 rounded-lg transition-colors">
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  placeholder="Company name"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Primary Contact</label>
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
                  >
                    {PAYMENT_TERMS.map(p => <option key={p.id} value={p.id} className="bg-white">{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
                  >
                    {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id} className="bg-white">{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  rows={3}
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${THEME.glassBorder} bg-slate-100/30`}>
              <button onClick={() => setShowClientModal(false)} className={`px-4 py-2 text-sm font-medium ${THEME.textMuted} hover:text-slate-900 transition-colors`}>
                Cancel
              </button>
              <button 
                onClick={saveClient} 
                disabled={!formData.name || isSaving}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving && <RefreshCw size={14} className="animate-spin" />}
                {editingClient ? 'Save Changes' : 'Create Client'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
