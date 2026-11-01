import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const source = readFileSync(new URL('../admin-studio.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../admin.html', import.meta.url), 'utf8');
const adminSource = readFileSync(new URL('../admin.js', import.meta.url), 'utf8').replace(/\r/g, '');
const translationStart = adminSource.indexOf('const translations = {');
const translationEnd = adminSource.indexOf('\n};', translationStart) + 3;
assert.ok(translationStart >= 0 && translationEnd > translationStart, 'Read the actual original Admin translation table.');
const translationContext = createContext({});
runInContext(adminSource.slice(translationStart, translationEnd) + '\nglobalThis.originalTranslations = translations;', translationContext);
const originalTranslations = structuredClone(translationContext.originalTranslations);
function originalDefinition(name) {
  const start = adminSource.indexOf('function ' + name + '('), end = adminSource.indexOf('\n}', start) + 2;
  assert.ok(start >= 0 && end > start, 'Read original ' + name); return adminSource.slice(start, end);
}
runInContext(originalDefinition('authoringManifestText') + '\nglobalThis.serializeAuthoring = authoringManifestText;', translationContext);
const serializeAuthoring = translationContext.serializeAuthoring;
const decode = text => String(text).replace(/&(?:amp|quot|lt|gt|#39);/g, value => ({ '&amp;': '&', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&#39;': "'" })[value]);
const escape = text => String(text ?? '').replace(/[&<>"]/g, value => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[value]);
const voidTags = new Set(['input', 'img', 'br', 'hr', 'meta', 'link']);

// This small DOM parses the real HTML and the actual controller's generated
// navigation/results. It implements only the browser APIs exercised here.
function dom() {
  let document;
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.attributes = new Map(); this.children = []; this.parentElement = null;
      this.dataset = {}; this.listeners = new Map(); this.value = ''; this.hidden = false; this.open = false; this.checked = false;
      this.valid = true; this.validityChecks = 0; this._text = '';
      this.classList = {
        contains: name => this.className.split(/\s+/).includes(name),
        add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); },
        remove: (...names) => { this.className = this.className.split(/\s+/).filter(name => !names.includes(name)).join(' '); },
        toggle: (name, force) => { const enabled = force ?? !this.classList.contains(name); this.classList[enabled ? 'add' : 'remove'](name); return enabled; },
      };
    }
    get id() { return this.getAttribute('id') ?? ''; }
    set id(value) { this.setAttribute('id', value); }
    get className() { return this.getAttribute('class') ?? ''; }
    set className(value) { this.setAttribute('class', value); }
    get disabled() { return this.attributes.has('disabled'); }
    set disabled(value) { value ? this.setAttribute('disabled', '') : this.removeAttribute('disabled'); }
    get hidden() { return this.attributes.has('hidden'); }
    set hidden(value) { value ? this.attributes.set('hidden', '') : this.attributes.delete('hidden'); }
    get inert() { return this.attributes.has('inert'); }
    set inert(value) { value ? this.attributes.set('inert', '') : this.attributes.delete('inert'); }
    get tabIndex() { return this.attributes.has('tabindex') ? Number(this.getAttribute('tabindex')) : /BUTTON|INPUT|SELECT|TEXTAREA/.test(this.tagName) || this.tagName === 'A' && this.getAttribute('href') ? 0 : -1; }
    set tabIndex(value) { this.setAttribute('tabindex', value); }
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
      if (name === 'value') this.value = decode(value);
    }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    hasAttribute(name) { return this.attributes.has(name); }
    removeAttribute(name) { this.attributes.delete(name); }
    appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
    before(child) { assert.ok(this.parentElement); const index = this.parentElement.children.indexOf(this); child.parentElement = this.parentElement; this.parentElement.children.splice(index, 0, child); }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this.children = []; this._text = String(value); }
    set innerHTML(markup) { this.children = []; this._text = ''; parse(this, String(markup)); }
    querySelectorAll(selector) {
      const descendants = []; const walk = node => { for (const child of node.children) { descendants.push(child); walk(child); } }; walk(this);
      return descendants.filter(node => selector.split(',').some(part => matchesPath(node, part.trim())));
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
    closest(selector) { for (let node = this; node; node = node.parentElement) if (selector.split(',').some(part => matchesPart(node, part.trim()))) return node; return null; }
    contains(node) { for (let candidate = node; candidate; candidate = candidate.parentElement) if (candidate === this) return true; return false; }
    addEventListener(type, callback) { const list = this.listeners.get(type) ?? []; list.push(callback); this.listeners.set(type, list); }
    focus() { if (!this.closest('[inert]')) document.activeElement = this; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    reportValidity() { this.validityChecks++; return this.valid; }
    scrollIntoView() { this.scrolled = true; }
    async emit(type, options = {}) {
      const event = { type, target: this, key: '', ctrlKey: false, metaKey: false, defaultPrevented: false, stopped: false, ...options,
        preventDefault() { this.defaultPrevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
      for (const callback of document.listeners.get(type + ':capture') ?? []) { await callback(event); if (event.stopped) return event; }
      if (this['on' + type]) await this['on' + type](event);
      for (const callback of [...(this.listeners.get(type) ?? [])]) { await callback(event); if (event.stopped) return event; }
      for (const callback of document.listeners.get(type) ?? []) { await callback(event); if (event.stopped) return event; }
      return event;
    }
    async click() { if (this.disabled) return; return this.emit('click'); }
  }
  function matchesPart(node, selector) {
    const notDisabled = selector.includes(':not(:disabled)'); selector = selector.replace(':not(:disabled)', '');
    if (notDisabled && node.disabled) return false;
    if (selector.includes(':disabled') && !node.disabled) return false;
    selector = selector.replace(/:disabled\b/g, '');
    for (const match of selector.matchAll(/:not\(([^)]+)\)/g)) if (matchesPart(node, match[1])) return false;
    selector = selector.replace(/:not\([^)]+\)/g, '');
    const tag = selector.match(/^[a-z][a-z0-9-]*/i)?.[0]; if (tag && node.tagName !== tag.toUpperCase()) return false;
    const id = selector.match(/#([\w-]+)/)?.[1]; if (id && node.id !== id) return false;
    for (const match of selector.matchAll(/\.([\w-]+)/g)) if (!node.classList.contains(match[1])) return false;
    for (const match of selector.matchAll(/\[([^\]=]+)(?:=["']?([^\]"']+)["']?)?\]/g)) {
      if (node.getAttribute(match[1]) === null || (match[2] !== undefined && node.getAttribute(match[1]) !== match[2])) return false;
    }
    return true;
  }
  function matchesPath(node, selector) {
    const parts = selector.split(/\s+/); if (!matchesPart(node, parts.pop())) return false;
    let ancestor = node.parentElement;
    while (parts.length) { const part = parts.pop(); while (ancestor && !matchesPart(ancestor, part)) ancestor = ancestor.parentElement; if (!ancestor) return false; ancestor = ancestor.parentElement; }
    return true;
  }
  function parse(parent, markup) {
    const stack = [parent];
    for (const token of markup.match(/<!--[\s\S]*?-->|<[^>]+>|[^<]+/g) ?? []) {
      if (token.startsWith('<!')) continue;
      if (token.startsWith('</')) { const tag = token.match(/^<\/([\w-]+)/)?.[1]?.toUpperCase(); while (stack.length > 1) if (stack.pop().tagName === tag) break; continue; }
      if (!token.startsWith('<')) { stack.at(-1)._text += decode(token); continue; }
      const tag = token.match(/^<([\w-]+)/)?.[1]; if (!tag) continue;
      const node = new Element(tag);
      const attrs = token.slice(tag.length + 1).replace(/\/?>$/, '');
      for (const match of attrs.matchAll(/([^\s=]+)(?:\s*=\s*"([^"]*)"|\s*=\s*'([^']*)'|\s*=\s*([^\s]+))?/g)) node.setAttribute(match[1], decode(match[2] ?? match[3] ?? match[4] ?? ''));
      stack.at(-1).appendChild(node); if (!voidTags.has(tag.toLowerCase()) && !token.endsWith('/>')) stack.push(node);
    }
  }
  document = {
    body: new Element('body'), documentElement: new Element('html'), listeners: new Map(), activeElement: null,
    querySelector(selector) { return this.body.querySelector(selector); }, querySelectorAll(selector) { return this.body.querySelectorAll(selector); },
    getElementById(id) { return this.querySelector('#' + id); }, createElement(tag) { return new Element(tag); },
    addEventListener(type, callback, capture = false) { const key = type + (capture ? ':capture' : ''); const list = this.listeners.get(key) ?? []; list.push(callback); this.listeners.set(key, list); },
  };
  document.activeElement = document.body;
  document.body.innerHTML = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)[1];
  return document;
}

