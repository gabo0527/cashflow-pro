'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronRight, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// ============ THEME CONSTANTS ============
export const THEME = {
  // Backgrounds
  cardBg: 'bg-slate-900/70 backdrop-blur-xl',
  cardBorder: 'border-white/[0.08]',
  cardBorderHover: 'hover:border-white/[0.12]',
  cardHoverBg: 'hover:bg-white/[0.05]',
  
  // Text
  text: {
    primary: 'text-white',
    secondary: 'text-slate-300',
    muted: 'text-slate-400',
    dim: 'text-slate-500',
  },
  
  // Accent
  accent: '#10b981',
  accentLight: '#34d399',
  
  // Status
  positive: 'text-emerald-400',
  negative: 'text-rose-400',
  warning: 'text-amber-400',
  info: 'text-blue-400',
  
  // Chart colors (monochrome + emerald)
  chartColors: ['#10b981', '#64748b', '#94a3b8', '#cbd5e1', '#475569'],
}

// ============ GLASS CARD ============
interface GlassCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function GlassCard({ children, className, hover = false, padding = 'md' }: GlassCardProps) {
  const paddingMap = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' }
  
  return (
    <div className={cn(
      'rounded-xl border',
      THEME.cardBg,
      THEME.cardBorder,
      hover && cn('transition-all duration-200', THEME.cardHoverBg, THEME.cardBorderHover),
      paddingMap[padding],
      className
    )}>
      {children}
    </div>
  )
}

// ============ SECTION ============
interface SectionProps {
  title: string
  subtitle?: string
  action?: { label: string; href?: string; onClick?: () => void }
  children: React.ReactNode
  className?: string
  noPadding?: boolean
  collapsible?: boolean
  defaultExpanded?: boolean
  badge?: string | number
  headerRight?: React.ReactNode
}

