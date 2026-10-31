import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../assets/ui/published-theme115.js', import.meta.url), 'utf8');
test('the actual document keeps the published theme nonblocking at its original cascade position', () => {
  const head = readFileSync(new URL('../index.html', import.meta.url), 'utf8').split('</head>')[0];
  const link = head.match(/<link id="zone-published-theme"[^>]+>/)?.[0];
  assert.ok(link);
  assert.match(link, /href="\/engine\/theme\.css"/);
  assert.match(link, /media="print"/);
  assert.match(head, /<script async src="\.\/assets\/ui\/published-theme115\.js\?v=115"><\/script>/);
  assert.ok(head.indexOf(link) < head.indexOf('./assets/zone-design.css'), 'owner stylesheet retains its existing cascade order');
});
function browser({ cachedSheet = null, onSheetRead = null } = {}) {
  const listeners = new Map(), timers = new Map(), dataset = {}, calls = [];
  let serial = 0;
  const link = {
    id: 'zone-published-theme', href: '/engine/theme.css', media: 'print', sheet: cachedSheet,
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
  };
  if (onSheetRead) Object.defineProperty(link, 'sheet', { get: () => onSheetRead({ link, listeners }) });
  const document = { documentElement: { dataset }, getElementById(id) { return id === link.id ? link : null; } };
  const window = { document };
  const context = createContext({ window, document,
    setTimeout(fn, delay) { const id = ++serial; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch() { calls.push('fetch'); throw Error('Theme loader must not create a second network request.'); },
  });
  const execute = () => runInContext(source, context, { filename: 'published-theme115.js' });
  const emit = name => { for (const fn of [...(listeners.get(name) ?? [])]) fn({ type: name }); };
  const expire = () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(timer => timer.fn()); };
  const listenerCount = () => [...listeners.values()].reduce((sum, entries) => sum + entries.size, 0);
  execute();
  return { window, document, link, dataset, timers, calls, execute, emit, expire, listenerCount, listeners };
}

test('pending CSS stays nonblocking and applies only after the actual load event', () => {
  const b = browser();
  assert.equal(b.link.media, 'print', 'pending published CSS cannot block rendering');
  b.emit('load');
  assert.equal(b.link.media, 'all', 'the real published stylesheet still applies');
  assert.equal(b.dataset.zonePublishedTheme, 'ready');
  assert.equal(b.timers.size, 0);
  assert.equal(b.listenerCount(), 0);
  assert.deepEqual(b.calls, []);
});

test('an already-cached stylesheet applies even when its load event preceded the async helper', () => {
  const b = browser({ cachedSheet: {} });
  assert.equal(b.link.media, 'all');
  assert.equal(b.dataset.zonePublishedTheme, 'ready');
  assert.equal(b.timers.size, 0);
  assert.equal(b.listenerCount(), 0);
});

test('a finite unavailable diagnostic never blocks the page or discards a valid late stylesheet', () => {
  const b = browser();
  assert.equal(b.dataset.zonePublishedTheme, 'pending');
  assert.equal(b.timers.size, 1);
  const timer = [...b.timers.values()][0];
  assert.ok(timer.delay > 0 && timer.delay <= 10000, 'the diagnostic has a finite deadline');
  b.expire();
  assert.equal(b.dataset.zonePublishedTheme, 'unavailable');
  assert.equal(b.dataset.zonePublishedThemeReason, 'timeout');
  assert.equal(b.link.media, 'print');
  assert.equal(b.link.href, '/engine/theme.css', 'never removes or substitutes owner CSS');
  assert.equal(b.timers.size, 0);
  b.link.sheet = {};
  b.emit('load');
  assert.equal(b.link.media, 'all');
  assert.equal(b.dataset.zonePublishedTheme, 'ready');
  assert.equal(b.dataset.zonePublishedThemeReason, undefined);
  assert.equal(b.listenerCount(), 0);
});

test('a stylesheet error reports unavailable and ends its deadline without changing the link or built-in palette', () => {
  const b = browser();
  b.emit('error');
  assert.equal(b.dataset.zonePublishedTheme, 'unavailable');
  assert.equal(b.dataset.zonePublishedThemeReason, 'load-error');
  assert.equal(b.timers.size, 0);
  assert.equal(b.link.media, 'print');
  assert.equal(b.link.href, '/engine/theme.css');
  assert.deepEqual(b.calls, []);
});

test('repeated execution and cleanup are idempotent and cancelled callbacks cannot change the palette or diagnostic', () => {
  const b = browser();
  b.execute();
  assert.equal(b.timers.size, 1, 'duplicate inclusion cannot restart or duplicate the deadline');
  assert.equal(b.listenerCount(), 2);
  const queued = [...b.timers.values()].map(timer => timer.fn).concat([...b.listeners.values()].flatMap(set => [...set]));
  assert.equal(typeof b.window.ZonePublishedTheme115?.dispose, 'function');
  b.window.ZonePublishedTheme115.dispose();
  b.window.ZonePublishedTheme115.dispose();
  assert.equal(b.timers.size, 0);
  assert.equal(b.listenerCount(), 0);
  const status = b.dataset.zonePublishedTheme;
  for (const callback of queued) callback();
  assert.equal(b.link.media, 'print');
  assert.equal(b.dataset.zonePublishedTheme, status);
});

test('load listeners are attached before the cached-sheet check and a simultaneous completion cannot leave timers behind', () => {
  let reads = 0;
  const b = browser({ onSheetRead({ listeners }) {
    reads++;
    assert.equal(listeners.get('load')?.size, 1);
    assert.equal(listeners.get('error')?.size, 1);
    for (const onLoad of [...listeners.get('load')]) onLoad();
    return {};
  } });
  assert.equal(reads, 1);
  assert.equal(b.link.media, 'all');
  assert.equal(b.dataset.zonePublishedTheme, 'ready');
  assert.equal(b.timers.size, 0);
  assert.equal(b.listenerCount(), 0);
});

test('a queued timeout or error cannot downgrade an already-loaded stylesheet', () => {
  const b = browser();
  const lateTimer = [...b.timers.values()][0].fn;
  const lateError = [...b.listeners.get('error')][0];
  b.emit('load');
  lateTimer(); lateError();
  assert.equal(b.link.media, 'all');
  assert.equal(b.dataset.zonePublishedTheme, 'ready');
  assert.equal(b.dataset.zonePublishedThemeReason, undefined);
  assert.equal(b.timers.size, 0);
  assert.equal(b.listenerCount(), 0);
});

test('a later successful stylesheet load can recover after an earlier load error without replacement or another fetch', () => {
  const b = browser();
  b.emit('error');
  b.link.sheet = {};
  b.emit('load');
  assert.equal(b.dataset.zonePublishedTheme, 'ready');
  assert.equal(b.dataset.zonePublishedThemeReason, undefined);
  assert.equal(b.link.media, 'all');
  assert.equal(b.link.href, '/engine/theme.css');
  assert.equal(b.timers.size, 0);
  assert.equal(b.listenerCount(), 0);
  assert.deepEqual(b.calls, []);
  const diag = b.window.ZonePublishedTheme115.diagnostics();
  assert.equal(diag.ready, true);
  assert.equal(diag.disposed, false);
  assert.equal(diag.status, 'ready');
});
