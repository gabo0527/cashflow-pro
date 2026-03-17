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
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart } from 'recharts'

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
interface ContractorInvoice { id: string; invoice_number: string; invoice_date: string; due_date: string; period_start: string; period_end: string; total_amount: number; status: string; payment_terms: string; receipt_url?: string; submitted_at: string; notes?: string; client_id?: string; lines?: any[]; contractor_invoice_lines?: any[] }
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
  { id: 'mixed', label: 'Mixed / Multiple' },
  { id: 'travel', label: 'Travel' },
  { id: 'meal', label: 'Meals' },
  { id: 'transportation', label: 'Transportation' },
  { id: 'hotel', label: 'Hotel' },
  { id: 'software', label: 'Software' },
  { id: 'other', label: 'Other' },
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
  submitted: { label: 'Submitted', color: 'text-sky-600',     bg: 'bg-sky-50',     border: 'border-gray-200', dot: 'bg-sky-500' },
  approved:  { label: 'Approved',  color: 'text-emerald-600', bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-gray-900' },
  rejected:  { label: 'Rejected',  color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200', dot: 'bg-red-500' },
  paid:      { label: 'Paid',      color: 'text-emerald-700', bg: 'bg-gray-50', border: 'border-gray-200', dot: 'bg-emerald-600' },
}

// ============ DESIGN TOKENS — financial/institutional ============
const T = {
  card: "bg-white border border-gray-200 rounded",
  cardHover: "bg-white border border-gray-200 rounded transition-colors hover:border-gray-300",
  input: "w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-900 text-[13px] placeholder-gray-300 focus:outline-none focus:border-gray-900 focus:bg-white transition-colors",
  select: "w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded text-gray-900 text-[13px] focus:outline-none focus:border-gray-900 focus:bg-white transition-colors cursor-pointer appearance-none",
  label: "block text-[10px] font-medium uppercase tracking-[0.06em] text-gray-400 mb-1.5",
  btnPrimary: "px-4 py-2 bg-gray-900 hover:bg-gray-800 active:bg-black text-white text-[13px] font-medium rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2",
  btnGhost: "px-3 py-1.5 rounded text-[13px] text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors border border-gray-200 hover:border-gray-300",
  sectionTitle: "text-[10px] font-medium uppercase tracking-[0.06em] text-gray-400",
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

// ============ STATUS PILL — sharp financial style ============
function StatusPill({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  const sharpStyles: Record<string, string> = {
    pending:   'bg-amber-50 text-amber-700 border border-amber-200',
    submitted: 'bg-blue-50 text-blue-700 border border-blue-200',
    approved:  'bg-gray-50 text-emerald-700 border border-gray-200',
    rejected:  'bg-red-50 text-red-700 border border-red-200',
    paid:      'bg-gray-100 text-gray-600 border border-gray-200',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium tracking-wide ${sharpStyles[status] || sharpStyles.pending}`}>
      <span className={`w-1.5 h-1.5 rounded ${config.dot}`} />
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
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded group">
        {isImage ? (
          <img src={URL.createObjectURL(file)} alt="" className="w-10 h-10 rounded object-cover border border-gray-200" />
        ) : (
          <div className="w-10 h-10 rounded bg-red-50 flex items-center justify-center shrink-0">
            <FileText size={16} className="text-red-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-gray-900 text-[13px] font-medium truncate">{file.name}</p>
          <p className="text-gray-400 text-xs tabular-nums">{file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(0)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}</p>
        </div>
        {uploading ? <Loader2 size={16} className="text-gray-700 animate-spin shrink-0" /> : (
          <button onClick={onRemove} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 opacity-0 group-hover:opacity-100"><X size={14} /></button>
        )}
      </div>
    )
  }

  return (
    <div onDragEnter={handleDragIn} onDragLeave={handleDragOut} onDragOver={handleDrag} onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative cursor-pointer rounded border-2 border-dashed transition-colors group ${
        dragging ? 'border-gray-400 bg-gray-50 scale-[1.01]' : 'border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50'
      }`}>
      <div className="flex flex-col items-center justify-center py-6 px-4">
        <div className={`w-11 h-11 rounded flex items-center justify-center mb-3 transition-colors ${dragging ? 'bg-emerald-100 scale-110' : 'bg-gray-100 group-hover:bg-gray-200'}`}>
          <Upload size={18} className={`transition-colors duration-200 ${dragging ? 'text-gray-700' : 'text-gray-400 group-hover:text-gray-500'}`} />
        </div>
        <p className={`text-[13px] font-medium transition-colors duration-200 ${dragging ? 'text-emerald-600' : 'text-gray-500'}`}>{dragging ? 'Drop file here' : label}</p>
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
        className={`relative cursor-pointer rounded border-2 border-dashed transition-colors group ${
          dragging ? 'border-gray-400 bg-gray-50 scale-[1.01]' : 'border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50'
        }`}>
        <div className="flex flex-col items-center justify-center py-6 px-4">
          <div className={`w-11 h-11 rounded flex items-center justify-center mb-3 transition-colors ${dragging ? 'bg-emerald-100 scale-110' : 'bg-gray-100 group-hover:bg-gray-200'}`}>
            <Upload size={18} className={`transition-colors duration-200 ${dragging ? 'text-gray-700' : 'text-gray-400 group-hover:text-gray-500'}`} />
          </div>
          <p className={`text-[13px] font-medium transition-colors duration-200 ${dragging ? 'text-emerald-600' : 'text-gray-500'}`}>{dragging ? 'Drop files here' : label}</p>
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
        <div key={i} className="flex items-center gap-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded group">
          {file.type.startsWith('image/') ? (
            <img src={URL.createObjectURL(file)} alt="" className="w-8 h-8 rounded object-cover border border-gray-200" />
          ) : (
            <div className="w-8 h-8 rounded bg-red-50 flex items-center justify-center shrink-0">
              <FileText size={14} className="text-red-500" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-gray-900 text-xs font-medium truncate">{file.name}</p>
            <p className="text-gray-400 text-[11px] tabular-nums">{file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(0)} KB` : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}</p>
          </div>
          {uploading ? <Loader2 size={14} className="text-gray-700 animate-spin shrink-0" /> : (
            <button onClick={(e) => { e.stopPropagation(); onRemoveFile(i) }} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 opacity-0 group-hover:opacity-100"><X size={12} /></button>
          )}
        </div>
      ))}
    </div>
  )
}

// ============ WEEK NAVIGATOR ============
function WeekNav({ week, onPrev, onNext }: { week: { label: string }; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="inline-flex items-center gap-0 border border-gray-200 rounded overflow-hidden bg-white">
      <button onClick={onPrev} className="px-2.5 py-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors border-r border-gray-200">
        <ChevronLeft size={14} />
      </button>
      <div className="flex items-center gap-2 px-4 py-1.5">
        <Calendar size={12} className="text-gray-400" />
        <span className="text-[13px] font-medium text-gray-900 tracking-tight">{week.label}</span>
      </div>
      <button onClick={onNext} className="px-2.5 py-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors border-l border-gray-200">
        <ChevronRight size={14} />
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
  const [activeTab, setActiveTab] = useState<'time' | 'expenses' | 'invoices' | 'history' | 'analytics'>('time')

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
  const [collapsedInvoiceClients, setCollapsedInvoiceClients] = useState<Set<string>>(new Set())
  const [invoiceGrouping, setInvoiceGrouping] = useState<'client' | 'month'>('client')

  // History
  const [historyMonth, setHistoryMonth] = useState(new Date())
  const [historyFilter, setHistoryFilter] = useState<'all' | 'time' | 'expenses' | 'invoices'>('all')
  const [historyTime, setHistoryTime] = useState<any[]>([])
  const [historyExpenses, setHistoryExpenses] = useState<Expense[]>([])
  const [historyInvoices, setHistoryInvoices] = useState<ContractorInvoice[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expandedHistoryWeeks, setExpandedHistoryWeeks] = useState<Set<string>>(new Set())
  const [expandedHistoryInvoices, setExpandedHistoryInvoices] = useState<Set<string>>(new Set())

  // Analytics
  const [analyticsPreset, setAnalyticsPreset] = useState<'this_week'|'this_month'|'last_month'|'q1'|'q2'|'q3'|'q4'|'last_quarter'|'ytd'|'last_year'|'custom'>('this_month')
  const [analyticsCustomStart, setAnalyticsCustomStart] = useState('')
  const [analyticsCustomEnd, setAnalyticsCustomEnd] = useState('')
  const [analyticsTime, setAnalyticsTime] = useState<any[]>([])
  const [analyticsExpenses, setAnalyticsExpenses] = useState<any[]>([])
  const [analyticsInvoices, setAnalyticsInvoices] = useState<any[]>([])
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [hoursChartMode, setHoursChartMode] = useState<'total' | 'byProject'>('byProject')
  const [invoiceChartMode, setInvoiceChartMode] = useState<'total' | 'byClient'>('total')

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

      let assigns: Assignment[] = []

      // Source 1: Explicit project assignments
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
      }

      // Source 2: Bill-rate implied — only for clients with NO explicit project assignments
      // If a client has specific projects selected in the rate card, respect that selection
      const assignedProjectIds = new Set(assigns.map(a => a.project_id))
      const clientsWithExplicitAssignments = new Set(assigns.map(a => a.client_id).filter(Boolean))
      const rateImplied = (projects || [])
        .filter((p: any) => 
          ratesByClient[p.client_id] && 
          !assignedProjectIds.has(p.id) && 
          !clientsWithExplicitAssignments.has(p.client_id) // Skip clients that already have specific project picks
        )
        .map((p: any) => ({
          project_id: p.id, project_name: p.name, client_id: p.client_id,
          client_name: cMap[p.client_id] || '',
          payment_type: ratesByClient[p.client_id].cost_type === 'hourly' ? 'tm' : 'lump_sum',
          rate: ratesByClient[p.client_id].rate
        }))
      assigns = [...assigns, ...rateImplied]

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
        // Deduplicate on load: if same project appears multiple times (double-submit bug),
        // keep only the latest entry per project and sum hours for display
        const byProject: Record<string, any[]> = {}
        data.forEach((e: any) => { if (!byProject[e.project_id]) byProject[e.project_id] = []; byProject[e.project_id].push(e) })
        const hasDupes = Object.values(byProject).some(arr => arr.length > 1)
        const grouped: Record<string, TimeEntryForm> = {}
        assignments.forEach(a => { grouped[a.project_id] = { project_id: a.project_id, hours: '', notes: '' } })
        // Use the canonical (latest) entry per project for display
        const canonical: any[] = Object.values(byProject).map(arr => arr.sort((a: any, b: any) => b.id.localeCompare(a.id))[0])
        canonical.forEach((e: any) => {
          if (grouped[e.project_id]) {
            grouped[e.project_id].hours = String(e.hours || 0)
            if (e.description) grouped[e.project_id].notes = e.description
          }
        })
        setTimeEntries(grouped); setExistingEntries(data)
        // Auto-fix duplicates silently in background — deduplicate without bothering the user
        if (hasDupes) {
          const dupeIds = data.filter((e: any) => !canonical.find((c: any) => c.id === e.id)).map((e: any) => e.id)
          if (dupeIds.length > 0) supabase.from('time_entries').delete().in('id', dupeIds).then(() => {
            setExistingEntries(canonical)
          })
        }
      } else {
        const init: Record<string, TimeEntryForm> = {}
        assignments.forEach(a => { init[a.project_id] = { project_id: a.project_id, hours: '', notes: '' } })
        setTimeEntries(init); setExistingEntries([])
      }
    }
    load()
  }, [member, assignments, week.start, week.end])

  // ============ SUBMIT TIME ============
  const submitTime = async () => {
    // Guard: prevent double-submit race condition
    if (!member || submittingTime) return
    setSubmittingTime(true); setError(null)
    try {
      // Step 1: Fetch ALL current entries for this week fresh from DB (catches any race dupes)
      const { data: freshEntries } = await supabase
        .from('time_entries')
        .select('id, project_id')
        .eq('contractor_id', member.id)
        .gte('date', week.start)
        .lte('date', week.end)

      // Step 2: Delete all existing entries for this week (clean slate, idempotent)
      if (freshEntries && freshEntries.length > 0) {
        const ids = freshEntries.map((e: any) => e.id)
        const { error: de } = await supabase.from('time_entries').delete().in('id', ids)
        if (de) throw de
      }

      // Step 3: Insert only projects with hours entered (exactly one row per project)
      const entries = Object.values(timeEntries)
        .filter(e => parseFloat(e.hours || '0') > 0)
        .map(e => {
          const a = assignments.find(a => a.project_id === e.project_id)
          return {
            contractor_id: member.id,
            project_id: e.project_id,
            date: week.start,
            hours: parseFloat(e.hours),
            billable_hours: parseFloat(e.hours),
            is_billable: true,
            bill_rate: a?.rate || 0,
            description: e.notes || null,
            company_id: member.company_id
          }
        })

      if (entries.length > 0) {
        const { error: ie } = await supabase.from('time_entries').insert(entries)
        if (ie) throw ie
      }

      // Step 4: Refresh local state so existingEntries is accurate
      const { data: newEntries } = await supabase
        .from('time_entries')
        .select('project_id, hours, description, date, id')
        .eq('contractor_id', member.id)
        .gte('date', week.start)
        .lte('date', week.end)
      setExistingEntries(newEntries || [])

      // Notify admin of timesheet submission — fire and forget
      const totalHours = entries.reduce((s, e) => s + e.hours, 0)
      if (totalHours > 0) {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'timesheet', id: member.id, status: 'submitted', weekStart: week.start })
        }).catch(err => console.warn('Timesheet notification failed:', err))
      }

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
      const { data: newExp, error: ie } = await supabase.from('contractor_expenses').insert({ team_member_id: member.id, date: expenseForm.date, category: expenseForm.category, description: expenseForm.description, amount: parseFloat(expenseForm.amount), project_id: expenseForm.project_id || null, client_id: expenseForm.client_id || null, receipt_url: receiptUrl, is_billable: isBillable, company_id: 'a1b2c3d4-0000-4000-a000-000000000001', status: 'submitted' }).select().single()
      if (ie) throw ie

      // Notify — fire and forget, don't block UI
      if (newExp?.id) {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'expense', id: newExp.id, status: 'submitted' })
        }).catch(err => console.warn('Expense notification failed:', err))
      }

      setShowExpenseForm(false); setExpenseForm({ date: new Date().toISOString().split('T')[0], category: 'mixed', description: '', amount: '', project_id: '', client_id: '' }); setExpenseFiles([])
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
        invoice_date: billingMonth.end, due_date: new Date(new Date(billingMonth.end).getTime() + 30 * 86400000).toISOString().split('T')[0],
        period_start: billingMonth.start, period_end: billingMonth.end,
        total_amount: enteredAmount, payment_terms: invoiceForm.payment_terms, receipt_url: receiptUrl, notes: invoiceForm.notes || null, status: 'submitted',
        company_id: 'a1b2c3d4-0000-4000-a000-000000000001',
        client_id: invoiceForm.client_id && invoiceForm.client_id !== 'all' ? invoiceForm.client_id : null
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

      // Notify — fire and forget, don't block UI
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'invoice', id: inv.id, status: 'submitted' })
      }).catch(err => console.warn('Invoice notification failed:', err))
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
        const { data: expData } = await supabase.from('contractor_expenses').select('*').eq('team_member_id', member.id).neq('status', 'rejected').gte('date', historyRange.start).lte('date', historyRange.end).order('date', { ascending: false })
        const { data: invData } = await supabase.from('contractor_invoices').select('*, contractor_invoice_lines(*)').eq('team_member_id', member.id).gte('period_start', historyRange.start).lte('period_start', historyRange.end).order('invoice_date', { ascending: false })
        setHistoryTime(timeData || []); setHistoryExpenses(expData || []); setHistoryInvoices(invData || [])
      } catch (err) { console.error('History load error:', err) }
      finally { setHistoryLoading(false) }
    }
    load()
  }, [member, activeTab, historyRange.start, historyRange.end])

  // ============ ANALYTICS DATE RANGE ============
  const analyticsRange = useMemo(() => {
    const now = new Date()
    const yr = now.getFullYear()
    const fmt = (d: Date) => d.toISOString().split('T')[0]
    const monthLabel = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    // Quarter helpers
    const qBounds = (q: number, y: number) => {
      const s = new Date(y, q * 3, 1)
      const e = new Date(y, q * 3 + 3, 0)
      return { start: fmt(s), end: fmt(e), label: `Q${q + 1} ${y}` }
    }
    const currentQ = Math.floor(now.getMonth() / 3)

    switch (analyticsPreset) {
      case 'this_week': {
        const day = now.getDay()
        const s = new Date(now); s.setDate(now.getDate() - day)
        const e = new Date(s); e.setDate(s.getDate() + 6)
        return { start: fmt(s), end: fmt(e), label: `This Week`, granularity: 'weekly' as const }
      }
      case 'this_month': {
        const s = new Date(yr, now.getMonth(), 1)
        const e = new Date(yr, now.getMonth() + 1, 0)
        return { start: fmt(s), end: fmt(e), label: monthLabel(s), granularity: 'weekly' as const }
      }
      case 'last_month': {
        const s = new Date(yr, now.getMonth() - 1, 1)
        const e = new Date(yr, now.getMonth(), 0)
        return { start: fmt(s), end: fmt(e), label: monthLabel(s), granularity: 'weekly' as const }
      }
      case 'q1': return { ...qBounds(0, yr), granularity: 'weekly' as const }
      case 'q2': return { ...qBounds(1, yr), granularity: 'weekly' as const }
      case 'q3': return { ...qBounds(2, yr), granularity: 'weekly' as const }
      case 'q4': return { ...qBounds(3, yr), granularity: 'weekly' as const }
      case 'last_quarter': {
        const prevQ = currentQ === 0 ? 3 : currentQ - 1
        const prevY = currentQ === 0 ? yr - 1 : yr
        return { ...qBounds(prevQ, prevY), granularity: 'weekly' as const }
      }
      case 'ytd': {
        const s = new Date(yr, 0, 1)
        return { start: fmt(s), end: fmt(now), label: `YTD ${yr}`, granularity: 'monthly' as const }
      }
      case 'last_year': {
        const s = new Date(yr - 1, 0, 1)
        const e = new Date(yr - 1, 11, 31)
        return { start: fmt(s), end: fmt(e), label: String(yr - 1), granularity: 'monthly' as const }
      }
      case 'custom':
        if (analyticsCustomStart && analyticsCustomEnd) {
          const diffDays = (new Date(analyticsCustomEnd).getTime() - new Date(analyticsCustomStart).getTime()) / 86400000
          return { start: analyticsCustomStart, end: analyticsCustomEnd, label: 'Custom Range', granularity: (diffDays > 90 ? 'monthly' : 'weekly') as 'monthly' | 'weekly' }
        }
        break
    }
    // Fallback
    const s = new Date(yr, now.getMonth(), 1)
    const e = new Date(yr, now.getMonth() + 1, 0)
    return { start: fmt(s), end: fmt(e), label: monthLabel(s), granularity: 'weekly' as const }
  }, [analyticsPreset, analyticsCustomStart, analyticsCustomEnd])

  // ============ LOAD ANALYTICS ============
  useEffect(() => {
    if (!member || activeTab !== 'analytics') return
    const load = async () => {
      setAnalyticsLoading(true)
      try {
        const { data: timeData } = await supabase.from('time_entries').select('id, project_id, hours, billable_hours, date').eq('contractor_id', member.id).gte('date', analyticsRange.start).lte('date', analyticsRange.end).order('date', { ascending: true })
        const { data: expData } = await supabase.from('contractor_expenses').select('id, date, category, amount, status, client_id').eq('team_member_id', member.id).gte('date', analyticsRange.start).lte('date', analyticsRange.end).order('date', { ascending: true })
        const { data: invData } = await supabase.from('contractor_invoices').select('id, invoice_date, total_amount, status, period_start, period_end, contractor_invoice_lines(*)').eq('team_member_id', member.id).lte('period_start', analyticsRange.end).gte('period_end', analyticsRange.start).order('invoice_date', { ascending: true })
        setAnalyticsTime(timeData || []); setAnalyticsExpenses(expData || []); setAnalyticsInvoices(invData || [])
      } catch (err) { console.error('Analytics load error:', err) }
      finally { setAnalyticsLoading(false) }
    }
    load()
  }, [member, activeTab, analyticsRange.start, analyticsRange.end])

  // ============ ANALYTICS COMPUTED DATA ============
  // Hours bucketed by week or month depending on range granularity
  const analyticsWeeklyHours = useMemo(() => {
    if (analyticsTime.length === 0) return [] as { week: string; total: number; projects: Record<string, number> }[]
    const projectMap: Record<string, string> = {}
    assignments.forEach(a => { projectMap[a.project_id] = a.project_name })
    const useMonthly = analyticsRange.granularity === 'monthly'
    const buckets: Record<string, { week: string; total: number; projects: Record<string, number> }> = {}

    analyticsTime.forEach((e: any) => {
      const d = new Date(e.date + 'T00:00:00')
      let key: string, label: string
      if (useMonthly) {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      } else {
        const day = d.getDay()
        const weekStart = new Date(d); weekStart.setDate(d.getDate() - day)
        key = weekStart.toISOString().split('T')[0]
        label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }
      if (!buckets[key]) buckets[key] = { week: label, total: 0, projects: {} }
      const pName = projectMap[e.project_id] || 'Other'
      buckets[key].projects[pName] = (buckets[key].projects[pName] || 0) + (e.hours || 0)
      buckets[key].total += e.hours || 0
    })
    return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b)).map(([_, v]) => v)
  }, [analyticsTime, assignments, analyticsRange.granularity])

  // Only project names with actual hours logged in the period (no zero columns)
  const analyticsProjectNames = useMemo(() => {
    const withHours = new Set<string>()
    analyticsWeeklyHours.forEach(wk => {
      Object.entries(wk.projects).forEach(([name, hrs]) => { if (hrs > 0) withHours.add(name) })
    })
    return Array.from(withHours)
  }, [analyticsWeeklyHours])

  // Effort distribution by client (pie)
  const analyticsEffortByClient = useMemo(() => {
    if (analyticsTime.length === 0) return []
    const clientMap: Record<string, string> = {}
    assignments.forEach(a => { clientMap[a.project_id] = a.client_name || 'Unassigned' })
    const totals: Record<string, number> = {}
    analyticsTime.forEach((e: any) => {
      const client = clientMap[e.project_id] || 'Other'
      totals[client] = (totals[client] || 0) + (e.hours || 0)
    })
    return Object.entries(totals).map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 })).sort((a, b) => b.hours - a.hours)
  }, [analyticsTime, assignments])

  // Monthly invoice trend — grouped by period_start, fills all months in range with $0
  const analyticsInvoiceTrend = useMemo(() => {
    // Build full month scaffold from range start to end
    const startD = new Date(analyticsRange.start + 'T00:00:00')
    const endD = new Date(analyticsRange.end + 'T00:00:00')
    const months: Record<string, { month: string; total: number; byClient: Record<string, number>; count: number }> = {}
    const cur = new Date(startD.getFullYear(), startD.getMonth(), 1)
    while (cur <= endD) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
      const label = cur.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      months[key] = { month: label, total: 0, byClient: {}, count: 0 }
      cur.setMonth(cur.getMonth() + 1)
    }
    // Populate from invoices using period_start for bucketing
    analyticsInvoices.forEach((inv: any) => {
      const d = new Date((inv.period_start || inv.invoice_date) + 'T00:00:00')
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!months[key]) return // outside range, skip
      months[key].total += inv.total_amount || 0
      months[key].count += 1
      // Per-client breakdown using invoice_lines
      const lines = inv.contractor_invoice_lines || []
      if (lines.length > 0) {
        lines.forEach((l: any) => {
          const cid = l.client_id || 'General'
          months[key].byClient[cid] = (months[key].byClient[cid] || 0) + (l.amount || 0)
        })
      } else {
        const cid = inv.client_id || 'General'
        months[key].byClient[cid] = (months[key].byClient[cid] || 0) + (inv.total_amount || 0)
      }
    })
    return Object.entries(months).sort(([a], [b]) => a.localeCompare(b)).map(([_, v]) => v)
  }, [analyticsInvoices, analyticsRange.start, analyticsRange.end])

  // All unique client IDs that appear in invoice trend (for per-client toggle)
  const analyticsInvoiceClientIds = useMemo(() => {
    const ids = new Set<string>()
    analyticsInvoiceTrend.forEach(m => { Object.keys(m.byClient).forEach(id => ids.add(id)) })
    return Array.from(ids)
  }, [analyticsInvoiceTrend])

  // Expense breakdown by category
  const analyticsExpensesByCategory = useMemo(() => {
    if (analyticsExpenses.length === 0) return []
    const cats: Record<string, number> = {}
    analyticsExpenses.forEach((e: any) => {
      const cat = EXPENSE_CATEGORIES.find(c => c.id === e.category)?.label || e.category || 'Other'
      cats[cat] = (cats[cat] || 0) + (e.amount || 0)
    })
    return Object.entries(cats).map(([name, amount]) => ({ name, amount: Math.round(amount) })).sort((a, b) => b.amount - a.amount)
  }, [analyticsExpenses])

  // Analytics KPIs with period comparisons
  const analyticsKPIs = useMemo(() => {
    const totalHours = analyticsTime.reduce((s: number, e: any) => s + (e.hours || 0), 0)
    const totalExpenses = analyticsExpenses.reduce((s: number, e: any) => s + (e.amount || 0), 0)
    const totalInvoiced = analyticsInvoices.reduce((s: number, inv: any) => s + (inv.total_amount || 0), 0)
    const uniqueProjects = new Set(analyticsTime.map((e: any) => e.project_id)).size
    // Average weekly hours
    const weeks = new Set<string>()
    analyticsTime.forEach((e: any) => {
      const d = new Date(e.date + 'T00:00:00'); const day = d.getDay()
      const ws = new Date(d); ws.setDate(d.getDate() - day)
      weeks.add(ws.toISOString().split('T')[0])
    })
    const avgWeeklyHours = weeks.size > 0 ? totalHours / weeks.size : 0
    return { totalHours, totalExpenses, totalInvoiced, uniqueProjects, avgWeeklyHours, weekCount: weeks.size }
  }, [analyticsTime, analyticsExpenses, analyticsInvoices])

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
    { id: 'history' as const, label: 'History', icon: History },
    { id: 'analytics' as const, label: 'Analytics', icon: TrendingUp }
  ]
  const totalTimeHours = Object.values(timeEntries).reduce((s, e) => s + parseFloat(e.hours || '0'), 0)

  // ============ LOGIN SCREEN ============
  if (step === 'email') {
    return (
      <div className="min-h-screen bg-[#f4f5f7] flex items-center justify-center p-4" style={{ colorScheme: 'light' }}>
        <div className="w-full max-w-[380px]">
          {/* Logo */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center mb-4">
              <svg width={52} height={52} viewBox="0 0 40 40" fill="none">
                <path d="M8 8L20 32L32 8" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            <h1 className="text-2xl font-medium text-gray-900 tracking-tight">Vantage</h1>
            <p className="text-gray-400 text-[13px] mt-1.5 tracking-wide">Contractor Portal</p>
          </div>

          <div className={`${T.card} p-7`}>
            <label className={T.label}>Email address</label>
            <input 
              type="email" value={email} onChange={e => setEmail(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && lookupEmail()} 
              placeholder="you@company.com"
              className={`${T.input} mb-4`} 
            />
            {error && (
              <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded flex items-center gap-2.5 text-red-600 text-[13px]">
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
    <div className="min-h-screen bg-[#f5f5f3] text-gray-900" style={{ colorScheme: 'light' }}>
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-[48px]">
            {/* Logo + Name */}
            <div className="flex items-center gap-3">
              <svg width={18} height={18} viewBox="0 0 40 40" fill="none">
                <path d="M8 8L20 32L32 8" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              <div className="h-3.5 w-px bg-gray-200" />
              <span className="text-[13px] font-medium text-gray-600">{member?.name}</span>
            </div>

            {/* Nav Tabs */}
            <nav className="flex items-center overflow-x-auto">
              {navItems.map(item => (
                <button key={item.id} onClick={() => { setActiveTab(item.id); setError(null) }}
                  className={`relative flex items-center gap-1.5 px-3 sm:px-4 h-[48px] text-[12px] font-medium transition-colors whitespace-nowrap ${
                    activeTab === item.id
                      ? 'text-gray-900'
                      : 'text-gray-400 hover:text-gray-700'
                  }`}>
                  <item.icon size={13} className={activeTab === item.id ? 'text-gray-700' : ''} />
                  <span className="hidden sm:inline">{item.label}</span>
                  {activeTab === item.id && (
                    <span className="absolute bottom-0 left-2 right-2 h-[1.5px] bg-gray-900" />
                  )}
                </button>
              ))}
            </nav>

            {/* Sign out */}
            <button onClick={() => { setStep('email'); setMember(null); setAssignments([]); setRateCards([]); setEmail('') }}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded text-[12px] text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-5">
        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded flex items-center gap-2.5 text-red-700 text-[13px]">
            <AlertCircle size={14} className="shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded transition-colors"><X size={13} /></button>
          </div>
        )}

        {/* ====== TIMESHEET ====== */}
        {activeTab === 'time' && (
          <div className="space-y-3">
            {/* Week Nav + KPI strip */}
            <div className={`${T.card} overflow-hidden`}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <WeekNav week={week}
                  onPrev={() => { const d = new Date(weekDate); d.setDate(d.getDate() - 7); setWeekDate(d) }}
                  onNext={() => { const d = new Date(weekDate); d.setDate(d.getDate() + 7); setWeekDate(d) }}
                />
                <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-gray-400">
                  {totalTimeHours > 0 ? 'Draft' : 'Not submitted'}
                </span>
              </div>
              <div className="grid grid-cols-3 divide-x divide-gray-100">
                <div className="px-4 py-3">
                  <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-gray-400 mb-1">This week</div>
                  <div className={`text-xl font-medium tabular-nums tracking-tight ${totalTimeHours > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>
                    {totalTimeHours > 0 ? `${totalTimeHours.toFixed(1)}h` : '—'}
                  </div>
                </div>
                <div className="px-4 py-3">
                  <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-gray-400 mb-1">Month to date</div>
                  <div className="text-xl font-medium tabular-nums tracking-tight text-gray-900">
                    {assignments.length > 0 ? `${(existingEntries.reduce((s: number, e: any) => s + (e.hours || 0), 0)).toFixed(1)}h` : '—'}
                  </div>
                </div>
                <div className="px-4 py-3">
                  <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-gray-400 mb-1">Projects</div>
                  <div className="text-xl font-medium tabular-nums tracking-tight text-gray-900">{assignments.length}</div>
                </div>
              </div>
            </div>

            {timeSuccess && (
              <div className="flex items-center gap-2 text-emerald-700 text-[13px] bg-gray-50 border border-gray-200 px-3 py-2 rounded">
                <CheckCircle size={13} className="shrink-0" /> Timesheet submitted successfully
              </div>
            )}

            {/* Project rows */}
            <div className={`${T.card} overflow-hidden divide-y divide-gray-100`}>
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className={T.sectionTitle}>Log hours — {week.label}</span>
                <span className={`${T.sectionTitle} tabular-nums`}>{totalTimeHours > 0 ? `${totalTimeHours.toFixed(1)}h total` : ''}</span>
              </div>

              {Object.entries(assignmentsByClient).map(([cid, { clientName, projects }]) => {
                const color = clientColorMap[cid] || '#9ca3af'
                // desaturate: map vibrant colors to muted equivalents
                const muted: Record<string, string> = {
                  '#f59e0b': '#b08d57', '#f97316': '#b07a50', '#eab308': '#a89040',
                  '#10b981': '#4a9e7a', '#14b8a6': '#4a9490', '#06b6d4': '#4a8fa8',
                  '#3b82f6': '#5b7eb8', '#6366f1': '#6b6eb8', '#8b5cf6': '#7b6eb8',
                  '#ec4899': '#b06080', '#ef4444': '#b06060', '#f43f5e': '#a06070',
                }
                const dotColor = muted[color] || color

                return (
                  <div key={cid}>
                    {/* Client header — minimal */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-50/50">
                      <div className="w-1.5 h-1.5 rounded shrink-0" style={{ background: dotColor }} />
                      <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-gray-400">{clientName}</span>
                    </div>

                    {projects.map((p, i) => {
                      const hasHours = parseFloat(timeEntries[p.project_id]?.hours || '0') > 0
                      const hasNote = !!(timeEntries[p.project_id]?.notes)
                      const noteOpen = hasHours || hasNote

                      return (
                        <div key={p.project_id} className="border-t border-gray-100 first:border-t-0">
                          {/* Hour row */}
                          <div className="flex items-center px-4 h-11 gap-3">
                            <span className={`flex-1 text-[13px] truncate ${hasHours ? 'text-gray-900' : 'text-gray-500'}`}>
                              {p.project_name}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="—"
                                value={timeEntries[p.project_id]?.hours || ''}
                                onChange={e => {
                                  const v = e.target.value
                                  if (v === '' || /^\d*\.?\d*$/.test(v))
                                    setTimeEntries(prev => ({ ...prev, [p.project_id]: { ...prev[p.project_id], hours: v } }))
                                }}
                                className="w-12 py-1 bg-transparent border-b border-gray-200 text-gray-900 text-[14px] font-medium text-right tabular-nums focus:outline-none focus:border-gray-900 transition-colors placeholder-gray-300"
                              />
                              <span className="text-[11px] text-gray-300 w-3">h</span>
                            </div>
                            {/* Note toggle — only show when row has hours or already has a note */}
                            {(hasHours || hasNote) && (
                              <button
                                onClick={() => {
                                  const current = timeEntries[p.project_id]?.notes
                                  if (current !== undefined && !hasHours) return
                                  setTimeEntries(prev => ({
                                    ...prev,
                                    [p.project_id]: {
                                      ...prev[p.project_id],
                                      notes: hasNote ? '' : (prev[p.project_id]?.notes ?? '')
                                    }
                                  }))
                                }}
                                className="text-[11px] text-gray-300 hover:text-gray-600 transition-colors shrink-0 px-1"
                              >
                                {hasNote ? '− note' : '+ note'}
                              </button>
                            )}
                          </div>

                          {/* Expandable note — Option A */}
                          {noteOpen && (
                            <div className="px-4 pb-2.5 pt-0">
                              <input
                                type="text"
                                placeholder="What did you work on this week?"
                                value={timeEntries[p.project_id]?.notes || ''}
                                onChange={e => setTimeEntries(prev => ({
                                  ...prev,
                                  [p.project_id]: { ...prev[p.project_id], notes: e.target.value }
                                }))}
                                className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded text-[12px] text-gray-600 placeholder-gray-300 focus:outline-none focus:border-gray-400 focus:bg-white transition-colors"
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* Footer — submit */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[12px] text-gray-400">
                {totalTimeHours > 0
                  ? `Submitting ${totalTimeHours.toFixed(1)}h across ${Object.values(timeEntries).filter(e => parseFloat(e.hours || '0') > 0).length} project${Object.values(timeEntries).filter(e => parseFloat(e.hours || '0') > 0).length !== 1 ? 's' : ''}`
                  : 'Enter hours above to submit'}
              </span>
              <button
                onClick={submitTime}
                disabled={submittingTime || totalTimeHours === 0}
                className={T.btnPrimary}
              >
                {submittingTime ? <><Loader2 size={13} className="animate-spin" /> Submitting...</> : <><Send size={13} /> Submit timesheet</>}
              </button>
            </div>
          </div>
        )}

        {/* ====== EXPENSES ====== */}
        {activeTab === 'expenses' && (
          <div className="space-y-3">
            {/* New Expense Button */}
            {!showExpenseForm && (
              <button onClick={() => setShowExpenseForm(true)} className="w-full py-2.5 border border-dashed border-gray-300 rounded text-[13px] text-gray-500 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors">
                <Plus size={13} className="inline mr-1.5" /> New expense
              </button>
            )}

            {/* New Expense Form */}
            {showExpenseForm && (
              <div className={`${T.card} p-4`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-gray-900 font-medium text-[13px]">New expense</h2>
                  <button onClick={() => { setShowExpenseForm(false); setExpenseFiles([]) }} className="p-1 rounded text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"><X size={14} /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
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



                  <div className="col-span-2">
                    <label className={T.label}>Description</label>
                    <input type="text" placeholder="What was this expense for?" value={expenseForm.description} onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))} className={T.input} />
                  </div>
                  <div className="col-span-2">
                    <label className={T.label}>Receipts / Documents</label>
                    <MultiDropZone files={expenseFiles} onAddFiles={(f) => setExpenseFiles(prev => [...prev, ...f])} onRemoveFile={(i) => setExpenseFiles(prev => prev.filter((_, idx) => idx !== i))} uploading={submittingExpense} label="Drop receipts here" accept="image/*,.pdf" />
                  </div>
                </div>
                <button onClick={submitExpense} disabled={submittingExpense || !expenseForm.description || !expenseForm.amount} className={`w-full mt-4 ${T.btnPrimary} py-3`}>
                  {submittingExpense ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : <><Send size={16} /> Submit Expense</>}
                </button>
              </div>
            )}

            {/* Expense List */}
            {expenses.length > 0 ? (
              <div className="space-y-2">
                {expenses.map(exp => {
                  const cat = EXPENSE_CATEGORIES.find(c => c.id === exp.category)
                  const clientName = exp.client_id ? (assignmentsByClient[exp.client_id]?.clientName || '—') : null
                  const receiptUrl = exp.receipt_url
                    ? supabase.storage.from('contractor-uploads').getPublicUrl(exp.receipt_url).data.publicUrl
                    : null
                  return (
                    <div key={exp.id} className={`${T.cardHover} px-4 py-3 flex items-center gap-3 sm:gap-3`}>
                      <div className="w-10 h-10 rounded bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                        <Receipt size={15} className="text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 text-[13px] font-medium truncate">{exp.description}</p>
                        <div className="flex items-center gap-2 text-gray-400 text-xs mt-1">
                          <span>{formatDate(exp.date)}</span>
                          <span className="w-0.5 h-0.5 rounded bg-gray-300" />
                          <span>{cat?.label || exp.category}</span>
                          {clientName && (
                            <>
                              <span className="w-0.5 h-0.5 rounded bg-gray-300" />
                              <span className="text-emerald-600 font-medium">{clientName}</span>
                            </>
                          )}
                          {receiptUrl ? (
                            <>
                              <span className="w-0.5 h-0.5 rounded bg-gray-300" />
                              <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-700 transition-colors" title="View receipt">
                                <Paperclip size={10} />
                              </a>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <span className="text-gray-900 font-medium text-[13px] tabular-nums">{formatCurrency(exp.amount)}</span>
                      <StatusPill status={exp.status} />
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className={`${T.card} text-center py-12`}>
                <div className="w-14 h-14 rounded bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Receipt size={22} className="text-gray-300" />
                </div>
                <p className="text-gray-500 text-[13px] font-medium">No expenses yet</p>
                <p className="text-gray-400 text-xs mt-1.5">Click "New Expense" to submit your first report</p>
              </div>
            )}
          </div>
        )}

        {/* ====== INVOICES ====== */}
        {activeTab === 'invoices' && (
          <div className="space-y-3">
            {/* New Invoice Button */}
            {!showInvoiceForm && (
              <button onClick={() => { 
                const defaultClient = contractorType === 'pure_ls' ? 'all' : ''
                const defaultAmount = contractorType === 'pure_ls' && member?.cost_amount ? String(member.cost_amount) : ''
                setInvoiceForm(p => ({ ...p, client_id: defaultClient, amount: defaultAmount }))
                setShowInvoiceForm(true) 
              }} className={`w-full ${T.btnPrimary} py-2.5`}>
                <Plus size={13} /> New invoice
              </button>
            )}

            {/* New Invoice Form */}
            {showInvoiceForm && (
              <div className={`${T.card} p-4`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-gray-900 font-medium text-[13px]">Submit invoice</h2>
                  <button onClick={() => { setShowInvoiceForm(false); setInvoiceFile(null) }} className="p-1 rounded text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors"><X size={14} /></button>
                </div>

                {/* Row 1 */}
                <div className="grid grid-cols-2 gap-3 mb-4">
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
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className={T.label}>Billing Period</label>
                    <div className="inline-flex items-center gap-0 bg-white border border-gray-200 rounded overflow-hidden w-full">
                      <button onClick={() => { const d = new Date(invoiceMonth); d.setMonth(d.getMonth() - 1); setInvoiceMonth(d) }} className="p-2.5 text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors border-r border-gray-200"><ChevronLeft size={14} /></button>
                      <span className="text-gray-900 text-[13px] font-medium flex-1 text-center py-2">{billingMonth.label}</span>
                      <button onClick={() => { const d = new Date(invoiceMonth); d.setMonth(d.getMonth() + 1); setInvoiceMonth(d) }} className="p-2.5 text-gray-400 hover:text-gray-900 hover:bg-gray-50 transition-colors border-l border-gray-200"><ChevronRight size={14} /></button>
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
                    <div className="bg-gray-50 border border-gray-200 rounded overflow-hidden">
                      <table className="w-full text-[13px]">
                        <thead><tr className="text-gray-400 text-[10px] uppercase tracking-[0.04em]">
                          <th className="text-left px-4 py-2 font-medium">Client</th>
                          {invoiceDistribution.some(l => l.project_name) && <th className="text-left px-4 py-2 font-medium">Project</th>}
                          <th className="text-right px-4 py-2 font-medium">Hours</th>
                          {invoiceDistribution.some(l => l.allocation_pct !== undefined) && <th className="text-right px-4 py-2 font-medium">%</th>}
                        </tr></thead>
                        <tbody>{invoiceDistribution.map((l, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="px-4 py-2 text-gray-600 text-xs">{l.client_name}</td>
                            {invoiceDistribution.some(x => x.project_name) && <td className="px-4 py-2 text-gray-400 text-xs">{l.project_name || '—'}</td>}
                            <td className="px-4 py-2 text-right text-gray-700 text-xs font-medium tabular-nums">{l.hours?.toFixed(1)}</td>
                            {invoiceDistribution.some(x => x.allocation_pct !== undefined) && <td className="px-4 py-2 text-right text-gray-400 text-xs tabular-nums">{l.allocation_pct !== undefined ? `${l.allocation_pct}%` : '—'}</td>}
                          </tr>
                        ))}</tbody>
                        <tfoot><tr className="border-t border-gray-200">
                          <td colSpan={invoiceDistribution.some(l => l.project_name) ? 2 : 1} className="px-4 py-2 text-gray-700 text-xs font-medium">Total</td>
                          <td className="px-4 py-2 text-right text-gray-900 text-xs font-medium tabular-nums">{invoiceDistribution.reduce((s, l) => s + (l.hours || 0), 0).toFixed(1)}h</td>
                          {invoiceDistribution.some(l => l.allocation_pct !== undefined) && <td className="px-4 py-2 text-right text-gray-400 text-xs tabular-nums">100%</td>}
                        </tr></tfoot>
                      </table>
                    </div>
                  </div>
                ) : (contractorType !== 'pure_ls' && !invoiceForm.client_id) ? (
                  <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded text-center text-gray-400 text-[13px]">Select a client above to see your timesheet hours.</div>
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

            {/* Invoice History — grouping toggle + two views */}
            {invoices.length > 0 ? (() => {
              // Build client→month grouping
              const byClient: Record<string, { clientName: string; color: string; total: number; invoices: ContractorInvoice[] }> = {}
              invoices.forEach(inv => {
                const lines = inv.contractor_invoice_lines || inv.lines || []
                const clientName = inv.client_id
                  ? (assignmentsByClient[inv.client_id]?.clientName || 'Unknown')
                  : (lines[0]?.description?.split(' - ')[0] || 'General')
                const key = inv.client_id || 'general'
                const color = key !== 'general' ? (clientColorMap[key] || '#6b7280') : '#6b7280'
                if (!byClient[key]) byClient[key] = { clientName, color, total: 0, invoices: [] }
                byClient[key].invoices.push(inv)
                byClient[key].total += inv.total_amount || 0
              })

              // Build month→client grouping
              const byMonth: Record<string, { monthLabel: string; total: number; clients: { key: string; clientName: string; color: string; invoices: ContractorInvoice[] }[] }> = {}
              invoices.forEach(inv => {
                const d = new Date((inv.period_start || inv.invoice_date) + 'T00:00:00')
                const monthKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
                const monthLabel = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                const clientName = inv.client_id ? (assignmentsByClient[inv.client_id]?.clientName || 'Unknown') : 'General'
                const clientKey = inv.client_id || 'general'
                const color = clientKey !== 'general' ? (clientColorMap[clientKey] || '#6b7280') : '#6b7280'
                if (!byMonth[monthKey]) byMonth[monthKey] = { monthLabel, total: 0, clients: [] }
                byMonth[monthKey].total += inv.total_amount || 0
                const existing = byMonth[monthKey].clients.find(c => c.key === clientKey)
                if (existing) existing.invoices.push(inv)
                else byMonth[monthKey].clients.push({ key: clientKey, clientName, color, invoices: [inv] })
              })

              // Shared invoice card render
              const InvCard = ({ inv, color }: { inv: ContractorInvoice; color: string }) => {
                const lines = inv.contractor_invoice_lines || (inv as any).lines || []
                const bMonth = new Date(inv.period_start + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                const receiptUrl = inv.receipt_url ? supabase.storage.from('contractor-uploads').getPublicUrl(inv.receipt_url).data.publicUrl : null
                return (
                  <div className={`${T.cardHover} overflow-hidden`} style={{ borderLeft: `3px solid ${color}` }}>
                    <div className="px-4 py-3 flex items-center gap-3 sm:gap-3">
                      <div className="w-10 h-10 rounded bg-sky-50 border border-sky-100 flex items-center justify-center shrink-0">
                        <FileText size={15} className="text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-gray-900 text-[13px] font-medium">{inv.invoice_number}</p>
                          {receiptUrl && <a href={receiptUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-blue-500 hover:text-blue-700 transition-colors"><Paperclip size={11} /></a>}
                        </div>
                        <p className="text-gray-400 text-xs mt-0.5">{bMonth}</p>
                      </div>
                      <span className="text-gray-900 font-medium text-[13px] tabular-nums">{formatCurrency(inv.total_amount)}</span>
                      <StatusPill status={inv.status} />
                      {inv.status === 'submitted' && (
                        <button onClick={() => deleteInvoice(inv.id)} className="p-2 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                      )}
                    </div>
                    {lines.length > 0 && (
                      <div className="px-4 pb-4 pt-0">
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
              }

              return (
                <div className="space-y-3">
                  {/* Grouping toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-400 font-medium">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</span>
                    <div className="inline-flex border border-gray-200 rounded overflow-hidden">
                      {([['client', 'Client → Month'], ['month', 'Month → Client']] as const).map(([v, l]) => (
                        <button key={v} onClick={() => setInvoiceGrouping(v)}
                          className={`px-3 py-1.5 text-[11px] font-medium transition-colors border-r border-gray-200 last:border-r-0 whitespace-nowrap ${
                            invoiceGrouping === v ? 'bg-gray-900 text-white' : 'bg-white text-gray-400 hover:text-gray-700'
                          }`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Client → Month view */}
                  {invoiceGrouping === 'client' && Object.entries(byClient).map(([clientKey, g]) => {
                    const collapsed = collapsedInvoiceClients.has(clientKey)
                    return (
                      <div key={clientKey}>
                        <button onClick={() => { const n = new Set(collapsedInvoiceClients); collapsed ? n.delete(clientKey) : n.add(clientKey); setCollapsedInvoiceClients(n) }}
                          className="w-full flex items-center gap-2.5 px-1 py-2 hover:bg-gray-100/50 rounded transition-colors">
                          <div className="w-[6px] h-[6px] rounded-sm shrink-0" style={{ background: g.color }} />
                          <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-gray-500">{g.clientName}</span>
                          <span className="text-[10px] text-gray-300">({g.invoices.length})</span>
                          <div className="flex-1 h-px bg-gray-100" />
                          <span className="text-[11px] font-medium text-gray-600 tabular-nums">{formatCurrency(g.total)}</span>
                          <ChevronDown size={12} className={`text-gray-300 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`} />
                        </button>
                        {!collapsed && (
                          <div className="space-y-2">
                            {g.invoices.map(inv => <InvCard key={inv.id} inv={inv} color={g.color} />)}
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Month → Client view */}
                  {invoiceGrouping === 'month' && Object.entries(byMonth).sort(([a],[b]) => b.localeCompare(a)).map(([monthKey, m]) => {
                    const collapsed = collapsedInvoiceClients.has(monthKey)
                    return (
                      <div key={monthKey}>
                        <button onClick={() => { const n = new Set(collapsedInvoiceClients); collapsed ? n.delete(monthKey) : n.add(monthKey); setCollapsedInvoiceClients(n) }}
                          className="w-full flex items-center gap-2.5 px-1 py-2 hover:bg-gray-100/50 rounded transition-colors">
                          <ChevronDown size={12} className={`text-gray-300 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`} />
                          <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-gray-500">{m.monthLabel}</span>
                          <span className="text-[10px] text-gray-300">({m.clients.reduce((s,c) => s + c.invoices.length, 0)})</span>
                          <div className="flex-1 h-px bg-gray-100" />
                          <span className="text-[11px] font-medium text-gray-600 tabular-nums">{formatCurrency(m.total)}</span>
                        </button>
                        {!collapsed && (
                          <div className="space-y-3">
                            {m.clients.map(c => (
                              <div key={c.key}>
                                <div className="flex items-center gap-2 px-1 mb-1.5">
                                  <span className="w-[5px] h-[5px] rounded" style={{ background: c.color }} />
                                  <span className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.04em]">{c.clientName}</span>
                                </div>
                                <div className="space-y-2">
                                  {c.invoices.map(inv => <InvCard key={inv.id} inv={inv} color={c.color} />)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })() : (
              <div className={`${T.card} text-center py-12`}>
                <div className="w-14 h-14 rounded bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-4">
                  <FileText size={22} className="text-gray-300" />
                </div>
                <p className="text-gray-500 text-[13px] font-medium">No invoices yet</p>
                <p className="text-gray-400 text-xs mt-1.5">Click "New Invoice" to submit your first invoice</p>
              </div>
            )}
          </div>
        )}

        {/* ====== HISTORY ====== */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            {/* Month Navigator + Filter */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <WeekNav week={historyRange}
                onPrev={() => { const d = new Date(historyMonth); d.setMonth(d.getMonth() - 1); setHistoryMonth(d) }}
                onNext={() => { const d = new Date(historyMonth); d.setMonth(d.getMonth() + 1); setHistoryMonth(d) }}
              />
              <div className="inline-flex items-center border border-gray-200 rounded overflow-hidden bg-white">
                {([['all', 'All'], ['time', 'Time'], ['expenses', 'Exp'], ['invoices', 'Inv']] as const).map(([key, label]) => (
                  <button key={key} onClick={() => setHistoryFilter(key)}
                    className={`px-3 py-1.5 text-[11px] font-medium transition-colors border-r border-gray-200 last:border-r-0 ${
                      historyFilter === key ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-1 bg-gray-200 border border-gray-200 rounded overflow-hidden">
              {[
                { label: 'Hours logged', value: historyTotals.totalHours.toFixed(1) + 'h' },
                { label: 'Expenses', value: formatCurrency(historyTotals.totalExpenses) },
                { label: 'Invoiced', value: formatCurrency(historyTotals.totalInvoiced) },
              ].map(card => (
                <div key={card.label} className="bg-white px-4 py-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-gray-400 mb-1">{card.label}</p>
                  <p className="text-[18px] font-medium text-gray-900 tabular-nums">{card.value}</p>
                </div>
              ))}
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={22} className="text-gray-700 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {/* TIME ENTRIES — Collapsible Weeks */}
                {(historyFilter === 'all' || historyFilter === 'time') && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Timer size={13} className="text-gray-700" />
                      <h2 className={T.sectionTitle}>Timesheet Entries</h2>
                      <span className="text-[11px] text-gray-300 ml-1 tabular-nums">{historyTotals.totalHours.toFixed(1)}h total</span>
                    </div>
                    {historyTimeByWeek.length > 0 ? (
                      <div className="space-y-2.5">
                        {historyTimeByWeek.map(([weekKey, week], weekIdx) => {
                          const isExpanded = expandedHistoryWeeks.has(weekKey)
                          // Build project summary for collapsed view
                          const projectSummary: Record<string, { name: string; clientName: string; hours: number; clientId: string }> = {}
                          week.entries.forEach((e: any) => {
                            const a = assignments.find(a => a.project_id === e.project_id)
                            const pid = e.project_id
                            if (!projectSummary[pid]) projectSummary[pid] = { name: a?.project_name || 'Unknown', clientName: a?.client_name || '', hours: 0, clientId: a?.client_id || '' }
                            projectSummary[pid].hours += e.hours || 0
                          })
                          const projects = Object.values(projectSummary).sort((a, b) => b.hours - a.hours)

                          return (
                            <div key={weekKey} className={`${T.card} overflow-hidden transition-colors`}>
                              {/* Week Header — always visible, clickable */}
                              <button
                                onClick={() => setExpandedHistoryWeeks(prev => {
                                  const next = new Set(prev)
                                  if (next.has(weekKey)) next.delete(weekKey); else next.add(weekKey)
                                  return next
                                })}
                                className="w-full px-4 py-2 hover:bg-gray-50/30 transition-colors"
                              >
                                <div className="flex items-center justify-between mb-2.5">
                                  <div className="flex items-center gap-2.5">
                                    <ChevronDown size={13} className={`text-gray-300 transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                                    <span className="text-[13px] font-medium text-gray-700">{week.label}</span>
                                    <span className="text-[11px] text-gray-300 font-medium">{week.entries.length} entr{week.entries.length === 1 ? 'y' : 'ies'}</span>
                                  </div>
                                  <span className="text-[15px] font-medium text-emerald-600 tabular-nums">{week.totalHours.toFixed(1)}h</span>
                                </div>

                                {/* Chip tags — per-project colors */}
                                <div className="flex flex-wrap gap-1.5 ml-6">
                                  {projects.map((p, pi) => {
                                    const dotColor = clientColorMap[p.clientId] || CLIENT_COLORS[pi % CLIENT_COLORS.length]
                                    return (
                                      <span key={pi} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-medium"
                                        style={{ background: dotColor + '18', color: dotColor }}>
                                        <span className="w-[5px] h-[5px] rounded shrink-0" style={{ background: dotColor }} />
                                        {p.name} · {p.hours.toFixed(1)}h
                                      </span>
                                    )
                                  })}
                                </div>
                              </button>

                              {/* Expanded: Full entry list with rank-colored bars */}
                              {isExpanded && (
                                <div className="border-t border-gray-100 bg-gray-50/20 px-4 pb-4 pt-3 ml-6">
                                  <div className="space-y-2.5">
                                    {projects.map((p, pi) => {
                                      const dotColor = clientColorMap[p.clientId] || CLIENT_COLORS[pi % CLIENT_COLORS.length]
                                      const pct = (p.hours / week.totalHours) * 100
                                      const a = assignments.find(a => a.project_name === p.name)
                                      return (
                                        <div key={pi}>
                                          <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-2">
                                              <span className="w-[6px] h-[6px] rounded-sm shrink-0" style={{ background: dotColor }} />
                                              <span className="text-xs font-medium text-gray-700">{p.name}</span>
                                              {a?.client_name && <span className="text-[10px] text-gray-300">{a.client_name}</span>}
                                            </div>
                                            <span className="text-xs font-medium text-gray-800 tabular-nums">{p.hours.toFixed(1)}h</span>
                                          </div>
                                          <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
                                            <div className="h-full rounded transition-colors"
                                              style={{ width: `${pct}%`, background: dotColor, opacity: 0.8 }} />
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className={`${T.card} text-center py-12`}>
                        <p className="text-gray-400 text-[13px]">No timesheet entries for {historyRange.label}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* EXPENSES — Compact table */}
                {(historyFilter === 'all' || historyFilter === 'expenses') && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard size={13} className="text-gray-400" />
                      <h2 className={T.sectionTitle}>Expenses</h2>
                      <span className="text-[11px] text-gray-300 ml-1">{historyExpenses.length} item{historyExpenses.length !== 1 ? 's' : ''}</span>
                    </div>
                    {historyExpenses.length > 0 ? (
                      <div className={`${T.card} overflow-hidden`}>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-[10px] text-gray-400 font-medium uppercase tracking-[0.04em] border-b border-gray-100">
                              <th className="text-left py-2 px-4">Date</th>
                              <th className="text-left py-2">Description</th>
                              <th className="text-left py-2">Client</th>
                              <th className="text-left py-2">Category</th>
                              <th className="text-right py-2">Amount</th>
                              <th className="text-right py-2 px-4">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {historyExpenses.map(exp => {
                              const cat = EXPENSE_CATEGORIES.find(c => c.id === exp.category)
                              const clientName = exp.client_id ? (assignmentsByClient[exp.client_id]?.clientName || '—') : '—'
                              const receiptUrl = exp.receipt_url
                                ? supabase.storage.from('contractor-uploads').getPublicUrl(exp.receipt_url).data.publicUrl
                                : null
                              return (
                                <tr key={exp.id} className="hover:bg-gray-50/50 transition-colors">
                                  <td className="py-2 px-4 text-gray-400 whitespace-nowrap">{formatDate(exp.date)}</td>
                                  <td className="py-2 text-gray-700 font-medium">
                                    <div className="flex items-center gap-1.5">
                                      <span className="truncate max-w-[140px]">{exp.description}</span>
                                      {receiptUrl ? (
                                        <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
                                          className="text-blue-500 hover:text-blue-700 transition-colors shrink-0" title="View receipt">
                                          <Paperclip size={10} />
                                        </a>
                                      ) : null}
                                    </div>
                                  </td>
                                  <td className="py-2 text-gray-400 whitespace-nowrap">{clientName}</td>
                                  <td className="py-2 text-gray-400">{cat?.label || exp.category}</td>
                                  <td className="py-2 text-right text-gray-900 font-medium tabular-nums">{formatCurrency(exp.amount)}</td>
                                  <td className="py-2 px-4 text-right"><StatusPill status={exp.status} /></td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className={`${T.card} text-center py-10`}>
                        <p className="text-gray-400 text-[13px]">No expenses for {historyRange.label}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* INVOICES — Compact with expandable line items */}
                {(historyFilter === 'all' || historyFilter === 'invoices') && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText size={13} className="text-blue-500" />
                      <h2 className={T.sectionTitle}>Invoices</h2>
                      <span className="text-[11px] text-gray-300 ml-1">{historyInvoices.length} invoice{historyInvoices.length !== 1 ? 's' : ''}</span>
                    </div>
                    {historyInvoices.length > 0 ? (
                      <div className="space-y-2">
                        {historyInvoices.map(inv => {
                          const lines = inv.contractor_invoice_lines || inv.lines || []
                          const isExpanded = expandedHistoryInvoices.has(inv.id)
                          const clientName = inv.client_id
                            ? (assignmentsByClient[inv.client_id]?.clientName || lines[0]?.description?.split(' - ')[0] || 'Unknown')
                            : (lines[0]?.description?.split(' - ')[0] || 'General')
                          const billingMonthLabel = new Date(inv.period_start + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                          const clientColor = inv.client_id ? (clientColorMap[inv.client_id] || '#6b7280') : '#6b7280'
                          const receiptUrl = inv.receipt_url
                            ? supabase.storage.from('contractor-uploads').getPublicUrl(inv.receipt_url).data.publicUrl
                            : null
                          return (
                            <div key={inv.id} className={`${T.card} overflow-hidden`} style={{ borderLeft: `3px solid ${clientColor}` }}>
                              <button
                                onClick={() => {
                                  if (lines.length === 0) return
                                  setExpandedHistoryInvoices(prev => {
                                    const next = new Set(prev)
                                    if (next.has(inv.id)) next.delete(inv.id); else next.add(inv.id)
                                    return next
                                  })
                                }}
                                className={`w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-50/30 transition-colors ${lines.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
                              >
                                {lines.length > 0 ? (
                                  <ChevronDown size={13} className={`text-gray-300 transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                                ) : (
                                  <div className="w-[13px] shrink-0" />
                                )}
                                <div className="flex-1 min-w-0 text-left">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[13px] text-gray-900 font-medium">#{inv.invoice_number}</span>
                                    <span className="text-xs font-medium text-emerald-600 bg-gray-50 px-1.5 py-0.5 rounded">{clientName}</span>
                                    {receiptUrl ? (
                                      <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
                                        onClick={e => e.stopPropagation()}
                                        className="text-blue-500 hover:text-blue-700 transition-colors shrink-0" title="View attachment">
                                        <Paperclip size={10} />
                                      </a>
                                    ) : null}
                                  </div>
                                  <p className="text-[11px] text-gray-400 mt-0.5">{billingMonthLabel}</p>
                                </div>
                                <span className="text-[15px] font-medium text-gray-900 tabular-nums shrink-0">{formatCurrency(inv.total_amount)}</span>
                                <div className="shrink-0"><StatusPill status={inv.status} /></div>
                              </button>
                              {isExpanded && lines.length > 0 && (
                                <div className="border-t border-gray-100 bg-gray-50/30 px-4 py-3">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="text-[10px] text-gray-400 font-medium uppercase tracking-[0.04em]">
                                        <th className="text-left pb-1.5 pl-7">Description</th>
                                        <th className="text-right pb-1.5">Hours</th>
                                        <th className="text-right pb-1.5">Alloc</th>
                                        <th className="text-right pb-1.5">Amount</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100/80">
                                      {lines.map((l: any, li: number) => (
                                        <tr key={li}>
                                          <td className="py-2 text-gray-600 pl-7">{l.description}</td>
                                          <td className="py-2 text-right text-gray-400 tabular-nums">{l.hours ? `${Number(l.hours).toFixed(1)}h` : '—'}</td>
                                          <td className="py-2 text-right text-gray-400 tabular-nums">{l.allocation_pct ? `${l.allocation_pct}%` : '—'}</td>
                                          <td className="py-2 text-right text-gray-800 font-medium tabular-nums">{l.amount ? formatCurrency(l.amount) : '—'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className={`${T.card} text-center py-10`}>
                        <p className="text-gray-400 text-[13px]">No invoices for {historyRange.label}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Empty state when all filtered sections are empty */}
                {historyFilter === 'all' && historyTime.length === 0 && historyExpenses.length === 0 && historyInvoices.length === 0 && (
                  <div className={`${T.card} text-center py-12`}>
                    <div className="w-14 h-14 rounded bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-4">
                      <History size={22} className="text-gray-300" />
                    </div>
                    <p className="text-gray-500 text-[13px] font-medium">No submissions for {historyRange.label}</p>
                    <p className="text-gray-400 text-xs mt-1.5">Try navigating to a different month</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ====== ANALYTICS ====== */}
        {activeTab === 'analytics' && (
          <div className="space-y-5">
            {/* Date Range — Dropdown */}
            {(() => {
              const yr = new Date().getFullYear()
              const currentQ = Math.floor(new Date().getMonth() / 3)
              const presetGroups = [
                { label: 'Recent', options: [
                  { value: 'this_week', label: 'This Week' },
                  { value: 'this_month', label: 'This Month' },
                  { value: 'last_month', label: 'Last Month' },
                ]},
                { label: `${yr} Quarters`, options: [
                  { value: 'q1', label: `Q1 ${yr}` },
                  { value: 'q2', label: `Q2 ${yr}` },
                  { value: 'q3', label: `Q3 ${yr}` },
                  { value: 'q4', label: `Q4 ${yr}` },
                  { value: 'last_quarter', label: 'Last Quarter' },
                ]},
                { label: 'Year', options: [
                  { value: 'ytd', label: `YTD ${yr}` },
                  { value: 'last_year', label: `${yr - 1} (Full Year)` },
                ]},
                { label: 'Other', options: [
                  { value: 'custom', label: 'Custom Range...' },
                ]},
              ]
              const allOptions = presetGroups.flatMap(g => g.options)
              const currentLabel = allOptions.find(o => o.value === analyticsPreset)?.label || analyticsRange.label
              return (
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <select
                      value={analyticsPreset}
                      onChange={e => setAnalyticsPreset(e.target.value as any)}
                      className="appearance-none pl-3 pr-8 py-1.5 bg-white border border-gray-200 rounded text-[12px] font-medium text-gray-700 focus:outline-none focus:border-gray-900 cursor-pointer transition-colors"
                    >
                      {presetGroups.map(group => (
                        <optgroup key={group.label} label={group.label}>
                          {group.options.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <ChevronDown size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                  <span className="text-[11px] text-gray-400">{analyticsRange.label}</span>
                </div>
              )
            })()}

            {/* Custom Date Picker */}
            {analyticsPreset === 'custom' && (
              <div className={`${T.card} p-3 flex items-center gap-3 flex-wrap`}>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.06em]">From</label>
                  <input type="date" value={analyticsCustomStart} onChange={e => setAnalyticsCustomStart(e.target.value)} className={`${T.input} w-auto`} style={{ colorScheme: 'light' }} />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.06em]">To</label>
                  <input type="date" value={analyticsCustomEnd} onChange={e => setAnalyticsCustomEnd(e.target.value)} className={`${T.input} w-auto`} style={{ colorScheme: 'light' }} />
                </div>
              </div>
            )}

            {analyticsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={22} className="text-gray-400 animate-spin" />
              </div>
            ) : (
              <>
                {/* KPI Summary Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-gray-200 border border-gray-200 rounded overflow-hidden">
                  {[
                    { label: 'Total hours', value: analyticsKPIs.totalHours.toFixed(1) + 'h', sub: analyticsRange.granularity === 'monthly' ? `${analyticsKPIs.weekCount} months` : `${analyticsKPIs.avgWeeklyHours.toFixed(1)}h avg/wk` },
                    { label: 'Invoiced', value: formatCurrency(analyticsKPIs.totalInvoiced), sub: `${analyticsInvoices.length} invoice${analyticsInvoices.length !== 1 ? 's' : ''}` },
                    { label: 'Expenses', value: formatCurrency(analyticsKPIs.totalExpenses), sub: `${analyticsExpenses.length} item${analyticsExpenses.length !== 1 ? 's' : ''}` },
                    { label: 'Projects', value: String(analyticsKPIs.uniqueProjects), sub: `${analyticsKPIs.weekCount} weeks tracked` },
                  ].map(card => (
                    <div key={card.label} className="bg-white px-4 py-3">
                      <p className="text-[10px] font-medium uppercase tracking-[0.06em] text-gray-400 mb-1">{card.label}</p>
                      <p className="text-[18px] font-medium text-gray-900 tabular-nums">{card.value}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{card.sub}</p>
                    </div>
                  ))}
                </div>

                {/* ── WEEKLY HOURS ── */}
                {analyticsWeeklyHours.length > 0 && (
                  <div className={`${T.card} p-4`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-[13px] h-[13px] text-gray-700" />
                        <h2 className={T.sectionTitle}>{analyticsRange.granularity === 'monthly' ? 'Monthly Hours' : 'Weekly Hours'}</h2>
                      </div>
                      {analyticsProjectNames.length > 1 && (
                        <div className="inline-flex border border-gray-200 rounded overflow-hidden">
                          {(['byProject', 'total'] as const).map(mode => (
                            <button key={mode} onClick={() => setHoursChartMode(mode)}
                              className={`px-3 py-1 text-[11px] font-medium transition-colors border-r border-gray-200 last:border-r-0 ${
                                hoursChartMode === mode ? 'bg-gray-900 text-white' : 'bg-white text-gray-400 hover:text-gray-700'
                              }`}>
                              {mode === 'byProject' ? 'By Project' : 'Total'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <ResponsiveContainer width="100%" height={240}>
                      <RechartsBarChart data={analyticsWeeklyHours} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                          labelStyle={{ fontWeight: 600, color: '#1e293b', marginBottom: 4 }}
                          formatter={(value: number, name: string) => [`${value.toFixed(1)}h`, name]}
                        />
                        {hoursChartMode === 'byProject' && analyticsProjectNames.length > 1 ? (
                          analyticsProjectNames.map((name, i) => (
                            <Bar key={name} dataKey={(d: any) => d.projects?.[name] || 0} name={name}
                              stackId="hours" fill={CLIENT_COLORS[i % CLIENT_COLORS.length]}
                              radius={i === analyticsProjectNames.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                          ))
                        ) : (
                          <Bar dataKey="total" name="Total Hours" fill="#10b981" radius={[4, 4, 0, 0]} />
                        )}
                        {/* Trend line overlay */}
                        <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} fill="none"
                          dot={false} strokeDasharray="4 2" opacity={hoursChartMode === 'total' ? 0 : 0.6} />
                      </RechartsBarChart>
                    </ResponsiveContainer>
                    {hoursChartMode === 'byProject' && analyticsProjectNames.length > 1 && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 pl-2">
                        {analyticsProjectNames.map((name, i) => (
                          <div key={name} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: CLIENT_COLORS[i % CLIENT_COLORS.length] }} />
                            <span className="text-[11px] text-gray-500 font-medium">{name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── TWO-COL: EFFORT + EXPENSES ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {analyticsEffortByClient.length > 0 && (
                    <div className={`${T.card} p-4`}>
                      <div className="flex items-center gap-2 mb-3">
                        <Briefcase size={13} className="text-indigo-500" />
                        <h2 className={T.sectionTitle}>Effort by Client</h2>
                      </div>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={analyticsEffortByClient} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="hours" nameKey="name">
                            {analyticsEffortByClient.map((_, i) => (
                              <Cell key={i} fill={CLIENT_COLORS[i % CLIENT_COLORS.length]} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                            formatter={(value: number) => [`${value}h`, 'Hours']} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 mt-2">
                        {analyticsEffortByClient.map((item, i) => {
                          const total = analyticsEffortByClient.reduce((s, e) => s + e.hours, 0)
                          const pct = total > 0 ? ((item.hours / total) * 100).toFixed(0) : '0'
                          return (
                            <div key={item.name} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: CLIENT_COLORS[i % CLIENT_COLORS.length] }} />
                                <span className="text-gray-600 font-medium">{item.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-900 font-medium tabular-nums">{item.hours}h</span>
                                <span className="text-gray-400 tabular-nums w-8 text-right">{pct}%</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {analyticsExpensesByCategory.length > 0 ? (
                    <div className={`${T.card} p-4`}>
                      <div className="flex items-center gap-2 mb-3">
                        <Receipt size={13} className="text-gray-400" />
                        <h2 className={T.sectionTitle}>Expenses by Category</h2>
                      </div>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={analyticsExpensesByCategory} cx="50%" cy="50%" innerRadius={45} outerRadius={72} paddingAngle={3} dataKey="amount" nameKey="name">
                            {analyticsExpensesByCategory.map((_, i) => (
                              <Cell key={i} fill={['#f59e0b', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'][i % 6]} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                            formatter={(value: number) => [formatCurrency(value), 'Amount']} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 mt-2">
                        {analyticsExpensesByCategory.map((item, i) => {
                          const total = analyticsExpensesByCategory.reduce((s, e) => s + e.amount, 0)
                          const pct = total > 0 ? ((item.amount / total) * 100).toFixed(0) : '0'
                          return (
                            <div key={item.name} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: ['#f59e0b', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16'][i % 6] }} />
                                <span className="text-gray-600 font-medium">{item.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-900 font-medium tabular-nums">{formatCurrency(item.amount)}</span>
                                <span className="text-gray-400 tabular-nums w-8 text-right">{pct}%</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className={`${T.card} p-4 flex flex-col items-center justify-center text-center`}>
                      <div className="w-12 h-12 rounded bg-gray-50 border border-gray-100 flex items-center justify-center mb-3">
                        <Receipt size={18} className="text-gray-300" />
                      </div>
                      <p className="text-gray-400 text-[13px] font-medium">No expenses</p>
                      <p className="text-gray-300 text-xs mt-1">for this period</p>
                    </div>
                  )}
                </div>

                {/* ── INVOICE TREND ── */}
                {analyticsInvoiceTrend.some(m => m.total > 0) && (
                  <div className={`${T.card} p-4`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <DollarSign size={13} className="text-blue-500" />
                        <h2 className={T.sectionTitle}>Invoice Trend</h2>
                      </div>
                      {analyticsInvoiceClientIds.length > 1 && (
                        <div className="inline-flex items-center bg-gray-100 rounded p-0.5">
                          {(['total', 'byClient'] as const).map(mode => (
                            <button key={mode} onClick={() => setInvoiceChartMode(mode)}
                              className={`px-3 py-1 rounded text-[11px] font-medium transition-colors ${
                                invoiceChartMode === mode ? 'bg-white text-gray-900' : 'text-gray-400 hover:text-gray-600'
                              }`}>
                              {mode === 'total' ? 'Total' : 'By Client'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={analyticsInvoiceTrend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                        <defs>
                          <linearGradient id="invoiceGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                          </linearGradient>
                          {analyticsInvoiceClientIds.map((cid, i) => (
                            <linearGradient key={cid} id={`invGrad_${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={CLIENT_COLORS[i % CLIENT_COLORS.length]} stopOpacity={0.15} />
                              <stop offset="95%" stopColor={CLIENT_COLORS[i % CLIENT_COLORS.length]} stopOpacity={0} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                          tickFormatter={(v) => v === 0 ? '$0' : `$${(v / 1000).toFixed(0)}k`} />
                        <Tooltip
                          contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                          formatter={(value: number, name: string) => [formatCurrency(value), name]}
                        />
                        {invoiceChartMode === 'total' || analyticsInvoiceClientIds.length <= 1 ? (
                          <Area type="monotone" dataKey="total" name="Invoiced" stroke="#0ea5e9" strokeWidth={2.5}
                            fill="url(#invoiceGrad)" dot={(props: any) => props.payload.total > 0 ? <circle cx={props.cx} cy={props.cy} r={4} fill="#0ea5e9" stroke="#fff" strokeWidth={2} /> : <g />} />
                        ) : (
                          analyticsInvoiceClientIds.map((cid, i) => {
                            const clientName = assignmentsByClient[cid]?.clientName || cid
                            return (
                              <Area key={cid} type="monotone"
                                dataKey={(d: any) => d.byClient?.[cid] || 0}
                                name={clientName} stroke={CLIENT_COLORS[i % CLIENT_COLORS.length]} strokeWidth={2}
                                fill={`url(#invGrad_${i})`} stackId="clients"
                                dot={(props: any) => (props.payload.byClient?.[cid] || 0) > 0 ? <circle cx={props.cx} cy={props.cy} r={3} fill={CLIENT_COLORS[i % CLIENT_COLORS.length]} stroke="#fff" strokeWidth={2} /> : <g />} />
                            )
                          })
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                    {invoiceChartMode === 'byClient' && analyticsInvoiceClientIds.length > 1 && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 pl-2">
                        {analyticsInvoiceClientIds.map((cid, i) => (
                          <div key={cid} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: CLIENT_COLORS[i % CLIENT_COLORS.length] }} />
                            <span className="text-[11px] text-gray-500 font-medium">{assignmentsByClient[cid]?.clientName || cid}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── PROJECT BREAKDOWN — ranked summary, only when 2+ active projects ── */}
                {analyticsProjectNames.length > 1 && (() => {
                  const totalHrs = analyticsWeeklyHours.reduce((s, wk) => s + wk.total, 0)
                  const projectTotals = analyticsProjectNames.map((name, i) => ({
                    name,
                    hours: analyticsWeeklyHours.reduce((s, wk) => s + (wk.projects[name] || 0), 0),
                    color: CLIENT_COLORS[i % CLIENT_COLORS.length]
                  })).filter(p => p.hours > 0).sort((a, b) => b.hours - a.hours)
                  if (projectTotals.length === 0) return null
                  return (
                    <div className={`${T.card} p-4`}>
                      <div className="flex items-center gap-2 mb-4">
                        <LayoutDashboard size={13} className="text-violet-500" />
                        <h2 className={T.sectionTitle}>Project Breakdown</h2>
                        <span className="text-[11px] text-gray-400 ml-1">{analyticsRange.label}</span>
                      </div>
                      <div className="space-y-3">
                        {projectTotals.map(p => {
                          const pct = totalHrs > 0 ? (p.hours / totalHrs) * 100 : 0
                          return (
                            <div key={p.name}>
                              <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: p.color }} />
                                  <span className="text-[13px] text-gray-700 font-medium">{p.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-[13px] font-medium text-gray-900 tabular-nums">{p.hours.toFixed(1)}h</span>
                                  <span className="text-[11px] text-gray-400 tabular-nums w-8 text-right">{pct.toFixed(0)}%</span>
                                </div>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
                                <div className="h-full rounded transition-colors"
                                  style={{ width: `${pct}%`, background: p.color }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Empty state */}
                {analyticsTime.length === 0 && analyticsExpenses.length === 0 && analyticsInvoices.length === 0 && (
                  <div className={`${T.card} text-center py-12`}>
                    <div className="w-14 h-14 rounded bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-4">
                      <TrendingUp size={22} className="text-gray-300" />
                    </div>
                    <p className="text-gray-500 text-[13px] font-medium">No data for {analyticsRange.label}</p>
                    <p className="text-gray-400 text-xs mt-1.5">Try selecting a different time period</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
