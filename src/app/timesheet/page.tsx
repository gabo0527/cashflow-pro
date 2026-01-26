'use client'

import React, { useState, useMemo } from 'react'
import { 
  Clock, ChevronLeft, ChevronRight, Check, AlertCircle, 
  Building2, FolderOpen, Send, Loader2, ChevronDown, ChevronUp
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

// Hardcoded for public timesheet page (anon key is safe to expose)
const supabaseUrl = 'https://jmahfgpbtjeomuepfozf.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptYWhmZ3BidGplb211ZXBmb3pmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0OTAxNzcsImV4cCI6MjA4MTA2NjE3N30.3SVDvWCGIYYHV57BpKjpDJVCZLKzuRv8B_VietQDxUQ'
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

const formatDateRange = (start: Date, end: Date): string => {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const startStr = start.toLocaleDateString('en-US', options)
  const endStr = end.toLocaleDateString('en-US', { ...options, year: 'numeric' })
  return `${startStr} - ${endStr}`
}

export default function TimesheetPage() {
  const [step, setStep] = useState<'email' | 'entry' | 'success'>('email')
  const [email, setEmail] = useState('')
  const [teamMember, setTeamMember] = useState<TeamMember | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [entries, setEntries] = useState<Record<string, EntryData>>({})
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [collapsedClients, setCollapsedClients] = useState<Record<string, boolean>>({})

  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek])

  // Group assignments by client
  const assignmentsByClient = useMemo(() => {
    const grouped: Record<string, Assignment[]> = {}
    assignments.forEach(a => {
      const client = a.client_name || 'Other'
      if (!grouped[client]) grouped[client] = []
      grouped[client].push(a)
    })
    // Sort clients alphabetically, but put "Other" at the end
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      if (a === 'Other') return 1
      if (b === 'Other') return -1
      return a.localeCompare(b)
    })
    const sorted: Record<string, Assignment[]> = {}
    sortedKeys.forEach(key => {
      sorted[key] = grouped[key]
    })
    return sorted
  }, [assignments])

  const totalHours = useMemo(() => {
    return Object.values(entries).reduce((sum, e) => sum + (parseFloat(e.hours) || 0), 0)
  }, [entries])

  // Toggle client collapse
  const toggleClient = (client: string) => {
    setCollapsedClients(prev => ({
      ...prev,
      [client]: !prev[client]
    }))
  }

  // Calculate hours per client
  const getClientHours = (client: string) => {
    const clientAssignments = assignmentsByClient[client] || []
    return clientAssignments.reduce((sum, a) => {
      const entry = entries[a.project_id]
      return sum + (parseFloat(entry?.hours) || 0)
    }, 0)
  }

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
      console.log('Looking up email:', email.toLowerCase().trim())
      const { data: memberData, error: memberError } = await supabase
        .from('team_members')
        .select('id, name, email, company_id')
        .eq('email', email.toLowerCase().trim())
        .eq('status', 'active')
        .single()

      console.log('Member lookup result:', memberData, memberError)

      if (memberError || !memberData) {
        setError('Email not found. Please contact your administrator.')
        setLoading(false)
        return
      }

      // Get their project assignments (no join)
      const { data: assignData, error: assignError } = await supabase
        .from('team_project_assignments')
        .select('id, project_id, service, payment_type, rate')
        .eq('team_member_id', memberData.id)

      console.log('Assignments:', assignData, assignError)

      if (assignError) {
        console.error('Assignment error:', assignError)
        setError('Error loading your projects. Please try again.')
        setLoading(false)
        return
      }

      // Fetch project details separately
      const projectIds = (assignData || []).map((a: any) => a.project_id)
      console.log('Project IDs to fetch:', projectIds)
      
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, client, status')
        .in('id', projectIds)

      console.log('Projects fetched:', projectsData, 'Error:', projectsError)

      // Filter to active projects only and combine data
      const activeAssignments = (assignData || [])
        .map((a: any) => {
          const project = (projectsData || []).find((p: any) => p.id === a.project_id)
          console.log('Matching project for', a.project_id, ':', project)
          return {
            ...a,
            projects: project
          }
        })
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

      console.log('Final assignments:', activeAssignments)

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
  const prevWeek = () => {
    const newDate = new Date(currentWeek)
    newDate.setDate(newDate.getDate() - 7)
    setCurrentWeek(newDate)
  }

  const nextWeek = () => {
    const newDate = new Date(currentWeek)
    newDate.setDate(newDate.getDate() + 7)
    setCurrentWeek(newDate)
  }

  // Update entry
  const updateEntry = (projectId: string, field: 'hours' | 'notes', value: string) => {
    setEntries(prev => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        [field]: value
      }
    }))
  }

  // Submit timesheet
  const submitTimesheet = async () => {
    // Filter entries with hours > 0
    const validEntries = Object.values(entries).filter(e => parseFloat(e.hours) > 0)
    
    if (validEntries.length === 0) {
      setError('Please enter hours for at least one project.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      // Get Friday of the selected week as entry date
      const friday = new Date(weekDates.start)
      friday.setDate(friday.getDate() + 4)
      const entryDate = friday.toISOString().split('T')[0]

      // Prepare entries for insert
      const insertData = validEntries.map(entry => {
        const assignment = assignments.find(a => a.project_id === entry.project_id)
        return {
          company_id: teamMember?.company_id,
          team_member_id: teamMember?.id,
          project_id: entry.project_id,
          date: entryDate,
          hours: parseFloat(entry.hours),
          bill_rate: assignment?.rate || 0,
          notes: entry.notes || null,
        }
      })

      const { error: insertError } = await supabase
        .from('time_entries')
        .insert(insertData)

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
    setCollapsedClients({})
  }

  // Enter another week
  const enterAnotherWeek = () => {
    setStep('entry')
    const initialEntries: Record<string, EntryData> = {}
    assignments.forEach((a: Assignment) => {
      initialEntries[a.project_id] = { project_id: a.project_id, hours: '', notes: '' }
    })
    setEntries(initialEntries)
    setError(null)
    setCollapsedClients({})
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 mb-4">
            <Clock className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold">Timesheet Entry</h1>
          <p className="text-slate-400 mt-1">Enter your weekly hours</p>
        </div>

        {/* Email Step */}
        {step === 'email' && (
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <label className="block text-sm text-slate-400 mb-2">
              Enter your email to get started
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && lookupEmail()}
              placeholder="yourname@company.com"
              className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <button
              onClick={lookupEmail}
              disabled={loading}
              className="w-full mt-4 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Looking up...
                </>
              ) : (
                'Continue'
              )}
            </button>
          </div>
        )}

        {/* Entry Step */}
        {step === 'entry' && teamMember && (
          <>
            {/* User Info */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 mb-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{teamMember.name}</p>
                <p className="text-sm text-slate-400">{teamMember.email}</p>
              </div>
              <button
                onClick={resetForm}
                className="text-sm text-slate-400 hover:text-white transition-colors"
              >
                Not you?
              </button>
            </div>

            {/* Week Selector */}
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 mb-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={prevWeek}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <p className="font-medium">{formatDateRange(weekDates.start, weekDates.end)}</p>
                  <p className="text-sm text-slate-400">Week of entry</p>
                </div>
                <button
                  onClick={nextWeek}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Hours Entry - Grouped by Client */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 mb-4 overflow-hidden">
              <div className="p-4 border-b border-slate-700">
                <h2 className="font-semibold">Enter Hours by Project</h2>
                <p className="text-sm text-slate-400">Enter total hours for the week</p>
              </div>

              <div className="divide-y divide-slate-700">
                {Object.entries(assignmentsByClient).map(([client, clientAssignments]) => {
                  const isCollapsed = collapsedClients[client]
                  const clientHours = getClientHours(client)
                  
                  return (
                    <div key={client}>
                      {/* Client Header */}
                      <button
                        onClick={() => toggleClient(client)}
                        className="w-full px-4 py-3 flex items-center justify-between bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-slate-400" />
                          <span className="font-medium">{client}</span>
                          <span className="text-xs text-slate-500">
                            ({clientAssignments.length} project{clientAssignments.length !== 1 ? 's' : ''})
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {clientHours > 0 && (
                            <span className="text-sm text-blue-400 font-medium">
                              {clientHours.toFixed(1)} hrs
                            </span>
                          )}
                          {isCollapsed ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronUp className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </button>

                      {/* Projects under this client */}
                      {!isCollapsed && (
                        <div className="divide-y divide-slate-700/50">
                          {clientAssignments.map((assignment) => (
                            <div key={assignment.id} className="p-4 bg-slate-800/30">
                              <div className="flex items-start gap-3 mb-3">
                                <FolderOpen className="w-4 h-4 text-slate-500 mt-1" />
                                <div className="flex-1">
                                  <p className="font-medium text-slate-200">{assignment.project_name}</p>
                                  {assignment.service && (
                                    <p className="text-xs text-slate-500">{assignment.service}</p>
                                  )}
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3 ml-7">
                                <div>
                                  <label className="block text-xs text-slate-500 mb-1">Hours</label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    value={entries[assignment.project_id]?.hours || ''}
                                    onChange={(e) => updateEntry(assignment.project_id, 'hours', e.target.value)}
                                    placeholder="0"
                                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-500 mb-1">Notes (optional)</label>
                                  <input
                                    type="text"
                                    value={entries[assignment.project_id]?.notes || ''}
                                    onChange={(e) => updateEntry(assignment.project_id, 'notes', e.target.value)}
                                    placeholder="Brief description..."
                                    className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Total */}
              <div className="p-4 border-t border-slate-700 flex items-center justify-between bg-slate-700/20">
                <span className="font-medium">Total Hours</span>
                <span className={`text-xl font-bold ${totalHours > 0 ? 'text-blue-400' : 'text-slate-500'}`}>
                  {totalHours.toFixed(1)}
                </span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={submitTimesheet}
              disabled={submitting || totalHours === 0}
              className="w-full px-4 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit Timesheet
                </>
              )}
            </button>
          </>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-4">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold mb-2">Timesheet Submitted!</h2>
            <p className="text-slate-400 mb-6">
              Your hours for {formatDateRange(weekDates.start, weekDates.end)} have been recorded.
            </p>
            <div className="flex gap-3">
              <button
                onClick={enterAnotherWeek}
                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
              >
                Enter Another Week
              </button>
              <button
                onClick={resetForm}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          Powered by Vantage
        </p>
      </div>
    </div>
  )
}
