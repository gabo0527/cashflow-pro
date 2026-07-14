// ============================================================
// RECEIPT SCAN API
// ============================================================
// Path: src/app/api/expenses/scan/route.ts
//
// Reads a receipt photo or PDF with Claude vision and returns
// structured data: merchant, date, currency, line items, total,
// and a suggested category. If the currency is not USD, the ECB
// rate for the TRANSACTION DATE is fetched (frankfurter.app) and
// the USD conversion is included.
//
// Security:
// - Contractor identity comes only from the verified
//   contractor_session cookie.
// - The receipt must already live in the contractor's own folder
//   in Supabase storage (uploaded by the portal); this route
//   downloads it server-side with the service role key.
//
// The AI DRAFTS, the human DECIDES: this route never writes to
// the database. It only returns a proposal for the contractor to
// review, edit, and save as a draft line.
//
// POST body: { storage_path: string }
//   storage_path must start with "expenses/{contractorId}/"
// Response:
//   { ok: true, parsed: {...}, fx: {...} | null }
//   { ok: false, reason: 'unreadable' | string }
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { readSessionFromCookie, getSupabaseAdmin } from '@/lib/contractor-auth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CATEGORY_IDS = ['mixed', 'travel', 'meal', 'transportation', 'hotel', 'software', 'other']

const EXTRACTION_PROMPT = `You are reading a receipt for an expense report. Extract the data and respond with ONLY a JSON object — no preamble, no markdown fences, no explanation.

Schema:
{
  "readable": boolean,          // false if this is not a receipt or is too blurry/incomplete to read reliably
  "merchant": string | null,    // business name as printed
  "date": string | null,        // transaction date as YYYY-MM-DD (the date on the receipt, not today)
  "currency": string | null,    // ISO 4217 code, e.g. "USD", "EUR", "JPY". Infer from symbols/locale if not printed.
  "line_items": [ { "description": string, "amount": number } ],  // itemized lines if legible; empty array if only a total is shown
  "tax": number | null,         // tax amount if shown separately (in receipt currency)
  "total": number | null,       // the final total in receipt currency (after tax, tips, credits)
  "category": string,           // best guess, one of: ${CATEGORY_IDS.join(', ')}
  "notes": string | null        // anything material, e.g. "tip included", "credit applied"
}

Rules:
- Amounts are plain numbers in the receipt's own currency (no symbols, no thousands separators).
- If dates are ambiguous (e.g. 06/07), prefer the locale implied by the receipt language/country.
- total must reflect what was actually paid, including tips and after credits.
- If unreadable, set readable=false and leave other fields null/empty.`

