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
  
  // UI state - Light mode is the default and primary theme
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  // Load preferences
  useEffect(() => {
    const savedTheme = localStorage.getItem('vantage-theme') as 'light' | 'dark' | null
    // Only use saved theme if it exists, otherwise keep light
    if (savedTheme) {
      setTheme(savedTheme)
    }
    
    const savedCollapsed = localStorage.getItem('vantage-sidebar-collapsed')
    if (savedCollapsed === 'true') {
      setSidebarCollapsed(true)
    }
  }, [])

  const handleThemeToggle = useCallback(() => {
    const newTheme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    localStorage.setItem('vantage-theme', newTheme)
  }, [theme])

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
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login')
      }
    })
    
    return () => subscription.unsubscribe()
  }, [router])

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  // Skip shell for login
  if (pathname === '/login') {
    return <>{children}</>
  }

  // Loading - premium minimal
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          {/* Subtle loading indicator */}
          <div className="w-8 h-8 border-2 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Loading</p>
        </div>
      </div>
    )
  }

  // Page background matches sidebar/header
  const pageBg = theme === 'dark' ? 'bg-slate-950' : 'bg-[#F9FAFB]'

  return (
    <div className={cn('min-h-screen', pageBg)}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={handleSidebarToggle}
        theme={theme}
        companyName={companyName}
        onSignOut={handleSignOut}
      />
      
      <Header
        theme={theme}
        onThemeToggle={handleThemeToggle}
        userEmail={user?.email}
        userName={profile?.full_name}
        onOpenChat={() => setChatOpen(true)}
        sidebarCollapsed={sidebarCollapsed}
      />
      
      {/* Main content - header is h-14, sidebar is w-56 or w-16 */}
      <main
        className={cn(
          'pt-14 min-h-screen transition-all duration-300',
          sidebarCollapsed ? 'pl-16' : 'pl-56'
        )}
      >
        {React.Children.map(children, child => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              // @ts-ignore
              companyId,
              theme,
              user,
              profile
            })
          }
          return child
        })}
      </main>

      <ChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        theme={theme}
        companyId={companyId}
      />
    </div>
  )
}
