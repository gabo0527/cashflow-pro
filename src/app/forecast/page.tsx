'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  Calculator, TrendingUp, TrendingDown, DollarSign, Users, Clock,
  ChevronRight, ChevronDown, Plus, Trash2, Edit3, Save, X, Calendar,
  BarChart3, PieChart, Target, Zap, AlertTriangle, CheckCircle2,
  Building2, FolderOpen, Layers, Settings, RefreshCw, Download
} from 'lucide-react'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, LineChart, Line, Area, AreaChart, 
  Legend, ComposedChart, ReferenceLine
} from 'recharts'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/supabase'

// Supabase client
const supabase = createClient(
  'https://jmahfgpbtjeomuepfozf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYWhmZ3BidGplb211ZXBmb3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0OTAxNzcsImV4cCI6MjA4MTA2NjE3N30.3SVDvWCGIYYHV57BpKjpDJVCZLKzuRv8B_VietQDxUQ'
)

// ============ DESIGN SYSTEM ============
const COLORS = {
  primary: '#10b981', // Emerald
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  pink: '#ec4899',
  orange: '#f97316',
}

// ============ GLASSMORPHISM THEME ============
const THEME = {
  glass: 'bg-slate-900/70 backdrop-blur-xl',
  glassBorder: 'border-white/[0.08]',
  glassHover: 'hover:bg-white/[0.05]',
  textPrimary: 'text-white',
  textSecondary: 'text-slate-300',
  textMuted: 'text-slate-400',
}

