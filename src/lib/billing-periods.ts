export interface BillingPolicy {
  id?: string
  client_id: string
  project_id: string | null
  cycle_start_day: 1 | 26
  net_days: number
  contractor_payment_basis: 'invoice_date' | 'client_payment'
  effective_start: string
}
const iso = (date: Date) => date.toISOString().slice(0,10)
// Billing months follow the closing month, including work that starts earlier.
// Existing invoice dates stay intact; payment dates never determine this label.
export function invoiceBillingMonth(invoice: { period_end?: string | null; period_start?: string | null; invoice_date?: string | null }) {
  return (invoice.period_end || invoice.period_start || invoice.invoice_date || '').slice(0,7)
}
export function billingMonthLabel(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return 'Billing month unavailable'
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}
export function billingPeriod(closingMonth: string, startDay: 1 | 26 = 1) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(closingMonth)) throw new Error('Choose a valid billing month.')
  const [year,month] = closingMonth.split('-').map(Number)
  const start = new Date(Date.UTC(year,month-1,1,12))
  const end = new Date(Date.UTC(year,month,0,12))
  if(startDay===26) {start.setUTCMonth(start.getUTCMonth()-1);start.setUTCDate(26);end.setUTCDate(25)}
  return {start:iso(start),end:iso(end),label:`${iso(start)} – ${iso(end)}`,closingMonth}
}
export function periodContaining(date: string, startDay: 1 | 26 = 1) {
  const value = new Date(`${date}T12:00:00Z`)
  if(!Number.isFinite(value.getTime()) || iso(value)!==date) throw new Error('Choose a valid date.')
  if(startDay===26 && value.getUTCDate()>=26) value.setUTCMonth(value.getUTCMonth()+1,1)
  return billingPeriod(iso(value).slice(0,7),startDay)
}
export function lastClosedBillingPeriod(today: string, startDay: 1 | 26 = 1) {
  const period=periodContaining(today,startDay)
  const previous=new Date(`${period.start}T12:00:00Z`);previous.setUTCDate(previous.getUTCDate()-1)
  return periodContaining(iso(previous),startDay)
}
export function invoiceDueDate(invoiceDate: string, netDays: number) {
  const date=new Date(`${invoiceDate}T12:00:00Z`)
  if(!Number.isFinite(date.getTime()) || iso(date)!==invoiceDate || !Number.isInteger(netDays) || netDays<0 || netDays>365) throw new Error('Choose a valid invoice date and payment terms.')
  date.setUTCDate(date.getUTCDate()+netDays)
  return iso(date)
}
export function billingPolicy(policies: BillingPolicy[],clientId: string,projectId?: string | null,asOf?: string): BillingPolicy {
  const candidates=policies.filter(p=>p.client_id===clientId && (!asOf || p.effective_start<=asOf))
  return candidates.find(p=>p.project_id===projectId && !!projectId) || candidates.find(p=>!p.project_id) || {client_id:clientId,project_id:null,cycle_start_day:1,net_days:30,contractor_payment_basis:'invoice_date',effective_start:'2000-01-01'}
}
export function contractorPaymentLabel(invoice: {payment_basis?: string;client_payment_received_on?: string | null;due_date?: string | null;status?: string}) {
  if(invoice.status==='paid') return 'Paid'
  if(invoice.payment_basis!=='client_payment') return null
  if(!invoice.client_payment_received_on) return 'Awaiting client payment'
  return invoice.due_date ? 'Client paid · scheduled due date' : 'Client paid · ready to schedule'
}
