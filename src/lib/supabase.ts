import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ============ TYPES ============

export interface Company {
  id: string
  name: string
  owner_id: string
  created_at: string
}

export interface Client {
  id: string
  company_id: string
  user_id?: string
  name: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  status: 'active' | 'inactive' | 'prospect' | 'paused'
  notes?: string
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  company_id: string
  user_id?: string
  client_id?: string
  name: string
  color: string
  status: 'active' | 'in-progress' | 'completed' | 'on-hold' | 'archived'
  budget?: number
  budget_alert_threshold?: number
  target_gross_margin?: number
  start_date?: string
  end_date?: string
  year?: number
  created_at: string
}

export interface Transaction {
  id: string
  company_id: string
  client_id?: string
  project_id?: string
  qb_id?: string
  sync_source?: string
  synced_at?: string
  date: string
  description: string
  amount: number
  payee?: string
  qb_category?: string
  category: string
  subcategory?: string
  type: 'actual' | 'budget'
  project?: string  // Legacy text field
  client?: string   // Legacy text field
  account_name?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface Invoice {
  id: string
  company_id: string
  client_id?: string
  project_id?: string
  qb_invoice_id?: string
  invoice_number?: string
  customer_project_raw?: string
  client?: string   // Legacy text field
  project?: string  // Legacy text field
  amount: number
  amount_paid?: number
  balance_due?: number
  invoice_date?: string
  due_date?: string
  paid_date?: string
  status: 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'void'
  status_detail?: string
  days_overdue?: number
  sync_source?: string
  synced_at?: string
  created_at: string
  updated_at: string
}

export interface Contractor {
  id: string
  company_id: string
  name: string
  email?: string
  type: 'contractor' | 'employee' | 'freelancer'
  default_bill_rate?: number
  default_cost_rate?: number
  status: 'active' | 'inactive' | 'paused'
  created_at: string
  updated_at: string
}

export interface TimeEntry {
  id: string
  company_id: string
  project_id?: string
  client_id?: string
  user_id?: string
  contractor_id?: string
  date: string
  hours: number
  billable: boolean
  bill_rate?: number
  cost_rate?: number
  description?: string
  status: 'pending' | 'approved' | 'invoiced'
  created_at: string
  updated_at: string
}

export interface ProjectCost {
  id: string
  company_id: string
  project_id?: string
  client_id?: string
  contractor_id?: string
  date: string
  amount: number
  description?: string
  category?: string  // labor, materials, software, travel, etc.
  status: 'pending' | 'paid'
  created_at: string
}

export interface Assumption {
  id: string
  company_id: string
  user_id?: string
  name: string
  category: string
  amount: number
  value_type: 'amount' | 'percentage'
  percent_of?: string
  frequency: 'monthly' | 'quarterly' | 'annually' | 'one-time'
  start_date: string
  end_date?: string
  project?: string
  scenario_id?: string
  created_at: string
}

export interface Category {
  id: string
  company_id: string
  category_id: string
  name: string
  type: 'income' | 'expense'
  color: string
  is_default: boolean
  created_at: string
}

export interface CompanySettings {
  id: string
  company_id: string
  company_name?: string
  beginning_balance?: number
  brand_color?: string
  company_logo?: string
  company_logo_light?: string
  cutoff_date?: string
  balance_alert_threshold?: number
  qbo_realm_id?: string
  qbo_access_token?: string
  qbo_refresh_token?: string
  qbo_token_expires_at?: string
  qbo_connected_at?: string
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  email: string
  full_name?: string
  role?: string
  company_id?: string
  created_at: string
  updated_at: string
}

// ============ AUTH FUNCTIONS ============

export const signOut = async () => {
  return await supabase.auth.signOut()
}

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return { user }
}

export const getCurrentProfile = async () => {
  const { user } = await getCurrentUser()
  if (!user) return { profile: null }
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return { profile: data as Profile | null }
}

// ============ HELPER FUNCTIONS ============

