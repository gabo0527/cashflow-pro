/**
 * VantageFP AI Router
 * Multi-provider AI with automatic failover and task-based routing.
 * Providers: Claude (primary), GPT-5.2 (secondary/structured tasks)
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type AIProvider = 'claude' | 'openai'
export type TaskType = 
  | 'chat'              // Sage conversational AI
  | 'analysis'          // Financial analysis, reasoning
  | 'structured'        // JSON outputs, categorization, extraction
  | 'validation'        // Invoice/expense validation
  | 'categorization'    // Expense auto-categorization
  | 'summary'           // Weekly digests, health reports
  | 'forecast'          // Cash flow projections

interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface AIRequestOptions {
  messages: AIMessage[]
  systemPrompt?: string
  taskType?: TaskType
  temperature?: number
  maxTokens?: number
  jsonMode?: boolean       // Force JSON response (OpenAI only, Claude uses prompt)
  forceProvider?: AIProvider // Override routing
}

interface AIResponse {
  content: string
  provider: AIProvider
  model: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
  parsedJson?: any         // Auto-parsed if jsonMode
  failedOver?: boolean     // True if primary failed and we used backup
}

interface ProviderHealth {
  provider: AIProvider
  healthy: boolean
  lastCheck: number
  consecutiveFailures: number
}

// ─── Provider Health Tracking ────────────────────────────────────────────────

const healthState: Record<AIProvider, ProviderHealth> = {
  claude: { provider: 'claude', healthy: true, lastCheck: 0, consecutiveFailures: 0 },
  openai: { provider: 'openai', healthy: true, lastCheck: 0, consecutiveFailures: 0 },
}

const HEALTH_RECOVERY_MS = 60_000  // Retry unhealthy provider after 60s
const MAX_FAILURES = 3              // Mark unhealthy after 3 consecutive failures

function markHealthy(provider: AIProvider) {
  healthState[provider].healthy = true
  healthState[provider].consecutiveFailures = 0
  healthState[provider].lastCheck = Date.now()
}

function markUnhealthy(provider: AIProvider) {
  healthState[provider].consecutiveFailures++
  healthState[provider].lastCheck = Date.now()
  if (healthState[provider].consecutiveFailures >= MAX_FAILURES) {
    healthState[provider].healthy = false
    console.warn(`[AI Router] ${provider} marked unhealthy after ${MAX_FAILURES} failures`)
  }
}

function isAvailable(provider: AIProvider): boolean {
  const h = healthState[provider]
  if (h.healthy) return true
  // Allow retry after recovery period
  if (Date.now() - h.lastCheck > HEALTH_RECOVERY_MS) return true
  return false
}

// ─── Task Routing ────────────────────────────────────────────────────────────

/** 
 * Determines the preferred provider for a task type.
 * Claude: complex reasoning, chat, analysis, forecasting
 * OpenAI: structured outputs, categorization, validation
 */
function getPreferredProvider(taskType: TaskType): AIProvider {
  switch (taskType) {
    case 'chat':
    case 'analysis':
    case 'forecast':
    case 'summary':
      return 'claude'
    case 'structured':
    case 'validation':
    case 'categorization':
      return 'openai'
    default:
      return 'claude'
  }
}

function getFallbackProvider(primary: AIProvider): AIProvider {
  return primary === 'claude' ? 'openai' : 'claude'
}

// ─── Provider Implementations ────────────────────────────────────────────────

async function callClaude(options: AIRequestOptions): Promise<AIResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  // Separate system message from conversation messages
  const systemContent = options.systemPrompt || ''
  const messages = options.messages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))

  const body: any = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: options.maxTokens || 2048,
    messages,
  }

  if (systemContent) {
    body.system = systemContent
  }

  if (options.temperature !== undefined) {
    body.temperature = options.temperature
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(`Claude API ${response.status}: ${err.error?.message || response.statusText}`)
  }

  const data = await response.json()
  const text = data.content?.find((b: any) => b.type === 'text')?.text || ''

  let parsedJson: any = undefined
  if (options.jsonMode) {
    try {
      const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsedJson = JSON.parse(clean)
    } catch { /* not valid JSON */ }
  }

  return {
    content: text,
    provider: 'claude',
    model: 'claude-sonnet-4-20250514',
    usage: data.usage ? {
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
    } : undefined,
    parsedJson,
  }
}

