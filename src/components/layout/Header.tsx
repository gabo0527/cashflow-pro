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
        'bg-white/95 backdrop-blur-xl border-b border-gray-200',
        sidebarCollapsed ? 'left-16' : 'left-60'
      )}
    >
      {/* Left section - Search */}
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <div className={cn(
          'relative flex-1 vSrch rounded-lg border border-gray-200 bg-gray-50',
          searchFocused && 'scale-[1.01] bg-white'
        )}>
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className={cn(
              'w-full pl-10 pr-4 py-2 rounded-lg text-sm',
              'bg-transparent text-gray-900',
              'placeholder:text-gray-400',
              'focus:outline-none',
              'border-0'
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
            'vBtn p-2.5 rounded-lg',
            'text-gray-400 hover:text-emerald-600',
            'hover:bg-emerald-50'
          )}
          title="Open Sage AI"
        >
          <MessageSquare size={18} />
        </button>

        {/* Notifications */}
        <button
          className={cn(
            'vBtn p-2.5 rounded-lg relative',
            'text-gray-400 hover:text-gray-600',
            'hover:bg-gray-50'
          )}
          title="Notifications"
        >
          <Bell size={18} />
        </button>

        {/* Divider */}
        <div className="w-px h-7 bg-gray-200 mx-2" />

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={cn(
              'vBtn flex items-center gap-2.5 pl-1 pr-3 py-1.5 rounded-lg',
              'hover:bg-gray-50',
              userMenuOpen && 'bg-gray-50'
            )}
          >
            {/* Avatar */}
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
              'bg-emerald-100 text-emerald-700'
            )}>
              {initials}
            </div>
            <span className="text-sm font-medium text-gray-700 hidden sm:block">
              {displayName}
            </span>
            <ChevronDown 
              size={14} 
              className={cn(
                'text-gray-400 transition-transform duration-200',
                userMenuOpen && 'rotate-180'
              )} 
            />
          </button>

          {/* Dropdown Menu */}
          {userMenuOpen && (
            <div className={cn(
              'vScale absolute right-0 top-full mt-2 w-56 rounded-xl overflow-hidden',
              'bg-white border border-gray-200',
              'shadow-lg shadow-black/8'
            )}>
              {/* User info */}
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">{displayName}</p>
                {userEmail && (
                  <p className="text-xs text-gray-400 mt-0.5">{userEmail}</p>
                )}
              </div>
              
              {/* Menu items */}
              <div className="py-1">
                <a
                  href="/settings"
                  className={cn(
                    'vBtn flex items-center gap-3 px-4 py-2.5 text-sm',
                    'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  )}
                >
                  <Settings size={15} className="text-gray-400" />
                  Account Settings
                </a>
                {onSignOut && (
                  <button
                    onClick={onSignOut}
                    className={cn(
                      'vBtn w-full flex items-center gap-3 px-4 py-2.5 text-sm',
                      'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    )}
                  >
                    <LogOut size={15} className="text-gray-400" />
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
