-- Private program references; independent of contracts and project budgets.
create table public.report_program_projections (
 company_id uuid not null,
 client_id uuid not null references public.clients(id) on delete cascade,
 month date not null check (extract(day from month) = 1),
 amount numeric(14,2) not null check (amount > 0 and amount < 1000000000000),
 enabled boolean not null default true,
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 primary key (company_id, client_id, month)
);
create index report_program_projections_client_idx on public.report_program_projections(client_id);
create index report_program_projections_updated_by_idx on public.report_program_projections(updated_by);
create table public.report_resource_roles (
 company_id uuid not null,
 client_id uuid not null references public.clients(id) on delete cascade,
 team_member_id uuid not null references public.team_members(id) on delete cascade,
 role text not null check (length(role) <= 80),
 updated_by uuid references auth.users(id) on delete set null,
 updated_at timestamptz not null default now(),
 primary key (company_id, client_id, team_member_id)
);
create index report_resource_roles_client_idx on public.report_resource_roles(client_id);
create index report_resource_roles_member_idx on public.report_resource_roles(team_member_id);
create index report_resource_roles_updated_by_idx on public.report_resource_roles(updated_by);
alter table public.report_program_projections enable row level security;
alter table public.report_resource_roles enable row level security;
revoke all on public.report_program_projections, public.report_resource_roles from public, anon, authenticated;
grant select, insert, update on public.report_program_projections, public.report_resource_roles to service_role;
comment on table public.report_program_projections is 'Admin-only monthly client program reference. No browser RLS policies intentionally; use the company-scoped admin API.';
comment on table public.report_resource_roles is 'Persistent client reporting roles, independent of month or team profile. Admin API only; no browser RLS policies intentionally.';
