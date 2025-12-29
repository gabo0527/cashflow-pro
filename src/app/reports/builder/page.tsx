'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
import { supabase, getCurrentUser, fetchTransactions, fetchAccrualTransactions, fetchProjects, fetchClients } from '@/lib/supabase'

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

export default function ReportBuilder() {
  const router = useRouter()
  const canvasRef = useRef<HTMLDivElement>(null)
  
  // Auth & Data
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])
  const [accrualTransactions, setAccrualTransactions] = useState<any[]>([])
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

        const [txResult, accrualResult, projectResult, clientResult] = await Promise.all([
          fetchTransactions(profile.company_id),
          fetchAccrualTransactions(profile.company_id),
          fetchProjects(profile.company_id),
          fetchClients(profile.company_id)
        ])

        if (txResult?.data) setTransactions(txResult.data)
        if (accrualResult?.data) setAccrualTransactions(accrualResult.data)
        if (projectResult?.data) setProjects(projectResult.data)
        if (clientResult?.data) setClients(clientResult.data)
        
        // Load theme preference
        const savedTheme = localStorage.getItem('vantage_theme')
        if (savedTheme) setTheme(savedTheme as 'light' | 'dark')
      } catch (error) {
        console.error('Error loading data:', error)
      }
      setLoading(false)
    }
    loadData()
  }, [router])

  // Add component to canvas
  const addComponent = useCallback((type: string) => {
    const palette = COMPONENT_PALETTE.find(p => p.type === type)
    if (!palette) return

    const newComponent: CanvasComponent = {
      id: generateId(),
      type: type as CanvasComponent['type'],
      x: 50 + (components.length * 20) % 200,
      y: 50 + (components.length * 20) % 200,
      width: palette.defaultSize.width,
      height: palette.defaultSize.height,
      config: {
        title: `${palette.label}`,
        metric: 'revenue',
        dateRange: { start: `${new Date().getFullYear()}-01`, end: `${new Date().getFullYear()}-12` },
        projectFilter: 'all',
        clientFilter: 'all',
        comparison: 'none',
        dataSource: 'cash',
        showLegend: true,
        chartColors: ['#34d399', '#fb7185', '#fbbf24', '#60a5fa']
      }
    }
    
    setComponents(prev => [...prev, newComponent])
    setSelectedComponent(newComponent.id)
  }, [components.length])

  // Delete component
  const deleteComponent = useCallback((id: string) => {
    setComponents(prev => prev.filter(c => c.id !== id))
    if (selectedComponent === id) setSelectedComponent(null)
  }, [selectedComponent])

  // Duplicate component
  const duplicateComponent = useCallback((id: string) => {
    const component = components.find(c => c.id === id)
    if (!component) return
    
    const newComponent: CanvasComponent = {
      ...component,
      id: generateId(),
      x: component.x + 30,
      y: component.y + 30
    }
    setComponents(prev => [...prev, newComponent])
    setSelectedComponent(newComponent.id)
  }, [components])

  // Update component config
  const updateComponentConfig = useCallback((id: string, updates: Partial<CanvasComponent['config']>) => {
    setComponents(prev => prev.map(c => 
      c.id === id ? { ...c, config: { ...c.config, ...updates } } : c
    ))
  }, [])

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent, componentId: string) => {
    e.preventDefault()
    const component = components.find(c => c.id === componentId)
    if (!component) return

    setDragState({
      isDragging: true,
      componentId,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - component.x,
      offsetY: e.clientY - component.y
    })
    setSelectedComponent(componentId)
  }, [components])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.componentId) return

    const canvasRect = canvasRef.current?.getBoundingClientRect()
    if (!canvasRect) return

    const newX = Math.max(0, e.clientX - canvasRect.left - dragState.offsetX + canvasRect.left)
    const newY = Math.max(0, e.clientY - canvasRect.top - dragState.offsetY + canvasRect.top)

    setComponents(prev => prev.map(c => 
      c.id === dragState.componentId 
        ? { ...c, x: e.clientX - dragState.offsetX, y: e.clientY - dragState.offsetY }
        : c
    ))
  }, [dragState])

  const handleMouseUp = useCallback(() => {
    setDragState({
      isDragging: false,
      componentId: null,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0
    })
  }, [])

  // Calculate metric value
  const calculateMetric = useCallback((metric: string, config: CanvasComponent['config']) => {
    const data = config.dataSource === 'accrual' ? accrualTransactions : transactions
    const year = new Date().getFullYear()
    
    const filtered = data.filter(t => {
      if (config.projectFilter && config.projectFilter !== 'all') {
        if (t.project !== config.projectFilter) return false
      }
      return true
    })

    switch (metric) {
      case 'revenue':
        return filtered.filter(t => t.category === 'revenue' || t.type === 'revenue').reduce((sum, t) => sum + Math.abs(t.amount), 0)
      case 'expenses':
      case 'opex':
        return filtered.filter(t => t.category === 'opex' || t.type === 'direct_cost').reduce((sum, t) => sum + Math.abs(t.amount), 0)
      case 'overhead':
        return filtered.filter(t => t.category === 'overhead').reduce((sum, t) => sum + Math.abs(t.amount), 0)
      case 'net-income':
        const rev = filtered.filter(t => t.category === 'revenue' || t.type === 'revenue').reduce((sum, t) => sum + t.amount, 0)
        const exp = filtered.filter(t => t.category !== 'revenue' && t.type !== 'revenue').reduce((sum, t) => sum + t.amount, 0)
        return rev + exp
      case 'gross-margin':
        const revenue = filtered.filter(t => t.category === 'revenue' || t.type === 'revenue').reduce((sum, t) => sum + t.amount, 0)
        const costs = filtered.filter(t => t.category === 'opex' || t.type === 'direct_cost').reduce((sum, t) => sum + Math.abs(t.amount), 0)
        return revenue > 0 ? ((revenue - costs) / revenue * 100) : 0
      default:
        return 0
    }
  }, [transactions, accrualTransactions])

  // Generate chart data
  const generateChartData = useCallback((config: CanvasComponent['config']) => {
    const data = config.dataSource === 'accrual' ? accrualTransactions : transactions
    const months: { [key: string]: { revenue: number; expenses: number; net: number } } = {}
    
    data.forEach(t => {
      const month = t.date?.substring(0, 7)
      if (!month) return
      
      if (!months[month]) {
        months[month] = { revenue: 0, expenses: 0, net: 0 }
      }
      
      if (t.category === 'revenue' || t.type === 'revenue') {
        months[month].revenue += Math.abs(t.amount)
      } else {
        months[month].expenses += Math.abs(t.amount)
      }
      months[month].net = months[month].revenue - months[month].expenses
    })

    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, values]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        ...values
      }))
  }, [transactions, accrualTransactions])

  // Theme classes
  const bgColor = theme === 'light' ? 'bg-slate-100' : 'bg-[#121212]'
  const surfaceColor = theme === 'light' ? 'bg-white' : 'bg-[#1e1e1e]'
  const borderColor = theme === 'light' ? 'border-gray-200' : 'border-[#333]'
  const textPrimary = theme === 'light' ? 'text-slate-900' : 'text-white'
  const textMuted = theme === 'light' ? 'text-slate-500' : 'text-neutral-400'

  const selectedComponentData = components.find(c => c.id === selectedComponent)

  if (loading) {
    return (
      <div className={`min-h-screen ${bgColor} flex items-center justify-center`}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className={textMuted}>Loading Report Builder...</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      className={`min-h-screen ${bgColor} ${textPrimary} flex flex-col`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Header */}
      <header className={`${surfaceColor} border-b ${borderColor} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className={`p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 ${textMuted}`}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="h-6 w-px bg-slate-200 dark:bg-neutral-700" />
          <input
            type="text"
            value={reportName}
            onChange={(e) => setReportName(e.target.value)}
            className={`text-lg font-semibold bg-transparent border-none outline-none focus:ring-2 focus:ring-orange-500 rounded px-2 py-1 ${textPrimary}`}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className={`p-2 rounded-lg ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-neutral-800'}`}
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>
          <div className="h-6 w-px bg-slate-200 dark:bg-neutral-700" />
          <select
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className={`px-3 py-2 rounded-lg text-sm ${surfaceColor} border ${borderColor}`}
          >
            <option value={50}>50%</option>
            <option value={75}>75%</option>
            <option value={100}>100%</option>
            <option value={125}>125%</option>
            <option value={150}>150%</option>
          </select>
          <div className="h-6 w-px bg-slate-200 dark:bg-neutral-700" />
          <button className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${borderColor} ${theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-neutral-800'}`}>
            <Download className="w-4 h-4" />
            Export
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">
            <Save className="w-4 h-4" />
            Save Report
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Component Palette */}
        <AnimatePresence>
          {showComponentPalette && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className={`${surfaceColor} border-r ${borderColor} flex flex-col overflow-hidden`}
            >
              <div className="p-4 border-b border-inherit">
                <h3 className="font-semibold text-sm">Components</h3>
                <p className={`text-xs ${textMuted} mt-1`}>Click to add to canvas</p>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {COMPONENT_PALETTE.map(item => (
                  <button
                    key={item.type}
                    onClick={() => addComponent(item.type)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                      theme === 'light' 
                        ? 'hover:bg-slate-100 border border-transparent hover:border-slate-200' 
                        : 'hover:bg-neutral-800 border border-transparent hover:border-neutral-700'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      theme === 'light' ? 'bg-orange-50' : 'bg-orange-500/10'
                    }`}>
                      <item.icon className="w-5 h-5 text-orange-500" />
                    </div>
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
              
              {/* Time Period Quick Add */}
              <div className="p-4 border-t border-inherit">
                <h4 className={`text-xs font-medium ${textMuted} mb-2`}>QUICK ADD</h4>
                <div className="grid grid-cols-2 gap-2">
                  {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
                    <button
                      key={q}
                      onClick={() => {
                        addComponent('kpi')
                        // Could pre-configure with quarter data
                      }}
                      className={`px-3 py-2 rounded-lg text-xs font-medium ${
                        theme === 'light' ? 'bg-slate-100 hover:bg-slate-200' : 'bg-neutral-800 hover:bg-neutral-700'
                      }`}
                    >
                      {q} {new Date().getFullYear()}
                    </button>
                  ))}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Toggle Left Sidebar */}
        <button
          onClick={() => setShowComponentPalette(!showComponentPalette)}
          className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1 rounded-r-lg ${surfaceColor} border ${borderColor} border-l-0`}
          style={{ left: showComponentPalette ? 240 : 0 }}
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${showComponentPalette ? '-rotate-90' : 'rotate-90'}`} />
        </button>

        {/* Canvas */}
        <div 
          ref={canvasRef}
          className={`flex-1 overflow-auto p-8 ${theme === 'light' ? 'bg-slate-100' : 'bg-[#0a0a0a]'}`}
          onClick={(e) => {
            if (e.target === canvasRef.current) {
              setSelectedComponent(null)
            }
          }}
          style={{
            backgroundImage: theme === 'light' 
              ? 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)'
              : 'radial-gradient(circle, #333 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        >
          <div 
            className="relative min-h-[800px] min-w-[1000px]"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}
          >
            {/* Empty state */}
            {components.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className={`w-16 h-16 rounded-2xl ${theme === 'light' ? 'bg-slate-200' : 'bg-neutral-800'} flex items-center justify-center mx-auto mb-4`}>
                    <Layers className={`w-8 h-8 ${textMuted}`} />
                  </div>
                  <h3 className="font-semibold mb-2">Start Building Your Report</h3>
                  <p className={`text-sm ${textMuted} mb-4`}>Add components from the left panel</p>
                  <button
                    onClick={() => addComponent('kpi')}
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm"
                  >
                    Add First Component
                  </button>
                </div>
              </div>
            )}

            {/* Components */}
            {components.map(component => (
              <div
                key={component.id}
                className={`absolute rounded-xl border-2 transition-shadow ${
                  selectedComponent === component.id
                    ? 'border-orange-500 shadow-lg shadow-orange-500/20'
                    : `${borderColor} hover:border-orange-300`
                } ${surfaceColor} overflow-hidden`}
                style={{
                  left: component.x,
                  top: component.y,
                  width: component.width,
                  height: component.height,
                  cursor: dragState.isDragging && dragState.componentId === component.id ? 'grabbing' : 'grab'
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedComponent(component.id)
                }}
              >
                {/* Component Header */}
                <div 
                  className={`flex items-center justify-between px-3 py-2 border-b ${borderColor} cursor-grab active:cursor-grabbing`}
                  onMouseDown={(e) => handleMouseDown(e, component.id)}
                >
                  <div className="flex items-center gap-2">
                    <GripVertical className={`w-4 h-4 ${textMuted}`} />
                    <span className="text-sm font-medium truncate">{component.config.title}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); duplicateComponent(component.id) }}
                      className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-neutral-800 ${textMuted}`}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteComponent(component.id) }}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-500/20 text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Component Content */}
                <div className="p-3 h-[calc(100%-40px)] overflow-hidden">
                  {component.type === 'kpi' && (
                    <div className="h-full flex flex-col justify-center">
                      <p className={`text-xs ${textMuted} mb-1`}>
                        {METRICS.find(m => m.id === component.config.metric)?.label || 'Metric'}
                      </p>
                      <p className="text-2xl font-bold" style={{ color: METRICS.find(m => m.id === component.config.metric)?.color }}>
                        {component.config.metric === 'gross-margin' 
                          ? `${calculateMetric(component.config.metric || 'revenue', component.config).toFixed(1)}%`
                          : formatCurrency(calculateMetric(component.config.metric || 'revenue', component.config))
                        }
                      </p>
                    </div>
                  )}

                  {component.type === 'bar-chart' && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={generateChartData(component.config)}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e5e7eb' : '#333'} />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke={theme === 'light' ? '#6b7280' : '#9ca3af'} />
                        <YAxis tick={{ fontSize: 10 }} stroke={theme === 'light' ? '#6b7280' : '#9ca3af'} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        {component.config.showLegend && <Legend />}
                        <Bar dataKey="revenue" name="Revenue" fill="#34d399" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="expenses" name="Expenses" fill="#fb7185" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}

                  {component.type === 'line-chart' && (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={generateChartData(component.config)}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e5e7eb' : '#333'} />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke={theme === 'light' ? '#6b7280' : '#9ca3af'} />
                        <YAxis tick={{ fontSize: 10 }} stroke={theme === 'light' ? '#6b7280' : '#9ca3af'} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        {component.config.showLegend && <Legend />}
                        <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#34d399" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="net" name="Net" stroke="#60a5fa" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}

                  {component.type === 'pie-chart' && (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'OpEx', value: calculateMetric('opex', component.config) },
                            { name: 'Overhead', value: calculateMetric('overhead', component.config) },
                          ]}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          <Cell fill="#fb7185" />
                          <Cell fill="#fbbf24" />
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}

                  {component.type === 'table' && (
                    <div className="overflow-auto h-full">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className={theme === 'light' ? 'bg-slate-50' : 'bg-neutral-800'}>
                            <th className="px-2 py-1.5 text-left font-medium">Month</th>
                            <th className="px-2 py-1.5 text-right font-medium">Revenue</th>
                            <th className="px-2 py-1.5 text-right font-medium">Expenses</th>
                            <th className="px-2 py-1.5 text-right font-medium">Net</th>
                          </tr>
                        </thead>
                        <tbody>
                          {generateChartData(component.config).slice(-6).map((row, idx) => (
                            <tr key={idx} className={`border-t ${borderColor}`}>
                              <td className="px-2 py-1.5">{row.month}</td>
                              <td className="px-2 py-1.5 text-right text-emerald-500">{formatCurrency(row.revenue)}</td>
                              <td className="px-2 py-1.5 text-right text-rose-500">{formatCurrency(row.expenses)}</td>
                              <td className={`px-2 py-1.5 text-right font-medium ${row.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {formatCurrency(row.net)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {component.type === 'text' && (
                    <textarea
                      className={`w-full h-full resize-none text-sm bg-transparent outline-none ${textPrimary}`}
                      placeholder="Enter text..."
                      defaultValue={component.config.title}
                      onChange={(e) => updateComponentConfig(component.id, { title: e.target.value })}
                    />
                  )}
                </div>

                {/* Resize handle */}
                <div 
                  className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
                  style={{
                    background: `linear-gradient(135deg, transparent 50%, ${theme === 'light' ? '#cbd5e1' : '#525252'} 50%)`
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar - Properties */}
        <AnimatePresence>
          {showProperties && selectedComponentData && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 280, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className={`${surfaceColor} border-l ${borderColor} flex flex-col overflow-hidden`}
            >
              <div className="p-4 border-b border-inherit flex items-center justify-between">
                <h3 className="font-semibold text-sm">Properties</h3>
                <button
                  onClick={() => setSelectedComponent(null)}
                  className={`p-1 rounded ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-neutral-800'}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Title */}
                <div>
                  <label className={`text-xs font-medium ${textMuted} block mb-1.5`}>Title</label>
                  <input
                    type="text"
                    value={selectedComponentData.config.title || ''}
                    onChange={(e) => updateComponentConfig(selectedComponentData.id, { title: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${surfaceColor} ${borderColor}`}
                  />
                </div>

                {/* Metric (for KPI) */}
                {selectedComponentData.type === 'kpi' && (
                  <div>
                    <label className={`text-xs font-medium ${textMuted} block mb-1.5`}>Metric</label>
                    <select
                      value={selectedComponentData.config.metric || 'revenue'}
                      onChange={(e) => updateComponentConfig(selectedComponentData.id, { metric: e.target.value })}
                      className={`w-full px-3 py-2 rounded-lg border text-sm ${surfaceColor} ${borderColor}`}
                    >
                      {METRICS.map(m => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Data Source */}
                <div>
                  <label className={`text-xs font-medium ${textMuted} block mb-1.5`}>Data Source</label>
                  <select
                    value={selectedComponentData.config.dataSource || 'cash'}
                    onChange={(e) => updateComponentConfig(selectedComponentData.id, { dataSource: e.target.value as 'cash' | 'accrual' })}
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${surfaceColor} ${borderColor}`}
                  >
                    <option value="cash">Cash Transactions</option>
                    <option value="accrual">Accrual (Invoices)</option>
                  </select>
                </div>

                {/* Project Filter */}
                <div>
                  <label className={`text-xs font-medium ${textMuted} block mb-1.5`}>Project Filter</label>
                  <select
                    value={selectedComponentData.config.projectFilter || 'all'}
                    onChange={(e) => updateComponentConfig(selectedComponentData.id, { projectFilter: e.target.value })}
                    className={`w-full px-3 py-2 rounded-lg border text-sm ${surfaceColor} ${borderColor}`}
                  >
                    <option value="all">All Projects</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Show Legend (for charts) */}
                {['bar-chart', 'line-chart'].includes(selectedComponentData.type) && (
                  <div className="flex items-center justify-between">
                    <label className={`text-xs font-medium ${textMuted}`}>Show Legend</label>
                    <button
                      onClick={() => updateComponentConfig(selectedComponentData.id, { showLegend: !selectedComponentData.config.showLegend })}
                      className={`w-10 h-6 rounded-full transition-colors ${
                        selectedComponentData.config.showLegend ? 'bg-orange-500' : theme === 'light' ? 'bg-slate-200' : 'bg-neutral-700'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        selectedComponentData.config.showLegend ? 'translate-x-5' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                )}

                {/* Size */}
                <div>
                  <label className={`text-xs font-medium ${textMuted} block mb-1.5`}>Size</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={`text-xs ${textMuted}`}>Width</label>
                      <input
                        type="number"
                        value={selectedComponentData.width}
                        onChange={(e) => setComponents(prev => prev.map(c => 
                          c.id === selectedComponentData.id ? { ...c, width: Number(e.target.value) } : c
                        ))}
                        className={`w-full px-3 py-2 rounded-lg border text-sm ${surfaceColor} ${borderColor}`}
                      />
                    </div>
                    <div>
                      <label className={`text-xs ${textMuted}`}>Height</label>
                      <input
                        type="number"
                        value={selectedComponentData.height}
                        onChange={(e) => setComponents(prev => prev.map(c => 
                          c.id === selectedComponentData.id ? { ...c, height: Number(e.target.value) } : c
                        ))}
                        className={`w-full px-3 py-2 rounded-lg border text-sm ${surfaceColor} ${borderColor}`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Delete Button */}
              <div className="p-4 border-t border-inherit">
                <button
                  onClick={() => deleteComponent(selectedComponentData.id)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Component
                </button>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
