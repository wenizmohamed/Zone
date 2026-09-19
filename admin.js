const ACTIVE_CACHE = 'zone.platform.activeRelease';
const PREVIEW_CACHE = 'zone.platform.previewRelease';

const state = {
  auth: null,
  csrfToken: '',
  language: localStorage.getItem('zone.admin.language') === 'ar' ? 'ar' : 'en',
  view: 'overview',
  engine: null,
  modules: [],
  themes: [],
  crimes: [],
  audit: [],
  ledger: [],
  events: [],
  draft: null,
  releases: [],
  selectedPage: null,
  selectedCrime: null,
  dirty: false,
};

const translations = {
  en: {
    controlPlane: 'ADMIN CONTROL PLANE', engine: 'Engine', game: 'Open game', publish: 'Publish release', sourceOwned: 'FULL SOURCE OWNERSHIP',
    overview: 'Platform overview', overviewSub: 'One control plane for the engine, modules, content, releases, and the live game.', releaseHistory: 'Release history', publishPipeline: 'Publishing pipeline', systemHealth: 'System health', recentEvents: 'Recent events',
    builder: 'Page builder', builderSub: 'Build bilingual responsive game pages from engine-registered blocks.', saveDraft: 'Save draft', preview: 'Refresh preview', pages: 'Pages', choosePage: 'Choose a page or create a new one.', titleEnglish: 'Title in English', titleArabic: 'Title in Arabic', slug: 'Slug', enabledInGame: 'Enabled in game', blocks: 'Registered blocks', addBlock: 'Add block', livePreview: 'Draft preview',
    modules: 'Module manager', modulesSub: 'Install, update, enable, disable, and inspect independent game systems.', content: 'Game content', contentSub: 'Create and balance server-authoritative crimes and release-bound player content.', crimeCatalog: 'Crime catalog', contentDomains: 'Content domains', newCrime: 'New crime', crimeEditor: 'Crime editor', crimeId: 'Crime ID', crimeNameEn: 'English name', crimeNameAr: 'Arabic name', nerveCost: 'Nerve cost', successRate: 'Success percent', cashMinimum: 'Cash minimum', cashMaximum: 'Cash maximum', xpReward: 'XP reward', saveCrime: 'Save crime', domainEvents: 'Domain events', adminAudit: 'Admin audit',
    themes: 'Theme studio', themesSub: 'Change the presentation layer without changing game rules or player state.', releaseBranding: 'Release branding', brandEnglish: 'Brand in English', brandArabic: 'Brand in Arabic', accent: 'Accent color', announcementEnabled: 'Announcement enabled', announcementEnglish: 'Announcement in English', announcementArabic: 'Announcement in Arabic',
    assets: 'Asset library', assetsSub: 'One typed registry for images, thumbnails, animation, video, GLB, and GLTF.', economy: 'Economy and balance', economySub: 'Every reward and transfer is traceable through an immutable correlation trail.', economyLedger: 'Economy ledger', sharedSystems: 'Shared systems', events: 'Events and hooks', eventsSub: 'Modules react through contracts without editing the originating system.', releases: 'Releases and rollback', releasesSub: 'Draft changes, validate them, publish an immutable snapshot, and restore any prior release.', apiTrace: 'API trace',
  },
  ar: {
    controlPlane: 'لوحة تحكم الإدارة', engine: 'المحرك', game: 'افتح اللعبة', publish: 'انشر الإصدار', sourceOwned: 'ملكية كاملة للسورس',
    overview: 'نظرة عامة على المنصة', overviewSub: 'لوحة واحدة للمحرك والموديولات والمحتوى والإصدارات واللعبة المباشرة.', releaseHistory: 'سجل الإصدارات', publishPipeline: 'مسار النشر', systemHealth: 'حالة النظام', recentEvents: 'آخر الأحداث',
    builder: 'مصمم الصفحات', builderSub: 'أنشئ صفحات عربية وإنجليزية متجاوبة من بلوكات مسجلة في المحرك.', saveDraft: 'حفظ المسودة', preview: 'تحديث المعاينة', pages: 'الصفحات', choosePage: 'اختر صفحة أو أنشئ صفحة جديدة.', titleEnglish: 'العنوان بالإنجليزية', titleArabic: 'العنوان بالعربية', slug: 'المسار', enabledInGame: 'مفعلة داخل اللعبة', blocks: 'البلوكات المسجلة', addBlock: 'إضافة بلوك', livePreview: 'معاينة المسودة',
    modules: 'إدارة الموديولات', modulesSub: 'ركب وحدث وفعل وعطل أنظمة اللعبة المستقلة.', content: 'محتوى اللعبة', contentSub: 'أنشئ ووازن الجرائم المحسوبة في السيرفر والمحتوى المرتبط بالإصدار.', crimeCatalog: 'كتالوج الجرائم', contentDomains: 'مجالات المحتوى', newCrime: 'جريمة جديدة', crimeEditor: 'محرر الجرائم', crimeId: 'معرف الجريمة', crimeNameEn: 'الاسم بالإنجليزية', crimeNameAr: 'الاسم بالعربية', nerveCost: 'تكلفة الأعصاب', successRate: 'نسبة النجاح', cashMinimum: 'أقل مكافأة', cashMaximum: 'أعلى مكافأة', xpReward: 'مكافأة الخبرة', saveCrime: 'حفظ الجريمة', domainEvents: 'أحداث النطاق', adminAudit: 'سجل الإدارة',
    themes: 'استوديو الثيمات', themesSub: 'غير طبقة العرض من دون تغيير قوانين اللعب أو بيانات اللاعب.', releaseBranding: 'هوية الإصدار', brandEnglish: 'الاسم بالإنجليزية', brandArabic: 'الاسم بالعربية', accent: 'لون الهوية', announcementEnabled: 'تفعيل الإعلان', announcementEnglish: 'الإعلان بالإنجليزية', announcementArabic: 'الإعلان بالعربية',
    assets: 'مكتبة الملفات', assetsSub: 'سجل موحد للصور والمصغرات والأنيميشن والفيديو و GLB و GLTF.', economy: 'الاقتصاد والتوازن', economySub: 'كل مكافأة وتحويل قابل للتتبع عبر سجل ومعرف ترابط.', economyLedger: 'سجل الاقتصاد', sharedSystems: 'الأنظمة المشتركة', events: 'الأحداث والـ Hooks', eventsSub: 'الموديولات تتفاعل عبر عقود من دون تعديل النظام الأصلي.', releases: 'الإصدارات والرجوع', releasesSub: 'عدّل المسودة وافحصها وانشر نسخة ثابتة وارجع لأي إصدار سابق.', apiTrace: 'تتبع الـ API',
  },
};

