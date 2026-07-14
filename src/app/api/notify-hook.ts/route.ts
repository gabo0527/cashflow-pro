// src/app/api/notify-hook/route.ts
// ============================================================
// Supabase Database Webhook receiver
// Fires server-side on INSERT into contractor_invoices / contractor_expenses.
// Browser-independent — guarantees admin notification even if the
// contractor closes the tab. Idempotent (guarded by admin_notified_at),
// so Supabase webhook retries never double-send.
// ============================================================

import { NextResponse } from "next/server"
import { notifyAdminInvoiceSubmitted, notifyAdminExpenseSubmitted } from "@/lib/notifications"

function verify(request: Request): boolean {
  const secret = request.headers.get("x-notify-secret")
  return !!process.env.NOTIFY_HOOK_SECRET && secret === process.env.NOTIFY_HOOK_SECRET
}

export async function POST(request: Request) {
  if (!verify(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const body = await request.json()
    const table = body?.table as string | undefined
    const record = body?.record as { id?: string; status?: string } | undefined
    if (!record?.id || !table) {
      return NextResponse.json({ ok: true, skipped: "no record id or table" })
    }

    // Drafts are private working state — admin is notified on
    // SUBMISSION only, never when a draft line is created.
    if (record.status === "draft") {
      return NextResponse.json({ ok: true, skipped: "draft record" })
    }

    let result
    if (table === "contractor_invoices") {
      result = await notifyAdminInvoiceSubmitted(record.id)
    } else if (table === "contractor_expenses") {
      result = await notifyAdminExpenseSubmitted(record.id)
    } else {
      return NextResponse.json({ ok: true, skipped: `unhandled table: ${table}` })
    }

    return NextResponse.json({ ok: true, sent: result?.success ?? false })
  } catch (error) {
    console.error("notify-hook error:", error)
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
