// src/hooks/useAuth.ts
// ============================================================
// AUTH + PERMISSIONS HOOK
// Handles authentication, permission lookup, and route guarding.
// Used by AppShell to protect routes based on permission_role.
// ============================================================

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { 
  PermissionRole, 
  canNavigate, 
  getDefaultRoute, 
  isAdmin, 
  canAccess, 
  canEdit,
  PERMISSION_MATRIX 
} from '@/lib/permissions'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '', 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export interface AuthState {
  user: any | null
  profile: any | null
  companyId: string | null
  companyName: string
  permissionRole: PermissionRole
  loading: boolean
  error: string | null
}

interface UseAuthReturn extends AuthState {
  signOut: () => Promise<void>
  // Permission helpers exposed to components
  canAccess: (feature: string) => boolean
  canNavigate: (path: string) => boolean
  canEdit: () => boolean
  isAdmin: () => boolean
}

// Public routes that don't need auth
const PUBLIC_ROUTES = ['/login', '/terms', '/privacy', '/auth/callback']

export function useAuth(): UseAuthReturn {
  const router = useRouter()
  const pathname = usePathname()

  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    companyId: null,
    companyName: '',
    permissionRole: 'employee',
    loading: true,
    error: null,
  })

  // ====== AUTH CHECK + PERMISSION LOOKUP ======
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Skip auth check on public routes
        if (PUBLIC_ROUTES.includes(pathname)) {
          setState(prev => ({ ...prev, loading: false }))
          return
        }

        // 1. Get authenticated user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        
        if (!user || authError) {
          router.push('/login')
          return
        }

        // 2. Get profile with company_id
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, company_id')
          .eq('id', user.id)
          .single()

        if (profileError || !profile?.company_id) {
          console.error('Profile error:', profileError)
          // User authenticated but no company — could be first login
          setState(prev => ({
            ...prev,
            user,
            profile,
            loading: false,
            error: 'No company associated with this account',
          }))
          return
        }

        // 3. Get permission_role from team_members (keyed by email + company)
        const { data: teamMember, error: tmError } = await supabase
          .from('team_members')
          .select('permission_role')
          .eq('company_id', profile.company_id)
          .ilike('email', user.email || '')
          .single()

        const role: PermissionRole = (teamMember?.permission_role as PermissionRole) || 'employee'

        // 4. Get company name
        let companyName = ''
        const { data: settings } = await supabase
          .from('company_settings')
          .select('company_name')
          .eq('company_id', profile.company_id)
          .single()
        
        if (settings?.company_name) {
          companyName = settings.company_name
        } else {
          const { data: co } = await supabase
            .from('companies')
            .select('name')
            .eq('id', profile.company_id)
            .single()
          if (co?.name) companyName = co.name
        }

        // 5. ROUTE GUARD — check if user can access current path
        if (!canNavigate(role, pathname)) {
          console.warn(`[Auth] Role "${role}" denied access to "${pathname}", redirecting`)
          const defaultRoute = getDefaultRoute(role)
          router.push(defaultRoute)
          return
        }

        // 6. Set state
        setState({
          user,
          profile,
          companyId: profile.company_id,
          companyName,
          permissionRole: role,
          loading: false,
          error: null,
        })

      } catch (error) {
        console.error('[Auth] Error:', error)
        router.push('/login')
      }
    }

    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.push('/login')
      }
    })

    return () => subscription.unsubscribe()
  }, [router, pathname])

  // ====== SIGN OUT ======
  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }, [router])

  // ====== RETURN ======
  return {
    ...state,
    signOut: handleSignOut,
    canAccess: (feature: string) => canAccess(state.permissionRole, feature),
    canNavigate: (path: string) => canNavigate(state.permissionRole, path),
    canEdit: () => canEdit(state.permissionRole),
    isAdmin: () => isAdmin(state.permissionRole),
  }
}
