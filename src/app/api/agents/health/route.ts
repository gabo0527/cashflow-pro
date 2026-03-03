/**
 * AI Provider Health Check
 * GET /api/agents/health — returns status of all AI providers
 */

import { NextResponse } from 'next/server'
import { getProviderHealth } from '@/lib/ai-router'

export async function GET() {
  const health = getProviderHealth()

  const providers = Object.entries(health).map(([name, state]) => ({
    provider: name,
    status: state.healthy ? 'healthy' : 'degraded',
    consecutiveFailures: state.consecutiveFailures,
    lastChecked: state.lastCheck ? new Date(state.lastCheck).toISOString() : null,
    configured: name === 'claude'
      ? !!process.env.ANTHROPIC_API_KEY
      : !!process.env.OPENAI_API_KEY,
  }))

  const allHealthy = providers.every(p => p.status === 'healthy' && p.configured)

  return NextResponse.json({
    status: allHealthy ? 'operational' : 'degraded',
    providers,
    timestamp: new Date().toISOString(),
  })
}
