'use client'
import React, { useCallback, useEffect, useState } from 'react'
import { Plus, X, Mail, Phone, Loader2 } from 'lucide-react'
import {
  ScopeContact,
  CommercialRole,
  canManageCommercial,
} from '@/lib/commercial'
import useCommercialDialog from './useCommercialDialog'
import { commercialRequest } from './CommercialDocuments'

const empty = {
  name: '',
  title: '',
  organization: '',
  email: '',
  phone: '',
  purpose: 'Primary POC',
  is_primary: true,
}
export default function ScopeContacts({
  clientId,
  projects,
  scopeId,
  compact = false,
}: {
  clientId: string
  projects: { id: string; name: string }[]
  scopeId?: string
  compact?: boolean
}) {
  const [contacts, setContacts] = useState<ScopeContact[]>([]),
    [role, setRole] = useState<CommercialRole>('viewer'),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [editing, setEditing] = useState<ScopeContact | 'new' | null>(null),
    [scope, setScope] = useState(scopeId || projects[0]?.id || ''),
    [form, setForm] = useState(empty),
    [saving, setSaving] = useState(false)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await commercialRequest(
        `/api/commercial/contacts?client=${clientId}`,
      )
      setContacts(data.contacts || [])
      setRole(data.role)
      setError('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [clientId])
  useEffect(() => {
    load()
  }, [load])
  const closeDialog = useCallback(() => setEditing(null), [])
  useCommercialDialog(!!editing, closeDialog, saving)
  const scopeRows = contacts.filter((c) => !scopeId || c.project_id === scopeId)
  const rows = compact ? scopeRows.filter((c) => c.is_primary) : scopeRows
  const start = (c?: ScopeContact) => {
    setEditing(c || 'new')
    setScope(c?.project_id || scopeId || projects[0]?.id || '')
    setForm(
      c
        ? {
            name: c.name,
            title: c.title,
            organization: c.organization,
            email: c.email,
            phone: c.phone,
            purpose: c.purpose,
            is_primary: c.is_primary,
          }
        : {
            ...empty,
            is_primary: !rows.some((c) => c.is_primary),
            purpose: rows.some((c) => c.is_primary)
              ? 'Secondary POC'
              : 'Primary POC',
          },
    )
  }
  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await commercialRequest('/api/commercial/contacts', {
        client_id: clientId,
        project_id: scope,
        id: editing !== 'new' ? editing?.id : undefined,
        ...form,
      })
      setEditing(null)
      await load()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <section className="commercial-library">
      <div className="commercial-library-heading">
        <div>
          <span className="commercial-eyebrow">Scope relationships</span>
          <h2>{compact ? 'Scope point of contact' : 'Scope contacts'}</h2>
          <p>Client-side contacts, separate from assigned contractors.</p>
        </div>
        {canManageCommercial(role) && (
          <button
            className="commercial-primary"
            onClick={() => start()}
            disabled={!projects.length}
          >
            <Plus size={15} />
            Add contact
          </button>
        )}
      </div>
      {error && (
        <p className="commercial-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="commercial-empty">
          <Loader2 size={18} className="animate-spin" />
          Loading contacts
        </div>
      ) : !rows.length ? (
        <div className="commercial-empty">No scope contact assigned.</div>
      ) : (
        rows.map((c) => (
          <article className="commercial-contact" key={c.id}>
            <div>
              <div className="flex flex-wrap gap-2 items-center">
                <h3>{c.name}</h3>
                <span className="commercial-contact-badge">
                  {c.is_primary ? 'Primary POC' : c.purpose || 'Secondary POC'}
                </span>
              </div>
              <p>
                {c.title}
                {c.organization ? ` · ${c.organization}` : ''}
              </p>
              {!scopeId && (
                <p className="commercial-contact-scope">
                  {projects.find((p) => p.id === c.project_id)?.name || 'Scope'}
                </p>
              )}
            </div>
            <div>
              {c.email && (
                <a href={`mailto:${c.email}`}>
                  <Mail size={14} />
                  {c.email}
                </a>
              )}
              {c.phone && (
                <a href={`tel:${c.phone}`}>
                  <Phone size={14} />
                  {c.phone}
                </a>
              )}
            </div>
            {canManageCommercial(role) && (
              <button onClick={() => start(c)}>Edit contact</button>
            )}
          </article>
        ))
      )}
      {editing && (
        <div className="commercial-overlay">
          <section
            className="commercial-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="commercial-contact-title"
          >
            <div className="commercial-dialog-heading">
              <h2 id="commercial-contact-title">
                {editing === 'new' ? 'Add' : 'Edit'} scope contact
              </h2>
              <button
                onClick={() => setEditing(null)}
                disabled={saving}
                aria-label="Close contact editor"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={save}>
              <div className="commercial-form-grid">
                <label>
                  Scope
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    disabled={editing !== 'new' || !!scopeId}
                  >
                    {projects.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                {(
                  ['name', 'title', 'organization', 'email', 'phone'] as const
                ).map((key) => (
                  <label key={key}>
                    {
                      {
                        name: 'Full name',
                        title: 'Role / title',
                        organization: 'Organization',
                        email: 'Email',
                        phone: 'Phone',
                      }[key]
                    }
                    <input
                      value={form[key]}
                      onChange={(e) =>
                        setForm((v) => ({ ...v, [key]: e.target.value }))
                      }
                      type={
                        key === 'email'
                          ? 'email'
                          : key === 'phone'
                            ? 'tel'
                            : 'text'
                      }
                      maxLength={key === 'email' ? 160 : 100}
                      required={key === 'name'}
                    />
                  </label>
                ))}
                <label>
                  Contact purpose
                  <select
                    value={form.purpose}
                    onChange={(e) =>
                      setForm((v) => ({
                        ...v,
                        purpose: e.target.value,
                        is_primary: e.target.value === 'Primary POC',
                      }))
                    }
                  >
                    {[
                      'Primary POC',
                      'Secondary POC',
                      'Billing contact',
                      'Approver',
                    ].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="commercial-help">
                Each scope has one primary POC. Assigning another keeps the
                earlier contact as a secondary POC.
              </p>
              {error && (
                <p className="commercial-error" role="alert">
                  {error}
                </p>
              )}
              <div className="commercial-dialog-footer">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
                <button
                  className="commercial-primary"
                  disabled={saving || !scope}
                >
                  {saving ? 'Saving…' : 'Save contact'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}
