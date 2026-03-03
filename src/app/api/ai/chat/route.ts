import { NextRequest, NextResponse } from 'next/server'
import { aiRequest } from '@/lib/ai-router'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, systemPrompt, dataContext } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 })
    }

    // Build full system prompt with financial data context
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
6. When relevant, mention [View Report →] or [Open Forecast →] as clickable links`

    // Format messages for the router
    const formattedMessages = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }))

    // Route through AI router — Claude primary, auto-failover to OpenAI
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
      message: cleanMessage, // backward compat
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
