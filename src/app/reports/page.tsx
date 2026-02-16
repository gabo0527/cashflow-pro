'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  FileText, Download, Calendar, ChevronRight, ChevronDown,
  DollarSign, TrendingUp, TrendingDown, Users, Clock, Briefcase,
  BarChart3, Table2, Eye, Save, Plus, X, Search,
  Building2, FolderOpen, Receipt, AlertTriangle,
  Layers, LayoutGrid, GripVertical, ArrowUp, ArrowDown, Trash2, Settings, Type
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// ============ CHART PALETTE ============
const CHART = {
  teal: '#0d9488', blue: '#3b82f6', slate: '#64748b', rose: '#f43f5e',
  amber: '#f59e0b', emerald: '#10b981', purple: '#8b5cf6', cyan: '#06b6d4',
}

// ============ UTILITIES ============
const fmtCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
const fmtPct = (v: number) => `${v.toFixed(1)}%`
const fmtNum = (v: number, d = 1) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d }).format(v)
const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

const inputClass = "bg-slate-800/60 border border-slate-800/80 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500/30 focus:border-teal-600/50 transition-colors"

// ============ DATE RANGES ============
type DatePreset = 'this_month' | 'last_month' | 'this_quarter' | 'last_quarter' | 'ytd' | 'last_year' | 'custom'

const getDateRange = (preset: DatePreset, customStart?: string, customEnd?: string) => {
  if (preset === 'custom' && customStart && customEnd) {
    return { start: new Date(customStart + 'T00:00:00'), end: new Date(customEnd + 'T23:59:59') }
  }
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  let start = new Date()

  switch (preset) {
    case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); break
    case 'last_month': start = new Date(now.getFullYear(), now.getMonth() - 1, 1); end.setDate(0); break
    case 'this_quarter': { const q = Math.floor(now.getMonth() / 3); start = new Date(now.getFullYear(), q * 3, 1); break }
    case 'last_quarter': { const lq = Math.floor(now.getMonth() / 3) - 1; const y = lq < 0 ? now.getFullYear() - 1 : now.getFullYear(); const m = lq < 0 ? 9 : lq * 3; start = new Date(y, m, 1); end.setFullYear(y); end.setMonth(m + 3); end.setDate(0); break }
    case 'ytd': start = new Date(now.getFullYear(), 0, 1); break
    case 'last_year': start = new Date(now.getFullYear() - 1, 0, 1); end.setFullYear(now.getFullYear() - 1, 11, 31); break
    default: start = new Date(now.getFullYear(), now.getMonth(), 1)
  }
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

// Get prior period for comparison
const getPriorPeriod = (start: Date, end: Date) => {
  const duration = end.getTime() - start.getTime()
  const priorEnd = new Date(start.getTime() - 1)
  const priorStart = new Date(priorEnd.getTime() - duration)
  priorStart.setHours(0, 0, 0, 0)
  priorEnd.setHours(23, 59, 59, 999)
  return { start: priorStart, end: priorEnd }
}

const inRange = (dateStr: string, range: { start: Date; end: Date }) => {
  if (!dateStr) return false
  const d = new Date(dateStr)
  return d >= range.start && d <= range.end
}

// ============ REPORT DEFINITIONS ============
interface ReportDef {
  id: string; name: string; description: string; icon: any; accent: string
}

const REPORTS: ReportDef[] = [
  { id: 'pnl', name: 'P&L Statement', description: 'Income statement with prior period comparison', icon: FileText, accent: 'bg-teal-500' },
  { id: 'cash_flow', name: 'Cash Flow', description: 'Inflows, outflows, and ending balance', icon: DollarSign, accent: 'bg-blue-500' },
  { id: 'ar_aging', name: 'AR Aging', description: 'Receivables by aging bucket and client', icon: Receipt, accent: 'bg-amber-500' },
  { id: 'client_profit', name: 'Client Profitability', description: 'Revenue minus cost per client, margin %', icon: Building2, accent: 'bg-purple-500' },
  { id: 'project_profit', name: 'Project Profitability', description: 'Budget vs actual, hours, margin per project', icon: FolderOpen, accent: 'bg-cyan-500' },
  { id: 'utilization', name: 'Team Utilization', description: 'Billable vs non-billable, utilization %, revenue per resource', icon: Users, accent: 'bg-emerald-500' },
  { id: 'expense', name: 'Expense Breakdown', description: 'Category spending with drill-down detail', icon: TrendingDown, accent: 'bg-rose-500' },
]

