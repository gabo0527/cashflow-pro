'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Sun, Moon, User, ChevronDown, Bell, Search, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HeaderProps {
  theme: 'light' | 'dark'
  onThemeToggle: () => void
  userEmail?: string
  userName?: string
  onOpenChat: () => void
  sidebarCollapsed: boolean
}

export default function Header({ 
  theme, 
  onThemeToggle, 
  userEmail, 
  userName,
  onOpenChat,
  sidebarCollapsed 
}: HeaderProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  
  const isDark = theme === 'dark'
  
  // Theme classes
  const bgClass = isDark ? 'bg-slate-900' : 'bg-white'
  const borderClass = isDark ? 'border-slate-700' : 'border-slate-200'
  const textClass = isDark ? 'text-slate-100' : 'text-slate-800'
  const textMutedClass = isDark ? 'text-slate-400' : 'text-slate-500'
  const hoverClass = isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
  const inputBgClass = isDark ? 'bg-slate-800' : 'bg-slate-100'

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
        'fixed top-0 right-0 h-16 z-30 flex items-center justify-between px-6 border-b transition-all duration-300',
        bgClass,
        borderClass,
        sidebarCollapsed ? 'left-16' : 'left-60'
      )}
    >
      {/* Left section - Search */}
      <div className="flex items-center gap-4 flex-1">
        <div className={cn('relative max-w-md flex-1')}>
          <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4', textMutedClass)} />
          <input
            type="text"
            placeholder="Search..."
            className={cn(
              'w-full pl-10 pr-4 py-2 rounded-lg text-sm outline-none transition-colors',
              inputBgClass,
              textClass,
              'placeholder:' + textMutedClass,
              'focus:ring-2 focus:ring-blue-500/50'
            )}
          />
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-2">
        {/* AI Chat Quick Access */}
        <button
          onClick={onOpenChat}
          className={cn(
            'p-2 rounded-lg transition-colors',
            hoverClass,
            textMutedClass,
            'hover:text-blue-500'
          )}
          title="Open AI Assistant"
        >
          <MessageSquare size={20} />
        </button>

        {/* Notifications */}
        <button
          className={cn(
            'p-2 rounded-lg transition-colors relative',
            hoverClass,
            textMutedClass
          )}
          title="Notifications"
        >
          <Bell size={20} />
          {/* Notification dot */}
          {/* <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" /> */}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onThemeToggle}
          className={cn(
            'p-2 rounded-lg transition-colors',
            hoverClass,
            textMutedClass
          )}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={cn(
              'flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg transition-colors',
              hoverClass
            )}
          >
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
              'bg-blue-500 text-white'
            )}>
              {initials}
            </div>
            <span className={cn('text-sm font-medium hidden sm:block', textClass)}>
              {displayName}
            </span>
            <ChevronDown size={16} className={textMutedClass} />
          </button>

          {/* Dropdown Menu */}
          {userMenuOpen && (
            <div className={cn(
              'absolute right-0 top-full mt-2 w-56 rounded-lg shadow-lg border py-1',
              bgClass,
              borderClass
            )}>
              <div className={cn('px-4 py-2 border-b', borderClass)}>
                <p className={cn('text-sm font-medium', textClass)}>{displayName}</p>
                {userEmail && (
                  <p className={cn('text-xs', textMutedClass)}>{userEmail}</p>
                )}
              </div>
              <a
                href="/settings"
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm transition-colors',
                  textClass,
                  hoverClass
                )}
              >
                <User size={16} />
                Account Settings
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
