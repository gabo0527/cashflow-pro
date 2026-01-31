'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Sun, Moon, User, ChevronDown, Bell, Search, MessageSquare, Settings } from 'lucide-react'
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
  
  // Option B Theme styles
  const styles = {
    bg: isDark ? 'bg-slate-900' : 'bg-white',
    border: isDark ? 'border-slate-700' : 'border-slate-200',
    text: isDark ? 'text-slate-100' : 'text-slate-700',
    textMuted: isDark ? 'text-slate-400' : 'text-slate-400',
    hover: isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50',
    inputBg: isDark ? 'bg-slate-800' : 'bg-slate-50',
    inputBorder: isDark ? 'border-slate-700' : 'border-slate-200',
    inputFocus: 'focus:ring-2 focus:ring-slate-300 focus:border-slate-300',
  }

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
        styles.bg,
        styles.border,
        sidebarCollapsed ? 'left-16' : 'left-60'
      )}
    >
      {/* Left section - Search */}
      <div className="flex items-center gap-4 flex-1">
        <div className="relative max-w-md flex-1">
          <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4', styles.textMuted)} />
          <input
            type="text"
            placeholder="Search..."
            className={cn(
              'w-full pl-10 pr-4 py-2 rounded-lg text-sm outline-none transition-all border',
              styles.inputBg,
              styles.inputBorder,
              styles.text,
              styles.inputFocus,
              'placeholder:text-slate-400'
            )}
          />
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1">
        {/* AI Chat Quick Access */}
        <button
          onClick={onOpenChat}
          className={cn(
            'p-2.5 rounded-lg transition-colors',
            styles.hover,
            styles.textMuted,
            'hover:text-slate-700'
          )}
          title="Open AI Assistant"
        >
          <MessageSquare size={20} />
        </button>

        {/* Notifications */}
        <button
          className={cn(
            'p-2.5 rounded-lg transition-colors relative',
            styles.hover,
            styles.textMuted,
            'hover:text-slate-700'
          )}
          title="Notifications"
        >
          <Bell size={20} />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onThemeToggle}
          className={cn(
            'p-2.5 rounded-lg transition-colors',
            styles.hover,
            styles.textMuted,
            'hover:text-slate-700'
          )}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Divider */}
        <div className={cn('w-px h-8 mx-2', isDark ? 'bg-slate-700' : 'bg-slate-200')} />

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={cn(
              'flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg transition-colors',
              styles.hover
            )}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium bg-slate-800 text-white">
              {initials}
            </div>
            <span className={cn('text-sm font-medium hidden sm:block', styles.text)}>
              {displayName}
            </span>
            <ChevronDown size={16} className={styles.textMuted} />
          </button>

          {/* Dropdown Menu */}
          {userMenuOpen && (
            <div className={cn(
              'absolute right-0 top-full mt-2 w-56 rounded-xl shadow-lg border py-1 overflow-hidden',
              styles.bg,
              styles.border
            )}>
              <div className={cn('px-4 py-3 border-b', styles.border)}>
                <p className={cn('text-sm font-semibold', styles.text)}>{displayName}</p>
                {userEmail && (
                  <p className={cn('text-xs mt-0.5', styles.textMuted)}>{userEmail}</p>
                )}
              </div>
              <div className="py-1">
                <a
                  href="/settings"
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                    styles.text,
                    styles.hover
                  )}
                >
                  <Settings size={16} className={styles.textMuted} />
                  Account Settings
                </a>
                <a
                  href="/settings"
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                    styles.text,
                    styles.hover
                  )}
                >
                  <User size={16} className={styles.textMuted} />
                  Profile
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
