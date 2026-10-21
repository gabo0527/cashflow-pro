const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),React=require('react'),{create,act}=require('react-test-renderer');
function load(file,mocks={}){const m={exports:{}},filename=path.join(__dirname,'..',file),source=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;vm.runInThisContext(`(function(require,module,exports){${source}\n})`,{filename})(n=>Object.hasOwn(mocks,n)?mocks[n]:require(n),m,m.exports);return m.exports;}
const navigation=load('src/lib/workspace-navigation.ts');
test('page search supports task vocabulary and contextual client routes without duplicating destinations',()=>{
 assert.deepEqual(navigation.findDestinations('hours').map(d=>d.href),['/time-tracking']);assert.equal(navigation.findDestinations('commercial terms')[0].href,'/projects');assert.equal(navigation.findDestinations('nonsense').length,0);assert.equal(navigation.workspaceContext('/clients/client-id').label,'Client workspace');assert.equal(new Set(navigation.workspaceDestinations.map(d=>d.href)).size,navigation.workspaceDestinations.length);
});
test('sidebar retains active routes, member-only destinations, collapse and mobile-close actions',async()=>{
 let close=0,collapse=0;const Component=load('src/components/layout/Sidebar.tsx',{'next/link':{__esModule:true,default:props=>React.createElement('a',props,props.children)},'next/navigation':{usePathname:()=>'/clients/a'},'@/components/brand/VantageLogo':{__esModule:true,default:()=>React.createElement('span',{},'VantageFP')},'@/lib/workspace-navigation':navigation}).default;
 let tree;await act(async()=>{tree=create(React.createElement(Component,{collapsed:false,onToggle:()=>collapse++,onSignOut:()=>{},companyName:'Example company',mobileOpen:true,onMobileClose:()=>close++}))});
 assert.equal(tree.root.findByProps({'aria-current':'page'}).props.href,'/clients');assert.equal(tree.root.findByType('aside').props['aria-modal'],true);
 await act(async()=>tree.root.findByProps({'aria-current':'page'}).props.onClick());assert.equal(close,1);
 await act(async()=>tree.root.findByProps({'aria-label':'Collapse navigation'}).props.onClick());assert.equal(collapse,1);
 await act(async()=>tree.update(React.createElement(Component,{collapsed:true,onToggle:()=>{},onSignOut:()=>{},userRole:'member'})));
 const hrefs=tree.root.findAllByType('a').map(a=>a.props.href);assert.ok(hrefs.includes('/timesheet'));assert.ok(!hrefs.includes('/clients'));await act(async()=>tree.unmount());
});
test('command search opens with the keyboard, navigates a matching result and closes cleanly',async()=>{
 const oldWindow=global.window,oldDocument=global.document,events={},navigationCalls=[];let opened=0,closed=0,focused=0;
 global.window={addEventListener:(n,f)=>events[n]=f,removeEventListener:()=>{}};global.document={addEventListener:()=>{},removeEventListener:()=>{}};
 const router={push:href=>navigationCalls.push(href)};
 try{const Component=load('src/components/layout/Header.tsx',{'next/navigation':{usePathname:()=>'/clients',useRouter:()=>router},'@/lib/workspace-navigation':navigation}).default;
 let tree;await act(async()=>{tree=create(React.createElement(Component,{sidebarCollapsed:false,onOpenChat:()=>{},userName:'Alex Example'}),{createNodeMock:el=>el.type==='dialog'?{open:false,showModal(){this.open=true;opened++},close(){this.open=false;closed++}}:el.type==='input'?{focus(){focused++}}:{contains:()=>true}})});
 assert.equal(tree.root.findByProps({"aria-label":"Find a page"}).type,"button");assert.equal(tree.root.findByProps({"aria-label":"Ask Sage"}).type,"button");assert.equal(tree.root.findByProps({"aria-label":"Open navigation"}).props["aria-expanded"],false);
 let prevented=false;await act(async()=>events.keydown({metaKey:true,key:'k',preventDefault:()=>prevented=true}));assert.equal(opened,1);assert.equal(focused,1);assert.equal(prevented,true);
 const input=tree.root.findByProps({id:'workspace-page-search'});await act(async()=>input.props.onChange({target:{value:'hours'}}));
 await act(async()=>input.props.onKeyDown({key:'Enter',preventDefault(){}}));assert.deepEqual(navigationCalls,['/time-tracking']);assert.ok(closed>=1);
 await act(async()=>tree.unmount());}finally{global.window=oldWindow;global.document=oldDocument;}
});
