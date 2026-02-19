'use client'

import React, { useState } from 'react'
import {
  DollarSign, TrendingUp, TrendingDown, Users, Building2,
  ChevronDown, ChevronRight, Edit2, X, Trash2, Briefcase,
  CreditCard, FileText, MoreHorizontal, Wrench, Package, 
  UserCheck, Monitor, Receipt, Landmark, Calculator, Gavel,
  Car, Utensils, Plane, Heart, GraduationCap, Wallet,
  CheckCircle2, Clock, AlertCircle, Settings, ArrowDownLeft,
  ArrowUpRight, Repeat, Banknote, PiggyBank, Gift, RefreshCw
} from 'lucide-react'

// ============ INSTITUTIONAL THEME ============
export const THEME = {
  glass: 'bg-[#111827]',
  glassBorder: 'border-slate-800/80',
  glassHover: 'hover:bg-slate-800/40 hover:border-slate-700/60',
  textPrimary: 'text-white',
  textSecondary: 'text-slate-300',
  textMuted: 'text-slate-400',
  textDim: 'text-slate-500',
  // Institutional card + input styles
  card: 'bg-[#111827] border border-slate-800/80 rounded-xl',
  input: 'bg-slate-800/60 border border-slate-800/80 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500/30 focus:border-teal-600/50',
  selectClass: 'appearance-none bg-slate-800/60 border border-slate-800/80 rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500/30 focus:border-teal-600/50 cursor-pointer transition-colors',
}

export const COLORS = {
  teal: '#0d9488',
  emerald: '#10b981',
  rose: '#f43f5e',
  amber: '#f59e0b',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  orange: '#f97316',
  slate: '#64748b',
  green: '#22c55e',
}

// ============ OUTFLOW CATEGORIES (Expenses) ============
export const EXPENSE_CATEGORIES = {
  directCosts: {
    id: 'directCosts',
    label: 'Direct Costs',
    description: 'Project-specific costs — affects Gross Margin',
    direction: 'outflow' as const,
    color: 'rose',
    hex: COLORS.rose,
    bgClass: 'bg-rose-500/10',
    textClass: 'text-rose-400',
    borderClass: 'border-rose-500/30',
    subcategories: [
      { id: 'labor', name: 'Labor', icon: Users },
      { id: 'materials', name: 'Materials', icon: Package },
      { id: 'equipment', name: 'Equipment Rental', icon: Wrench },
      { id: 'subcontractor', name: 'Subcontractor', icon: UserCheck },
      { id: 'projectExpense', name: 'Project Expense', icon: Briefcase },
    ]
  },
  overhead: {
    id: 'overhead',
    label: 'Overhead',
    description: 'Operating expenses — affects Net Profit',
    direction: 'outflow' as const,
    color: 'amber',
    hex: COLORS.amber,
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/30',
    subcategories: [
      { id: 'software', name: 'Software & Subscriptions', icon: Monitor },
      { id: 'rent', name: 'Rent & Utilities', icon: Building2 },
      { id: 'insurance', name: 'Insurance', icon: FileText },
      { id: 'marketing', name: 'Marketing', icon: TrendingUp },
      { id: 'professional', name: 'Professional Services', icon: Briefcase },
      { id: 'travel', name: 'Travel & Entertainment', icon: CreditCard },
      { id: 'office', name: 'Office & Supplies', icon: Package },
      { id: 'payroll', name: 'Payroll & Benefits', icon: Users },
      { id: 'otherOverhead', name: 'Other Operating', icon: MoreHorizontal },
    ]
  },
  otherBusiness: {
    id: 'otherBusiness',
    label: 'Other Business',
    description: 'Non-operational costs — below the line',
    direction: 'outflow' as const,
    color: 'blue',
    hex: COLORS.blue,
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-400',
    borderClass: 'border-blue-500/30',
    subcategories: [
      { id: 'taxes', name: 'Taxes', icon: Landmark },
      { id: 'interest', name: 'Interest & Bank Fees', icon: Calculator },
      { id: 'depreciation', name: 'Depreciation', icon: TrendingDown },
      { id: 'oneTime', name: 'One-time Costs', icon: Receipt },
      { id: 'legal', name: 'Legal & Settlements', icon: Gavel },
      { id: 'otherNonOp', name: 'Other Non-Operating', icon: MoreHorizontal },
    ]
  },
  personal: {
    id: 'personal',
    label: 'Personal',
    description: 'Owner/CEO personal expenses',
    direction: 'outflow' as const,
    color: 'cyan',
    hex: COLORS.cyan,
    bgClass: 'bg-cyan-500/10',
    textClass: 'text-cyan-400',
    borderClass: 'border-cyan-500/30',
    subcategories: [
      { id: 'vehicle', name: 'Vehicle', icon: Car },
      { id: 'meals', name: 'Meals & Entertainment', icon: Utensils },
      { id: 'personalTravel', name: 'Travel', icon: Plane },
      { id: 'health', name: 'Health & Wellness', icon: Heart },
      { id: 'education', name: 'Education', icon: GraduationCap },
      { id: 'otherPersonal', name: 'Other Personal', icon: Wallet },
    ]
  }
}

