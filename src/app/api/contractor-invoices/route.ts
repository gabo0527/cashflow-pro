import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { adminContext } from '@/lib/admin-context'
import { getSupabaseAdmin, readSessionFromCookie } from '@/lib/contractor-auth'

export const dynamic = 'force-dynamic'
const uuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const invoiceFields = ['team_member_id','invoice_number','invoice_date','due_date','period_start','period_end','total_amount','payment_terms','receipt_url','notes','status','client_id','entered_by']
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
      for (const field of ['hours','rate','amount','allocation_pct','total_amount']) if (values[field] != null && (!Number.isFinite(Number(values[field])) || Number(values[field]) < 0)) throw new Error('Amounts and hours must be valid positive numbers.')
      for (const field of ['period_start','period_end','invoice_date','due_date']) if (values[field] != null && (!/^\d{4}-\d{2}-\d{2}$/.test(values[field]) || new Date(`${values[field]}T12:00:00Z`).toISOString().slice(0,10) !== values[field])) throw new Error('Choose valid invoice dates.')
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
