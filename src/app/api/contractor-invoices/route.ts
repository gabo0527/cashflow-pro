import { billingPolicy, billingPeriod, invoiceDueDate } from '@/lib/billing-periods'
import { readBillingPolicies } from '@/lib/billing-policy-server'
import { localToday } from '@/lib/payables'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { adminContext } from '@/lib/admin-context'
import { getSupabaseAdmin, readSessionFromCookie } from '@/lib/contractor-auth'

export const dynamic = 'force-dynamic'
const uuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const invoiceFields = ['team_member_id','invoice_number','invoice_date','due_date','period_start','period_end','total_amount','payment_terms','receipt_url','notes','status','client_id','entered_by','client_payment_received_on','client_payment_note','client_invoice_date','client_net_days']
const lineFields = ['invoice_id','client_id','project_id','description','hours','rate','amount','allocation_pct']
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!['contractor_invoices','contractor_invoice_lines'].includes(body.table) || !['select','insert','update','delete'].includes(body.operation)) return fail('Invalid invoice operation.')
    const admin = body.portal ? null : await adminContext(request)
    const session = body.portal ? await readSessionFromCookie() : null
    if (!admin && !session) return fail('Sign in to continue.', 401)
    const service = admin?.db || getSupabaseAdmin()
    let companyId = admin?.companyId, memberId: string | undefined
    if (session) {
      const { data, error } = await service.from('team_members').select('id, company_id')
        .eq('id', session.contractorId).eq('email', session.email).eq('status','active').single()
      if (error || !data) return fail('Your account is no longer active.', 403)
      companyId = data.company_id; memberId = data.id
    }
    // Admin writes retain the verified user's JWT so the database audit trigger
    // records the actual actor. Portal access uses the signed contractor cookie.
    const db = admin ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${admin.token}` } }, auth: { persistSession: false, autoRefreshToken: false },
    }) : service
    const filters: any[] = Array.isArray(body.filters) ? body.filters : []
    if (filters.length > 10 || filters.some(f => !['eq','gte','lte'].includes(f.op) || !['id','invoice_id','team_member_id','period_start','period_end','status'].includes(f.column) || typeof f.value !== 'string')) return fail('Invalid invoice filters.')
    const isLine = body.table === 'contractor_invoice_lines'
    const id = filters.find(f => f.column === (isLine ? 'invoice_id' : 'id') && f.op === 'eq')?.value
    let allowedInvoiceIds: string[] = []
    if (isLine) {
      let owned = service.from('contractor_invoices').select('id, status').eq('company_id', companyId)
      if (memberId) owned = owned.eq('team_member_id', memberId)
      const { data, error } = await owned
      if (error) throw error
      allowedInvoiceIds = (data || []).filter(i => !memberId || body.operation === 'select' || ['submitted','pending','rejected'].includes(i.status)).map(i => i.id)
    }
    if (['update','delete'].includes(body.operation) && (!uuid(id) || memberId && body.operation === 'update')) return fail('This invoice operation is not allowed.', 403)
    if (memberId && body.operation === 'delete' && !isLine) {
      const { data } = await service.from('contractor_invoices').select('status').eq('id', id).eq('team_member_id', memberId).eq('company_id',companyId).single()
      if (!data || !['submitted','pending','rejected'].includes(data.status)) return fail('Reviewed invoices cannot be deleted.',403)
    }
    if (body.operation === 'delete') {
      const { data: attached, error } = await service.from('expense_reports').select('id').eq('invoice_id', id).limit(1)
      if (error) throw error
      if (attached?.length) return fail('This invoice has attached expense reports. Contact your administrator before removing it.')
    }
    const clean = async (input: any) => {
      if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid invoice data.')
      const values: Record<string, any> = {}
      for (const field of isLine ? lineFields : invoiceFields) if (Object.hasOwn(input,field)) values[field] = input[field]
      if(memberId && !isLine) for(const field of ['client_invoice_date','client_net_days','client_payment_received_on','client_payment_note']) delete values[field]
      if(values.client_net_days!=null && (!Number.isInteger(values.client_net_days) || values.client_net_days<0 || values.client_net_days>365)) throw new Error('Client net days must be a whole number between 0 and 365.')
      for (const field of ['hours','rate','amount','allocation_pct','total_amount']) if (values[field] != null && (!Number.isFinite(Number(values[field])) || Number(values[field]) < 0)) throw new Error('Amounts and hours must be valid positive numbers.')
      for (const field of ['period_start','period_end','invoice_date','due_date','client_payment_received_on','client_invoice_date']) if (values[field] != null && (!/^\d{4}-\d{2}-\d{2}$/.test(values[field]) || new Date(`${values[field]}T12:00:00Z`).toISOString().slice(0,10) !== values[field])) throw new Error('Choose valid invoice dates.')
      if (values.period_start && values.period_end && values.period_start > values.period_end) throw new Error('The billing period end must follow its start.')
      if (values.status && !['submitted','pending','approved','scheduled','paid','rejected'].includes(values.status)) throw new Error('Invalid invoice status.')
      if (memberId && isLine && !allowedInvoiceIds.includes(values.invoice_id)) throw new Error('This invoice is not available for editing.')
      if (isLine && !allowedInvoiceIds.includes(values.invoice_id || id)) throw new Error('Invoice not found.')
      if (values.team_member_id && !memberId) {
        const { data } = await service.from('team_members').select('id').eq('id',values.team_member_id).eq('company_id',companyId).single()
        if (!data) throw new Error('Choose a team member in your company.')
      }
      if (values.client_id) {
        const { data } = await service.from('clients').select('id').eq('id',values.client_id).eq('company_id',companyId).single()
        if (!data) throw new Error('Choose a client in your company.')
      }
      if (values.project_id) {
        const { data } = await service.from('projects').select('id,client_id').eq('id',values.project_id).eq('company_id',companyId).single()
        if (!data || values.client_id && data.client_id !== values.client_id) throw new Error('Choose a project for this client.')
      }
      if (!isLine && body.operation === 'insert') {
        values.company_id = companyId
        if (memberId) { values.team_member_id = memberId; values.status = 'submitted'; values.entered_by = 'contractor' }
        if (!uuid(values.team_member_id) || !String(values.invoice_number || '').trim() || !values.period_start || !values.period_end || !(Number(values.total_amount) > 0)) throw new Error('Invoice number, period, contractor and amount are required.')
      }
      if (!isLine && body.operation === 'insert') {
        const policies=await readBillingPolicies(service,companyId!)
        if(memberId && !uuid(values.client_id)) throw new Error('Choose a client for this invoice.')
        let projectId=input.billing_project_id || null
        if(projectId && !uuid(projectId)) throw new Error('Choose a valid project.')
        if(projectId && !memberId) { const {data:project}=await service.from('projects').select('id').eq('id',projectId).eq('company_id',companyId).eq('client_id',values.client_id).single(); if(!project) throw new Error('Choose a project for this client.') }
        if(memberId) {
          const {data:assignments,error}=await service.from('team_project_assignments').select('project_id').eq('team_member_id',values.team_member_id)
          if(error) throw new Error('Project assignments could not be verified.')
          const {data:projects,error:projectError}=await service.from('projects').select('id,client_id').eq('company_id',companyId).eq('client_id',values.client_id).in('id',(assignments || []).map(a=>a.project_id))
          if(projectError || !projects?.length || projectId && !projects.some(p=>p.id===projectId)) throw new Error('Choose an assigned client and project.')
          if(!projectId && policies.some(p=>p.client_id===values.client_id && p.project_id && projects.some(s=>s.id===p.project_id))) throw new Error('Choose a project because this client has project-specific billing settings.')
        }
        const policy=billingPolicy(policies,values.client_id,projectId)
        if(memberId) {
          const period=billingPeriod(values.period_end.slice(0,7),policy.cycle_start_day)
          if(values.period_start!==period.start || values.period_end!==period.end) throw new Error('Invoice dates must match the configured billing period.')
        }
        values.invoice_date=values.invoice_date || localToday()
        values.payment_basis=policy.contractor_payment_basis
        values.client_net_days=values.client_net_days ?? policy.net_days
        if(admin && values.client_invoice_date){values.client_schedule_confirmed_at=new Date().toISOString();values.client_schedule_confirmed_by=admin.user.id}
        values.billing_snapshot={...policy,project_id:projectId,captured_at:new Date().toISOString()}
        if(policy.contractor_payment_basis==='client_payment') {
          values.payment_terms='After client payment; schedule manually'; values.due_date=null
          if(admin && values.client_payment_received_on) {values.client_payment_recorded_at=new Date().toISOString();values.client_payment_recorded_by=admin.user.id}
          if(['paid','scheduled'].includes(values.status) && !values.client_payment_received_on) throw new Error('Record receipt of client payment before scheduling or marking this contractor invoice paid.')
        }
        else if(memberId) values.due_date=invoiceDueDate(values.invoice_date,Number(String(values.payment_terms).match(/\d+/)?.[0] || 30))
      }
      if(!isLine && body.operation==='update') {
        const {data:existing,error}=await service.from('contractor_invoices').select('payment_basis,status,due_date,client_payment_received_on,client_payment_recorded_at,client_invoice_date,client_net_days').eq('id',id).eq('company_id',companyId).single()
        if(error || !existing) throw new Error('Invoice not found.')
        if(Object.hasOwn(values,'client_payment_received_on') && values.client_payment_received_on!==existing.client_payment_received_on) {
          if(!admin) throw new Error('Only an administrator can record client payment.')
          values.client_payment_recorded_at=values.client_payment_received_on ? new Date().toISOString() : null
          values.client_payment_recorded_by=values.client_payment_received_on ? admin.user.id : null
        }
        if(Object.hasOwn(values,'client_invoice_date') || Object.hasOwn(values,'client_net_days')) {
          if(!admin) throw new Error('Only an administrator can confirm the client invoice schedule.')
          const date=Object.hasOwn(values,'client_invoice_date')?values.client_invoice_date:existing.client_invoice_date
          const days=Object.hasOwn(values,'client_net_days')?values.client_net_days:existing.client_net_days
          if(date && (days==null || !Number.isInteger(days))) throw new Error('Confirm the client net days with its invoice date.')
          if(date!==existing.client_invoice_date || days!==existing.client_net_days){values.client_schedule_confirmed_at=date?new Date().toISOString():null;values.client_schedule_confirmed_by=date?admin.user.id:null}
        }
        const received=Object.hasOwn(values,'client_payment_received_on') ? values.client_payment_received_on : existing.client_payment_received_on
        const newPayoutDate=values.due_date && values.due_date!==existing.due_date
        const releasingPayment=['scheduled','paid'].includes(values.status)
        const removingFunds=existing.client_payment_received_on && Object.hasOwn(values,'client_payment_received_on') && !received && (existing.due_date || ['scheduled','paid'].includes(existing.status))
        if(existing.payment_basis==='client_payment' && !received && (newPayoutDate || releasingPayment || removingFunds)) throw new Error('Record receipt of client payment before scheduling or marking this contractor invoice paid.')
      }
      if(memberId) {delete values.client_payment_received_on;delete values.client_payment_note}
      return values
    }
    let query: any
    if (body.operation === 'select') query = db.from(body.table).select(isLine ? '*' : '*, contractor_invoice_lines(*)')
    else if (body.operation === 'insert') {
      const inputs = Array.isArray(body.values) ? body.values : [body.values]
      if (!inputs.length || inputs.length > 100) return fail('Invalid invoice data.')
      const values = []
      for (const input of inputs) values.push(await clean(input))
      query = db.from(body.table).insert(values).select()
    } else if (body.operation === 'update') query = db.from(body.table).update(await clean(body.values)).select()
    else query = db.from(body.table).delete().select('id')
    if (body.operation !== 'insert') {
      if (isLine) query = query.in('invoice_id',allowedInvoiceIds)
      else { query = query.eq('company_id',companyId); if (memberId) query = query.eq('team_member_id',memberId) }
      for (const f of filters) query = query[f.op](f.column,f.value)
    }
    if (body.operation === 'select') {
      if (body.order && ['invoice_date','submitted_at','period_start','due_date'].includes(body.order.column)) query = query.order(body.order.column,{ascending:body.order.ascending === true})
      query = query.order('id')
      if (body.limit) query = query.limit(Math.min(Math.max(Number(body.limit) || 20,1),1000))
      else {
        const all: any[] = []
        // Supabase caps individual responses. Page explicitly so older unpaid
        // invoices are never silently lost behind a server row limit.
        for (let offset=0;offset<20000;offset+=500) {
          const {data:page,error} = await query.range(offset,offset+499)
          if(error) throw new Error('Invoice data could not be loaded.')
          all.push(...(page || []))
          if(!page || page.length<500) return NextResponse.json({data:all,count:all.length})
        }
        return fail('This invoice history is too large to load safely. Narrow the billing period.',413)
      }
    }
    const { data, error } = await query
    if (error) { console.error('Invoice operation failed:',error.code); return fail('Invoice operation failed. Refresh and try again.',500) }
    return NextResponse.json({ data })
  } catch (error) {
    console.error('Invoice request failed:', error instanceof Error ? error.message : 'Unknown error')
    return fail(error instanceof Error ? error.message : 'Invoice request failed.')
  }
}
