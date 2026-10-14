import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifact = resolve(root, 'artifacts/engine-studio-20261013');
const origin = 'https://zone-torn-style-game-mockup-6cf978c.vercel.app';
const immutable = 'https://zone-final-4va7eeunr-team-auraa.vercel.app';
const deploymentId = 'dpl_FppMk5CQZFwRHxq3TZA8GNefFty3';
async function get(path) { const response = await fetch(origin + path); if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`); return response; }
const [health, active, session, admin, engine] = await Promise.all([
  get('/api/v1/health').then(r => r.json()), get('/api/v1/releases/active').then(r => r.json()),
  get('/api/v1/admin/session').then(r => r.json()), get('/admin?lang=en').then(r => r.text()), get('/engine?lang=en').then(r => r.text()),
]);
if (!health.ok || health.engine.database !== 'pgsql' || active.id !== 'b687ea177453086a8b7a70cd91a8c1e0' || active.version !== 4) throw new Error('Live persistence/release invariant changed.');
if (!admin.includes('admin-studio.js?v=97') || !engine.includes('id="engine-studio-style"') || engine.includes('href="/engine/assets/studio-engine.css')) throw new Error('Live UI asset contract failed.');
if (/items-9mm-studio-test|9mm Studio Test|studio-dispatch|Studio Dispatch|page-mv6p6avo/.test(JSON.stringify(active.manifest))) throw new Error('Specific staging fixture appeared live.');
const recovery = JSON.parse(readFileSync(resolve(root, '.tools/studio97-recovery-20261013/manifest.json'), 'utf8'));
const portable = JSON.parse(readFileSync(resolve(root, '.tools/studio97-recovery-20261013/portable-test-manifest.json'), 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
const source = recovery.files.map(entry => ({ path: entry.path, sha256: hash(readFileSync(resolve(root, entry.path))), expected: portable.find(item => item.path === entry.path)?.currentSha256 ?? entry.candidateSha256 }));
if (source.some(entry => entry.sha256 !== entry.expected)) throw new Error('Promoted source differs from reviewed snapshot.');
const cloudLog = await new Promise((resolveLog, reject) => {
  let output = ''; const child = spawn('pwsh', ['-NoProfile', '-Command', `vercel inspect ${immutable} --logs --scope team-auraa`], { cwd: root, windowsHide: true });
  child.stdout.on('data', bytes => { output += bytes.toString('utf8'); }); child.stderr.on('data', bytes => { output += bytes.toString('utf8'); });
  child.on('error', reject); child.on('close', code => code === 0 ? resolveLog(output) : reject(new Error('Cloud build log read failed.')));
});
writeFileSync(resolve(artifact, 'studio97-cloud-build.log'), cloudLog, 'utf8');
const cloudTests = [...cloudLog.matchAll(/(?:ℹ|#)\s+tests\s+(\d+)/g)].reduce((total, match) => total + Number(match[1]), 0);
if (cloudTests !== 472 || /# fail [1-9]/.test(cloudLog)) throw new Error(`Cloud test evidence mismatch: ${cloudTests}`);
const result = {
  verifiedAt: new Date().toISOString(), release: 'Open Engine Studio v97', outcome: 'APPROVED_PROMOTION_LIVE_AND_BROWSER_CHECKED', wholeProductBetaReady: false,
  authorization: 'Approve the ZONE Studio promotion',
  target: { team: 'team-auraa', projectName: 'zone-final', projectId: 'prj_jUGesNVozLbtieucfHCU9dKcy29U', deploymentId, readyState: 'READY', origin, immutable },
  links: { studioEnglish: origin + '/admin?section=overview&lang=en', studioArabic: origin + '/admin?section=overview&lang=ar', engineEnglish: origin + '/engine?lang=en', engineArabic: origin + '/engine?lang=ar' },
  invariants: { database: health.engine.database, php: health.engine.php, activeContentId: active.id, activeContentVersion: active.version, databaseReplacement: false, credentialsChanged: false, environmentChanged: false, processRestart: false, specificStagingFixturesCopied: false, publicGameMutationOrContentPublication: false, source },
  access: { configured: session.configured, authenticated: session.authenticated, credentialMode: session.credentialMode, betaTesting: session.betaTesting, unchanged: true },
  tests: { localFrontend: 472, cloudFrontend: cloudTests, adminAndEngineControllers: 92, studioBehavior: 42, isolatedPhp: 'all suites exit 0', isolatedRelay: 'exit 0', protectedStaticAndEmbeddedCssHttp: 24, cloudBuildLog: resolve(artifact, 'studio97-cloud-build.log') },
  browser: { liveAdminSections: 20, languages: ['en','ar'], liveArabicPhoneWidth: 390, liveEngineBothLanguages: true, candidateResponsiveChecks: { admin: 60, engine: 36, widths: [390,768,1440], horizontalOverflowFailures: 0 }, screenshots: ['engine-studio-live-en.jpg','engine-studio-live-ar-phone.jpg','engine-studio-live-entry-en.jpg'].map(name => ({ path: resolve(root, 'artifacts', name), sha256: hash(readFileSync(resolve(root, 'artifacts', name))) })) },
  recovery: resolve(root, '.tools/studio97-recovery-20261013'), gitCommitOrPush: false,
  correctedStagingFailure: 'First staged cloud build stopped on a Windows-only PHP test executable. The frontend contract test is now portable; actual PHP-render coverage remains in the backend HTTP suite. No test was skipped.',
  boundaries: ['Registered extension management and server-schema editor discovery are implemented; arbitrary source-package upload and autonomous AI code updates are not.', 'Branding preview retains the published theme stylesheet until the selected theme is published.', 'No full-game or physical-iPhone certification is implied by this UI release.'],
};
const output = resolve(artifact, 'STUDIO97-HANDOFF.json'); writeFileSync(output, JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ outcome: result.outcome, cloudTests, sourceMismatches: 0, database: result.invariants.database, contentVersion: active.version, output }, null, 2));
