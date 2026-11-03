const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript')
function load(file,mocks={}) {
  const m={exports:{}}
  const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
  vm.runInThisContext(`(function(require,module,exports){${source}\n})`)(n=>Object.hasOwn(mocks,n)?mocks[n]:require(n),m,m.exports)
  return m.exports
}
const messages=load('src/lib/login-error.ts'),allowlist=load('src/lib/admin-allowlist.ts')
test('banned sign-ins show a useful message for both query and fragment callbacks',()=>{
  for(const [search,hash] of [['?error=account_disabled',''],['','#error=access_denied&error_code=user_banned&error_description=User+is+banned']]) assert.match(messages.loginErrorMessage(search,hash),/disabled.*contact Gabriel/)
  assert.equal(messages.loginErrorMessage('','#access_token=secret&refresh_token=secret'),null)
  assert.doesNotMatch(messages.loginErrorMessage('?error=auth_failed&error_description=SECRET'),/SECRET/)
})
function callback(user,error=null) {
  let signedOut=0,exchanges=0
  const route=load('src/app/auth/callback/route.ts',{
    '@supabase/auth-helpers-nextjs':{createRouteHandlerClient:()=>({auth:{exchangeCodeForSession:async()=>{exchanges++;return {error}},getUser:async()=>({data:{user}}),signOut:async()=>{signedOut++}}})},
    'next/headers':{cookies:()=>({})},'next/server':{NextResponse:{redirect:url=>({url:url.toString()})}},'@/lib/admin-allowlist':allowlist,
  })
  return {...route,signedOut:()=>signedOut,exchanges:()=>exchanges}
}
test('Kathia and Gabriel enter the platform after successful authentication',async()=>{
  for(const email of ['kathia@manocg.com','gabriel@manocg.com']) {
    const route=callback({email})
    assert.equal((await route.GET({url:'https://www.vantagefp.co/auth/callback?code=one-time-code'})).url,'https://www.vantagefp.co/')
    assert.equal(route.exchanges(),1);assert.equal(route.signedOut(),0)
  }
})
test('provider rejection reaches a visible login error without attempting a session exchange',async()=>{
  const route=callback(null)
  const result=await route.GET({url:'https://www.vantagefp.co/auth/callback?error=access_denied&error_code=user_banned&error_description=User+is+banned'})
  assert.equal(result.url,'https://www.vantagefp.co/login?error=account_disabled')
  assert.equal(route.exchanges(),0)
})
test('non-admin accounts remain excluded and failed exchanges stay signed out',async()=>{
  const route=callback({email:'other@manocg.com'})
  assert.equal((await route.GET({url:'https://www.vantagefp.co/auth/callback?code=test'})).url,'https://www.vantagefp.co/contractor-portal')
  assert.equal(route.signedOut(),1)
  assert.equal((await callback(null,{message:'failed'}).GET({url:'https://www.vantagefp.co/auth/callback?code=test'})).url,'https://www.vantagefp.co/login?error=auth_failed')
})
test('the actual login screen displays the rejection instead of silently returning to login',async()=>{
  const React=require('react'),{create,act}=require('react-test-renderer')
  const oldWindow=global.window,redirects=[]
  global.window={location:{search:'?error=account_disabled',hash:''}}
  const Page=load('src/app/login/page.tsx',{
    'next/navigation':{useRouter:()=>({push:url=>redirects.push(url)})},
    '@/lib/supabase':{supabase:{auth:{getUser:async()=>({data:{user:null}})}}},
    '@/lib/login-error':messages,'@/components/brand/VantageLogo':{__esModule:true,default:()=>null},'./login.module.css':{},
  }).default
  let renderer
  try {
    await act(async()=>{renderer=create(React.createElement(Page));await new Promise(resolve=>setImmediate(resolve))})
    assert.match(renderer.root.findByProps({role:'alert'}).children.join(''),/disabled.*contact Gabriel/)
    assert.deepEqual(redirects,[])
  }finally{if(renderer)await act(async()=>renderer.unmount());global.window=oldWindow}
})
