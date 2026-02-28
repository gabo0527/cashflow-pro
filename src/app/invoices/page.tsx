'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { RefreshCw, Download, ChevronDown, ChevronLeft, ChevronRight, Plus, FileText, Users } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/supabase'
import ARSection from '@/components/invoices/ARSection'
import APSection, { APSectionHandle } from '@/components/invoices/APSection'
import QBOSyncButton from '@/components/QBOSyncButton'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

const selClass = (active: boolean) =>
  `px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-colors cursor-pointer ${
    active ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-white border-slate-200 text-slate-700'
  }`

export default function InvoicesPage() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'ar' | 'ap'>('ar')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all')
  const [invoices, setInvoices] = useState<any[]>([])
  const [bills, setBills] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const apSectionRef = useRef<APSectionHandle>(null)

  const loadData = useCallback(async () => {
    try {
      const result = await getCurrentUser()
      const user = result?.user
      if (!user) { setLoading(false); return }
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) { setLoading(false); return }
      setCompanyId(profile.company_id)
      const [invRes, billRes, clientRes, projRes, teamRes, contInvRes, contExpRes] = await Promise.all([
        supabase.from('invoices').select('*').eq('company_id', profile.company_id).order('invoice_date', { ascending: false }),
        supabase.from('bills').select('*').eq('company_id', profile.company_id).order('date', { ascending: false }),
        supabase.from('clients').select('*').eq('company_id', profile.company_id).order('name'),
        supabase.from('projects').select('*').eq('company_id', profile.company_id).order('name'),
        supabase.from('team_members').select('id, name').eq('company_id', profile.company_id).order('name'),
        supabase.from('contractor_invoices').select('*, team_members(name)').eq('company_id', profile.company_id).eq('status', 'approved').order('submitted_at', { ascending: false }),
        supabase.from('contractor_expenses').select('*, team_members(name)').eq('company_id', profile.company_id).eq('status', 'approved').order('submitted_at', { ascending: false }),
      ])
      setInvoices((invRes.data || []).map(inv => ({
        ...inv,
        amount: parseFloat(inv.total_amount || inv.amount || 0),
        balance: parseFloat(inv.balance_due || inv.balance || inv.total_amount || inv.amount || 0),
      })))

      const contractorInvBills = (contInvRes.data || []).map((ci: any) => {
        const amt = parseFloat(ci.total_amount || 0)
        const isPaid = !!ci.paid_at
        return {
          id: ci.id, _source: 'contractor_invoice' as const,
          bill_number: ci.invoice_number || ci.id.slice(0, 8),
          vendor_name: ci.team_members?.name || 'Contractor',
          amount: amt, balance: isPaid ? 0 : amt,
          date: ci.invoice_date || ci.submitted_at?.split('T')[0] || ci.created_at?.split('T')[0],
          due_date: ci.due_date || ci.period_end || ci.invoice_date || ci.submitted_at?.split('T')[0],
          project_id: null, client_id: null,
          notes: ci.period_start && ci.period_end ? `Period: ${ci.period_start} – ${ci.period_end}` : (ci.notes || ''),
          status: isPaid ? 'paid' : 'unpaid',
          paid_amount: isPaid ? amt : 0,
          team_member_id: ci.team_member_id, submitted_at: ci.submitted_at,
        }
      })

      const contractorExpBills = (contExpRes.data || []).map((ce: any) => ({
        id: ce.id, _source: 'contractor_expense' as const,
        bill_number: `EXP-${ce.id.slice(0, 6)}`,
        vendor_name: ce.team_members?.name || 'Contractor',
        amount: parseFloat(ce.amount || 0), balance: parseFloat(ce.amount || 0),
        date: ce.date || ce.submitted_at?.split('T')[0],
        due_date: ce.date || ce.submitted_at?.split('T')[0],
        project_id: ce.project_id || null, client_id: ce.client_id || null,
        notes: `${ce.category ? ce.category.charAt(0).toUpperCase() + ce.category.slice(1) : ''}: ${ce.description || ''}`.trim(),
        status: 'unpaid', paid_amount: 0,
        team_member_id: ce.team_member_id, is_billable: ce.is_billable,
      }))

      const manualBills = (billRes.data || []).map(b => ({
        ...b, _source: 'manual' as const,
        amount: parseFloat(b.amount || 0),
        balance: parseFloat(b.balance ?? b.amount ?? 0),
      }))

      setBills([...contractorInvBills, ...contractorExpBills, ...manualBills])
      setClients(clientRes.data || [])
      setProjects(projRes.data || [])
      setTeamMembers(teamRes.data || [])
    } catch (error) { console.error('Error loading data:', error) } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadData() }, [loadData])
  const handleSyncComplete = useCallback(() => { loadData() }, [loadData])

  // ============ AR HANDLERS ============
  const handleUpdateInvoice = async (id: string, updates: any) => {
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates } : inv))
    const { error } = await supabase.from('invoices').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { console.error('Error updating invoice:', error); loadData() }
  }

  const handleDeleteInvoice = async (id: string) => {
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) { console.error('Error deleting invoice:', error); alert('Failed to delete invoice.'); return }
    setInvoices(prev => prev.filter(inv => inv.id !== id))
  }

  const handleRecordARPayment = async (id: string, amount: number) => {
    const invoice = invoices.find(i => i.id === id)
    if (!invoice) return
    const newPaidAmount = (invoice.paid_amount || 0) + amount
    const newBalance = Math.max(0, invoice.amount - newPaidAmount)
    const updates: any = { paid_amount: newPaidAmount, balance_due: newBalance, balance: newBalance, updated_at: new Date().toISOString() }
    if (newBalance === 0) { updates.status = 'paid'; updates.paid_date = new Date().toISOString().split('T')[0] }
    const { error } = await supabase.from('invoices').update(updates).eq('id', id)
    if (error) { console.error('Error recording payment:', error); alert('Failed to record payment'); return }
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates, balance: newBalance } : inv))
  }

  // ============ AP HANDLERS ============
  const handleAddBill = async (bill: any) => {
    if (!companyId) return
    const { data, error } = await supabase.from('bills').insert({ company_id: companyId, ...bill }).select().single()
    if (error) { console.error('Error adding bill:', error); alert('Failed to add bill'); return }
    setBills(prev => [{ ...data, _source: 'manual' as const, amount: parseFloat(data.amount || 0), balance: parseFloat(data.balance ?? data.amount ?? 0) }, ...prev])
  }

  const handleUpdateBill = async (id: string, updates: any) => {
    const bill = bills.find(b => b.id === id)
    if (!bill) return
    const table = bill._source === 'contractor_invoice' ? 'contractor_invoices' : bill._source === 'contractor_expense' ? 'contractor_expenses' : 'bills'
    const { error } = await supabase.from(table).update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { console.error('Error updating bill:', error); return }
    setBills(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
  }

  const handleDeleteBill = async (id: string) => {
    const bill = bills.find(b => b.id === id)
    if (!bill) return
    if (!confirm('Delete this bill?')) return
    const table = bill._source === 'contractor_invoice' ? 'contractor_invoices' : bill._source === 'contractor_expense' ? 'contractor_expenses' : 'bills'
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) { console.error('Error deleting bill:', error); return }
    setBills(prev => prev.filter(b => b.id !== id))
  }

  const handleRecordAPPayment = async (id: string, amount: number) => {
    const bill = bills.find(b => b.id === id)
    if (!bill) return
    const newPaidAmount = (bill.paid_amount || 0) + amount
    const newBalance = Math.max(0, bill.amount - newPaidAmount)
    if (bill._source === 'contractor_invoice') {
      const updates: any = { paid_at: new Date().toISOString(), status: 'paid' }
      const { error } = await supabase.from('contractor_invoices').update(updates).eq('id', id)
      if (error) { console.error('Error recording payment:', error); alert('Failed to record payment'); return }
      setBills(prev => prev.map(b => b.id === id ? { ...b, paid_amount: b.amount, balance: 0, status: 'paid' } : b))
    } else {
      const updates: any = { paid_amount: newPaidAmount, balance: newBalance, updated_at: new Date().toISOString() }
      if (newBalance === 0) updates.status = 'paid'
      const table = bill._source === 'contractor_expense' ? 'contractor_expenses' : 'bills'
      const { error } = await supabase.from(table).update(updates).eq('id', id)
      if (error) { console.error('Error recording payment:', error); alert('Failed to record payment'); return }
      setBills(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b))
    }
  }

  const handleExport = () => {
    const data = activeTab === 'ar' ? invoices : bills
    if (data.length === 0) { alert('No data to export'); return }
    if (activeTab === 'ar') {
      const csv = ['Invoice #,Date,Due Date,Client,Project,Amount,Balance,Status']
      data.forEach((i: any) => {
        const client = clients.find(c => c.id === i.client_id)?.name || i.client || ''
        const project = projects.find(p => p.id === i.project_id)?.name || i.project || ''
        csv.push(`${i.invoice_number},${i.invoice_date},${i.due_date},"${client}","${project}",${i.amount},${i.balance},${i.status || ''}`)
      })
      const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `invoices-ar-${new Date().toISOString().split('T')[0]}.csv`; a.click()
    } else {
      const csv = ['Bill #,Date,Due Date,Vendor,Project,Amount,Balance,Status']
      data.forEach((b: any) => {
        const project = projects.find(p => p.id === b.project_id)?.name || ''
        csv.push(`${b.bill_number || ''},${b.date},${b.due_date},"${b.vendor_name || ''}","${project}",${b.amount},${b.balance},${b.status || ''}`)
      })
      const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `invoices-ap-${new Date().toISOString().split('T')[0]}.csv`; a.click()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading invoices...</p>
        </div>
      </div>
    )
  }

  const openARCount = invoices.filter(i => i.balance > 0).length
  const openAPCount = bills.filter(b => b.balance > 0).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Invoices</h1>
          <p className="text-[13px] mt-1 text-slate-400">
            {activeTab === 'ar' ? 'Accounts receivable — client invoices (revenue)' : 'Accounts payable — contractor bills (direct costs)'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))} className={selClass(selectedYear !== 'all')}>
            <option value="all">All Time</option>
            {[2026, 2025, 2024, 2023].map(year => <option key={year} value={year}>{year}</option>)}
          </select>
          {companyId && <QBOSyncButton companyId={companyId} syncType="invoices" onSyncComplete={handleSyncComplete} />}
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <Download size={14} /> Export
          </button>
          {activeTab === 'ap' && (
            <button onClick={() => apSectionRef.current?.openAddModal()}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-600 transition-colors shadow-sm">
              <Plus size={14} /> Add Bill
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-slate-200">
        {[
          { id: 'ar' as const, label: 'Receivables (AR)', icon: FileText, count: openARCount },
          { id: 'ap' as const, label: 'Payables (AP)', icon: Users, count: openAPCount },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`relative flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all ${
              activeTab === tab.id ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
            }`}>
            <tab.icon size={15} />
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                activeTab === tab.id ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'ar' ? (
        <ARSection invoices={invoices} clients={clients} projects={projects} selectedYear={selectedYear}
          onUpdateInvoice={handleUpdateInvoice} onRecordPayment={handleRecordARPayment} onDeleteInvoice={handleDeleteInvoice} />
      ) : (
        <APSection ref={apSectionRef} bills={bills} clients={clients} projects={projects} teamMembers={teamMembers}
          selectedYear={selectedYear} companyId={companyId} onAddBill={handleAddBill} onUpdateBill={handleUpdateBill}
          onDeleteBill={handleDeleteBill} onRecordPayment={handleRecordAPPayment} />
      )}
    </div>
  )
}
