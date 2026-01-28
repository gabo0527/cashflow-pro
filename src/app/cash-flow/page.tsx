'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  TrendingUp, TrendingDown, DollarSign, CreditCard, Building2, Wallet,
  Plus, ChevronDown, ChevronRight, Filter, Download, Upload, Search,
  ArrowUpRight, ArrowDownRight, Receipt, Users, Briefcase, RefreshCw,
  MoreHorizontal, Edit2, Trash2, Check, X, AlertCircle, Calendar,
  PieChart, BarChart3, ArrowRight, CircleDollarSign, Landmark, FileText
} from 'lucide-react'
import Link from 'next/link'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, ComposedChart, Line, Area, AreaChart
} from 'recharts'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/supabase'

const supabase = createClient(
  'https://jmahfgpbtjeomuepfozf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYWhmZ3BidGplb211ZXBmb3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0OTAxNzcsImV4cCI6MjA4MTA2NjE3N30.3SVDvWCGIYYHV57BpKjpDJVCZLKzuRv8B_VietQDxUQ'
)

// ============ DESIGN SYSTEM ============
const COLORS = {
  emerald: '#10b981',
  emeraldLight: '#34d399',
  blue: '#3b82f6',
  blueLight: '#60a5fa',
  rose: '#f43f5e',
  roseLight: '#fb7185',
  amber: '#f59e0b',
  amberLight: '#fbbf24',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  slate: {
    50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
    400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155',
    800: '#1e293b', 900: '#0f172a'
  }
}

// ============ CATEGORY DEFINITIONS ============
const CATEGORIES = {
  revenue: {
    label: 'Revenue',
    color: COLORS.emerald,
    subcategories: ['Client Revenue', 'Reimbursements', 'Other Income']
  },
  directCosts: {
    label: 'Direct Costs',
    color: COLORS.rose,
    subcategories: ['Contractor Labor', 'Materials', 'Subcontractors', 'Project Expenses']
  },
  overhead: {
    label: 'Overhead',
    color: COLORS.amber,
    subcategories: ['Payroll', 'Software & Subscriptions', 'Rent & Utilities', 'Insurance', 'Professional Services', 'Travel & Entertainment', 'Office & Supplies', 'Marketing', 'Other Overhead']
  },
  nonOperating: {
    label: 'Non-Operating',
    color: COLORS.slate[500],
    subcategories: ['Transfers', 'Owner Draw', 'Taxes', 'Loan Payments']
  }
}

// ============ UTILITY FUNCTIONS ============
const formatCurrency = (value: number, compact = false): string => {
  if (compact && Math.abs(value) >= 1000000) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value)
  }
  if (compact && Math.abs(value) >= 10000) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 0 }).format(value)
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const formatDateFull = (dateStr: string): string => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ============ COMPONENTS ============

// Metric Card
function MetricCard({ 
  label, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  color = 'emerald',
  size = 'default'
}: { 
  label: string
  value: string
  subtitle?: string
  icon: any
  trend?: { value: number; label: string }
  color?: 'emerald' | 'blue' | 'rose' | 'amber' | 'purple' | 'slate'
  size?: 'default' | 'large'
}) {
  const colorMap = {
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', icon: 'text-emerald-500' },
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', icon: 'text-blue-500' },
    rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', icon: 'text-rose-500' },
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', icon: 'text-amber-500' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', icon: 'text-purple-500' },
    slate: { bg: 'bg-slate-500/10', border: 'border-slate-500/20', text: 'text-slate-400', icon: 'text-slate-500' }
  }
  const c = colorMap[color]
  const isLarge = size === 'large'

  return (
    <div className={`${c.bg} ${c.border} border rounded-xl ${isLarge ? 'p-6' : 'p-5'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">{label}</p>
          <p className={`${isLarge ? 'text-3xl' : 'text-2xl'} font-bold ${c.text} mt-1`}>{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.value >= 0 ? <ArrowUpRight size={14} className="text-emerald-500" /> : <ArrowDownRight size={14} className="text-rose-500" />}
              <span className={`text-xs font-medium ${trend.value >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{Math.abs(trend.value).toFixed(1)}%</span>
              <span className="text-xs text-slate-500">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={`${c.bg} p-2.5 rounded-lg`}>
          <Icon size={20} className={c.icon} />
        </div>
      </div>
    </div>
  )
}

// Account Card
function AccountCard({ 
  name, 
  type, 
  balance, 
  lastSync,
  isConnected = false
}: { 
  name: string
  type: 'bank' | 'credit_card'
  balance: number
  lastSync?: string
  isConnected?: boolean
}) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 hover:border-slate-600/50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${type === 'bank' ? 'bg-blue-500/10' : 'bg-purple-500/10'}`}>
            {type === 'bank' ? <Landmark size={18} className="text-blue-500" /> : <CreditCard size={18} className="text-purple-500" />}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">{name}</p>
            <p className="text-xs text-slate-500">{type === 'bank' ? 'Bank Account' : 'Credit Card'}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-lg font-semibold ${balance >= 0 ? 'text-slate-100' : 'text-rose-400'}`}>
            {formatCurrency(balance)}
          </p>
          {isConnected && lastSync && (
            <p className="text-xs text-slate-500">Synced {lastSync}</p>
          )}
          {!isConnected && (
            <span className="text-xs text-amber-500">Manual</span>
          )}
        </div>
      </div>
    </div>
  )
}

