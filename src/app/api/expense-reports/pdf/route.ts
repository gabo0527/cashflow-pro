// src/app/api/expense-reports/pdf/route.ts
// ============================================================
// MANO-BRANDED EXPENSE REPORT PDF (admin export)
// ============================================================
// GET /api/expense-reports/pdf?report_id=...
// - Admin-only (Supabase token + allowlist, same as /review)
// - Generates the client-ready PDF that replaces the manual
//   mano-expensegenerator workflow:
//     Page 1  — Mano-branded cover: gold bar, small logo,
//               client headline, midnight TOTAL block,
//               category summary (item counts + grand total)
//     Pages 2+ — every receipt, appended full-page
//               (images embedded, PDF receipts merged)
// - A receipt that cannot be embedded gets a placeholder page
//   rather than silently disappearing.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { getSupabaseAdmin } from '@/lib/contractor-auth'
import { isAdminEmail } from '@/lib/admin-allowlist'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MANO_LOGO_B64 =
  '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'

const GOLD = rgb(0.992, 0.816, 0.204)      // #FDD034
const GOLD_DARK = rgb(0.831, 0.663, 0.0)   // #D4A900
const MIDNIGHT = rgb(0.086, 0.11, 0.122)   // #161C1F
const INK = rgb(0.06, 0.09, 0.16)
const GRAY = rgb(0.42, 0.47, 0.55)
const LIGHT = rgb(0.93, 0.945, 0.955)
const WHITE = rgb(1, 1, 1)

const CATEGORY_LABELS: Record<string, string> = {
  mixed: 'Mixed / Multiple', travel: 'Travel', meal: 'Meals',
  transportation: 'Transportation', hotel: 'Hotel', software: 'Software', other: 'Other',
}

const fmtUsd = (v: number) =>
  '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

async function verifyAdmin(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.replace('Bearer ', '').trim()
  if (!token) return null
  const admin = getSupabaseAdmin()
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user?.email) return null
  return isAdminEmail(data.user.email) ? data.user.email : null
}

