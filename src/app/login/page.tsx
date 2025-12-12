// src/app/login/page.tsx
// Login page with Vantage branding

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  TrendingUp, PieChart, BarChart3, Shield, Users,
  ArrowRight, Zap, LineChart, Target, CheckCircle2
} from 'lucide-react'

// Vantage Logo Component
const VantageLogo = ({ size = 48, className = "" }: { size?: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <circle cx="24" cy="24" r="22" stroke="#3d8a96" stroke-width="2.5" fill="none"/>
    <rect x="12" y="28" width="5" height="10" rx="1" fill="#7cc5cf"/>
    <rect x="19" y="22" width="5" height="16" rx="1" fill="#4da8b5"/>
    <rect x="26" y="14" width="5" height="24" rx="1" fill="#2d8a96"/>
    <path d="M10 32L18 26L25 20L38 12" stroke="#2d6b78" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
)

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Check if already authenticated
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
      icon: LineChart, 
      title: 'Cash Flow Analytics',
      description: 'Real-time visibility into your business cash position'
    },
    { 
      icon: Target, 
      title: 'Project Profitability',
      description: 'Track margins and costs by project with precision'
    },
    { 
      icon: TrendingUp, 
      title: 'Financial Projections',
      description: 'Forecast up to 3 years with assumptions-based modeling'
    },
  ]

  const stats = [
    { value: '$2.4M+', label: 'Tracked Monthly' },
    { value: '99.9%', label: 'Uptime' },
    { value: '256-bit', label: 'Encryption' },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      {/* Left Panel - Branding & Features */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-[#0f172a] to-slate-900">
          {/* Gradient Orbs */}
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-teal-500/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-cyan-500/15 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 w-[300px] h-[300px] bg-teal-400/10 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '2s' }} />
          
          {/* Grid Pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }} />
        </div>
        
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Header */}
          <div>
            {/* Logo */}
            <div className="flex items-center gap-4 mb-20">
              <VantageLogo size={52} />
              <span className="text-2xl font-bold text-white tracking-tight uppercase">Vantage</span>
            </div>
            
            {/* Hero Text */}
            <div className="max-w-lg">
              <h1 className="text-5xl font-bold text-white mb-6 leading-[1.1] tracking-tight">
                Financial clarity for
                <span className="block mt-2 bg-gradient-to-r from-teal-400 via-cyan-400 to-teal-400 bg-clip-text text-transparent">
                  growing businesses
                </span>
              </h1>
              <p className="text-slate-400 text-lg leading-relaxed">
                The modern platform for project-based businesses to track cash flow, 
                analyze profitability, and make data-driven decisions.
              </p>
            </div>
          </div>
          
          {/* Features */}
          <div className="space-y-5 my-12">
            {features.map((feature, idx) => (
              <div 
                key={idx} 
                className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.05] backdrop-blur-sm hover:bg-white/[0.05] transition-colors group"
              >
                <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-teal-500/20 to-cyan-500/20 flex items-center justify-center flex-shrink-0 group-hover:from-teal-500/30 group-hover:to-cyan-500/30 transition-colors">
                  <feature.icon className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold mb-1">{feature.title}</h3>
                  <p className="text-slate-500 text-sm">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
          
          {/* Stats Bar */}
          <div className="flex items-center gap-8 pt-8 border-t border-white/[0.06]">
            {stats.map((stat, idx) => (
              <div key={idx}>
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <div className="text-slate-500 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 bg-[#0a0a0f]">
        <div className="w-full max-w-[420px]">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-10">
            <div className="inline-flex items-center gap-3 mb-3">
              <VantageLogo size={48} />
              <span className="text-2xl font-bold text-white uppercase">Vantage</span>
            </div>
            <p className="text-slate-500">Project & Cash Flow Analytics</p>
          </div>

          {/* Login Card */}
          <div className="bg-gradient-to-b from-slate-800/50 to-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 shadow-2xl shadow-black/20">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-teal-500/20 to-cyan-500/20 mb-5">
                <VantageLogo size={40} />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Welcome back</h2>
              <p className="text-slate-400">Sign in to access your dashboard</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                {error}
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-5 py-4 bg-white hover:bg-gray-50 text-gray-800 font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] group"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
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
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform" />
              )}
            </button>

            <div className="mt-6 flex items-center gap-2 justify-center text-slate-500 text-sm">
              <Users className="w-4 h-4" />
              <span>Use your company Google Workspace</span>
            </div>
            
            {/* Divider */}
            <div className="my-6 flex items-center gap-4">
              <div className="flex-1 h-px bg-slate-700/50" />
              <span className="text-slate-600 text-xs uppercase tracking-wider">Secure</span>
              <div className="flex-1 h-px bg-slate-700/50" />
            </div>
            
            {/* Trust Indicators */}
            <div className="flex items-center justify-center gap-6 text-slate-500 text-xs">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-teal-500" />
                <span>SSO Login</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                <span>SOC 2</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-teal-500" />
                <span>Encrypted</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-slate-600">
            By signing in, you agree to our{' '}
            <button className="text-slate-500 hover:text-teal-400 transition-colors underline underline-offset-2">Terms of Service</button>
            {' '}and{' '}
            <button className="text-slate-500 hover:text-teal-400 transition-colors underline underline-offset-2">Privacy Policy</button>
          </p>
          
          {/* Powered By */}
          <div className="mt-6 text-center text-xs text-slate-700">
            Powered by <span className="text-slate-500">Supabase</span> + <span className="text-slate-500">Vercel</span>
          </div>
        </div>
      </div>
    </div>
  )
}
