'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Download, Calendar, Database, TrendingUp, TrendingDown,
  ChevronDown, Info, FileText, Moon, Sun, Filter
} from 'lucide-react'
import { supabase, getCurrentUser, fetchTransactions } from '@/lib/supabase'

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
  const [transactions, setTransactions] = useState<Transaction[]>([])
  
  // Filter state
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [startMonth, setStartMonth] = useState(1)
  const [endMonth, setEndMonth] = useState(12)
  
  // UI state
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')

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

        const txResult = await fetchTransactions(profile.company_id)

        if (txResult?.data) {
          setTransactions(txResult.data.map((t: any) => ({
            id: t.id,
            date: t.date,
            description: t.description,
            amount: t.amount,
            category: t.category,
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

  // Calculate P&L data
  const plData = useMemo(() => {
    const months: { [key: number]: { revenue: number; opex: number; overhead: number } } = {}
    
    // Initialize all months
    for (let m = 1; m <= 12; m++) {
      months[m] = { revenue: 0, opex: 0, overhead: 0 }
    }

    transactions.forEach(t => {
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
  }, [transactions, selectedYear, startMonth, endMonth])

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
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className={`p-2 rounded-lg ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-neutral-800'}`}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold">Monthly P&L Report</h1>
                <p className={`text-sm ${textMuted}`}>Cash basis analysis</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Year selector */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className={`px-3 py-1.5 rounded-lg border text-sm ${surfaceColor} ${borderColor} ${textPrimary}`}
              >
                {[2023, 2024, 2025, 2026].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              
              {/* Theme toggle */}
              <button
                onClick={() => {
                  const newTheme = theme === 'light' ? 'dark' : 'light'
                  setTheme(newTheme)
                  localStorage.setItem('vantage_theme', newTheme)
                }}
                className={`p-2 rounded-lg ${theme === 'light' ? 'hover:bg-slate-100' : 'hover:bg-neutral-800'}`}
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="max-w-7xl mx-auto px-6 py-6">
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
          </div>
        </div>
      </div>

      {/* P&L Table */}
      <div className="max-w-7xl mx-auto px-6 pb-8">
        <div className={`${surfaceColor} rounded-xl border ${borderColor} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={theme === 'light' ? 'bg-slate-50' : 'bg-neutral-900'}>
                  <th className={`px-6 py-4 text-left text-sm font-semibold sticky left-0 ${theme === 'light' ? 'bg-slate-50' : 'bg-neutral-900'}`}>
                    Category
                  </th>
                  {MONTHS.slice(startMonth - 1, endMonth).map((month) => (
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
    </div>
  )
}
