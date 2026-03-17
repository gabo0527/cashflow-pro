// src/lib/email.ts
// ============================================================
// VantageFP Email System — Resend + Branded Templates
// ============================================================
// Setup: npm install resend
// Env: RESEND_API_KEY, NEXT_PUBLIC_APP_URL
// ============================================================

import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

// Update this once you verify your domain in Resend
const FROM_EMAIL = process.env.EMAIL_FROM || "Vantage <notifications@vantagefp.co>"
const REPLY_TO = process.env.EMAIL_REPLY_TO || "gabriel@manocg.com"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://vantagefp.co"

// ============================================================
// SHARED TEMPLATE WRAPPER
// ============================================================
function emailWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VantageFP</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f5f7; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7; padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:#111827; padding:24px 32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:12px;">
                    <div style="width:32px; height:32px; background-color:#10b981; border-radius:8px; display:inline-block;"></div>
                  </td>
                  <td>
                    <span style="color:#ffffff; font-size:18px; font-weight:700; letter-spacing:-0.3px;">VantageFP</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px; border-top:1px solid #e5e7eb; background-color:#f9fafb;">
              <p style="margin:0; font-size:12px; color:#9ca3af; line-height:1.5;">
                This is an automated notification from VantageFP. 
                <a href="${APP_URL}" style="color:#10b981; text-decoration:none;">Open your portal</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function ctaButton(text: string, url: string): string {
  return `
    <table cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
      <tr>
        <td style="background-color:#10b981; border-radius:8px; padding:12px 24px;">
          <a href="${url}" style="color:#ffffff; font-size:14px; font-weight:600; text-decoration:none; display:inline-block;">${text}</a>
        </td>
      </tr>
    </table>`
}

function statusBadge(status: string): string {
  const colors: Record<string, { bg: string; text: string }> = {
    "submitted": { bg: "#dbeafe", text: "#1d4ed8" },
    "pending": { bg: "#fef3c7", text: "#92400e" },
    "pending review": { bg: "#fef3c7", text: "#92400e" },
    "approved": { bg: "#d1fae5", text: "#065f46" },
    "scheduled": { bg: "#e0e7ff", text: "#3730a3" },
    "scheduled for payment": { bg: "#e0e7ff", text: "#3730a3" },
    "paid": { bg: "#d1fae5", text: "#065f46" },
    "rejected": { bg: "#fee2e2", text: "#991b1b" },
    "changes requested": { bg: "#ffedd5", text: "#9a3412" },
  }
  const c = colors[status.toLowerCase()] || { bg: "#f3f4f6", text: "#374151" }
  return `<span style="display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; background-color:${c.bg}; color:${c.text}; text-transform:uppercase; letter-spacing:0.5px;">${status}</span>`
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(amount)
}

// ============================================================
// EMAIL TYPES
// ============================================================

export interface InvoiceStatusEmailData {
  contractorName: string
  contractorEmail: string
  invoiceNumber: string
  invoiceAmount: number
  previousStatus: string
  newStatus: string
  periodStart?: string
  periodEnd?: string
  notes?: string       // optional admin note on rejection/changes
  paidDate?: string    // when status is "paid"
  paymentMethod?: string
}

export interface ExpenseStatusEmailData {
  contractorName: string
  contractorEmail: string
  expenseDescription: string
  expenseAmount: number
  expenseDate: string
  previousStatus: string
  newStatus: string
  notes?: string
}

export interface EOMReminderEmailData {
  contractorName: string
  contractorEmail: string
  month: string           // "February 2026"
  hasExistingInvoice: boolean
  totalHoursLogged: number
  projectBreakdown: { project: string; hours: number }[]
  dueDate: string         // "March 1, 2026"
  isSecondReminder?: boolean
  costType: "hourly" | "lump_sum"       // how they're paid
  fixedMonthlyAmount?: number            // for lump_sum contractors
  estimatedInvoiceAmount?: number        // for hourly: hours x rate
}

