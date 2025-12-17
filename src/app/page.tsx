'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  Sparkles, AlertCircle, CheckCircle, Info, MessageSquare, Gauge, List, Tag,
  BarChart3, LogOut, User, Menu, ChevronDown, ChevronRight, PanelLeftClose, PanelLeft
} from 'lucide-react'
import { 
  supabase, signOut, getCurrentUser, getCurrentProfile,
  fetchTransactions, insertTransaction as supabaseInsertTransaction, 
  updateTransaction as supabaseUpdateTransaction, deleteTransaction as supabaseDeleteTransaction, 
  bulkInsertTransactions, deleteAllTransactions,
  fetchAccrualTransactions, insertAccrualTransaction as supabaseInsertAccrualTransaction, 
  updateAccrualTransaction as supabaseUpdateAccrualTransaction, 
  deleteAccrualTransaction as supabaseDeleteAccrualTransaction, 
  bulkInsertAccrualTransactions, deleteAllAccrualTransactions,
  fetchAssumptions, insertAssumption as supabaseInsertAssumption, 
  deleteAssumption as supabaseDeleteAssumption,
  fetchCategories, fetchCompanySettings, updateCompanySettings,
  updateCategory as supabaseUpdateCategory, insertCategory as supabaseInsertCategory, deleteCategory as supabaseDeleteCategory,
  fetchClients, insertClient as supabaseInsertClient, updateClient as supabaseUpdateClient, deleteClient as supabaseDeleteClient
} from '../lib/supabase'

