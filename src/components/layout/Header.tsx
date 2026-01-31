'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Sun, Moon, User, ChevronDown, Bell, Search, MessageSquare, Settings, LogOut } from 'lucide-react'
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
        'fixed top-0 right-0 h-14 z-30 flex items-center justify-between px-4 bg-white border-b border-gray-200 transition-all duration-300',
        sidebarCollapsed ? 'left-16' : 'left-56'
      )}
    >
      {/* Search */}
      <div className="flex items-center flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-9 pr-4 py-1.5 rounded-lg text-sm bg-gray-50 border border-gray-200 text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 transition-all"
          />
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1">
        {/* AI Chat */}
        <button
          onClick={onOpenChat}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          title="AI Assistant"
        >
          <MessageSquare size={18} strokeWidth={1.75} />
        </button>

        {/* Notifications */}
        <button
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          title="Notifications"
        >
          <Bell size={18} strokeWidth={1.75} />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={onThemeToggle}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 mx-2" />

        {/* User Menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold bg-gray-900 text-white">
              {initials}
            </div>
            <span className="text-sm font-medium text-gray-700 hidden sm:block">
              {displayName}
            </span>
            <ChevronDown size={14} className="text-gray-400" />
          </button>

          {/* Dropdown */}
          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-gray-200 rounded-lg shadow-lg py-1 overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">{displayName}</p>
                {userEmail && <p className="text-xs text-gray-400 truncate">{userEmail}</p>}
              </div>
              <div className="py-1">
                <a
                  href="/settings"
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  <Settings size={15} className="text-gray-400" />
                  Settings
                </a>
                <a
                  href="/settings"
                  className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                >
                  <User size={15} className="text-gray-400" />
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
