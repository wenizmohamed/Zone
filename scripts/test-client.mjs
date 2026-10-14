import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const source = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
const catalog = readFileSync(resolve(root, 'assets/weapons/catalog.js'), 'utf8');
test('selected owner reconnect uses explicit sandbox recovery before ordinary session access', async () => {
  const {instance,context,calls}=game(); const order=[];
  context.window.zoneOwnerPlaytest={active:()=>true,recover:async()=>{order.push('owner');}};
  context.window.ZoneSession={recover:async()=>{throw Error('ordinary session must not precede selected sandbox recovery');}};
  context.window.ZonePlatform.refresh=async()=>{order.push('platform');return {};};
  instance.loadGameplay=async()=>{order.push('gameplay');}; instance.loadTerritories=async()=>{};
  instance.loadPlayerActivity=async()=>{}; instance.loadVisiblePeerResources=async()=>{};
  await instance.reconnect(); assert.deepEqual(order,['owner','platform','gameplay']); assert.equal(calls.length,0);
});
test('failed owner reconnect retains selection and performs no ordinary hydration or mutation', async () => {
  const {instance,context,calls}=game(); let hydrated=0,ordinary=0;
  context.window.zoneOwnerPlaytest={active:()=>true,recover:async()=>{throw Error('Selected sandbox unavailable');}};
  context.window.ZoneSession={recover:async()=>{ordinary++;}}; instance.loadGameplay=async()=>{hydrated++;};
  await instance.reconnect(); assert.equal(ordinary,0); assert.equal(hydrated,0);
  assert.equal(instance.gameplayError,'Selected sandbox unavailable'); assert.equal(calls.length,0);
});
test('selected sandbox startup probes independently of ordinary-session bootstrap failure', async () => {
  const {instance,context}=game(); let probes=0,ordinary=0;
  context.window.zoneOwnerPlaytest={active:()=>true,available:()=>true,snapshot:()=>null,probe:async()=>{probes++;}};
  context.window.ZoneSession={ensure:async()=>{ordinary++;throw Error('ordinary auth/session unavailable');}};
  instance.componentDidMount(); await new Promise(resolve=>setImmediate(resolve));
  assert.equal(probes,1); assert.equal(ordinary,0);
});

test('inventory match fraction preserves numerator order inside the Arabic RTL shell', () => {
  assert.match(html, /<span role="status" dir="ltr">\{\{ inventorySearch\.count \}\}<\/span>/);
});

test('empty owned inventory never presents an unowned weapon as a character item', () => {
  for (const lang of ['en', 'ar']) {
    const { instance } = game({ route: '?screen=items&lang=' + lang });
    instance.p.inv = {}; instance.state.itemTab = 'all'; instance.syncInventorySelection();
    assert.equal(instance.state.sel, '');
    assert.equal(instance.renderVals().sel.visible, false);
    assert.equal(instance.renderVals().invEmpty, true);
  }
  assert.match(html, /<sc-if value="\{\{ sel\.visible \}\}"><div class="zone-item-inspector/);
});

test('owned armor describes automatic server protection instead of an unavailable sell action', () => {
  for (const lang of ['en','ar']) {
    const {instance,T} = game({route:'?screen=items&lang=' + lang});
    instance.p.inv = {armor:1,vest:1};
    const rows = instance.renderVals().inv;
    assert.equal(rows.length,2);
    assert.ok(rows.every(row=>row.disabled && row.btn !== T[lang].sell));
    assert.ok(rows.every(row=>row.btn === (lang === 'ar' ? 'حماية تلقائية' : 'Automatic armor')));
  }
});

test('inventory categories select only an eligible owned item and hide empty-category inspectors', () => {
  const { instance, T } = game();
  instance.p.inv = { smallkit: 1, bat: 1 }; instance.p.equip = 'bat';
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang;
    instance.renderVals().itemTabs.find(tab => tab.name === T[lang].itemTabs.medical).go();
    assert.equal(instance.state.sel, 'smallkit'); assert.equal(instance.renderVals().sel.visible, true);
    instance.renderVals().itemTabs.find(tab => tab.name === T[lang].itemTabs.weapon).go();
    assert.equal(instance.state.sel, 'bat'); assert.equal(instance.renderVals().sel.visible, true);
    instance.renderVals().itemTabs.find(tab => tab.name === T[lang].itemTabs.armor).go();
    assert.equal(instance.state.sel, ''); assert.equal(instance.renderVals().sel.visible, false);
  }
});

test('Armory entry cannot retain a medical inspector while every weapon remains inspectable without purchase', () => {
  const { instance, T, calls } = game();
  instance.p.inv = { smallkit: 1 }; instance.p.equip = ''; instance.state.sel = 'smallkit';
  instance._inventorySelectionInitialized = true;
  instance.renderVals().itemTabs.find(tab => tab.name === T.en.itemTabs.armory).go();
  assert.equal(instance.renderVals().sel.type, T.en.itemType.weapon);
  for (const row of instance.renderVals().inv) { row.select(); assert.equal(instance.renderVals().sel.type, T.en.itemType.weapon); }
  assert.equal(calls.filter(call => call.options?.method === 'POST').length, 0);
  assert.deepEqual(instance.p.inv, { smallkit: 1 });
});

test('player header and item-frame accessible titles localize in English and Arabic', () => {
  for (const lang of ['en', 'ar']) {
    const { instance } = game({ route: '?lang=' + lang }); const view = instance.renderVals();
    assert.match(view.adminLabel, lang === 'ar' ? /الإدارة/ : /^Admin$/);
    assert.match(view.itemViewerLabel, lang === 'ar' ? /ثلاثي الأبعاد/ : /^3D/);
    assert.equal(view.accountLabel, lang === 'ar' ? 'الحساب' : 'Account');
    assert.equal(view.characterDetailsLabel, lang === 'ar' ? 'تفاصيل الشخصية' : 'Character details');
  }
  assert.match(html, /title="\{\{ itemViewerLabel \}\}"/);
  assert.match(html, /class="zone-profile-account"[^>]*>\{\{ accountLabel \}\}<\/a>/);
  assert.match(html, /<sc-if value="\{\{ n\.badge \}\}"><bdi/);
  assert.match(html, /family=Noto\+Sans\+Arabic/);
  assert.ok(html.indexOf('assets/ui/combat.css') < html.indexOf('assets/zone-design.css'), 'shared host-control styling follows combat styling');
});

test('inventory search filters the real catalog in both languages and never issues a purchase', () => {
  const { instance, calls } = game(); instance.state.itemTab = 'armory';
  const total = instance.renderVals().inv.length;
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang;
    instance.renderVals().inventorySearch.change({ target: { value: lang === 'ar' ? 'قناص' : 'sniper' } });
    assert.ok(instance.renderVals().inv.length > 0);
    assert.ok(instance.renderVals().inv.length < total);
    assert.equal(instance.renderVals().sel.visible, true);
    assert.ok(instance.renderVals().inv.some(row => row.name === instance.renderVals().sel.name), 'inspection follows a real visible search result');
    instance.renderVals().inventorySearch.change({ target: { value: 'no-such-weapon-xyz' } });
    assert.equal(instance.renderVals().inv.length, 0); assert.equal(instance.renderVals().invEmpty, true);
    assert.equal(instance.renderVals().sel.visible, false);
    assert.match(instance.renderVals().inventorySearch.empty, lang === 'ar' ? /مطابقة/ : /matching/);
    instance.renderVals().inventorySearch.clear(); assert.equal(instance.renderVals().inv.length, total);
  }
  assert.equal(calls.filter(call => call.options?.method === 'POST').length, 0);
});

test('owned and catalog weapon rows use model-specific thumbnails with honest artwork fallback', () => {
  const { instance } = game(); instance.p.inv = { bat: 1, smallkit: 1 };
  instance.state.itemTab = 'all';
  assert.match(instance.renderVals().inv.find(item => item.name === 'Baseball Bat').thumbnail, /\/bat\.png$/);
  assert.equal(instance.renderVals().inv.find(item => item.type === 'Medical').thumbnail, '');
  instance.state.itemTab = 'armory';
  const rows = instance.renderVals().inv; assert.ok(rows.length >= 51);
  assert.ok(rows.every(row => /\/assets\/weapons\/thumbnails\/.+\.png$/.test(row.thumbnail)));
  assert.match(html, /<img sc-camel-src="\{\{ i\.thumbnail \}\}" alt="" loading="lazy"/);
});

test('retained cross-tab searches choose an eligible visible item in both languages', () => {
  for (const lang of ['en', 'ar']) {
    const { instance, T, calls } = game(); instance.state.lang = lang;
    instance.p.inv = { bat: 1, smallkit: 1 }; instance.p.equip = 'bat';
    instance.state.itemTab = 'all'; instance.syncInventorySelection();
    instance.renderVals().inventorySearch.change({ target: { value: lang === 'ar' ? 'خرطوش' : 'shotgun' } });
    instance.renderVals().itemTabs.find(tab => tab.name === T[lang].itemTabs.armory).go();
    const view = instance.renderVals(); assert.ok(view.inv.length > 0); assert.equal(view.sel.visible, true);
    assert.ok(view.inv.some(row => row.name === view.sel.name));
    assert.equal(calls.filter(call => call.options?.method === 'POST').length, 0);
  }
});

test('explicit merchant inspection clears unrelated old searches and preserves the chosen stock identity', () => {
  for (const lang of ['en', 'ar']) {
    const { instance, calls } = game(); instance.state.lang = lang;
    instance.state.inventoryQuery = lang === 'ar' ? 'إسعاف' : 'first aid';
    instance.inspectMerchantItem({ item: 'ak', price: 260000, qty: 3, seller: 'Actual merchant' });
    const view = instance.renderVals(); assert.equal(instance.state.inventoryQuery, '');
    assert.equal(instance.state.sel, 'ak'); assert.equal(view.sel.visible, true);
    assert.match(view.sel.source, /Actual merchant/); assert.ok(view.inv.some(row => row.name === view.sel.name));
    assert.equal(calls.filter(call => call.options?.method === 'POST').length, 0);
  }
});

test('city renderer loads only on its first visible visit and returning reuses the same document',()=>{
  const app=game(),frame=app.frames['zone-city-map'],attributes=new Map([['data-map-src','dist/city-map-torn.html?v=95']]);let loads=0;
  frame.getAttribute=name=>attributes.get(name)||null;frame.setAttribute=(name,value)=>{attributes.set(name,value);if(name==='src')loads++;};
  app.instance.mapVisibility(false);assert.equal(loads,0);
  app.instance.mapVisibility(true);assert.equal(loads,1);assert.equal(attributes.get('src'),attributes.get('data-map-src'));
  app.instance.mapVisibility(false);app.instance.mapVisibility(true);assert.equal(loads,1);
  assert.match(html,/<iframe id="zone-city-map" data-map-src=/);assert.match(source,/this\.mapVisibility\(this\.state\.screen === 'city'\)/);
});

test('manual reconnect coalesces clicks and hydrates server progress without replaying a previous action', async () => {
  let finishPlatform, refreshes = 0;
  const { instance, context, calls } = game({ fetchImpl: async path => ({ ok: true, json: async () => path.includes('gameplay') ? { player: { id: 'actual-player', cash: 3210 }, state: { version: 6, ctr: { crimes: 2 } } } : path.includes('city/map') ? { blocks: Array.from({ length: 120 }, (_, i) => ({ id: String(i) })) } : { player: { id: 'actual-player', cash: 3210 } } }) });
  instance.runtimeConnection = 'offline'; instance.gameplayError = 'Network unavailable';
  context.window.ZonePlatform.status = () => 'connected';
  context.window.ZonePlatform.refresh = () => { refreshes++; return new Promise(resolve => { finishPlatform = resolve; }); };
  const first = instance.reconnect(), second = instance.reconnect();
  assert.equal(first, second);
  assert.equal(instance.renderVals().connectionRecovery.busy, true);
  assert.equal(instance.gameplayDisabled(), true, 'runtime reconnection alone cannot authorize stale gameplay');
  finishPlatform({}); await first;
  assert.equal(refreshes, 1);
  assert.equal(instance.p.cash, 3210);
  assert.equal(instance.p.ctr.crimes, 2);
  assert.equal(instance.gameplayVersion, 6);
  assert.equal(instance.gameplayDisabled(), false);
  assert.equal(instance.renderVals().connectionRecovery.visible, false);
  assert.equal(calls.filter(call => call.path === '/api/v1/gameplay').length, 1);
  assert.ok(calls.every(call => !call.options?.method || call.options.method === 'GET'));
});

test('expired sessions expose localized Account recovery without creating replacement progress', async () => {
  for (const lang of ['en', 'ar']) {
    const { instance, context, calls } = game({route:'?lang=' + lang});
    instance.applyServerPlayer({id:'saved-character',cash:4350});
    instance.gameplayError = 'Session expired';
    context.window.ZoneSession = {expired:()=>true,recover:async()=>{throw new Error('Session expired');}};
    const recovery = instance.renderVals().connectionRecovery;
    assert.equal(recovery.accountVisible,true);
    assert.equal(recovery.accountUrl,'/account?lang=' + lang);
    assert.match(recovery.message,lang === 'ar' ? /لن تُنشأ شخصية بديلة/ : /No replacement character/);
    await instance.reconnect();
    assert.equal(instance.p.cash,4350);
    assert.equal(calls.length,0);
  }
  assert.match(html,/href="\{\{ connectionRecovery\.accountUrl \}\}"/);
});

test('a failed reconnect retains real balances and keeps the retry control usable in both languages', async () => {
  const { instance, context, calls } = game();
  instance.applyServerPlayer({ id: 'actual-player', cash: 2500 });
  instance.gameplayReady = true; instance.runtimeConnection = 'offline';
  context.window.ZonePlatform.refresh = async () => { throw new Error('Network unavailable'); };
  await instance.reconnect();
  assert.equal(instance.p.cash, 2500);
  assert.equal(instance.gameplayDisabled(), true);
  assert.equal(instance.reconnecting, false);
  assert.equal(calls.length, 0, 'failed runtime recovery sends no gameplay request');
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang;
    const recovery = instance.renderVals().connectionRecovery;
    assert.equal(recovery.visible, true); assert.equal(recovery.disabled, false);
    assert.match(recovery.message, lang === 'ar' ? /لا تكرر أي إجراء سابق/ : /does not repeat any previous action/);
  }
});

test('recovery does not race a pending gameplay, reward, combat, map or peer action', async () => {
  for (const busy of ['gameplayBusy','moduleBusy','combatBusy','territoryBusy','travelBusy','hospitalBusy','state.busy','peer.busy']) {
    const { instance, context, calls } = game();
    let refreshes = 0;
    context.window.ZonePlatform.refresh = async () => { refreshes++; return {}; };
    instance.runtimeConnection = 'offline';
    if (busy === 'state.busy') instance.state.busy = 'training';
    else if (busy === 'peer.busy') instance.peerResources = { market: { busy: true } };
    else instance[busy] = true;
    assert.equal(instance.renderVals().connectionRecovery.disabled, true, busy);
    await instance.reconnect();
    assert.equal(refreshes, 0, busy); assert.equal(calls.length, 0, busy);
  }
});

function game({ manifest = {}, platformData = {}, fetchImpl, now = 1800000, preview = false, liveSave, route = '', modules = false, runtime = false, cachedRelease = true } = {}) {
  const frames = Object.fromEntries(['zone-city-map', 'zone-char-3d', 'zone-item-3d'].map(id => [id, { contentWindow: { postMessage(data, origin) { messages.push({ id, data, origin }); } } }]));
  const messages = [], timers = [], intervals = [], calls = [], storage = new Map(), listeners = {}, history = [];
  const location = new URL('http://zone.test/' + (preview ? '?zone-preview=1' : route));
  if (liveSave) { storage.set('zone.v2.save', JSON.stringify(liveSave)); storage.set('zone.player.id', 'test-player'); }
  if (runtime && cachedRelease) { storage.set(preview ? 'zone.platform.previewRelease' : 'zone.platform.activeRelease', JSON.stringify({ version:1, manifest:{ schemaVersion:1, ...manifest } })); storage.set('zone.platform.gameData', JSON.stringify(platformData)); }
  const context = createContext({
    console, URL, URLSearchParams, location, CustomEvent: class { constructor(type, {detail}) { this.type=type; this.detail=detail; } },
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    document: { documentElement: { dataset: {}, style: { setProperty() {} } }, getElementById: id => frames[id] || null },
    window: { location, history: Object.fromEntries(['pushState', 'replaceState'].map(method => [method, (state, title, href) => { history.push({ method, href }); location.href = href; }])), ZonePlatform: { preview, active: () => ({ version: 1, manifest }), data: () => platformData }, addEventListener(name, callback) { listeners[name] = callback; }, removeEventListener(name) { delete listeners[name]; }, dispatchEvent(event) { listeners[event.type]?.(event); } },
    addEventListener(name, callback) { listeners[name] = callback; },
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {}, setInterval: fn => { intervals.push(fn); return intervals.length; }, clearInterval() {},
    React: { createElement: () => ({}) },
    DCLogic: class {
      constructor(props) { this.props = props; }
      setState(value, done) { Object.assign(this.state, typeof value === 'function' ? value(this.state) : value); done?.(); }
      forceUpdate() {}
    },
    fetch: async (path, options) => {
      calls.push({ path, options });
      if (fetchImpl) return fetchImpl(path, options);
      return { ok: true, json: async () => path.includes('city/map') ? { blocks: Array.from({ length: 120 }, (_, i) => ({ id: String(i) })) } : path.includes('high-low') ? { card: 7, version: 1 } : path.includes('gameplay') ? { state: { version: 1 } } : path.includes('combat') ? { version: 1, encounter: null } : { player: {} } };
    },
  });
  runInContext(catalog, context);
  if (runtime) runInContext(readFileSync(resolve(root, 'platform-runtime.js'), 'utf8'), context);
  if (modules) { runInContext(readFileSync(resolve(root, 'assets/module-panel.js'), 'utf8'), context); context.window.ZoneModulePanel = context.ZoneModulePanel; }
  runInContext(`${source}\nglobalThis.clientExports = { Component, T, SCREENS, CAT };`, context);
  const instance = new context.clientExports.Component({});
  instance.bump = () => {};
  return { instance, ...context.clientExports, context, frames, messages, timers, intervals, calls, storage, listeners, history, location };
}

test('published custom page slugs resolve to canonical IDs on EN and AR entry, navigation and browser Back', () => {
  const page={id:'page-mv6k9c53',slug:'beta-operations',enabled:true,title:{en:'Beta Operations',ar:'عمليات النسخة التجريبية'},blocks:[{id:'hero-one',type:'hero',content:{en:'Published operations',ar:'عمليات منشورة'}}]};
  for(const lang of ['en','ar']){
    const {instance,context,listeners,location}=game({runtime:true,route:'?screen=beta-operations&lang='+lang,manifest:{pages:[page]}});
    assert.equal(instance.state.screen,page.id);assert.equal(instance.state.lang,lang);
    assert.equal(instance.renderVals().title,page.title[lang]);
    assert.equal(instance.renderVals().customBlocks[0].text,page.blocks[0].content[lang]);
    instance.componentDidMount();instance.go('home');instance.go(page.slug);
    assert.equal(instance.state.screen,page.id);assert.equal(location.searchParams.get('screen'),page.id);
    location.search='?screen=beta-operations&lang='+lang;listeners.popstate();
    assert.equal(instance.state.screen,page.id);assert.equal(instance.state.lang,lang);
    assert.equal(context.window.ZonePlatform.resolvePage(page.slug),page.id);
  }
});

test('a cold custom slug deep link resolves when the published bootstrap arrives without rewriting history', async () => {
  const page={id:'page-new',slug:'operations',enabled:true,title:{en:'Operations',ar:'العمليات'},blocks:[]};
  for(const lang of ['en','ar']){
    const app=game({runtime:true,cachedRelease:false,route:'?screen=operations&lang='+lang,fetchImpl:async path=>({ok:true,json:async()=>path.includes('game/bootstrap')?{release:{version:2,manifest:{schemaVersion:1,pages:[page]}},content:{}}:path.includes('gameplay')?{state:{version:1}}:path.includes('city/map')?{blocks:Array.from({length:120},(_,i)=>({id:String(i)}))}:path.includes('high-low')?{card:7,version:1}:{player:{}}})});
    assert.equal(app.instance.state.screen,'home');app.instance.componentDidMount();
    await app.context.window.ZonePlatform.refresh();
    assert.equal(app.instance.state.screen,page.id);assert.equal(app.instance.state.lang,lang);
    assert.equal(app.location.searchParams.get('screen'),page.slug);assert.equal(app.history.length,0);
  }
});

test('custom slug collisions cannot shadow built-in or legacy location routes, even when their module is disabled', () => {
  const pages=['home','crimes','bigals'].map((slug,i)=>({id:'page-'+i,slug,enabled:true,title:{en:'Collision',ar:'تعارض'},blocks:[]}));
  for(const lang of ['en','ar']){
    for(const [slug,expected] of [['home','home'],['bigals','market']]){
      const {instance}=game({runtime:true,route:'?screen='+slug+'&lang='+lang,manifest:{pages}});
      assert.equal(instance.state.screen,expected);
    }
    const {instance,SCREENS}=game({runtime:true,route:'?screen=crimes&lang='+lang,manifest:{pages},platformData:{engineModules:[{id:'crime',installed:true,enabled:false}]}});
    assert.equal(instance.state.screen,'home');instance.go('crimes');assert.equal(instance.state.screen,'home');assert.equal(SCREENS.includes('crimes'),false);
    assert.notEqual(instance.state.screen,'page-1');
  }
});

test('disabled or unknown custom aliases keep the existing fallback and canonical IDs take priority over slugs', () => {
  const pages=[{id:'page-disabled',slug:'closed-operations',enabled:false,title:{en:'Closed',ar:'مغلق'},blocks:[]},{id:'page-gated',slug:'gated-operations',enabled:true,title:{en:'Gated',ar:'متوقف'},blocks:[]},{id:'page-canonical',slug:'canonical-operations',enabled:true,title:{en:'Canonical',ar:'معرّف'},blocks:[]},{id:'page-alias',slug:'page-canonical',enabled:true,title:{en:'Alias',ar:'اسم'},blocks:[]}];
  for(const lang of ['en','ar']){
    for(const slug of ['closed-operations','gated-operations','unknown-operations']){
      const {instance}=game({runtime:true,route:'?screen='+slug+'&lang='+lang,manifest:{pages,modules:{'page-gated':false}}});
      assert.equal(instance.state.screen,'home');instance.go(slug);assert.equal(instance.state.screen,'home');
    }
    const {instance}=game({runtime:true,route:'?screen=page-canonical&lang='+lang,manifest:{pages}});
    assert.equal(instance.state.screen,'page-canonical');assert.equal(instance.renderVals().title,pages[2].title[lang]);
  }
});

