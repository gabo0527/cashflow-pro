// src/app/api/notify/route.ts
// ============================================================
// Notification Trigger API — Called by frontend after status changes
// Sends branded email notifications via Resend
// ============================================================

import { NextResponse } from "next/server"
import {
  notifyInvoiceStatusChange,
  notifyExpenseStatusChange,
  notifyAdminInvoiceSubmitted,
  notifyAdminExpenseSubmitted,
} from "@/lib/notifications"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, id, status, notes, paidDate, paymentMethod } = body

    if (!type || !id || !status) {
      return NextResponse.json({ error: "Missing type, id, or status" }, { status: 400 })
    }

    let result

    if (type === "invoice") {
      // Always notify contractor of status change
      result = await notifyInvoiceStatusChange(id, status, undefined, notes, paidDate, paymentMethod)
      // On submission — also notify admin in real-time
      if (status === "submitted") {
        notifyAdminInvoiceSubmitted(id).catch(err =>
          console.warn("Admin invoice notification failed (non-blocking):", err)
        )
      }
    } else if (type === "expense") {
      // Always notify contractor of status change
      result = await notifyExpenseStatusChange(id, status, notes)
      // On submission — also notify admin in real-time
      if (status === "submitted") {
        notifyAdminExpenseSubmitted(id).catch(err =>
          console.warn("Admin expense notification failed (non-blocking):", err)
        )
      }
    } else if (type === "timesheet") {
      // Timesheet submissions are handled via the weekly digest cron
      // No immediate contractor email needed — just return success
      result = { success: true, id: null }
    } else {
      return NextResponse.json({ error: "Invalid type. Use 'invoice', 'expense', or 'timesheet'" }, { status: 400 })
    }

    return NextResponse.json({ success: result.success, id: result.id || null })
  } catch (error) {
    console.error("Notify API error:", error)
    return NextResponse.json(
      { error: "Failed to send notification", details: (error as Error).message },
      { status: 500 }
    )
  }
}
