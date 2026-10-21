const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}) { const m={exports:{}},filename=path.join(__dirname,'..',file); const source=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText; vm.runInThisContext(`(function(require,module,exports){${source}\n})`,{filename})(n=>Object.hasOwn(mocks,n)?mocks[n]:require(n),m,m.exports); return m.exports; }
const report=load('src/lib/resource-report.ts'),budget=load('src/lib/resource-report-budget.ts',{'./resource-report':report}),program=load('src/lib/resource-report-program.ts',{'./resource-report':report,'./resource-report-budget':budget});
const projects=[{id:'a',name:'Site A',clientId:'c',client:'Client'},{id:'b',name:'Site B',clientId:'c',client:'Client'},{id:'z',name:'Outside',clientId:'other',client:'Other'}];
const entries=[{resourceId:'ana',projectId:'a',date:'2026-10-01',hours:20,rate:100,billable:true},{resourceId:'ana',projectId:'a',date:'2026-10-12',hours:100,rate:100,billable:true},{resourceId:'bea',projectId:'b',date:'2026-10-13',hours:60,rate:150,billable:true},{resourceId:'bea',projectId:'b',date:'2026-10-13',hours:999,rate:150,billable:false},{resourceId:'ana',projectId:'z',date:'2026-10-12',hours:100,rate:100,billable:true},{resourceId:'ana',projectId:'a',date:'2026-10-20',hours:10,rate:100,billable:true}];
const projections=[{client_id:'c',month:'2026-10-01',amount:60000,enabled:true}];
const roles=[{client_id:'c',team_member_id:'ana',role:'Scheduler'},{client_id:'c',team_member_id:'bea',role:'Scheduler'},{client_id:'other',team_member_id:'ana',role:'Manager'}];
const resources=[{id:'ana',label:'Ana'},{id:'bea',label:'Bea'}];
const calc=(breakdown='project',usage=entries,allocation=projections)=>program.programUtilization(usage,projects,allocation,['a'],'2026-10-12','2026-10-18','2026-10-18',breakdown,roles,resources);
test('all program sites share one denominator, including sites outside selected work details',()=>{
 const rows=calc(),a=rows.find(r=>r.name==='Site A'),b=rows.find(r=>r.name==='Site B'),total=rows.find(r=>r.level==='client');
 assert.equal(a.mtdPercent,20);assert.equal(b.mtdPercent,15);assert.equal(total.mtdPercent,35);assert.equal(total.weekHours,160);assert.equal(total.mtdHours,180);assert.equal(total.projectCount,2);
 assert.equal(total.weekPercent,a.weekPercent+b.weekPercent);assert.equal(total.mtdPercent,a.mtdPercent+b.mtdPercent);
 assert.ok(!rows.some(r=>r.client==='Other'));
 for(const row of rows)for(const name of ['amount','rate','denominator','weekValue','mtdValue','resourceId']) assert.ok(!(name in row));
});
test('role and named-resource burn preserve program totals and isolate roles by client',()=>{
 const role=calc('role');assert.equal(role.filter(r=>r.level==='role').length,1);assert.equal(role[0].name,'Scheduler');assert.equal(role[0].mtdPercent,35);
 const named=calc('resource');assert.equal(named.find(r=>r.name==='Ana').mtdPercent,20);assert.equal(named.find(r=>r.name==='Bea').mtdPercent,15);
 assert.equal(program.roleFor(roles,'other','ana'),'Manager');assert.equal(program.roleFor(roles,'c','missing'),'Unassigned role');
});
test('program months stay independent, missing rates remain unavailable, and overrun is uncapped',()=>{
 const rows=program.programUtilization(entries,projects,[...projections,{client_id:'c',month:'2026-11-01',amount:1000,enabled:true}],['a'],'2026-10-12','2026-11-08','2026-11-08');
 assert.equal(rows.find(r=>r.level==='client'&&r.month==='2026-11-01').mtdPercent,0);
 assert.equal(calc('project',entries.map((e,i)=>i===0?{...e,rate:0}:e)).find(r=>r.level==='client').mtdPercent,null);
 assert.equal(calc('project',entries,[{...projections[0],amount:1000}]).find(r=>r.level==='client').mtdPercent,2100);
 assert.deepEqual(calc('project',entries,[{...projections[0],enabled:false}]),[]);
 const capped=program.programUtilization(entries,projects,projections,['a'],'2026-10-12','2026-10-31','2026-10-14');assert.equal(capped.find(r=>r.level==='client').mtdHours,180);
});
test('role work summaries merge people within each site and never expose their names in report identities',()=>{
 const submissions=entries.filter(e=>e.billable&&e.projectId!=='z').map(e=>({date:e.date,hours:e.hours,team_member_id:e.resourceId,team_member_name:resources.find(r=>r.id===e.resourceId).label,project_id:e.projectId,project_name:e.projectId==='a'?'Site A':'Site B',client_name:'Client',notes:'Updated schedule.'}));
 submissions.push({...submissions[1],team_member_id:'bea',team_member_name:'Bea',hours:2});
 const converted=program.submissionsByRole(submissions,projects,roles),ids=[...new Set(converted.map(e=>e.team_member_id))];
 const rows=report.reportRows(converted,'2026-10-12','2026-10-18',['a','b'],ids);
 assert.equal(rows.length,2);assert.equal(rows[0].hours,102);assert.equal(rows[0].resource,'Scheduler');assert.equal(rows[0].notes.length,1);
 assert.ok(!JSON.stringify(rows).includes('Ana'));assert.ok(!JSON.stringify(rows).includes('Bea'));
 assert.equal(report.reportMonthTotals(converted,'2026-10-12','2026-10-18',['a','b'],ids)[0].hours,182);
 assert.notEqual(program.roleRowRevision(rows[0]),program.roleRowRevision({...rows[0],hours:103}));
});
const cid='11111111-1111-4111-8111-111111111111',rid='22222222-2222-4222-8222-222222222222';
function api({admin=true,clients=[cid],members=[rid],failWrite=false}={}) {
 const writes=[],filters=[];
 const db={auth:{getUser:async()=>({data:{user:{id:'user',email:'admin@example.com'}}})},from(table){let records;const b={select(){return b},eq(k,v){filters.push([table,k,v]);return b},in(){return b},gte(){return b},lte(){return b},single:async()=>({data:{company_id:'company'}}),upsert(r){records=r;writes.push([table,r]);return b},then(resolve){return Promise.resolve(table==='clients'?{data:clients.map(id=>({id}))}:table==='team_members'?{data:members.map(id=>({id}))}:failWrite&&records?{error:{message:'failed'}}:{data:records||[]}).then(resolve)}};return b}};
 return {writes,filters,...load('src/app/api/resource-report-program/route.ts',{'next/server':{NextResponse:{json:(body,opts)=>({body,...opts})}},'@/lib/contractor-auth':{getSupabaseAdmin:()=>db},'@/lib/admin-allowlist':{isAdminEmail:()=>admin},'@/lib/timesheet-daily':load('src/lib/timesheet-daily.ts')})};
}
const req=(body,token=true)=>({headers:new Headers(token?{authorization:'Bearer token'}:{}),text:async()=>JSON.stringify(body),nextUrl:new URL('https://example.com/api?start=2026-10-01&end=2026-10-01')});
const projectionBody={kind:'projections',rows:[{client_id:cid,month:'2026-10-01',amount:60000,enabled:true}]};
const roleBody={kind:'roles',rows:[{client_id:cid,team_member_id:rid,role:' Scheduler '}]};
test('program API enforces admin identity, company membership and strict input validation',async()=>{
 const h=api();assert.equal((await h.GET(req({},false))).status,401);assert.equal((await api({admin:false}).POST(req(roleBody))).status,403);
 assert.equal((await api({clients:[]}).POST(req(projectionBody))).status,403);assert.equal((await api({members:[]}).POST(req(roleBody))).status,403);
 for(const body of [null,{...projectionBody,rows:[{...projectionBody.rows[0],amount:0}]},{...projectionBody,rows:[{...projectionBody.rows[0],month:'2026-02-30'}]},{...roleBody,rows:[{...roleBody.rows[0],role:'x'.repeat(81)}]},{...roleBody,rows:[roleBody.rows[0],roleBody.rows[0]]}]) assert.equal((await h.POST(req(body))).status,400);
 assert.equal(h.writes.length,0);
});
test('program API saves company-scoped records, roles without month, and returns recoverable failures',async()=>{
 const h=api();assert.equal((await h.POST(req({...projectionBody,company_id:'forged'}))).status,200);assert.equal(h.writes[0][1][0].company_id,'company');
 const role=await h.POST(req(roleBody));assert.equal(role.status,200);assert.equal(h.writes[1][1][0].role,'Scheduler');assert.ok(!('month' in h.writes[1][1][0]));assert.equal(role.headers['Cache-Control'],'no-store');
 assert.equal((await api({failWrite:true}).POST(req(projectionBody))).status,500);
 const get=await h.GET(req({}));assert.equal(get.status,200);for(const table of ['report_program_projections','report_resource_roles'])assert.ok(h.filters.some(f=>f[0]===table&&f[1]==='company_id'&&f[2]==='company'));
});
const React=require('react'),{create,act}=require('react-test-renderer');
const authMock={supabase:{auth:{getSession:async()=>({data:{session:{access_token:'token'}}})}}};
test('private controls save projections and permanent roles, reload them, and preserve drafts when changing months',async()=>{
 const original=global.fetch,states=[],writes=[];let savedProjections=[...projections],savedRoles=[];
 global.fetch=async(url,opts)=>{if(opts.method==='POST'){const b=JSON.parse(opts.body);writes.push(b);if(b.kind==='roles')savedRoles=b.rows;else savedProjections=b.rows;return{ok:true,json:async()=>({[b.kind]:b.rows})}}return{ok:true,json:async()=>({projections:savedProjections,roles:savedRoles})}};
 const Control=load('src/components/time-tracking/ProgramReportControls.tsx',{'@/lib/supabase':authMock,'@/lib/resource-report-budget':budget,'@/lib/resource-report-program':program}).default;
 const props={enabled:true,onToggle:()=>{},showProjection:true,start:'2026-10-12',end:'2026-11-08',projects,resources:resources.map(r=>({...r,clientIds:['c']})),onState:s=>states.push(s)};
 let tree;
 try {
  await act(async()=>{tree=create(React.createElement(Control,props))});
  const find=label=>tree.root.findByProps({'aria-label':label}),button=label=>tree.root.findAllByType('button').find(b=>b.children.includes(label));
  await act(async()=>find('Projection month').props.onChange({target:{value:'2026-10-01'}}));assert.equal(find('Monthly program projection').props.value,'60000');
  await act(async()=>find('Monthly program projection').props.onChange({target:{value:'70000'}}));
  await act(async()=>find('Projection month').props.onChange({target:{value:'2026-11-01'}}));await act(async()=>find('Projection month').props.onChange({target:{value:'2026-10-01'}}));assert.equal(find('Monthly program projection').props.value,'70000');assert.equal(states.at(-1).projectionDirty,true);
  await act(async()=>button('Save program projections').props.onClick());assert.equal(states.at(-1).projectionDirty,false);
  await act(async()=>find('Reporting role for Ana').props.onChange({target:{value:'Scheduler'}}));assert.equal(states.at(-1).rolesDirty,true);
  await act(async()=>button('Save reporting roles').props.onClick());assert.equal(states.at(-1).rolesDirty,false);assert.equal(writes.at(-1).kind,'roles');assert.ok(!('month' in writes.at(-1).rows[0]));
  await act(async()=>tree.unmount());await act(async()=>{tree=create(React.createElement(Control,{...props,start:'2026-12-01',end:'2026-12-31'}))});assert.equal(find('Reporting role for Ana').props.value,'Scheduler');await act(async()=>tree.unmount());
 }finally {global.fetch=original}
});
test('builder switches to role-only work detail and blocks export when program setup or roles are unsaved',async()=>{
 const preview=load('src/components/time-tracking/BudgetUtilizationPreview.tsx',{'@/lib/resource-report-budget':budget,'@/lib/resource-report':report}).default;
 let controlProps;
 const Control=props=>{controlProps=props;React.useEffect(()=>props.onState({projections,roles,ready:true,projectionDirty:false,rolesDirty:false,error:false}),[props.onState]);return null};
 const Builder=load('src/components/time-tracking/ResourceReportBuilder.tsx',{'@/lib/resource-report':report,'@/lib/resource-report-budget':budget,'@/lib/resource-report-program':program,'./ReportBudgetControls':{__esModule:true,default:()=>null},'./ProgramReportControls':{__esModule:true,default:Control},'./BudgetUtilizationPreview':{__esModule:true,default:preview},'@/lib/supabase':authMock,'lucide-react':{Download:()=>null,RefreshCw:()=>null,X:()=>null}}).default;
 const submissions=[{date:'2026-10-12',hours:1,team_member_id:'ana',team_member_name:'Ana',project_id:'a',project_name:'Site A',client_name:'Client',notes:null},{date:'2026-10-12',hours:2,team_member_id:'bea',team_member_name:'Bea',project_id:'a',project_name:'Site A',client_name:'Client',notes:null}];
 let tree;await act(async()=>{tree=create(React.createElement(Builder,{entries:submissions,projects:projects.map(p=>({id:p.id,label:p.name})),resources,initialProjects:['a'],initialResources:['ana','bea'],logo:'<svg></svg>',onClose:()=>{},budgetEntries:entries,budgetProjects:projects}),{createNodeMock:()=>({showModal(){}})})});
 const find=label=>tree.root.findByProps({'aria-label':label}),button=label=>tree.root.findAllByType('button').find(b=>b.children.includes(label));
 await act(async()=>button('Full month').props.onClick());await act(async()=>find('Report month').props.onChange({target:{value:'2026-10'}}));
 await act(async()=>find('Work detail grouping').props.onChange({target:{value:'role'}}));assert.equal(tree.root.findAllByType('textarea').length,1);assert.match(tree.root.findByType('textarea').props['aria-label'],/Scheduler/);assert.equal(button('Download PDF').props.disabled,false);
 await act(async()=>find('Budget reference').props.onChange({target:{value:'program'}}));await act(async()=>controlProps.onToggle(true));assert.equal(tree.root.findAllByProps({'aria-label':'Budget utilization'}).length,1);
 await act(async()=>controlProps.onState({projections,roles,ready:true,projectionDirty:true,rolesDirty:false,error:false}));assert.equal(button('Download PDF').props.disabled,true);
 await act(async()=>controlProps.onState({projections,roles,ready:true,projectionDirty:false,rolesDirty:true,error:false}));assert.equal(button('Download PDF').props.disabled,true);
 await act(async()=>controlProps.onToggle(false));assert.equal(button('Download PDF').props.disabled,true,'unsaved role reports remain blocked even with utilization hidden');
 await act(async()=>find('Work detail grouping').props.onChange({target:{value:'resource'}}));assert.equal(button('Download PDF').props.disabled,false);assert.equal(tree.root.findAllByType('textarea').length,2);
 await act(async()=>tree.unmount());
});
