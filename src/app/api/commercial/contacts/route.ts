import { NextRequest, NextResponse } from 'next/server'
import { contactInput, validId } from '@/lib/commercial'
import {
  commercialContext,
  assertScope,
  CommercialError,
  commercialFailure,
} from '@/lib/commercial-server'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  try {
    const { db, client, role } = await commercialContext(
      req,
      req.nextUrl.searchParams.get('client'),
    )
    const { data, error } = await db
      .from('project_scope_contacts')
      .select('*')
      .eq('client_id', client.id)
      .is('archived_at', null)
      .order('is_primary', { ascending: false })
      .order('name')
    if (error) throw new Error(error.message)
    return NextResponse.json(
      { contacts: data, role },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return commercialFailure(error)
  }
}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json(),
      { db, client, user } = await commercialContext(req, body.client_id, true)
    await assertScope(db, client.id, body.project_id, client.company_id)
    if (!validId(body.project_id) || (body.id && !validId(body.id)))
      throw new CommercialError('Choose a valid scope contact.')
    let input
    try {
      input = contactInput(body)
    } catch (e) {
      throw new CommercialError((e as Error).message)
    }
    const { data, error } = await db.rpc('save_project_scope_contact', {
      p_id: body.id || null,
      p_project: body.project_id,
      p_client: client.id,
      p_company: client.company_id,
      p_actor: user.id,
      p_contact: input,
    })
    if (error) throw new Error(error.message)
    return NextResponse.json({ contact: data })
  } catch (error) {
    return commercialFailure(error)
  }
}
