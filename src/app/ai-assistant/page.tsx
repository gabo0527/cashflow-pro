"use client"
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { 
  Send, User, TrendingUp, DollarSign, 
  AlertTriangle, RefreshCw, Users, ChevronRight, Trash2, Clock, Target,
  Plus, MessageSquare, Pencil, Check, X, PanelLeftClose, PanelLeft,
  Paperclip, Image as ImageIcon, FileText, XCircle, BarChart3, PieChart,
  Zap, Brain, TrendingDown, ArrowUpRight, ArrowDownRight, Lightbulb, Activity,
  Gauge, Receipt, Search, CreditCard, CheckCircle2, XOctagon, Loader2, Shield, Mail
} from "lucide-react"
import { createClient } from "@supabase/supabase-js"
import Link from "next/link"
import {
  BarChart, Bar, LineChart, Line, PieChart as RechartsPie, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ComposedChart
} from "recharts"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
)

const CHART_COLORS = ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899", "#34D399", "#6366F1", "#F97316", "#06B6D4"]

// ============ SAGE LOGO ============
function SageLogo({ size = 32, className = "" }: { size?: number, className?: string }) {
  const id = `vg-${size}`
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6ee7b7"/>
          <stop offset="100%" stopColor="#10b981"/>
        </linearGradient>
      </defs>
      <path d="M10 10L24 40L38 10" stroke={`url(#${id})`} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ============ TYPES ============
interface Message { id: string; role: "user" | "assistant"; content: string; timestamp: Date; attachments?: Attachment[]; chart?: ChartData; agentResult?: AgentResult; pendingApproval?: PendingApproval; emailDraft?: EmailDraftData }
interface Attachment { id: string; name: string; type: string; size: number; content?: string }
interface ChartData { type: "bar" | "line" | "pie" | "area" | "waterfall" | "stacked_bar" | "multi_line" | "composed"; title: string; data: any[]; keys?: string[]; colors?: string[] }
interface TableData { title: string; headers: string[]; rows: string[][] }
interface Conversation { id: string; title: string; messages: Message[]; created_at: string; updated_at: string }
interface CompanyData { transactions: any[]; invoices: any[]; projects: any[]; clients: any[]; teamMembers: any[]; timeEntries: any[]; projectAssignments: any[]; billRates: any[]; costOverrides: any[]; expenses: any[]; learnedPatterns: any[] }
interface KPISummary { totalRevenue: number; totalExpenses: number; netIncome: number; grossMargin: number; cashOnHand: number; arOutstanding: number; burnRate: number; runway: number; utilizationRate: number; dso: number; teamCost: number; teamRevenue: number; teamMarginPct: number }
interface AgentResult { agent: string; status: "success" | "error"; data: any; summary: string }
interface PendingApproval { id: string; type: "bulk_update" | "invoice_approve" | "expense_categorize"; description: string; items: any[]; onApprove: () => Promise<void>; onReject: () => void }
interface EmailDraftData { subject: string; body: string; recipientName: string; recipientEmail: string; tone: string; isTeamWide: boolean }

// ============ AGENT INTENT DETECTION ============
interface AgentIntent {
  agent: "invoice-validator" | "expense-categorizer" | "timesheet-reconciler" | "cashflow-forecaster" | "project-health" | "morning-briefing" | null
  action: string
  confidence: number
}

function detectAgentIntent(message: string): AgentIntent {
  const m = message.toLowerCase().trim()
  
  // Invoice validator
  if (/\b(validate|check|review|verify)\b.*\b(invoice|invoices)\b/.test(m) ||
      /\b(invoice|invoices)\b.*\b(validate|check|review|match|reconcile)\b/.test(m) ||
      /\bpending invoices?\b/.test(m) ||
      /\binvoice.*(discrepanc|mismatch|wrong|off)\b/.test(m)) {
    return { agent: "invoice-validator", action: "validate-pending", confidence: 0.9 }
  }

  // Expense categorizer
  if (/\b(categorize|classify|sort|organize|tag)\b.*\b(expense|transaction|bank|uncategorized)\b/.test(m) ||
      /\b(uncategorized|untagged|unsorted)\b.*\b(expense|transaction)\b/.test(m) ||
      /\bcategorize\b.*\b(recent|all|pending|new)\b/.test(m)) {
    return { agent: "expense-categorizer", action: "categorize-pending", confidence: 0.85 }
  }

  // Timesheet reconciler
  if (/\b(timesheet|time.?sheet)\b.*\b(missing|submit|reconcil|check|status|review)\b/.test(m) ||
      /\b(who|which|any).*(missing|submit|log|enter).*(time|hours|timesheet)\b/.test(m) ||
      /\bmissing\b.*\b(time|hours|timesheet|submission)\b/.test(m) ||
      /\b(team|contractor).*(hours|time).*(this week|last week|submit)\b/.test(m) ||
      /\b(budget|hour).*(overrun|over.?budget|burn)\b/.test(m)) {
    const action = /budget|overrun|burn/.test(m) ? "budget-check" : /missing/.test(m) ? "missing-report" : "reconcile"
    return { agent: "timesheet-reconciler", action, confidence: 0.85 }
  }

  // Cash flow forecaster
  if (/\b(cash.?flow|cashflow)\b.*\b(forecast|project|predict|model|outlook)\b/.test(m) ||
      /\b(forecast|project)\b.*\b(cash|money|revenue|income)\b/.test(m) ||
      /\b13.?week\b/.test(m) ||
      /\b(cash|money)\b.*(runway|last|enough|tight|low)\b/.test(m) ||
      /\b(build|create|show|run)\b.*\bforecast\b/.test(m) ||
      /\bcash.?flow\b.*\b(risk|alert|warning)\b/.test(m)) {
    const action = /alert|risk|warning/.test(m) ? "alerts-only" : "forecast"
    return { agent: "cashflow-forecaster", action, confidence: 0.85 }
  }

  // Project health monitor
  if (/\b(project|portfolio)\b.*\b(health|status|report|digest|overview|scorecard)\b/.test(m) ||
      /\b(red|yellow|green)\b.*\b(project|flag)\b/.test(m) ||
      /\b(scope.?creep|margin.?erosion|burn.?rate)\b/.test(m) ||
      /\bproject.*(at risk|behind|over.?budget|trouble)\b/.test(m)) {
    const action = /digest|summary|brief/.test(m) ? "digest" : "full-report"
    return { agent: "project-health", action, confidence: 0.85 }
  }

  // Morning briefing (multi-agent)
  if (/\b(morning|monday|weekly|daily)\b.*\b(brief|report|update|digest|summary|rundown)\b/.test(m) ||
      /\bwhat.*(should|need).*(focus|attention|priority|look at)\b/.test(m) ||
      /\bwhat.*going on\b/.test(m) ||
      /\bgive me.*(brief|rundown|overview|update)\b/.test(m) ||
      /\b(brief|update) me\b/.test(m)) {
    return { agent: "morning-briefing", action: "full", confidence: 0.8 }
  }

  return { agent: null, action: "", confidence: 0 }
}

// ============ QUICK ACTIONS — agent-powered ============
const QUICK_ACTIONS = [
  { label: "Give me my Monday briefing", icon: Target, accent: true, agent: true },
  { label: "Show me project health scorecard", icon: BarChart3, accent: true, agent: true },
  { label: "Any cash flow risks in the next 13 weeks?", icon: AlertTriangle, accent: true, agent: true },
  { label: "Who is missing timesheets this week?", icon: Clock, accent: false, agent: true },
  { label: "Validate all pending contractor invoices", icon: Receipt, accent: false, agent: true },
  { label: "Categorize my uncategorized transactions", icon: CreditCard, accent: false, agent: true },
]

// ============ UTILITIES ============
const formatCurrency = (v: number): string => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
const formatPercent = (v: number): string => v.toFixed(1) + "%"
const formatFileSize = (bytes: number): string => { if (bytes < 1024) return bytes + " B"; if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"; return (bytes / (1024 * 1024)).toFixed(1) + " MB" }
const getCurrentMonth = (): string => { const n = new Date(); return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") }

// ============ SYSTEM PROMPT — REWRITTEN ============
const SYSTEM_PROMPT = `You are Sage, the financial intelligence engine inside VantageFP. You work alongside Gabriel, who runs Mano CG LLC, an Owner's Representative consulting firm.

WHO YOU ARE:
You are not a chatbot. You are a senior financial operator — think fractional CFO who also handles FP&A and operations. Gabriel is the CEO. He does not have a finance team. You are his finance team. Between you and the AI agents running in the background, the goal is to automate 60-80% of financial operations so Gabriel can focus on strategy and client relationships.

HOW YOU COMMUNICATE:
- Direct and clear. No corporate jargon. No buzzwords.
- Lead with the number or the answer, then explain why it matters.
- When you present data, explain what it means in plain language — as if Gabriel needs to relay it to a client or a board.
- Challenge what the data shows. If margins are shrinking, say so and explain what is driving it. If cash is tighter than it should be, flag it.
- Always end with what to do next — a specific action, not a vague suggestion.
- No emojis. Clean, professional tone.
- Do NOT use markdown bold (**text**). Use ALL CAPS sparingly for emphasis.
- Be conversational. This is a working session, not a report.

YOUR AGENT TEAM:
You have 5 AI agents that run specific tasks. When the user triggers one, you orchestrate the agent call and present results clearly.

1. INVOICE VALIDATOR — Cross-references contractor invoices against time entries. Flags discrepancies, auto-approves clean ones.
2. EXPENSE CATEGORIZER — Auto-categorizes uncategorized bank transactions using patterns and historical data.
3. TIMESHEET RECONCILER — Checks who submitted timesheets, who is missing, which projects are burning through budget.
4. CASH FLOW FORECASTER — Builds a rolling 13-week cash flow projection from actuals, AR, AP, and contractor costs.
5. PROJECT HEALTH MONITOR — Scores every active project green/yellow/red based on margin, burn rate, scope creep, and AR.

When agent results come in, format them clearly with tables and charts. For the morning briefing, run project health + cash flow + timesheet reconciler together.

CASH FLOW PROJECTIONS (IMPORTANT):
Gabriel is CFO/COO/FP&A all in one. Cash flow is king. When building projections:
- OPTION 1: Based on historical averages from the data
- OPTION 2: Interactive build — start with averages, then ask what to add or change (new hires, lost clients, delayed collections, one-time expenses)
- OPTION 3: Scenario comparison — show best case / base case / worst case side by side
Always ask clarifying questions when building something that needs inputs not in the database. Do not guess — ask.

APPROVAL WORKFLOW:
When you recommend bulk changes (categorizing transactions, approving invoices), ALWAYS present a preview first:
- Show what will change in a clear table
- Ask for explicit approval before executing
- Use the action block format for changes (see below)
Never make changes without showing them first. This is non-negotiable.

KNOWN ALIASES:
- "CADC" or "Clean Arc" = Clean Arc Data Center
- "P1" or "Point One" = Point One, LLC
- Detect abbreviations from client/project names automatically

RATE CARD MODEL:
Two-tier cost model:
- TIER 1 (Custom): Rate card has cost_amount > 0 for a specific member+client = use that exact cost
  - cost_type "hourly": cost = hours x cost_amount
  - cost_type "lump_sum": cost = cost_amount/month
- TIER 2 (Distributed): Rate card has cost_amount = 0 = fall back to team member total cost distributed by % of hours worked
- cost_overrides = monthly exceptions

TIME TRACKING:
Each time entry has "hours" (logged) and "billable_hours" (approved for billing).
- Written-down hours = hours - billable_hours
- Lost revenue = delta x bill_rate
- Always show both when asked about hours

BANK TRANSACTION CATEGORIZATION:
When categorizing, check SAGE LEARNED PATTERNS first. For known vendors, use high confidence.
Categories: Direct Costs (Payroll, Subcontractors, Project Materials), Overhead (Rent, Insurance, Software, Accounting), Other Business (Travel, Meals, Marketing), Personal (Owner Draws)

LEARNING FLOW:
When user confirms categorizations, emit:
PATTERN_LEARNED: vendor="VENDOR" category="Category" sub_category="SubCategory"
Only after explicit confirmation.

TABLE FORMAT:
\`\`\`sage-table
{"title": "Title", "headers": ["Col1", "Col2"], "rows": [["val1", "val2"]]}
\`\`\`

CHART FORMAT:
\`\`\`sage-chart
{"type": "bar|line|pie|area|waterfall|stacked_bar|multi_line|composed", "title": "Title", "data": [{"name": "Label", "value": 1000}], "keys": ["key1"], "colors": ["#10b981"]}
\`\`\`

Chart types: bar (comparisons), stacked_bar (multi-metric), line (single trend), multi_line (overlaid trends), area (filled trend), pie (proportions), waterfall (bridge), composed (bar+line mixed)

ACTION FORMAT (for bulk changes):
\`\`\`vantage-action
{"action": "bulk_update", "type": "cash", "updates": [{"id": "transaction-id", "changes": {"category": "opex"}, "preview": {"description": "desc", "amount": 100, "currentCategory": "unassigned", "newCategory": "opex"}}], "summary": "Brief description"}
\`\`\`

RESPONSE RULES:
1. Use SPECIFIC NUMBERS from the data. Never estimate when data exists.
2. If data is missing, say so and suggest what to add.
3. Be concise — lead with insights, not summaries.
4. Always suggest a follow-up action.
5. Cross-reference data across modules.
6. When showing financial data, make it presentable — think "what would I hand to a client."
7. For the morning briefing, prioritize by financial impact: what costs money first, what makes money second.
8. When something looks off in the data, say it. "Your margin on GOOGL dropped 8 points this month — here is why." Do not wait to be asked.`

// ============ KPI CALCULATION (unchanged) ============
function calculateKPIs(data: CompanyData): KPISummary {
  const totalRevenue = data.invoices?.filter(inv => inv.status === "paid").reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0
  const totalExpenses = data.transactions?.filter(t => t.type === "expense" || t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount || 0), 0) || 0
  const netIncome = totalRevenue - totalExpenses
  const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses * 0.6) / totalRevenue) * 100 : 0
  const cashOnHand = data.transactions?.filter(t => t.category === "cash" || t.type === "income").reduce((sum, t) => sum + (t.amount || 0), 0) || 50000
  const arOutstanding = data.invoices?.filter(inv => inv.status === "pending" || inv.status === "overdue").reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0
  const burnRate = totalExpenses / 3 || 10000
  const runway = burnRate > 0 ? cashOnHand / burnRate : 12
  const totalHours = data.timeEntries?.reduce((sum, t) => sum + (t.hours || 0), 0) || 0
  const billableHours = data.timeEntries?.filter(t => t.billable || t.is_billable).reduce((sum, t) => sum + (t.billable_hours != null ? t.billable_hours : (t.hours || 0)), 0) || 0
  const utilizationRate = totalHours > 0 ? (billableHours / totalHours) * 100 : 75
  const paidInvoices = data.invoices?.filter(inv => inv.status === "paid" && inv.paid_date) || []
  const avgDSO = paidInvoices.length > 0 ? paidInvoices.reduce((sum, inv) => {
    const issued = new Date(inv.issue_date || inv.created_at)
    const paid = new Date(inv.paid_date)
    return sum + Math.ceil((paid.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24))
  }, 0) / paidInvoices.length : 45
  const curMonth = getCurrentMonth()
  const monthEntries = data.timeEntries?.filter(t => t.date?.substring(0, 7) === curMonth) || []
  const projectClientMap = new Map(data.projects?.map(p => [p.id, p.client_id]) || [])
  let teamRevenue = 0, teamCost = 0
  const memberHours: Record<string, Record<string, number>> = {}
  monthEntries.forEach(t => {
    const clientId = projectClientMap.get(t.project_id) || ""
    const memberId = t.contractor_id
    if (!memberHours[memberId]) memberHours[memberId] = {}
    memberHours[memberId][clientId] = (memberHours[memberId][clientId] || 0) + (t.hours || 0)
  })
  const memberBillableHours: Record<string, Record<string, number>> = {}
  monthEntries.forEach(t => {
    const clientId = projectClientMap.get(t.project_id) || ""
    const memberId = t.contractor_id
    if (!memberBillableHours[memberId]) memberBillableHours[memberId] = {}
    const bh = t.billable_hours != null ? t.billable_hours : (t.hours || 0)
    memberBillableHours[memberId][clientId] = (memberBillableHours[memberId][clientId] || 0) + bh
  })
  Object.entries(memberHours).forEach(([memberId, clientHours]) => {
    const member = data.teamMembers?.find(m => m.id === memberId)
    const totalMemberHours = Object.values(clientHours).reduce((s, h) => s + h, 0)
    Object.entries(clientHours).forEach(([clientId, hours]) => {
      const rc = data.billRates?.find(r => r.team_member_id === memberId && r.client_id === clientId && r.is_active)
      const billableHrs = memberBillableHours[memberId]?.[clientId] || hours
      teamRevenue += billableHrs * (rc?.rate || 0)
      if (rc && rc.cost_amount > 0) {
        if (rc.cost_type === "hourly") teamCost += hours * rc.cost_amount
        else teamCost += rc.cost_amount
      } else if (member) {
        if (member.cost_type === "hourly") teamCost += hours * (member.cost_amount || 0)
        else {
          const pct = totalMemberHours > 0 ? hours / totalMemberHours : 0
          teamCost += pct * (member.cost_amount || 0)
        }
      }
    })
  })
  const teamMarginPct = teamRevenue > 0 ? ((teamRevenue - teamCost) / teamRevenue) * 100 : 0
  return { totalRevenue, totalExpenses, netIncome, grossMargin, cashOnHand, arOutstanding, burnRate, runway, utilizationRate, dso: avgDSO, teamCost, teamRevenue, teamMarginPct }
}

