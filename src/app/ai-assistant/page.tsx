"use client"
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { 
  Send, User, TrendingUp, DollarSign, 
  AlertTriangle, RefreshCw, Users, ChevronRight, Trash2, Clock, Target,
  Plus, MessageSquare, Pencil, Check, X, PanelLeftClose, PanelLeft,
  Paperclip, Image as ImageIcon, FileText, XCircle, BarChart3, PieChart,
  Zap, Brain, TrendingDown, ArrowUpRight, ArrowDownRight, Lightbulb, Activity,
  Gauge, Receipt, Search, CreditCard, CheckCircle2, XOctagon, Loader2, Shield
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
  const id = React.useId().replace(/:/g, "")
  const full = size >= 48
  const mid = size >= 28
  const sm = size < 28
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <radialGradient id={`sphere${id}`} cx="45%" cy="40%" r="50%" fx="35%" fy="35%">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.35" />
          <stop offset="40%" stopColor="#10b981" stopOpacity="0.20" />
          <stop offset="70%" stopColor="#059669" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#047857" stopOpacity="0.04" />
        </radialGradient>
        <radialGradient id={`rim${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="85%" stopColor="#10b981" stopOpacity="0" />
          <stop offset="95%" stopColor="#10b981" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.08" />
        </radialGradient>
        <radialGradient id={`spec${id}`} cx="38%" cy="30%" r="30%" fx="35%" fy="25%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`bar${id}`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#059669" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id={`arrow${id}`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#6ee7b7" />
        </linearGradient>
        <filter id={`ng${id}`}><feGaussianBlur stdDeviation="1.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id={`og${id}`}><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      {mid && <circle cx="60" cy="60" r="52" fill="#10b981" opacity="0.08" filter={`url(#og${id})`} />}
      <circle cx="60" cy="60" r={sm ? "48" : "46"} fill={`url(#sphere${id})`} />
      <circle cx="60" cy="60" r={sm ? "48" : "46"} fill={`url(#rim${id})`} />
      <circle cx="60" cy="60" r={sm ? "48" : "46"} fill={`url(#spec${id})`} />
      <circle cx="60" cy="60" r={sm ? "47" : "45"} fill="none" stroke="#10b981" strokeWidth={sm ? "1.5" : "1"} opacity="0.3" />
      {mid && <circle cx="60" cy="60" r="45" fill="none" stroke="#34d399" strokeWidth="0.5" opacity="0.15" />}
      {mid && <>
        <ellipse cx="60" cy="42" rx="34" ry="8" fill="none" stroke="#34d399" strokeWidth="0.4" opacity="0.15" />
        <ellipse cx="60" cy="60" rx="40" ry="10" fill="none" stroke="#10b981" strokeWidth="0.3" opacity="0.10" />
        <ellipse cx="60" cy="78" rx="32" ry="7" fill="none" stroke="#34d399" strokeWidth="0.4" opacity="0.12" />
      </>}
      {full && <>
        <line x1="30" y1="28" x2="52" y2="44" stroke="#34d399" strokeWidth="0.4" opacity="0.18" />
        <line x1="90" y1="30" x2="70" y2="46" stroke="#34d399" strokeWidth="0.4" opacity="0.15" />
        <line x1="25" y1="55" x2="42" y2="52" stroke="#10b981" strokeWidth="0.35" opacity="0.14" />
        <line x1="95" y1="58" x2="78" y2="54" stroke="#10b981" strokeWidth="0.35" opacity="0.12" />
        <line x1="32" y1="80" x2="48" y2="72" stroke="#34d399" strokeWidth="0.35" opacity="0.14" />
        <line x1="88" y1="82" x2="72" y2="74" stroke="#34d399" strokeWidth="0.35" opacity="0.12" />
        <line x1="52" y1="44" x2="70" y2="46" stroke="#10b981" strokeWidth="0.4" opacity="0.16" />
        <line x1="42" y1="52" x2="78" y2="54" stroke="#10b981" strokeWidth="0.3" opacity="0.10" />
        <line x1="48" y1="72" x2="72" y2="74" stroke="#10b981" strokeWidth="0.3" opacity="0.10" />
        <line x1="30" y1="28" x2="25" y2="55" stroke="#34d399" strokeWidth="0.3" opacity="0.10" />
        <line x1="90" y1="30" x2="95" y2="58" stroke="#34d399" strokeWidth="0.3" opacity="0.08" />
        <line x1="25" y1="55" x2="32" y2="80" stroke="#34d399" strokeWidth="0.3" opacity="0.10" />
        <line x1="95" y1="58" x2="88" y2="82" stroke="#34d399" strokeWidth="0.3" opacity="0.08" />
        <line x1="52" y1="44" x2="48" y2="72" stroke="#10b981" strokeWidth="0.25" opacity="0.08" strokeDasharray="2 3" />
        <line x1="70" y1="46" x2="72" y2="74" stroke="#10b981" strokeWidth="0.25" opacity="0.08" strokeDasharray="2 3" />
      </>}
      {full && <>
        <circle cx="30" cy="28" r="2.2" fill="#34d399" opacity="0.5" filter={`url(#ng${id})`} />
        <circle cx="30" cy="28" r="1.2" fill="#6ee7b7" opacity="0.8" />
        <circle cx="90" cy="30" r="2" fill="#34d399" opacity="0.4" filter={`url(#ng${id})`} />
        <circle cx="90" cy="30" r="1" fill="#6ee7b7" opacity="0.7" />
        <circle cx="25" cy="55" r="1.8" fill="#34d399" opacity="0.35" filter={`url(#ng${id})`} />
        <circle cx="25" cy="55" r="0.9" fill="#6ee7b7" opacity="0.6" />
        <circle cx="95" cy="58" r="1.8" fill="#34d399" opacity="0.3" filter={`url(#ng${id})`} />
        <circle cx="95" cy="58" r="0.9" fill="#6ee7b7" opacity="0.55" />
        <circle cx="32" cy="80" r="1.8" fill="#34d399" opacity="0.35" filter={`url(#ng${id})`} />
        <circle cx="32" cy="80" r="0.9" fill="#6ee7b7" opacity="0.6" />
        <circle cx="88" cy="82" r="1.8" fill="#34d399" opacity="0.3" filter={`url(#ng${id})`} />
        <circle cx="88" cy="82" r="0.9" fill="#6ee7b7" opacity="0.55" />
        <circle cx="52" cy="44" r="1.8" fill="#34d399" opacity="0.4" filter={`url(#ng${id})`} />
        <circle cx="52" cy="44" r="0.9" fill="#6ee7b7" opacity="0.7" />
        <circle cx="70" cy="46" r="1.8" fill="#34d399" opacity="0.35" filter={`url(#ng${id})`} />
        <circle cx="70" cy="46" r="0.9" fill="#6ee7b7" opacity="0.65" />
        <circle cx="42" cy="52" r="1.5" fill="#34d399" opacity="0.3" />
        <circle cx="42" cy="52" r="0.7" fill="#6ee7b7" opacity="0.55" />
        <circle cx="78" cy="54" r="1.5" fill="#34d399" opacity="0.28" />
        <circle cx="78" cy="54" r="0.7" fill="#6ee7b7" opacity="0.5" />
        <circle cx="48" cy="72" r="1.5" fill="#34d399" opacity="0.3" />
        <circle cx="48" cy="72" r="0.7" fill="#6ee7b7" opacity="0.55" />
        <circle cx="72" cy="74" r="1.5" fill="#34d399" opacity="0.28" />
        <circle cx="72" cy="74" r="0.7" fill="#6ee7b7" opacity="0.5" />
        <circle cx="40" cy="30" r="0.8" fill="#6ee7b7" opacity="0.3" />
        <circle cx="80" cy="40" r="0.8" fill="#6ee7b7" opacity="0.25" />
        <circle cx="22" cy="68" r="0.7" fill="#6ee7b7" opacity="0.2" />
        <circle cx="98" cy="48" r="0.6" fill="#6ee7b7" opacity="0.15" />
        <circle cx="60" cy="22" r="0.8" fill="#6ee7b7" opacity="0.25" />
        <circle cx="60" cy="98" r="0.7" fill="#6ee7b7" opacity="0.2" />
      </>}
      {mid && !full && <>
        <circle cx="32" cy="34" r="1.8" fill="#34d399" opacity="0.4" filter={`url(#ng${id})`} />
        <circle cx="32" cy="34" r="0.9" fill="#6ee7b7" opacity="0.7" />
        <circle cx="88" cy="36" r="1.6" fill="#34d399" opacity="0.35" filter={`url(#ng${id})`} />
        <circle cx="88" cy="36" r="0.8" fill="#6ee7b7" opacity="0.65" />
        <circle cx="28" cy="65" r="1.5" fill="#34d399" opacity="0.3" />
        <circle cx="28" cy="65" r="0.7" fill="#6ee7b7" opacity="0.55" />
        <circle cx="92" cy="68" r="1.5" fill="#34d399" opacity="0.28" />
        <circle cx="92" cy="68" r="0.7" fill="#6ee7b7" opacity="0.5" />
        <circle cx="40" cy="85" r="1.3" fill="#34d399" opacity="0.25" />
        <circle cx="80" cy="86" r="1.3" fill="#34d399" opacity="0.22" />
      </>}
      {mid && <>
        <rect x="42" y="72" width={full ? "5" : "6"} height="10" rx="1" fill={`url(#bar${id})`} opacity="0.75" />
        <rect x="49" y="67" width={full ? "5" : "6"} height="15" rx="1" fill={`url(#bar${id})`} opacity="0.80" />
        <rect x="56" y="62" width={full ? "5" : "6"} height="20" rx="1" fill={`url(#bar${id})`} opacity="0.85" />
        <rect x="63" y="56" width={full ? "5" : "6"} height="26" rx="1" fill={`url(#bar${id})`} opacity="0.90" />
        <rect x="70" y="50" width={full ? "5" : "6"} height="32" rx="1" fill={`url(#bar${id})`} opacity="0.95" />
      </>}
      {sm && <>
        <rect x="40" y="68" width="10" height="16" rx="2" fill={`url(#bar${id})`} opacity="0.75" />
        <rect x="54" y="58" width="10" height="26" rx="2" fill={`url(#bar${id})`} opacity="0.85" />
        <rect x="68" y="46" width="10" height="38" rx="2" fill={`url(#bar${id})`} opacity="0.95" />
      </>}
      {mid && (
        <path d="M45 68 C50 55, 58 48, 68 40 L74 38" stroke={`url(#arrow${id})`} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.85" />
      )}
      {mid && <>
        <polygon points="74,38 68,36 71,42" fill="#6ee7b7" opacity="0.9" />
        <path d="M45 68 C50 55, 58 48, 68 40 L74 38" stroke="#6ee7b7" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.08" filter={`url(#ng${id})`} />
      </>}
      {sm && (
        <>
          <path d="M42 72 C50 58, 58 50, 72 40" stroke={`url(#arrow${id})`} strokeWidth="3.5" strokeLinecap="round" fill="none" opacity="0.85" />
          <polygon points="72,40 65,38 68,45" fill="#6ee7b7" opacity="0.9" />
        </>
      )}
      {mid && <ellipse cx="48" cy="30" rx="14" ry="6" fill="white" opacity="0.06" />}
    </svg>
  )
}

// ============ TYPES ============
interface Message { id: string; role: "user" | "assistant"; content: string; timestamp: Date; attachments?: Attachment[]; chart?: ChartData; agentResult?: AgentResult; pendingApproval?: PendingApproval }
interface Attachment { id: string; name: string; type: string; size: number; content?: string }
interface ChartData { type: "bar" | "line" | "pie" | "area" | "waterfall" | "stacked_bar" | "multi_line" | "composed"; title: string; data: any[]; keys?: string[]; colors?: string[] }
interface TableData { title: string; headers: string[]; rows: string[][] }
interface Conversation { id: string; title: string; messages: Message[]; created_at: string; updated_at: string }
interface CompanyData { transactions: any[]; invoices: any[]; projects: any[]; clients: any[]; teamMembers: any[]; timeEntries: any[]; projectAssignments: any[]; billRates: any[]; costOverrides: any[]; expenses: any[]; learnedPatterns: any[] }
interface KPISummary { totalRevenue: number; totalExpenses: number; netIncome: number; grossMargin: number; cashOnHand: number; arOutstanding: number; burnRate: number; runway: number; utilizationRate: number; dso: number; teamCost: number; teamRevenue: number; teamMarginPct: number }
interface AgentResult { agent: string; status: "success" | "error"; data: any; summary: string }
interface PendingApproval { id: string; type: "bulk_update" | "invoice_approve" | "expense_categorize"; description: string; items: any[]; onApprove: () => Promise<void>; onReject: () => void }

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
    <div className="my-4 rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <h4 className="text-sm font-medium text-gray-800">{table.title}</h4>
      </div>
      <div className="bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200">
            {table.headers.map((h, i) => <th key={i} className="text-left py-3 px-4 text-gray-500 font-medium text-xs uppercase tracking-wider">{h}</th>)}
          </tr></thead>
          <tbody>{table.rows.map((row, ri) => (
            <tr key={ri} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
              {row.map((cell, ci) => <td key={ci} className="py-2.5 px-4 text-gray-800">{cell}</td>)}
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
    <div className="my-4 rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <h4 className="text-sm font-medium text-gray-800">{chart.title}</h4>
      </div>
      <div className="bg-white p-4 h-72">
        <ResponsiveContainer width="100%" height="100%">{renderChart()}</ResponsiveContainer>
      </div>
    </div>
  )
}

// ============ AGENT RESULT RENDERER ============
function AgentResultRenderer({ result }: { result: AgentResult }) {
  if (!result || result.status === "error") {
    return (
      <div className="my-3 p-4 rounded-xl border border-rose-200 bg-rose-50">
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
    <div className="my-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50/50">
      <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium mb-2">
        <Shield size={14} />
        <span>{agentLabels[result.agent] || result.agent}</span>
        <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-100 text-emerald-600 uppercase tracking-wider">Complete</span>
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
      <div className="my-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50">
        <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
          <CheckCircle2 size={16} />
          <span>Approved and applied. {approval.items.length} items updated.</span>
        </div>
      </div>
    )
  }

  if (decided === "rejected") {
    return (
      <div className="my-3 p-4 rounded-xl border border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <X size={14} />
          <span>Changes discarded.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="my-3 rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden">
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
                  <td className="py-1.5 px-3"><span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-700">Clean</span></td>
                </>}
              </tr>
            ))}</tbody>
          </table>
          {approval.items.length > 10 && <p className="text-xs text-gray-400 px-3 py-2">...and {approval.items.length - 10} more</p>}
        </div>
      )}
      <div className="px-4 py-3 flex items-center gap-3 bg-white border-t border-gray-100">
        <button onClick={handleApprove} disabled={processing} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
          {processing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {processing ? "Applying..." : "Approve"}
        </button>
        <button onClick={handleReject} disabled={processing} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-medium transition-colors">
          <X size={14} /> Reject
        </button>
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
          return <p key={i} className="my-1"><Link href={href} className="text-emerald-600 hover:text-emerald-500 inline-flex items-center gap-1 transition-colors font-medium">{linkMatch[1]} <ChevronRight size={12} /></Link></p>
        }
      }
      if (line.trim().startsWith("- ") || line.trim().startsWith("\u2022 ")) {
        return <p key={i} className="my-0.5 pl-3 text-gray-700">{"\u2022"} {line.replace(/^[-\u2022]\s*/, "").replace(/\*\*/g, "")}</p>
      }
      if (/^\d+\.\s/.test(line.trim())) return <p key={i} className="my-0.5 pl-3 text-gray-700">{line.replace(/\*\*/g, "")}</p>
      if (line.trim().endsWith(":") && line.trim().length < 60 && !line.includes("$")) return <p key={i} className="my-2.5 text-gray-800 font-medium text-[13px] uppercase tracking-wide">{line.replace(/\*\*/g, "")}</p>
      return <p key={i} className="my-1 text-gray-700">{line.replace(/\*\*/g, "")}</p>
    })
  }
  
  return (
    <div className={`flex gap-3.5 ${isUser ? "flex-row-reverse" : ""} max-w-4xl mx-auto`}>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${isUser ? "bg-blue-50 ring-1 ring-blue-200" : "bg-emerald-50 ring-1 ring-emerald-200"}`}>
        {isUser ? <User size={16} className="text-blue-600" /> : <SageLogo size={22} />}
      </div>
      <div className={`flex-1 min-w-0 ${isUser ? "text-right" : ""}`}>
        <p className={`text-[11px] font-medium mb-1 px-1 ${isUser ? "text-blue-500" : "text-emerald-600"}`}>{isUser ? "You" : "Sage"}</p>
        <div className={`inline-block rounded-xl px-4 py-3 max-w-[90%] text-left ${isUser ? "bg-blue-50 border border-blue-200 text-gray-800" : "bg-white border border-gray-200 text-gray-700 shadow-sm"}`}>
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-gray-200">
              {message.attachments.map(att => (
                <div key={att.id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg text-xs border border-gray-200">
                  {att.type.startsWith("image/") ? <ImageIcon size={14} className="text-emerald-500" /> : <FileText size={14} className="text-emerald-500" />}
                  <span className="truncate max-w-[150px] text-gray-700">{att.name}</span>
                  <span className="text-gray-400">{formatFileSize(att.size)}</span>
                </div>
              ))}
            </div>
          )}
          {/* Agent result badge */}
          {message.agentResult && <AgentResultRenderer result={message.agentResult} />}
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{formatContent(text)}</div>
          {tables.map((t, i) => <TableRenderer key={`t-${i}`} table={t} />)}
          {charts.map((c, i) => <ChartRenderer key={`c-${i}`} chart={c} />)}
          {/* Approval card */}
          {message.pendingApproval && (
            <ApprovalCard 
              approval={message.pendingApproval} 
              onApprove={message.pendingApproval.onApprove}
              onReject={message.pendingApproval.onReject}
            />
          )}
        </div>
        <p className="text-[10px] text-gray-400 mt-1 px-1">{new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
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
    <div className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${isActive ? "bg-emerald-50 border-l-2 border-l-emerald-500" : "hover:bg-gray-50 border-l-2 border-transparent"}`} onClick={() => !isEditing && onClick()}>
      <MessageSquare size={14} className={isActive ? "text-emerald-600 flex-shrink-0" : "text-gray-400 flex-shrink-0"} />
      {isEditing ? (
        <div className="flex-1 flex items-center gap-1">
          <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="flex-1 bg-white text-sm text-gray-900 px-2 py-1 rounded border border-gray-200 focus:outline-none focus:border-emerald-400" autoFocus onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === "Enter") { onRename(editTitle); setIsEditing(false) } if (e.key === "Escape") setIsEditing(false) }} />
          <button onClick={e => { e.stopPropagation(); onRename(editTitle); setIsEditing(false) }} className="p-1 text-emerald-600"><Check size={14} /></button>
          <button onClick={e => { e.stopPropagation(); setIsEditing(false) }} className="p-1 text-gray-400"><X size={14} /></button>
        </div>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <span className={`text-sm truncate block ${isActive ? "text-gray-900 font-medium" : "text-gray-700"}`}>{conversation.title}</span>
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
    const messagesForStorage = msgs.map(m => ({ ...m, timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp, pendingApproval: undefined }))
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
      case "timesheet-reconciler":
        return `TIMESHEET RECONCILER RESULTS:
Week: ${d.week?.start} to ${d.week?.end}
Team: ${d.team_summary?.total_members || 0} contractors, ${d.team_summary?.submitted || 0} submitted, ${d.team_summary?.missing || 0} missing, ${d.team_summary?.partial || 0} partial
Total hours: ${d.team_summary?.total_hours || 0}
${(d.members || []).map((m: any) => `  ${m.name}: ${m.status} (${m.hours_logged}h/${m.expected_hours}h) — ${m.projects?.map((p: any) => `${p.name}: ${p.hours}h`).join(", ") || "no entries"}`).join("\n")}
Budget alerts: ${(d.budget_alerts || []).map((b: any) => `${b.project_name} (${b.client_name}): ${b.hours_used}/${b.budget_hours}h = ${b.burn_pct}% [${b.status}]`).join("; ") || "None"}
AI Analysis: ${d.ai_analysis || ""}
Reminders drafted: ${(d.reminders || []).length}`

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
      const actionMatch = assistantContent.match(/```vantage-action\s*([\s\S]*?)```/)
      if (actionMatch && actionMatch[1]) {
        try {
          actionData = JSON.parse(actionMatch[1].trim())
          cleanMessage = assistantContent.replace(/```vantage-action[\s\S]*?```/g, "").trim()
        } catch (e) { console.error("Failed to parse action:", e) }
      }

      // Build assistant message
      const assistantMessage: Message = {
        id: `assistant_${Date.now()}`,
        role: "assistant",
        content: cleanMessage,
        timestamp: new Date(),
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
    <div className="flex items-center justify-center h-[calc(100vh-80px)] bg-[#f4f5f7]">
      <div className="text-center">
        <div className="mx-auto mb-4"><SageLogo size={64} className="animate-pulse" /></div>
        <p className="text-sm text-gray-400">Loading financial data...</p>
      </div>
    </div>
  )

  return (
    <div className="flex h-[calc(100vh-80px)] bg-[#f4f5f7]">
      {/* ========== SIDEBAR ========== */}
      <div className={`${sidebarOpen ? "w-72" : "w-0"} border-r border-gray-200 bg-white flex flex-col transition-all duration-300 overflow-hidden flex-shrink-0`}>
        <div className="p-3 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <button onClick={startNewConversation} className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-700 text-sm font-medium transition-all">
              <Plus size={16} /> New Chat
            </button>
            <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors" title="Collapse">
              <PanelLeftClose size={16} />
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search conversations..." className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/20" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {filteredConversations.map(c => <ConversationItem key={c.id} conversation={c} isActive={c.id === currentConversationId} onClick={() => loadConversation(c)} onDelete={() => deleteConversation(c.id)} onRename={title => renameConversation(c.id, title)} />)}
          {filteredConversations.length === 0 && <p className="text-xs text-gray-400 text-center py-8">{searchQuery ? "No matches found" : "No conversations yet"}</p>}
        </div>
        {dataStats && (
          <div className="p-3 border-t border-gray-200 bg-gray-50">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Data Connected</p>
            <div className="space-y-1.5">
              {dataStats.uncatTxns > 0 && <div className="flex items-center gap-2 text-amber-600 text-[11px] font-medium"><div className="w-1.5 h-1.5 rounded-full bg-amber-400" /><span>{dataStats.uncatTxns} uncategorized</span></div>}
              {dataStats.overdueInvs > 0 && <div className="flex items-center gap-2 text-rose-600 text-[11px] font-medium"><div className="w-1.5 h-1.5 rounded-full bg-rose-400" /><span>{dataStats.overdueInvs} overdue</span></div>}
              <div className="flex items-center gap-2 text-gray-500 text-[11px]"><Activity size={11} /><span>{dataStats.totalDataPoints.toLocaleString()} data points</span></div>
              {dataStats.learnedCount > 0 && <div className="flex items-center gap-2 text-emerald-600 text-[11px]"><Brain size={11} /><span>{dataStats.learnedCount} learned patterns</span></div>}
            </div>
          </div>
        )}
      </div>

      {/* ========== MAIN AREA ========== */}
      <div className="flex-1 flex flex-col relative min-w-0" onDragOver={e => { e.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-3">
            {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors mr-1" title="Open sidebar"><PanelLeft size={16} /></button>}
            <SageLogo size={32} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-gray-900">Sage</h1>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">Agent</span>
              </div>
              <p className="text-[11px] text-gray-400">Financial Intelligence & Operations</p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            {dataStats && (
              <div className="hidden md:flex items-center gap-2">
                {dataStats.uncatTxns > 0 && (
                  <button onClick={() => sendMessage("Categorize my uncategorized transactions")} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-medium hover:bg-amber-100 transition-colors">
                    <CreditCard size={11} />{dataStats.uncatTxns} uncat
                  </button>
                )}
                {dataStats.overdueInvs > 0 && (
                  <button onClick={() => sendMessage("Show me overdue invoices and recommend follow-up actions")} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium hover:bg-rose-100 transition-colors">
                    <AlertTriangle size={11} />{dataStats.overdueInvs} overdue
                  </button>
                )}
              </div>
            )}
            {kpis && (
              <div className="hidden lg:flex items-center gap-5 text-xs">
                <div className="flex items-center gap-1.5"><span className="text-gray-400">GM%</span><span className={`font-semibold tabular-nums ${kpis.teamMarginPct >= 20 ? "text-emerald-600" : kpis.teamMarginPct >= 10 ? "text-amber-600" : "text-rose-500"}`}>{kpis.teamMarginPct.toFixed(1)}%</span></div>
                <div className="w-px h-4 bg-gray-200" />
                <div className="flex items-center gap-1.5"><span className="text-gray-400">Runway</span><span className={`font-semibold tabular-nums ${kpis.runway >= 6 ? "text-emerald-600" : kpis.runway >= 3 ? "text-amber-600" : "text-rose-500"}`}>{kpis.runway.toFixed(1)}mo</span></div>
                <div className="w-px h-4 bg-gray-200" />
                <div className="flex items-center gap-1.5"><span className="text-gray-400">AR</span><span className="text-blue-600 font-semibold tabular-nums">{formatCurrency(kpis.arOutstanding)}</span></div>
                <div className="w-px h-4 bg-gray-200" />
                <div className="flex items-center gap-1.5"><span className="text-gray-400">Util</span><span className="text-purple-600 font-semibold tabular-nums">{kpis.utilizationRate.toFixed(0)}%</span></div>
              </div>
            )}
            <button onClick={startNewConversation} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors" title="New conversation"><Plus size={16} /></button>
          </div>
        </div>
        {/* Drop Zone */}
        {isDragging && (
          <div className="absolute inset-0 bg-white/95 z-50 flex items-center justify-center border-2 border-dashed border-emerald-400 m-4 rounded-xl">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4"><Paperclip size={28} className="text-emerald-500" /></div>
              <p className="text-lg text-gray-800 font-medium">Drop files here</p>
              <p className="text-sm text-gray-400 mt-1">Images, CSV, Excel, PDF, Text</p>
            </div>
          </div>
        )}
        {/* ========== CONTENT ========== */}
        <div className="flex-1 overflow-y-auto">
          {!hasMessages ? (
            <div className="h-full flex flex-col px-6 py-8 overflow-y-auto">
              <div className="max-w-4xl mx-auto w-full flex flex-col">
                <div className="flex items-center gap-4 mb-6">
                  <SageLogo size={56} className="flex-shrink-0" />
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Welcome back, Gabriel</h1>
                    <p className="text-sm text-gray-400">Here is your financial snapshot. Ask me anything about your business.</p>
                  </div>
                </div>
                {dataStats && (dataStats.uncatTxns > 0 || dataStats.overdueInvs > 0 || (kpis && kpis.teamMarginPct > 0 && kpis.teamMarginPct < 15)) && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {dataStats.uncatTxns > 0 && <AlertCard icon={CreditCard} label="uncategorized transactions" count={dataStats.uncatTxns} color="amber" onClick={() => sendMessage("Categorize my uncategorized transactions")} />}
                    {dataStats.overdueInvs > 0 && <AlertCard icon={AlertTriangle} label="overdue invoices" count={dataStats.overdueInvs} color="rose" onClick={() => sendMessage("Show me overdue invoices and recommend follow-up actions")} />}
                    {kpis && kpis.teamMarginPct > 0 && kpis.teamMarginPct < 15 && <AlertCard icon={TrendingDown} label={`margin at ${kpis.teamMarginPct.toFixed(1)}%`} count={1} color="orange" onClick={() => sendMessage("My team margin is below 15%. What is driving this and how can I improve it?")} />}
                  </div>
                )}
                <div className="mb-8">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-3">Quick Actions</p>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {QUICK_ACTIONS.map((action, i) => {
                      const Icon = action.icon
                      return (
                        <button key={i} onClick={() => handleQuickAction(action)} className={`flex items-center gap-3 px-3.5 py-3 rounded-lg bg-white border hover:shadow-sm transition-all text-sm text-gray-600 hover:text-gray-900 text-left group ${action.accent ? "border-emerald-200 hover:border-emerald-300" : "border-gray-200 hover:border-gray-300"}`}>
                          <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 transition-colors ${action.accent ? "bg-emerald-50 group-hover:bg-emerald-100" : "bg-gray-50 group-hover:bg-gray-100"}`}>
                            <Icon size={16} className={`transition-colors ${action.accent ? "text-emerald-600" : "text-gray-400 group-hover:text-gray-600"}`} />
                          </div>
                          <span className="leading-tight">{action.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="w-full max-w-3xl mx-auto mt-4">
                  <div className="relative">
                    <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyPress} placeholder={smartPlaceholder} rows={2} className="w-full bg-white border border-gray-200 rounded-2xl pl-5 pr-28 py-5 text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 text-[15px] transition-all shadow-sm" style={{ minHeight: "72px", maxHeight: "200px" }} />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                      <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-md hover:bg-gray-50" title="Attach file"><Paperclip size={16} /></button>
                      <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading} className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-100 disabled:cursor-not-allowed flex items-center justify-center transition-colors">
                        {loading ? <RefreshCw size={16} className="text-white animate-spin" /> : <Send size={16} className="text-white" />}
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2.5 text-center">Enter to send · Drop files to attach · Charts, tables, agents</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-6 px-4 space-y-5">
              {messages.map(message => <ChatMessage key={message.id} message={message} />)}
              {loading && (
                <div className="flex gap-3.5 max-w-4xl mx-auto">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 ring-1 ring-emerald-200 flex items-center justify-center mt-0.5"><SageLogo size={22} /></div>
                  <div>
                    <p className="text-[11px] font-medium text-emerald-600 mb-1 px-1">Sage</p>
                    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                        <span className="text-xs text-gray-400">{loadingLabel}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        {/* ===== BOTTOM INPUT ===== */}
        {hasMessages && (
          <div className="border-t border-gray-200 px-4 py-3.5 bg-white">
            {attachments.length > 0 && (
              <div className="max-w-4xl mx-auto mb-2.5 flex flex-wrap gap-2">
                {attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs">
                    {att.type.startsWith("image/") ? <ImageIcon size={13} className="text-emerald-500" /> : <FileText size={13} className="text-emerald-500" />}
                    <span className="text-gray-700 truncate max-w-[150px]">{att.name}</span>
                    <button onClick={() => removeAttachment(att.id)} className="text-gray-400 hover:text-red-500 transition-colors"><XCircle size={13} /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="max-w-4xl mx-auto relative">
              <textarea ref={textareaRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKeyPress} placeholder="Ask a follow-up..." rows={2} className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-5 pr-28 py-4 text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 text-[15px] transition-all" style={{ minHeight: "64px", maxHeight: "200px" }} />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                <button onClick={() => fileInputRef.current?.click()} className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-md hover:bg-gray-100" title="Attach file"><Paperclip size={16} /></button>
                <button onClick={() => sendMessage(input)} disabled={(!input.trim() && attachments.length === 0) || loading} className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-100 disabled:cursor-not-allowed flex items-center justify-center transition-colors">
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
