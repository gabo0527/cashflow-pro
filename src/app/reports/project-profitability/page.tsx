'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Download, Calendar, Database, TrendingUp, TrendingDown,
  ChevronDown, Info, Target, Moon, Sun, Filter, BarChart3
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { supabase, getCurrentUser, fetchTransactions, fetchAccrualTransactions, fetchProjects } from '@/lib/supabase'

type DataSource = 'cash' | 'accrual' | 'combined'

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function ProjectProfitabilityReport() {
  const router = useRouter()
  
  // Data state
  const [loading, setLoading] = useState(true)
  const [cashTransactions, setCashTransactions] = useState<any[]>([])
  const [accrualTransactions, setAccrualTransactions] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  
  // Filter state
  const [dataSource, setDataSource] = useState<DataSource>('cash')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [startMonth, setStartMonth] = useState(1)
  const [endMonth, setEndMonth] = useState(12)
  
  // UI state
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [showDataInfo, setShowDataInfo] = useState(false)
  const [sortBy, setSortBy] = useState<'revenue' | 'profit' | 'margin'>('profit')

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const { user } = await getCurrentUser()
        if (!user) {
          router.push('/login')
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single()

        if (!profile?.company_id) {
          setLoading(false)
          return
        }

        const [cashResult, accrualResult, projectsResult] = await Promise.all([
          fetchTransactions(profile.company_id),
          fetchAccrualTransactions(profile.company_id),
          fetchProjects(profile.company_id)
        ])

        if (cashResult?.data) setCashTransactions(cashResult.data)
        if (accrualResult?.data) setAccrualTransactions(accrualResult.data)
        if (projectsResult?.data) setProjects(projectsResult.data)

        const savedTheme = localStorage.getItem('vantage_theme')
        if (savedTheme) setTheme(savedTheme as 'light' | 'dark')
      } catch (error) {
        console.error('Error loading data:', error)
      }
      setLoading(false)
    }
    loadData()
  }, [router])

  // Get active transactions based on data source
  const activeTransactions = useMemo(() => {
    switch (dataSource) {
      case 'cash': return cashTransactions
      case 'accrual': return accrualTransactions
      case 'combined': return [...cashTransactions, ...accrualTransactions]
      default: return cashTransactions
    }
  }, [dataSource, cashTransactions, accrualTransactions])

  // Calculate project profitability
  const projectData = useMemo(() => {
    const projectMap: { [key: string]: { revenue: number; costs: number; color: string } } = {}
    
    // Initialize from projects list
    projects.forEach(p => {
      projectMap[p.name] = { revenue: 0, costs: 0, color: p.color || '#6b7280' }
    })

    activeTransactions.forEach(t => {
      if (!t.date || !t.project) return
      const txYear = parseInt(t.date.substring(0, 4))
      const txMonth = parseInt(t.date.substring(5, 7))
      
      if (txYear !== selectedYear) return
      if (txMonth < startMonth || txMonth > endMonth) return

      const projectName = t.project
      if (!projectMap[projectName]) {
        projectMap[projectName] = { revenue: 0, costs: 0, color: '#6b7280' }
      }

      const category = t.category?.toLowerCase() || ''
      const type = t.type?.toLowerCase() || ''
      
      if (category === 'revenue' || type === 'revenue') {
        projectMap[projectName].revenue += Math.abs(t.amount)
      } else if (category === 'opex' || type === 'direct_cost') {
        projectMap[projectName].costs += Math.abs(t.amount)
      }
    })

    return Object.entries(projectMap)
      .filter(([name, data]) => data.revenue > 0 || data.costs > 0)
      .map(([name, data]) => ({
        name,
        revenue: data.revenue,
        costs: data.costs,
        profit: data.revenue - data.costs,
        margin: data.revenue > 0 ? ((data.revenue - data.costs) / data.revenue * 100) : 0,
        color: data.color
      }))
      .sort((a, b) => {
        if (sortBy === 'revenue') return b.revenue - a.revenue
        if (sortBy === 'profit') return b.profit - a.profit
        return b.margin - a.margin
      })
  }, [activeTransactions, projects, selectedYear, startMonth, endMonth, sortBy])

  // Calculate totals
  const totals = useMemo(() => {
    return projectData.reduce((acc, p) => ({
      revenue: acc.revenue + p.revenue,
      costs: acc.costs + p.costs,
      profit: acc.profit + p.profit
    }), { revenue: 0, costs: 0, profit: 0 })
  }, [projectData])

  // Theme classes
  const bgColor = theme === 'light' ? 'bg-slate-50' : 'bg-[#0a0a0a]'
  const surfaceColor = theme === 'light' ? 'bg-white' : 'bg-[#141414]'
  const borderColor = theme === 'light' ? 'border-gray-200' : 'border-[#262626]'
  const textPrimary = theme === 'light' ? 'text-slate-900' : 'text-white'
  const textMuted = theme === 'light' ? 'text-slate-500' : 'text-neutral-400'

  const dataSourceInfo = {
    cash: { label: 'Cash Basis', color: 'bg-emerald-500' },
    accrual: { label: 'Accrual Basis', color: 'bg-blue-500' },
    combined: { label: 'Combined View', color: 'bg-purple-500' }
  }

  if (loading) {
    return (
      <div className={`min-h-screen ${bgColor} flex items-center justify-center`}>
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className={textMuted}>Loading report...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${bgColor} ${textPrimary}`}>
      {/* Header */}
      <header className={`sticky top-0 z-10 ${surfaceColor} border-b ${borderColor}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className={`p-2 rounded-lg ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-neutral-800'}`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold">Project Profitability</h1>
                <p className={`text-sm ${textMuted}`}>Revenue, costs, and margins by project</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className={`p-2 rounded-lg ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-neutral-800'}`}
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>
              <button className={`flex items-center gap-2 px-4 py-2 rounded-lg border ${borderColor} ${theme === 'light' ? 'hover:bg-slate-50' : 'hover:bg-neutral-800'}`}>
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Filters Bar */}
      <div className={`${surfaceColor} border-b ${borderColor} py-4`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-4">
            {/* Data Source Selector */}
            <div className="flex items-center gap-2">
              <Database className={`w-4 h-4 ${textMuted}`} />
              <span className={`text-sm ${textMuted}`}>Data:</span>
              <div className={`flex rounded-lg border ${borderColor} overflow-hidden`}>
                {(['cash', 'accrual', 'combined'] as DataSource[]).map(source => (
                  <button
                    key={source}
                    onClick={() => setDataSource(source)}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                      dataSource === source
                        ? 'bg-orange-500 text-white'
                        : theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-neutral-800'
                    }`}
                  >
                    {source.charAt(0).toUpperCase() + source.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className={`h-6 w-px ${theme === 'light' ? 'bg-slate-200' : 'bg-neutral-700'}`} />

            {/* Year & Month Range */}
            <div className="flex items-center gap-2">
              <Calendar className={`w-4 h-4 ${textMuted}`} />
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className={`px-3 py-1.5 rounded-lg border text-sm ${surfaceColor} ${borderColor} ${textPrimary}`}
              >
                {[2023, 2024, 2025, 2026].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <select
                value={startMonth}
                onChange={(e) => setStartMonth(Number(e.target.value))}
                className={`px-3 py-1.5 rounded-lg border text-sm ${surfaceColor} ${borderColor} ${textPrimary}`}
              >
                {MONTHS.map((month, idx) => (
                  <option key={idx} value={idx + 1}>{month}</option>
                ))}
              </select>
              <span className={textMuted}>-</span>
              <select
                value={endMonth}
                onChange={(e) => setEndMonth(Number(e.target.value))}
                className={`px-3 py-1.5 rounded-lg border text-sm ${surfaceColor} ${borderColor} ${textPrimary}`}
              >
                {MONTHS.map((month, idx) => (
                  <option key={idx} value={idx + 1}>{month}</option>
                ))}
              </select>
            </div>

            <div className={`h-6 w-px ${theme === 'light' ? 'bg-slate-200' : 'bg-neutral-700'}`} />

            {/* Sort By */}
            <div className="flex items-center gap-2">
              <Filter className={`w-4 h-4 ${textMuted}`} />
              <span className={`text-sm ${textMuted}`}>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className={`px-3 py-1.5 rounded-lg border text-sm ${surfaceColor} ${borderColor} ${textPrimary}`}
              >
                <option value="profit">By Profit</option>
                <option value="revenue">By Revenue</option>
                <option value="margin">By Margin</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Data Source Badge */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
          dataSource === 'cash' ? 'bg-emerald-500/10 text-emerald-500' :
          dataSource === 'accrual' ? 'bg-blue-500/10 text-blue-500' :
          'bg-purple-500/10 text-purple-500'
        }`}>
          <div className={`w-2 h-2 rounded-full ${dataSourceInfo[dataSource].color}`} />
          {dataSourceInfo[dataSource].label} • {selectedYear} • {MONTHS[startMonth-1]} - {MONTHS[endMonth-1]}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`${surfaceColor} rounded-xl p-4 border ${borderColor}`}>
            <p className={`text-sm ${textMuted} mb-1`}>Total Revenue</p>
            <p className="text-2xl font-bold text-emerald-500">{formatCurrency(totals.revenue)}</p>
          </div>
          <div className={`${surfaceColor} rounded-xl p-4 border ${borderColor}`}>
            <p className={`text-sm ${textMuted} mb-1`}>Direct Costs</p>
            <p className="text-2xl font-bold text-rose-500">{formatCurrency(totals.costs)}</p>
          </div>
          <div className={`${surfaceColor} rounded-xl p-4 border ${borderColor}`}>
            <p className={`text-sm ${textMuted} mb-1`}>Gross Profit</p>
            <p className={`text-2xl font-bold ${totals.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {formatCurrency(totals.profit)}
            </p>
          </div>
          <div className={`${surfaceColor} rounded-xl p-4 border ${borderColor}`}>
            <p className={`text-sm ${textMuted} mb-1`}>Avg. Margin</p>
            <p className="text-2xl font-bold text-blue-500">
              {totals.revenue > 0 ? ((totals.profit / totals.revenue) * 100).toFixed(1) : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className={`${surfaceColor} rounded-xl p-4 border ${borderColor}`}>
          <h3 className="font-semibold mb-4">Project Comparison</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={projectData.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'light' ? '#e5e7eb' : '#333'} />
                <XAxis type="number" tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} stroke={theme === 'light' ? '#6b7280' : '#9ca3af'} />
                <YAxis type="category" dataKey="name" width={120} stroke={theme === 'light' ? '#6b7280' : '#9ca3af'} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#34d399" radius={[0, 4, 4, 0]} />
                <Bar dataKey="costs" name="Direct Costs" fill="#fb7185" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Project Table */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className={`${surfaceColor} rounded-xl border ${borderColor} overflow-hidden`}>
          <table className="w-full">
            <thead>
              <tr className={theme === 'light' ? 'bg-slate-50' : 'bg-neutral-900'}>
                <th className="px-4 py-3 text-left text-sm font-semibold">Project</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Revenue</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Direct Costs</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Gross Profit</th>
                <th className="px-4 py-3 text-right text-sm font-semibold">Margin</th>
              </tr>
            </thead>
            <tbody>
              {projectData.map((project, idx) => (
                <tr key={project.name} className={`border-t ${borderColor} ${idx % 2 === 0 ? '' : theme === 'light' ? 'bg-slate-50/50' : 'bg-neutral-900/50'}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: project.color }} />
                      <span className="font-medium">{project.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-500">{formatCurrency(project.revenue)}</td>
                  <td className="px-4 py-3 text-right text-rose-500">{formatCurrency(project.costs)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${project.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {formatCurrency(project.profit)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-1 rounded text-sm ${
                      project.margin >= 30 ? 'bg-emerald-500/10 text-emerald-500' :
                      project.margin >= 15 ? 'bg-amber-500/10 text-amber-500' :
                      'bg-rose-500/10 text-rose-500'
                    }`}>
                      {project.margin.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
              {/* Totals Row */}
              <tr className={`border-t-2 ${borderColor} font-semibold ${theme === 'light' ? 'bg-slate-100' : 'bg-neutral-800'}`}>
                <td className="px-4 py-3">Total ({projectData.length} projects)</td>
                <td className="px-4 py-3 text-right text-emerald-500">{formatCurrency(totals.revenue)}</td>
                <td className="px-4 py-3 text-right text-rose-500">{formatCurrency(totals.costs)}</td>
                <td className={`px-4 py-3 text-right ${totals.profit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {formatCurrency(totals.profit)}
                </td>
                <td className="px-4 py-3 text-right">
                  {totals.revenue > 0 ? ((totals.profit / totals.revenue) * 100).toFixed(1) : 0}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
