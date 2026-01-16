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
      'uncategorized', 'unassigned', 'named', 'called', 'containing', 'includes',
      'overall', 'gross', 'margin', 'profit', 'total', 'much', 'many'
    ])
    
    const words = (message || '').toLowerCase().match(/\b[a-z0-9]{3,}\b/g) || []
    const searchTerms = words.filter((w: string) => !commonWords.has(w))
    
    // Also extract quoted phrases (e.g., "Airtable Inc")
    const quotedPhrases = (message || '').match(/["']([^"']+)["']/g)?.map((p: string) => 
      p.replace(/["']/g, '').toLowerCase()
    ) || []
    
    // Combine search terms and quoted phrases
    const allSearchTerms = Array.from(new Set([...searchTerms, ...quotedPhrases]))
    
    let matchingTransactions: any[] = []
    let stats = { total: 0, uncategorized: 0, unassignedProject: 0 }
    let existingProjects: string[] = context?.existingProjects || []

    // Search database if we have a companyId
    if (companyId && supabaseUrl && supabaseServiceKey) {
      try {
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
          const uniqueConditions = Array.from(new Set(searchConditions)).join(',')
          
          const { data: cashMatches, error: searchError } = await supabase
            .from('transactions')
            .select('*')
            .eq('company_id', companyId)
            .or(uniqueConditions)
            .order('date', { ascending: false })
            .limit(200)

          if (searchError) {
            console.error('Supabase search error:', searchError)
          } else {
            matchingTransactions = (cashMatches || []).map(t => ({
              id: t.id,
              date: t.date,
              description: t.description || '',
              amount: parseFloat(t.amount) || 0,
              category: t.category || 'unassigned',
              project: t.project || 'none',
              type: t.type || 'actual'
            }))
          }
        }

        // Check for "uncategorized" request
        if ((message || '').toLowerCase().includes('uncategorized') || (message || '').toLowerCase().includes('unassigned')) {
          const { data: uncatMatches, error: uncatError } = await supabase
            .from('transactions')
            .select('*')
            .eq('company_id', companyId)
            .or('category.is.null,category.eq.unassigned,category.eq.')
            .order('date', { ascending: false })
            .limit(200)

          if (!uncatError && uncatMatches && uncatMatches.length > 0) {
            const uncatFormatted = uncatMatches.map(t => ({
              id: t.id,
              date: t.date,
              description: t.description || '',
              amount: parseFloat(t.amount) || 0,
              category: t.category || 'unassigned',
              project: t.project || 'none',
              type: t.type || 'actual'
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
          existingProjects = projects.map(p => p.name || '').filter(Boolean)
        }
      } catch (dbError) {
        console.error('Database query error:', dbError)
        // Will fall through to context fallback
      }
    }
    
    // Fallback to context data if database query returned nothing
    if (matchingTransactions.length === 0 && stats.total === 0 && context?.allTransactions?.length > 0) {
      console.log('Falling back to context data, transactions:', context.allTransactions.length)
      const allTransactions = context.allTransactions || []
      
      // Search in context data
      if (allSearchTerms.length > 0) {
        matchingTransactions = allTransactions.filter((t: any) => {
          const desc = (t.description || '').toLowerCase()
          return allSearchTerms.some((term: string) => desc.includes(term))
        }).map((t: any) => ({
          id: t.id,
          date: t.date,
          description: t.description || '',
          amount: t.amount || 0,
          category: t.category || 'unassigned',
          project: t.project || 'none',
          type: t.type || 'actual'
        }))
      }
      
      // Check for uncategorized in context
      if ((message || '').toLowerCase().includes('uncategorized') || (message || '').toLowerCase().includes('unassigned')) {
        const uncatFromContext = allTransactions.filter((t: any) => 
          !t.category || t.category === 'unassigned' || t.category === ''
        ).map((t: any) => ({
          id: t.id,
          date: t.date,
          description: t.description || '',
          amount: t.amount || 0,
          category: 'unassigned',
          project: t.project || 'none',
          type: t.type || 'actual'
        }))
        
        const existingIds = new Set(matchingTransactions.map(t => t.id))
        uncatFromContext.forEach((t: any) => {
          if (!existingIds.has(t.id)) {
            matchingTransactions.push(t)
          }
        })
      }
      
      stats = {
        total: allTransactions.length,
        uncategorized: allTransactions.filter((t: any) => !t.category || t.category === 'unassigned').length,
        unassignedProject: allTransactions.filter((t: any) => !t.project).length
      }
    }

    // Format transactions for display
    const formatTransaction = (t: any) => {
      const desc = (t.description || 'No description').substring(0, 50)
      const amt = typeof t.amount === 'number' ? t.amount.toFixed(2) : '0.00'
      return `- ID: ${t.id} | ${t.date || 'No date'} | ${desc} | $${amt} | Category: ${t.category || 'unassigned'} | Project: ${t.project || 'none'}`
    }

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

    // Safely format project financials with null checks
    const formatAcrrualProjects = () => {
      if (!context?.projects || !Array.isArray(context.projects) || context.projects.length === 0) {
        return ''
      }
      try {
        const lines = context.projects
          .filter((p: any) => p && p.name)
          .map((p: any) => {
            const name = p.name || 'Unknown'
            const revenue = typeof p.revenue === 'number' ? p.revenue.toLocaleString() : '0'
            const costs = typeof p.costs === 'number' ? p.costs.toLocaleString() : '0'
            const grossProfit = typeof p.grossProfit === 'number' ? p.grossProfit.toLocaleString() : '0'
            const grossMargin = p.grossMargin ?? 0
            return `- ${name}: Revenue $${revenue}, Costs $${costs}, Profit $${grossProfit}, Margin ${grossMargin}%`
          })
        return lines.length > 0 ? `\nPROJECT FINANCIALS - ACCRUAL/INVOICES (gross margin analysis):\n${lines.join('\n')}\n` : ''
      } catch (e) {
        console.error('Error formatting accrual projects:', e)
        return ''
      }
    }

    const formatCashProjects = () => {
      if (!context?.cashProjects || !Array.isArray(context.cashProjects) || context.cashProjects.length === 0) {
        return ''
      }
      try {
        const lines = context.cashProjects
          .filter((p: any) => p && p.name && p.transactionCount > 0)
          .map((p: any) => {
            const name = p.name || 'Unknown'
            const inflows = typeof p.inflows === 'number' ? p.inflows.toLocaleString() : '0'
            const outflows = typeof p.outflows === 'number' ? p.outflows.toLocaleString() : '0'
            const netCash = typeof p.netCash === 'number' ? p.netCash.toLocaleString() : '0'
            const count = p.transactionCount || 0
            return `- ${name}: Inflows $${inflows}, Outflows $${outflows}, Net Cash $${netCash} (${count} transactions)`
          })
        return lines.length > 0 ? `\nPROJECT FINANCIALS - CASH FLOW (actual money in/out):\n${lines.join('\n')}\n` : 'No cash transactions assigned to projects yet\n'
      } catch (e) {
        console.error('Error formatting cash projects:', e)
        return ''
      }
    }

    // Build the system prompt
    const systemPrompt = `You are Vantage AI, a financial assistant for a project-based business analytics platform.

You have TWO modes:
1. QUERY MODE - Answer questions about their data
2. ACTION MODE - Help users modify their data in bulk

IMPORTANT RULES:
- ONLY use numbers from the data provided below. NEVER make up or estimate numbers.
- If you don't have data to answer a question, say "I don't have that data" rather than guessing.
- Do NOT use markdown formatting like ** or __ in your responses. Use plain text only.
- Be concise and direct.

DATABASE SUMMARY:
- Total transactions: ${stats.total}
- Uncategorized: ${stats.uncategorized}
- Without project assigned: ${stats.unassignedProject}

EXISTING PROJECTS: ${existingProjects.join(', ') || 'None'}
${formatAcrrualProjects()}${formatCashProjects()}
CATEGORIES AVAILABLE: revenue, opex, overhead, investment

${transactionSection}

${context?.metrics ? `
KEY METRICS:
- Total Revenue: $${(context.metrics.totalRevenue || 0).toLocaleString()}
- Total Expenses: $${(context.metrics.totalExpenses || 0).toLocaleString()}
- Net Cash Flow: $${(context.metrics.netCashFlow || 0).toLocaleString()}
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

    // Parse action block if present - try multiple patterns
    let actionData = null
    let cleanMessage = assistantMessage

    // Try to find and parse vantage-action block
    // Pattern 1: Standard markdown code block
    let actionMatch = assistantMessage.match(/```vantage-action\s*([\s\S]*?)```/)
    
    // Pattern 2: With newlines
    if (!actionMatch) {
      actionMatch = assistantMessage.match(/```vantage-action\n([\s\S]*?)\n```/)
    }
    
    // Pattern 3: Look for the JSON structure after vantage-action
    if (!actionMatch) {
      const startIdx = assistantMessage.indexOf('vantage-action')
      if (startIdx !== -1) {
        const afterMarker = assistantMessage.substring(startIdx + 14)
        const jsonStart = afterMarker.indexOf('{')
        if (jsonStart !== -1) {
          // Find matching closing brace
          let braceCount = 0
          let jsonEnd = -1
          for (let i = jsonStart; i < afterMarker.length; i++) {
            if (afterMarker[i] === '{') braceCount++
            if (afterMarker[i] === '}') braceCount--
            if (braceCount === 0) {
              jsonEnd = i + 1
              break
            }
          }
          if (jsonEnd !== -1) {
            actionMatch = [null, afterMarker.substring(jsonStart, jsonEnd)]
          }
        }
      }
    }

    if (actionMatch && actionMatch[1]) {
      try {
        const jsonStr = actionMatch[1].trim()
        actionData = JSON.parse(jsonStr)
        console.log('Parsed action data successfully:', actionData.summary)
        
        // Remove the entire code block from message
        cleanMessage = assistantMessage
          .replace(/```vantage-action[\s\S]*?```/g, '')
          .replace(/`{3}vantage-action[\s\S]*?`{3}/g, '')
          .trim()
        
        // If still contains JSON, try to remove it
        if (cleanMessage.includes('"action"') && cleanMessage.includes('"bulk_update"')) {
          const jsonStartIdx = cleanMessage.indexOf('{')
          const jsonEndIdx = cleanMessage.lastIndexOf('}')
          if (jsonStartIdx !== -1 && jsonEndIdx !== -1) {
            cleanMessage = cleanMessage.substring(0, jsonStartIdx).trim()
          }
        }
      } catch (e) {
        console.error('Failed to parse action JSON:', e)
        console.error('Raw match:', actionMatch[1]?.substring(0, 200))
      }
    }

    return NextResponse.json({ 
      message: cleanMessage,
      action: actionData,
      usage: data.usage,
      debug: {
        searchTerms,
        matchCount: matchingTransactions.length,
        stats,
        hadActionBlock: !!actionMatch
      }
    })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
