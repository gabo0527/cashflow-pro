'use client'

import React, { useState, useEffect } from 'react'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  FileText, 
  ChevronRight,
  AlertTriangle
} from 'lucide-react'
import Link from 'next/link'
import { supabase, getCurrentUser, fetchTransactions, fetchInvoices, fetchProjects } from '@/lib/supabase'

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [transactions, setTransactions] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])

  useEffect(() => {
    const loadData = async () => {
      try {
        const { user } = await getCurrentUser()
        if (!user) return

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single()

        if (!profile?.company_id) {
          setLoading(false)
          return
        }

        const [txRes, invRes, projRes] = await Promise.all([
          fetchTransactions(profile.company_id),
          fetchInvoices(profile.company_id),
          fetchProjects(profile.company_id)
        ])

        setTransactions(txRes.data || [])
        setInvoices(invRes.data || [])
        setProjects(projRes.data || [])
      } catch (error) {
        console.error('Error loading dashboard:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Calculate KPIs
  const revenue = transactions.filter(t => t.category === 'revenue').reduce((sum, t) => sum + (t.amount || 0), 0)
  const expenses = transactions.filter(t => ['opex', 'overhead'].includes(t.category || '')).reduce((sum, t) => sum + Math.abs(t.amount || 0), 0)
  const netCash = revenue - expenses
  const totalAR = invoices.reduce((sum, inv) => sum + (inv.balance_due || 0), 0)
  const overdueAR = invoices.filter(inv => (inv.days_overdue || 0) > 0).reduce((sum, inv) => sum + (inv.balance_due || 0), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Dashboard</h1>
        <p className="text-sm mt-1 text-slate-400">Financial overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 rounded-xl border bg-slate-800 border-slate-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Total Revenue</p>
              <p className="text-2xl font-semibold mt-1 text-emerald-500">{formatCurrency(revenue)}</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/20">
              <TrendingUp size={24} className="text-emerald-500" />
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl border bg-slate-800 border-slate-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Total Expenses</p>
              <p className="text-2xl font-semibold mt-1 text-rose-500">{formatCu
