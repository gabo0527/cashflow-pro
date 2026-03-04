/**
 * Agent Dispatcher
 * 
 * Detects agent-triggering intents from user messages and executes
 * the appropriate agent endpoint. Used by Sage to bridge chat → agents.
 * 
 * Pattern: Sage detects intent → dispatcher calls agent → formats response
 */

// ─── Agent Registry ──────────────────────────────────────────────────────────

export interface AgentDef {
  id: string
  name: string
  description: string
  endpoint: string
  triggers: string[]           // Keywords/phrases that activate this agent
  actions: {
    id: string
    label: string
    description: string
  }[]
}

export const AGENTS: AgentDef[] = [
  {
    id: 'invoice-validator',
    name: 'Invoice Validator',
    description: 'Validates contractor invoices against time entries. Auto-approves clean ones, flags discrepancies.',
    endpoint: '/api/agents/invoice-validator',
    triggers: ['validate invoice', 'check invoice', 'review invoice', 'invoice validation', 'verify invoice', 'approve invoice', 'pending invoices', 'validate all invoices'],
    actions: [
      { id: 'validate-pending', label: 'Validate All Pending', description: 'Validate all submitted invoices' },
      { id: 'validate', label: 'Validate Single', description: 'Validate a specific invoice by ID' },
      { id: 'validate-batch', label: 'Validate Batch', description: 'Validate multiple invoices' },
    ],
  },
  {
    id: 'timesheet-reconciler',
    name: 'Timesheet Reconciler',
    description: 'Compares contractor hours vs project budgets. Flags missing timesheets, overruns, drafts reminders.',
    endpoint: '/api/agents/timesheet-reconciler',
    triggers: ['reconcile timesheet', 'timesheet check', 'missing timesheet', 'who submitted', 'timesheet status', 'hours check', 'budget check', 'timesheet reminder', 'weekly reconciliation'],
    actions: [
      { id: 'reconcile', label: 'Full Reconciliation', description: 'Complete weekly timesheet reconciliation' },
      { id: 'missing-report', label: 'Missing Report', description: 'Show who hasn\'t submitted timesheets' },
      { id: 'budget-check', label: 'Budget Check', description: 'Check project budget burn rates' },
    ],
  },
  {
    id: 'expense-categorizer',
    name: 'Expense Categorizer',
    description: 'Auto-categorizes uncategorized bank transactions using AI. Learns from existing patterns.',
    endpoint: '/api/agents/expense-categorizer',
    triggers: ['categorize expense', 'categorize transaction', 'auto categorize', 'bulk categorize', 'uncategorized transaction', 'expense categorization', 'classify expense', 'sort transaction'],
    actions: [
      { id: 'categorize-pending', label: 'Categorize All Pending', description: 'Auto-categorize all uncategorized transactions' },
      { id: 'preview', label: 'Preview', description: 'Preview categorizations without applying' },
      { id: 'categorize', label: 'Categorize Specific', description: 'Categorize specific transactions' },
    ],
  },
  {
    id: 'project-health',
    name: 'Project Health Monitor',
    description: 'Tracks burn rate vs budget, margin erosion, scope creep. Green/yellow/red status per project.',
    endpoint: '/api/project-health',
    triggers: ['project health', 'project status', 'health report', 'health check', 'burn rate', 'project monitor', 'scope creep', 'margin erosion', 'project risk', 'weekly digest'],
    actions: [
      { id: 'full-report', label: 'Full Health Report', description: 'Complete portfolio health assessment' },
      { id: 'digest', label: 'Quick Digest', description: 'AI-generated weekly summary with flagged projects' },
    ],
  },
  {
    id: 'cashflow-forecaster',
    name: 'Cash Flow Forecaster',
    description: 'Projects future cash position based on AR, AP, recurring costs, and revenue pipeline.',
    endpoint: '/api/agents/cashflow-forecaster',
    triggers: ['cash flow forecast', 'forecast cash', 'cash projection', 'runway', 'cash position', 'forecast revenue', 'project cash'],
    actions: [
      { id: 'forecast', label: 'Generate Forecast', description: 'Build cash flow projection' },
    ],
  },
]

// ─── Intent Detection ────────────────────────────────────────────────────────

export interface DetectedIntent {
  agent: AgentDef
  action: string
  confidence: number
  extractedParams: Record<string, any>
}

/**
 * Detect which agent (if any) should handle a user message.
 * Uses keyword matching first (fast), returns null if no match.
 */
