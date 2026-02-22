"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import {
  Search, Download, Plus, Edit2, X, Users, Mail, Phone,
  Eye, EyeOff, Briefcase, DollarSign, Trash2, BarChart3,
  FileText, Building2, MapPin, Upload, Calendar, Clock,
  CheckCircle, AlertCircle, RefreshCw, ExternalLink, TrendingUp,
  User, UserCheck, Filter, ChevronDown, ChevronRight, Link2, Lock, Unlock
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend
} from "recharts"
import { supabase, getCurrentUser } from "@/lib/supabase"

// ============ THEME (premium — Mercury / Ramp / Carta level) ============
const THEME = {
  card: "bg-[#0f1623] border-slate-800/60",
  border: "border-slate-800/60",
  textPrimary: "text-white",
  textSecondary: "text-slate-300",
  textMuted: "text-slate-400",
  textDim: "text-slate-500",
}

const inputClass = "w-full px-3.5 py-2.5 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500/40 transition-all duration-200"
const selectInputClass = "w-full px-3.5 py-2.5 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500/40 transition-all duration-200 cursor-pointer"

// ============ TOAST ============
interface Toast { id: number; type: "success" | "error" | "info"; message: string }

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div key={toast.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-xl ${
          toast.type === "success" ? "bg-emerald-950/80 border-emerald-800/30 text-emerald-400" :
          toast.type === "error" ? "bg-rose-950/80 border-rose-800/30 text-rose-400" :
          "bg-sky-950/80 border-sky-800/30 text-sky-400"
        }`}>
          {toast.type === "success" && <CheckCircle size={16} />}
          {toast.type === "error" && <AlertCircle size={16} />}
          {toast.type === "info" && <AlertCircle size={16} />}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => onDismiss(toast.id)} className="ml-2 opacity-50 hover:opacity-100 transition-opacity"><X size={14} /></button>
        </div>
      ))}
    </div>
  )
}

// ============ TYPES ============
interface TeamMember {
  id: string; name: string; email: string; phone: string | null; role: string | null
  status: "active" | "inactive"; employment_type: "employee" | "contractor"
  start_date: string | null; entity_name: string | null; entity_type: string | null
  address: string | null; bank_name: string | null; account_type: string | null
  routing_number: string | null; account_number: string | null; payment_method: string | null
  cost_type: "hourly" | "lump_sum"; cost_amount: number | null
}

interface BillRate {
  id: string; team_member_id: string; client_id: string
  rate: number; cost_type: "hourly" | "lump_sum"; cost_amount: number; baseline_hours: number
  is_active: boolean; notes: string | null
  start_date: string | null; end_date: string | null
  revenue_type: "hourly" | "lump_sum"; revenue_amount: number
  team_member_name?: string; client_name?: string
}

interface CostOverride {
  id: string; team_member_id: string; client_id: string; month: string
  fixed_amount: number; notes: string | null
  team_member_name?: string; client_name?: string
}

interface Project { id: string; name: string; client_id: string | null; client_name?: string; status: string; budget: number }
interface Client { id: string; name: string }
interface TimeEntry { id: string; contractor_id: string; project_id: string; hours: number; billable_hours: number | null; is_billable: boolean; date: string }

// ============ CONSTANTS ============
const STATUS_OPTIONS = [{ id: "active", label: "Active" }, { id: "inactive", label: "Inactive" }]
const EMPLOYMENT_TYPES = [
  { id: "employee", label: "W-2 Employee", icon: UserCheck, color: "blue" },
  { id: "contractor", label: "1099 Contractor", icon: User, color: "purple" },
]
const ENTITY_TYPES = [
  { id: "individual", label: "Individual" }, { id: "llc", label: "LLC" },
  { id: "corp", label: "Corporation" }, { id: "s_corp", label: "S-Corp" }, { id: "partnership", label: "Partnership" },
]
const COST_TYPES = [
  { id: "hourly", label: "Hourly (T&M)", description: "Paid per hour worked" },
  { id: "lump_sum", label: "Monthly Fixed", description: "Fixed amount per month" },
]
const ACCOUNT_TYPES = [{ id: "checking", label: "Checking" }, { id: "savings", label: "Savings" }]
const PAYMENT_METHODS = [
  { id: "ach", label: "ACH Transfer" }, { id: "wire", label: "Wire Transfer" },
  { id: "check", label: "Check" }, { id: "zelle", label: "Zelle" },
]
const CHART_COLORS = { cost: "#64748b", revenue: "#0d9488", margin: "#2563eb" }

// ============ UTILITIES ============
const formatCurrency = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
const formatCurrencyDecimal = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
const formatCompactCurrency = (v: number) => { if (v >= 1e6) return `$${(v/1e6).toFixed(1)}M`; if (v >= 1e3) return `$${(v/1e3).toFixed(0)}k`; return `$${v.toFixed(0)}` }
const maskNumber = (num: string | null) => num ? "\u2022\u2022\u2022\u2022 " + num.slice(-4) : "\u2014"
const getStatusStyle = (s: string) => s === "active" ? { bg: "bg-emerald-950/60", text: "text-emerald-400", border: "border-emerald-800/40" } : { bg: "bg-slate-800/60", text: "text-slate-500", border: "border-slate-700/40" }
const getEmploymentStyle = (t: string) => t === "employee" ? { bg: "bg-blue-950/60", text: "text-blue-400", border: "border-blue-800/40" } : { bg: "bg-purple-950/60", text: "text-purple-400", border: "border-purple-800/40" }

const getCurrentMonth = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}` }
const formatMonth = (m: string) => { const [y, mo] = m.split("-"); return new Date(parseInt(y), parseInt(mo)-1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }) }

// Period helpers
type PeriodType = "month" | "quarter" | "year"
const getCurrentQuarter = () => { const n = new Date(); return `${n.getFullYear()}-Q${Math.ceil((n.getMonth()+1)/3)}` }
const getCurrentYear = () => `${new Date().getFullYear()}`
const formatQuarter = (q: string) => { const [y, qn] = q.split("-Q"); return `Q${qn} ${y}` }

