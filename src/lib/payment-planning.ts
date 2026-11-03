import { BillingPolicy, billingPolicy, invoiceDueDate } from './billing-periods'
import { isOutstanding, localToday } from './payables'

export type PaymentWindowPreset='month'|'week'|'month_end'|'next_30'|'custom'
const iso=(d:Date)=>d.toISOString().slice(0,10)
export function paymentWindow(preset:Exclude<PaymentWindowPreset,'custom'>,today=localToday()) {
  const d=new Date(`${today}T12:00:00Z`),year=d.getUTCFullYear(),month=d.getUTCMonth()
  if(preset==='month') return {start:iso(new Date(Date.UTC(year,month,1,12))),end:iso(new Date(Date.UTC(year,month+1,0,12)))}
  if(preset==='week'){d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);const end=new Date(d);end.setUTCDate(end.getUTCDate()+6);return {start:iso(d),end:iso(end)}}
  if(preset==='next_30'){const end=new Date(d);end.setUTCDate(end.getUTCDate()+29);return {start:today,end:iso(end)}}
  // Last seven dates of the month plus the first seven of the next month.
  // During the opening week, keep the preceding month-end run selected.
  const closingMonth=month-(d.getUTCDate()<=7?1:0)
  const endOfMonth=new Date(Date.UTC(year,closingMonth+1,0,12))
  const start=new Date(endOfMonth);start.setUTCDate(start.getUTCDate()-6)
  return {start:iso(start),end:iso(new Date(Date.UTC(year,closingMonth+1,7,12)))}
}
export function validPaymentWindow(start:string,end:string) {
  try{return start<=end && invoiceDueDate(start,0)===start && invoiceDueDate(end,0)===end}catch{return false}
}
export interface PlanningInvoice {
  status:string;invoice_date:string;period_end?:string;due_date?:string|null;client_id?:string|null;
  payment_basis?:string;client_payment_received_on?:string|null;client_invoice_date?:string|null;client_net_days?:number|null;
  billing_snapshot?:Partial<BillingPolicy>|null;contractor_invoice_lines?:{client_id?:string|null;project_id?:string|null}[]
}
export function assumedClientInvoiceDate(periodEnd:string) {
  invoiceDueDate(periodEnd,0)
  const d=new Date(`${periodEnd}T12:00:00Z`);return iso(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0,12)))
}
export function invoiceClientScope(invoice:PlanningInvoice) {
  const ids=Array.from(new Set([invoice.client_id,...(invoice.contractor_invoice_lines || []).map(l=>l.client_id)].filter((v):v is string=>!!v)))
  return {clientId:ids.length===1?ids[0]:null,mixed:ids.length>1}
}
export function paymentTiming(invoice:PlanningInvoice,policies:BillingPolicy[]) {
  const scope=invoiceClientScope(invoice)
  const policy=billingPolicy(policies,scope.clientId || '',invoice.billing_snapshot?.project_id)
  const conditional=invoice.payment_basis==='client_payment' || policy.contractor_payment_basis==='client_payment'
  const netDays=invoice.client_net_days ?? invoice.billing_snapshot?.net_days ?? policy.net_days
  const unscheduledFunds=conditional && !!invoice.client_payment_received_on && !invoice.due_date
  const ready=unscheduledFunds && invoice.status==='approved'
  let date:string|null=null,source:'payout'|'client_invoice'|'estimate'|'receipt'|'contractor_terms'|'review'='review',reason=''
  try {
    if(scope.mixed) reason='Invoice spans multiple clients. Review the client allocations before assigning one payment date.'
    else if(!scope.clientId) reason='Assign a client or internal overhead before relying on a payment date.'
    else if(conditional && invoice.due_date){date=invoiceDueDate(invoice.due_date,0);source='payout'}
    else if(unscheduledFunds){date=invoiceDueDate(invoice.client_payment_received_on!,0);source='receipt'}
    else if(conditional && scope.clientId){date=invoiceDueDate(invoice.client_invoice_date || assumedClientInvoiceDate(invoice.period_end || invoice.invoice_date),netDays);source=invoice.client_invoice_date?'client_invoice':'estimate'}
    else if(invoice.due_date){date=invoiceDueDate(invoice.due_date,0);source='contractor_terms'}
    else reason='A payment date or client schedule is needed.'
  }catch{reason='Invoice date or payment terms need review.'}
  let earliest=date,latest=date
  if(date && source==='estimate'){const early=new Date(`${date}T12:00:00Z`),late=new Date(early);early.setUTCDate(early.getUTCDate()-5);late.setUTCDate(late.getUTCDate()+5);earliest=iso(early);latest=iso(late)}
  return {date,earliest,latest,source,reason,netDays,conditional,ready,unscheduledFunds,clientId:scope.clientId,mixed:scope.mixed,estimated:source==='estimate',needsReview:source==='review',outstanding:isOutstanding(invoice)}
}
export function inPaymentWindow(invoice:PlanningInvoice,policies:BillingPolicy[],start:string,end:string) {
  if(!isOutstanding(invoice) || !validPaymentWindow(start,end)) return false
  const timing=paymentTiming(invoice,policies)
  return timing.unscheduledFunds && !timing.mixed || !!timing.earliest && !!timing.latest && timing.latest>=start && timing.earliest<=end
}
