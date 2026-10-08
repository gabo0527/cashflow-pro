import { NextRequest, NextResponse } from 'next/server'
import {
  commercialContext,
  CommercialError,
  commercialFailure,
} from '@/lib/commercial-server'
import { COMMERCIAL_BUCKET, validId } from '@/lib/commercial'
export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  try {
    const body = await req.json(),
      { db, client } = await commercialContext(req, body.client_id)
    if (!validId(body.document_id) || !validId(body.version_id))
      throw new CommercialError('Choose a document version.')
    const { data: document } = await db
      .from('commercial_documents')
      .select('id')
      .eq('id', body.document_id)
      .eq('client_id', client.id)
      .is('deleted_at', null)
      .single()
    if (!document) throw new CommercialError('Document not found.', 404)
    const { data: version } = await db
      .from('commercial_document_versions')
      .select('file_path,file_name')
      .eq('id', body.version_id)
      .eq('document_id', document.id)
      .eq('ready', true)
      .single()
    if (!version) throw new CommercialError('Version not found.', 404)
    const { data, error } = await db.storage
      .from(COMMERCIAL_BUCKET)
      .createSignedUrl(
        version.file_path,
        120,
        body.download ? { download: version.file_name } : undefined,
      )
    if (error || !data)
      throw new Error(error?.message || 'Unable to open document')
    return NextResponse.json(
      { url: data.signedUrl },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return commercialFailure(error)
  }
}
