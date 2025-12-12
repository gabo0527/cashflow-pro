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
