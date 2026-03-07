'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, Plus, PieChart, LayoutList, Landmark, Settings, Download } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/supabase'
import { THEME, EXPENSE_CATEGORIES, CategoryManager, hydrateCategories } from '@/components/expenses/shared'
import OverviewSection from '@/components/expenses/OverviewSection'
import ExpensesSection, { ExpensesSectionHandle } from '@/components/expenses/ExpensesSection'
import BankFeedSection from '@/components/expenses/BankFeedSection'
import QBOSyncButton from '@/components/QBOSyncButton'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

type TabType = 'overview' | 'expenses' | 'bankfeed'

export default function BankingPage() {
  const [loading, setLoading]         = useState(true)
  const [activeTab, setActiveTab]     = useState<TabType>('bankfeed')
  const [companyId, setCompanyId]     = useState<string | null>(null)

  const [selectedYear,  setSelectedYear]  = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState<string>('all')

  const [expenses,     setExpenses]     = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [projects,     setProjects]     = useState<any[]>([])
  const [clients,      setClients]      = useState<any[]>([])
  const [teamMembers,  setTeamMembers]  = useState<any[]>([])

  const [plaidConnected, setPlaidConnected] = useState(false)
  const [lastSynced,     setLastSynced]     = useState<string | null>(null)

  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [customCategories,    setCustomCategories]    = useState(EXPENSE_CATEGORIES)

  const expensesSectionRef = useRef<ExpensesSectionHandle>(null)

  const normalizeTxn = (t: any) => ({
    ...t,
    amount:         parseFloat(t.amount || 0),
    is_categorized: !!(t.category),
    sync_source:    t.sync_source || 'manual',
  })

  const loadData = useCallback(async () => {
    try {
      const result = await getCurrentUser()
      const user = result?.user
      if (!user) { setLoading(false); return }

      const { data: profile } = await supabase
        .from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) { setLoading(false); return }

      setCompanyId(profile.company_id)

      const yearStart = `${selectedYear}-01-01`
      const yearEnd   = `${selectedYear}-12-31`

      const [expRes, txnRes, projRes, clientRes, teamRes, settingsRes] = await Promise.all([
        supabase.from('expenses').select('*').eq('company_id', profile.company_id)
          .gte('date', yearStart).lte('date', yearEnd).order('date', { ascending: false }).limit(10000),
        supabase.from('transactions').select('*').eq('company_id', profile.company_id)
          .order('date', { ascending: false }).limit(10000),
        supabase.from('projects').select('*').eq('company_id', profile.company_id).order('name'),
        supabase.from('clients').select('*').eq('company_id', profile.company_id).order('name'),
        supabase.from('team_members').select('id, name').eq('company_id', profile.company_id).order('name'),
        supabase.from('company_settings')
          .select('expense_categories, plaid_connected, plaid_last_sync')
          .eq('company_id', profile.company_id).single(),
      ])

      setExpenses((expRes.data || []).map(e => ({ ...e, amount: parseFloat(e.amount || 0) })))
      setTransactions((txnRes.data || []).map(normalizeTxn))
      setProjects(projRes.data || [])
      setClients(clientRes.data || [])
      setTeamMembers(teamRes.data || [])

      const settings = settingsRes.data
      if (settings?.expense_categories) setCustomCategories(hydrateCategories(settings.expense_categories))
      if (settings?.plaid_connected)    setPlaidConnected(true)
      if (settings?.plaid_last_sync) {
        const d = new Date(settings.plaid_last_sync)
        const diff = Math.round((Date.now() - d.getTime()) / 60000)
        setLastSynced(diff < 60
          ? `${diff}m ago`
          : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [selectedYear])

  useEffect(() => { loadData() }, [loadData])

  const handleSyncComplete = useCallback(() => { loadData() }, [loadData])

  const handlePlaidRefresh = async () => {
    if (!companyId) return
    await fetch('/api/plaid/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId }),
    })
    await loadData()
  }

  const handleConnectPlaid = async () => {
    if (!companyId) return
    try {
      const res = await fetch('/api/plaid/link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      })
      const { link_token } = await res.json()
      // Plaid Link SDK wired up in Phase 2
      console.log('Plaid link token ready:', link_token)
    } catch (err) {
      console.error('Plaid connect error:', err)
    }
  }

  const handleCategorizeTransaction = async (
    transactionId: string, category: string, subcategory: string, cardholder?: string
  ) => {
    if (!companyId) return
    const txn = transactions.find(t => t.id === transactionId)
    if (!txn) return

    const txnUpdate: any = {
      category, subcategory,
      type: txn.amount >= 0 ? 'income' : 'expense',
      updated_at: new Date().toISOString(),
    }
    if (cardholder) txnUpdate.cardholder = cardholder

    const { error: txnError } = await supabase
      .from('transactions').update(txnUpdate).eq('id', transactionId)

    if (txnError) {
      console.error('Error updating transaction:', txnError)
      alert('Failed to categorize transaction')
      return
    }

    // Mirror outflows to expenses table for OverviewSection / ExpensesSection
    if (txn.amount < 0 && category !== 'transfer') {
      const expenseData = {
        company_id: companyId, category, subcategory,
        description: txn.description, amount: Math.abs(txn.amount),
        date: txn.date, vendor: txn.payee || '', status: 'paid',
        transaction_id: transactionId,
      }
      const { data: newExp, error: expError } = await supabase
        .from('expenses').insert(expenseData).select().single()
      if (expError) {
        console.error('Error creating expense record:', expError)
      } else {
        setExpenses(prev => [{ ...newExp, amount: parseFloat(newExp.amount || 0) }, ...prev])
      }
    }

    setTransactions(prev => prev.map(t =>
      t.id === transactionId ? { ...t, ...txnUpdate, is_categorized: true } : t
    ))
  }

  const handleAddExpense = async (expense: any) => {
    if (!companyId) return
    const { data, error } = await supabase
      .from('expenses').insert({ company_id: companyId, ...expense }).select().single()
    if (error) { console.error('Error adding expense:', error); alert('Failed to add expense'); return }
    setExpenses(prev => [{ ...data, amount: parseFloat(data.amount || 0) }, ...prev])
  }

  const handleUpdateExpense = async (id: string, updates: any) => {
    const { error } = await supabase
      .from('expenses').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { console.error('Error updating expense:', error); return }
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
  }

  const handleDeleteExpense = async (id: string) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) { console.error('Error deleting expense:', error); return }
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  const handleUpdateCategories = async (newCategories: typeof EXPENSE_CATEGORIES) => {
    setCustomCategories(newCategories)
    if (companyId) {
      const { error } = await supabase.from('company_settings').upsert(
        { company_id: companyId, expense_categories: newCategories, updated_at: new Date().toISOString() },
        { onConflict: 'company_id' }
      )
      if (error) console.error('Error saving categories:', error)
    }
  }

  const handleExport = () => {
    const csv = ['Date,Description,Category,Subcategory,Project,Amount,Type']
    expenses.forEach(e => {
      const proj = projects.find((p: any) => p.id === e.project_id)
      csv.push(`${e.date},"${e.description}",${e.category},${e.subcategory},"${proj?.name || ''}",${e.amount},${e.type || 'expense'}`)
    })
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'cash-export.csv'; a.click()
  }

  const pendingCount = transactions.filter(t => !t.is_categorized && !t.skipped).length

  const TAB_ITEMS = [
    { id: 'overview' as TabType,  icon: PieChart,   label: 'Overview',      badge: null },
    { id: 'expenses' as TabType,  icon: LayoutList, label: 'Transactions',  badge: expenses.length },
    { id: 'bankfeed' as TabType,  icon: Landmark,   label: 'Bank Feed',     badge: pendingCount },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Top nav bar — non-bankfeed tabs only (bankfeed has its own sticky header) */}
      {activeTab !== 'bankfeed' && (
        <div className="bg-white border-b border-slate-200 px-8">
          <div className="max-w-screen-xl mx-auto">
            <div className="flex items-center justify-between py-3 gap-3">
              <div>
                <h1 className={`text-[15px] font-bold ${THEME.textPrimary} tracking-tight`}>Cash Management</h1>
                <p className={`text-[11px] ${THEME.textDim} mt-0.5`}>Mano CG LLC · 2026</p>
              </div>
              <div className="flex items-center gap-2">
                <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
                  className={`${THEME.selectClass} text-[12px]`}>
                  {[2026, 2025, 2024, 2023].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                  className={`${THEME.selectClass} text-[12px]`}>
                  <option value="all">All Months</option>
                  {['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].map((m, i) => (
                    <option key={m} value={m}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>
                  ))}
                </select>
                {companyId && (
                  <QBOSyncButton companyId={companyId} syncType="invoices" onSyncComplete={handleSyncComplete} compact />
                )}
                <button onClick={handleExport}
                  className={`flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[12px] font-medium ${THEME.textSecondary} hover:border-slate-300 transition-colors`}>
                  <Download size={13} /> Export
                </button>
                <button onClick={() => setShowCategoryManager(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[12px] font-medium ${THEME.textSecondary} hover:border-slate-300 transition-colors`}>
                  <Settings size={13} />
                </button>
                <button onClick={() => { setActiveTab('expenses'); setTimeout(() => expensesSectionRef.current?.openAddModal(), 100) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[12px] font-semibold hover:bg-emerald-700 transition-colors">
                  <Plus size={13} /> Add Expense
                </button>
              </div>
            </div>

            <div className="flex gap-0">
              {TAB_ITEMS.map(({ id, icon: Icon, label, badge }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`relative flex items-center gap-2 px-5 py-3 text-[13px] font-medium transition-colors ${activeTab === id ? 'text-emerald-600' : `${THEME.textDim} hover:text-slate-600`}`}>
                  <Icon size={14} />
                  {label}
                  {badge !== null && badge !== undefined && (
                    <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-md border ${
                      id === 'bankfeed' && pendingCount > 0 ? 'bg-amber-50 text-amber-600 border-amber-200'
                      : activeTab === id ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                      : 'bg-slate-100 text-slate-400 border-slate-200'
                    }`}>{badge}</span>
                  )}
                  {activeTab === id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Slim tab strip when bankfeed active (has its own sticky header below) */}
      {activeTab === 'bankfeed' && (
        <div className="bg-white border-b border-slate-100 px-8">
          <div className="max-w-screen-xl mx-auto flex">
            {TAB_ITEMS.map(({ id, icon: Icon, label }) => (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`relative flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium transition-colors ${activeTab === id ? 'text-emerald-600' : `${THEME.textDim} hover:text-slate-600`}`}>
                <Icon size={13} />
                {label}
                {id === 'bankfeed' && pendingCount > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-amber-50 text-amber-600 border border-amber-200">{pendingCount}</span>
                )}
                {activeTab === id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-t" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="max-w-screen-xl mx-auto px-8 py-6">
          <OverviewSection
            expenses={expenses} transactions={transactions}
            projects={projects} clients={clients}
            selectedYear={selectedYear} selectedMonth={selectedMonth}
            categories={customCategories}
          />
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="max-w-screen-xl mx-auto px-8 py-6">
          <ExpensesSection
            ref={expensesSectionRef}
            expenses={expenses} projects={projects}
            clients={clients} teamMembers={teamMembers}
            selectedYear={selectedYear} selectedMonth={selectedMonth}
            companyId={companyId}
            onAddExpense={handleAddExpense}
            onUpdateExpense={handleUpdateExpense}
            onDeleteExpense={handleDeleteExpense}
          />
        </div>
      )}

      {activeTab === 'bankfeed' && (
        <BankFeedSection
          transactions={transactions}
          onCategorizeTransaction={handleCategorizeTransaction}
          onRefresh={handlePlaidRefresh}
          lastSynced={lastSynced}
          plaidConnected={plaidConnected}
          onConnectPlaid={handleConnectPlaid}
          companyId={companyId || undefined}
        />
      )}

      <CategoryManager
        isOpen={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
        categories={customCategories}
        onUpdateCategories={handleUpdateCategories}
      />
    </div>
  )
}
