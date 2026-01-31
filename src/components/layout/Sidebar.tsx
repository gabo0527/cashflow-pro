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
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={18} strokeWidth={1.75} /> },
  { label: 'Cash Flow', href: '/cash-flow', icon: <Wallet size={18} strokeWidth={1.75} /> },
  { label: 'Invoices & AR', href: '/invoices', icon: <FileText size={18} strokeWidth={1.75} /> },
  { label: 'Expenses', href: '/expenses', icon: <Receipt size={18} strokeWidth={1.75} /> },
  { label: 'Projects', href: '/projects', icon: <FolderKanban size={18} strokeWidth={1.75} /> },
  { label: 'Clients', href: '/clients', icon: <Users size={18} strokeWidth={1.75} /> },
  { label: 'Time Tracking', href: '/time-tracking', icon: <Clock size={18} strokeWidth={1.75} />, section: 'Operations' },
  { label: 'Team', href: '/team', icon: <UserCog size={18} strokeWidth={1.75} /> },
  { label: 'Reports', href: '/reports', icon: <BarChart3 size={18} strokeWidth={1.75} />, section: 'Analysis' },
  { label: 'Forecast', href: '/forecast', icon: <Calculator size={18} strokeWidth={1.75} /> },
  { label: 'Sage', href: '/ai-assistant', icon: <MessageSquare size={18} strokeWidth={1.75} />, section: 'Intelligence' },
  { label: 'Settings', href: '/settings', icon: <Settings size={18} strokeWidth={1.75} />, section: 'System' },
]

export default function Sidebar({ collapsed, onToggle, theme, companyName, onSignOut }: SidebarProps) {
  const pathname = usePathname()
  
  // Premium light theme - matches page background
  // Note: We ignore the theme prop and always use light for consistency
  const styles = {
    bg: 'bg-white',
    border: 'border-gray-200',
    text: 'text-gray-600',
    textMuted: 'text-gray-400',
    textHeading: 'text-gray-900',
    hover: 'hover:bg-gray-50 hover:text-gray-900',
    // Active: subtle emerald left border + light emerald background
    active: 'bg-emerald-50 text-emerald-700 border-l-2 border-emerald-500',
    activeCollapsed: 'bg-emerald-50 text-emerald-700',
    sectionLabel: 'text-gray-400',
  }
  
  let currentSection = ''

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-40 flex flex-col border-r transition-all duration-300',
        styles.bg,
        styles.border,
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center h-16 px-4 border-b', styles.border)}>
        {!collapsed ? (
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {/* Vantage Logo */}
            <svg width={28} height={28} viewBox="0 0 48 48" fill="none" className="flex-shrink-0">
              <rect x="6" y="32" width="6" height="10" rx="1.5" fill="#10B981"/>
              <rect x="14" y="24" width="6" height="18" rx="1.5" fill="#10B981" opacity="0.8"/>
              <rect x="22" y="16" width="6" height="26" rx="1.5" fill="#10B981" opacity="0.6"/>
              <rect x="30" y="24" width="6" height="18" rx="1.5" fill="#10B981" opacity="0.8"/>
              <rect x="38" y="32" width="6" height="10" rx="1.5" fill="#10B981"/>
            </svg>
            <div className="min-w-0">
              <h1 className="font-semibold text-base tracking-tight text-gray-900">
                <span className="text-emerald-500">V</span>antage
              </h1>
              {companyName && (
                <p className="text-[11px] text-gray-400 truncate -mt-0.5">{companyName}</p>
              )}
            </div>
          </div>
        ) : (
          <svg width={24} height={24} viewBox="0 0 48 48" fill="none" className="mx-auto">
            <rect x="6" y="32" width="6" height="10" rx="1.5" fill="#10B981"/>
            <rect x="14" y="24" width="6" height="18" rx="1.5" fill="#10B981" opacity="0.8"/>
            <rect x="22" y="16" width="6" height="26" rx="1.5" fill="#10B981" opacity="0.6"/>
            <rect x="30" y="24" width="6" height="18" rx="1.5" fill="#10B981" opacity="0.8"/>
            <rect x="38" y="32" width="6" height="10" rx="1.5" fill="#10B981"/>
          </svg>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const showSection = item.section && item.section !== currentSection
            
            if (item.section) {
              currentSection = item.section
            }

            return (
              <React.Fragment key={item.href}>
                {showSection && !collapsed && (
                  <li className={cn('pt-5 pb-2 px-3 text-[10px] font-semibold uppercase tracking-widest', styles.sectionLabel)}>
                    {item.section}
                  </li>
                )}
                {showSection && collapsed && (
                  <li className="pt-3 pb-2">
                    <div className={cn('mx-auto w-5 border-t', styles.border)} />
                  </li>
                )}
                <li>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-150 text-[13px] font-medium',
                      isActive 
                        ? (collapsed ? styles.activeCollapsed : styles.active)
                        : cn(styles.text, styles.hover),
                      collapsed && 'justify-center',
                      !collapsed && isActive && '-ml-0.5' // Compensate for border
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                </li>
              </React.Fragment>
            )
          })}
        </ul>
      </nav>

      {/* Bottom */}
      <div className={cn('border-t p-2', styles.border)}>
        <button
          onClick={onSignOut}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-[13px] font-medium',
            styles.text,
            styles.hover,
            collapsed && 'justify-center'
          )}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut size={18} strokeWidth={1.75} />
          {!collapsed && <span>Sign Out</span>}
        </button>

        <button
          onClick={onToggle}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-[13px] font-medium mt-0.5',
            styles.text,
            styles.hover,
            collapsed && 'justify-center'
          )}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight size={18} strokeWidth={1.75} /> : <ChevronLeft size={18} strokeWidth={1.75} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
