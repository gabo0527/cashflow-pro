'use client'

import React, { useState, useMemo } from 'react'
import { 
  Clock, ChevronLeft, ChevronRight, Check, AlertCircle, 
  Building2, FolderOpen, Send, Loader2
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

// Hardcoded for public timesheet page (anon key is safe to expose)
const supabaseUrl = 'https://jmahfgpbtjeomuepfozf.supabase.co'
const supabaseAnonKey = 'sb_publishable_NDkezr5quDBBdngXvb7kBQ_jXw_R2S4'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types
interface Assignment {
  id: string
  project_id: string
  project_name: string
  client_name: string
  service: string | null
  payment_type: string
  rate: number
}

interface TeamMember {
  id: string
  name: string
  email: string
  company_id: string
}

interface EntryData {
  project_id: string
  hours: string
  notes: string
}

const getWeekDates = (date: Date): { start: Date; end: Date; days: Date[] } => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(monday)
    dayDate.setDate(monday.getDate() + i)
    days.push(dayDate)
  }
  
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  
  return { start: monday, end: sunday, days }
}

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const formatDateISO = (date: Date): string => {
  return date.toISOString().split('T')[0]
}

const formatWeekLabel = (start: Date, end: Date): string => {
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' })
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' })
  const year = end.getFullYear()
  
  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()} - ${end.getDate()}, ${year}`
  }
  return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}, ${year}`
}