async function callOpenAI(options: AIRequestOptions): Promise<AIResponse> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  // Build messages array with system prompt first
  const messages: any[] = []
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt })
  }
  messages.push(...options.messages.filter(m => m.role !== 'system').map(m => ({
    role: m.role,
    content: m.content,
  })))

  const body: any = {
    model: 'gpt-5.2',
    max_tokens: options.maxTokens || 2048,
    messages,
  }

  if (options.temperature !== undefined) {
    body.temperature = options.temperature
  }

  if (options.jsonMode) {
    body.response_format = { type: 'json_object' }
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(`OpenAI API ${response.status}: ${err.error?.message || response.statusText}`)
  }

  const data = await response.json()
  const text = data.choices?.[0]?.message?.content || ''

  let parsedJson: any = undefined
  if (options.jsonMode) {
    try { parsedJson = JSON.parse(text) } catch { /* not valid JSON */ }
  }

  return {
    content: text,
    provider: 'openai',
    model: data.model || 'gpt-5.2',
    usage: data.usage ? {
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
    } : undefined,
    parsedJson,
  }
}

// ─── Main Router ─────────────────────────────────────────────────────────────

const providerFns: Record<AIProvider, (opts: AIRequestOptions) => Promise<AIResponse>> = {
  claude: callClaude,
  openai: callOpenAI,
}

/**
 * Route an AI request to the best available provider.
 * Handles automatic failover if primary provider is down.
 */
export async function aiRequest(options: AIRequestOptions): Promise<AIResponse> {
  const taskType = options.taskType || 'chat'
  
  // Determine provider order
  const primary = options.forceProvider || getPreferredProvider(taskType)
  const fallback = getFallbackProvider(primary)

  // Try primary
  if (isAvailable(primary)) {
    try {
      const result = await providerFns[primary](options)
      markHealthy(primary)
      return result
    } catch (err) {
      console.error(`[AI Router] ${primary} failed:`, (err as Error).message)
      markUnhealthy(primary)
    }
  }

  // Try fallback
  if (isAvailable(fallback)) {
    try {
      console.log(`[AI Router] Failing over from ${primary} to ${fallback}`)
      const result = await providerFns[fallback](options)
      markHealthy(fallback)
      return { ...result, failedOver: true }
    } catch (err) {
      console.error(`[AI Router] ${fallback} also failed:`, (err as Error).message)
      markUnhealthy(fallback)
    }
  }

  throw new Error('All AI providers unavailable. Please try again later.')
}

// ─── Convenience Functions ───────────────────────────────────────────────────

/** Quick chat completion — defaults to Claude */
export async function aiChat(
  messages: AIMessage[],
  systemPrompt?: string
): Promise<AIResponse> {
  return aiRequest({ messages, systemPrompt, taskType: 'chat' })
}

/** Structured JSON output — defaults to OpenAI */
export async function aiStructured<T = any>(
  prompt: string,
  systemPrompt?: string
): Promise<{ data: T; provider: AIProvider; model: string }> {
  const result = await aiRequest({
    messages: [{ role: 'user', content: prompt }],
    systemPrompt: (systemPrompt || '') + '\n\nRespond with valid JSON only. No markdown, no backticks, no preamble.',
    taskType: 'structured',
    jsonMode: true,
    temperature: 0.1,
  })

  if (result.parsedJson) {
    return { data: result.parsedJson as T, provider: result.provider, model: result.model }
  }

  // Fallback: try to parse content directly
  try {
    const clean = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return { data: JSON.parse(clean) as T, provider: result.provider, model: result.model }
  } catch {
    throw new Error(`Failed to parse JSON from ${result.provider}: ${result.content.slice(0, 200)}`)
  }
}

/** Financial analysis — defaults to Claude */
export async function aiAnalysis(
  prompt: string,
  dataContext: string,
  systemPrompt?: string
): Promise<AIResponse> {
  const fullSystem = `${systemPrompt || 'You are Sage, the VantageFP financial AI assistant. Be concise, use specific numbers, and provide actionable insights.'}\n\n--- FINANCIAL DATA ---\n${dataContext}\n--- END DATA ---`
  
  return aiRequest({
    messages: [{ role: 'user', content: prompt }],
    systemPrompt: fullSystem,
    taskType: 'analysis',
  })
}

/** Get current health status of all providers */
export function getProviderHealth(): Record<AIProvider, ProviderHealth> {
  return { ...healthState }
}