// ============ HELPER FUNCTIONS (unchanged) ============
function getARAgingSummary(invoices: any[]): any {
  const now = new Date()
  const aging = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 }
  invoices?.filter(inv => inv.status === "pending" || inv.status === "overdue").forEach(inv => {
    const dueDate = new Date(inv.due_date || inv.created_at)
    const daysOverdue = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    if (daysOverdue <= 0) aging.current += inv.amount || 0
    else if (daysOverdue <= 30) aging.days30 += inv.amount || 0
    else if (daysOverdue <= 60) aging.days60 += inv.amount || 0
    else if (daysOverdue <= 90) aging.days90 += inv.amount || 0
    else aging.over90 += inv.amount || 0
  })
  return aging
}

function getOverdueInvoices(data: CompanyData): any[] {
  const now = new Date()
  return data.invoices?.filter(inv => inv.status !== "paid" && new Date(inv.due_date || inv.created_at) < now)
    .map(inv => {
      const client = data.clients?.find(c => c.id === inv.client_id)
      const daysOverdue = Math.ceil((now.getTime() - new Date(inv.due_date || inv.created_at).getTime()) / (1000 * 60 * 60 * 24))
      return { id: inv.id, invoiceNumber: inv.invoice_number || inv.id, client: client?.name || "Unknown", amount: inv.amount || 0, daysOverdue }
    }).sort((a, b) => b.daysOverdue - a.daysOverdue) || []
}

function getBankTransactionPatterns(transactions: any[]): string {
  if (!transactions || transactions.length === 0) return "No bank transactions available."
  const vendorPatterns: Record<string, { count: number, totalAmount: number, avgAmount: number, categories: Record<string, number>, lastDate: string }> = {}
  transactions.forEach(t => {
    const vendor = (t.description || t.vendor || t.name || "Unknown").trim()
    const normalized = vendor.replace(/\d{4,}/g, "").replace(/\s+/g, " ").trim().substring(0, 50)
    if (!vendorPatterns[normalized]) vendorPatterns[normalized] = { count: 0, totalAmount: 0, avgAmount: 0, categories: {}, lastDate: "" }
    vendorPatterns[normalized].count++
    vendorPatterns[normalized].totalAmount += Math.abs(t.amount || 0)
    if (t.category) vendorPatterns[normalized].categories[t.category] = (vendorPatterns[normalized].categories[t.category] || 0) + 1
    if (t.date > (vendorPatterns[normalized].lastDate || "")) vendorPatterns[normalized].lastDate = t.date
  })
  Object.values(vendorPatterns).forEach(p => { p.avgAmount = p.totalAmount / p.count })
  const sorted = Object.entries(vendorPatterns).sort((a, b) => b[1].count - a[1].count)
  const uncategorized = transactions.filter(t => !t.category || t.category === "uncategorized" || t.category === "")
  const recentUncategorized = uncategorized.slice(0, 20).map(t => {
    return `  ${t.date || "?"} | ${(t.description || t.vendor || t.name || "?").substring(0, 40)} | $${Math.abs(t.amount || 0).toFixed(2)} | ${t.type || "?"}`
  }).join("\n")
  return `
=== BANK FEED PATTERNS ===
Total Transactions: ${transactions.length}
Uncategorized: ${uncategorized.length} (${transactions.length > 0 ? ((uncategorized.length / transactions.length) * 100).toFixed(0) : 0}%)
TOP VENDORS BY FREQUENCY:
${sorted.slice(0, 15).map(([vendor, p]) => {
    const topCat = Object.entries(p.categories).sort((a, b) => b[1] - a[1])[0]
    return `  ${vendor}: ${p.count}x, avg ${formatCurrency(p.avgAmount)}${topCat ? ` [usually: ${topCat[0]}]` : " [UNCATEGORIZED]"}`
  }).join("\n")}
RECENT UNCATEGORIZED:
${recentUncategorized || "  None - all categorized!"}
CATEGORIZATION RULES LEARNED:
${sorted.filter(([_, p]) => Object.keys(p.categories).length > 0 && p.count >= 2).slice(0, 10).map(([vendor, p]) => {
    const topCat = Object.entries(p.categories).sort((a, b) => b[1] - a[1])[0]
    return `  "${vendor}" -> ${topCat[0]} (${topCat[1]}/${p.count} times, ${((topCat[1]/p.count)*100).toFixed(0)}% confidence)`
  }).join("\n") || "  No patterns established yet"}`
}

