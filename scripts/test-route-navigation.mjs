import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../assets/ui/route-navigation.js', import.meta.url), 'utf8');
function setup(screen = 'home') {
  const frames = new Map(), observers = [], scrolls = [], focused = [], listeners = new Map();
  const heading = { isConnected: true, focus(options) { focused.push(options); } };
  const main = { dataset: { zoneScreen: screen }, querySelector: () => heading, getBoundingClientRect: () => ({ top: -80 }) };
  const doc = { documentElement: {}, getElementById: () => main };
  let count = 0;
  const win = {
    scrollX: 0, scrollY: 500, location: { href: 'https://zone.test/?screen=' + screen },
    history: { state: { unrelated: 'preserved' }, replaceState(state) { this.state = state; } },
    requestAnimationFrame(fn) { frames.set(++count, fn); return count; },
    cancelAnimationFrame(id) { frames.delete(id); }, scrollTo(value) { scrolls.push(value); },
    addEventListener(type, fn) { listeners.set(type, fn); }, removeEventListener(type) { listeners.delete(type); },
    MutationObserver: class { constructor(fn) { this.run = fn; observers.push(this); } observe() {} disconnect() { this.disconnected = true; } },
  };
  const context = createContext({}); runInContext(source, context);
  const nav = context.ZoneRouteNavigation.create(win, doc);
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); };
  return { nav, win, doc, main, heading, frames, observers, scrolls, focused, flush, listeners };
}

test('the latest entry keeps its actual scroll for browser Back then Forward', () => {
  const s = setup('home'); s.nav.enter('home'); s.flush(); const homeEntry = s.win.history.state;
  s.win.history.state = {}; s.main.dataset.zoneScreen = 'items'; s.nav.enter('items'); s.flush();
  s.win.scrollY = 640; s.listeners.get('scroll')(); const itemsEntry = s.win.history.state;
  assert.equal(itemsEntry.zoneView.y, 640);
  s.win.history.state = homeEntry; s.main.dataset.zoneScreen = 'home'; s.nav.enter('home', homeEntry.zoneView); s.flush();
  s.win.history.state = itemsEntry; s.main.dataset.zoneScreen = 'items'; s.nav.enter('items', itemsEntry.zoneView); s.flush();
  assert.equal(s.scrolls.at(-1).top, 640);
});

test('a scroll event during history traversal cannot overwrite the destination entry', () => {
  const s = setup('items'); s.nav.enter('items'); s.flush();
  const destination = { zoneRouteKey: 'other-entry', zoneView: { screen: 'home', x: 0, y: 120 } };
  s.win.history.state = destination; s.win.scrollY = 999; s.listeners.get('scroll')();
  assert.equal(s.win.history.state, destination); assert.equal(destination.zoneView.y, 120);
  s.nav.cancel(); assert.equal(s.listeners.has('scroll'), false);
});

