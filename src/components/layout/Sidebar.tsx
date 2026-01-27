'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Wallet,
  FileText,
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
  LogOut,
  Building2
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
  { label: 'Projects', href: '/projects', icon: <FolderKanban size={20} /> },
  { label: 'Clients', href: '/clients', icon: <Users size={20} /> },
  { label: 'Time Tracking', href: '/time-tracking', icon: <Clock size={20} />, section: 'Operations' },
  { label: 'Team', href: '/team', icon: <UserCog size={20} /> },
  { label: 'Reports', href: '/reports', icon: <BarChart3 size={20} />, section: 'Analysis' },
  { label: 'Forecast', href: '/forecast', icon: <Calculator size={20} /> },
  { label: 'AI Assistant', href: '/ai', icon: <MessageSquare size={20} />, section: 'Intelligence' },
  { label: 'Settings', href: '/settings', icon: <Settings size={20} />, section: 'System' },
]

export default function Sidebar({ collapsed, onToggle, theme, companyName, onSignOut }: SidebarProps) {
  const pathname = usePathname()
  
  const isDark = theme === 'dark'
  
  // Theme classes
  const bgClass = isDark ? 'bg-slate-900' : 'bg-white'
  const borderClass = isDark ? 'border-slate-700' : 'border-slate-200'
  const textClass = isDark ? 'text-slate-100' : 'text-slate-800'
  const textMutedClass = isDark ? 'text-slate-400' : 'text-slate-500'
  const hoverClass = isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
  const activeClass = isDark ? 'bg-slate-800 text-blue-400' : 'bg-blue-50 text-blue-600'
  
  let currentSection = ''

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-40 flex flex-col border-r transition-all duration-300',
        bgClass,
        borderClass,
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo / Company */}
      <div className={cn('flex items-center h-16 px-4 border-b', borderClass)}>
        {!collapsed && (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center flex-shrink-0">
              <Building2 size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className={cn('font-semibold truncate', textClass)}>Vantage</h1>
              {companyName && (
                <p className={cn('text-xs truncate', textMutedClass)}>{companyName}</p>
              )}
            </div>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center mx-auto">
            <Building2 size={18} className="text-white" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {navItems.map((item, index) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const showSection = item.section && item.section !== currentSection
            
            if (item.section) {
              currentSection = item.section
            }

            return (
              <React.Fragment key={item.href}>
                {showSection && !collapsed && (
                  <li className={cn('pt-4 pb-2 px-3 text-xs font-medium uppercase tracking-wider', textMutedClass)}>
                    {item.section}
                  </li>
                )}
                {showSection && collapsed && (
                  <li className="pt-4">
                    <div className={cn('mx-auto w-6 border-t', borderClass)} />
                  </li>
                )}
                <li>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                      isActive ? activeClass : cn(textClass, hoverClass),
                      collapsed && 'justify-center'
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                  </Link>
                </li>
              </React.Fragment>
            )
          })}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className={cn('border-t p-2', borderClass)}>
        {/* Sign Out */}
        <button
          onClick={onSignOut}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
            textMutedClass,
            hoverClass,
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
            textMutedClass,
            hoverClass,
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
