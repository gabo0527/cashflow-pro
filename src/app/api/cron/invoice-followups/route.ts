import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/contractor-auth'
import { invoiceObligations } from '@/lib/invoice-obligations'
import { previousBillingMonth } from '@/lib/payables'
import { sendMissingInvoiceReminder } from '@/lib/email'
export const dynamic = 'force-dynamic'
export const maxDuration = 60
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({error:'Unauthorized'},{status:401})
  try {
    const db = getSupabaseAdmin()
    const {data:companies,error} = await db.from('commercial_access').select('company_id').eq('role','owner')
    if (error) throw error
    let sent=0,failed=0
    for (const companyId of Array.from(new Set((companies || []).map(c=>c.company_id)))) {
      // Retain outstanding follow-ups from earlier months after rollout.
      const {data:older,error:oldError} = await db.from('contractor_invoice_obligations').select('period_start').eq('company_id',companyId).eq('reminder_state','pending')
      if (oldError) throw oldError
      const months = Array.from(new Set([previousBillingMonth().start,...(older || []).map(o=>o.period_start)]))
      for (const month of months) {
        const rows = await invoiceObligations(db,companyId,month)
        for (const row of rows) {
          if (!row.required || row.received || !row.overdue || row.reminder_state !== 'pending') continue
          // Conditional claim prevents parallel cron runs from emailing twice.
          const {data:claimed,error:claimError} = await db.from('contractor_invoice_obligations').update({reminder_state:'sending',claimed_at:new Date().toISOString()}).eq('id',row.id).eq('reminder_state','pending').eq('required',true).select('id').maybeSingle()
          if (claimError) throw claimError
          if (!claimed) continue
          // Re-check immediately before sending, including active employment.
          const fresh = (await invoiceObligations(db,companyId,month)).find(r=>r.id===row.id)
          if (!fresh || fresh.received || !fresh.required) {
            await db.from('contractor_invoice_obligations').update({reminder_state:'pending',claimed_at:null}).eq('id',row.id)
            continue
          }
          const result = row.email ? await sendMissingInvoiceReminder({name:row.name,email:row.email,periodEnd:row.period_end,idempotencyKey:`missing-invoice/${row.id}`}) : {success:false,error:'No email address on file',id:undefined}
          const {error:saveError} = await db.from('contractor_invoice_obligations').update(result.success ? {reminder_state:'sent',reminded_at:new Date().toISOString(),email_id:result.id,error:null} : {reminder_state:'failed',error:String(result.error).slice(0,500)}).eq('id',row.id)
          if (saveError) throw saveError // Leave sending visible for manual delivery review.
          if(result.success) sent++; else failed++
        }
      }
    }
    return NextResponse.json({ok:true,sent,failed})
  } catch(error) {
    console.error('Invoice reminder run failed:',error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({error:'Invoice reminders require review.'},{status:500})
  }
}