// Helper to fetch all records with pagination (Supabase default limit is 1000)
const fetchAllPaginated = async (
  table: string, 
  companyId?: string, 
  orderColumn: string = 'date',
  ascending: boolean = false
): Promise<{ data: any[] | null; error: any }> => {
  const pageSize = 1000
  let allData: any[] = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    let query = supabase
      .from(table)
      .select('*')
      .order(orderColumn, { ascending })
      .range(from, from + pageSize - 1)
    
    if (companyId) {
      query = query.eq('company_id', companyId)
    }

    const { data, error } = await query

    if (error) {
      return { data: null, error }
    }

    if (data && data.length > 0) {
      allData = [...allData, ...data]
      from += pageSize
      hasMore = data.length === pageSize
    } else {
      hasMore = false
    }
  }

  return { data: allData, error: null }
}

// ============ TRANSACTIONS ============

export const fetchTransactions = async (companyId?: string) => {
  return await fetchAllPaginated('transactions', companyId, 'date', false)
}

export const insertTransaction = async (transaction: any, companyId?: string, userId?: string) => {
  const toInsert = {
    ...transaction,
    company_id: companyId,
    user_id: userId
  }
  const { data, error } = await supabase.from('transactions').insert(toInsert).select().single()
  return { data, error }
}

export const updateTransaction = async (id: string, updates: any) => {
  const { data, error } = await supabase.from('transactions').update(updates).eq('id', id).select().single()
  return { data, error }
}

export const deleteTransaction = async (id: string) => {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  return { error }
}

export const bulkInsertTransactions = async (transactions: any[], companyId?: string, userId?: string) => {
  const toInsert = transactions.map(t => ({
    ...t,
    company_id: companyId,
    user_id: userId
  }))
  const { data, error } = await supabase.from('transactions').insert(toInsert).select()
  return { data, error }
}

export const deleteAllTransactions = async (companyId?: string) => {
  let query = supabase.from('transactions').delete()
  if (companyId) {
    query = query.eq('company_id', companyId)
  } else {
    query = query.neq('id', '')
  }
  const { error } = await query
  return { error }
}

// ============ INVOICES ============

export const fetchInvoices = async (companyId?: string) => {
  return await fetchAllPaginated('invoices', companyId, 'invoice_date', false)
}

export const insertInvoice = async (invoice: any, companyId?: string) => {
  const toInsert = {
    ...invoice,
    company_id: companyId
  }
  const { data, error } = await supabase.from('invoices').insert(toInsert).select().single()
  return { data, error }
}

export const updateInvoice = async (id: string, updates: any) => {
  const { data, error } = await supabase.from('invoices').update(updates).eq('id', id).select().single()
  return { data, error }
}

export const deleteInvoice = async (id: string) => {
  const { error } = await supabase.from('invoices').delete().eq('id', id)
  return { error }
}

export const bulkUpsertInvoices = async (invoices: any[], companyId?: string) => {
  const toUpsert = invoices.map(inv => ({
    ...inv,
    company_id: companyId
  }))
  const { data, error } = await supabase
    .from('invoices')
    .upsert(toUpsert, { onConflict: 'qb_invoice_id' })
    .select()
  return { data, error }
}

// ============ CONTRACTORS ============

export const fetchContractors = async (companyId?: string) => {
  let query = supabase.from('contractors').select('*').order('name', { ascending: true })
  if (companyId) query = query.eq('company_id', companyId)
  const { data, error } = await query
  return { data: data as Contractor[] | null, error }
}

export const insertContractor = async (contractor: any, companyId?: string) => {
  const toInsert = {
    name: contractor.name,
    email: contractor.email || null,
    type: contractor.type || 'contractor',
    default_bill_rate: contractor.defaultBillRate || contractor.default_bill_rate || null,
    default_cost_rate: contractor.defaultCostRate || contractor.default_cost_rate || null,
    status: contractor.status || 'active',
    company_id: companyId
  }
  const { data, error } = await supabase.from('contractors').insert(toInsert).select().single()
  return { data, error }
}

