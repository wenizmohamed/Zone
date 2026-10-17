import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const source = readFileSync(new URL('../admin-assets.js', import.meta.url), 'utf8');
const adminSource = readFileSync(new URL('../admin.js', import.meta.url), 'utf8').replace(/\r/g, '');
const html = readFileSync(new URL('../admin.html', import.meta.url), 'utf8');
const escape = value => String(value ?? '').replace(/[&<>"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
const decode = value => String(value).replace(/&(?:amp|quot|lt|gt|#39);/g, entity => ({ '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&#39;': "'" })[entity]);
const clone = value => structuredClone(value);
const defaultLabelsStart = adminSource.indexOf('const catalogDefaultLabels = {'), defaultLabelsEnd = adminSource.indexOf('\n};', defaultLabelsStart) + 3;
assert.ok(defaultLabelsStart >= 0 && defaultLabelsEnd > defaultLabelsStart, 'Read the actual canonical Admin catalog labels.');
const defaultLabelsContext = createContext({});
runInContext(adminSource.slice(defaultLabelsStart, defaultLabelsEnd) + '\nglobalThis.labels = catalogDefaultLabels;', defaultLabelsContext);
const catalogDefaultLabels = clone(defaultLabelsContext.labels);
const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

// The fixture DOM renders the real controller's generated markup. It provides
// browser primitives only; no production selection/dirty/race logic is copied.
function fixtureDom() {
  const voidTags = new Set(['input', 'img', 'br', 'hr', 'meta', 'link']);
  const observers = new Set();
  class MutationObserver {
    constructor(callback) { this.callback = callback; this.targets = new Map(); this.records = []; this.queued = false; }
    observe(target, options) { this.targets.set(target, options); observers.add(this); }
    disconnect() { this.targets.clear(); this.records = []; observers.delete(this); }
  }
  function attributeChanged(target, name) {
    for (const observer of observers) {
      const options = observer.targets.get(target);
      if (!options?.attributes || options.attributeFilter && !options.attributeFilter.includes(name)) continue;
      observer.records.push({ type: 'attributes', target, attributeName: name });
      if (!observer.queued) { observer.queued = true; queueMicrotask(() => { observer.queued = false; const records = observer.records.splice(0); if (records.length) observer.callback(records, observer); }); }
    }
  }
  function matches(element, selector) {
    const tag = selector.match(/^[a-z][a-z0-9-]*/i)?.[0]; if (tag && element.tagName !== tag.toUpperCase()) return false;
    const id = selector.match(/#([\w-]+)/)?.[1]; if (id && element.id !== id) return false;
    for (const match of selector.matchAll(/\.([\w-]+)/g)) if (!element.className.split(/\s+/).includes(match[1])) return false;
    for (const match of selector.matchAll(/\[([^\]=]+)(?:=["']?([^\]"']+)["']?)?\]/g)) {
      if (!element.hasAttribute(match[1]) || match[2] !== undefined && element.getAttribute(match[1]) !== match[2]) return false;
    }
    return true;
  }
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.attributes = new Map(); this.children = []; this.parentElement = null;
      this.dataset = {}; this.listeners = new Map(); this._value = ''; this._text = ''; this.checked = false;
      this.files = []; this.contentWindow = { messages: [], postMessage(value, origin) { this.messages.push({ value: clone(value), origin }); } };
    }
    get id() { return this.getAttribute('id') ?? ''; } set id(value) { this.setAttribute('id', value); }
    get className() { return this.getAttribute('class') ?? ''; } set className(value) { this.setAttribute('class', value); }
    get src() { return this.getAttribute('src') ?? ''; } set src(value) { this.setAttribute('src', value); }
    get value() { return this._value; } set value(value) { this._value = String(value); }
    get disabled() { return this.hasAttribute('disabled'); } set disabled(value) { value ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }
    get hidden() { return this.hasAttribute('hidden'); } set hidden(value) { value ? this.setAttribute('hidden', '') : this.removeAttribute('hidden'); }
    setAttribute(name, value) { const changed = this.getAttribute(name) !== String(value); this.attributes.set(name, String(value)); if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value); if (name === 'value') this.value = decode(value); if (name === 'checked') this.checked = true; if (changed) attributeChanged(this, name); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    hasAttribute(name) { return this.attributes.has(name); }
    removeAttribute(name) { if (this.attributes.delete(name)) attributeChanged(this, name); }
    append(...elements) { for (const element of elements) { element.parentElement = this; this.children.push(element); } }
    appendChild(element) { this.append(element); return element; }
    insertBefore(element, sibling) { const index = this.children.indexOf(sibling); assert.ok(index >= 0); element.parentElement = this; this.children.splice(index, 0, element); return element; }
    after(element) { assert.ok(this.parentElement); const index = this.parentElement.children.indexOf(this); element.parentElement = this.parentElement; this.parentElement.children.splice(index + 1, 0, element); }
    replaceWith(element) { assert.ok(this.parentElement); const parent = this.parentElement, index = parent.children.indexOf(this); element.parentElement = parent; parent.children.splice(index, 1, element); this.parentElement = null; }
    remove() { if (!this.parentElement) return; const index = this.parentElement.children.indexOf(this); this.parentElement.children.splice(index, 1); this.parentElement = null; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this.children = []; this._text = String(value); }
    set innerHTML(markup) { this.children = []; this._text = ''; parse(this, String(markup)); }
    querySelectorAll(selector) { const result = []; const walk = parent => { for (const child of parent.children) { if (selector.split(',').some(part => matches(child, part.trim()))) result.push(child); walk(child); } }; walk(this); return result; }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    addEventListener(type, callback) { const list = this.listeners.get(type) ?? []; list.push(callback); this.listeners.set(type, list); }
    async emit(type, fields = {}) {
      const event = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...fields };
      for (let element = this; element; element = element.parentElement) {
        if (element['on' + type]) await element['on' + type](event);
        for (const callback of element.listeners.get(type) ?? []) await callback(event);
      }
      return event;
    }
    async click() { if (!this.disabled) return this.emit('click'); }
    async input(value) { this.value = value; return this.emit('input'); }
  }
  function parse(parent, markup) {
    const stack = [parent];
    for (const token of markup.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) ?? []) {
      if (token.startsWith('<!')) continue;
      if (token.startsWith('</')) { const closing = token.match(/^<\/([\w-]+)/)?.[1]?.toUpperCase(); while (stack.length > 1) if (stack.pop().tagName === closing) break; continue; }
      if (!token.startsWith('<')) { stack.at(-1)._text += decode(token); continue; }
      const tag = token.match(/^<([\w-]+)/)?.[1]; if (!tag) continue;
      const node = new Element(tag); const attributes = token.slice(tag.length + 1).replace(/\/?>$/, '');
      for (const match of attributes.matchAll(/([^\s=]+)(?:\s*=\s*"([^"]*)"|\s*=\s*'([^']*)'|\s*=\s*([^\s]+))?/g)) node.setAttribute(match[1], decode(match[2] ?? match[3] ?? match[4] ?? ''));
      stack.at(-1).append(node); if (!voidTags.has(tag.toLowerCase()) && !token.endsWith('/>')) stack.push(node);
    }
    for (const select of parent.querySelectorAll('select')) if (!select.value) select.value = select.querySelector('option')?.getAttribute('value') ?? '';
  }
  const document = { body: new Element('body'), MutationObserver, createElement: tag => new Element(tag), querySelector: selector => document.body.querySelector(selector), querySelectorAll: selector => document.body.querySelectorAll(selector) };
  document.body.innerHTML = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)[1];
  return document;
}

