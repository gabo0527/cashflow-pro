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
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  // Theme classes
  const isDark = theme === 'dark'
  const bgClass = isDark ? 'bg-slate-950' : 'bg-slate-50'
  const textClass = isDark ? 'text-slate-100' : 'text-slate-800'

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('vantage-theme') as 'light' | 'dark' | null
    if (savedTheme) {
      setTheme(savedTheme)
    }
    const savedCollapsed = localStorage.getItem('vantage-sidebar-collapsed')
    if (savedCollapsed === 'true') {
      setSidebarCollapsed(true)
    }
  }, [])

  // Save theme to localStorage
  const handleThemeToggle = useCallback(() => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    localStorage.setItem('vantage-theme', newTheme)
  }, [theme])

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

  // Loading state
  if (loading) {
    return (
      <div className={cn('min-h-screen flex items-center justify-center', bgClass)}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className={cn('text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('min-h-screen', bgClass, textClass)}>
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={handleSidebarToggle}
        theme={theme}
        companyName={companyName}
        onSignOut={handleSignOut}
      />
      
      {/* Header */}
      <Header
        theme={theme}
        onThemeToggle={handleThemeToggle}
        userEmail={user?.email}
        userName={profile?.full_name}
        onOpenChat={() => setChatOpen(true)}
        sidebarCollapsed={sidebarCollapsed}
      />
      
      {/* Main Content */}
      <main
        className={cn(
          'pt-16 min-h-screen transition-all duration-300',
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
                theme,
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
        theme={theme}
        companyId={companyId}
      />
    </div>
  )
}
