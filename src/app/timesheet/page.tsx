'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { 
  Clock, ChevronLeft, ChevronRight, Check, AlertCircle, 
  Building2, FolderOpen, Send, Loader2, ChevronDown, ChevronUp,
  Receipt, Camera, Upload, X, DollarSign, Car, Plane, Coffee, 
  Hotel, MapPin, Calendar, History, Sparkles, Image as ImageIcon,
  CheckCircle, FileText, MoreHorizontal, Paperclip
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jmahfgpbtjeomuepfozf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYWhmZ3BidGplb211ZXBmb3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0OTAxNzcsImV4cCI6MjA4MTA2NjE3N30.3SVDvWCGIYYHV57BpKjpDJVCZLKzuRv8B_VietQDxUQ'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ============ CONSTANTS ============
const EXPENSE_CATEGORIES = {
  travel: { label: 'Travel', icon: Plane, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  lodging: { label: 'Lodging', icon: Hotel, color: 'text-indigo-400', bg: 'bg-indigo-500/20' },
  transportation: { label: 'Transport', icon: Car, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  meal: { label: 'Meal', icon: Coffee, color: 'text-amber-400', bg: 'bg-amber-500/20' },
  other: { label: 'Other', icon: MoreHorizontal, color: 'text-slate-400', bg: 'bg-slate-500/20' },
} as const

type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES

const STATUS_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'text-slate-400', bg: 'bg-slate-500/20' },
  submitted: { label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  pending: { label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  approved: { label: 'Approved', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  rejected: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-500/20' },
  reimbursed: { label: 'Paid', color: 'text-blue-400', bg: 'bg-blue-500/20' },
}

const QUICK_ACTIONS = [
  { id: 'travel', label: 'Travel', icon: Plane, category: 'travel' as ExpenseCategory },
  { id: 'lodging', label: 'Lodging', icon: Hotel, category: 'lodging' as ExpenseCategory },
  { id: 'transportation', label: 'Transport', icon: Car, category: 'transportation' as ExpenseCategory },
  { id: 'meal', label: 'Meal', icon: Coffee, category: 'meal' as ExpenseCategory },
  { id: 'other', label: 'Other', icon: MoreHorizontal, category: 'other' as ExpenseCategory },
]

// ============ NEW V LOGO ============
const VantageLogo = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="vGrad" x1="8" y1="6" x2="32" y2="34" gradientUnits="userSpaceOnUse">
        <stop stopColor="#34d399" />
        <stop offset="1" stopColor="#059669" />
      </linearGradient>
    </defs>
    <path d="M8 6L20 34L32 6" stroke="url(#vGrad)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
)

// ============ TYPES ============
interface Assignment {
  id: string
  project_id: string
  project_name: string
  client_name: string
  service: string | null
  payment_type: string
  rate: number
}

interface TeamMember {
  id: string
  name: string
  email: string
  company_id: string
}

interface EntryData {
  project_id: string
  hours: string
  notes: string
}

interface TimeEntryHistory {
  id: string
  date: string
  hours: number
  project_name: string
  client_name: string
  status: string
  description: string | null
}

interface ExpenseClaim {
  id: string
  expense_date: string
  vendor: string | null
  amount: number
  category: string
  description: string | null
  project_name: string | null
  status: string
  receipt_url: string | null
  attachment_filename: string | null
  attachment_type: string | null
}

type MainTab = 'time' | 'expenses' | 'history'
type HistorySubTab = 'time' | 'expenses'

// ============ UTILITIES ============
const getWeekDates = (date: Date): { start: Date; end: Date; days: Date[] } => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const start = new Date(d.setDate(diff))
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    days.push(day)
  }
  return { start, end, days }
}

