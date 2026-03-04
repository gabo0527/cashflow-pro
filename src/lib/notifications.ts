// src/lib/notifications.ts
// ============================================================
// Notification Triggers — Call these from your existing API routes
// when invoice/expense statuses change
// ============================================================

import { createClient } from "@supabase/supabase-js"
import {
  sendInvoiceStatusEmail,
  sendExpenseStatusEmail,
  type InvoiceStatusEmailData,
  type ExpenseStatusEmailData,
} from "./email"

// Server-side Supabase client (use service role for cron jobs)
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  )
}

// ============================================================
// INVOICE STATUS CHANGE TRIGGER
// ============================================================
// Call this whenever you update a contractor_invoice status:
//
//   import { notifyInvoiceStatusChange } from "@/lib/notifications"
//   await notifyInvoiceStatusChange(invoiceId, "approved", userId)
//
// ============================================================
export async function notifyInvoiceStatusChange(
  invoiceId: string,
  newStatus: string,
  updatedBy?: string,
  notes?: string,
  paidDate?: string,
  paymentMethod?: string
) {
  const supabase = getSupabase()

  try {
    // Fetch invoice with contractor details
    const { data: invoice, error: invError } = await supabase
      .from("contractor_invoices")
      .select(`
        id,
        invoice_number,
        amount,
        status,
        period_start,
        period_end,
        contractor_id,
        team_members!contractor_id (
          id,
          name,
          email
        )
      `)
      .eq("id", invoiceId)
      .single()

    if (invError || !invoice) {
      console.error("Failed to fetch invoice for notification:", invError)
      return { success: false, error: invError }
    }

    const contractor = invoice.team_members as any
    if (!contractor?.email) {
      console.log(`No email for contractor ${contractor?.name || invoiceId}, skipping notification`)
      return { success: false, error: "No contractor email" }
    }

    // Don't notify if status hasn't actually changed
    if (invoice.status === newStatus) {
      return { success: false, error: "Status unchanged" }
    }

    const emailData: InvoiceStatusEmailData = {
      contractorName: contractor.name?.split(" ")[0] || contractor.name || "there",
      contractorEmail: contractor.email,
      invoiceNumber: invoice.invoice_number || `INV-${invoiceId.slice(0, 6).toUpperCase()}`,
      invoiceAmount: invoice.amount || 0,
      previousStatus: invoice.status || "submitted",
      newStatus,
      periodStart: invoice.period_start ? formatDate(invoice.period_start) : undefined,
      periodEnd: invoice.period_end ? formatDate(invoice.period_end) : undefined,
      notes,
      paidDate: paidDate ? formatDate(paidDate) : undefined,
      paymentMethod,
    }

    const result = await sendInvoiceStatusEmail(emailData)

    // Log the notification
    if (result.success) {
      await supabase.from("notification_log").insert({
        type: "invoice_status",
        recipient_email: contractor.email,
        recipient_name: contractor.name,
        reference_id: invoiceId,
        reference_type: "contractor_invoice",
        status: "sent",
        metadata: {
          invoice_number: emailData.invoiceNumber,
          previous_status: invoice.status,
          new_status: newStatus,
          email_id: result.id,
        },
      }).then(({ error }) => {
        if (error) console.warn("Failed to log notification (table may not exist):", error.message)
      })
    }

    return result
  } catch (err) {
    console.error("notifyInvoiceStatusChange error:", err)
    return { success: false, error: err }
  }
}

// ============================================================
// EXPENSE STATUS CHANGE TRIGGER
// ============================================================
// Call this whenever you update an expense status:
//
//   import { notifyExpenseStatusChange } from "@/lib/notifications"
//   await notifyExpenseStatusChange(expenseId, "approved")
//
// ============================================================
export async function notifyExpenseStatusChange(
  expenseId: string,
  newStatus: string,
  notes?: string
) {
  const supabase = getSupabase()

  try {
    const { data: expense, error: expError } = await supabase
      .from("project_expenses")
      .select(`
        id,
        description,
        amount,
        date,
        status,
        submitted_by,
        team_members!submitted_by (
          id,
          name,
          email
        )
      `)
      .eq("id", expenseId)
      .single()

    if (expError || !expense) {
      console.error("Failed to fetch expense for notification:", expError)
      return { success: false, error: expError }
    }

    const contractor = expense.team_members as any
    if (!contractor?.email) {
      console.log(`No email for contractor on expense ${expenseId}, skipping`)
      return { success: false, error: "No contractor email" }
    }

    if (expense.status === newStatus) {
      return { success: false, error: "Status unchanged" }
    }

    const emailData: ExpenseStatusEmailData = {
      contractorName: contractor.name?.split(" ")[0] || contractor.name || "there",
      contractorEmail: contractor.email,
      expenseDescription: expense.description || "Expense",
      expenseAmount: Math.abs(expense.amount || 0),
      expenseDate: expense.date ? formatDate(expense.date) : "N/A",
      previousStatus: expense.status || "submitted",
      newStatus,
      notes,
    }

    const result = await sendExpenseStatusEmail(emailData)

    if (result.success) {
      await supabase.from("notification_log").insert({
        type: "expense_status",
        recipient_email: contractor.email,
        recipient_name: contractor.name,
        reference_id: expenseId,
        reference_type: "project_expense",
        status: "sent",
        metadata: {
          description: expense.description,
          previous_status: expense.status,
          new_status: newStatus,
          email_id: result.id,
        },
      }).then(({ error }) => {
        if (error) console.warn("Failed to log notification:", error.message)
      })
    }

    return result
  } catch (err) {
    console.error("notifyExpenseStatusChange error:", err)
    return { success: false, error: err }
  }
}

// ============================================================
// BATCH STATUS UPDATE + NOTIFY
// ============================================================
// Use this when approving/rejecting multiple invoices at once
// from the admin dashboard:
//
//   import { batchUpdateInvoiceStatus } from "@/lib/notifications"
//   await batchUpdateInvoiceStatus(["id1", "id2"], "approved", userId)
//
// ============================================================
export async function batchUpdateInvoiceStatus(
  invoiceIds: string[],
  newStatus: string,
  updatedBy: string,
  notes?: string
) {
  const supabase = getSupabase()
  const results: { id: string; emailSent: boolean; error?: string }[] = []

  // Update all invoices first
  const { error: updateError } = await supabase
    .from("contractor_invoices")
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
      ...(newStatus === "approved" ? { approved_by: updatedBy, approved_at: new Date().toISOString() } : {}),
      ...(newStatus === "paid" ? { paid_date: new Date().toISOString() } : {}),
    })
    .in("id", invoiceIds)

  if (updateError) {
    console.error("Batch update failed:", updateError)
    return { success: false, error: updateError, results: [] }
  }

  // Send notifications for each
  for (const invoiceId of invoiceIds) {
    const result = await notifyInvoiceStatusChange(
      invoiceId,
      newStatus,
      updatedBy,
      notes,
      newStatus === "paid" ? new Date().toISOString() : undefined
    )
    results.push({
      id: invoiceId,
      emailSent: result.success,
      error: result.success ? undefined : String(result.error),
    })
  }

  const sent = results.filter(r => r.emailSent).length
  console.log(`Batch update: ${invoiceIds.length} invoices → ${newStatus}, ${sent}/${invoiceIds.length} emails sent`)

  return { success: true, results, emailsSent: sent, total: invoiceIds.length }
}

// ============================================================
// HELPERS
// ============================================================
function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return dateStr
  }
}
