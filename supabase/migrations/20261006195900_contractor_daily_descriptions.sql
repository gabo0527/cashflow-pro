-- Apply before deploying the updated contractor portal and API routes.
-- Additive storage change: existing weekly notes and submitted descriptions
-- are retained. No historical descriptions are inferred or rewritten.
begin;

alter table public.timesheet_drafts
  add column if not exists daily_descriptions jsonb not null default '{}'::jsonb;

create or replace function public.replace_contractor_timesheet(
  p_contractor_id uuid,
  p_company_id uuid,
  p_week_ending date,
  p_entries jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_start date := p_week_ending - 6;
  v_result jsonb;
  v_inserted integer;
begin
  if p_week_ending is null or extract(dow from p_week_ending) <> 0
      or p_contractor_id is null or p_entries is null
      or jsonb_typeof(p_entries) <> 'array' then
    raise exception 'Invalid timesheet payload';
  end if;

  -- Serialize simultaneous submissions for the same contractor/week.
  perform pg_advisory_xact_lock(hashtextextended(p_contractor_id::text || '|' || p_week_ending::text, 0));

  if exists (
    select 1 from public.contractor_invoices
    where team_member_id = p_contractor_id
      and lower(status) in ('approved', 'paid')
      and period_start <= v_start and period_end >= p_week_ending
  ) then
    raise exception 'This week has been invoiced and is locked';
  end if;

  if exists (
    select 1 from jsonb_to_recordset(p_entries) as e(project_id uuid, date date, hours numeric)
    where e.project_id is null or e.date is null
      or e.date < v_start or e.date > p_week_ending
      or e.hours is null or e.hours <= 0 or e.hours > 24
  ) or exists (
    select 1 from jsonb_to_recordset(p_entries) as e(project_id uuid, date date)
    group by project_id, date having count(*) > 1
  ) then
    raise exception 'Invalid daily entry';
  end if;

  delete from public.time_entries
  where contractor_id = p_contractor_id and date between v_start and p_week_ending;

  insert into public.time_entries (
    contractor_id, company_id, project_id, date, hours, billable_hours,
    is_billable, bill_rate, description, status, submitted_at
  )
  select p_contractor_id, coalesce(p_company_id, p.company_id), e.project_id,
    e.date, e.hours, e.billable_hours, e.is_billable, e.bill_rate,
    nullif(btrim(e.description), ''), 'submitted', now()
  from jsonb_to_recordset(p_entries) as e(
    project_id uuid, date date, hours numeric, billable_hours numeric,
    is_billable boolean, bill_rate numeric, description text
  )
  join public.projects p on p.id = e.project_id;

  get diagnostics v_inserted = row_count;
  if v_inserted <> jsonb_array_length(p_entries) then
    raise exception 'Project no longer exists';
  end if;

  delete from public.timesheet_drafts
  where team_member_id = p_contractor_id and week_ending = p_week_ending;

  select coalesce(jsonb_agg(to_jsonb(e) order by e.date, e.project_id), '[]'::jsonb)
    into v_result
  from public.time_entries e
  where e.contractor_id = p_contractor_id and e.date between v_start and p_week_ending;
  return v_result;
end;
$$;

-- Only the server route may call this function. It gets the contractor ID from
-- the verified session and validates assignments and daily descriptions first.
revoke all on function public.replace_contractor_timesheet(uuid, uuid, date, jsonb) from public, anon, authenticated;
grant execute on function public.replace_contractor_timesheet(uuid, uuid, date, jsonb) to service_role;

commit;