// Vantage Logo Component
const VantageLogo = ({ size = 48, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="24" cy="24" r="22" stroke="#3d8a96" strokeWidth="2.5" fill="none"/>
    <rect x="12" y="28" width="5" height="10" rx="1" fill="#7cc5cf"/>
    <rect x="19" y="22" width="5" height="16" rx="1" fill="#4da8b5"/>
    <rect x="26" y="14" width="5" height="24" rx="1" fill="#2d8a96"/>
    <path d="M10 32L18 26L25 20L38 12" stroke="#2d6b78" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// Types
interface Category {
  id: string
  dbId?: string  // Database UUID for updates
  name: string
  type: 'income' | 'expense'  // For grouping in reports
  color: string
  isDefault: boolean
}

interface Transaction {
  id: string
  date: string
  category: string  // Now supports custom categories
  description: string
  amount: number
  type: 'actual' | 'budget'
  project?: string
  recurring?: boolean
  recurringId?: string
  notes?: string
  expectedPaymentDate?: string // For AR/AP timing
}

// Accrual transactions (invoices) - separate from cash
interface AccrualTransaction {
  id: string
  date: string  // Invoice date (when recognized)
  type: 'revenue' | 'direct_cost'  // Invoice TO client or FROM contractor
  description: string
  amount: number  // Positive for revenue, negative for costs
  project: string  // Required for accrual - must be project-based
  vendor?: string  // Client name or Contractor name
  invoiceNumber?: string
  notes?: string
}

// Dashboard view mode
type DashboardView = 'cash' | 'accrual' | 'comparison'

interface Assumption {
  id: string
  name: string
  category: string  // Now supports custom categories
  amount: number
  valueType: 'amount' | 'percentage'  // $ or %
  percentOf?: 'baseline' | 'previous' | 'revenue' | 'opex' | 'overhead' | 'investment'  // What the % references
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
  budget?: number
  budgetAlertThreshold?: number // percentage (default 80)
  clientId?: string // Links to Client
  targetGrossMargin?: number // KPI goal percentage
  startDate?: string
  endDate?: string
  createdAt: string
}

interface Client {
  id: string
  name: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  status: 'active' | 'inactive' | 'prospect'
  notes?: string
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

// Normalize project name for case-insensitive matching
const normalizeProjectName = (name: string | undefined): string => {
  return (name || '').trim().toUpperCase()
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
  accrualTransactions: 'cashflow_accrual_transactions',
  assumptions: 'cashflow_assumptions',
  beginningBalance: 'cashflow_beginning_balance',
  cutoffDate: 'cashflow_cutoff_date',
  projects: 'cashflow_projects',
  scenarios: 'cashflow_scenarios',
  recurringRules: 'cashflow_recurring',
  theme: 'cashflow_theme',
  balanceAlert: 'cashflow_balance_alert',
  branding: 'cashflow_branding',
  chartFilters: 'cashflow_chart_filters',
  categories: 'cashflow_categories'
}

// Default categories
const DEFAULT_CATEGORIES: Category[] = [
  { id: 'revenue', name: 'Revenue', type: 'income', color: '#14b8a6', isDefault: true },
  { id: 'opex', name: 'OpEx', type: 'expense', color: '#ef4444', isDefault: true },
  { id: 'overhead', name: 'Overhead', type: 'expense', color: '#f59e0b', isDefault: true },
  { id: 'investment', name: 'Investment', type: 'expense', color: '#6366f1', isDefault: true },
  { id: 'unassigned', name: 'Unassigned', type: 'expense', color: '#a855f7', isDefault: true },
]

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
  const router = useRouter()
  
  // Auth state
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  
  // Core state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'data' | 'assumptions' | 'projections' | 'clients' | 'integrations' | 'settings'>('dashboard')
  const [beginningBalance, setBeginningBalance] = useState<number>(50000)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accrualTransactions, setAccrualTransactions] = useState<AccrualTransaction[]>([])
  const [dashboardView, setDashboardView] = useState<DashboardView>('cash')
  const [assumptions, setAssumptions] = useState<Assumption[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('all')
  const [showClientModal, setShowClientModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [newClientForm, setNewClientForm] = useState<Partial<Client>>({
    name: '',
    status: 'active'
  })
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES)
  const [scenarios, setScenarios] = useState<Scenario[]>([{ id: 'base', name: 'Base Case', isBase: true, createdAt: new Date().toISOString() }])
  const [recurringRules, setRecurringRules] = useState<RecurringRule[]>([])
  const [projectionYears, setProjectionYears] = useState<1 | 2 | 3>(1)
  const [comparisonView, setComparisonView] = useState<'mom' | 'yoy' | 'qoq' | 'project'>('mom')
  const [cutoffDate, setCutoffDate] = useState<string>(new Date().toISOString().slice(0, 7))
  const [isDragging, setIsDragging] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  
  // Projection settings
  const [baselinePeriod, setBaselinePeriod] = useState<'L3M' | 'L6M' | 'L12M' | 'all'>('L3M')
  const [projectionPeriod, setProjectionPeriod] = useState<'3M' | '6M' | '12M' | '18M' | '24M'>('12M')
  
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
  
  // AI Categorization state
  const [showAiPreview, setShowAiPreview] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [pendingUploadData, setPendingUploadData] = useState<any[]>([])
  const [uploadType, setUploadType] = useState<'cash' | 'accrual'>('cash')
  
  // Branding state
  const [branding, setBranding] = useState<BrandingSettings>({
    companyName: 'Vantage',
    companyLogo: null,
    brandColor: '#14b8a6'
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
  const [transactionCategoryFilter, setTransactionCategoryFilter] = useState<string>('all')
  
  // View mode
  const [timeView, setTimeView] = useState<'monthly' | 'weekly'>('monthly')
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  
  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Transaction>>({})
  
  // Accrual transaction management
  const [transactionViewType, setTransactionViewType] = useState<'cash' | 'accrual'>('cash')
  const [accrualMonthFilter, setAccrualMonthFilter] = useState<string>('all')
  const [accrualTypeFilter, setAccrualTypeFilter] = useState<string>('all')
  const [accrualProjectFilter, setAccrualProjectFilter] = useState<string>('all')
  const [selectedAccrualIds, setSelectedAccrualIds] = useState<Set<string>>(new Set())
  const [editingAccrualId, setEditingAccrualId] = useState<string | null>(null)
  const [editAccrualForm, setEditAccrualForm] = useState<Partial<AccrualTransaction>>({})
  const [showAccrualModal, setShowAccrualModal] = useState(false)
  const [accrualModalMode, setAccrualModalMode] = useState<'add' | 'edit'>('add')
  const [accrualModalForm, setAccrualModalForm] = useState<Partial<AccrualTransaction>>({
    date: new Date().toISOString().slice(0, 10),
    type: 'revenue',
    description: '',
    amount: 0,
    project: '',
    vendor: ''
  })
  
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
  const [newProjectBudget, setNewProjectBudget] = useState<number | ''>('')
  const [newProjectClientId, setNewProjectClientId] = useState<string>('')
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  
  // Assumption form
  const [newAssumption, setNewAssumption] = useState<Partial<Assumption>>({
    name: '',
    category: 'revenue',
    frequency: 'monthly',
    amount: 0,
    valueType: 'amount',
    percentOf: 'baseline',
    startDate: new Date().toISOString().slice(0, 7)
  })

  // Auth check and data loading from Supabase
  useEffect(() => {
    const initAuth = async () => {
      const { user } = await getCurrentUser()
      if (!user) {
        router.push('/login')
        return
      }
      
      setUser(user)
      
      // Get profile with company_id
      const { profile } = await getCurrentProfile()
      if (profile) {
        setProfile(profile)
        setCompanyId(profile.company_id)
        
        // Load data from Supabase
        setDataLoading(true)
        try {
          const [
            transactionsRes, 
            accrualRes, 
            assumptionsRes, 
            categoriesRes,
            settingsRes,
            clientsRes
          ] = await Promise.all([
            fetchTransactions(profile.company_id),
            fetchAccrualTransactions(profile.company_id),
            fetchAssumptions(profile.company_id),
            fetchCategories(profile.company_id),
            fetchCompanySettings(profile.company_id),
            fetchClients(profile.company_id)
          ])
          
          if (transactionsRes.data) {
            // Map Supabase format to app format
            const mapped = transactionsRes.data.map((t: any) => ({
              id: t.id,
              date: t.date,
              category: t.category,
              description: t.description,
              amount: parseFloat(t.amount),
              type: t.type,
              project: t.project,
              notes: t.notes
            }))
            setTransactions(mapped)
          }
          
          if (accrualRes.data) {
            const mapped = accrualRes.data.map((t: any) => ({
              id: t.id,
              date: t.date,
              type: t.type,
              description: t.description,
              amount: parseFloat(t.amount),
              project: t.project,
              vendor: t.vendor,
              invoiceNumber: t.invoice_number,
              notes: t.notes
            }))
            setAccrualTransactions(mapped)
          }
          
          if (assumptionsRes.data) {
            const mapped = assumptionsRes.data.map((a: any) => ({
              id: a.id,
              name: a.name,
              category: a.category,
              amount: parseFloat(a.amount),
              valueType: a.value_type,
              percentOf: a.percent_of,
              frequency: a.frequency,
              startDate: a.start_date,
              endDate: a.end_date,
              project: a.project,
              scenarioId: a.scenario_id
            }))
            setAssumptions(mapped)
          }
          
          if (categoriesRes.data && categoriesRes.data.length > 0) {
            const mapped = categoriesRes.data.map((c: any) => ({
              id: c.category_id,
              dbId: c.id,  // Keep the actual database UUID for updates
              name: c.name,
              type: c.type,
              color: c.color,
              isDefault: c.is_default
            }))
            setCategories(mapped)
          }
          
          if (settingsRes.data) {
            if (settingsRes.data.beginning_balance) {
              setBeginningBalance(parseFloat(settingsRes.data.beginning_balance))
            }
            
           if (settingsRes.data.company_logo) {
  setBranding(prev => ({ ...prev, companyLogo: settingsRes.data.company_logo }))
}
            if (settingsRes.data.brand_color) {
              setBranding(prev => ({ ...prev, brandColor: settingsRes.data.brand_color }))
            }
          }
          
          if (clientsRes.data) {
            const mapped = clientsRes.data.map((c: any) => ({
              id: c.id,
              name: c.name,
              contactName: c.contact_name,
              contactEmail: c.contact_email,
              contactPhone: c.contact_phone,
              status: c.status,
              notes: c.notes,
              createdAt: c.created_at
            }))
            setClients(mapped)
          }
          
          // Load UI preferences from localStorage (these stay local)
          const savedTheme = localStorage.getItem(STORAGE_KEYS.theme)
          const savedChartFilters = localStorage.getItem(STORAGE_KEYS.chartFilters)
          if (savedTheme) setTheme(savedTheme as 'dark' | 'light')
          if (savedChartFilters) setChartFilters(JSON.parse(savedChartFilters))
          
        } catch (error) {
          console.error('Error loading data from Supabase:', error)
        }
        setDataLoading(false)
      }
      
      setAuthLoading(false)
      setIsLoaded(true)
    }
    
    initAuth()
  }, [router])

  // Sign out handler
  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  // Save UI preferences to localStorage (theme, chart filters stay local)

  // Only save UI preferences to localStorage - data is in Supabase
  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.theme, theme)
      document.documentElement.classList.toggle('light-mode', theme === 'light')
    }
  }, [theme, isLoaded])

  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.chartFilters, JSON.stringify(chartFilters))
    }
  }, [chartFilters, isLoaded])

  // Helper to get category by id
  const getCategoryById = useCallback((id: string): Category | undefined => {
    return categories.find(c => c.id === id)
  }, [categories])

  // Helper to get category color
  const getCategoryColor = useCallback((categoryId: string): string => {
    const cat = getCategoryById(categoryId)
    return cat?.color || '#6b7280' // gray default
  }, [getCategoryById])
  
  const activeDateRange = useMemo(() => {
    return getDateRangeFromPreset(dateRangePreset, customStartDate, customEndDate)
  }, [dateRangePreset, customStartDate, customEndDate])

  const projectList = useMemo(() => {
    const fromProjects = projects.map(p => p.name)
    const fromTransactions: string[] = []
    transactions.forEach(t => {
      if (t.project && !fromTransactions.some(p => normalizeProjectName(p) === normalizeProjectName(t.project))) {
        fromTransactions.push(t.project)
      }
    })
    // Also include from accrual transactions
    accrualTransactions.forEach(t => {
      if (t.project && !fromTransactions.some(p => normalizeProjectName(p) === normalizeProjectName(t.project))) {
        fromTransactions.push(t.project)
      }
    })
    const combined = [...fromProjects, ...fromTransactions]
    // Deduplicate case-insensitively, keeping first occurrence
    const seen = new Map<string, string>()
    combined.forEach(p => {
      const normalized = normalizeProjectName(p)
      if (!seen.has(normalized)) {
        seen.set(normalized, p)
      }
    })
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [transactions, accrualTransactions, projects])

  const transactionMonths = useMemo(() => {
    const months = new Set<string>()
    transactions.forEach(t => {
      months.add(t.date.slice(0, 7))
    })
    return Array.from(months).sort().reverse()
  }, [transactions])

  // Accrual transaction filter options
  const accrualMonths = useMemo(() => {
    const months = new Set<string>()
    accrualTransactions.forEach(t => {
      months.add(t.date.slice(0, 7))
    })
    return Array.from(months).sort().reverse()
  }, [accrualTransactions])

  const accrualProjects = useMemo(() => {
    const seen = new Map<string, string>()
    accrualTransactions.forEach(t => {
      if (t.project) {
        const normalized = normalizeProjectName(t.project)
        if (!seen.has(normalized)) {
          seen.set(normalized, t.project)
        }
      }
    })
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  }, [accrualTransactions])

  const filteredAccrualTransactions = useMemo(() => {
    let result = accrualTransactions.filter(t => 
      t && 
      typeof t.date === 'string' && 
      t.date.length >= 7 &&
      typeof t.amount === 'number' &&
      !isNaN(t.amount)
    )
    
    if (accrualMonthFilter !== 'all') {
      result = result.filter(t => t.date.slice(0, 7) === accrualMonthFilter)
    }
    if (accrualTypeFilter !== 'all') {
      result = result.filter(t => t.type === accrualTypeFilter)
    }
    if (accrualProjectFilter !== 'all') {
      result = result.filter(t => normalizeProjectName(t.project) === normalizeProjectName(accrualProjectFilter))
    }
    return result.sort((a, b) => b.date.localeCompare(a.date))
  }, [accrualTransactions, accrualMonthFilter, accrualTypeFilter, accrualProjectFilter])

  // Auto-categorize: no project = overhead for expense categories
  const normalizeTransaction = useCallback((t: Partial<Transaction>): Transaction => {
    const normalized = { ...t } as Transaction
    
    // Don't auto-convert unassigned - let users categorize manually
    if (normalized.category === 'unassigned') {
      return normalized
    }
    
    // If no project and it's opex/investment, convert to overhead
    if (!normalized.project && (normalized.category === 'opex' || normalized.category === 'investment')) {
      normalized.category = 'overhead'
    }
    
    return normalized
  }, [])

  const loadSampleData = useCallback(async () => {
    if (!companyId || !user) return
    const { transactions: sampleTx, projects: sampleProjects } = generateSampleData()
    
    // Insert to Supabase
    const toInsert = sampleTx.map(t => ({
      date: t.date,
      category: t.category,
      description: t.description,
      amount: t.amount,
      type: t.type,
      project: t.project,
      notes: t.notes
    }))
    
    const { error } = await bulkInsertTransactions(toInsert, companyId, user.id)
    if (!error) {
      // Reload from Supabase to get proper IDs
      const { data } = await fetchTransactions(companyId)
      if (data) {
        const mapped = data.map((t: any) => ({
          id: t.id,
          date: t.date,
          category: t.category,
          description: t.description,
          amount: parseFloat(t.amount),
          type: t.type,
          project: t.project,
          notes: t.notes
        }))
        setTransactions(mapped)
      }
      setProjects(sampleProjects)
    }
  }, [companyId, user])

  const clearAllData = useCallback(async () => {
    if (!companyId) return
    if (confirm('Are you sure you want to delete all transactions? This cannot be undone.')) {
      const { error } = await deleteAllTransactions(companyId)
      if (!error) {
        setTransactions([])
      }
    }
  }, [companyId])

  const handleFileUpload = useCallback(async (file: File) => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    
    // Helper to normalize date formats
    const normalizeDate = (dateStr: string): string | null => {
      if (!dateStr) return null
      const cleaned = dateStr.trim()
      
      // Try YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
        return cleaned
      }
      
      // Try YY-MM-DD or YY-M-D format (e.g., 25-10-1 -> 2025-10-01)
      const yyMatch = cleaned.match(/^(\d{2})-(\d{1,2})-(\d{1,2})$/)
      if (yyMatch) {
        const [, year, month, day] = yyMatch
        const fullYear = parseInt(year) > 50 ? `19${year}` : `20${year}`
        return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      }
      
      // Try MM/DD/YYYY or M/D/YYYY format
      const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
      if (slashMatch) {
        const [, month, day, year] = slashMatch
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      }
      
      // Try MM/DD/YY or M/D/YY format
      const slashYYMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
      if (slashYYMatch) {
        const [, month, day, year] = slashYYMatch
        const fullYear = parseInt(year) > 50 ? `19${year}` : `20${year}`
        return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      }
      
      // Try MM-DD-YYYY format
      const dashMatch = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
      if (dashMatch) {
        const [, month, day, year] = dashMatch
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      }
      
      // Try parsing as Date object
      try {
        const parsed = new Date(cleaned)
        if (!isNaN(parsed.getTime())) {
          return parsed.toISOString().slice(0, 10)
        }
      } catch (e) {
        // ignore
      }
      
      return null
    }
    
    if (fileExtension === 'csv') {
      // CSV Import
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
        complete: async (results) => {
          const imported: Transaction[] = results.data
            .filter((row) => row.date && (row.amount || row.amount === '0'))
            .map((row) => {
              // Normalize date
              const normalizedDate = normalizeDate(row.date)
              if (!normalizedDate) return null
              
              // Parse amount first to help determine category
              const amount = parseFloat(String(row.amount).replace(/[,$"]/g, ''))
              if (isNaN(amount)) return null
              
              // Normalize category names - default to unassigned for empty/unknown
              let category = 'unassigned'
              const rawCategory = (row.category || '').toLowerCase().trim()
              
              // First try exact match with existing categories (including custom)
              const exactMatch = categories.find(c => 
                c.id.toLowerCase() === rawCategory || 
                c.name.toLowerCase() === rawCategory
              )
              if (exactMatch) {
                category = exactMatch.id
              } else if (rawCategory.includes('revenue') || rawCategory.includes('income') || rawCategory.includes('sales')) {
                category = 'revenue'
              } else if (rawCategory.includes('opex') || rawCategory.includes('operating') || rawCategory.includes('direct')) {
                category = 'opex'
              } else if (rawCategory.includes('overhead') || rawCategory.includes('admin') || rawCategory.includes('non_operational') || rawCategory.includes('g&a')) {
                category = 'overhead'
              } else if (rawCategory.includes('invest') || rawCategory.includes('capex') || rawCategory.includes('capital')) {
                category = 'investment'
              } else if (rawCategory.includes('travel')) {
                // Auto-create travel category if it doesn't exist
                if (!categories.find(c => c.id === 'travel')) {
                  setCategories(prev => [...prev, { id: 'travel', name: 'Travel', type: 'expense', color: '#06b6d4', isDefault: false }])
                }
                category = 'travel'
              } else if (rawCategory.includes('tax')) {
                // Auto-create taxes category if it doesn't exist
                if (!categories.find(c => c.id === 'taxes')) {
                  setCategories(prev => [...prev, { id: 'taxes', name: 'Taxes', type: 'expense', color: '#dc2626', isDefault: false }])
                }
                category = 'taxes'
              } else if (rawCategory !== '') {
                // Unknown category - keep as unassigned but could auto-create
                category = 'unassigned'
              }
              
              const t: Transaction = {
                id: generateId(),
                date: normalizedDate,
                category,
                description: row.description?.trim() || '',
                amount,
                type: (row.type?.toLowerCase().trim() === 'budget' ? 'budget' : 'actual') as 'actual' | 'budget',
                project: row.project?.trim() || undefined,
                notes: row.notes?.trim() || undefined
              }
              return normalizeTransaction(t)
            })
            .filter((t): t is Transaction => t !== null)
            
          if (imported.length > 0) {
            // Insert to Supabase
            if (companyId && user) {
              const toInsert = imported.map(t => ({
                date: t.date,
                category: t.category,
                description: t.description,
                amount: t.amount,
                type: t.type,
                project: t.project,
                notes: t.notes
              }))
              
              const { data, error } = await bulkInsertTransactions(toInsert, companyId, user.id)
              if (error) {
                alert(`Error importing to database: ${error.message}`)
              } else if (data) {
                // Map returned data with proper IDs
                const mapped = data.map((t: any) => ({
                  id: t.id,
                  date: t.date,
                  category: t.category,
                  description: t.description,
                  amount: parseFloat(t.amount),
                  type: t.type,
                  project: t.project,
                  notes: t.notes
                }))
                setTransactions(prev => [...prev, ...mapped])
                alert(`Successfully imported ${imported.length} transactions`)
              }
            } else {
              setTransactions(prev => [...prev, ...imported])
              alert(`Successfully imported ${imported.length} transactions`)
            }
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
}, [normalizeTransaction, companyId, user])

  // Accrual/Invoice file upload handler
  const handleAccrualUpload = useCallback((file: File) => {
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    
    // Helper to normalize date formats
    const normalizeDate = (dateStr: string): string | null => {
      if (!dateStr) return null
      const cleaned = dateStr.trim()
      
      if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned
      
      const yyMatch = cleaned.match(/^(\d{2})-(\d{1,2})-(\d{1,2})$/)
      if (yyMatch) {
        const [, year, month, day] = yyMatch
        const fullYear = parseInt(year) > 50 ? `19${year}` : `20${year}`
        return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      }
      
      const slashMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
      if (slashMatch) {
        const [, month, day, year] = slashMatch
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      }
      
      const slashYYMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)
      if (slashYYMatch) {
        const [, month, day, year] = slashYYMatch
        const fullYear = parseInt(year) > 50 ? `19${year}` : `20${year}`
        return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      }
      
      try {
        const parsed = new Date(cleaned)
        if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
      } catch (e) { /* ignore */ }
      
      return null
    }
    
    if (fileExtension === 'csv') {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_'),
        complete: async (results) => {
          const imported: AccrualTransaction[] = results.data
            .filter((row) => row.date && (row.amount || row.amount === '0'))
            .map((row) => {
              const normalizedDate = normalizeDate(row.date)
              if (!normalizedDate) return null
              
              const amount = parseFloat(String(row.amount).replace(/[,$"]/g, ''))
              if (isNaN(amount)) return null
              
              // Determine type: revenue (positive invoices to clients) or direct_cost (contractor invoices)
              let type: 'revenue' | 'direct_cost' = 'revenue'
              const rawType = (row.type || '').toLowerCase().trim()
              
              if (rawType.includes('cost') || rawType.includes('expense') || rawType.includes('contractor') || rawType.includes('direct')) {
                type = 'direct_cost'
              } else if (rawType.includes('revenue') || rawType.includes('income') || rawType.includes('invoice')) {
                type = 'revenue'
              } else if (amount < 0) {
                type = 'direct_cost'
              }
              
              const t: AccrualTransaction = {
                id: generateId(),
                date: normalizedDate,
                type,
                description: row.description?.trim() || '',
                amount: Math.abs(amount) * (type === 'direct_cost' ? -1 : 1),
                project: row.project?.trim() || 'Unassigned',
                vendor: row.vendor?.trim() || row.client?.trim() || undefined,
                invoiceNumber: row.invoice_number?.trim() || row.invoice?.trim() || undefined,
                notes: row.notes?.trim() || undefined
              }
              return t
            })
            .filter((t): t is AccrualTransaction => t !== null)
            
         if (imported.length > 0) {
  if (companyId && user) {
    const toInsert = imported.map(t => ({
      date: t.date,
      type: t.type,
      description: t.description,
      amount: t.amount,
      project: t.project,
      vendor: t.vendor,
      invoice_number: t.invoiceNumber,
      notes: t.notes
    }))
    
    const { data, error } = await bulkInsertAccrualTransactions(toInsert, companyId, user.id)
    if (error) {
      alert(`Error importing to database: ${error.message}`)
    } else if (data) {
      const mapped = data.map((t: any) => ({
        id: t.id,
        date: t.date,
        type: t.type,
        description: t.description,
        amount: parseFloat(t.amount),
        project: t.project,
        vendor: t.vendor,
        invoiceNumber: t.invoice_number,
        notes: t.notes
      }))
      setAccrualTransactions(prev => [...prev, ...mapped])
      const revenueCount = mapped.filter(t => t.type === 'revenue').length
      const costCount = mapped.filter(t => t.type === 'direct_cost').length
      alert(`Successfully imported ${mapped.length} accrual entries (${revenueCount} revenue, ${costCount} direct costs)`)
    }
  }          } else {
            alert('No valid accrual data found. Check column headers: date, type, description, amount, project, vendor')
          }
        },
        error: (error) => {
          alert(`Error parsing CSV: ${error.message}`)
        }
      })
    } else {
      alert('Please use CSV format for accrual data')
    }
  }, [companyId, user])

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

  const exportAccrualToCSV = useCallback(() => {
    const csv = Papa.unparse(accrualTransactions)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'accrual-transactions.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [accrualTransactions])

  // AI Categorization
  const categorizeWithAI = useCallback(async (data: any[], type: 'cash' | 'accrual') => {
    setAiLoading(true)
    setAiError(null)
    setPendingUploadData(data)
    setUploadType(type)
    
    try {
      const response = await fetch('/api/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: data.map((t, idx) => ({
            id: `temp-${idx}`,
            date: t.date,
            description: t.description,
            amount: t.amount,
            vendor: t.vendor,
            project: t.project
          })),
          existingCategories: categories.map(c => c.name),
          existingProjects: projectList
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to categorize')
      }
      
      const result = await response.json()
      
      // Merge AI suggestions back with original data
      const suggestions = data.map((original, idx) => {
        const aiSuggestion = result.categorizedTransactions.find((s: any) => s.id === `temp-${idx}`)
        return {
          ...original,
          id: `temp-${idx}`,
          suggestedCategory: aiSuggestion?.suggestedCategory || 'unassigned',
          suggestedProject: aiSuggestion?.suggestedProject || original.project || '',
          suggestedType: aiSuggestion?.suggestedType || (original.amount >= 0 ? 'revenue' : 'direct_cost'),
          confidence: aiSuggestion?.confidence || 50,
          reasoning: aiSuggestion?.reasoning || '',
          accepted: true // Default to accepted
        }
      })
      
      setAiSuggestions(suggestions)
      setShowAiPreview(true)
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Failed to categorize transactions')
      // Still show preview with original data
      const fallbackSuggestions = data.map((original, idx) => ({
        ...original,
        id: `temp-${idx}`,
        suggestedCategory: original.category || 'unassigned',
        suggestedProject: original.project || '',
        suggestedType: original.type || (original.amount >= 0 ? 'revenue' : 'direct_cost'),
        confidence: 0,
        reasoning: 'AI categorization failed - using original values',
        accepted: true
      }))
      setAiSuggestions(fallbackSuggestions)
      setShowAiPreview(true)
    } finally {
      setAiLoading(false)
    }
  }, [categories, projectList])

  const applyAiSuggestions = useCallback(async () => {
    const acceptedSuggestions = aiSuggestions.filter(s => s.accepted)
    
    if (acceptedSuggestions.length === 0) {
      setShowAiPreview(false)
      setAiSuggestions([])
      return
    }
    
    if (uploadType === 'accrual') {
      const toInsert = acceptedSuggestions.map(s => ({
        date: s.date,
        type: s.suggestedType,
        description: s.description,
        amount: Math.abs(s.amount) * (s.suggestedType === 'direct_cost' ? -1 : 1),
        project: s.suggestedProject,
        vendor: s.vendor,
        invoice_number: s.invoiceNumber,
        notes: s.notes
      }))
      
      if (companyId && user) {
        const { data, error } = await bulkInsertAccrualTransactions(toInsert, companyId, user.id)
        if (error) {
          alert(`Error importing to database: ${error.message}`)
        } else if (data) {
          const mapped = data.map((t: any) => ({
            id: t.id,
            date: t.date,
            type: t.type,
            description: t.description,
            amount: parseFloat(t.amount),
            project: t.project,
            vendor: t.vendor,
            invoiceNumber: t.invoice_number,
            notes: t.notes
          }))
          setAccrualTransactions(prev => [...prev, ...mapped])
          alert(`Successfully imported ${mapped.length} accrual entries with AI categorization`)
        }
      }
    } else {
      const toInsert = acceptedSuggestions.map(s => ({
        date: s.date,
        category: s.suggestedCategory,
        type: s.type || 'actual',
        description: s.description,
        amount: s.amount,
        project: s.suggestedProject,
        notes: s.notes
      }))
      
      if (companyId && user) {
        const { data, error } = await bulkInsertTransactions(toInsert, companyId, user.id)
        if (error) {
          alert(`Error importing to database: ${error.message}`)
        } else if (data) {
          const mapped = data.map((t: any) => ({
            id: t.id,
            date: t.date,
            category: t.category,
            description: t.description,
            amount: parseFloat(t.amount),
            type: t.type,
            project: t.project,
            notes: t.notes
          }))
          setTransactions(prev => [...prev, ...mapped])
          alert(`Successfully imported ${mapped.length} transactions with AI categorization`)
        }
      }
    }
    
    setShowAiPreview(false)
    setAiSuggestions([])
    setPendingUploadData([])
  }, [aiSuggestions, uploadType, companyId, user])

  const toggleSuggestionAccepted = useCallback((id: string) => {
    setAiSuggestions(prev => prev.map(s => 
      s.id === id ? { ...s, accepted: !s.accepted } : s
    ))
  }, [])

  const updateSuggestion = useCallback((id: string, field: string, value: any) => {
    setAiSuggestions(prev => prev.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ))
  }, [])

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

  const deleteTransaction = useCallback(async (id: string) => {
    const { error } = await supabaseDeleteTransaction(id)
    if (!error) {
      setTransactions(prev => prev.filter(t => t.id !== id))
    }
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

  const saveEdit = useCallback(async () => {
    if (editingId) {
      const updates = {
        category: editForm.category,
        type: editForm.type,
        project: editForm.project,
        description: editForm.description,
        amount: editForm.amount,
        date: editForm.date
      }
      
      const { error } = await supabaseUpdateTransaction(editingId, updates)
      if (!error) {
        setTransactions(prev => prev.map(t => 
          t.id === editingId 
            ? normalizeTransaction({ ...t, ...editForm })
            : t
        ))
      }
      setEditingId(null)
      setEditForm({})
    }
  }, [editingId, editForm, normalizeTransaction])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditForm({})
  }, [])

  // Accrual Transaction Management
  const deleteAccrualTransaction = useCallback(async (id: string) => {
    const { error } = await supabaseDeleteAccrualTransaction(id)
    if (!error) {
      setAccrualTransactions(prev => prev.filter(t => t.id !== id))
      setSelectedAccrualIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [])

 const bulkDeleteAccrualTransactions = useCallback(async () => {
  if (selectedAccrualIds.size === 0) return
  if (confirm(`Delete ${selectedAccrualIds.size} selected accrual transaction(s)?`)) {
    for (const id of Array.from(selectedAccrualIds)) {
      const { error } = await supabaseDeleteAccrualTransaction(id)
      if (error) {
        console.error('Error deleting accrual transaction:', error)
      }
    }
    setAccrualTransactions(prev => prev.filter(t => !selectedAccrualIds.has(t.id)))
    setSelectedAccrualIds(new Set())
  }
}, [selectedAccrualIds])

const clearAllAccrualTransactions = useCallback(async () => {
  if (confirm('Clear ALL accrual transactions? This cannot be undone.')) {
    const { error } = await deleteAllAccrualTransactions(companyId || undefined)
    if (error) {
      console.error('Error clearing accrual transactions:', error)
      alert('Failed to clear transactions. Please try again.')
      return
    }
    setAccrualTransactions([])
    setSelectedAccrualIds(new Set())
  }
}, [companyId])

  const toggleAccrualSelection = useCallback((id: string) => {
    setSelectedAccrualIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAllAccrualSelection = useCallback((ids: string[]) => {
    setSelectedAccrualIds(prev => {
      const allSelected = ids.every(id => prev.has(id))
      if (allSelected) {
        return new Set()
      } else {
        return new Set(ids)
      }
    })
  }, [])

  const startEditAccrual = useCallback((transaction: AccrualTransaction) => {
    setEditingAccrualId(transaction.id)
    setEditAccrualForm({
      date: transaction.date,
      type: transaction.type,
      description: transaction.description,
      amount: transaction.amount,
      project: transaction.project,
      vendor: transaction.vendor,
      invoiceNumber: transaction.invoiceNumber,
      notes: transaction.notes
    })
  }, [])

  const saveEditAccrual = useCallback(async () => {
  if (editingAccrualId) {
    const updates = {
      date: editAccrualForm.date,
      type: editAccrualForm.type,
      description: editAccrualForm.description,
      amount: editAccrualForm.amount,
      project: editAccrualForm.project,
      vendor: editAccrualForm.vendor,
      invoice_number: editAccrualForm.invoiceNumber,
      notes: editAccrualForm.notes
    }
    
    const { error } = await supabaseUpdateAccrualTransaction(editingAccrualId, updates)
    if (error) {
      console.error('Error updating accrual transaction:', error)
      alert('Failed to save changes. Please try again.')
      return
    }
    
    setAccrualTransactions(prev => prev.map(t => 
      t.id === editingAccrualId 
        ? { ...t, ...editAccrualForm }
        : t
    ))
    setEditingAccrualId(null)
    setEditAccrualForm({})
  }
}, [editingAccrualId, editAccrualForm])

  const cancelEditAccrual = useCallback(() => {
    setEditingAccrualId(null)
    setEditAccrualForm({})
  }, [])

  // Accrual Modal Functions
  const openAddAccrualModal = useCallback(() => {
    setAccrualModalMode('add')
    setAccrualModalForm({
      date: new Date().toISOString().slice(0, 10),
      type: 'revenue',
      description: '',
      amount: 0,
      project: '',
      vendor: ''
    })
    setShowAccrualModal(true)
  }, [])

  const openEditAccrualModal = useCallback((transaction: AccrualTransaction) => {
    setAccrualModalMode('edit')
    setAccrualModalForm({
      id: transaction.id,
      date: transaction.date,
      type: transaction.type,
      description: transaction.description,
      amount: Math.abs(transaction.amount),
      project: transaction.project,
      vendor: transaction.vendor,
      invoiceNumber: transaction.invoiceNumber,
      notes: transaction.notes
    })
    setShowAccrualModal(true)
  }, [])

  const saveAccrualModal = useCallback(async () => {
    if (!accrualModalForm.description || !accrualModalForm.project) {
      alert('Please fill in description and project')
      return
    }
    
    const amount = Math.abs(accrualModalForm.amount || 0) * (accrualModalForm.type === 'direct_cost' ? -1 : 1)
    
    if (accrualModalMode === 'add') {
      if (!companyId || !user) return
      
      const txData = {
        date: accrualModalForm.date || new Date().toISOString().slice(0, 10),
        type: accrualModalForm.type || 'revenue',
        description: accrualModalForm.description,
        amount,
        project: accrualModalForm.project,
        vendor: accrualModalForm.vendor,
        invoice_number: accrualModalForm.invoiceNumber,
        notes: accrualModalForm.notes
      }
      
      const { data, error } = await supabaseInsertAccrualTransaction(txData, companyId, user.id)
      
      if (!error && data) {
        const newAccrual: AccrualTransaction = {
          id: data.id,
          date: data.date,
          type: data.type,
          description: data.description,
          amount: parseFloat(data.amount),
          project: data.project,
          vendor: data.vendor,
          invoiceNumber: data.invoice_number,
          notes: data.notes
        }
        setAccrualTransactions(prev => [...prev, newAccrual])
      }
    } else {
      if (!accrualModalForm.id) return
      
      const updates = {
        date: accrualModalForm.date,
        type: accrualModalForm.type,
        description: accrualModalForm.description,
        amount,
        project: accrualModalForm.project,
        vendor: accrualModalForm.vendor,
        invoice_number: accrualModalForm.invoiceNumber,
        notes: accrualModalForm.notes
      }
      
      const { error } = await supabaseUpdateAccrualTransaction(accrualModalForm.id, updates)
      
      if (!error) {
        setAccrualTransactions(prev => prev.map(t => 
          t.id === accrualModalForm.id 
            ? { ...t, ...accrualModalForm, amount }
            : t
        ))
      }
    }
    
    setShowAccrualModal(false)
    setAccrualModalForm({
      date: new Date().toISOString().slice(0, 10),
      type: 'revenue',
      description: '',
      amount: 0,
      project: '',
      vendor: ''
    })
  }, [accrualModalMode, accrualModalForm])

  const closeAccrualModal = useCallback(() => {
    setShowAccrualModal(false)
    setAccrualModalForm({
      date: new Date().toISOString().slice(0, 10),
      type: 'revenue',
      description: '',
      amount: 0,
      project: '',
      vendor: ''
    })
  }, [])

  // Quick Add Transaction
const handleQuickAdd = useCallback(async () => {
    if (!quickAddForm.description || !quickAddForm.amount || !companyId || !user) return
    
    const isAccrual = (quickAddForm as any).targetType === 'accrual'
    
    if (isAccrual) {
      // Add to Accrual transactions
      const txData = {
        date: quickAddForm.date || new Date().toISOString().slice(0, 10),
        type: quickAddForm.category === 'revenue' ? 'revenue' : 'direct_cost',
        description: quickAddForm.description,
        amount: quickAddForm.category === 'revenue' ? Math.abs(quickAddForm.amount) : -Math.abs(quickAddForm.amount),
        project: quickAddForm.project || 'Unassigned',
        vendor: '',
        invoice_number: '',
        notes: quickAddForm.notes
      }
      
      const { data, error } = await supabaseInsertAccrualTransaction(txData, companyId, user.id)
      
      if (!error && data) {
        const newAccrual: AccrualTransaction = {
          id: data.id,
          date: data.date,
          type: data.type,
          description: data.description,
          amount: parseFloat(data.amount),
          project: data.project,
          vendor: data.vendor,
          invoiceNumber: data.invoice_number,
          notes: data.notes
        }
        setAccrualTransactions(prev => [...prev, newAccrual])
      }
    } else {
      // Add to Cash transactions
      const txData = {
        date: quickAddForm.date || new Date().toISOString().slice(0, 10),
        category: quickAddForm.category || 'revenue',
        description: quickAddForm.description,
        amount: quickAddForm.amount,
        type: quickAddForm.type || 'actual',
        project: quickAddForm.project,
        notes: quickAddForm.notes
      }
      
      const { data, error } = await supabaseInsertTransaction(txData, companyId, user.id)
      
      if (!error && data) {
        const newTx: Transaction = normalizeTransaction({
          id: data.id,
          date: data.date,
          category: data.category,
          description: data.description,
          amount: parseFloat(data.amount),
          type: data.type,
          project: data.project,
          notes: data.notes
        })
        setTransactions(prev => [...prev, newTx])
      }
    }
    
    setQuickAddForm({
      date: new Date().toISOString().slice(0, 10),
      category: 'revenue',
      type: 'actual',
      amount: 0,
      description: '',
      notes: ''
    })
    setShowQuickAdd(false)
  }, [quickAddForm, normalizeTransaction, companyId, user])

  // Project Management
  const addProject = useCallback(() => {
    if (newProjectName.trim()) {
      const newProject: Project = {
        id: generateId(),
        name: newProjectName.trim(),
        color: PROJECT_COLORS[projects.length % PROJECT_COLORS.length],
        status: 'active',
        budget: newProjectBudget !== '' ? Number(newProjectBudget) : undefined,
        budgetAlertThreshold: 80,
        clientId: newProjectClientId || undefined,
        createdAt: new Date().toISOString()
      }
      setProjects(prev => [...prev, newProject])
      setNewProjectName('')
      setNewProjectBudget('')
      setNewProjectClientId('')
      setShowProjectModal(false)
    }
  }, [newProjectName, newProjectBudget, newProjectClientId, projects.length])

  const updateProject = useCallback((id: string, updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
    setEditingProject(null)
  }, [])

  const deleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id))
  }, [])

  // Client Management
  const addClient = useCallback(async () => {
    if (!newClientForm.name?.trim()) return
    
    const clientData = {
      name: newClientForm.name.trim(),
      contact_name: newClientForm.contactName || null,
      contact_email: newClientForm.contactEmail || null,
      contact_phone: newClientForm.contactPhone || null,
      status: newClientForm.status || 'active',
      notes: newClientForm.notes || null
    }
    
    if (companyId && user) {
      const { data, error } = await supabaseInsertClient(clientData, companyId, user.id)
      if (error) {
        alert(`Error creating client: ${error.message}`)
        return
      }
      if (data) {
        const newClient: Client = {
          id: data.id,
          name: data.name,
          contactName: data.contact_name,
          contactEmail: data.contact_email,
          contactPhone: data.contact_phone,
          status: data.status,
          notes: data.notes,
          createdAt: data.created_at
        }
        setClients(prev => [...prev, newClient])
      }
    } else {
      // Fallback to local-only if no Supabase
      const newClient: Client = {
        id: generateId(),
        name: newClientForm.name.trim(),
        contactName: newClientForm.contactName,
        contactEmail: newClientForm.contactEmail,
        contactPhone: newClientForm.contactPhone,
        status: newClientForm.status || 'active',
        notes: newClientForm.notes,
        createdAt: new Date().toISOString()
      }
      setClients(prev => [...prev, newClient])
    }
    
    setNewClientForm({ name: '', status: 'active' })
    setShowClientModal(false)
  }, [newClientForm, companyId, user])

  const updateClientData = useCallback(async (id: string, updates: Partial<Client>) => {
    const dbUpdates = {
      name: updates.name,
      contact_name: updates.contactName,
      contact_email: updates.contactEmail,
      contact_phone: updates.contactPhone,
      status: updates.status,
      notes: updates.notes
    }
    
    const { error } = await supabaseUpdateClient(id, dbUpdates)
    if (error) {
      alert(`Error updating client: ${error.message}`)
      return
    }
    
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
    setEditingClient(null)
  }, [])

  const deleteClientData = useCallback(async (id: string) => {
    if (!confirm('Delete this client? Projects linked to this client will be unlinked.')) return
    
    const { error } = await supabaseDeleteClient(id)
    if (error) {
      alert(`Error deleting client: ${error.message}`)
      return
    }
    
    setClients(prev => prev.filter(c => c.id !== id))
    // Unlink projects from deleted client
    setProjects(prev => prev.map(p => p.clientId === id ? { ...p, clientId: undefined } : p))
  }, [])

  // Client analytics
  const clientAnalytics = useMemo(() => {
    return clients.map(client => {
      // Get projects for this client
      const clientProjects = projects.filter(p => p.clientId === client.id)
      const projectNames = clientProjects.map(p => p.name)
      
      // Get accrual data for client's projects (case-insensitive)
      const clientRevenue = accrualTransactions
        .filter(t => projectNames.some(pn => normalizeProjectName(pn) === normalizeProjectName(t.project)) && t.type === 'revenue')
        .reduce((sum, t) => sum + t.amount, 0)
      
      const clientCosts = accrualTransactions
        .filter(t => projectNames.some(pn => normalizeProjectName(pn) === normalizeProjectName(t.project)) && t.type === 'direct_cost')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0)
      
      const grossProfit = clientRevenue - clientCosts
      const grossMarginPct = clientRevenue > 0 ? (grossProfit / clientRevenue) * 100 : 0
      
      // Budget tracking
      const totalBudget = clientProjects.reduce((sum, p) => sum + (p.budget || 0), 0)
      const totalSpent = clientCosts
      
      return {
        ...client,
        projectCount: clientProjects.length,
        projects: clientProjects,
        revenue: clientRevenue,
        costs: clientCosts,
        grossProfit,
        grossMarginPct,
        totalBudget,
        totalSpent,
        budgetRemaining: totalBudget - totalSpent,
        budgetUsedPct: totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0
      }
    }).sort((a, b) => b.revenue - a.revenue)
  }, [clients, projects, accrualTransactions])

  // Assumptions
  const addAssumption = useCallback(() => {
    if (newAssumption.name && newAssumption.amount !== undefined && newAssumption.startDate) {
      const assumption: Assumption = {
        id: generateId(),
        name: newAssumption.name,
        category: newAssumption.category || 'revenue',
        amount: newAssumption.amount,
        valueType: newAssumption.valueType || 'amount',
        percentOf: newAssumption.valueType === 'percentage' ? (newAssumption.percentOf || 'baseline') : undefined,
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
        valueType: 'amount',
        percentOf: 'baseline',
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
    // Filter out invalid transactions first
    let result = transactions.filter(t => 
      t && 
      typeof t.date === 'string' && 
      t.date.length >= 7 &&
      typeof t.amount === 'number' &&
      !isNaN(t.amount)
    )
    
    if (selectedProject !== 'all') {
      result = result.filter(t => normalizeProjectName(t.project) === normalizeProjectName(selectedProject))
    }
    if (transactionMonthFilter !== 'all') {
      result = result.filter(t => t.date.slice(0, 7) === transactionMonthFilter)
    }
    if (transactionCategoryFilter !== 'all') {
      result = result.filter(t => t.category === transactionCategoryFilter)
    }
    return result
  }, [transactions, selectedProject, transactionMonthFilter, transactionCategoryFilter])

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
      
      const monthTransactions = filteredTransactions.filter(t => {
        try {
          return t.date && t.date.slice(0, 7) === monthStr
        } catch (e) {
          return false
        }
      })
      
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
        if (selectedProject !== 'all' && normalizeProjectName(a.project) !== normalizeProjectName(selectedProject)) return
        
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
      { name: 'OpEx', value: totals.opex, color: getCategoryColor('opex'), percent: total ? (totals.opex / total * 100).toFixed(1) : '0' },
      { name: 'Overhead', value: totals.overhead, color: getCategoryColor('overhead'), percent: total ? (totals.overhead / total * 100).toFixed(1) : '0' },
      { name: 'Investment', value: totals.investment, color: getCategoryColor('investment'), percent: total ? (totals.investment / total * 100).toFixed(1) : '0' }
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
      try {
        if (!t.date) return
        const date = new Date(t.date)
        if (isNaN(date.getTime())) return
        
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay()) // Start of week (Sunday)
        const weekKey = weekStart.toISOString().slice(0, 10)
        
        if (!weeks[weekKey]) {
          weeks[weekKey] = { revenue: 0, opex: 0, overhead: 0, investment: 0, netCash: 0 }
        }
        
        const amount = typeof t.amount === 'number' ? t.amount : 0
        if (t.category === 'revenue') weeks[weekKey].revenue += amount
        else if (t.category === 'opex') weeks[weekKey].opex += Math.abs(amount)
        else if (t.category === 'overhead') weeks[weekKey].overhead += Math.abs(amount)
        else if (t.category === 'investment') weeks[weekKey].investment += Math.abs(amount)
      } catch (e) {
        // Skip invalid transactions
      }
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
    
    const recentTransactions = transactions.filter(t => {
      try {
        if (!t.date || t.type !== 'actual') return false
        const txDate = new Date(t.date)
        return !isNaN(txDate.getTime()) && txDate >= threeMonthsAgo
      } catch (e) {
        return false
      }
    })
    
    let totalRevenue = 0
    let totalExpenses = 0
    
    recentTransactions.forEach(t => {
      const amount = typeof t.amount === 'number' && !isNaN(t.amount) ? t.amount : 0
      if (t.category === 'revenue') totalRevenue += amount
      else totalExpenses += Math.abs(amount)
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

  // Accrual monthly data
  const accrualMonthlyData = useMemo(() => {
    const months: { [key: string]: { revenue: number; directCosts: number; grossProfit: number; grossMarginPct: number } } = {}
    
    // Filter by date range AND selected project
    const filtered = accrualTransactions.filter(t => {
      const monthKey = t.date.slice(0, 7)
      const inDateRange = monthKey >= activeDateRange.start && monthKey <= activeDateRange.end
      const matchesProject = selectedProject === 'all' || normalizeProjectName(t.project) === normalizeProjectName(selectedProject)
      return inDateRange && matchesProject
    })
    
    filtered.forEach(t => {
      const monthKey = t.date.slice(0, 7)
      if (!months[monthKey]) {
        months[monthKey] = { revenue: 0, directCosts: 0, grossProfit: 0, grossMarginPct: 0 }
      }
      if (t.type === 'revenue') {
        months[monthKey].revenue += t.amount
      } else if (t.type === 'direct_cost') {
        months[monthKey].directCosts += Math.abs(t.amount)
      }
    })
    
    // Calculate gross profit and margin
    Object.keys(months).forEach(key => {
      const m = months[key]
      m.grossProfit = m.revenue - m.directCosts
      m.grossMarginPct = m.revenue > 0 ? (m.grossProfit / m.revenue) * 100 : 0
    })
    
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }))
  }, [accrualTransactions, activeDateRange, selectedProject])

  // Accrual project analysis with OH allocation
  const accrualProjectAnalysis = useMemo(() => {
    // Filter accrual transactions by date range AND selected project
    const filteredAccrual = accrualTransactions.filter(t => {
      const monthKey = t.date.slice(0, 7)
      const inDateRange = monthKey >= activeDateRange.start && monthKey <= activeDateRange.end
      const matchesProject = selectedProject === 'all' || normalizeProjectName(t.project) === normalizeProjectName(selectedProject)
      return inDateRange && matchesProject
    })
    
    // Get total overhead from cash transactions for the same period
    // Read from "Mano OH" project regardless of category (case-insensitive)
    const totalOverhead = transactions
      .filter(t => {
        if (normalizeProjectName(t.project) !== normalizeProjectName('Mano OH') || t.type !== 'actual') return false
        const monthKey = t.date.slice(0, 7)
        return monthKey >= activeDateRange.start && monthKey <= activeDateRange.end
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)
    
    // Calculate revenue and direct costs by project (case-insensitive grouping)
    const projectData: { [key: string]: { revenue: number; directCosts: number; displayName: string } } = {}
    
    filteredAccrual.forEach(t => {
      const normalizedKey = normalizeProjectName(t.project)
      if (!projectData[normalizedKey]) {
        projectData[normalizedKey] = { revenue: 0, directCosts: 0, displayName: t.project }
      }
      if (t.type === 'revenue') {
        projectData[normalizedKey].revenue += t.amount
      } else if (t.type === 'direct_cost') {
        projectData[normalizedKey].directCosts += Math.abs(t.amount)
      }
    })
    
    // Calculate total revenue for percentage allocation
    const totalRevenue = Object.values(projectData).reduce((sum, p) => sum + p.revenue, 0)
    
    // Build project analysis with OH allocation
    const analysis = Object.entries(projectData).map(([normalizedKey, data]) => {
      const grossProfit = data.revenue - data.directCosts
      const grossMarginPct = data.revenue > 0 ? (grossProfit / data.revenue) * 100 : 0
      const revenueSharePct = totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0
      const ohAllocation = totalOverhead * (revenueSharePct / 100)
      const netMargin = grossProfit - ohAllocation
      const netMarginPct = data.revenue > 0 ? (netMargin / data.revenue) * 100 : 0
      
      return {
        project: data.displayName,
        revenue: data.revenue,
        directCosts: data.directCosts,
        grossProfit,
        grossMarginPct,
        revenueSharePct,
        ohAllocation,
        netMargin,
        netMarginPct
      }
    }).sort((a, b) => b.revenue - a.revenue)
    
    // Calculate totals
    const totals = analysis.reduce((acc, p) => ({
      revenue: acc.revenue + p.revenue,
      directCosts: acc.directCosts + p.directCosts,
      grossProfit: acc.grossProfit + p.grossProfit,
      ohAllocation: acc.ohAllocation + p.ohAllocation,
      netMargin: acc.netMargin + p.netMargin
    }), { revenue: 0, directCosts: 0, grossProfit: 0, ohAllocation: 0, netMargin: 0 })
    
    return { projects: analysis, totals, totalOverhead }
  }, [accrualTransactions, transactions, activeDateRange, selectedProject])

  // Comparison data: Invoiced vs Collected by month
  const cashVsAccrualData = useMemo(() => {
    const months = new Set<string>()
    
    // Get all months from both datasets
    accrualTransactions.forEach(t => months.add(t.date.slice(0, 7)))
    transactions.filter(t => t.category === 'revenue').forEach(t => months.add(t.date.slice(0, 7)))
    
    const sortedMonths = Array.from(months).sort()
    
    return sortedMonths.map(month => {
      // Invoiced (accrual revenue)
      const invoiced = accrualTransactions
        .filter(t => t.date.slice(0, 7) === month && t.type === 'revenue')
        .reduce((sum, t) => sum + t.amount, 0)
      
      // Collected (cash revenue)
      const collected = transactions
        .filter(t => t.date.slice(0, 7) === month && t.category === 'revenue' && t.type === 'actual')
        .reduce((sum, t) => sum + t.amount, 0)
      
      const delta = collected - invoiced
      
      return { month, invoiced, collected, delta }
    })
  }, [accrualTransactions, transactions])

  // Accrual Period Comparison (MoM/QoQ/YoY)
  const accrualPeriodComparison = useMemo(() => {
    if (accrualMonthlyData.length < 1) return { mom: [], qoq: [], yoy: [] }
    
    // MoM comparison - include first month with N/A comparison
    const mom = accrualMonthlyData.map((curr, idx) => {
      const prev = idx > 0 ? accrualMonthlyData[idx - 1] : null
      const revenueChange = prev && prev.revenue > 0 ? ((curr.revenue - prev.revenue) / prev.revenue) * 100 : null
      const gmChange = prev ? curr.grossMarginPct - prev.grossMarginPct : null
      return {
        period: curr.month,
        currentRevenue: curr.revenue,
        prevRevenue: prev?.revenue || 0,
        revenueChange,
        currentGM: curr.grossMarginPct,
        prevGM: prev?.grossMarginPct || 0,
        gmChange,
        currentGrossProfit: curr.grossProfit,
        prevGrossProfit: prev?.grossProfit || 0
      }
    })
    
    // QoQ comparison - include first quarter
    const quarterData: { [key: string]: { revenue: number; directCosts: number; grossProfit: number; grossMarginPct: number } } = {}
    accrualMonthlyData.forEach(m => {
      const year = m.month.slice(0, 4)
      const monthNum = parseInt(m.month.slice(5, 7))
      const quarter = Math.ceil(monthNum / 3)
      const quarterKey = `${year}-Q${quarter}`
      
      if (!quarterData[quarterKey]) {
        quarterData[quarterKey] = { revenue: 0, directCosts: 0, grossProfit: 0, grossMarginPct: 0 }
      }
      quarterData[quarterKey].revenue += m.revenue
      quarterData[quarterKey].directCosts += m.directCosts
      quarterData[quarterKey].grossProfit += m.grossProfit
    })
    
    // Calculate GM% for quarters
    Object.values(quarterData).forEach(q => {
      q.grossMarginPct = q.revenue > 0 ? (q.grossProfit / q.revenue) * 100 : 0
    })
    
    const sortedQuarters = Object.entries(quarterData).sort(([a], [b]) => a.localeCompare(b))
    const qoq = sortedQuarters.map(([quarter, curr], idx) => {
      const prev = idx > 0 ? sortedQuarters[idx - 1][1] : null
      const revenueChange = prev && prev.revenue > 0 ? ((curr.revenue - prev.revenue) / prev.revenue) * 100 : null
      const gmChange = prev ? curr.grossMarginPct - prev.grossMarginPct : null
      return {
        period: quarter,
        currentRevenue: curr.revenue,
        prevRevenue: prev?.revenue || 0,
        revenueChange,
        currentGM: curr.grossMarginPct,
        prevGM: prev?.grossMarginPct || 0,
        gmChange,
        currentGrossProfit: curr.grossProfit,
        prevGrossProfit: prev?.grossProfit || 0
      }
    })
    
    // YoY comparison
    const yearData: { [key: string]: { revenue: number; directCosts: number; grossProfit: number; grossMarginPct: number } } = {}
    accrualMonthlyData.forEach(m => {
      const year = m.month.slice(0, 4)
      if (!yearData[year]) {
        yearData[year] = { revenue: 0, directCosts: 0, grossProfit: 0, grossMarginPct: 0 }
      }
      yearData[year].revenue += m.revenue
      yearData[year].directCosts += m.directCosts
      yearData[year].grossProfit += m.grossProfit
    })
    
    Object.values(yearData).forEach(y => {
      y.grossMarginPct = y.revenue > 0 ? (y.grossProfit / y.revenue) * 100 : 0
    })
    
    const sortedYears = Object.entries(yearData).sort(([a], [b]) => a.localeCompare(b))
    const yoy = sortedYears.slice(1).map(([year, curr], idx) => {
      const [, prev] = sortedYears[idx]
      const revenueChange = prev.revenue > 0 ? ((curr.revenue - prev.revenue) / prev.revenue) * 100 : 0
      const gmChange = curr.grossMarginPct - prev.grossMarginPct
      return {
        period: year,
        currentRevenue: curr.revenue,
        prevRevenue: prev.revenue,
        revenueChange,
        currentGM: curr.grossMarginPct,
        prevGM: prev.grossMarginPct,
        gmChange,
        currentGrossProfit: curr.grossProfit,
        prevGrossProfit: prev.grossProfit
      }
    })
    
    return { mom, qoq, yoy }
  }, [accrualMonthlyData])

  // Project Budget Tracking
  const projectBudgetTracking = useMemo(() => {
    return projects.map(project => {
      // Get all costs for this project from accrual transactions (case-insensitive)
      const projectCosts = accrualTransactions
        .filter(t => normalizeProjectName(t.project) === normalizeProjectName(project.name) && t.type === 'direct_cost')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0)
      
      // Get revenue for this project
      const projectRevenue = accrualTransactions
        .filter(t => normalizeProjectName(t.project) === normalizeProjectName(project.name) && t.type === 'revenue')
        .reduce((sum, t) => sum + t.amount, 0)
      
      const budget = project.budget || 0
      const spent = projectCosts
      const remaining = budget - spent
      const percentUsed = budget > 0 ? (spent / budget) * 100 : 0
      const isOverBudget = budget > 0 && spent > budget
      const isNearBudget = budget > 0 && percentUsed >= (project.budgetAlertThreshold || 80) && !isOverBudget
      
      // Gross margin for this project
      const grossProfit = projectRevenue - projectCosts
      const grossMarginPct = projectRevenue > 0 ? (grossProfit / projectRevenue) * 100 : 0
      
      return {
        ...project,
        revenue: projectRevenue,
        spent,
        budget,
        remaining,
        percentUsed,
        isOverBudget,
        isNearBudget,
        grossProfit,
        grossMarginPct
      }
    }).filter(p => p.budget > 0 || p.spent > 0) // Only show projects with budget or activity
      .sort((a, b) => b.percentUsed - a.percentUsed) // Sort by most used first
  }, [projects, accrualTransactions])

  // Projection data based on baseline averages + assumptions
  const projectionData = useMemo(() => {
    const now = new Date()
    const currentMonth = now.toISOString().slice(0, 7)
    
    // Calculate baseline period start
    let baselineStart: Date
    switch (baselinePeriod) {
      case 'L3M':
        baselineStart = new Date(now.getFullYear(), now.getMonth() - 3, 1)
        break
      case 'L6M':
        baselineStart = new Date(now.getFullYear(), now.getMonth() - 6, 1)
        break
      case 'L12M':
        baselineStart = new Date(now.getFullYear(), now.getMonth() - 12, 1)
        break
      case 'all':
      default:
        baselineStart = new Date(2020, 0, 1)
        break
    }
    const baselineStartStr = baselineStart.toISOString().slice(0, 7)
    
    // Get baseline transactions
    const baselineTransactions = transactions.filter(t => 
      t.type === 'actual' && 
      t.date.slice(0, 7) >= baselineStartStr && 
      t.date.slice(0, 7) <= currentMonth
    )
    
    // Calculate monthly averages by category
    const monthsInBaseline = new Set(baselineTransactions.map(t => t.date.slice(0, 7)))
    const numMonths = Math.max(1, monthsInBaseline.size)
    
    const totals = { revenue: 0, opex: 0, overhead: 0, investment: 0 }
    baselineTransactions.forEach(t => {
      const amount = typeof t.amount === 'number' ? t.amount : 0
      if (t.category === 'revenue') totals.revenue += amount
      else if (t.category === 'opex') totals.opex += Math.abs(amount)
      else if (t.category === 'overhead') totals.overhead += Math.abs(amount)
      else if (t.category === 'investment') totals.investment += Math.abs(amount)
    })
    
    const baselineAvg = {
      revenue: totals.revenue / numMonths,
      opex: totals.opex / numMonths,
      overhead: totals.overhead / numMonths,
      investment: totals.investment / numMonths
    }
    
    // Determine projection months based on period
    const periodMonths = {
      '3M': 3, '6M': 6, '12M': 12, '18M': 18, '24M': 24
    }[projectionPeriod]
    
    // Generate projection months
    const projectionMonths: {
      month: string
      monthLabel: string
      revenue: number
      opex: number
      overhead: number
      investment: number
      netCash: number
      balance: number
    }[] = []
    
    // Get current balance from actual data
    let runningBalance = beginningBalance
    transactions
      .filter(t => t.type === 'actual' && t.date.slice(0, 7) <= currentMonth)
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach(t => {
        runningBalance += t.amount
      })
    
    // Previous month values for compounding calculations
    let prevValues = { ...baselineAvg }
    
    for (let i = 1; i <= periodMonths; i++) {
      const projDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const monthKey = projDate.toISOString().slice(0, 7)
      const monthLabel = projDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      
      // Start with baseline averages
      let monthRevenue = baselineAvg.revenue
      let monthOpex = baselineAvg.opex
      let monthOverhead = baselineAvg.overhead
      let monthInvestment = baselineAvg.investment
      
      // Apply assumptions for this month
      activeAssumptions.forEach(a => {
        // Check if assumption applies to this month
        if (a.startDate > monthKey) return
        if (a.endDate && a.endDate < monthKey) return
        
        // Check frequency
        const monthsDiff = (projDate.getFullYear() - new Date(a.startDate + '-01').getFullYear()) * 12 + 
                          (projDate.getMonth() - new Date(a.startDate + '-01').getMonth())
        
        let applies = false
        if (a.frequency === 'monthly') applies = true
        else if (a.frequency === 'quarterly' && monthsDiff % 3 === 0) applies = true
        else if (a.frequency === 'annually' && monthsDiff % 12 === 0) applies = true
        else if (a.frequency === 'one-time' && monthKey === a.startDate) applies = true
        
        if (!applies) return
        
        // Calculate the actual value
        let value = a.amount
        if (a.valueType === 'percentage' && a.percentOf) {
          const pct = a.amount / 100
          switch (a.percentOf) {
            case 'baseline':
              if (a.category === 'revenue') value = baselineAvg.revenue * pct
              else if (a.category === 'opex') value = baselineAvg.opex * pct
              else if (a.category === 'overhead') value = baselineAvg.overhead * pct
              else if (a.category === 'investment') value = baselineAvg.investment * pct
              break
            case 'previous':
              if (a.category === 'revenue') value = prevValues.revenue * pct
              else if (a.category === 'opex') value = prevValues.opex * pct
              else if (a.category === 'overhead') value = prevValues.overhead * pct
              else if (a.category === 'investment') value = prevValues.investment * pct
              break
            case 'revenue':
              value = monthRevenue * pct
              break
            case 'opex':
              value = monthOpex * pct
              break
            case 'overhead':
              value = monthOverhead * pct
              break
            case 'investment':
              value = monthInvestment * pct
              break
          }
        }
        
        // Apply value to appropriate category
        if (a.category === 'revenue') monthRevenue += value
        else if (a.category === 'opex') monthOpex += value
        else if (a.category === 'overhead') monthOverhead += value
        else if (a.category === 'investment') monthInvestment += value
      })
      
      const netCash = monthRevenue - monthOpex - monthOverhead - monthInvestment
      runningBalance += netCash
      
      projectionMonths.push({
        month: monthKey,
        monthLabel,
        revenue: monthRevenue,
        opex: monthOpex,
        overhead: monthOverhead,
        investment: monthInvestment,
        netCash,
        balance: runningBalance
      })
      
      // Update previous values for next iteration
      prevValues = {
        revenue: monthRevenue,
        opex: monthOpex,
        overhead: monthOverhead,
        investment: monthInvestment
      }
    }
    
    // Calculate summary KPIs
    const avgMonthlyNet = projectionMonths.length > 0 
      ? projectionMonths.reduce((sum, m) => sum + m.netCash, 0) / projectionMonths.length 
      : 0
    const endBalance = projectionMonths.length > 0 
      ? projectionMonths[projectionMonths.length - 1].balance 
      : runningBalance
    const projectedRunway = avgMonthlyNet < 0 
      ? Math.abs(runningBalance / avgMonthlyNet) 
      : Infinity
    
    return {
      months: projectionMonths,
      baselineAvg,
      currentBalance: runningBalance - (projectionMonths[0]?.netCash || 0),
      endBalance,
      avgMonthlyNet,
      projectedRunway,
      numBaselineMonths: numMonths
    }
  }, [transactions, activeAssumptions, baselinePeriod, projectionPeriod, beginningBalance])

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
    
    // Unassigned transactions warning
    const unassignedCount = transactions.filter(t => t.category === 'unassigned').length
    if (unassignedCount > 0) {
      result.unshift({
        type: 'warning',
        title: 'Uncategorized',
        message: `${unassignedCount} transaction${unassignedCount > 1 ? 's' : ''} need${unassignedCount === 1 ? 's' : ''} categorization`
      })
    }
    
    return result.slice(0, 3) // Max 3 insights
  }, [chartData, runwayData, transactions])

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
    { id: 'transactions', label: 'Transactions', icon: List },
    { id: 'projections', label: 'Projections', icon: TrendingUp },
    { id: 'data', label: 'Data', icon: Database },
    { id: 'assumptions', label: 'Assumptions', icon: Settings },
    { id: 'settings', label: 'Settings', icon: Palette }
  ]

  // Sidebar navigation structure with sections
  const sidebarSections = [
    {
      id: 'main',
      label: 'Main',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: PieChartIcon }
      ]
    },
    {
      id: 'clients-section',
      label: 'Clients & Projects',
      items: [
        { id: 'clients', label: 'Clients', icon: Users },
      ]
    },
    {
      id: 'data-section',
      label: 'Data',
      items: [
        { id: 'transactions', label: 'Transactions', icon: List },
        { id: 'data', label: 'Import/Export', icon: Database }
      ]
    },
    {
      id: 'forecast',
      label: 'Forecast',
      items: [
        { id: 'projections', label: 'Projections', icon: TrendingUp },
        { id: 'assumptions', label: 'Assumptions', icon: Target }
      ]
    },
    {
      id: 'config',
      label: 'Configuration',
      items: [
        { id: 'settings', label: 'Settings', icon: Palette }
      ]
    }
  ]

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['main', 'clients-section', 'data-section', 'forecast', 'config']))

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

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

  // Auth loading screen
  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-teal-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-4">
            <VantageLogo size={40} />
          </div>
          <div className="text-teal-400 animate-pulse">
            {authLoading ? 'Authenticating...' : 'Loading data...'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen font-body transition-colors ${themeClasses}`} style={{ colorScheme: theme }}>
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarMobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`
          fixed lg:sticky top-0 left-0 z-50 h-screen
          ${sidebarOpen ? 'w-64' : 'w-20'} 
          ${sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          transition-all duration-300 ease-in-out
          ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-terminal-surface border-terminal-border'}
          border-r flex flex-col
        `}>
          {/* Sidebar Header */}
          <div className={`p-4 border-b ${theme === 'light' ? 'border-gray-200' : 'border-terminal-border'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {branding.companyLogo ? (
                  <img 
                    src={branding.companyLogo} 
                    alt={branding.companyName} 
                    className="w-9 h-9 rounded-lg object-contain"
                  />
                ) : (
                  <VantageLogo size={36} />
                )}
                {sidebarOpen && (
                  <div>
                    <h1 className="text-base font-display font-bold tracking-tight">{branding.companyName}</h1>
                    <p className={`text-xs ${textMuted}`}>Stop guessing. Start knowing.</p>
                  </div>
                )}
              </div>
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className={`hidden lg:flex p-1.5 rounded-lg transition-all ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-terminal-bg'}`}
              >
                {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setSidebarMobileOpen(false)}
                className={`lg:hidden p-1.5 rounded-lg transition-all ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-terminal-bg'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sidebar Navigation */}
          <nav className="flex-1 overflow-y-auto p-3">
            {sidebarSections.map(section => (
              <div key={section.id} className="mb-4">
                {sidebarOpen && (
                  <button
                    onClick={() => toggleSection(section.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider ${textMuted} hover:text-zinc-300`}
                  >
                    <span>{section.label}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${expandedSections.has(section.id) ? '' : '-rotate-90'}`} />
                  </button>
                )}
                <AnimatePresence initial={false}>
                  {(expandedSections.has(section.id) || !sidebarOpen) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      {section.items.map(item => (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id as typeof activeTab)
                            setSidebarMobileOpen(false)
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-1 ${
                            activeTab === item.id 
                              ? 'bg-accent-primary/15 text-accent-primary' 
                              : theme === 'light' 
                                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100' 
                                : 'text-zinc-400 hover:text-zinc-100 hover:bg-terminal-bg'
                          }`}
                          title={!sidebarOpen ? item.label : undefined}
                        >
                          <item.icon className={`${sidebarOpen ? 'w-4 h-4' : 'w-5 h-5 mx-auto'}`} />
                          {sidebarOpen && <span>{item.label}</span>}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </nav>

          {/* Sidebar Footer */}
          <div className={`p-3 border-t ${theme === 'light' ? 'border-gray-200' : 'border-terminal-border'}`}>
            {user && (
              <div className={`flex items-center ${sidebarOpen ? 'gap-3' : 'justify-center'}`}>
                <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-teal-400" />
                </div>
                {sidebarOpen && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.email?.split('@')[0]}</p>
                    <p className={`text-xs ${textMuted} truncate`}>{user.email}</p>
                  </div>
                )}
                {sidebarOpen && (
                  <button
                    onClick={handleSignOut}
                    className={`p-1.5 rounded-lg transition-all ${theme === 'light' ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-terminal-bg text-zinc-400'}`}
                    title="Sign out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${sidebarOpen ? 'lg:ml-0' : 'lg:ml-0'}`}>
          {/* Top Header Bar */}
          <header className={`sticky top-0 z-30 border-b backdrop-blur-sm ${theme === 'light' ? 'bg-white/90 border-gray-200' : 'bg-terminal-bg/90 border-terminal-border'}`}>
            <div className="px-4 sm:px-6 py-3">
              <div className="flex items-center justify-between">
                {/* Mobile menu button */}
                <button
                  onClick={() => setSidebarMobileOpen(true)}
                  className={`lg:hidden p-2 rounded-lg ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-terminal-surface'}`}
                >
                  <Menu className="w-5 h-5" />
                </button>

                {/* Page Title - shows current tab */}
                <div className="hidden lg:flex items-center gap-2">
                  <h2 className="text-lg font-semibold">
                    {tabs.find(t => t.id === activeTab)?.label || 'Dashboard'}
                  </h2>
                </div>

                {/* Mobile Logo */}
                <div className="lg:hidden flex items-center gap-2">
                  <VantageLogo size={32} />
                  <span className="font-semibold">{branding.companyName}</span>
                </div>

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
              {/* Cash vs Accrual Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setQuickAddForm(prev => ({ ...prev, targetType: 'cash' }))}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  (quickAddForm as any).targetType !== 'accrual'
                    ? 'bg-accent-primary text-white'
                    : theme === 'light' ? 'bg-gray-100 text-gray-600' : 'bg-terminal-bg text-zinc-400'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                Cash Flow
              </button>
              <button
                onClick={() => setQuickAddForm(prev => ({ ...prev, targetType: 'accrual' }))}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  (quickAddForm as any).targetType === 'accrual'
                    ? 'bg-indigo-500 text-white'
                    : theme === 'light' ? 'bg-gray-100 text-gray-600' : 'bg-terminal-bg text-zinc-400'
                }`}
              >
                <FileText className="w-4 h-4" />
                Accrual
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
                    onChange={(e) => setQuickAddForm(prev => ({ ...prev, category: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                    style={{ colorScheme: theme }}
                  >
                    {categories.filter(c => c.id !== 'unassigned').map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
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

      {/* Edit Transaction Modal */}
      <AnimatePresence>
        {editingId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={cancelEdit}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-xl p-6 shadow-xl ${
                theme === 'light' ? 'bg-white' : 'bg-terminal-surface border border-terminal-border'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Edit Transaction</h3>
                <button onClick={cancelEdit} className={`p-1 rounded ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-zinc-700'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-sm mb-1 ${textMuted}`}>Date</label>
                    <input
                      type="date"
                      value={editForm.date || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                      style={{ colorScheme: theme }}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm mb-1 ${textMuted}`}>Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.amount || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                      className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                      style={{ colorScheme: theme }}
                    />
                  </div>
                </div>
                
                <div>
                  <label className={`block text-sm mb-1 ${textMuted}`}>Description</label>
                  <input
                    type="text"
                    value={editForm.description || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                    style={{ colorScheme: theme }}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-sm mb-1 ${textMuted}`}>Category</label>
                    <select
                      value={editForm.category || 'unassigned'}
                      onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                      style={{ colorScheme: theme }}
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm mb-1 ${textMuted}`}>Type</label>
                    <select
                      value={editForm.type || 'actual'}
                      onChange={(e) => setEditForm(prev => ({ ...prev, type: e.target.value as 'actual' | 'budget' }))}
                      className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                      style={{ colorScheme: theme }}
                    >
                      <option value="actual">Actual</option>
                      <option value="budget">Budget</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className={`block text-sm mb-1 ${textMuted}`}>Project</label>
                  <select
                    value={editForm.project || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, project: e.target.value || undefined }))}
                    className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                    style={{ colorScheme: theme }}
                  >
                    <option value="">None (Overhead)</option>
                    {projectList.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className={`block text-sm mb-1 ${textMuted}`}>Notes (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g., Annual renewal"
                    value={editForm.notes || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                    style={{ colorScheme: theme }}
                  />
                </div>
                
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={saveEdit}
                    className="flex-1 py-2 bg-accent-primary text-white rounded-lg font-medium hover:bg-accent-primary/90"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={cancelEdit}
                    className={`px-4 py-2 border rounded-lg ${
                      theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-terminal-border hover:bg-terminal-bg'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Accrual Transaction Modal */}
      <AnimatePresence>
        {showAccrualModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={closeAccrualModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-md rounded-xl p-6 border ${cardClasses}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-500" />
                  {accrualModalMode === 'add' ? 'Add Accrual Transaction' : 'Edit Accrual Transaction'}
                </h3>
                <button onClick={closeAccrualModal} className={`p-1 rounded ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-zinc-700'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-sm mb-1 ${textMuted}`}>Date</label>
                    <input
                      type="date"
                      value={accrualModalForm.date || ''}
                      onChange={(e) => setAccrualModalForm(prev => ({ ...prev, date: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                      style={{ colorScheme: theme }}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm mb-1 ${textMuted}`}>Type</label>
                    <select
                      value={accrualModalForm.type || 'revenue'}
                      onChange={(e) => setAccrualModalForm(prev => ({ ...prev, type: e.target.value as 'revenue' | 'direct_cost' }))}
                      className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                      style={{ colorScheme: theme }}
                    >
                      <option value="revenue">Revenue (Invoice to Client)</option>
                      <option value="direct_cost">Direct Cost (Contractor)</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <label className={`block text-sm mb-1 ${textMuted}`}>Description</label>
                  <input
                    type="text"
                    placeholder="e.g., Oct services invoice"
                    value={accrualModalForm.description || ''}
                    onChange={(e) => setAccrualModalForm(prev => ({ ...prev, description: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                    style={{ colorScheme: theme }}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-sm mb-1 ${textMuted}`}>Amount</label>
                    <input
                      type="number"
                      placeholder="50000"
                      value={accrualModalForm.amount || ''}
                      onChange={(e) => setAccrualModalForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                      className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                      style={{ colorScheme: theme }}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm mb-1 ${textMuted}`}>Project *</label>
                    <input
                      type="text"
                      placeholder="Project name"
                      value={accrualModalForm.project || ''}
                      onChange={(e) => setAccrualModalForm(prev => ({ ...prev, project: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                      style={{ colorScheme: theme }}
                      list="accrual-projects"
                    />
                    <datalist id="accrual-projects">
                      {accrualProjects.map(p => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-sm mb-1 ${textMuted}`}>Vendor/Client</label>
                    <input
                      type="text"
                      placeholder="Client or contractor name"
                      value={accrualModalForm.vendor || ''}
                      onChange={(e) => setAccrualModalForm(prev => ({ ...prev, vendor: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                      style={{ colorScheme: theme }}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm mb-1 ${textMuted}`}>Invoice #</label>
                    <input
                      type="text"
                      placeholder="INV-001"
                      value={accrualModalForm.invoiceNumber || ''}
                      onChange={(e) => setAccrualModalForm(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                      className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                      style={{ colorScheme: theme }}
                    />
                  </div>
                </div>
                
                <div>
                  <label className={`block text-sm mb-1 ${textMuted}`}>Notes (optional)</label>
                  <input
                    type="text"
                    placeholder="Additional notes"
                    value={accrualModalForm.notes || ''}
                    onChange={(e) => setAccrualModalForm(prev => ({ ...prev, notes: e.target.value }))}
                    className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                    style={{ colorScheme: theme }}
                  />
                </div>
                
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={saveAccrualModal}
                    disabled={!accrualModalForm.description || !accrualModalForm.project}
                    className="flex-1 py-2 bg-indigo-500 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-indigo-600"
                  >
                    {accrualModalMode === 'add' ? 'Add Transaction' : 'Save Changes'}
                  </button>
                  <button
                    onClick={closeAccrualModal}
                    className={`px-4 py-2 border rounded-lg ${
                      theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-terminal-border hover:bg-terminal-bg'
                    }`}
                  >
                    Cancel
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
            onClick={() => { setShowProjectModal(false); setEditingProject(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-lg rounded-xl p-6 border ${cardClasses}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{editingProject ? 'Edit Project' : 'Manage Projects'}</h3>
                <button onClick={() => { setShowProjectModal(false); setEditingProject(null); }} className={`p-1 rounded ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-zinc-700'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Add/Edit Project Form */}
                {editingProject ? (
                  <div className={`p-4 rounded-lg border ${theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-terminal-bg border-terminal-border'}`}>
                    <div className="space-y-3">
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Project Name</label>
                        <input
                          type="text"
                          value={editingProject.name}
                          onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                          className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                          style={{ colorScheme: theme }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Budget ($)</label>
                          <input
                            type="number"
                            value={editingProject.budget || ''}
                            onChange={(e) => setEditingProject({ ...editingProject, budget: e.target.value ? Number(e.target.value) : undefined })}
                            placeholder="No budget"
                            className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                            style={{ colorScheme: theme }}
                          />
                        </div>
                        <div>
                          <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Alert at (%)</label>
                          <input
                            type="number"
                            value={editingProject.budgetAlertThreshold || 80}
                            onChange={(e) => setEditingProject({ ...editingProject, budgetAlertThreshold: Number(e.target.value) })}
                            min={1}
                            max={100}
                            className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                            style={{ colorScheme: theme }}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Status</label>
                        <select
                          value={editingProject.status}
                          onChange={(e) => setEditingProject({ ...editingProject, status: e.target.value as Project['status'] })}
                          className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                          style={{ colorScheme: theme }}
                        >
                          <option value="active">Active</option>
                          <option value="completed">Completed</option>
                          <option value="on-hold">On Hold</option>
                        </select>
                      </div>
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Client</label>
                        <select
                          value={editingProject.clientId || ''}
                          onChange={(e) => setEditingProject({ ...editingProject, clientId: e.target.value || undefined })}
                          className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                          style={{ colorScheme: theme }}
                        >
                          <option value="">No client assigned</option>
                          {clients.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => {
                            updateProject(editingProject.id, editingProject)
                          }}
                          className="flex-1 px-4 py-2 bg-accent-primary text-white rounded-lg font-medium hover:bg-accent-primary/90"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => setEditingProject(null)}
                          className={`px-4 py-2 rounded-lg font-medium border ${theme === 'light' ? 'border-gray-300 hover:bg-gray-100' : 'border-terminal-border hover:bg-terminal-bg'}`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`p-4 rounded-lg border ${theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-terminal-bg border-terminal-border'}`}>
                    <div className="space-y-3">
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Project Name</label>
                        <input
                          type="text"
                          placeholder="New project name"
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                          style={{ colorScheme: theme }}
                          onKeyDown={(e) => e.key === 'Enter' && addProject()}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Budget (optional)</label>
                        <input
                          type="number"
                          placeholder="e.g. 50000"
                          value={newProjectBudget}
                          onChange={(e) => setNewProjectBudget(e.target.value ? Number(e.target.value) : '')}
                          className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                          style={{ colorScheme: theme }}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Client (optional)</label>
                        <select
                          value={newProjectClientId}
                          onChange={(e) => setNewProjectClientId(e.target.value)}
                          className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                          style={{ colorScheme: theme }}
                        >
                          <option value="">No client</option>
                          {clients.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={addProject}
                        disabled={!newProjectName.trim()}
                        className="w-full px-4 py-2 bg-accent-primary text-white rounded-lg font-medium disabled:opacity-50 hover:bg-accent-primary/90"
                      >
                        Add Project
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Project List */}
                {!editingProject && (
                  <div>
                    <h4 className={`text-sm font-medium mb-2 ${textMuted}`}>Projects from Your Data ({projectList.length})</h4>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {projectList.length === 0 ? (
                        <p className={`text-sm text-center py-4 ${textMuted}`}>No projects found in transaction data</p>
                      ) : (
                        projectList.map(projectName => {
                          const existingProject = projects.find(p => normalizeProjectName(p.name) === normalizeProjectName(projectName))
                          const projectColor = existingProject?.color || PROJECT_COLORS[projectList.indexOf(projectName) % PROJECT_COLORS.length]
                          const clientName = existingProject?.clientId ? clients.find(c => c.id === existingProject.clientId)?.name : null
                          const tracking = existingProject ? projectBudgetTracking.find(t => t.id === existingProject.id) : null
                          
                          return (
                            <div key={projectName} className={`p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-terminal-bg'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: projectColor }} />
                                  <span className="font-medium">{projectName}</span>
                                  {existingProject && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      existingProject.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                      existingProject.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                                      'bg-yellow-500/20 text-yellow-400'
                                    }`}>
                                      {existingProject.status}
                                    </span>
                                  )}
                                  {clientName && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400`}>
                                      {clientName}
                                    </span>
                                  )}
                                  {existingProject?.budget && (
                                    <span className={`text-xs ${textMuted}`}>{formatCurrency(existingProject.budget)}</span>
                                  )}
                                </div>
                                <button
                                  onClick={() => {
                                    if (existingProject) {
                                      setEditingProject(existingProject)
                                    } else {
                                      // Create project from transaction data for editing
                                      const newProject: Project = {
                                        id: generateId(),
                                        name: projectName,
                                        color: projectColor,
                                        status: 'active',
                                        createdAt: new Date().toISOString()
                                      }
                                      setProjects(prev => [...prev, newProject])
                                      setEditingProject(newProject)
                                    }
                                  }}
                                  className={`p-1.5 hover:text-accent-primary ${textMuted}`}
                                  title={existingProject ? "Edit project" : "Configure project"}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              </div>
                              {tracking && existingProject?.budget && existingProject.budget > 0 && (
                                <div className="mt-2">
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className={textMuted}>Budget: {formatCurrency(existingProject.budget)}</span>
                                    <span className={tracking.isOverBudget ? 'text-accent-danger' : tracking.isNearBudget ? 'text-yellow-400' : textMuted}>
                                      {tracking.percentUsed.toFixed(0)}% used
                                    </span>
                                  </div>
                                  <div className={`h-2 rounded-full ${theme === 'light' ? 'bg-gray-200' : 'bg-terminal-border'}`}>
                                    <div 
                                      className={`h-full rounded-full transition-all ${
                                        tracking.isOverBudget ? 'bg-accent-danger' : 
                                        tracking.isNearBudget ? 'bg-yellow-400' : 
                                        'bg-accent-primary'
                                      }`}
                                      style={{ width: `${Math.min(tracking.percentUsed, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                    <p className={`text-xs mt-3 ${textMuted}`}>
                      <Info className="w-3 h-3 inline mr-1" />
                      Click edit to set budget, status, or assign to a client
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Client Modal */}
      <AnimatePresence>
        {(showClientModal || editingClient) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => { setShowClientModal(false); setEditingClient(null); setNewClientForm({ name: '', status: 'active' }); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-lg rounded-xl p-6 border ${cardClasses}`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{editingClient ? 'Edit Client' : 'Add New Client'}</h3>
                <button onClick={() => { setShowClientModal(false); setEditingClient(null); setNewClientForm({ name: '', status: 'active' }); }} className={`p-1 rounded ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-zinc-700'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                {editingClient ? (
                  /* Edit Client Form */
                  <>
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Client Name *</label>
                      <input
                        type="text"
                        value={editingClient.name}
                        onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                        className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                        style={{ colorScheme: theme }}
                        placeholder="Company or client name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Contact Name</label>
                        <input
                          type="text"
                          value={editingClient.contactName || ''}
                          onChange={(e) => setEditingClient({ ...editingClient, contactName: e.target.value })}
                          className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                          style={{ colorScheme: theme }}
                          placeholder="Primary contact"
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Status</label>
                        <select
                          value={editingClient.status}
                          onChange={(e) => setEditingClient({ ...editingClient, status: e.target.value as Client['status'] })}
                          className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                          style={{ colorScheme: theme }}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="prospect">Prospect</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Email</label>
                        <input
                          type="email"
                          value={editingClient.contactEmail || ''}
                          onChange={(e) => setEditingClient({ ...editingClient, contactEmail: e.target.value })}
                          className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                          style={{ colorScheme: theme }}
                          placeholder="contact@client.com"
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Phone</label>
                        <input
                          type="tel"
                          value={editingClient.contactPhone || ''}
                          onChange={(e) => setEditingClient({ ...editingClient, contactPhone: e.target.value })}
                          className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                          style={{ colorScheme: theme }}
                          placeholder="(555) 123-4567"
                        />
                      </div>
                    </div>
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Notes</label>
                      <textarea
                        value={editingClient.notes || ''}
                        onChange={(e) => setEditingClient({ ...editingClient, notes: e.target.value })}
                        className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                        style={{ colorScheme: theme }}
                        placeholder="Additional notes about this client..."
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => updateClientData(editingClient.id, editingClient)}
                        disabled={!editingClient.name.trim()}
                        className="flex-1 px-4 py-2 bg-accent-primary text-white rounded-lg font-medium hover:bg-accent-primary/90 disabled:opacity-50"
                      >
                        Save Changes
                      </button>
                      <button
                        onClick={() => setEditingClient(null)}
                        className={`px-4 py-2 rounded-lg font-medium border ${theme === 'light' ? 'border-gray-300 hover:bg-gray-100' : 'border-terminal-border hover:bg-terminal-bg'}`}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  /* Add New Client Form */
                  <>
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Client Name *</label>
                      <input
                        type="text"
                        value={newClientForm.name || ''}
                        onChange={(e) => setNewClientForm({ ...newClientForm, name: e.target.value })}
                        className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                        style={{ colorScheme: theme }}
                        placeholder="Company or client name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Contact Name</label>
                        <input
                          type="text"
                          value={newClientForm.contactName || ''}
                          onChange={(e) => setNewClientForm({ ...newClientForm, contactName: e.target.value })}
                          className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                          style={{ colorScheme: theme }}
                          placeholder="Primary contact"
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Status</label>
                        <select
                          value={newClientForm.status || 'active'}
                          onChange={(e) => setNewClientForm({ ...newClientForm, status: e.target.value as Client['status'] })}
                          className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                          style={{ colorScheme: theme }}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="prospect">Prospect</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Email</label>
                        <input
                          type="email"
                          value={newClientForm.contactEmail || ''}
                          onChange={(e) => setNewClientForm({ ...newClientForm, contactEmail: e.target.value })}
                          className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                          style={{ colorScheme: theme }}
                          placeholder="contact@client.com"
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Phone</label>
                        <input
                          type="tel"
                          value={newClientForm.contactPhone || ''}
                          onChange={(e) => setNewClientForm({ ...newClientForm, contactPhone: e.target.value })}
                          className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                          style={{ colorScheme: theme }}
                          placeholder="(555) 123-4567"
                        />
                      </div>
                    </div>
                    <div>
                      <label className={`block text-xs font-medium mb-1 ${textMuted}`}>Notes</label>
                      <textarea
                        value={newClientForm.notes || ''}
                        onChange={(e) => setNewClientForm({ ...newClientForm, notes: e.target.value })}
                        className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                        style={{ colorScheme: theme }}
                        placeholder="Additional notes about this client..."
                        rows={2}
                      />
                    </div>
                    <button
                      onClick={addClient}
                      disabled={!newClientForm.name?.trim()}
                      className="w-full px-4 py-2 bg-accent-primary text-white rounded-lg font-medium hover:bg-accent-primary/90 disabled:opacity-50"
                    >
                      Add Client
                    </button>
                  </>
                )}
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
                  {branding.companyName} collects and stores your financial data to provide the service. 
                  This includes transaction data, invoices, and related business information you enter.
                </p>
                
                <h4 className="font-semibold mt-4">2. Data Storage</h4>
                <p className={textMuted}>
                  Your data is securely stored in the cloud using Supabase (hosted on AWS). This means:
                </p>
                <ul className={`list-disc pl-5 ${textMuted}`}>
                  <li>Data is encrypted at rest and in transit</li>
                  <li>Data is accessible from any device after login</li>
                  <li>Data is backed up automatically</li>
                  <li>Only authenticated users from your organization can access your data</li>
                </ul>
                
                <h4 className="font-semibold mt-4">3. Data Security</h4>
                <p className={textMuted}>
                  We implement industry-standard security measures including encryption, secure authentication via Google SSO, 
                  and row-level security policies to ensure only authorized users can access your data.
                </p>
                
                <h4 className="font-semibold mt-4">4. Third-Party Services</h4>
                <p className={textMuted}>
                  This application uses Supabase for database hosting and Google for authentication. 
                  These services have their own privacy policies and security certifications.
                </p>
                
                <h4 className="font-semibold mt-4">5. Your Rights</h4>
                <p className={textMuted}>
                  You have complete control over your data. You can export, modify, or delete your data at any time 
                  through the application interface. Contact your administrator to request full data deletion.
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
                  {branding.companyName} is a Project & Cash Flow Analytics for cash flow forecasting, gross margin analysis, 
                  and financial planning. The application provides tools for tracking transactions, projections, and reporting.
                </p>
                
                <h4 className="font-semibold mt-4">3. User Responsibilities</h4>
                <p className={textMuted}>You are responsible for:</p>
                <ul className={`list-disc pl-5 ${textMuted}`}>
                  <li>The accuracy of data you enter</li>
                  <li>Maintaining security of your login credentials</li>
                  <li>Ensuring authorized access within your organization</li>
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
                
                <h4 className="font-semibold mt-4">6. Data & Security</h4>
                <p className={textMuted}>
                  Data is stored securely in the cloud with encryption. While we implement industry-standard 
                  security measures, we recommend regular data exports as an additional backup measure.
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

      {/* AI Categorization Preview Modal */}
      <AnimatePresence>
        {showAiPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowAiPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-5xl max-h-[85vh] rounded-xl border overflow-hidden flex flex-col ${cardClasses}`}
            >
              {/* Header */}
              <div className={`p-4 border-b ${theme === 'light' ? 'border-gray-200' : 'border-terminal-border'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-accent-primary" />
                    <h3 className="text-lg font-semibold">AI Categorization Preview</h3>
                    <span className={`text-sm px-2 py-0.5 rounded-full ${theme === 'light' ? 'bg-gray-100' : 'bg-terminal-bg'} ${textMuted}`}>
                      {aiSuggestions.filter(s => s.accepted).length} of {aiSuggestions.length} selected
                    </span>
                  </div>
                  <button onClick={() => setShowAiPreview(false)} className={`p-1 rounded ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-zinc-700'}`}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {aiError && (
                  <div className="mt-2 p-2 bg-accent-danger/10 text-accent-danger text-sm rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {aiError}
                  </div>
                )}
              </div>
              
              {/* Table */}
              <div className="flex-1 overflow-auto p-4">
                <table className="w-full text-sm">
                  <thead className={`sticky top-0 ${theme === 'light' ? 'bg-gray-50' : 'bg-terminal-surface'}`}>
                    <tr className={`border-b ${tableBorder} text-left ${textMuted}`}>
                      <th className="pb-3 px-2">
                        <input
                          type="checkbox"
                          checked={aiSuggestions.every(s => s.accepted)}
                          onChange={(e) => setAiSuggestions(prev => prev.map(s => ({ ...s, accepted: e.target.checked })))}
                          className="rounded"
                        />
                      </th>
                      <th className="pb-3 px-2 font-medium">Date</th>
                      <th className="pb-3 px-2 font-medium">Description</th>
                      <th className="pb-3 px-2 font-medium text-right">Amount</th>
                      <th className="pb-3 px-2 font-medium">Category/Type</th>
                      <th className="pb-3 px-2 font-medium">Project</th>
                      <th className="pb-3 px-2 font-medium text-center">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aiSuggestions.map(suggestion => (
                      <tr 
                        key={suggestion.id} 
                        className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-terminal-border/50'} ${!suggestion.accepted ? 'opacity-50' : ''}`}
                      >
                        <td className="py-3 px-2">
                          <input
                            type="checkbox"
                            checked={suggestion.accepted}
                            onChange={() => toggleSuggestionAccepted(suggestion.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="py-3 px-2 font-mono text-xs">{suggestion.date}</td>
                        <td className="py-3 px-2 max-w-xs truncate" title={suggestion.description}>
                          {suggestion.description}
                        </td>
                        <td className={`py-3 px-2 text-right font-mono ${suggestion.amount >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                          {formatCurrency(suggestion.amount)}
                        </td>
                        <td className="py-3 px-2">
                          <select
                            value={uploadType === 'accrual' ? suggestion.suggestedType : suggestion.suggestedCategory}
                            onChange={(e) => updateSuggestion(
                              suggestion.id, 
                              uploadType === 'accrual' ? 'suggestedType' : 'suggestedCategory', 
                              e.target.value
                            )}
                            className={`w-full px-2 py-1 rounded text-xs border ${inputClasses}`}
                            style={{ colorScheme: theme }}
                          >
                            {uploadType === 'accrual' ? (
                              <>
                                <option value="revenue">Revenue</option>
                                <option value="direct_cost">Direct Cost</option>
                              </>
                            ) : (
                              <>
                                {categories.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </>
                            )}
                          </select>
                        </td>
                        <td className="py-3 px-2">
                          <input
                            type="text"
                            value={suggestion.suggestedProject}
                            onChange={(e) => updateSuggestion(suggestion.id, 'suggestedProject', e.target.value)}
                            placeholder="Project name"
                            className={`w-full px-2 py-1 rounded text-xs border ${inputClasses}`}
                            style={{ colorScheme: theme }}
                            list="project-suggestions"
                          />
                        </td>
                        <td className="py-3 px-2 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                            suggestion.confidence >= 80 ? 'bg-green-500/20 text-green-400' :
                            suggestion.confidence >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {suggestion.confidence}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <datalist id="project-suggestions">
                  {projectList.map(p => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>
              
              {/* Footer */}
              <div className={`p-4 border-t ${theme === 'light' ? 'border-gray-200' : 'border-terminal-border'} flex items-center justify-between`}>
                <div className={`text-sm ${textMuted}`}>
                  <Sparkles className="w-4 h-4 inline mr-1" />
                  AI suggestions - review and adjust before importing
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowAiPreview(false)}
                    className={`px-4 py-2 rounded-lg font-medium border ${theme === 'light' ? 'border-gray-300 hover:bg-gray-100' : 'border-terminal-border hover:bg-terminal-bg'}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={applyAiSuggestions}
                    disabled={aiSuggestions.filter(s => s.accepted).length === 0}
                    className="px-4 py-2 bg-accent-primary text-white rounded-lg font-medium hover:bg-accent-primary/90 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Import {aiSuggestions.filter(s => s.accepted).length} Transactions
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

          {/* Main Content */}
          <main className="flex-1 px-4 sm:px-6 py-4 sm:py-6 overflow-auto">
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
                {/* View Mode Dropdown */}
                <select
                  value={dashboardView}
                  onChange={(e) => setDashboardView(e.target.value as DashboardView)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium border ${
                    dashboardView === 'cash' 
                      ? 'bg-accent-primary/10 text-accent-primary border-accent-primary/30' 
                      : dashboardView === 'accrual'
                        ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30'
                        : 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                  }`}
                  style={{ colorScheme: theme }}
                >
                  <option value="cash">Cash Flow</option>
                  <option value="accrual">Accrual (GM)</option>
                  <option value="comparison">Comparison</option>
                </select>
                
                <div className={`hidden sm:block w-px h-6 ${theme === 'light' ? 'bg-gray-300' : 'bg-terminal-border'}`} />
                
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
                
                <div className="flex gap-1 sm:gap-2 flex-wrap items-center">
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
                  
                  {/* Custom Date Range Inputs */}
                  {dateRangePreset === 'custom' && (
                    <div className="flex items-center gap-2 ml-2 pl-2 border-l border-terminal-border">
                      <input
                        type="month"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className={`px-2 py-1 rounded-lg text-xs border ${inputClasses}`}
                        style={{ colorScheme: theme }}
                      />
                      <span className={textMuted}>to</span>
                      <input
                        type="month"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className={`px-2 py-1 rounded-lg text-xs border ${inputClasses}`}
                        style={{ colorScheme: theme }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Cash Flow View */}
              {dashboardView === 'cash' && (
                <>
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
                      {chartFilters.revenue && <Bar dataKey="revenue" name="Revenue" fill={getCategoryColor('revenue')} radius={[2, 2, 0, 0]} />}
                      {chartFilters.opex && <Bar dataKey="opex" name="OpEx" fill={getCategoryColor('opex')} radius={[2, 2, 0, 0]} />}
                      {chartFilters.overhead && <Bar dataKey="overhead" name="Overhead" fill={getCategoryColor('overhead')} radius={[2, 2, 0, 0]} />}
                      {chartFilters.investment && <Bar dataKey="investment" name="InvEx" fill={getCategoryColor('investment')} radius={[2, 2, 0, 0]} />}
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
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getCategoryColor('opex') }} />
                        <span className={`text-sm ${textMuted}`}>OpEx</span>
                      </div>
                      <div className="text-lg sm:text-xl font-mono font-semibold" style={{ color: getCategoryColor('opex') }}>
                        {formatCurrency(kpis.totalOpex)}
                      </div>
                      <p className={`text-xs mt-1 ${textSubtle}`}>Project costs</p>
                    </div>
                    
                    <div className={`rounded-xl p-4 border ${cardClasses}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getCategoryColor('overhead') }} />
                        <span className={`text-sm ${textMuted}`}>Overhead</span>
                      </div>
                      <div className="text-lg sm:text-xl font-mono font-semibold" style={{ color: getCategoryColor('overhead') }}>
                        {formatCurrency(kpis.totalOverhead)}
                      </div>
                      <p className={`text-xs mt-1 ${textSubtle}`}>Company-wide</p>
                    </div>
                    
                    <div className={`rounded-xl p-4 border ${cardClasses}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getCategoryColor('investment') }} />
                        <span className={`text-sm ${textMuted}`}>Investment</span>
                      </div>
                      <div className="text-lg sm:text-xl font-mono font-semibold" style={{ color: getCategoryColor('investment') }}>
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
                      <Bar dataKey="revenue" name="Revenue" fill={getCategoryColor('revenue')} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="opex" name="OpEx" fill={getCategoryColor('opex')} radius={[4, 4, 0, 0]} />
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

              {/* Quick Stats Row */}
              {transactions.length > 0 && dashboardView === 'cash' && (
                <div className={`rounded-xl p-4 border ${cardClasses}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <List className="w-4 h-4 text-accent-primary" />
                        <span className="text-sm font-medium">{transactions.length} Transactions</span>
                      </div>
                      {transactions.filter(t => t.category === 'unassigned').length > 0 && (
                        <span className="px-2 py-1 bg-purple-500/10 text-purple-500 rounded text-xs">
                          {transactions.filter(t => t.category === 'unassigned').length} need categorization
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={() => setActiveTab('transactions')}
                      className="text-sm text-accent-primary hover:underline flex items-center gap-1"
                    >
                      View All <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
                </>
              )}

              {/* Accrual (Gross Margin) View */}
              {dashboardView === 'accrual' && (
                <>
                  {/* Accrual KPIs */}
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                    <div className={`rounded-xl p-4 border ${cardClasses}`}>
                      <div className={`flex items-center gap-2 text-sm ${textMuted}`}>
                        <TrendingUp className="w-4 h-4" />
                        Total Invoiced
                      </div>
                      <div className="text-2xl font-bold text-accent-primary mt-1">
                        {formatCurrency(accrualProjectAnalysis.totals.revenue)}
                      </div>
                      <div className={`text-xs ${textMuted}`}>{accrualTransactions.filter(t => t.type === 'revenue').length} invoices</div>
                    </div>
                    <div className={`rounded-xl p-4 border ${cardClasses}`}>
                      <div className={`flex items-center gap-2 text-sm ${textMuted}`}>
                        <TrendingDown className="w-4 h-4" />
                        Direct Costs
                      </div>
                      <div className="text-2xl font-bold text-accent-danger mt-1">
                        {formatCurrency(accrualProjectAnalysis.totals.directCosts)}
                      </div>
                      <div className={`text-xs ${textMuted}`}>Contractor invoices</div>
                    </div>
                    <div className={`rounded-xl p-4 border ${cardClasses}`}>
                      <div className={`flex items-center gap-2 text-sm ${textMuted}`}>
                        <DollarSign className="w-4 h-4" />
                        Gross Profit
                      </div>
                      <div className={`text-2xl font-bold mt-1 ${accrualProjectAnalysis.totals.grossProfit >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                        {formatCurrency(accrualProjectAnalysis.totals.grossProfit)}
                      </div>
                      <div className={`text-xs ${textMuted}`}>
                        {accrualProjectAnalysis.totals.revenue > 0 
                          ? `${((accrualProjectAnalysis.totals.grossProfit / accrualProjectAnalysis.totals.revenue) * 100).toFixed(1)}% GM`
                          : 'N/A'}
                      </div>
                    </div>
                    <div className={`rounded-xl p-4 border ${cardClasses}`}>
                      <div className={`flex items-center gap-2 text-sm ${textMuted}`}>
                        <Building2 className="w-4 h-4" />
                        Total Overhead
                      </div>
                      <div className="text-2xl font-bold text-accent-warning mt-1">
                        {formatCurrency(accrualProjectAnalysis.totalOverhead)}
                      </div>
                      <div className={`text-xs ${textMuted}`}>
                        {accrualProjectAnalysis.totals.revenue > 0 
                          ? `${((accrualProjectAnalysis.totalOverhead / accrualProjectAnalysis.totals.revenue) * 100).toFixed(1)}% of revenue`
                          : 'From cash data'}
                      </div>
                    </div>
                    <div className={`rounded-xl p-4 border ${cardClasses}`}>
                      <div className={`flex items-center gap-2 text-sm ${textMuted}`}>
                        <Target className="w-4 h-4" />
                        Net Margin
                      </div>
                      <div className={`text-2xl font-bold mt-1 ${accrualProjectAnalysis.totals.netMargin >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                        {formatCurrency(accrualProjectAnalysis.totals.netMargin)}
                      </div>
                      <div className={`text-xs ${textMuted}`}>After OH allocation</div>
                    </div>
                  </div>

                  {/* Monthly Gross Margin Chart */}
                  <div className={`rounded-xl p-4 sm:p-6 border ${cardClasses}`}>
                    <h3 className="text-lg font-semibold mb-4">Monthly Gross Margin Trend</h3>
                    {accrualMonthlyData.length > 0 ? (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={accrualMonthlyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e5e7eb' : '#374151'} />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke={theme === 'light' ? '#6b7280' : '#9ca3af'} />
                            <YAxis yAxisId="left" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke={theme === 'light' ? '#6b7280' : '#9ca3af'} />
                            <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 11 }} stroke={theme === 'light' ? '#6b7280' : '#9ca3af'} />
                            <Tooltip 
                              formatter={(value: number, name: string) => [
                                name === 'GM %' ? `${value.toFixed(1)}%` : formatCurrency(value),
                                name === 'Revenue' ? 'Revenue' : name === 'Direct Costs' ? 'Direct Costs' : name === 'Gross Profit' ? 'Gross Profit' : 'GM %'
                              ]}
                              contentStyle={{ background: theme === 'light' ? 'white' : '#1f2937', border: 'none', borderRadius: '8px' }}
                            />
                            <Legend />
                            <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                            <Bar yAxisId="left" dataKey="directCosts" name="Direct Costs" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            <Line yAxisId="right" type="monotone" dataKey="grossMarginPct" name="GM %" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className={`text-center py-12 ${textMuted}`}>
                        <p>No accrual data yet. Upload invoices in the Data tab.</p>
                      </div>
                    )}
                  </div>

                  {/* Project Analysis Table */}
                  <div className={`rounded-xl p-4 sm:p-6 border ${cardClasses}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                      <h3 className="text-lg font-semibold">Project Gross Margin Analysis</h3>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${textMuted}`}>
                          {dateRangePreset === 'custom' 
                            ? `${activeDateRange.start} to ${activeDateRange.end}`
                            : datePresets.find(p => p.key === dateRangePreset)?.label || dateRangePreset
                          }
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${theme === 'light' ? 'bg-gray-100' : 'bg-terminal-bg'} ${textMuted}`}>
                          {accrualMonthlyData.length} month{accrualMonthlyData.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    {accrualProjectAnalysis.projects.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className={tableHeaderBg}>
                            <tr className={`border-b ${tableBorder} text-left ${textMuted}`}>
                              <th className="pb-3 font-medium">Project</th>
                              <th className="pb-3 font-medium text-right">Revenue</th>
                              <th className="pb-3 font-medium text-right">Direct Costs</th>
                              <th className="pb-3 font-medium text-right">Gross Profit</th>
                              <th className="pb-3 font-medium text-right">GM %</th>
                              <th className="pb-3 font-medium text-right">Rev Share</th>
                              <th className="pb-3 font-medium text-right">OH Allocation</th>
                              <th className="pb-3 font-medium text-right">Net Margin</th>
                              <th className="pb-3 font-medium text-right">Net %</th>
                            </tr>
                          </thead>
                          <tbody>
                            {accrualProjectAnalysis.projects.map(p => (
                              <tr key={p.project} className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-terminal-border/50'}`}>
                                <td className="py-3 font-medium">{p.project}</td>
                                <td className="py-3 text-right font-mono text-accent-primary">{formatCurrency(p.revenue)}</td>
                                <td className="py-3 text-right font-mono text-accent-danger">{formatCurrency(p.directCosts)}</td>
                                <td className={`py-3 text-right font-mono ${p.grossProfit >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                                  {formatCurrency(p.grossProfit)}
                                </td>
                                <td className={`py-3 text-right font-medium ${p.grossMarginPct >= 30 ? 'text-accent-primary' : p.grossMarginPct >= 15 ? 'text-accent-warning' : 'text-accent-danger'}`}>
                                  {p.grossMarginPct.toFixed(1)}%
                                </td>
                                <td className={`py-3 text-right ${textMuted}`}>{p.revenueSharePct.toFixed(1)}%</td>
                                <td className="py-3 text-right font-mono text-accent-warning">{formatCurrency(p.ohAllocation)}</td>
                                <td className={`py-3 text-right font-mono ${p.netMargin >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                                  {formatCurrency(p.netMargin)}
                                </td>
                                <td className={`py-3 text-right font-medium ${p.netMarginPct >= 20 ? 'text-accent-primary' : p.netMarginPct >= 10 ? 'text-accent-warning' : 'text-accent-danger'}`}>
                                  {p.netMarginPct.toFixed(1)}%
                                </td>
                              </tr>
                            ))}
                            <tr className={`font-bold ${theme === 'light' ? 'bg-gray-50' : 'bg-terminal-bg'}`}>
                              <td className="py-3">TOTAL</td>
                              <td className="py-3 text-right font-mono text-accent-primary">{formatCurrency(accrualProjectAnalysis.totals.revenue)}</td>
                              <td className="py-3 text-right font-mono text-accent-danger">{formatCurrency(accrualProjectAnalysis.totals.directCosts)}</td>
                              <td className={`py-3 text-right font-mono ${accrualProjectAnalysis.totals.grossProfit >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                                {formatCurrency(accrualProjectAnalysis.totals.grossProfit)}
                              </td>
                              <td className="py-3 text-right">
                                {accrualProjectAnalysis.totals.revenue > 0 
                                  ? `${((accrualProjectAnalysis.totals.grossProfit / accrualProjectAnalysis.totals.revenue) * 100).toFixed(1)}%`
                                  : 'N/A'}
                              </td>
                              <td className="py-3 text-right">100%</td>
                              <td className="py-3 text-right font-mono text-accent-warning">{formatCurrency(accrualProjectAnalysis.totalOverhead)}</td>
                              <td className={`py-3 text-right font-mono ${accrualProjectAnalysis.totals.netMargin >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                                {formatCurrency(accrualProjectAnalysis.totals.netMargin)}
                              </td>
                              <td className="py-3 text-right">
                                {accrualProjectAnalysis.totals.revenue > 0 
                                  ? `${((accrualProjectAnalysis.totals.netMargin / accrualProjectAnalysis.totals.revenue) * 100).toFixed(1)}%`
                                  : 'N/A'}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className={`text-center py-12 ${textMuted}`}>
                        <p>No accrual data yet. Upload invoices in the Data tab.</p>
                      </div>
                    )}
                  </div>

                  {/* Project Budget Tracking */}
                  {projectBudgetTracking.length > 0 && (
                    <div className={`rounded-xl p-4 sm:p-6 border ${cardClasses}`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <h3 className="text-lg font-semibold">Project Budget Tracking</h3>
                          {projectBudgetTracking.some(p => p.isOverBudget) && (
                            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-accent-danger/20 text-accent-danger">
                              <AlertTriangle className="w-3 h-3" />
                              Over Budget
                            </span>
                          )}
                          {projectBudgetTracking.some(p => p.isNearBudget) && !projectBudgetTracking.some(p => p.isOverBudget) && (
                            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400">
                              <AlertCircle className="w-3 h-3" />
                              Near Limit
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => setShowProjectModal(true)}
                          className={`text-sm px-3 py-1.5 rounded-lg ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200' : 'bg-terminal-bg hover:bg-terminal-surface'}`}
                        >
                          Manage Budgets
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        {projectBudgetTracking.map(p => (
                          <div key={p.id} className={`p-4 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-terminal-bg'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                                <span className="font-semibold">{p.name}</span>
                                {p.isOverBudget && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent-danger/20 text-accent-danger">
                                    Over Budget
                                  </span>
                                )}
                                {p.isNearBudget && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                                    Near Limit
                                  </span>
                                )}
                              </div>
                              <div className="text-right">
                                <span className={`font-mono font-semibold ${p.isOverBudget ? 'text-accent-danger' : ''}`}>
                                  {formatCurrency(p.spent)}
                                </span>
                                {p.budget > 0 && (
                                  <span className={textMuted}> / {formatCurrency(p.budget)}</span>
                                )}
                              </div>
                            </div>
                            
                            {p.budget > 0 && (
                              <>
                                <div className={`h-3 rounded-full overflow-hidden ${theme === 'light' ? 'bg-gray-200' : 'bg-terminal-border'}`}>
                                  <div 
                                    className={`h-full rounded-full transition-all ${
                                      p.isOverBudget ? 'bg-accent-danger' : 
                                      p.isNearBudget ? 'bg-yellow-400' : 
                                      'bg-accent-primary'
                                    }`}
                                    style={{ width: `${Math.min(p.percentUsed, 100)}%` }}
                                  />
                                </div>
                                <div className="flex justify-between mt-2 text-xs">
                                  <span className={textMuted}>
                                    {p.percentUsed.toFixed(0)}% used
                                  </span>
                                  <span className={p.remaining < 0 ? 'text-accent-danger' : textMuted}>
                                    {p.remaining >= 0 
                                      ? `${formatCurrency(p.remaining)} remaining`
                                      : `${formatCurrency(Math.abs(p.remaining))} over`
                                    }
                                  </span>
                                </div>
                              </>
                            )}
                            
                            {/* Project metrics row */}
                            <div className={`flex gap-4 mt-3 pt-3 border-t text-xs ${theme === 'light' ? 'border-gray-200' : 'border-terminal-border'}`}>
                              <div>
                                <span className={textMuted}>Revenue: </span>
                                <span className="font-mono text-accent-primary">{formatCurrency(p.revenue)}</span>
                              </div>
                              <div>
                                <span className={textMuted}>Gross Profit: </span>
                                <span className={`font-mono ${p.grossProfit >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                                  {formatCurrency(p.grossProfit)}
                                </span>
                              </div>
                              <div>
                                <span className={textMuted}>GM: </span>
                                <span className={`font-semibold ${p.grossMarginPct >= 30 ? 'text-accent-primary' : p.grossMarginPct >= 15 ? 'text-yellow-400' : 'text-accent-danger'}`}>
                                  {p.grossMarginPct.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {/* Projects without budgets hint */}
                      {projects.filter(p => !p.budget).length > 0 && (
                        <p className={`text-xs mt-4 ${textMuted}`}>
                          <Info className="w-3 h-3 inline mr-1" />
                          {projects.filter(p => !p.budget).length} project(s) without budgets. 
                          <button onClick={() => setShowProjectModal(true)} className="text-accent-primary hover:underline ml-1">
                            Add budgets
                          </button>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Period Comparison Buttons */}
                  <div className={`rounded-xl p-4 sm:p-6 border ${cardClasses}`}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Period Comparison</h3>
                      <div className="flex items-center gap-2">
                        {(['mom', 'qoq', 'yoy'] as const).map(view => (
                          <button
                            key={view}
                            onClick={() => setComparisonView(view)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium ${
                              comparisonView === view
                                ? 'bg-indigo-500 text-white'
                                : theme === 'light' ? 'bg-gray-100 hover:bg-gray-200' : 'bg-terminal-bg hover:bg-terminal-surface'
                            }`}
                          >
                            {view === 'mom' ? 'MoM' : view === 'qoq' ? 'QoQ' : 'YoY'}
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    {/* Period Comparison Table */}
                    {comparisonView === 'mom' && accrualPeriodComparison.mom.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className={tableHeaderBg}>
                            <tr className={`border-b ${tableBorder} text-left ${textMuted}`}>
                              <th className="pb-3 font-medium">Month</th>
                              <th className="pb-3 font-medium text-right">Revenue</th>
                              <th className="pb-3 font-medium text-right">vs Prior</th>
                              <th className="pb-3 font-medium text-right">Gross Profit</th>
                              <th className="pb-3 font-medium text-right">GM %</th>
                              <th className="pb-3 font-medium text-right">GM Change</th>
                            </tr>
                          </thead>
                          <tbody>
                            {accrualPeriodComparison.mom.map(row => (
                              <tr key={row.period} className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-terminal-border/50'}`}>
                                <td className="py-3 font-medium">{row.period}</td>
                                <td className="py-3 text-right font-mono">{formatCurrency(row.currentRevenue)}</td>
                                <td className={`py-3 text-right font-mono ${row.revenueChange === null ? textMuted : row.revenueChange >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                                  {row.revenueChange === null ? '-' : `${row.revenueChange >= 0 ? '+' : ''}${row.revenueChange.toFixed(1)}%`}
                                </td>
                                <td className={`py-3 text-right font-mono ${row.currentGrossProfit >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                                  {formatCurrency(row.currentGrossProfit)}
                                </td>
                                <td className="py-3 text-right font-mono">{row.currentGM.toFixed(1)}%</td>
                                <td className={`py-3 text-right font-mono ${row.gmChange === null ? textMuted : row.gmChange >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                                  {row.gmChange === null ? '-' : `${row.gmChange >= 0 ? '+' : ''}${row.gmChange.toFixed(1)}pp`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    
                    {comparisonView === 'qoq' && accrualPeriodComparison.qoq.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className={tableHeaderBg}>
                            <tr className={`border-b ${tableBorder} text-left ${textMuted}`}>
                              <th className="pb-3 font-medium">Quarter</th>
                              <th className="pb-3 font-medium text-right">Revenue</th>
                              <th className="pb-3 font-medium text-right">vs Prior Qtr</th>
                              <th className="pb-3 font-medium text-right">Gross Profit</th>
                              <th className="pb-3 font-medium text-right">GM %</th>
                              <th className="pb-3 font-medium text-right">GM Change</th>
                            </tr>
                          </thead>
                          <tbody>
                            {accrualPeriodComparison.qoq.map(row => (
                              <tr key={row.period} className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-terminal-border/50'}`}>
                                <td className="py-3 font-medium">{row.period}</td>
                                <td className="py-3 text-right font-mono">{formatCurrency(row.currentRevenue)}</td>
                                <td className={`py-3 text-right font-mono ${row.revenueChange === null ? textMuted : row.revenueChange >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                                  {row.revenueChange === null ? '-' : `${row.revenueChange >= 0 ? '+' : ''}${row.revenueChange.toFixed(1)}%`}
                                </td>
                                <td className={`py-3 text-right font-mono ${row.currentGrossProfit >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                                  {formatCurrency(row.currentGrossProfit)}
                                </td>
                                <td className="py-3 text-right font-mono">{row.currentGM.toFixed(1)}%</td>
                                <td className={`py-3 text-right font-mono ${row.gmChange === null ? textMuted : row.gmChange >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                                  {row.gmChange === null ? '-' : `${row.gmChange >= 0 ? '+' : ''}${row.gmChange.toFixed(1)}pp`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    
                    {comparisonView === 'yoy' && accrualPeriodComparison.yoy.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className={tableHeaderBg}>
                            <tr className={`border-b ${tableBorder} text-left ${textMuted}`}>
                              <th className="pb-3 font-medium">Year</th>
                              <th className="pb-3 font-medium text-right">Revenue</th>
                              <th className="pb-3 font-medium text-right">vs Prior Year</th>
                              <th className="pb-3 font-medium text-right">Gross Profit</th>
                              <th className="pb-3 font-medium text-right">GM %</th>
                              <th className="pb-3 font-medium text-right">GM Change</th>
                            </tr>
                          </thead>
                          <tbody>
                            {accrualPeriodComparison.yoy.map(row => (
                              <tr key={row.period} className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-terminal-border/50'}`}>
                                <td className="py-3 font-medium">{row.period}</td>
                                <td className="py-3 text-right font-mono">{formatCurrency(row.currentRevenue)}</td>
                                <td className={`py-3 text-right font-mono ${row.revenueChange >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                                  {row.revenueChange >= 0 ? '+' : ''}{row.revenueChange.toFixed(1)}%
                                </td>
                                <td className={`py-3 text-right font-mono ${row.currentGrossProfit >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                                  {formatCurrency(row.currentGrossProfit)}
                                </td>
                                <td className="py-3 text-right font-mono">{row.currentGM.toFixed(1)}%</td>
                                <td className={`py-3 text-right font-mono ${row.gmChange >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                                  {row.gmChange >= 0 ? '+' : ''}{row.gmChange.toFixed(1)}pp
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    
                    {((comparisonView === 'mom' && accrualPeriodComparison.mom.length === 0) ||
                      (comparisonView === 'qoq' && accrualPeriodComparison.qoq.length === 0) ||
                      (comparisonView === 'yoy' && accrualPeriodComparison.yoy.length === 0)) && (
                      <div className={`text-center py-8 ${textMuted}`}>
                        <p>Need at least 2 {comparisonView === 'mom' ? 'months' : comparisonView === 'qoq' ? 'quarters' : 'years'} of data for comparison.</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Comparison View */}
              {dashboardView === 'comparison' && (
                <>
                  {/* Comparison Summary KPIs */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className={`rounded-xl p-4 border ${cardClasses}`}>
                      <div className={`flex items-center gap-2 text-sm ${textMuted}`}>
                        <FileText className="w-4 h-4" />
                        Total Invoiced
                      </div>
                      <div className="text-2xl font-bold text-indigo-500 mt-1">
                        {formatCurrency(cashVsAccrualData.reduce((sum, m) => sum + m.invoiced, 0))}
                      </div>
                      <div className={`text-xs ${textMuted}`}>Accrual basis</div>
                    </div>
                    <div className={`rounded-xl p-4 border ${cardClasses}`}>
                      <div className={`flex items-center gap-2 text-sm ${textMuted}`}>
                        <DollarSign className="w-4 h-4" />
                        Total Collected
                      </div>
                      <div className="text-2xl font-bold text-accent-primary mt-1">
                        {formatCurrency(cashVsAccrualData.reduce((sum, m) => sum + m.collected, 0))}
                      </div>
                      <div className={`text-xs ${textMuted}`}>Cash basis</div>
                    </div>
                    <div className={`rounded-xl p-4 border ${cardClasses}`}>
                      <div className={`flex items-center gap-2 text-sm ${textMuted}`}>
                        <TrendingUp className="w-4 h-4" />
                        Outstanding AR
                      </div>
                      <div className={`text-2xl font-bold mt-1 ${
                        cashVsAccrualData.reduce((sum, m) => sum + m.invoiced, 0) - cashVsAccrualData.reduce((sum, m) => sum + m.collected, 0) > 0
                          ? 'text-accent-warning' : 'text-accent-primary'
                      }`}>
                        {formatCurrency(
                          cashVsAccrualData.reduce((sum, m) => sum + m.invoiced, 0) - 
                          cashVsAccrualData.reduce((sum, m) => sum + m.collected, 0)
                        )}
                      </div>
                      <div className={`text-xs ${textMuted}`}>Invoiced - Collected</div>
                    </div>
                    <div className={`rounded-xl p-4 border ${cardClasses}`}>
                      <div className={`flex items-center gap-2 text-sm ${textMuted}`}>
                        <Clock className="w-4 h-4" />
                        Collection Rate
                      </div>
                      <div className="text-2xl font-bold text-accent-primary mt-1">
                        {cashVsAccrualData.reduce((sum, m) => sum + m.invoiced, 0) > 0
                          ? `${((cashVsAccrualData.reduce((sum, m) => sum + m.collected, 0) / cashVsAccrualData.reduce((sum, m) => sum + m.invoiced, 0)) * 100).toFixed(1)}%`
                          : 'N/A'}
                      </div>
                      <div className={`text-xs ${textMuted}`}>Cash/Invoiced</div>
                    </div>
                  </div>

                  {/* Comparison Chart */}
                  <div className={`rounded-xl p-4 sm:p-6 border ${cardClasses}`}>
                    <h3 className="text-lg font-semibold mb-4">Invoiced vs Collected by Month</h3>
                    {cashVsAccrualData.length > 0 ? (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={cashVsAccrualData}>
                            <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e5e7eb' : '#374151'} />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke={theme === 'light' ? '#6b7280' : '#9ca3af'} />
                            <YAxis tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke={theme === 'light' ? '#6b7280' : '#9ca3af'} />
                            <Tooltip 
                              formatter={(value: number, name: string) => [formatCurrency(value), name]}
                              contentStyle={{ background: theme === 'light' ? 'white' : '#1f2937', border: 'none', borderRadius: '8px' }}
                            />
                            <Legend />
                            <Bar dataKey="invoiced" name="Invoiced (Accrual)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="collected" name="Collected (Cash)" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                            <ReferenceLine y={0} stroke="#6b7280" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className={`text-center py-12 ${textMuted}`}>
                        <p>No comparison data. Upload both cash and accrual data in the Data tab.</p>
                      </div>
                    )}
                  </div>

                  {/* Comparison Table */}
                  <div className={`rounded-xl p-4 sm:p-6 border ${cardClasses}`}>
                    <h3 className="text-lg font-semibold mb-4">Monthly Comparison Detail</h3>
                    {cashVsAccrualData.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className={tableHeaderBg}>
                            <tr className={`border-b ${tableBorder} text-left ${textMuted}`}>
                              <th className="pb-3 font-medium">Month</th>
                              <th className="pb-3 font-medium text-right">Invoiced (Accrual)</th>
                              <th className="pb-3 font-medium text-right">Collected (Cash)</th>
                              <th className="pb-3 font-medium text-right">Delta</th>
                              <th className="pb-3 font-medium">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cashVsAccrualData.map(row => (
                              <tr key={row.month} className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-terminal-border/50'}`}>
                                <td className="py-3 font-medium">{row.month}</td>
                                <td className="py-3 text-right font-mono text-indigo-500">{formatCurrency(row.invoiced)}</td>
                                <td className="py-3 text-right font-mono text-accent-primary">{formatCurrency(row.collected)}</td>
                                <td className={`py-3 text-right font-mono font-medium ${row.delta >= 0 ? 'text-accent-primary' : 'text-accent-warning'}`}>
                                  {row.delta >= 0 ? '+' : ''}{formatCurrency(row.delta)}
                                </td>
                                <td className={`py-3 text-xs ${textMuted}`}>
                                  {row.delta < 0 ? 'Pending collection' : row.delta > 0 ? 'Collected prior invoices' : 'Balanced'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className={`text-center py-12 ${textMuted}`}>
                        <p>No comparison data. Upload both cash and accrual data in the Data tab.</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <motion.div key="transactions" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              {/* View Toggle */}
              <div className={`rounded-xl p-4 border ${cardClasses}`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTransactionViewType('cash')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                        transactionViewType === 'cash'
                          ? 'bg-accent-primary text-white'
                          : theme === 'light' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-terminal-bg text-zinc-400 hover:bg-terminal-surface'
                      }`}
                    >
                      <DollarSign className="w-4 h-4" />
                      Cash ({transactions.length})
                    </button>
                    <button
                      onClick={() => setTransactionViewType('accrual')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                        transactionViewType === 'accrual'
                          ? 'bg-indigo-500 text-white'
                          : theme === 'light' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-terminal-bg text-zinc-400 hover:bg-terminal-surface'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                      Accrual ({accrualTransactions.length})
                    </button>
                  </div>
                </div>
              </div>

              {/* Cash Transactions View */}
              {transactionViewType === 'cash' && (
                <>
                  {/* Filters Bar */}
                  <div className={`rounded-xl p-4 border ${cardClasses}`}>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-semibold">Cash Transactions</h3>
                        <select
                          value={transactionMonthFilter}
                          onChange={(e) => setTransactionMonthFilter(e.target.value)}
                          className={`rounded-lg px-3 py-2 text-sm border ${inputClasses}`}
                          style={{ colorScheme: theme }}
                        >
                          <option value="all">All Months</option>
                          {transactionMonths.map(m => (
                            <option key={m} value={m}>{getMonthLabel(m)}</option>
                          ))}
                        </select>
                        <select
                          value={transactionCategoryFilter}
                          onChange={(e) => setTransactionCategoryFilter(e.target.value)}
                          className={`rounded-lg px-3 py-2 text-sm border ${inputClasses}`}
                          style={{ colorScheme: theme }}
                        >
                          <option value="all">All Categories</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>
                              {cat.id === 'unassigned' ? '⚠️ ' : ''}{cat.name}
                            </option>
                          ))}
                        </select>
                        <select
                          value={selectedProject}
                          onChange={(e) => setSelectedProject(e.target.value)}
                          className={`rounded-lg px-3 py-2 text-sm border ${inputClasses}`}
                          style={{ colorScheme: theme }}
                        >
                          <option value="all">All Projects</option>
                          {projectList.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setShowQuickAdd(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90"
                        >
                          <Plus className="w-4 h-4" />
                          Add
                        </button>
                        <button onClick={exportToCSV} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                          theme === 'light' ? 'bg-white border-gray-300 hover:bg-gray-50' : 'bg-terminal-bg border-terminal-border'
                        }`}>
                          <Download className="w-4 h-4" />
                          CSV
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Transaction Table */}
                  {filteredTransactions.length > 0 ? (
                    <div className={`rounded-xl p-4 sm:p-6 border ${cardClasses}`}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className={tableHeaderBg}>
                            <tr className={`border-b ${tableBorder} text-left ${textMuted}`}>
                              <th className="pb-3 font-medium">Date</th>
                              <th className="pb-3 font-medium">Category</th>
                              <th className="pb-3 font-medium">Description</th>
                              <th className="pb-3 font-medium text-right">Amount</th>
                              <th className="pb-3 font-medium">Project</th>
                              <th className="pb-3 font-medium">Type</th>
                              <th className="pb-3 font-medium text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTransactions.map(t => {
                              const cat = getCategoryById(t.category)
                              return (
                                <tr key={t.id} className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-terminal-border/50'} hover:${theme === 'light' ? 'bg-gray-50' : 'bg-terminal-bg/50'}`}>
                                  <td className="py-3 text-sm">{t.date}</td>
                                  <td className="py-3">
                                    <span 
                                      className="px-2 py-1 rounded text-xs font-medium"
                                      style={{ 
                                        backgroundColor: `${cat?.color || '#6b7280'}15`,
                                        color: cat?.color || '#6b7280'
                                      }}
                                    >
                                      {cat?.name || t.category}
                                    </span>
                                  </td>
                                  <td className="py-3 text-sm">
                                    <div className="flex items-center gap-2 max-w-xs">
                                      <span className="truncate">{t.description}</span>
                                      {t.notes && (
                                        <button 
                                          onClick={() => setExpandedNotes(prev => {
                                            const next = new Set(prev)
                                            if (next.has(t.id)) next.delete(t.id)
                                            else next.add(t.id)
                                            return next
                                          })}
                                          className="p-0.5 text-accent-secondary hover:text-accent-primary flex-shrink-0"
                                          title={t.notes}
                                        >
                                          <MessageSquare className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                    {t.notes && expandedNotes.has(t.id) && (
                                      <div className={`text-xs mt-1 p-2 rounded ${theme === 'light' ? 'bg-gray-100 text-gray-600' : 'bg-terminal-bg text-zinc-400'}`}>
                                        {t.notes}
                                      </div>
                                    )}
                                  </td>
                                  <td className={`py-3 text-right font-mono text-sm ${t.amount >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                                    {formatCurrency(t.amount)}
                                  </td>
                                  <td className={`py-3 text-sm ${textMuted}`}>{t.project || '-'}</td>
                                  <td className="py-3">
                                    <span className={`px-2 py-0.5 rounded text-xs ${
                                      t.type === 'actual' 
                                        ? 'bg-accent-primary/10 text-accent-primary' 
                                        : 'bg-accent-warning/10 text-accent-warning'
                                    }`}>
                                      {t.type}
                                    </span>
                                  </td>
                                  <td className="py-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      <button onClick={() => startEdit(t)} className="p-1.5 text-zinc-400 hover:text-accent-primary hover:bg-accent-primary/10 rounded">
                                        <Edit2 className="w-4 h-4" />
                                      </button>
                                      <button onClick={() => deleteTransaction(t.id)} className="p-1.5 text-zinc-400 hover:text-accent-danger hover:bg-accent-danger/10 rounded">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className={`text-sm mt-4 text-center ${textMuted}`}>
                        Showing {filteredTransactions.length} of {transactions.length} transactions
                      </p>
                    </div>
                  ) : (
                    <div className={`rounded-xl p-12 border ${cardClasses} text-center`}>
                      <List className={`w-12 h-12 mx-auto mb-4 ${textMuted}`} />
                      <h3 className="text-lg font-semibold mb-2">No Transactions</h3>
                      <p className={`mb-4 ${textMuted}`}>
                        {transactions.length === 0 
                          ? 'Import your data or add transactions manually'
                          : 'No transactions match your filters'}
                      </p>
                      <div className="flex gap-3 justify-center">
                        <button 
                          onClick={() => setActiveTab('data')}
                          className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90"
                        >
                          Import Data
                        </button>
                        <button 
                          onClick={() => setShowQuickAdd(true)}
                          className={`px-4 py-2 rounded-lg border ${
                            theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-terminal-border hover:bg-terminal-bg'
                          }`}
                        >
                          Add Manually
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Accrual Transactions View */}
              {transactionViewType === 'accrual' && (
                <>
                  {/* Filters Bar */}
                  <div className={`rounded-xl p-4 border ${cardClasses}`}>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-lg font-semibold">Accrual Transactions</h3>
                        <select
                          value={accrualMonthFilter}
                          onChange={(e) => setAccrualMonthFilter(e.target.value)}
                          className={`rounded-lg px-3 py-2 text-sm border ${inputClasses}`}
                          style={{ colorScheme: theme }}
                        >
                          <option value="all">All Months</option>
                          {accrualMonths.map(m => (
                            <option key={m} value={m}>{getMonthLabel(m)}</option>
                          ))}
                        </select>
                        <select
                          value={accrualTypeFilter}
                          onChange={(e) => setAccrualTypeFilter(e.target.value)}
                          className={`rounded-lg px-3 py-2 text-sm border ${inputClasses}`}
                          style={{ colorScheme: theme }}
                        >
                          <option value="all">All Types</option>
                          <option value="revenue">Revenue</option>
                          <option value="direct_cost">Direct Cost</option>
                        </select>
                        <select
                          value={accrualProjectFilter}
                          onChange={(e) => setAccrualProjectFilter(e.target.value)}
                          className={`rounded-lg px-3 py-2 text-sm border ${inputClasses}`}
                          style={{ colorScheme: theme }}
                        >
                          <option value="all">All Projects</option>
                          {accrualProjects.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={openAddAccrualModal}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
                        >
                          <Plus className="w-4 h-4" />
                          Add
                        </button>
                        {selectedAccrualIds.size > 0 && (
                          <button 
                            onClick={bulkDeleteAccrualTransactions}
                            className="flex items-center gap-2 px-3 py-2 bg-accent-danger text-white rounded-lg hover:bg-accent-danger/90"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete ({selectedAccrualIds.size})
                          </button>
                        )}
                        <button 
                          onClick={clearAllAccrualTransactions}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                            theme === 'light' ? 'border-red-300 text-red-600 hover:bg-red-50' : 'border-accent-danger/50 text-accent-danger hover:bg-accent-danger/10'
                          }`}
                        >
                          <Trash2 className="w-4 h-4" />
                          Clear All
                        </button>
                        <button onClick={exportAccrualToCSV} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                          theme === 'light' ? 'bg-white border-gray-300 hover:bg-gray-50' : 'bg-terminal-bg border-terminal-border'
                        }`}>
                          <Download className="w-4 h-4" />
                          CSV
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Accrual Transaction Table */}
                  {filteredAccrualTransactions.length > 0 ? (
                    <div className={`rounded-xl p-4 sm:p-6 border ${cardClasses}`}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className={tableHeaderBg}>
                            <tr className={`border-b ${tableBorder} text-left ${textMuted}`}>
                              <th className="pb-3 font-medium w-10">
                                <input 
                                  type="checkbox" 
                                  checked={filteredAccrualTransactions.length > 0 && filteredAccrualTransactions.every(t => selectedAccrualIds.has(t.id))}
                                  onChange={() => toggleAllAccrualSelection(filteredAccrualTransactions.map(t => t.id))}
                                  className="rounded"
                                />
                              </th>
                              <th className="pb-3 font-medium">Date</th>
                              <th className="pb-3 font-medium">Type</th>
                              <th className="pb-3 font-medium">Description</th>
                              <th className="pb-3 font-medium text-right">Amount</th>
                              <th className="pb-3 font-medium">Project</th>
                              <th className="pb-3 font-medium">Vendor</th>
                              <th className="pb-3 font-medium text-center">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredAccrualTransactions.map(t => (
                              <tr key={t.id} className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-terminal-border/50'} ${selectedAccrualIds.has(t.id) ? (theme === 'light' ? 'bg-indigo-50' : 'bg-indigo-500/10') : ''} hover:${theme === 'light' ? 'bg-gray-50' : 'bg-terminal-bg/50'}`}>
                                <td className="py-3">
                                  <input 
                                    type="checkbox" 
                                    checked={selectedAccrualIds.has(t.id)}
                                    onChange={() => toggleAccrualSelection(t.id)}
                                    className="rounded"
                                  />
                                </td>
                                {editingAccrualId === t.id ? (
                                  <>
                                    <td className="py-2">
                                      <input 
                                        type="date" 
                                        value={editAccrualForm.date || ''} 
                                        onChange={(e) => setEditAccrualForm(prev => ({ ...prev, date: e.target.value }))}
                                        className={`w-full px-2 py-1 text-sm rounded border ${inputClasses}`}
                                        style={{ colorScheme: theme }}
                                      />
                                    </td>
                                    <td className="py-2">
                                      <select 
                                        value={editAccrualForm.type || 'revenue'} 
                                        onChange={(e) => setEditAccrualForm(prev => ({ ...prev, type: e.target.value as 'revenue' | 'direct_cost' }))}
                                        className={`px-2 py-1 text-sm rounded border ${inputClasses}`}
                                        style={{ colorScheme: theme }}
                                      >
                                        <option value="revenue">Revenue</option>
                                        <option value="direct_cost">Direct Cost</option>
                                      </select>
                                    </td>
                                    <td className="py-2">
                                      <input 
                                        type="text" 
                                        value={editAccrualForm.description || ''} 
                                        onChange={(e) => setEditAccrualForm(prev => ({ ...prev, description: e.target.value }))}
                                        className={`w-full px-2 py-1 text-sm rounded border ${inputClasses}`}
                                        style={{ colorScheme: theme }}
                                      />
                                    </td>
                                    <td className="py-2">
                                      <input 
                                        type="number" 
                                        value={editAccrualForm.amount || ''} 
                                        onChange={(e) => setEditAccrualForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                                        className={`w-24 px-2 py-1 text-sm rounded border text-right ${inputClasses}`}
                                        style={{ colorScheme: theme }}
                                      />
                                    </td>
                                    <td className="py-2">
                                      <input 
                                        type="text" 
                                        value={editAccrualForm.project || ''} 
                                        onChange={(e) => setEditAccrualForm(prev => ({ ...prev, project: e.target.value }))}
                                        className={`w-full px-2 py-1 text-sm rounded border ${inputClasses}`}
                                        style={{ colorScheme: theme }}
                                      />
                                    </td>
                                    <td className="py-2">
                                      <input 
                                        type="text" 
                                        value={editAccrualForm.vendor || ''} 
                                        onChange={(e) => setEditAccrualForm(prev => ({ ...prev, vendor: e.target.value }))}
                                        className={`w-full px-2 py-1 text-sm rounded border ${inputClasses}`}
                                        style={{ colorScheme: theme }}
                                      />
                                    </td>
                                    <td className="py-2 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <button onClick={saveEditAccrual} className="p-1.5 text-accent-primary hover:bg-accent-primary/10 rounded">
                                          <Check className="w-4 h-4" />
                                        </button>
                                        <button onClick={cancelEditAccrual} className="p-1.5 text-zinc-400 hover:bg-zinc-500/10 rounded">
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="py-3 text-sm">{t.date}</td>
                                    <td className="py-3">
                                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                                        t.type === 'revenue' 
                                          ? 'bg-accent-primary/10 text-accent-primary' 
                                          : 'bg-accent-danger/10 text-accent-danger'
                                      }`}>
                                        {t.type === 'revenue' ? 'Revenue' : 'Direct Cost'}
                                      </span>
                                    </td>
                                    <td className="py-3 text-sm max-w-xs truncate">{t.description}</td>
                                    <td className={`py-3 text-right font-mono text-sm ${t.type === 'revenue' ? 'text-accent-primary' : 'text-accent-danger'}`}>
                                      {formatCurrency(Math.abs(t.amount))}
                                    </td>
                                    <td className={`py-3 text-sm ${textMuted}`}>{t.project}</td>
                                    <td className={`py-3 text-sm ${textMuted}`}>{t.vendor || '-'}</td>
                                    <td className="py-3 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <button onClick={() => startEditAccrual(t)} className="p-1.5 text-zinc-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded" title="Inline edit">
                                          <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => openEditAccrualModal(t)} className="p-1.5 text-zinc-400 hover:text-accent-primary hover:bg-accent-primary/10 rounded" title="Edit in modal">
                                          <ExternalLink className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => deleteAccrualTransaction(t.id)} className="p-1.5 text-zinc-400 hover:text-accent-danger hover:bg-accent-danger/10 rounded" title="Delete">
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className={`text-sm mt-4 text-center ${textMuted}`}>
                        Showing {filteredAccrualTransactions.length} of {accrualTransactions.length} accrual transactions
                        {selectedAccrualIds.size > 0 && ` • ${selectedAccrualIds.size} selected`}
                      </p>
                    </div>
                  ) : (
                    <div className={`rounded-xl p-12 border ${cardClasses} text-center`}>
                      <FileText className={`w-12 h-12 mx-auto mb-4 ${textMuted}`} />
                      <h3 className="text-lg font-semibold mb-2">No Accrual Transactions</h3>
                      <p className={`mb-4 ${textMuted}`}>
                        {accrualTransactions.length === 0 
                          ? 'Add invoice data to track gross margin'
                          : 'No transactions match your filters'}
                      </p>
                      <div className="flex gap-3 justify-center">
                        <button 
                          onClick={openAddAccrualModal}
                          className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add Manually
                        </button>
                        <button 
                          onClick={() => setActiveTab('data')}
                          className={`px-4 py-2 rounded-lg border flex items-center gap-2 ${
                            theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-terminal-border hover:bg-terminal-bg'
                          }`}
                        >
                          <Upload className="w-4 h-4" />
                          Import CSV
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}

          {/* Data Tab */}
          {activeTab === 'data' && (
            <motion.div key="data" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              
              {/* Cash Flow Settings */}
              <div className={`rounded-xl p-4 border ${cardClasses}`}>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-accent-primary" />
                  Cash Flow Settings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm mb-2 ${textMuted}`}>Beginning Balance</label>
                    <div className="relative">
                      <DollarSign className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${textMuted}`} />
                      <input
                        type="number"
                        value={beginningBalance}
                        onChange={(e) => setBeginningBalance(parseFloat(e.target.value) || 0)}
                        className={`pl-9 pr-4 py-2.5 rounded-lg font-mono w-full border ${inputClasses}`}
                        style={{ colorScheme: theme }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-sm mb-2 ${textMuted}`}>Actuals Cutoff</label>
                    <input
                      type="month"
                      value={cutoffDate}
                      onChange={(e) => setCutoffDate(e.target.value)}
                      className={`px-4 py-2.5 rounded-lg font-mono w-full border ${inputClasses}`}
                      style={{ colorScheme: theme }}
                    />
                  </div>
                </div>
              </div>

              {/* Two Upload Sections Side by Side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Cash Flow Upload */}
                <div className={`rounded-xl p-6 border-2 border-dashed transition-all ${
                  isDragging 
                    ? 'border-accent-primary bg-accent-primary/5' 
                    : theme === 'light' ? 'border-gray-300' : 'border-terminal-border'
                }`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) handleFileUpload(file) }}
                >
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-accent-primary/10 flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-accent-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">💵 Cash Flow Data</h3>
                    <p className={`text-sm mb-4 ${textMuted}`}>Bank transactions, actual payments</p>
                    <input type="file" accept=".csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file) }} className="hidden" id="cash-file-upload" />
                    <label htmlFor="cash-file-upload" className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-primary text-white rounded-lg cursor-pointer hover:bg-accent-primary/90">
                      <Upload className="w-4 h-4" />
                      Upload Cash Data
                    </label>
                    <div className={`text-xs mt-3 ${textSubtle}`}>
                      {transactions.length} transactions loaded
                    </div>
                  </div>
                </div>

                {/* Accrual/Invoice Upload */}
                <div className={`rounded-xl p-6 border-2 border-dashed transition-all ${
                  theme === 'light' ? 'border-indigo-200 hover:border-indigo-300' : 'border-indigo-500/30 hover:border-indigo-500/50'
                }`}
                  onDragOver={(e) => { e.preventDefault() }}
                  onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleAccrualUpload(file) }}
                >
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-indigo-500/10 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-indigo-500" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">📊 Accrual Data (Invoices)</h3>
                    <p className={`text-sm mb-4 ${textMuted}`}>Invoices issued & received (for GM)</p>
                    <input type="file" accept=".csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleAccrualUpload(file) }} className="hidden" id="accrual-file-upload" />
                    <label htmlFor="accrual-file-upload" className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-500 text-white rounded-lg cursor-pointer hover:bg-indigo-500/90">
                      <Upload className="w-4 h-4" />
                      Upload Invoice Data
                    </label>
                    <div className={`text-xs mt-3 ${textSubtle}`}>
                      {accrualTransactions.length} invoices loaded
                    </div>
                  </div>
                </div>
              </div>

              {/* Format Instructions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={`rounded-xl p-4 border ${cardClasses}`}>
                  <h4 className="font-semibold mb-3 text-accent-primary">Cash Flow Format</h4>
                  <div className={`rounded-lg p-3 font-mono text-xs overflow-x-auto ${theme === 'light' ? 'bg-gray-50' : 'bg-terminal-bg'}`}>
                    <div className={textMuted}>date,category,description,amount,type,project</div>
                    <div className="text-accent-primary">2024-01-15,revenue,Payment received,50000,actual,Alpha</div>
                    <div className="text-accent-danger">2024-01-01,opex,Contractor payment,-15000,actual,Alpha</div>
                    <div className="text-accent-warning">2024-01-01,overhead,Rent payment,-5000,actual,</div>
                  </div>
                </div>
                
                <div className={`rounded-xl p-4 border ${cardClasses}`}>
                  <h4 className="font-semibold mb-3 text-indigo-500">Accrual/Invoice Format</h4>
                  <div className={`rounded-lg p-3 font-mono text-xs overflow-x-auto ${theme === 'light' ? 'bg-gray-50' : 'bg-terminal-bg'}`}>
                    <div className={textMuted}>date,type,description,amount,project,vendor</div>
                    <div className="text-accent-primary">2024-01-15,revenue,Invoice #1001,50000,Alpha,Client ABC</div>
                    <div className="text-accent-danger">2024-01-01,direct_cost,Contractor inv,-15000,Alpha,Dev Co</div>
                  </div>
                  <div className={`text-xs mt-2 ${textSubtle}`}>
                    <strong>Type:</strong> revenue (invoices TO clients) or direct_cost (invoices FROM contractors)
                  </div>
                </div>
              </div>

              {/* AI Categorization */}
              <div className={`rounded-xl p-6 border ${cardClasses}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">AI-Powered Categorization</h3>
                    <p className={`text-sm ${textMuted}`}>Let AI analyze and categorize your transactions before import</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Cash AI Upload */}
                  <div className={`p-4 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-terminal-bg'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-sm">Cash Transactions</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full bg-accent-primary/10 text-accent-primary`}>
                        AI Ready
                      </span>
                    </div>
                    <input 
                      type="file" 
                      accept=".csv" 
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          Papa.parse(file, {
                            header: true,
                            skipEmptyLines: true,
                            complete: (results) => {
                              const data = results.data.map((row: any, idx: number) => ({
                                date: row.date,
                                category: row.category || 'unassigned',
                                description: row.description,
                                amount: parseFloat(row.amount) || 0,
                                type: row.type || 'actual',
                                project: row.project,
                                notes: row.notes
                              })).filter(t => t.date && !isNaN(t.amount))
                              
                              if (data.length > 0) {
                                categorizeWithAI(data, 'cash')
                              } else {
                                alert('No valid data found in CSV')
                              }
                            }
                          })
                        }
                        e.target.value = ''
                      }} 
                      className="hidden" 
                      id="ai-cash-upload" 
                    />
                    <label 
                      htmlFor="ai-cash-upload" 
                      className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer font-medium text-sm transition-all ${
                        aiLoading 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600'
                      }`}
                    >
                      {aiLoading && uploadType === 'cash' ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          AI Categorize Cash CSV
                        </>
                      )}
                    </label>
                  </div>
                  
                  {/* Accrual AI Upload */}
                  <div className={`p-4 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-terminal-bg'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-sm">Accrual/Invoices</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400`}>
                        AI Ready
                      </span>
                    </div>
                    <input 
                      type="file" 
                      accept=".csv" 
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          Papa.parse(file, {
                            header: true,
                            skipEmptyLines: true,
                            complete: (results) => {
                              const data = results.data.map((row: any) => ({
                                date: row.date,
                                type: row.type || 'revenue',
                                description: row.description,
                                amount: parseFloat(row.amount) || 0,
                                project: row.project,
                                vendor: row.vendor,
                                invoiceNumber: row.invoice_number || row.invoiceNumber,
                                notes: row.notes
                              })).filter(t => t.date && !isNaN(t.amount))
                              
                              if (data.length > 0) {
                                categorizeWithAI(data, 'accrual')
                              } else {
                                alert('No valid data found in CSV')
                              }
                            }
                          })
                        }
                        e.target.value = ''
                      }} 
                      className="hidden" 
                      id="ai-accrual-upload" 
                    />
                    <label 
                      htmlFor="ai-accrual-upload" 
                      className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg cursor-pointer font-medium text-sm transition-all ${
                        aiLoading 
                          ? 'bg-gray-400 cursor-not-allowed' 
                          : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600'
                      }`}
                    >
                      {aiLoading && uploadType === 'accrual' ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          AI Categorize Accrual CSV
                        </>
                      )}
                    </label>
                  </div>
                </div>
                
                <div className={`mt-4 p-3 rounded-lg text-sm ${theme === 'light' ? 'bg-purple-50 text-purple-700' : 'bg-purple-500/10 text-purple-300'}`}>
                  <strong>How it works:</strong> Upload a CSV and AI will analyze each transaction description to suggest categories and projects. You can review, edit, and approve suggestions before importing.
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-4">
                <button onClick={loadSampleData} className="flex items-center gap-2 px-5 py-2.5 bg-accent-secondary/10 text-accent-secondary rounded-lg hover:bg-accent-secondary/20">
                  <RefreshCw className="w-4 h-4" />
                  Load Sample
                </button>
                <button onClick={exportToCSV} disabled={!transactions.length} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg border disabled:opacity-50 ${
                  theme === 'light' ? 'bg-white border-gray-300 hover:bg-gray-50' : 'bg-terminal-bg border-terminal-border'
                }`}>
                  <Download className="w-4 h-4" />
                  Export Cash CSV
                </button>
                <button 
                  onClick={() => {
                    const csv = Papa.unparse(accrualTransactions)
                    const blob = new Blob([csv], { type: 'text/csv' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'accrual-invoices.csv'
                    a.click()
                    URL.revokeObjectURL(url)
                  }} 
                  disabled={!accrualTransactions.length} 
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg border disabled:opacity-50 ${
                    theme === 'light' ? 'bg-white border-gray-300 hover:bg-gray-50' : 'bg-terminal-bg border-terminal-border'
                  }`}
                >
                  <Download className="w-4 h-4" />
                  Export Accrual CSV
                </button>
                <button 
                  onClick={() => {
                    if (confirm('Clear all cash flow transactions?')) {
                      setTransactions([])
                    }
                  }} 
                  disabled={!transactions.length} 
                  className="flex items-center gap-2 px-5 py-2.5 bg-accent-danger/10 text-accent-danger rounded-lg disabled:opacity-50 hover:bg-accent-danger/20"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Cash
                </button>
                <button 
                  onClick={() => {
                    if (confirm('Clear all accrual/invoice data?')) {
                      setAccrualTransactions([])
                    }
                  }} 
                  disabled={!accrualTransactions.length} 
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500/10 text-indigo-500 rounded-lg disabled:opacity-50 hover:bg-indigo-500/20"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Accrual
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <input type="text" placeholder="Name (e.g., New Project Alpha)" value={newAssumption.name || ''} onChange={(e) => setNewAssumption(prev => ({ ...prev, name: e.target.value }))} className={`px-4 py-2 rounded-lg border ${inputClasses}`} style={{ colorScheme: theme }} />
                  <select value={newAssumption.category || 'revenue'} onChange={(e) => setNewAssumption(prev => ({ ...prev, category: e.target.value }))} className={`px-4 py-2 rounded-lg border ${inputClasses}`} style={{ colorScheme: theme }}>
                    <option value="revenue">Revenue</option>
                    <option value="opex">OpEx</option>
                    <option value="overhead">Overhead</option>
                    <option value="investment">Investment</option>
                  </select>
                  <select value={newAssumption.valueType || 'amount'} onChange={(e) => setNewAssumption(prev => ({ ...prev, valueType: e.target.value as 'amount' | 'percentage' }))} className={`px-4 py-2 rounded-lg border ${inputClasses}`} style={{ colorScheme: theme }}>
                    <option value="amount">$ Amount</option>
                    <option value="percentage">% Percentage</option>
                  </select>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      placeholder={newAssumption.valueType === 'percentage' ? '10' : '50000'} 
                      value={newAssumption.amount || ''} 
                      onChange={(e) => setNewAssumption(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))} 
                      className={`flex-1 px-4 py-2 rounded-lg border ${inputClasses}`} 
                      style={{ colorScheme: theme }} 
                    />
                    <span className={`flex items-center px-2 ${textMuted}`}>{newAssumption.valueType === 'percentage' ? '%' : '$'}</span>
                  </div>
                </div>
                {newAssumption.valueType === 'percentage' && (
                  <div className="mb-4">
                    <label className={`block text-sm mb-2 ${textMuted}`}>Percentage Of:</label>
                    <select 
                      value={newAssumption.percentOf || 'baseline'} 
                      onChange={(e) => setNewAssumption(prev => ({ ...prev, percentOf: e.target.value as Assumption['percentOf'] }))} 
                      className={`px-4 py-2 rounded-lg border ${inputClasses}`} 
                      style={{ colorScheme: theme }}
                    >
                      <option value="baseline">Baseline Average</option>
                      <option value="previous">Previous Month (Compounding)</option>
                      <option value="revenue">Revenue</option>
                      <option value="opex">OpEx</option>
                      <option value="overhead">Overhead</option>
                      <option value="investment">Investment</option>
                    </select>
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  <select value={newAssumption.frequency || 'monthly'} onChange={(e) => setNewAssumption(prev => ({ ...prev, frequency: e.target.value as Assumption['frequency'] }))} className={`px-4 py-2 rounded-lg border ${inputClasses}`} style={{ colorScheme: theme }}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annually">Annually</option>
                    <option value="one-time">One-time</option>
                  </select>
                  <div>
                    <label className={`block text-xs mb-1 ${textMuted}`}>Start Month</label>
                    <input type="month" value={newAssumption.startDate || ''} onChange={(e) => setNewAssumption(prev => ({ ...prev, startDate: e.target.value }))} className={`w-full px-4 py-2 rounded-lg border ${inputClasses}`} style={{ colorScheme: theme }} />
                  </div>
                  <div>
                    <label className={`block text-xs mb-1 ${textMuted}`}>End Month</label>
                    <input type="month" placeholder="Optional" value={newAssumption.endDate || ''} onChange={(e) => setNewAssumption(prev => ({ ...prev, endDate: e.target.value }))} className={`w-full px-4 py-2 rounded-lg border ${inputClasses}`} style={{ colorScheme: theme }} />
                  </div>
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
                  <p className={`text-center py-8 ${textMuted}`}>No assumptions added yet. Create assumptions above to see them reflected in Projections.</p>
                ) : (
                  <div className="space-y-2">
                    {activeAssumptions.map(a => (
                      <div key={a.id} className={`flex items-center justify-between p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-terminal-bg'}`}>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span 
                            className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{ 
                              backgroundColor: `${getCategoryColor(a.category)}15`,
                              color: getCategoryColor(a.category)
                            }}
                          >{getCategoryById(a.category)?.name || a.category}</span>
                          <span className="font-medium">{a.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${theme === 'light' ? 'bg-gray-200' : 'bg-terminal-surface'} ${textMuted}`}>
                            {a.frequency}
                          </span>
                          <span className={`text-xs ${textMuted}`}>
                            {a.startDate}{a.endDate ? ` → ${a.endDate}` : '+'}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`font-mono ${a.amount >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                            {a.valueType === 'percentage' 
                              ? `${a.amount}% of ${a.percentOf || 'baseline'}` 
                              : formatCurrency(a.amount)
                            }
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
              {/* Controls Bar */}
              <div className={`rounded-xl p-4 border ${cardClasses}`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <label className={`block text-xs mb-1 ${textMuted}`}>Baseline Period</label>
                      <select
                        value={baselinePeriod}
                        onChange={(e) => setBaselinePeriod(e.target.value as typeof baselinePeriod)}
                        className={`rounded-lg px-3 py-2 text-sm border ${inputClasses}`}
                        style={{ colorScheme: theme }}
                      >
                        <option value="L3M">Last 3 Months</option>
                        <option value="L6M">Last 6 Months</option>
                        <option value="L12M">Last 12 Months</option>
                        <option value="all">All Historical</option>
                      </select>
                    </div>
                    <div className={`text-sm ${textMuted}`}>
                      Based on {projectionData.numBaselineMonths} month{projectionData.numBaselineMonths !== 1 ? 's' : ''} of data
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${textMuted}`}>Show:</span>
                    {(['3M', '6M', '12M', '18M', '24M'] as const).map(period => (
                      <button 
                        key={period} 
                        onClick={() => setProjectionPeriod(period)} 
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                          projectionPeriod === period 
                            ? 'bg-accent-primary text-white' 
                            : theme === 'light' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-terminal-bg hover:bg-terminal-surface'
                        }`}
                      >
                        {period}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className={`rounded-xl p-4 border ${cardClasses}`}>
                  <div className={`flex items-center gap-2 text-sm ${textMuted}`}>
                    <DollarSign className="w-4 h-4" />
                    Current Balance
                  </div>
                  <div className={`text-2xl font-bold mt-1 ${projectionData.currentBalance >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                    {formatCurrency(projectionData.currentBalance)}
                  </div>
                  <div className={`text-xs ${textMuted}`}>Starting point</div>
                </div>
                <div className={`rounded-xl p-4 border ${cardClasses}`}>
                  <div className={`flex items-center gap-2 text-sm ${textMuted}`}>
                    <TrendingUp className="w-4 h-4" />
                    Projected End Balance
                  </div>
                  <div className={`text-2xl font-bold mt-1 ${projectionData.endBalance >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                    {formatCurrency(projectionData.endBalance)}
                  </div>
                  <div className={`text-xs ${textMuted}`}>After {projectionPeriod}</div>
                </div>
                <div className={`rounded-xl p-4 border ${cardClasses}`}>
                  <div className={`flex items-center gap-2 text-sm ${textMuted}`}>
                    <BarChart3 className="w-4 h-4" />
                    Avg Monthly Net
                  </div>
                  <div className={`text-2xl font-bold mt-1 ${projectionData.avgMonthlyNet >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                    {formatCurrency(projectionData.avgMonthlyNet)}
                  </div>
                  <div className={`text-xs ${textMuted}`}>Cash flow/month</div>
                </div>
                <div className={`rounded-xl p-4 border ${cardClasses}`}>
                  <div className={`flex items-center gap-2 text-sm ${textMuted}`}>
                    <Clock className="w-4 h-4" />
                    Projected Runway
                  </div>
                  <div className={`text-2xl font-bold mt-1 ${
                    projectionData.projectedRunway === Infinity ? 'text-accent-primary' :
                    projectionData.projectedRunway < 6 ? 'text-accent-danger' :
                    projectionData.projectedRunway < 12 ? 'text-accent-warning' : 'text-accent-primary'
                  }`}>
                    {projectionData.projectedRunway === Infinity 
                      ? '∞ Profitable' 
                      : `${projectionData.projectedRunway.toFixed(1)} months`
                    }
                  </div>
                  <div className={`text-xs ${textMuted}`}>
                    {projectionData.projectedRunway === Infinity ? 'Cash positive' : 'Until zero balance'}
                  </div>
                </div>
              </div>

              {/* Baseline Averages */}
              <div className={`rounded-xl p-4 border ${cardClasses}`}>
                <h4 className={`text-sm font-medium mb-3 ${textMuted}`}>Baseline Monthly Averages ({baselinePeriod})</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <div className={`text-xs ${textMuted}`}>Revenue</div>
                    <div className="text-lg font-mono text-accent-primary">{formatCurrency(projectionData.baselineAvg.revenue)}</div>
                  </div>
                  <div>
                    <div className={`text-xs ${textMuted}`}>OpEx</div>
                    <div className="text-lg font-mono text-accent-danger">{formatCurrency(projectionData.baselineAvg.opex)}</div>
                  </div>
                  <div>
                    <div className={`text-xs ${textMuted}`}>Overhead</div>
                    <div className="text-lg font-mono text-accent-warning">{formatCurrency(projectionData.baselineAvg.overhead)}</div>
                  </div>
                  <div>
                    <div className={`text-xs ${textMuted}`}>Investment</div>
                    <div className="text-lg font-mono text-accent-secondary">{formatCurrency(projectionData.baselineAvg.investment)}</div>
                  </div>
                </div>
              </div>

              {/* Projection Chart */}
              <div className={`rounded-xl p-4 sm:p-6 border ${cardClasses}`}>
                <h3 className="text-lg font-semibold mb-4">Projected Cash Flow & Balance</h3>
                {projectionData.months.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={projectionData.months}>
                      <defs>
                        <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e5e7eb' : '#374151'} />
                      <XAxis dataKey="monthLabel" tick={{ fontSize: 11 }} stroke={theme === 'light' ? '#6b7280' : '#9ca3af'} />
                      <YAxis yAxisId="left" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke={theme === 'light' ? '#6b7280' : '#9ca3af'} />
                      <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke={theme === 'light' ? '#6b7280' : '#9ca3af'} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#1f1f1f', border: `1px solid ${theme === 'light' ? '#e5e7eb' : '#374151'}`, borderRadius: '8px' }}
                        formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      />
                      <Legend />
                      <ReferenceLine yAxisId="left" y={0} stroke="#ef4444" strokeDasharray="3 3" />
                      <Bar yAxisId="left" dataKey="netCash" name="Net Cash" fill={theme === 'light' ? '#10b981' : '#34d399'} radius={[4, 4, 0, 0]} />
                      <Area yAxisId="right" type="monotone" dataKey="balance" name="Balance" stroke="#6366f1" fill="url(#balanceGradient)" strokeWidth={2} />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className={`text-center py-12 ${textMuted}`}>
                    <p>No projection data. Upload cash transactions in the Data tab.</p>
                  </div>
                )}
              </div>

              {/* Projection Table */}
              <div className={`rounded-xl p-4 sm:p-6 border ${cardClasses}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Monthly Projection Detail</h3>
                  <span className={`text-sm ${textMuted}`}>{projectionData.months.length} months</span>
                </div>
                {projectionData.months.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className={`border-b ${tableBorder}`}>
                          <th className={`pb-3 text-left font-medium ${textMuted}`}>Month</th>
                          <th className={`pb-3 text-right font-medium ${textMuted}`}>Revenue</th>
                          <th className={`pb-3 text-right font-medium ${textMuted}`}>OpEx</th>
                          <th className={`pb-3 text-right font-medium ${textMuted}`}>Overhead</th>
                          <th className={`pb-3 text-right font-medium ${textMuted}`}>Investment</th>
                          <th className={`pb-3 text-right font-medium ${textMuted}`}>Net Cash</th>
                          <th className={`pb-3 text-right font-medium ${textMuted}`}>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectionData.months.map((m, idx) => (
                          <tr key={m.month} className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-terminal-border/50'} ${idx % 2 === 0 ? '' : theme === 'light' ? 'bg-gray-50/50' : 'bg-terminal-bg/50'}`}>
                            <td className="py-3 font-medium">{m.monthLabel}</td>
                            <td className="py-3 text-right font-mono text-accent-primary">{formatCurrency(m.revenue)}</td>
                            <td className="py-3 text-right font-mono text-accent-danger">{formatCurrency(m.opex)}</td>
                            <td className="py-3 text-right font-mono text-accent-warning">{formatCurrency(m.overhead)}</td>
                            <td className="py-3 text-right font-mono text-accent-secondary">{formatCurrency(m.investment)}</td>
                            <td className={`py-3 text-right font-mono font-medium ${m.netCash >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                              {formatCurrency(m.netCash)}
                            </td>
                            <td className={`py-3 text-right font-mono font-medium ${m.balance >= 0 ? 'text-indigo-500' : 'text-accent-danger'}`}>
                              {formatCurrency(m.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={`text-center py-12 ${textMuted}`}>
                    <p>No projection data available.</p>
                  </div>
                )}
              </div>

              {/* Assumptions Applied Notice */}
              {activeAssumptions.length > 0 && (
                <div className={`rounded-xl p-4 border ${theme === 'light' ? 'bg-indigo-50 border-indigo-200' : 'bg-indigo-500/10 border-indigo-500/30'}`}>
                  <div className="flex items-center gap-2 text-indigo-500 font-medium">
                    <Info className="w-4 h-4" />
                    {activeAssumptions.length} assumption{activeAssumptions.length > 1 ? 's' : ''} applied to this projection
                  </div>
                  <p className={`text-sm mt-1 ${theme === 'light' ? 'text-indigo-600' : 'text-indigo-400'}`}>
                    Edit assumptions in the Assumptions tab to adjust the forecast.
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* Clients Tab */}
          {activeTab === 'clients' && (
            <motion.div key="clients" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">Clients & Projects</h2>
                  <p className={`text-sm ${textMuted}`}>Manage clients and assign projects</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowProjectModal(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium border ${theme === 'light' ? 'border-gray-300 hover:bg-gray-100' : 'border-terminal-border hover:bg-terminal-bg'}`}
                  >
                    <FolderPlus className="w-4 h-4" />
                    Manage Projects
                  </button>
                  <button
                    onClick={() => setShowClientModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-accent-primary text-white rounded-lg font-medium hover:bg-accent-primary/90"
                  >
                    <Plus className="w-4 h-4" />
                    Add Client
                  </button>
                </div>
              </div>

              {/* Quick Stats Row */}
              <div className="grid grid-cols-4 gap-4">
                <div className={`rounded-lg p-3 border ${cardClasses}`}>
                  <div className={`text-xs ${textMuted}`}>Clients</div>
                  <div className="text-xl font-bold">{clients.length}</div>
                </div>
                <div className={`rounded-lg p-3 border ${cardClasses}`}>
                  <div className={`text-xs ${textMuted}`}>Total Revenue</div>
                  <div className="text-xl font-bold text-accent-primary">{formatCurrency(clientAnalytics.reduce((sum, c) => sum + c.revenue, 0))}</div>
                </div>
                <div className={`rounded-lg p-3 border ${cardClasses}`}>
                  <div className={`text-xs ${textMuted}`}>Avg. GM%</div>
                  <div className="text-xl font-bold">
                    {clientAnalytics.filter(c => c.revenue > 0).length > 0 
                      ? `${(clientAnalytics.filter(c => c.revenue > 0).reduce((sum, c) => sum + c.grossMarginPct, 0) / clientAnalytics.filter(c => c.revenue > 0).length).toFixed(1)}%`
                      : 'N/A'
                    }
                  </div>
                </div>
                <div className={`rounded-lg p-3 border ${cardClasses}`}>
                  <div className={`text-xs ${textMuted}`}>Projects</div>
                  <div className="text-xl font-bold">{projects.length} <span className={`text-sm font-normal ${textMuted}`}>({projects.filter(p => !p.clientId).length} unassigned)</span></div>
                </div>
              </div>

              {/* Clients Table */}
              <div className={`rounded-xl border overflow-hidden ${cardClasses}`}>
                <div className={`flex items-center justify-between px-4 py-3 border-b ${theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-terminal-bg border-terminal-border'}`}>
                  <h3 className="font-semibold">Clients</h3>
                  <div className="flex gap-1">
                    {['all', 'active', 'inactive', 'prospect'].map(status => (
                      <button
                        key={status}
                        onClick={() => setSelectedClientId(status === selectedClientId ? 'all' : status)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                          (status === 'all' && selectedClientId === 'all') || selectedClientId === status
                            ? 'bg-accent-primary text-white'
                            : theme === 'light' ? 'bg-gray-100 hover:bg-gray-200' : 'bg-terminal-surface hover:bg-terminal-border'
                        }`}
                      >
                        {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                
                {clients.length === 0 ? (
                  <div className="p-8 text-center">
                    <Users className={`w-10 h-10 mx-auto mb-3 ${textMuted}`} />
                    <p className={`text-sm ${textMuted}`}>No clients yet. Add your first client to get started.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className={theme === 'light' ? 'bg-gray-50' : 'bg-terminal-surface'}>
                      <tr className={`border-b ${theme === 'light' ? 'border-gray-200' : 'border-terminal-border'} text-left ${textMuted}`}>
                        <th className="px-4 py-3 font-medium">Client</th>
                        <th className="px-4 py-3 font-medium text-right">Revenue</th>
                        <th className="px-4 py-3 font-medium text-right">Costs</th>
                        <th className="px-4 py-3 font-medium text-right">GM%</th>
                        <th className="px-4 py-3 font-medium">Projects</th>
                        <th className="px-4 py-3 font-medium w-24"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {clientAnalytics
                        .filter(c => selectedClientId === 'all' || c.status === selectedClientId)
                        .map(client => (
                        <tr key={client.id} className={`border-b ${theme === 'light' ? 'border-gray-100 hover:bg-gray-50' : 'border-terminal-border/50 hover:bg-terminal-bg'}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                client.status === 'active' ? 'bg-green-500/20 text-green-400' :
                                client.status === 'prospect' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {client.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-medium">{client.name}</div>
                                <div className={`text-xs ${textMuted}`}>{client.contactEmail || client.status}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-accent-primary">{formatCurrency(client.revenue)}</td>
                          <td className="px-4 py-3 text-right font-mono text-accent-danger">{formatCurrency(client.costs)}</td>
                          <td className={`px-4 py-3 text-right font-semibold ${
                            client.grossMarginPct >= 30 ? 'text-accent-primary' : 
                            client.grossMarginPct >= 15 ? 'text-yellow-400' : 'text-accent-danger'
                          }`}>
                            {client.revenue > 0 ? `${client.grossMarginPct.toFixed(1)}%` : 'N/A'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {client.projects.slice(0, 3).map(p => (
                                <span key={p.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${theme === 'light' ? 'bg-gray-100' : 'bg-terminal-bg'}`}>
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                                  {p.name}
                                </span>
                              ))}
                              {client.projects.length > 3 && (
                                <span className={`px-2 py-0.5 rounded text-xs ${textMuted}`}>+{client.projects.length - 3}</span>
                              )}
                              {client.projects.length === 0 && (
                                <span className={`text-xs ${textMuted}`}>None</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setEditingClient(client)}
                                className={`p-1.5 rounded hover:bg-accent-primary/10 ${textMuted} hover:text-accent-primary`}
                                title="Edit"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => deleteClientData(client.id)}
                                className={`p-1.5 rounded hover:bg-accent-danger/10 ${textMuted} hover:text-accent-danger`}
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Assign Projects Section */}
              <div className={`rounded-xl border overflow-hidden ${cardClasses}`}>
                <div className={`px-4 py-3 border-b ${theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-terminal-bg border-terminal-border'}`}>
                  <h3 className="font-semibold">Assign Projects to Clients</h3>
                  <p className={`text-xs mt-1 ${textMuted}`}>Link your projects to clients for consolidated reporting</p>
                </div>
                
                <div className="p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={`border-b ${theme === 'light' ? 'border-gray-200' : 'border-terminal-border'} text-left ${textMuted}`}>
                        <th className="pb-2 font-medium">Project</th>
                        <th className="pb-2 font-medium text-right">Revenue</th>
                        <th className="pb-2 font-medium text-right">Costs</th>
                        <th className="pb-2 font-medium">Assigned Client</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectList.map(projectName => {
                        // Find existing project object or use defaults
                        const existingProject = projects.find(p => normalizeProjectName(p.name) === normalizeProjectName(projectName))
                        const projectColor = existingProject?.color || PROJECT_COLORS[projectList.indexOf(projectName) % PROJECT_COLORS.length]
                        
                        // Get revenue/costs for this project from accrual data
                        const projectRevenue = accrualTransactions
                          .filter(t => normalizeProjectName(t.project) === normalizeProjectName(projectName) && t.type === 'revenue')
                          .reduce((sum, t) => sum + t.amount, 0)
                        const projectCosts = accrualTransactions
                          .filter(t => normalizeProjectName(t.project) === normalizeProjectName(projectName) && t.type === 'direct_cost')
                          .reduce((sum, t) => sum + Math.abs(t.amount), 0)
                        
                        return (
                          <tr key={projectName} className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-terminal-border/50'}`}>
                            <td className="py-2">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: projectColor }} />
                                <span className="font-medium">{projectName}</span>
                              </div>
                            </td>
                            <td className="py-2 text-right font-mono text-accent-primary">{formatCurrency(projectRevenue)}</td>
                            <td className="py-2 text-right font-mono text-accent-danger">{formatCurrency(projectCosts)}</td>
                            <td className="py-2">
                              <select
                                value={existingProject?.clientId || ''}
                                onChange={(e) => {
                                  const clientId = e.target.value || undefined
                                  if (existingProject) {
                                    // Update existing project
                                    updateProject(existingProject.id, { clientId })
                                  } else {
                                    // Create new project with client assignment
                                    const newProject: Project = {
                                      id: generateId(),
                                      name: projectName,
                                      color: projectColor,
                                      status: 'active',
                                      clientId,
                                      createdAt: new Date().toISOString()
                                    }
                                    setProjects(prev => [...prev, newProject])
                                  }
                                }}
                                className={`w-full max-w-[200px] px-2 py-1 rounded text-sm border ${inputClasses}`}
                                style={{ colorScheme: theme }}
                              >
                                <option value="">No client</option>
                                {clients.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        )
                      })}
                      {projectList.length === 0 && (
                        <tr>
                          <td colSpan={4} className={`py-4 text-center ${textMuted}`}>
                            No projects found. Upload transaction data with project names.
                          </td>
                        </tr>
                      )}
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

              {/* Category Manager */}
              <div className={`rounded-xl p-6 border ${cardClasses}`}>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Tag className="w-5 h-5" />
                  Categories
                </h3>
                <p className={`text-sm mb-4 ${textMuted}`}>Create custom categories to track where your money goes</p>
                
                <div className="space-y-3 mb-4">
      {categories.map(cat => (
  <div key={cat.id} className={`flex items-center justify-between p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-terminal-bg'}`}>
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={cat.color}
        onChange={async (e) => {
          const newColor = e.target.value
          // Update local state immediately
          setCategories(prev => prev.map(c => 
            c.id === cat.id ? { ...c, color: newColor } : c
          ))
          // Persist to database if we have the dbId
          if (cat.dbId) {
            await supabaseUpdateCategory(cat.dbId, { color: newColor })
          }
        }}
        className="w-6 h-6 rounded-full cursor-pointer border-0 p-0"
        title="Click to change color"
      />
      <span className="font-medium">{cat.name}</span>
      <span className={`text-xs px-2 py-0.5 rounded ${theme === 'light' ? 'bg-gray-200' : 'bg-terminal-surface'}`}>
        {cat.type}
      </span>
      {cat.isDefault && (
        <span className={`text-xs ${textMuted}`}>(default)</span>
      )}
    </div>
    {categories.length > 1 && (
      <button 
        onClick={async () => {
          // Delete from database if we have dbId
          if (cat.dbId) {
            await supabaseDeleteCategory(cat.dbId)
          }
          setCategories(prev => prev.filter(c => c.id !== cat.id))
        }}
        className="p-1 text-zinc-400 hover:text-accent-danger"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    )}
  </div>
))}
                </div>
                
                <div className={`p-4 rounded-lg border-2 border-dashed ${theme === 'light' ? 'border-gray-300' : 'border-terminal-border'}`}>
                  <h4 className={`text-sm font-medium mb-3 ${textMuted}`}>Add New Category</h4>
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[150px]">
                      <label className={`block text-xs mb-1 ${textSubtle}`}>Name</label>
                      <input
                        type="text"
                        id="new-category-name"
                        placeholder="e.g., Travel, Taxes"
                        className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                        style={{ colorScheme: theme }}
                      />
                    </div>
                    <div className="w-32">
                      <label className={`block text-xs mb-1 ${textSubtle}`}>Type</label>
                      <select
                        id="new-category-type"
                        className={`w-full px-3 py-2 rounded-lg text-sm border ${inputClasses}`}
                        style={{ colorScheme: theme }}
                      >
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                      </select>
                    </div>
                    <div className="w-20">
                      <label className={`block text-xs mb-1 ${textSubtle}`}>Color</label>
                      <input
                        type="color"
                        id="new-category-color"
                        defaultValue="#6366f1"
                        className="w-full h-10 rounded-lg cursor-pointer border-0"
                      />
                    </div>
                    <button 
                      onClick={async () => {
                        const nameInput = document.getElementById('new-category-name') as HTMLInputElement
                        const typeSelect = document.getElementById('new-category-type') as HTMLSelectElement
                        const colorInput = document.getElementById('new-category-color') as HTMLInputElement
                        
                        if (nameInput.value.trim() && companyId && user) {
                          const categoryId = nameInput.value.toLowerCase().replace(/\s+/g, '_')
                          
                          // Save to database
                          const { data, error } = await supabaseInsertCategory({
                            company_id: companyId,
                            category_id: categoryId,
                            name: nameInput.value.trim(),
                            type: typeSelect.value as 'income' | 'expense',
                            color: colorInput.value,
                            is_default: false
                          })
                          
                          if (!error && data) {
                            const newCat: Category = {
                              id: categoryId,
                              dbId: data.id,
                              name: nameInput.value.trim(),
                              type: typeSelect.value as 'income' | 'expense',
                              color: colorInput.value,
                              isDefault: false
                            }
                            setCategories(prev => [...prev, newCat])
                            nameInput.value = ''
                          } else {
                            // Fallback to local only if db fails
                            const newCat: Category = {
                              id: categoryId,
                              name: nameInput.value.trim(),
                              type: typeSelect.value as 'income' | 'expense',
                              color: colorInput.value,
                              isDefault: false
                            }
                            setCategories(prev => [...prev, newCat])
                            nameInput.value = ''
                          }
                        }
                      }}
                      className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-primary/90"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
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
  
  <div className={`p-4 rounded-lg mb-4 ${theme === 'light' ? 'bg-blue-50 border border-blue-200' : 'bg-accent-secondary/10 border border-accent-secondary/20'}`}>
    <div className="flex items-start gap-3">
      <Shield className="w-5 h-5 text-accent-secondary mt-0.5" />
      <div>
        <p className={`font-medium ${theme === 'light' ? 'text-blue-800' : 'text-accent-secondary'}`}>Secure Cloud Storage</p>
        <p className={`text-sm mt-1 ${theme === 'light' ? 'text-blue-700' : 'text-accent-secondary/80'}`}>
          Your data is encrypted and stored securely on Supabase (AWS). Access from any device with your login.
          Team members with the same email domain share data automatically.
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
          <p className={`text-sm ${textMuted}`}>Supabase Cloud (AWS) • Encrypted</p>
        </div>
      </div>
    </div>
    
    <div className={`flex items-center justify-between p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-terminal-bg'}`}>
      <div className="flex items-center gap-3">
        <Users className="w-5 h-5" />
        <div>
          <p className={`font-medium ${theme === 'light' ? 'text-gray-900' : 'text-zinc-200'}`}>Team Access</p>
          <p className={`text-sm ${textMuted}`}>Role: {profile?.role || 'user'} • Company shared data</p>
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
  
  <div className={`mt-4 p-3 rounded-lg ${theme === 'light' ? 'bg-green-50 border border-green-200' : 'bg-accent-primary/10 border border-accent-primary/20'}`}>
    <p className={`text-sm ${theme === 'light' ? 'text-green-800' : 'text-accent-primary'}`}>
      <strong>Auto-sync:</strong> All changes save automatically to the cloud. Your data is backed up and accessible from any device.
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

          {/* Footer */}
          <footer className={`border-t py-4 print:hidden ${theme === 'light' ? 'border-gray-200' : 'border-terminal-border'}`}>
            <div className={`px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs ${textMuted}`}>
              <span>{branding.companyName} • Data secured in cloud</span>
              <div className="flex items-center gap-4">
                <button onClick={() => setShowPrivacyModal(true)} className="hover:underline">Privacy</button>
                <button onClick={() => setShowTermsModal(true)} className="hover:underline">Terms</button>
              </div>
            </div>
          </footer>
        </div>
      </div>

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
