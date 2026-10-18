import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, openSync, closeSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import test from 'node:test';

// Real HTTP receipts are fed through the same client VM pattern used by
// test-client.mjs. This is ordinary-player CPU/HTTP evidence, not pixel proof.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const source = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
const catalog = readFileSync(resolve(root, 'assets/weapons/catalog.js'), 'utf8');
const sessionSource = readFileSync(resolve(root, 'player-session.js'), 'utf8');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceHash = sha256(html);
const evidenceRoot = resolve(root, '.tools/journey112', randomUUID());
mkdirSync(evidenceRoot, { recursive: true });
const php = [resolve(root, '.tools/php-8.5.10/php.exe'),
  resolve(root, '../php-8.5.10/php.exe'), process.env.ZONE_TEST_PHP].find(path => path && existsSync(path));
assert.ok(php, 'Existing repository-local PHP is required. No runtime is installed by this test.');
const database = resolve(evidenceRoot, 'ordinary.sqlite');
const evidence = {
  kind: 'ordinary-player VM plus isolated SQLite HTTP',
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim(),
  indexSha256: sourceHash, playerSessionSha256: sha256(sessionSource), database,
  productionRequests: 0, ownerGrants: 0, walletOrStatFixtures: 0,
  browserPixels: false, journeys: [],
};

async function freePort() {
  const probe = createServer();
  await new Promise((done, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', done); });
  const port = probe.address().port;
  await new Promise(done => probe.close(done));
  return port;
}

async function server() {
  const port = await freePort(), base = 'http://127.0.0.1:' + port;
  const log = openSync(resolve(evidenceRoot, 'server.log'), 'a');
  const environment = {
    ...process.env, ZONE_DATABASE_URL: 'sqlite:' + database, DATABASE_URL: '', POSTGRES_URL: '',
    VERCEL: '1', ZONE_PLAYER_SESSIONS: '1', ZONE_PLAYER_AUTH: '',
    ZONE_ADMIN_TOKEN: randomUUID() + randomUUID(), ZONE_BETA_OWNER_ACCESS: '0',
    ZONE_ENGINE_RELAY_KEY: '', ZONE_RATE_LIMIT_MAX: '240', ZONE_RATE_LIMIT_WINDOW: '10',
    ZONE_CACHE_DRIVER: 'array', REDIS_URL: '', ZONE_REDIS_URL: '',
  };
  const child = spawn(php, ['-S', '127.0.0.1:' + port, '-t', root, resolve(root, 'engine/router.php')], {
    cwd: root, env: environment, windowsHide: true, stdio: ['ignore', log, log], shell: false,
  });
  closeSync(log);
  let stopped = false;
  const stop = async () => {
    if (stopped || child.exitCode !== null) return;
    stopped = true;
    await new Promise(done => { child.once('exit', done); child.kill(); });
  };
  const api = async (path, options = {}, jar = null) => {
    const url = new URL(path, 'http://zone.test');
    assert.equal(url.origin, 'http://zone.test', 'Client calls cannot escape the isolated HTTP target.');
    const headers = {
      ...options.headers, Accept: 'application/json',
      Origin: 'https://127.0.0.1:' + port, 'X-Forwarded-Proto': 'https',
      ...(jar?.cookie ? { Cookie: jar.cookie } : {}),
    };
    const response = await fetch(base + url.pathname + url.search, { ...options, headers });
    for (const value of response.headers.getSetCookie()) {
      if (jar && value.startsWith('zone_player_session=')) jar.cookie = value.split(';')[0];
    }
    return response;
  };
  try {
    let health;
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw Error('Owned PHP helper exited with ' + child.exitCode);
      try { const response = await api('/api/v1/health'); if (response.ok) { health = await response.json(); break; } }
      catch { /* The owned helper has not bound its socket yet. */ }
      await new Promise(done => setTimeout(done, 100));
    }
    assert.equal(health?.ok, true, 'Private PHP helper becomes healthy.');
    assert.equal(health.engine.database, 'sqlite', 'Health independently confirms the SQLite adapter.');
    assert.equal(readFileSync(database).subarray(0, 16).toString(), 'SQLite format 3\0');
    evidence.isolation = { adapter: health.engine.database, database, php, ownedPid: child.pid,
      explicitDatabaseUrl: environment.ZONE_DATABASE_URL, postgresVariablesEmpty: true,
      listenAddress: '127.0.0.1', windowsHide: true };
    return { api, stop };
  } catch (error) { await stop(); throw error; }
}

function game(api, lang, jar, previousStorage = new Map()) {
  const messages = [], calls = [], timers = new Map(), storage = new Map(previousStorage);
  let timerId = 0;
  const frames = Object.fromEntries(['zone-city-map', 'zone-char-3d', 'zone-item-3d'].map(id => [id,
    { contentWindow: { postMessage(data, origin) { messages.push({ id, data, origin }); } } }]));
  const location = new URL('http://zone.test/?screen=home&lang=' + lang);
  const nativeFetch = async (path, options) => {
    const response = await api(String(path), options, jar);
    const body = await response.clone().json();
    calls.push({ path: String(path), method: options?.method || 'GET', request: options?.body ? JSON.parse(options.body) : null,
      status: response.status, response: body });
    return response;
  };
  const window = { location, fetch: nativeFetch,
    history: Object.fromEntries(['pushState', 'replaceState'].map(method => [method,
      (_state, _title, href) => { location.href = href; }])),
    ZonePlatform: { preview: false, active: () => ({ version: 0, manifest: {} }), data: () => ({}), status: () => 'connected' },
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
  };
  const context = createContext({
    console, URL, URLSearchParams, location, Date, window,
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    document: { documentElement: { dataset: {}, style: { setProperty() {} } }, getElementById: id => frames[id] || null },
    setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; }, clearTimeout: id => timers.delete(id),
    setInterval: () => 0, clearInterval() {}, addEventListener() {},
    React: { createElement: () => ({}) },
    DCLogic: class { constructor(props) { this.props = props; }
      setState(value, done) { Object.assign(this.state, typeof value === 'function' ? value(this.state) : value); done?.(); }
      forceUpdate() {} },
  });
  runInContext(sessionSource, context);
  context.fetch = window.fetch;
  runInContext(catalog, context);
  runInContext(source + '\nglobalThis.clientExports = { Component, T, CAT };', context);
  const { Component, T, CAT } = context.clientExports;
  const instance = new Component({});
  instance.bump = () => {};
  return { instance, T, CAT, calls, messages, storage, context,
    async resolveAction(callback, delay) {
      callback();
      const entry = [...timers].find(([, timer]) => timer.delay === delay);
      assert.ok(entry, 'The real player action schedules its intended consequence.');
      timers.delete(entry[0]); await entry[1].fn();
    } };
}

