'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { 
  Search, Filter, Download, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Clock, Plus, Edit2, X, Check, Trash2, Calendar, Users, DollarSign, BarChart3,
  TrendingUp, TrendingDown, Target, PieChart, Activity, Building2, User, Briefcase,
  CheckCircle, AlertCircle, RefreshCw, Eye, EyeOff, ArrowUpDown, Percent, Layers,
  Lock, Unlock
} from 'lucide-react'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart as RechartsPie, Pie, LineChart, Line, Legend, Area, AreaChart
} from 'recharts'
import { getCurrentUser } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jmahfgpbtjeomuepfozf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYWhmZ3BidGplb211ZXBmb3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0OTAxNzcsImV4cCI6MjA4MTA2NjE3N30.3SVDvWCGIYYHV57BpKjpDJVCZLKzuRv8B_VietQDxUQ'
)

// ============ TYPES ============
interface TimeEntry {
  id: string
  date: string
  hours: number           // Actual hours (submitted by contractor) → drives COST
  billable_hours: number  // Adjusted hours (set by manager) → drives REVENUE
  is_billable: boolean
  team_member_id: string
  team_member_name: string
  project_id: string
  project_name: string
  client_id: string
  client_name: string
  bill_rate: number       // Revenue rate (what client pays per hour)
  cost_rate: number       // Cost rate (adjusted for totals — hours × cost_rate = true fixed cost)
  display_cost_rate: number // Display rate (monthly ÷ 172 for LS, same as cost_rate for hourly)
  notes: string | null
}

interface TeamMember {
  id: string
  name: string
  email: string
  status: string
  employment_type: string
  cost_type?: string
  cost_amount?: number
  baseline_hours?: number
}

interface Project {
  id: string
  name: string
  client: string
  client_id: string
  bill_rate?: number
}

interface Client {
  id: string
  name: string
}

interface ProjectAssignment {
  id: string
  team_member_id: string
  project_id: string
  payment_type: 'lump_sum' | 'tm'
  rate: number       // Cost rate
  bill_rate?: number // Revenue rate
}

// ============ COST UTILITIES ============
const normalizeCostType = (t: string) => (t || '').toLowerCase().replace(/\s+/g, '_')
const STANDARD_MONTHLY_HOURS = 172 // Standard full-time hours for effective hourly conversion

/** Check if a member has a fixed monthly cost (any variant of lump_sum) */
function isFixedCostMember(m: TeamMember): boolean {
  const ct = normalizeCostType(m.cost_type || '')
  return (ct === 'lump_sum' || ct === 'lumpsum' || ct === 'fixed' || ct === 'monthly') && (m.cost_amount || 0) > 0
}

/** Get effective hourly display rate for fixed cost members */
function getDisplayCostRate(m: TeamMember): number {
  if (isFixedCostMember(m)) return (m.cost_amount || 0) / STANDARD_MONTHLY_HOURS
  if (normalizeCostType(m.cost_type || '') === 'hourly') return m.cost_amount || 0
  return 0
}

/**
 * Cap aggregated costs for fixed-cost members.
 * After summing hours × rate, if total exceeds the monthly fixed amount,
 * scale down proportionally so total = fixed × months in period.
 * This is a safety net — adjustEntriesForFixedCosts should handle it at entry level,
 * but this guarantees correctness at the display level.
 */
function capFixedCostsForMembers(
  memberCosts: { id: string; totalCost: number; clients?: Record<string, { cost: number }> }[],
  teamMembers: TeamMember[],
  billRates: any[],
  periodStart: string,
  periodEnd: string
) {
  const monthsInPeriod = calcMonthsInPeriod(periodStart, periodEnd)
  
  // Build rate-card LS lookup (per member+client fixed costs)
  const rcLS: Record<string, number> = {}
  ;(billRates || []).forEach((r: any) => {
    if (r.is_active && r.cost_amount > 0 && normalizeCostType(r.cost_type) !== 'hourly') {
      rcLS[`${r.team_member_id}_${r.client_id}`] = r.cost_amount
    }
  })
  
  memberCosts.forEach(mc => {
    const tm = teamMembers.find(m => m.id === mc.id)
    if (!tm || !isFixedCostMember(tm)) return
    
    // Check if any rate cards handle this member's costs per-client
    const hasRateCardLS = Object.keys(rcLS).some(k => k.startsWith(mc.id + '_'))
    
    if (!hasRateCardLS) {
      // Pure member-level LS: cap total cost
      const maxCost = (tm.cost_amount || 0) * monthsInPeriod
      if (mc.totalCost > maxCost && mc.totalCost > 0) {
        const ratio = maxCost / mc.totalCost
        mc.totalCost = maxCost
        if (mc.clients) {
          Object.values(mc.clients).forEach(c => { c.cost = c.cost * ratio })
        }
      } else if (mc.totalCost < maxCost) {
        // Under-billed hours — cost should still be the full fixed amount
        const ratio = mc.totalCost > 0 ? maxCost / mc.totalCost : 1
        mc.totalCost = maxCost
        if (mc.clients) {
          Object.values(mc.clients).forEach(c => { c.cost = c.cost * ratio })
        }
      }
    }
  })
}

/** Calculate fractional months in a date range */
function calcMonthsInPeriod(periodStart: string, periodEnd: string): number {
  const start = new Date(periodStart + 'T00:00:00')
  const end = new Date(periodEnd + 'T23:59:59')
  let totalFraction = 0
  const d = new Date(start.getFullYear(), start.getMonth(), 1)
  while (d <= end) {
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const daysInMonth = monthEnd.getDate()
    const rangeStart = start > monthStart ? start : monthStart
    const rangeEnd = end < new Date(monthEnd.getFullYear(), monthEnd.getMonth(), monthEnd.getDate(), 23, 59, 59) ? end : monthEnd
    const daysInRange = Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
    totalFraction += Math.min(daysInRange / daysInMonth, 1)
    d.setMonth(d.getMonth() + 1)
  }
  return Math.max(totalFraction, 0.01)
}

/**
 * For lump sum cost members, recalculates cost_rate so that
 * total cost across all entries = fixed monthly cost × months in period.
 * Distribution is proportional to hours worked per client/project.
 *
 * Two tiers:
 *   1. Rate-card-level LS (e.g., Julio's GOOGL at $13,525/mo) → cap per member+client
 *   2. Member-level LS (e.g., Travis at $25K/mo, Emily at $35K/mo) → cap across ALL clients
 */
function adjustEntriesForFixedCosts(
  entries: TimeEntry[],
  teamMembers: TeamMember[],
  billRates: any[],
  periodStart: string,
  periodEnd: string
): TimeEntry[] {
  if (!entries.length) return entries

  const monthsInPeriod = calcMonthsInPeriod(periodStart, periodEnd)

  // Build lookup of rate cards with LS cost at the rate-card level
  const lsRateCards: Record<string, number> = {} // key: memberId_clientId → monthly cost
  ;(billRates || []).forEach((r: any) => {
    if (r.is_active && r.cost_amount > 0 && normalizeCostType(r.cost_type) !== 'hourly') {
      lsRateCards[`${r.team_member_id}_${r.client_id}`] = r.cost_amount
    }
  })

  // Build lookup of members with LS cost at member level
  const lsMembers: Record<string, number> = {} // memberId → monthly cost
  teamMembers.forEach(m => {
    if (isFixedCostMember(m)) {
      lsMembers[m.id] = m.cost_amount || 0
    }
  })

  // Group entries by member
  const byMember: Record<string, TimeEntry[]> = {}
  entries.forEach(e => {
    if (!byMember[e.team_member_id]) byMember[e.team_member_id] = []
    byMember[e.team_member_id].push(e)
  })

  // Build a set of entries that need cost_rate adjustment
  const adjustedRates: Map<string, number> = new Map() // entry.id → new cost_rate

  Object.entries(byMember).forEach(([memberId, memberEntries]) => {
    // PRIORITY 1: Member-level LS (e.g., Travis $25K, Emily $35K)
    // If member has a fixed monthly cost, ALL their entries use it — no exceptions
    if (lsMembers[memberId]) {
      const fixedCost = lsMembers[memberId] * monthsInPeriod
      const totalHours = memberEntries.reduce((s, e) => s + e.hours, 0)
      if (totalHours > 0) {
        const adjustedRate = fixedCost / totalHours
        memberEntries.forEach(e => adjustedRates.set(e.id, adjustedRate))
      }
      return // Done with this member — skip rate-card logic
    }

    // PRIORITY 2: Rate-card-level LS (only for members WITHOUT member-level LS)
    // e.g., Julio has no member fixed cost, but GOOGL rate card = $13,525/mo
    const byClient: Record<string, TimeEntry[]> = {}
    memberEntries.forEach(e => {
      const rcKey = `${memberId}_${e.client_id}`
      if (lsRateCards[rcKey]) {
        if (!byClient[e.client_id]) byClient[e.client_id] = []
        byClient[e.client_id].push(e)
      }
    })
    Object.entries(byClient).forEach(([clientId, clientEntries]) => {
      const fixedCost = lsRateCards[`${memberId}_${clientId}`] * monthsInPeriod
      const totalHours = clientEntries.reduce((s, e) => s + e.hours, 0)
      if (totalHours > 0) {
        const adjustedRate = fixedCost / totalHours
        clientEntries.forEach(e => adjustedRates.set(e.id, adjustedRate))
      }
    })
  })

  // If no adjustments needed, return original
  if (adjustedRates.size === 0) return entries

  // Return new array with adjusted cost_rates
  return entries.map(e => {
    const newRate = adjustedRates.get(e.id)
    return newRate !== undefined ? { ...e, cost_rate: newRate } : e
  })
}