test('live custom alias disable and re-enable follows published pages without resetting a character', async () => {
  const page={id:'page-live',slug:'live-operations',enabled:true,title:{en:'Live Operations',ar:'العمليات'},blocks:[]};
  let enabled=false;
  const app=game({runtime:true,route:'?screen=live-operations&lang=ar',manifest:{pages:[page]},fetchImpl:async path=>({ok:true,json:async()=>path.includes('game/bootstrap')?{release:{version:enabled?3:2,manifest:{schemaVersion:1,pages:[{...page,enabled}]}},content:{}}:path.includes('gameplay')?{state:{version:1}}:path.includes('city/map')?{blocks:Array.from({length:120},(_,i)=>({id:String(i)}))}:path.includes('high-low')?{card:7,version:1}:{player:{}}})});
  app.instance.componentDidMount();app.instance.applyGameplay({player:{id:'real',cash:777},state:{version:2,inv:{drink:1}}});
  await app.context.window.ZonePlatform.refresh();assert.equal(app.instance.state.screen,'home');
  app.instance.go(page.slug);assert.equal(app.instance.state.screen,'home');
  assert.equal(app.instance.p.cash,777);assert.equal(app.instance.p.inv.drink,1);
  enabled=true;await app.context.window.ZonePlatform.refresh();app.instance.go(page.slug);
  assert.equal(app.instance.state.screen,page.id);assert.equal(app.instance.state.lang,'ar');
  assert.equal(app.instance.p.cash,777);assert.equal(app.instance.p.inv.drink,1);
  assert.equal(app.calls.filter(call=>call.options?.method==='POST').length,0);
});

test('custom page IDs cannot reopen disabled built-in routes and malformed cached page metadata falls back safely', () => {
  const collision={id:'crimes',slug:'custom-crime',enabled:true,title:{en:'Collision',ar:'تعارض'},blocks:[]};
  const app=game({runtime:true,route:'?screen=custom-crime',manifest:{pages:[collision]},platformData:{engineModules:[{id:'crime',installed:true,enabled:false}]}});
  assert.equal(app.SCREENS.includes('crimes'),false);assert.equal(app.instance.state.screen,'home');
  assert.equal(app.context.window.ZonePlatform.resolvePage(collision.slug),collision.slug);
  const malformed=game({runtime:true,route:'?screen=unknown-page',manifest:{pages:{invalid:true}}});
  assert.equal(malformed.instance.state.screen,'home');
});

test('published engine module states gate their exact built-in routes while preserving unknown add-ons', () => {
  const mapping = { inventory:['items'], territories:['city'], bank:['bank'], stats:['gym'], properties:['properties'], crime:['crimes'], jail:['jail'], hospital:['hospital'], blackjack:['casino'], leaderboards:['hof'], gangs:['faction','elimination'], kill:['attack'], blackmarket:['market'] };
  for (const [id, routes] of Object.entries(mapping)) for (const state of [{ installed:true,enabled:false }, { installed:false,enabled:true }]) {
    const { instance, SCREENS } = game({ platformData: { engineModules:[{ id, ...state }] }, manifest:{ pages:[{id:'addon-lab',enabled:true,title:{en:'Add-on Lab',ar:'مختبر الإضافة'},blocks:[]}] } });
    for (const route of routes) assert.equal(SCREENS.includes(route),false,id+'/'+route);
    assert.equal(SCREENS.includes('addon-lab'),true);
    assert.equal(instance.renderVals().quick.some(entry=>routes.includes(entry.id)),false);
  }
  const { SCREENS } = game({ platformData:{engineModules:[{id:'addon-lab',installed:false,enabled:false}]}, manifest:{pages:[{id:'addon-lab',enabled:true,title:{en:'Add-on Lab',ar:'مختبر الإضافة'},blocks:[]}]} });
  assert.equal(SCREENS.length,20);
  assert.equal(SCREENS.includes('addon-lab'),true,'an unknown package is not mistaken for a built-in route gate');
});

test('live module disable safely leaves an open route, blocks its stale action callback and can be re-enabled without resetting progress', async () => {
  for (const lang of ['en','ar']) {
    const app = game({ route:'?screen=items&lang='+lang });
    app.instance.componentDidMount(); await new Promise(setImmediate);
    app.instance.applyGameplay({player:{id:'actual',cash:777},state:{version:2,inv:{drink:1},ctr:{crimes:3}}});
    const staleUse = app.instance.renderVals().inv.find(item=>item.name===app.T[lang].items.drink).act;
    app.calls.length=0;
    const publish = enabled => app.listeners['zone:runtime']({detail:{changed:true,connection:'connected',release:{version:enabled?3:2,manifest:{}},content:{engineModules:[{id:'inventory',installed:true,enabled}]}}});
    publish(false);
    assert.equal(app.instance.state.screen,'home');
    assert.equal(app.SCREENS.includes('items'),false);
    assert.match(app.instance.state.toast.text,lang==='ar'?/أوقف مالك اللعبة/:/owner disabled this service/);
    await staleUse();
    assert.equal(app.calls.filter(call=>call.options?.method==='POST').length,0);
    assert.equal(app.instance.p.cash,777); assert.equal(app.instance.p.inv.drink,1); assert.equal(app.instance.p.ctr.crimes,3);
    publish(true); app.instance.go('items');
    assert.equal(app.instance.state.screen,'items'); assert.equal(app.SCREENS.includes('items'),true);
    assert.equal(app.instance.p.cash,777); assert.equal(app.instance.p.inv.drink,1);
  }
});

test('disabled modules issue no new module-specific reads or direct gameplay commands', async () => {
  const ids=['inventory','territories','bank','stats','properties','crime','jail','hospital','blackjack','leaderboards','gangs','kill','blackmarket','travel'];
  const {instance,calls,T}=game({platformData:{engineModules:ids.map(id=>({id,installed:true,enabled:false}))}});
  instance.gameplayReady=true;
  await Promise.all([instance.loadTerritories(),instance.loadLeaderboards(),instance.loadCasino(),instance.loadCombat(),instance.loadHospitalQuote(),instance.loadTravel(),...['opponents','market','family'].map(kind=>instance.loadPeerResource(kind,true))]);
  await instance.commitManaged({id:'trash'},T.en); await instance.train('str',T.en); await instance.bankMove('deposit',1,T.en); await instance.healSelf(T.en); await instance.casinoGuess(true,T.en); await instance.travel('Dubai'); await instance.combatAction('start',{opponentId:'rookie'}); await instance.territoryAction({blockId:'ZC001',action:'claim',expectedVersion:1}); await instance.joinFaction('vipers');
  for(const action of ['item.use','market.buy','property.buy','gym.join','faction.contribute','jail.bailSelf','hospital.revive']) await instance.gameplayAction(action,'drink',1);
  for(const kind of ['market','family']) await instance.peerAction(kind,{action:'buy',id:'x',expectedVersion:1});
  assert.equal(calls.length,0);
  assert.equal(instance.p.cash,0);
});

test('Home mission and onboarding CTAs remain within enabled routes when their activity or Missions is disabled', () => {
  for (const lang of ['en','ar']) for (const missionsEnabled of [true,false]) {
    const {instance,SCREENS}=game({platformData:{engineModules:[{id:'crime',installed:true,enabled:false},{id:'stats',installed:true,enabled:false},{id:'kill',installed:true,enabled:false}]},manifest:{modules:{missions:missionsEnabled}}});
    instance.state.lang=lang;
    instance.applyGameplay({player:{cash:2500,nerve:25,max_nerve:25},state:{version:1},onboarding:{currentMissionId:'c5',steps:[{missionId:'c5',counter:'crimes',current:true,progress:0,target:5,cash:5000,points:5,claimable:false,claimed:false}]}});
    const view=instance.renderVals();
    assert.equal(SCREENS.includes(view.fieldGuide.route),true);
    assert.equal(view.quick.some(entry=>['crimes','gym','attack'].includes(entry.id)),false);
    view.fieldGuide.open(); assert.equal(SCREENS.includes(instance.state.screen),true);
    view.onboarding.current.open(); assert.equal(SCREENS.includes(instance.state.screen),true);
    if(!missionsEnabled) assert.equal(view.onboarding.current.disabled,true);
    assert.equal(instance.p.ctr.crimes,0);
  }
});

test('owned recovery-item UI requests are allowed once in hospital or jail while ordinary actions remain blocked', async () => {
  for (const lang of ['en','ar']) for (const status of ['hospUntil','jailUntil']) {
    const {instance,calls,T,context}=game({fetchImpl:async(path,options)=>({ok:true,json:async()=>({player:{id:'actual',cash:2500,life:100,max_life:100},state:{version:2,inv:{smallkit:0,bat:1},hospUntil:0,jailUntil:status==='jailUntil'?context.Date.now()+60000:0}})})});
    instance.state.lang=lang;
    instance.applyGameplay({player:{id:'actual',cash:2500,life:40,max_life:100},state:{version:1,inv:{smallkit:1,bat:1},[status]:context.Date.now()+60000}});
    const view=instance.renderVals(), kit=view.inv.find(item=>item.name===T[lang].items.smallkit),bat=view.inv.find(item=>item.name===T[lang].items.bat);
    assert.equal(kit.disabled,false); assert.equal(bat.disabled,true);
    await bat.act(); await view.bank.deposits.find(entry=>entry.label===T[lang].bankUi.all).do();
    assert.equal(calls.filter(call=>call.options?.method==='POST').length,0,'equipment and bank UI remain blocked');
    await kit.act();
    const writes=calls.filter(call=>call.options?.method==='POST');
    assert.equal(writes.length,1);
    assert.equal(JSON.parse(writes[0].options.body).action,'item.use');
    assert.equal(JSON.parse(writes[0].options.body).id,'smallkit');
    assert.equal(instance.p.inv.smallkit,0);assert.equal(instance.p.bars.life.v,100);assert.equal(instance.p.cash,2500);
    if(status==='jailUntil') assert.equal(instance.p.jailUntil,context.Date.now()+60000,'healing cannot locally clear jail');
  }
});

test('game routes retain explicit language across account and admin links despite an opposite cached preference', () => {
  assert.match(html, /href="\{\{ adminHref \}\}"/);
  for (const lang of ['en', 'ar']) {
    const { instance } = game({ route: '?lang=' + lang, liveSave: { lang: lang === 'en' ? 'ar' : 'en' } });
    assert.equal(instance.state.lang, lang);
    assert.equal(instance.renderVals().adminHref, '/admin?lang=' + lang);
    assert.equal(instance.renderVals().accountHref, '/account?lang=' + lang);
  }
});

test('failed crimes describe only the actual server penalty in English and Arabic', async () => {
  for (const lang of ['en', 'ar']) for (const type of ['none', 'jail', 'hosp']) {
    const minutes = type === 'none' ? 0 : 5;
    const { instance, T } = game({ fetchImpl: async () => ({ ok: true, json: async () => ({ success: false, penalty: { type, minutes }, player: { nerve: 43, jail_until: null, hospital_until: null } }) }) });
    instance.state.lang = lang; instance.gameplayReady = true;
    instance.loadGameplay = async () => {};
    const results = [], logs = [], toasts = [];
    instance.result = (...args) => results.push(args);
    instance.log = (...args) => logs.push(args);
    instance.toast = (...args) => toasts.push(args);
    await instance.commitManaged({ id: 'trash' }, T[lang]);
    assert.equal(instance.p.bars.nerve.v, 43);
    assert.equal(logs[0][0], type === 'none' ? 'crimeFail' : type === 'hosp' ? 'crimeHosp' : 'crimeJail');
    assert.equal(results[0][1], type === 'none' ? T[lang].crimeFailed : type === 'hosp' ? T[lang].hospital : T[lang].jail);
    if (type === 'none') {
      assert.equal(results[0][3], T[lang].noCrimeReward);
      assert.doesNotMatch(toasts[0][0], /jailed|hospital|سُجنت|المستشفى|0 min|0 دقيقة/i);
    }
  }
});

test('every player screen produces EN and AR view data', () => {
  const { instance, SCREENS } = game();
  assert.equal(SCREENS.length, 19);
  for (const lang of ['en', 'ar']) for (const screen of SCREENS) {
    instance.state.lang = lang; instance.state.screen = screen;
    const view = instance.renderVals();
    assert.equal(view.is[screen], true, `${lang}/${screen}`);
    assert.ok(view.title, `${lang}/${screen} title`);
  }
});

test('HUD displays the authoritative browser player instead of the founder fixture', () => {
  const { instance, T } = game();
  const original = T.en.player;
  instance.applyServerPlayer({ username: 'Player_beta123' });
  assert.equal(instance.renderVals().t.player, 'Player_beta123');
  assert.equal(T.en.player, original, 'does not mutate shared translation strings');
  instance.state.lang = 'ar';
  assert.equal(instance.renderVals().t.player, 'Player_beta123');
});

test('fresh live sessions never present or cache the founder preview before hydration', () => {
  const { instance, storage, T } = game();
  assert.equal(instance.p.cash, 0);
  assert.equal(instance.p.level, 1);
  assert.equal(instance.p.equip, 'fists');
  assert.deepEqual(Object.keys(instance.p.inv), []);
  assert.equal(instance.serverPlayer, false);
  assert.ok(instance.renderVals().stats.every(row => Number.isFinite(row.share)));
  instance.save();
  assert.equal(storage.has('zone.v2.save'), false);
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang;
    assert.notEqual(instance.renderVals().t.player, T[lang].player);
    instance.runtimeConnection = 'offline';
    assert.doesNotMatch(instance.renderVals().connectionLabel, /saved progress|آخر تقدم محفوظ/);
  }
  instance.applyServerPlayer({ username: 'Player_TEST', cash: 2500, level: 1 });
  instance.save();
  assert.equal(JSON.parse(storage.get('zone.v2.save')).cash, 2500);
});

test('explicit preview retains its illustrative character and offline cached players remain identifiable', () => {
  const preview = game({ preview: true }).instance;
  assert.equal(preview.p.cash, 48500);
  assert.equal(preview.p.equip, 'bat');
  const { instance } = game({ liveSave: { ...preview.p, username: 'Saved_player', serverMax: { energy: 150 } } });
  instance.runtimeConnection = 'offline';
  assert.equal(instance.renderVals().t.player, 'Saved_player');
  assert.match(instance.renderVals().connectionLabel, /Last saved progress/);
});

test('optional account link preserves locale without adding a login wall to gameplay', () => {
  const { instance } = game();
  for (const lang of ['en', 'ar']) { instance.state.lang = lang; assert.equal(instance.renderVals().accountHref, '/account?lang=' + lang); }
  assert.match(html, /href="\{\{ accountHref \}\}"/);
});

test('server hydration assigns actual stats, level, all bars and caps without replacing local features', () => {
  const { instance } = game();
  const inv = instance.p.inv, eduDone = instance.p.eduDone, job = instance.p.job;
  instance.applyServerPlayer({ level: 23, xp: 9, cash: 123, energy: 44, nerve: 7, happy: 88, life: 99, max_energy: 160, max_nerve: 55, max_life: 4000, max_happy: 6000, strength: 200, defense: 201, speed: 202, dexterity: 203, resources_updated_at: new Date(1800000).toISOString() });
  assert.equal(instance.p.level, 23); assert.equal(instance.p.stats.str, 200);
  assert.equal(instance.cur('nerve'), 7); assert.equal(instance.cur('happy'), 88);
  assert.equal(instance.maxOf('energy'), 160); assert.equal(instance.maxOf('happy'), 6000);
  assert.equal(instance.barClock('energy').ivl, 180000); assert.equal(instance.barClock('energy').rate, 1);
  assert.equal(instance.p.inv, inv); assert.equal(instance.p.eduDone, eduDone); assert.equal(instance.p.job, job);
});

test('server regeneration uses the credited server tick rather than accelerated demo cadence', () => {
  const { instance } = game({ now: 1920000 });
  instance.applyServerPlayer({ energy: 44, nerve: 7, happy: 88, life: 99, max_energy: 150, max_nerve: 50, max_happy: 5000, max_life: 3000, resources_updated_at: new Date(1800000).toISOString() });
  assert.equal(instance.cur('energy'), 44); assert.equal(instance.cur('life'), 101);
  assert.equal(instance.nextIn('energy'), 60000);
});

test('startup hydrates the authoritative gameplay once and defers unrelated casino data', async () => {
  const { instance, calls } = game(); instance.componentDidMount();
  await instance._gameplayLoad;
  assert.equal(calls.filter(call => call.path === '/api/v1/gameplay').length, 1);
  assert.equal(calls.filter(call => call.path === '/api/v1/player').length, 0);
  assert.equal(calls.filter(call => call.path === '/api/v1/casino/high-low').length, 0);
  instance.go('casino'); await instance._casinoLoad;
  assert.equal(instance.casinoReady, true);
});

test('character messages require exact origin/source and cannot mint unowned weapons', async () => {
  const { instance, frames, CAT, calls } = game({ fetchImpl: async (path, options) => ({ ok: true, json: async () => path.includes('gameplay') ? { state: { version: options?.method === 'POST' ? 2 : 1, ...(options?.method === 'POST' ? { equip: 'revolver' } : {}) } } : path.includes('high-low') ? { card: 7, version: 1 } : path.includes('city/map') ? { blocks: Array.from({ length: 120 }, (_, i) => ({ id: String(i) })) } : { player: {} } }) }); instance.componentDidMount();
  await instance._gameplayLoad;
  instance.applyGameplay({ player: { cash: 2500 }, state: { version: 1, inv: { bat: 1, revolver: 1 }, equip: 'bat' } });
  const key = Object.keys(CAT).find(item => CAT[item].type === 'weapon' && !instance.p.inv[item]);
  const send = (source, origin, data) => instance.onMsg({ source, origin, data });
  send(frames['zone-char-3d'].contentWindow, 'http://zone.test', { zoneEquip: key });
  assert.equal(instance.p.inv[key], undefined); assert.equal(instance.p.equip, 'bat');
  send(frames['zone-char-3d'].contentWindow, 'https://foreign.test', { zoneEquip: 'revolver' });
  send(frames['zone-item-3d'].contentWindow, 'http://zone.test', { zoneEquip: 'revolver' });
  assert.equal(instance.p.equip, 'bat');
  await send(frames['zone-char-3d'].contentWindow, 'http://zone.test', { zoneEquip: 'revolver' });
  assert.equal(instance.p.equip, 'revolver');
  const mutations = calls.filter(call => call.options?.method === 'POST');
  assert.equal(mutations.length, 1); assert.equal(JSON.parse(mutations[0].options.body).action, 'item.equip');
});

test('character equipment choices use owned models and preserve their gameplay identifiers', () => {
  const { instance, messages } = game();
  instance.applyGameplay({ player: { cash: 2500 }, state: { version: 1, inv: { bat: 1, revolver: 1, knife: 0 }, equip: 'revolver' } });
  instance.pushChar();
  const payload = messages.at(-1).data.character;
  assert.deepEqual(Array.from(payload.ownedWeapons), ['fists', 'bat', 'revolver_1']);
  assert.equal(payload.equipmentKeys.revolver_1, 'revolver');
  assert.equal(payload.equipmentKeys.bat, 'bat');
  assert.equal(payload.weapon, 'revolver_1');
});

test('hidden routes cannot be entered from quick links or direct go', () => {
  const { instance } = game({ manifest: { modules: { crimes: false } } });
  assert.equal(instance.renderVals().nav.some(item => item.id === 'crimes'), false);
  instance.go('crimes'); assert.equal(instance.state.screen, 'home');
});

test('map view persists and receives show/hide with a same-origin target', () => {
  const { instance, messages } = game();
  instance.go('city'); instance.go('home');
  const visibility = messages.filter(item => ['ON_SHOW', 'ON_HIDE'].includes(item.data.type));
  assert.deepEqual(visibility.map(item => item.data.type), ['ON_SHOW', 'ON_HIDE']);
  assert.ok(visibility.every(item => item.origin === 'http://zone.test'));
  assert.match(html, /data-zone-city-view="1"/); assert.doesNotMatch(html, /<sc-if value="\{\{ is\.city \}\}"/);
});

test('high-low sends direction, shows the server card and retains the settled bet in its message', async () => {
  const { instance, calls, T } = game({ fetchImpl: async () => ({ ok: true, json: async () => ({ result: 'win', card: 14, version: 2, delta: 1000, player: { cash: 99999 } }) }) });
  instance.applyServerPlayer({ cash: 5000 }); instance.gameplayReady = true; instance.casinoReady = true; instance.state.casino.version = 1;
  await instance.casinoGuess(true, T.en); await instance.casinoGuess(false, T.en);
  assert.deepEqual(calls.map(item => JSON.parse(item.options.body).direction), ['higher', 'lower']);
  assert.deepEqual(calls.map(item => JSON.parse(item.options.body).expectedVersion), [1, 2]);
  assert.ok(calls.every(item => item.path === '/api/v1/casino/high-low'));
  instance.state.casino.bet = 25000;
  const view = instance.renderVals(); assert.equal(view.casino.card, 'A');
  assert.match(view.casino.msg, /1,000/); assert.doesNotMatch(view.casino.msg, /25,000/);
});

test('animated action remains busy until the asynchronous mutation settles', async () => {
  const { instance, timers } = game(); instance.gameplayReady = true; let settle;
  instance.resolve('training', 10, () => new Promise(resolve => { settle = resolve; }));
  const pending = timers[0](); assert.equal(instance.state.busy, 'training');
  settle(); await pending; assert.equal(instance.state.busy, null);
});

test('compact navigation exposes the current area and closes after a successful route change', () => {
  const { instance, SCREENS } = game({ manifest: { modules: { casino: false } } });
  let view = instance.renderVals();
  assert.equal(view.navigationExpanded, false);
  assert.equal(view.nav.filter(item => item.current === 'page').length, 1);
  assert.equal(view.nav.find(item => item.current === 'page').id, 'home');
  assert.equal(view.nav.some(item => item.id === 'casino'), false);
  view.toggleNavigation();
  assert.equal(instance.renderVals().navigationExpanded, true);
  instance.go('city');
  view = instance.renderVals();
  assert.equal(view.navigationExpanded, false);
  assert.equal(view.nav.find(item => item.current === 'page').id, 'city');
  assert.equal(view.currentScreen, 'city');
  assert.equal(view.nav.length, SCREENS.length);
  instance.state.lang = 'ar';
  assert.match(instance.renderVals().navigationLabel, /[\u0600-\u06ff]/);
});

