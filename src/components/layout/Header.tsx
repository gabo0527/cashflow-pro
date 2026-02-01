'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Search, Bell, MessageSquare, ChevronDown, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HeaderProps {
  userEmail?: string
  userName?: string
  onOpenChat: () => void
  sidebarCollapsed: boolean
  onSignOut?: () => void
}

export default function Header({ 
  userEmail, 
  userName,
  onOpenChat,
  sidebarCollapsed,
  onSignOut
}: HeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  
  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const displayName = userName || userEmail?.split('@')[0] || 'User'
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <header
      className={cn(
        'fixed top-0 right-0 h-16 z-30 flex items-center justify-between px-6 transition-all duration-300',
        'bg-slate-900/60 backdrop-blur-xl border-b border-white/[0.08]',
        sidebarCollapsed ? 'left-16' : 'left-60'
      )}
    >
      {/* Left section - Search */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className={cn(
          'relative flex-1 transition-all duration-200',
          searchFocused && 'scale-[1.02]'
        )}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className={cn(
              'w-full pl-10 pr-4 py-2 rounded-lg text-sm transition-all duration-200',
              'bg-white/[0.05] border border-white/[0.08] text-slate-200',
              'placeholder:text-slate-500',
              'focus:outline-none focus:bg-white/[0.08] focus:border-emerald-500/50',
              'focus:ring-2 focus:ring-emerald-500/20'
            )}
          />
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1">
        {/* AI Chat - Sage */}
        <button
          onClick={onOpenChat}
          className={cn(
            'p-2.5 rounded-lg transition-all duration-200',
            'text-slate-400 hover:text-emerald-400',
            'hover:bg-white/[0.05]'
          )}
          title="Open Sage AI"
        >
          <MessageSquare size={20} />
        </button>

        {/* Notifications */}
        <button
          className={cn(
            'p-2.5 rounded-lg transition-all duration-200 relative',
            'text-slate-400 hover:text-white',
            'hover:bg-white/[0.05]'
          )}
          title="Notifications"
        >
          <Bell size={20} />
        </button>

        {/* Divider */}
        <div className="w-px h-8 bg-white/[0.08] mx-2" />

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={cn(
              'flex items-center gap-2.5 pl-1 pr-3 py-1.5 rounded-lg transition-all duration-200',
              'hover:bg-white/[0.05]',
              userMenuOpen && 'bg-white/[0.05]'
            )}
          >
            {/* Avatar with gradient */}
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
              'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white',
              'ring-2 ring-emerald-500/20'
            )}>
              {initials}
            </div>
            <span className="text-sm font-medium text-slate-200 hidden sm:block">
              {displayName}
            </span>
            <ChevronDown 
              size={16} 
              className={cn(
                'text-slate-500 transition-transform duration-200',
                userMenuOpen && 'rotate-180'
              )} 
            />
          </button>

          {/* Dropdown Menu */}
          {userMenuOpen && (
            <div className={cn(
              'absolute right-0 top-full mt-2 w-56 rounded-xl overflow-hidden',
              'bg-slate-900/95 backdrop-blur-xl border border-white/[0.1]',
              'shadow-xl shadow-black/20',
              'animate-fade-in'
            )}>
              {/* User info */}
              <div className="px-4 py-3 border-b border-white/[0.08]">
                <p className="text-sm font-medium text-white">{displayName}</p>
                {userEmail && (
                  <p className="text-xs text-slate-500 mt-0.5">{userEmail}</p>
                )}
              </div>
              
              {/* Menu items */}
              <div className="py-1">
                <a
                  href="/settings"
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                    'text-slate-300 hover:text-white hover:bg-white/[0.05]'
                  )}
                >
                  <Settings size={16} className="text-slate-500" />
                  Account Settings
                </a>
                {onSignOut && (
                  <button
                    onClick={onSignOut}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                      'text-slate-300 hover:text-white hover:bg-white/[0.05]'
                    )}
                  >
                    <LogOut size={16} className="text-slate-500" />
                    Sign Out
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
