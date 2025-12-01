'use client'

import { useState, useMemo, useCallback } from 'react'
import { 
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, ReferenceLine
} from 'recharts'
import Papa from 'papaparse'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Upload, TrendingUp, TrendingDown, DollarSign, Calendar,
  PieChart, Settings, Database, Zap, Plus, Trash2, Download,
  ChevronDown, Filter, RefreshCw
} from 'lucide-react'

// Types
interface Transaction {
  id: string
  date: string
  category: 'revenue' | 'opex' | 'non_operational'
  description: string
  amount: number
  type: 'actual' | 'budget'
  project?: string
}

interface Assumption {
  id: string
  name: string
  category: 'revenue' | 'opex' | 'non_operational'
  amount: number
  frequency: 'monthly' | 'quarterly' | 'annually' | 'one-time'
  startDate: string
  endDate?: string
  project?: string
}

interface MonthlyData {
  month: string
  monthLabel: string
  revenue: { actual: number; budget: number; projected: number }
  opex: { actual: number; budget: number; projected: number }
  nonOperational: { actual: number; budget: number; projected: number }
  netCash: { actual: number; budget: number; projected: number }
  runningBalance: { actual: number; budget: number; projected: number }
  dataType: 'actual' | 'projected' | 'mixed'
}

// Date Range Types
type DateRangePreset = 'thisYear' | 'lastYear' | 'last12' | 'last6' | 'last3' | 'ytd' | 'all' | 'custom'

const getDateRangeFromPreset = (preset: DateRangePreset, customStart?: string, customEnd?: string): { start: string; end: string } => {
  const now = new Date()
  const currentYear = now.getFullYear()
  
  switch (preset) {
    case 'thisYear':
      return { start: `${currentYear}-01`, end: `${currentYear}-12` }
    case 'lastYear':
      return { start: `${currentYear - 1}-01`, end: `${currentYear - 1}-12` }
    case 'last12':
      const start12 = new Date(now)
      start12.setMonth(start12.getMonth() - 11)
      return { start: start12.toISOString().slice(0, 7), end: now.toISOString().slice(0, 7) }
    case 'last6':
      const start6 = new Date(now)
      start6.setMonth(start6.getMonth() - 5)
      return { start: start6.toISOString().slice(0, 7), end: now.toISOString().slice(0, 7) }
    case 'last3':
      const start3 = new Date(now)
      start3.setMonth(start3.getMonth() - 2)
      return { start: start3.toISOString().slice(0, 7), end: now.toISOString().slice(0, 7) }
    case 'ytd':
      return { start: `${currentYear}-01`, end: now.toISOString().slice(0, 7) }
    case 'custom':
      return { start: customStart || `${currentYear}-01`, end: customEnd || now.toISOString().slice(0, 7) }
    case 'all':
    default:
      return { start: '2020-01', end: `${currentYear + 3}-12` }
  }
}

// Utility functions
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

const generateId = (): string => Math.random().toString(36).substr(2, 9)

const getMonthLabel = (monthStr: string): string => {
  const [year, month] = monthStr.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1)
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

// Sample data generator
const generateSampleData = (): Transaction[] => {
  const transactions: Transaction[] = []
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  
  // Generate 12 months of historical data
  for (let i = 11; i >= 0; i--) {
    const date = new Date(currentYear, currentMonth - i, 15)
    const monthStr = date.toISOString().slice(0, 10)
    const isActual = i >= 2 // Last 10 months are actual, 2 most recent are projected
    
    // Revenue
    transactions.push({
      id: generateId(),
      date: monthStr,
      category: 'revenue',
      description: 'Consulting Services',
      amount: 45000 + Math.random() * 15000,
      type: isActual ? 'actual' : 'budget',
      project: 'Project Alpha'
    })
    
    transactions.push({
      id: generateId(),
      date: monthStr,
      category: 'revenue',
      description: 'Product Sales',
      amount: 25000 + Math.random() * 10000,
      type: isActual ? 'actual' : 'budget',
      project: 'Product Line'
    })
    
    // Budget for revenue
    transactions.push({
      id: generateId(),
      date: monthStr,
      category: 'revenue',
      description: 'Revenue Budget',
      amount: 75000,
      type: 'budget'
    })
    
    // OpEx
    transactions.push({
      id: generateId(),
      date: monthStr,
      category: 'opex',
      description: 'Payroll',
      amount: -(28000 + Math.random() * 2000),
      type: isActual ? 'actual' : 'budget'
    })
    
    transactions.push({
      id: generateId(),
      date: monthStr,
      category: 'opex',
      description: 'Office & Utilities',
      amount: -(5000 + Math.random() * 1000),
      type: isActual ? 'actual' : 'budget'
    })
    
    transactions.push({
      id: generateId(),
      date: monthStr,
      category: 'opex',
      description: 'Marketing',
      amount: -(8000 + Math.random() * 3000),
      type: isActual ? 'actual' : 'budget'
    })
    
    // Budget for OpEx
    transactions.push({
      id: generateId(),
      date: monthStr,
      category: 'opex',
      description: 'OpEx Budget',
      amount: -42000,
      type: 'budget'
    })
    
    // Non-operational (occasional)
    if (i % 3 === 0) {
      transactions.push({
        id: generateId(),
        date: monthStr,
        category: 'non_operational',
        description: 'Equipment Purchase',
        amount: -(15000 + Math.random() * 10000),
        type: isActual ? 'actual' : 'budget'
      })
    }
  }
  
  return transactions
}

