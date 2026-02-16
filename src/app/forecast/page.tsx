'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  TrendingUp, TrendingDown, DollarSign, Users, Clock,
  ChevronRight, ChevronDown, Plus, Trash2, Save, X, Calendar,
  Target, Layers, RefreshCw, Download, Edit3, Tag,
  Building2, AlertTriangle, CheckCircle2, Palette, GripVertical
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Area, AreaChart, ComposedChart, ReferenceLine, Legend
} from 'recharts'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/supabase'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// ============ CHART PALETTE ============
const CHART = {
  teal: '#0d9488', blue: '#3b82f6', slate: '#64748b', rose: '#f43f5e',
  amber: '#f59e0b', emerald: '#10b981', purple: '#8b5cf6', cyan: '#06b6d4',
  grid: 'rgba(255,255,255,0.04)', axis: '#475569',
}

// ============ TYPES ============
type PLSection = 'revenue' | 'direct_cost' | 'opex' | 'overhead' | 'cash_adjustment'

interface ForecastCategory {
  id: string
  name: string
  section: PLSection
  color: string // tailwind color key
}

interface ForecastLineItem {
  id: string
  categoryId: string
  name: string
  amount: number
  frequency: 'monthly' | 'one_time' | 'quarterly'
  startMonth: number // 0 = current month
  endMonth: number | null // null = ongoing
  growthRate: number // annual %, 0 = flat
  notes: string
}

interface ForecastPeriod {
  month: string
  monthIndex: number
  revenue: number
  directCosts: number
  grossProfit: number
  grossMargin: number
  opex: number
  overhead: number
  netIncome: number
  netMargin: number
  endingCash: number
  // For drilldown
  revenueItems: { name: string; category: string; amount: number }[]
  costItems: { name: string; category: string; amount: number }[]
}

// ============ P&L SECTION CONFIG ============
const PL_SECTIONS: Record<PLSection, { label: string; shortLabel: string; color: string; textColor: string; bgColor: string; borderColor: string; sign: 1 | -1 }> = {
  revenue: { label: 'Revenue', shortLabel: 'Rev', color: 'emerald', textColor: 'text-emerald-400', bgColor: 'bg-emerald-500/15', borderColor: 'border-emerald-500/20', sign: 1 },
  direct_cost: { label: 'Direct Cost (COGS)', shortLabel: 'COGS', color: 'blue', textColor: 'text-blue-400', bgColor: 'bg-blue-500/15', borderColor: 'border-blue-500/20', sign: -1 },
  opex: { label: 'Operating Expense', shortLabel: 'OpEx', color: 'amber', textColor: 'text-amber-400', bgColor: 'bg-amber-500/15', borderColor: 'border-amber-500/20', sign: -1 },
  overhead: { label: 'Overhead / G&A', shortLabel: 'OH', color: 'purple', textColor: 'text-purple-400', bgColor: 'bg-purple-500/15', borderColor: 'border-purple-500/20', sign: -1 },
  cash_adjustment: { label: 'Cash Adjustment', shortLabel: 'Cash', color: 'cyan', textColor: 'text-cyan-400', bgColor: 'bg-cyan-500/15', borderColor: 'border-cyan-500/20', sign: 1 },
}

// ============ DEFAULTS ============
const DEFAULT_CATEGORIES: ForecastCategory[] = [
  { id: 'cat_client_rev', name: 'Client Revenue', section: 'revenue', color: 'emerald' },
  { id: 'cat_labor', name: 'Labor / Contractors', section: 'direct_cost', color: 'blue' },
  { id: 'cat_software', name: 'Software & Tools', section: 'opex', color: 'amber' },
  { id: 'cat_insurance', name: 'Insurance & Compliance', section: 'opex', color: 'amber' },
  { id: 'cat_admin', name: 'Admin & Operations', section: 'overhead', color: 'purple' },
  { id: 'cat_professional', name: 'Professional Services', section: 'overhead', color: 'purple' },
]

const DEFAULT_LINE_ITEMS: ForecastLineItem[] = []

// ============ SCENARIO VARIANCE MODEL ============
// Based on institutional FP&A standards (cone of uncertainty)
// Revenue bands wider than expense bands — services firms control costs better than revenue
const VARIANCE_BANDS: Record<number, { revUp: number; revDown: number; expUp: number; expDown: number; label: string }> = {
  3:  { revUp: 0.05, revDown: 0.05, expUp: 0.03, expDown: 0.03, label: 'Near-term: high visibility, mostly contracted' },
  6:  { revUp: 0.10, revDown: 0.10, expUp: 0.06, expDown: 0.06, label: 'Pipeline uncertainty grows, some contracts TBD' },
  12: { revUp: 0.15, revDown: 0.15, expUp: 0.10, expDown: 0.10, label: 'Annual planning horizon, standard FP&A range' },
  18: { revUp: 0.20, revDown: 0.20, expUp: 0.12, expDown: 0.12, label: 'Beyond current pipeline, higher uncertainty' },
  24: { revUp: 0.25, revDown: 0.25, expUp: 0.15, expDown: 0.15, label: 'Strategic horizon, maximum spread' },
}

// ============ UTILITY ============
const fmtCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
const fmtPct = (v: number) => `${v.toFixed(1)}%`

const inputClass = "w-full bg-slate-800/60 border border-slate-800/80 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500/30 focus:border-teal-600/50 transition-colors"
const selectClass = "bg-slate-800/60 border border-slate-800/80 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500/30 focus:border-teal-600/50 cursor-pointer transition-colors"

const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

// Month labels from current month
const getMonthLabels = (count: number) => Array.from({ length: count }, (_, i) => {
  const d = new Date(); d.setMonth(d.getMonth() + i)
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
})

// ============ CHART TOOLTIP ============
const ChartTooltip = ({ active, payload, label, formatter }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#111827] border border-slate-800/80 rounded-lg px-3 py-2 shadow-xl">
      <p className="text-[11px] text-slate-500 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {formatter ? formatter(entry.value) : entry.value}
        </p>
      ))}
    </div>
  )
}