export default function TimesheetPage() {
  // State
  const [step, setStep] = useState<'email' | 'entry' | 'success'>('email')
  const [email, setEmail] = useState('')
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [entries, setEntries] = useState<Record<string, EntryData>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Week info
  const weekInfo = useMemo(() => getWeekDates(currentWeek), [currentWeek])

  // Group assignments by client
  const assignmentsByClient = useMemo(() => {
    const grouped: Record<string, Assignment[]> = {}
    assignments.forEach(a => {
      const client = a.client_name || 'Other'
      if (!grouped[client]) grouped[client] = []
      grouped[client].push(a)
    })
    return grouped
  }, [assignments])

  // Lookup team member by email
  const lookupEmail = async () => {
    if (!email.trim()) {
      setError('Please enter your email')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Find team member by email
      const { data: memberData, error: memberError } = await supabase
        .from('team_members')
        .select('id, name, email, company_id')
        .eq('email', email.toLowerCase().trim())
        .eq('status', 'active')
        .single()

      if (memberError || !memberData) {
        setError('Email not found. Please contact your administrator.')
        setLoading(false)
        return
      }

      // Get their project assignments
      const { data: assignData, error: assignError } = await supabase
        .from('team_project_assignments')
        .select(`
          id,
          project_id,
          service,
          payment_type,
          rate,
          projects (id, name, client, status)
        `)
        .eq('team_member_id', memberData.id)

      if (assignError) {
        setError('Error loading your projects. Please try again.')
        setLoading(false)
        return
      }

      // Filter to active projects only
      const activeAssignments = (assignData || [])
        .filter((a: any) => a.projects?.status === 'active' || !a.projects?.status)
        .map((a: any) => ({
          id: a.id,
          project_id: a.project_id,
          project_name: a.projects?.name || 'Unknown Project',
          client_name: a.projects?.client || '',
          service: a.service,
          payment_type: a.payment_type,
          rate: a.rate,
        }))

      if (activeAssignments.length === 0) {
        setError('No active project assignments found. Please contact your administrator.')
        setLoading(false)
        return
      }

      setTeamMember(memberData)
      setAssignments(activeAssignments)
      
      // Initialize entries
      const initialEntries: Record<string, EntryData> = {}
      activeAssignments.forEach((a: Assignment) => {
        initialEntries[a.project_id] = { project_id: a.project_id, hours: '', notes: '' }
      })
      setEntries(initialEntries)
      
      setStep('entry')
    } catch (err) {
      console.error('Lookup error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Navigate weeks
  const navigateWeek = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentWeek)
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
    setCurrentWeek(newDate)
  }

  // Update entry
  const updateEntry = (projectId: string, field: 'hours' | 'notes', value: string) => {
    setEntries(prev => ({
      ...prev,
      [projectId]: { ...prev[projectId], [field]: value }
    }))
  }

  // Calculate total hours
  const totalHours = useMemo(() => {
    return Object.values(entries).reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0)
  }, [entries])

  // Submit timesheet
  const submitTimesheet = async () => {
    if (!teamMember) return

    // Filter entries with hours
    const validEntries = Object.values(entries).filter(e => parseFloat(e.hours) > 0)

    if (validEntries.length === 0) {
      setError('Please enter hours for at least one project')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      // Get the Friday of the selected week as the entry date (end of work week)
      const entryDate = formatDateISO(weekInfo.days[4]) // Friday

      // Prepare entries for insert
      const timeEntries = validEntries.map(entry => {
        const assignment = assignments.find(a => a.project_id === entry.project_id)
        return {
          company_id: teamMember.company_id,
          team_member_id: teamMember.id,
          project_id: entry.project_id,
          date: entryDate,
          hours: parseFloat(entry.hours),
          bill_rate: assignment?.rate || 0,
          notes: entry.notes || null,
        }
      })

      const { error: insertError } = await supabase
        .from('time_entries')
        .insert(timeEntries)

      if (insertError) {
        console.error('Insert error:', insertError)
        setError('Error submitting timesheet. Please try again.')
        setSubmitting(false)
        return
      }

      setStep('success')
    } catch (err) {
      console.error('Submit error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Reset form
  const resetForm = () => {
    setStep('email')
    setEmail('')
    setTeamMember(null)
    setAssignments([])
    setEntries({})
    setError(null)
  }

  // Start new entry
  const startNewEntry = () => {
    // Keep same user, reset entries
    const initialEntries: Record<string, EntryData> = {}
    assignments.forEach((a: Assignment) => {
      initialEntries[a.project_id] = { project_id: a.project_id, hours: '', notes: '' }
    })
    setEntries(initialEntries)
    setStep('entry')
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-500/20 mb-4">
            <Clock size={32} className="text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Timesheet Entry</h1>
          <p className="text-slate-400 mt-1">Enter your weekly hours</p>
        </div>

        {/* Email Step */}
        {step === 'email' && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Enter your email to get started
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && lookupEmail()}
                  placeholder="yourname@company.com"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-lg"
                  autoFocus
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  <AlertCircle size={18} className="text-rose-500" />
                  <p className="text-sm text-rose-400">{error}</p>
                </div>
              )}

              <button
                onClick={lookupEmail}
                disabled={loading}
                className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-xl text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Looking up...
                  </>
                ) : (
                  'Continue'
                )}
              </button>
            </div>
          </div>
        )}

        {/* Entry Step */}
        {step === 'entry' && teamMember && (
          <div className="space-y-4">
            {/* User Info */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-slate-100 font-medium">{teamMember.name}</p>
                <p className="text-slate-400 text-sm">{teamMember.email}</p>
              </div>
              <button
                onClick={resetForm}
                className="text-sm text-slate-400 hover:text-slate-300"
              >
                Not you?
              </button>
            </div>

            {/* Week Selector */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => navigateWeek('prev')}
                  className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <div className="text-center">
                  <p className="text-slate-100 font-medium">
                    {formatWeekLabel(weekInfo.start, weekInfo.end)}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">Week of entry</p>
                </div>
                <button
                  onClick={() => navigateWeek('next')}
                  className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            {/* Project Entries */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h2 className="text-slate-100 font-medium">Enter Hours by Project</h2>
                <p className="text-slate-400 text-sm mt-0.5">
                  Enter total hours for the week
                </p>
              </div>

              <div className="divide-y divide-slate-700">
                {Object.entries(assignmentsByClient).map(([client, clientAssignments]) => (
                  <div key={client}>
                    {/* Client Header */}
                    <div className="px-4 py-2 bg-slate-900/50 flex items-center gap-2">
                      <Building2 size={14} className="text-slate-500" />
                      <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                        {client}
                      </span>
                    </div>

                    {/* Projects */}
                    {clientAssignments.map(assignment => (
                      <div key={assignment.id} className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <FolderOpen size={16} className="text-slate-500" />
                            <div>
                              <p className="text-slate-100 font-medium">
                                {assignment.project_name}
                              </p>
                              {assignment.service && (
                                <span className="text-xs text-slate-400">
                                  {assignment.service}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Hours</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={entries[assignment.project_id]?.hours || ''}
                              onChange={(e) => updateEntry(assignment.project_id, 'hours', e.target.value)}
                              placeholder="0"
                              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-center focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-xs text-slate-400 mb-1">Notes (optional)</label>
                            <input
                              type="text"
                              value={entries[assignment.project_id]?.notes || ''}
                              onChange={(e) => updateEntry(assignment.project_id, 'notes', e.target.value)}
                              placeholder="Brief description..."
                              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="p-4 bg-slate-900/50 border-t border-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Total Hours</span>
                  <span className="text-2xl font-bold text-blue-500">{totalHours.toFixed(1)}</span>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <AlertCircle size={18} className="text-rose-500" />
                <p className="text-sm text-rose-400">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={submitTimesheet}
              disabled={submitting || totalHours === 0}
              className="w-full py-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-medium transition-colors flex items-center justify-center gap-2 text-lg"
            >
              {submitting ? (
                <>
                  <Loader2 size={22} className="animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send size={22} />
                  Submit Timesheet
                </>
              )}
            </button>
          </div>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-4">
              <Check size={32} className="text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-100 mb-2">Timesheet Submitted!</h2>
            <p className="text-slate-400 mb-6">
              Your {totalHours.toFixed(1)} hours have been recorded for the week of {formatWeekLabel(weekInfo.start, weekInfo.end)}.
            </p>
            <div className="flex gap-3">
              <button
                onClick={startNewEntry}
                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-white font-medium transition-colors"
              >
                Enter Another Week
              </button>
              <button
                onClick={resetForm}
                className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 rounded-xl text-white font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-slate-500 text-xs mt-6">
          Powered by Vantage
        </p>
      </div>
    </div>
  )
}
