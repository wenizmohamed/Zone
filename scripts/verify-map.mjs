import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = join(root, 'index.html');
const mapPath = join(root, 'dist', 'city-map-torn.html');
const iconsPath = join(root, 'dist', 'map-icons.js');
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const index = readFileSync(indexPath, 'utf8');
const map = readFileSync(mapPath, 'utf8');
const icons = existsSync(iconsPath) ? readFileSync(iconsPath, 'utf8') : '';

// The parent sends semantic icon IDs. It must never send 512-unit SVG path data
// to a renderer that owns a different viewBox and scale.
check(/icon:\s*PINICON\[pl\]/.test(index), 'Map payload must send icon: PINICON[pl].');
check(!/d:\s*LU\(PINICON\[pl\]\)/.test(index), 'Map payload must not send raw 512-unit glyph paths.');

// The early path synchronizer runs while the document is still parsing. Start
// only when the real root element exists, then observe that native DOM node.
check(index.includes('observer.observe(document.documentElement, {'), 'Path synchronizer must observe the real root element.');
check(index.includes("document.addEventListener('DOMContentLoaded', startObserver, { once: true });"),
  'Path synchronizer must guard parser timing with DOMContentLoaded.');
check(index.includes('class="zone-city-map-shell"'), 'Live city map must expose a responsive shell class.');
check(/\.zone-city-map-shell\s*\{[^}]*height:\s*clamp\(420px,62vh,560px\)[^}]*aspect-ratio:\s*auto/.test(index),
  'Phone map must use a usable tall viewport instead of the desktop aspect-ratio sliver.');

// Both the parent and iframe share one small, deliberate 24-grid icon registry.
check(existsSync(iconsPath), 'Missing canonical dist/map-icons.js registry.');
check(index.includes('dist/map-icons.js'), 'index.html must load dist/map-icons.js.');
check(map.includes('src="map-icons.js"'), 'Map iframe must load map-icons.js.');
check(map.includes('window.ZONE_MAP_ICONS'), 'Map renderer must consume the canonical icon registry.');
for (const icon of ['gym', 'education', 'jobs', 'attack', 'newspaper', 'hof', 'cash', 'market', 'casino', 'crimes', 'faction', 'hospital', 'jail', 'properties', 'items', 'elimination', 'missions']) {
  check(new RegExp(`${icon}:\\s*['\"]`).test(icons), `Canonical icon registry is missing: ${icon}.`);
}

// A Mapbox HTML marker must have a fixed box. An auto-width block element grows
// to the map canvas width and makes anchor math, hit targets, labels and shadows wrong.
const badgeRule = map.match(/\.zbadge\s*\{([^}]*)\}/)?.[1] || '';
check(/position:\s*absolute/.test(badgeRule), 'Map marker box must remain absolutely positioned for Mapbox anchor math.');
check(/width:\s*34px/.test(badgeRule), 'Map marker box must have a fixed 34px width.');
check(/height:\s*34px/.test(badgeRule), 'Territory-bound POI marker box must have a fixed 34px height.');
check(/display:\s*block/.test(badgeRule), 'Map marker box must be an explicit block.');

// There is one rendering contract: 24-grid icons nested in a grounded 34px POI token.
check(map.includes('viewBox="0 0 24 24"'), 'Pin glyphs must render in a 24x24 viewBox.');
check(map.includes('data-zone-icon'), 'Rendered markers must expose their semantic icon ID.');
check(!map.includes('var ZGLYPH='), 'Legacy ZGLYPH registry must be removed.');
check(!map.includes('var PIN_FAMILY='), 'Legacy PIN_FAMILY registry must be removed.');
check(!map.includes('function liftPin('), 'Legacy saturation-boost path must be removed.');
check(!map.includes('supercluster.min.js'), 'Disabled Supercluster dependency must be removed.');
check(!map.includes('function buildCluster('), 'Disabled clustering implementation must be removed.');

