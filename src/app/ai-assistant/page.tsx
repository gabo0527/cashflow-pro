'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  Send, User, TrendingUp, DollarSign, 
  AlertTriangle, RefreshCw, Users, ChevronRight, Trash2, Clock, Target,
  Plus, MessageSquare, MoreHorizontal, Pencil, Check, X
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// ============ SAGE LOGO COMPONENT ============
function SageLogo({ size = 32, className = '' }: { size?: number, className?: string }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 48 48" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="sageGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="50%" stopColor="#6366F1" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
        <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      
      <path 
        d="M24 8C18 8 14 12 14 16C12 16 10 18 10 21C8 21 6 23 6 26C6 29 8 31 10 32C10 36 14 40 20 40C22 40 24 39 24 39" 
        stroke="url(#sageGradient)" 
        strokeWidth="2.5" 
        strokeLinecap="round"
        fill="none"
      />
      
      <path 
        d="M24 8C30 8 34 12 34 16C36 16 38 18 38 21C40 21 42 23 42 26C42 29 40 31 38 32C38 36 34 40 28 40C26 40 24 39 24 39" 
        stroke="url(#sageGradient)" 
        strokeWidth="2.5" 
        strokeLinecap="round"
        fill="none"
      />
      
      <path d="M24 8V39" stroke="url(#sageGradient)" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <path d="M14 20C16 20 18 22 18 24" stroke="url(#sageGradient)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M12 28C15 28 17 30 18 32" stroke="url(#sageGradient)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M34 20C32 20 30 22 30 24" stroke="url(#sageGradient)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M36 28C33 28 31 30 30 32" stroke="url(#sageGradient)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
      
      <rect x="17" y="28" width="3" height="6" rx="1" fill="url(#accentGradient)" opacity="0.9" />
      <rect x="22" y="24" width="3" height="10" rx="1" fill="url(#accentGradient)" opacity="0.9" />
      <rect x="27" y="20" width="3" height="14" rx="1" fill="url(#accentGradient)" opacity="0.9" />
      
      <path d="M16 32L21 28L26 24L32 18" stroke="#34D399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M30 16L32 18L30 20" stroke="#34D399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  )
}

// ============ TYPES ============
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  data?: any
}

interface Conversation {
  id: string
  title: string
  messages: Message[]
  created_at: string
  updated_at: string
}

interface CompanyData {
  transactions: any[]
  invoices: any[]
  projects: any[]
  clients: any[]
  teamMembers: any[]
  timeEntries: any[]
}

interface KPISummary {
  totalRevenue: number
  totalExpenses: number
  netIncome: number
  grossMargin: number
  cashOnHand: number
  arOutstanding: number
  burnRate: number
  runway: number
  utilizationRate: number
  dso: number
}

// ============ QUICK ACTIONS ============
const QUICK_ACTIONS = [
  { label: "What's my cash runway?", icon: DollarSign },
  { label: "Which clients are most profitable?", icon: TrendingUp },
  { label: "What should I be worried about?", icon: AlertTriangle },
  { label: "How's team utilization this week?", icon: Users },
  { label: "Show me overdue invoices", icon: Clock },
  { label: "Which projects need attention?", icon: Target },
]

// ============ SYSTEM PROMPT ============
const SYSTEM_PROMPT = `You are Sage, the AI Financial Intelligence Partner for Vantage. You serve as a virtual CFO and FP&A analyst for project-based businesses.

YOUR IDENTITY:
- Name: Sage
- Role: CFO-level financial advisor and operations partner
- Personality: Direct, insightful, proactive. You're a trusted partner who tells it like it is.
- Style: Concise but thorough. Lead with the answer, then explain. Use specific numbers.

YOUR CAPABILITIES:
1. ANALYZE - Deep dive into KPIs, trends, variances, profitability by client/project/team member
2. ADVISE - Strategic recommendations based on the data. Challenge assumptions constructively.
3. ALERT - Proactively flag risks: cash flow issues, overdue AR, utilization problems, unprofitable projects
4. FORECAST - Help with projections and scenario planning
5. OPERATE - Guide on categorization, time tracking review, invoice follow-ups
6. NAVIGATE - Direct users to relevant parts of Vantage (Reports, Forecast, specific pages)

YOUR DATA ACCESS:
You have COMPLETE access to ALL historical data:
- All transactions (income/expenses) with categories and project assignments
- All invoices with status, amounts, due dates, and aging
- All projects with budgets and financial performance
- All clients with revenue and profitability data
- All team members with rates and assignments
- ALL time entries (full history) with hours, billable status, dates, and project allocation

RESPONSE GUIDELINES:
1. Always use SPECIFIC NUMBERS from the data provided
2. If data is missing or insufficient, say so clearly
3. Be concise - finance people are busy
4. Lead with insights, not summaries
5. Always suggest a next action or follow-up question
6. Use bold for key numbers and metrics
7. When appropriate, mention relevant Vantage features: [View in Reports →] or [Open Forecast →]

PROACTIVE INSIGHTS:
Even when answering a specific question, look for opportunities to mention:
- Cash flow concerns
- Overdue receivables
- Utilization issues
- Profitability red flags
- Upcoming risks or opportunities

Remember: You're not just answering questions - you're a strategic partner helping run this business.`

