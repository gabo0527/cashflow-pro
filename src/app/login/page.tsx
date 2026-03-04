// src/app/login/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowRight, Lock, Shield, Link as LinkIcon } from 'lucide-react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) router.push('/')
    }
    checkAuth()
  }, [router])

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    })
    if (error) { setError(error.message); setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#0c0f14] flex overflow-hidden relative">
      {/* ── Google Font ── */}
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <style jsx>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .anim-up { animation: fadeUp 0.7s ease-out forwards; opacity: 0; }
        .anim-in { animation: fadeIn 0.8s ease-out forwards; opacity: 0; }
        .d1 { animation-delay: 0.1s; }
        .d2 { animation-delay: 0.2s; }
        .d3 { animation-delay: 0.3s; }
        .d4 { animation-delay: 0.4s; }
        .d5 { animation-delay: 0.5s; }
        .shimmer-btn { background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent); background-size: 200% 100%; animation: shimmer 3s ease-in-out infinite; }
      `}</style>

      {/* ══════════ LEFT PANEL ══════════ */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between p-14 xl:p-16 overflow-hidden"
        style={{ fontFamily: "'Instrument Sans', system-ui, sans-serif" }}>

        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0c0f14] via-[#0f1a17] to-[#0c0f14]" />
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #34d399 0%, transparent 70%)', filter: 'blur(100px)' }} />
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '64px 64px'
        }} />
        {/* Vertical accent divider */}
        <div className="absolute right-0 top-[10%] bottom-[10%] w-px bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent" />

        {/* Top: Logo */}
        <div className={`relative z-10 ${mounted ? 'anim-up' : ''}`}>
          <div className="flex items-center gap-3.5">
            <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
              <defs>
                <linearGradient id="vGradL" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6ee7b7" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
              <path d="M12 11L24 37L36 11" stroke="url(#vGradL)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="flex flex-col">
              <span className="text-white text-2xl font-bold tracking-tight leading-none">Vantage</span>
              <span className="text-emerald-400/60 text-[10px] font-semibold tracking-[0.25em] uppercase leading-none mt-1">Financial Intelligence</span>
            </div>
          </div>
        </div>

        {/* Center: Hero */}
        <div className="relative z-10 -mt-16">
          <div className={`flex items-center gap-2 mb-6 ${mounted ? 'anim-up d1' : ''}`}>
            <div className="h-px w-12 bg-emerald-500/40" />
            <span className="text-emerald-400 text-xs font-semibold tracking-[0.15em] uppercase">Owner&apos;s Command Center</span>
          </div>

          <h1 className={`text-white text-[3.4rem] xl:text-[3.8rem] font-bold leading-[1.05] tracking-tight ${mounted ? 'anim-up d2' : ''}`}>
            See everything.
            <br />
            <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text" style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Control everything.
            </span>
          </h1>

          <p className={`text-gray-400 text-[17px] mt-7 max-w-lg leading-relaxed ${mounted ? 'anim-up d3' : ''}`}>
            Real-time cash flow, project profitability, and team performance
            — built for consulting firms that move fast.
          </p>

          {/* Metric bar */}
          <div className={`flex items-center gap-1 mt-10 ${mounted ? 'anim-up d4' : ''}`}>
            {[
              { value: "$2.4M", label: "Revenue tracked", accent: true },
              { value: "38%", label: "Avg margin", accent: false },
              { value: "94%", label: "Collection rate", accent: true },
            ].map((m, i) => (
              <div key={i} className="flex-1">
                <div className="px-5 py-4 border border-gray-800/80 bg-gray-900/30 backdrop-blur-sm"
                  style={{ borderRadius: i === 0 ? '14px 0 0 14px' : i === 2 ? '0 14px 14px 0' : '0' }}>
                  <p className={`text-2xl font-bold tracking-tight ${m.accent ? 'text-emerald-400' : 'text-white'}`}>{m.value}</p>
                  <p className="text-gray-500 text-[11px] font-medium mt-0.5 tracking-wide uppercase">{m.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: Sage + status */}
        <div className={`relative z-10 ${mounted ? 'anim-up d5' : ''}`}>
          <div className="flex items-center gap-4 px-5 py-4 bg-emerald-500/[0.06] border border-emerald-500/10 rounded-2xl max-w-lg">
            <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#10b981" strokeWidth="1.5" />
                <path d="M8 12.5l2.5 2.5 5-5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-white text-sm font-semibold tracking-tight">Sage — your AI CFO</p>
              <p className="text-gray-500 text-[13px] mt-0.5 leading-snug">
                Automated categorization, anomaly detection, and proactive financial insights.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-10 mt-8 ml-1">
            {[
              { label: "Bank Feed Sync", sub: "QuickBooks connected" },
              { label: "Project P&L", sub: "Real-time margins" },
              { label: "Payment Scoring", sub: "AI-powered AR" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
                <div>
                  <p className="text-gray-300 text-xs font-medium">{item.label}</p>
                  <p className="text-gray-600 text-[10px]">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════ RIGHT PANEL — Sign In ══════════ */}
      <div className="flex-1 flex items-center justify-center bg-[#f7f8fa] relative"
        style={{ fontFamily: "'Instrument Sans', system-ui, sans-serif" }}>

        {/* Subtle accent */}
        <div className="absolute top-0 right-0 w-64 h-64 opacity-30 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 100% 0%, #10b98115, transparent 70%)' }} />

        <div className={`w-full max-w-[400px] px-8 ${mounted ? 'anim-up d2' : ''}`}>

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-14">
            <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
              <path d="M12 11L24 37L36 11" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-gray-900 text-xl font-bold tracking-tight">Vantage</span>
          </div>

          {/* Standalone V mark */}
          <div className="flex justify-center mb-8">
            <svg width="52" height="52" viewBox="0 0 48 48" fill="none">
              <defs>
                <linearGradient id="vGradR" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#6ee7b7" />
                  <stop offset="50%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
              <path d="M10 10L24 38L38 10" stroke="url(#vGradR)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h2 className="text-gray-900 text-2xl font-bold text-center tracking-tight">Welcome back</h2>
          <p className="text-gray-400 text-sm text-center mt-2">Sign in to your workspace</p>

          {/* Sign-in card */}
          <div className="mt-8 bg-white rounded-2xl border border-gray-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.03)] p-7">

            {/* Error */}
            {error && (
              <div className="mb-5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-sm text-center">
                {error}
              </div>
            )}

            {/* Google SSO Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="relative w-full flex items-center justify-center gap-3 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] overflow-hidden group"
              style={{
                boxShadow: '0 2px 8px rgba(16,185,129,0.15)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 8px 24px rgba(16,185,129,0.25)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(16,185,129,0.15)'}
            >
              <div className="absolute inset-0 shimmer-btn pointer-events-none" />

              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-[18px] h-[18px] relative z-10" viewBox="0 0 24 24">
                  <path fill="rgba(255,255,255,0.9)" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="rgba(255,255,255,0.8)" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="rgba(255,255,255,0.7)" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="rgba(255,255,255,0.9)" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              <span className="relative z-10 text-[15px]">{loading ? 'Signing in...' : 'Continue with Google'}</span>
              {!loading && <ArrowRight className="w-4 h-4 relative z-10 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />}
            </button>

            <p className="text-gray-400 text-[12px] text-center mt-4 leading-snug">
              Use your company Google Workspace account
            </p>

            {/* Security badges */}
            <div className="border-t border-gray-100 mt-5 pt-5">
              <div className="flex items-center justify-center gap-5">
                <div className="flex items-center gap-1.5">
                  <Lock size={11} className="text-gray-400" />
                  <span className="text-gray-400 text-[11px]">256-bit encrypted</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield size={11} className="text-gray-400" />
                  <span className="text-gray-400 text-[11px]">SOC 2 compliant</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <LinkIcon size={11} className="text-gray-400" />
                  <span className="text-gray-400 text-[11px]">SSO ready</span>
                </div>
              </div>
            </div>
          </div>

          {/* Terms */}
          <p className="text-gray-400 text-[11px] text-center mt-7 leading-relaxed">
            By signing in, you agree to our{' '}
            <a href="/terms" className="text-emerald-600 font-medium hover:underline">Terms</a>
            {' '}and{' '}
            <a href="/privacy" className="text-emerald-600 font-medium hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  )
}
