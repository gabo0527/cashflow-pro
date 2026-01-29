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

// Vantage Logo - Teal bars matching dashboard
const VantageLogo = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="20" width="8" height="16" rx="2" fill="#2dd4bf" fillOpacity="0.5"/>
    <rect x="16" y="12" width="8" height="24" rx="2" fill="#2dd4bf" fillOpacity="0.75"/>
    <rect x="28" y="4" width="8" height="32" rx="2" fill="#2dd4bf"/>
  </svg>
)

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
  const start = new Date(d.setDate(diff))
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  
  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(start)
    day.setDate(start.getDate() + i)
    days.push(day)
  }
  
  return { start, end, days }
}

const formatDateRange = (start: Date, end: Date): string => {
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`
}

export default function TimesheetPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [member, setMember] = useState<TeamMember | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [entries, setEntries] = useState<Record<string, EntryData>>({})
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [collapsedClients, setCollapsedClients] = useState<Set<string>>(new Set())

  const weekDates = useMemo(() => getWeekDates(currentWeek), [currentWeek])

  const groupedAssignments = useMemo(() => {
    const grouped: Record<string, Assignment[]> = {}
    assignments.forEach(a => {
      const client = a.client_name || 'Other'
      if (!grouped[client]) grouped[client] = []
      grouped[client].push(a)
    })
    return grouped
  }, [assignments])

  const toggleClient = (client: string) => {
    setCollapsedClients(prev => {
      const next = new Set(prev)
      if (next.has(client)) {
        next.delete(client)
      } else {
        next.add(client)
      }
      return next
    })
  }

  const lookupMember = async () => {
    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')
    setAssignments([])

    try {
      // Step 1: Find team member by email
      const { data: memberData, error: memberError } = await supabase
        .from('team_members')
        .select('id, name, email, company_id')
        .eq('email', email.trim().toLowerCase())
        .single()

      if (memberError || !memberData) {
        setError('Email not found. Please check your email address.')
        setLoading(false)
        return
      }

      setMember(memberData)

      // Step 2: Get assignments
      const { data: assignData, error: assignError } = await supabase
        .from('team_project_assignments')
        .select('id, project_id, service, payment_type, rate')
        .eq('team_member_id', memberData.id)

      if (assignError) {
        setError('Error loading your projects. Please try again.')
        setLoading(false)
        return
      }

      if (!assignData || assignData.length === 0) {
        setError('No projects assigned to you. Contact your administrator.')
        setLoading(false)
        return
      }

      // Step 3: Get project IDs
      const projectIds = assignData.map((a: any) => a.project_id).filter(Boolean)

      // Step 4: Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, client_id, status')
        .in('id', projectIds)

      if (projectsError) {
        setError('Error loading projects. Please try again.')
        setLoading(false)
        return
      }

      // Step 5: Get client names
      const clientIds = Array.from(new Set((projectsData || []).map((p: any) => p.client_id).filter(Boolean)))
      let clientsMap: Record<string, string> = {}
      
      if (clientIds.length > 0) {
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, name')
          .in('id', clientIds)

        if (clientsData) {
          clientsData.forEach((c: any) => {
            clientsMap[c.id] = c.name
          })
        }
      }

      // Step 6: Combine data
      const combinedAssignments: Assignment[] = assignData.map((a: any) => {
        const project = (projectsData || []).find((p: any) => p?.id === a.project_id)
        const clientName = project?.client_id ? clientsMap[project.client_id] : 'Other'
        return {
          id: a.id,
          project_id: a.project_id,
          project_name: project?.name || 'Unknown Project',
          client_name: clientName || 'Other',
          service: a.service,
          payment_type: a.payment_type,
          rate: a.rate || 0
        }
      })

      setAssignments(combinedAssignments)

    } catch (err) {
      console.error('Error:', err)
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const updateEntry = (projectId: string, field: 'hours' | 'notes', value: string) => {
    setEntries(prev => ({
      ...prev,
      [projectId]: {
        ...prev[projectId],
        project_id: projectId,
        [field]: value
      }
    }))
  }

  const totalHours = useMemo(() => {
    return Object.values(entries).reduce((sum, e) => {
      const hours = parseFloat(e.hours) || 0
      return sum + hours
    }, 0)
  }, [entries])

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(prev => {
      const newDate = new Date(prev)
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7))
      return newDate
    })
  }

  const handleSubmit = async () => {
    if (!member || totalHours === 0) return

    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const entriesToInsert = Object.values(entries)
        .filter(e => parseFloat(e.hours) > 0)
        .map(e => ({
          company_id: member.company_id,
          team_member_id: member.id,
          project_id: e.project_id,
          week_start: weekDates.start.toISOString().split('T')[0],
          hours: parseFloat(e.hours),
          notes: e.notes || null,
          status: 'submitted'
        }))

      const { error } = await supabase
        .from('timesheet_entries')
        .insert(entriesToInsert)

      if (error) throw error

      setSuccess(`Successfully submitted ${totalHours} hours for the week!`)
      setEntries({})

    } catch (err) {
      console.error('Submit error:', err)
      setError('Failed to submit timesheet. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-3">
            <VantageLogo size={32} />
            <span className="text-xl font-bold text-slate-100">Vantage</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Page Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 mb-4">
            <Clock className="h-7 w-7 text-teal-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Time Entry</h1>
          <p className="text-slate-500">Submit your weekly hours</p>
        </div>

        {!member ? (
          /* Email Lookup */
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center">
                <span className="text-slate-500 text-lg">?</span>
              </div>
              <div className="flex-1">
                <input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && lookupMember()}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 text-slate-100 placeholder-slate-500 outline-none transition-all"
                />
              </div>
            </div>
            <button
              onClick={lookupMember}
              disabled={loading}
              className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-slate-900 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Looking up...
                </>
              ) : (
                'Continue'
              )}
            </button>
            <p className="text-center text-sm text-slate-500 mt-4">
              Not you? Contact your administrator for access.
            </p>
          </div>
        ) : (
          <>
            {/* Member Info */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-500/20 rounded-full flex items-center justify-center">
                  <span className="text-teal-400 font-semibold text-sm">
                    {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-100">{member.name}</p>
                  <p className="text-sm text-slate-500">{member.email}</p>
                </div>
                <button
                  onClick={() => { setMember(null); setAssignments([]); setEmail('') }}
                  className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Not you?
                </button>
              </div>
            </div>

            {/* Week Navigator */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => navigateWeek('prev')}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <ChevronLeft className="h-5 w-5 text-slate-400" />
                </button>
                <div className="text-center">
                  <p className="font-semibold text-slate-100">
                    {formatDateRange(weekDates.start, weekDates.end)}
                  </p>
                  <p className="text-sm text-slate-500">Week of entry</p>
                </div>
                <button
                  onClick={() => navigateWeek('next')}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Projects by Client */}
            <div className="space-y-4 mb-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-100">Enter Hours by Project</h2>
                <p className="text-sm text-slate-500">Total hours for the week</p>
              </div>

              {Object.entries(groupedAssignments).map(([client, clientAssignments]) => (
                <div key={client} className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                  {/* Client Header */}
                  <button
                    onClick={() => toggleClient(client)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-slate-500" />
                      <span className="font-medium text-slate-100">{client}</span>
                      <span className="text-sm text-slate-500">({clientAssignments.length} projects)</span>
                    </div>
                    {collapsedClients.has(client) ? (
                      <ChevronDown className="h-5 w-5 text-slate-500" />
                    ) : (
                      <ChevronUp className="h-5 w-5 text-slate-500" />
                    )}
                  </button>

                  {/* Projects */}
                  {!collapsedClients.has(client) && (
                    <div className="divide-y divide-slate-700/50">
                      {clientAssignments.map(assignment => (
                        <div key={assignment.id} className="p-4">
                          <div className="flex items-start gap-3">
                            <FolderOpen className="h-5 w-5 text-teal-400 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-medium text-slate-100">{assignment.project_name}</p>
                              <p className="text-sm text-slate-500">{assignment.service || 'General'}</p>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Hours</label>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                placeholder="0"
                                value={entries[assignment.project_id]?.hours || ''}
                                onChange={(e) => updateEntry(assignment.project_id, 'hours', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 text-slate-100 outline-none transition-all"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Notes (optional)</label>
                              <input
                                type="text"
                                placeholder="Brief description..."
                                value={entries[assignment.project_id]?.notes || ''}
                                onChange={(e) => updateEntry(assignment.project_id, 'notes', e.target.value)}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 text-slate-100 placeholder-slate-600 outline-none transition-all"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Total & Submit */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="font-medium text-slate-100">Total Hours</span>
                <span className="text-2xl font-bold text-teal-400">{totalHours.toFixed(1)}</span>
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting || totalHours === 0}
                className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-slate-900 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Submit Timesheet
                  </>
                )}
              </button>
            </div>
          </>
        )}

        {/* Messages */}
        {error && (
          <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center gap-2 text-rose-400">
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-400">
            <Check className="h-5 w-5 flex-shrink-0" />
            {success}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-sm text-slate-600 mt-8">
          Powered by <span className="text-slate-500">Vantage</span>
        </p>
      </div>
    </div>
  )
}