export const updateContractor = async (id: string, updates: any) => {
  const dbUpdates: any = {}
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.email !== undefined) dbUpdates.email = updates.email
  if (updates.type !== undefined) dbUpdates.type = updates.type
  if (updates.defaultBillRate !== undefined) dbUpdates.default_bill_rate = updates.defaultBillRate
  if (updates.defaultCostRate !== undefined) dbUpdates.default_cost_rate = updates.defaultCostRate
  if (updates.default_bill_rate !== undefined) dbUpdates.default_bill_rate = updates.default_bill_rate
  if (updates.default_cost_rate !== undefined) dbUpdates.default_cost_rate = updates.default_cost_rate
  if (updates.status !== undefined) dbUpdates.status = updates.status
  dbUpdates.updated_at = new Date().toISOString()
  
  const { data, error } = await supabase.from('contractors').update(dbUpdates).eq('id', id).select().single()
  return { data, error }
}

export const deleteContractor = async (id: string) => {
  const { error } = await supabase.from('contractors').delete().eq('id', id)
  return { error }
}

// ============ TIME ENTRIES ============

export const fetchTimeEntries = async (companyId?: string, filters?: { projectId?: string; contractorId?: string; startDate?: string; endDate?: string }) => {
  let query = supabase.from('time_entries').select('*').order('date', { ascending: false })
  
  if (companyId) query = query.eq('company_id', companyId)
  if (filters?.projectId) query = query.eq('project_id', filters.projectId)
  if (filters?.contractorId) query = query.eq('contractor_id', filters.contractorId)
  if (filters?.startDate) query = query.gte('date', filters.startDate)
  if (filters?.endDate) query = query.lte('date', filters.endDate)
  
  const { data, error } = await query
  return { data: data as TimeEntry[] | null, error }
}

export const insertTimeEntry = async (entry: any, companyId?: string, userId?: string) => {
  const toInsert = {
    company_id: companyId,
    project_id: entry.projectId || entry.project_id || null,
    client_id: entry.clientId || entry.client_id || null,
    user_id: userId,
    contractor_id: entry.contractorId || entry.contractor_id || null,
    date: entry.date,
    hours: entry.hours,
    billable: entry.billable ?? true,
    bill_rate: entry.billRate || entry.bill_rate || null,
    cost_rate: entry.costRate || entry.cost_rate || null,
    description: entry.description || null,
    status: entry.status || 'pending'
  }
  const { data, error } = await supabase.from('time_entries').insert(toInsert).select().single()
  return { data, error }
}

export const updateTimeEntry = async (id: string, updates: any) => {
  const dbUpdates: any = {}
  if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId
  if (updates.project_id !== undefined) dbUpdates.project_id = updates.project_id
  if (updates.clientId !== undefined) dbUpdates.client_id = updates.clientId
  if (updates.client_id !== undefined) dbUpdates.client_id = updates.client_id
  if (updates.contractorId !== undefined) dbUpdates.contractor_id = updates.contractorId
  if (updates.contractor_id !== undefined) dbUpdates.contractor_id = updates.contractor_id
  if (updates.date !== undefined) dbUpdates.date = updates.date
  if (updates.hours !== undefined) dbUpdates.hours = updates.hours
  if (updates.billable !== undefined) dbUpdates.billable = updates.billable
  if (updates.billRate !== undefined) dbUpdates.bill_rate = updates.billRate
  if (updates.bill_rate !== undefined) dbUpdates.bill_rate = updates.bill_rate
  if (updates.costRate !== undefined) dbUpdates.cost_rate = updates.costRate
  if (updates.cost_rate !== undefined) dbUpdates.cost_rate = updates.cost_rate
  if (updates.description !== undefined) dbUpdates.description = updates.description
  if (updates.status !== undefined) dbUpdates.status = updates.status
  dbUpdates.updated_at = new Date().toISOString()
  
  const { data, error } = await supabase.from('time_entries').update(dbUpdates).eq('id', id).select().single()
  return { data, error }
}

export const deleteTimeEntry = async (id: string) => {
  const { error } = await supabase.from('time_entries').delete().eq('id', id)
  return { error }
}

