'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { 
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, ReferenceLine, Cell, PieChart, Pie
} from 'recharts'
import Papa from 'papaparse'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Upload, TrendingUp, TrendingDown, DollarSign, Calendar,
  PieChart, Settings, Database, Zap, Plus, Trash2, Download,
  Filter, RefreshCw, Edit2, X, Check, Building2
} from 'lucide-react'

// Types
interface Transaction {
  id: string
  date: string
  category: 'revenue' | 'opex' | 'overhead' | 'investment'
  description: string
  amount: number
  type: 'actual' | 'budget'
  project?: string
}

interface Assumption {
  id: string
  name: string
  category: 'revenue' | 'opex' | 'overhead' | 'investment'
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
  overhead: { actual: number; budget: number; projected: number }
  investment: { actual: number; budget: number; projected: number }
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

const formatPercent = (value: number): string => {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
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
  
  const projects = ['Project Alpha', 'Project Beta', 'Product Line', 'Services']
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date(currentYear, currentMonth - i, 15)
    const monthStr = date.toISOString().slice(0, 10)
    const isActual = i >= 2
    
    // Revenue
    transactions.push({
      id: generateId(),
      date: monthStr,
      category: 'revenue',
      description: 'Consulting Services',
      amount: 45000 + Math.random() * 15000,
      type: isActual ? 'actual' : 'budget',
      project: projects[0]
    })
    
    transactions.push({
      id: generateId(),
      date: monthStr,
      category: 'revenue',
      description: 'Product Sales',
      amount: 25000 + Math.random() * 10000,
      type: isActual ? 'actual' : 'budget',
      project: projects[2]
    })
    
    transactions.push({
      id: generateId(),
      date: monthStr,
      category: 'revenue',
      description: 'Service Contracts',
      amount: 15000 + Math.random() * 5000,
      type: isActual ? 'actual' : 'budget',
      project: projects[3]
    })
    
    // OpEx - Project-specific costs (labor, travel)
    transactions.push({
      id: generateId(),
      date: monthStr,
      category: 'opex',
      description: 'Project Labor',
      amount: -(15000 + Math.random() * 3000),
      type: isActual ? 'actual' : 'budget',
      project: projects[Math.floor(Math.random() * 4)]
    })
    
    transactions.push({
      id: generateId(),
      date: monthStr,
      category: 'opex',
      description: 'Travel Expenses',
      amount: -(3000 + Math.random() * 2000),
      type: isActual ? 'actual' : 'budget',
      project: projects[Math.floor(Math.random() * 4)]
    })
    
    // Overhead - Company-wide costs
    transactions.push({
      id: generateId(),
      date: monthStr,
      category: 'overhead',
      description: 'Admin Payroll',
      amount: -(12000 + Math.random() * 2000),
      type: isActual ? 'actual' : 'budget'
    })
    
    transactions.push({
      id: generateId(),
      date: monthStr,
      category: 'overhead',
      description: 'Office & Utilities',
      amount: -(5000 + Math.random() * 1000),
      type: isActual ? 'actual' : 'budget'
    })
    
    transactions.push({
      id: generateId(),
      date: monthStr,
      category: 'overhead',
      description: 'Insurance & Legal',
      amount: -(3000 + Math.random() * 500),
      type: isActual ? 'actual' : 'budget'
    })
    
    // Investment - Capital/Strategic
    if (i % 3 === 0) {
      transactions.push({
        id: generateId(),
        date: monthStr,
        category: 'investment',
        description: 'Equipment Purchase',
        amount: -(15000 + Math.random() * 10000),
        type: isActual ? 'actual' : 'budget',
        project: projects[1]
      })
    }
    
    if (i % 4 === 0) {
      transactions.push({
        id: generateId(),
        date: monthStr,
        category: 'investment',
        description: 'R&D Initiative',
        amount: -(8000 + Math.random() * 5000),
        type: isActual ? 'actual' : 'budget'
      })
    }
  }
  
  return transactions
}

// Local Storage Keys
const STORAGE_KEYS = {
  transactions: 'cashflow_transactions',
  assumptions: 'cashflow_assumptions',
  beginningBalance: 'cashflow_beginning_balance',
  cutoffDate: 'cashflow_cutoff_date'
}