const formatDateRange = (start: Date, end: Date): string => {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  return `${start.toLocaleDateString('en-US', opts)} - ${end.toLocaleDateString('en-US', opts)}`
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ============ RECEIPT CAPTURE COMPONENT ============
function ReceiptCapture({ isOpen, onClose, onCapture }: { 
  isOpen: boolean; onClose: () => void
  onCapture: (data: { imageData: string; filename: string; filetype: string }) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [mode, setMode] = useState<'choose' | 'camera'>('choose')

  useEffect(() => { if (!isOpen) { stopCamera(); setMode('choose') } }, [isOpen])

  const stopCamera = () => { if (stream) { stream.getTracks().forEach(track => track.stop()); setStream(null) } }

  const startCamera = async () => {
    setMode('camera')
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      setStream(mediaStream)
      if (videoRef.current) videoRef.current.srcObject = mediaStream
      setCameraError(null)
    } catch { setCameraError('Camera access denied.'); setMode('choose') }
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current; const canvas = canvasRef.current
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d'); ctx?.drawImage(video, 0, 0)
    const imageData = canvas.toDataURL('image/jpeg', 0.8)
    setProcessing(true); stopCamera()
    setTimeout(() => { setProcessing(false); onCapture({ imageData, filename: `receipt-${Date.now()}.jpg`, filetype: 'image/jpeg' }) }, 600)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setProcessing(true)
    try { const imageData = await fileToBase64(file); onCapture({ imageData, filename: file.name, filetype: file.type }) }
    catch {} finally { setProcessing(false) }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-white/10 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Add Receipt</h2>
          <button onClick={() => { stopCamera(); onClose() }} className="p-2 text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        {mode === 'choose' ? (
          <div className="p-6 space-y-3">
            <p className="text-sm text-slate-400 mb-4">How do you want to add your receipt?</p>
            <button onClick={startCamera} className="w-full flex items-center gap-4 p-4 bg-slate-800/50 hover:bg-emerald-500/10 border border-white/[0.08] hover:border-emerald-500/30 rounded-xl transition-all">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center"><Camera size={24} className="text-emerald-400" /></div>
              <div className="text-left"><p className="font-medium text-white">Take Photo</p><p className="text-sm text-slate-400">Use camera to snap receipt</p></div>
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center gap-4 p-4 bg-slate-800/50 hover:bg-emerald-500/10 border border-white/[0.08] hover:border-emerald-500/30 rounded-xl transition-all">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center"><Upload size={24} className="text-blue-400" /></div>
              <div className="text-left"><p className="font-medium text-white">Upload File</p><p className="text-sm text-slate-400">JPEG, PNG, or PDF</p></div>
            </button>
            {processing && <div className="flex items-center justify-center gap-2 py-4 text-emerald-400"><Loader2 size={18} className="animate-spin" /><span className="text-sm">Processing...</span></div>}
          </div>
        ) : (
          <div className="relative aspect-[3/4] bg-black">
            {cameraError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8"><Camera size={48} className="text-slate-600 mb-3" /><p className="text-slate-400 text-center text-sm">{cameraError}</p></div>
            ) : (
              <>
                <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-[85%] h-[70%] border-2 border-white/30 rounded-xl relative">
                    <div className="absolute -top-px -left-px w-6 h-6 border-t-[3px] border-l-[3px] border-emerald-400 rounded-tl-lg" />
                    <div className="absolute -top-px -right-px w-6 h-6 border-t-[3px] border-r-[3px] border-emerald-400 rounded-tr-lg" />
                    <div className="absolute -bottom-px -left-px w-6 h-6 border-b-[3px] border-l-[3px] border-emerald-400 rounded-bl-lg" />
                    <div className="absolute -bottom-px -right-px w-6 h-6 border-b-[3px] border-r-[3px] border-emerald-400 rounded-br-lg" />
                  </div>
                </div>
                {processing && <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center"><div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" /><p className="text-white text-sm">Processing...</p></div>}
              </>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>
        )}
        {mode === 'camera' && !processing && (
          <div className="p-4 flex items-center justify-center gap-6">
            <button onClick={() => { stopCamera(); setMode('choose') }} className="p-3 rounded-full bg-white/10 text-white"><ChevronLeft size={20} /></button>
            <button onClick={capturePhoto} disabled={!!cameraError} className="w-16 h-16 rounded-full bg-white flex items-center justify-center disabled:opacity-30"><div className="w-12 h-12 rounded-full border-4 border-slate-900" /></button>
            <div className="w-11" />
          </div>
        )}
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/heic,application/pdf" onChange={handleFileUpload} className="hidden" />
      </div>
    </div>
  )
}

