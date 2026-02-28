'use client'

import React, { useState } from 'react'
import {
  DollarSign, Clock, AlertTriangle, TrendingUp, TrendingDown,
  ChevronDown, ChevronRight, Edit2, Zap, CheckCircle2,
  RefreshCw, X, MoreHorizontal
} from 'lucide-react'

// ============ LIGHT INSTITUTIONAL THEME ============
export const THEME = {
  card: 'bg-white border-slate-200',
  cardHover: 'hover:bg-slate-50',
  border: 'border-slate-200',
  textPrimary: 'text-slate-900',
  textSecondary: 'text-slate-600',
  textMuted: 'text-slate-500',
  textDim: 'text-slate-400',
  chart: { primary: '#059669', secondary: '#6b7280', tertiary: '#9ca3af', grid: 'rgba(0,0,0,0.06)' }
}

export const COLORS = {
  emerald: '#059669',
  amber: '#d97706',
  orange: '#ea580c',
  rose: '#e11d48',
  blue: '#2563eb',
  purple: '#7c3aed',
}

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; text: string; border: string }> = {
  paid: { label: 'Paid', color: COLORS.emerald, bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  partial: { label: 'Partial', color: COLORS.blue, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  current: { label: 'Current', color: '#6b7280', bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' },
  overdue_1_30: { label: 'Overdue', color: COLORS.amber, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  overdue_31_60: { label: '30+ Days', color: COLORS.orange, bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  overdue_61_90: { label: '60+ Days', color: COLORS.rose, bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  overdue_90_plus: { label: '90+ Days', color: '#be123c', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
}

export const PIE_COLORS = ['#059669', '#2563eb', '#7c3aed', '#d97706', '#6b7280']

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
  let label = 'High', color = 'text-emerald-600'
  if (score < 50) { label = 'Low'; color = 'text-red-600' }
  else if (score < 75) { label = 'Medium'; color = 'text-amber-600' }
  return { score, label, color }
}

// ============ SHARED COMPONENTS ============

export function MetricCard({ label, value, subtitle, icon: Icon, trend, color = 'emerald' }: {
  label: string; value: string; subtitle?: string; icon: any
  trend?: { value: number; label: string }
  color?: 'emerald' | 'blue' | 'rose' | 'amber' | 'purple' | 'slate' | 'cyan'
}) {
  const accentMap: Record<string, string> = {
    emerald: '#059669', blue: '#2563eb', rose: '#e11d48',
    amber: '#d97706', purple: '#7c3aed', slate: '#6b7280', cyan: '#0891b2'
  }
  const textMap: Record<string, string> = {
    emerald: 'text-emerald-700', blue: 'text-blue-700', rose: 'text-red-700',
    amber: 'text-amber-700', purple: 'text-purple-700', slate: 'text-slate-700', cyan: 'text-cyan-700'
  }
  return (
    <div className="relative bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all overflow-hidden">
      <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full" style={{ backgroundColor: accentMap[color] }} />
      <div className="flex items-start justify-between pl-2">
        <div>
          <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{label}</p>
          <p className={`text-2xl font-semibold ${textMap[color]} mt-1`}>{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.value >= 0 ? <TrendingUp size={14} className="text-emerald-600" /> : <TrendingDown size={14} className="text-red-600" />}
              <span className={`text-xs font-medium ${trend.value >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{Math.abs(trend.value).toFixed(1)}%</span>
              <span className="text-xs text-slate-400">{trend.label}</span>
            </div>
          )}
        </div>
        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100"><Icon size={18} className="text-slate-400" strokeWidth={1.5} /></div>
      </div>
    </div>
  )
}

export function StatusBadge({ status, daysOverdue }: { status: string; daysOverdue?: number }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.current
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}>
      {config.label}
      {daysOverdue && daysOverdue > 0 && !['paid', 'partial', 'current'].includes(status) && (
        <span className="opacity-75">({daysOverdue}d)</span>
      )}
    </span>
  )
}

export function ProbabilityBadge({ score, color }: { score: number; color: string }) {
  const bgColor = score >= 75 ? 'bg-emerald-50' : score >= 50 ? 'bg-amber-50' : 'bg-red-50'
  return (
    <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${bgColor}`}>
      <Zap size={10} className={color} />
      <span className={`text-[10px] font-bold ${color}`}>{score}%</span>
    </div>
  )
}

export function AgingBar({ label, amount, total, count, color }: { label: string; amount: number; total: number; count: number; color: string }) {
  const percent = total > 0 ? (amount / total) * 100 : 0
  return (
    <div className="flex items-center gap-4 py-2.5">
      <div className="w-24 shrink-0"><p className="text-sm text-slate-600">{label}</p></div>
      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
      <div className="w-28 text-right shrink-0"><p className="text-sm font-semibold text-slate-900">{formatCurrency(amount)}</p></div>
      <div className="w-16 text-right shrink-0"><p className="text-xs text-slate-400">{count} inv</p></div>
      <div className="w-12 text-right shrink-0"><p className="text-xs text-slate-500">{percent.toFixed(0)}%</p></div>
    </div>
  )
}

export const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
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
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 transition-colors group">
        <span className={selectedOption ? '' : 'text-slate-400 italic'}>{selectedOption?.name || placeholder}</span>
        <Edit2 size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-20 overflow-hidden">
            <div className="p-2 border-b border-slate-100">
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
                className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" autoFocus />
            </div>
            <div className="max-h-48 overflow-y-auto">
              <button onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }} className="w-full px-3 py-2 text-left text-sm text-slate-400 hover:bg-slate-50 transition-colors">— None —</button>
              {filteredOptions.map(opt => (
                <button key={opt.id} onClick={() => { onChange(opt.id); setIsOpen(false); setSearch(''); }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors ${opt.id === value ? 'text-emerald-600 bg-emerald-50 font-medium' : 'text-slate-700'}`}>{opt.name}</button>
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
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-3">
          <div className="text-slate-400">{isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
              {badge !== undefined && <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200">{badge}</span>}
            </div>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action && (
          <button 
            onClick={(e) => { e.stopPropagation(); action.onClick(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Record Payment</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors"><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="text-sm font-medium text-slate-700">{label} #{number}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-slate-400">Outstanding Balance</span>
              <span className="text-lg font-semibold text-amber-600">{formatCurrency(invoice.balance)}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1.5">Payment Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
              <input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg pl-7 pr-3 py-2.5 text-lg font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setPaymentAmount(invoice.balance.toString())}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors">
              Pay in Full
            </button>
            <button onClick={() => setPaymentAmount((invoice.balance / 2).toFixed(2))}
              className="px-3 py-1.5 text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">
              50%
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">Cancel</button>
          <button onClick={() => { onSave(invoice.id, parseFloat(paymentAmount) || 0); onClose(); }}
            disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
            className="px-5 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
            Record Payment
          </button>
        </div>
      </div>
    </div>
  )
}
