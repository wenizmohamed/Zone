import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const source = readFileSync(new URL('../engine/public/assets/engine.js', import.meta.url), 'utf8');
const bindingStart = source.indexOf("\n$('#languageButton').addEventListener");
const startupStart = source.lastIndexOf('\napplyLanguage();');
assert.ok(bindingStart > 0 && startupStart > bindingStart, 'The real console definitions and UI bindings must be present.');

const crime = { id: 'shoplift', name_en: 'Shoplift', name_ar: 'سرقة متجر', nerve_cost: 2, successRate: 75 };
const fixtures = {
  '/api/v1/engine': { php: '8.5.10', database: 'pgsql', moduleCount: 1 },
  '/api/v1/modules': { modules: [{ id: 'crime', name: 'Crime', version: '1.0.0', description: 'Crime rules', description_ar: 'الجرائم', installed: true, enabled: true, provides: [], subscribes: [] }] },
  '/api/v1/themes': { themes: [{ id: 'terminal', name: 'Terminal', version: '1.0.0', description: 'Theme', description_ar: 'ثيم', preview: '#123456', active: false }] },
  '/api/v1/player': { player: { id: 'fixture-player', cash: 100, nerve: 10, max_nerve: 20, energy: 30, max_energy: 100, level: 1 } },
  '/api/v1/crimes': { crimes: [crime] },
  '/api/v1/ledger': { entries: [] },
  '/api/v1/events': { events: [] },
  '/api/v1/architecture': { requestFlow: ['Web', 'API', 'Domain'], infrastructure: ['PHP', 'PostgreSQL'] },
};
const receipt = { success: true, reward: { cash: 25, xp: 2 }, serverProof: { eventId: 'fixture-event-1', calculatedBy: 'server' } };

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function consoleApp({ request, language = 'en' } = {}) {
  const elements = new Map(), calls = [], notices = [];
  const element = selector => {
    if (!elements.has(selector)) {
      let markup = '', value = '';
      const listeners = new Map();
      const widget = {
        dataset: {}, textContent: '', disabled: false, className: '', options: [],
        classList: { add() {}, remove() {} },
        get value() { return value; }, set value(next) { value = String(next); },
        get innerHTML() { return markup; },
        set innerHTML(next) {
          markup = String(next);
          if (selector === '#crimeSelect') {
            this.options = [...markup.matchAll(/<option value="([^"]*)"/g)].map(match => ({ value: match[1] }));
            value = this.options[0]?.value ?? '';
          }
        },
        addEventListener(type, callback) { listeners.set(type, callback); },
        async click() { assert.equal(this.disabled, false, `${selector} is disabled`); return listeners.get('click')?.(); },
        scrollIntoView() {},
      };
      elements.set(selector, widget);
    }
    return elements.get(selector);
  };
  const moduleButton = element('[data-module]'); moduleButton.dataset = { module: 'crime', action: 'disable' };
  const themeButton = element('[data-theme]'); themeButton.dataset = { theme: 'terminal' };
  const queryAll = selector => selector === '[data-module], [data-theme]' ? [moduleButton, themeButton]
    : selector === '[data-module]' ? [moduleButton] : selector === '[data-theme]' ? [themeButton] : [];
  const context = createContext({
    console, URL, URLSearchParams,
    location: { search: `?lang=${language}`, origin: 'https://zone.test', href: `https://zone.test/engine?lang=${language}` },
    history: { replaceState() {} },
    document: { documentElement: { lang: language }, querySelector: element, querySelectorAll: queryAll },
    setTimeout: () => 0, clearTimeout() {},
    noticeStub: message => notices.push(message),
    fetch: async (url, options = {}) => {
      const call = { url, method: options.method ?? 'GET', body: options.body };
      calls.push(call);
      const result = request ? await request(call) : undefined;
      const status = result?.status ?? 200;
      const data = result?.data ?? (call.method === 'POST' ? url.includes('/attempt') ? receipt : { saved: true } : fixtures[url]);
      assert.ok(data !== undefined, `Unexpected fixture request: ${call.method} ${url}`);
      return { ok: status >= 200 && status < 300, status, json: async () => structuredClone(data) };
    },
  });
  // Run the actual API, controls, actions, refresh, rendering, and click bindings.
  // Only the toast timer and automatic initial network call are omitted.
  runInContext(source.slice(0, bindingStart) + '\n' + source.slice(bindingStart, startupStart) + `
    toast = noticeStub;
    globalThis.engineApp = { state, refresh, updateControls, renderAll, changeModule, activateTheme, attemptCrime, engineSummary, engineDiagnostics, permittedEngineSections, isPermittedEngineSection };
  `, context);
  const app = context.engineApp;
  app.updateControls();
  return { ...app, element, calls, notices, moduleButton, themeButton };
}