// ============ DATA CONTEXT BUILDER (unchanged) ============
function buildDataContext(data: CompanyData, kpis: KPISummary): string {
  const aging = getARAgingSummary(data.invoices)
  const overdueInv = getOverdueInvoices(data)
  const curMonth = getCurrentMonth()
  const monthEntries = data.timeEntries?.filter(t => t.date?.substring(0, 7) === curMonth) || []
  const projectClientMap = new Map(data.projects?.map(p => [p.id, p.client_id]) || [])
  const clientNameMap = new Map(data.clients?.map(c => [c.id, c.name]) || [])
  const memberNameMap = new Map(data.teamMembers?.map(m => [m.id, m.name]) || [])
  const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  const thisWeekByMember: Record<string, number> = {}
  data.timeEntries?.filter(t => new Date(t.date) >= oneWeekAgo).forEach(entry => {
    const name = memberNameMap.get(entry.contractor_id) || "Unknown"
    thisWeekByMember[name] = (thisWeekByMember[name] || 0) + (entry.hours || 0)
  })
  const allTimeByMember: Record<string, { hours: number, billable: number }> = {}
  data.timeEntries?.forEach(entry => {
    const name = memberNameMap.get(entry.contractor_id) || "Unknown"
    if (!allTimeByMember[name]) allTimeByMember[name] = { hours: 0, billable: 0 }
    allTimeByMember[name].hours += entry.hours || 0
    allTimeByMember[name].billable += entry.billable_hours != null ? entry.billable_hours : (entry.hours || 0)
  })
  const timeByMonth: Record<string, Record<string, number>> = {}
  data.timeEntries?.forEach(entry => {
    const mo = entry.date?.substring(0, 7) || "?"
    const name = memberNameMap.get(entry.contractor_id) || "Unknown"
    if (!timeByMonth[mo]) timeByMonth[mo] = {}
    timeByMonth[mo][name] = (timeByMonth[mo][name] || 0) + (entry.hours || 0)
  })
  const clientProfit: Record<string, { name: string, revenue: number, cost: number, hours: number }> = {}
  const memberProfit: Record<string, { name: string, revenue: number, cost: number, hours: number, clients: Record<string, { hours: number, revenue: number, cost: number }> }> = {}
  monthEntries.forEach(t => {
    const memberId = t.contractor_id
    const clientId = projectClientMap.get(t.project_id) || "unknown"
    const clientName = clientNameMap.get(clientId) || "Unknown"
    const memberName = memberNameMap.get(memberId) || "Unknown"
    const hours = t.hours || 0
    const billableHrs = t.billable_hours != null ? t.billable_hours : hours
    const rc = data.billRates?.find(r => r.team_member_id === memberId && r.client_id === clientId && r.is_active)
    const revenue = billableHrs * (rc?.rate || 0)
    if (!clientProfit[clientId]) clientProfit[clientId] = { name: clientName, revenue: 0, cost: 0, hours: 0 }
    clientProfit[clientId].revenue += revenue
    clientProfit[clientId].hours += hours
    if (!memberProfit[memberId]) memberProfit[memberId] = { name: memberName, revenue: 0, cost: 0, hours: 0, clients: {} }
    memberProfit[memberId].revenue += revenue
    memberProfit[memberId].hours += hours
    if (!memberProfit[memberId].clients[clientId]) memberProfit[memberId].clients[clientId] = { hours: 0, revenue: 0, cost: 0 }
    memberProfit[memberId].clients[clientId].hours += hours
    memberProfit[memberId].clients[clientId].revenue += revenue
  })
  Object.entries(memberProfit).forEach(([memberId, mp]) => {
    const member = data.teamMembers?.find(m => m.id === memberId)
    const totalMemberHours = mp.hours
    Object.entries(mp.clients).forEach(([clientId, ch]) => {
      const rc = data.billRates?.find(r => r.team_member_id === memberId && r.client_id === clientId && r.is_active)
      let cost = 0
      if (rc && rc.cost_amount > 0) {
        cost = rc.cost_type === "hourly" ? ch.hours * rc.cost_amount : rc.cost_amount
      } else if (member) {
        if (member.cost_type === "hourly") cost = ch.hours * (member.cost_amount || 0)
        else {
          const pct = totalMemberHours > 0 ? ch.hours / totalMemberHours : 0
          cost = pct * (member.cost_amount || 0)
        }
      }
      mp.clients[clientId].cost = cost
      mp.cost += cost
      if (clientProfit[clientId]) clientProfit[clientId].cost += cost
    })
  })
  const rateCardSummary = data.billRates?.filter(r => r.is_active).map(r => {
    const member = data.teamMembers?.find(m => m.id === r.team_member_id)
    const client = data.clients?.find(c => c.id === r.client_id)
    const hasCustomCost = r.cost_amount > 0
    const costDesc = hasCustomCost
      ? (r.cost_type === "hourly" ? `$${r.cost_amount}/hr (custom)` : `$${r.cost_amount}/mo lump sum (${r.baseline_hours || 172}h baseline)`)
      : `Distributed from ${member?.cost_type === "lump_sum" ? "$" + (member?.cost_amount || 0) + "/mo" : "$" + (member?.cost_amount || 0) + "/hr"} total`
    return `  ${member?.name || "?"} -> ${client?.name || "?"}: Bill $${r.rate}/hr | Cost: ${costDesc}`
  }).join("\n") || "No rate cards configured"
  const expenseByCategory: Record<string, number> = {}
  data.expenses?.forEach(e => {
    const cat = e.category || e.expense_category || "Uncategorized"
    expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Math.abs(e.amount || 0)
  })
  const writeDownsByMember: Record<string, { name: string, months: Record<string, { logged: number, billable: number, delta: number, lostRevenue: number }> }> = {}
  data.timeEntries?.forEach(entry => {
    const memberId = entry.contractor_id
    const name = memberNameMap.get(memberId) || "Unknown"
    const mo = entry.date?.substring(0, 7) || "?"
    const logged = entry.hours || 0
    const billable = entry.billable_hours != null ? entry.billable_hours : logged
    const delta = logged - billable
    if (!writeDownsByMember[memberId]) writeDownsByMember[memberId] = { name, months: {} }
    if (!writeDownsByMember[memberId].months[mo]) writeDownsByMember[memberId].months[mo] = { logged: 0, billable: 0, delta: 0, lostRevenue: 0 }
    writeDownsByMember[memberId].months[mo].logged += logged
    writeDownsByMember[memberId].months[mo].billable += billable
    writeDownsByMember[memberId].months[mo].delta += delta
    if (delta > 0) {
      const clientId = projectClientMap.get(entry.project_id) || "unknown"
      const rc = data.billRates?.find(r => r.team_member_id === memberId && r.client_id === clientId && r.is_active)
      writeDownsByMember[memberId].months[mo].lostRevenue += delta * (rc?.rate || 0)
    }
  })
  const bankPatterns = getBankTransactionPatterns(data.transactions)
  return `
=== FINANCIAL SNAPSHOT (${new Date().toLocaleDateString()}) ===
KEY METRICS:
  Total Revenue (invoiced & paid): ${formatCurrency(kpis.totalRevenue)}
  Total Expenses: ${formatCurrency(kpis.totalExpenses)}
  Net Income: ${formatCurrency(kpis.netIncome)}
  Cash on Hand: ${formatCurrency(kpis.cashOnHand)}
  Monthly Burn Rate: ${formatCurrency(kpis.burnRate)}
  Cash Runway: ${kpis.runway.toFixed(1)} months
  Utilization: ${formatPercent(kpis.utilizationRate)}
  DSO: ${kpis.dso.toFixed(0)} days
  Team Revenue (${curMonth}): ${formatCurrency(kpis.teamRevenue)}
  Team Cost (${curMonth}): ${formatCurrency(kpis.teamCost)}
  Team GM% (${curMonth}): ${formatPercent(kpis.teamMarginPct)}
=== AR AGING ===
  Current: ${formatCurrency(aging.current)}
  1-30 Days: ${formatCurrency(aging.days30)}
  31-60 Days: ${formatCurrency(aging.days60)}
  61-90 Days: ${formatCurrency(aging.days90)}
  90+ Days: ${formatCurrency(aging.over90)}
  Overdue Invoices: ${overdueInv.length}
${overdueInv.slice(0, 5).map(i => `    ${i.invoiceNumber}: ${i.client} - ${formatCurrency(i.amount)} (${i.daysOverdue} days)`).join("\n")}
=== CLIENTS (${data.clients?.length || 0}) ===
${data.clients?.map(c => {
    const aliases: string[] = []
    const name = c.name || ""
    if (name.includes(" ")) aliases.push(name.split(" ").map((w: string) => w[0]).join("").toUpperCase())
    if (name.toLowerCase().includes("clean arc")) aliases.push("CADC")
    if (name.toLowerCase().includes("point one")) aliases.push("P1")
    return `  ${name}${aliases.length > 0 ? " (aka " + aliases.join(", ") + ")" : ""} | ${c.status || "active"}`
  }).join("\n") || "No clients"}
=== PROJECTS (${data.projects?.length || 0}) ===
${data.projects?.map(p => `  ${p.name} | ${clientNameMap.get(p.client_id) || "No Client"} | ${p.status || "active"} | Budget: $${p.budget || 0}`).join("\n") || "No projects"}
=== TEAM (${data.teamMembers?.length || 0}) ===
${data.teamMembers?.map(t => {
    const costDesc = t.cost_type === "lump_sum" ? `$${t.cost_amount || 0}/mo (fixed)` : `$${t.cost_amount || 0}/hr`
    const rateCards = data.billRates?.filter(r => r.team_member_id === t.id && r.is_active).length || 0
    return `  ${t.name} | ${t.role || "Team Member"} | ${t.employment_type || "contractor"} | Cost: ${costDesc} | ${rateCards} rate cards`
  }).join("\n") || "No team"}
=== RATE CARDS ===
${rateCardSummary}
=== COST OVERRIDES ===
${data.costOverrides?.length > 0 ? data.costOverrides.map(o => {
    return `  ${memberNameMap.get(o.team_member_id) || "?"} -> ${clientNameMap.get(o.client_id) || "?"} (${o.month}): ${formatCurrency(o.fixed_amount)}${o.notes ? " - " + o.notes : ""}`
  }).join("\n") : "No overrides set"}
=== CLIENT PROFITABILITY (${curMonth}) ===
${Object.values(clientProfit).sort((a: any, b: any) => b.revenue - a.revenue).map((c: any) => {
    const margin = c.revenue > 0 ? ((c.revenue - c.cost) / c.revenue * 100).toFixed(1) : "0.0"
    return `  ${c.name}: ${formatCurrency(c.revenue)} rev, ${formatCurrency(c.cost)} cost, ${formatCurrency(c.revenue - c.cost)} margin (${margin}% GM), ${c.hours.toFixed(1)} hrs`
  }).join("\n") || "No profitability data"}
=== MEMBER PROFITABILITY (${curMonth}) ===
${Object.values(memberProfit).sort((a: any, b: any) => b.revenue - a.revenue).map((m: any) => {
    const margin = m.revenue > 0 ? ((m.revenue - m.cost) / m.revenue * 100).toFixed(1) : "0.0"
    const clientBreakdown = Object.entries(m.clients).map(([cid, ch]: [string, any]) => {
      const cname = clientNameMap.get(cid) || "?"
      return `${cname}: ${ch.hours.toFixed(1)}h`
    }).join(", ")
    return `  ${m.name}: ${formatCurrency(m.revenue)} rev, ${formatCurrency(m.cost)} cost (${margin}% GM) | ${clientBreakdown}`
  }).join("\n") || "No data"}
=== TIME THIS WEEK ===
${Object.entries(thisWeekByMember).map(([name, hours]) => `  ${name}: ${hours.toFixed(1)} hours`).join("\n") || "No entries"}
=== TIME BY MONTH (last 6) ===
${Object.entries(timeByMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6).map(([month, members]) =>
    `${month}: ${Object.entries(members).map(([name, h]) => `${name}: ${h.toFixed(1)}h`).join(", ")}`
  ).join("\n") || "No entries"}
=== LOGGED VS BILLABLE (Write-Downs) ===
${Object.entries(writeDownsByMember).map(([id, wd]) => {
    const recentMonths = Object.entries(wd.months).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 3)
    return recentMonths.map(([mo, d]) => 
      `  ${wd.name} (${mo}): Logged ${d.logged.toFixed(1)}h, Billable ${d.billable.toFixed(1)}h, Written-Down ${d.delta.toFixed(1)}h${d.lostRevenue > 0 ? `, Lost Revenue ${formatCurrency(d.lostRevenue)}` : ""}`
    ).join("\n")
  }).join("\n") || "No write-downs detected"}
=== INVOICES ===
  Paid: ${data.invoices?.filter(i => i.status === "paid").length || 0} (${formatCurrency(data.invoices?.filter(i => i.status === "paid").reduce((s, i) => s + (i.amount || 0), 0) || 0)})
  Pending: ${data.invoices?.filter(i => i.status === "pending").length || 0} (${formatCurrency(data.invoices?.filter(i => i.status === "pending").reduce((s, i) => s + (i.amount || 0), 0) || 0)})
  Overdue: ${overdueInv.length} (${formatCurrency(overdueInv.reduce((s, i) => s + i.amount, 0))})
=== EXPENSES BY CATEGORY ===
${Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => `  ${cat}: ${formatCurrency(amt)}`).join("\n") || "No expense data"}
${bankPatterns}
=== SAGE LEARNED PATTERNS (${data.learnedPatterns?.length || 0}) ===
${data.learnedPatterns?.length > 0 ? 
  `Approved:
${data.learnedPatterns.filter(p => p.status === "approved").map(p => 
    `  "${p.vendor_normalized || p.vendor_name}" -> ${p.category}${p.sub_category ? "/" + p.sub_category : ""} (confirmed ${p.times_confirmed}x)`
  ).join("\n") || "  None"}
Suggested:
${data.learnedPatterns.filter(p => p.status === "suggested").map(p => 
    `  "${p.vendor_normalized || p.vendor_name}" -> ${p.category}${p.sub_category ? "/" + p.sub_category : ""} (${(p.confidence * 100).toFixed(0)}%)`
  ).join("\n") || "  None"}`
  : "No learned patterns yet."}
PATTERN_LEARNED format: vendor="VENDOR" category="CATEGORY" sub_category="SUB_CATEGORY"
`
}

