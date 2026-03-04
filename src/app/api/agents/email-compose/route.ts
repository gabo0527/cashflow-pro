// src/app/api/agents/email-compose/route.ts
// ============================================================
// Email Composer Agent — Standalone endpoint for email drafting
// Can be called directly or via Sage chat
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { composeEmail } from '@/lib/email-compose'

export async function POST(request: NextRequest) {
  try {
    const { instruction, contractorId, contractorName, contractorEmail } = await request.json()

    if (!instruction) {
      return NextResponse.json({ error: 'Instruction is required' }, { status: 400 })
    }

    const result = await composeEmail(instruction, contractorName, contractorId, contractorEmail)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to compose email' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      draft: result.draft,
      provider: result.provider,
      model: result.model,
    })

  } catch (error) {
    console.error('Email compose route error:', error)
    return NextResponse.json(
      { error: 'Failed to compose email', details: (error as Error).message },
      { status: 500 }
    )
  }
}
