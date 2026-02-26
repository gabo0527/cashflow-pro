'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  Clock, Receipt, FileText, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle, Loader2, Upload, X, Plus, Trash2, Calendar,
  DollarSign, Send, Eye, Building2, User, FileUp, LogOut, Paperclip, File,
  ArrowRight, CircleDot, Briefcase, Timer, CreditCard, Hash, History,
  LayoutDashboard, TrendingUp, Menu
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

// Force light color scheme on all form elements
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    *, input, select, textarea { color-scheme: light !important; }
    input[type="number"]::-webkit-outer-spin-button,
    input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    input[type="number"] { -moz-appearance: textfield; }
    input[type="date"]::-webkit-calendar-picker-indicator { filter: none; }
  `
  document.head.appendChild(style)
}

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

// Client color assignment
const CLIENT_COLORS = ['#f59e0b', '#10b981', '#6366f1', '#0ea5e9', '#f43f5e', '#8b5cf6']
const getClientColor = (index: number) => CLIENT_COLORS[index % CLIENT_COLORS.length]

// ============ STATUS CONFIG (light theme) ============
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; dot: string }> = {
  pending:   { label: 'Pending',   color: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-amber-200', dot: 'bg-amber-500' },
  submitted: { label: 'Submitted', color: 'text-sky-600',     bg: 'bg-sky-50',     border: 'border-sky-200', dot: 'bg-sky-500' },
  approved:  { label: 'Approved',  color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  rejected:  { label: 'Rejected',  color: 'text-rose-600',    bg: 'bg-rose-50',    border: 'border-rose-200', dot: 'bg-rose-500' },
  paid:      { label: 'Paid',      color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-600' },
}

// ============ DESIGN TOKENS (light theme) ============
const T = {
  card: "bg-white border border-gray-200 rounded-xl shadow-sm",
  cardHover: "bg-white border border-gray-200 rounded-xl shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md",
  input: "w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all duration-200",
  select: "w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all duration-200 cursor-pointer appearance-none",
  label: "block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2",
  btnPrimary: "px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm shadow-emerald-500/20",
  btnGhost: "px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200",
  sectionTitle: "text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400",
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

// ============ STATUS PILL ============
function StatusPill({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${config.bg} ${config.border} ${config.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
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
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg group">
        {isImage ? (
          <img src={URL.createObjectURL(file)} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-200" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
            <FileText size={16} className="text-rose-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-gray-900 text-sm font-medium truncate">{file.name}</p>
          <p className="text-gray-400 text-xs tabular-nums">{file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(0)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}</p>
        </div>
        {uploading ? <Loader2 size={16} className="text-emerald-500 animate-spin shrink-0" /> : (
          <button onClick={onRemove} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-all duration-200 shrink-0 opacity-0 group-hover:opacity-100"><X size={14} /></button>
        )}
      </div>
    )
  }

  return (
    <div onDragEnter={handleDragIn} onDragLeave={handleDragOut} onDragOver={handleDrag} onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-300 group ${
        dragging ? 'border-emerald-400 bg-emerald-50/50 scale-[1.01]' : 'border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50'
      }`}>
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-all duration-300 ${dragging ? 'bg-emerald-100 scale-110' : 'bg-gray-100 group-hover:bg-gray-200'}`}>
          <Upload size={18} className={`transition-colors duration-200 ${dragging ? 'text-emerald-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
        </div>
        <p className={`text-sm font-medium transition-colors duration-200 ${dragging ? 'text-emerald-600' : 'text-gray-500'}`}>{dragging ? 'Drop file here' : label}</p>
        <p className="text-[11px] text-gray-400 mt-1.5">or click to browse</p>
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
        className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-300 group ${
          dragging ? 'border-emerald-400 bg-emerald-50/50 scale-[1.01]' : 'border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50'
        }`}>
        <div className="flex flex-col items-center justify-center py-6 px-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-all duration-300 ${dragging ? 'bg-emerald-100 scale-110' : 'bg-gray-100 group-hover:bg-gray-200'}`}>
            <Upload size={18} className={`transition-colors duration-200 ${dragging ? 'text-emerald-500' : 'text-gray-400 group-hover:text-gray-500'}`} />
          </div>
          <p className={`text-sm font-medium transition-colors duration-200 ${dragging ? 'text-emerald-600' : 'text-gray-500'}`}>{dragging ? 'Drop files here' : label}</p>
          <p className="text-[11px] text-gray-400 mt-1.5">PDF, JPEG, PNG — multiple files</p>
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
        <div key={i} className="flex items-center gap-3 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg group">
          {file.type.startsWith('image/') ? (
            <img src={URL.createObjectURL(file)} alt="" className="w-8 h-8 rounded-lg object-cover border border-gray-200" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
              <FileText size={14} className="text-rose-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-gray-900 text-xs font-medium truncate">{file.name}</p>
            <p className="text-gray-400 text-[11px] tabular-nums">{file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(0)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}</p>
          </div>
          {uploading ? <Loader2 size={14} className="text-emerald-500 animate-spin shrink-0" /> : (
            <button onClick={(e) => { e.stopPropagation(); onRemoveFile(i) }} className="p-1 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-all duration-200 shrink-0 opacity-0 group-hover:opacity-100"><X size={12} /></button>
          )}
        </div>
      ))}
    </div>
  )
}

