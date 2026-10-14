import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
test('Engine asset contract embeds fixed Studio CSS without a new relay route or a build-time PHP dependency', () => {
  const css = readFileSync(resolve(root, 'engine/public/assets/studio-engine.css'), 'utf8');
  const html = readFileSync(resolve(root, 'engine/public/console.php'), 'utf8');
  assert.ok(css.includes('.studio-body'));
  assert.ok(html.includes('<style id="engine-studio-style"><?php readfile(__DIR__ . \'/assets/studio-engine.css\'); ?></style>'));
  assert.ok(html.includes('class="studio-body"'));
  assert.equal(/href="\/engine\/assets\/studio-engine\.css/.test(html), false);
  assert.ok(html.includes('/engine/assets/engine.js?v=97'));
});