// ============================================================
// INVOICE STATUS CHANGE EMAIL
// ============================================================
export async function sendInvoiceStatusEmail(data: InvoiceStatusEmailData) {
  const statusMessages: Record<string, { subject: string; heading: string; body: string }> = {
    "pending review": {
      subject: `Invoice ${data.invoiceNumber} received`,
      heading: "Invoice Submitted",
      body: "Your invoice has been received and is under review. You will be notified once it is processed.",
    },
    "approved": {
      subject: `Invoice ${data.invoiceNumber} approved`,
      heading: "Invoice Approved",
      body: "Your invoice has been reviewed and approved. You will receive a notification when it has been scheduled for payment.",
    },
    "scheduled for payment": {
      subject: `Invoice ${data.invoiceNumber} scheduled for payment`,
      heading: "Payment Scheduled",
      body: "Your invoice has been scheduled for payment. You should see the funds in your account within 2-3 business days.",
    },
    "scheduled": {
      subject: `Invoice ${data.invoiceNumber} scheduled for payment`,
      heading: "Payment Scheduled",
      body: "Your invoice has been scheduled for payment. You should see the funds in your account within 2-3 business days.",
    },
    "paid": {
      subject: `Invoice ${data.invoiceNumber} paid`,
      heading: "Payment Sent",
      body: `Your invoice has been paid${data.paidDate ? " on " + data.paidDate : ""}${data.paymentMethod ? " via " + data.paymentMethod : ""}. If you do not see the funds within 3 business days, please reach out.`,
    },
    "rejected": {
      subject: `Invoice ${data.invoiceNumber} — action needed`,
      heading: "Invoice Returned",
      body: "Your invoice requires changes before it can be approved. Please review the notes below and resubmit.",
    },
    "changes requested": {
      subject: `Invoice ${data.invoiceNumber} — changes requested`,
      heading: "Changes Requested",
      body: "Your invoice needs some adjustments. Please review the notes below and resubmit an updated version.",
    },
  }

  const msg = statusMessages[data.newStatus.toLowerCase()] || {
    subject: `Invoice ${data.invoiceNumber} updated to ${data.newStatus}`,
    heading: `Invoice Status: ${data.newStatus}`,
    body: `The status of your invoice has been updated to ${data.newStatus}.`,
  }

  const periodLine = data.periodStart && data.periodEnd
    ? `<tr><td style="padding:6px 0; color:#6b7280; font-size:13px;">Period</td><td style="padding:6px 0; font-size:13px; font-weight:500; text-align:right;">${data.periodStart} – ${data.periodEnd}</td></tr>`
    : ""

  const notesBlock = data.notes
    ? `<div style="margin-top:20px; padding:16px; background-color:#fef3c7; border-radius:8px; border-left:3px solid #f59e0b;">
         <p style="margin:0 0 4px; font-size:12px; font-weight:600; color:#92400e; text-transform:uppercase; letter-spacing:0.5px;">Admin Notes</p>
         <p style="margin:0; font-size:13px; color:#78350f; line-height:1.5;">${data.notes}</p>
       </div>`
    : ""

  const content = `
    <p style="margin:0 0 4px; font-size:13px; color:#6b7280;">Hi ${data.contractorName},</p>
    <h2 style="margin:8px 0 16px; font-size:20px; color:#111827; font-weight:700;">${msg.heading}</h2>
    <p style="margin:0 0 20px; font-size:14px; color:#374151; line-height:1.6;">${msg.body}</p>
    
    <!-- Invoice details card -->
    <div style="background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:16px 20px; margin:0 0 16px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:6px 0; color:#6b7280; font-size:13px;">Invoice</td>
          <td style="padding:6px 0; font-size:13px; font-weight:600; text-align:right;">${data.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#6b7280; font-size:13px;">Amount</td>
          <td style="padding:6px 0; font-size:15px; font-weight:700; text-align:right; color:#111827;">${formatCurrency(data.invoiceAmount)}</td>
        </tr>
        ${periodLine}
        <tr>
          <td style="padding:6px 0; color:#6b7280; font-size:13px;">Status</td>
          <td style="padding:6px 0; text-align:right;">${statusBadge(data.newStatus)}</td>
        </tr>
      </table>
    </div>
    ${notesBlock}
    ${ctaButton("View in Portal", `${APP_URL}/contractor-portal`)}
  `

  try {
    const { data: result, error } = await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO,
      to: data.contractorEmail,
      subject: msg.subject,
      html: emailWrapper(content),
    })
    if (error) {
      console.error("Failed to send invoice status email:", error)
      return { success: false, error }
    }
    console.log(`Invoice status email sent: ${data.invoiceNumber} → ${data.newStatus} → ${data.contractorEmail}`)
    return { success: true, id: result?.id }
  } catch (err) {
    console.error("Email send error:", err)
    return { success: false, error: err }
  }
}

