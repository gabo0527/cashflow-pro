import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import {
  COMMERCIAL_BUCKET,
  MAX_DOCUMENT_BYTES,
  documentInput,
  validId,
} from '@/lib/commercial'
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
      .from('commercial_documents')
      .select('*, versions:commercial_document_versions(*)')
      .eq('client_id', client.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return NextResponse.json(
      { documents: data, role },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return commercialFailure(error)
  }
}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { db, client, user } = await commercialContext(
      req,
      body.client_id,
      true,
    )
    if (body.action === 'reserve') {
      // An immutable version gets its own path; never overwrite an executed file.
      if (
        body.bytes <= 0 ||
        !Number.isInteger(body.bytes) ||
        body.bytes > MAX_DOCUMENT_BYTES ||
        body.mime !== 'application/pdf'
      )
        throw new CommercialError('Choose a PDF file no larger than 20 MB.')
      let documentId = body.document_id
      let created = false
      if (!documentId) {
        let input
        try {
          input = documentInput(body)
        } catch (e) {
          throw new CommercialError((e as Error).message)
        }
        await assertScope(db, client.id, input.project_id, client.company_id)
        const { data, error } = await db
          .from('commercial_documents')
          .insert({
            ...input,
            client_id: client.id,
            company_id: client.company_id,
            created_by: user.id,
          })
          .select('id')
          .single()
        if (error || !data)
          throw new Error(error?.message || 'Unable to create document')
        documentId = data.id
        created = true
      }
      if (!validId(documentId)) throw new CommercialError('Invalid document.')
      const { data: record } = await db
        .from('commercial_documents')
        .select('id,archived_at,deleted_at')
        .eq('id', documentId)
        .eq('client_id', client.id)
        .single()
      if (!record || record.archived_at || record.deleted_at)
        throw new CommercialError(
          'Restore the document before adding a version.',
        )
      const versionId = randomUUID(),
        path = `${client.company_id}/${client.id}/${documentId}/${versionId}.pdf`
      const { data: version, error } = await db.rpc(
        'reserve_commercial_document_version',
        {
          p_document: documentId,
          p_version: versionId,
          p_path: path,
          p_name: String(body.file_name || 'agreement.pdf').slice(0, 160),
          p_bytes: body.bytes,
          p_actor: user.id,
        },
      )
      if (error) {
        if (created)
          await db
            .from('commercial_documents')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', documentId)
        throw new Error(error.message)
      }
      const { data: signed, error: signError } = await db.storage
        .from(COMMERCIAL_BUCKET)
        .createSignedUploadUrl(path)
      if (signError || !signed) {
        await db
          .from('commercial_document_versions')
          .delete()
          .eq('id', versionId)
        if (created)
          await db
            .from('commercial_documents')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', documentId)
        throw new Error(signError?.message || 'Unable to authorize upload')
      }
      return NextResponse.json({
        document_id: documentId,
        version_id: versionId,
        version,
        path,
        token: signed.token,
      })
    }
    if (!validId(body.document_id))
      throw new CommercialError('Choose a document.')
    const { data: document } = await db
      .from('commercial_documents')
      .select('*')
      .eq('id', body.document_id)
      .eq('client_id', client.id)
      .single()
    if (
      !document ||
      (document.deleted_at &&
        !['delete', 'cancel-upload'].includes(body.action))
    )
      throw new CommercialError('Document not found.', 404)
    const transition = async () => {
      const { error } = await db.rpc('transition_commercial_document', {
        p_document: document.id,
        p_actor: user.id,
        p_action: body.action,
        p_version: body.version_id || null,
      })
      if (error) throw new CommercialError(error.message)
    }
    if (body.action === 'complete' || body.action === 'cancel-upload') {
      if (!validId(body.version_id))
        throw new CommercialError('Choose a valid version.')
      const { data: version } = await db
        .from('commercial_document_versions')
        .select('*')
        .eq('id', body.version_id)
        .eq('document_id', document.id)
        .single()
      if (!version) throw new CommercialError('Upload not found.')
      if (version.ready && body.action === 'cancel-upload')
        throw new CommercialError('Upload is no longer pending.')
      if (version.ready && body.action === 'complete')
        return NextResponse.json({ ok: true })
      if (body.action === 'cancel-upload') {
        await transition()
        const { error } = await db.storage
          .from(COMMERCIAL_BUCKET)
          .remove([version.file_path])
        if (error) throw new Error(error.message)
      } else {
        const { data: bytes, error } = await db.storage
          .from(COMMERCIAL_BUCKET)
          .download(version.file_path)
        if (
          error ||
          !bytes ||
          bytes.size > MAX_DOCUMENT_BYTES ||
          bytes.size !== version.file_bytes ||
          !(await bytes.slice(0, 5).text()).startsWith('%PDF-')
        )
          throw new CommercialError(
            'The uploaded file is not a valid PDF. Upload another PDF.',
          )
        await transition()
      }
    } else if (body.action === 'archive' || body.action === 'restore') {
      await transition()
    } else if (body.action === 'delete') {
      // Hide/revoke first. Keep a tombstone and audit trail; retry cleans remaining files if Storage fails.
      await transition()
      const { data: versions, error: listError } = await db
        .from('commercial_document_versions')
        .select('file_path')
        .eq('document_id', document.id)
      if (listError) throw new Error(listError.message)
      if (versions?.length) {
        const { error } = await db.storage
          .from(COMMERCIAL_BUCKET)
          .remove(versions.map((v) => v.file_path))
        if (error) throw new Error(error.message)
      }
    } else throw new CommercialError('Unsupported document action.')
    return NextResponse.json({ ok: true })
  } catch (error) {
    return commercialFailure(error)
  }
}