const idA = 'a'.repeat(64), idB = 'b'.repeat(64), idC = 'c'.repeat(64);
const asset = (id, scale, status = 'ready') => ({ id, name: 'House ' + id[0].toUpperCase(), status, kind: 'model', format: 'obj', metadata: { bounds: { size: [1, 2, 3] } }, transform: { scale, rotation: [0, 0, 0], floorOffset: 0, cameraTarget: [0, 0, 0] } });
const seedCatalog = () => ({ revision: 10, catalogs: { items: { knife: { type: 'weapon', name: { en: 'Knife', ar: 'سكين' } }, armor: { type: 'armor', name: { en: 'Armor', ar: 'درع' } } }, properties: [{ id: 'apt', name: { en: 'Apartment', ar: 'شقة' } }], market: [{ item: 'knife', qty: 4, seller: 'Dock shop' }] }, schema: {} });
function media({ apiHook, saveHook, assets = [asset(idA, 1), asset(idB, 2)], catalog = seedCatalog(), catalogCategory = 'items' } = {}) {
  const document = fixtureDom(), calls = [], listeners = new Map(), timers = new Map(); let timerId = 0;
  const state = { language: 'en', bootReady: true, view: 'overview', catalogBusy: false, controlBusy: false, dirty: false, draft: { manifest: { mediaBindings: [], worldPolicy: { enabled: true, tickSeconds: 60 } } }, gameplayCatalog: clone(catalog), catalogEdits: {}, catalogCategory, catalogEntry: 'knife' };
  const server = { assets: clone(assets), draft: clone(state.draft.manifest), catalog: clone(catalog) };
  const window = { addEventListener(type, callback) { const list = listeners.get(type) ?? []; list.push(callback); listeners.set(type, list); } };
  const emitWindow = async (type, fields = {}) => { const event = { type, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...fields }; for (const callback of listeners.get(type) ?? []) await callback(event); return event; };
  const q = selector => document.querySelector(selector);
  const api = async (path, options = {}) => {
    const call = { path, method: options.method ?? 'GET', body: options.body ? JSON.parse(options.body) : null }; calls.push(call);
    const controlled = apiHook?.(call, { state, server, calls, q }); if (controlled !== undefined) return clone(await controlled);
    if (path === '/api/v1/admin/assets') return { assets: clone(server.assets) };
    if (path === '/api/v1/admin/workers') return { workers: [{ id: 'studio', healthy: true }] };
    if (call.method === 'GET' && path.startsWith('/api/v1/admin/assets/')) return clone(server.assets.find(entry => entry.id === path.split('/').at(-1)) ?? assert.fail('Missing test asset'));
    if (call.method === 'PUT' && path.endsWith('/transform')) { const row = server.assets.find(entry => entry.id === path.split('/').at(-2)); row.transform = clone(call.body); return clone(row); }
    if (path === '/api/v1/admin/shop-catalog') { server.catalog.catalogs.market = clone(call.body.listings); server.catalog.revision++; return clone(server.catalog); }
    if (call.method === 'PUT' && path.startsWith('/api/v1/admin/gameplay-catalog/')) return { ...clone(server.catalog), revision: server.catalog.revision + 1 };
    if (path === '/api/v1/admin/assets/uploads') return { uploadId: 'd'.repeat(32) };
    if (path.endsWith('/chunks')) return { receivedBytes: 1 };
    if (path.endsWith('/complete')) { server.assets.push(asset(idC, 3)); return { id: idC }; }
    assert.fail('Unexpected API request: ' + call.method + ' ' + path);
  };
  const context = createContext({ console, document, window, MutationObserver: document.MutationObserver, location: { origin: 'https://zone.test' }, state, catalogDefaultLabels, Uint8Array, btoa: value => Buffer.from(value, 'binary').toString('base64'), esc: escape,
    api, adminCanMutate: () => state.bootReady && !state.controlBusy && !state.catalogBusy,
    markDirty() { state.dirty = true; }, renderGameplayCatalog() { calls.push({ render: 'catalog', selection: state.catalogEntry }); },
    notify(value, error) { calls.push({ notify: value, error }); }, unsavedContentEdits: () => ({ catalog: null, crime: false }), renderContent() {}, setView(view) { state.view = view; },
    async refreshDraftAfterMutation() { state.draft.manifest = clone(server.draft); return state.draft; },
    async saveDraft() { const sent = clone(state.draft.manifest); calls.push({ saveDraft: sent }); const result = saveHook ? await saveHook(sent, { state, server, q }) : true; if (result) { server.draft = clone(sent); state.draft.manifest = clone(sent); } return result; },
    setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; }, clearTimeout(id) { timers.delete(id); },
  });
  runInContext(source, context, { filename: 'admin-assets.js' });
  runInContext(actualFunction('requireSavedContent'), context, { filename: 'actual-admin-publish-guard.js' });
  return { q, document, window, state, server, calls, emitWindow, context,
    async load() { await q('#mediaRefresh').click(); },
    async select(id) { await q('[data-inspect-asset="' + id + '"]').click(); },
    async poll() { const first = timers.entries().next().value; assert.ok(first, 'The real controller scheduled a poll.'); timers.delete(first[0]); await first[1](); await flush(); },
  };
}

function uploadLifecycleMedia({ status = 'queued', apiHook, ...options } = {}) {
  const m = media({ ...options, apiHook(call, environment) {
    const controlled = apiHook?.(call, environment); if (controlled !== undefined) return controlled;
    if (call.path === '/api/v1/admin/assets/uploads') environment.server.uploadName = call.body.name;
    if (call.path.endsWith('/complete')) {
      const uploaded = { ...asset(idC, 3, status), name: environment.server.uploadName };
      environment.server.assets.push(uploaded); return clone(uploaded);
    }
  } });
  m.state.view = 'assets'; return m;
}
function chooseUpload(m) { m.q('#mediaDiskFile').files = [{ name: 'uploaded-house.obj', size: 1, slice: () => ({ arrayBuffer: async () => new Uint8Array([120]).buffer }) }]; }

const uploadCopy = {
  queued: { en: 'Upload stored and queued for inspection.', ar: 'تم تخزين الملف وإضافته إلى قائمة انتظار الفحص.' },
  processing: { en: 'Upload stored. Background inspection is running.', ar: 'تم تخزين الملف. الفحص الخلفي قيد العمل.' },
  ready: { en: 'Upload ready. Save a binding, preview it, then publish the draft to use it in the game.', ar: 'الملف جاهز. احفظ الربط وعاينه ثم انشر المسودة لاستخدامه في اللعبة.' },
  failed: { en: 'Upload inspection failed. Review the error and upload a corrected file.', ar: 'فشل فحص الملف. راجع الخطأ وارفع ملفاً مصححاً.' },
};

test('media inspector ignores a stale response for a different selected asset', async () => {
  const slowA = deferred(); const m = media({ apiHook: call => call.path === '/api/v1/admin/assets/' + idA ? slowA.promise : undefined });
  await m.load(); const first = m.q('[data-inspect-asset="' + idA + '"]').click(); await flush();
  await m.select(idB); slowA.resolve(asset(idA, 1)); await first;
  assert.equal(m.q('#mediaSelectedName').textContent, 'House B'); assert.equal(m.q('#mediaScale').value, '2');
});

test('manual fit edits participate in unload and publish unsaved protection', async () => {
  const m = media(); await m.load(); await m.select(idA); await m.q('#mediaScale').input('1.75');
  assert.equal(m.window.ZoneMedia.hasUnsaved(), true, 'A typed but unpersisted fit is an unsaved authoring change.');
  assert.equal((await m.emitWindow('beforeunload')).defaultPrevented, true);
  assert.equal(m.context.requireSavedContent(), false, 'The actual Admin publish guard rejects the unsaved fit.');
});

test('late iframe initialization cannot overwrite a newer typed fitted transform', async () => {
  const m = media(); await m.load(); await m.select(idA); await m.q('#mediaScale').input('1.75');
  await m.emitWindow('message', { origin: 'https://zone.test', source: m.q('#mediaInspector').contentWindow, data: { type: 'zone:asset-inspected', assetId: idA, transform: asset(idA, 1).transform, applied: false, revision: 1 } });
  assert.equal(m.q('#mediaScale').value, '1.75');
  assert.equal(m.q('#mediaInspector').contentWindow.messages.at(-1).value.transform.scale, 1.75, 'Initialization receives the current parent fit.');
});

