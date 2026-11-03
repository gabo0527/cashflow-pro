-- Phase 2: apply ONLY after the authenticated invoice endpoint is deployed.
begin;
do $$ declare p record; begin
 for p in select policyname,tablename from pg_policies where schemaname='public' and tablename in ('contractor_invoices','contractor_invoice_lines') loop
  execute format('drop policy %I on public.%I',p.policyname,p.tablename);
 end loop;
end $$;
alter table public.contractor_invoices enable row level security;
alter table public.contractor_invoice_lines enable row level security;
revoke all on public.contractor_invoices,public.contractor_invoice_lines from anon;
grant select,insert,update,delete on public.contractor_invoices,public.contractor_invoice_lines to authenticated;
create policy invoice_verified_admin on public.contractor_invoices for all to authenticated
using (private.is_invoice_admin(company_id))
with check (private.is_invoice_admin(company_id));
create policy invoice_line_verified_admin on public.contractor_invoice_lines for all to authenticated
using (exists(select 1 from public.contractor_invoices i where i.id=invoice_id))
with check (exists(select 1 from public.contractor_invoices i where i.id=invoice_id));
commit;