export function Section({ 
  title, subtitle, action, children, className,
  noPadding = false, collapsible = false, defaultExpanded = true,
  badge, headerRight
}: SectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      THEME.cardBg, THEME.cardBorder,
      className
    )}>
      {/* Header */}
      <div 
        className={cn(
          'flex items-center justify-between px-5 py-4 border-b',
          THEME.cardBorder,
          collapsible && 'cursor-pointer hover:bg-white/[0.02] transition-colors'
        )}
        onClick={collapsible ? () => setExpanded(!expanded) : undefined}
      >
        <div className="flex items-center gap-3">
          {collapsible && (
            <div className={THEME.text.muted}>
              {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className={cn('text-sm font-semibold', THEME.text.primary)}>{title}</h3>
              {badge !== undefined && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-white/[0.08] text-slate-300">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && <p className={cn('text-xs mt-0.5', THEME.text.dim)}>{subtitle}</p>}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {headerRight}
          {action && !collapsible && (
            action.onClick ? (
              <button onClick={action.onClick} className={cn('text-xs font-medium flex items-center gap-0.5 transition-colors', THEME.text.muted, 'hover:text-white')}>
                {action.label}<ChevronRight size={14} />
              </button>
            ) : (
              <Link href={action.href || '#'} className={cn('text-xs font-medium flex items-center gap-0.5 transition-colors', THEME.text.muted, 'hover:text-white')}>
                {action.label}<ChevronRight size={14} />
              </Link>
            )
          )}
        </div>
      </div>
      
      {/* Content */}
      {(!collapsible || expanded) && (
        <div className={noPadding ? '' : 'p-5'}>{children}</div>
      )}
    </div>
  )
}

// ============ METRIC CARD ============
interface MetricCardProps {
  label: string
  value: string
  subValue?: string
  trend?: number
  trendLabel?: string
  icon?: any
  color?: 'default' | 'positive' | 'negative' | 'warning'
  href?: string
}

export function MetricCard({ label, value, subValue, trend, trendLabel, icon: Icon, color = 'default', href }: MetricCardProps) {
  const colorMap = {
    default: THEME.text.primary,
    positive: THEME.positive,
    negative: THEME.negative,
    warning: THEME.warning,
  }

  const content = (
    <GlassCard hover className="h-full">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className={cn('text-sm font-medium', THEME.text.muted)}>{label}</p>
          <p className={cn('text-2xl font-semibold tracking-tight', colorMap[color])}>{value}</p>
          {subValue && <p className={cn('text-xs', THEME.text.dim)}>{subValue}</p>}
          {trend !== undefined && (
            <div className="flex items-center gap-1.5 pt-1">
              {trend >= 0 ? <ArrowUpRight size={14} className="text-emerald-400" /> : <ArrowDownRight size={14} className="text-rose-400" />}
              <span className={cn('text-xs font-medium', trend >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
                {Math.abs(trend).toFixed(1)}%
              </span>
              {trendLabel && <span className={cn('text-xs', THEME.text.dim)}>{trendLabel}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className="p-2.5 rounded-lg bg-white/[0.05]">
            <Icon size={20} className={THEME.text.muted} strokeWidth={1.5} />
          </div>
        )}
      </div>
    </GlassCard>
  )
  
  return href ? <Link href={href} className="block h-full">{content}</Link> : content
}

// ============ STATUS BADGE ============
interface StatusBadgeProps {
  status: 'success' | 'warning' | 'error' | 'info' | 'default'
  children: React.ReactNode
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, children, size = 'md' }: StatusBadgeProps) {
  const statusMap = {
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    error: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    info: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    default: 'bg-white/[0.05] text-slate-400 border-white/[0.1]',
  }
  const sizeMap = { sm: 'px-1.5 py-0.5 text-[10px]', md: 'px-2 py-1 text-xs' }

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md font-medium border', statusMap[status], sizeMap[size])}>
      {children}
    </span>
  )
}

// ============ PROGRESS BAR ============
interface ProgressBarProps {
  value: number
  max?: number
  color?: string
  size?: 'sm' | 'md'
  showLabel?: boolean
  label?: string
}

export function ProgressBar({ value, max = 100, color = THEME.accent, size = 'md', showLabel, label }: ProgressBarProps) {
  const pct = Math.min((value / max) * 100, 100)
  const heightMap = { sm: 'h-1', md: 'h-1.5' }
  
  return (
    <div className="w-full">
      {(showLabel || label) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className={cn('text-xs', THEME.text.muted)}>{label}</span>}
          {showLabel && <span className={cn('text-xs font-medium', THEME.text.secondary)}>{pct.toFixed(0)}%</span>}
        </div>
      )}
      <div className={cn('w-full rounded-full overflow-hidden bg-white/[0.08]', heightMap[size])}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

// ============ GLASS BUTTON ============
interface GlassButtonProps {
  children: React.ReactNode
  variant?: 'default' | 'primary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  disabled?: boolean
  className?: string
  icon?: any
}

export function GlassButton({ children, variant = 'default', size = 'md', onClick, disabled, className, icon: Icon }: GlassButtonProps) {
  const variantMap = {
    default: 'bg-white/[0.05] border border-white/[0.1] text-slate-200 hover:bg-white/[0.1] hover:border-white/[0.15]',
    primary: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white border-0 hover:from-emerald-400 hover:to-emerald-500 shadow-lg shadow-emerald-500/25',
    ghost: 'bg-transparent text-slate-400 hover:bg-white/[0.05] hover:text-white',
  }
  const sizeMap = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-2.5 text-sm' }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200',
        variantMap[variant], sizeMap[size],
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      {Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  )
}

// ============ GLASS SELECT ============
interface GlassSelectProps {
  value: string | number
  onChange: (v: string) => void
  options: { value: string | number; label: string }[]
  className?: string
}

export function GlassSelect({ value, onChange, options, className }: GlassSelectProps) {
  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'appearance-none w-full px-3 py-2 pr-8 rounded-lg text-sm font-medium cursor-pointer',
          'bg-white/[0.05] border border-white/[0.1] text-slate-200',
          'hover:bg-white/[0.08] hover:border-white/[0.15]',
          'focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50'
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-slate-900 text-slate-200">{o.label}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
    </div>
  )
}

// ============ GLASS INPUT ============
interface GlassInputProps {
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  icon?: any
  className?: string
}

export function GlassInput({ type = 'text', value, onChange, placeholder, icon: Icon, className }: GlassInputProps) {
  return (
    <div className={cn('relative', className)}>
      {Icon && <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full px-3 py-2 rounded-lg text-sm',
          'bg-white/[0.05] border border-white/[0.1] text-slate-200',
          'placeholder:text-slate-500',
          'hover:bg-white/[0.08] hover:border-white/[0.15]',
          'focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50',
          Icon && 'pl-9'
        )}
      />
    </div>
  )
}

// ============ CHART TOOLTIP ============
interface ChartTooltipProps {
  active?: boolean
  payload?: any[]
  label?: string
  formatter?: (v: number) => string
}

export function ChartTooltip({ active, payload, label, formatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className={cn('rounded-lg px-3 py-2 shadow-xl', THEME.cardBg, 'border', THEME.cardBorder)}>
      <p className={cn('text-xs mb-1', THEME.text.dim)}>{label}</p>
      {payload.map((e: any, i: number) => (
        <p key={i} className="text-sm font-medium" style={{ color: e.color }}>
          {e.name}: {formatter ? formatter(e.value) : e.value}
        </p>
      ))}
    </div>
  )
}

// ============ TABLE ROW ============
interface TableRowProps {
  children: React.ReactNode
  onClick?: () => void
  selected?: boolean
  className?: string
}

export function TableRow({ children, onClick, selected, className }: TableRowProps) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-4 py-3 border-b border-white/[0.05] transition-colors',
        onClick && 'cursor-pointer',
        selected ? 'bg-emerald-500/10' : 'hover:bg-white/[0.03]',
        className
      )}
    >
      {children}
    </div>
  )
}

// ============ UTILITIES ============
export const formatCurrency = (v: number, compact = false): string => {
  if (compact && Math.abs(v) >= 1000000) return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(v)
  if (compact && Math.abs(v) >= 10000) return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 0 }).format(v)
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
}

export const formatNumber = (v: number, d = 1): string => new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: d }).format(v)

export const formatDate = (s: string): string => s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'

export const formatDateFull = (s: string): string => s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
