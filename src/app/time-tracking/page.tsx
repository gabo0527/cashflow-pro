'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { 
  Search, Filter, Download, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Clock, Plus, Edit2, X, Check, Trash2, Calendar, Users, DollarSign,
  TrendingUp, TrendingDown, Gauge, Activity, Building2, User, Briefcase,
  CheckCircle, AlertCircle, RefreshCw, Eye, EyeOff, ArrowUpDown, BadgeCheck, FileText,
  Lock, Unlock
} from 'lucide-react'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart as RechartsPie, Pie, LineChart, Line, Legend, Area, AreaChart, ComposedChart
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
  budget_type?: string
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

type ViewTab = 'hoursRevenue' | 'billing' | 'cost' | 'trends' | 'byEmployee' | 'detailed'

const VIEW_TABS: { id: ViewTab; label: string; icon: React.ReactNode }[] = [
  // Hours & Revenue retired 06/30/2026 — convoluted/crowded; Billing + Cost cover it. Uncomment to restore.
  // { id: 'hoursRevenue', label: 'Hours & Revenue', icon: <Building2 size={15} /> },
  { id: 'billing', label: 'Billing', icon: <Briefcase size={15} /> },
  // Cost retired 07/01/2026 — cost/margin moved to the separate revenue-review report. Uncomment to restore.
  // { id: 'cost', label: 'Cost', icon: <DollarSign size={15} /> },
  { id: 'trends', label: 'Trends', icon: <Activity size={15} /> },
  { id: 'byEmployee', label: 'By Employee', icon: <Users size={15} /> },
  { id: 'detailed', label: 'Detailed', icon: <Calendar size={15} /> },
]

// Emerald-based chart palette for light theme
const CHART_COLORS = ['#2563eb', '#0891b2', '#c2660c', '#7c3aed', '#3b82f6', '#d97706', '#dc2626', '#64748b']

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

// Shared gradient + pinstripe for table header rows (matches KPI cards / client bar)
const HEADER_GRADIENT = 'linear-gradient(90deg, rgba(37,99,235,0.09), rgba(37,99,235,0.02) 55%, transparent), repeating-linear-gradient(135deg, rgba(15,23,42,0.02) 0 1px, transparent 1px 12px)'

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

