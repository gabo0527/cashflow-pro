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
          } else {
            const { data: co } = await supabase.from('companies').select('name').eq('id', profile.company_id).single()
            if (co?.name) setCompanyName(co.name)
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

  // Listen for company name updates from Settings page
  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail?.name) setCompanyName(e.detail.name)
    }
    window.addEventListener('company-updated', handler)
    return () => window.removeEventListener('company-updated', handler)
  }, [])

  // Handle sign out
  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  // Skip shell for public/portal pages
  if (['/login', '/portal', '/timesheet', '/contractor-portal', '/expense-report', '/terms', '/privacy'].includes(pathname)) {
    return <>{children}</>
  }

  // Loading state
  if (loading) {
    return (
      <div className="v-app min-h-screen bg-[#f4f5f7] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 vUp">
          <svg width={40} height={40} viewBox="0 0 40 40" fill="none" className="animate-pulse">
            <path 
              d="M8 8L20 32L32 8" 
              stroke="#10b981" 
              strokeWidth="3.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              fill="none"
            />
          </svg>
          <p className="text-sm text-gray-400 font-medium">Loading VantageFP...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="v-app min-h-screen bg-[#f4f5f7]">
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
          'pt-16 min-h-screen transition-all duration-300',
          sidebarCollapsed ? 'pl-16' : 'pl-60'
        )}
      >
        <div className="p-6">
          {React.Children.map(children, child => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child, {
                // @ts-ignore
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
        theme="dark"
        companyId={companyId}
      />
    </div>
  )
}
