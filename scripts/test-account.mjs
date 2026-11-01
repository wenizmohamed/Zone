import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import test from 'node:test';
const source = readFileSync(new URL('../account.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../account.html', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
async function page({ identity = { claimed: false }, language = 'en', handler } = {}) {
  const nodes = new Map(), calls = [], listeners = {}, state = { identity };
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { id, hidden: false, checked: false, textContent: '', dataset: {}, events: {}, addEventListener(name, fn) { this.events[name] = fn; }, setAttribute(name, value) { this[name] = value; } });
    return nodes.get(id);
  };
  const submits = [node('claimSubmit'), node('loginSubmit'), node('recoverSubmit')], passwords = [node('password')], recoveryInputs = [node('codeInput')];
  const document = { documentElement: {}, getElementById: node, querySelectorAll(selector) { return selector === 'button[type=submit]' ? submits : selector === 'input[type=password]' ? passwords : selector === 'input[name=recoveryCode]' ? recoveryInputs : []; } };
  const window = { addEventListener: (name, fn) => { listeners[name] = fn; } };
  const fetch = async (path, options) => {
    calls.push({ path, options });
    if (path.endsWith('/account')) return { ok: true, json: async () => state.identity };
    if (handler) return handler(path, options, state);
    state.identity = { playerId: 'player-owned', username: 'Keeper', claimed: true };
    if (path.endsWith('/logout')) state.identity = { authenticated: false, claimed: false };
    return { ok: true, json: async () => ({ playerId: 'player-owned', ...(path.endsWith('/claim') || path.endsWith('/recover') ? { recoveryCode: 'c'.repeat(64) } : {}) }) };
  };
  runInContext(source, createContext({ window, document, fetch, location: new URL('http://zone.test/account?lang=' + language), URLSearchParams, Error, FormData: class {}, console }));
  await tick(); return { window, document, node, nodes, submits, calls, listeners };
}
const valid = { username: 'Keeper', password: 'long unique beta password', confirmation: 'long unique beta password' };
test('account screen reads status without creating another guest', async () => {
  const p = await page(); assert.equal(p.calls.length, 1); assert.equal(p.calls[0].path, '/api/v1/auth/account'); assert.equal(p.calls[0].options.method, 'GET'); assert.equal(p.node('loginPanel').open, true); assert.equal(p.node('claimPanel').hidden, true);
});
test('claim requires matching confirmation and does not send confirmation to the server', async () => {
  const p = await page({ identity: { playerId: 'player-owned', claimed: false } });
  await p.window.ZoneAccount.submit('claim', { ...valid, confirmation: 'mismatch' }); assert.equal(p.calls.length, 1);
  await p.window.ZoneAccount.submit('claim', valid); const sent = p.calls.find(c => c.path.endsWith('/claim')); assert.equal(JSON.parse(sent.options.body).confirmation, undefined); assert.equal(sent.options.credentials, 'same-origin');
});
test('recovery code shown once in transient text and gates leaving until acknowledged', async () => {
  const p = await page({ identity: { playerId: 'player-owned', claimed: false } }); await p.window.ZoneAccount.submit('claim', valid);
  assert.equal(p.node('recoveryCode').textContent, 'c'.repeat(64)); assert.equal(p.node('backupPanel').hidden, false); assert.equal(p.node('backToGame')['aria-disabled'], 'true'); assert.equal(p.node('logout').disabled, true);
  let blocked = false; p.node('backToGame').events.click({ preventDefault() { blocked = true; } }); assert.ok(blocked);
  p.node('backupSaved').checked = true; p.node('backupSaved').events.change(); assert.equal(p.node('backToGame')['aria-disabled'], 'false'); assert.equal(p.node('logout').disabled, false);
});
test('duplicate form submissions coalesce while a request is pending', async () => {
  let finish;
  const p = await page({ identity: { playerId: 'player-owned' }, handler: async () => new Promise(resolve => { finish = resolve; }) });
  const pending = p.window.ZoneAccount.submit('claim', valid); await tick(); await p.window.ZoneAccount.submit('claim', valid); assert.equal(p.calls.filter(c => c.path.endsWith('/claim')).length, 1);
  finish({ ok: true, json: async () => ({ playerId: 'player-owned', recoveryCode: 'c'.repeat(64) }) }); await pending;
});
test('signing into another account requires acknowledgement of the current guest', async () => {
  const p = await page({ identity: { playerId: 'guest-owned', claimed: false } }); await p.window.ZoneAccount.submit('login', valid); assert.equal(p.calls.length, 1);
  p.node('switchGuest').checked = true; await p.window.ZoneAccount.submit('login', valid); assert.ok(p.calls.some(c => c.path.endsWith('/login')));
});
test('Arabic interface and auth failures are localized without showing server internals', async () => {
  const p = await page({ language: 'ar', handler: async () => ({ ok: false, status: 429, json: async () => ({ error: 'private SQL secret' }) }) });
  assert.equal(p.document.documentElement.dir, 'rtl'); assert.equal(p.node('backToGame').href, '/?screen=home&lang=ar');
  await p.window.ZoneAccount.submit('login', valid); assert.match(p.node('message').textContent, /15/); assert.doesNotMatch(p.node('message').textContent, /SQL|secret/); assert.equal(p.node('message').dataset.error, 'true');
});
test('sign-out clears transient recovery material and never auto-creates a replacement player', async () => {
  const p = await page({ identity: { playerId: 'player-owned', claimed: true } }); await p.window.ZoneAccount.submit('logout', {});
  assert.equal(p.node('recoveryCode').textContent, ''); assert.equal(p.node('loginPanel').open, true); assert.equal(p.calls.some(c => c.path.endsWith('/session')), false);
});
test('status names render through textContent; account UI has touch targets and no secret storage', async () => {
  const p = await page({ identity: { playerId: 'player-owned', username: '<img onerror=attack()>', claimed: true } });
  assert.equal(p.node('identityName').textContent, '<img onerror=attack()>'); assert.doesNotMatch(source, /innerHTML|localStorage|sessionStorage/); assert.match(html, /min-height:44px/); assert.match(html, /role="status"/);
  assert.deepEqual({ ...p.window.ZoneAccount.diagnostics() }, { lang: 'en', ready: true, busy: false, backup: false, active: true, claimed: true, messageKey: 'claimed', messageError: false });
  assert.deepEqual(Array.from(p.window.ZoneAccount.supportedActions()), ['claim', 'login', 'recover', 'logout']);
  assert.equal(p.window.ZoneAccount.isSupportedAction('claim'), true);
  assert.equal(p.window.ZoneAccount.isSupportedAction('unknown'), false);
  assert.equal(p.window.ZoneAccount.isClaimed(), true);
  assert.equal(p.window.ZoneAccount.isGuest(), false);
  assert.deepEqual(Array.from(p.window.ZoneAccount.supportedLanguages()), ['en', 'ar']);
  assert.equal(p.window.ZoneAccount.isSupportedLanguage('ar'), true);
  assert.equal(p.window.ZoneAccount.isSupportedLanguage('fr'), false);
  assert.equal(p.window.ZoneAccount.currentLanguage(), 'en');
  assert.equal(p.window.ZoneAccount.accountStatusEndpointPath(), '/api/v1/auth/account');
  assert.equal(p.window.ZoneAccount.isReady(), true);
});
