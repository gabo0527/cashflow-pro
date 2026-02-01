export const PERMISSION_MATRIX: Record<string, { label: string; description: string; color: string; access: string[] }> = {
  owner:    { label: 'Owner',    description: 'Full access, can delete company',    color: 'text-purple-400',  access: ['dashboard','cash_flow','invoices','expenses','time_tracking','team','projects','clients','reports','forecast','sage','settings'] },
  admin:    { label: 'Admin',    description: 'Full access except billing & delete', color: 'text-emerald-400', access: ['dashboard','cash_flow','invoices','expenses','time_tracking','team','projects','clients','reports','forecast','sage','settings'] },
  member:   { label: 'Member',   description: 'Can edit data, view reports',         color: 'text-blue-400',    access: ['dashboard','invoices','expenses','time_tracking','projects','reports'] },
  viewer:   { label: 'Viewer',   description: 'Read-only access to dashboards',      color: 'text-slate-400',   access: ['dashboard','reports'] },
  employee: { label: 'Employee', description: 'Timesheet & expenses only',           color: 'text-amber-400',   access: ['timesheet','expenses_submit'] },
}
