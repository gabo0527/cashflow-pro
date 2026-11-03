'use client'
import {useState} from 'react'
import {useBillingPolicies} from '@/hooks/useBillingPolicies'
import {billingPolicy,billingPeriod,invoiceDueDate} from '@/lib/billing-periods'
import {localToday} from '@/lib/payables'
import {supabase} from '@/lib/supabase'
export default function BillingPolicyEditor({clientId,projectId}:{clientId:string;projectId?:string}) {
  const {policies,loading,error}=useBillingPolicies()
  const [editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
  const policy=billingPolicy(policies,clientId,projectId)
  const [form,setForm]=useState(policy)
  const displayed=editing?form:policy
  const example=billingPeriod(localToday().slice(0,7),displayed.cycle_start_day)
  const save=async()=>{setBusy(true);setMessage('');try{
    const {data}=await supabase.auth.getSession()
    const response=await fetch('/api/billing-policies',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${data.session?.access_token || ''}`},body:JSON.stringify({...form,client_id:clientId,project_id:projectId || null})})
    const result=await response.json();if(!response.ok)throw new Error(result.error)
    window.location.reload()
  }catch(e){setMessage(e instanceof Error?e.message:'Save failed.')}finally{setBusy(false)}}
  return <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
    <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-slate-900">Billing period & payment terms</h3><p className="text-xs text-slate-500 mt-1">{projectId?'Project settings override the client default.':'Client default; individual projects can override it.'}</p></div><button disabled={loading || !!error} onClick={()=>{setForm({...policy});setEditing(!editing)}} className="text-xs text-blue-700">{editing?'Cancel':'Edit settings'}</button></div>
    {(error || message)&&<p role="alert" className="text-sm text-red-700">{error || message}</p>}
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-xs text-slate-500">Billing period{editing?<select value={form.cycle_start_day} onChange={e=>setForm({...form,cycle_start_day:Number(e.target.value) as 1|26})} className="block w-full border rounded p-2 mt-1"><option value={1}>1st–last day of month</option><option value={26}>26th–25th of next month</option></select>:<strong className="block text-slate-800 mt-1">{loading?'Loading…':policy.cycle_start_day===26?'26th–25th':'Calendar month'}</strong>}</label>
      <label className="text-xs text-slate-500">Client payment terms{editing?<input type="number" min={0} max={365} value={form.net_days} onChange={e=>setForm({...form,net_days:Number(e.target.value)})} className="block w-full border rounded p-2 mt-1"/>:<strong className="block text-slate-800 mt-1">Net {policy.net_days} · from invoice date</strong>}</label>
      <label className="text-xs text-slate-500">Contractor payment{editing?<select value={form.contractor_payment_basis} onChange={e=>setForm({...form,contractor_payment_basis:e.target.value as 'invoice_date'|'client_payment'})} className="block w-full border rounded p-2 mt-1"><option value="invoice_date">Contractor invoice terms</option><option value="client_payment">After client payment · schedule manually</option></select>:<strong className="block text-slate-800 mt-1">{policy.contractor_payment_basis==='client_payment'?'Await client payment; schedule manually':'Separate contractor invoice terms'}</strong>}</label>
    </div>
    <p className="text-xs text-slate-500">Example work period: {example.label}. An invoice dated {localToday()} with Net {displayed.net_days} is due {Number.isInteger(displayed.net_days)&&displayed.net_days>=0&&displayed.net_days<=365?invoiceDueDate(localToday(),displayed.net_days):'—'}.</p>
    {editing&&<><button disabled={busy} onClick={save} className="rounded-lg bg-blue-600 text-white px-3 py-2 text-xs font-semibold">{busy?'Saving…':'Save settings'}</button><p className="text-xs text-slate-500">Existing invoices retain their recorded dates and terms.</p></>}
  </section>
}
