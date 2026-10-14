import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyMapRuntime } from './verify-map-runtime.mjs';
import { verifyMapAtlas } from './verify-map-atlas.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const paths = {
  index: join(root, 'index.html'),
  map: join(root, 'dist', 'city-map-torn.html'),
  icons: join(root, 'dist', 'map-icons.js'),
  database: join(root, 'engine', 'src', 'Core', 'Persistence', 'Database.php'),
  territories: join(root, 'engine', 'src', 'Core', 'Territories', 'TerritoryService.php'),
  router: join(root, 'engine', 'router.php'),
};

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};
const source = (path, label) => {
  check(existsSync(path), `Missing ${label}: ${path}`);
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
};

const index = source(paths.index, 'parent application');
const map = source(paths.map, 'map iframe');
const icons = source(paths.icons, 'canonical icon registry');
const database = source(paths.database, 'territory seed');
const territories = source(paths.territories, 'territory service');
const router = source(paths.router, 'API router');
const designCss = source(join(root, 'assets', 'zone-design.css'), 'shared visual system');

// An iframe query key does not invalidate its separately cached JS requests.
// Check the actual URL graph for the application-owned map entry points.
const iframeRef = index.match(/data-map-src="(dist\/city-map-torn\.html[^\"]*)"/)?.[1];
const mapUrl = new URL(iframeRef || 'dist/city-map-torn.html', 'https://zone.test/');
const mapRevision = mapUrl.searchParams.get('v');
check(!!mapRevision, 'The map iframe needs a release cache revision.');
const localMapScripts = [...map.matchAll(/<script\s+src="([^\"]+)"/g)].map(match => match[1]).filter(ref => !/^https?:/.test(ref));
const rendererRef = localMapScripts.find(ref => /\/compact-district\.js\?/.test(ref));
const rendererSource = source(join(root, 'assets', 'city', 'compact-district.js'), 'compact vector district renderer');
for (const [label, ref, base] of localMapScripts.map(ref => [ref, ref, mapUrl]).concat([['compact vector renderer', rendererRef, mapUrl]])) {
  const assetUrl = new URL(ref || '', base);
  check(!!ref && assetUrl.searchParams.get('v') === mapRevision,
    `${label} must request the same cache revision as the iframe; iframe cache keys do not propagate to scripts.`);
  check(existsSync(join(root, decodeURIComponent(assetUrl.pathname))), `Missing versioned map asset: ${assetUrl.pathname}`);
}

function balancedBlockAfter(text, marker) {
  const markerAt = typeof marker === 'string' ? text.indexOf(marker) : text.search(marker);
  if (markerAt < 0) return '';
  const openAt = text.indexOf('{', markerAt);
  if (openAt < 0) return '';
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = openAt; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1] || '';
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        i++;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      i++;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      i++;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) return text.slice(openAt, i + 1);
    }
  }
  return '';
}

function functionBody(text, names) {
  for (const name of names) {
    const body = balancedBlockAfter(text, new RegExp(`function\\s+${name}\\s*\\(`));
    if (body) return body;
  }
  return '';
}

function contextAfter(text, marker, length = 500) {
  const at = text.indexOf(marker);
  return at < 0 ? '' : text.slice(at, at + length);
}

function numericOption(text, name) {
  const match = text.match(new RegExp(`${name}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`));
  return match ? Number(match[1]) : Number.NaN;
}

