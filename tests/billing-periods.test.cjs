const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript')
function load(file,mocks={}){const m={exports:{}};const js=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;vm.runInThisContext(`(function(require,module,exports){${js}\n})`)(n=>Object.hasOwn(mocks,n)?mocks[n]:['@/lib/pooled-invoices','./pooled-invoices'].includes(n)?load('src/lib/pooled-invoices.ts'):require(n),m,m.exports);return m.exports}
const billing=load('src/lib/billing-periods.ts'),payables=load('src/lib/payables.ts')
const policy={client_id:'client',project_id:null,cycle_start_day:26,net_days:45,contractor_payment_basis:'client_payment',effective_start:'2026-10-01'}
test('26th–25th closes in the selected month, including January and leap years',()=>{
 assert.equal(billing.billingPeriod('2027-01',26).start,'2026-12-26');assert.equal(billing.billingPeriod('2027-01',26).end,'2027-01-25')
 assert.equal(billing.billingPeriod('2028-02',26).start,'2028-01-26');assert.equal(billing.billingPeriod('2028-03',26).start,'2028-02-26')
 assert.equal(billing.billingPeriod('2028-02',1).end,'2028-02-29')
 assert.equal(billing.periodContaining('2026-10-25',26).closingMonth,'2026-10');assert.equal(billing.periodContaining('2026-10-26',26).closingMonth,'2026-11')
 assert.equal(billing.lastClosedBillingPeriod('2026-11-03',26).end,'2026-10-25')
})
test('Net 30, 45 and 60 change the client due date without changing the work period',()=>{
 const period=billing.billingPeriod('2026-11',26)
 assert.equal(period.start,'2026-10-26');assert.equal(period.end,'2026-11-25')
 assert.deepEqual([30,45,60].map(n=>billing.invoiceDueDate('2026-11-30',n)),['2026-12-30','2027-01-14','2027-01-29'])
 assert.equal(billing.invoiceDueDate('2026-11-30',0),'2026-11-30')
 for(const [date,n] of [['2026-02-30',45],['bad',30],['2026-11-30',-1],['2026-11-30',1.5]])assert.throws(()=>billing.invoiceDueDate(date,n))
})
test('project overrides remain scoped; client terms edits do not mutate a submitted snapshot',()=>{
 const policies=[policy,{...policy,project_id:'special',cycle_start_day:1,net_days:60}]
 const snapshot=JSON.parse(JSON.stringify(billing.billingPolicy(policies,'client','normal')))
 assert.equal(billing.billingPolicy(policies,'client','special').net_days,60)
 policies[0]={...policy,net_days:30}
 assert.equal(billing.billingPolicy(policies,'client').cycle_start_day,26);assert.equal(snapshot.net_days,45)
 assert.equal(billing.billingPolicy(policies,'other').cycle_start_day,1)
})
test('waiting for client funds is distinct from an overdue or unscheduled payable',()=>{
 const invoice={status:'approved',payment_basis:'client_payment',due_date:null}
 assert.equal(payables.payableBucket(invoice,'2026-11-03'),'awaiting_client_payment')
 assert.equal(billing.contractorPaymentLabel(invoice),'Awaiting client payment')
 assert.equal(payables.payableBucket({...invoice,client_payment_received_on:'2026-11-02'},'2026-11-03'),'ready_to_schedule')
 assert.equal(payables.payableBucket({...invoice,client_payment_received_on:'2026-11-02',due_date:'2026-11-01'},'2026-11-03'),'overdue')
})
function fixtureDB(fixture){return {from(table){let patch,filters=[],operation='read';const q={select(){return q},eq(k,v){filters.push([k,v]);return q},gte(){return q},lte(){return q},in(){return q},order(){return q},limit(){return q},update(p){patch=p;operation='update';return q},insert(p){patch=p;operation='insert';return q},upsert(p){patch=p;operation='upsert';return q},single(){const r=result();return Promise.resolve({...r,data:Array.isArray(r.data)?r.data[0] || null:r.data})},then(resolve){resolve(result())}};function result(){let data=fixture[table] || [];if(operation==='upsert'){for(const row of patch)if(!data.some(d=>d.team_member_id===row.team_member_id && d.client_id===row.client_id && d.project_id===row.project_id && d.closing_month===row.closing_month))data.push({id:`obligation-${data.length}`,required:true,reminder_state:'pending',...row});fixture[table]=data}if(operation==='insert'){fixture.saved=patch;return {data:patch,error:null}}if(operation==='update'){fixture.saved=patch;return {data:[patch],error:null}}data=data.filter(row=>filters.every(([k,v])=>row[k]===v));return {data,error:null}}return q}}}
function obligations(today,fixture,policies=[policy]){return load('src/lib/invoice-obligations.ts',{'./contractor-auth':{},'./payables':{...payables,localToday:()=>today},'./billing-periods':billing,'./billing-policy-server':{readBillingPolicies:async()=>policies}}).invoiceObligations(fixtureDB(fixture),'company',today.slice(0,7)+'-01')}
function followupFixture(){return {team_members:[{id:'member',company_id:'company',status:'active',employment_type:'contractor',name:'Alex',email:'alex@example.test'}],team_project_assignments:[{team_member_id:'member',project_id:'project',company_id:'company',is_active:true}],projects:[{id:'project',client_id:'client',company_id:'company',name:'Work',status:'active'}],clients:[{id:'client',name:'NovaInSite',company_id:'company'}],contractor_billing_obligations:[]}}
test('custom October 25 periods precede cutoff; November 25 periods wait until they close',async()=>{
 assert.deepEqual(await obligations('2026-10-28',followupFixture()),[])
 assert.deepEqual(await obligations('2026-11-24',followupFixture()),[])
 const rows=await obligations('2026-11-26',followupFixture())
 assert.equal(rows.length,1);assert.equal(rows[0].period_start,'2026-10-26');assert.equal(rows[0].period_end,'2026-11-25');assert.equal(rows[0].grace_through,'2026-12-01');assert.equal(rows[0].overdue,false)
})
test('an invoice for another client or an incomplete period cannot suppress a reminder',async()=>{
 for(const invoice of [{client_id:'other',period_start:'2026-10-26',period_end:'2026-11-25'},{client_id:'client',period_start:'2026-11-01',period_end:'2026-11-25'}]){
  const f=followupFixture();f.contractor_invoices=[{...invoice,company_id:'company',team_member_id:'member',status:'approved'}]
  assert.equal((await obligations('2026-11-26',f))[0].received,false)
 }
 const f=followupFixture();f.contractor_invoices=[{client_id:'client',period_start:'2026-10-26',period_end:'2026-11-25',company_id:'company',team_member_id:'member',status:'submitted'}]
 assert.equal((await obligations('2026-11-26',f))[0].received,true)
})
test('calendar October 31 remains eligible and existing sent reminders are retained',async()=>{
 const f=followupFixture();f.contractor_invoice_obligations=[{company_id:'company',team_member_id:'member',period_start:'2026-10-01',required:true,reminder_state:'sent',reminded_at:'2026-11-05T14:00:00Z'}]
 const rows=await obligations('2026-10-31',f,[{...policy,cycle_start_day:1}]);assert.equal(rows.length,0)
 const run=load('src/lib/invoice-obligations.ts',{'./contractor-auth':{},'./payables':{...payables,localToday:()=> '2026-11-06'},'./billing-periods':billing,'./billing-policy-server':{readBillingPolicies:async()=>[{...policy,cycle_start_day:1}]}}).invoiceObligations
 const next=await run(fixtureDB(f),'company','2026-10-01');assert.equal(next[0].reminder_state,'sent');assert.equal(next[0].period_end,'2026-10-31')
})
const next={NextResponse:{json:(body,options={})=>({body,status:options.status||200})}}
const ids={member:'11111111-1111-4111-8111-111111111111',client:'22222222-2222-4222-8222-222222222222',invoice:'33333333-3333-4333-8333-333333333333'}
function invoiceRoute(f,portal=true){const db=fixtureDB(f);return load('src/app/api/contractor-invoices/route.ts',{'next/server':next,'@supabase/supabase-js':{createClient:()=>db},'@/lib/admin-context':{adminContext:async()=>({db,companyId:'company',token:'test',user:{id:'admin'}})},'@/lib/contractor-auth':{getSupabaseAdmin:()=>db,readSessionFromCookie:async()=>({contractorId:ids.member,email:'alex@example.test'})},'@/lib/billing-periods':billing,'@/lib/billing-policy-server':{readBillingPolicies:async()=>[{...policy,client_id:ids.client}]},'@/lib/payables':payables})}
function invoiceFixture(){return {team_members:[{id:ids.member,email:'alex@example.test',status:'active',company_id:'company'}],clients:[{id:ids.client,company_id:'company'}],projects:[{id:'project',client_id:ids.client,company_id:'company'}],team_project_assignments:[{team_member_id:ids.member,project_id:'project'}]}}
const newInvoice={team_member_id:ids.member,client_id:ids.client,invoice_number:'TEST',invoice_date:'2026-11-30',period_start:'2026-10-26',period_end:'2026-11-25',total_amount:100,payment_terms:'NET45',due_date:'2027-01-14'}
test('portal submission snapshots policy, preserves issue date, and does not impose client Net 45 on contractor payout',async()=>{
 const f=invoiceFixture(),route=invoiceRoute(f)
 const result=await route.POST({json:async()=>({portal:true,table:'contractor_invoices',operation:'insert',values:newInvoice})})
 assert.equal(result.status,200);assert.equal(f.saved[0].invoice_date,'2026-11-30');assert.equal(f.saved[0].due_date,null);assert.equal(f.saved[0].billing_snapshot.net_days,45);assert.equal(f.saved[0].payment_basis,'client_payment')
})
test('portal rejects a calendar-month range for a client configured for 26th–25th',async()=>{
 const f=invoiceFixture(),route=invoiceRoute(f)
 const result=await route.POST({json:async()=>({portal:true,table:'contractor_invoices',operation:'insert',values:{...newInvoice,period_start:'2026-11-01',period_end:'2026-11-30'}})})
 assert.equal(result.status,400);assert.equal(f.saved,undefined)
})
test('admin cannot mark conditional invoices paid until client payment is recorded',async()=>{
 const f=invoiceFixture();f.contractor_invoices=[{id:ids.invoice,company_id:'company',payment_basis:'client_payment',status:'approved',due_date:null,client_payment_received_on:null}]
 const route=invoiceRoute(f,false),req=values=>({json:async()=>({table:'contractor_invoices',operation:'update',filters:[{op:'eq',column:'id',value:ids.invoice}],values})})
 assert.equal((await route.POST(req({status:'paid'}))).status,400)
 assert.equal((await route.POST(req({status:'paid',client_payment_received_on:'2026-11-30'}))).status,200)
 assert.equal(f.saved.client_payment_recorded_by,'admin');assert.ok(f.saved.client_payment_recorded_at)
})