// Territories are the map's primary gameplay layer, not a decorative mode. The
// parent owns the six canonical districts and sends their localized ownership
// state to the iframe alongside every POI.
for (const district of ['west', 'north', 'fin', 'red', 'center', 'res']) {
  check(new RegExp(`id:\\s*['"]${district}['"][^\\n]+poly:`).test(index),
    `Canonical district is missing a territory polygon: ${district}.`);
}
check(index.includes('const MAP_COPY ='), 'Parent must define bilingual territory UI copy.');
check(index.includes("territories: 'الأراضي'"), 'Territory UI must include Arabic copy.');
check(index.includes('const territories = DISTRICTS.map'), 'Map payload must derive territories from canonical DISTRICTS.');
check(/territory:\s*district\.id/.test(index), 'Every POI payload must carry its canonical territory ID.');
check(/postMessage\(\{\s*zonePins:\s*pins,\s*territories,\s*legend,\s*copy/.test(index),
  'Map message must send POIs, territories, legend, and localized copy together.');

// The iframe must expose a first-class territories mode, real Mapbox polygon
// layers, and a selectable district details path.
for (const id of ['modePlaces', 'modeTerritories', 'territories']) {
  check(map.includes(`id="${id}"`), `Territory UI is missing #${id}.`);
}
for (const layer of ['zone-territories-fill', 'zone-territories-contested', 'zone-territories-outline', 'zone-territories-label']) {
  check(map.includes(`id:'${layer}'`), `Mapbox territory layer is missing: ${layer}.`);
}
check(map.includes("addSource('zone-territories'"), 'Mapbox territory GeoJSON source is missing.');
check(map.includes('function syncTerritories('), 'Territory source must synchronize with live game payloads.');
check(map.includes("map.on('click','zone-territories-fill'"), 'Territories must be directly selectable on the map.');
check(map.includes('function selectTerritory('), 'Territory selection must open real district details.');

// POIs must be visually and semantically attached to the territory beneath
// them. Category color identifies the place, while the outer ring identifies
// the controlling faction.
check(map.includes('data-zone-territory'), 'Rendered POIs must expose their territory ID.');
check(map.includes("d.style.setProperty('--tc'"), 'POIs must inherit the controlling territory color.');
check(map.includes('zone-poi-territory'), 'POI SVGs must include a faction-colored territory ring.');
check(!map.includes('M17 42C15.5 39.4'), 'Legacy floating balloon marker shape must be removed.');
check(map.includes('body[data-mode="territories"] .zbadge{display:none}'),
  'Phone territory overview must hide dense POIs until a district is chosen.');
check(map.includes('var mobile=innerWidth<=640'),
  'Initial camera framing must use a phone-specific territory overview.');
check(map.includes("territoryFilter?pins.filter(function(p){return p.territory===territoryFilter;}):pins"),
  'Location progress must count only the selected territory when filtered.');

// First render must frame the real pin payload. A hard-coded camera can show an
// empty block of Manhattan even when all locations exist.
check(map.includes('function fitPins('), 'Map must define fitPins() for the real payload.');
check(map.includes('fitPins(pins)'), 'Map must frame the real pins after render.');
check(!/if\(map\.loaded\(\)\)\s*frame\(\);\s*else\s*map\.once\(['"]load['"],frame\)/.test(map),
  'Pin framing must not wait on a load event that may already have fired.');
check(!map.includes('function orbit('), 'The map must not continuously rotate after load.');
check(/\[dir="rtl"\]\s+\.side\s*\{[^}]*left:\s*auto[^}]*right:\s*0[^}]*translateX\(102%\)/.test(map),
  'Arabic mobile drawer must stage and enter from the right edge.');

// Preserve the product behavior while repairing the renderer.
for (const invariant of ['zoneMapReady', 'zoneGo', 'zoneFound', 'Hide found', 'Search places', 'NavigationControl']) {
  check(map.includes(invariant), `Map behavior regression: missing ${invariant}.`);
}

if (failures.length) {
  console.error(`ZONE map verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('ZONE map verification passed: six selectable faction territories, territory-bound POIs, canonical icons, stable camera, and preserved interactions.');