const schema = { items: { creatable: true }, jobs: { creatable: true }, companies: { creatable: true, label: { en: 'Companies', ar: 'الشركات' } } };
const catalog = {
  items: { knife: { name: { en: 'Knife', ar: 'سكين' } }, 'knife-2': { name: { en: 'Second knife', ar: 'سكين آخر' } }, medical: { name: { en: 'Café Kit', ar: 'إِسعاف أولي' } } },
  jobs: { mechanic: { name: { en: 'Mechanic', ar: 'ميكانيكي' } } }, companies: {},
};
const modules = [
  { id: 'crime', name: 'Crime', description: 'Crime rules', description_ar: 'إِدارة الجرائم', version: '1.0.0', installed: true, enabled: true, provides: ['crime'], subscribes: [] },
  { id: 'market', name: 'Market', description: 'Market', description_ar: 'السوق', version: '2.0.0', installed: true, enabled: false, provides: ['market'], subscribes: [] },
  { id: 'companies', name: 'Companies', description: 'Companies', description_ar: 'الشركات', version: '0.2.0', installed: false, enabled: false, provides: [], subscribes: [] },
];
const crimeIds = ['crimeId', 'crimeNameEn', 'crimeNameAr', 'crimeNerve', 'crimeSuccess', 'crimeCashMin', 'crimeCashMax', 'crimeXp', 'crimeLevel'];
function studio({ search = '?lang=en&section=overview', bootReady = true, loadedSchema = schema, saveCrimeHook, catalogHook } = {}) {
  const document = dom(), calls = [], notices = [], historyCalls = [], windowListeners = new Map();
  const location = {}; const setLocation = url => { const current = new URL(url, 'https://zone.test'); for (const key of ['href', 'origin', 'pathname', 'search', 'hash']) location[key] = current[key]; }; setLocation('https://zone.test/admin' + search);
  const historyStack = [location.href]; let historyIndex = 0;
  const window = { addEventListener(type, callback) { const list = windowListeners.get(type) ?? []; list.push(callback); windowListeners.set(type, list); } };
  const history = {
    pushState(_data, _title, url) { historyCalls.push(['push', url]); historyStack.splice(++historyIndex); historyStack.push(new URL(url, location.origin).href); setLocation(url); },
    replaceState(_data, _title, url) { historyCalls.push(['replace', url]); historyStack[historyIndex] = new URL(url, location.origin).href; setLocation(url); },
  };
  const manifest = { pages: [{ id: 'home', slug: 'home', title: { en: 'Home', ar: 'الرئيسية' } }, { id: 'harbor', slug: 'harbor', title: { en: 'Harbor page', ar: 'صفحة المرفأ' } }] };
  const state = { language: new URLSearchParams(search).get('lang') === 'ar' ? 'ar' : 'en', bootReady, bootError: null, view: 'overview', controlBusy: false, catalogBusy: false, dirty: false,
    savedDraftManifest: JSON.stringify(manifest), gameplayCatalog: { schema: structuredClone(loadedSchema), catalogs: structuredClone(catalog) }, catalogCategory: 'items', catalogEntry: 'knife', catalogEdits: {}, catalogNewIds: {},
    catalogError: '', catalogMessage: '', modules: structuredClone(modules), selectedCrime: 'shoplift', crimeEditorBaseline: null, selectedPage: 'home' };
  const q = selector => document.querySelector(selector), qa = selector => document.querySelectorAll(selector);
  const captureCrime = () => JSON.stringify(crimeIds.map(id => q('#' + id).value).concat(q('#crimeEnabled').checked));
  const savedCrime = ['shoplift', 'Shoplift', 'سرقة متجر', '2', '75', '10', '20', '3', '1'];
  const resetCrime = () => { crimeIds.forEach((id, index) => { q('#' + id).value = savedCrime[index]; }); q('#crimeEnabled').checked = true; state.crimeEditorBaseline = captureCrime(); };
  resetCrime();
  const mutationReady = () => state.bootReady && !state.controlBusy && !state.catalogBusy;
  const previews = [];
  for (const section of qa('.view')) {
    let panel = section.querySelector('.builder-preview,.section-preview,.territory-map-panel');
    if (!panel) {
      panel = document.createElement('article'); panel.className = 'section-preview'; panel.dataset.sectionPreview = ''; panel.dataset.previewScreen = 'home';
      panel.innerHTML = '<button data-preview-toggle aria-expanded="true" aria-controls="fixture-preview-' + section.dataset.view + '">Preview</button><div id="fixture-preview-' + section.dataset.view + '"><iframe class="section-preview-frame"></iframe></div>';
      section.appendChild(panel);
    }
    const button = panel.querySelector('[data-preview-toggle]'), stage = document.getElementById(button.getAttribute('aria-controls'));
    const frame = stage?.querySelector('iframe');
    if (frame) previews.push({ view: section.dataset.view, panel, button, stage, frame });
  }
  const unload = () => { for (const preview of previews) if (preview.view !== state.view || preview.stage.hidden) preview.frame.removeAttribute('src'); };
  const loadPreview = view => { const preview = previews.find(item => item.view === view); if (view === state.view && preview && !preview.stage.hidden) preview.frame.setAttribute('src', '/?fixture-preview=1&screen=' + (preview.panel.dataset.previewScreen || 'home')); };
  const renderCatalog = () => {
    if (!Object.hasOwn(state.gameplayCatalog.schema, state.catalogCategory)) state.catalogCategory = Object.keys(state.gameplayCatalog.schema)[0] || 'items';
    const entries = state.gameplayCatalog.catalogs[state.catalogCategory] ?? {};
    if (state.catalogEntry !== '__new' && !Object.hasOwn(entries, state.catalogEntry)) state.catalogEntry = Object.keys(entries)[0] || null;
    if (!q('#catalogField-name-en')) { const input = document.createElement('input'); input.id = 'catalogField-name-en'; q('#catalogFields').appendChild(input); }
    // Original Admin input delegates persist fields before Studio's bubbling
    // listener runs. Studio generates IDs but does not own manual-ID saving.
    q('#catalogNewId').oninput = () => { state.catalogNewIds[state.catalogCategory] = q('#catalogNewId').value; };
    q('#catalogField-name-en').oninput = () => { (state.catalogEdits[state.catalogCategory + '/' + state.catalogEntry] ??= {})['name.en'] = q('#catalogField-name-en').value; };
  };
  for (const module of state.modules) { const card = document.createElement('article'); card.className = 'catalog-card'; card.dataset.moduleId = module.id; q('#moduleGrid').appendChild(card); }
  q('#newCrimeButton').onclick = () => context.newCrime();
  q('#publishButton').onclick = () => { calls.push({ action: 'originalPublish' }); };
  const context = createContext({
    console, URL, URLSearchParams, window, document, location, history, state, translations: structuredClone(originalTranslations), catalogDefaultLabels: {}, esc: escape,
    fetch() { throw new Error('Studio must delegate to the existing guarded controller, not create fetch paths.'); },
    currentManifest: () => manifest, authoringManifestText: serializeAuthoring, adminCanMutate: mutationReady,
    unsavedContentEdits: () => ({ catalog: Object.entries(state.catalogEdits).find(([, edits]) => Object.keys(edits).length)?.[0] ?? (Object.keys(state.catalogNewIds).length ? state.catalogCategory + '/__new' : null), crime: captureCrime() !== state.crimeEditorBaseline }),
    setView(view) { state.view = schemaView(view); for (const section of qa('.view')) section.classList.toggle('active', section.dataset.view === state.view); unload(); window.ZoneStudio?.renderNavigation(); loadPreview(state.view); window.ZoneStudio?.viewChanged(); },
    applyLanguage() { document.documentElement.lang = state.language; document.documentElement.dir = state.language === 'ar' ? 'rtl' : 'ltr'; window.ZoneStudio?.renderNavigation(); renderCatalog(); window.ZoneStudio?.refresh(); },
    renderGameplayCatalog: renderCatalog, renderBuilder() { calls.push({ action: 'renderBuilder' }); },
    newGameplayCatalog() { if (!mutationReady()) return; calls.push({ action: 'newCatalog', category: state.catalogCategory }); state.catalogEntry = '__new'; renderCatalog(); },
    addPage() { if (!mutationReady()) return; calls.push({ action: 'addPage' }); },
    newCrime() { if (!mutationReady()) return; calls.push({ action: 'newCrime' }); state.selectedCrime = ''; crimeIds.forEach(id => { q('#' + id).value = ''; }); state.crimeEditorBaseline = captureCrime(); },
    renderContent() { resetCrime(); },
    discardCrimeEdits() { if (!mutationReady()) return; calls.push({ action: 'discardCrime' }); resetCrime(); },
    async saveCrime(event) {
      event.preventDefault(); if (!mutationReady()) return;
      const fields = JSON.parse(captureCrime()); calls.push({ action: 'saveCrime', fields }); state.controlBusy = true;
      try { if (saveCrimeHook) await saveCrimeHook({ state, q, fields }); else state.crimeEditorBaseline = captureCrime(); }
      finally { state.controlBusy = false; }
    },
    async saveGameplayCatalog(event) { event.preventDefault(); if (!mutationReady()) return; calls.push({ action: 'saveCatalog', category: state.catalogCategory, entry: state.catalogEntry, edits: structuredClone(state.catalogEdits) }); if (catalogHook) await catalogHook({ state, q }); else { state.catalogEdits = {}; state.catalogNewIds = {}; state.dirty = true; } },
    async saveDraft() { if (!mutationReady()) return; calls.push({ action: 'saveDraft' }); state.savedDraftManifest = JSON.stringify(manifest); state.dirty = true; },
    notify(message, bad) { notices.push({ message, bad }); },
    suspendInactivePreviews: unload, updatePreviewToggleLabel() {},
    togglePreview(button) { calls.push({ action: 'togglePreview', view: state.view }); const preview = previews.find(item => item.button === button); preview.stage.hidden = false; button.setAttribute('aria-expanded', 'true'); loadPreview(state.view); },
    refreshViewPreview(view) { calls.push({ action: 'refreshPreview', view }); loadPreview(view); },
  });
  function schemaView(view) { return ['overview', 'content', 'builder', 'territories', 'modules', 'themes', 'assets', 'releases', 'economy', 'events'].includes(view) ? view : 'overview'; }
  runInContext(source, context, { filename: 'admin-studio.js' });
  const app = window.ZoneStudio;
  assert.ok(app?.initialize, 'The actual browser controller must initialize, not only export pure helpers.');
  return { app, state, q, qa, document, context, calls, notices, previews, historyCalls, location, captureCrime,
    async back() { assert.ok(historyIndex > 0); setLocation(historyStack[--historyIndex]); for (const listener of windowListeners.get('popstate') ?? []) await listener({}); },
    async input(selector, value) { const element = q(selector); assert.ok(element, selector); element.value = value; return element.emit('input'); },
    async change(selector, value) { const element = q(selector); element.value = value; return element.emit('change'); },
  };
}
const count = (fixture, action) => fixture.calls.filter(call => call.action === action).length;

