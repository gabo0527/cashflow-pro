'use client'

import React, { useState, useCallback } from 'react'
import {
  DollarSign, TrendingUp, TrendingDown, Users, Building2,
  ChevronDown, ChevronRight, ChevronUp, Edit2, X, Trash2, Briefcase,
  AlertTriangle, CheckCircle2, Clock, Target, Activity,
  ArrowUpRight, ArrowDownRight, Calendar, FileText, Plus,
  Upload, Filter, MoreHorizontal, Eye, EyeOff
} from 'lucide-react'

// ============ GLASSMORPHISM THEME ============
export const THEME = {
  glass: 'bg-slate-900/70 backdrop-blur-xl',
  glassBorder: 'border-white/[0.08]',
  glassHover: 'hover:bg-white/[0.05] hover:border-white/[0.12]',
  textPrimary: 'text-white',
  textSecondary: 'text-slate-300',
  textMuted: 'text-slate-400',
  textDim: 'text-slate-500',
}

export const COLORS = {
  emerald: '#10b981',
  rose: '#f43f5e',
  amber: '#f59e0b',
  blue: '#3b82f6',
  cyan: '#06b6d4',
  orange: '#f97316',
  slate: '#64748b',
}

// ============ STATUS CONFIGURATION ============
export const PROJECT_STATUSES = {
  active: { id: 'active', label: 'Active', color: 'emerald', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', hex: COLORS.emerald },
  completed: { id: 'completed', label: 'Completed', color: 'blue', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', hex: COLORS.blue },
  on_hold: { id: 'on_hold', label: 'On Hold', color: 'amber', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', hex: COLORS.amber },
  prospect: { id: 'prospect', label: 'Prospect', color: 'cyan', bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/30', hex: COLORS.cyan },
  archived: { id: 'archived', label: 'Archived', color: 'slate', bg: 'bg-slate-500/10', text: 'text-slate-400', border: 'border-slate-500/30', hex: COLORS.slate },
}

export type ProjectStatus = keyof typeof PROJECT_STATUSES

export const getStatusConfig = (status: string) => {
  return PROJECT_STATUSES[status as ProjectStatus] || PROJECT_STATUSES.active
}

// ============ HEALTH SCORE ============
export const calculateHealthScore = (project: any): number => {
  let score = 100
  
  const budget = project.budget || 0
  const spent = project.spent || 0
  const percentComplete = project.percent_complete || 0
  
  if (budget === 0) return 50 // No budget = neutral
  
  // Margin component (40 points)
  const margin = ((budget - spent) / budget) * 100
  if (margin < 0) score -= 40
  else if (margin < 10) score -= 30
  else if (margin < 20) score -= 15
  else if (margin < 30) score -= 5
  
  // Burn rate vs completion (30 points)
  const burnRate = (spent / budget) * 100
  const burnDelta = burnRate - percentComplete
  if (burnDelta > 20) score -= 30
  else if (burnDelta > 10) score -= 20
  else if (burnDelta > 5) score -= 10
  
  // Timeline (20 points)
  if (project.end_date) {
    const endDate = new Date(project.end_date)
    const today = new Date()
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    if (daysRemaining < 0 && project.status === 'active') score -= 20
    else if (daysRemaining < 7 && percentComplete < 90) score -= 10
  }
  
  // Hours utilization (10 points)
  if (project.budgeted_hours && project.actual_hours) {
    const hoursUtil = (project.actual_hours / project.budgeted_hours) * 100
    if (hoursUtil > 110) score -= 10
    else if (hoursUtil > 100) score -= 5
  }
  
  return Math.max(0, Math.min(100, score))
}

export const getHealthConfig = (score: number) => {
  if (score >= 80) return { label: 'Healthy', bg: 'bg-emerald-500/20', text: 'text-emerald-400', hex: COLORS.emerald }
  if (score >= 60) return { label: 'Warning', bg: 'bg-amber-500/20', text: 'text-amber-400', hex: COLORS.amber }
  return { label: 'At Risk', bg: 'bg-rose-500/20', text: 'text-rose-400', hex: COLORS.rose }
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

// KPI Card with optional trend and sparkline area
export function KPICard({ 
  label, 
  value, 
  subtitle, 
  icon: Icon, 
  color = 'emerald',
  trend,
  onClick,
  selected
}: { 
  label: string
  value: string | number
  subtitle?: string
  icon: any
  color?: string
  trend?: { value: number; label?: string }
  onClick?: () => void
  selected?: boolean
}) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400', rose: 'text-rose-400', amber: 'text-amber-400',
    blue: 'text-blue-400', cyan: 'text-cyan-400', slate: 'text-slate-300',
  }

  return (
    <div 
      onClick={onClick}
      className={`${THEME.glass} border ${selected ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : THEME.glassBorder} rounded-xl p-5 ${THEME.glassHover} transition-all ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`text-xs font-medium ${THEME.textMuted} uppercase tracking-wide`}>{label}</p>
          <div className="flex items-baseline gap-2 mt-1">
            <p className={`text-2xl font-bold ${colorMap[color]}`}>{value}</p>
            {trend && (
              <div className={`flex items-center gap-0.5 ${trend.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {trend.value >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                <span className="text-xs font-medium">{Math.abs(trend.value).toFixed(1)}%</span>
              </div>
            )}
          </div>
          {subtitle && <p className={`text-xs ${THEME.textDim} mt-1`}>{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-lg ${selected ? 'bg-emerald-500/20' : 'bg-white/[0.05]'}`}>
          <Icon size={18} className={selected ? 'text-emerald-400' : THEME.textMuted} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  )
}

// Status Badge
export function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'md' }) {
  const config = getStatusConfig(status)
  const sizeClasses = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
  return (
    <span className={`inline-flex items-center ${sizeClasses} rounded-md font-medium ${config.bg} ${config.text} border ${config.border}`}>
      {config.label}
    </span>
  )
}

// Health Badge
export function HealthBadge({ score }: { score: number }) {
  const config = getHealthConfig(score)
  return (
    <span className={`inline-flex items-center justify-center w-10 h-6 rounded text-xs font-bold ${config.bg} ${config.text}`}>
      {Math.round(score)}
    </span>
  )
}

// Progress Bar
export function ProgressBar({ value, max, color = 'emerald', showLabel = true, size = 'sm' }: {
  value: number; max: number; color?: string; showLabel?: boolean; size?: 'sm' | 'md'
}) {
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0
  const isOver = value > max
  const barColor = isOver ? 'bg-rose-500' : percent > 80 ? 'bg-amber-500' : `bg-${color}-500`
  const height = size === 'sm' ? 'h-1.5' : 'h-2'

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 bg-white/[0.08] rounded-full ${height} overflow-hidden`}>
        <div className={`${height} rounded-full ${barColor} transition-all duration-500`} style={{ width: `${percent}%` }} />
      </div>
      {showLabel && <span className={`text-xs ${THEME.textDim} w-10 text-right`}>{percent.toFixed(0)}%</span>}
    </div>
  )
}

// Margin Indicator
export function MarginIndicator({ margin }: { margin: number }) {
  const color = margin >= 20 ? 'text-emerald-400' : margin >= 10 ? 'text-amber-400' : 'text-rose-400'
  return <span className={`font-semibold ${color}`}>{formatPercent(margin)}</span>
}

// Slicer/Filter Button
export function SlicerButton({ 
  label, 
  value, 
  options, 
  onChange,
  allLabel = 'All'
}: { 
  label: string
  value: string
  options: { id: string; label: string; count?: number }[]
  onChange: (value: string) => void
  allLabel?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedOption = options.find(o => o.id === value)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 ${THEME.glass} border ${THEME.glassBorder} rounded-lg text-sm ${THEME.textSecondary} hover:bg-white/[0.05] transition-colors`}
      >
        <span className={THEME.textDim}>{label}:</span>
        <span className="font-medium">{selectedOption?.label || allLabel}</span>
        <ChevronDown size={14} className={THEME.textDim} />
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className={`absolute top-full left-0 mt-1 w-48 ${THEME.glass} border ${THEME.glassBorder} rounded-lg shadow-xl z-20 overflow-hidden`}>
            <button
              onClick={() => { onChange('all'); setIsOpen(false); }}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-white/[0.05] transition-colors ${value === 'all' ? 'text-emerald-400 bg-emerald-500/10' : THEME.textSecondary}`}
            >
              {allLabel}
            </button>
            {options.map(opt => (
              <button
                key={opt.id}
                onClick={() => { onChange(opt.id); setIsOpen(false); }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-white/[0.05] transition-colors flex items-center justify-between ${value === opt.id ? 'text-emerald-400 bg-emerald-500/10' : THEME.textSecondary}`}
              >
                <span>{opt.label}</span>
                {opt.count !== undefined && <span className={THEME.textDim}>{opt.count}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// Collapsible Section
export function CollapsibleSection({ 
  title, 
  subtitle, 
  badge, 
  children, 
  defaultExpanded = true, 
  noPadding = false,
  action
}: {
  title: string
  subtitle?: string
  badge?: string | number
  children: React.ReactNode
  defaultExpanded?: boolean
  noPadding?: boolean
  action?: { label: string; icon?: any; onClick: () => void }
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  
  return (
    <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
      <div 
        className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder} cursor-pointer hover:bg-white/[0.03] transition-colors`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className={THEME.textMuted}>{isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>{title}</h3>
              {badge !== undefined && <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-white/[0.08] text-slate-300">{badge}</span>}
            </div>
            {subtitle && <p className={`text-xs ${THEME.textDim} mt-0.5`}>{subtitle}</p>}
          </div>
        </div>
        {action && (
          <button
            onClick={(e) => { e.stopPropagation(); action.onClick(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 transition-colors"
          >
            {action.icon && <action.icon size={14} />}
            {action.label}
          </button>
        )}
      </div>
      {isExpanded && <div className={noPadding ? '' : 'p-6'}>{children}</div>}
    </div>
  )
}

// Glass Tooltip for Recharts
export const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-lg px-3 py-2 shadow-xl`}>
      <p className={`text-xs ${THEME.textDim} mb-1`}>{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm font-medium" style={{ color: entry.color || entry.fill }}>
          {entry.name}: {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  )
}

// Empty State
export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action 
}: { 
  icon: any
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
        <Icon size={28} className="text-emerald-400" />
      </div>
      <div className="text-center">
        <p className={`font-medium ${THEME.textSecondary}`}>{title}</p>
        <p className={`text-sm ${THEME.textDim} mt-1`}>{description}</p>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-sm font-medium hover:bg-emerald-500/20 transition-colors"
        >
          <Plus size={16} /> {action.label}
        </button>
      )}
    </div>
  )
}

// Waterfall Item (for financial breakdown)
export function WaterfallItem({ label, value, type, showBar = true }: {
  label: string; value: number; type: 'start' | 'add' | 'subtract' | 'total'; showBar?: boolean
}) {
  const colors = {
    start: 'text-slate-300 bg-slate-500/20',
    add: 'text-emerald-400 bg-emerald-500/20',
    subtract: 'text-rose-400 bg-rose-500/20',
    total: 'text-blue-400 bg-blue-500/20',
  }
  
  return (
    <div className="flex items-center justify-between py-2">
      <span className={`text-sm ${THEME.textSecondary}`}>{label}</span>
      <div className="flex items-center gap-3">
        {showBar && (
          <div className="w-20 h-2 bg-white/[0.08] rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${colors[type].split(' ')[1]}`} style={{ width: '60%' }} />
          </div>
        )}
        <span className={`text-sm font-semibold ${colors[type].split(' ')[0]} w-24 text-right`}>
          {type === 'subtract' ? '-' : ''}{formatCurrency(Math.abs(value))}
        </span>
      </div>
    </div>
  )
}
