'use client'

import React, { useState } from 'react'
import {
  DollarSign, Clock, AlertTriangle, TrendingUp, TrendingDown,
  ChevronDown, ChevronRight, Edit2, Zap, CheckCircle2,
  RefreshCw, X, MoreHorizontal
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
  chart: { primary: '#10B981', secondary: '#64748b', tertiary: '#94a3b8', grid: 'rgba(255,255,255,0.06)' }
}

export const COLORS = {
  emerald: '#10b981',
  amber: '#f59e0b',
  orange: '#f97316',
  rose: '#f43f5e',
  blue: '#3b82f6',
  purple: '#8b5cf6',
}

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; text: string; border: string }> = {
  paid: { label: 'Paid', color: COLORS.emerald, bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  partial: { label: 'Partial', color: COLORS.blue, bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  current: { label: 'Current', color: '#64748b', bg: 'bg-slate-500/10', text: 'text-slate-300', border: 'border-slate-500/30' },
  overdue_1_30: { label: 'Overdue', color: COLORS.amber, bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  overdue_31_60: { label: '30+ Days', color: COLORS.orange, bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  overdue_61_90: { label: '60+ Days', color: COLORS.rose, bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  overdue_90_plus: { label: '90+ Days', color: '#be123c', bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-500/40' },
}

export const PIE_COLORS = ['#10B981', '#64748b', '#94a3b8', '#cbd5e1', '#475569']

// ============ UTILITY FUNCTIONS ============
export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)

export const formatDateShort = (dateStr: string): string => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const getInvoiceStatus = (dueDate: string, amount: number, balance: number): string => {
  if (balance === 0) return 'paid'
  if (balance < amount && balance > 0) return 'partial'
  const today = new Date()
  const due = new Date(dueDate)
  const diffDays = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 'current'
  if (diffDays <= 30) return 'overdue_1_30'
  if (diffDays <= 60) return 'overdue_31_60'
  if (diffDays <= 90) return 'overdue_61_90'
  return 'overdue_90_plus'
}

export const getDaysOverdue = (dueDate: string): number => {
  const today = new Date()
  const due = new Date(dueDate)
  return Math.max(0, Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)))
}

// ============ PAYMENT PROBABILITY ============
export const getPaymentProbability = (invoice: any, clientHistory: any[]): { score: number; label: string; color: string } => {
  const daysOverdue = getDaysOverdue(invoice.due_date)
  let score = 95
  if (daysOverdue > 0) score -= Math.min(daysOverdue * 0.8, 50)
  const clientPaid = clientHistory.filter(inv => inv.client_id === invoice.client_id && inv.balance === 0)
  const clientTotal = clientHistory.filter(inv => inv.client_id === invoice.client_id)
  if (clientTotal.length > 0) { const payRate = clientPaid.length / clientTotal.length; score = score * (0.7 + (payRate * 0.3)) }
  if (invoice.balance > 50000) score *= 0.95
  if (invoice.balance > 100000) score *= 0.90
  score = Math.max(10, Math.min(99, Math.round(score)))
  let label = 'High', color = 'text-emerald-400'
  if (score < 50) { label = 'Low'; color = 'text-rose-400' }
  else if (score < 75) { label = 'Medium'; color = 'text-amber-400' }
  return { score, label, color }
}

// ============ SHARED COMPONENTS ============

export function MetricCard({ label, value, subtitle, icon: Icon, trend, color = 'emerald' }: {
  label: string; value: string; subtitle?: string; icon: any
  trend?: { value: number; label: string }
  color?: 'emerald' | 'blue' | 'rose' | 'amber' | 'purple' | 'slate' | 'cyan'
}) {
  const colorMap: Record<string, string> = {
    emerald: 'text-emerald-400', blue: 'text-blue-400', rose: 'text-rose-400',
    amber: 'text-amber-400', purple: 'text-purple-400', slate: 'text-slate-300', cyan: 'text-cyan-400'
  }
  return (
    <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-5 ${THEME.glassHover} transition-all`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-sm font-medium ${THEME.textMuted}`}>{label}</p>
          <p className={`text-2xl font-semibold ${colorMap[color]} mt-1`}>{value}</p>
          {subtitle && <p className={`text-xs ${THEME.textDim} mt-1`}>{subtitle}</p>}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.value >= 0 ? <TrendingUp size={14} className="text-emerald-400" /> : <TrendingDown size={14} className="text-rose-400" />}
              <span className={`text-xs font-medium ${trend.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{Math.abs(trend.value).toFixed(1)}%</span>
              <span className={`text-xs ${THEME.textDim}`}>{trend.label}</span>
            </div>
          )}
        </div>
        <div className="p-2.5 rounded-lg bg-white/[0.05]"><Icon size={20} className={THEME.textMuted} strokeWidth={1.5} /></div>
      </div>
    </div>
  )
}

export function StatusBadge({ status, daysOverdue }: { status: string; daysOverdue?: number }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.current
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}>
      {config.label}
      {daysOverdue && daysOverdue > 0 && !['paid', 'partial', 'current'].includes(status) && (
        <span className="opacity-75">({daysOverdue}d)</span>
      )}
    </span>
  )
}

export function ProbabilityBadge({ score, color }: { score: number; color: string }) {
  const bgColor = score >= 75 ? 'bg-emerald-500/10' : score >= 50 ? 'bg-amber-500/10' : 'bg-rose-500/10'
  return (
    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${bgColor}`}>
      <Zap size={10} className={color} />
      <span className={`text-[10px] font-bold ${color}`}>{score}%</span>
    </div>
  )
}

export function AgingBar({ label, amount, total, count, color }: { label: string; amount: number; total: number; count: number; color: string }) {
  const percent = total > 0 ? (amount / total) * 100 : 0
  return (
    <div className="flex items-center gap-4 py-2.5">
      <div className="w-24 shrink-0"><p className={`text-sm ${THEME.textSecondary}`}>{label}</p></div>
      <div className="flex-1 h-2 bg-white/[0.08] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
      <div className="w-28 text-right shrink-0"><p className={`text-sm font-semibold ${THEME.textPrimary}`}>{formatCurrency(amount)}</p></div>
      <div className="w-16 text-right shrink-0"><p className={`text-xs ${THEME.textDim}`}>{count} inv</p></div>
      <div className="w-12 text-right shrink-0"><p className={`text-xs ${THEME.textMuted}`}>{percent.toFixed(0)}%</p></div>
    </div>
  )
}

export const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-lg px-3 py-2 shadow-xl`}>
      <p className={`text-xs ${THEME.textDim} mb-1`}>{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  )
}

export function EditableSelect({ value, options, onChange, placeholder = 'Select...' }: {
  value: string; options: { id: string; name: string }[]; onChange: (value: string) => void; placeholder?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const filteredOptions = options.filter(opt => opt.name.toLowerCase().includes(search.toLowerCase()))
  const selectedOption = options.find(opt => opt.id === value)

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className={`flex items-center gap-1 text-sm ${THEME.textSecondary} hover:text-white transition-colors group`}>
        <span className={selectedOption ? '' : `${THEME.textDim} italic`}>{selectedOption?.name || placeholder}</span>
        <Edit2 size={12} className={`${THEME.textDim} opacity-0 group-hover:opacity-100 transition-opacity`} />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className={`absolute top-full left-0 mt-1 w-56 ${THEME.glass} border ${THEME.glassBorder} rounded-lg shadow-xl z-20 overflow-hidden`}>
            <div className="p-2 border-b border-white/[0.08]">
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded px-2 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" autoFocus />
            </div>
            <div className="max-h-48 overflow-y-auto">
              <button onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }} className={`w-full px-3 py-2 text-left text-sm ${THEME.textDim} hover:bg-white/[0.05] transition-colors`}>— None —</button>
              {filteredOptions.map(opt => (
                <button key={opt.id} onClick={() => { onChange(opt.id); setIsOpen(false); setSearch(''); }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-white/[0.05] transition-colors ${opt.id === value ? 'text-emerald-400 bg-emerald-500/10' : THEME.textSecondary}`}>{opt.name}</button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function CollapsibleSection({ title, subtitle, badge, children, defaultExpanded = true, noPadding = false, action }: {
  title: string; subtitle?: string; badge?: string | number; children: React.ReactNode; defaultExpanded?: boolean; noPadding?: boolean
  action?: { label: string; onClick: () => void }
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  return (
    <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
      <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder} cursor-pointer hover:bg-white/[0.03] transition-colors`}
        onClick={() => setIsExpanded(!isExpanded)}>
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
            + {action.label}
          </button>
        )}
      </div>
      {isExpanded && <div className={noPadding ? '' : 'p-6'}>{children}</div>}
    </div>
  )
}

// Payment Modal
export function PaymentModal({ invoice, onClose, onSave, type = 'invoice' }: { 
  invoice: any; 
  onClose: () => void; 
  onSave: (id: string, amount: number) => void
  type?: 'invoice' | 'bill'
}) {
  const [paymentAmount, setPaymentAmount] = useState(invoice?.balance?.toString() || '0')

  if (!invoice) return null

  const label = type === 'bill' ? 'Bill' : 'Invoice'
  const number = type === 'bill' ? invoice.bill_number : invoice.invoice_number

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-2xl w-full max-w-md mx-4 overflow-hidden`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
          <h3 className={`text-lg font-semibold ${THEME.textPrimary}`}>Record Payment</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/[0.05] rounded-lg transition-colors"><X size={20} className={THEME.textMuted} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-lg p-4">
            <p className={`text-sm font-medium ${THEME.textSecondary}`}>{label} #{number}</p>
            <div className="flex items-center justify-between mt-2">
              <span className={`text-xs ${THEME.textDim}`}>Outstanding Balance</span>
              <span className="text-lg font-semibold text-amber-400">{formatCurrency(invoice.balance)}</span>
            </div>
          </div>
          <div>
            <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Payment Amount</label>
            <div className="relative">
              <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${THEME.textDim}`}>$</span>
              <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg pl-7 pr-3 py-2.5 text-lg font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPaymentAmount(invoice.balance.toString())}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/20 transition-colors">
              Pay in Full
            </button>
            <button onClick={() => setPaymentAmount((invoice.balance / 2).toFixed(2))}
              className="px-3 py-1.5 text-xs font-medium bg-white/[0.05] text-slate-300 border border-white/[0.1] rounded-lg hover:bg-white/[0.08] transition-colors">
              50%
            </button>
          </div>
        </div>
        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${THEME.glassBorder} bg-white/[0.02]`}>
          <button onClick={onClose} className={`px-4 py-2 text-sm font-medium ${THEME.textMuted} hover:text-white transition-colors`}>Cancel</button>
          <button onClick={() => { onSave(invoice.id, parseFloat(paymentAmount) || 0); onClose(); }}
            disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
            className="px-5 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-emerald-500/20">
            Record Payment
          </button>
        </div>
      </div>
    </div>
  )
}
