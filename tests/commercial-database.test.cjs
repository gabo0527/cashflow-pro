const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path')
const engine = process.env.PGLITE_TEST_MODULE
const ids = {
  user: '11111111-1111-4111-8111-111111111111',
  other: '11111111-1111-4111-8111-111111111112',
  company: '22222222-2222-4222-8222-222222222222',
  client: '33333333-3333-4333-8333-333333333333',
  project: '44444444-4444-4444-8444-444444444444',
  document: '55555555-5555-4555-8555-555555555555',
  version: '66666666-6666-4666-8666-666666666666',
}
test(
  'commercial migration preserves history, protects private documents and serializes scope contacts',
  {
    skip:
      !engine &&
      'Set PGLITE_TEST_MODULE to an isolated @electric-sql/pglite installation',
  },
  async () => {
    const { PGlite } = require(engine),
      db = new PGlite()
    try {
      await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.companies(id uuid primary key,owner_id uuid references auth.users(id));
 create table public.clients(id uuid primary key,company_id uuid references public.companies(id));
 create table public.projects(id uuid primary key,company_id uuid references public.companies(id),client_id uuid references public.clients(id),billing_model text,budget_type text,budget numeric,fixed_amount numeric,start_date date,end_date date);
 create table public.team_members(company_id uuid,email text,permission_role text,status text);
 create table public.project_terms(id uuid primary key default gen_random_uuid(),company_id uuid,project_id uuid references public.projects(id),terms text,effective_start date,effective_end date,nte_amount numeric,monthly_fee numeric,notes text);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 insert into auth.users values('${ids.user}','owner@example.test'),('${ids.other}','viewer@example.test');
 insert into companies values('${ids.company}','${ids.user}');insert into clients values('${ids.client}','${ids.company}');
 insert into projects values('${ids.project}','${ids.company}','${ids.client}','per_scope','t_m',10000,null,'2026-01-01',null);
 grant usage on schema auth,storage,public to service_role;grant all on all tables in schema public,storage to service_role;grant execute on function auth.uid() to service_role;`)
      const migration = fs
        .readdirSync(path.join(__dirname, '../supabase/migrations'))
        .find((name) => name.endsWith('_commercial_workspace.sql'))
      await db.exec(
        fs.readFileSync(
          path.join(__dirname, '../supabase/migrations', migration),
          'utf8',
        ),
      )
      assert.equal(
        (
          await db.query(
            "select public from storage.buckets where id='commercial-documents'",
          )
        ).rows[0].public,
        false,
      )
      assert.equal(
        (
          await db.query(
            "select count(*)::integer n from pg_policies where tablename like 'commercial%' or tablename='project_scope_contacts'",
          )
        ).rows[0].n,
        0,
      )
      await db.exec(
        `insert into commercial_documents(id,company_id,client_id,project_id,title,category,effective_date,created_by) values('${ids.document}','${ids.company}','${ids.client}','${ids.project}','Executed SOW','SOW','2026-01-01','${ids.user}');set role service_role;`,
      )
      const reserve = (version) =>
        db.query(
          'select public.reserve_commercial_document_version($1,$2,$3,$4,$5,$6) version',
          [
            ids.document,
            version,
            `${ids.company}/${ids.client}/${ids.document}/${version}.pdf`,
            'sow.pdf',
            100,
            ids.user,
          ],
        )
      assert.equal((await reserve(ids.version)).rows[0].version, 1)
      const transition = (action, version = null, actor = ids.user) =>
        db.query('select transition_commercial_document($1,$2,$3,$4)', [
          ids.document,
          actor,
          action,
          version,
        ])
      await transition('complete', ids.version)
      const append = (
        model,
        start,
        amount,
        cadence = 'monthly',
        actor = ids.user,
      ) =>
        db.query(
          'select public.append_commercial_terms($1,$2,$3,$4,$5,$6,$7,$8)',
          [
            ids.project,
            actor,
            model,
            start,
            null,
            amount,
            cadence,
            ids.document,
          ],
        )
      await assert.rejects(
        () =>
          db.query(
            "insert into project_terms(company_id,project_id,terms,effective_start) values('99999999-9999-4999-8999-999999999999',$1,'tm_open','2025-01-01')",
            [ids.project],
          ),
        /scope company/,
      )
      await append('tm_open', '2026-03-01', null)
      let terms = (
        await db.query('select * from project_terms order by effective_start')
      ).rows
      assert.equal(terms.length, 2)
      assert.equal(terms[0].terms, 'tm_nte')
      assert.equal(terms[0].nte_amount, '10000')
      assert.equal(
        terms[0].effective_end.toISOString().slice(0, 10),
        '2026-02-28',
      )
      await append('lump_sum', '2026-04-01', 2500)
      terms = (
        await db.query('select * from project_terms order by effective_start')
      ).rows
      assert.equal(terms.length, 3)
      assert.equal(
        terms[1].effective_end.toISOString().slice(0, 10),
        '2026-03-31',
      )
      assert.equal(terms[2].monthly_fee, '2500')
      const revisions = (
        await db.query('select snapshot,actor_id from project_terms_revisions')
      ).rows
      assert.equal(revisions.length, 1)
      assert.equal(revisions[0].snapshot.effective_end, null)
      assert.equal(revisions[0].actor_id, ids.user)
      await assert.rejects(
        () => append('tm_open', '2026-04-15', null),
        /first of a month/,
      )
      await assert.rejects(
        () => append('tm_open', '2026-03-15', null),
        /after the latest/,
      )
      await assert.rejects(
        () => append('tm_open', '2026-05-01', null, 'monthly', ids.other),
        /Not authorized/,
      )
      await append('tm_nte', '2026-05-01', 40000, 'overall')
      assert.equal(
        (
          await db.query(
            "select budget_cadence from project_terms where effective_start='2026-05-01'",
          )
        ).rows[0].budget_cadence,
        'overall',
      )
      const saveContact = (name) =>
        db.query('select save_project_scope_contact($1,$2,$3,$4,$5,$6) id', [
          null,
          ids.project,
          ids.client,
          ids.company,
          ids.user,
          {
            name,
            title: 'Director',
            organization: 'Client',
            email: 'poc@example.test',
            phone: '',
            purpose: 'Primary POC',
            is_primary: true,
          },
        ])
      await saveContact('First POC')
      await saveContact('Second POC')
      const contacts = (
        await db.query(
          'select name,purpose,is_primary from project_scope_contacts order by name',
        )
      ).rows
      assert.equal(contacts.length, 2)
      assert.equal(contacts[0].is_primary, false)
      assert.equal(contacts[0].purpose, 'Secondary POC')
      assert.equal(contacts[1].is_primary, true)
      const version2 = '66666666-6666-4666-8666-666666666667'
      assert.equal((await reserve(version2)).rows[0].version, 2)
      assert.equal(
        (
          await db.query(
            'select count(*)::integer n from commercial_document_versions',
          )
        ).rows[0].n,
        2,
      )
      await transition('cancel-upload', version2)
      await assert.rejects(() => transition('complete', version2), /canceled/)
      const version3 = '66666666-6666-4666-8666-666666666668'
      assert.equal((await reserve(version3)).rows[0].version, 3)
      await transition('archive')
      assert.ok(
        (await db.query('select archived_at from commercial_documents')).rows[0]
          .archived_at,
      )
      await assert.rejects(() => transition('complete', version3), /archived/)
      await transition('restore')
      await transition('complete', version3)
      assert.equal(
        (await db.query('select archived_at from commercial_documents')).rows[0]
          .archived_at,
        null,
      )
      await assert.rejects(
        () => transition('delete', null, ids.other),
        /Not authorized/,
      )
      const project2 = '44444444-4444-4444-8444-444444444445'
      await db.query(
        "insert into projects(id,company_id,client_id,billing_model,budget_type,budget,start_date) values($1,$2,$3,'per_scope','time_and_materials',10000,'2026-01-01')",
        [project2, ids.company, ids.client],
      )
      await db.query(
        "insert into project_terms(company_id,project_id,terms,effective_start,effective_end,nte_amount) values($1,$2,'tm_nte','2026-01-01','2026-02-28',10000)",
        [ids.company, project2],
      )
      const clientAgreement = '55555555-5555-4555-8555-555555555556'
      await db.query(
        "insert into commercial_documents(id,company_id,client_id,title,category,effective_date,created_by) values($1,$2,$3,'Master agreement','MPSA','2026-01-01',$4)",
        [clientAgreement, ids.company, ids.client, ids.user],
      )
      const agreementVersion = '66666666-6666-4666-8666-666666666669'
      await db.query(
        "insert into commercial_document_versions(id,document_id,version,file_path,file_name,file_bytes,uploaded_by,ready) values($1,$2,1,'client/master.pdf','master.pdf',100,$3,true)",
        [agreementVersion, clientAgreement, ids.user],
      )
      await db.query(
        'select append_commercial_terms($1,$2,$3,$4,$5,$6,$7,$8)',
        [
          project2,
          ids.user,
          'lump_sum',
          '2026-11-01',
          null,
          2500,
          'monthly',
          clientAgreement,
        ],
      )
      const bridge = (
        await db.query(
          'select terms,effective_start,effective_end from project_terms where project_id=$1 order by effective_start',
          [project2],
        )
      ).rows
      assert.equal(bridge.length, 3)
      assert.equal(bridge[1].terms, 'tm_open')
      assert.equal(
        bridge[1].effective_start.toISOString().slice(0, 10),
        '2026-03-01',
      )
      assert.equal(
        bridge[1].effective_end.toISOString().slice(0, 10),
        '2026-10-31',
      )
      await transition('delete')
      await transition('delete')
      assert.ok(
        (
          await db.query(
            'select deleted_at from commercial_documents where id=$1',
            [ids.document],
          )
        ).rows[0].deleted_at,
      )
      assert.equal(
        (
          await db.query(
            "select count(*)::integer n from commercial_events where document_id=$1 and action='delete'",
            [ids.document],
          )
        ).rows[0].n,
        1,
      )
      await db.exec('reset role;set role authenticated;')
      await assert.rejects(
        () => db.query('select * from commercial_documents'),
        /permission denied/,
      )
      await assert.rejects(
        () => db.query('select * from project_terms_revisions'),
        /permission denied/,
      )
      await assert.rejects(
        () => append('tm_open', '2026-06-01', null),
        /permission denied/,
      )
      await db.exec('reset role;set role anon;')
      await assert.rejects(
        () => db.query('select * from commercial_access'),
        /permission denied/,
      )
    } finally {
      await db.close()
    }
  },
)