// Count working days (Mon–Fri) in a date range, inclusive. Used for utilization capacity.
const countWorkingDays = (start: string, end: string): number => {
  const startDate = new Date(start + 'T00:00:00')
  const endDate = new Date(end + 'T00:00:00')
  let count = 0
  const cur = new Date(startDate)
  while (cur <= endDate) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) count++ // skip Sun (0) and Sat (6)
    cur.setDate(cur.getDate() + 1)
  }
  return count
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
  // Ensure the final column covers through the period end (e.g. Jun 30 when the
  // last week-end lands on Jun 29). Without this, trailing days fall in no bucket
  // and disappear from the weekly strip and PDF even though totals include them.
  if (weeks.length > 0) {
    const last = weeks[weeks.length - 1]
    if (new Date(last.end) < new Date(end)) last.end = end
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

// ============ Count-up animation hook ============
// Smoothly animates a number toward its target — on mount (from 0) and whenever
// the value changes (e.g. filters/date), so the cards feel alive and react to scope.
function useCountUp(target: number, duration = 750) {
  const [val, setVal] = useState(0)
  const fromRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  useEffect(() => {
    const from = fromRef.current
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setVal(from + (target - from) * eased)
      if (t < 1) rafRef.current = requestAnimationFrame(step)
      else fromRef.current = target
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])
  return val
}

// ============ KPI CARD — premium glass-gradient (Vantage) ============
function KPICard({ title, value, format = 'number', trend, trendLabel, icon, accentColor = '#2563eb' }: {
  title: string; value: number; format?: 'number' | 'currency' | 'percent' | 'hours'
  trend?: number; trendLabel?: string; icon?: React.ReactNode; accentColor?: string
}) {
  const animated = useCountUp(value)
  const fmt = (v: number) => {
    switch (format) {
      case 'currency': return formatCurrency(v)
      case 'percent': return `${v.toFixed(1)}%`
      case 'hours': return v.toFixed(1)
      default: return Math.round(v).toLocaleString()
    }
  }

  return (
    <div
      className="group relative rounded-2xl overflow-hidden bg-white border border-[#e2e8f0] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_18px_36px_-22px_rgba(15,23,42,0.4)]"
      style={{ boxShadow: '0 1px 2px rgba(15,23,42,0.05)' }}
    >
      {/* accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px] z-10" style={{ background: `linear-gradient(90deg, ${accentColor}, transparent)` }} />
      {/* pinstripe texture */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(135deg, rgba(15,23,42,0.022) 0 1px, transparent 1px 12px)' }} />
      {/* accent corner glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(120% 100% at 100% 0%, ${accentColor}14, transparent 58%)` }} />

      <div className="relative p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-slate-400">{title}</span>
          <span className="transition-transform duration-300 group-hover:scale-110" style={{ color: accentColor }}>{icon}</span>
        </div>
        <p className="text-[26px] leading-none font-extrabold tabular-nums tracking-tight text-slate-900" style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>{fmt(animated)}</p>
        {trend !== undefined && (
          <div className="flex items-center gap-1.5 mt-2.5">
            {trend >= 0 ? <TrendingUp size={12} style={{ color: '#10b981' }} /> : <TrendingDown size={12} style={{ color: '#e11d48' }} />}
            <span className="text-[11px] font-semibold tabular-nums" style={{ color: trend >= 0 ? '#10b981' : '#e11d48' }}>{trend >= 0 ? '+' : ''}{trend.toFixed(1)}%</span>
            {trendLabel && <span className="text-[11px] text-slate-400">{trendLabel}</span>}
          </div>
        )}
      </div>
    </div>
  )
}

// ============ TRENDS (T&M) helpers ============
const TREND_COLORS = ['#3b82f6', '#ea8a2f', '#22d3ee', '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#60a5fa']
const initials = (name: string) => (name || '?').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()

function TrendStat({ label, value, format }: { label: string; value: number; format: 'hours' | 'currency' | 'rate' }) {
  const v = useCountUp(value)
  const txt = format === 'currency' ? formatCurrency(v) : format === 'rate' ? `${formatCurrency(v)}/hr` : v.toFixed(1)
  return (
    <div className="rounded-xl px-3.5 py-3 border border-white/10" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.07em]" style={{ color: 'rgba(148,163,184,0.8)' }}>{label}</p>
      <p className="text-xl font-extrabold text-white mt-1 tabular-nums" style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>{txt}</p>
    </div>
  )
}

function TrendsTooltip({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload || !payload.length) return null
  const hrs = payload.filter(p => p.dataKey !== 'revenue' && p.value)
  const rev = payload.find(p => p.dataKey === 'revenue')
  const total = hrs.reduce((s, p) => s + (p.value || 0), 0)
  return (
    <div className="rounded-lg px-3 py-2 text-xs" style={{ background: 'rgba(15,23,42,0.96)', border: '1px solid rgba(59,130,246,0.3)', color: '#fff' }}>
      <p className="font-bold mb-1" style={{ color: '#60a5fa' }}>Week of {label}</p>
      {hrs.map(p => (
        <div key={p.dataKey} className="flex justify-between gap-4"><span style={{ color: p.color }}>{p.dataKey}</span><span>{p.value.toFixed(1)}h</span></div>
      ))}
      <div className="flex justify-between gap-4 border-t border-white/15 mt-1 pt-1 font-semibold"><span>Total</span><span>{total.toFixed(1)}h</span></div>
      {rev && <div className="flex justify-between gap-4"><span>Revenue</span><span>{formatCurrency(rev.value)}</span></div>}
    </div>
  )
}

// ============ TAB HERO — dark section header ============
function TabHero({ chips, titleLead, titleAccent, description, right }: {
  chips: string[]; titleLead: string; titleAccent: string; description: string; right?: React.ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl px-6 py-5 border border-[#e2e8f0]" style={{ background: 'linear-gradient(120deg,#ffffff,#eef2f8 70%,#e7edf6)', boxShadow: '0 1px 2px rgba(15,23,42,0.05)' }}>
      <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: 'linear-gradient(180deg,#2563eb,#c2660c)' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(70% 120% at 100% 0%, rgba(37,99,235,0.06), transparent 60%)' }} />
      <div className="relative flex items-end justify-between gap-5 flex-wrap">
        <div>
          <div className="flex gap-1.5 mb-2.5">
            {chips.map(c => <span key={c} className="text-[10px] font-semibold uppercase tracking-[0.06em] rounded-md px-2 py-1" style={{ fontFamily: "'JetBrains Mono', monospace", color: '#2563eb', background: 'rgba(37,99,235,0.09)', border: '1px solid rgba(37,99,235,0.22)' }}>{c}</span>)}
          </div>
          <h3 className="text-[24px] leading-none font-extrabold tracking-tight text-slate-900" style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>
            {titleLead} <span className="relative whitespace-nowrap">{titleAccent}<span className="absolute left-0 right-0 -bottom-1 h-[3px] rounded-sm" style={{ background: '#c2660c' }} /></span>
          </h3>
          <p className="text-sm mt-2.5 max-w-xl text-slate-500">{description}</p>
        </div>
        {right && <div className="flex flex-col items-end gap-2 shrink-0">{right}</div>}
      </div>
    </div>
  )
}

// ============ EMPTY STATE ============
function EmptyState({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return (
    <div className="py-14 px-6 flex flex-col items-center text-center">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg,rgba(37,99,235,0.12),rgba(37,99,235,0.03))', border: '1px solid rgba(37,99,235,0.2)', color: '#2563eb' }}>
        <span className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(135deg, rgba(37,99,235,0.06) 0 1px, transparent 1px 8px)' }} />
        <Clock size={24} className="relative" />
      </div>
      <p className="mt-4 text-lg font-extrabold text-gray-900" style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>{title}</p>
      <p className="mt-1.5 text-sm text-gray-400 max-w-sm">{subtitle}</p>
      {action && <div className="mt-4">{action}</div>}
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
  const [ttSearch, setTtSearch] = useState('')
  const [trendsMetric, setTrendsMetric] = useState<'both' | 'hours' | 'rev'>('both')
  const [hiddenTrendClients, setHiddenTrendClients] = useState<Set<string>>(new Set())
  const [detailExpanded, setDetailExpanded] = useState<Set<string>>(new Set())
  const toggleDetail = (key: string) => setDetailExpanded(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  const toggleTrendClient = (name: string) => setHiddenTrendClients(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })
  const [showDatePicker, setShowDatePicker] = useState(false)

  const [activeTab, setActiveTab] = useState<ViewTab>('billing')
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set())
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set())
  const [billingSort, setBillingSort] = useState<'amount' | 'az'>('amount')
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set())
  const [billingWeekly, setBillingWeekly] = useState(false)

  const [showEntryModal, setShowEntryModal] = useState(false)
  const [notesModal, setNotesModal] = useState<{ open: boolean; notes: string; employee: string; project: string; date: string } | null>(null)
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
  const priorMonthLabel = useMemo(() => new Date(priorPeriod.start + 'T00:00:00').toLocaleDateString('en-US', { month: 'short' }), [priorPeriod])

  // Load brand display font (Archivo) once, for the premium KPI numerals
  useEffect(() => {
    const id = 'vantage-brand-fonts'
    if (typeof document !== 'undefined' && !document.getElementById(id)) {
      const link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      link.href = 'https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@600&display=swap'
      document.head.appendChild(link)
    }
  }, [])

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

          // BILL RATE (revenue):
          //   per_scope → project scope rate overrides everyone (one rate, any resource)
          //   else      → rate card > entry stored > assignment > 0 (per-resource)
          const isPerScope = project?.billing_model === 'per_scope'
          const billRate = isPerScope
            ? (project?.bill_rate || 0)
            : (rateCard?.rate || e.bill_rate || assignment?.bill_rate || 0)

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
        setProjects((projRes.data || []).map((p: any) => ({ id: p.id, name: p.name || '', client: p.client || '', client_id: p.client_id || '', bill_rate: p.bill_rate || 0, budget_type: p.budget_type || p.contract_type || '', billing_model: p.billing_model || 'per_resource', fixed_amount: p.fixed_amount || 0 })))
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
  const costAdjustedEntries = useMemo(() => {
    const q = ttSearch.trim().toLowerCase()
    return allCostAdjustedEntries.filter(entry => {
      if (selectedClient !== 'all' && entry.client_id !== selectedClient) return false
      if (selectedEmployee !== 'all' && entry.team_member_id !== selectedEmployee) return false
      if (selectedProject !== 'all' && entry.project_id !== selectedProject) return false
      if (q && !`${entry.client_name || ''} ${entry.project_name || ''} ${entry.team_member_name || ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [allCostAdjustedEntries, selectedClient, selectedEmployee, selectedProject, ttSearch])

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
    const totalCost = costAdjustedEntries.reduce((sum, e) => sum + (e.hours * e.display_cost_rate), 0)
    const totalRevenue = costAdjustedEntries.reduce((sum, e) => sum + (e.is_billable ? e.billable_hours * e.bill_rate : 0), 0)
    const grossMargin = totalRevenue - totalCost
    const marginPct = calcMarginPct(totalRevenue, totalCost)
    const avgBillRate = totalBillableHours > 0 ? totalRevenue / totalBillableHours : 0
    const avgCostRate = totalActualHours > 0 ? totalCost / totalActualHours : 0

    const priorHours = costAdjustedPriorEntries.reduce((sum, e) => sum + e.hours, 0)
    const priorRevenue = costAdjustedPriorEntries.reduce((sum, e) => sum + (e.is_billable ? (e.billable_hours || e.hours) * e.bill_rate : 0), 0)
    const priorCost = costAdjustedPriorEntries.reduce((sum, e) => sum + (e.hours * e.display_cost_rate), 0)
    
    // Utilization = billable hours ÷ available capacity of the people actually working in this view.
    // Capacity scales with the selected period (working days × 8h) and follows the active filters,
    // so overhead members who log no time are naturally excluded from the denominator.
    const workingDays = countWorkingDays(dateRange.start, dateRange.end)
    const billableMemberCount = new Set(
      costAdjustedEntries.filter(e => e.hours > 0).map(e => e.team_member_id).filter(Boolean)
    ).size
    const totalCapacity = billableMemberCount * workingDays * 8
    const utilization = totalCapacity > 0 ? (totalBillableHours / totalCapacity) * 100 : 0

    const hoursTrend = priorHours > 0 ? ((totalActualHours - priorHours) / priorHours) * 100 : 0
    const revenueTrend = priorRevenue > 0 ? ((totalRevenue - priorRevenue) / priorRevenue) * 100 : 0
    const costTrend = priorCost > 0 ? ((totalCost - priorCost) / priorCost) * 100 : 0

    return { totalActualHours, totalBillableHours, totalCost, totalRevenue, priorRevenue, grossMargin, marginPct, avgBillRate, avgCostRate, utilization, hoursTrend, revenueTrend, costTrend, uniqueClients: new Set(costAdjustedEntries.map(e => e.client_id).filter(Boolean)).size }
  }, [costAdjustedEntries, costAdjustedPriorEntries, dateRange])

  const weekColumns = useMemo(() => getWeekColumns(dateRange.start, dateRange.end), [dateRange])

  // T&M-only trends: hours per client per week (stacked) + T&M revenue per week (line)
  const tmTrends = useMemo(() => {
    const btById: Record<string, string> = {}
    projects.forEach((p: { id: string; budget_type?: string; contract_type?: string }) => { btById[p.id] = (p.budget_type || p.contract_type || '') })
    const isTM = (pid: string) => { const bt = (btById[pid] || '').toLowerCase(); return bt.includes('time') || bt.includes('t_m') || bt.includes('hourly') }
    const tmEntries = costAdjustedEntries.filter(e => isTM(e.project_id))
    const clientNames = Array.from(new Set(tmEntries.map(e => e.client_name).filter(Boolean)))
    const rows = weekColumns.map(w => {
      const row: Record<string, number | string> = { week: w.label }
      clientNames.forEach(cn => { row[cn] = 0 })
      row.revenue = 0
      return row
    })
    const idxByEnd: Record<string, number> = {}; weekColumns.forEach((w, i) => { idxByEnd[w.end] = i })
    tmEntries.forEach(e => {
      const d = new Date(e.date)
      const wc = weekColumns.find(w => { const ws = new Date(w.start); const we = new Date(w.end); we.setHours(23, 59, 59); return d >= ws && d <= we })
      if (!wc) return
      const r = rows[idxByEnd[wc.end]]
      r[e.client_name] = ((r[e.client_name] as number) || 0) + e.hours
      r.revenue = (r.revenue as number) + (e.is_billable ? e.billable_hours * e.bill_rate : 0)
    })
    const totalHours = tmEntries.reduce((s, e) => s + e.hours, 0)
    const totalRevenue = tmEntries.reduce((s, e) => s + (e.is_billable ? e.billable_hours * e.bill_rate : 0), 0)
    const blended = totalHours ? totalRevenue / totalHours : 0
    const tmProjectCount = projects.filter((p: { id: string }) => isTM(p.id)).length
    return { rows, clientNames, totalHours, totalRevenue, blended, tmProjectCount }
  }, [costAdjustedEntries, weekColumns, projects])

  // Detailed ledger grouped Employee > Client > Project, entries newest-first
  const detailedGroups = useMemo(() => {
    type Prj = { id: string; name: string; actual: number; billable: number; revenue: number; entries: typeof costAdjustedEntries }
    type Cli = { id: string; name: string; actual: number; billable: number; revenue: number; projects: Record<string, Prj> }
    type Emp = { id: string; name: string; actual: number; billable: number; revenue: number; clients: Record<string, Cli> }
    const emps: Record<string, Emp> = {}
    costAdjustedEntries.forEach(e => {
      const rev = e.is_billable ? e.billable_hours * e.bill_rate : 0
      const ek = e.team_member_id || e.team_member_name || 'unknown'
      if (!emps[ek]) emps[ek] = { id: ek, name: e.team_member_name || 'Unknown', actual: 0, billable: 0, revenue: 0, clients: {} }
      const emp = emps[ek]; emp.actual += e.hours; emp.billable += e.billable_hours; emp.revenue += rev
      const ck = e.client_id || e.client_name || 'none'
      if (!emp.clients[ck]) emp.clients[ck] = { id: ck, name: e.client_name || '—', actual: 0, billable: 0, revenue: 0, projects: {} }
      const cli = emp.clients[ck]; cli.actual += e.hours; cli.billable += e.billable_hours; cli.revenue += rev
      const pk = e.project_id || e.project_name || 'none'
      if (!cli.projects[pk]) cli.projects[pk] = { id: pk, name: e.project_name || '—', actual: 0, billable: 0, revenue: 0, entries: [] }
      const prj = cli.projects[pk]; prj.actual += e.hours; prj.billable += e.billable_hours; prj.revenue += rev
      prj.entries.push(e)
    })
    Object.values(emps).forEach(emp => Object.values(emp.clients).forEach(cli => Object.values(cli.projects).forEach(prj => prj.entries.sort((a, b) => (a.date < b.date ? 1 : -1)))))
    return Object.values(emps).sort((a, b) => b.actual - a.actual)
  }, [costAdjustedEntries])

  const weekLabelFor = (date: string) => {
    const d = new Date(date)
    const wc = weekColumns.find(w => { const ws = new Date(w.start); const we = new Date(w.end); we.setHours(23, 59, 59); return d >= ws && d <= we })
    return wc ? wc.label : formatShortDate(date)
  }
  const detailKeys = () => {
    const keys: string[] = []
    detailedGroups.forEach(emp => { keys.push(`e:${emp.id}`); Object.values(emp.clients).forEach(cli => { keys.push(`e:${emp.id}|c:${cli.id}`); Object.values(cli.projects).forEach(prj => keys.push(`e:${emp.id}|c:${cli.id}|p:${prj.id}`)) }) })
    return keys
  }
  const expandAllDetail = () => setDetailExpanded(new Set(detailKeys()))
  const collapseAllDetail = () => setDetailExpanded(new Set())

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
      member.totalCost += entry.hours * entry.display_cost_rate
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
      emp.totalCost += entry.hours * entry.display_cost_rate; emp.totalRevenue += entry.is_billable ? entry.billable_hours * entry.bill_rate : 0
      const clientKey = entry.client_id || 'unassigned'
      if (!emp.clients[clientKey]) emp.clients[clientKey] = { name: entry.client_name || 'Unassigned', actualHours: 0, billableHours: 0, cost: 0, revenue: 0 }
      emp.clients[clientKey].actualHours += entry.hours; emp.clients[clientKey].billableHours += entry.billable_hours
      emp.clients[clientKey].cost += entry.hours * entry.display_cost_rate; emp.clients[clientKey].revenue += entry.is_billable ? entry.billable_hours * entry.bill_rate : 0
    })
    return Object.values(employeeData).sort((a, b) => b.totalActualHours - a.totalActualHours)
  }, [costAdjustedEntries, teamMembers])

  const weeklyTrendData = useMemo(() => weekColumns.map(week => {
    const weekEntries = costAdjustedEntries.filter(e => {
      const entryDate = new Date(e.date); const weekStart = new Date(week.start); const weekEnd = new Date(week.end); weekEnd.setHours(23, 59, 59)
      return entryDate >= weekStart && entryDate <= weekEnd
    })
    return {
      week: week.label,
      actualHours: weekEntries.reduce((sum, e) => sum + e.hours, 0),
      billableHours: weekEntries.reduce((sum, e) => sum + e.billable_hours, 0),
      cost: weekEntries.reduce((sum, e) => sum + (e.hours * e.display_cost_rate), 0),
      revenue: weekEntries.reduce((sum, e) => sum + (e.is_billable ? e.billable_hours * e.bill_rate : 0), 0),
    }
  }), [weekColumns, costAdjustedEntries])

  // ============ BILLING (burn-up + totals) ============
  // "To bill" = billable_hours × bill_rate (sell rate). Time tracking captures hours;
  // this view does the billing math separately, by week, accumulating across the period.
  const billingBurnUp = useMemo(() => {
    let cum = 0
    return weeklyTrendData.map(w => { cum += w.revenue; return { week: w.week, billed: w.revenue, cumulative: cum } })
  }, [weeklyTrendData])

  const billingTotals = useMemo(() => ({
    toBill: dataByClient.reduce((s, c) => s + c.totalRevenue, 0),
    billable: dataByClient.reduce((s, c) => s + c.totalBillableHours, 0),
    resources: new Set(costAdjustedEntries.map(e => e.team_member_id).filter(Boolean)).size,
  }), [dataByClient, costAdjustedEntries])

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
      const prevEntry = entries.find(e => e.id === entryId)
      const oldValue = prevEntry ? prevEntry.billable_hours : newBillableHours
      const { error } = await supabase.from('time_entries').update({ billable_hours: newBillableHours }).eq('id', entryId)
      if (error) throw error
      setEntries(prev => prev.map(e => e.id === entryId ? { ...e, billable_hours: newBillableHours } : e))
      // Audit trail: who/when/old→new. Internal only — never shown to contractors.
      if (companyId && oldValue !== newBillableHours) {
        try {
          const who = await getCurrentUser()
          await supabase.from('billable_adjustments').insert({
            company_id: companyId,
            time_entry_id: entryId,
            old_hours: oldValue,
            new_hours: newBillableHours,
            changed_by: who?.user?.id || null,
            changed_by_name: who?.user?.email || null,
          })
        } catch (logErr) { console.error('Audit log failed:', logErr) }
      }
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
  const toggleResource = (key: string) => setExpandedResources(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next })
  const expandAllBilling = () => {
    const c = new Set<string>(), p = new Set<string>(), r = new Set<string>()
    dataByClient.forEach((cl: any) => {
      c.add(cl.id)
      Object.values(cl.projects || {}).forEach((pr: any) => {
        p.add(pr.id)
        Object.values(pr.members || {}).forEach((m: any) => r.add(`${pr.id}:${m.id}`))
      })
    })
    setExpandedClients(c); setExpandedProjects(p); setExpandedResources(r)
  }
  const collapseAllBilling = () => { setExpandedClients(new Set()); setExpandedProjects(new Set()); setExpandedResources(new Set()) }
  const [showPdfConfig, setShowPdfConfig] = useState(false)
  const [pdfScopes, setPdfScopes] = useState<Set<string>>(new Set())
  const [pdfGrouping, setPdfGrouping] = useState<'resource' | 'rate' | 'scope'>('resource')
  const [pdfCols, setPdfCols] = useState({ hours: true, rate: true, amount: true })
  const openPdfConfig = () => {
    const ids = new Set<string>()
    dataByClient.forEach(c => Object.values(c.projects).forEach((p: any) => ids.add(p.id)))
    setPdfScopes(ids); setShowPdfConfig(true)
  }
  const togglePdfScope = (id: string) => setPdfScopes(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const [pdfDescriptions, setPdfDescriptions] = useState(false)
  const [lineNotes, setLineNotes] = useState<Record<string, string>>({})
  const buildPdfLines = () => {
    const scopes: { scopeId: string; scopeName: string; subHours: number; subAmount: number; lines: { key: string; label: string; hours: number; rate: number | null; amount: number }[] }[] = []
    dataByClient.forEach(client => Object.values(client.projects).forEach((project: any) => {
      if (!pdfScopes.has(project.id)) return
      const members = Object.values(project.members) as any[]
      let lines: { key: string; label: string; hours: number; rate: number | null; amount: number }[] = []
      if (pdfGrouping === 'scope') {
        lines = [{ key: `${project.id}:scope`, label: project.name, hours: project.totalBillableHours, rate: project.totalBillableHours > 0 ? project.totalRevenue / project.totalBillableHours : null, amount: project.totalRevenue }]
      } else if (pdfGrouping === 'rate') {
        const byRate: Record<string, { hours: number; amount: number; count: number; rate: number }> = {}
        members.forEach(m => { const k = String(m.billRate); if (!byRate[k]) byRate[k] = { hours: 0, amount: 0, count: 0, rate: m.billRate }; byRate[k].hours += m.totalBillableHours; byRate[k].amount += m.totalRevenue; byRate[k].count += 1 })
        lines = Object.values(byRate).sort((a, b) => b.amount - a.amount).map(r => ({ key: `${project.id}:rate:${r.rate}`, label: r.count > 1 ? `${r.count} resources` : 'Resource', hours: r.hours, rate: r.rate, amount: r.amount }))
      } else {
        lines = members.sort((a, b) => b.totalRevenue - a.totalRevenue).map(m => ({ key: `${project.id}:res:${m.id}`, label: m.name, hours: m.totalBillableHours, rate: m.billRate, amount: m.totalRevenue }))
      }
      scopes.push({ scopeId: project.id, scopeName: project.name, subHours: project.totalBillableHours, subAmount: project.totalRevenue, lines })
    }))
    return scopes
  }
  const billingCmp = (a: { name: string; totalRevenue: number }, b: { name: string; totalRevenue: number }) => billingSort === 'az' ? a.name.localeCompare(b.name) : b.totalRevenue - a.totalRevenue

  const exportToCSV = () => {
    const headers = ['Date', 'Employee', 'Client', 'Project', 'Actual Hours', 'Billable Hours', 'Cost Rate', 'Bill Rate', 'Cost', 'Revenue', 'Margin', 'Notes']
    const rows = costAdjustedEntries.map(e => [
      e.date, e.team_member_name, e.client_name, e.project_name, e.hours, e.billable_hours,
      e.display_cost_rate, e.bill_rate, (e.hours * e.display_cost_rate).toFixed(2), (e.billable_hours * e.bill_rate).toFixed(2),
      ((e.billable_hours * e.bill_rate) - (e.hours * e.display_cost_rate)).toFixed(2), e.notes || ''
    ])
    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob)
    link.download = `time-analytics-${dateRange.start}-to-${dateRange.end}.csv`; link.click()
    addToast('success', 'Export complete')
  }

  // ============ PDF REPORT (print to PDF, no dependencies) ============
  const openPdfReport = () => {
    const mode: 'cost' | 'hours' = activeTab === 'cost' ? 'cost' : 'hours'
    const scopeLabel = selectedProject !== 'all'
      ? `${selectedClient !== 'all' ? (clients.find(c => c.id === selectedClient)?.name || '') + ' › ' : ''}${projects.find(p => p.id === selectedProject)?.name || ''}`
      : selectedClient !== 'all'
        ? (clients.find(c => c.id === selectedClient)?.name || '')
        : 'Company · all clients'
    const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const fmt = (n: number) => formatCurrency(n)
    const generatedOn = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

    const parts: string[] = []
    parts.push(`<div class="rpt-clients">`)
    dataByClient.forEach(client => {
      parts.push(`<div class="rpt-client"><div class="rpt-client-head"><span class="rpt-cname">${esc(client.name)}</span>`)
      if (mode === 'hours') {
        parts.push(`<span class="rpt-cmeta">${client.totalActualHours.toFixed(1)} hrs &nbsp;·&nbsp; ${fmt(client.totalRevenue)} revenue</span>`)
      } else {
        const mp = calcMarginPct(client.totalRevenue, client.totalCost)
        parts.push(`<span class="rpt-cmeta">Cost ${fmt(client.totalCost)} &nbsp;·&nbsp; Rev ${fmt(client.totalRevenue)} &nbsp;·&nbsp; ${mp.toFixed(0)}% margin</span>`)
      }
      parts.push(`</div>`)

      Object.values(client.projects).forEach(project => {
        parts.push(`<div class="rpt-proj"><div class="rpt-proj-name">${esc(project.name)}</div><table class="rpt-table"><thead><tr>`)
        if (mode === 'hours') {
          parts.push(`<th class="l">Name</th><th>Bill</th>`)
          weekColumns.forEach(w => parts.push(`<th>${esc(w.label)}</th>`))
          parts.push(`<th>Actual</th><th>Billed</th><th>Adj</th><th>Revenue</th></tr></thead><tbody>`)
          Object.values(project.members).sort((a, b) => b.totalActualHours - a.totalActualHours).forEach(m => {
            parts.push(`<tr><td class="l">${esc(m.name)}</td><td>${fmt(m.billRate)}</td>`)
            weekColumns.forEach(w => parts.push(`<td>${(m.weekActualHours[w.end] || 0).toFixed(1)}</td>`))
            const adj = m.totalBillableHours - m.totalActualHours
            const adjStr = adj === 0 ? '—' : `${adj > 0 ? '+' : ''}${adj.toFixed(1)}`
            parts.push(`<td>${m.totalActualHours.toFixed(1)}</td><td>${m.totalBillableHours.toFixed(1)}</td><td class="${adj > 0 ? 'pos' : adj < 0 ? 'neg' : ''}">${adjStr}</td><td>${fmt(m.totalRevenue)}</td></tr>`)
          })
          parts.push(`<tr class="rpt-total"><td class="l">Project Total</td><td></td>`)
          weekColumns.forEach(w => { const wt = Object.values(project.members).reduce((s, m) => s + (m.weekActualHours[w.end] || 0), 0); parts.push(`<td>${wt.toFixed(1)}</td>`) })
          const padj = project.totalBillableHours - project.totalActualHours
          const padjStr = padj === 0 ? '—' : `${padj > 0 ? '+' : ''}${padj.toFixed(1)}`
          parts.push(`<td>${project.totalActualHours.toFixed(1)}</td><td>${project.totalBillableHours.toFixed(1)}</td><td class="${padj > 0 ? 'pos' : padj < 0 ? 'neg' : ''}">${padjStr}</td><td>${fmt(project.totalRevenue)}</td></tr>`)
        } else {
          parts.push(`<th class="l">Name</th><th>Actual</th><th>Cost rate</th><th>Cost</th><th>Revenue</th><th>Margin</th><th>Margin %</th></tr></thead><tbody>`)
          Object.values(project.members).sort((a, b) => (b.totalRevenue - b.totalCost) - (a.totalRevenue - a.totalCost)).forEach(m => {
            const mg = m.totalRevenue - m.totalCost; const mpct = calcMarginPct(m.totalRevenue, m.totalCost)
            parts.push(`<tr><td class="l">${esc(m.name)}</td><td>${m.totalActualHours.toFixed(1)}</td><td>${fmt(m.costRate)}</td><td>${fmt(m.totalCost)}</td><td>${fmt(m.totalRevenue)}</td><td class="${mg >= 0 ? 'pos' : 'neg'}">${fmt(mg)}</td><td>${mpct.toFixed(0)}%</td></tr>`)
          })
          const pmg = project.totalRevenue - project.totalCost; const pmpct = calcMarginPct(project.totalRevenue, project.totalCost)
          parts.push(`<tr class="rpt-total"><td class="l">Project Total</td><td>${project.totalActualHours.toFixed(1)}</td><td></td><td>${fmt(project.totalCost)}</td><td>${fmt(project.totalRevenue)}</td><td class="${pmg >= 0 ? 'pos' : 'neg'}">${fmt(pmg)}</td><td>${pmpct.toFixed(0)}%</td></tr>`)
        }
        parts.push(`</tbody></table></div>`)
      })
      parts.push(`</div>`)
    })
    parts.push(`</div>`)

    const summary = mode === 'hours'
      ? `<div class="rpt-kpi"><span>Total Hours</span><b>${kpis.totalActualHours.toFixed(1)}</b></div><div class="rpt-kpi"><span>Billable Hours</span><b>${kpis.totalBillableHours.toFixed(1)}</b></div><div class="rpt-kpi"><span>Revenue</span><b>${fmt(kpis.totalRevenue)}</b></div>`
      : `<div class="rpt-kpi"><span>Cost</span><b>${fmt(kpis.totalCost)}</b></div><div class="rpt-kpi"><span>Revenue</span><b>${fmt(kpis.totalRevenue)}</b></div><div class="rpt-kpi"><span>Margin</span><b class="${kpis.grossMargin >= 0 ? 'pos' : 'neg'}">${fmt(kpis.grossMargin)}</b></div><div class="rpt-kpi"><span>Margin %</span><b>${kpis.marginPct.toFixed(1)}%</b></div>`

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${mode === 'cost' ? 'Cost Report' : 'Time Report'} — ${esc(scopeLabel)}</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Instrument Sans',system-ui,sans-serif;color:#111827;font-size:12px;padding:32px 28px}
.rpt-head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111827;padding-bottom:14px;margin-bottom:16px}
.rpt-title{font-size:22px;font-weight:600;letter-spacing:-.02em}
.rpt-sub{font-size:12px;color:#6b7280;margin-top:3px}
.rpt-gen{font-size:11px;color:#9ca3af;text-align:right}
.rpt-summary{display:flex;gap:28px;margin-bottom:20px;flex-wrap:wrap}
.rpt-kpi{display:flex;flex-direction:column}
.rpt-kpi span{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;font-weight:600}
.rpt-kpi b{font-size:18px;font-weight:600;margin-top:2px}
.rpt-client{margin-bottom:18px;break-inside:avoid}
.rpt-client-head{display:flex;justify-content:space-between;align-items:baseline;padding:7px 0;border-bottom:1px solid #e5e7eb;margin-bottom:8px}
.rpt-cname{font-size:14px;font-weight:600}
.rpt-cmeta{font-size:11px;color:#6b7280}
.rpt-proj{margin:0 0 12px;break-inside:avoid}
.rpt-proj-name{font-size:12px;font-weight:600;color:#374151;margin:8px 0 4px}
.rpt-table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
.rpt-table th{font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:#9ca3af;font-weight:600;text-align:right;padding:5px 7px;border-bottom:1px solid #e5e7eb}
.rpt-table th.l,.rpt-table td.l{text-align:left}
.rpt-table td{font-size:11px;text-align:right;padding:5px 7px;border-bottom:1px solid #f3f4f6}
.rpt-total td{background:#f3f4f6;font-weight:600;border-top:1.5px solid #d1d5db;border-bottom:1px solid #d1d5db}
.pos{color:#059669}.neg{color:#dc2626}
@media print{body{padding:0}.rpt-client,.rpt-proj{break-inside:avoid}}
</style></head><body>
<div class="rpt-head"><div><div class="rpt-title">${mode === 'cost' ? 'Cost & Margin Report' : 'Time Report'}</div><div class="rpt-sub">${esc(scopeLabel)} · ${formatDate(dateRange.start)} – ${formatDate(dateRange.end)}</div></div><div class="rpt-gen">Mano CG LLC<br>Generated ${generatedOn}</div></div>
<div class="rpt-summary">${summary}</div>
${parts.join('')}
</body></html>`

    const w = window.open('', '_blank')
    if (!w) { addToast('error', 'Allow pop-ups to generate the PDF report'); return }
    w.document.write(html)
    w.document.close()
    w.onload = () => { w.focus(); w.print() }
    addToast('success', 'Report ready — choose "Save as PDF"')
  }

  const generateBillingStatement = () => {
    const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const fmt = (n: number) => formatCurrency(n)
    const generatedOn = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const clientLabel = selectedClient !== 'all' ? (clients.find(c => c.id === selectedClient)?.name || 'Client') : 'All clients'
    const MANO_LOGO = `<svg height="30" viewBox="0 0 331.63 65.13" xmlns="http://www.w3.org/2000/svg"><defs><style>.d{fill:#24333b}</style></defs><g><path class="d" d="M155.28,65.07c-5.65,0-10.8-1.45-15.46-4.36-4.66-2.9-8.36-6.81-11.1-11.7-2.75-4.9-4.12-10.33-4.12-16.3,0-4.46,.79-8.66,2.39-12.6,1.59-3.94,3.78-7.4,6.57-10.39,2.79-2.99,6.03-5.33,9.73-7.04,3.7-1.71,7.7-2.57,12-2.57,5.41,0,9.63,1.01,12.66,3.04,3.02,2.03,5.37,4.72,7.04,8.06V0h16V65.07h-15.64v-11.7c-1.67,3.5-4.04,6.33-7.1,8.48-3.07,2.15-7.38,3.22-12.95,3.22Zm2.63-14.57c3.58,0,6.67-.82,9.25-2.45,2.59-1.63,4.6-3.8,6.03-6.51,1.43-2.7,2.15-5.65,2.15-8.83s-.72-6.25-2.15-8.95c-1.43-2.7-3.44-4.9-6.03-6.57-2.59-1.67-5.67-2.51-9.25-2.51s-6.43,.82-9.01,2.45c-2.59,1.63-4.6,3.8-6.03,6.51-1.43,2.71-2.15,5.69-2.15,8.95s.72,6.03,2.15,8.78c1.43,2.75,3.44,4.95,6.03,6.63,2.59,1.67,5.59,2.51,9.01,2.51Z"/><path class="d" d="M200.53,65.07V0h15.88V10.51c3.26-7,9.59-10.51,18.98-10.51,4.46,0,8.48,1.04,12.06,3.1,3.58,2.07,6.41,5.01,8.48,8.83,2.07,3.82,3.1,8.36,3.1,13.61v39.52h-16.12V29.49c0-5.41-1.24-9.33-3.7-11.76-2.47-2.43-5.69-3.64-9.67-3.64-3.42,0-6.43,1.21-9.01,3.64-2.59,2.43-3.88,6.35-3.88,11.76v35.58h-16.12Z"/><path class="d" d="M298.55,65.13c-6.37,0-12.06-1.47-17.07-4.42-5.01-2.94-8.94-6.87-11.76-11.76-2.83-4.9-4.24-10.33-4.24-16.3s1.41-11.42,4.24-16.36c2.82-4.93,6.75-8.87,11.76-11.82C286.5,1.53,292.19,.06,298.55,.06s12.16,1.47,17.13,4.42c4.97,2.95,8.87,6.89,11.7,11.82,2.82,4.94,4.24,10.39,4.24,16.36s-1.41,11.4-4.24,16.3c-2.83,4.9-6.73,8.82-11.7,11.76-4.98,2.94-10.69,4.42-17.13,4.42Zm0-14.69c3.42,0,6.41-.81,8.95-2.45,2.55-1.63,4.52-3.8,5.91-6.51,1.39-2.71,2.09-5.65,2.09-8.84s-.7-6.25-2.09-8.95c-1.39-2.71-3.36-4.88-5.91-6.51-2.55-1.63-5.53-2.45-8.95-2.45s-6.41,.82-8.95,2.45c-2.55,1.63-4.52,3.8-5.91,6.51-1.39,2.71-2.09,5.69-2.09,8.95s.7,6.13,2.09,8.84c1.39,2.71,3.36,4.88,5.91,6.51,2.55,1.63,5.53,2.45,8.95,2.45Z"/><polygon class="d" points="20.51 65.07 65.06 20.52 85.5 0 65.06 0 65.06 .01 0 65.07 20.51 65.07"/><polygon class="d" points="59.1 65.07 103.65 20.52 103.65 65.07 118.15 65.07 118.15 0 103.65 0 103.65 .01 38.59 65.07 59.1 65.07"/></g></svg>`

    const parts: string[] = []
    let grandHrs = 0, grandAmt = 0
    const colH = (t: string) => `<th>${t}</th>`
    const headCols = `<th class="l">Line</th>${pdfCols.hours ? colH('Hours') : ''}${pdfCols.rate ? colH('Rate') : ''}${pdfCols.amount ? colH('Amount') : ''}`
    if (pdfGrouping === 'scope') {
      parts.push(`<div class="scope"><table><thead><tr>${headCols}</tr></thead><tbody>`)
      buildPdfLines().forEach(sc => {
        const ln = sc.lines[0]
        const desc = pdfDescriptions && lineNotes[ln.key] ? `<div class="ldesc">${esc(lineNotes[ln.key])}</div>` : ''
        parts.push(`<tr><td class="l">${esc(sc.scopeName)}${desc}</td>${pdfCols.hours ? `<td>${sc.subHours.toFixed(1)}</td>` : ''}${pdfCols.rate ? `<td>${ln.rate != null ? fmt(ln.rate) + '/hr' : ''}</td>` : ''}${pdfCols.amount ? `<td class="amt">${fmt(sc.subAmount)}</td>` : ''}</tr>`)
        grandHrs += sc.subHours; grandAmt += sc.subAmount
      })
      parts.push(`</tbody></table></div>`)
    } else {
      buildPdfLines().forEach(sc => {
        parts.push(`<div class="scope"><div class="scope-name">${esc(sc.scopeName)}</div><table><thead><tr>${headCols}</tr></thead><tbody>`)
        sc.lines.forEach(ln => {
          const desc = pdfDescriptions && lineNotes[ln.key] ? `<div class="ldesc">${esc(lineNotes[ln.key])}</div>` : ''
          parts.push(`<tr><td class="l">${esc(ln.label)}${desc}</td>${pdfCols.hours ? `<td>${ln.hours.toFixed(1)}</td>` : ''}${pdfCols.rate ? `<td>${ln.rate != null ? fmt(ln.rate) + '/hr' : ''}</td>` : ''}${pdfCols.amount ? `<td class="amt">${fmt(ln.amount)}</td>` : ''}</tr>`)
        })
        parts.push(`<tr class="subtot"><td class="l">Subtotal</td>${pdfCols.hours ? `<td>${sc.subHours.toFixed(1)}</td>` : ''}${pdfCols.rate ? '<td></td>' : ''}${pdfCols.amount ? `<td class="amt">${fmt(sc.subAmount)}</td>` : ''}</tr></tbody></table></div>`)
        grandHrs += sc.subHours; grandAmt += sc.subAmount
      })
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Billing Statement — ${esc(clientLabel)}</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Archivo:wght@700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Instrument Sans',system-ui,sans-serif;color:#0f172a;font-size:12px;padding:34px 30px}
.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #10151c;padding-bottom:16px;margin-bottom:8px}
.co{font-size:11px;color:#64748b;margin-top:6px}
.meta{font-size:11.5px;color:#64748b;text-align:right;line-height:1.7}
.meta b{color:#0f172a}
.title{font-family:'Archivo',sans-serif;font-size:19px;font-weight:800;margin:14px 0 2px}
.title-sub{font-size:11.5px;color:#64748b;margin-bottom:16px}
.scope{margin-bottom:14px;break-inside:avoid}
.scope-name{font-family:'Archivo',sans-serif;font-size:13px;font-weight:800;margin:12px 0 5px}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
th{font-size:9px;text-transform:uppercase;letter-spacing:.05em;color:#94a3b8;font-weight:700;text-align:right;padding:6px 8px;border-bottom:1px solid #e2e8f0}
th.l,td.l{text-align:left}
td{font-size:11.5px;text-align:right;padding:7px 8px;border-bottom:1px solid #f1f4f6}
.amt{color:#c2660c;font-weight:600}
.ldesc{font-size:10px;color:#64748b;font-style:italic;margin-top:2px;font-weight:400}
.subtot td{background:#f8fafc;font-weight:700;border-top:1px solid #e2e8f0}
.grand{display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding:14px 8px;border-top:2px solid #10151c}
.grand .l{font-family:'Archivo',sans-serif;font-weight:800;font-size:14px}
.grand .r{font-family:'Archivo',sans-serif;font-weight:800;font-size:18px;color:#c2660c}
.grand .hrs{color:#64748b;font-weight:600;font-size:12px;margin-right:18px}
.foot{margin-top:22px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between}
@media print{body{padding:0}.scope{break-inside:avoid}}
</style></head><body>
<div class="head"><div>${MANO_LOGO}<div class="co">Mano CG LLC · Billing Statement</div></div><div class="meta">Client · <b>${esc(clientLabel)}</b><br>Period · <b>${formatDate(dateRange.start)} – ${formatDate(dateRange.end)}</b><br>Generated · ${generatedOn}</div></div>
<div class="title">Billing Statement</div>
<div class="title-sub">Billable hours by scope · reviewed before invoicing</div>
${parts.join('')}
<div class="grand"><span class="l">Total</span><span><span class="hrs">${grandHrs.toFixed(1)} hrs</span><span class="r">${fmt(grandAmt)}</span></span></div>
<div class="foot"><span>Mano CG LLC · vantagefp.co</span><span>Generated ${generatedOn}</span></div>
</body></html>`

    const w = window.open('', '_blank')
    if (!w) { addToast('error', 'Allow pop-ups to generate the statement'); return }
    w.document.write(html); w.document.close()
    w.onload = () => { w.focus(); w.print() }
    addToast('success', 'Statement ready — choose "Save as PDF"')
    setShowPdfConfig(false)
  }

  const getFilterTitle = () => {
    if (selectedClient !== 'all') return clients.find(c => c.id === selectedClient)?.name || ''
    if (selectedEmployee !== 'all') return teamMembers.find(t => t.id === selectedEmployee)?.name || ''
    return 'All Clients'
  }

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 text-blue-500 animate-spin" /></div>

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />

      {/* Header — dark page banner */}
      <div className="relative overflow-hidden rounded-2xl px-7 py-6 flex items-start justify-between gap-4" style={{ background: 'linear-gradient(135deg,#1b2431 0%,#141b24 55%,#10151c 100%)', boxShadow: '0 20px 46px -26px rgba(15,23,42,0.6)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 13px)' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(80% 130% at 0% 0%, rgba(59,130,246,0.14), transparent 55%)' }} />
        <div className="relative">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em]" style={{ fontFamily: "'Archivo', system-ui, sans-serif", color: '#93c5fd' }}>Operations</p>
          <h1 className="text-3xl font-extrabold uppercase tracking-tight text-white mt-1 leading-none" style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>Time Tracking</h1>
          <p className="text-sm mt-2" style={{ color: '#8b97a7' }}>{getFilterTitle()}</p>
        </div>
        <div className="relative flex items-center gap-2 shrink-0">
          <button onClick={openPdfReport} className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all hover:bg-white/10" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.16)', color: '#e2e8f0' }}><Download size={15} />Export PDF</button>
          <button onClick={exportToCSV} className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all hover:bg-white/10" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.16)', color: '#e2e8f0' }}><FileText size={15} />Export CSV</button>
          <button onClick={() => setShowEntryModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-[0_10px_22px_-8px_rgba(37,99,235,0.75)]" style={{ background: 'linear-gradient(135deg,#2563eb,#1e3a8a)' }}><Plus size={16} />Add Entry</button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className={`p-2.5 rounded-2xl bg-white border ${THEME.border} shadow-sm relative z-20`}>
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input type="text" value={ttSearch} onChange={(e) => setTtSearch(e.target.value)} placeholder="Search client, project, person…"
              className="w-full pl-9 pr-3 py-2 bg-gray-50/70 border border-transparent hover:bg-gray-50 focus:bg-white focus:border-blue-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-all" />
          </div>
          {/* Date */}
          <div className="relative">
            <button onClick={() => setShowDatePicker(!showDatePicker)} className="flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 hover:border-blue-300 rounded-xl text-sm font-medium text-gray-900 transition-colors">
              <Calendar size={14} className="text-blue-600" />{DATE_PRESETS.find(p => p.id === datePreset)?.label}<ChevronDown size={14} className="text-gray-400" />
            </button>
            {showDatePicker && (
              <div className={`absolute top-full right-0 mt-2 w-56 p-2 bg-white border ${THEME.border} rounded-xl shadow-lg z-[100]`}>
                <div className="space-y-0.5">
                  {DATE_PRESETS.map(preset => (
                    <button key={preset.id} onClick={() => { setDatePreset(preset.id); if (preset.id !== 'custom') setShowDatePicker(false) }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${datePreset === preset.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{preset.label}</button>
                  ))}
                </div>
                {datePreset === 'custom' && (
                  <div className={`mt-2 pt-2 border-t ${THEME.border} space-y-2`}>
                    <div><label className={`text-xs ${THEME.textDim}`}>Start</label><input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className={`w-full mt-1 px-2 py-1.5 bg-white border ${THEME.border} rounded-lg text-sm text-gray-900`} /></div>
                    <div><label className={`text-xs ${THEME.textDim}`}>End</label><input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className={`w-full mt-1 px-2 py-1.5 bg-white border ${THEME.border} rounded-lg text-sm text-gray-900`} /></div>
                    <button onClick={() => setShowDatePicker(false)} className="w-full mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium text-white">Apply</button>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Pill selects */}
          <div className="relative">
            <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className={`appearance-none pl-3.5 pr-8 py-2 bg-white border rounded-xl text-sm hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-colors cursor-pointer ${selectedClient !== 'all' ? 'border-blue-400 text-gray-900' : 'border-gray-200 text-gray-700'}`}>
              <option value="all">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className={`appearance-none pl-3.5 pr-8 py-2 bg-white border rounded-xl text-sm hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-colors cursor-pointer ${selectedEmployee !== 'all' ? 'border-blue-400 text-gray-900' : 'border-gray-200 text-gray-700'}`}>
              <option value="all">All Employees</option>
              {teamMembers.filter(t => t.status === 'active').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)} className={`appearance-none pl-3.5 pr-8 py-2 bg-white border rounded-xl text-sm hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500/15 transition-colors cursor-pointer ${selectedProject !== 'all' ? 'border-blue-400 text-gray-900' : 'border-gray-200 text-gray-700'}`}>
              <option value="all">All Projects</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          {(selectedClient !== 'all' || selectedEmployee !== 'all' || selectedProject !== 'all' || ttSearch) && (
            <button onClick={() => { setSelectedClient('all'); setSelectedEmployee('all'); setSelectedProject('all'); setTtSearch('') }} className={`flex items-center gap-1 px-3 py-2 text-sm ${THEME.textMuted} hover:text-gray-900 transition-colors`}><X size={14} />Clear</button>
          )}
        </div>
        <span className={`block mt-2 px-1 text-xs ${THEME.textMuted} tabular-nums`}>{formatDate(dateRange.start)} — {formatDate(dateRange.end)}</span>
      </div>

      {/* KPI Cards — 3 operational metrics */}
      <div className="grid grid-cols-3 gap-3 relative z-10">
        <KPICard title="Actual Hours" value={kpis.totalActualHours} format="hours" trend={kpis.hoursTrend} trendLabel="vs prior" icon={<Clock size={15} />} accentColor="#2563eb" />
        <KPICard title="Billable Hours" value={kpis.totalBillableHours} format="hours" icon={<BadgeCheck size={15} />} accentColor="#c2660c" />
        <KPICard title="Utilization" value={kpis.utilization} format="percent" icon={<Gauge size={15} />} accentColor="#2563eb" />
      </div>

      {/* View Tabs */}
      <div className={`flex items-center gap-1 border-b ${THEME.border} pb-0 relative z-10`}>
        {VIEW_TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            activeTab === tab.id 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* Scope strip — always shows what the numbers represent */}
      {(activeTab === 'hoursRevenue' || activeTab === 'cost') && (
        <div className="flex items-center gap-2 text-sm text-gray-500 -mt-1 px-0.5">
          <Search size={15} className="text-gray-400" />
          <span>Viewing:&nbsp;
            <span className="font-semibold text-gray-900">
              {selectedProject !== 'all'
                ? `${selectedClient !== 'all' ? (clients.find(c => c.id === selectedClient)?.name + ' › ') : ''}${projects.find(p => p.id === selectedProject)?.name || ''}`
                : selectedClient !== 'all'
                  ? clients.find(c => c.id === selectedClient)?.name
                  : 'Company · all clients'}
            </span>
            <span className="text-gray-400">
              {selectedProject === 'all' ? ' · all projects' : ''} · {formatDate(dateRange.start)} – {formatDate(dateRange.end)}
            </span>
          </span>
        </div>
      )}

      {/* ============ BILLING VIEW ============ */}
      {activeTab === 'billing' && (
        <div className="space-y-4">
          {/* Summary: dark to-bill card + compact utilization / burn-up sparkline */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-2xl p-5 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#1b2431 0%,#141b24 55%,#10151c 100%)' }}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">To bill this period</p>
              <div className="flex items-baseline gap-2.5 mt-2 flex-wrap">
                <p className="text-4xl font-bold tracking-tight">{formatCurrency(billingTotals.toBill)}</p>
                {kpis.priorRevenue > 0 && (
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold tabular-nums border ${kpis.revenueTrend >= 0 ? 'bg-emerald-300/20 text-emerald-50 border-emerald-200/30' : 'bg-red-300/15 text-red-50 border-red-200/30'}`}>
                    {kpis.revenueTrend >= 0 ? '▲' : '▼'} {Math.abs(kpis.revenueTrend).toFixed(1)}%
                  </span>
                )}
              </div>
              <p className="text-sm text-white/70 mt-1.5">
                {billingTotals.billable.toFixed(1)} billable hrs · {billingTotals.resources} resources
                {kpis.priorRevenue > 0 && (
                  <span className="text-white/55"> · {kpis.totalRevenue - kpis.priorRevenue >= 0 ? '+' : '-'}{formatCurrency(Math.abs(kpis.totalRevenue - kpis.priorRevenue))} vs {priorMonthLabel}</span>
                )}
              </p>
            </div>
            <div className={`lg:col-span-2 rounded-2xl border ${THEME.border} bg-white p-4 flex items-center gap-6`}>
              <div className="shrink-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Utilization</p>
                <p className="text-3xl font-extrabold text-slate-900 tabular-nums mt-1 leading-none" style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>{kpis.utilization.toFixed(1)}%</p>
                <p className="text-[11px] text-gray-400 mt-1">actual vs capacity</p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Burn-up</p>
                  <button onClick={() => setActiveTab('trends')} className="text-[11px] font-medium text-blue-600 hover:underline">Full chart in Trends →</button>
                </div>
                <ResponsiveContainer width="100%" height={56}>
                  <AreaChart data={billingBurnUp} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="billFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.22} /><stop offset="100%" stopColor="#2563eb" stopOpacity={0} /></linearGradient></defs>
                    <Area type="monotone" dataKey="cumulative" stroke="#2563eb" strokeWidth={2} fill="url(#billFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Billing — progressive disclosure: Client → Project → Resource → weekly */}
          <div className="flex items-center justify-between gap-2 px-1 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mr-1">Sort</span>
              <button onClick={() => setBillingSort('amount')} className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${billingSort === 'amount' ? 'border-blue-600 text-blue-700 bg-blue-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>Amount</button>
              <button onClick={() => setBillingSort('az')} className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${billingSort === 'az' ? 'border-blue-600 text-blue-700 bg-blue-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>A–Z</button>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={openPdfConfig} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"><Download size={13} /> Billing PDF</button>
              <button onClick={() => setBillingWeekly(v => !v)} className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors">
                <span className={`relative w-8 h-[18px] rounded-full transition-colors ${billingWeekly ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <span className={`absolute top-[2px] w-3.5 h-3.5 rounded-full bg-white transition-all ${billingWeekly ? 'left-[16px]' : 'left-[2px]'}`} />
                </span>
                Weekly detail
              </button>
              <span className="text-gray-300">|</span>
              <button onClick={expandAllBilling} className="text-xs font-medium text-gray-500 hover:text-gray-900 px-1 transition-colors">Expand all</button>
              <span className="text-gray-300">·</span>
              <button onClick={collapseAllBilling} className="text-xs font-medium text-gray-500 hover:text-gray-900 px-1 transition-colors">Collapse all</button>
            </div>
          </div>

          <div className={`rounded-2xl border ${THEME.border} bg-white overflow-hidden`}>
            {[...dataByClient].sort(billingCmp).map((client, ci) => (
              <div key={client.id} className="border-t border-gray-100 first:border-t-0">
                {/* CLIENT */}
                <button onClick={() => toggleClient(client.id)} className="relative w-full text-left overflow-hidden transition hover:brightness-[0.98]" style={{ background: 'linear-gradient(90deg, rgba(37,99,235,0.09), rgba(37,99,235,0.02) 55%, transparent)' }}>
                  <span className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(135deg, rgba(15,23,42,0.02) 0 1px, transparent 1px 12px)' }} />
                  <div className="relative flex items-center gap-3 px-5 py-3.5">
                    {expandedClients.has(client.id) ? <ChevronDown size={15} className="text-gray-400 shrink-0" /> : <ChevronRight size={15} className="text-gray-400 shrink-0" />}
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white" style={{ backgroundColor: CHART_COLORS[ci % CHART_COLORS.length] }} />
                    <span className="font-bold text-sm tracking-wide text-gray-900 uppercase">{client.name}</span>
                    <div className="ml-auto flex items-center gap-5 text-sm shrink-0">
                      <span className="w-16 text-right" />
                      <span className="w-20 text-right text-gray-500 tabular-nums text-xs">{client.totalBillableHours.toFixed(1)} hrs</span>
                      <span className={`w-24 text-right font-bold tabular-nums ${client.totalRevenue ? 'text-[#c2660c]' : 'text-gray-400'}`}>{formatCurrency(client.totalRevenue)}</span>
                    </div>
                  </div>
                </button>

                {expandedClients.has(client.id) && Object.values(client.projects).sort(billingCmp).map(project => (
                  <div key={project.id} className="border-t border-gray-50">
                    {/* PROJECT */}
                    <button onClick={() => toggleProject(project.id)} className="w-full flex items-center gap-2.5 pl-11 pr-5 py-2.5 hover:bg-gray-50/70 transition-colors text-left bg-gray-50/40">
                      {expandedProjects.has(project.id) ? <ChevronDown size={13} className="text-gray-400 shrink-0" /> : <ChevronRight size={13} className="text-gray-400 shrink-0" />}
                      <span className="text-xs font-semibold text-gray-700">{project.name}</span>
                      <div className="ml-auto flex items-center gap-5 text-sm shrink-0">
                        <span className="w-16 text-right" />
                        <span className="w-20 text-right text-gray-500 tabular-nums text-xs">{project.totalBillableHours.toFixed(1)} hrs</span>
                        <span className={`w-24 text-right font-semibold tabular-nums text-[13px] ${project.totalRevenue ? 'text-[#c2660c]' : 'text-gray-400'}`}>{formatCurrency(project.totalRevenue)}</span>
                      </div>
                    </button>

                    {expandedProjects.has(project.id) && Object.values(project.members).sort(billingCmp).map(m => {
                      const rkey = `${project.id}:${m.id}`
                      const showWeekly = billingWeekly || expandedResources.has(rkey)
                      return (
                        <div key={rkey} className="border-t border-gray-50">
                          {/* RESOURCE */}
                          <button onClick={() => toggleResource(rkey)} className="w-full flex items-center gap-2 pl-[60px] pr-5 py-2.5 hover:bg-gray-50/70 transition-colors text-left">
                            {showWeekly ? <ChevronDown size={12} className="text-gray-300 shrink-0" /> : <ChevronRight size={12} className="text-gray-300 shrink-0" />}
                            <span className="text-[13px] font-medium text-gray-900">{m.name}</span>
                            <div className="ml-auto flex items-center gap-5 text-sm shrink-0">
                              <span className="w-16 text-right text-[11px] text-gray-400 tabular-nums">{m.billRate ? `$${m.billRate}/hr` : '—'}</span>
                              <span className="w-20 text-right text-gray-600 tabular-nums text-xs">{m.totalBillableHours.toFixed(1)} hrs</span>
                              <span className={`w-24 text-right font-bold tabular-nums text-[13px] ${m.totalRevenue ? 'text-[#c2660c]' : 'text-gray-400'}`}>{formatCurrency(m.totalRevenue)}</span>
                            </div>
                          </button>
                          {showWeekly && (
                            <div className="pl-[60px] pr-5 pb-3 pt-1 flex flex-wrap gap-1.5 bg-blue-50/20">
                              {weekColumns.map(w => {
                                const h = m.weekBillableHours[w.end] || 0
                                return (
                                  <div key={w.end} className={`flex flex-col items-center min-w-[52px] px-2.5 py-1.5 rounded-lg border ${h ? 'bg-white border-blue-200' : 'bg-gray-50/50 border-gray-100'}`}>
                                    <span className="text-[9px] font-semibold text-gray-400">{w.label}</span>
                                    <span className={`text-xs font-bold tabular-nums mt-0.5 ${h ? 'text-gray-900' : 'text-gray-300'}`}>{h.toFixed(1)}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            ))}
            {dataByClient.length === 0 && (
              <EmptyState title="No billable time this period" subtitle="Once contractors log time, billing rolls up here by client." />
            )}
          </div>
        </div>
      )}

      {/* ============ TRENDS VIEW ============ */}
      {activeTab === 'trends' && (
        <div className="relative overflow-hidden rounded-2xl p-5" style={{ background: 'linear-gradient(125deg,#1b2431 0%,#141b24 55%,#10151c 100%)', boxShadow: '0 20px 46px -22px rgba(15,23,42,0.6)' }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(135deg,rgba(255,255,255,0.045) 0 1px,transparent 1px 13px)' }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(120% 80% at 100% 0%,rgba(59,130,246,0.14),transparent 55%)' }} />
          <div className="relative">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.16em]" style={{ color: 'rgba(148,163,184,0.85)', fontFamily: "'Archivo', system-ui, sans-serif" }}>Trends</p>
                <h3 className="text-lg font-extrabold text-white mt-0.5" style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>T&amp;M client hours &amp; revenue</h3>
                <p className="text-xs mt-1" style={{ color: 'rgba(148,163,184,0.75)' }}>Time &amp; Materials only · {tmTrends.tmProjectCount} of {projects.length} projects · weekly</p>
              </div>
              <div className="flex bg-white/10 border border-white/15 rounded-xl p-0.5">
                {(['both', 'hours', 'rev'] as const).map(m => (
                  <button key={m} onClick={() => setTrendsMetric(m)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${trendsMetric === m ? 'text-white' : 'text-white/60 hover:text-white/80'}`} style={trendsMetric === m ? { background: 'linear-gradient(135deg,#2563eb,#1e3a8a)' } : {}}>{m === 'both' ? 'Both' : m === 'hours' ? 'Hours' : 'Revenue'}</button>
                ))}
              </div>
            </div>

            <div className="h-72 mt-4">
              {tmTrends.clientNames.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={tmTrends.rows} margin={{ top: 10, right: 6, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="week" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="h" tick={{ fill: 'rgba(148,163,184,0.75)', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="r" orientation="right" tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`} tick={{ fill: '#ffffff', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<TrendsTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                    {trendsMetric !== 'rev' && tmTrends.clientNames.map((cn, i) => (
                      <Bar key={cn} yAxisId="h" dataKey={cn} stackId="hrs" fill={TREND_COLORS[i % TREND_COLORS.length]} hide={hiddenTrendClients.has(cn)} radius={i === tmTrends.clientNames.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                    ))}
                    {trendsMetric !== 'hours' && (
                      <Line yAxisId="r" type="monotone" dataKey="revenue" name="T&M revenue" stroke="#ffffff" strokeWidth={2.5} dot={{ r: 3.5, fill: '#08221c', stroke: '#ffffff', strokeWidth: 2 }} />
                    )}
                    <Legend onClick={(o: any) => { if (o && o.dataKey && o.dataKey !== 'revenue') toggleTrendClient(String(o.dataKey)) }} wrapperStyle={{ fontSize: 12, paddingTop: 8, color: '#fff' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-sm" style={{ color: 'rgba(148,163,184,0.65)' }}>No T&amp;M time in this period.</div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2.5 mt-4">
              <TrendStat label="T&M hours" value={tmTrends.totalHours} format="hours" />
              <TrendStat label="T&M revenue" value={tmTrends.totalRevenue} format="currency" />
              <TrendStat label="Blended rate" value={tmTrends.blended} format="rate" />
            </div>
          </div>
        </div>
      )}

      {/* ============ HOURS & REVENUE VIEW ============ */}
      {activeTab === 'hoursRevenue' && (
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
                    <span className="text-gray-900 font-medium">{formatCurrency(client.totalRevenue)}</span>
                    <span className="text-gray-400 text-xs ml-1">revenue</span>
                  </div>
                </div>
              </button>
              {expandedClients.has(client.id) && (
                <div className={`border-t ${THEME.border}`}>
                  {Object.values(client.projects).map((project) => (
                    <div key={project.id} className="border-b-8 border-gray-50 last:border-b-0">
                      <button onClick={() => toggleProject(project.id)} className={`w-full flex items-center justify-between px-6 py-2.5 ${THEME.cardHover} transition-colors`}>
                        <div className="flex items-center gap-2">
                          {expandedProjects.has(project.id) ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
                          <span className="text-sm font-medium text-gray-700">{project.name}</span>
                        </div>
                        <div className="flex items-center gap-5 text-xs tabular-nums">
                          <span className="text-gray-500">{project.totalActualHours.toFixed(1)} hrs</span>
                          <span className="text-gray-700">{formatCurrency(project.totalRevenue)}</span>
                        </div>
                      </button>
                      {expandedProjects.has(project.id) && (
                        <div className="px-6 pb-3 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead><tr className={`border-b ${THEME.border}`} style={{ background: HEADER_GRADIENT }}>
                              <th className={`px-2 py-2 text-left text-xs font-medium ${THEME.textDim} uppercase tracking-wider w-32`}>Name</th>
                              <th className={`px-2 py-2 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider w-20`}>Bill</th>
                              {weekColumns.map(week => <th key={week.end} className={`px-2 py-2 text-right text-xs font-medium ${THEME.textDim} w-16`}>{week.label}</th>)}
                              <th className={`px-2 py-2 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider w-20`}>Actual</th>
                              <th className={`px-2 py-2 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider w-20`}>Billed</th>
                              <th className={`px-2 py-2 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider w-24`}>Revenue</th>
                            </tr></thead>
                            <tbody>
                              {Object.values(project.members).sort((a, b) => b.totalActualHours - a.totalActualHours).map(member => (
                                <tr key={member.id} className={`border-b ${THEME.border} border-opacity-30 hover:bg-gray-50`}>
                                  <td className="px-2 py-2 text-gray-700 text-sm">{member.name}</td>
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
                                  <td className="px-2 py-2 text-right text-gray-900 font-medium tabular-nums">{formatCurrency(member.totalRevenue)}</td>
                                </tr>
                              ))}
                              <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                                <td className="px-2 py-2 text-gray-900 text-xs uppercase tracking-wider" colSpan={2}>Project Total</td>
                                {weekColumns.map(week => {
                                  const weekTotal = Object.values(project.members).reduce((sum, m) => sum + (m.weekActualHours[week.end] || 0), 0)
                                  return <td key={week.end} className="px-2 py-2 text-right text-gray-900 tabular-nums">{weekTotal.toFixed(1)}</td>
                                })}
                                <td className="px-2 py-2 text-right text-gray-900 tabular-nums">{project.totalActualHours.toFixed(1)}</td>
                                <td className="px-2 py-2 text-right text-amber-600 tabular-nums">{project.totalBillableHours.toFixed(1)}</td>
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
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(kpis.totalRevenue)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ COST VIEW ============ */}
      {activeTab === 'cost' && (
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
                    <span className="text-gray-400 text-xs mr-1">cost</span>
                    <span className="text-gray-600">{formatCurrency(client.totalCost)}</span>
                    <span className="text-gray-400 text-xs mx-1">rev</span>
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
                  {Object.values(client.projects).map((project) => {
                    const projMargin = project.totalRevenue - project.totalCost
                    const projMarginPct = calcMarginPct(project.totalRevenue, project.totalCost)
                    return (
                    <div key={project.id} className="border-b-8 border-gray-50 last:border-b-0">
                      <button onClick={() => toggleProject(project.id)} className={`w-full flex items-center justify-between px-6 py-2.5 ${THEME.cardHover} transition-colors`}>
                        <div className="flex items-center gap-2">
                          {expandedProjects.has(project.id) ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}
                          <span className="text-sm font-medium text-gray-700">{project.name}</span>
                        </div>
                        <div className="flex items-center gap-5 text-xs tabular-nums">
                          <span className="text-gray-500">{formatCurrency(project.totalCost)} cost</span>
                          <span className={projMargin >= 0 ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>{formatCurrency(projMargin)}</span>
                          <span className={`px-2 py-0.5 rounded ${marginBadgeClass(projMarginPct)}`}>{projMarginPct.toFixed(0)}%</span>
                        </div>
                      </button>
                      {expandedProjects.has(project.id) && (
                        <div className="px-6 pb-3 overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead><tr className={`border-b ${THEME.border}`} style={{ background: HEADER_GRADIENT }}>
                              <th className={`px-2 py-2 text-left text-xs font-medium ${THEME.textDim} uppercase tracking-wider w-32`}>Name</th>
                              <th className={`px-2 py-2 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider w-20`}>Actual</th>
                              <th className={`px-2 py-2 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider w-20`}>Cost rate</th>
                              <th className={`px-2 py-2 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider w-24`}>Cost</th>
                              <th className={`px-2 py-2 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider w-24`}>Revenue</th>
                              <th className={`px-2 py-2 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider w-24`}>Margin</th>
                              <th className={`px-2 py-2 text-right text-xs font-medium ${THEME.textDim} uppercase tracking-wider w-20`}>Margin %</th>
                            </tr></thead>
                            <tbody>
                              {Object.values(project.members).sort((a, b) => (b.totalRevenue - b.totalCost) - (a.totalRevenue - a.totalCost)).map(member => {
                                const mMargin = member.totalRevenue - member.totalCost
                                const mMarginPct = calcMarginPct(member.totalRevenue, member.totalCost)
                                return (
                                <tr key={member.id} className={`border-b ${THEME.border} border-opacity-30 hover:bg-gray-50`}>
                                  <td className="px-2 py-2 text-gray-700 text-sm">{member.name}</td>
                                  <td className="px-2 py-2 text-right text-gray-900 font-medium tabular-nums">{member.totalActualHours.toFixed(1)}</td>
                                  <td className="px-2 py-2 text-right text-gray-500 text-xs tabular-nums">{formatCurrency(member.costRate)}</td>
                                  <td className="px-2 py-2 text-right text-gray-500 tabular-nums">{formatCurrency(member.totalCost)}</td>
                                  <td className="px-2 py-2 text-right text-gray-900 font-medium tabular-nums">{formatCurrency(member.totalRevenue)}</td>
                                  <td className={`px-2 py-2 text-right font-medium tabular-nums ${mMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(mMargin)}</td>
                                  <td className="px-2 py-2 text-right tabular-nums">
                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${marginBadgeClass(mMarginPct)}`}>{mMarginPct.toFixed(0)}%</span>
                                  </td>
                                </tr>
                                )
                              })}
                              <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                                <td className="px-2 py-2 text-gray-900 text-xs uppercase tracking-wider">Project Total</td>
                                <td className="px-2 py-2 text-right text-gray-900 tabular-nums">{project.totalActualHours.toFixed(1)}</td>
                                <td className="px-2 py-2"></td>
                                <td className="px-2 py-2 text-right text-gray-900 tabular-nums">{formatCurrency(project.totalCost)}</td>
                                <td className="px-2 py-2 text-right text-gray-900 tabular-nums">{formatCurrency(project.totalRevenue)}</td>
                                <td className={`px-2 py-2 text-right tabular-nums ${projMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(projMargin)}</td>
                                <td className="px-2 py-2 text-right tabular-nums">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${marginBadgeClass(projMarginPct)}`}>{projMarginPct.toFixed(0)}%</span>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                    )
                  })}
                </div>
              )}
            </div>
          )) : <div className={`text-center py-12 ${THEME.textDim}`}>No time entries for this period</div>}
          {dataByClient.length > 0 && (
            <div className={`p-4 rounded-xl ${THEME.card} border flex items-center justify-between`}>
              <span className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Grand Total</span>
              <div className="flex items-center gap-6 tabular-nums">
                <span className="text-sm text-gray-500">{formatCurrency(kpis.totalCost)} cost</span>
                <span className="text-sm font-semibold text-gray-900">{formatCurrency(kpis.totalRevenue)} rev</span>
                <span className={`text-sm font-bold ${kpis.grossMargin >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(kpis.grossMargin)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ BY EMPLOYEE VIEW ============ */}
      {activeTab === 'byEmployee' && (
        <div className="space-y-3">
          <TabHero chips={['Operations', 'Team']} titleLead="Team" titleAccent="output." description="Hours, utilization, and client mix per team member." right={<div className="text-right"><div className="text-[10px] font-bold uppercase tracking-[0.06em] text-slate-400">People</div><div className="text-2xl font-extrabold text-slate-900 tabular-nums" style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>{dataByEmployee.length}</div></div>} />
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
        <div className="space-y-4">
          <TabHero chips={['Operations', 'Ledger']} titleLead="Every hour," titleAccent="logged." description="Every submission, grouped Employee › Client › Project, in weekly order." />
          <CollapsibleSection title="Time Entries" badge={costAdjustedEntries.length} icon={<Calendar size={15} />}>
          {/* Inline Filter Bar */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Filter size={13} />
              <span className="font-medium text-gray-500">Filter:</span>
            </div>
            <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}
              className={`px-3 py-1.5 bg-white border ${selectedEmployee !== 'all' ? 'border-blue-400 ring-1 ring-blue-500/20' : THEME.border} rounded-lg text-xs text-gray-900 transition-colors hover:bg-gray-100`}>
              <option value="all">All Employees</option>
              {teamMembers.filter(t => t.status === 'active').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)}
              className={`px-3 py-1.5 bg-white border ${selectedClient !== 'all' ? 'border-blue-400 ring-1 ring-blue-500/20' : THEME.border} rounded-lg text-xs text-gray-900 transition-colors hover:bg-gray-100`}>
              <option value="all">All Clients</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}
              className={`px-3 py-1.5 bg-white border ${selectedProject !== 'all' ? 'border-blue-400 ring-1 ring-blue-500/20' : THEME.border} rounded-lg text-xs text-gray-900 transition-colors hover:bg-gray-100`}>
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
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs border border-blue-200">
                      <User size={10} />{teamMembers.find(t => t.id === selectedEmployee)?.name}
                      <button onClick={() => setSelectedEmployee('all')} className="ml-0.5 hover:text-gray-900"><X size={10} /></button>
                    </span>
                  )}
                  {selectedClient !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs border border-blue-200">
                      <Building2 size={10} />{clients.find(c => c.id === selectedClient)?.name}
                      <button onClick={() => setSelectedClient('all')} className="ml-0.5 hover:text-gray-900"><X size={10} /></button>
                    </span>
                  )}
                  {selectedProject !== 'all' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs border border-blue-200">
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
          <div className="mb-2 flex items-center justify-end gap-3 text-xs">
            <button onClick={expandAllDetail} className="font-medium text-gray-500 hover:text-gray-900 transition-colors">Expand all</button>
            <button onClick={collapseAllDetail} className="font-medium text-gray-500 hover:text-gray-900 transition-colors">Collapse all</button>
          </div>
          <div className={`rounded-lg border ${THEME.border} overflow-hidden`}>
            {detailedGroups.length > 0 ? detailedGroups.map((emp, ei) => {
              const ekey = `e:${emp.id}`
              const empOpen = detailExpanded.has(ekey)
              return (
                <div key={emp.id} className="border-t border-gray-100 first:border-t-0">
                  <button onClick={() => toggleDetail(ekey)} className="relative w-full text-left overflow-hidden transition hover:brightness-[0.99]" style={{ background: 'linear-gradient(90deg, rgba(37,99,235,0.09), rgba(37,99,235,0.02) 55%, transparent)' }}>
                    <span className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(135deg, rgba(15,23,42,0.02) 0 1px, transparent 1px 12px)' }} />
                    <div className="relative flex items-center gap-3 px-4 py-3">
                      {empOpen ? <ChevronDown size={15} className="text-gray-400 shrink-0" /> : <ChevronRight size={15} className="text-gray-400 shrink-0" />}
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ring-2 ring-white" style={{ backgroundColor: CHART_COLORS[ei % CHART_COLORS.length] }}>{initials(emp.name)}</span>
                      <span className="font-bold text-sm text-gray-900">{emp.name}</span>
                      <div className="ml-auto flex items-center gap-6 text-xs tabular-nums shrink-0">
                        <span className="text-gray-500">{emp.actual.toFixed(1)} <span className="text-gray-400">actual</span></span>
                        <span className="text-gray-500">{emp.billable.toFixed(1)} <span className="text-gray-400">billable</span></span>
                        <span className="font-bold text-[#c2660c]">{formatCurrency(emp.revenue)}</span>
                      </div>
                    </div>
                  </button>

                  {empOpen && Object.values(emp.clients).sort((a, b) => b.actual - a.actual).map(cli => {
                    const ckey = `${ekey}|c:${cli.id}`
                    const cliOpen = detailExpanded.has(ckey)
                    return (
                      <div key={cli.id} className="border-t border-gray-50">
                        <button onClick={() => toggleDetail(ckey)} className="w-full flex items-center gap-2.5 pl-10 pr-4 py-2.5 hover:bg-gray-50 transition-colors text-left bg-gray-50/50">
                          {cliOpen ? <ChevronDown size={13} className="text-gray-400 shrink-0" /> : <ChevronRight size={13} className="text-gray-400 shrink-0" />}
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[ei % CHART_COLORS.length] }} />
                          <span className="text-xs font-semibold text-gray-700">{cli.name}</span>
                          <div className="ml-auto flex items-center gap-6 text-xs tabular-nums shrink-0">
                            <span className="text-gray-500">{cli.actual.toFixed(1)}</span>
                            <span className="text-gray-500">{cli.billable.toFixed(1)}</span>
                            <span className="font-semibold text-[#c2660c]">{formatCurrency(cli.revenue)}</span>
                          </div>
                        </button>

                        {cliOpen && Object.values(cli.projects).sort((a, b) => b.actual - a.actual).map(prj => {
                          const pkey = `${ckey}|p:${prj.id}`
                          const prjOpen = detailExpanded.has(pkey)
                          return (
                            <div key={prj.id} className="border-t border-gray-50">
                              <button onClick={() => toggleDetail(pkey)} className="w-full flex items-center gap-2 pl-[52px] pr-4 py-2.5 hover:bg-gray-50 transition-colors text-left">
                                {prjOpen ? <ChevronDown size={12} className="text-gray-300 shrink-0" /> : <ChevronRight size={12} className="text-gray-300 shrink-0" />}
                                <span className="text-[13px] font-medium text-gray-700">{prj.name}</span>
                                <div className="ml-auto flex items-center gap-6 text-xs tabular-nums shrink-0">
                                  <span className="text-gray-500">{prj.actual.toFixed(1)}</span>
                                  <span className="text-gray-500">{prj.billable.toFixed(1)}</span>
                                  <span className="font-semibold text-[#c2660c]">{formatCurrency(prj.revenue)}</span>
                                </div>
                              </button>

                              {prjOpen && (
                                <div className="pl-[52px] pr-4 pb-3 pt-1 bg-gray-50/30 overflow-x-auto">
                                  <table className="w-full text-sm">
                                    <thead><tr style={{ background: HEADER_GRADIENT }}>
                                      <th className={`px-3 py-2 text-left text-[10px] font-semibold ${THEME.textDim} uppercase tracking-wider`}>Date</th>
                                      <th className={`px-3 py-2 text-right text-[10px] font-semibold ${THEME.textDim} uppercase tracking-wider`}>Actual</th>
                                      <th className={`px-3 py-2 text-right text-[10px] font-semibold text-amber-600 uppercase tracking-wider`}>Billable</th>
                                      <th className={`px-3 py-2 text-right text-[10px] font-semibold ${THEME.textDim} uppercase tracking-wider`}>Bill rate</th>
                                      <th className={`px-3 py-2 text-right text-[10px] font-semibold ${THEME.textDim} uppercase tracking-wider`}>Revenue</th>
                                      <th className={`px-3 py-2 text-left text-[10px] font-semibold ${THEME.textDim} uppercase tracking-wider w-[42%]`}>Notes</th>
                                      <th className="px-3 py-2 w-8"></th>
                                    </tr></thead>
                                    <tbody>
                                      {(() => {
                                        let lastWeek = ''
                                        const out: React.ReactNode[] = []
                                        prj.entries.forEach(entry => {
                                          const wl = weekLabelFor(entry.date)
                                          if (wl !== lastWeek) { lastWeek = wl; out.push(<tr key={`w-${entry.id}`}><td colSpan={7} className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Week of {wl}</td></tr>) }
                                          const revenue = entry.is_billable ? entry.billable_hours * entry.bill_rate : 0
                                          out.push(
                                            <tr key={entry.id} className="border-t border-gray-100 hover:bg-white">
                                              <td className={`px-3 py-2 ${THEME.textMuted} whitespace-nowrap text-xs tabular-nums`}>{formatDate(entry.date)}</td>
                                              <td className="px-3 py-2 text-right"><span className="text-gray-600 flex items-center justify-end gap-1 tabular-nums text-xs"><Lock size={10} className="text-gray-400" />{entry.hours.toFixed(1)}</span></td>
                                              <td className="px-3 py-2 text-right"><EditableBillableCell actualHours={entry.hours} billableHours={entry.billable_hours} onSave={(v) => updateBillableHours(entry.id, v)} /></td>
                                              <td className={`px-3 py-2 text-right text-xs ${THEME.textDim} tabular-nums`}>{formatCurrency(entry.bill_rate)}</td>
                                              <td className="px-3 py-2 text-right text-gray-900 text-xs tabular-nums">{formatCurrency(revenue)}</td>
                                              <td className="px-3 py-2 text-xs text-gray-500">{entry.notes ? <button onClick={() => setNotesModal({ open: true, notes: entry.notes!, employee: entry.team_member_name, project: entry.project_name, date: formatDate(entry.date) })} className="text-left w-full text-gray-500 hover:text-gray-900 hover:underline underline-offset-2 transition-colors cursor-pointer">{entry.notes}</button> : <span className={THEME.textDim}>—</span>}</td>
                                              <td className="px-3 py-2"><button onClick={() => deleteEntry(entry.id)} className="p-1.5 rounded bg-gray-100 text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition-colors" title="Delete"><Trash2 size={13} /></button></td>
                                            </tr>
                                          )
                                        })
                                        return out
                                      })()}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )
            }) : <EmptyState title="No time logged this period" subtitle="This period has no entries yet. Add an entry or change the date range." action={<button onClick={() => setShowEntryModal(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg,#2563eb,#1e3a8a)' }}><Plus size={15} />Add Entry</button>} />}
          </div>
        </CollapsibleSection>
        </div>
      )}

      {/* ============ ENTRY MODAL ============ */}
      {showEntryModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${THEME.card} border rounded-xl p-6 w-full max-w-lg shadow-2xl`}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Time Entry</h3>
            <div className="space-y-4">
              <div><label className={`block text-xs font-medium ${THEME.textDim} uppercase tracking-wider mb-1.5`}>Date *</label><input type="date" value={formData.date} onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))} className={`w-full px-3 py-2.5 bg-white border ${THEME.border} rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20`} /></div>
              <div><label className={`block text-xs font-medium ${THEME.textDim} uppercase tracking-wider mb-1.5`}>Employee *</label><select value={formData.team_member_id} onChange={(e) => setFormData(prev => ({ ...prev, team_member_id: e.target.value }))} className={`w-full px-3 py-2.5 bg-white border ${THEME.border} rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20`}><option value="">Select...</option>{teamMembers.filter(t => t.status === 'active').map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              <div><label className={`block text-xs font-medium ${THEME.textDim} uppercase tracking-wider mb-1.5`}>Project *</label><select value={formData.project_id} onChange={(e) => setFormData(prev => ({ ...prev, project_id: e.target.value }))} className={`w-full px-3 py-2.5 bg-white border ${THEME.border} rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20`}><option value="">Select...</option>{projects.map(p => <option key={p.id} value={p.id}>{p.client ? `${p.client} - ` : ''}{p.name}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-medium ${THEME.textDim} uppercase tracking-wider mb-1.5`}>Actual Hours *</label>
                  <input type="number" value={formData.hours} onChange={(e) => setFormData(prev => ({ ...prev, hours: e.target.value }))} className={`w-full px-3 py-2.5 bg-white border ${THEME.border} rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20`} placeholder="8" step="0.5" />
                  <p className="text-[11px] text-gray-400 mt-1">What contractor worked</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-amber-600 uppercase tracking-wider mb-1.5">Billable Hours</label>
                  <input type="number" value={formData.billable_hours} onChange={(e) => setFormData(prev => ({ ...prev, billable_hours: e.target.value }))} className={`w-full px-3 py-2.5 bg-white border border-amber-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-400/40`} placeholder="Same as actual" step="0.5" />
                  <p className="text-[11px] text-gray-400 mt-1">What you bill client (optional)</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={formData.is_billable} onChange={(e) => setFormData(prev => ({ ...prev, is_billable: e.target.checked }))} className="rounded bg-white border-gray-300 text-blue-600 focus:ring-blue-500/20" />
                <label className={`text-sm ${THEME.textMuted}`}>Billable</label>
              </div>
              <div><label className={`block text-xs font-medium ${THEME.textDim} uppercase tracking-wider mb-1.5`}>Notes</label><textarea value={formData.notes} onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))} className={`w-full px-3 py-2.5 bg-white border ${THEME.border} rounded-lg text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20`} rows={2} placeholder="Description..." /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowEntryModal(false)} className={`flex-1 px-4 py-2.5 bg-white hover:bg-gray-100 border ${THEME.border} rounded-lg text-sm font-medium text-gray-600 transition-colors`}>Cancel</button>
              <button onClick={saveNewEntry} className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium text-white transition-colors">Add Entry</button>
            </div>
          </div>
        </div>
      )}

      {/* ============ NOTES MODAL ============ */}
      {notesModal?.open && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setNotesModal(null)}>
          <div className={`${THEME.card} border rounded-xl p-6 w-full max-w-md shadow-2xl`} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-0.5">Note</p>
                <p className="text-sm font-semibold text-gray-900">{notesModal.employee} · {notesModal.project}</p>
                <p className="text-xs text-gray-400 mt-0.5">{notesModal.date}</p>
              </div>
              <button onClick={() => setNotesModal(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{notesModal.notes}</p>
            </div>
          </div>
        </div>
      )}

      {showPdfConfig && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowPdfConfig(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-slate-900" style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>Configure Billing PDF</h3>
              <button onClick={() => setShowPdfConfig(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Scopes</p>
                  <div className="flex gap-2 text-[11px] font-semibold">
                    <button onClick={() => { const ids = new Set<string>(); dataByClient.forEach(c => Object.values(c.projects).forEach((p: any) => ids.add(p.id))); setPdfScopes(ids) }} className="text-blue-600 hover:underline">All</button>
                    <button onClick={() => setPdfScopes(new Set())} className="text-gray-400 hover:underline">Clear</button>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                  {dataByClient.flatMap(c => Object.values(c.projects)).map((p: any) => (
                    <label key={p.id} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                      <input type="checkbox" checked={pdfScopes.has(p.id)} onChange={() => togglePdfScope(p.id)} className="accent-blue-600" />
                      <span className="text-slate-700">{p.name}</span>
                      <span className="ml-auto text-[11px] text-gray-400 tabular-nums">{p.totalBillableHours.toFixed(1)} hrs · {formatCurrency(p.totalRevenue)}</span>
                    </label>
                  ))}
                  {dataByClient.length === 0 && <p className="px-3 py-3 text-xs text-gray-400">No scopes in the current filter.</p>}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Line grouping</p>
                <div className="space-y-1.5">
                  {([['resource', 'Per resource', 'each person as a line'], ['rate', 'Collapse by rate', 'one line per rate (e.g. AWS)'], ['scope', 'Per scope', 'one line per scope']] as const).map(([val, label, desc]) => (
                    <label key={val} className={`flex items-start gap-2.5 px-3 py-2 border rounded-lg cursor-pointer text-sm ${pdfGrouping === val ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input type="radio" name="pdfgroup" checked={pdfGrouping === val} onChange={() => setPdfGrouping(val)} className="mt-0.5 accent-blue-600" />
                      <span><span className="font-medium text-slate-800">{label}</span><span className="block text-[11px] text-gray-400">{desc}</span></span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400 mb-2">Columns</p>
                <div className="flex gap-4">
                  {([['hours', 'Hours'], ['rate', 'Rate'], ['amount', 'Amount']] as const).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={pdfCols[key]} onChange={e => setPdfCols(prev => ({ ...prev, [key]: e.target.checked }))} className="accent-blue-600" />
                      <span className="text-slate-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Descriptions</p>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={pdfDescriptions} onChange={e => setPdfDescriptions(e.target.checked)} className="accent-blue-600" />
                    <span className="text-slate-600">Include</span>
                  </label>
                </div>
                {pdfDescriptions && (
                  <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-56 overflow-y-auto">
                    {buildPdfLines().flatMap(sc => sc.lines.map(ln => (
                      <div key={ln.key} className="px-3 py-2">
                        <p className="text-[11px] font-medium text-slate-500 mb-1">{sc.scopeName} · {ln.label}</p>
                        <textarea value={lineNotes[ln.key] || ''} onChange={e => setLineNotes(prev => ({ ...prev, [ln.key]: e.target.value }))} rows={2} placeholder="Client-facing description..." className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none" />
                      </div>
                    )))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setShowPdfConfig(false)} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={generateBillingStatement} disabled={pdfScopes.size === 0} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"><Download size={14} /> Generate PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
