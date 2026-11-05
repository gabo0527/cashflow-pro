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

## Payment windows and corrected legacy defaults

The default AP screen is the current **payment month**, using client payment
schedule dates rather than service-month overlap. Presets include this week,
this month, month-end/opening week, next 30 dates and custom cross-month ranges.
Metrics and bulk approval use only the displayed selection. Prior expected dates,
all outstanding invoices and schedule review are explicit separate views.
Submission follow-ups live below the payment queue and have separate dates.

Gabriel authorized month-end client invoice issuance as the planning assumption,
with a ±5-day range. September GOOGL (Net 60) therefore centers on November 29;
October Point One/CADC (Net 30) centers on November 30. October GOOGL centers on
December 30 and stays out of the November view. Forecast ranges overlap a window
when any date in the range intersects it. Actual client invoice dates entered by
an admin replace this assumption and remove the issuance-date tolerance. Net days
are frozen on each invoice and can be corrected separately from the work period.
Forecasts never record client receipt or release a contractor payment.

Existing open, single-client external invoices have been reviewed against client
terms. Fixed deadlines generated from legacy contractor Net 30 defaults become
conditional on client funds. Existing scheduled payout dates are preserved.
Previous due date, terms, client, payment basis, authorization and correction time
remain in `billing_snapshot.schedule_correction` and appear in expanded history.
Paid/rejected records, invoice issue dates, work dates, amounts and statuses are
preserved. Internal Mano CG overhead retains its own terms. Mixed or unidentified
client invoices go to **Schedule review** without assigning their entire amount
to a guessed client payment date. Received but unscheduled funds stay visible until
payout is scheduled, even when received before the selected window.

## Consolidated lump-sum exception

Gabriel directed that a lump-sum contractor's invoice covering multiple clients
remain Net 60 in a separate **Lump sum · multiple clients** bucket. Its deadline
is 60 calendar days from the contractor invoice's actual issue date. It does not
inherit an individual client's Net 30/45 terms or require choosing one client's
receipt date. The bucket defaults to the selected payment window; **Show all
unpaid lump-sum periods** reveals the older backlog. A window count remains on
the bucket tab. These amounts are excluded from the individual-client window.

Migration 20261103175501 identified four eligible open invoices, corrected their
legacy Net 30 defaults to Net 60, and retained previous dates/terms in
`billing_snapshot.pooled_correction`. Amounts, issue/work dates, statuses and
closed invoices are preserved. Other mixed-client invoices still require review.
Database enforcement maintains Net 60, and allocation changes automatically
classify eligible multi-client lump-sum invoices. The API verifies contractor
cost type and assignments before accepting a combined invoice. Eligible portal
users can select **All clients · lump sum · Net 60**; admin entry has a combined
lump-sum checkbox. Actual allocations remain available on the invoice.

Combined invoices carry their covered client/project IDs. Missing-invoice checks
can recognize their coverage, including adjacent monthly invoices that jointly
cover a client's 26th–25th work cycle, so they do not request duplicate invoices.

## Administrator payment corrections

Verified owners and admins may update any invoice status, schedule a payout, or
correct client receipt details within their company without first entering a
client receipt date. This supports historical bookkeeping and payments made
before client funds arrive. Marking a contractor paid never fabricates a client
receipt. The admin JWT continues to reach the database so status timestamps and
the status history identify the actual administrator. Contractors cannot change
reviewed statuses or record client receipts; company scoping, validation, and
concurrent status checks remain in force. The combined lump-sum Net 60 rule is
unchanged.

Selecting Paid or Rejected in any unpaid queue opens Invoice history across all
billing periods. Search, contractor, and client filters are retained; an open
payment-stage filter is cleared. Inside history, an explicitly chosen billing
period still applies. Returning through a payment-window date control clears
the closed-status filter so the outstanding queue cannot become contradictory.
