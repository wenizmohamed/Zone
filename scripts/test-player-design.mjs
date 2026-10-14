import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Source contracts complement, but do not replace, EN/AR browser screenshots.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(resolve(root, 'assets/zone-design.css'), 'utf8');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const runtime = readFileSync(resolve(root, 'platform-runtime.js'), 'utf8');
const routes = ['home', 'items', 'city', 'jobs', 'bank', 'gym', 'properties', 'education', 'crimes', 'missions', 'newspaper', 'jail', 'hospital', 'casino', 'hof', 'faction', 'elimination', 'attack', 'market'];
function rules(selector) {
  const literal = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...css.matchAll(new RegExp(literal + '\\s*\\{([^}]+)\\}', 'g'))].map(match => match[1]);
}
function palette(light = false) {
  const section = css.match(light ? /html\[data-theme="light"\]\s*\{([^}]+)\}/ : /:root\s*\{([^}]+)\}/)[1];
  const values = Object.fromEntries([...section.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(match => [match[1], match[2].trim()]));
  if (light) Object.assign(values, { ...palette(false), ...values });
  return values;
}
function color(values, key) {
  let value = values[key];
  for (let depth = 0; /^var\(/.test(value) && depth < 12; depth++) value = values[value.match(/var\((--[\w-]+)\)/)[1]];
  assert.match(value, /^#[a-f\d]{6}$/i, key);
  return value;
}
function luminance(hex) {
  const parts = hex.slice(1).match(/../g).map(part => parseInt(part, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return parts[0] * .2126 + parts[1] * .7152 + parts[2] * .0722;
}
function contrast(a, b) { const first = luminance(a), second = luminance(b); return (Math.max(first, second) + .05) / (Math.min(first, second) + .05); }

test('all nineteen existing game routes and published custom-page surfaces retain their templates', () => {
  for (const route of routes) assert.match(html, new RegExp('is\\.' + route + '\\s*\\}\\}'), route);
  assert.match(html, /data-zone-custom-page="1"/);
  assert.match(css, /\[data-zone-custom-page\]/);
  assert.match(css, /\[data-zone-block\]/);
});
test('shared player palette provides AA text and 3:1 field boundaries in dark and light modes', () => {
  for (const light of [false, true]) {
    const values = palette(light);
    for (const key of ['--t1', '--t3', '--mu', '--mu2']) assert.ok(contrast(color(values, key), color(values, '--panel')) >= 4.5, `${light ? 'light' : 'dark'} ${key}`);
    assert.ok(contrast(color(values, '--border3'), color(values, '--deep')) >= 3, `${light ? 'light' : 'dark'} field boundary`);
    assert.ok(contrast(color(values, '--onAcc'), color(values, '--accFill1')) >= 4.5, `${light ? 'light' : 'dark'} primary action`);
  }
});
test('runtime branding cannot override the light player accent or keyboard focus contrast', () => {
  // Published branding deliberately remains a raw html inline token. A local
  // semantic token must win by inheritance, not by assuming CSS beats inline.
  assert.match(runtime, /document\.documentElement\.style\.setProperty\('--acc', accent\)/);
  const selectors = 'html[data-theme="light"] .zone-app,html[data-theme="light"] .zone-skip-link';
  const scope = rules(selectors)[0];
  assert.ok(scope, 'player and skip-link scopes isolate the readable light accent');
  assert.match(scope, /--acc:var\(--zone-signal\)/);
  const values = { ...palette(true), '--acc': '#a3d900' };
  values['--acc'] = scope.match(/--acc:\s*([^;]+);/)[1].trim();
  assert.equal(color(values, '--acc'), color(palette(true), '--zone-signal'));
  for (const surface of ['--bg', '--panel', '--panel2', '--z1', '--z2', '--deep']) {
    assert.ok(contrast(color(values, '--acc'), color(values, surface)) >= 4.5, `light accent on ${surface}`);
    assert.ok(contrast(color(values, '--acc'), color(values, surface)) >= 3, `light focus on ${surface}`);
  }
});
test('merchant price changes retain their sign while using readable positive and negative tokens', () => {
  assert.match(html, /<bdi class="zone-market-change" data-label="\{\{ t\.change \}\}" style="color:\{\{ m\.chgColor \}\}/);
  assert.match(rules('.zone-market-change')[0], /color:var\(--bad\) !important/);
  assert.match(rules('.zone-market-change[style*="var(--acc)"]')[0], /color:var\(--good\) !important/);
  for (const light of [false, true]) {
    const values = palette(light);
    for (const token of ['--good', '--bad']) for (const surface of ['--panel', '--z1', '--z2']) {
      assert.ok(contrast(color(values, token), color(values, surface)) >= 4.5, `${light ? 'light' : 'dark'} ${token} market change on ${surface}`);
    }
  }
});
test('light navigation labels and real icon masks have contrast without dimming or disabling the navigation', () => {
  const values = palette(true);
  for (const [token, minimum] of [['--mu', 4.5], ['--ico', 3], ['--activefg', 4.5], ['--gold', 3]]) {
    const surface = ['--activefg', '--gold'].includes(token) ? '--activebg' : '--bg';
    assert.ok(contrast(color(values, token), color(values, surface)) >= minimum, `${token} navigation contrast`);
  }
  assert.match(rules('[data-znav] button')[0], /color:var\(--mu\) !important/);
  assert.match(rules('.zone-nav-icon[data-has-image="true"]::before')[0], /background:color-mix\(in srgb,var\(--nav-color\) 65%,#ffffff\)/);
  assert.match(rules('.zone-nav-icon')[0], /background:linear-gradient\(#474a4c,#242729\)/);
  assert.match(rules('[data-znav] button[aria-current="page"] .zone-nav-icon::before')[0], /background:#ebc980/);
  for (const selector of ['[data-znav]', '[data-znav] button', '.zone-nav-icon', '.zone-nav-icon[data-has-image="true"]::before']) {
    for (const rule of rules(selector)) assert.doesNotMatch(rule, /(?:opacity|filter)\s*:/, `${selector} is not ghosted`);
  }
});
test('Arabic uses the actual loaded Arabic font and avoids display-font letter spacing', () => {
  assert.match(html, /family=Noto\+Sans\+Arabic/);
  assert.match(css, /--zone-arabic:"Noto Sans Arabic",Rubik/);
  assert.match(css, /html\[dir="rtl"\]\s*\{[^}]*--zone-font:var\(--zone-arabic\)/);
  assert.match(css, /html\[dir="rtl"\][^\n]*letter-spacing:0 !important/);
});
test('the corrected shared player sheet follows combat chrome and carries the beta102 cache key', () => {
  assert.ok(html.indexOf('assets/ui/combat.css') < html.indexOf('assets/zone-design.css?v=102'));
});
test('fixed-dark header and fallback navigation tiles retain contrast in either theme', () => {
  const clock = rules('.zone-header-actions > span:first-child')[0];
  assert.match(clock, /color:#d0cec8 !important/);
  assert.ok(contrast('#d0cec8', '#17191b') >= 4.5);
  assert.match(rules('.zone-nav-icon[data-has-image="false"] svg')[0], /fill:#d0cec8 !important/);
  for (const foreground of ['#d0cec8', '#ebc980']) assert.ok(contrast(foreground, '#474a4c') >= 3);
});
test('game actions, navigation and input fields meet the shared 44px scale', () => {
  assert.match(rules('button')[0], /min-height:44px !important/);
  assert.match(css, /input,select,textarea\s*\{[^}]*min-height:44px/);
  assert.match(css, /\[data-znav\] button[^\n]*min-height:46px !important/);
  assert.match(css, /zone-profile-mobile-details summary[^\n]*min-height:44px/);
  assert.match(css, /zone-header-actions > button[^\n]*min-height:44px/);
});
test('resource meters retain actual value bindings without a decorative segmented overlay', () => {
  for (const key of ['energy', 'nerve', 'happy', 'life']) assert.match(css, new RegExp('data-zone-resource="' + key + '"'));
  assert.doesNotMatch(css, /\.zone-resource-track::after|repeating-linear-gradient/);
  assert.match(html, /aria-valuenow="\{\{ b.value \}\}"/);
  assert.match(html, /width:\{\{ b.pct \}\}%/);
  assert.match(css, /\.zone-resource-timer[^\n]*position:static/);
  for (const light of [false, true]) {
    for (const key of ['energy', 'nerve', 'happy', 'life']) {
      const selector = `${light ? 'html[data-theme="light"] ' : ''}.zone-resource[data-zone-resource="${key}"] .zone-resource-track > div`;
      const fill = rules(selector)[0].match(/background:(#[a-f\d]{6})/i)[1];
      assert.ok(contrast(fill, color(palette(light), '--track')) >= 3, `${light ? 'light' : 'dark'} ${key} meter`);
    }
  }
});
test('phone HUD compacts non-interactive whitespace without hiding money, meters or 44px account actions', () => {
  const phone = css.slice(css.indexOf('@media (max-width:760px)'));
  assert.match(phone, /zone-profile-body[^\n]*padding:10px 14px !important[^\n]*gap:6px 16px/);
  assert.match(phone, /zone-profile-bars[^\n]*repeat\(2,minmax\(0,1fr\)\)[^\n]*gap:8px 16px/);
  assert.match(phone, /zone-resource \{ gap:3px !important/);
  assert.match(phone, /#zone-cash[^\n]*font-size:20px !important/);
  assert.doesNotMatch(phone, /(?:zone-resource|zone-profile-bars|#zone-cash)[^\n]*display:none/);
  assert.match(css, /zone-profile-account[^\n]*min-height:44px/);
  assert.match(css, /zone-profile-mobile-details summary[^\n]*min-height:44px/);
});
test('phone overflow is solved in local grids, not by clipping the document', () => {
  const documentRules = [...rules('html'), ...rules('body'), ...rules('.zone-app')];
  for (const rule of documentRules) assert.doesNotMatch(rule, /overflow(?:-x)?\s*:\s*(?:hidden|clip)/);
  assert.match(css, /\[data-zscroll\][^\n]*overflow-x:auto !important/);
  assert.match(css, /zone-crime-categories[^\n]*max-width:100%/);
  assert.doesNotMatch(css, /zone-crime-categories[^\n]*margin-inline-end:\s*-/);
  assert.match(css, /grid-template-columns:minmax\(0,1fr\) 35px 74px 87px/);
});
test('phone action tables expose local labels and do not hide original actions', () => {
  for (const route of ['attack', 'market', 'jail', 'hospital']) assert.match(css, new RegExp('data-zone-screen="' + route + '"'));
  assert.match(css, /#zone-main \[data-label\]::before[^\n]*content:attr\(data-label\)/);
  assert.match(css, /data-zone-screen="jail"[^\n]*div:last-child[^\n]*flex-wrap:wrap/);
  assert.match(css, /data-zone-screen="attack"[^\n]*button:last-child/);
});
test('record surfaces, inventory tools and all cooperative/economy surfaces share intentional styling', () => {
  for (const selector of ['zone-record-heading', 'zone-training-row', 'zone-membership-row', 'zone-employment-row', 'zone-course-row', 'zone-property-dossier', 'zone-bulletin-entry', 'zone-market-form', 'zone-operation-definitions', 'zone-competition-rank', 'zone-playing-card', 'zone-route-receipt']) assert.match(css, new RegExp('\\.' + selector + '(?:\\s|[.,{>:])'), selector);
  assert.match(css, /zone-inventory-search[^\n]*grid-template-columns:auto minmax\(160px,1fr\)/);
  assert.match(css, /zone-item-thumbnail[^\n]*flex:0 0 88px[^\n]*height:64px/);
  assert.match(css, /zone-item-thumbnail img[^\n]*object-fit:contain/);
  assert.match(css, /zone-item-thumbnail[^\n]*flex-basis:68px[^\n]*height:56px/);
});
test('city remains bounded and its existing native/fallback expansion contract is retained', () => {
  assert.match(css, /\.zone-city-map-shell[^\n]*height:480px !important/);
  assert.match(css, /\.zone-city-map-shell:fullscreen[^\n]*height:100vh/);
  assert.match(css, /\.zone-city-map-shell\.zone-city-map-expanded[^\n]*position:fixed !important[^\n]*height:100dvh !important/);
  assert.match(css, /body.zone-map-expanded\s*\{ overflow:hidden/);
  assert.match(html, /data-map-src="dist\/city-map-torn.html\?v=\d+"/);
  assert.ok(existsSync(resolve(root, 'dist/city-map-torn.html')));
});
test('existing decorative assets and card sprite resolve locally without invented remote media', () => {
  for (const [, raw] of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) {
    if (raw.startsWith('#')) continue;
    assert.doesNotMatch(raw, /^https?:|^data:/);
    const asset = raw.startsWith('/') ? resolve(root, raw.slice(1)) : resolve(root, 'assets', raw);
    assert.ok(existsSync(asset), raw);
  }
});
test('motion and focus remain explicit without hover transforms that displace map pins', () => {
  assert.match(css, /button:focus-visible[^\n]*outline:2px solid var\(--acc\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /animation:none !important; transition:none !important/);
  assert.doesNotMatch(css, /button:not\(:disabled\):hover[^\n]*transform:none/);
});