// ============ TABLE RENDERER ============
function TableRenderer({ table }: { table: TableData }) {
  if (!table || !table.headers || !table.rows) return null
  return (
    <div style={{ margin: "12px 0", border: "1px solid #e8e8e4", borderRadius: "4px", overflow: "hidden" }}>
      <div style={{ background: "#f7f7f5", padding: "8px 14px", borderBottom: "1px solid #e8e8e4" }}>
        <h4 className="text-sm font-medium text-gray-800">{table.title}</h4>
      </div>
      <div className="bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200">
            {table.headers.map((h, i) => <th key={i} className="text-left py-3 px-4 text-gray-500 font-medium text-xs uppercase tracking-[0.04em]">{h}</th>)}
          </tr></thead>
          <tbody>{table.rows.map((row, ri) => (
            <tr key={ri} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
              {row.map((cell, ci) => <td key={ci} className="py-2 px-4 text-gray-800">{cell}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

// ============ CHART RENDERER ============
function ChartRenderer({ chart }: { chart: ChartData }) {
  if (!chart || !chart.data || chart.data.length === 0) return null
  const colors = chart.colors || CHART_COLORS
  const keys = chart.keys || ["value"]
  const tooltipStyle = { backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }
  const axisProps = { tick: { fill: "#6b7280", fontSize: 11 }, axisLine: { stroke: "#e5e7eb" } }
  const gridStroke = "#f3f4f6"
  const renderChart = () => {
    switch (chart.type) {
      case "bar":
        return (<BarChart data={chart.data}><CartesianGrid strokeDasharray="3 3" stroke={gridStroke} /><XAxis dataKey="name" {...axisProps} /><YAxis {...axisProps} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="value" fill="#10B981" radius={[4, 4, 0, 0]} /></BarChart>)
      case "stacked_bar":
        return (<BarChart data={chart.data}><CartesianGrid strokeDasharray="3 3" stroke={gridStroke} /><XAxis dataKey="name" {...axisProps} /><YAxis {...axisProps} /><Tooltip contentStyle={tooltipStyle} /><Legend />{keys.map((key, i) => <Bar key={key} dataKey={key} stackId="a" fill={colors[i % colors.length]} radius={i === keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />)}</BarChart>)
      case "line":
        return (<LineChart data={chart.data}><CartesianGrid strokeDasharray="3 3" stroke={gridStroke} /><XAxis dataKey="name" {...axisProps} /><YAxis {...axisProps} /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} dot={{ fill: "#10B981", strokeWidth: 0 }} activeDot={{ r: 6, fill: "#10B981" }} /></LineChart>)
      case "multi_line":
        return (<LineChart data={chart.data}><CartesianGrid strokeDasharray="3 3" stroke={gridStroke} /><XAxis dataKey="name" {...axisProps} /><YAxis {...axisProps} /><Tooltip contentStyle={tooltipStyle} /><Legend />{keys.map((key, i) => <Line key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ fill: colors[i % colors.length], strokeWidth: 0 }} />)}</LineChart>)
      case "area":
        return (<AreaChart data={chart.data}><CartesianGrid strokeDasharray="3 3" stroke={gridStroke} /><XAxis dataKey="name" {...axisProps} /><YAxis {...axisProps} /><Tooltip contentStyle={tooltipStyle} /><defs><linearGradient id="areaGradEmerald" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.20} /><stop offset="95%" stopColor="#10B981" stopOpacity={0} /></linearGradient></defs><Area type="monotone" dataKey="value" stroke="#10B981" fill="url(#areaGradEmerald)" strokeWidth={2} /></AreaChart>)
      case "waterfall": {
        let running = 0
        const wd = chart.data.map(d => {
          if (d.isTotal) { const h = running; return { ...d, base: 0, bar: h, fill: h >= 0 ? "#3b82f6" : "#ef4444" } }
          const base = d.value >= 0 ? running : running + d.value; running += d.value
          return { ...d, base: Math.max(base, 0), bar: Math.abs(d.value), fill: d.value >= 0 ? "#10B981" : "#ef4444" }
        })
        return (<BarChart data={wd}><CartesianGrid strokeDasharray="3 3" stroke={gridStroke} /><XAxis dataKey="name" {...axisProps} /><YAxis {...axisProps} /><Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: string) => name === "base" ? null : ["$" + Number(v).toLocaleString(), "Amount"]} /><Bar dataKey="base" stackId="stack" fill="transparent" /><Bar dataKey="bar" stackId="stack" radius={[4, 4, 0, 0]}>{wd.map((d, i) => <Cell key={i} fill={d.fill} />)}</Bar></BarChart>)
      }
      case "composed":
        return (<ComposedChart data={chart.data}><CartesianGrid strokeDasharray="3 3" stroke={gridStroke} /><XAxis dataKey="name" {...axisProps} /><YAxis yAxisId="left" {...axisProps} /><YAxis yAxisId="right" orientation="right" {...axisProps} /><Tooltip contentStyle={tooltipStyle} /><Legend />{keys.slice(0, -1).map((key, i) => <Bar key={key} yAxisId="left" dataKey={key} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />)}<Line yAxisId="right" type="monotone" dataKey={keys[keys.length - 1]} stroke={colors[(keys.length - 1) % colors.length]} strokeWidth={2} dot={false} /></ComposedChart>)
      case "pie": default:
        return (<RechartsPie><Pie data={chart.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{chart.data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} /><Legend /></RechartsPie>)
    }
  }
  return (
    <div style={{ margin: "16px 0", border: "1px solid #e8e8e4", borderRadius: "12px", overflow: "hidden" }}>
      <div style={{ background: "#fafaf9", padding: "10px 16px", borderBottom: "1px solid #e8e8e4" }}>
        <h4 style={{ fontSize: "13px", fontWeight: 500, color: "#374151", margin: 0 }}>{chart.title}</h4>
      </div>
      <div style={{ background: "#fff", padding: "16px", height: "272px" }}>
        <ResponsiveContainer width="100%" height="100%">{renderChart()}</ResponsiveContainer>
      </div>
    </div>
  )
}

// ============ AGENT RESULT RENDERER ============
function AgentResultRenderer({ result }: { result: AgentResult }) {
  if (!result || result.status === "error") {
    return (
      <div className="my-3 p-4 rounded border border-rose-200 bg-rose-50">
        <div className="flex items-center gap-2 text-rose-700 text-sm font-medium mb-1">
          <XOctagon size={14} />
          <span>Agent Error: {result?.agent || "Unknown"}</span>
        </div>
        <p className="text-rose-600 text-sm">{result?.summary || "Failed to run agent."}</p>
      </div>
    )
  }

  const agentLabels: Record<string, string> = {
    "invoice-validator": "Invoice Validator",
    "expense-categorizer": "Expense Categorizer",
    "timesheet-reconciler": "Timesheet Reconciler",
    "cashflow-forecaster": "Cash Flow Forecaster",
    "project-health": "Project Health Monitor",
  }

  return (
    <div className="my-3 p-4 rounded border border-gray-200 bg-gray-50">
      <div className="flex items-center gap-2 text-gray-700 text-sm font-medium mb-2">
        <Shield size={14} />
        <span>{agentLabels[result.agent] || result.agent}</span>
        <span className="px-1.5 py-0.5 rounded text-[9px] bg-gray-100 text-gray-600 uppercase tracking-[0.04em]">Complete</span>
      </div>
      <p className="text-gray-700 text-sm">{result.summary}</p>
    </div>
  )
}

// ============ APPROVAL WORKFLOW COMPONENT ============
function ApprovalCard({ approval, onApprove, onReject }: { approval: PendingApproval; onApprove: () => void; onReject: () => void }) {
  const [processing, setProcessing] = useState(false)
  const [decided, setDecided] = useState<"approved" | "rejected" | null>(null)

  const handleApprove = async () => {
    setProcessing(true)
    try {
      await approval.onApprove()
      setDecided("approved")
    } catch (e) {
      console.error("Approval failed:", e)
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = () => {
    approval.onReject()
    setDecided("rejected")
  }

  if (decided === "approved") {
    return (
      <div className="my-3 p-4 rounded border border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 text-gray-700 text-sm font-medium">
          <CheckCircle2 size={16} />
          <span>Approved and applied. {approval.items.length} items updated.</span>
        </div>
      </div>
    )
  }

  if (decided === "rejected") {
    return (
      <div className="my-3 p-4 rounded border border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <X size={14} />
          <span>Changes discarded.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="my-3 rounded border border-amber-200 bg-amber-50/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-amber-200 bg-amber-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-800 text-sm font-medium">
            <AlertTriangle size={14} />
            <span>Approval Required</span>
          </div>
          <span className="text-xs text-amber-600">{approval.items.length} items</span>
        </div>
        <p className="text-xs text-amber-700 mt-1">{approval.description}</p>
      </div>
      {approval.items.length <= 10 && (
        <div className="bg-white overflow-x-auto max-h-48 overflow-y-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-gray-100">
              {approval.type === "bulk_update" && <>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Description</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Amount</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Change</th>
              </>}
              {approval.type === "invoice_approve" && <>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Invoice</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Amount</th>
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Status</th>
              </>}
            </tr></thead>
            <tbody>{approval.items.slice(0, 10).map((item, i) => (
              <tr key={i} className="border-b border-gray-50">
                {approval.type === "bulk_update" && <>
                  <td className="py-1.5 px-3 text-gray-700 truncate max-w-[200px]">{item.preview?.description || item.description || "-"}</td>
                  <td className="py-1.5 px-3 text-gray-700 tabular-nums">{item.preview?.amount ? formatCurrency(item.preview.amount) : "-"}</td>
                  <td className="py-1.5 px-3 text-gray-600">{item.preview?.newCategory || item.changes?.category || "-"}</td>
                </>}
                {approval.type === "invoice_approve" && <>
                  <td className="py-1.5 px-3 text-gray-700">{item.name || item.id}</td>
                  <td className="py-1.5 px-3 text-gray-700 tabular-nums">{formatCurrency(item.amount || 0)}</td>
                  <td className="py-1.5 px-3"><span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-700">Clean</span></td>
                </>}
              </tr>
            ))}</tbody>
          </table>
          {approval.items.length > 10 && <p className="text-xs text-gray-400 px-3 py-2">...and {approval.items.length - 10} more</p>}
        </div>
      )}
      <div className="px-4 py-3 flex items-center gap-3 bg-white border-t border-gray-100">
        <button onClick={handleApprove} disabled={processing} className="flex items-center gap-2 px-4 py-2 rounded bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium transition-colors disabled:opacity-50">
          {processing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {processing ? "Applying..." : "Approve"}
        </button>
        <button onClick={handleReject} disabled={processing} className="flex items-center gap-2 px-4 py-2 rounded bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-medium transition-colors">
          <X size={14} /> Reject
        </button>
      </div>
    </div>
  )
}

// ============ EMAIL DRAFT CARD ============
function EmailDraftCard({ draft, onSend }: { draft: EmailDraftData; onSend: (draft: EmailDraftData) => Promise<void> }) {
  const [status, setStatus] = useState<"pending" | "sending" | "sent" | "error">("pending")
  const [editMode, setEditMode] = useState(false)
  const [editSubject, setEditSubject] = useState(draft.subject)
  const [editBody, setEditBody] = useState(draft.body)

  const toneColors: Record<string, string> = {
    info: "border-gray-200 bg-gray-50",
    reminder: "border-amber-200 bg-amber-50/50",
    urgent: "border-rose-200 bg-rose-50/50",
    appreciation: "border-violet-200 bg-violet-50/50",
    correction: "border-blue-200 bg-blue-50/50",
  }

  const handleSend = async () => {
    setStatus("sending")
    try {
      const finalDraft = editMode ? { ...draft, subject: editSubject, body: editBody } : draft
      await onSend(finalDraft)
      setStatus("sent")
      setEditMode(false)
    } catch {
      setStatus("error")
    }
  }

  if (status === "sent") {
    return (
      <div className="my-3 p-4 rounded border border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 text-gray-700 text-sm font-medium">
          <CheckCircle2 size={16} />
          <span>Email sent to {draft.isTeamWide ? "all contractors" : draft.recipientName}.</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`my-3 rounded border overflow-hidden ${toneColors[draft.tone] || toneColors.info}`}>
      <div className="px-4 py-3 border-b border-gray-200 bg-white/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-800 text-sm font-medium">
            <Mail size={14} className="text-gray-600" />
            <span>Email Draft</span>
            <span className="px-1.5 py-0.5 rounded text-[9px] bg-gray-100 text-gray-500 uppercase tracking-[0.04em]">{draft.tone}</span>
          </div>
          <span className="text-xs text-gray-500">
            To: {draft.isTeamWide ? "All Contractors" : `${draft.recipientName} (${draft.recipientEmail})`}
          </span>
        </div>
      </div>
      <div className="bg-white px-4 py-3">
        {editMode ? (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-[0.04em]">Subject</label>
              <input value={editSubject} onChange={e => setEditSubject(e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:outline-none focus:border-gray-900" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-500 uppercase tracking-[0.04em]">Body</label>
              <textarea value={editBody} onChange={e => setEditBody(e.target.value)} rows={6} className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:outline-none focus:border-gray-900 resize-none" />
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs font-medium text-gray-800 mb-2">Subject: {draft.subject}</p>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded px-3 py-2 border border-gray-100">
              {draft.body}
            </div>
          </>
        )}
      </div>
      <div className="px-4 py-3 flex items-center gap-2 bg-white border-t border-gray-100">
        <button onClick={handleSend} disabled={status === "sending"} className="flex items-center gap-2 px-4 py-2 rounded bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium transition-colors disabled:opacity-50">
          {status === "sending" ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {status === "sending" ? "Sending..." : status === "error" ? "Retry" : "Approve & Send"}
        </button>
        <button onClick={() => setEditMode(!editMode)} disabled={status === "sending"} className="flex items-center gap-2 px-4 py-2 rounded bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-medium transition-colors">
          <Pencil size={14} /> {editMode ? "Preview" : "Edit"}
        </button>
        {status === "error" && <span className="text-xs text-rose-500 ml-2">Failed to send. Try again.</span>}
      </div>
    </div>
  )
}

// ============ MESSAGE COMPONENT ============
function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user"
  
  const parseVisuals = (content: string): { text: string, charts: ChartData[], tables: TableData[] } => {
    let text = content
    const charts: ChartData[] = []
    const tables: TableData[] = []
    const chartRegex = /```sage-chart\s*([\s\S]*?)```/g
    let match
    while ((match = chartRegex.exec(text)) !== null) { try { charts.push(JSON.parse(match[1].trim())) } catch (e) { console.error("Chart parse error:", e) } }
    text = text.replace(/```sage-chart[\s\S]*?```/g, "").trim()
    const tableRegex = /```sage-table\s*([\s\S]*?)```/g
    while ((match = tableRegex.exec(text)) !== null) { try { tables.push(JSON.parse(match[1].trim())) } catch (e) { console.error("Table parse error:", e) } }
    text = text.replace(/```sage-table[\s\S]*?```/g, "").trim()
    return { text, charts, tables }
  }
  const { text, charts, tables } = isUser ? { text: message.content, charts: [], tables: [] } : parseVisuals(message.content)
  
  const formatContent = (content: string) => {
    return content.split("\n").map((line, i) => {
      if (line.includes("[View") || line.includes("->]") || line.includes("\u2192]")) {
        const linkMatch = line.match(/\[(.*?)\s*(?:->|\u2192)\]/)
        if (linkMatch) {
          const t = linkMatch[1].toLowerCase()
          const href = t.includes("forecast") ? "/forecast" : t.includes("report") ? "/reports" : t.includes("invoice") ? "/invoices" : t.includes("project") ? "/projects" : t.includes("client") ? "/clients" : t.includes("time") ? "/time-tracking" : t.includes("team") ? "/team" : t.includes("expense") ? "/expense-mgmt" : "/dashboard"
          return <p key={i} className="my-1"><Link href={href} className="text-gray-600 hover:text-gray-400 inline-flex items-center gap-1 transition-colors font-medium">{linkMatch[1]} <ChevronRight size={12} /></Link></p>
        }
      }
      if (line.trim().startsWith("- ") || line.trim().startsWith("\u2022 ")) {
        return <p key={i} style={{ margin: "3px 0", paddingLeft: "14px", color: "#374151", fontSize: "15px", lineHeight: 1.75 }}>{"• "}{line.replace(/^[-•]\s*/, "").replace(/\*\*/g, "")}</p>
      }
      if (/^\d+\.\s/.test(line.trim())) return <p key={i} style={{ margin: "3px 0", paddingLeft: "14px", color: "#374151", fontSize: "15px", lineHeight: 1.75 }}>{line.replace(/\*\*/g, "")}</p>
      if (line.trim().endsWith(":") && line.trim().length < 60 && !line.includes("$")) return <p key={i} style={{ margin: "10px 0 4px", color: "#111827", fontWeight: 500, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{line.replace(/\*\*/g, "")}</p>
      return <p key={i} style={{ margin: "4px 0", color: "#374151", fontSize: "15px", lineHeight: 1.75 }}>{line.replace(/\*\*/g, "")}</p>
    })
  }
  
  if (isUser) {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px', maxWidth: '720px', margin: '0 auto 24px', width: '100%' }}>
        <div style={{ maxWidth: '65%' }}>
          {message.attachments && message.attachments.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '6px', justifyContent: 'flex-end' }}>
              {message.attachments.map(att => (
                <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', background: '#f4f4f2', borderRadius: '8px', fontSize: '11px' }}>
                  {att.type.startsWith("image/") ? <ImageIcon size={12} style={{ color: '#6b7280' }} /> : <FileText size={12} style={{ color: '#6b7280' }} />}
                  <span style={{ color: '#374151' }}>{att.name}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ background: '#f4f4f2', borderRadius: '18px 18px 4px 18px', padding: '12px 16px', fontSize: '14px', color: '#374151', lineHeight: 1.6 }}>
            {formatContent(text)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: '14px', marginBottom: '28px', maxWidth: '720px', margin: '0 auto 28px', width: '100%' }}>
      <div style={{ flexShrink: 0, marginTop: '2px' }}><SageLogo size={32} /></div>
      <div style={{ flex: 1, minWidth: 0, paddingTop: '4px' }}>
        <div style={{ fontSize: '12px', fontWeight: 500, color: '#10b981', marginBottom: '8px' }}>Sage</div>
        {message.attachments && message.attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '12px' }}>
            {message.attachments.map(att => (
              <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', background: '#f7f7f5', borderRadius: '6px', fontSize: '11px', border: '1px solid #e8e8e4' }}>
                {att.type.startsWith("image/") ? <ImageIcon size={12} style={{ color: '#6b7280' }} /> : <FileText size={12} style={{ color: '#6b7280' }} />}
                <span style={{ color: '#374151' }}>{att.name}</span>
                <span style={{ color: '#9ca3af' }}>{formatFileSize(att.size)}</span>
              </div>
            ))}
          </div>
        )}
        {message.agentResult && <AgentResultRenderer result={message.agentResult} />}
        <div style={{ fontSize: '15px', lineHeight: 1.75, color: '#374151' }}>{formatContent(text)}</div>
        {tables.map((t, i) => <TableRenderer key={`t-${i}`} table={t} />)}
        {charts.map((c, i) => <ChartRenderer key={`c-${i}`} chart={c} />)}
        {message.pendingApproval && (
          <ApprovalCard approval={message.pendingApproval} onApprove={message.pendingApproval.onApprove} onReject={message.pendingApproval.onReject} />
        )}
        {message.emailDraft && (
          <EmailDraftCard draft={message.emailDraft} onSend={async (finalDraft) => {
            const res = await fetch("/api/agents/email-send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(finalDraft) })
            if (!res.ok) throw new Error("Send failed")
            const data = await res.json()
            if (!data.success) throw new Error("Send failed")
          }} />
        )}
      </div>
    </div>
  )
}

// ============ CONVERSATION ITEM ============
function ConversationItem({ conversation, isActive, onClick, onDelete, onRename }: { conversation: Conversation, isActive: boolean, onClick: () => void, onDelete: () => void, onRename: (title: string) => void }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(conversation.title)
  const timeAgo = useMemo(() => {
    const diff = Date.now() - new Date(conversation.updated_at).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h`
    return `${Math.floor(hrs / 24)}d`
  }, [conversation.updated_at])
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: "8px", padding: "8px 10px", borderRadius: "8px", cursor: "pointer", background: isActive ? "#fff" : "transparent", boxShadow: isActive ? "0 1px 3px rgba(0,0,0,0.07)" : "none", marginBottom: "2px" }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#f0f0ec" }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent" }}
      onClick={() => !isEditing && onClick()}>
      <MessageSquare size={13} style={{ color: isActive ? "#374151" : "#9ca3af", flexShrink: 0, marginTop: "2px" }} />
      {isEditing ? (
        <div className="flex-1 flex items-center gap-1">
          <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="flex-1 bg-white text-sm text-gray-900 px-2 py-1 rounded border border-gray-200 focus:outline-none focus:border-gray-900" autoFocus onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === "Enter") { onRename(editTitle); setIsEditing(false) } if (e.key === "Escape") setIsEditing(false) }} />
          <button onClick={e => { e.stopPropagation(); onRename(editTitle); setIsEditing(false) }} className="p-1 text-gray-600"><Check size={14} /></button>
          <button onClick={e => { e.stopPropagation(); setIsEditing(false) }} className="p-1 text-gray-400"><X size={14} /></button>
        </div>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <span style={{ fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", color: isActive ? "#111827" : "#374151", fontWeight: isActive ? 500 : 400 }}>{conversation.title}</span>
            <span className="text-[10px] text-gray-400">{timeAgo} ago</span>
          </div>
          <div className={`flex items-center gap-0.5 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
            <button onClick={e => { e.stopPropagation(); setIsEditing(true); setEditTitle(conversation.title) }} className="p-1 text-gray-400 hover:text-gray-600"><Pencil size={12} /></button>
            <button onClick={e => { e.stopPropagation(); onDelete() }} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={12} /></button>
          </div>
        </>
      )}
    </div>
  )
}

// ============ ALERT BADGE ============
function AlertCard({ icon: Icon, label, count, color, onClick }: { icon: any, label: string, count: number, color: string, onClick: () => void }) {
  const cm: Record<string, string> = {
    amber: "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100",
    rose: "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100",
    orange: "bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100",
  }
  return (
    <button onClick={onClick} className={`flex items-center gap-2.5 px-3 py-2 rounded border text-xs font-medium transition-all ${cm[color] || cm.amber}`}>
      <Icon size={14} /><span>{count} {label}</span><ChevronRight size={12} className="opacity-50" />
    </button>
  )
}

// ============ MAIN PAGE ============
export default function SageAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [input, setInput] = useState("")
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingLabel, setLoadingLabel] = useState("Analyzing your data...")
  const [companyData, setCompanyData] = useState<CompanyData | null>(null)
  const [kpis, setKpis] = useState<KPISummary | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  useEffect(() => { scrollToBottom() }, [messages])
  useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = "auto"; textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px" } }, [input])

  // ---- DATA LOADING ----
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setDataLoading(false); return }
        setUserId(user.id)
        const { data: profile } = await supabase.from("profiles").select("company_id").eq("id", user.id).single()
        if (profile?.company_id) {
          setCompanyId(profile.company_id)
          const cid = profile.company_id
          const [transactions, invoices, projects, clients, teamMembers, timeEntries, projectAssignments, billRates, costOverrides, expenses] = await Promise.all([
            supabase.from("transactions").select("*").eq("company_id", cid).order("date", { ascending: false }).limit(500),
            supabase.from("invoices").select("*").eq("company_id", cid),
            supabase.from("projects").select("*").eq("company_id", cid),
            supabase.from("clients").select("*").eq("company_id", cid),
            supabase.from("team_members").select("*").eq("company_id", cid),
            supabase.from("time_entries").select("*").eq("company_id", cid),
            supabase.from("team_project_assignments").select("*").eq("company_id", cid),
            supabase.from("bill_rates").select("*").eq("company_id", cid),
            supabase.from("cost_overrides").select("*").eq("company_id", cid),
            supabase.from("expenses").select("*").eq("company_id", cid).order("date", { ascending: false }).limit(500),
          ])
          const { data: learnedPatterns } = await supabase.from("sage_learned_patterns").select("*").eq("company_id", cid).neq("status", "rejected")
          const data: CompanyData = {
            transactions: transactions.data || [], invoices: invoices.data || [],
            projects: projects.data || [], clients: clients.data || [],
            teamMembers: teamMembers.data || [], timeEntries: timeEntries.data || [],
            projectAssignments: projectAssignments.data || [],
            billRates: billRates.data || [], costOverrides: costOverrides.data || [],
            expenses: expenses.data || [], learnedPatterns: learnedPatterns || [],
          }
          setCompanyData(data)
          setKpis(calculateKPIs(data))
          const { data: convos } = await supabase.from("sage_conversations").select("*").eq("user_id", user.id).order("updated_at", { ascending: false })
          if (convos) setConversations(convos.map(c => ({ ...c, messages: c.messages || [] })))
        }
      } catch (error) { console.error("Error loading data:", error) }
      finally { setDataLoading(false) }
    }
    loadData()
  }, [])

  // ---- CONVERSATION MANAGEMENT ----
  const saveConversation = async (msgs: Message[], conversationId: string | null, title?: string) => {
    if (!userId || !companyId) return null
    const messagesForStorage = msgs.map(m => ({ ...m, timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp, pendingApproval: undefined, emailDraft: undefined }))
    if (conversationId) {
      await supabase.from("sage_conversations").update({ messages: messagesForStorage, updated_at: new Date().toISOString(), ...(title ? { title } : {}) }).eq("id", conversationId)
      return conversationId
    } else {
      const { data } = await supabase.from("sage_conversations").insert({ user_id: userId, company_id: companyId, title: title || "New Conversation", messages: messagesForStorage }).select().single()
      if (data) { setConversations(prev => [{ ...data, messages: msgs }, ...prev]); return data.id }
      return null
    }
  }
  const generateTitle = (content: string): string => content.split(" ").slice(0, 6).join(" ").slice(0, 40)

  // ---- FILE HANDLING ----
  const handleFileSelect = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(file => {
      if (file.size > 10 * 1024 * 1024) { alert("File too large. Max 10MB."); return }
      const reader = new FileReader()
      reader.onload = (e) => { setAttachments(prev => [...prev, { id: `att_${Date.now()}_${Math.random()}`, name: file.name, type: file.type, size: file.size, content: e.target?.result as string }]) }
      if (file.type.startsWith("image/")) reader.readAsDataURL(file); else reader.readAsText(file)
    })
  }
  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); handleFileSelect(e.dataTransfer.files) }, [])
  const removeAttachment = (id: string) => setAttachments(prev => prev.filter(a => a.id !== id))

  // ---- AGENT CALLER ----
  const callAgent = async (agent: string, action: string): Promise<AgentResult> => {
    try {
      const endpoint = `/api/agents/${agent}`
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, companyId })
      })
      if (!res.ok) throw new Error(`Agent ${agent} returned ${res.status}`)
      const data = await res.json()
      return { agent, status: "success", data, summary: data.ai_analysis || data.ai_digest || data.summary || "Agent completed successfully." }
    } catch (err) {
      console.error(`Agent ${agent} failed:`, err)
      return { agent, status: "error", data: null, summary: `Failed to run ${agent}: ${(err as Error).message}` }
    }
  }

  // ---- FORMAT AGENT RESULTS FOR AI CONTEXT ----
  const formatAgentResultForAI = (result: AgentResult): string => {
    if (result.status === "error") return `AGENT ERROR (${result.agent}): ${result.summary}`
    const d = result.data
    switch (result.agent) {
     case "timesheet-reconciler": {
  const weeklyTable = (d.weekly_by_client || []).map((row: any) => {
    const clients = Object.entries(row.clients || {}).map(([c, h]) => `${c}: ${(h as number).toFixed(1)}h`).join(" | ")
    return `  Week of ${row.week_label}: ${clients} (total ${row.total.toFixed(1)}h)`
  }).join("\n") || "  All hours submitted in one batch — no weekly breakdown available"

  const clientTotals = Object.entries(d.client_totals || {}).map(([c, h]) => `  ${c}: ${(h as number).toFixed(1)}h`).join("\n") || "  None"

  return `TIMESHEET RECONCILER RESULTS:
Week: ${d.week?.start} to ${d.week?.end}
Team: ${d.team_summary?.total_members || 0} contractors, ${d.team_summary?.submitted || 0} submitted, ${d.team_summary?.missing || 0} missing, ${d.team_summary?.partial || 0} partial
Total hours: ${d.team_summary?.total_hours || 0}
${(d.members || []).map((m: any) => `  ${m.name}: ${m.status} (${m.hours_logged}h) — ${m.projects?.map((p: any) => `${p.name}: ${p.hours}h`).join(", ") || "no entries"}`).join("\n")}
WEEKLY HOURS BY CLIENT:
${weeklyTable}
CLIENT PERIOD TOTALS:
${clientTotals}
Budget alerts: ${(d.budget_alerts || []).map((b: any) => `${b.project_name} (${b.client_name}): ${b.hours_used}/${b.budget_hours}h = ${b.burn_pct}% [${b.status}]`).join("; ") || "None"}
AI Analysis: ${d.ai_analysis || ""}
Reminders drafted: ${(d.reminders || []).length}`
}

      case "cashflow-forecaster":
        return `CASH FLOW FORECAST RESULTS:
Current cash: $${Math.round(d.current_cash || 0).toLocaleString()}
13-week projection:
${(d.forecast_weeks || []).map((w: any) => `  Wk${w.week_number} (${w.week_start}): In $${Math.round(w.inflows?.total || 0).toLocaleString()} / Out $${Math.round(w.outflows?.total || 0).toLocaleString()} / Net $${Math.round(w.net_cash_flow || 0).toLocaleString()} / Balance $${Math.round(w.running_balance || 0).toLocaleString()} [${w.confidence}]`).join("\n")}
Summary: Inflows $${Math.round(d.summary?.total_inflows || 0).toLocaleString()}, Outflows $${Math.round(d.summary?.total_outflows || 0).toLocaleString()}, Ending balance $${Math.round(d.summary?.ending_balance || 0).toLocaleString()}
Lowest: $${Math.round(d.summary?.lowest_balance || 0).toLocaleString()} in week ${d.summary?.lowest_balance_week || "?"}
${d.summary?.runway_weeks ? `Runway: ~${d.summary.runway_weeks} weeks` : "Cash position stable"}
Alerts: ${(d.alerts || []).map((a: any) => `[${a.severity}] ${a.message}`).join("; ") || "None"}
AI Analysis: ${d.ai_analysis || ""}`

      case "project-health":
        return `PROJECT HEALTH RESULTS:
Portfolio: ${d.portfolio_summary?.total_projects || 0} projects — ${d.portfolio_summary?.green || 0} green, ${d.portfolio_summary?.yellow || 0} yellow, ${d.portfolio_summary?.red || 0} red
Total revenue: $${Math.round(d.portfolio_summary?.total_revenue || 0).toLocaleString()} | Cost: $${Math.round(d.portfolio_summary?.total_cost || 0).toLocaleString()} | Blended margin: ${d.portfolio_summary?.blended_margin || 0}%
AR outstanding: $${Math.round(d.portfolio_summary?.total_ar || 0).toLocaleString()}
${(d.projects || []).map((p: any) => `  [${p.status.toUpperCase()}] ${p.project_name} (${p.client_name}): ${p.gross_margin_pct}% margin, ${p.hours_used}h${p.budget_hours ? "/" + p.budget_hours + "h" : ""}, AR $${Math.round(p.ar_outstanding || 0).toLocaleString()} — ${p.signals?.join("; ")}`).join("\n")}
AI Digest: ${d.ai_digest || ""}`

      case "invoice-validator":
        return `INVOICE VALIDATOR RESULTS:
${(d.results || [d]).map((r: any) => `Invoice ${r.invoice_id || "?"}: ${r.status} — ${r.recommendation || ""} ${(r.issues || []).map((i: any) => i.description || i).join("; ")}`).join("\n")}
Summary: ${d.summary || result.summary}`

      case "expense-categorizer":
        return `EXPENSE CATEGORIZER RESULTS:
${d.processed || 0} transactions processed, ${d.auto_applied || 0} auto-categorized, ${d.needs_review || 0} need review
${(d.categorizations || []).slice(0, 20).map((c: any) => `  "${c.description}": $${c.amount} -> ${c.suggested_category} (${Math.round((c.confidence || 0) * 100)}% confidence)`).join("\n") || "No categorizations"}
AI Summary: ${d.summary || result.summary}`

      default:
        return `AGENT (${result.agent}): ${JSON.stringify(d).slice(0, 2000)}`
    }
  }

  // ---- SEND MESSAGE (with agent routing) ----
  const sendMessage = async (content: string) => {
    if ((!content.trim() && attachments.length === 0) || loading) return
    const userMessage: Message = { id: `user_${Date.now()}`, role: "user", content: content.trim(), timestamp: new Date(), attachments: attachments.length > 0 ? [...attachments] : undefined }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages); setInput(""); setAttachments([]); setLoading(true)

    try {
      // === STEP 1: Detect agent intent ===
      const intent = detectAgentIntent(content)
      let agentContext = ""
      let agentResults: AgentResult[] = []

      if (intent.agent && intent.confidence >= 0.7) {
        if (intent.agent === "morning-briefing") {
          // Multi-agent: run project health + cash flow + timesheet reconciler
          setLoadingLabel("Running morning briefing — checking projects, cash flow, and timesheets...")
          const [health, cashflow, timesheet] = await Promise.all([
            callAgent("project-health", "digest"),
            callAgent("cashflow-forecaster", "alerts-only"),
            callAgent("timesheet-reconciler", "reconcile"),
          ])
          agentResults = [health, cashflow, timesheet]
          agentContext = agentResults.map(formatAgentResultForAI).join("\n\n---\n\n")
        } else {
          const agentLabels: Record<string, string> = {
            "invoice-validator": "Validating invoices against time entries...",
            "expense-categorizer": "Analyzing uncategorized transactions...",
            "timesheet-reconciler": "Checking timesheet submissions...",
            "cashflow-forecaster": "Building 13-week cash flow forecast...",
            "project-health": "Scanning project health across portfolio...",
          }
          setLoadingLabel(agentLabels[intent.agent] || "Running agent...")
          const result = await callAgent(intent.agent, intent.action)
          agentResults = [result]
          agentContext = formatAgentResultForAI(result)
        }
      }

      // === STEP 2: Build context and call AI ===
      setLoadingLabel("Analyzing your data...")
      let dataContext = companyData && kpis ? buildDataContext(companyData, kpis) : "No company data available yet."

      if (agentContext) {
        dataContext += `\n\n=== AGENT RESULTS (present these clearly with tables and charts) ===\n${agentContext}`
      }

      if (userMessage.attachments) {
        dataContext += "\n\n=== ATTACHED FILES ===\n"
        userMessage.attachments.forEach(att => {
          if (att.type.startsWith("image/")) dataContext += `  Image: ${att.name} (${formatFileSize(att.size)})\n`
          else dataContext += `  File: ${att.name}\nContent:\n${att.content?.slice(0, 8000) || "[Unable to read]"}\n\n`
        })
      }

      const response = await fetch("/api/ai/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })), systemPrompt: SYSTEM_PROMPT, dataContext })
      })
      if (!response.ok) throw new Error("Failed to get AI response")
      const data = await response.json()
      let assistantContent = data.content

      // === STEP 3: Detect learned patterns ===
      const patternRegex = /PATTERN_LEARNED:\s*vendor="([^"]+)"\s*category="([^"]+)"(?:\s*sub_category="([^"]*)")?/g
      let patternMatch
      let patternsFound = false
      while ((patternMatch = patternRegex.exec(assistantContent)) !== null) {
        patternsFound = true
        const [, vendor, category, subCategory] = patternMatch
        const normalized = vendor.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim()
        try {
          await supabase.from("sage_learned_patterns").upsert({
            company_id: companyId, pattern_type: "vendor_category", vendor_name: vendor,
            vendor_normalized: normalized, category, sub_category: subCategory || null,
            match_field: "vendor", match_value: normalized, confidence: 1.00,
            times_confirmed: 1, status: "approved", approved_by: userId,
            approved_at: new Date().toISOString(), source: "sage_ai",
          }, { onConflict: "company_id,vendor_normalized", ignoreDuplicates: false })
        } catch (e) { console.error("Failed to save pattern:", e) }
      }
      if (patternsFound && companyId) {
        const { data: refreshedPatterns } = await supabase.from("sage_learned_patterns").select("*").eq("company_id", companyId).neq("status", "rejected")
        if (refreshedPatterns && companyData) setCompanyData(prev => prev ? { ...prev, learnedPatterns: refreshedPatterns } : prev)
      }
      assistantContent = assistantContent.replace(/PATTERN_LEARNED:.*$/gm, "").replace(/\n{3,}/g, "\n\n").trim()

      // === STEP 4: Detect action blocks for approval workflow ===
      let actionData = null
      let cleanMessage = assistantContent
      const actionMatch2 = assistantContent.match(/```vantage-action\s*([\s\S]*?)```/)
      if (actionMatch2 && actionMatch2[1]) {
        try {
          actionData = JSON.parse(actionMatch2[1].trim())
          cleanMessage = assistantContent.replace(/```vantage-action[\s\S]*?```/g, "").trim()
        } catch (e) { console.error("Failed to parse action:", e) }
      }

      // === STEP 5: Detect email draft from agent response ===
      let emailDraftData: EmailDraftData | undefined = undefined
      if (data.action?.type === "email_draft" && data.action.data) {
        emailDraftData = data.action.data as EmailDraftData
      }

      // Build assistant message
      const assistantMessage: Message = {
        id: `assistant_${Date.now()}`,
        role: "assistant",
        content: cleanMessage,
        timestamp: new Date(),
        emailDraft: emailDraftData,
        agentResult: agentResults.length > 0 ? { agent: agentResults.map(r => r.agent).join("+"), status: agentResults.every(r => r.status === "success") ? "success" : "error", data: agentResults.length === 1 ? agentResults[0].data : agentResults.map(r => r.data), summary: agentResults.map(r => r.summary).join(" | ") } : undefined,
        pendingApproval: actionData ? {
          id: `approval_${Date.now()}`,
          type: actionData.action === "bulk_update" ? "bulk_update" : "invoice_approve",
          description: actionData.summary || "Review changes before applying",
          items: actionData.updates || [],
          onApprove: async () => {
            // Execute the bulk update
            try {
              for (const update of (actionData.updates || [])) {
                await supabase.from("transactions").update(update.changes).eq("id", update.id).eq("company_id", companyId)
              }
            } catch (err) { console.error("Bulk update failed:", err) }
          },
          onReject: () => { /* no-op, just discard */ }
        } : undefined,
      }

      const finalMessages = [...newMessages, assistantMessage]
      setMessages(finalMessages)
      const title = messages.length === 0 ? generateTitle(content) : undefined
      const savedId = await saveConversation(finalMessages, currentConversationId, title)
      if (savedId && !currentConversationId) setCurrentConversationId(savedId)
      if (currentConversationId) setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: finalMessages, updated_at: new Date().toISOString() } : c))
    } catch (error) {
      console.error("Error:", error)
      setMessages(prev => [...prev, { id: `error_${Date.now()}`, role: "assistant", content: "I hit an error connecting to the AI service. Check your API configuration and try again.", timestamp: new Date() }])
    } finally { setLoading(false); setLoadingLabel("Analyzing your data...") }
  }

  const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => sendMessage(action.label)
  const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }
  const startNewConversation = () => { setCurrentConversationId(null); setMessages([]) }
  const loadConversation = (conversation: Conversation) => { setCurrentConversationId(conversation.id); setMessages(conversation.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))) }
  const deleteConversation = async (id: string) => { await supabase.from("sage_conversations").delete().eq("id", id); setConversations(prev => prev.filter(c => c.id !== id)); if (currentConversationId === id) startNewConversation() }
  const renameConversation = async (id: string, title: string) => { await supabase.from("sage_conversations").update({ title }).eq("id", id); setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c)) }
  const hasMessages = messages.length > 0
  const getGreeting = () => {
    const h = new Date().getHours()
    if (h >= 5 && h < 12) return "Good morning"
    if (h >= 12 && h < 17) return "Good afternoon"
    if (h >= 17 && h < 21) return "Good evening"
    return "Working late"
  }
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations
    return conversations.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [conversations, searchQuery])
  const dataStats = useMemo(() => {
    if (!companyData) return null
    const uncatTxns = companyData.transactions?.filter(t => !t.category || t.category === "uncategorized" || t.category === "").length || 0
    const overdueInvs = companyData.invoices?.filter(i => i.status !== "paid" && new Date(i.due_date || i.created_at) < new Date()).length || 0
    const totalDataPoints = (companyData.transactions?.length || 0) + (companyData.invoices?.length || 0) + (companyData.timeEntries?.length || 0)
    const learnedCount = companyData.learnedPatterns?.filter(p => p.status === "approved").length || 0
    return { uncatTxns, overdueInvs, totalDataPoints, learnedCount }
  }, [companyData])
  const smartPlaceholder = useMemo(() => {
    if (!dataStats) return "Ask Sage anything about your business..."
    if (dataStats.uncatTxns > 5) return `You have ${dataStats.uncatTxns} uncategorized transactions — ask me to sort them`
    if (dataStats.overdueInvs > 0) return `${dataStats.overdueInvs} overdue invoice${dataStats.overdueInvs > 1 ? "s" : ""} — ask me for a follow-up plan`
    if (kpis && kpis.teamMarginPct > 0 && kpis.teamMarginPct < 15) return `Margin at ${kpis.teamMarginPct.toFixed(1)}% — ask me what is driving this`
    return "Ask Sage anything about your business..."
  }, [dataStats, kpis])

  // ---- LOADING STATE ----
  if (dataLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 80px)', background: '#fff' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ margin: "0 auto 16px", width: "fit-content" }}><SageLogo size={48} className="animate-pulse" /></div>
        <p style={{ fontSize: '13px', color: '#9ca3af' }}>Loading your financial data...</p>
      </div>
    </div>
  )

  // Sage owl avatar reused inline
  const OwlAvatar = ({ size = 32 }: { size?: number }) => (
    <SageLogo size={size} />
  )

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 80px)', background: '#fff' }}>

      {/* ── SIDEBAR ── */}
      <div style={{ width: sidebarOpen ? '260px' : '0', background: '#fafaf9', borderRight: '1px solid #e8e8e4', display: 'flex', flexDirection: 'column', transition: 'width 0.2s', overflow: 'hidden', flexShrink: 0 }}>

        {/* Brand + new button */}
        <div style={{ padding: '16px 14px 10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <OwlAvatar size={32} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>Sage</div>
              <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '1px' }}>Financial AI · Vantage</div>
            </div>
          </div>
          <button onClick={startNewConversation}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 12px', background: '#fff', border: '1px solid #e0e0db', borderRadius: '6px', fontSize: '13px', color: '#374151', cursor: 'pointer', fontFamily: 'inherit' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f3' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#fff' }}>
            <Plus size={13} /> New conversation
          </button>
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
          {filteredConversations.map(c => (
            <ConversationItem key={c.id} conversation={c} isActive={c.id === currentConversationId}
              onClick={() => loadConversation(c)} onDelete={() => deleteConversation(c.id)}
              onRename={title => renameConversation(c.id, title)} />
          ))}
          {filteredConversations.length === 0 && (
            <p style={{ fontSize: '12px', color: '#9ca3af', textAlign: 'center', padding: '24px 8px' }}>
              {searchQuery ? "No matches" : "No conversations yet"}
            </p>
          )}
        </div>

        {/* Live data footer */}
        {dataStats && (
          <div style={{ padding: '12px 14px', borderTop: '1px solid #e8e8e4' }}>
            <p style={{ fontSize: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: '6px' }}>Live data</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {dataStats.uncatTxns > 0 && (
                <button onClick={() => sendMessage("Categorize my uncategorized transactions")}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#92400e', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit', textAlign: 'left' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                  {dataStats.uncatTxns} uncategorized transactions
                </button>
              )}
              {dataStats.overdueInvs > 0 && (
                <button onClick={() => sendMessage("Show me overdue invoices and recommend follow-up actions")}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#991b1b', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', fontFamily: 'inherit', textAlign: 'left' }}>
                  <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                  {dataStats.overdueInvs} overdue invoices
                </button>
              )}
              {[
                { k: 'Transactions', v: companyData?.transactions?.length || 0 },
                { k: 'Time entries', v: companyData?.timeEntries?.length || 0 },
                { k: 'Projects', v: companyData?.projects?.length || 0 },
              ].map(row => (
                <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                  <span style={{ color: '#9ca3af' }}>{row.k}</span>
                  <span style={{ color: '#374151', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{row.v.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#fff' }}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}>

        {/* Top bar */}
        <div style={{ height: '52px', borderBottom: '1px solid #f0f0ec', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)}
                style={{ padding: '6px', background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', marginRight: '4px' }}>
                <PanelLeft size={16} />
              </button>
            )}
            <OwlAvatar size={28} />
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>Sage</span>
            <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', letterSpacing: '0.03em' }}>Financial AI</span>
          </div>
          {kpis && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px' }}>
              {[
                { l: 'GM%', v: `${kpis.teamMarginPct.toFixed(1)}%`, danger: kpis.teamMarginPct < 10 },
                { l: 'Runway', v: `${kpis.runway.toFixed(1)}mo`, danger: kpis.runway < 3 },
                { l: 'AR', v: formatCurrency(kpis.arOutstanding), danger: false },
                { l: 'Util', v: `${kpis.utilizationRate.toFixed(0)}%`, danger: false },
              ].map((k, i, arr) => (
                <React.Fragment key={k.l}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ color: '#9ca3af' }}>{k.l}</span>
                    <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums', color: k.danger ? '#dc2626' : '#374151' }}>{k.v}</span>
                  </div>
                  {i < arr.length - 1 && <div style={{ width: '1px', height: '13px', background: '#e8e8e4' }} />}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* ── CONTENT AREA ── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {!hasMessages ? (

            /* ── WELCOME ── */
            <div style={{ maxWidth: '620px', margin: '0 auto', padding: '52px 24px 24px' }}>

              {/* Owl + greeting */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
                <OwlAvatar size={48} />
                <div>
                  <h1 style={{ fontSize: '22px', fontWeight: 500, color: '#111827', margin: '0 0 5px' }}>
                    {getGreeting()}, Gabriel.
                  </h1>
                  <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
                    Ask me anything about your business — revenue, margins, your team, cash flow, or what needs your attention today.
                  </p>
                </div>
              </div>

              {/* Quick actions — plain text, no boxes */}
              <p style={{ fontSize: '11px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9ca3af', marginBottom: '10px' }}>Start here</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '28px' }}>
                {QUICK_ACTIONS.map((action, i) => (
                  <button key={i} onClick={() => handleQuickAction(action)}
                    style={{ padding: '11px 14px', background: '#fff', border: '1px solid #e8e8e4', borderRadius: '8px', fontSize: '13px', color: '#374151', textAlign: 'left', cursor: 'pointer', lineHeight: 1.4, fontFamily: 'inherit' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#9ca3af'; e.currentTarget.style.background = '#fafaf9' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e8e8e4'; e.currentTarget.style.background = '#fff' }}>
                    {action.label}
                  </button>
                ))}
              </div>

              {/* Big Claude-style input */}
              <div style={{ border: '1px solid #d1d5db', borderRadius: '14px', background: '#fff', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                {attachments.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '10px 16px 0' }}>
                    {attachments.map(att => (
                      <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', background: '#f7f7f5', borderRadius: '6px', fontSize: '11px', border: '1px solid #e8e8e4' }}>
                        {att.type.startsWith("image/") ? <ImageIcon size={12} style={{ color: '#6b7280' }} /> : <FileText size={12} style={{ color: '#6b7280' }} />}
                        <span style={{ color: '#374151' }}>{att.name}</span>
                        <button onClick={() => removeAttachment(att.id)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', padding: 0 }}><XCircle size={11} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyPress}
                  placeholder={smartPlaceholder} rows={2}
                  style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', padding: '16px 18px 8px', fontSize: '15px', color: '#111827', resize: 'none', fontFamily: 'inherit', minHeight: '60px', maxHeight: '200px', lineHeight: 1.55, boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px 10px' }}>
                  <span style={{ fontSize: '11px', color: '#c8c5bc' }}>Enter to send · Drop files to attach</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button onClick={() => fileInputRef.current?.click()}
                      style={{ width: '32px', height: '32px', border: 'none', borderRadius: '7px', background: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Paperclip size={16} />
                    </button>
                    <button onClick={() => sendMessage(input)} disabled={!input.trim() && attachments.length === 0}
                      style={{ width: '32px', height: '32px', border: 'none', borderRadius: '7px', background: (input.trim() || attachments.length > 0) && !loading ? '#111827' : '#f0f0ec', color: (input.trim() || attachments.length > 0) && !loading ? '#fff' : '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {loading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

          ) : (

            /* ── CHAT MESSAGES ── */
            <div style={{ maxWidth: '680px', margin: '0 auto', padding: '32px 24px' }}>
              {messages.map(message => <ChatMessage key={message.id} message={message} />)}
              {loading && (
                <div style={{ display: 'flex', gap: '14px', marginBottom: '28px' }}>
                  <OwlAvatar size={32} />
                  <div style={{ paddingTop: '4px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 500, color: '#10b981', marginBottom: '10px' }}>Sage</div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {[0, 150, 300].map(d => (
                        <span key={d} style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#9ca3af', display: 'inline-block', animation: 'bounce 1s infinite', animationDelay: `${d}ms` }} />
                      ))}
                      <span style={{ fontSize: '13px', color: '#9ca3af', marginLeft: '6px' }}>{loadingLabel}</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ── BOTTOM INPUT (when chat is active) ── */}
        {hasMessages && (
          <div style={{ borderTop: '1px solid #f0f0ec', padding: '12px 24px 16px', background: '#fff', flexShrink: 0 }}>
            <div style={{ maxWidth: '680px', margin: '0 auto' }}>
              <div style={{ border: '1px solid #d1d5db', borderRadius: '14px', background: '#fff', overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
                {attachments.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '10px 14px 0' }}>
                    {attachments.map(att => (
                      <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', background: '#f7f7f5', borderRadius: '6px', fontSize: '11px', border: '1px solid #e8e8e4' }}>
                        {att.type.startsWith("image/") ? <ImageIcon size={12} style={{ color: '#6b7280' }} /> : <FileText size={12} style={{ color: '#6b7280' }} />}
                        <span style={{ color: '#374151' }}>{att.name}</span>
                        <button onClick={() => removeAttachment(att.id)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', padding: 0 }}><XCircle size={11} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyPress}
                  placeholder="Ask a follow-up..." rows={1}
                  style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', padding: '12px 16px 6px', fontSize: '14px', color: '#111827', resize: 'none', fontFamily: 'inherit', minHeight: '44px', maxHeight: '200px', lineHeight: 1.5, boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 10px 8px' }}>
                  <span style={{ fontSize: '11px', color: '#c8c5bc' }}>Enter to send · Drop files to attach</span>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => fileInputRef.current?.click()}
                      style={{ width: '28px', height: '28px', border: 'none', borderRadius: '6px', background: 'none', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Paperclip size={15} />
                    </button>
                    <button onClick={() => sendMessage(input)} disabled={(!input.trim() && attachments.length === 0) || loading}
                      style={{ width: '28px', height: '28px', border: 'none', borderRadius: '6px', background: (input.trim() || attachments.length > 0) && !loading ? '#111827' : '#f0f0ec', color: (input.trim() || attachments.length > 0) && !loading ? '#fff' : '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {loading ? <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.csv,.xlsx,.xls,.txt,.json"
          onChange={e => handleFileSelect(e.target.files)} className="hidden" />
      </div>
    </div>
  )
}
