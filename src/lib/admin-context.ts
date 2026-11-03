import { getSupabaseAdmin } from './contractor-auth'
import { isAdminEmail } from './admin-allowlist'

export async function adminContext(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1]
  if (!token) return null
  const db = getSupabaseAdmin()
  const { data, error } = await db.auth.getUser(token)
  if (error || !data.user?.email || !isAdminEmail(data.user.email)) return null
  const { data: access, error: accessError } = await db.from('commercial_access')
    .select('company_id, role').eq('user_id', data.user.id).in('role', ['owner', 'admin']).single()
  if (accessError || !access) return null
  return { db, user: data.user, companyId: access.company_id as string, token }
}
