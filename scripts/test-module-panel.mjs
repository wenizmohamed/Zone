import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const { create, endpoints, sections, supportedLanguages, isSupportedLanguage } = createRequire(import.meta.url)('../assets/module-panel.js');
const paths = ['/api/v1/player', '/api/v1/daily/contract', '/api/v1/achievements', '/api/v1/notifications'];
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => payload });
function fixture() {
  return {
    player: { id: 'operator', username: 'Player One', level: 2, xp: 44, cash: 500, bank_balance: 100, city: 'Zone City', strength: 4, defense: 5, speed: 6, dexterity: 7, login_streak: 2, last_login_day: '2042-05-05', life: 120, max_life: 150 },
    contract: { contract: { id: 'crime-spree', day: '2042-05-06', metric: 'crimes', name_en: 'Commit 15 crimes', name_ar: 'نفّذ 15 جريمة', target: 15, reward_cash: 4000, reward_xp: 200 }, progress: 15, target: 15, complete: true, claimed: false },
    achievements: [{ code: 'first-score', unlocked_at: '2042-05-05T12:00:00Z', source_event_id: 'event-one' }],
    notifications: [{ id: 'notice-one', type: 'cap-waste:nerve', created_at: '2042-05-06T12:00:00Z', payload: { bar: 'nerve', message_en: 'Nerve is full.', message_ar: 'شريط الأعصاب ممتلئ.' } }]
  };
}
function payloads(data) {
  return [{ player: data.player }, data.contract, { achievements: data.achievements }, { notifications: data.notifications }];
}
function api(data, override) {
  const calls = [];
  const fetch = async (path, options) => {
    calls.push({ path, options });
    const result = await override?.(path, options, calls);
    if (result !== undefined) return result;
    const index = paths.indexOf(path);
    assert.notEqual(index, -1, 'unexpected API path');
    return response(payloads(data)[index]);
  };
  return { calls, fetch };
}

test('read-only load uses four real same-origin APIs and bilingual server data', async () => {
  const data = fixture(), server = api(data), players = [], snapshots = [];
  const panel = create({ fetch: server.fetch, onPlayer: value => players.push(value), onChange: value => snapshots.push(value) });
  const view = await panel.load();
  assert.equal(server.calls.length, 4);
  for (const { path, options } of server.calls) {
    assert.ok(paths.includes(path));
    assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.body, undefined);
  }
  assert.equal(players.length, 0, 'background reads cannot overwrite main gameplay state');
  assert.equal(snapshots[0].loading, true);
  assert.equal(view.profile.bank, 100);
  assert.equal(view.profile.netWorth, 600);
  assert.equal(view.profile.totalBattleStats, 22);
  assert.equal(view.profile.stats[3].value, 7);
  assert.equal(view.contract.title, 'Commit 15 crimes');
  assert.equal(view.contract.screen, 'crimes');
  assert.equal(view.contract.canClaim, true);
  assert.equal(view.contract.remaining, 0);
  assert.equal(view.contract.percent, 100);
  assert.equal(view.streak.nextRewardCash, 1500);
  assert.equal(panel.view('ar').contract.title, 'نفّذ 15 جريمة');
  assert.equal(panel.read('ar').notifications[0].message, 'شريط الأعصاب ممتلئ.');
  assert.equal(panel.read('ar').achievements[0].title, 'الضربة الأولى');
  assert.equal(view.streak.canClaim, true, 'eligibility uses server day, not computer date');
});

test('returned player/view values do not leak mutable internal references', async () => {
  const server = api(fixture()), panel = create({ fetch: server.fetch });
  const view = await panel.load();
  view.player.cash = 0; view.profile.stats[0].value = 0; view.labels.claim = 'changed'; view.notifications[0].message = 'changed';
  assert.equal(panel.view().player.cash, 500);
  assert.equal(panel.view().profile.stats[0].value, 4);
  assert.equal(panel.view().labels.claim, 'Claim reward');
  assert.equal(panel.view().notifications[0].message, 'Nerve is full.');
});

test('concurrent reads coalesce and loading disables stale claim buttons', async () => {
  const gate = deferred(); let hold = false;
  const server = api(fixture(), async () => { if (hold) await gate.promise; });
  const panel = create({ fetch: server.fetch });
  await panel.load(); hold = true;
  const first = panel.load(), second = panel.load();
  assert.equal(first, second);
  assert.equal(panel.view().loading, true);
  assert.equal(panel.view().contract.canClaim, false);
  assert.equal(panel.view().streak.canClaim, false);
  gate.resolve(); await first;
  assert.equal(server.calls.length, 8);
});

