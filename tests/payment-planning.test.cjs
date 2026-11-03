const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),ts=require('typescript')
function load(file,mocks={}){const m={exports:{}};const js=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;vm.runInThisContext(`(function(require,module,exports){${js}\n})`)(n=>mocks[n] || require(n),m,m.exports);return m.exports}
const billing=load('src/lib/billing-periods.ts'),payables=load('src/lib/payables.ts')
const planning=load('src/lib/payment-planning.ts',{'./billing-periods':billing,'./payables':payables})
const policies=[{client_id:'googl',project_id:null,cycle_start_day:1,net_days:60,contractor_payment_basis:'client_payment'},{client_id:'p1',project_id:null,cycle_start_day:1,net_days:30,contractor_payment_basis:'client_payment'}]
const base={status:'approved',invoice_date:'2026-09-29',period_end:'2026-09-29',client_id:'googl',payment_basis:'client_payment',due_date:null}
test('September GOOGL Net 60 and October Point One Net 30 belong to the November payment month',()=>{
 const googl=planning.paymentTiming(base,policies),p1=planning.paymentTiming({...base,client_id:'p1',invoice_date:'2026-10-31',period_end:'2026-10-31'},policies)
 assert.equal(googl.date,'2026-11-29');assert.equal(googl.earliest,'2026-11-24');assert.equal(googl.latest,'2026-12-04')
 assert.equal(p1.date,'2026-11-30');assert.equal(p1.source,'estimate');assert.equal(p1.needsReview,false)
 assert.equal(planning.inPaymentWindow(base,policies,'2026-11-01','2026-11-30'),true)
 assert.equal(planning.inPaymentWindow(base,policies,'2026-10-25','2026-11-07'),false)
})
test('December GOOGL forecasts stay outside November, and the five-day boundary is inclusive',()=>{
 const october={...base,period_end:'2026-10-31',invoice_date:'2026-10-31'}
 assert.equal(planning.paymentTiming(october,policies).date,'2026-12-30')
 assert.equal(planning.inPaymentWindow(october,policies,'2026-11-01','2026-11-30'),false)
 assert.equal(planning.inPaymentWindow(base,policies,'2026-12-04','2026-12-04'),true)
 assert.equal(planning.inPaymentWindow(base,policies,'2026-12-05','2026-12-10'),false)
})
test('confirmed client dates replace assumptions while actual payout commitments remain authoritative',()=>{
 const confirmed={...base,client_invoice_date:'2026-10-05',client_net_days:60}
 assert.equal(planning.paymentTiming(confirmed,policies).date,'2026-12-04')
 assert.equal(planning.paymentTiming(confirmed,policies).earliest,'2026-12-04')
 assert.equal(planning.inPaymentWindow(confirmed,policies,'2026-11-01','2026-11-30'),false)
 assert.equal(planning.paymentTiming({...confirmed,status:'scheduled',due_date:'2026-11-15'},policies).date,'2026-11-15')
})
test('received funds stay in view until scheduled, but never mark an invoice paid',()=>{
 const available={...base,client_payment_received_on:'2026-10-20'}
 assert.equal(planning.inPaymentWindow(available,policies,'2026-11-01','2026-11-30'),true)
 assert.equal(planning.paymentTiming(available,policies).ready,true)
 assert.equal(available.status,'approved')
 for(const status of ['paid','rejected'])assert.equal(planning.inPaymentWindow({...available,status},policies,'2026-11-01','2026-11-30'),false)
})
test('mixed and unidentified client invoices require review instead of guessing a whole-invoice payment date',()=>{
 const mixed={...base,contractor_invoice_lines:[{client_id:'p1'}]},unknown={...base,client_id:null,due_date:'2026-11-03'}
 for(const invoice of [mixed,unknown]){assert.equal(planning.paymentTiming(invoice,policies).needsReview,true);assert.equal(planning.inPaymentWindow(invoice,policies,'2026-11-01','2026-11-30'),false)}
})
test('payment windows span months and years and reject incomplete or reversed dates',()=>{
 assert.deepEqual(planning.paymentWindow('month','2026-11-03'),{start:'2026-11-01',end:'2026-11-30'})
 assert.deepEqual(planning.paymentWindow('month_end','2026-11-03'),{start:'2026-10-25',end:'2026-11-07'})
 assert.deepEqual(planning.paymentWindow('month_end','2027-01-03'),{start:'2026-12-25',end:'2027-01-07'})
 assert.deepEqual(planning.paymentWindow('week','2026-11-03'),{start:'2026-11-02',end:'2026-11-08'})
 for(const dates of [['2026-11-30','2026-11-01'],['','2026-11-30'],['2026-02-30','2026-11-30']])assert.equal(planning.validPaymentWindow(...dates),false)
})
