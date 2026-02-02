'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  Receipt, DollarSign, TrendingUp, TrendingDown, Users, Building2,
  Plus, ChevronDown, ChevronUp, Filter, Download, Search, RefreshCw,
  MoreHorizontal, Edit2, Check, X, Trash2, Calendar, Briefcase,
  CreditCard, FileText, PieChart, BarChart3, AlertCircle, CheckCircle2,
  Settings, PlusCircle, ChevronRight, Wrench, Package, UserCheck, Monitor
} from 'lucide-react'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell
} from 'recharts'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// ============ GLASSMORPHISM THEME ============
const THEME = {
  glass: 'bg-slate-900/70 backdrop-blur-xl',
  glassBorder: 'border-white/[0.08]',
  glassHover: 'hover:bg-white/[0.05] hover:border-white/[0.12]',
  textPrimary: 'text-white',
  textSecondary: 'text-slate-300',
  textMuted: 'text-slate-400',
  textDim: 'text-slate-500',
}

const COLORS = {
  emerald: '#10b981',
  rose: '#f43f5e',
  amber: '#f59e0b',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  orange: '#f97316',
}

// ============ EXPENSE CATEGORY SYSTEM ============
// Main categories with their subcategories
const EXPENSE_CATEGORIES = {
  directCosts: {
    label: 'Direct Costs',
    description: 'Project-specific costs that affect Gross Margin',
    color: 'rose',
    subcategories: [
      { id: 'labor', name: 'Labor', icon: Users, requiresTeamMember: true },
      { id: 'materials', name: 'Materials', icon: Package, requiresTeamMember: false },
      { id: 'equipment', name: 'Equipment Rental', icon: Wrench, requiresTeamMember: false },
      { id: 'subcontractor', name: 'Subcontractor', icon: UserCheck, requiresTeamMember: true },
      { id: 'projectExpense', name: 'Project Expense', icon: Briefcase, requiresTeamMember: false },
    ]
  },
  overhead: {
    label: 'Overhead',
    description: 'Operating expenses that affect Net Profit',
    color: 'amber',
    subcategories: [
      { id: 'software', name: 'Software & Subscriptions', icon: Monitor, requiresTeamMember: false },
      { id: 'rent', name: 'Rent & Utilities', icon: Building2, requiresTeamMember: false },
      { id: 'insurance', name: 'Insurance', icon: FileText, requiresTeamMember: false },
      { id: 'marketing', name: 'Marketing', icon: TrendingUp, requiresTeamMember: false },
      { id: 'professional', name: 'Professional Services', icon: Briefcase, requiresTeamMember: false },
      { id: 'travel', name: 'Travel & Entertainment', icon: CreditCard, requiresTeamMember: false },
      { id: 'office', name: 'Office & Supplies', icon: Package, requiresTeamMember: false },
      { id: 'payroll', name: 'Payroll & Benefits', icon: Users, requiresTeamMember: true },
      { id: 'other', name: 'Other', icon: MoreHorizontal, requiresTeamMember: false },
    ]
  }
}

// ============ UTILITY FUNCTIONS ============
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

const formatDateShort = (dateStr: string): string => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ============ COMPONENTS ============

// Glass Metric Card
function MetricCard({ label, value, subtitle, icon: Icon, color = 'emerald' }: { 
  label: string; value: string; subtitle?: string; icon: any; color?: string
}) {
  const colorMap: { [key: string]: string } = {
    emerald: 'text-emerald-400',
    rose: 'text-rose-400',
    amber: 'text-amber-400',
    blue: 'text-blue-400',
    slate: 'text-slate-300',
  }

  return (
    <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-5 ${THEME.glassHover} transition-all`}>
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-sm font-medium ${THEME.textMuted}`}>{label}</p>
          <p className={`text-2xl font-semibold ${colorMap[color]} mt-1`}>{value}</p>
          {subtitle && <p className={`text-xs ${THEME.textDim} mt-1`}>{subtitle}</p>}
        </div>
        <div className="p-2.5 rounded-lg bg-white/[0.05]">
          <Icon size={20} className={THEME.textMuted} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  )
}

