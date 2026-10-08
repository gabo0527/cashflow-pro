import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/contractor-auth'
import { CommercialRole, canManageCommercial, validId } from './commercial'

export class CommercialError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message)
  }
}
export async function commercialContext(
  req: NextRequest,
  clientId: unknown,
  write = false,
) {
  if (!validId(clientId)) throw new CommercialError('Choose a valid client.')
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]
  if (!token)
    throw new CommercialError('Sign in to access commercial documents.', 401)
  const db = getSupabaseAdmin()
  const { data: auth, error: authError } = await db.auth.getUser(token)
  if (authError || !auth.user)
    throw new CommercialError('Your session has expired.', 401)
  // Membership is stored separately from editable profiles/team records.
  const { data: client, error: clientError } = await db
    .from('clients')
    .select('id, company_id, name')
    .eq('id', clientId)
    .single()
  if (clientError || !client?.company_id)
    throw new CommercialError('Client not found.', 404)
  const { data: access, error } = await db
    .from('commercial_access')
    .select('role')
    .eq('company_id', client.company_id)
    .eq('user_id', auth.user.id)
    .maybeSingle()
  if (error)
    throw new CommercialError(
      'Commercial workspace setup is not available yet.',
      503,
    )
  if (!access || !['owner', 'admin', 'viewer'].includes(access.role))
    throw new CommercialError(
      'You do not have commercial access for this client.',
      403,
    )
  const role = access.role as CommercialRole
  if (write && !canManageCommercial(role))
    throw new CommercialError(
      'Document management requires an owner or administrator.',
      403,
    )
  return { db, client, user: auth.user, role }
}
export async function assertScope(
  db: ReturnType<typeof getSupabaseAdmin>,
  clientId: string,
  scope: unknown,
  companyId: string,
) {
  if (!scope) return
  if (!validId(scope)) throw new CommercialError('Choose a valid scope.')
  const { data, error } = await db
    .from('projects')
    .select('id')
    .eq('id', scope)
    .eq('client_id', clientId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (error || !data)
    throw new CommercialError('This scope does not belong to the client.', 403)
}
export function commercialFailure(error: unknown) {
  if (error instanceof CommercialError)
    return NextResponse.json({ error: error.message }, { status: error.status })
  console.error(
    'Commercial operation failed:',
    error instanceof Error ? error.message : 'Unknown error',
  )
  return NextResponse.json(
    { error: 'The operation could not be completed. Please try again.' },
    { status: 500 },
  )
}
