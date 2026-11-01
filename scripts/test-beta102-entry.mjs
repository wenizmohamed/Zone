import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
const source=readFileSync(new URL('../assets/ui/canonical-entry.js',import.meta.url),'utf8');
function visit(url){const location=new URL(url), redirects=[], window={};location.replace=url=>redirects.push(url);runInContext(source,createContext({location,window,URL,URLSearchParams}));return {redirects,window};}
test('owned deployment entry uses the existing canonical origin without forwarding access tokens',()=>{
 const result=visit('https://zone-final-gciua8337-team-auraa.vercel.app/?screen=city&lang=ar&token=private&x-vercel-protection-bypass=private');
 assert.deepEqual(result.redirects,['https://zone-torn-style-game-mockup-6cf978c.vercel.app/?screen=city&lang=ar']);assert.equal(result.window.ZoneCanonicalEntry,true);
 assert.equal(result.window.ZoneCanonicalEntryStatus.redirected,true);
 assert.equal(result.window.ZoneCanonicalEntryStatus.canonicalOrigin,'https://zone-torn-style-game-mockup-6cf978c.vercel.app');
 assert.equal(result.window.ZoneCanonicalEntryStatus.isPreview,false);
 assert.deepEqual(Array.from(result.window.ZoneCanonicalEntryStatus.forwardedKeys()),['screen','lang']);
 assert.equal(result.window.ZoneCanonicalEntryStatus.isForwardedKey('screen'),true);
 assert.equal(result.window.ZoneCanonicalEntryStatus.isForwardedKey('token'),false);
});
test('canonical, local, explicit read-only preview and lookalike hosts are not redirected',()=>{
 for(const url of ['https://zone-torn-style-game-mockup-6cf978c.vercel.app/?screen=city','http://beta102.localhost:4317/','https://zone-final-d6u7x1nxt-team-auraa.vercel.app/?zone-preview=1','https://zone-final-gciua8337-team-auraa.vercel.app.evil.test/','https://unrelated-team-auraa.vercel.app/']) assert.equal(visit(url).redirects.length,0,url);
});
test('owner transport does not forward a denied sandbox command to the live player',async()=>{
 let live=0;const window={fetch:async()=>{live++;return {ok:true};},zoneOwnerPlaytest:{active:()=>true,route:async()=>{throw new Error('shared mutation denied');}}};
 runInContext(readFileSync(new URL('../assets/ui/owner-transport.js',import.meta.url),'utf8'),createContext({window,location:new URL('http://zone.test/'),URL,URLSearchParams,Response,JSON}));
 await assert.rejects(window.fetch('/api/v1/player-market/action',{method:'POST',body:'{}'}),/denied/);assert.equal(live,0);
 const diag=window.ZoneOwnerTransport.diagnostics();
 assert.equal(diag.installed,true);
 assert.equal(diag.interceptedCount,1);
 assert.equal(diag.playtestActive,true);
 assert.equal(window.ZoneOwnerTransport.isInstalled(),true);
 assert.equal(window.ZoneOwnerTransport.interceptedCount(),1);
 assert.equal(window.ZoneOwnerTransport.isPlaytestActive(),true);
 assert.equal(window.ZoneOwnerTransport.isInterceptablePath('/api/v1/player-market/action'),true);
 assert.equal(window.ZoneOwnerTransport.isInterceptablePath('/api/v1/admin/overview'),false);
});
