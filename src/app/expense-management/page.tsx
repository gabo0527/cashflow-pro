'use client'

import React, { useState, useEffect } from 'react'
import ExpenseManagement from '@/components/ExpenseManagement'
import { getCurrentUser } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jmahfgpbtjeomuepfozf.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYWhmZ3BidGplb211ZXBmb3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0OTAxNzcsImV4cCI6MjA4MTA2NjE3N30.3SVDvWCGIYYHV57BpKjpDJVCZLKzuRv8B_VietQDxUQ'
)

export default function ExpenseManagementPage() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const { user } = await getCurrentUser()
        if (!user) return
        setCurrentUserId(user.id)

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single()

        if (profile?.company_id) {
          setCompanyId(profile.company_id)
        }
      } catch (error) {
        console.error('Error loading expense management:', error)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!companyId || !currentUserId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">Unable to load company data.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ExpenseManagement
        supabase={supabase}
        companyId={companyId}
        currentUserId={currentUserId}
      />
    </div>
  )
}
