'use client'

// ============================================================
// EXPENSES TAB — trip-based expense reports
// ============================================================
// Path: src/app/contractor-portal/ExpensesTab.tsx
//
// Self-contained component (same pattern as OnboardingWizard).
// Flow: create a trip (client + purpose) → scan/upload/enter
// receipts as DRAFT lines (invisible to admin) → review → submit
// the whole report → ONE admin notification → approval → the
// Invoices tab picks it up at month end.
//
// All report/line writes go through /api/expense-reports
// (cookie-authed, server-authoritative FX math). Receipt files
// upload to the existing contractor-uploads bucket. Scanning
// calls /api/expenses/scan (Claude vision + ECB rates).
// ============================================================

import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Camera, Upload, Plus, X, ChevronLeft, Loader2, Send, Trash2,
  FileText, Eye, CheckCircle, AlertCircle, Globe, Pencil, Receipt,
  Smartphone, Plane, AlertTriangle
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://jmahfgpbtjeomuepfozf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYWhmZ3BidGplb211ZXBmb3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0OTAxNzcsImV4cCI6MjA4MTA2NjE3N30.3SVDvWCGIYYHV57BpKjpDJVCZLKzuRv8B_VietQDxUQ'
)

// ============ TYPES ============
interface Assignment { project_id: string; project_name: string; client_id: string; client_name: string; payment_type: string; rate: number }
interface ReportLine {
  id: string; report_id: string; date: string; description: string; merchant?: string | null
  category: string; amount: number; currency: string; original_amount?: number | null
  fx_rate?: number | null; fx_date?: string | null; line_items?: { description: string; amount: number }[] | null
  receipt_url?: string | null; status: string; scan_source?: string | null
}
interface Report {
  id: string; client_id?: string | null; title: string; description?: string | null; status: string
  trip_start?: string | null; trip_end?: string | null; invoice_id?: string | null; invoiced_at?: string | null
  submitted_at?: string | null; created_at: string; lines: ReportLine[]; line_count: number; total: number
}
interface LegacyExpense { id: string; date: string; category: string; description: string; amount: number; status: string; receipt_url?: string }

const EXPENSE_CATEGORIES = [
  { id: 'mixed', label: 'Mixed / Multiple' },
  { id: 'travel', label: 'Travel' },
  { id: 'meal', label: 'Meals' },
  { id: 'transportation', label: 'Transportation' },
  { id: 'hotel', label: 'Hotel' },
  { id: 'software', label: 'Software' },
  { id: 'other', label: 'Other' },
]
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'MXN', 'CAD', 'DOP', 'COP', 'BRL', 'CHF', 'AUD']

// ============ HELPERS ============
const fmtUsd = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v)
const fmtDate = (d?: string | null) => (d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—')
const localToday = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}` }
const catLabel = (id: string) => EXPENSE_CATEGORIES.find(c => c.id === id)?.label || id

// iPhone cameras produce HEIC and very large images; the scan API accepts
// JPEG/PNG/WebP under 5MB. Normalize every photo to a JPEG capped at 2000px
// before upload — Safari decodes HEIC natively into the canvas. PDFs pass through.
async function normalizeImage(file: File): Promise<File> {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) return file
  try {
    const url = URL.createObjectURL(file)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image()
      im.onload = () => resolve(im)
      im.onerror = () => reject(new Error('Could not read the image'))
      im.src = url
    })
    const MAX = 2000
    const scale = Math.min(1, MAX / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(url)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (!blob) throw new Error('Image conversion failed')
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch (err) {
    console.warn('Image normalization failed, uploading original:', err)
    return file
  }
}

async function uploadReceipt(file: File, memberId: string): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `expenses/${memberId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { data, error } = await supabase.storage.from('contractor-uploads').upload(fileName, file, { contentType: file.type, upsert: false })
    if (error) { console.error('Receipt upload error:', error); return null }
    return data?.path || null
  } catch (err) { console.error('Receipt upload error:', err); return null }
}