// ============ UTILITY FUNCTIONS ============
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

const formatPercent = (value: number): string => `${value.toFixed(1)}%`

// ============ KPI CALCULATIONS ============
function calculateKPIs(data: CompanyData): KPISummary {
  const totalRevenue = data.invoices
    ?.filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0
  
  const totalExpenses = data.transactions
    ?.filter(t => t.type === 'expense' || t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0) || 0
  
  const netIncome = totalRevenue - totalExpenses
  const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses * 0.6) / totalRevenue) * 100 : 0
  
  const cashOnHand = data.transactions
    ?.filter(t => t.category === 'cash' || t.type === 'income')
    .reduce((sum, t) => sum + (t.amount || 0), 0) || 50000
  
  const arOutstanding = data.invoices
    ?.filter(inv => inv.status === 'pending' || inv.status === 'overdue')
    .reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0
  
  const burnRate = totalExpenses / 3 || 10000
  const runway = burnRate > 0 ? cashOnHand / burnRate : 12
  
  const totalHours = data.timeEntries?.reduce((sum, t) => sum + (t.hours || 0), 0) || 0
  const billableHours = data.timeEntries?.filter(t => t.billable).reduce((sum, t) => sum + (t.hours || 0), 0) || 0
  const utilizationRate = totalHours > 0 ? (billableHours / totalHours) * 100 : 75
  
  const paidInvoices = data.invoices?.filter(inv => inv.status === 'paid' && inv.paid_date) || []
  const avgDSO = paidInvoices.length > 0 
    ? paidInvoices.reduce((sum, inv) => {
        const issued = new Date(inv.issue_date || inv.created_at)
        const paid = new Date(inv.paid_date)
        return sum + Math.ceil((paid.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24))
      }, 0) / paidInvoices.length
    : 45
  
  return {
    totalRevenue,
    totalExpenses,
    netIncome,
    grossMargin,
    cashOnHand,
    arOutstanding,
    burnRate,
    runway,
    utilizationRate,
    dso: avgDSO
  }
}

function getARAgingSummary(invoices: any[]): any {
  const now = new Date()
  const aging = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 }
  
  invoices?.filter(inv => inv.status === 'pending' || inv.status === 'overdue').forEach(inv => {
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

function getClientProfitability(data: CompanyData): any[] {
  const clientData: Record<string, { name: string, revenue: number, cost: number, hours: number, invoiceCount: number }> = {}
  
  data.invoices?.forEach(inv => {
    const clientId = inv.client_id
    const client = data.clients?.find(c => c.id === clientId)
    if (!clientData[clientId]) {
      clientData[clientId] = { name: client?.name || 'Unknown', revenue: 0, cost: 0, hours: 0, invoiceCount: 0 }
    }
    if (inv.status === 'paid') {
      clientData[clientId].revenue += inv.amount || 0
    }
    clientData[clientId].invoiceCount++
  })
  
  data.timeEntries?.forEach(entry => {
    const project = data.projects?.find(p => p.id === entry.project_id)
    if (project?.client_id && clientData[project.client_id]) {
      const team = data.teamMembers?.find(t => t.id === entry.contractor_id)
      clientData[project.client_id].cost += (entry.hours || 0) * (team?.cost_rate || entry.cost_rate || 50)
      clientData[project.client_id].hours += entry.hours || 0
    }
  })
  
  return Object.entries(clientData)
    .map(([id, d]) => ({
      id,
      ...d,
      profit: d.revenue - d.cost,
      margin: d.revenue > 0 ? ((d.revenue - d.cost) / d.revenue) * 100 : 0
    }))
    .sort((a, b) => b.profit - a.profit)
}

function getProjectPerformance(data: CompanyData): any[] {
  return data.projects?.map(project => {
    const projectInvoices = data.invoices?.filter(inv => inv.project_id === project.id) || []
    const projectTime = data.timeEntries?.filter(t => t.project_id === project.id) || []
    
    const revenue = projectInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.amount || 0), 0)
    const pendingRevenue = projectInvoices.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + (inv.amount || 0), 0)
    
    const hours = projectTime.reduce((sum, t) => sum + (t.hours || 0), 0)
    const cost = projectTime.reduce((sum, t) => {
      const team = data.teamMembers?.find(tm => tm.id === t.contractor_id)
      return sum + (t.hours || 0) * (team?.cost_rate || t.cost_rate || 50)
    }, 0)
    
    const client = data.clients?.find(c => c.id === project.client_id)
    
    return {
      id: project.id,
      name: project.name,
      client: client?.name || 'No Client',
      status: project.status,
      budget: project.budget || 0,
      revenue,
      pendingRevenue,
      cost,
      hours,
      profit: revenue - cost,
      margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0,
      budgetUsed: project.budget > 0 ? (cost / project.budget) * 100 : 0
    }
  }).sort((a, b) => b.revenue - a.revenue) || []
}

