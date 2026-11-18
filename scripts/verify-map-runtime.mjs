import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { loadLegacyScript } from './load-legacy-script.mjs';
import ZoneCompactDistrict from '../assets/city/compact-district.js';

const ZoneTerritoryGeometry = loadLegacyScript(new URL('../dist/territory-geometry.js', import.meta.url));

// Execute the shipped iframe functions with a small Mapbox/DOM adapter. These
// checks cover data and lifecycle behavior; a real browser still verifies WebGL.
function functionSource(source, name) {
  const start = source.search(new RegExp(`function\\s+${name}\\s*\\(`));
  if (start < 0) throw new Error(`Missing map function: ${name}`);
  let depth = 0, quote = '', escaped = false, comment = '';
  const open = source.indexOf('{', start);
  for (let i = open; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (comment === '//') { if (c === '\n') comment = ''; continue; }
    if (comment === '/*') { if (c === '*' && next === '/') { comment = ''; i++; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && (next === '/' || next === '*')) { comment = c + next; i++; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Unterminated map function: ${name}`);
}

export function verifyMapRuntime(source) {
  const failures = [];
  let checks = 0;
  function test(name, run) {
    checks++;
    try { run(); } catch (error) { failures.push(`${name}: ${error.message}`); }
  }
  function expect(value, message) { if (!value) throw new Error(message); }
  function context(names, values = {}) {
    const ctx = vm.createContext({ console, ZoneTerritoryGeometry, ZoneCompactDistrict, innerWidth:1024, lastData:null, selectedTerritory:null, districtCameraZoom:()=>18.5, sourcePolygon:raw=>raw.polygon||[], displayProjection:null, ll:(x,y)=>[-74+x*.001,40+y*.001], blockLL:(_block,p)=>p, pick:(raw,keys,fallback)=>{for(const key of keys)if(raw[key]!==undefined)return raw[key];return fallback;}, OVERVIEW_POIS:['bank','gym','alley','hospital','market','hq','home','missions'], overviewPoi:p=>['bank','gym','alley','hospital','market','hq','home','missions'].includes(p.id), pinDisplayed:p=>{return ctx.pinVisible(p)&&(ctx.overviewPoi(p)||ctx.map.getZoom()>=16.8);}, ZoneNativeCity: {setPerspective(){},ensureBuildings(){}}, CAMERA_MS: 180, frameSample: null, cameraSample:{cancel(){}}, factionFocus: null, ownershipData: { type: 'FeatureCollection', features: [] }, ownershipSignature: '', landmarkController: null, landmarkPending: null, syncLandmarkVisibility() {}, ...values });
    ctx.slowCameraActions=0;ctx.mapDisposed=false;ctx.landmarkWarmup=null;if(ctx.mapVisible===undefined)ctx.mapVisible=true;
    if(!ctx.document)ctx.document={hidden:false,body:{dataset:{}}};
    vm.runInContext([...new Set(['mapIsIllustrative',...names])].map(name => functionSource(source, name)).join('\n'), ctx);
    return ctx;
  }
  function expressions(value, path, visit) {
    if (!Array.isArray(value)) return;
    visit(value, path);
    value.forEach((child, i) => expressions(child, `${path}[${i}]`, visit));
  }

  test('Every generated paint/layout zoom expression uses a top-level camera curve', () => {
    const layers = [], sources = new Map();
    const canvasContext = new Proxy({}, { get: () => () => ({ data: new Uint8Array(4), width: 1, height: 1 }) });
    const map = {
      isStyleLoaded: () => true,
      getSource: id => sources.get(id),
      addSource: (id, data) => sources.set(id, { ...data, setData() {} }),
      getLayer: id => layers.find(layer => layer.id === id),
      addLayer: layer => layers.push(layer),
      hasImage: () => true,
      getStyle: () => ({ layers }),
    };
    const ctx = context(['ensureTerritoryLayers', 'ensurePoiLayers', 'territoryOpacity', 'overviewOpacity', 'rebuildOwnership', 'ownershipOpacity'], {
      map, territoryData: [], pinData: [], mapMode: 'territories',
      document: { body: { dataset: {} }, createElement: () => ({ getContext: () => canvasContext }) },
      territoryGeo: () => ({ type: 'FeatureCollection', features: [] }), focusedFactionId: () => 'vipers', emptyGeo: () => ({}), poiGeo: () => ({}), ensurePoiImage() {},
    });
    ctx.ensureTerritoryLayers(); ctx.ensurePoiLayers();
    expect(layers.some(layer => layer.id === 'zone-poi-icon' && layer.layout?.['text-field']?.[1] === 'label'), `Location names were not generated in their icon group: ${ctx.document.body.dataset.zonePoiErr || ''}`);
    for (const layer of layers) for (const section of ['paint', 'layout']) {
      for (const [name, expression] of Object.entries(layer[section] || {})) {
        const zoomPaths = [];
        expressions(expression, '', (item, path) => { if (item[0] === 'zoom') zoomPaths.push(path); });
        if (!zoomPaths.length) continue;
        const expected = expression[0] === 'interpolate' ? '[2]' : expression[0] === 'step' ? '[1]' : null;
        expect(zoomPaths.length === 1 && zoomPaths[0] === expected,
          `${layer.id}.${name} contains an illegal nested zoom expression.`);
      }
    }
  });

  test('Real vector 3D uses the same Streets v8 footprint source as flat buildings', () => {
    const style=ZoneCompactDistrict.createStyle(),buildings=style.layers.filter(layer=>layer['source-layer']==='building');
    expect(buildings.length===2&&buildings.every(layer=>layer.source==='district-streets'),'Flat and perspective must share genuine vector footprints.');
    const paint=buildings.find(layer=>layer.type==='fill-extrusion').paint,height=paint['fill-extrusion-height'],base=paint['fill-extrusion-base'];
    const evaluate=(e,p)=>!Array.isArray(e)?e:e[0]==='get'?p[e[1]]:e[0]==='to-number'?(Number.isFinite(Number(evaluate(e[1],p)))?Number(evaluate(e[1],p)):e[2]):e[0]==='min'?Math.min(...e.slice(1).map(v=>evaluate(v,p))):e[0]==='max'?Math.max(...e.slice(1).map(v=>evaluate(v,p))):NaN;
    expect(evaluate(height,{})===0&&evaluate(height,{height:12})===12&&evaluate(height,{height:90})===90,'Missing heights remain flat and known provider heights must not be flattened by an arbitrary cap.');
    expect(evaluate(height,{height:95,min_height:40})-evaluate(base,{height:95,min_height:40})===55&&paint['fill-extrusion-opacity']===1,'Raised building parts must retain their real 55m volume, rather than collapsing both base and top to18m or becoming translucent.');
  });

  test('District location links include their block-based POIs', () => {
    const ctx = context(['pinVisible', 'pinInScope'], { mapMode: 'places', activeCats: {}, territoryFilter: 'fin', hideFound: false, found: new Set() });
    expect(ctx.pinVisible({ id: 'bank', territory: 'ZC-001', districtId: 'fin', cat: 'fin' }), 'District filter discarded its locations.');
    expect(!ctx.pinVisible({ id: 'gym', territory: 'ZC-002', districtId: 'leisure', cat: 'misc' }), 'District filter leaked another district.');
    ctx.territoryFilter = 'ZC-001';
    expect(ctx.pinVisible({ id: 'bank', territory: 'ZC-001', districtId: 'fin', cat: 'fin' }), 'Block filtering stopped working.');
  });

  test('Hide found removes visited POIs from geometry and click picking', () => {
    const pin = { id: 'bank', cat: 'fin', _lngLat: [0, 0] };
    const ctx = context(['pinVisible', 'pinInScope', 'nearbyVisiblePin'], {
      mapMode: 'places', activeCats: {}, territoryFilter: null, hideFound: true,
      found: new Set(['bank']), pinData: [pin], map: { getLayer:()=>({}), queryRenderedFeatures:()=>[{properties:{id:'bank'}}], project: () => ({ x: 2, y: 2 }) },
    });
    expect(!ctx.pinVisible(pin), 'A visited POI remains visible.');
    expect(ctx.nearbyVisiblePin({ x: 2, y: 2 }) === null, 'A hidden visited POI remains selectable.');
    ctx.hideFound = false;
    expect(ctx.nearbyVisiblePin({ x: 2, y: 2 })?.id === 'bank', 'Show all must restore selection.');
  });

  test('Sidebar search and result counts exclude hidden visited locations', () => {
    const rows = ['bank', 'jobs'].map(id => ({
      dataset: { id }, hiddenByFilter: false,
      querySelector: () => ({ textContent: id }),
      classList: { toggle(_name, hidden) { rows.find(row => row.dataset.id === id).hiddenByFilter = hidden; } },
    }));
    const category = { style: {}, querySelectorAll: () => rows };
    const ctx = context(['filterSidebar', 'pinInScope'], {
      mapMode: 'places', territoryFilter: 'fin', hideFound: true, found: new Set(['bank']),
      pinById: { bank: { id: 'bank', territory: 'ZC-001', districtId: 'fin' }, jobs: { id: 'jobs', territory: 'ZC-002', districtId: 'fin' } },
      el: { search: { value: '' }, sClear: {}, fRes: {}, zempty: {} },
      document: { querySelectorAll: selector => selector === '.cat' ? [category] : rows.filter(row => !row.hiddenByFilter) },
      setCategoryExpanded() {}, L: key => key === 'results' ? ' found' : 'No places match',
    });
    ctx.filterSidebar(true);
    expect(rows[0].hiddenByFilter && !rows[1].hiddenByFilter, 'Hidden visited rows remain eligible for Enter selection.');
    expect(ctx.el.fRes.textContent === '1 found' && ctx.el.zempty.hidden, 'Result count includes hidden visited rows.');
    ctx.el.search.value = 'bank'; ctx.filterSidebar();
    expect(ctx.el.fRes.textContent === '0 found' && !ctx.el.zempty.hidden, 'Searching a hidden visited location must show no results.');
  });

  test('A hidden iframe defers its first camera fit until it has a viewport', () => {
    let width = 0, height = 0, fits = 0, resizes = 0;
    const ctx = context(['resizeMap'], {
      map: { getContainer: () => ({ clientWidth: width, clientHeight: height }), resize: () => resizes++ },
      didFit: false, territoryData: [{}], constrainCity(){},fitCity: () => { fits++; ctx.didFit = true; },
    });
    ctx.resizeMap();
    expect(fits === 0 && resizes === 0, 'The hidden 0x0 iframe changed the initial camera.');
    width = 900; height = 650; ctx.resizeMap(); ctx.resizeMap();
    expect(fits === 1 && resizes === 2, 'Showing/resizing must fit once and preserve the established camera.');
  });

  test('ZONE bounds include every server block without trimming territory data', () => {
    const blocks = Array.from({ length: 120 }, (_, i) => ({ id: `ZC-${i}`, _lngLat: true, polygon: [[-74 + i * .0004, 40.70 + i * .0006], [-73.999 + i * .0004, 40.701 + i * .0006]] }));
    const before = JSON.stringify(blocks), calls = [];
    const ctx = context(['constrainCity'], { cityBoundsSignature: '', blockLL: (_t, p) => p, document: { body: { dataset: {} } }, map: { setMaxBounds: bounds => calls.push(bounds) } });
    ctx.constrainCity(blocks);
    const [sw, ne] = calls[0];
    expect(blocks.every(t => t.polygon.every(p => p[0] > sw[0] && p[0] < ne[0] && p[1] > sw[1] && p[1] < ne[1])), 'A distant server-authored territory is outside the camera bounds.');
    expect(JSON.stringify(blocks) === before && blocks.length === 120, 'Camera framing removed or changed gameplay geometry.');
    expect(JSON.parse(ctx.document.body.dataset.zoneMapBounds).length === 2, 'Bounds are missing from renderer diagnostics.');
  });

  test('Base layer readiness cannot depend on the not-yet-installed city extrusion', () => {
    let writes=0;
    const base=['zone-city-ground','zone-blocks-fill','zone-ownership-fill','zone-block-feedback','zone-poi-icon','zone-poi-coin-reservations','zone-poi-icon-service','zone-poi-service-reservations','zone-poi-hitbox','zone-here-dot'];
    const ctx=context(['installCustomLayers'],{installingLayers:false,map:{isStyleLoaded:()=>true,getLayer:id=>base.includes(id)?{}:null},ensureTerritoryLayers(){writes++;},ensurePoiLayers(){writes++;},ensureBuildings(){writes++;},syncPoiSource(){writes++;},updateAdjacency(){writes++;},selectedTerritory:null});
    ctx.installCustomLayers();ctx.installCustomLayers();expect(writes===0,'Idle recovery repeatedly resets POI source before the native city can load.');
  });

  test('A throttled camera switches to immediate controls without changing city geometry', () => {
    const ctx=context(['recordCameraTransition'],{cameraTransitions:[],document:{body:{dataset:{}}}});
    ctx.recordCameraTransition({action:'city-3d',durationMs:185,firstFrameMs:16,maxIntervalMs:17});expect(ctx.CAMERA_MS===180,'Healthy rendering lost its short transition.');
    ctx.recordCameraTransition({action:'zoom-in',durationMs:1064,firstFrameMs:14,maxIntervalMs:18});expect(ctx.CAMERA_MS===180,'One cold load incorrectly disables animation.');
    ctx.recordCameraTransition({action:'zoom-out',durationMs:1064,firstFrameMs:14,maxIntervalMs:18});expect(ctx.CAMERA_MS===0,'Repeated stalls remain on subsequent controls.');
    expect(ctx.document.body.dataset.zoneMotionMode==='instant-low-frame-rate','Adaptive motion must be auditable.');
  });

  test('Layout/source movements cannot falsely disable the player camera, and timing history is bounded', () => {
    const ctx=context(['recordCameraTransition'],{cameraTransitions:[],document:{body:{dataset:{}}}});
    for(let i=0;i<35;i++)ctx.recordCameraTransition({sequence:i,action:'',durationMs:1000,firstFrameMs:null,maxIntervalMs:0});
    expect(ctx.CAMERA_MS===180,'An initialization or resize event disabled player animation.');
    const history=JSON.parse(ctx.document.body.dataset.zoneCameraHistory);
    expect(history.length===20&&history[0].sequence===15,'Camera diagnostics lost their bounded history.');
  });

  test('Keyboard movement uses the same motion budget without hijacking search fields', () => {
    const calls=[];
    const ctx=context(['handleCameraKey'],{RM:false,CAMERA_MS:0,map:{panBy:(delta,options)=>calls.push({delta,options}),getPitch:()=>35,getBearing:()=>0,easeTo:pose=>calls.push(pose),zoomIn:options=>calls.push(options),zoomOut:options=>calls.push(options)}});
    const event=key=>({key,target:{tagName:'CANVAS'},preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}});
    const right=event('ArrowRight');ctx.handleCameraKey(right);expect(calls[0].delta[0]===100&&calls[0].options.duration===0&&right.stopped,'Keyboard pan bypassed the responsive camera.');
    const rotate=event('ArrowUp');rotate.shiftKey=true;ctx.handleCameraKey(rotate);expect(calls[1].pitch===50,'Shift+Arrow tilt no longer works.');
    const search=event('ArrowRight');search.target.tagName='INPUT';ctx.handleCameraKey(search);expect(calls.length===2&&!search.prevented,'Typing in the map search moved the city.');
  });

  test('Ownership refreshes preserve established camera bounds and only geometry changes update them', () => {
    const blocks = [{ ownerId: 'vipers', polygon: [[-74, 40.7], [-73.98, 40.72]] }], calls = [];
    const ctx = context(['constrainCity'], { cityBoundsSignature: '', blockLL: (_t, p) => p, document: { body: { dataset: {} } }, map: { setMaxBounds: bounds => calls.push(bounds) } });
    ctx.constrainCity(blocks); blocks[0].ownerId = 'kings'; ctx.constrainCity(blocks);
    expect(calls.length === 1, 'Polling an ownership update reset the camera constraints.');
    blocks[0].polygon.push([-73.96, 40.75]); ctx.constrainCity(blocks);
    expect(calls.length === 2 && calls[1][1][0] > -73.96, 'New content geometry did not expand the playable camera boundary.');
  });

  test('Empty or malformed city geometry cannot corrupt valid camera bounds', () => {
    const calls = [];
    const ctx = context(['constrainCity'], { cityBoundsSignature: '', blockLL: (_t, p) => p, document: { body: { dataset: {} } }, map: { setMaxBounds: bounds => calls.push(bounds) } });
    ctx.constrainCity([]); ctx.constrainCity([{ polygon: [[NaN, 40], [181, 40], [-74, 90]] }]);
    expect(calls.length === 0 && ctx.cityBoundsSignature === '', 'Invalid points created a bad bounds constraint.');
  });

  test('Full city explicitly fits every authoritative block on desktop and phone', () => {
    const moves = [], blocks = [{id:'near'},{id:'distant'}];
    const ctx = context(['fitCity'], { didFit: true, RM: true, CAMERA_MS:180, innerWidth: 1024, fitOwnership:(list,duration,pitch,bearing)=>{moves.push({list,duration,pitch,bearing});return true;}, map: { getContainer: () => ({ clientWidth: 900, clientHeight: 356 }), getPitch:()=>0 } });
    ctx.fitCity([{}], false); expect(moves.length === 0, 'Background refresh refitted the established camera.');
    ctx.fitCity(blocks, true); ctx.innerWidth = 390; ctx.fitCity(blocks, true);
    expect(moves.length === 2 && moves.every(move=>move.list===blocks&&move.pitch===0&&move.duration===0), 'Full city cropped disconnected holdings or ignored reduced motion.');
    expect(moves[0].bearing===0&&moves[1].bearing===0,'Full city must stay north-up on both desktop and phone.');
    ctx.map.getPitch=()=>35;ctx.fitCity(blocks,true);expect(moves[2].list===blocks&&moves[2].pitch===35,'Full city must preserve a selected perspective too, rather than flatten the architecture.');
  });

  test('Full city directory accounts for every territory including disconnected holdings',()=>{
    const buttons=[],selected=[],directory={setAttribute(){},appendChild(button){buttons.push(button);}},classes=new Set();
    const blocks=[{id:'a',ownerId:'vipers',ownerName:'Vipers',isPlayer:true,color:'#80bb44'},{id:'island',ownerId:'vipers',ownerName:'Vipers',isPlayer:true,color:'#80bb44'},{id:'rival',ownerId:'kings',ownerName:'Kings',color:'#4567ab',contested:true},{id:'neutral',neutral:true,color:'#69717b'}];
    const ctx=context(['setCityOverview'],{territoryData:blocks,lang:'en',F:key=>key,C:key=>key,esc:value=>String(value),factionEmblem:()=>'',setFactionFocus:(id,move)=>selected.push({id,move}),document:{body:{dataset:{},classList:{toggle(key,active){if(active)classes.add(key);else classes.delete(key);}}},getElementById:()=>directory,createElement:()=>({setAttribute(){}})}});
    ctx.setCityOverview(true);expect(buttons.length===3&&directory.innerHTML.includes('4 blocks'),'Directory lost an owner or territory');
    expect(buttons[0].innerHTML.includes('2 holdings'),'Disconnected family holding was omitted');
    buttons[0].onclick();expect(selected[0].id==='vipers'&&selected[0].move===true,'Directory cannot reveal all real family holdings');
    ctx.setCityOverview(false);expect(!classes.has('cityOverviewMode'),'Returning to family leaves the overview layout active');
  });

  test('Hidden or empty focused map cannot steal the initial camera', () => {
    const moves = [];
    const ctx = context(['fitCity'], { didFit: false, RM: false, innerWidth: 390, openingFamilyAnchor: () => [0, 0], map: { getContainer: () => ({ clientWidth: 0, clientHeight: 0 }), resize() {}, easeTo: move => moves.push(move) } });
    ctx.fitCity([{}], true); ctx.map.getContainer = () => ({ clientWidth: 390, clientHeight: 360 }); ctx.fitCity([], true);
    expect(moves.length === 0 && !ctx.didFit, 'Hidden/empty ZONE map performed a camera fit.');
  });

  test('Projected atmosphere stays inside the viewport even behind the pitched camera', () => {
    const properties = {};
    let point = { x: Number.MAX_VALUE, y: Number.MAX_VALUE }, width = 1024, height = 600;
    const ctx = context(['syncLight'], {
      hereLL: [1, 2],
      map: { project: () => point, getContainer: () => ({ clientWidth: width, clientHeight: height }) },
      document: { querySelector: () => ({ style: { setProperty: (key, value) => { properties[key] = value; } } }) },
    });
    ctx.syncLight();
    expect(properties['--lx'] === '1024px' && properties['--ly'] === '600px', 'Behind-camera projection overflowed the CSS gradient.');
    point = { x: 123, y: 234 }; ctx.syncLight();
    expect(properties['--lx'] === '123px' && properties['--ly'] === '234px', 'An onscreen atmosphere anchor moved.');
    point = { x: -Number.MAX_VALUE, y: -Number.MAX_VALUE }; ctx.syncLight();
    expect(properties['--lx'] === '0px' && properties['--ly'] === '0px', 'Negative offscreen projection escaped the viewport.');
    point = { x: NaN, y: Infinity }; ctx.syncLight();
    expect(properties['--lx'] === '512px' && properties['--ly'] === '252px', 'Invalid projection must use the default atmosphere anchor.');
    width = height = 0; ctx.syncLight();
    expect(properties['--lx'] === '512px' && properties['--ly'] === '252px', 'Hidden viewport overwrote the last valid atmosphere anchor.');
  });

  test('Only typed messages from this iframe parent can replace map state', () => {
    const parent = {}, origin = 'https://zone.example';
    let renders = 0, receipts = 0;
    const ctx = context(['handleMapMessage'], {
      parent, location: { origin }, pinById: {}, render: () => renders++, receiveActionStatus: () => receipts++,
      scheduleResize() {}, stopDash() {}, startDash() {}, routeData: null,
    });
    const payload = { type: 'ZONE_MAP_DATA', blocks: [], zonePins: [] };
    ctx.handleMapMessage({ source: {}, origin, data: payload });
    ctx.handleMapMessage({ source: parent, origin: 'https://unrelated.example', data: payload });
    ctx.handleMapMessage({ source: parent, origin, data: { blocks: [] } });
    expect(renders === 0, 'An unrelated or untyped message replaced map data.');
    ctx.handleMapMessage({ source: parent, origin, data: payload });
    expect(renders === 1, 'The parent gameplay payload was rejected.');
    const receipt = { type: 'ZONE_MAP_ACTION_STATUS', blockId: 'ZC-001', status: 'success', message: 'Claimed' };
    ctx.handleMapMessage({ source: {}, origin, data: receipt });
    ctx.handleMapMessage({ source: parent, origin: 'https://unrelated.example', data: receipt });
    expect(receipts === 0, 'An unrelated frame can forge an action receipt.');
    ctx.handleMapMessage({ source: parent, origin, data: receipt });
    expect(receipts === 1, 'The real parent action response never reaches the drawer.');
  });

  test('Normalization preserves explicit unavailable eligibility despite a server action name', () => {
    const ctx = context(['normalizeBlock', 'pick', 'flag', 'sourcePolygon', 'sourceCentroid', 'sourceNeighbors', 'ownerId', 'ownerName', 'localText', 'playerFactionId', 'rivalColor', 'benefitOf', 'localReason'], {
      lang: 'en', C: key => key, NEUTRAL_COLOR: '#68717b', PLAYER_COLOR: '#78d628', RIVAL_COLORS: ['#123456'], ACTION_REASON_AR: {},
    });
    const raw = { id: 'ZC-001', polygon: [[-74,40],[-73,40],[-73,41]], action: 'claim', canAct: false, eligible: false, actionReason: 'Not enough energy.' };
    const normalized = ctx.normalizeBlock(raw, 0, {});
    expect(!normalized.canAct && !normalized.eligible && normalized.actionReason === raw.actionReason, 'An action name re-enabled a disabled eligibility badge.');
  });

  test('Bundled map data never assigns sample holdings or live actions to the visitor', () => {
    const ctx=context(['normalizeBlock','pick','flag','sourcePolygon','sourceCentroid','sourceNeighbors','ownerId','ownerName','localText','playerFactionId','rivalColor','benefitOf','localReason','illustrativeMessage','focusedFactionId'],{lang:'en',C:key=>key,NEUTRAL_COLOR:'#68717b',PLAYER_COLOR:'#78d628',RIVAL_COLORS:['#123456'],ACTION_REASON_AR:{},factionFocus:null});
    const raw={id:'ZC-001',polygon:[[-74,40],[-73,40],[-73,41]],ownerId:'vipers',isPlayerFaction:true,action:'reinforce',canAct:true,eligible:true,activeWar:{attackerScore:50000},benefit:{active:true,value:5}};
    for(const contextData of [{revision:'fallback-120-v1',playerFactionId:'vipers'},{territoryDataSource:'bundled',playerFactionId:'vipers'},{territoryAuthoritative:false,playerFactionId:'vipers'}]){
      const block=ctx.normalizeBlock(raw,0,contextData);ctx.lastData=contextData;
      expect(ctx.playerFactionId(contextData)===''&&!block.isPlayer&&!block.canAct&&!block.eligible,'Sample data became visitor holdings or actionable gameplay');
      expect(block.ownerId==='vipers'&&block.polygon.length===3,'Illustrative ownership or geometry was discarded');
      expect(block.activeWar===null&&!block.benefit.active&&/Illustrative map/.test(block.actionReason),'Illustrative conflict, rewards or action explanation claimed server authority');
      expect(ctx.focusedFactionId()==='*','Illustrative initial focus claimed the visitor owns a sample faction');
    }
    const server={territoryDataSource:'server',territoryAuthoritative:true,playerFactionId:'vipers'};
    expect(ctx.playerFactionId(server)==='vipers'&&ctx.normalizeBlock(raw,0,server).canAct,'Real server gameplay was disabled');
    ctx.lang='ar';expect(/خريطة توضيحية/.test(ctx.illustrativeMessage()),'Arabic preview explanation is missing');
  });

  test('Refreshing selected block data does not reopen a closed details panel', () => {
    let opens = 0;
    const block = { id: 'ZC-001', polygon: [[0, 0], [1, 0], [1, 1]], neighbors: [] };
    const ctx = context(['syncTerritories'], {
      districtData: [], territoryData: [], territoryById: {}, selectedTerritory: block,
      normalizeBlock: item => item, ensureTerritoryLayers() {}, territoryGeo: list => ({ features: list }),
      updateAdjacency() {}, renderTerritoryList() {}, updateProg() {}, closePanel() {}, renderFamily() {}, syncHoldingMarkers() {}, applyOwnershipStyle() {},
      selectTerritory: () => opens++, el: { panel: { classList: { contains: () => false } } },
      document: { body: { dataset: {} } }, map: { getSource: () => null, once() {}, setFeatureState() {} },
    });
    ctx.syncTerritories([block], {});
    expect(opens === 0, 'A routine data refresh reopened the dismissed panel.');
    expect(ctx.selectedTerritory.id === 'ZC-001', 'Refreshing must preserve the selected block.');
  });

  test('Layer recovery repairs a missing paired icon-and-label group once without recursive setup', () => {
    const readyLayers = new Set(['zone-city-ground', 'zone-blocks-fill', 'zone-ownership-fill', 'zone-block-feedback', 'zone-poi-hitbox', 'zone-here-dot', 'zone-buildings-3d', 'zroute-line']);
    let setups = 0, restoredSelection = 0;
    const ctx = context(['installCustomLayers'], {
      installingLayers: false, selectedTerritory: { id: 'ZC-001' },
      map: { isStyleLoaded: () => true, getLayer: id => readyLayers.has(id), setFeatureState: () => restoredSelection++ },
      ensureTerritoryLayers: () => { setups++; ctx.installCustomLayers(); },
      ensurePoiLayers: () => {readyLayers.add('zone-poi-icon');readyLayers.add('zone-poi-coin-reservations');readyLayers.add('zone-poi-icon-service');readyLayers.add('zone-poi-service-reservations');},
      ensureBuildings() {}, ensureRouteLayers() {}, syncPoiSource() {}, updateAdjacency() {},
    });
    ctx.installCustomLayers(); ctx.installCustomLayers();
    expect(setups === 1 && restoredSelection === 1, 'Layer recovery reentered setup, repeated work, or lost selection.');
    expect(ctx.installingLayers === false, 'The installation guard stayed locked.');
  });

  test('Hidden map pauses route animation and resumes it when shown', () => {
    let stops = 0, starts = 0, resizes = 0;
    const parent = {}, origin = 'https://zone.example';
    const ctx = context(['handleMapMessage'], {
      parent, location: { origin }, mapVisible: true, routeData: {}, pinById: {},
      stopDash: () => stops++, startDash: () => starts++, scheduleResize: () => resizes++, stopWarClock() {}, startWarClock() {},
    });
    ctx.handleMapMessage({ source: parent, origin, data: { type: 'ON_HIDE' } });
    expect(stops === 1 && ctx.mapVisible === false, 'Route animation kept running offscreen.');
    ctx.handleMapMessage({ source: parent, origin, data: { type: 'ON_SHOW' } });
    expect(starts === 1 && resizes === 1 && ctx.mapVisible, 'Showing the map did not restore the route and viewport.');
  });

  test('Direction preview retains endpoints without publishing a visible route overlay', () => {
    let writes = 0, stopped = false;
    const ctx = context(['drawRoute', 'clearRoute'], {
      routeData: null, map: { getSource: () => ({ setData: () => writes++ }) },
      startDash() {}, stopDash: () => { stopped = true; },
    });
    ctx.drawRoute([1, 2], [3, 4]);
    expect(ctx.routeData.from[0] === 1 && ctx.routeData.to[0] === 3 && writes === 0, 'Direction preview lost its endpoints or emitted overlay geometry.');
    ctx.clearRoute();
    expect(stopped && ctx.routeData === null && writes === 0, 'Route cleanup retained a destination or emitted overlay geometry.');
  });

  test('All 120 territory cells remain selectable without any visible grid layers', () => {
    const layers = [], sources = new Map();
    const blocks = Array.from({ length: 120 }, (_, n) => {
      const x = n % 12, y = Math.floor(n / 12);
      return { id: `ZC-${String(n + 1).padStart(3, '0')}`, ownerId: x < 6 ? 'vipers' : 'kings', renderColor: x < 6 ? '#c7ec79' : '#c47762', polygon: [[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1]], benefit: {} };
    });
    const ctx = context(['ensureTerritoryLayers', 'territoryGeo', 'territoryAt', 'rebuildOwnership', 'ownershipOpacity'], {
      territoryData: blocks, blockLL: (_block, point) => point, focusedFactionId: () => 'vipers', mapMode: 'territories',
      map: { isStyleLoaded: () => true, getSource: id => sources.get(id), addSource: (id, value) => sources.set(id, value), getLayer: id => layers.find(layer => layer.id === id), addLayer: layer => layers.push(layer), getStyle: () => ({ layers }) },
      document: { body: { dataset: {} } },
    });
    ctx.ensureTerritoryLayers(); ctx.ensureTerritoryLayers();
    expect(sources.get('zone-blocks').data.features.length === 120, 'Invisible geometry lost blocks.');
    const fills=layers.filter(layer=>layer.type==='fill'),selection=layers.find(layer=>layer.id==='zone-city-selection');
    expect(layers.length === 3 && fills.length === 3 && layers.find(layer => layer.id === 'zone-blocks-fill').paint['fill-opacity'] === 0, 'Ownership setup added grid lines or duplicated original hit geometry.');
    expect(fills.filter(layer => layer.id !== 'zone-blocks-fill').every(layer => layer.paint['fill-antialias'] === false && layer.paint['fill-outline-color'] === 'rgba(0,0,0,0)'), 'Ownership or interaction feedback paints polygon boundaries.');
    expect(!selection && !layers.some(layer=>layer.type==='line'&&layer.source==='zone-blocks'), 'Selection restored a visible engine block boundary.');
    const regions = sources.get('zone-ownership').data.features;
    expect(regions.length === 2 && regions.every(region => region.properties.blockCount === 60), 'Adjacent ownership did not become two coherent faction areas.');
    for (let n = 0; n < 120; n++) expect(ctx.territoryAt({ lng: n % 12 + 0.5, lat: Math.floor(n / 12) + 0.5 })?.id === blocks[n].id, `Block ${n + 1} is no longer selectable.`);
  });

  test('Family summary and framing derive only from actual holdings and neighbors', () => {
    const blocks = [
      { id: 'own', isPlayer: true, dailyRespect: 12, canAct: true, action: 'reinforce', neighbors: ['near'] },
      { id: 'near', isPlayer: false, dailyRespect: 900, canAct: true, action: 'claim', neighbors: ['own'] },
      { id: 'rival', isPlayer: false, dailyRespect: 200, canAct: false, action: '', neighbors: [] },
    ];
    const ctx = context(['familyMetrics', 'familyContextBlocks', 'inTerritoryScope', 'familyMarkerBlocks'], { territoryData: blocks, familyScope: 'family', selectedTerritory: null, inFocusFaction: block => block.isPlayer });
    const metrics = ctx.familyMetrics(blocks);
    expect(metrics.owned.length === 1 && metrics.respect === 12 && metrics.claimable === 1, 'Family metrics included rival respect or unavailable claims.');
    expect(ctx.familyContextBlocks().map(block => block.id).join(',') === 'own,near', 'Initial camera included distant rival territories.');
    expect(ctx.familyMarkerBlocks().map(block => block.id).join(',') === 'own,near', 'Family pins do not include nearby opportunities.');
    ctx.familyScope = 'nearby'; expect(!ctx.inTerritoryScope(blocks[0]) && ctx.inTerritoryScope(blocks[1]) && !ctx.inTerritoryScope(blocks[2]), 'Nearby scope lost actual adjacency/action rules.');
    ctx.familyScope = 'all'; expect(blocks.every(block => ctx.inTerritoryScope(block)), 'All scope hides a block.');
    ctx.selectedTerritory = blocks[2]; expect(ctx.familyMarkerBlocks()[0].id === 'rival', 'Selected block does not receive a discoverable pin.');
  });

  test('Holding pins avoid overlap, offscreen projection and hidden keyboard targets', () => {
    const items = [{ x: 100, y: 130 }, { x: 110, y: 132 }, { x: Number.MAX_VALUE, y: Number.MAX_VALUE }, { x: 300, y: 170 }].map((point, i) => ({ block: { id: String(i), _centroidLngLat: point }, element: { style: {} } }));
    const ctx = context(['packFamilyMarkers','layoutHoldingMarkers'], { holdingMarkers: items, selectedTerritory: null, innerWidth: 1024, map: { getContainer: () => ({ clientWidth: 600, clientHeight: 360 }), project: point => point, getLayer: () => undefined, queryRenderedFeatures: () => [] } });
    ctx.layoutHoldingMarkers();
    expect(items[0].element.style.visibility === 'visible' && items[3].element.style.visibility === 'visible', 'Separated holding pins disappeared.');
    expect(items[1].element.style.visibility === 'hidden' && items[1].element.tabIndex === -1, 'Overlapping pin remains a hidden keyboard target.');
    expect(items[2].element.style.visibility === 'hidden', 'Behind-camera marker escaped viewport bounds.');
  });

  test('Opening focuses the largest real connected district; All holdings includes the distant island', () => {
    const own = { id: 'own', isPlayer: true, dailyRespect: 12, neighbors: ['near'], polygon: [[1,1],[2,1],[2,2],[1,2]] };
    const island = { id: 'island', isPlayer: true, dailyRespect: 4, neighbors: [], polygon: [[4,4],[5,4],[5,5],[4,5]] };
    const near = { id: 'near', neighbors: [], polygon: [[2,1],[3,1],[3,2],[2,2]] };
    const moves = [];
    const ctx = context(['familyMetrics', 'familyContextBlocks', 'fitFamily', 'openingFamilyAnchor', 'openingFamilyBlocks', 'fitOwnership', 'refineOwnershipCamera'], {
      districtCameraZoom:()=>18.5,
      territoryData: [own, island, near], innerWidth: 1024, RM: true, didFit: false, blockLL: (_block, point) => point,
      ownershipData: { features: [{properties:{blockIds:['island'],anchor:[4.5,4.5]}},{properties:{blockIds:['own','second'],anchor:[1.5,1.5]}}] },
      familyAnchor: () => [9,9],
      mapboxgl: { LngLatBounds: class { constructor() { this.points=[]; } extend(point) { this.points.push(point); } isEmpty() { return !this.points.length; } } },
      map: { getContainer: () => ({ clientWidth: 700, clientHeight: 500 }), getPitch:()=>35, resize() {}, jumpTo: options => moves.push(options), fitBounds: (bounds, options) => moves.push({bounds, ...options}) },
    });
    ctx.territoryData.push({...own,id:'second'});
    ctx.fitFamily(false); ctx.fitFamily(false);
    expect(moves.length === 1 && moves[0].bounds.points.some(p=>p[0]===2&&p[1]===2) && !moves[0].bounds.points.some(p=>p[0]===5&&p[1]===5) && moves[0].pitch === 35 && moves[0].bearing === 0, 'Opening must frame the entire connected family district in perspective without pulling in its distant island.');
    ctx.innerWidth = 390; ctx.fitFamily(true);
    expect(moves[1].padding.left === 12 && moves[1].padding.top === 54 && moves[1].pitch === 35 && moves[1].bearing === 0 && moves[1].bounds.points.some(p=>p[0]===5&&p[1]===5), 'All holdings must retain every island and its current perspective with reserved control space.');
  });

  test('3D remains an explicit reversible camera choice with reduced-motion support', () => {
    const moves = []; let pitch = 0, closes = 0;
    const ctx = context(['toggle3D'], { RM: true, closeSide: () => { closes++; }, map: { getZoom:()=>15,getPitch: () => pitch, easeTo: options => { moves.push(options); pitch = options.pitch; } } });
    ctx.toggle3D(); ctx.toggle3D();
    expect(moves.length === 2 && moves[0].pitch === 35 && moves[1].pitch === 0 && moves.every(move => move.duration === 0) && closes === 2, '3D must toggle both directions without forcing animation or removing camera freedom.');
  });

  test('Rotated ownership framing fills available space without clipping any source vertex', () => {
    let zoom = 12, center = { lng: 0, lat: 0 };
    const points = [[-3,0],[0,2],[3,0],[0,-2]], padding = { left: 32, right: 52, top: 68, bottom: 58 };
    const map = {
      getContainer: () => ({ clientWidth: 900, clientHeight: 500 }), getZoom: () => zoom,
      getCenter: () => center, getPitch: () => 30, getBearing: () => -12,
      project(point) { const scale=40*2**(zoom-12); return { x:450+(point[0]-center.lng)*scale, y:250-(point[1]-center.lat)*scale }; },
      unproject(point) { const scale=40*2**(zoom-12); return { lng:center.lng+(point[0]-450)/scale, lat:center.lat-(point[1]-250)/scale }; },
      jumpTo(camera) { zoom=camera.zoom; center=camera.center; },
    };
    const ctx = context(['refineOwnershipCamera'], { map, document: { body: { dataset: {} } } });
    ctx.refineOwnershipCamera(points, padding, 14.65);
    const pixels = points.map(point => map.project(point)), height = Math.max(...pixels.map(p=>p.y))-Math.min(...pixels.map(p=>p.y));
    expect(height > 300 && zoom > 12.7, 'Conservative geographic rectangle leaves most of the available family viewport unused.');
    expect(pixels.every(p=>p.x>=padding.left&&p.x<=900-padding.right&&p.y>=padding.top&&p.y<=500-padding.bottom), 'Projection refinement clips an actual holding vertex.');
  });

  test('Idle recovery retries deferred city model installation after GeoJSON setup settles', () => {
    const calls = [];
    const ctx = context(['recoverMapLayers'], { installCustomLayers: () => calls.push('layers'), ensureCityLandmarks: () => calls.push('models') });
    ctx.recoverMapLayers(); expect(calls.join(',') === 'layers,models', 'Model installation is stranded after a temporarily incomplete style.');
  });

  test('Holding names use actual places, preserve custom admin names and localize fallbacks', () => {
    const ctx = context(['blockDisplayName', 'blockLandmark'], { pinData: [{ territory: 'ZC-001', label: 'Central Bank' }], C: key => key });
    const generic = { id: 'ZC-001', code:'ZC-001',name: 'Block ZC-001', districtName: 'Downtown', benefit: { label: 'Gym training',active:true } };
    expect(ctx.blockDisplayName(generic) === 'Central Bank', 'Known place names were replaced by technical block IDs.');
    expect(ctx.blockDisplayName({ ...generic, name: 'Family safehouse' }) === 'Family safehouse', 'Admin-authored name was overwritten.');
    ctx.pinData = [];
    expect(ctx.blockDisplayName({ ...generic, name: 'القطاع ZC-001', districtName: 'الوسط', benefit: { label: 'تدريب النادي',active:true } }) === 'الوسط · تدريب النادي', 'Arabic fallback exposes an untranslated active bonus.');
    expect(ctx.blockDisplayName({...generic,benefit:{label:'Weapon supply',active:false}})==='Downtown · ZC-001','Unavailable production leaked into a territory display name.');
  });

  test('Only selected holding receives a DOM button while native POIs retain separate geographic detail targets', () => {
    const landmark = { id: 'hall', territory: 'own', label: 'City Hall', _lngLat: [12, 34] };
    const other = { id: 'shop', territory: 'own', label: 'Shop', _lngLat: [13, 35] };
    const owned = { id: 'own', isPlayer: true, code: 'ZC-001', ownerName: 'Family', _centroidLngLat: [90, 90] };
    const empty = { id: 'empty', code: 'ZC-002', ownerName: 'Neutral', _centroidLngLat: [16, 38] };
    const selected = [], removed = [];
    const ctx = context(['syncHoldingMarkers', 'blockLandmark', 'holdingAnchor'], {
      pinData: [landmark, other], holdingMarkers: [{ marker: { remove: () => removed.push(true) } }], mapMode: 'territories', selectedTerritory: null,
      selectedTerritory:owned, familyMarkerBlocks: () => [owned, empty], contextualFamilyPins: () => [landmark, other], layoutHoldingMarkers() {},
      blockDisplayName: block => block.id, F: key => key, esc: value => String(value), iconSvg: () => '', factionEmblem: () => '', map: {},
      selectTerritory: block => selected.push(block.id), selectPin: pin => selected.push(pin.id),
      document: { createElement: () => ({ attributes: {}, setAttribute(key, value) { this.attributes[key] = value; } }) },
      mapboxgl: { Marker: class { constructor(options) { this.element = options.element; this.element.setAttribute('role', 'img'); } setLngLat(point) { this.point = point; return this; } addTo() { return this; } } },
    });
    ctx.syncHoldingMarkers();
    const markers = ctx.holdingMarkers;
    expect(removed.length === 1 && markers.length === 1, 'Overview markers duplicate native POIs or obscure unselected land.');
    expect(markers[0].block === owned && markers[0].marker.point === landmark._lngLat, 'Selected holding lost its real landmark anchor.');
    expect(markers[0].element.attributes.role === 'button', 'The selected holding action is announced as an image.');
    markers[0].element.onclick({stopPropagation(){}});expect(selected.join(',')==='own','Selected holding lost its action.');
  });

  test('Faction region markers retain button semantics after Mapbox initializes them', () => {
    const region = { properties: { ownerId: 'vipers', ownerName: 'Sand Vipers', renderColor: '#78d628', blockCount: 6, anchor: [12, 34] } };
    const chosen = [];
    const ctx = context(['syncHoldingMarkers'], {
      ownershipData: { features: [region] }, holdingMarkers: [], mapMode: 'territories', map: {getZoom:()=>18}, innerWidth: 1024,
      focusedFactionId: () => 'vipers', familyMarkerBlocks: () => [], contextualFamilyPins: () => [], regionMarkerAnchor: item => item.properties.anchor,
      layoutHoldingMarkers() {}, setFactionFocus: owner => chosen.push(owner), F: key => key, esc: String, factionEmblem: () => '',
      document: { createElement: () => ({ attributes: {}, style: { setProperty() {} }, setAttribute(key, value) { this.attributes[key] = value; } }) },
      mapboxgl: { Marker: class { constructor(options) { this.element = options.element; this.element.setAttribute('role', 'img'); } setLngLat() { return this; } addTo() { return this; } } },
    });
    ctx.syncHoldingMarkers();
    const button = ctx.holdingMarkers[0].element;
    expect(button.type === 'button' && button.attributes.role === 'button', 'A faction selection action is announced as a static image.');
    expect(button.attributes['aria-label'].includes('Sand Vipers') && button.attributes['aria-label'].includes('6'), 'The interactive emblem lost its faction name or holding count.');
    button.onclick({ stopPropagation() {} });
    expect(chosen[0] === 'vipers', 'The accessible faction emblem lost its real selection action.');
  });

  test('Wide faction emblems reserve their actual label width during collision layout', () => {
    const items = [200, 370, 590].map(x => ({ lngLat: { x, y: 160 }, region: {}, element: { offsetWidth: 210, offsetHeight: 48, style: {} } }));
    const ctx = context(['packFamilyMarkers','layoutHoldingMarkers'], { holdingMarkers: items, selectedTerritory: null, innerWidth: 1024, regionMarkerAnchor: () => null, map: { getContainer: () => ({ clientWidth: 900, clientHeight: 500 }), project: point => point, getLayer: () => undefined, queryRenderedFeatures: () => [] } });
    ctx.layoutHoldingMarkers();
    expect(items[0].element.style.visibility === 'visible' && items[1].element.style.visibility === 'hidden' && items[2].element.style.visibility === 'visible', 'Wide family nameplates overlap or hide a separated emblem.');
  });

  test('A partially visible rival uses a real point inside its own region for its nameplate', () => {
    const region = { properties: { anchor: [9,2], blockIds: ['rival'] }, geometry: { type: 'Polygon', coordinates: [[[3,1],[10,1],[10,3],[3,3],[3,1]]] } };
    const ctx = context(['regionMarkerAnchor'], {
      territoryById: { rival: { _centroidLngLat: [6.5,2], polygon: [[3,1],[10,1],[10,3],[3,3]] } },
      blockLL: (_block, point) => point, holdingMarkers: [],
      map: { getContainer: () => ({ clientWidth: 800, clientHeight: 400 }), project: point => ({x:point[0]*100,y:point[1]*100}), getLayer: () => undefined, queryRenderedFeatures: () => [] },
    });
    const anchor = ctx.regionMarkerAnchor(region, 80);
    expect(anchor[0] < 7.2 && anchor[1] > .88 && anchor[1] < 3.42 && ZoneTerritoryGeometry.contains(region.geometry, anchor), 'Visible rival name is culled or placed outside its actual land.');
    ctx.holdingMarkers = [{ region: {}, lngLat: anchor, element: { offsetWidth: 160, style: {} } }];
    const other = ctx.regionMarkerAnchor(region, 80);
    expect(Math.abs(other[0]-anchor[0])*100 >= 168 || Math.abs(other[1]-anchor[1])*100 >= 54, 'Rival marker steals the focused emblem position.');
  });

  test('Faction focus uses only server family IDs and retains disconnected ownership', () => {
    const moves = [], selected = [], blocks = [{ ownerId: 'vipers' }, { ownerId: 'kings' }, { ownerId: 'kings' }, { neutral: true }];
    const ctx = context(['focusedFactionId', 'inFocusFaction', 'setFactionFocus'], {
      lastData: { factions: [{ id: 'vipers' }, { id: 'kings' }] }, playerFactionId: () => 'vipers', familyScope: 'family', innerWidth: 1024, RM: true,
      ownershipData: { features: [{ properties: { ownerId: 'kings', blockCount: 1, anchor: [9, 9] } }, { properties: { ownerId: 'kings', blockCount: 3, anchor: [2, 3] } }] },
      territoryData: blocks, fitOwnership: (blocks, duration, pitch) => moves.push({ blocks, duration, pitch }),
      deselect: () => selected.push('clear'), renderFamily() {}, filterSidebar() {}, applyOwnershipStyle() {}, syncHoldingMarkers() {},
      map: { getPitch: () => 17, flyTo: options => moves.push(options) },
    });
    expect(ctx.inFocusFaction(blocks[0]) && !ctx.inFocusFaction(blocks[1]), 'Default family focus ignores the player family.');
    ctx.setFactionFocus('unknown', true); expect(moves.length === 0 && selected.length === 0, 'Invented family ID changed the view.');
    ctx.setFactionFocus('kings', true);
    expect(blocks.filter(ctx.inFocusFaction).length === 2 && moves[0].blocks.length === 2 && moves[0].pitch === 17, 'Rival focus lost disconnected holdings or user pitch.');
    ctx.setFactionFocus('neutral', false); expect(ctx.inFocusFaction(blocks[3]) && !ctx.inFocusFaction(blocks[1]), 'Neutral filter includes owned land.');
    ctx.setFactionFocus('*', false); expect(blocks.every(ctx.inFocusFaction) && ctx.familyScope === 'all', 'All families hides authoritative blocks.');
  });

  test('Ownership display refreshes after a transfer and caches unchanged source geometry', () => {
    const ctx = context(['rebuildOwnership'], { document: { body: { dataset: {} } } });
    const feature = { type: 'Feature', id: 'one', properties: { ownerId: 'vipers', renderColor: '#c7ec79' }, geometry: { type: 'Polygon', coordinates: [[[0,0],[1,0],[1,1],[0,1],[0,0]]] } };
    const geo = { type: 'FeatureCollection', features: [feature] }, initial = ctx.rebuildOwnership(geo);
    expect(ctx.rebuildOwnership(geo) === initial, 'Unchanged state rebuilds geometry unnecessarily.');
    feature.properties.ownerId = 'kings'; feature.properties.renderColor = '#9b89c2';
    const updated = ctx.rebuildOwnership(geo);
    expect(updated !== initial && updated.features[0].properties.ownerId === 'kings' && updated.features[0].properties.renderColor === '#9b89c2', 'Transferred territory retains its previous emblem/color.');
    expect(ctx.document.body.dataset.zoneOwnershipBlocks === '1', 'Ownership diagnostics lost the authoritative block total.');
  });

  test('Ownership emphasis follows the chosen family or neutral view without changing color identity', () => {
    let focus = 'vipers';
    const ctx = context(['ownershipOpacity'], { focusedFactionId: () => focus, mapMode: 'territories' });
    function evaluate(expr, properties) {
      if (!Array.isArray(expr)) return expr;
      if (expr[0] === 'get') return properties[expr[1]];
      if (expr[0] === 'boolean') return typeof evaluate(expr[1], properties) === 'boolean' ? evaluate(expr[1], properties) : expr[2];
      if (expr[0] === '==') return evaluate(expr[1], properties) === evaluate(expr[2], properties);
      if (expr[0] === 'case') { for (let n = 1; n < expr.length - 1; n += 2) if (evaluate(expr[n], properties)) return evaluate(expr[n + 1], properties); return evaluate(expr.at(-1), properties); }
      throw new Error(`Unsupported expression ${expr[0]}`);
    }
    const opacity = properties => evaluate(ctx.ownershipOpacity(), properties);
    expect(opacity({ ownerId: 'vipers' }) > opacity({ ownerId: 'kings' }), 'Focused family has no visual emphasis.');
    const backgroundNeutral = opacity({ neutral: true }); focus = 'neutral';
    expect(opacity({ neutral: true }) > backgroundNeutral, 'Unclaimed area selector cannot reveal neutral geography.');
    const before=opacity({ownerId:'vipers'});ctx.mapMode = 'places'; expect(opacity({ownerId:'vipers'})===before && before>=.15, 'Places browsing must retain readable family ownership.');
  });

  test('City models pause offscreen and retain roof plans in flat view without redundant repaint calls', () => {
    const visibility = []; let pitch = 30;
    const ctx = context(['syncLandmarkVisibility'], { landmarkController: { setVisible: value => visibility.push(value) }, landmarkVisibleState: null, mapVisible: true, document: { hidden: false }, map: { getPitch: () => pitch,getZoom:()=>17,getLayer:()=>null } });
    ctx.syncLandmarkVisibility(); ctx.syncLandmarkVisibility();
    ctx.mapVisible = false; ctx.syncLandmarkVisibility(); ctx.syncLandmarkVisibility();
    ctx.mapVisible = true; ctx.syncLandmarkVisibility(); pitch = 0; ctx.syncLandmarkVisibility(); expect(visibility.at(-1) === true, 'Flat camera loses the authored roof plans.');
    pitch = 35; ctx.document.hidden = true; ctx.syncLandmarkVisibility(); ctx.document.hidden = false; ctx.syncLandmarkVisibility();
    expect(visibility.join(',') === 'true,false,true,false,true', 'Static models repaint repeatedly, remain visible while hidden, or fail to resume.');
  });

  test('Every family holding remains in the scrollable rail with an explicit locate action', () => {
    const makeNode = () => ({ children: [], attributes: {}, style: { setProperty() {} }, set innerHTML(value) { if (value === '') this.children = []; }, setAttribute(key, value) { this.attributes[key] = value; }, appendChild(child) { this.children.push(child); } });
    const nodes = new Map(), located = [], selected = [];
    const blocks = Array.from({ length: 8 }, (_, n) => ({ id: String(n), code: `ZC-${n}`, isPlayer: true, dailyRespect: 10, ownerName: 'Family' }));
    const ctx = context(['renderFamily', 'familyMetrics', 'inTerritoryScope', 'territoryActionLabel'], {
      territoryData: blocks, familyScope: 'family', lastData: { factions: [{ id: 'family', name: 'Family' }] }, lang: 'en',
      focusedFactionId: () => 'family', inFocusFaction: block => block.isPlayer, renderFactionSelector() {}, playerFactionId: () => 'family', localText: value => value, F: key => key, C: key => key, esc: value => String(value), blockDisplayName: block => block.code,
      selectTerritory: block => selected.push(block.id), locateHolding: block => located.push(block.id), filterSidebar() {}, syncHoldingMarkers() {}, setMode() {},
      document: { body: { dataset: {} }, createElement: makeNode, getElementById(id) { if (!nodes.has(id)) nodes.set(id, makeNode()); return nodes.get(id); } },
    });
    ctx.renderFamily();
    const rows = nodes.get('familyList').children;
    expect(rows.length === 8 && nodes.get('familyListCount').textContent === '8 holdings', 'The last two holdings remain truncated or the count is unclear.');
    rows[7].children[0].onclick(); rows[7].children[1].onclick();
    expect(selected[0] === '7' && located[0] === '7', 'The eighth holding is not selectable and locatable.');
    expect(rows[7].children[1].textContent === 'Locate', 'Rail lacks an explicit map location control.');
    ctx.lang = 'ar'; ctx.renderFamily();
    expect(nodes.get('familyList').children[7].children[1].textContent === 'حدد الموقع', 'Arabic locate controls remain English.');
    blocks.push({ id: 'opportunity', code: 'ZC-099', isPlayer: false, canAct: true, action: 'claim', actionLabel: 'Claim', actionEnergyCost: 10, dailyRespect: 5, ownerName: 'Neutral' });
    ctx.renderFamily();
    expect(typeof nodes.get('familyOpportunities')?.onclick === 'function', 'The ready-to-claim count cannot open actual expansion opportunities.');
    nodes.get('familyOpportunities').onclick();
    expect(ctx.familyScope === 'nearby' && nodes.get('familyList').children.length === 1, 'The claim shortcut did not expose the eligible block.');
  });

  test('Switching the mobile browse tab keeps its results open', () => {
    let closed = 0;
    const modes = [], ctx = vm.createContext({ el: { modePlaces: {}, modeTerritories: {} }, innerWidth: 390,
      setMode: mode => modes.push(mode), deselect() {}, closeSide: () => closed++ });
    for (const control of ['modePlaces', 'modeTerritories']) {
      const handler = source.match(new RegExp(`el\\.${control}\\.onclick=function\\(\\)\\{[^\\n]+`))[0];
      vm.runInContext(handler, ctx); ctx.el[control].onclick();
    }
    expect(modes.join(',') === 'places,territories' && closed === 0, 'A tab click closes the browse drawer before its locations or territory rows can be used.');
  });

  test('Explicit locate centers the projected landmark at useful vector street detail', () => {
    const landmark = { territory: 'own', _lngLat: [12, 34] }, moves = [], actions = [];
    const ctx = context(['locateHolding', 'holdingAnchor', 'blockLandmark'], {
      pinData: [landmark], innerWidth: 1024, RM: true,districtCameraZoom:()=>18.5,
      selectTerritory: block => actions.push(block.id), closePanel: () => actions.push('close'),
      map: { getZoom: () => 16.2, flyTo: options => moves.push(options) },
    });
    ctx.locateHolding({ id: 'own', _centroidLngLat: [90, 90] });
    expect(moves[0].center === landmark._lngLat && moves[0].zoom === 17.4 && !('pitch' in moves[0]) && !('bearing' in moves[0]), 'Locate uses the cell center, fails to reveal vector detail or resets camera orientation.');
    expect(actions.join(',') === 'own,close' && moves[0].duration === 0, 'Locate obscures the map on mobile or ignores reduced motion.');
  });

  test('3D toggle reflects manual pitch, preserves center and bearing, and reveals authored street detail', () => {
    const attributes = {}, moves = []; let pitch = 35;
    const ctx = context(['sync3DControl', 'toggle3D'], {
      lang: 'en', RM: true, closeSide() {}, el: { streetView: { setAttribute: (key, value) => { attributes[key] = value; }, getAttribute: key => attributes[key] } },
      map: { getZoom:()=>15,getPitch: () => pitch, easeTo: options => { moves.push(options); pitch = options.pitch; } },
    });
    ctx.sync3DControl(); expect(attributes['aria-pressed'] === 'true' && attributes['aria-label'] === 'Show flat map', 'Initial perspective claims 3D is off.');
    ctx.toggle3D(); ctx.sync3DControl(); expect(pitch === 0 && attributes['aria-pressed'] === 'false', 'First click fails to flatten the map.');
    ctx.toggle3D(); expect(pitch === 35 && moves.every(move => !('center' in move) && !('bearing' in move) && !('zoom' in move)), 'Flat and tilted district views must preserve the current zoom, center and bearing. Complete overview geometry replaces the old forced street zoom.');
    pitch = 0; ctx.lang = 'ar'; ctx.sync3DControl(); expect(attributes['aria-label'] === 'إمالة خريطة المدينة', 'Manual pitch or Arabic label is stale.');
  });

  test('Map loading heading inherits Arabic before Mapbox or server data arrives', () => {
    const nodes = new Map();
    const ctx = context(['initializeMapLocale'], {
      URLSearchParams, location: { search: '' }, parent: { document: { documentElement: { lang: 'ar' } } },
      document: { documentElement: {}, getElementById(id) { if (!nodes.has(id)) nodes.set(id, {}); return nodes.get(id); } },
    });
    expect(ctx.initializeMapLocale() === 'ar' && ctx.document.documentElement.dir === 'rtl', 'Loading screen ignores parent Arabic locale.');
    expect(nodes.get('familyName').textContent === 'خريطة توضيحية' && nodes.get('familyEyebrow').textContent === 'للقراءة فقط' && /خريطة توضيحية/.test(nodes.get('mapPreviewNotice').textContent), 'Before server data the Arabic map claims player ownership or omits its preview warning.');
    ctx.location.search = '?lang=en'; expect(ctx.initializeMapLocale() === 'en', 'Explicit standalone locale is ignored.');
  });

  test('Unavailable server actions stay unavailable without synthesizing capture commands', () => {
    const ctx = context(['pick', 'flag', 'localText', 'ownerId', 'ownerName', 'playerFactionId', 'rivalColor', 'sourcePolygon', 'sourceCentroid', 'sourceNeighbors', 'benefitOf', 'normalizeBlock'], {
      lang: 'en', NEUTRAL_COLOR: '#68717b', PLAYER_COLOR: '#78d628', RIVAL_COLORS: ['#d99332'],
      C: key => key, localReason: value => value, blockLL: (_block, point) => point,
    });
    const raw = { id: 'ZC-001', action: null, polygon: [[0, 0], [1, 0], [1, 1]], version: 4 };
    const unavailable = ctx.normalizeBlock(raw, 0, { playerFactionId: null });
    expect(unavailable.action === '' && !unavailable.canAct && !unavailable.eligible, 'A null server action became an enabled capture button.');
    const claim = ctx.normalizeBlock({ ...raw, action: 'claim' }, 0, { playerFactionId: 'family' });
    expect(claim.action === 'claim' && claim.canAct && claim.version === 4, 'A server claim lost its action or concurrency version.');
    expect(!ctx.normalizeBlock({ ...raw, action: 'claim', canAct: false }, 0, {}).canAct, 'Read-only preview enabled a gameplay action.');
  });

  test('Family context locations use actual visible points, category filters and visited state', () => {
    const pins = Array.from({ length: 8 }, (_, n) => ({ id: String(n), cat: 'shop', _lngLat: { x: 200 + n * 20, y: 180 } }));
    pins.push({ id: 'behind', cat: 'shop', _lngLat: { x: Number.MAX_VALUE, y: Number.MAX_VALUE } });
    pins.push({ id: 'offscreen', cat: 'shop', _lngLat: { x: -2, y: 30 } });
    const ctx = context(['contextualFamilyPins'], { pinData: pins, found: new Set(['5']), hideFound: true, activeCats: {}, map: { getContainer: () => ({ clientWidth: 600, clientHeight: 430 }), project: point => point } });
    const visible = ctx.contextualFamilyPins();
    expect(visible.length === 5 && visible.every(pin => !['5', 'behind', 'offscreen'].includes(pin.id)), 'Family locations include hidden/behind-camera points or exceed the sparse limit.');
    expect(visible.every(pin => pins.includes(pin)), 'Family context invented new place coordinates.');
    ctx.activeCats.shop = false;
    expect(ctx.contextualFamilyPins().length === 0, 'Category visibility does not apply to family context pins.');
    ctx.activeCats.shop = true; ctx.mapMode = 'territories'; ctx.map.getZoom = () => 12.8;
    expect(ctx.contextualFamilyPins().length === 0, 'Generic POIs compete with territory identities at overview zoom.');
  });

  test('Location actions use real destination labels and disable unavailable services', () => {
    const messages = [], node = () => ({ dataset: {}, setAttribute() {}, style: { removeProperty() {} }, classList: { remove() {}, add() {}, toggle() {} } });
    const el = Object.fromEntries(['pGo', 'pName', 'pCat', 'pIco', 'pRib', 'pMark', 'pView', 'panel', 'pMeta'].map(key => [key, node()]));
    const ctx = context(['selectPin', 'pinDestinationLabel'], {
      el, lang: 'en', selectedTerritory: null, selected: null, found: new Set(), lastData: {}, hereLL: null,
      pinColor: () => '#000000', iconSvg: () => '', L: key => key, map: { setFeatureState() {} },
      document: { querySelector: node }, clearRoute() {}, hideHud() {}, openPanel() {}, syncHoldingMarkers() {}, stopWarClock() {}, hav: () => 20, drawRoute() {}, showHud() {},
      parent: { postMessage: (message, origin) => messages.push({ message, origin }) }, location: { origin: 'https://zone.example' },
    });
    ctx.selectPin({ id: 'church', label: 'Church', screen: 'church', screenAvailable: false });
    ctx.el.pGo.onclick();
    expect(ctx.el.pGo.disabled && ctx.el.pGo.textContent === 'Service currently unavailable' && messages.length === 0, 'Unavailable location emitted navigation or lacks a clear state.');
    ctx.selectPin({ id: 'sweetshop', label: 'Sweet Shop', screen: 'market', screenLabel: 'Item Market', screenAvailable: true });
    ctx.el.pGo.onclick();
    expect(!ctx.el.pGo.disabled && ctx.el.pGo.textContent === 'Open Item Market', 'CTA hides the real destination behind the location name.');
    expect(messages[0].message.zoneGo === 'market' && messages[0].origin === 'https://zone.example', 'Available location lost its validated route or origin.');
    ctx.hereLL = [0, 0];
    ctx.selectPin({ id: 'bank', label: 'Central Bank', screen: 'bank', screenLabel: 'Bank', _lngLat: [1, 1] });
    ctx.el.pGo.onclick();
    expect(messages.length === 2 && messages[1].message.zoneGo === 'bank', 'Open location requires an unexpected second click when a player location exists.');
    ctx.lang = 'ar'; expect(ctx.pinDestinationLabel({ label: 'متجر', screenLabel: 'سوق العناصر' }) === 'افتح سوق العناصر', 'Arabic navigation label was not localized.');
  });

  test('Territory actions stay pending across selection changes and show their real response', () => {
    const messages = [], feedback = { dataset: {} }, button = { setAttribute() {} };
    const block = { id: 'ZC-001', action: 'claim', version: 4, canAct: true, actionLabel: 'Claim', actionEnergyCost: 10 };
    const ctx = context(['requestTerritoryAction', 'updateActionFeedback', 'receiveActionStatus', 'territoryActionLabel'], {
      territoryActionState: {}, pendingTerritoryAction: null, selectedTerritory: block, lang: 'en', C: key => key,
      el: { pGo: button, pFeedback: feedback }, announce() {}, location: { origin: 'https://zone.example' },
      parent: { postMessage: (message, origin) => messages.push({ message, origin }) },
    });
    ctx.requestTerritoryAction(block); ctx.requestTerritoryAction(block);
    expect(messages.length === 1 && button.disabled && feedback.textContent.includes('Working'), 'Repeated clicks can send duplicate mutations or do not show progress.');
    expect(messages[0].message.zoneTerritoryAction.expectedVersion === 4, 'Command does not preserve the version the player selected.');
    ctx.selectedTerritory = { ...block, id: 'ZC-002' }; ctx.updateActionFeedback(); ctx.requestTerritoryAction(ctx.selectedTerritory);
    expect(button.disabled && messages.length === 1, 'Selecting another block bypasses the active request lock.');
    ctx.receiveActionStatus({ blockId: block.id, status: 'error', message: 'Not enough energy.' });
    expect(!button.disabled && ctx.pendingTerritoryAction === null, 'Rejected action leaves all blocks locked.');
    ctx.selectedTerritory = block; ctx.updateActionFeedback();
    expect(feedback.textContent === 'Not enough energy.' && feedback.dataset.status === 'error', 'Failure feedback is lost when returning to the block.');
    ctx.requestTerritoryAction(block);
    ctx.receiveActionStatus({ blockId: block.id, status: 'success', message: 'Block claimed. Energy: 90.' });
    expect(feedback.textContent === 'Block claimed. Energy: 90.' && !button.disabled, 'Success is invented or real response is hidden.');
  });

  test('War details show authoritative scores, energy price, localized rule and remaining time', () => {
    const ctx = context(['warDetails', 'warTimeRemaining', 'territoryActionLabel'], {
      lang: 'en', esc: value => String(value), localText: value => value, C: key => key,
      lastData: { factions: [{ id: 'a', name: 'Family A' }, { id: 'b', name: 'Family B' }] },
    });
    const war = { attackerFactionId: 'a', defenderFactionId: 'b', attackerScore: 50000, defenderScore: 100000, targetScore: 250000, endsAt: '2030-01-01T02:30:00Z' };
    const html = ctx.warDetails({ activeWar: war });
    expect(html.includes('Family A') && html.includes('Family B') && html.includes('50,000 / 250,000') && html.includes('100,000 / 250,000') && html.includes('72 hours'), 'War card omits actual factions, scores or timeout rule.');
    expect(ctx.warTimeRemaining(war, Date.parse('2030-01-01T00:00:00Z')) === '2h 30m remaining', 'Countdown uses the wrong unit or deadline.');
    expect(ctx.warTimeRemaining(war, Date.parse('2030-01-02T00:00:00Z')) === 'Awaiting server resolution', 'Expired client timer invented a winner.');
    expect(ctx.territoryActionLabel({ canAct: true, actionLabel: 'Assault', actionEnergyCost: 25 }) === 'Assault · 25 energy', 'Action price is hidden before confirmation.');
    ctx.lang = 'ar';
    expect(ctx.warDetails({ activeWar: war }).includes('المدافع') && ctx.warTimeRemaining(war, Date.parse('2030-01-01T00:00:00Z')).includes('متبقي'), 'War state is not localized.');
    expect(ctx.territoryActionLabel({ canAct: true, actionLabel: 'تعزيز', actionEnergyCost: 5 }) === 'تعزيز · 5 طاقة', 'Arabic action price is missing.');
  });

  test('War countdown owns only one timer and stops when the panel or map is hidden', () => {
    let running = 0, updates = 0;
    const ctx = context(['startWarClock', 'stopWarClock'], {
      warClock: null, mapVisible: true, selectedTerritory: { activeWar: {} }, document: { hidden: false },
      el: { panel: { classList: { contains: () => true } } }, updateWarClock: () => updates++, setInterval: () => ++running, clearInterval: () => running--,
    });
    ctx.startWarClock(); ctx.startWarClock();
    expect(running === 1 && updates === 2, 'Repeated drawer rendering duplicated the countdown timer.');
    ctx.mapVisible = false; ctx.startWarClock();
    expect(running === 0 && ctx.warClock === null, 'Hidden map retained a countdown timer.');
    ctx.mapVisible = true; ctx.document.hidden = true; ctx.startWarClock();
    expect(running === 0, 'Background document started a new countdown timer.');
  });

  test('Native Mapbox controls and canvas labels switch between Arabic and English', () => {
    const nodes = new Map();
    const node = () => ({ attrs: {}, setAttribute(key, value) { this.attrs[key] = value; }, firstElementChild: { setAttribute() {} } });
    const canvas = node(),retry=node(),message=node();
    const ctx = context(['localizeMapControls'], { lang: 'ar', document:{getElementById:id=>id==='districtSurfaceRetry111'?retry:message}, map: { getCanvas: () => canvas, getContainer: () => ({ querySelector: selector => { if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); } }) } });
    ctx.localizeMapControls();
    expect(nodes.get('.mapboxgl-ctrl-zoom-in').attrs['aria-label'] === 'تكبير الخريطة' && nodes.get('.mapboxgl-ctrl-attrib-button').attrs['aria-label'] === 'إظهار معلومات الخريطة', 'Native control accessible labels stayed English.');
    expect(retry.textContent==='إعادة عرض التفاصيل'&&message.textContent.includes('تفاصيل المباني'),'Building-detail recovery copy must follow Arabic too.');
    ctx.lang = 'en'; ctx.localizeMapControls();
    expect(nodes.get('.mapboxgl-ctrl-zoom-in').attrs['aria-label'] === 'Zoom in' && canvas.attrs['aria-label'] === 'Interactive family city map', 'Switching back to English retained Arabic labels.');
    expect(retry.textContent==='Retry detail'&&message.textContent.startsWith('Some building detail'),'Building-detail recovery copy must return to English.');
  });

  test('Benefits preserve engine data but only active bonuses appear in player panels', () => {
    const ctx = context(['pick', 'localText', 'benefitOf', 'benefitCard'], { lang: 'en', C: key => key, esc: value => String(value) });
    const planned = ctx.benefitOf({ benefit: { type: 'cash_income', value: 18000, unit: 'cash/hour', label: 'Cash flow', active: false } });
    expect(!planned.active && ctx.benefitCard(planned)==='', 'An unavailable production descriptor leaked into the player panel.');
    const active = ctx.benefitOf({ benefit: { type: 'gym_bonus', value: 350, unit: 'basis-points', label: 'Training', active: true } });
    expect(active.active && active.displayValue === '3.5 %' && !ctx.benefitCard(active).includes('Planned benefit'), 'Server-backed bonus was mislabeled or its basis points became a whole percent.');
    ctx.lang = 'ar';
    const arabic = ctx.benefitOf({ benefit: { value: 18000, unit: 'cash/hour', label: 'تدفق نقدي', active: false } });
    expect(arabic.displayValue.includes('نقد / ساعة') && !arabic.displayValue.includes('cash') && ctx.benefitCard(arabic)==='', 'Arabic player panel exposes unavailable production.');
  });

  test('Detail lifecycle releases mobile summary space and restores it on dismissal', () => {
    const bodyClasses = new Set(), panelClasses = new Set();
    const classes = set => ({ add: name => set.add(name), remove: name => set.delete(name) });
    let resized = 0, stopped = 0;
    const panel = { classList: classes(panelClasses), setAttribute() {}, contains: () => false };
    const ctx = context(['openPanel', 'closePanel', 'territoryActionLabel'], {
      lang: 'en', C: key => key, el: { panel }, scheduleResize: () => resized++, stopWarClock: () => stopped++,
      document: { body: { classList: classes(bodyClasses) }, querySelector: () => ({ classList: { remove() {} } }) },
    });
    ctx.openPanel('block');
    expect(bodyClasses.has('detailsOpen') && panelClasses.has('on') && !panel.inert, 'Detail drawer did not release the mobile family header space.');
    ctx.closePanel();
    expect(!bodyClasses.has('detailsOpen') && !panelClasses.has('on') && panel.inert && resized === 2 && stopped === 1, 'Dismissed drawer left the header hidden or failed to resize the map.');
    expect(ctx.territoryActionLabel({ isPlayer: true, control: 100, canAct: false }) === 'Family controlled', 'Fully controlled family block has an ambiguous unavailable label.');
  });

  return { failures, checks };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const source = readFileSync(new URL('../dist/city-map-torn.html', import.meta.url), 'utf8');
  const result = verifyMapRuntime(source);
  result.failures.forEach(failure => console.error(`- ${failure}`));
  console.log(`Map runtime regressions: ${result.checks - result.failures.length}/${result.checks} passed.`);
  if (result.failures.length) process.exitCode = 1;
}
