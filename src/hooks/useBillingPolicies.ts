'use client'
import { useEffect,useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { BillingPolicy } from '@/lib/billing-periods'
export function useBillingPolicies(portal=false,enabled=true) {
  const [policies,setPolicies]=useState<BillingPolicy[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  useEffect(()=>{
    if(!enabled) return
    let active=true
    const load=async()=>{try{
      setLoading(true)
      const headers: Record<string,string>={}
      if(!portal){const {data}=await supabase.auth.getSession();if(data.session) headers.Authorization=`Bearer ${data.session.access_token}`}
      const response=await fetch('/api/billing-policies',{headers})
      const result=await response.json()
      if(!response.ok) throw new Error(result.error || 'Billing settings unavailable.')
      if(active){setPolicies(result.policies || []);setError('')}
    }catch(e){if(active)setError(e instanceof Error?e.message:'Billing settings unavailable.')}finally{if(active)setLoading(false)}}
    load();return()=>{active=false}
  },[portal,enabled])
  return {policies,loading,error}
}
