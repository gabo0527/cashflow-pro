const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const engine=process.env.PGLITE_TEST_MODULE
const company='a1b2c3d4-0000-4000-a000-000000000001',member='0f768703-7861-4ac2-b198-6e9cf7d528c7',client='58b0cc01-a4f0-4f03-9490-d0986f3c9186'
test('atomic rate card database: create, edit, zero selections, isolation and forced-failure rollback',{skip:!engine&&'Set PGLITE_TEST_MODULE to an isolated PGlite installation'},async()=>{
 const {PGlite}=require(engine),db=new PGlite()
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create table team_members(id uuid primary key,company_id uuid,name text,status text);create table clients(id uuid primary key,company_id uuid);create table projects(id uuid primary key,company_id uuid,client_id uuid,status text,is_active boolean);create table bill_rates(id uuid primary key default gen_random_uuid(),company_id uuid,team_member_id uuid,client_id uuid,rate numeric,is_active boolean,notes text,cost_type text,cost_amount numeric,baseline_hours numeric,revenue_type text,revenue_amount numeric,start_date date,end_date date,updated_at timestamptz,unique(company_id,team_member_id,client_id));create table team_project_assignments(id uuid primary key default gen_random_uuid(),company_id uuid,team_member_id uuid,project_id uuid,service text,payment_type text,is_active boolean,rate numeric,bill_rate numeric,start_date date,end_date date);insert into team_members values('${member}','${company}','Fixture','active');insert into clients values('${client}','${company}'),('11111111-1111-4111-8111-111111111111','${company}');insert into projects values('9389d94b-460a-41d7-916c-d1babcd3c996','${company}','${client}','active',true),('f29ffc5c-39bc-4904-867a-aa5769df92ff','${company}','${client}','active',true),('6f1ae096-ee9d-435c-8269-694c4ce57135','${company}','${client}','active',true),('eb74ee05-bb8d-41ce-97f3-6d800d074341','${company}','11111111-1111-4111-8111-111111111111','active',true);`)
 await db.exec(fs.readFileSync(path.join(__dirname,'../supabase/rate_card_assignments.sql'),'utf8'))
 const rate={team_member_id:member,client_id:client,rate:112,cost_type:'hourly',cost_amount:35}
 await db.query('select save_rate_card_assignments($1,null,$2,$3)',[company,rate,['9389d94b-460a-41d7-916c-d1babcd3c996','f29ffc5c-39bc-4904-867a-aa5769df92ff']])
 await db.exec(fs.readFileSync(path.join(__dirname,'rate-card-assignments-database.sql'),'utf8'))
 assert.equal((await db.query('select rate from bill_rates where team_member_id=$1',[member])).rows[0].rate,'112')
 }finally{await db.close()}
})
