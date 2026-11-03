const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const ts = require('typescript')
function load(file,mocks={}) {
  const module={exports:{}}
  const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`)(n=>Object.hasOwn(mocks,n)?mocks[n]:n==='@/hooks/useBillingPolicies'?{useBillingPolicies:()=>({policies:[],loading:false,error:''})}:['@/lib/billing-periods','./billing-periods'].includes(n)?load('src/lib/billing-periods.ts'):n==='@/lib/payables'?load('src/lib/payables.ts'):['@/lib/billing-policy-server','./billing-policy-server'].includes(n)?{readBillingPolicies:async()=>[]}:require(n),module,module.exports)
  return module.exports
}
const payables=load('src/lib/payables.ts')
const billing=load('src/lib/billing-periods.ts')
test('grace period crosses weekends, observed holidays and year boundaries',()=>{
  assert.equal(payables.thirdBusinessDayAfterMonth('2026-10-31'),'2026-11-04')
  assert.equal(payables.thirdBusinessDayAfterMonth('2026-08-31'),'2026-09-03')
  assert.equal(payables.thirdBusinessDayAfterMonth('2026-12-31'),'2027-01-06')
  assert.equal(payables.thirdBusinessDayAfterMonth('2027-06-30'),'2027-07-06')
  assert.equal(payables.thirdBusinessDayAfterMonth('2026-10-31',['2026-11-02']),'2026-11-05')
  assert.ok(payables.federalHolidays(2021).includes('2021-12-31'))
})
test('Puerto Rico day boundary and January billing month are stable',()=>{
  assert.equal(payables.localToday(new Date('2026-11-04T02:00:00Z')),'2026-11-03')
  assert.deepEqual(payables.previousBillingMonth('2027-01-03'),{start:'2026-12-01',end:'2026-12-31'})
})
test('approved and scheduled older invoices remain outstanding; due today is not overdue',()=>{
  for(const status of ['submitted','pending','approved','scheduled']) assert.equal(payables.payableBucket({status,due_date:'2026-09-30'},'2026-11-03'),'overdue')
  for(const status of ['paid','rejected','draft']) assert.equal(payables.isOutstanding({status}),false)
  assert.equal(payables.payableBucket({status:'approved',due_date:'2026-11-03'},'2026-11-03'),'due_soon')
  assert.equal(payables.payableBucket({status:'approved',due_date:null},'2026-11-03'),'missing_due_date')
})
const auth=load('src/lib/admin-allowlist.ts')
test('admin allowlist grants only Gabriel and Kathia, with exact normalized addresses',()=>{
  assert.equal(auth.isAdminEmail(' KATHIA@MANOCG.COM '),true)
  for(const email of ['kathia@manocg.coim','rodrigo@manocg.com','gabriel@other.com',null]) assert.equal(auth.isAdminEmail(email),false)
})
const next={NextResponse:{json:(body,options={})=>({body,status:options.status||200})}}
test('invoice endpoint denies requests without a verified admin or contractor session',async()=>{
  const route=load('src/app/api/contractor-invoices/route.ts',{'next/server':next,'@supabase/supabase-js':{createClient(){}},'@/lib/admin-context':{adminContext:async()=>null},'@/lib/contractor-auth':{readSessionFromCookie:async()=>null}})
  const result=await route.POST({json:async()=>({table:'contractor_invoices',operation:'select',filters:[]})})
  assert.equal(result.status,401)
})
test('invoice endpoint rejects unsupported tables before accessing data',async()=>{
  const route=load('src/app/api/contractor-invoices/route.ts',{'next/server':next,'@supabase/supabase-js':{createClient(){}},'@/lib/admin-context':{},'@/lib/contractor-auth':{}})
  assert.equal((await route.POST({json:async()=>({table:'profiles',operation:'update'})})).status,400)
})
function portalDB() {
  const calls=[]
  const db={from(table){
    const query={
      select(){return query},eq(k,v){calls.push([table,k,v]);return query},
      single:async()=>({data:{id:'member',company_id:'company'}}),
      limit(){return query},range(){return query},order(){return query},
      then(resolve){resolve({data:[],error:null})},
    };return query
  }}
  return {db,calls}
}
test('portal invoice reads force the signed member and company despite a forged filter',async()=>{
  const {db,calls}=portalDB()
  const route=load('src/app/api/contractor-invoices/route.ts',{'next/server':next,'@supabase/supabase-js':{},'@/lib/admin-context':{},'@/lib/contractor-auth':{readSessionFromCookie:async()=>({contractorId:'member',email:'member@example.com'}),getSupabaseAdmin:()=>db}})
  const response=await route.POST({json:async()=>({portal:true,table:'contractor_invoices',operation:'select',filters:[{op:'eq',column:'team_member_id',value:'someone-else'}]})})
  assert.equal(response.status,200)
  assert.ok(calls.some(c=>c[0]==='contractor_invoices'&&c[1]==='team_member_id'&&c[2]==='member'))
  assert.ok(calls.some(c=>c[0]==='contractor_invoices'&&c[1]==='company_id'&&c[2]==='company'))
})
test('portal users cannot approve or mark their own invoices paid',async()=>{
  const {db}=portalDB()
  const route=load('src/app/api/contractor-invoices/route.ts',{'next/server':next,'@supabase/supabase-js':{},'@/lib/admin-context':{},'@/lib/contractor-auth':{readSessionFromCookie:async()=>({contractorId:'member',email:'member@example.com'}),getSupabaseAdmin:()=>db}})
  const response=await route.POST({json:async()=>({portal:true,table:'contractor_invoices',operation:'update',values:{status:'paid'},filters:[{op:'eq',column:'id',value:'11111111-1111-4111-8111-111111111111'}]})})
  assert.equal(response.status,403)
})
test('cron rejects an absent secret, including a forged Bearer undefined value',async()=>{
  const old=process.env.CRON_SECRET;delete process.env.CRON_SECRET
  try {
    const route=load('src/app/api/cron/invoice-followups/route.ts',{'next/server':next,'@/lib/contractor-auth':{},'@/lib/invoice-obligations':{},'@/lib/payables':payables,'@/lib/email':{}})
    assert.equal((await route.GET({headers:new Headers({authorization:'Bearer undefined'})})).status,401)
  } finally {if(old!==undefined)process.env.CRON_SECRET=old}
})
test('parallel reminder runners can only claim each monthly reminder once',async()=>{
  const old=process.env.CRON_SECRET;process.env.CRON_SECRET='test-secret'
  let state='pending',sent=0
  const row={id:'obligation',name:'Alex',email:'alex@example.com',period_start:'2026-10-01',period_end:'2026-10-31',required:true,received:false,overdue:true}
  const db={from(table){let patch,claimed=false;const q={select(){return q},gte(){return q},eq(k,v){if(k==='reminder_state'&&v==='pending')claimed=true;return q},update(p){patch=p;return q},async maybeSingle(){if(state!=='pending')return {data:null};state=patch.reminder_state;return {data:{id:row.id}}},then(resolve){if(patch){state=patch.reminder_state;resolve({error:null})}else resolve({data:table==='commercial_access'?[{company_id:'company'}]:[{closing_month:'2026-09-01'}],error:null})}};return q}}
  const route=load('src/app/api/cron/invoice-followups/route.ts',{'next/server':next,'@/lib/contractor-auth':{getSupabaseAdmin:()=>db},'@/lib/invoice-obligations':{invoiceObligations:async(db,company,month)=>{assert.ok(month>='2026-10-01');return [{...row,reminder_state:state}]}},'@/lib/payables':payables,'@/lib/email':{sendMissingInvoiceReminder:async()=>{sent++;return {success:true,id:'email'}}}})
  try {
    const request={headers:new Headers({authorization:'Bearer test-secret'})}
    const results=await Promise.all([route.GET(request),route.GET(request)])
    assert.ok(results.every(r=>r.status===200));assert.equal(sent,1);assert.equal(state,'sent')
    await route.GET(request);assert.equal(sent,1)
  } finally {if(old===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=old}
})
test('real payables screen keeps old approved/scheduled invoices visible and exposes the actor history',async()=>{
  const React=require('react'),{create,act}=require('react-test-renderer')
  const today=payables.localToday(),month=today.slice(0,7),previous=payables.previousBillingMonth(today)
  const base={team_member_id:'shannon',total_amount:1000,payment_terms:'NET30',submitted_at:'2026-09-22T20:00:47Z',contractor_invoice_lines:[],period_start:previous.start,period_end:previous.end,due_date:previous.end}
  const rows=[{...base,id:'old-approved',invoice_number:'OLD-APPROVED',status:'approved'},{...base,id:'old-scheduled',invoice_number:'OLD-SCHEDULED',status:'scheduled'},{...base,id:'paid',invoice_number:'PAID-CURRENT',status:'paid',period_start:`${month}-01`,period_end:today}]
  const fixture={team_members:[{id:'shannon',name:'Shannon Rybecky',email:'shannon@example.test'}],clients:[],projects:[],contractor_expenses:[],contractor_invoice_status_events:[{id:'history',invoice_id:'old-approved',from_status:'pending',to_status:'approved',changed_at:'2026-11-03T15:00:00Z',actor_label:'kathia@manocg.com'}]}
  const db={auth:{getSession:async()=>({data:{session:{access_token:'test'}}})},from(table){const q={then(resolve){resolve({data:fixture[table]||[],error:null})}};for(const k of ['select','order','eq','range'])q[k]=()=>q;return q}}
  const oldFetch=global.fetch
  global.fetch=async(url)=>({ok:true,json:async()=>url==='/api/contractor-invoices'?{data:rows}:url.startsWith('/api/invoice-followups')?{rows:[]}:{reports:[]}})
  const invoiceClient=load('src/lib/invoice-client.ts')
  const component=load('src/app/contractor-management/page.tsx',{'@supabase/supabase-js':{createClient:()=>db},'@/lib/invoice-client':invoiceClient,'@/lib/payables':payables,'@/components/InvoiceFollowups':load('src/components/InvoiceFollowups.tsx',{'@/lib/payables':payables}),'@/components/workspace/PageHeader':load('src/components/workspace/PageHeader.tsx'),'./OnboardingReview':{default:()=>null}}).default
  let renderer
  try {
    await act(async()=>{renderer=create(React.createElement(component));await new Promise(resolve=>setImmediate(resolve))})
    const text=()=>JSON.stringify(renderer.toJSON())
    assert.match(text(),/OLD-APPROVED/);assert.match(text(),/OLD-SCHEDULED/);assert.doesNotMatch(text(),/PAID-CURRENT/)
    assert.ok(renderer.root.findAll(n=>typeof n.props.title==='string'&&n.props.title.includes('kathia@manocg.com')).length)
    await act(async()=>renderer.root.findByProps({'aria-label':'View status history for OLD-APPROVED'}).props.onClick())
    assert.match(text(),/Status history · Puerto Rico time/)
    if(process.env.PAYABLES_PREVIEW_PATH){
      const dom=require('react-dom/server')
      const element=n=>typeof n==='string'?n:n===null?null:Array.isArray(n)?n.map(element):React.createElement(n.type,Object.fromEntries(Object.entries(n.props||{}).filter(([k,v])=>typeof v!=='function')), ...(n.children||[]).map(element))
      const css=fs.readdirSync(path.join(__dirname,'../.next/static/css')).filter(n=>n.endsWith('.css')).map(n=>fs.readFileSync(path.join(__dirname,'../.next/static/css',n),'utf8')).join('\n')
      fs.writeFileSync(process.env.PAYABLES_PREVIEW_PATH,`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body class="v-app" style="background:#f4f6f8;padding:28px"><main class="workspace-page" style="max-width:1200px;min-width:0;width:100%;margin:auto">${dom.renderToStaticMarkup(element(renderer.toJSON()))}</main></body></html>`)
    }
    await act(async()=>renderer.root.findAllByType('button').find(n=>n.children.includes('Overdue')).props.onClick())
    assert.match(text(),/OLD-APPROVED/);assert.match(text(),/OLD-SCHEDULED/)
    await act(async()=>renderer.root.findAllByType('button').find(n=>n.children.includes('Invoice history')).props.onClick())
    assert.match(text(),/PAID-CURRENT/);assert.doesNotMatch(text(),/OLD-SCHEDULED/)
  }finally{if(renderer)await act(async()=>renderer.unmount());global.fetch=oldFetch}
})


test('pre-October missing invoices are excluded without reading or writing the database',async()=>{
  const {invoiceObligations}=load('src/lib/invoice-obligations.ts',{'./payables':payables})
  const db={from(){throw new Error('Historical billing periods must not access the database')}}
  for(const month of ['2026-01-01','2026-03-01','2026-09-01']) assert.deepEqual(await invoiceObligations(db,'company',month),[])
})
test('October invoices due October 31 remain eligible for follow-up',async()=>{
  const {invoiceObligations}=load('src/lib/invoice-obligations.ts',{'./payables':payables})
  const tables=[]
  const db={from(table){tables.push(table);const q={then(resolve){resolve({data:[],error:null})}};for(const method of ['select','eq','gte','lte'])q[method]=()=>q;return q}}
  assert.deepEqual(await invoiceObligations(db,'company','2026-10-01'),[])
  assert.ok(tables.includes('team_members'));assert.ok(tables.includes('contractor_invoices'));assert.ok(tables.includes('contractor_invoice_obligations'))
})
