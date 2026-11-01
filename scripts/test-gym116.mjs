import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createContext,runInContext} from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=read('index.html');
const logic=html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
const section=html.slice(html.indexOf('<!-- GYM -->'),html.indexOf('<!-- CITY -->'));
const hash=value=>createHash('sha256').update(value).digest('hex');

function player(lang){
  const calls=[];
  const location=new URL('https://zone.test/?screen=gym&lang='+lang);
  const ctx=createContext({console,URL,URLSearchParams,Date,
    localStorage:{getItem(){return null;},setItem(){}},
    document:{documentElement:{dataset:{},style:{setProperty(){}}},getElementById(){return null;}},
    window:{location,history:{pushState(){},replaceState(){}},ZonePlatform:{preview:false,active:()=>({version:1,manifest:{}}),data:()=>({})},addEventListener(){},dispatchEvent(){}},
    setTimeout(){return 1;},clearTimeout(){},setInterval(){},clearInterval(){},
    React:{createElement:()=>({})},DCLogic:class{constructor(props){this.props=props;}setState(value,done){Object.assign(this.state,typeof value==='function'?value(this.state):value);done?.();}forceUpdate(){}},
    fetch:async(...args)=>{calls.push(args);throw new Error('Selection must never send a game command');}
  });
  runInContext(read('assets/weapons/catalog.js'),ctx);
  runInContext(logic+'\nglobalThis.Game=Component;',ctx);
  const instance=new ctx.Game({});
  instance.applyServerPlayer({id:'ordinary-gym116',username:'Novice',level:1,cash:2500,energy:100,max_energy:100,nerve:15,max_nerve:15,happy:100,max_happy:100,life:250,max_life:250,strength:11,defense:12,speed:13,dexterity:14});
  instance.gameplayReady=true;instance.runtimeConnection='connected';instance.p.gym=0;instance.p.gymXp=0;
  return {instance,calls};
}

test('each real Gym station explains its combat purpose in the active language, without changing game state',()=>{
  const assets=['strength','defense','speed','dexterity'];
  for(const lang of ['en','ar']){
    const {instance,calls}=player(lang),before=JSON.stringify(instance.p);
    for(const [index,station]of instance.renderVals().stats.entries()){
      station.select();
      const view=instance.renderVals(),active=view.gymSession;
      assert.equal(active.id,station.id);assert.equal(active.img,'art/gym116/'+assets[index]+'.webp');
      assert.equal(active.fallbackImg,'art/g_'+active.id+'.jpg');
      assert.ok(active.benefit.length>18);assert.match(active.benefit,lang==='ar'?/[\u0600-\u06ff]/:/damage|chance|attacks/);
      assert.equal(view.stats.filter(row=>row.selected).length,1);
      assert.equal(active.value,(11+index).toFixed(2));
      assert.equal(view.gymEnergy,5);assert.equal(view.gymStudio.energyAfter,'95');
    }
    assert.equal(JSON.stringify(instance.p),before);assert.equal(calls.length,0);
    assert.equal(instance.activeScreen(),'gym');
    assert.equal(instance.activeLanguage(),lang);
    assert.equal(instance.activeCombatMode(),'npc');
    assert.equal(instance.activeMarketMode(),'merchants');
    assert.equal(instance.activeItemTab(),'all');
    assert.equal(instance.activeOutfit(),'street');
    assert.equal(instance.isGameplayReady(),true);
    assert.equal(instance.isGameplayBusy(),false);
    assert.equal(instance.ownedInventoryKeyCount(),0);
    assert.equal(instance.hasEquippedWeapon(),false);
    assert.equal(instance.equippedWeaponId(),'fists');
    assert.equal(instance.activePropertyId(),'shack');
    assert.equal(instance.activeJobId(),'grocer');
    assert.equal(instance.activeGymIndex(),0);
    assert.equal(instance.activeDistrictId(),'center');
    assert.equal(instance.isHospitalized(),false);
    assert.equal(instance.isJailed(),false);
    assert.equal(instance.hasActiveEducation(),false);
    assert.equal(instance.inmateCount(),8);
    assert.equal(instance.patientCount(),7);
    assert.equal(instance.merchantListingCount(),12);
    assert.equal(instance.playerCash(),2500);
    assert.equal(instance.playerBankBalance(),0);
    assert.equal(instance.playerPoints(),0);
    assert.equal(instance.playerMerits(),0);
  }
});

