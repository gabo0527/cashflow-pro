"use client"

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { 
  Send, User, TrendingUp, DollarSign, 
  AlertTriangle, RefreshCw, Users, ChevronRight, Trash2, Clock, Target,
  Plus, MessageSquare, Pencil, Check, X, PanelLeftClose, PanelLeft,
  Paperclip, Image as ImageIcon, FileText, XCircle, BarChart3, PieChart,
  Zap, Brain, TrendingDown, ArrowUpRight, ArrowDownRight, Lightbulb, Activity,
  Gauge, Receipt, Search, CreditCard
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

const CHART_COLORS = ["#14B8A6", "#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899", "#34D399", "#6366F1", "#F97316", "#06B6D4"]

// ============ SAGE LOGO (Teal gradient) ============
function SageLogo({ size = 32, className = "" }: { size?: number, className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="sageGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#14B8A6" />
          <stop offset="50%" stopColor="#0D9488" />
          <stop offset="100%" stopColor="#0F766E" />
        </linearGradient>
        <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#14B8A6" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      <path d="M24 8C18 8 14 12 14 16C12 16 10 18 10 21C8 21 6 23 6 26C6 29 8 31 10 32C10 36 14 40 20 40C22 40 24 39 24 39" stroke="url(#sageGradient)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M24 8C30 8 34 12 34 16C36 16 38 18 38 21C40 21 42 23 42 26C42 29 40 31 38 32C38 36 34 40 28 40C26 40 24 39 24 39" stroke="url(#sageGradient)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M24 8V39" stroke="url(#sageGradient)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <path d="M14 20C16 20 18 22 18 24" stroke="url(#sageGradient)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M12 28C15 28 17 30 18 32" stroke="url(#sageGradient)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M34 20C32 20 30 22 30 24" stroke="url(#sageGradient)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M36 28C33 28 31 30 30 32" stroke="url(#sageGradient)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
      <rect x="17" y="28" width="3" height="6" rx="1" fill="url(#accentGradient)" opacity="0.9" />
      <rect x="22" y="24" width="3" height="10" rx="1" fill="url(#accentGradient)" opacity="0.9" />
      <rect x="27" y="20" width="3" height="14" rx="1" fill="url(#accentGradient)" opacity="0.9" />
      <path d="M16 32L21 28L26 24L32 18" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M30 16L32 18L30 20" stroke="#14B8A6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

// ============ TYPES ============
interface Message { id: string; role: "user" | "assistant"; content: string; timestamp: Date; attachments?: Attachment[]; chart?: ChartData }
interface Attachment { id: string; name: string; type: string; size: number; content?: string }
interface ChartData { type: "bar" | "line" | "pie" | "area" | "waterfall" | "stacked_bar" | "multi_line" | "composed"; title: string; data: any[]; keys?: string[]; colors?: string[] }
interface TableData { title: string; headers: string[]; rows: string[][] }
interface Conversation { id: string; title: string; messages: Message[]; created_at: string; updated_at: string }
interface CompanyData { transactions: any[]; invoices: any[]; projects: any[]; clients: any[]; teamMembers: any[]; timeEntries: any[]; projectAssignments: any[]; billRates: any[]; costOverrides: any[]; expenses: any[]; learnedPatterns: any[] }
interface KPISummary { totalRevenue: number; totalExpenses: number; netIncome: number; grossMargin: number; cashOnHand: number; arOutstanding: number; burnRate: number; runway: number; utilizationRate: number; dso: number; teamCost: number; teamRevenue: number; teamMarginPct: number }

// ============ QUICK ACTIONS ============
const QUICK_ACTIONS = [
  { label: "What should I be focused on this week?", icon: Target },
  { label: "Show me client profitability chart", icon: TrendingUp },
  { label: "Any cash flow risks I should know about?", icon: AlertTriangle },
  { label: "Show team utilization and margins", icon: BarChart3 },
  { label: "Categorize my recent bank transactions", icon: CreditCard },
  { label: "Revenue trend over last 6 months", icon: Activity },
]

// ============ UTILITIES ============
const formatCurrency = (v: number): string => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
const formatPercent = (v: number): string => v.toFixed(1) + "%"
const formatFileSize = (bytes: number): string => { if (bytes < 1024) return bytes + " B"; if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"; return (bytes / (1024 * 1024)).toFixed(1) + " MB" }
const getCurrentMonth = (): string => { const n = new Date(); return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") }

// ============ SYSTEM PROMPT ============
const SYSTEM_PROMPT = `You are Sage, the AI Agent for Vantage (CashFlow-Pro). You are a virtual CFO, FP&A analyst, and operations partner for Mano CG LLC, a project-based consulting business.

YOUR IDENTITY:
- Name: Sage
- Role: CFO-level financial advisor, operations agent, and strategic partner
- Personality: Direct, insightful, proactive. You tell it like it is with specific numbers.
- Style: Lead with the answer, then explain. Be concise. Always suggest a next action.

YOUR AGENT CAPABILITIES:
1. ANALYZE - Deep dive into KPIs, trends, variances, profitability by client/project/team member. Cross-reference time entries with rate cards, invoices with bank deposits, expenses with budgets.
2. ADVISE - Strategic recommendations based on data. Challenge assumptions constructively. Identify opportunities.
3. ALERT - Proactively flag risks: cash flow gaps, overdue AR, utilization drops, margin compression, cost overruns, uncategorized transactions.
4. FORECAST - Projections, scenario planning, what-if analysis. "If Client X churns, what happens to margin?"
5. CATEGORIZE - Analyze bank transactions and suggest categories based on vendor patterns, amounts, and historical data. Learn from user corrections.
6. VISUALIZE - Create charts, tables, and data views. You have access to multiple chart types.
7. NAVIGATE - Direct users to relevant Vantage pages with [View in Reports ->] style links.
8. LEARN - Remember patterns from this conversation. If a user corrects a categorization or shares context, incorporate it.

KNOWN ALIASES:
- "CADC" or "Clean Arc" = Clean Arc Data Center
- "P1" or "Point One" = Point One, LLC
- Automatically detect abbreviations from client/project names

RATE CARD MODEL (IMPORTANT - this is how cost works):
Vantage uses a TWO-TIER cost model:
- TIER 1 (Custom): Rate card has cost_amount > 0 for a specific member+client = use that exact cost
  - cost_type "hourly": cost = hours x cost_amount
  - cost_type "lump_sum": cost = cost_amount/month (distributed across months)
- TIER 2 (Distributed): Rate card has cost_amount = 0 = fall back to team member's total cost
  - Member's total cost (from team_members table) is distributed across all their clients by % of hours worked
  - Example: Emily costs $35k/mo total, works 40% on Client A, 35% on Client B, 25% on Client C
  - Client A gets $14k cost, Client B gets $12.25k, Client C gets $8.75k
- cost_overrides table = monthly exceptions to override automatic distribution

TIME TRACKING MODEL (IMPORTANT - logged vs billable):
Each time entry has TWO hour fields:
- "hours" = ACTUAL time logged by the contractor (what they worked)
- "billable_hours" = ADJUSTED hours approved for billing (may be LESS than logged)
When leadership reduces billable_hours below logged hours, that delta is "written down" or "non-billable" time.
- Written-down hours = hours - billable_hours (when billable_hours < hours)
- This represents revenue LOSS: the work was done but will not be billed to the client
- When asked about "logged vs billed" or "lost hours", ALWAYS show both columns and the delta
- Calculate potential lost revenue as: (hours - billable_hours) x bill_rate for that member+client
- If billable_hours is null or not set, assume billable_hours = hours (no write-down)
Example: Brian logs 40 hours, leadership sets billable_hours to 32. Delta = 8 hours written down. At $190/hr = $1,520 in lost revenue.

BANK TRANSACTION CATEGORIZATION:
When asked to categorize transactions, analyze:
- FIRST check the SAGE LEARNED PATTERNS section in your data context. If a vendor matches an approved pattern, use that category with high confidence.
- Vendor name patterns (e.g., "GUSTO" = payroll, "AWS" = software, "AMEX" = credit card payment)
- Amount patterns (recurring amounts = subscriptions, large one-time = equipment/deposits)
- Historical categorizations for the same vendor
- Suggest categories from: Direct Costs, Overhead, Other Business, Personal
- Be specific with sub-categories: Payroll, Software & Tools, Insurance, Rent, Travel, Meals, Equipment, Subcontractors, Professional Services, Marketing, Utilities, Vehicle, Office Supplies
- When uncertain, present your best guess with confidence level
- For learned/approved patterns, show them as "Known" rather than "Suggested"

LEARNING FLOW:
When you categorize transactions and the user confirms or approves:
1. Emit a PATTERN_LEARNED line for EACH confirmed vendor-category pair
2. Format: PATTERN_LEARNED: vendor="EXACT_VENDOR_NAME" category="Category" sub_category="SubCategory"
3. Put these AFTER your main response text (they will be auto-stripped from display)
4. Only emit when the user explicitly confirms (says "yes", "approved", "correct", "save that", etc.)
5. Do NOT emit patterns on your initial suggestion — wait for confirmation
Example flow:
- User: "Categorize my recent transactions"
- Sage: [shows table with suggestions and confidence levels] "Want me to save these categorizations?"
- User: "Yes, save them" or "Approve all" or "Looks good"
- Sage: "Saved. I will remember these for next time."
  PATTERN_LEARNED: vendor="GUSTO" category="Direct Costs" sub_category="Payroll"
  PATTERN_LEARNED: vendor="AWS" category="Overhead" sub_category="Software & Tools"

EXPENSE CATEGORIES:
- Direct Costs: Payroll, Subcontractors, Project Materials, Equipment Rental
- Overhead: Rent, Insurance, Software & Tools, Accounting, Legal, Utilities
- Other Business: Travel, Meals, Marketing, Professional Development, Vehicle
- Personal: Owner Draws, Personal Expenses

TABLE FORMAT:
\`\`\`sage-table
{
  "title": "Table Title",
  "headers": ["Col1", "Col2"],
  "rows": [["val1", "val2"]]
}
\`\`\`

CHART FORMAT:
\`\`\`sage-chart
{
  "type": "bar|line|pie|area|waterfall|stacked_bar|multi_line|composed",
  "title": "Chart Title",
  "data": [{"name": "Label", "value": 1000}],
  "keys": ["revenue", "cost"],
  "colors": ["#10b981", "#ef4444"]
}
\`\`\`

Chart types:
- "bar" - single metric comparisons (revenue by client)
- "stacked_bar" - multiple metrics stacked (revenue vs cost by client). Requires "keys" array.
- "line" - single trend over time
- "multi_line" - multiple trends overlaid. Requires "keys" array.
- "area" - trend with filled area (cash flow over time)
- "pie" - proportions (expense breakdown)
- "waterfall" - sequential additions/subtractions (revenue -> costs -> margin bridge)
- "composed" - mixed bar+line (revenue bars with margin % line). Requires "keys" array.

For stacked_bar, multi_line, and composed: data items should have properties matching the "keys" array.
Example stacked_bar: { "type": "stacked_bar", "keys": ["cost", "revenue"], "data": [{"name": "Jan", "cost": 5000, "revenue": 8000}] }
Example waterfall: data items need "value" (positive=green, negative=red) and optionally "isTotal": true for summary bars.

RESPONSE RULES:
1. Use SPECIFIC NUMBERS from the data - never guess or use placeholders
2. If data is missing, say so clearly and suggest what to add
3. Be concise - lead with insights, not summaries
4. Always suggest a follow-up action or question
5. Do NOT use markdown bold (**text**) - the interface does not render it
6. Use bullet points (bullet) for lists, ALL CAPS sparingly for emphasis
7. When showing profitability, always reference the rate card model (custom vs distributed cost)
8. For bank categorization, show confidence level and learn from corrections
9. Cross-reference data across modules - e.g., "Invoice #102 was paid but I don't see a matching bank deposit"

PROACTIVE INSIGHTS:
When asked general questions like "what should I focus on" or "any issues?", scan ALL data for:
- Overdue invoices and aging AR
- Team members with no time entries this week
- Projects with budget overruns
- Uncategorized bank transactions
- Margin compression trends
- Cash runway warnings
- Upcoming invoice milestones
- Rate card gaps (members working on clients without rate cards)
- Hours written down (logged > billable) and the revenue impact of those reductions

Remember: You are not just answering questions. You are an agent running alongside the business, spotting patterns humans miss.

IMPORTANT DISAMBIGUATION:
When a user asks about "logged vs billed hours" or "lost hours" or "hours reduction":
- This means comparing the "hours" field (what was worked) vs "billable_hours" field (what was approved for billing)
- The WRITE-DOWN data section has this computed per member per month
- Do NOT confuse this with "hours logged but no invoices generated" - that is a separate billing/rate card issue
- Show a table with columns: Team Member, Logged Hours, Billable Hours, Written Down, Lost Revenue`

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

  // Team profitability from rate cards
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

  // Also track billable hours for revenue
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
      // Revenue from rate card — use BILLABLE hours
      const rc = data.billRates?.find(r => r.team_member_id === memberId && r.client_id === clientId && r.is_active)
      const billableHrs = memberBillableHours[memberId]?.[clientId] || hours
      teamRevenue += billableHrs * (rc?.rate || 0)

      // Cost: custom or distributed
      if (rc && rc.cost_amount > 0) {
        if (rc.cost_type === "hourly") teamCost += hours * rc.cost_amount
        else teamCost += rc.cost_amount // lump sum for this client
      } else if (member) {
        // Distribute member cost
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

  // Group by vendor/description for pattern recognition
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

  // Sort by frequency
  const sorted = Object.entries(vendorPatterns).sort((a, b) => b[1].count - a[1].count)

  // Uncategorized
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

RECENT UNCATEGORIZED (needs attention):
${recentUncategorized || "  None - all categorized!"}

CATEGORIZATION RULES LEARNED:
${sorted.filter(([_, p]) => Object.keys(p.categories).length > 0 && p.count >= 2).slice(0, 10).map(([vendor, p]) => {
    const topCat = Object.entries(p.categories).sort((a, b) => b[1] - a[1])[0]
    return `  "${vendor}" -> ${topCat[0]} (${topCat[1]}/${p.count} times, ${((topCat[1]/p.count)*100).toFixed(0)}% confidence)`
  }).join("\n") || "  No patterns established yet"}`
}

function buildDataContext(data: CompanyData, kpis: KPISummary): string {
  const aging = getARAgingSummary(data.invoices)
  const overdueInv = getOverdueInvoices(data)

  // Time by member this month
  const curMonth = getCurrentMonth()
  const monthEntries = data.timeEntries?.filter(t => t.date?.substring(0, 7) === curMonth) || []
  const projectClientMap = new Map(data.projects?.map(p => [p.id, p.client_id]) || [])
  const clientNameMap = new Map(data.clients?.map(c => [c.id, c.name]) || [])
  const memberNameMap = new Map(data.teamMembers?.map(m => [m.id, m.name]) || [])

  // This week time
  const oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  const thisWeekByMember: Record<string, number> = {}
  data.timeEntries?.filter(t => new Date(t.date) >= oneWeekAgo).forEach(entry => {
    const name = memberNameMap.get(entry.contractor_id) || "Unknown"
    thisWeekByMember[name] = (thisWeekByMember[name] || 0) + (entry.hours || 0)
  })

  // All-time by member
  const allTimeByMember: Record<string, { hours: number, billable: number }> = {}
  data.timeEntries?.forEach(entry => {
    const name = memberNameMap.get(entry.contractor_id) || "Unknown"
    if (!allTimeByMember[name]) allTimeByMember[name] = { hours: 0, billable: 0 }
    allTimeByMember[name].hours += entry.hours || 0
    allTimeByMember[name].billable += entry.billable_hours != null ? entry.billable_hours : (entry.hours || 0)
  })

  // Monthly time breakdown
  const timeByMonth: Record<string, Record<string, number>> = {}
  data.timeEntries?.forEach(entry => {
    const mo = entry.date?.substring(0, 7) || "?"
    const name = memberNameMap.get(entry.contractor_id) || "Unknown"
    if (!timeByMonth[mo]) timeByMonth[mo] = {}
    timeByMonth[mo][name] = (timeByMonth[mo][name] || 0) + (entry.hours || 0)
  })

  // Client profitability from rate card model
  const clientProfit: Record<string, { name: string, revenue: number, cost: number, hours: number }> = {}
  const memberProfit: Record<string, { name: string, revenue: number, cost: number, hours: number, clients: Record<string, { hours: number, revenue: number, cost: number }> }> = {}

  // Build profitability per member per client for current month
  monthEntries.forEach(t => {
    const memberId = t.contractor_id
    const clientId = projectClientMap.get(t.project_id) || "unknown"
    const clientName = clientNameMap.get(clientId) || "Unknown"
    const memberName = memberNameMap.get(memberId) || "Unknown"
    const hours = t.hours || 0
    // Use billable_hours for revenue; fall back to actual hours
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

  // Calculate costs (two-tier)
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

  // Rate card summary
  const rateCardSummary = data.billRates?.filter(r => r.is_active).map(r => {
    const member = data.teamMembers?.find(m => m.id === r.team_member_id)
    const client = data.clients?.find(c => c.id === r.client_id)
    const hasCustomCost = r.cost_amount > 0
    const costDesc = hasCustomCost
      ? (r.cost_type === "hourly" ? `$${r.cost_amount}/hr (custom)` : `$${r.cost_amount}/mo lump sum (${r.baseline_hours || 172}h baseline)`)
      : `Distributed from ${member?.cost_type === "lump_sum" ? "$" + (member?.cost_amount || 0) + "/mo" : "$" + (member?.cost_amount || 0) + "/hr"} total`
    return `  ${member?.name || "?"} -> ${client?.name || "?"}: Bill $${r.rate}/hr | Cost: ${costDesc}`
  }).join("\n") || "No rate cards configured"

  // Expense summary
  const expenseByCategory: Record<string, number> = {}
  data.expenses?.forEach(e => {
    const cat = e.category || e.expense_category || "Uncategorized"
    expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Math.abs(e.amount || 0)
  })

  // Logged vs Billable hours analysis (write-downs)
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

  // Bank transaction patterns
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

=== RATE CARDS (Cost + Revenue per member per client) ===
${rateCardSummary}

=== COST OVERRIDES (Monthly Exceptions) ===
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

=== LOGGED VS BILLABLE HOURS (Write-Downs) ===
${Object.entries(writeDownsByMember).map(([id, wd]) => {
    const recentMonths = Object.entries(wd.months).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 3)
    return recentMonths.map(([mo, d]) => 
      `  ${wd.name} (${mo}): Logged ${d.logged.toFixed(1)}h, Billable ${d.billable.toFixed(1)}h, Written-Down ${d.delta.toFixed(1)}h${d.lostRevenue > 0 ? `, Lost Revenue ${formatCurrency(d.lostRevenue)}` : ""}`
    ).join("\n")
  }).join("\n") || "No write-downs detected"}
Note: "Written-Down" = hours logged but reduced by leadership before billing. Delta = logged - billable. Lost Revenue = delta x bill rate.

=== INVOICES ===
  Paid: ${data.invoices?.filter(i => i.status === "paid").length || 0} (${formatCurrency(data.invoices?.filter(i => i.status === "paid").reduce((s, i) => s + (i.amount || 0), 0) || 0)})
  Pending: ${data.invoices?.filter(i => i.status === "pending").length || 0} (${formatCurrency(data.invoices?.filter(i => i.status === "pending").reduce((s, i) => s + (i.amount || 0), 0) || 0)})
  Overdue: ${overdueInv.length} (${formatCurrency(overdueInv.reduce((s, i) => s + i.amount, 0))})

=== EXPENSES BY CATEGORY ===
${Object.entries(expenseByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => `  ${cat}: ${formatCurrency(amt)}`).join("\n") || "No expense data"}

=== PROJECT BILLING RATES ===
${data.projectAssignments?.map(a => {
    const member = data.teamMembers?.find(m => m.id === a.team_member_id)
    const project = data.projects?.find(p => p.id === a.project_id)
    const client = data.clients?.find(c => c.id === project?.client_id)
    return `  ${member?.name || "?"} -> ${project?.name || "?"} (${client?.name || "?"}): $${a.rate || 0}/hr | ${a.service || "General"}`
  }).join("\n") || "No project assignments"}

${bankPatterns}

=== SAGE LEARNED PATTERNS (${data.learnedPatterns?.length || 0} total) ===
${data.learnedPatterns?.length > 0 ? 
  `Approved (use with high confidence):
${data.learnedPatterns.filter(p => p.status === "approved").map(p => 
    `  "${p.vendor_normalized || p.vendor_name}" -> ${p.category}${p.sub_category ? "/" + p.sub_category : ""} (confirmed ${p.times_confirmed}x)`
  ).join("\n") || "  None yet"}
Suggested (use but flag as suggestion):
${data.learnedPatterns.filter(p => p.status === "suggested").map(p => 
    `  "${p.vendor_normalized || p.vendor_name}" -> ${p.category}${p.sub_category ? "/" + p.sub_category : ""} (seen ${p.times_seen}x, confidence ${(p.confidence * 100).toFixed(0)}%)`
  ).join("\n") || "  None yet"}`
  : "No learned patterns yet. When categorizing transactions, suggest patterns and ask user to confirm. Use SAVE_PATTERN action to persist."}
Note: When the user approves a categorization, respond with a line like:
PATTERN_LEARNED: vendor="VENDOR_NAME" category="CATEGORY" sub_category="SUB_CATEGORY"
The frontend will detect this and save the pattern to the database.
`
}


// ============ TABLE RENDERER (Institutional) ============
function TableRenderer({ table }: { table: TableData }) {
  if (!table || !table.headers || !table.rows) return null
  return (
    <div className="my-4 rounded-xl border border-white/[0.06] overflow-hidden">
      <div className="bg-[#0D1520] px-4 py-3 border-b border-white/[0.06]">
        <h4 className="text-sm font-medium text-slate-200">{table.title}</h4>
      </div>
      <div className="bg-[#111827] overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/[0.06]">
            {table.headers.map((h, i) => <th key={i} className="text-left py-3 px-4 text-slate-400 font-medium text-xs uppercase tracking-wider">{h}</th>)}
          </tr></thead>
          <tbody>{table.rows.map((row, ri) => (
            <tr key={ri} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
              {row.map((cell, ci) => <td key={ci} className="py-2.5 px-4 text-slate-200">{cell}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  )
}

// ============ CHART RENDERER (Institutional) ============
function ChartRenderer({ chart }: { chart: ChartData }) {
  if (!chart || !chart.data || chart.data.length === 0) return null
  const colors = chart.colors || CHART_COLORS
  const keys = chart.keys || ["value"]
  const tooltipStyle = { backgroundColor: "#0D1520", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }
  const axisProps = { tick: { fill: "#64748b", fontSize: 11 }, axisLine: { stroke: "rgba(255,255,255,0.06)" } }
  const gridStroke = "rgba(255,255,255,0.04)"

  const renderChart = () => {
    switch (chart.type) {
      case "bar":
        return (<BarChart data={chart.data}><CartesianGrid strokeDasharray="3 3" stroke={gridStroke} /><XAxis dataKey="name" {...axisProps} /><YAxis {...axisProps} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="value" fill="#14B8A6" radius={[4, 4, 0, 0]} /></BarChart>)
      case "stacked_bar":
        return (<BarChart data={chart.data}><CartesianGrid strokeDasharray="3 3" stroke={gridStroke} /><XAxis dataKey="name" {...axisProps} /><YAxis {...axisProps} /><Tooltip contentStyle={tooltipStyle} /><Legend />{keys.map((key, i) => <Bar key={key} dataKey={key} stackId="a" fill={colors[i % colors.length]} radius={i === keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />)}</BarChart>)
      case "line":
        return (<LineChart data={chart.data}><CartesianGrid strokeDasharray="3 3" stroke={gridStroke} /><XAxis dataKey="name" {...axisProps} /><YAxis {...axisProps} /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="value" stroke="#14B8A6" strokeWidth={2} dot={{ fill: "#14B8A6", strokeWidth: 0 }} activeDot={{ r: 6, fill: "#14B8A6" }} /></LineChart>)
      case "multi_line":
        return (<LineChart data={chart.data}><CartesianGrid strokeDasharray="3 3" stroke={gridStroke} /><XAxis dataKey="name" {...axisProps} /><YAxis {...axisProps} /><Tooltip contentStyle={tooltipStyle} /><Legend />{keys.map((key, i) => <Line key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ fill: colors[i % colors.length], strokeWidth: 0 }} />)}</LineChart>)
      case "area":
        return (<AreaChart data={chart.data}><CartesianGrid strokeDasharray="3 3" stroke={gridStroke} /><XAxis dataKey="name" {...axisProps} /><YAxis {...axisProps} /><Tooltip contentStyle={tooltipStyle} /><defs><linearGradient id="areaGradTeal" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#14B8A6" stopOpacity={0.25} /><stop offset="95%" stopColor="#14B8A6" stopOpacity={0} /></linearGradient></defs><Area type="monotone" dataKey="value" stroke="#14B8A6" fill="url(#areaGradTeal)" strokeWidth={2} /></AreaChart>)
      case "waterfall": {
        let running = 0
        const wd = chart.data.map(d => {
          if (d.isTotal) { const h = running; return { ...d, base: 0, bar: h, fill: h >= 0 ? "#3b82f6" : "#ef4444" } }
          const base = d.value >= 0 ? running : running + d.value; running += d.value
          return { ...d, base: Math.max(base, 0), bar: Math.abs(d.value), fill: d.value >= 0 ? "#14B8A6" : "#ef4444" }
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
    <div className="my-4 rounded-xl border border-white/[0.06] overflow-hidden">
      <div className="bg-[#0D1520] px-4 py-3 border-b border-white/[0.06]">
        <h4 className="text-sm font-medium text-slate-200">{chart.title}</h4>
      </div>
      <div className="bg-[#111827] p-4 h-72">
        <ResponsiveContainer width="100%" height="100%">{renderChart()}</ResponsiveContainer>
      </div>
    </div>
  )
}

// ============ MESSAGE COMPONENT (Institutional) ============
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
          return <p key={i} className="my-1"><Link href={href} className="text-teal-400 hover:text-teal-300 inline-flex items-center gap-1 transition-colors">{linkMatch[1]} <ChevronRight size={12} /></Link></p>
        }
      }
      if (line.trim().startsWith("- ") || line.trim().startsWith("\u2022 ")) {
        return <p key={i} className="my-0.5 pl-3 text-slate-300">{"\u2022"} {line.replace(/^[-\u2022]\s*/, "").replace(/\*\*/g, "")}</p>
      }
      if (/^\d+\.\s/.test(line.trim())) return <p key={i} className="my-0.5 pl-3 text-slate-300">{line.replace(/\*\*/g, "")}</p>
      if (line.trim().endsWith(":") && line.trim().length < 60 && !line.includes("$")) return <p key={i} className="my-2.5 text-slate-200 font-medium text-[13px] uppercase tracking-wide">{line.replace(/\*\*/g, "")}</p>
      return <p key={i} className="my-1 text-slate-300">{line.replace(/\*\*/g, "")}</p>
    })
  }
  
  return (
    <div className={`flex gap-3.5 ${isUser ? "flex-row-reverse" : ""} max-w-4xl mx-auto`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${isUser ? "bg-blue-500/20 ring-1 ring-blue-500/30" : "bg-teal-500/15 ring-1 ring-teal-500/25"}`}>
        {isUser ? <User size={16} className="text-blue-400" /> : <SageLogo size={22} />}
      </div>
      <div className={`flex-1 min-w-0 ${isUser ? "text-right" : ""}`}>
        <p className={`text-[11px] font-medium mb-1 px-1 ${isUser ? "text-blue-400/70" : "text-teal-400/70"}`}>{isUser ? "You" : "Sage"}</p>
        <div className={`inline-block rounded-xl px-4 py-3 max-w-[90%] text-left ${isUser ? "bg-blue-500/10 border border-blue-500/20 text-slate-100" : "bg-[#111827] border border-white/[0.06] text-slate-200"}`}>
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-white/[0.06]">
              {message.attachments.map(att => (
                <div key={att.id} className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] rounded-lg text-xs border border-white/[0.06]">
                  {att.type.startsWith("image/") ? <ImageIcon size={14} className="text-teal-400" /> : <FileText size={14} className="text-teal-400" />}
                  <span className="truncate max-w-[150px] text-slate-300">{att.name}</span>
                  <span className="text-slate-500">{formatFileSize(att.size)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{formatContent(text)}</div>
          {tables.map((t, i) => <TableRenderer key={`t-${i}`} table={t} />)}
          {charts.map((c, i) => <ChartRenderer key={`c-${i}`} chart={c} />)}
        </div>
        <p className="text-[10px] text-slate-600 mt-1 px-1">{new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
      </div>
    </div>
  )
}

// ============ CONVERSATION ITEM (Institutional sidebar) ============
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
    <div className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${isActive ? "bg-teal-500/10 border-l-2 border-teal-400" : "hover:bg-white/[0.03] border-l-2 border-transparent"}`} onClick={() => !isEditing && onClick()}>
      <MessageSquare size={14} className={isActive ? "text-teal-400 flex-shrink-0" : "text-slate-500 flex-shrink-0"} />
      {isEditing ? (
        <div className="flex-1 flex items-center gap-1">
          <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="flex-1 bg-[#0D1520] text-sm text-slate-100 px-2 py-1 rounded border border-white/[0.08] focus:outline-none focus:border-teal-500" autoFocus onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === "Enter") { onRename(editTitle); setIsEditing(false) } if (e.key === "Escape") setIsEditing(false) }} />
          <button onClick={e => { e.stopPropagation(); onRename(editTitle); setIsEditing(false) }} className="p-1 text-teal-400"><Check size={14} /></button>
          <button onClick={e => { e.stopPropagation(); setIsEditing(false) }} className="p-1 text-slate-500"><X size={14} /></button>
        </div>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <span className={`text-sm truncate block ${isActive ? "text-slate-100" : "text-slate-300"}`}>{conversation.title}</span>
            <span className="text-[10px] text-slate-600">{timeAgo} ago</span>
          </div>
          <div className={`flex items-center gap-0.5 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"} transition-opacity`}>
            <button onClick={e => { e.stopPropagation(); setIsEditing(true); setEditTitle(conversation.title) }} className="p-1 text-slate-500 hover:text-slate-300"><Pencil size={12} /></button>
            <button onClick={e => { e.stopPropagation(); onDelete() }} className="p-1 text-slate-500 hover:text-red-400"><Trash2 size={12} /></button>
          </div>
        </>
      )}
    </div>
  )
}

// ============ KPI CARD (Left accent bar — institutional) ============
function KPICard({ label, value, sublabel, accentColor = "teal", icon: Icon, trend }: { label: string, value: string, sublabel?: string, accentColor?: string, icon: any, trend?: "up" | "down" | "neutral" }) {
  const cm: Record<string, { accent: string, iconBg: string, iconText: string }> = {
    teal:    { accent: "border-l-teal-400",    iconBg: "bg-teal-500/10",    iconText: "text-teal-400" },
    blue:    { accent: "border-l-blue-400",    iconBg: "bg-blue-500/10",    iconText: "text-blue-400" },
    amber:   { accent: "border-l-amber-400",   iconBg: "bg-amber-500/10",   iconText: "text-amber-400" },
    rose:    { accent: "border-l-rose-400",    iconBg: "bg-rose-500/10",    iconText: "text-rose-400" },
    purple:  { accent: "border-l-purple-400",  iconBg: "bg-purple-500/10",  iconText: "text-purple-400" },
    emerald: { accent: "border-l-emerald-400", iconBg: "bg-emerald-500/10", iconText: "text-emerald-400" },
  }
  const c = cm[accentColor] || cm.teal
  return (
    <div className={`bg-[#111827] rounded-lg border border-white/[0.06] border-l-[3px] ${c.accent} p-3.5 flex items-start gap-3`}>
      <div className={`w-9 h-9 rounded-lg ${c.iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={18} className={c.iconText} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500 uppercase tracking-wider font-medium">{label}</p>
        <p className="text-lg font-semibold text-slate-100 mt-0.5 leading-tight">{value}</p>
        {sublabel && <p className={`text-[11px] mt-0.5 ${trend === "up" ? "text-emerald-400" : trend === "down" ? "text-rose-400" : "text-slate-500"}`}>{trend === "up" && "\u2191 "}{trend === "down" && "\u2193 "}{sublabel}</p>}
      </div>
    </div>
  )
}

// ============ ALERT BADGE ============
function AlertCard({ icon: Icon, label, count, color, onClick }: { icon: any, label: string, count: number, color: string, onClick: () => void }) {
  const cm: Record<string, string> = {
    amber: "bg-amber-500/[0.08] border-amber-500/20 text-amber-400 hover:bg-amber-500/15",
    rose:  "bg-rose-500/[0.08] border-rose-500/20 text-rose-400 hover:bg-rose-500/15",
    orange:"bg-orange-500/[0.08] border-orange-500/20 text-orange-400 hover:bg-orange-500/15",
  }
  return (
    <button onClick={onClick} className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg border text-xs font-medium transition-all ${cm[color] || cm.amber}`}>
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

  // ---- DATA LOADING (unchanged) ----
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
          // Load learned patterns separately
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

  // ---- CONVERSATION MANAGEMENT (unchanged) ----
  const saveConversation = async (msgs: Message[], conversationId: string | null, title?: string) => {
    if (!userId || !companyId) return null
    const messagesForStorage = msgs.map(m => ({ ...m, timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp }))
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

  // ---- FILE HANDLING (unchanged) ----
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

  // ---- SEND MESSAGE (unchanged) ----
  const sendMessage = async (content: string) => {
    if ((!content.trim() && attachments.length === 0) || loading) return
    const userMessage: Message = { id: `user_${Date.now()}`, role: "user", content: content.trim(), timestamp: new Date(), attachments: attachments.length > 0 ? [...attachments] : undefined }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages); setInput(""); setAttachments([]); setLoading(true)
    try {
      let dataContext = companyData && kpis ? buildDataContext(companyData, kpis) : "No company data available yet."
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
      
      // Detect and save learned patterns
      const patternRegex = /PATTERN_LEARNED:\s*vendor="([^"]+)"\s*category="([^"]+)"(?:\s*sub_category="([^"]*)")?/g
      let patternMatch
      let patternsFound = false
      while ((patternMatch = patternRegex.exec(assistantContent)) !== null) {
        patternsFound = true
        const [, vendor, category, subCategory] = patternMatch
        const normalized = vendor.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim()
        try {
          await supabase.from("sage_learned_patterns").upsert({
            company_id: companyId,
            pattern_type: "vendor_category",
            vendor_name: vendor,
            vendor_normalized: normalized,
            category: category,
            sub_category: subCategory || null,
            match_field: "vendor",
            match_value: normalized,
            confidence: 1.00,
            times_confirmed: 1,
            status: "approved",
            approved_by: userId,
            approved_at: new Date().toISOString(),
            source: "sage_ai",
          }, { onConflict: "company_id,vendor_normalized", ignoreDuplicates: false })
          console.log(`Pattern saved: ${vendor} -> ${category}/${subCategory || ""}`)
        } catch (e) { console.error("Failed to save pattern:", e) }
      }
      // Refresh learned patterns in local state if any were saved
      if (patternsFound && companyId) {
        const { data: refreshedPatterns } = await supabase.from("sage_learned_patterns").select("*").eq("company_id", companyId).neq("status", "rejected")
        if (refreshedPatterns && companyData) setCompanyData(prev => prev ? { ...prev, learnedPatterns: refreshedPatterns } : prev)
      }
      // Strip PATTERN_LEARNED lines from display
      assistantContent = assistantContent.replace(/PATTERN_LEARNED:.*$/gm, "").replace(/\n{3,}/g, "\n\n").trim()
      
      const assistantMessage: Message = { id: `assistant_${Date.now()}`, role: "assistant", content: assistantContent, timestamp: new Date() }
      const finalMessages = [...newMessages, assistantMessage]
      setMessages(finalMessages)
      const title = messages.length === 0 ? generateTitle(content) : undefined
      const savedId = await saveConversation(finalMessages, currentConversationId, title)
      if (savedId && !currentConversationId) setCurrentConversationId(savedId)
      if (currentConversationId) setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: finalMessages, updated_at: new Date().toISOString() } : c))
    } catch (error) {
      console.error("Error:", error)
      setMessages(prev => [...prev, { id: `error_${Date.now()}`, role: "assistant", content: "I encountered an error connecting to the AI service. Please check your API configuration and try again.", timestamp: new Date() }])
    } finally { setLoading(false) }
  }

  const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => sendMessage(action.label)
  const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }
  const startNewConversation = () => { setCurrentConversationId(null); setMessages([]) }
  const loadConversation = (conversation: Conversation) => { setCurrentConversationId(conversation.id); setMessages(conversation.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))) }
  const deleteConversation = async (id: string) => { await supabase.from("sage_conversations").delete().eq("id", id); setConversations(prev => prev.filter(c => c.id !== id)); if (currentConversationId === id) startNewConversation() }
  const renameConversation = async (id: string, title: string) => { await supabase.from("sage_conversations").update({ title }).eq("id", id); setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c)) }

  const hasMessages = messages.length > 0
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations
    return conversations.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [conversations, searchQuery])

  const dataStats = useMemo(() => {
    if (!companyData) return null
    const uncatTxns = companyData.transactions?.filter(t => !t.category || t.category === "uncategorized" || t.category === "").length || 0
    const overdueInvs = companyData.invoices?.filter(i => i.status !== "paid" && new Date(i.due_date || i.created_at) < new Date()).length || 0
    const activeRates = companyData.billRates?.filter(r => r.is_active).length || 0
    const totalDataPoints = (companyData.transactions?.length || 0) + (companyData.invoices?.length || 0) + (companyData.timeEntries?.length || 0)
    const learnedCount = companyData.learnedPatterns?.filter(p => p.status === "approved").length || 0
    return { uncatTxns, overdueInvs, activeRates, totalTxns: companyData.transactions?.length || 0, totalDataPoints, learnedCount }
  }, [companyData])

  // ---- LOADING STATE (Branded) ----
  if (dataLoading) return (
    <div className="flex items-center justify-center h-[calc(100vh-80px)] bg-[#0B0F1A]">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto mb-4">
          <SageLogo size={36} className="animate-pulse" />
        </div>
        <p className="text-sm text-slate-400">Loading financial data...</p>
      </div>
    </div>
  )

  return (
    <div className="flex h-[calc(100vh-80px)] bg-[#0B0F1A]">
      {/* ========== SIDEBAR ========== */}
      <div className={`${sidebarOpen ? "w-72" : "w-0"} border-r border-white/[0.06] bg-[#0D1117] flex flex-col transition-all duration-300 overflow-hidden flex-shrink-0`}>
        <div className="p-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <button onClick={startNewConversation} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-teal-500/15 border border-teal-500/25 hover:bg-teal-500/25 text-teal-400 text-sm font-medium transition-all">
              <Plus size={16} /> New Chat
            </button>
            <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-colors" title="Collapse">
              <PanelLeftClose size={16} />
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search conversations..." className="w-full bg-[#111827] border border-white/[0.06] rounded-lg pl-8 pr-3 py-2 text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-teal-500/40" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {filteredConversations.map(c => <ConversationItem key={c.id} conversation={c} isActive={c.id === currentConversationId} onClick={() => loadConversation(c)} onDelete={() => deleteConversation(c.id)} onRename={title => renameConversation(c.id, title)} />)}
          {filteredConversations.length === 0 && <p className="text-xs text-slate-600 text-center py-8">{searchQuery ? "No matches found" : "No conversations yet"}</p>}
        </div>
        {dataStats && (
          <div className="p-3 border-t border-white/[0.06] bg-[#0B0F1A]">
            <p className="text-[10px] font-medium text-slate-600 uppercase tracking-widest mb-2">Data Connected</p>
            <div className="space-y-1.5">
              {dataStats.uncatTxns > 0 && <div className="flex items-center gap-2 text-amber-400/80 text-[11px]"><CreditCard size={11} /><span>{dataStats.uncatTxns} uncategorized</span></div>}
              {dataStats.overdueInvs > 0 && <div className="flex items-center gap-2 text-rose-400/80 text-[11px]"><AlertTriangle size={11} /><span>{dataStats.overdueInvs} overdue</span></div>}
              <div className="flex items-center gap-2 text-slate-500 text-[11px]"><Activity size={11} /><span>{dataStats.totalDataPoints.toLocaleString()} data points</span></div>
              {dataStats.learnedCount > 0 && <div className="flex items-center gap-2 text-teal-400/70 text-[11px]"><Brain size={11} /><span>{dataStats.learnedCount} learned patterns</span></div>}
            </div>
          </div>
        )}
      </div>

      {/* ========== MAIN AREA ========== */}
      <div className="flex-1 flex flex-col relative min-w-0" onDragOver={e => { e.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-[#0D1117]">
          <div className="flex items-center gap-3">
            {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-colors mr-1" title="Open sidebar"><PanelLeft size={16} /></button>}
            <div className="w-9 h-9 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center"><SageLogo size={24} /></div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-slate-100">Sage</h1>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-teal-500/15 text-teal-400 border border-teal-500/20 uppercase tracking-wider">Agent</span>
              </div>
              <p className="text-[11px] text-slate-500">Financial Intelligence & Operations</p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            {kpis && (
              <div className="hidden lg:flex items-center gap-5 text-xs">
                <div className="flex items-center gap-1.5"><span className="text-slate-500">GM%</span><span className={`font-semibold tabular-nums ${kpis.teamMarginPct >= 20 ? "text-teal-400" : kpis.teamMarginPct >= 10 ? "text-amber-400" : "text-rose-400"}`}>{kpis.teamMarginPct.toFixed(1)}%</span></div>
                <div className="w-px h-4 bg-white/[0.06]" />
                <div className="flex items-center gap-1.5"><span className="text-slate-500">Runway</span><span className={`font-semibold tabular-nums ${kpis.runway >= 6 ? "text-teal-400" : kpis.runway >= 3 ? "text-amber-400" : "text-rose-400"}`}>{kpis.runway.toFixed(1)}mo</span></div>
                <div className="w-px h-4 bg-white/[0.06]" />
                <div className="flex items-center gap-1.5"><span className="text-slate-500">AR</span><span className="text-blue-400 font-semibold tabular-nums">{formatCurrency(kpis.arOutstanding)}</span></div>
                <div className="w-px h-4 bg-white/[0.06]" />
                <div className="flex items-center gap-1.5"><span className="text-slate-500">Util</span><span className="text-purple-400 font-semibold tabular-nums">{kpis.utilizationRate.toFixed(0)}%</span></div>
              </div>
            )}
            <button onClick={startNewConversation} className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/[0.04] transition-colors" title="New conversation"><Plus size={16} /></button>
          </div>
        </div>

        {/* Drop Zone */}
        {isDragging && (
          <div className="absolute inset-0 bg-[#0B0F1A]/95 z-50 flex items-center justify-center border-2 border-dashed border-teal-500/40 m-4 rounded-xl">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto mb-4"><Paperclip size={28} className="text-teal-400" /></div>
              <p className="text-lg text-slate-200 font-medium">Drop files here</p>
              <p className="text-sm text-slate-500 mt-1">Images, CSV, Excel, PDF, Text</p>
            </div>
          </div>
        )}

        {/* ========== CONTENT ========== */}
        <div className="flex-1 overflow-y-auto">
          {!hasMessages ? (
            /* ===== WELCOME DASHBOARD ===== */
            <div className="h-full flex flex-col px-6 py-8 overflow-y-auto">
              <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
                {/* Hero */}
                <div className="text-center mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center mx-auto mb-4"><SageLogo size={36} /></div>
                  <h1 className="text-2xl font-bold text-slate-100 mb-1">Welcome back, Gabriel</h1>
                  <p className="text-sm text-slate-500">Here is your financial snapshot. Ask me anything about your business.</p>
                </div>

                {/* KPI Grid */}
                {kpis && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                    <KPICard label="Team Revenue" value={formatCurrency(kpis.teamRevenue)} sublabel={getCurrentMonth()} accentColor="teal" icon={DollarSign} />
                    <KPICard label="Gross Margin" value={formatPercent(kpis.teamMarginPct)} sublabel={kpis.teamMarginPct >= 20 ? "Healthy" : kpis.teamMarginPct >= 10 ? "Needs attention" : "Critical"} accentColor={kpis.teamMarginPct >= 20 ? "emerald" : kpis.teamMarginPct >= 10 ? "amber" : "rose"} icon={TrendingUp} trend={kpis.teamMarginPct >= 20 ? "up" : "down"} />
                    <KPICard label="AR Outstanding" value={formatCurrency(kpis.arOutstanding)} sublabel={`DSO: ${kpis.dso.toFixed(0)} days`} accentColor="blue" icon={Receipt} />
                    <KPICard label="Cash Runway" value={`${kpis.runway.toFixed(1)} mo`} sublabel={`Burn: ${formatCurrency(kpis.burnRate)}/mo`} accentColor={kpis.runway >= 6 ? "purple" : "rose"} icon={Gauge} />
                  </div>
                )}

                {/* Alert Badges */}
                {dataStats && (dataStats.uncatTxns > 0 || dataStats.overdueInvs > 0 || (kpis && kpis.teamMarginPct > 0 && kpis.teamMarginPct < 15)) && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {dataStats.uncatTxns > 0 && <AlertCard icon={CreditCard} label="uncategorized transactions" count={dataStats.uncatTxns} color="amber" onClick={() => sendMessage("Categorize my recent bank transactions")} />}
                    {dataStats.overdueInvs > 0 && <AlertCard icon={AlertTriangle} label="overdue invoices" count={dataStats.overdueInvs} color="rose" onClick={() => sendMessage("Show me overdue invoices and recommend follow-up actions")} />}
                    {kpis && kpis.teamMarginPct > 0 && kpis.teamMarginPct < 15 && <AlertCard icon={TrendingDown} label={`margin at ${kpis.teamMarginPct.toFixed(1)}%`} count={1} color="orange" onClick={() => sendMessage("My team margin is below 15%. What is driving this and how can I improve it?")} />}
                  </div>
                )}

                {/* Quick Actions */}
                <div className="mb-8">
                  <p className="text-[11px] font-medium text-slate-600 uppercase tracking-widest mb-3">Quick Actions</p>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {QUICK_ACTIONS.map((action, i) => {
                      const Icon = action.icon
                      return (
                        <button key={i} onClick={() => handleQuickAction(action)} className="flex items-center gap-3 px-3.5 py-3 rounded-lg bg-[#111827] border border-white/[0.06] hover:border-teal-500/20 hover:bg-[#131B2E] transition-all text-sm text-slate-400 hover:text-slate-200 text-left group">
                          <div className="w-8 h-8 rounded-md bg-white/[0.03] flex items-center justify-center flex-shrink-0 group-hover:bg-teal-500/10 transition-colors">
                            <Icon size={16} className="text-slate-500 group-hover:text-teal-400 transition-colors" />
                          </div>
                          <span className="leading-tight">{action.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Data context badge */}
                {dataStats && (
                  <div className="flex items-center justify-center mb-6">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#111827] border border-white/[0.06] text-[11px] text-slate-500">
                      <Brain size={12} className="text-teal-500" />
                      <span>Analyzing {dataStats.totalDataPoints.toLocaleString()} data points across {companyData?.clients?.length || 0} clients</span>
                    </div>
                  </div>
                )}

                {/* Input (welcome) */}
                <div className="mt-auto w-full max-w-3xl mx-auto">
                  <div className="relative">
                    <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyPress} placeholder="Ask Sage anything about your business..." rows={1} className="w-full bg-[#111827] border border-white/[0.08] rounded-xl pl-5 pr-28 py-4 text-slate-100 placeholder-slate-600 resize-none focus:outline-none focus:border-teal-500/40 focus:ring-1 focus:ring-teal-500/20 text-sm transition-all" style={{ minHeight: "56px", maxHeight: "200px" }} />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-500 hover:text-slate-300 transition-colors rounded-md hover:bg-white/[0.04]" title="Attach file"><Paperclip size={16} /></button>
                      <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading} className="w-9 h-9 rounded-lg bg-teal-500 hover:bg-teal-600 disabled:bg-white/[0.04] disabled:cursor-not-allowed flex items-center justify-center transition-colors">
                        {loading ? <RefreshCw size={16} className="text-white animate-spin" /> : <Send size={16} className="text-white" />}
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2.5 text-center">Enter to send · Drop files to attach · Charts, tables, categorization</p>
                </div>
              </div>
            </div>
          ) : (
            /* ===== MESSAGES ===== */
            <div className="py-6 px-4 space-y-5">
              {messages.map(message => <ChatMessage key={message.id} message={message} />)}
              {loading && (
                <div className="flex gap-3.5 max-w-4xl mx-auto">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/15 ring-1 ring-teal-500/25 flex items-center justify-center mt-0.5"><SageLogo size={22} /></div>
                  <div>
                    <p className="text-[11px] font-medium text-teal-400/70 mb-1 px-1">Sage</p>
                    <div className="bg-[#111827] border border-white/[0.06] rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                        <span className="text-xs text-slate-500">Analyzing your data...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ===== BOTTOM INPUT (in chat) ===== */}
        {hasMessages && (
          <div className="border-t border-white/[0.06] px-4 py-3.5 bg-[#0D1117]">
            {attachments.length > 0 && (
              <div className="max-w-4xl mx-auto mb-2.5 flex flex-wrap gap-2">
                {attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-2 px-3 py-1.5 bg-[#111827] border border-white/[0.06] rounded-lg text-xs">
                    {att.type.startsWith("image/") ? <ImageIcon size={13} className="text-teal-400" /> : <FileText size={13} className="text-teal-400" />}
                    <span className="text-slate-300 truncate max-w-[150px]">{att.name}</span>
                    <button onClick={() => removeAttachment(att.id)} className="text-slate-500 hover:text-red-400 transition-colors"><XCircle size={13} /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="max-w-4xl mx-auto relative">
              <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyPress} placeholder="Ask a follow-up..." rows={1} className="w-full bg-[#111827] border border-white/[0.06] rounded-xl pl-5 pr-28 py-3.5 text-slate-100 placeholder-slate-600 resize-none focus:outline-none focus:border-teal-500/40 focus:ring-1 focus:ring-teal-500/20 text-sm transition-all" style={{ minHeight: "52px", maxHeight: "200px" }} />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-500 hover:text-slate-300 transition-colors rounded-md hover:bg-white/[0.04]" title="Attach file"><Paperclip size={16} /></button>
                <button onClick={() => sendMessage(input)} disabled={(!input.trim() && attachments.length === 0) || loading} className="w-9 h-9 rounded-lg bg-teal-500 hover:bg-teal-600 disabled:bg-white/[0.04] disabled:cursor-not-allowed flex items-center justify-center transition-colors">
                  {loading ? <RefreshCw size={16} className="text-white animate-spin" /> : <Send size={16} className="text-white" />}
                </button>
              </div>
            </div>
          </div>
        )}

        <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.csv,.xlsx,.xls,.txt,.json" onChange={e => handleFileSelect(e.target.files)} className="hidden" />
      </div>
    </div>
  )
}
