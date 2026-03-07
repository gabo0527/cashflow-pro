'use client'

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  THEME, CARDHOLDERS, ACCOUNTS, OPENING_BALANCE, OPENING_BALANCE_DATE,
  formatCurrency, formatDateShort, getCategoriesForDirection, ALL_CATEGORIES,
} from './shared'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Transaction {
  id: string
  date: string
  description: string
  amount: number                    // positive = inflow, negative = outflow
  payee?: string
  account_id?: string               // 'checking_7801' | 'bofa_cc_gabriel' | etc.
  cardholder?: string               // 'gabriel' | 'rodrigo' | 'marcus'
  category?: string
  subcategory?: string
  is_categorized: boolean
  sync_source: 'plaid' | 'manual'
  plaid_transaction_id?: string
}

interface BankFeedSectionProps {
  transactions: Transaction[]
  onCategorizeTransaction: (id: string, category: string, subcategory: string, cardholder?: string) => Promise<void>
  onRefresh?: () => Promise<void>
  lastSynced?: string | null
  plaidConnected?: boolean
  onConnectPlaid?: () => void
  companyId?: string
}

// ─── Date Range Helpers ───────────────────────────────────────────────────────

type DateRange = { label: string; start: string; end: string }

function getDateRange(key: string): DateRange {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() // 0-indexed

  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const firstDay = (yr: number, mo: number) => new Date(yr, mo, 1)
  const lastDay  = (yr: number, mo: number) => new Date(yr, mo + 1, 0)

  // Weeks of current month
  if (key.match(/^w[1-4]$/)) {
    const wk = parseInt(key[1]) - 1
    const start = new Date(y, m, 1 + wk * 7)
    const end   = new Date(y, m, Math.min(7 + wk * 7, lastDay(y, m).getDate()))
    return { label: `Week ${wk + 1} — ${now.toLocaleString('en-US', { month: 'long' })}`, start: fmt(start), end: fmt(end) }
  }

  const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
  const mi = MONTHS.indexOf(key)
  if (mi >= 0) {
    return { label: new Date(y, mi).toLocaleString('en-US', { month: 'long', year: 'numeric' }), start: fmt(firstDay(y, mi)), end: fmt(lastDay(y, mi)) }
  }

  switch (key) {
    case 'thisweek': {
      const day = now.getDay()
      const s = new Date(now); s.setDate(now.getDate() - day)
      const e = new Date(s);   e.setDate(s.getDate() + 6)
      return { label: 'This Week', start: fmt(s), end: fmt(e) }
    }
    case 'lastweek': {
      const day = now.getDay()
      const s = new Date(now); s.setDate(now.getDate() - day - 7)
      const e = new Date(s);   e.setDate(s.getDate() + 6)
      return { label: 'Last Week', start: fmt(s), end: fmt(e) }
    }
    case 'thismonth':
      return { label: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }), start: fmt(firstDay(y, m)), end: fmt(lastDay(y, m)) }
    case 'lastmonth': {
      const lm = m === 0 ? 11 : m - 1; const ly = m === 0 ? y - 1 : y
      return { label: new Date(ly, lm).toLocaleString('en-US', { month: 'long', year: 'numeric' }), start: fmt(firstDay(ly, lm)), end: fmt(lastDay(ly, lm)) }
    }
    case 'q1': return { label: `Q1 ${y}`, start: `${y}-01-01`, end: `${y}-03-31` }
    case 'q2': return { label: `Q2 ${y}`, start: `${y}-04-01`, end: `${y}-06-30` }
    case 'q3': return { label: `Q3 ${y}`, start: `${y}-07-01`, end: `${y}-09-30` }
    case 'q4': return { label: `Q4 ${y}`, start: `${y}-10-01`, end: `${y}-12-31` }
    case 'ytd': return { label: `YTD ${y}`, start: `${y}-01-01`, end: fmt(now) }
    case 'lastyear': return { label: `${y - 1}`, start: `${y - 1}-01-01`, end: `${y - 1}-12-31` }
    case 'all': return { label: 'All Time', start: OPENING_BALANCE_DATE, end: fmt(now) }
    default:   return { label: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }), start: fmt(firstDay(y, m)), end: fmt(lastDay(y, m)) }
  }
}

// ─── Spending Panel ───────────────────────────────────────────────────────────