// ============ P&L REPORT ============
function PnLReport({ invoices, bills, expenses, teamMembers, timeEntries, projects, dateRange }: {
  invoices: any[]; bills: any[]; expenses: any[]; teamMembers: any[]; timeEntries: any[]; projects: any[]
  dateRange: { start: Date; end: Date }
}) {
  const [basis, setBasis] = useState<'accrual' | 'cash'>('accrual')
  const prior = getPriorPeriod(dateRange.start, dateRange.end)

  const buildPnL = useCallback((range: { start: Date; end: Date }) => {
    // REVENUE — from invoices (accrual) or transactions that are payments (cash)
    let consultingFees = 0, reimbursableRevenue = 0
    if (basis === 'accrual') {
      invoices.filter(inv => inRange(inv.invoice_date, range)).forEach(inv => {
        const amt = parseFloat(inv.total_amount || inv.amount || 0)
        // If invoice has type/category for reimbursable, separate it
        if ((inv.type || '').toLowerCase().includes('reimburse') || (inv.category || '').toLowerCase().includes('reimburse')) {
          reimbursableRevenue += amt
        } else {
          consultingFees += amt
        }
      })
    } else {
      // Cash basis — only count paid invoices
      invoices.filter(inv => inRange(inv.payment_date || inv.paid_date, range) && (inv.status === 'paid' || inv.status === 'Paid')).forEach(inv => {
        const amt = parseFloat(inv.total_amount || inv.amount || 0)
        consultingFees += amt
      })
    }
    const totalRevenue = consultingFees + reimbursableRevenue

    // COST OF SERVICES
    // Direct labor — team members' cost for hours worked in period
    let directLabor = 0
    const projectClientMap: Record<string, string> = {}
    projects.forEach(p => { projectClientMap[p.id] = p.client_id })

    timeEntries.filter(t => inRange(t.date || t.week_starting, range)).forEach(t => {
      const hours = parseFloat(t.hours || t.total_hours || 0)
      const member = teamMembers.find(m => m.id === t.contractor_id || m.id === t.team_member_id)
      if (member) {
        // Use cost_rate if available, else derive from cost_amount / 172
        const costRate = member.cost_rate || (member.cost_amount ? member.cost_amount / 172 : 0)
        directLabor += hours * costRate
      }
    })

    // Subcontractor costs — from bills
    let subcontractorCosts = 0, projectExpenses = 0
    bills.filter(b => inRange(b.date || b.bill_date, range)).forEach(b => {
      const amt = Math.abs(parseFloat(b.amount || b.total_amount || 0))
      const cat = (b.category || b.type || '').toLowerCase()
      if (cat.includes('sub') || cat.includes('contractor')) {
        subcontractorCosts += amt
      } else {
        projectExpenses += amt
      }
    })

    // Project-linked expenses
    let projectExpFromExpenses = 0
    expenses.filter(e => inRange(e.date, range) && e.project_id).forEach(e => {
      projectExpFromExpenses += Math.abs(parseFloat(e.amount || 0))
    })
    projectExpenses += projectExpFromExpenses

    const totalCOS = directLabor + subcontractorCosts + projectExpenses
    const grossProfit = totalRevenue - totalCOS
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

    // OPERATING EXPENSES — non-project expenses by category
    const opexCategories: Record<string, number> = {}
    expenses.filter(e => inRange(e.date, range) && !e.project_id).forEach(e => {
      const cat = (e.category || 'Other').toLowerCase()
      const amt = Math.abs(parseFloat(e.amount || 0))
      // Classify into OpEx vs G&A
      const isGA = cat.includes('admin') || cat.includes('legal') || cat.includes('accounting') || cat.includes('g&a') || cat.includes('overhead')
      if (!isGA) {
        const displayCat = cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, ' ')
        opexCategories[displayCat] = (opexCategories[displayCat] || 0) + amt
      }
    })
    const totalOpex = Object.values(opexCategories).reduce((s, v) => s + v, 0)
    const operatingIncome = grossProfit - totalOpex

    // G&A
    const gaCategories: Record<string, number> = {}
    expenses.filter(e => inRange(e.date, range) && !e.project_id).forEach(e => {
      const cat = (e.category || '').toLowerCase()
      const amt = Math.abs(parseFloat(e.amount || 0))
      const isGA = cat.includes('admin') || cat.includes('legal') || cat.includes('accounting') || cat.includes('g&a') || cat.includes('overhead')
      if (isGA) {
        const displayCat = cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, ' ')
        gaCategories[displayCat] = (gaCategories[displayCat] || 0) + amt
      }
    })
    const totalGA = Object.values(gaCategories).reduce((s, v) => s + v, 0)
    const netIncome = operatingIncome - totalGA
    const netMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0

    return {
      consultingFees, reimbursableRevenue, totalRevenue,
      directLabor, subcontractorCosts, projectExpenses, totalCOS,
      grossProfit, grossMargin,
      opexCategories, totalOpex, operatingIncome,
      gaCategories, totalGA,
      netIncome, netMargin
    }
  }, [invoices, bills, expenses, teamMembers, timeEntries, projects, basis])

  const current = useMemo(() => buildPnL(dateRange), [buildPnL, dateRange])
  const priorData = useMemo(() => buildPnL(prior), [buildPnL, prior])

  const periodLabel = `${dateRange.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${dateRange.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  const priorLabel = `${prior.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${prior.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}`

  type PnLRow = { label: string; current: number; prior: number; indent?: number; bold?: boolean; border?: boolean; highlight?: boolean; isPct?: boolean; isNeg?: boolean }

  const rows: PnLRow[] = [
    { label: 'REVENUE', current: 0, prior: 0, bold: true, border: false, indent: 0 },
    { label: 'Consulting Fees', current: current.consultingFees, prior: priorData.consultingFees, indent: 1 },
    ...(current.reimbursableRevenue > 0 || priorData.reimbursableRevenue > 0 ? [{ label: 'Reimbursable Revenue', current: current.reimbursableRevenue, prior: priorData.reimbursableRevenue, indent: 1 }] : []),
    { label: 'Total Revenue', current: current.totalRevenue, prior: priorData.totalRevenue, bold: true, border: true },
    { label: '', current: 0, prior: 0 },
    { label: 'COST OF SERVICES', current: 0, prior: 0, bold: true },
    { label: 'Direct Labor', current: current.directLabor, prior: priorData.directLabor, indent: 1, isNeg: true },
    { label: 'Subcontractor Costs', current: current.subcontractorCosts, prior: priorData.subcontractorCosts, indent: 1, isNeg: true },
    { label: 'Project Expenses', current: current.projectExpenses, prior: priorData.projectExpenses, indent: 1, isNeg: true },
    { label: 'Total Cost of Services', current: current.totalCOS, prior: priorData.totalCOS, bold: true, border: true, isNeg: true },
    { label: '', current: 0, prior: 0 },
    { label: 'Gross Profit', current: current.grossProfit, prior: priorData.grossProfit, bold: true, highlight: true },
    { label: 'Gross Margin', current: current.grossMargin, prior: priorData.grossMargin, isPct: true, indent: 1 },
    { label: '', current: 0, prior: 0 },
    { label: 'OPERATING EXPENSES', current: 0, prior: 0, bold: true },
    ...Object.keys({ ...current.opexCategories, ...priorData.opexCategories })
      .filter((k, i, arr) => arr.indexOf(k) === i)
      .sort()
      .map(k => ({ label: k, current: current.opexCategories[k] || 0, prior: priorData.opexCategories[k] || 0, indent: 1, isNeg: true })),
    { label: 'Total Operating Expenses', current: current.totalOpex, prior: priorData.totalOpex, bold: true, border: true, isNeg: true },
    { label: 'Operating Income', current: current.operatingIncome, prior: priorData.operatingIncome, bold: true, highlight: true },
    { label: '', current: 0, prior: 0 },
    { label: 'GENERAL & ADMINISTRATIVE', current: 0, prior: 0, bold: true },
    ...Object.keys({ ...current.gaCategories, ...priorData.gaCategories })
      .filter((k, i, arr) => arr.indexOf(k) === i)
      .sort()
      .map(k => ({ label: k, current: current.gaCategories[k] || 0, prior: priorData.gaCategories[k] || 0, indent: 1, isNeg: true })),
    { label: 'Total G&A', current: current.totalGA, prior: priorData.totalGA, bold: true, border: true, isNeg: true },
    { label: '', current: 0, prior: 0 },
    { label: 'Net Income', current: current.netIncome, prior: priorData.netIncome, bold: true, highlight: true },
    { label: 'Net Margin', current: current.netMargin, prior: priorData.netMargin, isPct: true, indent: 1 },
  ]

  return (
    <div className="space-y-4">
      {/* Basis toggle */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Basis</span>
        <div className="flex bg-slate-800/60 border border-slate-800/80 rounded-lg p-0.5">
          {(['accrual', 'cash'] as const).map(b => (
            <button key={b} onClick={() => setBasis(b)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition-all ${basis === b ? 'bg-teal-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{b}</button>
          ))}
        </div>
      </div>

      {/* P&L Table */}
      <div className="bg-[#111827] border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800/60">
          <h3 className="text-sm font-semibold text-white">Profit & Loss — {basis === 'accrual' ? 'Accrual' : 'Cash'} Basis</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800/20">
              <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 w-1/2"></th>
              <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{periodLabel}</th>
              <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{priorLabel}</th>
              <th className="text-right px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 w-20">Δ %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              if (!row.label) return <tr key={i}><td colSpan={4} className="h-3" /></tr>
              if (row.current === 0 && row.prior === 0 && row.bold && !row.border && !row.highlight) {
                // Section header
                return (
                  <tr key={i} className="bg-slate-800/10">
                    <td colSpan={4} className="px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{row.label}</td>
                  </tr>
                )
              }
              const delta = row.prior !== 0 ? ((row.current - row.prior) / Math.abs(row.prior)) * 100 : 0
              const valColor = (v: number) => {
                if (row.isPct) return v >= 40 ? 'text-emerald-400' : v >= 20 ? 'text-amber-400' : v > 0 ? 'text-rose-400' : 'text-slate-500'
                if (row.isNeg) return v > 0 ? 'text-rose-400' : 'text-slate-500'
                return v > 0 ? 'text-emerald-400' : v < 0 ? 'text-rose-400' : 'text-slate-500'
              }

              return (
                <tr key={i} className={`${row.border ? 'border-t border-slate-700' : ''} ${row.highlight ? 'bg-teal-500/5' : ''}`}>
                  <td className={`px-5 py-2 ${row.bold ? 'font-semibold text-white' : 'text-slate-300'}`}
                    style={{ paddingLeft: `${20 + (row.indent || 0) * 20}px` }}>{row.label}</td>
                  <td className={`px-5 py-2 text-right tabular-nums ${row.bold ? 'font-semibold' : ''} ${valColor(row.current)}`}>
                    {row.isPct ? fmtPct(row.current) : row.isNeg && row.current > 0 ? `(${fmtCurrency(row.current)})` : fmtCurrency(row.current)}
                  </td>
                  <td className={`px-5 py-2 text-right tabular-nums text-slate-500`}>
                    {row.isPct ? fmtPct(row.prior) : row.isNeg && row.prior > 0 ? `(${fmtCurrency(row.prior)})` : fmtCurrency(row.prior)}
                  </td>
                  <td className={`px-5 py-2 text-right text-[11px] tabular-nums ${delta > 0 ? 'text-emerald-400' : delta < 0 ? 'text-rose-400' : 'text-slate-600'}`}>
                    {row.current === 0 && row.prior === 0 ? '—' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============ AR AGING REPORT ============
function ARAgingReport({ invoices, clients }: { invoices: any[]; clients: any[] }) {
  const clientMap = useMemo(() => { const m: Record<string, string> = {}; clients.forEach(c => { m[c.id] = c.name }); return m }, [clients])
  const agingData = useMemo(() => {
    const buckets = [
      { key: 'current', label: 'Current', min: -999, max: 0, amount: 0, count: 0 },
      { key: 'days30', label: '1–30', min: 1, max: 30, amount: 0, count: 0 },
      { key: 'days60', label: '31–60', min: 31, max: 60, amount: 0, count: 0 },
      { key: 'days90', label: '61–90', min: 61, max: 90, amount: 0, count: 0 },
      { key: 'over90', label: '90+', min: 91, max: 99999, amount: 0, count: 0 },
    ]
    type AgingRow = { current: number; days30: number; days60: number; days90: number; over90: number; total: number }
    const byClient: Record<string, AgingRow> = {}

    invoices.filter(inv => (parseFloat(inv.balance_due || 0)) > 0).forEach(inv => {
      const days = inv.days_overdue || 0
      const bal = parseFloat(inv.balance_due || 0)
      const cid = inv.client_id || 'unknown'
      if (!byClient[cid]) byClient[cid] = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0, total: 0 }
      byClient[cid].total += bal

      for (const b of buckets) {
        if (days >= b.min && days <= b.max) {
          b.amount += bal; b.count++
          byClient[cid][b.key] = (byClient[cid][b.key] || 0) + bal
          break
        }
      }
    })

    const totalAR = buckets.reduce((s, b) => s + b.amount, 0)
    const clientRows = Object.entries(byClient).map(([cid, data]) => ({ name: clientMap[cid] || 'Unknown', ...data })).sort((a, b) => b.total - a.total)
    return { buckets, totalAR, clientRows }
  }, [invoices, clientMap])

  const bucketColors = ['text-emerald-400', 'text-amber-400', 'text-orange-400', 'text-rose-400', 'text-red-500']
  const barColors = [CHART.emerald, CHART.amber, '#f97316', CHART.rose, '#dc2626']

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-3">
        {agingData.buckets.map((b, i) => (
          <div key={b.key} className="bg-[#111827] border border-slate-800/80 rounded-xl overflow-hidden">
            <div className="flex"><div className={`w-1 shrink-0`} style={{ backgroundColor: barColors[i] }} />
              <div className="p-3 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{b.label}</p>
                <p className={`text-lg font-bold mt-1 tabular-nums ${bucketColors[i]}`}>{fmtCurrency(b.amount)}</p>
                <p className="text-[10px] text-slate-600 mt-0.5">{b.count} invoice{b.count !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-[#111827] border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800/60"><h3 className="text-sm font-semibold text-white">Aging by Client</h3></div>
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-800/20">
            <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Client</th>
            {agingData.buckets.map(b => <th key={b.key} className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{b.label}</th>)}
            <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Total</th>
          </tr></thead>
          <tbody>
            {agingData.clientRows.map((row, i) => (
              <tr key={i} className="border-t border-slate-800/40 hover:bg-slate-800/20 transition-colors">
                <td className="px-4 py-2.5 font-medium text-slate-200">{row.name}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">{row.current > 0 ? fmtCurrency(row.current) : '—'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">{row.days30 > 0 ? fmtCurrency(row.days30) : '—'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">{row.days60 > 0 ? fmtCurrency(row.days60) : '—'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-rose-400">{row.days90 > 0 ? fmtCurrency(row.days90) : '—'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-red-400">{row.over90 > 0 ? fmtCurrency(row.over90) : '—'}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-white">{fmtCurrency(row.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t-2 border-slate-700 bg-slate-800/20">
            <td className="px-4 py-2.5 font-semibold text-white">Total</td>
            {agingData.buckets.map(b => <td key={b.key} className="px-4 py-2.5 text-right tabular-nums font-semibold text-white">{fmtCurrency(b.amount)}</td>)}
            <td className="px-4 py-2.5 text-right tabular-nums font-bold text-white">{fmtCurrency(agingData.totalAR)}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>
  )
}

// ============ CLIENT PROFITABILITY ============
function ClientProfitReport({ invoices, timeEntries, teamMembers, clients, projects, dateRange }: {
  invoices: any[]; timeEntries: any[]; teamMembers: any[]; clients: any[]; projects: any[]; dateRange: { start: Date; end: Date }
}) {
  const data = useMemo(() => {
    const cd: Record<string, { name: string; revenue: number; cost: number; hours: number }> = {}
    clients.forEach(c => { cd[c.id] = { name: c.name, revenue: 0, cost: 0, hours: 0 } })

    invoices.filter(inv => inRange(inv.invoice_date, dateRange)).forEach(inv => {
      if (cd[inv.client_id]) cd[inv.client_id].revenue += parseFloat(inv.total_amount || inv.amount || 0)
    })

    const projMap: Record<string, string> = {}
    projects.forEach(p => { projMap[p.id] = p.client_id })

    timeEntries.filter(t => inRange(t.date || t.week_starting, dateRange)).forEach(t => {
      const cid = projMap[t.project_id]
      if (!cid || !cd[cid]) return
      const hrs = parseFloat(t.hours || t.total_hours || 0)
      const member = teamMembers.find(m => m.id === (t.contractor_id || t.team_member_id))
      const costRate = member?.cost_rate || (member?.cost_amount ? member.cost_amount / 172 : 0)
      cd[cid].cost += hrs * costRate
      cd[cid].hours += hrs
    })

    return Object.values(cd).filter(c => c.revenue > 0 || c.hours > 0).map(c => ({
      ...c, profit: c.revenue - c.cost, margin: c.revenue > 0 ? ((c.revenue - c.cost) / c.revenue) * 100 : 0, effRate: c.hours > 0 ? c.revenue / c.hours : 0
    })).sort((a, b) => b.profit - a.profit)
  }, [invoices, timeEntries, teamMembers, clients, projects, dateRange])

  const totals = useMemo(() => {
    const r = data.reduce((s, c) => s + c.revenue, 0), co = data.reduce((s, c) => s + c.cost, 0), h = data.reduce((s, c) => s + c.hours, 0)
    return { revenue: r, cost: co, hours: h, profit: r - co, margin: r > 0 ? ((r - co) / r) * 100 : 0 }
  }, [data])

  return (
    <div className="bg-[#111827] border border-slate-800/80 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800/60"><h3 className="text-sm font-semibold text-white">Client Profitability</h3></div>
      <table className="w-full text-sm">
        <thead><tr className="bg-slate-800/20">
          <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Client</th>
          <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Revenue</th>
          <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Cost</th>
          <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Profit</th>
          <th className="text-center px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Margin</th>
          <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Hours</th>
          <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Eff. Rate</th>
        </tr></thead>
        <tbody>
          {data.map((c, i) => (
            <tr key={i} className="border-t border-slate-800/40 hover:bg-slate-800/20">
              <td className="px-4 py-2.5 font-medium text-slate-200">{c.name}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-emerald-400">{fmtCurrency(c.revenue)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-rose-400">{fmtCurrency(c.cost)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums font-medium text-white">{fmtCurrency(c.profit)}</td>
              <td className="px-4 py-2.5 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.margin >= 40 ? 'bg-emerald-500/15 text-emerald-400' : c.margin >= 20 ? 'bg-amber-500/15 text-amber-400' : 'bg-rose-500/15 text-rose-400'}`}>{fmtPct(c.margin)}</span></td>
              <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">{fmtNum(c.hours)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">${fmtNum(c.effRate)}/hr</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr className="border-t-2 border-slate-700 bg-slate-800/20">
          <td className="px-4 py-2.5 font-semibold text-white">Total</td>
          <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-emerald-400">{fmtCurrency(totals.revenue)}</td>
          <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-rose-400">{fmtCurrency(totals.cost)}</td>
          <td className="px-4 py-2.5 text-right tabular-nums font-bold text-white">{fmtCurrency(totals.profit)}</td>
          <td className="px-4 py-2.5 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${totals.margin >= 40 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>{fmtPct(totals.margin)}</span></td>
          <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-300">{fmtNum(totals.hours)}</td>
          <td className="px-4 py-2.5" />
        </tr></tfoot>
      </table>
    </div>
  )
}

