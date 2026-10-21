const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const m={exports:{}},filename=path.join(__dirname,'..',file);const source=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;vm.runInThisContext(`(function(require,module,exports){${source}\n})`,{filename})(n=>Object.hasOwn(mocks,n)?mocks[n]:require(n),m,m.exports);return m.exports}
const report=load('src/lib/resource-report.ts'),budget=load('src/lib/resource-report-budget.ts',{'./resource-report':report});
const projects=[{id:'p',name:'One',clientId:'c',client:'Client'},{id:'q',name:'Two',clientId:'c',client:'Client'}];
const budgets=[{project_id:'p',month:'2026-10-01',amount:1000},{project_id:'q',month:'2026-10-01',amount:3000}];
const entries=[{projectId:'p',date:'2026-10-01',hours:2,rate:100,billable:true},{projectId:'p',date:'2026-10-12',hours:3,rate:100,billable:true},{projectId:'q',date:'2026-10-13',hours:2,rate:150,billable:true},{projectId:'p',date:'2026-10-13',hours:99,rate:100,billable:false},{projectId:'p',date:'2026-10-19',hours:4,rate:100,billable:true}];
test('project and client burn use value-weighted monthly denominators, actual billable hours, and a percentage-only output',()=>{
 const rows=budget.budgetUtilization(entries,projects,budgets,['p','q'],'2026-10-12','2026-10-18');
 const p=rows.find(r=>r.level==='project'&&r.name==='One'),c=rows.find(r=>r.level==='client');
 assert.equal(p.weekHours,3);assert.equal(p.mtdHours,5);assert.equal(p.weekPercent,30);assert.equal(p.mtdPercent,50);
 assert.equal(c.weekPercent,15);assert.equal(c.mtdPercent,20);assert.equal(c.projectCount,2);assert.equal(c.weekHours,5);
 for(const row of rows)for(const name of ['amount','rate','denominator','weekValue','mtdValue'])assert.ok(!(name in row));
 assert.equal(budget.budgetUtilization(entries,projects,budgets,['p'],'2026-10-12','2026-10-18').find(r=>r.level==='client').mtdPercent,50);
});
test('MTD percentages are cumulative per week, split at month boundaries, capped at today, and can exceed 100%',()=>{
 const rows=budget.budgetUtilization(entries,projects,[{...budgets[0],amount:100}],['p'],'2026-10-01','2026-10-31','2026-10-14').filter(r=>r.level==='project');
 assert.equal(rows.length,3);assert.equal(rows.at(-1).mtdPercent,500);assert.equal(rows.at(-1).weekEnd,'2026-10-14');
 const cross=budget.budgetUtilization([{...entries[0],date:'2026-09-30'}],projects,[{project_id:'p',month:'2026-09-01',amount:1000},budgets[0]],['p'],'2026-09-28','2026-10-04').filter(r=>r.level==='project');
 assert.equal(cross[0].weekEnd,'2026-09-30');assert.equal(cross[1].weekStart,'2026-10-01');assert.equal(cross[1].mtdPercent,0);
});
test('missing rates do not understate utilization, disabled projects are omitted, and zero budgets are not divided',()=>{
 const unpriced=[...entries,{...entries[0],date:'2026-10-10',rate:0}];
 const p=budget.budgetUtilization(unpriced,projects,budgets,['p'],'2026-10-12','2026-10-18').find(r=>r.level==='project');
 assert.equal(p.weekPercent,30);assert.equal(p.mtdPercent,null);
 assert.deepEqual(budget.budgetUtilization(entries,projects,[{...budgets[0],enabled:false}],['p'],'2026-10-12','2026-10-18'),[]);
 assert.deepEqual(budget.budgetUtilization(entries,projects,[{...budgets[0],amount:0}],['p'],'2026-10-12','2026-10-18'),[]);
});
function api({admin=true,projectIds=['11111111-1111-4111-8111-111111111111'],failWrite=false}={}){
 const writes=[],company='company';
 const db={auth:{getUser:async()=>({data:{user:{id:'user',email:'admin@example.com'}}})},from(table){let records;const b={select(){return b},eq(){return b},in(){return b},gte(){return b},lte(){return b},single:async()=>({data:{company_id:company}}),upsert(r){records=r;writes.push(r);return b},then(resolve){return Promise.resolve(table==='projects'?{data:projectIds.map(id=>({id}))}:failWrite?{error:{message:'failed'}}:{data:records||[]}).then(resolve)}};return b}};
 return {writes,...load('src/app/api/resource-report-budgets/route.ts',{'next/server':{NextResponse:{json:(body,opts)=>({body,...opts})}},'@/lib/contractor-auth':{getSupabaseAdmin:()=>db},'@/lib/admin-allowlist':{isAdminEmail:()=>admin},'@/lib/timesheet-daily':load('src/lib/timesheet-daily.ts')})}
}
const id='11111111-1111-4111-8111-111111111111';
const req=(body,token=true)=>({headers:new Headers(token?{authorization:'Bearer token'}:{}),text:async()=>JSON.stringify(body),nextUrl:new URL('https://example.com/api?start=2026-10-01&end=2026-10-01')});
test('budget APIs reject unauthenticated, non-admin, malformed and cross-company writes',async()=>{
 const handler=api();assert.equal((await handler.GET(req({},false))).status,401);assert.equal((await api({admin:false}).POST(req({}))).status,403);
 assert.equal((await handler.POST(req({month:'2026-10-01',budgets:[{project_id:id,amount:0,enabled:true}]}))).status,400);
 assert.equal((await api({projectIds:[]}).POST(req({month:'2026-10-01',budgets:[{project_id:id,amount:1000,enabled:true}]}))).status,403);assert.equal(handler.writes.length,0);
});
test('budget API saves only validated company/project/month records and reports failed writes',async()=>{
 const handler=api(),body={month:'2026-10-01',company_id:'forged',budgets:[{project_id:id,amount:1000.25,enabled:true}]};
 const result=await handler.POST(req(body));assert.equal(result.status,200);assert.equal(handler.writes[0][0].company_id,'company');assert.equal(handler.writes[0][0].month,'2026-10-01');assert.equal(result.headers['Cache-Control'],'no-store');
 assert.equal((await api({failWrite:true}).POST(req(body))).status,500);
});
test('private budget controls load, edit, save and restore the saved month allocation',async()=>{
 const React=require('react'),{create,act}=require('react-test-renderer'),original=global.fetch,states=[],calls=[];
 let stored=[{project_id:'p',month:'2026-10-01',amount:1000,enabled:true}];
 global.fetch=async(url,opts)=>{calls.push({url,opts});if(opts.method==='POST'){const b=JSON.parse(opts.body);stored=b.budgets.map(r=>({...r,month:b.month}))}return{ok:true,json:async()=>({budgets:stored})}};
 try{
  const Component=load('src/components/time-tracking/ReportBudgetControls.tsx',{'@/lib/supabase':{supabase:{auth:{getSession:async()=>({data:{session:{access_token:'token'}}})}}},'@/lib/resource-report-budget':budget}).default;
  let tree;await act(async()=>{tree=create(React.createElement(Component,{enabled:true,onToggle:()=>{},start:'2026-10-12',end:'2026-10-18',projects:[projects[0]],onState:s=>states.push(s)}))});
  const amount=()=>tree.root.findByProps({'aria-label':'Monthly budget for One'});
  assert.equal(amount().props.value,'1000');await act(async()=>amount().props.onChange({target:{value:'2500'}}));assert.equal(states.at(-1).dirty,true);
  const save=()=>tree.root.findAllByType('button').find(b=>b.children.includes('Save monthly budgets'));
  await act(async()=>save().props.onClick());assert.equal(states.at(-1).dirty,false);assert.equal(states.at(-1).budgets[0].amount,2500);assert.equal(calls.at(-1).opts.method,'POST');
  await act(async()=>tree.unmount());
 }finally{global.fetch=original}
});
test('a resource-only report can hide full-project budget percentages without hiding hours',async()=>{
 const React=require('react'),{create,act}=require('react-test-renderer');
 const preview=load('src/components/time-tracking/BudgetUtilizationPreview.tsx',{'@/lib/resource-report-budget':budget,'@/lib/resource-report':report}).default;
 const controls={__esModule:true,default:props=>React.createElement('button',{onClick:()=>{props.onToggle(!props.enabled);props.onState({budgets:[budgets[0]],ready:true,dirty:false,error:false})}},'Toggle fixture budget')};
 const Builder=load('src/components/time-tracking/ResourceReportBuilder.tsx',{'@/lib/resource-report':report,'@/lib/resource-report-budget':budget,'./ReportBudgetControls':controls,'./ProgramReportControls':{__esModule:true,default:()=>null},'@/lib/resource-report-program':load('src/lib/resource-report-program.ts',{'./resource-report':report,'./resource-report-budget':budget}),'./BudgetUtilizationPreview':{__esModule:true,default:preview},'@/lib/supabase':{supabase:{}},'lucide-react':{Download:()=>null,RefreshCw:()=>null,X:()=>null}}).default;
 const submissions=[{date:'2026-10-12',hours:1,team_member_id:'a',team_member_name:'Ana',project_id:'p',project_name:'One',client_name:'Client',notes:null}];
 let tree;await act(async()=>{tree=create(React.createElement(Builder,{entries:submissions,projects:[{id:'p',label:'One'}],resources:[{id:'a',label:'Ana'}],initialProjects:['p'],initialResources:['a'],logo:'<svg></svg>',onClose:()=>{},budgetProjects:projects,budgetEntries:entries}),{createNodeMock:()=>({showModal(){}})})});
 const button=label=>tree.root.findAllByType('button').find(b=>b.children.includes(label));
 await act(async()=>button('Full month').props.onClick());await act(async()=>tree.root.findByProps({'aria-label':'Report month'}).props.onChange({target:{value:'2026-10'}}));
 await act(async()=>button('Toggle fixture budget').props.onClick());assert.equal(tree.root.findAllByProps({'aria-label':'Budget utilization'}).length,1);
 const rows=tree.root.findByProps({'aria-label':'Budget utilization'}).findAllByType('td');assert.ok(rows.some(td=>td.children.includes('5')),'Full-project MTD must include resources beyond the selected person');
 await act(async()=>button('Toggle fixture budget').props.onClick());assert.equal(tree.root.findAllByProps({'aria-label':'Budget utilization'}).length,0);assert.equal(tree.root.findAllByType('textarea').length,1);assert.equal(button('Download PDF').props.disabled,false);
 await act(async()=>tree.unmount());
});

test('budget month coverage includes both boundary months of a 366-day report',()=>{ const months=budget.budgetMonths('2026-01-31','2027-02-01'); assert.equal(months.length,14); assert.equal(months.at(-1),'2027-02-01'); });
