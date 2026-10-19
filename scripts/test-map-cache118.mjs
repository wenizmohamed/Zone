import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('player and Studio request the actual revised map and provider-assignment script',()=>{
  assert.match(read('index.html'),/data-map-src="dist\/city-map-torn\.html\?v=118"/);
  assert.match(read('admin.js'),/city-map-torn\.html\?v=118&admin=territories/);
  assert.match(read('admin.html'),/src="\/admin\.js\?v=118"/);
  assert.match(read('dist/city-map-torn.html'),/src="\.\.\/assets\/city\/service-buildings108\.js\?v=118"/);
});