test('a saved new definition resumes by canonical ID after an in-flight category switch, without stealing the current editor', () => {
  for (const language of ['en', 'ar']) {
    const f = studio({ search: '?section=content&type=items&lang=' + language });
    f.state.catalogEntry = '__new'; f.state.catalogNewIds.items = 'harbor-baton';
    f.state.catalogEdits['items/__new'] = { 'name.en': 'Harbor baton', 'name.ar': 'عصا الميناء' };
    f.app.openCatalog('jobs', 'mechanic');
    f.state.gameplayCatalog.catalogs.items['harbor-baton'] = { name: { en: 'Harbor baton', ar: 'عصا الميناء' } };
    delete f.state.catalogEdits['items/__new']; delete f.state.catalogNewIds.items;
    f.app.catalogSaved('items', '__new', 'harbor-baton');
    assert.equal(f.state.catalogCategory, 'jobs'); assert.equal(f.state.catalogEntry, 'mechanic');
    f.app.openCatalog('items'); assert.equal(f.state.catalogEntry, 'harbor-baton');
    assert.equal(count(f, 'newCatalog'), 0);
    assert.equal(count(f, 'saveCatalog'), 0);
  }
});

test('Studio HTML supplies native labeled dialogs, contextual save controls and correct deferred controller order', () => {
  for (const id of ['studioMenuButton', 'studioTasks', 'studioContentTypes', 'studioCatalogPanel', 'studioCrimePanels', 'studioSaveBar', 'studioSaveButton', 'studioPreviewButton', 'studioCommandDialog', 'studioHelpDialog', 'studioLeaveDialog']) assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(html, /<dialog[^>]*id="studioCommandDialog"[^>]*aria-labelledby=/);
  assert.match(html, /<label[^>]*for="studioCommandInput"/);
  const scripts = [...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(match => match[1].replace(/^\//, '').split('?')[0]);
  assert.ok(scripts.indexOf('admin.js') >= 0 && scripts.indexOf('admin.js') < scripts.indexOf('admin-studio.js'), 'Studio loads after the guarded Admin controller.');
});

test('every live Studio copy marker resolves to readable copy after either locale refresh', () => {
  for (const language of ['en', 'ar']) {
    const f = studio({ search: '?section=modules&lang=' + language });
    for (const element of f.qa('[data-studio-copy]')) assert.notEqual(element.textContent, element.dataset.studioCopy, element.dataset.studioCopy + ' in ' + language);
    f.state.language = language === 'en' ? 'ar' : 'en'; f.context.applyLanguage();
    for (const element of f.qa('[data-studio-copy]')) assert.notEqual(element.textContent, element.dataset.studioCopy, element.dataset.studioCopy + ' after locale change');
  }
});

test('actual initialization validates routes and chooses a deep content type in both languages', () => {
  for (const language of ['en', 'ar']) for (const type of ['jobs', 'crimes', 'companies']) {
    const f = studio({ search: '?section=content&type=' + type + '&lang=' + language });
    assert.equal(f.state.view, 'content'); assert.equal(f.state.language, language);
    assert.equal(f.q('[data-studio-type="' + type + '"]').getAttribute('aria-selected'), 'true');
    if (type !== 'crimes') assert.equal(f.state.catalogCategory, type);
    assert.equal(f.q('#studioCrimePanels').hidden, type !== 'crimes');
    assert.equal(new URL(f.location.href).searchParams.get('lang'), language);
  }
  const invalid = studio({ search: '?section=constructor&type=__proto__&lang=ar' });
  assert.equal(invalid.state.view, 'overview'); assert.equal(invalid.state.catalogCategory, 'items');
  assert.equal(new URL(invalid.location.href).searchParams.get('section'), 'overview');
});

test('a deep type requested before asynchronous catalog bootstrap is applied once real schema arrives', () => {
  const f = studio({ search: '?section=content&type=jobs&lang=ar', bootReady: false, loadedSchema: {} });
  assert.equal(f.q('#studioContentTypes').getAttribute('aria-busy'), 'true');
  f.state.gameplayCatalog.schema = structuredClone(schema); f.state.bootReady = true; f.app.refresh();
  assert.equal(f.state.catalogCategory, 'jobs'); assert.equal(f.state.catalogEntry, 'mechanic');
  assert.equal(f.q('[data-studio-type="jobs"]').getAttribute('aria-selected'), 'true');
  assert.equal(new URL(f.location.href).searchParams.get('lang'), 'ar');
  f.app.refresh(); assert.equal(f.state.catalogCategory, 'jobs');
});

test('generated navigation and Back retain section/type/language without replaying history writes', async () => {
  const f = studio({ search: '?section=content&type=jobs&lang=ar' });
  await f.q('[data-nav="modules"]').click(); await f.q('[data-nav="builder"]').click();
  assert.equal(f.state.view, 'builder'); assert.equal(new URL(f.location.href).searchParams.get('lang'), 'ar');
  const writes = f.historyCalls.length; await f.back();
  assert.equal(f.state.view, 'modules'); assert.equal(f.historyCalls.length, writes);
  await f.back(); assert.equal(f.state.view, 'content'); assert.equal(f.state.catalogCategory, 'jobs');
  assert.equal(f.q('[data-studio-type="jobs"]').getAttribute('aria-selected'), 'true');
});

test('browser Back restores the language represented by its prior URL, not the current locale', async () => {
  const f = studio({ search: '?section=overview&lang=en' });
  await f.q('[data-nav="modules"]').click(); f.state.language = 'ar'; f.context.applyLanguage(); f.app.viewChanged();
  assert.equal(new URL(f.location.href).searchParams.get('lang'), 'ar');
  await f.back();
  assert.equal(new URL(f.location.href).searchParams.get('lang'), 'en');
  assert.equal(f.state.language, 'en'); assert.equal(f.document.documentElement.dir, 'ltr');
});

test('content keyboard navigation follows RTL direction and a type change retains unfinished catalog fields', async () => {
  const f = studio({ search: '?section=content&lang=ar' });
  f.state.catalogEdits['items/knife'] = { price: '77', 'name.ar': 'سكين معدل' };
  const items = f.q('[data-studio-type="items"]'); items.focus(); await items.emit('keydown', { key: 'ArrowRight' });
  assert.equal(f.document.activeElement.dataset.studioType, 'crimes');
  await f.q('[data-studio-type="jobs"]').click(); await f.q('[data-studio-type="items"]').click();
  assert.equal(f.state.catalogEdits['items/knife'].price, '77'); assert.equal(f.state.catalogEntry, 'knife');
});

test('the live search normalizes Arabic harakat/alif and Latin accents, then selects the server definition', async () => {
  for (const query of ['CAFE KIT', 'اسعاف اولي', 'إِسْعَاف أَوَّلِي']) {
    const f = studio({ search: '?lang=ar&section=overview' });
    await f.q('#studioSearchButton').click(); await f.input('#studioCommandInput', query);
    const results = f.qa('#studioCommandResults button'); assert.equal(results.length, 1, query);
    await results[0].click(); assert.equal(f.state.view, 'content'); assert.equal(f.state.catalogEntry, 'medical');
    assert.equal(f.q('#studioCommandDialog').open, false);
  }
});

test('typing a definition name generates a collision-free ID, and an explicit manual ID stays untouched', async () => {
  const f = studio(); await f.q('[data-studio-action="item"]').click();
  await f.input('#catalogField-name-en', 'Knife');
  assert.equal(f.q('#catalogNewId').value, 'knife-3'); assert.equal(f.state.catalogNewIds.items, 'knife-3');
  await f.input('#catalogNewId', 'owner-chosen-id'); await f.input('#catalogField-name-en', 'Another name');
  assert.equal(f.q('#catalogNewId').value, 'owner-chosen-id'); assert.equal(f.state.catalogNewIds.items, 'owner-chosen-id');
});

test('automatic IDs for numeric-leading names comply with the existing catalog ID contract', async () => {
  const f = studio(); await f.app.createCatalog('items'); await f.input('#catalogField-name-en', '9mm Pistol');
  assert.match(f.q('#catalogNewId').value, /^[a-z][a-z0-9_-]{1,63}$/);
});

test('automatic permanent IDs never use names the original catalog controller reserves', async () => {
  for (const name of ['Constructor', 'Prototype', 'Fists']) {
    const f = studio(); await f.app.createCatalog('items'); await f.input('#catalogField-name-en', name);
    assert.equal(['constructor', 'prototype', 'fists'].includes(f.q('#catalogNewId').value), false, name);
  }
});

test('create actions delegate once to original guarded functions and never introduce a network path', async () => {
  const f = studio(); await f.q('[data-studio-action="item"]').click();
  assert.equal(count(f, 'newCatalog'), 1); assert.equal(f.state.catalogEntry, '__new');
  assert.equal(f.document.activeElement.id, 'catalogField-name-en');
  await f.q('[data-studio-action="page"]').click();
  assert.equal(count(f, 'addPage'), 1); assert.equal(f.state.view, 'builder'); assert.equal(f.document.activeElement.id, 'pageTitleEn');
});

test('offline or busy creation cannot change the selected content or delegate a mutation', async () => {
  for (const flags of [{ bootReady: false }, { controlBusy: true }, { catalogBusy: true }]) {
    const f = studio(); Object.assign(f.state, flags);
    const before = [f.state.view, f.state.catalogCategory, f.state.catalogEntry, f.state.selectedPage];
    await f.app.createCatalog('jobs'); f.app.createPage();
    assert.deepEqual([f.state.view, f.state.catalogCategory, f.state.catalogEntry, f.state.selectedPage], before);
    assert.equal(count(f, 'newCatalog') + count(f, 'addPage'), 0);
  }
});

test('contextual catalog save delegates once with the current edit and leaves crime fields intact', async () => {
  const f = studio({ search: '?section=content&type=items&lang=en' });
  const crimeBefore = f.captureCrime(); f.state.catalogEdits['items/knife'] = { price: '88' }; f.app.refresh();
  await f.q('#studioSaveButton').click();
  assert.equal(count(f, 'saveCatalog'), 1); assert.equal(count(f, 'saveCrime'), 0);
  assert.equal(f.calls.find(call => call.action === 'saveCatalog').edits['items/knife'].price, '88'); assert.equal(f.captureCrime(), crimeBefore);
});

test('crime Save checks the real form validity before calling the original save delegate', async () => {
  const f = studio({ search: '?section=content&type=crimes&lang=en' }); f.q('#crimeNameEn').value = 'Updated crime'; f.app.refresh();
  f.q('#crimeForm').valid = false; await f.q('#studioSaveButton').click();
  assert.equal(count(f, 'saveCrime'), 0); assert.equal(f.q('#crimeForm').validityChecks, 1); assert.equal(f.q('#crimeNameEn').value, 'Updated crime');
  f.q('#crimeForm').valid = true; await f.q('#studioSaveButton').click();
  assert.equal(count(f, 'saveCrime'), 1); assert.equal(f.calls.find(call => call.action === 'saveCrime').fields[1], 'Updated crime');
});

test('crime Keep editing closes the dialog without losing fields or performing the queued action', async () => {
  const f = studio(); f.q('#crimeNameAr').value = 'مسودة محلية'; const before = f.captureCrime(); let switched = 0;
  f.app.requestCrimeSwitch(() => switched++); assert.equal(f.q('#studioLeaveDialog').open, true);
  await f.q('#studioLeaveStay').click();
  assert.equal(switched, 0); assert.equal(f.captureCrime(), before); assert.equal(count(f, 'saveCrime') + count(f, 'discardCrime'), 0);
  assert.equal(f.q('#studioLeaveDialog').open, false);
});

test('crime Discard restores the original editor before running the queued switch', async () => {
  const f = studio(); const baseline = f.captureCrime(); f.q('#crimeNameEn').value = 'Discard this'; let atSwitch;
  f.app.requestCrimeSwitch(() => { atSwitch = f.captureCrime(); }); await f.q('#studioLeaveDiscard').click();
  assert.equal(count(f, 'discardCrime'), 1); assert.equal(count(f, 'saveCrime'), 0); assert.equal(atSwitch, baseline);
});

test('failed crime Save and continue keeps the dialog, selection and all unsaved fields', async () => {
  const f = studio({ saveCrimeHook: async () => {} }); f.q('#crimeNameEn').value = 'Retain after failure'; const before = f.captureCrime(); let switched = 0;
  f.app.requestCrimeSwitch(() => switched++); await f.q('#studioLeaveSave').click();
  assert.equal(count(f, 'saveCrime'), 1); assert.equal(switched, 0); assert.equal(f.captureCrime(), before); assert.equal(f.state.selectedCrime, 'shoplift');
  assert.equal(f.q('#studioLeaveDialog').open, true);
});

test('successful crime Save and continue waits for the guarded delegate then performs only one queued action', async () => {
  const f = studio(); f.q('#crimeNameEn').value = 'Save this'; let switched = 0;
  f.app.requestCrimeSwitch(() => switched++); f.app.requestCrimeSwitch(() => { switched += 100; }); await f.q('#studioLeaveSave').click();
  assert.equal(count(f, 'saveCrime'), 1); assert.equal(switched, 1); assert.equal(f.q('#studioLeaveDialog').open, false);
  assert.equal(f.calls.find(call => call.action === 'saveCrime').fields[1], 'Save this');
});

test('invalid crime fields also block Save and continue without dismissing the choice', async () => {
  const f = studio(); f.q('#crimeNameEn').value = ''; f.q('#crimeForm').valid = false; let switched = 0;
  f.app.requestCrimeSwitch(() => switched++); await f.q('#studioLeaveSave').click();
  assert.equal(count(f, 'saveCrime'), 0); assert.equal(switched, 0); assert.equal(f.q('#studioLeaveDialog').open, true);
});

test('the actual New crime click capture offers a decision before the original destructive selection handler', async () => {
  const f = studio({ search: '?section=content&type=crimes&lang=ar' });
  f.q('#crimeNameAr').value = 'احتفظ بهذا النص'; const before = f.captureCrime();
  const event = await f.q('#newCrimeButton').click();
  assert.equal(event.stopped, true); assert.equal(f.captureCrime(), before); assert.equal(count(f, 'newCrime'), 0);
  assert.equal(f.q('#studioLeaveDialog').open, true);
  await f.q('#studioLeaveDiscard').click(); assert.equal(count(f, 'discardCrime'), 1); assert.equal(count(f, 'newCrime'), 1);
});

test('an in-flight Save and continue cannot repeat the original save and cannot discard newer typed fields', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const f = studio({ saveCrimeHook: async ({ state, fields }) => { await gate; state.crimeEditorBaseline = JSON.stringify(fields); } });
  f.q('#crimeNameEn').value = 'Submitted name'; let switched = 0; f.app.requestCrimeSwitch(() => switched++);
  const first = f.q('#studioLeaveSave').click();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(f.state.controlBusy, true);
  await f.q('#studioLeaveSave').click(); assert.equal(count(f, 'saveCrime'), 1);
  f.q('#crimeNameEn').value = 'Newer local name'; release(); await first;
  assert.equal(switched, 0); assert.equal(f.q('#crimeNameEn').value, 'Newer local name'); assert.equal(f.q('#studioLeaveDialog').open, true);
});

test('offline contextual save leaves all editor fields untouched and invokes no original write delegate', async () => {
  const f = studio({ search: '?section=content&type=crimes&lang=ar' });
  f.q('#crimeNameEn').value = 'Offline draft'; const before = f.captureCrime(); f.state.bootReady = false;
  await f.app.saveCurrent(); assert.equal(f.captureCrime(), before);
  assert.equal(count(f, 'saveCrime') + count(f, 'saveCatalog') + count(f, 'saveDraft'), 0);
});

test('saving elsewhere takes pending crime edits to the crime editor, not the unrelated item pane', async () => {
  const f = studio({ search: '?section=builder&lang=ar' }); f.q('#crimeNameAr').value = 'تعديل غير محفوظ';
  await f.app.saveCurrent();
  assert.equal(count(f, 'saveDraft'), 0); assert.equal(f.state.view, 'content');
  assert.equal(f.q('#studioCrimePanels').hidden, false); assert.equal(f.q('#studioCatalogPanel').hidden, true);
  assert.equal(f.q('#crimeNameAr').value, 'تعديل غير محفوظ'); assert.equal(f.notices.at(-1).bad, true);
});

test('saving elsewhere selects the exact pending catalog category and definition without losing its fields', async () => {
  const f = studio({ search: '?section=themes&lang=en' });
  f.state.catalogEdits['jobs/mechanic'] = { salary: '180' };
  await f.app.saveCurrent();
  assert.equal(count(f, 'saveDraft') + count(f, 'saveCatalog'), 0);
  assert.equal(f.state.view, 'content'); assert.equal(f.state.catalogCategory, 'jobs'); assert.equal(f.state.catalogEntry, 'mechanic');
  assert.equal(f.state.catalogEdits['jobs/mechanic'].salary, '180');
});

test('extension search/status filters distinguish installed, disabled and available packages accurately', async () => {
  const f = studio({ search: '?section=modules&lang=ar' });
  const visible = () => f.qa('#moduleGrid .catalog-card').filter(card => !card.hidden).map(card => card.dataset.moduleId);
  assert.deepEqual(visible(), ['crime', 'market', 'companies']);
  await f.change('#studioModuleFilter', 'installed'); assert.deepEqual(visible(), ['crime', 'market']);
  await f.change('#studioModuleFilter', 'disabled'); assert.deepEqual(visible(), ['market']);
  await f.change('#studioModuleFilter', 'available'); assert.deepEqual(visible(), ['companies']);
  await f.change('#studioModuleFilter', 'all'); await f.input('#studioModuleSearch', 'ادارة');
  assert.deepEqual(visible(), ['crime']); assert.match(f.q('#studioModuleCount').textContent, /^1 /);
  await f.input('#studioModuleSearch', 'not-found'); assert.deepEqual(visible(), []); assert.match(f.q('#studioModuleCount').textContent, /لا توجد/);
  assert.match(f.q('#studioModuleFilter [value="all"]').textContent, /الإضافات/);
});

test('previews are initially collapsed/unloaded and mount only on explicit preview demand', async () => {
  const f = studio({ search: '?section=builder&lang=en' });
  for (const preview of f.previews.filter(item => item.panel.classList.contains('builder-preview') || item.panel.classList.contains('section-preview'))) {
    assert.equal(preview.stage.hidden, true, preview.view); assert.equal(preview.button.getAttribute('aria-expanded'), 'false'); assert.equal(preview.frame.getAttribute('src'), null);
  }
  await f.q('#studioPreviewButton').click();
  assert.equal(count(f, 'togglePreview'), 1); assert.equal(f.previews.filter(item => item.frame.getAttribute('src')).length, 1);
  assert.ok(f.previews.find(item => item.view === 'builder').frame.getAttribute('src'));
  await f.q('#studioPreviewButton').click(); assert.equal(count(f, 'togglePreview'), 1); assert.equal(count(f, 'refreshPreview'), 1);
  await f.q('[data-nav="content"]').click(); assert.equal(f.previews.filter(item => item.frame.getAttribute('src')).length, 0);
});

test('unsaved content blocks preview rather than silently previewing a different saved definition', async () => {
  for (const kind of ['catalog', 'crime']) {
    const f = studio({ search: '?section=content&type=' + (kind === 'crime' ? 'crimes' : 'items') + '&lang=en' });
    if (kind === 'catalog') f.state.catalogEdits['items/knife'] = { price: '99' }; else f.q('#crimeNameEn').value = 'Unsaved';
    f.app.previewCurrent(); assert.equal(count(f, 'togglePreview'), 0); assert.equal(f.previews.filter(item => item.frame.getAttribute('src')).length, 0);
    assert.match(f.notices.at(-1).message, /Save the item or crime fields/);
  }
});

test('search shortcut, ArrowDown, native cancel and phone menu Escape have deterministic focus return', async () => {
  const f = studio(); const trigger = f.q('#studioSearchButton'); trigger.focus();
  const shortcut = await trigger.emit('keydown', { key: 'k', ctrlKey: true });
  assert.equal(shortcut.defaultPrevented, true); assert.equal(f.q('#studioCommandDialog').open, true); assert.equal(f.document.activeElement.id, 'studioCommandInput');
  await f.q('#studioCommandInput').emit('keydown', { key: 'ArrowDown' }); assert.equal(f.document.activeElement.dataset.studioResult, '0');
  await f.q('#studioCommandDialog').emit('cancel'); assert.equal(f.q('#studioCommandDialog').open, false); assert.equal(f.document.activeElement, trigger);
  await f.q('#studioMenuButton').click(); assert.equal(f.document.body.classList.contains('studio-menu-open'), true); assert.equal(f.document.activeElement.getAttribute('aria-current'), 'page');
  await f.document.activeElement.emit('keydown', { key: 'Escape' }); assert.equal(f.document.body.classList.contains('studio-menu-open'), false); assert.equal(f.document.activeElement.id, 'studioMenuButton');
});

test('the top Publish affordance first opens review, and only a second explicit click reaches the original handler', async () => {
  const f = studio(); await f.q('#publishButton').click();
  assert.equal(f.state.view, 'releases'); assert.equal(count(f, 'originalPublish'), 0);
  await f.q('#publishButton').click(); assert.equal(count(f, 'originalPublish'), 1);
});

test('content tabs keep stable IDs and link their selected state to the actual labeled panel in EN and AR', async () => {
  for (const language of ['en', 'ar']) {
    const f = studio({ search: '?section=content&type=items&lang=' + language });
    const ids = f.qa('#studioContentTypes [role="tab"]').map(tab => tab.id);
    assert.equal(ids.length, 4); assert.equal(new Set(ids).size, 4);
    for (const type of ['crimes', 'jobs', 'companies', 'items']) {
      const before = f.q('[data-studio-type="' + type + '"]');
      assert.ok(before.id, type + ' has an ID');
      const expectedPanel = type === 'crimes' ? 'studioCrimePanels' : 'studioCatalogPanel';
      assert.equal(before.getAttribute('aria-controls'), expectedPanel);
      await before.click();
      const selected = f.q('[data-studio-type="' + type + '"]'), panel = f.q('#' + expectedPanel);
      assert.equal(selected.getAttribute('aria-selected'), 'true'); assert.equal(selected.tabIndex, 0);
      assert.equal(panel.hidden, false); assert.equal(panel.getAttribute('role'), 'tabpanel'); assert.equal(panel.getAttribute('aria-labelledby'), selected.id);
      assert.deepEqual(f.qa('#studioContentTypes [role="tab"]').map(tab => tab.id), ids, 'IDs survive controller rerenders.');
    }
  }
});

test('an actual content tab click restores focus to its selected replacement after controller rerender', async () => {
  const f = studio({ search: '?section=content&type=items&lang=ar' });
  for (const type of ['jobs', 'crimes', 'items']) {
    const original = f.q('[data-studio-type="' + type + '"]'); original.focus(); await original.click();
    const selected = f.q('[data-studio-type="' + type + '"]');
    assert.equal(f.document.activeElement, selected, 'Focus must be on the live selected tab, not the heading or detached old button.');
    assert.equal(selected.getAttribute('aria-selected'), 'true');
  }
});

test('the phone drawer has an internal close control and makes the main workspace inert only while open', async () => {
  for (const language of ['en', 'ar']) {
    const f = studio({ search: '?section=overview&lang=' + language }), sidebar = f.q('#studioSidebar'), main = f.q('#studioWorkspace');
    const close = f.q('#studioMenuClose'); assert.ok(close); assert.equal(sidebar.contains(close), true); assert.equal(close.hidden, true); assert.equal(main.inert, false);
    await f.q('#studioMenuButton').click();
    assert.equal(main.inert, true); assert.equal(close.hidden, false); assert.equal(sidebar.getAttribute('role'), 'dialog'); assert.equal(sidebar.getAttribute('aria-modal'), 'true');
    assert.ok(sidebar.getAttribute('aria-label')); assert.equal(sidebar.contains(f.document.activeElement), true);
    const drawerFocus = f.document.activeElement; f.q('#pageTitleEn').focus(); assert.equal(f.document.activeElement, drawerFocus, 'Inert main controls cannot take focus.');
    await close.click(); assert.equal(main.inert, false); assert.equal(close.hidden, true); assert.equal(sidebar.getAttribute('aria-modal'), null);
    assert.equal(f.q('#studioMenuButton').getAttribute('aria-expanded'), 'false'); assert.equal(f.document.activeElement.id, 'studioMenuButton');
  }
});

test('phone drawer Tab and Shift+Tab wrap within visible enabled controls, and Escape restores focus', async () => {
  const f = studio(); await f.q('#studioMenuButton').click();
  f.q('#adminNav [data-nav="modules"]').disabled = true;
  const controls = f.qa('#studioSidebar button,#studioSidebar a').filter(element => !element.hidden && !element.disabled && element.tabIndex !== -1);
  assert.ok(controls.length > 2);
  controls.at(-1).focus(); const next = await controls.at(-1).emit('keydown', { key: 'Tab' });
  assert.equal(next.defaultPrevented, true); assert.equal(f.document.activeElement, controls[0]);
  const previous = await controls[0].emit('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(previous.defaultPrevented, true); assert.equal(f.document.activeElement, controls.at(-1));
  for (let index = 0; index < controls.length + 2; index++) {
    await f.document.activeElement.emit('keydown', { key: 'Tab' });
    assert.equal(f.q('#studioSidebar').contains(f.document.activeElement), true); assert.equal(f.document.activeElement.disabled, false);
  }
  await f.document.activeElement.emit('keydown', { key: 'Escape' });
  assert.equal(f.q('#studioWorkspace').inert, false); assert.equal(f.document.activeElement.id, 'studioMenuButton');
});

test('actual Admin renderers distinguish a selected-next-release theme from the live active release badge', () => {
  const definition = name => {
    const start = adminSource.indexOf('function ' + name + '('), end = adminSource.indexOf('\n}', start) + 2;
    assert.ok(start >= 0 && end > start, 'Read original ' + name); return adminSource.slice(start, end);
  };
  for (const language of ['en', 'ar']) {
    const f = studio({ search: '?section=themes&lang=' + language });
    f.state.themes = [{ id: 'terminal', name: 'Terminal', version: '1.0.0', active: true, description: 'Registered theme', description_ar: 'قالب مسجل' }, { id: 'paper', name: 'Paper', version: '1.0.0', active: false, description: 'Available theme', description_ar: 'قالب متاح' }];
    f.state.releases = [{ id: 'release-4', version: 4, active: true, publishedAt: '2026-10-13T00:00:00Z', manifest: { branding: { name: { en: 'ZONE', ar: 'زون' } } } }];
    Object.assign(f.context, { $: f.q, $$: f.qa, t: key => f.context.translations[f.state.language][key] ?? f.context.translations.en[key] ?? key, bindManifestInputs() {}, activateTheme() {}, activateRelease() {} });
    runInContext(definition('renderThemes') + '\n' + definition('renderReleases') + '\nrenderThemes(); renderReleases();', f.context);
    const releaseBadge = f.q('#releaseList .status.active').textContent, themeBadge = f.q('#themeGrid .status.active').textContent;
    assert.ok([originalTranslations[language].active, f.app.helpers.copy[language].liveRelease].includes(releaseBadge), 'The published release is labeled live/active, not selected for a future release.');
    assert.ok(f.context.translations[language].themeSelected, 'Theme selection has its own localized label.');
    assert.equal(themeBadge, f.context.translations[language].themeSelected); assert.notEqual(themeBadge, releaseBadge);
    assert.equal(f.q('#themeGrid [data-theme-id]').textContent, themeBadge);
    assert.equal(f.q('#themeGrid [data-theme-id="paper"]').textContent, f.context.translations[language].activate);
  }
});

test('a saved unpublished page remains awaiting publication after dirty clears in EN and AR', () => {
  for (const language of ['en', 'ar']) {
    const f = studio({ search: '?section=builder&lang=' + language }), draft = f.context.currentManifest();
    f.state.releases = [{ id: 'live-4', active: true, manifest: structuredClone(draft) }];
    draft.pages[0].title.en = 'Saved but unpublished home';
    f.state.savedDraftManifest = serializeAuthoring(draft); f.state.dirty = false; f.app.refresh();
    const status = f.app.snapshot();
    assert.equal(status.pageChanges, false); assert.equal(status.pending.catalog, null); assert.equal(status.pending.crime, false); assert.equal(status.unsaved, false);
    assert.equal(status.awaitingPublication, true);
    assert.equal(f.q('#studioWorkflowStatus').dataset.state, 'draft');
    assert.equal(f.q('#studioWorkflowStatus').textContent, f.app.helpers.copy[language].savedDraft);
    assert.equal(f.q('#studioPreviewButton').disabled, false);
  }
});

function publishedFixture(language = 'en') {
  const f = studio({ search: '?section=builder&lang=' + language });
  f.state.crimes = [{ id: 'shoplift', name_en: 'Shoplift', name_ar: 'سرقة متجر', nerve_cost: 2, success_basis_points: 7500, cash_min: 10, cash_max: 20, xp_reward: 3, enabled: true, correlationId: 'read-current' }];
  f.state.themes = [{ id: 'terminal', active: true }, { id: 'paper', active: false }];
  const manifest = structuredClone(f.context.currentManifest());
  manifest.content = { gameplayCatalog: structuredClone(f.state.gameplayCatalog.catalogs), crimes: structuredClone(f.state.crimes), engineModules: structuredClone(f.state.modules), themes: structuredClone(f.state.themes), activeTheme: 'terminal', capturedAt: '2026-10-12T00:00:00Z' };
  f.state.releases = [{ id: 'live-4', active: true, manifest }];
  f.state.savedDraftManifest = serializeAuthoring(f.context.currentManifest()); f.state.dirty = false; f.app.refresh();
  return f;
}

test('an unchanged saved active draft has no awaiting-publication warning, including runtime content', () => {
  for (const language of ['en', 'ar']) {
    const f = publishedFixture(language), status = f.app.snapshot();
    assert.equal(status.pageChanges, false); assert.equal(status.unsaved, false); assert.equal(status.awaitingPublication, false);
    assert.equal(f.q('#studioWorkflowStatus').dataset.state, 'ready');
    assert.equal(f.q('#studioWorkflowStatus').textContent, f.app.helpers.copy[language].readyDraft);
  }
});

for (const kind of ['catalog', 'crime', 'module', 'theme']) {
  test('saved ' + kind + ' changes are awaiting publication after reload even with dirty=false and no typed edits', () => {
    const f = publishedFixture();
    if (kind === 'catalog') f.state.gameplayCatalog.catalogs.items.knife.price = 150;
    if (kind === 'crime') f.state.crimes[0].cash_min = 11;
    if (kind === 'module') f.state.modules[1].enabled = true;
    if (kind === 'theme') { f.state.themes[0].active = false; f.state.themes[1].active = true; }
    f.app.refresh(); const status = f.app.snapshot();
    assert.equal(f.state.dirty, false); assert.equal(status.pageChanges, false); assert.equal(status.unsaved, false);
    assert.equal(status.awaitingPublication, true); assert.equal(f.q('#studioWorkflowStatus').dataset.state, 'draft');
  });
}

test('capture timestamps, read correlations and package-list order do not manufacture publication differences', () => {
  const f = publishedFixture(), content = f.state.releases[0].manifest.content;
  content.capturedAt = '2026-10-13T09:00:00Z'; content.crimes[0].correlationId = 'older-capture-correlation';
  content.engineModules.reverse(); f.app.refresh();
  assert.equal(f.app.snapshot().awaitingPublication, false);
  assert.equal(f.q('#studioWorkflowStatus').dataset.state, 'ready');
});

test('Studio snapshot exposes content counts and command search indexes authored crimes in EN and AR', () => {
  for (const language of ['en', 'ar']) {
    const f = publishedFixture(language);
    const snap = f.app.snapshot();
    assert.equal(snap.counts.catalogEntries, 4);
    assert.equal(snap.counts.crimes, 1);
    assert.equal(snap.counts.enabledModules, 1);
    const diag = f.app.diagnostics();
    assert.equal(diag.initialized, true);
    assert.equal(diag.moduleFilter, 'all');
    assert.ok(diag.searchEntryCount >= 18);
    const entries = f.app.buildSearchEntries();
    const crimeEntry = entries.find(e => e.search.includes('shoplift'));
    assert.ok(crimeEntry, 'shoplift crime is indexed in command search');
    assert.equal(crimeEntry.label, language === 'ar' ? 'سرقة متجر' : 'Shoplift');
    assert.equal(f.app.helpers.isSupportedSection('content'), true);
    assert.equal(f.app.helpers.isSupportedSection('unknown'), false);
    assert.equal(f.app.helpers.categoryLabel('items', language), language === 'ar' ? 'العناصر' : 'Items');
    assert.equal(f.app.helpers.isReservedCatalogId('fists'), true);
    assert.equal(f.app.helpers.isReservedCatalogId('knife'), false);
    assert.equal(f.app.helpers.isValidGeneratedId('knife-3'), true);
    assert.equal(f.app.helpers.isValidGeneratedId('fists'), false);
    assert.equal(f.app.helpers.supportedCategoryIds().length, 8);
    assert.equal(f.app.activeContentMode(), 'items');
    assert.equal(f.app.activeModuleFilter(), 'all');
    assert.equal(f.app.activeModuleQuery(), '');
    assert.equal(f.app.supportedSectionCount(), 10);
    assert.deepEqual(Array.from(f.app.supportedModuleFilters()), ['all', 'installed', 'available', 'disabled']);
    assert.equal(f.app.isSupportedModuleFilter('installed'), true);
    assert.equal(f.app.isSupportedModuleFilter('unknown'), false);
    assert.equal(f.app.maxCommandSearchResultCount(), 18);
    assert.equal(f.app.isReady(), true);
    assert.equal(f.app.hasUnsavedChanges(), false);
  }
});

test('admin.js exposes isBootBusy, isTerritoryBusy, isTerritoryMapReady, selectedTerritoryId and selectedCatalogCategory helpers', () => {
  const f = publishedFixture('en');
  runInContext(
    originalDefinition('isBootBusy') + '\n' +
    originalDefinition('isTerritoryBusy') + '\n' +
    originalDefinition('isTerritoryMapReady') + '\n' +
    originalDefinition('selectedTerritoryId') + '\n' +
    originalDefinition('selectedCatalogCategory') + '\n' +
    'globalThis.adminHelpers = { isBootBusy, isTerritoryBusy, isTerritoryMapReady, selectedTerritoryId, selectedCatalogCategory };',
    f.context
  );
  assert.equal(f.context.adminHelpers.isBootBusy(), false);
  assert.equal(f.context.adminHelpers.isTerritoryBusy(), false);
  assert.equal(f.context.adminHelpers.isTerritoryMapReady(), false);
  assert.equal(f.context.adminHelpers.selectedTerritoryId(), null);
  assert.equal(f.context.adminHelpers.selectedCatalogCategory(), 'items');
});