function getOverdueInvoices(data: CompanyData): any[] {
  const now = new Date()
  
  return data.invoices
    ?.filter(inv => {
      if (inv.status === 'paid') return false
      const dueDate = new Date(inv.due_date || inv.created_at)
      return dueDate < now
    })
    .map(inv => {
      const client = data.clients?.find(c => c.id === inv.client_id)
      const dueDate = new Date(inv.due_date || inv.created_at)
      const daysOverdue = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
      
      return {
        id: inv.id,
        invoiceNumber: inv.invoice_number || inv.id,
        client: client?.name || 'Unknown',
        amount: inv.amount || 0,
        dueDate: inv.due_date,
        daysOverdue,
        status: inv.status
      }
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue) || []
}

function buildDataContext(data: CompanyData, kpis: KPISummary): string {
  const aging = getARAgingSummary(data.invoices)
  const clientProfit = getClientProfitability(data)
  const projectPerf = getProjectPerformance(data)
  const overdueInv = getOverdueInvoices(data)
  
  // ALL time entries organized by month
  const timeEntriesByMonth: Record<string, Record<string, { hours: number, billable: number }>> = {}
  
  data.timeEntries?.forEach(entry => {
    const date = new Date(entry.date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const member = data.teamMembers?.find(m => m.id === entry.contractor_id)
    const memberName = member?.name || 'Unknown'
    
    if (!timeEntriesByMonth[monthKey]) timeEntriesByMonth[monthKey] = {}
    if (!timeEntriesByMonth[monthKey][memberName]) {
      timeEntriesByMonth[monthKey][memberName] = { hours: 0, billable: 0 }
    }
    
    timeEntriesByMonth[monthKey][memberName].hours += entry.hours || 0
    if (entry.billable) timeEntriesByMonth[monthKey][memberName].billable += entry.hours || 0
  })

  // Time by team member (all time totals)
  const allTimeByMember: Record<string, { hours: number, billable: number, projectBreakdown: Record<string, number> }> = {}
  
  data.timeEntries?.forEach(entry => {
    const member = data.teamMembers?.find(m => m.id === entry.contractor_id)
    const memberName = member?.name || 'Unknown'
    const project = data.projects?.find(p => p.id === entry.project_id)
    const projectName = project?.name || 'No Project'
    
    if (!allTimeByMember[memberName]) {
      allTimeByMember[memberName] = { hours: 0, billable: 0, projectBreakdown: {} }
    }
    
    allTimeByMember[memberName].hours += entry.hours || 0
    if (entry.billable) allTimeByMember[memberName].billable += entry.hours || 0
    allTimeByMember[memberName].projectBreakdown[projectName] = 
      (allTimeByMember[memberName].projectBreakdown[projectName] || 0) + (entry.hours || 0)
  })

  // This week
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  const thisWeekEntries = data.timeEntries?.filter(t => new Date(t.date) >= oneWeekAgo) || []
  
  const thisWeekByMember: Record<string, number> = {}
  thisWeekEntries.forEach(entry => {
    const member = data.teamMembers?.find(m => m.id === entry.contractor_id)
    const memberName = member?.name || 'Unknown'
    thisWeekByMember[memberName] = (thisWeekByMember[memberName] || 0) + (entry.hours || 0)
  })

  return `
=== FINANCIAL SNAPSHOT (${new Date().toLocaleDateString()}) ===

KEY METRICS:
• Total Revenue (Paid Invoices): ${formatCurrency(kpis.totalRevenue)}
• Total Expenses: ${formatCurrency(kpis.totalExpenses)}
• Net Income: ${formatCurrency(kpis.netIncome)}
• Gross Margin: ${formatPercent(kpis.grossMargin)}
• Cash on Hand: ${formatCurrency(kpis.cashOnHand)}
• Monthly Burn Rate: ${formatCurrency(kpis.burnRate)}
• Cash Runway: ${kpis.runway.toFixed(1)} months
• Overall Utilization: ${formatPercent(kpis.utilizationRate)}
• Days Sales Outstanding (DSO): ${kpis.dso.toFixed(0)} days

=== CLIENTS (${data.clients?.length || 0} total) ===
${data.clients?.map(c => 
  `• ${c.name} | Status: ${c.status || 'active'} | Email: ${c.email || 'N/A'}`
).join('\n') || 'No clients'}

=== PROJECTS (${data.projects?.length || 0} total) ===
${data.projects?.map(p => {
  const client = data.clients?.find(c => c.id === p.client_id)
  return `• ${p.name} | Client: ${client?.name || 'No Client'} | Status: ${p.status || 'active'} | Budget: ${p.budget ? formatCurrency(p.budget) : 'N/A'}`
}).join('\n') || 'No projects'}

=== TEAM MEMBERS (${data.teamMembers?.length || 0} total) ===
${data.teamMembers?.map(t => 
  `• ${t.name} | Role: ${t.role || 'Team Member'} | Bill Rate: ${t.bill_rate ? '$' + t.bill_rate + '/hr' : 'N/A'} | Cost Rate: ${t.cost_rate ? '$' + t.cost_rate + '/hr' : 'N/A'}`
).join('\n') || 'No team members'}

=== TIME ENTRIES - THIS WEEK (Last 7 Days) ===
${Object.entries(thisWeekByMember).map(([name, hours]) => 
  `• ${name}: ${hours.toFixed(1)} hours`
).join('\n') || 'No time entries this week'}

=== TIME ENTRIES - ALL TIME BY TEAM MEMBER ===
${Object.entries(allTimeByMember).map(([name, data]) => 
  `• ${name}: ${data.hours.toFixed(1)} total hours, ${data.billable.toFixed(1)} billable (${data.hours > 0 ? ((data.billable/data.hours)*100).toFixed(0) : 0}% utilization)
  Projects: ${Object.entries(data.projectBreakdown).sort((a, b) => b[1] - a[1]).map(([proj, hrs]) => `${proj}: ${hrs.toFixed(1)}hrs`).join(', ')}`
).join('\n') || 'No time entries'}

=== TIME ENTRIES BY MONTH ===
${Object.entries(timeEntriesByMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 12).map(([month, members]) => 
  `${month}:\n${Object.entries(members).map(([name, data]) => 
    `  • ${name}: ${data.hours.toFixed(1)} hrs (${data.billable.toFixed(1)} billable)`
  ).join('\n')}`
).join('\n\n') || 'No time entries'}

=== INVOICES ===
Total: ${data.invoices?.length || 0}
• Paid: ${data.invoices?.filter(i => i.status === 'paid').length || 0} (${formatCurrency(data.invoices?.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.amount || 0), 0) || 0)})
• Pending: ${data.invoices?.filter(i => i.status === 'pending').length || 0} (${formatCurrency(data.invoices?.filter(i => i.status === 'pending').reduce((sum, i) => sum + (i.amount || 0), 0) || 0)})
• Overdue: ${data.invoices?.filter(i => i.status === 'overdue').length || 0} (${formatCurrency(data.invoices?.filter(i => i.status === 'overdue').reduce((sum, i) => sum + (i.amount || 0), 0) || 0)})

AR AGING:
• Current: ${formatCurrency(aging.current)}
• 1-30 Days: ${formatCurrency(aging.days30)}
• 31-60 Days: ${formatCurrency(aging.days60)}
• 61-90 Days: ${formatCurrency(aging.days90)}
• 90+ Days: ${formatCurrency(aging.over90)}

OVERDUE INVOICES:
${overdueInv.slice(0, 10).map(inv => 
  `• ${inv.client}: ${formatCurrency(inv.amount)} (${inv.daysOverdue} days overdue)`
).join('\n') || 'No overdue invoices'}

=== CLIENT PROFITABILITY ===
${clientProfit.slice(0, 10).map((c, i) => 
  `${i + 1}. ${c.name}: Revenue ${formatCurrency(c.revenue)}, Profit ${formatCurrency(c.profit)} (${formatPercent(c.margin)} margin)`
).join('\n') || 'No client data'}

=== PROJECT PERFORMANCE ===
${projectPerf.slice(0, 10).map((p, i) => 
  `${i + 1}. ${p.name} (${p.client}): Revenue ${formatCurrency(p.revenue)}, Profit ${formatCurrency(p.profit)} (${formatPercent(p.margin)} margin)`
).join('\n') || 'No project data'}
`
}

// ============ COMPONENTS ============
function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  
  const formatContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      if (line.includes('[View') || line.includes('→]')) {
        const linkMatch = line.match(/\[(.*?)\s*→\]/)
        if (linkMatch) {
          const href = line.toLowerCase().includes('forecast') ? '/forecast' 
            : line.toLowerCase().includes('report') ? '/reports' 
            : line.toLowerCase().includes('invoice') ? '/invoices'
            : line.toLowerCase().includes('project') ? '/projects'
            : line.toLowerCase().includes('client') ? '/clients'
            : line.toLowerCase().includes('time') ? '/time-tracking'
            : '/dashboard'
          return (
            <p key={i} className="my-1">
              <Link href={href} className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1">
                {linkMatch[1]} <ChevronRight size={12} />
              </Link>
            </p>
          )
        }
      }
      if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
        return <p key={i} className="my-0.5 pl-2">• {line.replace(/^[-•]\s*/, '')}</p>
      }
      if (/^\d+\.\s/.test(line.trim())) {
        return <p key={i} className="my-0.5 pl-2">{line}</p>
      }
      const boldProcessed = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
      return <p key={i} className="my-1" dangerouslySetInnerHTML={{ __html: boldProcessed }} />
    })
  }
  
  return (
    <div className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''} max-w-4xl mx-auto`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-blue-500' : 'bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500'
      }`}>
        {isUser ? <User size={18} className="text-white" /> : <SageLogo size={24} />}
      </div>
      
      <div className={`flex-1 ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block rounded-2xl px-5 py-3 max-w-[85%] ${
          isUser 
            ? 'bg-blue-500 text-white rounded-tr-md' 
            : 'bg-slate-800/90 text-slate-100 rounded-tl-md border border-slate-700/50'
        }`}>
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {formatContent(message.content)}
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-1.5 px-2">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

