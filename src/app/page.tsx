'use client'

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
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
  BarChart3, LogOut, User, Menu, ChevronDown, ChevronRight, PanelLeftClose, PanelLeft,
  Send, Bot
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
  fetchClients, insertClient as supabaseInsertClient, updateClient as supabaseUpdateClient, deleteClient as supabaseDeleteClient,
  fetchProjects, insertProject as supabaseInsertProject, updateProject as supabaseUpdateProject, deleteProject as supabaseDeleteProject
} from '../lib/supabase'

// Vantage Logo Component
const VantageLogo = ({ size = 48, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect width="48" height="48" rx="12" fill="#f97316"/>
    <rect x="10" y="26" width="7" height="12" rx="2" fill="white" fillOpacity="0.5"/>
    <rect x="20" y="18" width="7" height="20" rx="2" fill="white" fillOpacity="0.7"/>
    <rect x="30" y="10" width="7" height="28" rx="2" fill="white"/>
    
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
  source?: 'qbo' | 'csv' | 'manual' // Data source
  qbo_transaction_id?: string // QuickBooks transaction ID
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
  source?: 'qbo' | 'csv' | 'manual' // Data source
  qbo_invoice_id?: string // QuickBooks invoice ID
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

const PROJECT_COLORS = ['#f97316', '#34d399', '#60a5fa', '#fbbf24', '#fb7185', '#2dd4bf', '#94a3b8', '#06b6d4']

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
  categories: 'cashflow_categories',
  collapsedSections: 'cashflow_collapsed_sections'
}

// Default categories
const DEFAULT_CATEGORIES: Category[] = [
  { id: 'revenue', name: 'Revenue', type: 'income', color: '#34d399', isDefault: true },
  { id: 'opex', name: 'OpEx', type: 'expense', color: '#fb7185', isDefault: true },
  { id: 'overhead', name: 'Overhead', type: 'expense', color: '#f59e0b', isDefault: true },
  { id: 'investment', name: 'Investment', type: 'expense', color: '#3b82f6', isDefault: true },
  { id: 'unassigned', name: 'Unassigned', type: 'expense', color: '#64748b', isDefault: true },
]

// Branding interface
interface BrandingSettings {
  companyName: string
  companyLogo: string | null  // For dark mode
  companyLogoLight: string | null  // For light mode
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'data' | 'assumptions' | 'projections' | 'clients' | 'reports' | 'integrations' | 'settings'>('dashboard')
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
  const [theme, setTheme] = useState<'dark' | 'light'>('light')
  const [balanceAlertThreshold, setBalanceAlertThreshold] = useState<number>(0)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [showPdfExport, setShowPdfExport] = useState(false)

  // Reports state
  const [activeReport, setActiveReport] = useState<string | null>(null)
  const [reportDateRange, setReportDateRange] = useState({ start: '', end: '' })
  const [reportProject, setReportProject] = useState<string>('all')
  const [reportClient, setReportClient] = useState<string>('all')
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
  
  // Dashboard collapsible sections
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  
  const toggleDashboardSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }
  
  // AI Categorization state
  const [showAiPreview, setShowAiPreview] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([])
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [pendingUploadData, setPendingUploadData] = useState<any[]>([])
  const [uploadType, setUploadType] = useState<'cash' | 'accrual'>('cash')
  
  // Enhanced Transaction UI state
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set())
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = useState<'all' | 'qbo' | 'csv' | 'manual'>('all')
  const [showBulkCategorize, setShowBulkCategorize] = useState(false)
  const [bulkCategory, setBulkCategory] = useState('')
  const [bulkProject, setBulkProject] = useState('')
  
  // Bank Statement Parsing state
  const [statementLoading, setStatementLoading] = useState(false)
  const [statementData, setStatementData] = useState<any[]>([])
  const [showStatementPreview, setShowStatementPreview] = useState(false)
  const [statementInfo, setStatementInfo] = useState<any>(null)
  const [statementError, setStatementError] = useState<string | null>(null)
  
  // AI Chat state
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState<Array<{
    role: 'user' | 'assistant', 
    content: string,
    action?: {
      action: string
      type: 'cash' | 'accrual'
      updates: Array<{
        id: string
        changes: { category?: string; project?: string }
        preview: {
          description: string
          amount: number
          currentCategory?: string
          currentProject?: string
          newCategory?: string
          newProject?: string
        }
      }>
      summary: string
    }
  }>>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [pendingChatAction, setPendingChatAction] = useState<{
    action: string
    type: 'cash' | 'accrual'
    updates: Array<{
      id: string
      changes: { category?: string; project?: string }
      preview: {
        description: string
        amount: number
        currentCategory?: string
        currentProject?: string
        newCategory?: string
        newProject?: string
      }
    }>
    summary: string
  } | null>(null)
  const chatMessagesEndRef = useRef<HTMLDivElement>(null)
  
  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages])
  
  // Branding state
  const [branding, setBranding] = useState<BrandingSettings>({
    companyName: 'Vantage',
    companyLogo: null,
    companyLogoLight: null,
    brandColor: '#f97316'
  })
  
  // QuickBooks integration state
  const [qboConnected, setQboConnected] = useState(false)
  const [qboConnectedAt, setQboConnectedAt] = useState<string | null>(null)
  const [qboSyncing, setQboSyncing] = useState(false)
  const [qboLastSync, setQboLastSync] = useState<string | null>(null)
  
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
            clientsRes,
            projectsRes
          ] = await Promise.all([
            fetchTransactions(profile.company_id),
            fetchAccrualTransactions(profile.company_id),
            fetchAssumptions(profile.company_id),
            fetchCategories(profile.company_id),
            fetchCompanySettings(profile.company_id),
            fetchClients(profile.company_id),
            fetchProjects(profile.company_id)
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
              notes: t.notes,
              source: t.source || 'manual',
              qbo_transaction_id: t.qbo_transaction_id
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
              notes: t.notes,
              source: t.source || 'manual',
              qbo_invoice_id: t.qbo_invoice_id
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
            if (settingsRes.data.cutoff_date) {
              setCutoffDate(settingsRes.data.cutoff_date)
            }
            if (settingsRes.data.balance_alert_threshold) {
              setBalanceAlertThreshold(parseFloat(settingsRes.data.balance_alert_threshold))
            }
            
           if (settingsRes.data.company_logo) {
  setBranding(prev => ({ ...prev, companyLogo: settingsRes.data.company_logo }))
}
            if (settingsRes.data.company_logo_light) {
              setBranding(prev => ({ ...prev, companyLogoLight: settingsRes.data.company_logo_light }))
            }
            if (settingsRes.data.brand_color) {
              setBranding(prev => ({ ...prev, brandColor: settingsRes.data.brand_color }))
            }
            // Load QBO connection status
            if (settingsRes.data.qbo_connected_at) {
              setQboConnected(true)
              setQboConnectedAt(settingsRes.data.qbo_connected_at)
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
          
          if (projectsRes.data) {
            const mapped = projectsRes.data.map((p: any) => ({
              id: p.id,
              name: p.name,
              color: p.color || '#f97316',
              status: p.status || 'active',
              budget: p.budget,
              budgetAlertThreshold: p.budget_alert_threshold || 80,
              clientId: p.client_id,
              targetGrossMargin: p.target_gross_margin,
              startDate: p.start_date,
              endDate: p.end_date,
              createdAt: p.created_at
            }))
            setProjects(mapped)
          }
          
          // Load UI preferences from localStorage (these stay local)
          const savedTheme = localStorage.getItem(STORAGE_KEYS.theme)
          const savedChartFilters = localStorage.getItem(STORAGE_KEYS.chartFilters)
          const savedCollapsedSections = localStorage.getItem(STORAGE_KEYS.collapsedSections)
          if (savedTheme) setTheme(savedTheme as 'dark' | 'light')
          if (savedChartFilters) setChartFilters(JSON.parse(savedChartFilters))
          if (savedCollapsedSections) setCollapsedSections(new Set(JSON.parse(savedCollapsedSections)))
          
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

  useEffect(() => {
    if (isLoaded && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.collapsedSections, JSON.stringify(Array.from(collapsedSections)))
    }
  }, [collapsedSections, isLoaded])

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
                  setCategories(prev => [...prev, { id: 'travel', name: 'Travel', type: 'expense', color: '#64748b', isDefault: false }])
                }
                category = 'travel'
              } else if (rawCategory.includes('tax')) {
                // Auto-create taxes category if it doesn't exist
                if (!categories.find(c => c.id === 'taxes')) {
                  setCategories(prev => [...prev, { id: 'taxes', name: 'Taxes', type: 'expense', color: '#fb7185', isDefault: false }])
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

  // AI Chat Function
  const sendChatMessage = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return
    
    const userMessage = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }])
    setChatLoading(true)
    setPendingChatAction(null) // Clear any pending action
    
    try {
      // Build context from current data
      // Accrual-based project stats (for gross margin)
      const accrualProjectStats = projectList.map(projectName => {
        const projectTransactions = accrualTransactions.filter(t => 
          t.project.toLowerCase() === projectName.toLowerCase()
        )
        const revenue = projectTransactions
          .filter(t => t.type === 'revenue')
          .reduce((sum, t) => sum + t.amount, 0)
        const costs = projectTransactions
          .filter(t => t.type === 'direct_cost')
          .reduce((sum, t) => sum + Math.abs(t.amount), 0)
        const grossProfit = revenue - costs
        const grossMargin = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : '0'
        
        return {
          name: projectName,
          revenue,
          costs,
          grossProfit,
          grossMargin
        }
      })
      
      // Cash-based project stats (for actual cash flow)
      const cashProjectStats = projectList.map(projectName => {
        const projectTransactions = transactions.filter(t => 
          t.project && t.project.toLowerCase() === projectName.toLowerCase()
        )
        const inflows = projectTransactions
          .filter(t => t.category === 'revenue')
          .reduce((sum, t) => sum + Math.abs(t.amount), 0)
        const outflows = projectTransactions
          .filter(t => t.category === 'opex' || t.category === 'overhead' || t.category === 'investment')
          .reduce((sum, t) => sum + Math.abs(t.amount), 0)
        const netCash = inflows - outflows
        
        return {
          name: projectName,
          inflows,
          outflows,
          netCash,
          transactionCount: projectTransactions.length
        }
      })
      
      const totalRevenue = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
      const totalExpenses = transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)
      const netCashFlow = totalRevenue - totalExpenses
      const currentBalance = transactions.reduce((sum, t) => sum + t.amount, 0)
      
      const accrualRevenue = accrualTransactions.filter(t => t.type === 'revenue').reduce((sum, t) => sum + t.amount, 0)
      const accrualCosts = accrualTransactions.filter(t => t.type === 'direct_cost').reduce((sum, t) => sum + Math.abs(t.amount), 0)
      
      const context = {
        summary: `This is a project-based business with ${projectList.length} active projects and ${transactions.length} cash transactions.`,
        projects: accrualProjectStats,
        cashProjects: cashProjectStats,
        existingProjects: projectList,
        // Send ALL transactions for action mode
        allTransactions: transactions.map(t => ({
          id: t.id,
          date: t.date,
          description: t.description,
          amount: t.amount,
          category: t.category,
          project: t.project || 'none'
        })),
        recentTransactions: transactions.slice(0, 10).map(t => ({
          date: t.date,
          description: t.description,
          amount: t.amount,
          category: t.category
        })),
        metrics: {
          totalRevenue,
          totalExpenses,
          netCashFlow,
          currentBalance,
          grossMargin: totalRevenue > 0 ? ((netCashFlow / totalRevenue) * 100).toFixed(1) : 0,
          runway: netCashFlow < 0 ? Math.abs(currentBalance / (netCashFlow / 12)).toFixed(1) : 'Positive cash flow'
        },
        accrual: {
          totalInvoiced: accrualRevenue,
          totalDirectCosts: accrualCosts,
          grossProfit: accrualRevenue - accrualCosts
        }
      }
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, context, companyId })
      })
      
      if (!response.ok) {
        throw new Error('Failed to get response')
      }
      
      const data = await response.json()
      
      console.log('Chat response received:', { hasAction: !!data.action, messageLength: data.message?.length })
      
      // Check if response includes an action
      let actionData = data.action
      let messageContent = data.message
      
      // Frontend fallback: if no action but message contains vantage-action, parse it here
      if (!actionData && messageContent && messageContent.includes('vantage-action')) {
        console.log('Frontend fallback: attempting to parse action from message')
        try {
          // Find the JSON in the message
          const jsonStart = messageContent.indexOf('{')
          if (jsonStart !== -1) {
            // Try to find the end by looking for the summary field which comes last
            // Or find matching braces
            let braceCount = 0
            let jsonEnd = -1
            for (let i = jsonStart; i < messageContent.length; i++) {
              if (messageContent[i] === '{') braceCount++
              if (messageContent[i] === '}') braceCount--
              if (braceCount === 0) {
                jsonEnd = i + 1
                break
              }
            }
            
            // If we didn't find a matching end, try to fix truncated JSON
            if (jsonEnd === -1) {
              console.log('JSON appears truncated, attempting to fix...')
              // Find the updates array and try to parse what we have
              const updatesMatch = messageContent.match(/"updates"\s*:\s*\[/)
              if (updatesMatch) {
                // Find all complete update objects
                const allUpdates: any[] = []
                const updateRegex = /\{\s*"id"\s*:\s*"([^"]+)"\s*,\s*"changes"\s*:\s*\{[^}]+\}\s*,\s*"preview"\s*:\s*\{[^}]+\}\s*\}/g
                let match
                while ((match = updateRegex.exec(messageContent)) !== null) {
                  try {
                    const updateObj = JSON.parse(match[0])
                    allUpdates.push(updateObj)
                  } catch (e) {
                    // Skip malformed updates
                  }
                }
                
                if (allUpdates.length > 0) {
                  actionData = {
                    action: 'bulk_update',
                    type: 'cash',
                    updates: allUpdates,
                    summary: `Update ${allUpdates.length} transactions`
                  }
                  console.log('Recovered', allUpdates.length, 'updates from truncated JSON')
                }
              }
            } else {
              const jsonStr = messageContent.substring(jsonStart, jsonEnd)
              actionData = JSON.parse(jsonStr)
              console.log('Parsed complete JSON successfully')
            }
            
            // Clean the message - remove everything from vantage-action onwards
            if (actionData) {
              const actionIdx = messageContent.indexOf('vantage-action')
              if (actionIdx !== -1) {
                let blockStart = actionIdx
                for (let i = actionIdx - 1; i >= 0; i--) {
                  if (messageContent[i] === '`') {
                    blockStart = i
                  } else if (messageContent[i] !== '`' && messageContent[i] !== '\n' && messageContent[i] !== ' ') {
                    break
                  }
                }
                messageContent = messageContent.substring(0, blockStart).trim()
              }
            }
          }
        } catch (e) {
          console.error('Frontend fallback parsing failed:', e)
        }
      }
      
      if (actionData) {
        console.log('Action data ready:', actionData.summary, '- Updates:', actionData.updates?.length)
        setPendingChatAction(actionData)
        setChatMessages(prev => [...prev, { 
          role: 'assistant', 
          content: messageContent,
          action: actionData
        }])
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: messageContent }])
      }
    } catch (error) {
      console.error('Chat error:', error)
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }])
    } finally {
      setChatLoading(false)
    }
  }, [chatInput, chatLoading, transactions, accrualTransactions, projectList, companyId])

  // Execute pending chat action (bulk updates)
  const executeChatAction = useCallback(async () => {
    if (!pendingChatAction) return
    
    const { type, updates } = pendingChatAction
    let successCount = 0
    let errorCount = 0
    
    try {
      for (const update of updates) {
        const { id, changes } = update
        
        if (type === 'cash') {
          // Update cash transaction
          const transaction = transactions.find(t => t.id === id)
          if (transaction) {
            const updateData: any = {}
            if (changes.category) updateData.category = changes.category
            if (changes.project !== undefined) updateData.project = changes.project || null
            
            // Update local state
            setTransactions(prev => prev.map(t => 
              t.id === id ? { ...t, ...updateData } : t
            ))
            
            // Update Supabase
            if (companyId) {
              const { error } = await supabaseUpdateTransaction(id, updateData)
              if (error) {
                console.error('Error updating transaction:', error)
                errorCount++
              } else {
                successCount++
              }
            } else {
              successCount++
            }
          }
        } else if (type === 'accrual') {
          // Update accrual transaction
          const transaction = accrualTransactions.find(t => t.id === id)
          if (transaction) {
            const updateData: any = {}
            if (changes.project !== undefined) updateData.project = changes.project || null
            
            // Update local state
            setAccrualTransactions(prev => prev.map(t => 
              t.id === id ? { ...t, ...updateData } : t
            ))
            
            // Update Supabase
            if (companyId) {
              const { error } = await supabaseUpdateAccrualTransaction(id, updateData)
              if (error) {
                console.error('Error updating accrual transaction:', error)
                errorCount++
              } else {
                successCount++
              }
            } else {
              successCount++
            }
          }
        }
      }
      
      // Add confirmation message
      const resultMessage = errorCount > 0 
        ? `✅ Updated ${successCount} transactions. ⚠️ ${errorCount} failed.`
        : `✅ Successfully updated ${successCount} transactions!`
      
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: resultMessage 
      }])
      
    } catch (error) {
      console.error('Error executing chat action:', error)
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: '❌ Failed to apply changes. Please try again.' 
      }])
    } finally {
      setPendingChatAction(null)
    }
  }, [pendingChatAction, transactions, accrualTransactions, companyId])

  // Cancel pending chat action
  const cancelChatAction = useCallback(() => {
    setPendingChatAction(null)
    setChatMessages(prev => [...prev, { 
      role: 'assistant', 
      content: '🚫 Changes cancelled. No updates were made.' 
    }])
  }, [])
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

  // Quick inline categorization (no modal)
  const quickCategorize = useCallback(async (transactionId: string, category: string, project?: string) => {
    const updates: any = { category }
    if (project !== undefined) updates.project = project
    
    const { error } = await supabaseUpdateTransaction(transactionId, updates)
    if (!error) {
      setTransactions(prev => prev.map(t => 
        t.id === transactionId ? { ...t, ...updates } : t
      ))
      setExpandedTransaction(null)
    }
  }, [])

  // Bulk categorize selected transactions
  const bulkCategorizeSelected = useCallback(async () => {
    if (selectedTransactions.size === 0) return
    
    const updates: any = {}
    if (bulkCategory) updates.category = bulkCategory
    if (bulkProject) updates.project = bulkProject
    
    if (Object.keys(updates).length === 0) return
    
    // Update all selected transactions
    const promises = Array.from(selectedTransactions).map(id => 
      supabaseUpdateTransaction(id, updates)
    )
    
    await Promise.all(promises)
    
    // Update local state
    setTransactions(prev => prev.map(t => 
      selectedTransactions.has(t.id) ? { ...t, ...updates } : t
    ))
    
    // Clear selection
    setSelectedTransactions(new Set())
    setShowBulkCategorize(false)
    setBulkCategory('')
    setBulkProject('')
  }, [selectedTransactions, bulkCategory, bulkProject])

  // Toggle transaction selection
  const toggleTransactionSelection = useCallback((id: string) => {
    setSelectedTransactions(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // Select all visible transactions
  const selectAllTransactions = useCallback((transactionIds: string[]) => {
    if (selectedTransactions.size === transactionIds.length) {
      setSelectedTransactions(new Set())
    } else {
      setSelectedTransactions(new Set(transactionIds))
    }
  }, [selectedTransactions.size])

  // Find similar transactions by description pattern
  const findSimilarTransactions = useCallback((description: string) => {
    // Extract key words (remove numbers, dates, special chars)
    const keywords = description
      .replace(/[0-9]/g, '')
      .replace(/[^a-zA-Z\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 3)
    
    if (keywords.length === 0) return []
    
    return transactions.filter(t => {
      const descLower = t.description.toLowerCase()
      return keywords.some(kw => descLower.includes(kw.toLowerCase())) && !t.category
    })
  }, [transactions])

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

  // Company Settings Management
  const saveCompanySetting = useCallback(async (key: string, value: any) => {
    if (!companyId) return
    
    const settings: any = {}
    settings[key] = value
    
    const { error } = await updateCompanySettings(companyId, settings)
    if (error) {
      console.error(`Error saving ${key}:`, error)
    } else {
      console.log(`Saved ${key}:`, value)
    }
  }, [companyId])

  const handleBeginningBalanceChange = useCallback((value: number) => {
    setBeginningBalance(value)
  }, [])

  const handleBeginningBalanceBlur = useCallback(() => {
    saveCompanySetting('beginning_balance', beginningBalance)
  }, [saveCompanySetting, beginningBalance])

  const handleCutoffDateChange = useCallback((value: string) => {
    setCutoffDate(value)
    saveCompanySetting('cutoff_date', value)
  }, [saveCompanySetting])

  const handleBalanceAlertChange = useCallback((value: number) => {
    setBalanceAlertThreshold(value)
  }, [])

  const handleBalanceAlertBlur = useCallback(() => {
    saveCompanySetting('balance_alert_threshold', balanceAlertThreshold)
  }, [saveCompanySetting, balanceAlertThreshold])

  // QuickBooks Integration
  const connectQuickBooks = useCallback(() => {
    if (!companyId) {
      alert('Company not loaded yet. Please try again.')
      return
    }
    // Redirect to QBO OAuth flow
    window.location.href = `/api/qbo/connect?companyId=${companyId}`
  }, [companyId])

  const syncQuickBooks = useCallback(async (syncType: 'all' | 'transactions' | 'invoices' = 'all') => {
    if (!companyId) return
    
    setQboSyncing(true)
    try {
      const response = await fetch('/api/qbo/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, syncType })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setQboLastSync(new Date().toISOString())
        alert(`Sync complete! ${data.message}`)
        // Reload transactions
        window.location.reload()
      } else {
        alert(`Sync failed: ${data.error}`)
      }
    } catch (err) {
      console.error('QBO sync error:', err)
      alert('Sync failed. Please try again.')
    } finally {
      setQboSyncing(false)
    }
  }, [companyId])

  const disconnectQuickBooks = useCallback(async () => {
    if (!companyId) return
    if (!confirm('Are you sure you want to disconnect QuickBooks? This will not delete any synced data.')) return
    
    try {
      await saveCompanySetting('qbo_access_token', null)
      await saveCompanySetting('qbo_refresh_token', null)
      await saveCompanySetting('qbo_connected_at', null)
      setQboConnected(false)
      setQboConnectedAt(null)
    } catch (err) {
      console.error('Disconnect error:', err)
    }
  }, [companyId, saveCompanySetting])

  // Project Management
  const addProject = useCallback(async () => {
    if (!newProjectName.trim()) return
    
    const projectData = {
      name: newProjectName.trim(),
      color: PROJECT_COLORS[projects.length % PROJECT_COLORS.length],
      status: 'active' as const,
      budget: newProjectBudget !== '' ? Number(newProjectBudget) : undefined,
      budgetAlertThreshold: 80,
      clientId: newProjectClientId || undefined
    }
    
    if (companyId && user) {
      const { data, error } = await supabaseInsertProject(projectData, companyId, user.id)
      if (error) {
        alert(`Error creating project: ${error.message}`)
        return
      }
      if (data) {
        const newProject: Project = {
          id: data.id,
          name: data.name,
          color: data.color,
          status: data.status,
          budget: data.budget,
          budgetAlertThreshold: data.budget_alert_threshold,
          clientId: data.client_id,
          targetGrossMargin: data.target_gross_margin,
          startDate: data.start_date,
          endDate: data.end_date,
          createdAt: data.created_at
        }
        setProjects(prev => [...prev, newProject])
      }
    } else {
      // Fallback for local mode
      const newProject: Project = {
        id: generateId(),
        ...projectData,
        createdAt: new Date().toISOString()
      }
      setProjects(prev => [...prev, newProject])
    }
    
    setNewProjectName('')
    setNewProjectBudget('')
    setNewProjectClientId('')
    setShowProjectModal(false)
  }, [newProjectName, newProjectBudget, newProjectClientId, projects.length, companyId, user])

  const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
    // Update local state immediately for responsiveness
    setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
    setEditingProject(null)
    
    // Save to Supabase
    if (companyId) {
      const { error } = await supabaseUpdateProject(id, updates)
      if (error) {
        console.error('Error updating project:', error)
        // Could revert the local state here if needed
      }
    }
  }, [companyId])

  const deleteProject = useCallback(async (id: string) => {
    // Update local state immediately
    setProjects(prev => prev.filter(p => p.id !== id))
    
    // Delete from Supabase
    if (companyId) {
      const { error } = await supabaseDeleteProject(id)
      if (error) {
        console.error('Error deleting project:', error)
      }
    }
  }, [companyId])

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
      if (selectedProject === 'unassigned') {
        result = result.filter(t => !t.project || t.project === '')
      } else {
        result = result.filter(t => normalizeProjectName(t.project) === normalizeProjectName(selectedProject))
      }
    }
    if (transactionMonthFilter !== 'all') {
      result = result.filter(t => t.date.slice(0, 7) === transactionMonthFilter)
    }
    if (transactionCategoryFilter !== 'all') {
      if (transactionCategoryFilter === 'unassigned') {
        result = result.filter(t => !t.category || t.category === 'unassigned' || t.category === '')
      } else {
        result = result.filter(t => t.category === transactionCategoryFilter)
      }
    }
    if (sourceFilter !== 'all') {
      result = result.filter(t => (t as any).source === sourceFilter)
    }
    return result
  }, [transactions, selectedProject, transactionMonthFilter, transactionCategoryFilter, sourceFilter])

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

  // Runway calculation - based on selected date range
  const runwayData = useMemo(() => {
    // Filter transactions by the active date range
    const filteredByDateRange = transactions.filter(t => {
      if (!t.date || t.type !== 'actual') return false
      const monthKey = t.date.slice(0, 7)
      return monthKey >= activeDateRange.start && monthKey <= activeDateRange.end
    })
    
    if (filteredByDateRange.length === 0) {
      return {
        currentBalance: beginningBalance,
        avgMonthlyRevenue: 0,
        avgMonthlyExpenses: 0,
        avgMonthlyBurn: 0,
        runwayMonths: Infinity,
        status: 'healthy',
        categorizedCount: 0,
        totalRecentCount: 0,
        categorizedPercent: 100
      }
    }
    
    // Only count CATEGORIZED transactions
    const validCategories = ['revenue', 'opex', 'overhead', 'investment']
    const categorizedTransactions = filteredByDateRange.filter(t => validCategories.includes(t.category))
    const totalRecentCount = filteredByDateRange.length
    const categorizedCount = categorizedTransactions.length
    const categorizedPercent = totalRecentCount > 0 ? Math.round((categorizedCount / totalRecentCount) * 100) : 0
    
    let totalRevenue = 0
    let totalExpenses = 0
    
    categorizedTransactions.forEach(t => {
      const amount = typeof t.amount === 'number' && !isNaN(t.amount) ? t.amount : 0
      
      if (t.category === 'revenue') {
        totalRevenue += Math.abs(amount)
      } else {
        // opex, overhead, investment are all expenses
        totalExpenses += Math.abs(amount)
      }
    })
    
    // Calculate months in the selected date range
    const startDate = new Date(activeDateRange.start + '-01')
    const endDate = new Date(activeDateRange.end + '-01')
    const monthsInRange = Math.max(1, 
      (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
      (endDate.getMonth() - startDate.getMonth()) + 1
    )
    
    const avgMonthlyRevenue = totalRevenue / monthsInRange
    const avgMonthlyExpenses = totalExpenses / monthsInRange
    const avgMonthlyNet = avgMonthlyRevenue - avgMonthlyExpenses  // Net cash flow (positive = good)
    
    // Current balance from chart data - with safe access
    let currentBalance = beginningBalance
    if (chartData && chartData.length > 0) {
      const lastEntry = chartData[chartData.length - 1]
      if (lastEntry && typeof lastEntry.balance === 'number') {
        currentBalance = lastEntry.balance
      }
    }
    
    // Runway in months (only if burning cash, i.e., net is negative)
    const runwayMonths = avgMonthlyNet < 0 
      ? currentBalance / Math.abs(avgMonthlyNet) 
      : Infinity
    
    return {
      currentBalance,
      avgMonthlyRevenue,
      avgMonthlyExpenses,
      avgMonthlyBurn: avgMonthlyNet,  // Represents NET cash flow (positive = profitable)
      runwayMonths: isFinite(runwayMonths) ? runwayMonths : Infinity,
      status: avgMonthlyNet >= 0 ? 'profitable' : runwayMonths < 3 ? 'critical' : runwayMonths < 6 ? 'warning' : 'healthy',
      // New: categorization stats
      categorizedCount,
      totalRecentCount,
      categorizedPercent,
      monthsInRange
    }
  }, [transactions, chartData, beginningBalance, activeDateRange])

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
    if (runwayData.avgMonthlyBurn > 0) {
      result.push({
        type: 'positive',
        title: 'Cash Positive',
        message: `Generating ${formatCurrency(runwayData.avgMonthlyBurn)}/mo net cash`
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
      id: 'reports-section',
      label: 'Reports',
      items: [
        { id: 'reports', label: 'Standard Reports', icon: FileText },
        { id: 'report-builder', label: 'Report Builder', icon: Sparkles }
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['main', 'clients-section', 'data-section', 'forecast', 'reports-section', 'config']))

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
    : 'bg-neutral-900 text-neutral-100'

  const cardClasses = theme === 'light'
    ? 'bg-white border-gray-200 shadow-sm'
    : 'bg-neutral-800 border-neutral-700'

  const inputClasses = theme === 'light'
    ? 'bg-white border-gray-300 text-gray-900'
    : 'bg-neutral-900 border-neutral-700 text-neutral-100'

  const tableHeaderBg = theme === 'light' ? 'bg-gray-50' : 'bg-neutral-800'
  const tableBorder = theme === 'light' ? 'border-gray-200' : 'border-neutral-700'
  const textMuted = theme === 'light' ? 'text-gray-500' : 'text-neutral-400'
  const textSubtle = theme === 'light' ? 'text-gray-400' : 'text-neutral-500'

  // Auth loading screen
  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 rounded-xl bg-[#262626] flex items-center justify-center mx-auto mb-4">
            <VantageLogo size={40} />
          </div>
          <div className="text-[#f97316] animate-pulse">
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
          ${theme === 'light' ? 'bg-white border-gray-200' : 'bg-neutral-800 border-neutral-700'}
          border-r flex flex-col
        `}>
          {/* Sidebar Header */}
          <div className={`p-4 border-b ${theme === 'light' ? 'border-gray-200' : 'border-neutral-700'} relative`}>
            <div className={`flex items-center ${sidebarOpen ? 'justify-between' : 'flex-col gap-3'}`}>
              <div className={`flex items-center ${sidebarOpen ? 'gap-3' : 'justify-center w-full'}`}>
                {(branding.companyLogo || branding.companyLogoLight) ? (
                  <img 
                    src={theme === 'light' ? (branding.companyLogoLight || branding.companyLogo)! : (branding.companyLogo || branding.companyLogoLight)!} 
                    alt={branding.companyName} 
                    className={`rounded-lg object-contain ${sidebarOpen ? 'w-9 h-9' : 'w-10 h-10'}`}
                  />
                ) : (
                  <VantageLogo size={sidebarOpen ? 36 : 40} />
                )}
                {sidebarOpen && (
                  <div>
                    <h1 className="text-base font-display font-bold tracking-tight">{branding.companyName}</h1>
                    <p className={`text-xs ${textMuted}`}>Stop guessing. Start knowing.</p>
                  </div>
                )}
              </div>
              {sidebarOpen ? (
                <button
                  onClick={() => setSidebarOpen(false)}
                  className={`hidden lg:flex p-1.5 rounded-lg transition-all ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-900'}`}
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className={`hidden lg:flex p-1.5 rounded-lg transition-all w-full justify-center ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-900'}`}
                >
                  <PanelLeft className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setSidebarMobileOpen(false)}
                className={`lg:hidden p-1.5 rounded-lg transition-all absolute top-4 right-4 ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-900'}`}
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
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider ${textMuted} hover:text-neutral-300`}
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
                            if (item.id === 'report-builder') {
                              router.push('/reports/builder')
                            } else {
                              setActiveTab(item.id as typeof activeTab)
                            }
                            setSidebarMobileOpen(false)
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-1 ${
                            activeTab === item.id 
                              ? 'bg-accent-primary/15 text-accent-primary' 
                              : theme === 'light' 
                                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100' 
                                : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900'
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
          <div className={`p-3 border-t ${theme === 'light' ? 'border-gray-200' : 'border-neutral-700'}`}>
            {user && (
              <div className={`flex items-center ${sidebarOpen ? 'gap-3' : 'justify-center'}`}>
                <div className="w-8 h-8 rounded-full bg-[#f97316]/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-[#f97316]" />
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
                    className={`p-1.5 rounded-lg transition-all ${theme === 'light' ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-neutral-900 text-neutral-400'}`}
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
          <header className={`sticky top-0 z-30 border-b backdrop-blur-sm ${theme === 'light' ? 'bg-white/90 border-gray-200' : 'bg-neutral-900/90 border-neutral-700'}`}>
            <div className="px-4 sm:px-6 py-3">
              <div className="flex items-center justify-between">
                {/* Mobile menu button */}
                <button
                  onClick={() => setSidebarMobileOpen(true)}
                  className={`lg:hidden p-2 rounded-lg ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-800'}`}
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
                    className={`p-2 rounded-lg transition-all ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-800'}`}
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
                <button onClick={() => setShowQuickAdd(false)} className={`p-1 rounded ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-700'}`}>
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
                    : theme === 'light' ? 'bg-gray-100 text-gray-600' : 'bg-neutral-900 text-neutral-400'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                Cash Flow
              </button>
              <button
                onClick={() => setQuickAddForm(prev => ({ ...prev, targetType: 'accrual' }))}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  (quickAddForm as any).targetType === 'accrual'
                    ? 'bg-[#f97316] text-white'
                    : theme === 'light' ? 'bg-gray-100 text-gray-600' : 'bg-neutral-900 text-neutral-400'
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
                      theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-neutral-700 hover:bg-neutral-900'
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
                theme === 'light' ? 'bg-white' : 'bg-neutral-800 border border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Edit Transaction</h3>
                <button onClick={cancelEdit} className={`p-1 rounded ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-700'}`}>
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
                      theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-neutral-700 hover:bg-neutral-900'
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
                  <FileText className="w-5 h-5 text-[#f97316]" />
                  {accrualModalMode === 'add' ? 'Add Accrual Transaction' : 'Edit Accrual Transaction'}
                </h3>
                <button onClick={closeAccrualModal} className={`p-1 rounded ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-700'}`}>
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
                    className="flex-1 py-2 bg-[#f97316] text-white rounded-lg font-medium disabled:opacity-50 hover:bg-[#ea580c]"
                  >
                    {accrualModalMode === 'add' ? 'Add Transaction' : 'Save Changes'}
                  </button>
                  <button
                    onClick={closeAccrualModal}
                    className={`px-4 py-2 border rounded-lg ${
                      theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-neutral-700 hover:bg-neutral-900'
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
                <button onClick={() => { setShowProjectModal(false); setEditingProject(null); }} className={`p-1 rounded ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-700'}`}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Add/Edit Project Form */}
                {editingProject ? (
                  <div className={`p-4 rounded-lg border ${theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-neutral-900 border-neutral-700'}`}>
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
                          className={`px-4 py-2 rounded-lg font-medium border ${theme === 'light' ? 'border-gray-300 hover:bg-gray-100' : 'border-neutral-700 hover:bg-neutral-900'}`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`p-4 rounded-lg border ${theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-neutral-900 border-neutral-700'}`}>
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
                            <div key={projectName} className={`p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-900'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-wrap">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: projectColor }} />
                                  <span className="font-medium">{projectName}</span>
                                  {existingProject && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                                      existingProject.status === 'active' ? 'bg-[#34d399]/20 text-[#34d399]' :
                                      existingProject.status === 'completed' ? 'bg-[#f97316]/20 text-[#f97316]' :
                                      'bg-yellow-500/20 text-yellow-400'
                                    }`}>
                                      {existingProject.status}
                                    </span>
                                  )}
                                  {clientName && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full bg-[#f97316]/20 text-[#f97316]`}>
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
                                  <div className={`h-2 rounded-full ${theme === 'light' ? 'bg-gray-200' : 'bg-neutral-700'}`}>
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
                <button onClick={() => { setShowClientModal(false); setEditingClient(null); setNewClientForm({ name: '', status: 'active' }); }} className={`p-1 rounded ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-700'}`}>
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
                        className={`px-4 py-2 rounded-lg font-medium border ${theme === 'light' ? 'border-gray-300 hover:bg-gray-100' : 'border-neutral-700 hover:bg-neutral-900'}`}
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
                <button onClick={() => setShowPdfExport(false)} className={`p-1 rounded ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-700'}`}>
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
                    theme === 'light' ? 'hover:bg-gray-50' : 'hover:bg-neutral-900'
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
                    theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-neutral-700 hover:bg-neutral-900'
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

      {/* Report Modals */}
      <AnimatePresence>

        {/* Monthly P&L Report Modal */}
        {activeReport === 'monthly-pl' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setActiveReport(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-xl border ${cardClasses}`}
            >
              <div className={`p-4 border-b ${theme === 'light' ? 'border-gray-200' : 'border-neutral-700'} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#34d399]/20 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5 text-[#34d399]" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Monthly P&L Report</h3>
                    <p className={`text-sm ${textMuted}`}>Profit & Loss by Month</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {/* Export PDF */}}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200' : 'bg-neutral-800 hover:bg-neutral-700'}`}
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                  <button onClick={() => setActiveReport(null)} className={`p-1.5 rounded-lg ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-800'}`}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
                {/* Date Range Selector */}
                <div className="flex items-center gap-4 mb-6">
                  <select
                    value={reportDateRange.start || new Date().getFullYear().toString()}
                    onChange={(e) => setReportDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className={`px-3 py-2 rounded-lg border text-sm ${inputClasses}`}
                  >
                    {[2023, 2024, 2025].map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                {/* P&L Table */}
                <div className={`rounded-lg border overflow-hidden ${theme === 'light' ? 'border-gray-200' : 'border-neutral-700'}`}>
                  <table className="w-full text-sm">
                    <thead className={tableHeaderBg}>
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Category</th>
                        {Array.from({ length: 12 }, (_, i) => {
                          const date = new Date(parseInt(reportDateRange.start) || new Date().getFullYear(), i)
                          return (
                            <th key={i} className="px-3 py-3 text-right font-semibold">
                              {date.toLocaleDateString('en-US', { month: 'short' })}
                            </th>
                          )
                        })}
                        <th className="px-4 py-3 text-right font-semibold bg-opacity-50">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Revenue Row */}
                      <tr className={`border-b ${tableBorder}`}>
                        <td className="px-4 py-3 font-medium text-[#34d399]">Revenue</td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const monthStr = `${parseInt(reportDateRange.start) || new Date().getFullYear()}-${String(i + 1).padStart(2, '0')}`
                          const monthRevenue = transactions
                            .filter(t => t.date.startsWith(monthStr) && t.category === 'revenue' && t.type === 'actual')
                            .reduce((sum, t) => sum + t.amount, 0)
                          return (
                            <td key={i} className="px-3 py-3 text-right font-mono">{formatCurrency(monthRevenue)}</td>
                          )
                        })}
                        <td className="px-4 py-3 text-right font-mono font-semibold text-[#34d399]">
                          {formatCurrency(transactions
                            .filter(t => t.date.startsWith(String(parseInt(reportDateRange.start) || new Date().getFullYear())) && t.category === 'revenue' && t.type === 'actual')
                            .reduce((sum, t) => sum + t.amount, 0))}
                        </td>
                      </tr>
                      {/* OpEx Row */}
                      <tr className={`border-b ${tableBorder}`}>
                        <td className="px-4 py-3 font-medium text-[#fb7185]">Operating Expenses</td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const monthStr = `${parseInt(reportDateRange.start) || new Date().getFullYear()}-${String(i + 1).padStart(2, '0')}`
                          const monthOpex = transactions
                            .filter(t => t.date.startsWith(monthStr) && t.category === 'opex' && t.type === 'actual')
                            .reduce((sum, t) => sum + Math.abs(t.amount), 0)
                          return (
                            <td key={i} className="px-3 py-3 text-right font-mono">{formatCurrency(monthOpex)}</td>
                          )
                        })}
                        <td className="px-4 py-3 text-right font-mono font-semibold text-[#fb7185]">
                          {formatCurrency(Math.abs(transactions
                            .filter(t => t.date.startsWith(String(parseInt(reportDateRange.start) || new Date().getFullYear())) && t.category === 'opex' && t.type === 'actual')
                            .reduce((sum, t) => sum + t.amount, 0)))}
                        </td>
                      </tr>
                      {/* Overhead Row */}
                      <tr className={`border-b ${tableBorder}`}>
                        <td className="px-4 py-3 font-medium text-[#fbbf24]">Overhead</td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const monthStr = `${parseInt(reportDateRange.start) || new Date().getFullYear()}-${String(i + 1).padStart(2, '0')}`
                          const monthOH = transactions
                            .filter(t => t.date.startsWith(monthStr) && t.category === 'overhead' && t.type === 'actual')
                            .reduce((sum, t) => sum + Math.abs(t.amount), 0)
                          return (
                            <td key={i} className="px-3 py-3 text-right font-mono">{formatCurrency(monthOH)}</td>
                          )
                        })}
                        <td className="px-4 py-3 text-right font-mono font-semibold text-[#fbbf24]">
                          {formatCurrency(Math.abs(transactions
                            .filter(t => t.date.startsWith(String(parseInt(reportDateRange.start) || new Date().getFullYear())) && t.category === 'overhead' && t.type === 'actual')
                            .reduce((sum, t) => sum + t.amount, 0)))}
                        </td>
                      </tr>
                      {/* Net Income Row */}
                      <tr className={`${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-800'}`}>
                        <td className="px-4 py-3 font-semibold">Net Income</td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const monthStr = `${parseInt(reportDateRange.start) || new Date().getFullYear()}-${String(i + 1).padStart(2, '0')}`
                          const monthNet = transactions
                            .filter(t => t.date.startsWith(monthStr) && t.type === 'actual')
                            .reduce((sum, t) => sum + t.amount, 0)
                          return (
                            <td key={i} className={`px-3 py-3 text-right font-mono font-semibold ${monthNet >= 0 ? 'text-[#34d399]' : 'text-[#fb7185]'}`}>
                              {formatCurrency(monthNet)}
                            </td>
                          )
                        })}
                        <td className="px-4 py-3 text-right font-mono font-bold text-[#2dd4bf]">
                          {formatCurrency(transactions
                            .filter(t => t.date.startsWith(String(parseInt(reportDateRange.start) || new Date().getFullYear())) && t.type === 'actual')
                            .reduce((sum, t) => sum + t.amount, 0))}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Project Profitability Report Modal */}
        {activeReport === 'project-profitability' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setActiveReport(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-xl border ${cardClasses}`}
            >
              <div className={`p-4 border-b ${theme === 'light' ? 'border-gray-200' : 'border-neutral-700'} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#f97316]/20 flex items-center justify-center">
                    <Target className="w-5 h-5 text-[#f97316]" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Project Profitability Report</h3>
                    <p className={`text-sm ${textMuted}`}>Margins and Performance by Project</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200' : 'bg-neutral-800 hover:bg-neutral-700'}`}>
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                  <button onClick={() => setActiveReport(null)} className={`p-1.5 rounded-lg ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-800'}`}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
                {/* Project Cards */}
                <div className="space-y-4">
                  {projects.filter(p => p.status === 'active').map(project => {
                    const projectRevenue = accrualTransactions
                      .filter(t => normalizeProjectName(t.project) === normalizeProjectName(project.name) && t.type === 'revenue')
                      .reduce((sum, t) => sum + t.amount, 0)
                    const projectCosts = Math.abs(accrualTransactions
                      .filter(t => normalizeProjectName(t.project) === normalizeProjectName(project.name) && t.type === 'direct_cost')
                      .reduce((sum, t) => sum + t.amount, 0))
                    const grossProfit = projectRevenue - projectCosts
                    const margin = projectRevenue > 0 ? (grossProfit / projectRevenue) * 100 : 0

                    return (
                      <div key={project.id} className={`p-4 rounded-lg border ${theme === 'light' ? 'border-gray-200' : 'border-neutral-700'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
                            <span className="font-semibold">{project.name}</span>
                          </div>
                          <span className={`text-lg font-bold ${margin >= 30 ? 'text-[#34d399]' : margin >= 15 ? 'text-[#fbbf24]' : 'text-[#fb7185]'}`}>
                            {margin.toFixed(1)}% GM
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <p className={`text-xs ${textMuted}`}>Revenue</p>
                            <p className="text-lg font-semibold text-[#34d399]">{formatCurrency(projectRevenue)}</p>
                          </div>
                          <div>
                            <p className={`text-xs ${textMuted}`}>Costs</p>
                            <p className="text-lg font-semibold text-[#fb7185]">{formatCurrency(projectCosts)}</p>
                          </div>
                          <div>
                            <p className={`text-xs ${textMuted}`}>Gross Profit</p>
                            <p className={`text-lg font-semibold ${grossProfit >= 0 ? 'text-[#2dd4bf]' : 'text-[#fb7185]'}`}>{formatCurrency(grossProfit)}</p>
                          </div>
                        </div>
                        {/* Margin Bar */}
                        <div className={`mt-3 h-2 rounded-full overflow-hidden ${theme === 'light' ? 'bg-gray-200' : 'bg-neutral-700'}`}>
                          <div 
                            className="h-full rounded-full transition-all"
                            style={{ 
                              width: `${Math.min(margin, 100)}%`,
                              backgroundColor: margin >= 30 ? '#34d399' : margin >= 15 ? '#fbbf24' : '#fb7185'
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                  {projects.filter(p => p.status === 'active').length === 0 && (
                    <p className={`text-center py-8 ${textMuted}`}>No active projects found</p>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Client Revenue Report Modal */}
        {activeReport === 'client-revenue' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setActiveReport(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-xl border ${cardClasses}`}
            >
              <div className={`p-4 border-b ${theme === 'light' ? 'border-gray-200' : 'border-neutral-700'} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#60a5fa]/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#60a5fa]" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Client Revenue Report</h3>
                    <p className={`text-sm ${textMuted}`}>Revenue by Client</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200' : 'bg-neutral-800 hover:bg-neutral-700'}`}>
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                  <button onClick={() => setActiveReport(null)} className={`p-1.5 rounded-lg ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-800'}`}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
                {/* Client Table */}
                <div className={`rounded-lg border overflow-hidden ${theme === 'light' ? 'border-gray-200' : 'border-neutral-700'}`}>
                  <table className="w-full text-sm">
                    <thead className={tableHeaderBg}>
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Client</th>
                        <th className="px-4 py-3 text-right font-semibold">Revenue</th>
                        <th className="px-4 py-3 text-right font-semibold">Costs</th>
                        <th className="px-4 py-3 text-right font-semibold">Gross Margin</th>
                        <th className="px-4 py-3 text-left font-semibold">Projects</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.filter(c => c.status === 'active').map(client => {
                        const clientProjects = projects.filter(p => p.clientId === client.id)
                        const clientProjectNames = clientProjects.map(p => normalizeProjectName(p.name))
                        const clientRevenue = accrualTransactions
                          .filter(t => clientProjectNames.includes(normalizeProjectName(t.project)) && t.type === 'revenue')
                          .reduce((sum, t) => sum + t.amount, 0)
                        const clientCosts = Math.abs(accrualTransactions
                          .filter(t => clientProjectNames.includes(normalizeProjectName(t.project)) && t.type === 'direct_cost')
                          .reduce((sum, t) => sum + t.amount, 0))
                        const margin = clientRevenue > 0 ? ((clientRevenue - clientCosts) / clientRevenue) * 100 : 0

                        return (
                          <tr key={client.id} className={`border-b ${tableBorder}`}>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-[#60a5fa]/20 flex items-center justify-center text-[#60a5fa] font-semibold text-xs">
                                  {client.name.charAt(0)}
                                </div>
                                <span className="font-medium">{client.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-[#34d399]">{formatCurrency(clientRevenue)}</td>
                            <td className="px-4 py-3 text-right font-mono text-[#fb7185]">{formatCurrency(clientCosts)}</td>
                            <td className={`px-4 py-3 text-right font-semibold ${margin >= 30 ? 'text-[#34d399]' : margin >= 15 ? 'text-[#fbbf24]' : 'text-[#fb7185]'}`}>
                              {margin.toFixed(1)}%
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {clientProjects.slice(0, 3).map(p => (
                                  <span key={p.id} className={`px-2 py-0.5 rounded text-xs ${theme === 'light' ? 'bg-gray-100' : 'bg-neutral-800'}`}>
                                    {p.name}
                                  </span>
                                ))}
                                {clientProjects.length > 3 && (
                                  <span className={`px-2 py-0.5 rounded text-xs ${textMuted}`}>+{clientProjects.length - 3}</span>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Cash Flow Statement Modal */}
        {activeReport === 'cash-flow' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setActiveReport(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-xl border ${cardClasses}`}
            >
              <div className={`p-4 border-b ${theme === 'light' ? 'border-gray-200' : 'border-neutral-700'} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#2dd4bf]/20 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-[#2dd4bf]" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Cash Flow Statement</h3>
                    <p className={`text-sm ${textMuted}`}>Cash Movement Summary</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200' : 'bg-neutral-800 hover:bg-neutral-700'}`}>
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                  <button onClick={() => setActiveReport(null)} className={`p-1.5 rounded-lg ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-800'}`}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
                {(() => {
                  const actualTxs = transactions.filter(t => t.type === 'actual')
                  const totalInflows = actualTxs.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
                  const totalOutflows = Math.abs(actualTxs.filter(t => t.amount < 0).reduce((sum, t) => sum + t.amount, 0))
                  const netCashFlow = totalInflows - totalOutflows
                  const endingBalance = beginningBalance + netCashFlow

                  return (
                    <div className="space-y-6">
                      {/* Summary Cards */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className={`p-4 rounded-lg ${theme === 'light' ? 'bg-green-50' : 'bg-[#34d399]/10'}`}>
                          <p className={`text-sm ${textMuted}`}>Total Inflows</p>
                          <p className="text-2xl font-bold text-[#34d399]">{formatCurrency(totalInflows)}</p>
                        </div>
                        <div className={`p-4 rounded-lg ${theme === 'light' ? 'bg-red-50' : 'bg-[#fb7185]/10'}`}>
                          <p className={`text-sm ${textMuted}`}>Total Outflows</p>
                          <p className="text-2xl font-bold text-[#fb7185]">{formatCurrency(totalOutflows)}</p>
                        </div>
                      </div>

                      {/* Cash Flow Statement */}
                      <div className={`rounded-lg border ${theme === 'light' ? 'border-gray-200' : 'border-neutral-700'}`}>
                        <div className={`px-4 py-3 border-b ${theme === 'light' ? 'border-gray-200 bg-gray-50' : 'border-neutral-700 bg-neutral-800'}`}>
                          <span className="font-semibold">Cash Flow Statement</span>
                        </div>
                        <div className="divide-y divide-neutral-700">
                          <div className="px-4 py-3 flex justify-between">
                            <span>Beginning Balance</span>
                            <span className="font-mono font-semibold">{formatCurrency(beginningBalance)}</span>
                          </div>
                          <div className="px-4 py-3 flex justify-between text-[#34d399]">
                            <span>+ Cash Inflows (Revenue)</span>
                            <span className="font-mono font-semibold">{formatCurrency(totalInflows)}</span>
                          </div>
                          <div className="px-4 py-3 flex justify-between text-[#fb7185]">
                            <span>- Cash Outflows (Expenses)</span>
                            <span className="font-mono font-semibold">({formatCurrency(totalOutflows)})</span>
                          </div>
                          <div className={`px-4 py-3 flex justify-between ${netCashFlow >= 0 ? 'text-[#2dd4bf]' : 'text-[#fb7185]'}`}>
                            <span className="font-semibold">= Net Cash Flow</span>
                            <span className="font-mono font-bold">{formatCurrency(netCashFlow)}</span>
                          </div>
                          <div className={`px-4 py-3 flex justify-between ${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-800'}`}>
                            <span className="font-semibold">Ending Balance</span>
                            <span className="font-mono font-bold text-[#60a5fa]">{formatCurrency(endingBalance)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Breakdown by Category */}
                      <div>
                        <h4 className="font-semibold mb-3">Outflows by Category</h4>
                        <div className="space-y-2">
                          {['opex', 'overhead', 'investment'].map(cat => {
                            const catTotal = Math.abs(actualTxs.filter(t => t.category === cat && t.amount < 0).reduce((sum, t) => sum + t.amount, 0))
                            const pct = totalOutflows > 0 ? (catTotal / totalOutflows) * 100 : 0
                            const colors: Record<string, string> = { opex: '#fb7185', overhead: '#fbbf24', investment: '#60a5fa' }
                            return (
                              <div key={cat} className="flex items-center gap-3">
                                <span className={`w-20 text-sm capitalize ${textMuted}`}>{cat}</span>
                                <div className={`flex-1 h-3 rounded-full overflow-hidden ${theme === 'light' ? 'bg-gray-200' : 'bg-neutral-700'}`}>
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: colors[cat] }} />
                                </div>
                                <span className="w-24 text-right font-mono text-sm">{formatCurrency(catTotal)}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Quarterly Comparison Report Modal */}
        {activeReport === 'quarterly-comparison' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setActiveReport(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-xl border ${cardClasses}`}
            >
              <div className={`p-4 border-b ${theme === 'light' ? 'border-gray-200' : 'border-neutral-700'} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#fbbf24]/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-[#fbbf24]" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Quarterly Comparison</h3>
                    <p className={`text-sm ${textMuted}`}>Compare Performance Across Quarters</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200' : 'bg-neutral-800 hover:bg-neutral-700'}`}>
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                  <button onClick={() => setActiveReport(null)} className={`p-1.5 rounded-lg ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-800'}`}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
                {(() => {
                  const currentYear = new Date().getFullYear()
                  const getQuarterData = (year: number, quarter: number) => {
                    const startMonth = (quarter - 1) * 3 + 1
                    const months = [startMonth, startMonth + 1, startMonth + 2].map(m => 
                      `${year}-${String(m).padStart(2, '0')}`
                    )
                    const qTxs = transactions.filter(t => 
                      t.type === 'actual' && months.some(m => t.date.startsWith(m))
                    )
                    return {
                      revenue: qTxs.filter(t => t.category === 'revenue').reduce((s, t) => s + t.amount, 0),
                      expenses: Math.abs(qTxs.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0)),
                      net: qTxs.reduce((s, t) => s + t.amount, 0)
                    }
                  }

                  const quarters = [
                    { label: 'Q1 2024', data: getQuarterData(2024, 1) },
                    { label: 'Q2 2024', data: getQuarterData(2024, 2) },
                    { label: 'Q3 2024', data: getQuarterData(2024, 3) },
                    { label: 'Q4 2024', data: getQuarterData(2024, 4) },
                    { label: 'Q1 2025', data: getQuarterData(2025, 1) },
                  ]

                  return (
                    <div>
                      {/* Comparison Table */}
                      <div className={`rounded-lg border overflow-hidden ${theme === 'light' ? 'border-gray-200' : 'border-neutral-700'}`}>
                        <table className="w-full text-sm">
                          <thead className={tableHeaderBg}>
                            <tr>
                              <th className="px-4 py-3 text-left font-semibold">Metric</th>
                              {quarters.map(q => (
                                <th key={q.label} className="px-4 py-3 text-right font-semibold">{q.label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            <tr className={`border-b ${tableBorder}`}>
                              <td className="px-4 py-3 font-medium">Revenue</td>
                              {quarters.map(q => (
                                <td key={q.label} className="px-4 py-3 text-right font-mono text-[#34d399]">
                                  {formatCurrency(q.data.revenue)}
                                </td>
                              ))}
                            </tr>
                            <tr className={`border-b ${tableBorder}`}>
                              <td className="px-4 py-3 font-medium">Expenses</td>
                              {quarters.map(q => (
                                <td key={q.label} className="px-4 py-3 text-right font-mono text-[#fb7185]">
                                  {formatCurrency(q.data.expenses)}
                                </td>
                              ))}
                            </tr>
                            <tr className={`${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-800'}`}>
                              <td className="px-4 py-3 font-semibold">Net Income</td>
                              {quarters.map(q => (
                                <td key={q.label} className={`px-4 py-3 text-right font-mono font-semibold ${q.data.net >= 0 ? 'text-[#2dd4bf]' : 'text-[#fb7185]'}`}>
                                  {formatCurrency(q.data.net)}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Visual Chart */}
                      <div className="mt-6">
                        <h4 className="font-semibold mb-4">Revenue vs Expenses Trend</h4>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={quarters.map(q => ({ name: q.label, revenue: q.data.revenue, expenses: q.data.expenses }))}>
                              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e5e7eb' : '#333333'} />
                              <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke={theme === 'light' ? '#6b7280' : '#9ca3af'} />
                              <YAxis tick={{ fontSize: 12 }} stroke={theme === 'light' ? '#6b7280' : '#9ca3af'} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: theme === 'light' ? '#fff' : '#1e1e1e', 
                                  border: `1px solid ${theme === 'light' ? '#e5e7eb' : '#333333'}`,
                                  borderRadius: '8px'
                                }}
                                formatter={(value: number) => formatCurrency(value)}
                              />
                              <Bar dataKey="revenue" name="Revenue" fill="#34d399" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="expenses" name="Expenses" fill="#fb7185" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>
                  )
                })()}
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
                <button onClick={() => setShowPrivacyModal(false)} className={`p-1 rounded ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-700'}`}>
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
              
              <div className="mt-6 pt-4 border-t border-neutral-700">
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
                <button onClick={() => setShowTermsModal(false)} className={`p-1 rounded ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-700'}`}>
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
              
              <div className="mt-6 pt-4 border-t border-neutral-700">
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
              <div className={`p-4 border-b ${theme === 'light' ? 'border-gray-200' : 'border-neutral-700'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-accent-primary" />
                    <h3 className="text-lg font-semibold">AI Categorization Preview</h3>
                    <span className={`text-sm px-2 py-0.5 rounded-full ${theme === 'light' ? 'bg-gray-100' : 'bg-neutral-900'} ${textMuted}`}>
                      {aiSuggestions.filter(s => s.accepted).length} of {aiSuggestions.length} selected
                    </span>
                  </div>
                  <button onClick={() => setShowAiPreview(false)} className={`p-1 rounded ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-700'}`}>
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
                  <thead className={`sticky top-0 ${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-800'}`}>
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
                        className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-neutral-700/50'} ${!suggestion.accepted ? 'opacity-50' : ''}`}
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
                            suggestion.confidence >= 80 ? 'bg-[#34d399]/20 text-[#34d399]' :
                            suggestion.confidence >= 60 ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-[#fb7185]/20 text-[#fb7185]'
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
              <div className={`p-4 border-t ${theme === 'light' ? 'border-gray-200' : 'border-neutral-700'} flex items-center justify-between`}>
                <div className={`text-sm ${textMuted}`}>
                  <Sparkles className="w-4 h-4 inline mr-1" />
                  AI suggestions - review and adjust before importing
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowAiPreview(false)}
                    className={`px-4 py-2 rounded-lg font-medium border ${theme === 'light' ? 'border-gray-300 hover:bg-gray-100' : 'border-neutral-700 hover:bg-neutral-900'}`}
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

      {/* Bank Statement Preview Modal */}
      <AnimatePresence>
        {showStatementPreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowStatementPreview(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-5xl max-h-[85vh] rounded-xl border overflow-hidden flex flex-col ${cardClasses}`}
            >
              {/* Header */}
              <div className={`p-4 border-b ${theme === 'light' ? 'border-gray-200' : 'border-neutral-700'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-[#64748b]" />
                    <h3 className="text-lg font-semibold">Bank Statement Extraction</h3>
                    <span className={`text-sm px-2 py-0.5 rounded-full ${theme === 'light' ? 'bg-[#262626] text-[#f97316]' : 'bg-[#64748b]/20 text-[#f97316]'}`}>
                      {statementData.length} transactions found
                    </span>
                  </div>
                  <button onClick={() => setShowStatementPreview(false)} className={`p-1 rounded ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-700'}`}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {statementInfo && (statementInfo.bank_name || statementInfo.account_ending) && (
                  <div className={`mt-2 text-sm ${textMuted}`}>
                    {statementInfo.bank_name && <span>{statementInfo.bank_name}</span>}
                    {statementInfo.account_ending && <span> • Account ending {statementInfo.account_ending}</span>}
                    {statementInfo.statement_period && <span> • {statementInfo.statement_period}</span>}
                  </div>
                )}
              </div>
              
              {/* Table */}
              <div className="flex-1 overflow-auto p-4">
                <table className="w-full text-sm">
                  <thead className={`sticky top-0 ${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-800'}`}>
                    <tr className={`border-b ${tableBorder} text-left ${textMuted}`}>
                      <th className="pb-3 px-2">
                        <input
                          type="checkbox"
                          checked={statementData.every(s => s.accepted !== false)}
                          onChange={(e) => setStatementData(prev => prev.map(s => ({ ...s, accepted: e.target.checked })))}
                          className="rounded"
                        />
                      </th>
                      <th className="pb-3 px-2 font-medium">Date</th>
                      <th className="pb-3 px-2 font-medium">Description</th>
                      <th className="pb-3 px-2 font-medium">Vendor</th>
                      <th className="pb-3 px-2 font-medium text-right">Amount</th>
                      <th className="pb-3 px-2 font-medium">Type</th>
                      <th className="pb-3 px-2 font-medium">Category</th>
                      <th className="pb-3 px-2 font-medium">Project</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementData.map((tx, index) => (
                      <tr 
                        key={tx.id || index} 
                        className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-neutral-700/50'} ${tx.accepted === false ? 'opacity-50' : ''}`}
                      >
                        <td className="py-3 px-2">
                          <input
                            type="checkbox"
                            checked={tx.accepted !== false}
                            onChange={() => setStatementData(prev => prev.map((s, i) => i === index ? { ...s, accepted: s.accepted === false ? true : false } : s))}
                            className="rounded"
                          />
                        </td>
                        <td className="py-3 px-2 font-mono text-xs">
                          <input
                            type="date"
                            value={tx.date}
                            onChange={(e) => setStatementData(prev => prev.map((s, i) => i === index ? { ...s, date: e.target.value } : s))}
                            className={`w-28 px-1 py-0.5 rounded text-xs border ${inputClasses}`}
                            style={{ colorScheme: theme }}
                          />
                        </td>
                        <td className="py-3 px-2 max-w-xs">
                          <input
                            type="text"
                            value={tx.description}
                            onChange={(e) => setStatementData(prev => prev.map((s, i) => i === index ? { ...s, description: e.target.value } : s))}
                            className={`w-full px-2 py-0.5 rounded text-xs border ${inputClasses}`}
                            style={{ colorScheme: theme }}
                          />
                        </td>
                        <td className="py-3 px-2">
                          <input
                            type="text"
                            value={tx.vendor || ''}
                            onChange={(e) => setStatementData(prev => prev.map((s, i) => i === index ? { ...s, vendor: e.target.value } : s))}
                            className={`w-24 px-2 py-0.5 rounded text-xs border ${inputClasses}`}
                            style={{ colorScheme: theme }}
                            placeholder="Vendor"
                          />
                        </td>
                        <td className={`py-3 px-2 text-right`}>
                          <input
                            type="number"
                            value={tx.amount}
                            onChange={(e) => setStatementData(prev => prev.map((s, i) => i === index ? { ...s, amount: parseFloat(e.target.value) || 0 } : s))}
                            className={`w-24 px-2 py-0.5 rounded text-xs border text-right font-mono ${inputClasses} ${tx.type === 'credit' ? 'text-accent-primary' : 'text-accent-danger'}`}
                            style={{ colorScheme: theme }}
                          />
                        </td>
                        <td className="py-3 px-2">
                          <select
                            value={tx.type}
                            onChange={(e) => setStatementData(prev => prev.map((s, i) => i === index ? { ...s, type: e.target.value } : s))}
                            className={`w-20 px-1 py-0.5 rounded text-xs border ${inputClasses}`}
                            style={{ colorScheme: theme }}
                          >
                            <option value="credit">Credit</option>
                            <option value="debit">Debit</option>
                          </select>
                        </td>
                        <td className="py-3 px-2">
                          <select
                            value={tx.category_suggestion || 'opex'}
                            onChange={(e) => setStatementData(prev => prev.map((s, i) => i === index ? { ...s, category_suggestion: e.target.value } : s))}
                            className={`w-24 px-1 py-0.5 rounded text-xs border ${inputClasses}`}
                            style={{ colorScheme: theme }}
                          >
                            {categories.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-2">
                          <select
                            value={tx.project || ''}
                            onChange={(e) => setStatementData(prev => prev.map((s, i) => i === index ? { ...s, project: e.target.value } : s))}
                            className={`w-24 px-1 py-0.5 rounded text-xs border ${inputClasses}`}
                            style={{ colorScheme: theme }}
                          >
                            <option value="">No project</option>
                            {projectList.map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Footer */}
              <div className={`p-4 border-t ${theme === 'light' ? 'border-gray-200' : 'border-neutral-700'} flex items-center justify-between`}>
                <div className={`text-sm ${textMuted}`}>
                  {statementData.filter(s => s.accepted !== false).length} transactions will be imported to Cash Flow
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowStatementPreview(false)
                      setStatementData([])
                    }}
                    className={`px-4 py-2 rounded-lg font-medium ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200' : 'bg-neutral-900 hover:bg-neutral-800'}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const toImport = statementData.filter(s => s.accepted !== false)
                      if (toImport.length === 0) {
                        alert('No transactions selected')
                        return
                      }
                      
                      // Convert to Cash Flow transaction format
                      const newTransactions = toImport.map(tx => ({
                        id: generateId(),
                        date: tx.date,
                        category: tx.category_suggestion || 'opex',
                        description: tx.description,
                        amount: tx.type === 'credit' ? Math.abs(tx.amount) : -Math.abs(tx.amount),
                        type: 'actual' as const,
                        project: tx.project || ''
                      }))
                      
                      // Add to transactions (Supabase)
                      if (companyId && user) {
                        try {
                          await bulkInsertTransactions(newTransactions, companyId, user.id)
                          setTransactions(prev => [...prev, ...newTransactions])
                          setShowStatementPreview(false)
                          setStatementData([])
                          alert(`Successfully imported ${newTransactions.length} transactions!`)
                        } catch (error) {
                          console.error('Error importing transactions:', error)
                          alert('Error importing transactions. Please try again.')
                        }
                      } else {
                        // Fallback to local storage
                        setTransactions(prev => [...prev, ...newTransactions])
                        setShowStatementPreview(false)
                        setStatementData([])
                        alert(`Successfully imported ${newTransactions.length} transactions!`)
                      }
                    }}
                    disabled={statementData.filter(s => s.accepted !== false).length === 0}
                    className="px-4 py-2 bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white rounded-lg font-medium hover:from-[#ea580c] hover:to-[#c2410c] disabled:opacity-50 flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Import {statementData.filter(s => s.accepted !== false).length} to Cash Flow
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
                        ? 'bg-[#f97316]/10 text-[#f97316] border-[#f97316]/30'
                        : 'bg-[#f97316]/10 text-[#f97316] border-amber-500/30'
                  }`}
                  style={{ colorScheme: theme }}
                >
                  <option value="cash">Cash Flow</option>
                  <option value="accrual">Accrual (GM)</option>
                  <option value="comparison">Comparison</option>
                </select>
                
                <div className={`hidden sm:block w-px h-6 ${theme === 'light' ? 'bg-gray-300' : 'bg-neutral-700'}`} />
                
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
                      theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-neutral-700 hover:bg-neutral-900'
                    }`}
                    title="Manage Projects"
                  >
                    <FolderPlus className="w-4 h-4" />
                  </button>
                </div>
                
                <div className={`hidden sm:block w-px h-6 ${theme === 'light' ? 'bg-gray-300' : 'bg-neutral-700'}`} />
                
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
                            : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-700'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                  
                  {/* Custom Date Range Inputs */}
                  {dateRangePreset === 'custom' && (
                    <div className="flex items-center gap-2 ml-2 pl-2 border-l border-neutral-700">
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
                  runwayData.avgMonthlyBurn >= 0
                    ? 'border-accent-primary bg-accent-primary/5'
                    : runwayData.status === 'critical' 
                    ? 'border-accent-danger bg-accent-danger/5' 
                    : runwayData.status === 'warning'
                    ? 'border-accent-warning bg-accent-warning/5'
                    : `border-accent-secondary/50 ${theme === 'light' ? 'bg-white' : 'bg-neutral-800'}`
                } col-span-2 lg:col-span-1`}>
                  <div className={`flex items-center gap-2 text-xs sm:text-sm mb-2 ${textMuted}`}>
                    <TrendingUp className="w-4 h-4" />
                    Monthly Cash Flow
                  </div>
                  <div className={`text-xl sm:text-2xl font-mono font-bold ${
                    runwayData.avgMonthlyBurn >= 0 ? 'text-accent-primary' :
                    runwayData.status === 'critical' ? 'text-accent-danger' :
                    runwayData.status === 'warning' ? 'text-accent-warning' : 'text-accent-danger'
                  }`}>
                    {runwayData.avgMonthlyBurn >= 0 
                      ? `+${formatCurrency(runwayData.avgMonthlyBurn)}`
                      : formatCurrency(runwayData.avgMonthlyBurn)}
                  </div>
                  <div className={`text-xs mt-1 flex items-center gap-1 ${
                    runwayData.avgMonthlyBurn >= 0 ? 'text-accent-primary' :
                    runwayData.status === 'critical' ? 'text-accent-danger' :
                    runwayData.status === 'warning' ? 'text-accent-warning' : textSubtle
                  }`}>
                    {runwayData.avgMonthlyBurn >= 0 
                      ? <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Cash Positive</span>
                      : `${runwayData.runwayMonths.toFixed(1)} months runway`}
                  </div>
                  {/* Categorization indicator */}
                  {runwayData.categorizedPercent < 100 && runwayData.totalRecentCount > 0 && (
                    <div className={`text-[10px] mt-2 pt-2 border-t ${theme === 'light' ? 'border-gray-200' : 'border-neutral-700'} ${textMuted}`}>
                      Based on {runwayData.categorizedPercent}% categorized ({runwayData.categorizedCount}/{runwayData.totalRecentCount})
                    </div>
                  )}
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
                      <div className={`flex rounded-lg overflow-hidden border ${theme === 'light' ? 'border-gray-300' : 'border-neutral-700'}`}>
                        <button
                          onClick={() => setTimeView('monthly')}
                          className={`px-2 py-1 text-xs font-medium transition-all ${
                            timeView === 'monthly'
                              ? 'bg-accent-primary text-white'
                              : theme === 'light' ? 'bg-gray-50 text-gray-600' : 'bg-neutral-900 text-neutral-400'
                          }`}
                        >
                          Monthly
                        </button>
                        <button
                          onClick={() => setTimeView('weekly')}
                          className={`px-2 py-1 text-xs font-medium transition-all ${
                            timeView === 'weekly'
                              ? 'bg-accent-primary text-white'
                              : theme === 'light' ? 'bg-gray-50 text-gray-600' : 'bg-neutral-900 text-neutral-400'
                          }`}
                        >
                          Weekly
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { key: 'revenue', label: 'Rev', color: '#34d399' },
                        { key: 'opex', label: 'OpEx', color: '#fb7185' },
                        { key: 'overhead', label: 'OH', color: '#f97316' },
                        { key: 'investment', label: 'Inv', color: '#64748b' },
                        { key: 'net', label: 'Net', color: '#22d3ee' },
                      ].map(f => (
                        <button
                          key={f.key}
                          onClick={() => setChartFilters(prev => ({ ...prev, [f.key]: !prev[f.key as keyof ChartFilters] }))}
                          className={`px-2 py-1 rounded text-xs font-medium transition-all border ${
                            chartFilters[f.key as keyof ChartFilters]
                              ? 'border-transparent text-white'
                              : theme === 'light' ? 'border-gray-300 text-gray-400 bg-transparent' : 'border-neutral-700 text-neutral-500 bg-transparent'
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
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e5e7eb' : '#333333'} />
                      <XAxis dataKey="name" stroke={theme === 'light' ? '#6b7280' : '#71717a'} fontSize={11} />
                      <YAxis stroke={theme === 'light' ? '#6b7280' : '#71717a'} fontSize={11} tickFormatter={(v) => `$${v/1000}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#1e1e1e', border: `1px solid ${theme === 'light' ? '#e5e7eb' : '#333333'}`, borderRadius: '8px', fontSize: '12px' }}
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
                          <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e5e7eb' : '#333333'} />
                      <XAxis dataKey="name" stroke={theme === 'light' ? '#6b7280' : '#71717a'} fontSize={11} />
                      <YAxis stroke={theme === 'light' ? '#6b7280' : '#71717a'} fontSize={11} tickFormatter={(v) => `$${v/1000}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#1e1e1e', border: `1px solid ${theme === 'light' ? '#e5e7eb' : '#333333'}`, borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      {balanceAlertThreshold > 0 && (
                        <ReferenceLine y={balanceAlertThreshold} stroke="#fb7185" strokeDasharray="5 5" label={{ value: 'Alert', fill: '#fb7185', fontSize: 10 }} />
                      )}
                      <ReferenceLine y={0} stroke="#fb7185" strokeDasharray="3 3" />
                      <Area type="monotone" dataKey="balance" stroke="#34d399" fill="url(#balanceGradient)" strokeWidth={2} />
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
                          contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#1e1e1e', border: `1px solid ${theme === 'light' ? '#e5e7eb' : '#333333'}`, borderRadius: '8px', fontSize: '12px' }}
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
                      <div key={p.name} className={`rounded-lg p-3 ${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-900'}`}>
                        <div className={`text-sm truncate ${textMuted}`}>{p.name}</div>
                        <div className={`text-lg font-mono ${p.margin >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                          {p.margin.toFixed(1)}%
                        </div>
                        <div className="text-xs text-neutral-500">
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
                            : theme === 'light' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200'
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
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e5e7eb' : '#333333'} />
                      <XAxis dataKey="name" stroke={theme === 'light' ? '#6b7280' : '#71717a'} fontSize={11} />
                      <YAxis stroke={theme === 'light' ? '#6b7280' : '#71717a'} fontSize={11} tickFormatter={(v) => `$${v/1000}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#1e1e1e', border: `1px solid ${theme === 'light' ? '#e5e7eb' : '#333333'}`, borderRadius: '8px', fontSize: '12px' }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      {yoyYears.map((year, idx) => (
                        <Bar 
                          key={`rev${year}`}
                          dataKey={`rev${year}`} 
                          name={`Rev ${year}`} 
                          fill={idx === 0 ? '#6ee7b7' : '#34d399'} 
                          radius={[4, 4, 0, 0]} 
                        />
                      ))}
                    </BarChart>
                  ) : (
                    <BarChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e5e7eb' : '#333333'} />
                      <XAxis dataKey="name" stroke={theme === 'light' ? '#6b7280' : '#71717a'} fontSize={11} />
                      <YAxis stroke={theme === 'light' ? '#6b7280' : '#71717a'} fontSize={11} tickFormatter={(v) => `$${v/1000}k`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: theme === 'light' ? '#fff' : '#1e1e1e', border: `1px solid ${theme === 'light' ? '#e5e7eb' : '#333333'}`, borderRadius: '8px', fontSize: '12px' }}
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
                        <tr className={`border-b ${theme === 'light' ? 'border-gray-200 text-gray-500' : 'border-neutral-700 text-neutral-400'}`}>
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
                          <tr key={q.name} className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-neutral-700/50'}`}>
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
                        <span className="px-2 py-1 bg-[#f97316]/10 text-[#f97316] rounded text-xs">
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
                  <div className={`rounded-xl border ${cardClasses}`}>
                    <button
                      onClick={() => toggleDashboardSection('monthly-gm')}
                      className={`w-full p-4 sm:p-6 flex items-center justify-between ${collapsedSections.has('monthly-gm') ? '' : 'border-b ' + (theme === 'light' ? 'border-gray-200' : 'border-neutral-700')}`}
                    >
                      <div className="flex items-center gap-3">
                        <ChevronRight className={`w-5 h-5 transition-transform ${collapsedSections.has('monthly-gm') ? '' : 'rotate-90'}`} />
                        <h3 className="text-lg font-semibold">Monthly Gross Margin Trend</h3>
                        {collapsedSections.has('monthly-gm') && (
                          <span className={`text-sm ${textMuted}`}>({accrualMonthlyData.length} months)</span>
                        )}
                      </div>
                    </button>
                    {!collapsedSections.has('monthly-gm') && (
                      <div className="p-4 sm:p-6 pt-0 sm:pt-0">
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
                                <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#34d399" radius={[4, 4, 0, 0]} />
                                <Bar yAxisId="left" dataKey="directCosts" name="Direct Costs" fill="#fb7185" radius={[4, 4, 0, 0]} />
                                <Line yAxisId="right" type="monotone" dataKey="grossMarginPct" name="GM %" stroke="#64748b" strokeWidth={3} dot={{ r: 4 }} />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <div className={`text-center py-12 ${textMuted}`}>
                            <p>No accrual data yet. Upload invoices in the Data tab.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Project Analysis Table */}
                  <div className={`rounded-xl border ${cardClasses}`}>
                    <button
                      onClick={() => toggleDashboardSection('project-analysis')}
                      className={`w-full p-4 sm:p-6 flex items-center justify-between ${collapsedSections.has('project-analysis') ? '' : 'border-b ' + (theme === 'light' ? 'border-gray-200' : 'border-neutral-700')}`}
                    >
                      <div className="flex items-center gap-3">
                        <ChevronRight className={`w-5 h-5 transition-transform ${collapsedSections.has('project-analysis') ? '' : 'rotate-90'}`} />
                        <h3 className="text-lg font-semibold">Project Gross Margin Analysis</h3>
                        {collapsedSections.has('project-analysis') && (
                          <span className={`text-sm ${textMuted}`}>({accrualProjectAnalysis.projects.length} projects)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm ${textMuted}`}>
                          {dateRangePreset === 'custom' 
                            ? `${activeDateRange.start} to ${activeDateRange.end}`
                            : datePresets.find(p => p.key === dateRangePreset)?.label || dateRangePreset
                          }
                        </span>
                        <span className={`text-xs px-2 py-1 rounded ${theme === 'light' ? 'bg-gray-100' : 'bg-neutral-900'} ${textMuted}`}>
                          {accrualMonthlyData.length} month{accrualMonthlyData.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </button>
                    {!collapsedSections.has('project-analysis') && (
                      <div className="p-4 sm:p-6 pt-0 sm:pt-0">
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
                                  <tr key={p.project} className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-neutral-700/50'}`}>
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
                                <tr className={`font-bold ${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-900'}`}>
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
                    )}
                  </div>

                  {/* Project Budget Tracking */}
                  {projectBudgetTracking.length > 0 && (
                    <div className={`rounded-xl border ${cardClasses}`}>
                      <button
                        onClick={() => toggleDashboardSection('budget-tracking')}
                        className={`w-full p-4 sm:p-6 flex items-center justify-between ${collapsedSections.has('budget-tracking') ? '' : 'border-b ' + (theme === 'light' ? 'border-gray-200' : 'border-neutral-700')}`}
                      >
                        <div className="flex items-center gap-3">
                          <ChevronRight className={`w-5 h-5 transition-transform ${collapsedSections.has('budget-tracking') ? '' : 'rotate-90'}`} />
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
                          {collapsedSections.has('budget-tracking') && (
                            <span className={`text-sm ${textMuted}`}>({projectBudgetTracking.length} projects)</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setShowProjectModal(true)}
                            className={`text-sm px-3 py-1.5 rounded-lg ${theme === 'light' ? 'bg-gray-100 hover:bg-gray-200' : 'bg-neutral-900 hover:bg-neutral-800'}`}
                          >
                            Manage Budgets
                          </button>
                        </div>
                      </button>
                      
                      {!collapsedSections.has('budget-tracking') && (
                        <div className="p-4 sm:p-6 pt-0 sm:pt-0">
                          <div className="space-y-4">
                            {projectBudgetTracking.map(p => (
                              <div key={p.id} className={`p-4 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-900'}`}>
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
                                    <div className={`h-3 rounded-full overflow-hidden ${theme === 'light' ? 'bg-gray-200' : 'bg-neutral-700'}`}>
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
                                <div className={`flex gap-4 mt-3 pt-3 border-t text-xs ${theme === 'light' ? 'border-gray-200' : 'border-neutral-700'}`}>
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
                    </div>
                  )}

                  {/* Period Comparison Buttons */}
                  <div className={`rounded-xl border ${cardClasses}`}>
                    <button
                      onClick={() => toggleDashboardSection('period-comparison')}
                      className={`w-full p-4 sm:p-6 flex items-center justify-between ${collapsedSections.has('period-comparison') ? '' : 'border-b ' + (theme === 'light' ? 'border-gray-200' : 'border-neutral-700')}`}
                    >
                      <div className="flex items-center gap-3">
                        <ChevronRight className={`w-5 h-5 transition-transform ${collapsedSections.has('period-comparison') ? '' : 'rotate-90'}`} />
                        <h3 className="text-lg font-semibold">Period Comparison</h3>
                        {collapsedSections.has('period-comparison') && (
                          <span className={`text-sm ${textMuted}`}>({comparisonView.toUpperCase()})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {(['mom', 'qoq', 'yoy'] as const).map(view => (
                          <button
                            key={view}
                            onClick={() => setComparisonView(view)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                              comparisonView === view
                                ? 'bg-[#f97316] text-white'
                                : theme === 'light' ? 'bg-gray-100 hover:bg-gray-200' : 'bg-neutral-900 hover:bg-neutral-800'
                            }`}
                          >
                            {view === 'mom' ? 'MoM' : view === 'qoq' ? 'QoQ' : 'YoY'}
                          </button>
                        ))}
                      </div>
                    </button>
                    
                    {!collapsedSections.has('period-comparison') && (
                      <div className="p-4 sm:p-6 pt-0 sm:pt-0">
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
                              <tr key={row.period} className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-neutral-700/50'}`}>
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
                              <tr key={row.period} className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-neutral-700/50'}`}>
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
                              <tr key={row.period} className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-neutral-700/50'}`}>
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
                      <div className="text-2xl font-bold text-[#f97316] mt-1">
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
                            <Bar dataKey="invoiced" name="Invoiced (Accrual)" fill="#f97316" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="collected" name="Collected (Cash)" fill="#34d399" radius={[4, 4, 0, 0]} />
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
                              <tr key={row.month} className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-neutral-700/50'}`}>
                                <td className="py-3 font-medium">{row.month}</td>
                                <td className="py-3 text-right font-mono text-[#f97316]">{formatCurrency(row.invoiced)}</td>
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
                          : theme === 'light' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800'
                      }`}
                    >
                      <DollarSign className="w-4 h-4" />
                      Cash ({transactions.length})
                    </button>
                    <button
                      onClick={() => setTransactionViewType('accrual')}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                        transactionViewType === 'accrual'
                          ? 'bg-[#f97316] text-white'
                          : theme === 'light' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800'
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
                  {/* Uncategorized Alert Banner */}
                  {transactions.filter(t => !t.category || t.category === 'unassigned').length > 0 && (
                    <div className={`rounded-xl p-4 border-2 border-amber-500/50 ${theme === 'light' ? 'bg-amber-50' : 'bg-amber-900/20'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="w-5 h-5 text-amber-500" />
                          <div>
                            <p className="font-medium text-amber-600">
                              {transactions.filter(t => !t.category || t.category === 'unassigned').length} transactions need categorization
                            </p>
                            <p className={`text-sm ${textMuted}`}>
                              Categorize to improve your financial insights
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setTransactionCategoryFilter('unassigned')
                          }}
                          className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium"
                        >
                          Review Now
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Bulk Actions Bar - Shows when items selected */}
                  {selectedTransactions.size > 0 && (
                    <div className={`rounded-xl p-4 border-2 border-[#f97316] ${theme === 'light' ? 'bg-[#f97316]/10' : 'bg-[#f97316]/20'}`}>
                      <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <Check className="w-5 h-5 text-[#f97316]" />
                          <span className="font-medium">{selectedTransactions.size} transactions selected</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <select
                            value={bulkCategory}
                            onChange={(e) => setBulkCategory(e.target.value)}
                            className={`rounded-lg px-3 py-2 text-sm border ${inputClasses}`}
                            style={{ colorScheme: theme }}
                          >
                            <option value="">Set Category...</option>
                            <option value="revenue">Revenue</option>
                            <option value="opex">OpEx</option>
                            <option value="overhead">Overhead</option>
                            <option value="investment">Investment</option>
                          </select>
                          <select
                            value={bulkProject}
                            onChange={(e) => setBulkProject(e.target.value)}
                            className={`rounded-lg px-3 py-2 text-sm border ${inputClasses}`}
                            style={{ colorScheme: theme }}
                          >
                            <option value="">Set Project...</option>
                            {projectList.map(p => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                          <button
                            onClick={bulkCategorizeSelected}
                            disabled={!bulkCategory && !bulkProject}
                            className="px-4 py-2 bg-[#f97316] text-[#121212] rounded-lg hover:bg-[#ea580c] text-sm font-medium disabled:opacity-50"
                          >
                            Apply to Selected
                          </button>
                          <button
                            onClick={() => setSelectedTransactions(new Set())}
                            className={`px-3 py-2 rounded-lg text-sm ${theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-neutral-900'}`}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

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
                          <option value="unassigned">⚠️ Uncategorized</option>
                          {categories.filter(c => c.id !== 'unassigned').map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                        <select
                          value={selectedProject}
                          onChange={(e) => setSelectedProject(e.target.value)}
                          className={`rounded-lg px-3 py-2 text-sm border ${inputClasses}`}
                          style={{ colorScheme: theme }}
                        >
                          <option value="all">All Projects</option>
                          <option value="unassigned">⚠️ No Project</option>
                          {projectList.map(p => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                        <select
                          value={sourceFilter}
                          onChange={(e) => setSourceFilter(e.target.value as any)}
                          className={`rounded-lg px-3 py-2 text-sm border ${inputClasses}`}
                          style={{ colorScheme: theme }}
                        >
                          <option value="all">All Sources</option>
                          <option value="qbo">QuickBooks</option>
                          <option value="csv">CSV Import</option>
                          <option value="manual">Manual</option>
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
                          theme === 'light' ? 'bg-white border-gray-300 hover:bg-gray-50' : 'bg-neutral-900 border-neutral-700'
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
                              <th className="pb-3 font-medium w-10">
                                <input
                                  type="checkbox"
                                  checked={selectedTransactions.size === filteredTransactions.length && filteredTransactions.length > 0}
                                  onChange={() => selectAllTransactions(filteredTransactions.map(t => t.id))}
                                  className="rounded border-gray-300"
                                />
                              </th>
                              <th className="pb-3 font-medium w-24">Date</th>
                              <th className="pb-3 font-medium w-24">Source</th>
                              <th className="pb-3 font-medium w-28">Category</th>
                              <th className="pb-3 font-medium">Description</th>
                              <th className="pb-3 font-medium text-right w-28">Amount</th>
                              <th className="pb-3 font-medium w-28">Project</th>
                              <th className="pb-3 font-medium text-center w-20">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredTransactions.map(t => {
                              const cat = getCategoryById(t.category)
                              const isExpanded = expandedTransaction === t.id
                              const source = (t as any).source || 'manual'
                              return (
                                <React.Fragment key={t.id}>
                                  <tr 
                                    className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-neutral-700/50'} ${
                                      isExpanded ? (theme === 'light' ? 'bg-blue-50' : 'bg-blue-900/20') : ''
                                    } hover:${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-900/50'} cursor-pointer`}
                                    onClick={() => setExpandedTransaction(isExpanded ? null : t.id)}
                                  >
                                    <td className="py-3" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="checkbox"
                                        checked={selectedTransactions.has(t.id)}
                                        onChange={() => toggleTransactionSelection(t.id)}
                                        className="rounded border-gray-300"
                                      />
                                    </td>
                                    <td className="py-3 text-sm">{t.date}</td>
                                    <td className="py-3">
                                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                        source === 'qbo' 
                                          ? 'bg-green-100 text-green-700' 
                                          : source === 'csv'
                                          ? 'bg-blue-100 text-blue-700'
                                          : 'bg-gray-100 text-gray-600'
                                      }`}>
                                        {source === 'qbo' ? 'QBO' : source === 'csv' ? 'CSV' : 'Manual'}
                                      </span>
                                    </td>
                                    <td className="py-3">
                                      {t.category && t.category !== 'unassigned' ? (
                                        <span 
                                          className="px-2 py-1 rounded text-xs font-medium"
                                          style={{ 
                                            backgroundColor: `${cat?.color || '#6b7280'}15`,
                                            color: cat?.color || '#6b7280'
                                          }}
                                        >
                                          {cat?.name || t.category}
                                        </span>
                                      ) : (
                                        <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-700">
                                          ⚠️ Uncategorized
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3 text-sm">
                                      <div className="flex items-center gap-2 max-w-xs">
                                        <span className="truncate">{t.description}</span>
                                        {t.notes && (
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              setExpandedNotes(prev => {
                                                const next = new Set(prev)
                                                if (next.has(t.id)) next.delete(t.id)
                                                else next.add(t.id)
                                                return next
                                              })
                                            }}
                                            className="p-0.5 text-accent-secondary hover:text-accent-primary flex-shrink-0"
                                            title={t.notes}
                                          >
                                            <MessageSquare className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                      {t.notes && expandedNotes.has(t.id) && (
                                        <div className={`text-xs mt-1 p-2 rounded ${theme === 'light' ? 'bg-gray-100 text-gray-600' : 'bg-neutral-900 text-neutral-400'}`}>
                                          {t.notes}
                                        </div>
                                      )}
                                    </td>
                                    <td className={`py-3 text-right font-mono text-sm ${t.amount >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                                      {formatCurrency(t.amount)}
                                    </td>
                                    <td className={`py-3 text-sm ${t.project ? '' : textMuted}`}>
                                      {t.project || <span className="text-amber-600">—</span>}
                                    </td>
                                    <td className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center justify-center gap-1">
                                        <button onClick={() => startEdit(t)} className="p-1.5 text-neutral-400 hover:text-accent-primary hover:bg-accent-primary/10 rounded">
                                          <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => deleteTransaction(t.id)} className="p-1.5 text-neutral-400 hover:text-accent-danger hover:bg-accent-danger/10 rounded">
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                  {/* Expanded Quick Categorize Row */}
                                  {isExpanded && (
                                    <tr className={theme === 'light' ? 'bg-blue-50' : 'bg-blue-900/20'}>
                                      <td colSpan={8} className="py-4 px-4">
                                        <div className="flex flex-wrap items-center gap-4">
                                          <div>
                                            <p className={`text-xs font-medium mb-2 ${textMuted}`}>Quick Category:</p>
                                            <div className="flex flex-wrap gap-2">
                                              {['revenue', 'opex', 'overhead', 'investment'].map(catId => {
                                                const catInfo = getCategoryById(catId)
                                                return (
                                                  <button
                                                    key={catId}
                                                    onClick={() => quickCategorize(t.id, catId)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                                      t.category === catId 
                                                        ? 'ring-2 ring-offset-2 ring-[#f97316]' 
                                                        : 'hover:opacity-80'
                                                    }`}
                                                    style={{ 
                                                      backgroundColor: `${catInfo?.color || '#6b7280'}20`,
                                                      color: catInfo?.color || '#6b7280'
                                                    }}
                                                  >
                                                    {catInfo?.name || catId}
                                                  </button>
                                                )
                                              })}
                                            </div>
                                          </div>
                                          <div>
                                            <p className={`text-xs font-medium mb-2 ${textMuted}`}>Assign Project:</p>
                                            <select
                                              value={t.project || ''}
                                              onChange={(e) => quickCategorize(t.id, t.category || 'unassigned', e.target.value)}
                                              className={`rounded-lg px-3 py-1.5 text-sm border ${inputClasses}`}
                                              style={{ colorScheme: theme }}
                                            >
                                              <option value="">No Project</option>
                                              {projectList.map(p => (
                                                <option key={p} value={p}>{p}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <button
                                            onClick={() => setExpandedTransaction(null)}
                                            className={`ml-auto px-3 py-1.5 rounded-lg text-xs ${theme === 'light' ? 'hover:bg-gray-200' : 'hover:bg-neutral-900'}`}
                                          >
                                            Close
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className={`text-sm mt-4 text-center ${textMuted}`}>
                        Showing {filteredTransactions.length} of {transactions.length} transactions
                        {selectedTransactions.size > 0 && ` • ${selectedTransactions.size} selected`}
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
                            theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-neutral-700 hover:bg-neutral-900'
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
                          className="flex items-center gap-2 px-4 py-2 bg-[#f97316] text-white rounded-lg hover:bg-[#ea580c]"
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
                          theme === 'light' ? 'bg-white border-gray-300 hover:bg-gray-50' : 'bg-neutral-900 border-neutral-700'
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
                              <tr key={t.id} className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-neutral-700/50'} ${selectedAccrualIds.has(t.id) ? (theme === 'light' ? 'bg-[#262626]' : 'bg-[#f97316]/10') : ''} hover:${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-900/50'}`}>
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
                                        <button onClick={cancelEditAccrual} className="p-1.5 text-neutral-400 hover:bg-neutral-500/10 rounded">
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
                                        <button onClick={() => startEditAccrual(t)} className="p-1.5 text-neutral-400 hover:text-[#f97316] hover:bg-[#f97316]/10 rounded" title="Inline edit">
                                          <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => openEditAccrualModal(t)} className="p-1.5 text-neutral-400 hover:text-accent-primary hover:bg-accent-primary/10 rounded" title="Edit in modal">
                                          <ExternalLink className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => deleteAccrualTransaction(t.id)} className="p-1.5 text-neutral-400 hover:text-accent-danger hover:bg-accent-danger/10 rounded" title="Delete">
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
                          className="px-4 py-2 bg-[#f97316] text-white rounded-lg hover:bg-[#ea580c] flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Add Manually
                        </button>
                        <button 
                          onClick={() => setActiveTab('data')}
                          className={`px-4 py-2 rounded-lg border flex items-center gap-2 ${
                            theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-neutral-700 hover:bg-neutral-900'
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
                        onChange={(e) => handleBeginningBalanceChange(parseFloat(e.target.value) || 0)}
                        onBlur={handleBeginningBalanceBlur}
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
                      onChange={(e) => handleCutoffDateChange(e.target.value)}
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
                    : theme === 'light' ? 'border-gray-300' : 'border-neutral-700'
                }`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) handleFileUpload(file) }}
                >
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-accent-primary/10 flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-accent-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">Cash Flow Data</h3>
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
                  theme === 'light' ? 'border-[#333333] hover:border-[#64748b]' : 'border-[#f97316]/30 hover:border-[#f97316]/50'
                }`}
                  onDragOver={(e) => { e.preventDefault() }}
                  onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleAccrualUpload(file) }}
                >
                  <div className="text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#f97316]/10 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-[#f97316]" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">Accrual Data (Invoices)</h3>
                    <p className={`text-sm mb-4 ${textMuted}`}>Invoices issued & received (for GM)</p>
                    <input type="file" accept=".csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleAccrualUpload(file) }} className="hidden" id="accrual-file-upload" />
                    <label htmlFor="accrual-file-upload" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#f97316] text-white rounded-lg cursor-pointer hover:bg-[#f97316]/90">
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
                  <div className={`rounded-lg p-3 font-mono text-xs overflow-x-auto ${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-900'}`}>
                    <div className={textMuted}>date,category,description,amount,type,project</div>
                    <div className="text-accent-primary">2024-01-15,revenue,Payment received,50000,actual,Alpha</div>
                    <div className="text-accent-danger">2024-01-01,opex,Contractor payment,-15000,actual,Alpha</div>
                    <div className="text-accent-warning">2024-01-01,overhead,Rent payment,-5000,actual,</div>
                  </div>
                </div>
                
                <div className={`rounded-xl p-4 border ${cardClasses}`}>
                  <h4 className="font-semibold mb-3 text-[#f97316]">Accrual/Invoice Format</h4>
                  <div className={`rounded-lg p-3 font-mono text-xs overflow-x-auto ${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-900'}`}>
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
                  <div className="w-10 h-10 rounded-full bg-[#f97316]/10 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-[#f97316]" />
                  </div>
                  <div>
                    <h3 className="font-semibold">AI-Powered Categorization</h3>
                    <p className={`text-sm ${textMuted}`}>Let AI analyze and categorize your transactions before import</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Cash AI Upload */}
                  <div className={`p-4 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-900'}`}>
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
                          : 'bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white hover:from-[#ea580c] hover:to-[#c2410c]'
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
                  <div className={`p-4 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-900'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-sm">Accrual/Invoices</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full bg-[#f97316]/10 text-[#f97316]`}>
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
                          : 'bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white hover:from-[#ea580c] hover:to-[#c2410c]'
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
                
                <div className={`mt-4 p-3 rounded-lg text-sm ${theme === 'light' ? 'bg-[#262626] text-[#f97316]' : 'bg-[#f97316]/10 text-[#f97316]'}`}>
                  <strong>How it works:</strong> Upload a CSV and AI will analyze each transaction description to suggest categories and projects. You can review, edit, and approve suggestions before importing.
                </div>
              </div>

              {/* Bank Statement PDF/Image Upload */}
              <div className={`rounded-xl p-6 border ${cardClasses}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#f97316] to-[#ea580c] flex items-center justify-center">
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">📄 Bank Statement Upload</h3>
                    <p className={`text-sm ${textMuted}`}>Upload PDF or image - AI extracts all transactions</p>
                  </div>
                  <span className={`ml-auto text-xs px-2 py-1 rounded-full bg-gradient-to-r from-[#f97316]/20 to-[#ea580c]/20 text-[#f97316] font-medium`}>
                    ✨ AI Powered
                  </span>
                </div>
                
                <div className={`p-6 rounded-lg border-2 border-dashed text-center ${
                  theme === 'light' ? 'border-[#333333] bg-[#262626]' : 'border-[#64748b]/30 bg-[#64748b]/5'
                }`}>
                  <input 
                    type="file" 
                    accept=".pdf,image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      
                      setStatementLoading(true)
                      setStatementError(null)
                      
                      try {
                        const formData = new FormData()
                        formData.append('file', file)
                        
                        const response = await fetch('/api/parse-statement', {
                          method: 'POST',
                          body: formData
                        })
                        
                        const result = await response.json()
                        
                        if (result.error) {
                          setStatementError(result.error)
                          alert('Error: ' + result.error)
                        } else if (result.transactions && result.transactions.length > 0) {
                          setStatementData(result.transactions)
                          setStatementInfo(result.account_info)
                          setShowStatementPreview(true)
                        } else {
                          setStatementError('No transactions found in statement')
                          alert('No transactions found in the statement')
                        }
                      } catch (err) {
                        setStatementError('Failed to process statement')
                        alert('Failed to process statement. Please try again.')
                      }
                      
                      setStatementLoading(false)
                      e.target.value = ''
                    }}
                    className="hidden" 
                    id="statement-upload" 
                    disabled={statementLoading}
                  />
                  <label 
                    htmlFor="statement-upload" 
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg cursor-pointer font-medium transition-all ${
                      statementLoading 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-[#f97316] to-[#ea580c] text-white hover:from-[#ea580c] hover:to-[#c2410c]'
                    }`}
                  >
                    {statementLoading ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Extracting Transactions...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        Upload Bank Statement
                      </>
                    )}
                  </label>
                  <p className={`mt-3 text-sm ${textMuted}`}>
                    Supports PDF and images (PNG, JPG) • AI will extract dates, descriptions, amounts
                  </p>
                </div>
                
                <div className={`mt-4 p-3 rounded-lg text-sm ${theme === 'light' ? 'bg-[#262626] text-[#94a3b8]' : 'bg-[#64748b]/10 text-[#94a3b8]'}`}>
                  <strong>How it works:</strong> Upload your bank statement (PDF or screenshot) and Claude AI will read it, extract every transaction, and categorize them automatically. You'll review before importing to Cash Flow.
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-4">
                <button onClick={loadSampleData} className="flex items-center gap-2 px-5 py-2.5 bg-accent-secondary/10 text-accent-secondary rounded-lg hover:bg-accent-secondary/20">
                  <RefreshCw className="w-4 h-4" />
                  Load Sample
                </button>
                <button onClick={exportToCSV} disabled={!transactions.length} className={`flex items-center gap-2 px-5 py-2.5 rounded-lg border disabled:opacity-50 ${
                  theme === 'light' ? 'bg-white border-gray-300 hover:bg-gray-50' : 'bg-neutral-900 border-neutral-700'
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
                    theme === 'light' ? 'bg-white border-gray-300 hover:bg-gray-50' : 'bg-neutral-900 border-neutral-700'
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
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#f97316]/10 text-[#f97316] rounded-lg disabled:opacity-50 hover:bg-[#f97316]/20"
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
                        theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-neutral-700 hover:bg-neutral-900'
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
                        theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-neutral-700 hover:bg-neutral-900'
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
                      <div key={a.id} className={`flex items-center justify-between p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-900'}`}>
                        <div className="flex items-center gap-3 flex-wrap">
                          <span 
                            className="px-2 py-0.5 rounded text-xs font-medium"
                            style={{ 
                              backgroundColor: `${getCategoryColor(a.category)}15`,
                              color: getCategoryColor(a.category)
                            }}
                          >{getCategoryById(a.category)?.name || a.category}</span>
                          <span className="font-medium">{a.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${theme === 'light' ? 'bg-gray-200' : 'bg-neutral-800'} ${textMuted}`}>
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
                            : theme === 'light' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-neutral-900 hover:bg-neutral-800'
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
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
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
                      <ReferenceLine yAxisId="left" y={0} stroke="#fb7185" strokeDasharray="3 3" />
                      <Bar yAxisId="left" dataKey="netCash" name="Net Cash" fill={theme === 'light' ? '#34d399' : '#34d399'} radius={[4, 4, 0, 0]} />
                      <Area yAxisId="right" type="monotone" dataKey="balance" name="Balance" stroke="#f97316" fill="url(#balanceGradient)" strokeWidth={2} />
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
                          <tr key={m.month} className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-neutral-700/50'} ${idx % 2 === 0 ? '' : theme === 'light' ? 'bg-gray-50/50' : 'bg-neutral-900/50'}`}>
                            <td className="py-3 font-medium">{m.monthLabel}</td>
                            <td className="py-3 text-right font-mono text-accent-primary">{formatCurrency(m.revenue)}</td>
                            <td className="py-3 text-right font-mono text-accent-danger">{formatCurrency(m.opex)}</td>
                            <td className="py-3 text-right font-mono text-accent-warning">{formatCurrency(m.overhead)}</td>
                            <td className="py-3 text-right font-mono text-accent-secondary">{formatCurrency(m.investment)}</td>
                            <td className={`py-3 text-right font-mono font-medium ${m.netCash >= 0 ? 'text-accent-primary' : 'text-accent-danger'}`}>
                              {formatCurrency(m.netCash)}
                            </td>
                            <td className={`py-3 text-right font-mono font-medium ${m.balance >= 0 ? 'text-[#f97316]' : 'text-accent-danger'}`}>
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
                <div className={`rounded-xl p-4 border ${theme === 'light' ? 'bg-[#262626] border-[#333333]' : 'bg-[#f97316]/10 border-[#f97316]/30'}`}>
                  <div className="flex items-center gap-2 text-[#f97316] font-medium">
                    <Info className="w-4 h-4" />
                    {activeAssumptions.length} assumption{activeAssumptions.length > 1 ? 's' : ''} applied to this projection
                  </div>
                  <p className={`text-sm mt-1 ${theme === 'light' ? 'text-[#00a47a]' : 'text-[#f97316]'}`}>
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
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium border ${theme === 'light' ? 'border-gray-300 hover:bg-gray-100' : 'border-neutral-700 hover:bg-neutral-900'}`}
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
                <div className={`flex items-center justify-between px-4 py-3 border-b ${theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-neutral-900 border-neutral-700'}`}>
                  <h3 className="font-semibold">Clients</h3>
                  <div className="flex gap-1">
                    {['all', 'active', 'inactive', 'prospect'].map(status => (
                      <button
                        key={status}
                        onClick={() => setSelectedClientId(status === selectedClientId ? 'all' : status)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                          (status === 'all' && selectedClientId === 'all') || selectedClientId === status
                            ? 'bg-accent-primary text-white'
                            : theme === 'light' ? 'bg-gray-100 hover:bg-gray-200' : 'bg-neutral-800 hover:bg-neutral-700'
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
                    <thead className={theme === 'light' ? 'bg-gray-50' : 'bg-neutral-800'}>
                      <tr className={`border-b ${theme === 'light' ? 'border-gray-200' : 'border-neutral-700'} text-left ${textMuted}`}>
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
                        <tr key={client.id} className={`border-b ${theme === 'light' ? 'border-gray-100 hover:bg-gray-50' : 'border-neutral-700/50 hover:bg-neutral-900'}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                client.status === 'active' ? 'bg-[#34d399]/20 text-[#34d399]' :
                                client.status === 'prospect' ? 'bg-[#f97316]/20 text-[#f97316]' :
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
                                <span key={p.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${theme === 'light' ? 'bg-gray-100' : 'bg-neutral-900'}`}>
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
                <div className={`px-4 py-3 border-b ${theme === 'light' ? 'bg-gray-50 border-gray-200' : 'bg-neutral-900 border-neutral-700'}`}>
                  <h3 className="font-semibold">Assign Projects to Clients</h3>
                  <p className={`text-xs mt-1 ${textMuted}`}>Link your projects to clients for consolidated reporting</p>
                </div>
                
                <div className="p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={`border-b ${theme === 'light' ? 'border-gray-200' : 'border-neutral-700'} text-left ${textMuted}`}>
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
                          <tr key={projectName} className={`border-b ${theme === 'light' ? 'border-gray-100' : 'border-neutral-700/50'}`}>
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
                                onChange={async (e) => {
                                  const clientId = e.target.value || undefined
                                  if (existingProject) {
                                    // Update existing project
                                    updateProject(existingProject.id, { clientId })
                                  } else {
                                    // Create new project with client assignment
                                    const projectData = {
                                      name: projectName,
                                      color: projectColor,
                                      status: 'active' as const,
                                      clientId
                                    }
                                    
                                    if (companyId && user) {
                                      const { data, error } = await supabaseInsertProject(projectData, companyId, user.id)
                                      if (error) {
                                        console.error('Error creating project:', error)
                                        return
                                      }
                                      if (data) {
                                        const newProject: Project = {
                                          id: data.id,
                                          name: data.name,
                                          color: data.color,
                                          status: data.status,
                                          clientId: data.client_id,
                                          createdAt: data.created_at
                                        }
                                        setProjects(prev => [...prev, newProject])
                                      }
                                    } else {
                                      // Fallback for local mode
                                      const newProject: Project = {
                                        id: generateId(),
                                        ...projectData,
                                        createdAt: new Date().toISOString()
                                      }
                                      setProjects(prev => [...prev, newProject])
                                    }
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


          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <motion.div key="reports" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-6">
              
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Standard Reports</h2>
                  <p className={`text-sm ${textMuted}`}>Pre-built reports for quick insights</p>
                </div>
              </div>

              {/* Reports Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { 
                    id: 'monthly-pl', 
                    title: 'Monthly P&L', 
                    description: 'Profit & Loss statement by month',
                    icon: BarChart3,
                    color: '#34d399'
                  },
                  { 
                    id: 'project-profitability', 
                    title: 'Project Profitability', 
                    description: 'Revenue, costs, and margins by project',
                    icon: Target,
                    color: '#f97316'
                  },
                  { 
                    id: 'client-revenue', 
                    title: 'Client Revenue Report', 
                    description: 'Revenue breakdown by client',
                    icon: Users,
                    color: '#60a5fa'
                  },
                  { 
                    id: 'cash-flow', 
                    title: 'Cash Flow Statement', 
                    description: 'Cash inflows, outflows, and net position',
                    icon: DollarSign,
                    color: '#2dd4bf'
                  },
                  { 
                    id: 'quarterly-comparison', 
                    title: 'Quarterly Comparison', 
                    description: 'Compare performance across quarters',
                    icon: TrendingUp,
                    color: '#fbbf24'
                  }
                ].map(report => (
                  <button
                    key={report.id}
                    onClick={() => setActiveReport(report.id)}
                    className={`p-5 rounded-xl border text-left transition-all hover:shadow-lg group ${cardClasses}`}
                  >
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                      style={{ backgroundColor: `${report.color}20` }}
                    >
                      <report.icon className="w-6 h-6" style={{ color: report.color }} />
                    </div>
                    <h3 className="font-semibold mb-1">{report.title}</h3>
                    <p className={`text-sm ${textMuted}`}>{report.description}</p>
                  </button>
                ))}
              </div>

              {/* Report Builder */}
              <button
                onClick={() => router.push('/reports/builder')}
                className={`w-full rounded-xl p-6 border-2 text-left transition-all hover:shadow-lg ${
                  theme === 'light' 
                    ? 'border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 hover:border-orange-300' 
                    : 'border-orange-500/30 bg-gradient-to-r from-orange-500/10 to-amber-500/10 hover:border-orange-500/50'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f97316] to-[#fbbf24] flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Report Builder</h3>
                    <p className={`text-sm ${textMuted}`}>Create custom reports with drag-and-drop canvas</p>
                  </div>
                  <ChevronRight className={`w-5 h-5 ${textMuted}`} />
                </div>
              </button>
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
                        onClick={() => setBranding(prev => ({ ...prev, brandColor: '#f97316' }))}
                        className={`px-3 py-2 text-sm rounded-lg border ${theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-neutral-700 hover:bg-neutral-900'}`}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className={`block text-sm mb-2 ${textMuted}`}>Company Logo</label>
                    <div className="flex items-center gap-4">
                      {/* Dark Mode Logo */}
                        <div>
                          <p className={`text-xs mb-2 ${textMuted}`}>Dark Mode</p>
                          {branding.companyLogo ? (
                            <div className="relative inline-block">
                              <img src={branding.companyLogo} alt="Logo" className="w-16 h-16 rounded-lg object-contain border border-dashed bg-[#121212]" />
                              <button
                                onClick={() => { setBranding(prev => ({ ...prev, companyLogo: null })); saveCompanySetting('company_logo', null) }}
                                className="absolute -top-2 -right-2 w-5 h-5 bg-accent-danger text-white rounded-full flex items-center justify-center"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className={`w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center bg-[#121212] ${theme === 'light' ? 'border-gray-300' : 'border-neutral-700'}`}>
                              <Image className={`w-6 h-6 ${textMuted}`} />
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                const reader = new FileReader()
                                reader.onload = (ev) => {
                                  const logoData = ev.target?.result as string
                                  setBranding(prev => ({ ...prev, companyLogo: logoData }))
                                  saveCompanySetting('company_logo', logoData)
                                }
                                reader.readAsDataURL(file)
                              }
                            }}
                            className="hidden"
                            id="logo-upload-dark"
                          />
                          <label
                            htmlFor="logo-upload-dark"
                            className={`inline-flex items-center gap-2 px-3 py-1.5 mt-2 rounded-lg cursor-pointer border text-xs ${theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-neutral-700 hover:bg-neutral-900'}`}
                          >
                            <Upload className="w-3 h-3" />
                            Upload
                          </label>
                        </div>
                        
                        {/* Light Mode Logo */}
                        <div>
                          <p className={`text-xs mb-2 ${textMuted}`}>Light Mode</p>
                          {branding.companyLogoLight ? (
                            <div className="relative inline-block">
                              <img src={branding.companyLogoLight} alt="Logo Light" className="w-16 h-16 rounded-lg object-contain border border-dashed bg-white" />
                              <button
                                onClick={() => { setBranding(prev => ({ ...prev, companyLogoLight: null })); saveCompanySetting('company_logo_light', null) }}
                                className="absolute -top-2 -right-2 w-5 h-5 bg-accent-danger text-white rounded-full flex items-center justify-center"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className={`w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center bg-white ${theme === 'light' ? 'border-gray-300' : 'border-neutral-700'}`}>
                              <Image className={`w-6 h-6 text-gray-400`} />
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                const reader = new FileReader()
                                reader.onload = (ev) => {
                                  const logoData = ev.target?.result as string
                                  setBranding(prev => ({ ...prev, companyLogoLight: logoData }))
                                  saveCompanySetting('company_logo_light', logoData)
                                }
                                reader.readAsDataURL(file)
                              }
                            }}
                            className="hidden"
                            id="logo-upload-light"
                          />
                          <label
                            htmlFor="logo-upload-light"
                            className={`inline-flex items-center gap-2 px-3 py-1.5 mt-2 rounded-lg cursor-pointer border text-xs ${theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-neutral-700 hover:bg-neutral-900'}`}
                          >
                            <Upload className="w-3 h-3" />
                            Upload
                          </label>
                        </div>
                      </div>
                      <p className={`text-xs mt-2 ${textSubtle}`}>PNG, JPG up to 500KB</p>
                    </div>
                  </div>
                </div>

              {/* QuickBooks Integration */}
              <div className={`rounded-xl p-6 border ${cardClasses}`}>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5" />
                  QuickBooks Integration
                </h3>
                <p className={`text-sm mb-4 ${textMuted}`}>Connect to QuickBooks Online to automatically sync bank transactions and invoices</p>
                
                {qboConnected ? (
                  <div className="space-y-4">
                    <div className={`flex items-center gap-3 p-4 rounded-lg ${theme === 'light' ? 'bg-green-50 border border-green-200' : 'bg-green-900/20 border border-green-800'}`}>
                      <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-green-600">Connected to QuickBooks</p>
                        {qboConnectedAt && (
                          <p className={`text-xs ${textMuted}`}>
                            Connected {new Date(qboConnectedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => syncQuickBooks('all')}
                        disabled={qboSyncing}
                        className="flex items-center gap-2 px-4 py-2 bg-[#f97316] text-[#121212] rounded-lg font-medium hover:bg-[#ea580c] disabled:opacity-50"
                      >
                        <RefreshCw className={`w-4 h-4 ${qboSyncing ? 'animate-spin' : ''}`} />
                        {qboSyncing ? 'Syncing...' : 'Sync All'}
                      </button>
                      <button
                        onClick={() => syncQuickBooks('transactions')}
                        disabled={qboSyncing}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium border ${theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-neutral-700 hover:bg-neutral-900'}`}
                      >
                        Bank Transactions Only
                      </button>
                      <button
                        onClick={() => syncQuickBooks('invoices')}
                        disabled={qboSyncing}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium border ${theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-neutral-700 hover:bg-neutral-900'}`}
                      >
                        Invoices Only
                      </button>
                    </div>
                    
                    {qboLastSync && (
                      <p className={`text-xs ${textMuted}`}>
                        Last synced: {new Date(qboLastSync).toLocaleString()}
                      </p>
                    )}
                    
                    <button
                      onClick={disconnectQuickBooks}
                      className="text-sm text-red-500 hover:text-red-600"
                    >
                      Disconnect QuickBooks
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className={`p-4 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-900'}`}>
                      <p className={`text-sm ${textMuted} mb-3`}>
                        Connecting QuickBooks will allow you to:
                      </p>
                      <ul className={`text-sm ${textMuted} space-y-1 ml-4 list-disc`}>
                        <li>Import bank transactions automatically</li>
                        <li>Sync invoices to the Accrual tab</li>
                        <li>Avoid duplicate data entry</li>
                      </ul>
                    </div>
                    <button
                      onClick={connectQuickBooks}
                      className="flex items-center gap-2 px-6 py-3 bg-[#2CA01C] text-white rounded-lg font-medium hover:bg-[#248a17] transition-colors"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                      </svg>
                      Connect to QuickBooks
                    </button>
                  </div>
                )}
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
  <div key={cat.id} className={`flex items-center justify-between p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-900'}`}>
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
      <span className={`text-xs px-2 py-0.5 rounded ${theme === 'light' ? 'bg-gray-200' : 'bg-neutral-800'}`}>
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
        className="p-1 text-neutral-400 hover:text-accent-danger"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    )}
  </div>
))}
                </div>
                
                <div className={`p-4 rounded-lg border-2 border-dashed ${theme === 'light' ? 'border-gray-300' : 'border-neutral-700'}`}>
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
                        defaultValue="#f97316"
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
                      onChange={(e) => handleBalanceAlertChange(parseFloat(e.target.value) || 0)}
                      onBlur={handleBalanceAlertBlur}
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
                        : 'border-neutral-700 text-neutral-400 hover:bg-neutral-900'
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
  
  <div className={`p-4 rounded-lg mb-4 ${theme === 'light' ? 'bg-[#262626] border border-[#333333]' : 'bg-accent-secondary/10 border border-accent-secondary/20'}`}>
    <div className="flex items-start gap-3">
      <Shield className="w-5 h-5 text-accent-secondary mt-0.5" />
      <div>
        <p className={`font-medium ${theme === 'light' ? 'text-[#00a47a]' : 'text-accent-secondary'}`}>Secure Cloud Storage</p>
        <p className={`text-sm mt-1 ${theme === 'light' ? 'text-[#f97316]' : 'text-accent-secondary/80'}`}>
          Your data is encrypted and stored securely on Supabase (AWS). Access from any device with your login.
          Team members with the same email domain share data automatically.
        </p>
      </div>
    </div>
  </div>
  
  <div className="space-y-3">
    <div className={`flex items-center justify-between p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-900'}`}>
      <div className="flex items-center gap-3">
        <Database className="w-5 h-5" />
        <div>
          <p className={`font-medium ${theme === 'light' ? 'text-gray-900' : 'text-neutral-200'}`}>Storage Location</p>
          <p className={`text-sm ${textMuted}`}>Supabase Cloud (AWS) • Encrypted</p>
        </div>
      </div>
    </div>
    
    <div className={`flex items-center justify-between p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-900'}`}>
      <div className="flex items-center gap-3">
        <Users className="w-5 h-5" />
        <div>
          <p className={`font-medium ${theme === 'light' ? 'text-gray-900' : 'text-neutral-200'}`}>Team Access</p>
          <p className={`text-sm ${textMuted}`}>Role: {profile?.role || 'user'} • Company shared data</p>
        </div>
      </div>
    </div>
    
    <div className={`flex items-center justify-between p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-900'}`}>
      <div className="flex items-center gap-3">
        <Shield className="w-5 h-5" />
        <div>
          <p className={`font-medium ${theme === 'light' ? 'text-gray-900' : 'text-neutral-200'}`}>Data Ownership</p>
          <p className={`text-sm ${textMuted}`}>You own 100% of your data. Export anytime.</p>
        </div>
      </div>
      <button onClick={exportToCSV} className={`px-3 py-1.5 text-sm rounded-lg border ${theme === 'light' ? 'border-gray-300 hover:bg-gray-100' : 'border-neutral-700 hover:bg-neutral-900'}`}>
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
                  <div className={`flex items-center justify-between p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-900'}`}>
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5" />
                      <div>
                        <p className={`font-medium ${theme === 'light' ? 'text-gray-900' : 'text-neutral-200'}`}>User Authentication</p>
                        <p className="text-sm">Secure login with SSO</p>
                      </div>
                    </div>
                    <span className="text-xs bg-accent-warning/10 text-accent-warning px-2 py-1 rounded">Planned</span>
                  </div>
                  <div className={`flex items-center justify-between p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-900'}`}>
                    <div className="flex items-center gap-3">
                      <Database className="w-5 h-5" />
                      <div>
                        <p className={`font-medium ${theme === 'light' ? 'text-gray-900' : 'text-neutral-200'}`}>Cloud Database</p>
                        <p className="text-sm">Encrypted data storage</p>
                      </div>
                    </div>
                    <span className="text-xs bg-accent-warning/10 text-accent-warning px-2 py-1 rounded">Planned</span>
                  </div>
                  <div className={`flex items-center justify-between p-3 rounded-lg ${theme === 'light' ? 'bg-gray-50' : 'bg-neutral-900'}`}>
                    <div className="flex items-center gap-3">
                      <Lock className="w-5 h-5" />
                      <div>
                        <p className={`font-medium ${theme === 'light' ? 'text-gray-900' : 'text-neutral-200'}`}>Role-Based Access</p>
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
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-neutral-700 hover:bg-neutral-900'}`}
                  >
                    <Shield className="w-4 h-4" />
                    Privacy Policy
                  </button>
                  <button
                    onClick={() => setShowTermsModal(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${theme === 'light' ? 'border-gray-300 hover:bg-gray-50' : 'border-neutral-700 hover:bg-neutral-900'}`}
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
          <footer className={`border-t py-4 print:hidden ${theme === 'light' ? 'border-gray-200' : 'border-neutral-700'}`}>
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

      {/* AI Chat Side Panel */}
      <AnimatePresence>
        {chatOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setChatOpen(false)}
              className="fixed inset-0 bg-black/30 z-50 lg:hidden"
            />
            
            {/* Chat Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className={`fixed top-0 right-0 h-full w-full sm:w-[420px] z-50 flex flex-col shadow-2xl ${
                theme === 'light' 
                  ? 'bg-white border-l border-gray-200' 
                  : 'bg-[#121212] border-l border-[#333333]'
              }`}
            >
              {/* Panel Header */}
              <div className={`px-5 py-4 border-b ${
                theme === 'light' ? 'border-gray-200' : 'border-[#333333]'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f97316] to-[#34d399] flex items-center justify-center shadow-lg">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Vantage AI</h3>
                      <p className={`text-xs ${textMuted}`}>Your financial assistant</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setChatMessages([])}
                      className={`p-2 rounded-lg text-sm ${
                        theme === 'light' ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-[#262626] text-[#94a3b8]'
                      }`}
                      title="Clear chat"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => setChatOpen(false)}
                      className={`p-2 rounded-lg ${
                        theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-[#262626]'
                      }`}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Chat Messages Area */}
              <div className={`flex-1 overflow-y-auto p-5 space-y-4 ${
                theme === 'light' ? 'bg-gray-50' : 'bg-[#121212]'
              }`}>
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col">
                    {/* Welcome Message */}
                    <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#f97316] to-[#34d399] flex items-center justify-center mb-4 shadow-lg">
                        <Sparkles className="w-8 h-8 text-white" />
                      </div>
                      <h4 className="text-lg font-semibold mb-2">Hi! I'm Vantage AI</h4>
                      <p className={`text-sm mb-6 ${textMuted}`}>
                        I can help you understand your financial data, analyze projects, and answer questions about your business.
                      </p>
                      
                      {/* Quick Actions */}
                      <div className="w-full space-y-2">
                        <p className={`text-xs font-medium uppercase tracking-wider mb-3 ${textMuted}`}>
                          Ask Questions
                        </p>
                        {[
                          { icon: '📊', text: "What's my overall gross margin?" },
                          { icon: '🏆', text: "Which project is most profitable?" },
                          { icon: '💰', text: "Summarize my cash position" },
                        ].map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setChatInput(suggestion.text)
                              setTimeout(() => sendChatMessage(), 100)
                            }}
                            className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all ${
                              theme === 'light' 
                                ? 'bg-white hover:bg-gray-100 border border-gray-200 hover:border-[#f97316]/50' 
                                : 'bg-[#1e1e1e] hover:bg-[#262626] border border-[#333333] hover:border-[#f97316]/50'
                            }`}
                          >
                            <span className="mr-2">{suggestion.icon}</span>
                            {suggestion.text}
                          </button>
                        ))}
                        
                        <p className={`text-xs font-medium uppercase tracking-wider mb-3 mt-4 ${textMuted}`}>
                          Take Action
                        </p>
                        {[
                          { icon: '🏷️', text: "Categorize all uncategorized transactions" },
                          { icon: '📁', text: "Assign all Google transactions to Google project" },
                        ].map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setChatInput(suggestion.text)
                              setTimeout(() => sendChatMessage(), 100)
                            }}
                            className={`w-full text-left px-4 py-3 rounded-xl text-sm transition-all ${
                              theme === 'light' 
                                ? 'bg-white hover:bg-gray-100 border border-gray-200 hover:border-blue-500/50' 
                                : 'bg-[#1e1e1e] hover:bg-[#262626] border border-[#333333] hover:border-blue-500/50'
                            }`}
                          >
                            <span className="mr-2">{suggestion.icon}</span>
                            {suggestion.text}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {chatMessages.map((msg, idx) => (
                      <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        {/* Avatar */}
                        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                          msg.role === 'user'
                            ? 'bg-[#f97316]'
                            : 'bg-gradient-to-br from-[#f97316] to-[#34d399]'
                        }`}>
                          {msg.role === 'user' 
                            ? <User className="w-4 h-4 text-[#121212]" />
                            : <Sparkles className="w-4 h-4 text-white" />
                          }
                        </div>
                        
                        {/* Message Bubble */}
                        <div className={`max-w-[85%] ${msg.role === 'user' ? 'text-right' : ''}`}>
                          <div className={`inline-block rounded-2xl px-4 py-3 text-sm ${
                            msg.role === 'user'
                              ? 'bg-[#f97316] text-[#121212] rounded-tr-md'
                              : theme === 'light' 
                                ? 'bg-white text-gray-800 border border-gray-200 rounded-tl-md' 
                                : 'bg-[#1e1e1e] text-[#f1f5f9] border border-[#333333] rounded-tl-md'
                          }`}>
                            <p className="whitespace-pre-wrap leading-relaxed text-left">{msg.content}</p>
                            
                            {/* Action Preview */}
                            {msg.action && msg.action.updates && msg.action.updates.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-[#333333]">
                                <p className="text-xs font-semibold mb-2 text-[#f97316]">
                                  📋 {msg.action.summary}
                                </p>
                                <div className="max-h-48 overflow-y-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-[#333333]">
                                        <th className="py-1 text-left">Description</th>
                                        <th className="py-1 text-right">Amount</th>
                                        <th className="py-1 text-left">Change</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {msg.action.updates.slice(0, 10).map((update, i) => (
                                        <tr key={i} className="border-b border-[#333333]/30">
                                          <td className="py-1.5 truncate max-w-[120px]" title={update.preview.description}>
                                            {update.preview.description.slice(0, 25)}{update.preview.description.length > 25 ? '...' : ''}
                                          </td>
                                          <td className="py-1.5 text-right font-mono">
                                            {formatCurrency(update.preview.amount)}
                                          </td>
                                          <td className="py-1.5">
                                            {update.preview.newCategory && (
                                              <span className="inline-block px-1.5 py-0.5 rounded bg-[#f97316]/20 text-[#f97316] mr-1">
                                                → {update.preview.newCategory}
                                              </span>
                                            )}
                                            {update.preview.newProject && (
                                              <span className="inline-block px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">
                                                → {update.preview.newProject}
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                  {msg.action.updates.length > 10 && (
                                    <p className="text-xs text-center mt-2 opacity-70">
                                      ... and {msg.action.updates.length - 10} more
                                    </p>
                                  )}
                                </div>
                                
                                {/* Action Buttons - only show if this is the pending action */}
                                {pendingChatAction && idx === chatMessages.length - 1 && (
                                  <div className="flex gap-2 mt-3">
                                    <button
                                      onClick={executeChatAction}
                                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-[#f97316] text-[#121212] rounded-lg text-xs font-semibold hover:bg-[#ea580c] transition-colors"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      Apply {msg.action.updates.length} Changes
                                    </button>
                                    <button
                                      onClick={cancelChatAction}
                                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500/20 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/30 transition-colors"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                      Cancel
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <p className={`text-xs mt-1 ${textMuted}`}>
                            {msg.role === 'user' ? 'You' : 'Vantage AI'}
                          </p>
                        </div>
                      </div>
                    ))}
                    
                    {/* Loading Indicator */}
                    {chatLoading && (
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-[#f97316] to-[#34d399] flex items-center justify-center">
                          <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div className={`rounded-2xl rounded-tl-md px-4 py-3 ${
                          theme === 'light' ? 'bg-white border border-gray-200' : 'bg-[#1e1e1e] border border-[#333333]'
                        }`}>
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-[#f97316] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <div className="w-2 h-2 bg-[#f97316] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <div className="w-2 h-2 bg-[#f97316] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
                {/* Scroll anchor */}
                <div ref={chatMessagesEndRef} />
              </div>
              
              {/* Input Area */}
              <div className={`p-4 border-t ${
                theme === 'light' ? 'border-gray-200 bg-white' : 'border-[#333333] bg-[#1e1e1e]'
              }`}>
                <div className={`flex items-end gap-3 rounded-xl p-2 ${
                  theme === 'light' ? 'bg-gray-100' : 'bg-[#121212]'
                }`}>
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendChatMessage()
                      }
                    }}
                    placeholder="Ask questions or request changes..."
                    rows={1}
                    className={`flex-1 px-3 py-2 bg-transparent resize-none text-sm outline-none max-h-32 ${
                      theme === 'light' ? 'placeholder:text-gray-400' : 'placeholder:text-[#64748b]'
                    }`}
                    style={{ minHeight: '40px' }}
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={!chatInput.trim() || chatLoading}
                    className="p-2.5 bg-[#f97316] text-[#121212] rounded-lg hover:bg-[#ea580c] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                <p className={`text-xs mt-2 text-center ${textMuted}`}>
                  Vantage AI can answer questions and make bulk updates
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Chat Toggle Button - Floating */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setChatOpen(!chatOpen)}
        className={`fixed bottom-6 right-6 z-40 print:hidden w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
          chatOpen 
            ? 'bg-[#333333] text-white scale-0 opacity-0' 
            : 'bg-gradient-to-br from-[#f97316] to-[#34d399] text-white hover:shadow-xl hover:shadow-[#f97316]/20 scale-100 opacity-100'
        }`}
      >
        <MessageSquare className="w-6 h-6" />
      </motion.button>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body { background: white !important; color: black !important; }
          .bg-neutral-900, .bg-neutral-800 { background: white !important; }
          .text-neutral-100, .text-neutral-200, .text-neutral-300, .text-neutral-400 { color: black !important; }
          .border-neutral-700 { border-color: #e5e5e5 !important; }
        }
      `}</style>
    </div>
  )
}
