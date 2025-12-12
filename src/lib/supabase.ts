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
  return user
}

export const getCurrentProfile = async () => {
  const user = await getCurrentUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  return data
}

// Transaction functions
export const fetchTransactions = async () => {
  const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false })
  if (error) throw error
  return data
}

export const insertTransaction = async (transaction: any) => {
  const { data, error } = await supabase.from('transactions').insert(transaction).select().single()
  if (error) throw error
  return data
}

export const updateTransaction = async (id: string, updates: any) => {
  const { data, error } = await supabase.from('transactions').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export const deleteTransaction = async (id: string) => {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}

export const bulkInsertTransactions = async (transactions: any[]) => {
  const { data, error } = await supabase.from('transactions').insert(transactions).select()
  if (error) throw error
  return data
}

export const deleteAllTransactions = async () => {
  const { error } = await supabase.from('transactions').delete().neq('id', '')
  if (error) throw error
}

// Category functions
export const insertCategory = async (category: any) => {
  const { data, error } = await supabase.from('categories').insert(category).select().single()
  if (error) throw error
  return data
}

export const updateCategory = async (id: string, updates: any) => {
  const { data, error } = await supabase.from('categories').update(updates).eq('id', id).select().single()
  if (error) throw error
  return data
}

export const deleteCategory = async (id: string) => {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}
