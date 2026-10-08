'use client'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText,
  Plus,
  X,
  MoreHorizontal,
  Archive,
  Download,
  Loader2,
  Search,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import useCommercialDialog from './useCommercialDialog'
import { supabase } from '@/lib/supabase'
import {
  COMMERCIAL_BUCKET,
  DOCUMENT_CATEGORIES,
  MAX_DOCUMENT_BYTES,
  CommercialDocument,
  DocumentVersion,
  CommercialRole,
  canManageCommercial,
} from '@/lib/commercial'

export async function commercialRequest(path: string, body?: unknown) {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) throw new Error('Sign in to access the commercial workspace.')
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await response.json()
  if (!response.ok)
    throw new Error(data.error || 'Unable to complete the operation.')
  return data
}
export function MultiSelect({
  label,
  choices,
  selected,
  onChange,
}: {
  label: string
  choices: { id: string; label: string }[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  return (
    <details className="commercial-picker">
      <summary>
        {label}
        <span>
          {selected.length === choices.length
            ? 'All'
            : `${selected.length} selected`}
        </span>
      </summary>
      <div className="commercial-picker-menu">
        <div className="flex justify-between pb-2">
          <button
            type="button"
            onClick={() => onChange(choices.map((c) => c.id))}
          >
            Select all
          </button>
          <button type="button" onClick={() => onChange([])}>
            Clear
          </button>
        </div>
        {choices.map((c) => (
          <label key={c.id}>
            <input
              type="checkbox"
              checked={selected.includes(c.id)}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...selected, c.id]
                    : selected.filter((v) => v !== c.id),
                )
              }
            />
            {c.label}
          </label>
        ))}
      </div>
    </details>
  )
}
type Document = CommercialDocument & { versions: DocumentVersion[] }
const fmtDate = (value: string | null) =>
  value
    ? new Date(value + 'T12:00:00Z').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      })
    : 'No expiry'