test('partial GET failure preserves valid data and disables eligibility dependent on failed contract', async () => {
  let fail = false;
  const server = api(fixture(), path => fail && path === paths[1] ? response({ error: 'Contract unavailable.' }, 503) : undefined);
  const panel = create({ fetch: server.fetch });
  await panel.load(); fail = true;
  const view = await panel.load();
  assert.equal(view.profile.name, 'Player One');
  assert.equal(view.contract.title, 'Commit 15 crimes');
  assert.equal(view.errors.contract.status, 503);
  assert.equal(view.contract.canClaim, false);
  assert.equal(view.streak.canClaim, false);
  assert.ok(view.error);
});

test('malformed arrays and invalid JSON become section errors without breaking entire panel', async () => {
  const server = api(fixture(), path => path === paths[2] ? response({ achievements: [null] }) : path === paths[3] ? { ok: true, json: async () => { throw new Error('bad JSON'); } } : undefined);
  const view = await create({ fetch: server.fetch }).load();
  assert.ok(view.profile);
  assert.equal(view.achievements.length, 0);
  assert.equal(view.notifications.length, 0);
  assert.match(view.errors.achievements.message, /Invalid achievements/);
  assert.match(view.errors.notifications.message, /invalid response/);
});

test('invalid player and contract response shapes are isolated and cannot enable claims', async () => {
  const server = api(fixture(), path => path === paths[0] ? response({ player: {} }) : path === paths[1] ? response({ contract: { id: 'bad', day: '2042-05-06' }, target: 0 }) : undefined);
  const view = await create({ fetch: server.fetch }).load();
  assert.equal(view.player, null); assert.equal(view.contract, null);
  assert.ok(view.errors.player); assert.ok(view.errors.contract);
  assert.equal(view.achievements.length, 1);
});

test('daily claim is single-flight and authoritative refresh supplies actual player once', async () => {
  const data = fixture(), gate = deferred(), players = [], contexts = [];
  const server = api(data, async (path, options) => {
    if (options.method !== 'POST') return;
    assert.equal(path, '/api/v1/daily/contract/claim');
    assert.equal(options.body, '{}');
    await gate.promise;
    data.player.cash = 4500; data.player.xp = 244; data.contract.claimed = true;
    return response({ contractId: 'crime-spree', rewardCash: 4000, rewardXp: 200, levelUp: null });
  });
  const panel = create({ fetch: server.fetch, onPlayer: (player, context) => { players.push(player); contexts.push(context); } });
  await panel.load();
  const first = panel.claimDaily(), second = panel.claimDaily(), during = panel.load();
  assert.equal(first, second);
  assert.equal(panel.view().pending, 'daily');
  assert.equal(panel.view().player.cash, 500, 'no optimistic reward');
  await assert.rejects(panel.claimLogin(), /in progress/);
  gate.resolve();
  const result = await first;
  await during;
  assert.equal(result.rewardCash, 4000);
  assert.equal(server.calls.filter(call => call.options.method === 'POST').length, 1);
  assert.equal(panel.view().player.cash, 4500);
  assert.equal(panel.view().contract.claimed, true);
  assert.equal(panel.view().contract.canClaim, false);
  assert.equal(panel.view().lastReward.xp, 200);
  assert.deepEqual(contexts, [{ reason: 'claim', kind: 'daily' }]);
  assert.equal(players[0].max_life, 150, 'callback retains full real server schema');
  players[0].cash = 0;
  assert.equal(panel.view().player.cash, 4500);
});

test('a pre-claim GET resolving last cannot overwrite the post-claim player or progress', async () => {
  const data = fixture(), old = structuredClone(data), gate = deferred(); let readCount = 0;
  const server = api(data, async (path, options) => {
    if (options.method === 'POST') { data.player.cash = 4500; data.contract.claimed = true; return response({ contractId: 'crime-spree', rewardCash: 4000, rewardXp: 200 }); }
    if (++readCount <= 4) { await gate.promise; return response(payloads(old)[paths.indexOf(path)]); }
  });
  const panel = create({ fetch: server.fetch });
  const stale = panel.load(); await panel.claimDaily();
  assert.equal(panel.view().player.cash, 4500);
  gate.resolve(); await stale;
  assert.equal(panel.view().player.cash, 4500);
  assert.equal(panel.view().contract.claimed, true);
});

test('failed claim refreshes truth, retains error, and never credits a local reward', async () => {
  const players = [], server = api(fixture(), (_path, options) => options.method === 'POST' ? response({ error: 'Daily contract is not complete yet.' }, 400) : undefined);
  const panel = create({ fetch: server.fetch, onPlayer: player => players.push(player) });
  await panel.load();
  await assert.rejects(panel.claimDaily(), /not complete/);
  assert.equal(panel.view().player.cash, 500);
  assert.equal(panel.view().lastReward, null);
  assert.equal(panel.view().pending, null);
  assert.match(panel.view().errorDetail, /not complete/);
  assert.equal(players.length, 0);
  assert.equal(server.calls.length, 9);
  await panel.load();
  assert.equal(panel.view().error, null);
});