test('accessible HUD values follow authoritative resources and caps', () => {
  const { instance } = game();
  instance.applyServerPlayer({ energy: 44, nerve: 7, happy: 88, life: 99, max_energy: 160, max_nerve: 55, max_happy: 6000, max_life: 4000, resources_updated_at: new Date(1800000).toISOString() });
  const bars = instance.renderVals().bars;
  assert.deepEqual(Array.from(bars, bar => [bar.id, bar.value, bar.max]), [['energy', 44, 160], ['nerve', 7, 55], ['happy', 88, 6000], ['life', 99, 4000]]);
  instance.state.lang = 'ar';
  assert.match(instance.renderVals().bars[0].label, /[\u0600-\u06ff]/);
});

test('game presentation retains published navigation and uses real scene assets in both languages', () => {
  const { instance, SCREENS } = game({ manifest: { modules: { casino: false } } });
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang;
    for (const screen of SCREENS) {
      instance.state.screen = screen;
      const view = instance.renderVals();
      assert.deepEqual(Array.from(view.nav, item => item.id), Array.from(SCREENS));
      assert.ok(view.nav.every(item => /^#[a-f0-9]{6}$/i.test(item.iconColor)));
      assert.ok(view.nav.every(item => /^url\(\/assets\/ui\/icons\/[a-z]+\.svg\)$/.test(item.iconImage)));
      assert.ok(view.nav.filter(item => item.groupStart).every(item => item.groupLabel.length > 0));
      assert.match(view.sceneArt, /^\/art\/[a-z0-9_]+\.(jpg|png)$/);
      assert.ok(readFileSync(resolve(root, view.sceneArt.slice(1))).length > 0);
    }
  }
});

test('character stats remain available before the optional activity adapter loads', () => {
  const { instance } = game();
  instance.applyServerPlayer({ strength: 301, defense: 202, speed: 103, dexterity: 404 });
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang;
    const activity = instance.renderVals().activity;
    assert.equal(activity.available, false);
    assert.deepEqual(Array.from(activity.stats, row => row.value), ['301', '202', '103', '404']);
    assert.ok(activity.stats.every(row => row.label.length > 0));
  }
});

test('daily panel loads without claiming and a claim refreshes the main authoritative wallet', async () => {
  let claimed = false;
  const { instance, calls } = game({ modules: true, fetchImpl: async (path, options) => {
    if (options?.method === 'POST') claimed = true;
    const value = path === '/api/v1/player' ? { player: { id: 'p1', username: 'Vincenzo', cash: 999, login_streak: 2, last_login_day: claimed ? '2026-10-04' : null } }
      : path === '/api/v1/gameplay' ? { state: { version: 1 }, player: { cash: claimed ? 777 : 100 } }
      : path === '/api/v1/daily/contract' ? { contract: { id: 'daily1', day: '2026-10-04', metric: 'crimes', name_en: 'Commit crimes', name_ar: 'نفّذ جرائم', reward_cash: 50 }, progress: 1, target: 1, complete: true, claimed: false }
      : path.includes('achievements') ? { achievements: [] } : path.includes('notifications') ? { notifications: [] }
      : path === '/api/v1/daily/login' ? { streak: { rewardCash: 677, streakDay: 3 } } : {};
    return { ok: true, json: async () => value };
  } });
  instance.gameplayReady = true;
  await instance.loadPlayerActivity();
  assert.equal(calls.some(call => call.options?.method === 'POST'), false);
  assert.equal(instance.renderVals().activity.contract.title, 'Commit crimes');
  await instance.claimPlayerReward('login');
  assert.equal(calls.filter(call => call.options?.method === 'POST').length, 1);
  assert.equal(calls.find(call => call.options?.method === 'POST').path, '/api/v1/daily/login');
  assert.equal(instance.p.cash, 777);
  instance.state.lang = 'ar';
  assert.equal(instance.renderVals().activity.contract.title, 'نفّذ جرائم');
});

test('daily reward controls preserve preview and transit guards', async () => {
  const preview = game({ modules: true, preview: true });
  await preview.instance.loadPlayerActivity(); await preview.instance.claimPlayerReward('login');
  assert.equal(preview.calls.length, 0);
  const transit = game({ modules: true }); transit.instance.gameplayReady = true;
  transit.instance.p.travel = { status: 'traveling' };
  await transit.instance.claimPlayerReward('daily');
  assert.equal(transit.calls.some(call => call.options?.method === 'POST'), false);
});

test('casino art follows authoritative rank including Ace high without adding a suit to the bet', () => {
  const { instance } = game();
  instance.state.casino.card = 14;
  assert.equal(instance.renderVals().casino.spriteX, -2);
  instance.state.casino.card = 13;
  assert.equal(instance.renderVals().casino.spriteX, -878);
  instance.state.casino.card = 2;
  assert.equal(instance.renderVals().casino.spriteX, -75);
});

test('stale high-low rounds refresh the visible card without placing a replacement bet', async () => {
  const { instance, calls, T } = game({ fetchImpl: async (path, options) => options?.method === 'POST'
    ? { ok: false, status: 409, json: async () => ({ error: 'The card changed. Refresh before playing.' }) }
    : { ok: true, json: async () => path === '/api/v1/player' ? { player: { cash: 55000 } } : { card: 12, version: 3 } } });
  instance.applyServerPlayer({ cash: 5000 }); instance.gameplayReady = true; instance.casinoReady = true; instance.state.casino.version = 1;
  await assert.rejects(instance.casinoGuess(true, T.en), /card changed/);
  assert.equal(instance.state.casino.card, 12); assert.equal(instance.state.casino.version, 3);
  assert.equal(instance.casinoReady, true); assert.equal(instance.casinoBusy, false);
  assert.equal(instance.p.cash, 55000); assert.equal(calls.filter(item => item.options?.method === 'POST').length, 1);
});

test('gym quote matches server cost and bounded randomized gain without removing the ladder', () => {
  const { instance } = game();
  instance.applyServerPlayer({ happy: 500, max_happy: 5000, energy: 4, max_energy: 150, strength: 1000, defense: 1000, speed: 1000, dexterity: 1000 });
  instance.p.gym = 2;
  instance.territoryMap = { playerFactionId: 'mine', blocks: [
    { ownerFactionId: 'mine', state: 'owned', benefits: [{ key: 'gym_bonus', value: 1000 }] },
    { ownerFactionId: 'other', state: 'owned', benefits: [{ key: 'gym_bonus', value: 9000 }] },
  ] };
  const view = instance.renderVals();
  assert.equal(view.gymEnergy, 5); assert.equal(view.trainOff, true);
  assert.ok(view.gyms.length > 1); assert.equal(view.gyms[0].energy, 5); assert.equal(view.gyms.at(-1).energy, 10);
  assert.ok(view.stats.every(stat => stat.gain === '12 - 14'));
  instance.p.eduDone.fit = true; instance.p.fac.ups.gymBoost = true;
  assert.ok(instance.renderVals().stats.every(stat => stat.gain === '13 - 17'));
});

test('local activity XP cannot interpret cumulative server XP as a series of level-ups', () => {
  const { instance, T } = game(); instance.applyServerPlayer({ level: 12, xp: 4982 });
  const points = instance.p.points; instance.addXp(10);
  assert.equal(instance.p.level, 12); assert.equal(instance.p.xp, 4982);
  assert.equal(instance.p.points, points); assert.equal(instance.p.localXp, 10);
  assert.equal(instance.renderVals().statusRows.find(row => row.k === T.en.xp).v, '2,818');
});

test('an older player GET cannot overwrite a newer action response', async () => {
  let settle;
  const { instance } = game({ fetchImpl: () => new Promise(resolve => { settle = resolve; }) });
  const pending = instance.syncPlayer(); instance.applyServerPlayer({ cash: 500 });
  settle({ ok: true, json: async () => ({ player: { cash: 100 } }) }); await pending;
  assert.equal(instance.p.cash, 500);
});

test('both embedded 3D viewer message handlers reject foreign origins and sibling frames', () => {
  for (const name of ['character3d.html', 'weapon3d.html']) {
    const packed = readFileSync(resolve(root, 'dist', name), 'utf8');
    const template = JSON.parse(packed.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/)[1]);
    const handler = (template.match(/addEventListener\('message', e => \{([\s\S]*?)\}\);/)
      || template.match(/function onItemMessage\(e\) \{([\s\S]*?)\n\}/))?.[1];
    assert.ok(handler, `${name} must expose an inspectable parent message handler`);
    const parent = {}, changes = [], items = [], backgrounds = [];
    const context = createContext({ parent, location: { origin: 'http://zone.test' }, setLanguage: lang => changes.push(lang), stage: { dataset: { zoneAssetState: 'ready' }, setLanguage: lang => changes.push(lang) }, itemStatus() {}, show: item => items.push(item), setBg() {}, bg: color => backgrounds.push(color), document: { documentElement: {} } });
    runInContext(`globalThis.receive = e => {${handler}};`, context);
    const data = { lang: 'ar', item: 'bat', bg: '#16181b' };
    context.receive({ source: parent, origin: 'https://foreign.test', data });
    context.receive({ source: {}, origin: 'http://zone.test', data });
    assert.equal(changes.length, 0); assert.equal(context.document.documentElement.lang, undefined);
    assert.deepEqual(items, []); assert.deepEqual(backgrounds, []);
    context.receive({ source: parent, origin: 'http://zone.test', data });
    assert.equal(name === 'character3d.html' ? changes[0] : context.document.documentElement.lang, 'ar');
    if (name === 'weapon3d.html') { assert.deepEqual(items, ['bat']); assert.deepEqual(backgrounds, ['#16181b']); }
  }
});

test('jobs display selected-role wages and energy including completed education benefits', () => {
  const { instance } = game(); instance.applyServerPlayer({ level: 12, energy: 14 });
  const view = instance.renderVals();
  assert.equal(view.job.pay, '$850'); assert.equal(view.job.energy, 15); assert.equal(view.job.disabled, true);
  assert.equal(view.jobs.length, 6); assert.equal(view.jobs[2].pay, '$4,200');
  instance.p.job = 'clinic'; instance.p.eduDone.biz = true;
  assert.equal(instance.renderVals().job.pay, '$4,620'); assert.equal(instance.renderVals().job.energy, 20);
});

test('admin preview uses an isolated save and never bootstraps or submits gameplay API calls', async () => {
  const liveSave = game().instance.p;
  const { instance, calls, storage, T, frames } = game({ preview: true, liveSave });
  const liveBefore = storage.get('zone.v2.save'), cashBefore = instance.p.cash, equipBefore = instance.p.equip;
  instance.componentDidMount(); instance.save();
  assert.ok(storage.has('zone.v2.preview.save')); assert.equal(storage.get('zone.v2.save'), liveBefore);
  let acted = false; instance.act(() => { acted = true; }); instance.resolve('preview', 1, () => { acted = true; });
  await Promise.all([
    instance.territoryAction({ blockId: 'ZC-001', action: 'capture' }), instance.commitManaged({ id: 'trash' }, T.en),
    instance.train('str', T.en), instance.casinoGuess(true, T.en), instance.bankMove('deposit', 1000, T.en),
    instance.healSelf(T.en), instance.travel('Dubai'), instance.work(T.en),
  ]);
  instance.onMsg({ source: frames['zone-char-3d'].contentWindow, origin: 'http://zone.test', data: { zoneEquip: 'revolver' } });
  instance.onMsg({ source: frames['zone-city-map'].contentWindow, origin: 'http://zone.test', data: { zoneTravel: { energy: 10, metres: 50 } } });
  assert.equal(acted, false); assert.equal(calls.length, 0); assert.equal(instance.p.cash, cashBefore); assert.equal(instance.p.equip, equipBefore);
  assert.equal(storage.get('zone.v2.save'), liveBefore);
  instance.go('city'); assert.equal(instance.state.screen, 'city');
  const view = instance.renderVals(); assert.equal(view.preview, true); assert.match(view.previewNotice, /read-only/);
  view.toggleLang(); assert.match(instance.renderVals().previewNotice, /للقراءة فقط/);
  view.toggleTheme(); assert.equal(instance.state.theme, 'light');
  assert.equal(storage.get('zone.v2.save'), liveBefore);
});

test('preview direct jail/hospital recovery buttons cannot alter the snapshot', () => {
  const { instance } = game({ preview: true });
  const cash = instance.p.cash, kits = instance.p.inv.smallkit;
  instance.p.jailUntil = 1900000; instance.renderVals().status.act();
  assert.equal(instance.p.cash, cash); assert.equal(instance.p.jailUntil, 1900000);
  instance.p.jailUntil = 0; instance.p.hospUntil = 1900000; instance.renderVals().status.act();
  assert.equal(instance.p.inv.smallkit, kits); assert.equal(instance.p.hospUntil, 1900000);
});

test('gameplay snapshot replaces persistent gameplay fields but preserves presentation preferences and event history', () => {
  const { instance } = game();
  const log = instance.p.log; instance.state.lang = 'ar'; instance.p.lang = 'ar';
  instance.applyGameplay({ player: { cash: 1200 }, state: { version: 4, inv: { knife: 2 }, equip: 'knife', prop: 'shack', ownedProperties: { shack: 1, apt: 1 }, edu: { id: 'bio', until: 2400000, total: 1200000 }, eduDone: {}, fac: { respect: 6000, ups: {} }, ctr: { buys: 2 }, claimed: {}, gym: 0, gymXp: 0, job: 'grocer', jobPts: 1, points: 4, merits: 2, market: [{ id: 'knife', item: 'knife', price: 2600, qty: 2, base: 2600 }], inmates: [], patients: [] }, catalogs: {} });
  assert.equal(instance.p.cash, 1200); assert.equal(instance.p.inv.knife, 2); assert.equal(instance.p.inv.revolver, undefined);
  assert.equal(instance.p.equip, 'knife'); assert.equal(instance.gameplayVersion, 4); assert.equal(instance.gameplayReady, true);
  assert.equal(instance.p.log, log); assert.equal(instance.p.lang, 'ar'); assert.equal(instance.market[0].price, 2600);
  assert.equal(instance.renderVals().props.find(property => property.name === 'شقة').price, '$0');
});

test('an older gameplay GET cannot overwrite a newer purchase response', async () => {
  let settle;
  const { instance } = game({ fetchImpl: () => new Promise(resolve => { settle = resolve; }) });
  const pending = instance.loadGameplay();
  instance.applyGameplay({ player: { cash: 500 }, state: { version: 3, inv: { knife: 1 } } });
  settle({ ok: true, json: async () => ({ player: { cash: 3100 }, state: { version: 2, inv: {} } }) }); await pending;
  assert.equal(instance.p.cash, 500); assert.equal(instance.p.inv.knife, 1); assert.equal(instance.gameplayVersion, 3);
});

test('published runtime changes update navigation, branding, and categorized crimes in the current client', () => {
  const { instance, SCREENS } = game(); instance.componentDidMount();
  instance.onRuntime({ detail: { connection: 'connected', changed: true, release: { version: 5, manifest: { branding: { name: { en: 'Updated City' } }, modules: { casino: false }, navigation: ['home', 'crimes', 'casino'] } }, content: { crimes: [{ id: 'east', category: 'graf', enabled: true, name_en: 'Published wall', nerve_cost: 7, cash_min: 100, cash_max: 200, xp_reward: 3, success_basis_points: 8000 }] } } });
  assert.equal(instance.renderVals().platformBrand, 'Updated City'); assert.ok(!SCREENS.includes('casino'));
  instance.state.cat = 'graf'; const view = instance.renderVals();
  assert.equal(view.crimes.length, 1); assert.equal(view.crimes[0].name, 'Published wall'); assert.equal(view.crimes[0].nerve, 7);
  assert.doesNotMatch(html, /RELEASE \{\{ releaseVersion \}\}/);
});

test('accepted character identity retains only that characters bound event history', () => {
  for (const lang of ['en', 'ar']) {
    const cached = { ...game().instance.p, serverMax: { energy: 100 }, playerId: 'old-character', logV: 2, log: [{ k: 'gameplay', a: { action: 'item.equip', id: 'bat' }, kind: 'good', time: '10:00' }] };
    const { instance, storage } = game({ liveSave: cached });
    instance.state.lang = lang;
    instance.applyServerPlayer({ id: 'old-character', username: 'Actual_Player' });
    assert.equal(instance.p.log.length, 1, 'matching server identity retains genuine events');
    instance.applyServerPlayer({ id: 'new-character', username: 'New_Player' });
    assert.equal(instance.p.log.length, 0, 'another accepted identity clears previous-character events');
    assert.equal(instance.renderVals().log.length, 0);
    instance.log('gameplay', { action: 'item.equip', id: 'knife' }, 'good');
    instance.applyServerPlayer({ id: 'new-character', username: 'New_Player' });
    assert.equal(instance.p.log.length, 1, 'repeated hydration preserves current-character events');
    instance.save();
    assert.equal(JSON.parse(storage.get('zone.v2.save')).playerId, 'new-character');
  }
});

test('legacy cached events with no character binding are dropped once after authoritative identity hydration', () => {
  const cached = { ...game().instance.p, serverMax: { energy: 100 }, logV: 2, log: [{ k: 'gameplay', a: { action: 'item.equip', id: 'revolver' }, kind: 'good', time: '10:00' }] };
  const { instance } = game({ liveSave: cached });
  instance.applyServerPlayer({ cash: 2500 });
  assert.equal(instance.p.log.length, 1, 'an incomplete player read does not guess ownership');
  instance.applyServerPlayer({ id: 'actual-character', username: 'Actual_Player' });
  assert.equal(instance.p.log.length, 0);
  instance.log('gameplay', { action: 'item.equip', id: 'knife' }, 'good');
  instance.applyServerPlayer({ id: 'actual-character', cash: 2500 });
  assert.equal(instance.p.log.length, 1);
});

test('a catalog publication during first gameplay hydration queues an authoritative replacement read', async () => {
  const publishedCatalog = JSON.parse(readFileSync(resolve(root, 'engine/data/gameplay-catalog.json'), 'utf8'));
  let settleInitial;
  let gameplayReads = 0;
  const { instance } = game({ fetchImpl: async path => {
    if (path === '/api/v1/gameplay') {
      gameplayReads++;
      if (gameplayReads === 1) return new Promise(resolve => { settleInitial = resolve; });
      return { ok: true, json: async () => ({ player: { username: 'New_Player', cash: 2500 }, state: { version: 1, inv: { smallkit: 1 }, equip: 'fists' } }) };
    }
    return { ok: true, json: async () => ({ player: {} }) };
  } });
  instance.p.inv = { bat: 1, revolver: 1, smallkit: 3 };
  instance.componentDidMount();
  const pending = instance._gameplayLoad;
  instance.onRuntime({ detail: { connection: 'connected', changed: true, content: { gameplayCatalog: publishedCatalog } } });
  settleInitial({ ok: true, json: async () => ({ state: { version: 1, inv: { smallkit: 1 }, equip: 'fists' } }) });
  await pending;
  for (let turn = 0; turn < 12; turn++) await Promise.resolve();
  assert.equal(gameplayReads, 2, 'invalidated initial response must trigger a replacement without waiting for polling');
  assert.equal(instance.gameplayReady, true);
  assert.equal(instance.gameplayVersion, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(instance.p.inv)), { smallkit: 1 });
  assert.match(instance.renderVals().connectionLabel, /Connected/);
});

test('gameplay mutations send only action identity and displayed version, then use server wallet and inventory', async () => {
  const { instance, calls } = game({ fetchImpl: async () => ({ ok: true, json: async () => ({ player: { cash: 500 }, state: { version: 8, inv: { knife: 1 }, equip: null }, catalogs: {}, result: { action: 'item.buy', id: 'knife' } }) }) });
  instance.gameplayReady = true; instance.gameplayVersion = 7;
  await instance.gameplayAction('item.buy', 'knife');
  assert.equal(calls[0].path, '/api/v1/gameplay/action');
  assert.deepEqual(JSON.parse(calls[0].options.body), { action: 'item.buy', id: 'knife', expectedVersion: 7 });
  assert.equal(instance.p.cash, 500); assert.equal(instance.p.inv.knife, 1); assert.equal(instance.gameplayVersion, 8);
  assert.equal(instance.p.log[0].a.action, 'item.buy'); assert.match(instance.renderVals().log[0].text, /Bought/);
  instance.state.lang = 'ar'; assert.match(instance.renderVals().log[0].text, /اشتريت/); assert.doesNotMatch(instance.renderVals().log[0].text, /Bought/);
});

test('stale gameplay actions refresh wallet and inventory without replaying the purchase', async () => {
  const { instance, calls } = game({ fetchImpl: async (path, options) => options?.method === 'POST'
    ? { ok: false, status: 409, json: async () => ({ error: 'Gameplay changed. Refresh before acting.' }) }
    : { ok: true, json: async () => ({ player: { cash: 900 }, state: { version: 9, inv: { bat: 3 } }, catalogs: {} }) } });
  instance.gameplayReady = true; instance.gameplayVersion = 7;
  await assert.rejects(instance.gameplayAction('item.buy', 'knife'), /Gameplay changed/);
  assert.equal(instance.p.cash, 900); assert.equal(instance.p.inv.bat, 3); assert.equal(instance.gameplayVersion, 9);
  assert.equal(calls.filter(call => call.options?.method === 'POST').length, 1);
});

test('item market and direct recovery controls dispatch server actions instead of writing a local wallet', async () => {
  const { instance } = game(); instance.gameplayReady = true; const actions = []; const before = instance.p.cash;
  instance.gameplayAction = async (action, id) => { actions.push({ action, id }); };
  await instance.renderVals().market[0].buy();
  await instance.renderVals().props.find(prop => !prop.living).buy();
  instance.p.jailUntil = 1900000; await instance.renderVals().status.act();
  instance.p.jailUntil = 0; instance.p.hospUntil = 1900000; await instance.renderVals().status.act();
  assert.deepEqual(actions.map(action => action.action), ['market.buy', 'property.buy', 'jail.bailSelf', 'item.use']);
  assert.equal(instance.p.cash, before);
});