// ============================================================
// EXPENSE STATUS CHANGE EMAIL
// ============================================================
export async function sendExpenseStatusEmail(data: ExpenseStatusEmailData) {
  const statusMessages: Record<string, { subject: string; heading: string }> = {
    "approved": {
      subject: `Expense approved — ${data.expenseDescription}`,
      heading: "Expense Approved",
    },
    "rejected": {
      subject: `Expense returned — ${data.expenseDescription}`,
      heading: "Expense Returned",
    },
    "reimbursed": {
      subject: `Expense reimbursed — ${data.expenseDescription}`,
      heading: "Expense Reimbursed",
    },
    "paid": {
      subject: `Expense reimbursed — ${data.expenseDescription}`,
      heading: "Expense Reimbursed",
    },
  }

  const msg = statusMessages[data.newStatus.toLowerCase()] || {
    subject: `Expense updated — ${data.expenseDescription}`,
    heading: `Expense Status: ${data.newStatus}`,
  }

  const notesBlock = data.notes
    ? `<div style="margin-top:20px; padding:16px; background-color:#fef3c7; border-radius:8px; border-left:3px solid #f59e0b;">
         <p style="margin:0 0 4px; font-size:12px; font-weight:600; color:#92400e; text-transform:uppercase;">Notes</p>
         <p style="margin:0; font-size:13px; color:#78350f; line-height:1.5;">${data.notes}</p>
       </div>`
    : ""

  const bodyText = data.newStatus.toLowerCase() === "approved"
    ? "Your expense has been reviewed and approved. You will receive a notification when reimbursement has been processed."
    : data.newStatus.toLowerCase() === "reimbursed" || data.newStatus.toLowerCase() === "paid"
      ? "Your expense has been reimbursed."
      : data.newStatus.toLowerCase() === "rejected" || data.newStatus.toLowerCase() === "changes requested"
        ? "Your expense requires changes. Please review the notes below and resubmit with the required documentation."
        : `Your expense status has been updated to ${data.newStatus}.`

  const content = `
    <p style="margin:0 0 4px; font-size:13px; color:#6b7280;">Hi ${data.contractorName},</p>
    <h2 style="margin:8px 0 16px; font-size:20px; color:#111827; font-weight:700;">${msg.heading}</h2>
    <p style="margin:0 0 20px; font-size:14px; color:#374151; line-height:1.6;">${bodyText}</p>
    
    <div style="background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:16px 20px; margin:0 0 16px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:6px 0; color:#6b7280; font-size:13px;">Expense</td>
          <td style="padding:6px 0; font-size:13px; font-weight:500; text-align:right;">${data.expenseDescription}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#6b7280; font-size:13px;">Amount</td>
          <td style="padding:6px 0; font-size:15px; font-weight:700; text-align:right; color:#111827;">${formatCurrency(data.expenseAmount)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#6b7280; font-size:13px;">Date</td>
          <td style="padding:6px 0; font-size:13px; text-align:right;">${data.expenseDate}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#6b7280; font-size:13px;">Status</td>
          <td style="padding:6px 0; text-align:right;">${statusBadge(data.newStatus)}</td>
        </tr>
      </table>
    </div>
    ${notesBlock}
    ${ctaButton("View in Portal", `${APP_URL}/contractor-portal`)}
  `

  try {
    const { data: result, error } = await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO,
      to: data.contractorEmail,
      subject: msg.subject,
      html: emailWrapper(content),
    })
    if (error) {
      console.error("Failed to send expense status email:", error)
      return { success: false, error }
    }
    console.log(`Expense status email sent: ${data.expenseDescription} → ${data.newStatus} → ${data.contractorEmail}`)
    return { success: true, id: result?.id }
  } catch (err) {
    console.error("Email send error:", err)
    return { success: false, error: err }
  }
}

