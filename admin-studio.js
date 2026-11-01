/* Task-oriented workspace over the existing, guarded Admin controller. */
(function () {
  'use strict';
  const sections = ['overview', 'content', 'builder', 'territories', 'modules', 'themes', 'assets', 'releases', 'economy', 'events'];
  const copy = {
    en: {
      skipToWorkspace: 'Skip to workspace', menu: 'Workspace menu', search: 'Find anything', help: 'Help with this screen', closeNavigation: 'Close workspace menu', workspaceGuide: 'How the Studio works', connectingWorkspace: 'Connecting to your engine', startCreating: 'What would you like to build?', startCreatingHelp: 'Create game content, shape the player experience, or extend your engine. Changes stay in a draft until you publish.', technicalDetails: 'Engine details', technicalDetailsHint: 'Runtime, database and recent activity', previewChanges: 'Preview changes', saveChanges: 'Save changes', searchTitle: 'Find a tool or game definition', closeDialog: 'Close', searchInputLabel: 'Search tools, items, pages and extensions', searchKeyboardHelp: 'Use Tab to choose a result. Escape closes this window.', helpTitle: 'Workspace guide', leaveTitle: 'Keep your crime edits?', leaveMessage: 'You have unsaved crime fields. Choose what happens before opening a different crime.', leaveSave: 'Save and continue', leaveDiscard: 'Discard and continue', leaveStay: 'Keep editing', workspace: 'Workspace', build: 'Build your game', extend: 'Extend the engine', operate: 'Manage & publish', home: 'Start', content: 'Game content', builder: 'Pages & navigation', territories: 'World & territories', modules: 'Extensions', themes: 'Appearance', assets: 'Media library', releases: 'Publish & history', economy: 'Economy records', events: 'Activity & hooks', createItem: 'Create an item', createItemHelp: 'Weapons, medical supplies, boosters and materials.', createPage: 'Create a page', createPageHelp: 'Build a bilingual page and add it to game navigation.', customize: 'Customize appearance', customizeHelp: 'Choose a theme, branding, colors and announcements.', addSystem: 'Explore extensions', addSystemHelp: 'Find and manage the game systems registered in your engine.', crime: 'Crimes', editDefinition: 'Edit definition', newDefinition: 'Create definition', noResults: 'No matching tools or definitions. Try another word.', waiting: 'Waiting for engine data', saving: 'Saving. Your fields are preserved.', unsaved: 'Unsaved edits. Save before publishing.', savedDraft: 'Saved draft. Preview, then publish when ready.', liveRelease: 'Live release', readyDraft: 'Your workspace is ready. Create or edit a draft.', reviewPublish: 'Review & publish', publishNow: 'Publish release', searchExtensions: 'Search extensions', extensionFilter: 'Extension status', allExtensions: 'All registered', installedExtensions: 'Installed', availableExtensions: 'Available to install', disabledExtensions: 'Disabled', extensionsCount: 'extensions', noExtensions: 'No registered extensions match this filter.', extensionsImpact: 'These are registered engine packages, not an external marketplace. Package switches change engine configuration; review the result before publishing game content.', newDraft: 'Resume new draft', contentHelp: 'Choose a content type. Create or edit its fields, save the draft, preview the player screen, then publish.', publishHelp: 'Only saved draft content is included. Publishing creates a version players will see; history lets you restore an earlier release.', previewNeedsSave: 'Save the item or crime fields before previewing them.', saveOtherEdits: 'Other content edits are still unsaved. Open their editor to save them.', pageHelp: '1. Create or select a page. 2. Add its bilingual title and blocks. 3. Save and preview. 4. Publish when ready.', extensionHelp: 'Search registered packages and inspect their version and status. Install and enable are separate steps. A new PHP package must first be registered on the server; this screen does not upload arbitrary code.', appearanceHelp: 'Choose an installed theme or edit the brand, accent and announcement. Theme activation is an engine setting; save and publish release branding separately.', genericHelp: 'Use the grouped navigation to stay in one task. Find anything searches tools and server-loaded definitions. Your language and section remain in the URL, and browser Back returns to the previous section.', futureCollections: 'Content types are discovered from the engine schema.', reviewTitle: 'Before publishing', reviewSaved: 'Save every changed item and crime first.', reviewPreview: 'Preview the relevant player screen.', reviewRelease: 'Publish a version, with release history available for recovery.', permanentId: 'Permanent ID', autoIdHelp: 'Generated from the English name. You can change it before the first save.', pendingEdit: 'Pending edit', preview: 'Preview', saveCrime: 'Save crime', saveItem: 'Save definition', savePages: 'Save page & appearance draft'
    },
    ar: {
      skipToWorkspace: 'انتقل إلى مساحة العمل', menu: 'قائمة مساحة العمل', search: 'ابحث عن أي شيء', help: 'مساعدة هذه الصفحة', closeNavigation: 'أغلق قائمة مساحة العمل', workspaceGuide: 'كيف يعمل الاستوديو', connectingWorkspace: 'جارٍ الاتصال بمحركك', startCreating: 'ماذا تريد أن تبني؟', startCreatingHelp: 'أنشئ محتوى اللعبة، وخصص تجربة اللاعب، ووسع قدرات المحرك. تبقى التعديلات في المسودة إلى أن تنشرها.', technicalDetails: 'تفاصيل المحرك', technicalDetailsHint: 'بيئة التشغيل وقاعدة البيانات والنشاط الأخير', previewChanges: 'عاين التعديلات', saveChanges: 'احفظ التعديلات', searchTitle: 'ابحث عن أداة أو محتوى في اللعبة', closeDialog: 'إغلاق', searchInputLabel: 'ابحث في الأدوات والعناصر والصفحات والإضافات', searchKeyboardHelp: 'استخدم Tab لاختيار النتيجة، وEscape للإغلاق.', helpTitle: 'دليل مساحة العمل', leaveTitle: 'هل تريد الاحتفاظ بتعديلات الجريمة؟', leaveMessage: 'هناك حقول جريمة غير محفوظة. اختر ما يحدث قبل فتح جريمة أخرى.', leaveSave: 'احفظ ثم تابع', leaveDiscard: 'تجاهل ثم تابع', leaveStay: 'واصل التعديل', workspace: 'مساحة العمل', build: 'بناء اللعبة', extend: 'توسيع المحرك', operate: 'الإدارة والنشر', home: 'البداية', content: 'محتوى اللعبة', builder: 'الصفحات والتنقل', territories: 'العالم والأراضي', modules: 'الإضافات', themes: 'المظهر', assets: 'مكتبة الوسائط', releases: 'النشر والسجل', economy: 'سجل الاقتصاد', events: 'النشاط والأحداث', createItem: 'أنشئ عنصراً', createItemHelp: 'أسلحة وعلاج ومعززات ومواد.', createPage: 'أنشئ صفحة', createPageHelp: 'ابنِ صفحة بلغتين وأضفها إلى تنقل اللعبة.', customize: 'خصص المظهر', customizeHelp: 'اختر الثيم والهوية والألوان والإعلانات.', addSystem: 'استعرض الإضافات', addSystemHelp: 'ابحث في أنظمة اللعبة المسجلة في محركك وأدرها.', crime: 'الجرائم', editDefinition: 'عدّل المحتوى', newDefinition: 'أنشئ محتوى', noResults: 'لا توجد أدوات أو عناصر مطابقة. جرب كلمة أخرى.', waiting: 'بانتظار بيانات المحرك', saving: 'جارٍ الحفظ. حقولك محفوظة في المحرر.', unsaved: 'تعديلات غير محفوظة. احفظها قبل النشر.', savedDraft: 'مسودة محفوظة. عاينها ثم انشرها عندما تجهز.', liveRelease: 'الإصدار المباشر', readyDraft: 'مساحة العمل جاهزة. أنشئ مسودة أو عدلها.', reviewPublish: 'راجع وانشر', publishNow: 'انشر الإصدار', searchExtensions: 'ابحث في الإضافات', extensionFilter: 'حالة الإضافة', allExtensions: 'كل الإضافات المسجلة', installedExtensions: 'المثبتة', availableExtensions: 'المتاحة للتثبيت', disabledExtensions: 'المعطلة', extensionsCount: 'إضافة', noExtensions: 'لا توجد إضافات مسجلة تطابق هذا البحث.', extensionsImpact: 'هذه حزم مسجلة في المحرك، وليست متجراً خارجياً. تغيير الحزمة يعدل إعداد المحرك؛ راجع النتيجة قبل نشر محتوى اللعبة.', newDraft: 'واصل المسودة الجديدة', contentHelp: 'اختر نوع المحتوى. أنشئ حقوله أو عدلها، واحفظ المسودة، وعاين صفحة اللاعب، ثم انشر.', publishHelp: 'ينشر المحتوى المحفوظ فقط. ينشئ النشر إصداراً يراه اللاعبون، ويمكنك استعادة إصدار سابق من السجل.', previewNeedsSave: 'احفظ حقول العنصر أو الجريمة قبل معاينتها.', saveOtherEdits: 'توجد تعديلات محتوى أخرى غير محفوظة. افتح محررها واحفظها.', pageHelp: '1. أنشئ صفحة أو اخترها. 2. أضف العنوان والبلوكات بلغتين. 3. احفظ وعاين. 4. انشر عندما تجهز.', extensionHelp: 'ابحث في الحزم المسجلة وراجع الإصدار والحالة. التثبيت والتفعيل خطوتان منفصلتان. يجب تسجيل حزمة PHP الجديدة في الخادم أولاً؛ هذه الصفحة لا ترفع كوداً عشوائياً.', appearanceHelp: 'اختر ثيماً مثبتاً أو عدل الهوية واللون والإعلان. تفعيل الثيم إعداد للمحرك؛ احفظ هوية الإصدار وانشرها بشكل منفصل.', genericHelp: 'استخدم الأقسام المجمعة للتركيز على مهمة واحدة. البحث يشمل الأدوات والمحتوى المحمل من الخادم. تبقى اللغة والقسم في الرابط، ويعيدك زر الرجوع إلى القسم السابق.', futureCollections: 'تُكتشف أنواع المحتوى من مخطط المحرك.', reviewTitle: 'قبل النشر', reviewSaved: 'احفظ كل عنصر وجريمة عدلتهما أولاً.', reviewPreview: 'عاين الصفحة المناسبة للاعب.', reviewRelease: 'انشر إصداراً؛ يظل سجل الإصدارات متاحاً للاستعادة.', permanentId: 'المعرف الدائم', autoIdHelp: 'يتولد من الاسم الإنجليزي. يمكنك تغييره قبل أول حفظ.', pendingEdit: 'تعديل معلق', preview: 'المعاينة', saveCrime: 'احفظ الجريمة', saveItem: 'احفظ المحتوى', savePages: 'احفظ مسودة الصفحات والمظهر'
    }
  };
  const categoryNames = { items: ['Items', 'العناصر'], jobs: ['Jobs', 'الوظائف'], gyms: ['Gyms', 'الأندية'], courses: ['Education', 'التعليم'], properties: ['Properties', 'العقارات'], upgrades: ['Faction upgrades', 'ترقيات العائلات'], opponents: ['Opponents', 'الخصوم'], missions: ['Missions', 'المهام'] };
  const glyphs = { overview: 'M3 10 12 3l9 7v11H3Z M9 21v-8h6v8', content: 'M4 4h16v16H4Z M8 8h8 M8 12h8 M8 16h4', builder: 'M3 3h18v18H3Z M3 8h18 M8 8v13', territories: 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z M9 3v15 M15 6v15', modules: 'M8 3h8v5h5v8h-5v5H8v-5H3V8h5Z', themes: 'M4 4h16v6H4Z M8 10v5h8 M12 15v6', assets: 'M3 3h18v18H3Z m0 14 6-6 4 4 3-3 5 5 M8 7h.01', releases: 'M12 3v12 m-5-5 5 5 5-5 M3 16v5h18v-5', economy: 'M3 5h18v14H3Z M8 9h8 M8 15h8', events: 'M3 12h4l3-8 4 16 3-8h4' };
  glyphs.forward = 'm9 5 7 7-7 7';
  const plain = value => String(value ?? '').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f\u064b-\u065f]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي');
  const route = (search, schema = {}) => { const p = new URLSearchParams(search); const view = sections.includes(p.get('section')) ? p.get('section') : 'overview'; return { view, type: p.get('type') === 'crimes' ? 'crimes' : Object.hasOwn(schema, p.get('type')) ? p.get('type') : null }; };
  const makeId = (name, existing = {}, category = 'item') => {
    const prefix = category.replace(/[^a-z]/g, '') || 'item';
    let base = plain(name).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 54);
    if (base.length < 2) base = prefix + '-new';
    if (!/^[a-z]/.test(base)) base = (prefix + '-' + base).slice(0, 54);
    let id = base, n = 2;
    while (Object.hasOwn(existing, id) || ['constructor', 'prototype', 'fists'].includes(id)) id = base + '-' + n++;
    return id;
  };
  const isSupportedSection = section => sections.includes(String(section ?? ''));
  const categoryLabel = (category, language = 'en') => categoryNames[category]?.[language === 'ar' ? 1 : 0] ?? String(category ?? '');
  const isReservedCatalogId = id => ['constructor', 'prototype', 'fists'].includes(String(id ?? ''));
  const supportedCategoryIds = () => Object.keys(categoryNames);
  const helpers = { sections, isSupportedSection, categoryLabel, isReservedCatalogId, supportedCategoryIds, normalize: plain, route, makeId, copy, categoryNames };
  if (typeof window === 'undefined' || typeof state === 'undefined') { globalThis.ZoneStudioHelpers = helpers; return; }
  const q = selector => document.querySelector(selector), qa = selector => [...document.querySelectorAll(selector)];
  const tr = key => copy[state.language]?.[key] ?? copy.en[key] ?? key;
  const catName = id => categoryNames[id]?.[state.language === 'ar' ? 1 : 0] ?? state.gameplayCatalog?.schema?.[id]?.label?.[state.language] ?? id.replace(/[_-]/g, ' ');
  const svg = id => `<svg class="studio-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${glyphs[id] || glyphs.content}"></path></svg>`;
  let contentMode = 'items', handlingHistory = false, initialized = false, searchEntries = [], dialogReturnFocus = null, pendingCrimeAction = null, initialRequestedType = null;
  const resume = new Map(), automaticIds = new Map();
  let moduleQuery = '', moduleFilter = 'all';
  const canonical = value => JSON.stringify((function ordered(v) { return Array.isArray(v) ? v.map(ordered) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(key => [key, ordered(v[key])])) : v; })(value));
  function publicationContent(content) {
    const crimeKeys = ['id', 'name_en', 'name_ar', 'nerve_cost', 'success_basis_points', 'cash_min', 'cash_max', 'xp_reward', 'level_required', 'enabled'];
    return {
      catalog: content.gameplayCatalog ?? {},
      crimes: (content.crimes ?? []).map(crime => Object.fromEntries(crimeKeys.filter(key => Object.hasOwn(crime, key)).map(key => [key, crime[key]]))).sort((a, b) => String(a.id).localeCompare(String(b.id))),
      modules: (content.engineModules ?? []).map(module => ({ id: module.id, installed: Boolean(module.installed), enabled: Boolean(module.enabled) })).sort((a, b) => a.id.localeCompare(b.id)),
      theme: content.activeTheme ?? null,
    };
  }
  function snapshot() {
    const pending = unsavedContentEdits();
    const pageChanges = state.savedDraftManifest !== null && authoringManifestText(currentManifest()) !== state.savedDraftManifest;
    const active = state.releases?.find(release => release.active);
    const savedDifferent = Boolean(active && state.savedDraftManifest !== null && authoringManifestText(active.manifest) !== state.savedDraftManifest);
    const contentDifferent = Boolean(active?.manifest?.content && canonical(publicationContent(active.manifest.content)) !== canonical(publicationContent({ gameplayCatalog: state.gameplayCatalog?.catalogs, crimes: state.crimes, engineModules: state.modules, activeTheme: state.themes?.find(theme => theme.active)?.id })));
    const counts = {
      catalogEntries: Object.values(state.gameplayCatalog?.catalogs ?? {}).reduce((sum, cat) => sum + Object.keys(cat ?? {}).length, 0),
      crimes: (state.crimes ?? []).length,
      pages: (currentManifest()?.pages ?? []).length,
      enabledModules: (state.modules ?? []).filter(m => m.installed && m.enabled).length
    };
    return { ready: state.bootReady, busy: Boolean(state.controlBusy || state.catalogBusy), pending, pageChanges, unsaved: pageChanges || pending.catalog || pending.crime, awaitingPublication: Boolean(state.dirty || savedDifferent || contentDifferent), view: state.view, language: state.language, counts };
  }
  function renderNavigation() {
    const groups = [['workspace', ['overview']], ['build', ['content', 'builder', 'territories']], ['extend', ['modules', 'themes', 'assets']], ['operate', ['releases', 'economy', 'events']]];
    const target = q('#adminNav'); if (!target) return;
    target.innerHTML = groups.map(([group, views]) => `<div class="studio-nav-group"><span class="studio-nav-group-label">${esc(tr(group))}</span>${views.map(view => `<button class="nav-button ${state.view === view ? 'active' : ''}" type="button" data-nav="${view}" ${state.view === view ? 'aria-current="page"' : ''}>${svg(view)}<b>${esc(tr(view === 'overview' ? 'home' : view))}</b></button>`).join('')}</div>`).join('');
    target.setAttribute('aria-label', tr('menu'));
    target.querySelectorAll('[data-nav]').forEach(button => button.addEventListener('click', () => setView(button.dataset.nav)));
  }
  function setMenu(open) {
    document.body.classList.toggle('studio-menu-open', open);
    q('#studioMenuButton')?.setAttribute('aria-expanded', String(open));
    if (q('#studioNavBackdrop')) q('#studioNavBackdrop').hidden = !open;
    if (q('#studioMenuClose')) q('#studioMenuClose').hidden = !open;
    if (q('#studioWorkspace')) q('#studioWorkspace').inert = open;
    const sidebar = q('#studioSidebar');
    if (sidebar) {
      if (open) { sidebar.setAttribute('role', 'dialog'); sidebar.setAttribute('aria-modal', 'true'); sidebar.setAttribute('aria-label', tr('menu')); }
      else { sidebar.removeAttribute('role'); sidebar.removeAttribute('aria-modal'); sidebar.removeAttribute('aria-label'); }
    }
    if (open) q('#adminNav [aria-current]')?.focus();
  }
  function updateUrl(replace = false) {
    if (handlingHistory) return;
    const url = new URL(location.href); url.searchParams.set('section', state.view); url.searchParams.set('lang', state.language);
    if (state.view === 'content') url.searchParams.set('type', contentMode); else url.searchParams.delete('type');
    if (url.pathname + url.search === location.pathname + location.search) return;
    history[replace ? 'replaceState' : 'pushState'](null, '', url.pathname + url.search);
  }
  function viewChanged() { updateUrl(); setMenu(false); refresh(); const heading = q('.view.active h1'); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); } }
  function openCatalog(category, id = null) {
    if (!Object.hasOwn(state.gameplayCatalog?.schema ?? {}, category)) return false;
    resume.set(state.catalogCategory, state.catalogEntry);
    contentMode = category; state.catalogCategory = category;
    state.catalogEntry = id ?? resume.get(category) ?? (state.catalogNewIds[category] || state.catalogEdits[category + '/__new'] ? '__new' : null);
    state.catalogError = ''; state.catalogMessage = ''; renderGameplayCatalog();
    setView('content'); renderContentChooser(); return true;
  }
  function catalogSaved(category, submittedId, savedId) {
    if (resume.get(category) === submittedId) resume.set(category, savedId);
    automaticIds.delete(category);
  }
  function chooseType(type) {
    if (type === 'crimes') { contentMode = type; setView('content'); renderContentChooser(); }
    else openCatalog(type);
  }
  function renderContentChooser() {
    const target = q('#studioContentTypes'); if (!target) return;
    if (!state.bootReady) { target.setAttribute('aria-busy', 'true'); return; }
    target.setAttribute('aria-busy', 'false');
    const types = ['crimes', ...Object.keys(state.gameplayCatalog?.schema ?? {})];
    if (!types.includes(contentMode)) contentMode = state.catalogCategory || 'items';
    target.setAttribute('role', 'tablist'); target.setAttribute('aria-label', tr('content'));
    target.innerHTML = types.map(type => `<button id="studioType-${esc(type)}" class="studio-content-type" type="button" role="tab" aria-controls="${type === 'crimes' ? 'studioCrimePanels' : 'studioCatalogPanel'}" aria-selected="${type === contentMode}" tabindex="${type === contentMode ? '0' : '-1'}" data-studio-type="${esc(type)}" ${!state.bootReady && type !== 'crimes' ? 'disabled' : ''}>${esc(type === 'crimes' ? tr('crime') : catName(type))}</button>`).join('');
    target.querySelectorAll('button').forEach(button => {
      button.addEventListener('click', () => { const type = button.dataset.studioType; chooseType(type); q('#studioType-' + type)?.focus(); });
      button.addEventListener('keydown', event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const buttons = [...target.querySelectorAll('button:not(:disabled)')], index = buttons.indexOf(button); const step = (event.key === 'ArrowRight' ? 1 : -1) * (state.language === 'ar' ? -1 : 1); const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + step + buttons.length) % buttons.length; buttons[next].focus(); });
    });
    if (q('#studioCatalogPanel')) q('#studioCatalogPanel').hidden = contentMode === 'crimes';
    if (q('#studioCrimePanels')) q('#studioCrimePanels').hidden = contentMode !== 'crimes';
    for (const id of ['studioCatalogPanel', 'studioCrimePanels']) { const panel = q('#' + id); if (panel) { panel.setAttribute('role', 'tabpanel'); if (!panel.hidden) panel.setAttribute('aria-labelledby', 'studioType-' + contentMode); } }
    const preview = q('.view[data-view="content"] [data-section-preview]');
    if (preview) preview.dataset.previewScreen = ({ items: 'items', jobs: 'job', gyms: 'gym', courses: 'education', properties: 'properties', upgrades: 'faction', opponents: 'attack', missions: 'missions', crimes: 'crimes' })[contentMode] || 'home';
  }
  async function createCatalog(category = 'items') { if (!adminCanMutate()) return; if (!openCatalog(category)) return; newGameplayCatalog(); renderContentChooser(); refresh(); q('#catalogField-name-en')?.focus(); }
  function createPage() { if (!adminCanMutate()) return; addPage(); setView('builder'); q('#pageTitleEn')?.focus(); }
  function renderTasks() {
    const tasks = [['item', 'content', 'createItem', 'createItemHelp'], ['page', 'builder', 'createPage', 'createPageHelp'], ['look', 'themes', 'customize', 'customizeHelp'], ['system', 'modules', 'addSystem', 'addSystemHelp']];
    const target = q('#studioTasks'); if (!target) return;
    target.innerHTML = tasks.map(([action, icon, label, help]) => `<button class="studio-task" type="button" data-studio-action="${action}" ${['item', 'page'].includes(action) && !state.bootReady ? 'disabled' : ''}><span class="studio-task-icon">${svg(icon)}</span><span class="studio-task-copy"><strong>${esc(tr(label))}</strong><small>${esc(tr(help))}</small></span><span class="studio-task-arrow" aria-hidden="true">${svg('forward')}</span></button>`).join('');
    target.querySelectorAll('button').forEach(button => button.addEventListener('click', () => runAction(button.dataset.studioAction)));
  }
  function openDialog(dialog, focusTarget) { if (!dialog || dialog.open) return; dialogReturnFocus = document.activeElement; dialog.showModal(); focusTarget?.focus(); }
  function closeDialog(dialog) { if (!dialog?.open) return; dialog.close(); dialogReturnFocus?.focus?.(); }
  function requestCrimeSwitch(action) {
    if (!unsavedContentEdits().crime) { action(); return; }
    if (pendingCrimeAction) return;
    pendingCrimeAction = action; openDialog(q('#studioLeaveDialog'), q('#studioLeaveStay'));
  }
  async function resolveCrimeSwitch(decision) {
    if (decision === 'save') {
      if (!q('#crimeForm').reportValidity()) return;
      await saveCrime({ preventDefault() {} });
      if (unsavedContentEdits().crime || state.controlBusy) { refresh(); return; }
    }
    if (decision === 'discard') discardCrimeEdits();
    const action = pendingCrimeAction; pendingCrimeAction = null; closeDialog(q('#studioLeaveDialog'));
    if (decision !== 'stay') action?.(); refresh();
  }
  function runAction(action) {
    if (action === 'item') return createCatalog('items');
    if (action === 'page') return createPage();
    if (action === 'crime') { if (!adminCanMutate()) return; return requestCrimeSwitch(() => { contentMode = 'crimes'; setView('content'); newCrime(); refresh(); }); }
    if (action === 'look') return setView('themes');
    if (action === 'system') return setView('modules');
    if (sections.includes(action)) return setView(action);
  }
  async function saveCurrent() {
    if (!adminCanMutate()) return;
    if (state.view === 'content' && contentMode === 'crimes') { if (q('#crimeForm').reportValidity()) await saveCrime({ preventDefault() {} }); }
    else if (state.view === 'content') await saveGameplayCatalog({ preventDefault() {} });
    else if (snapshot().pending.catalog || snapshot().pending.crime) {
      const pending = snapshot().pending;
      notify(tr('saveOtherEdits'), true);
      if (pending.catalog) { const [category, id] = pending.catalog.split('/'); openCatalog(category, id); }
      else chooseType('crimes');
    }
    else await saveDraft();
    refresh();
  }
  function previewCurrent() {
    const s = snapshot(); if (state.view === 'content' && (s.pending.catalog || s.pending.crime)) { notify(tr('previewNeedsSave'), true); return; }
    const section = q('.view.active'), toggle = section?.querySelector('.builder-preview [data-preview-toggle], .section-preview [data-preview-toggle], .territory-map-panel [data-preview-toggle]');
    if (!toggle) return;
    if (toggle.getAttribute('aria-expanded') !== 'true') togglePreview(toggle); else refreshViewPreview(state.view);
    const panel = toggle.closest('.builder-preview,.section-preview,.territory-map-panel'); panel?.scrollIntoView({ behavior: 'auto', block: 'start' }); refresh();
  }
  function ensureLibraryControls() {
    const grid = q('#moduleGrid'); if (!grid) return;
    if (!q('#studioModuleSearch')) {
    const wrapper = document.createElement('div'); wrapper.className = 'studio-library-controls';
    wrapper.innerHTML = `<p class="studio-impact-note" data-studio-copy="extensionsImpact">${esc(tr('extensionsImpact'))}</p><label><span data-studio-copy="searchExtensions">${esc(tr('searchExtensions'))}</span><input id="studioModuleSearch" type="search" autocomplete="off" dir="auto"></label><label><span data-studio-copy="extensionFilter">${esc(tr('extensionFilter'))}</span><select id="studioModuleFilter"><option value="all" data-studio-copy="allExtensions">${esc(tr('allExtensions'))}</option><option value="installed" data-studio-copy="installedExtensions">${esc(tr('installedExtensions'))}</option><option value="available" data-studio-copy="availableExtensions">${esc(tr('availableExtensions'))}</option><option value="disabled" data-studio-copy="disabledExtensions">${esc(tr('disabledExtensions'))}</option></select></label><p id="studioModuleCount" role="status"></p>`;
    grid.before(wrapper);
    }
    q('#studioModuleFilter').innerHTML = [['all', 'allExtensions'], ['installed', 'installedExtensions'], ['available', 'availableExtensions'], ['disabled', 'disabledExtensions']].map(([value, key]) => `<option value="${value}">${esc(tr(key))}</option>`).join('');
    q('#studioModuleFilter').value = moduleFilter;
    if (!grid.parentElement.querySelector('.studio-impact-note')) { const note = document.createElement('p'); note.className = 'studio-impact-note'; note.dataset.studioCopy = 'extensionsImpact'; note.textContent = tr('extensionsImpact'); grid.before(note); }
    if (q('#studioModuleSearch').dataset.studioBound) return;
    q('#studioModuleSearch').dataset.studioBound = 'true'; q('#studioModuleSearch').value = moduleQuery; q('#studioModuleFilter').value = moduleFilter;
    q('#studioModuleSearch').addEventListener('input', event => { moduleQuery = event.target.value; filterModules(); });
    q('#studioModuleFilter').addEventListener('change', event => { moduleFilter = event.target.value; filterModules(); });
  }
  function filterModules() {
    let count = 0;
    qa('#moduleGrid .catalog-card').forEach((card, index) => { const module = state.modules[index]; const matches = module && plain([module.id, module.name, module.description, module.description_ar, ...(module.provides ?? []), ...(module.subscribes ?? [])].join(' ')).includes(plain(moduleQuery)) && (moduleFilter === 'all' || moduleFilter === 'installed' && module.installed || moduleFilter === 'available' && !module.installed || moduleFilter === 'disabled' && module.installed && !module.enabled); card.hidden = !matches; if (matches) count++; });
    if (q('#studioModuleCount')) q('#studioModuleCount').textContent = count ? `${count} ${tr('extensionsCount')}` : tr('noExtensions');
  }
  function decorateCatalog() {
    const fields = q('#catalogFields'); if (!fields) return;
    const rank = label => { const id = label.querySelector('input,select')?.id || ''; return id.includes('name-') ? 0 : id.includes('description-') ? 1 : id.includes('type') ? 2 : id.includes('model') || id.includes('image') ? 4 : 3; };
    [...fields.querySelectorAll('label')].sort((a, b) => rank(a) - rank(b)).forEach(label => fields.append(label));
    const type = q('#catalogField-type'); const labels = { weapon: ['Weapon', 'سلاح'], armor: ['Armor', 'درع'], medical: ['Medical', 'علاج'], booster: ['Booster', 'معزز'], material: ['Material', 'مادة'] };
    if (type) [...type.options].forEach(option => { option.textContent = labels[option.value]?.[state.language === 'ar' ? 1 : 0] ?? option.value; });
    const heading = q('#studioCatalogPanel h2'); if (heading) heading.textContent = catName(state.catalogCategory);
    if (q('#newCatalogButton')) q('#newCatalogButton').textContent = tr(state.catalogNewIds[state.catalogCategory] || state.catalogEdits[state.catalogCategory + '/__new'] ? 'newDraft' : 'newDefinition');
    resume.set(state.catalogCategory, state.catalogEntry);
  }
  function buildSearchEntries() {
    const entries = sections.map(view => ({ label: tr(view === 'overview' ? 'home' : view), search: [view, copy.en[view], copy.ar[view], view === 'overview' ? 'home start البداية' : view === 'territories' ? 'world director policy material issuance hourly budget finds search مدير أحداث المدينة سياسة مواد إصدار ميزانية لقى بحث' : ''].join(' '), detail: tr('workspace'), action: () => setView(view) }));
    for (const action of ['item', 'page', 'crime']) entries.unshift({ label: tr(action === 'item' ? 'createItem' : action === 'page' ? 'createPage' : 'crime') + (action === 'crime' ? ' +' : ''), search: action + ' ' + (action === 'item' ? 'create item weapon انشئ عنصر سلاح' : action === 'page' ? 'create page انشئ صفحة' : 'create crime انشئ جريمة'), detail: tr('newDefinition'), action: () => runAction(action) });
    for (const module of state.modules) entries.push({ label: module.name, search: [module.id, module.name, module.description_ar, module.description].join(' '), detail: tr('modules') + ' ' + module.version, action: () => { setView('modules'); moduleQuery = module.id; q('#studioModuleSearch').value = moduleQuery; filterModules(); } });
    for (const page of currentManifest()?.pages ?? []) entries.push({ label: page.title?.[state.language] || page.title?.en || page.id, search: [page.id, page.slug, page.title?.en, page.title?.ar].join(' '), detail: tr('builder'), action: () => { state.selectedPage = page.id; renderBuilder(); setView('builder'); } });
    for (const [category, catalog] of Object.entries(state.gameplayCatalog?.catalogs ?? {})) for (const [id, entry] of Object.entries(catalog ?? {})) entries.push({ label: entry.name?.[state.language] || entry.name?.en || catalogDefaultLabels[category]?.[id]?.[state.language] || id, search: [id, entry.name?.en, entry.name?.ar, category].join(' '), detail: catName(category), action: () => openCatalog(category, id) });
    for (const crime of state.crimes ?? []) entries.push({ label: (state.language === 'ar' ? crime.name_ar || crime.name_en : crime.name_en || crime.name_ar) || crime.id, search: [crime.id, crime.name_en, crime.name_ar, 'crime crimes جريمة الجرائم'].join(' '), detail: tr('crime'), action: () => requestCrimeSwitch(() => { contentMode = 'crimes'; state.selectedCrime = crime.id; if (typeof renderContent === 'function') renderContent(); setView('content'); renderContentChooser(); refresh(); }) });
    return entries;
  }
  function renderSearch() {
    const input = q('#studioCommandInput'), results = q('#studioCommandResults'); if (!input || !results) return;
    const query = plain(input.value); searchEntries = buildSearchEntries().filter(item => plain(item.label + ' ' + item.search).includes(query)).slice(0, 18);
    results.innerHTML = searchEntries.length ? searchEntries.map((item, index) => `<button class="studio-command-result" type="button" data-studio-result="${index}"><strong dir="auto">${esc(item.label)}</strong><small>${esc(item.detail)}</small></button>`).join('') : `<p class="empty-state" role="status">${esc(tr('noResults'))}</p>`;
    results.querySelectorAll('button').forEach(button => button.addEventListener('click', () => { const item = searchEntries[Number(button.dataset.studioResult)]; closeDialog(q('#studioCommandDialog')); item?.action(); }));
  }
  function showSearch() { renderSearch(); openDialog(q('#studioCommandDialog'), q('#studioCommandInput')); }
  function showHelp() {
    const key = ({ content: 'contentHelp', builder: 'pageHelp', modules: 'extensionHelp', themes: 'appearanceHelp', releases: 'publishHelp' })[state.view] || 'genericHelp';
    q('#studioHelpContent').textContent = tr(key); openDialog(q('#studioHelpDialog'), q('#studioHelpClose'));
  }
  function refresh() {
    if (!initialized) return;
    if (state.bootReady && initialRequestedType) { const wanted = initialRequestedType; initialRequestedType = null; if (state.view === 'content' && (wanted === 'crimes' || Object.hasOwn(state.gameplayCatalog?.schema ?? {}, wanted))) { chooseType(wanted); return; } }
    qa('[data-studio-copy]').forEach(element => { element.textContent = tr(element.dataset.studioCopy); });
    q('.brand')?.setAttribute('aria-label', state.language === 'ar' ? 'الصفحة الرئيسية لاستوديو ZONE' : 'ZONE Studio home');
    q('#studioBreadcrumb')?.setAttribute('aria-label', state.language === 'ar' ? 'مسار التنقل' : 'Breadcrumb');
    q('#studioCommandInput')?.setAttribute('placeholder', tr('searchInputLabel'));
    const s = snapshot(), message = !s.ready ? tr(state.bootError ? 'waiting' : 'connectingWorkspace') : s.busy ? tr('saving') : s.unsaved ? tr('unsaved') : s.awaitingPublication ? tr('savedDraft') : tr('readyDraft');
    if (q('#studioWorkflowStatus')) { q('#studioWorkflowStatus').textContent = message; q('#studioWorkflowStatus').dataset.state = !s.ready ? 'loading' : s.unsaved ? 'unsaved' : s.awaitingPublication ? 'draft' : 'ready'; }
    const breadcrumb = q('#studioBreadcrumb'); if (breadcrumb) breadcrumb.innerHTML = `<button type="button" data-studio-home ${state.view === 'overview' ? 'aria-current="page"' : ''}>${esc(tr('home'))}</button>${state.view === 'overview' ? '' : `<span aria-hidden="true">/</span><span aria-current="page">${esc(tr(state.view))}${state.view === 'content' ? ' / ' + esc(contentMode === 'crimes' ? tr('crime') : catName(contentMode)) : ''}</span>`}`;
    breadcrumb?.querySelector('button')?.addEventListener('click', () => setView('overview'));
    const bar = q('#studioSaveBar'); if (bar) bar.hidden = !['content', 'builder', 'themes', 'releases'].includes(state.view);
    if (q('#studioSaveMessage')) q('#studioSaveMessage').textContent = message;
    const save = q('#studioSaveButton'); if (save) { save.textContent = tr(state.view === 'content' ? contentMode === 'crimes' ? 'saveCrime' : 'saveItem' : 'savePages'); save.disabled = !s.ready || s.busy || !(s.unsaved || s.awaitingPublication); }
    if (q('#studioPreviewButton')) q('#studioPreviewButton').disabled = !s.ready || s.busy || state.view === 'content' && (s.pending.catalog || s.pending.crime);
    q('#publishButton').textContent = tr(state.view === 'releases' ? 'publishNow' : 'reviewPublish');
    q('#releasePublishButton').textContent = tr('publishNow');
    if (q('#newCatalogButton') && (state.catalogNewIds[state.catalogCategory] || state.catalogEdits[state.catalogCategory + '/__new'])) q('#newCatalogButton').textContent = tr('newDraft');
    renderTasks(); renderContentChooser(); ensureLibraryControls(); filterModules();
    if (q('#studioCommandDialog')?.open) renderSearch();
  }
  function initialize() {
    if (initialized) return; initialized = true;
    Object.assign(translations.en, { controlPlane: 'OPEN ENGINE STUDIO', overview: 'Your game workspace', overviewSub: 'Build and evolve ZONE from one clear workspace.', contentSub: copy.en.contentHelp, modules: 'Extensions', modulesSub: 'Find registered game systems. Inspect, install and enable each package.', builder: 'Pages & navigation', themes: 'Appearance', releases: 'Publish & history' });
    Object.assign(translations.ar, { controlPlane: 'استوديو المحرك المفتوح', overview: 'مساحة تطوير لعبتك', overviewSub: 'ابنِ ZONE وطورها من مساحة عمل واضحة واحدة.', contentSub: copy.ar.contentHelp, modules: 'الإضافات', modulesSub: 'ابحث في أنظمة اللعبة المسجلة. راجع الحزمة وثبتها وفعلها.', builder: 'الصفحات والتنقل', themes: 'المظهر', releases: 'النشر والسجل' });
    Object.assign(translations.en, { install: 'Install & enable for next release', enable: 'Enable for next release', disable: 'Disable for next release', activate: 'Select for next release', themeSelected: 'Selected for next release', active: 'Live release', catalogId: 'Permanent ID', catalogIdHelp: copy.en.autoIdHelp });
    Object.assign(translations.ar, { install: 'ثبت وفعل للإصدار القادم', enable: 'فعل للإصدار القادم', disable: 'عطل للإصدار القادم', activate: 'اختر للإصدار القادم', themeSelected: 'مختار للإصدار القادم', active: 'الإصدار المباشر', catalogId: 'المعرف الدائم', catalogIdHelp: copy.ar.autoIdHelp });
    for (const language of ['en', 'ar']) Object.assign(translations[language], { territories: copy[language].territories, assets: copy[language].assets, economy: copy[language].economy, events: copy[language].events, uninstall: language === 'ar' ? 'ألغ التثبيت للإصدار القادم' : 'Uninstall for next release' });
    for (const language of ['en', 'ar']) { copy[language].moduleSearchLabel = copy[language].searchExtensions; copy[language].moduleFilterLabel = copy[language].extensionFilter; }
    copy.en.extensionHelp = 'Search registered packages and inspect their version and status. Installing a package enables it; you can disable it separately. Publish the reviewed configuration to apply it to players. New source packages must first be registered on the server.';
    copy.ar.extensionHelp = 'ابحث في الحزم المسجلة وراجع الإصدار والحالة. تثبيت الحزمة يفعلها، ويمكن تعطيلها بشكل منفصل. انشر الإعداد المراجع لتطبيقه على اللاعبين. يجب تسجيل سورس الحزمة الجديدة في الخادم أولاً.';
    copy.en.appearanceHelp = 'Select an installed theme for your next release, and edit branding, colors and announcements. Branding changes can be previewed. The selected theme stylesheet reaches the game when you publish; the preview keeps the published theme stylesheet.';
    copy.ar.appearanceHelp = 'اختر قالبا مثبتا للإصدار القادم، وعدل الهوية والألوان والإعلانات. يمكنك معاينة تعديلات الهوية. يصل ملف تنسيق القالب المختار إلى اللعبة عند النشر؛ تحتفظ المعاينة بتنسيق القالب المنشور.';
    qa('.builder-preview [data-preview-toggle], .section-preview [data-preview-toggle]').forEach(button => { const stage = document.getElementById(button.getAttribute('aria-controls')); if (stage) stage.hidden = true; button.setAttribute('aria-expanded', 'false'); button.closest('.builder-preview,.section-preview')?.classList.add('preview-collapsed'); updatePreviewToggleLabel(button); });
    suspendInactivePreviews();
    q('#studioMenuButton')?.addEventListener('click', () => setMenu(!document.body.classList.contains('studio-menu-open')));
    q('#studioMenuClose')?.addEventListener('click', () => { setMenu(false); q('#studioMenuButton')?.focus(); });
    q('#studioNavBackdrop')?.addEventListener('click', () => { setMenu(false); q('#studioMenuButton').focus(); });
    q('#studioSearchButton')?.addEventListener('click', showSearch); q('#studioGuideButton')?.addEventListener('click', showHelp);
    qa('[data-studio-help]').forEach(button => button.addEventListener('click', showHelp));
    q('#studioCommandInput')?.addEventListener('input', renderSearch);
    q('#studioCommandInput')?.addEventListener('keydown', event => { if (event.key === 'ArrowDown') { event.preventDefault(); q('#studioCommandResults button')?.focus(); } });
    q('#studioCommandClose')?.addEventListener('click', () => closeDialog(q('#studioCommandDialog')));
    q('#studioHelpClose')?.addEventListener('click', () => closeDialog(q('#studioHelpDialog')));
    q('#studioSaveButton')?.addEventListener('click', saveCurrent); q('#studioPreviewButton')?.addEventListener('click', previewCurrent);
    for (const decision of ['Save', 'Discard', 'Stay']) q('#studioLeave' + decision)?.addEventListener('click', () => resolveCrimeSwitch(decision.toLowerCase()));
    qa('#studioCommandDialog,#studioHelpDialog,#studioLeaveDialog').forEach(dialog => dialog.addEventListener('cancel', event => { event.preventDefault(); if (dialog.id === 'studioLeaveDialog') pendingCrimeAction = null; closeDialog(dialog); }));
    document.addEventListener('keydown', event => {
      const menuOpen = document.body.classList.contains('studio-menu-open');
      if (menuOpen && event.key === 'Tab') {
        const controls = qa('#studioSidebar button, #studioSidebar a').filter(element => !element.hidden && !element.disabled && element.tabIndex !== -1);
        const index = controls.indexOf(document.activeElement), next = event.shiftKey ? index <= 0 ? controls.length - 1 : index - 1 : index < 0 || index === controls.length - 1 ? 0 : index + 1;
        if (controls[next]) { event.preventDefault(); controls[next].focus(); }
      } else if (event.key === 'Escape' && menuOpen) { event.preventDefault(); setMenu(false); q('#studioMenuButton')?.focus(); }
      else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); if (menuOpen) setMenu(false); showSearch(); }
    });
    document.addEventListener('click', event => {
      const button = event.target.closest?.('button'); if (!button) return;
      if (button.id === 'publishButton' && state.view !== 'releases') { event.preventDefault(); event.stopImmediatePropagation(); setView('releases'); }
      if (button.id === 'newCrimeButton' || button.dataset.editCrime && button.dataset.editCrime !== state.selectedCrime) { if (!unsavedContentEdits().crime) return; event.preventDefault(); event.stopImmediatePropagation(); requestCrimeSwitch(() => { if (button.id === 'newCrimeButton') newCrime(); else { state.selectedCrime = button.dataset.editCrime; renderContent(); } refresh(); }); }
    }, true);
    document.addEventListener('input', event => {
      if (event.target.id === 'catalogNewId') automaticIds.delete(state.catalogCategory);
      if (event.target.id === 'catalogField-name-en' && state.catalogEntry === '__new') { const idInput = q('#catalogNewId'); if (idInput && (!idInput.value || idInput.value === automaticIds.get(state.catalogCategory))) { const id = makeId(event.target.value, state.gameplayCatalog?.catalogs?.[state.catalogCategory] ?? {}, state.catalogCategory); idInput.value = id; state.catalogNewIds[state.catalogCategory] = id; automaticIds.set(state.catalogCategory, id); } }
      refresh();
    });
    document.addEventListener('change', event => { if (event.target.id === 'catalogCategory') contentMode = state.catalogCategory; resume.set(state.catalogCategory, state.catalogEntry); refresh(); updateUrl(); });
    window.addEventListener('popstate', () => {
      const next = route(location.search, state.gameplayCatalog?.schema ?? {});
      const language = new URLSearchParams(location.search).get('lang');
      handlingHistory = true;
      try {
        if (['en', 'ar'].includes(language) && language !== state.language) { state.language = language; applyLanguage(); }
        if (next.type) chooseType(next.type);
        setView(next.view);
      } finally { handlingHistory = false; }
    });
    document.body.classList.add('studio-ready');
    const next = route(location.search, state.gameplayCatalog?.schema ?? {}); const requestedType = new URLSearchParams(location.search).get('type');
    contentMode = requestedType || state.catalogCategory; initialRequestedType = requestedType; handlingHistory = true; try { setView(next.view); } finally { handlingHistory = false; }
    applyLanguage(); if (!initialRequestedType) updateUrl(true); refresh();
  }
  function diagnostics() {
    return { initialized, contentMode, moduleFilter, moduleQuery, searchEntryCount: buildSearchEntries().length, ...snapshot() };
  }
  window.ZoneStudio = Object.freeze({ renderNavigation, viewChanged, refresh, snapshot, diagnostics, openCatalog, catalogSaved, createCatalog, createPage, requestCrimeSwitch, resolveCrimeSwitch, saveCurrent, previewCurrent, buildSearchEntries, showSearch, chooseType, initialize, decorateCatalog, helpers });
  initialize();
}());
