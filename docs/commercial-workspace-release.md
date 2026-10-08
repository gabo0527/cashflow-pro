# Client and project commercial workspace

## Release scope

Client → Commercial documents is the single repository for executed NDA, MPSA, SOW, amendment and change-order PDFs. Client agreements remain client-level; scope agreements attach to a project and are accessible from that project's client-filtered document link. The page supports search, multiple scope/category filters, ordered category/scope grouping, version preview/download, upload, archive/restore and confirmed deletion.

Scope contacts are client-side POCs, distinct from contractor assignments. Each scope has one primary POC and secondary, billing or approver contacts. Reassigning the primary retains the previous contact.

Commercial terms are dated project phases: T&M with a monthly or overall phase budget, open T&M, or a monthly fee. Adding a change retains earlier phases, their supporting agreements and prior revisions. Monthly-fee transitions begin on the first of a month. The existing implicit open-budget continuation is retained when a later dated change is added.

Client/project revenue and CSV reports use dated terms; monthly-fee hours are not billed again as hourly revenue. Overall-budget usage includes the entire phase through the selected end date. Project listings support multiple clients/projects/statuses/models and ordered client/status/model grouping. Time Tracking supports multiple employees and projects with its existing custom dates, Trends, By Employee and Detailed tabs. Employee costs and margins are marked coming soon; CSV output is revenue-only.

The broader Billing PDF redesign—including landscape work-detail appendices and configurable multilevel report grouping—is a subsequent report-design stage. The existing billing PDF has compatibility changes for the dated terms and overall budgets; it has not been replaced by the full mockup report builder.

## Database and access

The CLI-generated migration is `supabase/migrations/20261008170951_commercial_workspace.sql`. It was applied successfully to the existing linked Supabase project (`jmahfgpbtjeomuepfozf`) on October 8, 2026 under the owner’s publication/deployment authorization.

It adds commercial metadata, version/contact/audit/access tables, a private `commercial-documents` PDF bucket, two project-term columns and revision/integrity triggers. It preserves existing contractor tables, timesheet submissions, existing Storage policies and schedules. Commercial APIs validate Supabase bearer tokens and a separate company-scoped access record before using the server's service role. New metadata has row security enabled and no anonymous/authenticated direct access. Signed PDF links expire after two minutes. Uploads bypass application request-body limits through signed Storage uploads, then complete only after server-side size/header validation.

Company owners are initially provisioned from `companies.owner_id`. Executive viewer/admin accounts must be assigned explicitly after owner review; editable team/profile roles do not grant access. Existing application sign-in/allowlist rules continue to apply. No new executive users or document files have been created.

Document state changes and their audit entries commit together. Deleted documents keep a metadata tombstone so failed Storage removal can be retried. Canceled upload records retain their private paths for cleanup and cannot receive signed read URLs. Storage and Postgres are separate systems; authenticated upload/delete integration still requires a signed-in preview test. An outstanding signed upload token can create an inaccessible orphan object after cancellation; retention cleanup should remove canceled/deleted-version objects after the token's validity window.

## Validation

- `npm run test:timesheets`: 13 contractor/API/display regressions.
- `npm run test:commercial`: 9 commercial validation/access/document UI/filter tests, including three employees × five projects × a custom date range.
- `PGLITE_TEST_MODULE=/absolute/path/to/@electric-sql/pglite npm run test:commercial:database`: migration runs against disposable local Postgres fixtures; checks term transitions, immutable revisions, cross-company rejection, monthly/overall budgets, retained continuation gaps, primary-contact reassignment, version numbering, cancellation, archive/restore/delete idempotency and anonymous/authenticated privilege denial. Without the optional engine, this database test is explicitly skipped.
- TypeScript and optimized Next.js build with non-production placeholder environment values.
- Browser inspection of the actual document component rendered with sample data. This checks the layout; live authentication and Storage have not been exercised.

Vercel built the release preview successfully. Hosted checks confirmed the private PDF-only 20 MB bucket, row security and denied direct anonymous/authenticated privileges on all new metadata and RPCs. A hosted transaction exercised version reservation, completion, archive/restore, primary-contact reassignment, Budget → Open budget → Monthly fee changes, retained revisions and delete tombstones; it was rolled back with no sample records retained. All existing clients/scopes have matching company ownership. Existing Storage policies remain scoped to contractor-uploads.

Authenticated PDF upload/download and the complete signed-in workflow remain unverified because the review browser has no Google session. No live contractor submission was made. Supabase advisors reported no new commercial security warnings/errors; no-policy notices are intentional for server-only tables. Existing security findings include the unrelated team_member_documents table without RLS and a security-definer view. New foreign-key index suggestions are informational and can be assessed as usage grows.

## Authorized release review

The owner authorized final review, publication and deployment on October 8, 2026. The production destination is the existing cashflow-pro deployment and its linked Supabase project. The additive migration was validated locally before release. Hosted deployment and migration results are recorded in [release PR #1](https://github.com/gabo0527/cashflow-pro/pull/1). Additional executive identities still require explicit access assignment.