test('same-asset out-of-order inspection reads preserve the newer rendered response', async () => {
  const old = deferred(); let reads = 0;
  const m = media({ apiHook: call => call.path === '/api/v1/admin/assets/' + idA ? (++reads === 1 ? old.promise : Promise.resolve(asset(idA, 2))) : undefined });
  await m.load(); const first = m.q('[data-inspect-asset="' + idA + '"]').click(); await flush();
  await m.select(idA); old.resolve(asset(idA, 1)); await first;
  assert.equal(m.q('#mediaScale').value, '2');
});

test('fit save completing after another input preserves the newer edit as unsaved', async () => {
  const put = deferred(); const m = media({ apiHook: call => call.path.endsWith('/transform') && call.method === 'PUT' ? put.promise : undefined });
  await m.load(); await m.select(idA); await m.q('#mediaScale').input('1.25');
  const saving = m.q('#mediaFitForm').emit('submit'); await flush(); await m.q('#mediaScale').input('1.9');
  put.resolve(asset(idA, 1.25)); await saving;
  assert.equal(m.q('#mediaScale').value, '1.9'); assert.equal(m.window.ZoneMedia.hasUnsaved(), true);
});

test('background library poll cannot enable selection buttons during an upload', async () => {
  const begin = deferred(); const m = media({ assets: [asset(idA, 1), asset(idB, 2), asset(idC, 3, 'processing')], apiHook: call => call.path === '/api/v1/admin/assets/uploads' ? begin.promise : undefined });
  m.state.view = 'assets'; await m.load(); await m.select(idA);
  m.q('#mediaDiskFile').files = [{ name: 'new.obj', size: 1, slice: () => ({ arrayBuffer: async () => new Uint8Array([120]).buffer }) }];
  const uploading = m.q('#mediaUploadForm').emit('submit'); await flush();
  try {
    assert.equal(m.q('[data-inspect-asset="' + idB + '"]').disabled, true);
    await m.poll(); assert.equal(m.q('[data-inspect-asset="' + idB + '"]').disabled, true, 'Polling must not defeat the actual in-flight operation guard.');
  } finally { begin.resolve({ uploadId: 'd'.repeat(32) }); await uploading; }
});

test('late upload completion does not hijack an explicitly newer asset selection', async () => {
  const complete = deferred(); const m = media({ assets: [asset(idA, 1), asset(idB, 2), asset(idC, 3, 'processing')], apiHook: call => call.path.endsWith('/complete') ? complete.promise : undefined });
  m.state.view = 'assets'; await m.load(); await m.select(idA);
  m.q('#mediaDiskFile').files = [{ name: 'new.obj', size: 1, slice: () => ({ arrayBuffer: async () => new Uint8Array([120]).buffer }) }];
  const uploading = m.q('#mediaUploadForm').emit('submit'); await flush(); await m.poll();
  assert.equal(m.q('[data-inspect-asset="' + idB + '"]').disabled, true);
  // Exercise a selection callback already dispatched by a Studio entry point.
  // Disabled buttons are checked separately; bypassing native click suppression
  // here makes the async completion prove it respects the newer selection.
  await m.q('[data-inspect-asset="' + idB + '"]').emit('click');
  complete.resolve({ id: idC }); await uploading;
  assert.equal(m.q('#mediaSelectedName').textContent, 'House B');
});

test('upload notices follow queued, inspecting and ready poll transitions in both locales without refresh reads', async () => {
  const m = uploadLifecycleMedia(); await m.load(); chooseUpload(m); await m.q('#mediaUploadForm').emit('submit');
  for (const status of ['queued', 'processing', 'ready']) {
    if (status !== 'queued') { m.server.assets.find(entry => entry.id === idC).status = status; await m.poll(); }
    const calls = m.calls.length;
    for (const language of ['en', 'ar', 'en']) {
      m.state.language = language; m.window.ZoneMedia.refresh();
      assert.equal(m.q('#mediaMessage').textContent, 'uploaded-house.obj: ' + uploadCopy[status][language]); assert.equal(m.q('#mediaMessage').className, '');
    }
    for (let i = 0; i < 10; i++) m.window.ZoneMedia.refresh(); assert.equal(m.calls.length, calls, 'Lifecycle translation uses cached upload status.');
  }
  assert.equal(m.q('#mediaInspector').dataset.asset, idC); assert.equal(m.q('#mediaSelectedName').textContent, 'uploaded-house.obj');
  assert.equal(m.calls.filter(call => call.path.endsWith('/complete')).length, 1);
});

test('an upload already ready in its completion receipt immediately prompts binding, preview and publication', async () => {
  const m = uploadLifecycleMedia({ status: 'ready' }); await m.load(); chooseUpload(m); await m.q('#mediaUploadForm').emit('submit');
  assert.equal(m.q('#mediaMessage').textContent, 'uploaded-house.obj: ' + uploadCopy.ready.en); assert.doesNotMatch(m.q('#mediaMessage').textContent, /inspection is running/i);
  assert.equal(m.q('#mediaInspector').dataset.asset, idC); assert.equal(m.window.ZoneMedia.hasUnsaved(), false);
});

test('a queued upload becoming ready updates its notice without stealing a newer asset selection or fit draft', async () => {
  const m = uploadLifecycleMedia(); await m.load(); chooseUpload(m); await m.q('#mediaUploadForm').emit('submit');
  await m.select(idA); await m.q('#mediaScale').input('1.45');
  m.server.assets.find(entry => entry.id === idC).status = 'ready'; await m.poll();
  assert.equal(m.q('#mediaMessage').textContent, 'uploaded-house.obj: ' + uploadCopy.ready.en);
  assert.equal(m.q('#mediaSelectedName').textContent, 'House A'); assert.equal(m.q('#mediaInspector').dataset.asset, idA); assert.equal(m.q('#mediaScale').value, '1.45'); assert.equal(m.window.ZoneMedia.hasUnsaved(), true);
});

test('failed inspection notices retain the actual error and translate without polling or implying readiness', async () => {
  const m = uploadLifecycleMedia(); await m.load(); chooseUpload(m); await m.q('#mediaUploadForm').emit('submit');
  const uploaded = m.server.assets.find(entry => entry.id === idC); uploaded.status = 'failed'; uploaded.error = 'Invalid mesh <details>';
  await m.poll(); const calls = m.calls.length;
  for (const language of ['en', 'ar', 'en']) {
    m.state.language = language; m.window.ZoneMedia.refresh(); assert.equal(m.q('#mediaMessage').textContent, 'uploaded-house.obj: ' + uploadCopy.failed[language] + ' Invalid mesh <details>');
    assert.equal(m.q('#mediaMessage').className, 'media-error'); assert.equal(m.q('#mediaBindingForm').hidden, true);
  }
  assert.equal(m.calls.length, calls); assert.equal(m.q('#mediaMessage').querySelector('details'), null);
});

for (const operation of ['fit', 'binding']) for (const outcome of ['saved', 'failed']) {
  test(`a newer ${operation} ${outcome} message wins over upload polling and locale refresh`, async () => {
    const m = uploadLifecycleMedia({ apiHook: call => outcome === 'failed' && call.method === 'PUT' && (operation === 'fit' ? call.path.endsWith('/transform') : call.path.startsWith('/api/v1/admin/gameplay-catalog/')) ? Promise.reject(new Error('Newer ' + operation + ' failed')) : undefined });
    await m.load(); chooseUpload(m); await m.q('#mediaUploadForm').emit('submit'); await m.select(idA);
    if (operation === 'fit') { await m.q('#mediaScale').input('1.3'); await m.q('#mediaFitForm').emit('submit'); }
    else { m.q('#mediaTargetType').value = 'property'; m.q('#mediaTargetId').value = 'apt'; await m.q('#mediaBindingForm').emit('submit'); }
    const text = m.q('#mediaMessage').textContent, className = m.q('#mediaMessage').className;
    assert.equal(className, outcome === 'failed' ? 'media-error' : ''); assert.match(text, outcome === 'failed' ? /Newer .* failed/ : /Draft saved/);
    m.server.assets.find(entry => entry.id === idC).status = 'ready'; await m.poll(); m.state.language = 'ar'; m.window.ZoneMedia.refresh();
    assert.equal(m.q('#mediaMessage').textContent, text); assert.equal(m.q('#mediaMessage').className, className); assert.equal(m.q('#mediaSelectedName').textContent, 'House A');
    if (operation === 'fit') assert.equal(m.q('#mediaScale').value, '1.3');
  });
}

