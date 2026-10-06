-- Run after preparing the temporary schema/function as described in the
-- update notes. All fixtures are temporary and the transaction is rolled back.
do $$
declare
  contractor uuid := '00000000-0000-4000-8000-000000000001';
  company uuid := '00000000-0000-4000-8000-000000000002';
  project uuid := '00000000-0000-4000-8000-000000000003';
  other_project uuid := '00000000-0000-4000-8000-000000000004';
  fixture jsonb;
  result jsonb;
begin
  insert into pg_temp.projects (id, company_id) values (project, company), (other_project, company);
  fixture := jsonb_build_array(
    jsonb_build_object('project_id', project, 'date', '2026-10-05', 'hours', 2, 'billable_hours', 2, 'is_billable', true, 'bill_rate', 100, 'description', 'Monday estimate review'),
    jsonb_build_object('project_id', project, 'date', '2026-10-06', 'hours', 3.5, 'billable_hours', 3.5, 'is_billable', true, 'bill_rate', 100, 'description', 'Tuesday schedule update'),
    jsonb_build_object('project_id', other_project, 'date', '2026-10-05', 'hours', 1, 'billable_hours', 1, 'is_billable', true, 'bill_rate', 80, 'description', 'Other client Monday work')
  );
  insert into pg_temp.timesheet_drafts (team_member_id, project_id, week_ending, daily_hours, daily_descriptions)
    values (contractor, project, '2026-10-11', '{"2026-10-05":2}', '{"2026-10-05":"Monday estimate review"}');
  result := pg_temp.replace_contractor_timesheet(contractor, company, '2026-10-11', fixture);
  if jsonb_array_length(result) <> 3
    or (select description from pg_temp.time_entries where project_id = project and date = '2026-10-05') <> 'Monday estimate review'
    or (select description from pg_temp.time_entries where project_id = project and date = '2026-10-06') <> 'Tuesday schedule update'
    or (select description from pg_temp.time_entries where project_id = other_project and date = '2026-10-05') <> 'Other client Monday work'
    or exists (select 1 from pg_temp.timesheet_drafts) then
    raise exception 'Daily descriptions or draft cleanup failed';
  end if;

  perform pg_temp.replace_contractor_timesheet(contractor, company, '2026-10-11', fixture);
  if (select count(*) from pg_temp.time_entries) <> 3 then raise exception 'Resubmission duplicated entries'; end if;

  -- A missing project causes an insert failure after deletion. The transaction
  -- must restore the original submitted entries and keep the draft.
  insert into pg_temp.timesheet_drafts (team_member_id, project_id, week_ending, daily_hours, daily_descriptions)
    values (contractor, project, '2026-10-11', '{"2026-10-05":2}', '{"2026-10-05":"Keep this draft"}');
  begin
    perform pg_temp.replace_contractor_timesheet(contractor, company, '2026-10-11',
      jsonb_build_array(jsonb_build_object('project_id', '00000000-0000-4000-8000-000000000099', 'date', '2026-10-05', 'hours', 2)));
    raise exception 'Expected missing-project rejection';
  exception when others then
    if sqlerrm <> 'Project no longer exists' then raise; end if;
  end;
  if (select count(*) from pg_temp.time_entries) <> 3 or (select count(*) from pg_temp.timesheet_drafts) <> 1 then
    raise exception 'Failed submission lost saved entries or drafts';
  end if;

  perform pg_temp.replace_contractor_timesheet(contractor, company, '2026-10-11', '[]');
  if exists (select 1 from pg_temp.time_entries) or exists (select 1 from pg_temp.timesheet_drafts) then
    raise exception 'Zero-hour submission did not clear the week';
  end if;

  perform pg_temp.replace_contractor_timesheet(contractor, company, '2026-11-01',
    jsonb_build_array(jsonb_build_object('project_id', project, 'date', '2026-10-26', 'hours', 2, 'description', 'October work'),
                      jsonb_build_object('project_id', project, 'date', '2026-11-01', 'hours', 1, 'description', 'November work')));
  if (select count(distinct extract(month from date)) from pg_temp.time_entries) <> 2 then raise exception 'Cross-month dates changed'; end if;

  insert into pg_temp.contractor_invoices (team_member_id, status, period_start, period_end)
    values (contractor, 'approved', '2026-10-26', '2026-11-01');
  begin
    perform pg_temp.replace_contractor_timesheet(contractor, company, '2026-11-01', '[]');
    raise exception 'Expected invoiced-week rejection';
  exception when others then
    if sqlerrm <> 'This week has been invoiced and is locked' then raise; end if;
  end;
  if (select count(*) from pg_temp.time_entries) <> 2 then raise exception 'Locked week was altered'; end if;
end;
$$;