export const bulkInsertTimeEntries = async (entries: any[], companyId?: string, userId?: string) => {
  const toInsert = entries.map(e => ({
    company_id: companyId,
    project_id: e.projectId || e.project_id || null,
    client_id: e.clientId || e.client_id || null,
    user_id: userId,
    contractor_id: e.contractorId || e.contractor_id || null,
    date: e.date,
    hours: e.hours,
    billable: e.billable ?? true,
    bill_rate: e.billRate || e.bill_rate || null,
    cost_rate: e.costRate || e.cost_rate || null,
    description: e.description || null,
    status: e.status || 'pending'
  }))
  const { data, error } = await supabase.from('time_entries').insert(toInsert).select()
  return { data, error }
}

// ============ PROJECT COSTS ============

export const fetchProjectCosts = async (companyId?: string, filters?: { projectId?: string; contractorId?: string }) => {
  let query = supabase.from('project_costs').select('*').order('date', { ascending: false })
  
  if (companyId) query = query.eq('company_id', companyId)
  if (filters?.projectId) query = query.eq('project_id', filters.projectId)
  if (filters?.contractorId) query = query.eq('contractor_id', filters.contractorId)
  
  const { data, error } = await query
  return { data: data as ProjectCost[] | null, error }
}

export const insertProjectCost = async (cost: any, companyId?: string) => {
  const toInsert = {
    company_id: companyId,
    project_id: cost.projectId || cost.project_id || null,
    client_id: cost.clientId || cost.client_id || null,
    contractor_id: cost.contractorId || cost.contractor_id || null,
    date: cost.date,
    amount: cost.amount,
    description: cost.description || null,
    category: cost.category || null,
    status: cost.status || 'pending'
  }
  const { data, error } = await supabase.from('project_costs').insert(toInsert).select().single()
  return { data, error }
}

export const updateProjectCost = async (id: string, updates: any) => {
  const dbUpdates: any = {}
  if (updates.projectId !== undefined) dbUpdates.project_id = updates.projectId
  if (updates.project_id !== undefined) dbUpdates.project_id = updates.project_id
  if (updates.clientId !== undefined) dbUpdates.client_id = updates.clientId
  if (updates.client_id !== undefined) dbUpdates.client_id = updates.client_id
  if (updates.contractorId !== undefined) dbUpdates.contractor_id = updates.contractorId
  if (updates.contractor_id !== undefined) dbUpdates.contractor_id = updates.contractor_id
  if (updates.date !== undefined) dbUpdates.date = updates.date
  if (updates.amount !== undefined) dbUpdates.amount = updates.amount
  if (updates.description !== undefined) dbUpdates.description = updates.description
  if (updates.category !== undefined) dbUpdates.category = updates.category
  if (updates.status !== undefined) dbUpdates.status = updates.status
  
  const { data, error } = await supabase.from('project_costs').update(dbUpdates).eq('id', id).select().single()
  return { data, error }
}

export const deleteProjectCost = async (id: string) => {
  const { error } = await supabase.from('project_costs').delete().eq('id', id)
  return { error }
}

// ============ PROJECTS ============

export const fetchProjects = async (companyId?: string) => {
  let query = supabase.from('projects').select('*').order('name', { ascending: true })
  if (companyId) query = query.eq('company_id', companyId)
  const { data, error } = await query
  return { data: data as Project[] | null, error }
}

export const fetchProjectsWithClient = async (companyId?: string) => {
  let query = supabase
    .from('projects')
    .select(`
      *,
      client:clients(id, name, status)
    `)
    .order('name', { ascending: true })
  if (companyId) query = query.eq('company_id', companyId)
  const { data, error } = await query
  return { data, error }
}

export const insertProject = async (project: any, companyId?: string, userId?: string) => {
  const toInsert = {
    name: project.name,
    color: project.color || '#00d4aa',
    status: project.status || 'active',
    budget: project.budget || null,
    budget_alert_threshold: project.budgetAlertThreshold || project.budget_alert_threshold || 80,
    client_id: project.clientId || project.client_id || null,
    target_gross_margin: project.targetGrossMargin || project.target_gross_margin || null,
    start_date: project.startDate || project.start_date || null,
    end_date: project.endDate || project.end_date || null,
    year: project.year || null,
    company_id: companyId,
    user_id: userId
  }
  const { data, error } = await supabase.from('projects').insert(toInsert).select().single()
  return { data, error }
}

