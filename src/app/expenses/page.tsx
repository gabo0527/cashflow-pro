'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  Receipt, Download, ChevronDown, Plus, PieChart, 
  LayoutList, Landmark, RefreshCw, Settings
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/supabase'
import { THEME, EXPENSE_CATEGORIES, CategoryManager } from '@/components/expenses/shared'
import OverviewSection from '@/components/expenses/OverviewSection'
import ExpensesSection, { ExpensesSectionHandle } from '@/components/expenses/ExpensesSection'
import BankFeedSection from '@/components/expenses/BankFeedSection'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

type TabType = 'overview' | 'expenses' | 'bankfeed'

export default function ExpensesPage() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [companyId, setCompanyId] = useState<string | null>(null)
  
  // Period filters
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<string>('all')

  // Data
  const [expenses, setExpenses] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false)

  // Category management
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [customCategories, setCustomCategories] = useState(EXPENSE_CATEGORIES)

  // Ref for Expenses section
  const expensesSectionRef = useRef<ExpensesSectionHandle>(null)

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await getCurrentUser()
        const user = result?.user
        if (!user) { setLoading(false); return }

        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
        if (!profile?.company_id) { setLoading(false); return }

        setCompanyId(profile.company_id)

        const [expRes, txnRes, projRes, clientRes, teamRes] = await Promise.all([
          supabase.from('expenses').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
          supabase.from('transactions').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
          supabase.from('projects').select('*').eq('company_id', profile.company_id).order('name'),
          supabase.from('clients').select('*').eq('company_id', profile.company_id).order('name'),
          supabase.from('team_members').select('id, name').eq('company_id', profile.company_id).order('name')
        ])

        setExpenses((expRes.data || []).map(e => ({ ...e, amount: parseFloat(e.amount || 0) })))
        setTransactions((txnRes.data || []).map(t => ({ ...t, amount: parseFloat(t.amount || 0) })))
        setProjects(projRes.data || [])
        setClients(clientRes.data || [])
        setTeamMembers(teamRes.data || [])

        // Load custom categories from company_settings
        const { data: settings } = await supabase
          .from('company_settings')
          .select('expense_categories')
          .eq('company_id', profile.company_id)
          .single()
        
        if (settings?.expense_categories) {
          setCustomCategories(settings.expense_categories)
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // ============ HANDLERS ============
  const handleAddExpense = async (expense: any) => {
    if (!companyId) return
    const newExpense = { company_id: companyId, ...expense }
    const { data, error } = await supabase.from('expenses').insert(newExpense).select().single()
    if (error) { console.error('Error adding expense:', error); alert('Failed to add expense'); return }
    setExpenses(prev => [{ ...data, amount: parseFloat(data.amount || 0) }, ...prev])
  }

  const handleUpdateExpense = async (id: string, updates: any) => {
    const { error } = await supabase.from('expenses').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { console.error('Error updating expense:', error); return }
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
  }

  const handleDeleteExpense = async (id: string) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) { console.error('Error deleting expense:', error); return }
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  const handleCategorizeTransaction = async (transactionId: string, expenseData: any) => {
    if (!companyId) return
    
    // Create expense from transaction
    const newExpense = { company_id: companyId, ...expenseData }
    const { data, error } = await supabase.from('expenses').insert(newExpense).select().single()
    if (error) { console.error('Error creating expense:', error); alert('Failed to categorize transaction'); return }
    
    setExpenses(prev => [{ ...data, amount: parseFloat(data.amount || 0) }, ...prev])
  }

  const handleSkipTransaction = async (transactionId: string) => {
    const { error } = await supabase.from('transactions').update({ skipped: true }).eq('id', transactionId)
    if (error) { console.error('Error skipping transaction:', error); return }
    setTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, skipped: true } : t))
  }

  const handleSyncQBO = async () => {
    setIsSyncing(true)
    // TODO: Implement actual QBO sync
    await new Promise(resolve => setTimeout(resolve, 2000))
    setIsSyncing(false)
  }

  const handleUpdateCategories = async (newCategories: typeof EXPENSE_CATEGORIES) => {
    setCustomCategories(newCategories)
    
    // Save to database
    if (companyId) {
      const { error } = await supabase
        .from('company_settings')
        .update({ expense_categories: newCategories, updated_at: new Date().toISOString() })
        .eq('company_id', companyId)
      
      if (error) {
        console.error('Error saving categories:', error)
      }
    }
  }

  const handleExport = () => {
    const csv = ['Date,Description,Category,Subcategory,Project,Amount,Status']
    expenses.forEach(e => {
      const proj = projects.find(p => p.id === e.project_id)
      csv.push(`${e.date},"${e.description}",${e.category},${e.subcategory},"${proj?.name || ''}",${e.amount},${e.status}`)
    })
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'expenses-export.csv'; a.click()
  }

  // Pending count for badge
  const pendingTransactions = transactions.filter(t => {
    if (t.amount >= 0 || t.skipped) return false
    const linkedIds = new Set(expenses.filter(e => e.transaction_id).map(e => e.transaction_id))
    return !linkedIds.has(t.id)
  }).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
          <p className={`text-sm ${THEME.textMuted}`}>Loading expenses...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-xl font-semibold ${THEME.textPrimary}`}>Expenses</h1>
          <p className={`text-sm ${THEME.textMuted} mt-1`}>
            Track direct costs, overhead, and personal expenses
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Year Filter */}
          <div className="relative">
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="appearance-none bg-white/[0.05] border border-white/[0.1] rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
            >
              {[2026, 2025, 2024, 2023].map(year => (
                <option key={year} value={year} className="bg-slate-900">{year}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>

          {/* Month Filter */}
          <div className="relative">
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none bg-white/[0.05] border border-white/[0.1] rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
            >
              <option value="all" className="bg-slate-900">All Months</option>
              {['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].map((m, i) => (
                <option key={m} value={m} className="bg-slate-900">{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>

          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-white/[0.1] rounded-lg text-sm font-medium text-slate-300 hover:bg-white/[0.05] transition-colors"
          >
            <Download size={14} /> Export
          </button>

          <button
            onClick={() => setShowCategoryManager(true)}
            className="flex items-center gap-2 px-3 py-2 border border-white/[0.1] rounded-lg text-sm font-medium text-slate-300 hover:bg-white/[0.05] transition-colors"
            title="Manage Categories"
          >
            <Settings size={14} />
          </button>

          <button
            onClick={() => {
              setActiveTab('expenses')
              setTimeout(() => expensesSectionRef.current?.openAddModal(), 100)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
          >
            <Plus size={14} /> Add Expense
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-1.5 inline-flex gap-1`}>
        <button 
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'overview'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
              : `${THEME.textMuted} hover:text-white hover:bg-white/[0.05]`
          }`}
        >
          <PieChart size={16} />
          Overview
        </button>
        <button 
          onClick={() => setActiveTab('expenses')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'expenses'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
              : `${THEME.textMuted} hover:text-white hover:bg-white/[0.05]`
          }`}
        >
          <LayoutList size={16} />
          Expenses
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-white/[0.08] text-slate-300">
            {expenses.length}
          </span>
        </button>
        <button 
          onClick={() => setActiveTab('bankfeed')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'bankfeed'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-lg shadow-blue-500/10'
              : `${THEME.textMuted} hover:text-white hover:bg-white/[0.05]`
          }`}
        >
          <Landmark size={16} />
          Bank Feed
          {pendingTransactions > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-400">
              {pendingTransactions}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewSection
          expenses={expenses}
          projects={projects}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          categories={customCategories}
        />
      )}

      {activeTab === 'expenses' && (
        <ExpensesSection
          ref={expensesSectionRef}
          expenses={expenses}
          projects={projects}
          clients={clients}
          teamMembers={teamMembers}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          companyId={companyId}
          onAddExpense={handleAddExpense}
          onUpdateExpense={handleUpdateExpense}
          onDeleteExpense={handleDeleteExpense}
        />
      )}

      {activeTab === 'bankfeed' && (
        <BankFeedSection
          transactions={transactions}
          expenses={expenses}
          projects={projects}
          onCategorizeTransaction={handleCategorizeTransaction}
          onSkipTransaction={handleSkipTransaction}
          onSyncQBO={handleSyncQBO}
          isSyncing={isSyncing}
        />
      )}

      {/* Category Manager Modal */}
      <CategoryManager
        isOpen={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
        categories={customCategories}
        onUpdateCategories={handleUpdateCategories}
      />
    </div>
  )
}
