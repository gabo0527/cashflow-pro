'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import {
  Briefcase, Plus, Download, Upload, X, Building2,
  BarChart3, List, Target, Calendar
} from 'lucide-react'
import {
  THEME, PROJECT_STATUSES,
  formatCurrency, formatDateShort, StatusBadge
} from '@/components/projects/shared'
import DashboardSection from '@/components/projects/DashboardSection'
import ProjectsSection, { ProjectsSectionHandle } from '@/components/projects/ProjectsSection'
import ImportSection from '@/components/projects/ImportSection'
import ProjectDetailView from '@/components/projects/ProjectDetailView'

export default function ProjectsPage() {
  const supabase = createClientComponentClient()
  const projectsSectionRef = useRef<ProjectsSectionHandle>(null)

  const [activeTab, setActiveTab] = useState<'dashboard' | 'projects' | 'pipeline' | 'import'>('dashboard')
  const [projects, setProjects] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [timesheets, setTimesheets] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [showProjectModal, setShowProjectModal] = useState(false)
  const [editingProject, setEditingProject] = useState<any>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [isAddingCO, setIsAddingCO] = useState(false)
  const [coParentId, setCoParentId] = useState<string | null>(null)
  const [coParentName, setCoParentName] = useState('')

  const emptyForm = { name: '', client_id: '', budget: '', spent: '', budgeted_hours: '', percent_complete: '', status: 'active', start_date: '', end_date: '', budget_type: 'fixed', description: '' }
  const [formData, setFormData] = useState(emptyForm)

  const loadData = useCallback(async () => {
    try {
      const [pRes, cRes, tmRes, tsRes, eRes, iRes] = await Promise.all([
        supabase.from('projects').select('*').order('name'),
        supabase.from('clients').select('*').order('name'),
        supabase.from('team_members').select('*'),
        supabase.from('time_entries').select('*'),
        supabase.from('expenses').select('*'),
        supabase.from('invoices').select('*'),
      ])
      setProjects((pRes.data || []).map(p => ({
        ...p,
        budget: parseFloat(p.budget) || 0,
        spent: parseFloat(p.spent) || 0,
        budgeted_hours: parseFloat(p.budgeted_hours) || 0,
        percent_complete: parseFloat(p.percent_complete) || 0,
      })))
      setClients(cRes.data || [])
      setTeamMembers(tmRes.data || [])
      setTimesheets(tsRes.data || [])
      setExpenses(eRes.data || [])
      setInvoices(iRes.data || [])
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  const resetForm = () => { setFormData(emptyForm); setEditingProject(null); setIsAddingCO(false); setCoParentId(null); setCoParentName('') }
  const openAddProject = () => { resetForm(); setShowProjectModal(true) }
  const openEditProject = (project: any) => {
    setFormData({
      name: project.name || '', client_id: project.client_id || '',
      budget: project.budget?.toString() || '', spent: project.spent?.toString() || '',
      budgeted_hours: project.budgeted_hours?.toString() || '', percent_complete: project.percent_complete?.toString() || '',
      status: project.status || 'active', start_date: project.start_date || '', end_date: project.end_date || '',
      budget_type: project.budget_type || 'fixed', description: project.description || '',
    })
    setEditingProject(project)
    setShowProjectModal(true)
  }
  const openAddChangeOrder = (parentId: string, parentName: string) => {
    resetForm()
    setIsAddingCO(true)
    setCoParentId(parentId)
    setCoParentName(parentName)
    const parent = projects.find(p => p.id === parentId)
    if (parent) setFormData(prev => ({ ...prev, client_id: parent.client_id }))
    setShowProjectModal(true)
  }

  const handleSave = async () => {
    try {
      const payload: any = {
        name: formData.name, client_id: formData.client_id || null,
        budget: parseFloat(formData.budget) || 0, spent: parseFloat(formData.spent) || 0,
        budgeted_hours: parseFloat(formData.budgeted_hours) || 0,
        percent_complete: parseFloat(formData.percent_complete) || 0,
        status: formData.status, start_date: formData.start_date || null, end_date: formData.end_date || null,
        budget_type: formData.budget_type, description: formData.description,
      }
      if (isAddingCO && coParentId) { payload.parent_id = coParentId; payload.is_change_order = true }
      if (editingProject) {
        await supabase.from('projects').update(payload).eq('id', editingProject.id)
      } else {
        await supabase.from('projects').insert(payload)
      }
      setShowProjectModal(false)
      resetForm()
      loadData()
    } catch (err) { console.error(err) }
  }

  const handleDeleteProject = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    await supabase.from('projects').delete().eq('id', id)
    loadData()
  }

  const handleDrillDown = (type: string, id: string) => { if (type === 'project') setSelectedProjectId(id) }
  const handleViewProject = (projectId: string) => setSelectedProjectId(projectId)

  const handleImportProjects = async (data: any[]) => { await supabase.from('projects').insert(data); loadData() }
  const handleImportBudgets = async (data: any[]) => { for (const d of data) { const p = projects.find(pp => pp.name === d.project_name); if (p) await supabase.from('projects').update({ budget: d.budget, spent: d.spent, budgeted_hours: d.budgeted_hours }).eq('id', p.id) }; loadData() }
  const handleImportResources = async (_data: any[]) => { loadData() }

  const handleExport = () => {
    const csv = ['Name,Client,Budget,Spent,Margin,Status',
      ...projects.filter(p => !p.is_change_order).map(p => {
        const client = clients.find(c => c.id === p.client_id)?.name || ''
        const margin = p.budget > 0 ? ((p.budget - p.spent) / p.budget * 100).toFixed(1) : '0'
        return `"${p.name}","${client}",${p.budget},${p.spent},${margin}%,${p.status}`
      })
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'projects.csv'; a.click()
  }

  const activeCount = projects.filter(p => p.status === 'active' && !p.is_change_order).length
  const prospectCount = projects.filter(p => p.status === 'prospect' && !p.is_change_order).length

  const tabs = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: BarChart3 },
    { id: 'projects' as const, label: 'Projects', icon: List, badge: activeCount },
    { id: 'pipeline' as const, label: 'Pipeline', icon: Target, badge: prospectCount },
    { id: 'import' as const, label: 'Import', icon: Upload },
  ]

  if (loading) return <div className={`min-h-screen ${THEME.bgAlt} flex items-center justify-center`}><div className="animate-pulse text-slate-400">Loading projects...</div></div>

  return (
    <div className={`min-h-screen ${THEME.bgAlt}`}>
      <div className="max-w-[1440px] mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
            <p className="text-sm text-slate-400">Portfolio analytics and project management</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm">
              <Download size={16} /> Export
            </button>
            <button onClick={openAddProject} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-sm font-medium text-white transition-colors shadow-sm">
              <Plus size={16} /> Add Project
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-0 border-b border-slate-200 mb-6">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all ${
                activeTab === tab.id ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}>
              <tab.icon size={16} />
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 text-[10px] rounded-full font-bold ${
                  activeTab === tab.id ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'dashboard' && <DashboardSection projects={projects} clients={clients} expenses={expenses} invoices={invoices} timesheets={timesheets} onDrillDown={handleDrillDown} />}
        {activeTab === 'projects' && <ProjectsSection ref={projectsSectionRef} projects={projects} clients={clients} timesheets={timesheets} onAddProject={openAddProject} onEditProject={openEditProject} onDeleteProject={handleDeleteProject} onAddChangeOrder={openAddChangeOrder} onViewProject={handleViewProject} />}
        {activeTab === 'pipeline' && <ProjectsSection ref={projectsSectionRef} projects={projects.filter(p => p.status === 'prospect')} clients={clients} timesheets={timesheets} onAddProject={() => { resetForm(); setFormData(prev => ({ ...prev, status: 'prospect' })); setShowProjectModal(true) }} onEditProject={openEditProject} onDeleteProject={handleDeleteProject} onAddChangeOrder={openAddChangeOrder} onViewProject={handleViewProject} />}
        {activeTab === 'import' && <ImportSection projects={projects} clients={clients} teamMembers={teamMembers} onImportProjects={handleImportProjects} onImportBudgets={handleImportBudgets} onImportResources={handleImportResources} />}

        {/* Project Detail View */}
        {selectedProjectId && (() => {
          const project = projects.find(p => p.id === selectedProjectId)
          if (!project) return null
          const client = clients.find(c => c.id === project.client_id)
          const cos = projects.filter(p => p.parent_id === selectedProjectId && p.is_change_order)
          return (
            <ProjectDetailView project={project} client={client} timesheets={timesheets} expenses={expenses} invoices={invoices}
              teamMembers={teamMembers} changeOrders={cos}
              onClose={() => setSelectedProjectId(null)}
              onEdit={() => { setSelectedProjectId(null); openEditProject(project) }}
            />
          )
        })()}
      </div>

      {/* Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg mx-4 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">
                {editingProject ? 'Edit Project' : isAddingCO ? `Add Change Order — ${coParentName}` : 'Add Project'}
              </h2>
              <button onClick={() => { setShowProjectModal(false); resetForm() }} className="p-1 hover:bg-slate-100 rounded"><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{isAddingCO ? 'Change Order Name' : 'Project Name'}</label>
                <input value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} className={'bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none w-full px-3 py-2'} placeholder={isAddingCO ? 'CO-001: Scope Change' : 'Project Name'} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Client</label>
                <select value={formData.client_id} onChange={e => setFormData(prev => ({ ...prev, client_id: e.target.value }))} className={'bg-white border border-slate-200 rounded-lg text-sm text-slate-900 px-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none w-full py-2'}>
                  <option value="">Select client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Budget</label>
                  <input type="number" value={formData.budget} onChange={e => setFormData(prev => ({ ...prev, budget: e.target.value }))} className={'bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none w-full px-3 py-2'} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Spent</label>
                  <input type="number" value={formData.spent} onChange={e => setFormData(prev => ({ ...prev, spent: e.target.value }))} className={'bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none w-full px-3 py-2'} placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Budgeted Hours</label>
                  <input type="number" value={formData.budgeted_hours} onChange={e => setFormData(prev => ({ ...prev, budgeted_hours: e.target.value }))} className={'bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none w-full px-3 py-2'} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">% Complete</label>
                  <input type="number" value={formData.percent_complete} onChange={e => setFormData(prev => ({ ...prev, percent_complete: e.target.value }))} className={'bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none w-full px-3 py-2'} placeholder="0" min="0" max="100" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Start Date</label>
                  <input type="date" value={formData.start_date} onChange={e => setFormData(prev => ({ ...prev, start_date: e.target.value }))} className={'bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none w-full px-3 py-2'} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">End Date</label>
                  <input type="date" value={formData.end_date} onChange={e => setFormData(prev => ({ ...prev, end_date: e.target.value }))} className={'bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none w-full px-3 py-2'} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(PROJECT_STATUSES).map(([statusId, s]) => (
                      <button key={statusId} onClick={() => setFormData(prev => ({ ...prev, status: statusId }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          formData.status === statusId ? `${s.bg} ${s.text} border ${s.border}` : 'bg-slate-50 text-slate-400 border border-slate-200 hover:bg-slate-100'
                        }`}>{s.label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Budget Type</label>
                  <select value={formData.budget_type} onChange={e => setFormData(prev => ({ ...prev, budget_type: e.target.value }))} className={'bg-white border border-slate-200 rounded-lg text-sm text-slate-900 px-3 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none w-full py-2'}>
                    <option value="fixed">Fixed Price</option>
                    <option value="time_and_materials">Time & Materials</option>
                    <option value="retainer">Retainer</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => { setShowProjectModal(false); resetForm() }} className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm">
                {editingProject ? 'Save Changes' : isAddingCO ? 'Add Change Order' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
