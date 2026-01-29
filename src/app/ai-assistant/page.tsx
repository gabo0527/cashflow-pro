'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { 
  Send, User, TrendingUp, DollarSign, 
  AlertTriangle, RefreshCw, Users, ChevronRight, Trash2, Clock, Target,
  Plus, MessageSquare, Pencil, Check, X, PanelLeftClose, PanelLeft,
  Paperclip, Image as ImageIcon, FileText, XCircle, BarChart3, PieChart
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'
import { BarChart, Bar, LineChart, Line, PieChart as RechartsPie, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// Chart colors
const CHART_COLORS = ['#34D399', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6', '#6366F1']

// ============ SAGE LOGO COMPONENT ============
function SageLogo({ size = 32, className = '' }: { size?: number, className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
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
  attachments?: Attachment[]
  chart?: ChartData
}

interface Attachment {
  id: string
  name: string
  type: string
  size: number
  content?: string
}

interface ChartData {
  type: 'bar' | 'line' | 'pie'
  title: string
  data: any[]
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
  projectAssignments: any[]
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
  { label: "Show team utilization chart", icon: BarChart3 },
  { label: "Show me overdue invoices", icon: Clock },
  { label: "Revenue by client chart", icon: PieChart },
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
7. VISUALIZE - Create charts when asked. Use the special chart format below.

CHART GENERATION:
When the user asks for a chart, visualization, or graph, include a JSON chart block in your response using this exact format:

\`\`\`sage-chart
{
  "type": "bar",
  "title": "Revenue by Client",
  "data": [
    {"name": "Client A", "value": 50000},
    {"name": "Client B", "value": 35000}
  ]
}
\`\`\`

Chart types:
- "bar" - for comparisons (revenue by client, hours by project)
- "line" - for trends over time (monthly revenue, weekly hours)
- "pie" - for proportions (expense breakdown, client distribution)

Always use REAL data from the financial snapshot. Never use placeholder or example data.

YOUR DATA ACCESS:
You have COMPLETE access to ALL historical data including transactions, invoices, projects, clients, team members, time entries, AND project-specific billing rates for each team member on each project. You can see exactly what rate each person is billed at for each project they're assigned to.

RESPONSE GUIDELINES:
1. Always use SPECIFIC NUMBERS from the data provided
2. If data is missing or insufficient, say so clearly
3. Be concise - finance people are busy
4. Lead with insights, not summaries
5. Always suggest a next action or follow-up question
6. Use bold for key numbers and metrics
7. When appropriate, mention relevant Vantage features: [View in Reports →] or [Open Forecast →]

Remember: You're not just answering questions - you're a strategic partner helping run this business.`

// ============ UTILITY FUNCTIONS ============
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

const formatPercent = (value: number): string => `${value.toFixed(1)}%`

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// ============ KPI & DATA FUNCTIONS ============
function calculateKPIs(data: CompanyData): KPISummary {
  const totalRevenue = data.invoices?.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0
  const totalExpenses = data.transactions?.filter(t => t.type === 'expense' || t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount || 0), 0) || 0
  const netIncome = totalRevenue - totalExpenses
  const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalExpenses * 0.6) / totalRevenue) * 100 : 0
  const cashOnHand = data.transactions?.filter(t => t.category === 'cash' || t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0) || 50000
  const arOutstanding = data.invoices?.filter(inv => inv.status === 'pending' || inv.status === 'overdue').reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0
  const burnRate = totalExpenses / 3 || 10000
  const runway = burnRate > 0 ? cashOnHand / burnRate : 12
  const totalHours = data.timeEntries?.reduce((sum, t) => sum + (t.hours || 0), 0) || 0
  const billableHours = data.timeEntries?.filter(t => t.billable).reduce((sum, t) => sum + (t.hours || 0), 0) || 0
  const utilizationRate = totalHours > 0 ? (billableHours / totalHours) * 100 : 75
  const paidInvoices = data.invoices?.filter(inv => inv.status === 'paid' && inv.paid_date) || []
  const avgDSO = paidInvoices.length > 0 ? paidInvoices.reduce((sum, inv) => {
    const issued = new Date(inv.issue_date || inv.created_at)
    const paid = new Date(inv.paid_date)
    return sum + Math.ceil((paid.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24))
  }, 0) / paidInvoices.length : 45
  return { totalRevenue, totalExpenses, netIncome, grossMargin, cashOnHand, arOutstanding, burnRate, runway, utilizationRate, dso: avgDSO }
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
  const clientData: Record<string, { name: string, revenue: number, cost: number, hours: number }> = {}
  data.invoices?.forEach(inv => {
    const clientId = inv.client_id
    const client = data.clients?.find(c => c.id === clientId)
    if (!clientData[clientId]) clientData[clientId] = { name: client?.name || 'Unknown', revenue: 0, cost: 0, hours: 0 }
    if (inv.status === 'paid') clientData[clientId].revenue += inv.amount || 0
  })
  data.timeEntries?.forEach(entry => {
    const project = data.projects?.find(p => p.id === entry.project_id)
    if (project?.client_id && clientData[project.client_id]) {
      // Get rate from project assignment first, then fall back to team member rate or entry rate
      const assignment = data.projectAssignments?.find(a => a.team_member_id === entry.contractor_id && a.project_id === entry.project_id)
      const team = data.teamMembers?.find(t => t.id === entry.contractor_id)
      const rate = assignment?.rate || team?.cost_rate || entry.cost_rate || 50
      clientData[project.client_id].cost += (entry.hours || 0) * rate
      clientData[project.client_id].hours += entry.hours || 0
    }
  })
  return Object.entries(clientData).map(([id, d]) => ({ id, ...d, profit: d.revenue - d.cost, margin: d.revenue > 0 ? ((d.revenue - d.cost) / d.revenue) * 100 : 0 })).sort((a, b) => b.profit - a.profit)
}

function getProjectPerformance(data: CompanyData): any[] {
  return data.projects?.map(project => {
    const projectInvoices = data.invoices?.filter(inv => inv.project_id === project.id) || []
    const projectTime = data.timeEntries?.filter(t => t.project_id === project.id) || []
    const revenue = projectInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.amount || 0), 0)
    const hours = projectTime.reduce((sum, t) => sum + (t.hours || 0), 0)
    const cost = projectTime.reduce((sum, t) => {
      // Get rate from project assignment first, then fall back to team member rate or entry rate
      const assignment = data.projectAssignments?.find(a => a.team_member_id === t.contractor_id && a.project_id === t.project_id)
      const team = data.teamMembers?.find(tm => tm.id === t.contractor_id)
      const rate = assignment?.rate || team?.cost_rate || t.cost_rate || 50
      return sum + (t.hours || 0) * rate
    }, 0)
    const client = data.clients?.find(c => c.id === project.client_id)
    // Get all team members assigned to this project with their rates
    const assignedTeam = data.projectAssignments?.filter(a => a.project_id === project.id).map(a => {
      const member = data.teamMembers?.find(m => m.id === a.team_member_id)
      return { name: member?.name || 'Unknown', rate: a.rate || 0, service: a.service }
    }) || []
    return { id: project.id, name: project.name, client: client?.name || 'No Client', status: project.status, revenue, cost, hours, profit: revenue - cost, margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : 0, assignedTeam }
  }).sort((a, b) => b.revenue - a.revenue) || []
}

