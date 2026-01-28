'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  Send, Bot, User, TrendingUp, TrendingDown, DollarSign, 
  AlertTriangle, BarChart3, RefreshCw, Users, FileText, ExternalLink,
  ChevronRight, Brain, Trash2, Sparkles
} from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// ============ TYPES ============
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  data?: any
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
  { label: "How's team utilization?", icon: Users },
]

// ============ SYSTEM PROMPT ============
const SYSTEM_PROMPT = `You are the Vantage AI Financial Assistant - a sophisticated AI agent designed to help finance teams make better decisions. You have access to the company's complete financial data including transactions, invoices, projects, clients, team members, and time entries.

Your capabilities:
1. ANALYZE - Calculate KPIs, identify trends, explain variances
2. FORECAST - Build projections and scenarios
3. ALERT - Proactively flag risks and opportunities
4. ADVISE - Challenge assumptions and suggest improvements
5. NAVIGATE - Deep link to relevant app features

Personality:
- Be conversational but professional
- Be concise - finance people are busy
- Challenge assumptions constructively
- Proactively share relevant insights
- Use specific numbers from the data
- Format currency properly ($X,XXX)
- When showing percentages, always provide context

Always ground your responses in the actual data provided. If data is insufficient, say so clearly.`

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

function getTopClients(data: CompanyData, limit = 5): any[] {
  const clientRevenue: Record<string, { name: string, revenue: number, cost: number }> = {}
  
  data.invoices?.forEach(inv => {
    const clientId = inv.client_id
    const client = data.clients?.find(c => c.id === clientId)
    if (!clientRevenue[clientId]) {
      clientRevenue[clientId] = { name: client?.name || 'Unknown', revenue: 0, cost: 0 }
    }
    clientRevenue[clientId].revenue += inv.amount || 0
  })
  
  data.timeEntries?.forEach(entry => {
    const project = data.projects?.find(p => p.id === entry.project_id)
    if (project?.client_id && clientRevenue[project.client_id]) {
      const team = data.teamMembers?.find(t => t.id === entry.team_member_id)
      clientRevenue[project.client_id].cost += (entry.hours || 0) * (team?.cost_rate || 50)
    }
  })
  
  return Object.entries(clientRevenue)
    .map(([id, data]) => ({
      id,
      ...data,
      profit: data.revenue - data.cost,
      margin: data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0
    }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, limit)
}

function buildDataContext(data: CompanyData, kpis: KPISummary): string {
  const aging = getARAgingSummary(data.invoices)
  const topClients = getTopClients(data)
  
  return `
CURRENT DATA SNAPSHOT (as of ${new Date().toLocaleDateString()}):

KEY METRICS:
- Total Revenue (YTD): ${formatCurrency(kpis.totalRevenue)}
- Total Expenses (YTD): ${formatCurrency(kpis.totalExpenses)}
- Net Income: ${formatCurrency(kpis.netIncome)}
- Gross Margin: ${formatPercent(kpis.grossMargin)}
- Cash on Hand: ${formatCurrency(kpis.cashOnHand)}
- Monthly Burn Rate: ${formatCurrency(kpis.burnRate)}
- Cash Runway: ${kpis.runway.toFixed(1)} months
- Utilization Rate: ${formatPercent(kpis.utilizationRate)}
- Days Sales Outstanding: ${kpis.dso.toFixed(0)} days

AR AGING:
- Current: ${formatCurrency(aging.current)}
- 1-30 Days: ${formatCurrency(aging.days30)}
- 31-60 Days: ${formatCurrency(aging.days60)}
- 61-90 Days: ${formatCurrency(aging.days90)}
- 90+ Days: ${formatCurrency(aging.over90)}
- Total AR: ${formatCurrency(kpis.arOutstanding)}

TOP CLIENTS BY PROFITABILITY:
${topClients.map((c, i) => `${i + 1}. ${c.name}: ${formatCurrency(c.profit)} profit (${formatPercent(c.margin)} margin)`).join('\n')}

SUMMARY STATS:
- Active Projects: ${data.projects?.length || 0}
- Active Clients: ${data.clients?.length || 0}
- Team Members: ${data.teamMembers?.length || 0}
- Pending Invoices: ${data.invoices?.filter(i => i.status === 'pending').length || 0}
`
}

// ============ COMPONENTS ============
function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  
  return (
    <div className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''} max-w-4xl mx-auto`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-blue-500' : 'bg-gradient-to-br from-purple-500 to-blue-500'
      }`}>
        {isUser ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
      </div>
      
      <div className={`flex-1 ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block rounded-2xl px-5 py-3 max-w-[85%] ${
          isUser 
            ? 'bg-blue-500 text-white rounded-tr-md' 
            : 'bg-slate-800 text-slate-100 rounded-tl-md border border-slate-700'
        }`}>
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content.split('\n').map((line, i) => {
              if (line.includes('[View') || line.includes('→]')) {
                const linkMatch = line.match(/\[(.*?)\s*→\]/)
                if (linkMatch) {
                  return (
                    <p key={i} className="my-1">
                      <Link 
                        href={line.includes('Forecast') ? '/forecast' : line.includes('Report') ? '/reports' : '/clients'}
                        className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                      >
                        {linkMatch[1]} <ExternalLink size={12} />
                      </Link>
                    </p>
                  )
                }
              }
              if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
                return <p key={i} className="my-0.5 pl-2">• {line.slice(2)}</p>
              }
              if (/^\d+\.\s/.test(line.trim())) {
                return <p key={i} className="my-0.5 pl-2">{line}</p>
              }
              const boldProcessed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              return <p key={i} className="my-1" dangerouslySetInnerHTML={{ __html: boldProcessed }} />
            })}
          </div>
          
          {message.data?.links && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.data.links.map((link: any, i: number) => (
                <Link
                  key={i}
                  href={link.href}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/30 transition-colors"
                >
                  {link.label} <ChevronRight size={12} />
                </Link>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-1.5 px-2">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
      className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 hover:bg-slate-700/80 hover:border-slate-600 transition-all text-sm text-slate-300"
    >
      <Icon size={16} className="text-slate-400" />
      {action.label}
    </button>
  )
}

// ============ MAIN PAGE ============
export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [companyData, setCompanyData] = useState<CompanyData | null>(null)
  const [kpis, setKpis] = useState<KPISummary | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  // Load company data
  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setDataLoading(false)
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single()

        if (profile?.company_id) {
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
        }
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setDataLoading(false)
      }
    }
    loadData()
  }, [])

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return
    
    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date()
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const dataContext = companyData && kpis ? buildDataContext(companyData, kpis) : 'No company data available.'
      
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: content.trim() }
          ],
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
      setMessages(prev => [...prev, assistantMessage])
      
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

  const clearChat = () => {
    setMessages([])
  }

  const hasMessages = messages.length > 0

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Header - Only show when there are messages */}
      {hasMessages && (
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <Brain size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-slate-100">AI Assistant</h1>
            </div>
          </div>
          <button 
            onClick={clearChat}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="New chat"
          >
            <Trash2 size={18} />
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          /* Empty State - Centered like Claude */
          <div className="h-full flex flex-col items-center justify-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mb-6">
              <Brain size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-semibold text-slate-100 mb-2">Vantage AI Assistant</h1>
            <p className="text-slate-400 text-center mb-8 max-w-md">
              Your financial intelligence partner. Ask questions about your data, get insights, and make better decisions.
            </p>
            
            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-3 mb-8 max-w-xl">
              {QUICK_ACTIONS.map((action, i) => (
                <QuickActionButton key={i} action={action} onClick={() => handleQuickAction(action)} />
              ))}
            </div>

            {/* Centered Input */}
            <div className="w-full max-w-2xl">
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask about your finances..."
                  rows={1}
                  className="w-full bg-slate-800 border border-slate-600 rounded-2xl pl-5 pr-14 py-5 text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                  style={{ minHeight: '72px', maxHeight: '200px' }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-slate-700 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
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
          /* Messages List */
          <div className="py-6 px-4 space-y-6">
            {messages.map(message => (
              <ChatMessage key={message.id} message={message} />
            ))}
            
            {loading && (
              <div className="flex gap-4 max-w-4xl mx-auto">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <Bot size={16} className="text-white" />
                </div>
                <div className="bg-slate-800 rounded-2xl rounded-tl-md px-5 py-3 border border-slate-700">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-sm text-slate-400">Analyzing...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Bottom Input - Only show when there are messages */}
      {hasMessages && (
        <div className="border-t border-slate-700 px-4 py-5 bg-slate-900/80">
          <div className="max-w-4xl mx-auto relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask a follow-up question..."
              rows={1}
              className="w-full bg-slate-800 border border-slate-600 rounded-2xl pl-5 pr-14 py-5 text-slate-100 placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              style={{ minHeight: '72px', maxHeight: '200px' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-slate-700 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
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
  )
}
