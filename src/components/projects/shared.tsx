'use client'

import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react'

// ============ THEME ============
export const THEME = {
  bg: 'bg-white', bgAlt: 'bg-slate-50', border: 'border-slate-200',
  textPrimary: 'text-slate-900', textSecondary: 'text-slate-700',
  textMuted: 'text-slate-500', textDim: 'text-slate-400',
  accent: 'text-emerald-600', accentBg: 'bg-emerald-600',
}

export const COLORS = {
  emerald: '#059669', blue: '#2563eb', amber: '#d97706', rose: '#e11d48',
  cyan: '#0891b2', purple: '#7c3aed', orange: '#ea580c', slate: '#94a3b8',
  indigo: '#4f46e5', teal: '#0d9488',
}

export const PROJECT_STATUSES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  active: { label: 'Active', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  completed: { label: 'Completed', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  on_hold: { label: 'On Hold', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  prospect: { label: 'Prospect', bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' },
  archived: { label: 'Archived', bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200' },
}

// ============ CONTRACT TYPES ============
export type ContractType = 'lump_sum' | 'time_and_materials'

export function getContractType(project: any): ContractType {
  const bt = (project.budget_type || project.contract_type || '').toLowerCase()
  if (bt.includes('t_m') || bt.includes('time') || bt.includes('hourly')) return 'time_and_materials'
  return 'lump_sum'
}

export function getContractLabel(type: ContractType): string {
  return type === 'lump_sum' ? 'Lump Sum' : 'T&M'
}

export function getContractBadge(type: ContractType) {
  return type === 'lump_sum'
    ? { label: 'LS', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' }
    : { label: 'T&M', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' }
}

// ============ SERVICE LINE ============
// Derived from project.service_line field, or inferred from project name
const SERVICE_LINE_KEYWORDS: Record<string, string[]> = {
  'Design': ['design', 'architect'],
  'Schedule': ['schedule', 'scheduling', 'planning'],
  'Procurement': ['procurement', 'purchasing', 'sourcing'],
  'Prequalification': ['prequal', 'prequalification', 'qualification'],
  'Doc Control': ['doc control', 'document', 'documentation'],
  'Cost Management': ['cost', 'estimat', 'budget'],
  'Project Controls': ['controls', 'project controls', 'reporting'],
  'Construction Management': ['construction', 'cm', 'field'],
  'Program Management': ['program'],
}

export function getServiceLine(project: any): string {
  if (project.service_line) return project.service_line
  const name = (project.name || '').toLowerCase()
  for (const [line, keywords] of Object.entries(SERVICE_LINE_KEYWORDS)) {
    if (keywords.some(kw => name.includes(kw))) return line
  }
  return 'General'
}

export const SERVICE_LINE_COLORS: Record<string, string> = {
  'Design': COLORS.blue, 'Schedule': COLORS.amber, 'Procurement': COLORS.emerald,
  'Prequalification': COLORS.cyan, 'Doc Control': COLORS.purple,
  'Cost Management': COLORS.orange, 'Project Controls': COLORS.indigo,
  'Construction Management': COLORS.teal, 'Program Management': COLORS.rose,
  'General': COLORS.slate,
}

// ============ LUMP SUM ECONOMICS ============
/**
 * LS = quoted a fee, delivering scope.
 * Fee Earned = % complete × fee — what you've earned so far
 * Margin on Earned = (fee earned - costs) / fee earned
 * Projected Margin = if current cost ratio holds, where does margin land?
 */
export function calculateLS(project: any, opts?: { coValue?: number; coSpent?: number }) {
  const fee = (project.budget || 0) + (opts?.coValue || 0)
  const costs = (project.spent || 0) + (opts?.coSpent || 0)
  const pctComplete = project.percent_complete || 0

  const feeEarned = fee * (pctComplete / 100)
  const overUnder = feeEarned - costs // positive = under budget (good)
  const marginOnEarned = feeEarned > 0 ? (overUnder / feeEarned) * 100 : 0

  // Projected: if cost/completion ratio holds
  const costPerPctPoint = pctComplete > 0 ? costs / pctComplete : 0
  const projectedTotalCost = costPerPctPoint * 100
  const projectedProfit = fee - projectedTotalCost
  const projectedMargin = fee > 0 ? (projectedProfit / fee) * 100 : 0

  const remaining = fee - costs

  return {
    fee, costs, pctComplete, feeEarned, overUnder, marginOnEarned,
    projectedTotalCost, projectedProfit, projectedMargin, remaining,
    contractType: 'lump_sum' as ContractType,
  }
}

// ============ T&M ECONOMICS ============
/**
 * T&M = billing hours against a cap.
 * Billed = hours × bill rate
 * Cap Remaining = contract ceiling - billed
 * Margin = (billed - costs) / billed
 */
export function calculateTM(project: any, opts?: {
  totalHours?: number; billableHours?: number; billRate?: number
  coValue?: number; coSpent?: number
}) {
  const cap = (project.budget || 0) + (opts?.coValue || 0)
  const costs = (project.spent || 0) + (opts?.coSpent || 0)
  const billRate = opts?.billRate || project.bill_rate || 0
  const billableHours = opts?.billableHours || 0
  const totalHours = opts?.totalHours || 0

  const billed = billableHours * billRate
  const capRemaining = cap - billed
  const capUtilization = cap > 0 ? (billed / cap) * 100 : 0
  const margin = billed > 0 ? ((billed - costs) / billed) * 100 : 0
  const profit = billed - costs

  // Hours capacity: at current cost/hr, how many more hours before cap
  const costPerHour = totalHours > 0 ? costs / totalHours : 0
  const hoursRemainingAtCap = costPerHour > 0 ? capRemaining / costPerHour : 0

  return {
    cap, costs, billed, capRemaining, capUtilization, margin, profit,
    billRate, billableHours, totalHours, costPerHour, hoursRemainingAtCap,
    contractType: 'time_and_materials' as ContractType,
  }
}

// ============ UNIFIED PROJECT ECONOMICS ============
export function calculateProjectEconomics(project: any, opts?: {
  coValue?: number; coSpent?: number
  totalHours?: number; billableHours?: number; billRate?: number
  monthsActive?: number
}) {
  const contractType = getContractType(project)
  const coValue = opts?.coValue || 0
  const coSpent = opts?.coSpent || 0
  const totalContract = (project.budget || 0) + coValue
  const totalCosts = (project.spent || 0) + coSpent
  const margin = totalContract > 0 ? ((totalContract - totalCosts) / totalContract) * 100 : 0
  const grossProfit = totalContract - totalCosts
  const monthsActive = opts?.monthsActive || getMonthsActive(project.start_date)
  const monthlyBurn = monthsActive > 0 ? totalCosts / monthsActive : 0
  const remaining = totalContract - totalCosts
  const monthsRemaining = monthlyBurn > 0 ? remaining / monthlyBurn : 0

  const ls = contractType === 'lump_sum' ? calculateLS(project, { coValue, coSpent }) : null
  const tm = contractType === 'time_and_materials' ? calculateTM(project, { ...opts, coValue, coSpent }) : null

  return {
    contractType, totalContract, totalCosts, margin, grossProfit,
    monthlyBurn, remaining, monthsRemaining, ls, tm,
  }
}

export function getMonthsActive(startDate?: string): number {
  if (!startDate) return 1
  const start = new Date(startDate)
  const now = new Date()
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  return Math.max(months, 1)
}

// ============ FORMATTERS ============
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}
export function formatCompactCurrency(value: number): string {
  if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(0)}k`
  return formatCurrency(value)
}
export function formatPercent(value: number): string { return `${value.toFixed(1)}%` }
export function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
export function formatVariance(value: number): string { return `${value >= 0 ? '+' : ''}${formatCurrency(value)}` }

// ============ PERIOD FILTER ============
export interface PeriodRange { start: Date; end: Date }
export function getPeriodRange(period: string): PeriodRange | null {
  const now = new Date(); const year = now.getFullYear()
  switch (period) {
    case 'ytd': return { start: new Date(year, 0, 1), end: now }
    case 'q1': return { start: new Date(year, 0, 1), end: new Date(year, 2, 31) }
    case 'q2': return { start: new Date(year, 3, 1), end: new Date(year, 5, 30) }
    case 'q3': return { start: new Date(year, 6, 1), end: new Date(year, 8, 30) }
    case 'q4': return { start: new Date(year, 9, 1), end: new Date(year, 11, 31) }
    case 'jan': return { start: new Date(year, 0, 1), end: new Date(year, 0, 31) }
    case 'feb': return { start: new Date(year, 1, 1), end: new Date(year, 1, 28) }
    case 'mar': return { start: new Date(year, 2, 1), end: new Date(year, 2, 31) }
    case 'apr': return { start: new Date(year, 3, 1), end: new Date(year, 3, 30) }
    case 'may': return { start: new Date(year, 4, 1), end: new Date(year, 4, 31) }
    case 'jun': return { start: new Date(year, 5, 1), end: new Date(year, 5, 30) }
    case 'last30': { const d = new Date(now); d.setDate(d.getDate() - 30); return { start: d, end: now } }
    case 'last90': { const d = new Date(now); d.setDate(d.getDate() - 90); return { start: d, end: now } }
    case 'all': return null
    default: return null
  }
}
export function filterByPeriod<T extends Record<string, any>>(items: T[], dateField: string, range: PeriodRange | null): T[] {
  if (!range) return items
  return items.filter(item => { const d = new Date(item[dateField]); return d >= range.start && d <= range.end })
}

// ============ COMPONENTS ============
export function KPICard({ label, value, subtitle, icon: Icon, color = 'emerald', trend }: {
  label: string; value: string; subtitle?: string; icon?: any; color?: string; trend?: 'up' | 'down' | 'flat'
}) {
  const colorMap: Record<string, { bg: string; text: string; icon: string }> = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', icon: 'text-emerald-500' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', icon: 'text-blue-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', icon: 'text-amber-500' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-600', icon: 'text-rose-500' },
    cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', icon: 'text-cyan-500' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', icon: 'text-purple-500' },
    slate: { bg: 'bg-slate-50', text: 'text-slate-600', icon: 'text-slate-500' },
  }
  const c = colorMap[color] || colorMap.emerald
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
        <div className="flex items-center gap-1">
          {trend === 'up' && <TrendingUp size={12} className="text-emerald-500" />}
          {trend === 'down' && <TrendingDown size={12} className="text-rose-500" />}
          {trend === 'flat' && <Minus size={12} className="text-slate-400" />}
          {Icon && <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center`}><Icon size={14} className={c.icon} /></div>}
        </div>
      </div>
      <div className={`text-2xl font-bold ${c.text}`}>{value}</div>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const config = PROJECT_STATUSES[status] || PROJECT_STATUSES.active
  return <span className={`px-2 py-0.5 text-[11px] font-semibold rounded ${config.bg} ${config.text} border ${config.border}`}>{config.label}</span>
}

export function ContractBadge({ type }: { type: ContractType }) {
  const c = getContractBadge(type)
  return <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${c.bg} ${c.text} border ${c.border}`}>{c.label}</span>
}

export function MarginBadge({ value }: { value: number }) {
  const bg = value >= 20 ? 'bg-emerald-50' : value >= 10 ? 'bg-amber-50' : 'bg-rose-50'
  const text = value >= 20 ? 'text-emerald-700' : value >= 10 ? 'text-amber-700' : 'text-rose-700'
  return <span className={`px-2 py-0.5 text-[11px] font-bold rounded ${bg} ${text} tabular-nums`}>{formatPercent(value)}</span>
}

export function MarginIndicator({ value }: { value: number }) {
  const color = value >= 20 ? 'text-emerald-600' : value >= 10 ? 'text-amber-600' : value >= 0 ? 'text-amber-600' : 'text-rose-600'
  return <span className={`font-semibold tabular-nums ${color}`}>{formatPercent(value)}</span>
}

export function VarianceIndicator({ value }: { value: number }) {
  return <span className={`text-sm font-semibold tabular-nums ${value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatVariance(value)}</span>
}

export function ProgressBar({ value, max, size = 'sm', color = 'emerald', showLabel = true }: {
  value: number; max: number; size?: 'sm' | 'md'; color?: string; showLabel?: boolean
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const isOver = value > max && max > 0
  const barColor = isOver ? 'bg-rose-500' : color === 'emerald' ? 'bg-emerald-500' : color === 'blue' ? 'bg-blue-500' : color === 'amber' ? 'bg-amber-500' : 'bg-slate-400'
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${size === 'md' ? 'h-2.5' : 'h-1.5'} bg-slate-100 rounded-full overflow-hidden`}>
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      {showLabel && <span className="text-[11px] text-slate-400 tabular-nums w-8 text-right">{pct.toFixed(0)}%</span>}
    </div>
  )
}

export function SlicerButton({ label, value, options, onChange }: {
  label: string; value: string; options: { id: string; label: string }[]; onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.id === value)
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-sm transition-colors">
        <span className="text-slate-400">{label}:</span><span className="font-medium text-slate-700">{selected?.label || value}</span><ChevronDown size={14} className="text-slate-400" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 min-w-[160px] max-h-[260px] overflow-y-auto">
          {options.map(o => (
            <button key={o.id} onClick={() => { onChange(o.id); setOpen(false) }}
              className={`block w-full text-left px-3 py-1.5 text-sm transition-colors ${o.id === value ? 'text-emerald-600 bg-emerald-50 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}>{o.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

export function CustomTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      {label && <div className="font-medium text-slate-700 mb-1">{label}</div>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-500">{entry.name}:</span>
          <span className="font-semibold text-slate-900">{formatter ? formatter(entry.value) : entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return <div className="flex flex-col items-center justify-center py-12 text-slate-400"><Icon size={28} className="mb-2" /><span className="text-sm">{message}</span></div>
}

export function WaterfallItem({ label, value, isTotal = false }: { label: string; value: string; isTotal?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-2 ${isTotal ? 'border-t-2 border-slate-300 pt-3 mt-1' : ''}`}>
      <span className={`text-sm ${isTotal ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>{label}</span>
      <span className={`text-sm tabular-nums ${isTotal ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{value}</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// BLUEPRINT BRANDING + REVENUE RECOGNITION ENGINE (v2 rebuild)
// Everything below is additive — legacy exports above remain untouched so
// old components keep compiling during the file-by-file deploy sequence.
// ═══════════════════════════════════════════════════════════════════════

// ============ BLUEPRINT THEME TOKENS ============
export const BLUEPRINT = {
  blue: '#2563eb', blueDark: '#1d4ed8', blueSoft: '#dbeafe',
  copper: '#ea8a2f', copperSoft: '#ffedd5',
  midnight: '#161C1F', emerald: '#10B981', mint: '#6EE7B7',
  slate400: '#94a3b8', slate500: '#64748b',
  fontDisplay: "'Archivo', sans-serif",
  pinstripe: 'repeating-linear-gradient(135deg, rgba(37,99,235,0.06) 0 1px, transparent 1px 7px)',
}

// ============ DATE PRIMITIVES (timezone-proof: string math only) ============
export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export function monthKeyOf(iso: string): string { return (iso || '').slice(0, 7) } // 'YYYY-MM'
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1] || monthKey
}
/** List of 'YYYY-MM' keys from start month through end month, inclusive. */
export function monthRange(startKey: string, endKey: string): string[] {
  if (!startKey || !endKey || startKey > endKey) return []
  const out: string[] = []
  let [y, m] = startKey.split('-').map(Number)
  const [ey, em] = endKey.split('-').map(Number)
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++; if (m > 12) { m = 1; y++ }
  }
  return out
}
export function daysUntil(iso: string, todayIso: string): number {
  const p = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) }
  return Math.round((p(iso) - p(todayIso)) / 86400000)
}

// ============ LUMP SUM RECOGNITION ============
// Rule (locked): fixed_amount = MONTHLY fee. A month is recognized in full
// the moment it starts. Recognition hard-stops at the project end date.
// No future months are ever counted.
export interface LSRecognition {
  monthlyFee: number
  recognizedMonths: string[]   // 'YYYY-MM' keys actually recognized
  recognized: number           // total $ recognized to date
  ended: boolean               // end date is in the past
  missingEndDate: boolean      // LS cannot reconcile without an end date
  missingStartDate: boolean
  endsInDays: number | null    // days until end date (negative = ended)
}
export function calcLSRecognition(project: any, todayIso?: string): LSRecognition {
  const today = todayIso || todayISO()
  const monthlyFee = project.fixed_amount || 0
  const start = (project.start_date || '').slice(0, 10)
  const end = (project.end_date || '').slice(0, 10)
  const missingStartDate = !start
  const missingEndDate = !end
  if (missingStartDate || monthlyFee <= 0) {
    return { monthlyFee, recognizedMonths: [], recognized: 0, ended: false, missingEndDate, missingStartDate, endsInDays: end ? daysUntil(end, today) : null }
  }
  // Recognize from start month through min(current month, end month)
  const capKey = missingEndDate ? monthKeyOf(today) : (monthKeyOf(end) < monthKeyOf(today) ? monthKeyOf(end) : monthKeyOf(today))
  const recognizedMonths = monthRange(monthKeyOf(start), capKey)
  return {
    monthlyFee,
    recognizedMonths,
    recognized: recognizedMonths.length * monthlyFee,
    ended: !missingEndDate && end < today,
    missingEndDate,
    missingStartDate,
    endsInDays: end ? daysUntil(end, today) : null,
  }
}
/** $ recognized for ONE specific month ('YYYY-MM') — for the monthly chart. */
export function lsAmountForMonth(project: any, monthKey: string, todayIso?: string): number {
  const rec = calcLSRecognition(project, todayIso)
  return rec.recognizedMonths.includes(monthKey) ? rec.monthlyFee : 0
}

// ============ T&M RATE RESOLUTION ============
// EXACT mirror of Time Tracking's logic so both pages always agree:
//   per_scope billing → project scope rate overrides everyone
//   otherwise         → rate card (member × client) > entry stored > assignment > 0
export function buildRateLookups(billRates: any[], assignments: any[]) {
  const rateCardLookup: Record<string, any> = {}
  ;(billRates || []).forEach((r: any) => { if (r.is_active) rateCardLookup[`${r.team_member_id}_${r.client_id}`] = r })
  const assignmentLookup: Record<string, any> = {}
  ;(assignments || []).forEach((a: any) => { assignmentLookup[`${a.team_member_id}_${a.project_id}`] = a })
  return { rateCardLookup, assignmentLookup }
}
export function resolveBillRate(entry: any, project: any, rateCardLookup: Record<string, any>, assignmentLookup: Record<string, any>): number {
  if (project?.billing_model === 'per_scope') return project?.bill_rate || 0
  const memberId = entry.contractor_id || entry.user_id || ''
  const clientId = project?.client_id || ''
  const rateCard = rateCardLookup[`${memberId}_${clientId}`]
  const assignment = assignmentLookup[`${memberId}_${entry.project_id}`]
  return rateCard?.rate || entry.bill_rate || assignment?.bill_rate || 0
}
/** Revenue for one raw time_entries row. billable_hours ?? hours × resolved rate. */
export function entryRevenue(entry: any, project: any, rateCardLookup: Record<string, any>, assignmentLookup: Record<string, any>): number {
  if (entry.is_billable === false) return 0
  const hours = entry.billable_hours != null ? entry.billable_hours : (entry.hours || 0)
  return hours * resolveBillRate(entry, project, rateCardLookup, assignmentLookup)
}

// ============ PROJECT REVENUE (unified, revenue-only) ============
export interface ProjectRevenue {
  type: ContractType
  recognized: number        // $ earned to date (LS: months elapsed × fee; T&M: hours × rate)
  thisMonth: number         // $ recognized in the current month
  basisLabel: string        // "$14k / mo" | "$240 / hr" | "Resource rates"
  hours: number             // actual submitted hours (T&M and LS alike, for reference)
  ls: LSRecognition | null
}
export function calcProjectRevenue(
  project: any,
  projectEntries: any[],
  rateCardLookup: Record<string, any>,
  assignmentLookup: Record<string, any>,
  todayIso?: string
): ProjectRevenue {
  const today = todayIso || todayISO()
  const curMonth = monthKeyOf(today)
  const type = getContractType(project)
  const hours = (projectEntries || []).reduce((s, e) => s + (e.hours || 0), 0)

  if (type === 'lump_sum') {
    const ls = calcLSRecognition(project, today)
    return {
      type, recognized: ls.recognized,
      thisMonth: ls.recognizedMonths.includes(curMonth) ? ls.monthlyFee : 0,
      basisLabel: ls.monthlyFee > 0 ? `${formatCompactCurrency(ls.monthlyFee)} / mo` : 'No fee set',
      hours, ls,
    }
  }
  // T&M
  let recognized = 0, thisMonth = 0
  ;(projectEntries || []).forEach(e => {
    const rev = entryRevenue(e, project, rateCardLookup, assignmentLookup)
    recognized += rev
    if (monthKeyOf(e.date) === curMonth) thisMonth += rev
  })
  const basisLabel = project.billing_model === 'per_scope' && project.bill_rate
    ? `$${project.bill_rate} / hr`
    : 'Resource rates'
  return { type, recognized, thisMonth, basisLabel, hours, ls: null }
}

// ============ RENEWAL WATCH ============
/** Active LS projects whose end date falls within `windowDays` from today. */
export function getRenewalWatch(projects: any[], todayIso?: string, windowDays = 60) {
  const today = todayIso || todayISO()
  return (projects || [])
    .filter(p => (p.status || 'active') === 'active' && getContractType(p) === 'lump_sum' && p.end_date)
    .map(p => ({ project: p, days: daysUntil((p.end_date || '').slice(0, 10), today) }))
    .filter(x => x.days >= 0 && x.days <= windowDays)
    .sort((a, b) => a.days - b.days)
}
