import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function POST(request: NextRequest) {
  try {
    const { message, context, companyId } = await request.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Extract search terms from user message
    const commonWords = new Set([
      'the', 'all', 'and', 'for', 'that', 'with', 'from', 'this', 'will', 'are', 
      'was', 'were', 'been', 'have', 'has', 'had', 'can', 'could', 'would', 'should', 
      'may', 'might', 'must', 'shall', 'find', 'show', 'assign', 'categorize', 'update', 
      'change', 'mark', 'set', 'transactions', 'transaction', 'project', 'category', 
      'description', 'amount', 'date', 'revenue', 'opex', 'overhead', 'investment', 
      'cash', 'flow', 'please', 'help', 'want', 'need', 'like', 'make', 'them', 'those',
      'these', 'what', 'where', 'when', 'which', 'who', 'how', 'why', 'get', 'put',
      'uncategorized', 'unassigned', 'named', 'called', 'containing', 'includes'
    ])
    
    const words = message.toLowerCase().match(/\b[a-z0-9]{3,}\b/g) || []
    const searchTerms = words.filter((w: string) => !commonWords.has(w))
    
    // Also extract quoted phrases (e.g., "Airtable Inc")
    const quotedPhrases = message.match(/["']([^"']+)["']/g)?.map((p: string) => 
      p.replace(/["']/g, '').toLowerCase()
    ) || []
    
    // Combine search terms and quoted phrases
    const allSearchTerms = [...new Set([...searchTerms, ...quotedPhrases])]
    
    let matchingTransactions: any[] = []
    let stats = { total: 0, uncategorized: 0, unassignedProject: 0 }
    let existingProjects: string[] = context?.existingProjects || []

    // Search database if we have a companyId
    if (companyId) {
      // Search for matching transactions with flexible matching
      if (allSearchTerms.length > 0) {
        // Build flexible search conditions:
        // 1. Full term match (ILIKE %term%)
        // 2. For longer terms (5+ chars), also match first 4 chars (catches variations)
        // 3. Match with spaces/dashes variations
        const searchConditions: string[] = []
        
        allSearchTerms.forEach((term: string) => {
          // Full term match (case-insensitive)
          searchConditions.push(`description.ilike.%${term}%`)
          
          // For terms 5+ characters, also search partial prefix (catches "AIRTABLE INC" from "airtable")
          if (term.length >= 5) {
            const prefix = term.slice(0, 4)
            searchConditions.push(`description.ilike.%${prefix}%`)
          }
          
          // Handle potential word breaks (e.g., "airtable" also finds "air table" or "air-table")
          if (term.length >= 6 && !term.includes(' ')) {
            // Try splitting at common break points
            const midpoint = Math.floor(term.length / 2)
            const part1 = term.slice(0, midpoint)
            const part2 = term.slice(midpoint)
            if (part1.length >= 3 && part2.length >= 3) {
              searchConditions.push(`description.ilike.%${part1}%${part2}%`)
            }
          }
        })
        
        // Remove duplicates
        const uniqueConditions = [...new Set(searchConditions)].join(',')
        
        const { data: cashMatches } = await supabase
          .from('transactions')
          .select('*')
          .eq('company_id', companyId)
          .or(uniqueConditions)
          .order('date', { ascending: false })
          .limit(200)

        matchingTransactions = (cashMatches || []).map(t => ({
          id: t.id,
          date: t.date,
          description: t.description,
          amount: parseFloat(t.amount),
          category: t.category || 'unassigned',
          project: t.project || 'none',
          type: t.type
        }))
      }

      // Check for "uncategorized" request
      if (message.toLowerCase().includes('uncategorized') || message.toLowerCase().includes('unassigned')) {
        const { data: uncatMatches } = await supabase
          .from('transactions')
          .select('*')
          .eq('company_id', companyId)
          .or('category.is.null,category.eq.unassigned,category.eq.')
          .order('date', { ascending: false })
          .limit(200)

        if (uncatMatches && uncatMatches.length > 0) {
          const uncatFormatted = uncatMatches.map(t => ({
            id: t.id,
            date: t.date,
            description: t.description,
            amount: parseFloat(t.amount),
            category: t.category || 'unassigned',
            project: t.project || 'none',
            type: t.type
          }))
          // Merge with existing matches, avoiding duplicates
          const existingIds = new Set(matchingTransactions.map(t => t.id))
          uncatFormatted.forEach(t => {
            if (!existingIds.has(t.id)) {
              matchingTransactions.push(t)
            }
          })
        }
      }

      // Get stats
      const { count: totalCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)

      const { count: uncatCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .or('category.is.null,category.eq.unassigned,category.eq.')

      const { count: unassignedCount } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .is('project', null)

      stats = {
        total: totalCount || 0,
        uncategorized: uncatCount || 0,
        unassignedProject: unassignedCount || 0
      }

      // Get projects
      const { data: projects } = await supabase
        .from('projects')
        .select('name')
        .eq('company_id', companyId)

      if (projects) {
        existingProjects = projects.map(p => p.name)
      }
    } else {
      // Fallback to context if no companyId (shouldn't happen normally)
      matchingTransactions = context?.allTransactions?.slice(0, 100) || []
    }

    // Format transactions for AI
    const formatTransaction = (t: any) => 
      `[ID:${t.id}] ${t.date} | ${t.description} | $${t.amount} | cat:${t.category} | proj:${t.project}`
    
    let transactionSection = ''
    if (matchingTransactions.length > 0) {
      transactionSection = `MATCHING TRANSACTIONS (${matchingTransactions.length} found${searchTerms.length > 0 ? ` for "${searchTerms.join('", "')}"` : ''}):\n`
      transactionSection += matchingTransactions.slice(0, 100).map(formatTransaction).join('\n')
      if (matchingTransactions.length > 100) {
        transactionSection += `\n... and ${matchingTransactions.length - 100} more matches`
      }
    } else if (searchTerms.length > 0) {
      transactionSection = `NO TRANSACTIONS FOUND matching "${searchTerms.join('", "')}"\n`
      transactionSection += `Database has ${stats.total} total transactions.`
    } else {
      transactionSection = `DATABASE STATS:\n- Total transactions: ${stats.total}\n- Uncategorized: ${stats.uncategorized}\n- Without project: ${stats.unassignedProject}`
    }

    // Build the system prompt
    const systemPrompt = `You are Vantage AI, a financial assistant for a project-based business analytics platform.

You have TWO modes:
1. **QUERY MODE** - Answer questions about their data
2. **ACTION MODE** - Help users modify their data in bulk

DATABASE SUMMARY:
- Total transactions: ${stats.total}
- Uncategorized: ${stats.uncategorized}
- Without project assigned: ${stats.unassignedProject}

EXISTING PROJECTS: ${existingProjects.join(', ') || 'None'}

CATEGORIES AVAILABLE: revenue, opex, overhead, investment

${transactionSection}

${context?.metrics ? `
KEY METRICS:
- Total Revenue: $${context.metrics.totalRevenue?.toLocaleString() || 0}
- Total Expenses: $${context.metrics.totalExpenses?.toLocaleString() || 0}
- Net Cash Flow: $${context.metrics.netCashFlow?.toLocaleString() || 0}
` : ''}

ACTION MODE INSTRUCTIONS:
When the user asks to MODIFY, UPDATE, CATEGORIZE, ASSIGN, CHANGE, or BULK EDIT transactions:

1. Look at the MATCHING TRANSACTIONS above
2. Return a JSON action block for the app to execute

Format your response with this JSON block:

\`\`\`vantage-action
{
  "action": "bulk_update",
  "type": "cash",
  "updates": [
    {
      "id": "exact-transaction-id-from-above",
      "changes": {
        "category": "opex",
        "project": "Project Name"
      },
      "preview": {
        "description": "Original description",
        "amount": 1234.56,
        "currentCategory": "unassigned",
        "currentProject": "none",
        "newCategory": "opex",
        "newProject": "Project Name"
      }
    }
  ],
  "summary": "Brief description of changes"
}
\`\`\`

IMPORTANT RULES:
- Use EXACT transaction IDs from the MATCHING TRANSACTIONS list
- Include preview for each update
- If no matches found, explain why - don't make up IDs
- Search is case-insensitive
- For project assignments, use existing project names when possible

QUERY MODE:
For questions that don't need changes, respond with insights. Be concise.`

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

    // Parse action block if present
    const actionMatch = assistantMessage.match(/```vantage-action\n([\s\S]*?)\n```/)
    let actionData = null
    let cleanMessage = assistantMessage

    if (actionMatch) {
      try {
        actionData = JSON.parse(actionMatch[1])
        cleanMessage = assistantMessage.replace(/```vantage-action\n[\s\S]*?\n```/, '').trim()
      } catch (e) {
        console.error('Failed to parse action JSON:', e)
      }
    }

    return NextResponse.json({ 
      message: cleanMessage,
      action: actionData,
      usage: data.usage,
      debug: {
        searchTerms,
        matchCount: matchingTransactions.length,
        stats
      }
    })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
