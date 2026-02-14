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
  LogOut,
  ClipboardList
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  companyName?: string
  onSignOut: () => void
  userRole?: 'owner' | 'admin' | 'member' | 'viewer' | 'employee' | string
}

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  section?: string
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={18} />, adminOnly: true },
  { label: 'Cash Flow', href: '/cash-flow', icon: <Wallet size={18} />, adminOnly: true },
  { label: 'Invoices', href: '/invoices', icon: <FileText size={18} />, adminOnly: true },
  { label: 'Expenses', href: '/expenses', icon: <Receipt size={18} />, adminOnly: true },
  { label: 'Projects', href: '/projects', icon: <FolderKanban size={18} />, adminOnly: true },
  { label: 'Clients', href: '/clients', icon: <Users size={18} />, adminOnly: true },
  { label: 'Time Tracking', href: '/time-tracking', icon: <Clock size={18} />, section: 'Operations', adminOnly: true },
  { label: 'Contractor Mgmt', href: '/contractor-management', icon: <ClipboardList size={18} />, adminOnly: true },
  { label: 'Team', href: '/team', icon: <UserCog size={18} />, adminOnly: true },
  { label: 'Reports', href: '/reports', icon: <BarChart3 size={18} />, section: 'Analysis', adminOnly: true },
  { label: 'Forecast', href: '/forecast', icon: <Calculator size={18} />, adminOnly: true },
  { label: 'Sage', href: '/ai-assistant', icon: <MessageSquare size={18} />, section: 'Intelligence', adminOnly: true },
  { label: 'Settings', href: '/settings', icon: <Settings size={18} />, section: 'System', adminOnly: true },
  // Employee-only items
  { label: 'My Timesheet', href: '/timesheet', icon: <Clock size={18} /> },
  { label: 'My Expenses', href: '/expense-report', icon: <Receipt size={18} /> },
]

export default function Sidebar({ collapsed, onToggle, companyName, onSignOut, userRole = 'owner' }: SidebarProps) {
  const pathname = usePathname()
  
  const isLeadership = userRole === 'owner' || userRole === 'admin'
  
  // Filter nav items based on role
  const visibleItems = navItems.filter(item => {
    if (isLeadership) {
      return item.adminOnly === true
    } else {
      return !item.adminOnly
    }
  })

  let currentSection = ''

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-300',
        'bg-[#0B1120] border-r border-slate-800/80',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo / Brand */}
      <div className={cn(
        'flex items-center h-16 border-b border-slate-800/80',
        collapsed ? 'justify-center px-2' : 'px-4'
      )}>
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0">
            <svg 
              width={collapsed ? 26 : 28} 
              height={collapsed ? 26 : 28} 
              viewBox="0 0 40 40" 
              fill="none"
            >
              <defs>
                <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#2dd4bf" />
                  <stop offset="100%" stopColor="#0d9488" />
                </linearGradient>
              </defs>
              <path 
                d="M8 8L20 32L32 8" 
                stroke="url(#logoGradient)" 
                strokeWidth="3.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                fill="none"
              />
            </svg>
          </div>
          
          {!collapsed && (
            <div>
              <h1 className="text-base font-semibold tracking-tight text-white">VantageFP</h1>
              {companyName && (
                <p className="text-[10px] text-slate-500 -mt-0.5 truncate max-w-32">{companyName}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const showSection = item.section && item.section !== currentSection
            
            if (item.section) {
              currentSection = item.section
            }

            return (
              <React.Fragment key={item.href}>
                {/* Section divider */}
                {showSection && !collapsed && (
                  <li className="pt-6 pb-1.5 px-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
                      {item.section}
                    </span>
                  </li>
                )}
                {showSection && collapsed && (
                  <li className="pt-4 pb-2">
                    <div className="mx-3 border-t border-slate-800/60" />
                  </li>
                )}
                
                {/* Nav item */}
                <li>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 relative',
                      collapsed && 'justify-center',
                      isActive 
                        ? 'bg-teal-500/10 text-teal-400' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-teal-400" />
                    )}
                    <span className={cn(
                      'flex-shrink-0 transition-colors',
                      isActive && 'text-teal-400'
                    )}>
                      {item.icon}
                    </span>
                    {!collapsed && (
                      <span className="text-[13px] font-medium">{item.label}</span>
                    )}
                  </Link>
                </li>
              </React.Fragment>
            )
          })}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="border-t border-slate-800/80 p-2">
        {/* Sign Out */}
        <button
          onClick={onSignOut}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150',
            'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]',
            collapsed && 'justify-center'
          )}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut size={18} />
          {!collapsed && <span className="text-[13px] font-medium">Sign Out</span>}
        </button>

        {/* Collapse Toggle */}
        <button
          onClick={onToggle}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 mt-0.5',
            'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]',
            collapsed && 'justify-center'
          )}
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          {!collapsed && <span className="text-[13px] font-medium">Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