test('late upload completion cannot resurrect its notice over a newer refresh error or dispatched selection', async () => {
  const complete = deferred(); let reads = 0;
  const m = uploadLifecycleMedia({ assets: [asset(idA, 1), asset(idB, 2, 'processing')], apiHook: call => call.path.endsWith('/complete') ? complete.promise : call.path === '/api/v1/admin/assets' && ++reads === 2 ? Promise.reject(new Error('Newer library refresh failed')) : undefined });
  await m.load(); await m.select(idA); chooseUpload(m); const uploading = m.q('#mediaUploadForm').emit('submit'); await flush();
  await m.poll(); assert.equal(m.q('#mediaMessage').textContent, 'Newer library refresh failed');
  await m.q('[data-inspect-asset="' + idB + '"]').emit('click');
  const uploaded = { ...asset(idC, 3, 'queued'), name: 'uploaded-house.obj' }; m.server.assets.push(uploaded); complete.resolve(uploaded); await uploading;
  m.server.assets.find(entry => entry.id === idC).status = 'ready'; await m.poll();
  assert.equal(m.q('#mediaMessage').textContent, 'Newer library refresh failed'); assert.equal(m.q('#mediaMessage').className, 'media-error'); assert.equal(m.q('#mediaSelectedName').textContent, 'House B');
});

test('late media binding response cannot replace a newer catalog revision', async () => {
  const bind = deferred(); const m = media({ apiHook: call => call.path.startsWith('/api/v1/admin/gameplay-catalog/') ? bind.promise : undefined });
  await m.load(); await m.select(idA); m.q('#mediaTargetType').value = 'property'; m.q('#mediaTargetId').value = 'apt';
  const saving = m.q('#mediaBindingForm').emit('submit'); await flush();
  m.state.gameplayCatalog = { ...seedCatalog(), revision: 12 }; m.state.gameplayCatalog.catalogs.items.knife.name.en = 'Newer edited knife';
  bind.resolve({ ...seedCatalog(), revision: 11 }); await saving;
  assert.equal(m.state.gameplayCatalog.revision, 12); assert.equal(m.state.gameplayCatalog.catalogs.items.knife.name.en, 'Newer edited knife');
});

test('shop edits made while a save is pending remain marked unsaved afterward', async () => {
  const put = deferred(); const m = media({ apiHook: call => call.path === '/api/v1/admin/shop-catalog' ? put.promise : undefined });
  const row = m.q('#shopListingRows').children[0]; await row.querySelector('.shop-qty').input('5');
  const saving = m.q('#shopCatalogForm').emit('submit'); await flush(); await row.querySelector('.shop-qty').input('9');
  const committed = seedCatalog(); committed.revision = 11; committed.catalogs.market[0].qty = 5; put.resolve(committed); await saving;
  m.window.ZoneMedia.refresh();
  assert.equal(row.querySelector('.shop-qty').value, '9'); assert.equal(m.window.ZoneMedia.hasUnsaved(), true);
});

test('world policy edits made during save survive completion and periodic refresh', async () => {
  const save = deferred(); const m = media({ saveHook: () => save.promise });
  await m.q('#worldPolicy-tickSeconds').input('90'); const saving = m.q('#worldPolicyForm').emit('submit'); await flush();
  await m.q('#worldPolicy-tickSeconds').input('120'); save.resolve(true); await saving; m.window.ZoneMedia.refresh();
  assert.equal(m.q('#worldPolicy-tickSeconds').value, '120'); assert.equal(m.window.ZoneMedia.hasUnsaved(), true);
});

test('foreign iframe messages cannot replace the current model transform', async () => {
  const m = media(); await m.load(); await m.select(idA);
  await m.emitWindow('message', { origin: 'https://attacker.test', source: m.q('#mediaInspector').contentWindow, data: { type: 'zone:asset-inspected', assetId: idA, transform: asset(idA, 8).transform } });
  await m.emitWindow('message', { origin: 'https://zone.test', source: {}, data: { type: 'zone:asset-inspected', assetId: idA, transform: asset(idA, 9).transform } });
  assert.equal(m.q('#mediaScale').value, '1');
});

test('real media inspection mounts a ready iframe and preserves bilingual controls, ranges and target IDs', async () => {
  const m = media(), initialFrame = m.q('#mediaInspector'); await m.load(); await m.select(idA);
  assert.notEqual(m.q('#mediaInspector'), initialFrame); assert.equal(m.q('#mediaInspector').dataset.asset, idA);
  assert.equal(m.q('#mediaInspector').src, '/dist/asset-inspector.html?asset=' + idA + '&lang=en');
  assert.equal(m.q('#mediaInspection').hidden, false); assert.equal(m.q('#mediaMessage').className, '');
  assert.equal(m.q('#mediaScale').getAttribute('min'), '0.000001'); assert.equal(m.q('#mediaScale').getAttribute('max'), '10000');
  for (const axis of ['X', 'Y', 'Z']) {
    assert.equal(m.q('#mediaRotation' + axis).getAttribute('min'), '-360'); assert.equal(m.q('#mediaRotation' + axis).getAttribute('max'), '360');
    assert.equal(m.q('#mediaTarget' + axis).getAttribute('min'), '-10000'); assert.equal(m.q('#mediaTarget' + axis).getAttribute('max'), '10000');
  }
  m.q('#mediaTargetType').value = 'character'; await m.q('#mediaTargetType').emit('change');
  assert.deepEqual(m.q('#mediaTargets').children.map(option => option.value), ['suit', 'street', 'tactical']);
  m.q('#mediaTargetType').value = 'map'; await m.q('#mediaTargetType').emit('change');
  assert.deepEqual(m.q('#mediaTargets').children.map(option => option.value), ['bank', 'gym', 'alley', 'hospital', 'jail', 'market', 'shop', 'home', 'hq', 'jobs', 'school', 'casino', 'missions', 'arena', 'news', 'hof', 'pier']);
  m.state.language = 'ar'; m.window.ZoneMedia.refresh(); assert.equal(m.q('[data-media-copy="title"]').textContent, 'اصنع عالمك بملفاتك');
});

