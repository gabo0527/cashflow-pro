-- Run after the function definition, in the same transaction. All fixture edits
-- and function creation are rolled back; no invoices or timesheets are touched.
do $$
#variable_conflict use_variable
declare
  member_id uuid := '0f768703-7861-4ac2-b198-6e9cf7d528c7';
  company_id uuid := 'a1b2c3d4-0000-4000-a000-000000000001';
  client_id uuid := '58b0cc01-a4f0-4f03-9490-d0986f3c9186';
  card public.bill_rates;
  original jsonb;
  selected uuid[];
  other_count integer;
  after_count integer;
begin
  select * into strict card from public.bill_rates r where r.team_member_id=member_id and r.client_id=client_id;
  original := to_jsonb(card);
  select array_agg(a.project_id) into selected from public.team_project_assignments a join public.projects p on p.id=a.project_id where a.team_member_id=member_id and p.client_id=client_id;
  select count(*) into other_count from public.team_project_assignments a join public.projects p on p.id=a.project_id where a.team_member_id=member_id and p.client_id<>client_id;
  perform public.save_rate_card_assignments(company_id,card.id,original,selected);
  perform public.save_rate_card_assignments(company_id,card.id,original,'{}');
  if exists(select 1 from public.team_project_assignments a join public.projects p on p.id=a.project_id where a.team_member_id=member_id and p.client_id=client_id) then raise exception 'Empty selection was not saved'; end if;
  perform public.save_rate_card_assignments(company_id,card.id,original,selected);
  select count(*) into after_count from public.team_project_assignments a join public.projects p on p.id=a.project_id where a.team_member_id=member_id and p.client_id<>client_id;
  if after_count<>other_count then raise exception 'Other-client assignments changed'; end if;
  begin
    perform public.save_rate_card_assignments(company_id,card.id,original,array['eb74ee05-bb8d-41ce-97f3-6d800d074341'::uuid]);
    raise exception 'Cross-client project accepted';
  exception when others then
    if sqlerrm<>'Choose active projects belonging to this client' then raise; end if;
  end;
  if has_function_privilege('authenticated','public.save_rate_card_assignments(uuid,uuid,jsonb,uuid[])','execute') or
     has_function_privilege('anon','public.save_rate_card_assignments(uuid,uuid,jsonb,uuid[])','execute') then raise exception 'RPC exposed to non-admin clients'; end if;
end;
$$;
-- New cards create exactly the selected assignments; duplicate creation fails
-- without removing the existing card or its selections.
do $$
declare test_member uuid := gen_random_uuid(); saved jsonb;
begin
  insert into public.team_members(id,company_id,name,status) values(test_member,'a1b2c3d4-0000-4000-a000-000000000001','Transactional assignment test','active');
  saved := public.save_rate_card_assignments('a1b2c3d4-0000-4000-a000-000000000001',null,
    jsonb_build_object('team_member_id',test_member,'client_id','58b0cc01-a4f0-4f03-9490-d0986f3c9186','rate',112),
    array['9389d94b-460a-41d7-916c-d1babcd3c996'::uuid,'f29ffc5c-39bc-4904-867a-aa5769df92ff'::uuid]);
  if (select count(*) from public.team_project_assignments where team_member_id=test_member)<>2 then raise exception 'New card did not save exactly its selections'; end if;
  begin
    perform public.save_rate_card_assignments('a1b2c3d4-0000-4000-a000-000000000001',null,saved,'{}');
    raise exception 'Duplicate card accepted';
  exception when unique_violation then null; end;
  if (select count(*) from public.team_project_assignments where team_member_id=test_member)<>2 then raise exception 'Duplicate failure removed selections'; end if;
end;
$$;

-- Force an assignment failure AFTER the pricing UPDATE to prove atomicity.
create function public.assignment_failure_test() returns trigger language plpgsql as $$begin raise exception 'Intentional assignment failure'; end;$$;
create trigger assignment_failure_test before insert on public.team_project_assignments for each row execute function public.assignment_failure_test();
do $$
#variable_conflict use_variable
declare card public.bill_rates; before_assignments jsonb;
begin
  select * into strict card from public.bill_rates where team_member_id='0f768703-7861-4ac2-b198-6e9cf7d528c7' and client_id='58b0cc01-a4f0-4f03-9490-d0986f3c9186';
  select jsonb_agg(to_jsonb(a) order by id) into before_assignments from public.team_project_assignments a where team_member_id=card.team_member_id;
  begin
    perform public.save_rate_card_assignments(card.company_id,card.id,to_jsonb(card)||jsonb_build_object('rate',999),array['6f1ae096-ee9d-435c-8269-694c4ce57135'::uuid]);
    raise exception 'Expected failure did not occur';
  exception when others then if sqlerrm<>'Intentional assignment failure' then raise; end if; end;
  if (select rate from public.bill_rates where id=card.id)<>card.rate then raise exception 'Failed assignment changed pricing'; end if;
  if (select jsonb_agg(to_jsonb(a) order by id) from public.team_project_assignments a where team_member_id=card.team_member_id) is distinct from before_assignments then raise exception 'Failed assignment changed selections'; end if;
end;
$$;

