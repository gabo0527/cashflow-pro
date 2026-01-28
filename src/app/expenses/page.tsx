'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { 
  Receipt, DollarSign, TrendingUp, TrendingDown, Users, Building2,
  Plus, ChevronDown, ChevronUp, Filter, Download, Search, RefreshCw,
  MoreHorizontal, Edit2, Check, X, Trash2, Calendar, Briefcase,
  CreditCard, FileText, PieChart, BarChart3, AlertCircle, CheckCircle2,
  Settings, PlusCircle
} from 'lucide-react'
import Link from 'next/link'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from 'recharts'

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

// Metric Card
function MetricCard({ label, value, subtitle, icon: Icon, color = 'emerald' }: { 
  label: string; value: string; subtitle?: string; icon: any; color?: string
}) {
  const colorMap: { [key: string]: { bg: string; border: string; text: string; icon: string } } = {
    emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', icon: 'text-emerald-500' },
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', icon: 'text-blue-500' },
    rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', icon: 'text-rose-500' },
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400', icon: 'text-amber-500' },
    slate: { bg: 'bg-slate-500/10', border: 'border-slate-500/20', text: 'text-slate-300', icon: 'text-slate-400' },
  }
  const c = colorMap[color] || colorMap.emerald

  return (
    <div className={`${c.bg} ${c.border} border rounded-xl p-5`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">{label}</p>
          <p className={`text-2xl font-bold ${c.text} mt-1`}>{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
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
  const configs: { [key: string]: { bg: string; text: string; border: string; label: string } } = {
    directCosts: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', label: 'Direct Costs' },
    overhead: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', label: 'Overhead' },
  }
  const config = configs[category] || configs.overhead
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

// Expense Bar
function ExpenseBar({ label, amount, total, color }: { label: string; amount: number; total: number; color: string }) {
  const percent = total > 0 ? (amount / total) * 100 : 0
  return (
    <div className="flex items-center gap-4 py-2">
      <div className="w-40 shrink-0"><p className="text-sm text-slate-300">{label}</p></div>
      <div className="flex-1 h-4 bg-slate-700/30 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, backgroundColor: color }} />
      </div>
      <div className="w-24 text-right shrink-0"><p className="text-sm font-semibold text-slate-200">{formatCurrency(amount)}</p></div>
      <div className="w-12 text-right shrink-0"><p className="text-xs text-slate-400">{percent.toFixed(0)}%</p></div>
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
function EditableSelect({ value, options, onChange, placeholder = 'Select...' }: { 
  value: string; options: { id: string; name: string }[]; onChange: (value: string) => void; placeholder?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const filteredOptions = options.filter(opt => opt.name.toLowerCase().includes(search.toLowerCase()))
  const selectedOption = options.find(opt => opt.id === value)
  
  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-1 text-sm text-slate-300 hover:text-slate-100 transition-colors group">
        <span className={selectedOption ? '' : 'text-slate-500 italic'}>{selectedOption?.name || placeholder}</span>
        <Edit2 size={12} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
            <div className="p-2 border-b border-slate-700">
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." 
                className="w-full bg-slate-700/50 border border-slate-600 rounded px-2 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" autoFocus />
            </div>
            <div className="max-h-48 overflow-y-auto">
              <button onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }} className="w-full px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-700/50 transition-colors">— None —</button>
              {filteredOptions.map(opt => (
                <button key={opt.id} onClick={() => { onChange(opt.id); setIsOpen(false); setSearch(''); }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700/50 transition-colors ${opt.id === value ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-300'}`}>{opt.name}</button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Action Menu (3 dots dropdown)
function ActionMenu({ expense, subcategories, onEdit, onToggleStatus, onChangeSubcategory, onDelete }: { 
  expense: any; subcategories: { directCosts: string[]; overhead: string[] }
  onEdit: () => void; onToggleStatus: () => void; onChangeSubcategory: (sub: string) => void; onDelete: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [showTypes, setShowTypes] = useState(false)
  const currentSubcategories = subcategories[expense.category as keyof typeof subcategories] || []

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className="p-1 hover:bg-slate-700 rounded transition-colors" title="More actions">
        <MoreHorizontal size={16} className="text-slate-500 hover:text-slate-300" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setIsOpen(false); setShowTypes(false); }} />
          <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden">
            <button onClick={() => { onEdit(); setIsOpen(false); }} className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 flex items-center gap-2 transition-colors">
              <Edit2 size={14} /> Edit Expense
            </button>
            <div className="relative">
              <button onClick={() => setShowTypes(!showTypes)} className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 flex items-center justify-between transition-colors">
                <span className="flex items-center gap-2"><FileText size={14} /> Change Type</span>
                <ChevronDown size={14} className={`transition-transform ${showTypes ? 'rotate-180' : ''}`} />
              </button>
              {showTypes && (
                <div className="border-t border-slate-700 bg-slate-800/50 max-h-40 overflow-y-auto">
                  {currentSubcategories.map(sub => (
                    <button key={sub} onClick={() => { onChangeSubcategory(sub); setIsOpen(false); setShowTypes(false); }}
                      className={`w-full px-4 py-1.5 text-left text-xs hover:bg-slate-700/50 transition-colors ${expense.subcategory === sub ? 'text-emerald-400' : 'text-slate-400'}`}>{sub}</button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => { onToggleStatus(); setIsOpen(false); }} className="w-full px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-700/50 flex items-center gap-2 transition-colors">
              {expense.status === 'paid' ? <><AlertCircle size={14} className="text-amber-400" /> Mark as Pending</> : <><CheckCircle2 size={14} className="text-emerald-400" /> Mark as Paid</>}
            </button>
            <div className="border-t border-slate-700 my-1" />
            <button onClick={() => { onDelete(); setIsOpen(false); }} className="w-full px-3 py-2 text-left text-sm text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 transition-colors">
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// Expense Row
function ExpenseRow({ expense, contractors, projects, subcategories, onUpdate, onEdit, onDelete, isSelected, onSelect }: { 
  expense: any; contractors: any[]; projects: any[]; subcategories: { directCosts: string[]; overhead: string[] }
  onUpdate: (id: string, updates: any) => void; onEdit: (expense: any) => void; onDelete: (id: string) => void
  isSelected: boolean; onSelect: (id: string) => void
}) {
  return (
    <div className={`flex items-center gap-3 py-3 px-4 hover:bg-slate-800/30 transition-colors border-b border-slate-700/30 ${isSelected ? 'bg-emerald-500/5' : ''}`}>
      <div className="w-8 shrink-0">
        <input type="checkbox" checked={isSelected} onChange={() => onSelect(expense.id)} className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0" />
      </div>
      <div className="w-24 shrink-0"><p className="text-sm text-slate-400">{formatDateShort(expense.date)}</p></div>
      <div className="flex-1 min-w-0"><p className="text-sm text-slate-200 truncate">{expense.description}</p></div>
      <div className="w-28 shrink-0"><CategoryBadge category={expense.category} /></div>
      <div className="w-36 shrink-0"><p className="text-xs text-slate-400">{expense.subcategory}</p></div>
      <div className="w-32 shrink-0">
        {expense.category === 'directCosts' ? (
          <EditableSelect value={expense.contractor_id || ''} options={contractors} onChange={(value) => onUpdate(expense.id, { contractor_id: value })} placeholder="Assign" />
        ) : <span className="text-xs text-slate-500">—</span>}
      </div>
      <div className="w-36 shrink-0">
        {expense.category === 'directCosts' ? (
          <EditableSelect value={expense.project_id || ''} options={projects} onChange={(value) => onUpdate(expense.id, { project_id: value })} placeholder="Assign" />
        ) : <span className="text-xs text-slate-500">—</span>}
      </div>
      <div className="w-24 text-right shrink-0"><p className="text-sm font-semibold text-rose-400">{formatCurrency(expense.amount)}</p></div>
      <div className="w-20 shrink-0"><StatusBadge status={expense.status} /></div>
      <div className="w-16 shrink-0 flex items-center justify-end gap-1">
        <button onClick={() => onDelete(expense.id)} className="p-1 hover:bg-slate-700 rounded transition-colors" title="Delete">
          <Trash2 size={14} className="text-slate-500 hover:text-rose-400" />
        </button>
        <ActionMenu expense={expense} subcategories={subcategories} onEdit={() => onEdit(expense)} 
          onToggleStatus={() => onUpdate(expense.id, { status: expense.status === 'paid' ? 'pending' : 'paid' })}
          onChangeSubcategory={(sub) => onUpdate(expense.id, { subcategory: sub })} onDelete={() => onDelete(expense.id)} />
      </div>
    </div>
  )
}

// Edit Expense Modal
function EditExpenseModal({ isOpen, expense, onClose, contractors, projects, subcategories, onSave }: { 
  isOpen: boolean; expense: any; onClose: () => void; contractors: any[]; projects: any[]
  subcategories: { directCosts: string[]; overhead: string[] }; onSave: (id: string, updates: any) => void
}) {
  const [category, setCategory] = useState<'directCosts' | 'overhead'>('directCosts')
  const [subcategory, setSubcategory] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')
  const [contractorId, setContractorId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [status, setStatus] = useState<'paid' | 'pending'>('paid')

  useEffect(() => {
    if (expense) {
      setCategory(expense.category || 'directCosts')
      setSubcategory(expense.subcategory || '')
      setAmount(expense.amount?.toString() || '')
      setDate(expense.date || '')
      setDescription(expense.description || '')
      setContractorId(expense.contractor_id || '')
      setProjectId(expense.project_id || '')
      setStatus(expense.status || 'paid')
    }
  }, [expense])

  if (!isOpen || !expense) return null

  const handleSave = () => {
    onSave(expense.id, { category, subcategory, amount: parseFloat(amount) || 0, date, description,
      contractor_id: category === 'directCosts' ? contractorId : null,
      project_id: category === 'directCosts' ? projectId : null, status })
    onClose()
  }

  const currentSubcategories = subcategories[category]

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100">Edit Expense</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-lg transition-colors"><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Category</label>
            <div className="flex gap-2">
              <button onClick={() => setCategory('directCosts')} className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${category === 'directCosts' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-700/50 text-slate-400 border border-transparent'}`}>Direct Costs</button>
              <button onClick={() => setCategory('overhead')} className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${category === 'overhead' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-700/50 text-slate-400 border border-transparent'}`}>Overhead</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Type</label>
            <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500">
              {currentSubcategories.map(sub => <option key={sub} value={sub}>{sub}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-7 pr-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
          </div>
          {category === 'directCosts' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Contractor</label>
                <select value={contractorId} onChange={(e) => setContractorId(e.target.value)} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500">
                  <option value="">Select contractor...</option>
                  {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Project</label>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500">
                  <option value="">Select project...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Status</label>
            <div className="flex gap-2">
              <button onClick={() => setStatus('paid')} className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${status === 'paid' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700/50 text-slate-400 border border-transparent'}`}><CheckCircle2 size={14} className="inline mr-1.5" />Paid</button>
              <button onClick={() => setStatus('pending')} className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${status === 'pending' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-700/50 text-slate-400 border border-transparent'}`}><AlertCircle size={14} className="inline mr-1.5" />Pending</button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700 bg-slate-800/50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!amount || !description} className="px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Save Changes</button>
        </div>
      </div>
    </div>
  )
}

// Add Expense Modal with Editable Categories
function AddExpenseModal({ isOpen, onClose, contractors, projects, subcategories, onAddSubcategory, onDeleteSubcategory, onSave }: { 
  isOpen: boolean; onClose: () => void; contractors: any[]; projects: any[]
  subcategories: { directCosts: string[]; overhead: string[] }
  onAddSubcategory: (category: 'directCosts' | 'overhead', name: string) => void
  onDeleteSubcategory: (category: 'directCosts' | 'overhead', name: string) => void
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
  const [showManageTypes, setShowManageTypes] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')

  useEffect(() => { setSubcategory(subcategories[category][0] || '') }, [category, subcategories])

  if (!isOpen) return null

  const handleSave = () => {
    onSave({ category, subcategory, amount: parseFloat(amount) || 0, date, description,
      contractor_id: category === 'directCosts' ? contractorId : null,
      project_id: category === 'directCosts' ? projectId : null, status })
    setAmount(''); setDescription(''); setContractorId(''); setProjectId('')
    onClose()
  }

  const handleAddType = () => {
    if (newTypeName.trim()) { onAddSubcategory(category, newTypeName.trim()); setNewTypeName('') }
  }

  const currentSubcategories = subcategories[category]

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100">Add Expense</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-700 rounded-lg transition-colors"><X size={20} className="text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Category</label>
            <div className="flex gap-2">
              <button onClick={() => setCategory('directCosts')} className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${category === 'directCosts' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-700/50 text-slate-400 border border-transparent'}`}>Direct Costs</button>
              <button onClick={() => setCategory('overhead')} className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${category === 'overhead' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-700/50 text-slate-400 border border-transparent'}`}>Overhead</button>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">{category === 'directCosts' ? 'Project-specific costs that affect Gross Margin' : 'Operating expenses that affect Net Profit'}</p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium text-slate-400">Type</label>
              <button onClick={() => setShowManageTypes(!showManageTypes)} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors">
                <Settings size={12} /> {showManageTypes ? 'Done' : 'Manage Types'}
              </button>
            </div>
            {!showManageTypes ? (
              <select value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500">
                {currentSubcategories.map(sub => <option key={sub} value={sub}>{sub}</option>)}
              </select>
            ) : (
              <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-3 space-y-2">
                <div className="flex gap-2">
                  <input type="text" value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} placeholder="New type name..."
                    className="flex-1 bg-slate-700/50 border border-slate-600 rounded px-2.5 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddType()} />
                  <button onClick={handleAddType} disabled={!newTypeName.trim()} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded text-sm font-medium hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"><PlusCircle size={16} /></button>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {currentSubcategories.map(sub => (
                    <div key={sub} className="flex items-center justify-between py-1.5 px-2 bg-slate-700/30 rounded">
                      <span className="text-sm text-slate-300">{sub}</span>
                      <button onClick={() => onDeleteSubcategory(category, sub)} className="p-1 text-slate-500 hover:text-rose-400 transition-colors" title="Delete type"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
                {currentSubcategories.length === 0 && <p className="text-xs text-slate-500 text-center py-2">No types yet. Add one above.</p>}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-7 pr-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1.5">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., Travis Swank - January Invoice" className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500" />
          </div>
          {category === 'directCosts' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Contractor</label>
                <select value={contractorId} onChange={(e) => setContractorId(e.target.value)} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500">
                  <option value="">Select contractor...</option>
                  {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Project</label>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500">
                  <option value="">Select project...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Status</label>
            <div className="flex gap-2">
              <button onClick={() => setStatus('paid')} className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${status === 'paid' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-700/50 text-slate-400 border border-transparent'}`}><CheckCircle2 size={14} className="inline mr-1.5" />Paid</button>
              <button onClick={() => setStatus('pending')} className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${status === 'pending' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-700/50 text-slate-400 border border-transparent'}`}><AlertCircle size={14} className="inline mr-1.5" />Pending</button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700 bg-slate-800/50">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!amount || !description || !subcategory} className="px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">Add Expense</button>
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
  const [editingExpense, setEditingExpense] = useState<any>(null)
  const [sortField, setSortField] = useState<string>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Editable subcategories
  const [subcategories, setSubcategories] = useState({
    directCosts: ['Contractor Labor', 'Materials', 'Subcontractors', 'Project Expenses'],
    overhead: ['Payroll', 'Software & Subscriptions', 'Rent & Utilities', 'Insurance', 'Professional Services', 'Travel & Entertainment', 'Office & Supplies', 'Marketing', 'Other']
  })

  const [contractors] = useState([
    { id: 'con1', name: 'Travis Swank' }, { id: 'con2', name: 'Maria Garcia' },
    { id: 'con3', name: 'John Smith' }, { id: 'con4', name: 'Sarah Chen' },
  ])

  const [projects] = useState([
    { id: 'p1', name: 'gCLS - Doc Control' }, { id: 'p2', name: 'gCLS - QA/QC' },
    { id: 'p3', name: 'gCLS - Commissioning' }, { id: 'p4', name: 'Yondr Supply Chain' },
    { id: 'p5', name: 'SDP Buildout' }, { id: 'p6', name: 'CADC Phase 1' },
  ])

  const [expenses, setExpenses] = useState([
    { id: '1', date: '2026-01-15', description: 'Travis Swank - January Invoice', category: 'directCosts', subcategory: 'Contractor Labor', amount: 8500, contractor_id: 'con1', project_id: 'p1', status: 'paid' },
    { id: '2', date: '2026-01-15', description: 'Maria Garcia - January Invoice', category: 'directCosts', subcategory: 'Contractor Labor', amount: 7200, contractor_id: 'con2', project_id: 'p2', status: 'paid' },
    { id: '3', date: '2026-01-20', description: 'John Smith - Project Support', category: 'directCosts', subcategory: 'Contractor Labor', amount: 4800, contractor_id: 'con3', project_id: 'p4', status: 'pending' },
    { id: '4', date: '2026-01-01', description: 'Slack - Monthly', category: 'overhead', subcategory: 'Software & Subscriptions', amount: 150, contractor_id: null, project_id: null, status: 'paid' },
    { id: '5', date: '2026-01-01', description: 'Google Workspace', category: 'overhead', subcategory: 'Software & Subscriptions', amount: 180, contractor_id: null, project_id: null, status: 'paid' },
    { id: '6', date: '2026-01-01', description: 'Notion - Team Plan', category: 'overhead', subcategory: 'Software & Subscriptions', amount: 96, contractor_id: null, project_id: null, status: 'paid' },
    { id: '7', date: '2026-01-05', description: 'Office Rent - January', category: 'overhead', subcategory: 'Rent & Utilities', amount: 2500, contractor_id: null, project_id: null, status: 'paid' },
    { id: '8', date: '2026-01-10', description: 'Liability Insurance - Q1', category: 'overhead', subcategory: 'Insurance', amount: 1800, contractor_id: null, project_id: null, status: 'paid' },
  ])

  const months = [
    { value: 'all', label: 'All Months' },
    { value: 0, label: 'January' }, { value: 1, label: 'February' }, { value: 2, label: 'March' },
    { value: 3, label: 'April' }, { value: 4, label: 'May' }, { value: 5, label: 'June' },
    { value: 6, label: 'July' }, { value: 7, label: 'August' }, { value: 8, label: 'September' },
    { value: 9, label: 'October' }, { value: 10, label: 'November' }, { value: 11, label: 'December' }
  ]

  useEffect(() => { setTimeout(() => setLoading(false), 500) }, [])

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
    const bySubcategory: { [key: string]: { category: string; amount: number } } = {}
    filtered.forEach(exp => {
      if (!bySubcategory[exp.subcategory]) bySubcategory[exp.subcategory] = { category: exp.category, amount: 0 }
      bySubcategory[exp.subcategory].amount += exp.amount
    })
    const byContractor: { [key: string]: number } = {}
    filtered.filter(exp => exp.category === 'directCosts' && exp.contractor_id).forEach(exp => {
      const contractor = contractors.find(c => c.id === exp.contractor_id)
      const name = contractor?.name || 'Unknown'
      byContractor[name] = (byContractor[name] || 0) + exp.amount
    })
    return { totalExpenses, directCosts, overhead, pendingAmount, pendingCount,
      bySubcategory: Object.entries(bySubcategory).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.amount - a.amount),
      byContractor: Object.entries(byContractor).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount) }
  }, [expenses, selectedYear, selectedMonth, contractors])

  const filteredExpenses = useMemo(() => {
    let filtered = [...expenses]
    filtered = filtered.filter(exp => new Date(exp.date).getFullYear() === selectedYear)
    if (selectedMonth !== 'all') filtered = filtered.filter(exp => new Date(exp.date).getMonth() === selectedMonth)
    if (filterCategory !== 'all') filtered = filtered.filter(exp => exp.category === filterCategory)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(exp => exp.description.toLowerCase().includes(q) || exp.subcategory.toLowerCase().includes(q) || contractors.find(c => c.id === exp.contractor_id)?.name.toLowerCase().includes(q))
    }
    filtered.sort((a, b) => {
      let aVal: any = a[sortField as keyof typeof a]
      let bVal: any = b[sortField as keyof typeof b]
      if (sortField === 'date') { aVal = new Date(aVal as string).getTime(); bVal = new Date(bVal as string).getTime() }
      if (sortDir === 'asc') return aVal > bVal ? 1 : -1
      return aVal < bVal ? 1 : -1
    })
    return filtered
  }, [expenses, selectedYear, selectedMonth, filterCategory, searchQuery, sortField, sortDir, contractors])

  const monthlyTrend = useMemo(() => {
    const data: { month: string; directCosts: number; overhead: number }[] = []
    for (let m = 0; m < 12; m++) {
      const monthExpenses = expenses.filter(exp => { const d = new Date(exp.date); return d.getFullYear() === selectedYear && d.getMonth() === m })
      data.push({ month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m],
        directCosts: monthExpenses.filter(e => e.category === 'directCosts').reduce((s, e) => s + e.amount, 0),
        overhead: monthExpenses.filter(e => e.category === 'overhead').reduce((s, e) => s + e.amount, 0) })
    }
    return data
  }, [expenses, selectedYear])

  const handleAddExpense = (expense: any) => { setExpenses(prev => [...prev, { id: Date.now().toString(), ...expense }]) }
  const handleUpdateExpense = (id: string, updates: any) => { setExpenses(prev => prev.map(exp => exp.id === id ? { ...exp, ...updates } : exp)) }
  const handleDeleteExpense = (id: string) => { if (confirm('Delete this expense?')) setExpenses(prev => prev.filter(exp => exp.id !== id)) }
  const handleSelectExpense = (id: string) => { setSelectedExpenses(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]) }
  const handleSelectAll = () => { setSelectedExpenses(prev => prev.length === filteredExpenses.length ? [] : filteredExpenses.map(exp => exp.id)) }
  const handleSort = (field: string) => { if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); else { setSortField(field); setSortDir('desc') } }
  const handleAddSubcategory = (category: 'directCosts' | 'overhead', name: string) => { setSubcategories(prev => ({ ...prev, [category]: [...prev[category], name] })) }
  const handleDeleteSubcategory = (category: 'directCosts' | 'overhead', name: string) => {
    if (subcategories[category].length <= 1) { alert('You must have at least one type in each category.'); return }
    const inUse = expenses.some(exp => exp.subcategory === name)
    if (inUse && !confirm(`"${name}" is used by existing expenses. Delete anyway?`)) return
    setSubcategories(prev => ({ ...prev, [category]: prev[category].filter(sub => sub !== name) }))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center"><RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" /><p className="text-slate-400 text-sm">Loading expenses...</p></div>
    </div>
  )

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div><h1 className="text-2xl font-bold text-slate-100">Expenses</h1><p className="text-sm text-slate-400 mt-1">Direct costs & overhead tracking</p></div>
        <div className="flex items-center gap-2">
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500">
            {[2026, 2025, 2024, 2023].map(year => <option key={year} value={year}>{year}</option>)}
          </select>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500">
            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <button className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-300 hover:border-slate-600 transition-colors"><Download size={16} />Export</button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"><Plus size={16} />Add Expense</button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <MetricCard label="Total Expenses" value={formatCurrency(expenseMetrics.totalExpenses)} subtitle={`${selectedMonth === 'all' ? 'YTD' : months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`} icon={Receipt} color="slate" />
        <MetricCard label="Direct Costs" value={formatCurrency(expenseMetrics.directCosts)} subtitle="Affects Gross Margin" icon={Users} color="rose" />
        <MetricCard label="Overhead" value={formatCurrency(expenseMetrics.overhead)} subtitle="Operating expenses" icon={Building2} color="amber" />
        <MetricCard label="Pending" value={formatCurrency(expenseMetrics.pendingAmount)} subtitle={`${expenseMetrics.pendingCount} unpaid bills`} icon={AlertCircle} color={expenseMetrics.pendingCount > 0 ? 'amber' : 'emerald'} />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4"><div><h2 className="text-lg font-semibold text-slate-100">Monthly Expenses</h2><p className="text-sm text-slate-500 mt-0.5">{selectedYear} breakdown</p></div></div>
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
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5 h-full">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">By Category</h2>
            <div className="space-y-1">
              {expenseMetrics.bySubcategory.slice(0, 6).map((item, i) => (
                <ExpenseBar key={i} label={item.name} amount={item.amount} total={expenseMetrics.totalExpenses} color={item.category === 'directCosts' ? COLORS.rose : COLORS.amber} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {expenseMetrics.byContractor.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Contractor Costs</h2>
          <div className="grid grid-cols-4 gap-4">
            {expenseMetrics.byContractor.map((contractor, i) => (
              <div key={i} className="bg-slate-700/30 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center"><Users size={18} className="text-rose-400" /></div>
                  <div><p className="text-sm font-medium text-slate-200">{contractor.name}</p><p className="text-lg font-bold text-rose-400">{formatCurrency(contractor.amount)}</p></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-5 py-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3"><h2 className="text-lg font-semibold text-slate-100">All Expenses</h2><span className="px-2 py-0.5 bg-slate-700 rounded text-xs font-medium text-slate-300">{filteredExpenses.length}</span></div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search expenses..." className="bg-slate-700/50 border border-slate-600 rounded-lg pl-9 pr-3 py-1.5 text-sm text-slate-200 w-48 focus:outline-none focus:border-emerald-500" /></div>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-emerald-500">
              <option value="all">All Categories</option><option value="directCosts">Direct Costs</option><option value="overhead">Overhead</option>
            </select>
          </div>
        </div>

        {selectedExpenses.length > 0 && (
          <div className="flex items-center gap-4 px-5 py-3 bg-emerald-500/10 border-b border-emerald-500/20">
            <span className="text-sm text-emerald-400">{selectedExpenses.length} selected</span>
            <button className="text-sm text-slate-300 hover:text-white transition-colors">Mark as Paid</button>
            <button className="text-sm text-slate-300 hover:text-white transition-colors">Delete</button>
            <button className="text-sm text-slate-300 hover:text-white transition-colors">Export</button>
          </div>
        )}
        
        <div className="flex items-center gap-3 py-2 px-4 bg-slate-800/80 border-b border-slate-700/50 text-xs font-medium text-slate-500 uppercase tracking-wider">
          <div className="w-8 shrink-0"><input type="checkbox" checked={selectedExpenses.length === filteredExpenses.length && filteredExpenses.length > 0} onChange={handleSelectAll} className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500" /></div>
          <button onClick={() => handleSort('date')} className="w-24 shrink-0 flex items-center gap-1 hover:text-slate-300 transition-colors">Date {sortField === 'date' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</button>
          <div className="flex-1">Description</div>
          <div className="w-28 shrink-0">Category</div>
          <div className="w-36 shrink-0">Type</div>
          <div className="w-32 shrink-0">Contractor</div>
          <div className="w-36 shrink-0">Project</div>
          <button onClick={() => handleSort('amount')} className="w-24 text-right shrink-0 flex items-center justify-end gap-1 hover:text-slate-300 transition-colors">Amount {sortField === 'amount' && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}</button>
          <div className="w-20 shrink-0">Status</div>
          <div className="w-16 shrink-0"></div>
        </div>

        <div className="max-h-[500px] overflow-y-auto">
          {filteredExpenses.length > 0 ? filteredExpenses.map(expense => (
            <ExpenseRow key={expense.id} expense={expense} contractors={contractors} projects={projects} subcategories={subcategories}
              onUpdate={handleUpdateExpense} onEdit={(exp) => setEditingExpense(exp)} onDelete={handleDeleteExpense}
              isSelected={selectedExpenses.includes(expense.id)} onSelect={handleSelectExpense} />
          )) : <div className="flex items-center justify-center py-12 text-slate-500">No expenses found</div>}
        </div>

        <div className="flex items-center justify-between px-5 py-3 bg-slate-800/80 border-t border-slate-700/50">
          <p className="text-sm text-slate-400">Showing {filteredExpenses.length} expenses</p>
          <div className="flex items-center gap-6 text-sm">
            <div><span className="text-slate-500">Direct Costs: </span><span className="font-semibold text-rose-400">{formatCurrency(filteredExpenses.filter(e => e.category === 'directCosts').reduce((s, e) => s + e.amount, 0))}</span></div>
            <div><span className="text-slate-500">Overhead: </span><span className="font-semibold text-amber-400">{formatCurrency(filteredExpenses.filter(e => e.category === 'overhead').reduce((s, e) => s + e.amount, 0))}</span></div>
            <div><span className="text-slate-500">Total: </span><span className="font-semibold text-slate-200">{formatCurrency(filteredExpenses.reduce((s, e) => s + e.amount, 0))}</span></div>
          </div>
        </div>
      </div>

      <AddExpenseModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} contractors={contractors} projects={projects}
        subcategories={subcategories} onAddSubcategory={handleAddSubcategory} onDeleteSubcategory={handleDeleteSubcategory} onSave={handleAddExpense} />
      <EditExpenseModal isOpen={!!editingExpense} expense={editingExpense} onClose={() => setEditingExpense(null)} contractors={contractors}
        projects={projects} subcategories={subcategories} onSave={handleUpdateExpense} />
    </div>
  )
}