test('changing inspector language preserves unsaved fit values and fences the previous iframe without repeat reloads', async () => {
  const m = media(); m.state.view = 'assets'; await m.load(); await m.select(idA);
  await m.q('#mediaScale').input('1.75'); await m.q('#mediaFloor').input('0.4'); await m.q('#mediaRotationX').input('35'); await m.q('#mediaTargetX').input('0.75');
  const shopRow = m.q('#shopListingRows').children[0]; await shopRow.querySelector('.shop-item').input('armor'); await shopRow.querySelector('.shop-qty').input('13'); await shopRow.querySelector('.shop-seller').input('متجر المسودة');
  const previous = m.q('#mediaInspector'), calls = m.calls.length;
  await m.emitWindow('message', { origin: 'https://zone.test', source: previous.contentWindow, data: { type: 'zone:asset-inspected', assetId: idA, transform: asset(idA, 1).transform, applied: false, revision: 9 } });
  m.state.language = 'ar'; m.window.ZoneMedia.refresh(); const arabic = m.q('#mediaInspector');
  assert.equal(arabic.src, '/dist/asset-inspector.html?asset=' + idA + '&lang=ar'); assert.notEqual(arabic, previous);
  assert.equal(arabic.getAttribute('title'), 'فاحص ضبط الأصل ثلاثي الأبعاد'); assert.equal(m.q('#mediaProgress').getAttribute('aria-label'), 'تقدم الرفع');
  assert.equal(m.q('#mediaRotationX').getAttribute('aria-label'), 'الدوران (درجات) X');
  assert.equal(m.q('#mediaTargetX').getAttribute('aria-label'), 'هدف الكاميرا X');
  assert.equal(m.q('#mediaScale').value, '1.75'); assert.equal(m.q('#mediaFloor').value, '0.4'); assert.equal(m.q('#mediaRotationX').value, '35'); assert.equal(m.q('#mediaTargetX').value, '0.75');
  assert.equal(m.q('#shopListingRows').children[0], shopRow); assert.deepEqual([shopRow.querySelector('.shop-item').value, shopRow.querySelector('.shop-qty').value, shopRow.querySelector('.shop-seller').value], ['armor', '13', 'متجر المسودة']);
  await m.emitWindow('message', { origin: 'https://zone.test', source: previous.contentWindow, data: { type: 'zone:asset-inspected', assetId: idA, transform: asset(idA, 8).transform, applied: true, revision: 10 } });
  await m.emitWindow('message', { origin: 'https://zone.test', source: arabic.contentWindow, data: { type: 'zone:asset-inspected', assetId: idA, transform: asset(idA, 1).transform, applied: false, revision: 1 } });
  assert.equal(m.q('#mediaScale').value, '1.75'); assert.equal(arabic.contentWindow.messages.at(-1).value.transform.scale, 1.75);
  for (let i = 0; i < 10; i++) m.window.ZoneMedia.refresh();
  assert.equal(m.q('#mediaInspector'), arabic); assert.equal(m.calls.length, calls, 'Changing locale must not reread or save the selected asset.');
  await m.select(idB); await m.q('#mediaScale').input('2.4'); await m.select(idA); assert.equal(m.q('#mediaScale').value, '1.75');
  m.state.language = 'en'; m.window.ZoneMedia.refresh(); assert.match(m.q('#mediaInspector').src, /&lang=en$/);
  assert.equal(m.q('#mediaInspector').getAttribute('title'), '3D asset fit inspector'); assert.equal(m.q('#mediaProgress').getAttribute('aria-label'), 'Upload progress');
  assert.equal(m.q('#shopListingRows').children[0], shopRow); assert.deepEqual([shopRow.querySelector('.shop-item').value, shopRow.querySelector('.shop-qty').value, shopRow.querySelector('.shop-seller').value], ['armor', '13', 'متجر المسودة']);
  assert.equal(m.window.ZoneMedia.hasUnsaved(), true);
});

test('a hidden inspector resumes in the current locale on Assets activation and after same-locale suspension', async () => {
  const m = media(); m.state.view = 'assets'; await m.load(); await m.select(idA); await m.q('#mediaScale').input('1.65');
  const view = m.q('.view[data-view="assets"]'); m.state.view = 'overview'; view.className = 'view'; m.q('#mediaInspector').removeAttribute('src'); await flush();
  m.state.language = 'ar'; m.window.ZoneMedia.refresh(); assert.equal(m.q('#mediaInspector').getAttribute('src'), null, 'A hidden preview stays unloaded.');
  m.state.view = 'assets'; view.className = 'view active'; await flush(); const resumed = m.q('#mediaInspector');
  assert.match(resumed.src, /&lang=ar$/); assert.equal(m.q('#mediaScale').value, '1.65');
  for (let i = 0; i < 10; i++) m.window.ZoneMedia.refresh(); assert.equal(m.q('#mediaInspector'), resumed);
  m.state.view = 'overview'; view.className = 'view'; resumed.removeAttribute('src'); await flush();
  m.state.view = 'assets'; view.className = 'view active'; await flush();
  assert.notEqual(m.q('#mediaInspector'), resumed); assert.match(m.q('#mediaInspector').src, /&lang=ar$/); assert.equal(m.window.ZoneMedia.hasUnsaved(), true);
});

for (const dirty of [false, true]) {
  test(`${dirty ? 'dirty' : 'clean'} shop rows translate labels and option captions in place while retaining selected items and values`, async () => {
    const m = media(), row = m.q('#shopListingRows').children[0], item = row.querySelector('.shop-item'), qty = row.querySelector('.shop-qty'), seller = row.querySelector('.shop-seller'), options = item.querySelectorAll('option');
    if (dirty) { await item.input('armor'); await qty.input('19'); await seller.input('اسم متجر غير محفوظ'); }
    const values = [item.value, qty.value, seller.value];
    m.state.language = 'ar'; m.window.ZoneMedia.refresh();
    assert.equal(m.q('#shopListingRows').children[0], row); assert.equal(row.querySelector('.shop-item'), item); assert.equal(row.querySelector('.shop-qty'), qty); assert.equal(row.querySelector('.shop-seller'), seller);
    assert.deepEqual(row.querySelectorAll('label').map(label => label.querySelector('span').textContent), ['عنصر', 'المخزون', 'اسم المتجر']);
    assert.deepEqual(item.querySelectorAll('option'), options); assert.deepEqual(options.map(option => option.textContent), ['سكين', 'درع']); assert.equal(row.querySelector('button').textContent, 'حذف الصف');
    assert.deepEqual([item.value, qty.value, seller.value], values); assert.equal(m.window.ZoneMedia.hasUnsaved(), dirty);
    m.state.language = 'en'; m.window.ZoneMedia.refresh();
    assert.deepEqual(row.querySelectorAll('label').map(label => label.querySelector('span').textContent), ['Item', 'Stock', 'Shop name']); assert.deepEqual(options.map(option => option.textContent), ['Knife', 'Armor']);
    assert.equal(row.querySelector('button').textContent, 'Remove'); assert.deepEqual([item.value, qty.value, seller.value], values); assert.equal(m.window.ZoneMedia.hasUnsaved(), dirty);
  });
}

test('unnamed preset shop items use the actual item labels in both locales even while the catalog editor shows properties', async () => {
  const catalog = seedCatalog(), ids = Object.keys(catalogDefaultLabels.items);
  assert.ok(ids.includes('pills') && ids.includes('ak'));
  catalog.catalogs.items = Object.fromEntries(ids.map(id => [id, { type: 'item' }])); catalog.catalogs.market = [{ item: 'pills', qty: 5, seller: 'Original shop' }];
  const m = media({ catalog, catalogCategory: 'properties' }), row = m.q('#shopListingRows').children[0], item = row.querySelector('.shop-item'), options = item.querySelectorAll('option');
  assert.deepEqual(options.map(option => option.textContent), ids.map(id => catalogDefaultLabels.items[id].en), 'Initial rows need canonical names before any language switch.');
  await item.input('ak'); await row.querySelector('.shop-qty').input('27'); await row.querySelector('.shop-seller').input('Preserved shop');
  for (const language of ['en', 'ar', 'en']) {
    m.state.language = language; m.window.ZoneMedia.refresh();
    assert.equal(m.state.catalogCategory, 'properties'); assert.equal(m.q('#shopListingRows').children[0], row); assert.deepEqual(item.querySelectorAll('option'), options);
    assert.deepEqual(options.map(option => option.value), ids); assert.deepEqual(options.map(option => option.textContent), ids.map(id => catalogDefaultLabels.items[id][language]));
    assert.deepEqual([item.value, row.querySelector('.shop-qty').value, row.querySelector('.shop-seller').value], ['ak', '27', 'Preserved shop']); assert.equal(m.window.ZoneMedia.hasUnsaved(), true);
    if (language === 'ar') { await m.q('#shopAddListing').click(); const added = m.q('#shopListingRows').children.at(-1); assert.deepEqual(added.querySelector('.shop-item').querySelectorAll('option').map(option => option.textContent), ids.map(id => catalogDefaultLabels.items[id].ar)); }
  }
});