const cameraMove = /\b(?:fitCity|fitTerritory|fitBounds|flyTo|easeTo|jumpTo)\s*\(/;

// Server data contract. The browser is not allowed to invent four blocks or
// collapse the city back into six decorative district polygons.
const columnCount = Number(database.match(/\$columns\s*=\s*(\d+)/)?.[1]);
const rowCount = Number(database.match(/\$rows\s*=\s*(\d+)/)?.[1]);
check(columnCount === 12 && rowCount === 10 && columnCount * rowCount === 120,
  'Territory seed must generate exactly 12 x 10 = 120 capturable blocks.');
check(database.includes("sprintf('ZC-%03d'"), 'Territory seed must assign stable ZC-001 through ZC-120 block IDs.');
check(database.includes('neighbors_json') && database.includes('[[-1, 0], [1, 0], [0, -1], [0, 1]]'),
  'Territory seed must persist explicit four-way block adjacency.');
check(database.includes("['vipers', 'Sand Vipers'") && database.includes("'#78d628'"),
  'The seeded player faction must use the canonical green #78d628.');
check(/NEUTRAL_COLOR\s*=\s*['"]#68717b['"]/.test(territories),
  'The server territory service must publish canonical neutral grey #68717b.');
for (const field of ['neighbors', 'benefits', 'ownerFactionId', 'ownerColor', 'state', 'version', 'action', 'actionReason']) {
  check(territories.includes(`'${field}'`), `Server territory snapshot is missing field: ${field}.`);
}
check(router.includes("$path === '/api/v1/city/map'"), 'Router must expose GET /api/v1/city/map.');
check(router.includes("/api/v1/territories/(ZC-[0-9]{3})/action") && router.includes("'expectedVersion'"),
  'Router must expose version-checked block action commands.');

// Parent to iframe contract. DISTRICTS can remain for navigation and POI copy,
// but it must never be transformed into the gameplay territory payload.
check(index.includes("fetch('/api/v1/city/map'"), 'Parent must load the live server-authored territory snapshot.');
check(/snapshot\.blocks\.length\s*<\s*120/.test(index), 'Parent must reject incomplete snapshots with fewer than 120 blocks.');
check(/for\s*\(let row\s*=\s*0;\s*row\s*<\s*10/.test(index) && /for\s*\(let column\s*=\s*0;\s*column\s*<\s*12/.test(index),
  'Bundled offline snapshot must also contain a complete 120-block city.');
check(index.includes("type:'ZONE_MAP_DATA'") && /postMessage\([^;]*\bblocks\b/.test(index),
  'Parent must post a typed ZONE_MAP_DATA message containing block entities.');
check(!/const\s+territories\s*=\s*DISTRICTS\.map/.test(index),
  'Regression: six DISTRICTS must not be repackaged as capturable territories.');
check(index.includes("'/api/v1/territories/'") && index.includes('expectedVersion:Number(block.version)'),
  'Parent must send block actions to the server with the selected block version.');
check(index.includes("d.type === 'ZONE_MAP_CLAIM_BLOCK'") || index.includes("d.type==='ZONE_MAP_CLAIM_BLOCK'"),
  'Parent must handle typed claim/action messages from the map iframe.');

// The iframe must consume blocks directly. Old zone-territories layers and
// data.territories fallbacks would silently restore the six-district map.
check(/\bdata\.blocks\b/.test(map), 'Map renderer must consume data.blocks from ZONE_MAP_DATA.');
check(/sync(?:Territories|Blocks|BlockData)\([^;\n]*data\.blocks/.test(map),
  'Map render path must pass data.blocks into the block synchronizer.');
check(!/\bdata\.territories\b/.test(map), 'Regression: map renderer must not fall back to a six-territory payload.');
check(!/zone-territories-(?:fill|outline|label|contested)/.test(map),
  'Regression: legacy zone-territories aggregate layers must be removed.');
check(map.includes("addSource('zone-blocks'") || map.includes('addSource("zone-blocks"'),
  'Mapbox must render the 120-block GeoJSON source.');
for (const role of ['fill']) {
  check(new RegExp(`id\\s*:\\s*['"]zone-blocks?-${role}['"]`).test(map),
    `Mapbox block layer is missing: ${role}.`);
}
check(/map\.on\(['"]click['"],\s*['"]zone-blocks?-fill['"]/.test(map) || /map\.on\(['"]click['"],\s*function\(e\)[\s\S]{0,340}?territoryAt\(e\.lngLat\)/.test(map),
  'Every rendered block must be directly selectable.');
check(/feature-state['"],?\s*['"]selected|\['"]feature-state['"],\s*['"]selected['"]/.test(map),
  'Selected block must receive a distinct feature-state treatment.');

// Ordinary POIs must live in Mapbox GeoJSON and symbol layers. HTML markers
// stay screen-aligned while the map pitches, which makes icons look pasted on.
check(map.includes("addSource('zone-pois'") || map.includes('addSource("zone-pois"'),
  'Mapbox must expose one zone-pois GeoJSON source for ordinary locations.');
check(/getSource\(['"]zone-pois['"]\)[\s\S]{0,180}?setData|\bzonePoisSource\b/.test(map),
  'Live POI updates must refresh the zone-pois GeoJSON source.');
const poiLayers = {};
for (const role of ['halo', 'icon', 'hitbox']) {
  const single = balancedBlockAfter(map, `id:'zone-poi-${role}'`) || balancedBlockAfter(map, `id:"zone-poi-${role}"`);
  poiLayers[role] = single;
  check(Boolean(single), `Mapbox POI layer is missing: zone-poi-${role}.`);
}
// Names now belong to the icon's symbol group, not an independent placement.
poiLayers.label = poiLayers.icon + balancedBlockAfter(map, 'var nameLayout=');
check(/Object\.assign\([^\n]*nameLayout/.test(poiLayers.icon), 'The core icon must own its label placement.');
check(/type\s*:\s*['"]circle['"]/.test(poiLayers.halo)
    && /circle-pitch-alignment['"]?\s*:\s*['"]viewport['"]/.test(poiLayers.halo)
    && /circle-pitch-scale['"]?\s*:\s*['"]viewport['"]/.test(poiLayers.halo),
  'POI halos retain readable screen size and orientation while anchored to geographic locations.');
check(/type\s*:\s*['"]symbol['"]/.test(poiLayers.icon) && /['"]icon-image['"]/.test(poiLayers.icon),
  'POI icon layer must render registered Mapbox images, not DOM glyphs.');
check(/['"]icon-size['"]\s*:\s*\.74/.test(poiLayers.icon), 'Overview icons retain readable screen size at every zoom.');
check(/['"]icon-allow-overlap['"]\s*:\s*true/.test(poiLayers.icon)
    && /['"]icon-ignore-placement['"]\s*:\s*false/.test(poiLayers.icon),
  'The eight core POI glyphs must remain visible and reserve shared collision space for lower priority labels.');
check(/if\(id==='zone-poi-icon'\)layer\.layout\['icon-allow-overlap'\]=false/.test(map),
  'Secondary POI icons must retain collision decluttering.');
check(/['"]icon-pitch-alignment['"]\s*:\s*['"]viewport['"]/.test(poiLayers.icon),
  'POI icons stay upright and readable during pitch.');
check(/type\s*:\s*['"]symbol['"]/.test(poiLayers.label) && /['"]text-field['"]/.test(poiLayers.label),
  'POI labels must render through a Mapbox symbol layer.');
check(/['"]text-size['"]\s*:\s*12/.test(poiLayers.label), 'Core location labels retain a readable 12px size.');
check(/['"]text-allow-overlap['"]\s*:\s*false/.test(poiLayers.label)
    && /['"]text-ignore-placement['"]\s*:\s*false/.test(poiLayers.label),
  'POI labels must use collision-aware placement.');
check(/['"]text-pitch-alignment['"]\s*:\s*['"](?:map|viewport)['"]/.test(poiLayers.label),
  'POI labels must declare their pitch alignment explicitly.');
check(/type\s*:\s*['"]circle['"]/.test(poiLayers.hitbox)
    && /['"]circle-opacity['"]\s*:\s*0(?:\.0+)?\b/.test(poiLayers.hitbox),
  'POI hitbox layer must provide transparent, map-native interaction targets.');
const renderedPinSelection=functionBody(map,['nearbyVisiblePin']);
check(/\['zone-poi-icon','zone-poi-icon-service','zone-poi-icon-detail'\]/.test(renderedPinSelection) && /map\.queryRenderedFeatures\(area,\{layers:layers\}\)/.test(renderedPinSelection) && /pin&&pinDisplayed\(pin\)/.test(renderedPinSelection) && !/map\.project\(pin\._lngLat\)/.test(renderedPinSelection) && !map.includes("['zone-poi-hitbox','zone-poi-hitbox-detail'].forEach"), 'Only collision-accepted rendered symbols may own location clicks, at their actual rooftop elevation; hidden ground hitboxes must not steal territory taps.');
check(/function nearbyVisiblePin\(point\)/.test(map) && /var pin=nearbyVisiblePin\(e\.point\)/.test(map) && /if\(pin\)\{[^}]*activatePin\(pin\);return;\}/.test(map),
  'Visible location icons must take priority over the block beneath them, including pitched 3D views.');
const activatedPin=functionBody(map,['activatePin']);
check(/parent!==window/.test(activatedPin) && /p\.screenAvailable!==false&&p\.screen/.test(activatedPin) && /parent\.postMessage\(\{zoneGo:p\.screen,MARKER_CLICK:p\.id,v:1\},location\.origin\)/.test(activatedPin) && /selectPin\(p\)/.test(activatedPin),
  'One embedded location icon click must open its own available destination, while standalone previews and unavailable services retain details.');
check(/\[hidden\]\s*\{\s*display\s*:\s*none\s*!important\s*\}/.test(map),
  'Hidden map controls must not remain visible through author display styles.');
check(/el\.search\.onkeydown\s*=\s*function\(e\)[\s\S]{0,450}?mapMode===['"]territories['"][\s\S]{0,250}?el\.territories\.querySelectorAll\(['"]\.terr['"]\)/.test(map),
  'Enter in territory search must select a visible block, not a hidden location.');
check(/row\.addEventListener\(['"]click['"],openLoc\)/.test(map),
  'The whole location list row must be tappable, not just its text.');
check(/actionReason:localReason\(/.test(map) && map.includes('ACTION_REASON_AR'),
  'Arabic territory details must localize server action reasons.');
check(!/travelCost|L\(['"]cost['"]\)/.test(map) && /L\(['"]distance['"]\)/.test(map),
  'Location navigation must not advertise a fare that the parent game never charges.');
for (const [, inlineScript] of map.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
  try { new Function(inlineScript); } catch (error) { failures.push(`Map inline JavaScript syntax error: ${error.message}`); }
}
check(/map\.addImage\s*\(/.test(map) && /['"]icon-image['"][^\n}]*\['"]get['"]/.test(poiLayers.icon),
  'Canonical semantic icons must be registered with Mapbox and selected from feature data.');
const ordinaryPoiLoop = balancedBlockAfter(map, /pins\.forEach\s*\(\s*function\s*\(/);
check(!ordinaryPoiLoop || !/new\s+mapboxgl\.Marker\s*\(/.test(ordinaryPoiLoop),
  'Regression: ordinary POIs must not be rendered with new mapboxgl.Marker inside the pin loop.');

// Ownership colors are gameplay state. Neutral is grey, the current faction is
// green, and rival blocks retain the authoritative faction colors from data.
check(map.includes('#68717b'), 'Map renderer must use canonical grey #68717b for neutral blocks.');
check(map.includes('#78d628'), 'Map renderer must use canonical green #78d628 for the player faction.');
check(/ownerColor|renderColor/.test(map), 'Block fill color must be derived from ownership data.');
check(!/isPlayer\s*\?\s*PLAYER_COLOR/.test(map),
  'Map renderer must not override the server faction palette with a synthetic player color.');

// Free camera contract. Users can pan, wheel-zoom, rotate, pitch, use touch,
// and recover the focused ZONE view only through the explicit reset control.
const mapConfig = balancedBlockAfter(map, 'new mapboxgl.Map(');
check(Boolean(mapConfig), 'Mapbox constructor configuration could not be inspected.');
for (const option of ['dragPan', 'scrollZoom', 'boxZoom', 'dragRotate', 'keyboard', 'doubleClickZoom', 'touchZoomRotate', 'touchPitch']) {
  check(new RegExp(`${option}\\s*:\\s*true`).test(mapConfig), `Free camera option must be enabled: ${option}.`);
}
check(numericOption(mapConfig, 'pitch') === 0, 'The Torn-style strategy map must open overhead; 3D is an explicit player choice.');
check(numericOption(mapConfig, 'bearing') === 0, 'The strategy map must open north-up so controls and locations are immediately readable.');
check(numericOption(mapConfig, 'maxPitch') >= 60, 'Map camera must allow at least 60 degrees of pitch freedom.');
check(numericOption(mapConfig, 'minZoom') >= 13 && numericOption(mapConfig, 'minZoom') <= 14 && map.includes('constrainCity(territoryData)'), 'City overview must allow the full authored city to fit on a phone and remain bounded.');
check(/constrainCity\(territoryData\)/.test(map) && /map\.setMaxBounds\(bounds\)/.test(map), 'Camera bounds must cover the server-authored playable city.');
check(/NavigationControl\(\{[^}]*visualizePitch\s*:\s*true/.test(map),
  'Navigation control must expose pitch and compass feedback.');
check(/map\.dragRotate\.enable\(\)/.test(map) && /map\.touchZoomRotate\.enable\(\)/.test(map),
  'Mouse rotation and touch rotation must be explicitly active.');
check(map.includes('id="cityReset"') && /cityReset\.onclick\s*=\s*function\s*\([^)]*\)\s*\{[\s\S]{0,320}?fitCity/.test(map),
  'Focused ZONE fitting must remain available through an explicit reset control.');
check(rendererSource.includes("type:'fill-extrusion'") && rendererSource.includes("'source-layer':'building'") && rendererSource.includes('mapbox://mapbox.mapbox-streets-v8'), 'Perspective uses genuine Streets v8 building footprints, heights and vector tiles.');
check(map.includes("'fill-opacity':0"), 'Territory geometry must remain invisible.');
check(!/setConfigProperty\s*\(/.test(map),
  'The classic dark-v11 basemap must not receive Standard-only import configuration.');
check(/id:'zone-blocks-fill',type:'fill',source:'zone-blocks'/.test(map) && /function overviewOpacity\(/.test(map),
  'The clickable full-city ownership layer must remain above the basemap.');
check(/function territoryAt\(point\)/.test(map) && /var territory=territoryAt\(e\.lngLat\)/.test(map),
  'Block selection must resolve from authoritative polygon geometry even when 3D buildings obscure the rendered fill.');
check(map.includes('id="streetView"') && /function view3D\(center\)[\s\S]{0,160}?pitch:38/.test(map), 'Optional 3D control must use the restrained 38 degree camera.');
check(map.includes('id="pView"') && /pView\.onclick\s*=\s*function\(\)\{closePanel\(\);view3D\(t\._centroidLngLat\)/.test(map),
  'Selected blocks need a mobile-accessible 3D view action inside the detail panel.');
check(!/id:['"](?:zone-blocks-(?:outline|adjacent|contested|hatch|eligible|current|label)|zone-adjacency|zroute-)/.test(map), 'Visible territory/grid/adjacency/route overlays must not return.');
check(!/map\.on\(['"]move['"],\s*syncLight\)/.test(map) && !/animation\s*:\s*wet\b/.test(map),
  'Full-screen lighting must not repaint on every camera frame or animate forever.');
check(!/territoryData\.forEach/.test(functionBody(map, ['updateAdjacency'])),
  'Changing block selection must not update feature state for all 120 blocks.');
check(/if\s*\(announced\)\s*return/.test(map) && /mapInstanceId\s*!==\s*this\._mapInstanceId/.test(index),
  'Map startup handshake must not resend the same 120-block payload repeatedly.');
check(map.includes('id="sideClose"') && map.includes('id="panelX"') && /sideClose\.onclick\s*=/.test(map) && /panelX\.onclick\s*=/.test(map),
  'Map controls and detail panels must each have a visible close action.');
check(/function closeSide\([^)]*\)[\s\S]{0,330}?aria-expanded/.test(map) && /function openSide\([^)]*\)[\s\S]{0,330}?aria-expanded/.test(map),
  'Map control drawer must expose correct open and closed states.');
check(/function setCategoryExpanded\([^)]*\)/.test(map) && /list\.inert\s*=\s*!open/.test(map),
  'Collapsed location categories must not leave hidden rows keyboard-accessible.');
check(/function closePanel\([^)]*\)[\s\S]{0,320}?aria-hidden/.test(map) && /function openPanel\([^)]*\)[\s\S]{0,320}?aria-hidden/.test(map),
  'Detail panel open and close states must remain accessible.');

const modeBody = functionBody(map, ['setMode', 'changeMode']);
const blockSelectionBody = functionBody(map, ['selectBlock', 'selectTerritory']);
const pinSelectionBody = functionBody(map, ['selectPin', 'selectPlace']);
const renderBody = functionBody(map, ['render', 'renderMap', 'applyMapData']);
check(Boolean(modeBody) && !cameraMove.test(modeBody), 'Changing map mode must not move or refit the camera.');
check(Boolean(blockSelectionBody) && !cameraMove.test(blockSelectionBody), 'Selecting a block must not move or refit the camera.');
check(Boolean(pinSelectionBody) && !cameraMove.test(pinSelectionBody), 'Selecting a location must not take control of the camera.');
check(Boolean(renderBody) && (!cameraMove.test(renderBody) || /!didFit[\s\S]{0,160}?fitCity\s*\(/.test(renderBody)),
  'Live data refresh may fit once on first data load, but must preserve an established user camera.');
const onShow = contextAfter(map, "d.type==='ON_SHOW'", 420) || contextAfter(map, "d.type === 'ON_SHOW'", 420);
check(Boolean(onShow) && !cameraMove.test(onShow), 'ON_SHOW may resize the canvas but must not refit the camera.');
const fullscreen = contextAfter(map, "'fullscreenchange'", 420) || contextAfter(map, '"fullscreenchange"', 420);
check(Boolean(fullscreen) && !cameraMove.test(fullscreen), 'Fullscreen changes may resize the canvas but must preserve the camera.');

// A block panel is an actionable gameplay surface, not a district tooltip.
for (const field of ['neighbors', 'benefits', 'dailyRespect', 'sector', 'size', 'density', 'slots', 'actionReason', 'version']) {
  check(map.includes(field), `Map block model/details are missing: ${field}.`);
}
for (const copyKey of ['owner', 'control', 'sector', 'size', 'density', 'slots', 'benefit', 'neighbors', 'actionReason']) {
  check(new RegExp(`copy\\.${copyKey}|C\\(['"]${copyKey}['"]\\)`).test(map),
    `Block details panel does not render copy field: ${copyKey}.`);
}
check(map.includes("esc(F('respect'))") && map.includes('respect potential / day') && map.includes('احترام محتمل / يوم'),
  'Daily respect must be presented as localized potential until treasury accrual is implemented.');
check(/t\.neighbors|neighbors\.map|neighbors\.join/.test(blockSelectionBody),
  'Selected block details must list its explicit adjacent block IDs.');
check(map.includes('ZONE_MAP_CLAIM_BLOCK') && map.includes('expectedVersion'),
  'Block action button must emit block ID, action, and expectedVersion to the parent.');
check(/function familyMarkerBlocks/.test(map) && /function inTerritoryScope/.test(map), 'Family holdings and adjacent opportunities must remain discoverable through pins and lists.');

// English and Arabic are both first-class. Check important map copy rather
// than merely checking that some Arabic glyph happens to exist in the file.
for (const phrase of ['Owner', 'Strategic benefit', 'Adjacent blocks', 'Claim block', 'Daily respect']) {
  check(index.includes(phrase) || map.includes(phrase), `Missing English territory copy: ${phrase}.`);
}
for (const phrase of ['المالك', 'الميزة الاستراتيجية', 'القطاعات المجاورة', 'استحوذ على القطاع', 'الاحترام اليومي']) {
  check(index.includes(phrase) || map.includes(phrase), `Missing Arabic territory copy: ${phrase}.`);
}
check(index.includes("dir:lang==='ar'?'rtl':'ltr'") || index.includes("dir: lang === 'ar' ? 'rtl' : 'ltr'"),
  'Parent must send an explicit RTL/LTR direction with map data.');
check(/document\.documentElement\.dir\s*=\s*data\.dir/.test(map), 'Map iframe must apply the supplied document direction.');
check(map.includes('mapbox-gl-rtl-text'), 'Mapbox must load Arabic RTL shaping support.');

// Preserve shell and semantic icon integration around the territory rewrite.
check(index.includes('class="zone-city-map-shell"'), 'Live city map must keep its responsive shell.');
const desktopMapHeight=Number(designCss.match(/\.zone-city-map-shell\s*\{[^}]*height:\s*(\d+)px/)?.[1]);
check(desktopMapHeight>=360&&desktopMapHeight<=500,
  'District desktop map has a bounded viewport between 360 and 500 pixels, with fullscreen available.');
check(/<iframe\b[^>]*\bid="zone-city-map"[^>]*\ballow="[^"]*\bfullscreen\b[^"]*"/.test(index), 'Map iframe must authorize fullscreen mode.');
check(index.includes('dist/map-icons.js') && localMapScripts.some(ref => new URL(ref, mapUrl).pathname.endsWith('/map-icons.js')) && map.includes('window.ZONE_MAP_ICONS'),
  'Parent and iframe must retain the shared semantic icon registry.');
for (const icon of ['gym', 'education', 'jobs', 'attack', 'cash', 'market', 'casino', 'crimes', 'faction', 'hospital', 'jail', 'properties', 'items']) {
  check(new RegExp(`${icon}:\\s*['"]`).test(icons), `Canonical icon registry is missing: ${icon}.`);
}

const runtime = verifyMapRuntime(map);
failures.push(...runtime.failures);
const atlas = verifyMapAtlas();
failures.push(...atlas.failures);

if (failures.length) {
  console.error(`ZONE territory map verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`ZONE territory map verification passed: genuine Streets v8 vector district, 120 unchanged server-authored blocks, compact family summary, invisible hit geometry, block actions and adjacency, bilingual details, a free camera, ${runtime.checks} executable map regressions, and ${atlas.checks} retained legacy asset checks. Legacy atlas geometry is not imported by the current map.`);
