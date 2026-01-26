'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Construction } from 'lucide-react'

interface PlaceholderPageProps {
  title: string
  description: string
  theme?: 'light' | 'dark'
}

export default function PlaceholderPage({ title, description, theme = 'dark' }: PlaceholderPageProps) {
  const isDark = theme === 'dark'
  const textClass = isDark ? 'text-slate-100' : 'text-slate-800'
  const textMutedClass = isDark ? 'text-slate-400' : 'text-slate-500'
  const bgClass = isDark ? 'bg-slate-800' : 'bg-white'
  const borderClass = isDark ? 'border-slate-700' : 'border-slate-200'

  return (
    <div className="space-y-6">
      <div>
        <h1 className={cn('text-2xl font-semibold', textClass)}>{title}</h1>
        <p className={cn('text-sm mt-1', textMutedClass)}>{description}</p>
      </div>
      
      <div className={cn('p-12 rounded-xl border text-center', bgClass, borderClass)}>
        <Construction size={48} className={cn('mx-auto mb-4', textMutedClass)} />
        <h2 className={cn('text-lg font-semibold mb-2', textClass)}>Coming Soon</h2>
        <p className={cn('text-sm', textMutedClass)}>
          This section is being built. Check back soon!
        </p>
      </div>
    </div>
  )
}