// ============ STATUS BADGE (square, Blueprint) ============
const BADGE: Record<string, { t: string; c: string; bg: string; bd: string }> = {
  draft:     { t: 'Draft — only you', c: '#b45309', bg: 'rgba(253,230,138,0.18)', bd: '#fde68a' },
  submitted: { t: 'Submitted',        c: '#0369a1', bg: 'rgba(14,165,233,0.07)',  bd: '#bae6fd' },
  approved:  { t: 'Approved',         c: '#047857', bg: 'rgba(16,185,129,0.07)',  bd: '#a7f3d0' },
  rejected:  { t: 'Rejected',         c: '#b91c1c', bg: 'rgba(225,29,72,0.06)',   bd: '#fecaca' },
  invoiced:  { t: 'Invoiced',         c: '#0369a1', bg: 'rgba(14,165,233,0.07)',  bd: '#bae6fd' },
  paid:      { t: 'Paid',             c: '#334155', bg: 'rgba(148,163,184,0.1)',  bd: '#cbd5e1' },
}
function ReportBadge({ status }: { status: string }) {
  const b = BADGE[status] || BADGE.draft
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontFamily: 'Archivo, sans-serif', fontSize: '9px', fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', padding: '4px 9px', borderRadius: '4px', border: `1px solid ${b.bd}`, color: b.c, background: b.bg, whiteSpace: 'nowrap' }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '1.5px', background: 'currentColor' }} />
      {b.t}
    </span>
  )
}

