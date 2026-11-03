begin;
alter table public.contractor_invoices add column payment_group text not null default 'client' check(payment_group in('client','pooled_lump_sum'));
create function private.is_lump_sum_member(p_member uuid,p_company uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.team_members m where m.id=p_member and m.company_id=p_company and (
 regexp_replace(lower(coalesce(m.cost_type,'')),'[^a-z]','','g') in('lumpsum','monthly','fixed') or
 exists(select 1 from public.bill_rates r where r.team_member_id=m.id and r.is_active=true group by r.team_member_id
 having bool_and(regexp_replace(lower(coalesce(r.cost_type,'')),'[^a-z]','','g') in('lumpsum','monthly','fixed')))))
$$;
revoke all on function private.is_lump_sum_member(uuid,uuid) from public,anon,authenticated;
create function private.enforce_pooled_invoice_net60() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.payment_group='pooled_lump_sum' then
  if tg_op='INSERT' or new.payment_group is distinct from old.payment_group or new.team_member_id is distinct from old.team_member_id then
   if not private.is_lump_sum_member(new.team_member_id,new.company_id) then raise exception 'Combined Net 60 invoices require a lump-sum contractor'; end if;
  end if;
  new.payment_basis='invoice_date';new.payment_terms='NET60';new.client_net_days=60;new.due_date=new.invoice_date+60;new.client_id=null;
 end if;
 return new;
end $$;
revoke all on function private.enforce_pooled_invoice_net60() from public,anon,authenticated;
create trigger enforce_pooled_invoice_net60 before insert or update on public.contractor_invoices
for each row execute function private.enforce_pooled_invoice_net60();

-- Only open, verified lump-sum invoices with actual allocations to multiple
-- clients enter this bucket. Preserve original terms/dates for review.
update public.contractor_invoices i set payment_group='pooled_lump_sum',
 billing_snapshot=coalesce(i.billing_snapshot,'{}'::jsonb) || jsonb_build_object(
 'payment_group','pooled_lump_sum','net_days',60,'contractor_payment_basis','invoice_date',
 'pooled_client_ids',(select jsonb_agg(distinct l.client_id) from public.contractor_invoice_lines l where l.invoice_id=i.id and l.client_id is not null),
 'pooled_project_ids',(select jsonb_agg(distinct l.project_id) from public.contractor_invoice_lines l where l.invoice_id=i.id and l.project_id is not null),
 'pooled_correction',jsonb_build_object('changed_at',now(),'previous_terms',i.payment_terms,'previous_due_date',i.due_date,'previous_payment_basis',i.payment_basis,
 'reason','Owner instructed consolidated lump-sum invoices covering multiple clients to use Net 60 and a separate bucket.'))
where i.status in('submitted','pending','approved','scheduled')
 and i.company_id in(select a.company_id from public.commercial_access a join auth.users u on u.id=a.user_id where lower(u.email)='gabriel@manocg.com' and a.role='owner')
 and private.is_lump_sum_member(i.team_member_id,i.company_id)
 and (select count(distinct l.client_id) from public.contractor_invoice_lines l where l.invoice_id=i.id)>1;

-- Keep future allocations consistent even when a combined invoice arrives
-- through an older entry path. Status and amounts never change here.
create function private.classify_pooled_invoice_lines() returns trigger
language plpgsql security definer set search_path='' as $$
declare target uuid; row_invoice public.contractor_invoices%rowtype;
begin
 if tg_op='DELETE' then target=old.invoice_id;else target=new.invoice_id;end if;
 select * into row_invoice from public.contractor_invoices where id=target;
 if row_invoice.status in('submitted','pending','approved','scheduled') and private.is_lump_sum_member(row_invoice.team_member_id,row_invoice.company_id)
 and (select count(distinct client_id) from public.contractor_invoice_lines where invoice_id=target)>1 then
  update public.contractor_invoices set payment_group='pooled_lump_sum',
   billing_snapshot=coalesce(billing_snapshot,'{}'::jsonb) || jsonb_build_object('payment_group','pooled_lump_sum','net_days',60,'contractor_payment_basis','invoice_date',
    'pooled_client_ids',(select jsonb_agg(distinct client_id) from public.contractor_invoice_lines where invoice_id=target and client_id is not null),
    'pooled_project_ids',(select jsonb_agg(distinct project_id) from public.contractor_invoice_lines where invoice_id=target and project_id is not null))
  where id=target;
 end if;
 return null;
end $$;
revoke all on function private.classify_pooled_invoice_lines() from public,anon,authenticated;
create trigger classify_pooled_invoice_lines after insert or update or delete on public.contractor_invoice_lines
for each row execute function private.classify_pooled_invoice_lines();
commit;
