/**
 * Agent: Cash Flow Forecaster
 * 
 * Builds rolling 13-week cash flow forecast from:
 * - QB actuals (recent transaction patterns)
 * - Open AR (invoices outstanding)
 * - Upcoming contractor payments (approved invoices)
 * - Pipeline data (project contracts)
 * 
 * Uses: Claude (analysis/forecasting) with OpenAI fallback.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { aiRequest } from '@/lib/ai-router'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Types ───────────────────────────────────────────────────────────────────

interface WeekForecast {
  week_number: number
  week_start: string
  week_end: string
  inflows: {
    ar_collections: number
    recurring_revenue: number
    other: number
    total: number
  }
  outflows: {
    contractor_payments: number
    operating_expenses: number
    payroll: number
    other: number
    total: number
  }
  net_cash_flow: number
  running_balance: number
  confidence: 'high' | 'medium' | 'low'
}

interface ForecastReport {
  generated_at: string
  current_cash: number
  forecast_weeks: WeekForecast[]
  summary: {
    total_inflows: number
    total_outflows: number
    net_change: number
    ending_balance: number
    lowest_balance: number
    lowest_balance_week: number
    runway_weeks: number | null
  }
  alerts: {
    type: 'cash_low' | 'negative_balance' | 'large_outflow' | 'collection_risk'
    severity: 'info' | 'warning' | 'critical'
    message: string
    week?: number
  }[]
  ai_analysis: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeekDates(weeksFromNow: number): { start: string; end: string } {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + (weeksFromNow * 7))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return { start: fmt(monday), end: fmt(sunday) }
}

function weeksUntilDate(dateStr: string): number {
  const target = new Date(dateStr)
  const now = new Date()
  const diffMs = target.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)))
}

// ─── Core Logic ──────────────────────────────────────────────────────────────

async function buildForecast(companyId: string, cashThreshold?: number): Promise<ForecastReport> {
  const WEEKS = 13

  // 1. Get current cash position from recent transactions
  const { data: recentTxns } = await supabase
    .from('transactions')
    .select('amount, date, category, type, description')
    .eq('company_id', companyId)
    .order('date', { ascending: false })
    .limit(500)

  // Calculate current approximate cash (sum of all transactions)
  const { data: cashBalance } = await supabase
    .from('transactions')
    .select('amount')
    .eq('company_id', companyId)

  const currentCash = (cashBalance || []).reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0)

  // 2. Get historical weekly patterns (last 12 weeks)
  const twelveWeeksAgo = new Date()
  twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84)
  
  const { data: historicalTxns } = await supabase
    .from('transactions')
    .select('amount, date, category, type')
    .eq('company_id', companyId)
    .gte('date', twelveWeeksAgo.toISOString().split('T')[0])
    .order('date', { ascending: true })

  // Calculate weekly averages by category
  const weeklyAvgs: Record<string, number> = {}
  const weeklyCounts: Record<string, number> = {}
  ;(historicalTxns || []).forEach(t => {
    const cat = t.category || 'other'
    const amt = parseFloat(t.amount) || 0
    weeklyAvgs[cat] = (weeklyAvgs[cat] || 0) + amt
    weeklyCounts[cat] = (weeklyCounts[cat] || 0) + 1
  })
  // Average per week (12 weeks of history)
  Object.keys(weeklyAvgs).forEach(cat => {
    weeklyAvgs[cat] = weeklyAvgs[cat] / 12
  })

  // 3. Get open AR (unpaid invoices)
  const { data: openInvoices } = await supabase
    .from('invoices')
    .select('id, amount, due_date, client_id, status')
    .eq('company_id', companyId)
    .in('status', ['sent', 'pending', 'overdue'])

  // 4. Get approved contractor invoices (upcoming payments)
  const { data: contractorPayments } = await supabase
    .from('contractor_invoices')
    .select('id, total_amount, status, period_end, member_id')
    .in('status', ['approved', 'submitted'])

  // 5. Get active contractors for recurring cost estimation
  const { data: activeContractors } = await supabase
    .from('team_members')
    .select('id, name, cost_type, cost_amount')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .in('employment_type', ['1099', 'contractor'])

  // Monthly contractor costs
  const monthlyContractorCost = (activeContractors || []).reduce((sum, c) => {
    if (c.cost_type === 'monthly_fixed') return sum + (c.cost_amount || 0)
    if (c.cost_type === 'hourly') return sum + ((c.cost_amount || 0) * 160) // Estimate 160h/mo
    return sum
  }, 0)
  const weeklyContractorCost = monthlyContractorCost / 4.33

  // 6. Build 13-week forecast
  const forecastWeeks: WeekForecast[] = []
  let runningBalance = currentCash
  const threshold = cashThreshold || 50000

  for (let w = 0; w < WEEKS; w++) {
    const weekDates = getWeekDates(w)
    
    // AR collections expected this week
    const arThisWeek = (openInvoices || [])
      .filter(inv => {
        if (!inv.due_date) return false
        const weeksUntil = weeksUntilDate(inv.due_date)
        return weeksUntil >= w && weeksUntil < w + 1
      })
      .reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0)

    // Contractor payments expected this week (approved invoices)
    const contractorPmtsThisWeek = w === 0
      ? (contractorPayments || [])
          .filter(p => p.status === 'approved')
          .reduce((sum, p) => sum + (p.total_amount || 0), 0)
      : weeklyContractorCost

    // Revenue estimate from historical patterns
    const recurringRevenue = w <= 2
      ? (weeklyAvgs['revenue'] || 0)
      : (weeklyAvgs['revenue'] || 0) * 0.9 // Slight discount for uncertainty

    // Operating expenses from historical patterns
    const opex = Math.abs(weeklyAvgs['opex'] || 0)
    const overhead = Math.abs(weeklyAvgs['overhead'] || 0)
    
    const inflows = {
      ar_collections: arThisWeek,
      recurring_revenue: w > 0 ? recurringRevenue : 0, // Week 0 uses actuals
      other: 0,
      total: arThisWeek + (w > 0 ? recurringRevenue : 0)
    }

    const outflows = {
      contractor_payments: contractorPmtsThisWeek,
      operating_expenses: opex,
      payroll: overhead,
      other: 0,
      total: contractorPmtsThisWeek + opex + overhead
    }

    const netCashFlow = inflows.total - outflows.total
    runningBalance += netCashFlow

    // Confidence degrades with distance
    const confidence: 'high' | 'medium' | 'low' = 
      w <= 2 ? 'high' : w <= 6 ? 'medium' : 'low'

    forecastWeeks.push({
      week_number: w + 1,
      week_start: weekDates.start,
      week_end: weekDates.end,
      inflows,
      outflows,
      net_cash_flow: Math.round(netCashFlow * 100) / 100,
      running_balance: Math.round(runningBalance * 100) / 100,
      confidence,
    })
  }

  // 7. Calculate summary
  const totalInflows = forecastWeeks.reduce((s, w) => s + w.inflows.total, 0)
  const totalOutflows = forecastWeeks.reduce((s, w) => s + w.outflows.total, 0)
  const lowestBalance = Math.min(...forecastWeeks.map(w => w.running_balance))
  const lowestWeek = forecastWeeks.findIndex(w => w.running_balance === lowestBalance) + 1

  // Runway: weeks until cash runs out (if trend is negative)
  const avgWeeklyNet = (totalInflows - totalOutflows) / WEEKS
  const runwayWeeks = avgWeeklyNet < 0 ? Math.floor(currentCash / Math.abs(avgWeeklyNet)) : null

  // 8. Generate alerts
  const alerts: ForecastReport['alerts'] = []

  if (lowestBalance < 0) {
    alerts.push({
      type: 'negative_balance',
      severity: 'critical',
      message: `Projected negative balance of $${Math.round(lowestBalance).toLocaleString()} in week ${lowestWeek}.`,
      week: lowestWeek,
    })
  } else if (lowestBalance < threshold) {
    alerts.push({
      type: 'cash_low',
      severity: 'warning',
      message: `Cash projected to drop below $${threshold.toLocaleString()} threshold in week ${lowestWeek} ($${Math.round(lowestBalance).toLocaleString()}).`,
      week: lowestWeek,
    })
  }

  // Large single-week outflows
  forecastWeeks.forEach(w => {
    if (w.outflows.total > currentCash * 0.25) {
      alerts.push({
        type: 'large_outflow',
        severity: 'warning',
        message: `Week ${w.week_number}: Large outflow of $${Math.round(w.outflows.total).toLocaleString()} (${Math.round(w.outflows.total / currentCash * 100)}% of current cash).`,
        week: w.week_number,
      })
    }
  })

  // Overdue AR
  const overdueAR = (openInvoices || []).filter(inv => inv.status === 'overdue')
  if (overdueAR.length > 0) {
    const overdueTotal = overdueAR.reduce((s, inv) => s + (parseFloat(inv.amount) || 0), 0)
    alerts.push({
      type: 'collection_risk',
      severity: 'warning',
      message: `${overdueAR.length} overdue invoices totaling $${Math.round(overdueTotal).toLocaleString()}. Collection delays could impact forecast.`,
    })
  }

  // 9. AI analysis
  let aiAnalysis = ''
  try {
    const aiResult = await aiRequest({
      messages: [{
        role: 'user',
        content: `Analyze this 13-week cash flow forecast for an Owner's Representative consulting firm.

CURRENT CASH: $${Math.round(currentCash).toLocaleString()}
PERIOD: ${forecastWeeks[0]?.week_start} to ${forecastWeeks[WEEKS - 1]?.week_end}

13-WEEK PROJECTION:
${forecastWeeks.map(w => `Wk${w.week_number}: In $${Math.round(w.inflows.total).toLocaleString()} / Out $${Math.round(w.outflows.total).toLocaleString()} / Net $${Math.round(w.net_cash_flow).toLocaleString()} / Balance $${Math.round(w.running_balance).toLocaleString()} [${w.confidence}]`).join('\n')}

KEY NUMBERS:
- Total inflows: $${Math.round(totalInflows).toLocaleString()}
- Total outflows: $${Math.round(totalOutflows).toLocaleString()}
- Lowest balance: $${Math.round(lowestBalance).toLocaleString()} (week ${lowestWeek})
- Monthly contractor costs: $${Math.round(monthlyContractorCost).toLocaleString()}
${runwayWeeks ? `- Cash runway: ~${runwayWeeks} weeks at current burn` : '- Cash position stable at current trajectory'}

OVERDUE AR: $${Math.round(overdueAR.reduce((s, inv) => s + (parseFloat(inv.amount) || 0), 0)).toLocaleString()} across ${overdueAR.length} invoices

Give a concise CFO-level briefing (4-6 sentences). Highlight the 1-2 most important actions to take this week. Focus on cash preservation and collection acceleration if needed.`
      }],
      systemPrompt: 'You are a fractional CFO advising the owner of a consulting firm. Be direct, use specific numbers, and prioritize actionable recommendations. Think like a Goldman Sachs VP reviewing a portfolio company.',
      taskType: 'forecast',
      maxTokens: 600,
    })
    aiAnalysis = aiResult.content
  } catch (err) {
    aiAnalysis = `Current cash: $${Math.round(currentCash).toLocaleString()}. 13-week net: $${Math.round(totalInflows - totalOutflows).toLocaleString()}. Lowest projected balance: $${Math.round(lowestBalance).toLocaleString()} in week ${lowestWeek}.`
  }

  return {
    generated_at: new Date().toISOString(),
    current_cash: Math.round(currentCash * 100) / 100,
    forecast_weeks: forecastWeeks,
    summary: {
      total_inflows: Math.round(totalInflows * 100) / 100,
      total_outflows: Math.round(totalOutflows * 100) / 100,
      net_change: Math.round((totalInflows - totalOutflows) * 100) / 100,
      ending_balance: Math.round(forecastWeeks[WEEKS - 1]?.running_balance * 100) / 100,
      lowest_balance: Math.round(lowestBalance * 100) / 100,
      lowest_balance_week: lowestWeek,
      runway_weeks: runwayWeeks,
    },
    alerts,
    ai_analysis: aiAnalysis,
  }
}

// ─── API Route ───────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { action, companyId, cashThreshold } = await request.json()

    if (!companyId) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 })
    }

    if (action === 'forecast') {
      const report = await buildForecast(companyId, cashThreshold)
      return NextResponse.json(report)
    }

    if (action === 'alerts-only') {
      const report = await buildForecast(companyId, cashThreshold)
      return NextResponse.json({
        current_cash: report.current_cash,
        alerts: report.alerts,
        ai_analysis: report.ai_analysis,
        summary: report.summary,
      })
    }

    return NextResponse.json({ error: 'Invalid action. Use: forecast or alerts-only' }, { status: 400 })

  } catch (error) {
    console.error('[Agent: Cash Flow Forecaster]', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