test('authored shop names override canonical item labels and an empty locale still falls back to the item table', () => {
  const catalog = seedCatalog(); catalog.catalogs.items.ak = { type: 'weapon', name: { en: 'Authored rifle', ar: 'بندقية المؤلف' } };
  catalog.catalogs.items.pills = { type: 'item', name: { en: 'Authored medicine', ar: '' } };
  const m = media({ catalog, catalogCategory: 'properties' }), row = m.q('#shopListingRows').children[0], options = row.querySelector('.shop-item').querySelectorAll('option');
  for (const language of ['en', 'ar', 'en']) {
    m.state.language = language; m.window.ZoneMedia.refresh();
    assert.equal(options.find(option => option.value === 'ak').textContent, catalog.catalogs.items.ak.name[language]);
    assert.equal(options.find(option => option.value === 'pills').textContent, language === 'en' ? 'Authored medicine' : catalogDefaultLabels.items.pills.ar);
    assert.deepEqual([row.querySelector('.shop-item').value, row.querySelector('.shop-qty').value, row.querySelector('.shop-seller').value], ['knife', '4', 'Dock shop']); assert.equal(m.window.ZoneMedia.hasUnsaved(), false);
  }
});

test('an inspection pending during a language switch retains its request identity and the other asset fit draft', async () => {
  const pending = deferred(), m = media({ apiHook: call => call.path === '/api/v1/admin/assets/' + idB ? pending.promise : undefined });
  m.state.view = 'assets'; await m.load(); await m.select(idA); await m.q('#mediaScale').input('1.8');
  const selecting = m.select(idB); await flush(); m.state.language = 'ar'; m.window.ZoneMedia.refresh();
  pending.resolve(asset(idB, 2)); await selecting;
  assert.equal(m.q('#mediaSelectedName').textContent, 'House B'); assert.match(m.q('#mediaInspector').src, /asset=b{64}&lang=ar$/); assert.equal(m.q('#mediaScale').value, '2');
  assert.equal(m.calls.filter(call => call.path === '/api/v1/admin/assets/' + idB).length, 1);
  await m.select(idA); assert.equal(m.q('#mediaScale').value, '1.8'); assert.match(m.q('#mediaInspector').src, /&lang=ar$/); assert.equal(m.window.ZoneMedia.hasUnsaved(), true);
});

test('unsaved fitted transforms survive selection changes and each successful save acknowledges only its asset', async () => {
  const m = media(); await m.load(); await m.select(idA); await m.q('#mediaScale').input('1.75');
  await m.select(idB); await m.q('#mediaScale').input('2.5'); await m.q('#mediaFitForm').emit('submit');
  assert.equal(m.server.assets.find(entry => entry.id === idB).transform.scale, 2.5); assert.equal(m.window.ZoneMedia.hasUnsaved(), true);
  await m.select(idA); assert.equal(m.q('#mediaScale').value, '1.75'); await m.q('#mediaFitForm').emit('submit');
  assert.equal(m.server.assets.find(entry => entry.id === idA).transform.scale, 1.75); assert.equal(m.window.ZoneMedia.hasUnsaved(), false);
  assert.equal(m.context.requireSavedContent(), true); assert.equal((await m.emitWindow('beforeunload')).defaultPrevented, false);
});

test('an inspection started before newer fit input cannot replace that input on arrival', async () => {
  const pending = deferred(); let reads = 0;
  const m = media({ apiHook: call => call.path === '/api/v1/admin/assets/' + idA && ++reads === 2 ? pending.promise : undefined });
  await m.load(); await m.select(idA); const inspecting = m.select(idA); await flush(); await m.q('#mediaScale').input('1.8');
  pending.resolve(asset(idA, 1)); await inspecting;
  assert.equal(m.q('#mediaScale').value, '1.8'); assert.equal(m.window.ZoneMedia.hasUnsaved(), true);
});

test('a failed fit save retains the fitted values, dirty protection and error evidence', async () => {
  const m = media({ apiHook: call => call.path.endsWith('/transform') ? Promise.reject(new Error('Fit storage unavailable')) : undefined });
  await m.load(); await m.select(idA); await m.q('#mediaScale').input('1.4'); await m.q('#mediaFitForm').emit('submit');
  assert.equal(m.q('#mediaScale').value, '1.4'); assert.equal(m.window.ZoneMedia.hasUnsaved(), true);
  assert.equal(m.q('#mediaMessage').textContent, 'Fit storage unavailable'); assert.equal(m.q('#mediaMessage').className, 'media-error');
});

test('iframe Apply creates an unsaved fit and older inspector reports cannot replace it', async () => {
  const m = media(); await m.load(); await m.select(idA);
  const report = (scale, revision, applied) => m.emitWindow('message', { origin: 'https://zone.test', source: m.q('#mediaInspector').contentWindow, data: { type: 'zone:asset-inspected', assetId: idA, transform: asset(idA, scale).transform, revision, applied } });
  await report(1, 1, false); assert.equal(m.window.ZoneMedia.hasUnsaved(), false);
  await report(3, 3, true); assert.equal(m.q('#mediaScale').value, '3'); assert.equal(m.window.ZoneMedia.hasUnsaved(), true);
  await m.q('#mediaScale').input('4'); await report(2, 2, true); await report(1, 4, false);
  assert.equal(m.q('#mediaScale').value, '4'); await m.q('#mediaFitForm').emit('submit');
  assert.equal(m.server.assets[0].transform.scale, 4); assert.equal(m.window.ZoneMedia.hasUnsaved(), false);
});

test('an old iframe from an earlier visit to the same asset cannot apply its transform', async () => {
  const m = media(); await m.load(); await m.select(idA); const oldSource = m.q('#mediaInspector').contentWindow;
  await m.select(idB); await m.select(idA); assert.notEqual(m.q('#mediaInspector').contentWindow, oldSource);
  await m.emitWindow('message', { origin: 'https://zone.test', source: oldSource, data: { type: 'zone:asset-inspected', assetId: idA, transform: asset(idA, 8).transform, revision: 9, applied: true } });
  assert.equal(m.q('#mediaScale').value, '1'); assert.equal(m.window.ZoneMedia.hasUnsaved(), false);
});

test('out-of-order library reads and worker health cannot replace the latest displayed library', async () => {
  const first = deferred(); let reads = 0;
  const m = media({ apiHook: call => call.path === '/api/v1/admin/assets' ? (++reads === 1 ? first.promise : { assets: [asset(idB, 2)] }) : undefined });
  const old = m.load(); await flush(); await m.load(); first.resolve({ assets: [asset(idA, 1)] }); await old;
  assert.ok(m.q('[data-inspect-asset="' + idB + '"]')); assert.equal(m.q('[data-inspect-asset="' + idA + '"]'), null);
  const health = deferred(); let workerReads = 0;
  const workers = media({ apiHook: call => call.path === '/api/v1/admin/workers' ? (++workerReads === 1 ? health.promise : { workers: [{ id: 'latest-worker', healthy: true }] }) : undefined });
  const oldHealth = workers.load(); await flush(); await workers.load(); health.resolve({ workers: [{ id: 'old-worker', healthy: false }] }); await oldHealth;
  assert.match(workers.q('#mediaWorkerStatus').textContent, /latest-worker running/); assert.doesNotMatch(workers.q('#mediaWorkerStatus').textContent, /old-worker/);
  workers.state.language = 'ar'; workers.window.ZoneMedia.refresh(); assert.equal(workers.q('#mediaWorkerStatus').textContent, 'حالة العامل: latest-worker يعمل');
  workers.state.language = 'en'; workers.window.ZoneMedia.refresh(); assert.equal(workers.q('#mediaWorkerStatus').textContent, 'Worker health: latest-worker running');
});