function getMonthsInPeriod(period: string, periodType: PeriodType): string[] {
  if (periodType === "month") return [period]
  if (periodType === "quarter") {
    const [y, qn] = period.split("-Q").map(Number)
    const sm = (qn - 1) * 3 + 1
    return [1, 2, 3].map(i => `${y}-${String(sm + i - 1).padStart(2, "0")}`)
  }
  const y = parseInt(period)
  return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`)
}

function formatPeriodLabel(period: string, periodType: PeriodType): string {
  if (periodType === "month") return formatMonth(period)
  if (periodType === "quarter") return formatQuarter(period)
  return period
}

function stepPeriod(period: string, periodType: PeriodType, dir: -1 | 1): string {
  if (periodType === "month") {
    const [y, m] = period.split("-").map(Number)
    const d = new Date(y, m - 1 + dir, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  }
  if (periodType === "quarter") {
    const [y, qn] = period.split("-Q").map(Number)
    let nq = qn + dir, ny = y
    if (nq > 4) { nq = 1; ny++ } else if (nq < 1) { nq = 4; ny-- }
    return `${ny}-Q${nq}`
  }
  return `${parseInt(period) + dir}`
}

function getDefaultPeriod(pt: PeriodType): string {
  if (pt === "month") return getCurrentMonth()
  if (pt === "quarter") return getCurrentQuarter()
  return getCurrentYear()
}

// ============ MEMBER DETAIL FLYOUT ============
function MemberDetailFlyout({ member, billRates, clients, onClose, onEdit }: {
  member: TeamMember; billRates: BillRate[]; clients: Client[]; onClose: () => void; onEdit: () => void
}) {
  const [showBanking, setShowBanking] = useState(false)
  const memberRates = billRates.filter(r => r.team_member_id === member.id && r.is_active)
  const empStyle = getEmploymentStyle(member.employment_type)

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex justify-end z-50" onClick={onClose}>
      <div className="w-full max-w-xl h-full bg-[#0b1020] border-l border-slate-800/40 overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-[#0b1020]/95 backdrop-blur-xl border-b border-slate-800/40 px-6 py-5 z-10">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-white tracking-tight">{member.name}</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${empStyle.bg} ${empStyle.text}`}>
                  {member.employment_type === "employee" ? "W-2" : "1099"}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">{member.role || "No role"}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={onEdit} className="p-2 rounded-lg hover:bg-white/[0.05] transition-all duration-200"><Edit2 size={15} className="text-slate-500" /></button>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.05] transition-all duration-200"><X size={16} className="text-slate-500" /></button>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Contact</h3>
            <div className="space-y-2">
              <a href={`mailto:${member.email}`} className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"><Mail size={14} /> {member.email}</a>
              {member.phone && <p className={`flex items-center gap-2 text-sm ${THEME.textSecondary}`}><Phone size={14} /> {member.phone}</p>}
              {member.address && <p className={`flex items-center gap-2 text-sm ${THEME.textMuted}`}><MapPin size={14} /> {member.address}</p>}
              {member.start_date && <p className={`flex items-center gap-2 text-sm ${THEME.textMuted}`}><Calendar size={14} /> Started {new Date(member.start_date).toLocaleDateString()}</p>}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Default Cost (fallback)</h3>
            <div className="p-4 rounded-xl bg-white/[0.02] border border-slate-800/30">
              <div className="flex justify-between">
                <span className={THEME.textMuted}>{member.cost_type === "hourly" ? "T&M" : "Fixed"}</span>
                <span className="text-orange-400 font-medium tabular-nums">{member.cost_amount ? (member.cost_type === "hourly" ? `$${member.cost_amount}/hr` : `${formatCurrency(member.cost_amount)}/mo`) : "\u2014"}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Rate Card ({memberRates.length} client{memberRates.length !== 1 ? "s" : ""})</h3>
            {memberRates.length > 0 ? (
              <div className="space-y-2">
                {memberRates.map(r => {
                  const hasCustomCost = r.cost_amount > 0
                  const effCost = hasCustomCost ? (r.cost_type === "hourly" ? r.cost_amount : (r.baseline_hours > 0 ? r.cost_amount / r.baseline_hours : 0)) : 0
                  const isLumpRev = r.revenue_type === "lump_sum"
                  const revAmt = r.revenue_amount || 0
                  const mg = isLumpRev
                    ? (hasCustomCost && revAmt > 0 ? ((revAmt - (r.cost_type === "hourly" ? r.cost_amount * (r.baseline_hours || 172) : r.cost_amount)) / revAmt * 100) : 0)
                    : (hasCustomCost && r.rate > 0 ? ((r.rate - effCost) / r.rate * 100) : 0)
                  return (
                    <div key={r.id} className="p-4 rounded-xl bg-white/[0.02] border border-slate-800/30">
                      <div className="flex items-center justify-between mb-1">
                        <p className={`text-sm font-medium ${THEME.textPrimary}`}>{r.client_name}</p>
                        {hasCustomCost || isLumpRev ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${mg >= 20 ? "bg-emerald-500/10 text-emerald-400" : mg >= 0 ? "bg-amber-500/10 text-amber-400" : "bg-rose-500/10 text-rose-400"}`}>{mg.toFixed(0)}% GM</span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-950/40 text-blue-400">Distributed</span>
                        )}
                      </div>
                      <div className="flex gap-4 text-xs">
                        <span className="text-orange-400">
                          Cost: {hasCustomCost
                            ? (r.cost_type === "hourly" ? `$${r.cost_amount}/hr` : `${formatCurrency(r.cost_amount)}/mo (${r.baseline_hours}h)`)
                            : "From member total"}
                        </span>
                        <span className="text-emerald-400">{isLumpRev ? `Rev: ${formatCurrency(revAmt)}/mo` : `Bill: $${r.rate}/hr`}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : <p className={`text-sm ${THEME.textMuted} text-center py-4`}>No rates configured</p>}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Banking</h3>
              {member.bank_name && <button onClick={() => setShowBanking(!showBanking)} className={`text-xs ${THEME.textMuted} hover:text-white flex items-center gap-1`}>
                {showBanking ? <EyeOff size={14} /> : <Eye size={14} />} {showBanking ? "Hide" : "Show"}
              </button>}
            </div>
            {member.bank_name ? (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-slate-800/30 space-y-2">
                <div className="flex justify-between"><span className={THEME.textMuted}>Bank</span><span className={THEME.textPrimary}>{member.bank_name}</span></div>
                <div className="flex justify-between"><span className={THEME.textMuted}>Routing</span><span className="font-mono text-sm">{showBanking?member.routing_number:maskNumber(member.routing_number)}</span></div>
                <div className="flex justify-between"><span className={THEME.textMuted}>Account</span><span className="font-mono text-sm">{showBanking?member.account_number:maskNumber(member.account_number)}</span></div>
                <div className="flex justify-between"><span className={THEME.textMuted}>Method</span><span className={THEME.textPrimary}>{PAYMENT_METHODS.find(m=>m.id===member.payment_method)?.label||"\u2014"}</span></div>
              </div>
            ) : <p className={`text-sm ${THEME.textMuted} p-4 rounded-xl bg-white/[0.02] border border-slate-800/30 text-center`}>No banking info</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ RATE CARD MODAL (Cost + Revenue per client) ============
function RateCardModal({ isOpen, onClose, onSave, editingRate, teamMembers, clients, projects, companyId }: {
  isOpen: boolean; onClose: () => void; onSave: (data: any) => Promise<void>
  editingRate: BillRate | null; teamMembers: TeamMember[]; clients: Client[]; projects: Project[]; companyId: string | null
}) {
  const [form, setForm] = useState({
    team_member_id: "", client_id: "", rate: "", notes: "",
    cost_type: "hourly" as "hourly" | "lump_sum", cost_amount: "", baseline_hours: "172",
    customCost: false,
    revenue_type: "hourly" as "hourly" | "lump_sum",
    revenue_amount: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
  })
  const [isSaving, setIsSaving] = useState(false)
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set())
  const [loadingAssignments, setLoadingAssignments] = useState(false)

  // Get projects for selected client
  const clientProjects = useMemo(() => 
    projects.filter(p => p.client_id === form.client_id && p.status === "active"),
    [projects, form.client_id]
  )

  // Load existing project assignments when editing or client changes
  useEffect(() => {
    const loadAssignments = async () => {
      if (!form.team_member_id || !form.client_id || !companyId) { setSelectedProjects(new Set()); return }
      setLoadingAssignments(true)
      try {
        const clientProjectIds = projects.filter(p => p.client_id === form.client_id).map(p => p.id)
        if (clientProjectIds.length === 0) { setSelectedProjects(new Set()); return }
        const { data } = await supabase.from("team_project_assignments")
          .select("project_id")
          .eq("team_member_id", form.team_member_id)
          .eq("company_id", companyId)
          .in("project_id", clientProjectIds)
        if (data && data.length > 0) {
          setSelectedProjects(new Set(data.map((d: any) => d.project_id)))
        } else {
          // No assignments yet — default to all projects for this client
          setSelectedProjects(new Set(clientProjectIds))
        }
      } catch (e) { console.error("Error loading assignments:", e) }
      finally { setLoadingAssignments(false) }
    }
    if (form.client_id && form.team_member_id) loadAssignments()
  }, [form.client_id, form.team_member_id, companyId])

  useEffect(() => {
    if (editingRate) {
      const hasCustomCost = (editingRate.cost_amount || 0) > 0
      setForm({
        team_member_id: editingRate.team_member_id, client_id: editingRate.client_id,
        rate: editingRate.rate.toString(), notes: editingRate.notes || "",
        cost_type: editingRate.cost_type || "hourly",
        cost_amount: editingRate.cost_amount?.toString() || "",
        baseline_hours: editingRate.baseline_hours?.toString() || "172",
        customCost: hasCustomCost,
        revenue_type: editingRate.revenue_type || "hourly",
        revenue_amount: editingRate.revenue_amount?.toString() || "",
        start_date: editingRate.start_date || "",
        end_date: editingRate.end_date || "",
      })
    } else {
      setForm({ team_member_id: "", client_id: "", rate: "", notes: "", cost_type: "hourly", cost_amount: "", baseline_hours: "172", customCost: false, revenue_type: "hourly", revenue_amount: "", start_date: new Date().toISOString().split("T")[0], end_date: "" })
    }
  }, [editingRate, isOpen])

  const handleMemberChange = (id: string) => {
    setForm(p => ({ ...p, team_member_id: id }))
  }

  const selectedMember = teamMembers.find(m => m.id === form.team_member_id)
  const costAmt = form.customCost ? (parseFloat(form.cost_amount) || 0) : 0
  const baseHrs = parseFloat(form.baseline_hours) || 172
  const effCostRate = form.customCost ? (form.cost_type === "hourly" ? costAmt : (baseHrs > 0 ? costAmt / baseHrs : 0)) : 0
  const billRate = parseFloat(form.rate) || 0
  const revenueAmount = parseFloat(form.revenue_amount) || 0
  const isLumpRevenue = form.revenue_type === "lump_sum"
  const monthlyRevenue = isLumpRevenue ? revenueAmount : 0
  const monthlyCost = form.customCost ? (form.cost_type === "hourly" ? costAmt * baseHrs : costAmt) : 0
  const margin = isLumpRevenue
    ? (monthlyRevenue > 0 && monthlyCost > 0 ? ((monthlyRevenue - monthlyCost) / monthlyRevenue * 100) : 0)
    : (billRate > 0 && effCostRate > 0 ? ((billRate - effCostRate) / billRate * 100) : 0)

  const handleSave = async () => {
    const hasRevenue = form.revenue_type === "hourly" ? !!form.rate : !!form.revenue_amount
    if (!form.team_member_id || !form.client_id || !hasRevenue) return
    setIsSaving(true)
    try {
      await onSave({
        team_member_id: form.team_member_id, client_id: form.client_id,
        rate: form.revenue_type === "hourly" ? (parseFloat(form.rate) || 0) : 0,
        is_active: true, notes: form.notes || null,
        cost_type: form.customCost ? form.cost_type : "hourly",
        cost_amount: form.customCost ? (parseFloat(form.cost_amount) || 0) : 0,
        baseline_hours: form.customCost ? (parseFloat(form.baseline_hours) || 172) : 172,
        revenue_type: form.revenue_type,
        revenue_amount: form.revenue_type === "lump_sum" ? (parseFloat(form.revenue_amount) || 0) : 0,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      })

      // Save project assignments
      if (companyId && selectedProjects.size > 0) {
        // Delete existing assignments for this member + client's projects
        const clientProjectIds = projects.filter(p => p.client_id === form.client_id).map(p => p.id)
        if (clientProjectIds.length > 0) {
          await supabase.from("team_project_assignments")
            .delete()
            .eq("team_member_id", form.team_member_id)
            .eq("company_id", companyId)
            .in("project_id", clientProjectIds)
        }
        // Insert selected assignments
        const rows = Array.from(selectedProjects).map(pid => ({
          company_id: companyId,
          team_member_id: form.team_member_id,
          project_id: pid,
          service: "General",
          payment_type: "tm",
        }))
        if (rows.length > 0) {
          await supabase.from("team_project_assignments").insert(rows)
        }
      }
      onClose()
    } finally { setIsSaving(false) }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className={`${THEME.card} border ${THEME.border} rounded-xl w-full max-w-lg my-8`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.border}`}>
          <h3 className={`text-lg font-bold ${THEME.textPrimary}`}>{editingRate ? "Edit Rate Card" : "Add Rate Card"}</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/[0.04] rounded-lg"><X size={20} className={THEME.textMuted} /></button>
        </div>
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs ${THEME.textMuted} mb-1`}>Team Member *</label>
              <select value={form.team_member_id} onChange={e => handleMemberChange(e.target.value)} disabled={!!editingRate}
                className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed">
                <option value="">Select...</option>
                {teamMembers.filter(m=>m.status==="active").map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-xs ${THEME.textMuted} mb-1`}>Client *</label>
              <select value={form.client_id} onChange={e => setForm(p=>({...p,client_id:e.target.value}))} disabled={!!editingRate}
                className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed">
                <option value="">Select...</option>
                {clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Effective Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs ${THEME.textMuted} mb-1`}>Start Date *</label>
              <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white" />
            </div>
            <div>
              <label className={`block text-xs ${THEME.textMuted} mb-1`}>End Date <span className={THEME.textDim}>(blank = ongoing)</span></label>
              <input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white" />
            </div>
          </div>

          {/* Project Assignments */}
          {form.client_id && form.team_member_id && clientProjects.length > 0 && (
            <div className="p-4 rounded-lg border border-blue-500/15 bg-blue-950/20">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-blue-400">PROJECT ACCESS &mdash; Timesheet Visibility</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSelectedProjects(new Set(clientProjects.map(p => p.id)))}
                    className="text-[10px] text-blue-400 hover:text-blue-300">All</button>
                  <span className="text-[10px] text-slate-600">|</span>
                  <button type="button" onClick={() => setSelectedProjects(new Set())}
                    className="text-[10px] text-slate-400 hover:text-slate-300">None</button>
                </div>
              </div>
              {loadingAssignments ? (
                <div className="flex items-center gap-2 py-2"><RefreshCw size={12} className="animate-spin text-blue-400" /><span className="text-xs text-slate-400">Loading...</span></div>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {clientProjects.map(p => (
                    <label key={p.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] cursor-pointer group">
                      <input type="checkbox" checked={selectedProjects.has(p.id)}
                        onChange={() => setSelectedProjects(prev => {
                          const next = new Set(prev)
                          next.has(p.id) ? next.delete(p.id) : next.add(p.id)
                          return next
                        })}
                        className="w-3.5 h-3.5 rounded border-slate-700 bg-[#0c1220] text-teal-500 focus:ring-teal-500/20" />
                      <span className={`text-xs ${selectedProjects.has(p.id) ? "text-white" : "text-slate-500"}`}>{p.name}</span>
                    </label>
                  ))}
                </div>
              )}
              <p className="text-[10px] text-slate-500 mt-2">{selectedProjects.size} of {clientProjects.length} projects &mdash; member will only see selected projects in timesheet</p>
            </div>
          )}

          <div className="p-4 rounded-lg border border-orange-500/15 bg-orange-950/20">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-orange-400">COST SIDE &mdash; What You Pay</p>
              <button type="button" onClick={() => setForm(p => ({ ...p, customCost: !p.customCost }))}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  form.customCost ? "border-orange-500/50 bg-orange-950/30 text-orange-400" : "border-slate-800/50 text-slate-500 hover:text-white"
                }`}>
                {form.customCost ? "Custom cost for this client" : "Distributed from member total"}
              </button>
            </div>

            {form.customCost ? (
              <>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {COST_TYPES.map(t => (
                    <button key={t.id} type="button" onClick={() => setForm(p=>({...p, cost_type: t.id as any}))}
                      className={`p-2 rounded-lg border text-left transition-all ${form.cost_type===t.id ? "border-orange-500/50 bg-orange-950/30" : "border-slate-800/50 hover:border-slate-700"}`}>
                      <p className={`text-xs font-medium ${form.cost_type===t.id ? "text-orange-400" : THEME.textPrimary}`}>{t.label}</p>
                    </button>
                  ))}
                </div>
                <div className={form.cost_type === "lump_sum" ? "grid grid-cols-2 gap-3" : ""}>
                  <div>
                    <label className={`block text-xs ${THEME.textDim} mb-1`}>{form.cost_type === "hourly" ? "Cost Rate ($/hr)" : "Monthly Amount ($/mo)"}</label>
                    <input type="number" value={form.cost_amount} onChange={e => setForm(p=>({...p,cost_amount:e.target.value}))}
                      className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white" placeholder={form.cost_type==="hourly"?"35":"13525"} />
                  </div>
                  {form.cost_type === "lump_sum" && (
                    <div>
                      <label className={`block text-xs ${THEME.textDim} mb-1`}>Baseline Hrs/mo</label>
                      <input type="number" value={form.baseline_hours} onChange={e => setForm(p=>({...p,baseline_hours:e.target.value}))}
                        className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white" placeholder="340" />
                    </div>
                  )}
                </div>
                {form.cost_type === "lump_sum" && costAmt > 0 && (
                  <p className={`text-xs ${THEME.textDim} mt-2`}>Effective: ~${effCostRate.toFixed(2)}/hr ({formatCurrency(costAmt)} &divide; {baseHrs} hrs)</p>
                )}
              </>
            ) : (
              <div className="p-4 rounded-xl bg-white/[0.02] border border-slate-800/30">
                <p className={`text-xs ${THEME.textSecondary}`}>
                  Cost will be auto-distributed from {selectedMember?.name ? `${selectedMember.name}'s` : "member's"} total
                  {selectedMember?.cost_amount ? ` (${selectedMember.cost_type === "hourly" ? `$${selectedMember.cost_amount}/hr` : `${formatCurrency(selectedMember.cost_amount)}/mo`})` : ""}
                  {" "}based on % of hours worked per client.
                </p>
              </div>
            )}
          </div>

          <div className="p-4 rounded-lg border border-emerald-500/15 bg-emerald-950/20">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-emerald-400">REVENUE SIDE &mdash; What You Charge</p>
              <button type="button" onClick={() => setForm(p => ({ ...p, revenue_type: p.revenue_type === "hourly" ? "lump_sum" : "hourly" }))}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  form.revenue_type === "lump_sum" ? "border-emerald-500/50 bg-emerald-950/30 text-emerald-400" : "border-slate-800/50 text-slate-500 hover:text-white"
                }`}>
                {form.revenue_type === "lump_sum" ? "Lump Sum (fixed monthly)" : "Hourly (T&M)"}
              </button>
            </div>
            {form.revenue_type === "hourly" ? (
              <div>
                <label className={`block text-xs ${THEME.textDim} mb-1`}>Bill Rate ($/hr) *</label>
                <input type="number" value={form.rate} onChange={e => setForm(p=>({...p,rate:e.target.value}))}
                  className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white" placeholder="112" />
              </div>
            ) : (
              <div>
                <label className={`block text-xs ${THEME.textDim} mb-1`}>Monthly Revenue Amount ($/mo) *</label>
                <input type="number" value={form.revenue_amount} onChange={e => setForm(p=>({...p,revenue_amount:e.target.value}))}
                  className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white" placeholder="6000" />
                {revenueAmount > 0 && (
                  <p className={`text-xs ${THEME.textDim} mt-2`}>Fixed {formatCurrency(revenueAmount)}/mo &mdash; no timesheet required for revenue</p>
                )}
              </div>
            )}
          </div>

          {form.customCost && ((isLumpRevenue ? monthlyCost > 0 && monthlyRevenue > 0 : effCostRate > 0 && billRate > 0)) && (
            <div className={`p-4 rounded-lg border ${margin >= 20 ? "bg-emerald-950/30 border-emerald-800/30" : margin >= 0 ? "bg-amber-950/30 border-amber-800/30" : "bg-rose-950/30 border-rose-800/30"}`}>
              {isLumpRevenue ? (
                <>
                  <div className="flex justify-between text-sm"><span className={THEME.textSecondary}>Monthly Cost</span><span className="text-orange-400">{formatCurrency(monthlyCost)}/mo</span></div>
                  <div className="flex justify-between text-sm mt-1"><span className={THEME.textSecondary}>Monthly Revenue</span><span className="text-emerald-400">{formatCurrency(monthlyRevenue)}/mo</span></div>
                  <div className={`flex justify-between text-sm mt-2 pt-2 border-t ${THEME.border}`}>
                    <span className="font-medium text-white">Gross Margin</span>
                    <span className={`font-semibold ${margin >= 20 ? "text-emerald-400" : margin >= 0 ? "text-amber-400" : "text-rose-400"}`}>
                      {margin.toFixed(1)}% ({formatCurrency(monthlyRevenue - monthlyCost)}/mo)
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-sm"><span className={THEME.textSecondary}>Eff. Cost</span><span className="text-orange-400">${effCostRate.toFixed(2)}/hr</span></div>
                  <div className="flex justify-between text-sm mt-1"><span className={THEME.textSecondary}>Bill Rate</span><span className="text-emerald-400">${billRate.toFixed(2)}/hr</span></div>
                  <div className={`flex justify-between text-sm mt-2 pt-2 border-t ${THEME.border}`}>
                    <span className="font-medium text-white">Gross Margin</span>
                    <span className={`font-semibold ${margin >= 20 ? "text-emerald-400" : margin >= 0 ? "text-amber-400" : "text-rose-400"}`}>
                      {margin.toFixed(1)}% (${(billRate - effCostRate).toFixed(2)}/hr)
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
          {!form.customCost && (billRate > 0 || revenueAmount > 0) && (
            <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-800/30">
              <p className={`text-xs ${THEME.textSecondary}`}>Margin will be calculated from {isLumpRevenue ? "fixed monthly revenue" : "timesheet hours"} &mdash; member total cost distributed across clients by % of hours worked.</p>
            </div>
          )}

          <div>
            <label className={`block text-xs ${THEME.textMuted} mb-1`}>Notes</label>
            <input value={form.notes} onChange={e => setForm(p=>({...p,notes:e.target.value}))}
              className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white" placeholder="e.g. Covers PM + analyst, 2 FTEs..." />
          </div>
        </div>
        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${THEME.border} bg-slate-800/30`}>
          <button onClick={onClose} className={`px-4 py-2 text-sm font-medium text-slate-500 hover:text-white transition-colors duration-200`}>Cancel</button>
          <button onClick={handleSave} disabled={!form.team_member_id||!form.client_id||(form.revenue_type === "hourly" ? !form.rate : !form.revenue_amount)||isSaving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed">
            {isSaving && <RefreshCw size={14} className="animate-spin" />}{editingRate ? "Save Changes" : "Add Rate"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ COST OVERRIDE MODAL ============
function CostOverrideModal({ isOpen, onClose, onSave, billRates, teamMembers, clients, selectedMonth }: {
  isOpen: boolean; onClose: () => void; onSave: (data: any) => Promise<void>
  billRates: BillRate[]; teamMembers: TeamMember[]; clients: Client[]; selectedMonth: string
}) {
  const [form, setForm] = useState({ team_member_id: "", client_id: "", fixed_amount: "", notes: "" })
  const [isSaving, setIsSaving] = useState(false)
  useEffect(() => { setForm({ team_member_id: "", client_id: "", fixed_amount: "", notes: "" }) }, [isOpen])

  const lumpSumMemberIds = new Set(billRates.filter(r => r.cost_type === "lump_sum" && r.is_active).map(r => r.team_member_id))
  const eligibleMembers = teamMembers.filter(m => lumpSumMemberIds.has(m.id) && m.status === "active")
  const eligibleClients = form.team_member_id
    ? clients.filter(c => billRates.some(r => r.team_member_id === form.team_member_id && r.client_id === c.id && r.cost_type === "lump_sum" && r.is_active))
    : clients

  const handleSave = async () => {
    if (!form.team_member_id || !form.client_id || !form.fixed_amount) return
    setIsSaving(true)
    try { await onSave({ team_member_id: form.team_member_id, client_id: form.client_id, month: selectedMonth, fixed_amount: parseFloat(form.fixed_amount)||0, notes: form.notes||null }); onClose() } finally { setIsSaving(false) }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className={`${THEME.card} border ${THEME.border} rounded-xl w-full max-w-lg`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.border}`}>
          <div>
            <h3 className={`text-lg font-bold ${THEME.textPrimary}`}>Cost Override</h3>
            <p className={`text-xs ${THEME.textMuted}`}>Override auto-distribution for {formatMonth(selectedMonth)}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/[0.04] rounded-lg"><X size={20} className={THEME.textMuted} /></button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className={`block text-xs ${THEME.textMuted} mb-1`}>Team Member (Lump-Sum Only) *</label>
            <select value={form.team_member_id} onChange={e => setForm(p=>({...p,team_member_id:e.target.value,client_id:""}))}
              className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white">
              <option value="">Select...</option>
              {eligibleMembers.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className={`block text-xs ${THEME.textMuted} mb-1`}>Client *</label>
            <select value={form.client_id} onChange={e => setForm(p=>({...p,client_id:e.target.value}))}
              className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white">
              <option value="">Select...</option>
              {eligibleClients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={`block text-xs ${THEME.textMuted} mb-1`}>Fixed Amount ($) *</label>
            <input type="number" value={form.fixed_amount} onChange={e => setForm(p=>({...p,fixed_amount:e.target.value}))}
              className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white" placeholder="20000" />
            <p className={`text-xs ${THEME.textDim} mt-1`}>Overrides auto-calculated allocation for this month only</p>
          </div>
          <div>
            <label className={`block text-xs ${THEME.textMuted} mb-1`}>Notes</label>
            <input value={form.notes} onChange={e => setForm(p=>({...p,notes:e.target.value}))}
              className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white" placeholder="Per CEO request..." />
          </div>
        </div>
        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${THEME.border} bg-slate-800/30`}>
          <button onClick={onClose} className={`px-4 py-2 text-sm font-medium text-slate-500 hover:text-white transition-colors duration-200`}>Cancel</button>
          <button onClick={handleSave} disabled={!form.team_member_id||!form.client_id||!form.fixed_amount||isSaving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed">
            {isSaving && <RefreshCw size={14} className="animate-spin" />}Set Override
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ MEMBER MODAL ============
function MemberModal({ isOpen, onClose, onSave, editingMember }: {
  isOpen: boolean; onClose: () => void; onSave: (data: any) => Promise<void>; editingMember: TeamMember | null
}) {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", role: "", status: "active",
    employment_type: "contractor", start_date: "",
    entity_name: "", entity_type: "", address: "",
    bank_name: "", account_type: "", routing_number: "", account_number: "", payment_method: "",
    cost_type: "hourly" as "hourly" | "lump_sum", cost_amount: "",
  })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (editingMember) {
      setForm({
        name: editingMember.name||"", email: editingMember.email||"", phone: editingMember.phone||"",
        role: editingMember.role||"", status: editingMember.status||"active",
        employment_type: editingMember.employment_type||"contractor", start_date: editingMember.start_date||"",
        entity_name: editingMember.entity_name||"", entity_type: editingMember.entity_type||"",
        address: editingMember.address||"", bank_name: editingMember.bank_name||"",
        account_type: editingMember.account_type||"", routing_number: editingMember.routing_number||"",
        account_number: editingMember.account_number||"", payment_method: editingMember.payment_method||"",
        cost_type: editingMember.cost_type||"hourly", cost_amount: editingMember.cost_amount?.toString()||"",
      })
    } else {
      setForm({ name:"",email:"",phone:"",role:"",status:"active",employment_type:"contractor",start_date:"",
        entity_name:"",entity_type:"",address:"",bank_name:"",account_type:"",routing_number:"",account_number:"",
        payment_method:"",cost_type:"hourly",cost_amount:"" })
    }
  }, [editingMember, isOpen])

  const handleSave = async () => {
    if (!form.name || !form.email) return
    setIsSaving(true)
    try {
      const payload = {
        ...form,
        cost_amount: parseFloat(form.cost_amount) || 0,
        start_date: form.start_date || null,
        entity_name: form.entity_name || null,
        entity_type: form.entity_type || null,
        address: form.address || null,
        bank_name: form.bank_name || null,
        account_type: form.account_type || null,
        routing_number: form.routing_number || null,
        account_number: form.account_number || null,
        payment_method: form.payment_method || null,
        phone: form.phone || null,
      }
      await onSave(payload); onClose()
    } finally { setIsSaving(false) }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className={`${THEME.card} border ${THEME.border} rounded-xl w-full max-w-2xl my-8 flex flex-col max-h-[90vh]`}>
        <div className={`flex items-center justify-between px-6 py-4 border-b ${THEME.border}`}>
          <h3 className={`text-lg font-bold ${THEME.textPrimary}`}>{editingMember ? "Edit Team Member" : "Add Team Member"}</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/[0.04] rounded-lg"><X size={20} className={THEME.textMuted} /></button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Full Name *</label>
              <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white" /></div>
            <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Email *</label>
              <input type="email" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Phone</label>
              <input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))} className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white" /></div>
            <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Role / Title</label>
              <input value={form.role} onChange={e=>setForm(p=>({...p,role:e.target.value}))} className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white" /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Employment Type</label>
              <select value={form.employment_type} onChange={e=>setForm(p=>({...p,employment_type:e.target.value}))}
                className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white">
                {EMPLOYMENT_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
              </select></div>
            <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Status</label>
              <select value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value}))}
                className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white">
                {STATUS_OPTIONS.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
              </select></div>
            <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Start Date</label>
              <input type="date" value={form.start_date} onChange={e=>setForm(p=>({...p,start_date:e.target.value}))}
                className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white" /></div>
          </div>

          <div className={`pt-4 border-t ${THEME.border}`}>
            <h4 className={`text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-3`}>Default Cost (fallback when no rate card entry)</h4>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {COST_TYPES.map(t=>(
                <button key={t.id} type="button" onClick={()=>setForm(p=>({...p,cost_type:t.id as any}))}
                  className={`p-3 rounded-lg border text-left transition-all ${form.cost_type===t.id?"border-orange-500/50 bg-orange-950/30":"border-slate-800/50 hover:border-slate-700"}`}>
                  <p className={`text-sm font-medium ${form.cost_type===t.id?"text-orange-400":THEME.textPrimary}`}>{t.label}</p>
                  <p className={`text-xs ${THEME.textDim} mt-0.5`}>{t.description}</p>
                </button>
              ))}
            </div>
            <div>
              <label className={`block text-xs ${THEME.textMuted} mb-1`}>{form.cost_type==="hourly"?"Hourly Rate ($/hr)":"Monthly Amount ($/mo)"}</label>
              <input type="number" value={form.cost_amount} onChange={e=>setForm(p=>({...p,cost_amount:e.target.value}))}
                className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white"
                placeholder={form.cost_type==="hourly"?"75":"35000"} />
              {form.cost_type==="lump_sum" && form.cost_amount && (
                <p className={`text-xs ${THEME.textDim} mt-1`}>Effective rate: ~${(parseFloat(form.cost_amount)/172).toFixed(2)}/hr (172 hrs/mo)</p>
              )}
            </div>
          </div>

          {form.employment_type === "contractor" && (
            <>
              <div className={`pt-4 border-t ${THEME.border}`}>
                <h4 className={`text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-3`}>Entity Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Entity Name</label>
                    <input value={form.entity_name} onChange={e=>setForm(p=>({...p,entity_name:e.target.value}))}
                      className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white" placeholder="LLC or DBA" /></div>
                  <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Entity Type</label>
                    <select value={form.entity_type} onChange={e=>setForm(p=>({...p,entity_type:e.target.value}))}
                      className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white">
                      <option value="">Select...</option>{ENTITY_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
                    </select></div>
                </div>
                <div className="mt-4"><label className={`block text-xs ${THEME.textMuted} mb-1`}>Address</label>
                  <input value={form.address} onChange={e=>setForm(p=>({...p,address:e.target.value}))}
                    className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white" /></div>
              </div>
              <div className={`pt-4 border-t ${THEME.border}`}>
                <h4 className={`text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 mb-3`}>Payment Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Bank Name</label>
                    <input value={form.bank_name} onChange={e=>setForm(p=>({...p,bank_name:e.target.value}))}
                      className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white" /></div>
                  <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Account Type</label>
                    <select value={form.account_type} onChange={e=>setForm(p=>({...p,account_type:e.target.value}))}
                      className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white">
                      <option value="">Select...</option>{ACCOUNT_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
                    </select></div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Routing Number</label>
                    <input value={form.routing_number} onChange={e=>setForm(p=>({...p,routing_number:e.target.value}))}
                      className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white font-mono" /></div>
                  <div><label className={`block text-xs ${THEME.textMuted} mb-1`}>Account Number</label>
                    <input value={form.account_number} onChange={e=>setForm(p=>({...p,account_number:e.target.value}))}
                      className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white font-mono" /></div>
                </div>
                <div className="mt-4"><label className={`block text-xs ${THEME.textMuted} mb-1`}>Payment Method</label>
                  <select value={form.payment_method} onChange={e=>setForm(p=>({...p,payment_method:e.target.value}))}
                    className="w-full px-3 py-2 bg-[#0c1220] border border-slate-800/60 rounded-lg text-sm text-white">
                    <option value="">Select...</option>{PAYMENT_METHODS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
                  </select></div>
              </div>
            </>
          )}
        </div>
        <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${THEME.border} bg-slate-800/30`}>
          <button onClick={onClose} className={`px-4 py-2 text-sm font-medium text-slate-500 hover:text-white transition-colors duration-200`}>Cancel</button>
          <button onClick={handleSave} disabled={!form.name||!form.email||isSaving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed">
            {isSaving && <RefreshCw size={14} className="animate-spin" />}{editingMember ? "Save Changes" : "Add Member"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ MAIN PAGE ============
export default function TeamPage() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [billRates, setBillRates] = useState<BillRate[]>([])
  const [costOverrides, setCostOverrides] = useState<CostOverride[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([])

  const [activeTab, setActiveTab] = useState<"directory" | "rates" | "profitability">("directory")
  const [rateStatusFilter, setRateStatusFilter] = useState<"active" | "archived" | "all">("active")
  const [expandedRateMembers, setExpandedRateMembers] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [employmentFilter, setEmploymentFilter] = useState<"all" | "employee" | "contractor">("all")

  // Period state
  const [periodType, setPeriodType] = useState<PeriodType>("month")
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentMonth())
  const [profitView, setProfitView] = useState<"summary" | "revenue" | "cost">("summary")

  const [toasts, setToasts] = useState<Toast[]>([])
  const addToast = useCallback((type: Toast["type"], message: string) => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, type, message }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const [showMemberModal, setShowMemberModal] = useState(false)
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [showRateModal, setShowRateModal] = useState(false)
  const [editingRate, setEditingRate] = useState<BillRate | null>(null)
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [selectedMemberDetail, setSelectedMemberDetail] = useState<TeamMember | null>(null)

  // Reset period value when switching period type
  const handlePeriodTypeChange = (pt: PeriodType) => {
    setPeriodType(pt)
    setSelectedPeriod(getDefaultPeriod(pt))
  }

  // ---- DATA LOADING ----
  useEffect(() => {
    async function loadData() {
      try {
        const result = await getCurrentUser()
        const user = result?.user
        if (!user) { setLoading(false); return }
        const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single()
        if (!profile?.company_id) { setLoading(false); return }
        setCompanyId(profile.company_id)

        const [membersRes, clientsRes, projectsRes, billRatesRes, costOverridesRes, timeRes] = await Promise.all([
          supabase.from("team_members").select("*").eq("company_id", profile.company_id).order("name"),
          supabase.from("clients").select("id, name").eq("company_id", profile.company_id).order("name"),
          supabase.from("projects").select("id, name, client_id, status, budget").eq("company_id", profile.company_id),
          supabase.from("bill_rates").select("*").eq("company_id", profile.company_id),
          supabase.from("cost_overrides").select("*").eq("company_id", profile.company_id),
          supabase.from("time_entries").select("id, contractor_id, project_id, hours, billable_hours, is_billable, date").eq("company_id", profile.company_id),
        ])

        const clientMap = new Map((clientsRes.data || []).map(c => [c.id, c.name]))
        const memberMap = new Map((membersRes.data || []).map(m => [m.id, m.name]))

        setTeamMembers(membersRes.data || [])
        setClients(clientsRes.data || [])
        setProjects((projectsRes.data || []).map(p => ({ ...p, client_name: clientMap.get(p.client_id) || "" })))
        setBillRates((billRatesRes.data || []).map(r => ({
          ...r, team_member_name: memberMap.get(r.team_member_id) || "Unknown", client_name: clientMap.get(r.client_id) || "Unknown",
        })))
        setCostOverrides((costOverridesRes.data || []).map(o => ({
          ...o, team_member_name: memberMap.get(o.team_member_id) || "Unknown", client_name: clientMap.get(o.client_id) || "Unknown",
        })))
        setTimeEntries(timeRes.data || [])
      } catch (error) {
        console.error("Error loading data:", error)
        addToast("error", "Failed to load data")
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [addToast])

  // ---- COMPUTED ----
  const filteredMembers = useMemo(() => {
    return teamMembers.filter(m => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        if (!m.name?.toLowerCase().includes(q) && !m.email?.toLowerCase().includes(q)) return false
      }
      if (employmentFilter !== "all" && m.employment_type !== employmentFilter) return false
      return true
    })
  }, [teamMembers, searchQuery, employmentFilter])

  const summary = useMemo(() => {
    const active = teamMembers.filter(m => m.status === "active")
    return {
      total: teamMembers.length, active: active.length,
      employees: teamMembers.filter(m => m.employment_type === "employee").length,
      contractors: teamMembers.filter(m => m.employment_type === "contractor").length,
      activeRates: billRates.filter(r => r.is_active).length,
    }
  }, [teamMembers, billRates])

  // ---- PROFITABILITY ENGINE (reads from timesheet + rate card) ----
  const profitabilityData = useMemo(() => {
    const months = getMonthsInPeriod(selectedPeriod, periodType)
    const periodEntries = timeEntries.filter(t => {
      const m = t.date?.substring(0, 7)
      return months.includes(m)
    })
    const projectClientMap = new Map(projects.map(p => [p.id, p.client_id || ""]))

    // Helper: check if a rate card is active for the given period
    const isRateActiveInPeriod = (r: BillRate) => {
      if (!r.is_active) return false
      // Check date overlap: rate card [start_date, end_date] overlaps with period months
      const periodStart = months[0] + "-01"
      const periodEnd = months[months.length - 1] + "-28" // approximate month end
      if (r.start_date && r.start_date > periodEnd) return false
      if (r.end_date && r.end_date < periodStart) return false
      return true
    }

    // Count months active for lump sum calculations
    const countActiveMonths = (r: BillRate) => {
      return months.filter(mo => {
        const moStart = mo + "-01"
        const moEnd = mo + "-28"
        if (r.start_date && r.start_date > moEnd) return false
        if (r.end_date && r.end_date < moStart) return false
        return true
      }).length
    }

    return teamMembers.map(member => {
      const memberTime = periodEntries.filter(t => t.contractor_id === member.id)
      const totalHours = memberTime.reduce((sum, t) => sum + (t.hours || 0), 0)
      
      // Get active rate cards for this member in this period
      const memberRates = billRates.filter(r => r.team_member_id === member.id && isRateActiveInPeriod(r))
      const hasLumpSumRevenue = memberRates.some(r => r.revenue_type === "lump_sum" && r.revenue_amount > 0)
      
      // Skip if no hours AND no lump sum revenue
      if (totalHours === 0 && !hasLumpSumRevenue) return null

      // Group hours by client (actual for cost, billable for revenue)
      const hoursByClient: Record<string, number> = {}
      const billableHoursByClient: Record<string, number> = {}
      memberTime.forEach(t => {
        const clientId = projectClientMap.get(t.project_id) || "unknown"
        hoursByClient[clientId] = (hoursByClient[clientId] || 0) + (t.hours || 0)
        // Use billable_hours for revenue; fall back to actual hours if not set
        const bh = t.billable_hours != null ? t.billable_hours : (t.hours || 0)
        billableHoursByClient[clientId] = (billableHoursByClient[clientId] || 0) + bh
      })

      // REVENUE by client
      const revenueByClient: Record<string, number> = {}
      let totalRevenue = 0
      
      // Hourly revenue from BILLABLE hours (what client is billed)
      Object.entries(billableHoursByClient).forEach(([clientId, billableHrs]) => {
        const rc = memberRates.find(r => r.client_id === clientId && r.revenue_type !== "lump_sum")
        const rev = billableHrs * (rc?.rate || 0)
        revenueByClient[clientId] = (revenueByClient[clientId] || 0) + rev
        totalRevenue += rev
      })
      
      // Lump sum revenue from rate cards (regardless of hours)
      memberRates.filter(r => r.revenue_type === "lump_sum" && r.revenue_amount > 0).forEach(r => {
        const activeMonths = countActiveMonths(r)
        const lsRev = r.revenue_amount * activeMonths
        revenueByClient[r.client_id] = (revenueByClient[r.client_id] || 0) + lsRev
        totalRevenue += lsRev
        // Ensure client appears in hoursByClient even with 0 hours
        if (!hoursByClient[r.client_id]) hoursByClient[r.client_id] = 0
        if (!billableHoursByClient[r.client_id]) billableHoursByClient[r.client_id] = 0
      })

      // COST by client — TWO-TIER:
      const costByClient: Record<string, number> = {}
      let totalCost = 0
      const distributedClients: string[] = []

      Object.keys(hoursByClient).forEach(clientId => {
        const hours = hoursByClient[clientId] || 0
        const rc = memberRates.find(r => r.client_id === clientId)

        if (rc && rc.cost_amount > 0) {
          if (rc.cost_type === "hourly") {
            costByClient[clientId] = hours * rc.cost_amount
          } else {
            let lsCost = 0
            const activeMonths = countActiveMonths(rc)
            months.forEach(mo => {
              // Check if rate is active this month
              const moStart = mo + "-01"; const moEnd = mo + "-28"
              if (rc.start_date && rc.start_date > moEnd) return
              if (rc.end_date && rc.end_date < moStart) return
              const override = costOverrides.find(o => o.team_member_id === member.id && o.client_id === clientId && o.month === mo)
              lsCost += override ? override.fixed_amount : rc.cost_amount
            })
            costByClient[clientId] = lsCost
          }
        } else {
          distributedClients.push(clientId)
        }
      })

      // Second pass: distribute member total cost across distributed clients
      if (distributedClients.length > 0 && (member.cost_amount || 0) > 0) {
        if (member.cost_type === "hourly") {
          distributedClients.forEach(clientId => {
            costByClient[clientId] = (hoursByClient[clientId] || 0) * (member.cost_amount || 0)
          })
        } else {
          const distHours = distributedClients.reduce((s, cid) => s + (hoursByClient[cid] || 0), 0)
          distributedClients.forEach(clientId => {
            let clientCost = 0
            months.forEach(mo => {
              const override = costOverrides.find(o => o.team_member_id === member.id && o.client_id === clientId && o.month === mo)
              if (override) {
                clientCost += override.fixed_amount
              } else {
                const pct = distHours > 0 ? (hoursByClient[clientId] || 0) / distHours : 0
                clientCost += pct * (member.cost_amount || 0)
              }
            })
            costByClient[clientId] = clientCost
          })
        }
      }

      totalCost = Object.values(costByClient).reduce((s, v) => s + v, 0)

      const margin = totalRevenue - totalCost
      const marginPct = totalRevenue > 0 ? (margin / totalRevenue) * 100 : (totalCost > 0 ? -100 : 0)

      const hasCustom = memberRates.some(r => r.cost_amount > 0)
      const hasDist = distributedClients.length > 0
      const costLabel = hasCustom && hasDist ? "Mixed" : hasCustom ? "Custom" : "Distributed"

      return { id: member.id, name: member.name, costLabel, hours: totalHours,
        cost: totalCost, revenue: totalRevenue, margin, marginPct,
        hoursByClient, revenueByClient, costByClient }
    }).filter(Boolean) as Array<{
      id: string; name: string; costLabel: string; hours: number; cost: number; revenue: number
      margin: number; marginPct: number
      hoursByClient: Record<string, number>; revenueByClient: Record<string, number>; costByClient: Record<string, number>
    }>
  }, [teamMembers, billRates, costOverrides, timeEntries, projects, selectedPeriod, periodType])

  const profitClients = useMemo(() => {
    const ids = new Set<string>()
    profitabilityData.forEach(m => {
      Object.keys(m.revenueByClient).forEach(id => ids.add(id))
      Object.keys(m.costByClient).forEach(id => ids.add(id))
    })
    return Array.from(ids).map(id => ({ id, name: clients.find(c => c.id === id)?.name || "Unknown" })).sort((a, b) => a.name.localeCompare(b.name))
  }, [profitabilityData, clients])

  const profitTotals = useMemo(() => {
    const c = profitabilityData.reduce((s, m) => s + m.cost, 0)
    const r = profitabilityData.reduce((s, m) => s + m.revenue, 0)
    return { cost: c, revenue: r, margin: r - c, marginPct: r > 0 ? ((r - c) / r * 100) : 0,
      hours: profitabilityData.reduce((s, m) => s + m.hours, 0) }
  }, [profitabilityData])

  // ---- HANDLERS ----
  const handleSaveMember = async (data: any) => {
    if (!companyId) return
    try {
      if (editingMember) {
        const { error } = await supabase.from("team_members").update(data).eq("id", editingMember.id)
        if (error) throw error
        setTeamMembers(prev => prev.map(m => m.id === editingMember.id ? { ...m, ...data } : m))
        addToast("success", "Team member updated")
      } else {
        const { data: newMember, error } = await supabase.from("team_members").insert({ company_id: companyId, ...data }).select().single()
        if (error) throw error
        setTeamMembers(prev => [...prev, newMember])
        addToast("success", "Team member added")
      }
      setEditingMember(null)
    } catch (error: any) { addToast("error", `Failed to save: ${error.message}`); throw error }
  }

  const handleSaveRate = async (data: any) => {
    if (!companyId) return
    try {
      const memberName = teamMembers.find(m => m.id === data.team_member_id)?.name
      const clientName = clients.find(c => c.id === data.client_id)?.name
      if (editingRate) {
        const { error } = await supabase.from("bill_rates").update({
          rate: data.rate, notes: data.notes,
          cost_type: data.cost_type, cost_amount: data.cost_amount, baseline_hours: data.baseline_hours,
          revenue_type: data.revenue_type, revenue_amount: data.revenue_amount,
          start_date: data.start_date, end_date: data.end_date,
        }).eq("id", editingRate.id)
        if (error) throw error
        setBillRates(prev => prev.map(r => r.id === editingRate.id ? { ...r, ...data, team_member_name: memberName, client_name: clientName } : r))
        addToast("success", "Rate card updated")
      } else {
        const { data: newRate, error } = await supabase.from("bill_rates").insert({ company_id: companyId, ...data }).select().single()
        if (error) throw error
        setBillRates(prev => [...prev, { ...newRate, team_member_name: memberName, client_name: clientName }])
        addToast("success", "Rate card added")
      }
      setEditingRate(null)
    } catch (error: any) { addToast("error", `Failed to save: ${error.message}`); throw error }
  }

  const handleDeleteRate = async (id: string) => {
    try {
      const { error } = await supabase.from("bill_rates").update({ is_active: false }).eq("id", id)
      if (error) throw error
      setBillRates(prev => prev.map(r => r.id === id ? { ...r, is_active: false } : r))
      addToast("success", "Rate card archived")
    } catch (error: any) { addToast("error", `Failed to archive: ${error.message}`) }
  }

  const handleReactivateRate = async (id: string) => {
    try {
      const { error } = await supabase.from("bill_rates").update({ is_active: true }).eq("id", id)
      if (error) throw error
      setBillRates(prev => prev.map(r => r.id === id ? { ...r, is_active: true } : r))
      addToast("success", "Rate card reactivated")
    } catch (error: any) { addToast("error", `Failed to reactivate: ${error.message}`) }
  }

  const handleSaveOverride = async (data: any) => {
    if (!companyId) return
    try {
      const { data: newOverride, error } = await supabase.from("cost_overrides")
        .upsert({ company_id: companyId, ...data }, { onConflict: "company_id,team_member_id,client_id,month" })
        .select().single()
      if (error) throw error
      const memberName = teamMembers.find(m => m.id === data.team_member_id)?.name
      const clientName = clients.find(c => c.id === data.client_id)?.name
      setCostOverrides(prev => {
        const idx = prev.findIndex(o => o.team_member_id === data.team_member_id && o.client_id === data.client_id && o.month === data.month)
        const enriched = { ...newOverride, team_member_name: memberName, client_name: clientName }
        if (idx >= 0) { const u = [...prev]; u[idx] = enriched; return u }
        return [...prev, enriched]
      })
      addToast("success", "Cost override saved")
    } catch (error: any) { addToast("error", `Failed to save: ${error.message}`); throw error }
  }

  const handleDeleteOverride = async (id: string) => {
    try {
      const { error } = await supabase.from("cost_overrides").delete().eq("id", id)
      if (error) throw error
      setCostOverrides(prev => prev.filter(o => o.id !== id))
      addToast("success", "Override removed")
    } catch (error: any) { addToast("error", `Failed to delete: ${error.message}`) }
  }

  const exportToCSV = () => {
    const headers = ["Name", "Email", "Type", "Entity", "Status", "Role", "Cost Type", "Cost Amount"]
    const rows = teamMembers.map(m => [m.name, m.email, m.employment_type, m.entity_name, m.status, m.role, m.cost_type, m.cost_amount])
    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c || ""}"`).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `team-${new Date().toISOString().split("T")[0]}.csv`; a.click()
    addToast("success", "Export complete")
  }

  if (loading) return (
    <div className="flex items-center justify-center h-[60vh]">
      <div className="text-center">
        <RefreshCw className="w-7 h-7 text-teal-400 animate-spin mx-auto mb-3" />
        <p className={`text-sm ${THEME.textMuted}`}>Loading team...</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} onDismiss={id => setToasts(prev => prev.filter(t => t.id !== id))} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Team</h1>
          <p className={`text-sm mt-0.5 ${THEME.textDim}`}>Manage team members, rates, and profitability</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportToCSV} className={`flex items-center gap-2 px-4 py-2 ${THEME.card} border hover:bg-white/[0.05] rounded-lg text-slate-400 text-sm font-medium transition-all duration-200`}>
            <Download size={14} /> Export
          </button>
          {activeTab === "directory" && (
            <button onClick={() => { setEditingMember(null); setShowMemberModal(true) }} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-500 active:bg-teal-700 shadow-lg shadow-teal-950/30 transition-all duration-200">
              <Plus size={14} /> Add Member
            </button>
          )}
          {activeTab === "rates" && (
            <button onClick={() => { setEditingRate(null); setShowRateModal(true) }} className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-500 active:bg-teal-700 shadow-lg shadow-teal-950/30 transition-all duration-200">
              <Plus size={14} /> Add Rate Card
            </button>
          )}
          {activeTab === "profitability" && (
            <button onClick={() => setShowOverrideModal(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-500 active:bg-amber-700 shadow-lg shadow-amber-950/30 transition-all duration-200">
              <Edit2 size={14} /> Cost Override
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={`flex items-center gap-0 border-b ${THEME.border}`}>
        {([
          { id: "directory" as const, label: "Directory", icon: Users },
          { id: "rates" as const, label: "Rates", icon: DollarSign },
          { id: "profitability" as const, label: "Profitability", icon: BarChart3 },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id ? "border-teal-400 text-teal-400" : "border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-700"
            }`}>
            <tab.icon size={15} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Summary Cards — left-accent-bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className={`relative p-4 rounded-xl ${THEME.card} border overflow-hidden`}>
          <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-white/20" />
          <div className="pl-2">
            <span className={`text-[11px] font-semibold ${THEME.textDim} uppercase tracking-wider`}>Total Members</span>
            <p className="text-xl font-semibold text-white tabular-nums mt-1">{summary.total}</p>
            <p className={`text-xs ${THEME.textDim} mt-0.5`}>{summary.active} active</p>
          </div>
        </div>
        <div className={`relative p-4 rounded-xl ${THEME.card} border overflow-hidden`}>
          <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-blue-500" />
          <div className="pl-2">
            <span className={`text-[11px] font-semibold ${THEME.textDim} uppercase tracking-wider`}>W-2 Employees</span>
            <p className="text-xl font-semibold text-blue-400 tabular-nums mt-1">{summary.employees}</p>
          </div>
        </div>
        <div className={`relative p-4 rounded-xl ${THEME.card} border overflow-hidden`}>
          <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-purple-500" />
          <div className="pl-2">
            <span className={`text-[11px] font-semibold ${THEME.textDim} uppercase tracking-wider`}>1099 Contractors</span>
            <p className="text-xl font-semibold text-purple-400 tabular-nums mt-1">{summary.contractors}</p>
          </div>
        </div>
        <div className={`relative p-4 rounded-xl ${THEME.card} border overflow-hidden`}>
          <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-teal-500" />
          <div className="pl-2">
            <span className={`text-[11px] font-semibold ${THEME.textDim} uppercase tracking-wider`}>Active Rate Cards</span>
            <p className="text-xl font-semibold text-teal-400 tabular-nums mt-1">{summary.activeRates}</p>
          </div>
        </div>
        <div className={`relative p-4 rounded-xl ${THEME.card} border overflow-hidden`}>
          <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-emerald-500" />
          <div className="pl-2">
            <span className={`text-[11px] font-semibold ${THEME.textDim} uppercase tracking-wider`}>GM% ({formatPeriodLabel(selectedPeriod, periodType).split(" ")[0]})</span>
            <p className={`text-xl font-semibold tabular-nums mt-1 ${profitTotals.marginPct >= 20 ? "text-emerald-400" : profitTotals.marginPct >= 0 ? "text-amber-400" : "text-rose-400"}`}>
              {profitTotals.revenue > 0 ? `${profitTotals.marginPct.toFixed(1)}%` : "\u2014"}
            </p>
          </div>
        </div>
      </div>

      {/* ============ DIRECTORY TAB ============ */}
      {activeTab === "directory" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by name or email..."
                className={`w-full pl-9 pr-4 py-2 bg-[#0c1220] border border-slate-800/50 rounded-lg text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500/40 transition-all duration-200`} />
            </div>
            <div className="flex items-center gap-0.5 p-0.5 bg-[#0c1220] rounded-lg border border-slate-800/50">
              {(["all", "employee", "contractor"] as const).map(f => (
                <button key={f} onClick={() => setEmploymentFilter(f)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${employmentFilter === f ? "bg-white/[0.08] text-white" : "text-slate-500 hover:text-slate-300"}`}>
                  {f === "all" ? "All" : f === "employee" ? "W-2" : "1099"}
                </button>
              ))}
            </div>
          </div>

          <div className={`${THEME.card} border ${THEME.border} rounded-xl overflow-hidden`}>
            <table className="w-full text-sm">
              <thead>
                <tr className={`bg-white/[0.02] border-b ${THEME.border}`}>
                  <th className={`px-4 py-2.5 text-left text-[11px] ${THEME.textDim} font-semibold uppercase tracking-wider`}>Name</th>
                  <th className={`px-4 py-2.5 text-left text-[11px] ${THEME.textDim} font-semibold uppercase tracking-wider`}>Type</th>
                  <th className={`px-4 py-2.5 text-left text-[11px] ${THEME.textDim} font-semibold uppercase tracking-wider`}>Role</th>
                  <th className={`px-4 py-2.5 text-right text-[11px] ${THEME.textDim} font-semibold uppercase tracking-wider`}>Cost</th>
                  <th className={`px-4 py-2.5 text-center text-[11px] ${THEME.textDim} font-semibold uppercase tracking-wider`}>Status</th>
                  <th className={`px-4 py-2.5 text-center text-[11px] ${THEME.textDim} font-semibold uppercase tracking-wider w-20`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map(m => {
                  const stStyle = getStatusStyle(m.status)
                  const empStyle = getEmploymentStyle(m.employment_type)
                  const rateCount = billRates.filter(r => r.team_member_id === m.id && r.is_active).length
                  return (
                    <tr key={m.id} className="border-b border-slate-800/40 hover:bg-white/[0.03] cursor-pointer transition-colors duration-150"
                      onClick={() => setSelectedMemberDetail(m)}>
                      <td className="px-4 py-3">
                        <p className={`font-medium ${THEME.textPrimary}`}>{m.name}</p>
                        <p className={`text-xs ${THEME.textDim}`}>{m.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${empStyle.border} ${empStyle.bg} ${empStyle.text}`}>
                          {m.employment_type === "employee" ? "W-2" : "1099"}
                        </span>
                      </td>
                      <td className={`px-4 py-3 ${THEME.textSecondary}`}>{m.role || "\u2014"}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-orange-400 font-medium tabular-nums">
                          {m.cost_amount ? (m.cost_type === "hourly" ? `$${m.cost_amount}/hr` : `${formatCurrency(m.cost_amount)}/mo`) : "\u2014"}
                        </span>
                        {rateCount > 0 && <p className={`text-xs ${THEME.textDim}`}>{rateCount} rate card{rateCount > 1 ? "s" : ""}</p>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${stStyle.border} ${stStyle.bg} ${stStyle.text}`}>{m.status}</span>
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center">
                          <button onClick={() => { setEditingMember(m); setShowMemberModal(true) }} className="p-1.5 rounded hover:bg-white/[0.05] text-slate-600 hover:text-slate-300 transition-colors duration-150">
                            <Edit2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {filteredMembers.length === 0 && (
                  <tr><td colSpan={6} className={`px-4 py-12 text-center ${THEME.textMuted}`}>No team members found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============ RATES TAB ============ */}
      {activeTab === "rates" && (
        <div className={`${THEME.card} border ${THEME.border} rounded-xl overflow-hidden`}>
          <div className={`px-6 py-4 border-b ${THEME.border} flex items-center justify-between`}>
            <div>
              <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Rate Card</h3>
              <p className={`text-xs ${THEME.textMuted} mt-0.5`}>Cost + Revenue per team member per client</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button onClick={() => {
                  const allIds = new Set(billRates.map(r => r.team_member_id))
                  setExpandedRateMembers(prev => prev.size === allIds.size ? new Set() : allIds)
                }} className={`text-[11px] ${THEME.textMuted} hover:text-white transition-colors`}>
                  {expandedRateMembers.size > 0 ? "Collapse All" : "Expand All"}
                </button>
              </div>
              <div className="flex items-center gap-0.5 p-0.5 bg-[#0c1220] rounded-lg border border-slate-800/50">
                {(["active", "archived", "all"] as const).map(f => (
                  <button key={f} onClick={() => setRateStatusFilter(f)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${rateStatusFilter === f ? "bg-white/[0.08] text-white" : "text-slate-500 hover:text-slate-300"}`}>
                    {f === "active" ? `Active (${billRates.filter(r => r.is_active).length})` : f === "archived" ? `Archived (${billRates.filter(r => !r.is_active).length})` : `All (${billRates.length})`}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {(() => {
            const filteredRates = billRates.filter(r => rateStatusFilter === "all" ? true : rateStatusFilter === "active" ? r.is_active : !r.is_active)
            
            // Group by team member
            const grouped = new Map<string, { member: TeamMember | undefined; memberName: string; rates: BillRate[] }>()
            filteredRates.forEach(r => {
              if (!grouped.has(r.team_member_id)) {
                grouped.set(r.team_member_id, {
                  member: teamMembers.find(m => m.id === r.team_member_id),
                  memberName: r.team_member_name || "Unknown",
                  rates: []
                })
              }
              grouped.get(r.team_member_id)!.rates.push(r)
            })
            // Sort by member name
            const groups = Array.from(grouped.entries()).sort((a, b) => a[1].memberName.localeCompare(b[1].memberName))

            return groups.length > 0 ? (
              <div>
                {groups.map(([memberId, group]) => {
                  const isExpanded = expandedRateMembers.has(memberId)
                  const activeCount = group.rates.filter(r => r.is_active).length
                  const clientCount = new Set(group.rates.map(r => r.client_name)).size
                  const member = group.member

                  // Determine member's cost structure label
                  const costLabel = (() => {
                    const hasRateCardCosts = group.rates.some(r => r.cost_amount > 0)
                    if (hasRateCardCosts && group.rates.every(r => r.cost_amount > 0)) return "Per rate card"
                    if (!hasRateCardCosts && member?.cost_amount && member.cost_amount > 0) {
                      const mct = (member.cost_type || "").toLowerCase().replace(/\s+/g, "_")
                      return mct === "lump_sum" ? `${formatCurrency(member.cost_amount)}/mo` : `$${member.cost_amount}/hr`
                    }
                    return "Mixed"
                  })()

                  return (
                    <div key={memberId}>
                      {/* Member Header Row */}
                      <div
                        onClick={() => setExpandedRateMembers(prev => {
                          const next = new Set(prev)
                          next.has(memberId) ? next.delete(memberId) : next.add(memberId)
                          return next
                        })}
                        className={`flex items-center px-4 py-3.5 cursor-pointer hover:bg-white/[0.03] transition-all duration-150 border-b border-slate-800/40 ${isExpanded ? "bg-slate-800/30" : ""}`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <ChevronRight size={14} className={`${THEME.textDim} transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                          <div className="w-8 h-8 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center flex-shrink-0">
                            <span className={`text-xs font-medium ${THEME.textSecondary}`}>{group.memberName.split(" ").map(n => n[0]).join("").slice(0, 2)}</span>
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm font-medium ${THEME.textPrimary} truncate`}>{group.memberName}</p>
                            <p className={`text-xs ${THEME.textDim}`}>
                              {member?.role || "—"} · {clientCount} client{clientCount !== 1 ? "s" : ""} · {activeCount} rate{activeCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <span className={`text-xs px-2 py-1 rounded-md bg-white/[0.04] border border-slate-800/40 ${THEME.textMuted} hidden sm:inline-block`}>
                            Cost: {costLabel}
                          </span>
                        </div>
                      </div>

                      {/* Expanded Rate Cards */}
                      {isExpanded && (
                        <div className="bg-white/[0.02]">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className={`border-b ${THEME.border}`}>
                                <th className={`pl-14 pr-4 py-2 text-left text-[11px] ${THEME.textDim} font-medium uppercase tracking-wider`}>Client</th>
                                <th className={`px-4 py-2 text-center text-[11px] ${THEME.textDim} font-medium uppercase tracking-wider`}>Period</th>
                                <th className={`px-4 py-2 text-right text-[11px] ${THEME.textDim} font-medium uppercase tracking-wider`}>Cost</th>
                                <th className={`px-4 py-2 text-right text-[11px] ${THEME.textDim} font-medium uppercase tracking-wider`}>Revenue</th>
                                <th className={`px-4 py-2 text-right text-[11px] ${THEME.textDim} font-medium uppercase tracking-wider`}>Margin</th>
                                <th className={`px-4 py-2 text-center text-[11px] ${THEME.textDim} font-medium uppercase tracking-wider w-20`}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.rates.map(r => {
                                const hasCustomCost = r.cost_amount > 0
                                const effCost = hasCustomCost ? (r.cost_type === "hourly" ? r.cost_amount : (r.baseline_hours > 0 ? r.cost_amount / r.baseline_hours : 0)) : 0
                                const isLumpRev = r.revenue_type === "lump_sum"
                                const revAmt = r.revenue_amount || 0
                                const margin = isLumpRev
                                  ? (hasCustomCost && revAmt > 0 ? ((revAmt - (r.cost_type === "hourly" ? r.cost_amount * (r.baseline_hours || 172) : r.cost_amount)) / revAmt * 100) : 0)
                                  : (hasCustomCost && r.rate > 0 ? ((r.rate - effCost) / r.rate * 100) : 0)
                                const spread = isLumpRev ? 0 : (hasCustomCost ? r.rate - effCost : 0)
                                const startStr = r.start_date ? new Date(r.start_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "2-digit" }) : ""
                                const endStr = r.end_date ? new Date(r.end_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "2-digit" }) : "Ongoing"
                                return (
                                  <tr key={r.id} className={`border-b border-slate-800/40 hover:bg-white/[0.03] ${!r.is_active ? "opacity-40" : ""}`}>
                                    <td className={`pl-14 pr-4 py-2.5 ${THEME.textSecondary}`}>
                                      {r.client_name}
                                      <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${
                                        hasCustomCost ? (r.cost_type === "lump_sum" ? "bg-purple-950/40 text-purple-400" : "bg-blue-950/40 text-blue-400") : "bg-slate-800/60 text-slate-500"
                                      }`}>{hasCustomCost ? (r.cost_type === "lump_sum" ? "Fixed" : "T&M") : "Dist"}</span>
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                      <span className={`text-xs ${THEME.textMuted}`}>{startStr} → {endStr}</span>
                                      {!r.is_active && <p className="text-[10px] text-rose-400">Archived</p>}
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                      {hasCustomCost ? (
                                        <>
                                          <span className="text-orange-400 text-xs">{r.cost_type === "hourly" ? `$${r.cost_amount}/hr` : `${formatCurrency(r.cost_amount)}/mo`}</span>
                                          {r.cost_type === "lump_sum" && <p className={`text-[10px] ${THEME.textDim}`}>~${effCost.toFixed(2)}/hr</p>}
                                        </>
                                      ) : (
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded bg-blue-950/40 text-blue-400`}>
                                          From {member?.cost_type === "lump_sum" ? formatCurrency(member?.cost_amount || 0) + "/mo" : `$${member?.cost_amount || 0}/hr`}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                      {isLumpRev ? (
                                        <>
                                          <span className="text-emerald-400 font-medium text-xs">{formatCurrency(revAmt)}/mo</span>
                                          <p className={`text-[10px] ${THEME.textDim}`}>Lump Sum</p>
                                        </>
                                      ) : (
                                        <span className="text-emerald-400 font-medium text-xs">${r.rate}/hr</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5 text-right">
                                      {(hasCustomCost || isLumpRev) && margin !== 0 ? (
                                        <>
                                          <span className={`text-xs font-medium ${margin >= 20 ? "text-emerald-400" : margin >= 0 ? "text-amber-400" : "text-rose-400"}`}>{margin.toFixed(0)}%</span>
                                          {!isLumpRev && spread !== 0 && <p className={`text-[10px] ${spread >= 0 ? "text-emerald-400/60" : "text-rose-400/60"}`}>${spread.toFixed(2)}/hr</p>}
                                        </>
                                      ) : (
                                        <span className={`text-[10px] ${THEME.textDim}`}>By hours</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <div className="flex items-center justify-center gap-1">
                                        <button onClick={(e) => { e.stopPropagation(); setEditingRate(r); setShowRateModal(true) }} className="p-1 rounded hover:bg-white/[0.05] text-slate-600 hover:text-slate-300 transition-colors duration-150"><Edit2 size={13} /></button>
                                        {r.is_active ? (
                                          <button onClick={(e) => { e.stopPropagation(); handleDeleteRate(r.id) }} title="Archive" className="p-1 rounded hover:bg-amber-500/10 text-slate-600 hover:text-amber-400 transition-colors duration-150"><Lock size={13} /></button>
                                        ) : (
                                          <button onClick={(e) => { e.stopPropagation(); handleReactivateRate(r.id) }} title="Reactivate" className="p-1 rounded hover:bg-emerald-500/10 text-slate-600 hover:text-emerald-400 transition-colors duration-150"><Unlock size={13} /></button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
            <div className={`px-6 py-12 text-center ${THEME.textMuted}`}>
              <DollarSign size={48} className="mx-auto text-slate-700 mb-4" />
              <p>No rate cards configured yet</p>
              <p className={`text-xs ${THEME.textDim} mt-1`}>Add rate cards to define cost + bill rates per client</p>
              <button onClick={() => { setEditingRate(null); setShowRateModal(true) }}
                className="mt-4 px-4 py-2 bg-teal-950/40 text-teal-400 rounded-lg text-sm font-semibold hover:bg-teal-900/40 border border-teal-800/30 transition-all duration-200">
                Add First Rate Card
              </button>
            </div>
          )
          })()}
        </div>
      )}

      {/* ============ PROFITABILITY TAB ============ */}
      {activeTab === "profitability" && (
        <div className="space-y-6">
          {/* Period Selector + View Toggle */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5 p-0.5 bg-[#0c1220] rounded-lg border border-slate-800/50">
                {(["month", "quarter", "year"] as PeriodType[]).map(pt => (
                  <button key={pt} onClick={() => handlePeriodTypeChange(pt)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${periodType === pt ? "bg-white/[0.08] text-white" : "text-slate-500 hover:text-slate-300"}`}>
                    {pt === "month" ? "Month" : pt === "quarter" ? "Quarter" : "Year"}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setSelectedPeriod(stepPeriod(selectedPeriod, periodType, -1))} className={`p-1.5 rounded-lg ${THEME.card} border hover:bg-white/[0.05] text-slate-600 hover:text-slate-300 transition-colors duration-150 transition-all duration-200`}>
                  <ChevronDown size={14} className="rotate-90" />
                </button>
                <span className={`text-white text-sm font-medium px-3 py-1.5 ${THEME.card} border rounded-lg min-w-[150px] text-center tabular-nums`}>{formatPeriodLabel(selectedPeriod, periodType)}</span>
                <button onClick={() => setSelectedPeriod(stepPeriod(selectedPeriod, periodType, 1))} className={`p-1.5 rounded-lg ${THEME.card} border hover:bg-white/[0.05] text-slate-600 hover:text-slate-300 transition-colors duration-150 transition-all duration-200`}>
                  <ChevronDown size={14} className="-rotate-90" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-0.5 p-0.5 bg-[#0c1220] rounded-lg border border-slate-800/50">
              {([
                { id: "summary" as const, label: "Summary", color: "text-teal-400" },
                { id: "revenue" as const, label: "Revenue", color: "text-blue-400" },
                { id: "cost" as const, label: "Cost", color: "text-orange-400" },
              ]).map(v => (
                <button key={v.id} onClick={() => setProfitView(v.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${profitView === v.id ? `bg-slate-700 ${v.color}` : "text-slate-500 hover:text-slate-300"}`}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Period Totals Bar */}
          {profitabilityData.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className={`relative p-4 rounded-xl ${THEME.card} border overflow-hidden`}>
                <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-white/20" />
                <div className="pl-2">
                  <span className={`text-[11px] font-semibold ${THEME.textDim} uppercase tracking-wider`}>Hours</span>
                  <p className="text-xl font-semibold text-white tabular-nums mt-1">{profitTotals.hours.toFixed(1)}</p>
                </div>
              </div>
              <div className={`relative p-4 rounded-xl ${THEME.card} border overflow-hidden`}>
                <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-teal-500" />
                <div className="pl-2">
                  <span className={`text-[11px] font-semibold ${THEME.textDim} uppercase tracking-wider`}>Revenue</span>
                  <p className="text-xl font-semibold text-teal-400 tabular-nums mt-1">{formatCurrency(profitTotals.revenue)}</p>
                </div>
              </div>
              <div className={`relative p-4 rounded-xl ${THEME.card} border overflow-hidden`}>
                <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-slate-500" />
                <div className="pl-2">
                  <span className={`text-[11px] font-semibold ${THEME.textDim} uppercase tracking-wider`}>Cost</span>
                  <p className="text-xl font-semibold text-slate-300 tabular-nums mt-1">{formatCurrency(profitTotals.cost)}</p>
                </div>
              </div>
              <div className={`relative p-4 rounded-xl ${THEME.card} border overflow-hidden`}>
                <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full" style={{ backgroundColor: profitTotals.margin >= 0 ? '#059669' : '#f43f5e' }} />
                <div className="pl-2">
                  <span className={`text-[11px] font-semibold ${THEME.textDim} uppercase tracking-wider`}>Margin</span>
                  <p className={`text-xl font-semibold tabular-nums mt-1 ${profitTotals.margin >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatCurrency(profitTotals.margin)}</p>
                </div>
              </div>
              <div className={`relative p-4 rounded-xl ${THEME.card} border overflow-hidden`}>
                <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full" style={{ backgroundColor: profitTotals.marginPct >= 20 ? '#059669' : profitTotals.marginPct >= 0 ? '#d97706' : '#f43f5e' }} />
                <div className="pl-2">
                  <span className={`text-[11px] font-semibold ${THEME.textDim} uppercase tracking-wider`}>GM%</span>
                  <p className={`text-xl font-semibold tabular-nums mt-1 ${profitTotals.marginPct >= 20 ? "text-emerald-400" : profitTotals.marginPct >= 0 ? "text-amber-400" : "text-rose-400"}`}>{profitTotals.marginPct.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          )}

          {/* Chart */}
          {profitabilityData.length > 0 && (
            <div className={`${THEME.card} border ${THEME.border} rounded-xl p-6`}>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={profitabilityData} margin={{ left: 20, right: 20 }}>
                    <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => formatCompactCurrency(v)} />
                    <Tooltip contentStyle={{ backgroundColor: "#0f1623", border: "1px solid rgba(51,65,85,0.3)", borderRadius: "8px" }} labelStyle={{ color: "#fff" }}
                      formatter={(value: number, name: string) => [formatCurrency(value), name.toLowerCase() === "cost" ? "Cost" : "Revenue"]} cursor={false} />
                    <Legend wrapperStyle={{ paddingTop: "10px" }} />
                    <Bar dataKey="cost" name="Cost" fill={CHART_COLORS.cost} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS.revenue} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* SUMMARY VIEW */}
          {profitView === "summary" && profitabilityData.length > 0 && (
            <div className={`${THEME.card} border ${THEME.border} rounded-xl overflow-hidden`}>
              <div className={`px-6 py-4 border-b ${THEME.border} flex items-center gap-2`}>
                <div className="w-2.5 h-2.5 rounded-full bg-teal-400" style={{ animationDuration: "3s" }} />
                <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Direct Cost Analysis &mdash; {formatPeriodLabel(selectedPeriod, periodType)}</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className={`bg-white/[0.02] border-b ${THEME.border}`}>
                    <th className={`px-4 py-2.5 text-left text-[11px] ${THEME.textDim} font-semibold uppercase tracking-wider`}>Name</th>
                    <th className={`px-4 py-2.5 text-right text-[11px] ${THEME.textDim} font-semibold uppercase tracking-wider`}>Hours</th>
                    <th className={`px-4 py-2.5 text-right text-[11px] ${THEME.textDim} font-semibold uppercase tracking-wider`}>Total Cost</th>
                    <th className={`px-4 py-2.5 text-right text-[11px] ${THEME.textDim} font-semibold uppercase tracking-wider`}>Total Rev</th>
                    <th className={`px-4 py-2.5 text-right text-[11px] ${THEME.textDim} font-semibold uppercase tracking-wider`}>Delta</th>
                    <th className={`px-4 py-2.5 text-right text-[11px] ${THEME.textDim} font-semibold uppercase tracking-wider`}>GM %</th>
                  </tr>
                </thead>
                <tbody>
                  {profitabilityData.map(row => (
                    <tr key={row.id} className="border-b border-slate-800/40">
                      <td className={`px-4 py-3 font-medium ${THEME.textPrimary}`}>
                        {row.name}
                        <span className={`ml-2 text-xs ${THEME.textDim}`}>{row.costLabel}</span>
                      </td>
                      <td className={`px-4 py-3 text-right ${THEME.textSecondary} tabular-nums`}>{row.hours.toFixed(1)}</td>
                      <td className="px-4 py-3 text-right text-orange-400 tabular-nums">{formatCurrencyDecimal(row.cost)}</td>
                      <td className="px-4 py-3 text-right text-blue-400 tabular-nums">{formatCurrencyDecimal(row.revenue)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${row.margin >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatCurrencyDecimal(row.margin)}</td>
                      <td className={`px-4 py-3 text-right font-semibold tabular-nums ${row.marginPct >= 20 ? "text-emerald-400" : row.marginPct >= 0 ? "text-amber-400" : "text-rose-400"}`}>{row.marginPct.toFixed(1)}%</td>
                    </tr>
                  ))}
                  <tr className={`bg-white/[0.03] border-t-2 ${THEME.border} font-bold`}>
                    <td className={`px-4 py-3 ${THEME.textPrimary}`}>Total</td>
                    <td className={`px-4 py-3 text-right ${THEME.textSecondary} tabular-nums`}>{profitTotals.hours.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right text-orange-400 tabular-nums">{formatCurrencyDecimal(profitTotals.cost)}</td>
                    <td className="px-4 py-3 text-right text-blue-400 tabular-nums">{formatCurrencyDecimal(profitTotals.revenue)}</td>
                    <td className={`px-4 py-3 text-right ${profitTotals.margin >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatCurrencyDecimal(profitTotals.margin)}</td>
                    <td className={`px-4 py-3 text-right ${profitTotals.marginPct >= 20 ? "text-emerald-400" : "text-amber-400"}`}>{profitTotals.marginPct.toFixed(1)}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* REVENUE VIEW */}
          {profitView === "revenue" && profitabilityData.length > 0 && (
            <div className={`${THEME.card} border ${THEME.border} rounded-xl overflow-hidden`}>
              <div className={`px-6 py-4 border-b ${THEME.border} flex items-center gap-2`}>
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400" style={{ animationDuration: "3s" }} />
                <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Revenue by Client &mdash; {formatPeriodLabel(selectedPeriod, periodType)}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`bg-white/[0.02] border-b ${THEME.border}`}>
                      <th className={`px-4 py-2.5 text-left text-[11px] ${THEME.textDim} font-semibold uppercase tracking-wider sticky left-0 bg-[#0f1623] z-10`}>Name</th>
                      {profitClients.map(c => (
                        <th key={c.id} className={`px-4 py-3 text-right ${THEME.textDim} font-medium whitespace-nowrap`}>{c.name}</th>
                      ))}
                      <th className={`px-4 py-2.5 text-right text-[11px] ${THEME.textDim} font-semibold uppercase tracking-wider`}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitabilityData.map(row => (
                      <tr key={row.id} className="border-b border-slate-800/40">
                        <td className={`px-4 py-3 font-medium ${THEME.textPrimary} sticky left-0 bg-[#0f1623] z-10`}>{row.name}</td>
                        {profitClients.map(c => {
                          const val = row.revenueByClient[c.id] || 0
                          return <td key={c.id} className={`px-4 py-3 text-right ${val > 0 ? "text-blue-400" : THEME.textDim}`}>{val > 0 ? formatCurrencyDecimal(val) : "\u2014"}</td>
                        })}
                        <td className="px-4 py-3 text-right text-blue-400 font-medium">{formatCurrencyDecimal(row.revenue)}</td>
                      </tr>
                    ))}
                    <tr className={`bg-white/[0.03] border-t-2 ${THEME.border} font-bold`}>
                      <td className={`px-4 py-3 ${THEME.textPrimary} sticky left-0 bg-[#0f1623] z-10`}>Total</td>
                      {profitClients.map(c => {
                        const total = profitabilityData.reduce((s, m) => s + (m.revenueByClient[c.id] || 0), 0)
                        return <td key={c.id} className="px-4 py-3 text-right text-blue-400 tabular-nums">{formatCurrencyDecimal(total)}</td>
                      })}
                      <td className="px-4 py-3 text-right text-blue-400 font-bold">{formatCurrencyDecimal(profitTotals.revenue)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* COST VIEW */}
          {profitView === "cost" && profitabilityData.length > 0 && (
            <div className={`${THEME.card} border ${THEME.border} rounded-xl overflow-hidden`}>
              <div className={`px-6 py-4 border-b ${THEME.border} flex items-center gap-2`}>
                <div className="w-2.5 h-2.5 rounded-full bg-orange-400" style={{ animationDuration: "3s" }} />
                <h3 className={`text-sm font-semibold ${THEME.textPrimary}`}>Cost by Client &mdash; {formatPeriodLabel(selectedPeriod, periodType)}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`bg-white/[0.02] border-b ${THEME.border}`}>
                      <th className={`px-4 py-2.5 text-left text-[11px] ${THEME.textDim} font-semibold uppercase tracking-wider sticky left-0 bg-[#0f1623] z-10`}>Name</th>
                      {profitClients.map(c => (
                        <th key={c.id} className={`px-4 py-3 text-right ${THEME.textDim} font-medium whitespace-nowrap`}>{c.name}</th>
                      ))}
                      <th className={`px-4 py-2.5 text-right text-[11px] ${THEME.textDim} font-semibold uppercase tracking-wider`}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profitabilityData.map(row => (
                      <tr key={row.id} className="border-b border-slate-800/40">
                        <td className={`px-4 py-3 font-medium ${THEME.textPrimary} sticky left-0 bg-[#0f1623] z-10`}>{row.name}</td>
                        {profitClients.map(c => {
                          const val = row.costByClient[c.id] || 0
                          const months = getMonthsInPeriod(selectedPeriod, periodType)
                          const hasOverride = months.some(mo => costOverrides.some(o => o.team_member_id === row.id && o.client_id === c.id && o.month === mo))
                          return (
                            <td key={c.id} className={`px-4 py-3 text-right ${val > 0 ? "text-orange-400" : THEME.textDim}`}>
                              {val > 0 ? formatCurrencyDecimal(val) : "\u2014"}
                              {hasOverride && <span className="ml-1 text-amber-500 text-xs" title="Manual override">&#9889;</span>}
                            </td>
                          )
                        })}
                        <td className="px-4 py-3 text-right text-orange-400 font-medium tabular-nums">{formatCurrencyDecimal(row.cost)}</td>
                      </tr>
                    ))}
                    <tr className={`bg-white/[0.03] border-t-2 ${THEME.border} font-bold`}>
                      <td className={`px-4 py-3 ${THEME.textPrimary} sticky left-0 bg-[#0f1623] z-10`}>Total</td>
                      {profitClients.map(c => {
                        const total = profitabilityData.reduce((s, m) => s + (m.costByClient[c.id] || 0), 0)
                        return <td key={c.id} className="px-4 py-3 text-right text-orange-400 tabular-nums">{formatCurrencyDecimal(total)}</td>
                      })}
                      <td className="px-4 py-3 text-right text-orange-400 font-bold">{formatCurrencyDecimal(profitTotals.cost)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Active overrides list */}
              {(() => {
                const months = getMonthsInPeriod(selectedPeriod, periodType)
                const activeOverrides = costOverrides.filter(o => months.includes(o.month))
                if (activeOverrides.length === 0) return null
                return (
                  <div className={`px-6 py-4 border-t ${THEME.border}`}>
                    <p className={`text-xs font-medium ${THEME.textMuted} mb-2`}>&#9889; Active Overrides</p>
                    <div className="flex flex-wrap gap-2">
                      {activeOverrides.map(o => (
                        <div key={o.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-950/30 border border-amber-800/30">
                          <span className="text-xs text-amber-400">{o.team_member_name} &rarr; {o.client_name} ({o.month}): {formatCurrency(o.fixed_amount)}</span>
                          <button onClick={() => handleDeleteOverride(o.id)} className="text-amber-500/50 hover:text-rose-400"><X size={12} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {profitabilityData.length === 0 && (
            <div className={`${THEME.card} border ${THEME.border} rounded-xl p-12 text-center`}>
              <BarChart3 size={48} className="mx-auto text-slate-700 mb-4" />
              <p className={THEME.textMuted}>No timesheet data for {formatPeriodLabel(selectedPeriod, periodType)}</p>
              <p className={`text-xs ${THEME.textDim} mt-1`}>Time entries and rate cards needed to calculate profitability</p>
            </div>
          )}
        </div>
      )}

      {/* ============ MODALS ============ */}
      <MemberModal isOpen={showMemberModal} onClose={() => { setShowMemberModal(false); setEditingMember(null) }}
        onSave={handleSaveMember} editingMember={editingMember} />
      <RateCardModal isOpen={showRateModal} onClose={() => { setShowRateModal(false); setEditingRate(null) }}
        onSave={handleSaveRate} editingRate={editingRate} teamMembers={teamMembers} clients={clients} projects={projects} companyId={companyId} />
      <CostOverrideModal isOpen={showOverrideModal} onClose={() => setShowOverrideModal(false)}
        onSave={handleSaveOverride} billRates={billRates} teamMembers={teamMembers} clients={clients} selectedMonth={selectedPeriod.includes("-Q") ? getMonthsInPeriod(selectedPeriod, periodType)[0] : selectedPeriod.length === 4 ? getCurrentMonth() : selectedPeriod} />
      {selectedMemberDetail && (
        <MemberDetailFlyout member={selectedMemberDetail} billRates={billRates} clients={clients}
          onClose={() => setSelectedMemberDetail(null)}
          onEdit={() => { setEditingMember(selectedMemberDetail); setShowMemberModal(true); setSelectedMemberDetail(null) }} />
      )}
    </div>
  )
}
