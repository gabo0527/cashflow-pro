// A client rate card supplies pricing, never project access. Use this resolver
// for both the portal options and the server's submission checks.
export function explicitContractorProjects(projects: any[], assignments: any[], companyId: string | null) {
  const assignedIds = new Set(assignments.filter(a => a.is_active === true &&
    (!companyId || a.company_id === companyId)).map(a => a.project_id))
  return projects.filter(p => p.status === 'active' && p.is_active === true &&
    (!companyId || p.company_id === companyId) && assignedIds.has(p.id))
}
