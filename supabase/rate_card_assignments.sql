-- Rate card pricing and its selected projects must commit or roll back together.
-- Called only through the administrator endpoint using its verified company.
create or replace function public.save_rate_card_assignments(
  p_company_id uuid, p_rate_id uuid, p_rate jsonb, p_project_ids uuid[]
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_member uuid := (p_rate->>'team_member_id')::uuid;
  v_client uuid := (p_rate->>'client_id')::uuid;
  v_row public.bill_rates;
begin
  if p_project_ids is null or array_position(p_project_ids,null) is not null then
    raise exception 'Project selections are required';
  end if;
  -- Serialize edits for the same contractor/client, including new rate cards.
  perform pg_advisory_xact_lock(hashtextextended(p_company_id::text || v_member::text || v_client::text,0));
  if not exists(select 1 from public.team_members where id=v_member and company_id=p_company_id)
    or not exists(select 1 from public.clients where id=v_client and company_id=p_company_id) then
    raise exception 'Contractor and client must belong to this company';
  end if;
  if exists(select 1 from unnest(p_project_ids) selected(id) where not exists(
    select 1 from public.projects p where p.id=selected.id and p.company_id=p_company_id and p.client_id=v_client
      and p.status='active' and p.is_active is distinct from false
  )) then raise exception 'Choose active projects belonging to this client'; end if;
  if p_rate_id is not null then
    select * into v_row from public.bill_rates where id=p_rate_id and company_id=p_company_id
      and team_member_id=v_member and client_id=v_client for update;
    if not found then raise exception 'Rate card not found'; end if;
  end if;
  if coalesce((p_rate->>'rate')::numeric,0)<0 or coalesce((p_rate->>'cost_amount')::numeric,0)<0
    or coalesce((p_rate->>'revenue_amount')::numeric,0)<0 or coalesce((p_rate->>'baseline_hours')::numeric,172)<=0
    or coalesce(p_rate->>'cost_type','hourly') not in ('hourly','lump_sum')
    or coalesce(p_rate->>'revenue_type','hourly') not in ('hourly','lump_sum') then
    raise exception 'Choose valid rate card amounts and types';
  end if;
  if nullif(p_rate->>'start_date','')::date > nullif(p_rate->>'end_date','')::date then
    raise exception 'End date must follow start date';
  end if;
  if p_rate_id is null then
    insert into public.bill_rates(company_id,team_member_id,client_id,rate,is_active)
      values(p_company_id,v_member,v_client,0,true) returning * into v_row;
  end if;
  update public.bill_rates set
    rate=coalesce((p_rate->>'rate')::numeric,0), notes=p_rate->>'notes',
    cost_type=coalesce(p_rate->>'cost_type','hourly'), cost_amount=coalesce((p_rate->>'cost_amount')::numeric,0),
    baseline_hours=coalesce((p_rate->>'baseline_hours')::numeric,172),
    revenue_type=coalesce(p_rate->>'revenue_type','hourly'), revenue_amount=coalesce((p_rate->>'revenue_amount')::numeric,0),
    start_date=nullif(p_rate->>'start_date','')::date,end_date=nullif(p_rate->>'end_date','')::date,updated_at=now()
    where id=v_row.id returning * into v_row;
  delete from public.team_project_assignments a using public.projects p
    where a.project_id=p.id and a.team_member_id=v_member and a.company_id=p_company_id
      and p.client_id=v_client and p.company_id=p_company_id and not(a.project_id=any(p_project_ids));
  update public.team_project_assignments set is_active=true
    where team_member_id=v_member and company_id=p_company_id and project_id=any(p_project_ids);
  insert into public.team_project_assignments(company_id,team_member_id,project_id,service,payment_type,is_active)
    select p_company_id,v_member,selected.id,'General','tm',true from (select distinct unnest(p_project_ids) id) selected
    where not exists(select 1 from public.team_project_assignments a where a.company_id=p_company_id
      and a.team_member_id=v_member and a.project_id=selected.id);
  return to_jsonb(v_row);
end;
$$;
revoke all on function public.save_rate_card_assignments(uuid,uuid,jsonb,uuid[]) from public, anon, authenticated;
grant execute on function public.save_rate_card_assignments(uuid,uuid,jsonb,uuid[]) to service_role;
