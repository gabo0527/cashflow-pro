import { explicitContractorProjects } from './contractor-project-access'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isTimeAndMaterials } from './timesheet-daily'

// Match the portal: only explicitly assigned projects are permitted.
// The server resolves these itself; the browser cannot opt out of T&M rules.
export async function contractorTimesheetProjects(supabase: SupabaseClient, contractorId: string) {
  const [memberResult, projectResult, assignmentResult, rateResult] = await Promise.all([
    supabase.from('team_members').select('id, company_id, status').eq('id', contractorId).single(),
    supabase.from('projects').select('id, name, client_id, company_id, status, is_active').eq('status', 'active'),
    supabase.from('team_project_assignments').select('project_id, payment_type, rate, bill_rate, company_id, is_active').eq('team_member_id', contractorId),
    supabase.from('bill_rates').select('client_id, cost_type, rate').eq('team_member_id', contractorId).eq('is_active', true),
  ])
  for (const result of [memberResult, projectResult, assignmentResult, rateResult]) {
    if (result.error) throw new Error('Unable to verify timesheet assignments')
  }
  const member = memberResult.data
  if (!member || member.status !== 'active') throw new Error('Contractor is not active')
  const projects = projectResult.data || []
  const rates = new Map((rateResult.data || []).map(rate => [rate.client_id, rate]))
  const permitted = new Map<string, { project_id: string; name: string; required: boolean; rate: number }>()
  const allowed = new Set(explicitContractorProjects(projects, assignmentResult.data || [], member.company_id).map(p => p.id))
  for (const assignment of assignmentResult.data || []) {
    const project = projects.find(project => project.id === assignment.project_id)
    if (!project || !allowed.has(project.id)) continue
    const clientRate = rates.get(project.client_id)
    const type = clientRate?.cost_type === 'hourly' ? 'tm' : (assignment.payment_type || 'tm')
    permitted.set(project.id, {
      project_id: project.id, name: project.name,
      required: isTimeAndMaterials(type),
      rate: clientRate?.rate || assignment.bill_rate || assignment.rate || 0,
    })
  }

  return { member, permitted }
}
