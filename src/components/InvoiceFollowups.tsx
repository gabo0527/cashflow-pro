'use client'
import { useEffect, useState } from 'react'
import { INVOICE_FOLLOWUP_START_MONTH, previousBillingMonth, statusTimestamp, localToday } from '@/lib/payables'

export default function InvoiceFollowups({ request }: { request: (url: string, init?: RequestInit) => Promise<Response> }) {
  const [month,setMonth] = useState(previousBillingMonth().start.slice(0,7))
  const [rows,setRows] = useState<any[]>([])
  const [open,setOpen] = useState(false)
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(true)
  const [busy,setBusy] = useState<string | null>(null)
  const [exempt,setExempt] = useState<any>(null)
  const [note,setNote] = useState('')
  const load = async () => {
    setLoading(true); setError('')
    try {
      const response = await request(`/api/invoice-followups?month=${month}-01`)
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setRows(result.rows || [])
    } catch(e) { setError(e instanceof Error ? e.message : 'Follow-ups could not be loaded.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() },[month])
  const missing = rows.filter(r=>r.required && !r.received)
  const change = async (row: any, required: boolean) => {
    setBusy(row.id); setError('')
    try {
      const response = await request('/api/invoice-followups',{method:'POST',body:JSON.stringify({id:row.id,required,note})})
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      setExempt(null); setNote(''); await load()
    } catch(e) {setError(e instanceof Error ? e.message : 'Update failed')}
    finally {setBusy(null)}
  }
  return <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4" aria-label="Missing contractor invoices">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <button onClick={()=>setOpen(!open)} aria-expanded={open} className="text-left">
        <span className="text-sm font-semibold text-slate-900">Missing invoices <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">{loading ? '…' : missing.length}</span></span>
        <span className="block text-xs text-slate-500 mt-1">Periods closing October 31, 2026 onward · reminders after three business days</span>
      </button>
      <div className="flex items-center gap-2">
        <input aria-label="Invoice submission month" type="month" min={INVOICE_FOLLOWUP_START_MONTH.slice(0,7)} max={localToday().slice(0,7)} value={month} onChange={e=>e.target.value >= INVOICE_FOLLOWUP_START_MONTH.slice(0,7) && setMonth(e.target.value)} className="rounded-lg border border-gray-200 bg-white p-2 text-sm" />
        <button onClick={()=>load()} disabled={loading} className="text-xs font-medium text-blue-700 disabled:opacity-50">Refresh</button>
        <button onClick={()=>setOpen(!open)} className="text-xs font-medium text-blue-700">{open?'Hide':'Review'}</button>
      </div>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {open && <div className="mt-4 space-y-2">
      <p className="text-xs text-slate-500">Business days: Monday–Friday, excluding observed U.S. federal holidays and configured company holidays. Each client or project follows its billing cycle. Only closed periods appear; an invoice must cover that period and scope to count as received.</p>
      {!loading && !missing.length && <p className="text-sm text-emerald-700">No missing invoices for this month.</p>}
      {rows.filter(r=>!r.received).map(row=><div key={row.id} className="flex flex-wrap justify-between items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
        <div><p className="text-sm font-medium text-slate-900">{row.name}</p><p className="text-xs text-slate-500">{row.client_name} · {row.period_start} – {row.period_end} · {row.email || 'Email missing'} · Grace through {row.grace_through}</p></div>
        <div className="flex flex-wrap items-center gap-3">
          <span title={row.reminded_at ? `Reminder accepted by email provider: ${statusTimestamp(row.reminded_at)}` : row.error || row.exemption_note || undefined} className={`rounded-full px-2 py-1 text-xs font-medium ${!row.required?'bg-gray-100 text-gray-600':row.reminder_state==='failed' || row.reminder_state==='sending'?'bg-red-50 text-red-700':'bg-amber-100 text-amber-800'}`}>
            {!row.required ? 'Not required' : row.reminder_state==='sent' ? 'Reminder sent' : row.reminder_state==='failed' ? 'Email failed — review' : row.reminder_state==='sending' ? 'Delivery needs review' : row.overdue ? 'Missing · reminder pending' : 'Awaiting invoice · grace period'}
          </span>
          <button disabled={busy===row.id} onClick={()=>{if(row.required){setExempt(row);setNote('')}else change(row,true)}} className="text-xs text-blue-700 disabled:opacity-50">{row.required?'Mark not required':'Require invoice'}</button>
        </div>
      </div>)}
      {exempt && <form onSubmit={e=>{e.preventDefault();change(exempt,false)}} className="rounded-lg border border-blue-200 bg-white p-3">
        <label className="block text-sm font-medium">Why is {exempt.name}'s {month} invoice not required?<input autoFocus required value={note} onChange={e=>setNote(e.target.value)} maxLength={500} className="block w-full mt-2 rounded border border-gray-300 p-2 text-sm" placeholder="For example: no services provided this month" /></label>
        <div className="mt-2 flex gap-3"><button disabled={!!busy} className="text-sm font-medium text-blue-700">Save monthly exception</button><button type="button" onClick={()=>setExempt(null)} className="text-sm text-gray-500">Cancel</button></div>
      </form>}
    </div>}
  </section>
}
