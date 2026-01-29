'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  Search, Filter, Download, ChevronDown, ChevronUp, Plus, Edit2, X, 
  Users, Mail, Phone, Calendar, Eye, EyeOff, Building2, Briefcase,
  FolderOpen, DollarSign, Clock, Trash2
} from 'lucide-react'
import { supabase, getCurrentUser, fetchProjects } from '@/lib/supabase'

// Types
interface TeamMember {
  id: string
  name: string
  email: string
  phone: string | null
  role: string | null
  status: 'active' | 'inactive'
  start_date: string | null
  services: string[]
  bank_name: string | null
  account_type: string | null
  routing_number: string | null
  account_number: string | null
  payment_method: string | null
  cost_type: 'hourly' | 'monthly' | 'annual'
  cost_amount: number
}

interface ProjectAssignment {
  id: string
  team_member_id: string
  project_id: string
  project_name: string
  client_name: string
  service: string | null
  payment_type: 'lump_sum' | 'tm'
  rate: number
}

interface Project {
  id: string
  name: string
  client: string
}

interface TimeEntrySummary {
  team_member_id: string
  total_hours: number
}

interface TimeEntryDetail {
  team_member_id: string
  project_id: string
  client_id: string | null
  client_name: string
  hours: number
}

interface ClientAllocation {
  client_id: string
  client_name: string
  hours: number
  percentage: number
  cost: number
}

const SERVICES = [
  'Project Management',
  'Procurement & Supply Chain',
  'Project Controls',
  'LDD & Permitting',
  'Design Management',
]

const STATUS_OPTIONS = [
  { id: 'active', label: 'Active', color: 'emerald' },
  { id: 'inactive', label: 'Inactive', color: 'slate' },
]

const PAYMENT_TYPES = [
  { id: 'lump_sum', label: 'Lump Sum' },
  { id: 'tm', label: 'T&M' },
]

const ACCOUNT_TYPES = [
  { id: 'checking', label: 'Checking' },
  { id: 'savings', label: 'Savings' },
]

const PAYMENT_METHODS = [
  { id: 'direct_deposit', label: 'Direct Deposit' },
  { id: 'check', label: 'Check' },
  { id: 'wire', label: 'Wire Transfer' },
]

const COST_TYPES = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'hourly', label: 'Hourly' },
  { id: 'annual', label: 'Annual' },
]

const ALLOCATION_COLORS = [
  'bg-emerald-500',
  'bg-blue-500',
  'bg-purple-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-pink-500',
  'bg-indigo-500',
]

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

const maskNumber = (value: string | null): string => {
  if (!value) return '—'
  if (value.length <= 4) return '••••'
  return '••••' + value.slice(-4)
}

const getStatusStyle = (status: string) => {
  const styles: Record<string, { bg: string; text: string }> = {
    active: { bg: 'bg-emerald-500/20', text: 'text-emerald-500' },
    inactive: { bg: 'bg-slate-500/20', text: 'text-slate-400' },
  }
  return styles[status] || styles.active
}

