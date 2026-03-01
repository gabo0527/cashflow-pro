'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search, Download, ChevronDown, ChevronUp, Users, Plus, Edit2, X,
  Building2, DollarSign, FileText, Mail, Phone, AlertTriangle, TrendingUp,
  Clock, Activity, CheckCircle, RefreshCw, Calendar, Briefcase,
  ExternalLink, Upload, Trash2, ArrowLeft, MoreHorizontal, ArrowUpDown,
  AlertCircle, ChevronRight
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { supabase, getCurrentUser, fetchClients, fetchProjects, fetchInvoices, fetchTransactions } from '@/lib/supabase'
import Link from 'next/link'

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
  ltv: number
  concentration: number
  avgPayDays: number
  margin: number
  activeProjects: number
  totalProjects: number
  totalRevenue: number
  outstandingAR: number
  lastInvoiceDate: string | null
  riskFlags: string[]
}

// ============ UTILITIES ============
const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)

const formatCompactCurrency = (v: number) => {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`
  return `$${v}`
}

const formatPercent = (v: number) => `${v.toFixed(1)}%`

const daysSince = (date: string | null): number => {
  if (!date) return 999
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
}

const formatDateShort = (date: string | null) => {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ============ CONSTANTS ============
const PAYMENT_TERMS = [
  { id: 'due_on_receipt', label: 'Due on Receipt', days: 0 },
  { id: 'net_15', label: 'Net 15', days: 15 },
  { id: 'net_30', label: 'Net 30', days: 30 },
  { id: 'net_45', label: 'Net 45', days: 45 },
  { id: 'net_60', label: 'Net 60', days: 60 },
]

const STATUS_OPTIONS = [
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'archived', label: 'Archived' },
]

const getTermsDays = (terms: string) => PAYMENT_TERMS.find(t => t.id === terms)?.days || 30
const getTermsLabel = (terms: string) => PAYMENT_TERMS.find(t => t.id === terms)?.label || 'Net 30'

// ============ RISK FLAG CALCULATION ============
function calculateRiskFlags(
  client: Client,
  projects: Project[],
  invoices: Invoice[],
  totalPortfolioRevenue: number
): string[] {
  const flags: string[] = []
  const clientProjects = projects.filter(p => p.client_id === client.id || p.client?.toLowerCase() === client.name?.toLowerCase())
  const clientInvoices = invoices.filter(i => i.client_id === client.id || i.client?.toLowerCase() === client.name?.toLowerCase())
  const termsDays = getTermsDays(client.payment_terms)

  // Payment behavior
  const paidInvoices = clientInvoices.filter(i => i.paid_date && i.invoice_date)
  if (paidInvoices.length > 0) {
    const avgPayDays = paidInvoices.reduce((sum, inv) => {
      return sum + Math.max(0, (new Date(inv.paid_date!).getTime() - new Date(inv.invoice_date).getTime()) / (1000 * 60 * 60 * 24))
    }, 0) / paidInvoices.length
    if (avgPayDays > termsDays + 30) flags.push('Slow payer')
    else if (avgPayDays > termsDays + 15) flags.push('Late payments')
  }

  // Outstanding AR
  const outstandingAR = clientInvoices.reduce((sum, i) => sum + (i.balance_due || 0), 0)
  if (outstandingAR > 50000) flags.push('High AR')

  // Concentration
  const clientRevenue = clientInvoices.reduce((sum, i) => sum + (i.amount || 0), 0)
  const concentration = totalPortfolioRevenue > 0 ? (clientRevenue / totalPortfolioRevenue) * 100 : 0
  if (concentration > 30) flags.push('High concentration')

  // Margin
  const activeProjects = clientProjects.filter(p => p.status === 'active')
  const totalBudget = activeProjects.reduce((sum, p) => sum + (p.budget || 0), 0)
  const totalSpent = activeProjects.reduce((sum, p) => sum + (p.spent || 0), 0)
  const margin = totalBudget > 0 ? ((totalBudget - totalSpent) / totalBudget) * 100 : 0
  if (margin < 0) flags.push('Negative margin')
  else if (margin < 10) flags.push('Low margin')

  // Inactivity
  const lastInvoice = clientInvoices.sort((a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime())[0]
  if (daysSince(lastInvoice?.invoice_date) > 90) flags.push('Inactive 90+ days')

  return flags
}

// ============ SMALL COMPONENTS ============

// Toast Notifications
interface Toast { id: number; type: 'success' | 'error' | 'info'; message: string }

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border ${
            toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
            toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' :
            'bg-blue-50 border-blue-200 text-blue-700'
          }`}
        >
          {toast.type === 'success' && <CheckCircle size={16} />}
          {toast.type === 'error' && <AlertCircle size={16} />}
          {toast.type === 'info' && <AlertCircle size={16} />}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => onDismiss(toast.id)} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>
        </div>
      ))}
    </div>
  )
}

