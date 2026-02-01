// src/app/login/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowRight, BarChart3, PieChart, TrendingUp, Shield, Sparkles } from 'lucide-react'

// Vantage Logo - Gradient V matching sidebar/dashboard
const VantageLogo = ({ size = 40, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <linearGradient id="loginLogoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#34d399" />
        <stop offset="100%" stopColor="#10b981" />
      </linearGradient>
      <filter id="loginGlow">
        <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <path 
      d="M8 8L20 32L32 8" 
      stroke="url(#loginLogoGradient)" 
      strokeWidth="4" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      fill="none"
      filter="url(#loginGlow)"
    />
  </svg>
)

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push('/')
      }
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
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
    
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  const features = [
    { 
      icon: BarChart3, 
      title: 'Real-time Analytics',
      description: 'Track cash flow and project profitability instantly'
    },
    { 
      icon: PieChart, 
      title: 'Smart Insights',
      description: 'AI-powered recommendations for your business'
    },
    { 
      icon: TrendingUp, 
      title: 'Growth Forecasting',
      description: 'Project revenue with custom assumptions'
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 flex">
      {/* Background noise texture */}
      <div 
        className="fixed inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Left Panel - Features */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Gradient accents */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/8 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-sky-500/6 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>
        
        {/* Glass divider on right edge */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-white/[0.08]" />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Header */}
          <div className="flex items-center gap-3">
            <VantageLogo size={44} />
            <div>
              <span className="text-2xl font-bold text-white tracking-tight">Vantage</span>
              <p className="text-[10px] text-slate-400 -mt-0.5 tracking-wider uppercase">Financial Intelligence</p>
            </div>
          </div>
          
          {/* Hero Section */}
          <div className="max-w-md">
            <h1 className="text-4xl font-bold text-white leading-tight mb-4">
              Financial clarity for
              <span className="block text-emerald-400 mt-1">modern businesses</span>
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed">
              The all-in-one platform for project-based businesses to track cash flow, 
              analyze margins, and make smarter decisions.
            </p>
          </div>
          
          {/* Features */}
          <div className="space-y-4">
            {features.map((feature, idx) => (
              <div 
                key={idx} 
                className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.03] backdrop-blur-sm border border-white/[0.08] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center flex-shrink-0 group-hover:border-emerald-500/30 transition-colors">
                  <feature.icon className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">{feature.title}</h3>
                  <p className="text-slate-500 text-sm">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
          
          {/* Stats */}
          <div className="flex items-center gap-8 pt-6 border-t border-white/[0.08]">
            <div>
              <div className="text-2xl font-bold text-white">$50M+</div>
              <div className="text-sm text-slate-500">Tracked Revenue</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">500+</div>
              <div className="text-sm text-slate-500">Projects Managed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">99.9%</div>
              <div className="text-sm text-slate-500">Uptime</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Right Panel - Login */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 relative">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center gap-3 mb-2">
              <VantageLogo size={40} />
              <span className="text-2xl font-bold text-white">Vantage</span>
            </div>
            <p className="text-slate-500">Financial Intelligence Platform</p>
          </div>

          {/* Login Card */}
          <div className="bg-slate-900/70 backdrop-blur-xl rounded-2xl border border-white/[0.08] p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/[0.05] border border-white/[0.08] mb-5">
                <Sparkles className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Welcome back</h2>
              <p className="text-slate-500">Sign in to access your dashboard</p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm text-center flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                {error}
              </div>
            )}

            {/* Google Login Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-5 py-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/35 group"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#ffffff" fillOpacity="0.9" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#ffffff" fillOpacity="0.7" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#ffffff" fillOpacity="0.5" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#ffffff" fillOpacity="0.6" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              <span>{loading ? 'Signing in...' : 'Continue with Google'}</span>
              {!loading && (
                <ArrowRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              )}
            </button>

            {/* Workspace hint */}
            <p className="mt-4 text-center text-sm text-slate-500">
              Use your company Google Workspace
            </p>
            
            {/* Divider */}
            <div className="my-6 flex items-center gap-4">
              <div className="flex-1 h-px bg-white/[0.08]" />
              <span className="text-xs text-slate-500 uppercase tracking-wider">Secure</span>
              <div className="flex-1 h-px bg-white/[0.08]" />
            </div>
            
            {/* Trust Indicators */}
            <div className="flex items-center justify-center gap-6 text-slate-500 text-xs">
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-500/70" />
                <span>SSO Login</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-500/70" />
                <span>256-bit SSL</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-emerald-500/70" />
                <span>SOC 2</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-slate-600">
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