test('selected station artwork, benefit and real Train action remain one accessible console',()=>{
  assert.match(section,/zone-gym-station-icon[^>]*background-image:url\('\{\{ gymSession\.img \}\}'\),url\('\{\{ gymSession\.fallbackImg \}\}'\)/);
  assert.match(section,/id="zone-gym-benefit">\{\{ gymSession\.benefit \}\}/);
  assert.match(section,/data-gym-train="\{\{ gymSession\.id \}\}"[^>]*aria-describedby="zone-gym-benefit zone-gym-session-reason"[^>]*onClick="\{\{ gymSession\.train \}\}"/);
  assert.match(section,/zone-gym-station-art[^>]*url\('\{\{ s\.img \}\}'\),url\('\{\{ s\.fallbackImg \}\}'\)/);
  assert.match(section,/disabled="\{\{ trainOff \}\}"/);
});

test('phone Gym puts station selection before Train and keeps the override inside Gym only',()=>{
  assert.ok(section.indexOf('class="zone-gym-stations"')<section.indexOf('class="zone-gym-session"'),'DOM reading and keyboard order must match station-before-Train on phones');
  const css=read('assets/ui/gym116.css');
  assert.match(html,/href="\.\/assets\/ui\/gym116\.css\?v=117"/);
  assert.match(css.slice(0,css.indexOf('@media(max-width:650px)')),/\.zone-gym-floor\s*\{[^}]*grid-row:1[;}]/,'the spanning room must occupy row1 before CSS grid auto-placement considers the fixed console and station tracks');
  const phone=css.slice(css.indexOf('@media(max-width:650px)'));
  for(const [selector,row]of [['zone-gym-floor',1],['zone-gym-stations',2],['zone-gym-session',3]])
    assert.match(phone,new RegExp('\\.'+selector+'\\s*\\{[^}]*grid-row:'+row+'(?:[;}])'));
  assert.match(css,/\.zone-gym-station-art\s*\{[^}]*background-size:cover/);
  assert.match(css,/\.zone-gym-session-benefit\s*\{[^}]*overflow-wrap:anywhere/);
  assert.doesNotMatch(css,/(?:^|\n)\s*(?:body|:root|\.zone-sidebar|\.zone-city)[\s{,:]/);
  assert.match(css,/html\[dir=rtl\]/);assert.match(css,/prefers-reduced-motion:reduce/);
});

test('published Gym artwork, localized description and cost reach the real view without accepting CSS or remote URLs',()=>{
  for(const lang of ['en','ar']){
    const {instance,calls}=player(lang),before=JSON.stringify(instance.p);
    const gym={e:9,xp:0,cost:10,name:{en:'Owner gym',ar:'نادي المالك'},description:{en:'Work the heavy bag.',ar:'تمرن على كيس الملاكمة.'},image:'art/gym116/defense.webp'};
    instance.applyCatalogs({gyms:[gym]});let view=instance.renderVals();
    assert.equal(view.gymName,gym.name[lang]);assert.equal(view.gymStudio.floorNote,gym.description[lang]);
    assert.ok(view.gymStudio.floorBackground.includes("url('art/gym116/defense.webp')"));
    assert.equal(view.gymEnergy,9);assert.equal(view.gymStudio.energyAfter,'91');
    for(const image of ['https://outside.test/art.jpg',"art/x.webp');color:red;/*",'../private.jpg','art/x.svg','art//../../x.webp']){
      instance.applyCatalogs({gyms:[{...gym,image}]});view=instance.renderVals();
      assert.ok(!view.gymStudio.floorBackground.includes(image),image);
      assert.ok(view.gymStudio.floorBackground.includes('art/zone-gym-interior-v105.webp'));
    }
    assert.equal(JSON.stringify(instance.p),before);assert.equal(calls.length,0);
  }
  assert.match(section,/zone-gym-floor-scene" style="background-image:\{\{ gymStudio\.floorBackground \}\}"/);
});

test('new Gym art is bounded local WebP with checked provenance and retained original fallbacks',()=>{
  const manifest=JSON.parse(read('art/gym116/provenance.json'));
  assert.equal(manifest.generator,'built-in image_gen');assert.equal(manifest.assets.length,4);
  for(const entry of manifest.assets){
    const bytes=readFileSync(new URL('../'+entry.file,import.meta.url));
    assert.equal(bytes.subarray(0,4).toString(),'RIFF');assert.equal(bytes.subarray(8,12).toString(),'WEBP');
    assert.equal(hash(bytes),entry.sha256);assert.equal(bytes.length,entry.bytes);
    assert.ok(entry.width<=512&&entry.height<=512);assert.ok(bytes.length<100000);
    assert.ok(readFileSync(new URL('../'+entry.fallback,import.meta.url)).length>0);
  }
});
