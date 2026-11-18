import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const reporter = fileURLToPath(new URL('./build-test-reporter.mjs', import.meta.url));
function run(source) {
  const dir = mkdtempSync(join(tmpdir(), 'zone-reporter-'));
  try {
    const file = join(dir, 'fixture.mjs');
    writeFileSync(file, `import test from 'node:test';\n${source}`);
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    return spawnSync(process.execPath, ['--test', `--test-reporter=${reporter}`, file], { encoding: 'utf8', env });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('passing negative-path names are omitted while counts remain visible', () => {
  const result = run("test('expired action error makes selection sticky', () => {});");
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /expired action error/);
  assert.match(result.stdout, /pass 1/);
  assert.match(result.stdout, /fail 0/);
});

test('real failures retain their name, stack and nonzero exit status', () => {
  const result = run("test('broken action', () => { throw new Error('sentinel failure'); });");
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /FAIL: broken action/);
  assert.match(result.stdout, /sentinel failure/);
  assert.match(result.stdout, /fixture\.mjs:/);
  assert.match(result.stdout, /fail 1/);
});

test('test stdout, stderr and Node warnings remain visible', () => {
  const result = run("test('output', () => { console.log('stdout sentinel'); console.error('stderr sentinel'); process.emitWarning('warning sentinel'); });");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /stdout sentinel/);
  assert.match(result.stdout, /stderr sentinel/);
  assert.match(result.stdout, /Warning: warning sentinel/);
});