// ============ EXPENSE FORM MODAL ============
function ExpenseForm({ isOpen, onClose, onSave, initialData, receiptData, projects, saving }: {
  isOpen: boolean; onClose: () => void; onSave: (data: any, asDraft: boolean) => void
  initialData: any; receiptData?: { imageData: string; filename: string; filetype: string }
  projects: Assignment[]; saving: boolean
}) {
  const [form, setForm] = useState({ expense_date: new Date().toISOString().split('T')[0], vendor: '', amount: 0, category: 'other' as ExpenseCategory, project_id: '', description: '', ...initialData })
  useEffect(() => { if (initialData) setForm((prev: any) => ({ ...prev, ...initialData })) }, [initialData])
  const isOther = form.category === 'other'
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-slate-900 w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-hidden flex flex-col border border-white/10">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">New Expense</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {receiptData && (
            <div className="rounded-xl overflow-hidden bg-slate-800 border border-white/[0.08]">
              {receiptData.filetype === 'application/pdf' ? (
                <div className="flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center"><FileText size={20} className="text-red-400" /></div>
                  <div className="flex-1 min-w-0"><p className="text-sm text-white truncate">{receiptData.filename}</p><p className="text-xs text-slate-500">PDF Receipt</p></div>
                  <div className="px-2 py-1 bg-emerald-500/20 rounded-lg text-xs text-emerald-400 flex items-center gap-1"><CheckCircle size={12} /> Attached</div>
                </div>
              ) : (
                <div className="relative aspect-[16/9]">
                  <img src={receiptData.imageData} alt="Receipt" className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 px-2 py-1 bg-emerald-500/90 rounded-lg text-xs text-white flex items-center gap-1"><CheckCircle size={12} /> Attached</div>
                </div>
              )}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(EXPENSE_CATEGORIES).map(([key, cat]) => (
                <button key={key} onClick={() => setForm({ ...form, category: key as ExpenseCategory })}
                  className={`p-3 rounded-xl flex flex-col items-center gap-1.5 transition-all ${form.category === key ? 'bg-emerald-500/20 border-2 border-emerald-500' : 'bg-slate-800/50 border-2 border-transparent hover:border-white/10'}`}>
                  <cat.icon size={18} className={form.category === key ? 'text-emerald-400' : 'text-slate-500'} />
                  <span className={`text-[11px] ${form.category === key ? 'text-emerald-400' : 'text-slate-500'}`}>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div><label className="block text-sm font-medium text-slate-300 mb-2">Vendor / Merchant</label>
            <input type="text" value={form.vendor || ''} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="e.g. Delta Airlines, Hilton, Uber"
              className="w-full px-4 py-3 bg-slate-800/50 border border-white/[0.08] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 placeholder-slate-500" />
          </div>
          <div><label className="block text-sm font-medium text-slate-300 mb-2">Amount</label>
            <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">$</span>
              <input type="number" step="0.01" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} placeholder="0.00"
                className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-white/[0.08] rounded-xl text-white text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
            </div>
          </div>
          <div><label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
            <input type="date" value={form.expense_date || ''} onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800/50 border border-white/[0.08] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50" />
          </div>
          <div><label className="block text-sm font-medium text-slate-300 mb-2">Project</label>
            <select value={form.project_id || ''} onChange={(e) => setForm({ ...form, project_id: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800/50 border border-white/[0.08] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50">
              <option value="">Select project...</option>
              {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.project_name}</option>)}
            </select>
          </div>
          <div><label className="block text-sm font-medium text-slate-300 mb-2">Description {isOther ? <span className="text-red-400">*</span> : '(optional)'}</label>
            <textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={isOther ? 'Please describe this expense...' : 'Add notes...'} rows={2}
              className="w-full px-4 py-3 bg-slate-800/50 border border-white/[0.08] rounded-xl text-white resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 placeholder-slate-500" />
          </div>
        </div>
        <div className="p-4 border-t border-white/10 flex gap-3">
          <button onClick={() => onSave(form, true)} disabled={saving} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-colors">Save Draft</button>
          <button onClick={() => onSave(form, false)} disabled={saving || !form.amount || (isOther && !form.description)}
            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2">
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Submit
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ MAIN PAGE ============
export default function TimesheetPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [member, setMember] = useState<TeamMember | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  
  const [mainTab, setMainTab] = useState<MainTab>('time')
  const [historySubTab, setHistorySubTab] = useState<HistorySubTab>('time')
  
  const [entries, setEntries] = useState<Record<string, EntryData>>({})
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [collapsedClients, setCollapsedClients] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  
  const [showReceiptCapture, setShowReceiptCapture] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [receiptData, setReceiptData] = useState<{ imageData: string; filename: string; filetype: string } | undefined>()
  const [expenseFormData, setExpenseFormData] = useState<any>({})
  const [savingExpense, setSavingExpense] = useState(false)
  
  const [timeHistory, setTimeHistory] = useState<TimeEntryHistory[]>([])
  const [expenseHistory, setExpenseHistory] = useState<ExpenseClaim[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek])

  const groupedAssignments = useMemo(() => {
    const grouped: Record<string, Assignment[]> = {}
    assignments.forEach(a => {
      const client = a.client_name || 'Other'
      if (!grouped[client]) grouped[client] = []
      grouped[client].push(a)
    })
    return grouped
  }, [assignments])

  const totalHours = useMemo(() => {
    return Object.values(entries).reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0)
  }, [entries])

  useEffect(() => { if (member && mainTab === 'history') loadHistory() }, [member, mainTab])
  useEffect(() => { if (member && mainTab === 'expenses' && expenseHistory.length === 0) loadExpenseHistory() }, [member, mainTab])

  const loadHistory = async () => {
    if (!member) return
    setLoadingHistory(true)
    try {
      const { data: timeData } = await supabase
        .from('time_entries').select('id, date, hours, description, status, project_id')
        .eq('contractor_id', member.id).order('date', { ascending: false }).limit(50)

      if (timeData) {
        const projectIds = Array.from(new Set(timeData.map((t: any) => t.project_id).filter(Boolean)))
        let projectMap: Record<string, { name: string; client: string }> = {}
        if (projectIds.length > 0) {
          const { data: projects } = await supabase.from('projects').select('id, name, clients(name)').in('id', projectIds)
          if (projects) projects.forEach((p: any) => { projectMap[p.id] = { name: p.name, client: p.clients?.name || '' } })
        }
        setTimeHistory(timeData.map((t: any) => ({
          id: t.id, date: t.date, hours: t.hours,
          project_name: projectMap[t.project_id]?.name || 'Unknown',
          client_name: projectMap[t.project_id]?.client || '',
          status: t.status || 'pending', description: t.description
        })))
      }
      await loadExpenseHistory()
    } catch (err) { console.error('Error loading history:', err) }
    finally { setLoadingHistory(false) }
  }

  const loadExpenseHistory = async () => {
    if (!member) return
    try {
      const { data: expData } = await supabase
        .from('expense_claims').select('id, expense_date, vendor, amount, category, description, status, receipt_url, attachment_filename, attachment_type, project_id')
        .eq('team_member_id', member.id).order('expense_date', { ascending: false }).limit(50)

      if (expData) {
        const projectIds = Array.from(new Set(expData.map((e: any) => e.project_id).filter(Boolean)))
        let projectMap: Record<string, string> = {}
        if (projectIds.length > 0) {
          const { data: projects } = await supabase.from('projects').select('id, name').in('id', projectIds)
          if (projects) projects.forEach((p: any) => { projectMap[p.id] = p.name })
        }
        setExpenseHistory(expData.map((e: any) => ({
          id: e.id, expense_date: e.expense_date, vendor: e.vendor,
          amount: e.amount, category: e.category, description: e.description,
          project_name: e.project_id ? projectMap[e.project_id] || null : null,
          status: e.status, receipt_url: e.receipt_url,
          attachment_filename: e.attachment_filename, attachment_type: e.attachment_type
        })))
      }
    } catch (err) { console.error('Error loading expenses:', err) }
  }

  const lookupMember = async () => {
    if (!email.trim()) { setError('Please enter your email'); return }
    setLoading(true); setError(''); setSuccess('')
    try {
      const { data: memberData, error: memberError } = await supabase
        .from('team_members').select('id, name, email, company_id')
        .eq('email', email.trim().toLowerCase()).single()

      if (memberError || !memberData) { setError('Email not found.'); setLoading(false); return }
      setMember(memberData)

      // Get contracts for this team member
      const { data: contractsData } = await supabase
        .from('team_member_contracts')
        .select('id, client_id, contract_type, cost_rate, total_amount, baseline_hours, is_default')
        .eq('team_member_id', memberData.id)
        .eq('is_active', true)

      if (!contractsData || contractsData.length === 0) {
        // No contracts — check bill_rates for rate cards
        const { data: rateCardsData } = await supabase
          .from('bill_rates')
          .select('client_id, rate')
          .eq('team_member_id', memberData.id)
          .eq('is_active', true)

        if (!rateCardsData || rateCardsData.length === 0) { setAssignments([]); setLoading(false); return }

        // Get all active projects for rate card clients
        const rcClientIds = [...new Set(rateCardsData.map((r: any) => r.client_id).filter(Boolean))]
        const { data: rcProjects } = await supabase
          .from('projects').select('id, name, client_id')
          .in('client_id', rcClientIds).eq('status', 'active')

        if (!rcProjects || rcProjects.length === 0) { setAssignments([]); setLoading(false); return }

        // Get client names
        const rcClientIdsList = [...new Set(rcProjects.map((p: any) => p.client_id).filter(Boolean))]
        let rcClientsMap: Record<string, string> = {}
        if (rcClientIdsList.length > 0) {
          const { data: rcClients } = await supabase.from('clients').select('id, name').in('id', rcClientIdsList)
          if (rcClients) rcClients.forEach((c: any) => { rcClientsMap[c.id] = c.name })
        }

        // Build rate lookup by client for bill rate
        const rateByClient = new Map<string, number>()
        rateCardsData.forEach((r: any) => { if (r.rate > 0) rateByClient.set(r.client_id, r.rate) })

        setAssignments(rcProjects.map((p: any) => ({
          id: `rc-${p.id}`,
          project_id: p.id,
          project_name: p.name || 'Unknown Project',
          client_name: p.client_id ? rcClientsMap[p.client_id] || '' : 'Other',
          service: null,
          payment_type: 'tm',
          rate: rateByClient.get(p.client_id) || 0
        })))
        setLoading(false)
        return
      }

      // Get contract_projects links for these contracts (includes bill_rate)
      const contractIds = contractsData.map((c: any) => c.id)
      const { data: contractProjectsData } = await supabase
        .from('contract_projects')
        .select('contract_id, project_id, bill_rate')
        .in('contract_id', contractIds)

      // Get all projects for clients (for contracts without specific project links)
      const clientIds = contractsData.filter((c: any) => c.client_id).map((c: any) => c.client_id)
      let allClientProjects: any[] = []
      if (clientIds.length > 0) {
        const { data: clientProjectsData } = await supabase
          .from('projects')
          .select('id, name, client_id')
          .in('client_id', clientIds)
          .eq('status', 'active')
        allClientProjects = clientProjectsData || []
      }

      // Build project assignments
      const projectIds = new Set<string>()
      const contractByProject = new Map<string, any>()
      const billRateByProject = new Map<string, number>()

      // First add explicitly linked projects with their bill_rates
      contractProjectsData?.forEach((cp: any) => {
        projectIds.add(cp.project_id)
        const contract = contractsData.find((c: any) => c.id === cp.contract_id)
        if (contract) contractByProject.set(cp.project_id, contract)
        if (cp.bill_rate) billRateByProject.set(cp.project_id, cp.bill_rate)
      })

      // Then add all projects for clients (if contract has client but no specific projects)
      contractsData.forEach((contract: any) => {
        if (contract.client_id) {
          const contractProjects = contractProjectsData?.filter((cp: any) => cp.contract_id === contract.id) || []
          if (contractProjects.length === 0) {
            // No specific projects linked, add all projects for this client
            allClientProjects.filter((p: any) => p.client_id === contract.client_id).forEach((p: any) => {
              projectIds.add(p.id)
              if (!contractByProject.has(p.id)) contractByProject.set(p.id, contract)
            })
          }
        }
      })

      // Also handle default contracts (applies to all projects)
      const defaultContract = contractsData.find((c: any) => c.is_default)

      // ALSO check bill_rates for additional client projects not covered by contracts
      const { data: rateCardsData } = await supabase
        .from('bill_rates')
        .select('client_id, rate')
        .eq('team_member_id', memberData.id)
        .eq('is_active', true)

      if (rateCardsData && rateCardsData.length > 0) {
        const rcClientIds = [...new Set(rateCardsData.map((r: any) => r.client_id).filter(Boolean))]
        // Only fetch projects for clients not already covered
        const coveredClientIds = new Set(allClientProjects.map((p: any) => p.client_id))
        const newClientIds = rcClientIds.filter(cid => !coveredClientIds.has(cid))
        if (newClientIds.length > 0) {
          const { data: extraProjects } = await supabase
            .from('projects').select('id, name, client_id')
            .in('client_id', newClientIds).eq('status', 'active')
          if (extraProjects) {
            extraProjects.forEach((p: any) => {
              projectIds.add(p.id)
              allClientProjects.push(p)
            })
          }
        }
        // Also add projects for rate card clients that are already in allClientProjects but not in projectIds
        allClientProjects.filter((p: any) => rcClientIds.includes(p.client_id)).forEach((p: any) => {
          projectIds.add(p.id)
        })
        // Store rate card bill rates for lookup
        rateCardsData.forEach((r: any) => {
          // Apply rate card bill rate to all projects for that client
          allClientProjects.filter((p: any) => p.client_id === r.client_id).forEach((p: any) => {
            if (!billRateByProject.has(p.id) && r.rate > 0) billRateByProject.set(p.id, r.rate)
          })
        })
      }
      
      if (projectIds.size === 0) { setAssignments([]); setLoading(false); return }

      // Fetch full project details
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name, client_id')
        .in('id', Array.from(projectIds))

      // Get client names
      const allClientIds = Array.from(new Set((projectsData || []).map((p: any) => p.client_id).filter(Boolean)))
      let clientsMap: Record<string, string> = {}
      if (allClientIds.length > 0) {
        const { data: clientsData } = await supabase.from('clients').select('id, name').in('id', allClientIds)
        if (clientsData) clientsData.forEach((c: any) => { clientsMap[c.id] = c.name })
      }

      setAssignments((projectsData || []).map((p: any) => {
        const contract = contractByProject.get(p.id) || defaultContract
        const billRate = billRateByProject.get(p.id) || 0
        return {
          id: `${p.id}-${contract?.id || 'default'}`,
          project_id: p.id,
          project_name: p.name || 'Unknown Project',
          client_name: p.client_id ? clientsMap[p.client_id] : 'Other',
          service: null,
          payment_type: contract?.contract_type === 'lump_sum' ? 'lump_sum' : 'tm',
          rate: billRate
        }
      }))
    } catch (err) { console.error('Error:', err); setError('An unexpected error occurred.') }
    finally { setLoading(false) }
  }

  const toggleClient = (client: string) => {
    setCollapsedClients(prev => { const n = new Set(prev); n.has(client) ? n.delete(client) : n.add(client); return n })
  }

  const updateEntry = (projectId: string, field: 'hours' | 'notes', value: string) => {
    setEntries(prev => ({ ...prev, [projectId]: { ...prev[projectId], project_id: projectId, [field]: value } }))
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(prev => { const d = new Date(prev); d.setDate(d.getDate() + (direction === 'next' ? 7 : -7)); return d })
  }

  const handleTimeSubmit = async () => {
    if (!member || totalHours === 0) return
    setSubmitting(true); setError(''); setSuccess('')
    try {
      const assignmentMap = new Map(assignments.map(a => [a.project_id, a]))
      const entriesToInsert = Object.values(entries)
        .filter(e => parseFloat(e.hours) > 0)
        .map(e => ({
          company_id: member.company_id, contractor_id: member.id, project_id: e.project_id,
          date: weekDates.start.toISOString().split('T')[0], hours: parseFloat(e.hours),
          billable_hours: parseFloat(e.hours), // Default billable = actual
          is_billable: true, billable: true, bill_rate: assignmentMap.get(e.project_id)?.rate || 0,
          description: e.notes || null, status: 'pending'
        }))
      const { error } = await supabase.from('time_entries').insert(entriesToInsert)
      if (error) throw error
      setSuccess(`Submitted ${totalHours} hours!`); setEntries({})
    } catch (err) { console.error('Submit error:', err); setError('Failed to submit.') }
    finally { setSubmitting(false) }
  }

  const handleReceiptCapture = (data: { imageData: string; filename: string; filetype: string }) => {
    setReceiptData(data); setShowReceiptCapture(false); setShowExpenseForm(true)
  }

  const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => {
    setReceiptData(undefined)
    setExpenseFormData({ category: action.category, amount: 0, vendor: '', expense_date: new Date().toISOString().split('T')[0], project_id: assignments[0]?.project_id || '' })
    setShowReceiptCapture(true)
  }

  const handleSaveExpense = async (data: any, asDraft: boolean) => {
    if (!member) return
    setSavingExpense(true); setError('')
    try {
      const claimData: any = {
        company_id: member.company_id, team_member_id: member.id,
        expense_date: data.expense_date, vendor: data.vendor || null,
        amount: data.amount, category: data.category,
        description: data.description || null, project_id: data.project_id || null,
        receipt_url: receiptData?.imageData || null, receipt_required: true,
        attachment_filename: receiptData?.filename || null,
        attachment_type: receiptData?.filetype || null,
        payment_method: 'personal_card', billable: false,
        submitted_by_role: 'employee',
        status: asDraft ? 'draft' : 'submitted',
        submitted_at: asDraft ? null : new Date().toISOString()
      }
      const { error } = await supabase.from('expense_claims').insert(claimData)
      if (error) throw error
      setSuccess(`Expense ${asDraft ? 'saved as draft' : 'submitted for approval'}!`)
      setShowExpenseForm(false); setReceiptData(undefined); setExpenseFormData({})
      await loadExpenseHistory()
    } catch (err) { console.error('Save expense error:', err); setError('Failed to save expense.') }
    finally { setSavingExpense(false) }
  }

  const logout = () => {
    setMember(null); setAssignments([]); setEmail('')
    setEntries({}); setTimeHistory([]); setExpenseHistory([]); setMainTab('time')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header with V Logo */}
      <div className="bg-slate-900/80 backdrop-blur-xl border-b border-white/[0.08] sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-2.5">
            <VantageLogo size={36} />
            <span className="text-xl font-bold text-white tracking-tight">Vantage</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {!member ? (
          /* ============ LOGIN ============ */
          <div className="pt-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 backdrop-blur border border-emerald-500/20 mb-5">
                <Clock className="h-8 w-8 text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Time & Expenses</h1>
              <p className="text-slate-400">Submit hours and expense reports</p>
            </div>
            <div className="bg-slate-900/70 backdrop-blur-xl rounded-2xl border border-white/[0.08] p-6 shadow-xl shadow-black/20">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center border border-white/[0.05]">
                  <span className="text-slate-500 text-lg">?</span>
                </div>
                <div className="flex-1">
                  <input type="email" placeholder="Enter your email address"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && lookupMember()}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-white/[0.08] rounded-xl focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-slate-500 outline-none transition-all" />
                </div>
              </div>
              <button onClick={lookupMember} disabled={loading}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20">
                {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Looking up...</> : 'Continue'}
              </button>
              <p className="text-center text-sm text-slate-600 mt-4">Not you? Contact your administrator.</p>
            </div>
          </div>
        ) : (
          <>
            {/* Member Info */}
            <div className="bg-slate-900/70 backdrop-blur-xl rounded-2xl border border-white/[0.08] p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/30 to-emerald-600/20 rounded-full flex items-center justify-center border border-emerald-500/20">
                  <span className="text-emerald-400 font-semibold text-sm">
                    {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">{member.name}</p>
                  <p className="text-sm text-slate-400">{member.email}</p>
                </div>
                <button onClick={logout} className="text-sm text-slate-500 hover:text-white transition-colors">Sign out</button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-slate-900/70 backdrop-blur-xl rounded-xl border border-white/[0.08] mb-4">
              {([
                { key: 'time' as MainTab, icon: Clock, label: 'Time' },
                { key: 'expenses' as MainTab, icon: Receipt, label: 'Expenses' },
                { key: 'history' as MainTab, icon: History, label: 'History' },
              ]).map(tab => (
                <button key={tab.key} onClick={() => { setMainTab(tab.key); setError(''); setSuccess('') }}
                  className={`flex-1 py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2 text-sm ${
                    mainTab === tab.key ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-400 hover:text-white'
                  }`}>
                  <tab.icon size={16} /> {tab.label}
                </button>
              ))}
            </div>

            {/* TIME TAB */}
            {mainTab === 'time' && (
              <>
                {assignments.length === 0 ? (
                  <div className="text-center py-12">
                    <FolderOpen className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">No projects assigned yet.</p>
                    <p className="text-slate-500 text-sm mt-1">Contact your administrator.</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-slate-900/70 backdrop-blur-xl rounded-2xl border border-white/[0.08] p-4 mb-4">
                      <div className="flex items-center justify-between">
                        <button onClick={() => navigateWeek('prev')} className="p-2 hover:bg-white/5 rounded-lg transition-colors"><ChevronLeft className="h-5 w-5 text-slate-400" /></button>
                        <div className="text-center">
                          <p className="font-semibold text-white">{formatDateRange(weekDates.start, weekDates.end)}</p>
                          <p className="text-sm text-slate-500">Week of entry</p>
                        </div>
                        <button onClick={() => navigateWeek('next')} className="p-2 hover:bg-white/5 rounded-lg transition-colors"><ChevronRight className="h-5 w-5 text-slate-400" /></button>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      {Object.entries(groupedAssignments).map(([client, clientAssignments]) => (
                        <div key={client} className="bg-slate-900/70 backdrop-blur-xl rounded-2xl border border-white/[0.08] overflow-hidden">
                          <button onClick={() => toggleClient(client)}
                            className="w-full px-4 py-3 flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                            <div className="flex items-center gap-2">
                              <Building2 className="h-4 w-4 text-slate-500" />
                              <span className="font-medium text-white">{client}</span>
                              <span className="text-sm text-slate-500">({clientAssignments.length})</span>
                            </div>
                            {collapsedClients.has(client) ? <ChevronDown className="h-5 w-5 text-slate-500" /> : <ChevronUp className="h-5 w-5 text-slate-500" />}
                          </button>
                          {!collapsedClients.has(client) && (
                            <div className="divide-y divide-white/[0.05]">
                              {clientAssignments.map(assignment => (
                                <div key={assignment.id} className="p-4">
                                  <div className="flex items-start gap-3">
                                    <FolderOpen className="h-5 w-5 text-emerald-400 mt-0.5" />
                                    <div className="flex-1">
                                      <p className="font-medium text-white">{assignment.project_name}</p>
                                      <p className="text-sm text-slate-500">{assignment.service || 'General'}</p>
                                    </div>
                                  </div>
                                  <div className="mt-3 grid grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs text-slate-500 mb-1">Hours</label>
                                      <input type="number" min="0" step="0.5" placeholder="0"
                                        value={entries[assignment.project_id]?.hours || ''}
                                        onChange={(e) => updateEntry(assignment.project_id, 'hours', e.target.value)}
                                        className="w-full px-3 py-2.5 bg-slate-800/50 border border-white/[0.08] rounded-lg focus:ring-2 focus:ring-emerald-500/50 text-white outline-none text-lg font-medium" />
                                    </div>
                                    <div>
                                      <label className="block text-xs text-slate-500 mb-1">Notes</label>
                                      <input type="text" placeholder="Optional..."
                                        value={entries[assignment.project_id]?.notes || ''}
                                        onChange={(e) => updateEntry(assignment.project_id, 'notes', e.target.value)}
                                        className="w-full px-3 py-2.5 bg-slate-800/50 border border-white/[0.08] rounded-lg focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-slate-600 outline-none" />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="bg-slate-900/70 backdrop-blur-xl rounded-2xl border border-white/[0.08] p-4">
                      <div className="flex items-center justify-between mb-4">
                        <span className="font-medium text-white">Total Hours</span>
                        <span className="text-2xl font-bold text-emerald-400">{totalHours.toFixed(1)}</span>
                      </div>
                      <button onClick={handleTimeSubmit} disabled={submitting || totalHours === 0}
                        className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20">
                        {submitting ? <><Loader2 className="h-5 w-5 animate-spin" /> Submitting...</> : <><Send className="h-5 w-5" /> Submit Timesheet</>}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {/* EXPENSES TAB */}
            {mainTab === 'expenses' && (
              <>
                <button onClick={() => { setExpenseFormData({}); setReceiptData(undefined); setShowReceiptCapture(true) }}
                  className="w-full py-5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-3 transition-all mb-4">
                  <div className="flex items-center gap-2"><Camera size={24} /><span className="text-white/40">|</span><Paperclip size={20} /></div>
                  <span className="text-lg">Add Receipt</span>
                </button>

                <div className="mb-4">
                  <p className="text-sm text-slate-400 mb-3">Quick Actions</p>
                  <div className="grid grid-cols-5 gap-2">
                    {QUICK_ACTIONS.map(action => {
                      const Icon = action.icon
                      return (
                        <button key={action.id} onClick={() => handleQuickAction(action)}
                          className="flex flex-col items-center gap-2 p-3 bg-slate-900/70 backdrop-blur rounded-xl border border-white/[0.08] hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all">
                          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center"><Icon size={18} className="text-slate-400" /></div>
                          <span className="text-[11px] text-slate-300">{action.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="bg-slate-900/70 backdrop-blur-xl rounded-2xl border border-white/[0.08] p-4">
                  <p className="text-sm text-slate-400 mb-3">Recent Submissions</p>
                  {expenseHistory.length === 0 ? (
                    <p className="text-center text-slate-500 py-4">No expenses submitted yet</p>
                  ) : (
                    <div className="space-y-2">
                      {expenseHistory.slice(0, 5).map(exp => {
                        const cat = EXPENSE_CATEGORIES[exp.category as ExpenseCategory] || EXPENSE_CATEGORIES.other
                        const status = STATUS_STYLES[exp.status] || STATUS_STYLES.pending
                        const Icon = cat.icon
                        return (
                          <div key={exp.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02]">
                            <div className={`w-9 h-9 rounded-lg ${cat.bg} flex items-center justify-center flex-shrink-0`}><Icon size={16} className={cat.color} /></div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">{exp.vendor || cat.label}</p>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span>{new Date(exp.expense_date).toLocaleDateString()}</span>
                                {exp.attachment_filename && <span className="flex items-center gap-0.5"><Paperclip size={10} /></span>}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-semibold text-white">${exp.amount.toFixed(2)}</p>
                              <span className={`text-xs ${status.color}`}>{status.label}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <button onClick={() => { setMainTab('history'); setHistorySubTab('expenses') }}
                    className="w-full mt-3 py-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors">View All History →</button>
                </div>
              </>
            )}

            {/* HISTORY TAB */}
            {mainTab === 'history' && (
              <>
                <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg mb-4">
                  {([
                    { key: 'time' as HistorySubTab, label: 'Time Entries' },
                    { key: 'expenses' as HistorySubTab, label: 'Expenses' },
                  ]).map(tab => (
                    <button key={tab.key} onClick={() => setHistorySubTab(tab.key)}
                      className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${historySubTab === tab.key ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
                      {tab.label}
                    </button>
                  ))}
                </div>

                {loadingHistory ? (
                  <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 text-emerald-500 animate-spin" /></div>
                ) : historySubTab === 'time' ? (
                  <div className="space-y-2">
                    {timeHistory.length === 0 ? (
                      <div className="text-center py-12"><Clock className="h-12 w-12 text-slate-600 mx-auto mb-3" /><p className="text-slate-400">No time entries yet</p></div>
                    ) : timeHistory.map(entry => {
                      const status = STATUS_STYLES[entry.status] || STATUS_STYLES.pending
                      return (
                        <div key={entry.id} className="bg-slate-900/70 backdrop-blur-xl rounded-xl border border-white/[0.08] p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center"><Clock size={18} className="text-emerald-400" /></div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-white truncate">{entry.project_name}</p>
                              <p className="text-xs text-slate-500">{entry.client_name ? `${entry.client_name} • ` : ''}{new Date(entry.date).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold text-white">{entry.hours}h</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>{status.label}</span>
                            </div>
                          </div>
                          {entry.description && <p className="text-sm text-slate-400 mt-2 ml-[52px]">{entry.description}</p>}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {expenseHistory.length === 0 ? (
                      <div className="text-center py-12"><Receipt className="h-12 w-12 text-slate-600 mx-auto mb-3" /><p className="text-slate-400">No expenses yet</p></div>
                    ) : expenseHistory.map(exp => {
                      const cat = EXPENSE_CATEGORIES[exp.category as ExpenseCategory] || EXPENSE_CATEGORIES.other
                      const status = STATUS_STYLES[exp.status] || STATUS_STYLES.pending
                      const Icon = cat.icon
                      return (
                        <div key={exp.id} className="bg-slate-900/70 backdrop-blur-xl rounded-xl border border-white/[0.08] p-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg ${cat.bg} flex items-center justify-center`}><Icon size={18} className={cat.color} /></div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-white truncate">{exp.vendor || cat.label}</p>
                              <p className="text-xs text-slate-500">{exp.project_name || 'No project'} • {new Date(exp.expense_date).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-semibold text-white">${exp.amount.toFixed(2)}</p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>{status.label}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mt-2 ml-[52px]">
                            {exp.attachment_filename && <span className="text-xs text-slate-500 flex items-center gap-1"><Paperclip size={11} /> {exp.attachment_type?.includes('pdf') ? 'PDF' : 'Image'}</span>}
                            {exp.description && <span className="text-xs text-slate-500 truncate">{exp.description}</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {error && (
          <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0" /><span className="text-sm">{error}</span>
          </div>
        )}
        {success && (
          <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-400">
            <Check className="h-5 w-5 flex-shrink-0" /><span className="text-sm">{success}</span>
          </div>
        )}

        <div className="flex items-center justify-center gap-2 mt-8 mb-4">
          <VantageLogo size={18} />
          <span className="text-sm text-slate-600">Powered by <span className="text-slate-500">Vantage</span></span>
        </div>
      </div>

      <ReceiptCapture isOpen={showReceiptCapture} onClose={() => setShowReceiptCapture(false)} onCapture={handleReceiptCapture} />
      <ExpenseForm isOpen={showExpenseForm} onClose={() => { setShowExpenseForm(false); setReceiptData(undefined); setExpenseFormData({}) }}
        onSave={handleSaveExpense} initialData={expenseFormData} receiptData={receiptData} projects={assignments} saving={savingExpense} />
    </div>
  )
}
