# Rate cards and project access

A rate card defines pricing for one contractor/client. Only explicitly selected, active projects in that company grant access to timesheets, drafts, billing policies and invoice submissions. A client rate card with no selected projects grants no project access. Invoice allocations also validate their project assignments on the server.

The rate-card editor loads the saved selection without defaulting to all projects. It blocks saving during loading or after a load failure, discards stale responses when switching clients, and allows None to remove the client's assignments. Other clients' assignments and submitted timesheets/invoices are preserved.

Saving uses the administrator-only `/api/rate-cards` endpoint and the service-only `save_rate_card_assignments` database function. Rate card pricing and selected projects commit in one transaction. Validation or assignment failures roll back both. Updates for the same company/member/client serialize with a transaction advisory lock.

## Release

Apply `supabase/rate_card_assignments.sql` before deploying the application. Existing rate cards and assignment rows are not changed by this SQL. Audit active rate cards without explicit assignments before disabling the old fallback; restore only administrator-confirmed selections. Julio's Point One selections are Raleigh, Remington and Richmond; Project Management is excluded. AMB/Infrapartners was explicitly confirmed by Gabriel.

## Verification

- `node --test tests/project-access.test.cjs tests/contractor-timesheet.test.cjs tests/billing-periods.test.cjs tests/payables.test.cjs tests/pooled-invoices.test.cjs`
- `PGLITE_TEST_MODULE=/path/to/@electric-sql/pglite node --test tests/rate-card-database.test.cjs`
- `npm run build` with build-time environment variables configured.

The isolated PostgreSQL test covers creating cards, editing, clearing all projects, cross-client rejection, duplicate cards, service-only access, preserving other clients, and forced assignment failure after updating pricing. The database fixtures are synthetic and never create invoices or time entries.
