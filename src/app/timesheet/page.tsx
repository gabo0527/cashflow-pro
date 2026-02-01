'use client'

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { 
  Clock, ChevronLeft, ChevronRight, Check, AlertCircle, 
  Building2, FolderOpen, Send, Loader2, ChevronDown, ChevronUp,
  Receipt, Camera, Upload, X, DollarSign, Car, Package, Coffee, 
  Fuel, Hotel, MapPin, Calendar, History, Sparkles, Image as ImageIcon,
  CheckCircle, ThumbsUp, CreditCard, FileText
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

// Hardcoded for public timesheet page (anon key is safe to expose)
const supabaseUrl = 'https://jmahfgpbtjeomuepfozf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYWhmZ3BidGplb211ZXBmb3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0OTAxNzcsImV4cCI6MjA4MTA2NjE3N30.3SVDvWCGIYYHV57BpKjpDJVCZLKzuRv8B_VietQDxUQ'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ============ CONSTANTS ============
const IRS_MILEAGE_RATE = 0.67

const EXPENSE_CATEGORIES = {
  meals: { label: 'Meals', icon: Coffee, color: 'text-amber-400', bg: 'bg-amber-500/20' },
  materials: { label: 'Materials', icon: Package, color: 'text-purple-400', bg: 'bg-purple-500/20' },
  fuel: { label: 'Fuel', icon: Fuel, color: 'text-red-400', bg: 'bg-red-500/20' },
  lodging: { label: 'Lodging', icon: Hotel, color: 'text-indigo-400', bg: 'bg-indigo-500/20' },
  per_diem: { label: 'Per Diem', icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  mileage: { label: 'Mileage', icon: Car, color: 'text-cyan-400', bg: 'bg-cyan-500/20' },
  parking: { label: 'Parking', icon: MapPin, color: 'text-orange-400', bg: 'bg-orange-500/20' },
  tolls: { label: 'Tolls', icon: CreditCard, color: 'text-pink-400', bg: 'bg-pink-500/20' },
  other: { label: 'Other', icon: Receipt, color: 'text-slate-400', bg: 'bg-slate-500/20' },
}

const STATUS_STYLES = {
  draft: { label: 'Draft', color: 'text-slate-400', bg: 'bg-slate-500/20' },
  submitted: { label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  approved: { label: 'Approved', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  rejected: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-500/20' },
  reimbursed: { label: 'Paid', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  pending: { label: 'Pending', color: 'text-amber-400', bg: 'bg-amber-500/20' },
}

const QUICK_ACTIONS = [
  { id: 'per_diem', label: 'Per Diem', icon: DollarSign, category: 'per_diem', requiresReceipt: false, defaultAmount: 80 },
  { id: 'mileage', label: 'Mileage', icon: Car, category: 'mileage', requiresReceipt: false },
  { id: 'materials', label: 'Materials', icon: Package, category: 'materials', requiresReceipt: true },
  { id: 'fuel', label: 'Fuel', icon: Fuel, category: 'fuel', requiresReceipt: true },
]

// Vantage Logo - Emerald bars
const VantageLogo = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="20" width="8" height="16" rx="2" fill="#10b981" fillOpacity="0.5"/>
    <rect x="16" y="12" width="8" height="24" rx="2" fill="#10b981" fillOpacity="0.75"/>
    <rect x="28" y="4" width="8" height="32" rx="2" fill="#10b981"/>
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
  project_name: string | null
  status: string
  receipt_url: string | null
  mileage_miles: number | null
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
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`
}

// ============ CAMERA MODAL ============
function CameraCapture({ 
  isOpen, 
  onClose, 
  onCapture,
  suggestedProject 
}: { 
  isOpen: boolean
  onClose: () => void
  onCapture: (imageData: string, extractedData: any) => void
  suggestedProject?: { id: string; name: string }
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [processing, setProcessing] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      startCamera()
    }
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [isOpen])

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      setCameraError(null)
    } catch (err) {
      setCameraError('Camera access denied. You can upload a photo instead.')
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx?.drawImage(video, 0, 0)
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8)
    processReceipt(imageData)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      const imageData = event.target?.result as string
      processReceipt(imageData)
    }
    reader.readAsDataURL(file)
  }

  const processReceipt = async (imageData: string) => {
    setProcessing(true)
    await new Promise(resolve => setTimeout(resolve, 1200))
    
    // Simulated OCR
    const vendors = ['Home Depot', 'Lowes', 'Shell', 'Subway', 'Hampton Inn', 'AutoZone']
    const extractedData = {
      vendor: vendors[Math.floor(Math.random() * vendors.length)],
      amount: Math.round((Math.random() * 120 + 15) * 100) / 100,
      expense_date: new Date().toISOString().split('T')[0],
      category: 'materials',
    }
    
    setProcessing(false)
    onCapture(imageData, extractedData)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 bg-black/80">
        <button onClick={onClose} className="p-2 text-white">
          <X size={24} />
        </button>
        <span className="text-white font-medium">Scan Receipt</span>
        <div className="w-10" />
      </div>

      <div className="flex-1 relative">
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
            <Camera size={64} className="text-slate-500 mb-4" />
            <p className="text-slate-400 text-center mb-4">{cameraError}</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-medium"
            >
              Upload Photo
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
            
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[85%] h-[60%] border-2 border-white/50 rounded-2xl relative">
                <div className="absolute -top-px -left-px w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                <div className="absolute -top-px -right-px w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                <div className="absolute -bottom-px -left-px w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                <div className="absolute -bottom-px -right-px w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />
              </div>
            </div>

            {processing && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin mb-4" />
                <p className="text-white font-medium">Reading receipt...</p>
              </div>
            )}
          </>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {suggestedProject && (
        <div className="px-4 py-3 bg-emerald-500/20 border-t border-emerald-500/30">
          <div className="flex items-center gap-2 text-emerald-400">
            <Sparkles size={16} />
            <span className="text-sm">Auto-assigning to <strong>{suggestedProject.name}</strong></span>
          </div>
        </div>
      )}

      <div className="p-6 bg-black/90 flex items-center justify-center gap-6">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-4 rounded-full bg-white/10 text-white"
        >
          <Upload size={24} />
        </button>
        
        <button
          onClick={capturePhoto}
          disabled={processing || !!cameraError}
          className="w-20 h-20 rounded-full bg-white flex items-center justify-center disabled:opacity-50"
        >
          <div className="w-16 h-16 rounded-full border-4 border-slate-900" />
        </button>
        
        <div className="w-14" />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  )
}

// ============ EXPENSE FORM MODAL ============
function ExpenseForm({
  isOpen,
  onClose,
  onSave,
  initialData,
  receiptImage,
  projects,
  saving
}: {
  isOpen: boolean
  onClose: () => void
  onSave: (data: any, asDraft: boolean) => void
  initialData: any
  receiptImage?: string
  projects: Assignment[]
  saving: boolean
}) {
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    vendor: '',
    amount: 0,
    category: 'other',
    project_id: '',
    description: '',
    mileage_miles: 0,
    ...initialData
  })

  useEffect(() => {
    if (initialData) {
      setForm(prev => ({ ...prev, ...initialData }))
    }
  }, [initialData])

  const isMileage = form.category === 'mileage'
  const calculatedAmount = isMileage && form.mileage_miles ? form.mileage_miles * IRS_MILEAGE_RATE : form.amount

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-slate-900 w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[90vh] overflow-hidden flex flex-col border border-white/10">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">New Expense</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {receiptImage && (
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-800">
              <img src={receiptImage} alt="Receipt" className="w-full h-full object-cover" />
              <div className="absolute top-2 right-2 px-2 py-1 bg-emerald-500/90 rounded-lg text-xs text-white flex items-center gap-1">
                <CheckCircle size={12} /> Scanned
              </div>
            </div>
          )}

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(EXPENSE_CATEGORIES).slice(0, 6).map(([key, cat]) => (
                <button
                  key={key}
                  onClick={() => setForm({ ...form, category: key })}
                  className={`p-3 rounded-xl flex flex-col items-center gap-1 transition-all ${
                    form.category === key 
                      ? 'bg-emerald-500/20 border-2 border-emerald-500' 
                      : 'bg-slate-800/50 border-2 border-transparent hover:border-white/10'
                  }`}
                >
                  <cat.icon size={20} className={form.category === key ? 'text-emerald-400' : 'text-slate-400'} />
                  <span className={`text-xs ${form.category === key ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {cat.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {isMileage ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Miles Driven</label>
                <input
                  type="number"
                  value={form.mileage_miles || ''}
                  onChange={(e) => setForm({ ...form, mileage_miles: parseFloat(e.target.value) || 0 })}
                  placeholder="Enter miles"
                  className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 text-sm">@ ${IRS_MILEAGE_RATE}/mile</span>
                  <span className="text-xl font-bold text-emerald-400">${calculatedAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Vendor</label>
                <input
                  type="text"
                  value={form.vendor || ''}
                  onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                  placeholder="e.g. Home Depot"
                  className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={form.amount || ''}
                    onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Date</label>
            <input
              type="date"
              value={form.expense_date || ''}
              onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Project</label>
            <select
              value={form.project_id || ''}
              onChange={(e) => setForm({ ...form, project_id: e.target.value })}
              className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">Select project...</option>
              {projects.map(p => (
                <option key={p.project_id} value={p.project_id}>{p.project_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Notes (optional)</label>
            <textarea
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Add any notes..."
              rows={2}
              className="w-full px-4 py-3 bg-slate-800/50 border border-white/10 rounded-xl text-white resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
          </div>
        </div>

        <div className="p-4 border-t border-white/10 flex gap-3">
          <button
            onClick={() => onSave({ ...form, amount: calculatedAmount }, true)}
            disabled={saving}
            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-colors"
          >
            Save Draft
          </button>
          <button
            onClick={() => onSave({ ...form, amount: calculatedAmount }, false)}
            disabled={saving || (!form.amount && !form.mileage_miles)}
            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            Submit
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ MAIN PAGE ============
export default function TimesheetPage() {
  // Auth state
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [member, setMember] = useState<TeamMember | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  
  // Navigation
  const [mainTab, setMainTab] = useState<MainTab>('time')
  const [historySubTab, setHistorySubTab] = useState<HistorySubTab>('time')
  
  // Time entry state
  const [entries, setEntries] = useState<Record<string, EntryData>>({})
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [collapsedClients, setCollapsedClients] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  
  // Expense state
  const [showCamera, setShowCamera] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | undefined>()
  const [expenseFormData, setExpenseFormData] = useState<any>({})
  const [savingExpense, setSavingExpense] = useState(false)
  
  // History state
  const [timeHistory, setTimeHistory] = useState<TimeEntryHistory[]>([])
  const [expenseHistory, setExpenseHistory] = useState<ExpenseClaim[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  
  // Messages
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

  // Load history when member is set and history tab is active
  useEffect(() => {
    if (member && mainTab === 'history') {
      loadHistory()
    }
  }, [member, mainTab])

  const loadHistory = async () => {
    if (!member) return
    setLoadingHistory(true)
    
    try {
      // Load time entries
      const { data: timeData } = await supabase
        .from('time_entries')
        .select(`
          id, date, hours, description, status,
          projects(name, clients(name))
        `)
        .eq('contractor_id', member.id)
        .order('date', { ascending: false })
        .limit(50)

      if (timeData) {
        setTimeHistory(timeData.map((t: any) => ({
          id: t.id,
          date: t.date,
          hours: t.hours,
          project_name: t.projects?.name || 'Unknown',
          client_name: t.projects?.clients?.name || '',
          status: t.status || 'pending',
          description: t.description
        })))
      }

      // Load expense claims
      const { data: expenseData } = await supabase
        .from('expense_claims')
        .select(`
          id, expense_date, vendor, amount, category, status, receipt_url, mileage_miles,
          projects(name)
        `)
        .eq('team_member_id', member.id)
        .order('expense_date', { ascending: false })
        .limit(50)

      if (expenseData) {
        setExpenseHistory(expenseData.map((e: any) => ({
          id: e.id,
          expense_date: e.expense_date,
          vendor: e.vendor,
          amount: e.amount,
          category: e.category,
          project_name: e.projects?.name || null,
          status: e.status,
          receipt_url: e.receipt_url,
          mileage_miles: e.mileage_miles
        })))
      }
    } catch (err) {
      console.error('Error loading history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  const lookupMember = async () => {
    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const { data: memberData, error: memberError } = await supabase
        .from('team_members')
        .select('id, name, email, company_id')
        .eq('email', email.trim().toLowerCase())
        .single()

      if (memberError || !memberData) {
        setError('Email not found. Please check your email address.')
        setLoading(false)
        return
      }

      setMember(memberData)

      // Get assignments
      const { data: assignData } = await supabase
        .from('team_project_assignments')
        .select('id, project_id, service, payment_type, rate')
        .eq('team_member_id', memberData.id)

      if (!assignData || assignData.length === 0) {
        setError('No projects assigned. Contact your administrator.')
        setLoading(false)
        return
      }

      const projectIds = assignData.map((a: any) => a.project_id).filter(Boolean)

      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name, client_id')
        .in('id', projectIds)

      const clientIds = Array.from(new Set((projectsData || []).map((p: any) => p.client_id).filter(Boolean)))
      let clientsMap: Record<string, string> = {}
      
      if (clientIds.length > 0) {
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, name')
          .in('id', clientIds)

        if (clientsData) {
          clientsData.forEach((c: any) => { clientsMap[c.id] = c.name })
        }
      }

      const combinedAssignments: Assignment[] = assignData.map((a: any) => {
        const project = (projectsData || []).find((p: any) => p?.id === a.project_id)
        return {
          id: a.id,
          project_id: a.project_id,
          project_name: project?.name || 'Unknown Project',
          client_name: project?.client_id ? clientsMap[project.client_id] : 'Other',
          service: a.service,
          payment_type: a.payment_type,
          rate: a.rate || 0
        }
      })

      setAssignments(combinedAssignments)
    } catch (err) {
      console.error('Error:', err)
      setError('An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const toggleClient = (client: string) => {
    setCollapsedClients(prev => {
      const next = new Set(prev)
      next.has(client) ? next.delete(client) : next.add(client)
      return next
    })
  }

  const updateEntry = (projectId: string, field: 'hours' | 'notes', value: string) => {
    setEntries(prev => ({
      ...prev,
      [projectId]: { ...prev[projectId], project_id: projectId, [field]: value }
    }))
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(prev => {
      const newDate = new Date(prev)
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
      return newDate
    })
  }

  const handleTimeSubmit = async () => {
    if (!member || totalHours === 0) return

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const assignmentMap = new Map(assignments.map(a => [a.project_id, a]))
      
      const entriesToInsert = Object.values(entries)
        .filter(e => parseFloat(e.hours) > 0)
        .map(e => {
          const assignment = assignmentMap.get(e.project_id)
          return {
            company_id: member.company_id,
            contractor_id: member.id,
            project_id: e.project_id,
            date: weekDates.start.toISOString().split('T')[0],
            hours: parseFloat(e.hours),
            billable: true,
            bill_rate: assignment?.rate || 0,
            description: e.notes || null,
            status: 'pending'
          }
        })

      const { error } = await supabase.from('time_entries').insert(entriesToInsert)
      if (error) throw error

      setSuccess(`Successfully submitted ${totalHours} hours!`)
      setEntries({})
    } catch (err) {
      console.error('Submit error:', err)
      setError('Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCameraCapture = (imageData: string, extractedData: any) => {
    setCapturedImage(imageData)
    setExpenseFormData(extractedData)
    setShowCamera(false)
    setShowExpenseForm(true)
  }

  const handleQuickAction = (action: any) => {
    setCapturedImage(undefined)
    setExpenseFormData({
      category: action.category,
      amount: action.defaultAmount || 0,
      vendor: action.category === 'per_diem' ? 'Per Diem' : '',
      expense_date: new Date().toISOString().split('T')[0],
      project_id: assignments[0]?.project_id || ''
    })
    
    if (action.requiresReceipt) {
      setShowCamera(true)
    } else {
      setShowExpenseForm(true)
    }
  }

  const handleSaveExpense = async (data: any, asDraft: boolean) => {
    if (!member) return
    setSavingExpense(true)
    setError('')

    try {
      const claimData = {
        company_id: member.company_id,
        team_member_id: member.id,
        expense_date: data.expense_date,
        vendor: data.vendor || null,
        amount: data.amount,
        category: data.category,
        description: data.description || null,
        project_id: data.project_id || null,
        receipt_url: capturedImage || null,
        receipt_required: !['per_diem', 'mileage'].includes(data.category),
        mileage_miles: data.mileage_miles || null,
        mileage_rate: IRS_MILEAGE_RATE,
        status: asDraft ? 'draft' : 'submitted',
        submitted_at: asDraft ? null : new Date().toISOString()
      }

      const { error } = await supabase.from('expense_claims').insert(claimData)
      if (error) throw error

      setSuccess(`Expense ${asDraft ? 'saved as draft' : 'submitted'}!`)
      setShowExpenseForm(false)
      setCapturedImage(undefined)
      setExpenseFormData({})
      
      // Refresh history
      if (mainTab === 'history') loadHistory()
    } catch (err) {
      console.error('Save expense error:', err)
      setError('Failed to save expense.')
    } finally {
      setSavingExpense(false)
    }
  }

  const logout = () => {
    setMember(null)
    setAssignments([])
    setEmail('')
    setEntries({})
    setTimeHistory([])
    setExpenseHistory([])
    setMainTab('time')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-3">
            <VantageLogo size={32} />
            <span className="text-xl font-bold text-white">Vantage</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {!member ? (
          /* ============ LOGIN ============ */
          <div className="pt-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-slate-800/50 backdrop-blur border border-white/[0.08] mb-4">
                <Clock className="h-7 w-7 text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Time & Expenses</h1>
              <p className="text-slate-400">Submit hours and expenses</p>
            </div>

            <div className="bg-slate-900/70 backdrop-blur-xl rounded-xl border border-white/[0.08] p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center">
                  <span className="text-slate-500 text-lg">?</span>
                </div>
                <div className="flex-1">
                  <input
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && lookupMember()}
                    className="w-full px-4 py-3 bg-slate-800/50 border border-white/[0.08] rounded-xl focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 text-white placeholder-slate-500 outline-none transition-all"
                  />
                </div>
              </div>
              <button
                onClick={lookupMember}
                disabled={loading}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {loading ? <><Loader2 className="h-5 w-5 animate-spin" /> Looking up...</> : 'Continue'}
              </button>
            </div>
          </div>
        ) : (
          /* ============ MAIN CONTENT ============ */
          <>
            {/* Member Info */}
            <div className="bg-slate-900/70 backdrop-blur-xl rounded-xl border border-white/[0.08] p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <span className="text-emerald-400 font-semibold text-sm">
                    {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">{member.name}</p>
                  <p className="text-sm text-slate-400">{member.email}</p>
                </div>
                <button onClick={logout} className="text-sm text-slate-500 hover:text-white transition-colors">
                  Sign out
                </button>
              </div>
            </div>

            {/* Main Tabs */}
            <div className="flex gap-1 p-1 bg-slate-900/70 backdrop-blur-xl rounded-xl border border-white/[0.08] mb-4">
              <button
                onClick={() => setMainTab('time')}
                className={`flex-1 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm ${
                  mainTab === 'time' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Clock size={16} /> Time
              </button>
              <button
                onClick={() => setMainTab('expenses')}
                className={`flex-1 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm ${
                  mainTab === 'expenses' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Receipt size={16} /> Expenses
              </button>
              <button
                onClick={() => setMainTab('history')}
                className={`flex-1 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm ${
                  mainTab === 'history' ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <History size={16} /> History
              </button>
            </div>

            {/* ============ TIME TAB ============ */}
            {mainTab === 'time' && (
              <>
                {/* Week Navigator */}
                <div className="bg-slate-900/70 backdrop-blur-xl rounded-xl border border-white/[0.08] p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <button onClick={() => navigateWeek('prev')} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                      <ChevronLeft className="h-5 w-5 text-slate-400" />
                    </button>
                    <div className="text-center">
                      <p className="font-semibold text-white">{formatDateRange(weekDates.start, weekDates.end)}</p>
                      <p className="text-sm text-slate-500">Week of entry</p>
                    </div>
                    <button onClick={() => navigateWeek('next')} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                      <ChevronRight className="h-5 w-5 text-slate-400" />
                    </button>
                  </div>
                </div>

                {/* Projects */}
                <div className="space-y-3 mb-4">
                  {Object.entries(groupedAssignments).map(([client, clientAssignments]) => (
                    <div key={client} className="bg-slate-900/70 backdrop-blur-xl rounded-xl border border-white/[0.08] overflow-hidden">
                      <button
                        onClick={() => toggleClient(client)}
                        className="w-full px-4 py-3 flex items-center justify-between bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                      >
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
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    placeholder="0"
                                    value={entries[assignment.project_id]?.hours || ''}
                                    onChange={(e) => updateEntry(assignment.project_id, 'hours', e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-800/50 border border-white/[0.08] rounded-lg focus:ring-2 focus:ring-emerald-500/50 text-white outline-none transition-all"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-500 mb-1">Notes</label>
                                  <input
                                    type="text"
                                    placeholder="Optional..."
                                    value={entries[assignment.project_id]?.notes || ''}
                                    onChange={(e) => updateEntry(assignment.project_id, 'notes', e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-800/50 border border-white/[0.08] rounded-lg focus:ring-2 focus:ring-emerald-500/50 text-white placeholder-slate-600 outline-none transition-all"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Submit */}
                <div className="bg-slate-900/70 backdrop-blur-xl rounded-xl border border-white/[0.08] p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-medium text-white">Total Hours</span>
                    <span className="text-2xl font-bold text-emerald-400">{totalHours.toFixed(1)}</span>
                  </div>
                  <button
                    onClick={handleTimeSubmit}
                    disabled={submitting || totalHours === 0}
                    className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                  >
                    {submitting ? <><Loader2 className="h-5 w-5 animate-spin" /> Submitting...</> : <><Send className="h-5 w-5" /> Submit Timesheet</>}
                  </button>
                </div>
              </>
            )}

            {/* ============ EXPENSES TAB ============ */}
            {mainTab === 'expenses' && (
              <>
                {/* Big Camera Button */}
                <button
                  onClick={() => setShowCamera(true)}
                  className="w-full py-6 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-3 transition-all mb-4"
                >
                  <Camera size={28} />
                  <span className="text-lg">Scan Receipt</span>
                </button>

                {/* Quick Actions */}
                <div className="mb-4">
                  <p className="text-sm text-slate-400 mb-3">Quick Actions</p>
                  <div className="grid grid-cols-4 gap-2">
                    {QUICK_ACTIONS.map(action => {
                      const Icon = action.icon
                      return (
                        <button
                          key={action.id}
                          onClick={() => handleQuickAction(action)}
                          className="flex flex-col items-center gap-2 p-3 bg-slate-900/70 backdrop-blur rounded-xl border border-white/[0.08] hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all"
                        >
                          <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                            <Icon size={20} className="text-slate-400" />
                          </div>
                          <span className="text-xs text-slate-300">{action.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Recent Expenses Preview */}
                <div className="bg-slate-900/70 backdrop-blur-xl rounded-xl border border-white/[0.08] p-4">
                  <p className="text-sm text-slate-400 mb-3">Recent Submissions</p>
                  {expenseHistory.length === 0 ? (
                    <p className="text-center text-slate-500 py-4">No expenses yet</p>
                  ) : (
                    <div className="space-y-2">
                      {expenseHistory.slice(0, 3).map(exp => {
                        const cat = EXPENSE_CATEGORIES[exp.category as keyof typeof EXPENSE_CATEGORIES] || EXPENSE_CATEGORIES.other
                        const status = STATUS_STYLES[exp.status as keyof typeof STATUS_STYLES] || STATUS_STYLES.pending
                        const Icon = cat.icon
                        return (
                          <div key={exp.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.02]">
                            <div className={`w-8 h-8 rounded-lg ${cat.bg} flex items-center justify-center`}>
                              <Icon size={16} className={cat.color} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">{exp.vendor || cat.label}</p>
                              <p className="text-xs text-slate-500">{new Date(exp.expense_date).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-white">${exp.amount.toFixed(2)}</p>
                              <span className={`text-xs ${status.color}`}>{status.label}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <button
                    onClick={() => { setMainTab('history'); setHistorySubTab('expenses') }}
                    className="w-full mt-3 py-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    View All Expenses →
                  </button>
                </div>
              </>
            )}

            {/* ============ HISTORY TAB ============ */}
            {mainTab === 'history' && (
              <>
                {/* Sub Tabs */}
                <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg mb-4">
                  <button
                    onClick={() => setHistorySubTab('time')}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                      historySubTab === 'time' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Time Entries
                  </button>
                  <button
                    onClick={() => setHistorySubTab('expenses')}
                    className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                      historySubTab === 'expenses' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Expenses
                  </button>
                </div>

                {loadingHistory ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
                  </div>
                ) : historySubTab === 'time' ? (
                  /* Time History */
                  <div className="space-y-2">
                    {timeHistory.length === 0 ? (
                      <div className="text-center py-12">
                        <Clock className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400">No time entries yet</p>
                      </div>
                    ) : (
                      timeHistory.map(entry => {
                        const status = STATUS_STYLES[entry.status as keyof typeof STATUS_STYLES] || STATUS_STYLES.pending
                        return (
                          <div key={entry.id} className="bg-slate-900/70 backdrop-blur-xl rounded-xl border border-white/[0.08] p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                <Clock size={18} className="text-emerald-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-white truncate">{entry.project_name}</p>
                                <p className="text-xs text-slate-500">{entry.client_name} • {new Date(entry.date).toLocaleDateString()}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-semibold text-white">{entry.hours}h</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
                                  {status.label}
                                </span>
                              </div>
                            </div>
                            {entry.description && (
                              <p className="text-sm text-slate-400 mt-2 pl-13">{entry.description}</p>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                ) : (
                  /* Expense History */
                  <div className="space-y-2">
                    {expenseHistory.length === 0 ? (
                      <div className="text-center py-12">
                        <Receipt className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400">No expenses yet</p>
                      </div>
                    ) : (
                      expenseHistory.map(exp => {
                        const cat = EXPENSE_CATEGORIES[exp.category as keyof typeof EXPENSE_CATEGORIES] || EXPENSE_CATEGORIES.other
                        const status = STATUS_STYLES[exp.status as keyof typeof STATUS_STYLES] || STATUS_STYLES.pending
                        const Icon = cat.icon
                        return (
                          <div key={exp.id} className="bg-slate-900/70 backdrop-blur-xl rounded-xl border border-white/[0.08] p-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg ${cat.bg} flex items-center justify-center`}>
                                <Icon size={18} className={cat.color} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-white truncate">{exp.vendor || cat.label}</p>
                                <p className="text-xs text-slate-500">
                                  {exp.project_name || 'No project'} • {new Date(exp.expense_date).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-semibold text-white">${exp.amount.toFixed(2)}</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
                                  {status.label}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 mt-2 pl-13">
                              {exp.receipt_url && (
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <ImageIcon size={12} /> Receipt
                                </span>
                              )}
                              {exp.mileage_miles && (
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <Car size={12} /> {exp.mileage_miles} mi
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Messages */}
        {error && (
          <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-400">
            <Check className="h-5 w-5 flex-shrink-0" />
            {success}
          </div>
        )}

        <p className="text-center text-sm text-slate-600 mt-8">
          Powered by <span className="text-slate-500">Vantage</span>
        </p>
      </div>

      {/* Camera Modal */}
      <CameraCapture
        isOpen={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCapture}
        suggestedProject={assignments[0] ? { id: assignments[0].project_id, name: assignments[0].project_name } : undefined}
      />

      {/* Expense Form Modal */}
      <ExpenseForm
        isOpen={showExpenseForm}
        onClose={() => { setShowExpenseForm(false); setCapturedImage(undefined); setExpenseFormData({}) }}
        onSave={handleSaveExpense}
        initialData={expenseFormData}
        receiptImage={capturedImage}
        projects={assignments}
        saving={savingExpense}
      />
    </div>
  )
}