function mutationCount(app) { return app.calls.filter(call => call.method === 'POST').length; }
function assertMutationControls(app, disabled) {
  for (const selector of ['#attemptButton', '#runCrimeButton']) assert.equal(app.element(selector).disabled, disabled, selector);
  assert.equal(app.moduleButton.disabled, disabled, 'module button');
  assert.equal(app.themeButton.disabled, disabled, 'theme button');
}

test('console bootstrap failure disables every mutation and leaves explicit data refresh available', async () => {
  const app = consoleApp({ request: async call => call.url === '/api/v1/engine' ? { status: 503, data: { error: 'Engine unavailable' } } : undefined });
  await assert.rejects(app.refresh(), /Engine unavailable/);
  assert.equal(app.state.ready, false); assert.equal(app.state.refreshing, false);
  assertMutationControls(app, true); assert.equal(app.element('#refreshEngineButton').disabled, false);
  await app.changeModule('crime', 'disable'); await app.activateTheme('terminal'); await app.attemptCrime();
  assert.equal(mutationCount(app), 0);
});

test('ready, busy and refreshing gates prevent direct or competing module, theme and crime writes', async () => {
  const app = consoleApp(); await app.refresh();
  for (const flags of [{ ready: false, busy: false, refreshing: false }, { ready: true, busy: true, refreshing: false }, { ready: true, busy: false, refreshing: true }]) {
    Object.assign(app.state, flags); app.updateControls(); assertMutationControls(app, true);
    await app.changeModule('crime', 'disable'); await app.activateTheme('terminal'); await app.attemptCrime();
    assert.equal(mutationCount(app), 0);
  }
  Object.assign(app.state, { ready: true, busy: false, refreshing: false }); app.updateControls(); assertMutationControls(app, false);
});

test('an in-flight module commit owns the mutation gate and controls recover after its server refresh', async () => {
  const gate = deferred();
  const app = consoleApp({ request: async call => { if (call.method === 'POST') await gate.promise; } });
  await app.refresh(); const pending = app.changeModule('crime', 'disable');
  assert.equal(app.state.busy, true); assertMutationControls(app, true); assert.equal(app.element('#refreshEngineButton').disabled, true);
  await app.changeModule('crime', 'enable'); await app.activateTheme('terminal'); await app.attemptCrime();
  assert.equal(mutationCount(app), 1);
  gate.resolve(); await pending;
  assert.equal(app.state.busy, false); assert.equal(app.state.ready, true); assertMutationControls(app, false);
  assert.equal(app.element('#refreshEngineButton').disabled, false);
});

test('in-flight snapshot refresh excludes mutations and a repeated refresh cannot overlap reads', async () => {
  const gate = deferred();
  const app = consoleApp({ request: async call => { if (call.url === '/api/v1/events') await gate.promise; } });
  const pending = app.refresh(); assert.equal(app.state.refreshing, true); assertMutationControls(app, true);
  const reads = app.calls.length;
  await app.refresh(); await app.changeModule('crime', 'disable'); await app.activateTheme('terminal');
  assert.equal(app.calls.length, reads); assert.equal(mutationCount(app), 0);
  gate.resolve(); await pending;
  assert.equal(app.state.ready, true); assert.equal(app.state.refreshing, false); assertMutationControls(app, false);
});