test('the actual language-route replacement retains the entry fence and newest Forward scroll', () => {
  const s = setup('items'); s.nav.enter('items'); s.flush();
  s.win.scrollY = 640; s.listeners.get('scroll')(); const key = s.win.history.state.zoneRouteKey;
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const method = html.match(/  syncRoute\(screen, replace = false\) \{[\s\S]*?\n  \}/)[0];
  s.win.history.pushState = function(state, _, url) { this.state = state; s.win.location.href = url; };
  const originalReplace = s.win.history.replaceState;
  s.win.history.replaceState = function(state, _, url) { originalReplace.call(this, state); s.win.location.href = url; };
  const context = createContext({ window: s.win, URL });
  const router = runInContext('({' + method.trim() + '})', context); router.state = { lang: 'ar' };
  router.syncRoute('items', true);
  assert.equal(s.win.history.state.zoneRouteKey, key); assert.equal(s.win.history.state.zoneView.y, 640);
  s.win.scrollY = 900; s.listeners.get('scroll')(); const translated = s.win.history.state;
  assert.equal(translated.zoneView.y, 900); assert.match(s.win.location.href, /lang=ar/);
  s.win.history.state = { zoneRouteKey: 'home', zoneView: { screen: 'home', x: 0, y: 120 } };
  s.main.dataset.zoneScreen = 'home'; s.nav.enter('home', s.win.history.state.zoneView); s.flush();
  s.win.history.state = translated; s.main.dataset.zoneScreen = 'items'; s.nav.enter('items', translated.zoneView); s.flush();
  assert.equal(s.scrolls.at(-1).top, 900);
});
test('new section waits for its real DOM and places focus at the visible heading', () => {
  const s = setup(); s.nav.enter('bank'); s.flush(); assert.equal(s.focused.length, 0);
  s.main.dataset.zoneScreen = 'bank'; s.observers[0].run(); s.flush();
  assert.equal(s.focused.length, 1); assert.equal(s.heading.tabIndex, -1);
  assert.deepEqual(JSON.parse(JSON.stringify(s.focused[0])), { preventScroll: true });
  assert.equal(s.scrolls[0].top, 408); assert.equal(s.scrolls[0].behavior, 'instant');
});
test('leaving a list preserves its scroll in this history entry without replacing unrelated state', () => {
  const s = setup('items'); s.nav.remember('items');
  assert.equal(s.win.history.state.unrelated, 'preserved');
  assert.deepEqual(JSON.parse(JSON.stringify(s.win.history.state.zoneView)), { screen: 'items', x: 0, y: 500 });
});
test('Back restores a matching saved viewport and still focuses the section', () => {
  const s = setup('items'); s.nav.enter('items', { screen: 'items', x: 3, y: 640 }); s.flush();
  assert.equal(s.scrolls[0].top, 640); assert.equal(s.scrolls[0].left, 3); assert.equal(s.focused.length, 1);
});
test('mismatched, nonfinite or negative history values cannot move an unrelated screen', () => {
  for (const restore of [{ screen: 'gym', x: 0, y: 640 }, { screen: 'bank', x: 0, y: Infinity }]) {
    const s = setup('bank'); s.nav.enter('bank', restore); s.flush(); assert.equal(s.scrolls[0].top, 408);
  }
  const s = setup('bank'); s.nav.enter('bank', { screen: 'bank', x: -3, y: -8 }); s.flush();
  assert.equal(s.scrolls[0].top, 0); assert.equal(s.scrolls[0].left, 0);
});
test('rapid navigation cancels old observer and frame instead of focusing hidden content', () => {
  const s = setup('bank'); s.nav.enter('bank'); const old = [...s.frames.values()][0];
  s.main.dataset.zoneScreen = 'gym'; s.nav.enter('gym'); old(); s.flush();
  assert.equal(s.focused.length, 1); assert.equal(s.observers[0].disconnected, true);
});
test('disposal and detached headings cannot retain asynchronous focus work', () => {
  const s = setup(); s.nav.enter('home'); s.nav.cancel(); s.flush(); assert.equal(s.focused.length, 0);
  const t = setup(); t.nav.enter('home'); t.heading.isConnected = false; t.flush(); assert.equal(t.focused.length, 0);
});
test('blocked history caching never prevents opening the actual screen', () => {
  const s = setup(); s.win.history.replaceState = () => { throw Error('blocked'); };
  assert.doesNotThrow(() => s.nav.remember('home')); s.nav.enter('home'); s.flush(); assert.equal(s.focused.length, 1);
});
test('shared client loads the same helper for English, Arabic and all valid route changes', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /route-navigation\.js\?v=105/);
  assert.match(html, /ZoneRouteNavigation\?\.remember\?\.\(this\.state\.screen\)/);
  assert.match(html, /ZoneRouteNavigation\?\.enter\?\.\(s, routeView\)/);
  assert.match(html, /event\?\.state\?\.zoneView/);
  assert.match(html, /ZoneRouteNavigation\?\.cancel\?\.\(\)/);
  const s = setup('home');
  s.nav.enter('home');
  s.flush();
  const diag = s.nav.diagnostics();
  assert.equal(diag.activeScreen, 'home');
  assert.equal(diag.hasObserver, false);
  assert.equal(s.nav.activeScreen(), 'home');
  assert.equal(s.nav.isActiveScreen('home'), true);
  assert.equal(s.nav.isActiveScreen('bank'), false);
  assert.ok(s.nav.activeKey().startsWith('zone-'));
  assert.equal(s.nav.isPending(), false);
});
