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
  { label: 'Cash Management', href: '/expenses', icon: <Receipt size={18} />, adminOnly: true },
  { label: 'Projects', href: '/projects', icon: <FolderKanban size={18} />, adminOnly: true },
  { label: 'Clients', href: '/clients', icon: <Users size={18} />, adminOnly: true },
  { label: 'Time Tracking', href: '/time-tracking', icon: <Clock size={18} />, section: 'Operations', adminOnly: true },
  { label: 'Contractor Mgmt', href: '/contractor-management', icon: <ClipboardList size={18} />, adminOnly: true },
  { label: 'Team', href: '/team', icon: <UserCog size={18} />, adminOnly: true },
  { label: 'Reports', href: '/reports', icon: <BarChart3 size={18} />, section: 'Analysis', adminOnly: true },
  { label: 'Forecast', href: '/forecast', icon: <Calculator size={18} />, adminOnly: true },
  { label: 'Sage', href: '/ai-assistant', icon: <MessageSquare size={18} />, section: 'Intelligence', adminOnly: true },
  { label: 'Settings', href: '/settings', icon: <Settings size={18} />, section: 'System', adminOnly: true },
  { label: 'My Timesheet', href: '/timesheet', icon: <Clock size={18} /> },
  { label: 'My Expenses', href: '/expense-report', icon: <Receipt size={18} /> },
]

export default function Sidebar({ collapsed, onToggle, companyName, onSignOut, userRole = 'owner' }: SidebarProps) {
  const pathname = usePathname()
  
  const isLeadership = userRole === 'owner' || userRole === 'admin'
  
  const visibleItems = navItems.filter(item => {
    if (isLeadership) return item.adminOnly === true
    return !item.adminOnly
  })

  let currentSection = ''

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-300',
        'bg-white border-r border-gray-200',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo / Brand */}
      <div className={cn(
        'flex items-center h-16 border-b border-gray-200',
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
              <path 
                d="M8 8L20 32L32 8" 
                stroke="#10b981" 
                strokeWidth="3.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                fill="none"
              />
            </svg>
          </div>
          
          {!collapsed && (
            <div>
              <h1 className="text-base font-bold tracking-tight text-gray-900">VantageFP</h1>
              {companyName && (
                <p className="text-[10px] text-gray-400 -mt-0.5 truncate max-w-32">{companyName}</p>
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
                    <span className="vLbl text-[10px] font-bold uppercase text-gray-400">
                      {item.section}
                    </span>
                  </li>
                )}
                {showSection && collapsed && (
                  <li className="pt-4 pb-2">
                    <div className="mx-3 border-t border-gray-100" />
                  </li>
                )}
                
                {/* Nav item */}
                <li>
                  <Link
                    href={item.href}
                    className={cn(
                      'vBtn flex items-center gap-3 px-3 py-2 rounded-lg relative',
                      collapsed && 'justify-center',
                      isActive 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-emerald-500" />
                    )}
                    <span className={cn(
                      'flex-shrink-0',
                      isActive && 'text-emerald-600'
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
      <div className="border-t border-gray-200 p-2">
        {/* Sign Out */}
        <button
          onClick={onSignOut}
          className={cn(
            'vBtn w-full flex items-center gap-3 px-3 py-2 rounded-lg',
            'text-gray-400 hover:text-gray-600 hover:bg-gray-50',
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
            'vBtn w-full flex items-center gap-3 px-3 py-2 rounded-lg mt-0.5',
            'text-gray-400 hover:text-gray-600 hover:bg-gray-50',
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
