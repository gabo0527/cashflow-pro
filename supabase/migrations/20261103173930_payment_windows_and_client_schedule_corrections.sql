begin;
alter table public.contractor_invoices
 add column client_invoice_date date,
 add column client_net_days integer check(client_net_days between 0 and 365),
 add column client_schedule_confirmed_at timestamptz,
 add column client_schedule_confirmed_by uuid;

-- Gabriel confirmed that external contractor agreements follow client funds.
-- Keep internal overhead on its own terms, and retain explicit policy overrides.
insert into public.billing_policies(company_id,client_id,cycle_start_day,net_days,contractor_payment_basis)
select c.company_id,c.id,1,
 case when c.payment_terms='due_on_receipt' then 0 else coalesce(nullif(regexp_replace(c.payment_terms,'[^0-9]','','g'),'')::integer,30) end,
 'client_payment'
from public.clients c
where c.company_id in(select a.company_id from public.commercial_access a join auth.users u on u.id=a.user_id where lower(u.email)='gabriel@manocg.com' and a.role='owner')
 and lower(c.name) not in('mano cg','mano cg llc') and lower(c.name) not like 'test%'
on conflict(company_id,client_id,project_id) do nothing;

-- Correct only open external payables with an unambiguous client. Preserve
-- paid/rejected invoices, amounts, work dates, actual issue dates and statuses.
-- Existing scheduled payout dates remain commitments. Other automatically
-- generated fixed deadlines become conditional on client funds. Before-values
-- remain on each invoice for inspection and restoration, with the authorizer.
with scoped as (
 select i.*,coalesce(i.client_id,(select min(l.client_id::text)::uuid from public.contractor_invoice_lines l where l.invoice_id=i.id having count(distinct l.client_id)=1)) as resolved_client_id
 from public.contractor_invoices i where i.status in('submitted','pending','approved','scheduled') and i.payment_basis='invoice_date'
), corrections as (
 select i.id,i.updated_at as expected_updated_at,i.status as expected_status,c.id as client_id,coalesce(project_policy.net_days,p.net_days) as net_days,
 coalesce(project_policy.cycle_start_day,p.cycle_start_day) as cycle_start_day,
 (select a.user_id from public.commercial_access a join auth.users u on u.id=a.user_id where a.company_id=i.company_id and a.role='owner' and lower(u.email)='gabriel@manocg.com' limit 1) as authorizer
 from scoped i join public.clients c on c.id=i.resolved_client_id and c.company_id=i.company_id
 join public.billing_policies p on p.company_id=i.company_id and p.client_id=c.id and p.project_id is null
 left join public.billing_policies project_policy on project_policy.company_id=i.company_id and project_policy.client_id=c.id and project_policy.project_id::text=(i.billing_snapshot->>'project_id')
 where p.contractor_payment_basis='client_payment' and coalesce(project_policy.contractor_payment_basis,'client_payment')='client_payment'
 and lower(c.name) not in('mano cg','mano cg llc') and lower(c.name) not like 'test%'
 and i.company_id in(select a.company_id from public.commercial_access a join auth.users u on u.id=a.user_id where lower(u.email)='gabriel@manocg.com' and a.role='owner')
 and not exists(select 1 from public.contractor_invoice_lines l where l.invoice_id=i.id and l.client_id is not null and l.client_id<>c.id)
 and not exists(select 1 from public.billing_policies b where b.client_id=c.id and b.project_id is not null and i.billing_snapshot->>'project_id' is null)
)
update public.contractor_invoices i set
 client_id=c.client_id,payment_basis='client_payment',client_net_days=c.net_days,
 payment_terms='After client payment; schedule manually',
 due_date=case when i.status='scheduled' then i.due_date else null end,
 billing_snapshot=coalesce(i.billing_snapshot,'{}'::jsonb) || jsonb_build_object(
   'client_id',c.client_id,'net_days',c.net_days,'cycle_start_day',c.cycle_start_day,'contractor_payment_basis','client_payment',
   'client_invoice_assumption','billing_month_end','planning_tolerance_days',5,
   'schedule_correction',jsonb_build_object('changed_at',now(),'authorized_by',c.authorizer,
     'previous_client_id',i.client_id,'previous_terms',i.payment_terms,'previous_due_date',i.due_date,'previous_payment_basis',i.payment_basis,
     'reason','Client-funded contractor payment; month-end client invoice assumption with five-day planning range. Scheduled commitments preserved.'))
from corrections c where i.id=c.id and i.status in('submitted','pending','approved','scheduled') and i.payment_basis='invoice_date'
 and i.status=c.expected_status and i.updated_at is not distinct from c.expected_updated_at;
commit;
