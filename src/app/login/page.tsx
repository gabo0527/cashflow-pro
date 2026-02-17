// src/app/login/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowRight, Shield, Lock, CheckCircle } from 'lucide-react'

// Animated V Logo — larger, glowing, premium
const VLogo = ({ size = 56, className = '', glow = false }: { size?: number; className?: string; glow?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="vGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6ee7b7" />
        <stop offset="50%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#10b981" />
      </linearGradient>
      {glow && (
        <filter id="vGlow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      )}
    </defs>
    <path
      d="M12 12L28 44L44 12"
      stroke="url(#vGrad)"
      strokeWidth="5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      filter={glow ? 'url(#vGlow)' : undefined}
    />
  </svg>
)

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
    <div className="min-h-screen bg-[#060b14] flex relative overflow-hidden">
      {/* ---- CSS animations ---- */}
      <style jsx>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(40px, 40px); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-fadeUp { animation: fadeUp 0.8s ease-out forwards; }
        .animate-fadeIn { animation: fadeIn 1s ease-out forwards; }
        .animate-pulseGlow { animation: pulseGlow 4s ease-in-out infinite; }
        .delay-100 { animation-delay: 0.1s; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-300 { animation-delay: 0.3s; }
        .delay-400 { animation-delay: 0.4s; }
        .delay-500 { animation-delay: 0.5s; }
        .delay-600 { animation-delay: 0.6s; }
        .shimmer-btn {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent);
          background-size: 200% 100%;
          animation: shimmer 3s ease-in-out infinite;
        }
      `}</style>

      {/* ---- Global atmospheric layers ---- */}
      {/* Radial gradient top-right */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-500/[0.03] rounded-full blur-[120px] -translate-y-1/3 translate-x-1/4 pointer-events-none" />
      {/* Radial gradient bottom-left */}
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-teal-500/[0.025] rounded-full blur-[100px] translate-y-1/3 -translate-x-1/4 pointer-events-none" />
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }} />
      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.012] pointer-events-none"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />

      {/* ======== LEFT PANEL — Brand & Message ======== */}
      <div className="hidden lg:flex lg:w-[55%] relative">
        {/* Vertical accent line */}
        <div className="absolute right-0 top-[10%] bottom-[10%] w-px bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent" />

        <div className="relative z-10 flex flex-col justify-between p-14 xl:p-20 w-full">
          {/* Top — Logo */}
          <div className={`flex items-center gap-3 ${mounted ? 'animate-fadeUp opacity-0' : ''}`}>
            <VLogo size={44} glow />
            <div>
              <span className="text-[22px] font-bold text-white tracking-tight" style={{ fontFamily: "'SF Pro Display', -apple-system, system-ui, sans-serif" }}>Vantage</span>
              <p className="text-[9px] text-emerald-400/60 tracking-[0.25em] uppercase font-medium">Financial Intelligence</p>
            </div>
          </div>

          {/* Center — Hero message */}
          <div className="max-w-lg -mt-12">
            <h1 className={`text-[3.2rem] xl:text-[3.6rem] font-bold text-white leading-[1.08] tracking-tight mb-6 ${mounted ? 'animate-fadeUp opacity-0 delay-200' : ''}`}
              style={{ fontFamily: "'SF Pro Display', -apple-system, system-ui, sans-serif" }}>
              Command your
              <br />
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent">financial operations</span>
            </h1>
            <p className={`text-lg text-slate-400 leading-relaxed max-w-md ${mounted ? 'animate-fadeUp opacity-0 delay-300' : ''}`}
              style={{ fontFamily: "'SF Pro Text', -apple-system, system-ui, sans-serif" }}>
              Real-time visibility into cash flow, project profitability, and team performance — built for consulting firms that move fast.
            </p>

            {/* Capability pills */}
            <div className={`flex flex-wrap gap-2 mt-8 ${mounted ? 'animate-fadeUp opacity-0 delay-400' : ''}`}>
              {['Cash Flow Analytics', 'AR / AP Tracking', 'Project P&L', 'AI Forecasting', 'Team Costs'].map((item, i) => (
                <span key={i} className="px-3.5 py-1.5 text-[11px] font-medium text-slate-400 bg-white/[0.04] border border-white/[0.06] rounded-full hover:border-emerald-500/20 hover:text-emerald-400/80 transition-all duration-300 cursor-default">
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Bottom — Sage AI + real platform capabilities */}
          <div className={`${mounted ? 'animate-fadeUp opacity-0 delay-500' : ''}`}>
            <div className="p-5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
                    <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93" /><path d="M8 6a4 4 0 0 1 7.54 1.81" /><path d="M15.58 13.71A6 6 0 0 1 12 22a6 6 0 0 1-3.58-8.29" /><path d="M12 12v4" /><path d="M10 16h4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Meet Sage — your AI CFO</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Smart transaction categorization, payment probability scoring, and proactive financial insights that learn your business patterns.
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-5">
              {[
                { label: 'Bank Feed Sync', desc: 'QuickBooks connected' },
                { label: 'Project P&L', desc: 'Real-time margins' },
                { label: 'Payment Scoring', desc: 'AI-powered AR' },
              ].map((item, i) => (
                <div key={i} className="text-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 mx-auto mb-2" />
                  <p className="text-[11px] font-medium text-slate-300">{item.label}</p>
                  <p className="text-[10px] text-slate-600 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ======== RIGHT PANEL — Login ======== */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 relative">
        {/* Subtle centered glow behind the card */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/[0.025] rounded-full blur-[100px] pointer-events-none animate-pulseGlow" />

        <div className="w-full max-w-[400px] relative z-10">
          {/* Mobile Logo */}
          <div className={`lg:hidden text-center mb-10 ${mounted ? 'animate-fadeUp opacity-0' : ''}`}>
            <div className="inline-flex items-center gap-3 mb-2">
              <VLogo size={40} glow />
              <span className="text-2xl font-bold text-white tracking-tight">Vantage</span>
            </div>
            <p className="text-slate-500 text-sm">Financial Intelligence Platform</p>
          </div>

          {/* Login Card */}
          <div className={`relative ${mounted ? 'animate-fadeUp opacity-0 delay-200' : ''}`}>
            {/* Card border glow effect */}
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-emerald-500/20 via-white/[0.06] to-transparent opacity-60 pointer-events-none" />

            <div className="relative bg-[#0c1220]/90 backdrop-blur-xl rounded-2xl border border-white/[0.08] p-10">
              {/* V Logo — floating, no container */}
              <div className="flex justify-center mb-8">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500/15 rounded-full blur-2xl scale-[2]" />
                  <VLogo size={56} glow />
                </div>
              </div>

              {/* Header */}
              <div className="text-center mb-8">
                <h2 className="text-[22px] font-bold text-white tracking-tight mb-1.5"
                  style={{ fontFamily: "'SF Pro Display', -apple-system, system-ui, sans-serif" }}>
                  Welcome back
                </h2>
                <p className="text-sm text-slate-500">Sign in to your workspace</p>
              </div>

              {/* Error */}
              {error && (
                <div className="mb-6 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm text-center">
                  {error}
                </div>
              )}

              {/* Google Login Button */}
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="relative w-full flex items-center justify-center gap-3 px-5 py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-lg shadow-emerald-500/20 hover:shadow-emerald-400/30 group overflow-hidden"
              >
                {/* Shimmer overlay */}
                <div className="absolute inset-0 shimmer-btn pointer-events-none" />

                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5 relative z-10" viewBox="0 0 24 24">
                    <path fill="#fff" fillOpacity="0.95" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#fff" fillOpacity="0.8" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#fff" fillOpacity="0.6" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#fff" fillOpacity="0.7" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                )}
                <span className="relative z-10 text-[15px]">{loading ? 'Signing in...' : 'Continue with Google'}</span>
                {!loading && <ArrowRight className="w-4 h-4 relative z-10 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />}
              </button>

              <p className="mt-3 text-center text-xs text-slate-600">
                Use your company Google Workspace account
              </p>

              {/* Security indicators */}
              <div className="mt-8 pt-6 border-t border-white/[0.06]">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Lock size={11} className="text-emerald-500/60" />
                    <span>256-bit encrypted</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Shield size={11} className="text-emerald-500/60" />
                    <span>SOC 2 compliant</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle size={11} className="text-emerald-500/60" />
                    <span>SSO ready</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className={`mt-8 text-center text-[11px] text-slate-600 ${mounted ? 'animate-fadeIn opacity-0 delay-600' : ''}`}>
            By signing in, you agree to our{' '}
            <a href="/terms" className="text-slate-500 hover:text-emerald-400 underline underline-offset-2 transition-colors">Terms</a>
            {' '}and{' '}
            <a href="/privacy" className="text-slate-500 hover:text-emerald-400 underline underline-offset-2 transition-colors">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  )
}
