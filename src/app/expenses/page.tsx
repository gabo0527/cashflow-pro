'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { 
  Receipt, Download, ChevronDown, Plus, PieChart, 
  LayoutList, Landmark, RefreshCw, Settings
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/supabase'
import { EXPENSE_CATEGORIES, CategoryManager, hydrateCategories } from '@/components/expenses/shared'
import OverviewSection from '@/components/expenses/OverviewSection'
import ExpensesSection, { ExpensesSectionHandle } from '@/components/expenses/ExpensesSection'
import BankFeedSection from '@/components/expenses/BankFeedSection'
import QBOSyncButton from '@/components/QBOSyncButton'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

const selectClass = "appearance-none bg-slate-800/60 border border-slate-800/80 rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-teal-500/30 focus:border-teal-600/50 cursor-pointer transition-colors"

type TabType = 'overview' | 'expenses' | 'bankfeed'

export default function BankingPage() {
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

  // Category management
  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [customCategories, setCustomCategories] = useState(EXPENSE_CATEGORIES)
  const [isSyncing, setIsSyncing] = useState(false)

  // Ref for Expenses section
  const expensesSectionRef = useRef<ExpensesSectionHandle>(null)

  // ============ DATA LOADING ============
  const loadData = useCallback(async () => {
    try {
      const result = await getCurrentUser()
      const user = result?.user
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) { setLoading(false); return }

      setCompanyId(profile.company_id)

      const yearStart = `${selectedYear}-01-01`
      const yearEnd = `${selectedYear}-12-31`

      const [expRes, txnRes, projRes, clientRes, teamRes] = await Promise.all([
        supabase.from('expenses').select('*').eq('company_id', profile.company_id).gte('date', yearStart).lte('date', yearEnd).order('date', { ascending: false }).limit(10000),
        supabase.from('transactions').select('*').eq('company_id', profile.company_id).gte('date', yearStart).lte('date', yearEnd).order('date', { ascending: false }).limit(10000),
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
        setCustomCategories(hydrateCategories(settings.expense_categories))
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedYear])

  useEffect(() => { loadData() }, [loadData])

  // Reload after QBO sync
  const handleSyncComplete = useCallback(() => { loadData() }, [loadData])

  // ============ EXPENSE HANDLERS ============
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

  // ============ BANK FEED HANDLERS ============
  const handleCategorizeTransaction = async (transactionId: string, data: any) => {
    if (!companyId) return

    // Step 1: Update the transaction record directly with category info
    const txnUpdate: any = {
      category: data.category,
      subcategory: data.subcategory,
      type: data.type || (data.amount >= 0 ? 'income' : 'expense'),
      updated_at: new Date().toISOString(),
    }
    if (data.project_id) txnUpdate.project_id = data.project_id
    if (data.client_id) txnUpdate.client_id = data.client_id
    if (data.cardholder) txnUpdate.cardholder = data.cardholder

    const { error: txnError } = await supabase
      .from('transactions')
      .update(txnUpdate)
      .eq('id', transactionId)

    if (txnError) {
      console.error('Error updating transaction:', txnError)
      alert('Failed to categorize transaction')
      return
    }

    // Step 2: For outflows, also create an expense record (for backwards compatibility)
    if (data.type === 'expense' && data.category !== 'transfer') {
      const expenseData = {
        company_id: companyId,
        category: data.category,
        subcategory: data.subcategory,
        project_id: data.project_id || null,
        client_id: data.client_id || null,
        description: data.description,
        amount: Math.abs(data.amount),
        date: data.date,
        vendor: data.vendor,
        status: 'paid',
        transaction_id: transactionId,
      }
      const { data: newExp, error: expError } = await supabase.from('expenses').insert(expenseData).select().single()
      if (expError) {
        console.error('Error creating expense record:', expError)
      } else {
        setExpenses(prev => [{ ...newExp, amount: parseFloat(newExp.amount || 0) }, ...prev])
      }
    }

    // Step 3: Update local transaction state
    setTransactions(prev => prev.map(t => 
      t.id === transactionId ? { ...t, ...txnUpdate } : t
    ))
  }

  const handleSkipTransaction = async (transactionId: string) => {
    const { error } = await supabase
      .from('transactions')
      .update({ skipped: true, updated_at: new Date().toISOString() })
      .eq('id', transactionId)
    if (error) { console.error('Error skipping transaction:', error); return }
    setTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, skipped: true } : t))
  }

  const [syncStatus, setSyncStatus] = useState('')

  const handleSyncQBO = async () => {
    if (!companyId || isSyncing) return
    setIsSyncing(true)
    setSyncStatus('Getting sync plan...')
    try {
      // Step 1: Get the list of entities to sync
      const planRes = await fetch('/api/qbo/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, syncType: 'bank' }),
      })
      const plan = await planRes.json()

      if (!planRes.ok || !plan.entities) {
        alert(`Sync failed: ${plan.error || 'Could not get sync plan'}`)
        setIsSyncing(false)
        setSyncStatus('')
        return
      }

      // Step 2: Chain each entity one at a time
      let totalSynced = 0
      let totalErrors = 0
      for (let i = 0; i < plan.entities.length; i++) {
        const entity = plan.entities[i]
        setSyncStatus(`Syncing ${entity}... (${i + 1}/${plan.entities.length})`)

        const res = await fetch('/api/qbo/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, entity }),
        })
        const data = await res.json()

        if (!res.ok) {
          console.error(`Failed syncing ${entity}:`, data)
          if (data.reconnect) {
            alert('QuickBooks session expired — please reconnect.')
            break
          }
          totalErrors++
          continue
        }

        totalSynced += data.result?.synced || 0
        totalErrors += data.result?.errors || 0
        console.log(`✓ ${entity}: ${data.result?.synced || 0} synced`)
      }

      setSyncStatus(`Done! ${totalSynced} transactions synced.`)
      loadData()
      setTimeout(() => setSyncStatus(''), 4000)
    } catch (err) {
      console.error('Sync error:', err)
      alert('Sync failed — check console for details')
      setSyncStatus('')
    } finally {
      setIsSyncing(false)
    }
  }

  // ============ CATEGORY MANAGEMENT ============
  const handleUpdateCategories = async (newCategories: typeof EXPENSE_CATEGORIES) => {
    setCustomCategories(newCategories)
    if (companyId) {
      const { error } = await supabase
        .from('company_settings')
        .upsert(
          { company_id: companyId, expense_categories: newCategories, updated_at: new Date().toISOString() },
          { onConflict: 'company_id' }
        )
      if (error) console.error('Error saving categories:', error)
    }
  }

  // ============ EXPORT ============
  const handleExport = () => {
    const csv = ['Date,Description,Category,Subcategory,Project,Amount,Type']
    expenses.forEach(e => {
      const proj = projects.find(p => p.id === e.project_id)
      csv.push(`${e.date},"${e.description}",${e.category},${e.subcategory},"${proj?.name || ''}",${e.amount},${e.type || 'expense'}`)
    })
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'banking-export.csv'; a.click()
  }

  // Pending bank feed count — now includes BOTH inflows and outflows
  const pendingTransactions = transactions.filter(t => {
    if (t.skipped || t.category) return false
    const linkedIds = new Set(expenses.filter(e => e.transaction_id).map(e => e.transaction_id))
    return !linkedIds.has(t.id)
  }).length

  // ============ LOADING ============
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-teal-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading banking data...</p>
        </div>
      </div>
    )
  }

  // ============ RENDER ============
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Banking</h1>
          <p className="text-sm text-slate-500 mt-1">Categorize transactions, track cash flow, manage accounts</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Year */}
          <div className="relative">
            <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className={selectClass}>
              {[2026, 2025, 2024, 2023].map(year => <option key={year} value={year} className="bg-slate-900">{year}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>

          {/* Month */}
          <div className="relative">
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className={selectClass}>
              <option value="all" className="bg-slate-900">All Months</option>
              {['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].map((m, i) => (
                <option key={m} value={m} className="bg-slate-900">{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>

          {/* QBO Sync (real) */}
          {companyId && (
            <QBOSyncButton companyId={companyId} syncType="bank" onSyncComplete={handleSyncComplete} compact />
          )}

          {/* Export */}
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 border border-slate-800/80 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:border-slate-700 transition-colors">
            <Download size={14} /> Export
          </button>

          {/* Category Manager */}
          <button onClick={() => setShowCategoryManager(true)} title="Manage Categories"
            className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 border border-slate-800/80 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 hover:border-slate-700 transition-colors">
            <Settings size={14} />
          </button>

          {/* Add Expense */}
          <button onClick={() => { setActiveTab('expenses'); setTimeout(() => expensesSectionRef.current?.openAddModal(), 100) }}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-500 transition-colors">
            <Plus size={14} /> Add Expense
          </button>
        </div>
      </div>

      {/* Tab Navigation — underline style */}
      <div className="border-b border-slate-800/60">
        <div className="flex gap-0">
          <button onClick={() => setActiveTab('overview')}
            className={`relative flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === 'overview' ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'
            }`}>
            <PieChart size={15} />
            Overview
            {activeTab === 'overview' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500 rounded-t" />}
          </button>
          <button onClick={() => setActiveTab('expenses')}
            className={`relative flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === 'expenses' ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'
            }`}>
            <LayoutList size={15} />
            Transactions
            <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md ${
              activeTab === 'expenses' ? 'bg-teal-500/15 text-teal-400 border border-teal-500/20' : 'bg-slate-800/60 text-slate-400 border border-slate-800/80'
            }`}>{expenses.length}</span>
            {activeTab === 'expenses' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500 rounded-t" />}
          </button>
          <button onClick={() => setActiveTab('bankfeed')}
            className={`relative flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
              activeTab === 'bankfeed' ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'
            }`}>
            <Landmark size={15} />
            Bank Feed
            {pendingTransactions > 0 && (
              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md ${
                activeTab === 'bankfeed' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }`}>{pendingTransactions}</span>
            )}
            {activeTab === 'bankfeed' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500 rounded-t" />}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <OverviewSection
          expenses={expenses}
          transactions={transactions}
          projects={projects}
          clients={clients}
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
          clients={clients}
          categories={customCategories}
          onCategorizeTransaction={handleCategorizeTransaction}
          onSkipTransaction={handleSkipTransaction}
          onSyncQBO={handleSyncQBO}
          isSyncing={isSyncing}
          syncStatus={syncStatus}
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