test('combat uses server encounter versions and cannot locally award the finish reward', async () => {
  const replies = [
    { version: 1, encounter: null, player: { cash: 1000, energy: 50 } },
    { version: 2, encounter: { opponentId: 'rayan', phase: 'fighting', turn: 0, startPlayerHp: 100, playerMaxHp: 100, enemyMaxHp: 80, playerHp: 100, enemyHp: 80, log: [] }, player: { cash: 1000, energy: 25 } },
    { version: 3, encounter: { opponentId: 'rayan', phase: 'won', turn: 1, startPlayerHp: 100, playerMaxHp: 100, enemyMaxHp: 80, playerHp: 90, enemyHp: 0, log: [{ n: 1, side: 'opp', actor: 'player', d: 80, yl: 90, ol: 0 }] }, player: { cash: 1000, energy: 25, life: 90 } },
    { version: 4, encounter: null, player: { cash: 1250, energy: 25, life: 90 }, result: { approach: 'mug', cashDelta: 250 } },
  ];
  const { instance, calls } = game({ fetchImpl: async () => ({ ok: true, json: async () => replies.shift() }) });
  instance.gameplayReady = true; await instance.loadCombat(); await instance.combatAction('start', { opponentId: 'rayan' });
  assert.equal(instance.p.cash, 1000); assert.equal(instance.cur('energy'), 25);
  await instance.combatAction('strike'); assert.equal(instance.renderVals().fight.canFinish, true);
  await instance.combatAction('finish', { approach: 'mug' });
  assert.equal(instance.p.cash, 1250); assert.equal(instance.state.fight, null);
  assert.deepEqual(calls.filter(call => call.options?.method === 'POST').map(call => JSON.parse(call.options.body).expectedVersion), [1, 2, 3]);
});

test('all 70 map locations resolve to enabled destinations or explicitly unavailable services', () => {
  const { instance, messages, SCREENS } = game(); instance.pushMap();
  const pins = messages.find(message => message.data.type === 'ZONE_MAP_DATA').data.zonePins;
  assert.equal(pins.length, 70);
  for (const pin of pins) {
    assert.equal(pin.screenAvailable, SCREENS.includes(pin.screen), pin.id);
    if (pin.screenAvailable) assert.ok(pin.screenLabel, pin.id);
    else assert.ok(['points', 'church'].includes(pin.screen), pin.id);
  }
  assert.ok(pins.some(pin => pin.id === 'sweetshop' && pin.screen === 'market'));
  instance.go('sweetshop'); assert.equal(instance.state.screen, 'market');
  instance.go('church'); assert.equal(instance.state.screen, 'market'); assert.match(instance.state.toast.text, /unavailable/);
  const disabled = game({ manifest: { modules: { market: false } } }); disabled.instance.pushMap();
  assert.ok(disabled.messages.find(message => message.data.type === 'ZONE_MAP_DATA').data.zonePins.filter(pin => pin.screen === 'market').every(pin => pin.screenAvailable === false));
});

test('compact city presentation keeps all locations and authoritative control actions in one map payload', () => {
  const { instance, messages } = game();
  instance.gameplayReady = true; instance._territoryAuthoritative = true;
  instance.territoryMap = { revision: 8, playerFactionId: 'kings', factions: [], blocks: [{ id: 'ZC-021', ownerFactionId: 'kings', version: 4, action: 'reinforce', actionEnergyCost: 0 }] };
  instance.pushMap();
  const payload = messages.find(message => message.data.type === 'ZONE_MAP_DATA').data;
  assert.equal(payload.presentation.compact, true);
  assert.equal(payload.presentation.showLocations, true);
  assert.equal(payload.zonePins.length, 70);
  assert.equal(payload.territoryAuthoritative, true);
  assert.equal(payload.revision, 8);
  assert.equal(payload.playerFactionId, 'kings');
  assert.equal(payload.blocks[0].id, 'ZC-021');
  assert.equal(payload.blocks[0].version, 4);
  assert.equal(payload.blocks[0].actionType, 'reinforce');
  assert.equal(payload.blocks[0].canAct, true);
});

test('city directory exposes unique functional destinations and navigates without spending resources', () => {
  for (const lang of ['en', 'ar']) {
    const { instance, SCREENS, calls, location } = game({ route: '?screen=city&lang=' + lang });
    instance.state.lang = lang;
    const directory = instance.renderVals().cityDirectory;
    assert.ok(directory.rows.length >= 15);
    assert.equal(new Set(directory.rows.map(row => row.screen)).size, directory.rows.length);
    assert.ok(directory.rows.every(row => SCREENS.includes(row.screen) && row.label && row.destination));
    const resources = () => JSON.stringify({ cash: instance.p.cash, bars: instance.p.bars, inv: instance.p.inv, ctr: instance.p.ctr });
    const before = resources();
    directory.rows.find(row => row.id === 'gym').open();
    assert.equal(instance.state.screen, 'gym');
    assert.equal(location.searchParams.get('lang'), lang);
    assert.equal(resources(), before);
    assert.equal(calls.filter(call => call.options?.method === 'POST').length, 0);
  }
});

test('city directory searches bilingual locations and honors published destination availability', () => {
  const { instance } = game();
  instance.renderVals().cityDirectory.search({ target: { value: 'UNIVERSITY' } });
  const row = instance.renderVals().cityDirectory.rows.find(row => row.id === 'university');
  assert.equal(row.screen, 'education'); row.open(); assert.equal(instance.state.screen, 'education');
  instance.state.lang = 'ar';
  instance.renderVals().cityDirectory.search({ target: { value: 'University' } });
  assert.match(instance.renderVals().cityDirectory.rows[0].label, /[\u0600-\u06ff]/);
  instance.renderVals().cityDirectory.search({ target: { value: 'Church' } });
  assert.equal(instance.renderVals().cityDirectory.rows.length, 0);
  const disabled = game({ manifest: { modules: { market: false } } });
  disabled.instance.renderVals().cityDirectory.search({ target: { value: 'pawnshop' } });
  assert.equal(disabled.instance.renderVals().cityDirectory.rows.length, 0);
});

test('navigation maintains deep links, locale and browser back without duplicate history entries', () => {
  const { instance, history, location, listeners } = game({ route: '?screen=market&lang=en' }); instance.componentDidMount();
  assert.equal(instance.state.screen, 'market');
  instance.go('items'); assert.equal(location.searchParams.get('screen'), 'items'); assert.equal(history.length, 1);
  instance.go('items'); assert.equal(history.length, 1);
  instance.renderVals().toggleLang(); assert.equal(location.searchParams.get('lang'), 'ar'); assert.equal(history.at(-1).method, 'replaceState');
  const count = history.length;
  location.href = 'http://zone.test/?screen=market&lang=en'; listeners.popstate();
  assert.equal(instance.state.screen, 'market'); assert.equal(instance.state.lang, 'en'); assert.equal(history.length, count);
});

test('reload keeps cached merchant stock and NPC lists while the authoritative snapshot loads', () => {
  const session = game().instance; session.applyServerPlayer({ cash: 2500, max_energy: 150 });
  const save = session.p;
  save.market = [{ id: 'drink', item: 'drink', price: 990, base: 990, qty: 39, seller: 'Sami' }]; save.inmates = []; save.patients = [];
  const { instance } = game({ liveSave: save });
  assert.equal(instance.renderVals().market[0].qty, 39); assert.equal(instance.renderVals().inmates.length, 0); assert.equal(instance.renderVals().patients.length, 0);
});

test('known backend errors remain readable in Arabic and preserve English detail in English', () => {
  const { instance } = game();
  const messages = ['Not enough cash.', 'Not enough energy.', 'Not enough nerve.', 'Gameplay changed. Refresh before acting.', 'You do not own this item.', 'Resources already full.', 'Mission already claimed.', 'Leave jail or hospital first.', 'A course is already active.', 'Gym is locked.', 'Module unavailable.', 'Failed to fetch'];
  for (const message of messages) {
    assert.equal(instance.serverError(new Error(message)), message);
    instance.state.lang = 'ar'; const translated = instance.serverError(new Error(message));
    assert.match(translated, /[\u0600-\u06ff]/); assert.doesNotMatch(translated, /[a-z]/i);
    instance.state.lang = 'en';
  }
});

test('runtime polling applies a changed publication once without reloading and retains the last state offline', async () => {
  const runtime = readFileSync(resolve(root, 'platform-runtime.js'), 'utf8');
  const events = [], storage = new Map(), tokens = {}, listeners = {}; let reloads = 0, calls = 0, offline = false;
  const remote = { release: { id: 'release-2', version: 2, manifest: { schemaVersion: 1, branding: { accent: '#123456' }, modules: { casino: false } } }, content: { crimes: [{ id: 'published' }], activeTheme: 'zone-dark' } };
  const context = createContext({ URLSearchParams, console, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    location: { search: '', reload() { reloads++; } },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    document: { documentElement: { dataset: {}, style: { setProperty(key, value) { tokens[key] = value; } } }, visibilityState: 'visible' },
    window: { dispatchEvent(event) { events.push(event); } }, addEventListener(name, callback) { listeners[name] = callback; }, setInterval() {},
    fetch: async () => { calls++; if (offline) throw new Error('Network unavailable'); return { ok: true, json: async () => remote }; },
  });
  runInContext(runtime, context); const platform = context.window.ZonePlatform;
  await Promise.all([platform.refresh(), platform.refresh()]); assert.equal(calls, 1); assert.equal(platform.active().version, 2);
  assert.equal(events[0].detail.changed, true); assert.equal(tokens['--acc'], '#123456');
  await platform.refresh(); assert.equal(events.at(-1).detail.changed, false); assert.equal(reloads, 0);
  offline = true; await assert.rejects(platform.refresh(), /Network/);
  assert.equal(platform.status(), 'offline'); assert.equal(platform.active().version, 2); assert.equal(events.at(-1).detail.changed, false); assert.equal(reloads, 0);
});

test('travel debits only the server fare and waits for server arrival across reloads', async () => {
  const trip = { origin: 'Zone City', destination: 'Dubai', departedAt: new Date(1800000).toISOString(), arrivesAt: new Date(3600000).toISOString(), status: 'traveling', remainingSeconds: 1800, version: 1 };
  const { instance, calls } = game({ fetchImpl: async () => ({ ok: true, json: async () => ({ player: { cash: 7500, city: 'Zone City' }, travel: trip }) }) });
  instance.applyGameplay({ player: { cash: 10000, city: 'Zone City' }, state: { version: 1 }, travel: null });
  assert.equal(instance.travelReady, true);
  await instance.travel('Dubai'); await instance.travel('Cairo');
  assert.equal(calls.length, 1); assert.equal(instance.p.cash, 7500); assert.equal(instance.p.city, 'Zone City');
  assert.equal(instance.renderVals().travelStatus.left, '30:00'); assert.ok(instance.renderVals().travelDests.every(city => city.disabled));
  assert.doesNotMatch(instance.state.toast.text, /Arrived/);
  const restored = game({ now: 1860000, liveSave: instance.p });
  assert.equal(restored.instance.renderVals().travelStatus.left, '29:00');
  const arrived = game({ now: 3660000, liveSave: instance.p, fetchImpl: async () => ({ ok: true, json: async () => ({ player: { cash: 7500, city: 'Dubai' }, travel: { ...trip, status: 'arrived', remainingSeconds: 0 } }) }) });
  assert.equal(arrived.instance.p.city, 'Zone City'); assert.match(arrived.instance.renderVals().travelStatus.left, /Confirming/);
  await arrived.instance.loadTravel(); assert.equal(arrived.instance.p.city, 'Dubai'); assert.equal(arrived.instance.renderVals().travelStatus.active, false);
  arrived.instance.applyTravel(trip); assert.equal(arrived.instance.p.travel.status, 'arrived');
});

test('a gameplay read started before departure cannot erase an active journey', async () => {
  let settle;
  const { instance } = game({ fetchImpl: () => new Promise(resolve => { settle = resolve; }) });
  const pending = instance.loadGameplay();
  instance.applyTravel({ version: 1, status: 'traveling', destination: 'Cairo', remainingSeconds: 1800 });
  settle({ ok: true, json: async () => ({ state: { version: 2 }, travel: null }) }); await pending;
  assert.equal(instance.p.travel.destination, 'Cairo');
});

test('restored combat shows the current server health rather than an old combat log', () => {
  const { instance } = game();
  instance.applyCombat({ version: 4, player: { life: 750 }, encounter: { opponentId: 'rayan', phase: 'fighting', turn: 1, startPlayerHp: 900, playerMaxHp: 1000, playerHp: 750, enemyHp: 70, enemyMaxHp: 100, log: [{ n: 1, side: 'you', d: 200, yl: 600, ol: 70 }] } });
  const view = instance.renderVals().fight; assert.equal(view.paused, true); assert.equal(view.youLife, '750'); assert.equal(view.youPct, 75);
});

test('territory actions apply server energy and refresh map plus wallet after stale versions', async () => {
  const blocks = Array.from({ length: 120 }, (_, i) => ({ id: 'ZC-' + String(i + 1).padStart(3, '0'), version: 1, action: 'capture' }));
  let stale = false;
  const { instance, calls } = game({ fetchImpl: async (path, options) => options?.method === 'POST'
    ? stale ? { ok: false, status: 409, json: async () => ({ error: 'Territory changed. Refresh first.' }) } : { ok: true, json: async () => ({ player: { energy: 90 }, map: { blocks, revision: 2 } }) }
    : { ok: true, json: async () => path.includes('city/map') ? { blocks: blocks.map(block => ({ ...block, version: 3 })), revision: 3 } : { player: { energy: 75, cash: 4500 } } } });
  instance.gameplayReady = true; instance.territoryMap = { blocks, revision: 1 }; instance.applyServerPlayer({ energy: 100 });
  await instance.territoryAction({ blockId: 'ZC-001', action: 'capture' }); assert.equal(instance.cur('energy'), 90);
  stale = true; await instance.territoryAction({ blockId: 'ZC-001', action: 'capture' });
  assert.equal(instance.cur('energy'), 75); assert.equal(instance.p.cash, 4500); assert.equal(instance.territoryMap.revision, 3);
  assert.equal(calls.filter(call => call.options?.method === 'POST').length, 2);
});

test('rendering saved faction progress never creates a war timer or resets the persisted chain', () => {
  const { instance } = game(); instance.p.fac.warEnd = 0; instance.p.fac.chain = 5; instance.p.fac.chainAt = 0;
  const before = JSON.stringify(instance.p); const view = instance.renderVals();
  assert.equal(view.fac.chain, 0); assert.equal(instance.p.fac.chain, 5); assert.equal(instance.p.fac.warEnd, 0); assert.equal(JSON.stringify(instance.p), before);
});

test('hospital shows the authoritative discounted quote even when hospitalized at full life', async () => {
  const { instance, calls } = game({ fetchImpl: async (path, options) => ({ ok: true, json: async () => options?.method === 'POST' ? { player: { cash: 750, life: 100 }, cost: { cash: 250 } } : { player: { cash: 750, life: 100 }, state: { version: 2, hospUntil: 0 }, hospitalQuote: { cost: 0, available: false } } }) });
  instance.applyGameplay({ player: { cash: 1000, life: 100, max_life: 100 }, state: { version: 1, hospUntil: 2000000 }, hospitalQuote: { cost: 250, baseCost: 500, missing: 0, hospitalized: true, available: true, territoryDiscountBasisPoints: 5000 } });
  const view = instance.renderVals(); assert.match(view.status.healLabel, /\$250/); assert.equal(view.status.healDisabled, false);
  await view.hospitalCare.heal(); assert.equal(instance.p.cash, 750); assert.equal(instance.p.hospUntil, 0); assert.equal(instance.renderVals().hospitalCare.disabled, true);
  assert.equal(calls.filter(call => call.options?.method === 'POST').length, 1); assert.equal(calls[0].path, '/api/v1/hospital/heal');
});

test('city and faction refresh on entry and visible sixty-second polls, never in a hidden tab', () => {
  const { instance, intervals, context } = game(); let reads = 0; instance.loadTerritories = () => { reads++; };
  instance.componentDidMount(); assert.equal(reads, 1);
  instance.go('city'); assert.equal(reads, 2); instance.go('faction'); assert.equal(reads, 3);
  instance.state.tick = 30; intervals[0](); assert.equal(reads, 3);
  instance.state.tick = 60; intervals[0](); assert.equal(reads, 4);
  context.document.visibilityState = 'hidden'; instance.state.tick = 120; intervals[0](); assert.equal(reads, 4);
  context.document.visibilityState = 'visible';
  instance.go('home'); instance.state.tick = 60; intervals[0](); assert.equal(reads, 4);
});

test('merchant discounts are server quotes and player net worth uses saved assets', () => {
  const { instance } = game();
  instance.applyGameplay({ player: { cash: 1000, bank_balance: 2000 }, state: { version: 1, inv: { knife: 2 }, ownedProperties: { apt: 1 }, market: [{ item: 'drink', price: 911, base: 990, qty: 2, discountBasisPoints: 800 }] } });
  assert.equal(instance.netWorth(), 158200); assert.match(instance.renderVals().marketDiscount, /8%/); assert.equal(instance.renderVals().market[0].price, '$911');
  instance.market[0].discountBasisPoints = 0; assert.equal(instance.renderVals().marketDiscount, '');
});

test('the actual server catalogs produce all19 screen views in both languages', () => {
  const catalogs = JSON.parse(readFileSync(resolve(root, 'engine/data/gameplay-catalog.json'), 'utf8'));
  const { instance, SCREENS } = game(); instance.applyGameplay({ player: { level: 12, strength: 240, defense: 180, speed: 210, dexterity: 165 }, state: { version: 1 }, catalogs });
  for (const lang of ['en', 'ar']) for (const screen of SCREENS) { instance.state.lang = lang; instance.state.screen = screen; assert.equal(instance.renderVals().is[screen], true); }
  assert.equal(instance.renderVals().opps[0].str, String(catalogs.opponents[0].str));
});

test('fresh clients disable mutations and direct handlers never send a POST before gameplay hydration', async () => {
  const { instance, T, calls } = game({ fetchImpl: async () => { throw new Error('Offline'); } });
  const view = instance.renderVals(); assert.ok(view.opps.every(opponent => opponent.disabled)); assert.equal(view.trainOff, true); assert.equal(view.job.disabled, true); assert.ok(view.market.every(item => item.disabled));
  instance.casinoReady = true;
  await Promise.all([instance.train('str', T.en), instance.work(T.en), instance.commitManaged({ id: 'trash' }, T.en), instance.combatAction('start', { opponentId: 'rayan' }), instance.casinoGuess(true, T.en), instance.gameplayAction('item.buy', 'knife'), instance.bankMove('deposit', 100, T.en), instance.healSelf(T.en), instance.travel('Cairo'), instance.territoryAction({ blockId: 'ZC-001', action: 'capture' })]);
  assert.ok(calls.every(call => call.options?.method !== 'POST'));
  instance.applyGameplay({ player: { energy: 150 }, state: { version: 1 } }); assert.equal(instance.renderVals().job.disabled, false);
});

test('reload shows the last server catalog immediately but keeps actions locked until fresh hydration', () => {
  const { instance } = game();
  const catalogs = JSON.parse(readFileSync(resolve(root, 'engine/data/gameplay-catalog.json'), 'utf8'));
  catalogs.opponents[0].str = 123;
  instance.applyGameplay({ player: { cash: 2500, max_energy: 150 }, state: { version: 1 }, catalogs });
  const restored = game({ liveSave: instance.p }).instance;
  assert.equal(restored.renderVals().opps[0].str, '123'); assert.equal(restored.renderVals().opps[0].disabled, true); assert.equal(restored.gameplayReady, undefined);
});

test('an active course visibly disables other enrollments until the server completes it', () => {
  const { instance, T } = game();
  instance.applyGameplay({ player: { cash: 100000 }, state: { version: 1, edu: { id: 'bio', until: 3000000, total: 1200000 }, eduDone: {} } });
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang; const courses = instance.renderVals().courses;
    assert.ok(courses.every(course => course.disabled && course.fg === 'var(--mu)'));
    assert.equal(courses.filter(course => course.btn === T[lang].studying).length, 1);
    assert.ok(courses.every(course => course.bg === courses[0].bg));
  }
  instance.applyGameplay({ state: { version: 2, edu: null, eduDone: { bio: 1 } } });
  assert.ok(instance.renderVals().courses.some(course => !course.disabled && course.fg === 'var(--onAcc)'));
});

test('map fallback is explicitly illustrative until a genuine engine snapshot is received', async () => {
  const { instance, messages } = game();
  instance.pushMap();
  const fallback = messages.at(-1).data;
  assert.equal(fallback.territoryDataSource, 'bundled');
  assert.equal(fallback.territoryAuthoritative, false);
  assert.equal(fallback.playerFactionId, null, 'a bundled district never grants family membership');
  assert.equal(instance.renderVals().members.length, 0, 'fictional members never become the visitors live roster');
  await instance.loadTerritories();
  const live = messages.at(-1).data;
  assert.equal(live.territoryDataSource, 'server');
  assert.equal(live.territoryAuthoritative, true);
});

test('map benefit activity survives the parent payload for active and planned benefits', () => {
  const { instance, messages } = game();
  instance.territoryMap = { revision: 7, blocks: [true, false].map((active, i) => ({ id: 'ZC-00' + (i + 1), benefits: [{ key: 'medical_discount', name: { en: 'Medical network', ar: 'شبكة طبية' }, value: 500, unit: 'basis_points', active }] })) };
  instance.pushMap(); const payload = messages.find(message => message.data.type === 'ZONE_MAP_DATA').data;
  assert.equal(payload.blocks[0].benefit.active, true); assert.equal(payload.blocks[1].benefit.active, false);
  assert.equal(payload.blocks[0].benefit.value, 500); assert.equal(payload.blocks[0].benefit.label, 'Medical network');
});

