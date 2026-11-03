import { getSupabaseAdmin } from './contractor-auth'
import type { BillingPolicy } from './billing-periods'
export async function readBillingPolicies(db: ReturnType<typeof getSupabaseAdmin>,companyId: string): Promise<BillingPolicy[]> {
  const [policies,clients]=await Promise.all([
    db.from('billing_policies').select('*').eq('company_id',companyId),
    db.from('clients').select('id,payment_terms').eq('company_id',companyId),
  ])
  if(policies.error || clients.error) throw new Error('Billing settings could not be loaded. Please try again.')
  const rows: BillingPolicy[]=policies.data || []
  for(const c of clients.data || []) {
    const netDays=c.payment_terms==='due_on_receipt'?0:Number(c.payment_terms?.match(/\d+/)?.[0] || 30)
    const policy=rows.find(p=>p.client_id===c.id && !p.project_id)
    // Client terms remain authoritative across both client editing screens.
    if(policy) policy.net_days=netDays
    else rows.push({client_id:c.id,project_id:null,cycle_start_day:1,net_days:netDays,contractor_payment_basis:'invoice_date',effective_start:'2000-01-01'})
  }
  return rows
}