export const updateProject = async (id: string, updates: any) => {
  const dbUpdates: any = {}
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.color !== undefined) dbUpdates.color = updates.color
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.budget !== undefined) dbUpdates.budget = updates.budget
  if (updates.budgetAlertThreshold !== undefined) dbUpdates.budget_alert_threshold = updates.budgetAlertThreshold
  if (updates.budget_alert_threshold !== undefined) dbUpdates.budget_alert_threshold = updates.budget_alert_threshold
  if (updates.clientId !== undefined) dbUpdates.client_id = updates.clientId || null
  if (updates.client_id !== undefined) dbUpdates.client_id = updates.client_id || null
  if (updates.targetGrossMargin !== undefined) dbUpdates.target_gross_margin = updates.targetGrossMargin
  if (updates.target_gross_margin !== undefined) dbUpdates.target_gross_margin = updates.target_gross_margin
  if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate
  if (updates.start_date !== undefined) dbUpdates.start_date = updates.start_date
  if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate
  if (updates.end_date !== undefined) dbUpdates.end_date = updates.end_date
  if (updates.year !== undefined) dbUpdates.year = updates.year || null
  
  const { data, error } = await supabase.from('projects').update(dbUpdates).eq('id', id).select().single()
  return { data, error }
}

export const deleteProject = async (id: string) => {
  const { error } = await supabase.from('projects').delete().eq('id', id)
  return { error }
}

// ============ CLIENTS ============

export const fetchClients = async (companyId?: string) => {
  let query = supabase.from('clients').select('*').order('name', { ascending: true })
  if (companyId) query = query.eq('company_id', companyId)
  const { data, error } = await query
  return { data: data as Client[] | null, error }
}

export const fetchClientsWithProjects = async (companyId?: string) => {
  let query = supabase
    .from('clients')
    .select(`
      *,
      projects:projects(id, name, status, budget)
    `)
    .order('name', { ascending: true })
  if (companyId) query = query.eq('company_id', companyId)
  const { data, error } = await query
  return { data, error }
}

export const insertClient = async (client: any, companyId?: string, userId?: string) => {
  const toInsert = {
    name: client.name,
    contact_name: client.contactName || client.contact_name || null,
    contact_email: client.contactEmail || client.contact_email || null,
    contact_phone: client.contactPhone || client.contact_phone || null,
    status: client.status || 'active',
    notes: client.notes || null,
    company_id: companyId,
    user_id: userId
  }
  const { data, error } = await supabase.from('clients').insert(toInsert).select().single()
  return { data, error }
}

export const updateClient = async (id: string, updates: any) => {
  const dbUpdates: any = {}
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.contactName !== undefined) dbUpdates.contact_name = updates.contactName
  if (updates.contact_name !== undefined) dbUpdates.contact_name = updates.contact_name
  if (updates.contactEmail !== undefined) dbUpdates.contact_email = updates.contactEmail
  if (updates.contact_email !== undefined) dbUpdates.contact_email = updates.contact_email
  if (updates.contactPhone !== undefined) dbUpdates.contact_phone = updates.contactPhone
  if (updates.contact_phone !== undefined) dbUpdates.contact_phone = updates.contact_phone
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes
  dbUpdates.updated_at = new Date().toISOString()
  
  const { data, error } = await supabase.from('clients').update(dbUpdates).eq('id', id).select().single()
  return { data, error }
}

export const deleteClient = async (id: string) => {
  const { error } = await supabase.from('clients').delete().eq('id', id)
  return { error }
}

// ============ ASSUMPTIONS ============

export const fetchAssumptions = async (companyId?: string) => {
  let query = supabase.from('assumptions').select('*').order('created_at', { ascending: false })
  if (companyId) query = query.eq('company_id', companyId)
  const { data, error } = await query
  return { data: data as Assumption[] | null, error }
}

export const insertAssumption = async (assumption: any, companyId?: string, userId?: string) => {
  const toInsert = {
    ...assumption,
    company_id: companyId,
    user_id: userId
  }
  const { data, error } = await supabase.from('assumptions').insert(toInsert).select().single()
  return { data, error }
}

export const updateAssumption = async (id: string, updates: any) => {
  const { data, error } = await supabase.from('assumptions').update(updates).eq('id', id).select().single()
  return { data, error }
}