// DSO vs Terms indicator
function DSOBadge({ dso, termsDays }: { dso: number; termsDays: number }) {
  if (dso === 0) return <span className="text-xs text-slate-400">—</span>
  const ratio = dso / termsDays
  const color = ratio <= 1 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
    ratio <= 1.3 ? 'text-amber-600 bg-amber-50 border-amber-200' :
    'text-red-600 bg-red-50 border-red-200'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold border tabular-nums ${color}`}>
      {Math.round(dso)}d
      <span className="text-[9px] font-normal opacity-60">/ {termsDays}d</span>
    </span>
  )
}

// Status badge
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    inactive: 'bg-amber-50 text-amber-700 border-amber-200',
    archived: 'bg-slate-100 text-slate-500 border-slate-200',
  }
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${styles[status] || styles.active}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

// Project status badge
function ProjectStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700',
    completed: 'bg-blue-50 text-blue-600',
    on_hold: 'bg-amber-50 text-amber-700',
    prospect: 'bg-purple-50 text-purple-600',
  }
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${styles[status] || 'bg-slate-100 text-slate-500'}`}>
      {status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
    </span>
  )
}

// Risk flags inline
function RiskFlags({ flags }: { flags: string[] }) {
  if (flags.length === 0) return <CheckCircle size={14} className="text-emerald-500 mx-auto" />
  return (
    <div className="flex items-center justify-center gap-1 relative group">
      <div className="flex items-center gap-0.5">
        <AlertTriangle size={13} className="text-red-500" />
        <span className="text-[10px] font-bold text-red-600 tabular-nums">{flags.length}</span>
      </div>
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 p-2.5 bg-white border border-slate-200 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
        <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider mb-1.5">Risk Alerts</p>
        {flags.map((f, i) => <p key={i} className="text-xs text-slate-600 leading-relaxed">• {f}</p>)}
      </div>
    </div>
  )
}

// Margin text with color
function MarginValue({ margin }: { margin: number }) {
  const color = margin >= 20 ? 'text-emerald-600' : margin >= 10 ? 'text-amber-600' : 'text-red-600'
  return <span className={`font-semibold tabular-nums ${color}`}>{formatPercent(margin)}</span>
}

// Invoice status badge
function InvoiceStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    current: 'bg-blue-50 text-blue-700',
    paid: 'bg-emerald-50 text-emerald-700',
    overdue: 'bg-red-50 text-red-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${styles[status?.toLowerCase()] || 'bg-slate-100 text-slate-500'}`}>
      {status}
    </span>
  )
}

