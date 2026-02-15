'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Clock, Receipt, FileText, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle, Loader2, Upload, X, Plus, Trash2, Calendar,
  DollarSign, Send, Eye, Building2, User, FileUp, LogOut, Paperclip, File,
  ArrowRight, CircleDot, Briefcase, Timer, CreditCard, Hash, History
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jmahfgpbtjeomuepfozf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYWhmZ3BidGplb211ZXBmb3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0OTAxNzcsImV4cCI6MjA4MTA2NjE3N30.3SVDvWCGIYYHV57BpKjpDJVCZLKzuRv8B_VietQDxUQ'
)

// ============ TYPES ============
interface TeamMember { id: string; name: string; email: string; cost_type?: string; cost_amount?: number; company_id?: string }
interface Assignment { project_id: string; project_name: string; client_id: string; client_name: string; payment_type: string; rate: number }
interface RateCard { team_member_id: string; client_id: string; client_name: string; cost_type: string; cost_amount: number; rate: number }
interface TimeEntryForm { project_id: string; hours: string; notes: string }
interface Expense { id: string; date: string; category: string; description: string; amount: number; project_id?: string; client_id?: string; status: string; receipt_url?: string; submitted_at: string }
interface ContractorInvoice { id: string; invoice_number: string; invoice_date: string; due_date: string; period_start: string; period_end: string; total_amount: number; status: string; payment_terms: string; receipt_url?: string; submitted_at: string; notes?: string; lines?: any[]; contractor_invoice_lines?: any[] }
interface InvoiceLine { client_id: string; client_name: string; project_id?: string; project_name?: string; hours?: number; rate?: number; amount: number; allocation_pct?: number }

// ============ HELPERS ============
const formatCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
const formatDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const normalizeCostType = (t: string) => (t || '').toLowerCase().replace(/\s+/g, '_')

const getWeekRange = (date: Date) => {
  const d = new Date(date); const day = d.getDay(); const start = new Date(d); start.setDate(d.getDate() - day)
  const end = new Date(start); end.setDate(start.getDate() + 6)
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0],
    label: `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` }
}
const getMonthRange = (date: Date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1); const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0], label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }
}

const EXPENSE_CATEGORIES = [
  { id: 'travel', label: 'Travel' }, { id: 'hotel', label: 'Hotel' },
  { id: 'meal', label: 'Meal' }, { id: 'transportation', label: 'Transportation' },
  { id: 'software_equipment', label: 'Software / Equipment' }, { id: 'other', label: 'Other' },
]
const PAYMENT_TERMS = [
  { id: 'DUE_ON_RECEIPT', label: 'Due on Receipt' }, { id: 'NET30', label: 'Net 30' },
  { id: 'NET45', label: 'Net 45' }, { id: 'NET60', label: 'Net 60' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending',   color: 'text-amber-400',   bg: 'bg-amber-400/10 border-amber-400/20' },
  submitted: { label: 'Submitted', color: 'text-sky-400',     bg: 'bg-sky-400/10 border-sky-400/20' },
  approved:  { label: 'Approved',  color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20' },
  rejected:  { label: 'Rejected',  color: 'text-rose-400',    bg: 'bg-rose-400/10 border-rose-400/20' },
  paid:      { label: 'Paid',      color: 'text-emerald-300', bg: 'bg-emerald-400/10 border-emerald-400/20' },
}

// ============ FILE UPLOAD ============
async function uploadFile(file: File, folder: string, memberId: string): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop() || 'pdf'
    const fileName = `${folder}/${memberId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { data, error } = await supabase.storage.from('contractor-uploads').upload(fileName, file, { contentType: file.type, upsert: false })
    if (error) {
      const { data: d2, error: e2 } = await supabase.storage.from('public').upload(fileName, file, { contentType: file.type, upsert: false })
      if (e2) { console.error('Upload error:', e2); return null }
      return d2?.path || null
    }
    return data?.path || null
  } catch (err) { console.error('Upload error:', err); return null }
}

// ============ STYLED INPUT (institutional — matches admin pages) ============
const inputClass = "w-full px-3.5 py-2.5 bg-slate-800/60 border border-slate-800/80 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500/30 focus:border-teal-600/50 transition-colors"
const selectClass = "w-full px-3.5 py-2.5 bg-slate-800/60 border border-slate-800/80 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-teal-500/30 focus:border-teal-600/50 transition-colors cursor-pointer"
const labelClass = "block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2"
const btnPrimary = "px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
const cardClass = "bg-[#111827] border border-slate-800/80 rounded-xl"

// ============ STATUS PILL ============
function StatusPill({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wide border ${config.bg} ${config.color}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {config.label}
    </span>
  )
}

// ============ SINGLE DROP ZONE (invoices) ============
function DropZone({ file, onFile, onRemove, uploading, label, accept }: { 
  file: File | null; onFile: (f: File) => void; onRemove: () => void; uploading?: boolean; label: string; accept: string 
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrag = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation() }, [])
  const handleDragIn = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.items?.length > 0) setDragging(true) }, [])
  const handleDragOut = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(false) }, [])
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragging(false)
    const f = e.dataTransfer.files?.[0]; if (f) onFile(f)
  }, [onFile])

  if (file) {
    const isImage = file.type.startsWith('image/')
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/40 border border-slate-800/80 rounded-lg">
        {isImage ? (
          <img src={URL.createObjectURL(file)} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-800" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
            <FileText size={16} className="text-rose-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm truncate">{file.name}</p>
          <p className="text-slate-500 text-xs">{file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(0)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}</p>
        </div>
        {uploading ? <Loader2 size={16} className="text-teal-400 animate-spin shrink-0" /> : (
          <button onClick={onRemove} className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800/50 transition-colors shrink-0"><X size={14} /></button>
        )}
      </div>
    )
  }

  return (
    <div onDragEnter={handleDragIn} onDragLeave={handleDragOut} onDragOver={handleDrag} onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200 group ${
        dragging ? 'border-teal-500/40 bg-teal-500/5' : 'border-slate-800/80 bg-slate-800/30 hover:border-slate-700 hover:bg-slate-800/40'
      }`}>
      <div className="flex flex-col items-center justify-center py-6 px-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors ${dragging ? 'bg-teal-500/15' : 'bg-slate-800/50 group-hover:bg-slate-800/60'}`}>
          <Upload size={18} className={dragging ? 'text-teal-400' : 'text-slate-400'} />
        </div>
        <p className={`text-sm font-medium ${dragging ? 'text-teal-400' : 'text-slate-400'}`}>{dragging ? 'Drop file here' : label}</p>
        <p className="text-[11px] text-slate-600 mt-1">or click to browse</p>
      </div>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]) }} />
    </div>
  )
}