for (const action of ['module', 'theme', 'crime']) {
  test(`committed ${action} receipt survives follow-up read failure, never repeats, and explicit refresh restores controls`, async () => {
    let failEvidence = false;
    const app = consoleApp({ request: async call => {
      if (call.method === 'POST') failEvidence = true;
      if (failEvidence && call.url === '/api/v1/events') return { status: 503, data: { error: 'Evidence unavailable' } };
    } });
    await app.refresh();
    if (action === 'module') await app.changeModule('crime', 'disable');
    else if (action === 'theme') await app.activateTheme('terminal');
    else await app.attemptCrime();
    assert.equal(mutationCount(app), 1); assert.equal(app.state.ready, false); assert.equal(app.state.busy, false); assert.equal(app.state.refreshing, false);
    assertMutationControls(app, true); assert.equal(app.element('#refreshEngineButton').disabled, false);
    assert.match(app.notices.at(-1), /server action completed/);
    assert.match(app.element('#apiTrace').textContent, /POST \/api\/v1\//, 'The committed server response remains in the trace.');
    if (action === 'crime') assert.match(app.element('#crimeResult').textContent, /Server success.*cash 25.*fixture-event-1.*server/);
    else assert.ok(app.notices.some(message => /Configuration saved/.test(message)), 'The committed configuration receipt was displayed.');
    await app.changeModule('crime', 'enable'); await app.activateTheme('terminal'); await app.attemptCrime();
    assert.equal(mutationCount(app), 1, 'Failed follow-up reads must not replay the mutation.');
    failEvidence = false;
    await app.element('#refreshEngineButton').click();
    assert.equal(mutationCount(app), 1, 'Recovery must be read-only.');
    assert.equal(app.state.ready, true); assert.equal(app.state.busy, false); assert.equal(app.state.refreshing, false);
    assertMutationControls(app, false); assert.equal(app.element('#refreshEngineButton').disabled, false);
    if (action === 'crime') assert.match(app.element('#crimeResult').textContent, /fixture-event-1/, 'Explicit refresh preserves the result receipt.');
  });
}

test('an explicit refresh recovers failed bootstrap without granting player actions to an absent account', async () => {
  let offline = true;
  const app = consoleApp({ language: 'ar', request: async call => {
    if (offline && call.url === '/api/v1/engine') return { status: 503, data: { error: 'Unavailable' } };
    if (call.url === '/api/v1/player') return { status: 401, data: { error: 'Player session required' } };
  } });
  await assert.rejects(app.refresh(), /Unavailable/); assertMutationControls(app, true);
  offline = false; await app.element('#refreshEngineButton').click();
  assert.equal(app.state.ready, true); assert.equal(app.state.player, null); assert.equal(mutationCount(app), 0);
  assert.equal(app.moduleButton.disabled, false); assert.equal(app.themeButton.disabled, false);
  assert.equal(app.element('#attemptButton').disabled, true); assert.equal(app.element('#runCrimeButton').disabled, true);
  assert.deepEqual({ ...app.engineSummary() }, { language: 'ar', ready: true, busy: false, refreshing: false, moduleCount: 1, enabledModuleCount: 1, crimeCount: 1, hasPlayer: false, eventCount: 0, ledgerCount: 0 });
  assert.deepEqual({ ...app.engineDiagnostics() }, { language: 'ar', ready: true, busy: false, refreshing: false, moduleCount: 1, enabledModuleCount: 1, crimeCount: 1, hasPlayer: false, eventCount: 0, ledgerCount: 0, themeCount: 1, activeThemeId: null, hasArchitecture: true, databaseDriver: 'pgsql', phpVersion: '8.5.10' });
  assert.deepEqual(Array.from(app.permittedEngineSections()), ['start', 'extensions', 'appearance', 'testing', 'activity', 'architecture']);
  assert.equal(app.isPermittedEngineSection('extensions'), true);
  assert.equal(app.isPermittedEngineSection('unknown'), false);
});