// ============ DELETE CONFIRMATION MODAL ============
function DeleteConfirmModal({ itemName, itemType, onConfirm, onCancel }: {
  itemName: string; itemType: string; onConfirm: () => void; onCancel: () => void
}) {
  const [typed, setTyped] = useState('')
  const matches = typed.toLowerCase().trim() === itemName.toLowerCase().trim()

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60]" onClick={onCancel}>
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
              <Trash2 size={18} className="text-red-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete {itemType}</h3>
              <p className="text-xs text-slate-500 mt-0.5">This action is permanent and cannot be undone.</p>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-600">
            This will permanently delete <span className="font-bold text-slate-900">{itemName}</span> and dissociate all related projects, invoices, and data.
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Type <span className="font-bold text-slate-900">{itemName}</span> to confirm
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300"
              placeholder={itemName}
              autoFocus
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100 rounded-b-2xl">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!matches}
            className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
          >
            Delete Permanently
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ CLIENT PROFILE PAGE ============
function ClientProfile({ client, allProjects, allInvoices, onBack, onEdit, onDelete, onUpdateStatus }: {
  client: EnrichedClient
  allProjects: Project[]
  allInvoices: Invoice[]
  onBack: () => void
  onEdit: (client: EnrichedClient) => void
  onDelete: (clientId: string) => void
  onUpdateStatus: (clientId: string, status: string) => void
}) {
  const [activeTab, setActiveTab] = useState<'projects' | 'resources' | 'financials'>('projects')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const clientProjects = allProjects.filter(p => p.client_id === client.id || p.client?.toLowerCase() === client.name?.toLowerCase())
  const clientInvoices = allInvoices.filter(i => i.client_id === client.id || i.client?.toLowerCase() === client.name?.toLowerCase())
    .sort((a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime())

  const totalBudget = clientProjects.reduce((s, p) => s + p.budget, 0)
  const totalSpent = clientProjects.reduce((s, p) => s + p.spent, 0)
  const overallMargin = totalBudget > 0 ? ((totalBudget - totalSpent) / totalBudget) * 100 : 0

  // Resources: unique team members from project assignments (approximation from project names)
  // In production, this would query team_assignments table
  const resourceCount = client.activeProjects > 0 ? Math.max(1, Math.round(client.activeProjects * 1.5)) : 0

  const termsDays = getTermsDays(client.payment_terms)
  const termsLabel = getTermsLabel(client.payment_terms)

  // Invoice aging for this client
  const invoicesByStatus = useMemo(() => {
    const unpaid = clientInvoices.filter(i => i.balance_due > 0)
    const current = unpaid.filter(i => {
      if (!i.due_date) return true
      return new Date(i.due_date) >= new Date()
    })
    const overdue = unpaid.filter(i => {
      if (!i.due_date) return false
      return new Date(i.due_date) < new Date()
    })
    return {
      total: clientInvoices.reduce((s, i) => s + i.amount, 0),
      outstanding: unpaid.reduce((s, i) => s + i.balance_due, 0),
      currentAmount: current.reduce((s, i) => s + i.balance_due, 0),
      overdueAmount: overdue.reduce((s, i) => s + i.balance_due, 0),
      overdueCount: overdue.length,
    }
  }, [clientInvoices])

  return (
    <div className="space-y-6">
      {showDeleteConfirm && (
        <DeleteConfirmModal
          itemName={client.name}
          itemType="Client"
          onConfirm={() => { onDelete(client.id); setShowDeleteConfirm(false) }}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button onClick={onBack} className="flex items-center gap-1.5 text-emerald-600 hover:text-emerald-700 font-medium transition-colors">
          <ArrowLeft size={14} /> Clients
        </button>
        <ChevronRight size={12} className="text-slate-300" />
        <span className="text-slate-500 font-medium">{client.name}</span>
      </div>

      {/* Client Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-lg font-bold text-slate-600 shadow-inner">
              {client.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{client.name}</h1>
                <StatusBadge status={client.status} />
              </div>
              <p className="text-sm text-slate-500 mt-0.5">{client.contact_name || 'No primary contact'}</p>
              <div className="flex items-center gap-3 mt-2.5">
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                  <Calendar size={11} />
                  <span className="font-semibold text-slate-700">{termsLabel}</span>
                </span>
                <DSOBadge dso={Math.round(client.avgPayDays)} termsDays={termsDays} />
                {client.riskFlags.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    {client.riskFlags.map((flag, i) => (
                      <span key={i} className="text-[10px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                        {flag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={client.status}
              onChange={(e) => onUpdateStatus(client.id, e.target.value)}
              className="text-xs font-medium border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-600 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <button
              onClick={() => onEdit(client)}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Edit2 size={12} className="inline mr-1" /> Edit
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-3 py-1.5 text-xs font-medium border border-red-200 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={12} className="inline mr-1" /> Delete
            </button>
          </div>
        </div>

        {/* Contact Row */}
        {(client.email || client.phone) && (
          <div className="px-6 py-2.5 border-t border-slate-100 flex items-center gap-5">
            {client.email && (
              <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700">
                <Mail size={12} /> {client.email}
              </a>
            )}
            {client.phone && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <Phone size={12} /> {client.phone}
              </span>
            )}
          </div>
        )}

        {/* KPI Row */}
        <div className="border-t border-slate-100 px-6 py-4 grid grid-cols-5 gap-4">
          {[
            { label: 'Revenue', value: formatCurrency(client.ltv), color: 'text-slate-900' },
            { label: 'Outstanding AR', value: formatCurrency(client.outstandingAR), color: client.outstandingAR > 0 ? 'text-amber-600' : 'text-slate-400' },
            { label: 'Gross Margin', value: formatPercent(client.margin), color: client.margin >= 20 ? 'text-emerald-600' : client.margin >= 10 ? 'text-amber-600' : 'text-red-600' },
            { label: 'Projects', value: `${client.activeProjects} active / ${client.totalProjects}`, color: 'text-slate-900' },
            { label: 'Avg DSO', value: client.avgPayDays > 0 ? `${Math.round(client.avgPayDays)} days` : '—', color: client.avgPayDays > termsDays ? 'text-red-600' : client.avgPayDays > 0 ? 'text-emerald-600' : 'text-slate-400' },
          ].map(kpi => (
            <div key={kpi.label}>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{kpi.label}</p>
              <p className={`text-lg font-bold mt-0.5 tabular-nums ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex gap-1">
        {[
          { id: 'projects' as const, label: 'Projects', count: clientProjects.length },
          { id: 'resources' as const, label: 'Resources', count: resourceCount },
          { id: 'financials' as const, label: 'Invoices & AR', count: clientInvoices.length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 pb-3 pt-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-emerald-500 text-emerald-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
              activeTab === tab.id ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
            }`}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* PROJECTS TAB */}
      {activeTab === 'projects' && (
        <div className="space-y-3">
          {clientProjects.length > 0 ? (
            <>
              {clientProjects
                .sort((a, b) => (a.status === 'active' ? -1 : 1) - (b.status === 'active' ? -1 : 1))
                .map(project => {
                  const margin = project.budget > 0 ? ((project.budget - project.spent) / project.budget) * 100 : 0
                  const utilization = project.budget > 0 ? (project.spent / project.budget) * 100 : 0
                  return (
                    <div key={project.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Briefcase size={14} className="text-slate-400" />
                            <h3 className="text-sm font-semibold text-slate-900">{project.name}</h3>
                            <ProjectStatusBadge status={project.status} />
                          </div>
                          {project.start_date && (
                            <p className="text-xs text-slate-400 mt-1 ml-6">Started {formatDateShort(project.start_date)}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <MarginValue margin={margin} />
                          <p className="text-[10px] text-slate-400 mt-0.5">margin</p>
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className="flex justify-between text-[10px] text-slate-400 mb-1.5">
                          <span className="font-medium">{formatCurrency(project.spent)} spent</span>
                          <span className="font-medium">{formatCurrency(project.budget)} budget</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              utilization > 90 ? 'bg-red-400' : utilization > 70 ? 'bg-amber-400' : 'bg-emerald-400'
                            }`}
                            style={{ width: `${Math.min(100, utilization)}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1.5">
                          <span className="text-[10px] text-slate-400">{utilization.toFixed(0)}% utilized</span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {formatCurrency(Math.max(0, project.budget - project.spent))} remaining
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}

              {/* Portfolio Totals */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-5 py-3.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Client Total</span>
                <div className="flex items-center gap-8 text-xs">
                  <span className="text-slate-500">Budget: <span className="font-bold text-slate-900">{formatCurrency(totalBudget)}</span></span>
                  <span className="text-slate-500">Spent: <span className="font-bold text-slate-900">{formatCurrency(totalSpent)}</span></span>
                  <span className="text-slate-500">Margin: <MarginValue margin={overallMargin} /></span>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl py-16 text-center">
              <Briefcase size={28} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500">No projects for this client</p>
              <p className="text-xs text-slate-400 mt-1">Create a project and assign it to {client.name}</p>
            </div>
          )}
        </div>
      )}

      {/* RESOURCES TAB */}
      {activeTab === 'resources' && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500">
              Team members assigned to <span className="font-semibold text-slate-700">{client.name}</span> projects.
              Resource details come from Project → Team assignments.
            </p>
          </div>
          <div className="p-8 text-center">
            <Users size={28} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">Resource data from team assignments</p>
            <p className="text-xs text-slate-400 mt-1">
              {clientProjects.filter(p => p.status === 'active').length} active projects across this client
            </p>
            <Link
              href="/team"
              className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium mt-3"
            >
              View team assignments <ExternalLink size={11} />
            </Link>
          </div>
        </div>
      )}

      {/* FINANCIALS TAB */}
      {activeTab === 'financials' && (
        <div className="space-y-4">
          {/* AR Summary */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Invoiced', value: formatCurrency(invoicesByStatus.total), color: 'text-slate-900' },
              { label: 'Outstanding', value: formatCurrency(invoicesByStatus.outstanding), color: 'text-amber-600' },
              { label: 'Current', value: formatCurrency(invoicesByStatus.currentAmount), color: 'text-emerald-600' },
              { label: 'Overdue', value: formatCurrency(invoicesByStatus.overdueAmount), color: 'text-red-600', sub: invoicesByStatus.overdueCount > 0 ? `${invoicesByStatus.overdueCount} invoices` : undefined },
            ].map(m => (
              <div key={m.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{m.label}</p>
                <p className={`text-lg font-bold mt-1 tabular-nums ${m.color}`}>{m.value}</p>
                {m.sub && <p className="text-[10px] text-red-500 mt-0.5">{m.sub}</p>}
              </div>
            ))}
          </div>

          {/* Terms reminder */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-slate-500">Payment terms: <span className="font-semibold text-slate-700">{termsLabel}</span></span>
            <DSOBadge dso={Math.round(client.avgPayDays)} termsDays={termsDays} />
          </div>

          {/* Invoice Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Invoice', 'Date', 'Due', 'Amount', 'Balance', 'Status', 'Days'].map(h => (
                    <th key={h} className={`px-5 py-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider ${
                      ['Amount', 'Balance'].includes(h) ? 'text-right' : ['Status', 'Days'].includes(h) ? 'text-center' : 'text-left'
                    }`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clientInvoices.length > 0 ? clientInvoices.map(inv => {
                  const isPaid = inv.balance_due === 0
                  const isOverdue = !isPaid && inv.due_date && new Date(inv.due_date) < new Date()
                  const daysOut = inv.due_date ? Math.floor((Date.now() - new Date(inv.invoice_date).getTime()) / (1000 * 60 * 60 * 24)) : 0
                  const paidInDays = isPaid && inv.paid_date ? Math.floor((new Date(inv.paid_date).getTime() - new Date(inv.invoice_date).getTime()) / (1000 * 60 * 60 * 24)) : 0
                  const status = isPaid ? 'Paid' : isOverdue ? 'Overdue' : 'Current'

                  return (
                    <tr key={inv.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3 font-semibold text-emerald-600 text-xs">
                        {inv.id.substring(0, 8)}
                      </td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{formatDateShort(inv.invoice_date)}</td>
                      <td className={`px-5 py-3 text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                        {formatDateShort(inv.due_date)}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-slate-900 tabular-nums">{formatCurrency(inv.amount)}</td>
                      <td className={`px-5 py-3 text-right font-semibold tabular-nums ${inv.balance_due > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {inv.balance_due > 0 ? formatCurrency(inv.balance_due) : '—'}
                      </td>
                      <td className="px-5 py-3 text-center"><InvoiceStatusBadge status={status} /></td>
                      <td className="px-5 py-3 text-center">
                        {isPaid ? (
                          <span className={`text-xs tabular-nums ${paidInDays > termsDays ? 'text-red-600 font-medium' : 'text-emerald-600'}`}>
                            {paidInDays}d
                          </span>
                        ) : (
                          <span className={`text-xs tabular-nums font-medium ${daysOut > termsDays ? 'text-red-600' : 'text-slate-500'}`}>
                            {daysOut}d
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                      No invoices for this client
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Notes */}
      {client.notes && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notes</h3>
          <p className="text-sm text-slate-600 leading-relaxed">{client.notes}</p>
        </div>
      )}
    </div>
  )
}

// ============ IMPORT MODAL ============
function ImportModal({ onClose, onImport }: { onClose: () => void; onImport: (clients: any[]) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null)
  const [parsedData, setParsedData] = useState<any[]>([])
  const [step, setStep] = useState<'upload' | 'preview' | 'importing'>('upload')
  const [error, setError] = useState<string | null>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setError(null)
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')))
        if (rows.length < 2) { setError('File must have header + data rows'); return }
        const headers = rows[0].map(h => h.toLowerCase().replace(/\s+/g, '_'))
        const data = rows.slice(1).filter(row => row.some(cell => cell)).map(row => {
          const obj: Record<string, string> = {}
          headers.forEach((header, i) => {
            if (header === 'name' || header === 'client_name' || header === 'company') obj.name = row[i] || ''
            else if (header === 'contact' || header === 'contact_name') obj.contact_name = row[i] || ''
            else if (header === 'email') obj.email = row[i] || ''
            else if (header === 'phone') obj.phone = row[i] || ''
            else if (header === 'payment_terms' || header === 'terms') obj.payment_terms = row[i] || 'net_30'
            else if (header === 'notes') obj.notes = row[i] || ''
          })
          return obj
        }).filter(row => row.name)
        if (data.length === 0) { setError('No valid data found. Needs a "name" column.'); return }
        setParsedData(data)
        setStep('preview')
      } catch { setError('Failed to parse CSV') }
    }
    reader.readAsText(f)
  }

  const handleImport = async () => {
    setStep('importing')
    try { await onImport(parsedData); onClose() }
    catch (err: any) { setError(err.message || 'Import failed'); setStep('preview') }
  }

  const downloadTemplate = () => {
    const csv = 'Name,Contact Name,Email,Phone,Payment Terms,Notes\nAcme Corp,John Smith,john@acme.com,(555) 123-4567,net_30,Important client'
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'clients-template.csv'
    a.click()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-base font-bold text-slate-900">Import Clients</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors"><X size={18} className="text-slate-400" /></button>
        </div>
        <div className="p-6">
          {step === 'upload' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-emerald-300 transition-colors">
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" id="csv-upload" />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                    <Upload size={22} className="text-emerald-500" />
                  </div>
                  <p className="font-medium text-slate-700">Click to upload CSV</p>
                  <p className="text-xs text-slate-400 mt-1">or drag and drop</p>
                </label>
              </div>
              {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
              <button onClick={downloadTemplate} className="text-xs text-slate-500 hover:text-emerald-600 transition-colors flex items-center gap-1">
                <Download size={12} /> Download template
              </button>
            </div>
          )}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <FileText size={14} className="text-emerald-500" />
                <span className="text-slate-700">{file?.name}</span>
                <span className="text-slate-400">• {parsedData.length} clients</span>
              </div>
              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium">Name</th>
                      <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium">Contact</th>
                      <th className="px-3 py-2 text-left text-xs text-slate-400 font-medium">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.slice(0, 10).map((row, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-700">{row.name}</td>
                        <td className="px-3 py-2 text-slate-500">{row.contact_name || '—'}</td>
                        <td className="px-3 py-2 text-slate-500">{row.email || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedData.length > 10 && <p className="text-xs text-slate-400 text-center">...and {parsedData.length - 10} more</p>}
              {error && <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}
            </div>
          )}
          {step === 'importing' && (
            <div className="py-8 text-center">
              <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
              <p className="text-slate-600">Importing clients...</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
          {step === 'preview' && (
            <button onClick={handleImport} className="px-4 py-2 text-sm font-semibold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors shadow-sm">
              Import {parsedData.length} Clients
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============ MAIN CLIENTS PAGE ============
export default function ClientsPage() {
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Toast
  const [toasts, setToasts] = useState<Toast[]>([])
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])
  const dismissToast = useCallback((id: number) => setToasts(prev => prev.filter(t => t.id !== id)), [])

  // View state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [sortField, setSortField] = useState<'revenue' | 'margin' | 'ar' | 'name' | 'dso'>('revenue')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedClientDetail, setSelectedClientDetail] = useState<EnrichedClient | null>(null)

  // Modal state
  const [showClientModal, setShowClientModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form
  const [formData, setFormData] = useState({
    name: '', contact_name: '', email: '', phone: '', payment_terms: 'net_30', status: 'active', notes: '',
  })

  // ---- LOAD DATA ----
  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await getCurrentUser()
        const user = result?.user
        if (!user) { setLoading(false); return }
        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
        if (!profile?.company_id) { setLoading(false); return }
        setCompanyId(profile.company_id)

        const [clientRes, projRes, invRes, txnRes] = await Promise.all([
          fetchClients(profile.company_id),
          fetchProjects(profile.company_id),
          fetchInvoices(profile.company_id),
          fetchTransactions(profile.company_id)
        ])

        setClients((clientRes.data || []).map((c: any) => ({
          id: c.id, name: c.name || '', contact_name: c.contact_name || '', email: c.email || '',
          phone: c.phone || '', payment_terms: c.payment_terms || 'net_30', status: c.status || 'active',
          created_at: c.created_at, notes: c.notes || '',
        })))
        setProjects((projRes.data || []).map((p: any) => ({
          id: p.id, name: p.name || '', client: p.client || '', client_id: p.client_id,
          status: p.status || 'active', budget: parseFloat(p.budget) || 0, spent: parseFloat(p.spent) || 0, start_date: p.start_date,
        })))
        setInvoices((invRes.data || []).map((i: any) => ({
          id: i.id, client: i.client || '', client_id: i.client_id,
          amount: parseFloat(i.amount || i.total_amount) || 0, amount_paid: parseFloat(i.amount_paid) || 0,
          balance_due: parseFloat(i.balance_due) || 0, invoice_date: i.invoice_date || '',
          due_date: i.due_date, paid_date: i.paid_date, status: i.status,
        })))
        setTransactions((txnRes.data || []).filter((t: any) => t.amount < 0).map((t: any) => ({
          id: t.id, description: t.description || '', amount: Math.abs(t.amount || 0),
          date: t.date || '', category: t.category, subcategory: t.subcategory,
          payee: t.payee, project: t.project, client: t.client, type: t.type,
        })))
      } catch (error) {
        console.error('Error loading data:', error)
        addToast('error', 'Failed to load data')
      } finally { setLoading(false) }
    }
    loadData()
  }, [addToast])

  // ---- ENRICH CLIENTS ----
  const totalPortfolioRevenue = useMemo(() => invoices.reduce((sum, i) => sum + (i.amount || 0), 0), [invoices])

  const enrichedClients = useMemo((): EnrichedClient[] => {
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
        ? paidInvoices.reduce((sum, inv) => sum + Math.max(0, (new Date(inv.paid_date!).getTime() - new Date(inv.invoice_date).getTime()) / (1000 * 60 * 60 * 24)), 0) / paidInvoices.length
        : 0

      const sortedInvoices = [...clientInvoices].sort((a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime())
      const lastInvoiceDate = sortedInvoices[0]?.invoice_date || null

      const riskFlags = calculateRiskFlags(client, projects, invoices, totalPortfolioRevenue)

      return {
        ...client, ltv: totalRevenue, concentration, avgPayDays, margin,
        activeProjects, totalProjects, totalRevenue, outstandingAR, lastInvoiceDate, riskFlags,
      }
    })
  }, [clients, projects, invoices, totalPortfolioRevenue])

  // ---- FILTER & SORT ----
  const filteredClients = useMemo(() => {
    return enrichedClients
      .filter(c => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase()
          if (!c.name?.toLowerCase().includes(q) && !c.contact_name?.toLowerCase().includes(q) && !c.email?.toLowerCase().includes(q)) return false
        }
        if (selectedStatus !== 'all' && c.status !== selectedStatus) return false
        return true
      })
      .sort((a, b) => {
        const dir = sortDir === 'desc' ? -1 : 1
        if (sortField === 'revenue') return (a.ltv - b.ltv) * dir
        if (sortField === 'margin') return (a.margin - b.margin) * dir
        if (sortField === 'ar') return (a.outstandingAR - b.outstandingAR) * dir
        if (sortField === 'dso') return (a.avgPayDays - b.avgPayDays) * dir
        return a.name.localeCompare(b.name) * dir
      })
  }, [enrichedClients, searchQuery, selectedStatus, sortField, sortDir])

  // ---- SUMMARY ----
  const summary = useMemo(() => {
    const active = enrichedClients.filter(c => c.status === 'active')
    const avgDSO = active.length > 0 ? active.reduce((s, c) => s + c.avgPayDays, 0) / active.length : 0
    return {
      total: enrichedClients.length,
      active: active.length,
      totalRevenue: enrichedClients.reduce((s, c) => s + c.ltv, 0),
      totalAR: enrichedClients.reduce((s, c) => s + c.outstandingAR, 0),
      avgDSO: Math.round(avgDSO),
      clientsWithAR: enrichedClients.filter(c => c.outstandingAR > 0).length,
    }
  }, [enrichedClients])

  // ---- HANDLERS ----
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const resetForm = () => {
    setFormData({ name: '', contact_name: '', email: '', phone: '', payment_terms: 'net_30', status: 'active', notes: '' })
    setEditingClient(null)
  }

  const openAddClient = () => { resetForm(); setShowClientModal(true) }

  const openEditClient = (client: Client | EnrichedClient) => {
    setEditingClient(client)
    setFormData({
      name: client.name, contact_name: client.contact_name || '', email: client.email || '',
      phone: client.phone || '', payment_terms: client.payment_terms, status: client.status, notes: client.notes || '',
    })
    setShowClientModal(true)
  }

  const saveClient = async () => {
    if (!companyId || !formData.name) return
    setIsSaving(true)
    try {
      const clientData = {
        company_id: companyId, name: formData.name, contact_name: formData.contact_name || null,
        email: formData.email || null, phone: formData.phone || null,
        payment_terms: formData.payment_terms, status: formData.status, notes: formData.notes || null,
      }
      if (editingClient) {
        const { error } = await supabase.from('clients').update(clientData).eq('id', editingClient.id)
        if (error) throw error
        setClients(prev => prev.map(c => c.id === editingClient.id ? { ...c, ...clientData } as Client : c))
        // If we're in client detail, update that too
        if (selectedClientDetail && selectedClientDetail.id === editingClient.id) {
          setSelectedClientDetail(prev => prev ? { ...prev, ...clientData } as EnrichedClient : null)
        }
        addToast('success', 'Client updated')
      } else {
        const { data, error } = await supabase.from('clients').insert(clientData).select().single()
        if (error) throw error
        setClients(prev => [...prev, data as Client])
        addToast('success', 'Client created')
      }
      setShowClientModal(false)
      resetForm()
    } catch (error: any) {
      addToast('error', `Failed to save: ${error.message}`)
    } finally { setIsSaving(false) }
  }

  const deleteClient = async (clientId: string) => {
    try {
      // Dissociate projects and invoices first
      await supabase.from('projects').update({ client_id: null }).eq('client_id', clientId)
      await supabase.from('invoices').update({ client_id: null }).eq('client_id', clientId)
      const { error } = await supabase.from('clients').delete().eq('id', clientId)
      if (error) throw error
      setClients(prev => prev.filter(c => c.id !== clientId))
      if (selectedClientDetail?.id === clientId) setSelectedClientDetail(null)
      addToast('success', 'Client deleted permanently')
    } catch (error: any) {
      addToast('error', `Failed to delete: ${error.message}`)
    }
  }

  const updateStatus = async (clientId: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('clients').update({ status: newStatus }).eq('id', clientId)
      if (error) throw error
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, status: newStatus as Client['status'] } : c))
      addToast('success', 'Status updated')
    } catch (error: any) { addToast('error', `Failed: ${error.message}`) }
  }

  const handleImportClients = async (importData: any[]) => {
    if (!companyId) throw new Error('No company ID')
    let successCount = 0
    const errors: string[] = []
    for (const row of importData) {
      try {
        const { data, error } = await supabase.from('clients').insert({
          company_id: companyId, name: row.name, contact_name: row.contact_name || null,
          email: row.email || null, phone: row.phone || null, payment_terms: row.payment_terms || 'net_30',
          status: 'active', notes: row.notes || null,
        }).select().single()
        if (error) throw error
        setClients(prev => [...prev, data as Client])
        successCount++
      } catch (err: any) { errors.push(`${row.name}: ${err.message}`) }
    }
    if (successCount > 0) addToast('success', `Imported ${successCount} clients`)
    if (errors.length > 0) addToast('error', `${errors.length} failed: ${errors[0]}`)
  }

  const exportToCSV = () => {
    const headers = ['Client', 'Contact', 'Email', 'Payment Terms', 'Revenue', 'Margin %', 'Avg Pay Days', 'AR', 'Active Projects', 'Status', 'Risk Flags']
    const rows = enrichedClients.map(c => [
      c.name, c.contact_name, c.email, c.payment_terms, c.ltv,
      c.margin.toFixed(1), c.avgPayDays.toFixed(0), c.outstandingAR, c.activeProjects, c.status, c.riskFlags.join('; ')
    ])
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `clients-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    addToast('success', 'Export complete')
  }

  // ---- LOADING ----
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading clients...</p>
        </div>
      </div>
    )
  }

  // ---- CLIENT PROFILE VIEW ----
  if (selectedClientDetail) {
    // Re-enrich in case data changed
    const freshClient = enrichedClients.find(c => c.id === selectedClientDetail.id)
    if (!freshClient) { setSelectedClientDetail(null); return null }
    return (
      <div className="space-y-6">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <ClientProfile
          client={freshClient}
          allProjects={projects}
          allInvoices={invoices}
          onBack={() => setSelectedClientDetail(null)}
          onEdit={openEditClient}
          onDelete={deleteClient}
          onUpdateStatus={updateStatus}
        />
        {/* Client Modal available from profile too */}
        {showClientModal && renderClientModal()}
      </div>
    )
  }

  // ---- SORTABLE HEADER HELPER ----
  const SortHeader = ({ field, label, align = 'left' }: { field: typeof sortField; label: string; align?: string }) => (
    <th className={`px-5 py-3 text-${align}`}>
      <button
        onClick={() => handleSort(field)}
        className={`text-[10px] font-semibold uppercase tracking-wider inline-flex items-center gap-1 transition-colors ${
          sortField === field ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-600'
        }`}
      >
        {label}
        {sortField === field ? (
          sortDir === 'desc' ? <ChevronDown size={10} /> : <ChevronUp size={10} />
        ) : (
          <ArrowUpDown size={9} className="opacity-40" />
        )}
      </button>
    </th>
  )

  // ---- CLIENT MODAL (shared between list and profile) ----
  function renderClientModal() {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900">{editingClient ? 'Edit Client' : 'Add Client'}</h3>
            <button onClick={() => { setShowClientModal(false); resetForm() }} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
              <X size={18} className="text-slate-400" />
            </button>
          </div>
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Client Name <span className="text-red-500">*</span></label>
              <input type="text" value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" placeholder="Company name" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Primary Contact</label>
              <input type="text" value={formData.contact_name} onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" placeholder="Contact name" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Email</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" placeholder="email@example.com" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Phone</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" placeholder="(555) 123-4567" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Payment Terms</label>
                <select value={formData.payment_terms} onChange={(e) => setFormData(prev => ({ ...prev, payment_terms: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300">
                  {PAYMENT_TERMS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Status</label>
                <select value={formData.status} onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300">
                  {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">Notes</label>
              <textarea value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" rows={3} placeholder="Notes..." />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
            <button onClick={() => { setShowClientModal(false); resetForm() }} className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
            <button onClick={saveClient} disabled={!formData.name || isSaving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors shadow-sm">
              {isSaving && <RefreshCw size={14} className="animate-spin" />}
              {editingClient ? 'Save Changes' : 'Create Client'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---- MAIN LIST RENDER ----
  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Clients</h1>
          <p className="text-sm text-slate-400 mt-0.5">Client portfolio and relationship management</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
            <Download size={13} /> Export
          </button>
          <button onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
            <Upload size={13} /> Import
          </button>
          <button onClick={openAddClient}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors shadow-sm">
            <Plus size={13} /> Add Client
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Active Clients', value: String(summary.active), sub: `${summary.total} total`, color: 'text-slate-900' },
          { label: 'Total Revenue', value: formatCompactCurrency(summary.totalRevenue), sub: 'Lifetime value', color: 'text-slate-900' },
          { label: 'Outstanding AR', value: formatCompactCurrency(summary.totalAR), sub: `${summary.clientsWithAR} clients`, color: summary.totalAR > 0 ? 'text-amber-600' : 'text-slate-400' },
          { label: 'Portfolio DSO', value: `${summary.avgDSO} days`, sub: 'Active clients avg', color: summary.avgDSO > 35 ? 'text-amber-600' : 'text-emerald-600' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${kpi.color}`}>{kpi.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search clients..."
            className="bg-white border border-slate-200 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-700 placeholder-slate-400 w-56 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" />
        </div>
        <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-600 cursor-pointer focus:outline-none">
          <option value="all">All Status</option>
          {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <span className="text-xs text-slate-400 ml-auto">{filteredClients.length} clients</span>
      </div>

      {/* Client Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Client</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Terms</th>
              <th className="px-5 py-3 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider">DSO vs Terms</th>
              <SortHeader field="revenue" label="Revenue" align="right" />
              <SortHeader field="ar" label="AR" align="right" />
              <SortHeader field="margin" label="Margin" align="right" />
              <th className="px-5 py-3 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Projects</th>
              <th className="px-5 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Last Invoice</th>
              <th className="px-5 py-3 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-32">Concentration</th>
              <th className="px-5 py-3 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider w-12">Risk</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.length > 0 ? filteredClients.map(client => {
              const concentration = totalPortfolioRevenue > 0 ? (client.ltv / totalPortfolioRevenue) * 100 : 0
              return (
                <tr key={client.id} onClick={() => setSelectedClientDetail(client)}
                  className="border-b border-slate-100 hover:bg-emerald-50/30 cursor-pointer transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center text-xs font-bold text-slate-600 group-hover:text-emerald-700 transition-colors flex-shrink-0">
                        {client.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">{client.name}</p>
                          <StatusBadge status={client.status} />
                        </div>
                        <p className="text-[11px] text-slate-400 truncate">{client.contact_name || '—'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-500 font-medium">{getTermsLabel(client.payment_terms)}</td>
                  <td className="px-5 py-3.5 text-center">
                    <DSOBadge dso={Math.round(client.avgPayDays)} termsDays={getTermsDays(client.payment_terms)} />
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-slate-900 tabular-nums">{formatCompactCurrency(client.ltv)}</td>
                  <td className={`px-5 py-3.5 text-right font-semibold tabular-nums ${client.outstandingAR > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                    {client.outstandingAR > 0 ? formatCompactCurrency(client.outstandingAR) : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-right"><MarginValue margin={client.margin} /></td>
                  <td className="px-5 py-3.5 text-center text-slate-600 tabular-nums">{client.activeProjects}/{client.totalProjects}</td>
                  <td className="px-5 py-3.5 text-xs text-slate-500">{formatDateShort(client.lastInvoiceDate)}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${concentration > 20 ? 'bg-red-400' : 'bg-emerald-400'}`}
                          style={{ width: `${Math.min(100, concentration)}%` }}
                        />
                      </div>
                      <span className={`text-[10px] tabular-nums w-8 text-right ${concentration > 20 ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                        {concentration.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5"><RiskFlags flags={client.riskFlags} /></td>
                </tr>
              )
            }) : (
              <tr>
                <td colSpan={10} className="px-5 py-16 text-center">
                  <Building2 size={28} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-500">No clients found</p>
                  <p className="text-xs text-slate-400 mt-1">Add a client or adjust your filters</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Footer */}
        {filteredClients.length > 0 && (
          <div className="bg-slate-50 border-t border-slate-200 px-5 py-3 flex items-center justify-between">
            <span className="text-xs text-slate-400">{filteredClients.length} of {enrichedClients.length} clients</span>
            <div className="flex items-center gap-6 text-xs">
              <span className="text-slate-400">Revenue: <span className="font-bold text-slate-900">{formatCompactCurrency(filteredClients.reduce((s, c) => s + c.ltv, 0))}</span></span>
              <span className="text-slate-400">AR: <span className="font-bold text-amber-600">{formatCompactCurrency(filteredClients.reduce((s, c) => s + c.outstandingAR, 0))}</span></span>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showClientModal && renderClientModal()}
      {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} onImport={handleImportClients} />}
    </div>
  )
}