// Collapsible Section Component
function CollapsibleSection({ 
  title, 
  children, 
  defaultExpanded = true,
  badge,
  icon
}: { 
  title: string
  children: React.ReactNode
  defaultExpanded?: boolean
  badge?: string | number
  icon?: React.ReactNode
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  
  return (
    <div className="rounded-xl border bg-slate-800 border-slate-700 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon && <span className="text-slate-400">{icon}</span>}
          <h3 className="text-sm font-medium text-slate-100">{title}</h3>
          {badge !== undefined && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-slate-700 text-slate-300">
              {badge}
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>
      {isExpanded && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  )
}

export default function TeamPage() {
  // Data state
  const [loading, setLoading] = useState(true)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [hoursSummary, setHoursSummary] = useState<TimeEntrySummary[]>([])
  const [timeEntryDetails, setTimeEntryDetails] = useState<TimeEntryDetail[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [clients, setClients] = useState<{id: string, name: string}[]>([])

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)

  // Modal state
  const [showMemberModal, setShowMemberModal] = useState(false)
  const [showAssignmentsModal, setShowAssignmentsModal] = useState<TeamMember | null>(null)
  const [showBankingModal, setShowBankingModal] = useState<TeamMember | null>(null)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [expandedMember, setExpandedMember] = useState<string | null>(null)

  // Banking visibility
  const [visibleBanking, setVisibleBanking] = useState<Record<string, boolean>>({})

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: '',
    status: 'active',
    start_date: '',
    services: [] as string[],
    bank_name: '',
    account_type: '',
    routing_number: '',
    account_number: '',
    payment_method: '',
    cost_type: 'monthly' as 'hourly' | 'monthly' | 'annual',
    cost_amount: '',
  })

  // Assignment form state
  const [assignmentForm, setAssignmentForm] = useState({
    project_id: '',
    service: '',
    payment_type: 'tm' as 'lump_sum' | 'tm',
    rate: '',
  })

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const { user } = await getCurrentUser()
        if (!user) return

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single()

        if (!profile?.company_id) {
          setLoading(false)
          return
        }

        setCompanyId(profile.company_id)

        // Fetch team members
        const { data: teamData } = await supabase
          .from('team_members')
          .select('*')
          .eq('company_id', profile.company_id)
          .order('name')

        // Fetch projects using helper
        const { data: projData, error: projError } = await fetchProjects(profile.company_id)
        
        console.log('Projects fetched:', projData?.length, 'Error:', projError)
        
        if (projError) {
          console.error('Error fetching projects:', projError)
        }

        // Fetch project assignments (simplified - no join)
        const { data: assignData, error: assignError } = await supabase
          .from('team_project_assignments')
          .select('*')
          .eq('company_id', profile.company_id)

        console.log('Assignments fetched:', assignData?.length, 'Error:', assignError)

        // Fetch hours summary for current month
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
        const { data: hoursData, error: hoursError } = await supabase
          .from('time_entries')
          .select('contractor_id, project_id, hours')
          .eq('company_id', profile.company_id)
          .gte('date', startOfMonth)

        console.log('Hours fetched:', hoursData?.length, 'Error:', hoursError)

        // Fetch clients for allocation
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, name')
          .eq('company_id', profile.company_id)

        // Aggregate hours by team member
        const hoursMap: Record<string, number> = {}
        ;(hoursData || []).forEach((entry: any) => {
          const memberId = entry.contractor_id
          hoursMap[memberId] = (hoursMap[memberId] || 0) + (entry.hours || 0)
        })
        const hoursSummaryData = Object.entries(hoursMap).map(([id, hours]) => ({
          team_member_id: id,
          total_hours: hours,
        }))

        // Build detailed time entries for allocation (by client)
        const timeDetailMap: Record<string, TimeEntryDetail[]> = {}
        ;(hoursData || []).forEach((entry: any) => {
          const memberId = entry.contractor_id
          const project = (projData || []).find((p: any) => p.id === entry.project_id) as any
          const clientId = project?.client_id || 'unknown'
          const clientName = (clientsData || []).find((c: any) => c.id === clientId)?.name || project?.client || 'Unassigned'
          
          if (!timeDetailMap[memberId]) timeDetailMap[memberId] = []
          
          const existing = timeDetailMap[memberId].find(d => d.client_id === clientId)
          if (existing) {
            existing.hours += entry.hours || 0
          } else {
            timeDetailMap[memberId].push({
              team_member_id: memberId,
              project_id: entry.project_id,
              client_id: clientId,
              client_name: clientName,
              hours: entry.hours || 0,
            })
          }
        })
        const timeDetails = Object.values(timeDetailMap).flat()

        // Transform team members
        const transformedMembers = (teamData || []).map((t: any) => ({
          id: t.id,
          name: t.name || '',
          email: t.email || '',
          phone: t.phone || null,
          role: t.role || null,
          status: t.status || 'active',
          start_date: t.start_date || null,
          services: t.services || [],
          bank_name: t.bank_name || null,
          account_type: t.account_type || null,
          routing_number: t.routing_number || null,
          account_number: t.account_number || null,
          payment_method: t.payment_method || null,
          cost_type: t.cost_type || 'monthly',
          cost_amount: t.cost_amount || 0,
        }))

        // Transform assignments (look up project names from projData)
        const transformedAssignments = (assignData || []).map((a: any) => {
          const project = (projData || []).find((p: any) => p.id === a.project_id) as any
          return {
            id: a.id,
            team_member_id: a.team_member_id,
            project_id: a.project_id,
            project_name: project?.name || 'Unknown Project',
            client_name: project?.client || '',
            service: a.service || null,
            payment_type: a.payment_type || 'tm',
            rate: a.rate || 0,
          }
        })

        setTeamMembers(transformedMembers)
        const transformedProjects = (projData || []).map((p: any) => ({ id: p.id, name: p.name || '', client: p.client || '' }))
        console.log('Setting projects state:', transformedProjects.length, transformedProjects)
        setProjects(transformedProjects)
        setAssignments(transformedAssignments)
        setHoursSummary(hoursSummaryData)
        setTimeEntryDetails(timeDetails)
        setClients((clientsData || []).map((c: any) => ({ id: c.id, name: c.name })))
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Filtered team members
  const filteredMembers = useMemo(() => {
    return teamMembers.filter(member => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!member.name?.toLowerCase().includes(query) && 
            !member.email?.toLowerCase().includes(query) &&
            !member.role?.toLowerCase().includes(query)) return false
      }
      if (selectedStatus !== 'all' && member.status !== selectedStatus) return false
      return true
    })
  }, [teamMembers, searchQuery, selectedStatus])

  // Summary
  const summary = useMemo(() => {
    const active = teamMembers.filter(m => m.status === 'active').length
    const totalHours = hoursSummary.reduce((sum, h) => sum + h.total_hours, 0)
    
    // Calculate total monthly labor cost
    const totalMonthlyCost = teamMembers.filter(m => m.status === 'active').reduce((sum, m) => {
      if (m.cost_type === 'monthly') return sum + (m.cost_amount || 0)
      if (m.cost_type === 'annual') return sum + ((m.cost_amount || 0) / 12)
      if (m.cost_type === 'hourly') {
        const hours = hoursSummary.find(h => h.team_member_id === m.id)?.total_hours || 0
        return sum + (hours * (m.cost_amount || 0))
      }
      return sum
    }, 0)
    
    const costPerHour = totalHours > 0 ? totalMonthlyCost / totalHours : 0
    
    return {
      total: teamMembers.length,
      active,
      totalHours,
      totalMonthlyCost,
      costPerHour,
    }
  }, [teamMembers, hoursSummary])

  // Get member hours
  const getMemberHours = (memberId: string): number => {
    return hoursSummary.find(h => h.team_member_id === memberId)?.total_hours || 0
  }

  // Get member assignments
  const getMemberAssignments = (memberId: string): ProjectAssignment[] => {
    return assignments.filter(a => a.team_member_id === memberId)
  }

  // Get member monthly cost
  const getMemberMonthlyCost = (member: TeamMember): number => {
    if (member.cost_type === 'monthly') return member.cost_amount || 0
    if (member.cost_type === 'annual') return (member.cost_amount || 0) / 12
    if (member.cost_type === 'hourly') {
      const hours = getMemberHours(member.id)
      return hours * (member.cost_amount || 0)
    }
    return 0
  }

  // Get member client allocation
  const getMemberAllocation = (memberId: string): ClientAllocation[] => {
    const memberEntries = timeEntryDetails.filter(e => e.team_member_id === memberId)
    const totalHours = memberEntries.reduce((sum, e) => sum + e.hours, 0)
    const member = teamMembers.find(m => m.id === memberId)
    const monthlyCost = member ? getMemberMonthlyCost(member) : 0
    
    // Group by client
    const clientMap: Record<string, { hours: number, name: string }> = {}
    memberEntries.forEach(e => {
      if (!clientMap[e.client_id || 'unknown']) {
        clientMap[e.client_id || 'unknown'] = { hours: 0, name: e.client_name }
      }
      clientMap[e.client_id || 'unknown'].hours += e.hours
    })
    
    return Object.entries(clientMap)
      .map(([clientId, data]) => ({
        client_id: clientId,
        client_name: data.name,
        hours: data.hours,
        percentage: totalHours > 0 ? (data.hours / totalHours) * 100 : 0,
        cost: totalHours > 0 ? (data.hours / totalHours) * monthlyCost : 0,
      }))
      .sort((a, b) => b.percentage - a.percentage)
  }

  // Get total cost by client (for CEO view)
  const getCostByClient = useMemo(() => {
    const clientCosts: Record<string, { name: string, cost: number, hours: number }> = {}
    
    teamMembers.filter(m => m.status === 'active').forEach(member => {
      const allocation = getMemberAllocation(member.id)
      allocation.forEach(a => {
        if (!clientCosts[a.client_id]) {
          clientCosts[a.client_id] = { name: a.client_name, cost: 0, hours: 0 }
        }
        clientCosts[a.client_id].cost += a.cost
        clientCosts[a.client_id].hours += a.hours
      })
    })
    
    return Object.entries(clientCosts)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.cost - a.cost)
  }, [teamMembers, timeEntryDetails])

  // Form handlers
  const openAddMember = () => {
    setEditingMember(null)
    setFormData({
      name: '', email: '', phone: '', role: '', status: 'active', start_date: '',
      services: [], bank_name: '', account_type: '', routing_number: '', account_number: '', payment_method: '',
      cost_type: 'monthly', cost_amount: '',
    })
    setShowMemberModal(true)
  }

  const openEditMember = (member: TeamMember) => {
    setEditingMember(member)
    setFormData({
      name: member.name,
      email: member.email,
      phone: member.phone || '',
      role: member.role || '',
      status: member.status,
      start_date: member.start_date || '',
      services: member.services || [],
      bank_name: member.bank_name || '',
      account_type: member.account_type || '',
      routing_number: member.routing_number || '',
      account_number: member.account_number || '',
      payment_method: member.payment_method || '',
      cost_type: member.cost_type || 'monthly',
      cost_amount: member.cost_amount?.toString() || '',
    })
    setShowMemberModal(true)
  }

  const saveMember = async () => {
    if (!companyId || !formData.name || !formData.email) return

    try {
      const memberData = {
        company_id: companyId,
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        role: formData.role || null,
        status: formData.status,
        start_date: formData.start_date || null,
        services: formData.services,
        bank_name: formData.bank_name || null,
        account_type: formData.account_type || null,
        routing_number: formData.routing_number || null,
        account_number: formData.account_number || null,
        payment_method: formData.payment_method || null,
        cost_type: formData.cost_type,
        cost_amount: parseFloat(formData.cost_amount) || 0,
      }

      if (editingMember) {
        const { error } = await supabase
          .from('team_members')
          .update(memberData)
          .eq('id', editingMember.id)

        if (error) throw error

        setTeamMembers(prev => prev.map(m => 
          m.id === editingMember.id ? { ...m, ...memberData } as TeamMember : m
        ))
      } else {
        const { data, error } = await supabase
          .from('team_members')
          .insert(memberData)
          .select()
          .single()

        if (error) throw error

        setTeamMembers(prev => [...prev, data as TeamMember])
      }

      setShowMemberModal(false)
    } catch (error) {
      console.error('Error saving member:', error)
    }
  }

  const archiveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('team_members')
        .update({ status: 'inactive' })
        .eq('id', memberId)

      if (error) throw error

      setTeamMembers(prev => prev.map(m => 
        m.id === memberId ? { ...m, status: 'inactive' as const } : m
      ))
    } catch (error) {
      console.error('Error archiving member:', error)
    }
  }

  // Assignment handlers
  const openAssignments = (member: TeamMember) => {
    setShowAssignmentsModal(member)
    setAssignmentForm({ project_id: '', service: '', payment_type: 'tm', rate: '' })
  }

  const addAssignment = async () => {
    if (!companyId || !showAssignmentsModal || !assignmentForm.project_id) return

    try {
      const project = projects.find(p => p.id === assignmentForm.project_id)
      const assignmentData = {
        company_id: companyId,
        team_member_id: showAssignmentsModal.id,
        project_id: assignmentForm.project_id,
        service: assignmentForm.service || null,
        payment_type: assignmentForm.payment_type,
        rate: parseFloat(assignmentForm.rate) || 0,
      }

      const { data, error } = await supabase
        .from('team_project_assignments')
        .insert(assignmentData)
        .select()
        .single()

      if (error) throw error

      const newAssignment: ProjectAssignment = {
        id: data.id,
        team_member_id: data.team_member_id,
        project_id: data.project_id,
        project_name: project?.name || '',
        client_name: project?.client || '',
        service: data.service,
        payment_type: data.payment_type,
        rate: data.rate,
      }

      setAssignments(prev => [...prev, newAssignment])
      setAssignmentForm({ project_id: '', service: '', payment_type: 'tm', rate: '' })
    } catch (error) {
      console.error('Error adding assignment:', error)
    }
  }

  const removeAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('team_project_assignments')
        .delete()
        .eq('id', assignmentId)

      if (error) throw error

      setAssignments(prev => prev.filter(a => a.id !== assignmentId))
    } catch (error) {
      console.error('Error removing assignment:', error)
    }
  }

  // Toggle service
  const toggleService = (service: string) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }))
  }

  // Export
  const exportToExcel = () => {
    const headers = ['Name', 'Email', 'Phone', 'Role', 'Status', 'Start Date', 'Services', 'Hours (MTD)']
    const rows = teamMembers.map(m => [
      m.name, m.email, m.phone || '', m.role || '', m.status, m.start_date || '',
      (m.services || []).join('; '), getMemberHours(m.id)
    ])
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `team-directory-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedStatus('all')
  }

  const hasActiveFilters = searchQuery || selectedStatus !== 'all'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Team</h1>
          <p className="text-sm mt-1 text-slate-400">Manage team directory and project assignments</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={18} />
            Export
          </button>
          <button
            onClick={openAddMember}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={18} />
            Add Member
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <CollapsibleSection title="Summary" badge={`${summary.active} active`} icon={<Users size={16} />}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-4 rounded-lg bg-slate-900/50">
            <p className="text-xs font-medium text-slate-400">Total Members</p>
            <p className="text-xl font-semibold mt-1 text-slate-100">{summary.total}</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/50">
            <p className="text-xs font-medium text-slate-400">Active</p>
            <p className="text-xl font-semibold mt-1 text-emerald-500">{summary.active}</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/50">
            <p className="text-xs font-medium text-slate-400">Hours (MTD)</p>
            <p className="text-xl font-semibold mt-1 text-blue-500">{summary.totalHours.toFixed(1)}</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/50">
            <p className="text-xs font-medium text-slate-400">Labor Cost (MTD)</p>
            <p className="text-xl font-semibold mt-1 text-amber-500">{formatCurrency(summary.totalMonthlyCost)}</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/50">
            <p className="text-xs font-medium text-slate-400">Cost per Hour</p>
            <p className="text-xl font-semibold mt-1 text-purple-500">{formatCurrency(summary.costPerHour)}</p>
          </div>
        </div>
      </CollapsibleSection>

      {/* CEO View - Cost by Client */}
      <CollapsibleSection title="Cost Distribution by Client" badge={`${getCostByClient.length} clients`} icon={<Building2 size={16} />} defaultExpanded={false}>
        {getCostByClient.length > 0 ? (
          <div className="space-y-3">
            {getCostByClient.map((client, index) => {
              const percentage = summary.totalMonthlyCost > 0 ? (client.cost / summary.totalMonthlyCost) * 100 : 0
              return (
                <div key={client.id} className="p-3 rounded-lg bg-slate-900/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]}`} />
                      <span className="font-medium text-slate-100">{client.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-100 font-medium">{formatCurrency(client.cost)}</span>
                      <span className="text-slate-400 text-sm ml-2">({percentage.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]} transition-all`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 w-20 text-right">{client.hours.toFixed(1)} hrs</span>
                  </div>
                </div>
              )
            })}
            <div className="pt-3 border-t border-slate-700 flex justify-between">
              <span className="text-slate-400 font-medium">Total</span>
              <span className="text-slate-100 font-semibold">{formatCurrency(summary.totalMonthlyCost)}</span>
            </div>
          </div>
        ) : (
          <p className="text-slate-400 text-center py-4">No time entries this month to calculate allocation</p>
        )}
      </CollapsibleSection>

      {/* Team Directory */}
      <CollapsibleSection title="Directory" badge={filteredMembers.length} icon={<Briefcase size={16} />}>
        {/* Search and Filters */}
        <div className="space-y-3 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, or role..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showFilters || hasActiveFilters ? 'bg-blue-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-100'}`}
            >
              <Filter size={16} />
              Filters
            </button>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-700 hover:bg-slate-600 text-slate-100">
                <X size={16} /> Clear
              </button>
            )}
          </div>

          {showFilters && (
            <div className="pt-3 border-t border-slate-700">
              <div className="w-48">
                <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
                <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100">
                  <option value="all">All</option>
                  {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900/50">
                <th className="px-4 py-3 text-left font-medium text-slate-400 w-8"></th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Name</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Role</th>
                <th className="px-4 py-3 text-center font-medium text-slate-400">Projects</th>
                <th className="px-4 py-3 text-center font-medium text-slate-400">Status</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">Hours (MTD)</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">Cost</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Client Allocation</th>
                <th className="px-4 py-3 text-center font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length > 0 ? (
                filteredMembers.map((member) => {
                  const statusStyle = getStatusStyle(member.status)
                  const memberAssignments = getMemberAssignments(member.id)
                  const hours = getMemberHours(member.id)
                  const monthlyCost = getMemberMonthlyCost(member)
                  const allocation = getMemberAllocation(member.id)
                  const isExpanded = expandedMember === member.id

                  return (
                    <React.Fragment key={member.id}>
                      <tr className={`border-t border-slate-700 hover:bg-slate-700/30 ${isExpanded ? 'bg-slate-700/20' : ''}`}>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setExpandedMember(isExpanded ? null : member.id)}
                            className="p-1 rounded hover:bg-slate-600"
                          >
                            {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-100">{member.name}</span>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {member.cost_amount > 0 
                              ? `${formatCurrency(member.cost_amount)}${member.cost_type === 'hourly' ? '/hr' : member.cost_type === 'annual' ? '/yr' : '/mo'}`
                              : 'No cost set'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{member.role || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => openAssignments(member)}
                            className="text-blue-400 hover:text-blue-300 text-xs"
                          >
                            {memberAssignments.length} projects
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                            {STATUS_OPTIONS.find(s => s.id === member.status)?.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-blue-500 font-medium">{hours.toFixed(1)}</td>
                        <td className="px-4 py-3 text-right text-amber-500 font-medium">{formatCurrency(monthlyCost)}</td>
                        <td className="px-4 py-3">
                          {allocation.length > 0 ? (
                            <div className="flex items-center gap-1">
                              <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden flex">
                                {allocation.map((a, i) => (
                                  <div
                                    key={a.client_id}
                                    className={`h-full ${ALLOCATION_COLORS[i % ALLOCATION_COLORS.length]}`}
                                    style={{ width: `${a.percentage}%` }}
                                    title={`${a.client_name}: ${a.percentage.toFixed(0)}%`}
                                  />
                                ))}
                              </div>
                              <span className="text-xs text-slate-400 w-12 text-right">{allocation.length} clients</span>
                            </div>
                          ) : (
                            <span className="text-slate-500 text-xs">No hours</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => openEditMember(member)}
                              className="p-1.5 rounded bg-slate-700 text-slate-400 hover:bg-slate-600"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => setShowBankingModal(member)}
                              className="p-1.5 rounded bg-slate-700 text-slate-400 hover:bg-slate-600"
                              title="Banking"
                            >
                              {member.bank_name ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                            {member.status === 'active' && (
                              <button
                                onClick={() => archiveMember(member.id)}
                                className="p-1.5 rounded bg-slate-700 text-slate-400 hover:bg-rose-600"
                                title="Archive"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* Expanded Row - Allocation Details */}
                      {isExpanded && (
                        <tr className="bg-slate-800/50">
                          <td colSpan={9} className="px-4 py-3">
                            <div className="grid grid-cols-2 gap-4">
                              {/* Contact Info */}
                              <div className="space-y-2">
                                <h4 className="text-xs font-medium text-slate-400 uppercase">Contact</h4>
                                <div className="flex flex-col gap-1">
                                  <a href={`mailto:${member.email}`} className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-2">
                                    <Mail size={14} /> {member.email}
                                  </a>
                                  {member.phone && (
                                    <span className="text-slate-300 text-sm flex items-center gap-2">
                                      <Phone size={14} /> {member.phone}
                                    </span>
                                  )}
                                  {member.start_date && (
                                    <span className="text-slate-400 text-sm flex items-center gap-2">
                                      <Calendar size={14} /> Since {member.start_date}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {/* Client Allocation Breakdown */}
                              <div className="space-y-2">
                                <h4 className="text-xs font-medium text-slate-400 uppercase">Client Allocation (MTD)</h4>
                                {allocation.length > 0 ? (
                                  <div className="space-y-1.5">
                                    {allocation.map((a, i) => (
                                      <div key={a.client_id} className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${ALLOCATION_COLORS[i % ALLOCATION_COLORS.length]}`} />
                                        <span className="text-slate-200 text-sm flex-1">{a.client_name}</span>
                                        <span className="text-slate-400 text-xs">{a.hours.toFixed(1)} hrs</span>
                                        <span className="text-slate-300 text-sm font-medium w-14 text-right">{a.percentage.toFixed(0)}%</span>
                                        <span className="text-amber-500 text-sm font-medium w-20 text-right">{formatCurrency(a.cost)}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-slate-500 text-sm">No time entries this month</p>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              ) : (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">No team members found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      {/* Member Modal */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">
              {editingMember ? 'Edit Team Member' : 'Add Team Member'}
            </h3>
            
            <div className="space-y-6">
              {/* Basic Info */}
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-3">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                      placeholder="Full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Email *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Role/Title</label>
                    <input
                      type="text"
                      value={formData.role}
                      onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                      placeholder="Project Manager"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                    >
                      {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Services */}
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-3">Services</h4>
                <div className="flex flex-wrap gap-2">
                  {SERVICES.map(service => (
                    <button
                      key={service}
                      onClick={() => toggleService(service)}
                      className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                        formData.services.includes(service)
                          ? 'bg-blue-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {service}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cost Information */}
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                  <DollarSign size={16} className="text-amber-500" />
                  Cost to Company
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Cost Type</label>
                    <select
                      value={formData.cost_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, cost_type: e.target.value as 'hourly' | 'monthly' | 'annual' }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                    >
                      {COST_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">
                      Amount ({formData.cost_type === 'hourly' ? 'per hour' : formData.cost_type === 'annual' ? 'per year' : 'per month'})
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                      <input
                        type="number"
                        value={formData.cost_amount}
                        onChange={(e) => setFormData(prev => ({ ...prev, cost_amount: e.target.value }))}
                        className="w-full pl-7 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  This is what you pay this team member. Cost will be allocated to clients based on time entries.
                </p>
              </div>

              {/* Banking Info */}
              <div>
                <h4 className="text-sm font-medium text-slate-300 mb-3">Banking Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={formData.bank_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, bank_name: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                      placeholder="Bank of America"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Account Type</label>
                    <select
                      value={formData.account_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, account_type: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                    >
                      <option value="">Select...</option>
                      {ACCOUNT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Routing Number</label>
                    <input
                      type="text"
                      value={formData.routing_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, routing_number: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                      placeholder="123456789"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Account Number</label>
                    <input
                      type="text"
                      value={formData.account_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, account_number: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                      placeholder="1234567890"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm text-slate-400 mb-1">Payment Method</label>
                    <select
                      value={formData.payment_method}
                      onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                    >
                      <option value="">Select...</option>
                      {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowMemberModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveMember}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
              >
                {editingMember ? 'Save Changes' : 'Add Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assignments Modal */}
      {showAssignmentsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100">
                Project Assignments — {showAssignmentsModal.name}
              </h3>
              <button onClick={() => setShowAssignmentsModal(null)} className="p-1 rounded hover:bg-slate-700">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {/* Current Assignments */}
            <div className="space-y-2 mb-6">
              {getMemberAssignments(showAssignmentsModal.id).length > 0 ? (
                getMemberAssignments(showAssignmentsModal.id).map(assignment => (
                  <div key={assignment.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                    <div>
                      <p className="text-slate-100 font-medium">{assignment.project_name}</p>
                      <p className="text-xs text-slate-400">{assignment.client_name}</p>
                      {assignment.service && (
                        <span className="inline-block mt-1 px-2 py-0.5 text-xs rounded bg-slate-700 text-slate-300">
                          {assignment.service}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className={`text-xs px-2 py-0.5 rounded ${assignment.payment_type === 'lump_sum' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {assignment.payment_type === 'lump_sum' ? 'Lump Sum' : 'T&M'}
                        </span>
                        <p className="text-slate-300 text-sm mt-1">
                          {formatCurrency(assignment.rate)}{assignment.payment_type === 'tm' ? '/hr' : '/mo'}
                        </p>
                      </div>
                      <button
                        onClick={() => removeAssignment(assignment.id)}
                        className="p-1.5 rounded bg-rose-500/20 text-rose-500 hover:bg-rose-500/30"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-center py-4">No project assignments</p>
              )}
            </div>

            {/* Add Assignment */}
            <div className="border-t border-slate-700 pt-4">
              <h4 className="text-sm font-medium text-slate-300 mb-3">Add Assignment</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Project</label>
                  <select
                    value={assignmentForm.project_id}
                    onChange={(e) => setAssignmentForm(prev => ({ ...prev, project_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100"
                  >
                    <option value="">Select project...</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.client ? `${p.client} - ` : ''}{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Service</label>
                  <select
                    value={assignmentForm.service}
                    onChange={(e) => setAssignmentForm(prev => ({ ...prev, service: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100"
                  >
                    <option value="">Select service...</option>
                    {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Payment Type</label>
                  <select
                    value={assignmentForm.payment_type}
                    onChange={(e) => setAssignmentForm(prev => ({ ...prev, payment_type: e.target.value as 'lump_sum' | 'tm' }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100"
                  >
                    {PAYMENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Rate ({assignmentForm.payment_type === 'lump_sum' ? '/month' : '/hour'})
                  </label>
                  <input
                    type="number"
                    value={assignmentForm.rate}
                    onChange={(e) => setAssignmentForm(prev => ({ ...prev, rate: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100"
                    placeholder="0"
                  />
                </div>
              </div>
              <button
                onClick={addAssignment}
                disabled={!assignmentForm.project_id}
                className="mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors"
              >
                Add Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banking Modal */}
      {showBankingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100">
                Banking Info — {showBankingModal.name}
              </h3>
              <button onClick={() => setShowBankingModal(null)} className="p-1 rounded hover:bg-slate-700">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {showBankingModal.bank_name ? (
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-400">Bank</span>
                  <span className="text-slate-100">{showBankingModal.bank_name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-400">Account Type</span>
                  <span className="text-slate-100">
                    {ACCOUNT_TYPES.find(t => t.id === showBankingModal.account_type)?.label || '—'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-400">Routing #</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-100 font-mono">
                      {visibleBanking[showBankingModal.id + '_routing'] 
                        ? showBankingModal.routing_number 
                        : maskNumber(showBankingModal.routing_number)}
                    </span>
                    <button
                      onClick={() => setVisibleBanking(prev => ({ 
                        ...prev, 
                        [showBankingModal.id + '_routing']: !prev[showBankingModal.id + '_routing'] 
                      }))}
                      className="p-1 rounded hover:bg-slate-700"
                    >
                      {visibleBanking[showBankingModal.id + '_routing'] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-700">
                  <span className="text-slate-400">Account #</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-100 font-mono">
                      {visibleBanking[showBankingModal.id + '_account'] 
                        ? showBankingModal.account_number 
                        : maskNumber(showBankingModal.account_number)}
                    </span>
                    <button
                      onClick={() => setVisibleBanking(prev => ({ 
                        ...prev, 
                        [showBankingModal.id + '_account']: !prev[showBankingModal.id + '_account'] 
                      }))}
                      className="p-1 rounded hover:bg-slate-700"
                    >
                      {visibleBanking[showBankingModal.id + '_account'] ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-400">Payment Method</span>
                  <span className="text-slate-100">
                    {PAYMENT_METHODS.find(m => m.id === showBankingModal.payment_method)?.label || '—'}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-slate-400 text-center py-8">No banking information on file</p>
            )}

            <button
              onClick={() => {
                setShowBankingModal(null)
                openEditMember(showBankingModal)
              }}
              className="w-full mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
            >
              Edit Banking Info
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