// Category tags for CEO visibility
const CATEGORY_TAGS: Record<string, { label: string; color: string; bg: string }> = {
  revenue: { label: 'Revenue', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  labor: { label: 'Direct Cost', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  opex: { label: 'Operating Exp', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  overhead: { label: 'Overhead', color: 'text-purple-400', bg: 'bg-purple-500/20' },
  collections: { label: 'AR/Collections', color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  cash: { label: 'Cash', color: 'text-blue-400', bg: 'bg-blue-500/20' },
}

const CHART_COLORS = [COLORS.primary, COLORS.success, COLORS.purple, COLORS.cyan, COLORS.warning, COLORS.pink]

// ============ UTILITY FUNCTIONS ============
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

const formatNumber = (value: number, decimals = 1): string => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  }).format(value)
}

const formatPercent = (value: number): string => {
  return `${value.toFixed(1)}%`
}

// ============ TYPES ============
interface Assumption {
  id: string
  category: string
  name: string
  value: number
  type: 'currency' | 'percent' | 'number' | 'months'
  description?: string
  scenario?: 'base' | 'best' | 'worst'
}

interface PlannedItem {
  id: string
  type: 'hire' | 'expense' | 'revenue' | 'project'
  name: string
  amount: number
  startMonth: number // 0-indexed from current month
  recurring: boolean
  category?: string
  source?: string // Where this comes from (client name, expense type, etc.)
  tag?: string // Category tag for CEO visibility
}

// Source breakdown for transparency
interface SourceItem {
  id: string
  name: string
  amount: number
  percentage: number
  tag: string
  subItems?: { name: string; amount: number }[]
}

interface ForecastPeriod {
  month: string
  monthIndex: number
  revenue: number
  cogs: number
  grossProfit: number
  grossMargin: number
  opex: number
  overhead: number
  netIncome: number
  netMargin: number
  cashInflow: number
  cashOutflow: number
  netCash: number
  endingCash: number
}

// ============ DEFAULT ASSUMPTIONS ============
const DEFAULT_ASSUMPTIONS: Assumption[] = [
  // Revenue
  { id: 'base_revenue', category: 'revenue', name: 'Base Monthly Revenue', value: 50000, type: 'currency', description: 'Current average monthly revenue' },
  { id: 'revenue_growth', category: 'revenue', name: 'Monthly Growth Rate', value: 3, type: 'percent', description: 'Expected month-over-month growth' },
  { id: 'pipeline_value', category: 'revenue', name: 'Pipeline Value', value: 100000, type: 'currency', description: 'Total value of potential deals' },
  { id: 'pipeline_conversion', category: 'revenue', name: 'Pipeline Conversion Rate', value: 30, type: 'percent', description: 'Expected close rate on pipeline' },
  
  // Labor
  { id: 'current_labor', category: 'labor', name: 'Current Monthly Labor Cost', value: 25000, type: 'currency', description: 'Total payroll + benefits' },
  { id: 'labor_growth', category: 'labor', name: 'Labor Cost Growth', value: 2, type: 'percent', description: 'Annual increase for raises' },
  { id: 'utilization_target', category: 'labor', name: 'Target Utilization', value: 75, type: 'percent', description: 'Billable utilization goal' },
  { id: 'avg_bill_rate', category: 'labor', name: 'Average Bill Rate', value: 150, type: 'currency', description: 'Blended hourly rate' },
  
  // Operating Expenses
  { id: 'fixed_opex', category: 'opex', name: 'Fixed Operating Expenses', value: 8000, type: 'currency', description: 'Rent, insurance, software, etc.' },
  { id: 'variable_opex_rate', category: 'opex', name: 'Variable OpEx (% of Revenue)', value: 5, type: 'percent', description: 'Costs that scale with revenue' },
  
  // Overhead / G&A
  { id: 'overhead', category: 'overhead', name: 'Monthly Overhead / G&A', value: 5000, type: 'currency', description: 'Admin, accounting, legal, etc.' },
  
  // Collections
  { id: 'dso', category: 'collections', name: 'Days Sales Outstanding', value: 45, type: 'number', description: 'Average days to collect payment' },
  { id: 'collection_rate', category: 'collections', name: 'Collection Rate', value: 95, type: 'percent', description: 'Percentage of invoiced revenue collected' },
  
  // Cash
  { id: 'starting_cash', category: 'cash', name: 'Starting Cash Balance', value: 75000, type: 'currency', description: 'Current cash on hand' },
  { id: 'min_cash_threshold', category: 'cash', name: 'Minimum Cash Threshold', value: 25000, type: 'currency', description: 'Alert when cash falls below this' },
]

// ============ COMPONENTS ============

// Editable Input Field
function EditableInput({ 
  value, 
  onChange, 
  type = 'currency',
  className = ''
}: { 
  value: number
  onChange: (value: number) => void
  type?: 'currency' | 'percent' | 'number' | 'months'
  className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [tempValue, setTempValue] = useState(value.toString())

  const handleSave = () => {
    const parsed = parseFloat(tempValue)
    if (!isNaN(parsed)) {
      onChange(parsed)
    }
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') {
      setTempValue(value.toString())
      setEditing(false)
    }
  }

  const formatDisplay = () => {
    switch (type) {
      case 'currency': return formatCurrency(value)
      case 'percent': return `${value}%`
      case 'months': return `${value} mo`
      default: return formatNumber(value)
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        {type === 'currency' && <span className="text-slate-500">$</span>}
        <input
          type="number"
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
          className={`bg-white/[0.05] border border-emerald-500 rounded px-2 py-1 text-white text-sm w-24 focus:outline-none ${className}`}
        />
        {type === 'percent' && <span className="text-slate-500">%</span>}
      </div>
    )
  }

  return (
    <button 
      onClick={() => {
        setTempValue(value.toString())
        setEditing(true)
      }}
      className={`text-white font-semibold hover:text-emerald-400 hover:underline cursor-pointer ${className}`}
    >
      {formatDisplay()}
    </button>
  )
}

// Source Breakdown Component - Shows WHERE inputs come from
function SourceBreakdown({ 
  sources, 
  title,
  expanded,
  onToggle
}: { 
  sources: SourceItem[]
  title: string
  expanded: boolean
  onToggle: () => void
}) {
  if (sources.length === 0) return null

  return (
    <div className="mt-2">
      <button 
        onClick={onToggle}
        className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>View breakdown ({sources.length} sources)</span>
      </button>
      
      {expanded && (
        <div className="mt-2 ml-4 space-y-1.5 border-l-2 border-white/[0.08] pl-3">
          {sources.map((source, i) => (
            <div key={source.id || i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${CATEGORY_TAGS[source.tag]?.bg || 'bg-slate-700'} ${CATEGORY_TAGS[source.tag]?.color || 'text-slate-400'}`}>
                  {CATEGORY_TAGS[source.tag]?.label || source.tag}
                </span>
                <span className="text-slate-400">{source.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-500">{source.percentage.toFixed(1)}%</span>
                <span className="text-slate-300 font-medium">{formatCurrency(source.amount)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Enhanced Assumption Card with Source Attribution
function AssumptionCard({ 
  assumption, 
  onUpdate,
  sources = [],
  showSources = false
}: { 
  assumption: Assumption
  onUpdate: (id: string, value: number) => void
  sources?: SourceItem[]
  showSources?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const tag = CATEGORY_TAGS[assumption.category]
  
  return (
    <div className="py-3 border-b border-white/[0.05] last:border-0">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-200">{assumption.name}</p>
            {tag && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${tag.bg} ${tag.color}`}>
                {tag.label}
              </span>
            )}
          </div>
          {assumption.description && (
            <p className="text-xs text-slate-500 mt-0.5">{assumption.description}</p>
          )}
        </div>
        <EditableInput
          value={assumption.value}
          onChange={(value) => onUpdate(assumption.id, value)}
          type={assumption.type}
        />
      </div>
      
      {showSources && sources.length > 0 && (
        <SourceBreakdown 
          sources={sources} 
          title={assumption.name}
          expanded={expanded}
          onToggle={() => setExpanded(!expanded)}
        />
      )}
    </div>
  )
}

// Planned Item Row
function PlannedItemRow({ 
  item, 
  onUpdate, 
  onDelete 
}: { 
  item: PlannedItem
  onUpdate: (item: PlannedItem) => void
  onDelete: () => void
}) {
  const monthLabels = Array.from({ length: 24 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() + i)
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
  })

  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/[0.08]/50">
      <div className="flex-1">
        <input
          type="text"
          value={item.name}
          onChange={(e) => onUpdate({ ...item, name: e.target.value })}
          className="bg-transparent border-b border-transparent hover:border-white/[0.08] focus:border-emerald-500 text-slate-200 text-sm w-full focus:outline-none"
          placeholder="Item name"
        />
      </div>
      <div className="w-28">
        <EditableInput
          value={item.amount}
          onChange={(value) => onUpdate({ ...item, amount: value })}
          type="currency"
        />
      </div>
      <select
        value={item.startMonth}
        onChange={(e) => onUpdate({ ...item, startMonth: parseInt(e.target.value) })}
        className="bg-white/[0.05] border border-white/[0.08] rounded px-2 py-1 text-sm text-slate-200 w-28"
      >
        {monthLabels.map((label, i) => (
          <option key={i} value={i}>{label}</option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm text-slate-400">
        <input
          type="checkbox"
          checked={item.recurring}
          onChange={(e) => onUpdate({ ...item, recurring: e.target.checked })}
          className="rounded border-white/[0.08] bg-white/[0.05] text-blue-500 focus:ring-blue-500"
        />
        Recurring
      </label>
      <button onClick={onDelete} className="p-1 text-slate-500 hover:text-rose-400">
        <Trash2 size={16} />
      </button>
    </div>
  )
}

// Section Component
function Section({ 
  title, 
  icon: Icon, 
  children, 
  action,
  defaultExpanded = true
}: { 
  title: string
  icon: any
  children: React.ReactNode
  action?: React.ReactNode
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className="rounded-xl border border-white/[0.08] bg-slate-900/70 backdrop-blur-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.05] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon size={18} className="text-slate-400" />
          <span className="font-medium text-slate-200">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {action && <div onClick={(e) => e.stopPropagation()}>{action}</div>}
          {expanded ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-white/[0.05]">
          {children}
        </div>
      )}
    </div>
  )
}

// KPI Card
function KPICard({ 
  title, 
  value, 
  subtitle, 
  trend,
  color = 'blue' 
}: { 
  title: string
  value: string
  subtitle?: string
  trend?: number
  color?: 'blue' | 'green' | 'red' | 'amber' | 'purple'
}) {
  const colorClasses = {
    blue: 'text-blue-400',
    green: 'text-emerald-400',
    red: 'text-rose-400',
    amber: 'text-amber-400',
    purple: 'text-purple-400',
  }

  return (
    <div className="p-4 rounded-xl border border-white/[0.08] bg-slate-900/70 backdrop-blur-xl">
      <p className="text-xs font-medium text-slate-400">{title}</p>
      <p className={`text-2xl font-bold mt-1 ${colorClasses[color]}`}>{value}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      {trend !== undefined && (
        <p className={`text-xs mt-1 ${trend >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}% vs prior
        </p>
      )}
    </div>
  )
}

// ============ MAIN PAGE ============
export default function AssumptionsPage() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  
  // Assumptions state
  const [assumptions, setAssumptions] = useState<Assumption[]>(DEFAULT_ASSUMPTIONS)
  const [plannedHires, setPlannedHires] = useState<PlannedItem[]>([])
  const [plannedExpenses, setPlannedExpenses] = useState<PlannedItem[]>([])
  const [plannedRevenue, setPlannedRevenue] = useState<PlannedItem[]>([])
  
  // UI state
  const [forecastHorizon, setForecastHorizon] = useState<3 | 6 | 12 | 18 | 24>(12)
  const [scenario, setScenario] = useState<'base' | 'best' | 'worst'>('base')
  const [viewLevel, setViewLevel] = useState<'company' | 'client' | 'project'>('company')
  const [activeTab, setActiveTab] = useState<'inputs' | 'projections' | 'scenarios'>('inputs')

  // Historical data (would come from DB)
  const [historicalData, setHistoricalData] = useState<any>({})
  
  // SOURCE DATA for CEO visibility
  const [revenueByClient, setRevenueByClient] = useState<SourceItem[]>([])
  const [expensesByCategory, setExpensesByCategory] = useState<SourceItem[]>([])
  const [laborByMember, setLaborByMember] = useState<SourceItem[]>([])
  const [overheadBreakdown, setOverheadBreakdown] = useState<SourceItem[]>([])

  useEffect(() => {
    const loadData = async () => {
      try {
        const { user } = await getCurrentUser()
        if (!user) return

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single()

        if (profile?.company_id) {
          setCompanyId(profile.company_id)
          
          // Load saved assumptions from DB if they exist
          const { data: savedAssumptions } = await supabase
            .from('forecast_assumptions')
            .select('*')
            .eq('company_id', profile.company_id)
            .single()
          
          if (savedAssumptions?.data) {
            setAssumptions(savedAssumptions.data.assumptions || DEFAULT_ASSUMPTIONS)
            setPlannedHires(savedAssumptions.data.plannedHires || [])
            setPlannedExpenses(savedAssumptions.data.plannedExpenses || [])
            setPlannedRevenue(savedAssumptions.data.plannedRevenue || [])
          }

          // Load ALL source data for CEO visibility
          const [txRes, invRes, clientsRes, teamRes] = await Promise.all([
            supabase.from('transactions').select('*').eq('company_id', profile.company_id),
            supabase.from('invoices').select('*, clients(name)').eq('company_id', profile.company_id),
            supabase.from('clients').select('*').eq('company_id', profile.company_id),
            supabase.from('team_members').select('*').eq('company_id', profile.company_id).eq('status', 'active')
          ])
          
          const transactions = txRes.data || []
          const invoices = invRes.data || []
          const clients = clientsRes.data || []
          const teamMembers = teamRes.data || []

          // Calculate historical averages
          const revenue = transactions.filter(t => t.category === 'revenue').reduce((sum, t) => sum + (t.amount || 0), 0)
          const expenses = transactions.filter(t => ['opex', 'overhead', 'cogs'].includes(t.category)).reduce((sum, t) => sum + Math.abs(t.amount || 0), 0)
          setHistoricalData({ revenue, expenses, transactionCount: transactions.length })

          // BUILD SOURCE BREAKDOWNS FOR CEO
          
          // 1. Revenue by Client (from invoices)
          const clientRevenue: Record<string, number> = {}
          invoices.forEach(inv => {
            const clientName = (inv.clients as any)?.name || 'Unknown Client'
            clientRevenue[clientName] = (clientRevenue[clientName] || 0) + (inv.amount || 0)
          })
          const totalClientRevenue = Object.values(clientRevenue).reduce((a, b) => a + b, 0)
          const revSources: SourceItem[] = Object.entries(clientRevenue)
            .sort((a, b) => b[1] - a[1])
            .map(([name, amount]) => ({
              id: name,
              name,
              amount,
              percentage: totalClientRevenue > 0 ? (amount / totalClientRevenue) * 100 : 0,
              tag: 'revenue'
            }))
          setRevenueByClient(revSources)

          // 2. Expenses by Category
          const expenseCategories: Record<string, number> = {}
          transactions.filter(t => t.amount < 0 || ['opex', 'overhead', 'cogs'].includes(t.category))
            .forEach(t => {
              const cat = t.category || 'Uncategorized'
              expenseCategories[cat] = (expenseCategories[cat] || 0) + Math.abs(t.amount || 0)
            })
          const totalExpenses = Object.values(expenseCategories).reduce((a, b) => a + b, 0)
          const expSources: SourceItem[] = Object.entries(expenseCategories)
            .sort((a, b) => b[1] - a[1])
            .map(([name, amount]) => ({
              id: name,
              name: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' '),
              amount,
              percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
              tag: name === 'overhead' ? 'overhead' : 'opex'
            }))
          setExpensesByCategory(expSources)

          // 3. Labor by Team Member
          const totalLabor = teamMembers.reduce((sum, m) => sum + (m.cost_amount || 0), 0)
          const laborSources: SourceItem[] = teamMembers
            .filter(m => m.cost_amount > 0)
            .sort((a, b) => (b.cost_amount || 0) - (a.cost_amount || 0))
            .map(m => ({
              id: m.id,
              name: m.name,
              amount: m.cost_amount || 0,
              percentage: totalLabor > 0 ? ((m.cost_amount || 0) / totalLabor) * 100 : 0,
              tag: 'labor'
            }))
          setLaborByMember(laborSources)

          // 4. Overhead breakdown (filter overhead transactions)
          const overheadTx = transactions.filter(t => t.category === 'overhead' || t.category === 'g_and_a')
          const ohByDesc: Record<string, number> = {}
          overheadTx.forEach(t => {
            const desc = t.description || t.vendor || 'Other Overhead'
            ohByDesc[desc] = (ohByDesc[desc] || 0) + Math.abs(t.amount || 0)
          })
          const totalOH = Object.values(ohByDesc).reduce((a, b) => a + b, 0)
          const ohSources: SourceItem[] = Object.entries(ohByDesc)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10) // Top 10
            .map(([name, amount]) => ({
              id: name,
              name,
              amount,
              percentage: totalOH > 0 ? (amount / totalOH) * 100 : 0,
              tag: 'overhead'
            }))
          setOverheadBreakdown(ohSources)
        }
      } catch (error) {
        console.error('Error loading assumptions:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Get assumption value helper
  const getAssumption = (id: string): number => {
    return assumptions.find(a => a.id === id)?.value || 0
  }

  // Update assumption
  const updateAssumption = (id: string, value: number) => {
    setAssumptions(prev => prev.map(a => a.id === id ? { ...a, value } : a))
  }

  // Scenario multipliers
  const scenarioMultipliers = useMemo(() => {
    switch (scenario) {
      case 'best':
        return { revenue: 1.2, expenses: 0.9, growth: 1.5 }
      case 'worst':
        return { revenue: 0.8, expenses: 1.1, growth: 0.5 }
      default:
        return { revenue: 1, expenses: 1, growth: 1 }
    }
  }, [scenario])

  // Generate forecast data
  const forecastData = useMemo((): ForecastPeriod[] => {
    const data: ForecastPeriod[] = []
    const mult = scenarioMultipliers
    
    let currentCash = getAssumption('starting_cash')
    const baseRevenue = getAssumption('base_revenue') * mult.revenue
    const revenueGrowth = (getAssumption('revenue_growth') / 100) * mult.growth
    const laborCost = getAssumption('current_labor') * mult.expenses
    const laborGrowth = getAssumption('labor_growth') / 100 / 12 // Monthly
    const fixedOpex = getAssumption('fixed_opex') * mult.expenses
    const variableOpexRate = getAssumption('variable_opex_rate') / 100
    const overhead = getAssumption('overhead') * mult.expenses
    const dso = getAssumption('dso')
    const collectionRate = getAssumption('collection_rate') / 100

    for (let i = 0; i < forecastHorizon; i++) {
      const date = new Date()
      date.setMonth(date.getMonth() + i)
      const monthLabel = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })

      // Calculate revenue with growth
      let monthRevenue = baseRevenue * Math.pow(1 + revenueGrowth, i)
      
      // Add planned revenue items
      plannedRevenue.forEach(item => {
        if (item.startMonth <= i && (item.recurring || item.startMonth === i)) {
          monthRevenue += item.amount
        }
      })

      // Calculate labor costs with growth and planned hires
      let monthLabor = laborCost * Math.pow(1 + laborGrowth, i)
      plannedHires.forEach(item => {
        if (item.startMonth <= i && (item.recurring || item.startMonth === i)) {
          monthLabor += item.amount
        }
      })

      // COGS (assume labor is primary COGS for service business)
      const cogs = monthLabor * 0.7 // 70% of labor allocated to COGS

      // Operating expenses
      let monthOpex = fixedOpex + (monthRevenue * variableOpexRate)
      plannedExpenses.forEach(item => {
        if (item.startMonth <= i && (item.recurring || item.startMonth === i)) {
          monthOpex += item.amount
        }
      })

      // Calculate P&L
      const grossProfit = monthRevenue - cogs
      const grossMargin = monthRevenue > 0 ? (grossProfit / monthRevenue) * 100 : 0
      const operatingIncome = grossProfit - monthOpex
      const netIncome = operatingIncome - overhead
      const netMargin = monthRevenue > 0 ? (netIncome / monthRevenue) * 100 : 0

      // Cash flow (simplified - accounts for DSO delay)
      const cashInflow = i === 0 ? monthRevenue * 0.5 : monthRevenue * collectionRate
      const cashOutflow = cogs + monthOpex + overhead
      const netCash = cashInflow - cashOutflow
      currentCash += netCash

      data.push({
        month: monthLabel,
        monthIndex: i,
        revenue: monthRevenue,
        cogs,
        grossProfit,
        grossMargin,
        opex: monthOpex,
        overhead,
        netIncome,
        netMargin,
        cashInflow,
        cashOutflow,
        netCash,
        endingCash: currentCash
      })
    }

    return data
  }, [assumptions, plannedHires, plannedExpenses, plannedRevenue, forecastHorizon, scenarioMultipliers])

  // Summary KPIs
  const summaryKPIs = useMemo(() => {
    if (forecastData.length === 0) return null

    const totalRevenue = forecastData.reduce((sum, d) => sum + d.revenue, 0)
    const totalNetIncome = forecastData.reduce((sum, d) => sum + d.netIncome, 0)
    const avgGrossMargin = forecastData.reduce((sum, d) => sum + d.grossMargin, 0) / forecastData.length
    const endingCash = forecastData[forecastData.length - 1]?.endingCash || 0
    const minCash = Math.min(...forecastData.map(d => d.endingCash))
    const minCashMonth = forecastData.find(d => d.endingCash === minCash)?.month || ''
    
    // Runway calculation
    const avgBurn = forecastData.filter(d => d.netCash < 0).reduce((sum, d) => sum + Math.abs(d.netCash), 0) / 
                    Math.max(1, forecastData.filter(d => d.netCash < 0).length)
    const runway = avgBurn > 0 ? getAssumption('starting_cash') / avgBurn : 99

    // Break-even
    const breakEvenMonth = forecastData.findIndex(d => d.netIncome > 0)

    return {
      totalRevenue,
      totalNetIncome,
      avgGrossMargin,
      endingCash,
      minCash,
      minCashMonth,
      runway,
      breakEvenMonth: breakEvenMonth >= 0 ? forecastData[breakEvenMonth].month : 'N/A'
    }
  }, [forecastData])

  // Expense breakdown for pie chart
  const expenseBreakdown = useMemo(() => {
    const avgMonth = forecastData[Math.floor(forecastData.length / 2)]
    if (!avgMonth) return []

    return [
      { name: 'Labor/COGS', value: avgMonth.cogs, color: COLORS.primary },
      { name: 'Operating Expenses', value: avgMonth.opex, color: COLORS.warning },
      { name: 'Overhead/G&A', value: avgMonth.overhead, color: COLORS.purple },
    ]
  }, [forecastData])

  // Add planned item handlers
  const addPlannedHire = () => {
    setPlannedHires(prev => [...prev, {
      id: `hire_${Date.now()}`,
      type: 'hire',
      name: 'New Hire',
      amount: 5000,
      startMonth: 3,
      recurring: true
    }])
  }

  const addPlannedExpense = () => {
    setPlannedExpenses(prev => [...prev, {
      id: `expense_${Date.now()}`,
      type: 'expense',
      name: 'New Expense',
      amount: 1000,
      startMonth: 1,
      recurring: true
    }])
  }

  const addPlannedRevenue = () => {
    setPlannedRevenue(prev => [...prev, {
      id: `revenue_${Date.now()}`,
      type: 'revenue',
      name: 'New Client/Project',
      amount: 10000,
      startMonth: 2,
      recurring: true
    }])
  }

  // Save assumptions
  const saveAssumptions = async () => {
    if (!companyId) return
    
    try {
      await supabase
        .from('forecast_assumptions')
        .upsert({
          company_id: companyId,
          data: {
            assumptions,
            plannedHires,
            plannedExpenses,
            plannedRevenue
          },
          updated_at: new Date().toISOString()
        })
      alert('Assumptions saved!')
    } catch (error) {
      console.error('Error saving:', error)
      alert('Error saving assumptions')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Forecast</h1>
          <p className="text-sm text-slate-400 mt-1">Build cash flow models and financial projections</p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={saveAssumptions}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors"
          >
            <Save size={16} />
            Save
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-slate-200 text-sm font-medium transition-colors">
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl border border-white/[0.08] bg-slate-900/70 backdrop-blur-xl">
        {/* Forecast Horizon */}
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-slate-400" />
          <span className="text-sm text-slate-400">Horizon:</span>
          <div className="flex bg-white/[0.05] rounded-lg p-1">
            {([3, 6, 12, 18, 24] as const).map((h) => (
              <button
                key={h}
                onClick={() => setForecastHorizon(h)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  forecastHorizon === h 
                    ? 'bg-emerald-500 text-white' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {h}M
              </button>
            ))}
          </div>
        </div>

        {/* Scenario */}
        <div className="flex items-center gap-2 pl-4 border-l border-white/[0.08]">
          <Layers size={18} className="text-slate-400" />
          <span className="text-sm text-slate-400">Scenario:</span>
          <div className="flex bg-white/[0.05] rounded-lg p-1">
            {(['worst', 'base', 'best'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScenario(s)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                  scenario === s 
                    ? s === 'best' ? 'bg-emerald-500 text-white' :
                      s === 'worst' ? 'bg-rose-500 text-white' :
                      'bg-emerald-500 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* View Level */}
        <div className="flex items-center gap-2 pl-4 border-l border-white/[0.08]">
          <Target size={18} className="text-slate-400" />
          <span className="text-sm text-slate-400">Level:</span>
          <select
            value={viewLevel}
            onChange={(e) => setViewLevel(e.target.value as any)}
            className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-slate-200"
          >
            <option value="company">Company</option>
            <option value="client">By Client</option>
            <option value="project">By Project</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/[0.08] pb-2">
        {([
          { id: 'inputs', label: 'Inputs' },
          { id: 'projections', label: 'Projections' },
          { id: 'scenarios', label: 'Scenarios' }
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-white/[0.05] text-white border-b-2 border-emerald-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'inputs' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Inputs */}
          <Section title="Revenue" icon={TrendingUp}>
            <div className="pt-3">
              {assumptions.filter(a => a.category === 'revenue').map(a => (
                <AssumptionCard 
                  key={a.id} 
                  assumption={a} 
                  onUpdate={updateAssumption}
                  sources={a.id === 'base_revenue' ? revenueByClient : []}
                  showSources={a.id === 'base_revenue' && revenueByClient.length > 0}
                />
              ))}
              {revenueByClient.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <p className="text-xs text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 size={14} />
                    Revenue sourced from {revenueByClient.length} clients • Click "View breakdown" above to see details
                  </p>
                </div>
              )}
            </div>
          </Section>

          {/* Labor & Team */}
          <Section title="Labor & Team" icon={Users}>
            <div className="pt-3">
              {assumptions.filter(a => a.category === 'labor').map(a => (
                <AssumptionCard 
                  key={a.id} 
                  assumption={a} 
                  onUpdate={updateAssumption}
                  sources={a.id === 'current_labor' ? laborByMember : []}
                  showSources={a.id === 'current_labor' && laborByMember.length > 0}
                />
              ))}
              {laborByMember.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <p className="text-xs text-blue-400 flex items-center gap-2">
                    <Users size={14} />
                    {laborByMember.length} active team members • Tagged as Direct Cost
                  </p>
                </div>
              )}
            </div>
          </Section>

          {/* Operating Expenses */}
          <Section title="Operating Expenses" icon={TrendingDown}>
            <div className="pt-3">
              {assumptions.filter(a => a.category === 'opex').map(a => (
                <AssumptionCard 
                  key={a.id} 
                  assumption={a} 
                  onUpdate={updateAssumption}
                  sources={a.id === 'fixed_opex' ? expensesByCategory.filter(e => e.tag === 'opex') : []}
                  showSources={a.id === 'fixed_opex' && expensesByCategory.length > 0}
                />
              ))}
              {expensesByCategory.filter(e => e.tag === 'opex').length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <p className="text-xs text-amber-400 flex items-center gap-2">
                    <AlertTriangle size={14} />
                    {expensesByCategory.filter(e => e.tag === 'opex').length} expense categories • Tagged as Operating Expenses
                  </p>
                </div>
              )}
            </div>
          </Section>

          {/* Overhead */}
          <Section title="Overhead / G&A" icon={Building2}>
            <div className="pt-3">
              {assumptions.filter(a => a.category === 'overhead').map(a => (
                <AssumptionCard 
                  key={a.id} 
                  assumption={a} 
                  onUpdate={updateAssumption}
                  sources={overheadBreakdown}
                  showSources={overheadBreakdown.length > 0}
                />
              ))}
              {overheadBreakdown.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <p className="text-xs text-purple-400 flex items-center gap-2">
                    <Building2 size={14} />
                    {overheadBreakdown.length} overhead items • Tagged as G&A/Overhead
                  </p>
                </div>
              )}
            </div>
          </Section>

          {/* Collections */}
          <Section title="AR & Collections" icon={Clock}>
            <div className="pt-3">
              {assumptions.filter(a => a.category === 'collections').map(a => (
                <AssumptionCard key={a.id} assumption={a} onUpdate={updateAssumption} />
              ))}
            </div>
          </Section>

          {/* Cash */}
          <Section title="Cash Position" icon={DollarSign}>
            <div className="pt-3">
              {assumptions.filter(a => a.category === 'cash').map(a => (
                <AssumptionCard key={a.id} assumption={a} onUpdate={updateAssumption} />
              ))}
            </div>
          </Section>

          {/* Planned Hires */}
          <Section 
            title="Planned Hires" 
            icon={Users}
            action={
              <button onClick={addPlannedHire} className="p-1 text-emerald-400 hover:text-emerald-300">
                <Plus size={18} />
              </button>
            }
          >
            <div className="pt-3">
              {plannedHires.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No planned hires. Click + to add.</p>
              ) : (
                plannedHires.map((item, i) => (
                  <PlannedItemRow
                    key={item.id}
                    item={item}
                    onUpdate={(updated) => setPlannedHires(prev => prev.map(h => h.id === item.id ? updated : h))}
                    onDelete={() => setPlannedHires(prev => prev.filter(h => h.id !== item.id))}
                  />
                ))
              )}
            </div>
          </Section>

          {/* Planned Revenue */}
          <Section 
            title="Planned Revenue (New Clients/Projects)" 
            icon={TrendingUp}
            action={
              <button onClick={addPlannedRevenue} className="p-1 text-emerald-400 hover:text-emerald-300">
                <Plus size={18} />
              </button>
            }
          >
            <div className="pt-3">
              {plannedRevenue.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No planned revenue items. Click + to add.</p>
              ) : (
                plannedRevenue.map((item) => (
                  <PlannedItemRow
                    key={item.id}
                    item={item}
                    onUpdate={(updated) => setPlannedRevenue(prev => prev.map(r => r.id === item.id ? updated : r))}
                    onDelete={() => setPlannedRevenue(prev => prev.filter(r => r.id !== item.id))}
                  />
                ))
              )}
            </div>
          </Section>

          {/* Planned Expenses */}
          <Section 
            title="Planned One-Time & Recurring Expenses" 
            icon={TrendingDown}
            action={
              <button onClick={addPlannedExpense} className="p-1 text-emerald-400 hover:text-emerald-300">
                <Plus size={18} />
              </button>
            }
            defaultExpanded={false}
          >
            <div className="pt-3">
              {plannedExpenses.length === 0 ? (
                <p className="text-sm text-slate-500 py-4 text-center">No planned expenses. Click + to add.</p>
              ) : (
                plannedExpenses.map((item) => (
                  <PlannedItemRow
                    key={item.id}
                    item={item}
                    onUpdate={(updated) => setPlannedExpenses(prev => prev.map(e => e.id === item.id ? updated : e))}
                    onDelete={() => setPlannedExpenses(prev => prev.filter(e => e.id !== item.id))}
                  />
                ))
              )}
            </div>
          </Section>
        </div>
      )}

      {activeTab === 'projections' && (
        <div className="space-y-6">
          {/* KPI Summary */}
          {summaryKPIs && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <KPICard
                title={`Total Revenue (${forecastHorizon}M)`}
                value={formatCurrency(summaryKPIs.totalRevenue)}
                color="green"
              />
              <KPICard
                title={`Net Income (${forecastHorizon}M)`}
                value={formatCurrency(summaryKPIs.totalNetIncome)}
                color={summaryKPIs.totalNetIncome >= 0 ? 'green' : 'red'}
              />
              <KPICard
                title="Avg Gross Margin"
                value={formatPercent(summaryKPIs.avgGrossMargin)}
                color={summaryKPIs.avgGrossMargin >= 40 ? 'green' : summaryKPIs.avgGrossMargin >= 20 ? 'amber' : 'red'}
              />
              <KPICard
                title="Ending Cash"
                value={formatCurrency(summaryKPIs.endingCash)}
                color={summaryKPIs.endingCash >= getAssumption('min_cash_threshold') ? 'green' : 'red'}
              />
              <KPICard
                title="Cash Runway"
                value={`${summaryKPIs.runway.toFixed(1)} mo`}
                color={summaryKPIs.runway >= 6 ? 'green' : summaryKPIs.runway >= 3 ? 'amber' : 'red'}
              />
              <KPICard
                title="Min Cash Point"
                value={formatCurrency(summaryKPIs.minCash)}
                subtitle={summaryKPIs.minCashMonth}
                color={summaryKPIs.minCash >= getAssumption('min_cash_threshold') ? 'blue' : 'red'}
              />
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* P&L Trend Chart */}
            <div className="lg:col-span-2 p-6 rounded-xl border border-white/[0.08] bg-slate-900/70 backdrop-blur-xl">
              <h3 className="font-medium text-slate-200 mb-4">Revenue & Net Income Forecast</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={forecastData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fill: '#94a3b8', fontSize: 11 }} 
                      axisLine={{ stroke: '#475569' }}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: '#94a3b8', fontSize: 11 }} 
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      labelStyle={{ color: '#f1f5f9' }}
                      formatter={(value: number) => [formatCurrency(value), '']}
                    />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill={COLORS.success} radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="netIncome" name="Net Income" stroke={COLORS.primary} strokeWidth={2} dot={{ r: 3 }} />
                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Expense Breakdown */}
            <div className="p-6 rounded-xl border border-white/[0.08] bg-slate-900/70 backdrop-blur-xl">
              <h3 className="font-medium text-slate-200 mb-4">Expense Breakdown</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={expenseBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {expenseBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                      formatter={(value: number) => [formatCurrency(value), '']}
                    />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2">
                {expenseBreakdown.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-400">{item.name}</span>
                    </div>
                    <span className="font-medium text-slate-200">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cash Flow Chart */}
          <div className="p-6 rounded-xl border border-white/[0.08] bg-slate-900/70 backdrop-blur-xl">
            <h3 className="font-medium text-slate-200 mb-4">Cash Position Forecast</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecastData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
                      <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fill: '#94a3b8', fontSize: 11 }} 
                    axisLine={{ stroke: '#475569' }}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fill: '#94a3b8', fontSize: 11 }} 
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    formatter={(value: number) => [formatCurrency(value), '']}
                  />
                  <ReferenceLine 
                    y={getAssumption('min_cash_threshold')} 
                    stroke={COLORS.warning} 
                    strokeDasharray="5 5"
                    label={{ value: 'Min Threshold', fill: COLORS.warning, fontSize: 10 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="endingCash" 
                    name="Cash Balance"
                    stroke={COLORS.primary} 
                    strokeWidth={2}
                    fill="url(#cashGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Forecast Table */}
          <div className="rounded-xl border border-white/[0.08] overflow-hidden">
            <div className="bg-slate-900/70 backdrop-blur-xl px-4 py-3 border-b border-white/[0.08]">
              <h3 className="font-medium text-slate-200">Projected P&L Detail</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.03]">
                    <th className="text-left px-4 py-3 font-medium text-slate-400 sticky left-0 bg-white/[0.03]">Month</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-400">Revenue</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-400">COGS</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-400">Gross Profit</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-400">GM %</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-400">OpEx</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-400">Net Income</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-400">Cash Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastData.map((row, i) => (
                    <tr key={i} className="border-t border-white/[0.08]/50 hover:bg-white/[0.03]">
                      <td className="px-4 py-3 font-medium text-slate-200 sticky left-0 bg-slate-900/50">{row.month}</td>
                      <td className="px-4 py-3 text-right text-emerald-400">{formatCurrency(row.revenue)}</td>
                      <td className="px-4 py-3 text-right text-rose-400">{formatCurrency(row.cogs)}</td>
                      <td className="px-4 py-3 text-right text-slate-200">{formatCurrency(row.grossProfit)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={row.grossMargin >= 40 ? 'text-emerald-400' : row.grossMargin >= 20 ? 'text-amber-400' : 'text-rose-400'}>
                          {formatPercent(row.grossMargin)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-rose-400">{formatCurrency(row.opex + row.overhead)}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        <span className={row.netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {formatCurrency(row.netIncome)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        <span className={row.endingCash >= getAssumption('min_cash_threshold') ? 'text-blue-400' : 'text-rose-400'}>
                          {formatCurrency(row.endingCash)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'scenarios' && (
        <div className="space-y-6">
          <div className="p-6 rounded-xl border border-white/[0.08] bg-slate-900/70 backdrop-blur-xl">
            <h3 className="font-medium text-slate-200 mb-4">Scenario Comparison</h3>
            <p className="text-sm text-slate-400 mb-6">
              Compare Base, Best, and Worst case scenarios side-by-side. Use these to stress-test your forecast and prepare for different outcomes.
            </p>
            
            {/* Scenario comparison table would go here */}
            <div className="grid grid-cols-3 gap-4">
              {(['worst', 'base', 'best'] as const).map((s) => {
                const mult = s === 'best' ? { revenue: 1.2, expenses: 0.9 } :
                             s === 'worst' ? { revenue: 0.8, expenses: 1.1 } :
                             { revenue: 1, expenses: 1 }
                const baseRev = getAssumption('base_revenue')
                const projectedRev = baseRev * mult.revenue * forecastHorizon
                const baseExp = getAssumption('current_labor') + getAssumption('fixed_opex') + getAssumption('overhead')
                const projectedExp = baseExp * mult.expenses * forecastHorizon

                return (
                  <div 
                    key={s}
                    className={`p-4 rounded-xl border ${
                      s === 'best' ? 'border-emerald-500/30 bg-emerald-500/5' :
                      s === 'worst' ? 'border-rose-500/30 bg-rose-500/5' :
                      'border-emerald-500/30 bg-blue-500/5'
                    }`}
                  >
                    <h4 className={`font-semibold capitalize mb-4 ${
                      s === 'best' ? 'text-emerald-400' :
                      s === 'worst' ? 'text-rose-400' :
                      'text-blue-400'
                    }`}>
                      {s} Case
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Revenue</span>
                        <span className="text-slate-200">{formatCurrency(projectedRev)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Expenses</span>
                        <span className="text-slate-200">{formatCurrency(projectedExp)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-white/[0.08]">
                        <span className="text-slate-400">Net</span>
                        <span className={projectedRev - projectedExp >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {formatCurrency(projectedRev - projectedExp)}
                        </span>
                      </div>
                    </div>
                    <p className="text-xs text-slate-500 mt-4">
                      {s === 'best' ? 'Revenue +20%, Costs -10%' :
                       s === 'worst' ? 'Revenue -20%, Costs +10%' :
                       'Based on current inputs'}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* What-If Analysis */}
          <div className="p-6 rounded-xl border border-white/[0.08] bg-slate-900/70 backdrop-blur-xl">
            <h3 className="font-medium text-slate-200 mb-4">What-If Analysis</h3>
            <p className="text-sm text-slate-400 mb-4">
              Quickly test the impact of adding new revenue or expenses to your projections.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-slate-300">If I add a new client worth...</h4>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">$</span>
                  <input
                    type="number"
                    placeholder="10000"
                    className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-slate-200 w-32"
                  />
                  <span className="text-slate-500">/month</span>
                </div>
                <p className="text-sm text-emerald-400">
                  → {forecastHorizon}-month impact: +{formatCurrency(10000 * forecastHorizon)} revenue
                </p>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-slate-300">If I hire someone at...</h4>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">$</span>
                  <input
                    type="number"
                    placeholder="6000"
                    className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-slate-200 w-32"
                  />
                  <span className="text-slate-500">/month</span>
                </div>
                <p className="text-sm text-rose-400">
                  → {forecastHorizon}-month impact: -{formatCurrency(6000 * forecastHorizon)} cost
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