// ============================================================
// ADMIN NOTIFICATION — INVOICE SUBMITTED
// ============================================================
export interface AdminInvoiceSubmittedData {
  contractorName: string
  contractorEmail: string
  invoiceNumber: string
  invoiceAmount: number
  periodStart?: string
  periodEnd?: string
  notes?: string
}

export async function sendAdminInvoiceSubmittedEmail(data: AdminInvoiceSubmittedData) {
  const adminEmail = process.env.EMAIL_REPLY_TO || "gabriel@manocg.com"
  const period = data.periodStart && data.periodEnd
    ? `${data.periodStart} – ${data.periodEnd}`
    : "N/A"

  const content = `
    <p style="margin:0 0 4px; font-size:13px; color:#6b7280;">New submission</p>
    <h2 style="margin:8px 0 16px; font-size:20px; color:#111827; font-weight:700;">Invoice Submitted</h2>
    <p style="margin:0 0 20px; font-size:14px; color:#374151; line-height:1.6;">
      <strong>${data.contractorName}</strong> has submitted an invoice and is awaiting your review.
    </p>
    <div style="background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:16px 20px; margin:0 0 16px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:6px 0; color:#6b7280; font-size:13px;">Contractor</td>
          <td style="padding:6px 0; font-size:13px; font-weight:600; text-align:right; color:#111827;">${data.contractorName}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#6b7280; font-size:13px;">Invoice #</td>
          <td style="padding:6px 0; font-size:13px; text-align:right;">${data.invoiceNumber}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#6b7280; font-size:13px;">Amount</td>
          <td style="padding:6px 0; font-size:15px; font-weight:700; text-align:right; color:#111827;">${formatCurrency(data.invoiceAmount)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#6b7280; font-size:13px;">Period</td>
          <td style="padding:6px 0; font-size:13px; text-align:right;">${period}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#6b7280; font-size:13px;">Status</td>
          <td style="padding:6px 0; text-align:right;">${statusBadge("submitted")}</td>
        </tr>
      </table>
    </div>
    ${data.notes ? `<div style="margin-top:16px; padding:14px 16px; background-color:#f0fdf4; border-radius:8px; border-left:3px solid #10b981;"><p style="margin:0 0 4px; font-size:12px; font-weight:600; color:#065f46; text-transform:uppercase;">Contractor Note</p><p style="margin:0; font-size:13px; color:#374151; line-height:1.5;">${data.notes}</p></div>` : ""}
    ${ctaButton("Review in Contractor Management", `${APP_URL}/contractor-management`)}
  `

  try {
    const { data: result, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmail,
      subject: `Invoice submitted — ${data.contractorName} · ${formatCurrency(data.invoiceAmount)}`,
      html: emailWrapper(content),
    })
    if (error) { console.error("Admin invoice notification failed:", error); return { success: false, error } }
    console.log(`Admin notified: invoice submitted by ${data.contractorName}`)
    return { success: true, id: result?.id }
  } catch (err) {
    console.error("Admin invoice email error:", err)
    return { success: false, error: err }
  }
}

// ============================================================
// ADMIN NOTIFICATION — EXPENSE SUBMITTED
// ============================================================
export interface AdminExpenseSubmittedData {
  contractorName: string
  contractorEmail: string
  expenseDescription: string
  expenseAmount: number
  expenseDate: string
  category: string
  notes?: string
}