export default function CommercialDocuments({
  clientId,
  clientName,
  projects,
  initialScope,
}: {
  clientId: string
  clientName: string
  projects: { id: string; name: string }[]
  initialScope?: string
}) {
  const [documents, setDocuments] = useState<Document[]>([]),
    [role, setRole] = useState<CommercialRole>('viewer')
  const [accessLoaded, setAccessLoaded] = useState(false)
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  const [archived, setArchived] = useState(false),
    [query, setQuery] = useState('')
  const [scopes, setScopes] = useState<string[]>([]),
    [categories, setCategories] = useState<string[]>([...DOCUMENT_CATEGORIES])
  const [groupings, setGroupings] = useState<string[]>(['category']),
    [collapsed, setCollapsed] = useState<string[]>([])
  const [upload, setUpload] = useState<{ document?: Document } | null>(null),
    [busy, setBusy] = useState(false),
    [deleting, setDeleting] = useState<Document | null>(null)
  const [viewer, setViewer] = useState<{
    document: Document
    version: DocumentVersion
    url: string
  } | null>(null)
  const previewSequence = useRef(0)
  const choices = useMemo(
    () => [
      { id: 'client', label: 'Client agreements' },
      ...projects.map((p) => ({ id: p.id, label: p.name })),
    ],
    [projects],
  )
  useEffect(() => {
    setScopes(
      initialScope ? ['client', initialScope] : choices.map((c) => c.id),
    )
  }, [clientId, initialScope, choices])
  const load = useCallback(async () => {
    setLoading(true)
    setAccessLoaded(false)
    setError('')
    try {
      const data = await commercialRequest(
        `/api/commercial/documents?client=${clientId}`,
      )
      setDocuments(data.documents || [])
      setRole(data.role)
      setAccessLoaded(true)
    } catch (e) {
      setDocuments([])
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [clientId])
  useEffect(() => {
    load()
    setViewer(null)
    setUpload(null)
    setDeleting(null)
    setMessage('')
  }, [load])
  const closeDialog = useCallback(() => {
    previewSequence.current++
    setViewer(null)
    setUpload(null)
    setDeleting(null)
  }, [])
  useCommercialDialog(!!(viewer || upload || deleting), closeDialog, busy)
  const filtered = documents.filter(
    (d) =>
      !!d.archived_at === archived &&
      scopes.includes(d.project_id || 'client') &&
      categories.includes(d.category) &&
      [d.title, ...d.tags]
        .join(' ')
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  const scopeLabel = (d: Document) =>
    d.project_id
      ? projects.find((p) => p.id === d.project_id)?.name || 'Scope'
      : 'Client agreements'
  async function action(d: Document, type: string) {
    setBusy(true)
    setError('')
    try {
      await commercialRequest('/api/commercial/documents', {
        client_id: clientId,
        document_id: d.id,
        action: type,
      })
      setDeleting(null)
      setMessage(
        type === 'delete'
          ? 'Document deleted.'
          : type === 'archive'
            ? 'Document archived.'
            : 'Document restored.',
      )
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function preview(d: Document, v?: DocumentVersion) {
    const version =
      v ||
      d.versions.filter((v) => v.ready).sort((a, b) => b.version - a.version)[0]
    if (!version) {
      setError('This document has no completed upload. Add a PDF version.')
      return
    }
    const sequence = ++previewSequence.current
    setError('')
    try {
      const { url } = await commercialRequest('/api/commercial/document-url', {
        client_id: clientId,
        document_id: d.id,
        version_id: version.id,
      })
      if (sequence === previewSequence.current)
        setViewer({ document: d, version, url })
    } catch (e) {
      if (sequence === previewSequence.current) setError((e as Error).message)
    }
  }
  async function download(d: Document, v: DocumentVersion) {
    try {
      const { url } = await commercialRequest('/api/commercial/document-url', {
        client_id: clientId,
        document_id: d.id,
        version_id: v.id,
        download: true,
      })
      const a = document.createElement('a')
      a.href = url
      a.download = v.file_name
      document.body.appendChild(a)
      a.click()
      a.remove()
    } catch (e) {
      setError((e as Error).message)
    }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget),
      file = data.get('file') as File
    if (
      !file?.size ||
      file.size > MAX_DOCUMENT_BYTES ||
      file.type !== 'application/pdf'
    ) {
      setError('Choose a PDF file no larger than 20 MB.')
      return
    }
    setBusy(true)
    setError('')
    let reservation: any
    try {
      reservation = await commercialRequest('/api/commercial/documents', {
        action: 'reserve',
        client_id: clientId,
        document_id: upload?.document?.id,
        title: data.get('title'),
        category: data.get('category'),
        project_id: data.get('scope') || null,
        effective_date: data.get('effective'),
        expiry_date: data.get('expiry') || null,
        tags: String(data.get('tags') || '')
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
        file_name: file.name,
        bytes: file.size,
        mime: file.type,
      })
      const { error } = await supabase.storage
        .from(COMMERCIAL_BUCKET)
        .uploadToSignedUrl(reservation.path, reservation.token, file, {
          contentType: 'application/pdf',
        })
      if (error) throw error
      await commercialRequest('/api/commercial/documents', {
        action: 'complete',
        client_id: clientId,
        document_id: reservation.document_id,
        version_id: reservation.version_id,
      })
      setUpload(null)
      setMessage('Executed PDF uploaded. Earlier versions are retained.')
      await load()
    } catch (e) {
      if (reservation) {
        try {
          await commercialRequest('/api/commercial/documents', {
            action: 'cancel-upload',
            client_id: clientId,
            document_id: reservation.document_id,
            version_id: reservation.version_id,
          })
        } catch {
          setMessage('An incomplete upload remains. Retry by adding a version.')
        }
      }
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  function row(d: Document) {
    const latest = d.versions
      .filter((v) => v.ready)
      .sort((a, b) => b.version - a.version)[0]
    return (
      <article key={d.id} className="commercial-document-row">
        <div className="commercial-document-title">
          <span className="commercial-file">
            <FileText size={20} />
          </span>
          <div>
            <button
              onClick={() => preview(d)}
              className="commercial-title-button"
            >
              {d.title}
            </button>
            <p>
              {d.category} ·{' '}
              {latest ? `v${latest.version}` : 'Upload incomplete'}
            </p>
            <p>
              Effective {fmtDate(d.effective_date)}
              {d.expiry_date ? ` · Expires ${fmtDate(d.expiry_date)}` : ''}
            </p>
          </div>
        </div>
        <div className="commercial-scope">
          <strong>{scopeLabel(d)}</strong>
          <p>
            {d.project_id ? 'Scope agreement' : 'Shared across client scopes'}
          </p>
        </div>
        <div className="commercial-row-actions">
          <button onClick={() => preview(d)} disabled={!latest}>
            Preview
          </button>
          {canManageCommercial(role) && (
            <details>
              <summary aria-label={`More actions for ${d.title}`}>
                <MoreHorizontal size={18} />
              </summary>
              <div className="commercial-row-menu">
                {!archived && (
                  <button
                    disabled={busy}
                    onClick={() => setUpload({ document: d })}
                  >
                    Add version
                  </button>
                )}
                <button
                  disabled={busy}
                  onClick={() => action(d, archived ? 'restore' : 'archive')}
                >
                  <Archive size={14} />
                  {archived ? 'Restore' : 'Archive'}
                </button>
                <button disabled={busy} onClick={() => setDeleting(d)}>
                  Delete
                </button>
              </div>
            </details>
          )}
        </div>
      </article>
    )
  }
  function grouped(items: Document[], level = 0, path = ''): React.ReactNode {
    if (level === groupings.length) return items.map(row)
    const key = groupings[level],
      map = new Map<string, Document[]>()
    items.forEach((d) => {
      const label = key === 'category' ? d.category : scopeLabel(d)
      map.set(label, [...(map.get(label) || []), d])
    })
    return Array.from(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, list]) => {
        const id = path + '/' + key + ':' + label
        return (
          <section key={id}>
            <button
              className="commercial-group"
              style={{ paddingLeft: level * 12 }}
              aria-expanded={!collapsed.includes(id)}
              onClick={() =>
                setCollapsed((v) =>
                  v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
                )
              }
            >
              {collapsed.includes(id) ? '▸' : '▾'} {label}
              <span>{list.length}</span>
            </button>
            {!collapsed.includes(id) && grouped(list, level + 1, id)}
          </section>
        )
      })
  }
  return (
    <section className="commercial-library">
      <div className="commercial-library-heading">
        <div>
          <span className="commercial-eyebrow">Commercial / Agreements</span>
          <h2>Commercial documents</h2>
          <p>Executed agreements for {clientName} and its scopes.</p>
        </div>
        {canManageCommercial(role) && accessLoaded ? (
          <button
            className="commercial-primary"
            onClick={() => {
              setError('')
              setUpload({})
            }}
          >
            <Plus size={16} />
            Upload document
          </button>
        ) : !accessLoaded ? (
          <button
            className="commercial-primary"
            disabled
            title="Document management requires verified commercial access"
          >
            <Plus size={16} /> Upload document
          </button>
        ) : (
          <span className="commercial-access-badge">View-only access</span>
        )}
      </div>
      {!loading && !accessLoaded ? (
        <div className="commercial-access-state" role="alert">
          <FileText size={28} />
          <h3>Commercial access required</h3>
          <p>{error}</p>
          <p>
            Your account needs company commercial access to view agreements.
            Owner and Administrator access includes uploads and document
            management.
          </p>
          <button className="workspace-secondary" onClick={load}>
            Check access again
          </button>
        </div>
      ) : (
        <>
          <div
            className="commercial-document-types"
            aria-label="Agreement categories"
          >
            {['NDA', 'MPSA', 'SOW'].map((category) => (
              <button
                key={category}
                aria-pressed={
                  categories.length === 1 && categories[0] === category
                }
                onClick={() =>
                  setCategories(
                    categories.length === 1 && categories[0] === category
                      ? [...DOCUMENT_CATEGORIES]
                      : [category],
                  )
                }
              >
                <FileText size={17} />
                <span>
                  {category}
                  <small>
                    {category === 'NDA'
                      ? 'Confidentiality'
                      : category === 'MPSA'
                        ? 'Master agreements'
                        : 'Scope of work'}
                  </small>
                </span>
                <strong>
                  {
                    documents.filter(
                      (d) =>
                        d.category === category &&
                        !!d.archived_at === archived &&
                        scopes.includes(d.project_id || 'client'),
                    ).length
                  }
                </strong>
              </button>
            ))}
            <button onClick={() => setCategories([...DOCUMENT_CATEGORIES])}>
              <span>
                All agreements<small>Includes amendments & changes</small>
              </span>
              <strong>
                {
                  documents.filter(
                    (d) =>
                      !!d.archived_at === archived &&
                      scopes.includes(d.project_id || 'client'),
                  ).length
                }
              </strong>
            </button>
          </div>
          <div className="commercial-library-tabs">
            <button aria-pressed={!archived} onClick={() => setArchived(false)}>
              Active
            </button>
            <button aria-pressed={archived} onClick={() => setArchived(true)}>
              Archived
            </button>
          </div>
          <div className="commercial-filters">
            <label className="commercial-search">
              <Search size={16} />
              <input
                aria-label="Search documents"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or tag"
              />
            </label>
            <MultiSelect
              label="Attached to"
              choices={choices}
              selected={scopes}
              onChange={setScopes}
            />
            <MultiSelect
              label="Category"
              choices={DOCUMENT_CATEGORIES.map((v) => ({ id: v, label: v }))}
              selected={categories}
              onChange={setCategories}
            />
          </div>
          <div className="commercial-grouping">
            <span>Group by</span>
            {groupings.map((g, i) => (
              <span className="commercial-group-chip" key={g}>
                {g === 'category' ? 'Category' : 'Scope'}
                <button
                  disabled={i === 0}
                  aria-label={`Move ${g} earlier`}
                  onClick={() =>
                    setGroupings((v) => {
                      const x = [...v]
                      ;[x[i - 1], x[i]] = [x[i], x[i - 1]]
                      return x
                    })
                  }
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  disabled={i === groupings.length - 1}
                  aria-label={`Move ${g} later`}
                  onClick={() =>
                    setGroupings((v) => {
                      const x = [...v]
                      ;[x[i + 1], x[i]] = [x[i], x[i + 1]]
                      return x
                    })
                  }
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  aria-label={`Remove ${g} grouping`}
                  onClick={() => setGroupings((v) => v.filter((x) => x !== g))}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            <MultiSelect
              label="Choose levels"
              choices={[
                { id: 'category', label: 'Category' },
                { id: 'scope', label: 'Scope' },
              ]}
              selected={groupings}
              onChange={(v) => {
                setGroupings(v)
                setCollapsed([])
              }}
            />
          </div>
          {error && (
            <p role="alert" className="commercial-error">
              {error}
            </p>
          )}
          {message && (
            <p aria-live="polite" className="commercial-message">
              {message}
            </p>
          )}
          <div className="commercial-list-caption">
            <span aria-live="polite">
              {filtered.length} {archived ? 'archived' : 'active'} documents
            </span>
            <span>Private repository · Executed agreements</span>
          </div>
          <div className="commercial-columns" aria-hidden="true">
            <span>Document / dates</span>
            <span>Attached to</span>
            <span>Actions</span>
          </div>
          {loading ? (
            <div className="commercial-empty">
              <Loader2 className="animate-spin" size={20} />
              Loading documents
            </div>
          ) : filtered.length ? (
            grouped(filtered)
          ) : (
            <div className="commercial-empty">
              <FileText size={28} />
              <strong>
                {documents.length
                  ? 'No agreements match your filters'
                  : 'Your agreements, organized in one place'}
              </strong>
              <p>
                {documents.length
                  ? 'Adjust the scope or category selections to see more documents.'
                  : 'Keep client NDAs and master agreements here. Attach SOWs and amendments to the relevant scope.'}
              </p>
              {!documents.length && canManageCommercial(role) && (
                <button
                  className="commercial-primary"
                  onClick={() => setUpload({})}
                >
                  <Plus size={16} /> Upload your first agreement
                </button>
              )}
            </div>
          )}
        </>
      )}
      {upload && (
        <div className="commercial-overlay">
          <section
            className="commercial-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="commercial-upload-title"
          >
            <div className="commercial-dialog-heading">
              <h2 id="commercial-upload-title">
                {upload.document
                  ? 'Add PDF version'
                  : 'Upload executed agreement'}
              </h2>
              <button
                disabled={busy}
                onClick={() => setUpload(null)}
                aria-label="Close upload"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={submit}>
              <div className="commercial-form-grid">
                {!upload.document && (
                  <>
                    <label>
                      Document title
                      <input name="title" maxLength={160} required />
                    </label>
                    <label>
                      Category
                      <select name="category">
                        {DOCUMENT_CATEGORIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Attached to
                      <select name="scope" defaultValue={initialScope || ''}>
                        <option value="">
                          {clientName} · Client agreement
                        </option>
                        {projects.map((p) => (
                          <option value={p.id} key={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Effective date
                      <input name="effective" type="date" required />
                    </label>
                    <label>
                      Expiry · optional
                      <input name="expiry" type="date" />
                    </label>
                    <label>
                      Tags · optional
                      <input name="tags" placeholder="Separate with commas" />
                    </label>
                  </>
                )}
                <label className="commercial-span">
                  PDF file · Maximum 20 MB
                  <input
                    name="file"
                    type="file"
                    accept="application/pdf,.pdf"
                    required
                  />
                </label>
              </div>
              <p className="commercial-help">
                {upload.document
                  ? `${upload.document.title} · Earlier versions remain available.`
                  : 'Uploads are executed agreements. Client agreements are stored once and linked to scopes.'}
              </p>
              {error && (
                <p className="commercial-error" role="alert">
                  {error}
                </p>
              )}
              <div className="commercial-dialog-footer">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setUpload(null)}
                >
                  Cancel
                </button>
                <button className="commercial-primary" disabled={busy}>
                  {busy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                  Upload PDF
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {viewer && (
        <div className="commercial-overlay">
          <section
            className="commercial-dialog commercial-viewer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="commercial-viewer-title"
          >
            <div className="commercial-dialog-heading">
              <div>
                <h2 id="commercial-viewer-title">{viewer.document.title}</h2>
                <p>
                  {clientName} / {scopeLabel(viewer.document)} · v
                  {viewer.version.version}
                </p>
              </div>
              <button
                onClick={() => {
                  previewSequence.current++
                  setViewer(null)
                }}
                aria-label="Close PDF viewer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="commercial-version-toolbar">
              <label>
                Version
                <select
                  value={viewer.version.id}
                  onChange={(e) =>
                    preview(
                      viewer.document,
                      viewer.document.versions.find(
                        (v) => v.id === e.target.value,
                      ),
                    )
                  }
                >
                  {viewer.document.versions
                    .filter((v) => v.ready)
                    .sort((a, b) => b.version - a.version)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.version} ·{' '}
                        {new Date(v.uploaded_at).toLocaleDateString()}
                      </option>
                    ))}
                </select>
              </label>
              <button onClick={() => download(viewer.document, viewer.version)}>
                <Download size={16} />
                Download PDF
              </button>
              <button onClick={() => preview(viewer.document, viewer.version)}>
                Refresh preview
              </button>
            </div>
            <iframe
              key={viewer.url}
              title={`${viewer.document.title}, version ${viewer.version.version}`}
              src={viewer.url}
            />
            <p className="commercial-help">
              Preview links expire after two minutes. Refresh the preview to
              reopen the file.
            </p>
          </section>
        </div>
      )}
      {deleting && (
        <div className="commercial-overlay">
          <section
            className="commercial-dialog commercial-confirm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="commercial-delete-title"
          >
            <h2 id="commercial-delete-title">Delete this document?</h2>
            <p>
              <strong>{deleting.title}</strong>
            </p>
            <p>
              The PDF and all its versions will be removed from this client and
              linked scopes. Archive it if you need to retain access.
            </p>
            <div className="commercial-dialog-footer">
              <button disabled={busy} onClick={() => setDeleting(null)}>
                Keep document
              </button>
              <button
                disabled={busy}
                className="commercial-danger"
                onClick={() => action(deleting, 'delete')}
              >
                Delete document
              </button>
            </div>
            {error && (
              <p className="commercial-error" role="alert">
                {error}
              </p>
            )}
          </section>
        </div>
      )}
    </section>
  )
}
