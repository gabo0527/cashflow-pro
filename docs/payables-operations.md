# Contractor invoice operations

The default queue includes submitted, pending, approved and scheduled contractor
invoices across every billing month. Due date controls the queue ordering.
Overdue means payment due before today's Puerto Rico date. Due in seven days
includes today. Invoice history uses billing-period overlap and can include paid
and rejected invoices. Submission due at month-end is separate from payment due.

Status events are captured transactionally by the database. New events preserve
the previous status, next status, database timestamp and actor. Existing
submission timestamps remain visible; unrecorded older transitions cannot be
reconstructed. Reopening a paid invoice clears its current paid timestamp while
preserving the paid event. The interface sends the expected previous status so
two administrators cannot silently overwrite each other's decisions.

## Monthly missing-invoice follow-up

Tracking starts with October 2026 invoices due October 31, 2026. Earlier periods
are excluded from missing-invoice flags, obligation creation and automatic
reminders, including previously stored pending obligations. The outstanding
payment queue still includes real unpaid invoices from all months.

Active contractors with work assignments in the billing period are expected to
submit an invoice per client/project scope. Employees are excluded. Received
invoices must cover that scope and its full period. Exceptions require an
admin's reason. Unassigned contractors have one calendar-month obligation.

Daily Vercel cron: `/api/cron/invoice-followups` at 14:00 UTC / 10:00 AST.
The endpoint fails closed without `CRON_SECRET`. It requires the deployment's
existing Resend configuration. Grace ends after the third Monday–Friday business
day following month-end, excluding observed U.S. federal holidays and any extra
dates in `invoice_business_holidays`. October 2026 reminders become eligible on
November 5, 2026. The cron retains pending obligations from previous runs.

Each obligation is conditionally claimed before sending and uses a stable
Resend idempotency key. Successful acceptance by Resend is tagged “Reminder sent.”
This does not claim inbox delivery. Failures and interrupted sends remain visible
for manual review and are not automatically retried. Check the Resend delivery
record before arranging a replacement message. Received invoices suppress future
reminders; receipt is rechecked immediately before sending.

## Admin access and rollout

Only Gabriel and Kathia's verified `@manocg.com` accounts are on the application
allowlist. Gabriel retains ownership. Kathia has admin editing rights and
commercial-document access in the same company. Contractor invoice endpoints
derive the contractor and company from the signed session, never supplied IDs.

1. Apply the additive `payables_operations_history_and_followups` migration.
2. Deploy the authenticated invoice endpoint and both portal callsite updates.
3. Invoice-table RLS tightening was declined; leave the existing policies alone.
4. Verify cron authorization without sending test mail to contractors.

This change hardens contractor invoice access. Other legacy tables, including
timesheet and team-profile data, retain permissive policies that need a separate
portal migration and security review. Do not describe the whole legacy database
as restricted to these two admins.

Validation: `node --test tests/payables.test.cjs tests/contractor-timesheet.test.cjs
tests/commercial-workspace.test.cjs tests/commercial-ui.test.cjs
tests/workspace-interface.test.cjs`, TypeScript, Next production build, database
rollback assertions, and a visual check of the actual component rendered with
test data.

## Independent billing cycle and client terms

NovaInSite and Skanska use periods ending on the 25th (starting on the previous
month's 26th), with client Net 45 from the actual client invoice date. Client
settings and project overrides expose the cycle and net days separately. Changing
Net 45 to Net 30 or Net 60 never changes the work-period boundaries. Project
settings override the client default; issued invoices retain their snapshot.

Time Tracking's **Client billing period** filter requires one client, or one
project when that client has project overrides. The selected closing month drives
entry loading, totals and exports by actual work date. Weekly time entry remains
Monday–Sunday. The billing statement has a separate client invoice date and due
date preview; QuickBooks-imported receivables retain their source invoice dates.

Contractors select one client per invoice, and a project when overrides exist.
Their reference hours use the configured period. Invoice issue date is explicit.
For paid-when-paid policies, client net days do not become the contractor's
payment deadline: the contractor payable has no due date until the administrator
records client funds and schedules payment. The payment queue distinguishes
**Awaiting client payment** and **Ready to schedule**. Record the client receipt
in the invoice editor; scheduling or marking paid requires it.

Follow-up obligations now use `contractor_billing_obligations`, scoped to each
contractor/client (or project override) and closing month. Old obligations are
retained; calendar-month exceptions and sent-reminder states are carried forward
to avoid duplicate reminders. A received invoice must cover the full cycle and
matching client/project. Only periods closing October 31, 2026 onward qualify;
the custom cycle closing October 25 is excluded. No reminder is generated before
its period closes, and the three-business-day grace follows that actual close.
No emails are sent as part of deployment verification.

The earlier invoice-table RLS tightening was declined and has not been applied.
This deployment does not retry it or change those existing invoice policies.
