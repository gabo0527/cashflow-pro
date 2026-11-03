import { getSupabaseAdmin } from './contractor-auth'
import { INVOICE_FOLLOWUP_START_MONTH, localToday, previousBillingMonth, thirdBusinessDayAfterMonth } from './payables'
import { coversDateRange } from './pooled-invoices'
import { billingPeriod, billingPolicy } from './billing-periods'
import { readBillingPolicies } from './billing-policy-server'

export async function invoiceObligations(db: ReturnType<typeof getSupabaseAdmin>, companyId: string, month = previousBillingMonth().start) {
  const today=localToday()
  if (!/^\d{4}-\d{2}-01$/.test(month) || new Date(`${month}T12:00:00Z`).toISOString().slice(0,10) !== month || month > today.slice(0,7) + '-01') throw new Error('Choose a current or completed billing month.')
  if (month < INVOICE_FOLLOWUP_START_MONTH) return []
  const monthEnd=billingPeriod(month.slice(0,7)).end
  const earliest=billingPeriod(month.slice(0,7),26).start
  const [members,assignments,projects,invoiceResult,holidayResult,legacy,policies] = await Promise.all([
    db.from('team_members').select('id,name,email,start_date').eq('company_id',companyId).eq('status','active').eq('employment_type','contractor'),
    db.from('team_project_assignments').select('team_member_id,project_id,start_date,end_date,is_active').eq('company_id',companyId),
    db.from('projects').select('id,client_id,name,status,start_date,end_date').eq('company_id',companyId),
    db.from('contractor_invoices').select('id,team_member_id,client_id,status,period_start,period_end,payment_group,billing_snapshot,contractor_invoice_lines(client_id,project_id)').eq('company_id',companyId).lte('period_start',monthEnd).gte('period_end',earliest),
    db.from('invoice_business_holidays').select('day').eq('company_id',companyId),
    db.from('contractor_invoice_obligations').select('*').eq('company_id',companyId).eq('period_start',month),
    readBillingPolicies(db,companyId),
  ])
  for (const result of [members,assignments,projects,invoiceResult,holidayResult,legacy]) if (result.error) throw new Error('Invoice follow-up data could not be loaded.')
  const expected: any[]=[]
  for(const member of members.data || []) {
    const scoped=(projects.data || []).filter(p=>(assignments.data || []).some(a=>a.team_member_id===member.id && a.project_id===p.id && (a.is_active!==false || !!a.end_date) && (!a.start_date || a.start_date<=monthEnd) && (!a.end_date || a.end_date>=earliest)) && p.client_id && (!p.start_date || p.start_date<=monthEnd) && (!p.end_date || p.end_date>=earliest) && (p.status==='active' || p.end_date))
    const scopes=new Map<string,{client_id:string|null;project_id:string|null;client_name:string}>()
    for(const project of scoped) {
      const hasOverrides=policies.some(p=>p.client_id===project.client_id && !!p.project_id)
      const projectId=hasOverrides?project.id:null
      scopes.set(`${project.client_id}/${projectId}`,{client_id:project.client_id,project_id:projectId,client_name:projectId?project.name:''})
    }
    // Unassigned contractors still have one calendar-month submission obligation.
    if(!scopes.size && !(assignments.data || []).some(a=>a.team_member_id===member.id)) scopes.set('unassigned',{client_id:null,project_id:null,client_name:'Unassigned work'})
    for(const scope of Array.from(scopes.values())) {
      const policy=billingPolicy(policies,scope.client_id || '',scope.project_id)
      const period=billingPeriod(month.slice(0,7),policy.cycle_start_day)
      if(period.end<'2026-10-31' || period.end>=today || member.start_date && member.start_date>period.end) continue
      if(scope.client_id && !scoped.some(p=>p.client_id===scope.client_id && (!scope.project_id || scope.project_id===p.id) && (!p.start_date || p.start_date<=period.end) && (!p.end_date || p.end_date>=period.start) && (assignments.data || []).some(a=>a.team_member_id===member.id && a.project_id===p.id && (!a.start_date || a.start_date<=period.end) && (!a.end_date || a.end_date>=period.start)))) continue
      const old=policy.cycle_start_day===1 ? (legacy.data || []).find(o=>o.team_member_id===member.id) : null
      expected.push({company_id:companyId,team_member_id:member.id,client_id:scope.client_id,project_id:scope.project_id,closing_month:month,period_start:period.start,period_end:period.end,...(old?{required:old.required,exemption_note:old.exemption_note,exempted_by:old.exempted_by,reminder_state:old.reminder_state,claimed_at:old.claimed_at,reminded_at:old.reminded_at,email_id:old.email_id,error:old.error}:{})})
    }
  }
  if(expected.length) {
    const {error}=await db.from('contractor_billing_obligations').upsert(expected,{onConflict:'team_member_id,client_id,project_id,closing_month',ignoreDuplicates:true})
    if(error) throw new Error('Invoice follow-up tracking could not be prepared.')
  }
  const {data,error}=await db.from('contractor_billing_obligations').select('*').eq('company_id',companyId).eq('closing_month',month)
  if(error) throw new Error('Invoice follow-up tracking could not be loaded.')
  const {data:clients,error:clientError}=await db.from('clients').select('id,name').eq('company_id',companyId)
  if(clientError) throw new Error('Client names could not be loaded.')
  return (data || []).flatMap(o=>{
    const member=(members.data || []).find(m=>m.id===o.team_member_id)
    if(!member || !expected.some(e=>e.team_member_id===o.team_member_id && e.client_id===o.client_id && e.project_id===o.project_id)) return []
    const received=(invoiceResult.data || []).some(i=>i.team_member_id===member.id && !['draft','rejected'].includes(i.status) && i.period_start<=o.period_start && i.period_end>=o.period_end && (!o.client_id || (o.project_id ? (i.billing_snapshot as any)?.project_id===o.project_id || (i.contractor_invoice_lines || []).some(l=>l.project_id===o.project_id) : i.client_id===o.client_id || (i.contractor_invoice_lines || []).some(l=>l.client_id===o.client_id))))
    const pooled=(invoiceResult.data || []).filter(i=>i.team_member_id===member.id && i.payment_group==='pooled_lump_sum' && !['draft','rejected'].includes(i.status) && ((i.billing_snapshot as any)?.pooled_client_ids || []).includes(o.client_id) && (!o.project_id || ((i.billing_snapshot as any)?.pooled_project_ids || []).includes(o.project_id)))
    const pooledReceived=coversDateRange(pooled.map(i=>({start:i.period_start,end:i.period_end})),o.period_start,o.period_end)
    const deadline=thirdBusinessDayAfterMonth(o.period_end,(holidayResult.data || []).map(h=>h.day))
    const clientName=(clients || []).find(c=>c.id===o.client_id)?.name || 'Unassigned work'
    const projectName=(projects.data || []).find(p=>p.id===o.project_id)?.name
    return [{...o,name:member.name,email:member.email,client_name:clientName+(projectName?` · ${projectName}`:''),received:received || pooledReceived,grace_through:deadline,overdue:today>deadline}]
  })
}