const navItems = [
  ['overview', '01', 'Overview', 'نظرة عامة'], ['builder', '02', 'Page Builder', 'مصمم الصفحات'], ['modules', '03', 'Modules', 'الموديولات'],
  ['content', '04', 'Content', 'المحتوى'], ['themes', '05', 'Themes', 'الثيمات'], ['assets', '06', 'Assets', 'الملفات'],
  ['economy', '07', 'Economy', 'الاقتصاد'], ['events', '08', 'Events', 'الأحداث'], ['releases', '09', 'Releases', 'الإصدارات'],
];

const contentDomains = [
  ['Items', 'Weapons, armor, medical, boosters'], ['Crimes', 'Odds, nerve, rewards, outcomes'], ['Cities', 'Travel, maps, availability'],
  ['Jobs', 'Ranks, wages, perks'], ['Education', 'Courses, duration, bonuses'], ['Factions', 'Wars, upgrades, territory'],
  ['Market', 'Listings, fees, transfers'], ['Combat', 'Opponents, weapons, results'], ['Missions', 'Objectives, conditions, rewards'],
];

const assets = [
  ['WEBP', 'Crime artwork', 'Responsive image and thumbnail variants'], ['AVIF', 'City environments', 'High-efficiency scene delivery'],
  ['SVG', 'Interface icon system', 'Theme-aware vector assets'], ['MP4', 'Animated story content', 'Streaming video asset'],
  ['GLB', 'Character model', 'Compressed 3D model with animation'], ['GLTF', 'Weapon catalogue', 'Materials, meshes, and metadata'],
];

