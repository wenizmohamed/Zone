import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html'),design=read('assets/zone-design.css'),layout=read('assets/zone-layout.css');
const screens=['assets/ui/crimes.css','assets/ui/loadout.css','assets/ui/district-compositions108.css'];

test('the approved three font families load locally from the real document head, not a remote helmet dependency',()=>{
  const head=html.slice(html.indexOf('<head>'),html.indexOf('</head>'));
  assert.match(head,/href="\.\/assets\/ui\/fonts113\.css\?v=113"/);
  assert.doesNotMatch(html,/fonts\.(?:googleapis|gstatic)\.com/);
  const fonts=read('assets/ui/fonts113.css');
  for(const family of ['Rubik','Oswald','Noto Sans Arabic']) assert.ok(fonts.includes('font-family:"'+family+'"'));
  const manifest=JSON.parse(read('assets/fonts/provenance113.json'));
  assert.equal(manifest.fonts.length,3);
  for(const font of manifest.fonts){
    const bytes=readFileSync(new URL('../'+font.file,import.meta.url));
    assert.equal(bytes.subarray(0,4).toString(),'wOF2');
    assert.equal(createHash('sha256').update(bytes).digest('hex'),font.sha256);
    assert.match(read(font.license),/SIL OPEN FONT LICENSE/);
    assert.ok(fonts.includes('../fonts/'+font.file.split('/').at(-1)));
  }
  assert.doesNotMatch(fonts,/https?:|local\(/,'the packaged face must not depend on installed fonts or external requests');
});

test('screen typography follows the shared locale rather than literal Latin, serif or monospace faces',()=>{
  for(const file of screens){
    const css=read(file);
    assert.doesNotMatch(css,/(?:font|font-family)\s*:[^;}]*\b(?:Oswald|Rubik|serif|monospace)\b/,file);
  }
  assert.match(design,/html\[dir="rtl"\]\s*\{[^}]*--zone-font:var\(--zone-arabic\)[^}]*--zone-display:var\(--zone-arabic\)/);
  const gym=read(screens[2]).match(/\.zone-gym-train\{([^}]+)\}/)[1];
  assert.match(gym,/var\(--zone-font\)/,'Train is a control, not an unlocalized display title');
});

test('equivalent panel headings use one family regardless of wrapper data attributes',()=>{
  for(const css of [design,layout]){
    const headings=[...css.matchAll(/\.zone-panel-heading(?:\[data-zhead\])?(?: h2)?\s*\{([^}]+)\}/g)].map(m=>m[1]);
    for(const rule of headings) if(/font(?:-family)?:/.test(rule)){
      assert.match(rule,/var\(--zone-panel-label\)/);
      assert.doesNotMatch(rule,/var\(--zone-display\)/);
    }
  }
  assert.match(design,/--zone-panel-label:var\(--zone-font\)/);
});

test('safehouse and street controls inherit theme surfaces while actual scene artwork is retained',()=>{
  const css=read('assets/ui/safehouse-host108.css');
  assert.doesNotMatch(css,/#(?:111518|5b5040|e0bc7c|282727|171c1c|302a20)\b/i);
  for(const selector of ['zone-safehouse-host','zone-safehouse-toolbar','zone-street-dispatch']) assert.ok(css.includes('.'+selector));
  assert.match(css,/background:var\(--panel2\)/);
  assert.match(css,/color:var\(--gold\)/);
  const district=read(screens[2]);
  assert.doesNotMatch(district,/repeating-linear-gradient/,'ledger ornament must not interfere with the transfer form');
  assert.match(district,/\.zone-bank-actions\{[^}]*background:var\(--zone-content-surface\)/);
  assert.match(district,/\.zone-crime-plan\{[^}]*box-shadow:var\(--zone-content-shadow\)/);
});

test('player logic can evolve while the approved template, shell geometry and scene media stay pinned',()=>{
  const baseline=JSON.parse(read('scripts/fixtures/player-layout113.json'));
  const hash=value=>createHash('sha256').update(value).digest('hex');
  const geometryProperties=/^(?:display|position|inset(?:-.+)?|top|right|bottom|left|width|height|min-.+|max-.+|grid-.+|flex(?:-.+)?|gap|row-gap|column-gap|padding(?:-.+)?|margin(?:-.+)?|order|overflow(?:-.+)?|aspect-ratio|clip-path|transform)$/;
  function geometry(css){return css.replace(/\/\*[\s\S]*?\*\//g,'').split(/([{}])/).map((part,i,parts)=>parts[i-1]==='{'?part.split(';').filter(d=>geometryProperties.test(d.slice(0,d.indexOf(':')).trim())).join(';'):part).join('');}
  for(const file of ['assets/zone-design.css','assets/zone-layout.css',...screens,'assets/ui/safehouse-host108.css']){
    assert.equal(hash(geometry(read(file))),baseline.css[file],file+' geometry changed');
  }
  const logicStart=html.indexOf('<script type="text/x-dc"');assert.ok(logicStart>html.indexOf('<body>'));
  // Deferring these existing frame URLs changes startup, not the approved composition.
  // The separate client guard requires both raw native src attributes to be absent.
  let template=html.slice(html.indexOf('<body>'),logicStart)
    .replace(/(id="zone-char-3d") data-character-src=/,'$1 src=')
    .replace(/(<iframe id="zone-char-3d"[^>]*?) sc-camel-key="\{\{ characterFrameKey \}\}"/,'$1')
    .replace(/(id="zone-combat-frame" class="zone-combat-host") data-combat-src=/,'$1 src=')
    .replace(/(<iframe) sc-camel-src="dist\/zone-maps-live\.html"/,'$1 src="dist/zone-maps-live.html"')
    .replace(/(id="zone-safehouse-frame") sc-camel-src=/,'$1 src=');
  // The specifically authorized Gym station cues are pinned separately. Restore
  // only that exact section before comparing every other approved body byte.
  const gymPin=JSON.parse(read('scripts/fixtures/gym-layout116.json'));
  const gymSection=template.slice(template.indexOf('<!-- GYM -->'),template.indexOf('<!-- CITY -->'));
  assert.equal(hash(gymSection),gymPin.currentSha256,'Gym116 template changed');
  assert.equal(hash(gymPin.previous),'8105e4e84534f624dbc1af973b10eee73ca078664eb178a72a8d0eafc88217b0','original Gym reference changed');
  template=template.replace(gymSection,gymPin.previous);
  assert.equal(hash(template.replace(/\?v=\d+/g,'?v=CACHE').replace(/\s*<link href="https:\/\/fonts\.googleapis\.com[^>]+>/,'')),baseline.template);
});
