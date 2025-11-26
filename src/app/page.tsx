'use client'

import React, { useState, useCallback, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, ReferenceLine
} from 'recharts'
import {
  Upload, Settings, TrendingUp, DollarSign, Calendar,
  ChevronDown, Plus, Trash2, Download, RefreshCw, Link2,
  BarChart3, PieChart, Target, AlertCircle, Check, X,
  FileSpreadsheet, Building2, CreditCard, Wallet
} from 'lucide-react'
import Papa from 'papaparse'

// Types
interface Transaction {
  id: string
  date: string
  category: 'revenue' | 'opex' | 'non_operational'
  description: string
  amount: number
  type: 'actual' | 'budget' | 'projected'
  project?: string
}

interface Assumption {
  id: string
  name: string
  category: 'revenue' | 'opex' | 'non_operational'
  amount: number
  frequency: 'one-time' | 'monthly' | 'quarterly' | 'annual'
  startDate: string
  endDate?: string
  project?: string
}

interface MonthlyData {
  month: string
  monthLabel: string
  year: number
  revenue: { actual: number; budget: number; projected: number }
  opex: { actual: number; budget: number; projected: number }
  nonOperational: { actual: number; budget: number; projected: number }
  netCash: { actual: number; budget: number; projected: number }
  runningBalance: { actual: number; budget: number; projected: number }
  dataType: 'actual' | 'projected' | 'mixed'
}

