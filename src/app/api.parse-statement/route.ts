// src/app/api/parse-statement/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    
    // Determine media type
    const fileType = file.type
    let mediaType = 'image/png'
    if (fileType === 'application/pdf') {
      mediaType = 'application/pdf'
    } else if (fileType === 'image/jpeg' || fileType === 'image/jpg') {
      mediaType = 'image/jpeg'
    } else if (fileType === 'image/png') {
      mediaType = 'image/png'
    } else if (fileType === 'image/webp') {
      mediaType = 'image/webp'
    }

    // Build the content based on file type
    const content = mediaType === 'application/pdf' 
      ? [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64
            }
          },
          {
            type: 'text',
            text: `You are a financial data extraction assistant. Extract ALL transactions from this bank statement.

For EACH transaction, extract:
- date: The transaction date in YYYY-MM-DD format
- description: The transaction description/memo (merchant name, reference, etc.)
- amount: The numeric amount (positive number)
- type: Either "credit" (money in - deposits, transfers in) or "debit" (money out - payments, withdrawals, fees)
- category_suggestion: Your best guess for category (revenue, opex, payroll, overhead, investment, transfer, fee)
- vendor: Extract vendor/merchant name if identifiable

IMPORTANT:
- Extract EVERY transaction you can see, even partial ones
- Use YYYY-MM-DD format for dates (assume current year if not shown)
- Amount should be a positive number (use type to indicate direction)
- If you see a running balance column, ignore it - focus on transaction amounts
- For descriptions, clean up extra spaces but keep the essential info

Respond with ONLY a valid JSON object in this exact format:
{
  "transactions": [
    {
      "date": "2025-01-15",
      "description": "PAYROLL ADP",
      "amount": 5000.00,
      "type": "debit",
      "category_suggestion": "payroll",
      "vendor": "ADP"
    }
  ],
  "account_info": {
    "bank_name": "Bank name if visible",
    "account_ending": "Last 4 digits if visible",
    "statement_period": "Date range if visible"
  },
  "extraction_notes": "Any issues or uncertainties"
}`
          }
        ]
      : [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64
            }
          },
          {
            type: 'text',
            text: `You are a financial data extraction assistant. Extract ALL transactions from this bank statement image.

For EACH transaction, extract:
- date: The transaction date in YYYY-MM-DD format
- description: The transaction description/memo (merchant name, reference, etc.)
- amount: The numeric amount (positive number)
- type: Either "credit" (money in - deposits, transfers in) or "debit" (money out - payments, withdrawals, fees)
- category_suggestion: Your best guess for category (revenue, opex, payroll, overhead, investment, transfer, fee)
- vendor: Extract vendor/merchant name if identifiable

IMPORTANT:
- Extract EVERY transaction you can see, even partial ones
- Use YYYY-MM-DD format for dates (assume current year if not shown)
- Amount should be a positive number (use type to indicate direction)
- If you see a running balance column, ignore it - focus on transaction amounts
- For descriptions, clean up extra spaces but keep the essential info

Respond with ONLY a valid JSON object in this exact format:
{
  "transactions": [
    {
      "date": "2025-01-15",
      "description": "PAYROLL ADP",
      "amount": 5000.00,
      "type": "debit",
      "category_suggestion": "payroll",
      "vendor": "ADP"
    }
  ],
  "account_info": {
    "bank_name": "Bank name if visible",
    "account_ending": "Last 4 digits if visible",
    "statement_period": "Date range if visible"
  },
  "extraction_notes": "Any issues or uncertainties"
}`
          }
        ]

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [
          {
            role: 'user',
            content: content
          }
        ]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Anthropic API error:', errorText)
      return NextResponse.json({ error: 'Failed to process statement', details: errorText }, { status: 500 })
    }

    const data = await response.json()
    const assistantMessage = data.content?.[0]?.text || ''

    // Parse the JSON response
    try {
      // Try to extract JSON from the response (in case there's extra text)
      const jsonMatch = assistantMessage.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return NextResponse.json({ error: 'Could not parse response', raw: assistantMessage }, { status: 500 })
      }
      
      const parsed = JSON.parse(jsonMatch[0])
      
      // Validate and clean the transactions
      const transactions = (parsed.transactions || []).map((t: any, index: number) => ({
        id: `stmt-${Date.now()}-${index}`,
        date: t.date || new Date().toISOString().split('T')[0],
        description: t.description || 'Unknown',
        amount: Math.abs(parseFloat(t.amount) || 0),
        type: t.type === 'credit' ? 'credit' : 'debit',
        category_suggestion: t.category_suggestion || 'opex',
        vendor: t.vendor || '',
        confidence: 0.8 // Default confidence
      }))

      return NextResponse.json({
        success: true,
        transactions,
        account_info: parsed.account_info || {},
        extraction_notes: parsed.extraction_notes || '',
        transaction_count: transactions.length
      })

    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      return NextResponse.json({ 
        error: 'Failed to parse extracted data', 
        raw: assistantMessage 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Statement parsing error:', error)
    return NextResponse.json({ 
      error: 'Failed to process statement',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
