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

Active contractors whose start date precedes month-end are expected to submit an
invoice. Employees are excluded. A non-draft, non-rejected invoice overlapping the
month counts as received. This is a person/month check, not a check that every
client allocation has been invoiced. Monthly exceptions require an admin's reason.

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
3. Apply `supabase/payables_access.sql` after verifying the deployment. It removes
   permissive legacy invoice policies, leaving only the two verified admins able
   to access invoice tables directly. Contractors use the scoped server endpoint.
4. Test RLS as both admins and an unrelated account, plus status-history rollback
   tests. Verify cron authorization without sending test mail to contractors.

This change hardens contractor invoice access. Other legacy tables, including
timesheet and team-profile data, retain permissive policies that need a separate
portal migration and security review. Do not describe the whole legacy database
as restricted to these two admins.

Validation: `node --test tests/payables.test.cjs tests/contractor-timesheet.test.cjs
tests/commercial-workspace.test.cjs tests/commercial-ui.test.cjs
tests/workspace-interface.test.cjs`, TypeScript, Next production build, database
rollback assertions, and a visual check of the actual component rendered with
test data.
