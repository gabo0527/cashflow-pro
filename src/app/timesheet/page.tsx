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
      console.log('Looking up email:', email.trim().toLowerCase())
      
      // Step 1: Find team member by email
      const { data: memberData, error: memberError } = await supabase
        .from('team_members')
        .select('id, name, email, company_id')
        .eq('email', email.trim().toLowerCase())
        .single()

      console.log('Member lookup result:', memberData, memberError)

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

      console.log('Assignments:', assignData, assignError)

      if (assignError) {
        console.error('Assignment error:', assignError)
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
      console.log('Project IDs to fetch:', projectIds)

      // Step 4: Fetch projects (using correct columns: id, name, client_id, status)
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, client_id, status')
        .in('id', projectIds)

      console.log('Projects fetch result:', projectsData, projectsError)

      if (projectsError) {
        console.error('Projects error:', projectsError)
        setError('Error loading projects. Please try again.')
        setLoading(false)
        return
      }

      // Step 5: Get client IDs and fetch client names
      const clientIds = [...new Set((projectsData || []).map((p: any) => p.client_id).filter(Boolean))]
      console.log('Client IDs to fetch:', clientIds)

      let clientsMap: Record<string, string> = {}
      if (clientIds.length > 0) {
        const { data: clientsData, error: clientsError } = await supabase
          .from('clients')
          .select('id, name')
          .in('id', clientIds)

        console.log('Clients fetch result:', clientsData, clientsError)

        if (clientsData) {
          clientsData.forEach((c: any) => {
            clientsMap[c.id] = c.name
          })
        }
      }

      // Step 6: Combine assignments with project and client data
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
      }).filter((a: Assignment) => {
        // Only include active projects or if status is unknown
        const project = (projectsData || []).find((p: any) => p?.id === a.project_id)
        return !project?.status || project.status === 'active'
      })

      console.log('Final assignments:', combinedAssignments)
      setAssignments(combinedAssignments)

      // Initialize entries
      const initialEntries: Record<string, EntryData> = {}
      combinedAssignments.forEach(a => {
        initialEntries[a.project_id] = { project_id: a.project_id, hours: '', notes: '' }
      })
      setEntries(initialEntries)

    } catch (err) {
      console.error('Lookup error:', err)
      setError('An error occurred. Please try again.')
    }

    setLoading(false)
  }

  const updateEntry = (projectId: string, field: 'hours' | 'notes', value: string) => {
    setEntries(prev => ({
      ...prev,
      [projectId]: { ...prev[projectId], [field]: value }
    }))
  }

  const totalHours = useMemo(() => {
    return Object.values(entries).reduce((sum, e) => {
      const h = parseFloat(e.hours) || 0
      return sum + h
    }, 0)
  }, [entries])

  const handleSubmit = async () => {
    if (!member) return

    const entriesToSubmit = Object.entries(entries)
      .filter(([_, e]) => parseFloat(e.hours) > 0)
      .map(([projectId, e]) => ({
        company_id: member.company_id,
        team_member_id: member.id,
        project_id: projectId,
        date: weekDates.start.toISOString().split('T')[0],
        hours: parseFloat(e.hours),
        notes: e.notes || null,
        bill_rate: assignments.find(a => a.project_id === projectId)?.rate || 0
      }))

    if (entriesToSubmit.length === 0) {
      setError('Please enter hours for at least one project')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const { error: insertError } = await supabase
        .from('time_entries')
        .insert(entriesToSubmit)

      if (insertError) {
        console.error('Submit error:', insertError)
        setError('Error submitting timesheet. Please try again.')
      } else {
        setSuccess(`Timesheet submitted successfully! Total: ${totalHours} hours`)
        // Reset entries
        const resetEntries: Record<string, EntryData> = {}
        assignments.forEach(a => {
          resetEntries[a.project_id] = { project_id: a.project_id, hours: '', notes: '' }
        })
        setEntries(resetEntries)
      }
    } catch (err) {
      console.error('Submit error:', err)
      setError('An error occurred. Please try again.')
    }

    setSubmitting(false)
  }

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeek(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() + (direction === 'next' ? 7 : -7))
      return d
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="h-8 w-8 text-orange-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Timesheet Entry</h1>
          <p className="text-gray-600 mt-1">Enter your weekly hours</p>
        </div>

        {/* Email Lookup */}
        {!member ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-500 text-lg">?</span>
              </div>
              <div className="flex-1">
                <input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && lookupMember()}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 placeholder-gray-400"
                />
              </div>
            </div>
            <button
              onClick={lookupMember}
              disabled={loading}
              className="w-full py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
            <p className="text-center text-sm text-gray-500 mt-4">
              Not you? Contact your administrator for access.
            </p>
          </div>
        ) : (
          <>
            {/* Member Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="text-orange-600 font-semibold">
                    {member.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{member.name}</p>
                  <p className="text-sm text-gray-500">{member.email}</p>
                </div>
                <button
                  onClick={() => { setMember(null); setAssignments([]); setEmail('') }}
                  className="ml-auto text-sm text-gray-500 hover:text-gray-700"
                >
                  Not you?
                </button>
              </div>
            </div>

            {/* Week Navigator */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
              <div className="flex items-center justify-between">
                <button
                  onClick={() => navigateWeek('prev')}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
                <div className="text-center">
                  <p className="font-semibold text-gray-900">
                    {formatDateRange(weekDates.start, weekDates.end)}
                  </p>
                  <p className="text-sm text-gray-500">Week of entry</p>
                </div>
                <button
                  onClick={() => navigateWeek('next')}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Projects by Client */}
            <div className="space-y-4 mb-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Enter Hours by Project</h2>
                <p className="text-sm text-gray-500">Enter total hours for the week</p>
              </div>

              {Object.entries(groupedAssignments).map(([client, clientAssignments]) => (
                <div key={client} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {/* Client Header */}
                  <button
                    onClick={() => toggleClient(client)}
                    className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-500" />
                      <span className="font-medium text-gray-900">{client}</span>
                      <span className="text-sm text-gray-500">({clientAssignments.length} projects)</span>
                    </div>
                    {collapsedClients.has(client) ? (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronUp className="h-5 w-5 text-gray-500" />
                    )}
                  </button>

                  {/* Projects */}
                  {!collapsedClients.has(client) && (
                    <div className="divide-y divide-gray-100">
                      {clientAssignments.map(assignment => (
                        <div key={assignment.id} className="p-4">
                          <div className="flex items-start gap-3">
                            <FolderOpen className="h-5 w-5 text-orange-500 mt-0.5" />
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{assignment.project_name}</p>
                              <p className="text-sm text-gray-500">{assignment.service || 'General'}</p>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Hours</label>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                placeholder="0"
                                value={entries[assignment.project_id]?.hours || ''}
                                onChange={(e) => updateEntry(assignment.project_id, 'hours', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Notes (optional)</label>
                              <input
                                type="text"
                                placeholder="Brief description..."
                                value={entries[assignment.project_id]?.notes || ''}
                                onChange={(e) => updateEntry(assignment.project_id, 'notes', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 placeholder-gray-400"
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
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="font-medium text-gray-900">Total Hours</span>
                <span className="text-2xl font-bold text-orange-600">{totalHours.toFixed(1)}</span>
              </div>
              <button
                onClick={handleSubmit}
                disabled={submitting || totalHours === 0}
                className="w-full py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
            <Check className="h-5 w-5" />
            {success}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-sm text-gray-400 mt-8">
          Powered by Vantage
        </p>
      </div>
    </div>
  )
}