// Main Component
export default function CashFlowPro() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'data' | 'assumptions' | 'projections' | 'integrations'>('dashboard')
  const [beginningBalance, setBeginningBalance] = useState<number>(50000)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [assumptions, setAssumptions] = useState<Assumption[]>([])
  const [projectionYears, setProjectionYears] = useState<1 | 2 | 3>(1)
  const [comparisonView, setComparisonView] = useState<'mom' | 'yoy' | 'qoq' | 'project'>('mom')
  const [cutoffDate, setCutoffDate] = useState<string>(new Date().toISOString().slice(0, 7))
  const [isDragging, setIsDragging] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('thisYear')
  const [customStartDate, setCustomStartDate] = useState<string>(`${new Date().getFullYear()}-01`)
  const [customEndDate, setCustomEndDate] = useState<string>(new Date().toISOString().slice(0, 7))
  const [showDatePicker, setShowDatePicker] = useState(false)
  
  const [selectedProject, setSelectedProject] = useState<string>('all')
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Transaction>>({})
  const [transactionMonthFilter, setTransactionMonthFilter] = useState<string>('all')

  const [newAssumption, setNewAssumption] = useState<Partial<Assumption>>({
    name: '',
    category: 'revenue',
    frequency: 'monthly',
    amount: 0,
    startDate: new Date().toISOString().slice(0, 7)
  })

  // Load data from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTransactions = localStorage.getItem(STORAGE_KEYS.transactions)
      const savedAssumptions = localStorage.getItem(STORAGE_KEYS.assumptions)
      const savedBalance = localStorage.getItem(STORAGE_KEYS.beginningBalance)
      const savedCutoff = localStorage.getItem(STORAGE_KEYS.cutoffDate)
      
      if (savedTransactions) setTransactions(JSON.parse(savedTransactions))
      if (savedAssumptions) setAssumptions(JSON.parse(savedAssumptions))
      if (savedBalance) setBeginningBalance(parseFloat(savedBalance))
      if (savedCutoff) setCutoffDate(savedCutoff)
      
      setIsLoaded(true)
    }
  }, [])

  // Save to localStorage
  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions))
    }
  }, [transactions, isLoaded])

  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.assumptions, JSON.stringify(assumptions))
    }
  }, [assumptions, isLoaded])

  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.beginningBalance, beginningBalance.toString())
    }
  }, [beginningBalance, isLoaded])

  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.cutoffDate, cutoffDate)
    }
  }, [cutoffDate, isLoaded])
  
  const activeDateRange = useMemo(() => {
    return getDateRangeFromPreset(dateRangePreset, customStartDate, customEndDate)
  }, [dateRangePreset, customStartDate, customEndDate])

  const projectList = useMemo(() => {
    const projects = new Set<string>()
    transactions.forEach(t => {
      if (t.project) projects.add(t.project)
    })
    return Array.from(projects).sort()
  }, [transactions])

  const transactionMonths = useMemo(() => {
    const months = new Set<string>()
    transactions.forEach(t => {
      months.add(t.date.slice(0, 7))
    })
    return Array.from(months).sort().reverse()
  }, [transactions])

  const loadSampleData = useCallback(() => {
    setTransactions(generateSampleData())
  }, [])

  const clearAllData = useCallback(() => {
    if (confirm('Are you sure you want to delete all transactions? This cannot be undone.')) {
      setTransactions([])
    }
  }, [])

  const handleFileUpload = useCallback((file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      complete: (results) => {
        const imported: Transaction[] = results.data
          .filter((row) => row.date && row.amount)
          .map((row) => ({
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

  const deleteTransaction = useCallback((id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id))
  }, [])

  const startEdit = useCallback((transaction: Transaction) => {
    setEditingId(transaction.id)
    setEditForm({
      category: transaction.category,
      type: transaction.type,
      project: transaction.project || '',
      description: transaction.description,
      amount: transaction.amount,
      date: transaction.date
    })
  }, [])

  const saveEdit = useCallback(() => {
    if (editingId) {
      setTransactions(prev => prev.map(t => 
        t.id === editingId 
          ? { ...t, ...editForm }
          : t
      ))
      setEditingId(null)
      setEditForm({})
    }
  }, [editingId, editForm])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditForm({})
  }, [])

  const addAssumption = useCallback(() => {
    if (newAssumption.name && newAssumption.amount !== undefined && newAssumption.startDate) {
      const assumption: Assumption = {
        id: generateId(),
        name: newAssumption.name,
        category: newAssumption.category || 'revenue',
        amount: newAssumption.amount,
        frequency: newAssumption.frequency || 'monthly',
        startDate: newAssumption.startDate,
        endDate: newAssumption.endDate,
        project: newAssumption.project
      }
      setAssumptions(prev => [...prev, assumption])
      setNewAssumption({
        name: '',
        category: 'revenue',
        frequency: 'monthly',
        amount: 0,
        startDate: new Date().toISOString().slice(0, 7)
      })
    }
  }, [newAssumption])

  const deleteAssumption = useCallback((id: string) => {
    setAssumptions(prev => prev.filter(a => a.id !== id))
  }, [])

  const filteredTransactions = useMemo(() => {
    let result = transactions
    if (selectedProject !== 'all') {
      result = result.filter(t => t.project === selectedProject)
    }
    if (transactionMonthFilter !== 'all') {
      result = result.filter(t => t.date.slice(0, 7) === transactionMonthFilter)
    }
    return result
  }, [transactions, selectedProject, transactionMonthFilter])

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
      
      const monthTransactions = filteredTransactions.filter(t => t.date.slice(0, 7) === monthStr)
      
      // Actuals
      const actualRevenue = monthTransactions
        .filter(t => t.category === 'revenue' && t.type === 'actual')
        .reduce((sum, t) => sum + t.amount, 0)
      const actualOpex = monthTransactions
        .filter(t => t.category === 'opex' && t.type === 'actual')
        .reduce((sum, t) => sum + t.amount, 0)
      const actualOverhead = monthTransactions
        .filter(t => t.category === 'overhead' && t.type === 'actual')
        .reduce((sum, t) => sum + t.amount, 0)
      const actualInvestment = monthTransactions
        .filter(t => t.category === 'investment' && t.type === 'actual')
        .reduce((sum, t) => sum + t.amount, 0)
      
      // Budget
      const budgetRevenue = monthTransactions
        .filter(t => t.category === 'revenue' && t.type === 'budget')
        .reduce((sum, t) => sum + t.amount, 0)
      const budgetOpex = monthTransactions
        .filter(t => t.category === 'opex' && t.type === 'budget')
        .reduce((sum, t) => sum + t.amount, 0)
      const budgetOverhead = monthTransactions
        .filter(t => t.category === 'overhead' && t.type === 'budget')
        .reduce((sum, t) => sum + t.amount, 0)
      const budgetInvestment = monthTransactions
        .filter(t => t.category === 'investment' && t.type === 'budget')
        .reduce((sum, t) => sum + t.amount, 0)
      
      // Projected from assumptions
      let projectedRevenue = 0
      let projectedOpex = 0
      let projectedOverhead = 0
      let projectedInvestment = 0
      
      assumptions.forEach(a => {
        if (selectedProject !== 'all' && a.project !== selectedProject) return
        
        const aStart = new Date(a.startDate + '-01')
        const aEnd = a.endDate ? new Date(a.endDate + '-01') : endDate
        
        if (current >= aStart && current <= aEnd) {
          let amount = a.amount
          if (a.frequency === 'quarterly' && current.getMonth() % 3 !== 0) amount = 0
          if (a.frequency === 'annually' && current.getMonth() !== 0) amount = 0
          if (a.frequency === 'one-time' && current.getTime() !== aStart.getTime()) amount = 0
          
          if (a.category === 'revenue') projectedRevenue += amount
          else if (a.category === 'opex') projectedOpex += amount
          else if (a.category === 'overhead') projectedOverhead += amount
          else if (a.category === 'investment') projectedInvestment += amount
        }
      })
      
      const finalRevenue = isActualMonth && actualRevenue ? actualRevenue : (projectedRevenue || budgetRevenue)
      const finalOpex = isActualMonth && actualOpex ? actualOpex : (projectedOpex || budgetOpex)
      const finalOverhead = isActualMonth && actualOverhead ? actualOverhead : (projectedOverhead || budgetOverhead)
      const finalInvestment = isActualMonth && actualInvestment ? actualInvestment : (projectedInvestment || budgetInvestment)
      
      const actualNet = actualRevenue + actualOpex + actualOverhead + actualInvestment
      const budgetNet = budgetRevenue + budgetOpex + budgetOverhead + budgetInvestment
      const projectedNet = finalRevenue + finalOpex + finalOverhead + finalInvestment
      
      runningActual += isActualMonth ? actualNet : 0
      runningBudget += budgetNet
      runningProjected += projectedNet
      
      months.push({
        month: monthStr,
        monthLabel: getMonthLabel(monthStr),
        revenue: { actual: actualRevenue, budget: budgetRevenue, projected: finalRevenue },
        opex: { actual: actualOpex, budget: budgetOpex, projected: finalOpex },
        overhead: { actual: actualOverhead, budget: budgetOverhead, projected: finalOverhead },
        investment: { actual: actualInvestment, budget: budgetInvestment, projected: finalInvestment },
        netCash: { actual: actualNet, budget: budgetNet, projected: projectedNet },
        runningBalance: { actual: runningActual, budget: runningBudget, projected: runningProjected },
        dataType: isActualMonth ? 'actual' : 'projected'
      })
      
      current.setMonth(current.getMonth() + 1)
    }
    
    return months
  }, [filteredTransactions, assumptions, beginningBalance, projectionYears, cutoffDate, selectedProject])

  const filteredMonthlyData = useMemo(() => {
    return monthlyData.filter(d => {
      return d.month >= activeDateRange.start && d.month <= activeDateRange.end
    })
  }, [monthlyData, activeDateRange])

  const kpis = useMemo(() => {
    const actualData = filteredMonthlyData.filter(d => d.dataType === 'actual')
    const hasActualData = actualData.length > 0
    
    // Total from all data (actual + projected)
    const totalRevenue = filteredMonthlyData.reduce((sum, d) => sum + (d.revenue.actual || d.revenue.projected), 0)
    const totalOpex = filteredMonthlyData.reduce((sum, d) => sum + Math.abs(d.opex.actual || d.opex.projected), 0)
    
    // Actuals only
    const totalActualRevenue = actualData.reduce((sum, d) => sum + d.revenue.actual, 0)
    const totalActualOpex = actualData.reduce((sum, d) => sum + Math.abs(d.opex.actual), 0)
    const totalBudgetRevenue = actualData.reduce((sum, d) => sum + d.revenue.budget, 0)
    
    const currentBalance = filteredMonthlyData[filteredMonthlyData.length - 1]?.runningBalance.projected || beginningBalance
    
    // Gross Margin
    const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalOpex) / totalRevenue) * 100 : 0
    
    // Budget variance (only for actuals)
    const revenueBudgetVariance = totalBudgetRevenue > 0 
      ? ((totalActualRevenue - totalBudgetRevenue) / totalBudgetRevenue) * 100 
      : 0
    
    // Period comparisons (only when we have actual data)
    const midpoint = Math.floor(actualData.length / 2)
    const firstHalf = actualData.slice(0, midpoint)
    const secondHalf = actualData.slice(midpoint)
    
    const firstPeriodStart = firstHalf[0]?.monthLabel || ''
    const firstPeriodEnd = firstHalf[firstHalf.length - 1]?.monthLabel || ''
    const secondPeriodStart = secondHalf[0]?.monthLabel || ''
    const secondPeriodEnd = secondHalf[secondHalf.length - 1]?.monthLabel || ''
    
    const priorPeriodLabel = firstPeriodStart && firstPeriodEnd && firstHalf.length > 0
      ? (firstPeriodStart === firstPeriodEnd ? firstPeriodStart : `${firstPeriodStart}-${firstPeriodEnd}`)
      : 'prior'
    const currentPeriodLabel = secondPeriodStart && secondPeriodEnd
      ? (secondPeriodStart === secondPeriodEnd ? secondPeriodStart : `${secondPeriodStart}-${secondPeriodEnd}`)
      : 'current'
    
    const firstHalfRevenue = firstHalf.reduce((sum, d) => sum + d.revenue.actual, 0)
    const secondHalfRevenue = secondHalf.reduce((sum, d) => sum + d.revenue.actual, 0)
    const revenueChange = firstHalfRevenue ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100 : 0
    
    const firstHalfOpex = firstHalf.reduce((sum, d) => sum + Math.abs(d.opex.actual), 0)
    const secondHalfOpex = secondHalf.reduce((sum, d) => sum + Math.abs(d.opex.actual), 0)
    const opexChange = firstHalfOpex ? ((secondHalfOpex - firstHalfOpex) / firstHalfOpex) * 100 : 0
    
    const firstHalfNet = firstHalf.reduce((sum, d) => sum + d.netCash.actual, 0)
    const secondHalfNet = secondHalf.reduce((sum, d) => sum + d.netCash.actual, 0)
    const netChange = firstHalfNet ? ((secondHalfNet - firstHalfNet) / Math.abs(firstHalfNet)) * 100 : 0
    
    return {
      totalRevenue,
      totalOpex,
      totalActualRevenue,
      totalActualOpex,
      totalBudgetRevenue,
      currentBalance,
      grossMargin,
      revenueBudgetVariance,
      revenueChange,
      opexChange,
      netChange,
      priorPeriodLabel,
      currentPeriodLabel,
      hasActualData
    }
  }, [filteredMonthlyData, beginningBalance])

  const chartData = useMemo(() => {
    return filteredMonthlyData.map((d) => ({
      name: d.monthLabel,
      month: d.month,
      revenue: d.revenue.actual || d.revenue.projected,
      opex: Math.abs(d.opex.actual || d.opex.projected),
      overhead: Math.abs(d.overhead.actual || d.overhead.projected),
      investment: Math.abs(d.investment.actual || d.investment.projected),
      netCash: d.netCash.projected,
      balance: d.runningBalance.projected,
      dataType: d.dataType
    }))
  }, [filteredMonthlyData])

  // Gross Margin by Project
  const projectMarginData = useMemo(() => {
    const projectData: Record<string, { revenue: number; opex: number }> = {}
    
    // From transactions
    transactions.forEach(t => {
      const proj = t.project || 'Unassigned'
      if (!projectData[proj]) projectData[proj] = { revenue: 0, opex: 0 }
      if (t.category === 'revenue') projectData[proj].revenue += t.amount
      else if (t.category === 'opex') projectData[proj].opex += Math.abs(t.amount)
    })
    
    // Calculate margins
    return Object.entries(projectData)
      .map(([name, d]) => ({
        name,
        revenue: d.revenue,
        opex: d.opex,
        margin: d.revenue > 0 ? ((d.revenue - d.opex) / d.revenue) * 100 : 0
      }))
      .filter(d => d.revenue > 0 || d.opex > 0)
      .sort((a, b) => b.margin - a.margin)
  }, [transactions])

  // Expense breakdown by category
  const expenseBreakdown = useMemo(() => {
    const totals = { opex: 0, overhead: 0, investment: 0 }
    
    filteredMonthlyData.forEach(d => {
      totals.opex += Math.abs(d.opex.actual || d.opex.projected)
      totals.overhead += Math.abs(d.overhead.actual || d.overhead.projected)
      totals.investment += Math.abs(d.investment.actual || d.investment.projected)
    })
    
    const total = totals.opex + totals.overhead + totals.investment
    
    return [
      { name: 'OpEx', value: totals.opex, color: '#ef4444', percent: total ? (totals.opex / total * 100).toFixed(1) : '0' },
      { name: 'Overhead', value: totals.overhead, color: '#f59e0b', percent: total ? (totals.overhead / total * 100).toFixed(1) : '0' },
      { name: 'Investment', value: totals.investment, color: '#6366f1', percent: total ? (totals.investment / total * 100).toFixed(1) : '0' }
    ].filter(d => d.value > 0)
  }, [filteredMonthlyData])

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

  const qoqData = useMemo(() => {
    const quarterData: Record<string, { revenue: number; opex: number }> = {}
    filteredMonthlyData.forEach(d => {
      const [year, month] = d.month.split('-')
      const quarter = `Q${Math.ceil(parseInt(month) / 3)} ${year}`
      if (!quarterData[quarter]) quarterData[quarter] = { revenue: 0, opex: 0 }
      quarterData[quarter].revenue += d.revenue.actual || d.revenue.projected
      quarterData[quarter].opex += Math.abs(d.opex.actual || d.opex.projected)
    })
    
    const quarters = Object.entries(quarterData)
    return quarters.map(([name, d], idx) => {
      const prev = quarters[idx - 1]?.[1]
      const net = d.revenue - d.opex
      const prevNet = prev ? prev.revenue - prev.opex : 0
      const revenueChange = prev?.revenue ? ((d.revenue - prev.revenue) / prev.revenue) * 100 : 0
      const netChange = prevNet ? ((net - prevNet) / Math.abs(prevNet)) * 100 : 0
      return { 
        name, 
        revenue: d.revenue,
        opex: d.opex,
        net,
        revenueChange: revenueChange.toFixed(1),
        netChange: netChange.toFixed(1)
      }
    })
  }, [filteredMonthlyData])

  const comparisonData = useMemo(() => {
    if (comparisonView === 'project') {
      const projectData: Record<string, { revenue: number; opex: number; net: number }> = {}
      filteredTransactions.forEach(t => {
        const proj = t.project || 'Unassigned'
        if (!projectData[proj]) projectData[proj] = { revenue: 0, opex: 0, net: 0 }
        if (t.category === 'revenue') projectData[proj].revenue += t.amount
        else if (t.category === 'opex') projectData[proj].opex += Math.abs(t.amount)
        projectData[proj].net += t.amount
      })
      
      return Object.entries(projectData).map(([name, d]) => ({ 
        name, 
        revenue: d.revenue,
        opex: d.opex,
        margin: d.revenue ? ((d.net / d.revenue) * 100).toFixed(1) : '0'
      }))
    }
    
    if (comparisonView === 'qoq') {
      return qoqData
    }
    
    return chartData
  }, [comparisonView, filteredTransactions, qoqData, chartData])

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: PieChart },
    { id: 'data', label: 'Data Import', icon: Database },
    { id: 'assumptions', label: 'Assumptions', icon: Settings },
    { id: 'projections', label: 'Projections', icon: TrendingUp },
    { id: 'integrations', label: 'Integrations', icon: Zap }
  ]

  return (
    <div className="min-h-screen bg-terminal-bg text-zinc-100 font-body">
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
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Filters */}
              <div className="flex items-center gap-4 p-4 bg-terminal-surface rounded-xl border border-terminal-border">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-zinc-400" />
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className="bg-terminal-bg border border-terminal-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent-primary"
                  >
                    <option value="all">All Projects</option>
                    {projectList.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                
                <div className="w-px h-6 bg-terminal-border" />
                
                <Filter className="w-5 h-5 text-zinc-400" />
                <div className="flex gap-2 flex-wrap">
                  {datePresets.map(preset => (
                    <button
                      key={preset.key}
                      onClick={() => {
                        setDateRangePreset(preset.key)
                        setShowDatePicker(preset.key === 'custom')
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
                    <DollarSign className="w-4 h-4" />
                    Current Balance
                  </div>
                  <div className="text-2xl font-mono font-semibold text-accent-secondary">
                    {formatCurrency(kpis.currentBalance)}
                  </div>
                  {kpis.hasActualData && kpis.priorPeriodLabel !== 'prior' ? (
                    <div className={`text-xs mt-1 ${kpis.netChange >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                      {formatPercent(kpis.netChange)} vs {kpis.priorPeriodLabel}
                    </div>
                  ) : (
                    <div className="text-xs mt-1 text-zinc-500">Projected balance</div>
                  )}
                </div>
                
                <div className="bg-terminal-surface rounded-xl p-5 border border-terminal-border">
                  <div className="flex items-center gap-2 text-zinc-400 text-sm mb-2">
                    <TrendingUp className="w-4 h-4" />
                    Total Revenue
                  </div>
                  <div className="text-2xl font-mono font-semibold text-accent-primary">
                    {formatCurrency(kpis.totalRevenue)}
                  </div>
                  {kpis.hasActualData && kpis.totalBudgetRevenue > 0 ? (
                    <div className={`text-xs mt-1 ${kpis.revenueBudgetVariance >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                      {formatPercent(kpis.revenueBudgetVariance)} vs budget
                    </div>
                  ) : kpis.hasActualData && kpis.priorPeriodLabel !== 'prior' ? (
                    <div className={`text-xs mt-1 ${kpis.revenueChange >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                      {formatPercent(kpis.revenueChange)} vs {kpis.priorPeriodLabel}
                    </div>
                  ) : (
                    <div className="text-xs mt-1 text-zinc-500">Actual + projected</div>
                  )}
                </div>
                
                <div className="bg-terminal-surface rounded-xl p-5 border border-terminal-border">
                  <div className="flex items-center gap-2 text-zinc-400 text-sm mb-2">
                    <TrendingDown className="w-4 h-4" />
                    Total OpEx
                  </div>
                  <div className="text-2xl font-mono font-semibold text-accent-danger">
                    {formatCurrency(kpis.totalOpex)}
                  </div>
                  {kpis.hasActualData && kpis.priorPeriodLabel !== 'prior' ? (
                    <div className={`text-xs mt-1 ${kpis.opexChange <= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                      {formatPercent(kpis.opexChange)} vs {kpis.priorPeriodLabel}
                    </div>
                  ) : (
                    <div className="text-xs mt-1 text-zinc-500">Actual + projected</div>
                  )}
                </div>
                
                <div className="bg-terminal-surface rounded-xl p-5 border border-terminal-border">
                  <div className="flex items-center gap-2 text-zinc-400 text-sm mb-2">
                    <Calendar className="w-4 h-4" />
                    Gross Margin
                  </div>
                  <div className={`text-2xl font-mono font-semibold ${kpis.grossMargin >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                    {kpis.grossMargin.toFixed(1)}%
                  </div>
                  <div className="text-xs mt-1 text-zinc-500">
                    (Revenue - OpEx) / Revenue
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                  <h3 className="text-lg font-semibold mb-4">Cash Flow Trend</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                      <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
                      <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v) => `$${v/1000}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#12121a', border: '1px solid #1e1e2e', borderRadius: '8px' }}
                        formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="opex" name="OpEx" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="overhead" name="Overhead" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="investment" name="InvEx" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="netCash" name="Net Cash" stroke="#22d3ee" strokeWidth={2} dot={{ fill: '#22d3ee' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

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
                        contentStyle={{ backgroundColor: '#12121a', border: '1px solid #1e1e2e', borderRadius: '8px' }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="balance" stroke="#10b981" fill="url(#balanceGradient)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Expense Breakdown */}
              {expenseBreakdown.length > 0 && (
                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                    <h3 className="text-lg font-semibold mb-4">Expense Breakdown</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={expenseBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${percent}%`}
                          labelLine={false}
                        >
                          {expenseBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#12121a', border: '1px solid #1e1e2e', borderRadius: '8px' }}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-2">
                      {expenseBreakdown.map(e => (
                        <div key={e.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: e.color }} />
                            <span className="text-sm text-zinc-400">{e.name}</span>
                          </div>
                          <span className="font-mono text-sm">{formatCurrency(e.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Category Summary Cards */}
                  <div className="col-span-2 grid grid-cols-3 gap-4">
                    <div className="bg-terminal-surface rounded-xl p-5 border border-terminal-border">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                        <span className="text-zinc-400 text-sm">OpEx</span>
                      </div>
                      <div className="text-xl font-mono font-semibold text-[#ef4444]">
                        {formatCurrency(expenseBreakdown.find(e => e.name === 'OpEx')?.value || 0)}
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">Project labor, travel, direct costs</p>
                    </div>
                    
                    <div className="bg-terminal-surface rounded-xl p-5 border border-terminal-border">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
                        <span className="text-zinc-400 text-sm">Overhead</span>
                      </div>
                      <div className="text-xl font-mono font-semibold text-[#f59e0b]">
                        {formatCurrency(expenseBreakdown.find(e => e.name === 'Overhead')?.value || 0)}
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">Admin, office, utilities, insurance</p>
                    </div>
                    
                    <div className="bg-terminal-surface rounded-xl p-5 border border-terminal-border">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-3 h-3 rounded-full bg-[#6366f1]" />
                        <span className="text-zinc-400 text-sm">Investment</span>
                      </div>
                      <div className="text-xl font-mono font-semibold text-[#6366f1]">
                        {formatCurrency(expenseBreakdown.find(e => e.name === 'Investment')?.value || 0)}
                      </div>
                      <p className="text-xs text-zinc-500 mt-1">Equipment, R&D, strategic spend</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Gross Margin by Project */}
              {projectMarginData.length > 0 && (
                <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                  <h3 className="text-lg font-semibold mb-4">Gross Margin by Project</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={projectMarginData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                      <XAxis type="number" stroke="#71717a" fontSize={12} tickFormatter={(v) => `${v}%`} domain={[-100, 100]} />
                      <YAxis type="category" dataKey="name" stroke="#71717a" fontSize={12} width={120} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#12121a', border: '1px solid #1e1e2e', borderRadius: '8px' }}
                        formatter={(value: number, name: string) => {
                          if (name === 'margin') return [`${value.toFixed(1)}%`, 'Gross Margin']
                          return [formatCurrency(value), name]
                        }}
                      />
                      <ReferenceLine x={0} stroke="#71717a" />
                      <Bar 
                        dataKey="margin" 
                        name="Gross Margin"
                        radius={[0, 4, 4, 0]}
                        fill="#10b981"
                      >
                        {projectMarginData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.margin >= 0 ? '#10b981' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {projectMarginData.slice(0, 4).map(p => (
                      <div key={p.name} className="bg-terminal-bg rounded-lg p-3">
                        <div className="text-zinc-400 truncate">{p.name}</div>
                        <div className={`text-lg font-mono ${p.margin >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                          {p.margin.toFixed(1)}%
                        </div>
                        <div className="text-xs text-zinc-500">
                          Rev: {formatCurrency(p.revenue)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comparison */}
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
                      contentStyle={{ backgroundColor: '#12121a', border: '1px solid #1e1e2e', borderRadius: '8px' }}
                      formatter={(value: number, name: string) => {
                        if (name === 'revenueChange' || name === 'netChange') return `${value}%`
                        return formatCurrency(value)
                      }}
                    />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="opex" name="OpEx" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                
                {comparisonView === 'qoq' && qoqData.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-terminal-border text-zinc-400">
                          <th className="text-left pb-2">Quarter</th>
                          <th className="text-right pb-2">Revenue</th>
                          <th className="text-right pb-2">Rev Δ</th>
                          <th className="text-right pb-2">OpEx</th>
                          <th className="text-right pb-2">Net Cash</th>
                          <th className="text-right pb-2">Net Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {qoqData.map((d) => (
                          <tr key={d.name} className="border-b border-terminal-border/50">
                            <td className="py-2 font-medium">{d.name}</td>
                            <td className="text-right font-mono text-accent-primary">{formatCurrency(d.revenue)}</td>
                            <td className={`text-right font-mono ${parseFloat(d.revenueChange) >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                              {d.revenueChange}%
                            </td>
                            <td className="text-right font-mono text-accent-danger">{formatCurrency(d.opex)}</td>
                            <td className={`text-right font-mono ${d.net >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                              {formatCurrency(d.net)}
                            </td>
                            <td className={`text-right font-mono ${parseFloat(d.netChange) >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                              {d.netChange}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Transaction Table */}
              {transactions.length > 0 && (
                <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <h3 className="text-lg font-semibold">Transactions</h3>
                      <select
                        value={transactionMonthFilter}
                        onChange={(e) => setTransactionMonthFilter(e.target.value)}
                        className="bg-terminal-bg border border-terminal-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent-primary"
                      >
                        <option value="all">All Months</option>
                        {transactionMonths.map(m => (
                          <option key={m} value={m}>{getMonthLabel(m)}</option>
                        ))}
                      </select>
                      {selectedProject !== 'all' && (
                        <span className="text-zinc-400 text-sm">• {selectedProject}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={exportToCSV} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-terminal-bg text-zinc-400 hover:text-zinc-200 border border-terminal-border">
                        <Download className="w-4 h-4" />
                        Export
                      </button>
                      <button onClick={clearAllData} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-accent-danger/10 text-accent-danger hover:bg-accent-danger/20 border border-accent-danger/30">
                        <Trash2 className="w-4 h-4" />
                        Clear All
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full">
                      <thead className="sticky top-0 bg-terminal-surface">
                        <tr className="border-b border-terminal-border text-left text-zinc-400 text-sm">
                          <th className="pb-3 font-medium">Date</th>
                          <th className="pb-3 font-medium">Category</th>
                          <th className="pb-3 font-medium">Description</th>
                          <th className="pb-3 font-medium text-right">Amount</th>
                          <th className="pb-3 font-medium text-center">Type</th>
                          <th className="pb-3 font-medium">Project</th>
                          <th className="pb-3 font-medium text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions.map(t => (
                          <tr key={t.id} className="border-b border-terminal-border/50 hover:bg-terminal-bg/50">
                            {editingId === t.id ? (
                              <>
                                <td className="py-2">
                                  <input type="date" value={editForm.date || ''} onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))} className="bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-sm w-32" />
                                </td>
                                <td className="py-2">
                                  <select value={editForm.category || 'revenue'} onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value as Transaction['category'] }))} className="bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-sm">
                                    <option value="revenue">Revenue</option>
                                    <option value="opex">OpEx</option>
                                    <option value="overhead">Overhead</option>
                                    <option value="investment">InvEx</option>
                                  </select>
                                </td>
                                <td className="py-2">
                                  <input type="text" value={editForm.description || ''} onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))} className="bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-sm w-full" />
                                </td>
                                <td className="py-2">
                                  <input type="number" value={editForm.amount || 0} onChange={(e) => setEditForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))} className="bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-sm w-24 text-right" />
                                </td>
                                <td className="py-2 text-center">
                                  <select value={editForm.type || 'actual'} onChange={(e) => setEditForm(prev => ({ ...prev, type: e.target.value as 'actual' | 'budget' }))} className="bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-sm">
                                    <option value="actual">Actual</option>
                                    <option value="budget">Budget</option>
                                  </select>
                                </td>
                                <td className="py-2">
                                  <input type="text" value={editForm.project || ''} onChange={(e) => setEditForm(prev => ({ ...prev, project: e.target.value }))} className="bg-terminal-bg border border-terminal-border rounded px-2 py-1 text-sm w-28" placeholder="Project" />
                                </td>
                                <td className="py-2 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button onClick={saveEdit} className="p-1 text-accent-primary hover:bg-accent-primary/10 rounded"><Check className="w-4 h-4" /></button>
                                    <button onClick={cancelEdit} className="p-1 text-zinc-400 hover:bg-terminal-bg rounded"><X className="w-4 h-4" /></button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="py-3 text-sm">{t.date}</td>
                                <td className="py-3">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    t.category === 'revenue' ? 'bg-accent-primary/10 text-accent-primary' : 
                                    t.category === 'opex' ? 'bg-accent-danger/10 text-accent-danger' : 
                                    t.category === 'overhead' ? 'bg-accent-warning/10 text-accent-warning' :
                                    'bg-accent-secondary/10 text-accent-secondary'
                                  }`}>
                                    {t.category === 'investment' ? 'InvEx' : t.category}
                                  </span>
                                </td>
                                <td className="text-sm">{t.description}</td>
                                <td className={`text-right font-mono text-sm ${t.amount >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>{formatCurrency(t.amount)}</td>
                                <td className="text-center">
                                  <span className={`px-2 py-0.5 rounded text-xs ${t.type === 'actual' ? 'bg-zinc-700 text-zinc-300' : 'bg-accent-warning/10 text-accent-warning'}`}>{t.type}</span>
                                </td>
                                <td className="text-sm text-zinc-400">{t.project || '-'}</td>
                                <td className="text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button onClick={() => startEdit(t)} className="p-1 text-zinc-400 hover:text-accent-primary hover:bg-accent-primary/10 rounded"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => deleteTransaction(t.id)} className="p-1 text-zinc-400 hover:text-accent-danger hover:bg-accent-danger/10 rounded"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-zinc-500 text-sm mt-4 text-center">
                    {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
                    {transactionMonthFilter !== 'all' && ` in ${getMonthLabel(transactionMonthFilter)}`}
                    {selectedProject !== 'all' && ` for ${selectedProject}`}
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'data' && (
            <motion.div key="data" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                <h3 className="text-lg font-semibold mb-4">Beginning Balance</h3>
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
                    <input type="number" value={beginningBalance} onChange={(e) => setBeginningBalance(parseFloat(e.target.value) || 0)} className="pl-10 pr-4 py-3 bg-terminal-bg border border-terminal-border rounded-lg text-xl font-mono w-64 focus:outline-none focus:border-accent-primary" />
                  </div>
                  <p className="text-zinc-400 text-sm">Starting cash position (auto-saved)</p>
                </div>
              </div>

              <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                <h3 className="text-lg font-semibold mb-4">Actuals Cutoff Date</h3>
                <div className="flex items-center gap-4">
                  <input type="month" value={cutoffDate} onChange={(e) => setCutoffDate(e.target.value)} className="px-4 py-3 bg-terminal-bg border border-terminal-border rounded-lg font-mono focus:outline-none focus:border-accent-primary" />
                  <p className="text-zinc-400 text-sm">Data after this date marked as projected (auto-saved)</p>
                </div>
              </div>

              <div className={`bg-terminal-surface rounded-xl p-8 border-2 border-dashed transition-all ${isDragging ? 'border-accent-primary bg-accent-primary/5' : 'border-terminal-border'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) handleFileUpload(file) }}
              >
                <div className="text-center">
                  <Upload className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Import Transactions</h3>
                  <p className="text-zinc-400 mb-4">Drag & drop CSV or click to browse</p>
                  <input type="file" accept=".csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file) }} className="hidden" id="file-upload" />
                  <label htmlFor="file-upload" className="inline-flex items-center gap-2 px-6 py-3 bg-accent-primary/10 text-accent-primary rounded-lg cursor-pointer hover:bg-accent-primary/20 transition-all">
                    <Upload className="w-5 h-5" />
                    Choose File
                  </label>
                </div>
              </div>

              <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                <h3 className="text-lg font-semibold mb-4">CSV Format</h3>
                <div className="bg-terminal-bg rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <div className="text-zinc-400">date,category,description,amount,type,project</div>
                  <div className="text-accent-primary">2024-01-15,revenue,Consulting Fee,50000,actual,Project Alpha</div>
                  <div className="text-accent-danger">2024-01-01,opex,Project Labor,-15000,actual,Project Alpha</div>
                  <div className="text-accent-warning">2024-01-01,overhead,Office Rent,-5000,actual,</div>
                  <div className="text-accent-secondary">2024-02-15,investment,Equipment,-20000,actual,Project Beta</div>
                </div>
                <p className="text-zinc-500 text-xs mt-2">Categories: revenue, opex, overhead, investment</p>
              </div>

              <div className="flex gap-4">
                <button onClick={loadSampleData} className="flex items-center gap-2 px-6 py-3 bg-accent-secondary/10 text-accent-secondary rounded-lg hover:bg-accent-secondary/20 transition-all">
                  <RefreshCw className="w-5 h-5" />
                  Load Sample Data
                </button>
                <button onClick={exportToCSV} disabled={transactions.length === 0} className="flex items-center gap-2 px-6 py-3 bg-terminal-bg text-zinc-400 rounded-lg hover:text-zinc-200 transition-all disabled:opacity-50">
                  <Download className="w-5 h-5" />
                  Export Transactions
                </button>
                <button onClick={clearAllData} disabled={transactions.length === 0} className="flex items-center gap-2 px-6 py-3 bg-accent-danger/10 text-accent-danger rounded-lg hover:bg-accent-danger/20 transition-all disabled:opacity-50">
                  <Trash2 className="w-5 h-5" />
                  Clear All Data
                </button>
              </div>
              
              <div className="bg-accent-primary/5 border border-accent-primary/20 rounded-xl p-4">
                <p className="text-accent-primary text-sm"><strong>Auto-Save Enabled:</strong> All data saved to browser. Close and return anytime.</p>
              </div>
            </motion.div>
          )}

          {activeTab === 'assumptions' && (
            <motion.div key="assumptions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                <h3 className="text-lg font-semibold mb-4">Add New Assumption</h3>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-zinc-400 text-sm mb-1">Name *</label>
                    <input type="text" placeholder="e.g., New Client Revenue" value={newAssumption.name || ''} onChange={(e) => setNewAssumption(prev => ({ ...prev, name: e.target.value }))} className="w-full px-4 py-2 bg-terminal-bg border border-terminal-border rounded-lg focus:outline-none focus:border-accent-primary" />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-sm mb-1">Category *</label>
                    <select value={newAssumption.category || 'revenue'} onChange={(e) => setNewAssumption(prev => ({ ...prev, category: e.target.value as Assumption['category'] }))} className="w-full px-4 py-2 bg-terminal-bg border border-terminal-border rounded-lg focus:outline-none focus:border-accent-primary">
                      <option value="revenue">Revenue</option>
                      <option value="opex">OpEx</option>
                      <option value="overhead">Overhead</option>
                      <option value="investment">Investment</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-sm mb-1">Amount *</label>
                    <input type="number" placeholder="e.g., 10000 or -5000" value={newAssumption.amount || ''} onChange={(e) => setNewAssumption(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))} className="w-full px-4 py-2 bg-terminal-bg border border-terminal-border rounded-lg focus:outline-none focus:border-accent-primary" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-zinc-400 text-sm mb-1">Frequency *</label>
                    <select value={newAssumption.frequency || 'monthly'} onChange={(e) => setNewAssumption(prev => ({ ...prev, frequency: e.target.value as Assumption['frequency'] }))} className="w-full px-4 py-2 bg-terminal-bg border border-terminal-border rounded-lg focus:outline-none focus:border-accent-primary">
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="annually">Annually</option>
                      <option value="one-time">One-time</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-sm mb-1">Start Date *</label>
                    <input type="month" value={newAssumption.startDate || ''} onChange={(e) => setNewAssumption(prev => ({ ...prev, startDate: e.target.value }))} className="w-full px-4 py-2 bg-terminal-bg border border-terminal-border rounded-lg focus:outline-none focus:border-accent-primary" />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-sm mb-1">End Date</label>
                    <input type="month" value={newAssumption.endDate || ''} onChange={(e) => setNewAssumption(prev => ({ ...prev, endDate: e.target.value }))} className="w-full px-4 py-2 bg-terminal-bg border border-terminal-border rounded-lg focus:outline-none focus:border-accent-primary" placeholder="Optional" />
                  </div>
                  <div>
                    <label className="block text-zinc-400 text-sm mb-1">Project</label>
                    <input type="text" value={newAssumption.project || ''} onChange={(e) => setNewAssumption(prev => ({ ...prev, project: e.target.value }))} className="w-full px-4 py-2 bg-terminal-bg border border-terminal-border rounded-lg focus:outline-none focus:border-accent-primary" placeholder="Optional" />
                  </div>
                </div>
                <button onClick={addAssumption} disabled={!newAssumption.name || !newAssumption.startDate} className="flex items-center justify-center gap-2 px-6 py-3 bg-accent-primary text-terminal-bg rounded-lg font-medium hover:bg-accent-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  <Plus className="w-5 h-5" />
                  Add Assumption
                </button>
              </div>

              <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                <h3 className="text-lg font-semibold mb-4">Current Assumptions ({assumptions.length})</h3>
                {assumptions.length === 0 ? (
                  <div className="text-center py-8">
                    <Settings className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                    <p className="text-zinc-400">No assumptions added yet.</p>
                    <p className="text-zinc-500 text-sm">Add assumptions above to project future cash flows.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assumptions.map(a => (
                      <div key={a.id} className="flex items-center justify-between p-4 bg-terminal-bg rounded-lg">
                        <div className="flex items-center gap-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            a.category === 'revenue' ? 'bg-accent-primary/10 text-accent-primary' : 
                            a.category === 'opex' ? 'bg-accent-danger/10 text-accent-danger' : 
                            a.category === 'overhead' ? 'bg-accent-warning/10 text-accent-warning' :
                            'bg-accent-secondary/10 text-accent-secondary'
                          }`}>{a.category === 'investment' ? 'InvEx' : a.category}</span>
                          <span className="font-medium">{a.name}</span>
                          <span className="text-zinc-400 text-sm">{a.frequency}</span>
                          {a.project && <span className="text-zinc-500 text-sm">• {a.project}</span>}
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`font-mono ${a.amount >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>{formatCurrency(a.amount)}</span>
                          <span className="text-zinc-400 text-sm">{a.startDate} → {a.endDate || 'ongoing'}</span>
                          <button onClick={() => deleteAssumption(a.id)} className="p-2 text-zinc-400 hover:text-accent-danger transition-all"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="bg-accent-primary/5 border border-accent-primary/20 rounded-xl p-4">
                <p className="text-accent-primary text-sm"><strong>Auto-Save Enabled:</strong> Assumptions automatically saved to browser.</p>
              </div>
            </motion.div>
          )}

          {activeTab === 'projections' && (
            <motion.div key="projections" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Projection Horizon</h3>
                  <div className="flex gap-2">
                    {([1, 2, 3] as const).map(years => (
                      <button key={years} onClick={() => setProjectionYears(years)} className={`px-4 py-2 rounded-lg font-medium transition-all ${projectionYears === years ? 'bg-accent-primary text-terminal-bg' : 'bg-terminal-bg text-zinc-400 hover:text-zinc-200'}`}>
                        {years} Year{years > 1 ? 's' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

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
                    <Tooltip contentStyle={{ backgroundColor: '#12121a', border: '1px solid #1e1e2e', borderRadius: '8px' }} formatter={(value: number) => formatCurrency(value)} />
                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey={(d: MonthlyData) => d.runningBalance.projected} name="Projected Balance" stroke="#10b981" fill="url(#projGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                <h3 className="text-lg font-semibold mb-4">Monthly Breakdown</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-terminal-border text-left text-zinc-400 text-sm">
                        <th className="pb-3 font-medium">Month</th>
                        <th className="pb-3 font-medium text-right">Revenue</th>
                        <th className="pb-3 font-medium text-right">OpEx</th>
                        <th className="pb-3 font-medium text-right">Overhead</th>
                        <th className="pb-3 font-medium text-right">InvEx</th>
                        <th className="pb-3 font-medium text-right">Net Cash</th>
                        <th className="pb-3 font-medium text-right">Balance</th>
                        <th className="pb-3 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.map(d => (
                        <tr key={d.month} className="border-b border-terminal-border/50">
                          <td className="py-3 text-sm font-medium">{d.monthLabel}</td>
                          <td className="py-3 text-right font-mono text-sm text-accent-primary">{formatCurrency(d.revenue.projected)}</td>
                          <td className="py-3 text-right font-mono text-sm text-accent-danger">{formatCurrency(d.opex.projected)}</td>
                          <td className="py-3 text-right font-mono text-sm text-accent-warning">{formatCurrency(d.overhead.projected)}</td>
                          <td className="py-3 text-right font-mono text-sm text-accent-secondary">{formatCurrency(d.investment.projected)}</td>
                          <td className={`py-3 text-right font-mono text-sm ${d.netCash.projected >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>{formatCurrency(d.netCash.projected)}</td>
                          <td className={`py-3 text-right font-mono text-sm ${d.runningBalance.projected >= 0 ? 'text-accent-secondary' : 'text-accent-danger'}`}>{formatCurrency(d.runningBalance.projected)}</td>
                          <td className="py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-xs ${d.dataType === 'actual' ? 'bg-accent-primary/10 text-accent-primary' : 'bg-accent-warning/10 text-accent-warning'}`}>{d.dataType}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'integrations' && (
            <motion.div key="integrations" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div className="grid grid-cols-3 gap-6">
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
                  <p className="text-sm text-zinc-400 mb-4">Connect bank accounts to auto-import transactions.</p>
                  <button className="w-full py-2 rounded-lg bg-terminal-bg text-zinc-400 border border-terminal-border hover:border-accent-primary hover:text-accent-primary transition-all">Coming Soon</button>
                </div>

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
                  <p className="text-sm text-zinc-400 mb-4">Sync QuickBooks for real-time tracking.</p>
                  <button className="w-full py-2 rounded-lg bg-terminal-bg text-zinc-400 border border-terminal-border hover:border-accent-primary hover:text-accent-primary transition-all">Coming Soon</button>
                </div>

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
                  <p className="text-sm text-zinc-400 mb-4">Import Xero data for projections.</p>
                  <button className="w-full py-2 rounded-lg bg-terminal-bg text-zinc-400 border border-terminal-border hover:border-accent-primary hover:text-accent-primary transition-all">Coming Soon</button>
                </div>
              </div>

              <div className="bg-terminal-surface rounded-xl p-6 border border-terminal-border">
                <h3 className="text-lg font-semibold mb-4">API Integration Status</h3>
                <p className="text-zinc-400">API integrations in development. Connect bank accounts and accounting software soon.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-terminal-border mt-12 py-6">
        <div className="max-w-7xl mx-auto px-6 text-center text-zinc-500 text-sm">CashFlow Pro • Financial Intelligence Platform</div>
      </footer>
    </div>
  )
}
