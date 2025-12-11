import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Auth functions
export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  return { data, error }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user, error }
}

export const getCurrentProfile = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { profile: null, error: 'Not authenticated' }
  
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  
  return { profile, error }
}

// Data functions - Transactions
export const fetchTransactions = async (companyId: string) => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('company_id', companyId)
    .order('date', { ascending: false })
  
  return { data, error }
}

export const insertTransaction = async (transaction: any, companyId: string, userId: string) => {
  const { data, error } = await supabase
    .from('transactions')
    .insert({
      ...transaction,
      company_id: companyId,
      created_by: userId
    })
    .select()
    .single()
  
  return { data, error }
}

export const updateTransaction = async (id: string, updates: any) => {
  const { data, error } = await supabase
    .from('transactions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  return { data, error }
}

export const deleteTransaction = async (id: string) => {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
  
  return { error }
}

export const bulkInsertTransactions = async (transactions: any[], companyId: string, userId: string) => {
  const withCompany = transactions.map(t => ({
    ...t,
    company_id: companyId,
    created_by: userId
  }))
  
  const { data, error } = await supabase
    .from('transactions')
    .insert(withCompany)
    .select()
  
  return { data, error }
}

export const deleteAllTransactions = async (companyId: string) => {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('company_id', companyId)
  
  return { error }
}

// Accrual Transactions
export const fetchAccrualTransactions = async (companyId: string) => {
  const { data, error } = await supabase
    .from('accrual_transactions')
    .select('*')
    .eq('company_id', companyId)
    .order('date', { ascending: false })
  
  return { data, error }
}

export const insertAccrualTransaction = async (transaction: any, companyId: string, userId: string) => {
  const { data, error } = await supabase
    .from('accrual_transactions')
    .insert({
      ...transaction,
      company_id: companyId,
      created_by: userId
    })
    .select()
    .single()
  
  return { data, error }
}

export const updateAccrualTransaction = async (id: string, updates: any) => {
  const { data, error } = await supabase
    .from('accrual_transactions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  return { data, error }
}

export const deleteAccrualTransaction = async (id: string) => {
  const { error } = await supabase
    .from('accrual_transactions')
    .delete()
    .eq('id', id)
  
  return { error }
}

export const bulkInsertAccrualTransactions = async (transactions: any[], companyId: string, userId: string) => {
  const withCompany = transactions.map(t => ({
    ...t,
    company_id: companyId,
    created_by: userId
  }))
  
  const { data, error } = await supabase
    .from('accrual_transactions')
    .insert(withCompany)
    .select()
  
  return { data, error }
}

export const deleteAllAccrualTransactions = async (companyId: string) => {
  const { error } = await supabase
    .from('accrual_transactions')
    .delete()
    .eq('company_id', companyId)
  
  return { error }
}

// Assumptions
export const fetchAssumptions = async (companyId: string) => {
  const { data, error } = await supabase
    .from('assumptions')
    .select('*')
    .eq('company_id', companyId)
  
  return { data, error }
}

export const insertAssumption = async (assumption: any, companyId: string, userId: string) => {
  const { data, error } = await supabase
    .from('assumptions')
    .insert({
      ...assumption,
      company_id: companyId,
      created_by: userId
    })
    .select()
    .single()
  
  return { data, error }
}

export const deleteAssumption = async (id: string) => {
  const { error } = await supabase
    .from('assumptions')
    .delete()
    .eq('id', id)
  
  return { error }
}

// Categories
export const fetchCategories = async (companyId: string) => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', companyId)
  
  return { data, error }
}

// Company Settings
export const fetchCompanySettings = async (companyId: string) => {
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .eq('company_id', companyId)
    .single()
  
  return { data, error }
}

export const updateCompanySettings = async (companyId: string, settings: any) => {
  const { data, error } = await supabase
    .from('company_settings')
    .update({ ...settings, updated_at: new Date().toISOString() })
    .eq('company_id', companyId)
    .select()
    .single()
  
  return { data, error }
}
