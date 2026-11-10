const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), path = require('node:path')
function load(file,mocks={}) {
  const filename=path.join(__dirname,'..',file)
  let code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText
  if(file==='src/app/team/page.tsx') code+='\nmodule.exports.RateCardModal=RateCardModal;'
  const module={exports:{}}
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`,{filename})(n=>Object.hasOwn(mocks,n)?mocks[n]:require(n),module,module.exports)
  return module.exports
}
const {explicitContractorProjects}=load('src/lib/contractor-project-access.ts')
test('rate cards never grant unselected projects; disabled and other-company assignments are excluded',()=>{
  const projects=['raleigh','remington','richmond','management'].map(id=>({id,status:'active',is_active:true,company_id:'company'}))
  const assignments=['raleigh','remington','richmond'].map(project_id=>({project_id,company_id:'company',is_active:true}))
  assert.deepEqual(explicitContractorProjects(projects,assignments,'company').map(p=>p.id),['raleigh','remington','richmond'])
  assert.deepEqual(explicitContractorProjects(projects,[],'company'),[])
  assignments[0].is_active=false;assignments[1].company_id='other'
  assert.deepEqual(explicitContractorProjects(projects,assignments,'company').map(p=>p.id),['richmond'])
})
test('endpoint rejects non-admins and submits pricing and assignments in one atomic call',async()=>{
  let admin=null,calls=[]
  const route=load('src/app/api/rate-cards/route.ts',{'@/lib/admin-context':{adminContext:async()=>admin},'@/lib/commercial':{validId:v=>typeof v==='string'&&v.length===36}})
  const request=body=>({json:async()=>body})
  assert.equal((await route.POST(request({}))).status,401)
  admin={companyId:'verified-company',db:{rpc:async(name,args)=>{calls.push({name,args});return {data:{id:'saved'},error:null}}}}
  const id='11111111-1111-4111-8111-111111111111',body={rate:{team_member_id:id,client_id:id,rate:112},project_ids:[]}
  assert.equal((await route.POST(request({...body,company_id:'forged'}))).status,200)
  assert.equal(calls.length,1);assert.equal(calls[0].args.p_company_id,'verified-company');assert.deepEqual(calls[0].args.p_project_ids,[])
  admin.db.rpc=async()=>({error:{message:'insert failed'}})
  const failed=await route.POST(request(body));assert.equal(failed.status,400);assert.match((await failed.json()).error,/not saved/)
})
test('modal starts unselected, saves None, and keeps failed saves open',async()=>{
  const React=require('react'),{create,act}=require('react-test-renderer')
  const icons=new Proxy({__esModule:true},{get:(_,name)=>name==='__esModule'?true:()=>null})
  const db={from(){const q={then:resolve=>Promise.resolve({data:[],error:null}).then(resolve)};for(const m of ['select','eq','in'])q[m]=()=>q;return q}}
  const {RateCardModal}=load('src/app/team/page.tsx',{'@/lib/supabase':{supabase:db},'@/components/workspace/PageHeader':{default:()=>null},'lucide-react':icons,recharts:icons})
  const projects=['Raleigh','Remington','Richmond','Management'].map((name,i)=>({id:`p${i}`,name,client_id:'client',status:'active'}))
  let closed=0,saved=[]
  const props={isOpen:true,onClose:()=>closed++,onSave:async data=>saved.push(data),editingRate:{id:'card',team_member_id:'member',client_id:'client',rate:112},teamMembers:[],clients:[],projects,companyId:'company'}
  let renderer
  try {
    await act(async()=>{renderer=create(React.createElement(RateCardModal,props));await new Promise(r=>setImmediate(r))})
    const checks=()=>renderer.root.findAllByType('input').filter(n=>n.props.type==='checkbox')
    assert.equal(checks().filter(n=>n.props.checked).length,0)
    const save=()=>renderer.root.findAllByType('button').find(n=>n.children.includes('Save Changes'))
    await act(async()=>checks()[0].props.onChange());await act(async()=>save().props.onClick())
    assert.deepEqual(saved[0].project_ids,['p0']);assert.equal(closed,1)
    await act(async()=>renderer.update(React.createElement(RateCardModal,{...props,onSave:async()=>{throw new Error('Failed transaction')}})))
    await act(async()=>renderer.root.findAllByType('button').find(n=>n.children.includes('None')).props.onClick())
    await act(async()=>save().props.onClick())
    assert.equal(closed,1);assert.match(JSON.stringify(renderer.toJSON()),/Failed transaction/)
    await act(async()=>renderer.update(React.createElement(RateCardModal,props)));await act(async()=>save().props.onClick())
    assert.deepEqual(saved[1].project_ids,[])
  }finally{if(renderer)act(()=>renderer.unmount())}
})