const plain = value => JSON.parse(JSON.stringify(value));

test('ordinary EN and AR opening and fresh return use real actions and durable isolated state', async t => {
  let runtime = await server();
  t.after(async () => {
    await runtime.stop();
    writeFileSync(resolve(evidenceRoot, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
    console.log('ORDINARY JOURNEY EVIDENCE: ' + resolve(evidenceRoot, 'evidence.json'));
  });
  for (const lang of ['en', 'ar']) {
    await t.test(lang + ' opening, inventory, job, gym and return', async () => {
      const jar = {}, app = game(runtime.api, lang, jar), { instance, T, CAT } = app;
      await instance.loadGameplay();
      assert.equal(instance.gameplayReady, true, instance.gameplayError);
      assert.equal(instance.p.cash, 2500);
      assert.equal(instance.p.level, 1);
      assert.equal(instance.p.equip, 'fists');
      assert.deepEqual(plain(instance.p.inv), { smallkit: 1 });
      const playerId = instance.p.playerId;
      assert.ok(playerId && playerId !== 'founder-player' && !playerId.startsWith('owner-playtest-'));
      const opening = { id: playerId, cash: instance.p.cash, energy: instance.cur('energy'), nerve: instance.cur('nerve'),
        stats: plain(instance.p.stats), inventory: plain(instance.p.inv) };
      let view = instance.renderVals();
      assert.equal(view.connectionRecovery.visible, false);
      assert.match(view.connectionLabel, lang === 'ar' ? /متصل/ : /^Connected/);
      assert.equal(view.inventoryIsOwned, true);
      assert.equal(view.inv.length, 1);
      assert.equal(view.inv[0].name, T[lang].items.smallkit);
      view.inventoryCatalog(); view = instance.renderVals();
      assert.equal(view.inventoryIsCatalog, true);
      assert.ok(view.inv.length > 50);
      assert.ok(view.inv.some(row => row.name === T[lang].items.bat));
      const catalogCount = view.inv.length;
      for (const type of ['weapon', 'armor', 'medical', 'booster', 'material']) {
        instance.renderVals().itemTabs.find(tab => tab.name === T[lang].itemTabs[type]).go();
        const filtered = instance.renderVals();
        assert.ok(filtered.inv.every(row => row.type === T[lang].itemType[type]));
        assert.equal(filtered.sel.visible, filtered.inv.length > 0);
        if (filtered.inv.length) assert.ok(filtered.inv.some(row => row.name === filtered.sel.name));
      }
      instance.renderVals().itemTabs.find(tab => tab.name === T[lang].itemTabs.all).go();
      view = instance.renderVals();
      assert.equal(view.inv.length, catalogCount, 'Catalog All returns every published category, not only weapons.');
      const beforeInspect = app.calls.filter(call => call.method === 'POST').length;
      const catalogBat = view.inv.find(row => row.name === T[lang].items.bat);
      catalogBat.select(); instance.push3d();
      assert.equal(instance.renderVals().sel.name, T[lang].items.bat);
      assert.equal(app.calls.filter(call => call.method === 'POST').length, beforeInspect);
      assert.equal(catalogBat.disabled, false);
      const price = CAT.bat.price;
      await catalogBat.act();
      assert.equal(instance.p.cash, opening.cash - price);
      assert.equal(instance.p.inv.bat, 1);
      const purchase = app.calls.findLast(call => call.request?.action === 'item.buy');
      assert.equal(purchase.status, 200);
      assert.equal(purchase.request.id, 'bat');
      assert.equal(Number.isInteger(purchase.request.expectedVersion), true);
      assert.equal(purchase.response.result.cashDelta, -price);
      view = instance.renderVals(); view.inventoryOwned(); view = instance.renderVals();
      assert.equal(view.inventoryIsOwned, true);
      assert.equal(view.inv.length, 2);
      view.itemTabs.find(tab => tab.name === T[lang].itemTabs.armor).go();
      assert.equal(instance.renderVals().invEmpty, true);
      assert.equal(instance.renderVals().sel.visible, false, 'An empty owned category cannot retain a catalog weapon inspector.');
      instance.renderVals().itemTabs.find(tab => tab.name === (lang === 'ar' ? 'كل ما أملكه' : 'All owned')).go();
      view = instance.renderVals();
      const ownedBat = view.inv.find(row => row.name === T[lang].items.bat);
      assert.equal(ownedBat.btn, T[lang].equip);
      await ownedBat.act();
      assert.equal(instance.p.equip, 'bat');
      assert.equal(instance.renderVals().equippedName, T[lang].items.bat);
      instance.pushChar();
      const character = app.messages.findLast(row => row.id === 'zone-char-3d').data.character;
      assert.equal(character.weapon, 'bat');
      assert.deepEqual(plain(character.ownedWeapons), ['fists', 'bat']);
      assert.equal(character.equipmentKeys.bat, 'bat');
      assert.equal(character.draft, false);
      assert.equal(instance.renderVals().equippedInspection.visible, true);

      instance.state.screen = 'jobs'; view = instance.renderVals();
      const currentJob = view.jobs.find(job => job.current);
      assert.ok(currentJob, 'Starter employment is a real selected job.');
      assert.equal(view.job.energy, 15);
      assert.equal(view.job.pay, '$850');
      assert.equal(view.job.disabled, false);
      assert.equal(view.jobs.find(job => job.id === currentJob.id).disabled, true);
      assert.ok(view.jobs.filter(job => job.locked).every(job => job.disabled && job.reason));
      const beforeJob = { cash: instance.p.cash, energy: instance.cur('energy'), points: instance.p.jobPts, shifts: instance.p.ctr.shifts };
      await app.resolveAction(view.work, 620);
      const shift = app.calls.findLast(call => call.path === '/api/v1/jobs/work');
      assert.equal(shift.status, 200);
      assert.deepEqual(shift.request, {});
      assert.equal(instance.p.cash, beforeJob.cash + shift.response.reward.cash + Number(shift.response.streak?.rewardCash || 0));
      assert.equal(instance.cur('energy'), beforeJob.energy - shift.response.cost.energy);
      assert.equal(instance.p.jobPts, beforeJob.points + 1);
      assert.equal(instance.p.ctr.shifts, beforeJob.shifts + 1);
      assert.equal(instance.renderVals().bars.find(bar => bar.id === 'energy').value, instance.cur('energy'));
      assert.equal(instance.renderVals().bars.find(bar => bar.id === 'energy').label, T[lang].energy);
      assert.match(instance.state.result.big, /850/);
      const jobFeedback = plain(instance.state.result);
      view = instance.renderVals();
      assert.equal(view.job.disabled, true, 'The UI disables work during the real persistent cooldown.');
      assert.match(view.job.reason, lang === 'ar' ? /الوردية التالية/ : /Next shift/);
      const shiftsAfterWork = app.calls.filter(call => call.path === '/api/v1/jobs/work').length;
      instance.renderVals().inventoryCatalog();
      instance.renderVals().inventoryOwned();
      assert.equal(app.calls.filter(call => call.path === '/api/v1/jobs/work').length, shiftsAfterWork);

      instance.state.screen = 'gym'; view = instance.renderVals();
      const beforeTrain = { strength: instance.p.stats.str, energy: instance.cur('energy'), trains: instance.p.ctr.trains };
      assert.equal(view.trainOff, false);
      await app.resolveAction(view.stats[0].train, 480);
      const training = app.calls.findLast(call => call.path === '/api/v1/gym/train');
      assert.equal(training.status, 200);
      assert.deepEqual(training.request, { stat: 'strength', sessions: 1 });
      assert.ok(training.response.gain > 0);
      assert.equal(instance.p.stats.str, beforeTrain.strength + training.response.gain);
      assert.equal(instance.cur('energy'), beforeTrain.energy - training.response.cost.energy);
      assert.equal(instance.p.ctr.trains, beforeTrain.trains + 1);
      assert.equal(instance.state.lastTrain.k, 'str');
      assert.equal(Number(instance.state.lastTrain.g), Number(training.response.gain.toFixed(2)));
      assert.equal(instance.state.result.title, T[lang].str);
      assert.equal(instance.renderVals().bars.find(bar => bar.id === 'energy').value, beforeTrain.energy - training.response.cost.energy);

      // Wait for the real server deadline, never overwrite it or refill resources.
      const cooldownDeadline = Number(instance.cooldowns?.actions?.job?.availableAtEpoch || 0) * 1000;
      const remaining = Math.max(0, cooldownDeadline - Date.now() + 100);
      assert.ok(remaining <= 10500, 'Ordinary job cooldown stays within the published ten-second rule.');
      if (remaining) await new Promise(done => setTimeout(done, remaining));
      instance.state.screen = 'jobs'; view = instance.renderVals();
      assert.equal(view.job.disabled, false, 'The ordinary shift enables after its real deadline.');
      const beforeRepeat = { cash: instance.p.cash, energy: instance.cur('energy'), shifts: instance.p.ctr.shifts };
      await app.resolveAction(view.work, 620);
      const repeat = app.calls.findLast(call => call.path === '/api/v1/jobs/work');
      assert.equal(repeat.status, 200);
      assert.equal(Number(repeat.response.streak?.rewardCash || 0), 0, 'The same UTC day cannot repeat the daily reward.');
      assert.equal(instance.p.cash, beforeRepeat.cash + repeat.response.reward.cash);
      assert.equal(instance.cur('energy'), beforeRepeat.energy - repeat.response.cost.energy);
      assert.equal(instance.p.ctr.shifts, beforeRepeat.shifts + 1);
      assert.equal(instance.state.result.big, '+$850');
      const repeatFeedback = plain(instance.state.result);
      assert.doesNotMatch([repeatFeedback.title, repeatFeedback.body, repeatFeedback.big].join(' '), /1,000|1000/,
        'A repeat shift cannot announce a daily bonus it did not receive.');

      const saved = { cash: instance.p.cash, inv: plain(instance.p.inv), equip: instance.p.equip,
        stats: plain(instance.p.stats), ctr: plain(instance.p.ctr), job: instance.p.job, jobPts: instance.p.jobPts };
      await runtime.stop(); runtime = await server();
      const returned = game(runtime.api, lang, jar);
      assert.equal(returned.storage.size, 0, 'Return starts without a presentation cache.');
      await returned.instance.loadGameplay();
      assert.equal(returned.instance.gameplayReady, true, returned.instance.gameplayError);
      assert.equal(returned.instance.p.playerId, playerId);
      assert.deepEqual({ cash: returned.instance.p.cash, inv: plain(returned.instance.p.inv), equip: returned.instance.p.equip,
        stats: plain(returned.instance.p.stats), ctr: plain(returned.instance.p.ctr), job: returned.instance.p.job,
        jobPts: returned.instance.p.jobPts }, saved);
      assert.equal(returned.calls.filter(call => call.request?.action || ['/api/v1/gym/train', '/api/v1/jobs/work'].includes(call.path)).length, 0,
        'Return hydration cannot replay a purchase, equip, training or wage.');
      returned.instance.pushChar();
      assert.equal(returned.messages.findLast(row => row.id === 'zone-char-3d').data.character.weapon, 'bat');
      assert.equal(returned.instance.renderVals().connectionRecovery.visible, false);
      assert.equal(returned.instance.renderVals().equippedName, T[lang].items.bat);
      for (const key of ['energy', 'nerve', 'happy', 'life']) {
        const bar = returned.instance.renderVals().bars.find(row => row.id === key);
        assert.equal(bar.value, returned.instance.cur(key));
        assert.equal(bar.label, T[lang][key]);
      }
      evidence.journeys.push({ lang, opening, saved, returnedPlayerId: playerId, jobFeedback, repeatFeedback,
        catalogCount, ownedCount: 2,
        returnEmptyCache: true, serverRestart: true, characterWeapon: character.weapon,
        mutations: app.calls.filter(call => call.method === 'POST' && call.path !== '/api/v1/auth/session'),
        returns: returned.calls.map(call => ({ path: call.path, status: call.status })) });
    });
  }
  for (const journey of evidence.journeys) {
    await t.test(journey.lang + ' first-job feedback explains the authoritative daily bonus', () => {
      const shift = journey.mutations.find(call => call.path === '/api/v1/jobs/work').response;
      assert.equal(shift.streak.rewardCash, 1000, 'Ordinary first work earned its normal daily reward.');
      const feedback = [journey.jobFeedback.title, journey.jobFeedback.body, journey.jobFeedback.big].join(' ');
      journey.jobFeedbackExplainsDailyBonus = /1,000|1000/.test(feedback) &&
        (journey.lang === 'ar' ? /مكافأة|دخول/ : /bonus|login|streak/i).test(feedback);
      assert.match(feedback, /1,000|1000/, 'The wage popup must explain the separate $1000 bonus in the actual receipt.');
      assert.match(journey.jobFeedback.big, /1,850|1850/, 'The primary amount reconciles to both real cash receipts.');
      assert.match(feedback, journey.lang === 'ar' ? /مكافأة|دخول/ : /bonus|login|streak/i,
        'The additional cash needs a localized reason rather than an unexplained wallet jump.');
    });
  }
  assert.equal(sha256(readFileSync(resolve(root, 'index.html'), 'utf8')), sourceHash,
    'The client source stayed the same for the entire recorded journey.');
  evidence.functionalJourneyResult = evidence.journeys.length === 2 ? 'passed' : 'incomplete';
});
