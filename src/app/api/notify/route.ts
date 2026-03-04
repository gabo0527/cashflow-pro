// src/app/api/notify/route.ts
// ============================================================
// Notification Trigger API — Called by frontend after status changes
// Sends branded email notifications via Resend
// ============================================================

import { NextResponse } from "next/server"
import { notifyInvoiceStatusChange, notifyExpenseStatusChange } from "@/lib/notifications"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, id, status, notes, paidDate, paymentMethod } = body

    if (!type || !id || !status) {
      return NextResponse.json({ error: "Missing type, id, or status" }, { status: 400 })
    }

    let result

    if (type === "invoice") {
      result = await notifyInvoiceStatusChange(id, status, undefined, notes, paidDate, paymentMethod)
    } else if (type === "expense") {
      result = await notifyExpenseStatusChange(id, status, notes)
    } else {
      return NextResponse.json({ error: "Invalid type. Use 'invoice' or 'expense'" }, { status: 400 })
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