const resources = [
  ['Energy', 'Actions, combat, training'], ['Nerve', 'Crime attempts and regeneration'], ['Life', 'Combat health and recovery'],
  ['Happiness', 'Training multiplier and property cap'], ['Cooldowns', 'Shared time-based restrictions'], ['Buffs', 'Typed temporary and permanent modifiers'],
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const t = (key) => translations[state.language][key] ?? translations.en[key] ?? key;
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const localized = (value) => value?.[state.language] ?? value?.en ?? '';
const stamp = () => new Date().toLocaleTimeString();

function notify(message, bad = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('bad', bad);
  toast.classList.add('show');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function trace(method, path, payload, response, status = 200) {
  const target = $('#apiTrace');
  if (!target) return;
  const request = payload ? `\n> ${JSON.stringify(payload, null, 2)}` : '';
  target.textContent = `[${stamp()}] ${method} ${path}${request}\n< ${status} ${JSON.stringify(response, null, 2)}\n\n${target.textContent}`;
}

async function api(path, options = {}) {
  const method = options.method ?? 'GET';
  const payload = options.body ? JSON.parse(options.body) : null;
  const headers = { Accept: 'application/json', ...(options.headers ?? {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  if (state.csrfToken && !['GET', 'HEAD', 'OPTIONS'].includes(method)) headers['X-Zone-CSRF-Token'] = state.csrfToken;
  const response = await fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers,
  });
  const data = await response.json().catch(() => ({ error: `Non-JSON response from ${path}` }));
  trace(method, path, payload, data, response.status);
  if (response.status === 401) showLogin('Your admin session has expired. Sign in again.');
  if (!response.ok) throw new Error(data.error ?? `${response.status} ${response.statusText}`);
  return data;
}

function showLogin(message = '') {
  state.auth = null;
  state.csrfToken = '';
  document.body.classList.remove('auth-pending', 'authenticated');
  document.body.classList.add('auth-required');
  $('#loginError').textContent = message;
  $('#loginPassword').value = '';
  $('#loginUsername').focus();
}

function showAdmin(session) {
  state.auth = session;
  state.csrfToken = session.csrfToken;
  document.body.classList.remove('auth-pending', 'auth-required');
  document.body.classList.add('authenticated');
  $('#loginError').textContent = '';
}

async function authenticate() {
  const response = await fetch('/api/v1/admin/auth', { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
  const session = await response.json().catch(() => ({ authenticated: false }));
  if (!response.ok || !session.authenticated) {
    showLogin();
    return false;
  }
  showAdmin(session);
  return true;
}

async function signIn(event) {
  event.preventDefault();
  const button = $('#loginButton');
  button.disabled = true;
  $('#loginError').textContent = '';
  try {
    const response = await fetch('/api/v1/admin/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username: $('#loginUsername').value, password: $('#loginPassword').value }),
    });
    const session = await response.json().catch(() => ({ error: 'The authentication service returned an invalid response.' }));
    if (!response.ok || !session.authenticated) throw new Error(session.error ?? 'Sign in failed.');
    showAdmin(session);
    await load();
  } catch (error) {
    showLogin(error.message);
  } finally {
    button.disabled = false;
  }
}

async function signOut() {
  try {
    await api('/api/v1/admin/auth/logout', { method: 'POST', body: '{}' });
  } finally {
    showLogin('Signed out securely.');
  }
}

function deepCopy(value) { return JSON.parse(JSON.stringify(value)); }
function currentManifest() { return state.draft?.manifest; }
function markDirty() { state.dirty = true; $('#pipelineStatus').textContent = state.language === 'ar' ? 'مسودة معدلة' : 'DRAFT CHANGED'; $('#pipelineStatus').className = 'status warn'; updatePreviewCache(); }

function applyLanguage() {
  const arabic = state.language === 'ar';
  document.documentElement.lang = state.language;
  document.documentElement.dir = arabic ? 'rtl' : 'ltr';
  $('#languageButton').textContent = arabic ? 'English' : 'العربية';
  $$('[data-copy]').forEach((element) => { element.textContent = t(element.dataset.copy); });
  renderAll();
}

function renderNavigation() {
  $('#adminNav').innerHTML = navItems.map(([id, number, en, ar]) => `<button class="nav-button ${state.view === id ? 'active' : ''}" type="button" data-nav="${id}"><span>${number}</span><b>${state.language === 'ar' ? ar : en}</b></button>`).join('');
  $$('[data-nav]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.nav)));
}

function setView(view) {
  state.view = view;
  $$('.view').forEach((element) => element.classList.toggle('active', element.dataset.view === view));
  renderNavigation();
  if (view === 'builder') refreshPreview();
}

function renderOverview() {
  const activeRelease = state.engine?.activeReleaseVersion ?? 0;
  const enabledModules = state.modules.filter((module) => module.installed && module.enabled).length;
  const metrics = [
    ['ENGINE', state.engine?.version ?? '...', 'server authoritative'], ['ACTIVE RELEASE', `v${activeRelease}`, state.engine?.activeReleaseId ?? 'foundation'],
    ['MODULES', `${enabledModules}/${state.modules.length}`, 'enabled packages'], ['CONTENT', state.crimes.length, 'crime definitions'], ['AUDIT EVENTS', state.events.length, 'recent hooks'],
  ];
  $('#metrics').innerHTML = metrics.map(([label, value, detail]) => `<article class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></article>`).join('');
  const steps = state.language === 'ar'
    ? [['01', 'مسودة', 'تعديلات معزولة'], ['02', 'فحص', 'Schema واعتماديات'], ['03', 'معاينة', 'Desktop و Mobile'], ['04', 'نشر', 'نسخة ثابتة'], ['05', 'اللعبة', 'تقرأ الإصدار النشط']]
    : [['01', 'Draft', 'Isolated changes'], ['02', 'Validate', 'Schema and dependencies'], ['03', 'Preview', 'Desktop and mobile'], ['04', 'Publish', 'Immutable snapshot'], ['05', 'Game', 'Loads active release']];
  $('#pipeline').innerHTML = steps.map(([number, label, detail]) => `<article class="pipeline-step"><span>${number}</span><strong>${esc(label)}</strong><small>${esc(detail)}</small></article>`).join('');
  const health = [
    ['PHP runtime', state.engine?.php ?? '...'], ['Database adapter', state.engine?.database?.toUpperCase() ?? '...'], ['Cache adapter', state.engine?.cacheAdapter?.toUpperCase() ?? '...'],
    ['API', state.engine?.api?.toUpperCase() ?? '...'], ['Player authority', state.engine?.serverAuthoritative ? 'SERVER' : 'UNKNOWN'],
  ];
  $('#healthList').innerHTML = health.map(([label, value]) => `<div class="health-row"><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join('');
  $('#overviewEvents').innerHTML = state.events.slice(0, 7).map((event) => `<div class="compact-row"><div><code>${esc(event.event_name)}</code><small>${esc(event.occurred_at)}</small></div></div>`).join('') || `<div class="empty-state">${state.language === 'ar' ? 'لا توجد أحداث بعد' : 'No events yet'}</div>`;
}

function bindManifestInputs() {
  const manifest = currentManifest();
  if (!manifest) return;
  const bindings = [
    ['#brandEn', () => manifest.branding.name.en, (value) => { manifest.branding.name.en = value; }],
    ['#brandAr', () => manifest.branding.name.ar, (value) => { manifest.branding.name.ar = value; }],
    ['#accentColor', () => manifest.branding.accent, (value) => { manifest.branding.accent = value; }],
    ['#announcementEn', () => manifest.announcement.text.en, (value) => { manifest.announcement.text.en = value; }],
    ['#announcementAr', () => manifest.announcement.text.ar, (value) => { manifest.announcement.text.ar = value; }],
  ];
  bindings.forEach(([selector, getter, setter]) => {
    const input = $(selector);
    if (!input) return;
    input.value = getter();
    input.oninput = () => { setter(input.value); markDirty(); renderOverview(); };
  });
  $('#announcementEnabled').checked = manifest.announcement.enabled;
  $('#announcementEnabled').onchange = () => { manifest.announcement.enabled = $('#announcementEnabled').checked; markDirty(); };
}

function renderBuilder() {
  const manifest = currentManifest();
  if (!manifest) return;
  const pages = manifest.pages;
  if (state.selectedPage && !pages.some((page) => page.id === state.selectedPage)) state.selectedPage = null;
  $('#pageList').innerHTML = pages.map((page) => `<button class="page-item ${state.selectedPage === page.id ? 'active' : ''}" type="button" data-page-id="${esc(page.id)}"><strong>${esc(localized(page.title))}</strong><small>/${esc(page.slug)} · ${page.blocks.length} BLOCKS</small></button>`).join('') || `<div class="empty-state">${state.language === 'ar' ? 'لا توجد صفحات مخصصة' : 'No custom pages yet'}</div>`;
  $$('[data-page-id]').forEach((button) => button.addEventListener('click', () => { state.selectedPage = button.dataset.pageId; renderBuilder(); }));
  const page = pages.find((item) => item.id === state.selectedPage);
  $('#pageEditorEmpty').hidden = Boolean(page);
  $('#pageEditor').hidden = !page;
  if (!page) return;
  $('#pageTitleEn').value = page.title.en;
  $('#pageTitleAr').value = page.title.ar;
  $('#pageSlug').value = page.slug;
  $('#pageEnabled').checked = page.enabled;
  $('#pageTitleEn').oninput = () => { page.title.en = $('#pageTitleEn').value; markDirty(); renderPageListOnly(); };
  $('#pageTitleAr').oninput = () => { page.title.ar = $('#pageTitleAr').value; markDirty(); renderPageListOnly(); };
  $('#pageSlug').oninput = () => { page.slug = slugify($('#pageSlug').value); $('#pageSlug').value = page.slug; markDirty(); renderPageListOnly(); };
  $('#pageEnabled').onchange = () => { page.enabled = $('#pageEnabled').checked; syncNavigation(); markDirty(); };
  $('#blockList').innerHTML = page.blocks.map((block, index) => `<article class="block-card" data-block-id="${esc(block.id)}"><div class="block-card-head"><code>${esc(block.type)}</code><button class="icon-button" data-move="up" data-index="${index}" type="button">↑</button><button class="icon-button" data-move="down" data-index="${index}" type="button">↓</button><button class="icon-button" data-remove-block="${index}" type="button">×</button></div><div class="block-fields"><label>English<textarea rows="3" data-block-lang="en" data-index="${index}">${esc(block.content.en)}</textarea></label><label>العربية<textarea rows="3" dir="rtl" data-block-lang="ar" data-index="${index}">${esc(block.content.ar)}</textarea></label></div></article>`).join('') || `<div class="empty-state">${state.language === 'ar' ? 'أضف أول بلوك مسجل' : 'Add the first registered block'}</div>`;
  $$('[data-block-lang]').forEach((input) => input.addEventListener('input', () => { page.blocks[Number(input.dataset.index)].content[input.dataset.blockLang] = input.value; markDirty(); }));
  $$('[data-remove-block]').forEach((button) => button.addEventListener('click', () => { page.blocks.splice(Number(button.dataset.removeBlock), 1); markDirty(); renderBuilder(); }));
  $$('[data-move]').forEach((button) => button.addEventListener('click', () => moveBlock(page, Number(button.dataset.index), button.dataset.move === 'up' ? -1 : 1)));
}

function renderPageListOnly() {
  const selected = state.selectedPage;
  const pages = currentManifest().pages;
  $('#pageList').innerHTML = pages.map((page) => `<button class="page-item ${selected === page.id ? 'active' : ''}" type="button" data-page-id="${esc(page.id)}"><strong>${esc(localized(page.title))}</strong><small>/${esc(page.slug)} · ${page.blocks.length} BLOCKS</small></button>`).join('');
  $$('[data-page-id]').forEach((button) => button.addEventListener('click', () => { state.selectedPage = button.dataset.pageId; renderBuilder(); }));
}

function slugify(value) { return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || `page-${Date.now().toString(36)}`; }
function syncNavigation() {
  const manifest = currentManifest();
  const base = manifest.navigation.filter((id) => !manifest.pages.some((page) => page.id === id));
  manifest.navigation = [...base, ...manifest.pages.filter((page) => page.enabled).map((page) => page.id)];
}
function moveBlock(page, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= page.blocks.length) return;
  [page.blocks[index], page.blocks[target]] = [page.blocks[target], page.blocks[index]];
  markDirty();
  renderBuilder();
}
function addPage() {
  const manifest = currentManifest();
  const id = `page-${Date.now().toString(36)}`;
  manifest.pages.push({ id, slug: id, enabled: true, title: { en: 'New page', ar: 'صفحة جديدة' }, blocks: [{ id: `hero-${Date.now().toString(36)}`, type: 'hero', content: { en: 'Built from the ZONE Admin Control Plane', ar: 'تم إنشاؤها من لوحة تحكم ZONE' } }] });
  manifest.navigation.push(id);
  state.selectedPage = id;
  markDirty();
  renderBuilder();
}
function addBlock() {
  const page = currentManifest().pages.find((item) => item.id === state.selectedPage);
  if (!page) return;
  const type = $('#blockTypeSelect').value;
  page.blocks.push({ id: `${type}-${Date.now().toString(36)}`, type, content: { en: `${type} block`, ar: `بلوك ${type}` } });
  markDirty();
  renderBuilder();
}

function renderModules() {
  $('#moduleGrid').innerHTML = state.modules.map((module) => {
    const status = !module.installed ? 'UNINSTALLED' : module.enabled ? 'ENABLED' : 'DISABLED';
    const actions = !module.installed
      ? `<button class="button secondary" data-module-action="install" data-module-id="${esc(module.id)}">INSTALL</button>`
      : `<button class="button secondary" data-module-action="${module.enabled ? 'disable' : 'enable'}" data-module-id="${esc(module.id)}">${module.enabled ? 'DISABLE' : 'ENABLE'}</button><button class="button danger" data-module-action="uninstall" data-module-id="${esc(module.id)}">UNINSTALL</button>`;
    return `<article class="catalog-card"><div class="catalog-card-head"><div><h2>${esc(module.name)}</h2><code>${esc(module.id)}@${esc(module.version)}</code></div><span class="status ${module.enabled ? 'active' : ''}">${status}</span></div><p>${esc(state.language === 'ar' ? module.description_ar : module.description)}</p><div class="chips">${[...module.provides, ...module.subscribes.map((name) => `on:${name}`)].map((name) => `<span>${esc(name)}</span>`).join('')}</div><div class="card-actions">${actions}</div></article>`;
  }).join('');
  $$('[data-module-action]').forEach((button) => button.addEventListener('click', () => mutateModule(button.dataset.moduleId, button.dataset.moduleAction)));
}

function renderThemes() {
  $('#themeGrid').innerHTML = state.themes.map((theme) => `<article class="catalog-card"><div class="catalog-card-head"><div><h2>${esc(theme.name)}</h2><code>${esc(theme.id)}@${esc(theme.version)}</code></div><span class="status ${theme.active ? 'active' : ''}">${theme.active ? 'ACTIVE' : 'AVAILABLE'}</span></div><p>${esc(state.language === 'ar' ? theme.description_ar : theme.description)}</p><div class="chips"><span>VIEW PACKAGE</span><span>RTL</span><span>LTR</span><span>NO GAME LOGIC</span></div><div class="card-actions"><button class="button secondary" type="button" data-theme-id="${esc(theme.id)}" ${theme.active ? 'disabled' : ''}>${theme.active ? 'ACTIVE' : 'ACTIVATE'}</button></div></article>`).join('');
  $$('[data-theme-id]').forEach((button) => button.addEventListener('click', () => activateTheme(button.dataset.themeId)));
  bindManifestInputs();
}

function renderContent() {
  const header = `<div class="table-row header"><span>Crime</span><span>Nerve</span><span>Success</span><span>Cash</span><span>XP</span><span>Action</span></div>`;
  $('#crimeTable').innerHTML = header + state.crimes.map((crime) => `<div class="table-row ${crime.enabled ? '' : 'disabled'}"><strong>${esc(state.language === 'ar' ? crime.name_ar : crime.name_en)}<small>${crime.enabled ? '' : ' · DISABLED'}</small></strong><code>${crime.nerve_cost}</code><code>${crime.successRate}%</code><code>${Number(crime.cash_min).toLocaleString()} - ${Number(crime.cash_max).toLocaleString()}</code><code>${crime.xp_reward}</code><button class="button ghost" type="button" data-edit-crime="${esc(crime.id)}">EDIT</button></div>`).join('');
  $$('[data-edit-crime]').forEach((button) => button.addEventListener('click', () => { state.selectedCrime = button.dataset.editCrime; renderContent(); }));
  $('#contentDomains').innerHTML = contentDomains.map(([name, detail]) => `<div class="domain"><strong>${esc(name)}</strong><span>${esc(detail)}</span></div>`).join('');
  const crime = state.crimes.find((item) => item.id === state.selectedCrime) ?? null;
  $('#crimeEditorStatus').textContent = crime ? 'EDIT' : 'NEW';
  $('#crimeEditorStatus').className = `status ${crime?.enabled ? 'active' : ''}`;
  $('#crimeId').value = crime?.id ?? '';
  $('#crimeId').disabled = Boolean(crime);
  $('#crimeNameEn').value = crime?.name_en ?? '';
  $('#crimeNameAr').value = crime?.name_ar ?? '';
  $('#crimeNerve').value = crime?.nerve_cost ?? 2;
  $('#crimeSuccess').value = crime?.successRate ?? 75;
  $('#crimeCashMin').value = crime?.cash_min ?? 100;
  $('#crimeCashMax').value = crime?.cash_max ?? 250;
  $('#crimeXp').value = crime?.xp_reward ?? 10;
  $('#crimeEnabled').checked = crime?.enabled ?? true;
}

function renderAssets() {
  $('#assetGrid').innerHTML = assets.map(([type, name, detail]) => `<article class="asset-card" data-type="${esc(type)}"><span class="asset-icon">${esc(type.slice(0, 2))}</span><div><strong>${esc(name)}</strong><span>${esc(detail)}</span></div></article>`).join('');
}

function renderEconomy() {
  const header = `<div class="table-row header"><span>Reason</span><span>Amount</span><span>Balance</span><span>Player</span><span>Correlation</span></div>`;
  $('#ledgerTable').innerHTML = header + (state.ledger.map((entry) => `<div class="table-row"><strong>${esc(entry.reason)}</strong><code>+${Number(entry.amount).toLocaleString()} ${esc(entry.asset)}</code><code>${Number(entry.balance_after).toLocaleString()}</code><code>${esc(entry.player_id)}</code><code>${esc(entry.correlation_id)}</code></div>`).join('') || `<div class="empty-state">Run a server proof in the Engine to generate a ledger entry.</div>`);
  $('#resourceGrid').innerHTML = resources.map(([name, detail]) => `<div class="domain"><strong>${esc(name)}</strong><span>${esc(detail)}</span></div>`).join('');
}

function renderEvents() {
  const header = `<div class="table-row header"><span>Event</span><span>Time</span><span>Module</span><span>Correlation</span><span>Payload</span></div>`;
  $('#eventTable').innerHTML = header + (state.events.map((event) => `<div class="table-row"><strong>${esc(event.event_name)}</strong><code>${esc(event.occurred_at)}</code><code>EVENT BUS</code><code>${esc(event.payload?.correlationId ?? event.id)}</code><code>${esc(JSON.stringify(event.payload))}</code></div>`).join('') || `<div class="empty-state">No engine events have been emitted yet.</div>`);
  $('#auditList').innerHTML = state.audit.map((entry) => `<article class="audit-entry"><strong>${esc(entry.action)} · ${esc(entry.target_type)}</strong><code>${esc(entry.target_id)}</code><small>${esc(entry.actor)} · ${esc(entry.created_at)}</small><small>${esc(entry.correlation_id)}</small></article>`).join('') || `<div class="empty-state">No administrator mutations have been recorded yet.</div>`;
}

function renderReleases() {
  $('#releaseList').innerHTML = state.releases.map((release) => `<article class="release-card ${release.active ? 'active' : ''}"><span class="release-version">v${release.version}</span><div><strong>${esc(release.manifest.branding.name[state.language] ?? release.manifest.branding.name.en)}</strong><small>${esc(release.id)} · ${esc(release.publishedAt ?? '')}</small></div>${release.active ? '<span class="status active">ACTIVE</span>' : `<button class="button secondary" type="button" data-activate-release="${esc(release.id)}">ROLL BACK</button>`}</article>`).join('') || `<div class="empty-state">${state.language === 'ar' ? 'لم يتم نشر أي إصدار بعد' : 'No release has been published yet'}</div>`;
  $$('[data-activate-release]').forEach((button) => button.addEventListener('click', () => activateRelease(button.dataset.activateRelease)));
}

function renderAll() {
  renderNavigation();
  renderOverview();
  renderBuilder();
  renderModules();
  renderThemes();
  renderContent();
  renderAssets();
  renderEconomy();
  renderEvents();
  renderReleases();
}

function updatePreviewCache() {
  if (!state.draft) return;
  localStorage.setItem(PREVIEW_CACHE, JSON.stringify({ id: 'draft-preview', version: 'draft', manifest: state.draft.manifest, active: false, publishedBy: state.auth?.user?.username ?? 'admin', publishedAt: new Date().toISOString() }));
}

function refreshPreview() {
  updatePreviewCache();
  const frame = $('#previewFrame');
  frame.src = `/?zone-preview=1&v=${Date.now()}`;
}

async function saveDraft() {
  try {
    const response = await api('/api/v1/admin/draft', { method: 'PUT', body: JSON.stringify({ manifest: currentManifest() }) });
    state.draft = response;
    state.dirty = false;
    $('#pipelineStatus').textContent = state.language === 'ar' ? 'تم حفظ المسودة' : 'DRAFT SAVED';
    $('#pipelineStatus').className = 'status good';
    updatePreviewCache();
    notify(state.language === 'ar' ? 'تم حفظ المسودة من دون تغيير اللعبة المباشرة' : 'Draft saved without changing the live game');
    renderAll();
    return true;
  } catch (error) {
    notify(error.message, true);
    return false;
  }
}

async function publishRelease() {
  try {
    if (state.dirty && !(await saveDraft())) return;
    const release = await api('/api/v1/admin/releases/publish', { method: 'POST', body: '{}' });
    localStorage.setItem(ACTIVE_CACHE, JSON.stringify(release));
    localStorage.removeItem(PREVIEW_CACHE);
    state.releases = [release, ...state.releases.filter((item) => item.id !== release.id).map((item) => ({ ...item, active: false }))];
    state.engine.activeReleaseId = release.id;
    state.engine.activeReleaseVersion = release.version;
    $('#runtimeRelease').textContent = `RELEASE ${release.version}`;
    notify(`${state.language === 'ar' ? 'تم نشر الإصدار' : 'Published release'} v${release.version}`);
    renderAll();
    refreshPreview();
  } catch (error) { notify(error.message, true); }
}

async function activateRelease(id) {
  try {
    const release = await api(`/api/v1/admin/releases/${encodeURIComponent(id)}/activate`, { method: 'POST', body: '{}' });
    localStorage.setItem(ACTIVE_CACHE, JSON.stringify(release));
    state.releases = state.releases.map((item) => ({ ...item, active: item.id === release.id }));
    state.engine.activeReleaseId = release.id;
    state.engine.activeReleaseVersion = release.version;
    $('#runtimeRelease').textContent = `RELEASE ${release.version}`;
    notify(`${state.language === 'ar' ? 'تم الرجوع إلى الإصدار' : 'Rolled back to release'} v${release.version}`);
    renderAll();
    refreshPreview();
  } catch (error) { notify(error.message, true); }
}

async function mutateModule(id, action) {
  try {
    await api(`/api/v1/admin/modules/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: '{}' });
    const response = await api('/api/v1/modules');
    state.modules = response.modules;
    notify(`${id}: ${action}`);
    renderAll();
  } catch (error) { notify(error.message, true); }
}

function newCrime() {
  state.selectedCrime = null;
  renderContent();
  $('#crimeId').focus();
}

async function saveCrime(event) {
  event.preventDefault();
  const id = slugify($('#crimeId').value);
  const definition = {
    name_en: $('#crimeNameEn').value.trim(),
    name_ar: $('#crimeNameAr').value.trim(),
    nerve_cost: Number($('#crimeNerve').value),
    success_basis_points: Math.round(Number($('#crimeSuccess').value) * 100),
    cash_min: Number($('#crimeCashMin').value),
    cash_max: Number($('#crimeCashMax').value),
    xp_reward: Number($('#crimeXp').value),
    enabled: $('#crimeEnabled').checked,
  };
  const button = $('#saveCrimeButton');
  button.disabled = true;
  try {
    const response = await api(`/api/v1/admin/crimes/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(definition) });
    state.crimes = [...state.crimes.filter((crime) => crime.id !== response.crime.id), response.crime]
      .sort((left, right) => left.nerve_cost - right.nerve_cost || left.id.localeCompare(right.id));
    state.selectedCrime = response.crime.id;
    const [events, audit] = await Promise.all([api('/api/v1/events'), api('/api/v1/admin/audit')]);
    state.events = events.events;
    state.audit = audit.entries;
    notify(state.language === 'ar' ? 'تم حفظ الجريمة في المحرك' : 'Crime saved to the engine');
    renderAll();
  } catch (error) {
    notify(error.message, true);
  } finally {
    button.disabled = false;
  }
}

async function activateTheme(id) {
  try {
    await api(`/api/v1/admin/themes/${encodeURIComponent(id)}/activate`, { method: 'POST', body: '{}' });
    const response = await api('/api/v1/themes');
    state.themes = response.themes;
    notify(`${id}: active`);
    renderAll();
  } catch (error) { notify(error.message, true); }
}

async function load() {
  const [engine, modules, themes, crimes, ledger, events, audit, draft, releases] = await Promise.all([
    api('/api/v1/engine'), api('/api/v1/modules'), api('/api/v1/themes'), api('/api/v1/admin/crimes'), api('/api/v1/ledger'), api('/api/v1/events'), api('/api/v1/admin/audit'), api('/api/v1/admin/draft'), api('/api/v1/admin/releases'),
  ]);
  Object.assign(state, {
    engine,
    modules: modules.modules,
    themes: themes.themes,
    crimes: crimes.crimes,
    ledger: ledger.entries,
    events: events.events,
    audit: audit.entries,
    draft,
    releases: releases.releases,
  });
  state.selectedCrime = state.crimes[0]?.id ?? null;
  $('#runtimePhp').textContent = `PHP ${engine.php}`;
  $('#runtimeDatabase').textContent = engine.database.toUpperCase();
  $('#runtimeRelease').textContent = `RELEASE ${engine.activeReleaseVersion}`;
  $('#runtimeMode').textContent = engine.database === 'pgsql' ? 'PRODUCTION' : 'LOCAL';
  applyLanguage();
  updatePreviewCache();
}

$('#languageButton').addEventListener('click', () => { state.language = state.language === 'en' ? 'ar' : 'en'; localStorage.setItem('zone.admin.language', state.language); applyLanguage(); });
$('#loginForm').addEventListener('submit', signIn);
$('#logoutButton').addEventListener('click', signOut);
$('#publishButton').addEventListener('click', publishRelease);
$('#releasePublishButton').addEventListener('click', publishRelease);
$('#saveDraftButton').addEventListener('click', saveDraft);
$('#previewButton').addEventListener('click', refreshPreview);
$('#addPageButton').addEventListener('click', addPage);
$('#addBlockButton').addEventListener('click', addBlock);
$('#newCrimeButton').addEventListener('click', newCrime);
$('#crimeForm').addEventListener('submit', saveCrime);
$('#clearTraceButton').addEventListener('click', () => { $('#apiTrace').textContent = 'ZONE ADMIN READY'; });
$$('[data-go]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.go)));
$$('.viewport-button').forEach((button) => button.addEventListener('click', () => { $$('.viewport-button').forEach((item) => item.classList.remove('active')); button.classList.add('active'); $('#previewFrame').style.width = button.dataset.width; }));

authenticate().then((authenticated) => {
  if (!authenticated) return;
  return load();
}).catch((error) => {
  trace('BOOT', '/admin', null, { error: error.message }, 500);
  notify(error.message, true);
  $('#pipelineStatus').textContent = 'API ERROR';
  $('#pipelineStatus').className = 'status bad';
});