// P&L Waterfall Bar
function WaterfallBar({ 
  label, 
  value, 
  maxValue, 
  color, 
  isSubtotal = false,
  showPercent,
  percentValue
}: { 
  label: string
  value: number
  maxValue: number
  color: string
  isSubtotal?: boolean
  showPercent?: boolean
  percentValue?: number
}) {
  const width = Math.min(Math.abs(value) / maxValue * 100, 100)
  
  return (
    <div className={`flex items-center gap-4 ${isSubtotal ? 'py-3 border-t border-slate-700/50 mt-2' : 'py-2'}`}>
      <div className="w-32 shrink-0">
        <p className={`text-sm ${isSubtotal ? 'font-semibold text-slate-200' : 'text-slate-400'}`}>{label}</p>
      </div>
      <div className="flex-1 h-6 bg-slate-700/30 rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${width}%`, backgroundColor: color }}
        />
      </div>
      <div className="w-28 text-right shrink-0">
        <p className={`text-sm font-semibold ${isSubtotal ? 'text-slate-100' : 'text-slate-300'}`}>
          {value < 0 ? '-' : ''}{formatCurrency(Math.abs(value))}
        </p>
      </div>
      {showPercent && (
        <div className="w-16 text-right shrink-0">
          <p className={`text-sm font-medium ${(percentValue || 0) >= 30 ? 'text-emerald-400' : (percentValue || 0) >= 15 ? 'text-amber-400' : 'text-rose-400'}`}>
            {percentValue?.toFixed(1)}%
          </p>
        </div>
      )}
    </div>
  )
}