// ============ MAIN PAGE ============
export default function ForecastPage() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Model state
  const [startingCash, setStartingCash] = useState(75000)
  const [minCashThreshold, setMinCashThreshold] = useState(25000)
  const [categories, setCategories] = useState<ForecastCategory[]>(DEFAULT_CATEGORIES)
  const [lineItems, setLineItems] = useState<ForecastLineItem[]>(DEFAULT_LINE_ITEMS)

  // UI state
  const [forecastHorizon, setForecastHorizon] = useState<3 | 6 | 12 | 18 | 24>(12)
  const [activeTab, setActiveTab] = useState<'assumptions' | 'projections' | 'scenarios'>('assumptions')
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ForecastCategory | null>(null)
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null)

  // Category form
  const [catForm, setCatForm] = useState({ name: '', section: 'revenue' as PLSection })

  // Historical actuals for comparison
  const [historicalMonths, setHistoricalMonths] = useState<{ month: string; revenue: number; directCosts: number; opex: number; overhead: number; netIncome: number }[]>([])
  const [comparisonPeriod, setComparisonPeriod] = useState<3 | 6 | 12>(3)

  // ============ LOAD DATA ============
  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await getCurrentUser()
        const user = result?.user
        if (!user) { setLoading(false); return }

        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
        if (!profile?.company_id) { setLoading(false); return }
        setCompanyId(profile.company_id)

        // Load saved forecast model
        const { data: saved } = await supabase
          .from('forecast_assumptions')
          .select('*')
          .eq('company_id', profile.company_id)
          .single()

        if (saved?.data) {
          const d = saved.data
          if (d.startingCash !== undefined) setStartingCash(d.startingCash)
          if (d.minCashThreshold !== undefined) setMinCashThreshold(d.minCashThreshold)
          if (d.categories?.length) setCategories(d.categories)
          if (d.lineItems?.length) setLineItems(d.lineItems)
          if (d.forecastHorizon) setForecastHorizon(d.forecastHorizon)
        }

        // Load historical actuals for comparison (last 12 months)
        const twelveMonthsAgo = new Date()
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
        const cutoff = twelveMonthsAgo.toISOString().slice(0, 10)

        const [invRes, billsRes, expRes] = await Promise.all([
          supabase.from('invoices').select('invoice_date, amount').eq('company_id', profile.company_id).gte('invoice_date', cutoff),
          supabase.from('bills').select('date, amount').eq('company_id', profile.company_id).gte('date', cutoff),
          supabase.from('expenses').select('date, amount, category').eq('company_id', profile.company_id).gte('date', cutoff),
        ])

        // Bucket into months
        const monthBuckets: Record<string, { revenue: number; directCosts: number; opex: number; overhead: number }> = {}
        const getKey = (dateStr: string) => {
          const d = new Date(dateStr)
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        }
        const ensureBucket = (key: string) => {
          if (!monthBuckets[key]) monthBuckets[key] = { revenue: 0, directCosts: 0, opex: 0, overhead: 0 }
        }

        (invRes.data || []).forEach(inv => {
          const key = getKey(inv.invoice_date)
          ensureBucket(key)
          monthBuckets[key].revenue += parseFloat(inv.amount) || 0
        })
        ;(billsRes.data || []).forEach(bill => {
          const key = getKey(bill.date)
          ensureBucket(key)
          monthBuckets[key].directCosts += parseFloat(bill.amount) || 0
        })
        ;(expRes.data || []).forEach(exp => {
          const key = getKey(exp.date)
          ensureBucket(key)
          const cat = (exp.category || '').toLowerCase()
          if (cat.includes('overhead') || cat.includes('admin') || cat.includes('g&a')) {
            monthBuckets[key].overhead += Math.abs(parseFloat(exp.amount) || 0)
          } else {
            monthBuckets[key].opex += Math.abs(parseFloat(exp.amount) || 0)
          }
        })

        const sorted = Object.entries(monthBuckets)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([key, data]) => {
            const d = new Date(key + '-01')
            const month = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
            const netIncome = data.revenue - data.directCosts - data.opex - data.overhead
            return { month, ...data, netIncome }
          })
        setHistoricalMonths(sorted)
      } catch (error) {
        console.error('Error loading forecast:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // ============ SAVE ============
  const saveModel = useCallback(async () => {
    if (!companyId) return
    setSaving(true)
    try {
      await supabase.from('forecast_assumptions').upsert({
        company_id: companyId,
        data: { startingCash, minCashThreshold, categories, lineItems, forecastHorizon },
        updated_at: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error saving:', error)
    } finally {
      setSaving(false)
    }
  }, [companyId, startingCash, minCashThreshold, categories, lineItems, forecastHorizon])

  // ============ CATEGORY HANDLERS ============
  const openAddCategory = () => {
    setEditingCategory(null)
    setCatForm({ name: '', section: 'revenue' })
    setShowCategoryModal(true)
  }

  const openEditCategory = (cat: ForecastCategory) => {
    setEditingCategory(cat)
    setCatForm({ name: cat.name, section: cat.section })
    setShowCategoryModal(true)
  }

  const saveCategory = () => {
    if (!catForm.name.trim()) return
    const sectionConfig = PL_SECTIONS[catForm.section]
    if (editingCategory) {
      setCategories(prev => prev.map(c => c.id === editingCategory.id ? { ...c, name: catForm.name, section: catForm.section, color: sectionConfig.color } : c))
    } else {
      setCategories(prev => [...prev, { id: `cat_${genId()}`, name: catForm.name, section: catForm.section, color: sectionConfig.color }])
    }
    setShowCategoryModal(false)
  }

  const deleteCategory = (id: string) => {
    if (!confirm('Delete this category? All line items in it will also be removed.')) return
    setCategories(prev => prev.filter(c => c.id !== id))
    setLineItems(prev => prev.filter(li => li.categoryId !== id))
  }

  // ============ LINE ITEM HANDLERS ============
  const addLineItem = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId)
    const section = cat ? PL_SECTIONS[cat.section] : null
    setLineItems(prev => [...prev, {
      id: `li_${genId()}`,
      categoryId,
      name: '',
      amount: 0,
      frequency: 'monthly',
      startMonth: 0,
      endMonth: null,
      growthRate: 0,
      notes: '',
    }])
  }

  const updateLineItem = (id: string, updates: Partial<ForecastLineItem>) => {
    setLineItems(prev => prev.map(li => li.id === id ? { ...li, ...updates } : li))
  }

  const deleteLineItem = (id: string) => {
    setLineItems(prev => prev.filter(li => li.id !== id))
  }

  // ============ FORECAST ENGINE ============
  const monthLabels = useMemo(() => getMonthLabels(forecastHorizon), [forecastHorizon])

  const buildForecast = useCallback((revMult = 1, expMult = 1): ForecastPeriod[] => {
    const data: ForecastPeriod[] = []
    let runningCash = startingCash

    for (let m = 0; m < forecastHorizon; m++) {
      let revenue = 0, directCosts = 0, opex = 0, overhead = 0, cashAdj = 0
      const revenueItems: { name: string; category: string; amount: number }[] = []
      const costItems: { name: string; category: string; amount: number }[] = []

      lineItems.forEach(li => {
        const cat = categories.find(c => c.id === li.categoryId)
        if (!cat) return

        // Check if active this month
        if (li.startMonth > m) return
        if (li.endMonth !== null && li.endMonth < m) return

        // Check frequency
        let active = false
        if (li.frequency === 'monthly') active = true
        else if (li.frequency === 'one_time') active = li.startMonth === m
        else if (li.frequency === 'quarterly') active = (m - li.startMonth) % 3 === 0

        if (!active) return

        // Apply growth (compounding monthly from annual rate)
        const monthsElapsed = m - li.startMonth
        const monthlyGrowth = Math.pow(1 + (li.growthRate / 100), monthsElapsed / 12)
        let amount = li.amount * monthlyGrowth

        // Apply scenario multiplier
        if (cat.section === 'revenue') {
          amount *= revMult
          revenue += amount
          revenueItems.push({ name: li.name || 'Unnamed', category: cat.name, amount })
        } else if (cat.section === 'direct_cost') {
          amount *= expMult
          directCosts += amount
          costItems.push({ name: li.name || 'Unnamed', category: cat.name, amount })
        } else if (cat.section === 'opex') {
          amount *= expMult
          opex += amount
          costItems.push({ name: li.name || 'Unnamed', category: cat.name, amount })
        } else if (cat.section === 'overhead') {
          amount *= expMult
          overhead += amount
          costItems.push({ name: li.name || 'Unnamed', category: cat.name, amount })
        } else if (cat.section === 'cash_adjustment') {
          cashAdj += amount
        }
      })

      const grossProfit = revenue - directCosts
      const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0
      const netIncome = grossProfit - opex - overhead
      const netMargin = revenue > 0 ? (netIncome / revenue) * 100 : 0
      runningCash += netIncome + cashAdj

      data.push({
        month: monthLabels[m] || `M${m + 1}`,
        monthIndex: m,
        revenue, directCosts, grossProfit, grossMargin,
        opex, overhead, netIncome, netMargin, endingCash: runningCash,
        revenueItems, costItems,
      })
    }
    return data
  }, [lineItems, categories, startingCash, forecastHorizon, monthLabels])

  // Base, Best, Worst forecasts
  const baseData = useMemo(() => buildForecast(1, 1), [buildForecast])
  const variance = VARIANCE_BANDS[forecastHorizon] || VARIANCE_BANDS[12]
  const bestData = useMemo(() => buildForecast(1 + variance.revUp, 1 - variance.expDown), [buildForecast, variance])
  const worstData = useMemo(() => buildForecast(1 - variance.revDown, 1 + variance.expUp), [buildForecast, variance])

  // KPIs
  const kpis = useMemo(() => {
    if (!baseData.length) return null
    const totalRev = baseData.reduce((s, d) => s + d.revenue, 0)
    const totalNet = baseData.reduce((s, d) => s + d.netIncome, 0)
    const avgGM = baseData.reduce((s, d) => s + d.grossMargin, 0) / baseData.length
    const endCash = baseData[baseData.length - 1]?.endingCash || 0
    const minCash = Math.min(...baseData.map(d => d.endingCash))
    const minCashMonth = baseData.find(d => d.endingCash === minCash)?.month || ''
    const avgBurn = baseData.filter(d => d.netIncome < 0)
    const monthlyBurn = avgBurn.length > 0 ? avgBurn.reduce((s, d) => s + Math.abs(d.netIncome), 0) / avgBurn.length : 0
    const runway = monthlyBurn > 0 ? startingCash / monthlyBurn : 99
    return { totalRev, totalNet, avgGM, endCash, minCash, minCashMonth, runway }
  }, [baseData, startingCash])

  // Chart data with scenario bands
  const chartData = useMemo(() => baseData.map((b, i) => ({
    month: b.month,
    revenue: b.revenue,
    netIncome: b.netIncome,
    endingCash: b.endingCash,
    bestCash: bestData[i]?.endingCash || 0,
    worstCash: worstData[i]?.endingCash || 0,
    bestNet: bestData[i]?.netIncome || 0,
    worstNet: worstData[i]?.netIncome || 0,
  })), [baseData, bestData, worstData])

  // ============ HISTORICAL AVERAGES ============
  const historicalAverages = useMemo(() => {
    if (historicalMonths.length === 0) return null
    const slice = historicalMonths.slice(-comparisonPeriod)
    if (slice.length === 0) return null
    const n = slice.length
    const avgRevenue = slice.reduce((s, m) => s + m.revenue, 0) / n
    const avgDirectCosts = slice.reduce((s, m) => s + m.directCosts, 0) / n
    const avgOpex = slice.reduce((s, m) => s + m.opex, 0) / n
    const avgOverhead = slice.reduce((s, m) => s + m.overhead, 0) / n
    const avgNetIncome = slice.reduce((s, m) => s + m.netIncome, 0) / n
    const totalExpenses = avgDirectCosts + avgOpex + avgOverhead
    const grossProfit = avgRevenue - avgDirectCosts
    const grossMargin = avgRevenue > 0 ? (grossProfit / avgRevenue) * 100 : 0
    return { avgRevenue, avgDirectCosts, avgOpex, avgOverhead, avgNetIncome, totalExpenses, grossProfit, grossMargin, monthCount: n }
  }, [historicalMonths, comparisonPeriod])

  // Forecast first-month averages (for comparison)
  const forecastAvg = useMemo(() => {
    // Average across first N months of forecast to match comparison period
    const slice = baseData.slice(0, comparisonPeriod)
    if (slice.length === 0) return null
    const n = slice.length
    return {
      avgRevenue: slice.reduce((s, d) => s + d.revenue, 0) / n,
      avgDirectCosts: slice.reduce((s, d) => s + d.directCosts, 0) / n,
      avgOpex: slice.reduce((s, d) => s + d.opex, 0) / n,
      avgOverhead: slice.reduce((s, d) => s + d.overhead, 0) / n,
      avgNetIncome: slice.reduce((s, d) => s + d.netIncome, 0) / n,
      grossMargin: slice.reduce((s, d) => s + d.grossMargin, 0) / n,
    }
  }, [baseData, comparisonPeriod])

  // ============ EXPORT ============
  const handleExport = () => {
    const lines: string[] = []
    lines.push(`FORECAST MODEL — ${forecastHorizon}-Month Projection`)
    lines.push(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`)
    lines.push(`Starting Cash: ${fmtCurrency(startingCash)}`)
    lines.push(`Scenario Bands: Revenue ±${(variance.revUp * 100).toFixed(0)}%, Expenses ±${(variance.expUp * 100).toFixed(0)}%`)
    lines.push('')

    // Assumptions by category
    lines.push('=== ASSUMPTIONS ===')
    const sections = ['revenue', 'direct_cost', 'opex', 'overhead', 'cash_adjustment'] as PLSection[]
    sections.forEach(section => {
      const cats = categories.filter(c => c.section === section)
      if (cats.length === 0) return
      lines.push('')
      lines.push(`--- ${PL_SECTIONS[section].label.toUpperCase()} ---`)
      cats.forEach(cat => {
        const items = lineItems.filter(li => li.categoryId === cat.id)
        if (items.length === 0) return
        lines.push(`  ${cat.name}:`)
        items.forEach(li => {
          const freq = li.frequency === 'monthly' ? '/mo' : li.frequency === 'quarterly' ? '/qtr' : '(one-time)'
          const growth = li.growthRate > 0 ? ` +${li.growthRate}%/yr` : ''
          const timing = li.endMonth !== null ? `M${li.startMonth + 1}→M${li.endMonth + 1}` : `M${li.startMonth + 1}→ongoing`
          lines.push(`    ${li.name || 'Unnamed'}: ${fmtCurrency(li.amount)}${freq}${growth} [${timing}]${li.notes ? ` — ${li.notes}` : ''}`)
        })
      })
    })

    lines.push('')
    lines.push('=== PROJECTED P&L ===')
    lines.push('Month,Revenue,COGS,Gross Profit,GM%,OpEx,Overhead,Net Income,NM%,Cash Balance')
    baseData.forEach(row => {
      lines.push(`${row.month},${Math.round(row.revenue)},${Math.round(row.directCosts)},${Math.round(row.grossProfit)},${row.grossMargin.toFixed(1)}%,${Math.round(row.opex)},${Math.round(row.overhead)},${Math.round(row.netIncome)},${row.netMargin.toFixed(1)}%,${Math.round(row.endingCash)}`)
    })

    lines.push('')
    lines.push('=== SCENARIO COMPARISON ===')
    lines.push(`Variance bands at ${forecastHorizon}M: ${variance.label}`)
    const scenarios = [
      { label: 'Worst', data: worstData },
      { label: 'Base', data: baseData },
      { label: 'Best', data: bestData },
    ]
    scenarios.forEach(({ label, data }) => {
      const totalRev = data.reduce((s, d) => s + d.revenue, 0)
      const totalNet = data.reduce((s, d) => s + d.netIncome, 0)
      const endCash = data[data.length - 1]?.endingCash || 0
      lines.push(`${label}: Revenue=${fmtCurrency(totalRev)}, Net Income=${fmtCurrency(totalNet)}, Ending Cash=${fmtCurrency(endCash)}`)
    })

    if (historicalAverages && forecastAvg) {
      lines.push('')
      lines.push('=== ACTUALS vs FORECAST (Monthly Avg) ===')
      lines.push(`Comparison period: Last ${comparisonPeriod} months of actuals vs first ${comparisonPeriod} months of forecast`)
      lines.push(`Metric,Actual Avg,Forecast Avg,Delta %`)
      lines.push(`Revenue,${fmtCurrency(historicalAverages.avgRevenue)},${fmtCurrency(forecastAvg.avgRevenue)},${historicalAverages.avgRevenue > 0 ? (((forecastAvg.avgRevenue - historicalAverages.avgRevenue) / historicalAverages.avgRevenue) * 100).toFixed(1) : '0'}%`)
      lines.push(`Direct Costs,${fmtCurrency(historicalAverages.avgDirectCosts)},${fmtCurrency(forecastAvg.avgDirectCosts)},${historicalAverages.avgDirectCosts > 0 ? (((forecastAvg.avgDirectCosts - historicalAverages.avgDirectCosts) / historicalAverages.avgDirectCosts) * 100).toFixed(1) : '0'}%`)
      lines.push(`OpEx,${fmtCurrency(historicalAverages.avgOpex)},${fmtCurrency(forecastAvg.avgOpex)},${historicalAverages.avgOpex > 0 ? (((forecastAvg.avgOpex - historicalAverages.avgOpex) / historicalAverages.avgOpex) * 100).toFixed(1) : '0'}%`)
      lines.push(`Overhead,${fmtCurrency(historicalAverages.avgOverhead)},${fmtCurrency(forecastAvg.avgOverhead)},${historicalAverages.avgOverhead > 0 ? (((forecastAvg.avgOverhead - historicalAverages.avgOverhead) / historicalAverages.avgOverhead) * 100).toFixed(1) : '0'}%`)
      lines.push(`Net Income,${fmtCurrency(historicalAverages.avgNetIncome)},${fmtCurrency(forecastAvg.avgNetIncome)},${historicalAverages.avgNetIncome !== 0 ? (((forecastAvg.avgNetIncome - historicalAverages.avgNetIncome) / Math.abs(historicalAverages.avgNetIncome)) * 100).toFixed(1) : '0'}%`)
      lines.push(`Gross Margin,${fmtPct(historicalAverages.grossMargin)},${fmtPct(forecastAvg.grossMargin)},${(forecastAvg.grossMargin - historicalAverages.grossMargin).toFixed(1)} pts`)
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `forecast-${forecastHorizon}M-${new Date().toISOString().slice(0, 10)}.txt`; a.click()
    URL.revokeObjectURL(url)
  }

  // ============ LOADING ============
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-teal-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading forecast model...</p>
        </div>
      </div>
    )
  }

  // ============ RENDER ============
  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Forecast</h1>
          <p className="text-sm text-slate-500 mt-0.5">Build named assumptions, project P&L, stress-test scenarios</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={saveModel} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-500 disabled:opacity-50 transition-colors">
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 border border-slate-800/80 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-[#111827] border border-slate-800/80 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-6">
          {/* Starting Cash */}
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-slate-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Starting Cash</span>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
              <input type="number" value={startingCash} onChange={e => setStartingCash(parseFloat(e.target.value) || 0)}
                className="w-32 bg-slate-800/60 border border-slate-800/80 rounded-lg pl-6 pr-2 py-1.5 text-sm text-white font-medium tabular-nums focus:outline-none focus:ring-1 focus:ring-teal-500/30" />
            </div>
          </div>

          <div className="w-px h-8 bg-slate-800/60" />

          {/* Min Threshold */}
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-slate-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Min Cash</span>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">$</span>
              <input type="number" value={minCashThreshold} onChange={e => setMinCashThreshold(parseFloat(e.target.value) || 0)}
                className="w-28 bg-slate-800/60 border border-slate-800/80 rounded-lg pl-6 pr-2 py-1.5 text-sm text-white font-medium tabular-nums focus:outline-none focus:ring-1 focus:ring-teal-500/30" />
            </div>
          </div>

          <div className="w-px h-8 bg-slate-800/60" />

          {/* Horizon */}
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-slate-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Horizon</span>
            <div className="flex bg-slate-800/60 border border-slate-800/80 rounded-lg p-0.5">
              {([3, 6, 12, 18, 24] as const).map(h => (
                <button key={h} onClick={() => setForecastHorizon(h)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    forecastHorizon === h ? 'bg-teal-600 text-white' : 'text-slate-500 hover:text-slate-300'
                  }`}>{h}M</button>
              ))}
            </div>
          </div>

          <div className="w-px h-8 bg-slate-800/60" />

          {/* Variance info */}
          <div className="text-[11px] text-slate-600">
            Scenario bands: Rev ±{(variance.revUp * 100).toFixed(0)}% / Exp ±{(variance.expUp * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Tabs — underline style */}
      <div className="border-b border-slate-800/60">
        <div className="flex gap-0">
          {(['assumptions', 'projections', 'scenarios'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`relative px-5 py-3 text-sm font-medium transition-colors capitalize ${
                activeTab === tab ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {tab}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500 rounded-t" />}
            </button>
          ))}
        </div>
      </div>

      {/* ================================================================ */}
      {/* TAB: ASSUMPTIONS */}
      {/* ================================================================ */}
      {activeTab === 'assumptions' && (
        <div className="space-y-4">
          {/* Add Category button */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Define categories and named line items. Each flows into the P&L and export report.</p>
            <button onClick={openAddCategory}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/60 border border-slate-800/80 rounded-lg text-xs font-semibold text-slate-400 hover:text-teal-400 hover:border-slate-700 transition-colors">
              <Plus size={13} /> Add Category
            </button>
          </div>

          {/* Categories grouped by P&L section */}
          {(['revenue', 'direct_cost', 'opex', 'overhead', 'cash_adjustment'] as PLSection[]).map(section => {
            const sectionCats = categories.filter(c => c.section === section)
            if (sectionCats.length === 0) return null
            const config = PL_SECTIONS[section]

            return (
              <div key={section}>
                {/* Section header */}
                <div className="flex items-center gap-2 mb-2 mt-4">
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded ${config.bgColor} ${config.textColor} border ${config.borderColor}`}>
                    {config.label}
                  </span>
                  <div className="flex-1 h-px bg-slate-800/60" />
                </div>

                {/* Category cards */}
                {sectionCats.map(cat => {
                  const items = lineItems.filter(li => li.categoryId === cat.id)
                  const catTotal = items.reduce((sum, li) => {
                    if (li.frequency === 'one_time') return sum + li.amount
                    return sum + li.amount // monthly shown as monthly
                  }, 0)

                  return (
                    <div key={cat.id} className="bg-[#111827] border border-slate-800/80 rounded-xl mb-3 overflow-hidden">
                      {/* Category header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-white">{cat.name}</h3>
                          <span className="text-[10px] text-slate-600">
                            {items.length} item{items.length !== 1 ? 's' : ''}
                            {catTotal > 0 && ` • ${fmtCurrency(catTotal)}/mo`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => addLineItem(cat.id)} className="p-1.5 text-slate-500 hover:text-teal-400 transition-colors" title="Add line item">
                            <Plus size={14} />
                          </button>
                          <button onClick={() => openEditCategory(cat)} className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors" title="Edit category">
                            <Edit3 size={13} />
                          </button>
                          <button onClick={() => deleteCategory(cat.id)} className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors" title="Delete category">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Line items */}
                      {items.length === 0 ? (
                        <div className="px-4 py-6 text-center">
                          <p className="text-xs text-slate-600 mb-2">No items yet</p>
                          <button onClick={() => addLineItem(cat.id)}
                            className="text-xs font-medium text-teal-500 hover:text-teal-400 transition-colors">
                            + Add first line item
                          </button>
                        </div>
                      ) : (
                        <div>
                          {/* Table header */}
                          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-800/20 border-b border-slate-800/40">
                            <div className="col-span-3 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Name</div>
                            <div className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Amount</div>
                            <div className="col-span-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Freq</div>
                            <div className="col-span-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Start</div>
                            <div className="col-span-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">End</div>
                            <div className="col-span-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Growth</div>
                            <div className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Notes</div>
                            <div className="col-span-1" />
                          </div>

                          {items.map(li => (
                            <div key={li.id} className="grid grid-cols-12 gap-2 px-4 py-2 border-b border-slate-800/30 hover:bg-slate-800/20 items-center transition-colors">
                              <div className="col-span-3">
                                <input type="text" value={li.name} placeholder="e.g. Gulfstream - Monthly Retainer"
                                  onChange={e => updateLineItem(li.id, { name: e.target.value })}
                                  className="w-full bg-transparent text-sm text-slate-200 placeholder-slate-600 border-b border-transparent hover:border-slate-700 focus:border-teal-600 focus:outline-none py-0.5 transition-colors" />
                              </div>
                              <div className="col-span-2">
                                <div className="relative">
                                  <span className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-600 text-xs">$</span>
                                  <input type="number" value={li.amount || ''}
                                    onChange={e => updateLineItem(li.id, { amount: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-transparent text-sm text-white font-medium tabular-nums pl-3 border-b border-transparent hover:border-slate-700 focus:border-teal-600 focus:outline-none py-0.5 transition-colors"
                                    placeholder="0" />
                                </div>
                              </div>
                              <div className="col-span-1">
                                <select value={li.frequency} onChange={e => updateLineItem(li.id, { frequency: e.target.value as any })}
                                  className="w-full bg-transparent text-xs text-slate-400 border-0 focus:outline-none cursor-pointer py-0.5">
                                  <option value="monthly" className="bg-slate-900">Mo</option>
                                  <option value="quarterly" className="bg-slate-900">Qtr</option>
                                  <option value="one_time" className="bg-slate-900">1x</option>
                                </select>
                              </div>
                              <div className="col-span-1">
                                <select value={li.startMonth} onChange={e => updateLineItem(li.id, { startMonth: parseInt(e.target.value) })}
                                  className="w-full bg-transparent text-xs text-slate-400 border-0 focus:outline-none cursor-pointer py-0.5">
                                  {monthLabels.map((label, i) => <option key={i} value={i} className="bg-slate-900">{label}</option>)}
                                </select>
                              </div>
                              <div className="col-span-1">
                                <select value={li.endMonth ?? 'ongoing'} onChange={e => updateLineItem(li.id, { endMonth: e.target.value === 'ongoing' ? null : parseInt(e.target.value) })}
                                  className="w-full bg-transparent text-xs text-slate-400 border-0 focus:outline-none cursor-pointer py-0.5">
                                  <option value="ongoing" className="bg-slate-900">—</option>
                                  {monthLabels.map((label, i) => <option key={i} value={i} className="bg-slate-900">{label}</option>)}
                                </select>
                              </div>
                              <div className="col-span-1">
                                <div className="flex items-center gap-0.5">
                                  <input type="number" value={li.growthRate || ''} placeholder="0"
                                    onChange={e => updateLineItem(li.id, { growthRate: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-transparent text-xs text-slate-400 tabular-nums border-b border-transparent hover:border-slate-700 focus:border-teal-600 focus:outline-none py-0.5 transition-colors" />
                                  <span className="text-[10px] text-slate-600">%</span>
                                </div>
                              </div>
                              <div className="col-span-2">
                                <input type="text" value={li.notes} placeholder="Notes..."
                                  onChange={e => updateLineItem(li.id, { notes: e.target.value })}
                                  className="w-full bg-transparent text-xs text-slate-500 placeholder-slate-700 border-b border-transparent hover:border-slate-700 focus:border-teal-600 focus:outline-none py-0.5 transition-colors" />
                              </div>
                              <div className="col-span-1 flex justify-end">
                                <button onClick={() => deleteLineItem(li.id)} className="p-1 text-slate-600 hover:text-rose-400 transition-colors">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))}

                          {/* Add more */}
                          <button onClick={() => addLineItem(cat.id)}
                            className="w-full px-4 py-2 text-xs text-slate-600 hover:text-teal-400 hover:bg-slate-800/20 transition-colors text-left">
                            + Add line item
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}

          {categories.length === 0 && (
            <div className="bg-[#111827] border border-slate-800/80 rounded-xl p-12 text-center">
              <Tag size={28} className="text-slate-600 mx-auto mb-3" />
              <p className="text-sm text-slate-400 mb-1">No categories yet</p>
              <p className="text-xs text-slate-600 mb-4">Create categories like "Client Revenue", "Labor", "Software" then add named line items.</p>
              <button onClick={openAddCategory}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-500 transition-colors">
                + Add First Category
              </button>
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB: PROJECTIONS */}
      {/* ================================================================ */}
      {activeTab === 'projections' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          {kpis && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: `Revenue (${forecastHorizon}M)`, value: fmtCurrency(kpis.totalRev), accent: 'bg-emerald-500' },
                { label: `Net Income (${forecastHorizon}M)`, value: fmtCurrency(kpis.totalNet), accent: kpis.totalNet >= 0 ? 'bg-emerald-500' : 'bg-rose-500' },
                { label: 'Avg Gross Margin', value: fmtPct(kpis.avgGM), accent: kpis.avgGM >= 40 ? 'bg-emerald-500' : kpis.avgGM >= 20 ? 'bg-amber-500' : 'bg-rose-500' },
                { label: 'Ending Cash', value: fmtCurrency(kpis.endCash), accent: kpis.endCash >= minCashThreshold ? 'bg-blue-500' : 'bg-rose-500' },
                { label: 'Cash Runway', value: `${Math.min(kpis.runway, 99).toFixed(1)} mo`, accent: kpis.runway >= 6 ? 'bg-emerald-500' : kpis.runway >= 3 ? 'bg-amber-500' : 'bg-rose-500' },
                { label: 'Min Cash Point', value: fmtCurrency(kpis.minCash), accent: kpis.minCash >= minCashThreshold ? 'bg-blue-500' : 'bg-rose-500' },
              ].map((kpi, i) => (
                <div key={i} className="bg-[#111827] border border-slate-800/80 rounded-xl overflow-hidden">
                  <div className="flex">
                    <div className={`w-1 ${kpi.accent} shrink-0`} />
                    <div className="p-4 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{kpi.label}</p>
                      <p className="text-lg font-bold text-white mt-1 tabular-nums">{kpi.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actuals vs Forecast Comparison */}
          {historicalAverages && forecastAvg && (
            <div className="bg-[#111827] border border-slate-800/80 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/60">
                <div>
                  <h3 className="text-sm font-semibold text-white">Actuals vs Forecast</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Trailing monthly avg vs your projected monthly avg</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Compare last</span>
                  <div className="flex bg-slate-800/60 border border-slate-800/80 rounded-lg p-0.5">
                    {([3, 6, 12] as const).map(p => (
                      <button key={p} onClick={() => setComparisonPeriod(p)}
                        className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-all ${
                          comparisonPeriod === p ? 'bg-teal-600 text-white' : 'text-slate-500 hover:text-slate-300'
                        }`}>{p}M</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-6 gap-4">
                  {[
                    { label: 'Revenue', actual: historicalAverages.avgRevenue, forecast: forecastAvg.avgRevenue, color: 'emerald' },
                    { label: 'Direct Costs', actual: historicalAverages.avgDirectCosts, forecast: forecastAvg.avgDirectCosts, color: 'blue' },
                    { label: 'OpEx', actual: historicalAverages.avgOpex, forecast: forecastAvg.avgOpex, color: 'amber' },
                    { label: 'Overhead', actual: historicalAverages.avgOverhead, forecast: forecastAvg.avgOverhead, color: 'purple' },
                    { label: 'Net Income', actual: historicalAverages.avgNetIncome, forecast: forecastAvg.avgNetIncome, color: 'teal' },
                    { label: 'Gross Margin', actual: historicalAverages.grossMargin, forecast: forecastAvg.grossMargin, color: 'cyan', isPct: true },
                  ].map((item, i) => {
                    const delta = item.isPct
                      ? item.forecast - item.actual
                      : item.actual !== 0 ? ((item.forecast - item.actual) / Math.abs(item.actual)) * 100 : 0
                    const isRevenue = item.label === 'Revenue' || item.label === 'Net Income' || item.label === 'Gross Margin'
                    const deltaPositive = isRevenue ? delta >= 0 : delta <= 0
                    return (
                      <div key={i} className="text-center">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">{item.label}</p>
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">Actual</span>
                            <span className="text-slate-300 font-medium tabular-nums">{item.isPct ? fmtPct(item.actual) : fmtCurrency(item.actual)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">Forecast</span>
                            <span className="text-white font-semibold tabular-nums">{item.isPct ? fmtPct(item.forecast) : fmtCurrency(item.forecast)}</span>
                          </div>
                          <div className={`pt-1 border-t border-slate-800/60 text-[10px] font-bold tabular-nums ${deltaPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%{!item.isPct ? ' Δ' : ' pts'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="text-[10px] text-slate-600 mt-4 pt-3 border-t border-slate-800/60">
                  Based on {historicalAverages.monthCount} month{historicalAverages.monthCount !== 1 ? 's' : ''} of actuals from invoices, bills & expenses. Green = favorable direction for each line.
                </p>
              </div>
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Revenue & Net Income */}
            <div className="bg-[#111827] border border-slate-800/80 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Revenue & Net Income</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: CHART.axis, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: CHART.axis, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip formatter={(v: number) => fmtCurrency(v)} />} />
                    <Bar dataKey="revenue" name="Revenue" fill={CHART.teal} radius={[3, 3, 0, 0]} />
                    <Line type="monotone" dataKey="netIncome" name="Net Income" stroke={CHART.amber} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="bestNet" name="Best" stroke={CHART.emerald} strokeWidth={1} strokeDasharray="4 4" dot={false} />
                    <Line type="monotone" dataKey="worstNet" name="Worst" stroke={CHART.rose} strokeWidth={1} strokeDasharray="4 4" dot={false} />
                    <ReferenceLine y={0} stroke="#475569" strokeWidth={1} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800/60">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ backgroundColor: CHART.teal }} /><span className="text-[10px] text-slate-500">Revenue</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded" style={{ backgroundColor: CHART.amber }} /><span className="text-[10px] text-slate-500">Net Income</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 border-t border-dashed" style={{ borderColor: CHART.emerald }} /><span className="text-[10px] text-slate-500">Best</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 border-t border-dashed" style={{ borderColor: CHART.rose }} /><span className="text-[10px] text-slate-500">Worst</span></div>
              </div>
            </div>

            {/* Cash Position with Scenario Cone */}
            <div className="bg-[#111827] border border-slate-800/80 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Cash Position</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART.teal} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={CHART.teal} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART.slate} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={CHART.slate} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: CHART.axis, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: CHART.axis, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip formatter={(v: number) => fmtCurrency(v)} />} />
                    <Area type="monotone" dataKey="bestCash" name="Best Case" stroke="transparent" fill="url(#bandGrad)" fillOpacity={1} />
                    <Area type="monotone" dataKey="worstCash" name="Worst Case" stroke="transparent" fill="transparent" />
                    <Area type="monotone" dataKey="endingCash" name="Base" stroke={CHART.teal} strokeWidth={2} fill="url(#cashGrad)" />
                    <ReferenceLine y={minCashThreshold} stroke={CHART.amber} strokeDasharray="5 5" strokeWidth={1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800/60">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ backgroundColor: CHART.teal }} /><span className="text-[10px] text-slate-500">Base</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-slate-500/30" /><span className="text-[10px] text-slate-500">Scenario Cone</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 border-t border-dashed" style={{ borderColor: CHART.amber }} /><span className="text-[10px] text-slate-500">Min Threshold</span></div>
              </div>
            </div>
          </div>

          {/* P&L Detail Table */}
          <div className="bg-[#111827] border border-slate-800/80 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800/60 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Projected P&L Detail</h3>
              <p className="text-[10px] text-slate-600">Click a month to see line-item breakdown</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800/20">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 sticky left-0 bg-slate-800/20">Month</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Revenue</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">COGS</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Gross Profit</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">GM%</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">OpEx</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Overhead</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Net Income</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">Cash</th>
                  </tr>
                </thead>
                <tbody>
                  {baseData.map((row, i) => (
                    <React.Fragment key={i}>
                      <tr onClick={() => setExpandedMonth(expandedMonth === i ? null : i)}
                        className="border-t border-slate-800/40 hover:bg-slate-800/20 cursor-pointer transition-colors">
                        <td className="px-4 py-2.5 font-medium text-slate-300 sticky left-0 bg-[#111827]">
                          <div className="flex items-center gap-1.5">
                            {expandedMonth === i ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-600" />}
                            {row.month}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-emerald-400 tabular-nums">{fmtCurrency(row.revenue)}</td>
                        <td className="px-4 py-2.5 text-right text-rose-400 tabular-nums">{fmtCurrency(row.directCosts)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-200 tabular-nums">{fmtCurrency(row.grossProfit)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={row.grossMargin >= 40 ? 'text-emerald-400' : row.grossMargin >= 20 ? 'text-amber-400' : 'text-rose-400'}>
                            {fmtPct(row.grossMargin)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-rose-400 tabular-nums">{fmtCurrency(row.opex)}</td>
                        <td className="px-4 py-2.5 text-right text-rose-400 tabular-nums">{fmtCurrency(row.overhead)}</td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                          <span className={row.netIncome >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{fmtCurrency(row.netIncome)}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                          <span className={row.endingCash >= minCashThreshold ? 'text-blue-400' : 'text-rose-400'}>{fmtCurrency(row.endingCash)}</span>
                        </td>
                      </tr>
                      {/* Drilldown */}
                      {expandedMonth === i && (
                        <tr>
                          <td colSpan={9} className="px-8 py-3 bg-slate-800/10 border-t border-slate-800/30">
                            <div className="grid grid-cols-2 gap-6">
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500 mb-2">Revenue Sources</p>
                                {row.revenueItems.length > 0 ? row.revenueItems.map((item, j) => (
                                  <div key={j} className="flex items-center justify-between py-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-slate-500">{item.category}</span>
                                      <span className="text-xs text-slate-300">{item.name}</span>
                                    </div>
                                    <span className="text-xs text-emerald-400 font-medium tabular-nums">{fmtCurrency(item.amount)}</span>
                                  </div>
                                )) : <p className="text-xs text-slate-600">No revenue items</p>}
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-500 mb-2">Cost Sources</p>
                                {row.costItems.length > 0 ? row.costItems.map((item, j) => (
                                  <div key={j} className="flex items-center justify-between py-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-slate-500">{item.category}</span>
                                      <span className="text-xs text-slate-300">{item.name}</span>
                                    </div>
                                    <span className="text-xs text-rose-400 font-medium tabular-nums">{fmtCurrency(item.amount)}</span>
                                  </div>
                                )) : <p className="text-xs text-slate-600">No cost items</p>}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {/* Totals row */}
                  {baseData.length > 0 && (
                    <tr className="border-t-2 border-slate-700 bg-slate-800/20">
                      <td className="px-4 py-3 font-semibold text-white sticky left-0 bg-slate-800/20">Total</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-400 tabular-nums">{fmtCurrency(baseData.reduce((s, r) => s + r.revenue, 0))}</td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-400 tabular-nums">{fmtCurrency(baseData.reduce((s, r) => s + r.directCosts, 0))}</td>
                      <td className="px-4 py-3 text-right font-semibold text-white tabular-nums">{fmtCurrency(baseData.reduce((s, r) => s + r.grossProfit, 0))}</td>
                      <td className="px-4 py-3 text-right text-slate-500">—</td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-400 tabular-nums">{fmtCurrency(baseData.reduce((s, r) => s + r.opex, 0))}</td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-400 tabular-nums">{fmtCurrency(baseData.reduce((s, r) => s + r.overhead, 0))}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">
                        <span className={baseData.reduce((s, r) => s + r.netIncome, 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                          {fmtCurrency(baseData.reduce((s, r) => s + r.netIncome, 0))}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-400 tabular-nums">{fmtCurrency(baseData[baseData.length - 1]?.endingCash || 0)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* TAB: SCENARIOS */}
      {/* ================================================================ */}
      {activeTab === 'scenarios' && (
        <div className="space-y-6">
          {/* Variance explanation */}
          <div className="bg-[#111827] border border-slate-800/80 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <Layers size={18} className="text-teal-500 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Scenario Variance Model</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  At <span className="text-white font-medium">{forecastHorizon} months</span>, scenarios apply
                  <span className="text-emerald-400 font-medium"> Revenue ±{(variance.revUp * 100).toFixed(0)}%</span> and
                  <span className="text-amber-400 font-medium"> Expenses ±{(variance.expUp * 100).toFixed(0)}%</span> to your base assumptions.
                  {' '}{variance.label}. Revenue bands are wider than expense bands because service firms control costs more reliably than revenue.
                  Change the horizon to see how bands adjust.
                </p>
              </div>
            </div>
          </div>

          {/* Side-by-side comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {([
              { key: 'worst' as const, label: 'Worst Case', data: worstData, accent: 'rose', desc: `Revenue -${(variance.revDown * 100).toFixed(0)}%, Expenses +${(variance.expUp * 100).toFixed(0)}%` },
              { key: 'base' as const, label: 'Base Case', data: baseData, accent: 'teal', desc: 'Your assumptions as entered' },
              { key: 'best' as const, label: 'Best Case', data: bestData, accent: 'emerald', desc: `Revenue +${(variance.revUp * 100).toFixed(0)}%, Expenses -${(variance.expDown * 100).toFixed(0)}%` },
            ]).map(({ key, label, data, accent, desc }) => {
              const totalRev = data.reduce((s, d) => s + d.revenue, 0)
              const totalNet = data.reduce((s, d) => s + d.netIncome, 0)
              const endCash = data[data.length - 1]?.endingCash || 0
              const avgGM = data.length > 0 ? data.reduce((s, d) => s + d.grossMargin, 0) / data.length : 0
              const minCash = data.length > 0 ? Math.min(...data.map(d => d.endingCash)) : 0

              const borderColor = key === 'worst' ? 'border-rose-500/30' : key === 'best' ? 'border-emerald-500/30' : 'border-teal-500/30'
              const headerBg = key === 'worst' ? 'bg-rose-500/10' : key === 'best' ? 'bg-emerald-500/10' : 'bg-teal-500/10'
              const titleColor = key === 'worst' ? 'text-rose-400' : key === 'best' ? 'text-emerald-400' : 'text-teal-400'

              return (
                <div key={key} className={`bg-[#111827] border ${borderColor} rounded-xl overflow-hidden`}>
                  <div className={`px-5 py-3 ${headerBg} border-b ${borderColor}`}>
                    <h3 className={`text-sm font-bold ${titleColor}`}>{label}</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">{desc}</p>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="space-y-3">
                      {[
                        { label: `Revenue (${forecastHorizon}M)`, value: fmtCurrency(totalRev), color: 'text-emerald-400' },
                        { label: `Total Expenses`, value: fmtCurrency(totalRev - totalNet), color: 'text-rose-400' },
                        { label: `Net Income`, value: fmtCurrency(totalNet), color: totalNet >= 0 ? 'text-emerald-400' : 'text-rose-400' },
                        { label: `Avg Gross Margin`, value: fmtPct(avgGM), color: avgGM >= 40 ? 'text-emerald-400' : avgGM >= 20 ? 'text-amber-400' : 'text-rose-400' },
                      ].map((row, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-slate-400">{row.label}</span>
                          <span className={`font-semibold tabular-nums ${row.color}`}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-3 border-t border-slate-800/60 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Ending Cash</span>
                        <span className={`font-bold tabular-nums ${endCash >= minCashThreshold ? 'text-blue-400' : 'text-rose-400'}`}>{fmtCurrency(endCash)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Lowest Cash Point</span>
                        <span className={`font-medium tabular-nums ${minCash >= minCashThreshold ? 'text-slate-300' : 'text-rose-400'}`}>{fmtCurrency(minCash)}</span>
                      </div>
                      {minCash < minCashThreshold && (
                        <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                          <AlertTriangle size={14} className="text-rose-400 shrink-0" />
                          <span className="text-[10px] text-rose-400">Cash drops below {fmtCurrency(minCashThreshold)} threshold</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Combined scenario chart */}
          <div className="bg-[#111827] border border-slate-800/80 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Cash Position — All Scenarios</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: CHART.axis, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: CHART.axis, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip formatter={(v: number) => fmtCurrency(v)} />} />
                  <Line type="monotone" dataKey="bestCash" name="Best Case" stroke={CHART.emerald} strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                  <Line type="monotone" dataKey="endingCash" name="Base Case" stroke={CHART.teal} strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="worstCash" name="Worst Case" stroke={CHART.rose} strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                  <ReferenceLine y={minCashThreshold} stroke={CHART.amber} strokeDasharray="5 5" strokeWidth={1} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-800/60">
              <div className="flex items-center gap-1.5"><div className="w-3 border-t-2" style={{ borderColor: CHART.emerald }} /><span className="text-[10px] text-slate-500">Best</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 border-t-2" style={{ borderColor: CHART.teal }} /><span className="text-[10px] text-slate-500">Base</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 border-t-2" style={{ borderColor: CHART.rose }} /><span className="text-[10px] text-slate-500">Worst</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 border-t border-dashed" style={{ borderColor: CHART.amber }} /><span className="text-[10px] text-slate-500">Min Threshold</span></div>
            </div>
          </div>
        </div>
      )}

      {/* ============ CATEGORY MODAL ============ */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#111827] border border-slate-800/80 rounded-xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
              <h3 className="text-sm font-semibold text-white">{editingCategory ? 'Edit Category' : 'Add Category'}</h3>
              <button onClick={() => setShowCategoryModal(false)} className="p-1 hover:bg-slate-800/50 rounded-lg transition-colors">
                <X size={16} className="text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Category Name</label>
                <input type="text" value={catForm.name} onChange={e => setCatForm(prev => ({ ...prev, name: e.target.value }))}
                  className={inputClass} placeholder="e.g. Client Revenue, Subcontractors, Insurance..." autoFocus />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">P&L Section</label>
                <div className="space-y-2">
                  {(Object.entries(PL_SECTIONS) as [PLSection, typeof PL_SECTIONS[PLSection]][]).map(([key, config]) => (
                    <button key={key} onClick={() => setCatForm(prev => ({ ...prev, section: key }))}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        catForm.section === key
                          ? `${config.bgColor} border ${config.borderColor}`
                          : 'bg-slate-800/30 border border-transparent hover:bg-slate-800/50'
                      }`}>
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded ${config.bgColor} ${config.textColor}`}>
                        {config.shortLabel}
                      </span>
                      <div>
                        <p className={`text-sm font-medium ${catForm.section === key ? config.textColor : 'text-slate-300'}`}>{config.label}</p>
                        <p className="text-[10px] text-slate-500">
                          {key === 'revenue' ? 'Inflows — client billings, project revenue' :
                           key === 'direct_cost' ? 'COGS — labor, subcontractors, materials' :
                           key === 'opex' ? 'Operating — software, rent, insurance' :
                           key === 'overhead' ? 'G&A — admin, accounting, legal' :
                           'Cash-only — tax payments, equipment, loans'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-800/60">
              <button onClick={() => setShowCategoryModal(false)} className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors">Cancel</button>
              <button onClick={saveCategory} disabled={!catForm.name.trim()}
                className="px-5 py-2.5 text-sm font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {editingCategory ? 'Save' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
