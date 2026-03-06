// Save as: src/components/QBOSyncButton.tsx
// Fixed: chains entities sequentially (one API call per entity, each <10s)
// Each call syncs one entity type, client chains them to avoid Vercel timeout

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, CheckCircle2, AlertTriangle, Cloud, CloudOff } from 'lucide-react'

interface QBOSyncButtonProps {
  companyId: string
  syncType: 'bank' | 'invoices' | 'all'
  onSyncComplete?: () => void
  compact?: boolean
}

const ENTITY_LABELS: Record<string, string> = {
  Purchase: 'Expenses', Deposit: 'Deposits', Transfer: 'Transfers',
  Payment: 'Payments', SalesReceipt: 'Sales Receipts', JournalEntry: 'Journal Entries',
  Invoice: 'Invoices',
}

export default function QBOSyncButton({ companyId, syncType, onSyncComplete, compact = false }: QBOSyncButtonProps) {
  const [syncing, setSyncing] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [resultMsg, setResultMsg] = useState('')
  const [progress, setProgress] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (companyId) loadStatus() }, [companyId])

  const loadStatus = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/qbo/sync?companyId=${companyId}`)
      if (res.ok) {
        const data = await res.json()
        setConnected(data.connected)
        if (syncType === 'bank') setLastSync(data.lastBankSync)
        else if (syncType === 'invoices') setLastSync(data.lastInvoiceSync)
        else setLastSync(data.lastBankSync || data.lastInvoiceSync)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  const triggerSync = useCallback(async () => {
    if (syncing) return
    setSyncing(true)
    setStatus('idle')
    setResultMsg('')
    setProgress('')

    try {
      // Step 1: Get the entity chain from the server
      const planRes = await fetch('/api/qbo/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, syncType }),
      })
      const plan = await planRes.json()

      if (!planRes.ok) {
        setStatus('error')
        setResultMsg(plan.error || 'Sync failed')
        if (plan.reconnect) setConnected(false)
        return
      }

      const entities: string[] = plan.entities || []
      if (!entities.length) {
        setStatus('error')
        setResultMsg('No entities to sync')
        return
      }

      // Step 2: Chain entities one at a time — each call is a fresh request, well under 10s
      let totalSynced = 0
      let totalErrors = 0
      const summaryParts: string[] = []

      for (let i = 0; i < entities.length; i++) {
        const entity = entities[i]
        setProgress(`Syncing ${ENTITY_LABELS[entity] || entity} (${i + 1}/${entities.length})...`)

        const res = await fetch('/api/qbo/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, syncType, entity }),
        })

        const data = await res.json()

        if (!res.ok) {
          if (data.reconnect) { setConnected(false) }
          setStatus('error')
          setResultMsg(data.error || `Failed on ${entity}`)
          return
        }

        const r = data.result
        if (r) {
          totalSynced += r.synced || 0
          totalErrors += r.errors || 0
          if (r.synced > 0) summaryParts.push(`${r.synced} ${ENTITY_LABELS[entity] || entity}`)
        }
      }

      // Done
      const now = new Date().toISOString()
      setLastSync(now)
      setStatus(totalErrors > 0 && totalSynced === 0 ? 'error' : 'success')
      setResultMsg(
        summaryParts.length > 0
          ? summaryParts.join(', ') + ' synced'
          : totalErrors > 0
          ? `Completed with ${totalErrors} errors`
          : 'Up to date'
      )
      setProgress('')

      if (onSyncComplete) onSyncComplete()
      setTimeout(() => { setStatus('idle'); setResultMsg('') }, 6000)
    } catch (err: any) {
      setStatus('error')
      setResultMsg(err.message || 'Network error')
      setProgress('')
    } finally {
      setSyncing(false)
    }
  }, [companyId, syncType, syncing, onSyncComplete])

  const formatLastSync = (iso: string) => {
    const d = new Date(iso)
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000)
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    const diffDay = Math.floor(diffHr / 24)
    if (diffDay === 1) return 'Yesterday'
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  if (loading) return null

  if (!connected) {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-400">
        <CloudOff size={12} />
        <span>QBO not connected</span>
      </div>
    )
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <button onClick={triggerSync} disabled={syncing}
          className={`p-1.5 rounded-lg transition-colors ${
            status === 'success' ? 'text-emerald-400 bg-emerald-500/10' :
            status === 'error' ? 'text-red-400 bg-red-500/10' :
            'text-slate-400 hover:text-teal-400 hover:bg-teal-500/10'
          } disabled:opacity-50`}
          title={lastSync ? `Last sync: ${formatLastSync(lastSync)}` : 'Sync from QuickBooks'}>
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
        </button>
        <span className="text-[10px] text-slate-500">
          {syncing ? (progress || 'Syncing...') :
           status === 'error' ? resultMsg :
           lastSync ? formatLastSync(lastSync) : 'Never synced'}
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <Cloud size={13} className="text-emerald-400 shrink-0" />
        <span className="text-xs text-slate-400">
          {syncing ? (progress || 'Syncing...') :
           status === 'success' ? resultMsg :
           status === 'error' ? resultMsg :
           lastSync ? `Synced ${formatLastSync(lastSync)}` : 'Never synced'}
        </span>
      </div>
      <button onClick={triggerSync} disabled={syncing}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
          syncing ? 'bg-teal-500/10 text-teal-400 border-teal-500/20 cursor-wait' :
          status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
          status === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' :
          'bg-teal-500/10 text-teal-400 border-teal-500/20 hover:bg-teal-500/20'
        } disabled:opacity-60`}>
        <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
        {syncing ? 'Syncing...' :
         status === 'success' ? 'Synced ✓' :
         status === 'error' ? 'Retry' :
         'Sync QBO'}
      </button>
    </div>
  )
}
