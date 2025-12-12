// src/app/login/page.tsx
// Redesigned Login page with Vantage branding

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DollarSign, TrendingUp, PieChart, BarChart3, Shield, Users } from 'lucide-react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [companyLogo, setCompanyLogo] = useState<string | null>(null)
  const router = useRouter()

  // Try to fetch company logo from settings (optional enhancement)
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const { data } = await supabase
          .from('company_settings')
          .select('company_logo')
          .limit(1)
          .single()
        if (data?.company_logo) {
          setCompanyLogo(data.company_logo)
        }
      } catch {
        // No logo found, use default
      }
    }
    fetchLogo()
  }, [])

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
    { icon: TrendingUp, text: 'Cash Flow Analytics' },
    { icon: PieChart, text: 'Project Profitability' },
    { icon: BarChart3, text: 'Financial Projections' },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      {/* Left Panel - Branding & Features */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-72 h-72 bg-teal-500 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-500 rounded-full blur-3xl" />
        </div>
        
        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-16">
            {companyLogo ? (
              <img src={companyLogo} alt="Vantage" className="w-12 h-12 rounded-xl object-contain" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                <DollarSign className="w-7 h-7 text-white" />
              </div>
            )}
            <span className="text-2xl font-bold text-white tracking-tight">Vantage</span>
          </div>
          
          {/* Tagline */}
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Project & Cash Flow
            <span className="block text-teal-400">Analytics Platform</span>
          </h1>
          <p className="text-slate-400 text-lg max-w-md">
            Track your business finances, analyze project profitability, and forecast with confidence.
          </p>
        </div>
        
        {/* Features */}
        <div className="relative z-10 space-y-4">
          {features.map((feature, idx) => (
            <div key={idx} className="flex items-center gap-3 text-slate-300">
              <div className="w-10 h-10 rounded-lg bg-slate-800/50 flex items-center justify-center">
                <feature.icon className="w-5 h-5 text-teal-400" />
              </div>
              <span>{feature.text}</span>
            </div>
          ))}
        </div>
        
        {/* Trust Badge */}
        <div className="relative z-10 flex items-center gap-2 text-slate-500 text-sm">
          <Shield className="w-4 h-4" />
          <span>Secure cloud storage • Your data stays private</span>
        </div>
      </div>
      
      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              {companyLogo ? (
                <img src={companyLogo} alt="Vantage" className="w-12 h-12 rounded-xl object-contain" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                  <DollarSign className="w-7 h-7 text-white" />
                </div>
              )}
              <span className="text-2xl font-bold text-white">Vantage</span>
            </div>
            <p className="text-slate-400">Project & Cash Flow Analytics</p>
          </div>

          {/* Login Card */}
          <div className="bg-slate-900/50 backdrop-blur-sm border border-slate-800 rounded-2xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Welcome back</h2>
              <p className="text-slate-400">Sign in to access your dashboard</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-white hover:bg-gray-50 text-gray-800 font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
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
              {loading ? 'Signing in...' : 'Continue with Google'}
            </button>

            <div className="mt-6 flex items-center gap-2 justify-center text-slate-500 text-sm">
              <Users className="w-4 h-4" />
              <span>Use your company Google Workspace account</span>
            </div>
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-slate-600">
            By signing in, you agree to our{' '}
            <button className="text-slate-400 hover:text-teal-400 transition-colors">Terms of Service</button>
            {' '}and{' '}
            <button className="text-slate-400 hover:text-teal-400 transition-colors">Privacy Policy</button>
          </p>
        </div>
      </div>
    </div>
  )
}
