// Save as: src/components/QBOSyncButton.tsx
// Reusable sync button — drop into Cash Flow + Invoices pages

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw, CheckCircle2, AlertTriangle, Cloud, CloudOff } from 'lucide-react'

interface QBOSyncButtonProps {
  companyId: string
  syncType: 'bank' | 'invoices' | 'all'
  onSyncComplete?: () => void   // Callback to refresh page data after sync
  compact?: boolean              // Smaller variant for inline use
}

export default function QBOSyncButton({ companyId, syncType, onSyncComplete, compact = false }: QBOSyncButtonProps) {
  const [syncing, setSyncing] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [resultMsg, setResultMsg] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (companyId) loadStatus()
  }, [companyId])

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

    try {
      const res = await fetch('/api/qbo/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, syncType }),
      })

      const data = await res.json()

      if (!res.ok) {
        setStatus('error')
        setResultMsg(data.error || 'Sync failed')
        if (data.reconnect) setConnected(false)
        return
      }

      setStatus('success')
      setLastSync(new Date().toISOString())

      const parts: string[] = []
      if (data.results?.bank) parts.push(`${data.results.bank.synced} txns`)
      if (data.results?.invoices) parts.push(`${data.results.invoices.synced} invoices`)
      setResultMsg(parts.join(', ') + ' synced')

      if (onSyncComplete) onSyncComplete()
      setTimeout(() => { setStatus('idle'); setResultMsg('') }, 5000)
    } catch (err: any) {
      setStatus('error')
      setResultMsg(err.message || 'Network error')
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

  // Compact: just a refresh icon + last sync
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
          {syncing ? <RefreshCw size={14} className="animate-spin" /> :
           status === 'success' ? <CheckCircle2 size={14} /> :
           status === 'error' ? <AlertTriangle size={14} /> :
           <RefreshCw size={14} />}
        </button>
        {lastSync && status === 'idle' && (
          <span className="text-[10px] text-slate-600">{formatLastSync(lastSync)}</span>
        )}
        {resultMsg && (
          <span className={`text-[10px] ${status === 'error' ? 'text-red-400' : 'text-emerald-400'}`}>{resultMsg}</span>
        )}
      </div>
    )
  }

  // Full: card-style with last sync time + button
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Cloud size={14} className="text-emerald-400" />
        <span className="text-xs text-slate-400">
          {lastSync ? `Synced ${formatLastSync(lastSync)}` : 'Not synced yet'}
        </span>
      </div>

      <button onClick={triggerSync} disabled={syncing}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
          syncing ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' :
          status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
          status === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' :
          'bg-teal-500/10 text-teal-400 border-teal-500/20 hover:bg-teal-500/20'
        } disabled:opacity-60`}>
        {syncing ? <RefreshCw size={12} className="animate-spin" /> :
         status === 'success' ? <CheckCircle2 size={12} /> :
         status === 'error' ? <AlertTriangle size={12} /> :
         <RefreshCw size={12} />}
        {syncing ? 'Syncing...' :
         status === 'success' ? resultMsg || 'Synced' :
         status === 'error' ? 'Retry' :
         'Sync QBO'}
      </button>
    </div>
  )
}