export async function GET(req: NextRequest) {
  const adminEmail = await verifyAdmin(req)
  if (!adminEmail) return NextResponse.json({ error: 'Not authorized' }, { status: 401 })

  const reportId = req.nextUrl.searchParams.get('report_id')
  if (!reportId) return NextResponse.json({ error: 'Missing report_id' }, { status: 400 })

  const supabase = getSupabaseAdmin()

  const { data: report } = await supabase
    .from('expense_reports')
    .select('id, team_member_id, client_id, title, description, status, trip_start, trip_end, approved_at, submitted_at, created_at')
    .eq('id', reportId)
    .single()
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 })
  if (report.status === 'draft') {
    return NextResponse.json({ error: 'Draft reports cannot be exported' }, { status: 400 })
  }

  const [{ data: lines }, { data: member }, clientRes] = await Promise.all([
    supabase.from('contractor_expenses')
      .select('id, date, description, category, amount, currency, original_amount, fx_rate, receipt_url')
      .eq('report_id', reportId).order('date', { ascending: true }),
    supabase.from('team_members').select('name').eq('id', report.team_member_id).single(),
    report.client_id
      ? supabase.from('clients').select('name').eq('id', report.client_id).single()
      : Promise.resolve({ data: null } as any),
  ])
  const lineRows = lines || []
  const total = Math.round(lineRows.reduce((s: number, l: any) => s + (l.amount || 0), 0) * 100) / 100
  const clientName = clientRes?.data?.name || 'Mano CG — Internal'
  const contractorName = member?.name || 'Contractor'

  // Period label: trip window if present, else the approval/submission month
  const baseDate = (report.trip_start || report.approved_at || report.submitted_at || report.created_at || '').split('T')[0]
  const period = baseDate
    ? new Date(baseDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : ''

  // Category summary: counts per category (per the approved format)
  const byCat: Record<string, number> = {}
  lineRows.forEach((l: any) => { const c = l.category || 'other'; byCat[c] = (byCat[c] || 0) + 1 })
  const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1])

  // ============ BUILD PDF ============
  const pdf = await PDFDocument.create()
  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  const helvBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const courierBold = await pdf.embedFont(StandardFonts.CourierBold)

  const page = pdf.addPage([612, 792]) // US Letter
  const W = 612
  const M = 54 // margin

  // Gold bar
  page.drawRectangle({ x: 0, y: 792 - 14, width: W, height: 14, color: GOLD })

  // Logo — small and clean (~1.3in wide)
  let y = 792 - 14 - 30
  try {
    const logoBytes = Uint8Array.from(atob(MANO_LOGO_B64), c => c.charCodeAt(0))
    const logo = await pdf.embedPng(logoBytes)
    const logoW = 94
    const logoH = (logo.height / logo.width) * logoW
    page.drawImage(logo, { x: M, y: y - logoH, width: logoW, height: logoH })
    y -= logoH
  } catch (err) {
    console.warn('logo embed failed:', err)
    page.drawText('MANO CG', { x: M, y: y - 12, size: 14, font: helvBold, color: MIDNIGHT })
    y -= 12
  }

  // Hairline
  y -= 14
  page.drawRectangle({ x: M, y, width: W - 2 * M, height: 0.7, color: LIGHT })

  // Eyebrow
  y -= 26
  page.drawText('EXPENSE REPORT', { x: M, y, size: 9, font: helvBold, color: GOLD_DARK })

  // Client headline
  y -= 30
  page.drawText(clientName, { x: M, y, size: 26, font: helvBold, color: INK })

  // Period + contractor
  y -= 20
  page.drawText(period, { x: M, y, size: 11, font: helv, color: GRAY })
  const cw = helv.widthOfTextAtSize(contractorName, 11)
  page.drawText(contractorName, { x: W - M - cw, y, size: 11, font: helv, color: GRAY })

  // Midnight total block
  y -= 22
  const blockH = 74
  y -= blockH
  page.drawRectangle({ x: M, y, width: W - 2 * M, height: blockH, color: MIDNIGHT })
  page.drawText('TOTAL USD', { x: M + 20, y: y + blockH - 24, size: 8.5, font: helvBold, color: GOLD })
  page.drawText(fmtUsd(total), { x: M + 20, y: y + 18, size: 26, font: courierBold, color: WHITE })
  const liLabel = `${lineRows.length} line item${lineRows.length === 1 ? '' : 's'}`
  const liw = helv.widthOfTextAtSize(liLabel, 9.5)
  page.drawText(liLabel, { x: W - M - 20 - liw, y: y + 20, size: 9.5, font: helv, color: rgb(0.62, 0.66, 0.72) })

  // Summary by Category
  y -= 40
  page.drawText('Summary by Category', { x: M, y, size: 13, font: helvBold, color: INK })
  y -= 6
  page.drawRectangle({ x: M, y, width: 118, height: 2.2, color: GOLD })

  // Table header
  y -= 24
  page.drawText('CATEGORY', { x: M + 2, y, size: 8, font: helvBold, color: GRAY })
  const itHdr = 'ITEMS'
  page.drawText(itHdr, { x: W - M - 2 - helvBold.widthOfTextAtSize(itHdr, 8), y, size: 8, font: helvBold, color: GRAY })
  y -= 6
  page.drawRectangle({ x: M, y, width: W - 2 * M, height: 1.2, color: MIDNIGHT })

  // Rows
  for (const [cat, count] of catRows) {
    y -= 20
    page.drawText(CATEGORY_LABELS[cat] || cat, { x: M + 2, y, size: 10.5, font: helv, color: rgb(0.2, 0.25, 0.33) })
    const cs = String(count)
    page.drawText(cs, { x: W - M - 2 - helv.widthOfTextAtSize(cs, 10.5), y, size: 10.5, font: helv, color: GRAY })
    y -= 6
    page.drawRectangle({ x: M, y, width: W - 2 * M, height: 0.6, color: LIGHT })
  }

  // Total band — midnight with gold figure
  y -= 28
  page.drawRectangle({ x: M, y, width: W - 2 * M, height: 26, color: MIDNIGHT })
  page.drawText('Total — ', { x: M + 12, y: y + 8.5, size: 10.5, font: helvBold, color: WHITE })
  const tW = helvBold.widthOfTextAtSize('Total — ', 10.5)
  page.drawText(fmtUsd(total), { x: M + 12 + tW, y: y + 8.5, size: 10.5, font: helvBold, color: GOLD })
  const tc = String(lineRows.length)
  page.drawText(tc, { x: W - M - 12 - helvBold.widthOfTextAtSize(tc, 10.5), y: y + 8.5, size: 10.5, font: helvBold, color: WHITE })

  // Receipts note + footer
  const receiptsWithFiles = lineRows.filter((l: any) => l.receipt_url)
  if (receiptsWithFiles.length > 0) {
    y -= 22
    page.drawText(`Receipts attached: pages 2\u2013${1 + receiptsWithFiles.length}`, { x: M, y, size: 8.5, font: helv, color: GRAY })
  }
  page.drawText('Mano CG \u00B7 Expense Report', { x: M, y: 36, size: 8, font: helv, color: rgb(0.62, 0.66, 0.72) })

  // ============ APPEND RECEIPTS ============
  for (const ln of receiptsWithFiles) {
    const path = String(ln.receipt_url).split(',')[0].trim()
    let embedded = false
    try {
      const { data: file } = await supabase.storage.from('contractor-uploads').download(path)
      if (file) {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const lower = path.toLowerCase()
        if (lower.endsWith('.pdf')) {
          const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
          const copied = await pdf.copyPages(src, src.getPageIndices())
          copied.forEach(p => pdf.addPage(p))
          embedded = true
        } else {
          const img = lower.endsWith('.png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
          const rp = pdf.addPage([612, 792])
          const maxW = 612 - 72, maxH = 792 - 100
          const scale = Math.min(maxW / img.width, maxH / img.height, 1)
          const w = img.width * scale, h = img.height * scale
          rp.drawImage(img, { x: (612 - w) / 2, y: (792 - h) / 2, width: w, height: h })
          rp.drawText(`${ln.description || 'Receipt'} \u00B7 ${fmtUsd(ln.amount || 0)}`, { x: 36, y: 24, size: 8, font: helv, color: GRAY })
          embedded = true
        }
      }
    } catch (err) {
      console.warn('receipt embed failed for', path, err)
    }
    if (!embedded) {
      const ph = pdf.addPage([612, 792])
      ph.drawText('Receipt could not be embedded', { x: 54, y: 740, size: 13, font: helvBold, color: INK })
      ph.drawText(`${ln.description || 'Receipt'} \u00B7 ${fmtUsd(ln.amount || 0)} \u00B7 view the original in Vantage`, { x: 54, y: 718, size: 10, font: helv, color: GRAY })
    }
  }

  const bytes = await pdf.save()
  const slug = String(report.title).replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 60)
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Expense_Report_${slug}.pdf"`,
      'Cache-Control': 'no-store',
    },
  })
}