// ============ MULTI DROP ZONE (receipts) ============
function MultiDropZone({ files, onAddFiles, onRemoveFile, uploading, label, accept }: { 
  files: File[]; onAddFiles: (f: File[]) => void; onRemoveFile: (i: number) => void; uploading?: boolean; label: string; accept: string 
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrag = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation() }, [])
  const handleDragIn = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer.items?.length > 0) setDragging(true) }, [])
  const handleDragOut = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragging(false) }, [])
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragging(false)
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf' || f.type.startsWith('image/'))
    if (dropped.length > 0) onAddFiles(dropped)
  }, [onAddFiles])

  return (
    <div className="space-y-2">
      <div onDragEnter={handleDragIn} onDragLeave={handleDragOut} onDragOver={handleDrag} onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200 group ${
          dragging ? 'border-teal-500/40 bg-teal-500/5' : 'border-slate-800/80 bg-slate-800/30 hover:border-slate-700 hover:bg-slate-800/40'
        }`}>
        <div className="flex flex-col items-center justify-center py-5 px-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-colors ${dragging ? 'bg-teal-500/15' : 'bg-slate-800/50 group-hover:bg-slate-800/60'}`}>
            <Upload size={18} className={dragging ? 'text-teal-400' : 'text-slate-400'} />
          </div>
          <p className={`text-sm font-medium ${dragging ? 'text-teal-400' : 'text-slate-400'}`}>{dragging ? 'Drop files here' : label}</p>
          <p className="text-[11px] text-slate-600 mt-1">PDF, JPEG, PNG — multiple files</p>
        </div>
        <input ref={inputRef} type="file" accept={accept} multiple className="hidden" onChange={e => {
          if (e.target.files) {
            const added = Array.from(e.target.files).filter(f => f.type === 'application/pdf' || f.type.startsWith('image/'))
            if (added.length > 0) onAddFiles(added)
          }
          e.target.value = ''
        }} />
      </div>
      {files.map((file, i) => (
        <div key={i} className="flex items-center gap-3 px-3.5 py-2.5 bg-slate-800/40 border border-slate-800/80 rounded-xl">
          {file.type.startsWith('image/') ? (
            <img src={URL.createObjectURL(file)} alt="" className="w-8 h-8 rounded-lg object-cover border border-slate-800" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
              <FileText size={14} className="text-rose-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs truncate">{file.name}</p>
            <p className="text-slate-500 text-[11px]">{file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(0)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}</p>
          </div>
          {uploading ? <Loader2 size={14} className="text-teal-400 animate-spin shrink-0" /> : (
            <button onClick={(e) => { e.stopPropagation(); onRemoveFile(i) }} className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800/50 transition-colors shrink-0"><X size={12} /></button>
          )}
        </div>
      ))}
    </div>
  )
}