test('confirming the client invoice date records its own actor without changing the contractor issue or work dates',async()=>{
 const f=invoiceFixture();f.contractor_invoices=[{id:ids.invoice,company_id:'company',payment_basis:'client_payment',status:'approved',due_date:null,client_payment_received_on:null,client_invoice_date:null,client_net_days:45}]
 const route=invoiceRoute(f,false)
 const result=await route.POST({json:async()=>({table:'contractor_invoices',operation:'update',filters:[{op:'eq',column:'id',value:ids.invoice}],values:{client_invoice_date:'2026-11-30',client_net_days:60}})})
 assert.equal(result.status,200);assert.equal(f.saved.client_invoice_date,'2026-11-30');assert.equal(f.saved.client_net_days,60);assert.equal(f.saved.client_schedule_confirmed_by,'admin');assert.ok(f.saved.client_schedule_confirmed_at)
 assert.equal(f.saved.invoice_date,undefined);assert.equal(f.saved.period_start,undefined);assert.equal(f.saved.client_payment_received_on,undefined)
})
test('contractors cannot inject a confirmed client schedule through invoice submission',async()=>{
 const f=invoiceFixture(),route=invoiceRoute(f)
 const values={...newInvoice,client_invoice_date:'2026-01-01',client_net_days:0,client_payment_received_on:'2026-01-01'}
 const result=await route.POST({json:async()=>({portal:true,table:'contractor_invoices',operation:'insert',values})})
 assert.equal(result.status,200)
 assert.equal(f.saved[0].client_invoice_date,undefined);assert.equal(f.saved[0].client_net_days,45);assert.equal(f.saved[0].client_payment_received_on,undefined)
})

