export const DOCUMENT_CATEGORIES = [
  'NDA',
  'MPSA',
  'SOW',
  'Change order',
  'Amendment',
  'Other',
] as const
export const COMMERCIAL_BUCKET = 'commercial-documents'
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024
export type CommercialRole = 'owner' | 'admin' | 'viewer'
export interface CommercialDocument {
  id: string
  client_id: string
  project_id: string | null
  title: string
  category: string
  effective_date: string
  expiry_date: string | null
  archived_at: string | null
  deleted_at: string | null
  tags: string[]
  created_at: string
}
export interface DocumentVersion {
  id: string
  document_id: string
  version: number
  file_path: string
  file_name: string
  uploaded_at: string
  ready: boolean
}
export interface ScopeContact {
  id: string
  project_id: string
  name: string
  title: string
  organization: string
  email: string
  phone: string
  purpose: string
  is_primary: boolean
  archived_at: string | null
}
export function validId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
}
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false
  const date = new Date(value + 'T12:00:00Z')
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  )
}
export function documentInput(body: Record<string, unknown>) {
  const title = String(body.title || '').trim()
  const category = String(body.category || '')
  if (!title || title.length > 160)
    throw new Error('Enter a document title, up to 160 characters.')
  if (!(DOCUMENT_CATEGORIES as readonly string[]).includes(category))
    throw new Error('Choose a document category.')
  if (!validDate(body.effective_date))
    throw new Error('Choose a valid effective date.')
  if (
    body.expiry_date &&
    (!validDate(body.expiry_date) || body.expiry_date < body.effective_date)
  )
    throw new Error('Expiry must be on or after the effective date.')
  if (body.project_id && !validId(body.project_id))
    throw new Error('Choose a valid scope.')
  const tags = Array.isArray(body.tags)
    ? body.tags
        .map(String)
        .map((v) => v.trim())
        .filter(Boolean)
    : []
  if (tags.length > 12 || tags.some((v) => v.length > 40))
    throw new Error('Use up to 12 tags, each up to 40 characters.')
  return {
    title,
    category,
    project_id: body.project_id || null,
    effective_date: body.effective_date,
    expiry_date: body.expiry_date || null,
    tags,
  }
}
export function contactInput(body: Record<string, unknown>) {
  const name = String(body.name || '').trim(),
    email = String(body.email || '').trim()
  if (!name || name.length > 100)
    throw new Error('Enter a contact name, up to 100 characters.')
  if (
    email &&
    (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  )
    throw new Error('Enter a valid email address.')
  const values: Record<string, string> = {}
  for (const key of ['title', 'organization', 'phone', 'purpose']) {
    values[key] = String(body[key] || '').trim()
    if (values[key].length > 100)
      throw new Error('Contact fields must be 100 characters or fewer.')
  }
  return { name, email, ...values, is_primary: body.is_primary === true }
}
export function canManageCommercial(role: CommercialRole) {
  return role === 'owner' || role === 'admin'
}