// ============ MARGIN HELPERS ============
function calcMarginPct(revenue: number, cost: number): number {
  if (revenue === 0 && cost === 0) return 0
  if (revenue === 0) return -100
  return ((revenue - cost) / revenue) * 100
}
function formatMarginPct(revenue: number, cost: number): string {
  const pct = calcMarginPct(revenue, cost)
  return `${pct.toFixed(1)}%`
}
function marginColor(pct: number): string {
  if (pct >= 30) return 'text-emerald-600'
  if (pct >= 15) return 'text-amber-600'
  if (pct >= 0) return 'text-orange-600'
  return 'text-rose-600'
}
function marginBadgeClass(pct: number): string {
  if (pct >= 30) return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  if (pct >= 15) return 'bg-amber-50 text-amber-700 border border-amber-200'
  if (pct >= 0) return 'bg-orange-50 text-orange-700 border border-orange-200'
  return 'bg-rose-50 text-rose-700 border border-rose-200'
}

// ============ CONSTANTS ============
type DatePreset = 'this_week' | 'last_week' | 'mtd' | 'last_month' | 'qtd' | 'ytd' | 'custom'

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'this_week', label: 'This Week' },
  { id: 'last_week', label: 'Last Week' },
  { id: 'mtd', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'qtd', label: 'This Quarter' },
  { id: 'ytd', label: 'This Year' },
  { id: 'custom', label: 'Custom Range' },
]

type ViewTab = 'trends' | 'byClient' | 'byEmployee' | 'detailed' | 'profitability'

const VIEW_TABS: { id: ViewTab; label: string; icon: React.ReactNode }[] = [
  { id: 'trends', label: 'Trends', icon: <Activity size={15} /> },
  { id: 'byClient', label: 'By Client', icon: <Building2 size={15} /> },
  { id: 'byEmployee', label: 'By Employee', icon: <Users size={15} /> },
  { id: 'detailed', label: 'Detailed', icon: <Calendar size={15} /> },
  { id: 'profitability', label: 'Profitability', icon: <BarChart3 size={15} /> },
]

// Emerald-based chart palette for light theme
const CHART_COLORS = ['#059669', '#0891b2', '#2563eb', '#7c3aed', '#10b981', '#d97706', '#dc2626', '#64748b']

// ============ THEME ============
const THEME = {
  card: 'bg-white border-gray-200',
  cardHover: 'hover:bg-gray-50',
  textPrimary: 'text-gray-900',
  textSecondary: 'text-gray-700',
  textMuted: 'text-gray-500',
  textDim: 'text-gray-400',
  border: 'border-gray-200',
}

// Shared tooltip style for all charts
const TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
  itemStyle: { color: '#111827' },
  labelStyle: { color: '#6b7280' },
  cursor: { fill: 'rgba(0,0,0,0.02)' },
}

// ============ UTILITIES ============
const formatCurrency = (value: number): string => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
const formatCompactCurrency = (value: number): string => { if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`; if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`; return `$${value.toFixed(0)}` }

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '—'
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatShortDate = (dateStr: string): string => {
  if (!dateStr) return '—'
  const [year, month, day] = dateStr.split('-').map(Number)
  return `${month}/${day}`
}

