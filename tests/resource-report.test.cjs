const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
function load(file, mocks = {}) {
  const module = { exports: {} }, filename = path.join(__dirname, '..', file);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`, { filename })((name) => Object.hasOwn(mocks, name) ? mocks[name] : name === './resource-report-budget' || name === '@/lib/resource-report-budget' ? load('src/lib/resource-report-budget.ts', {'./resource-report':load('src/lib/resource-report.ts')}) : name === './ReportBudgetControls' || name === './BudgetUtilizationPreview' ? {__esModule:true, default:()=>null} : require(name), module, module.exports);
  return module.exports;
}
const lib = load('src/lib/resource-report.ts');
const fixture = [
  { date: '2026-09-30', hours: 7, team_member_id: 'a', team_member_name: 'Ana', project_id: 'p', project_name: 'Scheduling', client_name: 'Client', notes: 'Updated project schedule.', bill_rate: 999, cost_rate: 888, billable_hours: 100 },
  { date: '2026-10-01', hours: 8, team_member_id: 'a', team_member_name: 'Ana', project_id: 'p', project_name: 'Scheduling', client_name: 'Client', notes: 'Updated project schedule.' },
  { date: '2026-10-02', hours: 4.5, team_member_id: 'a', team_member_name: 'Ana', project_id: 'p', project_name: 'Scheduling', client_name: 'Client', notes: ' updated  PROJECT schedule. ' },
  { date: '2026-10-04', hours: 2, team_member_id: 'b', team_member_name: 'Bea', project_id: 'p', project_name: 'Scheduling', client_name: 'Client', notes: null },
  { date: '2026-10-05', hours: 3, team_member_id: 'a', team_member_name: 'Ana', project_id: 'q', project_name: 'Controls', client_name: 'Client', notes: 'Reviewed controls.' },
];
test('project includes all resources, uses actual hours, deduplicates notes, and omits financial fields', () => {
  const rows = lib.reportRows(fixture, '2026-09-01', '2026-10-31', ['p'], ['a','b']);
  assert.equal(rows.length, 2); assert.equal(rows[0].hours, 19.5); assert.equal(rows[0].notes.length, 1); assert.equal(rows[1].missingDescriptions, 1);
  for (const row of rows) assert.deepEqual(Object.keys(row).sort(), ['key','week','resource','project','client','hours','notes','missingDescriptions'].sort());
  assert.equal(rows[0].week, '2026-09-28');
});
test('resource selection spans projects, combines intersecting filters and preserves weekly/month boundaries', () => {
  const rows = lib.reportRows(fixture, '2026-10-01', '2026-10-31', ['p','q'], ['a']);
  assert.deepEqual(rows.map(r => [r.week, r.project, r.hours]), [['2026-09-28','Scheduling',12.5], ['2026-10-05','Controls',3]]);
  assert.equal(lib.reportRows(fixture,'2026-10-01','2026-10-31',[],['a']).length,0);
  assert.equal(lib.reportRows(fixture,'2026-10-01','2026-10-31',['p'],[]).length,0);
  assert.equal(lib.mondayOf('2026-10-04'), '2026-09-28');
});
test('PDF paginates long summaries and contains only explicit report metadata', async () => {
  const { createResourceReportPDF } = load('src/lib/resource-report-pdf.ts', {'./resource-report':lib});
  const { PDFDocument } = require('pdf-lib');
  const rows = Array.from({length: 45}, (_,i) => ({ ...lib.reportRows(fixture,'2026-10-01','2026-10-31',['p'],['a'])[0], key:`r${i}`, resource:`Resource ${i + 1}`, project: i < 20 ? 'Scheduling' : 'Project controls' }));
  const summaries = Object.fromEntries(rows.map(row => [row.key, 'Reviewed project schedule updates and coordinated outstanding deliverables. Documented progress and unresolved dependencies for the project team.']));
  const bytes = await createResourceReportPDF(rows, summaries,'2026-10-01','2026-10-31','Weekly Resource Report');
  const doc = await PDFDocument.load(bytes); assert.ok(doc.getPageCount() >= 3); assert.equal(doc.getCreator(),'VantageFP'); assert.equal(doc.getAuthor(),'Mano CG LLC');
});
test('summary API rejects unauthenticated and non-admin requests before invoking AI', async () => {
  let calls = 0;
  const handler = load('src/app/api/resource-report-summaries/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, ...options }) } },
    '@/lib/ai-router': { aiStructured: async () => { calls++; return { data: { summaries: {} } } } },
    '@/lib/contractor-auth': { getSupabaseAdmin: () => ({ auth: { getUser: async () => ({ data: { user: { email: 'other@example.com' } } }) } }) },
    '@/lib/admin-allowlist': { isAdminEmail: () => false },
  });
  assert.equal((await handler.POST({ headers: new Headers() })).status,401);
  assert.equal((await handler.POST({ headers: new Headers({authorization:'Bearer token'}) })).status,403);
  assert.equal(calls,0);
});
test('summary API projects away financial fields and ignores unknown output keys', async () => {
  let prompt;
  const handler = load('src/app/api/resource-report-summaries/route.ts', {
    'next/server': { NextResponse: { json: (body, options) => ({ body, ...options }) } },
    '@/lib/ai-router': { aiStructured: async (text) => { prompt=text; return { data: { summaries: {r:'Reviewed project schedule.', unknown:'Unrequested text'} } } } },
    '@/lib/contractor-auth': { getSupabaseAdmin: () => ({ auth: { getUser: async () => ({ data: { user: { email: 'admin@example.com' } } }) } }) },
    '@/lib/admin-allowlist': { isAdminEmail: () => true },
  });
  const result = await handler.POST({ headers:new Headers({authorization:'Bearer token'}), text: async () => JSON.stringify({lines:[{key:'r',notes:[{note:'Schedule review',date:'2026-10-01'}],bill_rate:999,amount:1998}]}) });
  assert.equal(result.status,200); assert.deepEqual(result.body.summaries,{r:'Reviewed project schedule.'}); assert.ok(!prompt.includes('999')); assert.ok(!prompt.includes('1998')); assert.equal(result.headers['Cache-Control'],'no-store');
});
test('builder applies project and resource choices and preserves edited summaries when drafting other rows', async () => {
  const React = require('react'), { create, act } = require('react-test-renderer');
  let requests = [];
  const handler = load('src/components/time-tracking/ResourceReportBuilder.tsx', {
    '@/lib/resource-report': lib,
    '@/lib/supabase': {supabase:{auth:{getSession:async()=>({data:{session:{access_token:'token'}}})}}},
    'lucide-react': {Download:()=>null,RefreshCw:()=>null,X:()=>null},
  });
  const original = global.fetch;
  global.fetch = async (_,opts) => { const body = JSON.parse(opts.body); requests.push(body); return {ok:true,json:async()=>({summaries:Object.fromEntries(body.lines.map(line=>[line.key,'Drafted weekly summary.']))})} };
  try {
    let tree;
    await act(async()=>{ tree=create(React.createElement(handler.default,{entries:fixture,projects:[{id:'p',label:'Scheduling'},{id:'q',label:'Controls'}],resources:[{id:'a',label:'Ana'},{id:'b',label:'Bea'}],initialProjects:['p','q'],initialResources:['a','b'],logo:'<svg></svg>',onClose:()=>{}}),{createNodeMock:()=>({showModal(){}})}) });
    const button = (label) => tree.root.findAllByType('button').find(node=>node.children.includes(label));
    await act(async()=>button('Full month').props.onClick());
    await act(async()=>tree.root.findByProps({'aria-label':'Report month'}).props.onChange({target:{value:'2026-10'}}));
    let boxes=tree.root.findAllByType('textarea'); assert.equal(boxes.length,3);
    assert.equal(tree.root.findAllByProps({'aria-label':'Month-to-date hours'}).length,1);
    await act(async()=>tree.root.findByProps({'aria-label':'Include month-to-date hours'}).props.onChange({target:{checked:false}}));
    assert.equal(tree.root.findAllByProps({'aria-label':'Month-to-date hours'}).length,0);
    await act(async()=>boxes[0].props.onChange({target:{value:'Reviewed and approved summary.'}}));
    await act(async()=>button('Draft work summaries').props.onClick());
    boxes=tree.root.findAllByType('textarea'); assert.equal(boxes[0].props.value,'Reviewed and approved summary.'); assert.equal(boxes[2].props.value,'Drafted weekly summary.'); assert.equal(requests.flatMap(r=>r.lines).length,1);
    await act(async()=>tree.unmount());
  } finally { global.fetch = original }
});

test('MTD includes earlier monthly submissions outside the selected week and respects both filters', () => {
  const weekly = lib.reportRows(fixture,'2026-10-05','2026-10-11',['p','q'],['a']);
  const mtd = lib.reportMonthTotals(fixture,'2026-10-05','2026-10-11',['p','q'],['a']);
  assert.equal(weekly.reduce((sum,row)=>sum+row.hours,0),3);
  assert.equal(mtd.length,1);assert.equal(mtd[0].start,'2026-10-01');assert.equal(mtd[0].end,'2026-10-11');assert.equal(mtd[0].hours,15.5);
  assert.deepEqual(mtd[0].resources.map(row=>row.hours).sort((a,b)=>a-b),[3,12.5]);
  assert.equal(lib.reportMonthTotals(fixture,'2026-10-05','2026-10-11',['p'],['a'])[0].hours,12.5);
  assert.equal(lib.reportMonthTotals(fixture,'2026-10-05','2026-10-11',['p'],['b'])[0].hours,2);
  assert.ok(!JSON.stringify(mtd).includes('bill_rate'));
});
test('MTD keeps months separate, caps current totals at today, and never double counts weekly cumulative values', () => {
  const mtd=lib.reportMonthTotals(fixture,'2026-09-29','2026-10-31',['p','q'],['a','b'],'2026-10-02');
  assert.deepEqual(mtd.map(month=>[month.start,month.end,month.hours]),[['2026-09-01','2026-09-30',7],['2026-10-01','2026-10-02',12.5]]);
  assert.deepEqual(lib.reportMonthTotals(fixture,'2026-11-01','2026-11-30',['p'],['a'],'2026-10-20'),[]);
  assert.equal(lib.reportMonthTotals(fixture,'2026-10-01','2026-10-31',['p','q'],['a','b'])[0].hours,17.5);
});
