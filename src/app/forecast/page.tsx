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
  emerald: '#10b981', blue: '#3b82f6', gray: '#6b7280', rose: '#f43f5e',
  amber: '#f59e0b', emerald: '#10b981', purple: '#8b5cf6', cyan: '#06b6d4',
  grid: '#f3f4f6', axis: '#6b7280',
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
  revenue: { label: 'Revenue', shortLabel: 'Rev', color: 'emerald', textColor: 'text-emerald-600', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', sign: 1 },
  direct_cost: { label: 'Direct Cost (COGS)', shortLabel: 'COGS', color: 'blue', textColor: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', sign: -1 },
  opex: { label: 'Operating Expense', shortLabel: 'OpEx', color: 'amber', textColor: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', sign: -1 },
  overhead: { label: 'Overhead / G&A', shortLabel: 'OH', color: 'purple', textColor: 'text-purple-600', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', sign: -1 },
  cash_adjustment: { label: 'Cash Adjustment', shortLabel: 'Cash', color: 'cyan', textColor: 'text-cyan-600', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-200', sign: 1 },
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

const inputClass = "w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
const selectClass = "bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 cursor-pointer transition-colors"

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
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-[11px] text-gray-500 mb-1">{label}</p>
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
  const [dirty, setDirty] = useState(false)

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
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading forecast model...</p>
        </div>
      </div>
    )
  }

  // ============ RENDER ============
  return (
    <div className="space-y-6 pb-8">
      {/* Header + Controls — merged */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900">Forecast</h1>
            <p className="text-sm text-gray-500 mt-0.5">Build named assumptions, project P&L, stress-test scenarios</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { saveModel(); setDirty(false) }} disabled={saving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${dirty ? 'bg-emerald-600 text-white hover:bg-emerald-500' : 'bg-gray-100 border border-gray-200 text-gray-500'}`}>
              {saving ? <RefreshCw size={14} className="animate-spin" /> : dirty ? <Save size={14} /> : <CheckCircle2 size={14} />}
              {saving ? 'Saving...' : dirty ? 'Save' : 'Saved'}
            </button>
            <button onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:border-gray-300 transition-colors">
              <Download size={14} /> Export
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 px-4 py-2.5 bg-white border border-gray-200 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Cash</span>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
              <input type="number" value={startingCash} onChange={e => { setStartingCash(parseFloat(e.target.value) || 0); setDirty(true) }}
                className="w-28 bg-gray-50 border border-gray-200 rounded-lg pl-6 pr-2 py-1.5 text-sm text-gray-900 font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
            </div>
          </div>
          <div className="w-px h-6 bg-gray-200" />
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Min</span>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
              <input type="number" value={minCashThreshold} onChange={e => { setMinCashThreshold(parseFloat(e.target.value) || 0); setDirty(true) }}
                className="w-24 bg-gray-50 border border-gray-200 rounded-lg pl-6 pr-2 py-1.5 text-sm text-gray-900 font-medium tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
            </div>
          </div>
          <div className="w-px h-6 bg-gray-200" />
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Horizon</span>
            <div className="flex bg-gray-100 border border-gray-200 rounded-lg p-0.5">
              {([3, 6, 12, 18, 24] as const).map(h => (
                <button key={h} onClick={() => { setForecastHorizon(h); setDirty(true) }}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    forecastHorizon === h ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-600'
                  }`}>{h}M</button>
              ))}
            </div>
          </div>
          <span className="ml-auto text-[11px] text-gray-400">Bands: Rev ±{(variance.revUp * 100).toFixed(0)}% · Exp ±{(variance.expUp * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* Tabs — underline style */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0">
          {(['assumptions', 'projections', 'scenarios'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`relative px-5 py-3 text-sm font-medium transition-colors capitalize ${
                activeTab === tab ? 'text-emerald-600' : 'text-gray-500 hover:text-gray-600'
              }`}>
              {tab}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t" />}
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
            <p className="text-xs text-gray-500">Define categories and named line items. Each flows into the P&L and export report.</p>
            <button onClick={openAddCategory}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-500 hover:text-emerald-600 hover:border-gray-300 transition-colors">
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
                  <div className="flex-1 h-px bg-gray-50" />
                </div>

                {/* Category cards */}
                {sectionCats.map(cat => {
                  const items = lineItems.filter(li => li.categoryId === cat.id)
                  const catTotal = items.reduce((sum, li) => {
                    if (li.frequency === 'one_time') return sum + li.amount
                    return sum + li.amount // monthly shown as monthly
                  }, 0)

                  return (
                    <div key={cat.id} className="bg-white border border-gray-200 rounded-xl mb-3 overflow-hidden">
                      {/* Category header */}
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-900">{cat.name}</h3>
                          <span className="text-[10px] text-gray-400">
                            {items.length} item{items.length !== 1 ? 's' : ''}
                            {catTotal > 0 && ` • ${fmtCurrency(catTotal)}/mo`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => addLineItem(cat.id)} className="p-1.5 text-gray-500 hover:text-emerald-600 transition-colors" title="Add line item">
                            <Plus size={14} />
                          </button>
                          <button onClick={() => openEditCategory(cat)} className="p-1.5 text-gray-500 hover:text-gray-600 transition-colors" title="Edit category">
                            <Edit3 size={13} />
                          </button>
                          <button onClick={() => deleteCategory(cat.id)} className="p-1.5 text-gray-500 hover:text-rose-600 transition-colors" title="Delete category">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Line items */}
                      {items.length === 0 ? (
                        <div className="px-4 py-6 text-center">
                          <p className="text-xs text-gray-400 mb-2">No items yet</p>
                          <button onClick={() => addLineItem(cat.id)}
                            className="text-xs font-medium text-emerald-500 hover:text-emerald-600 transition-colors">
                            + Add first line item
                          </button>
                        </div>
                      ) : (
                        <div>
                          {/* Table header */}
                          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100">
                            <div className="col-span-3 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Name</div>
                            <div className="col-span-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Amount</div>
                            <div className="col-span-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Freq</div>
                            <div className="col-span-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">/Month</div>
                            <div className="col-span-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Start</div>
                            <div className="col-span-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">End</div>
                            <div className="col-span-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Growth</div>
                            <div className="col-span-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Notes</div>
                            <div className="col-span-1" />
                          </div>

                          {items.map(li => {
                            const monthlyImpact = li.frequency === 'quarterly' ? li.amount / 3 : li.frequency === 'one_time' ? li.amount / Math.max(forecastHorizon, 1) : li.amount
                            const isOneTime = li.frequency === 'one_time'
                            const isQuarterly = li.frequency === 'quarterly'
                            return (
                            <div key={li.id} className={`grid grid-cols-12 gap-2 px-4 py-2 border-b border-gray-100 hover:bg-gray-50 items-center transition-colors ${isOneTime ? 'border-l-2 border-l-gray-300 border-dashed' : isQuarterly ? 'border-l-2 border-l-amber-300' : ''}`}>
                              <div className="col-span-3">
                                <input type="text" value={li.name} placeholder="e.g. Gulfstream - Monthly Retainer"
                                  onChange={e => { updateLineItem(li.id, { name: e.target.value }); setDirty(true) }}
                                  className="w-full bg-transparent text-sm text-gray-700 placeholder-gray-400 border-b border-transparent hover:border-gray-300 focus:border-emerald-600 focus:outline-none py-0.5 transition-colors" />
                              </div>
                              <div className="col-span-1">
                                <div className="relative">
                                  <span className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                                  <input type="number" value={li.amount || ''}
                                    onChange={e => { updateLineItem(li.id, { amount: parseFloat(e.target.value) || 0 }); setDirty(true) }}
                                    className="w-full bg-transparent text-sm text-gray-900 font-medium tabular-nums pl-3 border-b border-transparent hover:border-gray-300 focus:border-emerald-600 focus:outline-none py-0.5 transition-colors"
                                    placeholder="0" />
                                </div>
                              </div>
                              <div className="col-span-1">
                                <select value={li.frequency} onChange={e => { updateLineItem(li.id, { frequency: e.target.value as any }); setDirty(true) }}
                                  className="w-full bg-transparent text-xs text-gray-500 border-0 focus:outline-none cursor-pointer py-0.5">
                                  <option value="monthly" className="bg-white">Mo</option>
                                  <option value="quarterly" className="bg-white">Qtr</option>
                                  <option value="one_time" className="bg-white">1x</option>
                                </select>
                              </div>
                              {/* [FIX #2] Monthly impact — computed */}
                              <div className="col-span-1">
                                <span className={`text-xs tabular-nums ${isOneTime ? 'text-gray-400 italic' : 'text-gray-600 font-medium'}`}>
                                  {fmtCurrency(monthlyImpact)}
                                </span>
                              </div>
                              <div className="col-span-1">
                                <select value={li.startMonth} onChange={e => { updateLineItem(li.id, { startMonth: parseInt(e.target.value) }); setDirty(true) }}
                                  className="w-full bg-transparent text-xs text-gray-500 border-0 focus:outline-none cursor-pointer py-0.5">
                                  {monthLabels.map((label, i) => <option key={i} value={i} className="bg-white">{label}</option>)}
                                </select>
                              </div>
                              <div className="col-span-1">
                                <select value={li.endMonth ?? 'ongoing'} onChange={e => { updateLineItem(li.id, { endMonth: e.target.value === 'ongoing' ? null : parseInt(e.target.value) }); setDirty(true) }}
                                  className="w-full bg-transparent text-xs text-gray-500 border-0 focus:outline-none cursor-pointer py-0.5">
                                  <option value="ongoing" className="bg-white">—</option>
                                  {monthLabels.map((label, i) => <option key={i} value={i} className="bg-white">{label}</option>)}
                                </select>
                              </div>
                              <div className="col-span-1">
                                <div className="flex items-center gap-0.5">
                                  <input type="number" value={li.growthRate || ''} placeholder="0"
                                    onChange={e => { updateLineItem(li.id, { growthRate: parseFloat(e.target.value) || 0 }); setDirty(true) }}
                                    className="w-full bg-transparent text-xs text-gray-500 tabular-nums border-b border-transparent hover:border-gray-300 focus:border-emerald-600 focus:outline-none py-0.5 transition-colors" />
                                  <span className="text-[10px] text-gray-400">%</span>
                                </div>
                              </div>
                              <div className="col-span-2">
                                <input type="text" value={li.notes} placeholder="Notes..."
                                  onChange={e => { updateLineItem(li.id, { notes: e.target.value }); setDirty(true) }}
                                  className="w-full bg-transparent text-xs text-gray-500 placeholder-gray-400 border-b border-transparent hover:border-gray-300 focus:border-emerald-600 focus:outline-none py-0.5 transition-colors" />
                              </div>
                              <div className="col-span-1 flex justify-end">
                                <button onClick={() => { deleteLineItem(li.id); setDirty(true) }} className="p-1 text-gray-400 hover:text-rose-600 transition-colors">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          )})}

                          {/* [FIX #3] Category subtotal */}
                          <div className="flex items-center justify-between px-4 py-2 bg-gray-50/70 border-t border-gray-200">
                            <span className="text-xs font-medium text-gray-500">{items.length} item{items.length !== 1 ? 's' : ''}</span>
                            <span className="text-xs font-semibold text-gray-700 tabular-nums">{fmtCurrency(catTotal)}/mo</span>
                          </div>

                          {/* Add more */}
                          <button onClick={() => addLineItem(cat.id)}
                            className="w-full px-4 py-2 text-xs text-gray-400 hover:text-emerald-600 hover:bg-gray-50 transition-colors text-left">
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

          {/* [FIX #3] Assumptions summary bar */}
          {lineItems.length > 0 && (() => {
            const revItems = lineItems.filter(li => categories.find(c => c.id === li.categoryId)?.section === 'revenue')
            const costItems = lineItems.filter(li => { const s = categories.find(c => c.id === li.categoryId)?.section; return s === 'direct_cost' || s === 'opex' || s === 'overhead' })
            const moRev = revItems.reduce((s, li) => s + (li.frequency === 'quarterly' ? li.amount / 3 : li.frequency === 'one_time' ? 0 : li.amount), 0)
            const moCost = costItems.reduce((s, li) => s + (li.frequency === 'quarterly' ? li.amount / 3 : li.frequency === 'one_time' ? 0 : li.amount), 0)
            const moNet = moRev - moCost
            return (
              <div className="sticky bottom-0 bg-white border border-gray-200 rounded-xl px-5 py-3 flex items-center gap-6 shadow-sm z-10">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Monthly Run Rate</span>
                <div className="flex items-center gap-1"><span className="text-xs text-gray-500">Rev</span><span className="text-sm font-bold text-emerald-600 tabular-nums">{fmtCurrency(moRev)}</span></div>
                <div className="flex items-center gap-1"><span className="text-xs text-gray-500">Cost</span><span className="text-sm font-bold text-rose-600 tabular-nums">{fmtCurrency(moCost)}</span></div>
                <div className="flex items-center gap-1"><span className="text-xs text-gray-500">Net</span><span className={`text-sm font-bold tabular-nums ${moNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtCurrency(moNet)}</span></div>
                <div className="ml-auto text-xs text-gray-400">{lineItems.length} line item{lineItems.length !== 1 ? 's' : ''} across {categories.length} categories</div>
              </div>
            )
          })()}

          {categories.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
              <Tag size={28} className="text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-1">No categories yet</p>
              <p className="text-xs text-gray-400 mb-4">Create categories like "Client Revenue", "Labor", "Software" then add named line items.</p>
              <button onClick={openAddCategory}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-500 transition-colors">
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
        lineItems.length === 0 ? (
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-16 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.1]" style={{ backgroundImage: 'radial-gradient(circle, #9ca3af 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            <div className="relative">
              <TrendingUp size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600 mb-1">No projections to show</p>
              <p className="text-xs text-gray-400 mb-4">Add assumptions first — each line item flows into revenue, costs, and cash position.</p>
              <button onClick={() => setActiveTab('assumptions')} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors">Go to Assumptions</button>
            </div>
          </div>
        ) : (
        <div className="space-y-6">
          {/* [FIX #4] Cash breach alert */}
          {kpis && kpis.minCash < minCashThreshold && (
            <div className="flex items-center gap-2.5 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertTriangle size={16} className="text-rose-600 shrink-0" />
              <p className="text-sm text-rose-800">
                Cash drops to <span className="font-bold">{fmtCurrency(kpis.minCash)}</span> in <span className="font-bold">{kpis.minCashMonth}</span> — below your {fmtCurrency(minCashThreshold)} threshold.
                {kpis.runway < 6 && <> Runway is <span className="font-bold">{kpis.runway.toFixed(1)} months</span>.</>}
              </p>
            </div>
          )}

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
                <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex">
                    <div className={`w-1 ${kpi.accent} shrink-0`} />
                    <div className="p-4 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{kpi.label}</p>
                      <p className="text-lg font-bold text-gray-900 mt-1 tabular-nums">{kpi.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actuals vs Forecast Comparison */}
          {historicalAverages && forecastAvg && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Actuals vs Forecast</h3>
                  <p className="text-[10px] text-gray-500 mt-0.5">Trailing monthly avg vs your projected monthly avg</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Compare last</span>
                  <div className="flex bg-gray-100 border border-gray-200 rounded-lg p-0.5">
                    {([3, 6, 12] as const).map(p => (
                      <button key={p} onClick={() => setComparisonPeriod(p)}
                        className={`px-2 py-1 text-[10px] font-semibold rounded-md transition-all ${
                          comparisonPeriod === p ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-600'
                        }`}>{p}M</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-0">
                {/* [FIX #5] Table layout — horizontal rows */}
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50">
                    <th className="text-left px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 w-[140px]">Metric</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Actual Avg</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Forecast Avg</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 w-[100px]">Delta</th>
                  </tr></thead>
                  <tbody>
                  {[
                    { label: 'Revenue', actual: historicalAverages.avgRevenue, forecast: forecastAvg.avgRevenue },
                    { label: 'Direct Costs', actual: historicalAverages.avgDirectCosts, forecast: forecastAvg.avgDirectCosts },
                    { label: 'OpEx', actual: historicalAverages.avgOpex, forecast: forecastAvg.avgOpex },
                    { label: 'Overhead', actual: historicalAverages.avgOverhead, forecast: forecastAvg.avgOverhead },
                    { label: 'Net Income', actual: historicalAverages.avgNetIncome, forecast: forecastAvg.avgNetIncome },
                    { label: 'Gross Margin', actual: historicalAverages.grossMargin, forecast: forecastAvg.grossMargin, isPct: true },
                  ].map((item, i) => {
                    const delta = item.isPct
                      ? item.forecast - item.actual
                      : item.actual !== 0 ? ((item.forecast - item.actual) / Math.abs(item.actual)) * 100 : 0
                    const isRevenue = item.label === 'Revenue' || item.label === 'Net Income' || item.label === 'Gross Margin'
                    const deltaPositive = isRevenue ? delta >= 0 : delta <= 0
                    return (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-5 py-2.5 font-medium text-gray-700">{item.label}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">{item.isPct ? fmtPct(item.actual) : fmtCurrency(item.actual)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900">{item.isPct ? fmtPct(item.forecast) : fmtCurrency(item.forecast)}</td>
                        <td className={`px-4 py-2.5 text-right text-xs font-bold tabular-nums ${deltaPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {delta >= 0 ? '+' : ''}{delta.toFixed(1)}{item.isPct ? ' pts' : '%'}
                        </td>
                      </tr>
                    )
                  })}
                  </tbody>
                </table>
                <p className="text-[10px] text-gray-400 px-5 py-3 border-t border-gray-200">
                  Based on {historicalAverages.monthCount} month{historicalAverages.monthCount !== 1 ? 's' : ''} of actuals. <span className="text-emerald-600">Green</span> = favorable direction.
                </p>
              </div>
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Revenue & Net Income */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Revenue & Net Income</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: CHART.axis, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: CHART.axis, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip formatter={(v: number) => fmtCurrency(v)} />} />
                    <Bar dataKey="revenue" name="Revenue" fill={CHART.emerald} radius={[3, 3, 0, 0]} />
                    <Line type="monotone" dataKey="netIncome" name="Net Income" stroke={CHART.amber} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="bestNet" name="Best" stroke={CHART.emerald} strokeWidth={1} strokeDasharray="4 4" dot={false} />
                    <Line type="monotone" dataKey="worstNet" name="Worst" stroke={CHART.rose} strokeWidth={1} strokeDasharray="4 4" dot={false} />
                    <ReferenceLine y={0} stroke="#d1d5db" strokeWidth={1} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ backgroundColor: CHART.emerald }} /><span className="text-[10px] text-gray-500">Revenue</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded" style={{ backgroundColor: CHART.amber }} /><span className="text-[10px] text-gray-500">Net Income</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 border-t border-dashed" style={{ borderColor: CHART.emerald }} /><span className="text-[10px] text-gray-500">Best</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 border-t border-dashed" style={{ borderColor: CHART.rose }} /><span className="text-[10px] text-gray-500">Worst</span></div>
              </div>
            </div>

            {/* Cash Position with Scenario Cone */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Cash Position</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART.emerald} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={CHART.emerald} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={CHART.gray} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={CHART.gray} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: CHART.axis, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: CHART.axis, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip formatter={(v: number) => fmtCurrency(v)} />} />
                    <Area type="monotone" dataKey="bestCash" name="Best Case" stroke="transparent" fill="url(#bandGrad)" fillOpacity={1} />
                    <Area type="monotone" dataKey="worstCash" name="Worst Case" stroke="transparent" fill="transparent" />
                    <Area type="monotone" dataKey="endingCash" name="Base" stroke={CHART.emerald} strokeWidth={2} fill="url(#cashGrad)" />
                    <ReferenceLine y={minCashThreshold} stroke={CHART.amber} strokeDasharray="5 5" strokeWidth={1} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded" style={{ backgroundColor: CHART.emerald }} /><span className="text-[10px] text-gray-500">Base</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-gray-400/30" /><span className="text-[10px] text-gray-500">Scenario Cone</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 border-t border-dashed" style={{ borderColor: CHART.amber }} /><span className="text-[10px] text-gray-500">Min Threshold</span></div>
              </div>
            </div>
          </div>

          {/* P&L Detail Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Projected P&L Detail</h3>
              <p className="text-[10px] text-gray-400">Click a month to see line-item breakdown</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 sticky left-0 bg-gray-50">Month</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Revenue</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">COGS</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Gross Profit</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">GM%</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">OpEx</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Overhead</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Net Income</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Cash</th>
                  </tr>
                </thead>
                <tbody>
                  {baseData.map((row, i) => (
                    <React.Fragment key={i}>
                      <tr onClick={() => setExpandedMonth(expandedMonth === i ? null : i)}
                        className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                        <td className="px-4 py-2.5 font-medium text-gray-600 sticky left-0 bg-white">
                          <div className="flex items-center gap-1.5">
                            {expandedMonth === i ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronRight size={12} className="text-gray-400" />}
                            {row.month}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-emerald-600 tabular-nums">{fmtCurrency(row.revenue)}</td>
                        <td className="px-4 py-2.5 text-right text-rose-600 tabular-nums">{fmtCurrency(row.directCosts)}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700 tabular-nums">{fmtCurrency(row.grossProfit)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={row.grossMargin >= 40 ? 'text-emerald-600' : row.grossMargin >= 20 ? 'text-amber-600' : 'text-rose-600'}>
                            {fmtPct(row.grossMargin)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-rose-600 tabular-nums">{fmtCurrency(row.opex)}</td>
                        <td className="px-4 py-2.5 text-right text-rose-600 tabular-nums">{fmtCurrency(row.overhead)}</td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                          <span className={row.netIncome >= 0 ? 'text-emerald-600' : 'text-rose-600'}>{fmtCurrency(row.netIncome)}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                          <span className={row.endingCash >= minCashThreshold ? 'text-blue-600' : 'text-rose-600'}>{fmtCurrency(row.endingCash)}</span>
                        </td>
                      </tr>
                      {/* Drilldown */}
                      {expandedMonth === i && (
                        <tr>
                          <td colSpan={9} className="px-8 py-3 bg-gray-50/50 border-t border-gray-100">
                            <div className="grid grid-cols-2 gap-6">
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500 mb-2">Revenue Sources</p>
                                {row.revenueItems.length > 0 ? row.revenueItems.map((item, j) => (
                                  <div key={j} className="flex items-center justify-between py-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500">{item.category}</span>
                                      <span className="text-xs text-gray-600">{item.name}</span>
                                    </div>
                                    <span className="text-xs text-emerald-600 font-medium tabular-nums">{fmtCurrency(item.amount)}</span>
                                  </div>
                                )) : <p className="text-xs text-gray-400">No revenue items</p>}
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-rose-500 mb-2">Cost Sources</p>
                                {row.costItems.length > 0 ? row.costItems.map((item, j) => (
                                  <div key={j} className="flex items-center justify-between py-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-gray-500">{item.category}</span>
                                      <span className="text-xs text-gray-600">{item.name}</span>
                                    </div>
                                    <span className="text-xs text-rose-600 font-medium tabular-nums">{fmtCurrency(item.amount)}</span>
                                  </div>
                                )) : <p className="text-xs text-gray-400">No cost items</p>}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {/* Totals row */}
                  {baseData.length > 0 && (
                    <tr className="border-t-2 border-gray-300 bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900 sticky left-0 bg-gray-50">Total</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600 tabular-nums">{fmtCurrency(baseData.reduce((s, r) => s + r.revenue, 0))}</td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-600 tabular-nums">{fmtCurrency(baseData.reduce((s, r) => s + r.directCosts, 0))}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 tabular-nums">{fmtCurrency(baseData.reduce((s, r) => s + r.grossProfit, 0))}</td>
                      <td className="px-4 py-3 text-right text-gray-500">—</td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-600 tabular-nums">{fmtCurrency(baseData.reduce((s, r) => s + r.opex, 0))}</td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-600 tabular-nums">{fmtCurrency(baseData.reduce((s, r) => s + r.overhead, 0))}</td>
                      <td className="px-4 py-3 text-right font-bold tabular-nums">
                        <span className={baseData.reduce((s, r) => s + r.netIncome, 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {fmtCurrency(baseData.reduce((s, r) => s + r.netIncome, 0))}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-600 tabular-nums">{fmtCurrency(baseData[baseData.length - 1]?.endingCash || 0)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )
      )}

      {/* ================================================================ */}
      {/* TAB: SCENARIOS */}
      {/* ================================================================ */}
      {activeTab === 'scenarios' && (
        <div className="space-y-6">
          {/* Variance explanation */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <Layers size={18} className="text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Scenario Variance Model</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  At <span className="text-gray-900 font-medium">{forecastHorizon} months</span>, scenarios apply
                  <span className="text-emerald-600 font-medium"> Revenue ±{(variance.revUp * 100).toFixed(0)}%</span> and
                  <span className="text-amber-600 font-medium"> Expenses ±{(variance.expUp * 100).toFixed(0)}%</span> to your base assumptions.
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
              { key: 'base' as const, label: 'Base Case', data: baseData, accent: 'emerald', desc: 'Your assumptions as entered' },
              { key: 'best' as const, label: 'Best Case', data: bestData, accent: 'emerald', desc: `Revenue +${(variance.revUp * 100).toFixed(0)}%, Expenses -${(variance.expDown * 100).toFixed(0)}%` },
            ]).map(({ key, label, data, accent, desc }) => {
              const totalRev = data.reduce((s, d) => s + d.revenue, 0)
              const totalNet = data.reduce((s, d) => s + d.netIncome, 0)
              const endCash = data[data.length - 1]?.endingCash || 0
              const avgGM = data.length > 0 ? data.reduce((s, d) => s + d.grossMargin, 0) / data.length : 0
              const minCash = data.length > 0 ? Math.min(...data.map(d => d.endingCash)) : 0

              const borderColor = key === 'worst' ? 'border-rose-200' : key === 'best' ? 'border-emerald-200' : 'border-blue-200'
              const headerBg = key === 'worst' ? 'bg-rose-50' : key === 'best' ? 'bg-emerald-50' : 'bg-blue-50'
              const titleColor = key === 'worst' ? 'text-rose-600' : key === 'best' ? 'text-emerald-600' : 'text-blue-600'

              return (
                <div key={key} className={`bg-white border ${borderColor} rounded-xl overflow-hidden`}>
                  <div className={`px-5 py-3 ${headerBg} border-b ${borderColor}`}>
                    <h3 className={`text-sm font-bold ${titleColor}`}>{label}</h3>
                    <p className="text-[10px] text-gray-500 mt-0.5">{desc}</p>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="space-y-3">
                      {[
                        { label: `Revenue (${forecastHorizon}M)`, value: fmtCurrency(totalRev), color: 'text-emerald-600' },
                        { label: `Total Expenses`, value: fmtCurrency(totalRev - totalNet), color: 'text-rose-600' },
                        { label: `Net Income`, value: fmtCurrency(totalNet), color: totalNet >= 0 ? 'text-emerald-600' : 'text-rose-600' },
                        { label: `Avg Gross Margin`, value: fmtPct(avgGM), color: avgGM >= 40 ? 'text-emerald-600' : avgGM >= 20 ? 'text-amber-600' : 'text-rose-600' },
                      ].map((row, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-gray-500">{row.label}</span>
                          <span className={`font-semibold tabular-nums ${row.color}`}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                    {/* [FIX #7] Delta vs Base */}
                    {key !== 'base' && (() => {
                      const baseRev = baseData.reduce((s, d) => s + d.revenue, 0)
                      const baseNet = baseData.reduce((s, d) => s + d.netIncome, 0)
                      const baseCash = baseData[baseData.length - 1]?.endingCash || 0
                      return (
                        <div className="pt-2 border-t border-gray-100 mt-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">vs Base Case</p>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Revenue</span>
                            <span className={`font-semibold tabular-nums ${totalRev >= baseRev ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {totalRev >= baseRev ? '+' : ''}{fmtCurrency(totalRev - baseRev)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs mt-1">
                            <span className="text-gray-500">Net Income</span>
                            <span className={`font-semibold tabular-nums ${totalNet >= baseNet ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {totalNet >= baseNet ? '+' : ''}{fmtCurrency(totalNet - baseNet)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs mt-1">
                            <span className="text-gray-500">Ending Cash</span>
                            <span className={`font-semibold tabular-nums ${endCash >= baseCash ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {endCash >= baseCash ? '+' : ''}{fmtCurrency(endCash - baseCash)}
                            </span>
                          </div>
                        </div>
                      )
                    })()}
                    <div className="pt-3 border-t border-gray-200 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Ending Cash</span>
                        <span className={`font-bold tabular-nums ${endCash >= minCashThreshold ? 'text-blue-600' : 'text-rose-600'}`}>{fmtCurrency(endCash)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Lowest Cash Point</span>
                        <span className={`font-medium tabular-nums ${minCash >= minCashThreshold ? 'text-gray-600' : 'text-rose-600'}`}>{fmtCurrency(minCash)}</span>
                      </div>
                      {minCash < minCashThreshold && (
                        <div className="flex items-center gap-2 mt-2 p-2 rounded-lg bg-rose-50 border border-rose-200">
                          <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                          <span className="text-[10px] text-rose-600">Cash drops below {fmtCurrency(minCashThreshold)} threshold</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Combined scenario chart */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Cash Position — All Scenarios</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: CHART.axis, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: CHART.axis, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip formatter={(v: number) => fmtCurrency(v)} />} />
                  <Line type="monotone" dataKey="bestCash" name="Best Case" stroke={CHART.emerald} strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                  <Line type="monotone" dataKey="endingCash" name="Base Case" stroke={CHART.emerald} strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="worstCash" name="Worst Case" stroke={CHART.rose} strokeWidth={1.5} strokeDasharray="6 3" dot={false} />
                  <ReferenceLine y={minCashThreshold} stroke={CHART.amber} strokeDasharray="5 5" strokeWidth={1} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200">
              <div className="flex items-center gap-1.5"><div className="w-3 border-t-2" style={{ borderColor: CHART.emerald }} /><span className="text-[10px] text-gray-500">Best</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 border-t-2" style={{ borderColor: CHART.emerald }} /><span className="text-[10px] text-gray-500">Base</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 border-t-2" style={{ borderColor: CHART.rose }} /><span className="text-[10px] text-gray-500">Worst</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 border-t border-dashed" style={{ borderColor: CHART.amber }} /><span className="text-[10px] text-gray-500">Min Threshold</span></div>
            </div>
          </div>
        </div>
      )}

      {/* ============ CATEGORY MODAL ============ */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 rounded-xl w-full max-w-md mx-4 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">{editingCategory ? 'Edit Category' : 'Add Category'}</h3>
              <button onClick={() => setShowCategoryModal(false)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={16} className="text-gray-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Category Name</label>
                <input type="text" value={catForm.name} onChange={e => setCatForm(prev => ({ ...prev, name: e.target.value }))}
                  className={inputClass} placeholder="e.g. Client Revenue, Subcontractors, Insurance..." autoFocus />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">P&L Section</label>
                <div className="space-y-2">
                  {(Object.entries(PL_SECTIONS) as [PLSection, typeof PL_SECTIONS[PLSection]][]).map(([key, config]) => (
                    <button key={key} onClick={() => setCatForm(prev => ({ ...prev, section: key }))}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        catForm.section === key
                          ? `${config.bgColor} border ${config.borderColor}`
                          : 'bg-gray-50 border border-transparent hover:bg-gray-100'
                      }`}>
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded ${config.bgColor} ${config.textColor}`}>
                        {config.shortLabel}
                      </span>
                      <div>
                        <p className={`text-sm font-medium ${catForm.section === key ? config.textColor : 'text-gray-600'}`}>{config.label}</p>
                        <p className="text-[10px] text-gray-500">
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
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200">
              <button onClick={() => setShowCategoryModal(false)} className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">Cancel</button>
              <button onClick={saveCategory} disabled={!catForm.name.trim()}
                className="px-5 py-2.5 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                {editingCategory ? 'Save' : 'Create Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
