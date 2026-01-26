'use client'

import React, { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, DollarSign, FileText, ChevronRight, AlertTriangle } from 'lucide-react'
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
              <p className="text-2xl font-semibold mt-1 text-rose-500">{formatCurrency(expenses)}</p>
            </div>
            <div className="p-3 rounded-lg bg-rose-500/20">
              <TrendingDown size={24} className="text-rose-500" />
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl border bg-slate-800 border-slate-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Net Cash Flow</p>
              <p className={`text-2xl font-semibold mt-1 ${netCash >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {formatCurrency(netCash)}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${netCash >= 0 ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
              <DollarSign size={24} className={netCash >= 0 ? 'text-emerald-500' : 'text-rose-500'} />
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl border bg-slate-800 border-slate-700">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Accounts Receivable</p>
              <p className="text-2xl font-semibold mt-1 text-blue-500">{formatCurrency(totalAR)}</p>
              {overdueAR > 0 && <p className="text-sm text-amber-500 mt-1">{formatCurrency(overdueAR)} overdue</p>}
            </div>
            <div className="p-3 rounded-lg bg-blue-500/20">
              <FileText size={24} className="text-blue-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-6 rounded-xl border bg-slate-800 border-slate-700">
          <h2 className="font-semibold mb-4 text-slate-100">Quick Stats</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Active Projects</span>
              <span className="font-semibold text-slate-100">{projects.filter(p => p.status === 'active').length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Total Transactions</span>
              <span className="font-semibold text-slate-100">{transactions.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Open Invoices</span>
              <span className="font-semibold text-slate-100">{invoices.filter(i => (i.balance_due || 0) > 0).length}</span>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl border bg-slate-800 border-slate-700 lg:col-span-2">
          <h2 className="font-semibold mb-4 text-slate-100">Alerts</h2>
          {overdueAR > 0 ? (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-900">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <AlertTriangle size={18} className="text-amber-500" />
              </div>
              <div>
                <p className="font-medium text-slate-100">{formatCurrency(overdueAR)} overdue</p>
                <p className="text-sm text-slate-400">{invoices.filter(inv => (inv.days_overdue || 0) > 0).length} invoices need attention</p>
              </div>
            </div>
          ) : (
            <p className="text-slate-400 text-center py-8">No alerts at this time</p>
          )}
        </div>
      </div>

      <div className="p-6 rounded-xl border bg-slate-800 border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-100">Recent Transactions</h2>
          <Link href="/cash-flow" className="text-sm text-blue-500 hover:text-blue-400 font-medium flex items-center gap-1">
            View all <ChevronRight size={16} />
          </Link>
        </div>
        
        {transactions.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Description</th>
                <th className="pb-3 font-medium">Category</th>
                <th className="pb-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 5).map((tx) => (
                <tr key={tx.id} className="border-t border-slate-700">
                  <td className="py-3 text-slate-400">{tx.date}</td>
                  <td className="py-3 text-slate-100">{tx.description || '—'}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      tx.category === 'revenue' ? 'bg-emerald-500/20 text-emerald-500' : 
                      tx.category === 'overhead' ? 'bg-amber-500/20 text-amber-500' : 
                      'bg-rose-500/20 text-rose-500'
                    }`}>
                      {tx.category || 'uncategorized'}
                    </span>
                  </td>
                  <td className={`py-3 text-right font-medium ${tx.amount >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {formatCurrency(tx.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-slate-400 text-center py-8">No transactions yet</p>
        )}
      </div>
    </div>
  )
}
