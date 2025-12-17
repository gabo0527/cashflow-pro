import { NextRequest, NextResponse } from 'next/server'

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  vendor?: string
  project?: string
}

export async function POST(request: NextRequest) {
  try {
    const { transactions, existingCategories, existingProjects } = await request.json()
    
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: 'No transactions provided' }, { status: 400 })
    }
    
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }
    
    // Limit batch size to prevent timeouts
    const batchSize = Math.min(transactions.length, 50)
    const batch = transactions.slice(0, batchSize)
    
    const systemPrompt = `You are a financial categorization assistant for a project-based business. 
Your job is to analyze transaction descriptions and suggest the most appropriate category and project.

Available categories: ${existingCategories?.join(', ') || 'Revenue, OpEx, Overhead, Investment'}
Existing projects: ${existingProjects?.join(', ') || 'None specified'}

Rules:
1. Revenue: Client payments, invoice collections, sales
2. Direct Cost (OpEx): Project-specific expenses, contractor payments, materials for specific jobs
3. Overhead: General business expenses not tied to specific projects (rent, utilities, software subscriptions, insurance, general supplies)
4. Investment: Equipment purchases, capital expenditures, one-time large purchases for business growth

For type:
- "revenue" for income/money received
- "direct_cost" for expenses/costs

For confidence (0-100):
- 90-100: Very clear from description
- 70-89: Fairly confident based on keywords
- 50-69: Educated guess
- Below 50: Uncertain

Respond with a JSON array only, no markdown formatting.`

    const userPrompt = `Categorize these transactions. Return a JSON array with each object having: id, suggestedCategory (lowercase: revenue, opex, overhead, investment), suggestedProject (from existing projects if applicable, or suggest a new one based on context), suggestedType (revenue or direct_cost), confidence (0-100), reasoning (brief explanation).

Transactions:
${JSON.stringify(batch, null, 2)}

Return ONLY a valid JSON array, no other text.`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Anthropic API error:', errorText)
      throw new Error(`API request failed: ${response.status}`)
    }

    const data = await response.json()
    
    // Extract text from response
    const textContent = data.content?.find((block: any) => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI')
    }

    // Parse the JSON response
    let categorizedTransactions: any[]
    try {
      // Clean the response - remove any markdown code blocks if present
      let jsonText = textContent.text.trim()
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7)
      }
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3)
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3)
      }
      jsonText = jsonText.trim()
      
      categorizedTransactions = JSON.parse(jsonText)
    } catch (parseError) {
      console.error('Failed to parse AI response:', textContent.text)
      throw new Error('Failed to parse AI categorization response')
    }

    // Merge AI suggestions with original transaction data
    const result = batch.map((original: Transaction) => {
      const suggestion = categorizedTransactions.find((s: any) => s.id === original.id)
      return {
        ...original,
        suggestedCategory: suggestion?.suggestedCategory || 'unassigned',
        suggestedProject: suggestion?.suggestedProject || '',
        suggestedType: suggestion?.suggestedType || (original.amount >= 0 ? 'revenue' : 'direct_cost'),
        confidence: suggestion?.confidence || 50,
        reasoning: suggestion?.reasoning || 'No AI analysis available'
      }
    })

    return NextResponse.json({ 
      categorizedTransactions: result,
      totalProcessed: result.length,
      totalRemaining: transactions.length - batchSize
    })

  } catch (error) {
    console.error('AI Categorization error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to categorize transactions' },
      { status: 500 }
    )
  }
}
