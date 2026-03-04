// src/app/api/cron/eom-reminder/route.ts
// ============================================================
// End-of-Month Invoice Reminder — Vercel Cron
// Runs on the 25th (first reminder) and 28th (second reminder)
// Only emails contractors who have NOT yet submitted an invoice
// ============================================================

import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendEOMReminderEmail, type EOMReminderEmailData } from "@/lib/email"

// Verify cron secret to prevent unauthorized triggers
function verifyCron(request: Request): boolean {
  const authHeader = request.headers.get("authorization")
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true
  // Also allow manual trigger from admin with API key
  const url = new URL(request.url)
  if (url.searchParams.get("key") === process.env.CRON_SECRET) return true
  return false
}

export async function GET(request: Request) {
  // Verify authorization
  if (!verifyCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  )

  try {
    const now = new Date()
    const dayOfMonth = now.getDate()
    const isSecondReminder = dayOfMonth >= 28

    // Determine which month we're reminding about
    // If it's the 25th-31st, remind about the CURRENT month
    const targetYear = now.getFullYear()
    const targetMonth = now.getMonth() // 0-indexed
    const monthName = now.toLocaleDateString("en-US", { month: "long", year: "numeric" })

    // First day of next month = invoice due date
    const nextMonth = new Date(targetYear, targetMonth + 1, 1)
    const dueDate = nextMonth.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

    // Period for time entries: first and last day of target month
    const periodStart = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-01`
    const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate()
    const periodEnd = `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`

    console.log(`EOM Reminder: ${monthName}, isSecond=${isSecondReminder}, period=${periodStart} to ${periodEnd}`)

    // Get all active contractors with emails
    // Filter: employment_type is 1099 or contractor, status is active
    const { data: contractors, error: teamError } = await supabase
      .from("team_members")
      .select("id, name, email, company_id, cost_type, cost_amount")
      .or("employment_type.eq.1099,employment_type.eq.contractor")
      .eq("is_active", true)
      .not("email", "is", null)

    if (teamError || !contractors || contractors.length === 0) {
      console.log("No active contractors found:", teamError)
      return NextResponse.json({ message: "No contractors to notify", sent: 0 })
    }

    const results: { name: string; email: string; sent: boolean; reason?: string }[] = []

    for (const contractor of contractors) {
      if (!contractor.email) continue

      // Check if they already submitted an invoice for this month
      const { data: existingInvoice } = await supabase
        .from("contractor_invoices")
        .select("id, status")
        .eq("contractor_id", contractor.id)
        .gte("period_start", periodStart)
        .lte("period_start", periodEnd)
        .limit(1)

      const hasInvoice = existingInvoice && existingInvoice.length > 0

      // If they already submitted AND it's the first reminder, skip
      if (hasInvoice && !isSecondReminder) {
        results.push({ name: contractor.name, email: contractor.email, sent: false, reason: "Already submitted" })
        continue
      }

      // If they submitted AND it's paid/approved, skip even on second reminder
      if (hasInvoice && existingInvoice[0].status === "paid") {
        results.push({ name: contractor.name, email: contractor.email, sent: false, reason: "Already paid" })
        continue
      }

      // Get their hours for the month
      const { data: timeEntries } = await supabase
        .from("time_entries")
        .select(`
          hours,
          project_id,
          projects!project_id (name)
        `)
        .eq("contractor_id", contractor.id)
        .gte("date", periodStart)
        .lte("date", periodEnd)

      const totalHours = timeEntries?.reduce((sum, t) => sum + (t.hours || 0), 0) || 0

      // Group hours by project
      const projectHours: Record<string, { project: string; hours: number }> = {}
      timeEntries?.forEach(t => {
        const projName = (t.projects as any)?.name || "Unknown"
        if (!projectHours[projName]) projectHours[projName] = { project: projName, hours: 0 }
        projectHours[projName].hours += t.hours || 0
      })

      // Skip if they logged zero hours (probably inactive this month)
      if (totalHours === 0 && !hasInvoice) {
        results.push({ name: contractor.name, email: contractor.email, sent: false, reason: "No hours logged" })
        continue
      }

      // Calculate estimated invoice amount for hourly contractors
      const isHourly = contractor.cost_type === "hourly"
      const isFixed = contractor.cost_type === "lump_sum"
      let estimatedInvoiceAmount: number | undefined

      if (isHourly && totalHours > 0) {
        // Get their bill rates to estimate invoice
        const { data: rates } = await supabase
          .from("bill_rates")
          .select("rate, client_id")
          .eq("team_member_id", contractor.id)
          .eq("is_active", true)

        if (rates && rates.length > 0) {
          // Use average rate across all active assignments as estimate
          const avgRate = rates.reduce((sum, r) => sum + (r.rate || 0), 0) / rates.length
          estimatedInvoiceAmount = totalHours * avgRate
        }
      }

      const emailData: EOMReminderEmailData = {
        contractorName: contractor.name?.split(" ")[0] || contractor.name || "there",
        contractorEmail: contractor.email,
        month: monthName,
        hasExistingInvoice: !!hasInvoice,
        totalHoursLogged: totalHours,
        projectBreakdown: Object.values(projectHours).sort((a, b) => b.hours - a.hours),
        dueDate,
        isSecondReminder,
        costType: isFixed ? "lump_sum" : "hourly",
        fixedMonthlyAmount: isFixed ? (contractor.cost_amount || 0) : undefined,
        estimatedInvoiceAmount,
      }

      const sendResult = await sendEOMReminderEmail(emailData)
      results.push({
        name: contractor.name,
        email: contractor.email,
        sent: sendResult.success,
        reason: sendResult.success ? undefined : String(sendResult.error),
      })

      // Log notification
      if (sendResult.success) {
        await supabase.from("notification_log").insert({
          type: isSecondReminder ? "eom_reminder_2" : "eom_reminder_1",
          recipient_email: contractor.email,
          recipient_name: contractor.name,
          reference_type: "eom_invoice_reminder",
          status: "sent",
          metadata: {
            month: monthName,
            total_hours: totalHours,
            has_existing_invoice: hasInvoice,
            email_id: sendResult.id,
          },
        }).then(({ error }) => {
          if (error) console.warn("Failed to log notification:", error.message)
        })
      }
    }

    const sent = results.filter(r => r.sent).length
    const skipped = results.filter(r => !r.sent).length

    console.log(`EOM Reminder complete: ${sent} sent, ${skipped} skipped`)

    return NextResponse.json({
      success: true,
      month: monthName,
      isSecondReminder,
      sent,
      skipped,
      results,
    })

  } catch (error) {
    console.error("EOM reminder cron error:", error)
    return NextResponse.json(
      { error: "Failed to run EOM reminder", details: (error as Error).message },
      { status: 500 }
    )
  }
}