test('worker health translates its latest running and unavailable-worker states EN to AR to EN without rereading', async () => {
  const m = media({ apiHook: call => call.path === '/api/v1/admin/workers' ? { workers: [{ id: 'studio', healthy: true }, { id: 'world', healthy: false }] } : undefined });
  await m.load(); const calls = m.calls.length;
  assert.equal(m.q('#mediaWorkerStatus').textContent, 'Worker health: studio running · world not responding');
  m.state.language = 'ar'; m.window.ZoneMedia.refresh(); assert.equal(m.q('#mediaWorkerStatus').textContent, 'حالة العامل: studio يعمل · world لا يستجيب');
  m.state.language = 'en'; m.window.ZoneMedia.refresh(); assert.equal(m.q('#mediaWorkerStatus').textContent, 'Worker health: studio running · world not responding');
  for (let i = 0; i < 10; i++) m.window.ZoneMedia.refresh();
  assert.equal(m.calls.length, calls); assert.equal(m.calls.filter(call => call.path === '/api/v1/admin/workers').length, 1); assert.equal(m.window.ZoneMedia.hasUnsaved(), false);
});

test('failed worker health reads retain a translated unavailable status until an explicit successful refresh', async () => {
  let reads = 0;
  const m = media({ apiHook: call => call.path === '/api/v1/admin/workers' ? (++reads === 1 ? Promise.reject(new Error('Worker health unavailable')) : { workers: [{ id: 'recovered', healthy: true }] }) : undefined });
  await m.load(); const calls = m.calls.length; assert.equal(m.q('#mediaWorkerStatus').textContent, 'Worker health: Unavailable');
  m.state.language = 'ar'; m.window.ZoneMedia.refresh(); assert.equal(m.q('#mediaWorkerStatus').textContent, 'حالة العامل: غير متاحة');
  m.state.language = 'en'; m.window.ZoneMedia.refresh(); assert.equal(m.q('#mediaWorkerStatus').textContent, 'Worker health: Unavailable');
  for (let i = 0; i < 10; i++) m.window.ZoneMedia.refresh(); assert.equal(m.calls.length, calls); assert.equal(reads, 1);
  await m.load(); assert.equal(reads, 2); assert.equal(m.q('#mediaWorkerStatus').textContent, 'Worker health: recovered running');
  m.state.language = 'ar'; m.window.ZoneMedia.refresh(); assert.equal(m.q('#mediaWorkerStatus').textContent, 'حالة العامل: recovered يعمل'); assert.equal(reads, 2);
});

test('a rejected old library read cannot replace the status of a successful newer refresh', async () => {
  const first = deferred(); let reads = 0;
  const m = media({ apiHook: call => call.path === '/api/v1/admin/assets' && ++reads === 1 ? first.promise : undefined });
  const old = m.load(); await flush(); await m.load(); first.reject(new Error('Obsolete library request failed')); await old;
  assert.equal(m.q('#mediaMessage').className, ''); assert.doesNotMatch(m.q('#mediaMessage').textContent, /Obsolete/);
  assert.ok(m.q('[data-inspect-asset="' + idA + '"]'));
});

test('upload completion selects its new asset only when no newer input or selection exists', async () => {
  const file = { name: 'new.obj', size: 1, slice: () => ({ arrayBuffer: async () => new Uint8Array([120]).buffer }) };
  const unchanged = media(); await unchanged.load(); await unchanged.select(idA); unchanged.q('#mediaDiskFile').files = [file];
  await unchanged.q('#mediaUploadForm').emit('submit'); assert.equal(unchanged.q('#mediaSelectedName').textContent, 'House C'); assert.equal(unchanged.window.ZoneMedia.hasUnsaved(), false);
  const complete = deferred(), edited = media({ apiHook: call => call.path.endsWith('/complete') ? complete.promise : undefined });
  await edited.load(); await edited.select(idA); edited.q('#mediaDiskFile').files = [file];
  const uploading = edited.q('#mediaUploadForm').emit('submit'); await flush(); await edited.q('#mediaScale').input('1.6'); complete.resolve({ id: idC }); await uploading;
  assert.equal(edited.q('#mediaSelectedName').textContent, 'House A'); assert.equal(edited.q('#mediaScale').value, '1.6'); assert.equal(edited.window.ZoneMedia.hasUnsaved(), true);
});

test('a newer selection during the post-upload library refresh still wins', async () => {
  const library = deferred(); let reads = 0;
  const m = media({ apiHook: call => call.path === '/api/v1/admin/assets' && ++reads === 2 ? library.promise : undefined });
  await m.load(); await m.select(idA); m.q('#mediaDiskFile').files = [{ name: 'new.obj', size: 1, slice: () => ({ arrayBuffer: async () => new Uint8Array([120]).buffer }) }];
  const uploading = m.q('#mediaUploadForm').emit('submit'); await flush(); await m.q('[data-inspect-asset="' + idB + '"]').emit('click');
  library.resolve({ assets: clone(m.server.assets) }); await uploading; assert.equal(m.q('#mediaSelectedName').textContent, 'House B');
});

test('a late shop reply cannot roll back the shared catalog or re-render older rows over the newer revision', async () => {
  const pending = deferred(), m = media({ apiHook: call => call.path === '/api/v1/admin/shop-catalog' ? pending.promise : undefined });
  await m.q('#shopListingRows').children[0].querySelector('.shop-qty').input('5'); const saving = m.q('#shopCatalogForm').emit('submit'); await flush();
  const latest = seedCatalog(); latest.revision = 12; latest.catalogs.market[0].qty = 8; latest.catalogs.items.knife.name.en = 'Latest knife'; m.state.gameplayCatalog = latest;
  const older = seedCatalog(); older.revision = 11; older.catalogs.market[0].qty = 5; pending.resolve(older); await saving;
  assert.equal(m.state.gameplayCatalog.revision, 12); assert.equal(m.state.gameplayCatalog.catalogs.items.knife.name.en, 'Latest knife');
  assert.equal(m.q('#shopListingRows').children[0].querySelector('.shop-qty').value, '8'); assert.equal(m.window.ZoneMedia.hasUnsaved(), false);
});

test('pending shop removal stays unsaved and an acknowledged empty shop is not repopulated', async () => {
  const pending = deferred(), m = media({ apiHook: call => call.path === '/api/v1/admin/shop-catalog' ? pending.promise : undefined });
  const row = m.q('#shopListingRows').children[0]; await row.querySelector('.shop-qty').input('5'); const saving = m.q('#shopCatalogForm').emit('submit'); await flush();
  await row.querySelector('button').click(); const committed = seedCatalog(); committed.revision = 11; pending.resolve(committed); await saving; m.window.ZoneMedia.refresh();
  assert.equal(m.q('#shopListingRows').children.length, 0); assert.equal(m.window.ZoneMedia.hasUnsaved(), true);
  const empty = media(); await empty.q('#shopListingRows').children[0].querySelector('button').click(); await empty.q('#shopCatalogForm').emit('submit'); empty.window.ZoneMedia.refresh();
  assert.equal(empty.q('#shopListingRows').children.length, 0); assert.equal(empty.server.catalog.catalogs.market.length, 0); assert.equal(empty.window.ZoneMedia.hasUnsaved(), false);
});

test('a failed shop save keeps its newer rows and unsaved protection', async () => {
  const m = media({ apiHook: call => call.path === '/api/v1/admin/shop-catalog' ? Promise.reject(new Error('Shop storage unavailable')) : undefined });
  const row = m.q('#shopListingRows').children[0]; await row.querySelector('.shop-qty').input('7'); await m.q('#shopCatalogForm').emit('submit'); m.window.ZoneMedia.refresh();
  assert.equal(row.querySelector('.shop-qty').value, '7'); assert.equal(m.window.ZoneMedia.hasUnsaved(), true); assert.equal(m.state.catalogBusy, false);
  assert.equal(m.q('#shopDraftStatus').textContent, 'Shop storage unavailable');
});

