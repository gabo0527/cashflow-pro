-- Phase 1 is additive and can run while the existing portal remains live.
begin;
insert into public.commercial_access(company_id,user_id,role)
select p.company_id,u.id,case when lower(u.email)='gabriel@manocg.com' then 'owner' else 'admin' end
from auth.users u join public.profiles p on p.id=u.id
where lower(u.email) in ('gabriel@manocg.com','kathia@manocg.com')
on conflict(company_id,user_id) do update set role=excluded.role;
update public.team_members set permission_role=case when lower(email)='gabriel@manocg.com' then 'owner' else 'admin' end
where lower(email) in ('gabriel@manocg.com','kathia@manocg.com');

create schema if not exists private;
create function private.is_invoice_admin(p_company uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.commercial_access a join auth.users u on u.id=a.user_id
 where a.company_id=p_company and a.user_id=auth.uid() and a.role in ('owner','admin')
 and lower(u.email) in ('gabriel@manocg.com','kathia@manocg.com'))
$$;
revoke all on function private.is_invoice_admin(uuid) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_invoice_admin(uuid) to authenticated;

create table public.contractor_invoice_status_events (
 id uuid primary key default gen_random_uuid(), invoice_id uuid not null,
 company_id uuid not null references public.companies(id), invoice_number text not null,
 from_status text, to_status text not null, changed_at timestamptz not null default clock_timestamp(),
 actor_id uuid, actor_label text not null, note text
);
create index on public.contractor_invoice_status_events(invoice_id,changed_at);
alter table public.contractor_invoice_status_events enable row level security;
revoke all on public.contractor_invoice_status_events from anon,authenticated;
grant select on public.contractor_invoice_status_events to authenticated;
grant all on public.contractor_invoice_status_events to service_role;
create policy invoice_events_admin_read on public.contractor_invoice_status_events for select to authenticated
using (private.is_invoice_admin(company_id));

create schema if not exists private;
create function private.audit_contractor_invoice_status() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor text;
begin
 if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
 if auth.uid() is not null then select email into actor from auth.users where id=auth.uid(); end if;
 if actor is null then actor='System / contractor portal'; end if;
 insert into public.contractor_invoice_status_events(invoice_id,company_id,invoice_number,from_status,to_status,actor_id,actor_label,note)
 values(new.id,new.company_id,new.invoice_number,case when tg_op='UPDATE' then old.status else null end,new.status,auth.uid(),actor,new.notes);
 return new;
end $$;
revoke all on function private.audit_contractor_invoice_status() from public,anon,authenticated;
create trigger audit_invoice_status after insert or update of status on public.contractor_invoices
for each row execute function private.audit_contractor_invoice_status();

create function private.stamp_contractor_invoice_status() returns trigger
language plpgsql set search_path='' as $$
begin
 new.updated_at=clock_timestamp();
 if new.status is distinct from old.status then
   new.reviewed_at=clock_timestamp(); new.reviewed_by=auth.uid();
   new.paid_at=case when new.status='paid' then clock_timestamp() else null end;
 end if;
 return new;
end $$;
revoke all on function private.stamp_contractor_invoice_status() from public,anon,authenticated;
create trigger stamp_invoice_status before update on public.contractor_invoices
for each row execute function private.stamp_contractor_invoice_status();

create table public.invoice_business_holidays (
 company_id uuid not null references public.companies(id), day date not null, label text not null,
 primary key(company_id,day)
);
alter table public.invoice_business_holidays enable row level security;
revoke all on public.invoice_business_holidays from anon,authenticated;
grant all on public.invoice_business_holidays to service_role;

create table public.contractor_invoice_obligations (
 id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),
 team_member_id uuid not null references public.team_members(id),period_start date not null,period_end date not null,
 required boolean not null default true,exemption_note text,exempted_by uuid,
 reminder_state text not null default 'pending' check(reminder_state in ('pending','sending','sent','failed')),
 claimed_at timestamptz,reminded_at timestamptz,email_id text,error text,
 created_at timestamptz not null default now(),unique(team_member_id,period_start)
);
alter table public.contractor_invoice_obligations enable row level security;
revoke all on public.contractor_invoice_obligations from anon,authenticated;
grant all on public.contractor_invoice_obligations to service_role;
create index on public.contractor_invoice_obligations(company_id,period_start);
commit;