export function detectAgentIntent(message: string): DetectedIntent | null {
  const lower = message.toLowerCase().trim()

  let bestMatch: { agent: AgentDef; score: number } | null = null

  for (const agent of AGENTS) {
    for (const trigger of agent.triggers) {
      // Check for trigger phrase presence
      if (lower.includes(trigger)) {
        const score = trigger.length / lower.length // Longer trigger match = higher confidence
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { agent, score }
        }
      }
    }
  }

  if (!bestMatch) return null

  // Determine which action based on message content
  const action = inferAction(bestMatch.agent, lower)
  const params = extractParams(lower)

  return {
    agent: bestMatch.agent,
    action,
    confidence: Math.min(bestMatch.score + 0.3, 1.0), // Boost base confidence
    extractedParams: params,
  }
}

function inferAction(agent: AgentDef, message: string): string {
  // Agent-specific action inference
  switch (agent.id) {
    case 'invoice-validator':
      if (message.includes('all') || message.includes('pending')) return 'validate-pending'
      if (message.includes('batch')) return 'validate-batch'
      return 'validate-pending' // Default to all pending

    case 'timesheet-reconciler':
      if (message.includes('missing') || message.includes('who')) return 'missing-report'
      if (message.includes('budget') || message.includes('burn')) return 'budget-check'
      return 'reconcile' // Default to full reconciliation

    case 'expense-categorizer':
      if (message.includes('preview')) return 'preview'
      if (message.includes('all') || message.includes('pending') || message.includes('bulk')) return 'categorize-pending'
      return 'preview' // Default to preview (safer)

    case 'project-health':
      if (message.includes('digest') || message.includes('summary') || message.includes('quick')) return 'digest'
      return 'full-report'

    case 'cashflow-forecaster':
      return 'forecast'

    default:
      return agent.actions[0]?.id || 'default'
  }
}

function extractParams(message: string): Record<string, any> {
  const params: Record<string, any> = {}

  // Extract "last week" / "this week" / "2 weeks ago"
  const weeksMatch = message.match(/(\d+)\s*weeks?\s*ago/)
  if (weeksMatch) params.weeksAgo = parseInt(weeksMatch[1])
  else if (message.includes('last week')) params.weeksAgo = 1
  else if (message.includes('this week')) params.weeksAgo = 0

  // Extract threshold (e.g., "above 80% confidence")
  const thresholdMatch = message.match(/(\d+)%?\s*(?:confidence|threshold)/)
  if (thresholdMatch) params.autoApplyThreshold = parseInt(thresholdMatch[1]) / 100

  return params
}

// ─── Agent Execution ─────────────────────────────────────────────────────────

/**
 * Execute an agent action. Calls the agent's API endpoint internally.
 * 
 * @param baseUrl - The app's base URL (from request headers)
 * @param intent - The detected intent
 * @param companyId - The user's company ID
 */
export async function executeAgent(
  baseUrl: string,
  intent: DetectedIntent,
  companyId: string
): Promise<{ success: boolean; data: any; error?: string }> {
  try {
    const url = `${baseUrl}${intent.agent.endpoint}`

    const body: Record<string, any> = {
      action: intent.action,
      companyId,
      ...intent.extractedParams,
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }))
      return { success: false, data: null, error: err.error || `Agent returned ${response.status}` }
    }

    const data = await response.json()
    return { success: true, data }

  } catch (err) {
    return { success: false, data: null, error: (err as Error).message }
  }
}

// ─── Response Formatting ─────────────────────────────────────────────────────

/**
 * Format agent results into a conversational response for Sage.
 */
