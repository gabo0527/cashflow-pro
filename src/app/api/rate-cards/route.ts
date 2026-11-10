import { NextResponse } from 'next/server'
import { adminContext } from '@/lib/admin-context'
import { validId } from '@/lib/commercial'

export async function POST(request: Request) {
  const ctx = await adminContext(request)
  if (!ctx) return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  try {
    const body = await request.json()
    if ((body.id && !validId(body.id)) || !Array.isArray(body.project_ids) ||
      !body.project_ids.every(validId) || body.project_ids.length > 500 || !body.rate || !validId(body.rate.team_member_id) || !validId(body.rate.client_id)) {
      return NextResponse.json({ error: 'Choose a contractor, client, and valid projects.' }, { status: 400 })
    }
    if (['rate','cost_amount','baseline_hours','revenue_amount'].some(field => body.rate[field] != null && !Number.isFinite(Number(body.rate[field])))) {
      return NextResponse.json({error:'Enter valid rate card amounts.'},{status:400})
    }
    const { data, error } = await ctx.db.rpc('save_rate_card_assignments', {
      p_company_id: ctx.companyId, p_rate_id: body.id || null,
      p_rate: body.rate, p_project_ids: body.project_ids,
    })
    if (error) return NextResponse.json({ error: 'Rate card and project selections were not saved. Check the selections and retry.' }, { status: 400 })
    return NextResponse.json({ rate: data })
  } catch {
    return NextResponse.json({ error: 'Rate card could not be saved. Please retry.' }, { status: 400 })
  }
}