// Utility functions
const generateId = () => Math.random().toString(36).substring(2, 9)

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const formatCompact = (value: number): string => {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`
  }
  return `$${value.toFixed(0)}`
}

const getMonthsBetween = (start: Date, end: Date): string[] => {
  const months: string[] = []
  const current = new Date(start)
  while (current <= end) {
    months.push(current.toISOString().slice(0, 7))
    current.setMonth(current.getMonth() + 1)
  }
  return months
}

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload) return null
  
  return (
    <div className="bg-terminal-surface border border-terminal-border p-4 rounded-lg shadow-xl">
      <p className="text-accent-primary font-mono text-sm mb-2">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-zinc-400">{entry.name}:</span>
          <span className="text-white font-mono">{formatCurrency(entry.value)}</span>
        </div>
      ))}
    </div>
  )
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

  // Sample data for demo
  const loadSampleData = () => {
    const sampleTransactions: Transaction[] = []
    const months = ['2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06', 
                    '2024-07', '2024-08', '2024-09', '2024-10']
    const projects = ['Project Alpha', 'Project Beta', 'Project Gamma']
    
    months.forEach((month, idx) => {
      // Revenue - Actuals
      sampleTransactions.push({
        id: generateId(),
        date: `${month}-15`,
        category: 'revenue',
        description: 'Consulting Revenue',
        amount: 75000 + Math.random() * 25000,
        type: 'actual',
        project: projects[idx % 3]
      })
      
      // Revenue - Budget
      sampleTransactions.push({
        id: generateId(),
        date: `${month}-15`,
        category: 'revenue',
        description: 'Consulting Revenue Budget',
        amount: 80000,
        type: 'budget',
        project: projects[idx % 3]
      })
      
      // OpEx - Actuals
      sampleTransactions.push({
        id: generateId(),
        date: `${month}-01`,
        category: 'opex',
        description: 'Payroll',
        amount: -35000 - Math.random() * 5000,
        type: 'actual'
      })
      
      sampleTransactions.push({
        id: generateId(),
        date: `${month}-05`,
        category: 'opex',
        description: 'Office & Utilities',
        amount: -8000 - Math.random() * 2000,
        type: 'actual'
      })
      
      // OpEx - Budget
      sampleTransactions.push({
        id: generateId(),
        date: `${month}-01`,
        category: 'opex',
        description: 'Operating Expenses Budget',
        amount: -45000,
        type: 'budget'
      })
      
      // Non-operational
      if (idx % 3 === 0) {
        sampleTransactions.push({
          id: generateId(),
          date: `${month}-20`,
          category: 'non_operational',
          description: 'Equipment Purchase',
          amount: -15000,
          type: 'actual'
        })
      }
    })
    
    setTransactions(sampleTransactions)
    
    // Sample assumptions for projections
    setAssumptions([
      {
        id: generateId(),
        name: 'New Contract Revenue',
        category: 'revenue',
        amount: 50000,
        frequency: 'monthly',
        startDate: '2024-11',
        project: 'Project Delta'
      },
      {
        id: generateId(),
        name: 'Projected OpEx Growth',
        category: 'opex',
        amount: -48000,
        frequency: 'monthly',
        startDate: '2024-11'
      }
    ])
  }

  // CSV Import Handler
  const handleFileUpload = useCallback((file: File) => {
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const importedTransactions: Transaction[] = results.data
          .filter((row: any) => row.date && row.amount)
          .map((row: any) => ({
            id: generateId(),
            date: row.date,
            category: (row.category?.toLowerCase() || 'opex') as Transaction['category'],
            description: row.description || 'Imported Transaction',
            amount: parseFloat(row.amount) || 0,
            type: (row.type?.toLowerCase() || 'actual') as Transaction['type'],
            project: row.project || undefined
          }))
        
        setTransactions(prev => [...prev, ...importedTransactions])
      }
    })
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
      handleFileUpload(file)
    }
  }, [handleFileUpload])

  // Add new assumption
  const addAssumption = () => {
    setAssumptions(prev => [...prev, {
      id: generateId(),
      name: '',
      category: 'revenue',
      amount: 0,
      frequency: 'monthly',
      startDate: cutoffDate
    }])
  }

  const updateAssumption = (id: string, updates: Partial<Assumption>) => {
    setAssumptions(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a))
  }

  const deleteAssumption = (id: string) => {
    setAssumptions(prev => prev.filter(a => a.id !== id))
  }

  // Calculate monthly data
  const monthlyData = useMemo((): MonthlyData[] => {
    const today = new Date()
    const startDate = new Date(Math.min(
      ...transactions.map(t => new Date(t.date).getTime()),
      today.getTime() - 365 * 24 * 60 * 60 * 1000
    ))
    
    const endDate = new Date(today)
    endDate.setFullYear(endDate.getFullYear() + projectionYears)
    
    const months = getMonthsBetween(startDate, endDate)
    let runningActual = beginningBalance
    let runningBudget = beginningBalance
    let runningProjected = beginningBalance

    return months.map(month => {
      const monthTransactions = transactions.filter(t => t.date.startsWith(month))
      const isPast = month <= cutoffDate
      
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
      let projRevenue = 0
      let projOpex = 0
      let projNonOp = 0

      if (!isPast) {
        assumptions.forEach(a => {
          if (month >= a.startDate && (!a.endDate || month <= a.endDate)) {
            const amount = a.frequency === 'one-time' && month !== a.startDate ? 0 :
                          a.frequency === 'quarterly' && (parseInt(month.slice(5)) - parseInt(a.startDate.slice(5))) % 3 !== 0 ? 0 :
                          a.frequency === 'annual' && month.slice(5) !== a.startDate.slice(5) ? 0 :
                          a.amount

            if (a.category === 'revenue') projRevenue += amount
            else if (a.category === 'opex') projOpex += amount
            else projNonOp += amount
          }
        })
      }

      const actualNet = actualRevenue + actualOpex + actualNonOp
      const budgetNet = budgetRevenue + budgetOpex + budgetNonOp
      const projectedNet = projRevenue + projOpex + projNonOp

      runningActual += isPast ? actualNet : 0
      runningBudget += budgetNet || (isPast ? actualNet : 0)
      runningProjected += isPast ? actualNet : projectedNet

      const [year, monthNum] = month.split('-')
      const monthLabel = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('en-US', { 
        month: 'short', year: '2-digit' 
      })

      return {
        month,
        monthLabel,
        year: parseInt(year),
        revenue: { 
          actual: isPast ? actualRevenue : 0, 
          budget: budgetRevenue, 
          projected: !isPast ? projRevenue : 0 
        },
        opex: { 
          actual: isPast ? Math.abs(actualOpex) : 0, 
          budget: Math.abs(budgetOpex), 
          projected: !isPast ? Math.abs(projOpex) : 0 
        },
        nonOperational: { 
          actual: isPast ? Math.abs(actualNonOp) : 0, 
          budget: Math.abs(budgetNonOp), 
          projected: !isPast ? Math.abs(projNonOp) : 0 
        },
        netCash: { 
          actual: isPast ? actualNet : 0, 
          budget: budgetNet, 
          projected: !isPast ? projectedNet : 0 
        },
        runningBalance: { 
          actual: runningActual, 
          budget: runningBudget, 
          projected: runningProjected 
        },
        dataType: isPast ? 'actual' : 'projected'
      }
    })
  }, [transactions, assumptions, beginningBalance, projectionYears, cutoffDate])

  // KPI Calculations
  const kpis = useMemo(() => {
    const actualData = monthlyData.filter(d => d.dataType === 'actual')
    const projectedData = monthlyData.filter(d => d.dataType === 'projected')
    
    const totalActualRevenue = actualData.reduce((sum, d) => sum + d.revenue.actual, 0)
    const totalActualOpex = actualData.reduce((sum, d) => sum + d.opex.actual, 0)
    const totalProjectedRevenue = projectedData.reduce((sum, d) => sum + d.revenue.projected, 0)
    const totalBudgetRevenue = monthlyData.reduce((sum, d) => sum + d.revenue.budget, 0)
    
    const currentBalance = monthlyData[monthlyData.length - 1]?.runningBalance.projected || beginningBalance
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
  }, [monthlyData, beginningBalance])

  // Chart data transformations
  const chartData = useMemo(() => {
    return monthlyData.map(d => ({
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
  }, [monthlyData])

  // Render functions
  const renderDashboard = () => (
    <div className="space-y-6 animate-fade-in">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-terminal-surface border border-terminal-border rounded-xl p-5 card-hover">
          <div className="flex items-center justify-between mb-3">
            <span className="text-zinc-500 text-sm font-medium">Current Balance</span>
            <Wallet className="w-5 h-5 text-accent-primary" />
          </div>
          <p className="text-2xl font-mono text-white">{formatCurrency(kpis.currentBalance)}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded bg-accent-primary/10 text-accent-primary">
              Projected EOY
            </span>
          </div>
        </div>

        <div className="bg-terminal-surface border border-terminal-border rounded-xl p-5 card-hover">
          <div className="flex items-center justify-between mb-3">
            <span className="text-zinc-500 text-sm font-medium">Total Revenue (Actual)</span>
            <TrendingUp className="w-5 h-5 text-accent-secondary" />
          </div>
          <p className="text-2xl font-mono text-white">{formatCurrency(kpis.totalActualRevenue)}</p>
          <p className="text-xs text-zinc-500 mt-2">
            Avg: {formatCurrency(kpis.avgMonthlyRevenue)}/mo
          </p>
        </div>

        <div className="bg-terminal-surface border border-terminal-border rounded-xl p-5 card-hover">
          <div className="flex items-center justify-between mb-3">
            <span className="text-zinc-500 text-sm font-medium">Total OpEx (Actual)</span>
            <CreditCard className="w-5 h-5 text-accent-warning" />
          </div>
          <p className="text-2xl font-mono text-white">{formatCurrency(kpis.totalActualOpex)}</p>
          <p className="text-xs text-zinc-500 mt-2">
            Avg: {formatCurrency(kpis.avgMonthlyOpex)}/mo
          </p>
        </div>

        <div className="bg-terminal-surface border border-terminal-border rounded-xl p-5 card-hover">
          <div className="flex items-center justify-between mb-3">
            <span className="text-zinc-500 text-sm font-medium">Budget Variance</span>
            <Target className="w-5 h-5 text-accent-danger" />
          </div>
          <p className={`text-2xl font-mono ${kpis.budgetVariance >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
            {kpis.budgetVariance >= 0 ? '+' : ''}{formatCurrency(kpis.budgetVariance)}
          </p>
          <p className="text-xs text-zinc-500 mt-2">vs Budget</p>
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-display font-semibold text-white">Cash Flow Overview</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-accent-primary" />
              <span className="text-xs text-zinc-400">Actual</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-accent-secondary" />
              <span className="text-xs text-zinc-400">Projected</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-accent-warning" />
              <span className="text-xs text-zinc-400">Budget</span>
            </div>
          </div>
        </div>
        
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
            <XAxis dataKey="name" stroke="#71717a" fontSize={11} />
            <YAxis stroke="#71717a" fontSize={11} tickFormatter={formatCompact} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#3a3a4a" />
            <Bar dataKey="actual" fill="#00ff88" radius={[4, 4, 0, 0]} />
            <Bar dataKey="projected" fill="#00d4ff" radius={[4, 4, 0, 0]} />
            <Line 
              type="monotone" 
              dataKey="budget" 
              stroke="#ffaa00" 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Secondary Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Running Balance */}
        <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
          <h3 className="text-lg font-display font-semibold text-white mb-6">Running Balance</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00ff88" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#00ff88" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis dataKey="name" stroke="#71717a" fontSize={11} />
              <YAxis stroke="#71717a" fontSize={11} tickFormatter={formatCompact} />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="balance" 
                stroke="#00ff88" 
                fill="url(#balanceGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue vs OpEx */}
        <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
          <h3 className="text-lg font-display font-semibold text-white mb-6">Revenue vs OpEx</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis dataKey="name" stroke="#71717a" fontSize={11} />
              <YAxis stroke="#71717a" fontSize={11} tickFormatter={formatCompact} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" name="Revenue" fill="#00ff88" radius={[4, 4, 0, 0]} />
              <Bar dataKey="opex" name="OpEx" fill="#ff4466" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Actual vs Projected Table */}
      <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-display font-semibold text-white">Actual vs Projected Breakdown</h3>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1 text-accent-primary">
              <Check className="w-3 h-3" /> Actual
            </span>
            <span className="flex items-center gap-1 text-accent-secondary">
              <AlertCircle className="w-3 h-3" /> Projected
            </span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="text-left text-zinc-400">Period</th>
                <th className="text-right text-zinc-400">Status</th>
                <th className="text-right text-zinc-400">Revenue</th>
                <th className="text-right text-zinc-400">OpEx</th>
                <th className="text-right text-zinc-400">Other</th>
                <th className="text-right text-zinc-400">Net Cash</th>
                <th className="text-right text-zinc-400">Balance</th>
              </tr>
            </thead>
            <tbody>
              {monthlyData.slice(-12).map(d => (
                <tr key={d.month}>
                  <td className="font-mono text-sm">{d.monthLabel}</td>
                  <td className="text-right">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                      d.dataType === 'actual' 
                        ? 'bg-accent-primary/10 text-accent-primary' 
                        : 'bg-accent-secondary/10 text-accent-secondary'
                    }`}>
                      {d.dataType === 'actual' ? <Check className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                      {d.dataType}
                    </span>
                  </td>
                  <td className="text-right font-mono text-sm text-accent-primary">
                    {formatCurrency(d.revenue.actual || d.revenue.projected)}
                  </td>
                  <td className="text-right font-mono text-sm text-accent-danger">
                    {formatCurrency(-(d.opex.actual || d.opex.projected))}
                  </td>
                  <td className="text-right font-mono text-sm text-accent-warning">
                    {formatCurrency(-(d.nonOperational.actual || d.nonOperational.projected))}
                  </td>
                  <td className={`text-right font-mono text-sm ${
                    (d.netCash.actual || d.netCash.projected) >= 0 ? 'text-accent-primary' : 'text-accent-danger'
                  }`}>
                    {formatCurrency(d.netCash.actual || d.netCash.projected)}
                  </td>
                  <td className="text-right font-mono text-sm text-white">
                    {formatCurrency(d.runningBalance.projected)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderDataImport = () => (
    <div className="space-y-6 animate-fade-in">
      {/* Beginning Balance */}
      <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
        <h3 className="text-lg font-display font-semibold text-white mb-4">Beginning Balance</h3>
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-xs">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              type="number"
              value={beginningBalance}
              onChange={(e) => setBeginningBalance(parseFloat(e.target.value) || 0)}
              className="w-full bg-terminal-bg border border-terminal-border rounded-lg py-3 pl-10 pr-4 text-white font-mono focus:outline-none focus:border-accent-primary"
              placeholder="Enter beginning balance"
            />
          </div>
          <p className="text-sm text-zinc-500">Starting cash position for projections</p>
        </div>
      </div>

      {/* Cutoff Date */}
      <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
        <h3 className="text-lg font-display font-semibold text-white mb-4">Actual Data Cutoff</h3>
        <div className="flex items-center gap-4">
          <input
            type="month"
            value={cutoffDate}
            onChange={(e) => setCutoffDate(e.target.value)}
            className="bg-terminal-bg border border-terminal-border rounded-lg py-3 px-4 text-white font-mono focus:outline-none focus:border-accent-primary"
          />
          <p className="text-sm text-zinc-500">Data after this date will be shown as "Projected"</p>
        </div>
      </div>

      {/* File Upload */}
      <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
        <h3 className="text-lg font-display font-semibold text-white mb-4">Import Transactions</h3>
        
        <div
          className={`drop-zone rounded-xl p-12 text-center ${isDragging ? 'active' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <Upload className="w-12 h-12 text-zinc-500 mx-auto mb-4" />
          <p className="text-zinc-400 mb-2">Drag and drop your CSV file here</p>
          <p className="text-zinc-600 text-sm mb-4">or</p>
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-accent-primary/10 text-accent-primary rounded-lg cursor-pointer hover:bg-accent-primary/20 transition-colors">
            <FileSpreadsheet className="w-4 h-4" />
            Browse Files
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
            />
          </label>
        </div>

        <div className="mt-6 p-4 bg-terminal-bg rounded-lg">
          <p className="text-sm text-zinc-400 mb-2">Expected CSV format:</p>
          <code className="text-xs text-accent-primary font-mono block">
            date, category, description, amount, type, project
          </code>
          <p className="text-xs text-zinc-500 mt-2">
            Categories: revenue, opex, non_operational | Types: actual, budget
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-4">
        <button
          onClick={loadSampleData}
          className="flex items-center gap-2 px-4 py-2 bg-accent-secondary/10 text-accent-secondary rounded-lg hover:bg-accent-secondary/20 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Load Sample Data
        </button>
        
        <button
          onClick={() => setTransactions([])}
          className="flex items-center gap-2 px-4 py-2 bg-accent-danger/10 text-accent-danger rounded-lg hover:bg-accent-danger/20 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Clear All Data
        </button>
      </div>

      {/* Transaction List */}
      {transactions.length > 0 && (
        <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-display font-semibold text-white">
              Imported Transactions ({transactions.length})
            </h3>
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm bg-terminal-bg border border-terminal-border rounded-lg hover:border-accent-primary transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
          
          <div className="overflow-x-auto max-h-96">
            <table className="data-table w-full">
              <thead className="sticky top-0">
                <tr>
                  <th className="text-left text-zinc-400">Date</th>
                  <th className="text-left text-zinc-400">Category</th>
                  <th className="text-left text-zinc-400">Description</th>
                  <th className="text-right text-zinc-400">Amount</th>
                  <th className="text-center text-zinc-400">Type</th>
                  <th className="text-left text-zinc-400">Project</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 50).map(t => (
                  <tr key={t.id}>
                    <td className="font-mono text-sm">{t.date}</td>
                    <td>
                      <span className={`px-2 py-0.5 rounded text-xs ${
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
    </div>
  )

  const renderAssumptions = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-display font-semibold text-white">Projection Assumptions</h3>
            <p className="text-sm text-zinc-500 mt-1">Add expected income and expenses for future periods</p>
          </div>
          <button
            onClick={addAssumption}
            className="flex items-center gap-2 px-4 py-2 bg-accent-primary text-terminal-bg rounded-lg font-medium hover:bg-accent-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Assumption
          </button>
        </div>

        {assumptions.length === 0 ? (
          <div className="text-center py-12 text-zinc-500">
            <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No assumptions added yet</p>
            <p className="text-sm mt-1">Add assumptions to project future cash flows</p>
          </div>
        ) : (
          <div className="space-y-4">
            {assumptions.map((a, idx) => (
              <div 
                key={a.id} 
                className="bg-terminal-bg border border-terminal-border rounded-lg p-4"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-xs text-zinc-500 mb-1 block">Name</label>
                    <input
                      type="text"
                      value={a.name}
                      onChange={(e) => updateAssumption(a.id, { name: e.target.value })}
                      className="w-full bg-terminal-surface border border-terminal-border rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-accent-primary"
                      placeholder="e.g., New Client Contract"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Category</label>
                    <select
                      value={a.category}
                      onChange={(e) => updateAssumption(a.id, { category: e.target.value as Assumption['category'] })}
                      className="w-full bg-terminal-surface border border-terminal-border rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-accent-primary"
                    >
                      <option value="revenue">Revenue</option>
                      <option value="opex">OpEx</option>
                      <option value="non_operational">Non-Op</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Amount</label>
                    <input
                      type="number"
                      value={a.amount}
                      onChange={(e) => updateAssumption(a.id, { amount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-terminal-surface border border-terminal-border rounded-lg py-2 px-3 text-white text-sm font-mono focus:outline-none focus:border-accent-primary"
                      placeholder="0"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Frequency</label>
                    <select
                      value={a.frequency}
                      onChange={(e) => updateAssumption(a.id, { frequency: e.target.value as Assumption['frequency'] })}
                      className="w-full bg-terminal-surface border border-terminal-border rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-accent-primary"
                    >
                      <option value="one-time">One-time</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </div>
                  
                  <div className="flex items-end">
                    <button
                      onClick={() => deleteAssumption(a.id)}
                      className="p-2 text-accent-danger hover:bg-accent-danger/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Start Date</label>
                    <input
                      type="month"
                      value={a.startDate}
                      onChange={(e) => updateAssumption(a.id, { startDate: e.target.value })}
                      className="w-full bg-terminal-surface border border-terminal-border rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-accent-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">End Date (optional)</label>
                    <input
                      type="month"
                      value={a.endDate || ''}
                      onChange={(e) => updateAssumption(a.id, { endDate: e.target.value || undefined })}
                      className="w-full bg-terminal-surface border border-terminal-border rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-accent-primary"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-zinc-500 mb-1 block">Project (optional)</label>
                    <input
                      type="text"
                      value={a.project || ''}
                      onChange={(e) => updateAssumption(a.id, { project: e.target.value || undefined })}
                      className="w-full bg-terminal-surface border border-terminal-border rounded-lg py-2 px-3 text-white text-sm focus:outline-none focus:border-accent-primary"
                      placeholder="e.g., Project Delta"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const renderProjections = () => (
    <div className="space-y-6 animate-fade-in">
      {/* Projection Settings */}
      <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-display font-semibold text-white">Projection Settings</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500">Forecast Period:</span>
            {[1, 2, 3].map(years => (
              <button
                key={years}
                onClick={() => setProjectionYears(years as 1 | 2 | 3)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  projectionYears === years
                    ? 'bg-accent-primary text-terminal-bg'
                    : 'bg-terminal-bg border border-terminal-border text-zinc-400 hover:border-accent-primary'
                }`}
              >
                {years} Year{years > 1 ? 's' : ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Comparison Views */}
      <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-display font-semibold text-white">Comparison Analysis</h3>
          <div className="flex items-center gap-2">
            {[
              { key: 'mom', label: 'MoM' },
              { key: 'yoy', label: 'YoY' },
              { key: 'qoq', label: 'QoQ' },
              { key: 'project', label: 'By Project' }
            ].map(view => (
              <button
                key={view.key}
                onClick={() => setComparisonView(view.key as typeof comparisonView)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  comparisonView === view.key
                    ? 'bg-accent-secondary text-terminal-bg'
                    : 'bg-terminal-bg border border-terminal-border text-zinc-400 hover:border-accent-secondary'
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
            <XAxis dataKey="name" stroke="#71717a" fontSize={11} />
            <YAxis stroke="#71717a" fontSize={11} tickFormatter={formatCompact} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar 
              dataKey="actual" 
              name="Actual" 
              fill="#00ff88" 
              radius={[4, 4, 0, 0]} 
            />
            <Bar 
              dataKey="projected" 
              name="Projected" 
              fill="#00d4ff" 
              radius={[4, 4, 0, 0]} 
            />
            <Line 
              type="monotone" 
              dataKey="budget" 
              name="Budget"
              stroke="#ffaa00" 
              strokeWidth={2}
              dot={{ fill: '#ffaa00', strokeWidth: 0 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Projection Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-accent-primary/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-accent-primary" />
            </div>
            <div>
              <p className="text-zinc-500 text-sm">Projected Revenue</p>
              <p className="text-xl font-mono text-white">{formatCurrency(kpis.totalProjectedRevenue)}</p>
            </div>
          </div>
          <p className="text-xs text-zinc-500">Next {projectionYears} year{projectionYears > 1 ? 's' : ''}</p>
        </div>

        <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-accent-secondary/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-accent-secondary" />
            </div>
            <div>
              <p className="text-zinc-500 text-sm">Projected EOY Balance</p>
              <p className="text-xl font-mono text-white">{formatCurrency(kpis.currentBalance)}</p>
            </div>
          </div>
          <p className="text-xs text-zinc-500">Based on current assumptions</p>
        </div>

        <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-accent-warning/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-accent-warning" />
            </div>
            <div>
              <p className="text-zinc-500 text-sm">Assumptions Active</p>
              <p className="text-xl font-mono text-white">{assumptions.length}</p>
            </div>
          </div>
          <p className="text-xs text-zinc-500">Feeding projections</p>
        </div>
      </div>
    </div>
  )

  const renderIntegrations = () => (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
        <h3 className="text-lg font-display font-semibold text-white mb-2">API Integrations</h3>
        <p className="text-zinc-500 text-sm mb-6">Connect your financial accounts for automatic data sync</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: 'QuickBooks', icon: Building2, status: 'coming_soon', color: '#2CA01C' },
            { name: 'Xero', icon: PieChart, status: 'coming_soon', color: '#13B5EA' },
            { name: 'Plaid', icon: Link2, status: 'coming_soon', color: '#0A85D1' },
            { name: 'Stripe', icon: CreditCard, status: 'coming_soon', color: '#635BFF' },
            { name: 'Bank of America', icon: Building2, status: 'coming_soon', color: '#012169' },
            { name: 'Chase', icon: Building2, status: 'coming_soon', color: '#117ACA' },
          ].map(integration => (
            <div 
              key={integration.name}
              className="bg-terminal-bg border border-terminal-border rounded-xl p-5 card-hover"
            >
              <div className="flex items-start justify-between mb-4">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${integration.color}20` }}
                >
                  <integration.icon className="w-6 h-6" style={{ color: integration.color }} />
                </div>
                <span className="px-2 py-1 rounded text-xs bg-accent-warning/10 text-accent-warning">
                  Coming Soon
                </span>
              </div>
              <h4 className="text-white font-medium mb-1">{integration.name}</h4>
              <p className="text-zinc-500 text-sm">Connect your {integration.name} account</p>
              <button 
                disabled
                className="mt-4 w-full py-2 rounded-lg text-sm font-medium bg-terminal-border text-zinc-500 cursor-not-allowed"
              >
                Connect
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Webhook Setup */}
      <div className="bg-terminal-surface border border-terminal-border rounded-xl p-6">
        <h3 className="text-lg font-display font-semibold text-white mb-2">Webhook Configuration</h3>
        <p className="text-zinc-500 text-sm mb-6">Set up webhooks for real-time data updates</p>
        
        <div className="bg-terminal-bg rounded-lg p-4 mb-4">
          <label className="text-xs text-zinc-500 mb-2 block">Your Webhook Endpoint</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-terminal-surface border border-terminal-border rounded px-3 py-2 text-sm font-mono text-accent-primary">
              https://your-domain.com/api/webhooks/cashflow
            </code>
            <button className="p-2 bg-accent-primary/10 text-accent-primary rounded hover:bg-accent-primary/20 transition-colors">
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <p className="text-xs text-zinc-500">
          Configure your accounting software to send transaction data to this endpoint for automatic imports.
        </p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-terminal-bg grid-pattern noise-overlay relative">
      {/* Header */}
      <header className="border-b border-terminal-border bg-terminal-surface/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-terminal-bg" />
              </div>
              <div>
                <h1 className="text-xl font-display font-bold text-white">CashFlow Pro</h1>
                <p className="text-xs text-zinc-500">Business Cash Management</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-xs text-zinc-500 font-mono">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
              <button className="p-2 hover:bg-terminal-border rounded-lg transition-colors">
                <Settings className="w-5 h-5 text-zinc-400" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b border-terminal-border bg-terminal-surface/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-1">
            {[
              { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { key: 'data', label: 'Data Import', icon: Upload },
              { key: 'assumptions', label: 'Assumptions', icon: Settings },
              { key: 'projections', label: 'Projections', icon: TrendingUp },
              { key: 'integrations', label: 'Integrations', icon: Link2 },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab.key
                    ? 'text-accent-primary tab-active'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'data' && renderDataImport()}
        {activeTab === 'assumptions' && renderAssumptions()}
        {activeTab === 'projections' && renderProjections()}
        {activeTab === 'integrations' && renderIntegrations()}
      </main>

      {/* Footer */}
      <footer className="border-t border-terminal-border bg-terminal-surface/50 mt-12">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>CashFlow Pro v1.0.0</span>
            <span>Data refreshed: {new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
