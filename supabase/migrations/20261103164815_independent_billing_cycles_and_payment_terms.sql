begin;
create table public.billing_policies (
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
 client_id uuid not null references public.clients(id), project_id uuid references public.projects(id),
 cycle_start_day integer not null default 1 check(cycle_start_day in(1,26)),
 net_days integer not null default 30 check(net_days between 0 and 365),
 contractor_payment_basis text not null default 'invoice_date' check(contractor_payment_basis in('invoice_date','client_payment')),
 effective_start date not null default '2026-10-01',updated_at timestamptz not null default now(),updated_by uuid,
 unique nulls not distinct(company_id,client_id,project_id)
);
alter table public.billing_policies enable row level security;
revoke all on public.billing_policies from anon,authenticated;
grant all on public.billing_policies to service_role;
insert into public.billing_policies(company_id,client_id,cycle_start_day,net_days,contractor_payment_basis)
select company_id,id,26,45,'client_payment' from public.clients
where lower(name) in('novainsite','skanska') and company_id in(select company_id from public.commercial_access a join auth.users u on u.id=a.user_id where lower(u.email)='gabriel@manocg.com');
update public.clients set payment_terms='net_45' where id in(select client_id from public.billing_policies where project_id is null);
-- A conditional payable has no fixed due date until payout is scheduled.
-- Relaxing this constraint removes no invoice rows or recorded dates.
alter table public.contractor_invoices alter column due_date drop not null;
alter table public.contractor_invoices
 add column payment_basis text not null default 'invoice_date' check(payment_basis in('invoice_date','client_payment')),
 add column client_payment_received_on date,
 add column client_payment_note text,
 add column client_payment_recorded_at timestamptz,
 add column client_payment_recorded_by uuid,
 add column billing_snapshot jsonb;
create table public.contractor_billing_obligations (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),team_member_id uuid not null references public.team_members(id),
 client_id uuid references public.clients(id),project_id uuid references public.projects(id),closing_month date not null,period_start date not null,period_end date not null,
 required boolean not null default true,exemption_note text,exempted_by uuid,
 reminder_state text not null default 'pending' check(reminder_state in('pending','sending','sent','failed')),
 claimed_at timestamptz,reminded_at timestamptz,email_id text,error text,created_at timestamptz not null default now(),
 unique nulls not distinct(team_member_id,client_id,project_id,closing_month)
);
alter table public.contractor_billing_obligations enable row level security;
revoke all on public.contractor_billing_obligations from anon,authenticated;
grant all on public.contractor_billing_obligations to service_role;
create index on public.contractor_billing_obligations(company_id,closing_month);
-- Existing invoices keep their recorded dates and terms. New invoices capture
-- the policy used at submission so later setting changes do not rewrite them.
commit;
