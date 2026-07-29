'use client'

/**
 * IdleLogout — auto sign-out after inactivity, for privacy & safety.
 *
 * - 10 minutes of no activity → onLogout() fires.
 * - At 9 minutes a warning modal appears with a live countdown; only the
 *   "Stay signed in" button resets the clock (a stray mouse bump shouldn't).
 * - Timestamp-based (not interval-only), so a laptop waking from sleep or a
 *   backgrounded tab still logs out correctly past the deadline.
 *
 * Mounted in AppShell (admin, Supabase session) and the Contractor Portal
 * (JWT cookie) — same behavior on both sides.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'

interface IdleLogoutProps {
  onLogout: () => void | Promise<void>
  timeoutMinutes?: number   // total inactivity allowed
  warnSeconds?: number      // warning window before logout
}

export default function IdleLogout({ onLogout, timeoutMinutes = 10, warnSeconds = 60 }: IdleLogoutProps) {
  const timeoutMs = timeoutMinutes * 60 * 1000
  const warnMs = warnSeconds * 1000

  const lastActivity = useRef<number>(Date.now())
  const warningShown = useRef(false)
  const loggedOut = useRef(false)
  const [warning, setWarning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(warnSeconds)

  const stay = useCallback(() => {
    lastActivity.current = Date.now()
    warningShown.current = false
    setWarning(false)
  }, [])

  useEffect(() => {
    const bump = () => {
      // Activity only resets the clock while the warning is NOT showing —
      // once warned, staying signed in is an explicit choice.
      if (!warningShown.current && !loggedOut.current) lastActivity.current = Date.now()
    }

    // Throttle mousemove to one bump per 5s; the rest are cheap enough raw
    let lastMove = 0
    const onMove = () => { const n = Date.now(); if (n - lastMove > 5000) { lastMove = n; bump() } }

    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('mousedown', bump, { passive: true })
    window.addEventListener('keydown', bump, { passive: true })
    window.addEventListener('scroll', bump, { passive: true })
    window.addEventListener('touchstart', bump, { passive: true })

    const tick = setInterval(async () => {
      if (loggedOut.current) return
      const idle = Date.now() - lastActivity.current
      if (idle >= timeoutMs) {
        loggedOut.current = true
        setWarning(false)
        try { await onLogout() } catch (e) { console.error('Idle logout failed:', e) }
        return
      }
      if (idle >= timeoutMs - warnMs) {
        warningShown.current = true
        setWarning(true)
        setSecondsLeft(Math.max(1, Math.ceil((timeoutMs - idle) / 1000)))
      }
    }, 1000)

    return () => {
      clearInterval(tick)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mousedown', bump)
      window.removeEventListener('keydown', bump)
      window.removeEventListener('scroll', bump)
      window.removeEventListener('touchstart', bump)
    }
  }, [timeoutMs, warnMs, onLogout])

  if (!warning) return null

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
          </svg>
        </div>
        <h2 className="text-[16px] font-bold text-slate-900" style={{ fontFamily: "'Archivo', sans-serif" }}>Still there?</h2>
        <p className="text-[13px] text-slate-500 mt-1.5 leading-relaxed">
          For your privacy, you'll be signed out in <b className="text-slate-800 tabular-nums">{secondsLeft}s</b> due to inactivity.
        </p>
        <button onClick={stay}
          className="mt-4 w-full py-2.5 rounded-lg text-sm font-bold text-white transition-colors"
          style={{ background: '#2563eb' }}>
          Stay signed in
        </button>
      </div>
    </div>
  )
}
