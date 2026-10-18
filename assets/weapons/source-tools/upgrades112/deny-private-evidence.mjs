// Test-only fresh-checkout simulation. Deny private evidence reads while the
// committed-source suite executes, without moving or deleting any artifacts.
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const privatePath=value=>/[\\/]\.tools[\\/]v112-weapons(?:[\\/]|$)/i.test(String(value));
for(const name of ['readFileSync','readFile','openSync','open']){
  const original=fs[name];
  fs[name]=function(path,...args){
    if(privatePath(path))throw new Error('Committed-source suite attempted a private evidence read: '+path);
    return Reflect.apply(original,this,[path,...args]);
  };
}
syncBuiltinESMExports();
