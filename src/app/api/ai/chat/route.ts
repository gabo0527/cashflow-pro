// src/app/api/ai/chat/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { aiRequest } from '@/lib/ai-router'
import { composeEmail } from '@/lib/email-compose'

// ============================================================
// Email intent detection — catches send/email/notify/remind patterns
// ============================================================
const EMAIL_PATTERNS = [
  /\b(send|email|message|notify|write to|reach out to|tell|remind|let .+ know)\b.*\b(contractor|team|everyone|all)\b/i,
  /\b(send|email|message|notify|write to|reach out to|tell|remind|let)\b.+\b(a message|an email|a note|a reminder)\b/i,
  /\b(send|email|message|notify|tell|remind|let)\b.+\b(brian|rodrigo|kathia|daniel|amber|emily|hana|julio|travis|amanda|mary|ben|jake|christy|marcus|chase)\b/i,
  /\b(draft|compose|write)\b.+\b(email|message|note)\b/i,
]

function detectEmailIntent(message: string): boolean {
  return EMAIL_PATTERNS.some(p => p.test(message))
}

function extractContractorName(message: string): string | null {
  const names = ['Brian Talbot', 'Rodrigo Urrutia', 'Kathia Colon', 'Daniel Vela', 'Amber Lewey',
    'Emily Goitia', 'Hana Jensen', 'Julio Lopez', 'Travis Swank', 'Amanda Sosnicki',
    'Mary Drzayich', 'Ben Pawlowski', 'Jake Smith', 'Christy Swearingen', 'Marcus Mattox', 'Chase Gotia']

  const msgLower = message.toLowerCase()
  for (const name of names) {
    if (msgLower.includes(name.split(' ')[0].toLowerCase())) return name
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, systemPrompt, dataContext } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 })
    }

    const lastMessage = messages[messages.length - 1]?.content || ''

    // ============================================================
    // EMAIL INTENT → Route to Email Composer
    // ============================================================
    if (detectEmailIntent(lastMessage)) {
      const contractorName = extractContractorName(lastMessage)

      const composeResult = await composeEmail(lastMessage, contractorName)

      if (composeResult.success && composeResult.draft) {
        const draft = composeResult.draft
        const recipientLabel = draft.isTeamWide
          ? '**all active contractors**'
          : `**${draft.recipientName}** (${draft.recipientEmail})`

        const previewMessage = `I've drafted an email to ${recipientLabel}:

**Subject:** ${draft.subject}

---
${draft.body}
---

Would you like me to send this, or should I adjust anything?`

        return NextResponse.json({
          content: previewMessage,
          message: previewMessage,
          action: {
            type: 'email_draft',
            data: {
              subject: draft.subject,
              body: draft.body,
              recipientName: draft.recipientName,
              recipientEmail: draft.recipientEmail,
              tone: draft.tone,
              isTeamWide: draft.isTeamWide,
            },
          },
          provider: composeResult.provider,
          model: composeResult.model,
          agentUsed: 'email-compose',
        })
      }

      // If compose fails, fall through to regular chat
      console.warn('Email compose failed, falling through to regular chat')
    }

    // ============================================================
    // REGULAR CHAT → Standard Sage response
    // ============================================================
    const fullSystemPrompt = `${systemPrompt || 'You are Sage, the VantageFP financial AI assistant.'}

---
${dataContext || 'No company data available.'}
---

Remember to:
1. Always reference specific numbers from the data above
2. Be concise but insightful
3. Proactively mention related insights
4. Suggest actionable next steps
5. Use markdown formatting for clarity
6. When relevant, mention [View Report →] or [Open Forecast →] as clickable links

IMPORTANT — Email capability:
You can send emails to contractors on Gabriel's behalf. If someone asks you to email, message, or notify a contractor, let them know you're drafting it. If the automatic detection didn't trigger, ask them to clarify who they want to contact and what the message should say.`

    const formattedMessages = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }))

    const result = await aiRequest({
      messages: formattedMessages,
      systemPrompt: fullSystemPrompt,
      taskType: 'chat',
      maxTokens: 2048,
    })

    // Check for vantage-action blocks
    const actionMatch = result.content.match(/```vantage-action\n([\s\S]*?)\n```/)
    let actionData = null
    let cleanMessage = result.content

    if (actionMatch) {
      try {
        actionData = JSON.parse(actionMatch[1])
        cleanMessage = result.content.replace(/```vantage-action\n[\s\S]*?\n```/, '').trim()
      } catch (e) {
        console.error('Failed to parse action JSON:', e)
      }
    }

    return NextResponse.json({
      content: cleanMessage,
      message: cleanMessage,
      action: actionData,
      provider: result.provider,
      model: result.model,
      failedOver: result.failedOver || false,
      usage: result.usage,
    })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: (error as Error).message || 'Internal server error' },
      { status: 500 }
    )
  }
}
