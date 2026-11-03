import { NextResponse } from 'next/server'
import { adminContext } from '@/lib/admin-context'
import { invoiceObligations } from '@/lib/invoice-obligations'
export const dynamic = 'force-dynamic'
export async function GET(request: Request) {
  const ctx = await adminContext(request)
  if (!ctx) return NextResponse.json({error:'Not authorized'},{status:401})
  try {
    const month = new URL(request.url).searchParams.get('month') || undefined
    const rows = await invoiceObligations(ctx.db,ctx.companyId,month)
    return NextResponse.json({rows})
  } catch (error) { return NextResponse.json({error:error instanceof Error ? error.message : 'Follow-ups unavailable'},{status:503}) }
}
export async function POST(request: Request) {
  const ctx = await adminContext(request)
  if (!ctx) return NextResponse.json({error:'Not authorized'},{status:401})
  const body = await request.json()
  if (typeof body.required !== 'boolean' || !body.id || !body.required && !String(body.note || '').trim()) return NextResponse.json({error:'Provide a reason for the monthly exemption.'},{status:400})
  const { data, error } = await ctx.db.from('contractor_invoice_obligations').update({required:body.required,exemption_note:body.required ? null : String(body.note).slice(0,500),exempted_by:ctx.user.id}).eq('id',body.id).eq('company_id',ctx.companyId).select('id').single()
  if (error || !data) return NextResponse.json({error:'Follow-up could not be updated.'},{status:400})
  return NextResponse.json({ok:true})
}