function QuickActionButton({ action, onClick }: { action: typeof QUICK_ACTIONS[0], onClick: () => void }) {
  const Icon = action.icon
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60 hover:border-slate-600 transition-all text-sm text-slate-300 text-left"
    >
      <Icon size={18} className="text-emerald-400 flex-shrink-0" />
      <span>{action.label}</span>
    </button>
  )
}

function ConversationItem({ 
  conversation, 
  isActive, 
  onClick, 
  onDelete,
  onRename 
}: { 
  conversation: Conversation
  isActive: boolean
  onClick: () => void
  onDelete: () => void
  onRename: (title: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(conversation.title)
  const [showMenu, setShowMenu] = useState(false)

  const handleSaveTitle = () => {
    onRename(editTitle)
    setIsEditing(false)
  }

  return (
    <div 
      className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
        isActive ? 'bg-slate-700/80' : 'hover:bg-slate-800/60'
      }`}
      onClick={() => !isEditing && onClick()}
    >
      <MessageSquare size={16} className="text-slate-400 flex-shrink-0" />
      
      {isEditing ? (
        <div className="flex-1 flex items-center gap-1">
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="flex-1 bg-slate-700 text-sm text-slate-100 px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-emerald-500"
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveTitle()
              if (e.key === 'Escape') setIsEditing(false)
            }}
          />
          <button onClick={(e) => { e.stopPropagation(); handleSaveTitle() }} className="p-1 text-emerald-400 hover:text-emerald-300">
            <Check size={14} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setIsEditing(false) }} className="p-1 text-slate-400 hover:text-slate-300">
            <X size={14} />
          </button>
        </div>
      ) : (
        <>
          <span className="flex-1 text-sm text-slate-200 truncate">{conversation.title}</span>
          
          <div className={`flex items-center gap-1 ${showMenu || isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsEditing(true); setEditTitle(conversation.title) }}
              className="p-1 text-slate-400 hover:text-slate-200"
            >
              <Pencil size={14} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="p-1 text-slate-400 hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ============ MAIN PAGE ============
export default function SageAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [companyData, setCompanyData] = useState<CompanyData | null>(null)
  const [kpis, setKpis] = useState<KPISummary | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  // Load user, company data, and conversations
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setDataLoading(false)
          return
        }
        setUserId(user.id)

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single()

        if (profile?.company_id) {
          setCompanyId(profile.company_id)
          
          // Load company data
          const [transactions, invoices, projects, clients, teamMembers, timeEntries] = await Promise.all([
            supabase.from('transactions').select('*').eq('company_id', profile.company_id),
            supabase.from('invoices').select('*').eq('company_id', profile.company_id),
            supabase.from('projects').select('*').eq('company_id', profile.company_id),
            supabase.from('clients').select('*').eq('company_id', profile.company_id),
            supabase.from('team_members').select('*').eq('company_id', profile.company_id),
            supabase.from('time_entries').select('*').eq('company_id', profile.company_id),
          ])

          const data: CompanyData = {
            transactions: transactions.data || [],
            invoices: invoices.data || [],
            projects: projects.data || [],
            clients: clients.data || [],
            teamMembers: teamMembers.data || [],
            timeEntries: timeEntries.data || []
          }
          
          setCompanyData(data)
          setKpis(calculateKPIs(data))

          // Load conversations
          const { data: convos } = await supabase
            .from('sage_conversations')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })

          if (convos) {
            setConversations(convos.map(c => ({
              ...c,
              messages: c.messages || []
            })))
          }
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setDataLoading(false)
      }
    }
    loadData()
  }, [])

  // Save conversation to database
  const saveConversation = async (msgs: Message[], conversationId: string | null, title?: string) => {
    if (!userId || !companyId) return null

    const messagesForStorage = msgs.map(m => ({
      ...m,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp
    }))

    if (conversationId) {
      // Update existing conversation
      await supabase
        .from('sage_conversations')
        .update({ 
          messages: messagesForStorage,
          updated_at: new Date().toISOString(),
          ...(title ? { title } : {})
        })
        .eq('id', conversationId)
      return conversationId
    } else {
      // Create new conversation
      const { data, error } = await supabase
        .from('sage_conversations')
        .insert({
          user_id: userId,
          company_id: companyId,
          title: title || 'New Conversation',
          messages: messagesForStorage
        })
        .select()
        .single()

      if (data) {
        setConversations(prev => [{ ...data, messages: msgs }, ...prev])
        return data.id
      }
      return null
    }
  }

  // Generate title from first message
  const generateTitle = (content: string): string => {
    const words = content.split(' ').slice(0, 6).join(' ')
    return words.length > 40 ? words.slice(0, 40) + '...' : words
  }

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return
    
    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    }
    
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const dataContext = companyData && kpis ? buildDataContext(companyData, kpis) : 'No company data available.'
      
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          systemPrompt: SYSTEM_PROMPT,
          dataContext
        })
      })

      if (!response.ok) throw new Error('Failed to get AI response')

      const data = await response.json()
      
      const assistantMessage: Message = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: data.content,
        timestamp: new Date(),
        data: data.metadata
      }
      
      const finalMessages = [...newMessages, assistantMessage]
      setMessages(finalMessages)
      
      // Save to database
      const title = messages.length === 0 ? generateTitle(content) : undefined
      const savedId = await saveConversation(finalMessages, currentConversationId, title)
      if (savedId && !currentConversationId) {
        setCurrentConversationId(savedId)
      }
      
      // Update conversation in list
      if (currentConversationId) {
        setConversations(prev => prev.map(c => 
          c.id === currentConversationId 
            ? { ...c, messages: finalMessages, updated_at: new Date().toISOString() }
            : c
        ))
      }
      
    } catch (error) {
      console.error('Error:', error)
      setMessages(prev => [...prev, {
        id: `error_${Date.now()}`,
        role: 'assistant',
        content: "I apologize, but I encountered an error processing your request. Please try again.",
        timestamp: new Date()
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => {
    sendMessage(action.label)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const startNewConversation = () => {
    setCurrentConversationId(null)
    setMessages([])
  }

  const loadConversation = (conversation: Conversation) => {
    setCurrentConversationId(conversation.id)
    setMessages(conversation.messages.map(m => ({
      ...m,
      timestamp: new Date(m.timestamp)
    })))
  }

  const deleteConversation = async (id: string) => {
    await supabase.from('sage_conversations').delete().eq('id', id)
    setConversations(prev => prev.filter(c => c.id !== id))
    if (currentConversationId === id) {
      startNewConversation()
    }
  }

  const renameConversation = async (id: string, title: string) => {
    await supabase.from('sage_conversations').update({ title }).eq('id', id)
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c))
  }

  const hasMessages = messages.length > 0

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-80px)]">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-0'} border-r border-slate-700/50 bg-slate-900/50 flex flex-col transition-all overflow-hidden`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-700/50">
          <button
            onClick={startNewConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors"
          >
            <Plus size={18} />
            New Chat
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {conversations.map(conversation => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === currentConversationId}
                onClick={() => loadConversation(conversation)}
                onDelete={() => deleteConversation(conversation.id)}
                onRename={(title) => renameConversation(conversation.id, title)}
              />
            ))}
          </div>
          
          {conversations.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">
              No conversations yet
            </p>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        {hasMessages && (
          <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors lg:hidden"
              >
                <MessageSquare size={18} />
              </button>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 flex items-center justify-center">
                <SageLogo size={28} />
              </div>
              <div>
                <h1 className="text-base font-semibold text-slate-100">Sage</h1>
                <p className="text-xs text-slate-400">Financial Intelligence Partner</p>
              </div>
            </div>
            <button 
              onClick={startNewConversation}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="New conversation"
            >
              <Plus size={18} />
            </button>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          {!hasMessages ? (
            <div className="h-full flex flex-col items-center justify-center px-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 flex items-center justify-center mb-6 shadow-lg shadow-purple-500/20">
                <SageLogo size={48} />
              </div>
              <h1 className="text-3xl font-bold text-slate-100 mb-2">Sage</h1>
              <p className="text-slate-400 text-center mb-8 max-w-lg">
                Your AI financial intelligence partner. I have access to all your data — 
                transactions, invoices, projects, clients, team, and time tracking. Ask me anything.
              </p>
              
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8 max-w-3xl w-full">
                {QUICK_ACTIONS.map((action, i) => (
                  <QuickActionButton key={i} action={action} onClick={() => handleQuickAction(action)} />
                ))}
              </div>

              <div className="w-full max-w-2xl">
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Ask Sage about your finances..."
                    rows={1}
                    className="w-full bg-slate-800/80 border border-slate-600/50 rounded-2xl pl-5 pr-14 py-4 text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 text-base"
                    style={{ minHeight: '64px', maxHeight: '200px' }}
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || loading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                  >
                    {loading ? (
                      <RefreshCw size={18} className="text-white animate-spin" />
                    ) : (
                      <Send size={18} className="text-white" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-3 text-center">
                  Press Enter to send • Shift+Enter for new line
                </p>
              </div>
            </div>
          ) : (
            <div className="py-6 px-4 space-y-6">
              {messages.map(message => (
                <ChatMessage key={message.id} message={message} />
              ))}
              
              {loading && (
                <div className="flex gap-4 max-w-4xl mx-auto">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 flex items-center justify-center">
                    <SageLogo size={24} />
                  </div>
                  <div className="bg-slate-800/90 rounded-2xl rounded-tl-md px-5 py-3 border border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-sm text-slate-400">Sage is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Bottom Input */}
        {hasMessages && (
          <div className="border-t border-slate-700/50 px-4 py-4 bg-slate-900/80">
            <div className="max-w-4xl mx-auto relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask a follow-up question..."
                rows={1}
                className="w-full bg-slate-800/80 border border-slate-600/50 rounded-2xl pl-5 pr-14 py-4 text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                style={{ minHeight: '60px', maxHeight: '200px' }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
              >
                {loading ? (
                  <RefreshCw size={18} className="text-white animate-spin" />
                ) : (
                  <Send size={18} className="text-white" />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