test('known offline status disables saved gameplay controls and rejects writes until reconnection', async () => {
  const { instance, calls, T } = game();
  instance.applyGameplay({ player: { cash: 100000, energy: 100, nerve: 45 }, state: { version: 1, inv: { bat: 1 }, equip: 'bat' } });
  instance.runtimeConnection = 'offline';
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang;
    const view = instance.renderVals();
    assert.ok(view.crimes.every(row => row.disabled));
    assert.equal(instance.gameplayDisabled(), true);
    await instance.commitManaged({ id: 'trash' }, T[lang]);
  }
  assert.equal(calls.filter(call => call.options?.method === 'POST').length, 0);
  instance.runtimeConnection = 'connected';
  instance.gameplayError = 'Network unavailable';
  assert.equal(instance.gameplayDisabled(), true, 'failed gameplay reads also gate an otherwise connected platform');
  assert.ok(instance.renderVals().crimes.every(row => row.disabled));
  await instance.commitManaged({ id: 'trash' }, T.en);
  assert.equal(calls.filter(call => call.options?.method === 'POST').length, 0);
  instance.gameplayError = '';
  assert.equal(instance.gameplayDisabled(), false);
  assert.equal(instance.allowGameplay(), true);
});

test('travel disables gameplay controls while navigation, themes, and item inspection remain usable', () => {
  const { instance } = game();
  instance.applyGameplay({ player: { cash: 100000 }, state: { version: 1, inv: { bat: 1 }, equip: 'bat' }, travel: { version: 1, destination: 'Dubai', status: 'traveling', remainingSeconds: 1800 } });
  instance.applyCombat({ version: 1, encounter: { opponentId: 'rayan', phase: 'fighting', turn: 0, playerHp: 100, enemyHp: 100, enemyMaxHp: 100, playerMaxHp: 100, log: [] } });
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang; const view = instance.renderVals();
    for (const key of ['crimes','gyms','opps','upgrades','inv','jobs','market','missions','courses','props','inmates','patients','travelDests']) assert.ok(view[key].every(item => item.disabled), `${lang}/${key}`);
    assert.ok(view.inmates.every(item => item.bailDisabled)); assert.ok([...view.bank.deposits, ...view.bank.withdrawals].every(item => item.disabled));
    assert.equal(view.trainOff, true); assert.equal(view.job.disabled, true); assert.equal(view.casino.disabled, true); assert.equal(view.hospitalCare.disabled, true);
    assert.equal(view.fight.disabled, true); assert.equal(view.fight.canFinish, false); assert.equal(view.travelStatus.active, true);
    assert.match(view.travelStatus.notice, lang === 'en' ? /arrival is confirmed/ : /تأكيد الوصول/);
  }
  instance.go('items'); assert.equal(instance.state.screen, 'items');
  const view = instance.renderVals(), beforeTheme = instance.state.theme; view.toggleTheme(); assert.notEqual(instance.state.theme, beforeTheme);
  view.inv.at(-1).select(); assert.equal(instance.renderVals().sel.name, view.inv.at(-1).name);
  view.outfits[1].go(); assert.equal(instance.state.outfit, 'suit');
});

test('direct mutations stay blocked at zero travel time until authoritative arrival confirmation', async () => {
  const { instance, T, calls } = game();
  instance.applyGameplay({ player: { energy: 150 }, state: { version: 1 }, travel: { version: 1, destination: 'Dubai', status: 'traveling', remainingSeconds: 0 } });
  const before = JSON.stringify(instance.p);
  await Promise.all([instance.train('str', T.en), instance.work(T.en), instance.commitManaged({ id: 'trash' }, T.en), instance.combatAction('start', { opponentId: 'rayan' }), instance.casinoGuess(true, T.en), instance.gameplayAction('item.buy', 'knife'), instance.bankMove('deposit', 100, T.en), instance.healSelf(T.en), instance.travel('Cairo'), instance.territoryAction({ blockId: 'ZC-001', action: 'capture' })]);
  assert.equal(calls.length, 0); assert.equal(JSON.stringify(instance.p), before); assert.equal(instance.renderVals().job.disabled, true);
  assert.match(instance.state.toast.text, /arrival is confirmed/); assert.match(instance.renderVals().travelStatus.left, /Confirming arrival/);
  instance.applyTravel({ version: 1, status: 'arrived', destination: 'Dubai', remainingSeconds: 0 });
  assert.equal(instance.allowGameplay(), true); assert.equal(instance.renderVals().job.disabled, false);
});

test('map actions update their transit eligibility without a territory revision change', () => {
  const { instance, messages } = game(); instance.gameplayReady = true;
  instance.territoryMap = { revision: 7, blocks: [{ id: 'ZC-001', action: 'capture' }] };
  instance.pushMap(); assert.equal(messages.at(-1).data.blocks[0].canAct, true);
  instance.applyTravel({ version: 1, status: 'traveling', remainingSeconds: 1800 }); instance.pushMap();
  assert.equal(messages.at(-1).data.blocks[0].canAct, false); assert.equal(messages.at(-1).data.blocks[0].eligible, false);
  instance.applyTravel({ version: 1, status: 'arrived', remainingSeconds: 0 }); instance.pushMap();
  assert.equal(messages.at(-1).data.blocks[0].canAct, true); assert.equal(messages.filter(message => message.data.type === 'ZONE_MAP_DATA').length, 3);
});

test('market purchases guard the displayed quote and refresh a changed price without retrying', async () => {
  const { instance, calls } = game({ fetchImpl: async (path, options) => options?.method === 'POST'
    ? { ok: false, status: 409, json: async () => ({ error: 'The market price changed. Refresh and try again.' }) }
    : { ok: true, json: async () => ({ player: { cash: 2000 }, state: { version: 7, inv: { drink: 2 }, market: [{ item: 'drink', price: 990, qty: 40, discountBasisPoints: 0 }] }, catalogs: { items: { drink: { type: 'booster', price: 990 } } } }) } });
  instance.state.lang = 'ar';
  instance.applyGameplay({ player: { cash: 2000 }, state: { version: 7, inv: { drink: 2 }, market: [{ item: 'drink', price: 911, qty: 40, discountBasisPoints: 800 }] } });
  const displayedRow = instance.renderVals().market[0]; assert.equal(displayedRow.price, '$911');
  // Even an in-place quote update cannot alter the price captured by the visible Buy control.
  instance.market[0].price = 990;
  await displayedRow.buy();
  const requests = calls.filter(call => call.options?.method === 'POST'); assert.equal(requests.length, 1);
  assert.deepEqual(JSON.parse(requests[0].options.body), { action: 'market.buy', id: 'drink', expectedVersion: 7, expectedPrice: 911 });
  assert.ok(calls.some(call => call.path === '/api/v1/gameplay' && !call.options?.method));
  assert.equal(instance.p.cash, 2000); assert.equal(instance.p.inv.drink, 2); assert.equal(instance.gameplayVersion, 7);
  assert.equal(instance.renderVals().market[0].price, '$990'); assert.equal(instance.p.catalogs.items.drink.price, 990);
  assert.match(instance.state.toast.text, /تغير سعر السوق/); assert.match(instance.serverError(new Error('Market price changed. Refresh and try again.')), /تغير سعر السوق/);
});

test('published catalog names and values update without reload and rollback restores original catalog names', async () => {
  const { instance, T } = game(); instance.componentDidMount(); await instance._gameplayLoad;
  const original = JSON.parse(readFileSync(resolve(root, 'engine/data/gameplay-catalog.json'), 'utf8'));
  instance.applyCatalogs(original);
  const changed = structuredClone(original), baseline = JSON.parse(JSON.stringify(T));
  const labels = { items: 'items', jobs: 'jobNames', gyms: 'gyms', courses: 'courses', properties: 'props', upgrades: 'up', opponents: 'opp', missions: 'ms' };
  const keys = {};
  for (const [category, label] of Object.entries(labels)) {
    const record = category === 'items' ? Object.values(changed.items)[0] : changed[category][0];
    keys[category] = category === 'items' ? Object.keys(changed.items)[0] : category === 'gyms' ? '0' : record.id;
    record.name = { en: 'Published ' + category, ar: 'منشور ' + category };
  }
  changed.jobs[0].pay = 1234;
  instance.onRuntime({ detail: { changed: true, release: { version: 2, manifest: {} }, content: { gameplayCatalog: changed } } });
  for (const [category, label] of Object.entries(labels)) for (const lang of ['en', 'ar']) {
    const value = T[lang][label][keys[category]], name = Array.isArray(value) ? value[0] : value;
    assert.equal(name, (lang === 'en' ? 'Published ' : 'منشور ') + category, `${lang}/${category}`);
  }
  instance.state.lang = 'en'; assert.equal(instance.renderVals().jobs[0].name, 'Published jobs'); assert.match(instance.renderVals().jobs[0].pay, /1,234/);
  instance.onRuntime({ detail: { changed: true, release: { version: 1, manifest: {} }, content: { gameplayCatalog: original } } });
  for (const [category, label] of Object.entries(labels)) for (const lang of ['en', 'ar']) assert.equal(JSON.stringify(T[lang][label][keys[category]]), JSON.stringify(baseline[lang][label][keys[category]]), `${lang}/${category} fallback`);
  assert.equal(instance.p.catalogs.jobs[0].pay, original.jobs[0].pay);
});

test('hydrated and rolled-back catalogs retain all extended armory display names', () => {
  const { instance, CAT, T } = game();
  const catalogs = JSON.parse(readFileSync(resolve(root, 'engine/data/gameplay-catalog.json'), 'utf8'));
  instance.applyGameplay({ state: { version: 1, inv: { assaultrifle2_1: 1 } }, catalogs });
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang;
    for (const id of Object.keys(CAT)) assert.ok(T[lang].items[id], `${lang}/${id}`);
    assert.ok(instance.renderVals().inv[0].name);
    instance.state.itemTab = 'armory'; assert.ok(instance.renderVals().inv.every(item => item.name));
    instance.state.itemTab = 'all';
  }
});

test('Admin-authored weapons and consumables appear in a purchasable store and disappear safely on rollback', async () => {
  const { instance, calls, messages } = game();
  const original = JSON.parse(readFileSync(resolve(root, 'engine/data/gameplay-catalog.json'), 'utf8'));
  const authored = structuredClone(original);
  authored.items['omar-blade'] = { type: 'weapon', price: 100, mult: 1.4, model: 'knife', name: { en: 'Omar Blade', ar: 'نصل عمر' } };
  authored.items['omar-kit'] = { type: 'medical', price: 50, life: 20, name: { en: 'Omar Kit', ar: 'حقيبة عمر' } };
  instance.applyGameplay({ player: { cash: 1000 }, state: { version: 1, inv: { smallkit: 1 } }, catalogs: authored });
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang; instance.state.itemTab = 'store';
    const rows = instance.renderVals().inv;
    assert.ok(rows.some(item => item.name === authored.items['omar-blade'].name[lang] && !item.disabled));
    assert.ok(rows.some(item => item.name === authored.items['omar-kit'].name[lang] && !item.disabled));
    instance.state.itemTab = 'armory';
    assert.ok(instance.renderVals().inv.some(item => item.name === authored.items['omar-blade'].name[lang]));
  }
  instance.state.lang = 'en'; instance.state.itemTab = 'store';
  await instance.renderVals().inv.find(item => item.name === 'Omar Blade').act();
  assert.deepEqual(JSON.parse(calls.find(call => call.options?.method === 'POST').options.body), { action: 'item.buy', id: 'omar-blade', expectedVersion: 1 });
  instance.applyGameplay({ player: { cash: 900 }, state: { version: 2, inv: { smallkit: 1, 'omar-blade': 1 }, equip: 'omar-blade' }, catalogs: authored });
  instance.state.itemTab = 'all'; instance.state.sel = 'omar-blade';
  instance.pushChar(); instance.push3d();
  assert.equal(instance.p.equip, 'omar-blade', 'model selection never changes authoritative equipment ownership');
  assert.equal(messages.filter(message => message.id === 'zone-char-3d').at(-1).data.character.weapon, 'knife', 'character receives the fitted model, not the custom item ID');
  assert.equal(messages.filter(message => message.id === 'zone-item-3d').at(-1).data.item, 'knife', 'inventory inspector receives the same registered model');
  instance.applyGameplay({ state: { version: 3 }, catalogs: original });
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang; instance.state.itemTab = 'all';
    assert.ok(instance.renderVals().inv.some(item => item.name === authored.items['omar-blade'].name[lang] && item.disabled));
    instance.state.itemTab = 'store';
    assert.ok(instance.renderVals().inv.every(item => !/omar-blade|Omar Blade|نصل عمر/.test(item.name)));
  }
});

test('family emblem template never makes a literal interpolation URL request before hydration', () => {
  assert.doesNotMatch(html, /<img[^>]+src="\{\{ fac\.emblem \}\}"/);
  assert.match(html, /class="zone-family-emblem" role="img" aria-label="\{\{ fac\.name \}\}"/);
});

test('family join coalesces pending clicks, uses the authoritative roster and never retries a rejected write', async () => {
  let settle;
  const { instance, calls } = game({ fetchImpl: async (path, options) => options?.method === 'POST'
    ? new Promise(resolve => { settle = resolve; })
    : { ok: true, json: async () => path.includes('gameplay') ? { state: { version: 1 } } : ({ playerFactionId: null, factions: [], members: [], blocks: Array.from({ length: 120 }, (_, i) => ({ id: String(i) })) }) } });
  instance.gameplayReady = true; instance.territoryMap = { playerFactionId: null, factions: [], members: [], blocks: [] };
  const pending = instance.joinFaction('vipers'); await instance.joinFaction('kings');
  assert.equal(instance.factionBusy, true); assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(calls[0].options.body), { factionId: 'vipers' });
  settle({ ok: true, json: async () => ({ map: { playerFactionId: 'vipers', playerFactionRole: 'member', factions: [{ id: 'vipers', name: { en: 'Sand Vipers', ar: 'أفاعي الرمال' } }], members: [{ username: 'Actual player', level: 2, role: 'leader' }], blocks: [] } }) });
  await pending;
  assert.equal(instance.factionBusy, false); assert.equal(instance.renderVals().factionJoin.visible, false);
  assert.equal(instance.renderVals().members[0].name, 'Actual player'); assert.equal(instance.renderVals().members[0].role, 'Leader');
  instance.territoryMap.playerFactionId = null;
  const rejected = instance.joinFaction('kings'); settle({ ok: false, json: async () => ({ error: 'Already joined.' }) }); await rejected;
  assert.equal(calls.filter(call => call.options?.method === 'POST').length, 2);
  assert.ok(calls.some(call => call.path === '/api/v1/city/map' && !call.options?.method));
  assert.equal(instance.factionBusy, false);
});

test('family recruitment respects preview, membership, connection and transit guards', async () => {
  for (const guard of ['preview', 'membership', 'connection', 'travel']) {
    const { instance, calls } = game({ preview: guard === 'preview' }); instance.gameplayReady = true;
    instance.territoryMap = { playerFactionId: guard === 'membership' ? 'vipers' : null, factions: [], blocks: [] };
    if (guard === 'connection') instance._territoryUnavailable = true;
    if (guard === 'travel') instance.p.travel = { status: 'traveling' };
    await instance.joinFaction('vipers'); assert.equal(calls.length, 0, guard);
  }
});

test('live Hall of Fame loads server standings without fictional players or invented net worth', async () => {
  const { instance, calls } = game({ fetchImpl: async () => ({ ok: true, json: async () => ({ rows: [{ rank: 1, username: 'Real account', level: 3, totalStats: 123, liquidFunds: 456, family: { name: { en: 'Real family', ar: 'عائلة حقيقية' } }, isCurrentPlayer: true }] }) }) });
  assert.deepEqual(Array.from(instance.renderVals().hof), []);
  await Promise.all([instance.loadLeaderboards(), instance.loadLeaderboards()]); assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/v1/leaderboards'); assert.equal(calls[0].options.cache, 'no-store');
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang; const view = instance.renderVals(); assert.equal(view.hof.length, 1);
    assert.equal(view.hof[0].name, 'Real account'); assert.equal(view.hof[0].nw, '$456');
    assert.equal(view.hof[0].fac, lang === 'ar' ? 'عائلة حقيقية' : 'Real family');
  }
});

test('failed standings clear stale rows and preview cannot read the live leaderboard', async () => {
  const { instance } = game({ fetchImpl: async () => ({ ok: false, json: async () => ({ error: 'Offline' }) }) });
  instance.leaderboard = { rows: [{ username: 'Stale account' }] }; await instance.loadLeaderboards();
  assert.equal(instance.renderVals().hof.length, 0); assert.match(instance.renderVals().leaderboard.message, /unavailable/);
  const preview = game({ preview: true }); await preview.instance.loadLeaderboards(); assert.equal(preview.calls.length, 0);
});

const sharedFamilyFixture = () => ({ id: 'vipers', name: { en: 'Sand Vipers', ar: 'أفاعي الرمال' }, role: 'leader', respect: 8000, version: 3, permissions: { contribute: true, buyUpgrade: true }, upgrades: {}, upgradeEligibility: [{ id: 'gymBoost', cost: 5000, eligible: true, reason: null }], ledger: [{ username: 'Player_beta', delta: 100, balance: 8000, reason: 'contribution', at: '2026-10-09T08:00:00Z' }] });
const onboardingFixture = () => ({ currentMissionId: 'c5', completed: false, steps: [{ missionId: 'c5', counter: 'crimes', target: 5, progress: 5, claimed: false, current: true, claimable: true, reason: null, cash: 5000, points: 5 }, { missionId: 't4', counter: 'trains', target: 4, progress: 0, claimed: false, current: false, claimable: false, reason: 'objective_incomplete', cash: 3000, points: 3 }] });

test('shared family and onboarding hydrate from server and reject older player snapshots', () => {
  const { instance } = game();
  instance.applyGameplay({ player: { cash: 2500 }, state: { version: 7, fac: { respect: 6000, ups: {} } }, family: sharedFamilyFixture(), onboarding: onboardingFixture() });
  instance.applyGameplay({ state: { version: 6 }, family: null, onboarding: null });
  assert.equal(instance.sharedFamily.respect, 8000); assert.equal(instance.onboarding.currentMissionId, 'c5');
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang; const view = instance.renderVals();
    assert.equal(view.sharedFamily.visible, true); assert.equal(view.sharedFamily.upgrades[0].disabled, false);
    assert.equal(view.onboarding.current.progress, '5/5'); assert.equal(view.onboarding.current.disabled, false);
    assert.equal(view.onboarding.steps[1].disabled, true);
  }
  instance.applyGameplay({ state: { version: 8 }, family: null, onboarding: null });
  assert.equal(instance.renderVals().sharedFamily.visible, false); assert.equal(instance.renderVals().onboarding.visible, false);
});

test('family contributions and shared upgrades send displayed player and family versions', async () => {
  const family = sharedFamilyFixture();
  const { instance, calls } = game({ fetchImpl: async () => ({ ok: true, json: async () => ({ state: { version: 8, fac: { respect: 5900, ups: {} } }, family: { ...family, version: 4, respect: 8100 }, result: { success: true } }) }) });
  instance.applyGameplay({ state: { version: 7, fac: { respect: 6000, ups: {} } }, family });
  await instance.renderVals().sharedFamily.amounts[0].contribute();
  assert.deepEqual(JSON.parse(calls.find(call => call.options?.method === 'POST').options.body), { action: 'faction.contribute', id: '100', expectedVersion: 7, expectedPrice: 3 });
  assert.equal(instance.sharedFamily.respect, 8100); assert.equal(instance.p.fac.respect, 5900);
  assert.match(instance.renderVals().log[0].text, /Contributed 100 family respect/);
  instance.state.lang = 'ar'; assert.match(instance.renderVals().log[0].text, /احترام للعائلة/);
  await instance.renderVals().sharedFamily.upgrades[0].buy();
  assert.deepEqual(JSON.parse(calls.filter(call => call.options?.method === 'POST')[1].options.body), { action: 'faction.sharedUpgrade', id: 'gymBoost', expectedVersion: 8, expectedPrice: 4 });
});

test('family controls honor server permission, funds, recovery and offline state', () => {
  const { instance } = game(); const family = sharedFamilyFixture();
  instance.applyGameplay({ state: { version: 1, fac: { respect: 500, ups: {} } }, family: { ...family, permissions: { contribute: true, buyUpgrade: false }, upgradeEligibility: [{ id: 'gymBoost', cost: 5000, eligible: false, reason: 'leader_required' }] } });
  let view = instance.renderVals(); assert.equal(view.sharedFamily.amounts[0].disabled, false); assert.equal(view.sharedFamily.amounts[1].disabled, true); assert.equal(view.sharedFamily.upgrades[0].disabled, true);
  assert.match(view.sharedFamily.upgrades[0].reason, /Leader or officer/);
  instance.p.hospUntil = Date.now() + 2000000; assert.ok(instance.renderVals().sharedFamily.amounts.every(row => row.disabled));
  instance.p.hospUntil = 0; instance.gameplayError = 'Connection unavailable';
  assert.ok(instance.renderVals().sharedFamily.amounts.every(row => row.disabled)); assert.ok(instance.renderVals().sharedFamily.upgrades.every(row => row.disabled));
});

test('a stale family write refreshes shared balance and never retries the mutation', async () => {
  const { instance, calls } = game({ fetchImpl: async (path, options) => options?.method === 'POST' ? { ok: false, status: 409, json: async () => ({ error: 'Family changed. Refresh before acting.' }) } : { ok: true, json: async () => ({ state: { version: 9 }, family: { ...sharedFamilyFixture(), version: 5, respect: 3000 } }) } });
  instance.applyGameplay({ state: { version: 7 }, family: sharedFamilyFixture() });
  await assert.rejects(instance.gameplayAction('faction.sharedUpgrade', 'gymBoost', 3), /Family changed/);
  assert.equal(instance.sharedFamily.respect, 3000); assert.equal(instance.sharedFamily.version, 5); assert.equal(calls.filter(call => call.options?.method === 'POST').length, 1);
});

test('saved onboarding points to real screens, claims only through mission action, and obeys recovery', async () => {
  const { instance, calls } = game(); instance.applyGameplay({ state: { version: 7 }, onboarding: onboardingFixture() });
  instance.go = route => { instance.state.screen = route; };
  let view = instance.renderVals(); view.onboarding.current.open(); assert.equal(instance.state.screen, 'crimes');
  await view.onboarding.current.claim(); assert.deepEqual(JSON.parse(calls.find(call => call.options?.method === 'POST').options.body), { action: 'mission.claim', id: 'c5', expectedVersion: 7 });
  instance.p.jailUntil = Date.now() + 2000000; assert.equal(instance.renderVals().onboarding.current.disabled, true);
  instance.p.jailUntil = 0; instance.gameplayError = 'Offline'; assert.equal(instance.renderVals().onboarding.current.disabled, true);
  instance.gameplayError = ''; instance.onboarding.steps[0].claimed = true; instance.onboarding.steps[0].claimable = false; instance.onboarding.steps[0].current = false; instance.onboarding.steps[1].current = true;
  assert.equal(instance.renderVals().onboarding.current.progress, '0/4');
});