// ============ MAIN COMPONENT ============
export default function ContractorPortal() {
  const [step, setStep] = useState<'email' | 'portal'>('email')
  const [email, setEmail] = useState('')
  const [member, setMember] = useState<TeamMember | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [rateCards, setRateCards] = useState<RateCard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'time' | 'expenses' | 'invoices' | 'history'>('time')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Time
  const [weekDate, setWeekDate] = useState(new Date())
  const [timeEntries, setTimeEntries] = useState<Record<string, TimeEntryForm>>({})
  const [existingEntries, setExistingEntries] = useState<any[]>([])
  const [submittingTime, setSubmittingTime] = useState(false)
  const [timeSuccess, setTimeSuccess] = useState(false)
  const [collapsedClients, setCollapsedClients] = useState<Set<string>>(new Set())

  // Expenses
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseForm, setExpenseForm] = useState({ date: new Date().toISOString().split('T')[0], category: 'travel', description: '', amount: '', project_id: '', client_id: '' })
  const [expenseFiles, setExpenseFiles] = useState<File[]>([])
  const [submittingExpense, setSubmittingExpense] = useState(false)

  // Invoices
  const [invoices, setInvoices] = useState<ContractorInvoice[]>([])
  const [showInvoiceForm, setShowInvoiceForm] = useState(false)
  const [invoiceMonth, setInvoiceMonth] = useState(new Date())
  const [invoiceForm, setInvoiceForm] = useState({ invoice_number: '', payment_terms: 'NET30', notes: '', client_id: 'all', amount: '' })
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [invoiceDistribution, setInvoiceDistribution] = useState<InvoiceLine[]>([])
  const [submittingInvoice, setSubmittingInvoice] = useState(false)

  // History
  const [historyMonth, setHistoryMonth] = useState(new Date())
  const [historyFilter, setHistoryFilter] = useState<'all' | 'time' | 'expenses' | 'invoices'>('all')
  const [historyTime, setHistoryTime] = useState<any[]>([])
  const [historyExpenses, setHistoryExpenses] = useState<Expense[]>([])
  const [historyInvoices, setHistoryInvoices] = useState<ContractorInvoice[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const week = useMemo(() => getWeekRange(weekDate), [weekDate])
  const billingMonth = useMemo(() => getMonthRange(invoiceMonth), [invoiceMonth])

  const assignmentsByClient = useMemo(() => {
    const grouped: Record<string, { clientName: string; projects: Assignment[] }> = {}
    assignments.forEach(a => { if (!grouped[a.client_id]) grouped[a.client_id] = { clientName: a.client_name, projects: [] }; grouped[a.client_id].projects.push(a) })
    return grouped
  }, [assignments])

  const contractorType = useMemo(() => {
    const types: Record<string, { costType: string; costAmount: number }> = {}
    rateCards.forEach(rc => {
      types[rc.client_id] = {
        costType: normalizeCostType(rc.cost_type),
        costAmount: rc.cost_amount || 0
      }
    })
    const clients = Object.values(types)
    if (clients.length === 0) return 'tm'
    const allLS = clients.every(c => c.costType === 'lump_sum' || c.costType === 'monthly')
    const allTM = clients.every(c => c.costType === 'hourly' || c.costType === 'tm')
    if (allLS) return 'pure_ls'
    if (allTM) return 'tm'
    return 'mixed'
  }, [rateCards])

  // ============ LOOKUP EMAIL ============
  const lookupEmail = async () => {
    if (!email.trim()) { setError('Please enter your email'); return }
    setLoading(true); setError(null)
    try {
      const { data: md, error: me } = await supabase.from('team_members').select('id, name, email, cost_type, cost_amount, company_id').eq('email', email.trim().toLowerCase()).eq('status', 'active').single()
      if (me || !md) { setError('Email not found. Contact your administrator.'); setLoading(false); return }

      const { data: rcData } = await supabase.from('bill_rates').select('team_member_id, client_id, rate, cost_type, cost_amount').eq('team_member_id', md.id).eq('is_active', true)
      const { data: clientsData } = await supabase.from('clients').select('id, name')
      const cMap: Record<string, string> = {}; (clientsData || []).forEach((c: any) => { cMap[c.id] = c.name })
      setRateCards((rcData || []).map((r: any) => ({ team_member_id: r.team_member_id, client_id: r.client_id, client_name: cMap[r.client_id] || 'Unknown', cost_type: r.cost_type || 'hourly', cost_amount: r.cost_amount || 0, rate: r.rate || 0 })))

      const { data: pa } = await supabase.from('team_project_assignments').select('project_id, payment_type, rate, bill_rate').eq('team_member_id', md.id).eq('is_active', true)
      const { data: projects } = await supabase.from('projects').select('id, name, client_id, company_id').eq('status', 'active')
      const pMap: Record<string, any> = {}; (projects || []).forEach((p: any) => { pMap[p.id] = p })
      const assigns: Assignment[] = (pa || []).map((a: any) => { const p = pMap[a.project_id]; return { project_id: a.project_id, project_name: p?.name || 'Unknown', client_id: p?.client_id || '', client_name: p?.client_id ? cMap[p.client_id] || '' : '', payment_type: a.payment_type || 'tm', rate: a.bill_rate || a.rate || 0 } }).filter((a: Assignment) => a.project_name !== 'Unknown')

      // Ensure company_id — fallback to project's company_id if member record is missing it
      if (!md.company_id && projects && projects.length > 0) {
        const projectWithCompany = projects.find((p: any) => p.company_id)
        if (projectWithCompany) md.company_id = projectWithCompany.company_id
      }
      setMember(md); setAssignments(assigns)

      const init: Record<string, TimeEntryForm> = {}; assigns.forEach(a => { init[a.project_id] = { project_id: a.project_id, hours: '', notes: '' } }); setTimeEntries(init)

      const { data: expData } = await supabase.from('contractor_expenses').select('*').eq('team_member_id', md.id).order('date', { ascending: false }).limit(50)
      setExpenses(expData || [])

      const { data: invData } = await supabase.from('contractor_invoices').select('*, contractor_invoice_lines(*)').eq('team_member_id', md.id).order('invoice_date', { ascending: false }).limit(20)
      setInvoices(invData || [])

      setStep('portal')
    } catch (err: any) { setError(err.message || 'Something went wrong') } finally { setLoading(false) }
  }

  // ============ LOAD TIME ENTRIES FOR WEEK ============
  useEffect(() => {
    if (!member || assignments.length === 0) return
    const load = async () => {
      const { data } = await supabase.from('time_entries').select('project_id, hours, description, date, id').eq('contractor_id', member.id).gte('date', week.start).lte('date', week.end)
      if (data && data.length > 0) {
        const grouped: Record<string, TimeEntryForm> = {}; assignments.forEach(a => { grouped[a.project_id] = { project_id: a.project_id, hours: '', notes: '' } })
        data.forEach((e: any) => { if (grouped[e.project_id]) { grouped[e.project_id].hours = String(parseFloat(grouped[e.project_id].hours || '0') + (e.hours || 0)); if (e.description && !grouped[e.project_id].notes) grouped[e.project_id].notes = e.description } })
        setTimeEntries(grouped); setExistingEntries(data)
      } else { const init: Record<string, TimeEntryForm> = {}; assignments.forEach(a => { init[a.project_id] = { project_id: a.project_id, hours: '', notes: '' } }); setTimeEntries(init); setExistingEntries([]) }
    }
    load()
  }, [member, assignments, week.start, week.end])

  // ============ SUBMIT TIME ============
  const submitTime = async () => {
    if (!member) return; setSubmittingTime(true); setError(null)
    try {
      if (existingEntries.length > 0) {
        const ids = existingEntries.map((e: any) => e.id)
        await supabase.from('time_entries').delete().in('id', ids)
      }
      const entries = Object.values(timeEntries).filter(e => parseFloat(e.hours || '0') > 0).map(e => {
        const a = assignments.find(a => a.project_id === e.project_id)
        return { contractor_id: member.id, project_id: e.project_id, date: week.start, hours: parseFloat(e.hours), billable_hours: parseFloat(e.hours), is_billable: true, bill_rate: a?.rate || 0, description: e.notes || null, company_id: member.company_id }
      })
      if (entries.length > 0) { const { error: ie } = await supabase.from('time_entries').insert(entries); if (ie) throw ie }
      setTimeSuccess(true); setTimeout(() => setTimeSuccess(false), 3000)
    } catch (err: any) { setError(err.message || 'Failed to submit') } finally { setSubmittingTime(false) }
  }

  // ============ SUBMIT EXPENSE ============
  const submitExpense = async () => {
    if (!member) return; setSubmittingExpense(true); setError(null)
    try {
      let receiptUrl: string | null = null
      const receiptUrls: string[] = []
      for (const f of expenseFiles) {
        const url = await uploadFile(f, 'expenses', member.id)
        if (url) receiptUrls.push(url)
      }
      if (receiptUrls.length > 0) receiptUrl = receiptUrls.join(',')
      const clientName = expenseForm.client_id ? (assignmentsByClient[expenseForm.client_id]?.clientName || '') : ''
      const isInternal = clientName.toLowerCase().includes('mano') || clientName.toLowerCase().includes('internal') || clientName.toLowerCase().includes('overhead')
      const isBillable = !!expenseForm.client_id && !isInternal
      const { error: ie } = await supabase.from('contractor_expenses').insert({ team_member_id: member.id, date: expenseForm.date, category: expenseForm.category, description: expenseForm.description, amount: parseFloat(expenseForm.amount), project_id: expenseForm.project_id || null, client_id: expenseForm.client_id || null, receipt_url: receiptUrl, is_billable: isBillable, status: 'pending' })
      if (ie) throw ie
      setShowExpenseForm(false); setExpenseForm({ date: new Date().toISOString().split('T')[0], category: 'travel', description: '', amount: '', project_id: '', client_id: '' }); setExpenseFiles([])
      const { data } = await supabase.from('contractor_expenses').select('*').eq('team_member_id', member.id).order('date', { ascending: false }).limit(50); setExpenses(data || [])
    } catch (err: any) { setError(err.message || 'Failed to submit expense') } finally { setSubmittingExpense(false) }
  }

  // ============ INVOICE DISTRIBUTION ============
  const calculateDistribution = useCallback(async () => {
    if (!member) return
    const { data: me } = await supabase.from('time_entries').select('project_id, hours').eq('contractor_id', member.id).gte('date', billingMonth.start).lte('date', billingMonth.end)
    if (!me || me.length === 0) { setInvoiceDistribution([]); return }

    const totalH = me.reduce((s: number, e: any) => s + (e.hours || 0), 0)
    const byProject: Record<string, number> = {}
    me.forEach((e: any) => { byProject[e.project_id] = (byProject[e.project_id] || 0) + (e.hours || 0) })

    const lines: InvoiceLine[] = Object.entries(byProject).map(([pid, hours]) => {
      const a = assignments.find(a => a.project_id === pid)
      return { client_id: a?.client_id || '', client_name: a?.client_name || 'Unknown', project_id: pid, project_name: a?.project_name, hours, rate: a?.rate || 0, amount: 0, allocation_pct: totalH > 0 ? Math.round((hours / totalH) * 100) : 0 }
    })

    if (invoiceForm.client_id && invoiceForm.client_id !== 'all') {
      setInvoiceDistribution(lines.filter(l => l.client_id === invoiceForm.client_id))
    } else {
      setInvoiceDistribution(lines)
    }
  }, [member, assignments, billingMonth.start, billingMonth.end, invoiceForm.client_id])

  useEffect(() => { if (showInvoiceForm) calculateDistribution() }, [showInvoiceForm, calculateDistribution])

  // ============ SUBMIT INVOICE ============
  const submitInvoice = async () => {
    if (!member) return; setSubmittingInvoice(true); setError(null)
    try {
      const enteredAmount = parseFloat(invoiceForm.amount || '0')
      if (enteredAmount <= 0) { setError('Please enter a valid amount'); setSubmittingInvoice(false); return }

      let receiptUrl: string | null = null
      if (invoiceFile) receiptUrl = await uploadFile(invoiceFile, 'invoices', member.id)

      const { data: inv, error: ie } = await supabase.from('contractor_invoices').insert({
        team_member_id: member.id, invoice_number: invoiceForm.invoice_number,
        invoice_date: new Date().toISOString().split('T')[0], due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        period_start: billingMonth.start, period_end: billingMonth.end,
        total_amount: enteredAmount, payment_terms: invoiceForm.payment_terms, receipt_url: receiptUrl, notes: invoiceForm.notes || null, status: 'submitted'
      }).select().single()
      if (ie || !inv) throw ie || new Error('Failed to create invoice')

      if (invoiceDistribution.length > 0) {
        const totalHours = invoiceDistribution.reduce((s, l) => s + (l.hours || 0), 0)
        const lines = invoiceDistribution.map(l => ({
          invoice_id: inv.id, client_id: l.client_id, project_id: l.project_id || null,
          description: l.client_name + (l.project_name ? ` - ${l.project_name}` : ''),
          hours: l.hours, rate: totalHours > 0 ? enteredAmount / totalHours : 0,
          amount: totalHours > 0 ? (l.hours || 0) / totalHours * enteredAmount : 0,
          allocation_pct: l.allocation_pct
        }))
        await supabase.from('contractor_invoice_lines').insert(lines)
      }
      setShowInvoiceForm(false); setInvoiceForm({ invoice_number: '', payment_terms: 'NET30', notes: '', client_id: 'all', amount: '' }); setInvoiceFile(null); setInvoiceDistribution([])
      const { data: invData } = await supabase.from('contractor_invoices').select('*, contractor_invoice_lines(*)').eq('team_member_id', member.id).order('invoice_date', { ascending: false }).limit(20)
      setInvoices(invData || [])
    } catch (err: any) { setError(err.message || 'Failed to submit invoice') } finally { setSubmittingInvoice(false) }
  }

  // ============ DELETE INVOICE ============
  const deleteInvoice = async (id: string) => {
    if (!confirm('Delete this invoice? This cannot be undone.')) return
    setError(null)
    try {
      await supabase.from('contractor_invoice_lines').delete().eq('invoice_id', id)
      await supabase.from('contractor_invoices').delete().eq('id', id)
      setInvoices(prev => prev.filter(inv => inv.id !== id))
    } catch (err: any) { setError(err.message || 'Failed to delete') }
  }

  // ============ LOAD HISTORY ============
  const historyRange = useMemo(() => getMonthRange(historyMonth), [historyMonth])

  useEffect(() => {
    if (!member || activeTab !== 'history') return
    const load = async () => {
      setHistoryLoading(true)
      try {
        // Time entries for the selected month
        const { data: timeData } = await supabase
          .from('time_entries')
          .select('id, project_id, hours, billable_hours, description, date, created_at')
          .eq('contractor_id', member.id)
          .gte('date', historyRange.start)
          .lte('date', historyRange.end)
          .order('date', { ascending: false })

        // Expenses for the selected month
        const { data: expData } = await supabase
          .from('contractor_expenses')
          .select('*')
          .eq('team_member_id', member.id)
          .gte('date', historyRange.start)
          .lte('date', historyRange.end)
          .order('date', { ascending: false })

        // Invoices where period overlaps the selected month
        const { data: invData } = await supabase
          .from('contractor_invoices')
          .select('*, contractor_invoice_lines(*)')
          .eq('team_member_id', member.id)
          .lte('period_start', historyRange.end)
          .gte('period_end', historyRange.start)
          .order('invoice_date', { ascending: false })

        setHistoryTime(timeData || [])
        setHistoryExpenses(expData || [])
        setHistoryInvoices(invData || [])
      } catch (err) { console.error('History load error:', err) }
      finally { setHistoryLoading(false) }
    }
    load()
  }, [member, activeTab, historyRange.start, historyRange.end])

  // History computed totals
  const historyTotals = useMemo(() => {
    const totalHours = historyTime.reduce((s: number, e: any) => s + (e.hours || 0), 0)
    const totalExpenses = historyExpenses.reduce((s, e) => s + (e.amount || 0), 0)
    const totalInvoiced = historyInvoices.reduce((s, inv) => s + (inv.total_amount || 0), 0)
    return { totalHours, totalExpenses, totalInvoiced }
  }, [historyTime, historyExpenses, historyInvoices])

  // Group time entries by week for history display
  const historyTimeByWeek = useMemo(() => {
    const weeks: Record<string, { label: string; entries: any[]; totalHours: number }> = {}
    historyTime.forEach((e: any) => {
      const d = new Date(e.date + 'T00:00:00')
      const day = d.getDay()
      const weekStart = new Date(d); weekStart.setDate(d.getDate() - day)
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
      const key = weekStart.toISOString().split('T')[0]
      if (!weeks[key]) {
        weeks[key] = {
          label: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          entries: [],
          totalHours: 0
        }
      }
      weeks[key].entries.push(e)
      weeks[key].totalHours += e.hours || 0
    })
    return Object.entries(weeks).sort(([a], [b]) => b.localeCompare(a))
  }, [historyTime])

  const navItems = [
    { id: 'time' as const, label: 'Timesheet', icon: Timer, desc: 'Log hours' },
    { id: 'expenses' as const, label: 'Expenses', icon: CreditCard, desc: 'Track costs' },
    { id: 'invoices' as const, label: 'Invoices', icon: FileText, desc: 'Bill clients' },
    { id: 'history' as const, label: 'History', icon: History, desc: 'Past records' }
  ]
  const totalTimeHours = Object.values(timeEntries).reduce((s, e) => s + parseFloat(e.hours || '0'), 0)

  // ============ LOGIN SCREEN ============
  if (step === 'email') {
    return (
      <div className="min-h-screen bg-[#0B0F19] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 mb-5">
              <svg width={40} height={40} viewBox="0 0 40 40" fill="none">
                <defs><linearGradient id="vLogo" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#2dd4bf" /><stop offset="100%" stopColor="#10b981" /></linearGradient></defs>
                <path d="M8 8L20 32L32 8" stroke="url(#vLogo)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            <h1 className="text-[22px] font-bold text-white tracking-tight">Welcome to Vantage</h1>
            <p className="text-slate-500 text-sm mt-2">Time tracking, expenses, and invoicing</p>
          </div>

          <div className={`${cardClass} p-6`}>
            <label className={labelClass}>Email address</label>
            <input 
              type="email" value={email} onChange={e => setEmail(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && lookupEmail()} 
              placeholder="you@company.com"
              className={`${inputClass} mb-4`} 
            />
            {error && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2.5 text-rose-400 text-sm">
                <AlertCircle size={15} className="shrink-0" /> {error}
              </div>
            )}
            <button onClick={lookupEmail} disabled={loading} className={`w-full ${btnPrimary}`}>
              {loading ? <><Loader2 size={16} className="animate-spin" /> Looking up...</> : <>Continue <ArrowRight size={15} /></>}
            </button>
          </div>

          <p className="text-center text-slate-700 text-[11px] mt-8 tracking-wide uppercase">Powered by Vantage</p>
        </div>
      </div>
    )
  }

  // ============ PORTAL ============
  return (
    <div className="min-h-screen bg-[#0B0F19] text-white">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#0B0F19]/95">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo + Name */}
            <div className="flex items-center gap-3.5">
              <svg width={24} height={24} viewBox="0 0 40 40" fill="none">
                <defs><linearGradient id="vS" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#2dd4bf" /><stop offset="100%" stopColor="#10b981" /></linearGradient></defs>
                <path d="M8 8L20 32L32 8" stroke="url(#vS)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              <div className="h-5 w-px bg-slate-700" />
              <span className="text-sm text-slate-400">{member?.name}</span>
            </div>

            {/* Nav — underline tabs */}
            <nav className="flex items-center gap-0">
              {navItems.map(item => (
                <button key={item.id} onClick={() => { setActiveTab(item.id); setError(null) }}
                  className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                    activeTab === item.id 
                      ? 'text-teal-400 border-teal-400' 
                      : 'text-slate-500 border-transparent hover:text-slate-300 hover:border-slate-600'
                  }`}>
                  <item.icon size={15} />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Sign out */}
            <button onClick={() => { setStep('email'); setMember(null); setAssignments([]); setRateCards([]); setEmail('') }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:text-rose-400 hover:bg-slate-800/40 transition-all duration-200">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-3 text-rose-400 text-sm animate-in slide-in-from-top-2">
            <AlertCircle size={16} className="shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="p-1 hover:bg-slate-800/50 rounded-lg transition-colors"><X size={14} /></button>
          </div>
        )}

        {/* ====== TIMESHEET ====== */}
        {activeTab === 'time' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight">Timesheet</h1>
                <p className="text-slate-500 text-sm mt-1">Log your hours for the week</p>
              </div>
              <div className="flex items-center gap-2">
                {timeSuccess && (
                  <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-400/10 border border-emerald-400/20 px-4 py-2 rounded-xl">
                    <CheckCircle size={15} /> Submitted
                  </div>
                )}
              </div>
            </div>

            {/* Week Navigator */}
            <div className={`${cardClass} p-1.5 inline-flex items-center gap-1`}>
              <button onClick={() => { const d = new Date(weekDate); d.setDate(d.getDate() - 7); setWeekDate(d) }}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all duration-200">
                <ChevronLeft size={16} />
              </button>
              <div className="flex items-center gap-2.5 px-4 py-1.5">
                <Calendar size={14} className="text-teal-400" />
                <span className="text-sm font-medium text-white">{week.label}</span>
              </div>
              <button onClick={() => { const d = new Date(weekDate); d.setDate(d.getDate() + 7); setWeekDate(d) }}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all duration-200">
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Client Sections */}
            <div className="space-y-4">
              {Object.entries(assignmentsByClient).map(([cid, { clientName, projects }]) => {
                const collapsed = collapsedClients.has(cid)
                const clientHours = projects.reduce((s, p) => s + parseFloat(timeEntries[p.project_id]?.hours || '0'), 0)
                return (
                  <div key={cid} className={`${cardClass} overflow-hidden`}>
                    <button onClick={() => { const n = new Set(collapsedClients); collapsed ? n.delete(cid) : n.add(cid); setCollapsedClients(n) }}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-800/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center">
                          <Briefcase size={14} className="text-teal-400" />
                        </div>
                        <div className="text-left">
                          <span className="text-white font-semibold text-sm">{clientName}</span>
                          <span className="text-slate-600 text-xs ml-2">{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {clientHours > 0 && (
                          <span className="text-sm font-semibold text-teal-400 bg-teal-400/10 px-3 py-1 rounded-lg">{clientHours}h</span>
                        )}
                        <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`} />
                      </div>
                    </button>
                    {!collapsed && (
                      <div className="px-5 pb-4 space-y-2">
                        {projects.map(p => (
                            <div key={p.project_id} className="bg-slate-800/30 border border-slate-800/60 rounded-xl p-3.5 transition-all duration-200 hover:border-slate-700">
                              <div className="flex items-center gap-4">
                                <span className="text-slate-300 text-sm flex-1 min-w-0 truncate">{p.project_name}</span>
                                <div className="flex items-center gap-2">
                                  <input type="number" placeholder="0" min="0" step="0.5" 
                                    value={timeEntries[p.project_id]?.hours || ''} 
                                    onChange={e => setTimeEntries(prev => ({ ...prev, [p.project_id]: { ...prev[p.project_id], hours: e.target.value } }))}
                                    className="w-20 px-3 py-2 bg-slate-800/40 border border-slate-800/80 rounded-lg text-white text-sm text-right focus:outline-none focus:ring-1 focus:ring-teal-500/30 focus:border-teal-600/50 transition-all" />
                                  <span className="text-slate-600 text-xs font-medium w-6">hrs</span>
                                </div>
                              </div>
                              <input type="text" placeholder="What did you work on?" 
                                value={timeEntries[p.project_id]?.notes || ''} 
                                onChange={e => setTimeEntries(prev => ({ ...prev, [p.project_id]: { ...prev[p.project_id], notes: e.target.value } }))}
                                className="w-full mt-3 px-3.5 py-2 bg-slate-800/30 border border-slate-800/60 rounded-lg text-slate-400 text-xs placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-500/30 focus:border-teal-600/50 transition-all" />
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Submit Footer */}
            <div className={`${cardClass} p-5`}>
              <div className="flex items-center justify-between mb-4">
                <span className="text-slate-400 text-sm font-medium">Total Hours</span>
                <span className={`text-2xl font-bold tracking-tight ${totalTimeHours > 0 ? 'text-white' : 'text-slate-700'}`}>{totalTimeHours}</span>
              </div>
              <button onClick={submitTime} disabled={submittingTime || totalTimeHours === 0} className={`w-full ${btnPrimary} py-3`}>
                {submittingTime ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : <><Send size={16} /> Submit Timesheet</>}
              </button>
            </div>
          </div>
        )}

        {/* ====== EXPENSES ====== */}
        {activeTab === 'expenses' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight">Expenses</h1>
                <p className="text-slate-500 text-sm mt-1">Submit and track expense reports</p>
              </div>
              <button onClick={() => setShowExpenseForm(true)} className={btnPrimary}>
                <Plus size={15} /> New Expense
              </button>
            </div>

            {/* New Expense Form */}
            {showExpenseForm && (
              <div className={`${cardClass} p-6 border-teal-500/20`}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-white font-semibold">New Expense</h2>
                  <button onClick={() => { setShowExpenseForm(false); setExpenseFiles([]) }} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors"><X size={16} /></button>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <label className={labelClass}>Date</label>
                    <input type="date" value={expenseForm.date} onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Category</label>
                    <select value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))} className={selectClass}>
                      {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Amount</label>
                    <div className="relative">
                      <DollarSign size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input type="number" placeholder="0.00" step="0.01" min="0" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))} className={`${inputClass} pl-9`} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Client</label>
                    <select value={expenseForm.client_id} onChange={e => setExpenseForm(p => ({ ...p, client_id: e.target.value, project_id: '' }))} className={selectClass}>
                      <option value="">No client (general)</option>
                      {Object.entries(assignmentsByClient).map(([cid, { clientName }]) => <option key={cid} value={cid}>{clientName}</option>)}
                    </select>
                  </div>

                  {/* Billable Indicator */}
                  {expenseForm.client_id && (() => {
                    const cName = assignmentsByClient[expenseForm.client_id]?.clientName || ''
                    const isInternal = cName.toLowerCase().includes('mano') || cName.toLowerCase().includes('internal') || cName.toLowerCase().includes('overhead')
                    return (
                      <div className={`col-span-2 flex items-center gap-2.5 px-4 py-3 rounded-xl border ${isInternal ? 'bg-amber-400/5 border-amber-400/15' : 'bg-teal-400/5 border-teal-400/15'}`}>
                        <div className={`w-2 h-2 rounded-full ${isInternal ? 'bg-amber-400' : 'bg-teal-400'}`} />
                        <span className={`text-xs font-semibold ${isInternal ? 'text-amber-400' : 'text-teal-400'}`}>
                          {isInternal ? 'Overhead — company operating expense' : 'Billable — billed to client at cost'}
                        </span>
                      </div>
                    )
                  })()}

                  <div className="col-span-2">
                    <label className={labelClass}>Description</label>
                    <input type="text" placeholder="What was this expense for?" value={expenseForm.description} onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))} className={inputClass} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Receipts / Documents</label>
                    <MultiDropZone files={expenseFiles} onAddFiles={(f) => setExpenseFiles(prev => [...prev, ...f])} onRemoveFile={(i) => setExpenseFiles(prev => prev.filter((_, idx) => idx !== i))} uploading={submittingExpense} label="Drop receipts here" accept="image/*,.pdf" />
                  </div>
                </div>
                <button onClick={submitExpense} disabled={submittingExpense || !expenseForm.description || !expenseForm.amount} className={`w-full mt-6 ${btnPrimary} py-3`}>
                  {submittingExpense ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : <><Send size={16} /> Submit Expense</>}
                </button>
              </div>
            )}

            {/* Expense List */}
            {expenses.length > 0 ? (
              <div className="space-y-2">
                {expenses.map(exp => {
                  const cat = EXPENSE_CATEGORIES.find(c => c.id === exp.category)
                  const st = STATUS_CONFIG[exp.status] || STATUS_CONFIG.pending
                  return (
                    <div key={exp.id} className={`${cardClass} px-5 py-4 flex items-center gap-4 hover:bg-slate-800/30 transition-all duration-200`}>
                      <div className="w-10 h-10 rounded-xl bg-slate-800/40 flex items-center justify-center shrink-0">
                        <Receipt size={16} className="text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{exp.description}</p>
                        <div className="flex items-center gap-2 text-slate-500 text-xs mt-1">
                          <span>{formatDate(exp.date)}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-700" />
                          <span>{cat?.label || exp.category}</span>
                          {exp.receipt_url && <><span className="w-1 h-1 rounded-full bg-slate-700" /><Paperclip size={10} className="text-sky-400" /></>}
                        </div>
                      </div>
                      <span className="text-white font-semibold text-sm">{formatCurrency(exp.amount)}</span>
                      <StatusPill status={exp.status} />
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={`${cardClass} text-center py-16`}>
                <div className="w-14 h-14 rounded-xl bg-slate-800/40 flex items-center justify-center mx-auto mb-4">
                  <Receipt size={24} className="text-slate-600" />
                </div>
                <p className="text-slate-500 text-sm">No expenses submitted yet</p>
                <p className="text-slate-700 text-xs mt-1">Click "New Expense" to get started</p>
              </div>
            )}
          </div>
        )}

        {/* ====== INVOICES ====== */}
        {activeTab === 'invoices' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight">Invoices</h1>
                <p className="text-slate-500 text-sm mt-1">Submit monthly invoices</p>
              </div>
              <button onClick={() => { 
                const defaultClient = contractorType === 'pure_ls' ? 'all' : ''
                setInvoiceForm(p => ({ ...p, client_id: defaultClient }))
                setShowInvoiceForm(true) 
              }} className={btnPrimary}>
                <Plus size={15} /> New Invoice
              </button>
            </div>

            {/* New Invoice Form */}
            {showInvoiceForm && (
              <div className={`${cardClass} p-6 border-teal-500/20`}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-white font-semibold">Submit Invoice</h2>
                  <button onClick={() => { setShowInvoiceForm(false); setInvoiceFile(null) }} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800/50 transition-colors"><X size={16} /></button>
                </div>

                {/* Row 1 */}
                <div className="grid grid-cols-2 gap-5 mb-5">
                  <div>
                    <label className={labelClass}>Invoice Number</label>
                    <div className="relative">
                      <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input type="text" placeholder="INV-2026-001" value={invoiceForm.invoice_number} onChange={e => setInvoiceForm(p => ({ ...p, invoice_number: e.target.value }))} className={`${inputClass} pl-9`} />
                    </div>
                  </div>
                  {contractorType === 'pure_ls' ? (
                    <div>
                      <label className={labelClass}>Invoice For</label>
                      <div className={`${inputClass} bg-slate-800/30 text-slate-400`}>All Clients (distributed by effort)</div>
                    </div>
                  ) : (
                    <div>
                      <label className={labelClass}>Invoice For</label>
                      <select value={invoiceForm.client_id} onChange={e => setInvoiceForm(p => ({ ...p, client_id: e.target.value }))} className={selectClass}>
                        <option value="">Select a client</option>
                        {Object.entries(assignmentsByClient).map(([cid, { clientName }]) => <option key={cid} value={cid}>{clientName}</option>)}
                      </select>
                      {contractorType === 'mixed' && <p className="text-[11px] text-slate-600 mt-1.5">Submit a separate invoice for each client.</p>}
                    </div>
                  )}
                </div>

                {/* Row 2 */}
                <div className="grid grid-cols-2 gap-5 mb-5">
                  <div>
                    <label className={labelClass}>Billing Period</label>
                    <div className={`${cardClass} p-1 inline-flex items-center gap-1 w-full`}>
                      <button onClick={() => { const d = new Date(invoiceMonth); d.setMonth(d.getMonth() - 1); setInvoiceMonth(d) }} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"><ChevronLeft size={14} /></button>
                      <span className="text-white text-sm font-medium flex-1 text-center py-1">{billingMonth.label}</span>
                      <button onClick={() => { const d = new Date(invoiceMonth); d.setMonth(d.getMonth() + 1); setInvoiceMonth(d) }} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors"><ChevronRight size={14} /></button>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Invoice Amount</label>
                    <div className="relative">
                      <DollarSign size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input type="number" placeholder="0.00" step="0.01" min="0" value={invoiceForm.amount} onChange={e => setInvoiceForm(p => ({ ...p, amount: e.target.value }))} className={`${inputClass} pl-9`} />
                    </div>
                  </div>
                </div>

                {/* Distribution Reference */}
                {invoiceDistribution.length > 0 ? (
                  <div className="mb-5">
                    <p className={`${labelClass} mb-2`}>Timesheet Reference — {billingMonth.label}</p>
                    <div className="bg-slate-800/30 border border-slate-800/60 rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead><tr className="text-slate-600 text-[11px] uppercase tracking-wider">
                          <th className="text-left px-4 py-2.5 font-semibold">Client</th>
                          {invoiceDistribution.some(l => l.project_name) && <th className="text-left px-4 py-2.5 font-semibold">Project</th>}
                          <th className="text-right px-4 py-2.5 font-semibold">Hours</th>
                          {invoiceDistribution.some(l => l.allocation_pct !== undefined) && <th className="text-right px-4 py-2.5 font-semibold">%</th>}
                        </tr></thead>
                        <tbody>{invoiceDistribution.map((l, i) => (
                          <tr key={i} className="border-t border-slate-800/60">
                            <td className="px-4 py-2.5 text-slate-400 text-xs">{l.client_name}</td>
                            {invoiceDistribution.some(x => x.project_name) && <td className="px-4 py-2.5 text-slate-500 text-xs">{l.project_name || '—'}</td>}
                            <td className="px-4 py-2.5 text-right text-slate-300 text-xs font-medium">{l.hours?.toFixed(1)}</td>
                            {invoiceDistribution.some(x => x.allocation_pct !== undefined) && <td className="px-4 py-2.5 text-right text-slate-500 text-xs">{l.allocation_pct !== undefined ? `${l.allocation_pct}%` : '—'}</td>}
                          </tr>
                        ))}</tbody>
                        <tfoot><tr className="border-t border-slate-800/80">
                          <td colSpan={invoiceDistribution.some(l => l.project_name) ? 2 : 1} className="px-4 py-2.5 text-slate-400 text-xs font-semibold">Total</td>
                          <td className="px-4 py-2.5 text-right text-white text-xs font-semibold">{invoiceDistribution.reduce((s, l) => s + (l.hours || 0), 0).toFixed(1)}h</td>
                          {invoiceDistribution.some(l => l.allocation_pct !== undefined) && <td className="px-4 py-2.5 text-right text-slate-400 text-xs">100%</td>}
                        </tr></tfoot>
                      </table>
                    </div>
                  </div>
                ) : (contractorType !== 'pure_ls' && !invoiceForm.client_id) ? (
                  <div className="mb-5 p-4 bg-slate-800/30 border border-slate-800/60 rounded-xl text-center text-slate-500 text-sm">Select a client above to see your timesheet hours.</div>
                ) : null}

                {/* Attachment + Notes */}
                <div className="mb-5">
                  <label className={labelClass}>Invoice Attachment</label>
                  <DropZone file={invoiceFile} onFile={setInvoiceFile} onRemove={() => setInvoiceFile(null)} uploading={submittingInvoice} label="Drop invoice PDF here" accept=".pdf,image/*" />
                </div>
                <div className="mb-5">
                  <label className={labelClass}>Notes (optional)</label>
                  <textarea rows={2} placeholder="Any additional notes..." value={invoiceForm.notes} onChange={e => setInvoiceForm(p => ({ ...p, notes: e.target.value }))} className={`${inputClass} resize-none`} />
                </div>

                <button onClick={submitInvoice} disabled={submittingInvoice || !invoiceForm.invoice_number || parseFloat(invoiceForm.amount || '0') <= 0 || (contractorType !== 'pure_ls' && !invoiceForm.client_id)} className={`w-full ${btnPrimary} py-3`}>
                  {submittingInvoice ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : <><Send size={16} /> Submit Invoice</>}
                </button>
              </div>
            )}

            {/* Invoice History */}
            {invoices.length > 0 ? (
              <div className="space-y-2">
                {invoices.map(inv => {
                  const lines = inv.contractor_invoice_lines || inv.lines || []
                  return (
                    <div key={inv.id} className={`${cardClass} overflow-hidden`}>
                      <div className="px-5 py-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center shrink-0">
                          <FileText size={16} className="text-sky-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white text-sm font-medium">{inv.invoice_number}</p>
                            {inv.receipt_url && <Paperclip size={11} className="text-sky-400" />}
                          </div>
                          <p className="text-slate-500 text-xs mt-0.5">{formatDate(inv.period_start)} – {formatDate(inv.period_end)}</p>
                        </div>
                        <span className="text-white font-semibold text-sm">{formatCurrency(inv.total_amount)}</span>
                        <StatusPill status={inv.status} />
                        {inv.status === 'submitted' && (
                          <button onClick={() => deleteInvoice(inv.id)} className="p-2 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-slate-800/40 transition-all duration-200" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {lines.length > 0 && (
                        <div className="px-5 pb-4 pt-0">
                          <div className="border-t border-slate-800/60 pt-3 space-y-1.5">
                            {lines.map((l: any, i: number) => (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <span className="text-slate-400">{l.description}</span>
                                <span className="text-slate-500">{l.hours ? `${l.hours}h` : ''}{l.allocation_pct ? ` · ${l.allocation_pct}%` : ''}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={`${cardClass} text-center py-16`}>
                <div className="w-14 h-14 rounded-xl bg-slate-800/40 flex items-center justify-center mx-auto mb-4">
                  <FileText size={24} className="text-slate-600" />
                </div>
                <p className="text-slate-500 text-sm">No invoices submitted yet</p>
                <p className="text-slate-700 text-xs mt-1">Click "New Invoice" to get started</p>
              </div>
            )}
          </div>
        )}

        {/* ====== HISTORY ====== */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight">History</h1>
                <p className="text-slate-500 text-sm mt-1">Review your submitted timesheets, expenses, and invoices</p>
              </div>
            </div>

            {/* Month Navigator + Filter */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className={`${cardClass} p-1 inline-flex items-center gap-1`}>
                <button onClick={() => { const d = new Date(historyMonth); d.setMonth(d.getMonth() - 1); setHistoryMonth(d) }}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center gap-2.5 px-4 py-1.5">
                  <Calendar size={14} className="text-teal-400" />
                  <span className="text-sm font-medium text-white">{historyRange.label}</span>
                </div>
                <button onClick={() => { const d = new Date(historyMonth); d.setMonth(d.getMonth() + 1); setHistoryMonth(d) }}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-colors">
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="inline-flex items-center bg-slate-800/50 border border-slate-800/80 rounded-lg p-0.5">
                {([['all', 'All'], ['time', 'Time'], ['expenses', 'Expenses'], ['invoices', 'Invoices']] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setHistoryFilter(key)}
                    className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      historyFilter === key ? 'bg-slate-700 text-teal-400' : 'text-slate-500 hover:text-slate-300'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className={`${cardClass} p-4 flex items-start gap-3`}>
                <div className="w-1 h-10 rounded-r-full bg-teal-500 shrink-0 -ml-4" />
                <div className="pl-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Hours Logged</p>
                  <p className="text-xl font-semibold text-white tabular-nums mt-1">{historyTotals.totalHours.toFixed(1)}</p>
                </div>
              </div>
              <div className={`${cardClass} p-4 flex items-start gap-3`}>
                <div className="w-1 h-10 rounded-r-full bg-amber-500 shrink-0 -ml-4" />
                <div className="pl-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Expenses</p>
                  <p className="text-xl font-semibold text-white tabular-nums mt-1">{formatCurrency(historyTotals.totalExpenses)}</p>
                </div>
              </div>
              <div className={`${cardClass} p-4 flex items-start gap-3`}>
                <div className="w-1 h-10 rounded-r-full bg-sky-500 shrink-0 -ml-4" />
                <div className="pl-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Invoiced</p>
                  <p className="text-xl font-semibold text-white tabular-nums mt-1">{formatCurrency(historyTotals.totalInvoiced)}</p>
                </div>
              </div>
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="text-teal-500 animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* TIME ENTRIES */}
                {(historyFilter === 'all' || historyFilter === 'time') && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Timer size={14} className="text-teal-400" />
                      <h2 className="text-sm font-semibold text-white">Timesheet Entries</h2>
                      <span className="text-[11px] text-slate-500 ml-1">{historyTotals.totalHours.toFixed(1)}h total</span>
                    </div>
                    {historyTimeByWeek.length > 0 ? (
                      <div className="space-y-3">
                        {historyTimeByWeek.map(([weekKey, week]) => (
                          <div key={weekKey} className={`${cardClass} overflow-hidden`}>
                            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800/60">
                              <span className="text-xs font-medium text-slate-400">{week.label}</span>
                              <span className="text-xs font-semibold text-teal-400 tabular-nums">{week.totalHours.toFixed(1)}h</span>
                            </div>
                            <div className="divide-y divide-slate-800/40">
                              {week.entries.map((e: any) => {
                                const a = assignments.find(a => a.project_id === e.project_id)
                                return (
                                  <div key={e.id} className="px-5 py-3 flex items-center gap-4">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-white truncate">{a?.project_name || 'Unknown Project'}</p>
                                      <p className="text-xs text-slate-500 mt-0.5">{a?.client_name || ''}{e.description ? ` — ${e.description}` : ''}</p>
                                    </div>
                                    <span className="text-sm font-medium text-slate-300 tabular-nums">{e.hours}h</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={`${cardClass} text-center py-10`}>
                        <p className="text-slate-600 text-sm">No timesheet entries for {historyRange.label}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* EXPENSES */}
                {(historyFilter === 'all' || historyFilter === 'expenses') && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard size={14} className="text-amber-400" />
                      <h2 className="text-sm font-semibold text-white">Expenses</h2>
                      <span className="text-[11px] text-slate-500 ml-1">{historyExpenses.length} item{historyExpenses.length !== 1 ? 's' : ''}</span>
                    </div>
                    {historyExpenses.length > 0 ? (
                      <div className="space-y-2">
                        {historyExpenses.map(exp => {
                          const cat = EXPENSE_CATEGORIES.find(c => c.id === exp.category)
                          return (
                            <div key={exp.id} className={`${cardClass} px-5 py-4 flex items-center gap-4`}>
                              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                                <Receipt size={16} className="text-amber-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-medium truncate">{exp.description}</p>
                                <div className="flex items-center gap-2 text-slate-500 text-xs mt-1">
                                  <span>{formatDate(exp.date)}</span>
                                  <span className="w-1 h-1 rounded-full bg-slate-700" />
                                  <span>{cat?.label || exp.category}</span>
                                  {exp.receipt_url && <><span className="w-1 h-1 rounded-full bg-slate-700" /><Paperclip size={10} className="text-sky-400" /></>}
                                </div>
                              </div>
                              <span className="text-white font-semibold text-sm tabular-nums">{formatCurrency(exp.amount)}</span>
                              <StatusPill status={exp.status} />
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className={`${cardClass} text-center py-10`}>
                        <p className="text-slate-600 text-sm">No expenses for {historyRange.label}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* INVOICES */}
                {(historyFilter === 'all' || historyFilter === 'invoices') && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText size={14} className="text-sky-400" />
                      <h2 className="text-sm font-semibold text-white">Invoices</h2>
                      <span className="text-[11px] text-slate-500 ml-1">{historyInvoices.length} invoice{historyInvoices.length !== 1 ? 's' : ''}</span>
                    </div>
                    {historyInvoices.length > 0 ? (
                      <div className="space-y-2">
                        {historyInvoices.map(inv => {
                          const lines = inv.contractor_invoice_lines || inv.lines || []
                          return (
                            <div key={inv.id} className={`${cardClass} overflow-hidden`}>
                              <div className="px-5 py-4 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0">
                                  <FileText size={16} className="text-sky-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-white text-sm font-medium">{inv.invoice_number}</p>
                                    {inv.receipt_url && <Paperclip size={11} className="text-sky-400" />}
                                  </div>
                                  <p className="text-slate-500 text-xs mt-0.5">{formatDate(inv.period_start)} – {formatDate(inv.period_end)}</p>
                                </div>
                                <span className="text-white font-semibold text-sm tabular-nums">{formatCurrency(inv.total_amount)}</span>
                                <StatusPill status={inv.status} />
                              </div>
                              {lines.length > 0 && (
                                <div className="px-5 pb-4 pt-0">
                                  <div className="border-t border-slate-800/60 pt-3">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="text-[11px] text-slate-600 font-semibold uppercase tracking-wider">
                                          <th className="text-left pb-2">Description</th>
                                          <th className="text-right pb-2">Hours</th>
                                          <th className="text-right pb-2">Allocation</th>
                                          <th className="text-right pb-2">Amount</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-800/40">
                                        {lines.map((l: any, i: number) => (
                                          <tr key={i}>
                                            <td className="py-2 text-slate-400">{l.description}</td>
                                            <td className="py-2 text-right text-slate-500 tabular-nums">{l.hours ? `${Number(l.hours).toFixed(1)}h` : '—'}</td>
                                            <td className="py-2 text-right text-slate-500 tabular-nums">{l.allocation_pct ? `${l.allocation_pct}%` : '—'}</td>
                                            <td className="py-2 text-right text-slate-300 font-medium tabular-nums">{l.amount ? formatCurrency(l.amount) : '—'}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className={`${cardClass} text-center py-10`}>
                        <p className="text-slate-600 text-sm">No invoices for {historyRange.label}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Empty state when all filtered sections are empty */}
                {historyFilter === 'all' && historyTime.length === 0 && historyExpenses.length === 0 && historyInvoices.length === 0 && (
                  <div className={`${cardClass} text-center py-16`}>
                    <div className="w-14 h-14 rounded-xl bg-slate-800/40 flex items-center justify-center mx-auto mb-4">
                      <History size={24} className="text-slate-600" />
                    </div>
                    <p className="text-slate-500 text-sm">No submissions for {historyRange.label}</p>
                    <p className="text-slate-700 text-xs mt-1">Try navigating to a different month</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
