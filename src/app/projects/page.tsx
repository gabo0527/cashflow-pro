'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Download, X, BarChart3, List, Target, Upload } from 'lucide-react'
import {
  BLUEPRINT, PROJECT_STATUSES, THEME,
  calcProjectRevenue, buildRateLookups, getContractLabel, todayISO,
} from '@/components/projects/shared'
import DashboardSection from '@/components/projects/DashboardSection'
import ProjectsSection, { ProjectsSectionHandle } from '@/components/projects/ProjectsSection'
import ImportSection from '@/components/projects/ImportSection'
import ProjectDetailView from '@/components/projects/ProjectDetailView'

const AR = { fontFamily: BLUEPRINT.fontDisplay }
const inputCls = 'bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-blue-500/40 focus:border-blue-400 outline-none w-full px-3 py-2'

export default function ProjectsPage() {
  const projectsSectionRef = useRef<ProjectsSectionHandle>(null)

  const [activeTab, setActiveTab] = useState<'dashboard' | 'projects' | 'pipeline' | 'import'>('dashboard')
  const [projects, setProjects] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [timesheets, setTimesheets] = useState<any[]>([])
  const [billRates, setBillRates] = useState<any[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [showProjectModal, setShowProjectModal] = useState(false)
  const [editingProject, setEditingProject] = useState<any>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [isAddingCO, setIsAddingCO] = useState(false)
  const [coParentId, setCoParentId] = useState<string | null>(null)
  const [coParentName, setCoParentName] = useState('')

  const emptyForm = { name: '', client_id: '', budget: '', spent: '', budgeted_hours: '', percent_complete: '', status: 'active', start_date: '', end_date: '', budget_type: 'fixed', description: '', billing_model: 'per_resource', bill_rate: '', fixed_amount: '' }
  const [formData, setFormData] = useState(emptyForm)

  const companyId = projects.find(p => p.company_id)?.company_id || null

  const loadData = useCallback(async () => {
    try {
      // Dead QBO-era `invoices` and cost-side `expenses` queries removed —
      // revenue comes from the recognition engine (LS fees + hours × rates).
      const [pRes, cRes, tmRes, tsRes, brRes, aRes] = await Promise.all([
        supabase.from('projects').select('*').order('name'),
        supabase.from('clients').select('*').order('name'),
        supabase.from('team_members').select('*'),
        supabase.from('time_entries').select('*'),
        supabase.from('bill_rates').select('*'),
        supabase.from('team_project_assignments').select('*'),
      ])
      setProjects((pRes.data || []).map(p => ({
        ...p,
        budget: parseFloat(p.budget) || 0,
        spent: parseFloat(p.spent) || 0,
        budgeted_hours: parseFloat(p.budgeted_hours) || 0,
        percent_complete: parseFloat(p.percent_complete) || 0,
        fixed_amount: parseFloat(p.fixed_amount) || 0,
      })))
      setClients(cRes.data || [])
      setTeamMembers(tmRes.data || [])
      setTimesheets(tsRes.data || [])
      setBillRates(brRes.data || [])
      setAssignments(aRes.data || [])
    } catch (err) { console.error(err) } finally { setLoading(false) }
  }, [])

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
      billing_model: project.billing_model || 'per_resource', bill_rate: project.bill_rate?.toString() || '', fixed_amount: project.fixed_amount?.toString() || '',
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

  const isLSForm = formData.budget_type === 'fixed' || formData.budget_type === 'retainer' || formData.billing_model === 'fixed'

  const handleSave = async () => {
    try {
      // Completed projects file into client History by end-date year —
      // an end date is required to close them into the right year.
      if (formData.status === 'completed' && !formData.end_date) {
        const todayStr = todayISO()
        if (!confirm(`Completed projects need an end date to file into the client's yearly history.\n\nUse today (${todayStr}) as the end date?`)) {
          return
        }
        formData.end_date = todayStr
      }
      // Lump sum recognition can't reconcile without an end date — warn, allow override
      if (isLSForm && parseFloat(formData.fixed_amount) > 0 && !formData.end_date) {
        if (!confirm('This lump-sum scope has a monthly fee but no End Date.\n\nWithout one, revenue recognition runs open-ended and the scope will be flagged on the dashboard.\n\nSave anyway?')) return
      }
      const payload: any = {
        name: formData.name, client_id: formData.client_id || null,
        budget: parseFloat(formData.budget) || 0, spent: parseFloat(formData.spent) || 0,
        budgeted_hours: parseFloat(formData.budgeted_hours) || 0,
        percent_complete: parseFloat(formData.percent_complete) || 0,
        status: formData.status, start_date: formData.start_date || null, end_date: formData.end_date || null,
        budget_type: formData.budget_type, description: formData.description,
        billing_model: formData.billing_model, bill_rate: parseFloat(formData.bill_rate) || null, fixed_amount: parseFloat(formData.fixed_amount) || null,
      }
      if (isAddingCO && coParentId) { payload.parent_id = coParentId; payload.is_change_order = true }
      if (editingProject) {
        const { error } = await supabase.from('projects').update(payload).eq('id', editingProject.id)
        if (error) { console.error('Update error:', error); alert(`Error: ${error.message}`); return }
      } else {
        if (companyId) payload.company_id = companyId
        const { error } = await supabase.from('projects').insert(payload).select().single()
        if (error) { console.error('Insert error:', error); alert(`Error: ${error.message}`); return }
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

  // Revenue-based CSV — Spent/Margin removed
  const handleExport = () => {
    const { rateCardLookup, assignmentLookup } = buildRateLookups(billRates, assignments)
    const entriesByProject: Record<string, any[]> = {}
    timesheets.forEach(t => { (entriesByProject[t.project_id] = entriesByProject[t.project_id] || []).push(t) })
    const csv = ['Name,Client,Status,Type,Basis,Recognized,Hours,Start,End',
      ...projects.filter(p => !p.is_change_order).map(p => {
        const client = clients.find(c => c.id === p.client_id)?.name || ''
        const rev = calcProjectRevenue(p, entriesByProject[p.id] || [], rateCardLookup, assignmentLookup)
        return `"${p.name}","${client}",${p.status},${getContractLabel(rev.type)},"${rev.basisLabel}",${rev.recognized.toFixed(2)},${rev.hours.toFixed(1)},${p.start_date || ''},${p.end_date || ''}`
      })
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'projects-revenue.csv'; a.click()
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
        {/* HEADER — Blueprint banner */}
        <div className="rounded-2xl px-6 py-5 mb-6 relative overflow-hidden flex items-center justify-between" style={{ background: BLUEPRINT.midnight }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 8px)' }} />
          <div className="relative">
            <div className="text-[10px] font-bold uppercase" style={{ ...AR, letterSpacing: '0.16em', color: '#93c5fd' }}>Portfolio</div>
            <h1 className="text-white text-[26px] font-extrabold uppercase tracking-wide mt-1" style={AR}>Projects</h1>
            <p className="text-[13px] text-slate-400 mt-0.5">Revenue recognized monthly, as earned — never before</p>
          </div>
          <div className="relative flex items-center gap-2.5">
            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors hover:bg-white/20" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <Download size={15} /> Export
            </button>
            <button onClick={openAddProject} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:-translate-y-px" style={{ background: BLUEPRINT.blue }}>
              <Plus size={15} /> Add Project
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="flex items-center gap-0 border-b border-slate-200 mb-6">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all"
              style={activeTab === tab.id ? { color: BLUEPRINT.blue, borderColor: BLUEPRINT.blue } : { color: '#94a3b8', borderColor: 'transparent' }}>
              <tab.icon size={16} />
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full font-bold" style={activeTab === tab.id ? { background: BLUEPRINT.blueSoft, color: BLUEPRINT.blue } : { background: '#f1f5f9', color: '#64748b' }}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* TAB CONTENT */}
        {activeTab === 'dashboard' && <DashboardSection projects={projects} clients={clients} timesheets={timesheets} billRates={billRates} assignments={assignments} onDrillDown={handleDrillDown} />}
        {activeTab === 'projects' && <ProjectsSection ref={projectsSectionRef} projects={projects} clients={clients} timesheets={timesheets} billRates={billRates} assignments={assignments} onAddProject={openAddProject} onEditProject={openEditProject} onDeleteProject={handleDeleteProject} onAddChangeOrder={openAddChangeOrder} onViewProject={handleViewProject} />}
        {activeTab === 'pipeline' && <ProjectsSection ref={projectsSectionRef} projects={projects.filter(p => p.status === 'prospect')} clients={clients} timesheets={timesheets} billRates={billRates} assignments={assignments} onAddProject={() => { resetForm(); setFormData(prev => ({ ...prev, status: 'prospect' })); setShowProjectModal(true) }} onEditProject={openEditProject} onDeleteProject={handleDeleteProject} onAddChangeOrder={openAddChangeOrder} onViewProject={handleViewProject} />}
        {activeTab === 'import' && <ImportSection projects={projects} clients={clients} teamMembers={teamMembers} onImportProjects={handleImportProjects} onImportBudgets={handleImportBudgets} onImportResources={handleImportResources} />}

        {/* Project Detail View */}
        {selectedProjectId && (() => {
          const project = projects.find(p => p.id === selectedProjectId)
          if (!project) return null
          const client = clients.find(c => c.id === project.client_id)
          const cos = projects.filter(p => p.parent_id === selectedProjectId && p.is_change_order)
          return (
            <ProjectDetailView project={project} client={client} timesheets={timesheets}
              teamMembers={teamMembers} changeOrders={cos} billRates={billRates} assignments={assignments}
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
              <h2 className="text-base font-bold text-slate-900" style={AR}>
                {editingProject ? 'Edit Project' : isAddingCO ? `Add Change Order — ${coParentName}` : 'Add Project'}
              </h2>
              <button onClick={() => { setShowProjectModal(false); resetForm() }} className="p-1 hover:bg-slate-100 rounded"><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">{isAddingCO ? 'Change Order Name' : 'Project Name'}</label>
                <input value={formData.name} onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))} className={inputCls} placeholder={isAddingCO ? 'CO-001: Scope Change' : 'Project Name'} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Client</label>
                <select value={formData.client_id} onChange={e => setFormData(prev => ({ ...prev, client_id: e.target.value }))} className={inputCls}>
                  <option value="">Select client</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Contract Type</label>
                  <select value={formData.budget_type} onChange={e => setFormData(prev => ({ ...prev, budget_type: e.target.value }))} className={inputCls}>
                    <option value="fixed">Lump Sum</option>
                    <option value="time_and_materials">Time & Materials</option>
                    <option value="retainer">Retainer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Billing Model</label>
                  <select value={formData.billing_model} onChange={e => setFormData(prev => ({ ...prev, billing_model: e.target.value }))} className={inputCls}>
                    <option value="per_resource">Per Resource — rate cards</option>
                    <option value="per_scope">Per Scope — one rate</option>
                    <option value="fixed">Fixed — monthly fee</option>
                  </select>
                </div>
              </div>
              {formData.billing_model === 'per_scope' && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Scope Rate ($/hr)</label>
                  <input type="number" value={formData.bill_rate} onChange={e => setFormData(prev => ({ ...prev, bill_rate: e.target.value }))} placeholder="e.g. 185" className={inputCls} />
                  <p className="text-[11px] text-slate-400 mt-1">All billable hours on this project bill at this rate, regardless of who logs them.</p>
                </div>
              )}
              {isLSForm && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Monthly Fee ($/mo)</label>
                  <input type="number" value={formData.fixed_amount} onChange={e => setFormData(prev => ({ ...prev, fixed_amount: e.target.value }))} placeholder="e.g. 14000" className={inputCls} />
                  <p className="text-[11px] text-slate-400 mt-1">Enter the <b>monthly</b> fee, not the total contract. Recognized in full each month once the month starts; recognition stops at the End Date.</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Start Date</label>
                  <input type="date" value={formData.start_date} onChange={e => setFormData(prev => ({ ...prev, start_date: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">End Date {isLSForm && <span className="text-amber-600 font-semibold">· required for LS to reconcile</span>}</label>
                  <input type="date" value={formData.end_date} onChange={e => setFormData(prev => ({ ...prev, end_date: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Contract Value / NTE (optional)</label>
                  <input type="number" value={formData.budget} onChange={e => setFormData(prev => ({ ...prev, budget: e.target.value }))} className={inputCls} placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Budgeted Hours (optional)</label>
                  <input type="number" value={formData.budgeted_hours} onChange={e => setFormData(prev => ({ ...prev, budgeted_hours: e.target.value }))} className={inputCls} placeholder="0" />
                </div>
              </div>
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
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => { setShowProjectModal(false); resetForm() }} className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700">Cancel</button>
              <button onClick={handleSave} className="px-4 py-2 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm" style={{ background: BLUEPRINT.blue }}>
                {editingProject ? 'Save Changes' : isAddingCO ? 'Add Change Order' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
