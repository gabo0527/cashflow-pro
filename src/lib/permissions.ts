// src/lib/permissions.ts
// ============================================================
// SINGLE SOURCE OF TRUTH — Permission roles & route access
// Import this everywhere. Do NOT duplicate in page files.
// ============================================================

export type PermissionRole = 'owner' | 'admin' | 'member' | 'viewer' | 'employee'

export interface PermissionConfig {
  label: string
  description: string
  color: string
  access: string[]       // feature IDs this role can access
  routes: string[]       // URL paths this role can navigate to
}

// ====== PERMISSION MATRIX ======
export const PERMISSION_MATRIX: Record<PermissionRole, PermissionConfig> = {
  owner: {
    label: 'Owner',
    description: 'Full access, can delete company',
    color: 'text-purple-400',
    access: ['dashboard','cash_flow','invoices','expenses','expense_management','time_tracking','team','projects','clients','reports','forecast','sage','settings'],
    routes: ['/dashboard','/cash-flow','/invoices','/expenses','/expense-management','/time-tracking','/team','/projects','/clients','/reports','/forecast','/ai-assistant','/settings'],
  },
  admin: {
    label: 'Admin',
    description: 'Full access except billing & delete',
    color: 'text-emerald-400',
    access: ['dashboard','cash_flow','invoices','expenses','expense_management','time_tracking','team','projects','clients','reports','forecast','sage','settings'],
    routes: ['/dashboard','/cash-flow','/invoices','/expenses','/expense-management','/time-tracking','/team','/projects','/clients','/reports','/forecast','/ai-assistant','/settings'],
  },
  member: {
    label: 'Member',
    description: 'Can edit data, view reports',
    color: 'text-blue-400',
    access: ['dashboard','invoices','expenses','time_tracking','projects','reports'],
    routes: ['/dashboard','/invoices','/expenses','/time-tracking','/projects','/reports'],
  },
  viewer: {
    label: 'Viewer',
    description: 'Read-only access to dashboards',
    color: 'text-slate-400',
    access: ['dashboard','reports'],
    routes: ['/dashboard','/reports'],
  },
  employee: {
    label: 'Employee',
    description: 'Timesheet & expenses only',
    color: 'text-amber-400',
    access: ['timesheet','expenses_submit'],
    routes: ['/timesheet','/expense-report'],
  },
}

// ====== HELPERS ======

/** Check if a role can access a specific feature */
export function canAccess(role: PermissionRole, feature: string): boolean {
  return PERMISSION_MATRIX[role]?.access.includes(feature) ?? false
}

/** Check if a role can navigate to a specific route */
export function canNavigate(role: PermissionRole, pathname: string): boolean {
  const config = PERMISSION_MATRIX[role]
  if (!config) return false
  
  // Public routes — always allowed
  const publicRoutes = ['/login', '/terms', '/privacy', '/auth/callback']
  if (publicRoutes.includes(pathname)) return true
  
  // Check if pathname matches any allowed route (supports nested paths)
  return config.routes.some(route => 
    pathname === route || pathname.startsWith(route + '/')
  )
}

/** Get the default landing page for a role */
export function getDefaultRoute(role: PermissionRole): string {
  switch (role) {
    case 'employee': return '/timesheet'
    case 'viewer': return '/dashboard'
    default: return '/dashboard'
  }
}

/** Get all allowed routes for a role */
export function getAllowedRoutes(role: PermissionRole): string[] {
  return PERMISSION_MATRIX[role]?.routes ?? []
}

/** Check if role is admin-level (owner or admin) */
export function isAdmin(role: PermissionRole): boolean {
  return role === 'owner' || role === 'admin'
}

/** Check if role can modify data (not viewer/employee) */
export function canEdit(role: PermissionRole): boolean {
  return ['owner', 'admin', 'member'].includes(role)
}
