'use client'
import React from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowUpRight,
  FileText,
  FolderKanban,
  History,
  Users,
  Plus,
  Archive,
} from 'lucide-react'

export type ClientWorkspaceTab =
  'overview' | 'documents' | 'contacts' | 'history'
export default function ClientWorkspaceHeader({
  client,
  projects,
  tab,
  onTab,
  onScope,
  onArchive,
  archiving,
}: {
  client: {
    id: string
    name: string
    status: string
    payment_terms?: string
    contact_name?: string
    email?: string
  }
  projects: { id: string; name: string; status: string }[]
  tab: ClientWorkspaceTab
  onTab: (tab: ClientWorkspaceTab) => void
  onScope: (id: string) => void
  onArchive: () => void
  archiving: boolean
}) {
  const sections = [
    {
      id: 'overview',
      label: 'Overview & scopes',
      description: 'Revenue, budgets and project activity',
      icon: FolderKanban,
    },
    {
      id: 'documents',
      label: 'Commercial documents',
      description: 'NDA, MPSA, SOW and amendments',
      icon: FileText,
    },
    {
      id: 'contacts',
      label: 'Scope contacts',
      description: 'Primary POCs and billing contacts',
      icon: Users,
    },
    {
      id: 'history',
      label: 'History',
      description: 'Completed scopes and prior years',
      icon: History,
    },
  ] as const
  return (
    <>
      <header className="client-workspace-header">
        <Link href="/clients" className="client-breadcrumb">
          <ArrowLeft size={14} /> Clients <span>/</span> Client workspace
        </Link>
        <div className="client-workspace-title">
          <div>
            <span className="commercial-eyebrow">Client portfolio</span>
            <h1>{client.name}</h1>
            <p>
              {projects.filter((p) => p.status === 'active').length} active
              scopes <span>·</span>{' '}
              {client.payment_terms || 'Payment terms not set'} <span>·</span>{' '}
              <span className="client-state">{client.status}</span>
            </p>
          </div>
          <div className="client-workspace-actions">
            <button
              className="workspace-primary"
              onClick={() => onTab('documents')}
            >
              <FileText size={16} /> Commercial documents{' '}
              <ArrowUpRight size={14} />
            </button>
            <Link
              href={`/projects?new=1&client=${client.id}`}
              className="workspace-secondary"
            >
              <Plus size={16} /> New scope
            </Link>
            <details className="client-settings">
              <summary>Client actions</summary>
              <div>
                <Link href="/clients">Manage client details</Link>
                <button disabled={archiving} onClick={onArchive}>
                  <Archive size={14} /> Archive client
                </button>
              </div>
            </details>
          </div>
        </div>
        <div className="client-context-strip">
          <span>
            {client.contact_name || 'Client contact not set'}
            {client.email && (
              <>
                {' '}
                · <a href={`mailto:${client.email}`}>{client.email}</a>
              </>
            )}
          </span>
          <label>
            Open scope{' '}
            <select
              aria-label="Open a project profile"
              value=""
              onChange={(e) => e.target.value && onScope(e.target.value)}
            >
              <option value="">Choose a scope…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.status}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>
      <nav className="client-workspace-nav" aria-label="Client workspace">
        {sections.map((s) => (
          <button
            key={s.id}
            aria-current={tab === s.id ? 'page' : undefined}
            onClick={() => onTab(s.id)}
          >
            <s.icon size={19} />
            <span>
              <strong>{s.label}</strong>
              <small>{s.description}</small>
            </span>
            <ArrowUpRight size={14} />
          </button>
        ))}
      </nav>
    </>
  )
}