// Transaction Row
function TransactionRow({ 
  transaction, 
  onEdit, 
  onDelete 
}: { 
  transaction: any
  onEdit: () => void
  onDelete: () => void
}) {
  const isInflow = transaction.amount > 0
  const categoryColor = transaction.category === 'revenue' ? COLORS.emerald 
    : transaction.category === 'directCosts' ? COLORS.rose
    : transaction.category === 'overhead' ? COLORS.amber
    : COLORS.slate[500]

  return (
    <div className="flex items-center gap-4 py-3 px-4 hover:bg-slate-800/30 transition-colors border-b border-slate-700/30 last:border-0">
      <div className="w-20 shrink-0">
        <p className="text-sm text-slate-400">{formatDate(transaction.date)}</p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">{transaction.description}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${categoryColor}20`, color: categoryColor }}>
            {transaction.subcategory || CATEGORIES[transaction.category as keyof typeof CATEGORIES]?.label}
          </span>
          {transaction.project && (
            <span className="text-xs text-slate-500">• {transaction.project}</span>
          )}
          {transaction.vendor && (
            <span className="text-xs text-slate-500">• {transaction.vendor}</span>
          )}
        </div>
      </div>
      <div className="w-24 text-right shrink-0">
        <p className={`text-sm font-semibold ${isInflow ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isInflow ? '+' : '-'}{formatCurrency(Math.abs(transaction.amount))}
        </p>
      </div>
      <div className="w-24 text-right shrink-0">
        <p className="text-xs text-slate-500">{transaction.account}</p>
      </div>
      <div className="w-8 shrink-0">
        <button className="p-1 hover:bg-slate-700 rounded transition-colors">
          <MoreHorizontal size={16} className="text-slate-500" />
        </button>
      </div>
    </div>
  )
}

// Custom Tooltip
const CustomTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  )
}

// Section Header
function SectionHeader({ 
  title, 
  subtitle,
  action 
}: { 
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

// Add Transaction Modal
function AddTransactionModal({ 
  isOpen, 
  onClose, 
  accounts,
  onSave 
}: { 
  isOpen: boolean
  onClose: () => void
  accounts: any[]
  onSave: (transaction: any) => void
}) {
  const [type, setType] = useState<'inflow' | 'outflow'>('outflow')
  const [category, setCategory] = useState('directCosts')
  const [subcategory, setSubcategory] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [accountId, setAccountId] = useState('')
  const [vendor, setVendor] = useState('')
  const [project, setProject] = useState('')

  if (!isOpen) return null

  const handleSave = () => {
    onSave({
      type,
      category: type === 'inflow' ? 'revenue' : category,
      subcategory,
      amount: type === 'inflow' ? Math.abs(parseFloat(amount)) : -Math.abs(parseFloat(amount)),
      description,
      date,
      account_id: accountId,
      vendor,
      project
    })
    onClose()
  }

  const currentSubcategories = type === 'inflow' 
    ? CATEGORIES.revenue.subcategories 
    : CATEGORIES[category as keyof typeof CATEGORIES]?.subcategories || []

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100">Add Transaction</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-lg transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Type Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setType('inflow')}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                type === 'inflow' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700/50 text-slate-400 border border-transparent'
              }`}
            >
              <ArrowDownRight size={16} className="inline mr-2" />
              Cash In
            </button>
            <button
              onClick={() => setType('outflow')}
              className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                type === 'outflow' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-700/50 text-slate-400 border border-transparent'
              }`}
            >
              <ArrowUpRight size={16} className="inline mr-2" />
              Cash Out
            </button>
          </div>

          {/* Category (for outflows) */}
          {type === 'outflow' && (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Category</label>
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setSubcategory(''); }}
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="directCosts">Direct Costs (affects GM)</option>
                <option value="overhead">Overhead</option>
                <option value="nonOperating">Non-Operating</option>
              </select>
            </div>
          )}

          {/* Subcategory */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Subcategory</label>
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="">Select...</option>
              {currentSubcategories.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          {/* Amount & Date Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-7 pr-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Travis Swank - January Invoice"
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Account */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Account</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="">Select account...</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>

          {/* Vendor (for outflows) */}
          {type === 'outflow' && category === 'directCosts' && (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Contractor/Vendor</label>
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g., Travis Swank"
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {/* Project */}
          {(type === 'inflow' || category === 'directCosts') && (
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Project (optional)</label>
              <input
                type="text"
                value={project}
                onChange={(e) => setProject(e.target.value)}
                placeholder="e.g., Clean Arc Data Center"
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700 bg-slate-800/50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={!amount || !description || !subcategory}
            className="px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add Transaction
          </button>
        </div>
      </div>
    </div>
  )
}

// Add Account Modal
function AddAccountModal({ 
  isOpen, 
  onClose, 
  onSave,
  editAccount,
  onDelete
}: { 
  isOpen: boolean
  onClose: () => void
  onSave: (account: any) => void
  editAccount?: any
  onDelete?: (id: string) => void
}) {
  const [name, setName] = useState(editAccount?.name || '')
  const [type, setType] = useState<'bank' | 'credit_card'>(editAccount?.type || 'credit_card')
  const [balance, setBalance] = useState(editAccount ? Math.abs(editAccount.balance).toString() : '')

  // Reset form when editAccount changes
  useEffect(() => {
    if (editAccount) {
      setName(editAccount.name)
      setType(editAccount.type)
      setBalance(Math.abs(editAccount.balance).toString())
    } else {
      setName('')
      setType('credit_card')
      setBalance('')
    }
  }, [editAccount, isOpen])

  if (!isOpen) return null

  const handleSave = () => {
    onSave({
      id: editAccount?.id,
      name,
      type,
      balance: type === 'credit_card' ? -Math.abs(parseFloat(balance) || 0) : parseFloat(balance) || 0,
      is_connected: editAccount?.is_connected || false,
      last_sync: editAccount?.last_sync
    })
    setName('')
    setBalance('')
    onClose()
  }

  const isEditing = !!editAccount

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100">{isEditing ? 'Edit Account' : 'Add Account'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-lg transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Account Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Chase Business Checking"
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Account Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => setType('bank')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                  type === 'bank' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-slate-700/50 text-slate-400 border border-transparent'
                }`}
              >
                <Landmark size={16} className="inline mr-2" />
                Bank Account
              </button>
              <button
                onClick={() => setType('credit_card')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                  type === 'credit_card' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-slate-700/50 text-slate-400 border border-transparent'
                }`}
              >
                <CreditCard size={16} className="inline mr-2" />
                Credit Card
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">
              {type === 'credit_card' ? 'Current Balance (amount owed)' : 'Current Balance'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
              <input
                type="number"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-7 pr-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            {type === 'credit_card' && (
              <p className="text-xs text-slate-500 mt-1">Enter as positive number (we'll track it as debt)</p>
            )}
          </div>

          {editAccount?.is_connected && (
            <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <RefreshCw size={14} className="text-blue-400" />
              <span className="text-xs text-blue-400">Connected to QuickBooks • Last sync: {editAccount.last_sync}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 bg-slate-800/50">
          <div>
            {isEditing && !editAccount?.is_connected && onDelete && (
              <button 
                onClick={() => {
                  if (confirm('Delete this account? This will not delete transactions.')) {
                    onDelete(editAccount.id)
                  }
                }}
                className="px-3 py-1.5 text-sm font-medium text-rose-400 hover:text-rose-300 transition-colors"
              >
                Delete Account
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors">
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={!name}
              className="px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isEditing ? 'Save Changes' : 'Add Account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ MAIN PAGE ============
export default function CashFlowPage() {
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>(new Date().getMonth())
  const [showAddTransaction, setShowAddTransaction] = useState(false)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [editingAccount, setEditingAccount] = useState<any>(null)
  const [filterAccount, setFilterAccount] = useState<string>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Sample data - will be replaced with Supabase data
  const [accounts, setAccounts] = useState([
    { id: '1', name: 'Chase Business Checking', type: 'bank', balance: 125430, is_connected: true, last_sync: '2 hours ago' },
    { id: '2', name: 'Amex Business Platinum', type: 'credit_card', balance: -4200, is_connected: true, last_sync: '2 hours ago' },
    { id: '3', name: 'Amex - Gabriel (AU)', type: 'credit_card', balance: -1850, is_connected: false },
    { id: '4', name: 'Amex - Maria (AU)', type: 'credit_card', balance: -920, is_connected: false },
  ])

  const [transactions, setTransactions] = useState([
    { id: '1', date: '2024-01-28', description: 'Clean Arc Data Center - Progress Payment', amount: 45000, category: 'revenue', subcategory: 'Client Revenue', account: 'Chase Business Checking', project: 'Clean Arc Data Center' },
    { id: '2', date: '2024-01-27', description: 'Travis Swank - January Invoice', amount: -8500, category: 'directCosts', subcategory: 'Contractor Labor', account: 'Chase Business Checking', vendor: 'Travis Swank', project: 'Clean Arc Data Center' },
    { id: '3', date: '2024-01-26', description: 'Miguel Fernandez - Week 4', amount: -3200, category: 'directCosts', subcategory: 'Contractor Labor', account: 'Chase Business Checking', vendor: 'Miguel Fernandez', project: 'TechFlow Migration' },
    { id: '4', date: '2024-01-25', description: 'Figma - Annual Subscription', amount: -144, category: 'overhead', subcategory: 'Software & Subscriptions', account: 'Amex Business Platinum' },
    { id: '5', date: '2024-01-25', description: 'AWS Services - January', amount: -892, category: 'overhead', subcategory: 'Software & Subscriptions', account: 'Amex Business Platinum' },
    { id: '6', date: '2024-01-24', description: 'TechFlow Inc - Milestone 2', amount: 28000, category: 'revenue', subcategory: 'Client Revenue', account: 'Chase Business Checking', project: 'TechFlow Migration' },
    { id: '7', date: '2024-01-23', description: 'Office Rent - January', amount: -3500, category: 'overhead', subcategory: 'Rent & Utilities', account: 'Chase Business Checking' },
    { id: '8', date: '2024-01-22', description: 'Client Dinner - Clean Arc Team', amount: -285, category: 'overhead', subcategory: 'Travel & Entertainment', account: 'Amex - Gabriel (AU)' },
    { id: '9', date: '2024-01-20', description: 'DataSys Corp - Retainer', amount: 12000, category: 'revenue', subcategory: 'Client Revenue', account: 'Chase Business Checking', project: 'DataSys Retainer' },
    { id: '10', date: '2024-01-18', description: 'Equipment Purchase', amount: -2400, category: 'directCosts', subcategory: 'Materials', account: 'Amex - Maria (AU)', project: 'Clean Arc Data Center' },
  ])

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setLoading(false), 500)
  }, [])

  // Calculate P&L metrics
  const pnlMetrics = useMemo(() => {
    const filtered = transactions.filter(t => {
      const txDate = new Date(t.date)
      if (txDate.getFullYear() !== selectedYear) return false
      if (selectedMonth !== 'all' && txDate.getMonth() !== selectedMonth) return false
      return true
    })

    const revenue = filtered.filter(t => t.category === 'revenue').reduce((sum, t) => sum + t.amount, 0)
    const directCosts = Math.abs(filtered.filter(t => t.category === 'directCosts').reduce((sum, t) => sum + t.amount, 0))
    const overhead = Math.abs(filtered.filter(t => t.category === 'overhead').reduce((sum, t) => sum + t.amount, 0))
    const grossProfit = revenue - directCosts
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0
    const netProfit = grossProfit - overhead
    const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0

    return { revenue, directCosts, overhead, grossProfit, grossMargin, netProfit, netMargin }
  }, [transactions, selectedYear, selectedMonth])

  // Account totals
  const accountTotals = useMemo(() => {
    const bankTotal = accounts.filter(a => a.type === 'bank').reduce((sum, a) => sum + a.balance, 0)
    const ccTotal = accounts.filter(a => a.type === 'credit_card').reduce((sum, a) => sum + a.balance, 0)
    return { bankTotal, ccTotal, netCash: bankTotal + ccTotal }
  }, [accounts])

  // Filtered transactions for list
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const txDate = new Date(t.date)
      if (txDate.getFullYear() !== selectedYear) return false
      if (selectedMonth !== 'all' && txDate.getMonth() !== selectedMonth) return false
      if (filterAccount !== 'all' && t.account !== filterAccount) return false
      if (filterCategory !== 'all' && t.category !== filterCategory) return false
      if (searchQuery && !t.description.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
  }, [transactions, selectedYear, selectedMonth, filterAccount, filterCategory, searchQuery])

  // Revenue by client
  const revenueByClient = useMemo(() => {
    const byProject: { [key: string]: number } = {}
    transactions
      .filter(t => t.category === 'revenue')
      .forEach(t => {
        const project = t.project || 'Other'
        byProject[project] = (byProject[project] || 0) + t.amount
      })
    return Object.entries(byProject)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [transactions])

  // Expense breakdown
  const expenseBreakdown = useMemo(() => {
    const bySubcat: { [key: string]: { category: string; value: number } } = {}
    transactions
      .filter(t => ['directCosts', 'overhead'].includes(t.category))
      .forEach(t => {
        const key = t.subcategory || 'Other'
        if (!bySubcat[key]) bySubcat[key] = { category: t.category, value: 0 }
        bySubcat[key].value += Math.abs(t.amount)
      })
    return Object.entries(bySubcat)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value)
  }, [transactions])

  const handleAddTransaction = (transaction: any) => {
    const account = accounts.find(a => a.id === transaction.account_id)
    setTransactions(prev => [{
      id: Date.now().toString(),
      ...transaction,
      account: account?.name || ''
    }, ...prev])
  }

  const handleAddAccount = (account: any) => {
    if (account.id) {
      // Edit existing account
      setAccounts(prev => prev.map(acc => acc.id === account.id ? account : acc))
    } else {
      // Add new account
      setAccounts(prev => [...prev, { id: Date.now().toString(), ...account }])
    }
    setEditingAccount(null)
  }

  const handleDeleteAccount = (accountId: string) => {
    setAccounts(prev => prev.filter(acc => acc.id !== accountId))
    setEditingAccount(null)
  }

  const months = [
    { value: 'all', label: 'All Months' },
    { value: 0, label: 'January' },
    { value: 1, label: 'February' },
    { value: 2, label: 'March' },
    { value: 3, label: 'April' },
    { value: 4, label: 'May' },
    { value: 5, label: 'June' },
    { value: 6, label: 'July' },
    { value: 7, label: 'August' },
    { value: 8, label: 'September' },
    { value: 9, label: 'October' },
    { value: 10, label: 'November' },
    { value: 11, label: 'December' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading cash flow...</p>
        </div>
      </div>
    )
  }

  const maxPnlValue = Math.max(pnlMetrics.revenue, pnlMetrics.directCosts + pnlMetrics.overhead)

  return (
    <div className="space-y-6 pb-8">
      {/* ============ HEADER ============ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Cash Flow</h1>
          <p className="text-sm text-slate-400 mt-1">Real-time cash position & profitability</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            {[2026, 2025, 2024, 2023].map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            {months.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <button className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:border-slate-600 transition-colors">
            <RefreshCw size={16} />
            Sync QBO
          </button>
          <button 
            onClick={() => setShowAddTransaction(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
          >
            <Plus size={16} />
            Add Entry
          </button>
        </div>
      </div>

      {/* ============ POSITION OVERVIEW ============ */}
      <div className="grid grid-cols-12 gap-4">
        {/* Cash Position */}
        <div className="col-span-12 lg:col-span-8">
          <div className="grid grid-cols-4 gap-4">
            <MetricCard
              label="Cash on Hand"
              value={formatCurrency(accountTotals.bankTotal)}
              subtitle="Bank accounts"
              icon={Landmark}
              color="blue"
            />
            <MetricCard
              label="Credit Card Debt"
              value={formatCurrency(Math.abs(accountTotals.ccTotal))}
              subtitle={`${accounts.filter(a => a.type === 'credit_card').length} cards`}
              icon={CreditCard}
              color="purple"
            />
            <MetricCard
              label="Net Position"
              value={formatCurrency(accountTotals.netCash)}
              subtitle="Cash - CC debt"
              icon={Wallet}
              trend={{ value: 8.2, label: 'vs last month' }}
              color="emerald"
            />
            <MetricCard
              label="Gross Margin"
              value={`${pnlMetrics.grossMargin.toFixed(1)}%`}
              subtitle={formatCurrency(pnlMetrics.grossProfit)}
              icon={TrendingUp}
              color={pnlMetrics.grossMargin >= 30 ? 'emerald' : pnlMetrics.grossMargin >= 15 ? 'amber' : 'rose'}
            />
          </div>
        </div>

        {/* Accounts */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-100">Accounts</h3>
              <button 
                onClick={() => setShowAddAccount(true)}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {accounts.map(acc => (
                <div 
                  key={acc.id} 
                  onClick={() => setEditingAccount(acc)}
                  className="flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg cursor-pointer hover:bg-slate-700/30 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    {acc.type === 'bank' ? <Landmark size={14} className="text-blue-500" /> : <CreditCard size={14} className="text-purple-500" />}
                    <span className="text-sm text-slate-300">{acc.name}</span>
                    {!acc.is_connected && <span className="text-xs text-amber-500">Manual</span>}
                    <Edit2 size={12} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <span className={`text-sm font-medium ${acc.balance >= 0 ? 'text-slate-200' : 'text-rose-400'}`}>
                    {formatCurrency(acc.balance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ============ P&L WATERFALL ============ */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <SectionHeader 
              title="Profit & Loss" 
              subtitle={selectedMonth === 'all' ? `Full Year ${selectedYear}` : `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`}
            />
            <div className="space-y-1">
              <WaterfallBar label="Revenue" value={pnlMetrics.revenue} maxValue={maxPnlValue} color={COLORS.emerald} />
              <WaterfallBar label="Contractor Labor" value={-pnlMetrics.directCosts} maxValue={maxPnlValue} color={COLORS.rose} />
              <WaterfallBar label="Gross Profit" value={pnlMetrics.grossProfit} maxValue={maxPnlValue} color={COLORS.emeraldLight} isSubtotal showPercent percentValue={pnlMetrics.grossMargin} />
              <WaterfallBar label="Overhead" value={-pnlMetrics.overhead} maxValue={maxPnlValue} color={COLORS.amber} />
              <WaterfallBar label="Net Profit" value={pnlMetrics.netProfit} maxValue={maxPnlValue} color={pnlMetrics.netProfit >= 0 ? COLORS.emerald : COLORS.rose} isSubtotal showPercent percentValue={pnlMetrics.netMargin} />
            </div>
          </div>
        </div>

        {/* Revenue Breakdown */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 h-full">
            <SectionHeader title="Revenue by Project" />
            {revenueByClient.length > 0 ? (
              <>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        data={revenueByClient}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={55}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {revenueByClient.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={[COLORS.emerald, COLORS.blue, COLORS.cyan, COLORS.purple][index % 4]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                    </RePieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 mt-2">
                  {revenueByClient.slice(0, 4).map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: [COLORS.emerald, COLORS.blue, COLORS.cyan, COLORS.purple][i % 4] }} />
                        <span className="text-xs text-slate-400 truncate max-w-[120px]">{item.name}</span>
                      </div>
                      <span className="text-xs font-medium text-slate-200">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-40 text-slate-500 text-sm">No revenue data</div>
            )}
          </div>
        </div>
      </div>

      {/* ============ EXPENSE BREAKDOWN ============ */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <SectionHeader title="Expense Breakdown" subtitle="Direct costs vs. overhead" />
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {expenseBreakdown.slice(0, 6).map((item, i) => (
                <div key={i} className="bg-slate-700/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.category === 'directCosts' ? COLORS.rose : COLORS.amber }} />
                    <span className="text-xs text-slate-500">{item.category === 'directCosts' ? 'Direct' : 'Overhead'}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-200 truncate">{item.name}</p>
                  <p className="text-lg font-bold text-slate-100 mt-1">{formatCurrency(item.value)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ============ TRANSACTIONS ============ */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-5 py-4 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-100">Transactions</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="bg-slate-700/50 border border-slate-600 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 w-48 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Accounts</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.name}>{acc.name}</option>
              ))}
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Categories</option>
              <option value="revenue">Revenue</option>
              <option value="directCosts">Direct Costs</option>
              <option value="overhead">Overhead</option>
            </select>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 border border-slate-600 rounded-lg text-sm text-slate-300 hover:border-slate-500 transition-colors">
              <Download size={14} />
              Export
            </button>
          </div>
        </div>
        
        {/* Transaction Headers */}
        <div className="flex items-center gap-4 py-2 px-4 bg-slate-800/80 border-b border-slate-700/50 text-xs font-medium text-slate-500 uppercase tracking-wider">
          <div className="w-20 shrink-0">Date</div>
          <div className="flex-1">Description</div>
          <div className="w-24 text-right shrink-0">Amount</div>
          <div className="w-24 text-right shrink-0">Account</div>
          <div className="w-8 shrink-0"></div>
        </div>

        {/* Transaction List */}
        <div className="max-h-96 overflow-y-auto">
          {filteredTransactions.length > 0 ? (
            filteredTransactions.map(tx => (
              <TransactionRow
                key={tx.id}
                transaction={tx}
                onEdit={() => {}}
                onDelete={() => {}}
              />
            ))
          ) : (
            <div className="flex items-center justify-center py-12 text-slate-500">
              No transactions found
            </div>
          )}
        </div>
      </div>

      {/* ============ MODALS ============ */}
      <AddTransactionModal
        isOpen={showAddTransaction}
        onClose={() => setShowAddTransaction(false)}
        accounts={accounts}
        onSave={handleAddTransaction}
      />
      <AddAccountModal
        isOpen={showAddAccount || !!editingAccount}
        onClose={() => { setShowAddAccount(false); setEditingAccount(null); }}
        onSave={handleAddAccount}
        editAccount={editingAccount}
        onDelete={handleDeleteAccount}
      />
    </div>
  )
}