// ============ PROJECT PROFITABILITY ============
function ProjectProfitReport({ projects, timeEntries, teamMembers, expenses, invoices, dateRange }: {
  projects: any[]; timeEntries: any[]; teamMembers: any[]; expenses: any[]; invoices: any[]; dateRange: { start: Date; end: Date }
}) {
  const data = useMemo(() => {
    return projects.filter(p => p.status === 'active' || p.status === 'completed').map(p => {
      const budget = parseFloat(p.budget || 0)
      let laborCost = 0, hours = 0
      timeEntries.filter(t => t.project_id === p.id && inRange(t.date || t.week_starting, dateRange)).forEach(t => {
        const h = parseFloat(t.hours || t.total_hours || 0)
        hours += h
        const member = teamMembers.find(m => m.id === (t.contractor_id || t.team_member_id))
        const rate = member?.cost_rate || (member?.cost_amount ? member.cost_amount / 172 : 0)
        laborCost += h * rate
      })
      const expenseCost = expenses.filter(e => e.project_id === p.id && inRange(e.date, dateRange)).reduce((s, e) => s + Math.abs(parseFloat(e.amount || 0)), 0)
      const revenue = invoices.filter(inv => inv.project_id === p.id && inRange(inv.invoice_date, dateRange)).reduce((s, inv) => s + parseFloat(inv.total_amount || inv.amount || 0), 0)
      const totalCost = laborCost + expenseCost
      const spent = parseFloat(p.spent || 0) || totalCost
      const budgetUsed = budget > 0 ? (spent / budget) * 100 : 0

      return { name: p.name, budget, spent, revenue, laborCost, expenseCost, totalCost, hours, budgetUsed, profit: revenue - totalCost, margin: revenue > 0 ? ((revenue - totalCost) / revenue) * 100 : 0 }
    }).filter(p => p.budget > 0 || p.hours > 0 || p.revenue > 0).sort((a, b) => b.revenue - a.revenue)
  }, [projects, timeEntries, teamMembers, expenses, invoices, dateRange])

  return (
    <div className="bg-[#111827] border border-slate-800/80 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800/60"><h3 className="text-sm font-semibold text-white">Project Profitability</h3></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-800/20">
            <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Project</th>
            <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Budget</th>
            <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Revenue</th>
            <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Labor</th>
            <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Expenses</th>
            <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Profit</th>
            <th className="text-center px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Margin</th>
            <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Hours</th>
            <th className="text-center px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Budget Used</th>
          </tr></thead>
          <tbody>
            {data.map((p, i) => (
              <tr key={i} className="border-t border-slate-800/40 hover:bg-slate-800/20">
                <td className="px-4 py-2.5 font-medium text-slate-200 max-w-[200px] truncate">{p.name}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">{fmtCurrency(p.budget)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-emerald-400">{fmtCurrency(p.revenue)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-rose-400">{fmtCurrency(p.laborCost)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-rose-400">{fmtCurrency(p.expenseCost)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium text-white">{fmtCurrency(p.profit)}</td>
                <td className="px-4 py-2.5 text-center"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.margin >= 40 ? 'bg-emerald-500/15 text-emerald-400' : p.margin >= 20 ? 'bg-amber-500/15 text-amber-400' : 'bg-rose-500/15 text-rose-400'}`}>{fmtPct(p.margin)}</span></td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-400">{fmtNum(p.hours)}</td>
                <td className="px-4 py-2.5 text-center">
                  <div className="flex items-center gap-2 justify-center">
                    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(p.budgetUsed, 100)}%`, backgroundColor: p.budgetUsed > 90 ? CHART.rose : p.budgetUsed > 70 ? CHART.amber : CHART.teal }} /></div>
                    <span className="text-[10px] text-slate-500">{p.budgetUsed.toFixed(0)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============ UTILIZATION REPORT ============
function UtilizationReport({ timeEntries, teamMembers, dateRange }: { timeEntries: any[]; teamMembers: any[]; dateRange: { start: Date; end: Date } }) {
  const data = useMemo(() => {
    const days = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
    const workingDays = Math.floor(days * 5 / 7)
    const available = workingDays * 8

    const members: Record<string, { name: string; billable: number; nonBillable: number; total: number; amount: number }> = {}
    timeEntries.filter(t => inRange(t.date || t.week_starting, dateRange)).forEach(t => {
      const mid = t.contractor_id || t.team_member_id || 'unknown'
      const member = teamMembers.find(m => m.id === mid)
      if (!members[mid]) members[mid] = { name: member?.name || 'Unknown', billable: 0, nonBillable: 0, total: 0, amount: 0 }
      const hrs = parseFloat(t.hours || t.total_hours || 0)
      members[mid].total += hrs
      if (t.billable !== false) { members[mid].billable += hrs; members[mid].amount += hrs * parseFloat(t.bill_rate || 0) }
      else members[mid].nonBillable += hrs
    })

    return { available, members: Object.values(members).map(m => ({ ...m, utilization: available > 0 ? (m.total / available) * 100 : 0, billableUtil: available > 0 ? (m.billable / available) * 100 : 0 })).sort((a, b) => b.billableUtil - a.billableUtil) }
  }, [timeEntries, teamMembers, dateRange])

  const totals = useMemo(() => {
    const b = data.members.reduce((s, m) => s + m.billable, 0), nb = data.members.reduce((s, m) => s + m.nonBillable, 0), a = data.members.reduce((s, m) => s + m.amount, 0)
    const ta = data.available * data.members.length
    return { billable: b, nonBillable: nb, total: b + nb, amount: a, utilization: ta > 0 ? ((b + nb) / ta) * 100 : 0, billableUtil: ta > 0 ? (b / ta) * 100 : 0 }
  }, [data])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Billable Utilization', value: fmtPct(totals.billableUtil), accent: 'bg-emerald-500' },
          { label: 'Total Utilization', value: fmtPct(totals.utilization), accent: 'bg-blue-500' },
          { label: 'Billable Value', value: fmtCurrency(totals.amount), accent: 'bg-teal-500' },
          { label: 'Non-Billable Hours', value: fmtNum(totals.nonBillable), accent: 'bg-amber-500' },
        ].map((kpi, i) => (
          <div key={i} className="bg-[#111827] border border-slate-800/80 rounded-xl overflow-hidden"><div className="flex"><div className={`w-1 ${kpi.accent} shrink-0`} /><div className="p-3 flex-1"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{kpi.label}</p><p className="text-lg font-bold text-white mt-1 tabular-nums">{kpi.value}</p></div></div></div>
        ))}
      </div>

      <div className="bg-[#111827] border border-slate-800/80 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800/60"><h3 className="text-sm font-semibold text-white">Utilization by Team Member</h3></div>
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-800/20">
            <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Member</th>
            <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Billable</th>
            <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Non-Bill</th>
            <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Total</th>
            <th className="text-center px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Utilization</th>
            <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Revenue</th>
          </tr></thead>
          <tbody>
            {data.members.map((m, i) => (
              <tr key={i} className="border-t border-slate-800/40 hover:bg-slate-800/20">
                <td className="px-4 py-2.5 font-medium text-slate-200">{m.name}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-emerald-400">{fmtNum(m.billable)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-amber-400">{fmtNum(m.nonBillable)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">{fmtNum(m.total)}</td>
                <td className="px-4 py-2.5 text-center">
                  <div className="flex items-center gap-2 justify-center">
                    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.min(m.billableUtil, 100)}%`, backgroundColor: m.billableUtil >= 70 ? CHART.emerald : m.billableUtil >= 50 ? CHART.amber : CHART.rose }} /></div>
                    <span className="text-[10px] text-slate-500">{fmtPct(m.billableUtil)}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-white">{fmtCurrency(m.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============ EXPENSE BREAKDOWN ============
function ExpenseReport({ expenses, dateRange }: { expenses: any[]; dateRange: { start: Date; end: Date } }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const data = useMemo(() => {
    const cats: Record<string, { amount: number; items: any[] }> = {}
    expenses.filter(e => inRange(e.date, dateRange)).forEach(e => {
      const cat = (e.category || 'Uncategorized').charAt(0).toUpperCase() + (e.category || 'Uncategorized').slice(1).replace(/_/g, ' ')
      if (!cats[cat]) cats[cat] = { amount: 0, items: [] }
      cats[cat].amount += Math.abs(parseFloat(e.amount || 0))
      cats[cat].items.push(e)
    })
    const total = Object.values(cats).reduce((s, c) => s + c.amount, 0)
    return { cats: Object.entries(cats).map(([name, d]) => ({ name, ...d, pct: total > 0 ? (d.amount / total) * 100 : 0 })).sort((a, b) => b.amount - a.amount), total }
  }, [expenses, dateRange])

  return (
    <div className="bg-[#111827] border border-slate-800/80 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800/60 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Expense Breakdown</h3>
        <span className="text-sm font-bold text-white tabular-nums">{fmtCurrency(data.total)}</span>
      </div>
      <div className="divide-y divide-slate-800/40">
        {data.cats.map(cat => (
          <div key={cat.name}>
            <button onClick={() => setExpanded(expanded === cat.name ? null : cat.name)} className="w-full px-5 py-3 flex items-center justify-between hover:bg-slate-800/20 transition-colors">
              <div className="flex items-center gap-3">
                {expanded === cat.name ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-600" />}
                <span className="text-sm font-medium text-slate-200">{cat.name}</span>
                <span className="text-[10px] text-slate-600">{cat.items.length} items</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-teal-600 rounded-full" style={{ width: `${cat.pct}%` }} /></div>
                <span className="text-[10px] text-slate-500 w-10 text-right">{cat.pct.toFixed(0)}%</span>
                <span className="text-sm font-semibold text-white w-24 text-right tabular-nums">{fmtCurrency(cat.amount)}</span>
              </div>
            </button>
            {expanded === cat.name && (
              <div className="bg-slate-800/10 px-8 py-2">
                {cat.items.slice(0, 15).map((e: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-t border-slate-800/30 first:border-0">
                    <div className="flex items-center gap-3"><span className="text-xs text-slate-500">{fmtDate(e.date)}</span><span className="text-xs text-slate-300">{e.description || e.vendor || '—'}</span></div>
                    <span className="text-xs text-rose-400 tabular-nums">{fmtCurrency(Math.abs(parseFloat(e.amount || 0)))}</span>
                  </div>
                ))}
                {cat.items.length > 15 && <p className="text-[10px] text-slate-600 py-1.5 text-center">+ {cat.items.length - 15} more</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============ CASH FLOW REPORT ============
function CashFlowReport({ invoices, bills, expenses, dateRange }: { invoices: any[]; bills: any[]; expenses: any[]; dateRange: { start: Date; end: Date } }) {
  const data = useMemo(() => {
    const paidInvoices = invoices.filter(inv => inRange(inv.payment_date || inv.paid_date || inv.invoice_date, dateRange) && (inv.status === 'paid' || inv.status === 'Paid'))
    const cashIn = paidInvoices.reduce((s, inv) => s + parseFloat(inv.total_amount || inv.amount || 0), 0)
    const billsPaid = bills.filter(b => inRange(b.date || b.bill_date, dateRange)).reduce((s, b) => s + Math.abs(parseFloat(b.amount || b.total_amount || 0)), 0)
    const expensesPaid = expenses.filter(e => inRange(e.date, dateRange)).reduce((s, e) => s + Math.abs(parseFloat(e.amount || 0)), 0)
    const cashOut = billsPaid + expensesPaid
    return { cashIn, billsPaid, expensesPaid, cashOut, net: cashIn - cashOut }
  }, [invoices, bills, expenses, dateRange])

  const rows = [
    { label: 'OPERATING ACTIVITIES', header: true },
    { label: 'Client Payments Received', value: data.cashIn, color: 'text-emerald-400' },
    { label: 'Bills Paid', value: -data.billsPaid, color: 'text-rose-400' },
    { label: 'Expenses Paid', value: -data.expensesPaid, color: 'text-rose-400' },
    { label: 'Net Cash from Operations', value: data.net, bold: true, border: true },
  ]

  return (
    <div className="bg-[#111827] border border-slate-800/80 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-800/60"><h3 className="text-sm font-semibold text-white">Cash Flow Statement</h3></div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={`${row.border ? 'border-t border-slate-700' : ''} ${row.header ? 'bg-slate-800/10' : ''}`}>
              <td className={`px-5 py-2.5 ${row.bold ? 'font-semibold text-white' : row.header ? 'text-[10px] font-bold uppercase tracking-wider text-slate-500' : 'text-slate-300 pl-10'}`}>{row.label}</td>
              {!row.header && (
                <td className={`px-5 py-2.5 text-right tabular-nums ${row.bold ? 'font-bold' : ''} ${row.color || ((row.value || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400')}`}>
                  {fmtCurrency(row.value || 0)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ============ REPORT BUILDER ============
interface BuilderBlock {
  id: string
  type: 'pnl' | 'ar_aging' | 'client_profit' | 'project_profit' | 'utilization' | 'expense' | 'cash_flow' | 'kpi_card' | 'text_note'
  title: string
  config?: Record<string, any>
}

const BLOCK_PALETTE: { type: BuilderBlock['type']; label: string; icon: any }[] = [
  { type: 'pnl', label: 'P&L Statement', icon: FileText },
  { type: 'cash_flow', label: 'Cash Flow', icon: DollarSign },
  { type: 'ar_aging', label: 'AR Aging', icon: Receipt },
  { type: 'client_profit', label: 'Client Profitability', icon: Building2 },
  { type: 'project_profit', label: 'Project Profitability', icon: FolderOpen },
  { type: 'utilization', label: 'Team Utilization', icon: Users },
  { type: 'expense', label: 'Expense Breakdown', icon: TrendingDown },
  { type: 'text_note', label: 'Text / Notes', icon: Type },
]

function ReportBuilder({ allData, dateRange }: { allData: any; dateRange: { start: Date; end: Date } }) {
  const [blocks, setBlocks] = useState<BuilderBlock[]>([])
  const [reportTitle, setReportTitle] = useState('Custom Report')
  const [editingNote, setEditingNote] = useState<string | null>(null)

  const addBlock = (type: BuilderBlock['type']) => {
    const palette = BLOCK_PALETTE.find(b => b.type === type)
    setBlocks(prev => [...prev, { id: `block_${Date.now()}`, type, title: palette?.label || 'Block', config: type === 'text_note' ? { text: '' } : {} }])
  }

  const removeBlock = (id: string) => setBlocks(prev => prev.filter(b => b.id !== id))
  const moveBlock = (id: string, dir: -1 | 1) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === id)
      if (idx < 0) return prev
      const newIdx = idx + dir
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const copy = [...prev]
      ;[copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]]
      return copy
    })
  }
  const updateBlock = (id: string, updates: Partial<BuilderBlock>) => setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))

  const renderBlock = (block: BuilderBlock) => {
    switch (block.type) {
      case 'pnl': return <PnLReport {...allData} dateRange={dateRange} />
      case 'cash_flow': return <CashFlowReport invoices={allData.invoices} bills={allData.bills} expenses={allData.expenses} dateRange={dateRange} />
      case 'ar_aging': return <ARAgingReport invoices={allData.invoices} clients={allData.clients} />
      case 'client_profit': return <ClientProfitReport {...allData} dateRange={dateRange} />
      case 'project_profit': return <ProjectProfitReport {...allData} dateRange={dateRange} />
      case 'utilization': return <UtilizationReport timeEntries={allData.timeEntries} teamMembers={allData.teamMembers} dateRange={dateRange} />
      case 'expense': return <ExpenseReport expenses={allData.expenses} dateRange={dateRange} />
      case 'text_note': return (
        <div className="bg-[#111827] border border-slate-800/80 rounded-xl p-5">
          <textarea value={block.config?.text || ''} onChange={e => updateBlock(block.id, { config: { ...block.config, text: e.target.value } })}
            className={`${inputClass} w-full min-h-[80px] resize-y`} placeholder="Add notes, context, or section headers for your report..." />
        </div>
      )
      default: return null
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 mb-2">
        <input type="text" value={reportTitle} onChange={e => setReportTitle(e.target.value)}
          className="bg-transparent text-lg font-bold text-white border-b border-transparent hover:border-slate-700 focus:border-teal-600 focus:outline-none pb-1 transition-colors flex-1" />
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* Block palette — sidebar */}
        <div className="col-span-3">
          <div className="bg-[#111827] border border-slate-800/80 rounded-xl p-4 sticky top-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Data Blocks</p>
            <p className="text-[10px] text-slate-600 mb-3">Click to add to canvas</p>
            <div className="space-y-1.5">
              {BLOCK_PALETTE.map(b => {
                const Icon = b.icon
                return (
                  <button key={b.type} onClick={() => addBlock(b.type)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left bg-slate-800/30 hover:bg-slate-800/60 border border-transparent hover:border-slate-700 transition-all group">
                    <Icon size={14} className="text-slate-500 group-hover:text-teal-400 transition-colors" />
                    <span className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors">{b.label}</span>
                    <Plus size={12} className="ml-auto text-slate-600 group-hover:text-teal-400 transition-colors" />
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="col-span-9">
          {blocks.length === 0 ? (
            <div className="bg-[#111827] border border-dashed border-slate-700 rounded-xl p-16 text-center">
              <LayoutGrid size={32} className="text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400 mb-1">Empty canvas</p>
              <p className="text-xs text-slate-600">Click data blocks on the left to start building your report. Arrange, rename, and export.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {blocks.map((block, idx) => (
                <div key={block.id} className="relative group">
                  {/* Block controls */}
                  <div className="absolute -left-1 top-2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button onClick={() => moveBlock(block.id, -1)} disabled={idx === 0} className="p-1 bg-slate-800 border border-slate-700 rounded text-slate-400 hover:text-white disabled:opacity-20 transition-colors"><ArrowUp size={10} /></button>
                    <button onClick={() => moveBlock(block.id, 1)} disabled={idx === blocks.length - 1} className="p-1 bg-slate-800 border border-slate-700 rounded text-slate-400 hover:text-white disabled:opacity-20 transition-colors"><ArrowDown size={10} /></button>
                    <button onClick={() => removeBlock(block.id)} className="p-1 bg-slate-800 border border-slate-700 rounded text-slate-400 hover:text-rose-400 transition-colors"><Trash2 size={10} /></button>
                  </div>

                  {/* Block title */}
                  <div className="flex items-center gap-2 mb-1.5 ml-5">
                    <input type="text" value={block.title} onChange={e => updateBlock(block.id, { title: e.target.value })}
                      className="bg-transparent text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-transparent hover:border-slate-700 focus:border-teal-600 focus:outline-none transition-colors" />
                  </div>

                  {/* Block content */}
                  <div className="ml-5">{renderBlock(block)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ============ MAIN PAGE ============
export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<any[]>([])
  const [bills, setBills] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [timeEntries, setTimeEntries] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])

  const [activeTab, setActiveTab] = useState<'reports' | 'builder'>('reports')
  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')

  const dateRange = useMemo(() => getDateRange(datePreset, customStart, customEnd), [datePreset, customStart, customEnd])

  useEffect(() => {
    const load = async () => {
      try {
        const result = await getCurrentUser()
        const user = result?.user
        if (!user) { setLoading(false); return }
        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
        if (!profile?.company_id) { setLoading(false); return }

        const [inv, bil, exp, proj, cli, te, tm] = await Promise.all([
          supabase.from('invoices').select('*').eq('company_id', profile.company_id),
          supabase.from('bills').select('*').eq('company_id', profile.company_id),
          supabase.from('expenses').select('*').eq('company_id', profile.company_id),
          supabase.from('projects').select('*').eq('company_id', profile.company_id),
          supabase.from('clients').select('*').eq('company_id', profile.company_id),
          supabase.from('time_entries').select('*').eq('company_id', profile.company_id),
          supabase.from('team_members').select('*').eq('company_id', profile.company_id),
        ])
        setInvoices(inv.data || []); setBills(bil.data || []); setExpenses(exp.data || [])
        setProjects(proj.data || []); setClients(cli.data || []); setTimeEntries(te.data || []); setTeamMembers(tm.data || [])
      } catch (e) { console.error(e) } finally { setLoading(false) }
    }
    load()
  }, [])

  const allData = { invoices, bills, expenses, projects, clients, timeEntries, teamMembers }

  const renderReport = (id: string) => {
    switch (id) {
      case 'pnl': return <PnLReport {...allData} dateRange={dateRange} />
      case 'cash_flow': return <CashFlowReport invoices={invoices} bills={bills} expenses={expenses} dateRange={dateRange} />
      case 'ar_aging': return <ARAgingReport invoices={invoices} clients={clients} />
      case 'client_profit': return <ClientProfitReport {...allData} dateRange={dateRange} />
      case 'project_profit': return <ProjectProfitReport {...allData} dateRange={dateRange} />
      case 'utilization': return <UtilizationReport timeEntries={timeEntries} teamMembers={teamMembers} dateRange={dateRange} />
      case 'expense': return <ExpenseReport expenses={expenses} dateRange={dateRange} />
      default: return null
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-sm text-slate-500">Loading reports...</p></div>
    </div>
  )

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">Financial statements, profitability, and custom reports</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-[#111827] border border-slate-800/80 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-slate-500" />
            <select value={datePreset} onChange={e => setDatePreset(e.target.value as DatePreset)} className={inputClass}>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_quarter">This Quarter</option>
              <option value="last_quarter">Last Quarter</option>
              <option value="ytd">Year to Date</option>
              <option value="last_year">Last Year</option>
              <option value="custom">Custom Range</option>
            </select>
            {datePreset === 'custom' && (
              <>
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className={inputClass} />
                <span className="text-slate-600 text-xs">to</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className={inputClass} />
              </>
            )}
          </div>

          {selectedReport && activeTab === 'reports' && (
            <>
              <div className="w-px h-8 bg-slate-800/60" />
              <button onClick={() => setSelectedReport(null)} className="text-xs text-teal-400 hover:text-teal-300 transition-colors">
                ← Back to all reports
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800/60">
        <div className="flex gap-0">
          {([
            { id: 'reports' as const, label: 'Quick Reports' },
            { id: 'builder' as const, label: 'Report Builder' },
          ]).map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedReport(null) }}
              className={`relative px-5 py-3 text-sm font-medium transition-colors ${activeTab === tab.id ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'}`}>
              {tab.label}
              {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500 rounded-t" />}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Reports — Grid or Report View */}
      {activeTab === 'reports' && !selectedReport && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {REPORTS.map(report => {
            const Icon = report.icon
            return (
              <button key={report.id} onClick={() => setSelectedReport(report.id)}
                className="text-left bg-[#111827] border border-slate-800/80 rounded-xl p-4 hover:border-slate-700 hover:bg-slate-800/30 transition-all group">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 ${report.accent} rounded-lg flex items-center justify-center shrink-0`}>
                    <Icon size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white group-hover:text-teal-400 transition-colors">{report.name}</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{report.description}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {activeTab === 'reports' && selectedReport && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <button onClick={() => setSelectedReport(null)} className="text-slate-500 hover:text-slate-300 transition-colors">Reports</button>
            <ChevronRight size={14} className="text-slate-600" />
            <span className="text-white font-medium">{REPORTS.find(r => r.id === selectedReport)?.name}</span>
          </div>
          {renderReport(selectedReport)}
        </div>
      )}

      {/* Report Builder */}
      {activeTab === 'builder' && <ReportBuilder allData={allData} dateRange={dateRange} />}
    </div>
  )
}