test('an unchanged shop save still protects its in-flight write against unloading and publishing', async () => {
  const pending = deferred(), m = media({ apiHook: call => call.path === '/api/v1/admin/shop-catalog' ? pending.promise : undefined });
  const saving = m.q('#shopCatalogForm').emit('submit'); await flush();
  assert.equal(m.window.ZoneMedia.hasUnsaved(), true); assert.equal((await m.emitWindow('beforeunload')).defaultPrevented, true); assert.equal(m.context.requireSavedContent(), false);
  pending.resolve({ ...seedCatalog(), revision: 11 }); await saving;
  assert.equal(m.window.ZoneMedia.hasUnsaved(), false);
});

test('world save stays protected while pending, prevents duplicate saves and acknowledges only its submitted policy', async () => {
  const pending = deferred(), m = media({ saveHook: () => pending.promise });
  await m.q('#worldPolicy-tickSeconds').input('90'); const saving = m.q('#worldPolicyForm').emit('submit'); await flush();
  assert.equal(m.window.ZoneMedia.hasUnsaved(), true); await m.q('#worldPolicyForm').emit('submit'); assert.equal(m.calls.filter(call => call.saveDraft).length, 1);
  pending.resolve(true); await saving; m.window.ZoneMedia.refresh(); assert.equal(m.q('#worldPolicy-tickSeconds').value, '90'); assert.equal(m.window.ZoneMedia.hasUnsaved(), false);
  assert.equal(m.calls.find(call => call.saveDraft).saveDraft.worldPolicy.tickSeconds, 90);
});

test('failed or rejected world saves leave the policy available for retry', async () => {
  for (const saveHook of [async () => false, async () => { throw new Error('Draft storage unavailable'); }]) {
    const m = media({ saveHook }); await m.q('#worldPolicy-tickSeconds').input('95'); await m.q('#worldPolicyForm').emit('submit'); m.window.ZoneMedia.refresh();
    assert.equal(m.q('#worldPolicy-tickSeconds').value, '95'); assert.equal(m.window.ZoneMedia.hasUnsaved(), true); assert.equal((await m.emitWindow('beforeunload')).defaultPrevented, true);
  }
});

test('catalog media binding shares the mutation guard with other catalog forms', async () => {
  const pending = deferred(), m = media({ apiHook: call => call.path.startsWith('/api/v1/admin/gameplay-catalog/') ? pending.promise : undefined });
  await m.load(); await m.select(idA); m.q('#mediaTargetType').value = 'property'; m.q('#mediaTargetId').value = 'apt';
  const saving = m.q('#mediaBindingForm').emit('submit'); await flush(); assert.equal(m.state.catalogBusy, true);
  await m.q('#shopCatalogForm').emit('submit'); assert.equal(m.calls.some(call => call.path === '/api/v1/admin/shop-catalog'), false);
  pending.resolve({ ...seedCatalog(), revision: 11 }); await saving; assert.equal(m.state.catalogBusy, false);
  const call = m.calls.find(call => call.path?.startsWith('/api/v1/admin/gameplay-catalog/')); assert.equal(call.body.expectedRevision, 10); assert.equal(call.body.changes.mediaAsset, idA);
});

function actualFunction(name) {
  const expression = new RegExp('(?:async )?function ' + name + '\\('); const start = adminSource.search(expression), end = adminSource.indexOf('\n}', start) + 2;
  assert.ok(start >= 0 && end > start, 'Actual Admin function exists: ' + name); return adminSource.slice(start, end);
}
function crimeEditor({ saveHook } = {}) {
  const document = fixtureDom(), q = selector => document.querySelector(selector), calls = [];
  const crime = { id: 'searchforcash', name_en: 'Search for cash', name_ar: 'البحث عن نقود', nerve_cost: 2, successRate: 90, success_basis_points: 9000, cash_min: 10, cash_max: 20, xp_reward: 6, level_required: 1, enabled: true,
    required_item: 'knife', required_quantity: 2, consume_tool: false, mastery_per_success: 7, chain_window_seconds: 300, chain_bonus_basis_points: 100, critical_failure_basis_points: 500, jail_seconds: 300, hospital_seconds: 0 };
  const other = { ...clone(crime), id: 'shoplifting', name_en: 'Shoplifting', required_item: 'armor', required_quantity: 1, mastery_per_success: 4, hospital_seconds: 180 };
  const state = { language: 'en', crimes: [clone(crime), clone(other)], selectedCrime: crime.id, crimeEditorSelection: null, crimeEditorBaseline: null, catalogEdits: {}, catalogNewIds: {}, controlBusy: false, bootReady: true };
  const context = createContext({ console, document, state, $: q, $$: selector => document.querySelectorAll(selector), contentDomains: [], window: {}, esc: escape, localized: value => value?.en ?? '', t: value => value,
    adminCanMutate: () => state.bootReady && !state.controlBusy, beginControlAction() { state.controlBusy = true; return true; }, endControlAction() { state.controlBusy = false; },
    slugify: value => String(value).trim().toLowerCase(), notify() {}, renderGameplayCatalog() {}, markDirty() {}, refreshViewPreview() {}, refreshDraftAfterMutation: async () => ({}),
    renderAll() { context.renderContent(); },
    async api(path, options) { const call = { path, body: options?.body ? JSON.parse(options.body) : null }; calls.push(call); if (path.includes('/admin/crimes/')) return saveHook ? await saveHook(call) : { crime: { ...clone(crime), ...call.body, successRate: call.body.success_basis_points / 100 } }; return { events: [], entries: [] }; },
  });
  const fields = adminSource.match(/^const crimeRuleFields = .*;$/m)?.[0]; assert.ok(fields);
  runInContext([fields, ...['crimeRuleValues', 'crimeEditorValues', 'unsavedContentEdits', 'renderContent', 'renderCrimeEditorStatus', 'saveCrime'].map(actualFunction)].join('\n'), context, { filename: 'actual-admin-crime-functions.js' });
  context.renderContent(true);
  return { q, state, context, calls, crime, other, save: () => context.saveCrime({ preventDefault() {} }) };
}

test('actual crime save serializes all authored rule fields and an empty tool as null', async () => {
  const c = crimeEditor(); c.q('#crimeTool').value = ''; c.q('#crimeMastery').value = '9'; c.q('#crimeHospital').value = '75';
  await c.save(); const payload = c.calls.find(call => call.path.includes('/admin/crimes/')).body;
  assert.equal(payload.required_item, null); assert.equal(payload.mastery_per_success, 9); assert.equal(payload.hospital_seconds, 75);
  assert.equal(payload.required_quantity, 2); assert.equal(payload.consume_tool, false); assert.equal(payload.chain_window_seconds, 300); assert.equal(payload.chain_bonus_basis_points, 100); assert.equal(payload.critical_failure_basis_points, 500); assert.equal(payload.jail_seconds, 300);
});

test('actual crime save preserves newer in-flight rule edits and keeps them dirty', async () => {
  const pending = deferred(); const c = crimeEditor({ saveHook: () => pending.promise });
  const saving = c.save(); await flush(); c.q('#crimeHospital').value = '65'; c.q('#crimeToolQty').value = '3';
  pending.resolve({ crime: clone(c.crime) }); await saving;
  assert.equal(c.q('#crimeHospital').value, '65'); assert.equal(c.q('#crimeToolQty').value, '3'); assert.equal(c.context.unsavedContentEdits().crime, true);
});

test('actual late crime save does not hijack another crime or reset its tool fields', async () => {
  const pending = deferred(); const c = crimeEditor({ saveHook: () => pending.promise });
  const saving = c.save(); await flush(); c.state.selectedCrime = c.other.id; c.context.renderContent(); c.q('#crimeMastery').value = '12';
  pending.resolve({ crime: clone(c.crime) }); await saving;
  assert.equal(c.state.selectedCrime, c.other.id); assert.equal(c.q('#crimeTool').value, 'armor'); assert.equal(c.q('#crimeMastery').value, '12');
});
