'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Download, Calendar, Database, TrendingUp, TrendingDown,
  ChevronDown, Info, FileText, Moon, Sun, Filter
} from 'lucide-react'
import { supabase, getCurrentUser, fetchTransactions, fetchAccrualTransactions } from '@/lib/supabase'

type DataSource = 'cash' | 'accrual' | 'combined'

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  category: string
  type?: string
  project?: string
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function MonthlyPLReport() {
  const router = useRouter()
  
  // Data state
  const [loading, setLoading] = useState(true)
  const [cashTransactions, setCashTransactions] = useState<Transaction[]>([])
  const [accrualTransactions, setAccrualTransactions] = useState<Transaction[]>([])
  
  // Filter state
  const [dataSource, setDataSource] = useState<DataSource>('cash')
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [startMonth, setStartMonth] = useState(1)
  const [endMonth, setEndMonth] = useState(12)
  
  // UI state
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [showDataInfo, setShowDataInfo] = useState(false)

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

        const [cashResult, accrualResult] = await Promise.all([
          fetchTransactions(profile.company_id),
          fetchAccrualTransactions(profile.company_id)
        ])

        if (cashResult?.data) {
          setCashTransactions(cashResult.data.map((t: any) => ({
            id: t.id,
            date: t.date,
            description: t.description,
            amount: t.amount,
            category: t.category,
            type: t.type,
            project: t.project
          })))
        }
        
        if (accrualResult?.data) {
          setAccrualTransactions(accrualResult.data.map((t: any) => ({
            id: t.id,
            date: t.date,
            description: t.description,
            amount: t.amount,
            category: t.category || (t.type === 'revenue' ? 'revenue' : 'opex'),
            type: t.type,
            project: t.project
          })))
        }

        // Load theme
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
      case 'cash':
        return cashTransactions
      case 'accrual':
        return accrualTransactions
      case 'combined':
        // Combine but avoid duplicates - prefer accrual for invoices
        return [...cashTransactions, ...accrualTransactions]
      default:
        return cashTransactions
    }
  }, [dataSource, cashTransactions, accrualTransactions])

  // Calculate P&L data
  const plData = useMemo(() => {
    const months: { [key: number]: { revenue: number; opex: number; overhead: number } } = {}
    
    // Initialize all months
    for (let m = 1; m <= 12; m++) {
      months[m] = { revenue: 0, opex: 0, overhead: 0 }
    }

    activeTransactions.forEach(t => {
      if (!t.date) return
      const txYear = parseInt(t.date.substring(0, 4))
      const txMonth = parseInt(t.date.substring(5, 7))
      
      if (txYear !== selectedYear) return
      if (txMonth < startMonth || txMonth > endMonth) return

      const category = t.category?.toLowerCase() || ''
      const type = t.type?.toLowerCase() || ''
      
      if (category === 'revenue' || type === 'revenue') {
        months[txMonth].revenue += Math.abs(t.amount)
      } else if (category === 'overhead') {
        months[txMonth].overhead += Math.abs(t.amount)
      } else if (category === 'opex' || type === 'direct_cost') {
        months[txMonth].opex += Math.abs(t.amount)
      }
    })

    return months
  }, [activeTransactions, selectedYear, startMonth, endMonth])

  // Calculate totals
  const totals = useMemo(() => {
    let revenue = 0, opex = 0, overhead = 0
    for (let m = startMonth; m <= endMonth; m++) {
      revenue += plData[m].revenue
      opex += plData[m].opex
      overhead += plData[m].overhead
    }
    return { revenue, opex, overhead, net: revenue - opex - overhead }
  }, [plData, startMonth, endMonth])

  // Theme classes
  const bgColor = theme === 'light' ? 'bg-slate-50' : 'bg-[#0a0a0a]'
  const surfaceColor = theme === 'light' ? 'bg-white' : 'bg-[#141414]'
  const borderColor = theme === 'light' ? 'border-gray-200' : 'border-[#262626]'
  const textPrimary = theme === 'light' ? 'text-slate-900' : 'text-white'
  const textMuted = theme === 'light' ? 'text-slate-500' : 'text-neutral-400'

  // Data source info
  const dataSourceInfo = {
    cash: {
      label: 'Cash Basis',
      description: 'Shows actual money received and paid. Revenue appears when payment hits your bank.',
      color: 'bg-emerald-500'
    },
    accrual: {
      label: 'Accrual Basis',
      description: 'Shows revenue when earned (invoiced) and expenses when incurred, regardless of payment.',
      color: 'bg-blue-500'
    },
    combined: {
      label: 'Combined View',
      description: 'Shows both cash and accrual transactions. May include duplicates if same transaction exists in both.',
      color: 'bg-purple-500'
    }
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
        <div className="px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/')}
                className={`p-2 rounded-lg ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-neutral-800'}`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-semibold">Monthly P&L Report</h1>
                <p className={`text-sm ${textMuted}`}>Profit & Loss by Month</p>
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
        <div className="px-6">
          <div className="flex flex-wrap items-center gap-4">
            {/* Data Source Selector */}
            <div className="flex items-center gap-2">
              <Database className={`w-4 h-4 ${textMuted}`} />
              <span className={`text-sm ${textMuted}`}>Data Source:</span>
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
              <button
                onClick={() => setShowDataInfo(!showDataInfo)}
                className={`p-1 rounded ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-neutral-800'}`}
              >
                <Info className={`w-4 h-4 ${textMuted}`} />
              </button>
            </div>

            <div className={`h-6 w-px ${theme === 'light' ? 'bg-slate-200' : 'bg-neutral-700'}`} />

            {/* Year Selector */}
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
            </div>

            {/* Month Range */}
            <div className="flex items-center gap-2">
              <span className={`text-sm ${textMuted}`}>From:</span>
              <select
                value={startMonth}
                onChange={(e) => setStartMonth(Number(e.target.value))}
                className={`px-3 py-1.5 rounded-lg border text-sm ${surfaceColor} ${borderColor} ${textPrimary}`}
              >
                {MONTHS.map((month, idx) => (
                  <option key={idx} value={idx + 1}>{month}</option>
                ))}
              </select>
              <span className={`text-sm ${textMuted}`}>To:</span>
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
          </div>

          {/* Data Source Info Banner */}
          {showDataInfo && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={`mt-4 p-4 rounded-lg border ${borderColor} ${theme === 'light' ? 'bg-slate-50' : 'bg-neutral-900'}`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-3 h-3 rounded-full mt-1 ${dataSourceInfo[dataSource].color}`} />
                <div>
                  <p className="font-medium">{dataSourceInfo[dataSource].label}</p>
                  <p className={`text-sm ${textMuted} mt-1`}>{dataSourceInfo[dataSource].description}</p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Data Source Badge */}
      <div className="px-6 py-4">
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
      <div className="px-6 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className={`${surfaceColor} rounded-xl p-4 border ${borderColor}`}>
            <p className={`text-sm ${textMuted} mb-1`}>Total Revenue</p>
            <p className="text-2xl font-bold text-emerald-500">{formatCurrency(totals.revenue)}</p>
          </div>
          <div className={`${surfaceColor} rounded-xl p-4 border ${borderColor}`}>
            <p className={`text-sm ${textMuted} mb-1`}>Operating Expenses</p>
            <p className="text-2xl font-bold text-rose-500">{formatCurrency(totals.opex)}</p>
          </div>
          <div className={`${surfaceColor} rounded-xl p-4 border ${borderColor}`}>
            <p className={`text-sm ${textMuted} mb-1`}>Overhead</p>
            <p className="text-2xl font-bold text-amber-500">{formatCurrency(totals.overhead)}</p>
          </div>
          <div className={`${surfaceColor} rounded-xl p-4 border ${borderColor}`}>
            <p className={`text-sm ${textMuted} mb-1`}>Net Income</p>
            <p className={`text-2xl font-bold ${totals.net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {formatCurrency(totals.net)}
            </p>
            {totals.revenue > 0 && (
              <p className={`text-xs ${textMuted} mt-1`}>
                {((totals.net / totals.revenue) * 100).toFixed(1)}% margin
              </p>
            )}
          </div>
        </div>
      </div>

      {/* P&L Table - Full Width */}
      <div className="px-6 pb-8">
        <div className={`${surfaceColor} rounded-xl border ${borderColor} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={theme === 'light' ? 'bg-slate-50' : 'bg-neutral-900'}>
                  <th className={`px-6 py-4 text-left text-sm font-semibold sticky left-0 ${theme === 'light' ? 'bg-slate-50' : 'bg-neutral-900'}`}>
                    Category
                  </th>
                  {MONTHS.slice(startMonth - 1, endMonth).map((month, idx) => (
                    <th key={month} className="px-6 py-4 text-right text-sm font-semibold whitespace-nowrap">
                      {month} {selectedYear}
                    </th>
                  ))}
                  <th className={`px-6 py-4 text-right text-sm font-semibold whitespace-nowrap ${theme === 'light' ? 'bg-slate-100' : 'bg-neutral-800'}`}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* Revenue */}
                <tr className={`border-t ${borderColor}`}>
                  <td className={`px-6 py-4 font-medium text-emerald-500 sticky left-0 ${surfaceColor}`}>
                    Revenue
                  </td>
                  {Array.from({ length: endMonth - startMonth + 1 }, (_, i) => startMonth + i).map(month => (
                    <td key={month} className="px-6 py-4 text-right text-emerald-500 whitespace-nowrap">
                      {formatCurrency(plData[month].revenue)}
                    </td>
                  ))}
                  <td className={`px-6 py-4 text-right font-semibold text-emerald-500 whitespace-nowrap ${theme === 'light' ? 'bg-slate-50' : 'bg-neutral-900'}`}>
                    {formatCurrency(totals.revenue)}
                  </td>
                </tr>

                {/* Operating Expenses */}
                <tr className={`border-t ${borderColor}`}>
                  <td className={`px-6 py-4 font-medium text-rose-500 sticky left-0 ${surfaceColor}`}>
                    Operating Expenses
                  </td>
                  {Array.from({ length: endMonth - startMonth + 1 }, (_, i) => startMonth + i).map(month => (
                    <td key={month} className="px-6 py-4 text-right text-rose-500 whitespace-nowrap">
                      {formatCurrency(plData[month].opex)}
                    </td>
                  ))}
                  <td className={`px-6 py-4 text-right font-semibold text-rose-500 whitespace-nowrap ${theme === 'light' ? 'bg-slate-50' : 'bg-neutral-900'}`}>
                    {formatCurrency(totals.opex)}
                  </td>
                </tr>

                {/* Overhead */}
                <tr className={`border-t ${borderColor}`}>
                  <td className={`px-6 py-4 font-medium text-amber-500 sticky left-0 ${surfaceColor}`}>
                    Overhead
                  </td>
                  {Array.from({ length: endMonth - startMonth + 1 }, (_, i) => startMonth + i).map(month => (
                    <td key={month} className="px-6 py-4 text-right text-amber-500 whitespace-nowrap">
                      {formatCurrency(plData[month].overhead)}
                    </td>
                  ))}
                  <td className={`px-6 py-4 text-right font-semibold text-amber-500 whitespace-nowrap ${theme === 'light' ? 'bg-slate-50' : 'bg-neutral-900'}`}>
                    {formatCurrency(totals.overhead)}
                  </td>
                </tr>

                {/* Net Income */}
                <tr className={`border-t-2 ${borderColor} ${theme === 'light' ? 'bg-slate-50' : 'bg-neutral-900'}`}>
                  <td className={`px-6 py-4 font-semibold sticky left-0 ${theme === 'light' ? 'bg-slate-50' : 'bg-neutral-900'}`}>
                    Net Income
                  </td>
                  {Array.from({ length: endMonth - startMonth + 1 }, (_, i) => startMonth + i).map(month => {
                    const net = plData[month].revenue - plData[month].opex - plData[month].overhead
                    return (
                      <td key={month} className={`px-6 py-4 text-right font-semibold whitespace-nowrap ${net >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {formatCurrency(net)}
                      </td>
                    )
                  })}
                  <td className={`px-6 py-4 text-right font-bold text-lg whitespace-nowrap ${totals.net >= 0 ? 'text-emerald-500' : 'text-rose-500'} ${theme === 'light' ? 'bg-slate-100' : 'bg-neutral-800'}`}>
                    {formatCurrency(totals.net)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Data Source Legend */}
      <div className="px-6 pb-8">
        <div className={`${surfaceColor} rounded-xl p-4 border ${borderColor}`}>
          <h3 className="font-semibold mb-3">Understanding Your Data</h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1" />
              <div>
                <p className="font-medium">Cash Basis</p>
                <p className={textMuted}>Actual bank transactions. Revenue when paid, expenses when withdrawn.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-500 mt-1" />
              <div>
                <p className="font-medium">Accrual Basis</p>
                <p className={textMuted}>Invoice-based. Revenue when invoiced, expenses when incurred.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-purple-500 mt-1" />
              <div>
                <p className="font-medium">Combined</p>
                <p className={textMuted}>Both sources combined. Use for full picture, but watch for duplicates.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