export function formatAgentResponse(agentId: string, action: string, data: any): string {
  switch (agentId) {

    case 'invoice-validator': {
      if (action === 'validate-pending' || action === 'validate-batch') {
        const s = data.summary
        const flagged = (data.results || []).filter((r: any) => r.status === 'discrepancy')
        let msg = `**Invoice Validation Complete**\n\n`
        msg += `• ${s.total} invoices reviewed\n`
        msg += `• ${s.auto_approved} auto-approved (clean match)\n`
        msg += `• ${s.needs_review} flagged for review\n`
        msg += `• ${s.errors} errors\n`

        if (flagged.length > 0) {
          msg += `\n**Flagged Invoices:**\n`
          flagged.forEach((r: any) => {
            msg += `\n→ **${r.invoice_number}** (${r.contractor_name})\n`
            msg += `  Invoiced: $${r.total_invoiced.toLocaleString()} vs Expected: $${r.total_expected.toLocaleString()} (${r.variance_pct.toFixed(1)}% variance)\n`
            r.issues.forEach((i: any) => {
              msg += `  ⚠️ ${i.description}\n`
            })
            msg += `  Recommendation: ${r.recommendation}\n`
          })
        }
        return msg
      }

      // Single validation
      const r = data
      let msg = `**Invoice ${r.invoice_number}** (${r.contractor_name})\n\n`
      msg += `Status: ${r.status === 'clean' ? '✅ Clean' : '⚠️ Discrepancy'}\n`
      msg += `Invoiced: $${r.total_invoiced.toLocaleString()} | Expected: $${r.total_expected.toLocaleString()}\n`
      if (r.issues.length > 0) {
        msg += `\nIssues:\n`
        r.issues.forEach((i: any) => { msg += `• ${i.description}\n` })
      }
      msg += `\n${r.recommendation}`
      return msg
    }

    case 'timesheet-reconciler': {
      if (action === 'reconcile') {
        const ts = data.team_summary
        let msg = `**Timesheet Reconciliation — ${data.week.start} to ${data.week.end}**\n\n`
        msg += `• ${ts.submitted}/${ts.total_members} submitted\n`
        msg += `• ${ts.missing} missing, ${ts.partial} partial\n`
        msg += `• ${ts.total_hours} total hours logged\n`

        if (data.budget_alerts.length > 0) {
          msg += `\n**Budget Alerts:**\n`
          data.budget_alerts.forEach((b: any) => {
            const icon = b.status === 'over_budget' ? '🔴' : '🟡'
            msg += `${icon} ${b.project_name} (${b.client_name}): ${b.hours_used}/${b.budget_hours}h (${b.burn_pct}%)\n`
          })
        }

        if (data.reminders.length > 0) {
          msg += `\n**Reminders to send:**\n`
          data.reminders.forEach((r: any) => {
            msg += `→ ${r.to}: ${r.message.slice(0, 80)}...\n`
          })
        }

        if (data.ai_analysis) {
          msg += `\n**Analysis:**\n${data.ai_analysis}`
        }
        return msg
      }

      if (action === 'missing-report') {
        const missing = data.missing || []
        const partial = data.partial || []
        let msg = `**Missing Timesheets — ${data.week.start} to ${data.week.end}**\n\n`
        if (missing.length === 0 && partial.length === 0) {
          msg += 'All timesheets submitted. ✅'
        } else {
          if (missing.length > 0) {
            msg += `**Not submitted (${missing.length}):**\n`
            missing.forEach((m: any) => { msg += `• ${m.name} — 0h logged\n` })
          }
          if (partial.length > 0) {
            msg += `\n**Partial (${partial.length}):**\n`
            partial.forEach((m: any) => { msg += `• ${m.name} — ${m.hours_logged}h / ${m.expected_hours}h expected\n` })
          }
        }
        if (data.reminders?.length > 0) {
          msg += `\nI can send ${data.reminders.length} reminder(s). Say **"send reminders"** to proceed.`
        }
        return msg
      }

      if (action === 'budget-check') {
        const alerts = data.alerts || []
        let msg = `**Budget Status — ${data.week.start} to ${data.week.end}**\n\n`
        if (alerts.length === 0) {
          msg += 'All projects within budget. ✅'
        } else {
          alerts.forEach((b: any) => {
            const icon = b.status === 'over_budget' ? '🔴' : '🟡'
            msg += `${icon} **${b.project_name}** (${b.client_name})\n`
            msg += `  ${b.hours_used}/${b.budget_hours}h = ${b.burn_pct}% burned | This week: ${b.hours_this_week}h\n\n`
          })
        }
        if (data.ai_analysis) {
          msg += `**Analysis:**\n${data.ai_analysis}`
        }
        return msg
      }
      return JSON.stringify(data, null, 2)
    }

    case 'expense-categorizer': {
      if (action === 'categorize-pending') {
        const s = data.summary
        let msg = `**Expense Categorization Complete**\n\n`
        msg += `• ${s.total} transactions processed\n`
        msg += `• ${s.auto_applied} auto-categorized (≥${Math.round(s.threshold * 100)}% confidence)\n`
        msg += `• ${s.needs_review} need manual review\n`

        if (data.needs_review?.length > 0) {
          msg += `\n**Needs Review:**\n`
          data.needs_review.slice(0, 10).forEach((r: any) => {
            msg += `• "${ r.description.slice(0, 50)}" ($${Math.abs(r.amount).toFixed(0)}) → suggested: **${r.suggested_category}** (${Math.round(r.confidence * 100)}%)\n`
            msg += `  _${r.reasoning}_\n`
          })
          if (data.needs_review.length > 10) {
            msg += `\n...and ${data.needs_review.length - 10} more.`
          }
        }
        return msg
      }

      if (action === 'preview') {
        let msg = `**Categorization Preview** (not applied yet)\n\n`
        msg += `${data.count} transactions analyzed:\n\n`
        ;(data.results || []).slice(0, 15).forEach((r: any) => {
          const conf = Math.round(r.confidence * 100)
          const icon = conf >= 85 ? '✅' : conf >= 60 ? '🟡' : '🔴'
          msg += `${icon} "${r.description.slice(0, 45)}" ($${Math.abs(r.amount).toFixed(0)}) → **${r.suggested_category}** (${conf}%)\n`
        })
        msg += `\nSay **"apply categorizations"** to auto-apply high-confidence results, or **"categorize all pending"** to run the full batch.`
        return msg
      }
      return JSON.stringify(data, null, 2)
    }

    case 'project-health': {
      if (action === 'digest') {
        const ps = data.portfolio_summary
        let msg = `**Portfolio Health Digest**\n\n`
        msg += `${ps.total_projects} active projects: `
        msg += `🟢 ${ps.green} green | 🟡 ${ps.yellow} yellow | 🔴 ${ps.red} red\n`
        msg += `Revenue: $${Math.round(ps.total_revenue).toLocaleString()} | Cost: $${Math.round(ps.total_cost).toLocaleString()} | Margin: ${ps.blended_margin}%\n`
        msg += `AR Outstanding: $${Math.round(ps.total_ar).toLocaleString()}\n`

        if (data.flagged_projects?.length > 0) {
          msg += `\n**Flagged Projects:**\n`
          data.flagged_projects.forEach((p: any) => {
            const icon = p.status === 'red' ? '🔴' : '🟡'
            msg += `\n${icon} **${p.project_name}** (${p.client_name})\n`
            p.signals.forEach((s: string) => { msg += `  • ${s}\n` })
          })
        }

        if (data.ai_digest) {
          msg += `\n**AI Summary:**\n${data.ai_digest}`
        }
        return msg
      }

      if (action === 'full-report') {
        const ps = data.portfolio_summary
        let msg = `**Full Portfolio Health Report**\n\n`
        msg += `Generated: ${new Date(data.generated_at).toLocaleString()}\n\n`
        msg += `**Portfolio:** ${ps.total_projects} projects | $${Math.round(ps.total_revenue).toLocaleString()} revenue | ${ps.blended_margin}% margin | $${Math.round(ps.total_ar).toLocaleString()} AR\n\n`

        ;(data.projects || []).forEach((p: any) => {
          const icon = p.status === 'red' ? '🔴' : p.status === 'yellow' ? '🟡' : '🟢'
          msg += `${icon} **${p.project_name}** (${p.client_name}) — ${p.contract_type}\n`
          msg += `  Revenue: $${Math.round(p.total_revenue).toLocaleString()} | Cost: $${Math.round(p.total_cost).toLocaleString()} | Margin: ${p.gross_margin_pct}%\n`
          if (p.burn_rate_pct !== null) msg += `  Budget: ${p.hours_used}/${p.budget_hours}h (${p.burn_rate_pct}%)\n`
          msg += `  Signals: ${p.signals.join('; ')}\n\n`
        })

        if (data.ai_digest) {
          msg += `**AI Digest:**\n${data.ai_digest}`
        }
        return msg
      }
      return JSON.stringify(data, null, 2)
    }

    default:
      return `Agent responded:\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
  }
}

// ─── Convenience: Full Pipeline ──────────────────────────────────────────────

/**
 * Full pipeline: detect intent → execute agent → format response.
 * Returns null if no agent intent detected (Sage should handle normally).
 */
export async function tryAgentExecution(
  message: string,
  baseUrl: string,
  companyId: string
): Promise<string | null> {
  const intent = detectAgentIntent(message)
  if (!intent) return null

  const result = await executeAgent(baseUrl, intent, companyId)

  if (!result.success) {
    return `I tried to run the **${intent.agent.name}** agent, but it returned an error:\n\n> ${result.error}\n\nThis might be a configuration issue. Check the Vercel logs for details.`
  }

  return formatAgentResponse(intent.agent.id, intent.action, result.data)
}
