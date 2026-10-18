import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Home, combat and safehouse request the current character/equipment entry documents',()=>{
  const html=read('index.html');
  for(const [name,revision] of [['character3d','115'],['combat','114'],['safehouse','114']]){
    const refs=[...html.matchAll(new RegExp('dist/'+name+'\\.html\\?v=([^"&]+)','g'))];
    assert.ok(refs.length,name+' has a real host entry');for(const match of refs)assert.equal(match[1],revision);
  }
  assert.match(read('dist/safehouse.html'),/safehouse\.mjs\?v=114/);
  assert.match(read('dist/safehouse.mjs'),/safehouse-character\.mjs\?v=114/);
  assert.match(read('dist/combat.html'),/combat-presentation\.js\?v=114/);
});
test('every actual character consumer imports the revised armor, grip and pose modules including retained bundled templates',()=>{
  for(const file of ['dist/character3d.html','dist/safehouse-character.mjs','dist/combat-presentation.js']){
    const refs=[...read(file).matchAll(/character-(armor|grip|poses|presentation)\.(mjs|js)(\?v=[A-Za-z0-9-]+)?/g)];
    assert.ok(refs.length>=4,file+' imports the shared character runtime');
    for(const match of refs)assert.equal(match[3],'?v=114',file+' has a stale or unversioned '+match[0]);
  }
});
