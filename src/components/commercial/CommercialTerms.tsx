'use client'
import React, { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, X } from 'lucide-react'
import { CommercialRole, canManageCommercial } from '@/lib/commercial'
import useCommercialDialog from './useCommercialDialog'
import { commercialRequest } from './CommercialDocuments'
import { PHASE_LABELS, formatCurrency } from '@/components/projects/shared'

export default function CommercialTerms({
  project,
  phases,
  onChanged,
}: {
  project: any
  phases: any[]
  onChanged: () => void
}) {
  const [role, setRole] = useState<CommercialRole>('viewer'),
    [documents, setDocuments] = useState<any[]>([]),
    [history, setHistory] = useState<any[]>([]),
    [error, setError] = useState(''),
    [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false)
  const [model, setModel] = useState('tm_nte')
  const load = useCallback(async () => {
    try {
      const data = await commercialRequest(
        `/api/commercial/terms?client=${project.client_id}&project=${project.id}`,
      )
      setRole(data.role)
      setDocuments(data.documents)
      setHistory(data.history)
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }, [project.id, project.client_id])
  useEffect(() => {
    if (project.client_id) load()
  }, [load, project.client_id])
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setBusy(true)
    try {
      await commercialRequest('/api/commercial/terms', {
        client_id: project.client_id,
        project_id: project.id,
        terms: model,
        start: form.get('start'),
        end: form.get('end') || null,
        amount: Number(form.get('amount')),
        cadence: model === 'tm_nte' ? form.get('cadence') : 'monthly',
        document_id: form.get('agreement'),
      })
      setOpen(false)
      await load()
      onChanged()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const closeDialog = useCallback(() => setOpen(false), [])
  useCommercialDialog(open, closeDialog, busy)
  const today = new Date().toLocaleDateString('en-CA')
  return (
    <section className="commercial-library">
      <div className="commercial-library-heading">
        <div>
          <span className="commercial-eyebrow">
            Commercial / Effective dates
          </span>
          <h2>Terms &amp; budget history</h2>
          <p>
            New dated changes retain earlier terms, agreements and revisions.
          </p>
        </div>
        {project.client_id && canManageCommercial(role) && (
          <button className="commercial-primary" onClick={() => setOpen(true)}>
            <Plus size={15} />
            Add terms change
          </button>
        )}
      </div>
      {error && (
        <p className="commercial-error" role="alert">
          {error}
        </p>
      )}
      <div className="mt-5 space-y-3">
        {phases.map((p, i) => (
          <article
            key={p.id || i}
            className="flex justify-between gap-4 flex-wrap py-4 border-b border-slate-100"
          >
            <div>
              <h3 className="font-semibold text-sm">
                {PHASE_LABELS[p.terms as keyof typeof PHASE_LABELS]}
              </h3>
              <p className="text-xs text-slate-500 mt-2">
                {p.effective_start} — {p.effective_end || 'Open ended'} ·{' '}
                {p.auto
                  ? 'Terms need review'
                  : p.effective_start > today
                    ? 'Upcoming'
                    : p.effective_end && p.effective_end < today
                      ? 'Historical'
                      : 'Current'}
              </p>
            </div>
            <div className="text-right">
              <strong>
                {p.terms === 'tm_open'
                  ? 'Open · No cap'
                  : formatCurrency(
                      p.terms === 'lump_sum'
                        ? p.monthly_fee || 0
                        : p.nte_amount || 0,
                    )}
              </strong>
              <p className="text-xs text-slate-500 mt-2">
                {p.terms === 'lump_sum'
                  ? 'per month'
                  : p.terms === 'tm_nte'
                    ? p.budget_cadence === 'overall'
                      ? 'Overall phase budget'
                      : 'Monthly budget'
                    : 'Burn not applicable'}
              </p>
              {p.supporting_document_id && (
                <Link
                  className="text-xs text-blue-600"
                  href={`/clients/${project.client_id}?tab=documents&scope=${project.id}`}
                >
                  Supporting agreement →
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
      <p className="commercial-help">
        Budget is configured on this scope. Time tracking and client reports
        read the same dated terms. Monthly fees are independent of hours; cost
        and margin are coming soon.
      </p>
      {history.length > 0 && (
        <details className="mt-5 text-sm">
          <summary className="text-slate-600 cursor-pointer">
            Prior revisions · {history.length}
          </summary>
          {history.map((r) => (
            <article
              key={r.id}
              className="text-xs py-3 border-b border-slate-100"
            >
              <strong>
                {new Date(r.created_at).toLocaleString()} ·{' '}
                {r.operation === 'DELETE'
                  ? 'Removed phase retained'
                  : 'Prior version retained'}
              </strong>
              <p className="text-slate-500 mt-1">
                {PHASE_LABELS[r.snapshot.terms as keyof typeof PHASE_LABELS]} ·{' '}
                {r.snapshot.effective_start} —{' '}
                {r.snapshot.effective_end || 'Open ended'} ·{' '}
                {r.snapshot.terms === 'tm_open'
                  ? 'Open budget'
                  : formatCurrency(
                      r.snapshot.monthly_fee || r.snapshot.nte_amount || 0,
                    )}
              </p>
            </article>
          ))}
        </details>
      )}
      {open && (
        <div className="commercial-overlay">
          <section
            className="commercial-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="commercial-terms-title"
          >
            <div className="commercial-dialog-heading">
              <h2 id="commercial-terms-title">Add dated terms change</h2>
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                aria-label="Close terms editor"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={save}>
              <div className="commercial-form-grid">
                <label>
                  Billing model
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  >
                    <option value="tm_nte">T&amp;M · Budget</option>
                    <option value="tm_open">T&amp;M · Open budget</option>
                    <option value="lump_sum">Monthly fee</option>
                  </select>
                </label>
                <label>
                  Effective from
                  <input name="start" type="date" required />
                </label>
                <label>
                  Effective through · optional
                  <input name="end" type="date" />
                </label>
                {model !== 'tm_open' && (
                  <label>
                    {model === 'lump_sum' ? 'Monthly fee' : 'Budget'} · USD
                    <input
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                    />
                  </label>
                )}
                {model === 'tm_nte' && (
                  <label>
                    Budget cadence
                    <select name="cadence">
                      <option value="monthly">Monthly</option>
                      <option value="overall">Overall phase</option>
                    </select>
                  </label>
                )}
                <label className="commercial-span">
                  Supporting executed agreement
                  <select name="agreement" required>
                    <option value="">Choose an agreement</option>
                    {documents.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="commercial-help">
                Monthly fee transitions begin on the first of a month. An
                overlapping open phase will end the day before the new phase;
                its previous version stays in history.
              </p>
              {!documents.length && (
                <p className="commercial-help">
                  <Link
                    className="text-blue-600"
                    href={`/clients/${project.client_id}?tab=documents&scope=${project.id}`}
                  >
                    Upload a supporting agreement in the client’s Commercial
                    Documents page.
                  </Link>
                </p>
              )}
              {error && (
                <p className="commercial-error" role="alert">
                  {error}
                </p>
              )}
              <div className="commercial-dialog-footer">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </button>
                <button
                  disabled={busy || !documents.length}
                  className="commercial-primary"
                >
                  {busy ? 'Saving…' : 'Save dated change'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  )
}
