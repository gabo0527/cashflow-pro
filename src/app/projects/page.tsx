'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Briefcase, Download, ChevronDown, Plus, LayoutGrid,
  LayoutList, Upload, RefreshCw, X, Target
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/supabase'
import { THEME, PROJECT_STATUSES, getStatusConfig } from '@/components/projects/shared'
import DashboardSection from '@/components/projects/DashboardSection'
import ProjectsSection, { ProjectsSectionHandle } from '@/components/projects/ProjectsSection'
import ImportSection from '@/components/projects/ImportSection'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

type TabType = 'dashboard' | 'projects' | 'pipeline' | 'import'

export default function ProjectsPage() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Data
  const [projects, setProjects] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [timesheets, setTimesheets] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])

  // Modal state
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [editingProject, setEditingProject] = useState<any>(null)
  const [isAddingCO, setIsAddingCO] = useState(false)
  const [parentProjectId, setParentProjectId] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    client_id: '',
    status: 'active',
    budget_type: 'lump_sum',
    budget: '',
    spent: '',
    start_date: '',
    end_date: '',
    budgeted_hours: '',
    percent_complete: '',
    description: '',
  })

  // Refs
  const projectsSectionRef = useRef<ProjectsSectionHandle>(null)

  // Load data
  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await getCurrentUser()
        const user = result?.user
        if (!user) { setLoading(false); return }

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single()

        if (!profile?.company_id) { setLoading(false); return }

        setCompanyId(profile.company_id)

        const [projRes, clientRes, teamRes, timeRes, expRes, invRes] = await Promise.all([
          supabase.from('projects').select('*').eq('company_id', profile.company_id).order('name'),
          supabase.from('clients').select('*').eq('company_id', profile.company_id).order('name'),
          supabase.from('team_members').select('id, name').eq('company_id', profile.company_id).order('name'),
          supabase.from('timesheet_entries').select('id, project_id, hours, billable, date').eq('company_id', profile.company_id),
          supabase.from('expenses').select('*').eq('company_id', profile.company_id),
          supabase.from('invoices').select('*').eq('company_id', profile.company_id),
        ])

        setProjects((projRes.data || []).map(p => ({
          ...p,
          budget: parseFloat(p.budget || 0),
          spent: parseFloat(p.spent || 0),
          budgeted_hours: parseFloat(p.budgeted_hours || 0),
          percent_complete: parseFloat(p.percent_complete || 0),
        })))
        setClients(clientRes.data || [])
        setTeamMembers(teamRes.data || [])
        setTimesheets(timeRes.data || [])
        setExpenses((expRes.data || []).map(e => ({ ...e, amount: parseFloat(e.amount || 0) })))
        setInvoices((invRes.data || []).map(i => ({ ...i, amount: parseFloat(i.total_amount || i.amount || 0) })))
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  // Counts for tabs
  const counts = useMemo(() => ({
    active: projects.filter(p => p.status === 'active' && !p.is_change_order).length,
    prospect: projects.filter(p => p.status === 'prospect' && !p.is_change_order).length,
  }), [projects])

  // ============ HANDLERS ============

  const resetForm = () => {
    setFormData({
      name: '', client_id: '', status: 'active', budget_type: 'lump_sum',
      budget: '', spent: '', start_date: '', end_date: '',
      budgeted_hours: '', percent_complete: '', description: '',
    })
    setEditingProject(null)
    setIsAddingCO(false)
    setParentProjectId(null)
  }

  const openAddProject = () => {
    resetForm()
    setShowProjectModal(true)
  }

  const openEditProject = (project: any) => {
    setEditingProject(project)
    setIsAddingCO(false)
    setParentProjectId(null)
    setFormData({
      name: project.name || '',
      client_id: project.client_id || '',
      status: project.status || 'active',
      budget_type: project.budget_type || 'lump_sum',
      budget: project.budget?.toString() || '',
      spent: project.spent?.toString() || '',
      start_date: project.start_date || '',
      end_date: project.end_date || '',
      budgeted_hours: project.budgeted_hours?.toString() || '',
      percent_complete: project.percent_complete?.toString() || '',
      description: project.description || '',
    })
    setShowProjectModal(true)
  }

  const openAddChangeOrder = (parentId: string, parentName: string) => {
    resetForm()
    setIsAddingCO(true)
    setParentProjectId(parentId)
    const parent = projects.find(p => p.id === parentId)
    const existingCOs = projects.filter(p => p.parent_id === parentId).length
    setFormData(prev => ({
      ...prev,
      name: `${parentName} - CO${existingCOs + 1}`,
      client_id: parent?.client_id || '',
      budget_type: parent?.budget_type || 'lump_sum',
    }))
    setShowProjectModal(true)
  }

  const handleSaveProject = async () => {
    if (!companyId || !formData.name) return

    const projectData = {
      company_id: companyId,
      name: formData.name,
      client_id: formData.client_id || null,
      status: formData.status,
      budget_type: formData.budget_type,
      budget: parseFloat(formData.budget) || 0,
      spent: parseFloat(formData.spent) || 0,
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      budgeted_hours: parseFloat(formData.budgeted_hours) || 0,
      percent_complete: parseFloat(formData.percent_complete) || 0,
      description: formData.description || null,
      is_change_order: isAddingCO,
      parent_id: parentProjectId,
    }

    if (editingProject) {
      const { error } = await supabase
        .from('projects')
        .update({ ...projectData, updated_at: new Date().toISOString() })
        .eq('id', editingProject.id)

      if (error) { console.error('Error updating project:', error); return }

      setProjects(prev => prev.map(p =>
        p.id === editingProject.id ? { ...p, ...projectData } : p
      ))
    } else {
      const { data, error } = await supabase
        .from('projects')
        .insert(projectData)
        .select()
        .single()

      if (error) { console.error('Error creating project:', error); return }

      setProjects(prev => [...prev, { ...data, budget: parseFloat(data.budget || 0), spent: parseFloat(data.spent || 0) }])
    }

    setShowProjectModal(false)
    resetForm()
  }

  const handleDeleteProject = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return

    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) { console.error('Error deleting project:', error); return }

    setProjects(prev => prev.filter(p => p.id !== id))
  }

  // Import handlers
  const handleImportProjects = async (data: any[]) => {
    if (!companyId) return

    for (const row of data) {
      // Find or create client
      let clientId = null
      if (row.client) {
        const existingClient = clients.find(c => c.name.toLowerCase() === row.client.toLowerCase())
        if (existingClient) {
          clientId = existingClient.id
        } else {
          const { data: newClient } = await supabase
            .from('clients')
            .insert({ company_id: companyId, name: row.client })
            .select()
            .single()
          if (newClient) {
            clientId = newClient.id
            setClients(prev => [...prev, newClient])
          }
        }
      }

      const { data: newProject } = await supabase
        .from('projects')
        .insert({
          company_id: companyId,
          name: row.name,
          client_id: clientId,
          budget: parseFloat(row.budget) || 0,
          start_date: row.start_date || null,
          end_date: row.end_date || null,
          status: row.status || 'active',
        })
        .select()
        .single()

      if (newProject) {
        setProjects(prev => [...prev, { ...newProject, budget: parseFloat(newProject.budget || 0), spent: 0 }])
      }
    }
  }

  const handleImportBudgets = async (data: any[]) => {
    for (const row of data) {
      const project = projects.find(p => p.name.toLowerCase() === row.project_name?.toLowerCase())
      if (!project) continue

      await supabase
        .from('projects')
        .update({
          budget: parseFloat(row.budget) || project.budget,
          spent: parseFloat(row.spent) || project.spent,
          budgeted_hours: parseFloat(row.budgeted_hours) || project.budgeted_hours,
        })
        .eq('id', project.id)

      setProjects(prev => prev.map(p =>
        p.id === project.id
          ? { ...p, budget: parseFloat(row.budget) || p.budget, spent: parseFloat(row.spent) || p.spent }
          : p
      ))
    }
  }

  const handleImportResources = async (data: any[]) => {
    // Resource assignment would go to a project_resources table
    console.log('Importing resources:', data)
  }

  const handleDrillDown = (type: string, id: string) => {
    if (type === 'project') {
      const project = projects.find(p => p.id === id)
      if (project) openEditProject(project)
    }
  }

  const handleExport = () => {
    const csv = ['Name,Client,Status,Budget,Spent,Margin %,Start Date,End Date']
    projects.filter(p => !p.is_change_order).forEach(p => {
      const client = clients.find(c => c.id === p.client_id)
      const margin = p.budget > 0 ? ((p.budget - p.spent) / p.budget * 100).toFixed(1) : '0'
      csv.push(`"${p.name}","${client?.name || ''}",${p.status},${p.budget},${p.spent},${margin},${p.start_date || ''},${p.end_date || ''}`)
    })
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'projects-export.csv'; a.click()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
          <p className={`text-sm ${THEME.textMuted}`}>Loading projects...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-xl font-semibold ${THEME.textPrimary}`}>Projects</h1>
          <p className={`text-sm ${THEME.textMuted} mt-1`}>
            Portfolio analytics and project management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-white/[0.1] rounded-lg text-sm font-medium text-slate-300 hover:bg-white/[0.05] transition-colors"
          >
            <Download size={14} /> Export
          </button>
          <button
            onClick={openAddProject}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-500/20"
          >
            <Plus size={14} /> Add Project
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-xl p-1.5 inline-flex gap-1`}>
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'dashboard'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
              : `${THEME.textMuted} hover:text-white hover:bg-white/[0.05]`
          }`}
        >
          <LayoutGrid size={16} />
          Dashboard
        </button>
        <button
          onClick={() => setActiveTab('projects')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'projects'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-emerald-500/10'
              : `${THEME.textMuted} hover:text-white hover:bg-white/[0.05]`
          }`}
        >
          <LayoutList size={16} />
          Projects
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-white/[0.08] text-slate-300">
            {counts.active}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'pipeline'
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
              : `${THEME.textMuted} hover:text-white hover:bg-white/[0.05]`
          }`}
        >
          <Target size={16} />
          Pipeline
          {counts.prospect > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-cyan-500/20 text-cyan-400">
              {counts.prospect}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'import'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-lg shadow-blue-500/10'
              : `${THEME.textMuted} hover:text-white hover:bg-white/[0.05]`
          }`}
        >
          <Upload size={16} />
          Import
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && (
        <DashboardSection
          projects={projects}
          clients={clients}
          expenses={expenses}
          invoices={invoices}
          timesheets={timesheets}
          onDrillDown={handleDrillDown}
        />
      )}

      {activeTab === 'projects' && (
        <ProjectsSection
          ref={projectsSectionRef}
          projects={projects}
          clients={clients}
          timesheets={timesheets}
          onAddProject={openAddProject}
          onEditProject={openEditProject}
          onDeleteProject={handleDeleteProject}
          onAddChangeOrder={openAddChangeOrder}
        />
      )}

      {activeTab === 'pipeline' && (
        <ProjectsSection
          ref={projectsSectionRef}
          projects={projects.map(p => p.status === 'prospect' ? p : { ...p, status: 'prospect' }).filter(p => p.status === 'prospect')}
          clients={clients}
          timesheets={timesheets}
          onAddProject={() => { resetForm(); setFormData(prev => ({ ...prev, status: 'prospect' })); setShowProjectModal(true); }}
          onEditProject={openEditProject}
          onDeleteProject={handleDeleteProject}
          onAddChangeOrder={openAddChangeOrder}
        />
      )}

      {activeTab === 'import' && (
        <ImportSection
          projects={projects}
          clients={clients}
          teamMembers={teamMembers}
          onImportProjects={handleImportProjects}
          onImportBudgets={handleImportBudgets}
          onImportResources={handleImportResources}
        />
      )}

      {/* Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`${THEME.glass} border ${THEME.glassBorder} rounded-2xl w-full max-w-lg mx-4 overflow-hidden shadow-2xl`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.glassBorder}`}>
              <div>
                <h3 className={`text-lg font-semibold ${THEME.textPrimary}`}>
                  {editingProject ? 'Edit Project' : isAddingCO ? 'Add Change Order' : 'Add Project'}
                </h3>
                <p className={`text-xs ${THEME.textDim} mt-0.5`}>
                  {editingProject ? 'Update project details' : 'Create a new project'}
                </p>
              </div>
              <button onClick={() => setShowProjectModal(false)} className="p-1.5 hover:bg-white/[0.05] rounded-lg transition-colors">
                <X size={20} className={THEME.textMuted} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Project Name */}
              <div>
                <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>
                  Project Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  placeholder="Enter project name"
                />
              </div>

              {/* Client */}
              {!isAddingCO && (
                <div>
                  <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Client</label>
                  <select
                    value={formData.client_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, client_id: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
                  >
                    <option value="" className="bg-slate-900">Select client...</option>
                    {clients.map(c => <option key={c.id} value={c.id} className="bg-slate-900">{c.name}</option>)}
                  </select>
                </div>
              )}

              {/* Budget & Spent */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Budget</label>
                  <div className="relative">
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${THEME.textDim}`}>$</span>
                    <input
                      type="number"
                      value={formData.budget}
                      onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                      className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg pl-7 pr-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      placeholder="0"
                    />
                  </div>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Spent</label>
                  <div className="relative">
                    <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${THEME.textDim}`}>$</span>
                    <input
                      type="number"
                      value={formData.spent}
                      onChange={(e) => setFormData(prev => ({ ...prev, spent: e.target.value }))}
                      className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg pl-7 pr-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Start Date</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>End Date</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 cursor-pointer"
                  />
                </div>
              </div>

              {/* Hours & Progress */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>Budgeted Hours</label>
                  <input
                    type="number"
                    value={formData.budgeted_hours}
                    onChange={(e) => setFormData(prev => ({ ...prev, budgeted_hours: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${THEME.textMuted} mb-1.5`}>% Complete</label>
                  <input
                    type="number"
                    value={formData.percent_complete}
                    onChange={(e) => setFormData(prev => ({ ...prev, percent_complete: e.target.value }))}
                    className="w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    placeholder="0"
                    min="0"
                    max="100"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className={`block text-sm font-medium ${THEME.textMuted} mb-2`}>Status</label>
                <div className="flex gap-2 flex-wrap">
                  {Object.values(PROJECT_STATUSES).filter(s => s.id !== 'archived').map(s => (
                    <button
                      key={s.id}
                      onClick={() => setFormData(prev => ({ ...prev, status: s.id }))}
                      className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                        formData.status === s.id
                          ? `${s.bg} ${s.text} border ${s.border}`
                          : 'bg-white/[0.05] text-slate-400 border border-transparent hover:bg-white/[0.08]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${THEME.glassBorder} bg-white/[0.02]`}>
              <button
                onClick={() => setShowProjectModal(false)}
                className={`px-4 py-2 text-sm font-medium ${THEME.textMuted} hover:text-white transition-colors`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProject}
                disabled={!formData.name}
                className="px-5 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-emerald-500/20"
              >
                {editingProject ? 'Save Changes' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