// ============ INFLOW CATEGORIES (Income) ============
export const INCOME_CATEGORIES = {
  clientPayments: {
    id: 'clientPayments',
    label: 'Client Payments',
    description: 'Revenue received — feeds AR & Cash Flow',
    direction: 'inflow' as const,
    color: 'emerald',
    hex: COLORS.emerald,
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30',
    subcategories: [
      { id: 'invoicePayment', name: 'Invoice Payment', icon: Receipt },
      { id: 'retainer', name: 'Retainer', icon: Briefcase },
      { id: 'deposit', name: 'Deposit', icon: Banknote },
      { id: 'otherRevenue', name: 'Other Revenue', icon: DollarSign },
    ]
  },
  otherIncome: {
    id: 'otherIncome',
    label: 'Other Income',
    description: 'Interest, refunds, misc income',
    direction: 'inflow' as const,
    color: 'green',
    hex: COLORS.green,
    bgClass: 'bg-green-500/10',
    textClass: 'text-green-400',
    borderClass: 'border-green-500/30',
    subcategories: [
      { id: 'interest', name: 'Interest Income', icon: Calculator },
      { id: 'refund', name: 'Refund', icon: RefreshCw },
      { id: 'otherMiscIncome', name: 'Other Income', icon: MoreHorizontal },
    ]
  },
  ownerCapital: {
    id: 'ownerCapital',
    label: 'Owner / Capital',
    description: 'Owner contributions & distributions',
    direction: 'inflow' as const,
    color: 'purple',
    hex: COLORS.purple,
    bgClass: 'bg-purple-500/10',
    textClass: 'text-purple-400',
    borderClass: 'border-purple-500/30',
    subcategories: [
      { id: 'contribution', name: 'Owner Contribution', icon: PiggyBank },
      { id: 'distribution', name: 'Owner Distribution', icon: Wallet },
      { id: 'loan', name: 'Loan Proceeds', icon: Landmark },
    ]
  },
}

// ============ TRANSFER CATEGORY (Both directions) ============
export const TRANSFER_CATEGORY = {
  transfer: {
    id: 'transfer',
    label: 'Transfer',
    description: 'Account transfers — excluded from P&L',
    direction: 'both' as const,
    color: 'slate',
    hex: COLORS.slate,
    bgClass: 'bg-slate-500/10',
    textClass: 'text-slate-400',
    borderClass: 'border-slate-500/30',
    subcategories: [
      { id: 'accountTransfer', name: 'Account Transfer', icon: Repeat },
      { id: 'ccPayment', name: 'Credit Card Payment', icon: CreditCard },
      { id: 'otherTransfer', name: 'Other Transfer', icon: MoreHorizontal },
    ]
  }
}

// ============ COMBINED CATEGORIES ============
export const ALL_CATEGORIES = {
  ...EXPENSE_CATEGORIES,
  ...INCOME_CATEGORIES,
  ...TRANSFER_CATEGORY,
}

export type CategoryKey = keyof typeof ALL_CATEGORIES
export type ExpenseCategoryKey = keyof typeof EXPENSE_CATEGORIES
export type IncomeCategoryKey = keyof typeof INCOME_CATEGORIES

// Get categories by direction
export const getCategoriesForDirection = (direction: 'inflow' | 'outflow' | 'all') => {
  if (direction === 'all') return ALL_CATEGORIES
  if (direction === 'inflow') return { ...INCOME_CATEGORIES, ...TRANSFER_CATEGORY }
  return { ...EXPENSE_CATEGORIES, ...TRANSFER_CATEGORY }
}

