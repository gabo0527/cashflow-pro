import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

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

    // Build the full system prompt with data context
    const fullSystemPrompt = `${systemPrompt}

---
${dataContext}
---

Remember to:
1. Always reference specific numbers from the data above
2. Be concise but insightful
3. Proactively mention related insights
4. Suggest actionable next steps
5. Use markdown formatting for clarity
6. When relevant, mention [View Report →] or [Open Forecast →] as clickable links`

    // Format messages for Claude API
    const formattedMessages = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }))

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: fullSystemPrompt,
      messages: formattedMessages
    })

    // Extract text content from response
    const textContent = response.content.find(block => block.type === 'text')
    const content = textContent?.type === 'text' ? textContent.text : 'I apologize, but I was unable to generate a response.'

    // Parse response for metadata (charts, KPIs, links)
    const metadata: any = {}
    
    // Check if response suggests viewing reports
    if (content.includes('[View') || content.includes('Report →') || content.includes('Forecast →')) {
      metadata.links = []
      if (content.includes('Report')) {
        metadata.links.push({ label: 'View Reports', href: '/reports' })
      }
      if (content.includes('Forecast')) {
        metadata.links.push({ label: 'Open Forecast', href: '/forecast' })
      }
      if (content.includes('Client')) {
        metadata.links.push({ label: 'View Clients', href: '/clients' })
      }
    }

    return NextResponse.json({
      content,
      metadata,
      usage: {
        input_tokens: response.usage?.input_tokens,
        output_tokens: response.usage?.output_tokens
      }
    })

  } catch (error: any) {
    console.error('AI Chat Error:', error)
    
    if (error.status === 401) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      )
    }
    
    if (error.status === 429) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a moment.' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to process AI request', details: error.message },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    service: 'Vantage AI Assistant',
    model: 'claude-sonnet-4-20250514'
  })
}
