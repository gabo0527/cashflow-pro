'use client'

import React, { useState, useCallback, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { 
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Save, Download, Plus, Trash2, Move, Settings,
  BarChart3, PieChart as PieChartIcon, TrendingUp, Table, Hash,
  Calendar, DollarSign, Users, Target, Layers, GripVertical,
  X, Check, ChevronDown, FileText, Image, Maximize2, Minimize2,
  Copy, MoreHorizontal, Moon, Sun
} from 'lucide-react'
import { supabase, getCurrentUser, fetchTransactions, fetchProjects, fetchClients } from '@/lib/supabase'

// Types
interface CanvasComponent {
  id: string
  type: 'kpi' | 'bar-chart' | 'line-chart' | 'pie-chart' | 'table' | 'text'
  x: number
  y: number
  width: number
  height: number
  config: {
    title?: string
    metric?: string
    dateRange?: { start: string; end: string }
    projectFilter?: string
    clientFilter?: string
    comparison?: 'none' | 'previous-period' | 'previous-year'
    dataSource?: 'cash' | 'accrual'
    showLegend?: boolean
    chartColors?: string[]
  }
}

interface DragState {
  isDragging: boolean
  componentId: string | null
  startX: number
  startY: number
  offsetX: number
  offsetY: number
}

const COMPONENT_PALETTE = [
  { type: 'kpi', label: 'KPI Card', icon: Hash, defaultSize: { width: 200, height: 120 } },
  { type: 'bar-chart', label: 'Bar Chart', icon: BarChart3, defaultSize: { width: 400, height: 300 } },
  { type: 'line-chart', label: 'Line Chart', icon: TrendingUp, defaultSize: { width: 400, height: 300 } },
  { type: 'pie-chart', label: 'Pie Chart', icon: PieChartIcon, defaultSize: { width: 300, height: 300 } },
  { type: 'table', label: 'Data Table', icon: Table, defaultSize: { width: 500, height: 300 } },
  { type: 'text', label: 'Text Block', icon: FileText, defaultSize: { width: 300, height: 100 } },
]

const METRICS = [
  { id: 'revenue', label: 'Revenue', color: '#34d399' },
  { id: 'expenses', label: 'Total Expenses', color: '#fb7185' },
  { id: 'opex', label: 'Operating Expenses', color: '#fb7185' },
  { id: 'overhead', label: 'Overhead', color: '#fbbf24' },
  { id: 'net-income', label: 'Net Income', color: '#2dd4bf' },
  { id: 'gross-margin', label: 'Gross Margin %', color: '#60a5fa' },
  { id: 'cash-balance', label: 'Cash Balance', color: '#34d399' },
]

const TIME_PRESETS = [
  { id: 'this-month', label: 'This Month' },
  { id: 'last-month', label: 'Last Month' },
  { id: 'this-quarter', label: 'This Quarter' },
  { id: 'last-quarter', label: 'Last Quarter' },
  { id: 'this-year', label: 'This Year' },
  { id: 'last-year', label: 'Last Year' },
  { id: 'last-12-months', label: 'Last 12 Months' },
  { id: 'custom', label: 'Custom Range' },
]

const generateId = () => Math.random().toString(36).substr(2, 9)

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

function ReportBuilderContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const canvasRef = useRef<HTMLDivElement>(null)
  
  // Auth & Data
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  
  // Theme
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  
  // Report State
  const [reportName, setReportName] = useState('Untitled Report')
  const [components, setComponents] = useState<CanvasComponent[]>([])
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null)
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    componentId: null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0
  })
  
  // UI State
  const [showComponentPalette, setShowComponentPalette] = useState(true)
  const [showProperties, setShowProperties] = useState(true)
  const [zoom, setZoom] = useState(100)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [loadedReportId, setLoadedReportId] = useState<string | null>(null)

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const { user } = await getCurrentUser()
        if (!user) {
          router.push('/login')
          return
        }

        // Get company_id from profile first
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single()

        if (!profile?.company_id) {
          console.error('No company found')
          setLoading(false)
          return
        }

        const [txResult, projectResult, clientResult] = await Promise.all([
          fetchTransactions(profile.company_id),
          fetchProjects(profile.company_id),
          fetchClients(profile.company_id)
        ])

        if (txResult?.data) setTransactions(txResult.data)
        if (projectResult?.data) setProjects(projectResult.data)
        if (clientResult?.data) setClients(clientResult.data)
        
        // Store company_id for saving reports
        setCompanyId(profile.company_id)
        
        // Load theme preference
        const savedTheme = localStorage.getItem('vantage_theme')
        if (savedTheme) setTheme(savedTheme as 'light' | 'dark')
        
        // Check if we need to load a saved report
        const loadReportId = searchParams.get('load')
        if (loadReportId) {
          const savedReports = JSON.parse(localStorage.getItem('vantage_saved_reports') || '[]')
          const reportToLoad = savedReports.find((r: any) => r.id === loadReportId)
          if (reportToLoad) {
            setReportName(reportToLoad.name)
            const config = reportToLoad.config || reportToLoad.canvas_config
            if (config) {
              setComponents(config.components || [])
              if (config.zoom) setZoom(config.zoom)
            }
            setLoadedReportId(loadReportId)
          }
        }
      } catch (error) {
        console.error('Error loading data:', error)
      }
      setLoading(false)
    }
    loadData()
  }, [router, searchParams])

  // Placeholder for rest of component
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Report Builder...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="p-8 text-center">
        <h1 className="text-2xl font-bold mb-4">Report Builder</h1>
        <p className="text-gray-600 mb-4">Loaded {transactions.length} transactions, {projects.length} projects</p>
        <button 
          onClick={() => router.back()}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg"
        >
          Go Back
        </button>
      </div>
    </div>
  )
}

// Wrapper component with Suspense for useSearchParams
export default function ReportBuilder() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Report Builder...</p>
        </div>
      </div>
    }>
      <ReportBuilderContent />
    </Suspense>
  )
}
