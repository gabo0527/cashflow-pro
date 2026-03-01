'use client'

import React, { useState } from 'react'
import {
  DollarSign, TrendingUp, TrendingDown, Users, Building2,
  ChevronDown, ChevronRight, ChevronUp, Edit2, X, Trash2, Briefcase,
  AlertTriangle, CheckCircle2, Clock, Target, Activity,
  ArrowUpRight, ArrowDownRight, Calendar, FileText, Plus,
  Upload, Filter, MoreHorizontal, Eye, EyeOff
} from 'lucide-react'

// ============ LIGHT INSTITUTIONAL THEME ============
export const THEME = {
  pageBg: 'bg-slate-50',
  card: 'bg-white border border-slate-200 rounded-xl shadow-sm',
  cardHover: 'hover:shadow-md hover:border-slate-300 transition-all',
  glass: 'bg-white',
  glassBorder: 'border-slate-200',
  glassHover: 'hover:shadow-md hover:border-slate-300',
  textPrimary: 'text-slate-900',
  textSecondary: 'text-slate-700',
  textMuted: 'text-slate-500',
  textDim: 'text-slate-400',
  border: 'border-slate-200',
  borderLight: 'border-slate-100',
  input: 'bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-colors',
  selectClass: 'appearance-none bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 cursor-pointer transition-colors',
}

export const COLORS = {
  emerald: '#059669',
  rose: '#e11d48',
  amber: '#d97706',
  blue: '#2563eb',
  cyan: '#06b6d4',
  orange: '#ea580c',
  slate: '#64748b',
  purple: '#7c3aed',
  indigo: '#4f46e5',
}

