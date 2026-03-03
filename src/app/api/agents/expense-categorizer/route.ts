/**
 * Agent: Expense Categorizer
 * 
 * Auto-categorizes uncategorized transactions from QuickBooks sync.
 * Routes to OpenAI for fast structured output.
 * Learns from existing categorizations as training examples.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { aiStructured } from '@/lib/ai-router'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Category Definitions ────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'labor', label: 'Labor / Payroll' },
  { id: 'subcontractor', label: 'Subcontractors' },
  { id: 'travel', label: 'Travel & Transportation' },
  { id: 'meals', label: 'Meals & Entertainment' },
  { id: 'office', label: 'Office & Supplies' },
  { id: 'software', label: 'Software & Subscriptions' },
  { id: 'insurance', label: 'Insurance' },
  { id: 'professional', label: 'Professional Services (Legal, Accounting)' },
  { id: 'equipment', label: 'Equipment & Tools' },
  { id: 'rent', label: 'Rent & Facilities' },
  { id: 'utilities', label: 'Utilities & Phone' },
  { id: 'marketing', label: 'Marketing & Business Development' },
  { id: 'vehicle', label: 'Vehicle & Gas' },
  { id: 'taxes', label: 'Taxes & Licenses' },
  { id: 'other', label: 'Other / Uncategorized' },
]

// ─── Core Logic ──────────────────────────────────────────────────────────────

interface CategorizeResult {
  transaction_id: string
  description: string
  amount: number
  suggested_category: string
  confidence: number
  reasoning: string
}

async function getTrainingExamples(companyId: string, limit = 50): Promise<string> {
  // Fetch recently categorized transactions as training data
  const { data } = await supabase
    .from('transactions')
    .select('description, amount, category, client_id, project_id')
    .eq('company_id', companyId)
    .not('category', 'is', null)
    .not('category', 'eq', '')
    .order('date', { ascending: false })
    .limit(limit)

  if (!data?.length) return 'No training examples available.'

  return data.map(t =>
    `"${(t.description || '').slice(0, 80)}" ($${t.amount}) → ${t.category}`
  ).join('\n')
}

async function categorizeTransactions(
  transactions: any[],
  trainingExamples: string
): Promise<CategorizeResult[]> {
  // Process in batches of 20 to stay within token limits
  const batchSize = 20
  const results: CategorizeResult[] = []

  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize)

    const prompt = `Categorize these business transactions for a construction/consulting Owner's Representative firm.

AVAILABLE CATEGORIES:
${CATEGORIES.map(c => `- ${c.id}: ${c.label}`).join('\n')}

EXAMPLES OF PREVIOUS CATEGORIZATIONS (learn from these patterns):
${trainingExamples}

TRANSACTIONS TO CATEGORIZE:
${batch.map((t, idx) => `${idx + 1}. "${(t.description || 'No description').slice(0, 100)}" — $${Math.abs(t.amount || 0).toFixed(2)} (${t.txn_type || 'unknown'})`).join('\n')}

Return a JSON array of objects with these fields for each transaction:
- index (number, 1-based matching the list above)
- category (string, must be one of the category IDs above)
- confidence (number 0-1, how confident you are)
- reasoning (string, brief explanation)`

    const result = await aiStructured<{
      index: number
      category: string
      confidence: number
      reasoning: string
    }[]>(prompt, 'You are a financial categorization agent for a consulting/construction firm. Be precise. When unsure, use "other" with low confidence.')

    // Map AI results back to transactions
    const parsed = Array.isArray(result.data) ? result.data : []
    batch.forEach((t, idx) => {
      const match = parsed.find(r => r.index === idx + 1)
      results.push({
        transaction_id: t.id,
        description: t.description || '',
        amount: t.amount || 0,
        suggested_category: match?.category || 'other',
        confidence: match?.confidence || 0,
        reasoning: match?.reasoning || 'No analysis available',
      })
    })
  }

  return results
}

// ─── API Route ───────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { action, companyId, transactionIds, autoApplyThreshold } = await request.json()

    if (!companyId) {
      return NextResponse.json({ error: 'companyId required' }, { status: 400 })
    }

    // Categorize uncategorized transactions
    if (action === 'categorize-pending') {
      const { data: uncategorized } = await supabase
        .from('transactions')
        .select('id, description, amount, txn_type, date')
        .eq('company_id', companyId)
        .or('category.is.null,category.eq.')
        .order('date', { ascending: false })
        .limit(100)

      if (!uncategorized?.length) {
        return NextResponse.json({ message: 'No uncategorized transactions found', results: [] })
      }

      const examples = await getTrainingExamples(companyId)
      const results = await categorizeTransactions(uncategorized, examples)

      // Auto-apply high-confidence categorizations
      const threshold = autoApplyThreshold || 0.85
      const autoApplied: string[] = []
      const needsReview: CategorizeResult[] = []

      for (const r of results) {
        if (r.confidence >= threshold) {
          const { error } = await supabase
            .from('transactions')
            .update({ category: r.suggested_category })
            .eq('id', r.transaction_id)

          if (!error) autoApplied.push(r.transaction_id)
          else needsReview.push(r)
        } else {
          needsReview.push(r)
        }
      }

      return NextResponse.json({
        summary: {
          total: results.length,
          auto_applied: autoApplied.length,
          needs_review: needsReview.length,
          threshold,
        },
        auto_applied: results.filter(r => autoApplied.includes(r.transaction_id)),
        needs_review: needsReview,
      })
    }

    // Categorize specific transactions
    if (action === 'categorize' && transactionIds?.length) {
      const { data: transactions } = await supabase
        .from('transactions')
        .select('id, description, amount, txn_type, date')
        .in('id', transactionIds)

      if (!transactions?.length) {
        return NextResponse.json({ error: 'No transactions found' }, { status: 404 })
      }

      const examples = await getTrainingExamples(companyId)
      const results = await categorizeTransactions(transactions, examples)

      return NextResponse.json({ results })
    }

    // Preview: show what would be categorized without applying
    if (action === 'preview') {
      const { data: uncategorized } = await supabase
        .from('transactions')
        .select('id, description, amount, txn_type, date')
        .eq('company_id', companyId)
        .or('category.is.null,category.eq.')
        .order('date', { ascending: false })
        .limit(20)

      if (!uncategorized?.length) {
        return NextResponse.json({ message: 'No uncategorized transactions', results: [] })
      }

      const examples = await getTrainingExamples(companyId)
      const results = await categorizeTransactions(uncategorized, examples)

      return NextResponse.json({
        preview: true,
        count: results.length,
        results,
      })
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: categorize-pending, categorize, or preview' },
      { status: 400 }
    )

  } catch (error) {
    console.error('[Agent: Expense Categorizer]', error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
