-- Apply only after approval and staging verification.
-- Additive: no changes to contractor portal tables, storage policies, schedules or time entries.
begin;
create table public.commercial_access (
  company_id uuid not null references public.companies(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner','admin','viewer')),
  primary key(company_id,user_id)
);
-- Snapshot verified company owners; future edits to profiles/team roles do not grant commercial access.
insert into public.commercial_access(company_id,user_id,role)
select id,owner_id,'owner' from public.companies where owner_id is not null;
-- Additional executive viewers and administrators are assigned explicitly after owner review.
-- Editable team/profile roles are never used to grant access to executed agreements.

create table public.commercial_documents (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id),
  client_id uuid not null references public.clients(id), project_id uuid references public.projects(id),
  title text not null check(length(title) between 1 and 160),
  category text not null check(category in ('NDA','MPSA','SOW','Change order','Amendment','Other')),
  status text not null default 'Executed' check(status='Executed'),
  effective_date date not null, expiry_date date check(expiry_date>=effective_date), tags text[] not null default '{}',
  created_at timestamptz not null default now(),created_by uuid not null references auth.users(id),
  archived_at timestamptz,deleted_at timestamptz
);
create index commercial_documents_client on public.commercial_documents(client_id,created_at desc) where deleted_at is null;
create table public.commercial_document_versions (
  id uuid primary key,document_id uuid not null references public.commercial_documents(id) on delete cascade,
  version integer not null check(version>0),file_path text not null unique,file_name text not null,
  file_bytes integer not null check(file_bytes between 1 and 20971520),
  uploaded_at timestamptz not null default now(),uploaded_by uuid not null references auth.users(id),ready boolean not null default false,canceled boolean not null default false,
  unique(document_id,version)
);
create table public.project_scope_contacts (
  id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),
  client_id uuid not null references public.clients(id),project_id uuid not null references public.projects(id),
  name text not null check(length(name) between 1 and 100),title text not null default '',organization text not null default '',
  email text not null default '',phone text not null default '',purpose text not null default '',is_primary boolean not null default false,
  archived_at timestamptz,updated_at timestamptz not null default now()
);
create unique index project_scope_contacts_primary on public.project_scope_contacts(project_id) where is_primary and archived_at is null;
create index project_scope_contacts_client on public.project_scope_contacts(client_id);
create table public.commercial_events (
  id uuid primary key default gen_random_uuid(),company_id uuid not null references public.companies(id),client_id uuid not null references public.clients(id),
  document_id uuid references public.commercial_documents(id),project_id uuid references public.projects(id),actor_id uuid not null references auth.users(id),
  action text not null,details jsonb not null default '{}',created_at timestamptz not null default now()
);
create index commercial_events_client on public.commercial_events(client_id,created_at desc);

-- Server-only metadata. Every route verifies the Supabase bearer token and scoped access before using service role.
alter table public.commercial_access enable row level security;
alter table public.commercial_documents enable row level security;
alter table public.commercial_document_versions enable row level security;
alter table public.project_scope_contacts enable row level security;
alter table public.commercial_events enable row level security;
revoke all on public.commercial_access,public.commercial_documents,public.commercial_document_versions,public.project_scope_contacts,public.commercial_events from anon,authenticated;
grant all on public.commercial_access,public.commercial_documents,public.commercial_document_versions,public.project_scope_contacts,public.commercial_events to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('commercial-documents','commercial-documents',false,20971520,array['application/pdf']);
-- No anonymous/authenticated Storage policy: upload tokens and short-lived signed URLs are issued only by authorized server routes.

