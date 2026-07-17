// src/app/api/ai-health/route.ts
// ============================================================
// AI BACKEND HEALTH CHECK (admin-only)
// ============================================================
// GET /api/ai-health
// Sends a minimal prompt to each configured provider and reports
// model, status, and latency. This is the monthly five-minute
// check: if this returns ok on both providers, the AI backend
// (Sage routing + receipt scanning) is alive on current models.
//
// Response shape:
// {
//   checked_at, anthropic: { model, ok, latency_ms, error? },
//   openai: { model, ok, latency_ms, error?, configured }
// }
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/contractor-auth'
import { isAdminEmail } from '@/lib/admin-allowlist'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-terra'

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return null
  const admin = getSupabaseAdmin()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user?.email) return null
  return isAdminEmail(data.user.email) ? data.user.email : null
}

async function checkAnthropic() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return { model: ANTHROPIC_MODEL, ok: false, latency_ms: 0, error: 'ANTHROPIC_API_KEY not configured' }
  const start = Date.now()
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 10,
        messages: [{ role: 'user', content: "Reply with the single word: ok" }],
      }),
    })
    const latency = Date.now() - start
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { model: ANTHROPIC_MODEL, ok: false, latency_ms: latency, error: `HTTP ${res.status}: ${body.slice(0, 200)}` }
    }
    return { model: ANTHROPIC_MODEL, ok: true, latency_ms: latency }
  } catch (err: any) {
    return { model: ANTHROPIC_MODEL, ok: false, latency_ms: Date.now() - start, error: err?.message || 'request failed' }
  }
}

async function checkOpenAI() {
  const key = process.env.OPENAI_API_KEY
  if (!key) return { model: OPENAI_MODEL, ok: false, latency_ms: 0, configured: false, error: 'OPENAI_API_KEY not configured (fallback provider inactive)' }
  const start = Date.now()
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: 10,
        messages: [{ role: 'user', content: "Reply with the single word: ok" }],
      }),
    })
    const latency = Date.now() - start
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { model: OPENAI_MODEL, ok: false, latency_ms: latency, configured: true, error: `HTTP ${res.status}: ${body.slice(0, 200)}` }
    }
    return { model: OPENAI_MODEL, ok: true, latency_ms: latency, configured: true }
  } catch (err: any) {
    return { model: OPENAI_MODEL, ok: false, latency_ms: Date.now() - start, configured: true, error: err?.message || 'request failed' }
  }
}

export async function GET(req: NextRequest) {
  const adminEmail = await verifyAdmin(req)
  if (!adminEmail) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })

  const [anthropic, openai] = await Promise.all([checkAnthropic(), checkOpenAI()])

  return NextResponse.json({
    checked_at: new Date().toISOString(),
    anthropic,
    openai,
    all_ok: anthropic.ok && (openai.ok || !(openai as any).configured),
  })
}