// Category Badge (display only)
function CategoryBadge({ category }: { category: string }) {
  const isDirectCost = category === 'directCosts'
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
      isDirectCost ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
    }`}>
      {isDirectCost ? 'Direct Cost' : 'Overhead'}
    </span>
  )
}

// Editable Category Badge - click to toggle between Direct Cost and Overhead
function EditableCategoryBadge({ category, subcategory, onUpdate }: { 
  category: string; subcategory: string; onUpdate: (updates: { category: string; subcategory: string }) => void 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const isDirectCost = category === 'directCosts'
  
  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium cursor-pointer transition-all group ${
          isDirectCost ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'
        }`}>
        {isDirectCost ? 'Direct Cost' : 'Overhead'}
        <Edit2 size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className={`absolute top-full left-0 mt-1 w-56 ${THEME.glass} border ${THEME.glassBorder} rounded-lg shadow-xl z-20 overflow-hidden`}>
            <div className="p-2 border-b border-white/[0.08]">
              <p className={`text-xs font-medium ${THEME.textDim} px-1`}>Main Category</p>
            </div>
            <button onClick={() => { 
              if (category !== 'directCosts') onUpdate({ category: 'directCosts', subcategory: 'labor' }); 
              setIsOpen(false); 
            }} className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/[0.05] transition-colors ${category === 'directCosts' ? 'text-rose-400 bg-rose-500/10' : THEME.textSecondary}`}>
              <span className="w-2 h-2 rounded-full bg-rose-400" /> Direct Cost
            </button>
            <button onClick={() => { 
              if (category !== 'overhead') onUpdate({ category: 'overhead', subcategory: 'software' }); 
              setIsOpen(false); 
            }} className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/[0.05] transition-colors ${category === 'overhead' ? 'text-amber-400 bg-amber-500/10' : THEME.textSecondary}`}>
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Overhead
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// Editable Subcategory (Type) - click to pick from available subcategories
function EditableSubcategory({ category, subcategory, onUpdate }: { 
  category: string; subcategory: string; onUpdate: (subcategory: string) => void 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const catConfig = category === 'directCosts' ? EXPENSE_CATEGORIES.directCosts : EXPENSE_CATEGORIES.overhead
  const subcatConfig = catConfig.subcategories.find(s => s.id === subcategory)
  
  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 text-xs ${THEME.textMuted} hover:text-white transition-colors group cursor-pointer`}>
        <span>{subcatConfig?.name || subcategory || 'Assign'}</span>
        <Edit2 size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className={`absolute top-full left-0 mt-1 w-56 ${THEME.glass} border ${THEME.glassBorder} rounded-lg shadow-xl z-20 overflow-hidden`}>
            <div className="p-2 border-b border-white/[0.08]">
              <p className={`text-xs font-medium ${THEME.textDim} px-1`}>{catConfig.label} Types</p>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {catConfig.subcategories.map(sub => {
                const IconComp = sub.icon
                return (
                  <button key={sub.id} onClick={() => { onUpdate(sub.id); setIsOpen(false); }}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-white/[0.05] transition-colors ${
                      sub.id === subcategory ? 'text-emerald-400 bg-emerald-500/10' : THEME.textSecondary
                    }`}>
                    <IconComp size={14} className={THEME.textDim} />
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

// Status Badge
function StatusBadge({ status }: { status: string }) {
  const isPaid = status === 'paid'
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
      isPaid ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
    }`}>
      {isPaid ? 'Paid' : 'Pending'}
    </span>
  )
}

// Glass Tooltip
const CustomTooltip = ({ active, payload, label, formatter }: any) => {
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

// Expense Bar
function ExpenseBar({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const percent = total > 0 ? (amount / total) * 100 : 0
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="w-36 shrink-0"><p className={`text-sm ${THEME.textSecondary} truncate`}>{label}</p></div>
      <div className="flex-1 h-2 bg-white/[0.08] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
      <div className="w-24 text-right shrink-0"><p className={`text-sm font-semibold ${THEME.textPrimary}`}>{formatCurrency(amount)}</p></div>
      <div className="w-12 text-right shrink-0"><p className={`text-xs ${THEME.textMuted}`}>{percent.toFixed(0)}%</p></div>
    </div>
  )
}

// Glass Select
function GlassSelect({ value, onChange, options, placeholder, className = '' }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder?: string; className?: string
}) {
  return (
    <select 
      value={value} 
      onChange={(e) => onChange(e.target.value)}
      className={`bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${className}`}
    >
      {placeholder && <option value="" className="bg-slate-900">{placeholder}</option>}
      {options.map(opt => (
        <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>
      ))}
    </select>
  )
}

// Inline Editable Select
function EditableSelect({ value, options, onChange, placeholder = 'Assign' }: { 
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

// Expense Row
function ExpenseRow({ expense, teamMembers, projects, clients, onUpdate, onDelete, isSelected, onSelect }: { 
  expense: any; teamMembers: any[]; projects: any[]; clients: any[]
  onUpdate: (id: string, updates: any) => void; onDelete: (id: string) => void
  isSelected: boolean; onSelect: (id: string) => void
}) {
  const subcatConfig = [...EXPENSE_CATEGORIES.directCosts.subcategories, ...EXPENSE_CATEGORIES.overhead.subcategories]
    .find(s => s.id === expense.subcategory)
  const showTeamMember = subcatConfig?.requiresTeamMember
  const project = projects.find(p => p.id === expense.project_id)
  const client = project ? clients.find(c => c.id === project.client_id) : null
  
  return (
    <div className={`flex items-center gap-3 py-3 px-4 hover:bg-white/[0.03] transition-colors border-b border-white/[0.05] ${isSelected ? 'bg-emerald-500/10' : ''}`}>
      <div className="w-8 shrink-0">
        <input type="checkbox" checked={isSelected} onChange={() => onSelect(expense.id)} className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/30" />
      </div>
      <div className="w-20 shrink-0"><p className={`text-sm ${THEME.textMuted}`}>{formatDateShort(expense.date)}</p></div>
      <div className="flex-1 min-w-0"><p className={`text-sm ${THEME.textPrimary} truncate`}>{expense.description}</p></div>
      <div className="w-28 shrink-0">
        <EditableCategoryBadge category={expense.category} subcategory={expense.subcategory} 
          onUpdate={(updates) => onUpdate(expense.id, updates)} />
      </div>
      <div className="w-36 shrink-0">
        <EditableSubcategory category={expense.category} subcategory={expense.subcategory} 
          onUpdate={(subcategory) => onUpdate(expense.id, { subcategory })} />
      </div>
      <div className="w-28 shrink-0">
        {showTeamMember ? (
          <EditableSelect value={expense.team_member_id || ''} options={teamMembers} onChange={(value) => onUpdate(expense.id, { team_member_id: value || null })} placeholder="Assign" />
        ) : <span className={`text-xs ${THEME.textDim}`}>—</span>}
      </div>
      <div className="w-32 shrink-0">
        <EditableSelect value={expense.project_id || ''} options={projects} onChange={(value) => onUpdate(expense.id, { project_id: value || null })} placeholder="Assign" />
      </div>
      <div className="w-24 shrink-0">
        {client ? <p className={`text-xs ${THEME.textMuted} truncate`}>{client.name}</p> : <span className={`text-xs ${THEME.textDim}`}>—</span>}
      </div>
      <div className="w-24 text-right shrink-0"><p className="text-sm font-semibold text-rose-400">{formatCurrency(expense.amount)}</p></div>
      <div className="w-20 shrink-0">
        <button onClick={() => onUpdate(expense.id, { status: expense.status === 'paid' ? 'pending' : 'paid' })}
          className="cursor-pointer">
          <StatusBadge status={expense.status} />
        </button>
      </div>
      <div className="w-12 shrink-0 flex items-center justify-end">
        <button onClick={() => onDelete(expense.id)} className="p-1 hover:bg-white/[0.05] rounded transition-colors" title="Delete">
          <Trash2 size={14} className={`${THEME.textDim} hover:text-rose-400`} />
        </button>
      </div>
    </div>
  )
}

// Collapsible Section
function CollapsibleSection({ title, subtitle, badge, children, defaultExpanded = true, noPadding = false }: { 
  title: string; subtitle?: string; badge?: string | number; children: React.ReactNode; defaultExpanded?: boolean; noPadding?: boolean 
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
      </div>
      {isExpanded && <div className={noPadding ? '' : 'p-6'}>{children}</div>}
    </div>
  )
}

// Add Expense Modal
function AddExpenseModal({ isOpen, onClose, teamMembers, projects, onSave }: { 
  isOpen: boolean; onClose: () => void; teamMembers: any[]; projects: any[]; onSave: (expense: any) => void
}) {
  const [category, setCategory] = useState<'directCosts' | 'overhead'>('directCosts')
  const [subcategory, setSubcategory] = useState('labor')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [teamMemberId, setTeamMemberId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [status, setStatus] = useState<'paid' | 'pending'>('paid')

  useEffect(() => {
    // Reset subcategory when category changes
    const defaultSub = category === 'directCosts' ? 'labor' : 'software'
    setSubcategory(defaultSub)
    setTeamMemberId('')
  }, [category])

  if (!isOpen) return null

  const currentCategory = EXPENSE_CATEGORIES[category]
  const currentSubcat = currentCategory.subcategories.find(s => s.id === subcategory)
  const showTeamMember = currentSubcat?.requiresTeamMember

  const handleSave = () => {
    onSave({
      category,
      subcategory,
      amount: parseFloat(amount) || 0,
      date,
      description,
      team_member_id: showTeamMember ? teamMemberId || null : null,
      project_id: projectId || null,
      status
    })
    // Reset form
    setAmount(''); setDescription(''); setTeamMemberId(''); setProjectId('')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-2xl w-full max-w-lg mx-4 overflow-hidden`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
          <h3 className={`text-lg font-semibold ${THEME.textPrimary}`}>Add Expense</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/[0.05] rounded-lg transition-colors"><X size={20} className={THEME.textMuted} /></button>
        </div>
        
        <div className="p-6 space-y-5">
          {/* Category Selection */}
          <div>
            <label className={`block text-sm font-medium ${THEME.textMuted} mb-2`}>Category</label>
            <div className="flex gap-2">
              <button onClick={() => setCategory('directCosts')} 
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                  category === 'directCosts' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-white/[0.05] text-slate-400 border border-transparent'
                }`}>Direct Costs</button>
              <button onClick={() => setCategory('overhead')} 
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                  category === 'overhead' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/[0.05] text-slate-400 border border-transparent'
                }`}>Overhead</button>
            </div>
            <p className={`text-xs ${THEME.textDim} mt-1.5`}>{currentCategory.description}</p>
          </div>

          {/* Subcategory Selection */}
          <div>
            <label className={`block text-sm font-medium ${THEME.textMuted} mb-2`}>Type</label>
            <div className="grid grid-cols-3 gap-2">
              {currentCategory.subcategories.map(sub => {
                const IconComp = sub.icon
                return (
                  <button key={sub.id} onClick={() => { setSubcategory(sub.id); setTeamMemberId(''); }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      subcategory === sub.id 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-white/[0.05] text-slate-400 border border-transparent hover:bg-white/[0.08]'
                    }`}>
                    <IconComp size={14} />
                    <span className="truncate">{sub.name}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Amount</label>
              <div className="relative">
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${THEME.textDim}`}>$</span>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg pl-7 pr-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
              </div>
            </div>
            <div>
              <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} 
              placeholder="e.g., January software subscription"
              className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
          </div>

          {/* Team Member (conditional) + Project (always) */}
          <div className="grid grid-cols-2 gap-4">
            {showTeamMember && (
              <div>
                <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>
                  {subcategory === 'labor' || subcategory === 'payroll' ? 'Employee/Contractor' : 'Subcontractor'}
                </label>
                <select value={teamMemberId} onChange={(e) => setTeamMemberId(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
                  <option value="" className="bg-slate-900">Select...</option>
                  {teamMembers.map(tm => <option key={tm.id} value={tm.id} className="bg-slate-900">{tm.name}</option>)}
                </select>
              </div>
            )}
            <div className={showTeamMember ? '' : 'col-span-2'}>
              <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Project (optional)</label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
                <option value="" className="bg-slate-900">No project</option>
                {projects.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>)}
              </select>
              <p className={`text-xs ${THEME.textDim} mt-1`}>Links expense to project → client</p>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className={`block text-sm font-medium ${THEME.textMuted} mb-2`}>Status</label>
            <div className="flex gap-2">
              <button onClick={() => setStatus('paid')} 
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  status === 'paid' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/[0.05] text-slate-400 border border-transparent'
                }`}><CheckCircle2 size={14} className="inline mr-1.5" />Paid</button>
              <button onClick={() => setStatus('pending')} 
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  status === 'pending' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-white/[0.05] text-slate-400 border border-transparent'
                }`}><AlertCircle size={14} className="inline mr-1.5" />Pending</button>
            </div>
          </div>
        </div>

        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${THEME.glassBorder} bg-white/[0.02]`}>
          <button onClick={onClose} className={`px-4 py-2 text-sm font-medium ${THEME.textMuted} hover:text-white transition-colors`}>Cancel</button>
          <button onClick={handleSave} disabled={!amount || !description}
            className="px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            Add Expense
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ MAIN PAGE ============
export default function ExpensesPage() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [sortField, setSortField] = useState<string>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])

  const months = [
    { value: 'all', label: 'All Months' },
    { value: 0, label: 'January' }, { value: 1, label: 'February' }, { value: 2, label: 'March' },
    { value: 3, label: 'April' }, { value: 4, label: 'May' }, { value: 5, label: 'June' },
    { value: 6, label: 'July' }, { value: 7, label: 'August' }, { value: 8, label: 'September' },
    { value: 9, label: 'October' }, { value: 10, label: 'November' }, { value: 11, label: 'December' }
  ]

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await getCurrentUser()
        const user = result?.user
        if (!user) { setLoading(false); return }

        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
        if (!profile?.company_id) { setLoading(false); return }

        setCompanyId(profile.company_id)

        const [expRes, teamRes, projRes, clientRes] = await Promise.all([
          supabase.from('expenses').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
          supabase.from('team_members').select('id, name').eq('company_id', profile.company_id).order('name'),
          supabase.from('projects').select('id, name, client_id').eq('company_id', profile.company_id).order('name'),
          supabase.from('clients').select('id, name').eq('company_id', profile.company_id).order('name')
        ])

        setExpenses(expRes.data || [])
        setTeamMembers(teamRes.data || [])
        setProjects(projRes.data || [])
        setClients(clientRes.data || [])
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Metrics
  const expenseMetrics = useMemo(() => {
    const filtered = expenses.filter(exp => {
      const expDate = new Date(exp.date)
      if (expDate.getFullYear() !== selectedYear) return false
      if (selectedMonth !== 'all' && expDate.getMonth() !== selectedMonth) return false
      return true
    })

    const totalExpenses = filtered.reduce((sum, exp) => sum + exp.amount, 0)
    const directCosts = filtered.filter(exp => exp.category === 'directCosts').reduce((sum, exp) => sum + exp.amount, 0)
    const overhead = filtered.filter(exp => exp.category === 'overhead').reduce((sum, exp) => sum + exp.amount, 0)
    const pendingAmount = filtered.filter(exp => exp.status === 'pending').reduce((sum, exp) => sum + exp.amount, 0)
    const pendingCount = filtered.filter(exp => exp.status === 'pending').length

    // By subcategory
    const bySubcategory: { [key: string]: { category: string; amount: number } } = {}
    filtered.forEach(exp => {
      const subcat = [...EXPENSE_CATEGORIES.directCosts.subcategories, ...EXPENSE_CATEGORIES.overhead.subcategories]
        .find(s => s.id === exp.subcategory)
      const name = subcat?.name || exp.subcategory
      if (!bySubcategory[name]) bySubcategory[name] = { category: exp.category, amount: 0 }
      bySubcategory[name].amount += exp.amount
    })

    // By project
    const byProject: { [key: string]: number } = {}
    filtered.filter(exp => exp.project_id).forEach(exp => {
      const project = projects.find(p => p.id === exp.project_id)
      const name = project?.name || 'Unknown'
      byProject[name] = (byProject[name] || 0) + exp.amount
    })

    return {
      totalExpenses, directCosts, overhead, pendingAmount, pendingCount,
      bySubcategory: Object.entries(bySubcategory).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.amount - a.amount),
      byProject: Object.entries(byProject).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount)
    }
  }, [expenses, selectedYear, selectedMonth, projects])

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    let filtered = [...expenses]
    filtered = filtered.filter(exp => new Date(exp.date).getFullYear() === selectedYear)
    if (selectedMonth !== 'all') filtered = filtered.filter(exp => new Date(exp.date).getMonth() === selectedMonth)
    if (filterCategory !== 'all') filtered = filtered.filter(exp => exp.category === filterCategory)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(exp => 
        exp.description?.toLowerCase().includes(q) || 
        exp.subcategory?.toLowerCase().includes(q) ||
        teamMembers.find(tm => tm.id === exp.team_member_id)?.name?.toLowerCase().includes(q)
      )
    }
    filtered.sort((a, b) => {
      let aVal: any = a[sortField as keyof typeof a]
      let bVal: any = b[sortField as keyof typeof b]
      if (sortField === 'date') { aVal = new Date(aVal as string).getTime(); bVal = new Date(bVal as string).getTime() }
      return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1)
    })
    return filtered
  }, [expenses, selectedYear, selectedMonth, filterCategory, searchQuery, sortField, sortDir, teamMembers])

  // Monthly trend
  const monthlyTrend = useMemo(() => {
    const data: { month: string; directCosts: number; overhead: number }[] = []
    for (let m = 0; m < 12; m++) {
      const monthExpenses = expenses.filter(exp => { const d = new Date(exp.date); return d.getFullYear() === selectedYear && d.getMonth() === m })
      data.push({
        month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m],
        directCosts: monthExpenses.filter(e => e.category === 'directCosts').reduce((s, e) => s + e.amount, 0),
        overhead: monthExpenses.filter(e => e.category === 'overhead').reduce((s, e) => s + e.amount, 0)
      })
    }
    return data
  }, [expenses, selectedYear])

  // Handlers
  const handleAddExpense = async (expense: any) => {
    if (!companyId) return
    const newExpense = { company_id: companyId, ...expense }
    const { data, error } = await supabase.from('expenses').insert(newExpense).select().single()
    if (error) { console.error('Error adding expense:', error); alert('Failed to add expense'); return }
    setExpenses(prev => [data, ...prev])
  }

  const handleUpdateExpense = async (id: string, updates: any) => {
    const { error } = await supabase.from('expenses').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { console.error('Error updating expense:', error); alert('Failed to update expense'); return }
    setExpenses(prev => prev.map(exp => exp.id === id ? { ...exp, ...updates } : exp))
  }

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Delete this expense?')) return
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) { console.error('Error deleting expense:', error); alert('Failed to delete expense'); return }
    setExpenses(prev => prev.filter(exp => exp.id !== id))
    setSelectedExpenses(prev => prev.filter(i => i !== id))
  }

  const handleSelectExpense = (id: string) => setSelectedExpenses(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  const handleSelectAll = () => setSelectedExpenses(prev => prev.length === filteredExpenses.length ? [] : filteredExpenses.map(exp => exp.id))
  const handleSort = (field: string) => { if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); else { setSortField(field); setSortDir('desc') } }

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center"><RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" /><p className={`text-sm ${THEME.textMuted}`}>Loading expenses...</p></div>
    </div>
  )

  const pieColors = ['#10B981', '#f43f5e', '#f59e0b', '#3b82f6', '#8b5cf6', '#06b6d4']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-xl font-semibold ${THEME.textPrimary}`}>Expenses</h1>
          <p className={`text-sm ${THEME.textMuted} mt-1`}>Direct costs & overhead tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="appearance-none bg-white/[0.05] border border-white/[0.1] rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer">
              {[2026, 2025, 2024, 2023].map(year => <option key={year} value={year} className="bg-slate-900">{year}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="appearance-none bg-white/[0.05] border border-white/[0.1] rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer">
              {months.map(m => <option key={m.value} value={m.value} className="bg-slate-900">{m.label}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-white/[0.1] rounded-lg text-sm font-medium text-slate-300 hover:bg-white/[0.05] transition-colors">
            <Download size={14} />Export
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors">
            <Plus size={14} />Add Expense
          </button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Total Expenses" value={formatCurrency(expenseMetrics.totalExpenses)} subtitle={`${selectedMonth === 'all' ? 'YTD' : months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`} icon={Receipt} color="slate" />
        <MetricCard label="Direct Costs" value={formatCurrency(expenseMetrics.directCosts)} subtitle="Affects Gross Margin" icon={Users} color="rose" />
        <MetricCard label="Overhead" value={formatCurrency(expenseMetrics.overhead)} subtitle="Operating expenses" icon={Building2} color="amber" />
        <MetricCard label="Pending" value={formatCurrency(expenseMetrics.pendingAmount)} subtitle={`${expenseMetrics.pendingCount} unpaid bills`} icon={AlertCircle} color={expenseMetrics.pendingCount > 0 ? 'amber' : 'emerald'} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-12 gap-6">
        {/* Monthly Trend */}
        <div className="col-span-12 lg:col-span-8">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-6`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className={`text-sm font-semibold ${THEME.textPrimary}`}>Monthly Expenses</h2>
                <p className={`text-xs ${THEME.textDim} mt-0.5`}>{selectedYear} breakdown</p>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend} barGap={0}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                  <Bar dataKey="directCosts" name="Direct Costs" fill={COLORS.rose} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="overhead" name="Overhead" fill={COLORS.amber} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* By Category */}
        <div className="col-span-12 lg:col-span-4">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-6 h-full`}>
            <h2 className={`text-sm font-semibold ${THEME.textPrimary} mb-4`}>By Category</h2>
            <div className="space-y-1">
              {expenseMetrics.bySubcategory.slice(0, 6).map((item, i) => (
                <ExpenseBar key={i} label={item.name} amount={item.amount} total={expenseMetrics.totalExpenses} 
                  color={item.category === 'directCosts' ? COLORS.rose : COLORS.amber} />
              ))}
              {expenseMetrics.bySubcategory.length === 0 && (
                <p className={`text-sm ${THEME.textMuted} text-center py-8`}>No expenses yet</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* By Project (if any) */}
      {expenseMetrics.byProject.length > 0 && (
        <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-6`}>
          <h2 className={`text-sm font-semibold ${THEME.textPrimary} mb-4`}>Expenses by Project</h2>
          <div className="grid grid-cols-4 gap-4">
            {expenseMetrics.byProject.slice(0, 8).map((proj, i) => (
              <div key={i} className="bg-white/[0.03] rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <Briefcase size={18} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${THEME.textSecondary} truncate`}>{proj.name}</p>
                    <p className="text-lg font-bold text-emerald-400">{formatCurrency(proj.amount)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expense Table */}
      <CollapsibleSection 
        title="All Expenses" 
        subtitle={`${filteredExpenses.filter(e => e.category === 'directCosts').length} direct • ${filteredExpenses.filter(e => e.category === 'overhead').length} overhead`}
        badge={filteredExpenses.length}
        defaultExpanded={true}
        noPadding
      >
        {/* Filters */}
        <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 border-b ${THEME.glassBorder}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search expenses..."
                className="bg-white/[0.05] border border-white/[0.1] rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 w-48 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
            </div>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
              <option value="all" className="bg-slate-900">All Categories</option>
              <option value="directCosts" className="bg-slate-900">Direct Costs</option>
              <option value="overhead" className="bg-slate-900">Overhead</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedExpenses.length > 0 && (
          <div className="flex items-center gap-4 px-6 py-3 bg-emerald-500/10 border-b border-emerald-500/20">
            <span className="text-sm font-medium text-emerald-400">{selectedExpenses.length} selected</span>
            <button onClick={async () => {
              for (const id of selectedExpenses) { await handleUpdateExpense(id, { status: 'paid' }) }
              setSelectedExpenses([])
            }} className={`text-sm ${THEME.textSecondary} hover:text-white transition-colors`}>Mark as Paid</button>
            <button onClick={async () => {
              if (!confirm(`Delete ${selectedExpenses.length} expenses?`)) return
              for (const id of selectedExpenses) {
                await supabase.from('expenses').delete().eq('id', id)
              }
              setExpenses(prev => prev.filter(exp => !selectedExpenses.includes(exp.id)))
              setSelectedExpenses([])
            }} className={`text-sm ${THEME.textSecondary} hover:text-rose-400 transition-colors`}>Delete</button>
            <button onClick={() => {
              const csv = ['Date,Description,Category,Subcategory,Project,Amount,Status']
              filteredExpenses.filter(e => selectedExpenses.includes(e.id)).forEach(e => {
                csv.push(`${e.date},"${e.description}",${e.category},${e.subcategory},"${projects.find(p => p.id === e.project_id)?.name || ''}",${e.amount},${e.status}`)
              })
              const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a'); a.href = url; a.download = 'expenses-export.csv'; a.click()
            }} className={`text-sm ${THEME.textSecondary} hover:text-white transition-colors`}>Export</button>
          </div>
        )}

        {/* Column Headers */}
        <div className={`flex items-center gap-3 py-2.5 px-4 bg-white/[0.03] border-b ${THEME.glassBorder} text-xs font-medium ${THEME.textDim} uppercase tracking-wider`}>
          <div className="w-8 shrink-0">
            <input type="checkbox" checked={selectedExpenses.length === filteredExpenses.length && filteredExpenses.length > 0} onChange={handleSelectAll} className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/30" />
          </div>
          <button onClick={() => handleSort('date')} className="w-20 shrink-0 flex items-center gap-1 hover:text-white transition-colors">
            Date {sortField === 'date' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <div className="flex-1">Description</div>
          <div className="w-28 shrink-0">Category</div>
          <div className="w-36 shrink-0">Type</div>
          <div className="w-28 shrink-0">Person</div>
          <div className="w-32 shrink-0">Project</div>
          <div className="w-24 shrink-0">Client</div>
          <button onClick={() => handleSort('amount')} className="w-24 text-right shrink-0 flex items-center justify-end gap-1 hover:text-white transition-colors">
            Amount {sortField === 'amount' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <div className="w-20 shrink-0">Status</div>
          <div className="w-12 shrink-0"></div>
        </div>

        {/* Expense List */}
        <div className="max-h-[500px] overflow-y-auto">
          {filteredExpenses.length > 0 ? filteredExpenses.map(expense => (
            <ExpenseRow key={expense.id} expense={expense} teamMembers={teamMembers} projects={projects} clients={clients}
              onUpdate={handleUpdateExpense} onDelete={handleDeleteExpense}
              isSelected={selectedExpenses.includes(expense.id)} onSelect={handleSelectExpense} />
          )) : (
            <div className={`flex items-center justify-center py-12 ${THEME.textMuted}`}>No expenses found</div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-6 py-3 bg-white/[0.03] border-t ${THEME.glassBorder}`}>
          <p className={`text-sm ${THEME.textMuted}`}>Showing {filteredExpenses.length} expenses</p>
          <div className="flex items-center gap-6 text-sm">
            <div><span className={THEME.textMuted}>Direct: </span><span className="font-semibold text-rose-400">{formatCurrency(filteredExpenses.filter(e => e.category === 'directCosts').reduce((s, e) => s + e.amount, 0))}</span></div>
            <div><span className={THEME.textMuted}>Overhead: </span><span className="font-semibold text-amber-400">{formatCurrency(filteredExpenses.filter(e => e.category === 'overhead').reduce((s, e) => s + e.amount, 0))}</span></div>
            <div><span className={THEME.textMuted}>Total: </span><span className={`font-semibold ${THEME.textPrimary}`}>{formatCurrency(filteredExpenses.reduce((s, e) => s + e.amount, 0))}</span></div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Add Modal */}
      <AddExpenseModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} teamMembers={teamMembers} projects={projects} onSave={handleAddExpense} />
    </div>
  )
}
