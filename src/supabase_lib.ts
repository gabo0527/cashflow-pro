// lib/supabase.ts
// Supabase client configuration for CashFlow Pro

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Types for database tables
export interface Profile {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'viewer'
  company_id: string | null
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  name: string
  created_at: string
  owner_id: string
}

export interface DbTransaction {
  id: string
  company_id: string
  date: string
  category: string
  description: string | null
  amount: number
  type: 'actual' | 'budget'
  project: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface DbAccrualTransaction {
  id: string
  company_id: string
  date: string
  type: 'revenue' | 'direct_cost'
  description: string | null
  amount: number
  project: string
  vendor: string | null
  invoice_number: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface DbCategory {
  id: string
  company_id: string
  category_id: string
  name: string
  type: 'income' | 'expense'
  color: string
  is_default: boolean
  created_at: string
}

export interface DbAssumption {
  id: string
  company_id: string
  name: string
  category: string
  amount: number
  value_type: 'amount' | 'percentage'
  percent_of: string | null
  frequency: 'monthly' | 'quarterly' | 'annually' | 'one-time'
  start_date: string
  end_date: string | null
  project: string | null
  scenario_id: string | null
  created_by: string | null
  created_at: string
}

export interface CompanySettings {
  id: string
  company_id: string
  beginning_balance: number
  company_name: string | null
  brand_color: string
  company_logo: string | null
  created_at: string
  updated_at: string
}

// Auth helpers
export const signInWithGoogle = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
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
  
  return { profile: profile as Profile | null, error }
}

// Data fetching helpers
export const fetchTransactions = async (companyId: string) => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('company_id', companyId)
    .order('date', { ascending: false })
  
  return { data: data as DbTransaction[] | null, error }
}

export const fetchAccrualTransactions = async (companyId: string) => {
  const { data, error } = await supabase
    .from('accrual_transactions')
    .select('*')
    .eq('company_id', companyId)
    .order('date', { ascending: false })
  
  return { data: data as DbAccrualTransaction[] | null, error }
}

export const fetchCategories = async (companyId: string) => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('company_id', companyId)
  
  return { data: data as DbCategory[] | null, error }
}

export const fetchAssumptions = async (companyId: string) => {
  const { data, error } = await supabase
    .from('assumptions')
    .select('*')
    .eq('company_id', companyId)
  
  return { data: data as DbAssumption[] | null, error }
}

export const fetchCompanySettings = async (companyId: string) => {
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .eq('company_id', companyId)
    .single()
  
  return { data: data as CompanySettings | null, error }
}

// Data mutation helpers
export const insertTransaction = async (transaction: Omit<DbTransaction, 'id' | 'created_at' | 'updated_at'>) => {
  const { data, error } = await supabase
    .from('transactions')
    .insert(transaction)
    .select()
    .single()
  
  return { data: data as DbTransaction | null, error }
}

export const updateTransaction = async (id: string, updates: Partial<DbTransaction>) => {
  const { data, error } = await supabase
    .from('transactions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  return { data: data as DbTransaction | null, error }
}

export const deleteTransaction = async (id: string) => {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id)
  
  return { error }
}

export const bulkInsertTransactions = async (transactions: Omit<DbTransaction, 'id' | 'created_at' | 'updated_at'>[]) => {
  const { data, error } = await supabase
    .from('transactions')
    .insert(transactions)
    .select()
  
  return { data: data as DbTransaction[] | null, error }
}

export const insertAccrualTransaction = async (transaction: Omit<DbAccrualTransaction, 'id' | 'created_at' | 'updated_at'>) => {
  const { data, error } = await supabase
    .from('accrual_transactions')
    .insert(transaction)
    .select()
    .single()
  
  return { data: data as DbAccrualTransaction | null, error }
}

export const updateAccrualTransaction = async (id: string, updates: Partial<DbAccrualTransaction>) => {
  const { data, error } = await supabase
    .from('accrual_transactions')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  
  return { data: data as DbAccrualTransaction | null, error }
}

export const deleteAccrualTransaction = async (id: string) => {
  const { error } = await supabase
    .from('accrual_transactions')
    .delete()
    .eq('id', id)
  
  return { error }
}

export const bulkInsertAccrualTransactions = async (transactions: Omit<DbAccrualTransaction, 'id' | 'created_at' | 'updated_at'>[]) => {
  const { data, error } = await supabase
    .from('accrual_transactions')
    .insert(transactions)
    .select()
  
  return { data: data as DbAccrualTransaction[] | null, error }
}

export const updateCompanySettings = async (companyId: string, updates: Partial<CompanySettings>) => {
  const { data, error } = await supabase
    .from('company_settings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('company_id', companyId)
    .select()
    .single()
  
  return { data: data as CompanySettings | null, error }
}

export const insertAssumption = async (assumption: Omit<DbAssumption, 'id' | 'created_at'>) => {
  const { data, error } = await supabase
    .from('assumptions')
    .insert(assumption)
    .select()
    .single()
  
  return { data: data as DbAssumption | null, error }
}

export const deleteAssumption = async (id: string) => {
  const { error } = await supabase
    .from('assumptions')
    .delete()
    .eq('id', id)
  
  return { error }
}

export const deleteAllTransactions = async (companyId: string) => {
  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('company_id', companyId)
  
  return { error }
}

export const deleteAllAccrualTransactions = async (companyId: string) => {
  const { error } = await supabase
    .from('accrual_transactions')
    .delete()
    .eq('company_id', companyId)
  
  return { error }
}

// Category management
export const updateCategory = async (id: string, updates: Partial<DbCategory>) => {
  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  return { data: data as DbCategory | null, error }
}

export const insertCategory = async (category: Omit<DbCategory, 'id' | 'created_at'>) => {
  const { data, error } = await supabase
    .from('categories')
    .insert(category)
    .select()
    .single()
  
  return { data: data as DbCategory | null, error }
}

export const deleteCategory = async (id: string) => {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
  
  return { error }
}