test('accepted reward with failed refresh is not retried or reported as a failed mutation', async () => {
  let claimed = false;
  const server = api(fixture(), (_path, options) => {
    if (options.method === 'POST') { claimed = true; return response({ contractId: 'crime-spree', rewardCash: 4000, rewardXp: 200 }); }
    if (claimed) return response({ error: 'Temporarily unavailable.' }, 503);
  });
  const panel = create({ fetch: server.fetch });
  await panel.load(); const result = await panel.claimDaily();
  assert.equal(result.rewardCash, 4000);
  assert.match(panel.view().error, /Reward accepted/);
  assert.equal(panel.view().player.cash, 500, 'stale server cash retained, not synthesized');
  assert.equal(panel.view().contract.canClaim, false);
  assert.equal(server.calls.filter(call => call.options.method === 'POST').length, 1);
});

test('already collected login response has no invented reward or repeated POST', async () => {
  const data = fixture(); data.player.last_login_day = data.contract.contract.day;
  const server = api(data, (path, options) => options.method === 'POST' ? (assert.equal(path, '/api/v1/daily/login'), response({ streak: null })) : undefined);
  const panel = create({ fetch: server.fetch });
  await panel.load(); await panel.claimLogin();
  assert.equal(panel.view().streak.claimed, true);
  assert.equal(panel.view().streak.canClaim, false);
  assert.deepEqual(panel.view().lastReward, { kind: 'login', alreadyClaimed: true, cash: 0, xp: 0, streakDay: 0, nerveRefilled: false, energyRefilled: false });
  assert.equal(panel.view().player.cash, 500);
});

test('login reward preserves real streak and refill results after server refresh', async () => {
  const data = fixture();
  const server = api(data, (_path, options) => {
    if (options.method === 'POST') { data.player.cash += 1000; data.player.login_streak = 3; data.player.last_login_day = data.contract.contract.day; return response({ streak: { streakDay: 3, rewardCash: 1000, nerveRefilled: true, energyRefilled: false } }); }
  });
  const panel = create({ fetch: server.fetch });
  await panel.claimLogin();
  assert.equal(panel.view().player.cash, 1500);
  assert.equal(panel.view().streak.day, 3);
  assert.equal(panel.view().lastReward.nerveRefilled, true);
  assert.equal(panel.view().lastReward.energyRefilled, false);
});

test('preview loads and attempted claims make zero network calls', async () => {
  let calls = 0;
  const panel = create({ preview: true, fetch: async () => { calls++; throw new Error('must not request'); } });
  assert.equal((await panel.load()).preview, true);
  assert.equal(panel.read().player, null);
  await assert.rejects(panel.claimDaily(), /preview/);
  await assert.rejects(panel.claimLogin(), /preview/);
  assert.equal(calls, 0);
});

test('disposal suppresses late responses, player callbacks and further requests', async () => {
  const gate = deferred(), players = [], changes = [];
  const server = api(fixture(), async () => { await gate.promise; });
  const panel = create({ fetch: server.fetch, onPlayer: player => players.push(player), onChange: view => changes.push(view) });
  const load = panel.load(); assert.equal(changes.length, 1);
  panel.dispose(); gate.resolve(); await load;
  assert.equal(changes.length, 1); assert.equal(players.length, 0);
  assert.equal(panel.view().player, null);
  await panel.load(); await assert.rejects(panel.claimLogin(), /closed/);
  assert.equal(server.calls.length, 4);
});

test('disposing during a claim never starts follow-up GETs or callbacks', async () => {
  const gate = deferred(), players = [];
  const server = api(fixture(), async (_path, options) => { if (options.method === 'POST') { await gate.promise; return response({ streak: null }); } });
  const panel = create({ fetch: server.fetch, onPlayer: player => players.push(player) });
  const claim = panel.claimLogin(); panel.dispose(); gate.resolve(); await claim;
  assert.equal(server.calls.length, 1); assert.equal(players.length, 0);
  const diag = panel.diagnostics();
  assert.equal(diag.disposed, true);
  assert.equal(diag.pending, null);
  assert.deepEqual(supportedLanguages(), ['en', 'ar']);
  assert.equal(isSupportedLanguage('en'), true);
  assert.equal(isSupportedLanguage('ar'), true);
  assert.equal(isSupportedLanguage('fr'), false);
  assert.deepEqual(sections(), ['player', 'contract', 'achievements', 'notifications']);
  assert.deepEqual(Object.values(endpoints()), paths);
});
