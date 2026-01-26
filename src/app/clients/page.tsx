'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  Search, Filter, Download, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Users, Plus, Edit2, X, Archive, Building2, DollarSign, FileText,
  BarChart3, Mail, Phone, User, ExternalLink
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import { supabase, getCurrentUser, fetchClients, fetchProjects, fetchInvoices } from '@/lib/supabase'
import Link from 'next/link'

// Types
interface Client {
  id: string
  name: string
  contact_name?: string
  email?: string
  phone?: string
  payment_terms: string
  status: 'active' | 'inactive' | 'archived'
  created_at?: string
  notes?: string
}

interface Project {
  id: string
  name: string
  client: string
  status: string
  budget: number
  spent: number
  start_date?: string
}

interface Invoice {
  id: string
  client: string
  amount: number
  amount_paid: number
  balance_due: number
  invoice_date: string
}

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

const formatCompactCurrency = (value: number): string => {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`
  return `$${value}`
}

const STATUS_OPTIONS = [
  { id: 'active', label: 'Active', color: 'emerald' },
  { id: 'inactive', label: 'Inactive', color: 'amber' },
  { id: 'archived', label: 'Archived', color: 'slate' },
]

const PAYMENT_TERMS = [
  { id: 'due_on_receipt', label: 'Due on Receipt' },
  { id: 'net_15', label: 'Net 15' },
  { id: 'net_30', label: 'Net 30' },
  { id: 'net_45', label: 'Net 45' },
  { id: 'net_60', label: 'Net 60' },
]

const getStatusStyle = (status: string) => {
  const styles: Record<string, { bg: string; text: string }> = {
    active: { bg: 'bg-emerald-500/20', text: 'text-emerald-500' },
    inactive: { bg: 'bg-amber-500/20', text: 'text-amber-500' },
    archived: { bg: 'bg-slate-500/20', text: 'text-slate-400' },
  }
  return styles[status] || styles.active
}

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

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

export default function ClientsPage() {
  // Data state
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<Client[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)

  // Modal state
  const [showClientModal, setShowClientModal] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [showProjectsModal, setShowProjectsModal] = useState<{ client: Client; projects: Project[] } | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    payment_terms: 'net_30',
    status: 'active',
    notes: '',
  })

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)

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

        const [clientRes, projRes, invRes] = await Promise.all([
          fetchClients(profile.company_id),
          fetchProjects(profile.company_id),
          fetchInvoices(profile.company_id)
        ])

        // Transform clients with defaults
        const transformedClients = (clientRes.data || []).map((c: any) => ({
          id: c.id,
          name: c.name || '',
          contact_name: c.contact_name || '',
          email: c.email || '',
          phone: c.phone || '',
          payment_terms: c.payment_terms || 'net_30',
          status: c.status || 'active',
          created_at: c.created_at,
          notes: c.notes || '',
        }))

        setClients(transformedClients)
        setProjects(projRes.data || [])
        setInvoices(invRes.data || [])
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Get unique years from projects
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    projects.forEach(p => {
      if (p.start_date) years.add(p.start_date.substring(0, 4))
    })
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [projects])

  // Client metrics calculation
  const clientMetrics = useMemo(() => {
    const metrics: Record<string, { 
      activeProjects: number
      totalProjects: number
      revenue: number
      billed: number
      ar: number
      projectsByYear: Record<string, Project[]>
    }> = {}

    clients.forEach(client => {
      const clientProjects = projects.filter(p => p.client === client.name)
      const clientInvoices = invoices.filter(i => i.client === client.name)
      
      // Filter by year if selected
      const filteredProjects = selectedYear === 'all' 
        ? clientProjects 
        : clientProjects.filter(p => p.start_date?.startsWith(selectedYear))

      // Group projects by year
      const projectsByYear: Record<string, Project[]> = {}
      clientProjects.forEach(p => {
        const year = p.start_date?.substring(0, 4) || 'Unknown'
        if (!projectsByYear[year]) projectsByYear[year] = []
        projectsByYear[year].push(p)
      })

      metrics[client.id] = {
        activeProjects: filteredProjects.filter(p => p.status === 'active').length,
        totalProjects: filteredProjects.length,
        revenue: clientInvoices.reduce((sum, i) => sum + (i.amount || 0), 0),
        billed: clientInvoices.reduce((sum, i) => sum + (i.amount_paid || 0), 0),
        ar: clientInvoices.reduce((sum, i) => sum + (i.balance_due || 0), 0),
        projectsByYear,
      }
    })

    return metrics
  }, [clients, projects, invoices, selectedYear])

  // Filtered clients
  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        if (!client.name?.toLowerCase().includes(query) && 
            !client.contact_name?.toLowerCase().includes(query) &&
            !client.email?.toLowerCase().includes(query)) return false
      }
      if (selectedStatus !== 'all' && client.status !== selectedStatus) return false
      return true
    }).sort((a, b) => {
      // Active first, then by name
      if (a.status === 'active' && b.status !== 'active') return -1
      if (a.status !== 'active' && b.status === 'active') return 1
      return a.name.localeCompare(b.name)
    })
  }, [clients, searchQuery, selectedStatus])

  // Summary calculations
  const summary = useMemo(() => {
    const activeClients = clients.filter(c => c.status === 'active').length
    const totalRevenue = Object.values(clientMetrics).reduce((sum, m) => sum + m.revenue, 0)
    const totalAR = Object.values(clientMetrics).reduce((sum, m) => sum + m.ar, 0)
    
    return {
      totalClients: clients.length,
      activeClients,
      totalRevenue,
      totalAR,
    }
  }, [clients, clientMetrics])

  // Chart data - Revenue by Client (top 8)
  const revenueChartData = useMemo(() => {
    return filteredClients
      .map(client => ({
        name: client.name.length > 15 ? client.name.substring(0, 15) + '...' : client.name,
        fullName: client.name,
        revenue: clientMetrics[client.id]?.revenue || 0,
      }))
      .filter(c => c.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8)
  }, [filteredClients, clientMetrics])

  // Chart data - AR by Client (top 8)
  const arChartData = useMemo(() => {
    return filteredClients
      .map(client => ({
        name: client.name.length > 15 ? client.name.substring(0, 15) + '...' : client.name,
        fullName: client.name,
        ar: clientMetrics[client.id]?.ar || 0,
      }))
      .filter(c => c.ar > 0)
      .sort((a, b) => b.ar - a.ar)
      .slice(0, 8)
  }, [filteredClients, clientMetrics])

  // Pagination
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredClients.slice(start, start + pageSize)
  }, [filteredClients, currentPage, pageSize])

  const totalPages = Math.ceil(filteredClients.length / pageSize)

  // Form handlers
  const openAddClient = () => {
    setEditingClient(null)
    setFormData({
      name: '', contact_name: '', email: '', phone: '',
      payment_terms: 'net_30', status: 'active', notes: ''
    })
    setShowClientModal(true)
  }

  const openEditClient = (client: Client) => {
    setEditingClient(client)
    setFormData({
      name: client.name,
      contact_name: client.contact_name || '',
      email: client.email || '',
      phone: client.phone || '',
      payment_terms: client.payment_terms || 'net_30',
      status: client.status,
      notes: client.notes || '',
    })
    setShowClientModal(true)
  }

  const openClientProjects = (client: Client) => {
    const clientProjects = projects.filter(p => p.client === client.name)
    setShowProjectsModal({ client, projects: clientProjects })
  }

  const saveClient = async () => {
    if (!companyId || !formData.name) return

    try {
      const clientData = {
        company_id: companyId,
        name: formData.name,
        contact_name: formData.contact_name || null,
        email: formData.email || null,
        phone: formData.phone || null,
        payment_terms: formData.payment_terms,
        status: formData.status,
        notes: formData.notes || null,
      }

      if (editingClient) {
        const { error } = await supabase
          .from('clients')
          .update(clientData)
          .eq('id', editingClient.id)

        if (error) throw error

        setClients(prev => prev.map(c => 
          c.id === editingClient.id ? { ...c, ...clientData } as Client : c
        ))
      } else {
        const { data, error } = await supabase
          .from('clients')
          .insert(clientData)
          .select()
          .single()

        if (error) throw error

        setClients(prev => [...prev, data as Client])
      }

      setShowClientModal(false)
    } catch (error) {
      console.error('Error saving client:', error)
    }
  }

  const archiveClient = async (clientId: string) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ status: 'archived' })
        .eq('id', clientId)

      if (error) throw error

      setClients(prev => prev.map(c => 
        c.id === clientId ? { ...c, status: 'archived' as const } : c
      ))
    } catch (error) {
      console.error('Error archiving client:', error)
    }
  }

  const updateStatus = async (clientId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ status: newStatus })
        .eq('id', clientId)

      if (error) throw error

      setClients(prev => prev.map(c => 
        c.id === clientId ? { ...c, status: newStatus as Client['status'] } : c
      ))
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  // Export
  const exportToExcel = () => {
    const headers = ['Client', 'Contact', 'Email', 'Phone', 'Payment Terms', 'Status', 'Active Projects', 'Total Revenue', 'Outstanding AR']
    const rows = clients.map(c => {
      const metrics = clientMetrics[c.id] || { activeProjects: 0, revenue: 0, ar: 0 }
      return [c.name, c.contact_name, c.email, c.phone, c.payment_terms, c.status, metrics.activeProjects, metrics.revenue, metrics.ar]
    })
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell || ''}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `clients-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedStatus('all')
    setSelectedYear('all')
  }

  const hasActiveFilters = searchQuery || selectedStatus !== 'all' || selectedYear !== 'all'

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
          <h1 className="text-2xl font-semibold text-slate-100">Clients</h1>
          <p className="text-sm mt-1 text-slate-400">Manage client relationships and track performance</p>
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
            onClick={openAddClient}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={18} />
            Add Client
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <CollapsibleSection title="Summary" badge={summary.activeClients + ' active'} icon={<Building2 size={16} />}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-lg bg-slate-900/50">
            <p className="text-xs font-medium text-slate-400">Total Clients</p>
            <p className="text-xl font-semibold mt-1 text-slate-100">{summary.totalClients}</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/50">
            <p className="text-xs font-medium text-slate-400">Active Clients</p>
            <p className="text-xl font-semibold mt-1 text-emerald-500">{summary.activeClients}</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/50">
            <p className="text-xs font-medium text-slate-400">Total Revenue</p>
            <p className="text-xl font-semibold mt-1 text-blue-500">{formatCurrency(summary.totalRevenue)}</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-900/50">
            <p className="text-xs font-medium text-slate-400">Outstanding AR</p>
            <p className="text-xl font-semibold mt-1 text-amber-500">{formatCurrency(summary.totalAR)}</p>
          </div>
        </div>
      </CollapsibleSection>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue by Client */}
        <CollapsibleSection title="Revenue by Client" icon={<DollarSign size={16} />}>
          <div className="h-64">
            {revenueChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={formatCompactCurrency} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} 
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                  />
                  <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                    {revenueChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">No revenue data</div>
            )}
          </div>
        </CollapsibleSection>

        {/* AR by Client */}
        <CollapsibleSection title="Outstanding AR by Client" icon={<FileText size={16} />}>
          <div className="h-64">
            {arChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={arChartData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={formatCompactCurrency} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }} 
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                  />
                  <Bar dataKey="ar" name="Outstanding" fill="#f59e0b" radius={[0, 4, 4, 0]}>
                    {arChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={index < 3 ? '#ef4444' : '#f59e0b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">No outstanding AR</div>
            )}
          </div>
        </CollapsibleSection>
      </div>

      {/* Clients Table */}
      <CollapsibleSection title="Clients" badge={filteredClients.length} icon={<Users size={16} />}>
        {/* Search and Filters */}
        <div className="space-y-3 mb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search clients, contacts, or emails..."
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-700">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Status</label>
                <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100">
                  <option value="all">All Statuses</option>
                  {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Project Year</label>
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100">
                  <option value="all">All Years</option>
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
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
                <th className="px-4 py-3 text-left font-medium text-slate-400">Client</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Contact</th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">Email</th>
                <th className="px-4 py-3 text-center font-medium text-slate-400">Payment Terms</th>
                <th className="px-4 py-3 text-center font-medium text-slate-400">Status</th>
                <th className="px-4 py-3 text-center font-medium text-slate-400">Projects</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">Revenue</th>
                <th className="px-4 py-3 text-right font-medium text-slate-400">AR</th>
                <th className="px-4 py-3 text-center font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedClients.length > 0 ? (
                paginatedClients.map((client) => {
                  const statusStyle = getStatusStyle(client.status)
                  const metrics = clientMetrics[client.id] || { activeProjects: 0, totalProjects: 0, revenue: 0, ar: 0 }

                  return (
                    <tr key={client.id} className="border-t border-slate-700 hover:bg-slate-700/30">
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-100">{client.name}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{client.contact_name || '—'}</td>
                      <td className="px-4 py-3">
                        {client.email ? (
                          <a href={`mailto:${client.email}`} className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
                            <Mail size={12} />
                            <span className="text-xs">{client.email}</span>
                          </a>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs text-slate-400">
                          {PAYMENT_TERMS.find(p => p.id === client.payment_terms)?.label || client.payment_terms}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <select
                          value={client.status}
                          onChange={(e) => updateStatus(client.id, e.target.value)}
                          className={`px-2 py-1 rounded text-xs font-medium border-0 cursor-pointer ${statusStyle.bg} ${statusStyle.text}`}
                        >
                          {STATUS_OPTIONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button 
                          onClick={() => openClientProjects(client)}
                          className="text-blue-400 hover:text-blue-300 text-xs"
                        >
                          {metrics.activeProjects} active / {metrics.totalProjects} total
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-500 font-medium">{formatCurrency(metrics.revenue)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${metrics.ar > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
                        {formatCurrency(metrics.ar)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEditClient(client)} className="p-1.5 rounded bg-slate-700 text-slate-300 hover:bg-slate-600" title="Edit">
                            <Edit2 size={14} />
                          </button>
                          {client.status !== 'archived' && (
                            <button onClick={() => archiveClient(client.id)} className="p-1.5 rounded bg-slate-700 text-slate-400 hover:bg-slate-600" title="Archive">
                              <Archive size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-400">No clients found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3">
            <p className="text-sm text-slate-400">Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, filteredClients.length)} of {filteredClients.length}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50"><ChevronLeft size={18} /></button>
              <span className="text-sm text-slate-300">Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-50"><ChevronRight size={18} /></button>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* Client Modal */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-100 mb-4">
              {editingClient ? 'Edit Client' : 'Add Client'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Client Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  placeholder="Enter client name"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Contact Name</label>
                <input
                  type="text"
                  value={formData.contact_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                  placeholder="Primary contact"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Email</label>
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Payment Terms</label>
                  <select
                    value={formData.payment_terms}
                    onChange={(e) => setFormData(prev => ({ ...prev, payment_terms: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100"
                  >
                    {PAYMENT_TERMS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
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

              <div>
                <label className="block text-sm text-slate-400 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 resize-none"
                  rows={2}
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowClientModal(false)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveClient}
                className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium transition-colors"
              >
                {editingClient ? 'Save Changes' : 'Create Client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Projects Modal */}
      {showProjectsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-100">
                Projects for {showProjectsModal.client.name}
              </h3>
              <button onClick={() => setShowProjectsModal(null)} className="p-1 rounded hover:bg-slate-700">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            
            {showProjectsModal.projects.length > 0 ? (
              <div className="space-y-2">
                {/* Group by year */}
                {Object.entries(
                  showProjectsModal.projects.reduce((acc, p) => {
                    const year = p.start_date?.substring(0, 4) || 'Unknown'
                    if (!acc[year]) acc[year] = []
                    acc[year].push(p)
                    return acc
                  }, {} as Record<string, Project[]>)
                ).sort(([a], [b]) => b.localeCompare(a)).map(([year, yearProjects]) => (
                  <div key={year}>
                    <h4 className="text-sm font-medium text-slate-400 mb-2">{year}</h4>
                    <div className="space-y-1">
                      {yearProjects.map(project => {
                        const statusStyle = getStatusStyle(project.status)
                        return (
                          <div key={project.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-900/50">
                            <div>
                              <span className="text-slate-100">{project.name}</span>
                              <span className={`ml-2 px-2 py-0.5 rounded text-xs ${statusStyle.bg} ${statusStyle.text}`}>
                                {project.status}
                              </span>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-slate-300">{formatCurrency(project.budget)}</p>
                              <p className="text-xs text-slate-500">Budget</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-center py-8">No projects found for this client</p>
            )}

            <div className="mt-6">
              <Link 
                href="/projects" 
                className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
              >
                <ExternalLink size={14} />
                View all projects
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
