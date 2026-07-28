/**
 * Billing Line Summaries
 *
 * Turns raw contractor timesheet notes into short, client-facing work
 * descriptions for the Billing Statement PDF. One paragraph per line,
 * professional tone, no internal jargon. Uses the platform AI router
 * (Claude primary, OpenAI fallback) — same stack as Sage.
 */

import { NextRequest, NextResponse } from 'next/server'
import { aiStructured } from '@/lib/ai-router'

interface SummaryLine {
  key: string
  scope: string
  resource: string
  hours: number
  notes: { date: string; note: string }[]
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const lines: SummaryLine[] = (body.lines || []).filter((l: SummaryLine) => l && l.key)
    if (lines.length === 0) return NextResponse.json({ summaries: {} })

    // Lines with no notes get an empty summary — the admin types those by hand.
    const withNotes = lines.filter(l => (l.notes || []).length > 0)
    const summaries: Record<string, string> = {}
    lines.forEach(l => { summaries[l.key] = '' })
    if (withNotes.length === 0) return NextResponse.json({ summaries })

    const payload = withNotes.map(l => ({
      key: l.key,
      scope: l.scope,
      resource: l.resource,
      hours: l.hours,
      notes: (l.notes || []).map(n => `${n.date}: ${n.note}`),
    }))

    const system = `You write work descriptions for a client-facing billing statement from a construction/E2E consulting firm (project controls, scheduling, cost management, procurement, document control).

Rules:
- One summary per line item, 1-2 sentences, maximum ~40 words.
- Professional, factual, past tense. Written for the CLIENT paying the invoice.
- Synthesize the period's work into themes; do not list every note or every date.
- Strip internal jargon, personal remarks, tool minutiae, names of colleagues, and anything that reads as internal chatter. Keep deliverables and outcomes.
- Never invent work that is not in the notes. If notes are too thin, write a shorter, more general sentence — never pad.
- No bullet points, no dates, no hour counts, no names in the summary text.`

    const prompt = `Summarize each billing line's timesheet notes into a client-facing description.

Line items (JSON):
${JSON.stringify(payload, null, 2)}

Respond with JSON of shape: { "summaries": { "<key>": "<summary>", ... } } — one entry per input key.`

    const result = await aiStructured<{ summaries: Record<string, string> }>(prompt, system)
    const out = result.data?.summaries || {}
    withNotes.forEach(l => { if (typeof out[l.key] === 'string') summaries[l.key] = out[l.key].trim() })

    return NextResponse.json({ summaries, provider: result.provider })
  } catch (err: any) {
    console.error('billing-summaries error:', err)
    return NextResponse.json({ error: err.message || 'Summarization failed' }, { status: 500 })
  }
}
