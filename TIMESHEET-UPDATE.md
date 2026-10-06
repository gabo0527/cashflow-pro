# Contractor daily descriptions update

The contractor portal retains its existing styling and weekly client/project grid. It now keeps each description under the project's actual entry date. Selecting an hour cell opens that project's description for that day; selecting another cell replaces the box. Enter closes a description, Shift+Enter adds a line, and Escape closes it. Show all daily descriptions expands the current week's entered days across clients. Saving and submitting still cover the entire grid.

Positive T&M hours require a nonblank daily description for both drafts and submissions. Blank and zero-hour weeks are accepted. The same rules run on the server, using verified contractor identity and assignment/rate-card data. Descriptions have a 2,000-character limit. Non-T&M descriptions remain optional.

Private drafts store daily descriptions in `timesheet_drafts.daily_descriptions`. They do not feed Time Tracking. On submission, each positive daily entry receives its own `time_entries.description`; the Detailed view reads that description on that entry's date. Descriptions retain line breaks. Weekly submission replaces entries and clears drafts in one transaction, so a failed write preserves the previous entries and drafts. Invoiced weeks remain locked.

Existing submitted descriptions are unchanged. Older drafts retain the weekly note as a reference. Contractors must complete descriptions for their positive daily T&M entries before saving or submitting those drafts; the weekly note is not automatically copied into every date.

## Deployment

1. Apply `supabase/migrations/20261006195900_contractor_daily_descriptions.sql` to the Vantage database.
2. Deploy this updated project, including the portal, the Time Tracking page, both timesheet API routes, and both supporting library files together.
3. Use a test contractor to save and reload a draft with different descriptions on two days. Submit the week, then verify that Time Tracking → Detailed displays the correct description for each date. Check that missing descriptions block both actions, and blank/zero weeks remain allowed.

The database script adds a description map to private drafts and a server-only transactional submission function. It preserves all historical records and existing access policies. Only `service_role` may invoke the new function; the browser calls the session-verified API. The existing `SUPABASE_SERVICE_ROLE_KEY` used for the draft API is also used for submission.

Database verification uses temporary tables and rolls back its transaction. The workflow tests make no live contractor submissions. Apply the additive database migration before the application deployment.

## Validation

`npm run test:timesheets` runs 13 checks covering daily description mapping, validation, draft behavior, server authentication and assignment checks, the actual portal's selection/Enter/expanded workflow, the actual Time Tracking Detailed description display and note popup, and middleware access to the session-verified contractor APIs.

TypeScript checking and a production build pass. The local production build used placeholder Supabase and Resend settings because the provided ZIP contains no deployment credentials. Existing Google Fonts downloads were skipped in the restricted local environment; the font definitions and styling are unchanged.

The database operation was tested against PostgreSQL using temporary tables for multiple clients, daily descriptions, repeat submissions, failed-write rollback, zero-hour submissions, weeks spanning months, and invoiced-week locks.

## Changed files

- `src/app/contractor-portal/page.tsx`
- `src/app/time-tracking/page.tsx`
- `src/app/api/timesheet-drafts/route.ts`
- `src/app/api/contractor-timesheets/route.ts` (new)
- `src/lib/timesheet-daily.ts` (new)
- `src/lib/contractor-timesheet-projects.ts` (new)
- `src/middleware.ts` (pass contractor APIs through to their own session checks)
- `supabase/migrations/20261006195900_contractor_daily_descriptions.sql` (new)
- `tests/contractor-timesheet.test.cjs` and `tests/contractor-timesheet-database.sql` (new)
- `package.json` and `package-lock.json` (test command and development test dependency)

The rest of the supplied platform source is unchanged.