test('eligible lump-sum contractors can submit one combined calendar-month Net 60 invoice',async()=>{
 const f=invoiceFixture();f.team_members[0].cost_type='lump_sum';f.team_project_assignments[0].company_id='company'
 f.projects.push({id:'second-project',client_id:'second-client',company_id:'company'});f.team_project_assignments.push({team_member_id:ids.member,project_id:'second-project',company_id:'company'})
 const route=invoiceRoute(f),values={...newInvoice,payment_group:'pooled_lump_sum',client_id:null,period_start:'2026-11-01',period_end:'2026-11-30'}
 const result=await route.POST({json:async()=>({portal:true,table:'contractor_invoices',operation:'insert',values})})
 assert.equal(result.status,200);assert.equal(f.saved[0].payment_terms,'NET60');assert.equal(f.saved[0].due_date,'2027-01-29');assert.equal(f.saved[0].client_id,null);assert.equal(f.saved[0].billing_snapshot.pooled_client_ids.length,2)
})
test('an hourly contractor cannot designate an invoice as the lump-sum Net 60 exception',async()=>{
 const f=invoiceFixture();f.team_members[0].cost_type='hourly'
 const result=await invoiceRoute(f).POST({json:async()=>({portal:true,table:'contractor_invoices',operation:'insert',values:{...newInvoice,payment_group:'pooled_lump_sum',client_id:null}})})
 assert.equal(result.status,400);assert.equal(f.saved,undefined)
})
