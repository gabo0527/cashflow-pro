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
  // Financial nav commented out per operations repositioning (reversible)
  // { label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={18} />, adminOnly: true },
  // { label: 'Cash Flow', href: '/cash-flow', icon: <Wallet size={18} />, adminOnly: true },
  // { label: 'Invoices', href: '/invoices', icon: <FileText size={18} />, adminOnly: true },
  // { label: 'Cash Management', href: '/expenses', icon: <Receipt size={18} />, adminOnly: true },
  { label: 'Projects', href: '/projects', icon: <FolderKanban size={18} />, adminOnly: true },
  { label: 'Clients', href: '/clients', icon: <Users size={18} />, adminOnly: true },
  { label: 'Time Tracking', href: '/time-tracking', icon: <Clock size={18} />, section: 'Operations', adminOnly: true },
  { label: 'Contractor Mgmt', href: '/contractor-management', icon: <ClipboardList size={18} />, adminOnly: true },
  { label: 'Team', href: '/team', icon: <UserCog size={18} />, adminOnly: true },
  { label: 'Reports', href: '/reports', icon: <BarChart3 size={18} />, section: 'Analysis', adminOnly: true },
  // { label: 'Forecast', href: '/forecast', icon: <Calculator size={18} />, adminOnly: true },
  { label: 'Sage', href: '/ai-assistant', icon: <MessageSquare size={18} />, section: 'Intelligence', adminOnly: true },
  { label: 'Settings', href: '/settings', icon: <Settings size={18} />, section: 'System', adminOnly: true },
  { label: 'My Timesheet', href: '/timesheet', icon: <Clock size={18} /> },
  { label: 'My Expenses', href: '/expense-report', icon: <Receipt size={18} /> },
]

const MONO = "'JetBrains Mono', monospace"
const DISPLAY = "'Archivo', system-ui, sans-serif"

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
        'fixed left-0 top-0 h-full z-40 flex flex-col overflow-hidden transition-all duration-300',
        collapsed ? 'w-16' : 'w-60'
      )}
      style={{ background: 'linear-gradient(165deg,#181e23 0%,#151b1f 55%,#11161b 100%)' }}
    >
      {/* Texture overlays */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 13px)' }} />
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '17px 17px', opacity: 0.6 }} />
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(100% 40% at 100% 0%, rgba(110,231,183,0.10), transparent 60%)' }} />

      {/* Brand */}
      <div className={cn('relative flex items-center h-16 border-b border-white/[0.07]', collapsed ? 'justify-center px-2' : 'px-4')}>
        <div className="flex items-center gap-3">
          <svg width={collapsed ? 26 : 28} height={collapsed ? 26 : 28} viewBox="0 0 40 40" fill="none" className="flex-shrink-0">
            <path d="M8 8L20 32L32 8" stroke="#6EE7B7" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 4px rgba(110,231,183,0.5))' }} />
          </svg>
          {!collapsed && (
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-white" style={{ fontFamily: DISPLAY }}>VantageFP</h1>
              {companyName && (
                <p className="text-[9px] -mt-0.5 truncate max-w-32" style={{ fontFamily: MONO, color: 'rgba(110,231,183,0.5)' }}>{companyName}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const showSection = item.section && item.section !== currentSection

            if (item.section) {
              currentSection = item.section
            }

            return (
              <React.Fragment key={item.href}>
                {showSection && !collapsed && (
                  <li className="pt-4 pb-1.5 px-3">
                    <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em]" style={{ fontFamily: MONO, color: 'rgba(110,231,183,0.42)' }}>
                      // {item.section}
                    </span>
                  </li>
                )}
                {showSection && collapsed && (
                  <li className="pt-3 pb-1">
                    <div className="mx-3 border-t border-white/[0.06]" />
                  </li>
                )}

                <li>
                  <Link
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'group relative flex items-center gap-3 px-3 py-2 rounded-lg transition-all',
                      collapsed && 'justify-center',
                      isActive ? 'text-white font-semibold' : 'text-white/60 hover:text-white hover:bg-white/[0.05]'
                    )}
                    style={isActive ? { background: 'linear-gradient(90deg, rgba(16,185,129,0.24), rgba(16,185,129,0.05))', boxShadow: '0 0 18px -3px rgba(110,231,183,0.3) inset' } : undefined}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full" style={{ background: '#6EE7B7', boxShadow: '0 0 8px rgba(110,231,183,0.7)' }} />
                    )}
                    <span className="flex-shrink-0" style={{ color: isActive ? '#6EE7B7' : 'rgba(255,255,255,0.5)' }}>
                      {item.icon}
                    </span>
                    {!collapsed && (
                      <span className="text-[13px]">{item.label}</span>
                    )}
                  </Link>
                </li>
              </React.Fragment>
            )
          })}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="relative border-t border-white/[0.07] p-2">
        {!collapsed && (
          <div className="flex items-center gap-2 px-3 pb-2 pt-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#6EE7B7', boxShadow: '0 0 6px rgba(110,231,183,0.8)' }} />
            <span className="text-[9.5px]" style={{ fontFamily: MONO, color: 'rgba(110,231,183,0.55)' }}>online</span>
          </div>
        )}

        <button
          onClick={onSignOut}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-white/45 hover:text-white/80 hover:bg-white/[0.05] transition-colors',
            collapsed && 'justify-center'
          )}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut size={18} />
          {!collapsed && <span className="text-[13px] font-medium">Sign Out</span>}
        </button>

        <button
          onClick={onToggle}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-white/45 hover:text-white/80 hover:bg-white/[0.05] transition-colors mt-0.5',
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