// Get category config by ID (searches all)
export const getCategoryConfig = (categoryId: string) => {
  return ALL_CATEGORIES[categoryId as CategoryKey] || EXPENSE_CATEGORIES.overhead
}

// Get subcategory config
export const getSubcategoryConfig = (categoryId: string, subcategoryId: string) => {
  const cat = getCategoryConfig(categoryId)
  return cat.subcategories.find(s => s.id === subcategoryId) || cat.subcategories[0]
}

// Get all subcategories flat
export const getAllSubcategories = () => {
  return Object.values(ALL_CATEGORIES).flatMap(cat => 
    cat.subcategories.map(sub => ({ ...sub, categoryId: cat.id, categoryLabel: cat.label }))
  )
}

// ============ ICON RESOLVER ============
// When categories are saved to JSON, React components serialize as {displayName: "Monitor"}
// This maps them back to actual Lucide components on load

const ICON_MAP: Record<string, any> = {
  DollarSign, TrendingUp, TrendingDown, Users, Building2, Briefcase,
  CreditCard, FileText, MoreHorizontal, Wrench, Package, UserCheck,
  Monitor, Receipt, Landmark, Calculator, Gavel, Car, Utensils, Plane,
  Heart, GraduationCap, Wallet, CheckCircle2, Clock, AlertCircle, Settings,
  ArrowDownLeft, ArrowUpRight, Repeat, Banknote, PiggyBank, Gift, RefreshCw,
  // Common aliases from serialization
  Ellipsis: MoreHorizontal,
}

function resolveIcon(icon: any): any {
  if (typeof icon === 'function') return icon // Already a component
  if (icon?.displayName && ICON_MAP[icon.displayName]) return ICON_MAP[icon.displayName]
  if (typeof icon === 'string' && ICON_MAP[icon]) return ICON_MAP[icon]
  return MoreHorizontal // Fallback
}

// Hydrate categories loaded from DB — resolve serialized icons back to components
export function hydrateCategories(saved: any): typeof EXPENSE_CATEGORIES {
  if (!saved) return EXPENSE_CATEGORIES
  const hydrated: any = {}
  for (const [key, cat] of Object.entries(saved) as any[]) {
    hydrated[key] = {
      ...cat,
      subcategories: cat.subcategories.map((sub: any) => ({
        ...sub,
        icon: resolveIcon(sub.icon),
      }))
    }
  }
  return hydrated
}

// ============ CARDHOLDERS ============
export const CARDHOLDERS = [
  { id: 'gabriel', name: 'Gabriel Vazquez' },
  { id: 'marcus', name: 'Marcus Mattox' },
  { id: 'ceo', name: 'CEO' },
]

// ============ UTILITY FUNCTIONS ============
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

export const formatDateShort = (dateStr: string): string => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const formatDateFull = (dateStr: string): string => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Short account name (strip long QBO account names)
export const shortAccountName = (name: string): string => {
  if (!name) return '—'
  if (name.toLowerCase().includes('credit card') || name.toLowerCase().includes('credit')) return 'Credit Card'
  if (name.toLowerCase().includes('corp account') || name.toLowerCase().includes('business adv')) return 'Corp Card'
  if (name.toLowerCase().includes('consulting') || name.toLowerCase().includes('1404')) return 'Checking'
  return name.length > 25 ? name.substring(0, 22) + '...' : name
}

// ============ SHARED COMPONENTS ============

export function MetricCard({ label, value, subtitle, icon: Icon, color = 'teal', trend }: { 
  label: string; value: string; subtitle?: string; icon: any; color?: string
  trend?: { value: number; label: string }
}) {
  const colorMap: Record<string, string> = {
    teal: 'text-teal-400', emerald: 'text-emerald-400', rose: 'text-rose-400', amber: 'text-amber-400',
    blue: 'text-blue-400', cyan: 'text-cyan-400', slate: 'text-slate-300', green: 'text-green-400',
    purple: 'text-purple-400',
  }
  return (
    <div className={`${THEME.card} p-5 ${THEME.glassHover} transition-all`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-sm font-medium ${THEME.textMuted}`}>{label}</p>
          <p className={`text-2xl font-semibold ${colorMap[color] || 'text-teal-400'} mt-1 tabular-nums`}>{value}</p>
          {subtitle && <p className={`text-xs ${THEME.textDim} mt-1`}>{subtitle}</p>}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.value >= 0 ? <TrendingUp size={14} className="text-emerald-400" /> : <TrendingDown size={14} className="text-rose-400" />}
              <span className={`text-xs font-medium tabular-nums ${trend.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {Math.abs(trend.value).toFixed(1)}%
              </span>
              <span className={`text-xs ${THEME.textDim}`}>{trend.label}</span>
            </div>
          )}
        </div>
        <div className="p-2.5 rounded-lg bg-slate-800/50">
          <Icon size={20} className={THEME.textMuted} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  )
}

