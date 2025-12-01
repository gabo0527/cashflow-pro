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
  PieChart as PieChartIcon, Settings, Database, Zap, Plus, Trash2, Download,
  Filter, RefreshCw, Edit2, X, Check, Building2, Moon, Sun, AlertTriangle,
  FolderPlus, Copy, FileText, Bell, Repeat, Lock, Users, Image, Palette,
  Shield, Eye, EyeOff, HardDrive, CloudOff, ExternalLink, Clock, Target,
  Sparkles, AlertCircle, CheckCircle, Info, MessageSquare, Gauge
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
  recurring?: boolean
  recurringId?: string
  notes?: string
  expectedPaymentDate?: string // For AR/AP timing
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
  scenarioId?: string
}

interface Project {
  id: string
  name: string
  color: string
  status: 'active' | 'completed' | 'on-hold'
  createdAt: string
}

interface Scenario {
  id: string
  name: string
  description?: string
  isBase: boolean
  createdAt: string
}

interface RecurringRule {
  id: string
  description: string
  category: 'revenue' | 'opex' | 'overhead' | 'investment'
  amount: number
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly'
  startDate: string
  endDate?: string
  project?: string
  type: 'actual' | 'budget'
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

const PROJECT_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

// Sample data generator
const generateSampleData = (): { transactions: Transaction[], projects: Project[] } => {
  const transactions: Transaction[] = []
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()
  
  const projects: Project[] = [
    { id: generateId(), name: 'Project Alpha', color: PROJECT_COLORS[0], status: 'active', createdAt: new Date().toISOString() },
    { id: generateId(), name: 'Project Beta', color: PROJECT_COLORS[1], status: 'active', createdAt: new Date().toISOString() },
    { id: generateId(), name: 'Product Line', color: PROJECT_COLORS[2], status: 'active', createdAt: new Date().toISOString() },
    { id: generateId(), name: 'Services', color: PROJECT_COLORS[3], status: 'active', createdAt: new Date().toISOString() },
  ]
  
  const projectNames = projects.map(p => p.name)
  
  for (let i = 11; i >= 0; i--) {
    const date = new Date(currentYear, currentMonth - i, 15)
    const monthStr = date.toISOString().slice(0, 10)
    const isActual = i >= 2
    
    // Revenue with projects
    transactions.push({
      id: generateId(),
      date: monthStr,
      category: 'revenue',
      description: 'Consulting Services',
      amount: 45000 + Math.random() * 15000,
      type: isActual ? 'actual' : 'budget',
      project: projectNames[0]
    })
    
    transactions.push({
      id: generateId(),
      date: monthStr,
      category: 'revenue',
      description: 'Product Sales',
      amount: 25000 + Math.random() * 10000,
      type: isActual ? 'actual' : 'budget',
      project: projectNames[2]
    })
    
    transactions.push({
      id: generateId(),
      date: monthStr,
      category: 'revenue',
      description: 'Service Contracts',
      amount: 15000 + Math.random() * 5000,
      type: isActual ? 'actual' : 'budget',
      project: projectNames[3]
    })
    
    // OpEx - Project costs
    transactions.push({
      id: generateId(),
      date: monthStr,
      category: 'opex',
      description: 'Project Labor',
      amount: -(15000 + Math.random() * 3000),
      type: isActual ? 'actual' : 'budget',
      project: projectNames[Math.floor(Math.random() * 4)]
    })
    
    transactions.push({
      id: generateId(),
      date: monthStr,
      category: 'opex',
      description: 'Travel Expenses',
      amount: -(3000 + Math.random() * 2000),
      type: isActual ? 'actual' : 'budget',
      project: projectNames[Math.floor(Math.random() * 4)]
    })
    
    // Overhead - No project (company-wide)
    transactions.push({
      id: generateId(),
      date: monthStr,
      category: 'overhead',
      description: 'Admin Payroll',
      amount: -(12000 + Math.random() * 2000),
      type: isActual ? 'actual' : 'budget'
      // No project = overhead
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
    
    // Investment
    if (i % 3 === 0) {
      transactions.push({
        id: generateId(),
        date: monthStr,
        category: 'investment',
        description: 'Equipment Purchase',
        amount: -(15000 + Math.random() * 10000),
        type: isActual ? 'actual' : 'budget',
        project: projectNames[1]
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
  
  return { transactions, projects }
}

// Storage keys
const STORAGE_KEYS = {
  transactions: 'cashflow_transactions',
  assumptions: 'cashflow_assumptions',
  beginningBalance: 'cashflow_beginning_balance',
  cutoffDate: 'cashflow_cutoff_date',
  projects: 'cashflow_projects',
  scenarios: 'cashflow_scenarios',
  recurringRules: 'cashflow_recurring',
  theme: 'cashflow_theme',
  balanceAlert: 'cashflow_balance_alert',
  branding: 'cashflow_branding',
  chartFilters: 'cashflow_chart_filters'
}

// Branding interface
interface BrandingSettings {
  companyName: string
  companyLogo: string | null
  brandColor: string
}

// Chart filter interface
interface ChartFilters {
  revenue: boolean
  opex: boolean
  overhead: boolean
  investment: boolean
  net: boolean
}

// Main Component
export default function CashFlowPro() {
  // Core state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'data' | 'assumptions' | 'projections' | 'integrations' | 'settings'>('dashboard')
  const [beginningBalance, setBeginningBalance] = useState<number>(50000)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [assumptions, setAssumptions] = useState<Assumption[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [scenarios, setScenarios] = useState<Scenario[]>([{ id: 'base', name: 'Base Case', isBase: true, createdAt: new Date().toISOString() }])
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([])
  const [projectionYears, setProjectionYears] = useState<1 | 2 | 3>(1)
  const [comparisonView, setComparisonView] = useState<'mom' | 'yoy' | 'qoq' | 'project'>('mom')
  const [cutoffDate, setCutoffDate] = useState<string>(new Date().toISOString().slice(0, 7))
  const [isDragging, setIsDragging] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  
  // UI state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [balanceAlertThreshold, setBalanceAlertThreshold] = useState<number>(0)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showPdfExport, setShowPdfExport] = useState(false)
  const [pdfSections, setPdfSections] = useState({
    kpis: true,
    cashFlowChart: true,
    balanceChart: true,
    expenseBreakdown: true,
    comparison: true,
    projectMargins: true,
    transactions: false
  })
  const [activeScenario, setActiveScenario] = useState<string>('base')
  
  // Branding state
  const [branding, setBranding] = useState<BrandingSettings>({
    companyName: 'CashFlow Pro',
    companyLogo: null,
    brandColor: '#10b981'
  })
  
  // Chart filter state
  const [chartFilters, setChartFilters] = useState<ChartFilters>({
    revenue: true,
    opex: true,
    overhead: true,
    investment: true,
    net: true
  })
  
  // Legal modals
  const [showPrivacyModal, setShowPrivacyModal] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  
  // Filter state
  const [dateRangePreset, setDateRangePreset] = useState<DateRangePreset>('thisYear')
  const [customStartDate, setCustomStartDate] = useState<string>(`${new Date().getFullYear()}-01`)
  const [customEndDate, setCustomEndDate] = useState<string>(new Date().toISOString().slice(0, 7))
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [selectedProject, setSelectedProject] = useState<string>('all')
  const [transactionMonthFilter, setTransactionMonthFilter] = useState<string>('all')
  
  // View mode
  const [timeView, setTimeView] = useState<'monthly' | 'weekly'>('monthly')
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Transaction>>({})
  
  // Quick add form
  const [quickAddForm, setQuickAddForm] = useState<Partial<Transaction>>({
    date: new Date().toISOString().slice(0, 10),
    category: 'revenue',
    type: 'actual',
    amount: 0,
    description: ''
  })
  
  // New project form
  const [newProjectName, setNewProjectName] = useState('')
  
  // Assumption form
  const [newAssumption, setNewAssumption] = useState<Partial<Assumption>>({
    name: '',
    category: 'revenue',
    frequency: 'monthly',
    amount: 0,
    startDate: new Date().toISOString().slice(0, 7)
  })

  // Load from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedTransactions = localStorage.getItem(STORAGE_KEYS.transactions)
        const savedAssumptions = localStorage.getItem(STORAGE_KEYS.assumptions)
        const savedBalance = localStorage.getItem(STORAGE_KEYS.beginningBalance)
        const savedCutoff = localStorage.getItem(STORAGE_KEYS.cutoffDate)
        const savedProjects = localStorage.getItem(STORAGE_KEYS.projects)
        const savedTheme = localStorage.getItem(STORAGE_KEYS.theme)
        const savedAlert = localStorage.getItem(STORAGE_KEYS.balanceAlert)
        const savedScenarios = localStorage.getItem(STORAGE_KEYS.scenarios)
        const savedRecurring = localStorage.getItem(STORAGE_KEYS.recurringRules)
        const savedBranding = localStorage.getItem(STORAGE_KEYS.branding)
        const savedChartFilters = localStorage.getItem(STORAGE_KEYS.chartFilters)
        
        if (savedTransactions) setTransactions(JSON.parse(savedTransactions))
        if (savedAssumptions) setAssumptions(JSON.parse(savedAssumptions))
        if (savedBalance) setBeginningBalance(parseFloat(savedBalance) || 0)
        if (savedCutoff) setCutoffDate(savedCutoff)
        if (savedProjects) setProjects(JSON.parse(savedProjects))
        if (savedTheme) setTheme(savedTheme as 'dark' | 'light')
        if (savedAlert) setBalanceAlertThreshold(parseFloat(savedAlert) || 0)
        if (savedScenarios) setScenarios(JSON.parse(savedScenarios))
        if (savedRecurring) setRecurringRules(JSON.parse(savedRecurring))
        if (savedBranding) setBranding(JSON.parse(savedBranding))
        if (savedChartFilters) setChartFilters(JSON.parse(savedChartFilters))
      } catch (error) {
        console.error('Error loading data from localStorage:', error)
        // Clear corrupted data
        Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key))
      }
      
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

  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(projects))
    }
  }, [projects, isLoaded])

  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.theme, theme)
      document.documentElement.classList.toggle('light-mode', theme === 'light')
    }
  }, [theme, isLoaded])

  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.balanceAlert, balanceAlertThreshold.toString())
    }
  }, [balanceAlertThreshold, isLoaded])

  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.scenarios, JSON.stringify(scenarios))
    }
  }, [scenarios, isLoaded])

  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.recurringRules, JSON.stringify(recurringRules))
    }
  }, [recurringRules, isLoaded])

  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.branding, JSON.stringify(branding))
    }
  }, [branding, isLoaded])

  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.chartFilters, JSON.stringify(chartFilters))
    }
  }, [chartFilters, isLoaded])
  
  const activeDateRange = useMemo(() => {
    return getDateRangeFromPreset(dateRangePreset, customStartDate, customEndDate)
  }, [dateRangePreset, customStartDate, customEndDate])

  const projectList = useMemo(() => {
    const fromProjects = projects.map(p => p.name)
    const fromTransactions: string[] = []
    transactions.forEach(t => {
      if (t.project && !fromTransactions.includes(t.project)) {
        fromTransactions.push(t.project)
      }
    })
    const combined = [...fromProjects, ...fromTransactions]
    const unique = Array.from(new Set(combined))
    return unique.sort()
  }, [transactions, projects])

  const transactionMonths = useMemo(() => {
    const months = new Set<string>()
    transactions.forEach(t => {
      months.add(t.date.slice(0, 7))
    })
    return Array.from(months).sort().reverse()
  }, [transactions])

  // Auto-categorize: no project = overhead for expense categories
  const normalizeTransaction = useCallback((t: Partial<Transaction>): Transaction => {
    const normalized = { ...t } as Transaction
    
    // If no project and it's an expense, set to overhead
    if (!normalized.project && normalized.category !== 'revenue' && normalized.category !== 'overhead') {
      // Keep opex/investment only if they have a project
      if (normalized.category === 'opex' || normalized.category === 'investment') {
        normalized.category = 'overhead'
      }
    }
    
    return normalized
  }, [])

  const loadSampleData = useCallback(() => {
    const { transactions: sampleTx, projects: sampleProjects } = generateSampleData()
    setTransactions(sampleTx)
    setProjects(sampleProjects)
  }, [])

  const clearAllData = useCallback(() => {
    if (confirm('Are you sure you want to delete all transactions? This cannot be undone.')) {
      setTransactions([])
    }
  }, [])

  const handleFileUpload = useCallback((file: File) => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    
    if (fileExtension === 'csv') {
      // CSV Import
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
        complete: (results) => {
          const imported: Transaction[] = results.data
            .filter((row) => row.date && (row.amount || row.amount === '0'))
            .map((row) => {
              // Normalize category names
              let category: Transaction['category'] = 'revenue'
              const rawCategory = (row.category || '').toLowerCase().trim()
              if (rawCategory.includes('revenue') || rawCategory.includes('income') || rawCategory.includes('sales')) {
                category = 'revenue'
              } else if (rawCategory.includes('opex') || rawCategory.includes('operating') || rawCategory.includes('direct')) {
                category = 'opex'
              } else if (rawCategory.includes('overhead') || rawCategory.includes('admin') || rawCategory.includes('non_operational') || rawCategory.includes('g&a')) {
                category = 'overhead'
              } else if (rawCategory.includes('invest') || rawCategory.includes('capex') || rawCategory.includes('capital')) {
                category = 'investment'
              }
              
              const t: Transaction = {
                id: generateId(),
                date: row.date?.trim(),
                category,
                description: row.description?.trim() || '',
                amount: parseFloat(String(row.amount).replace(/[,$]/g, '')) || 0,
                type: (row.type?.toLowerCase().trim() === 'budget' ? 'budget' : 'actual') as 'actual' | 'budget',
                project: row.project?.trim() || undefined,
                notes: row.notes?.trim() || undefined
              }
              return normalizeTransaction(t)
            })
          if (imported.length > 0) {
            setTransactions(prev => [...prev, ...imported])
            alert(`Successfully imported ${imported.length} transactions`)
          } else {
            alert('No valid transactions found. Check column headers: date, category, description, amount, type, project')
          }
        },
        error: (error) => {
          alert(`Error parsing CSV: ${error.message}`)
        }
      })
    } else {
      alert('Please use CSV format. Export from Excel/Sheets using "Save As > CSV"')
    }
  }, [normalizeTransaction])

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

  const exportToPDF = useCallback(() => {
    setShowPdfExport(true)
  }, [])

  const handlePdfExport = useCallback(() => {
    // Add print class to hide non-selected sections
    const style = document.createElement('style')
    style.id = 'pdf-export-style'
    style.textContent = `
      @media print {
        .pdf-section { display: none !important; }
        ${pdfSections.kpis ? '.pdf-kpis { display: block !important; }' : ''}
        ${pdfSections.cashFlowChart ? '.pdf-cashflow { display: block !important; }' : ''}
        ${pdfSections.balanceChart ? '.pdf-balance { display: block !important; }' : ''}
        ${pdfSections.expenseBreakdown ? '.pdf-expenses { display: block !important; }' : ''}
        ${pdfSections.comparison ? '.pdf-comparison { display: block !important; }' : ''}
        ${pdfSections.projectMargins ? '.pdf-margins { display: block !important; }' : ''}
        ${pdfSections.transactions ? '.pdf-transactions { display: block !important; }' : ''}
      }
    `
    document.head.appendChild(style)
    setShowPdfExport(false)
    setTimeout(() => {
      window.print()
      document.getElementById('pdf-export-style')?.remove()
    }, 100)
  }, [pdfSections])

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
          ? normalizeTransaction({ ...t, ...editForm })
          : t
      ))
      setEditingId(null)
      setEditForm({})
    }
  }, [editingId, editForm, normalizeTransaction])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditForm({})
  }, [])

  // Quick Add Transaction
  const handleQuickAdd = useCallback(() => {
    if (quickAddForm.description && quickAddForm.amount) {
      const newTx: Transaction = normalizeTransaction({
        id: generateId(),
        date: quickAddForm.date || new Date().toISOString().slice(0, 10),
        category: quickAddForm.category || 'revenue',
        description: quickAddForm.description,
        amount: quickAddForm.amount,
        type: quickAddForm.type || 'actual',
        project: quickAddForm.project,
        notes: quickAddForm.notes
      })
      setTransactions(prev => [...prev, newTx])
      setQuickAddForm({
        date: new Date().toISOString().slice(0, 10),
        category: 'revenue',
        type: 'actual',
        amount: 0,
        description: '',
        notes: ''
      })
      setShowQuickAdd(false)
    }
  }, [quickAddForm, normalizeTransaction])

  // Project Management
  const addProject = useCallback(() => {
    if (newProjectName.trim()) {
      const newProject: Project = {
        id: generateId(),
        name: newProjectName.trim(),
        color: PROJECT_COLORS[projects.length % PROJECT_COLORS.length],
        status: 'active',
        createdAt: new Date().toISOString()
      }
      setProjects(prev => [...prev, newProject])
      setNewProjectName('')
      setShowProjectModal(false)
    }
  }, [newProjectName, projects.length])

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id))
  }, [])

  // Assumptions
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
        project: newAssumption.project,
        scenarioId: activeScenario
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
  }, [newAssumption, activeScenario])

  const deleteAssumption = useCallback((id: string) => {
    setAssumptions(prev => prev.filter(a => a.id !== id))
  }, [])

  // Scenario Management
  const addScenario = useCallback((name: string) => {
    const newScenario: Scenario = {
      id: generateId(),
      name,
      isBase: false,
      createdAt: new Date().toISOString()
    }
    setScenarios(prev => [...prev, newScenario])
    setActiveScenario(newScenario.id)
  }, [])

  const duplicateScenario = useCallback((sourceId: string, newName: string) => {
    const newScenarioId = generateId()
    const sourceAssumptions = assumptions.filter(a => a.scenarioId === sourceId || (sourceId === 'base' && !a.scenarioId))
    const duplicatedAssumptions = sourceAssumptions.map(a => ({
      ...a,
      id: generateId(),
      scenarioId: newScenarioId
    }))
    setAssumptions(prev => [...prev, ...duplicatedAssumptions])
    addScenario(newName)
  }, [assumptions, addScenario])

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

  // Filter assumptions by scenario
  const activeAssumptions = useMemo(() => {
    return assumptions.filter(a => a.scenarioId === activeScenario || (activeScenario === 'base' && !a.scenarioId))
  }, [assumptions, activeScenario])

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
      const actualRevenue = monthTransactions.filter(t => t.category === 'revenue' && t.type === 'actual').reduce((sum, t) => sum + t.amount, 0)
      const actualOpex = monthTransactions.filter(t => t.category === 'opex' && t.type === 'actual').reduce((sum, t) => sum + t.amount, 0)
      const actualOverhead = monthTransactions.filter(t => t.category === 'overhead' && t.type === 'actual').reduce((sum, t) => sum + t.amount, 0)
      const actualInvestment = monthTransactions.filter(t => t.category === 'investment' && t.type === 'actual').reduce((sum, t) => sum + t.amount, 0)
      
      // Budget
      const budgetRevenue = monthTransactions.filter(t => t.category === 'revenue' && t.type === 'budget').reduce((sum, t) => sum + t.amount, 0)
      const budgetOpex = monthTransactions.filter(t => t.category === 'opex' && t.type === 'budget').reduce((sum, t) => sum + t.amount, 0)
      const budgetOverhead = monthTransactions.filter(t => t.category === 'overhead' && t.type === 'budget').reduce((sum, t) => sum + t.amount, 0)
      const budgetInvestment = monthTransactions.filter(t => t.category === 'investment' && t.type === 'budget').reduce((sum, t) => sum + t.amount, 0)
      
      // Projected from assumptions
      let projectedRevenue = 0
      let projectedOpex = 0
      let projectedOverhead = 0
      let projectedInvestment = 0
      
      activeAssumptions.forEach(a => {
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
  }, [filteredTransactions, activeAssumptions, beginningBalance, projectionYears, cutoffDate, selectedProject])

  const filteredMonthlyData = useMemo(() => {
    return monthlyData.filter(d => d.month >= activeDateRange.start && d.month <= activeDateRange.end)
  }, [monthlyData, activeDateRange])

  // Balance alert check
  const balanceAlert = useMemo(() => {
    const minBalance = Math.min(...filteredMonthlyData.map(d => d.runningBalance.projected))
    return balanceAlertThreshold > 0 && minBalance < balanceAlertThreshold
  }, [filteredMonthlyData, balanceAlertThreshold])

  const kpis = useMemo(() => {
    const actualData = filteredMonthlyData.filter(d => d.dataType === 'actual')
    const hasActualData = actualData.length > 0
    
    const totalRevenue = filteredMonthlyData.reduce((sum, d) => sum + (d.revenue.actual || d.revenue.projected), 0)
    const totalOpex = filteredMonthlyData.reduce((sum, d) => sum + Math.abs(d.opex.actual || d.opex.projected), 0)
    const totalOverhead = filteredMonthlyData.reduce((sum, d) => sum + Math.abs(d.overhead.actual || d.overhead.projected), 0)
    const totalInvestment = filteredMonthlyData.reduce((sum, d) => sum + Math.abs(d.investment.actual || d.investment.projected), 0)
    
    const totalActualRevenue = actualData.reduce((sum, d) => sum + d.revenue.actual, 0)
    const totalBudgetRevenue = actualData.reduce((sum, d) => sum + d.revenue.budget, 0)
    
    const currentBalance = filteredMonthlyData[filteredMonthlyData.length - 1]?.runningBalance.projected || beginningBalance
    
    const totalExpenses = totalOpex + totalOverhead + totalInvestment
    const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0
    
    const revenueBudgetVariance = totalBudgetRevenue > 0 ? ((totalActualRevenue - totalBudgetRevenue) / totalBudgetRevenue) * 100 : 0
    
    const midpoint = Math.floor(actualData.length / 2)
    const firstHalf = actualData.slice(0, midpoint)
    const secondHalf = actualData.slice(midpoint)
    
    const firstPeriodStart = firstHalf[0]?.monthLabel || ''
    const firstPeriodEnd = firstHalf[firstHalf.length - 1]?.monthLabel || ''
    
    const priorPeriodLabel = firstPeriodStart && firstPeriodEnd && firstHalf.length > 0
      ? (firstPeriodStart === firstPeriodEnd ? firstPeriodStart : `${firstPeriodStart}-${firstPeriodEnd}`)
      : 'prior'
    
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
      totalRevenue, totalOpex, totalOverhead, totalInvestment, totalExpenses,
      totalActualRevenue, totalBudgetRevenue, currentBalance, grossMargin,
      revenueBudgetVariance, revenueChange, opexChange, netChange,
      priorPeriodLabel, hasActualData
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

  const projectMarginData = useMemo(() => {
    const projectData: Record<string, { revenue: number; opex: number }> = {}
    
    transactions.forEach(t => {
      const proj = t.project || 'Unassigned'
      if (!projectData[proj]) projectData[proj] = { revenue: 0, opex: 0 }
      if (t.category === 'revenue') projectData[proj].revenue += t.amount
      else if (t.category === 'opex') projectData[proj].opex += Math.abs(t.amount)
    })
    
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
      return { name, revenue: d.revenue, opex: d.opex, net, revenueChange: revenueChange.toFixed(1), netChange: netChange.toFixed(1) }
    })
  }, [filteredMonthlyData])

  // Year-over-Year data - compare same month across years
  const yoyData = useMemo(() => {
    const monthsByYear: Record<string, Record<string, { revenue: number; opex: number }>> = {}
    
    filteredMonthlyData.forEach(d => {
      const [year, month] = d.month.split('-')
      if (!monthsByYear[year]) monthsByYear[year] = {}
      monthsByYear[year][month] = {
        revenue: d.revenue.actual || d.revenue.projected,
        opex: Math.abs(d.opex.actual || d.opex.projected)
      }
    })
    
    const years = Object.keys(monthsByYear).sort()
    if (years.length < 2) return chartData // Fall back to MoM if less than 2 years
    
    // Create comparison data showing current vs previous year
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const result: { name: string; [key: string]: string | number }[] = []
    
    for (let m = 1; m <= 12; m++) {
      const monthKey = m.toString().padStart(2, '0')
      const entry: { name: string; [key: string]: string | number } = { name: monthNames[m - 1] }
      
      years.forEach(year => {
        const data = monthsByYear[year]?.[monthKey]
        if (data) {
          entry[`rev${year}`] = data.revenue
          entry[`opex${year}`] = data.opex
        }
      })
      
      // Only add if we have data for at least one year
      if (Object.keys(entry).length > 1) {
        result.push(entry)
      }
    }
    
    return result
  }, [filteredMonthlyData, chartData])

  // Get years for YoY legend
  const yoyYears = useMemo(() => {
    const years = new Set<string>()
    filteredMonthlyData.forEach(d => {
      years.add(d.month.split('-')[0])
    })
    return Array.from(years).sort()
  }, [filteredMonthlyData])

  const comparisonData = useMemo(() => {
    if (comparisonView === 'project') {
      const projectData: Record<string, { revenue: number; opex: number }> = {}
      filteredTransactions.forEach(t => {
        const proj = t.project || 'Unassigned'
        if (!projectData[proj]) projectData[proj] = { revenue: 0, opex: 0 }
        if (t.category === 'revenue') projectData[proj].revenue += t.amount
        else if (t.category === 'opex') projectData[proj].opex += Math.abs(t.amount)
      })
      return Object.entries(projectData).map(([name, d]) => ({ name, revenue: d.revenue, opex: d.opex }))
    }
    if (comparisonView === 'qoq') return qoqData
    if (comparisonView === 'yoy') return yoyData
    return chartData // MoM
  }, [comparisonView, filteredTransactions, qoqData, yoyData, chartData])

  // Weekly data for charts
  const weeklyData = useMemo(() => {
    const weeks: Record<string, { revenue: number; opex: number; overhead: number; investment: number; netCash: number }> = {}
    
    filteredTransactions.forEach(t => {
      const date = new Date(t.date)
      const weekStart = new Date(date)
      weekStart.setDate(date.getDate() - date.getDay()) // Start of week (Sunday)
      const weekKey = weekStart.toISOString().slice(0, 10)
      
      if (!weeks[weekKey]) {
        weeks[weekKey] = { revenue: 0, opex: 0, overhead: 0, investment: 0, netCash: 0 }
      }
      
      if (t.category === 'revenue') weeks[weekKey].revenue += t.amount
      else if (t.category === 'opex') weeks[weekKey].opex += Math.abs(t.amount)
      else if (t.category === 'overhead') weeks[weekKey].overhead += Math.abs(t.amount)
      else if (t.category === 'investment') weeks[weekKey].investment += Math.abs(t.amount)
    })
    
    // Calculate net cash and format
    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, data]) => {
        const date = new Date(week)
        const weekLabel = `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        return {
          name: weekLabel,
          ...data,
          netCash: data.revenue - data.opex - data.overhead - data.investment
        }
      })
  }, [filteredTransactions])

  // Runway calculation
  const runwayData = useMemo(() => {
    // Get last 3 months of actual data for average burn
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
    
    const recentTransactions = transactions.filter(t => 
      t.type === 'actual' && new Date(t.date) >= threeMonthsAgo
    )
    
    let totalRevenue = 0
    let totalExpenses = 0
    
    recentTransactions.forEach(t => {
      if (t.category === 'revenue') totalRevenue += t.amount
      else totalExpenses += Math.abs(t.amount)
    })
    
    const monthsOfData = Math.max(1, Math.min(3, 
      (Date.now() - threeMonthsAgo.getTime()) / (30 * 24 * 60 * 60 * 1000)
    ))
    
    const avgMonthlyRevenue = totalRevenue / monthsOfData
    const avgMonthlyExpenses = totalExpenses / monthsOfData
    const avgMonthlyBurn = avgMonthlyExpenses - avgMonthlyRevenue
    
    // Current balance from chart data - with safe access
    let currentBalance = beginningBalance
    if (chartData && chartData.length > 0) {
      const lastEntry = chartData[chartData.length - 1]
      if (lastEntry && typeof lastEntry.balance === 'number') {
        currentBalance = lastEntry.balance
      }
    }
    
    // Runway in months (only if burning cash)
    const runwayMonths = avgMonthlyBurn > 0 
      ? currentBalance / avgMonthlyBurn 
      : Infinity
    
    return {
      currentBalance,
      avgMonthlyRevenue,
      avgMonthlyExpenses,
      avgMonthlyBurn,
      runwayMonths: isFinite(runwayMonths) ? runwayMonths : Infinity,
      status: runwayMonths === Infinity || !isFinite(runwayMonths) ? 'profitable' : runwayMonths < 3 ? 'critical' : runwayMonths < 6 ? 'warning' : 'healthy'
    }
  }, [transactions, chartData, beginningBalance])

  // Auto-generated insights
  const insights = useMemo(() => {
    const result: { type: 'positive' | 'warning' | 'critical' | 'info'; title: string; message: string }[] = []
    
    if (chartData.length < 2) return result
    
    const currentMonth = chartData[chartData.length - 1]
    const prevMonth = chartData[chartData.length - 2]
    
    // Revenue trend
    if (prevMonth && currentMonth && typeof currentMonth.revenue === 'number' && typeof prevMonth.revenue === 'number') {
      const revenueChange = prevMonth.revenue > 0 
        ? ((currentMonth.revenue - prevMonth.revenue) / prevMonth.revenue) * 100 
        : 0
      
      if (isFinite(revenueChange) && revenueChange > 15) {
        result.push({
          type: 'positive',
          title: 'Revenue Up',
          message: `Revenue increased ${revenueChange.toFixed(0)}% vs last month`
        })
      } else if (isFinite(revenueChange) && revenueChange < -15) {
        result.push({
          type: 'warning',
          title: 'Revenue Down',
          message: `Revenue decreased ${Math.abs(revenueChange).toFixed(0)}% vs last month`
        })
      }
    }
    
    // Expense anomaly (compare to 3-month average)
    if (chartData.length >= 3) {
      const last3Expenses = chartData.slice(-3).map(d => (d.opex || 0) + (d.overhead || 0) + (d.investment || 0))
      const avgExpenses = last3Expenses.slice(0, -1).reduce((a, b) => a + b, 0) / 2
      const currentExpenses = last3Expenses[last3Expenses.length - 1]
      
      if (avgExpenses > 0 && currentExpenses > avgExpenses * 1.3) {
        result.push({
          type: 'warning',
          title: 'Higher Expenses',
          message: `Expenses ${((currentExpenses / avgExpenses - 1) * 100).toFixed(0)}% above recent average`
        })
      } else if (avgExpenses > 0 && currentExpenses < avgExpenses * 0.7) {
        result.push({
          type: 'positive',
          title: 'Lower Expenses',
          message: `Expenses ${((1 - currentExpenses / avgExpenses) * 100).toFixed(0)}% below recent average`
        })
      }
    }
    
    // Runway warning
    if (runwayData.status === 'critical' && isFinite(runwayData.runwayMonths)) {
      result.push({
        type: 'critical',
        title: 'Low Runway',
        message: `Only ${runwayData.runwayMonths.toFixed(1)} months of cash remaining`
      })
    } else if (runwayData.status === 'warning' && isFinite(runwayData.runwayMonths)) {
      result.push({
        type: 'warning',
        title: 'Monitor Runway',
        message: `${runwayData.runwayMonths.toFixed(1)} months of runway at current burn`
      })
    }
    
    // Positive cash flow
    if (runwayData.status === 'profitable' && runwayData.avgMonthlyBurn < 0) {
      result.push({
        type: 'positive',
        title: 'Cash Positive',
        message: `Generating ${formatCurrency(Math.abs(runwayData.avgMonthlyBurn))}/mo net cash`
      })
    }
    
    // Best month check
    if (chartData.length >= 6) {
      const recentRevenues = chartData.slice(-6).map(d => d.revenue)
      const maxRevenue = Math.max(...recentRevenues.slice(0, -1))
      if (currentMonth && currentMonth.revenue > maxRevenue && currentMonth.revenue > 0) {
        result.push({
          type: 'positive',
          title: 'Best Month',
          message: 'Highest revenue in the past 6 months!'
        })
      }
    }
    
    return result.slice(0, 3) // Max 3 insights
  }, [chartData, runwayData])

  const datePresets: { key: DateRangePreset; label: string }[] = [
    { key: 'thisYear', label: 'This Year' },
    { key: 'lastYear', label: 'Last Year' },
    { key: 'last12', label: 'L12M' },
    { key: 'last6', label: 'L6M' },
    { key: 'last3', label: 'L3M' },
    { key: 'ytd', label: 'YTD' },
    { key: 'all', label: 'All' },
    { key: 'custom', label: 'Custom' },
  ]

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: PieChartIcon },
    { id: 'data', label: 'Data', icon: Database },
    { id: 'assumptions', label: 'Assumptions', icon: Settings },
    { id: 'projections', label: 'Projections', icon: TrendingUp },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]

  const themeClasses = theme === 'light' 
    ? 'bg-gray-100 text-gray-900' 
    : 'bg-terminal-bg text-zinc-100'

  const cardClasses = theme === 'light'
    ? 'bg-white border-gray-200 shadow-sm'
    : 'bg-terminal-surface border-terminal-border'

  const inputClasses = theme === 'light'
    ? 'bg-white border-gray-300 text-gray-900'
    : 'bg-terminal-bg border-terminal-border text-zinc-100'

  const tableHeaderBg = theme === 'light' ? 'bg-gray-50' : 'bg-terminal-surface'
  const tableBorder = theme === 'light' ? 'border-gray-200' : 'border-terminal-border'
  const textMuted = theme === 'light' ? 'text-gray-500' : 'text-zinc-400'
  const textSubtle = theme === 'light' ? 'text-gray-400' : 'text-zinc-500'

  return (
    <div className={`min-h-screen font-body transition-colors ${themeClasses}`} style={{ colorScheme: theme }}>
      {/* Header */}
      <header className={`border-b sticky top-0 z-50 backdrop-blur-sm ${theme === 'light' ? 'bg-white/80 border-gray-200' : 'bg-terminal-surface/80 border-terminal-border'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {branding.companyLogo ? (
                <img 
                  src={branding.companyLogo} 
                  alt={branding.companyName} 
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg object-contain"
                />
              ) : (
                <div 
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${branding.brandColor}, ${branding.brandColor}dd)` }}
                >
                  <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-lg sm:text-xl font-display font-bold tracking-tight">{branding.companyName}</h1>
                <p className={`text-xs hidden sm:block ${textMuted}`}>Financial Intelligence Platform</p>
              </div>
            </div>
            
            {/* Desktop Nav */}
            <nav className="hidden md:flex gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 px-3 lg:px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === tab.id 
                      ? 'bg-accent-primary/10 text-accent-primary' 
                      : theme === 'light' ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100' : 'text-zinc-400 hover:text-zinc-200 hover:bg-terminal-surface'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden lg:inline">{tab.label}</span>
                </button>
              ))}
            </nav>

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              {balanceAlert && (
                <div className="flex items-center gap-1 px-2 py-1 bg-accent-danger/10 text-accent-danger rounded-lg text-xs">
                  <AlertTriangle className="w-3 h-3" />
                  <span className="hidden sm:inline">Low Balance</span>
                </div>
              )}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`p-2 rounded-lg transition-all ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-terminal-surface'}`}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setShowQuickAdd(true)}
                className="flex items-center gap-1 px-3 py-2 bg-accent-primary text-white rounded-lg text-sm font-medium hover:bg-accent-primary/90 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add</span>
              </button>
            </div>
          </div>
          
          {/* Mobile Nav */}
          <nav className="flex md:hidden gap-1 mt-3 overflow-x-auto pb-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.id 
                    ? 'bg-accent-primary/10 text-accent-primary' 
                    : theme === 'light' ? 'text-gray-500 hover:text-gray-700' : 'text-zinc-400'
                }`}
              >
                <tab.icon className="w-3 h-3" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Quick Add Modal */}
      <AnimatePresence>
        {showQuickAdd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowQuickAdd(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-xl p-6 border ${cardClasses}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Quick Add Transaction</h3>
                <button onClick={() => setShowQuickAdd(false)} className={`p-1 rounded ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-zinc-700'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-sm mb-1 ${textMuted}`}>Date</label>
                    <input
                      type="date"
                      value={quickAddForm.date || ''}
                      onChange={(e) => setQuickAddForm(prev => ({ ...prev, date: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                      style={{ colorScheme: theme }}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm mb-1 ${textMuted}`}>Type</label>
                    <select
                      value={quickAddForm.type || 'actual'}
                      onChange={(e) => setQuickAddForm(prev => ({ ...prev, type: e.target.value as 'actual' | 'budget' }))}
                      className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                      style={{ colorScheme: theme }}
                    >
                      <option value="actual">Actual</option>
                      <option value="budget">Budget</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className={`block text-sm mb-1 ${textMuted}`}>Category</label>
                  <select
                    value={quickAddForm.category || 'revenue'}
                    onChange={(e) => setQuickAddForm(prev => ({ ...prev, category: e.target.value as Transaction['category'] }))}
                    className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                    style={{ colorScheme: theme }}
                  >
                    <option value="revenue">Revenue</option>
                    <option value="opex">OpEx (requires project)</option>
                    <option value="overhead">Overhead</option>
                    <option value="investment">Investment</option>
                  </select>
                </div>
                
                <div>
                  <label className={`block text-sm mb-1 ${textMuted}`}>Description</label>
                  <input
                    type="text"
                    placeholder="e.g., Consulting fee"
                    value={quickAddForm.description || ''}
                    onChange={(e) => setQuickAddForm(prev => ({ ...prev, description: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                    style={{ colorScheme: theme }}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-sm mb-1 ${textMuted}`}>Amount</label>
                    <input
                      type="number"
                      placeholder="50000 or -5000"
                      value={quickAddForm.amount || ''}
                      onChange={(e) => setQuickAddForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                      className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                      style={{ colorScheme: theme }}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm mb-1 ${textMuted}`}>Project</label>
                    <select
                      value={quickAddForm.project || ''}
                      onChange={(e) => setQuickAddForm(prev => ({ ...prev, project: e.target.value || undefined }))}
                      className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                      style={{ colorScheme: theme }}
                    >
                      <option value="">None (Overhead)</option>
                      {projectList.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className={`block text-sm mb-1 ${textMuted}`}>Notes (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g., Annual renewal, One-time bonus"
                    value={quickAddForm.notes || ''}
                    onChange={(e) => setQuickAddForm(prev => ({ ...prev, notes: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                    style={{ colorScheme: theme }}
                  />
                </div>
                
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleQuickAdd}
                    disabled={!quickAddForm.description || !quickAddForm.amount}
                    className="flex-1 py-2 bg-accent-primary text-white rounded-lg font-medium disabled:opacity-50 hover:bg-accent-primary/90"
                  >
                    Add Transaction
                  </button>
                  <button
                    onClick={() => setShowProjectModal(true)}
                    className={`px-3 py-2 border rounded-lg ${
                      theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-terminal-border hover:bg-terminal-bg'
                    }`}
                  >
                    <FolderPlus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Project Modal */}
      <AnimatePresence>
        {showProjectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowProjectModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-xl p-6 border ${cardClasses}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Manage Projects</h3>
                <button onClick={() => setShowProjectModal(false)} className={`p-1 rounded ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-zinc-700'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="New project name"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                    style={{ colorScheme: theme }}
                    onKeyDown={(e) => e.key === 'Enter' && addProject()}
                  />
                  <button
                    onClick={addProject}
                    disabled={!newProjectName.trim()}
                    className="px-4 py-2 bg-accent-primary text-white rounded-lg font-medium disabled:opacity-50 hover:bg-accent-primary/90"
                  >
                    Add
                  </button>
                </div>
                
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {projects.length === 0 ? (
                    <p className={`text-sm text-center py-4 ${textMuted}`}>No projects yet</p>
                  ) : (
                    projects.map(p => (
                      <div key={p.id} className={`flex items-center justify-between p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-terminal-bg'}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                          <span>{p.name}</span>
                        </div>
                        <button
                          onClick={() => deleteProject(p.id)}
                          className={`p-1 hover:text-accent-danger ${textMuted}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PDF Export Modal */}
      <AnimatePresence>
        {showPdfExport && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowPdfExport(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-xl p-6 border ${cardClasses}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Export PDF Report</h3>
                <button onClick={() => setShowPdfExport(false)} className={`p-1 rounded ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-zinc-700'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <p className={`text-sm mb-4 ${textMuted}`}>Select sections to include in the executive report:</p>
              
              <div className="space-y-3 mb-6">
                {[
                  { key: 'kpis', label: 'KPI Summary', desc: 'Balance, Revenue, Expenses, Margin' },
                  { key: 'cashFlowChart', label: 'Cash Flow Trend', desc: 'Revenue vs expenses chart' },
                  { key: 'balanceChart', label: 'Running Balance', desc: 'Balance projection chart' },
                  { key: 'expenseBreakdown', label: 'Expense Breakdown', desc: 'OpEx, Overhead, Investment split' },
                  { key: 'comparison', label: 'Comparison Analysis', desc: 'MoM/QoQ comparison' },
                  { key: 'projectMargins', label: 'Project Margins', desc: 'Margin by project' },
                  { key: 'transactions', label: 'Transaction List', desc: 'Detailed transactions (large)' },
                ].map(section => (
                  <label key={section.key} className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                    theme === 'light' ? 'hover:bg-gray-50' : 'hover:bg-terminal-bg'
                  }`}>
                    <input
                      type="checkbox"
                      checked={pdfSections[section.key as keyof typeof pdfSections]}
                      onChange={(e) => setPdfSections(prev => ({ ...prev, [section.key]: e.target.checked }))}
                      className="mt-1 w-4 h-4 rounded accent-accent-primary"
                    />
                    <div>
                      <div className="font-medium">{section.label}</div>
                      <div className={`text-xs ${textSubtle}`}>{section.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPdfExport(false)}
                  className={`flex-1 py-2 rounded-lg font-medium border ${
                    theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-terminal-border hover:bg-terminal-bg'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePdfExport}
                  className="flex-1 py-2 bg-accent-primary text-white rounded-lg font-medium hover:bg-accent-primary/90 flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Export PDF
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Privacy Policy Modal */}
      <AnimatePresence>
        {showPrivacyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setShowPrivacyModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-2xl rounded-xl p-6 border my-8 ${cardClasses}`}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <Shield className="w-6 h-6" />
                  Privacy Policy
                </h3>
                <button onClick={() => setShowPrivacyModal(false)} className={`p-1 rounded ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-zinc-700'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className={`prose prose-sm max-w-none ${theme === 'light' ? 'prose-gray' : 'prose-invert'}`}>
                <p className={textMuted}>Last updated: {new Date().toLocaleDateString()}</p>
                
                <h4 className="font-semibold mt-4">1. Data Collection</h4>
                <p className={textMuted}>
                  {branding.companyName} does not collect, store, or transmit any of your financial data to external servers. 
                  All data you enter is stored exclusively in your web browser's local storage on your device.
                </p>
                
                <h4 className="font-semibold mt-4">2. Data Storage</h4>
                <p className={textMuted}>
                  Your data is stored locally using your browser's localStorage feature. This means:
                </p>
                <ul className={`list-disc pl-5 ${textMuted}`}>
                  <li>Data never leaves your device</li>
                  <li>Data is not accessible to us or any third party</li>
                  <li>Data persists until you clear your browser data</li>
                  <li>Data is not synced across devices or browsers</li>
                </ul>
                
                <h4 className="font-semibold mt-4">3. Data Security</h4>
                <p className={textMuted}>
                  Since all data remains on your device, security depends on your device and browser security. 
                  We recommend keeping your device secure and regularly exporting your data as a backup.
                </p>
                
                <h4 className="font-semibold mt-4">4. Third-Party Services</h4>
                <p className={textMuted}>
                  This application does not integrate with any third-party analytics, tracking, or data collection services.
                </p>
                
                <h4 className="font-semibold mt-4">5. Your Rights</h4>
                <p className={textMuted}>
                  You have complete control over your data. You can export, modify, or delete your data at any time 
                  through the application interface or by clearing your browser's local storage.
                </p>
                
                <h4 className="font-semibold mt-4">6. Contact</h4>
                <p className={textMuted}>
                  For questions about this privacy policy, please contact your system administrator.
                </p>
              </div>
              
              <div className="mt-6 pt-4 border-t border-terminal-border">
                <button
                  onClick={() => setShowPrivacyModal(false)}
                  className="w-full py-2 bg-accent-primary text-white rounded-lg font-medium hover:bg-accent-primary/90"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Terms of Service Modal */}
      <AnimatePresence>
        {showTermsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setShowTermsModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-2xl rounded-xl p-6 border my-8 ${cardClasses}`}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <FileText className="w-6 h-6" />
                  Terms of Service
                </h3>
                <button onClick={() => setShowTermsModal(false)} className={`p-1 rounded ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-zinc-700'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className={`prose prose-sm max-w-none ${theme === 'light' ? 'prose-gray' : 'prose-invert'}`}>
                <p className={textMuted}>Last updated: {new Date().toLocaleDateString()}</p>
                
                <h4 className="font-semibold mt-4">1. Acceptance of Terms</h4>
                <p className={textMuted}>
                  By using {branding.companyName}, you agree to these Terms of Service. If you do not agree, 
                  please do not use the application.
                </p>
                
                <h4 className="font-semibold mt-4">2. Description of Service</h4>
                <p className={textMuted}>
                  {branding.companyName} is a cash flow forecasting and financial planning tool. The application 
                  provides tools for tracking transactions, projecting cash flow, and analyzing financial data.
                </p>
                
                <h4 className="font-semibold mt-4">3. User Responsibilities</h4>
                <p className={textMuted}>You are responsible for:</p>
                <ul className={`list-disc pl-5 ${textMuted}`}>
                  <li>The accuracy of data you enter</li>
                  <li>Maintaining backups of your data (via export)</li>
                  <li>Securing your device and browser</li>
                  <li>Any decisions made based on the application's output</li>
                </ul>
                
                <h4 className="font-semibold mt-4">4. Disclaimer of Warranties</h4>
                <p className={textMuted}>
                  This application is provided "as is" without warranties of any kind. We do not guarantee 
                  the accuracy of calculations, projections, or any financial advice. This tool is for 
                  informational purposes only and should not replace professional financial advice.
                </p>
                
                <h4 className="font-semibold mt-4">5. Limitation of Liability</h4>
                <p className={textMuted}>
                  We are not liable for any damages arising from the use of this application, including 
                  but not limited to financial losses, data loss, or business interruption.
                </p>
                
                <h4 className="font-semibold mt-4">6. Data Loss</h4>
                <p className={textMuted}>
                  Since data is stored in your browser's local storage, clearing browser data or using 
                  incognito/private browsing will result in data loss. We are not responsible for any 
                  data loss. Regular exports are recommended.
                </p>
                
                <h4 className="font-semibold mt-4">7. Modifications</h4>
                <p className={textMuted}>
                  We reserve the right to modify these terms at any time. Continued use of the application 
                  constitutes acceptance of modified terms.
                </p>
              </div>
              
              <div className="mt-6 pt-4 border-t border-terminal-border">
                <button
                  onClick={() => setShowTermsModal(false)}
                  className="w-full py-2 bg-accent-primary text-white rounded-lg font-medium hover:bg-accent-primary/90"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <AnimatePresence mode="wait">
          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4 sm:space-y-6"
            >
              {/* Filters */}
              <div className={`flex flex-wrap items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-xl border ${cardClasses}`}>
                <div className="flex items-center gap-2">
                  <Building2 className={`w-4 h-4 sm:w-5 sm:h-5 ${textMuted}`} />
                  <select
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                    className={`rounded-lg px-2 sm:px-3 py-1.5 text-xs sm:text-sm border ${inputClasses}`}
                    style={{ colorScheme: theme }}
                  >
                    <option value="all">All Projects</option>
                    {projectList.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => setShowProjectModal(true)}
                    className={`p-1.5 border rounded-lg ${
                      theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-terminal-border hover:bg-terminal-bg'
                    }`}
                    title="Manage Projects"
                  >
                    <FolderPlus className="w-4 h-4" />
                  </button>
                </div>
                
                <div className={`hidden sm:block w-px h-6 ${theme === 'light' ? 'bg-gray-300' : 'bg-terminal-border'}`} />
                
                <div className="flex gap-1 sm:gap-2 flex-wrap">
                  {datePresets.map(preset => (
                    <button
                      key={preset.key}
                      onClick={() => {
                        setDateRangePreset(preset.key)
                        setShowDatePicker(preset.key === 'custom')
                      }}
                      className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                        dateRangePreset === preset.key
                          ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
                          : theme === 'light' 
                            ? 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200' 
                            : 'bg-terminal-bg text-zinc-400 hover:text-zinc-200 border border-terminal-border'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Insights Cards */}
              {insights.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {insights.map((insight, idx) => (
                    <div 
                      key={idx}
                      className={`rounded-xl p-4 border flex items-start gap-3 ${
                        insight.type === 'positive' 
                          ? theme === 'light' ? 'bg-green-50 border-green-200' : 'bg-accent-primary/10 border-accent-primary/30'
                          : insight.type === 'warning'
                          ? theme === 'light' ? 'bg-amber-50 border-amber-200' : 'bg-accent-warning/10 border-accent-warning/30'
                          : insight.type === 'critical'
                          ? theme === 'light' ? 'bg-red-50 border-red-200' : 'bg-accent-danger/10 border-accent-danger/30'
                          : cardClasses
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${
                        insight.type === 'positive' ? 'bg-accent-primary/20' :
                        insight.type === 'warning' ? 'bg-accent-warning/20' :
                        insight.type === 'critical' ? 'bg-accent-danger/20' : 'bg-accent-secondary/20'
                      }`}>
                        {insight.type === 'positive' ? <TrendingUp className="w-4 h-4 text-accent-primary" /> :
                         insight.type === 'warning' ? <AlertTriangle className="w-4 h-4 text-accent-warning" /> :
                         insight.type === 'critical' ? <AlertCircle className="w-4 h-4 text-accent-danger" /> :
                         <Info className="w-4 h-4 text-accent-secondary" />}
                      </div>
                      <div>
                        <div className={`font-semibold text-sm ${
                          insight.type === 'positive' ? 'text-accent-primary' :
                          insight.type === 'warning' ? 'text-accent-warning' :
                          insight.type === 'critical' ? 'text-accent-danger' : ''
                        }`}>{insight.title}</div>
                        <div className={`text-xs mt-0.5 ${textMuted}`}>{insight.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* KPI Cards + Runway */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                {/* Monthly Cash Flow Card */}
                <div className={`rounded-xl p-4 sm:p-5 border-2 ${
                  runwayData.status === 'critical' 
                    ? 'border-accent-danger bg-accent-danger/5' 
                    : runwayData.status === 'warning'
                    ? 'border-accent-warning bg-accent-warning/5'
                    : runwayData.status === 'profitable'
                    ? 'border-accent-primary bg-accent-primary/5'
                    : `border-accent-secondary/50 ${theme === 'light' ? 'bg-white' : 'bg-terminal-surface'}`
                } col-span-2 lg:col-span-1`}>
                  <div className={`flex items-center gap-2 text-xs sm:text-sm mb-2 ${textMuted}`}>
                    <TrendingUp className="w-4 h-4" />
                    Monthly Cash Flow
                  </div>
                  <div className={`text-xl sm:text-2xl font-mono font-bold ${
                    runwayData.status === 'profitable' ? 'text-accent-primary' :
                    runwayData.status === 'critical' ? 'text-accent-danger' :
                    runwayData.status === 'warning' ? 'text-accent-warning' : 'text-accent-secondary'
                  }`}>
                    {runwayData.status === 'profitable' 
                      ? `+${formatCurrency(Math.abs(runwayData.avgMonthlyBurn))}`
                      : `-${formatCurrency(Math.abs(runwayData.avgMonthlyBurn))}`}
                  </div>
                  <div className={`text-xs mt-1 flex items-center gap-1 ${
                    runwayData.status === 'profitable' ? 'text-accent-primary' :
                    runwayData.status === 'critical' ? 'text-accent-danger' :
                    runwayData.status === 'warning' ? 'text-accent-warning' : textSubtle
                  }`}>
                    {runwayData.status === 'profitable' 
                      ? <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Cash Positive</span>
                      : `${runwayData.runwayMonths.toFixed(1)} months runway`}
                  </div>
                </div>

                <div className={`rounded-xl p-4 sm:p-5 border ${cardClasses}`}>
                  <div className={`flex items-center gap-2 text-xs sm:text-sm mb-2 ${textMuted}`}>
                    <DollarSign className="w-4 h-4" />
                    Current Balance
                  </div>
                  <div className="text-xl sm:text-2xl font-mono font-semibold text-accent-secondary">
                    {formatCurrency(kpis.currentBalance)}
                  </div>
                  {kpis.hasActualData && kpis.priorPeriodLabel !== 'prior' ? (
                    <div className={`text-xs mt-1 ${kpis.netChange >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                      {formatPercent(kpis.netChange)} vs {kpis.priorPeriodLabel}
                    </div>
                  ) : (
                    <div className={`text-xs mt-1 ${textSubtle}`}>Projected</div>
                  )}
                </div>
                
                <div className={`rounded-xl p-4 sm:p-5 border ${cardClasses}`}>
                  <div className={`flex items-center gap-2 text-xs sm:text-sm mb-2 ${textMuted}`}>
                    <TrendingUp className="w-4 h-4" />
                    Revenue
                  </div>
                  <div className="text-xl sm:text-2xl font-mono font-semibold text-accent-primary">
                    {formatCurrency(kpis.totalRevenue)}
                  </div>
                  {kpis.hasActualData && kpis.totalBudgetRevenue > 0 ? (
                    <div className={`text-xs mt-1 ${kpis.revenueBudgetVariance >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                      {formatPercent(kpis.revenueBudgetVariance)} vs budget
                    </div>
                  ) : (
                    <div className={`text-xs mt-1 ${textSubtle}`}>Total</div>
                  )}
                </div>
                
                <div className={`rounded-xl p-4 sm:p-5 border ${cardClasses}`}>
                  <div className={`flex items-center gap-2 text-xs sm:text-sm mb-2 ${textMuted}`}>
                    <TrendingDown className="w-4 h-4" />
                    Total Expenses
                  </div>
                  <div className="text-xl sm:text-2xl font-mono font-semibold text-accent-danger">
                    {formatCurrency(kpis.totalExpenses)}
                  </div>
                  <div className={`text-xs mt-1 ${textSubtle}`}>
                    OpEx + Overhead + InvEx
                  </div>
                </div>
                
                <div className={`rounded-xl p-4 sm:p-5 border ${cardClasses}`}>
                  <div className={`flex items-center gap-2 text-xs sm:text-sm mb-2 ${textMuted}`}>
                    <Calendar className="w-4 h-4" />
                    Gross Margin
                  </div>
                  <div className={`text-xl sm:text-2xl font-mono font-semibold ${kpis.grossMargin >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                    {kpis.grossMargin.toFixed(1)}%
                  </div>
                  <div className={`text-xs mt-1 ${textSubtle}`}>
                    Net / Revenue
                  </div>
                </div>
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className={`rounded-xl p-4 sm:p-6 border ${cardClasses}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base sm:text-lg font-semibold">Cash Flow Trend</h3>
                      {/* Weekly/Monthly Toggle */}
                      <div className={`flex rounded-lg overflow-hidden border ${theme === 'light' ? 'border-gray-300' : 'border-terminal-border'}`}>
                        <button
                          onClick={() => setTimeView('monthly')}
                          className={`px-2 py-1 text-xs font-medium transition-all ${
                            timeView === 'monthly'
                              ? 'bg-accent-primary text-white'
                              : theme === 'light' ? 'bg-gray-50 text-gray-600' : 'bg-terminal-bg text-zinc-400'
                          }`}
                        >
                          Monthly
                        </button>
                        <button
                          onClick={() => setTimeView('weekly')}
                          className={`px-2 py-1 text-xs font-medium transition-all ${
                            timeView === 'weekly'
                              ? 'bg-accent-primary text-white'
                              : theme === 'light' ? 'bg-gray-50 text-gray-600' : 'bg-terminal-bg text-zinc-400'
                          }`}
                        >
                          Weekly
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { key: 'revenue', label: 'Rev', color: '#10b981' },
                        { key: 'opex', label: 'OpEx', color: '#ef4444' },
                        { key: 'overhead', label: 'OH', color: '#f59e0b' },
                        { key: 'investment', label: 'Inv', color: '#6366f1' },
                        { key: 'net', label: 'Net', color: '#22d3ee' },
                      ].map(f => (
                        <button
                          key={f.key}
                          onClick={() => setChartFilters(prev => ({ ...prev, [f.key]: !prev[f.key as keyof ChartFilters] }))}
                          className={`px-2 py-1 rounded text-xs font-medium transition-all border ${
                            chartFilters[f.key as keyof ChartFilters]
                              ? 'border-transparent text-white'
                              : theme === 'light' ? 'border-gray-300 text-gray-400 bg-transparent' : 'border-terminal-border text-zinc-500 bg-transparent'
                          }`}
                          style={{ 
                            backgroundColor: chartFilters[f.key as keyof ChartFilters] ? f.color : 'transparent'
                          }}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={timeView === 'weekly' ? weeklyData : chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e5e7eb' : '#1e1e2e'} />
                      <XAxis dataKey="name" stroke={theme === 'light' ? '#6b7280' : '#71717a'} fontSize={11} />
                      <YAxis stroke={theme === 'light' ? '#6b7280' : '#71717a'} fontSize={11} tickFormatter={(v) => `$${v/1000}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#12121a', border: `1px solid ${theme === 'light' ? '#e5e7eb' : '#1e1e2e'}`, borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      {chartFilters.revenue && <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[2, 2, 0, 0]} />}
                      {chartFilters.opex && <Bar dataKey="opex" name="OpEx" fill="#ef4444" radius={[2, 2, 0, 0]} />}
                      {chartFilters.overhead && <Bar dataKey="overhead" name="Overhead" fill="#f59e0b" radius={[2, 2, 0, 0]} />}
                      {chartFilters.investment && <Bar dataKey="investment" name="InvEx" fill="#6366f1" radius={[2, 2, 0, 0]} />}
                      {chartFilters.net && <Line type="monotone" dataKey="netCash" name="Net" stroke="#22d3ee" strokeWidth={2} dot={false} />}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>

                <div className={`rounded-xl p-4 sm:p-6 border ${cardClasses}`}>
                  <h3 className="text-base sm:text-lg font-semibold mb-4">Running Balance</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e5e7eb' : '#1e1e2e'} />
                      <XAxis dataKey="name" stroke={theme === 'light' ? '#6b7280' : '#71717a'} fontSize={11} />
                      <YAxis stroke={theme === 'light' ? '#6b7280' : '#71717a'} fontSize={11} tickFormatter={(v) => `$${v/1000}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#12121a', border: `1px solid ${theme === 'light' ? '#e5e7eb' : '#1e1e2e'}`, borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      {balanceAlertThreshold > 0 && (
                        <ReferenceLine y={balanceAlertThreshold} stroke="#ef4444" strokeDasharray="5 5" label={{ value: 'Alert', fill: '#ef4444', fontSize: 10 }} />
                      )}
                      <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="balance" stroke="#10b981" fill="url(#balanceGradient)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Expense Breakdown */}
              {expenseBreakdown.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                  <div className={`rounded-xl p-4 sm:p-6 border ${cardClasses}`}>
                    <h3 className="text-base sm:text-lg font-semibold mb-4">Expense Mix</h3>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={expenseBreakdown}
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          dataKey="value"
                        >
                          {expenseBreakdown.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#12121a', border: `1px solid ${theme === 'light' ? '#e5e7eb' : '#1e1e2e'}`, borderRadius: '8px', fontSize: '12px' }}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-2 mt-2">
                      {expenseBreakdown.map(e => (
                        <div key={e.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.color }} />
                            <span className={textMuted}>{e.name}</span>
                          </div>
                          <span className="font-mono">{e.percent}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="lg:col-span-2 grid grid-cols-3 gap-3 sm:gap-4">
                    <div className={`rounded-xl p-4 border ${cardClasses}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                        <span className={`text-sm ${textMuted}`}>OpEx</span>
                      </div>
                      <div className="text-lg sm:text-xl font-mono font-semibold text-[#ef4444]">
                        {formatCurrency(kpis.totalOpex)}
                      </div>
                      <p className={`text-xs mt-1 ${textSubtle}`}>Project costs</p>
                    </div>
                    
                    <div className={`rounded-xl p-4 border ${cardClasses}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                        <span className={`text-sm ${textMuted}`}>Overhead</span>
                      </div>
                      <div className="text-lg sm:text-xl font-mono font-semibold text-[#f59e0b]">
                        {formatCurrency(kpis.totalOverhead)}
                      </div>
                      <p className={`text-xs mt-1 ${textSubtle}`}>Company-wide</p>
                    </div>
                    
                    <div className={`rounded-xl p-4 border ${cardClasses}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#6366f1]" />
                        <span className={`text-sm ${textMuted}`}>Investment</span>
                      </div>
                      <div className="text-lg sm:text-xl font-mono font-semibold text-[#6366f1]">
                        {formatCurrency(kpis.totalInvestment)}
                      </div>
                      <p className={`text-xs mt-1 ${textSubtle}`}>Capital spend</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Project Margins */}
              {projectMarginData.length > 0 && (
                <div className={`rounded-xl p-4 sm:p-6 border ${cardClasses}`}>
                  <h3 className="text-base sm:text-lg font-semibold mb-4">Project Margins</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {projectMarginData.slice(0, 4).map(p => (
                      <div key={p.name} className={`rounded-lg p-3 ${theme === 'light' ? 'bg-gray-50' : 'bg-terminal-bg'}`}>
                        <div className={`text-sm truncate ${textMuted}`}>{p.name}</div>
                        <div className={`text-lg font-mono ${p.margin >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                          {p.margin.toFixed(1)}%
                        </div>
                        <div className="text-xs text-zinc-500">
                          {formatCurrency(p.revenue)} rev
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comparison Analysis */}
              <div className={`rounded-xl p-4 sm:p-6 border ${cardClasses}`}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold">Comparison Analysis</h3>
                    {selectedProject !== 'all' && (
                      <p className={`text-xs mt-1 ${textMuted}`}>Filtered by: {selectedProject}</p>
                    )}
                  </div>
                  <div className="flex gap-1 sm:gap-2">
                    {([
                      { key: 'mom', label: 'MoM' },
                      { key: 'yoy', label: 'YoY' },
                      { key: 'qoq', label: 'QoQ' },
                      { key: 'project', label: 'By Project' }
                    ] as const).map(view => (
                      <button
                        key={view.key}
                        onClick={() => setComparisonView(view.key)}
                        className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                          comparisonView === view.key
                            ? 'bg-accent-primary text-white'
                            : theme === 'light' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-terminal-bg text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {view.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                <ResponsiveContainer width="100%" height={300}>
                  {comparisonView === 'yoy' && yoyYears.length >= 2 ? (
                    <BarChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e5e7eb' : '#1e1e2e'} />
                      <XAxis dataKey="name" stroke={theme === 'light' ? '#6b7280' : '#71717a'} fontSize={11} />
                      <YAxis stroke={theme === 'light' ? '#6b7280' : '#71717a'} fontSize={11} tickFormatter={(v) => `$${v/1000}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#12121a', border: `1px solid ${theme === 'light' ? '#e5e7eb' : '#1e1e2e'}`, borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      {yoyYears.map((year, idx) => (
                        <Bar 
                          key={`rev${year}`}
                          dataKey={`rev${year}`} 
                          name={`Rev ${year}`} 
                          fill={idx === 0 ? '#6ee7b7' : '#10b981'} 
                          radius={[4, 4, 0, 0]} 
                        />
                      ))}
                    </BarChart>
                  ) : (
                    <BarChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e5e7eb' : '#1e1e2e'} />
                      <XAxis dataKey="name" stroke={theme === 'light' ? '#6b7280' : '#71717a'} fontSize={11} />
                      <YAxis stroke={theme === 'light' ? '#6b7280' : '#71717a'} fontSize={11} tickFormatter={(v) => `$${v/1000}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#12121a', border: `1px solid ${theme === 'light' ? '#e5e7eb' : '#1e1e2e'}`, borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="opex" name="OpEx" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
                
                {/* YoY Note */}
                {comparisonView === 'yoy' && yoyYears.length < 2 && (
                  <p className={`text-center text-sm mt-4 ${textMuted}`}>
                    Need data from at least 2 years for YoY comparison. Showing MoM view.
                  </p>
                )}
                
                {/* QoQ Table */}
                {comparisonView === 'qoq' && qoqData.length > 0 && (
                  <div className="mt-6 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className={`border-b ${theme === 'light' ? 'border-gray-200 text-gray-500' : 'border-terminal-border text-zinc-400'}`}>
                          <th className="pb-2 text-left font-medium">Quarter</th>
                          <th className="pb-2 text-right font-medium">Revenue</th>
                          <th className="pb-2 text-right font-medium">Rev Δ</th>
                          <th className="pb-2 text-right font-medium">OpEx</th>
                          <th className="pb-2 text-right font-medium">Net Cash</th>
                          <th className="pb-2 text-right font-medium">Net Δ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {qoqData.map((q, idx) => (
                          <tr key={q.name} className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-terminal-border/50'}`}>
                            <td className="py-2 font-medium">{q.name}</td>
                            <td className="py-2 text-right font-mono text-accent-primary">{formatCurrency(q.revenue)}</td>
                            <td className={`py-2 text-right font-mono ${parseFloat(q.revenueChange) >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                              {idx === 0 ? '-' : `${q.revenueChange}%`}
                            </td>
                            <td className="py-2 text-right font-mono text-accent-danger">{formatCurrency(q.opex)}</td>
                            <td className={`py-2 text-right font-mono ${q.net >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>{formatCurrency(q.net)}</td>
                            <td className={`py-2 text-right font-mono ${parseFloat(q.netChange) >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                              {idx === 0 ? '-' : `${q.netChange}%`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Transactions */}
              {transactions.length > 0 && (
                <div className={`rounded-xl p-4 sm:p-6 border ${cardClasses}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base sm:text-lg font-semibold">Transactions</h3>
                      <select
                        value={transactionMonthFilter}
                        onChange={(e) => setTransactionMonthFilter(e.target.value)}
                        className={`rounded-lg px-2 py-1 text-xs sm:text-sm border ${inputClasses}`}
                        style={{ colorScheme: theme }}
                      >
                        <option value="all">All Months</option>
                        {transactionMonths.map(m => (
                          <option key={m} value={m}>{getMonthLabel(m)}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={exportToCSV} className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm border ${
                        theme === 'light' ? 'bg-white border-gray-300 hover:bg-gray-50' : 'bg-terminal-bg border-terminal-border'
                      }`}>
                        <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">CSV</span>
                      </button>
                      <button onClick={exportToPDF} className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm border ${
                        theme === 'light' ? 'bg-white border-gray-300 hover:bg-gray-50' : 'bg-terminal-bg border-terminal-border'
                      }`}>
                        <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">PDF</span>
                      </button>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className={`sticky top-0 ${tableHeaderBg}`}>
                        <tr className={`border-b ${tableBorder} text-left ${textMuted}`}>
                          <th className="pb-2 font-medium">Date</th>
                          <th className="pb-2 font-medium">Category</th>
                          <th className="pb-2 font-medium hidden sm:table-cell">Description</th>
                          <th className="pb-2 font-medium text-right">Amount</th>
                          <th className="pb-2 font-medium hidden md:table-cell">Project</th>
                          <th className="pb-2 font-medium text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTransactions.slice(0, 50).map(t => (
                          <tr key={t.id} className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-terminal-border/50'}`}>
                            <td className="py-2 text-xs sm:text-sm">{t.date.slice(5)}</td>
                            <td className="py-2">
                              <span className={`px-1.5 py-0.5 rounded text-xs ${
                                t.category === 'revenue' ? 'bg-accent-primary/10 text-accent-primary' : 
                                t.category === 'opex' ? 'bg-accent-danger/10 text-accent-danger' : 
                                t.category === 'overhead' ? 'bg-accent-warning/10 text-accent-warning' :
                                'bg-accent-secondary/10 text-accent-secondary'
                              }`}>
                                {t.category === 'investment' ? 'InvEx' : t.category}
                              </span>
                            </td>
                            <td className="py-2 text-xs sm:text-sm hidden sm:table-cell">
                                              <div className="flex items-center gap-1 max-w-40">
                                                <span className="truncate">{t.description}</span>
                                                {t.notes && (
                                                  <button 
                                                    onClick={() => setExpandedNotes(prev => {
                                                      const next = new Set(prev)
                                                      if (next.has(t.id)) next.delete(t.id)
                                                      else next.add(t.id)
                                                      return next
                                                    })}
                                                    className="p-0.5 text-accent-secondary hover:text-accent-primary"
                                                    title={t.notes}
                                                  >
                                                    <MessageSquare className="w-3 h-3" />
                                                  </button>
                                                )}
                                              </div>
                                              {t.notes && expandedNotes.has(t.id) && (
                                                <div className={`text-xs mt-1 p-1.5 rounded ${theme === 'light' ? 'bg-gray-100 text-gray-600' : 'bg-terminal-bg text-zinc-400'}`}>
                                                  {t.notes}
                                                </div>
                                              )}
                                            </td>
                            <td className={`py-2 text-right font-mono text-xs sm:text-sm ${t.amount >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                              {formatCurrency(t.amount)}
                            </td>
                            <td className={`py-2 text-xs hidden md:table-cell ${textMuted}`}>{t.project || '-'}</td>
                            <td className="py-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button onClick={() => startEdit(t)} className="p-1 text-zinc-400 hover:text-accent-primary">
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button onClick={() => deleteTransaction(t.id)} className="p-1 text-zinc-400 hover:text-accent-danger">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className={`text-xs mt-3 text-center ${textMuted}`}>
                    {filteredTransactions.length} transactions
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* Data Tab */}
          {activeTab === 'data' && (
            <motion.div key="data" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={`rounded-xl p-6 border ${cardClasses}`}>
                  <h3 className="text-lg font-semibold mb-4">Beginning Balance</h3>
                  <div className="relative">
                    <DollarSign className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${textMuted}`} />
                    <input
                      type="number"
                      value={beginningBalance}
                      onChange={(e) => setBeginningBalance(parseFloat(e.target.value) || 0)}
                      className={`pl-10 pr-4 py-3 rounded-lg text-xl font-mono w-full border ${inputClasses}`}
                      style={{ colorScheme: theme }}
                    />
                  </div>
                </div>

                <div className={`rounded-xl p-6 border ${cardClasses}`}>
                  <h3 className="text-lg font-semibold mb-4">Actuals Cutoff</h3>
                  <input
                    type="month"
                    value={cutoffDate}
                    onChange={(e) => setCutoffDate(e.target.value)}
                    className={`px-4 py-3 rounded-lg font-mono w-full border ${inputClasses}`}
                    style={{ colorScheme: theme }}
                  />
                </div>
              </div>

              <div 
                className={`rounded-xl p-8 border-2 border-dashed transition-all ${
                  isDragging 
                    ? 'border-accent-primary bg-accent-primary/5' 
                    : theme === 'light' ? 'border-gray-300' : 'border-terminal-border'
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) handleFileUpload(file) }}
              >
                <div className="text-center">
                  <Upload className={`w-12 h-12 mx-auto mb-4 ${textMuted}`} />
                  <h3 className="text-lg font-semibold mb-2">Import Data</h3>
                  <p className={`mb-4 ${textMuted}`}>CSV format • Drag & drop or click</p>
                  <input type="file" accept=".csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file) }} className="hidden" id="file-upload" />
                  <label htmlFor="file-upload" className="inline-flex items-center gap-2 px-6 py-3 bg-accent-primary/10 text-accent-primary rounded-lg cursor-pointer hover:bg-accent-primary/20">
                    <Upload className="w-5 h-5" />
                    Choose File
                  </label>
                </div>
              </div>

              <div className={`rounded-xl p-6 border ${cardClasses}`}>
                <h3 className="text-lg font-semibold mb-4">Required Format</h3>
                <div className={`rounded-lg p-4 font-mono text-xs sm:text-sm overflow-x-auto ${theme === 'light' ? 'bg-gray-50' : 'bg-terminal-bg'}`}>
                  <div className={textMuted}>date,category,description,amount,type,project,notes</div>
                  <div className="text-accent-primary">2024-01-15,revenue,Consulting,50000,actual,Project Alpha,Q1 retainer</div>
                  <div className="text-accent-danger">2024-01-01,opex,Labor,-15000,actual,Project Alpha,</div>
                  <div className="text-accent-warning">2024-01-01,overhead,Rent,-5000,actual,,Monthly rent</div>
                  <div className="text-accent-secondary">2024-02-15,investment,Equipment,-20000,actual,,Annual purchase</div>
                </div>
                <div className={`text-xs mt-3 space-y-1 ${textSubtle}`}>
                  <p><strong>Categories:</strong> revenue, opex, overhead, investment</p>
                  <p><strong>Type:</strong> actual or budget</p>
                  <p><strong>Notes:</strong> optional context (e.g., "Annual renewal")</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <button onClick={loadSampleData} className="flex items-center gap-2 px-6 py-3 bg-accent-secondary/10 text-accent-secondary rounded-lg hover:bg-accent-secondary/20">
                  <RefreshCw className="w-5 h-5" />
                  Load Sample
                </button>
                <button onClick={exportToCSV} disabled={!transactions.length} className={`flex items-center gap-2 px-6 py-3 rounded-lg border disabled:opacity-50 ${
                  theme === 'light' ? 'bg-white border-gray-300 hover:bg-gray-50' : 'bg-terminal-bg border-terminal-border'
                }`}>
                  <Download className="w-5 h-5" />
                  Export CSV
                </button>
                <button onClick={clearAllData} disabled={!transactions.length} className="flex items-center gap-2 px-6 py-3 bg-accent-danger/10 text-accent-danger rounded-lg disabled:opacity-50 hover:bg-accent-danger/20">
                  <Trash2 className="w-5 h-5" />
                  Clear All
                </button>
              </div>
            </motion.div>
          )}

          {/* Assumptions Tab */}
          {activeTab === 'assumptions' && (
            <motion.div key="assumptions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              {/* Scenario Selector */}
              <div className={`rounded-xl p-4 border ${cardClasses}`}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">Scenario:</h3>
                    <select
                      value={activeScenario}
                      onChange={(e) => setActiveScenario(e.target.value)}
                      className={`rounded-lg px-3 py-1.5 text-sm border ${inputClasses}`}
                      style={{ colorScheme: theme }}
                    >
                      {scenarios.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const name = prompt('New scenario name:')
                        if (name) addScenario(name)
                      }}
                      className={`flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg ${
                        theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-terminal-border hover:bg-terminal-bg'
                      }`}
                    >
                      <Plus className="w-4 h-4" />
                      New
                    </button>
                    <button
                      onClick={() => {
                        const name = prompt('Duplicate as:')
                        if (name) duplicateScenario(activeScenario, name)
                      }}
                      className={`flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg ${
                        theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-terminal-border hover:bg-terminal-bg'
                      }`}
                    >
                      <Copy className="w-4 h-4" />
                      Duplicate
                    </button>
                  </div>
                </div>
              </div>

              <div className={`rounded-xl p-6 border ${cardClasses}`}>
                <h3 className="text-lg font-semibold mb-4">Add Assumption</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <input type="text" placeholder="Name" value={newAssumption.name || ''} onChange={(e) => setNewAssumption(prev => ({ ...prev, name: e.target.value }))} className={`px-4 py-2 rounded-lg border ${inputClasses}`} style={{ colorScheme: theme }} />
                  <select value={newAssumption.category || 'revenue'} onChange={(e) => setNewAssumption(prev => ({ ...prev, category: e.target.value as Assumption['category'] }))} className={`px-4 py-2 rounded-lg border ${inputClasses}`} style={{ colorScheme: theme }}>
                    <option value="revenue">Revenue</option>
                    <option value="opex">OpEx</option>
                    <option value="overhead">Overhead</option>
                    <option value="investment">Investment</option>
                  </select>
                  <input type="number" placeholder="Amount" value={newAssumption.amount || ''} onChange={(e) => setNewAssumption(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))} className={`px-4 py-2 rounded-lg border ${inputClasses}`} style={{ colorScheme: theme }} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  <select value={newAssumption.frequency || 'monthly'} onChange={(e) => setNewAssumption(prev => ({ ...prev, frequency: e.target.value as Assumption['frequency'] }))} className={`px-4 py-2 rounded-lg border ${inputClasses}`} style={{ colorScheme: theme }}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annually">Annually</option>
                    <option value="one-time">One-time</option>
                  </select>
                  <input type="month" value={newAssumption.startDate || ''} onChange={(e) => setNewAssumption(prev => ({ ...prev, startDate: e.target.value }))} className={`px-4 py-2 rounded-lg border ${inputClasses}`} style={{ colorScheme: theme }} />
                  <input type="month" placeholder="End (optional)" value={newAssumption.endDate || ''} onChange={(e) => setNewAssumption(prev => ({ ...prev, endDate: e.target.value }))} className={`px-4 py-2 rounded-lg border ${inputClasses}`} style={{ colorScheme: theme }} />
                  <select value={newAssumption.project || ''} onChange={(e) => setNewAssumption(prev => ({ ...prev, project: e.target.value || undefined }))} className={`px-4 py-2 rounded-lg border ${inputClasses}`} style={{ colorScheme: theme }}>
                    <option value="">No Project</option>
                    {projectList.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <button onClick={addAssumption} disabled={!newAssumption.name || !newAssumption.startDate} className="px-6 py-2 bg-accent-primary text-white rounded-lg disabled:opacity-50 hover:bg-accent-primary/90">
                  Add Assumption
                </button>
              </div>

              <div className={`rounded-xl p-6 border ${cardClasses}`}>
                <h3 className="text-lg font-semibold mb-4">Assumptions ({activeAssumptions.length})</h3>
                {activeAssumptions.length === 0 ? (
                  <p className={`text-center py-8 ${textMuted}`}>No assumptions. Add one above.</p>
                ) : (
                  <div className="space-y-2">
                    {activeAssumptions.map(a => (
                      <div key={a.id} className={`flex items-center justify-between p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-terminal-bg'}`}>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            a.category === 'revenue' ? 'bg-accent-primary/10 text-accent-primary' : 
                            a.category === 'opex' ? 'bg-accent-danger/10 text-accent-danger' : 
                            a.category === 'overhead' ? 'bg-accent-warning/10 text-accent-warning' :
                            'bg-accent-secondary/10 text-accent-secondary'
                          }`}>{a.category}</span>
                          <span className="font-medium">{a.name}</span>
                          <span className={`text-sm ${textMuted}`}>{a.frequency}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`font-mono ${a.amount >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                            {formatCurrency(a.amount)}
                          </span>
                          <button onClick={() => deleteAssumption(a.id)} className={`hover:text-accent-danger ${textMuted}`}>
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
            <motion.div key="projections" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              <div className={`rounded-xl p-6 border ${cardClasses}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Projection Horizon</h3>
                  <div className="flex gap-2">
                    {([1, 2, 3] as const).map(years => (
                      <button key={years} onClick={() => setProjectionYears(years)} className={`px-4 py-2 rounded-lg font-medium ${
                        projectionYears === years 
                          ? 'bg-accent-primary text-white' 
                          : theme === 'light' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-terminal-bg'
                      }`}>
                        {years}Y
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`rounded-xl p-6 border ${cardClasses}`}>
                <h3 className="text-lg font-semibold mb-4">{projectionYears}-Year Projection</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="projGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e5e7eb' : '#1e1e2e'} />
                    <XAxis dataKey="monthLabel" stroke={theme === 'light' ? '#6b7280' : '#71717a'} fontSize={11} />
                    <YAxis stroke={theme === 'light' ? '#6b7280' : '#71717a'} fontSize={11} tickFormatter={(v) => `$${v/1000}k`} />
                    <Tooltip contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#12121a', border: `1px solid ${theme === 'light' ? '#e5e7eb' : '#1e1e2e'}`, borderRadius: '8px' }} formatter={(value: number) => formatCurrency(value)} />
                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                    <Area type="monotone" dataKey={(d: MonthlyData) => d.runningBalance.projected} stroke="#10b981" fill="url(#projGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className={`rounded-xl p-6 border ${cardClasses}`}>
                <h3 className="text-lg font-semibold mb-4">Monthly Detail</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={`border-b ${tableBorder} ${textMuted}`}>
                        <th className="pb-2 text-left">Month</th>
                        <th className="pb-2 text-right">Revenue</th>
                        <th className="pb-2 text-right">OpEx</th>
                        <th className="pb-2 text-right">Overhead</th>
                        <th className="pb-2 text-right">InvEx</th>
                        <th className="pb-2 text-right">Net</th>
                        <th className="pb-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyData.slice(0, 24).map(d => (
                        <tr key={d.month} className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-terminal-border/50'}`}>
                          <td className="py-2 font-medium">{d.monthLabel}</td>
                          <td className="py-2 text-right font-mono text-accent-primary">{formatCurrency(d.revenue.projected)}</td>
                          <td className="py-2 text-right font-mono text-accent-danger">{formatCurrency(d.opex.projected)}</td>
                          <td className="py-2 text-right font-mono text-accent-warning">{formatCurrency(d.overhead.projected)}</td>
                          <td className="py-2 text-right font-mono text-accent-secondary">{formatCurrency(d.investment.projected)}</td>
                          <td className={`py-2 text-right font-mono ${d.netCash.projected >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>{formatCurrency(d.netCash.projected)}</td>
                          <td className={`py-2 text-right font-mono ${d.runningBalance.projected >= 0 ? 'text-accent-secondary' : 'text-accent-danger'}`}>{formatCurrency(d.runningBalance.projected)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <motion.div key="settings" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              
              {/* White-Label Branding */}
              <div className={`rounded-xl p-6 border ${cardClasses}`}>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Palette className="w-5 h-5" />
                  Branding
                </h3>
                <p className={`text-sm mb-4 ${textMuted}`}>Customize the look to match your company</p>
                
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm mb-2 ${textMuted}`}>Company Name</label>
                    <input
                      type="text"
                      value={branding.companyName}
                      onChange={(e) => setBranding(prev => ({ ...prev, companyName: e.target.value }))}
                      className={`w-full max-w-md px-4 py-2 rounded-lg border ${inputClasses}`}
                      style={{ colorScheme: theme }}
                      placeholder="Your Company Name"
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm mb-2 ${textMuted}`}>Brand Color</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={branding.brandColor}
                        onChange={(e) => setBranding(prev => ({ ...prev, brandColor: e.target.value }))}
                        className="w-12 h-10 rounded-lg cursor-pointer border-0"
                      />
                      <input
                        type="text"
                        value={branding.brandColor}
                        onChange={(e) => setBranding(prev => ({ ...prev, brandColor: e.target.value }))}
                        className={`w-32 px-3 py-2 rounded-lg border font-mono text-sm ${inputClasses}`}
                        style={{ colorScheme: theme }}
                      />
                      <button
                        onClick={() => setBranding(prev => ({ ...prev, brandColor: '#10b981' }))}
                        className={`px-3 py-2 text-sm rounded-lg border ${theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-terminal-border hover:bg-terminal-bg'}`}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className={`block text-sm mb-2 ${textMuted}`}>Company Logo</label>
                    <div className="flex items-center gap-4">
                      {branding.companyLogo ? (
                        <div className="relative">
                          <img src={branding.companyLogo} alt="Logo" className="w-16 h-16 rounded-lg object-contain border border-dashed" />
                          <button
                            onClick={() => setBranding(prev => ({ ...prev, companyLogo: null }))}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-accent-danger text-white rounded-full flex items-center justify-center"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className={`w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center ${theme === 'light' ? 'border-gray-300' : 'border-terminal-border'}`}>
                          <Image className={`w-6 h-6 ${textMuted}`} />
                        </div>
                      )}
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              const reader = new FileReader()
                              reader.onload = (ev) => {
                                setBranding(prev => ({ ...prev, companyLogo: ev.target?.result as string }))
                              }
                              reader.readAsDataURL(file)
                            }
                          }}
                          className="hidden"
                          id="logo-upload"
                        />
                        <label
                          htmlFor="logo-upload"
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer border ${theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-terminal-border hover:bg-terminal-bg'}`}
                        >
                          <Upload className="w-4 h-4" />
                          Upload Logo
                        </label>
                        <p className={`text-xs mt-1 ${textSubtle}`}>PNG, JPG up to 500KB</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Balance Alert */}
              <div className={`rounded-xl p-6 border ${cardClasses}`}>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Balance Alert
                </h3>
                <p className={`text-sm mb-4 ${textMuted}`}>Get warned when projected balance falls below threshold</p>
                <div className="flex items-center gap-4">
                  <div className="relative flex-1 max-w-xs">
                    <DollarSign className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${textMuted}`} />
                    <input
                      type="number"
                      value={balanceAlertThreshold}
                      onChange={(e) => setBalanceAlertThreshold(parseFloat(e.target.value) || 0)}
                      className={`pl-10 pr-4 py-3 rounded-lg font-mono w-full border ${inputClasses}`}
                      style={{ colorScheme: theme }}
                      placeholder="0 = disabled"
                    />
                  </div>
                  {balanceAlertThreshold > 0 && (
                    <span className="text-accent-primary text-sm">Active</span>
                  )}
                </div>
              </div>

              {/* Appearance */}
              <div className={`rounded-xl p-6 border ${cardClasses}`}>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                  Appearance
                </h3>
                <div className="flex gap-3">
                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                      theme === 'dark' 
                        ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' 
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    Dark
                  </button>
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${
                      theme === 'light' 
                        ? 'border-accent-primary bg-accent-primary/10 text-accent-primary' 
                        : 'border-terminal-border text-zinc-400 hover:bg-terminal-bg'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    Light
                  </button>
                </div>
              </div>

              {/* Your Data */}
              <div className={`rounded-xl p-6 border ${cardClasses}`}>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <HardDrive className="w-5 h-5" />
                  Your Data
                </h3>
                
                <div className={`p-4 rounded-lg mb-4 ${theme === 'light' ? 'bg-green-50 border border-green-200' : 'bg-accent-primary/10 border border-accent-primary/20'}`}>
                  <div className="flex items-start gap-3">
                    <CloudOff className="w-5 h-5 text-accent-primary mt-0.5" />
                    <div>
                      <p className={`font-medium ${theme === 'light' ? 'text-green-800' : 'text-accent-primary'}`}>100% Private & Local</p>
                      <p className={`text-sm mt-1 ${theme === 'light' ? 'text-green-700' : 'text-accent-primary/80'}`}>
                        Your financial data never leaves your device. All data is stored in your browser's local storage. 
                        We have no servers, no accounts, and no access to your information.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className={`flex items-center justify-between p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-terminal-bg'}`}>
                    <div className="flex items-center gap-3">
                      <Database className="w-5 h-5" />
                      <div>
                        <p className={`font-medium ${theme === 'light' ? 'text-gray-900' : 'text-zinc-200'}`}>Storage Location</p>
                        <p className={`text-sm ${textMuted}`}>Browser localStorage (this device only)</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className={`flex items-center justify-between p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-terminal-bg'}`}>
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5" />
                      <div>
                        <p className={`font-medium ${theme === 'light' ? 'text-gray-900' : 'text-zinc-200'}`}>Data Ownership</p>
                        <p className={`text-sm ${textMuted}`}>You own 100% of your data. Export anytime.</p>
                      </div>
                    </div>
                    <button onClick={exportToCSV} className={`px-3 py-1.5 text-sm rounded-lg border ${theme === 'light' ? 'border-gray-300 hover:bg-gray-100' : 'border-terminal-border hover:bg-terminal-bg'}`}>
                      Export
                    </button>
                  </div>
                </div>
                
                <div className={`mt-4 p-3 rounded-lg ${theme === 'light' ? 'bg-amber-50 border border-amber-200' : 'bg-accent-warning/10 border border-accent-warning/20'}`}>
                  <p className={`text-sm ${theme === 'light' ? 'text-amber-800' : 'text-accent-warning'}`}>
                    <strong>Important:</strong> Clearing your browser data or using a different browser/device will reset your data. 
                    We recommend exporting regularly as a backup.
                  </p>
                </div>
              </div>

              {/* Security & Data (Coming Soon) */}
              <div className={`rounded-xl p-6 border ${cardClasses}`}>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Lock className="w-5 h-5" />
                  Security & Data (Coming Soon)
                </h3>
                <div className={`space-y-4 ${textMuted}`}>
                  <div className={`flex items-center justify-between p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-terminal-bg'}`}>
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5" />
                      <div>
                        <p className={`font-medium ${theme === 'light' ? 'text-gray-900' : 'text-zinc-200'}`}>User Authentication</p>
                        <p className="text-sm">Secure login with SSO</p>
                      </div>
                    </div>
                    <span className="text-xs bg-accent-warning/10 text-accent-warning px-2 py-1 rounded">Planned</span>
                  </div>
                  <div className={`flex items-center justify-between p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-terminal-bg'}`}>
                    <div className="flex items-center gap-3">
                      <Database className="w-5 h-5" />
                      <div>
                        <p className={`font-medium ${theme === 'light' ? 'text-gray-900' : 'text-zinc-200'}`}>Cloud Database</p>
                        <p className="text-sm">Encrypted data storage</p>
                      </div>
                    </div>
                    <span className="text-xs bg-accent-warning/10 text-accent-warning px-2 py-1 rounded">Planned</span>
                  </div>
                  <div className={`flex items-center justify-between p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-terminal-bg'}`}>
                    <div className="flex items-center gap-3">
                      <Lock className="w-5 h-5" />
                      <div>
                        <p className={`font-medium ${theme === 'light' ? 'text-gray-900' : 'text-zinc-200'}`}>Role-Based Access</p>
                        <p className="text-sm">Admin, Editor, Viewer roles</p>
                      </div>
                    </div>
                    <span className="text-xs bg-accent-warning/10 text-accent-warning px-2 py-1 rounded">Planned</span>
                  </div>
                </div>
              </div>

              {/* Legal */}
              <div className={`rounded-xl p-6 border ${cardClasses}`}>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Legal
                </h3>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setShowPrivacyModal(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-terminal-border hover:bg-terminal-bg'}`}
                  >
                    <Shield className="w-4 h-4" />
                    Privacy Policy
                  </button>
                  <button
                    onClick={() => setShowTermsModal(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-terminal-border hover:bg-terminal-bg'}`}
                  >
                    <FileText className="w-4 h-4" />
                    Terms of Service
                  </button>
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className={`border-t mt-12 py-4 print:hidden ${theme === 'light' ? 'border-gray-200' : 'border-terminal-border'}`}>
        <div className={`max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs ${textMuted}`}>
          <span>{branding.companyName} • Data stored locally in browser</span>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowPrivacyModal(true)} className="hover:underline">Privacy</button>
            <button onClick={() => setShowTermsModal(true)} className="hover:underline">Terms</button>
          </div>
        </div>
      </footer>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          .bg-terminal-bg, .bg-terminal-surface { background: white !important; }
          .text-zinc-100, .text-zinc-200, .text-zinc-300, .text-zinc-400 { color: black !important; }
          .border-terminal-border { border-color: #e5e5e5 !important; }
        }
      `}</style>
    </div>
  )
}
