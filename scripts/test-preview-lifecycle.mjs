import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../admin.js',import.meta.url),'utf8');
function definition(name){const start=source.indexOf('function '+name+'('),end=source.indexOf('\nfunction ',start+1);return source.slice(start,end);}
test('section switching unloads inactive previews after updating their visibility and preserves all forms',()=>{
  const sections=['overview','builder','territories'].map(view=>({dataset:{view},active:view==='overview',classList:{toggle(_name,value){sections.find(s=>s.dataset.view===view).active=value;}}}));
  const frames=sections.map(section=>({section,src:'loaded',removeAttribute(name){assert.equal(name,'src');this.src=null;}}));
  const scope=vm.createContext({state:{view:'overview'},$$:selector=>selector==='.view'?sections:frames.filter(frame=>!frame.section.active),renderNavigation(){},ensureTerritoryMapPreview(){},pushTerritoryMap(){},refreshViewPreview(view){frames.find(frame=>frame.section.dataset.view===view).src='loaded';}});
  vm.runInContext(definition('setView')+'\n'+definition('suspendInactivePreviews'),scope);
  for(const view of ['builder','territories','overview','builder']){scope.setView(view);assert.deepEqual(frames.filter(frame=>frame.src).map(frame=>frame.section.dataset.view),[view]);assert.equal(sections.length,3);}
});
test('collapsing a preview unloads its document and reopening reloads only that preview',()=>{
  const attributes=new Map([['aria-controls','stage'],['aria-expanded','true']]),frame={src:'loaded',getAttribute:()=>frame.src,removeAttribute:()=>{frame.src=null;}};
  const stage={hidden:false,querySelector:()=>frame},view={dataset:{view:'builder'}},panel={classList:{toggle(){}}},button={getAttribute:name=>attributes.get(name),setAttribute:(name,value)=>attributes.set(name,value),closest:selector=>selector==='.view'?view:panel};
  const scope=vm.createContext({document:{getElementById:()=>stage},$$:()=>stage.hidden?[frame]:[],updatePreviewToggleLabel(){},ensureTerritoryMapPreview(){},refreshViewPreview:()=>{frame.src='reloaded';}});
  vm.runInContext(definition('togglePreview')+'\n'+definition('suspendInactivePreviews'),scope);scope.togglePreview(button);assert.equal(frame.src,null);assert.equal(stage.hidden,true);scope.togglePreview(button);assert.equal(frame.src,'reloaded');assert.equal(stage.hidden,false);
});

test('late save or mutation callbacks cannot remount a preview after switching sections',()=>{
  const frames=[],cache=[];
  const scope=vm.createContext({state:{view:'themes',draft:{}},updatePreviewCache(){cache.push('updated');},$:()=>{const frame={src:null};frames.push(frame);return{querySelector:()=>({closest:()=>({hidden:false}),set src(value){frame.src=value;}}),dataset:{previewScreen:'home'},hidden:false};}});
  vm.runInContext(['refreshPreview','refreshSectionPreview','refreshViewPreview'].map(definition).join('\n'),scope);
  scope.refreshViewPreview('modules');scope.refreshSectionPreview('content');scope.refreshPreview();
  assert.equal(frames.length,0,'inactive callbacks never inspect or load a preview');assert.equal(cache.length,0);
});
test('release history preview reads the active game rather than an unpublished draft after rollback',()=>{
  const frame={src:null,closest:()=>({hidden:false})},panel={querySelector:()=>frame,dataset:{previewScreen:'home'}};
  let cacheUpdates=0;
  const scope=vm.createContext({state:{view:'releases',language:'ar'},updatePreviewCache(){cacheUpdates++;},$:()=>panel});
  vm.runInContext(definition('refreshSectionPreview'),scope);scope.refreshSectionPreview('releases');
  assert.match(frame.src,/lang=ar&screen=home/);assert.doesNotMatch(frame.src,/zone-preview/);assert.equal(cacheUpdates,0);
  scope.state.view='content';scope.refreshSectionPreview('content');assert.match(frame.src,/zone-preview=1/);assert.equal(cacheUpdates,1);
});
