'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import Header from './Header'
import ChatPanel from '@/components/ai/ChatPanel'
import { cn } from '@/lib/utils'
import { 
  supabase, 
  signOut, 
  getCurrentUser, 
  getCurrentProfile,
  fetchCompanySettings 
} from '@/lib/supabase'

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const router = useRouter()
  const pathname = usePathname()
  
  // Auth state
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  
  // UI state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  // Load sidebar state from localStorage
  useEffect(() => {
    const savedCollapsed = localStorage.getItem('vantage-sidebar-collapsed')
    if (savedCollapsed === 'true') {
      setSidebarCollapsed(true)
    }
  }, [])

  // Save sidebar state
  const handleSidebarToggle = useCallback(() => {
    const newCollapsed = !sidebarCollapsed
    setSidebarCollapsed(newCollapsed)
    localStorage.setItem('vantage-sidebar-collapsed', String(newCollapsed))
  }, [sidebarCollapsed])

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { user } = await getCurrentUser()
        
        if (!user) {
          router.push('/login')
          return
        }
        
        setUser(user)
        
        const { profile } = await getCurrentProfile()
        setProfile(profile)
        
        if (profile?.company_id) {
          setCompanyId(profile.company_id)
          
          const { data: settings } = await fetchCompanySettings(profile.company_id)
          if (settings?.company_name) {
            setCompanyName(settings.company_name)
          }
        }
        
        setLoading(false)
      } catch (error) {
        console.error('Auth error:', error)
        router.push('/login')
      }
    }
    
    checkAuth()
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login')
      }
    })
    
    return () => subscription.unsubscribe()
  }, [router])

  // Handle sign out
  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  // Skip shell for login page
  if (pathname === '/login') {
    return <>{children}</>
  }

  // Loading state with glassmorphism
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          {/* Animated logo with glow */}
          <div className="relative">
            <svg width={48} height={48} viewBox="0 0 40 40" fill="none" className="animate-pulse">
              <defs>
                <linearGradient id="loadingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
              <path 
                d="M8 8L20 32L32 8" 
                stroke="url(#loadingGradient)" 
                strokeWidth="4" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                fill="none"
              />
            </svg>
            {/* Glow effect */}
            <div className="absolute inset-0 blur-xl bg-emerald-500/30 -z-10 animate-pulse" />
          </div>
          <p className="text-sm text-slate-400">Loading Vantage...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* Subtle noise texture overlay */}
      <div 
        className="fixed inset-0 opacity-[0.02] pointer-events-none z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
      
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={handleSidebarToggle}
        companyName={companyName}
        onSignOut={handleSignOut}
      />
      
      {/* Header */}
      <Header
        userEmail={user?.email}
        userName={profile?.full_name}
        onOpenChat={() => setChatOpen(true)}
        sidebarCollapsed={sidebarCollapsed}
        onSignOut={handleSignOut}
      />
      
      {/* Main Content */}
      <main
        className={cn(
          'pt-16 min-h-screen transition-all duration-300 relative z-10',
          sidebarCollapsed ? 'pl-16' : 'pl-60'
        )}
      >
        <div className="p-6">
          {/* Pass context to children */}
          {React.Children.map(children, child => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child, {
                // @ts-ignore - passing props to page components
                companyId,
                user,
                profile
              })
            }
            return child
          })}
        </div>
      </main>

      {/* AI Chat Panel */}
      <ChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        companyId={companyId}
      />
    </div>
  )
}
