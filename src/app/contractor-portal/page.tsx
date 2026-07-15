'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react'
import {
  Clock, Receipt, FileText, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle, Loader2, Upload, X, Plus, Trash2, Calendar,
  DollarSign, Send, Eye, Building2, User, FileUp, LogOut, Paperclip, File,
  ArrowRight, CircleDot, Briefcase, Timer, CreditCard, Hash, History,
  LayoutDashboard, TrendingUp, Menu, Shield, MapPin, Phone
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import OnboardingWizard from './OnboardingWizard'
import ExpensesTab from './ExpensesTab'
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Area, AreaChart, LabelList } from 'recharts'

const supabase = createClient(
  'https://jmahfgpbtjeomuepfozf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYWhmZ3BidGplb211ZXBmb3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0OTAxNzcsImV4cCI6MjA4MTA2NjE3N30.3SVDvWCGIYYHV57BpKjpDJVCZLKzuRv8B_VietQDxUQ'
)

// ============ TYPES ============
interface TeamMember {
  id: string; name: string; email: string; cost_type?: string; cost_amount?: number; company_id?: string; onboarding_status?: string; entity_name?: string
  phone?: string; address?: string; city?: string; state?: string; zip?: string; country?: string
  bank_name?: string; routing_number?: string; account_number?: string; account_type?: string
  swift_code?: string; iban?: string; bank_address?: string; intermediary_bank?: string
  nda_url?: string; mspa_url?: string; psa_schedule_url?: string; w9_url?: string; w8ben_url?: string; w8bene_url?: string
  nda_expires?: string; mspa_expires?: string; psa_expires?: string
}
interface Assignment { project_id: string; project_name: string; client_id: string; client_name: string; payment_type: string; rate: number }
interface RateCard { team_member_id: string; client_id: string; client_name: string; cost_type: string; cost_amount: number; rate: number }
interface TimeEntryForm { project_id: string; days: Record<string, string>; notes: string }
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
// The 7 dates of the week being viewed. Each day is stored as its own dated
// row, so a week crossing a month needs no special handling — Jun 30 posts to
// June and Jul 1 posts to July automatically.
const getWeekDays = (start: string) => {
  const pad = (n: number) => String(n).padStart(2, '0')
  const s0 = new Date(start + 'T00:00:00')
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(s0); d.setDate(s0.getDate() + i)
    return {
      iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      dow: d.toLocaleDateString('en-US', { weekday: 'short' }),
      dnum: d.getDate(),
      month: d.toLocaleDateString('en-US', { month: 'short' }),
      monthIdx: d.getMonth(),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
    }
  })
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
  card: "bg-white border border-gray-200 rounded-lg",
  cardHover: "bg-white border border-gray-200 rounded-lg transition-colors hover:border-blue-300",
  input: "w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-[13px] placeholder-gray-300 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors",
  select: "w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-[13px] focus:outline-none focus:border-blue-500 focus:bg-white transition-colors cursor-pointer appearance-none",
  label: "block text-[10px] font-medium uppercase tracking-[0.06em] text-gray-400 mb-1.5",
  btnPrimary: "px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2",
  btnGhost: "px-3 py-1.5 rounded-lg text-[13px] text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors border border-gray-200 hover:border-gray-300",
  sectionTitle: "text-[10px] font-medium uppercase tracking-[0.06em] text-gray-400",
}

// ============ PORTAL CSS — Blueprint skin (visual only) ============
const PORTAL_CSS = `
  input.cp-cell { width:46px; height:30px; text-align:center; font-size:13px; font-weight:500; font-variant-numeric:tabular-nums; border:1px solid transparent; border-radius:8px; background:transparent; color:#0f172a; transition:all .18s ease; outline:none; font-family:inherit; padding:0 2px; }
  input.cp-cell::placeholder { color:#d7dde5; }
  input.cp-cell:hover:not(:disabled):not(:focus) { border-color:#e2e8f0; background:#fff; }
  input.cp-cell:focus { border-color:#60a5fa; background:#fff; box-shadow:0 0 0 3px rgba(37,99,235,.06), 0 0 16px -6px rgba(37,99,235,.12); }
  input.cp-cell:disabled { color:#94a3b8; cursor:not-allowed; }
  input.cp-cell.cp-filled { color:#0f172a; font-weight:600; font-family:Archivo, sans-serif; }
  textarea.cp-note { flex:1; border:1px solid transparent; border-radius:8px; background:transparent; font-family:inherit; font-size:12px; color:#475569; outline:none; resize:none; padding:6px 9px; min-height:32px; line-height:1.5; transition:all .18s ease; width:100%; }
  textarea.cp-note::placeholder { color:#cbd5e1; }
  textarea.cp-note:hover:not(:disabled):not(:focus) { border-color:#e2e8f0; background:#fff; }
  textarea.cp-note:focus { border-color:#60a5fa; background:#fff; box-shadow:0 0 0 3px rgba(37,99,235,.06); }
  .cp-tab-active::after { content:''; position:absolute; bottom:0; left:15%; right:15%; height:16px; background:radial-gradient(60% 100% at 50% 100%, rgba(59,130,246,.25), transparent 70%); pointer-events:none; }
  .cp-chev { transition:transform .2s ease; }
  .cp-chev.cp-closed { transform:rotate(-90deg); }
  @keyframes cpPulse { 0%,100%{opacity:.5} 50%{opacity:1} }
  .cp-dot { animation:cpPulse 3s ease-in-out infinite; }
`

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
        <div className={`w-11 h-11 rounded flex items-center justify-center mb-3 transition-colors ${dragging ? 'bg-blue-100 scale-110' : 'bg-gray-100 group-hover:bg-gray-200'}`}>
          <Upload size={18} className={`transition-colors duration-200 ${dragging ? 'text-gray-700' : 'text-gray-400 group-hover:text-gray-500'}`} />
        </div>
        <p className={`text-[13px] font-medium transition-colors duration-200 ${dragging ? 'text-blue-600' : 'text-gray-500'}`}>{dragging ? 'Drop file here' : label}</p>
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
          <div className={`w-11 h-11 rounded flex items-center justify-center mb-3 transition-colors ${dragging ? 'bg-blue-100 scale-110' : 'bg-gray-100 group-hover:bg-gray-200'}`}>
            <Upload size={18} className={`transition-colors duration-200 ${dragging ? 'text-gray-700' : 'text-gray-400 group-hover:text-gray-500'}`} />
          </div>
          <p className={`text-[13px] font-medium transition-colors duration-200 ${dragging ? 'text-blue-600' : 'text-gray-500'}`}>{dragging ? 'Drop files here' : label}</p>
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
  const navBtn = "w-[26px] h-[26px] rounded-lg border border-gray-200 bg-white text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-all flex items-center justify-center"
  return (
    <div className="inline-flex items-center gap-2.5">
      <button onClick={onPrev} className={navBtn} aria-label="Previous week">
        <ChevronLeft size={14} />
      </button>
      <span style={{ fontFamily: 'Archivo, sans-serif', fontWeight: 700, fontSize: '13.5px', color: '#0f172a', letterSpacing: '0.01em' }}>{week.label}</span>
      <button onClick={onNext} className={navBtn} aria-label="Next week">
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

// ============ ANALYTICS CHART HELPERS ============
const CHART_COLORS = ['#2563eb', '#93c5fd', '#ea8a2f', '#94a3b8', '#1e3a8a', '#f0b26b', '#60a5fa']

function HoursTooltip({ active, payload, label, money }: any) {
  if (!active || !payload || payload.length === 0) return null
  const rows = payload.filter((p: any) => (p.value || 0) > 0)
  if (rows.length === 0) return null
  const total = rows.reduce((sum: number, p: any) => sum + (p.value || 0), 0)
  const fmtVal = (v: number) => (money ? formatCurrency(v) : `${Math.round(v * 10) / 10}h`)
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: '10px', padding: '10px 12px', boxShadow: '0 8px 24px -6px rgba(0,0,0,0.14), 0 1px 3px rgba(0,0,0,0.06)', minWidth: '180px' }}>
      <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>{label}</div>
      {rows.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', fontSize: '11.5px', color: '#475569', padding: '2px 0' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '2px', background: p.fill || p.color, display: 'inline-block', flexShrink: 0 }} />
            {p.name}
          </span>
          <b style={{ fontFamily: 'Archivo, sans-serif', fontVariantNumeric: 'tabular-nums', color: '#0f172a', fontWeight: 700 }}>{fmtVal(p.value || 0)}</b>
        </div>
      ))}
      {rows.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(15,23,42,0.07)', fontSize: '11.5px', fontWeight: 600, color: '#0f172a' }}>
          <span>Total</span>
          <b style={{ fontFamily: 'Archivo, sans-serif', color: '#2563eb', fontVariantNumeric: 'tabular-nums' }}>{money ? formatCurrency(total) : `${Math.round(total * 10) / 10}h`}</b>
        </div>
      )}
    </div>
  )
}