const getDateRange = (preset: DatePreset, customStart?: string, customEnd?: string): { start: string; end: string } => {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const day = today.getDate()
  let startStr: string, endStr: string
  switch (preset) {
    case 'this_week':
      const thisWeekStart = new Date(year, month, day)
      const dow = thisWeekStart.getDay()
      thisWeekStart.setDate(thisWeekStart.getDate() - (dow === 0 ? 6 : dow - 1))
      const thisWeekEnd = new Date(thisWeekStart); thisWeekEnd.setDate(thisWeekEnd.getDate() + 6)
      startStr = `${thisWeekStart.getFullYear()}-${String(thisWeekStart.getMonth() + 1).padStart(2, '0')}-${String(thisWeekStart.getDate()).padStart(2, '0')}`
      endStr = `${thisWeekEnd.getFullYear()}-${String(thisWeekEnd.getMonth() + 1).padStart(2, '0')}-${String(thisWeekEnd.getDate()).padStart(2, '0')}`
      break
    case 'last_week':
      const lastWeekEnd = new Date(year, month, day)
      const ldow = lastWeekEnd.getDay()
      lastWeekEnd.setDate(lastWeekEnd.getDate() - (ldow === 0 ? 7 : ldow))
      const lastWeekStart = new Date(lastWeekEnd); lastWeekStart.setDate(lastWeekStart.getDate() - 6)
      startStr = `${lastWeekStart.getFullYear()}-${String(lastWeekStart.getMonth() + 1).padStart(2, '0')}-${String(lastWeekStart.getDate()).padStart(2, '0')}`
      endStr = `${lastWeekEnd.getFullYear()}-${String(lastWeekEnd.getMonth() + 1).padStart(2, '0')}-${String(lastWeekEnd.getDate()).padStart(2, '0')}`
      break
    case 'mtd':
      startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`
      const lastDay = new Date(year, month + 1, 0).getDate()
      endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      break
    case 'last_month':
      const lmYear = month === 0 ? year - 1 : year; const lmMonth = month === 0 ? 12 : month
      startStr = `${lmYear}-${String(lmMonth).padStart(2, '0')}-01`
      const lmLastDay = new Date(lmYear, lmMonth, 0).getDate()
      endStr = `${lmYear}-${String(lmMonth).padStart(2, '0')}-${String(lmLastDay).padStart(2, '0')}`
      break
    case 'qtd':
      const quarter = Math.floor(month / 3); const qStartMonth = quarter * 3
      startStr = `${year}-${String(qStartMonth + 1).padStart(2, '0')}-01`
      const qEndMonth = qStartMonth + 2; const qLastDay = new Date(year, qEndMonth + 1, 0).getDate()
      endStr = `${year}-${String(qEndMonth + 1).padStart(2, '0')}-${String(qLastDay).padStart(2, '0')}`
      break
    case 'ytd':
      startStr = `${year}-01-01`; endStr = `${year}-12-31`; break
    case 'custom':
      startStr = customStart || `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      endStr = customEnd || `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      break
    default:
      startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`
      endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  return { start: startStr, end: endStr }
}

const getPriorPeriodRange = (start: string, end: string): { start: string; end: string } => {
  const startDate = new Date(start); const endDate = new Date(end)
  const duration = endDate.getTime() - startDate.getTime()
  const priorEnd = new Date(startDate.getTime() - 1); const priorStart = new Date(priorEnd.getTime() - duration)
  return { start: priorStart.toISOString().split('T')[0], end: priorEnd.toISOString().split('T')[0] }
}

const getWeekColumns = (start: string, end: string): { start: string; end: string; label: string }[] => {
  const weeks: { start: string; end: string; label: string }[] = []
  const startDate = new Date(start); const endDate = new Date(end)
  let current = new Date(startDate)
  const dayOfWeek = current.getDay()
  if (dayOfWeek !== 0) current.setDate(current.getDate() + (7 - dayOfWeek))
  while (current <= endDate || (current.getMonth() === endDate.getMonth() && current.getFullYear() === endDate.getFullYear())) {
    const weekEnd = current.toISOString().split('T')[0]
    const weekStart = new Date(current); weekStart.setDate(weekStart.getDate() - 6)
    weeks.push({ start: weekStart.toISOString().split('T')[0], end: weekEnd, label: formatShortDate(weekEnd) })
    current.setDate(current.getDate() + 7)
    if (current > endDate) break
  }
  return weeks
}

// ============ TOAST ============
interface Toast { id: number; type: 'success' | 'error' | 'info'; message: string }
function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div key={toast.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
          toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
          toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-blue-50 border-blue-200 text-blue-700'
        }`}>
          {toast.type === 'success' && <CheckCircle size={16} />}
          {toast.type === 'error' && <AlertCircle size={16} />}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => onDismiss(toast.id)} className="ml-2 hover:opacity-70"><X size={14} /></button>
        </div>
      ))}
    </div>
  )
}

// ============ KPI CARD — Light Theme ============
function KPICard({ title, value, format = 'number', trend, trendLabel, icon, accentColor = '#059669' }: { 
  title: string; value: number; format?: 'number' | 'currency' | 'percent' | 'hours'
  trend?: number; trendLabel?: string; icon?: React.ReactNode; accentColor?: string
}) {
  const formatValue = () => {
    switch (format) {
      case 'currency': return formatCurrency(value)
      case 'percent': return `${value.toFixed(1)}%`
      case 'hours': return `${value.toFixed(1)}`
      default: return value.toLocaleString()
    }
  }
  const isNegative = value < 0
  const valueColor = isNegative ? 'text-rose-600' : 'text-gray-900'

  return (
    <div className="relative p-4 rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
      {/* Left accent bar */}
      <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full" style={{ backgroundColor: accentColor }} />
      <div className="pl-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{title}</span>
          {icon && <span className="text-gray-400">{icon}</span>}
        </div>
        <p className={`text-2xl font-semibold ${valueColor} tabular-nums tracking-tight`}>{formatValue()}</p>
        {trend !== undefined && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {trend >= 0 ? <TrendingUp size={12} className="text-emerald-600" /> : <TrendingDown size={12} className="text-rose-600" />}
            <span className={`text-xs font-medium tabular-nums ${trend >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{trend >= 0 ? '+' : ''}{trend.toFixed(1)}%</span>
            {trendLabel && <span className="text-xs text-gray-400">{trendLabel}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// ============ COLLAPSIBLE SECTION ============
function CollapsibleSection({ title, children, defaultExpanded = true, badge, rightContent, icon }: { 
  title: string; children: React.ReactNode; defaultExpanded?: boolean; badge?: string | number
  rightContent?: React.ReactNode; icon?: React.ReactNode
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  return (
    <div className="rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden">
      <button onClick={() => setIsExpanded(!isExpanded)} className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-gray-400">{icon}</span>}
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {badge !== undefined && <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500 border border-gray-200">{badge}</span>}
        </div>
        <div className="flex items-center gap-3">
          {rightContent}
          {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>
      {isExpanded && <div className="px-5 pb-4 pt-1">{children}</div>}
    </div>
  )
}

// ============ EDITABLE CELL — for billable_hours only ============
function EditableBillableCell({ actualHours, billableHours, onSave }: { 
  actualHours: number; billableHours: number; onSave: (newValue: number) => void 
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(billableHours.toString())
  const isAdjusted = billableHours !== actualHours

  const handleSave = () => {
    const newValue = parseFloat(editValue) || 0
    if (newValue !== billableHours) onSave(newValue)
    setIsEditing(false)
  }
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') { setEditValue(billableHours.toString()); setIsEditing(false) }
  }

  if (isEditing) {
    return (
      <input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleSave} onKeyDown={handleKeyDown}
        className="w-16 px-1 py-0.5 text-right bg-white border border-amber-400 rounded text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400/40" autoFocus step="0.5" />
    )
  }
  return (
    <button onClick={() => { setEditValue(billableHours.toString()); setIsEditing(true) }}
      className={`px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 ${
        isAdjusted ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'text-gray-700 hover:bg-gray-100'
      }`} title={isAdjusted ? `Adjusted from ${actualHours.toFixed(1)}` : 'Click to adjust billable hours'}>
      {billableHours.toFixed(1)}
      {isAdjusted && <Edit2 size={10} className="text-amber-600" />}
    </button>
  )
}

// ============ MAIN PAGE ============
export default function TimeTrackingPage() {
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([])
  const [billRates, setBillRates] = useState<any[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)

  const [datePreset, setDatePreset] = useState<DatePreset>('mtd')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [selectedClient, setSelectedClient] = useState<string>('all')
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all')
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [showDatePicker, setShowDatePicker] = useState(false)

  const [activeTab, setActiveTab] = useState<ViewTab>('byClient')
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())

  const [showEntryModal, setShowEntryModal] = useState(false)
  const [formData, setFormData] = useState({ date: new Date().toISOString().split('T')[0], team_member_id: '', project_id: '', hours: '', billable_hours: '', notes: '', is_billable: true })

  // Toast
  const [toasts, setToasts] = useState<Toast[]>([])
  const addToast = useCallback((type: Toast['type'], message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const dateRange = useMemo(() => getDateRange(datePreset, customStartDate, customEndDate), [datePreset, customStartDate, customEndDate])
  const priorPeriod = useMemo(() => getPriorPeriodRange(dateRange.start, dateRange.end), [dateRange])

  // ============ DATA LOADING ============
  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await getCurrentUser()
        const user = result?.user
        if (!user) return
        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
        if (!profile?.company_id) { setLoading(false); return }
        setCompanyId(profile.company_id)

        const [teamRes, projRes, clientRes, entriesRes, assignRes, billRatesRes] = await Promise.all([
          supabase.from('team_members').select('*').eq('company_id', profile.company_id),
          supabase.from('projects').select('*').eq('company_id', profile.company_id),
          supabase.from('clients').select('*').eq('company_id', profile.company_id),
          supabase.from('time_entries').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
          supabase.from('team_project_assignments').select('*').eq('company_id', profile.company_id),
          supabase.from('bill_rates').select('*').eq('company_id', profile.company_id),
        ])

        const projectMap: Record<string, any> = {}; (projRes.data || []).forEach((p: any) => { projectMap[p.id] = p })
        const clientMap: Record<string, any> = {}; (clientRes.data || []).forEach((c: any) => { clientMap[c.id] = c })
        const teamMemberMap: Record<string, any> = {}; (teamRes.data || []).forEach((t: any) => { teamMemberMap[t.id] = t })

        // Build rate card lookup: key = `${team_member_id}_${client_id}`
        const rateCardLookup: Record<string, any> = {}
        ;(billRatesRes.data || []).forEach((r: any) => {
          if (r.is_active) rateCardLookup[`${r.team_member_id}_${r.client_id}`] = r
        })

        // Build assignment lookup: key = `${team_member_id}_${project_id}`
        const assignmentLookup: Record<string, ProjectAssignment> = {}
        ;(assignRes.data || []).forEach((a: any) => {
          assignmentLookup[`${a.team_member_id}_${a.project_id}`] = a
        })

        const transformedEntries = (entriesRes.data || []).map((e: any) => {
          const project = projectMap[e.project_id]
          const clientId = project?.client_id || ''
          const clientName = clientId ? clientMap[clientId]?.name || '' : ''
          const teamMemberId = e.contractor_id || e.user_id || ''
          const teamMember = teamMemberMap[teamMemberId]
          
          // Rate card lookup: member × client (primary source)
          const rateCard = rateCardLookup[`${teamMemberId}_${clientId}`]
          // Fallback: project assignment
          const assignment = assignmentLookup[`${teamMemberId}_${e.project_id}`]

          // BILL RATE (revenue): rate card > assignment > entry stored > 0
          const billRate = rateCard?.rate || e.bill_rate || assignment?.bill_rate || 0

          // COST RATE (two-tier model):
          // Tier 1: Rate card has custom cost (cost_amount > 0) → use it
          // Tier 2: Fall back to team member default cost
          // For lump sum costs: effective hourly = monthly / 172 (standard full-time hours)
          let costRate = 0
          
          if (rateCard && rateCard.cost_amount > 0) {
            if (normalizeCostType(rateCard.cost_type) === 'hourly') {
              costRate = rateCard.cost_amount
            } else {
              // Lump sum at rate card level: effective hourly = cost / standard hours
              costRate = rateCard.cost_amount / STANDARD_MONTHLY_HOURS
            }
          } else if (teamMember) {
            // Tier 2: team member default
            const memberCostType = normalizeCostType(teamMember.cost_type)
            if (memberCostType === 'hourly') {
              costRate = teamMember.cost_amount || 0
            } else if ((memberCostType === 'lump_sum' || memberCostType === 'lump sum') && teamMember.cost_amount > 0) {
              // Effective hourly from lump sum: always use standard 172 hours
              costRate = teamMember.cost_amount / STANDARD_MONTHLY_HOURS
            }
          }
          // Final fallback: assignment rate
          if (costRate === 0) costRate = assignment?.rate || 0
          
          return {
            id: e.id,
            date: e.date,
            hours: e.hours || 0,
            billable_hours: e.billable_hours != null ? e.billable_hours : (e.hours || 0), // Default to actual if no override
            is_billable: e.is_billable !== false,
            team_member_id: teamMemberId,
            team_member_name: teamMemberMap[teamMemberId]?.name || 'Unknown',
            project_id: e.project_id,
            project_name: project?.name || 'Unknown',
            client_id: clientId,
            client_name: clientName,
            bill_rate: billRate,
            cost_rate: costRate,
            display_cost_rate: costRate,
            notes: e.description || null
          }
        })

        setTeamMembers((teamRes.data || []).map((t: any) => ({ id: t.id, name: t.name || '', email: t.email || '', status: t.status || 'active', employment_type: t.employment_type || 'contractor', cost_type: t.cost_type || 'hourly', cost_amount: t.cost_amount || 0, baseline_hours: t.baseline_hours || 172 })))
        setProjects((projRes.data || []).map((p: any) => ({ id: p.id, name: p.name || '', client: p.client || '', client_id: p.client_id || '', bill_rate: p.bill_rate || 0 })))
        setClients((clientRes.data || []).map((c: any) => ({ id: c.id, name: c.name || '' })))
        setAssignments(assignRes.data || [])
        setBillRates(billRatesRes.data || [])
        setEntries(transformedEntries)
        if (clientRes.data && clientRes.data.length > 0) setExpandedClients(new Set([clientRes.data[0].id]))
      } catch (error) { console.error('Error loading data:', error) }
      finally { setLoading(false) }
    }
    loadData()
  }, [])

  // ============ FILTERS ============
  // ============ DATE-ONLY FILTERED ENTRIES (for cost allocation) ============
  // Cost allocation must see ALL entries in the date range to distribute LS costs proportionally.
  // Display filters (client/project/employee) are applied AFTER cost adjustment.
  const dateOnlyEntries = useMemo(() => entries.filter(entry =>
    entry.date >= dateRange.start && entry.date <= dateRange.end
  ), [entries, dateRange])

  const dateOnlyPriorEntries = useMemo(() => entries.filter(entry =>
    entry.date >= priorPeriod.start && entry.date <= priorPeriod.end
  ), [entries, priorPeriod])

  // ============ FIXED COST ADJUSTMENT (runs on ALL entries, unfiltered by client/project/employee) ============
  // Recalculate cost_rate for lump sum members so total cost = fixed monthly amount
  const allCostAdjustedEntries = useMemo(() => 
    adjustEntriesForFixedCosts(dateOnlyEntries, teamMembers, billRates, dateRange.start, dateRange.end),
    [dateOnlyEntries, teamMembers, billRates, dateRange]
  )
  const allCostAdjustedPriorEntries = useMemo(() => 
    adjustEntriesForFixedCosts(dateOnlyPriorEntries, teamMembers, billRates, priorPeriod.start, priorPeriod.end),
    [dateOnlyPriorEntries, teamMembers, billRates, priorPeriod]
  )

  // ============ DISPLAY FILTERS (applied AFTER cost allocation) ============
  const costAdjustedEntries = useMemo(() => allCostAdjustedEntries.filter(entry => {
    if (selectedClient !== 'all' && entry.client_id !== selectedClient) return false
    if (selectedEmployee !== 'all' && entry.team_member_id !== selectedEmployee) return false
    if (selectedProject !== 'all' && entry.project_id !== selectedProject) return false
    return true
  }), [allCostAdjustedEntries, selectedClient, selectedEmployee, selectedProject])

  const costAdjustedPriorEntries = useMemo(() => allCostAdjustedPriorEntries.filter(entry => {
    if (selectedClient !== 'all' && entry.client_id !== selectedClient) return false
    if (selectedEmployee !== 'all' && entry.team_member_id !== selectedEmployee) return false
    if (selectedProject !== 'all' && entry.project_id !== selectedProject) return false
    return true
  }), [allCostAdjustedPriorEntries, selectedClient, selectedEmployee, selectedProject])

  // ============ KPIs — DUAL LAYER ============
  const kpis = useMemo(() => {
    const totalActualHours = costAdjustedEntries.reduce((sum, e) => sum + e.hours, 0)
    const totalBillableHours = costAdjustedEntries.reduce((sum, e) => sum + (e.is_billable ? e.billable_hours : 0), 0)
    const totalCost = costAdjustedEntries.reduce((sum, e) => sum + (e.hours * e.cost_rate), 0)
    const totalRevenue = costAdjustedEntries.reduce((sum, e) => sum + (e.is_billable ? e.billable_hours * e.bill_rate : 0), 0)
    const grossMargin = totalRevenue - totalCost
    const marginPct = calcMarginPct(totalRevenue, totalCost)
    const avgBillRate = totalBillableHours > 0 ? totalRevenue / totalBillableHours : 0
    const avgCostRate = totalActualHours > 0 ? totalCost / totalActualHours : 0

    const priorHours = costAdjustedPriorEntries.reduce((sum, e) => sum + e.hours, 0)
    const priorRevenue = costAdjustedPriorEntries.reduce((sum, e) => sum + (e.is_billable ? (e.billable_hours || e.hours) * e.bill_rate : 0), 0)
    const priorCost = costAdjustedPriorEntries.reduce((sum, e) => sum + (e.hours * e.cost_rate), 0)
    
    const activeMembers = teamMembers.filter(m => m.status === 'active')
    const totalCapacity = activeMembers.length * 160
    const utilization = totalCapacity > 0 ? (totalActualHours / totalCapacity) * 100 : 0

    const hoursTrend = priorHours > 0 ? ((totalActualHours - priorHours) / priorHours) * 100 : 0
    const revenueTrend = priorRevenue > 0 ? ((totalRevenue - priorRevenue) / priorRevenue) * 100 : 0
    const costTrend = priorCost > 0 ? ((totalCost - priorCost) / priorCost) * 100 : 0

    return { totalActualHours, totalBillableHours, totalCost, totalRevenue, grossMargin, marginPct, avgBillRate, avgCostRate, utilization, hoursTrend, revenueTrend, costTrend, uniqueClients: new Set(costAdjustedEntries.map(e => e.client_id).filter(Boolean)).size }
  }, [costAdjustedEntries, costAdjustedPriorEntries, teamMembers])

  const weekColumns = useMemo(() => getWeekColumns(dateRange.start, dateRange.end), [dateRange])

  // ============ BY CLIENT DATA ============
  const dataByClient = useMemo(() => {
    const clientData: Record<string, { id: string; name: string; totalActualHours: number; totalBillableHours: number; totalCost: number; totalRevenue: number
      projects: Record<string, { id: string; name: string; members: Record<string, { id: string; name: string; billRate: number; costRate: number; weekActualHours: Record<string, number>; weekBillableHours: Record<string, number>; totalActualHours: number; totalBillableHours: number; totalCost: number; totalRevenue: number; weekEntries: Record<string, { id: string; hours: number; billable_hours: number }[]> }>; totalActualHours: number; totalBillableHours: number; totalCost: number; totalRevenue: number }>
    }> = {}

    costAdjustedEntries.forEach(entry => {
      const clientId = entry.client_id || 'unassigned'
      const clientName = entry.client_name || 'Unassigned'
      if (!clientData[clientId]) clientData[clientId] = { id: clientId, name: clientName, totalActualHours: 0, totalBillableHours: 0, totalCost: 0, totalRevenue: 0, projects: {} }
      if (!clientData[clientId].projects[entry.project_id]) clientData[clientId].projects[entry.project_id] = { id: entry.project_id, name: entry.project_name, members: {}, totalActualHours: 0, totalBillableHours: 0, totalCost: 0, totalRevenue: 0 }
      const project = clientData[clientId].projects[entry.project_id]
      if (!project.members[entry.team_member_id]) project.members[entry.team_member_id] = { id: entry.team_member_id, name: entry.team_member_name, billRate: entry.bill_rate, costRate: entry.display_cost_rate, weekActualHours: {}, weekBillableHours: {}, totalActualHours: 0, totalBillableHours: 0, totalCost: 0, totalRevenue: 0, weekEntries: {} }
      const member = project.members[entry.team_member_id]
      
      const weekCol = weekColumns.find(w => {
        const entryDate = new Date(entry.date); const weekStart = new Date(w.start); const weekEnd = new Date(w.end); weekEnd.setHours(23, 59, 59)
        return entryDate >= weekStart && entryDate <= weekEnd
      })
      if (weekCol) {
        member.weekActualHours[weekCol.end] = (member.weekActualHours[weekCol.end] || 0) + entry.hours
        member.weekBillableHours[weekCol.end] = (member.weekBillableHours[weekCol.end] || 0) + entry.billable_hours
        if (!member.weekEntries[weekCol.end]) member.weekEntries[weekCol.end] = []
        member.weekEntries[weekCol.end].push({ id: entry.id, hours: entry.hours, billable_hours: entry.billable_hours })
      }
      member.totalActualHours += entry.hours
      member.totalBillableHours += entry.billable_hours
      member.totalCost += entry.hours * entry.cost_rate
      member.totalRevenue += entry.is_billable ? entry.billable_hours * entry.bill_rate : 0
      if (entry.bill_rate > member.billRate) member.billRate = entry.bill_rate
      if (entry.display_cost_rate > member.costRate) member.costRate = entry.display_cost_rate
    })

    Object.values(clientData).forEach(client => {
      Object.values(client.projects).forEach(project => {
        Object.values(project.members).forEach(member => {
          project.totalActualHours += member.totalActualHours; project.totalBillableHours += member.totalBillableHours
          project.totalCost += member.totalCost; project.totalRevenue += member.totalRevenue
        })
        client.totalActualHours += project.totalActualHours; client.totalBillableHours += project.totalBillableHours
        client.totalCost += project.totalCost; client.totalRevenue += project.totalRevenue
      })
    })
    return Object.values(clientData).sort((a, b) => b.totalRevenue - a.totalRevenue)
  }, [costAdjustedEntries, weekColumns])

  // ============ BY EMPLOYEE DATA ============
  const dataByEmployee = useMemo(() => {
    const employeeData: Record<string, { id: string; name: string; empType: string; totalActualHours: number; totalBillableHours: number; totalCost: number; totalRevenue: number; clients: Record<string, { name: string; actualHours: number; billableHours: number; cost: number; revenue: number }> }> = {}
    costAdjustedEntries.forEach(entry => {
      if (!employeeData[entry.team_member_id]) {
        const member = teamMembers.find(m => m.id === entry.team_member_id)
        employeeData[entry.team_member_id] = { id: entry.team_member_id, name: entry.team_member_name, empType: member?.employment_type || 'contractor', totalActualHours: 0, totalBillableHours: 0, totalCost: 0, totalRevenue: 0, clients: {} }
      }
      const emp = employeeData[entry.team_member_id]
      emp.totalActualHours += entry.hours; emp.totalBillableHours += entry.billable_hours
      emp.totalCost += entry.hours * entry.cost_rate; emp.totalRevenue += entry.is_billable ? entry.billable_hours * entry.bill_rate : 0
      const clientKey = entry.client_id || 'unassigned'
      if (!emp.clients[clientKey]) emp.clients[clientKey] = { name: entry.client_name || 'Unassigned', actualHours: 0, billableHours: 0, cost: 0, revenue: 0 }
      emp.clients[clientKey].actualHours += entry.hours; emp.clients[clientKey].billableHours += entry.billable_hours
      emp.clients[clientKey].cost += entry.hours * entry.cost_rate; emp.clients[clientKey].revenue += entry.is_billable ? entry.billable_hours * entry.bill_rate : 0
    })
    return Object.values(employeeData).sort((a, b) => b.totalActualHours - a.totalActualHours)
  }, [costAdjustedEntries, teamMembers])

  // ============ PROFITABILITY DATA ============
  const profitabilityByProject = useMemo(() => {
    const projectData: Record<string, { id: string; name: string; clientName: string; actualHours: number; billableHours: number; cost: number; revenue: number; margin: number; marginPct: number }> = {}
    costAdjustedEntries.forEach(entry => {
      if (!projectData[entry.project_id]) projectData[entry.project_id] = { id: entry.project_id, name: entry.project_name, clientName: entry.client_name, actualHours: 0, billableHours: 0, cost: 0, revenue: 0, margin: 0, marginPct: 0 }
      const p = projectData[entry.project_id]
      p.actualHours += entry.hours; p.billableHours += entry.billable_hours
      p.cost += entry.hours * entry.cost_rate; p.revenue += entry.is_billable ? entry.billable_hours * entry.bill_rate : 0
    })
    return Object.values(projectData).map(p => ({ ...p, margin: p.revenue - p.cost, marginPct: calcMarginPct(p.revenue, p.cost) })).sort((a, b) => b.margin - a.margin)
  }, [costAdjustedEntries])

  const revenueByClientData = useMemo(() => dataByClient.map((c, i) => ({ name: c.name, value: c.totalRevenue, fill: CHART_COLORS[i % CHART_COLORS.length] })), [dataByClient])

  const weeklyTrendData = useMemo(() => weekColumns.map(week => {
    const weekEntries = costAdjustedEntries.filter(e => {
      const entryDate = new Date(e.date); const weekStart = new Date(week.start); const weekEnd = new Date(week.end); weekEnd.setHours(23, 59, 59)
      return entryDate >= weekStart && entryDate <= weekEnd
    })
    return {
      week: week.label,
      actualHours: weekEntries.reduce((sum, e) => sum + e.hours, 0),
      billableHours: weekEntries.reduce((sum, e) => sum + e.billable_hours, 0),
      cost: weekEntries.reduce((sum, e) => sum + (e.hours * e.cost_rate), 0),
      revenue: weekEntries.reduce((sum, e) => sum + (e.is_billable ? e.billable_hours * e.bill_rate : 0), 0),
    }
  }), [weekColumns, costAdjustedEntries])

  // ============ ACTIONS ============
  const saveNewEntry = async () => {
    if (!companyId || !formData.team_member_id || !formData.project_id || !formData.hours) return
    try {
      const project = projects.find(p => p.id === formData.project_id)
      const teamMember = teamMembers.find(t => t.id === formData.team_member_id)
      const assignment = assignments.find(a => a.team_member_id === formData.team_member_id && a.project_id === formData.project_id)
      const clientId = project?.client_id || ''
      
      // Rate card lookup (member × client)
      const rateCard = billRates.find(r => r.team_member_id === formData.team_member_id && r.client_id === clientId && r.is_active)
      const billRate = rateCard?.rate || assignment?.bill_rate || project?.bill_rate || 0
      
      // Cost rate (two-tier) — lump sum uses standard 172h for effective hourly
      const normCostType = (t: string) => (t || '').toLowerCase().replace(/\s+/g, '_')
      let costRate = 0
      if (rateCard && rateCard.cost_amount > 0) {
        costRate = normCostType(rateCard.cost_type) === 'hourly' ? rateCard.cost_amount : rateCard.cost_amount / STANDARD_MONTHLY_HOURS
      } else if (teamMember) {
        const tm = teamMembers.find(t => t.id === formData.team_member_id) as any
        const tmType = normCostType(tm?.cost_type)
        if (tmType === 'hourly') costRate = tm.cost_amount || 0
        else if ((tmType === 'lump_sum' || tmType === 'lump sum') && tm?.cost_amount > 0) costRate = tm.cost_amount / STANDARD_MONTHLY_HOURS
      }
      if (costRate === 0) costRate = assignment?.rate || 0
      const hours = parseFloat(formData.hours)
      const billableHours = formData.billable_hours ? parseFloat(formData.billable_hours) : hours

      const { data, error } = await supabase.from('time_entries').insert({
        company_id: companyId, date: formData.date, contractor_id: formData.team_member_id,
        project_id: formData.project_id, hours, billable_hours: billableHours,
        is_billable: formData.is_billable, bill_rate: billRate, description: formData.notes || null
      }).select().single()

      if (error) throw error

      const newEntry: TimeEntry = {
        id: data.id, date: formData.date, hours, billable_hours: billableHours,
        is_billable: formData.is_billable, team_member_id: formData.team_member_id,
        team_member_name: teamMember?.name || 'Unknown', project_id: formData.project_id,
        project_name: project?.name || 'Unknown', client_id: project?.client_id || '',
        client_name: clients.find(c => c.id === project?.client_id)?.name || '',
        bill_rate: billRate, cost_rate: costRate, display_cost_rate: costRate, notes: formData.notes || null
      }
      setEntries(prev => [newEntry, ...prev])
      setShowEntryModal(false)
      setFormData({ date: new Date().toISOString().split('T')[0], team_member_id: '', project_id: '', hours: '', billable_hours: '', notes: '', is_billable: true })
      addToast('success', 'Time entry added')
    } catch (error: any) { console.error('Error saving entry:', error); addToast('error', `Failed to save: ${error.message}`) }
  }

  const updateBillableHours = async (entryId: string, newBillableHours: number) => {
    try {
      const { error } = await supabase.from('time_entries').update({ billable_hours: newBillableHours }).eq('id', entryId)
      if (error) throw error
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, billable_hours: newBillableHours } : e))
      addToast('success', 'Billable hours updated')
    } catch (error: any) { console.error('Error updating:', error); addToast('error', `Failed to update: ${error.message}`) }
  }

  const deleteEntry = async (entryId: string) => {
    if (!companyId) return
    if (!confirm('Delete this time entry?')) return
    try {
      const { error } = await supabase.from('time_entries').delete().eq('id', entryId)
      if (error) throw error
      setEntries(prev => prev.filter(e => e.id !== entryId))
      addToast('success', 'Entry deleted')
    } catch (error: any) { console.error('Error deleting:', error); addToast('error', `Failed to delete: ${error.message}`) }
  }

  const toggleClient = (clientId: string) => setExpandedClients(prev => { const next = new Set(prev); if (next.has(clientId)) next.delete(clientId); else next.add(clientId); return next })
  const toggleProject = (projectId: string) => setExpandedProjects(prev => { const next = new Set(prev); if (next.has(projectId)) next.delete(projectId); else next.add(projectId); return next })

  const exportToCSV = () => {
    const headers = ['Date', 'Employee', 'Client', 'Project', 'Actual Hours', 'Billable Hours', 'Cost Rate', 'Bill Rate', 'Cost', 'Revenue', 'Margin', 'Notes']
    const rows = costAdjustedEntries.map(e => [
      e.date, e.team_member_name, e.client_name, e.project_name, e.hours, e.billable_hours,
      e.display_cost_rate, e.bill_rate, (e.hours * e.cost_rate).toFixed(2), (e.billable_hours * e.bill_rate).toFixed(2),
      ((e.billable_hours * e.bill_rate) - (e.hours * e.cost_rate)).toFixed(2), e.notes || ''
    ])
    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob)
    link.download = `time-analytics-${dateRange.start}-to-${dateRange.end}.csv`; link.click()
    addToast('success', 'Export complete')
  }

  const getFilterTitle = () => {
    if (selectedClient !== 'all') return clients.find(c => c.id === selectedClient)?.name || ''
    if (selectedEmployee !== 'all') return teamMembers.find(t => t.id === selectedEmployee)?.name || ''
    return 'All Clients'
  }

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 text-emerald-500 animate-spin" /></div>

  // ============ SELECT STYLING ============
  const selectClass = `px-3 py-2 bg-white border ${THEME.border} rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-colors`

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Time Analytics</h1>
          <p className={`text-sm mt-0.5 ${THEME.textDim}`}>{getFilterTitle()}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportToCSV} className={`flex items-center gap-2 px-4 py-2 ${THEME.card} border hover:bg-white rounded-lg text-sm font-medium text-gray-600 transition-colors`}><Download size={16} />Export</button>
          <button onClick={() => setShowEntryModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-sm font-medium text-white transition-colors"><Plus size={16} />Add Entry</button>
        </div>
      </div>

      {/* Date Range & Filters */}
      <div className={`p-4 rounded-xl ${THEME.card} border relative z-20`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <button onClick={() => setShowDatePicker(!showDatePicker)} className={`flex items-center gap-2 px-3 py-2 bg-white border ${THEME.border} hover:bg-gray-100 rounded-lg text-sm font-medium text-gray-900 transition-colors`}>
              <Calendar size={14} className="text-emerald-600" />{DATE_PRESETS.find(p => p.id === datePreset)?.label}<ChevronDown size={14} className="text-gray-400" />
            </button>
            {showDatePicker && (
              <div className={`absolute top-full left-0 mt-2 w-56 p-2 bg-white border ${THEME.border} rounded-xl shadow-lg z-[100]`}>
                <div className="space-y-0.5">
                  {DATE_PRESETS.map(preset => (
                    <button key={preset.id} onClick={() => { setDatePreset(preset.id); if (preset.id !== 'custom') setShowDatePicker(false) }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${datePreset === preset.id ? 'bg-emerald-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{preset.label}</button>
                  ))}
                </div>
                {datePreset === 'custom' && (
                  <div className={`mt-2 pt-2 border-t ${THEME.border} space-y-2`}>
                    <div><label className={`text-xs ${THEME.textDim}`}>Start</label><input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className={`w-full mt-1 px-2 py-1.5 bg-white border ${THEME.border} rounded-lg text-sm text-gray-900`} /></div>
                    <div><label className={`text-xs ${THEME.textDim}`}>End</label><input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className={`w-full mt-1 px-2 py-1.5 bg-white border ${THEME.border} rounded-lg text-sm text-gray-900`} /></div>
                    <button onClick={() => setShowDatePicker(false)} className="w-full mt-2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-sm font-medium text-white">Apply</button>
                  </div>
                )}
              </div>
            )}
          </div>
          <span className={`text-sm ${THEME.textMuted} tabular-nums`}>{formatDate(dateRange.start)} — {formatDate(dateRange.end)}</span>
          <div className="h-5 w-px bg-gray-100" />
          <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className={selectClass}>
            <option value="all">All Clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className={selectClass}>
            <option value="all">All Employees</option>
            {teamMembers.filter(t => t.status === 'active').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} className={selectClass}>
            <option value="all">All Projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {(selectedClient !== 'all' || selectedEmployee !== 'all' || selectedProject !== 'all') && (
            <button onClick={() => { setSelectedClient('all'); setSelectedEmployee('all'); setSelectedProject('all') }} className={`flex items-center gap-1 px-3 py-2 text-sm ${THEME.textMuted} hover:text-gray-900 transition-colors`}><X size={14} />Clear</button>
          )}
        </div>
      </div>

      {/* KPI Cards — 7 metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-7 gap-3 relative z-10">
        <KPICard title="Actual Hours" value={kpis.totalActualHours} format="hours" trend={kpis.hoursTrend} trendLabel="vs prior" icon={<Clock size={15} />} accentColor="#059669" />
        <KPICard title="Billable Hours" value={kpis.totalBillableHours} format="hours" icon={<Layers size={15} />} accentColor="#0891b2" />
        <KPICard title="Revenue" value={kpis.totalRevenue} format="currency" trend={kpis.revenueTrend} trendLabel="vs prior" icon={<DollarSign size={15} />} accentColor="#059669" />
        <KPICard title="Cost" value={kpis.totalCost} format="currency" trend={kpis.costTrend} trendLabel="vs prior" icon={<TrendingDown size={15} />} accentColor="#64748b" />
        <KPICard title="Gross Margin" value={kpis.grossMargin} format="currency" icon={<TrendingUp size={15} />} accentColor={kpis.grossMargin >= 0 ? '#059669' : '#dc2626'} />
        <KPICard title="Margin %" value={kpis.marginPct} format="percent" icon={<Percent size={15} />} accentColor={kpis.marginPct >= 20 ? '#059669' : kpis.marginPct >= 0 ? '#d97706' : '#dc2626'} />
        <KPICard title="Utilization" value={kpis.utilization} format="percent" icon={<Target size={15} />} accentColor="#d97706" />
      </div>

      {/* View Tabs */}
      <div className={`flex items-center gap-1 border-b ${THEME.border} pb-0 relative z-10`}>
        {VIEW_TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === tab.id 
              ? 'border-emerald-500 text-emerald-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ============ TRENDS VIEW ============ */}
      {activeTab === 'trends' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CollapsibleSection title="Revenue by Client" icon={<PieChart size={15} />}>
            <div className="h-64">
              {revenueByClientData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie data={revenueByClientData} cx="35%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                      {revenueByClientData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} formatter={(value: number) => formatCurrency(value)} />
                    <Legend layout="vertical" align="right" verticalAlign="middle" formatter={(value) => {
                      const item = revenueByClientData.find(d => d.name === value)
                      const total = revenueByClientData.reduce((sum, d) => sum + d.value, 0)
                      const pct = item ? ((item.value / total) * 100).toFixed(0) : 0
                      return <span className="text-gray-600 text-sm">{value} ({pct}%)</span>
                    }} />
                  </RechartsPie>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-full text-gray-400">No data</div>}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Weekly Cost vs Revenue" icon={<Activity size={15} />}>
            <div className="h-64">
              {weeklyTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="week" tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => formatCompactCurrency(v)} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(value: number, name: string) => [formatCurrency(value), name === 'cost' ? 'Cost' : 'Revenue']} />
                    <Area type="monotone" dataKey="revenue" stroke="#059669" fill="#059669" fillOpacity={0.12} name="Revenue" />
                    <Area type="monotone" dataKey="cost" stroke="#64748b" fill="#64748b" fillOpacity={0.08} name="Cost" />
                    <Legend wrapperStyle={{ color: '#6b7280', fontSize: '12px' }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-full text-gray-400">No data</div>}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Hours by Employee" icon={<Users size={15} />}>
            <div className="h-64">
              {dataByEmployee.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dataByEmployee.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="totalActualHours" fill="#059669" radius={[0, 4, 4, 0]} name="Actual" />
                    <Bar dataKey="totalBillableHours" fill="#05966640" radius={[0, 4, 4, 0]} name="Billable" />
                    <Legend wrapperStyle={{ color: '#6b7280', fontSize: '12px' }} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-full text-gray-400">No data</div>}
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Hours by Project" icon={<Briefcase size={15} />}>
            <div className="h-64">
              {costAdjustedEntries.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={Object.values(costAdjustedEntries.reduce((acc, e) => { if (!acc[e.project_id]) acc[e.project_id] = { name: e.project_name.substring(0, 15), hours: 0 }; acc[e.project_id].hours += e.hours; return acc }, {} as Record<string, { name: string; hours: number }>)).sort((a, b) => b.hours - a.hours).slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(value: number) => [`${value.toFixed(1)} hrs`, 'Hours']} />
                    <Bar dataKey="hours" fill="#0891b2" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="flex items-center justify-center h-full text-gray-400">No data</div>}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* ============ BY CLIENT VIEW ============ */}
      {activeTab === 'byClient' && (
        <div className="space-y-3">
          {dataByClient.length > 0 ? dataByClient.map((client, clientIndex) => (
            <div key={client.id} className={`rounded-xl ${THEME.card} border overflow-hidden`}>
              <button onClick={() => toggleClient(client.id)} className={`w-full flex items-center justify-between px-5 py-3.5 ${THEME.cardHover} transition-colors`}>
                <div className="flex items-center gap-3">
                  {expandedClients.has(client.id) ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[clientIndex % CHART_COLORS.length] }} />
                  <h3 className="text-sm font-semibold text-gray-900">{client.name}</h3>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right tabular-nums">
                    <span className="text-gray-600">{client.totalActualHours.toFixed(1)} hrs</span>
                    {client.totalBillableHours !== client.totalActualHours && (
                      <span className="text-amber-600 ml-2 text-xs">({client.totalBillableHours.toFixed(1)} billed)</span>
                    )}
                  </div>
                  <div className="text-right tabular-nums">
                    <span className="text-gray-500">{formatCurrency(client.totalCost)}</span>
                    <span className="text-gray-400 mx-1">/</span>
                    <span className="text-gray-900 font-medium">{formatCurrency(client.totalRevenue)}</span>
                  </div>
                  {(() => { const mp = calcMarginPct(client.totalRevenue, client.totalCost); return (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${marginBadgeClass(mp)}`}>
                      {mp.toFixed(1)}%
                    </span>
                  ) })()}
                </div>
              </button>
              {expandedClients.has(client.id) && (
                <div className={`border-t ${THEME.border}`}>
                  {Object.values(client.projects).map((project, projectIndex) => (
                    <div key={project.id} className={`border-b ${THEME.border} last:border-b-0`}>
                      <button onClick={() => toggleProject(project.id)} className={`w-full flex items-center justify-between px-6 py-2.5 ${THEME.cardHover} transition-colors`}>
                        <div className="flex items-center gap-2">
                          {expandedProjects.has(project.id) ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
                          <span className="text-sm font-medium text-gray-700">{project.name}</span>
                        </div>
                        <div className="flex items-center gap-5 text-xs tabular-nums">
                          <span className="text-gray-500">{project.totalActualHours.toFixed(1)} hrs</span>
                          <span className="text-gray-500">{formatCurrency(project.totalCost)}</span>
                          <span className="text-gray-700">{formatCurrency(project.totalRevenue)}</span>
                        </div>
                      </button>
                      {expandedProjects.has(project.id) && (
                        <div className="px-6 pb-3 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead><tr className={`border-b ${THEME.border}`}>
                              <th className={`px-2 py-2 text-left text-xs font-medium ${THEME.textDim} uppercase tracking-wider w-32`}>Name</th>
                              <th className={`px-2 py-2 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider w-20`}>Cost</th>
                              <th className={`px-2 py-2 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider w-20`}>Bill</th>
                              {weekColumns.map(week => <th key={week.end} className={`px-2 py-2 text-right text-xs font-medium ${THEME.textDim} w-16`}>{week.label}</th>)}
                              <th className={`px-2 py-2 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider w-20`}>Actual</th>
                              <th className={`px-2 py-2 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider w-20`}>Billed</th>
                              <th className={`px-2 py-2 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider w-24`}>Cost</th>
                              <th className={`px-2 py-2 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider w-24`}>Revenue</th>
                            </tr></thead>
                            <tbody>
                              {Object.values(project.members).sort((a, b) => b.totalActualHours - a.totalActualHours).map(member => (
                                <tr key={member.id} className={`border-b ${THEME.border} border-opacity-30 hover:bg-gray-50`}>
                                  <td className="px-2 py-2 text-gray-700 text-sm">{member.name}</td>
                                  <td className="px-2 py-2 text-right text-gray-500 text-xs tabular-nums">{formatCurrency(member.costRate)}</td>
                                  <td className="px-2 py-2 text-right text-gray-600 text-xs tabular-nums">{formatCurrency(member.billRate)}</td>
                                  {weekColumns.map(week => (
                                    <td key={week.end} className="px-2 py-2 text-right text-gray-600 tabular-nums">
                                      {(member.weekActualHours[week.end] || 0).toFixed(1)}
                                      {member.weekBillableHours[week.end] && member.weekBillableHours[week.end] !== member.weekActualHours[week.end] && (
                                        <span className="text-amber-600 text-xs ml-0.5">({member.weekBillableHours[week.end]?.toFixed(1)})</span>
                                      )}
                                    </td>
                                  ))}
                                  <td className="px-2 py-2 text-right text-gray-900 font-medium tabular-nums">{member.totalActualHours.toFixed(1)}</td>
                                  <td className={`px-2 py-2 text-right font-medium tabular-nums ${member.totalBillableHours !== member.totalActualHours ? 'text-amber-600' : 'text-gray-500'}`}>
                                    {member.totalBillableHours.toFixed(1)}
                                  </td>
                                  <td className="px-2 py-2 text-right text-gray-500 tabular-nums">{formatCurrency(member.totalCost)}</td>
                                  <td className="px-2 py-2 text-right text-gray-900 font-medium tabular-nums">{formatCurrency(member.totalRevenue)}</td>
                                </tr>
                              ))}
                              <tr className="bg-gray-50 font-medium">
                                <td className="px-2 py-2 text-gray-600 text-xs uppercase tracking-wider" colSpan={3}>Project Total</td>
                                {weekColumns.map(week => {
                                  const weekTotal = Object.values(project.members).reduce((sum, m) => sum + (m.weekActualHours[week.end] || 0), 0)
                                  return <td key={week.end} className="px-2 py-2 text-right text-gray-600 tabular-nums">{weekTotal.toFixed(1)}</td>
                                })}
                                <td className="px-2 py-2 text-right text-gray-900 tabular-nums">{project.totalActualHours.toFixed(1)}</td>
                                <td className="px-2 py-2 text-right text-amber-600 tabular-nums">{project.totalBillableHours.toFixed(1)}</td>
                                <td className="px-2 py-2 text-right text-gray-500 tabular-nums">{formatCurrency(project.totalCost)}</td>
                                <td className="px-2 py-2 text-right text-gray-900 tabular-nums">{formatCurrency(project.totalRevenue)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )) : <div className={`text-center py-12 ${THEME.textDim}`}>No time entries for this period</div>}
          {dataByClient.length > 0 && (
            <div className={`p-4 rounded-xl ${THEME.card} border flex items-center justify-between`}>
              <span className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Grand Total</span>
              <div className="flex items-center gap-6 tabular-nums">
                <span className="text-sm font-semibold text-gray-900">{kpis.totalActualHours.toFixed(1)} hrs</span>
                <span className="text-sm text-gray-500">{formatCurrency(kpis.totalCost)}</span>
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(kpis.totalRevenue)}</span>
                <span className={`text-sm font-bold ${kpis.grossMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(kpis.grossMargin)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ BY EMPLOYEE VIEW ============ */}
      {activeTab === 'byEmployee' && (
        <div className="space-y-3">
          {dataByEmployee.map((employee, index) => (
            <CollapsibleSection
              key={employee.id}
              title={employee.name}
              icon={<User size={15} style={{ color: CHART_COLORS[index % CHART_COLORS.length] }} />}
              badge={`${employee.totalActualHours.toFixed(1)} hrs`}
              rightContent={
                <div className="flex items-center gap-4 mr-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${employee.empType === 'employee' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-gray-100 text-gray-600 border border-gray-200'}`}>
                    {employee.empType === 'employee' ? 'W-2' : '1099'}
                  </span>
                  <span className="text-gray-500 text-sm tabular-nums">{formatCurrency(employee.totalCost)}</span>
                  <span className="text-gray-900 font-medium text-sm tabular-nums">{formatCurrency(employee.totalRevenue)}</span>
                  {(() => { const mp = calcMarginPct(employee.totalRevenue, employee.totalCost); return (
                    <span className={`text-xs font-medium ${marginColor(mp)}`}>
                      {mp.toFixed(1)}%
                    </span>
                  ) })()}
                </div>
              }
              defaultExpanded={index === 0}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">By Client</h4>
                  <div className="space-y-1.5">
                    {Object.entries(employee.clients).sort((a, b) => b[1].actualHours - a[1].actualHours).map(([clientId, data], i) => (
                      <div key={clientId} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} /><span className="text-sm text-gray-700">{data.name}</span></div>
                        <div className="flex items-center gap-3 text-xs tabular-nums">
                          <span className="text-gray-600">{data.actualHours.toFixed(1)} hrs</span>
                          {data.billableHours !== data.actualHours && <span className="text-amber-600">({data.billableHours.toFixed(1)} billed)</span>}
                          <span className="text-gray-500">{formatCurrency(data.cost)}</span>
                          <span className="text-gray-900">{formatCurrency(data.revenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Distribution</h4>
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie><Pie data={Object.entries(employee.clients).map(([id, data], i) => ({ name: data.name, value: data.actualHours, fill: CHART_COLORS[i % CHART_COLORS.length] }))} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value">
                        {Object.entries(employee.clients).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie><Tooltip formatter={(value: number) => `${value.toFixed(1)} hrs`} /></RechartsPie>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </CollapsibleSection>
          ))}
        </div>
      )}

      {/* ============ DETAILED VIEW ============ */}
      {activeTab === 'detailed' && (
        <CollapsibleSection title="Time Entries" badge={costAdjustedEntries.length} icon={<Calendar size={15} />}>
          {/* Inline Filter Bar */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Filter size={13} />
              <span className="font-medium text-gray-500">Filter:</span>
            </div>
            <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}
              className={`px-3 py-1.5 bg-white border ${selectedEmployee !== 'all' ? 'border-emerald-400 ring-1 ring-emerald-500/20' : THEME.border} rounded-lg text-xs text-gray-900 transition-colors hover:bg-gray-100`}>
              <option value="all">All Employees</option>
              {teamMembers.filter(t => t.status === 'active').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)}
              className={`px-3 py-1.5 bg-white border ${selectedClient !== 'all' ? 'border-emerald-400 ring-1 ring-emerald-500/20' : THEME.border} rounded-lg text-xs text-gray-900 transition-colors hover:bg-gray-100`}>
              <option value="all">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
              className={`px-3 py-1.5 bg-white border ${selectedProject !== 'all' ? 'border-emerald-400 ring-1 ring-emerald-500/20' : THEME.border} rounded-lg text-xs text-gray-900 transition-colors hover:bg-gray-100`}>
              <option value="all">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {(selectedClient !== 'all' || selectedEmployee !== 'all' || selectedProject !== 'all') && (
              <>
                <button onClick={() => { setSelectedClient('all'); setSelectedEmployee('all'); setSelectedProject('all') }} className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-900 transition-colors">
                  <X size={12} />Clear all
                </button>
                <div className="h-4 w-px bg-gray-100" />
                <div className="flex items-center gap-1.5">
                  {selectedEmployee !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs border border-emerald-200">
                      <User size={10} />{teamMembers.find(t => t.id === selectedEmployee)?.name}
                      <button onClick={() => setSelectedEmployee('all')} className="ml-0.5 hover:text-gray-900"><X size={10} /></button>
                    </span>
                  )}
                  {selectedClient !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs border border-emerald-200">
                      <Building2 size={10} />{clients.find(c => c.id === selectedClient)?.name}
                      <button onClick={() => setSelectedClient('all')} className="ml-0.5 hover:text-gray-900"><X size={10} /></button>
                    </span>
                  )}
                  {selectedProject !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs border border-emerald-200">
                      <Briefcase size={10} />{projects.find(p => p.id === selectedProject)?.name}
                      <button onClick={() => setSelectedProject('all')} className="ml-0.5 hover:text-gray-900"><X size={10} /></button>
                    </span>
                  )}
                </div>
              </>
            )}
            <div className="ml-auto text-xs text-gray-400 tabular-nums">
              {costAdjustedEntries.length} {costAdjustedEntries.length !== entries.filter(e => e.date >= dateRange.start && e.date <= dateRange.end).length ? `of ${entries.filter(e => e.date >= dateRange.start && e.date <= dateRange.end).length} ` : ''}entries
            </div>
          </div>
          {/* Legend */}
          <div className="mb-3 flex items-center gap-2">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="flex items-center gap-1"><Lock size={11} /><span>Actual Hours = cost (contractor submitted)</span></div>
              <span className="text-gray-300">|</span>
              <div className="flex items-center gap-1"><Edit2 size={11} className="text-amber-600" /><span className="text-amber-600">Billable Hours = revenue (click to adjust)</span></div>
            </div>
          </div>
          <div className={`overflow-x-auto rounded-lg border ${THEME.border}`}>
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50">
                <th className={`px-3 py-3 text-left text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>Date</th>
                <th className={`px-3 py-3 text-left text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>Employee</th>
                <th className={`px-3 py-3 text-left text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>Client</th>
                <th className={`px-3 py-3 text-left text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>Project</th>
                <th className={`px-3 py-3 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>Actual</th>
                <th className={`px-3 py-3 text-right text-xs font-medium text-amber-600 uppercase tracking-wider`}>Billable</th>
                <th className={`px-3 py-3 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>Cost Rate</th>
                <th className={`px-3 py-3 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>Bill Rate</th>
                <th className={`px-3 py-3 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>Cost</th>
                <th className={`px-3 py-3 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>Revenue</th>
                <th className={`px-3 py-3 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>Margin</th>
                <th className={`px-3 py-3 text-left text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>Notes</th>
                <th className={`px-3 py-3 text-center text-xs font-medium ${THEME.textDim}`}></th>
              </tr></thead>
              <tbody>
                {costAdjustedEntries.length > 0 ? costAdjustedEntries.slice(0, 100).map((entry) => {
                  const cost = entry.hours * entry.cost_rate
                  const revenue = entry.is_billable ? entry.billable_hours * entry.bill_rate : 0
                  const margin = revenue - cost
                  return (
                    <tr key={entry.id} className={`border-t ${THEME.border} hover:bg-gray-50`}>
                      <td className={`px-3 py-2.5 ${THEME.textMuted} whitespace-nowrap text-xs tabular-nums`}>{formatDate(entry.date)}</td>
                      <td className={`px-3 py-2.5 text-gray-900 text-sm`}>{entry.team_member_name}</td>
                      <td className={`px-3 py-2.5 ${THEME.textDim} text-xs`}>{entry.client_name || '—'}</td>
                      <td className={`px-3 py-2.5 text-gray-600 text-xs`}>{entry.project_name}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-gray-600 flex items-center justify-end gap-1 tabular-nums">
                          <Lock size={10} className="text-gray-400" />{entry.hours.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <EditableBillableCell
                          actualHours={entry.hours}
                          billableHours={entry.billable_hours}
                          onSave={(newValue) => updateBillableHours(entry.id, newValue)}
                        />
                      </td>
                      <td className={`px-3 py-2.5 text-right text-xs ${THEME.textDim} tabular-nums`}>{formatCurrency(entry.display_cost_rate)}</td>
                      <td className={`px-3 py-2.5 text-right text-xs ${THEME.textDim} tabular-nums`}>{formatCurrency(entry.bill_rate)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-500 text-xs tabular-nums">{formatCurrency(cost)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-900 text-xs tabular-nums">{formatCurrency(revenue)}</td>
                      <td className={`px-3 py-2.5 text-right text-xs font-medium tabular-nums ${margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(margin)}</td>
                      <td className={`px-3 py-2.5 ${THEME.textDim} text-xs max-w-[120px] truncate`}>{entry.notes || '—'}</td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => deleteEntry(entry.id)} className="p-1.5 rounded bg-gray-100 text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                }) : <tr><td colSpan={13} className={`px-4 py-12 text-center ${THEME.textDim}`}>No time entries found</td></tr>}
              </tbody>
            </table>
          </div>
          {costAdjustedEntries.length > 100 && <p className="text-center text-sm text-gray-400 mt-2">Showing first 100 of {costAdjustedEntries.length} entries</p>}
        </CollapsibleSection>
      )}

      {/* ============ PROFITABILITY VIEW ============ */}
      {activeTab === 'profitability' && (
        <div className="space-y-6">
          {/* Margin Chart */}
          <div className={`${THEME.card} border rounded-xl p-6`}>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Profitability by Project</h3>
            {profitabilityByProject.length > 0 ? (
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profitabilityByProject.slice(0, 10)} margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10 }} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={v => formatCompactCurrency(v)} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(value: number, name: string) => [formatCurrency(value), name]} />
                    <Legend wrapperStyle={{ color: '#6b7280', fontSize: '12px' }} />
                    <Bar dataKey="cost" name="Cost" fill="#64748b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="revenue" name="Revenue" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : <div className={`text-center py-12 ${THEME.textDim}`}><BarChart3 size={48} className="mx-auto text-gray-300 mb-4" /><p>No profitability data yet</p></div>}
          </div>

          {/* Margin Table */}
          {profitabilityByProject.length > 0 && (
            <div className={`${THEME.card} border rounded-xl overflow-hidden`}>
              <div className={`px-6 py-4 border-b ${THEME.border}`}>
                <h3 className="text-sm font-semibold text-gray-900">Margin Detail by Project</h3>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50">
                  <th className={`px-4 py-3 text-left text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>Project</th>
                  <th className={`px-4 py-3 text-left text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>Client</th>
                  <th className={`px-4 py-3 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>Actual Hrs</th>
                  <th className={`px-4 py-3 text-right text-xs font-medium text-amber-600 uppercase tracking-wider`}>Billed Hrs</th>
                  <th className={`px-4 py-3 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>Cost</th>
                  <th className={`px-4 py-3 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>Revenue</th>
                  <th className={`px-4 py-3 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>Margin</th>
                  <th className={`px-4 py-3 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>Margin %</th>
                </tr></thead>
                <tbody>
                  {profitabilityByProject.map(row => (
                    <tr key={row.id} className={`border-t ${THEME.border} hover:bg-gray-50`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                      <td className={`px-4 py-3 ${THEME.textDim}`}>{row.clientName || '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-600 tabular-nums">{row.actualHours.toFixed(1)}</td>
                      <td className={`px-4 py-3 text-right tabular-nums ${row.billableHours !== row.actualHours ? 'text-amber-600' : THEME.textMuted}`}>{row.billableHours.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{formatCurrency(row.cost)}</td>
                      <td className="px-4 py-3 text-right text-gray-900 tabular-nums">{formatCurrency(row.revenue)}</td>
                      <td className={`px-4 py-3 text-right font-medium tabular-nums ${row.margin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(row.margin)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${marginBadgeClass(row.marginPct)}`}>
                          {row.marginPct.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-medium">
                    <td className="px-4 py-3 text-gray-600 text-xs uppercase tracking-wider" colSpan={2}>Total</td>
                    <td className="px-4 py-3 text-right text-gray-900 tabular-nums">{kpis.totalActualHours.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-amber-600 tabular-nums">{kpis.totalBillableHours.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-gray-500 tabular-nums">{formatCurrency(kpis.totalCost)}</td>
                    <td className="px-4 py-3 text-right text-gray-900 tabular-nums">{formatCurrency(kpis.totalRevenue)}</td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${kpis.grossMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(kpis.grossMargin)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`px-2 py-1 rounded text-sm font-bold ${kpis.marginPct >= 20 ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'}`}>
                        {kpis.marginPct.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============ ENTRY MODAL ============ */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${THEME.card} border rounded-xl p-6 w-full max-w-lg shadow-2xl`}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Time Entry</h3>
            <div className="space-y-4">
              <div><label className={`block text-xs font-medium ${THEME.textDim} uppercase tracking-wider mb-1.5`}>Date *</label><input type="date" value={formData.date} onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))} className={`w-full px-3 py-2.5 bg-white border ${THEME.border} rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20`} /></div>
              <div><label className={`block text-xs font-medium ${THEME.textDim} uppercase tracking-wider mb-1.5`}>Employee *</label><select value={formData.team_member_id} onChange={(e) => setFormData(prev => ({ ...prev, team_member_id: e.target.value }))} className={`w-full px-3 py-2.5 bg-white border ${THEME.border} rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}><option value="">Select...</option>{teamMembers.filter(t => t.status === 'active').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div><label className={`block text-xs font-medium ${THEME.textDim} uppercase tracking-wider mb-1.5`}>Project *</label><select value={formData.project_id} onChange={(e) => setFormData(prev => ({ ...prev, project_id: e.target.value }))} className={`w-full px-3 py-2.5 bg-white border ${THEME.border} rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20`}><option value="">Select...</option>{projects.map(p => <option key={p.id} value={p.id}>{p.client ? `${p.client} - ` : ''}{p.name}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-medium ${THEME.textDim} uppercase tracking-wider mb-1.5`}>Actual Hours *</label>
                  <input type="number" value={formData.hours} onChange={(e) => setFormData(prev => ({ ...prev, hours: e.target.value }))} className={`w-full px-3 py-2.5 bg-white border ${THEME.border} rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20`} placeholder="8" step="0.5" />
                  <p className="text-[11px] text-gray-400 mt-1">What contractor worked</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-600 uppercase tracking-wider mb-1.5">Billable Hours</label>
                  <input type="number" value={formData.billable_hours} onChange={(e) => setFormData(prev => ({ ...prev, billable_hours: e.target.value }))} className={`w-full px-3 py-2.5 bg-white border border-amber-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400/40`} placeholder="Same as actual" step="0.5" />
                  <p className="text-[11px] text-gray-400 mt-1">What you bill client (optional)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={formData.is_billable} onChange={(e) => setFormData(prev => ({ ...prev, is_billable: e.target.checked }))} className="rounded bg-white border-gray-300 text-emerald-600 focus:ring-emerald-500/20" />
                <label className={`text-sm ${THEME.textMuted}`}>Billable</label>
              </div>
              <div><label className={`block text-xs font-medium ${THEME.textDim} uppercase tracking-wider mb-1.5`}>Notes</label><textarea value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} className={`w-full px-3 py-2.5 bg-white border ${THEME.border} rounded-lg text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20`} rows={2} placeholder="Description..." /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowEntryModal(false)} className={`flex-1 px-4 py-2.5 bg-white hover:bg-gray-100 border ${THEME.border} rounded-lg text-sm font-medium text-gray-600 transition-colors`}>Cancel</button>
              <button onClick={saveNewEntry} className="flex-1 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 rounded-lg text-sm font-medium text-white transition-colors">Add Entry</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