create function public.reserve_commercial_document_version(p_document uuid,p_version uuid,p_path text,p_name text,p_bytes integer,p_actor uuid)
returns integer language plpgsql security invoker set search_path='' as $$
declare d public.commercial_documents; v integer;
begin
  select * into d from public.commercial_documents where id=p_document and archived_at is null and deleted_at is null for update;
  if not found or not exists(select 1 from public.commercial_access where company_id=d.company_id and user_id=p_actor and role in ('owner','admin')) then raise exception 'Not authorized'; end if;
  if p_path<>d.company_id::text||'/'||d.client_id::text||'/'||d.id::text||'/'||p_version::text||'.pdf' then raise exception 'Invalid file path'; end if;
  select coalesce(max(version),0)+1 into v from public.commercial_document_versions where document_id=d.id;
  insert into public.commercial_document_versions(id,document_id,version,file_path,file_name,file_bytes,uploaded_by) values(p_version,d.id,v,p_path,p_name,p_bytes,p_actor);
  insert into public.commercial_events(company_id,client_id,document_id,actor_id,action,details) values(d.company_id,d.client_id,d.id,p_actor,'reserve-version',jsonb_build_object('version',v));
  return v;
end $$;
revoke all on function public.reserve_commercial_document_version(uuid,uuid,text,text,integer,uuid) from public,anon,authenticated;
grant execute on function public.reserve_commercial_document_version(uuid,uuid,text,text,integer,uuid) to service_role;

-- Metadata changes and their audit entry commit together. Canceled versions keep their
-- path for idempotent Storage cleanup; their signed read URLs are never issued.
create function public.transition_commercial_document(p_document uuid,p_actor uuid,p_action text,p_version uuid default null)
returns void language plpgsql security invoker set search_path='' as $$
declare d public.commercial_documents; v public.commercial_document_versions;
begin
  select * into d from public.commercial_documents where id=p_document for update;
  if not found or not exists(select 1 from public.commercial_access where company_id=d.company_id and user_id=p_actor and role in ('owner','admin')) then raise exception 'Not authorized'; end if;
  if p_action not in ('complete','cancel-upload','archive','restore','delete') then raise exception 'Invalid document action'; end if;
  if d.deleted_at is not null and p_action not in ('delete','cancel-upload') then raise exception 'Document deleted'; end if;
  if p_action in ('complete','cancel-upload') then
    select * into v from public.commercial_document_versions where id=p_version and document_id=d.id for update;
    if not found then raise exception 'Version not found'; end if;
    if p_action='complete' then
      if v.canceled or d.archived_at is not null then raise exception 'Upload canceled or document archived'; end if;
      if v.ready then return; end if;
      update public.commercial_document_versions set ready=true where id=v.id;
    else
      if v.ready then raise exception 'Executed versions cannot be canceled'; end if;
      if v.canceled then return; end if;
      update public.commercial_document_versions set canceled=true where id=v.id;
      if not exists(select 1 from public.commercial_document_versions where document_id=d.id and not canceled) then update public.commercial_documents set deleted_at=now() where id=d.id; end if;
    end if;
  elsif p_action='archive' then
    if d.archived_at is not null then return; end if;
    update public.commercial_documents set archived_at=now() where id=d.id;
  elsif p_action='restore' then
    if d.archived_at is null then return; end if;
    update public.commercial_documents set archived_at=null where id=d.id;
  else
    if d.deleted_at is not null then return; end if;
    update public.commercial_documents set deleted_at=now() where id=d.id;
  end if;
  insert into public.commercial_events(company_id,client_id,document_id,actor_id,action,details) values(d.company_id,d.client_id,d.id,p_actor,p_action,jsonb_build_object('version',p_version));