test('live activities present actual events and honest availability instead of sample competitions', () => {
  const { instance } = game(); instance.applyGameplay({ state: { version: 1 } });
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang; let view = instance.renderVals();
    assert.equal(view.ticker.length, 1); assert.equal(view.ticker[0], view.bulletin.empty);
    assert.match(view.competition.reason, lang === 'en' ? /actual season standings/ : /ترتيب الموسم الحقيقي/);
    assert.match(view.casinoGuide.description, lang === 'en' ? /tie returns/ : /التعادل يعيد/);
    instance.state.screen = 'elimination'; view = instance.renderVals(); assert.match(view.subtitle, lang === 'en' ? /Weekly family/ : /الأسبوعي للعائلات/);
  }
  assert.doesNotMatch(html, /\{\{ fac\.warPct \}\}|\{\{ elim\.teams \}\}|\{\{ news \}\}|\{\{ casinoGames \}\}/);
});

test('all shared CSS icon and emblem URLs resolve from the actual assets stylesheet directory', () => {
  const { instance } = game();
  const cssHref = html.match(/href="\.\/assets\/zone-design\.css\?v=\d+"/)[0].slice(6, -1);
  const cssBase = new URL(cssHref, 'http://zone.test/?screen=home');
  const assetPath = value => new URL(value.replace(/^url\((.*)\)$/, '$1'), cssBase).pathname;
  for (const familyId of [null, 'vipers', 'kings', 'night', 'oldguard']) {
    instance.territoryMap.playerFactionId = familyId;
    const view = instance.renderVals();
    assert.equal(assetPath(view.fac.emblem), familyId ? `/assets/factions/${familyId}.svg` : '/assets/ui/icons/faction.svg');
    for (const entry of view.nav) assert.equal(assetPath(entry.iconImage), `/assets/ui/icons/${entry.id}.svg`);
    for (const [index, entry] of view.quick.entries()) assert.equal(assetPath(entry.iconImage), `/assets/ui/icons/${['crimes', 'gym', 'attack', 'missions'][index]}.svg`);
  }
  for (const stylesheet of ['assets/zone-design.css', 'assets/ui/account.css']) {
    const base = new URL('/' + stylesheet, 'http://zone.test');
    const css = readFileSync(resolve(root, stylesheet), 'utf8');
    for (const [, raw] of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) {
      if (raw.startsWith('#')) continue;
      const path = new URL(raw, base).pathname;
      assert.doesNotMatch(path, /\/assets\/assets\//, stylesheet + ':' + raw);
      assert.doesNotThrow(() => readFileSync(resolve(root, path.slice(1))), path);
    }
  }
});

test('crime receipts use published bilingual crime names and missing family leadership is explained', () => {
  const { instance } = game(); instance.componentDidMount();
  instance.onRuntime({ detail: { connection: 'connected', changed: true, release: { version: 2, manifest: {} }, content: { crimes: [{ id: 'search_for_cash', category: 'search', enabled: true, name_en: 'Search for cash', name_ar: 'ابحث عن النقود', nerve_cost: 2, cash_min: 1, cash_max: 2, success_basis_points: 8000 }] } } });
  instance.p.log = [{ k: 'crimeOk', a: { crime: 'search_for_cash', cash: '$20', xp: 1 }, kind: 'good', time: '12:00' }];
  instance.sharedFamily = { ...sharedFamilyFixture(), leadershipMissing: true, permissions: { contribute: true, buyUpgrade: false } };
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang; const view = instance.renderVals();
    assert.match(view.log[0].text, lang === 'en' ? /Search for cash/ : /ابحث عن النقود/); assert.doesNotMatch(view.ticker[0], /search_for_cash/);
    assert.match(view.sharedFamily.description, lang === 'en' ? /no assigned leader/ : /بلا زعيم/);
  }
});

test('first inventory hydration selects the equipped owned model and polls preserve a chosen owned item', () => {
  const { instance, messages, T } = game();
  const catalogs = JSON.parse(readFileSync(resolve(root, 'engine/data/gameplay-catalog.json'), 'utf8'));
  catalogs.items['omar-beta-blade'] = { type: 'weapon', price: 100, mult: 1.4, model: 'knife', name: { en: 'Omar Beta Blade', ar: 'نصل عمر التجريبي' } };
  instance.applyGameplay({ state: { version: 1, inv: { smallkit: 1, 'omar-beta-blade': 1 }, equip: 'omar-beta-blade' }, catalogs });
  assert.equal(instance.state.sel, 'omar-beta-blade');
  for (const lang of ['en', 'ar']) { instance.state.lang = lang; assert.equal(instance.renderVals().sel.name, catalogs.items['omar-beta-blade'].name[lang]); }
  instance.push3d(); assert.equal(messages.filter(message => message.id === 'zone-item-3d').at(-1).data.item, 'knife');
  instance.renderVals().inv.find(row => row.name === T.ar.items.smallkit).select();
  instance.applyGameplay({ state: { version: 2, inv: { smallkit: 1, 'omar-beta-blade': 1 }, equip: 'omar-beta-blade' } });
  assert.equal(instance.state.sel, 'smallkit', 'a poll cannot override the owned item the player selected');
  instance.applyGameplay({ state: { version: 3, inv: { smallkit: 0, 'omar-beta-blade': 1 }, equip: 'omar-beta-blade' } });
  assert.equal(instance.state.sel, 'omar-beta-blade', 'a consumed item falls back to actual owned equipment');
});

test('home equipment inspection opens the actual owned model without equipping or spending', () => {
  for (const lang of ['en', 'ar']) {
    const { instance, calls, messages } = game(); instance.state.lang = lang;
    instance.applyGameplay({ state: { version: 1, inv: { knife: 1, smallkit: 1 }, equip: 'knife' } });
    instance.state.itemTab = 'store'; instance.selectInventoryItem('revolver');
    const resources = () => JSON.stringify({ inv: instance.p.inv, cash: instance.p.cash, equip: instance.p.equip });
    const before = resources(), count = calls.filter(call => call.options?.method === 'POST').length;
    const inspection = instance.renderVals().equippedInspection;
    assert.equal(inspection.visible, true); inspection.open();
    assert.equal(instance.state.screen, 'items'); assert.equal(instance.state.itemTab, 'all');
    assert.equal(instance.state.sel, 'knife'); assert.equal(resources(), before);
    assert.equal(calls.filter(call => call.options?.method === 'POST').length, count);
    instance.push3d(); assert.equal(messages.filter(message => message.id === 'zone-item-3d').at(-1).data.item, 'knife');
    instance.p.inv.knife = 0; assert.equal(instance.renderVals().equippedInspection.visible, false);
    instance.p.equip = 'fists'; assert.equal(instance.renderVals().equippedInspection.visible, false);
  }
});

test('inventory selects the first owned item without owned equipment and preserves explicit store or armory inspection', () => {
  const { instance, T } = game();
  instance.applyGameplay({ state: { version: 1, inv: { smallkit: 1, drink: 1 }, equip: 'fists' } });
  assert.equal(instance.state.sel, 'smallkit');
  for (const [index, tab] of ['armory', 'store'].entries()) {
    instance.renderVals().itemTabs.find(entry => entry.name === T.en.itemTabs[tab]).go();
    instance.renderVals().inv.find(entry => entry.name === T.en.items.revolver).select();
    instance.applyGameplay({ state: { version: index + 2, inv: { smallkit: 1, drink: 1 }, equip: 'fists' } });
    assert.equal(instance.state.sel, 'revolver', tab + ' inspection remains intentionally unowned');
  }
  instance.renderVals().inventoryOwned();
  assert.equal(instance.state.sel, 'smallkit', 'returning to inventory restores an owned selection');
});

test('merchant inspection selects an unowned published item without buying or equipping and survives hydration', () => {
  for (const lang of ['en', 'ar']) {
    const { instance, calls, messages, CAT } = game(); instance.state.lang = lang;
    const catalogs = { items: JSON.parse(JSON.stringify(CAT)) };
    catalogs.items['inspect-blade'] = { type: 'weapon', price: 900, mult: 1.4, model: 'knife', name: { en: 'Inspection Blade', ar: 'نصل الفحص' } };
    const stock = [{ id: 'city-sale', item: 'inspect-blade', qty: 7, price: 675, seller: 'Real merchant' }];
    instance.applyGameplay({ state: { version: 1, inv: { smallkit: 1 }, equip: 'fists', market: stock }, catalogs });
    const before = JSON.stringify({ cash: instance.p.cash, inv: instance.p.inv, equip: instance.p.equip, market: instance.market });
    const row = instance.renderVals().market[0]; assert.equal(row.price, '$675'); assert.equal(row.qty, 7);
    row.inspect(); assert.equal(instance.state.screen, 'items'); assert.equal(instance.state.sel, 'inspect-blade');
    assert.equal(instance.state.itemTab, 'store'); assert.equal(instance.renderVals().sel.hasModel, true);
    assert.match(instance.renderVals().sel.source, /Real merchant/); assert.match(instance.renderVals().sel.source, /675/);
    instance.push3d(); assert.equal(messages.filter(message => message.id === 'zone-item-3d').at(-1).data.item, 'knife');
    instance.applyGameplay({ state: { version: 2, inv: { smallkit: 1 }, equip: 'fists', market: stock } });
    assert.equal(instance.state.sel, 'inspect-blade');
    assert.equal(JSON.stringify({ cash: instance.p.cash, inv: instance.p.inv, equip: instance.p.equip, market: instance.market }), before);
    assert.equal(calls.filter(call => call.options?.method === 'POST').length, 0);
  }
});

test('medical inspection uses honest category artwork and source labels distinguish inventory and catalog purchases', () => {
  for (const lang of ['en', 'ar']) {
    const { instance, calls, messages, T } = game(); instance.state.lang = lang;
    instance.applyGameplay({ state: { version: 1, inv: { knife: 1 }, equip: 'knife', market: [{ id: 'medical-sale', item: 'smallkit', qty: 4, price: 321, seller: 'Clinic' }] } });
    instance.renderVals().market[0].inspect(); const view = instance.renderVals();
    assert.equal(view.sel.hasModel, false); assert.equal(view.sel.artwork, '/assets/ui/icons/hospital.svg');
    assert.match(view.sel.viewerNote, lang === 'en' ? /no.*3D/i : /ثلاثي/);
    const sent = messages.length; instance.push3d(); assert.equal(messages.length, sent, 'no weapon fallback for an item without a captured model');
    assert.match(view.itemsSource, lang === 'en' ? /catalog.*purchase/i : /كتالوج.*شراء/);
    assert.match(view.merchantNote, lang === 'en' ? /one item.*unit price/i : /عنصر واحد/);
    instance.renderVals().itemTabs.find(tab => tab.name === T[lang].itemTabs.all).go();
    assert.match(instance.renderVals().itemsSource, lang === 'en' ? /owned inventory/i : /المملوك/);
    assert.equal(instance.state.sel, 'knife'); assert.equal(calls.filter(call => call.options?.method === 'POST').length, 0);
  }
  assert.match(html, /onClick="\{\{ m\.inspect \}\}"/);
  assert.match(html, /sc-if value="\{\{ sel\.hasModel \}\}"/);
  assert.match(html, /sc-if value="\{\{ !sel\.hasModel \}\}"/);
});

test('training and city records show actual eligibility across recovery, travel, offline and a pending save', () => {
  for (const guard of ['hospital', 'jail', 'travel', 'offline', 'saving']) {
    const { instance } = game();
    instance.applyGameplay({ player: { cash: 1000000, energy: 100, max_energy: 100, level: 25 }, state: { version: 7, gym: 0, job: 'grocer', inv: { knife: 1 }, prop: 'shack', ownedProperties: ['shack'] } });
    if (guard === 'hospital') instance.p.hospUntil = Date.now() + 3000000;
    if (guard === 'jail') instance.p.jailUntil = Date.now() + 3000000;
    if (guard === 'travel') instance.p.travel = { status: 'traveling' };
    if (guard === 'offline') instance.runtimeConnection = 'offline';
    if (guard === 'saving') instance.gameplayBusy = true;
    for (const lang of ['en', 'ar']) {
      instance.state.lang = lang; const view = instance.renderVals();
      assert.equal(view.trainOff, true, guard); assert.equal(view.job.disabled, true, guard);
      for (const section of ['gyms', 'jobs', 'courses', 'props']) {
        assert.ok(view[section].every(record => record.disabled), section + ' ' + guard);
        assert.ok(view[section].every(record => record.reason?.length), section + ' explains ' + guard);
      }
    }
  }
});

test('property atlas maps immutable default IDs independently of catalog order and keeps authored image precedence', () => {
  const { instance } = game();
  const catalogs = JSON.parse(readFileSync(resolve(root, 'engine/data/gameplay-catalog.json'), 'utf8'));
  catalogs.properties.reverse(); catalogs.properties.push({ id: 'custom-estate', price: 42, happy: 123, image: 'https://example.test/custom-property.png', name: { en: 'Custom estate', ar: 'عقار مخصص' } });
  instance.applyGameplay({ state: { version: 7, prop: 'island' }, catalogs });
  const positions = { shack: '0% 0%', trailer: '33.333333% 0%', apt: '66.666667% 0%', semi: '100% 0%', house: '0% 100%', villa: '33.333333% 100%', island: '66.666667% 100%' };
  for (const record of instance.renderVals().props) {
    if (record.id === 'custom-estate') { assert.equal(record.img, 'https://example.test/custom-property.png'); assert.equal(record.artSize, 'contain'); continue; }
    assert.equal(record.img, 'art/zone-property-atlas-v1.png'); assert.equal(record.artSize, '400% 200%'); assert.equal(record.artPosition, positions[record.id]);
  }
  assert.equal(instance.renderVals().propertyDossier.artPosition, positions.island);
  catalogs.properties.find(property => property.id === 'shack').image = 'https://example.test/authored-shack.png';
  instance.applyGameplay({ state: { version: 8, prop: 'shack' }, catalogs });
  assert.equal(instance.renderVals().propertyDossier.img, 'https://example.test/authored-shack.png');
  assert.equal(instance.renderVals().propertyDossier.artSize, 'contain');
  assert.ok(readFileSync(resolve(root, 'art/zone-property-atlas-v1.png')).length > 0);
});

test('property and course records preserve owned free moves and one active course without premature benefits', () => {
  const { instance, calls } = game();
  instance.applyGameplay({ player: { cash: 100, happy: 50, max_happy: 250 }, state: { version: 7, prop: 'shack', ownedProperties: ['shack', 'trailer'], edu: { id: 'bio', until: 3000000, total: 1200000 }, eduDone: {} } });
  let view = instance.renderVals();
  const trailer = view.props.find(record => record.id === 'trailer');
  assert.equal(trailer.price, '$0'); assert.equal(trailer.disabled, false); assert.equal(trailer.owned, true);
  assert.equal(view.courses.find(record => record.id === 'bio').active, true);
  assert.ok(view.courses.every(record => record.disabled));
  assert.equal(view.courses.filter(record => record.done).length, 0); assert.equal(calls.length, 0);
  instance.applyGameplay({ state: { version: 8, edu: null, eduDone: { bio: true } } });
  view = instance.renderVals(); assert.equal(view.courses.find(record => record.id === 'bio').done, true);
  assert.equal(view.courses.find(record => record.id === 'bio').disabled, true);
});

test('item artwork uses the actual compiler src binding without a prebootstrap placeholder request', () => {
  const image = html.match(/<img\b[^>]*sel\.artwork[^>]*>/)[0];
  assert.doesNotMatch(image, /(?:^|\s)src="\{\{/);
  assert.match(image, /sc-camel-src="\{\{ sel\.artwork \}\}"/);
  const runtime = readFileSync(resolve(root, 'support.js'), 'utf8');
  const expressions = runtime.slice(runtime.indexOf('// src/expr.ts'), runtime.indexOf('// src/encode.ts'));
  const attr = runtime.slice(runtime.indexOf('function compileAttr(raw)'), runtime.indexOf('// src/compile.ts'));
  const props = runtime.slice(runtime.indexOf('function collectProps(node'), runtime.indexOf('var HOST_STYLE_PROPS'));
  const context = createContext({});
  runInContext(expressions + attr + props + '\nvar CAMEL_ATTR="sc-camel-"; function kebabToCamel(s){return s.replace(/-([a-z])/g,(_,c)=>c.toUpperCase());} globalThis.collect=collectProps;', context);
  const attributes = [...image.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, name, value]) => ({ name, value }));
  const getters = context.collect({ attributes }, 'dom', {}).propGetters;
  const src = getters.find(([key]) => key === 'src'); assert.ok(src, 'the real runtime decodes sc-camel-src into React src');
  assert.equal(src[1]({ sel: { artwork: '/assets/ui/icons/hospital.svg' } }), '/assets/ui/icons/hospital.svg');
});

test('PvP hints describe the existing base recovery rules and remain read-only in both languages', () => {
  for (const lang of ['en', 'ar']) {
    const { instance, calls } = game(); instance.state.lang = lang; instance.state.combatMode = 'players';
    const view = instance.renderVals(); assert.equal(view.peerCombat.visible, true);
    assert.match(view.peerCombat.consequences, /5/); assert.match(view.peerCombat.consequences, /10/); assert.match(view.peerCombat.consequences, /2/);
    assert.match(view.peerCombat.consequences, lang === 'en' ? /base.*shorten/i : /أساسية.*تقصّر/);
    assert.match(view.peerCombat.consequences, lang === 'en' ? /existing wallet/i : /رصيد/);
    assert.equal(calls.length, 0);
  }
  assert.match(html, /\{\{ peerCombat\.consequences \}\}/);
});

test('player combat uses its own versioned endpoint and authoritative roster names', async () => {
  const { instance, calls } = game({ fetchImpl: async path => ({ ok: true, json: async () => path.endsWith('/opponents') ? { selfId: 'self', players: [{ id: 'peer', username: 'Real rival', level: 2, life: 100, max_life: 100, strength: 5, defense: 5, speed: 5, dexterity: 5, eligible: true }] } : { version: 4, encounter: { opponentId: 'peer', targetType: 'player', phase: 'won', log: [], playerHp: 50, playerMaxHp: 100, enemyHp: 0, enemyMaxHp: 100 } } }) });
  instance.gameplayReady = true; instance.state.screen = 'attack';
  await instance.setCombatMode('players');
  assert.equal(instance.renderVals().opps[0].name, 'Real rival');
  assert.equal(instance.renderVals().fight.name, 'Real rival');
  await instance.combatAction('finish', { approach: 'leave' });
  const post = calls.find(call => call.options?.method === 'POST');
  assert.equal(post.path, '/api/v1/player-combat/action');
  assert.deepEqual(JSON.parse(post.options.body), { action: 'finish', approach: 'leave', expectedVersion: 4 });
  instance.combatEncounter = null; await instance.setCombatMode('npc');
  assert.ok(calls.some(call => call.path === '/api/v1/combat'));
});

test('escrow listing submits only owned quantity, displayed inventory version and seller price', async () => {
  const snapshot = { listings: [], ownListings: [], inventoryVersion: 7 };
  const { instance, calls } = game({ fetchImpl: async path => ({ ok: true, json: async () => path.includes('player-market') ? { ...snapshot, result: { action: 'list' } } : { state: { version: 9 } } }) });
  instance.applyGameplay({ state: { version: 7, inv: { smallkit: 2 }, equip: 'fists' } }); instance.state.screen = 'market';
  await instance.setMarketMode('players');
  instance.marketDraft = { itemId: 'smallkit', quantity: '2', unitPrice: '150' };
  await instance.submitListing({ preventDefault() {} });
  const post = calls.find(call => call.options?.method === 'POST');
  assert.deepEqual(JSON.parse(post.options.body), { action: 'list', id: 'smallkit', quantity: 2, unitPrice: 150, expectedVersion: 7 });
  assert.equal(post.path, '/api/v1/player-market/action');
  assert.ok(calls.some(call => call.path === '/api/v1/gameplay'));
  for (const lang of ['en', 'ar']) { instance.state.lang = lang; assert.match(instance.renderVals().playerMarket.receipt.detail, lang === 'en' ? /escrow/ : /الضمان/); }
});

test('family operations display actual members, server countdown and permissioned versioned actions', async () => {
  const snapshot = { family: { id: 'vipers', name: { en: 'Sand Vipers', ar: 'أفاعي الرمال' }, role: 'member' }, permissions: { create: false }, definitions: [{ id: 'docks', name: { en: 'Dock run', ar: 'عملية الرصيف' }, description: { en: 'Work together', ar: 'اعملوا معاً' }, requiredMembers: 2, energyCost: 10, cashReward: 1000, respectReward: 50, durationSeconds: 300 }], operations: [{ id: 'op1', definitionId: 'docks', state: 'forming', version: 6, participants: [{ playerId: 'peer', username: 'Actual partner', energyCost: 10 }], requiredMembers: 2, payoutPerMember: 500, permissions: { join: true, start: false } }], competition: { seasonId: 'real-week', startsAt: 1700000, endsAt: 2400000, serverNow: 1800000, ownFactionId: 'vipers', ranks: [{ id: 'vipers', name: { en: 'Sand Vipers', ar: 'أفاعي الرمال' }, memberCount: 2, score: 50, version: 1 }] } };
  const { instance, calls } = game({ fetchImpl: async path => ({ ok: true, json: async () => path.includes('family-activities') ? snapshot : { state: { version: 2 } } }) });
  instance.applyGameplay({ player: { energy: 100, energy_max: 100 }, state: { version: 1 } }); instance.state.screen = 'faction';
  await instance.loadPeerResource('family', true);
  for (const lang of ['en', 'ar']) { instance.state.lang = lang; const view = instance.renderVals(); assert.equal(view.familyActivities.definitions[0].disabled, true); assert.equal(view.familyActivities.operations[0].participants, 'Actual partner'); assert.equal(view.familyActivities.operations[0].actions[0].disabled, false); assert.match(view.familyActivities.operations[0].cost, /10/); assert.equal(view.competition.ranks[0].score, '50'); }
  await instance.renderVals().familyActivities.operations[0].actions[0].run();
  const post = calls.find(call => call.options?.method === 'POST');
  assert.deepEqual(JSON.parse(post.options.body), { action: 'join', id: 'op1', expectedVersion: 6 });
  instance.peerResources.family.snapshot.operations[0] = { ...snapshot.operations[0], state: 'running', readyAt: 1860000, permissions: { resolve: false } };
  assert.equal(instance.renderVals().familyActivities.operations[0].countdown, '01:00');
  assert.equal(instance.peerResources.family.snapshot.operations[0].state, 'running', 'rendering never resolves rewards locally');
});