export async function sendAdminExpenseSubmittedEmail(data: AdminExpenseSubmittedData) {
  const adminEmail = process.env.EMAIL_REPLY_TO || "gabriel@manocg.com"

  const content = `
    <p style="margin:0 0 4px; font-size:13px; color:#6b7280;">New submission</p>
    <h2 style="margin:8px 0 16px; font-size:20px; color:#111827; font-weight:700;">Expense Submitted</h2>
    <p style="margin:0 0 20px; font-size:14px; color:#374151; line-height:1.6;">
      <strong>${data.contractorName}</strong> has submitted an expense for reimbursement.
    </p>
    <div style="background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:16px 20px; margin:0 0 16px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:6px 0; color:#6b7280; font-size:13px;">Contractor</td>
          <td style="padding:6px 0; font-size:13px; font-weight:600; text-align:right; color:#111827;">${data.contractorName}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#6b7280; font-size:13px;">Description</td>
          <td style="padding:6px 0; font-size:13px; text-align:right;">${data.expenseDescription}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#6b7280; font-size:13px;">Category</td>
          <td style="padding:6px 0; font-size:13px; text-align:right; text-transform:capitalize;">${data.category}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#6b7280; font-size:13px;">Amount</td>
          <td style="padding:6px 0; font-size:15px; font-weight:700; text-align:right; color:#111827;">${formatCurrency(data.expenseAmount)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#6b7280; font-size:13px;">Date</td>
          <td style="padding:6px 0; font-size:13px; text-align:right;">${data.expenseDate}</td>
        </tr>
        <tr>
          <td style="padding:6px 0; color:#6b7280; font-size:13px;">Status</td>
          <td style="padding:6px 0; text-align:right;">${statusBadge("submitted")}</td>
        </tr>
      </table>
    </div>
    ${data.notes ? `<div style="margin-top:16px; padding:14px 16px; background-color:#f0fdf4; border-radius:8px; border-left:3px solid #10b981;"><p style="margin:0 0 4px; font-size:12px; font-weight:600; color:#065f46; text-transform:uppercase;">Contractor Note</p><p style="margin:0; font-size:13px; color:#374151; line-height:1.5;">${data.notes}</p></div>` : ""}
    ${ctaButton("Review in Contractor Management", `${APP_URL}/contractor-management`)}
  `

  try {
    const { data: result, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmail,
      subject: `Expense submitted — ${data.contractorName} · ${formatCurrency(data.expenseAmount)}`,
      html: emailWrapper(content),
    })
    if (error) { console.error("Admin expense notification failed:", error); return { success: false, error } }
    console.log(`Admin notified: expense submitted by ${data.contractorName}`)
    return { success: true, id: result?.id }
  } catch (err) {
    console.error("Admin expense email error:", err)
    return { success: false, error: err }
  }
}

// ============================================================
// ADMIN NOTIFICATION — WEEKLY TIMESHEET DIGEST
// ============================================================
export interface TimesheetDigestContractor {
  name: string
  submitted: boolean
  totalHours: number
  projects: { name: string; hours: number }[]
}

export interface AdminTimesheetDigestData {
  weekLabel: string       // "Mar 10 – Mar 16, 2026"
  weekStart: string       // "2026-03-10"
  contractors: TimesheetDigestContractor[]
}

