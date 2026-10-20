-- Private report allocations. These do not alter contract or billing terms.
create table public.report_monthly_budgets (
  company_id uuid not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  amount numeric(14,2) not null check (amount > 0 and amount < 1000000000000),
  enabled boolean not null default true,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (company_id, project_id, month)
);
create index report_monthly_budgets_project_idx on public.report_monthly_budgets(project_id);
alter table public.report_monthly_budgets enable row level security;
-- Budget amounts are available only through the authenticated admin API.
-- No browser, contractor, report recipient, or public Data API role can read them.
revoke all on public.report_monthly_budgets from public, anon, authenticated;
grant select, insert, update on public.report_monthly_budgets to service_role;
comment on table public.report_monthly_budgets is 'Admin-only monthly report allocations; separate from project contract budgets. RLS with no client policies is intentional.';
