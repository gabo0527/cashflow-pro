// src/lib/email-compose.ts
// ============================================================
// Email Compose Logic — Shared by chat route and compose agent
// ============================================================

import { createClient } from '@supabase/supabase-js'
import { aiRequest } from '@/lib/ai-router'

const COMPOSE_SYSTEM = `You are Sage, an email drafting assistant for VantageFP (an Owner's Representative consulting firm run by Gabriel).

You draft professional but warm emails from Gabriel to his contractors. Keep the tone:
- Direct and professional, but friendly (not corporate)
- Clear about what's needed or what happened
- Brief — 2-4 short paragraphs max
- No fluff, no "I hope this finds you well"

Output ONLY valid JSON with this exact structure:
{
  "subject": "Email subject line",
  "body": "The email body text. Use \\n for line breaks between paragraphs.",
  "recipientName": "First name of the recipient",
  "recipientEmail": "email@example.com",
  "tone": "info|reminder|urgent|appreciation|correction"
}

Rules:
- Use the contractor's first name
- Sign off as "Gabriel" or "— Gabriel" 
- If the instruction mentions a specific issue (hours, amount, missing receipt), be specific about it
- If no specific contractor is identifiable, set recipientEmail to "" and recipientName to "Team"
- For team-wide messages, the subject should reflect it's for all contractors
- Never fabricate data — if hours/amounts aren't specified, use placeholders like "[X hours]"`

export interface EmailDraft {
  subject: string
  body: string
  recipientName: string
  recipientEmail: string
  tone: string
  isTeamWide: boolean
}

export interface ComposeResult {
  success: boolean
  draft?: EmailDraft
  provider?: string
  model?: string
  error?: string
}

export async function composeEmail(
  instruction: string,
  contractorName?: string | null,
  contractorId?: string | null,
  contractorEmail?: string | null
): Promise<ComposeResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )

  try {
    let resolvedName = contractorName || ''
    let resolvedEmail = contractorEmail || ''

    // Resolve contractor from ID
    if (contractorId && (!resolvedName || !resolvedEmail)) {
      const { data: member } = await supabase
        .from('team_members')
        .select('name, email')
        .eq('id', contractorId)
        .single()
      if (member) {
        resolvedName = resolvedName || member.name
        resolvedEmail = resolvedEmail || member.email
      }
    }

    // Resolve contractor from name
    if (resolvedName && !resolvedEmail) {
      const { data: member } = await supabase
        .from('team_members')
        .select('name, email')
        .ilike('name', `%${resolvedName}%`)
        .limit(1)
        .single()
      if (member) {
        resolvedName = member.name
        resolvedEmail = member.email
      }
    }

    const contextParts = []
    if (resolvedName) contextParts.push(`Recipient: ${resolvedName}`)
    if (resolvedEmail) contextParts.push(`Email: ${resolvedEmail}`)

    const prompt = `Draft an email based on this instruction:
"${instruction}"

${contextParts.length > 0 ? `Known recipient info:\n${contextParts.join('\n')}` : 'No specific recipient identified — determine from the instruction or draft for the full team.'}

Respond with JSON only.`

    const result = await aiRequest({
      messages: [{ role: 'user', content: prompt }],
      systemPrompt: COMPOSE_SYSTEM,
      taskType: 'structured',
      jsonMode: true,
      temperature: 0.3,
      maxTokens: 1024,
    })

    let draft
    if (result.parsedJson) {
      draft = result.parsedJson
    } else {
      const clean = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      draft = JSON.parse(clean)
    }

    if (resolvedEmail && !draft.recipientEmail) draft.recipientEmail = resolvedEmail
    if (resolvedName) draft.recipientName = resolvedName.split(' ')[0]

    return {
      success: true,
      draft: {
        subject: draft.subject,
        body: draft.body,
        recipientName: draft.recipientName || 'Team',
        recipientEmail: draft.recipientEmail || '',
        tone: draft.tone || 'info',
        isTeamWide: !draft.recipientEmail,
      },
      provider: result.provider,
      model: result.model,
    }

  } catch (error) {
    console.error('Email compose error:', error)
    return { success: false, error: (error as Error).message }
  }
}
