// src/app/login/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowRight, BarChart3, PieChart, TrendingUp, Shield, Sparkles } from 'lucide-react'

// Vantage Logo - Teal bars matching dashboard
const VantageLogo = ({ size = 40, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <rect x="4" y="20" width="8" height="16" rx="2" fill="#2dd4bf" fillOpacity="0.5"/>
    <rect x="16" y="12" width="8" height="24" rx="2" fill="#2dd4bf" fillOpacity="0.75"/>
    <rect x="28" y="4" width="8" height="32" rx="2" fill="#2dd4bf"/>
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
    <div className="min-h-screen bg-slate-900 flex">
      {/* Left Panel - Features */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-800">
        {/* Gradient accents */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Header */}
          <div className="flex items-center gap-3">
            <VantageLogo size={44} />
            <span className="text-2xl font-bold text-slate-100 tracking-tight">Vantage</span>
          </div>
          
          {/* Hero Section */}
          <div className="max-w-md">
            <h1 className="text-4xl font-bold text-slate-100 leading-tight mb-4">
              Financial clarity for
              <span className="block text-teal-400 mt-1">modern businesses</span>
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
                className="flex items-start gap-4 p-4 rounded-xl bg-slate-700/30 border border-slate-700 hover:bg-slate-700/50 hover:border-slate-600 transition-all group"
              >
                <div className="w-12 h-12 rounded-xl bg-slate-700 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-600 transition-colors">
                  <feature.icon className="w-6 h-6 text-teal-400" />
                </div>
                <div>
                  <h3 className="text-slate-100 font-semibold mb-1">{feature.title}</h3>
                  <p className="text-slate-500 text-sm">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
          
          {/* Stats */}
          <div className="flex items-center gap-8 pt-6 border-t border-slate-700">
            <div>
              <div className="text-2xl font-bold text-slate-100">$50M+</div>
              <div className="text-sm text-slate-500">Tracked Revenue</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-100">500+</div>
              <div className="text-sm text-slate-500">Projects Managed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-100">99.9%</div>
              <div className="text-sm text-slate-500">Uptime</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Right Panel - Login */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center gap-3 mb-2">
              <VantageLogo size={40} />
              <span className="text-2xl font-bold text-slate-100">Vantage</span>
            </div>
            <p className="text-slate-500">Financial Analytics Platform</p>
          </div>

          {/* Login Card */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-700 mb-5">
                <Sparkles className="w-8 h-8 text-teal-400" />
              </div>
              <h2 className="text-2xl font-bold text-slate-100 mb-2">Welcome back</h2>
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
              className="w-full flex items-center justify-center gap-3 px-5 py-4 bg-teal-500 hover:bg-teal-400 text-slate-900 font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] group"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
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
              <div className="flex-1 h-px bg-slate-700" />
              <span className="text-xs text-slate-500 uppercase tracking-wider">Secure</span>
              <div className="flex-1 h-px bg-slate-700" />
            </div>
            
            {/* Trust Indicators */}
            <div className="flex items-center justify-center gap-6 text-slate-500 text-xs">
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-teal-500" />
                <span>SSO Login</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-teal-500" />
                <span>256-bit SSL</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-teal-500" />
                <span>SOC 2</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-slate-600">
            By signing in, you agree to our{' '}
            <a href="/terms" className="text-slate-500 hover:text-teal-400 underline underline-offset-2 transition-colors">Terms</a>
            {' '}and{' '}
            <a href="/privacy" className="text-slate-500 hover:text-teal-400 underline underline-offset-2 transition-colors">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  )
}
