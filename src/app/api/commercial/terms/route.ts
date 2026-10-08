import { NextRequest, NextResponse } from 'next/server'
import {
  commercialContext,
  assertScope,
  CommercialError,
  commercialFailure,
} from '@/lib/commercial-server'
import { validDate, validId } from '@/lib/commercial'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest) {
  try {
    const { db, client, role } = await commercialContext(
      req,
      req.nextUrl.searchParams.get('client'),
    )
    const project = req.nextUrl.searchParams.get('project')
    await assertScope(db, client.id, project, client.company_id)
    if (!validId(project)) throw new CommercialError('Choose a scope.')
    const [terms, history, documents] = await Promise.all([
      db
        .from('project_terms')
        .select('*')
        .eq('project_id', project)
        .eq('company_id', client.company_id)
        .order('effective_start'),
      db
        .from('project_terms_revisions')
        .select('id,snapshot,operation,created_at,actor_id')
        .eq('project_id', project)
        .eq('company_id', client.company_id)
        .order('created_at', { ascending: false }),
      db
        .from('commercial_documents')
        .select(
          'id,title,project_id,versions:commercial_document_versions(ready)',
        )
        .eq('client_id', client.id)
        .is('deleted_at', null)
        .is('archived_at', null),
    ])
    if (terms.error || history.error || documents.error)
      throw new Error('Unable to load commercial terms')
    return NextResponse.json(
      {
        terms: terms.data,
        history: history.data,
        documents: (documents.data || []).filter(
          (d) =>
            (!d.project_id || d.project_id === project) &&
            d.versions.some((v) => v.ready),
        ),
        role,
      },
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
    if (
      !validId(body.project_id) ||
      !validId(body.document_id) ||
      !validDate(body.start) ||
      (body.end && (!validDate(body.end) || body.end < body.start))
    )
      throw new CommercialError(
        'Choose an agreement and valid effective dates.',
      )
    if (
      !['tm_nte', 'tm_open', 'lump_sum'].includes(body.terms) ||
      !['monthly', 'overall'].includes(body.cadence)
    )
      throw new CommercialError('Choose valid commercial terms.')
    if (
      body.terms !== 'tm_open' &&
      (!Number.isFinite(body.amount) || body.amount <= 0)
    )
      throw new CommercialError('Enter a positive budget or monthly fee.')
    if (
      body.terms === 'lump_sum' &&
      (body.cadence !== 'monthly' || !body.start.endsWith('-01'))
    )
      throw new CommercialError(
        'Monthly fee changes start on the first day of a month.',
      )
    const { data, error } = await db.rpc('append_commercial_terms', {
      p_project: body.project_id,
      p_actor: user.id,
      p_terms: body.terms,
      p_start: body.start,
      p_end: body.end || null,
      p_amount: body.terms === 'tm_open' ? null : body.amount,
      p_cadence: body.terms === 'tm_nte' ? body.cadence : 'monthly',
      p_document: body.document_id,
    })
    if (error) throw new CommercialError(error.message)
    return NextResponse.json({ id: data })
  } catch (error) {
    return commercialFailure(error)
  }
}