export async function sendAdminTimesheetDigestEmail(data: AdminTimesheetDigestData) {
  const adminEmail = process.env.EMAIL_REPLY_TO || "gabriel@manocg.com"
  const submitted = data.contractors.filter(c => c.submitted)
  const missing = data.contractors.filter(c => !c.submitted)
  const totalHours = submitted.reduce((s, c) => s + c.totalHours, 0)

  const submittedRows = submitted.map(c => `
    <tr>
      <td style="padding:8px 0; font-size:13px; color:#111827; font-weight:500; border-bottom:1px solid #f3f4f6;">${c.name}</td>
      <td style="padding:8px 0; font-size:13px; font-weight:700; text-align:right; color:#111827; border-bottom:1px solid #f3f4f6;">${c.totalHours.toFixed(1)}h</td>
      <td style="padding:8px 0; text-align:right; border-bottom:1px solid #f3f4f6;">${statusBadge("approved")}</td>
    </tr>
  `).join("")

  const missingRows = missing.length > 0 ? `
    <div style="margin-top:20px; padding:14px 16px; background-color:#fef3c7; border-radius:8px; border-left:3px solid #f59e0b;">
      <p style="margin:0 0 8px; font-size:12px; font-weight:700; color:#92400e; text-transform:uppercase;">No Timesheet Submitted</p>
      ${missing.map(c => `<p style="margin:2px 0; font-size:13px; color:#78350f;">· ${c.name}</p>`).join("")}
    </div>
  ` : `<div style="margin-top:16px; padding:12px 16px; background-color:#f0fdf4; border-radius:8px; border-left:3px solid #10b981;"><p style="margin:0; font-size:13px; color:#065f46; font-weight:600;">✓ All contractors submitted this week</p></div>`

  const content = `
    <p style="margin:0 0 4px; font-size:13px; color:#6b7280;">Weekly digest</p>
    <h2 style="margin:8px 0 4px; font-size:20px; color:#111827; font-weight:700;">Timesheet Summary</h2>
    <p style="margin:0 0 20px; font-size:13px; color:#6b7280;">${data.weekLabel}</p>

    <div style="display:grid; margin-bottom:20px;">
      <div style="background-color:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:14px 18px; display:inline-block; margin-bottom:12px;">
        <p style="margin:0; font-size:11px; color:#065f46; font-weight:600; text-transform:uppercase; letter-spacing:0.5px;">Total Hours Logged</p>
        <p style="margin:4px 0 0; font-size:24px; font-weight:700; color:#111827;">${totalHours.toFixed(1)}h</p>
        <p style="margin:2px 0 0; font-size:12px; color:#6b7280;">${submitted.length} of ${data.contractors.length} contractors submitted</p>
      </div>
    </div>

    <div style="background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:16px 20px; margin:0 0 8px;">
      <p style="margin:0 0 12px; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px;">Submitted This Week</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <th style="padding:0 0 8px; text-align:left; font-size:11px; font-weight:600; color:#9ca3af; text-transform:uppercase;">Contractor</th>
          <th style="padding:0 0 8px; text-align:right; font-size:11px; font-weight:600; color:#9ca3af; text-transform:uppercase;">Hours</th>
          <th style="padding:0 0 8px; text-align:right; font-size:11px; font-weight:600; color:#9ca3af; text-transform:uppercase;">Status</th>
        </tr>
        ${submittedRows || `<tr><td colspan="3" style="padding:12px 0; font-size:13px; color:#9ca3af; text-align:center;">No timesheets submitted this week</td></tr>`}
      </table>
    </div>
    ${missingRows}
    ${ctaButton("View Contractor Management", `${APP_URL}/contractor-management`)}
  `

  try {
    const { data: result, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmail,
      subject: `Weekly timesheet digest — ${data.weekLabel} · ${totalHours.toFixed(1)}h logged`,
      html: emailWrapper(content),
    })
    if (error) { console.error("Timesheet digest failed:", error); return { success: false, error } }
    console.log(`Timesheet digest sent for week ${data.weekLabel}`)
    return { success: true, id: result?.id }
  } catch (err) {
    console.error("Timesheet digest email error:", err)
    return { success: false, error: err }
  }
}