export const deleteAssumption = async (id: string) => {
  const { error } = await supabase.from('assumptions').delete().eq('id', id)
  return { error }
}

// ============ CATEGORIES ============

export const fetchCategories = async (companyId?: string) => {
  let query = supabase.from('categories').select('*').order('name', { ascending: true })
  if (companyId) query = query.eq('company_id', companyId)
  const { data, error } = await query
  return { data: data as Category[] | null, error }
}

export const insertCategory = async (category: any, companyId?: string) => {
  const toInsert = {
    ...category,
    company_id: companyId
  }
  const { data, error } = await supabase.from('categories').insert(toInsert).select().single()
  return { data, error }
}

export const updateCategory = async (id: string, updates: any) => {
  const { data, error } = await supabase.from('categories').update(updates).eq('id', id).select().single()
  return { data, error }
}

export const deleteCategory = async (id: string) => {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  return { error }
}

// ============ COMPANY SETTINGS ============

export const fetchCompanySettings = async (companyId?: string) => {
  let query = supabase.from('company_settings').select('*')
  if (companyId) query = query.eq('company_id', companyId)
  const { data, error } = await query.single()
  return { data: data as CompanySettings | null, error }
}

export const updateCompanySettings = async (companyId: string, settings: any) => {
  const { data: existing } = await supabase
    .from('company_settings')
    .select('id')
    .eq('company_id', companyId)
    .single()
  
  if (existing?.id) {
    const { data, error } = await supabase
      .from('company_settings')
      .update({ ...settings, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    return { data, error }
  } else {
    const { data, error } = await supabase
      .from('company_settings')
      .insert({ company_id: companyId, ...settings })
      .select()
      .single()
    return { data, error }
  }
}

// ============ COMPANIES ============

export const fetchCompanies = async (userId?: string) => {
  let query = supabase.from('companies').select('*').order('name', { ascending: true })
  if (userId) query = query.eq('owner_id', userId)
  const { data, error } = await query
  return { data: data as Company[] | null, error }
}

export const insertCompany = async (company: any, userId: string) => {
  const toInsert = {
    name: company.name,
    owner_id: userId
  }
  const { data, error } = await supabase.from('companies').insert(toInsert).select().single()
  return { data, error }
}

// ============ ANALYTICS HELPERS ============

// Get project profitability summary
export const getProjectProfitability = async (companyId: string, projectId?: string) => {
  // Get invoices (revenue)
  let invoiceQuery = supabase
    .from('invoices')
    .select('project_id, amount, amount_paid')
    .eq('company_id', companyId)
  if (projectId) invoiceQuery = invoiceQuery.eq('project_id', projectId)
  
  // Get project costs
  let costQuery = supabase
    .from('project_costs')
    .select('project_id, amount')
    .eq('company_id', companyId)
  if (projectId) costQuery = costQuery.eq('project_id', projectId)
  
  // Get time entries (for labor cost calculation)
  let timeQuery = supabase
    .from('time_entries')
    .select('project_id, hours, cost_rate, bill_rate')
    .eq('company_id', companyId)
  if (projectId) timeQuery = timeQuery.eq('project_id', projectId)
  
  const [invoices, costs, timeEntries] = await Promise.all([
    invoiceQuery,
    costQuery,
    timeQuery
  ])
  
  return {
    invoices: invoices.data,
    costs: costs.data,
    timeEntries: timeEntries.data,
    error: invoices.error || costs.error || timeEntries.error
  }
}

// Get AR aging summary
export const getARAgingSummary = async (companyId: string) => {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('company_id', companyId)
    .gt('balance_due', 0)
    .order('due_date', { ascending: true })
  
  return { data: data as Invoice[] | null, error }
}

// Get contractor utilization
export const getContractorUtilization = async (companyId: string, startDate: string, endDate: string) => {
  const { data, error } = await supabase
    .from('time_entries')
    .select(`
      contractor_id,
      hours,
      billable,
      contractors(name, default_bill_rate, default_cost_rate)
    `)
    .eq('company_id', companyId)
    .gte('date', startDate)
    .lte('date', endDate)
  
  return { data, error }
}