// Main Component
export default function CashFlowPro() {
  // State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'data' | 'assumptions' | 'projections' | 'integrations'>('dashboard')
  const [beginningBalance, setBeginningBalance] = useState<number>(50000)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [assumptions, setAssumptions] = useState<Assumption[]>([])
  const [projectionYears, setProjectionYears] = useState<1 | 2 | 3>(1)
  const [comparisonView, setComparisonView] = useState<'mom' | 'yoy' | 'qoq' | 'project'>('mom')
  const [cutoffDate, setCutoffDate] = useState<string>(new Date().toISOString().slice(0, 7))
  const [isDragging, setIsDragging] = useState(false)
  
  // Date Range Filter State
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('thisYear')
  const [customStartDate, setCustomStartDate] = useState<string>(`${new Date().getFullYear()}-01`)
  const [customEndDate, setCustomEndDate] = useState<string>(new Date().toISOString().slice(0, 7))
  const [showDatePicker, setShowDatePicker] = useState(false)
  
  // Get active date range
  const activeDateRange = useMemo(() => {
    return getDateRangeFromPreset(dateRangePreset, customStartDate, customEndDate)
  }, [dateRangePreset, customStartDate, customEndDate])

  // New assumption form state
  const [newAssumption, setNewAssumption] = useState<Partial<Assumption>>({
    category: 'revenue',
    frequency: 'monthly',
    amount: 0
  })

  // Load sample data
  const loadSampleData = useCallback(() => {
    setTransactions(generateSampleData())
  }, [])

  // CSV Import handler
  const handleFileUpload = useCallback((file: File) => {
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const imported: Transaction[] = results.data
          .filter((row: Record<string, string>) => row.date && row.amount)
          .map((row: Record<string, string>) => ({
            id: generateId(),
            date: row.date,
            category: (row.category as Transaction['category']) || 'revenue',
            description: row.description || '',
            amount: parseFloat(row.amount) || 0,
            type: (row.type as 'actual' | 'budget') || 'actual',
            project: row.project || undefined
          }))
        setTransactions(prev => [...prev, ...imported])
      }
    })
  }, [])

  // Export transactions to CSV
  const exportToCSV = useCallback(() => {
    const csv = Papa.unparse(transactions)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'cashflow-transactions.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [transactions])

  // Add assumption
  const addAssumption = useCallback(() => {
    if (newAssumption.name && newAssumption.amount && newAssumption.startDate) {
      setAssumptions(prev => [...prev, {
        ...newAssumption,
        id: generateId()
      } as Assumption])
      setNewAssumption({
        category: 'revenue',
        frequency: 'monthly',
        amount: 0
      })
    }
  }, [newAssumption])

  // Delete assumption
  const deleteAssumption = useCallback((id: string) => {
    setAssumptions(prev => prev.filter(a => a.id !== id))
  }, [])

  // Process monthly data
  const monthlyData = useMemo((): MonthlyData[] => {
    const now = new Date()
    const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    const endDate = new Date(now.getFullYear() + projectionYears, now.getMonth(), 1)
    const months: MonthlyData[] = []
    
    let runningActual = beginningBalance
    let runningBudget = beginningBalance
    let runningProjected = beginningBalance
    
    const current = new Date(startDate)
    while (current <= endDate) {
      const monthStr = current.toISOString().slice(0, 7)
      const cutoff = new Date(cutoffDate + '-01')
      const isActualMonth = current <= cutoff
      
      // Filter transactions for this month
      const monthTransactions = transactions.filter(t => t.date.slice(0, 7) === monthStr)
      
      // Calculate actuals
      const actualRevenue = monthTransactions
        .filter(t => t.category === 'revenue' && t.type === 'actual')
        .reduce((sum, t) => sum + t.amount, 0)
      const actualOpex = monthTransactions
        .filter(t => t.category === 'opex' && t.type === 'actual')
        .reduce((sum, t) => sum + t.amount, 0)
      const actualNonOp = monthTransactions
        .filter(t => t.category === 'non_operational' && t.type === 'actual')
        .reduce((sum, t) => sum + t.amount, 0)
      
      // Calculate budget
      const budgetRevenue = monthTransactions
        .filter(t => t.category === 'revenue' && t.type === 'budget')
        .reduce((sum, t) => sum + t.amount, 0)
      const budgetOpex = monthTransactions
        .filter(t => t.category === 'opex' && t.type === 'budget')
        .reduce((sum, t) => sum + t.amount, 0)
      const budgetNonOp = monthTransactions
        .filter(t => t.category === 'non_operational' && t.type === 'budget')
        .reduce((sum, t) => sum + t.amount, 0)
      
      // Calculate projections from assumptions
      let projectedRevenue = 0
      let projectedOpex = 0
      let projectedNonOp = 0
      
      assumptions.forEach(a => {
        const aStart = new Date(a.startDate + '-01')
        const aEnd = a.endDate ? new Date(a.endDate + '-01') : endDate
        
        if (current >= aStart && current <= aEnd) {
          let amount = a.amount
          if (a.frequency === 'quarterly' && current.getMonth() % 3 !== 0) amount = 0
          if (a.frequency === 'annually' && current.getMonth() !== 0) amount = 0
          if (a.frequency === 'one-time' && current.getTime() !== aStart.getTime()) amount = 0
          
          if (a.category === 'revenue') projectedRevenue += amount
          else if (a.category === 'opex') projectedOpex += amount
          else projectedNonOp += amount
        }
      })
      
      // Use actuals if available, otherwise use projections
      const finalRevenue = isActualMonth && actualRevenue ? actualRevenue : (projectedRevenue || budgetRevenue)
      const finalOpex = isActualMonth && actualOpex ? actualOpex : (projectedOpex || budgetOpex)
      const finalNonOp = isActualMonth && actualNonOp ? actualNonOp : (projectedNonOp || budgetNonOp)
      
      const actualNet = actualRevenue + actualOpex + actualNonOp
      const budgetNet = budgetRevenue + budgetOpex + budgetNonOp
      const projectedNet = finalRevenue + finalOpex + finalNonOp
      
      runningActual += isActualMonth ? actualNet : 0
      runningBudget += budgetNet
      runningProjected += projectedNet
      
      months.push({
        month: monthStr,
        monthLabel: getMonthLabel(monthStr),
        revenue: { actual: actualRevenue, budget: budgetRevenue, projected: finalRevenue },
        opex: { actual: actualOpex, budget: budgetOpex, projected: finalOpex },
        nonOperational: { actual: actualNonOp, budget: budgetNonOp, projected: finalNonOp },
        netCash: { actual: actualNet, budget: budgetNet, projected: projectedNet },
        runningBalance: { actual: runningActual, budget: runningBudget, projected: runningProjected },
        dataType: isActualMonth ? 'actual' : 'projected'
      })
      
      current.setMonth(current.getMonth() + 1)
    }
    
    return months
  }, [transactions, assumptions, beginningBalance, projectionYears, cutoffDate])

  // Filtered monthly data based on date range
  const filteredMonthlyData = useMemo(() => {
    return monthlyData.filter(d => {
      return d.month >= activeDateRange.start && d.month <= activeDateRange.end
    })
  }, [monthlyData, activeDateRange])

  // KPI calculations
  const kpis = useMemo(() => {
    const actualData = filteredMonthlyData.filter(d => d.dataType === 'actual')
    const totalActualRevenue = actualData.reduce((sum, d) => sum + d.revenue.actual, 0)
    const totalActualOpex = actualData.reduce((sum, d) => sum + Math.abs(d.opex.actual), 0)
    const totalBudgetRevenue = actualData.reduce((sum, d) => sum + d.revenue.budget, 0)
    const totalProjectedRevenue = filteredMonthlyData.reduce((sum, d) => sum + d.revenue.projected, 0)
    const currentBalance = filteredMonthlyData[filteredMonthlyData.length - 1]?.runningBalance.projected || beginningBalance
    const budgetVariance = totalActualRevenue - totalBudgetRevenue
    
    return {
      totalActualRevenue,
      totalActualOpex,
      totalProjectedRevenue,
      currentBalance,
      budgetVariance,
      avgMonthlyRevenue: totalActualRevenue / (actualData.length || 1),
      avgMonthlyOpex: totalActualOpex / (actualData.length || 1)
    }
  }, [filteredMonthlyData, beginningBalance])

  // Chart data transformations
  const chartData = useMemo(() => {
    return filteredMonthlyData.map(d => ({
      name: d.monthLabel,
      month: d.month,
      actual: d.netCash.actual || null,
      budget: d.netCash.budget || null,
      projected: d.netCash.projected || null,
      balance: d.runningBalance.projected,
      revenue: d.revenue.actual || d.revenue.projected,
      opex: d.opex.actual || d.opex.projected,
      dataType: d.dataType
    }))
  }, [filteredMonthlyData])

  // Date range presets
  const datePresets: { key: DateRangePreset; label: string }[] = [
    { key: 'thisYear', label: 'This Year' },
    { key: 'lastYear', label: 'Last Year' },
    { key: 'last12', label: 'Last 12 Mo' },
    { key: 'last6', label: 'Last 6 Mo' },
    { key: 'last3', label: 'Last 3 Mo' },
    { key: 'ytd', label: 'YTD' },
    { key: 'all', label: 'All Data' },
    { key: 'custom', label: 'Custom' },
  ]

  // Comparison data
  const comparisonData = useMemo(() => {
    if (comparisonView === 'project') {
      const projectData: Record<string, { revenue: number; opex: number; net: number }> = {}
      transactions.forEach(t => {
        const proj = t.project || 'Unassigned'
        if (!projectData[proj]) projectData[proj] = { revenue: 0, opex: 0, net: 0 }
        if (t.category === 'revenue') projectData[proj].revenue += t.amount
        else if (t.category === 'opex') projectData[proj].opex += Math.abs(t.amount)
        projectData[proj].net += t.amount
      })
      return Object.entries(projectData).map(([name, data]) => ({ name, ...data }))
    }
    return chartData
  }, [comparisonView, transactions, chartData])

  // Tab navigation
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: PieChart },
    { id: 'data', label: 'Data Import', icon: Database },
    { id: 'assumptions', label: 'Assumptions', icon: Settings },
    { id: 'projections', label: 'Projections', icon: TrendingUp },
    { id: 'integrations', label: 'Integrations', icon: Zap }
  ]

  return (
    <div className="min-h-screen bg-terminal-bg text-zinc-100 font-body">
      {/* Header */}
      <header className="border-b border-terminal-border bg-terminal-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-terminal-bg" />
              </div>
              <div>
                <h1 className="text-xl font-display font-bold tracking-tight">CashFlow Pro</h1>
                <p className="text-xs text-zinc-500">Financial Intelligence Platform</p>
              </div>
            </div>
            
            {/* Tab Navigation */}
            <nav className="flex gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id 
                      ? 'bg-accent-primary/10 text-accent-primary' 
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-terminal-surface'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Date Range Filter */}
              <div className="flex items-center gap-4 p-4 bg-terminal-surface rounded-xl border border-terminal-border">
                <Filter className="w-5 h-5 text-zinc-400" />
                <div className="flex gap-2 flex-wrap">
                  {datePresets.map(preset => (
                    <button
                      key={preset.key}
                      onClick={() => {
                        setDateRangePreset(preset.key)
                        if (preset.key === 'custom') setShowDatePicker(true)
                        else setShowDatePicker(false)
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        dateRangePreset === preset.key
                          ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
                          : 'bg-terminal-bg text-zinc-400 hover:text-zinc-200 border border-terminal-border'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                {showDatePicker && (
                  <div className="flex items-center gap-2 ml-4">
                    <input
                      type="month"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="bg-terminal-bg border border-terminal-border rounded-lg px-3 py-1.5 text-sm"
                    />
                    <span className="text-zinc-500">to</span>
                    <input
                      type="month"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="bg-terminal-bg border border-terminal-border rounded-lg px-3 py-1.5 text-sm"
                    />
                  </div>
                )}
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-terminal-surface rounded-xl p-5 border border-terminal-border">
                  <div className="flex items-center gap-2 text-zinc-400 text-sm mb-2">
                    <TrendingUp className="w-4 h-4" />
                    Total Revenue
                  </div>
                  <div className="text-2xl font-mono font-semibold text-accent-primary">
                    {formatCurrency(kpis.totalActualRevenue)}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Avg {formatCurrency(kpis.avgMonthlyRevenue)}/mo
                  </div>
                </div>
                
                <div className="bg-terminal-surface rounded-xl p-5 border border-terminal-border">
                  <div className="flex items-center gap-2 text-zinc-400 text-sm mb-2">
                    <TrendingDown className="w-4 h-4" />
                    Total OpEx
                  </div>
                  <div className="text-2xl font-mono font-semibold text-accent-danger">
                    {formatCurrency(kpis.totalActualOpex)}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Avg {formatCurrency(kpis.avgMonthlyOpex)}/mo
                  </div>
                </div>
                
                <div className="bg-terminal-surface rounded-xl p-5 border border-terminal-border">
                  <div className="flex items-center gap-2 text-zinc-400 text-sm mb-2">
                    <DollarSign className="w-4 h-4" />
                    Current Balance
                  </div>
                  <div className="text-2xl font-mono font-semibold text-accent-secondary">
                    {formatCurrency(kpis.currentBalance)}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Projected end of period
                  </div>
                </div>
                
                <div className="bg-terminal-surface rounded-xl p-5 border border-terminal-border">
                  <div className="flex items-center gap-2 text-zinc-400 text-sm mb-2">
                    <Calendar className="w-4 h-4" />
                    Budget Variance
                  </div>
                  <div className={`text-2xl font-mono font-semibold ${kpis.budgetVariance >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                    {kpis.budgetVariance >= 0 ? '+' : ''}{formatCurrency(kpis.budgetVariance)}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    vs budget target
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-2 gap-6">
                {/* Cash Flow Chart */}
                <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                  <h3 className="text-lg font-semibold mb-4">Cash Flow Trend</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                      <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
                      <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v) => `$${v/1000}k`} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#12121a', 
                          border: '1px solid #1e1e2e',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend />
                      <Bar dataKey="actual" name="Actual" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="budget" name="Budget" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="projected" name="Projected" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                {/* Running Balance Chart */}
                <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                  <h3 className="text-lg font-semibold mb-4">Running Cash Balance</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                      <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
                      <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v) => `$${v/1000}k`} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#12121a', 
                          border: '1px solid #1e1e2e',
                          borderRadius: '8px'
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="balance" stroke="#10b981" fill="url(#balanceGradient)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Comparison View */}
              <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Comparison Analysis</h3>
                  <div className="flex gap-2">
                    {(['mom', 'yoy', 'qoq', 'project'] as const).map(view => (
                      <button
                        key={view}
                        onClick={() => setComparisonView(view)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          comparisonView === view
                            ? 'bg-accent-secondary/20 text-accent-secondary'
                            : 'bg-terminal-bg text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {view === 'mom' ? 'Month/Month' : view === 'yoy' ? 'Year/Year' : view === 'qoq' ? 'Quarter/Quarter' : 'By Project'}
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                    <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
                    <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v) => `$${v/1000}k`} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#12121a', 
                        border: '1px solid #1e1e2e',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="opex" name="OpEx" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Transaction Table */}
              {transactions.length > 0 && (
                <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Recent Transactions</h3>
                    <button
                      onClick={exportToCSV}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-terminal-bg text-zinc-400 hover:text-zinc-200 border border-terminal-border"
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-terminal-border text-left text-zinc-400 text-sm">
                          <th className="pb-3 font-medium">Date</th>
                          <th className="pb-3 font-medium">Category</th>
                          <th className="pb-3 font-medium">Description</th>
                          <th className="pb-3 font-medium text-right">Amount</th>
                          <th className="pb-3 font-medium text-center">Type</th>
                          <th className="pb-3 font-medium">Project</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.slice(0, 10).map(t => (
                          <tr key={t.id} className="border-b border-terminal-border/50 hover:bg-terminal-bg/50">
                            <td className="py-3 text-sm">{t.date}</td>
                            <td className="py-3">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                t.category === 'revenue' ? 'bg-accent-primary/10 text-accent-primary' :
                                t.category === 'opex' ? 'bg-accent-danger/10 text-accent-danger' :
                                'bg-accent-warning/10 text-accent-warning'
                              }`}>
                                {t.category}
                              </span>
                            </td>
                            <td className="text-sm">{t.description}</td>
                            <td className={`text-right font-mono text-sm ${
                              t.amount >= 0 ? 'text-accent-primary' : 'text-accent-danger'
                            }`}>
                              {formatCurrency(t.amount)}
                            </td>
                            <td className="text-center">
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                t.type === 'actual' ? 'bg-zinc-700 text-zinc-300' : 'bg-accent-warning/10 text-accent-warning'
                              }`}>
                                {t.type}
                              </span>
                            </td>
                            <td className="text-sm text-zinc-400">{t.project || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Data Import Tab */}
          {activeTab === 'data' && (
            <motion.div
              key="data"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Beginning Balance */}
              <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                <h3 className="text-lg font-semibold mb-4">Beginning Balance</h3>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                    <input
                      type="number"
                      value={beginningBalance}
                      onChange={(e) => setBeginningBalance(parseFloat(e.target.value) || 0)}
                      className="pl-10 pr-4 py-3 bg-terminal-bg border border-terminal-border rounded-lg text-xl font-mono w-64 focus:outline-none focus:border-accent-primary"
                    />
                  </div>
                  <p className="text-zinc-400 text-sm">Starting cash position for projections</p>
                </div>
              </div>

              {/* Cutoff Date */}
              <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                <h3 className="text-lg font-semibold mb-4">Actuals Cutoff Date</h3>
                <div className="flex items-center gap-4">
                  <input
                    type="month"
                    value={cutoffDate}
                    onChange={(e) => setCutoffDate(e.target.value)}
                    className="px-4 py-3 bg-terminal-bg border border-terminal-border rounded-lg font-mono focus:outline-none focus:border-accent-primary"
                  />
                  <p className="text-zinc-400 text-sm">Data after this date will be marked as projected</p>
                </div>
              </div>

              {/* File Upload */}
              <div 
                className={`bg-terminal-surface rounded-xl p-8 border-2 border-dashed transition-all ${
                  isDragging ? 'border-accent-primary bg-accent-primary/5' : 'border-terminal-border'
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragging(false)
                  const file = e.dataTransfer.files[0]
                  if (file) handleFileUpload(file)
                }}
              >
                <div className="text-center">
                  <Upload className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Import Transactions</h3>
                  <p className="text-zinc-400 mb-4">Drag & drop a CSV file or click to browse</p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(file)
                    }}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-accent-primary/10 text-accent-primary rounded-lg cursor-pointer hover:bg-accent-primary/20 transition-all"
                  >
                    <Upload className="w-5 h-5" />
                    Choose File
                  </label>
                </div>
              </div>

              {/* CSV Format Guide */}
              <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                <h3 className="text-lg font-semibold mb-4">CSV Format</h3>
                <div className="bg-terminal-bg rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <div className="text-zinc-400">date,category,description,amount,type,project</div>
                  <div className="text-accent-primary">2024-01-15,revenue,Consulting Fee,50000,actual,Project Alpha</div>
                  <div className="text-accent-danger">2024-01-01,opex,Payroll,-35000,actual,</div>
                  <div className="text-accent-warning">2024-02-15,revenue,Q1 Target,55000,budget,</div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-4">
                <button
                  onClick={loadSampleData}
                  className="flex items-center gap-2 px-6 py-3 bg-accent-secondary/10 text-accent-secondary rounded-lg hover:bg-accent-secondary/20 transition-all"
                >
                  <RefreshCw className="w-5 h-5" />
                  Load Sample Data
                </button>
                <button
                  onClick={exportToCSV}
                  disabled={transactions.length === 0}
                  className="flex items-center gap-2 px-6 py-3 bg-terminal-bg text-zinc-400 rounded-lg hover:text-zinc-200 transition-all disabled:opacity-50"
                >
                  <Download className="w-5 h-5" />
                  Export Transactions
                </button>
              </div>
            </motion.div>
          )}

          {/* Assumptions Tab */}
          {activeTab === 'assumptions' && (
            <motion.div
              key="assumptions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Add Assumption Form */}
              <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                <h3 className="text-lg font-semibold mb-4">Add New Assumption</h3>
                <div className="grid grid-cols-6 gap-4">
                  <input
                    type="text"
                    placeholder="Name"
                    value={newAssumption.name || ''}
                    onChange={(e) => setNewAssumption(prev => ({ ...prev, name: e.target.value }))}
                    className="col-span-2 px-4 py-2 bg-terminal-bg border border-terminal-border rounded-lg focus:outline-none focus:border-accent-primary"
                  />
                  <select
                    value={newAssumption.category}
                    onChange={(e) => setNewAssumption(prev => ({ ...prev, category: e.target.value as Assumption['category'] }))}
                    className="px-4 py-2 bg-terminal-bg border border-terminal-border rounded-lg focus:outline-none focus:border-accent-primary"
                  >
                    <option value="revenue">Revenue</option>
                    <option value="opex">OpEx</option>
                    <option value="non_operational">Non-Operational</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Amount"
                    value={newAssumption.amount || ''}
                    onChange={(e) => setNewAssumption(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    className="px-4 py-2 bg-terminal-bg border border-terminal-border rounded-lg focus:outline-none focus:border-accent-primary"
                  />
                  <select
                    value={newAssumption.frequency}
                    onChange={(e) => setNewAssumption(prev => ({ ...prev, frequency: e.target.value as Assumption['frequency'] }))}
                    className="px-4 py-2 bg-terminal-bg border border-terminal-border rounded-lg focus:outline-none focus:border-accent-primary"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annually">Annually</option>
                    <option value="one-time">One-time</option>
                  </select>
                  <input
                    type="month"
                    placeholder="Start Date"
                    value={newAssumption.startDate || ''}
                    onChange={(e) => setNewAssumption(prev => ({ ...prev, startDate: e.target.value }))}
                    className="px-4 py-2 bg-terminal-bg border border-terminal-border rounded-lg focus:outline-none focus:border-accent-primary"
                  />
                </div>
                <div className="grid grid-cols-6 gap-4 mt-4">
                  <input
                    type="month"
                    placeholder="End Date (optional)"
                    value={newAssumption.endDate || ''}
                    onChange={(e) => setNewAssumption(prev => ({ ...prev, endDate: e.target.value }))}
                    className="px-4 py-2 bg-terminal-bg border border-terminal-border rounded-lg focus:outline-none focus:border-accent-primary"
                  />
                  <input
                    type="text"
                    placeholder="Project (optional)"
                    value={newAssumption.project || ''}
                    onChange={(e) => setNewAssumption(prev => ({ ...prev, project: e.target.value }))}
                    className="px-4 py-2 bg-terminal-bg border border-terminal-border rounded-lg focus:outline-none focus:border-accent-primary"
                  />
                  <button
                    onClick={addAssumption}
                    className="col-span-4 flex items-center justify-center gap-2 px-6 py-2 bg-accent-primary text-terminal-bg rounded-lg font-medium hover:bg-accent-primary/90 transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    Add Assumption
                  </button>
                </div>
              </div>

              {/* Assumptions List */}
              <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                <h3 className="text-lg font-semibold mb-4">Current Assumptions</h3>
                {assumptions.length === 0 ? (
                  <p className="text-zinc-400 text-center py-8">No assumptions added yet. Add your first assumption above.</p>
                ) : (
                  <div className="space-y-3">
                    {assumptions.map(a => (
                      <div key={a.id} className="flex items-center justify-between p-4 bg-terminal-bg rounded-lg">
                        <div className="flex items-center gap-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            a.category === 'revenue' ? 'bg-accent-primary/10 text-accent-primary' :
                            a.category === 'opex' ? 'bg-accent-danger/10 text-accent-danger' :
                            'bg-accent-warning/10 text-accent-warning'
                          }`}>
                            {a.category}
                          </span>
                          <span className="font-medium">{a.name}</span>
                          <span className="text-zinc-400">{a.frequency}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`font-mono ${a.amount >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                            {formatCurrency(a.amount)}
                          </span>
                          <span className="text-zinc-400 text-sm">
                            {a.startDate} → {a.endDate || 'ongoing'}
                          </span>
                          <button
                            onClick={() => deleteAssumption(a.id)}
                            className="p-2 text-zinc-400 hover:text-accent-danger transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Projections Tab */}
          {activeTab === 'projections' && (
            <motion.div
              key="projections"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Projection Controls */}
              <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Projection Horizon</h3>
                  <div className="flex gap-2">
                    {([1, 2, 3] as const).map(years => (
                      <button
                        key={years}
                        onClick={() => setProjectionYears(years)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          projectionYears === years
                            ? 'bg-accent-primary text-terminal-bg'
                            : 'bg-terminal-bg text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {years} Year{years > 1 ? 's' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Projection Chart */}
              <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                <h3 className="text-lg font-semibold mb-4">{projectionYears}-Year Cash Flow Projection</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="projGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                    <XAxis dataKey="monthLabel" stroke="#71717a" fontSize={12} />
                    <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v) => `$${v/1000}k`} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#12121a', 
                        border: '1px solid #1e1e2e',
                        borderRadius: '8px'
                      }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                    <Area 
                      type="monotone" 
                      dataKey={(d: MonthlyData) => d.runningBalance.projected} 
                      name="Projected Balance"
                      stroke="#10b981" 
                      fill="url(#projGradient)" 
                      strokeWidth={2} 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Monthly Breakdown Table */}
              <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                <h3 className="text-lg font-semibold mb-4">Monthly Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-terminal-border text-left text-zinc-400 text-sm">
                        <th className="pb-3 font-medium">Month</th>
                        <th className="pb-3 font-medium text-right">Revenue</th>
                        <th className="pb-3 font-medium text-right">OpEx</th>
                        <th className="pb-3 font-medium text-right">Non-Op</th>
                        <th className="pb-3 font-medium text-right">Net Cash</th>
                        <th className="pb-3 font-medium text-right">Balance</th>
                        <th className="pb-3 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map(d => (
                        <tr key={d.month} className="border-b border-terminal-border/50">
                          <td className="py-3 text-sm font-medium">{d.monthLabel}</td>
                          <td className="py-3 text-right font-mono text-sm text-accent-primary">
                            {formatCurrency(d.revenue.projected)}
                          </td>
                          <td className="py-3 text-right font-mono text-sm text-accent-danger">
                            {formatCurrency(d.opex.projected)}
                          </td>
                          <td className="py-3 text-right font-mono text-sm text-accent-warning">
                            {formatCurrency(d.nonOperational.projected)}
                          </td>
                          <td className={`py-3 text-right font-mono text-sm ${d.netCash.projected >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                            {formatCurrency(d.netCash.projected)}
                          </td>
                          <td className={`py-3 text-right font-mono text-sm ${d.runningBalance.projected >= 0 ? 'text-accent-secondary' : 'text-accent-danger'}`}>
                            {formatCurrency(d.runningBalance.projected)}
                          </td>
                          <td className="py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              d.dataType === 'actual' ? 'bg-accent-primary/10 text-accent-primary' : 'bg-accent-warning/10 text-accent-warning'
                            }`}>
                              {d.dataType}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* Integrations Tab */}
          {activeTab === 'integrations' && (
            <motion.div
              key="integrations"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-3 gap-6">
                {/* Plaid */}
                <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Plaid</h3>
                      <p className="text-xs text-zinc-400">Bank Connections</p>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-400 mb-4">Connect your bank accounts to automatically import transactions.</p>
                  <button className="w-full py-2 rounded-lg bg-terminal-bg text-zinc-400 border border-terminal-border hover:border-accent-primary hover:text-accent-primary transition-all">
                    Coming Soon
                  </button>
                </div>

                {/* QuickBooks */}
                <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                      <Database className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold">QuickBooks</h3>
                      <p className="text-xs text-zinc-400">Accounting Software</p>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-400 mb-4">Sync your QuickBooks data for real-time financial tracking.</p>
                  <button className="w-full py-2 rounded-lg bg-terminal-bg text-zinc-400 border border-terminal-border hover:border-accent-primary hover:text-accent-primary transition-all">
                    Coming Soon
                  </button>
                </div>

                {/* Xero */}
                <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Xero</h3>
                      <p className="text-xs text-zinc-400">Cloud Accounting</p>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-400 mb-4">Import your Xero data to enhance cash flow projections.</p>
                  <button className="w-full py-2 rounded-lg bg-terminal-bg text-zinc-400 border border-terminal-border hover:border-accent-primary hover:text-accent-primary transition-all">
                    Coming Soon
                  </button>
                </div>
              </div>

              {/* API Info */}
              <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                <h3 className="text-lg font-semibold mb-4">API Integration Status</h3>
                <p className="text-zinc-400">
                  API integrations are currently in development. When ready, you&apos;ll be able to connect your bank accounts and accounting software to automatically sync transactions and improve projection accuracy.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-terminal-border mt-12 py-6">
        <div className="max-w-7xl mx-auto px-6 text-center text-zinc-500 text-sm">
          CashFlow Pro • Financial Intelligence Platform
        </div>
      </footer>
    </div>
  )
}