// ============ MAIN COMPONENT ============
export default function ContractorPortal() {
  const [step, setStep] = useState<'email' | 'portal'>('email')
  const [email, setEmail] = useState('')
  const [member, setMember] = useState<TeamMember | null>(null)
  const [docViewUrl, setDocViewUrl] = useState<string | null>(null)
  const [monthHours, setMonthHours] = useState(0)
  const [weekStatus, setWeekStatus] = useState<'none' | 'draft' | 'submitted'>('none')
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [rateCards, setRateCards] = useState<RateCard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'time' | 'expenses' | 'invoices' | 'history' | 'analytics' | 'profile'>('time')

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
  // Approved expense reports awaiting inclusion on a monthly invoice (Step 4)
  const [approvedReports, setApprovedReports] = useState<any[]>([])
  const [includedReports, setIncludedReports] = useState<Set<string>>(new Set())
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
  const [analyticsPreset, setAnalyticsPreset] = useState<'this_week'|'this_month'|'last_month'|'q1'|'q2'|'q3'|'q4'|'last_quarter'|'ytd'|'last_year'|'custom'>('ytd')
  const [analyticsCustomStart, setAnalyticsCustomStart] = useState('')
  const [analyticsCustomEnd, setAnalyticsCustomEnd] = useState('')
  const [analyticsTime, setAnalyticsTime] = useState<any[]>([])
  const [analyticsGranularity, setAnalyticsGranularity] = useState<'auto' | 'daily' | 'weekly' | 'monthly'>('auto')
  const [analyticsInvoicesA, setAnalyticsInvoicesA] = useState<any[]>([])
  const [analyticsExpensesA, setAnalyticsExpensesA] = useState<any[]>([])
  const [analyticsDrill, setAnalyticsDrill] = useState<string | null>(null) // 'YYYY-MM' when drilled into a month
  const [isoProject, setIsoProject] = useState<string | null>(null)
  const [isoClient, setIsoClient] = useState<string | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [hoursChartMode, setHoursChartMode] = useState<'total' | 'byProject'>('byProject')

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

  // ============ AUTH: GOOGLE SSO ============
  // The login button calls /api/contractor-auth/start. The server validates
  // the email exists in team_members, then returns a Google OAuth URL. We
  // redirect the browser to Google. After Google authenticates the user,
  // they get sent to /api/contractor-auth/callback which sets a session
  // cookie and redirects back to /contractor-portal.

  const handleSignIn = async () => {
    const typedEmail = email.trim().toLowerCase()
    if (!typedEmail) { setError('Please enter your email'); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/contractor-auth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: typedEmail })
      })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setError(data.error || 'Login could not be started. Try again.')
        setLoading(false)
        return
      }
      // Hand off to Google. Browser navigates away.
      window.location.href = data.url
    } catch (err) {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await fetch('/api/contractor-auth/logout', { method: 'POST' })
    } catch { /* ignore */ }
    setStep('email'); setMember(null); setAssignments([]); setRateCards([]); setEmail(''); setError(null)
  }

  // On mount: check if a session cookie exists. If yes, load the portal
  // for that contractor. If no, show the login screen. Also surface any
  // ?auth_error=... query param from a failed callback redirect.
  useEffect(() => {
    let mounted = true
    const init = async () => {
      // Check for redirect-with-error from /api/contractor-auth/callback
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        const authError = params.get('auth_error')
        if (authError) {
          setError(authError)
          // Clean the URL so the error doesn't persist on refresh
          window.history.replaceState({}, '', window.location.pathname)
        }
      }

      try {
        const res = await fetch('/api/contractor-auth/me', { method: 'GET' })
        if (!mounted) return
        if (res.status === 401) return // not logged in, show login screen
        const data = await res.json()
        if (data?.authenticated && data?.contractor?.email) {
          setEmail(data.contractor.email)
          await lookupEmail(data.contractor.email)
        }
      } catch {
        // Network error — let user log in manually
      }
    }
    init()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ============ LOOKUP EMAIL ============
  // Called AFTER authentication has succeeded. Loads all the contractor's data.
  // The `emailArg` parameter lets us call this with the verified email from
  // /api/contractor-auth/me, not just the typed email.
  const lookupEmail = async (emailArg?: string) => {
    const lookupValue = (emailArg ?? email).trim().toLowerCase()
    if (!lookupValue) { setError('Please enter your email'); return }
    setLoading(true); setError(null)
    try {
      const { data: md, error: me } = await supabase.from('team_members').select('id, name, email, cost_type, cost_amount, company_id, phone, address, city, state, zip, country, bank_name, routing_number, account_number, account_type, swift_code, iban, bank_address, intermediary_bank, nda_url, mspa_url, psa_schedule_url, w9_url, nda_expires, mspa_expires, psa_expires, onboarding_status, w8ben_url, w8bene_url').eq('email', lookupValue).eq('status', 'active').single()
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

      const init: Record<string, TimeEntryForm> = {}; assigns.forEach(a => { init[a.project_id] = { project_id: a.project_id, days: {}, notes: '' } }); setTimeEntries(init)

      const { data: expData } = await supabase.from('contractor_expenses').select('*').eq('team_member_id', md.id).order('date', { ascending: false }).limit(50)
      setExpenses(expData || [])

      const { data: invData } = await supabase.from('contractor_invoices').select('*, contractor_invoice_lines(*)').eq('team_member_id', md.id).order('invoice_date', { ascending: false }).limit(20)
      setInvoices(invData || [])

      setStep('portal')
    } catch (err: any) { setError(err.message || 'Something went wrong') } finally { setLoading(false) }
  }

  // ============ LOAD TIME ENTRIES FOR WEEK ============
  // Submitted hours live in time_entries. Drafts live in the private
  // timesheet_drafts table (read via API) and NEVER touch time_entries,
  // so unsubmitted hours can't leak into Time Tracking, Reports, or Sage.
  useEffect(() => {
    if (!member || assignments.length === 0) return
    const load = async () => {
      const init: Record<string, TimeEntryForm> = {}
      assignments.forEach(a => { init[a.project_id] = { project_id: a.project_id, days: {}, notes: '' } })

      // STEP 1 — Submitted hours from time_entries (ignore any legacy draft rows)
      const { data } = await supabase.from('time_entries').select('project_id, hours, description, date, id, status').eq('contractor_id', member.id).gte('date', week.start).lte('date', week.end)
      const rows = (data || []).filter((e: any) => (e.status || 'submitted') !== 'draft')
      let canonical: any[] = []
      if (rows.length > 0) {
        // Dedupe key = project + date (one row per project per DAY)
        const byKey: Record<string, any[]> = {}
        rows.forEach((e: any) => { const k = `${e.project_id}|${e.date}`; if (!byKey[k]) byKey[k] = []; byKey[k].push(e) })
        const hasDupes = Object.values(byKey).some(arr => arr.length > 1)
        canonical = Object.values(byKey).map(arr => arr.sort((a: any, b: any) => b.id.localeCompare(a.id))[0])
        canonical.forEach((e: any) => {
          const g = init[e.project_id]
          if (!g) return
          g.days[e.date] = String(e.hours || 0)
          if (e.description) g.notes = e.description
        })
        if (hasDupes) {
          const dupeIds = rows.filter((e: any) => !canonical.find((c: any) => c.id === e.id)).map((e: any) => e.id)
          if (dupeIds.length > 0) supabase.from('time_entries').delete().in('id', dupeIds).then(() => {})
        }
      }

      // STEP 2 — Overlay private drafts — a draft is the contractor's latest edit,
      //    so it replaces the submitted view for that project until re-submitted
      let draftRows: any[] = []
      try {
        const res = await fetch(`/api/timesheet-drafts?week_ending=${week.end}`)
        if (res.ok) { const j = await res.json(); draftRows = j.drafts || [] }
      } catch (err) { console.warn('Draft load failed:', err) }
      draftRows.forEach((d: any) => {
        const g = init[d.project_id]
        if (!g) return
        g.days = {}
        Object.entries(d.daily_hours || {}).forEach(([date, h]) => { g.days[date] = String(h) })
        if (d.note) g.notes = d.note
      })

      setTimeEntries(init)
      setExistingEntries(canonical)
      setWeekStatus(draftRows.length > 0 ? 'draft' : canonical.length > 0 ? 'submitted' : 'none')
    }
    load()
  }, [member, assignments, week.start, week.end])

  // ============ SUBMIT TIME ============
  const weekDays = getWeekDays(week.start)
  // A week locks for the contractor once it has been invoiced.
  const weekLocked = invoices.some((inv: any) =>
    ['approved', 'paid'].includes((inv.status || '').toLowerCase()) &&
    inv.period_start && inv.period_end &&
    inv.period_start <= week.start && inv.period_end >= week.end
  )

  // Month-to-date hours = all entries in the month of the week being viewed
  useEffect(() => {
    if (!member) return
    const loadMonth = async () => {
      const m = getMonthRange(weekDate)
      const { data } = await supabase.from('time_entries').select('hours')
        .eq('contractor_id', member.id).gte('date', m.start).lte('date', m.end)
      setMonthHours((data || []).reduce((s: number, e: any) => s + (e.hours || 0), 0))
    }
    loadMonth()
  }, [member, weekDate, timeSuccess])

  // Save the week. Drafts go to the private timesheet_drafts table and never
  // touch time_entries; submit writes time_entries and clears the drafts.
  const saveWeek = async (status: 'draft' | 'submitted') => {
    if (!member || submittingTime) return
    setSubmittingTime(true); setError(null)
    try {
      if (status === 'draft') {
        // Private save — one draft row per project. Admin never sees these.
        // Saving an empty grid deletes the draft row server-side.
        for (const e of Object.values(timeEntries)) {
          const daily: Record<string, number> = {}
          weekDays.forEach(d => {
            const h = parseFloat(e.days?.[d.iso] || '0')
            if (h > 0) daily[d.iso] = h
          })
          const res = await fetch('/api/timesheet-drafts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ project_id: e.project_id, week_ending: week.end, daily_hours: daily, note: e.notes || null })
          })
          if (!res.ok) {
            const j = await res.json().catch(() => ({}))
            throw new Error(j.error || 'Failed to save draft')
          }
        }
        const hasAny = Object.values(timeEntries).some(e => weekDays.some(d => parseFloat(e.days?.[d.iso] || '0') > 0))
        setWeekStatus(hasAny ? 'draft' : 'none')
        setTimeSuccess(true); setTimeout(() => setTimeSuccess(false), 3000)
        return
      }

      // SUBMIT — clean slate for this week in time_entries (idempotent).
      // Also sweeps out any legacy draft rows left from the old system.
      const { data: freshEntries } = await supabase
        .from('time_entries')
        .select('id')
        .eq('contractor_id', member.id)
        .gte('date', week.start)
        .lte('date', week.end)
      if (freshEntries && freshEntries.length > 0) {
        const { error: de } = await supabase.from('time_entries').delete().in('id', freshEntries.map((e: any) => e.id))
        if (de) throw de
      }

      // One row per project per DAY with hours > 0 — each dated correctly,
      // so a week spanning two months posts to both automatically.
      const now = new Date().toISOString()
      const entries: any[] = []
      Object.values(timeEntries).forEach(e => {
        const a = assignments.find(a => a.project_id === e.project_id)
        weekDays.forEach(d => {
          const h = parseFloat(e.days?.[d.iso] || '0')
          if (h > 0) entries.push({
            contractor_id: member.id,
            project_id: e.project_id,
            date: d.iso,
            hours: h,
            billable_hours: h,
            is_billable: true,
            bill_rate: a?.rate || 0,
            description: e.notes || null,
            company_id: member.company_id,
            status: 'submitted',
            submitted_at: now,
          })
        })
      })

      if (entries.length > 0) {
        const { error: ie } = await supabase.from('time_entries').insert(entries)
        if (ie) throw ie
      }

      // Clear this week's drafts — the submitted version is now the truth
      await Promise.all(Object.values(timeEntries).map(e =>
        fetch(`/api/timesheet-drafts?project_id=${e.project_id}&week_ending=${week.end}`, { method: 'DELETE' })
          .catch(err => console.warn('Draft cleanup failed:', err))
      ))

      const { data: newEntries } = await supabase
        .from('time_entries')
        .select('project_id, hours, description, date, id, status')
        .eq('contractor_id', member.id)
        .gte('date', week.start)
        .lte('date', week.end)
      setExistingEntries(newEntries || [])
      setWeekStatus(entries.length === 0 ? 'none' : 'submitted')

      // Notify admin ONLY on submit — drafts stay private
      const totalHours = entries.reduce((s, e) => s + e.hours, 0)
      if (totalHours > 0) {
        fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'timesheet', id: member.id, status: 'submitted', weekStart: week.start, weekEnd: week.end, hours: totalHours })
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
  // ---- approved-report reminder (Step 4) ----
  const loadApprovedReports = async () => {
    try {
      const res = await fetch('/api/expense-reports')
      if (!res.ok) return
      const j = await res.json()
      setApprovedReports((j.reports || []).filter((r: any) => r.status === 'approved' && !r.invoice_id))
    } catch (err) { console.warn('loadApprovedReports failed:', err) }
  }
  useEffect(() => { if (activeTab === 'invoices' && member) loadApprovedReports() }, [activeTab, member])

  const reportDeadline = (r: any) => {
    // Deadline: last day of the month the report was approved in
    const base = (r.approved_at || r.submitted_at || r.created_at || '').split('T')[0]
    if (!base) return { label: '', late: false }
    const [y, m] = base.split('-').map(Number)
    const end = new Date(y, m, 0) // day 0 of next month = last day of this month
    const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
    const t = new Date(); const todayStr = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
    const late = todayStr > endStr
    const days = Math.ceil((end.getTime() - t.getTime()) / 86400000)
    return { label: end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), late, days }
  }

  const includedExpensesTotal = useMemo(() =>
    Math.round(approvedReports.filter(r => includedReports.has(r.id)).reduce((s, r) => s + (r.total || 0), 0) * 100) / 100,
  [approvedReports, includedReports])

  const submitInvoice = async () => {
    if (!member) return; setSubmittingInvoice(true); setError(null)
    try {
      const enteredAmount = parseFloat(invoiceForm.amount || '0')
      if (enteredAmount + includedExpensesTotal <= 0) { setError('Please enter a valid amount'); setSubmittingInvoice(false); return }

      let receiptUrl: string | null = null
      if (invoiceFile) receiptUrl = await uploadFile(invoiceFile, 'invoices', member.id)

      const { data: inv, error: ie } = await supabase.from('contractor_invoices').insert({
        team_member_id: member.id, invoice_number: invoiceForm.invoice_number,
        invoice_date: billingMonth.end, due_date: new Date(new Date(billingMonth.end).getTime() + 30 * 86400000).toISOString().split('T')[0],
        period_start: billingMonth.start, period_end: billingMonth.end,
        total_amount: Math.round((enteredAmount + includedExpensesTotal) * 100) / 100, payment_terms: invoiceForm.payment_terms, receipt_url: receiptUrl, notes: invoiceForm.notes || null, status: 'submitted',
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

      // Attach included expense reports: generated line + report -> 'invoiced'.
      // Server-authoritative amounts; a failed attach is surfaced, not swallowed.
      const toAttach = approvedReports.filter(r => includedReports.has(r.id))
      for (const r of toAttach) {
        const res = await fetch('/api/expense-reports', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'attach_to_invoice', report_id: r.id, invoice_id: inv.id })
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          setError(`Invoice submitted, but "${r.title}" could not be attached: ${j.error || 'unknown error'}. It remains approved — add it to your next invoice.`)
        }
      }
      setIncludedReports(new Set())
      loadApprovedReports()

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
        const { data: expData } = await supabase.from('contractor_expenses').select('*').eq('team_member_id', member.id).neq('status', 'rejected').neq('status', 'draft').gte('date', historyRange.start).lte('date', historyRange.end).order('date', { ascending: false })
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
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const monthLabel = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    // Drill-down focus: one month, daily view (set by clicking a bar)
    if (analyticsDrill) {
      const [yy, mm] = analyticsDrill.split('-').map(Number)
      const s0 = new Date(yy, mm - 1, 1)
      const e0 = new Date(yy, mm, 0)
      return { start: fmt(s0), end: fmt(e0), label: monthLabel(s0), granularity: 'weekly' as const }
    }

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
  }, [analyticsPreset, analyticsCustomStart, analyticsCustomEnd, analyticsDrill])

  // ============ LOAD ANALYTICS ============
  useEffect(() => {
    if (!member || activeTab !== 'analytics') return
    const load = async () => {
      setAnalyticsLoading(true)
      try {
        // Submitted hours only — drafts live in timesheet_drafts and never appear here
        const { data: timeData } = await supabase.from('time_entries').select('id, project_id, hours, billable_hours, date, status').eq('contractor_id', member.id).gte('date', analyticsRange.start).lte('date', analyticsRange.end).order('date', { ascending: true })
        setAnalyticsTime((timeData || []).filter((e: any) => (e.status || 'submitted') !== 'draft'))
        // Invoices count in the period their billing period STARTS (KPI total always equals chart sum)
        const { data: invData } = await supabase.from('contractor_invoices').select('id, invoice_date, total_amount, status, period_start, period_end, client_id, contractor_invoice_lines(*)').eq('team_member_id', member.id).gte('period_start', analyticsRange.start).lte('period_start', analyticsRange.end).order('period_start', { ascending: true })
        setAnalyticsInvoicesA(invData || [])
        // Expenses by expense date; rejected excluded from all sums
        const { data: expData } = await supabase.from('contractor_expenses').select('id, date, category, amount, status, client_id').eq('team_member_id', member.id).gte('date', analyticsRange.start).lte('date', analyticsRange.end).order('date', { ascending: true })
        setAnalyticsExpensesA((expData || []).filter((e: any) => { const s = (e.status || '').toLowerCase(); return s !== 'rejected' && s !== 'draft' }))
      } catch (err) { console.error('Analytics load error:', err) }
      finally { setAnalyticsLoading(false) }
    }
    load()
  }, [member, activeTab, analyticsRange.start, analyticsRange.end])

  // ============ ANALYTICS COMPUTED DATA (time only) ============
  const effectiveGranularity: 'daily' | 'weekly' | 'monthly' =
    analyticsDrill ? 'daily' : analyticsGranularity === 'auto' ? (analyticsRange.granularity as 'weekly' | 'monthly') : analyticsGranularity

  // Hours bucketed by day, week, or month (local dates throughout — no UTC shift)
  const analyticsBuckets = useMemo(() => {
    if (analyticsTime.length === 0) return [] as { label: string; total: number; projects: Record<string, number> }[]
    const projectMap: Record<string, string> = {}
    assignments.forEach(a => { projectMap[a.project_id] = a.project_name })
    const localIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const buckets: Record<string, { label: string; total: number; projects: Record<string, number> }> = {}
    analyticsTime.forEach((e: any) => {
      const d = new Date(e.date + 'T00:00:00')
      let key: string, label: string
      if (effectiveGranularity === 'daily') {
        key = e.date
        label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      } else if (effectiveGranularity === 'monthly') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      } else {
        const day = d.getDay()
        const ws = new Date(d); ws.setDate(d.getDate() - day)
        key = localIso(ws)
        label = ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      }
      if (!buckets[key]) buckets[key] = { label, total: 0, projects: {} }
      const pName = projectMap[e.project_id] || 'Other'
      buckets[key].projects[pName] = (buckets[key].projects[pName] || 0) + (e.hours || 0)
      buckets[key].total += e.hours || 0
    })
    return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ key: k, ...v, total: Math.round(v.total * 10) / 10 }))
  }, [analyticsTime, assignments, effectiveGranularity])

  // Only project names with actual hours logged in the period
  const analyticsProjectNames = useMemo(() => {
    const withHours = new Set<string>()
    analyticsBuckets.forEach(b => { Object.entries(b.projects).forEach(([name, hrs]) => { if (hrs > 0) withHours.add(name) }) })
    return Array.from(withHours)
  }, [analyticsBuckets])

  // Effort distribution by client (ranked)
  const analyticsEffortByClient = useMemo(() => {
    if (analyticsTime.length === 0) return [] as { name: string; hours: number }[]
    const clientMap: Record<string, string> = {}
    assignments.forEach(a => { clientMap[a.project_id] = a.client_name || 'Unassigned' })
    const totals: Record<string, number> = {}
    analyticsTime.forEach((e: any) => {
      const client = clientMap[e.project_id] || 'Other'
      totals[client] = (totals[client] || 0) + (e.hours || 0)
    })
    return Object.entries(totals).map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 })).sort((a, b) => b.hours - a.hours)
  }, [analyticsTime, assignments])

  // Working rhythm — average hours per weekday, over days that had hours
  const analyticsWeekday = useMemo(() => {
    const names = [
      { short: 'Mon', full: 'Mondays' }, { short: 'Tue', full: 'Tuesdays' }, { short: 'Wed', full: 'Wednesdays' },
      { short: 'Thu', full: 'Thursdays' }, { short: 'Fri', full: 'Fridays' }, { short: 'Sat', full: 'Saturdays' }, { short: 'Sun', full: 'Sundays' },
    ]
    const agg: Record<number, { total: number; dates: Set<string> }> = {}
    analyticsTime.forEach((e: any) => {
      if (!((e.hours || 0) > 0)) return
      const d = new Date(e.date + 'T00:00:00')
      const dow = (d.getDay() + 6) % 7 // Mon=0 … Sun=6
      if (!agg[dow]) agg[dow] = { total: 0, dates: new Set() }
      agg[dow].total += e.hours || 0
      agg[dow].dates.add(e.date)
    })
    return names.map((n, i) => {
      const a = agg[i]
      const avg = a && a.dates.size > 0 ? a.total / a.dates.size : 0
      return { name: n.short, full: n.full, avg: Math.round(avg * 10) / 10 }
    })
  }, [analyticsTime])

  // KPIs — total hours, average per working day, busiest weekday
  const analyticsKPIs = useMemo(() => {
    const totalHours = analyticsTime.reduce((s: number, e: any) => s + (e.hours || 0), 0)
    const workingDays = new Set(analyticsTime.filter((e: any) => (e.hours || 0) > 0).map((e: any) => e.date)).size
    const avgPerDay = workingDays > 0 ? totalHours / workingDays : 0
    const busiest = analyticsWeekday.reduce((best, d) => (d.avg > best.avg ? d : best), { name: '—', full: '—', avg: 0 })
    return { totalHours, workingDays, avgPerDay, busiest }
  }, [analyticsTime, analyticsWeekday])

  // ============ ANALYTICS — EARNINGS & EXPENSES ============
  const clientNameById = useMemo(() => {
    const m: Record<string, string> = {}
    assignments.forEach(a => { if (a.client_id) m[a.client_id] = a.client_name || 'Unassigned' })
    return m
  }, [assignments])

  // Invoiced per month, split by client via invoice lines (fallback: invoice client, then Other)
  const invoicedBuckets = useMemo(() => {
    if (analyticsInvoicesA.length === 0) return [] as { key: string; label: string; total: number; clients: Record<string, number> }[]
    const buckets: Record<string, { label: string; total: number; clients: Record<string, number> }> = {}
    analyticsInvoicesA.forEach((inv: any) => {
      const d = new Date((inv.period_start || inv.invoice_date) + 'T00:00:00')
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      if (!buckets[key]) buckets[key] = { label, total: 0, clients: {} }
      const lines = inv.contractor_invoice_lines || []
      if (lines.length > 0) {
        lines.forEach((ln: any) => {
          const name = clientNameById[ln.client_id] || 'Other'
          buckets[key].clients[name] = (buckets[key].clients[name] || 0) + (ln.amount || 0)
          buckets[key].total += ln.amount || 0
        })
      } else {
        const name = clientNameById[inv.client_id] || 'Other'
        buckets[key].clients[name] = (buckets[key].clients[name] || 0) + (inv.total_amount || 0)
        buckets[key].total += inv.total_amount || 0
      }
    })
    return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ key: k, ...v, total: Math.round(v.total) }))
  }, [analyticsInvoicesA, clientNameById])

  const invoicedClientNames = useMemo(() => {
    const names = new Set<string>()
    invoicedBuckets.forEach(b => { Object.entries(b.clients).forEach(([n, v]) => { if (v > 0) names.add(n) }) })
    return Array.from(names)
  }, [invoicedBuckets])

  // Invoiced by client (ranked) + realized rate = invoiced ÷ hours for that client in range
  const invoicedByClient = useMemo(() => {
    const totals: Record<string, number> = {}
    invoicedBuckets.forEach(b => { Object.entries(b.clients).forEach(([n, v]) => { totals[n] = (totals[n] || 0) + v }) })
    const hoursByClient: Record<string, number> = {}
    analyticsEffortByClient.forEach(c => { hoursByClient[c.name] = c.hours })
    return Object.entries(totals)
      .map(([name, amount]) => {
        const hrs = hoursByClient[name] || 0
        return { name, amount: Math.round(amount), rate: hrs > 0 ? Math.round(amount / hrs) : null }
      })
      .sort((a, b) => b.amount - a.amount)
  }, [invoicedBuckets, analyticsEffortByClient])

  // Expenses by category (rejected already excluded at load)
  const expensesByCategory = useMemo(() => {
    if (analyticsExpensesA.length === 0) return [] as { name: string; amount: number }[]
    const cats: Record<string, number> = {}
    analyticsExpensesA.forEach((e: any) => {
      const cat = EXPENSE_CATEGORIES.find(c => c.id === e.category)?.label || e.category || 'Other'
      cats[cat] = (cats[cat] || 0) + (e.amount || 0)
    })
    return Object.entries(cats).map(([name, amount]) => ({ name, amount: Math.round(amount) })).sort((a, b) => b.amount - a.amount)
  }, [analyticsExpensesA])

  // Money KPIs — Paid = status 'paid'; Pending = total − paid; Reimbursed = expenses with status 'paid'
  const moneyKPIs = useMemo(() => {
    const totalInvoiced = invoicedBuckets.reduce((sum, b) => sum + b.total, 0)
    const paid = analyticsInvoicesA.filter((i: any) => (i.status || '').toLowerCase() === 'paid').reduce((sum: number, i: any) => sum + (i.total_amount || 0), 0)
    const totalExpenses = analyticsExpensesA.reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
    const reimbursed = analyticsExpensesA.filter((e: any) => (e.status || '').toLowerCase() === 'paid').reduce((sum: number, e: any) => sum + (e.amount || 0), 0)
    return { totalInvoiced: Math.round(totalInvoiced), paid: Math.round(paid), pending: Math.round(Math.max(0, totalInvoiced - paid)), invoiceCount: analyticsInvoicesA.length, totalExpenses: Math.round(totalExpenses), reimbursed: Math.round(reimbursed) }
  }, [invoicedBuckets, analyticsInvoicesA, analyticsExpensesA])

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
    { id: 'analytics' as const, label: 'Analytics', icon: TrendingUp },
    { id: 'profile' as const, label: 'Profile', icon: User },
  ]
  const totalTimeHours = Object.values(timeEntries).reduce((s, e) => s + Object.values(e.days || {}).reduce((t: number, v: any) => t + (parseFloat(v) || 0), 0), 0)

  // ============ LOGIN SCREEN ============
  if (step === 'email') {
    return (
      <div className="min-h-screen flex items-center justify-center p-5 relative overflow-hidden" style={{ colorScheme: 'light', background: 'linear-gradient(135deg,#1b2431 0%,#141b24 55%,#10151c 100%)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 14px)' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(80% 90% at 20% 10%, rgba(59,130,246,0.18), transparent 55%), radial-gradient(70% 80% at 85% 90%, rgba(234,138,47,0.10), transparent 55%)' }} />
        <div className="relative w-full max-w-[390px]" style={{ zIndex: 1 }}>
          {/* Logo */}
          <div className="text-center mb-7">
            <div className="inline-flex items-center justify-center mb-3.5">
              <svg width={52} height={52} viewBox="0 0 48 48" fill="none">
                <path d="M13 12 L24 35" stroke="#3b82f6" strokeWidth="5.5" strokeLinecap="round" />
                <path d="M24 35 L35 12" stroke="#ea8a2f" strokeWidth="5.5" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="text-[27px] font-extrabold tracking-tight text-white" style={{ fontFamily: "'Archivo', system-ui, sans-serif" }}>Vantage<span style={{ color: '#ea8a2f' }}>FP</span></h1>
            <p className="text-[12.5px] mt-1.5 tracking-wide" style={{ color: '#8b97a7' }}>Contractor Portal</p>
          </div>

          <div className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.98)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 30px 70px -24px rgba(0,0,0,0.6), 0 2px 8px -2px rgba(0,0,0,0.3)' }}>
            <label className={T.label}>Email address</label>
            <input 
              type="email" value={email} onChange={e => setEmail(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleSignIn()} 
              placeholder="you@company.com"
              className={`${T.input} mb-4`} 
            />
            {error && (
              <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded flex items-center gap-2.5 text-red-600 text-[13px]">
                <AlertCircle size={15} className="shrink-0" /> {error}
              </div>
            )}
            <button onClick={handleSignIn} disabled={loading} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-[14px] font-bold transition-all disabled:opacity-40" style={{ background: 'linear-gradient(135deg,#2563eb,#1e3a8a)', boxShadow: '0 12px 26px -10px rgba(37,99,235,0.6)' }}>
              {loading ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : <>Sign In <ArrowRight size={15} /></>}
            </button>
          </div>

          <p className="text-center text-[10px] mt-6 tracking-[0.14em] uppercase font-medium" style={{ color: '#5b6670' }}>Powered by Vantage</p>
        </div>
      </div>
    )
  }

  // ============ PORTAL ============
  if (member && (member.onboarding_status === 'invited' || member.onboarding_status === 'onboarding')) {
    return <OnboardingWizard member={member} onDone={() => window.location.reload()} />
  }

  return (
    <div className="min-h-screen text-gray-900" style={{ background: '#eef1f4', colorScheme: 'light', backgroundImage: 'radial-gradient(1000px 460px at 12% 0%, rgba(37,99,235,0.05), transparent 60%), linear-gradient(rgba(15,23,42,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.022) 1px, transparent 1px)', backgroundSize: '100% 100%, 26px 26px, 26px 26px', backgroundAttachment: 'fixed' }}>
      <style dangerouslySetInnerHTML={{ __html: PORTAL_CSS }} />
      {/* Top Bar */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, borderBottom: '1px solid #22303c', background: 'linear-gradient(135deg,#1b2431,#10151c)', overflow: 'hidden' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 13px)' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(70% 240% at 0% 0%, rgba(59,130,246,0.18), transparent 60%)' }} />
        <div className="max-w-[960px] mx-auto px-4 sm:px-6 relative" style={{ zIndex: 1 }}>
          <div className="flex items-center justify-between h-[56px]">
            {/* Logo + Name */}
            <div className="flex items-center gap-3">
              <svg width={22} height={22} viewBox="0 0 48 48" fill="none">
                <path d="M13 12 L24 35" stroke="#3b82f6" strokeWidth="5.5" strokeLinecap="round" />
                <path d="M24 35 L35 12" stroke="#ea8a2f" strokeWidth="5.5" strokeLinecap="round" />
              </svg>
              <span className="hidden md:inline" style={{ fontFamily: 'Archivo, sans-serif', fontWeight: 800, fontSize: '13px', letterSpacing: '0.14em', color: '#ffffff', textTransform: 'uppercase' }}>Vantage</span>
              <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.12)' }} />
              <span className="text-[12.5px] font-medium" style={{ color: '#cbd5e1', whiteSpace: 'nowrap' }}>{member?.name}</span>
            </div>

            {/* Nav Tabs */}
            <nav className="flex items-center overflow-x-auto">
              {navItems.map(item => (
                <button key={item.id} onClick={() => { setActiveTab(item.id); setError(null) }}
                  className={activeTab === item.id ? 'cp-tab-active' : undefined}
                  style={{
                    position: 'relative', display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '0 15px', height: '56px', fontSize: '12px',
                    fontWeight: activeTab === item.id ? 600 : 400,
                    color: activeTab === item.id ? '#ffffff' : '#8b97a7',
                    background: 'none', border: 'none',
                    borderBottom: activeTab === item.id ? '2px solid #3b82f6' : '2px solid transparent',
                    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color 0.15s',
                    fontFamily: 'inherit'
                  }}>
                  <item.icon size={13} style={{ color: activeTab === item.id ? '#60a5fa' : '#8b97a7' }} />
                  <span className="hidden sm:inline">{item.label}</span>
                </button>
              ))}
            </nav>

            {/* Sign out */}
            <button onClick={handleSignOut} title="Sign out" aria-label="Sign out"
              className="flex items-center justify-center rounded-lg transition-colors hover:bg-white/10 hover:text-white" style={{ color: '#8b97a7', border: '1px solid rgba(255,255,255,0.08)', width: '30px', height: '30px', flexShrink: 0 }}>
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[960px] mx-auto px-4 sm:px-6 py-6">
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

            {/* Week Nav + KPI strip */}
            <div className="v-card vUp" style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid rgba(15,23,42,0.06)', backgroundImage: 'repeating-linear-gradient(135deg, rgba(15,23,42,0.022) 0 1px, transparent 1px 12px)' }}>
                <WeekNav week={week}
                  onPrev={() => { const d = new Date(weekDate); d.setDate(d.getDate() - 7); setWeekDate(d) }}
                  onNext={() => { const d = new Date(weekDate); d.setDate(d.getDate() + 7); setWeekDate(d) }}
                />
                {(() => {
                  const st = weekLocked ? { t: 'Invoiced', c: '#475569', bg: 'rgba(148,163,184,0.12)', bd: '#cbd5e1' }
                    : weekStatus === 'submitted' ? { t: 'Submitted', c: '#1d4ed8', bg: 'rgba(37,99,235,0.07)', bd: '#bfdbfe' }
                    : weekStatus === 'draft' ? { t: 'Draft — not sent', c: '#b45309', bg: 'rgba(253,230,138,0.18)', bd: '#fde68a' }
                    : totalTimeHours > 0 ? { t: 'Unsaved', c: '#b45309', bg: 'rgba(253,230,138,0.18)', bd: '#fde68a' }
                    : { t: 'Not submitted', c: '#94a3b8', bg: 'transparent', bd: '#e2e8f0' }
                  return (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontFamily: 'Archivo, sans-serif', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '5px 10px', borderRadius: '4px', border: `1px solid ${st.bd}`, color: st.c, background: st.bg, whiteSpace: 'nowrap' }}>
                      <span className="cp-dot" style={{ width: '6px', height: '6px', borderRadius: '1.5px', background: 'currentColor' }} />
                      {st.t}
                    </span>
                  )
                })()}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                {[
                  { label: 'This week', value: totalTimeHours > 0 ? `${totalTimeHours.toFixed(1)}h` : '—', em: totalTimeHours > 0, sub: (() => { const n = Object.values(timeEntries).filter(e => Object.values(e.days || {}).some((v: any) => (parseFloat(v) || 0) > 0)).length; return n > 0 ? `across ${n} project${n === 1 ? '' : 's'}` : '' })() },
                  { label: 'Month to date', value: monthHours > 0 ? `${monthHours.toFixed(1)}h` : '—', em: false, sub: `${weekDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} · submitted` },
                  { label: 'Active projects', value: String(assignments.length), em: false, sub: (() => { const c = Object.keys(assignmentsByClient).length; return `${c} client${c === 1 ? '' : 's'}` })() },
                ].map((kpi, i) => (
                  <div key={kpi.label} style={{ position: 'relative', overflow: 'hidden', padding: '14px 20px', borderRight: i < 2 ? '1px solid rgba(15,23,42,0.06)' : 'none' }}>
                    <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>{kpi.label}</div>
                    <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: '24px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: kpi.em ? '#2563eb' : '#0f172a', marginTop: '4px' }}>{kpi.value}</div>
                    {kpi.sub ? <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>{kpi.sub}</div> : null}
                    <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '35%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5))', pointerEvents: 'none' }} />
                  </div>
                ))}
              </div>
            </div>

            {timeSuccess && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#065f46', fontSize: '13px', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '9px 14px', borderRadius: '10px' }}>
                <CheckCircle size={13} style={{ flexShrink: 0 }} /> Timesheet submitted successfully
              </div>
            )}

            {/* Daily grid */}
            <div className="v-card vUp vD2" style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid rgba(15,23,42,0.06)', backgroundImage: 'repeating-linear-gradient(135deg, rgba(15,23,42,0.022) 0 1px, transparent 1px 12px)' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>Log hours — {week.label}</span>
                {totalTimeHours > 0 && <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#64748b' }}>{totalTimeHours.toFixed(1)}h entered</span>}
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px 20px', fontSize: '10px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', background: '#f8fafc', borderBottom: '1px solid rgba(15,23,42,0.07)' }}>Project</th>
                      {weekDays.map(d => {
                        const t = new Date()
                        const todayIso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
                        const isToday = d.iso === todayIso
                        return (
                        <th key={d.iso} style={{ padding: '8px 4px', textAlign: 'center', background: isToday ? 'linear-gradient(180deg, rgba(37,99,235,0.09), rgba(37,99,235,0.04))' : d.isWeekend ? '#f1f5f9' : '#f8fafc', borderBottom: '1px solid rgba(15,23,42,0.07)', width: '54px' }}>
                          <span style={{ display: 'block', fontSize: '9.5px', fontWeight: 600, color: isToday ? '#2563eb' : '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d.dow}</span>
                          <span style={{ display: 'block', fontFamily: 'Archivo, sans-serif', fontSize: '13px', fontWeight: 700, color: isToday ? '#2563eb' : '#64748b', fontVariantNumeric: 'tabular-nums' }}>{d.dnum}</span>
                        </th>
                        )
                      })}
                      <th style={{ padding: '8px 8px', textAlign: 'center', fontSize: '10px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#f8fafc', borderBottom: '1px solid rgba(15,23,42,0.07)', borderLeft: '1px solid rgba(15,23,42,0.07)', width: '66px' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(assignmentsByClient).map(([cid, { clientName, projects }]) => {
                      const color = clientColorMap[cid] || '#9ca3af'
                      return (
                        <Fragment key={cid}>
                          {(() => {
                            const isCollapsed = collapsedClients.has(cid)
                            const clientTotal = projects.reduce((t, p) => t + Object.values(timeEntries[p.project_id]?.days || {}).reduce((sum: number, v: any) => sum + (parseFloat(v) || 0), 0), 0)
                            return (
                          <tr onClick={() => { const n = new Set(collapsedClients); if (isCollapsed) { n.delete(cid) } else { n.add(cid) } setCollapsedClients(n) }} style={{ cursor: 'pointer', userSelect: 'none' }}>
                            <td colSpan={9} style={{ padding: '6px 20px', background: '#f8fafc', borderTop: '1px solid rgba(15,23,42,0.06)', backgroundImage: 'repeating-linear-gradient(135deg, rgba(15,23,42,0.02) 0 1px, transparent 1px 12px)' }}>
                              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                  <ChevronDown size={11} className={`cp-chev ${isCollapsed ? 'cp-closed' : ''}`} style={{ color: '#94a3b8' }} />
                                  <span style={{ width: '7px', height: '7px', borderRadius: '2px', background: color, display: 'inline-block' }} />
                                  <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b' }}>{clientName}</span>
                                </span>
                                <span style={{ fontFamily: 'Archivo, sans-serif', fontSize: '11px', fontWeight: 700, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>{clientTotal > 0 ? `${clientTotal.toFixed(1)}h` : ''}</span>
                              </span>
                            </td>
                          </tr>
                            )
                          })()}
                          {!collapsedClients.has(cid) && projects.map(p => {
                            const entry = timeEntries[p.project_id]
                            const rowTotal = Object.values(entry?.days || {}).reduce((t: number, v: any) => t + (parseFloat(v) || 0), 0)
                            const hasNote = !!entry?.notes
                            return (
                              <Fragment key={p.project_id}>
                                <tr>
                                  <td style={{ padding: '0 20px', height: '44px', borderTop: '1px solid rgba(15,23,42,0.045)', fontSize: '13px', fontWeight: rowTotal > 0 ? 500 : 400, color: rowTotal > 0 ? '#0f172a' : '#94a3b8' }}>
                                    {p.project_name}
                                  </td>
                                  {weekDays.map(d => {
                                    const t = new Date()
                                    const todayIso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
                                    const isToday = d.iso === todayIso
                                    const hasVal = (parseFloat(entry?.days?.[d.iso] || '0') || 0) > 0
                                    return (
                                    <td key={d.iso} style={{ borderTop: '1px solid rgba(15,23,42,0.045)', textAlign: 'center', background: isToday ? 'rgba(37,99,235,0.035)' : d.isWeekend ? '#fafbfc' : '#fff', padding: '0 3px' }}>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        placeholder="–"
                                        disabled={weekLocked}
                                        className={`cp-cell${hasVal ? ' cp-filled' : ''}`}
                                        value={entry?.days?.[d.iso] || ''}
                                        onChange={e => {
                                          const v = e.target.value
                                          if (v === '' || /^\d*\.?\d*$/.test(v)) {
                                            setTimeEntries(prev => ({
                                              ...prev,
                                              [p.project_id]: { ...prev[p.project_id], days: { ...(prev[p.project_id]?.days || {}), [d.iso]: v } }
                                            }))
                                          }
                                        }}
                                      />
                                    </td>
                                    )
                                  })}
                                  <td style={{ borderTop: '1px solid rgba(15,23,42,0.045)', borderLeft: '1px solid rgba(15,23,42,0.06)', textAlign: 'center', fontFamily: 'Archivo, sans-serif', fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: rowTotal > 0 ? '#0f172a' : '#cbd5e1' }}>
                                    {rowTotal > 0 ? rowTotal.toFixed(1) : '—'}
                                  </td>
                                </tr>
                                {(rowTotal > 0 || hasNote) && (
                                  <tr>
                                    <td colSpan={9} style={{ padding: '0 20px 12px', background: '#fbfcfe' }}>
                                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                                        <span style={{ fontFamily: 'Archivo, sans-serif', fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c2660c', paddingTop: '8px' }}>Note</span>
                                        <textarea
                                          className="cp-note"
                                          placeholder={`What did you work on for ${p.project_name} this week?`}
                                          disabled={weekLocked}
                                          value={entry?.notes || ''}
                                          onChange={e => setTimeEntries(prev => ({ ...prev, [p.project_id]: { ...prev[p.project_id], notes: e.target.value } }))}
                                        />
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            )
                          })}
                        </Fragment>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={{ padding: '9px 20px', borderTop: '2px solid rgba(15,23,42,0.08)', background: '#f8fafc', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>Daily total</td>
                      {weekDays.map(d => {
                        const dayTotal = Object.values(timeEntries).reduce((t, e) => t + (parseFloat(e.days?.[d.iso] || '0') || 0), 0)
                        return (
                          <td key={d.iso} style={{ padding: '9px 4px', textAlign: 'center', borderTop: '2px solid rgba(15,23,42,0.08)', background: '#f8fafc', fontFamily: 'Archivo, sans-serif', fontSize: '12px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: dayTotal > 0 ? '#334155' : '#cbd5e1' }}>
                            {dayTotal > 0 ? dayTotal.toFixed(1) : '—'}
                          </td>
                        )
                      })}
                      <td style={{ padding: '9px 4px', textAlign: 'center', borderTop: '2px solid rgba(15,23,42,0.08)', borderLeft: '1px solid rgba(15,23,42,0.06)', background: '#f8fafc', fontFamily: 'Archivo, sans-serif', fontSize: '14px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#2563eb' }}>
                        {totalTimeHours > 0 ? `${totalTimeHours.toFixed(1)}h` : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {weekDays[0].monthIdx !== weekDays[6].monthIdx && (
                <div style={{ padding: '9px 20px', background: '#eff6ff', borderTop: '1px solid #dbeafe', fontSize: '11.5px', color: '#1e40af' }}>
                  This week spans two months — each day posts to its own month automatically.
                </div>
              )}
            </div>

            {/* Footer — draft / submit */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                {weekLocked
                  ? 'This week has been invoiced and is locked. Contact your administrator to make changes.'
                  : weekStatus === 'draft'
                    ? 'Draft saved — only you can see this. Submit when the week is complete.'
                    : weekStatus === 'submitted'
                      ? 'Submitted. You can still edit and re-submit until it is invoiced.'
                      : totalTimeHours > 0
                        ? `${totalTimeHours.toFixed(1)}h entered`
                        : 'Enter hours above'}
              </span>
              {!weekLocked && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => saveWeek('draft')}
                    disabled={submittingTime || totalTimeHours === 0}
                    className="transition-all hover:border-gray-300 hover:text-gray-900 active:scale-[0.97]"
                    style={{ border: '1px solid #e2e8f0', background: '#fff', color: '#475569', borderRadius: '10px', padding: '9px 16px', fontSize: '12.5px', fontWeight: 600, fontFamily: 'inherit', cursor: totalTimeHours === 0 ? 'not-allowed' : 'pointer', opacity: submittingTime || totalTimeHours === 0 ? 0.45 : 1 }}
                  >
                    Save draft
                  </button>
                  <button
                    onClick={() => saveWeek('submitted')}
                    disabled={submittingTime || totalTimeHours === 0}
                    className={T.btnPrimary}
                    style={{ borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 4px 16px -2px rgba(37,99,235,0.25)' }}
                  >
                    {submittingTime ? <><Loader2 size={13} className="animate-spin" /> Saving...</> : <><Send size={13} /> Submit week</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ====== EXPENSES ====== */}
        {activeTab === 'expenses' && member && (
          <div className="vUp">
            <ExpensesTab member={{ id: member.id, company_id: member.company_id }} assignments={assignments} legacyExpenses={expenses as any} />
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="space-y-3">
            {/* ============ APPROVED EXPENSES — INVOICE REMINDER (Step 4) ============ */}
            {approvedReports.length > 0 && (
              <div className="v-card overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(15,23,42,0.022) 0 1px, transparent 1px 12px)' }}>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">Approved expenses — add to your invoice</span>
                </div>
                <div className="px-5 py-3 space-y-3">
                  {approvedReports.map(r => {
                    const dl = reportDeadline(r)
                    const included = includedReports.has(r.id)
                    return (
                      <div key={r.id} className={`rounded-xl border p-3 space-y-2 ${dl.late ? 'border-red-200' : 'border-slate-200/80'}`}>
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="text-[12.5px] font-semibold text-slate-900 truncate">{r.title}</div>
                            <div className={`text-[10.5px] ${dl.late ? 'text-red-700' : 'text-slate-400'}`}>
                              {r.line_count} receipt{r.line_count === 1 ? '' : 's'}{dl.late ? ` · deadline was ${dl.label}` : ` · include by ${dl.label}${typeof dl.days === 'number' && dl.days >= 0 ? ` · ${dl.days} day${dl.days === 1 ? '' : 's'}` : ''}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5 flex-shrink-0">
                            <span className="font-bold text-[14px] text-slate-900 tabular-nums" style={{ fontFamily: 'Archivo, sans-serif' }}>{formatCurrency(r.total || 0)}</span>
                            {dl.late && (
                              <span className="inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.09em] px-2 py-1 rounded border text-red-700 bg-red-50 border-red-200" style={{ fontFamily: 'Archivo, sans-serif' }}>
                                <span className="w-[5px] h-[5px] rounded-[1.5px] bg-current" />Late
                              </span>
                            )}
                          </div>
                        </div>
                        {showInvoiceForm ? (
                          <button onClick={() => setIncludedReports(prev => { const next = new Set(prev); included ? next.delete(r.id) : next.add(r.id); return next })}
                            className={`w-full py-2 rounded-lg text-[12px] font-semibold border transition-colors ${included ? 'bg-blue-600 text-white border-blue-600' : dl.late ? 'bg-white text-red-700 border-red-200' : 'bg-white text-blue-700 border-blue-200'}`}>
                            {included ? `Included in this invoice — ${formatCurrency(r.total || 0)}` : `Add to this invoice — ${formatCurrency(r.total || 0)}`}
                          </button>
                        ) : (
                          <button onClick={() => { setIncludedReports(prev => new Set(prev).add(r.id)); setShowInvoiceForm(true) }}
                            className={`w-full py-2 rounded-lg text-[12px] font-semibold border ${dl.late ? 'bg-white text-red-700 border-red-200' : 'bg-white text-blue-700 border-blue-200'}`}>
                            Add to invoice now — {formatCurrency(r.total || 0)}
                          </button>
                        )}
                      </div>
                    )
                  })}
                  <p className="text-[10.5px] text-slate-400 leading-relaxed">A line item is generated for you — amount locked to the approved total. Include each approved report on an invoice by the last day of its approval month.</p>
                </div>
              </div>
            )}

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

                {includedExpensesTotal > 0 && (
                  <div className="flex items-center justify-between text-[11.5px] text-gray-500 bg-gray-50 rounded-lg px-3 py-2 mb-2">
                    <span>Labor {formatCurrency(parseFloat(invoiceForm.amount || '0') || 0)} + Expenses {formatCurrency(includedExpensesTotal)}</span>
                    <span className="font-semibold text-gray-900 tabular-nums" style={{ fontFamily: 'Archivo, sans-serif' }}>Total {formatCurrency((parseFloat(invoiceForm.amount || '0') || 0) + includedExpensesTotal)}</span>
                  </div>
                )}
                <button onClick={submitInvoice} disabled={submittingInvoice || !invoiceForm.invoice_number || (parseFloat(invoiceForm.amount || '0') + includedExpensesTotal) <= 0 || (contractorType !== 'pure_ls' && !invoiceForm.client_id)} className={`w-full ${T.btnPrimary} py-3`}>
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
                                  <span className="text-[15px] font-medium text-blue-600 tabular-nums">{week.totalHours.toFixed(1)}h</span>
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
                                    <span className="text-xs font-medium text-blue-600 bg-gray-50 px-1.5 py-0.5 rounded">{clientName}</span>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Controls — range + drill chip + granularity */}
            <div className="vUp" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative' }}>
                  <select
                    value={analyticsPreset}
                    onChange={e => { setAnalyticsPreset(e.target.value as any); setAnalyticsGranularity('auto'); setAnalyticsDrill(null); setIsoProject(null); setIsoClient(null) }}
                    style={{ appearance: 'none', padding: '0 30px 0 12px', height: '36px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '12px', fontWeight: 500, color: '#334155', outline: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    {(() => {
                      const yr = new Date().getFullYear()
                      return (
                        <>
                          <optgroup label="Recent">
                            <option value="this_week">This Week</option>
                            <option value="this_month">This Month</option>
                            <option value="last_month">Last Month</option>
                          </optgroup>
                          <optgroup label={`${yr} Quarters`}>
                            <option value="q1">{`Q1 ${yr}`}</option>
                            <option value="q2">{`Q2 ${yr}`}</option>
                            <option value="q3">{`Q3 ${yr}`}</option>
                            <option value="q4">{`Q4 ${yr}`}</option>
                            <option value="last_quarter">Last Quarter</option>
                          </optgroup>
                          <optgroup label="Year">
                            <option value="ytd">{`YTD ${yr}`}</option>
                            <option value="last_year">{`${yr - 1} (Full Year)`}</option>
                          </optgroup>
                          <optgroup label="Other">
                            <option value="custom">Custom Range...</option>
                          </optgroup>
                        </>
                      )
                    })()}
                  </select>
                  <ChevronDown size={12} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                </div>
                {analyticsPreset === 'custom' && !analyticsDrill && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <input type="date" value={analyticsCustomStart} onChange={e => setAnalyticsCustomStart(e.target.value)} style={{ height: '36px', padding: '0 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '12px', color: '#334155', outline: 'none', fontFamily: 'inherit' }} />
                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>–</span>
                    <input type="date" value={analyticsCustomEnd} onChange={e => setAnalyticsCustomEnd(e.target.value)} style={{ height: '36px', padding: '0 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '12px', color: '#334155', outline: 'none', fontFamily: 'inherit' }} />
                  </span>
                )}
                <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>{formatDate(analyticsRange.start)} – {formatDate(analyticsRange.end)}</span>
                {analyticsDrill && (
                  <button
                    onClick={() => setAnalyticsDrill(null)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontFamily: 'Archivo, sans-serif', fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#1d4ed8', background: 'rgba(37,99,235,0.07)', border: '1px solid #bfdbfe', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Focused: {analyticsRange.label} <X size={9} style={{ display: 'inline', verticalAlign: '-1px' }} />
                  </button>
                )}
              </div>
              <div style={{ display: 'inline-flex', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '3px', gap: '2px' }}>
                {(['daily', 'weekly', 'monthly'] as const).map(g => (
                  <button
                    key={g}
                    onClick={() => { setAnalyticsDrill(null); setAnalyticsGranularity(g) }}
                    style={{ fontFamily: 'Archivo, sans-serif', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', border: 'none', background: effectiveGranularity === g ? '#2563eb' : 'transparent', color: effectiveGranularity === g ? '#fff' : '#94a3b8', padding: '6px 14px', borderRadius: '7px', cursor: 'pointer', transition: 'all 0.18s', boxShadow: effectiveGranularity === g ? '0 2px 8px -2px rgba(37,99,235,0.4)' : 'none' }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {analyticsLoading ? (
              <div className="v-card" style={{ padding: '48px 20px', display: 'flex', justifyContent: 'center' }}>
                <Loader2 size={20} className="animate-spin" style={{ color: '#cbd5e1' }} />
              </div>
            ) : (
              <>
                {/* ---------- HOURS ---------- */}
                {analyticsTime.length === 0 ? (
                  <div className="v-card vUp" style={{ padding: '40px 20px', textAlign: 'center' }}>
                    <TrendingUp size={20} style={{ color: '#cbd5e1', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>No submitted hours for {analyticsRange.label}</p>
                    <p style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>Hours appear here after you submit a week from the Timesheet tab.</p>
                  </div>
                ) : (
                  <>
                    <div className="v-card vUp vD1" style={{ overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                        {[
                          { label: 'Total hours', value: `${(Math.round(analyticsKPIs.totalHours * 10) / 10).toFixed(1)}h`, em: true, sub: `${analyticsRange.label} · submitted` },
                          { label: 'Avg per working day', value: `${(Math.round(analyticsKPIs.avgPerDay * 10) / 10).toFixed(1)}h`, em: false, sub: `${analyticsKPIs.workingDays} working day${analyticsKPIs.workingDays === 1 ? '' : 's'} logged` },
                          { label: 'Busiest day', value: analyticsKPIs.busiest.full, em: false, sub: analyticsKPIs.busiest.avg > 0 ? `${analyticsKPIs.busiest.avg}h average` : '' },
                        ].map((kpi, i) => (
                          <div key={kpi.label} style={{ position: 'relative', overflow: 'hidden', padding: '14px 20px', borderRight: i < 2 ? '1px solid rgba(15,23,42,0.06)' : 'none' }}>
                            <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>{kpi.label}</div>
                            <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: '24px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: kpi.em ? '#2563eb' : '#0f172a', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{kpi.value}</div>
                            {kpi.sub ? <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>{kpi.sub}</div> : null}
                            <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '35%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5))', pointerEvents: 'none' }} />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="v-card vUp vD2" style={{ overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 20px', borderBottom: '1px solid rgba(15,23,42,0.06)', backgroundImage: 'repeating-linear-gradient(135deg, rgba(15,23,42,0.022) 0 1px, transparent 1px 12px)', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>
                          Hours per {effectiveGranularity === 'daily' ? 'day' : effectiveGranularity === 'monthly' ? 'month' : 'week'}{analyticsDrill ? ` — ${analyticsRange.label}` : ''}
                        </span>
                        <span style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {analyticsProjectNames.map((name, i) => (
                            <button
                              key={name}
                              onClick={() => setIsoProject(isoProject === name ? null : name)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: isoProject === name ? '#1d4ed8' : '#64748b', opacity: isoProject && isoProject !== name ? 0.35 : 1, background: isoProject === name ? 'rgba(37,99,235,0.08)' : 'transparent', border: 'none', borderRadius: '6px', padding: '2px 5px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                            >
                              <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: CHART_COLORS[i % CHART_COLORS.length], display: 'inline-block' }} />
                              {name}
                            </button>
                          ))}
                        </span>
                      </div>
                      <div style={{ padding: '16px 20px 8px' }}>
                        <ResponsiveContainer width="100%" height={240}>
                          <RechartsBarChart data={analyticsBuckets} margin={{ top: 22, right: 8, bottom: 0, left: -18 }}>
                            <CartesianGrid vertical={false} stroke="rgba(15,23,42,0.05)" />
                            <XAxis dataKey="label" tick={{ fontSize: 9.5, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 9.5, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, (dataMax: number) => Math.max(1, Math.ceil(dataMax * 1.15))]} />
                            <Tooltip content={<HoursTooltip />} cursor={{ fill: 'rgba(37,99,235,0.04)' }} />
                            {analyticsProjectNames.filter(n => !isoProject || n === isoProject).map((name, i, arr) => (
                              <Bar
                                key={name}
                                dataKey={(row: any) => row.projects[name] || 0}
                                name={name}
                                stackId="hours"
                                fill={CHART_COLORS[analyticsProjectNames.indexOf(name) % CHART_COLORS.length]}
                                radius={i === arr.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                                cursor={effectiveGranularity !== 'daily' ? 'pointer' : 'default'}
                                onClick={(row: any) => {
                                  if (effectiveGranularity !== 'daily' && row?.key) setAnalyticsDrill(String(row.key).slice(0, 7))
                                }}
                              >
                                {i === arr.length - 1 && analyticsBuckets.length <= 14 && (
                                  <LabelList
                                    dataKey={isoProject ? ((row: any) => row.projects[isoProject] || 0) : 'total'}
                                    position="top"
                                    formatter={(v: any) => (v > 0 ? Math.round(v * 10) / 10 : '')}
                                    style={{ fontFamily: 'Archivo, sans-serif', fontSize: '10px', fontWeight: 700, fill: '#334155' }}
                                  />
                                )}
                              </Bar>
                            ))}
                          </RechartsBarChart>
                        </ResponsiveContainer>
                        <div style={{ fontSize: '11px', color: '#94a3b8', paddingBottom: '8px' }}>
                          {effectiveGranularity !== 'daily' ? 'Click a bar to drill into that month · click a legend item to isolate a project.' : 'Click a legend item to isolate a project · totals move to hover beyond 14 bars.'}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {/* Working rhythm */}
                      <div className="v-card vUp vD3" style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '11px 20px', borderBottom: '1px solid rgba(15,23,42,0.06)', backgroundImage: 'repeating-linear-gradient(135deg, rgba(15,23,42,0.022) 0 1px, transparent 1px 12px)' }}>
                          <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>Working rhythm — avg by weekday</span>
                        </div>
                        <div style={{ padding: '16px 20px 12px' }}>
                          <ResponsiveContainer width="100%" height={190}>
                            <RechartsBarChart data={analyticsWeekday} margin={{ top: 22, right: 8, bottom: 0, left: -22 }}>
                              <CartesianGrid vertical={false} stroke="rgba(15,23,42,0.05)" />
                              <XAxis dataKey="name" tick={{ fontSize: 9.5, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 9.5, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, (dataMax: number) => Math.max(1, Math.ceil(dataMax * 1.15))]} />
                              <Tooltip
                                cursor={{ fill: 'rgba(37,99,235,0.04)' }}
                                content={({ active, payload }: any) => {
                                  if (!active || !payload || payload.length === 0) return null
                                  const d = payload[0]?.payload
                                  if (!d || !(d.avg > 0)) return null
                                  return (
                                    <div style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)', borderRadius: '10px', padding: '8px 11px', boxShadow: '0 8px 24px -6px rgba(0,0,0,0.14)', fontSize: '11.5px', color: '#475569' }}>
                                      {d.full}: <b style={{ fontFamily: 'Archivo, sans-serif', color: '#0f172a' }}>{d.avg}h</b> average
                                    </div>
                                  )
                                }}
                              />
                              <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                                <LabelList dataKey="avg" position="top" formatter={(v: any) => (v > 0 ? v : '')} style={{ fontFamily: 'Archivo, sans-serif', fontSize: '10px', fontWeight: 700, fill: '#334155' }} />
                                {analyticsWeekday.map((d, i) => (
                                  <Cell key={i} fill={d.avg >= 5 ? '#2563eb' : d.avg >= 2 ? '#60a5fa' : d.avg > 0 ? '#cbd5e1' : '#e2e8f0'} />
                                ))}
                              </Bar>
                            </RechartsBarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Effort by client */}
                      <div className="v-card vUp vD4" style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '11px 20px', borderBottom: '1px solid rgba(15,23,42,0.06)', backgroundImage: 'repeating-linear-gradient(135deg, rgba(15,23,42,0.022) 0 1px, transparent 1px 12px)' }}>
                          <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>Effort by client</span>
                        </div>
                        <div style={{ padding: '10px 20px 16px' }}>
                          {(() => {
                            const grand = analyticsEffortByClient.reduce((sum, c) => sum + c.hours, 0)
                            return analyticsEffortByClient.map((c, i) => {
                              const pct = grand > 0 ? Math.round((c.hours / grand) * 100) : 0
                              const color = CHART_COLORS[i % CHART_COLORS.length]
                              return (
                                <div key={c.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 160px) 1fr 64px', alignItems: 'center', gap: '12px', padding: '8px 0', borderTop: i === 0 ? 'none' : '1px solid rgba(15,23,42,0.04)' }}>
                                  <span style={{ fontSize: '12.5px', color: '#334155', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                    <span style={{ width: '7px', height: '7px', borderRadius: '2px', background: color, flexShrink: 0 }} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                                  </span>
                                  <span style={{ height: '14px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', display: 'block' }}>
                                    <span style={{ display: 'block', height: '100%', width: `${Math.max(pct, 2)}%`, background: color, borderRadius: '4px' }} />
                                  </span>
                                  <span style={{ fontFamily: 'Archivo, sans-serif', fontSize: '12px', fontWeight: 700, color: '#0f172a', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                    {c.hours}h
                                    <span style={{ display: 'block', fontSize: '10px', color: '#94a3b8', fontWeight: 400, fontFamily: 'Instrument Sans, sans-serif' }}>{pct}%</span>
                                  </span>
                                </div>
                              )
                            })
                          })()}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* ---------- EARNINGS & EXPENSES ---------- */}
                <div className="vUp" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                  <span style={{ fontFamily: 'Archivo, sans-serif', fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#64748b' }}>Earnings & Expenses</span>
                  <span style={{ flex: 1, height: '1px', background: 'rgba(15,23,42,0.08)' }} />
                </div>

                {analyticsInvoicesA.length === 0 && analyticsExpensesA.length === 0 ? (
                  <div className="v-card vUp" style={{ padding: '40px 20px', textAlign: 'center' }}>
                    <FileText size={20} style={{ color: '#cbd5e1', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>No invoices or expenses for {analyticsRange.label}</p>
                    <p style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>Invoices count in the period their billing period starts.</p>
                  </div>
                ) : (
                  <>
                    <div className="v-card vUp" style={{ overflow: 'hidden' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                        {[
                          { label: 'Total invoiced', value: formatCurrency(moneyKPIs.totalInvoiced), em: true, sub: `${moneyKPIs.invoiceCount} invoice${moneyKPIs.invoiceCount === 1 ? '' : 's'} · ${analyticsRange.label}` },
                          { label: 'Paid', value: formatCurrency(moneyKPIs.paid), em: false, sub: moneyKPIs.pending > 0 ? `${formatCurrency(moneyKPIs.pending)} pending` : 'Nothing pending' },
                          { label: 'Expenses submitted', value: formatCurrency(moneyKPIs.totalExpenses), em: false, sub: moneyKPIs.reimbursed > 0 ? `${formatCurrency(moneyKPIs.reimbursed)} reimbursed` : '' },
                        ].map((kpi, i) => (
                          <div key={kpi.label} style={{ position: 'relative', overflow: 'hidden', padding: '14px 20px', borderRight: i < 2 ? '1px solid rgba(15,23,42,0.06)' : 'none' }}>
                            <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>{kpi.label}</div>
                            <div style={{ fontFamily: 'Archivo, sans-serif', fontSize: '24px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: kpi.em ? '#2563eb' : '#0f172a', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{kpi.value}</div>
                            {kpi.sub ? <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>{kpi.sub}</div> : null}
                            <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '35%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5))', pointerEvents: 'none' }} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {invoicedBuckets.length > 0 && (
                      <div className="v-card vUp" style={{ overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 20px', borderBottom: '1px solid rgba(15,23,42,0.06)', backgroundImage: 'repeating-linear-gradient(135deg, rgba(15,23,42,0.022) 0 1px, transparent 1px 12px)', gap: '12px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>Invoiced per month</span>
                          <span style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                            {invoicedClientNames.map((name, i) => (
                              <button
                                key={name}
                                onClick={() => setIsoClient(isoClient === name ? null : name)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: isoClient === name ? '#1d4ed8' : '#64748b', opacity: isoClient && isoClient !== name ? 0.35 : 1, background: isoClient === name ? 'rgba(37,99,235,0.08)' : 'transparent', border: 'none', borderRadius: '6px', padding: '2px 5px', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                              >
                                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: CHART_COLORS[i % CHART_COLORS.length], display: 'inline-block' }} />
                                {name}
                              </button>
                            ))}
                          </span>
                        </div>
                        <div style={{ padding: '16px 20px 12px' }}>
                          <ResponsiveContainer width="100%" height={220}>
                            <RechartsBarChart data={invoicedBuckets} margin={{ top: 22, right: 8, bottom: 0, left: -4 }}>
                              <CartesianGrid vertical={false} stroke="rgba(15,23,42,0.05)" />
                              <XAxis dataKey="label" tick={{ fontSize: 9.5, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                              <YAxis tick={{ fontSize: 9.5, fill: '#94a3b8' }} axisLine={false} tickLine={false} domain={[0, (dataMax: number) => Math.max(1, Math.ceil(dataMax * 1.15))]} tickFormatter={(v: any) => `$${Math.round(v / 1000)}k`} />
                              <Tooltip content={<HoursTooltip money />} cursor={{ fill: 'rgba(37,99,235,0.04)' }} />
                              {invoicedClientNames.filter(n => !isoClient || n === isoClient).map((name, i, arr) => (
                                <Bar
                                  key={name}
                                  dataKey={(row: any) => row.clients[name] || 0}
                                  name={name}
                                  stackId="inv"
                                  fill={CHART_COLORS[invoicedClientNames.indexOf(name) % CHART_COLORS.length]}
                                  radius={i === arr.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                                >
                                  {i === arr.length - 1 && invoicedBuckets.length <= 14 && (
                                    <LabelList
                                      dataKey={isoClient ? ((row: any) => row.clients[isoClient] || 0) : 'total'}
                                      position="top"
                                      formatter={(v: any) => (v > 0 ? `$${(v / 1000).toFixed(1)}k` : '')}
                                      style={{ fontFamily: 'Archivo, sans-serif', fontSize: '10px', fontWeight: 700, fill: '#334155' }}
                                    />
                                  )}
                                </Bar>
                              ))}
                            </RechartsBarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {/* Invoiced by client + realized rate */}
                      <div className="v-card vUp" style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '11px 20px', borderBottom: '1px solid rgba(15,23,42,0.06)', backgroundImage: 'repeating-linear-gradient(135deg, rgba(15,23,42,0.022) 0 1px, transparent 1px 12px)' }}>
                          <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>Invoiced by client</span>
                        </div>
                        <div style={{ padding: '10px 20px 16px' }}>
                          {invoicedByClient.length === 0 ? (
                            <p style={{ fontSize: '12px', color: '#94a3b8', padding: '12px 0' }}>No invoices in this range.</p>
                          ) : (
                            <>
                              {(() => {
                                const grand = invoicedByClient.reduce((sum, c) => sum + c.amount, 0)
                                return invoicedByClient.map((c, i) => {
                                  const pct = grand > 0 ? Math.round((c.amount / grand) * 100) : 0
                                  const color = CHART_COLORS[i % CHART_COLORS.length]
                                  return (
                                    <div key={c.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 160px) 1fr 84px', alignItems: 'center', gap: '12px', padding: '8px 0', borderTop: i === 0 ? 'none' : '1px solid rgba(15,23,42,0.04)' }}>
                                      <span style={{ fontSize: '12.5px', color: '#334155', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                        <span style={{ width: '7px', height: '7px', borderRadius: '2px', background: color, flexShrink: 0 }} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                                      </span>
                                      <span style={{ height: '14px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', display: 'block' }}>
                                        <span style={{ display: 'block', height: '100%', width: `${Math.max(pct, 2)}%`, background: color, borderRadius: '4px' }} />
                                      </span>
                                      <span style={{ fontFamily: 'Archivo, sans-serif', fontSize: '12px', fontWeight: 700, color: '#0f172a', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                        {formatCurrency(c.amount)}
                                        <span style={{ display: 'block', fontSize: '10px', color: '#94a3b8', fontWeight: 400, fontFamily: 'Instrument Sans, sans-serif' }}>{c.rate !== null ? `$${c.rate}/h realized` : `${pct}%`}</span>
                                      </span>
                                    </div>
                                  )
                                })
                              })()}
                              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed rgba(15,23,42,0.08)', fontSize: '11px', color: '#94a3b8' }}>
                                Realized rate = invoiced ÷ hours logged for that client in range.
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Expenses by category */}
                      <div className="v-card vUp" style={{ overflow: 'hidden' }}>
                        <div style={{ padding: '11px 20px', borderBottom: '1px solid rgba(15,23,42,0.06)', backgroundImage: 'repeating-linear-gradient(135deg, rgba(15,23,42,0.022) 0 1px, transparent 1px 12px)' }}>
                          <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>Expenses by category</span>
                        </div>
                        <div style={{ padding: '10px 20px 16px' }}>
                          {expensesByCategory.length === 0 ? (
                            <p style={{ fontSize: '12px', color: '#94a3b8', padding: '12px 0' }}>No expenses in this range.</p>
                          ) : (
                            <>
                              {(() => {
                                const grand = expensesByCategory.reduce((sum, c) => sum + c.amount, 0)
                                const palette = ['#2563eb', '#60a5fa', '#93c5fd', '#cbd5e1', '#ea8a2f', '#94a3b8']
                                return expensesByCategory.map((c, i) => {
                                  const pct = grand > 0 ? Math.round((c.amount / grand) * 100) : 0
                                  const color = palette[i % palette.length]
                                  return (
                                    <div key={c.name} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 160px) 1fr 74px', alignItems: 'center', gap: '12px', padding: '8px 0', borderTop: i === 0 ? 'none' : '1px solid rgba(15,23,42,0.04)' }}>
                                      <span style={{ fontSize: '12.5px', color: '#334155', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                                        <span style={{ width: '7px', height: '7px', borderRadius: '2px', background: color, flexShrink: 0 }} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                                      </span>
                                      <span style={{ height: '14px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden', display: 'block' }}>
                                        <span style={{ display: 'block', height: '100%', width: `${Math.max(pct, 2)}%`, background: color, borderRadius: '4px' }} />
                                      </span>
                                      <span style={{ fontFamily: 'Archivo, sans-serif', fontSize: '12px', fontWeight: 700, color: '#0f172a', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                        {formatCurrency(c.amount)}
                                        <span style={{ display: 'block', fontSize: '10px', color: '#94a3b8', fontWeight: 400, fontFamily: 'Instrument Sans, sans-serif' }}>{pct}%</span>
                                      </span>
                                    </div>
                                  )
                                })
                              })()}
                              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed rgba(15,23,42,0.08)', fontSize: '11px', color: '#94a3b8' }}>
                                Invoices bucket by period start · expenses by expense date, within the selected range. Rejected expenses excluded.
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ===================== PROFILE TAB ===================== */}
        {activeTab === 'profile' && member && (
          <div className="space-y-4 pb-8">

            {/* Personal Info */}
            <div className={T.card}>
              <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                <User size={13} className="text-gray-400" />
                <h2 className={T.sectionTitle}>Personal Information</h2>
              </div>
              <div className="px-5 py-4 grid grid-cols-2 gap-4">
                <div>
                  <p className={T.label}>Full Name</p>
                  <p className="text-[13px] text-gray-900 font-medium">{member.name || '—'}</p>
                </div>
                <div>
                  <p className={T.label}>Email</p>
                  <p className="text-[13px] text-gray-900">{member.email || '—'}</p>
                </div>
                <div>
                  <p className={T.label}>Phone</p>
                  <p className="text-[13px] text-gray-900">{member.phone || <span className="text-gray-300">Not on file</span>}</p>
                </div>
                <div>
                  <p className={T.label}>Country</p>
                  <p className="text-[13px] text-gray-900">{member.country || <span className="text-gray-300">Not on file</span>}</p>
                </div>
                <div className="col-span-2">
                  <p className={T.label}>Address</p>
                  <p className="text-[13px] text-gray-900">
                    {member.address ? (
                      `${member.address}${member.city ? `, ${member.city}` : ''}${member.state ? `, ${member.state}` : ''}${member.zip ? ` ${member.zip}` : ''}`
                    ) : <span className="text-gray-300">Not on file</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Banking — ACH */}
            <div className={T.card}>
              <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                <CreditCard size={13} className="text-gray-400" />
                <h2 className={T.sectionTitle}>Banking — ACH (Domestic)</h2>
              </div>
              <div className="px-5 py-4 grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <p className={T.label}>Bank Name</p>
                  <p className="text-[13px] text-gray-900">{member.bank_name || <span className="text-gray-300">Not on file</span>}</p>
                </div>
                <div>
                  <p className={T.label}>Routing Number</p>
                  <p className="text-[13px] text-gray-900 font-mono">{member.routing_number ? `••••${member.routing_number.slice(-4)}` : <span className="text-gray-300">—</span>}</p>
                </div>
                <div>
                  <p className={T.label}>Account Number</p>
                  <p className="text-[13px] text-gray-900 font-mono">
                    {member.account_number
                      ? `••••${member.account_number.slice(-4)}`
                      : <span className="text-gray-300">—</span>}
                  </p>
                </div>
                <div>
                  <p className={T.label}>Account Type</p>
                  <p className="text-[13px] text-gray-900 capitalize">{member.account_type || <span className="text-gray-300">—</span>}</p>
                </div>
              </div>
            </div>

            {/* Banking — Wire / International */}
            {(member.swift_code || member.iban || member.bank_address || member.intermediary_bank) && (
              <div className={T.card}>
                <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                  <CreditCard size={13} className="text-blue-400" />
                  <h2 className={T.sectionTitle}>Banking — Wire / International</h2>
                </div>
                <div className="px-5 py-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className={T.label}>SWIFT / BIC</p>
                    <p className="text-[13px] text-gray-900 font-mono">{member.swift_code || <span className="text-gray-300">—</span>}</p>
                  </div>
                  <div>
                    <p className={T.label}>IBAN</p>
                    <p className="text-[13px] text-gray-900 font-mono">{member.iban || <span className="text-gray-300">—</span>}</p>
                  </div>
                  <div className="col-span-2">
                    <p className={T.label}>Bank Address</p>
                    <p className="text-[13px] text-gray-900">{member.bank_address || <span className="text-gray-300">—</span>}</p>
                  </div>
                  {member.intermediary_bank && (
                    <div className="col-span-2">
                      <p className={T.label}>Intermediary Bank</p>
                      <p className="text-[13px] text-gray-900">{member.intermediary_bank}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Legal Documents */}
            <div className={T.card}>
              <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                <Shield size={13} className="text-gray-400" />
                <h2 className={T.sectionTitle}>Legal Documents</h2>
              </div>
              <div className="px-5 py-4 space-y-3">
                {([
                  { field: 'nda_url' as const, label: 'Non-Disclosure Agreement (NDA)', expires: member.nda_expires },
                  { field: 'mspa_url' as const, label: 'Master Services & Purchase Agreement (MSPA)', expires: member.mspa_expires },
                  { field: 'psa_schedule_url' as const, label: 'PSA Schedule', expires: member.psa_expires },
                  { field: 'w9_url' as const, label: 'W-9 Tax Form', expires: null },
                  { field: 'w8ben_url' as const, label: 'W-8BEN Tax Form', expires: null },
                  { field: 'w8bene_url' as const, label: 'W-8BEN-E Tax Form', expires: null },
                ] as const).map(({ field, label, expires }) => {
                  const url = member[field]
                  if (!url && (field === 'w8ben_url' || field === 'w8bene_url')) return null
                  const isExpiringSoon = expires && new Date(expires) < new Date(Date.now() + 30 * 86400000)
                  const isExpired = expires && new Date(expires) < new Date()
                  return (
                    <div key={field} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${url ? 'bg-blue-50' : 'bg-gray-100'}`}>
                          <FileText size={14} className={url ? 'text-blue-600' : 'text-gray-300'} />
                        </div>
                        <div>
                          <p className="text-[13px] text-gray-900 font-medium">{label}</p>
                          {expires && (
                            <p className={`text-[11px] mt-0.5 ${isExpired ? 'text-red-500' : isExpiringSoon ? 'text-amber-500' : 'text-gray-400'}`}>
                              {isExpired ? 'Expired' : 'Expires'}: {new Date(expires + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          )}
                        </div>
                      </div>
                      {url ? (
                        <button
                          onClick={async () => {
                            const { data } = await supabase.storage.from('contractor-uploads').createSignedUrl(url, 3600)
                            if (data?.signedUrl) setDocViewUrl(data.signedUrl)
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 flex items-center gap-1.5 transition-colors">
                          <Eye size={12} /> View PDF
                        </button>
                      ) : (
                        <span className="text-[11px] text-gray-300 font-medium">Not uploaded</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <p className="text-center text-[11px] text-gray-300 pb-2">
              To update your information, contact your administrator.
            </p>
          </div>
        )}
      </main>

      {docViewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDocViewUrl(null)}>
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[86vh] flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="text-[13px] font-semibold text-gray-900">Document</span>
              <div className="flex gap-2">
                <a href={docViewUrl} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-blue-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-blue-50">Download</a>
                <button onClick={() => setDocViewUrl(null)} className="text-[12px] font-semibold text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50">Close</button>
              </div>
            </div>
            <iframe src={docViewUrl} className="flex-1 w-full" title="Document" />
          </div>
        </div>
      )}
    </div>
  )
}