test('unavailable player encounter refresh disables attacks even when the roster succeeds', async () => {
  const { instance, calls } = game({ fetchImpl: async path => path.endsWith('/opponents') ? { ok: true, json: async () => ({ selfId: 'self', players: [{ id: 'peer', username: 'Real rival', level: 2, life: 50, max_life: 100, eligible: true }] }) } : { ok: false, json: async () => ({ error: 'Connection unavailable.' }) } });
  instance.applyGameplay({ player: { energy: 100, energy_max: 100 }, state: { version: 1 } }); instance.state.screen = 'attack';
  await instance.setCombatMode('players');
  assert.equal(instance.renderVals().opps[0].disabled, true);
  assert.match(instance.renderVals().peerCombat.message, /Reconnect/);
  await assert.rejects(instance.combatAction('start', { opponentId: 'peer' }), /Combat unavailable/);
  assert.equal(calls.filter(call => call.options?.method === 'POST').length, 0);
});

test('escrow stale buys and family stale actions refresh once without replay or local settlement', async () => {
  for (const kind of ['market', 'family']) {
    const fresh = kind === 'market' ? { inventoryVersion: 9, listings: [{ id: 'sale', itemId: 'smallkit', sellerName: 'Actual seller', quantity: 1, unitPrice: 250, version: 5, own: false }] } : { family: null, definitions: [], operations: [] };
    const { instance, calls } = game({ fetchImpl: async (path, options) => options?.method === 'POST' ? { ok: false, status: 409, json: async () => ({ error: 'Stale version' }) } : { ok: true, json: async () => path.includes('gameplay') ? { state: { version: 10 } } : fresh } });
    instance.applyGameplay({ state: { version: 1 } }); instance.state.screen = kind === 'market' ? 'market' : 'faction'; instance.state.marketMode = 'players';
    await instance.loadPeerResource(kind, true); const cash = instance.p.cash;
    await assert.rejects(instance.peerAction(kind, { action: kind === 'market' ? 'buy' : 'join', id: 'sale', quantity: 1, expectedVersion: 3 }), /Data changed/);
    assert.equal(calls.filter(call => call.options?.method === 'POST').length, 1);
    assert.equal(calls.filter(call => call.path === instance.peerPath(kind) && call.options?.method !== 'POST').length, 2);
    assert.equal(instance.p.cash, cash); assert.equal(instance.peerResources[kind].busy, false);
  }
});

test('peer polling is route scoped, coalesced, hidden-tab quiet and backs off after failure', async () => {
  const { instance, calls, context } = game({ fetchImpl: async () => ({ ok: false, json: async () => ({ error: 'Offline' }) }) });
  for (const kind of ['opponents', 'market', 'family']) await instance.loadPeerResource(kind, true);
  assert.equal(calls.length, 0);
  instance.gameplayReady = true; instance.state.screen = 'market'; instance.state.marketMode = 'players';
  await Promise.all([instance.loadPeerResource('market', true), instance.loadPeerResource('market', true)]); assert.equal(calls.length, 1);
  await instance.loadPeerResource('market'); assert.equal(calls.length, 1, 'automatic retry respects backoff');
  assert.equal(instance.renderVals().playerMarket.listDisabled, true);
  context.document.visibilityState = 'hidden'; await instance.loadPeerResource('market', true); assert.equal(calls.length, 1);
  const preview = game({ preview: true }); preview.instance.state.screen = 'faction'; await preview.instance.loadPeerResource('family', true); assert.equal(preview.calls.length, 0);
});

test('escrow validation blocks oversized, fractional and unowned listings; buy quantity and cancellation use listing versions', async () => {
  const market = { inventoryVersion: 8, ownListings: [], listings: [{ id: 'sale', itemId: 'smallkit', sellerName: 'Actual seller', quantity: 4, unitPrice: 50, version: 6, own: false }, { id: 'own', itemId: 'drink', sellerName: 'Me', quantity: 2, unitPrice: 20, version: 3, own: true }] };
  const { instance, calls } = game({ fetchImpl: async path => ({ ok: true, json: async () => path.includes('player-market') ? market : { state: { version: 9 } } }) });
  instance.applyGameplay({ player: { cash: 1000 }, state: { version: 1, inv: { smallkit: 2 } } }); instance.state.screen = 'market'; await instance.setMarketMode('players');
  for (const draft of [{ itemId: 'smallkit', quantity: '3', unitPrice: '1' }, { itemId: 'smallkit', quantity: '1.5', unitPrice: '1' }, { itemId: 'revolver', quantity: '1', unitPrice: '1' }, { itemId: 'smallkit', quantity: '1', unitPrice: '1000001' }]) { instance.marketDraft = draft; await instance.submitListing(); }
  assert.equal(calls.filter(call => call.options?.method === 'POST').length, 0);
  instance.marketBuyQuantities = { sale: '2' };
  await instance.renderVals().playerMarket.listings[0].buy();
  assert.deepEqual(JSON.parse(calls.find(call => call.options?.method === 'POST').options.body), { action: 'buy', id: 'sale', quantity: 2, expectedVersion: 6 });
  await instance.renderVals().playerMarket.listings[1].cancel();
  assert.deepEqual(JSON.parse(calls.filter(call => call.options?.method === 'POST')[1].options.body), { action: 'cancel', id: 'own', quantity: 2, expectedVersion: 3 });
  const count = calls.length; await instance.renderVals().playerMarket.listings[0].cancel(); await instance.renderVals().playerMarket.listings[1].buy(); assert.equal(calls.length, count);
});

test('peer mutation controls respect recovery, transit, connection and double-click reservation', async () => {
  let release;
  const market = { inventoryVersion: 7, listings: [], ownListings: [] };
  const { instance, calls } = game({ fetchImpl: async (path, options) => options?.method === 'POST' ? new Promise(resolve => { release = () => resolve({ ok: true, json: async () => market }); }) : { ok: true, json: async () => path.includes('gameplay') ? { state: { version: 8 } } : market } });
  instance.applyGameplay({ state: { version: 1, inv: { smallkit: 2 } } }); instance.state.screen = 'market'; await instance.setMarketMode('players');
  for (const guard of ['hospital', 'travel', 'offline']) {
    if (guard === 'hospital') instance.p.hospUntil = Date.now() + 2000000;
    if (guard === 'travel') instance.p.travel = { status: 'traveling' };
    if (guard === 'offline') instance.runtimeConnection = 'offline';
    await instance.peerAction('market', { action: 'list', id: 'smallkit', quantity: 1, unitPrice: 1, expectedVersion: 7 });
    assert.equal(calls.filter(call => call.options?.method === 'POST').length, 0, guard);
    instance.p.hospUntil = 0; instance.p.travel = null; instance.runtimeConnection = 'connected';
  }
  const first = instance.peerAction('market', { action: 'list', id: 'smallkit', quantity: 1, unitPrice: 1, expectedVersion: 7 });
  await instance.peerAction('market', { action: 'list', id: 'smallkit', quantity: 1, unitPrice: 1, expectedVersion: 7 });
  assert.equal(calls.filter(call => call.options?.method === 'POST').length, 1); release(); await first;
});

test('an incoming real player encounter names the attacker and blocks starting another fight', async () => {
  const { instance } = game({ fetchImpl: async path => ({ ok: true, json: async () => path.endsWith('/opponents') ? { selfId: 'self', players: [{ id: 'peer', username: 'Actual attacker', level: 2, life: 100, max_life: 100, eligible: false, reason: 'Player is already in an encounter.' }] } : { version: 3, encounter: null, incoming: { attackerId: 'peer', attackerName: 'Actual attacker', expiresAt: 2000 } } }) });
  instance.applyGameplay({ player: { energy: 100, energy_max: 100 }, state: { version: 1 } }); instance.state.screen = 'attack'; await instance.setCombatMode('players');
  for (const lang of ['en', 'ar']) { instance.state.lang = lang; const view = instance.renderVals(); assert.match(view.peerCombat.message, /Actual attacker/); assert.equal(view.opps[0].disabled, true); assert.match(view.opps[0].status, lang === 'en' ? /encounter/ : /مواجهة/); }
});

test('player finish receipts persist the actual rival and server settlement without locally adding rewards', async () => {
  const result = { approach: 'hosp', outcome: 'won', cashDelta: 0, xp: 6, respectDelta: 2 };
  const { instance } = game({ fetchImpl: async path => ({ ok: true, json: async () => path.includes('player-combat/action') ? { version: 3, encounter: null, result } : path.includes('opponents') ? { selfId: 'self', players: [] } : { state: { version: 2 } } }) });
  instance.applyGameplay({ player: { cash: 100, xp: 20 }, state: { version: 1 } }); instance.state.screen = 'attack'; instance.state.combatMode = 'players'; instance.combatVersion = 2; instance.combatEncounter = { opponentId: 'peer', opponent: { name: 'Actual rival', username: 'Actual rival' }, phase: 'won' };
  const cash = instance.p.cash, xp = instance.p.xp;
  await instance.finish('hosp', instance.renderVals().t);
  assert.equal(instance.p.cash, cash); assert.equal(instance.p.xp, xp);
  for (const lang of ['en', 'ar']) { instance.state.lang = lang; const text = instance.renderVals().log[0].text; assert.match(text, /Actual rival/); assert.match(text, /6/); assert.match(text, /2/); assert.match(text, lang === 'en' ? /Hospitalized/ : /أُدخل المستشفى/); }
});

test('fresh guest family resources wait for gameplay authentication and load immediately after hydration', async () => {
  const { instance, calls } = game({ fetchImpl: async () => ({ ok: true, json: async () => ({ family: null, definitions: [], operations: [] }) }) });
  instance.state.screen = 'faction';
  await instance.loadPeerResource('family', true);
  assert.equal(calls.length, 0, 'no unauthenticated family read or error backoff');
  instance.applyGameplay({ player: { id: 'fresh-guest' }, state: { version: 1 } });
  await instance.peerResources?.family?.pending;
  assert.equal(calls.length, 1); assert.equal(calls[0].path, '/api/v1/family-activities');
  assert.equal(instance.peerResources.family.error, '');
  assert.equal(instance.peerResources.family.snapshot.family, null);
});

test('successful family join invalidates the guest operation snapshot and displays new leader permissions immediately', async () => {
  let joined = false;
  const { instance, calls } = game({ fetchImpl: async path => ({ ok: true, json: async () => {
    if (path.endsWith('/factions/join')) { joined = true; return { map: { playerFactionId: 'kings', playerFactionRole: 'leader', factions: [], members: [], blocks: [] } }; }
    if (path.includes('family-activities')) return { family: joined ? { id: 'kings', name: { en: 'Harbor Kings', ar: 'ملوك المرفأ' }, role: 'leader' } : null, permissions: { create: joined }, definitions: [{ id: 'docks', name: { en: 'Dock run', ar: 'عملية الرصيف' }, requiredMembers: 2, energyCost: 10, cashReward: 1000, respectReward: 20, durationSeconds: 300 }], operations: [] };
    return { state: { version: 2 } };
  } }) });
  instance.applyGameplay({ state: { version: 1 } }); instance.state.screen = 'faction'; instance.territoryMap.playerFactionId = null;
  await instance.loadPeerResource('family', true); assert.equal(instance.peerResources.family.snapshot.family, null);
  await instance.joinFaction('kings');
  assert.equal(instance.peerResources.family.snapshot.family.id, 'kings');
  assert.equal(instance.renderVals().familyActivities.definitions[0].disabled, false);
  assert.equal(calls.filter(call => call.path === '/api/v1/family-activities').length, 2);
});

test('numeric escrow controls bind through the compiler without native literal placeholder parsing', () => {
  const fields = Array.from(html.matchAll(/<input\b[^>]*type="number"[^>]*>/g), match => match[0]);
  assert.equal(fields.length, 3);
  for (const field of fields) {
    assert.doesNotMatch(field, /(?:^|\s)value="\{\{/);
    assert.match(field, /sc-camel-value="\{\{/);
    assert.match(field, /onChange="\{\{/);
    assert.match(field, /onInput="\{\{/);
  }
});

test('escrow input events retain typed price and quantities across polls and submit the visible total', async () => {
  const snapshot = { inventoryVersion: 7, ownListings: [], listings: [{ id: 'sale', itemId: 'smallkit', sellerName: 'Other player', quantity: 4, unitPrice: 20, version: 3, own: false }] };
  const { instance, calls } = game({ fetchImpl: async path => ({ ok: true, json: async () => path.includes('player-market') ? snapshot : { state: { version: 7, inv: { knife: 2 } } } }) });
  instance.applyGameplay({ player: { cash: 1000 }, state: { version: 7, inv: { knife: 2 } } }); instance.state.screen = 'market';
  await instance.setMarketMode('players');
  const fields = [...html.matchAll(/<input\b[^>]*type="number"[^>]*>/g)].map(match => match[0]);
  const handlerFor = (id, view) => {
    const path = fields.find(field => field.includes('id="' + id + '"')).match(/onInput="\{\{\s*([^}]+?)\s*\}\}"/)[1].split('.');
    return path.reduce((value, key) => value[key], view);
  };
  handlerFor('zone-list-price', instance.renderVals())({ target: { value: '10' } });
  handlerFor('zone-list-quantity', instance.renderVals())({ target: { value: '2' } });
  instance.renderVals().playerMarket.listings[0].changeQuantity({ target: { value: '3' } });
  instance.applyGameplay({ player: { cash: 1000 }, state: { version: 8, inv: { knife: 2 } } });
  await instance.loadPeerResource('market', true);
  const view = instance.renderVals();
  assert.equal(view.playerMarket.draft.unitPrice, '10'); assert.equal(view.playerMarket.draft.quantity, '2'); assert.equal(view.playerMarket.total, '$20');
  assert.equal(view.playerMarket.listings[0].quantity, '3'); assert.equal(view.playerMarket.listings[0].total, '$60');
  assert.equal(calls.filter(call => call.options?.method === 'POST').length, 0);
  await instance.submitListing({ preventDefault() {} });
  assert.deepEqual(JSON.parse(calls.find(call => call.options?.method === 'POST').options.body), { action: 'list', id: 'knife', quantity: 2, unitPrice: 10, expectedVersion: 7 });
});

test('Arabic real-player roster resolves family names from the actual bilingual family catalog', () => {
  const { instance } = game(); instance.gameplayReady = true; instance.state.combatMode = 'players'; instance.state.lang = 'ar';
  instance.territoryMap.factions = [{ id: 'kings', name: { en: 'Harbor Kings', ar: 'ملوك المرفأ' } }];
  instance.peerResources = { opponents: { snapshot: { selfId: 'self', players: [{ id: 'peer', username: 'Real rival', factionId: 'kings', factionName: 'Harbor Kings', eligible: true }] } } };
  assert.equal(instance.renderVals().opps[0].factionName, 'ملوك المرفأ');
});

test('market settlement receipts retain returned quantity and cash despite a failed balance refresh, without local rewards', async () => {
  const result = { action: 'buy', listingId: 'sale', itemId: 'smallkit', quantity: 2, cashDelta: -550, sellerCashDelta: 550, correlationId: 'settlement-actual' };
  const { instance, calls } = game({ fetchImpl: async () => ({ ok: true, json: async () => ({ listings: [], inventoryVersion: 2, result }) }) });
  instance.applyGameplay({ player: { id: 'self', cash: 2000 }, state: { version: 1 } }); instance.state.screen = 'market'; instance.state.marketMode = 'players';
  instance.peerResources = { market: { snapshot: { listings: [], inventoryVersion: 1 } } };
  instance.loadGameplay = async () => { throw new Error('Balance refresh offline'); };
  await instance.peerAction('market', { action: 'buy', id: 'sale', quantity: 8, expectedVersion: 1 });
  assert.equal(instance.p.cash, 2000, 'the receipt never applies cashDelta locally');
  assert.equal(calls.filter(call => call.options?.method === 'POST').length, 1);
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang;
    const receipt = instance.renderVals().playerMarket.receipt;
    assert.equal(receipt.visible, true); assert.match(receipt.detail, /2/); assert.match(receipt.detail, /550/);
    assert.doesNotMatch(receipt.detail, /8/);
    assert.match(receipt.refreshNote, lang === 'en' ? /accepted.*refresh|refresh.*accepted/i : /قُبل|تم قبول/);
    instance.peerResources.market.error = 'Polling offline';
    assert.equal(instance.renderVals().playerMarket.receipt.detail, receipt.detail, 'failed polling does not erase the confirmed effect');
  }
  assert.match(instance.p.log[0].a.labels[0], /550/);
});

test('family settlement receipts show exact returned payouts, real participants and shared respect without awarding cash', async () => {
  const operation = { id: 'op1', definitionId: 'docks', name: { en: 'Real dock crew', ar: 'فريق المرفأ' }, state: 'completed', version: 8, participants: [{ playerId: 'self', username: 'Actual captain', energyCost: 10 }, { playerId: 'peer', username: 'Actual partner', energyCost: 10 }], requiredMembers: 2, permissions: {} };
  const result = { action: 'resolve', operationId: 'op1', cashPerMember: 600, respectDelta: 20, participants: ['self', 'peer'] };
  const { instance } = game({ fetchImpl: async () => ({ ok: true, json: async () => ({ definitions: [], operations: [operation], result }) }) });
  instance.applyGameplay({ player: { id: 'self', cash: 2000 }, state: { version: 1 } }); instance.state.screen = 'faction';
  instance.peerResources = { family: { snapshot: { definitions: [], operations: [{ ...operation, state: 'running', version: 7 }] } } };
  instance.loadGameplay = async () => {};
  await instance.peerAction('family', { action: 'resolve', id: 'op1', expectedVersion: 7 });
  const cash = instance.p.cash;
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang; const receipt = instance.renderVals().familyActivities.receipt;
    assert.equal(receipt.visible, true); assert.match(receipt.detail, /600/); assert.match(receipt.detail, /20/);
    assert.match(receipt.detail, lang === 'en' ? /Real dock crew/ : /فريق المرفأ/);
    assert.match(receipt.detail, /Actual captain/); assert.match(receipt.detail, /Actual partner/);
    assert.match(receipt.detail, lang === 'en' ? /per member.*shared respect/ : /لكل عضو.*احترام مشترك/);
  }
  assert.equal(instance.p.cash, cash, 'displaying per-member rewards never adds them');
});

test('family join, leave and cancellation settlement receipts use only returned energy debits and refunds', async () => {
  for (const result of [
    { action: 'join', operationId: 'op1', energyDelta: -10 },
    { action: 'leave', operationId: 'op1', energyDelta: 15 },
    { action: 'cancel', operationId: 'op1', energyRefunds: [{ playerId: 'self', energy: 12 }, { playerId: 'peer', energy: 7 }] },
    { action: 'join', operationId: 'op1' },
  ]) {
    const operation = { id: 'op1', definitionId: 'docks', state: 'forming', version: 2, participants: [{ playerId: 'self', username: 'Captain', energyCost: 999 }, { playerId: 'peer', username: 'Partner', energyCost: 999 }], requiredMembers: 2, permissions: {} };
    const { instance } = game({ fetchImpl: async () => ({ ok: true, json: async () => ({ definitions: [], operations: [operation], result }) }) });
    instance.applyGameplay({ player: { id: 'self', energy: 80 }, state: { version: 1 } }); instance.state.screen = 'faction';
    instance.peerResources = { family: { snapshot: { definitions: [], operations: [operation] } } }; instance.loadGameplay = async () => {};
    await instance.peerAction('family', { action: result.action, id: 'op1', expectedVersion: 1 });
    const detail = instance.renderVals().familyActivities.receipt.detail;
    if (result.energyDelta) assert.match(detail, new RegExp(Math.abs(result.energyDelta) + '.*energy'));
    if (result.energyRefunds) { assert.match(detail, /Captain.*12|12.*Captain/); assert.match(detail, /Partner.*7|7.*Partner/); }
    assert.doesNotMatch(detail, /999/, 'catalog or roster costs cannot manufacture a settlement amount');
    assert.equal(instance.p.bars.energy.v, 80, 'receipt display cannot apply a refund or debit locally');
  }
});

test('market cancellation settlement survives same-character reload and remains dismissible without a mutation', async () => {
  const { instance, calls } = game({ fetchImpl: async () => ({ ok: true, json: async () => ({ listings: [], inventoryVersion: 3, result: { action: 'cancel', listingId: 'sale', itemId: 'smallkit', quantity: 3, cashDelta: 0, correlationId: 'cancel-proof' } }) }) });
  instance.applyGameplay({ player: { id: 'self', cash: 2000 }, state: { version: 1 } }); instance.state.screen = 'market'; instance.state.marketMode = 'players';
  instance.peerResources = { market: { snapshot: { listings: [], inventoryVersion: 2 } } }; instance.loadGameplay = async () => {};
  await instance.peerAction('market', { action: 'cancel', id: 'sale', quantity: 20, expectedVersion: 2 });
  assert.match(instance.renderVals().playerMarket.receipt.detail, /3/);
  const restored = game({ liveSave: instance.p }).instance;
  restored.applyGameplay({ player: { id: 'self' }, state: { version: 4 } }); restored.state.screen = 'market'; restored.state.marketMode = 'players';
  assert.equal(restored.renderVals().playerMarket.receipt.visible, true);
  restored.renderVals().playerMarket.receipt.dismiss(); assert.equal(restored.renderVals().playerMarket.receipt.visible, false);
  assert.equal(calls.filter(call => call.options?.method === 'POST').length, 1);
  const afterDismiss = game({ liveSave: restored.p }).instance; afterDismiss.applyGameplay({ player: { id: 'self' }, state: { version: 4 } });
  assert.equal(afterDismiss.renderVals().playerMarket.receipt.visible, false);
  instance.applyServerPlayer({ id: 'another-character' }); assert.equal(instance.renderVals().playerMarket.receipt.visible, false, 'an accepted different identity cannot inherit another character receipt');
  assert.match(html, /id="zone-market-receipt"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /id="zone-family-receipt"[^>]*role="status"[^>]*aria-live="polite"/);
});

test('planned upkeep reference is separate from actual property price and cannot imply a daily charge', () => {
  const { instance } = game(); instance.state.screen = 'properties';
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang; const view = instance.renderVals();
    assert.match(view.propertyUpkeepLabel, lang === 'en' ? /planned.*not charged/i : /مخطط.*لا تُخصم/);
    assert.match(view.props[1].upkeepReference, lang === 'en' ? /planned.*50.*not charged/i : /مخطط.*50.*لا تُخصم/);
    assert.equal(view.props[1].price, '$40,000');
  }
  const properties = html.split('<!-- PROPERTIES -->')[1].split('<!-- NEWSPAPER -->')[0];
  assert.doesNotMatch(properties, /pr\.price[\s\S]{0,110}pr\.upkeep/);
  assert.match(properties, /<details[^>]*>[\s\S]*propertyUpkeepLabel[\s\S]*pr\.upkeepReference[\s\S]*<\/details>/);
});

test('published crime odds include server level, individual skill and only owned family benefits in EN and AR', () => {
  const { instance, context } = game(); instance.componentDidMount();
  instance.onRuntime({ detail: { connection: 'connected', changed: true, release: { version: 3, manifest: {} }, content: { crimes: [{ id: 'east', category: 'graf', enabled: true, nerve_cost: 3, success_basis_points: 8025, failure: 'jail', penalty_minutes: 3 }] } } });
  instance.p.level = 5; instance.p.skill = { east: 10, other: 100 }; instance.p.crimeXp = 1000; instance.state.cat = 'graf';
  instance.territoryMap = { playerFactionId: 'vipers', blocks: [
    { ownerFactionId: 'vipers', state: 'owned', benefits: [{ key: 'crime_bonus', value: 350 }, { key: 'gym_bonus', value: 2000 }] },
    { ownerFactionId: 'vipers', state: 'contested', benefits: [{ key: 'crime_bonus', value: 2000 }] },
    { ownerFactionId: 'kings', state: 'owned', benefits: [{ key: 'crime_bonus', value: 2000 }] },
  ] };
  const crime = runInContext('CRIMES.graf[0]', context);
  assert.equal(instance.pct(crime), 86.85, '8025 + 350 + (5-1)*40 + 10*15 = 8685 basis points');
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang;
    assert.equal(instance.renderVals().crimes[0].pctText, '87%');
  }
});

