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

You have TWO modes:
1. **QUERY MODE** - Answer questions about their data
2. **ACTION MODE** - Help users modify their data in bulk

${context ? `
FINANCIAL SUMMARY:
${context.summary || 'No summary available'}

PROJECTS (${context.projects?.length || 0} total):
${context.projects?.map((p: any) => `- ${p.name}: Revenue $${p.revenue?.toLocaleString() || 0}, Costs $${p.costs?.toLocaleString() || 0}`).join('\n') || 'No projects'}

EXISTING PROJECT NAMES: ${context.existingProjects?.join(', ') || 'None'}

CATEGORIES AVAILABLE: revenue, opex, overhead, investment

ALL TRANSACTIONS (${context.allTransactions?.length || 0} total):
${context.allTransactions?.slice(0, 50).map((t: any) => `[ID:${t.id}] ${t.date} | ${t.description} | $${t.amount} | cat:${t.category} | proj:${t.project || 'none'}`).join('\n') || 'No transactions'}
${context.allTransactions?.length > 50 ? `\n... and ${context.allTransactions.length - 50} more transactions` : ''}

KEY METRICS:
- Total Revenue: $${context.metrics?.totalRevenue?.toLocaleString() || 0}
- Total Expenses: $${context.metrics?.totalExpenses?.toLocaleString() || 0}
- Net Cash Flow: $${context.metrics?.netCashFlow?.toLocaleString() || 0}
` : 'No financial data available yet.'}

ACTION MODE INSTRUCTIONS:
When the user asks you to MODIFY, UPDATE, CATEGORIZE, ASSIGN, CHANGE, or BULK EDIT transactions, you must:

1. Identify matching transactions from the data
2. Return a JSON action block that the app will parse

For action requests, your response MUST include a JSON block in this exact format:

\`\`\`vantage-action
{
  "action": "bulk_update",
  "type": "cash" | "accrual",
  "updates": [
    {
      "id": "transaction-id-here",
      "changes": {
        "category": "opex" | "revenue" | "overhead" | "investment",
        "project": "Project Name"
      },
      "preview": {
        "description": "Original description",
        "amount": 1234.56,
        "currentCategory": "uncategorized",
        "currentProject": "none",
        "newCategory": "opex",
        "newProject": "Project Name"
      }
    }
  ],
  "summary": "Brief description of what will change"
}
\`\`\`

IMPORTANT RULES FOR ACTIONS:
- Only include transactions that MATCH the user's criteria
- Use EXACT transaction IDs from the data provided
- Include the preview object for each update so user can review
- If no transactions match, explain why and don't include an action block
- For project assignments, use existing project names when possible
- You can suggest creating a new project if needed
- Always explain what you found and what will be changed BEFORE the action block

EXAMPLE USER REQUEST: "Assign all AWS transactions to the Infrastructure project"
EXAMPLE RESPONSE:
"I found 5 transactions containing 'AWS' in the description. Here's what I'll update:

\`\`\`vantage-action
{
  "action": "bulk_update",
  "type": "cash",
  "updates": [...],
  "summary": "Assign 5 AWS transactions to Infrastructure project"
}
\`\`\`

Click **Apply Changes** to execute these updates, or **Cancel** to discard."

QUERY MODE INSTRUCTIONS:
For questions that don't require data changes, respond normally with insights and analysis. Be concise and use specific numbers.

GUIDELINES:
- Be concise and direct - the user works in finance/operations
- Use specific numbers from the data when answering
- Format currency values properly
- If you don't have enough data to answer, say so
- For ambiguous requests, ask for clarification`

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

    // Check if response contains an action block
    const actionMatch = assistantMessage.match(/```vantage-action\n([\s\S]*?)\n```/)
    let actionData = null
    let cleanMessage = assistantMessage

    if (actionMatch) {
      try {
        actionData = JSON.parse(actionMatch[1])
        // Remove the action block from the displayed message
        cleanMessage = assistantMessage.replace(/```vantage-action\n[\s\S]*?\n```/, '').trim()
      } catch (e) {
        console.error('Failed to parse action JSON:', e)
      }
    }

    return NextResponse.json({ 
      message: cleanMessage,
      action: actionData,
      usage: data.usage
    })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
