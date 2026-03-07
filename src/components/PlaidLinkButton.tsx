'use client'

// src/components/PlaidLinkButton.tsx
// Handles Plaid Link flow for connecting First Bank PR and Bank of America
// Uses Plaid's hosted Link UI via their script tag

import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { THEME } from '@/components/expenses/shared'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface PlaidLinkButtonProps {
  companyId?: string   // optional — fetched from Supabase if not provided
  institution: 'firstbank' | 'bofa'
  onSuccess: () => void
  onError?: (err: string) => void
  connected?: boolean
  compact?: boolean
}

const INSTITUTION_LABELS = {
  firstbank: { name: 'First Bank PR', account: 'Checking ··7801' },
  bofa:      { name: 'Bank of America', account: '3 Credit Cards' },
}

declare global {
  interface Window {
    Plaid: any
  }
}

export default function PlaidLinkButton({
  companyId,
  institution,
  onSuccess,
  onError,
  connected = false,
  compact = false,
}: PlaidLinkButtonProps) {
  const [loading,   setLoading]   = useState(false)
  const [linkReady, setLinkReady] = useState(false)
  const [handler,   setHandler]   = useState<any>(null)

  const info = INSTITUTION_LABELS[institution]

  // Load Plaid Link script
  useEffect(() => {
    if (window.Plaid) { setLinkReady(true); return }
    const script    = document.createElement('script')
    script.src      = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'
    script.onload   = () => setLinkReady(true)
    script.onerror  = () => console.error('Failed to load Plaid Link script')
    document.head.appendChild(script)
  }, [])

  const initializePlaidLink = useCallback(async () => {
    if (!linkReady || !window.Plaid) return
    setLoading(true)

    try {
      // Resolve companyId — use prop or fetch from Supabase
      let resolvedCompanyId = companyId
      if (!resolvedCompanyId) {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('company_id')
          .eq('id', user.id)
          .single()
        resolvedCompanyId = profile?.company_id
      }
      if (!resolvedCompanyId) throw new Error('Company not found')

      // Get link token from our API
      const res = await fetch('/api/plaid/link-token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ companyId: resolvedCompanyId, institution }),
      })
      const { link_token, error } = await res.json()
      if (error) throw new Error(error)

      // Initialize Plaid Link
      const plaidHandler = window.Plaid.create({
        token: link_token,

        onSuccess: async (publicToken: string, metadata: any) => {
          setLoading(true)
          try {
            // Exchange public token for access token
            const exchangeRes = await fetch('/api/plaid/exchange-token', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({ companyId: resolvedCompanyId, publicToken, institution }),
            })
            const exchangeData = await exchangeRes.json()

            if (!exchangeRes.ok) throw new Error(exchangeData.error)

            // Trigger initial sync
            await fetch('/api/plaid/sync', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({ companyId: resolvedCompanyId, institution }),
            })

            onSuccess()
          } catch (err: any) {
            console.error('Exchange error:', err)
            onError?.(err.message)
          } finally {
            setLoading(false)
          }
        },

        onExit: (err: any) => {
          setLoading(false)
          if (err) {
            console.error('Plaid Link exit error:', err)
            onError?.(err.display_message || err.error_message || 'Connection cancelled')
          }
        },

        onEvent: (eventName: string) => {
          console.log('Plaid event:', eventName)
        },
      })

      setHandler(plaidHandler)
      plaidHandler.open()

    } catch (err: any) {
      console.error('Plaid init error:', err)
      onError?.(err.message)
      setLoading(false)
    }
  }, [linkReady, companyId, institution, onSuccess, onError])

  // Open existing handler if already initialized
  const handleClick = () => {
    if (handler) {
      handler.open()
    } else {
      initializePlaidLink()
    }
  }

  if (compact) {
    return (
      <button
        onClick={handleClick}
        disabled={loading || !linkReady}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors border ${
          connected
            ? `bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100`
            : `bg-slate-900 text-white border-slate-900 hover:bg-slate-800`
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        {loading ? (
          <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        ) : connected ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        )}
        {loading ? 'Connecting…' : connected ? `${info.name} Connected` : `Connect ${info.name}`}
      </button>
    )
  }

  return (
    <div className={`${THEME.card} p-5`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Institution icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${connected ? 'bg-emerald-50' : 'bg-slate-100'}`}>
            {institution === 'firstbank' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={connected ? '#059669' : '#64748b'} strokeWidth="1.5">
                <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={connected ? '#059669' : '#64748b'} strokeWidth="1.5">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <p className={`text-[13px] font-semibold ${THEME.textPrimary}`}>{info.name}</p>
              {connected && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">
                  Connected
                </span>
              )}
            </div>
            <p className={`text-[11px] ${THEME.textDim} mt-0.5`}>{info.account}</p>
          </div>
        </div>

        <button
          onClick={handleClick}
          disabled={loading || !linkReady}
          className={`px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors border ${
            connected
              ? `bg-white text-slate-600 border-slate-200 hover:border-slate-300`
              : `bg-slate-900 text-white border-slate-900 hover:bg-slate-800`
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? 'Connecting…' : connected ? 'Reconnect' : 'Connect'}
        </button>
      </div>
    </div>
  )
}
