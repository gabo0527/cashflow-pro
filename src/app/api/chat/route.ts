import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { message, context } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    // Build context from user's financial data
    const systemPrompt = `You are Vantage AI, a financial assistant for a project-based business analytics platform. You help users understand their cash flow, project profitability, and financial metrics.

You have access to the user's current financial data:

${context ? `
FINANCIAL SUMMARY:
${context.summary || 'No summary available'}

PROJECTS:
${context.projects?.map((p: any) => `- ${p.name}: Revenue $${p.revenue?.toLocaleString() || 0}, Costs $${p.costs?.toLocaleString() || 0}, GM ${p.grossMargin || 0}%`).join('\n') || 'No projects'}

RECENT TRANSACTIONS (Last 10):
${context.recentTransactions?.map((t: any) => `- ${t.date}: ${t.description} | $${t.amount?.toLocaleString()} | ${t.category}`).join('\n') || 'No transactions'}

KEY METRICS:
- Total Revenue: $${context.metrics?.totalRevenue?.toLocaleString() || 0}
- Total Expenses: $${context.metrics?.totalExpenses?.toLocaleString() || 0}
- Net Cash Flow: $${context.metrics?.netCashFlow?.toLocaleString() || 0}
- Gross Margin: ${context.metrics?.grossMargin || 0}%
- Current Balance: $${context.metrics?.currentBalance?.toLocaleString() || 0}
- Runway: ${context.metrics?.runway || 'N/A'} months

ACCRUAL DATA:
- Total Invoiced: $${context.accrual?.totalInvoiced?.toLocaleString() || 0}
- Total Direct Costs: $${context.accrual?.totalDirectCosts?.toLocaleString() || 0}
- Gross Profit: $${context.accrual?.grossProfit?.toLocaleString() || 0}
` : 'No financial data available yet.'}

GUIDELINES:
- Be concise and direct - the user works in finance/operations
- Use specific numbers from the data when answering
- Format currency values properly
- If asked to generate a report, format it cleanly
- If you don't have enough data to answer, say so
- You can suggest actions like "You might want to check the Transactions tab for more details"
- For export requests, explain that you can help format the data but the user will need to use the Export features in the app`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          { role: 'user', content: message }
        ]
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('Claude API error:', errorData)
      return NextResponse.json({ error: 'Failed to get response from AI' }, { status: 500 })
    }

    const data = await response.json()
    const assistantMessage = data.content[0]?.text || 'Sorry, I could not generate a response.'

    return NextResponse.json({ 
      message: assistantMessage,
      usage: data.usage
    })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
