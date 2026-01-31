'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Wallet,
  FileText,
  Receipt,
  FolderKanban,
  Users,
  Clock,
  UserCog,
  BarChart3,
  Calculator,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  theme: 'light' | 'dark'
  companyName?: string
  onSignOut: () => void
}

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  section?: string
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={20} /> },
  { label: 'Cash Flow', href: '/cash-flow', icon: <Wallet size={20} /> },
  { label: 'Invoices & AR', href: '/invoices', icon: <FileText size={20} /> },
  { label: 'Expenses', href: '/expenses', icon: <Receipt size={20} /> },
  { label: 'Projects', href: '/projects', icon: <FolderKanban size={20} /> },
  { label: 'Clients', href: '/clients', icon: <Users size={20} /> },
  { label: 'Time Tracking', href: '/time-tracking', icon: <Clock size={20} />, section: 'Operations' },
  { label: 'Team', href: '/team', icon: <UserCog size={20} /> },
  { label: 'Reports', href: '/reports', icon: <BarChart3 size={20} />, section: 'Analysis' },
  { label: 'Forecast', href: '/forecast', icon: <Calculator size={20} /> },
  { label: 'Sage', href: '/ai-assistant', icon: <MessageSquare size={20} />, section: 'Intelligence' },
  { label: 'Settings', href: '/settings', icon: <Settings size={20} />, section: 'System' },
]

export default function Sidebar({ collapsed, onToggle, theme, companyName, onSignOut }: SidebarProps) {
  const pathname = usePathname()
  
  const isDark = theme === 'dark'
  
  // Option B Theme - Slate Navy accent
  const styles = {
    bg: isDark ? 'bg-slate-900' : 'bg-white',
    border: isDark ? 'border-slate-700' : 'border-slate-200',
    text: isDark ? 'text-slate-300' : 'text-slate-600',
    textMuted: isDark ? 'text-slate-500' : 'text-slate-400',
    textHeading: isDark ? 'text-slate-100' : 'text-slate-800',
    hover: isDark ? 'hover:bg-slate-800 hover:text-slate-100' : 'hover:bg-slate-50 hover:text-slate-800',
    // Active state - slate-800 bg with white text (Option B accent)
    active: 'bg-slate-800 text-white',
    sectionLabel: isDark ? 'text-slate-500' : 'text-slate-400',
  }
  
  let currentSection = ''

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-40 flex flex-col border-r transition-all duration-300',
        styles.bg,
        styles.border,
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo / Company */}
      <div className={cn('flex items-center h-16 px-4 border-b', styles.border)}>
        {!collapsed && (
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {/* Vantage Logo - Bar chart style */}
            <svg width={32} height={32} viewBox="0 0 48 48" fill="none" className="flex-shrink-0">
              <rect x="6" y="32" width="6" height="10" rx="1.5" fill="#10B981"/>
              <rect x="14" y="24" width="6" height="18" rx="1.5" fill="#10B981" opacity="0.85"/>
              <rect x="22" y="16" width="6" height="26" rx="1.5" fill="#10B981" opacity="0.7"/>
              <rect x="30" y="24" width="6" height="18" rx="1.5" fill="#10B981" opacity="0.85"/>
              <rect x="38" y="32" width="6" height="10" rx="1.5" fill="#10B981"/>
            </svg>
            <div className="min-w-0">
              <h1 className="font-semibold text-lg tracking-tight">
                <span style={{ 
                  background: 'linear-gradient(135deg, #10B981 0%, #34D399 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontWeight: 700
                }}>V</span>
                <span className={styles.textHeading}>antage</span>
              </h1>
              {companyName && (
                <p className={cn('text-xs truncate', styles.textMuted)}>{companyName}</p>
              )}
            </div>
          </div>
        )}
        {collapsed && (
          <svg width={28} height={28} viewBox="0 0 48 48" fill="none" className="mx-auto">
            <rect x="6" y="32" width="6" height="10" rx="1.5" fill="#10B981"/>
            <rect x="14" y="24" width="6" height="18" rx="1.5" fill="#10B981" opacity="0.85"/>
            <rect x="22" y="16" width="6" height="26" rx="1.5" fill="#10B981" opacity="0.7"/>
            <rect x="30" y="24" width="6" height="18" rx="1.5" fill="#10B981" opacity="0.85"/>
            <rect x="38" y="32" width="6" height="10" rx="1.5" fill="#10B981"/>
          </svg>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const showSection = item.section && item.section !== currentSection
            
            if (item.section) {
              currentSection = item.section
            }

            return (
              <React.Fragment key={item.href}>
                {showSection && !collapsed && (
                  <li className={cn('pt-5 pb-2 px-3 text-[11px] font-semibold uppercase tracking-wider', styles.sectionLabel)}>
                    {item.section}
                  </li>
                )}
                {showSection && collapsed && (
                  <li className="pt-4 pb-2">
                    <div className={cn('mx-auto w-6 border-t', styles.border)} />
                  </li>
                )}
                <li>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150',
                      isActive 
                        ? styles.active
                        : cn(styles.text, styles.hover),
                      collapsed && 'justify-center'
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className={cn(
                      'flex-shrink-0',
                      isActive && 'text-emerald-400'
                    )}>
                      {item.icon}
                    </span>
                    {!collapsed && (
                      <span className="text-sm font-medium">{item.label}</span>
                    )}
                  </Link>
                </li>
              </React.Fragment>
            )
          })}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className={cn('border-t p-2', styles.border)}>
        {/* Sign Out */}
        <button
          onClick={onSignOut}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
            styles.text,
            styles.hover,
            collapsed && 'justify-center'
          )}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut size={20} />
          {!collapsed && <span className="text-sm font-medium">Sign Out</span>}
        </button>

        {/* Collapse Toggle */}
        <button
          onClick={onToggle}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors mt-1',
            styles.text,
            styles.hover,
            collapsed && 'justify-center'
          )}
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          {!collapsed && <span className="text-sm font-medium">Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