// ============ STATUS CONFIGURATION ============
export const PROJECT_STATUSES = {
  active: { id: 'active', label: 'Active', color: 'emerald', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', hex: COLORS.emerald },
  completed: { id: 'completed', label: 'Completed', color: 'blue', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', hex: COLORS.blue },
  on_hold: { id: 'on_hold', label: 'On Hold', color: 'amber', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', hex: COLORS.amber },
  prospect: { id: 'prospect', label: 'Prospect', color: 'cyan', bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', hex: COLORS.cyan },
  archived: { id: 'archived', label: 'Archived', color: 'slate', bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-300', hex: COLORS.slate },
}

export type ProjectStatus = keyof typeof PROJECT_STATUSES

export const getStatusConfig = (status: string) => {
  return PROJECT_STATUSES[status as ProjectStatus] || PROJECT_STATUSES.active
}

// ============ HEALTH SCORE ============
export const calculateHealthScore = (project: any): { score: number; reasons: string[] } => {
  let score = 100
  const reasons: string[] = []

  const budget = project.budget || 0
  const spent = project.spent || 0
  const percentComplete = project.percent_complete || 0

  if (budget === 0) return { score: 50, reasons: ['No budget set'] }

  // Margin component (40 points)
  const margin = ((budget - spent) / budget) * 100
  if (margin < 0) { score -= 40; reasons.push(`Over budget by ${formatCurrency(Math.abs(budget - spent))}`) }
  else if (margin < 10) { score -= 30; reasons.push(`Margin critically low at ${margin.toFixed(1)}%`) }
  else if (margin < 20) { score -= 15; reasons.push(`Margin below target at ${margin.toFixed(1)}%`) }

  // Burn rate vs completion (30 points)
  const burnRate = (spent / budget) * 100
  const burnDelta = burnRate - percentComplete
  if (burnDelta > 20) { score -= 30; reasons.push(`Burning ${burnDelta.toFixed(0)}% faster than progress`) }
  else if (burnDelta > 10) { score -= 20; reasons.push(`Burn rate ${burnDelta.toFixed(0)}% ahead of completion`) }
  else if (burnDelta > 5) { score -= 10; reasons.push(`Slight burn overrun (+${burnDelta.toFixed(0)}%)`) }

  // Timeline (20 points)
  if (project.end_date) {
    const endDate = new Date(project.end_date)
    const today = new Date()
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysRemaining < 0 && project.status === 'active') { score -= 20; reasons.push(`${Math.abs(daysRemaining)} days past deadline`) }
    else if (daysRemaining < 7 && percentComplete < 90) { score -= 10; reasons.push(`${daysRemaining} days left, only ${percentComplete}% complete`) }
  }

  // Hours utilization (10 points)
  if (project.budgeted_hours && project.actual_hours) {
    const hoursUtil = (project.actual_hours / project.budgeted_hours) * 100
    if (hoursUtil > 110) { score -= 10; reasons.push(`Hours ${(hoursUtil - 100).toFixed(0)}% over budget`) }
    else if (hoursUtil > 100) { score -= 5; reasons.push(`Hours slightly over budget`) }
  }

  return { score: Math.max(0, Math.min(100, score)), reasons }
}

// Backwards-compatible wrapper
export const getHealthScore = (project: any): number => calculateHealthScore(project).score

export const getHealthConfig = (score: number) => {
  if (score >= 80) return { label: 'Healthy', bg: 'bg-emerald-50', text: 'text-emerald-700', hex: COLORS.emerald, ring: 'ring-emerald-200' }
  if (score >= 60) return { label: 'Warning', bg: 'bg-amber-50', text: 'text-amber-700', hex: COLORS.amber, ring: 'ring-amber-200' }
  return { label: 'At Risk', bg: 'bg-rose-50', text: 'text-rose-700', hex: COLORS.rose, ring: 'ring-rose-200' }
}

// ============ UTILITY FUNCTIONS ============
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

export const formatCompactCurrency = (value: number): string => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`
  return `$${value.toFixed(0)}`
}

export const formatPercent = (value: number): string => `${value.toFixed(1)}%`

export const formatDateShort = (dateStr: string): string => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ============ SHARED COMPONENTS ============

export function KPICard({
  label, value, subtitle, icon: Icon, color = 'emerald', trend, onClick, selected
}: {
  label: string; value: string | number; subtitle?: string; icon: any; color?: string
  trend?: { value: number; label?: string }; onClick?: () => void; selected?: boolean
}) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-600', rose: 'text-rose-600', amber: 'text-amber-600',
    blue: 'text-blue-600', cyan: 'text-cyan-600', slate: 'text-slate-500', purple: 'text-purple-600',
  }
  const bgMap: Record<string, string> = {
    emerald: 'bg-emerald-50', rose: 'bg-rose-50', amber: 'bg-amber-50',
    blue: 'bg-blue-50', cyan: 'bg-cyan-50', slate: 'bg-slate-100', purple: 'bg-purple-50',
  }

  return (
    <div
      onClick={onClick}
      className={`bg-white border ${selected ? 'border-emerald-300 ring-2 ring-emerald-100' : 'border-slate-200'} rounded-xl p-5 hover:shadow-md hover:border-slate-300 transition-all ${onClick ? 'cursor-pointer' : ''} shadow-sm`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
          <div className="flex items-baseline gap-2 mt-1.5">
            <p className={`text-2xl font-bold ${colorMap[color]}`}>{value}</p>
            {trend && (
              <div className={`flex items-center gap-0.5 ${trend.value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {trend.value >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                <span className="text-xs font-medium">{Math.abs(trend.value).toFixed(1)}%</span>
              </div>
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${selected ? 'bg-emerald-100' : bgMap[color] || 'bg-slate-100'}`}>
          <Icon size={18} className={selected ? 'text-emerald-600' : colorMap[color] || 'text-slate-400'} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  )
}

export function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const config = getStatusConfig(status)
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1.5 text-sm'
  return (
    <span className={`inline-flex items-center ${sizeClasses} rounded-md font-semibold ${config.bg} ${config.text} border ${config.border}`}>
      {config.label}
    </span>
  )
}

export function HealthBadge({ score }: { score: number }) {
  const config = getHealthConfig(score)
  return (
    <span className={`inline-flex items-center justify-center w-10 h-6 rounded text-xs font-bold ${config.bg} ${config.text}`}>
      {Math.round(score)}
    </span>
  )
}

export function ProgressBar({ value, max, color = 'emerald', showLabel = true, size = 'sm' }: {
  value: number; max: number; color?: string; showLabel?: boolean; size?: 'sm' | 'md'
}) {
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const isOver = value > max
  const barColor = isOver ? 'bg-rose-500' : percent > 80 ? 'bg-amber-500' : `bg-${color}-500`
  const height = size === 'sm' ? 'h-1.5' : 'h-2'

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 bg-slate-100 rounded-full ${height} overflow-hidden`}>
        <div className={`${height} rounded-full ${barColor} transition-all duration-500`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      {showLabel && <span className="text-xs text-slate-400 w-10 text-right">{percent.toFixed(0)}%</span>}
    </div>
  )
}

export function MarginIndicator({ margin }: { margin: number }) {
  const color = margin >= 20 ? 'text-emerald-600' : margin >= 10 ? 'text-amber-600' : 'text-rose-600'
  return <span className={`font-semibold ${color}`}>{formatPercent(margin)}</span>
}

export function SlicerButton({
  label, value, options, onChange, allLabel = 'All'
}: {
  label: string; value: string; options: { id: string; label: string; count?: number }[]
  onChange: (value: string) => void; allLabel?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedOption = options.find(o => o.id === value)

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm">
        <span className="text-slate-400">{label}:</span>
        <span className="font-medium text-slate-700">{selectedOption?.label || allLabel}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden">
            <button onClick={() => { onChange('all'); setIsOpen(false) }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors ${value === 'all' ? 'text-emerald-600 bg-emerald-50 font-medium' : 'text-slate-600'}`}>
              {allLabel}
            </button>
            {options.map(opt => (
              <button key={opt.id} onClick={() => { onChange(opt.id); setIsOpen(false) }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors flex items-center justify-between ${value === opt.id ? 'text-emerald-600 bg-emerald-50 font-medium' : 'text-slate-600'}`}>
                <span>{opt.label}</span>
                {opt.count !== undefined && <span className="text-slate-400 text-xs">{opt.count}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function CollapsibleSection({
  title, subtitle, badge, children, defaultExpanded = true, noPadding = false, action
}: {
  title: string; subtitle?: string; badge?: string | number; children: React.ReactNode
  defaultExpanded?: boolean; noPadding?: boolean
  action?: { label: string; icon?: any; onClick: () => void }
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-3">
          <div className="text-slate-400">{isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
              {badge !== undefined && <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600">{badge}</span>}
            </div>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action && (
          <button onClick={(e) => { e.stopPropagation(); action.onClick() }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors">
            {action.icon && <action.icon size={14} />}
            {action.label}
          </button>
        )}
      </div>
      {isExpanded && <div className={noPadding ? '' : 'p-6'}>{children}</div>}
    </div>
  )
}

export const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm font-medium" style={{ color: entry.color || entry.fill }}>
          {entry.name}: {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  )
}

export function EmptyState({ icon: Icon, title, description, action }: {
  icon: any; title: string; description: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
        <Icon size={28} className="text-emerald-600" />
      </div>
      <div className="text-center">
        <p className="font-medium text-slate-700">{title}</p>
        <p className="text-sm text-slate-400 mt-1">{description}</p>
      </div>
      {action && (
        <button onClick={action.onClick}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors">
          <Plus size={16} /> {action.label}
        </button>
      )}
    </div>
  )
}

export function WaterfallItem({ label, value, type, showBar = true }: {
  label: string; value: number; type: 'start' | 'add' | 'subtract' | 'total'; showBar?: boolean
}) {
  const colors = {
    start: 'text-slate-700',
    add: 'text-emerald-600',
    subtract: 'text-rose-600',
    total: 'text-blue-600',
  }
  const barColors = {
    start: 'bg-slate-200',
    add: 'bg-emerald-200',
    subtract: 'bg-rose-200',
    total: 'bg-blue-200',
  }

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-slate-600">{label}</span>
      <div className="flex items-center gap-3">
        {showBar && (
          <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColors[type]}`} style={{ width: '60%' }} />
          </div>
        )}
        <span className={`text-sm font-semibold ${colors[type]} w-24 text-right`}>
          {type === 'subtract' ? '-' : ''}{formatCurrency(Math.abs(value))}
        </span>
      </div>
    </div>
  )
}

// ============ INSIGHT BADGE (decision-support) ============
export function InsightBadge({ type, message }: { type: 'warning' | 'danger' | 'info' | 'success'; message: string }) {
  const styles = {
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border-rose-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
  const icons = { warning: AlertTriangle, danger: AlertTriangle, info: Activity, success: CheckCircle2 }
  const Icon = icons[type]

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${styles[type]}`}>
      <Icon size={14} className="shrink-0" />
      <span>{message}</span>
    </div>
  )
}