function getOverdueInvoices(data: CompanyData): any[] {
  const now = new Date()
  return data.invoices?.filter(inv => inv.status !== 'paid' && new Date(inv.due_date || inv.created_at) < now)
    .map(inv => {
      const client = data.clients?.find(c => c.id === inv.client_id)
      const daysOverdue = Math.ceil((now.getTime() - new Date(inv.due_date || inv.created_at).getTime()) / (1000 * 60 * 60 * 24))
      return { id: inv.id, invoiceNumber: inv.invoice_number || inv.id, client: client?.name || 'Unknown', amount: inv.amount || 0, daysOverdue }
    }).sort((a, b) => b.daysOverdue - a.daysOverdue) || []
}

function buildDataContext(data: CompanyData, kpis: KPISummary): string {
  const aging = getARAgingSummary(data.invoices)
  const clientProfit = getClientProfitability(data)
  const projectPerf = getProjectPerformance(data)
  const overdueInv = getOverdueInvoices(data)
  
  const timeEntriesByMonth: Record<string, Record<string, { hours: number, billable: number }>> = {}
  data.timeEntries?.forEach(entry => {
    const date = new Date(entry.date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const member = data.teamMembers?.find(m => m.id === entry.contractor_id)
    const memberName = member?.name || 'Unknown'
    if (!timeEntriesByMonth[monthKey]) timeEntriesByMonth[monthKey] = {}
    if (!timeEntriesByMonth[monthKey][memberName]) timeEntriesByMonth[monthKey][memberName] = { hours: 0, billable: 0 }
    timeEntriesByMonth[monthKey][memberName].hours += entry.hours || 0
    if (entry.billable) timeEntriesByMonth[monthKey][memberName].billable += entry.hours || 0
  })

  const allTimeByMember: Record<string, { hours: number, billable: number }> = {}
  data.timeEntries?.forEach(entry => {
    const member = data.teamMembers?.find(m => m.id === entry.contractor_id)
    const memberName = member?.name || 'Unknown'
    if (!allTimeByMember[memberName]) allTimeByMember[memberName] = { hours: 0, billable: 0 }
    allTimeByMember[memberName].hours += entry.hours || 0
    if (entry.billable) allTimeByMember[memberName].billable += entry.hours || 0
  })

  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  const thisWeekByMember: Record<string, number> = {}
  data.timeEntries?.filter(t => new Date(t.date) >= oneWeekAgo).forEach(entry => {
    const member = data.teamMembers?.find(m => m.id === entry.contractor_id)
    const memberName = member?.name || 'Unknown'
    thisWeekByMember[memberName] = (thisWeekByMember[memberName] || 0) + (entry.hours || 0)
  })

  return `
=== FINANCIAL SNAPSHOT (${new Date().toLocaleDateString()}) ===

KEY METRICS:
• Total Revenue: ${formatCurrency(kpis.totalRevenue)}
• Total Expenses: ${formatCurrency(kpis.totalExpenses)}
• Net Income: ${formatCurrency(kpis.netIncome)}
• Gross Margin: ${formatPercent(kpis.grossMargin)}
• Cash on Hand: ${formatCurrency(kpis.cashOnHand)}
• Monthly Burn Rate: ${formatCurrency(kpis.burnRate)}
• Cash Runway: ${kpis.runway.toFixed(1)} months
• Utilization: ${formatPercent(kpis.utilizationRate)}
• DSO: ${kpis.dso.toFixed(0)} days

=== CLIENTS (${data.clients?.length || 0}) ===
${data.clients?.map(c => `• ${c.name} | ${c.status || 'active'}`).join('\n') || 'No clients'}

=== PROJECTS (${data.projects?.length || 0}) ===
${data.projects?.map(p => `• ${p.name} | ${data.clients?.find(c => c.id === p.client_id)?.name || 'No Client'} | ${p.status || 'active'}`).join('\n') || 'No projects'}

=== TEAM (${data.teamMembers?.length || 0}) ===
${data.teamMembers?.map(t => `• ${t.name} | ${t.role || 'Team Member'} | $${t.bill_rate || 0}/hr`).join('\n') || 'No team'}

=== TIME THIS WEEK ===
${Object.entries(thisWeekByMember).map(([name, hours]) => `• ${name}: ${hours.toFixed(1)} hours`).join('\n') || 'No entries'}

=== TIME ALL-TIME BY MEMBER ===
${Object.entries(allTimeByMember).map(([name, d]) => `• ${name}: ${d.hours.toFixed(1)} hrs (${d.hours > 0 ? ((d.billable/d.hours)*100).toFixed(0) : 0}% billable)`).join('\n') || 'No entries'}

=== TIME BY MONTH ===
${Object.entries(timeEntriesByMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6).map(([month, members]) => `${month}: ${Object.entries(members).map(([name, d]) => `${name}: ${d.hours.toFixed(1)}hrs`).join(', ')}`).join('\n') || 'No entries'}

=== INVOICES ===
• Paid: ${data.invoices?.filter(i => i.status === 'paid').length || 0} (${formatCurrency(data.invoices?.filter(i => i.status === 'paid').reduce((s, i) => s + (i.amount || 0), 0) || 0)})
• Pending: ${data.invoices?.filter(i => i.status === 'pending').length || 0} (${formatCurrency(data.invoices?.filter(i => i.status === 'pending').reduce((s, i) => s + (i.amount || 0), 0) || 0)})
• Overdue: ${overdueInv.length} (${formatCurrency(overdueInv.reduce((s, i) => s + i.amount, 0))})

=== AR AGING ===
• Current: ${formatCurrency(aging.current)}
• 1-30 Days: ${formatCurrency(aging.days30)}
• 31-60 Days: ${formatCurrency(aging.days60)}
• 61-90 Days: ${formatCurrency(aging.days90)}
• 90+ Days: ${formatCurrency(aging.over90)}

=== CLIENT PROFITABILITY ===
${clientProfit.slice(0, 10).map((c, i) => `${i + 1}. ${c.name}: ${formatCurrency(c.revenue)} rev, ${formatCurrency(c.profit)} profit (${formatPercent(c.margin)})`).join('\n') || 'No data'}

=== PROJECT PERFORMANCE ===
${projectPerf.slice(0, 10).map((p, i) => `${i + 1}. ${p.name}: ${formatCurrency(p.revenue)} rev, ${p.hours.toFixed(1)} hrs`).join('\n') || 'No data'}

=== PROJECT BILLING RATES BY TEAM MEMBER ===
${data.projectAssignments?.map(a => {
  const member = data.teamMembers?.find(m => m.id === a.team_member_id)
  const project = data.projects?.find(p => p.id === a.project_id)
  const client = data.clients?.find(c => c.id === project?.client_id)
  return `• ${member?.name || 'Unknown'} → ${project?.name || 'Unknown Project'} (${client?.name || 'No Client'}): $${a.rate || 0}/hr | ${a.service || 'General'} | ${a.payment_type || 'hourly'}`
}).join('\n') || 'No project assignments'}
`
}

// ============ CHART COMPONENT ============
function ChartRenderer({ chart }: { chart: ChartData }) {
  if (!chart || !chart.data || chart.data.length === 0) return null

  return (
    <div className="my-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
      <h4 className="text-sm font-medium text-slate-200 mb-4">{chart.title}</h4>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {chart.type === 'bar' ? (
            <BarChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
              <Bar dataKey="value" fill="#34D399" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : chart.type === 'line' ? (
            <LineChart data={chart.data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="value" stroke="#34D399" strokeWidth={2} dot={{ fill: '#34D399' }} />
            </LineChart>
          ) : (
            <RechartsPie>
              <Pie data={chart.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {chart.data.map((_, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
              <Legend />
            </RechartsPie>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ============ MESSAGE COMPONENT ============
function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  
  const parseChart = (content: string): { text: string, chart: ChartData | null } => {
    const chartMatch = content.match(/```sage-chart\s*([\s\S]*?)```/)
    if (chartMatch) {
      try {
        const chart = JSON.parse(chartMatch[1].trim())
        const text = content.replace(/```sage-chart[\s\S]*?```/, '').trim()
        return { text, chart }
      } catch (e) { console.error('Failed to parse chart:', e) }
    }
    return { text: content, chart: null }
  }

  const { text, chart } = isUser ? { text: message.content, chart: null } : parseChart(message.content)
  
  const formatContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      if (line.includes('[View') || line.includes('→]')) {
        const linkMatch = line.match(/\[(.*?)\s*→\]/)
        if (linkMatch) {
          const href = line.toLowerCase().includes('forecast') ? '/forecast' : line.toLowerCase().includes('report') ? '/reports' : line.toLowerCase().includes('invoice') ? '/invoices' : line.toLowerCase().includes('project') ? '/projects' : line.toLowerCase().includes('client') ? '/clients' : line.toLowerCase().includes('time') ? '/time-tracking' : '/dashboard'
          return <p key={i} className="my-1"><Link href={href} className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1">{linkMatch[1]} <ChevronRight size={12} /></Link></p>
        }
      }
      if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) return <p key={i} className="my-0.5 pl-2">• {line.replace(/^[-•]\s*/, '')}</p>
      if (/^\d+\.\s/.test(line.trim())) return <p key={i} className="my-0.5 pl-2">{line}</p>
      const boldProcessed = line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
      return <p key={i} className="my-1" dangerouslySetInnerHTML={{ __html: boldProcessed }} />
    })
  }
  
  return (
    <div className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''} max-w-4xl mx-auto`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isUser ? 'bg-blue-500' : 'bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500'}`}>
        {isUser ? <User size={18} className="text-white" /> : <SageLogo size={24} />}
      </div>
      <div className={`flex-1 ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block rounded-2xl px-5 py-3 max-w-[85%] ${isUser ? 'bg-blue-500 text-white rounded-tr-md' : 'bg-slate-800/90 text-slate-100 rounded-tl-md border border-slate-700/50'}`}>
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {message.attachments.map(att => (
                <div key={att.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-700/50 rounded-lg text-xs">
                  {att.type.startsWith('image/') ? <ImageIcon size={14} /> : <FileText size={14} />}
                  <span className="truncate max-w-[150px]">{att.name}</span>
                  <span className="text-slate-400">{formatFileSize(att.size)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="text-sm leading-relaxed whitespace-pre-wrap">{formatContent(text)}</div>
          {chart && <ChartRenderer chart={chart} />}
        </div>
        <p className="text-xs text-slate-500 mt-1.5 px-2">{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
      </div>
    </div>
  )
}

function QuickActionButton({ action, onClick }: { action: typeof QUICK_ACTIONS[0], onClick: () => void }) {
  const Icon = action.icon
  return (
    <button onClick={onClick} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:bg-slate-700/60 hover:border-slate-600 transition-all text-sm text-slate-300 text-left">
      <Icon size={18} className="text-emerald-400 flex-shrink-0" />
      <span>{action.label}</span>
    </button>
  )
}

function ConversationItem({ conversation, isActive, onClick, onDelete, onRename }: { conversation: Conversation, isActive: boolean, onClick: () => void, onDelete: () => void, onRename: (title: string) => void }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(conversation.title)

  return (
    <div className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${isActive ? 'bg-slate-700/80' : 'hover:bg-slate-800/60'}`} onClick={() => !isEditing && onClick()}>
      <MessageSquare size={16} className="text-slate-400 flex-shrink-0" />
      {isEditing ? (
        <div className="flex-1 flex items-center gap-1">
          <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="flex-1 bg-slate-700 text-sm text-slate-100 px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-emerald-500" autoFocus onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Enter') { onRename(editTitle); setIsEditing(false) } if (e.key === 'Escape') setIsEditing(false) }} />
          <button onClick={(e) => { e.stopPropagation(); onRename(editTitle); setIsEditing(false) }} className="p-1 text-emerald-400"><Check size={14} /></button>
          <button onClick={(e) => { e.stopPropagation(); setIsEditing(false) }} className="p-1 text-slate-400"><X size={14} /></button>
        </div>
      ) : (
        <>
          <span className="flex-1 text-sm text-slate-200 truncate">{conversation.title}</span>
          <div className={`flex items-center gap-1 ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
            <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); setEditTitle(conversation.title) }} className="p-1 text-slate-400 hover:text-slate-200"><Pencil size={14} /></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="p-1 text-slate-400 hover:text-red-400"><Trash2 size={14} /></button>
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
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [loading, setLoading] = useState(false)
  const [companyData, setCompanyData] = useState<CompanyData | null>(null)
  const [kpis, setKpis] = useState<KPISummary | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  useEffect(() => { scrollToBottom() }, [messages])
  useEffect(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px' } }, [input])

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setDataLoading(false); return }
        setUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', user.id).single()
        if (profile?.company_id) {
          setCompanyId(profile.company_id)
          const [transactions, invoices, projects, clients, teamMembers, timeEntries, projectAssignments] = await Promise.all([
            supabase.from('transactions').select('*').eq('company_id', profile.company_id),
            supabase.from('invoices').select('*').eq('company_id', profile.company_id),
            supabase.from('projects').select('*').eq('company_id', profile.company_id),
            supabase.from('clients').select('*').eq('company_id', profile.company_id),
            supabase.from('team_members').select('*').eq('company_id', profile.company_id),
            supabase.from('time_entries').select('*').eq('company_id', profile.company_id),
            supabase.from('team_project_assignments').select('*').eq('company_id', profile.company_id),
          ])
          const data: CompanyData = { transactions: transactions.data || [], invoices: invoices.data || [], projects: projects.data || [], clients: clients.data || [], teamMembers: teamMembers.data || [], timeEntries: timeEntries.data || [], projectAssignments: projectAssignments.data || [] }
          setCompanyData(data)
          setKpis(calculateKPIs(data))
          const { data: convos } = await supabase.from('sage_conversations').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
          if (convos) setConversations(convos.map(c => ({ ...c, messages: c.messages || [] })))
        }
      } catch (error) { console.error('Error loading data:', error) }
      finally { setDataLoading(false) }
    }
    loadData()
  }, [])

  const saveConversation = async (msgs: Message[], conversationId: string | null, title?: string) => {
    if (!userId || !companyId) return null
    const messagesForStorage = msgs.map(m => ({ ...m, timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp }))
    if (conversationId) {
      await supabase.from('sage_conversations').update({ messages: messagesForStorage, updated_at: new Date().toISOString(), ...(title ? { title } : {}) }).eq('id', conversationId)
      return conversationId
    } else {
      const { data } = await supabase.from('sage_conversations').insert({ user_id: userId, company_id: companyId, title: title || 'New Conversation', messages: messagesForStorage }).select().single()
      if (data) { setConversations(prev => [{ ...data, messages: msgs }, ...prev]); return data.id }
      return null
    }
  }

  const generateTitle = (content: string): string => content.split(' ').slice(0, 6).join(' ').slice(0, 40)

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(file => {
      if (file.size > 10 * 1024 * 1024) { alert('File too large. Max 10MB.'); return }
      const reader = new FileReader()
      reader.onload = (e) => {
        setAttachments(prev => [...prev, { id: `att_${Date.now()}_${Math.random()}`, name: file.name, type: file.type, size: file.size, content: e.target?.result as string }])
      }
      if (file.type.startsWith('image/')) reader.readAsDataURL(file)
      else reader.readAsText(file)
    })
  }

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); handleFileSelect(e.dataTransfer.files) }, [])
  const removeAttachment = (id: string) => setAttachments(prev => prev.filter(a => a.id !== id))

  const sendMessage = async (content: string) => {
    if ((!content.trim() && attachments.length === 0) || loading) return
    const userMessage: Message = { id: `user_${Date.now()}`, role: 'user', content: content.trim(), timestamp: new Date(), attachments: attachments.length > 0 ? [...attachments] : undefined }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setAttachments([])
    setLoading(true)

    try {
      let dataContext = companyData && kpis ? buildDataContext(companyData, kpis) : 'No company data available.'
      if (userMessage.attachments) {
        dataContext += '\n\n=== ATTACHED FILES ===\n'
        userMessage.attachments.forEach(att => {
          if (att.type.startsWith('image/')) dataContext += `• Image: ${att.name} (${formatFileSize(att.size)})\n`
          else dataContext += `• File: ${att.name}\nContent:\n${att.content?.slice(0, 5000) || '[Unable to read]'}\n\n`
        })
      }
      
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages.map(m => ({ role: m.role, content: m.content })), systemPrompt: SYSTEM_PROMPT, dataContext })
      })
      if (!response.ok) throw new Error('Failed to get AI response')
      const data = await response.json()
      
      const assistantMessage: Message = { id: `assistant_${Date.now()}`, role: 'assistant', content: data.content, timestamp: new Date() }
      const finalMessages = [...newMessages, assistantMessage]
      setMessages(finalMessages)
      
      const title = messages.length === 0 ? generateTitle(content) : undefined
      const savedId = await saveConversation(finalMessages, currentConversationId, title)
      if (savedId && !currentConversationId) setCurrentConversationId(savedId)
      if (currentConversationId) setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: finalMessages, updated_at: new Date().toISOString() } : c))
    } catch (error) {
      console.error('Error:', error)
      setMessages(prev => [...prev, { id: `error_${Date.now()}`, role: 'assistant', content: "I apologize, but I encountered an error. Please try again.", timestamp: new Date() }])
    } finally { setLoading(false) }
  }

  const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => sendMessage(action.label)
  const handleKeyPress = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }
  const startNewConversation = () => { setCurrentConversationId(null); setMessages([]) }
  const loadConversation = (conversation: Conversation) => { setCurrentConversationId(conversation.id); setMessages(conversation.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) }))) }
  const deleteConversation = async (id: string) => { await supabase.from('sage_conversations').delete().eq('id', id); setConversations(prev => prev.filter(c => c.id !== id)); if (currentConversationId === id) startNewConversation() }
  const renameConversation = async (id: string, title: string) => { await supabase.from('sage_conversations').update({ title }).eq('id', id); setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c)) }

  const hasMessages = messages.length > 0

  if (dataLoading) return <div className="flex items-center justify-center h-[calc(100vh-120px)]"><RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" /></div>

  return (
    <div className="flex h-[calc(100vh-80px)]">
      {/* Collapsible Sidebar */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-0'} border-r border-slate-700/50 bg-slate-900/50 flex flex-col transition-all duration-300 overflow-hidden`}>
        <div className="p-4 border-b border-slate-700/50 flex items-center gap-2">
          <button onClick={startNewConversation} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors">
            <Plus size={18} /> New Chat
          </button>
          <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors" title="Collapse sidebar">
            <PanelLeftClose size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-1">
            {conversations.map(c => <ConversationItem key={c.id} conversation={c} isActive={c.id === currentConversationId} onClick={() => loadConversation(c)} onDelete={() => deleteConversation(c.id)} onRename={(title) => renameConversation(c.id, title)} />)}
          </div>
          {conversations.length === 0 && <p className="text-sm text-slate-500 text-center py-8">No conversations yet</p>}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative" onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors" title="Open sidebar">
                <PanelLeft size={18} />
              </button>
            )}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 flex items-center justify-center">
              <SageLogo size={28} />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-100">Sage</h1>
              <p className="text-xs text-slate-400">Financial Intelligence Partner</p>
            </div>
          </div>
          <button onClick={startNewConversation} className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors" title="New conversation">
            <Plus size={18} />
          </button>
        </div>

        {/* Drop Zone Overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-slate-900/90 z-50 flex items-center justify-center border-2 border-dashed border-emerald-500 m-4 rounded-xl">
            <div className="text-center">
              <Paperclip size={48} className="mx-auto text-emerald-400 mb-4" />
              <p className="text-xl text-slate-200">Drop files here</p>
              <p className="text-sm text-slate-400 mt-2">Images, CSV, Excel, PDF, Text</p>
            </div>
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
              <p className="text-slate-400 text-center mb-8 max-w-lg">Your AI financial intelligence partner. Ask questions, request charts, or upload files for analysis.</p>
              
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-8 max-w-3xl w-full">
                {QUICK_ACTIONS.map((action, i) => <QuickActionButton key={i} action={action} onClick={() => handleQuickAction(action)} />)}
              </div>

              <div className="w-full max-w-2xl">
                <div className="relative">
                  <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyPress} placeholder="Ask Sage about your finances..." rows={1} className="w-full bg-slate-800/80 border border-slate-600/50 rounded-2xl pl-5 pr-28 py-4 text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-base" style={{ minHeight: '64px', maxHeight: '200px' }} />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                    <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-slate-200 transition-colors" title="Attach file">
                      <Paperclip size={18} />
                    </button>
                    <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading} className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:cursor-not-allowed flex items-center justify-center transition-colors">
                      {loading ? <RefreshCw size={18} className="text-white animate-spin" /> : <Send size={18} className="text-white" />}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-3 text-center">Enter to send • Drop files to attach • Ask for charts</p>
              </div>
            </div>
          ) : (
            <div className="py-6 px-4 space-y-6">
              {messages.map(message => <ChatMessage key={message.id} message={message} />)}
              {loading && (
                <div className="flex gap-4 max-w-4xl mx-auto">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 flex items-center justify-center"><SageLogo size={24} /></div>
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
            {attachments.length > 0 && (
              <div className="max-w-4xl mx-auto mb-3 flex flex-wrap gap-2">
                {attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg text-sm">
                    {att.type.startsWith('image/') ? <ImageIcon size={14} className="text-slate-400" /> : <FileText size={14} className="text-slate-400" />}
                    <span className="text-slate-200 truncate max-w-[150px]">{att.name}</span>
                    <button onClick={() => removeAttachment(att.id)} className="text-slate-400 hover:text-red-400"><XCircle size={14} /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="max-w-4xl mx-auto relative">
              <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyPress} placeholder="Ask a follow-up question..." rows={1} className="w-full bg-slate-800/80 border border-slate-600/50 rounded-2xl pl-5 pr-28 py-4 text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50" style={{ minHeight: '60px', maxHeight: '200px' }} />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-slate-200 transition-colors" title="Attach file">
                  <Paperclip size={18} />
                </button>
                <button onClick={() => sendMessage(input)} disabled={(!input.trim() && attachments.length === 0) || loading} className="w-10 h-10 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-700 disabled:cursor-not-allowed flex items-center justify-center transition-colors">
                  {loading ? <RefreshCw size={18} className="text-white animate-spin" /> : <Send size={18} className="text-white" />}
                </button>
              </div>
            </div>
          </div>
        )}

        <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.csv,.xlsx,.xls,.txt,.json" onChange={(e) => handleFileSelect(e.target.files)} className="hidden" />
      </div>
    </div>
  )
}
