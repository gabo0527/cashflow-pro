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

export default function Sidebar({ collapsed, onToggle, companyName, onSignOut }: SidebarProps) {
  const pathname = usePathname()
  
  let currentSection = ''

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-300',
        'bg-slate-900/80 backdrop-blur-xl border-r border-white/[0.08]',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo / Brand */}
      <div className={cn(
        'flex items-center h-16 border-b border-white/[0.08]',
        collapsed ? 'justify-center px-2' : 'px-4'
      )}>
        <div className="flex items-center gap-3">
          {/* Logo with glow effect */}
          <div className="relative flex-shrink-0">
            <svg 
              width={collapsed ? 28 : 32} 
              height={collapsed ? 28 : 32} 
              viewBox="0 0 40 40" 
              fill="none"
            >
              <defs>
                <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
              </defs>
              <path 
                d="M8 8L20 32L32 8" 
                stroke="url(#logoGradient)" 
                strokeWidth="4" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                fill="none"
                filter="url(#glow)"
              />
            </svg>
          </div>
          
          {/* Text */}
          {!collapsed && (
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Vantage</h1>
              {companyName && (
                <p className="text-[10px] text-slate-400 -mt-0.5 truncate max-w-32">{companyName}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const showSection = item.section && item.section !== currentSection
            
            if (item.section) {
              currentSection = item.section
            }

            return (
              <React.Fragment key={item.href}>
                {/* Section divider */}
                {showSection && !collapsed && (
                  <li className="pt-5 pb-2 px-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {item.section}
                    </span>
                  </li>
                )}
                {showSection && collapsed && (
                  <li className="pt-4 pb-2">
                    <div className="mx-3 border-t border-white/[0.06]" />
                  </li>
                )}
                
                {/* Nav item */}
                <li>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                      collapsed && 'justify-center',
                      isActive 
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' 
                        : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className={cn(
                      'flex-shrink-0 transition-colors',
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
      <div className="border-t border-white/[0.08] p-2">
        {/* Sign Out */}
        <button
          onClick={onSignOut}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
            'text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]',
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
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 mt-1',
            'text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]',
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