export function CategoryBadge({ category, size = 'sm' }: { category: string; size?: 'sm' | 'md' }) {
  const config = getCategoryConfig(category)
  const sizeClasses = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'
  return (
    <span className={`inline-flex items-center ${sizeClasses} rounded-md font-medium ${config.bgClass} ${config.textClass} border ${config.borderClass}`}>
      {config.label}
    </span>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; bg: string; text: string; border: string; icon: any }> = {
    paid: { label: 'Paid', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: CheckCircle2 },
    pending: { label: 'Pending', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', icon: Clock },
    review: { label: 'Review', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', icon: AlertCircle },
  }
  const config = configs[status] || configs.pending
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}>
      <config.icon size={12} />
      {config.label}
    </span>
  )
}

export function DirectionBadge({ amount }: { amount: number }) {
  const isInflow = amount >= 0
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${
      isInflow ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
    }`}>
      {isInflow ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
      {isInflow ? 'In' : 'Out'}
    </span>
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
          <div className={`absolute top-full left-0 mt-1 w-56 ${THEME.card} shadow-xl z-20 overflow-hidden`}>
            <div className="p-2 border-b border-slate-800/80">
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
                className={`w-full ${THEME.input} px-2 py-1.5`} autoFocus />
            </div>
            <div className="max-h-48 overflow-y-auto">
              <button onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }} className={`w-full px-3 py-2 text-left text-sm ${THEME.textDim} hover:bg-slate-800/50 transition-colors`}>— None —</button>
              {filteredOptions.map(opt => (
                <button key={opt.id} onClick={() => { onChange(opt.id); setIsOpen(false); setSearch(''); }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-800/50 transition-colors ${opt.id === value ? 'text-teal-400 bg-teal-500/10' : THEME.textSecondary}`}>{opt.name}</button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function CategorySelect({ value, onChange, direction = 'all' }: { value: string; onChange: (categoryId: string) => void; direction?: 'inflow' | 'outflow' | 'all' }) {
  const [isOpen, setIsOpen] = useState(false)
  const config = getCategoryConfig(value)
  const categories = getCategoriesForDirection(direction)

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-all group ${config.bgClass} ${config.textClass} border ${config.borderClass} hover:opacity-80`}>
        {config.label}
        <Edit2 size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className={`absolute top-full left-0 mt-1 w-56 ${THEME.card} shadow-xl z-20 overflow-hidden`}>
            <div className="p-2 border-b border-slate-800/80">
              <p className={`text-xs font-medium ${THEME.textDim} px-1`}>Select Category</p>
            </div>
            {Object.values(categories).map(cat => (
              <button key={cat.id} onClick={() => { onChange(cat.id); setIsOpen(false); }}
                className={`w-full px-3 py-2.5 text-left text-sm flex items-center gap-2 hover:bg-slate-800/50 transition-colors ${cat.id === value ? `${cat.textClass} ${cat.bgClass}` : THEME.textSecondary}`}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.hex }} />
                <div>
                  <p className="font-medium">{cat.label}</p>
                  <p className={`text-xs ${THEME.textDim}`}>{cat.description}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function SubcategorySelect({ categoryId, value, onChange }: { 
  categoryId: string; value: string; onChange: (subcategoryId: string) => void 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const category = getCategoryConfig(categoryId)
  const subcategory = getSubcategoryConfig(categoryId, value)
  const IconComp = subcategory.icon

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 text-xs ${THEME.textMuted} hover:text-white transition-colors group cursor-pointer`}>
        <IconComp size={12} />
        <span>{subcategory.name}</span>
        <Edit2 size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className={`absolute top-full left-0 mt-1 w-56 ${THEME.card} shadow-xl z-20 overflow-hidden`}>
            <div className="p-2 border-b border-slate-800/80">
              <p className={`text-xs font-medium ${THEME.textDim} px-1`}>{category.label} Types</p>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {category.subcategories.map(sub => {
                const SubIcon = sub.icon
                return (
                  <button key={sub.id} onClick={() => { onChange(sub.id); setIsOpen(false); }}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-slate-800/50 transition-colors ${
                      sub.id === value ? 'text-teal-400 bg-teal-500/10' : THEME.textSecondary
                    }`}>
                    <SubIcon size={14} className={THEME.textDim} />
                    {sub.name}
                  </button>
                )
              })}
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
    <div className={`${THEME.card} overflow-hidden`}>
      <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder} cursor-pointer hover:bg-slate-800/30 transition-colors`}
        onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-3">
          <div className={THEME.textMuted}>{isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>{title}</h3>
              {badge !== undefined && <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-800/60 text-slate-300 border border-slate-800/80">{badge}</span>}
            </div>
            {subtitle && <p className={`text-xs ${THEME.textDim} mt-0.5`}>{subtitle}</p>}
          </div>
        </div>
        {action && (
          <button 
            onClick={(e) => { e.stopPropagation(); action.onClick(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-400 bg-teal-500/10 border border-teal-500/30 rounded-lg hover:bg-teal-500/20 transition-colors"
          >
            + {action.label}
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
    <div className={`${THEME.card} px-3 py-2 shadow-xl`}>
      <p className={`text-xs ${THEME.textDim} mb-1`}>{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm font-medium tabular-nums" style={{ color: entry.color }}>
          {entry.name}: {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  )
}

export function ExpenseBar({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const percent = total > 0 ? (amount / total) * 100 : 0
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="w-36 shrink-0"><p className={`text-sm ${THEME.textSecondary} truncate`}>{label}</p></div>
      <div className="flex-1 h-2 bg-slate-800/60 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
      <div className="w-24 text-right shrink-0"><p className={`text-sm font-semibold tabular-nums ${THEME.textPrimary}`}>{formatCurrency(amount)}</p></div>
      <div className="w-12 text-right shrink-0"><p className={`text-xs tabular-nums ${THEME.textMuted}`}>{percent.toFixed(0)}%</p></div>
    </div>
  )
}

// ============ CATEGORY MANAGER ============
export function CategoryManager({ 
  isOpen, 
  onClose, 
  categories, 
  onUpdateCategories 
}: {
  isOpen: boolean
  onClose: () => void
  categories: typeof EXPENSE_CATEGORIES
  onUpdateCategories: (categories: typeof EXPENSE_CATEGORIES) => void
}) {
  const [editingCategories, setEditingCategories] = useState(categories)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [newSubcategoryName, setNewSubcategoryName] = useState('')
  const [editingSubcategory, setEditingSubcategory] = useState<{ catId: string; subId: string; name: string } | null>(null)

  if (!isOpen) return null

  const handleCategoryLabelChange = (catId: string, newLabel: string) => {
    setEditingCategories(prev => ({
      ...prev,
      [catId]: { ...prev[catId as keyof typeof prev], label: newLabel }
    }))
  }

  const handleCategoryDescChange = (catId: string, newDesc: string) => {
    setEditingCategories(prev => ({
      ...prev,
      [catId]: { ...prev[catId as keyof typeof prev], description: newDesc }
    }))
  }

  const handleAddSubcategory = (catId: string) => {
    if (!newSubcategoryName.trim()) return
    const newId = newSubcategoryName.toLowerCase().replace(/\s+/g, '_')
    setEditingCategories(prev => ({
      ...prev,
      [catId]: {
        ...prev[catId as keyof typeof prev],
        subcategories: [
          ...prev[catId as keyof typeof prev].subcategories,
          { id: newId, name: newSubcategoryName.trim(), icon: MoreHorizontal }
        ]
      }
    }))
    setNewSubcategoryName('')
  }

  const handleDeleteSubcategory = (catId: string, subId: string) => {
    setEditingCategories(prev => ({
      ...prev,
      [catId]: {
        ...prev[catId as keyof typeof prev],
        subcategories: prev[catId as keyof typeof prev].subcategories.filter(s => s.id !== subId)
      }
    }))
  }

  const handleRenameSubcategory = (catId: string, subId: string, newName: string) => {
    setEditingCategories(prev => ({
      ...prev,
      [catId]: {
        ...prev[catId as keyof typeof prev],
        subcategories: prev[catId as keyof typeof prev].subcategories.map(s => 
          s.id === subId ? { ...s, name: newName } : s
        )
      }
    }))
    setEditingSubcategory(null)
  }

  const handleSave = () => {
    onUpdateCategories(editingCategories)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className={`${THEME.card} w-full max-w-2xl mx-4 overflow-hidden shadow-2xl max-h-[85vh] flex flex-col`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder} shrink-0`}>
          <div>
            <h3 className={`text-lg font-semibold ${THEME.textPrimary}`}>Manage Categories</h3>
            <p className={`text-xs ${THEME.textDim} mt-0.5`}>Edit category names and subcategories</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-800/50 rounded-lg transition-colors">
            <X size={20} className={THEME.textMuted} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {Object.values(editingCategories).map(cat => (
            <div key={cat.id} className={`border ${THEME.glassBorder} rounded-xl overflow-hidden`}>
              {/* Category Header */}
              <div 
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-800/30 transition-colors"
                onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.hex }} />
                  <div>
                    <input
                      type="text"
                      value={cat.label}
                      onChange={(e) => handleCategoryLabelChange(cat.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className={`bg-transparent text-sm font-semibold ${THEME.textPrimary} focus:outline-none focus:ring-1 focus:ring-teal-500/50 rounded px-1 -ml-1`}
                    />
                    <input
                      type="text"
                      value={cat.description}
                      onChange={(e) => handleCategoryDescChange(cat.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className={`bg-transparent text-xs ${THEME.textDim} focus:outline-none focus:ring-1 focus:ring-teal-500/50 rounded px-1 -ml-1 w-full`}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${THEME.textDim}`}>{cat.subcategories.length} types</span>
                  {expandedCategory === cat.id ? <ChevronDown size={16} className={THEME.textMuted} /> : <ChevronRight size={16} className={THEME.textMuted} />}
                </div>
              </div>

              {/* Subcategories */}
              {expandedCategory === cat.id && (
                <div className={`px-4 pb-4 pt-2 border-t ${THEME.glassBorder} bg-slate-800/20`}>
                  <div className="space-y-2">
                    {cat.subcategories.map(sub => {
                      const SubIcon = sub.icon
                      const isEditing = editingSubcategory?.catId === cat.id && editingSubcategory?.subId === sub.id
                      
                      return (
                        <div key={sub.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-slate-800/40 group">
                          <div className="flex items-center gap-2">
                            <SubIcon size={14} className={THEME.textDim} />
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingSubcategory.name}
                                onChange={(e) => setEditingSubcategory({ ...editingSubcategory, name: e.target.value })}
                                onBlur={() => handleRenameSubcategory(cat.id, sub.id, editingSubcategory.name)}
                                onKeyDown={(e) => e.key === 'Enter' && handleRenameSubcategory(cat.id, sub.id, editingSubcategory.name)}
                                className={`${THEME.input} px-2 py-0.5 text-sm`}
                                autoFocus
                              />
                            ) : (
                              <span className={`text-sm ${THEME.textSecondary}`}>{sub.name}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setEditingSubcategory({ catId: cat.id, subId: sub.id, name: sub.name })}
                              className="p-1 hover:bg-slate-800/50 rounded transition-colors"
                            >
                              <Edit2 size={12} className={THEME.textDim} />
                            </button>
                            <button
                              onClick={() => handleDeleteSubcategory(cat.id, sub.id)}
                              className="p-1 hover:bg-slate-800/50 rounded transition-colors"
                            >
                              <Trash2 size={12} className="text-rose-400" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Add New Subcategory */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800/60">
                    <input
                      type="text"
                      value={newSubcategoryName}
                      onChange={(e) => setNewSubcategoryName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSubcategory(cat.id)}
                      placeholder="New subcategory name..."
                      className={`flex-1 ${THEME.input} px-3 py-1.5`}
                    />
                    <button
                      onClick={() => handleAddSubcategory(cat.id)}
                      disabled={!newSubcategoryName.trim()}
                      className="px-3 py-1.5 bg-teal-500/10 text-teal-400 border border-teal-500/30 rounded-lg text-xs font-medium hover:bg-teal-500/20 transition-colors disabled:opacity-50"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${THEME.glassBorder} bg-slate-800/20 shrink-0`}>
          <button onClick={onClose} className={`px-4 py-2 text-sm font-medium ${THEME.textMuted} hover:text-white transition-colors`}>
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-5 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}
