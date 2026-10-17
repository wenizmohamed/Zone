import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Source and callback contracts complement the root's real in-app browser pass.
const css=readFileSync(new URL('../assets/ui/district-compositions108.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const paletteSource=readFileSync(new URL('../assets/zone-design.css',import.meta.url),'utf8');
const city='#zone-main[data-zone-screen=city] .zone-street-dispatch';
const dispatch=css.slice(css.indexOf('/* CITY DISPATCH v109 START'),css.indexOf('/* CITY DISPATCH v109 END */'));
assert.ok(dispatch.length>0,'shipping stylesheet contains the scoped City dispatch increment');

function parseRules(source,media=[]){
  source=source.replace(/\/\*[\s\S]*?\*\//g,'');const result=[];let cursor=0;
  while(cursor<source.length){const open=source.indexOf('{',cursor);if(open<0)break;const head=source.slice(cursor,open).trim();let end=open+1,depth=1;
    for(;end<source.length&&depth;end++){if(source[end]==='{')depth++;else if(source[end]==='}')depth--;}
    assert.equal(depth,0,'CSS block is balanced');const body=source.slice(open+1,end-1);cursor=end;
    if(head.startsWith('@media'))result.push(...parseRules(body,[...media,head]));
    else{assert.ok(head&&!head.startsWith('@'),'only scoped style and media rules are introduced');const declarations=Object.fromEntries(body.split(';').filter(p=>p.trim()).map(p=>{const colon=p.indexOf(':');assert.ok(colon>0,'valid declaration');return[p.slice(0,colon).trim(),p.slice(colon+1).trim()];}));for(const selector of head.split(','))result.push({selector:selector.trim(),declarations,media});}
  }return result;
}
const rules=parseRules(dispatch);
function style(suffix='',{width=1440,reduced=false,rtl=false}={}){
  const selector=(rtl?'html[dir=rtl] ':'')+city+suffix,value={};
  for(const rule of rules)if(rule.selector===selector&&rule.media.every(m=>m.includes('max-width')?width<=Number(m.match(/max-width\s*:\s*(\d+)px/)[1]):m.includes('prefers-reduced-motion')&&reduced))Object.assign(value,rule.declarations);
  return value;
}
function palette(light){
  const base=Object.fromEntries([...paletteSource.match(/:root\s*\{([^}]+)\}/)[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]));
  return light?{...base,...Object.fromEntries([...paletteSource.match(/html\[data-theme="light"\]\s*\{([^}]+)\}/)[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]))}:base;
}
function color(value,values){for(let i=0;i<12&&value.startsWith('var(');i++)value=values[value.match(/var\((--[\w-]+)\)/)[1]];assert.match(value,/^#[a-f\d]{6}$/i);return value;}
function luminance(hex){const rgb=hex.slice(1).match(/../g).map(p=>parseInt(p,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;}
function contrast(a,b){const x=luminance(a),y=luminance(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}

test('dispatch additions are City-descendant rules with no map, global palette, asset or shell mutations',()=>{
  assert.ok(rules.length>=20);
  for(const rule of rules){assert.ok(rule.selector.startsWith(city)||rule.selector.startsWith('html[dir=rtl] '+city),rule.selector);assert.doesNotMatch(rule.selector,/iframe|canvas|zone-city-map|zone-sidebar|zone-topbar|zone-main[^ ]*$/);assert.ok(Object.keys(rule.declarations).every(p=>!p.startsWith('--')),'global theme tokens are consumed, never redefined');}
  assert.doesNotMatch(dispatch,/url\(|@font-face|#[a-f\d]{3,8}\b/i,'existing local type and palette are retained');
  assert.doesNotMatch(dispatch,/position\s*:\s*(?:absolute|fixed)|(?:width|height)\s*:\s*100v[wh]/,'the dispatch does not escape its City flow');
});

test('all 24 real view-model finds retain their IDs and existing Collect callbacks in EN and AR',()=>{
  const start=html.indexOf('    view.world = {'),end=html.indexOf(';\n',start)+1;assert.ok(start>=0&&end>start);const code=html.slice(start,end);
  for(const lang of ['en','ar']){const claims=[],refreshes=[],finds=Array.from({length:24},(_,i)=>({id:'find-'+i,item_id:'sand',location_id:i%2?'bank':'properties',quantity:i+1})),source={worldState:{finds,events:[{title_en:'Dock news',title_ar:'خبر الميناء',body_en:'Actual event',body_ar:'خبر محفوظ'}]},claimStreetFind:id=>claims.push(id),loadWorld:force=>refreshes.push(force)};
    const t={items:{sand:lang==='ar'?'رمل':'Sand'},nav:{bank:lang==='ar'?'البنك':'Bank',properties:lang==='ar'?'العقارات':'Properties'}},world=vm.runInNewContext('(function(){'+code+';return view.world;}).call(source)',{view:{},source,t,lang});
    assert.equal(world.finds.length,24);assert.equal(world.hasFinds,true);assert.deepEqual(Array.from(world.finds,f=>f.id),finds.map(f=>f.id));assert.ok(world.finds.every(f=>f.name.includes(' × ')&&f.place&&f.claimLabel));
    world.finds.forEach(f=>f.claim());assert.deepEqual(claims,finds.map(f=>f.id));world.refresh();assert.deepEqual(refreshes,[true]);assert.equal(world.countLabel,lang==='ar'?'اللقى المتاحة':'Available finds');
    assert.equal(world.events[0].title,lang==='ar'?'خبر الميناء':'Dock news');
  }
});

test('shipping list is a named keyboard-scrollable region with every semantic row and authoritative disabled action',()=>{
  const start=html.indexOf('<section class="zone-street-dispatch"'),end=html.indexOf('</section>',start),markup=html.slice(start,end);
  assert.match(markup,/<div class="zone-street-find-list" role="list" aria-label="\{\{ world\.title \}\}" tabindex="0">/);
  assert.match(markup,/<sc-for list="\{\{ world\.finds \}\}" as="find"><div class="zone-street-find" role="listitem">/);
  assert.match(markup,/<button onClick="\{\{ find\.claim \}\}" disabled="\{\{ world\.busy \}\}">\{\{ find\.claimLabel \}\}<\/button>/);
  assert.match(markup,/aria-label="\{\{ world\.countLabel \}\}">\{\{ world\.finds\.length \}\}/);
  assert.match(markup,/<p role="status">\{\{ world\.empty \}\}/);assert.match(markup,/<summary>\{\{ event\.title \}\}<\/summary>/);
  assert.doesNotMatch(markup,/world\.finds\.(?:slice|filter)|aria-hidden="true"|tabindex="-1"/);
});

test('24 finds scroll inside a bounded log at desktop, phone and increased text size without hiding entries',()=>{
  for(const width of [390,1440]){const list=style(' .zone-street-find-list',{width}),match=list['max-block-size'].match(/^min\((\d+)rem,(\d+)svh\)$/);assert.ok(match);assert.equal(list['overflow-y'],'auto');assert.equal(list['scrollbar-gutter'],'stable');assert.equal(list['overscroll-behavior-block'],'contain');
    for(const height of [400,844,900])for(const rem of [16,32]){const bound=Math.min(Number(match[1])*rem,Number(match[2])/100*height);assert.ok(bound<height*.6);assert.ok(24*64>bound,'all finds remain reachable by local scrolling');}}
  assert.doesNotMatch(dispatch,/display\s*:\s*none|visibility\s*:\s*hidden|line-clamp|text-overflow|pointer-events\s*:\s*none|scrollbar-width\s*:\s*none/);
});

test('Collect, Refresh, story and list focus targets retain 44px controls and visible keyboard focus',()=>{
  assert.ok(Number.parseFloat(style(' button')['min-height'])>=44);assert.ok(Number.parseFloat(style(' button')['min-width'])>=44);assert.ok(Number.parseFloat(style(' summary')['min-height'])>=44);
  for(const suffix of [' button:focus-visible',' summary:focus-visible',' .zone-street-find-list:focus-visible'])assert.match(style(suffix).outline,/^2px solid var\(--gold\)$/);
  assert.equal(style(' button:disabled').cursor,'not-allowed!important');assert.ok(Number.parseFloat(style(' .zone-street-find')['min-height'])>=64);
});

test('phone and RTL names wrap inside local columns without physical left/right offsets or clipped text',()=>{
  const copy=style(' .zone-street-find>span',{width:390});assert.equal(copy['grid-template-columns'],'minmax(0,1fr)');assert.equal(copy['min-width'],'0');assert.equal(copy['overflow-wrap'],'anywhere');assert.equal(copy['white-space'],'normal');assert.equal(style(' .zone-street-find small',{width:390})['text-align'],'start');
  assert.equal(style(' h2',{rtl:true})['font-family'],'var(--zone-arabic)');assert.equal(style(' h2',{rtl:true})['letter-spacing'],'0');
  for(const rule of rules)for(const key of Object.keys(rule.declarations))assert.doesNotMatch(key,/(?:^|-)(?:left|right)$/,'logical sides inherit RTL');
});

test('dispatch text and focus use accessible existing tokens in dark and light themes',()=>{
  for(const light of [false,true]){const values=palette(light),surface=style().background;
    for(const [ink,background]of[[style(' h2').color,style('>header').background],[style(' .zone-street-find strong').color,surface],[style(' .zone-street-find small').color,surface],[style(' button').color,style(' button').background],[style(' button:not(:disabled):hover').color,style(' button:not(:disabled):hover').background]])assert.ok(contrast(color(ink,values),color(background,values))>=4.5,(light?'light':'dark')+' '+ink+' on '+background);
    assert.ok(contrast(color('var(--gold)',values),color(surface,values))>=3,'focus ring contrasts with the log');}
});

test('reduced motion affects only this dispatch and the ledger introduces no animation or transformed controls',()=>{
  assert.equal(style(' button',{reduced:true}).transition,'none!important');assert.equal(style(' .zone-street-find-list',{reduced:true})['scroll-behavior'],'auto');for(const rule of rules)assert.ok(Object.keys(rule.declarations).every(p=>p!=='transform'&&!p.startsWith('animation')),'controls retain their position without animation');
});
