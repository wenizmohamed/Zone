import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Beta102 explicitly repairs the renderer. Keep the approved world inputs
// byte-exact, rather than freeze the bugs or bless regenerated renderer hashes.
const approvedMap = {
  'dist/map-icons.js': '778d9a811a6cb246d00e4aa0f3c7f4158cbde57586fa9740748ba46249a82242',
  'dist/territory-geometry.js': '19542a0e42bcf58636d0958ce9c23bc66f029b8a115be9a04c73485819a643df',
  'dist/map-frame-sample.js': 'ad6ad2e4d8c0a303a49273568cd99d934ef3178785cac2afc23499edc5f4c22a'
};
for (const [path, sha256] of Object.entries(approvedMap)) {
  test(`beta102 preserves accepted world input bytes: ${path}`, () => {
    const bytes = readFileSync(new URL(`../${path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sha256);
  });
}
test('v99 preserves the accepted city grid and bounded map dimensions', () => {
  const source = readFileSync(new URL('../assets/zone-design.css', import.meta.url), 'utf8');
  assert.match(source, /\.zone-city-workspace\s*\{[^}]*grid-template-columns:minmax\(0,1fr\) 252px/);
  assert.match(source, /\.zone-city-map-shell\s*\{[^}]*height:480px !important/);
  assert.match(source, /\.zone-city-map-shell\.zone-city-map-expanded\s*\{[^}]*height:100dvh !important/);
});