test('failure-configured crime odds retain the server 97 percent cap even with excess benefits and mastery', () => {
  const { instance } = game(); instance.p.level = 100; instance.p.skill = { east: 100 };
  instance.territoryMap = { playerFactionId: 'vipers', blocks: [{ ownerFactionId: 'vipers', state: 'owned', benefits: [{ key: 'crime_bonus', value: 9000 }] }] };
  assert.equal(instance.pct({ id: 'east', base: 50, fail: 'jail' }), 97);
  instance.p.level = 1; instance.p.skill.east = 0; instance.territoryMap.blocks = [];
  assert.equal(instance.pct({ id: 'east', base: 99, fail: 'hosp' }), 97, 'failure cap applies even before level and skill bonuses');
});

test('published crime odds without a failure rule do not acquire invented level bonuses or a 97 percent cap', () => {
  const { instance, context } = game(); instance.componentDidMount();
  instance.onRuntime({ detail: { connection: 'connected', changed: true, release: { version: 3, manifest: {} }, content: { crimes: [{ id: 'east', category: 'graf', enabled: true, nerve_cost: 3, success_basis_points: 8831, failure: null }] } } });
  instance.p.level = 100; instance.p.skill = { east: 100 };
  const crime = runInContext('CRIMES.graf[0]', context);
  assert.equal(instance.pct(crime), 88.31);
  instance.territoryMap = { playerFactionId: 'vipers', blocks: [{ ownerFactionId: 'vipers', state: 'owned', benefits: [{ key: 'crime_bonus', value: 2000 }] }] };
  assert.equal(instance.pct(crime), 100, 'unconfigured crimes retain the server base-plus-territory 100 percent cap');
});

test('published crime odds honor disabled territory gates and the server integer basis-point cast', () => {
  for (const { manifest, engineModules } of [
    { manifest: { modules: { city: false } }, engineModules: [{ id: 'territories', installed: true, enabled: true }] },
    { manifest: {}, engineModules: [{ id: 'territories', installed: true, enabled: false }] },
    { manifest: {}, engineModules: [{ id: 'territories', installed: false, enabled: true }] },
  ]) {
    const { instance, context } = game(); instance.componentDidMount();
    instance.onRuntime({ detail: { connection: 'connected', changed: true, release: { version: 3, manifest }, content: { engineModules, crimes: [{ id: 'east', category: 'graf', enabled: true, nerve_cost: 3, success_basis_points: 8055.75, failure: 'none' }] } } });
    instance.p.level = 3; instance.p.skill = { east: 1 };
    instance.territoryMap = { playerFactionId: 'vipers', blocks: [{ ownerFactionId: 'vipers', state: 'owned', benefits: [{ key: 'crime_bonus', value: 1500 }] }] };
    assert.equal(instance.pct(runInContext('CRIMES.graf[0]', context)), 81.5, '8055 integer base + 80 level + 15 skill; disabled territory contributes zero');
  }
});

test('Home active missions exclude server-claimed rewards while Missions preserves completed history in both languages', () => {
  const { instance, calls } = game();
  instance.applyGameplay({ state: { version: 1, ctr: { crimes: 2, trains: 0, wins: 0, shifts: 0, buys: 1 }, claimed: { b1: true } }, onboarding: { currentMissionId: 'c5', completed: false, steps: [{ missionId: 'c5', counter: 'crimes', target: 5, progress: 2, claimed: false, current: true, claimable: false }, { missionId: 'b1', counter: 'buys', target: 1, progress: 1, claimed: true, current: false, claimable: false, reason: 'claimed' }] } });
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang;
    const view = instance.renderVals();
    assert.equal(view.activeMissions.some(mission => mission.id === 'b1'), false);
    assert.equal(view.activeMissions.find(mission => mission.id === 'c5').prog, '2/5');
    assert.equal(view.missions.length, 5, 'completed reward stays available in mission history');
    const claimed = view.missions.find(mission => mission.id === 'b1');
    assert.equal(claimed.claimed, true); assert.equal(claimed.disabled, true); assert.equal(claimed.btn, view.t.claimed);
    assert.match(view.quick[3].sub, /0/, 'claimed completion does not increase ready rewards');
  }
  instance.applyGameplay({ state: { version: 2, ctr: { crimes: 5, trains: 0, wins: 0, shifts: 0, buys: 1 }, claimed: { b1: true } } });
  assert.equal(instance.renderVals().activeMissions.find(mission => mission.id === 'c5').disabled, false, 'completed unclaimed objective remains active and claimable');
  instance.applyGameplay({ state: { version: 3, claimed: { b1: true, c5: true } } });
  assert.equal(instance.renderVals().activeMissions.some(mission => mission.id === 'c5'), false, 'accepted newer claimed state removes the active row');
  assert.equal(calls.length, 0, 'rendering and filtering never claim or repeat a reward');
  assert.match(html, /<sc-for list="\{\{ activeMissions \}\}" as="m"[^>]*><div class="zone-home-mission"/);
  assert.match(html, /<sc-for list="\{\{ missions \}\}" as="m" hint-placeholder-count="5"/);
});

test('header links name their real EN/AR destinations and account preserves locale without gameplay writes', () => {
  const { instance, calls, location, context } = game();
  for (const lang of ['en', 'ar']) {
    instance.state.lang = lang;
    const view = instance.renderVals();
    assert.deepEqual(Array.from(view.topLinks, link => link.label), [view.t.nav.education, view.bulletin.title, view.t.nav.faction, lang === 'ar' ? 'الحساب' : 'Account', view.t.nav.hof]);
    for (const [index, screen] of ['education', 'newspaper', 'faction', 'account', 'hof'].entries()) {
      if (screen === 'account') {
        const navigation = { href: location.href }; context.window.location = navigation;
        view.topLinks[index].go(); assert.equal(navigation.href, '/account?lang=' + lang);
        context.window.location = location;
      } else { view.topLinks[index].go(); assert.equal(instance.state.screen, screen); }
    }
  }
  assert.equal(calls.filter(call => call.options?.method === 'POST').length, 0);
});

test('Home next move follows the authoritative current onboarding goal instead of available nerve in EN and AR', () => {
  const goals = [['c5', 'crimes', 'crimes'], ['t4', 'trains', 'gym'], ['s2', 'shifts', 'jobs'], ['b1', 'buys', 'market'], ['w1', 'wins', 'attack']];
  for (const lang of ['en', 'ar']) for (const [missionId, counter, route] of goals) {
    const { instance, calls } = game();
    instance.state.lang = lang;
    instance.applyGameplay({ player: { id: 'actual-player', cash: 1000, energy: 100, energy_max: 100, nerve: 10, nerve_max: 10 }, state: { version: 1, ctr: { crimes: 0, trains: 0, shifts: 0, buys: 0, wins: 0 }, claimed: {}, market: [{ id: 'actual-stock', item: 'smallkit', qty: 1, price: 100, seller: 'Actual merchant' }] }, onboarding: { currentMissionId: missionId, completed: false, steps: [{ missionId, counter, target: 5, progress: 2, claimed: false, claimable: false, current: true }] } });
    const view = instance.renderVals();
    assert.equal(view.fieldGuide.goalId, missionId);
    assert.equal(view.fieldGuide.title, view.t.ms[missionId][0]);
    assert.match(view.fieldGuide.description, /2\/5/);
    view.fieldGuide.open(); assert.equal(instance.state.screen, route, `${lang}/${missionId}`);
    assert.equal(calls.filter(call => call.options?.method === 'POST').length, 0, 'a suggested objective navigates without spending resources or claiming');
  }
});

test('Home goal priority preserves recovery and claimable rewards and uses actual activity resource eligibility', () => {
  for (const lang of ['en', 'ar']) {
    const { instance, calls, context } = game(); instance.state.lang = lang;
    const setGoal = (missionId, counter) => {
      instance.onboarding = { currentMissionId: missionId, completed: false, steps: [{ missionId, counter, target: 5, progress: 2, claimed: false, claimable: false, current: true }] };
      instance.p.bars.energy = { v: 100, at: context.Date.now() }; instance.p.bars.nerve = { v: 10, at: context.Date.now() }; instance.p.cash = 1000;
    };
    instance.applyGameplay({ player: { id: 'actual-player', cash: 1000, energy: 100, energy_max: 100, nerve: 10, nerve_max: 10 }, state: { version: 1, gym: 7, job: 'grocer', ctr: { crimes: 0, trains: 0, shifts: 0, buys: 0, wins: 0 }, claimed: {}, market: [{ id: 'actual-stock', item: 'smallkit', qty: 1, price: 100, seller: 'Actual merchant' }] } });
    for (const [missionId, counter, resource, amount, requirement] of [['t4', 'trains', 'energy', 9, '10'], ['s2', 'shifts', 'energy', 14, '15'], ['w1', 'wins', 'energy', 24, '25'], ['c5', 'crimes', 'nerve', 0, '2'], ['b1', 'buys', 'cash', 99, '$100']]) {
      setGoal(missionId, counter);
      if (resource === 'cash') instance.p.cash = amount; else instance.p.bars[resource].v = amount;
      const view = instance.renderVals();
      assert.equal(view.fieldGuide.route, 'missions', 'unavailable goal opens its review instead of suggesting an unrelated eligible activity');
      assert.ok(view.fieldGuide.description.includes(requirement), `${lang}/${missionId} shows its actual requirement`);
      assert.match(view.fieldGuide.description, lang === 'en' ? /Unavailable now/ : /غير متاح حالياً/);
    }
    setGoal('t4', 'trains'); instance.onboarding.steps[0].claimable = true;
    assert.equal(instance.renderVals().fieldGuide.route, 'missions', 'server-claimable goal takes priority over more activity');
    setGoal('t4', 'trains'); instance.p.ctr.buys = 1;
    assert.equal(instance.renderVals().fieldGuide.route, 'missions', 'an actual unclaimed reward remains the next useful action');
    assert.equal(instance.renderVals().fieldGuide.goalId, 'b1');
    assert.equal(instance.renderVals().fieldGuide.title, instance.renderVals().t.ms.b1[0], 'claim priority names the actual available reward rather than a different incomplete goal');
    instance.p.ctr.buys = 0;
    for (const [key, route] of [['jailUntil', 'jail'], ['hospUntil', 'hospital']]) {
      instance.p[key] = context.Date.now() + 60000;
      assert.equal(instance.renderVals().fieldGuide.route, route, 'recovery outranks the saved objective');
      instance.p[key] = 0;
    }
    instance.runtimeConnection = 'offline'; assert.equal(instance.renderVals().fieldGuide.route, 'missions');
    assert.match(instance.renderVals().fieldGuide.description, lang === 'en' ? /Waiting for your character data/ : /انتظار بيانات شخصيتك/);
    instance.runtimeConnection = 'connected'; instance.onboarding.completed = true;
    assert.equal(instance.renderVals().fieldGuide.goalId, null, 'finished onboarding does not invent a current mission');
    instance.onboarding.completed = false; instance.onboarding.steps[0].claimed = true;
    assert.equal(instance.renderVals().fieldGuide.goalId, null, 'claimed steps cannot become suggested active objectives');
    assert.equal(calls.length, 0);
  }
});


test('combat presentation bridge sends exact authoritative NPC/player events with no invented opponent equipment', () => {
  for (const mode of ['npc', 'players']) for (const lang of ['en', 'ar']) {
    const { instance, frames, messages, calls } = game();
    frames['zone-combat-frame'] = { contentWindow: { postMessage(data, origin) { messages.push({ id: 'zone-combat-frame', data, origin }); } } };
    instance.state.screen = 'attack'; instance.state.combatMode = mode; instance.state.lang = lang;
    instance.peerResources = { opponents: { snapshot: { players: [{ id: 'peer', username: 'Actual rival' }] } } };
    const encounter = { id: 'persisted-id', version: 4, opponentId: mode === 'npc' ? 'rookie' : 'peer', phase: 'fighting', turn: 1, playerHp: 82, playerMaxHp: 100, enemyHp: 61, enemyMaxHp: 80, log: [{ actor:'player', d:19, yl:82, ol:61, n:1 }] };
    instance.applyCombat({ version:4, encounter, player:{username:'Actual player'} }); instance.pushCombatScene(); instance.pushCombatScene();
    const outbound = messages.filter(message=>message.id==='zone-combat-frame'); assert.equal(outbound.length,1);
    const packet = outbound[0].data.zoneCombat; assert.equal(outbound[0].origin,'http://zone.test'); assert.equal(packet.encounter.id,encounter.id);
    assert.deepEqual(packet.encounter.log,encounter.log); assert.equal(packet.player.name,'Actual player');
    assert.equal(packet.opponent?.weapon,undefined); assert.equal(packet.opponent?.outfit,undefined); assert.equal(calls.length,0);
    if(mode==='players') assert.equal(packet.opponentName,'Actual rival');
  }
});

test('starting combat requires an explicit next-turn command and one strike sends exactly one server action', async () => {
  const encounter={id:'fight',version:2,opponentId:'rayan',phase:'fighting',turn:0,playerHp:100,playerMaxHp:100,enemyHp:80,enemyMaxHp:80,log:[]};
  const {instance,calls}=game({fetchImpl:async (path, options)=>({ok:true,json:async()=>options?.method==='POST'? {version:2,encounter,player:{energy:25}}:{version:1,encounter:null}})});
  instance.gameplayReady=true;instance.loadGameplay=async()=>{};
  await instance.fight({id:'rayan'},{});assert.equal(instance._combatRunning,false);assert.equal(calls.filter(call=>call.options?.method==='POST').length,1);
  await instance.advanceCombat(true);const actions=calls.filter(call=>call.options?.method==='POST').map(call=>JSON.parse(call.options.body).action);assert.deepEqual(actions,['start','strike']);
  instance.pauseCombat();assert.equal(instance._combatRunning,false);
});

test('settled encounter retains replay archive and exact server receipt while clearing real fight controls', () => {
  const {instance,calls}=game();instance.state.screen='attack';instance.gameplayReady=true;
  const encounter={id:'actual',version:2,opponentId:'rayan',phase:'won',turn:1,playerHp:90,playerMaxHp:100,enemyHp:0,enemyMaxHp:80,log:[{actor:'player',d:80,yl:90,ol:0,n:1}]};
  instance.applyCombat({version:2,encounter,player:{cash:100}});instance.applyCombat({version:3,encounter:null,player:{cash:350},result:{outcome:'won',approach:'mug',cashDelta:250,respectDelta:4,xp:9}});
  assert.equal(instance.state.fight,null);assert.equal(instance.combatArchive.id,'actual');assert.equal(instance.p.cash,350);
  for(const lang of ['en','ar']){instance.state.lang=lang;const view=instance.renderVals();assert.match(view.combatScene.receipt,/250/);assert.match(view.combatScene.receipt,/9/);assert.match(view.combatScene.receipt,/4/);assert.equal(view.combatScene.showRoster,true);}assert.equal(calls.length,0);
});


test('combat instructions follow actual encounter phase and settlement in both languages without issuing actions',()=>{
  const {instance,calls}=game();
  for(const lang of ['en','ar']){
    instance.state.lang=lang;instance.combatEncounter=null;instance.combatReceipt=null;assert.match(instance.combatInstruction(),lang==='en'?/Choose a target/:/اختر خصماً/);
    for(const [phase,en,ar] of [['fighting',/Active encounter/,/مواجهة نشطة/],['won',/Victory recorded.*Mug.*Hospitalize.*Leave/,/انتصار مسجل/],['lost',/Defeat recorded.*Leave.*unlock target/,/هزيمة مسجلة/],['stalemate',/Stalemate recorded.*Leave/,/تعادل مسجل/]]){
      instance.combatEncounter={phase};assert.match(instance.combatInstruction(),lang==='en'?en:ar);if(phase!=='fighting')assert.doesNotMatch(instance.combatInstruction(),/Choose a target to start|اختر خصماً لبدء/);
    }
    instance.combatEncounter=null;instance.combatReceipt={outcome:'lost'};assert.match(instance.combatInstruction(),lang==='en'?/Encounter settled/:/تمت تسوية/);
    instance.combatError='Unavailable';assert.match(instance.combatInstruction(),lang==='en'?/Refresh before striking/:/أعد التحديث/);instance.combatError='';
  }
  assert.equal(calls.length,0);
});

test('beta102 bank double-click sends one command and locks both directions while saving',async()=>{
 let settle;const app=game({fetchImpl:async path=>path.includes('/bank/')?new Promise(resolve=>{settle=resolve;}):{ok:true,json:async()=>({})}});
 const c=app.instance;c.applyGameplay({player:{id:'real-bank-player',cash:2500,bank_balance:0},state:{version:1}});c.runtimeConnection='connected';c.state.screen='bank';
 const first=c.bankMove('deposit',100,app.T.en);await c.bankMove('deposit',100,app.T.en);
 assert.equal(app.calls.filter(call=>call.path==='/api/v1/bank/deposit').length,1);assert.equal(c.bankBusy,true);
 assert.ok([...c.renderVals().bank.deposits,...c.renderVals().bank.withdrawals].every(button=>button.disabled));
 settle({ok:true,json:async()=>({player:{id:'real-bank-player',cash:2400,bank_balance:100}})});await first;
 assert.equal(c.bankBusy,false);assert.equal(c.p.cash,2400);assert.equal(c.p.bankBalance,100);
});
test('beta102 catalog category filters expose unowned weapons without inventing ownership',()=>{
 for(const lang of ['en','ar']){const app=game(),c=app.instance;c.state.lang=lang;c.applyGameplay({state:{version:1,inv:{smallkit:1},equip:'fists'}});
 assert.equal(c.renderVals().inv.length,1);c.renderVals().inventoryCatalog();
 assert.ok(c.renderVals().inv.length>10);c.state.itemTab='weapon';c.syncInventorySelection();
 assert.ok(c.renderVals().inv.length>10);assert.ok(c.renderVals().inv.every(row=>row.qty===0));assert.equal(c.p.inv.revolver,undefined);
 c.renderVals().inventoryOwned();assert.equal(c.state.sel,'smallkit');assert.equal(app.calls.length,0);}
});
test('beta102 owner entry resets version domain and exit cannot cache a sandbox as the real character',async()=>{
 const app=game(),c=app.instance;c.componentDidMount();await c._gameplayLoad;
 c.applyGameplay({player:{id:'player-original',cash:3120,energy:76,max_energy:100},state:{version:50,inv:{smallkit:1},equip:'fists'}});
 const saved=app.storage.get('zone.v2.save');
 c.onOwnerPlaytest({detail:{available:true,active:true,snapshot:{sessionId:'sandbox-A',gameplay:{player:{id:'owner-playtest-A',cash:1000000,energy:1000,max_energy:1000},state:{version:1,inv:{bat:3},equip:'bat'}}}}});
 assert.equal(c.p.playerId,'owner-playtest-A');assert.equal(c.p.inv.bat,3);assert.equal(c.gameplayVersion,1);c.save();assert.equal(app.storage.get('zone.v2.save'),saved);
 c.onOwnerPlaytest({detail:{available:true,active:false,snapshot:{active:false}}});c.save();
 assert.equal(c.p.playerId,'player-original');assert.equal(c.p.cash,3120);assert.doesNotMatch(app.storage.get('zone.v2.save'),/owner-playtest-A/);
});
test('beta102 jobs display database cooldown rather than a hardcoded client duration',()=>{
 const app=game({now:1800000}),c=app.instance;c.applyGameplay({player:{id:'player-jobs',energy:100,max_energy:100},state:{version:1,job:'grocer'},cooldowns:{actions:{job:{availableAtEpoch:1837}}}});c.runtimeConnection='connected';
 for(const lang of ['en','ar']){c.state.lang=lang;assert.equal(c.renderVals().job.disabled,true);assert.match(c.renderVals().job.reason,/37s/);}
});
test('beta102 model changes reuse the initialized iframe URL instead of reloading Three for every selection',()=>{
 const {instance:c}=game();const first=c.itemViewerUrl('knife');assert.match(first,/item=knife/);assert.equal(c.itemViewerUrl('revolver'),first);assert.equal(c.itemViewerUrl('smallkit'),'');
});