// ------------------------------------------------------------
// FX — ECB reference rates via frankfurter.app (no key needed).
// Weekend/holiday dates resolve to the prior business day's rate
// (frankfurter handles this natively).
// ------------------------------------------------------------
async function fetchUsdRate(currency: string, date: string): Promise<{ rate: number; date_used: string } | null> {
  try {
    const res = await fetch(`https://api.frankfurter.app/${date}?from=${encodeURIComponent(currency)}&to=USD`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const j = await res.json()
    const rate = j?.rates?.USD
    if (typeof rate !== 'number' || !(rate > 0)) return null
    return { rate, date_used: j?.date || date }
  } catch (err) {
    console.error('FX fetch error:', err)
    return null
  }
}

// ------------------------------------------------------------
// POST — scan one receipt
// ------------------------------------------------------------
export async function POST(request: NextRequest) {
  const session = await readSessionFromCookie()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('scan: ANTHROPIC_API_KEY not configured')
    return NextResponse.json({ error: 'Scanning is not configured' }, { status: 500 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const storagePath = body?.storage_path
  if (typeof storagePath !== 'string' || storagePath.length === 0) {
    return NextResponse.json({ error: 'Missing storage_path' }, { status: 400 })
  }
  // A contractor may only scan files in their own expenses folder
  if (!storagePath.startsWith(`expenses/${session.contractorId}/`)) {
    return NextResponse.json({ error: 'Not permitted for this file' }, { status: 403 })
  }

  // Download the receipt server-side
  const supabase = getSupabaseAdmin()
  const { data: fileData, error: dlError } = await supabase.storage.from('contractor-uploads').download(storagePath)
  if (dlError || !fileData) {
    console.error('scan: download failed', dlError)
    return NextResponse.json({ error: 'Could not read the uploaded file' }, { status: 400 })
  }

  const buf = Buffer.from(await fileData.arrayBuffer())
  if (buf.length > 20 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large to scan (20MB max)' }, { status: 400 })
  }
  const base64 = buf.toString('base64')

  // Content block: PDF receipts go as documents, photos as images
  const lowerPath = storagePath.toLowerCase()
  const isPdf = lowerPath.endsWith('.pdf') || fileData.type === 'application/pdf'
  const mediaType = isPdf
    ? 'application/pdf'
    : fileData.type && fileData.type.startsWith('image/')
      ? fileData.type
      : lowerPath.endsWith('.png')
        ? 'image/png'
        : lowerPath.endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg'

  const contentBlock = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
    : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }

  // Claude vision extraction
  let parsed: any
  try {
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: [contentBlock, { type: 'text', text: EXTRACTION_PROMPT }],
          },
        ],
      }),
    })
    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => '')
      console.error('scan: anthropic error', aiRes.status, errText.slice(0, 300))
      return NextResponse.json({ error: 'Receipt reading failed — try again or enter manually' }, { status: 502 })
    }
    const aiJson = await aiRes.json()
    const text = (aiJson?.content || [])
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('')
      .replace(/```json|```/g, '')
      .trim()
    parsed = JSON.parse(text)
  } catch (err) {
    console.error('scan: parse error', err)
    return NextResponse.json({ error: 'Receipt reading failed — try again or enter manually' }, { status: 502 })
  }

  if (!parsed || parsed.readable === false || !(parsed.total > 0)) {
    return NextResponse.json({ ok: false, reason: 'unreadable' })
  }

  // Normalize
  const currency = typeof parsed.currency === 'string' && parsed.currency.length === 3 ? parsed.currency.toUpperCase() : 'USD'
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  const txDate = typeof parsed.date === 'string' && dateRe.test(parsed.date) ? parsed.date : null
  const category = CATEGORY_IDS.includes(parsed.category) ? parsed.category : 'other'
  const lineItems = Array.isArray(parsed.line_items)
    ? parsed.line_items
        .filter((li: any) => li && typeof li.description === 'string' && Number.isFinite(Number(li.amount)))
        .map((li: any) => ({ description: String(li.description).slice(0, 200), amount: Math.round(Number(li.amount) * 100) / 100 }))
        .slice(0, 50)
    : []
  const total = Math.round(Number(parsed.total) * 100) / 100

  // FX — convert to USD at the transaction-date rate
  let fx: { rate: number; date_used: string; usd_total: number } | null = null
  if (currency !== 'USD') {
    if (!txDate) {
      // No reliable date on the receipt: return without conversion; the
      // portal asks the contractor to confirm the date, then re-quotes FX.
      return NextResponse.json({
        ok: true,
        parsed: { merchant: parsed.merchant ?? null, date: null, currency, line_items: lineItems, tax: parsed.tax ?? null, total, category, notes: parsed.notes ?? null },
        fx: null,
        fx_pending: 'date_needed',
      })
    }
    const rateRes = await fetchUsdRate(currency, txDate)
    if (rateRes) {
      fx = { rate: rateRes.rate, date_used: rateRes.date_used, usd_total: Math.round(total * rateRes.rate * 100) / 100 }
    }
    // If the rate lookup fails, fx stays null — the portal shows the
    // original amount and asks the contractor to enter USD manually.
  }

  return NextResponse.json({
    ok: true,
    parsed: {
      merchant: parsed.merchant ?? null,
      date: txDate,
      currency,
      line_items: lineItems,
      tax: parsed.tax ?? null,
      total,
      category,
      notes: parsed.notes ?? null,
    },
    fx,
  })
}

// ------------------------------------------------------------
// GET — re-quote FX for a confirmed date/amount (used when the
// receipt had no readable date, or the contractor edits the date)
//   /api/expenses/scan?currency=EUR&date=2026-07-12&amount=26.00
// ------------------------------------------------------------
export async function GET(request: NextRequest) {
  const session = await readSessionFromCookie()
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  const currency = (request.nextUrl.searchParams.get('currency') || '').toUpperCase()
  const date = request.nextUrl.searchParams.get('date') || ''
  const amount = Number(request.nextUrl.searchParams.get('amount'))
  if (!/^[A-Z]{3}$/.test(currency) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: 'Invalid currency, date, or amount' }, { status: 400 })
  }
  if (currency === 'USD') {
    return NextResponse.json({ ok: true, fx: { rate: 1, date_used: date, usd_total: Math.round(amount * 100) / 100 } })
  }
  const rateRes = await fetchUsdRate(currency, date)
  if (!rateRes) {
    return NextResponse.json({ ok: false, reason: 'rate_unavailable' })
  }
  return NextResponse.json({
    ok: true,
    fx: { rate: rateRes.rate, date_used: rateRes.date_used, usd_total: Math.round(amount * rateRes.rate * 100) / 100 },
  })
}
