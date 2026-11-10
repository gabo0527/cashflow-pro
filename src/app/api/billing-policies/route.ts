import { NextResponse } from 'next/server'
import { adminContext } from '@/lib/admin-context'
import { getSupabaseAdmin,readSessionFromCookie } from '@/lib/contractor-auth'
import { readBillingPolicies } from '@/lib/billing-policy-server'
import { validId,validDate } from '@/lib/commercial'
export const dynamic='force-dynamic'
export async function GET(request: Request) {
  try {
    const admin=await adminContext(request)
    if(admin) return NextResponse.json({policies:await readBillingPolicies(admin.db,admin.companyId)})
    const session=await readSessionFromCookie()
    if(!session) return NextResponse.json({error:'Sign in to view billing periods.'},{status:401})
    const db=getSupabaseAdmin()
    const {data:member,error}=await db.from('team_members').select('id,company_id').eq('id',session.contractorId).eq('email',session.email).eq('status','active').single()
    if(error || !member) return NextResponse.json({error:'Account inactive.'},{status:403})
    const {data:assignments,error:assignmentError}=await db.from('team_project_assignments').select('project_id').eq('is_active',true).eq('team_member_id',member.id)
    if(assignmentError) throw assignmentError
    const ids=(assignments || []).map(a=>a.project_id)
    const {data:projects,error:projectError}=await db.from('projects').select('id,client_id').eq('status','active').eq('is_active',true).eq('company_id',member.company_id).in('id',ids)
    if(projectError) throw projectError
    const policies=await readBillingPolicies(db,member.company_id)
    return NextResponse.json({policies:policies.filter(p=>(projects || []).some(s=>s.client_id===p.client_id && (!p.project_id || s.id===p.project_id)))})
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Billing settings unavailable.'},{status:503})}
}
export async function POST(request: Request) {
  const ctx=await adminContext(request)
  if(!ctx) return NextResponse.json({error:'Not authorized.'},{status:401})
  try {
    const body=await request.json()
    if(!validId(body.client_id) || body.project_id && !validId(body.project_id) || ![1,26].includes(body.cycle_start_day) || !Number.isInteger(body.net_days) || body.net_days<0 || body.net_days>365 || !['invoice_date','client_payment'].includes(body.contractor_payment_basis) || !validDate(body.effective_start)) throw new Error('Choose valid billing and payment settings.')
    const {data:client}=await ctx.db.from('clients').select('id').eq('id',body.client_id).eq('company_id',ctx.companyId).single()
    if(!client) throw new Error('Client not found.')
    if(body.project_id){const {data:project}=await ctx.db.from('projects').select('id').eq('id',body.project_id).eq('client_id',body.client_id).eq('company_id',ctx.companyId).single();if(!project) throw new Error('Project does not belong to this client.')}
    const values={company_id:ctx.companyId,client_id:body.client_id,project_id:body.project_id || null,cycle_start_day:body.cycle_start_day,net_days:body.net_days,contractor_payment_basis:body.contractor_payment_basis,effective_start:body.effective_start,updated_by:ctx.user.id,updated_at:new Date().toISOString()}
    const {error}=await ctx.db.from('billing_policies').upsert(values,{onConflict:'company_id,client_id,project_id'})
    if(error) throw new Error('Billing settings could not be saved.')
    if(!body.project_id){const {error:termsError}=await ctx.db.from('clients').update({payment_terms:`net_${body.net_days}`}).eq('id',body.client_id).eq('company_id',ctx.companyId);if(termsError) throw new Error('Billing period saved, but client payment terms could not be synchronized. Please retry.')}
    return NextResponse.json({ok:true})
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Settings could not be saved.'},{status:400})}
}
