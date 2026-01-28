'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  Receipt, DollarSign, TrendingUp, TrendingDown, Users, Building2,
  Plus, ChevronDown, ChevronUp, Filter, Download, Search, RefreshCw,
  MoreHorizontal, Edit2, Check, X, Trash2, Calendar, Briefcase,
  CreditCard, FileText, PieChart, BarChart3, AlertCircle, CheckCircle2
} from 'lucide-react'
import Link from 'next/link'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, LineChart, Line, AreaChart, Area
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
  orange: '#f97316',
  slate: {
    50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1',
    400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155',
    800: '#1e293b', 900: '#0f172a'
  }
}

// Category configuration
const EXPENSE_CATEGORIES = {
  directCosts: {
    label: 'Direct Costs',
    color: COLORS.rose,
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/30',
    subcategories: ['Contractor Labor', 'Materials', 'Subcontractors', 'Project Expenses']
  },
  overhead: {
    label: 'Overhead',
    color: COLORS.amber,
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    subcategories: ['Payroll', 'Software & Subscriptions', 'Rent & Utilities', 'Insurance', 'Professional Services', 'Travel & Entertainment', 'Office & Supplies', 'Marketing', 'Other']
  }
}

// ============ UTILITY FUNCTIONS ============
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const formatDateShort = (dateStr: string): string => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
}: { 
  label: string
  value: string
  subtitle?: string
  icon: any
  trend?: { value: number; label: string }
  color?: 'emerald' | 'blue' | 'rose' | 'amber' | 'purple' | 'slate' | 'cyan'
}) {
  const colorMap = {
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', icon: 'text-emerald-500' },
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', icon: 'text-blue-500' },
    rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', icon: 'text-rose-500' },
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', icon: 'text-amber-500' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', icon: 'text-purple-500' },
    slate: { bg: 'bg-slate-500/10', border: 'border-slate-500/20', text: 'text-slate-300', icon: 'text-slate-400' },
    cyan: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400', icon: 'text-cyan-500' }
  }
  const c = colorMap[color]

  return (
    <div className={`${c.bg} ${c.border} border rounded-xl p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">{label}</p>
          <p className={`text-2xl font-bold ${c.text} mt-1`}>{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.value >= 0 ? <TrendingUp size={14} className="text-rose-500" /> : <TrendingDown size={14} className="text-emerald-500" />}
              <span className={`text-xs font-medium ${trend.value >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{Math.abs(trend.value).toFixed(1)}%</span>
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

// Category Badge
function CategoryBadge({ category }: { category: string }) {
  const config = EXPENSE_CATEGORIES[category as keyof typeof EXPENSE_CATEGORIES] || EXPENSE_CATEGORIES.overhead
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}>
      {config.label}
    </span>
  )
}

// Status Badge
function StatusBadge({ status }: { status: string }) {
  const configs: { [key: string]: { bg: string; text: string; border: string; label: string } } = {
    paid: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', label: 'Paid' },
    pending: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Pending' },
  }
  const config = configs[status] || configs.paid
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${config.bg} ${config.text} border ${config.border}`}>
      {config.label}
    </span>
  )
}

// Expense Breakdown Bar
function ExpenseBar({ 
  label, 
  amount, 
  total, 
  color 
}: { 
  label: string
  amount: number
  total: number
  color: string
}) {
  const percent = total > 0 ? (amount / total) * 100 : 0
  
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="w-40 shrink-0">
        <p className="text-sm text-slate-300">{label}</p>
      </div>
      <div className="flex-1 h-4 bg-slate-700/30 rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      <div className="w-24 text-right shrink-0">
        <p className="text-sm font-semibold text-slate-200">{formatCurrency(amount)}</p>
      </div>
      <div className="w-12 text-right shrink-0">
        <p className="text-xs text-slate-400">{percent.toFixed(0)}%</p>
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

// Editable Select
function EditableSelect({ 
  value, 
  options, 
  onChange,
  placeholder = 'Select...'
}: { 
  value: string
  options: { id: string; name: string }[]
  onChange: (value: string) => void
  placeholder?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  
  const filteredOptions = options.filter(opt => 
    opt.name.toLowerCase().includes(search.toLowerCase())
  )
  
  const selectedOption = options.find(opt => opt.id === value)
  
  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-sm text-slate-300 hover:text-slate-100 transition-colors group"
      >
        <span className={selectedOption ? '' : 'text-slate-500 italic'}>{selectedOption?.name || placeholder}</span>
        <Edit2 size={12} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
            <div className="p-2 border-b border-slate-700">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full bg-slate-700/50 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                autoFocus
              />
            </div>
            <div className="max-h-48 overflow-y-auto">
              <button
                onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }}
                className="w-full px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-700/50 transition-colors"
              >
                — None —
              </button>
              {filteredOptions.map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { onChange(opt.id); setIsOpen(false); setSearch(''); }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 transition-colors ${
                    opt.id === value ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-300'
                  }`}
                >
                  {opt.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Expense Row
function ExpenseRow({ 
  expense, 
  contractors,
  projects,
  onUpdate,
  onDelete,
  isSelected,
  onSelect
}: { 
  expense: any
  contractors: any[]
  projects: any[]
  onUpdate: (id: string, updates: any) => void
  onDelete: (id: string) => void
  isSelected: boolean
  onSelect: (id: string) => void
}) {
  const contractor = contractors.find(c => c.id === expense.contractor_id)
  const project = projects.find(p => p.id === expense.project_id)
  const catConfig = EXPENSE_CATEGORIES[expense.category as keyof typeof EXPENSE_CATEGORIES] || EXPENSE_CATEGORIES.overhead
  
  return (
    <div className={`flex items-center gap-3 py-3 px-4 hover:bg-slate-800/30 transition-colors border-b border-slate-700/30 ${isSelected ? 'bg-emerald-500/5' : ''}`}>
      {/* Checkbox */}
      <div className="w-8 shrink-0">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(expense.id)}
          className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
        />
      </div>
      
      {/* Date */}
      <div className="w-24 shrink-0">
        <p className="text-sm text-slate-400">{formatDateShort(expense.date)}</p>
      </div>
      
      {/* Description */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 truncate">{expense.description}</p>
      </div>
      
      {/* Category */}
      <div className="w-28 shrink-0">
        <CategoryBadge category={expense.category} />
      </div>
      
      {/* Subcategory */}
      <div className="w-36 shrink-0">
        <p className="text-xs text-slate-400">{expense.subcategory}</p>
      </div>
      
      {/* Contractor (for direct costs) */}
      <div className="w-32 shrink-0">
        {expense.category === 'directCosts' ? (
          <EditableSelect
            value={expense.contractor_id || ''}
            options={contractors}
            onChange={(value) => onUpdate(expense.id, { contractor_id: value })}
            placeholder="Assign"
          />
        ) : (
          <span className="text-xs text-slate-500">—</span>
        )}
      </div>
      
      {/* Project (for direct costs) */}
      <div className="w-36 shrink-0">
        {expense.category === 'directCosts' ? (
          <EditableSelect
            value={expense.project_id || ''}
            options={projects}
            onChange={(value) => onUpdate(expense.id, { project_id: value })}
            placeholder="Assign"
          />
        ) : (
          <span className="text-xs text-slate-500">—</span>
        )}
      </div>
      
      {/* Amount */}
      <div className="w-24 text-right shrink-0">
        <p className="text-sm font-semibold text-rose-400">{formatCurrency(expense.amount)}</p>
      </div>
      
      {/* Status */}
      <div className="w-20 shrink-0">
        <StatusBadge status={expense.status} />
      </div>
      
      {/* Actions */}
      <div className="w-16 shrink-0 flex items-center justify-end gap-1">
        <button 
          onClick={() => onDelete(expense.id)}
          className="p-1 hover:bg-slate-700 rounded transition-colors"
          title="Delete"
        >
          <Trash2 size={14} className="text-slate-500 hover:text-rose-400" />
        </button>
        <button className="p-1 hover:bg-slate-700 rounded transition-colors" title="More actions">
          <MoreHorizontal size={16} className="text-slate-500" />
        </button>
      </div>
    </div>
  )
}

// Add Expense Modal
function AddExpenseModal({ 
  isOpen, 
  onClose, 
  contractors,
  projects,
  onSave 
}: { 
  isOpen: boolean
  onClose: () => void
  contractors: any[]
  projects: any[]
  onSave: (expense: any) => void
}) {
  const [category, setCategory] = useState<'directCosts' | 'overhead'>('directCosts')
  const [subcategory, setSubcategory] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [contractorId, setContractorId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [status, setStatus] = useState<'paid' | 'pending'>('paid')

  useEffect(() => {
    // Reset subcategory when category changes
    setSubcategory(EXPENSE_CATEGORIES[category].subcategories[0])
  }, [category])

  if (!isOpen) return null

  const handleSave = () => {
    onSave({
      category,
      subcategory,
      amount: parseFloat(amount) || 0,
      date,
      description,
      contractor_id: category === 'directCosts' ? contractorId : null,
      project_id: category === 'directCosts' ? projectId : null,
      status
    })
    // Reset form
    setAmount('')
    setDescription('')
    setContractorId('')
    setProjectId('')
    onClose()
  }

  const currentSubcategories = EXPENSE_CATEGORIES[category].subcategories

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100">Add Expense</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-lg transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Category Toggle */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Category</label>
            <div className="flex gap-2">
              <button
                onClick={() => setCategory('directCosts')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                  category === 'directCosts' 
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                    : 'bg-slate-700/50 text-slate-400 border border-transparent'
                }`}
              >
                Direct Costs
              </button>
              <button
                onClick={() => setCategory('overhead')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
                  category === 'overhead' 
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                    : 'bg-slate-700/50 text-slate-400 border border-transparent'
                }`}
              >
                Overhead
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              {category === 'directCosts' 
                ? 'Project-specific costs that affect Gross Margin' 
                : 'Operating expenses that affect Net Profit'}
            </p>
          </div>

          {/* Subcategory */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Type</label>
            <select
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              {currentSubcategories.map(sub => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>

          {/* Amount & Date */}
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

          {/* Contractor & Project (only for Direct Costs) */}
          {category === 'directCosts' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Contractor</label>
                <select
                  value={contractorId}
                  onChange={(e) => setContractorId(e.target.value)}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select contractor...</option>
                  {contractors.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Project</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select project...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Status</label>
            <div className="flex gap-2">
              <button
                onClick={() => setStatus('paid')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  status === 'paid' 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                    : 'bg-slate-700/50 text-slate-400 border border-transparent'
                }`}
              >
                <CheckCircle2 size={14} className="inline mr-1.5" />
                Paid
              </button>
              <button
                onClick={() => setStatus('pending')}
                className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                  status === 'pending' 
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                    : 'bg-slate-700/50 text-slate-400 border border-transparent'
                }`}
              >
                <AlertCircle size={14} className="inline mr-1.5" />
                Pending
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700 bg-slate-800/50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors">
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={!amount || !description}
            className="px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
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
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<number | 'all'>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [sortField, setSortField] = useState<string>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Sample contractors
  const [contractors, setContractors] = useState([
    { id: 'con1', name: 'Travis Swank' },
    { id: 'con2', name: 'Maria Garcia' },
    { id: 'con3', name: 'John Smith' },
    { id: 'con4', name: 'Sarah Chen' },
  ])

  // Sample projects
  const [projects, setProjects] = useState([
    { id: 'p1', name: 'gCLS - Doc Control', client_id: 'c1' },
    { id: 'p2', name: 'gCLS - QA/QC', client_id: 'c1' },
    { id: 'p3', name: 'gCLS - Commissioning', client_id: 'c1' },
    { id: 'p4', name: 'Yondr Supply Chain', client_id: 'c2' },
    { id: 'p5', name: 'SDP Buildout', client_id: 'c3' },
    { id: 'p6', name: 'CADC Phase 1', client_id: 'c4' },
  ])

  // Sample expenses
  const [expenses, setExpenses] = useState([
    { id: '1', date: '2026-01-15', description: 'Travis Swank - January Invoice', category: 'directCosts', subcategory: 'Contractor Labor', amount: 8500, contractor_id: 'con1', project_id: 'p1', status: 'paid' },
    { id: '2', date: '2026-01-15', description: 'Maria Garcia - January Invoice', category: 'directCosts', subcategory: 'Contractor Labor', amount: 7200, contractor_id: 'con2', project_id: 'p2', status: 'paid' },
    { id: '3', date: '2026-01-20', description: 'John Smith - Project Support', category: 'directCosts', subcategory: 'Contractor Labor', amount: 4800, contractor_id: 'con3', project_id: 'p4', status: 'pending' },
    { id: '4', date: '2026-01-01', description: 'Slack - Monthly', category: 'overhead', subcategory: 'Software & Subscriptions', amount: 150, contractor_id: null, project_id: null, status: 'paid' },
    { id: '5', date: '2026-01-01', description: 'Google Workspace', category: 'overhead', subcategory: 'Software & Subscriptions', amount: 180, contractor_id: null, project_id: null, status: 'paid' },
    { id: '6', date: '2026-01-01', description: 'Notion - Team Plan', category: 'overhead', subcategory: 'Software & Subscriptions', amount: 96, contractor_id: null, project_id: null, status: 'paid' },
    { id: '7', date: '2026-01-05', description: 'Office Rent - January', category: 'overhead', subcategory: 'Rent & Utilities', amount: 2500, contractor_id: null, project_id: null, status: 'paid' },
    { id: '8', date: '2026-01-10', description: 'Liability Insurance - Q1', category: 'overhead', subcategory: 'Insurance', amount: 1800, contractor_id: null, project_id: null, status: 'paid' },
    { id: '9', date: '2025-12-15', description: 'Travis Swank - December Invoice', category: 'directCosts', subcategory: 'Contractor Labor', amount: 8500, contractor_id: 'con1', project_id: 'p1', status: 'paid' },
    { id: '10', date: '2025-12-15', description: 'Maria Garcia - December Invoice', category: 'directCosts', subcategory: 'Contractor Labor', amount: 7200, contractor_id: 'con2', project_id: 'p3', status: 'paid' },
  ])

  const months = [
    { value: 'all', label: 'All Months' },
    { value: 0, label: 'January' }, { value: 1, label: 'February' }, { value: 2, label: 'March' },
    { value: 3, label: 'April' }, { value: 4, label: 'May' }, { value: 5, label: 'June' },
    { value: 6, label: 'July' }, { value: 7, label: 'August' }, { value: 8, label: 'September' },
    { value: 9, label: 'October' }, { value: 10, label: 'November' }, { value: 11, label: 'December' }
  ]

  useEffect(() => {
    setTimeout(() => setLoading(false), 500)
  }, [])

  // Calculate expense metrics
  const expenseMetrics = useMemo(() => {
    // Filter by year and optionally month
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

    // Breakdown by subcategory
    const bySubcategory: { [key: string]: { category: string; amount: number } } = {}
    filtered.forEach(exp => {
      if (!bySubcategory[exp.subcategory]) {
        bySubcategory[exp.subcategory] = { category: exp.category, amount: 0 }
      }
      bySubcategory[exp.subcategory].amount += exp.amount
    })

    // By contractor (direct costs only)
    const byContractor: { [key: string]: number } = {}
    filtered.filter(exp => exp.category === 'directCosts' && exp.contractor_id).forEach(exp => {
      const contractor = contractors.find(c => c.id === exp.contractor_id)
      const name = contractor?.name || 'Unknown'
      byContractor[name] = (byContractor[name] || 0) + exp.amount
    })

    return { 
      totalExpenses, 
      directCosts, 
      overhead, 
      pendingAmount, 
      pendingCount,
      bySubcategory: Object.entries(bySubcategory)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.amount - a.amount),
      byContractor: Object.entries(byContractor)
        .map(([name, amount]) => ({ name, amount }))
        .sort((a, b) => b.amount - a.amount)
    }
  }, [expenses, selectedYear, selectedMonth, contractors])

  // Filtered expenses for table
  const filteredExpenses = useMemo(() => {
    let filtered = [...expenses]
    
    // Year filter
    filtered = filtered.filter(exp => new Date(exp.date).getFullYear() === selectedYear)
    
    // Month filter
    if (selectedMonth !== 'all') {
      filtered = filtered.filter(exp => new Date(exp.date).getMonth() === selectedMonth)
    }
    
    // Category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter(exp => exp.category === filterCategory)
    }
    
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(exp => 
        exp.description.toLowerCase().includes(q) ||
        exp.subcategory.toLowerCase().includes(q) ||
        contractors.find(c => c.id === exp.contractor_id)?.name.toLowerCase().includes(q)
      )
    }
    
    // Sort
    filtered.sort((a, b) => {
      let aVal: any = a[sortField as keyof typeof a]
      let bVal: any = b[sortField as keyof typeof b]
      if (sortField === 'date') {
        aVal = new Date(aVal as string).getTime()
        bVal = new Date(bVal as string).getTime()
      }
      if (sortDir === 'asc') return aVal > bVal ? 1 : -1
      return aVal < bVal ? 1 : -1
    })
    
    return filtered
  }, [expenses, selectedYear, selectedMonth, filterCategory, searchQuery, sortField, sortDir, contractors])

  // Monthly trend data
  const monthlyTrend = useMemo(() => {
    const data: { month: string; directCosts: number; overhead: number }[] = []
    for (let m = 0; m < 12; m++) {
      const monthExpenses = expenses.filter(exp => {
        const d = new Date(exp.date)
        return d.getFullYear() === selectedYear && d.getMonth() === m
      })
      data.push({
        month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m],
        directCosts: monthExpenses.filter(e => e.category === 'directCosts').reduce((s, e) => s + e.amount, 0),
        overhead: monthExpenses.filter(e => e.category === 'overhead').reduce((s, e) => s + e.amount, 0),
      })
    }
    return data
  }, [expenses, selectedYear])

  // Handlers
  const handleAddExpense = (expense: any) => {
    setExpenses(prev => [...prev, { id: Date.now().toString(), ...expense }])
  }

  const handleUpdateExpense = (id: string, updates: any) => {
    setExpenses(prev => prev.map(exp => exp.id === id ? { ...exp, ...updates } : exp))
  }

  const handleDeleteExpense = (id: string) => {
    if (confirm('Delete this expense?')) {
      setExpenses(prev => prev.filter(exp => exp.id !== id))
    }
  }

  const handleSelectExpense = (id: string) => {
    setSelectedExpenses(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleSelectAll = () => {
    if (selectedExpenses.length === filteredExpenses.length) {
      setSelectedExpenses([])
    } else {
      setSelectedExpenses(filteredExpenses.map(exp => exp.id))
    }
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Loading expenses...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* ============ HEADER ============ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Expenses</h1>
          <p className="text-sm text-slate-400 mt-1">Direct costs & overhead tracking</p>
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
            <Download size={16} />
            Export
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
          >
            <Plus size={16} />
            Add Expense
          </button>
        </div>
      </div>

      {/* ============ METRICS ============ */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          label="Total Expenses"
          value={formatCurrency(expenseMetrics.totalExpenses)}
          subtitle={`${selectedMonth === 'all' ? 'YTD' : months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`}
          icon={Receipt}
          color="slate"
        />
        <MetricCard
          label="Direct Costs"
          value={formatCurrency(expenseMetrics.directCosts)}
          subtitle="Affects Gross Margin"
          icon={Users}
          color="rose"
        />
        <MetricCard
          label="Overhead"
          value={formatCurrency(expenseMetrics.overhead)}
          subtitle="Operating expenses"
          icon={Building2}
          color="amber"
        />
        <MetricCard
          label="Pending"
          value={formatCurrency(expenseMetrics.pendingAmount)}
          subtitle={`${expenseMetrics.pendingCount} unpaid bills`}
          icon={AlertCircle}
          color={expenseMetrics.pendingCount > 0 ? 'amber' : 'emerald'}
        />
      </div>

      {/* ============ CHARTS & BREAKDOWN ============ */}
      <div className="grid grid-cols-12 gap-4">
        {/* Monthly Trend */}
        <div className="col-span-12 lg:col-span-8">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Monthly Expenses</h2>
                <p className="text-sm text-slate-500 mt-0.5">{selectedYear} breakdown</p>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyTrend} barGap={0}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip formatter={(v: number) => formatCurrency(v)} />} />
                  <Bar dataKey="directCosts" name="Direct Costs" fill={COLORS.rose} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="overhead" name="Overhead" fill={COLORS.amber} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Expense Breakdown */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 h-full">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">By Category</h2>
            <div className="space-y-1">
              {expenseMetrics.bySubcategory.slice(0, 6).map((item, i) => (
                <ExpenseBar 
                  key={i}
                  label={item.name}
                  amount={item.amount}
                  total={expenseMetrics.totalExpenses}
                  color={item.category === 'directCosts' ? COLORS.rose : COLORS.amber}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ============ CONTRACTOR COSTS ============ */}
      {expenseMetrics.byContractor.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Contractor Costs</h2>
          <div className="grid grid-cols-4 gap-4">
            {expenseMetrics.byContractor.map((contractor, i) => (
              <div key={i} className="bg-slate-700/30 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center">
                    <Users size={18} className="text-rose-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{contractor.name}</p>
                    <p className="text-lg font-bold text-rose-400">{formatCurrency(contractor.amount)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ============ EXPENSE TABLE ============ */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        {/* Table Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-5 py-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-100">All Expenses</h2>
            <span className="px-2 py-0.5 bg-slate-700 rounded text-xs font-medium text-slate-300">{filteredExpenses.length}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search expenses..."
                className="bg-slate-700/50 border border-slate-600 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 w-48 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">All Categories</option>
              <option value="directCosts">Direct Costs</option>
              <option value="overhead">Overhead</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedExpenses.length > 0 && (
          <div className="flex items-center gap-4 px-5 py-3 bg-emerald-500/10 border-b border-emerald-500/20">
            <span className="text-sm text-emerald-400">{selectedExpenses.length} selected</span>
            <button className="text-sm text-slate-300 hover:text-white transition-colors">Mark as Paid</button>
            <button className="text-sm text-slate-300 hover:text-white transition-colors">Delete</button>
            <button className="text-sm text-slate-300 hover:text-white transition-colors">Export</button>
          </div>
        )}
        
        {/* Column Headers */}
        <div className="flex items-center gap-3 py-2 px-4 bg-slate-800/80 border-b border-slate-700/50 text-xs font-medium text-slate-500 uppercase tracking-wider">
          <div className="w-8 shrink-0">
            <input
              type="checkbox"
              checked={selectedExpenses.length === filteredExpenses.length && filteredExpenses.length > 0}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
            />
          </div>
          <button onClick={() => handleSort('date')} className="w-24 shrink-0 flex items-center gap-1 hover:text-slate-300 transition-colors">
            Date {sortField === 'date' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <div className="flex-1">Description</div>
          <div className="w-28 shrink-0">Category</div>
          <div className="w-36 shrink-0">Type</div>
          <div className="w-32 shrink-0">Contractor</div>
          <div className="w-36 shrink-0">Project</div>
          <button onClick={() => handleSort('amount')} className="w-24 text-right shrink-0 flex items-center justify-end gap-1 hover:text-slate-300 transition-colors">
            Amount {sortField === 'amount' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
          </button>
          <div className="w-20 shrink-0">Status</div>
          <div className="w-16 shrink-0"></div>
        </div>

        {/* Expense List */}
        <div className="max-h-[500px] overflow-y-auto">
          {filteredExpenses.length > 0 ? (
            filteredExpenses.map(expense => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                contractors={contractors}
                projects={projects}
                onUpdate={handleUpdateExpense}
                onDelete={handleDeleteExpense}
                isSelected={selectedExpenses.includes(expense.id)}
                onSelect={handleSelectExpense}
              />
            ))
          ) : (
            <div className="flex items-center justify-center py-12 text-slate-500">
              No expenses found
            </div>
          )}
        </div>

        {/* Footer Summary */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-800/80 border-t border-slate-700/50">
          <p className="text-sm text-slate-400">
            Showing {filteredExpenses.length} expenses
          </p>
          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="text-slate-500">Direct Costs: </span>
              <span className="font-semibold text-rose-400">{formatCurrency(filteredExpenses.filter(e => e.category === 'directCosts').reduce((s, e) => s + e.amount, 0))}</span>
            </div>
            <div>
              <span className="text-slate-500">Overhead: </span>
              <span className="font-semibold text-amber-400">{formatCurrency(filteredExpenses.filter(e => e.category === 'overhead').reduce((s, e) => s + e.amount, 0))}</span>
            </div>
            <div>
              <span className="text-slate-500">Total: </span>
              <span className="font-semibold text-slate-200">{formatCurrency(filteredExpenses.reduce((s, e) => s + e.amount, 0))}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============ MODALS ============ */}
      <AddExpenseModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        contractors={contractors}
        projects={projects}
        onSave={handleAddExpense}
      />
    </div>
  )
}
