const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), ts = require('typescript');
function load(file, mocks = {}, env = {}) {
 const module = { exports: {} }, filename = path.join(__dirname, '..', file);
 const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true } }).outputText;
 vm.runInThisContext(`(function(require,module,exports,process){${source}\n})`, {filename})(name=>Object.hasOwn(mocks,name)?mocks[name]:require(name),module,module.exports,{env});
 return module.exports;
}
const env = {OPENAI_API_KEY:'test-placeholder', ANTHROPIC_API_KEY:'test-placeholder', OPENAI_MODEL:'configured-openai-model', ANTHROPIC_MODEL:'configured-claude-model'};
function route(router) {
 return load('src/app/api/resource-report-summaries/route.ts',{
  'next/server':{NextResponse:{json:(body,options)=>({body,...options})}},
  '@/lib/ai-router':router,
  '@/lib/contractor-auth':{getSupabaseAdmin:()=>({auth:{getUser:async()=>({data:{user:{email:'admin@example.com'}}})}})},
  '@/lib/admin-allowlist':{isAdminEmail:()=>true},
 });
}
const request = () => ({headers:new Headers({authorization:'Bearer test-session'}),text:async()=>JSON.stringify({lines:[{key:'weekly-resource',notes:[{note:'Updated project schedule and reviewed open actions.'}]}]})});
test('real summary route uses the router and sends current OpenAI token parameter without temperature',async()=>{
 const previous=global.fetch, calls=[];
 global.fetch=async(url,options)=>{
  const body=JSON.parse(options.body);calls.push({url,body});
  if ('max_tokens' in body) return {ok:false,status:400,json:async()=>({error:{message:"Unsupported parameter: 'max_tokens'. Use 'max_completion_tokens' instead."}})};
  if ('temperature' in body) return {ok:false,status:400,json:async()=>({error:{message:'Temperature is not supported.'}})};
  return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({summaries:{'weekly-resource':'Updated the project schedule and reviewed open actions.'}})}}]})};
 };
 try {
  const result=await route(load('src/lib/ai-router.ts',{},env)).POST(request());
  assert.equal(result.status,200);assert.equal(result.body.summaries['weekly-resource'],'Updated the project schedule and reviewed open actions.');
  assert.equal(calls.length,1);assert.equal(calls[0].body.max_completion_tokens,2048);assert.equal(calls[0].body.model,env.OPENAI_MODEL);
  assert.equal(calls[0].body.response_format.type,'json_object');assert.ok(!('temperature' in calls[0].body));
 } finally {global.fetch=previous}
});
test('real summary route fails over to Claude without sending its rejected temperature parameter',async()=>{
 const previous=global.fetch,calls=[];
 global.fetch=async(url,options)=>{
  const body=JSON.parse(options.body);calls.push({url,body});
  if(url.includes('openai.com')) return {ok:false,status:503,statusText:'Unavailable',json:async()=>({error:{message:'Temporary outage'}})};
  if('temperature' in body) return {ok:false,status:400,json:async()=>({error:{message:'`temperature` is deprecated for this model.'}})};
  return {ok:true,json:async()=>({content:[{type:'text',text:JSON.stringify({summaries:{'weekly-resource':'Reviewed open schedule actions.'}})}]})};
 };
 try {
  const result=await route(load('src/lib/ai-router.ts',{},env)).POST(request());
  assert.equal(result.status,200);assert.equal(result.body.summaries['weekly-resource'],'Reviewed open schedule actions.');assert.equal(calls.length,2);
  assert.equal(calls[1].body.model,env.ANTHROPIC_MODEL);assert.equal(calls[1].body.max_tokens,2048);assert.ok(!('max_completion_tokens' in calls[1].body));assert.ok(!('temperature' in calls[1].body));
 } finally {global.fetch=previous}
});
test('both providers failing still returns a recoverable report error without exposing provider details',async()=>{
 const previous=global.fetch;
 global.fetch=async()=>({ok:false,status:503,statusText:'Unavailable',json:async()=>({error:{message:'Internal provider detail'}})});
 try {
  const result=await route(load('src/lib/ai-router.ts',{},env)).POST(request());
  assert.equal(result.status,500);assert.match(result.body.error,/edits are preserved/);assert.ok(!result.body.error.includes('Internal provider detail'));
 }finally{global.fetch=previous}
});