function SpendingPanel({
  transactions, dateRange, onClose,
}: { transactions: Transaction[]; dateRange: DateRange; onClose: () => void }) {
  const [view, setView] = useState<'breakdown' | 'chart'>('breakdown')
  const [activeCat, setActiveCat] = useState('all')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<any>(null)

  const outflows = useMemo(() =>
    transactions.filter(t => t.amount < 0 && t.category !== 'transfer'),
    [transactions]
  )

  const grouped = useMemo(() => {
    const g: Record<string, { total: number; txns: Transaction[] }> = {}
    outflows.forEach(t => {
      const k = t.category || '__uncategorized__'
      if (!g[k]) g[k] = { total: 0, txns: [] }
      g[k].total += Math.abs(t.amount)
      g[k].txns.push(t)
    })
    return Object.entries(g).sort((a, b) => b[1].total - a[1].total)
  }, [outflows])

  const grandTotal = useMemo(() => outflows.reduce((s, t) => s + Math.abs(t.amount), 0), [outflows])

  const usedCats = grouped.map(([k]) => k).filter(k => k !== '__uncategorized__')

  // Simple canvas doughnut (no Chart.js dep here — drawn manually)
  useEffect(() => {
    if (view !== 'chart' || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const size = canvas.width
    const cx = size / 2, cy = size / 2, r = size * 0.38, inner = size * 0.22
    ctx.clearRect(0, 0, size, size)

    if (grandTotal === 0) return

    let angle = -Math.PI / 2
    grouped.forEach(([k, v]) => {
      const catCfg = (ALL_CATEGORIES as any)[k]
      const color = catCfg?.hex || '#94a3b8'
      const slice = (v.total / grandTotal) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, r, angle, angle + slice)
      ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
      angle += slice
    })

    // Punch inner hole
    ctx.beginPath()
    ctx.arc(cx, cy, inner, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()

    // Center label
    ctx.fillStyle = '#0f172a'
    ctx.font = `700 ${Math.floor(size * 0.075)}px Inter, system-ui`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(formatCurrency(grandTotal), cx, cy - 8)
    ctx.fillStyle = '#94a3b8'
    ctx.font = `500 ${Math.floor(size * 0.045)}px Inter, system-ui`
    ctx.fillText('total out', cx, cy + size * 0.07)
  }, [view, grouped, grandTotal])

  const displayTxns = useMemo(() => {
    if (activeCat === 'all') return outflows
    if (activeCat === '__uncategorized__') return outflows.filter(t => !t.category)
    return outflows.filter(t => t.category === activeCat)
  }, [outflows, activeCat])

  return (
    <div style={{ width: 340, flexShrink: 0 }}>
      <div className={`${THEME.card} overflow-hidden`} style={{ boxShadow: '0 1px 3px rgba(0,0,0,.04)' }}>

        {/* Header */}
        <div style={{ borderBottom: '1px solid #f1f5f9' }}>
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div>
              <p className={`text-[13px] font-bold ${THEME.textPrimary}`}>Spending</p>
              <p className={`text-[10px] ${THEME.textDim} mt-0.5`}>{dateRange.label}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 rounded-md border border-slate-200">
                {(['breakdown', 'chart'] as const).map(v => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-2.5 py-1 text-[10px] font-semibold rounded capitalize transition-all ${view === v ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'}`}>
                    {v === 'breakdown' ? 'Breakdown' : 'Chart'}
                  </button>
                ))}
              </div>
              <button onClick={onClose} className={`text-lg leading-none ${THEME.textDim} hover:text-slate-700 px-1`}>×</button>
            </div>
          </div>

          {/* Category tabs */}
          <div className="flex overflow-x-auto px-4" style={{ gap: 0 }}>
            {[{ key: 'all', label: 'All' }, ...usedCats.map(k => ({ key: k, label: (ALL_CATEGORIES as any)[k]?.label || k }))].map(({ key, label }) => (
              <button key={key} onClick={() => setActiveCat(key)}
                className={`px-3 py-2 text-[11px] font-medium whitespace-nowrap border-b-2 transition-colors ${activeCat === key ? 'text-emerald-600 border-emerald-500 font-semibold' : `${THEME.textDim} border-transparent hover:text-slate-600`}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 320px)', padding: 16 }}>

          {view === 'breakdown' ? (
            activeCat === 'all' ? (
              /* Category breakdown bars */
              <>
                <p className={`text-[11px] ${THEME.textDim} mb-3`}>
                  Total outflows: <strong className={THEME.textPrimary}>{formatCurrency(grandTotal)}</strong>
                </p>
                {grouped.map(([k, v]) => {
                  const catCfg = (ALL_CATEGORIES as any)[k]
                  const pct = grandTotal > 0 ? (v.total / grandTotal) * 100 : 0
                  return (
                    <div key={k} className="mb-3 cursor-pointer group" onClick={() => setActiveCat(k)}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: catCfg?.hex || '#94a3b8' }} />
                          <span className={`text-[12px] font-medium ${THEME.textSecondary} group-hover:text-slate-900 transition-colors`}>
                            {catCfg?.label || 'Uncategorized'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] ${THEME.textDim}`}>{pct.toFixed(0)}%</span>
                          <span className={`text-[12px] font-bold ${THEME.textPrimary} tabular-nums`}>{formatCurrency(v.total)}</span>
                        </div>
                      </div>
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: catCfg?.hex || '#94a3b8' }} />
                      </div>
                    </div>
                  )
                })}
              </>
            ) : (
              /* Transaction list for selected category */
              <>
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => setActiveCat('all')} className={`text-[11px] ${THEME.textDim} hover:text-slate-700 flex items-center gap-1`}>
                    ← All
                  </button>
                  <span className={`text-[12px] font-bold ${THEME.textPrimary} tabular-nums`}>{formatCurrency(displayTxns.reduce((s, t) => s + Math.abs(t.amount), 0))}</span>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  {displayTxns.length === 0 ? (
                    <p className={`text-[12px] ${THEME.textDim} p-4 text-center`}>No transactions</p>
                  ) : displayTxns.map((t, i) => {
                    const cardholder = CARDHOLDERS.find(c => c.id === t.cardholder)
                    return (
                      <div key={t.id} className={`flex items-center justify-between p-3 bg-white ${i < displayTxns.length - 1 ? 'border-b border-slate-50' : ''}`}>
                        <div className="min-w-0 mr-3">
                          <p className={`text-[12px] font-medium ${THEME.textPrimary} truncate`}>{t.description}</p>
                          <p className={`text-[10px] ${THEME.textDim} mt-0.5`}>
                            {formatDateShort(t.date)}{cardholder ? ` · ${cardholder.name}` : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-[12px] font-semibold ${THEME.textSecondary} tabular-nums`}>−{formatCurrency(Math.abs(t.amount))}</p>
                          {t.subcategory && <p className={`text-[10px] ${THEME.textDim}`}>{t.subcategory}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )
          ) : (
            /* Chart view */
            <div>
              <canvas ref={canvasRef} width={308} height={308} style={{ display: 'block', margin: '0 auto 16px' }} />
              <div className="space-y-2">
                {grouped.map(([k, v]) => {
                  const catCfg = (ALL_CATEGORIES as any)[k]
                  const pct = grandTotal > 0 ? (v.total / grandTotal) * 100 : 0
                  return (
                    <div key={k} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: catCfg?.hex || '#94a3b8' }} />
                      <span className={`text-[11px] ${THEME.textSecondary} flex-1 truncate`}>{catCfg?.label || 'Uncategorized'}</span>
                      <span className={`text-[11px] ${THEME.textDim}`}>{pct.toFixed(0)}%</span>
                      <span className={`text-[11px] font-semibold ${THEME.textPrimary} tabular-nums`}>{formatCurrency(v.total)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Categorize Modal ─────────────────────────────────────────────────────────

function CategorizeModal({
  transaction, onSave, onClose,
}: { transaction: Transaction; onSave: (cat: string, sub: string, ch?: string) => Promise<void>; onClose: () => void }) {
  const isInflow = transaction.amount >= 0
  const CATS = getCategoriesForDirection(isInflow ? 'inflow' : 'outflow')

  const [selectedCat, setSelectedCat] = useState(transaction.category || '')
  const [selectedSub, setSelectedSub] = useState(transaction.subcategory || '')
  const [selectedCH,  setSelectedCH]  = useState(transaction.cardholder || '')
  const [saving, setSaving] = useState(false)

  const isCC = ACCOUNTS.find(a => a.id === transaction.account_id)?.type === 'credit_card'
  const catCfg = selectedCat ? (CATS as any)[selectedCat] : null

  const handleSave = async () => {
    if (!selectedCat) return
    setSaving(true)
    await onSave(selectedCat, selectedSub, isCC ? selectedCH : undefined)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100">
          <p className={`text-[14px] font-bold ${THEME.textPrimary} mb-3`}>Categorize Transaction</p>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className={`text-[13px] font-semibold ${THEME.textPrimary} truncate`}>{transaction.description}</p>
                <p className={`text-[11px] ${THEME.textDim} mt-0.5`}>{transaction.payee || ''} · {formatDateShort(transaction.date)}</p>
              </div>
              <p className={`text-[15px] font-bold tabular-nums shrink-0 ${isInflow ? 'text-emerald-600' : THEME.textPrimary}`}>
                {isInflow ? '+' : '−'}{formatCurrency(Math.abs(transaction.amount))}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Category chips */}
          <div>
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${THEME.textDim} mb-2`}>Category</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(CATS).map(([k, v]: [string, any]) => {
                const active = k === selectedCat
                return (
                  <button key={k} onClick={() => { setSelectedCat(k); setSelectedSub('') }}
                    className={`px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-all ${active ? `${v.bgClass} ${v.textClass} ${v.borderClass}` : `bg-white ${THEME.textMuted} border-slate-200 hover:border-slate-300`}`}>
                    {v.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Sub-category */}
          {catCfg && (
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${THEME.textDim} mb-2`}>Sub-category</p>
              <select value={selectedSub} onChange={e => setSelectedSub(e.target.value)}
                className={`w-full ${THEME.input} px-3 py-2 text-[13px]`}>
                <option value="">Select type…</option>
                {catCfg.subcategories?.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Cardholder — CC only */}
          {isCC && (
            <div>
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${THEME.textDim} mb-2`}>Cardholder</p>
              <div className="flex gap-2">
                {CARDHOLDERS.map(c => (
                  <button key={c.id} onClick={() => setSelectedCH(c.id)}
                    className={`flex-1 py-2 text-center rounded-lg border text-[12px] font-medium transition-all ${selectedCH === c.id ? 'bg-slate-900 text-white border-slate-900' : `bg-white ${THEME.textMuted} border-slate-200 hover:border-slate-300`}`}>
                    <div className="font-semibold">{c.name.split(' ')[0]}</div>
                    <div className="text-[10px] opacity-60 mt-0.5">··{c.last4}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 pb-5 border-t border-slate-100 pt-3">
          <button onClick={onClose} className={`px-4 py-2 text-[12px] font-medium border border-slate-200 rounded-lg ${THEME.textSecondary} hover:bg-slate-50 transition-colors`}>Cancel</button>
          <button onClick={handleSave} disabled={!selectedCat || saving}
            className="px-5 py-2 text-[12px] font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BankFeedSection({
  transactions,
  onCategorizeTransaction,
  onRefresh,
  lastSynced,
  plaidConnected = false,
  onConnectPlaid,
  companyId,
}: BankFeedSectionProps) {

  // ── State ──
  const [activeAcct, setActiveAcct]     = useState<'checking' | 'cc'>('checking')
  const [activeCH,   setActiveCH]       = useState('all')
  const [rangeKey,   setRangeKey]       = useState('thismonth')
  const [filter,     setFilter]         = useState<'all' | 'pending'>('all')
  const [catFilter,  setCatFilter]      = useState('all')
  const [direction,  setDirection]      = useState<'all' | 'inflow' | 'outflow'>('all')
  const [search,     setSearch]         = useState('')
  const [modalTxn,   setModalTxn]       = useState<Transaction | null>(null)
  const [panelOpen,  setPanelOpen]      = useState(false)
  const [dateOpen,   setDateOpen]       = useState(false)
  const [catDropOpen,setCatDropOpen]    = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const dateRef   = useRef<HTMLDivElement>(null)
  const catDropRef= useRef<HTMLDivElement>(null)

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) setDateOpen(false)
      if (catDropRef.current && !catDropRef.current.contains(e.target as Node)) setCatDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const dateRange = useMemo(() => getDateRange(rangeKey), [rangeKey])

  // ── Derived data ──
  const checkingTxns = useMemo(() =>
    transactions.filter(t => t.account_id === 'checking_7801' || (!t.account_id && (ACCOUNTS.find(a => a.type === 'bank')?.id))),
    [transactions]
  )
  const ccTxns = useMemo(() =>
    transactions.filter(t => ACCOUNTS.find(a => a.id === t.account_id && a.type === 'credit_card')),
    [transactions]
  )

  const activeBase = activeAcct === 'checking' ? checkingTxns : ccTxns

  // Date filter
  const dateFiltered = useMemo(() =>
    activeBase.filter(t => t.date >= dateRange.start && t.date <= dateRange.end),
    [activeBase, dateRange]
  )

  // Pending (uncategorized) count per tab
  const checkingPending = useMemo(() => checkingTxns.filter(t => !t.is_categorized).length, [checkingTxns])
  const ccPending       = useMemo(() => ccTxns.filter(t => !t.is_categorized).length, [ccTxns])

  // KPI calculations from checking (balance basis)
  const kpiData = useMemo(() => {
    const inflows  = dateFiltered.filter(t => activeAcct === 'checking' && t.amount > 0).reduce((s, t) => s + t.amount, 0)
    const outflows = dateFiltered.filter(t => activeAcct === 'checking' && t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
    const allUncat = transactions.filter(t => !t.is_categorized)
    const ccTotal  = ccTxns.reduce((s, t) => s + Math.abs(t.amount < 0 ? t.amount : 0), 0)
    const balance  = OPENING_BALANCE + checkingTxns.reduce((s, t) => s + t.amount, 0)
    return { inflows, outflows, uncatCount: allUncat.length, uncatAmt: allUncat.reduce((s, t) => s + Math.abs(t.amount), 0), ccTotal, balance }
  }, [dateFiltered, transactions, checkingTxns, ccTxns, activeAcct])

  // Available categories in current view
  const availableCats = useMemo(() => {
    const counts: Record<string, number> = {}
    dateFiltered.forEach(t => { if (t.category) counts[t.category] = (counts[t.category] || 0) + 1 })
    return counts
  }, [dateFiltered])

  // Final filtered rows
  const visibleRows = useMemo(() => {
    return dateFiltered.filter(t => {
      if (filter === 'pending' && t.is_categorized) return false
      if (catFilter !== 'all' && t.category !== catFilter) return false
      if (direction === 'inflow'  && t.amount < 0) return false
      if (direction === 'outflow' && t.amount > 0) return false
      if (activeCH !== 'all' && t.cardholder !== activeCH) return false
      if (search) {
        const q = search.toLowerCase()
        if (!t.description.toLowerCase().includes(q) && !(t.payee || '').toLowerCase().includes(q)) return false
      }
      return true
    }).sort((a, b) => b.date.localeCompare(a.date))
  }, [dateFiltered, filter, catFilter, direction, activeCH, search])

  // ── Handlers ──
  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return
    setIsRefreshing(true)
    await onRefresh()
    setIsRefreshing(false)
  }

  const handleSave = useCallback(async (cat: string, sub: string, ch?: string) => {
    if (!modalTxn) return
    await onCategorizeTransaction(modalTxn.id, cat, sub, ch)
    setModalTxn(null)
  }, [modalTxn, onCategorizeTransaction])

  const footIn  = visibleRows.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const footOut = visibleRows.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)

  // ── Render ──
  return (
    <>
      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200 px-8">
        <div className="max-w-screen-xl mx-auto">

          {/* Row 1: Title + controls */}
          <div className="flex items-center justify-between py-3 gap-3">
            <div>
              <h1 className={`text-[15px] font-bold ${THEME.textPrimary} tracking-tight`}>Cash Management</h1>
              <p className={`text-[11px] ${THEME.textDim} mt-0.5`}>Mano CG LLC · 2026</p>
            </div>
            <div className="flex items-center gap-2">

              {/* Date range picker */}
              <div ref={dateRef} className="relative">
                <button onClick={() => setDateOpen(!dateOpen)}
                  className={`flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[12px] font-semibold ${THEME.textPrimary} hover:border-slate-300 transition-colors`}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>
                  {dateRange.label}
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                </button>

                {dateOpen && (
                  <div className="absolute top-[calc(100%+6px)] right-0 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-3" style={{ minWidth: 280 }}>
                    {/* Quick */}
                    <p className={`text-[10px] font-semibold uppercase tracking-wider ${THEME.textDim} mb-2 px-1`}>Quick Select</p>
                    <div className="grid grid-cols-2 gap-1 mb-3">
                      {[['thisweek','This Week'],['lastweek','Last Week'],['thismonth','This Month'],['lastmonth','Last Month']].map(([k, l]) => (
                        <button key={k} onClick={() => { setRangeKey(k); setDateOpen(false) }}
                          className={`text-left px-2.5 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${rangeKey === k ? 'bg-emerald-50 text-emerald-700 font-semibold' : `${THEME.textSecondary} hover:bg-slate-50`}`}>{l}</button>
                      ))}
                    </div>
                    {/* Weeks */}
                    <p className={`text-[10px] font-semibold uppercase tracking-wider ${THEME.textDim} mb-2 px-1`}>Weeks</p>
                    <div className="grid grid-cols-4 gap-1 mb-3">
                      {[['w1','W1'],['w2','W2'],['w3','W3'],['w4','W4']].map(([k, l]) => (
                        <button key={k} onClick={() => { setRangeKey(k); setDateOpen(false) }}
                          className={`text-center px-2 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${rangeKey === k ? 'bg-emerald-50 text-emerald-700 font-semibold' : `${THEME.textSecondary} hover:bg-slate-50`}`}>{l}</button>
                      ))}
                    </div>
                    {/* Months */}
                    <p className={`text-[10px] font-semibold uppercase tracking-wider ${THEME.textDim} mb-2 px-1`}>Months</p>
                    <div className="grid grid-cols-4 gap-1 mb-3">
                      {[['jan','Jan'],['feb','Feb'],['mar','Mar'],['apr','Apr'],['may','May'],['jun','Jun'],['jul','Jul'],['aug','Aug'],['sep','Sep'],['oct','Oct'],['nov','Nov'],['dec','Dec']].map(([k, l]) => (
                        <button key={k} onClick={() => { setRangeKey(k); setDateOpen(false) }}
                          className={`text-center px-2 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${rangeKey === k ? 'bg-emerald-50 text-emerald-700 font-semibold' : `${THEME.textSecondary} hover:bg-slate-50`}`}>{l}</button>
                      ))}
                    </div>
                    {/* Quarters */}
                    <p className={`text-[10px] font-semibold uppercase tracking-wider ${THEME.textDim} mb-2 px-1`}>Quarters</p>
                    <div className="grid grid-cols-4 gap-1 mb-3">
                      {[['q1','Q1'],['q2','Q2'],['q3','Q3'],['q4','Q4']].map(([k, l]) => (
                        <button key={k} onClick={() => { setRangeKey(k); setDateOpen(false) }}
                          className={`text-center px-2 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${rangeKey === k ? 'bg-emerald-50 text-emerald-700 font-semibold' : `${THEME.textSecondary} hover:bg-slate-50`}`}>{l}</button>
                      ))}
                    </div>
                    {/* Full year options */}
                    <div className="border-t border-slate-100 pt-2 mt-1 grid grid-cols-3 gap-1">
                      {[['ytd',`YTD ${new Date().getFullYear()}`],['lastyear',`${new Date().getFullYear() - 1}`],['all','All Time']].map(([k, l]) => (
                        <button key={k} onClick={() => { setRangeKey(k); setDateOpen(false) }}
                          className={`text-center px-2 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${rangeKey === k ? 'bg-emerald-50 text-emerald-700 font-semibold' : `${THEME.textSecondary} hover:bg-slate-50`}`}>{l}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button className={`px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[12px] font-medium ${THEME.textSecondary} hover:border-slate-300 transition-colors`}>Export</button>

              <button onClick={() => setPanelOpen(!panelOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-[12px] font-medium transition-colors ${panelOpen ? 'bg-slate-900 border-slate-900 text-white' : `bg-white border-slate-200 ${THEME.textSecondary} hover:border-slate-300`}`}>
                Spending
                <div className={`w-1.5 h-1.5 rounded-full ${panelOpen ? 'bg-emerald-400' : 'bg-slate-300'}`} />
              </button>

              <button className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-[12px] font-semibold hover:bg-emerald-700 transition-colors">
                + Add
              </button>
            </div>
          </div>

          {/* Row 2: KPI strip */}
          <div className="grid gap-2 pb-3" style={{ gridTemplateColumns: '190px 1fr 1fr 1fr 1fr' }}>
            {/* Hero balance */}
            <div className="bg-slate-900 rounded-xl px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">Current Balance</p>
              <p className={`text-[22px] font-bold text-white tabular-nums tracking-tight`}>{formatCurrency(kpiData.balance)}</p>
              <p className="text-[10px] text-slate-500 mt-1.5">Opening {formatCurrency(OPENING_BALANCE)}</p>
            </div>
            {/* Cash In */}
            <div className={`${THEME.card} px-4 py-3 relative overflow-hidden`}>
              <div className="absolute top-0 left-0 w-[3px] h-full bg-emerald-500 rounded-l-xl" />
              <p className={`text-[9px] font-bold uppercase tracking-widest ${THEME.textDim} mb-1`}>Cash In</p>
              <p className="text-[18px] font-bold text-emerald-600 tabular-nums">{formatCurrency(kpiData.inflows)}</p>
              <p className={`text-[10px] ${THEME.textDim} mt-1`}>{dateFiltered.filter(t => t.amount > 0).length} deposits</p>
            </div>
            {/* Cash Out */}
            <div className={`${THEME.card} px-4 py-3 relative overflow-hidden`}>
              <div className="absolute top-0 left-0 w-[3px] h-full bg-rose-500 rounded-l-xl" />
              <p className={`text-[9px] font-bold uppercase tracking-widest ${THEME.textDim} mb-1`}>Cash Out</p>
              <p className={`text-[18px] font-bold ${THEME.textPrimary} tabular-nums`}>{formatCurrency(kpiData.outflows)}</p>
              <p className={`text-[10px] ${THEME.textDim} mt-1`}>{dateFiltered.filter(t => t.amount < 0).length} transactions</p>
            </div>
            {/* Pending Review */}
            <div className={`${THEME.card} px-4 py-3 relative overflow-hidden`}>
              <div className="absolute top-0 left-0 w-[3px] h-full bg-amber-500 rounded-l-xl" />
              <p className={`text-[9px] font-bold uppercase tracking-widest ${THEME.textDim} mb-1`}>Pending Review</p>
              <p className="text-[18px] font-bold text-amber-600 tabular-nums">{kpiData.uncatCount}</p>
              <p className={`text-[10px] ${THEME.textDim} mt-1`}>{formatCurrency(kpiData.uncatAmt)} to categorize</p>
            </div>
            {/* CC Outstanding */}
            <div className={`${THEME.card} px-4 py-3 relative overflow-hidden`}>
              <div className="absolute top-0 left-0 w-[3px] h-full bg-slate-400 rounded-l-xl" />
              <p className={`text-[9px] font-bold uppercase tracking-widest ${THEME.textDim} mb-1`}>CC Outstanding</p>
              <p className={`text-[18px] font-bold ${THEME.textPrimary} tabular-nums`}>{formatCurrency(kpiData.ccTotal)}</p>
              <p className={`text-[10px] ${THEME.textDim} mt-1`}>3 cards · due Apr 15</p>
            </div>
          </div>

          {/* Row 3: Account tabs + sync status */}
          <div className="flex items-center justify-between border-t border-slate-100">
            <div className="flex items-center">
              {/* Checking tab */}
              <button onClick={() => { setActiveAcct('checking'); setActiveCH('all'); setCatFilter('all') }}
                className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 ${activeAcct === 'checking' ? `font-semibold ${THEME.textPrimary} border-emerald-500` : `${THEME.textDim} border-transparent hover:text-slate-600`}`}>
                Checking
                <span className={`text-[10px] ${THEME.textDim}`}>··7801</span>
                {checkingPending > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-50 text-amber-600 border border-amber-200">{checkingPending}</span>
                )}
              </button>
              {/* CC tab */}
              <button onClick={() => { setActiveAcct('cc'); setCatFilter('all') }}
                className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 ${activeAcct === 'cc' ? `font-semibold ${THEME.textPrimary} border-emerald-500` : `${THEME.textDim} border-transparent hover:text-slate-600`}`}>
                Credit Cards
                <span className={`text-[10px] ${THEME.textDim}`}>3 cards</span>
                {ccPending > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-amber-50 text-amber-600 border border-amber-200">{ccPending}</span>
                )}
              </button>

              {/* Cardholder sub-filter — CC only */}
              {activeAcct === 'cc' && (
                <div className="flex items-center gap-1.5 ml-4 pl-4 border-l border-slate-200">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${THEME.textDim}`}>Cardholder:</span>
                  {[{ id: 'all', label: 'All' }, ...CARDHOLDERS.map(c => ({ id: c.id, label: `${c.name.split(' ')[0]} ··${c.last4}` }))].map(({ id, label }) => (
                    <button key={id} onClick={() => setActiveCH(id)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors ${activeCH === id ? 'bg-slate-900 text-white border-slate-900 font-semibold' : `bg-white ${THEME.textMuted} border-slate-200 hover:border-slate-300`}`}>
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sync status */}
            <div className="flex items-center gap-2 text-[10px] text-slate-400 pb-1">
              <div className={`w-1.5 h-1.5 rounded-full ${plaidConnected ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              {lastSynced ? `Synced ${lastSynced}` : 'Not connected'}
              {plaidConnected && (
                <button onClick={handleRefresh} disabled={isRefreshing}
                  className={`px-2 py-0.5 text-[10px] font-semibold border border-slate-200 rounded bg-white text-slate-500 hover:border-slate-300 transition-colors ${isRefreshing ? 'opacity-50' : ''}`}>
                  {isRefreshing ? '…' : 'Refresh'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Page Content ── */}
      <div className="max-w-screen-xl mx-auto px-8 py-5">
        <div className="flex gap-4 items-start">

          {/* ── Transaction Table ── */}
          <div className="flex-1 min-w-0">

            {/* Toolbar */}
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {/* All / Pending */}
                {(['all', 'pending'] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors ${filter === f
                      ? f === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200 font-semibold' : 'bg-slate-900 text-white border-slate-900 font-semibold'
                      : `bg-white ${THEME.textMuted} border-slate-200 hover:border-slate-300`}`}>
                    {f === 'all' ? `All ${dateFiltered.length}` : `Pending ${checkingPending + ccPending}`}
                  </button>
                ))}

                {/* Category dropdown */}
                <div ref={catDropRef} className="relative">
                  <button onClick={() => setCatDropOpen(!catDropOpen)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-colors bg-white ${THEME.textMuted} border-slate-200 hover:border-slate-300`}>
                    {catFilter === 'all' ? 'Category' : (ALL_CATEGORIES as any)[catFilter]?.label || catFilter}
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {catDropOpen && (
                    <div className="absolute top-[calc(100%+4px)] left-0 bg-white border border-slate-200 rounded-xl shadow-xl z-50 min-w-[200px] py-1.5">
                      <button onClick={() => { setCatFilter('all'); setCatDropOpen(false) }}
                        className={`w-full text-left px-3 py-2 text-[12px] font-medium ${THEME.textSecondary} hover:bg-slate-50 transition-colors`}>All categories</button>
                      {Object.entries(availableCats).map(([k, count]) => {
                        const catCfg = (ALL_CATEGORIES as any)[k]
                        if (!catCfg) return null
                        return (
                          <button key={k} onClick={() => { setCatFilter(k); setCatDropOpen(false) }}
                            className={`w-full text-left px-3 py-2 text-[12px] flex items-center justify-between hover:bg-slate-50 transition-colors ${catFilter === k ? 'text-emerald-600 bg-emerald-50' : THEME.textSecondary}`}>
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: catCfg.hex }} />
                              {catCfg.label}
                            </span>
                            <span className={`text-[11px] ${THEME.textDim}`}>{count}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* In / Out */}
                <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 border border-slate-200 rounded-lg">
                  {(['all', 'inflow', 'outflow'] as const).map(d => (
                    <button key={d} onClick={() => setDirection(d)}
                      className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors capitalize ${direction === d ? 'bg-slate-900 text-white font-semibold' : `text-slate-500 hover:text-slate-700`}`}>
                      {d === 'all' ? 'All' : d === 'inflow' ? 'In' : 'Out'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions…"
                  className={`${THEME.input} pl-7 pr-3 py-1.5 text-[12px] w-52`} />
              </div>
            </div>

            {/* Table */}
            <div className={`${THEME.card} overflow-hidden`}>
              {/* Head */}
              <div className="grid gap-3 px-5 py-2.5 bg-slate-50 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                style={{ gridTemplateColumns: '74px 1fr 150px 145px 86px 108px' }}>
                <span>Date</span><span>Description</span><span>Category</span><span>Sub-category</span>
                <span className="text-right">Amount</span><span />
              </div>

              {/* Rows */}
              {visibleRows.length === 0 ? (
                <div className="py-12 text-center">
                  <p className={`text-[13px] ${THEME.textDim}`}>No transactions match</p>
                </div>
              ) : visibleRows.map((t, i) => {
                const isIn = t.amount > 0
                const catCfg = t.category ? (ALL_CATEGORIES as any)[t.category] : null
                const cardholder = CARDHOLDERS.find(c => c.id === t.cardholder)
                return (
                  <div key={t.id} className={`group grid gap-3 px-5 py-2.5 items-center hover:bg-slate-50 transition-colors ${i < visibleRows.length - 1 ? 'border-b border-slate-50' : ''}`}
                    style={{ gridTemplateColumns: '74px 1fr 150px 145px 86px 108px' }}>
                    <span className={`text-[11px] tabular-nums ${THEME.textDim}`}>{formatDateShort(t.date)}</span>
                    <div className="min-w-0">
                      <p className={`text-[13px] font-medium ${THEME.textPrimary} truncate`}>{t.description}</p>
                      <p className={`text-[11px] ${THEME.textDim} mt-0.5 truncate`}>{t.payee || ''}{cardholder ? ` · ${cardholder.name}` : ''}</p>
                    </div>
                    <div>
                      {catCfg ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${catCfg.bgClass} ${catCfg.textClass} ${catCfg.borderClass}`}>
                          {catCfg.label}
                        </span>
                      ) : <span className={`text-[11px] ${THEME.textDim} italic`}>—</span>}
                    </div>
                    <span className={`text-[12px] ${THEME.textMuted} truncate`}>
                      {t.subcategory ? ((ALL_CATEGORIES as any)[t.category || '']?.subcategories?.find((s: any) => s.id === t.subcategory)?.name || t.subcategory) : '—'}
                    </span>
                    <span className={`text-[13px] font-semibold tabular-nums text-right ${isIn ? 'text-emerald-600' : THEME.textPrimary}`}>
                      {isIn ? '+' : '−'}{formatCurrency(Math.abs(t.amount))}
                    </span>
                    <div className="flex justify-end">
                      {t.is_categorized ? (
                        <button onClick={() => setModalTxn(t)}
                          className={`opacity-0 group-hover:opacity-100 transition-opacity px-2.5 py-1 text-[11px] font-medium border border-slate-200 rounded-md bg-white ${THEME.textMuted} hover:border-slate-300`}>
                          Edit
                        </button>
                      ) : (
                        <button onClick={() => setModalTxn(t)}
                          className="px-3 py-1 text-[11px] font-semibold bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors">
                          Categorize
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-2.5 bg-slate-50 border-t border-slate-200">
                <span className={`text-[11px] ${THEME.textDim}`}>{visibleRows.length} of {dateFiltered.length} transactions</span>
                <div className={`flex gap-4 text-[11px] ${THEME.textDim}`}>
                  In: <strong className="text-emerald-600 ml-1 tabular-nums">{formatCurrency(footIn)}</strong>
                  <span className="text-slate-200">|</span>
                  Out: <strong className={`${THEME.textPrimary} ml-1 tabular-nums`}>{formatCurrency(footOut)}</strong>
                </div>
              </div>
            </div>

            {/* Plaid connect banner */}
            {!plaidConnected && (
              <div className="mt-3 bg-white border border-dashed border-slate-300 rounded-xl px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.72"/></svg>
                  </div>
                  <div>
                    <p className={`text-[13px] font-semibold ${THEME.textSecondary}`}>Connect live bank feed via Plaid</p>
                    <p className={`text-[11px] ${THEME.textDim} mt-0.5`}>Auto-import Checking ··7801 and 3 credit cards · updates hourly</p>
                  </div>
                </div>
                <button onClick={onConnectPlaid}
                  className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-[12px] font-semibold hover:bg-slate-800 transition-colors">
                  Connect
                </button>
              </div>
            )}
          </div>

          {/* ── Spending Panel ── */}
          {panelOpen && (
            <SpendingPanel
              transactions={dateFiltered}
              dateRange={dateRange}
              onClose={() => setPanelOpen(false)}
            />
          )}
        </div>
      </div>

      {/* ── Categorize Modal ── */}
      {modalTxn && (
        <CategorizeModal
          transaction={modalTxn}
          onSave={handleSave}
          onClose={() => setModalTxn(null)}
        />
      )}
    </>
  )
}