// ============================================================
// END-OF-MONTH INVOICE REMINDER
// ============================================================
export async function sendEOMReminderEmail(data: EOMReminderEmailData) {
  const subject = data.isSecondReminder
    ? `Reminder: ${data.month} invoice due ${data.dueDate}`
    : `Time to submit your ${data.month} invoice`

  const urgencyBanner = data.isSecondReminder
    ? `<div style="margin-bottom:20px; padding:12px 16px; background-color:#fee2e2; border-radius:8px; border-left:3px solid #ef4444;">
         <p style="margin:0; font-size:13px; color:#991b1b; font-weight:600;">Second reminder — invoice due by ${data.dueDate}</p>
       </div>`
    : ""

  const isFixed = data.costType === "lump_sum" && data.fixedMonthlyAmount
  const isHourly = data.costType === "hourly"

  const introText = data.hasExistingInvoice
    ? `It looks like you have already submitted an invoice for ${data.month}. If you need to make any changes, you can update it in the portal.`
    : isFixed
      ? `It is time to submit your invoice for ${data.month}. Your monthly invoice amount is <strong style="color:#111827;">${formatCurrency(data.fixedMonthlyAmount!)}</strong>. Below are your logged hours for project allocation reference.`
      : `It is time to submit your invoice for ${data.month}. Here is a summary of your logged hours to help you prepare.`

  const projectRows = data.projectBreakdown.map(p =>
    `<tr>
       <td style="padding:4px 0; font-size:13px; color:#374151;">${p.project}</td>
       <td style="padding:4px 0; font-size:13px; font-weight:600; text-align:right; color:#111827;">${p.hours.toFixed(1)}h</td>
     </tr>`
  ).join("")

  // Invoice amount row — only for hourly contractors with an estimate
  const invoiceAmountRow = isHourly && data.estimatedInvoiceAmount
    ? `<tr>
         <td style="padding:10px 0 4px; font-size:12px; color:#6b7280; border-top:1px solid #e5e7eb;">Estimated Invoice</td>
         <td style="padding:10px 0 4px; font-size:15px; font-weight:700; text-align:right; color:#10b981; border-top:1px solid #e5e7eb;">${formatCurrency(data.estimatedInvoiceAmount)}</td>
       </tr>`
    : ""

  // Fixed amount callout for lump sum contractors
  const fixedAmountRow = isFixed
    ? `<tr>
         <td style="padding:10px 0 4px; font-size:12px; color:#6b7280; border-top:1px solid #e5e7eb;">Monthly Invoice Amount</td>
         <td style="padding:10px 0 4px; font-size:15px; font-weight:700; text-align:right; color:#10b981; border-top:1px solid #e5e7eb;">${formatCurrency(data.fixedMonthlyAmount!)}</td>
       </tr>`
    : ""

  const content = `
    <p style="margin:0 0 4px; font-size:13px; color:#6b7280;">Hi ${data.contractorName},</p>
    <h2 style="margin:8px 0 16px; font-size:20px; color:#111827; font-weight:700;">Invoice Reminder: ${data.month}</h2>
    ${urgencyBanner}
    <p style="margin:0 0 20px; font-size:14px; color:#374151; line-height:1.6;">
      ${introText}
    </p>

    ${!data.hasExistingInvoice ? `
    <!-- Hours summary -->
    <div style="background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:16px 20px; margin:0 0 16px;">
      <p style="margin:0 0 12px; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.5px;">${isFixed ? "Hours Logged (for allocation)" : "Hours Logged"} — ${data.month}</p>
      <table width="100%" cellpadding="0" cellspacing="0">
        ${projectRows}
        <tr>
          <td style="padding:10px 0 4px; font-size:13px; color:#111827; font-weight:700; border-top:1px solid #e5e7eb;">Total Hours</td>
          <td style="padding:10px 0 4px; font-size:15px; font-weight:700; text-align:right; color:#111827; border-top:1px solid #e5e7eb;">${data.totalHoursLogged.toFixed(1)}h</td>
        </tr>
        ${invoiceAmountRow}
        ${fixedAmountRow}
      </table>
    </div>
    ` : ""}

    <p style="margin:0 0 4px; font-size:13px; color:#6b7280;">
      Please submit by <strong style="color:#111827;">${data.dueDate}</strong>.
    </p>
    ${ctaButton(data.hasExistingInvoice ? "Review Invoice" : "Submit Invoice", `${APP_URL}/contractor-portal`)}
  `

  try {
    const { data: result, error } = await resend.emails.send({
      from: FROM_EMAIL,
      replyTo: REPLY_TO,
      to: data.contractorEmail,
      subject,
      html: emailWrapper(content),
    })
    if (error) {
      console.error("Failed to send EOM reminder:", error)
      return { success: false, error }
    }
    console.log(`EOM reminder sent: ${data.contractorName} (${data.month}) → ${data.contractorEmail}`)
    return { success: true, id: result?.id }
  } catch (err) {
    console.error("Email send error:", err)
    return { success: false, error: err }
  }
}
