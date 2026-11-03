export const isLumpSumCostType=(value?:string|null)=>['lumpsum','monthly','fixed'].includes((value || '').toLowerCase().replace(/[\s_-]/g,''))
export async function pooledInvoiceEligibility(db:any,companyId:string,memberId:string) {
  const {data:member,error}=await db.from('team_members').select('id,cost_type').eq('id',memberId).eq('company_id',companyId).single()
  if(error || !member) throw new Error('Contractor not found.')
  let fixed=isLumpSumCostType(member.cost_type)
  if(!fixed){const {data:rates,error}=await db.from('bill_rates').select('cost_type').eq('team_member_id',memberId).eq('is_active',true);if(error)throw new Error('Contractor terms could not be verified.');fixed=!!rates?.length && rates.every((r:any)=>isLumpSumCostType(r.cost_type))}
  if(!fixed) throw new Error('Combined Net 60 invoices are available only for lump-sum contractors.')
  const {data:assignments,error:assignmentError}=await db.from('team_project_assignments').select('project_id').eq('team_member_id',memberId).eq('company_id',companyId)
  if(assignmentError) throw new Error('Project assignments could not be verified.')
  const {data:projects,error:projectError}=await db.from('projects').select('id,client_id').eq('company_id',companyId).in('id',(assignments || []).map((a:any)=>a.project_id))
  const clientIds=Array.from(new Set<string>((projects || []).map((p:any)=>p.client_id).filter(Boolean)))
  if(projectError || clientIds.length<2) throw new Error('A combined invoice must cover at least two assigned clients.')
  return {clientIds,projectIds:(projects || []).map((p:any)=>p.id)}
}

export function coversDateRange(periods:{start:string;end:string}[],start:string,end:string) {
  const before=new Date(`${start}T12:00:00Z`);before.setUTCDate(before.getUTCDate()-1)
  let through=before.toISOString().slice(0,10)
  for(const period of [...periods].sort((a,b)=>a.start.localeCompare(b.start))) {
    const next=new Date(`${through}T12:00:00Z`);next.setUTCDate(next.getUTCDate()+1)
    if(period.start>next.toISOString().slice(0,10)) break
    if(period.end>through) through=period.end
    if(through>=end) return true
  }
  return false
}
