'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Clock, Receipt, FileText, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle, Loader2, Upload, X, Plus, Trash2, Calendar,
  DollarSign, Send, Eye, Building2, User, FileUp, LogOut, Paperclip, File
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
const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-amber-500/20', text: 'text-amber-400' }, submitted: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  approved: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' }, rejected: { bg: 'bg-red-500/20', text: 'text-red-400' },
  paid: { bg: 'bg-emerald-500/20', text: 'text-emerald-300' },
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
      <div className="flex items-center gap-3 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg">
        {isImage ? (
          <img src={URL.createObjectURL(file)} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-600" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
            <FileText size={18} className="text-blue-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm truncate">{file.name}</p>
          <p className="text-slate-500 text-xs">{file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(0)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}</p>
        </div>
        {uploading ? (
          <Loader2 size={16} className="text-emerald-400 animate-spin shrink-0" />
        ) : (
          <button onClick={onRemove} className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors shrink-0">
            <X size={14} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      onDragEnter={handleDragIn} onDragLeave={handleDragOut} onDragOver={handleDrag} onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative cursor-pointer rounded-lg border-2 border-dashed transition-all duration-150 ${
        dragging 
          ? 'border-emerald-500 bg-emerald-500/10' 
          : 'border-slate-700 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800'
      }`}
    >
      <div className="flex flex-col items-center justify-center py-4 px-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-colors ${dragging ? 'bg-emerald-500/20' : 'bg-slate-700/50'}`}>
          <Upload size={16} className={dragging ? 'text-emerald-400' : 'text-slate-400'} />
        </div>
        <p className={`text-sm font-medium ${dragging ? 'text-emerald-400' : 'text-slate-400'}`}>
          {dragging ? 'Drop file here' : label}
        </p>
        <p className="text-xs text-slate-600 mt-0.5">or click to browse</p>
      </div>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]) }} />
    </div>
  )
}

