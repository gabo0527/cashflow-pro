import { getSupabaseAdmin } from './contractor-auth'
import { INVOICE_FOLLOWUP_START_MONTH, localToday, previousBillingMonth, thirdBusinessDayAfterMonth } from './payables'

export async function invoiceObligations(db: ReturnType<typeof getSupabaseAdmin>, companyId: string, month = previousBillingMonth().start) {
  if (!/^\d{4}-\d{2}-01$/.test(month) || new Date(`${month}T12:00:00Z`).toISOString().slice(0,10) !== month || month >= localToday().slice(0,7) + '-01') throw new Error('Choose a completed billing month.')
  // Earlier billing periods belong to the previous system. Do not flag or seed them.
  if (month < INVOICE_FOLLOWUP_START_MONTH) return []
  const end = new Date(`${month}T12:00:00Z`)
  end.setUTCMonth(end.getUTCMonth() + 1); end.setUTCDate(0)
  const periodEnd = end.toISOString().slice(0,10)
  const [members, invoiceResult, holidayResult] = await Promise.all([
    db.from('team_members').select('id,name,email,start_date').eq('company_id',companyId).eq('status','active').eq('employment_type','contractor'),
    db.from('contractor_invoices').select('id,team_member_id,status,period_start,period_end').eq('company_id',companyId).lte('period_start',periodEnd).gte('period_end',month),
    db.from('invoice_business_holidays').select('day').eq('company_id',companyId),
  ])
  for (const result of [members,invoiceResult,holidayResult]) if (result.error) throw new Error('Invoice follow-up data could not be loaded.')
  const eligible = (members.data || []).filter(m => !m.start_date || m.start_date <= periodEnd)
  if (eligible.length) {
    const { error } = await db.from('contractor_invoice_obligations').upsert(eligible.map(m => ({company_id:companyId,team_member_id:m.id,period_start:month,period_end:periodEnd})), {onConflict:'team_member_id,period_start',ignoreDuplicates:true})
    if (error) throw new Error('Invoice follow-up tracking could not be prepared.')
  }
  const { data, error } = await db.from('contractor_invoice_obligations').select('*').eq('company_id',companyId).eq('period_start',month)
  if (error) throw new Error('Invoice follow-up tracking could not be loaded.')
  const deadline = thirdBusinessDayAfterMonth(periodEnd,(holidayResult.data || []).map(h => h.day))
  return (data || []).flatMap(o => {
    const member = eligible.find(m => m.id === o.team_member_id)
    if (!member) return []
    const received = (invoiceResult.data || []).some(i => i.team_member_id === member.id && !['draft','rejected'].includes(i.status))
    return [{...o,name:member.name,email:member.email,received,grace_through:deadline,overdue:localToday()>deadline}]
  })
}