// ============ WEEK NAVIGATOR ============
function WeekNav({ week, onPrev, onNext }: { week: { label: string }; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="inline-flex items-center gap-0 bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <button onClick={onPrev} className="p-2.5 text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-all duration-200 border-r border-gray-200">
        <ChevronLeft size={15} />
      </button>
      <div className="flex items-center gap-2.5 px-5 py-2">
        <Calendar size={13} className="text-emerald-500" />
        <span className="text-sm font-semibold text-gray-900 tracking-tight">{week.label}</span>
      </div>
      <button onClick={onNext} className="p-2.5 text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-all duration-200 border-l border-gray-200">
        <ChevronRight size={15} />
      </button>
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

  // Build stable color map for clients
  const clientColorMap = useMemo(() => {
    const map: Record<string, string> = {}
    Object.keys(assignmentsByClient).forEach((cid, i) => { map[cid] = getClientColor(i) })
    return map
  }, [assignmentsByClient])

  const contractorType = useMemo(() => {
    const types: Record<string, { costType: string; costAmount: number }> = {}
    rateCards.forEach(rc => {
      types[rc.client_id] = { costType: normalizeCostType(rc.cost_type), costAmount: rc.cost_amount || 0 }
    })
    const clients = Object.values(types)
    const hasRateCardCosts = clients.some(c => c.costAmount > 0)
    
    if (hasRateCardCosts) {
      const allLS = clients.every(c => c.costType === 'lump_sum' || c.costType === 'monthly')
      const allTM = clients.every(c => c.costType === 'hourly' || c.costType === 'tm')
      if (allLS) return 'pure_ls'
      if (allTM) return 'tm'
      return 'mixed'
    }
    
    if (member) {
      const memberCostType = normalizeCostType(member.cost_type || '')
      const isFixedMember = (memberCostType === 'lump_sum' || memberCostType === 'lumpsum' || memberCostType === 'fixed' || memberCostType === 'monthly') && (member.cost_amount || 0) > 0
      if (isFixedMember) return 'pure_ls'
    }
    
    if (clients.length === 0) return 'tm'
    const allLS = clients.every(c => c.costType === 'lump_sum' || c.costType === 'monthly')
    const allTM = clients.every(c => c.costType === 'hourly' || c.costType === 'tm')
    if (allLS) return 'pure_ls'
    if (allTM) return 'tm'
    return 'mixed'
  }, [rateCards, member])

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

      const ratesByClient: Record<string, { rate: number; cost_type: string }> = {}
      ;(rcData || []).forEach((r: any) => { ratesByClient[r.client_id] = { rate: r.rate || 0, cost_type: r.cost_type || 'hourly' } })

      const { data: pa } = await supabase.from('team_project_assignments').select('project_id, payment_type, rate, bill_rate').eq('team_member_id', md.id)
      const { data: projects } = await supabase.from('projects').select('id, name, client_id, company_id').eq('status', 'active')
      const pMap: Record<string, any> = {}; (projects || []).forEach((p: any) => { pMap[p.id] = p })

      let assigns: Assignment[]
      if (pa && pa.length > 0) {
        assigns = pa.map((a: any) => {
          const p = pMap[a.project_id]
          const clientRate = p?.client_id ? ratesByClient[p.client_id] : null
          return {
            project_id: a.project_id, project_name: p?.name || 'Unknown',
            client_id: p?.client_id || '', client_name: p?.client_id ? cMap[p.client_id] || '' : '',
            payment_type: clientRate?.cost_type === 'hourly' ? 'tm' : (a.payment_type || 'tm'),
            rate: clientRate?.rate || a.bill_rate || a.rate || 0
          }
        }).filter((a: Assignment) => a.project_name !== 'Unknown')
      } else {
        assigns = (projects || [])
          .filter((p: any) => ratesByClient[p.client_id])
          .map((p: any) => ({
            project_id: p.id, project_name: p.name, client_id: p.client_id,
            client_name: cMap[p.client_id] || '',
            payment_type: ratesByClient[p.client_id].cost_type === 'hourly' ? 'tm' : 'lump_sum',
            rate: ratesByClient[p.client_id].rate
          }))
      }

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
        const { data: timeData } = await supabase.from('time_entries').select('id, project_id, hours, billable_hours, description, date, created_at').eq('contractor_id', member.id).gte('date', historyRange.start).lte('date', historyRange.end).order('date', { ascending: false })
        const { data: expData } = await supabase.from('contractor_expenses').select('*').eq('team_member_id', member.id).gte('date', historyRange.start).lte('date', historyRange.end).order('date', { ascending: false })
        const { data: invData } = await supabase.from('contractor_invoices').select('*, contractor_invoice_lines(*)').eq('team_member_id', member.id).lte('period_start', historyRange.end).gte('period_end', historyRange.start).order('invoice_date', { ascending: false })
        setHistoryTime(timeData || []); setHistoryExpenses(expData || []); setHistoryInvoices(invData || [])
      } catch (err) { console.error('History load error:', err) }
      finally { setHistoryLoading(false) }
    }
    load()
  }, [member, activeTab, historyRange.start, historyRange.end])

  const historyTotals = useMemo(() => {
    const totalHours = historyTime.reduce((s: number, e: any) => s + (e.hours || 0), 0)
    const totalExpenses = historyExpenses.reduce((s, e) => s + (e.amount || 0), 0)
    const totalInvoiced = historyInvoices.reduce((s, inv) => s + (inv.total_amount || 0), 0)
    return { totalHours, totalExpenses, totalInvoiced }
  }, [historyTime, historyExpenses, historyInvoices])

  const historyTimeByWeek = useMemo(() => {
    const weeks: Record<string, { label: string; entries: any[]; totalHours: number }> = {}
    historyTime.forEach((e: any) => {
      const d = new Date(e.date + 'T00:00:00'); const day = d.getDay()
      const weekStart = new Date(d); weekStart.setDate(d.getDate() - day)
      const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
      const key = weekStart.toISOString().split('T')[0]
      if (!weeks[key]) {
        weeks[key] = { label: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, entries: [], totalHours: 0 }
      }
      weeks[key].entries.push(e); weeks[key].totalHours += e.hours || 0
    })
    return Object.entries(weeks).sort(([a], [b]) => b.localeCompare(a))
  }, [historyTime])

  const navItems = [
    { id: 'time' as const, label: 'Timesheet', icon: Timer },
    { id: 'expenses' as const, label: 'Expenses', icon: CreditCard },
    { id: 'invoices' as const, label: 'Invoices', icon: FileText },
    { id: 'history' as const, label: 'History', icon: History }
  ]
  const totalTimeHours = Object.values(timeEntries).reduce((s, e) => s + parseFloat(e.hours || '0'), 0)

  // ============ LOGIN SCREEN ============
  if (step === 'email') {
    return (
      <div className="min-h-screen bg-[#f4f5f7] flex items-center justify-center p-4">
        <div className="w-full max-w-[380px]">
          {/* Logo */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-50 rounded-2xl border border-emerald-100 mb-5">
              <svg width={30} height={30} viewBox="0 0 40 40" fill="none">
                <path d="M8 8L20 32L32 8" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Vantage</h1>
            <p className="text-gray-400 text-sm mt-1.5 tracking-wide">Contractor Portal</p>
          </div>

          <div className={`${T.card} p-7`}>
            <label className={T.label}>Email address</label>
            <input 
              type="email" value={email} onChange={e => setEmail(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && lookupEmail()} 
              placeholder="you@company.com"
              className={`${T.input} mb-5`} 
            />
            {error && (
              <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2.5 text-rose-600 text-sm">
                <AlertCircle size={15} className="shrink-0" /> {error}
              </div>
            )}
            <button onClick={lookupEmail} disabled={loading} className={`w-full ${T.btnPrimary} py-3`}>
              {loading ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : <>Sign In <ArrowRight size={15} /></>}
            </button>
          </div>

          <p className="text-center text-gray-300 text-[10px] mt-10 tracking-[0.12em] uppercase font-medium">Powered by Vantage</p>
        </div>
      </div>
    )
  }

  // ============ PORTAL ============
  return (
    <div className="min-h-screen bg-[#f4f5f7] text-gray-900">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-[56px]">
            {/* Logo + Name */}
            <div className="flex items-center gap-3">
              <svg width={20} height={20} viewBox="0 0 40 40" fill="none">
                <path d="M8 8L20 32L32 8" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              <div className="h-4 w-px bg-gray-200" />
              <span className="text-[13px] font-medium text-gray-500">{member?.name}</span>
            </div>

            {/* Nav Tabs — scrollable on mobile */}
            <nav className="flex items-center overflow-x-auto">
              {navItems.map(item => (
                <button key={item.id} onClick={() => { setActiveTab(item.id); setError(null) }}
                  className={`relative flex items-center gap-1.5 px-3 sm:px-4 h-[56px] text-[13px] font-medium transition-all duration-200 whitespace-nowrap ${
                    activeTab === item.id 
                      ? 'text-gray-900' 
                      : 'text-gray-400 hover:text-gray-600'
                  }`}>
                  <item.icon size={14} className={activeTab === item.id ? 'text-emerald-500' : ''} />
                  <span className="hidden sm:inline">{item.label}</span>
                  {activeTab === item.id && (
                    <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-emerald-500 rounded-full" />
                  )}
                </button>
              ))}
            </nav>

            {/* Sign out */}
            <button onClick={() => { setStep('email'); setMember(null); setAssignments([]); setRateCards([]); setEmail('') }}
              className="flex items-center gap-2 p-2 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-all duration-200">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-600 text-sm">
            <AlertCircle size={16} className="shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-lg transition-colors"><X size={14} /></button>
          </div>
        )}

        {/* ====== TIMESHEET ====== */}
        {activeTab === 'time' && (
          <div className="space-y-4">
            {/* Week Nav + Total */}
            <div className={`${T.card} p-4 sm:p-5`}>
              <div className="flex items-center justify-between">
                <WeekNav week={week}
                  onPrev={() => { const d = new Date(weekDate); d.setDate(d.getDate() - 7); setWeekDate(d) }}
                  onNext={() => { const d = new Date(weekDate); d.setDate(d.getDate() + 7); setWeekDate(d) }}
                />
                <div className="text-right">
                  <div className={`text-3xl font-extrabold tabular-nums tracking-tight leading-none ${totalTimeHours > 0 ? 'text-gray-900' : 'text-gray-300'}`}>{totalTimeHours.toFixed(1)}</div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-gray-400 mt-1">total hours</div>
                </div>
              </div>
              {timeSuccess && (
                <div className="flex items-center gap-2 text-emerald-600 text-sm bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-lg mt-4">
                  <CheckCircle size={15} /> Submitted successfully
                </div>
              )}
            </div>

            {/* Client Sections */}
            <div className="space-y-4">
              {Object.entries(assignmentsByClient).map(([cid, { clientName, projects }], clientIndex) => {
                const collapsed = collapsedClients.has(cid)
                const clientHours = projects.reduce((s, p) => s + parseFloat(timeEntries[p.project_id]?.hours || '0'), 0)
                const color = clientColorMap[cid] || '#6b7280'
                return (
                  <div key={cid}>
                    {/* Client divider — lightweight text with dot */}
                    <button onClick={() => { const n = new Set(collapsedClients); collapsed ? n.delete(cid) : n.add(cid); setCollapsedClients(n) }}
                      className="w-full flex items-center gap-2.5 px-1 py-2 group cursor-pointer hover:bg-gray-100/50 rounded-lg transition-colors">
                      <div className="w-[6px] h-[6px] rounded-sm shrink-0" style={{ background: color }} />
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400">{clientName}</span>
                      <span className="text-[10px] text-gray-300">({projects.length})</span>
                      <div className="flex-1 h-px bg-gray-100" />
                      <span className={`text-[11px] font-bold tabular-nums ${clientHours > 0 ? 'text-gray-700' : 'text-gray-300'}`}>{clientHours.toFixed(1)}h</span>
                      <ChevronDown size={12} className={`text-gray-300 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`} />
                    </button>

                    {!collapsed && (
                      <div className="rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm" style={{ borderLeft: `3px solid ${color}` }}>
                        {projects.map((p, i) => {
                          const hasHours = parseFloat(timeEntries[p.project_id]?.hours || '0') > 0
                          return (
                            <div key={p.project_id} className={i < projects.length - 1 ? 'border-b border-gray-100' : ''}>
                              <div className="flex items-center px-4 sm:px-5 h-[48px] sm:h-[52px]">
                                <span className={`flex-1 text-[13px] truncate ${hasHours ? 'text-gray-900 font-semibold' : 'text-gray-400'}`}>{p.project_name}</span>
                                <div className="flex items-center gap-1.5">
                                  <input type="text" inputMode="decimal" placeholder="—"
                                    value={timeEntries[p.project_id]?.hours || ''} 
                                    onChange={e => { const v = e.target.value; if (v === '' || /^\d*\.?\d*$/.test(v)) setTimeEntries(prev => ({ ...prev, [p.project_id]: { ...prev[p.project_id], hours: v } })) }}
                                    className="w-[50px] py-1 bg-transparent border-b-2 border-gray-200 text-gray-900 text-[15px] font-bold text-right tabular-nums focus:outline-none focus:border-emerald-500 transition-colors placeholder-gray-300" />
                                  <span className="text-gray-300 text-[10px] font-semibold w-4">h</span>
                                </div>
                              </div>
                              {/* Contextual description — appears when hours entered or field has content */}
                              {(hasHours || timeEntries[p.project_id]?.notes) && (
                                <div className="px-4 sm:px-5 pb-3">
                                  <input type="text" placeholder="What did you work on?" 
                                    value={timeEntries[p.project_id]?.notes || ''} 
                                    onChange={e => setTimeEntries(prev => ({ ...prev, [p.project_id]: { ...prev[p.project_id], notes: e.target.value } }))}
                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-600 text-xs placeholder-gray-300 focus:outline-none focus:border-emerald-300 transition-all" style={{ colorScheme: 'light' }} />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Submit */}
            <button onClick={submitTime} disabled={submittingTime || totalTimeHours === 0} className={`w-full ${T.btnPrimary} py-3.5 rounded-xl text-[15px]`}>
              {submittingTime ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : <><Send size={16} /> Submit Timesheet</>}
            </button>
          </div>
        )}

        {/* ====== EXPENSES ====== */}
        {activeTab === 'expenses' && (
          <div className="space-y-4">
            {/* New Expense Button */}
            {!showExpenseForm && (
              <button onClick={() => setShowExpenseForm(true)} className="w-full py-3 border-2 border-dashed border-emerald-200 rounded-xl text-emerald-600 text-sm font-semibold hover:bg-emerald-50/50 hover:border-emerald-300 transition-all duration-200">
                <Plus size={14} className="inline mr-1.5" /> New Expense
              </button>
            )}

            {/* New Expense Form */}
            {showExpenseForm && (
              <div className={`${T.card} p-5 sm:p-6 border-emerald-200`}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-gray-900 font-bold text-sm">New Expense</h2>
                  <button onClick={() => { setShowExpenseForm(false); setExpenseFiles([]) }} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200"><X size={16} /></button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={T.label}>Date</label>
                    <input type="date" value={expenseForm.date} onChange={e => setExpenseForm(p => ({ ...p, date: e.target.value }))} className={T.input} />
                  </div>
                  <div>
                    <label className={T.label}>Category</label>
                    <select value={expenseForm.category} onChange={e => setExpenseForm(p => ({ ...p, category: e.target.value }))} className={T.select}>
                      {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={T.label}>Amount</label>
                    <div className="relative">
                      <DollarSign size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="number" placeholder="0.00" step="0.01" min="0" value={expenseForm.amount} onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))} className={`${T.input} pl-9 tabular-nums`} />
                    </div>
                  </div>
                  <div>
                    <label className={T.label}>Client</label>
                    <select value={expenseForm.client_id} onChange={e => setExpenseForm(p => ({ ...p, client_id: e.target.value, project_id: '' }))} className={T.select}>
                      <option value="">No client (general)</option>
                      {Object.entries(assignmentsByClient).map(([cid, { clientName }]) => <option key={cid} value={cid}>{clientName}</option>)}
                    </select>
                  </div>

                  {expenseForm.client_id && (() => {
                    const cName = assignmentsByClient[expenseForm.client_id]?.clientName || ''
                    const isInternal = cName.toLowerCase().includes('mano') || cName.toLowerCase().includes('internal') || cName.toLowerCase().includes('overhead')
                    return (
                      <div className={`col-span-2 flex items-center gap-2.5 px-4 py-3 rounded-xl border ${isInternal ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                        <div className={`w-2 h-2 rounded-full ${isInternal ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        <span className={`text-xs font-semibold ${isInternal ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {isInternal ? 'Overhead — company operating expense' : 'Billable — billed to client at cost'}
                        </span>
                      </div>
                    )
                  })()}

                  <div className="col-span-2">
                    <label className={T.label}>Description</label>
                    <input type="text" placeholder="What was this expense for?" value={expenseForm.description} onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))} className={T.input} />
                  </div>
                  <div className="col-span-2">
                    <label className={T.label}>Receipts / Documents</label>
                    <MultiDropZone files={expenseFiles} onAddFiles={(f) => setExpenseFiles(prev => [...prev, ...f])} onRemoveFile={(i) => setExpenseFiles(prev => prev.filter((_, idx) => idx !== i))} uploading={submittingExpense} label="Drop receipts here" accept="image/*,.pdf" />
                  </div>
                </div>
                <button onClick={submitExpense} disabled={submittingExpense || !expenseForm.description || !expenseForm.amount} className={`w-full mt-5 ${T.btnPrimary} py-3`}>
                  {submittingExpense ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : <><Send size={16} /> Submit Expense</>}
                </button>
              </div>
            )}

            {/* Expense List */}
            {expenses.length > 0 ? (
              <div className="space-y-2">
                {expenses.map(exp => {
                  const cat = EXPENSE_CATEGORIES.find(c => c.id === exp.category)
                  return (
                    <div key={exp.id} className={`${T.cardHover} px-4 sm:px-5 py-4 flex items-center gap-3 sm:gap-4`}>
                      <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                        <Receipt size={15} className="text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 text-sm font-medium truncate">{exp.description}</p>
                        <div className="flex items-center gap-2 text-gray-400 text-xs mt-1">
                          <span>{formatDate(exp.date)}</span>
                          <span className="w-0.5 h-0.5 rounded-full bg-gray-300" />
                          <span>{cat?.label || exp.category}</span>
                          {exp.receipt_url && <><span className="w-0.5 h-0.5 rounded-full bg-gray-300" /><Paperclip size={10} className="text-sky-500" /></>}
                        </div>
                      </div>
                      <span className="text-gray-900 font-semibold text-sm tabular-nums">{formatCurrency(exp.amount)}</span>
                      <StatusPill status={exp.status} />
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={`${T.card} text-center py-16`}>
                <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Receipt size={22} className="text-gray-300" />
                </div>
                <p className="text-gray-500 text-sm font-medium">No expenses yet</p>
                <p className="text-gray-400 text-xs mt-1.5">Click "New Expense" to submit your first report</p>
              </div>
            )}
          </div>
        )}

        {/* ====== INVOICES ====== */}
        {activeTab === 'invoices' && (
          <div className="space-y-4">
            {/* New Invoice Button */}
            {!showInvoiceForm && (
              <button onClick={() => { 
                const defaultClient = contractorType === 'pure_ls' ? 'all' : ''
                const defaultAmount = contractorType === 'pure_ls' && member?.cost_amount ? String(member.cost_amount) : ''
                setInvoiceForm(p => ({ ...p, client_id: defaultClient, amount: defaultAmount }))
                setShowInvoiceForm(true) 
              }} className="w-full py-3 border-2 border-dashed border-sky-200 rounded-xl text-sky-600 text-sm font-semibold hover:bg-sky-50/50 hover:border-sky-300 transition-all duration-200">
                <Plus size={14} className="inline mr-1.5" /> New Invoice
              </button>
            )}

            {/* New Invoice Form */}
            {showInvoiceForm && (
              <div className={`${T.card} p-5 sm:p-6 border-sky-200`}>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-gray-900 font-bold text-sm">Submit Invoice</h2>
                  <button onClick={() => { setShowInvoiceForm(false); setInvoiceFile(null) }} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200"><X size={16} /></button>
                </div>

                {/* Row 1 */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className={T.label}>Invoice Number</label>
                    <div className="relative">
                      <Hash size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="text" placeholder="INV-2026-001" value={invoiceForm.invoice_number} onChange={e => setInvoiceForm(p => ({ ...p, invoice_number: e.target.value }))} className={`${T.input} pl-9`} />
                    </div>
                  </div>
                  {contractorType === 'pure_ls' ? (
                    <div>
                      <label className={T.label}>Invoice For</label>
                      <div className={`${T.input} bg-gray-100 text-gray-500 cursor-default`}>All Clients (distributed by effort)</div>
                    </div>
                  ) : (
                    <div>
                      <label className={T.label}>Invoice For</label>
                      <select value={invoiceForm.client_id} onChange={e => setInvoiceForm(p => ({ ...p, client_id: e.target.value }))} className={T.select}>
                        <option value="">Select a client</option>
                        {Object.entries(assignmentsByClient).map(([cid, { clientName }]) => <option key={cid} value={cid}>{clientName}</option>)}
                      </select>
                      {contractorType === 'mixed' && <p className="text-[11px] text-gray-400 mt-1.5">Submit a separate invoice for each client.</p>}
                    </div>
                  )}
                </div>

                {/* Row 2 */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className={T.label}>Billing Period</label>
                    <div className="inline-flex items-center gap-0 bg-white border border-gray-200 rounded-xl overflow-hidden w-full shadow-sm">
                      <button onClick={() => { const d = new Date(invoiceMonth); d.setMonth(d.getMonth() - 1); setInvoiceMonth(d) }} className="p-2.5 text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-all duration-200 border-r border-gray-200"><ChevronLeft size={14} /></button>
                      <span className="text-gray-900 text-sm font-medium flex-1 text-center py-2">{billingMonth.label}</span>
                      <button onClick={() => { const d = new Date(invoiceMonth); d.setMonth(d.getMonth() + 1); setInvoiceMonth(d) }} className="p-2.5 text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-all duration-200 border-l border-gray-200"><ChevronRight size={14} /></button>
                    </div>
                  </div>
                  <div>
                    <label className={T.label}>Invoice Amount</label>
                    <div className="relative">
                      <DollarSign size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="number" placeholder="0.00" step="0.01" min="0" value={invoiceForm.amount} onChange={e => setInvoiceForm(p => ({ ...p, amount: e.target.value }))} className={`${T.input} pl-9 tabular-nums`} />
                    </div>
                  </div>
                </div>

                {/* Distribution Reference */}
                {invoiceDistribution.length > 0 ? (
                  <div className="mb-4">
                    <p className={`${T.label} mb-2`}>Timesheet Reference — {billingMonth.label}</p>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead><tr className="text-gray-400 text-[10px] uppercase tracking-wider">
                          <th className="text-left px-4 py-2.5 font-bold">Client</th>
                          {invoiceDistribution.some(l => l.project_name) && <th className="text-left px-4 py-2.5 font-bold">Project</th>}
                          <th className="text-right px-4 py-2.5 font-bold">Hours</th>
                          {invoiceDistribution.some(l => l.allocation_pct !== undefined) && <th className="text-right px-4 py-2.5 font-bold">%</th>}
                        </tr></thead>
                        <tbody>{invoiceDistribution.map((l, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="px-4 py-2.5 text-gray-600 text-xs">{l.client_name}</td>
                            {invoiceDistribution.some(x => x.project_name) && <td className="px-4 py-2.5 text-gray-400 text-xs">{l.project_name || '—'}</td>}
                            <td className="px-4 py-2.5 text-right text-gray-700 text-xs font-medium tabular-nums">{l.hours?.toFixed(1)}</td>
                            {invoiceDistribution.some(x => x.allocation_pct !== undefined) && <td className="px-4 py-2.5 text-right text-gray-400 text-xs tabular-nums">{l.allocation_pct !== undefined ? `${l.allocation_pct}%` : '—'}</td>}
                          </tr>
                        ))}</tbody>
                        <tfoot><tr className="border-t border-gray-200">
                          <td colSpan={invoiceDistribution.some(l => l.project_name) ? 2 : 1} className="px-4 py-2.5 text-gray-700 text-xs font-bold">Total</td>
                          <td className="px-4 py-2.5 text-right text-gray-900 text-xs font-bold tabular-nums">{invoiceDistribution.reduce((s, l) => s + (l.hours || 0), 0).toFixed(1)}h</td>
                          {invoiceDistribution.some(l => l.allocation_pct !== undefined) && <td className="px-4 py-2.5 text-right text-gray-400 text-xs tabular-nums">100%</td>}
                        </tr></tfoot>
                      </table>
                    </div>
                  </div>
                ) : (contractorType !== 'pure_ls' && !invoiceForm.client_id) ? (
                  <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl text-center text-gray-400 text-sm">Select a client above to see your timesheet hours.</div>
                ) : null}

                {/* Attachment + Notes */}
                <div className="mb-4">
                  <label className={T.label}>Invoice Attachment</label>
                  <DropZone file={invoiceFile} onFile={setInvoiceFile} onRemove={() => setInvoiceFile(null)} uploading={submittingInvoice} label="Drop invoice PDF here" accept=".pdf,image/*" />
                </div>
                <div className="mb-4">
                  <label className={T.label}>Notes (optional)</label>
                  <textarea rows={2} placeholder="Any additional notes..." value={invoiceForm.notes} onChange={e => setInvoiceForm(p => ({ ...p, notes: e.target.value }))} className={`${T.input} resize-none`} />
                </div>

                <button onClick={submitInvoice} disabled={submittingInvoice || !invoiceForm.invoice_number || parseFloat(invoiceForm.amount || '0') <= 0 || (contractorType !== 'pure_ls' && !invoiceForm.client_id)} className={`w-full ${T.btnPrimary} py-3`}>
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
                    <div key={inv.id} className={`${T.cardHover} overflow-hidden`}>
                      <div className="px-4 sm:px-5 py-4 flex items-center gap-3 sm:gap-4">
                        <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0">
                          <FileText size={15} className="text-sky-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-gray-900 text-sm font-medium">{inv.invoice_number}</p>
                            {inv.receipt_url && <Paperclip size={11} className="text-sky-500" />}
                          </div>
                          <p className="text-gray-400 text-xs mt-0.5">{formatDate(inv.period_start)} – {formatDate(inv.period_end)}</p>
                        </div>
                        <span className="text-gray-900 font-semibold text-sm tabular-nums">{formatCurrency(inv.total_amount)}</span>
                        <StatusPill status={inv.status} />
                        {inv.status === 'submitted' && (
                          <button onClick={() => deleteInvoice(inv.id)} className="p-2 rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-all duration-200" title="Delete">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {lines.length > 0 && (
                        <div className="px-4 sm:px-5 pb-4 pt-0">
                          <div className="border-t border-gray-100 pt-3 space-y-1.5">
                            {lines.map((l: any, i: number) => (
                              <div key={i} className="flex items-center justify-between text-xs py-0.5">
                                <span className="text-gray-500">{l.description}</span>
                                <span className="text-gray-400 tabular-nums">{l.hours ? `${l.hours}h` : ''}{l.allocation_pct ? ` · ${l.allocation_pct}%` : ''}</span>
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
              <div className={`${T.card} text-center py-16`}>
                <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-4">
                  <FileText size={22} className="text-gray-300" />
                </div>
                <p className="text-gray-500 text-sm font-medium">No invoices yet</p>
                <p className="text-gray-400 text-xs mt-1.5">Click "New Invoice" to submit your first invoice</p>
              </div>
            )}
          </div>
        )}

        {/* ====== HISTORY ====== */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            {/* Month Navigator + Filter */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <WeekNav week={historyRange}
                onPrev={() => { const d = new Date(historyMonth); d.setMonth(d.getMonth() - 1); setHistoryMonth(d) }}
                onNext={() => { const d = new Date(historyMonth); d.setMonth(d.getMonth() + 1); setHistoryMonth(d) }}
              />

              <div className="inline-flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
                {([['all', 'All'], ['time', 'Time'], ['expenses', 'Expenses'], ['invoices', 'Invoices']] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setHistoryFilter(key)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                      historyFilter === key ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'text-gray-400 hover:text-gray-600 border border-transparent'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Hours Logged', value: historyTotals.totalHours.toFixed(1), color: '#10b981' },
                { label: 'Expenses', value: formatCurrency(historyTotals.totalExpenses), color: '#f59e0b' },
                { label: 'Invoiced', value: formatCurrency(historyTotals.totalInvoiced), color: '#0ea5e9' },
              ].map(card => (
                <div key={card.label} className={`${T.card} p-4 sm:p-5 relative overflow-hidden`}>
                  <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full" style={{ background: card.color }} />
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-gray-400 mb-2 pl-3">{card.label}</p>
                  <p className="text-lg sm:text-xl font-bold text-gray-900 tabular-nums tracking-tight pl-3">{card.value}</p>
                </div>
              ))}
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={22} className="text-emerald-500 animate-spin" />
              </div>
            ) : (
              <div className="space-y-8">
                {/* TIME ENTRIES */}
                {(historyFilter === 'all' || historyFilter === 'time') && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Timer size={13} className="text-emerald-500" />
                      <h2 className={T.sectionTitle}>Timesheet Entries</h2>
                      <span className="text-[11px] text-gray-300 ml-1 tabular-nums">{historyTotals.totalHours.toFixed(1)}h total</span>
                    </div>
                    {historyTimeByWeek.length > 0 ? (
                      <div className="space-y-2">
                        {historyTimeByWeek.map(([weekKey, week]) => (
                          <div key={weekKey} className={`${T.card} overflow-hidden`}>
                            <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-100 bg-gray-50/50">
                              <span className="text-xs font-medium text-gray-500">{week.label}</span>
                              <span className="text-xs font-bold text-emerald-600 tabular-nums">{week.totalHours.toFixed(1)}h</span>
                            </div>
                            <div className="divide-y divide-gray-50">
                              {week.entries.map((e: any) => {
                                const a = assignments.find(a => a.project_id === e.project_id)
                                return (
                                  <div key={e.id} className="px-4 sm:px-5 py-3 flex items-center gap-4 hover:bg-gray-50/50 transition-colors">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-gray-900 font-medium truncate">{a?.project_name || 'Unknown Project'}</p>
                                      <p className="text-xs text-gray-400 mt-0.5">{a?.client_name || ''}{e.description ? ` — ${e.description}` : ''}</p>
                                    </div>
                                    <span className="text-sm font-semibold text-gray-700 tabular-nums">{e.hours}h</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={`${T.card} text-center py-12`}>
                        <p className="text-gray-400 text-sm">No timesheet entries for {historyRange.label}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* EXPENSES */}
                {(historyFilter === 'all' || historyFilter === 'expenses') && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard size={13} className="text-amber-500" />
                      <h2 className={T.sectionTitle}>Expenses</h2>
                      <span className="text-[11px] text-gray-300 ml-1">{historyExpenses.length} item{historyExpenses.length !== 1 ? 's' : ''}</span>
                    </div>
                    {historyExpenses.length > 0 ? (
                      <div className="space-y-2">
                        {historyExpenses.map(exp => {
                          const cat = EXPENSE_CATEGORIES.find(c => c.id === exp.category)
                          return (
                            <div key={exp.id} className={`${T.cardHover} px-4 sm:px-5 py-4 flex items-center gap-3 sm:gap-4`}>
                              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                                <Receipt size={15} className="text-amber-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-gray-900 text-sm font-medium truncate">{exp.description}</p>
                                <div className="flex items-center gap-2 text-gray-400 text-xs mt-1">
                                  <span>{formatDate(exp.date)}</span>
                                  <span className="w-0.5 h-0.5 rounded-full bg-gray-300" />
                                  <span>{cat?.label || exp.category}</span>
                                  {exp.receipt_url && <><span className="w-0.5 h-0.5 rounded-full bg-gray-300" /><Paperclip size={10} className="text-sky-500" /></>}
                                </div>
                              </div>
                              <span className="text-gray-900 font-semibold text-sm tabular-nums">{formatCurrency(exp.amount)}</span>
                              <StatusPill status={exp.status} />
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className={`${T.card} text-center py-12`}>
                        <p className="text-gray-400 text-sm">No expenses for {historyRange.label}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* INVOICES */}
                {(historyFilter === 'all' || historyFilter === 'invoices') && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText size={13} className="text-sky-500" />
                      <h2 className={T.sectionTitle}>Invoices</h2>
                      <span className="text-[11px] text-gray-300 ml-1">{historyInvoices.length} invoice{historyInvoices.length !== 1 ? 's' : ''}</span>
                    </div>
                    {historyInvoices.length > 0 ? (
                      <div className="space-y-2">
                        {historyInvoices.map(inv => {
                          const lines = inv.contractor_invoice_lines || inv.lines || []
                          return (
                            <div key={inv.id} className={`${T.cardHover} overflow-hidden`}>
                              <div className="px-4 sm:px-5 py-4 flex items-center gap-3 sm:gap-4">
                                <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0">
                                  <FileText size={15} className="text-sky-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-gray-900 text-sm font-medium">{inv.invoice_number}</p>
                                    {inv.receipt_url && <Paperclip size={11} className="text-sky-500" />}
                                  </div>
                                  <p className="text-gray-400 text-xs mt-0.5">{formatDate(inv.period_start)} – {formatDate(inv.period_end)}</p>
                                </div>
                                <span className="text-gray-900 font-semibold text-sm tabular-nums">{formatCurrency(inv.total_amount)}</span>
                                <StatusPill status={inv.status} />
                              </div>
                              {lines.length > 0 && (
                                <div className="px-4 sm:px-5 pb-4 pt-0">
                                  <div className="border-t border-gray-100 pt-3">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                          <th className="text-left pb-2">Description</th>
                                          <th className="text-right pb-2">Hours</th>
                                          <th className="text-right pb-2">Allocation</th>
                                          <th className="text-right pb-2">Amount</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-50">
                                        {lines.map((l: any, i: number) => (
                                          <tr key={i}>
                                            <td className="py-2 text-gray-500">{l.description}</td>
                                            <td className="py-2 text-right text-gray-400 tabular-nums">{l.hours ? `${Number(l.hours).toFixed(1)}h` : '—'}</td>
                                            <td className="py-2 text-right text-gray-400 tabular-nums">{l.allocation_pct ? `${l.allocation_pct}%` : '—'}</td>
                                            <td className="py-2 text-right text-gray-700 font-medium tabular-nums">{l.amount ? formatCurrency(l.amount) : '—'}</td>
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
                      <div className={`${T.card} text-center py-12`}>
                        <p className="text-gray-400 text-sm">No invoices for {historyRange.label}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Empty state when all filtered sections are empty */}
                {historyFilter === 'all' && historyTime.length === 0 && historyExpenses.length === 0 && historyInvoices.length === 0 && (
                  <div className={`${T.card} text-center py-16`}>
                    <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-4">
                      <History size={22} className="text-gray-300" />
                    </div>
                    <p className="text-gray-500 text-sm font-medium">No submissions for {historyRange.label}</p>
                    <p className="text-gray-400 text-xs mt-1.5">Try navigating to a different month</p>
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
