import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth functions
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
  return { profile: data }
}

// ============ TRANSACTIONS ============

export const fetchTransactions = async (companyId?: string) => {
  let query = supabase.from('transactions').select('*').order('date', { ascending: false })
  if (companyId) query = query.eq('company_id', companyId)
  const { data, error } = await query
  return { data, error }
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

// ============ ACCRUAL TRANSACTIONS ============

export const fetchAccrualTransactions = async (companyId?: string) => {
  let query = supabase.from('accrual_transactions').select('*').order('date', { ascending: false })
  if (companyId) query = query.eq('company_id', companyId)
  const { data, error } = await query
  return { data, error }
}

export const insertAccrualTransaction = async (transaction: any, companyId?: string, userId?: string) => {
  const toInsert = {
    ...transaction,
    company_id: companyId,
    user_id: userId
  }
  const { data, error } = await supabase.from('accrual_transactions').insert(toInsert).select().single()
  return { data, error }
}

export const updateAccrualTransaction = async (id: string, updates: any) => {
  const { data, error } = await supabase.from('accrual_transactions').update(updates).eq('id', id).select().single()
  return { data, error }
}

export const deleteAccrualTransaction = async (id: string) => {
  const { error } = await supabase.from('accrual_transactions').delete().eq('id', id)
  return { error }
}

export const bulkInsertAccrualTransactions = async (transactions: any[], companyId?: string, userId?: string) => {
  const toInsert = transactions.map(t => ({
    ...t,
    company_id: companyId,
    user_id: userId
  }))
  const { data, error } = await supabase.from('accrual_transactions').insert(toInsert).select()
  return { data, error }
}

export const deleteAllAccrualTransactions = async (companyId?: string) => {
  let query = supabase.from('accrual_transactions').delete()
  if (companyId) {
    query = query.eq('company_id', companyId)
  } else {
    query = query.neq('id', '')
  }
  const { error } = await query
  return { error }
}

// ============ PROJECTS ============

export const fetchProjects = async (companyId?: string) => {
  let query = supabase.from('projects').select('*').order('name', { ascending: true })
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
    budget_alert_threshold: project.budgetAlertThreshold || 80,
    client_id: project.clientId || null,
    target_gross_margin: project.targetGrossMargin || null,
    start_date: project.startDate || null,
    end_date: project.endDate || null,
    company_id: companyId,
    user_id: userId
  }
  const { data, error } = await supabase.from('projects').insert(toInsert).select().single()
  return { data, error }
}

export const updateProject = async (id: string, updates: any) => {
  // Convert camelCase to snake_case for Supabase
  const dbUpdates: any = {}
  if (updates.name !== undefined) dbUpdates.name = updates.name
  if (updates.color !== undefined) dbUpdates.color = updates.color
  if (updates.status !== undefined) dbUpdates.status = updates.status
  if (updates.budget !== undefined) dbUpdates.budget = updates.budget
  if (updates.budgetAlertThreshold !== undefined) dbUpdates.budget_alert_threshold = updates.budgetAlertThreshold
  if (updates.clientId !== undefined) dbUpdates.client_id = updates.clientId || null
  if (updates.targetGrossMargin !== undefined) dbUpdates.target_gross_margin = updates.targetGrossMargin
  if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate
  if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate
  
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
  return { data, error }
}

export const insertClient = async (client: any, companyId?: string, userId?: string) => {
  const toInsert = {
    ...client,
    company_id: companyId,
    user_id: userId
  }
  const { data, error } = await supabase.from('clients').insert(toInsert).select().single()
  return { data, error }
}

export const updateClient = async (id: string, updates: any) => {
  const { data, error } = await supabase.from('clients').update(updates).eq('id', id).select().single()
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
  return { data, error }
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

export const deleteAssumption = async (id: string) => {
  const { error } = await supabase.from('assumptions').delete().eq('id', id)
  return { error }
}

// ============ CATEGORIES ============

export const fetchCategories = async (companyId?: string) => {
  let query = supabase.from('categories').select('*').order('name', { ascending: true })
  if (companyId) query = query.eq('company_id', companyId)
  const { data, error } = await query
  return { data, error }
}

export const insertCategory = async (category: any) => {
  const { data, error } = await supabase.from('categories').insert(category).select().single()
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
  return { data, error }
}

export const updateCompanySettings = async (settings: any) => {
  const { data, error } = await supabase.from('company_settings').upsert(settings).select().single()
  return { data, error }
}
