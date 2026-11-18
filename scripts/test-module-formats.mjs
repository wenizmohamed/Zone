import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const modules = [
  'character-presentation.js', 'character-grip.js', 'character-poses.js',
  'weapon-assets.js', 'weapon-presentation.js', 'combat-presentation.js'
];

test('viewer ES modules load without implicit module-format detection warnings', () => {
  const source = modules.map(name => `await import(${JSON.stringify(new URL(`../dist/${name}`, import.meta.url).href)});`).join('\n');
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', source], {
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: '' }
  });
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /MODULE_TYPELESS_PACKAGE_JSON/);
});
