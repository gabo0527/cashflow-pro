'use client'

import React, { useState, useEffect, useRef } from 'react'
import { RefreshCw, Download, ChevronDown, Plus, FileText, Users } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/supabase'
import { THEME } from '@/components/invoices/shared'
import ARSection from '@/components/invoices/ARSection'
import APSection, { APSectionHandle } from '@/components/invoices/APSection'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export default function InvoicesPage() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'ar' | 'ap'>('ar')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all')

  // Shared data
  const [invoices, setInvoices] = useState<any[]>([])
  const [bills, setBills] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])

  // Ref for AP Section to trigger Add Bill modal
  const apSectionRef = useRef<APSectionHandle>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await getCurrentUser()
        const user = result?.user
        if (!user) { setLoading(false); return }

        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
        if (!profile?.company_id) { setLoading(false); return }

        setCompanyId(profile.company_id)

        const [invRes, billRes, clientRes, projRes, teamRes] = await Promise.all([
          supabase.from('invoices').select('*').eq('company_id', profile.company_id).order('invoice_date', { ascending: false }),
          supabase.from('bills').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
          supabase.from('clients').select('*').eq('company_id', profile.company_id).order('name'),
          supabase.from('projects').select('*').eq('company_id', profile.company_id).order('name'),
          supabase.from('team_members').select('id, name').eq('company_id', profile.company_id).order('name')
        ])

        // Transform invoices (handle QBO field mapping)
        const transformedInvoices = (invRes.data || []).map(inv => ({
          ...inv,
          amount: parseFloat(inv.total_amount || inv.amount || 0),
          balance: parseFloat(inv.balance_due || inv.balance || inv.total_amount || inv.amount || 0),
          qbo_customer: inv.customer_name || inv.qbo_customer || ''
        }))

        // Transform bills
        const transformedBills = (billRes.data || []).map(b => ({
          ...b,
          amount: parseFloat(b.amount || 0),
          balance: parseFloat(b.balance ?? b.amount ?? 0),
        }))

        setInvoices(transformedInvoices)
        setBills(transformedBills)
        setClients(clientRes.data || [])
        setProjects(projRes.data || [])
        setTeamMembers(teamRes.data || [])
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // ============ AR HANDLERS ============
  const handleUpdateInvoice = async (id: string, updates: any) => {
    const { error } = await supabase.from('invoices').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { console.error('Error updating invoice:', error); return }
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates } : inv))
  }

  const handleRecordARPayment = async (id: string, amount: number) => {
    const invoice = invoices.find(i => i.id === id)
    if (!invoice) return

    const newPaidAmount = (invoice.paid_amount || 0) + amount
    const newBalance = Math.max(0, invoice.amount - newPaidAmount)

    const updates: any = {
      paid_amount: newPaidAmount,
      balance_due: newBalance,
      balance: newBalance,
      updated_at: new Date().toISOString()
    }
    if (newBalance === 0) {
      updates.status = 'paid'
      updates.paid_date = new Date().toISOString().split('T')[0]
    }

    const { error } = await supabase.from('invoices').update(updates).eq('id', id)
    if (error) { console.error('Error recording payment:', error); alert('Failed to record payment'); return }
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates, balance: newBalance } : inv))
  }

  // ============ AP HANDLERS ============
  const handleAddBill = async (bill: any) => {
    if (!companyId) return
    const newBill = { company_id: companyId, ...bill }
    const { data, error } = await supabase.from('bills').insert(newBill).select().single()
    if (error) { console.error('Error adding bill:', error); alert('Failed to add bill'); return }
    setBills(prev => [{ ...data, amount: parseFloat(data.amount || 0), balance: parseFloat(data.balance ?? data.amount ?? 0) }, ...prev])
  }

  const handleUpdateBill = async (id: string, updates: any) => {
    const { error } = await supabase.from('bills').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { console.error('Error updating bill:', error); return }
    setBills(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
  }

  const handleDeleteBill = async (id: string) => {
    if (!confirm('Delete this bill?')) return
    const { error } = await supabase.from('bills').delete().eq('id', id)
    if (error) { console.error('Error deleting bill:', error); return }
    setBills(prev => prev.filter(b => b.id !== id))
  }

  const handleRecordAPPayment = async (id: string, amount: number) => {
    const bill = bills.find(b => b.id === id)
    if (!bill) return

    const newPaidAmount = (bill.paid_amount || 0) + amount
    const newBalance = Math.max(0, bill.amount - newPaidAmount)

    const updates: any = {
      paid_amount: newPaidAmount,
      balance: newBalance,
      updated_at: new Date().toISOString()
    }
    if (newBalance === 0) updates.status = 'paid'

    const { error } = await supabase.from('bills').update(updates).eq('id', id)
    if (error) { console.error('Error recording payment:', error); alert('Failed to record payment'); return }
    setBills(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
  }

  // Handle Add Bill button click
  const handleAddBillClick = () => {
    apSectionRef.current?.openAddModal()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
          <p className={`text-sm ${THEME.textMuted}`}>Loading invoices...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-xl font-semibold ${THEME.textPrimary}`}>Invoices</h1>
          <p className={`text-sm ${THEME.textMuted} mt-1`}>
            {activeTab === 'ar' ? 'Accounts receivable — client invoices (revenue)' : 'Accounts payable — contractor bills (direct costs)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="appearance-none bg-white/[0.05] border border-white/[0.1] rounded-lg pl-3 pr-8 py-2 text-sm font-medium text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer">
              <option value="all" className="bg-slate-900">All Time</option>
              {[2026, 2025, 2024, 2023].map(year => <option key={year} value={year} className="bg-slate-900">{year}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-white/[0.1] rounded-lg text-sm font-medium text-slate-300 hover:bg-white/[0.05] transition-colors">
            <RefreshCw size={14} /> Sync QBO
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-white/[0.1] rounded-lg text-sm font-medium text-slate-300 hover:bg-white/[0.05] transition-colors">
            <Download size={14} /> Export
          </button>
          {activeTab === 'ap' && (
            <button 
              onClick={handleAddBillClick}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
            >
              <Plus size={14} /> Add Bill
            </button>
          )}
        </div>
      </div>

      {/* AR / AP Toggle */}
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-1.5 inline-flex gap-1`}>
        <button onClick={() => setActiveTab('ar')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'ar'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
              : `${THEME.textMuted} hover:text-white hover:bg-white/[0.05]`
          }`}>
          <FileText size={16} />
          Receivables (AR)
          {invoices.filter(i => i.balance > 0).length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-400">
              {invoices.filter(i => i.balance > 0).length}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('ap')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'ap'
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-lg shadow-rose-500/10'
              : `${THEME.textMuted} hover:text-white hover:bg-white/[0.05]`
          }`}>
          <Users size={16} />
          Payables (AP)
          {bills.filter(b => b.balance > 0).length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/20 text-rose-400">
              {bills.filter(b => b.balance > 0).length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'ar' ? (
        <ARSection
          invoices={invoices}
          clients={clients}
          projects={projects}
          selectedYear={selectedYear}
          onUpdateInvoice={handleUpdateInvoice}
          onRecordPayment={handleRecordARPayment}
        />
      ) : (
        <APSection
          ref={apSectionRef}
          bills={bills}
          clients={clients}
          projects={projects}
          teamMembers={teamMembers}
          selectedYear={selectedYear}
          companyId={companyId}
          onAddBill={handleAddBill}
          onUpdateBill={handleUpdateBill}
          onDeleteBill={handleDeleteBill}
          onRecordPayment={handleRecordAPPayment}
        />
      )}
    </div>
  )
}