/** Multi-file drop zone for receipts */
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
      <div
        onDragEnter={handleDragIn} onDragLeave={handleDragOut} onDragOver={handleDrag} onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative cursor-pointer rounded-lg border-2 border-dashed transition-all duration-150 ${
          dragging ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800'
        }`}
      >
        <div className="flex flex-col items-center justify-center py-4 px-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-colors ${dragging ? 'bg-emerald-500/20' : 'bg-slate-700/50'}`}>
            <Upload size={16} className={dragging ? 'text-emerald-400' : 'text-slate-400'} />
          </div>
          <p className={`text-sm font-medium ${dragging ? 'text-emerald-400' : 'text-slate-400'}`}>
            {dragging ? 'Drop files here' : label}
          </p>
          <p className="text-xs text-slate-600 mt-0.5">PDF, JPEG, PNG — multiple files allowed</p>
        </div>
        <input ref={inputRef} type="file" accept={accept} multiple className="hidden" onChange={e => {
          if (e.target.files) {
            const added = Array.from(e.target.files).filter(f => f.type === 'application/pdf' || f.type.startsWith('image/'))
            if (added.length > 0) onAddFiles(added)
          }
          e.target.value = ''
        }} />
      </div>
      {files.length > 0 && files.map((file, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg">
          {file.type.startsWith('image/') ? (
            <img src={URL.createObjectURL(file)} alt="" className="w-8 h-8 rounded object-cover border border-slate-600" />
          ) : (
            <div className="w-8 h-8 rounded bg-rose-500/15 flex items-center justify-center shrink-0">
              <FileText size={14} className="text-rose-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs truncate">{file.name}</p>
            <p className="text-slate-500 text-xs">{file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(0)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}</p>
          </div>
          {uploading ? (
            <Loader2 size={14} className="text-emerald-400 animate-spin shrink-0" />
          ) : (
            <button onClick={(e) => { e.stopPropagation(); onRemoveFile(i) }} className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors shrink-0">
              <X size={12} />
            </button>
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
  const [activeTab, setActiveTab] = useState<'time' | 'expenses' | 'invoices'>('time')
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

  const week = useMemo(() => getWeekRange(weekDate), [weekDate])
  const billingMonth = useMemo(() => getMonthRange(invoiceMonth), [invoiceMonth])

  const assignmentsByClient = useMemo(() => {
    const grouped: Record<string, { clientName: string; projects: Assignment[] }> = {}
    assignments.forEach(a => { if (!grouped[a.client_id]) grouped[a.client_id] = { clientName: a.client_name, projects: [] }; grouped[a.client_id].projects.push(a) })
    return grouped
  }, [assignments])

  const clientCostTypes = useMemo(() => {
    const types: Record<string, { type: 'lump_sum' | 'hourly'; amount: number; source: 'rate_card' | 'member' }> = {}
    // Priority 1: rate card overrides per client
    rateCards.forEach(rc => {
      if (rc.cost_amount > 0) {
        const ct = normalizeCostType(rc.cost_type)
        types[rc.client_id] = {
          type: (ct === 'lump_sum' || ct === 'lump sum') ? 'lump_sum' : 'hourly',
          amount: rc.cost_amount,
          source: 'rate_card'
        }
      }
    })
    // Priority 2: fall back to member-level cost for unassigned clients
    const memberCt = normalizeCostType(member?.cost_type || '')
    const isMemberLS = (memberCt === 'lump_sum' || memberCt === 'lump sum') && (member?.cost_amount || 0) > 0
    Object.keys(assignmentsByClient).forEach(cid => {
      if (!types[cid]) {
        types[cid] = {
          type: isMemberLS ? 'lump_sum' : 'hourly',
          amount: member?.cost_amount || 0,
          source: 'member'
        }
      }
    })
    return types
  }, [rateCards, member, assignmentsByClient])

  // Contractor archetype: determines entire invoice UX
  // 'pure_ls' = Emily: one fixed cost, distributed across all clients by effort %
  // 'pure_tm' = Brian: hourly for all clients, submits per-client invoices
  // 'mixed'   = Mary: some clients LS, some T&M, submits per-client invoices
  const contractorType = useMemo((): 'pure_ls' | 'pure_tm' | 'mixed' => {
    const types = Object.values(clientCostTypes).map(c => c.type)
    const uniqueTypes = new Set(types)
    if (uniqueTypes.size > 1) return 'mixed'
    // All same type — but check source: if member-level LS with no rate card overrides, it's pure LS
    const allMemberSource = Object.values(clientCostTypes).every(c => c.source === 'member')
    if (types[0] === 'lump_sum' && allMemberSource) return 'pure_ls'
    if (types[0] === 'lump_sum' && !allMemberSource) return 'mixed' // rate-card LS per client = treat like mixed (separate invoices)
    return 'pure_tm'
  }, [clientCostTypes])

  // ============ EMAIL LOOKUP ============
  const lookupEmail = async () => {
    if (!email.trim()) return
    setLoading(true); setError(null)
    try {
      const { data: md, error: me } = await supabase.from('team_members').select('id, name, email, cost_type, cost_amount, company_id').eq('email', email.trim().toLowerCase()).eq('status', 'active').single()
      if (me || !md) { setError('Email not found. Contact your administrator.'); setLoading(false); return }
      const { data: rcData } = await supabase.from('bill_rates').select('team_member_id, client_id, rate, cost_type, cost_amount').eq('team_member_id', md.id).eq('is_active', true)
      const { data: clients } = await supabase.from('clients').select('id, name')
      const cMap: Record<string, string> = {}; (clients || []).forEach((c: any) => { cMap[c.id] = c.name })
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
      setStep('portal')
    } catch { setError('Something went wrong. Please try again.') } finally { setLoading(false) }
  }

  // ============ LOAD DATA ============
  useEffect(() => {
    if (!member || activeTab !== 'time') return
    const load = async () => {
      const { data } = await supabase.from('time_entries').select('project_id, hours, description, date, id').eq('contractor_id', member.id).gte('date', week.start).lte('date', week.end)
      if (data && data.length > 0) {
        const grouped: Record<string, TimeEntryForm> = {}; assignments.forEach(a => { grouped[a.project_id] = { project_id: a.project_id, hours: '', notes: '' } })
        data.forEach((e: any) => { if (grouped[e.project_id]) { grouped[e.project_id].hours = String(parseFloat(grouped[e.project_id].hours || '0') + (e.hours || 0)); if (e.description && !grouped[e.project_id].notes) grouped[e.project_id].notes = e.description } })
        setTimeEntries(grouped); setExistingEntries(data)
      } else { const init: Record<string, TimeEntryForm> = {}; assignments.forEach(a => { init[a.project_id] = { project_id: a.project_id, hours: '', notes: '' } }); setTimeEntries(init); setExistingEntries([]) }
    }; load()
  }, [member, week.start, week.end, activeTab, assignments])

  useEffect(() => { if (!member || activeTab !== 'expenses') return; supabase.from('contractor_expenses').select('*').eq('team_member_id', member.id).order('date', { ascending: false }).limit(50).then(({ data }) => setExpenses(data || [])) }, [member, activeTab])
  useEffect(() => { if (!member || activeTab !== 'invoices') return; supabase.from('contractor_invoices').select('*, contractor_invoice_lines(*)').eq('team_member_id', member.id).order('invoice_date', { ascending: false }).limit(20).then(({ data }) => setInvoices(data || [])) }, [member, activeTab])

  // ============ SUBMIT TIME ============
  const submitTime = async () => {
    if (!member) return; setSubmittingTime(true); setError(null)
    try {
      if (existingEntries.length > 0) await supabase.from('time_entries').delete().eq('contractor_id', member.id).gte('date', week.start).lte('date', week.end)
      const entries = Object.values(timeEntries).filter(e => parseFloat(e.hours || '0') > 0).map(e => {
        const a = assignments.find(x => x.project_id === e.project_id)
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
      const { error: ie } = await supabase.from('contractor_expenses').insert({ team_member_id: member.id, date: expenseForm.date, category: expenseForm.category, description: expenseForm.description, amount: parseFloat(expenseForm.amount), project_id: expenseForm.project_id || null, client_id: expenseForm.client_id || null, receipt_url: receiptUrl, status: 'pending' })
      if (ie) throw ie
      setShowExpenseForm(false); setExpenseForm({ date: new Date().toISOString().split('T')[0], category: 'travel', description: '', amount: '', project_id: '', client_id: '' }); setExpenseFiles([])
      const { data } = await supabase.from('contractor_expenses').select('*').eq('team_member_id', member.id).order('date', { ascending: false }).limit(50); setExpenses(data || [])
    } catch (err: any) { setError(err.message || 'Failed to submit expense') } finally { setSubmittingExpense(false) }
  }

  // ============ TIMESHEET REFERENCE (for cross-checking, not amount calculation) ============
  const calculateDistribution = useCallback(async () => {
    if (!member) return
    const { data: me } = await supabase.from('time_entries').select('project_id, hours').eq('contractor_id', member.id).gte('date', billingMonth.start).lte('date', billingMonth.end)
    if (!me || me.length === 0) { setInvoiceDistribution([]); return }

    const sel = invoiceForm.client_id

    // T&M and mixed must have a client selected
    if (contractorType !== 'pure_ls' && !sel) { setInvoiceDistribution([]); return }

    // Group time entries by client → project
    const byClient: Record<string, { clientName: string; projects: Record<string, { name: string; hours: number }> }> = {}
    let totalHoursAllClients = 0
    me.forEach((e: any) => {
      const a = assignments.find(x => x.project_id === e.project_id); if (!a) return
      if (!byClient[a.client_id]) byClient[a.client_id] = { clientName: a.client_name, projects: {} }
      if (!byClient[a.client_id].projects[e.project_id]) byClient[a.client_id].projects[e.project_id] = { name: a.project_name, hours: 0 }
      byClient[a.client_id].projects[e.project_id].hours += e.hours || 0
      totalHoursAllClients += e.hours || 0
    })

    const lines: InvoiceLine[] = []

    if (contractorType === 'pure_ls') {
      // EMILY: Show all clients with hours + allocation % (reference for admin)
      Object.entries(byClient).forEach(([cid, d]) => {
        const clientHours = Object.values(d.projects).reduce((s, p) => s + p.hours, 0)
        const pct = totalHoursAllClients > 0 ? (clientHours / totalHoursAllClients) * 100 : 0
        Object.entries(d.projects).forEach(([pid, proj]) => {
          const projPct = clientHours > 0 ? (proj.hours / totalHoursAllClients) * 100 : 0
          lines.push({
            client_id: cid, client_name: d.clientName,
            project_id: pid, project_name: proj.name,
            hours: proj.hours, amount: 0,
            allocation_pct: Math.round(projPct * 100) / 100
          })
        })
      })
    } else {
      // T&M / MIXED: Show selected client's projects + hours (reference)
      const selectedClient = byClient[sel]
      if (!selectedClient) { setInvoiceDistribution([]); return }
      Object.entries(selectedClient.projects).forEach(([pid, proj]) => {
        lines.push({
          client_id: sel, client_name: selectedClient.clientName,
          project_id: pid, project_name: proj.name,
          hours: proj.hours, amount: 0
        })
      })
    }
    setInvoiceDistribution(lines)
  }, [member, billingMonth, assignments, invoiceForm.client_id, contractorType])

  useEffect(() => { if (showInvoiceForm && member) calculateDistribution() }, [showInvoiceForm, billingMonth, calculateDistribution, member, invoiceForm.client_id])

  // ============ SUBMIT INVOICE ============
  const submitInvoice = async () => {
    const enteredAmount = parseFloat(invoiceForm.amount || '0')
    if (!member || enteredAmount <= 0) return; setSubmittingInvoice(true); setError(null)
    try {
      let receiptUrl: string | null = null
      if (invoiceFile) receiptUrl = await uploadFile(invoiceFile, 'invoices', member.id)
      const invDate = new Date(); const due = new Date(invDate); const dm: Record<string, number> = { DUE_ON_RECEIPT: 0, NET30: 30, NET45: 45, NET60: 60 }
      due.setDate(due.getDate() + (dm[invoiceForm.payment_terms] || 30))
      const { data: inv, error: ie } = await supabase.from('contractor_invoices').insert({
        team_member_id: member.id, invoice_number: invoiceForm.invoice_number, invoice_date: invDate.toISOString().split('T')[0],
        due_date: due.toISOString().split('T')[0], period_start: billingMonth.start, period_end: billingMonth.end,
        total_amount: enteredAmount, payment_terms: invoiceForm.payment_terms, receipt_url: receiptUrl, notes: invoiceForm.notes || null, status: 'submitted'
      }).select().single()
      if (ie) throw ie
      // Save line items with reference hours + allocation %
      // For LS: distribute entered amount by hour allocation. For T&M: just reference hours.
      const totalRefHours = invoiceDistribution.reduce((s, l) => s + (l.hours || 0), 0)
      await supabase.from('contractor_invoice_lines').insert(invoiceDistribution.map(l => {
        const pct = totalRefHours > 0 ? (l.hours || 0) / totalRefHours : 0
        return {
          invoice_id: inv.id, client_id: l.client_id, project_id: l.project_id || null,
          description: l.client_name + (l.project_name ? ` - ${l.project_name}` : ''),
          hours: l.hours || null, rate: l.rate || null,
          amount: contractorType === 'pure_ls' ? Math.round(enteredAmount * pct * 100) / 100 : enteredAmount,
          allocation_pct: contractorType === 'pure_ls' ? Math.round(pct * 100 * 100) / 100 : null
        }
      }))
      setShowInvoiceForm(false); setInvoiceForm({ invoice_number: '', payment_terms: 'NET30', notes: '', client_id: 'all', amount: '' }); setInvoiceFile(null); setInvoiceDistribution([])
      const { data: upd } = await supabase.from('contractor_invoices').select('*, contractor_invoice_lines(*)').eq('team_member_id', member.id).order('invoice_date', { ascending: false }).limit(20); setInvoices(upd || [])
    } catch (err: any) { setError(err.message || 'Failed to submit invoice') } finally { setSubmittingInvoice(false) }
  }

  // ============ DELETE INVOICE (only if still 'submitted') ============
  const deleteInvoice = async (id: string) => {
    if (!confirm('Delete this invoice? This cannot be undone.')) return
    setError(null)
    try {
      await supabase.from('contractor_invoice_lines').delete().eq('invoice_id', id)
      await supabase.from('contractor_invoices').delete().eq('id', id)
      setInvoices(prev => prev.filter(inv => inv.id !== id))
    } catch (err: any) { setError(err.message || 'Failed to delete') }
  }

  const navItems = [{ id: 'time' as const, label: 'Timesheet', icon: Clock }, { id: 'expenses' as const, label: 'Expenses', icon: Receipt }, { id: 'invoices' as const, label: 'Invoices', icon: FileText }]
  const totalTimeHours = Object.values(timeEntries).reduce((s, e) => s + parseFloat(e.hours || '0'), 0)

  // ============ EMAIL SCREEN ============
  if (step === 'email') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="relative inline-flex items-center justify-center w-16 h-16 mb-4">
              <svg width={48} height={48} viewBox="0 0 40 40" fill="none"><defs><linearGradient id="vLogo" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#10b981" /></linearGradient></defs><path d="M8 8L20 32L32 8" stroke="url(#vLogo)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
              <div className="absolute inset-0 blur-xl bg-emerald-500/20 -z-10" />
            </div>
            <h1 className="text-2xl font-bold text-white">Vantage</h1>
            <p className="text-slate-400 mt-1">Time • Expenses • Invoices</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <label className="block text-sm text-slate-400 mb-2">Enter your email to get started</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && lookupEmail()} placeholder="yourname@company.com"
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent" />
            {error && <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm"><AlertCircle size={16} /> {error}</div>}
            <button onClick={lookupEmail} disabled={loading} className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl text-white font-medium transition-colors flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={18} className="animate-spin" /> Looking up...</> : 'Continue'}
            </button>
          </div>
          <p className="text-center text-slate-600 text-xs mt-6">Powered by Vantage</p>
        </div>
      </div>
    )
  }

  // ============ PORTAL ============
  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-56'} bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-200`}>
        <div className="p-4 border-b border-slate-800">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 shrink-0 flex items-center justify-center">
                <svg width={24} height={24} viewBox="0 0 40 40" fill="none"><defs><linearGradient id="vS" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#10b981" /></linearGradient></defs><path d="M8 8L20 32L32 8" stroke="url(#vS)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
              </div>
              <div className="min-w-0"><p className="text-white text-sm font-medium truncate">{member?.name}</p><p className="text-slate-500 text-xs truncate">{member?.email}</p></div>
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="w-full flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setError(null) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeTab === item.id ? 'bg-emerald-500/15 text-emerald-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}>
              <item.icon size={18} className="shrink-0" />{!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
        <div className="p-2 border-t border-slate-800">
          <button onClick={() => { setStep('email'); setMember(null); setAssignments([]); setRateCards([]); setEmail('') }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors">
            <LogOut size={18} className="shrink-0" />{!sidebarCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
          {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400 text-sm"><AlertCircle size={16} /> {error}<button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button></div>}

          {/* ====== TIMESHEET ====== */}
          {activeTab === 'time' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div><h1 className="text-xl font-bold text-white">Timesheet</h1><p className="text-slate-400 text-sm mt-0.5">Log your weekly hours</p></div>
                {timeSuccess && <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 px-3 py-1.5 rounded-lg"><CheckCircle size={16} /> Submitted</div>}
              </div>
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => { const d = new Date(weekDate); d.setDate(d.getDate() - 7); setWeekDate(d) }} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"><ChevronLeft size={18} /></button>
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl"><Calendar size={16} className="text-emerald-400" /><span className="text-white text-sm font-medium">{week.label}</span></div>
                <button onClick={() => { const d = new Date(weekDate); d.setDate(d.getDate() + 7); setWeekDate(d) }} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"><ChevronRight size={18} /></button>
              </div>
              <div className="space-y-3">
                {Object.entries(assignmentsByClient).map(([cid, { clientName, projects }]) => {
                  const collapsed = collapsedClients.has(cid)
                  const ch = projects.reduce((s, p) => s + parseFloat(timeEntries[p.project_id]?.hours || '0'), 0)
                  return (
                    <div key={cid} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                      <button onClick={() => { const n = new Set(collapsedClients); collapsed ? n.delete(cid) : n.add(cid); setCollapsedClients(n) }}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors">
                        <div className="flex items-center gap-2"><Building2 size={16} className="text-emerald-400" /><span className="text-white font-medium text-sm">{clientName}</span><span className="text-slate-500 text-xs">({projects.length})</span></div>
                        <div className="flex items-center gap-3"><span className="text-slate-400 text-sm">{ch > 0 ? `${ch}h` : ''}</span>{collapsed ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronUp size={16} className="text-slate-500" />}</div>
                      </button>
                      {!collapsed && <div className="px-4 pb-3 space-y-2">{projects.map(p => (
                        <div key={p.project_id} className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-3 py-2.5">
                          <span className="text-slate-300 text-sm flex-1 min-w-0 truncate">{p.project_name}</span>
                          <input type="number" placeholder="0" min="0" step="0.5" value={timeEntries[p.project_id]?.hours || ''} onChange={e => setTimeEntries(prev => ({ ...prev, [p.project_id]: { ...prev[p.project_id], hours: e.target.value } }))}
                            className="w-20 px-3 py-1.5 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                          <span className="text-slate-500 text-xs w-6">hrs</span>
                        </div>
                      ))}</div>}
                    </div>
                  )
                })}
              </div>
              <div className="mt-6 bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4"><span className="text-slate-300 font-medium">Total Hours</span><span className={`text-xl font-bold ${totalTimeHours > 0 ? 'text-white' : 'text-slate-600'}`}>{totalTimeHours}</span></div>
                <button onClick={submitTime} disabled={submittingTime || totalTimeHours === 0} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-xl text-white font-medium transition-colors flex items-center justify-center gap-2">
                  {submittingTime ? <><Loader2 size={18} className="animate-spin" /> Submitting...</> : <><Send size={18} /> Submit Timesheet</>}
                </button>
              </div>
            </div>
          )}

          {/* ====== EXPENSES ====== */}
          {activeTab === 'expenses' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div><h1 className="text-xl font-bold text-white">Expenses</h1><p className="text-slate-400 text-sm mt-0.5">Submit and track expense reports</p></div>
                <button onClick={() => setShowExpenseForm(true)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white text-sm font-medium flex items-center gap-2"><Plus size={16} /> New Expense</button>
              </div>
              {showExpenseForm && (
                <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-5 mb-6">
                  <div className="flex items-center justify-between mb-4"><h2 className="text-white font-medium">New Expense</h2><button onClick={() => { setShowExpenseForm(false); setExpenseFiles([]) }} className="text-slate-400 hover:text-white"><X size={18} /></button></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs text-slate-400 mb-1">Date</label><input type="date" value={expenseForm.date} onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                    <div><label className="block text-xs text-slate-400 mb-1">Category</label><select value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">{EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
                    <div><label className="block text-xs text-slate-400 mb-1">Amount</label><input type="number" placeholder="0.00" step="0.01" min="0" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                    <div><label className="block text-xs text-slate-400 mb-1">Client</label><select value={expenseForm.client_id} onChange={e => setExpenseForm(p => ({ ...p, client_id: e.target.value, project_id: '' }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"><option value="">Select client</option>{Object.entries(assignmentsByClient).map(([cid, { clientName }]) => <option key={cid} value={cid}>{clientName}</option>)}</select></div>
                    <div className="col-span-2"><label className="block text-xs text-slate-400 mb-1">Description</label><input type="text" placeholder="What was this expense for?" value={expenseForm.description} onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                    <div className="col-span-2">
                      <label className="block text-xs text-slate-400 mb-1">Receipts / Documents</label>
                      <MultiDropZone files={expenseFiles} onAddFiles={(newFiles) => setExpenseFiles(prev => [...prev, ...newFiles])} onRemoveFile={(i) => setExpenseFiles(prev => prev.filter((_, idx) => idx !== i))} uploading={submittingExpense} label="Drop receipts here" accept="image/*,.pdf" />
                    </div>
                  </div>
                  <button onClick={submitExpense} disabled={submittingExpense || !expenseForm.description || !expenseForm.amount} className="w-full mt-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2">
                    {submittingExpense ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : <><Send size={16} /> Submit Expense</>}
                  </button>
                </div>
              )}
              {expenses.length > 0 ? <div className="space-y-2">{expenses.map(exp => {
                const cat = EXPENSE_CATEGORIES.find(c => c.id === exp.category); const st = STATUS_STYLES[exp.status] || STATUS_STYLES.pending
                return (
                  <div key={exp.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0"><Receipt size={14} className="text-slate-400" /></div>
                    <div className="flex-1 min-w-0"><p className="text-white text-sm font-medium truncate">{exp.description}</p><div className="flex items-center gap-2 text-slate-500 text-xs"><span>{formatDate(exp.date)}</span><span>·</span><span>{cat?.label || exp.category}</span>{exp.receipt_url && <><span>·</span><Paperclip size={10} className="text-blue-400" /></>}</div></div>
                    <span className="text-white font-medium text-sm">{formatCurrency(exp.amount)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>{exp.status}</span>
                  </div>
                )
              })}</div> : <div className="text-center py-12 text-slate-500"><Receipt size={32} className="mx-auto mb-3 opacity-40" /><p className="text-sm">No expenses submitted yet</p></div>}
            </div>
          )}

          {/* ====== INVOICES ====== */}
          {activeTab === 'invoices' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div><h1 className="text-xl font-bold text-white">Invoices</h1><p className="text-slate-400 text-sm mt-0.5">Submit monthly invoices</p></div>
                <button onClick={() => { 
                  // Pure LS: always 'all'. T&M/Mixed: force client selection (empty = must pick)
                  const defaultClient = contractorType === 'pure_ls' ? 'all' : ''
                  setInvoiceForm(p => ({ ...p, client_id: defaultClient }))
                  setShowInvoiceForm(true) 
                }} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white text-sm font-medium flex items-center gap-2"><Plus size={16} /> New Invoice</button>
              </div>
              {showInvoiceForm && (
                <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-5 mb-6">
                  <div className="flex items-center justify-between mb-4"><h2 className="text-white font-medium">Submit Invoice</h2><button onClick={() => { setShowInvoiceForm(false); setInvoiceFile(null) }} className="text-slate-400 hover:text-white"><X size={18} /></button></div>
                  
                  {/* Row 1: Invoice number + client */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div><label className="block text-xs text-slate-400 mb-1">Invoice Number</label><input type="text" placeholder="INV-2026-001" value={invoiceForm.invoice_number} onChange={e => setInvoiceForm(p => ({ ...p, invoice_number: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" /></div>
                    {contractorType === 'pure_ls' ? (
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Invoice For</label>
                        <div className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-slate-300 text-sm">All Clients (distributed by effort)</div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Invoice For</label>
                        <select value={invoiceForm.client_id} onChange={e => setInvoiceForm(p => ({ ...p, client_id: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                          <option value="">Select a client</option>
                          {Object.entries(assignmentsByClient).map(([cid, { clientName }]) => <option key={cid} value={cid}>{clientName}</option>)}
                        </select>
                        {contractorType === 'mixed' && <p className="text-xs text-slate-500 mt-1">Submit a separate invoice for each client.</p>}
                      </div>
                    )}
                  </div>

                  {/* Row 2: Billing period + Amount */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Billing Period</label>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { const d = new Date(invoiceMonth); d.setMonth(d.getMonth() - 1); setInvoiceMonth(d) }} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"><ChevronLeft size={14} /></button>
                        <span className="text-white text-sm font-medium px-3 py-1.5 bg-slate-800 rounded-lg flex-1 text-center">{billingMonth.label}</span>
                        <button onClick={() => { const d = new Date(invoiceMonth); d.setMonth(d.getMonth() + 1); setInvoiceMonth(d) }} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"><ChevronRight size={14} /></button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Invoice Amount</label>
                      <div className="relative">
                        <DollarSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input type="number" placeholder="0.00" step="0.01" min="0" value={invoiceForm.amount} onChange={e => setInvoiceForm(p => ({ ...p, amount: e.target.value }))}
                          className="w-full pl-8 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                    </div>
                  </div>

                  {/* Timesheet reference */}
                  {invoiceDistribution.length > 0 ? (
                    <div className="mb-4">
                      <p className="text-xs text-slate-500 mb-2">Timesheet reference for {billingMonth.label}:</p>
                      <div className="bg-slate-800/30 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead><tr className="text-slate-600 text-xs">
                            <th className="text-left px-3 py-1.5 font-medium">Client</th>
                            {invoiceDistribution.some(l => l.project_name) && <th className="text-left px-3 py-1.5 font-medium">Project</th>}
                            <th className="text-right px-3 py-1.5 font-medium">Hours</th>
                            {invoiceDistribution.some(l => l.allocation_pct !== undefined) && <th className="text-right px-3 py-1.5 font-medium">%</th>}
                          </tr></thead>
                          <tbody>{invoiceDistribution.map((l, i) => (
                            <tr key={i} className="border-t border-slate-700/30">
                              <td className="px-3 py-1.5 text-slate-400 text-xs">{l.client_name}</td>
                              {invoiceDistribution.some(x => x.project_name) && <td className="px-3 py-1.5 text-slate-500 text-xs">{l.project_name || '—'}</td>}
                              <td className="px-3 py-1.5 text-right text-slate-300 text-xs">{l.hours?.toFixed(1)}</td>
                              {invoiceDistribution.some(x => x.allocation_pct !== undefined) && <td className="px-3 py-1.5 text-right text-slate-500 text-xs">{l.allocation_pct !== undefined ? `${l.allocation_pct}%` : '—'}</td>}
                            </tr>
                          ))}</tbody>
                          <tfoot><tr className="border-t border-slate-600/50">
                            <td colSpan={invoiceDistribution.some(l => l.project_name) ? 2 : 1} className="px-3 py-1.5 text-slate-400 text-xs font-medium">Total</td>
                            <td className="px-3 py-1.5 text-right text-white text-xs font-medium">{invoiceDistribution.reduce((s, l) => s + (l.hours || 0), 0).toFixed(1)}h</td>
                            {invoiceDistribution.some(l => l.allocation_pct !== undefined) && <td className="px-3 py-1.5 text-right text-slate-400 text-xs">100%</td>}
                          </tr></tfoot>
                        </table>
                      </div>
                    </div>
                  ) : (contractorType !== 'pure_ls' && !invoiceForm.client_id) ? (
                    <div className="mb-4 p-3 bg-slate-800/30 rounded-lg text-center text-slate-500 text-sm">Select a client above to see your timesheet hours.</div>
                  ) : null}

                  {/* File + Notes */}
                  <div className="mb-4">
                    <label className="block text-xs text-slate-400 mb-1">Invoice Attachment (PDF)</label>
                    <DropZone file={invoiceFile} onFile={setInvoiceFile} onRemove={() => setInvoiceFile(null)} uploading={submittingInvoice} label="Drop invoice PDF here" accept=".pdf,image/*" />
                  </div>
                  <div className="mb-4"><label className="block text-xs text-slate-400 mb-1">Notes (optional)</label><textarea rows={2} placeholder="Any additional notes..." value={invoiceForm.notes} onChange={e => setInvoiceForm(p => ({ ...p, notes: e.target.value }))} className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" /></div>
                  <button onClick={submitInvoice} disabled={submittingInvoice || !invoiceForm.invoice_number || parseFloat(invoiceForm.amount || '0') <= 0 || (contractorType !== 'pure_ls' && !invoiceForm.client_id)} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 rounded-xl text-white text-sm font-medium flex items-center justify-center gap-2">
                    {submittingInvoice ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : <><Send size={16} /> Submit Invoice</>}
                  </button>
                </div>
              )}
              {/* History */}
              {invoices.length > 0 ? <div className="space-y-2">{invoices.map(inv => {
                const st = STATUS_STYLES[inv.status] || STATUS_STYLES.submitted; const lines = inv.contractor_invoice_lines || inv.lines || []
                return (
                  <div key={inv.id} className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-500/15 rounded-lg flex items-center justify-center shrink-0"><FileText size={16} className="text-blue-400" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2"><p className="text-white text-sm font-medium">{inv.invoice_number}</p>{inv.receipt_url && <Paperclip size={12} className="text-blue-400" />}</div>
                        <p className="text-slate-500 text-xs">{formatDate(inv.period_start)} – {formatDate(inv.period_end)}</p>
                      </div>
                      <span className="text-white font-medium text-sm">{formatCurrency(inv.total_amount)}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.text}`}>{inv.status}</span>
                      {inv.status === 'submitted' && (
                        <button onClick={() => deleteInvoice(inv.id)} className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-slate-800 transition-colors" title="Delete"><Trash2 size={14} /></button>
                      )}
                    </div>
                    {lines.length > 0 && <div className="mt-2 pt-2 border-t border-slate-800 space-y-1">{lines.map((l: any, i: number) => <div key={i} className="flex items-center justify-between text-xs"><span className="text-slate-400">{l.description}</span><span className="text-slate-300">{l.hours ? `${l.hours}h` : ''}{l.allocation_pct ? ` · ${l.allocation_pct}%` : ''}</span></div>)}</div>}
                  </div>
                )
              })}</div> : <div className="text-center py-12 text-slate-500"><FileText size={32} className="mx-auto mb-3 opacity-40" /><p className="text-sm">No invoices submitted yet</p></div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