end $$;
revoke all on function public.transition_commercial_document(uuid,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.transition_commercial_document(uuid,uuid,text,uuid) to service_role;

create function public.save_project_scope_contact(p_id uuid,p_project uuid,p_client uuid,p_company uuid,p_actor uuid,p_contact jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v uuid;
begin
  perform 1 from public.projects where id=p_project and client_id=p_client and company_id=p_company for update;
  if not found or not exists(select 1 from public.commercial_access where company_id=p_company and user_id=p_actor and role in ('owner','admin')) then raise exception 'Not authorized'; end if;
  if p_id is not null and not exists(select 1 from public.project_scope_contacts where id=p_id and project_id=p_project and client_id=p_client and company_id=p_company) then raise exception 'Contact not found'; end if;
  if coalesce((p_contact->>'is_primary')::boolean,false) then
    update public.project_scope_contacts set is_primary=false,purpose=case when purpose='Primary POC' then 'Secondary POC' else purpose end,updated_at=now() where project_id=p_project and is_primary;
  end if;
  v=coalesce(p_id,gen_random_uuid());
  insert into public.project_scope_contacts(id,company_id,client_id,project_id,name,title,organization,email,phone,purpose,is_primary)
  values(v,p_company,p_client,p_project,p_contact->>'name',p_contact->>'title',p_contact->>'organization',p_contact->>'email',p_contact->>'phone',p_contact->>'purpose',coalesce((p_contact->>'is_primary')::boolean,false))
  on conflict(id) do update set name=excluded.name,title=excluded.title,organization=excluded.organization,email=excluded.email,phone=excluded.phone,purpose=excluded.purpose,is_primary=excluded.is_primary,updated_at=now();
  insert into public.commercial_events(company_id,client_id,project_id,actor_id,action,details) values(p_company,p_client,p_project,p_actor,'save-contact',jsonb_build_object('contact',v));
  return v;
end $$;
revoke all on function public.save_project_scope_contact(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_project_scope_contact(uuid,uuid,uuid,uuid,uuid,jsonb) to service_role;

alter table public.project_terms add column budget_cadence text not null default 'monthly' check(budget_cadence in ('monthly','overall'));
alter table public.project_terms add column supporting_document_id uuid references public.commercial_documents(id);
create table public.project_terms_revisions (
  id uuid primary key default gen_random_uuid(),project_id uuid not null references public.projects(id),
  company_id uuid not null references public.companies(id),snapshot jsonb not null,operation text not null,
  actor_id uuid references auth.users(id),created_at timestamptz not null default now()
);
create index project_terms_revisions_project on public.project_terms_revisions(project_id,created_at desc);
alter table public.project_terms_revisions enable row level security;
revoke all on public.project_terms_revisions from anon,authenticated;
grant all on public.project_terms_revisions to service_role;
create schema if not exists commercial_private;
revoke all on schema commercial_private from public,anon,authenticated;
-- Preserve existing direct-edit behavior while rejecting cross-company scope references.
create function commercial_private.validate_commercial_terms_scope() returns trigger language plpgsql security definer set search_path='' as $$
declare scope_company uuid;
begin
  select company_id into scope_company from public.projects where id=new.project_id;
  if scope_company is null or (new.company_id is not null and new.company_id<>scope_company) then raise exception 'Commercial terms must belong to the scope company'; end if;
  new.company_id=scope_company;
  return new;
end $$;
revoke all on function commercial_private.validate_commercial_terms_scope() from public,anon,authenticated;
create trigger commercial_terms_scope before insert or update on public.project_terms for each row execute function commercial_private.validate_commercial_terms_scope();

create function commercial_private.capture_commercial_terms_revision() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null and coalesce(current_setting('role',true),'none') <> 'service_role' then raise exception 'Authenticated changes only'; end if;
  insert into public.project_terms_revisions(project_id,company_id,snapshot,operation,actor_id)
  select old.project_id,p.company_id,to_jsonb(old),tg_op,coalesce(nullif(current_setting('app.commercial_actor',true),'')::uuid,auth.uid()) from public.projects p where p.id=old.project_id;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
revoke all on function commercial_private.capture_commercial_terms_revision() from public,anon,authenticated;
create trigger commercial_terms_revision before update or delete on public.project_terms for each row execute function commercial_private.capture_commercial_terms_revision();

create function public.append_commercial_terms(p_project uuid,p_actor uuid,p_terms text,p_start date,p_end date,p_amount numeric,p_cadence text,p_document uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare p public.projects; last_phase public.project_terms; v uuid;
begin
  select * into p from public.projects where id=p_project for update;
  if not found or not exists(select 1 from public.commercial_access where company_id=p.company_id and user_id=p_actor and role in ('owner','admin')) then raise exception 'Not authorized'; end if;
  if p_terms not in ('tm_nte','tm_open','lump_sum') or p_cadence not in ('monthly','overall') or p_start is null or (p_end is not null and p_end<p_start) or (p_terms<>'tm_open' and (p_amount is null or p_amount<=0)) then raise exception 'Invalid commercial terms'; end if;
  if p_terms='lump_sum' and (p_cadence<>'monthly' or extract(day from p_start)<>1) then raise exception 'Monthly fee changes must begin on the first of a month'; end if;
  if not exists(select 1 from public.commercial_documents where id=p_document and client_id=p.client_id and company_id=p.company_id and deleted_at is null and exists(select 1 from public.commercial_document_versions v where v.document_id=public.commercial_documents.id and v.ready) and (project_id is null or project_id=p.id)) then raise exception 'Choose a supporting agreement for this client/scope'; end if;
  if not exists(select 1 from public.project_terms where project_id=p.id) and p_start>coalesce(p.start_date,'2020-01-01') then
    insert into public.project_terms(company_id,project_id,terms,effective_start,effective_end,nte_amount,monthly_fee,notes)
    values(p.company_id,p.id,case when coalesce(p.budget_type,'') !~* '(t_m|time|hourly)' then 'lump_sum' when coalesce(p.budget,0)>0 then 'tm_nte' else 'tm_open' end,coalesce(p.start_date,'2020-01-01'),least(coalesce(p.end_date,p_start-1),p_start-1),case when coalesce(p.budget_type,'') ~* '(t_m|time|hourly)' then nullif(p.budget,0) end,case when coalesce(p.budget_type,'') !~* '(t_m|time|hourly)' then nullif(p.fixed_amount,0) end,'Baseline retained from existing project settings');
  end if;
  select * into last_phase from public.project_terms where project_id=p.id order by effective_start desc limit 1 for update;
  if found then
    if p_start<=last_phase.effective_start then raise exception 'Add changes after the latest phase start; prior phases are retained'; end if;
    if last_phase.terms='lump_sum' and (last_phase.effective_end is null or last_phase.effective_end>=p_start) and extract(day from p_start)<>1 then raise exception 'Changing from a monthly fee must begin on the first of a month'; end if;
    perform set_config('app.commercial_actor',p_actor::text,true);
    if last_phase.effective_end is null or last_phase.effective_end>=p_start then update public.project_terms set effective_end=p_start-1 where id=last_phase.id; end if;
    if last_phase.effective_end is not null and last_phase.effective_end<p_start-1 then
      insert into public.project_terms(company_id,project_id,terms,effective_start,effective_end,notes) values(p.company_id,p.id,'tm_open',last_phase.effective_end+1,p_start-1,'Retained existing open-budget continuation');
    end if;
  end if;
  insert into public.project_terms(company_id,project_id,terms,effective_start,effective_end,nte_amount,monthly_fee,budget_cadence,supporting_document_id)
  values(p.company_id,p.id,p_terms,p_start,p_end,case when p_terms='tm_nte' then p_amount end,case when p_terms='lump_sum' then p_amount end,p_cadence,p_document) returning id into v;
  insert into public.commercial_events(company_id,client_id,project_id,actor_id,action,details) values(p.company_id,p.client_id,p.id,p_actor,'append-terms',jsonb_build_object('phase',v,'effective_start',p_start));
  return v;
end $$;
revoke all on function public.append_commercial_terms(uuid,uuid,text,date,date,numeric,text,uuid) from public,anon,authenticated;
grant execute on function public.append_commercial_terms(uuid,uuid,text,date,date,numeric,text,uuid) to service_role;
commit;
