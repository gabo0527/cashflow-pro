import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, systemPrompt, dataContext } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      )
    }

    const fullSystemPrompt = `${systemPrompt}

=== CURRENT COMPANY DATA ===
${dataContext}
=== END DATA ===

RESPONSE INSTRUCTIONS:
1. Always reference specific numbers from the data above
2. Be concise but insightful - lead with the answer
3. Proactively mention related concerns or opportunities
4. Suggest actionable next steps
5. Use **bold** for key numbers and metrics
6. When relevant, suggest viewing related pages: [View Reports →] or [Open Forecast →]
7. If you don't have data to answer, say so clearly - never make up numbers`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: fullSystemPrompt,
        messages: messages.map((msg: { role: string; content: string }) => ({
          role: msg.role,
          content: msg.content
        }))
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Claude API error:', errorData)
      return NextResponse.json(
        { error: 'Failed to get AI response' },
        { status: response.status }
      )
    }

    const data = await response.json()
    const content = data.content[0]?.text || 'Unable to generate response.'

    return NextResponse.json({
      content,
      usage: data.usage
    })

  } catch (error: any) {
    console.error('Sage AI Error:', error)
    return NextResponse.json(
      { error: 'Failed to process request', details: error.message },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    service: 'Sage - Financial Intelligence Partner',
    version: '1.0'
  })
}
