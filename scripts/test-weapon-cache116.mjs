import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('every active weapon consumer requests the116 library without changing shared actor modules',()=>{
  for(const file of ['dist/character3d.html','dist/weapon3d.html','dist/combat-presentation.js','dist/safehouse-character.mjs','dist/weapon-library.html']){
    const refs=[...read(file).matchAll(/weapon-assets\.js(?:\?v=[A-Za-z0-9-]+)?/g)];
    assert.ok(refs.length>0,file);for(const ref of refs)assert.equal(ref[0],'weapon-assets.js?v=116',file);
  }
  const html=read('index.html');
  assert.match(html,/assets\/weapons\/catalog\.js\?v=116/);
  assert.match(html,/player-session\.js\?v=116/);
  assert.match(html,/dist\/weapon3d\.html\?v=116/);
});