// Shared card head style
const headStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 20px', borderBottom: '1px solid rgba(15,23,42,0.06)', backgroundImage: 'repeating-linear-gradient(135deg, rgba(15,23,42,0.022) 0 1px, transparent 1px 12px)', gap: '12px', flexWrap: 'wrap' }
const lblStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }
const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12.5px', fontFamily: 'inherit', color: '#0f172a', outline: 'none' }
const flabStyle: React.CSSProperties = { fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: '3px', display: 'block' }
const btnPri: React.CSSProperties = { padding: '10px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '12.5px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 4px 16px -2px rgba(37,99,235,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }
const btnGhost: React.CSSProperties = { padding: '8px 13px', background: '#fff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }

// ============ LINE REVIEW MODAL (scan result or manual edit) ============
interface LineDraft {
  line_id?: string
  date: string; description: string; merchant: string; category: string
  currency: string; original_amount: string; amount: string
  fx_rate: number | null; fx_date: string | null
  line_items: { description: string; amount: number }[] | null
  receipt_url: string | null; scan_source: 'scan' | 'manual'
}
function emptyDraft(): LineDraft {
  return { date: localToday(), description: '', merchant: '', category: 'travel', currency: 'USD', original_amount: '', amount: '', fx_rate: null, fx_date: null, line_items: null, receipt_url: null, scan_source: 'manual' }
}

function LineModal({ draft, onChange, onSave, onClose, saving, error, tripWindow }: {
  draft: LineDraft; onChange: (d: LineDraft) => void; onSave: () => void; onClose: () => void; saving: boolean; error: string | null
  tripWindow?: { start?: string | null; end?: string | null }
}) {
  const outsideWindow = !!(tripWindow?.start && tripWindow?.end && /^\d{4}-\d{2}-\d{2}$/.test(draft.date) && (draft.date < tripWindow.start || draft.date > tripWindow.end))
  const [quoting, setQuoting] = useState(false)
  const foreign = draft.currency !== 'USD'
  const usdPreview = foreign && draft.fx_rate && parseFloat(draft.original_amount) > 0
    ? Math.round(parseFloat(draft.original_amount) * draft.fx_rate * 100) / 100
    : null

  // Re-quote FX whenever a foreign line's date / currency / amount changes
  useEffect(() => {
    if (!foreign) return
    const amt = parseFloat(draft.original_amount)
    if (!(amt > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return
    let cancelled = false
    setQuoting(true)
    fetch(`/api/expenses/scan?currency=${draft.currency}&date=${draft.date}&amount=${amt}`)
      .then(r => r.json())
      .then(j => {
        if (cancelled) return
        if (j?.ok && j.fx) onChange({ ...draft, fx_rate: j.fx.rate, fx_date: j.fx.date_used })
        else onChange({ ...draft, fx_rate: null, fx_date: null })
      })
      .catch(() => { if (!cancelled) onChange({ ...draft, fx_rate: null, fx_date: null }) })
      .finally(() => { if (!cancelled) setQuoting(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.currency, draft.date, draft.original_amount])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={onClose}>
      <div className="v-card" style={{ width: '100%', maxWidth: '440px', maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: '14px' }} onClick={e => e.stopPropagation()}>
        <div style={headStyle}>
          <span style={lblStyle}>{draft.line_id ? 'Edit expense' : draft.scan_source === 'scan' ? 'Review scanned receipt' : 'Add expense'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px' }}><X size={15} /></button>
        </div>
        <div style={{ padding: '14px 20px 18px', display: 'flex', flexDirection: 'column', gap: '11px' }}>
          {draft.scan_source === 'scan' && !draft.line_id && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', color: '#047857', background: 'rgba(16,185,129,0.06)', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '7px 10px' }}>
              <CheckCircle size={12} /> Read from your receipt — check everything before saving.
            </div>
          )}
          <div>
            <label style={flabStyle}>Description</label>
            <input style={inputStyle} value={draft.description} placeholder="What was this expense for?" onChange={e => onChange({ ...draft, description: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={flabStyle}>Merchant</label>
              <input style={inputStyle} value={draft.merchant} placeholder="Optional" onChange={e => onChange({ ...draft, merchant: e.target.value })} />
            </div>
            <div>
              <label style={flabStyle}>Category</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={draft.category} onChange={e => onChange({ ...draft, category: e.target.value })}>
                {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={flabStyle}>Date</label>
              <input type="date" style={inputStyle} value={draft.date} onChange={e => onChange({ ...draft, date: e.target.value })} />
            </div>
            <div>
              <label style={flabStyle}>Amount</label>
              <input inputMode="decimal" style={{ ...inputStyle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                value={foreign ? draft.original_amount : draft.amount}
                placeholder="0.00"
                onChange={e => {
                  const v = e.target.value
                  if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) {
                    onChange(foreign ? { ...draft, original_amount: v } : { ...draft, amount: v })
                  }
                }} />
            </div>
            <div>
              <label style={flabStyle}>Currency</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={draft.currency}
                onChange={e => {
                  const cur = e.target.value
                  if (cur === 'USD') onChange({ ...draft, currency: cur, amount: draft.original_amount || draft.amount, original_amount: '', fx_rate: null, fx_date: null })
                  else onChange({ ...draft, currency: cur, original_amount: draft.original_amount || draft.amount, amount: '', fx_rate: null, fx_date: null })
                }}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {foreign && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(37,99,235,0.05)', border: '1px solid #bfdbfe', borderRadius: '9px', padding: '9px 11px', fontSize: '11px', color: '#1e40af', lineHeight: 1.5 }}>
              <Globe size={12} style={{ flexShrink: 0, marginTop: '1px' }} />
              {quoting ? (
                <span>Fetching ECB rate for {fmtDate(draft.date)}…</span>
              ) : draft.fx_rate && usdPreview !== null ? (
                <span><b>{draft.currency} {parseFloat(draft.original_amount || '0').toFixed(2)} → {fmtUsd(usdPreview)}</b> · ECB rate {draft.fx_rate.toFixed(4)} for {fmtDate(draft.fx_date || draft.date)} (transaction date). Original amount and rate are saved with the expense.</span>
              ) : (
                <span style={{ color: '#b45309' }}>No rate available for this date/currency yet — adjust the date, or switch to USD and enter the converted amount from your card statement.</span>
              )}
            </div>
          )}

          {outsideWindow && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '11px', color: '#b45309', background: 'rgba(253,230,138,0.15)', border: '1px solid #fde68a', borderRadius: '9px', padding: '9px 11px', lineHeight: 1.5 }}>
              <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>This receipt is dated <b>{fmtDate(draft.date)}</b> — outside this trip's window ({fmtDate(tripWindow!.start)} – {fmtDate(tripWindow!.end)}). That can be legitimate (e.g., a flight booked early), but double-check it belongs in this report.</span>
            </div>
          )}

          {draft.line_items && draft.line_items.length > 0 && (
            <div>
              <label style={flabStyle}>Line items — from receipt</label>
              <div style={{ border: '1px solid rgba(15,23,42,0.06)', borderRadius: '9px', overflow: 'hidden' }}>
                {draft.line_items.map((li, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '6px 11px', borderTop: i === 0 ? 'none' : '1px solid rgba(15,23,42,0.05)', fontSize: '11.5px', color: '#475569' }}>
                    <span>{li.description}</span>
                    <b style={{ fontFamily: 'Archivo, sans-serif', fontVariantNumeric: 'tabular-nums', color: '#0f172a' }}>{draft.currency === 'USD' ? '$' : `${draft.currency} `}{li.amount.toFixed(2)}</b>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderRadius: '9px', padding: '9px 12px' }}>
            <span style={{ ...lblStyle, color: '#64748b' }}>Amount to save (USD)</span>
            <span style={{ fontFamily: 'Archivo, sans-serif', fontWeight: 700, fontSize: '17px', color: '#2563eb', fontVariantNumeric: 'tabular-nums' }}>
              {foreign ? (usdPreview !== null ? fmtUsd(usdPreview) : '—') : (parseFloat(draft.amount) > 0 ? fmtUsd(parseFloat(draft.amount)) : '—')}
            </span>
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', color: '#b91c1c', background: 'rgba(225,29,72,0.05)', border: '1px solid #fecaca', borderRadius: '8px', padding: '8px 10px' }}>
              <AlertCircle size={12} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}

          <button style={{ ...btnPri, opacity: saving ? 0.6 : 1 }} disabled={saving} onClick={onSave}>
            {saving ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><CheckCircle size={13} /> Save to report</>}
          </button>
          <span style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center' }}>Saved as a private draft line — admin sees nothing until you submit the report.</span>
        </div>
      </div>
    </div>
  )
}

// ============ MAIN COMPONENT ============
export default function ExpensesTab({ member, assignments, legacyExpenses }: {
  member: { id: string; company_id?: string }
  assignments: Assignment[]
  legacyExpenses: LegacyExpense[]
}) {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeReportId, setActiveReportId] = useState<string | null>(null)
  const [showNewTrip, setShowNewTrip] = useState(false)
  const [tripForm, setTripForm] = useState({ title: '', client_id: '', description: '', trip_start: '', trip_end: '' })
  const [reportType, setReportType] = useState<'travel' | 'other'>('travel')
  const [creating, setCreating] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [lineDraft, setLineDraft] = useState<LineDraft | null>(null)
  const [lineSaving, setLineSaving] = useState(false)
  const [lineError, setLineError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [docView, setDocView] = useState<{ url: string; isImage: boolean } | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const clients = useMemo(() => {
    const m = new Map<string, string>()
    assignments.forEach(a => { if (a.client_id) m.set(a.client_id, a.client_name || 'Client') })
    return Array.from(m.entries()).map(([id, name]) => ({ id, name }))
  }, [assignments])
  const clientName = (id?: string | null) => (id ? clients.find(c => c.id === id)?.name || 'Client' : 'Internal / no client')

  const loadReports = async () => {
    try {
      const res = await fetch('/api/expense-reports')
      if (!res.ok) throw new Error('Failed to load reports')
      const j = await res.json()
      setReports(j.reports || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load expense reports')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { loadReports() }, [])

  const activeReport = reports.find(r => r.id === activeReportId) || null
  const flash = (msg: string) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(null), 3000) }

  // ---------- create trip ----------
  const createTrip = async () => {
    if (!tripForm.title.trim() || creating) return
    setCreating(true); setError(null)
    try {
      const res = await fetch('/api/expense-reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create', ...tripForm, client_id: tripForm.client_id || null,
          // Other-type reports carry no trip window
          trip_start: reportType === 'travel' ? tripForm.trip_start : '',
          trip_end: reportType === 'travel' ? tripForm.trip_end : '',
        })
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to create trip')
      setReports(prev => [j.report, ...prev])
      setShowNewTrip(false)
      setTripForm({ title: '', client_id: '', description: '', trip_start: '', trip_end: '' })
      setActiveReportId(j.report.id)
    } catch (err: any) { setError(err.message) } finally { setCreating(false) }
  }

  // ---------- scan / upload ----------
  const handleFile = async (file: File | null) => {
    if (!file || !activeReport || scanning) return
    setScanning(true); setError(null)
    try {
      const normalized = await normalizeImage(file)
      const path = await uploadReceipt(normalized, member.id)
      if (!path) throw new Error('Upload failed — try again')
      const res = await fetch('/api/expenses/scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: path })
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Scan failed')
      if (j.ok === false) {
        // Unreadable — fall back to manual with the receipt attached
        setLineDraft({ ...emptyDraft(), receipt_url: path, scan_source: 'manual' })
        setError('Couldn\u2019t read that receipt — the photo is attached, enter the details manually.')
      } else {
        const p = j.parsed
        setLineDraft({
          line_id: undefined,
          date: p.date || localToday(),
          description: p.merchant || 'Receipt',
          merchant: p.merchant || '',
          category: p.category || 'other',
          currency: p.currency || 'USD',
          original_amount: p.currency !== 'USD' ? String(p.total) : '',
          amount: p.currency === 'USD' ? String(p.total) : '',
          fx_rate: j.fx?.rate ?? null,
          fx_date: j.fx?.date_used ?? null,
          line_items: p.line_items && p.line_items.length > 0 ? p.line_items : null,
          receipt_url: path,
          scan_source: 'scan',
        })
      }
    } catch (err: any) { setError(err.message) } finally {
      setScanning(false)
      if (cameraRef.current) cameraRef.current.value = ''
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // ---------- save line ----------
  const saveLine = async () => {
    if (!lineDraft || !activeReport || lineSaving) return
    setLineSaving(true); setLineError(null)
    try {
      const res = await fetch('/api/expense-reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: lineDraft.line_id ? 'update_line' : 'add_line',
          report_id: activeReport.id,
          line_id: lineDraft.line_id,
          date: lineDraft.date,
          description: lineDraft.description,
          merchant: lineDraft.merchant || null,
          category: lineDraft.category,
          currency: lineDraft.currency,
          amount: lineDraft.currency === 'USD' ? parseFloat(lineDraft.amount) : undefined,
          original_amount: lineDraft.currency !== 'USD' ? parseFloat(lineDraft.original_amount) : undefined,
          fx_rate: lineDraft.fx_rate,
          fx_date: lineDraft.fx_date,
          line_items: lineDraft.line_items,
          receipt_url: lineDraft.receipt_url,
          scan_source: lineDraft.scan_source,
        })
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to save')
      setLineDraft(null)
      await loadReports()
      flash(lineDraft.line_id ? 'Expense updated' : 'Saved to report')
    } catch (err: any) { setLineError(err.message) } finally { setLineSaving(false) }
  }

  const deleteLine = async (lineId: string) => {
    if (!confirm('Remove this expense from the report?')) return
    try {
      const res = await fetch('/api/expense-reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_line', line_id: lineId })
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Failed to delete') }
      await loadReports()
    } catch (err: any) { setError(err.message) }
  }

  // ---------- submit report ----------
  const submitReport = async () => {
    if (!activeReport || submitting) return
    if (!confirm(`Submit "${activeReport.title}" — ${fmtUsd(activeReport.total)}? Admin will be notified and the report locks for review.`)) return
    setSubmitting(true); setError(null)
    try {
      const res = await fetch('/api/expense-reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit', report_id: activeReport.id })
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Failed to submit')
      await loadReports()
      flash('Report submitted — admin has been notified')
    } catch (err: any) { setError(err.message) } finally { setSubmitting(false) }
  }

  const deleteReport = async (id: string) => {
    if (!confirm('Delete this draft report and all its expenses?')) return
    try {
      const res = await fetch(`/api/expense-reports?report_id=${id}`, { method: 'DELETE' })
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Failed to delete') }
      setActiveReportId(null)
      await loadReports()
    } catch (err: any) { setError(err.message) }
  }

  const viewReceipt = async (path: string) => {
    try {
      const { data } = await supabase.storage.from('contractor-uploads').createSignedUrl(path, 300)
      if (data?.signedUrl) {
        // Decide by the storage path (clean, no query string), not the signed URL
        const isImage = /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(path)
        setDocView({ url: data.signedUrl, isImage })
      } else setError('Could not open the receipt')
    } catch { setError('Could not open the receipt') }
  }

  // ============ RENDER ============
  if (loading) {
    return <div className="v-card" style={{ padding: '48px 20px', display: 'flex', justifyContent: 'center' }}><Loader2 size={20} className="animate-spin" style={{ color: '#cbd5e1' }} /></div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#b91c1c', background: 'rgba(225,29,72,0.05)', border: '1px solid #fecaca', borderRadius: '10px', padding: '9px 12px' }}>
          <AlertCircle size={13} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c' }}><X size={13} /></button>
        </div>
      )}
      {successMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#065f46', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '9px 12px' }}>
          <CheckCircle size={13} /> {successMsg}
        </div>
      )}

      {/* Hidden inputs: camera (mobile) + file picker */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0] || null)} />
      <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0] || null)} />

      {/* ================= TRIP DETAIL ================= */}
      {activeReport ? (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <button style={{ ...btnGhost, padding: '7px 10px', flexShrink: 0 }} onClick={() => setActiveReportId(null)}><ChevronLeft size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> Reports</button>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'Archivo, sans-serif', fontWeight: 700, fontSize: '15px', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeReport.title}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {clientName(activeReport.client_id)}{activeReport.trip_start ? ` · ${fmtDate(activeReport.trip_start)} – ${fmtDate(activeReport.trip_end)}` : ''}{activeReport.description ? ` · "${activeReport.description}"` : ''}
                </div>
              </div>
            </div>
            <ReportBadge status={activeReport.status} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_290px] gap-3">
            {/* Lines */}
            <div className="v-card" style={{ overflow: 'hidden' }}>
              <div style={headStyle}>
                <span style={lblStyle}>Receipts & expenses — {activeReport.line_count} line{activeReport.line_count === 1 ? '' : 's'}</span>
              </div>

              {activeReport.lines.length === 0 ? (
                <div style={{ padding: '32px 20px', textAlign: 'center' }}>
                  <Receipt size={20} style={{ color: '#cbd5e1', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 500 }}>No expenses yet</p>
                  <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '3px' }}>Scan a receipt or add one manually below.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '560px' }}>
                    <thead>
                      <tr>
                        {['Receipt', 'Item', 'Category', 'Original', 'USD', ''].map((h, i) => (
                          <th key={i} style={{ textAlign: i >= 3 && i <= 4 ? 'right' : 'left', padding: '8px 14px', fontSize: '9.5px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', background: '#f8fafc', borderBottom: '1px solid rgba(15,23,42,0.07)', whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeReport.lines.map(ln => (
                        <tr key={ln.id}>
                          <td style={{ padding: '9px 14px', borderTop: '1px solid rgba(15,23,42,0.045)' }}>
                            {ln.receipt_url ? (
                              <button onClick={() => viewReceipt(ln.receipt_url!)} title="View receipt"
                                style={{ width: '32px', height: '40px', borderRadius: '5px', border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                                <Eye size={12} />
                              </button>
                            ) : (
                              <span style={{ fontSize: '10px', color: '#cbd5e1' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '9px 14px', borderTop: '1px solid rgba(15,23,42,0.045)' }}>
                            <div style={{ fontSize: '12.5px', fontWeight: 500, color: '#0f172a' }}>{ln.description}</div>
                            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
                              {fmtDate(ln.date)}{ln.line_items && ln.line_items.length > 0 ? ` · ${ln.line_items.length} line items` : ''} · <span style={{ letterSpacing: '0.04em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>{ln.scan_source === 'scan' ? <><Smartphone size={9} style={{ display: 'inline' }} /> scanned</> : 'manual'}</span>
                            </div>
                          </td>
                          <td style={{ padding: '9px 14px', borderTop: '1px solid rgba(15,23,42,0.045)', fontSize: '12px', color: '#475569', whiteSpace: 'nowrap' }}>{catLabel(ln.category)}</td>
                          <td style={{ padding: '9px 14px', borderTop: '1px solid rgba(15,23,42,0.045)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {ln.currency !== 'USD' && ln.original_amount ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '9.5px', color: '#1e40af', background: 'rgba(37,99,235,0.05)', border: '1px solid #bfdbfe', borderRadius: '5px', padding: '2px 7px', fontVariantNumeric: 'tabular-nums' }}>
                                {ln.currency} {ln.original_amount.toFixed(2)}{ln.fx_rate ? ` @ ${ln.fx_rate.toFixed(4)}` : ''}
                              </span>
                            ) : <span style={{ fontSize: '11px', color: '#cbd5e1' }}>—</span>}
                          </td>
                          <td style={{ padding: '9px 14px', borderTop: '1px solid rgba(15,23,42,0.045)', textAlign: 'right', fontFamily: 'Archivo, sans-serif', fontWeight: 700, fontSize: '12.5px', color: '#0f172a', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtUsd(ln.amount)}</td>
                          <td style={{ padding: '9px 10px', borderTop: '1px solid rgba(15,23,42,0.045)', whiteSpace: 'nowrap' }}>
                            {activeReport.status === 'draft' && (
                              <span style={{ display: 'inline-flex', gap: '4px' }}>
                                <button title="Edit" onClick={() => setLineDraft({
                                  line_id: ln.id, date: ln.date, description: ln.description, merchant: ln.merchant || '',
                                  category: ln.category, currency: ln.currency,
                                  original_amount: ln.original_amount ? String(ln.original_amount) : '',
                                  amount: ln.currency === 'USD' ? String(ln.amount) : '',
                                  fx_rate: ln.fx_rate ?? null, fx_date: ln.fx_date ?? null,
                                  line_items: ln.line_items ?? null, receipt_url: ln.receipt_url ?? null,
                                  scan_source: (ln.scan_source as any) === 'scan' ? 'scan' : 'manual',
                                })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '3px' }}><Pencil size={12} /></button>
                                <button title="Delete" onClick={() => deleteLine(ln.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '3px' }}><Trash2 size={12} /></button>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {activeReport.status === 'draft' && (
                <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(15,23,42,0.06)', background: '#fbfcfd', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button style={{ ...btnPri, flex: '1 1 160px', padding: '10px 12px', opacity: scanning ? 0.6 : 1 }} disabled={scanning} onClick={() => cameraRef.current?.click()}>
                    {scanning ? <><Loader2 size={13} className="animate-spin" /> Reading receipt…</> : <><Camera size={13} /> Scan receipt</>}
                  </button>
                  <button style={{ ...btnGhost, flex: '1 1 120px' }} disabled={scanning} onClick={() => fileRef.current?.click()}><Upload size={12} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '5px' }} />Upload file</button>
                  <button style={{ ...btnGhost, flex: '1 1 120px', borderStyle: 'dashed' }} disabled={scanning} onClick={() => setLineDraft(emptyDraft())}><Plus size={12} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '5px' }} />Add manually</button>
                </div>
              )}
            </div>

            {/* Summary rail */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="v-card" style={{ padding: '15px 18px', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                <span style={lblStyle}>Report total</span>
                <span style={{ fontFamily: 'Archivo, sans-serif', fontWeight: 700, fontSize: '25px', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(activeReport.total)}</span>
                {(() => {
                  const byCat: Record<string, number> = {}
                  activeReport.lines.forEach(ln => { byCat[ln.category] = (byCat[ln.category] || 0) + ln.amount })
                  return Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                    <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: '#64748b' }}>
                      <span>{catLabel(cat)}</span>
                      <b style={{ fontFamily: 'Archivo, sans-serif', color: '#334155', fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(Math.round(amt * 100) / 100)}</b>
                    </div>
                  ))
                })()}
                {activeReport.status === 'draft' ? (
                  <>
                    <button style={{ ...btnPri, opacity: submitting || activeReport.line_count === 0 ? 0.5 : 1 }} disabled={submitting || activeReport.line_count === 0} onClick={submitReport}>
                      {submitting ? <><Loader2 size={13} className="animate-spin" /> Submitting…</> : <><Send size={13} /> Submit report — {fmtUsd(activeReport.total)}</>}
                    </button>
                    <span style={{ fontSize: '10.5px', color: '#94a3b8', lineHeight: 1.5 }}>Submitting notifies admin and locks the report for review. Until then, it's a private draft.</span>
                    <button style={{ ...btnGhost, borderColor: '#fecaca', color: '#b91c1c' }} onClick={() => deleteReport(activeReport.id)}>Delete draft report</button>
                  </>
                ) : (
                  <span style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.55 }}>
                    Submitted {activeReport.submitted_at ? fmtDate(activeReport.submitted_at.split('T')[0]) : ''}.{' '}
                    {activeReport.status === 'approved' && !activeReport.invoice_id ? 'Approved — add it to your monthly invoice from the Invoices tab before the last day of the month.' : ''}
                    {activeReport.status === 'invoiced' ? `Invoiced ${activeReport.invoiced_at ? fmtDate(activeReport.invoiced_at.split('T')[0]) : ''}.` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* ================= TRIPS LIST ================= */}
          {!showNewTrip ? (
            <button style={{ ...btnGhost, borderStyle: 'dashed', padding: '11px', width: '100%' }} onClick={() => setShowNewTrip(true)}>
              <Plus size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '5px' }} /> New expense report
            </button>
          ) : (
            <div className="v-card" style={{ overflow: 'hidden' }}>
              <div style={headStyle}>
                <span style={lblStyle}>New expense report</span>
                <button onClick={() => setShowNewTrip(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={14} /></button>
              </div>
              <div style={{ padding: '14px 20px 18px', display: 'flex', flexDirection: 'column', gap: '11px' }}>
                <div>
                  <label style={flabStyle}>Report type</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '3px', gap: '3px' }}>
                    {([['travel', 'Travel / trip', Plane], ['other', 'Other expense', Receipt]] as const).map(([id, label, Icon]) => (
                      <button key={id} type="button" onClick={() => setReportType(id)}
                        style={{ padding: '8px', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: reportType === id ? '#fff' : 'transparent', color: reportType === id ? '#2563eb' : '#64748b', boxShadow: reportType === id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
                        <Icon size={13} /> {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={flabStyle}>Title</label>
                  <input style={inputStyle} value={tripForm.title} placeholder="e.g. Lyon site visit · Adobe license — July · Q3 mileage" onChange={e => setTripForm(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div className={reportType === 'travel' ? 'grid grid-cols-1 sm:grid-cols-2 gap-2.5' : ''}>
                  <div>
                    <label style={flabStyle}>Client</label>
                    <select style={{ ...inputStyle, cursor: 'pointer' }} value={tripForm.client_id} onChange={e => setTripForm(p => ({ ...p, client_id: e.target.value }))}>
                      <option value="">Internal / no client</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  {reportType === 'travel' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={flabStyle}>Trip start</label>
                      <input type="date" style={inputStyle} value={tripForm.trip_start} onChange={e => setTripForm(p => ({ ...p, trip_start: e.target.value }))} />
                    </div>
                    <div>
                      <label style={flabStyle}>Trip end</label>
                      <input type="date" style={inputStyle} value={tripForm.trip_end} onChange={e => setTripForm(p => ({ ...p, trip_end: e.target.value }))} />
                    </div>
                  </div>
                  )}
                </div>
                <div>
                  <label style={flabStyle}>What is this report for?</label>
                  <input style={inputStyle} value={tripForm.description} placeholder="e.g. Substation commissioning support · software reimbursement" onChange={e => setTripForm(p => ({ ...p, description: e.target.value }))} />
                </div>
                <button style={{ ...btnPri, opacity: creating || !tripForm.title.trim() ? 0.5 : 1 }} disabled={creating || !tripForm.title.trim()} onClick={createTrip}>
                  {creating ? <><Loader2 size={13} className="animate-spin" /> Creating…</> : 'Create report'}
                </button>
              </div>
            </div>
          )}

          {reports.length === 0 && !showNewTrip ? (
            <div className="v-card" style={{ padding: '40px 20px', textAlign: 'center' }}>
              <FileText size={20} style={{ color: '#cbd5e1', margin: '0 auto 8px' }} />
              <p style={{ fontSize: '13px', fontWeight: 500, color: '#64748b' }}>No expense reports yet</p>
              <p style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>Create a report — a trip, a software reimbursement, anything — then scan or add receipts into it.</p>
            </div>
          ) : (
            <div className="v-card" style={{ overflow: 'hidden' }}>
              {reports.map((r, i) => (
                <button key={r.id} onClick={() => setActiveReportId(r.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', width: '100%', textAlign: 'left', padding: '12px 20px', background: 'none', border: 'none', borderTop: i === 0 ? 'none' : '1px solid rgba(15,23,42,0.05)', cursor: 'pointer', fontFamily: 'inherit' }}
                  className="hover:bg-gray-50 transition-colors">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                    <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '2px' }}>
                      {clientName(r.client_id)} · {r.line_count} receipt{r.line_count === 1 ? '' : 's'}{r.trip_start ? ` · ${fmtDate(r.trip_start)}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'Archivo, sans-serif', fontWeight: 700, fontSize: '13.5px', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(r.total)}</span>
                    <ReportBadge status={r.status} />
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Legacy standalone expenses (read-only history) */}
          {legacyExpenses.filter((e: any) => !(e as any).report_id).length > 0 && (
            <div className="v-card" style={{ overflow: 'hidden' }}>
              <div style={headStyle}><span style={lblStyle}>Earlier expenses — before reports</span></div>
              {legacyExpenses.filter((e: any) => !(e as any).report_id).slice(0, 10).map((e, i) => (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 20px', borderTop: i === 0 ? 'none' : '1px solid rgba(15,23,42,0.05)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12.5px', color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description || catLabel(e.category)}</div>
                    <div style={{ fontSize: '10px', color: '#94a3b8' }}>{fmtDate(e.date)} · {catLabel(e.category)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'Archivo, sans-serif', fontWeight: 700, fontSize: '12.5px', color: '#0f172a', fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(e.amount)}</span>
                    <ReportBadge status={e.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Line review modal */}
      {lineDraft && (
        <LineModal draft={lineDraft} onChange={setLineDraft} onSave={saveLine} onClose={() => { setLineDraft(null); setLineError(null) }} saving={lineSaving} error={lineError} tripWindow={activeReport ? { start: activeReport.trip_start, end: activeReport.trip_end } : undefined} />
      )}

      {/* Receipt viewer */}
      {docView && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={() => setDocView(null)}>
          <div style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '760px', height: '84vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid rgba(15,23,42,0.07)' }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#0f172a' }}>Receipt</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a href={docView.url} target="_blank" rel="noreferrer" style={{ ...btnGhost, textDecoration: 'none', color: '#2563eb' }}>Download</a>
                <button style={btnGhost} onClick={() => setDocView(null)}>Close</button>
              </div>
            </div>
            {docView.isImage ? (
              <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', padding: '14px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={docView.url} alt="Receipt" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '6px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }} />
              </div>
            ) : (
              <iframe src={docView.url} style={{ flex: 1, width: '100%', border: 'none' }} title="Receipt" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
