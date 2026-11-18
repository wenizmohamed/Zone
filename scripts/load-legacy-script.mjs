import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileFunction } from 'node:vm';

// These self-contained UMD map scripts still ship as classic browser scripts.
// Exercise their CommonJS export branch without treating every dist/*.js as CJS
// or rewriting the byte-preserved browser assets to add ES module exports.
export function loadLegacyScript(url) {
  const module = { exports: {} };
  compileFunction(readFileSync(url, 'utf8'), ['module', 'exports'], {
    filename: fileURLToPath(url)
  })(module, module.exports);
  return module.exports;
}
