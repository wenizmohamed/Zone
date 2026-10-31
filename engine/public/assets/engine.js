const requestedLanguage = new URLSearchParams(location.search).get('lang');
const state = { language: ['en', 'ar'].includes(requestedLanguage) ? requestedLanguage : (document.documentElement.lang === 'ar' ? 'ar' : 'en'), engine: null, modules: [], themes: [], crimes: [], player: null, events: [], ledger: [], architecture: null, ready: false, busy: false, refreshing: false };

const copy = {
  en: {
    openAdmin: 'Open workspace', refreshEngine: 'Refresh engine data', configurationSaved: 'Configuration saved. Open Admin and publish a release to apply it to players.', operationBusy: 'Please wait for the current operation to finish.', loadFailed: 'Unable to load engine data. Retry using Refresh engine data.', evidenceUnavailable: 'The server action completed, but details could not refresh. Refresh the data without repeating the action.',
    engine: 'Open Engine', runtime: 'PHP 8.5 runtime', openGame: 'View game', proof: 'Operations console',
    headline: 'Open Engine', subhead: 'Build and customize ZONE from one workspace. Choose what you want to create, save your draft, then review it before publishing.',
    runProof: 'Run selected server test', inspect: 'Inspect architecture', php: 'PHP', authoritative: 'SERVER LOGIC', database: 'DATABASE', adapter: 'CURRENT ADAPTER', modules: 'EXTENSIONS', discovered: 'REGISTERED PACKAGES', events: 'EVENTS', audit: 'RECORDED HOOKS',
    architecture: 'Runtime & architecture', architectureCopy: 'The web interface uses an API. Game rules run on the server, while modules and themes connect through defined contracts.',
    moduleControl: 'Registered extensions', moduleCopy: 'Installing a registered package also enables it. Configuration is saved on the server for your next release; review and publish it from the workspace to apply it to players.', themeControl: 'Choose a theme', themeCopy: 'Select a registered theme for the next release and customize branding in the workspace. The game keeps using its published theme until you publish the new release.',
    liveProof: 'Test a server action', crime: 'Choose a crime', attempt: 'Execute action', resultWaiting: 'The server will calculate the result when you execute the action.', ledger: 'Economy ledger', eventLog: 'Event & hook log', footer: 'Create. Customize. Review. Publish.',
    installed: 'Installed', uninstalled: 'Available to install', enabled: 'Enabled for next release', disabled: 'Disabled for next release', install: 'Install & enable for next release', uninstall: 'Uninstall for next release', enable: 'Enable for next release', disable: 'Disable for next release', active: 'Selected for next release', activate: 'Select for next release',
    skipContent: 'Skip to workspace', creatorSpace: 'YOUR GAME, YOUR WORKSPACE', workspaceMenu: 'Workspace navigation', workspaceNav: 'WORKSPACE', startNav: 'Start here', extensionsNav: 'Extensions', appearanceNav: 'Appearance', advancedNav: 'ADVANCED', testingNav: 'Server action test', activityNav: 'Activity & economy', architectureNav: 'Runtime & architecture', connecting: 'Connecting to engine', connected: 'Engine connected', disconnected: 'Engine unavailable. Refresh to retry.', updating: 'Refreshing engine data', draftReminder: 'Saved changes reach players only after you publish a release.',
    createContent: 'Create game content', createContentCopy: 'Add items, crimes and rewards. Adjust prices and balance.', createPage: 'Create a page', createPageCopy: 'Build a game screen and arrange its content blocks.', customizeAppearance: 'Customize appearance', customizeAppearanceCopy: 'Choose a theme and review how your game looks.', manageExtensions: 'Manage extensions', manageExtensionsCopy: 'Configure the registered systems that power your game.',
    workflowTitle: 'How changes reach your game', reviewReleases: 'Review & publish', draftStep: 'Draft', draftStepCopy: 'Make changes without affecting players.', saveStep: 'Save', saveStepCopy: 'Keep your working changes in the engine.', previewStep: 'Preview', previewStepCopy: 'Check your draft as a player before release.', publishStep: 'Publish', publishStepCopy: 'Apply the reviewed release to the live game.',
    searchExtensions: 'Find an extension', searchPlaceholder: 'Search name or package ID', filterExtensions: 'Show', allExtensions: 'All extensions', enabledExtensions: 'Installed & enabled', disabledExtensions: 'Installed & disabled', availableExtensions: 'Available to install', extensionBoundary: 'This list contains packages already registered with the engine. Adding a new source package is a developer installation step, not a file upload here.', noExtensions: 'No extensions match your search.', extensionCount: 'extensions shown', packageDetails: 'Developer details', openAppearance: 'Open appearance workspace',
    testingSummary: 'Uses the current player account and changes its game state.', testingCopy: 'This is a real crime action, not a preview. The server calculates its outcome and records the result. Use a testing account.', activitySummary: 'Inspect recorded money movements and engine events.', architectureSummary: 'Technical details for developers and engine operators.', apiTrace: 'API request trace', clearTrace: 'Clear',
    noLedger: 'Run a successful crime to produce an immutable currency record.', noEvents: 'Engine events will appear here.', serverSuccess: 'Server success', serverFailure: 'Server failure', cash: 'Cash', nerve: 'Nerve', energy: 'Energy', life: 'Life', level: 'Level', playerRequired: 'Open the game to sign in to a player account before running a game action. Owner controls remain available.'
  },
  ar: {
    openAdmin: 'افتح مساحة العمل', refreshEngine: 'تحديث بيانات المحرك', configurationSaved: 'تم حفظ الإعدادات. افتح الإدارة وانشر إصدارا لتطبيقها على اللاعبين.', operationBusy: 'انتظر اكتمال الإجراء الحالي.', loadFailed: 'تعذر تحميل بيانات المحرك. أعد المحاولة من زر تحديث بيانات المحرك.', evidenceUnavailable: 'اكتمل الإجراء في الخادم، لكن تعذر تحديث التفاصيل. حدث البيانات دون تكرار الإجراء.',
    engine: 'المحرك المفتوح', runtime: 'بيئة PHP 8.5', openGame: 'عرض اللعبة', proof: 'إدارة المحرك',
    headline: 'المحرك المفتوح', subhead: 'طوّر ZONE وخصصها من مساحة عمل واحدة. اختر ما تريد إنشاءه، واحفظ المسودة، ثم راجعها قبل النشر.',
    runProof: 'تشغيل اختبار الخادم المحدد', inspect: 'عرض المعمارية', php: 'PHP', authoritative: 'منطق الخادم', database: 'قاعدة البيانات', adapter: 'المحول المستخدم', modules: 'الإضافات', discovered: 'الحزم المسجلة', events: 'الأحداث', audit: 'الأحداث المسجلة',
    architecture: 'بيئة التشغيل والمعمارية', architectureCopy: 'تتصل واجهة الويب بالمحرك عبر API. تعمل قواعد اللعبة على الخادم، وتتصل الإضافات والقوالب من خلال عقود محددة.',
    moduleControl: 'الإضافات المسجلة', moduleCopy: 'تثبيت الحزمة المسجلة يفعلها أيضا. تحفظ الإعدادات في الخادم للإصدار القادم؛ راجعها وانشرها من مساحة العمل لتطبيقها على اللاعبين.', themeControl: 'اختيار القالب', themeCopy: 'اختر قالبا مسجلا للإصدار القادم وخصص الهوية في مساحة العمل. تواصل اللعبة استخدام القالب المنشور إلى أن تنشر الإصدار الجديد.',
    liveProof: 'اختبار إجراء على الخادم', crime: 'اختر جريمة', attempt: 'تنفيذ الإجراء', resultWaiting: 'يحسب الخادم النتيجة عند تنفيذ الإجراء.', ledger: 'سجل الاقتصاد', eventLog: 'سجل الأحداث والتفاعلات', footer: 'إنشاء. تخصيص. مراجعة. نشر.',
    installed: 'مثبت', uninstalled: 'متاح للتثبيت', enabled: 'مفعل للإصدار القادم', disabled: 'معطل للإصدار القادم', install: 'ثبت وفعل للإصدار القادم', uninstall: 'ألغ التثبيت للإصدار القادم', enable: 'فعل للإصدار القادم', disable: 'عطل للإصدار القادم', active: 'مختار للإصدار القادم', activate: 'اختر للإصدار القادم',
    skipContent: 'انتقل إلى مساحة العمل', creatorSpace: 'لعبتك، ومساحة عملك', workspaceMenu: 'قائمة مساحة العمل', workspaceNav: 'مساحة العمل', startNav: 'ابدأ هنا', extensionsNav: 'الإضافات', appearanceNav: 'المظهر', advancedNav: 'أدوات متقدمة', testingNav: 'اختبار إجراء الخادم', activityNav: 'النشاط والاقتصاد', architectureNav: 'بيئة التشغيل والمعمارية', connecting: 'جار الاتصال بالمحرك', connected: 'المحرك متصل', disconnected: 'المحرك غير متاح. حدث البيانات للمحاولة.', updating: 'جار تحديث بيانات المحرك', draftReminder: 'لا تصل التغييرات المحفوظة إلى اللاعبين إلا بعد نشر إصدار.',
    createContent: 'إنشاء محتوى اللعبة', createContentCopy: 'أضف عناصر وجرائم ومكافآت، وعدّل الأسعار والتوازن.', createPage: 'إنشاء صفحة', createPageCopy: 'أنشئ شاشة للعبة ورتّب كتل المحتوى فيها.', customizeAppearance: 'تخصيص المظهر', customizeAppearanceCopy: 'اختر قالبا وراجع مظهر لعبتك.', manageExtensions: 'إدارة الإضافات', manageExtensionsCopy: 'اضبط الأنظمة المسجلة التي تشغّل لعبتك.',
    workflowTitle: 'كيف تصل التغييرات إلى لعبتك', reviewReleases: 'المراجعة والنشر', draftStep: 'مسودة', draftStepCopy: 'أجر تغييرات دون التأثير على اللاعبين.', saveStep: 'حفظ', saveStepCopy: 'احفظ تغييرات العمل في المحرك.', previewStep: 'معاينة', previewStepCopy: 'راجع المسودة كلاعب قبل الإصدار.', publishStep: 'نشر', publishStepCopy: 'طبّق الإصدار الذي راجعته على اللعبة.',
    searchExtensions: 'ابحث عن إضافة', searchPlaceholder: 'ابحث بالاسم أو معرّف الحزمة', filterExtensions: 'عرض', allExtensions: 'جميع الإضافات', enabledExtensions: 'مثبتة ومفعّلة', disabledExtensions: 'مثبتة ومعطّلة', availableExtensions: 'متاحة للتثبيت', extensionBoundary: 'تحتوي القائمة على حزم مسجلة مسبقا في المحرك. إضافة حزمة مصدر جديدة خطوة تثبيت للمطور، وليست رفع ملف من هذه الشاشة.', noExtensions: 'لا توجد إضافات تطابق البحث.', extensionCount: 'إضافات معروضة', packageDetails: 'تفاصيل للمطور', openAppearance: 'افتح مساحة المظهر',
    testingSummary: 'يستخدم حساب اللاعب الحالي ويغيّر حالته في اللعبة.', testingCopy: 'هذا إجراء جريمة حقيقي، وليس معاينة. يحسب الخادم النتيجة ويسجلها. استخدم حسابا للاختبار.', activitySummary: 'راجع الحركات المالية المسجلة وأحداث المحرك.', architectureSummary: 'تفاصيل تقنية للمطورين ومديري المحرك.', apiTrace: 'تتبع طلبات API', clearTrace: 'مسح',
    noLedger: 'نفّذ جريمة ناجحة لإنتاج سجل مالي غير قابل للتعديل.', noEvents: 'ستظهر أحداث المحرك هنا.', serverSuccess: 'نجاح من السيرفر', serverFailure: 'فشل من السيرفر', cash: 'النقد', nerve: 'الأعصاب', energy: 'الطاقة', life: 'الحياة', level: 'المستوى', playerRequired: 'افتح اللعبة وسجّل الدخول بحساب لاعب قبل تنفيذ إجراء لعب. تبقى إدارة المحرك متاحة للمالك.'
  }
};

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
const t = (key) => copy[state.language][key] ?? key;

function trace(method, path, payload, response) {
  const target = $('#apiTrace');
  const time = new Date().toLocaleTimeString();
  const input = payload ? `\n> ${JSON.stringify(payload, null, 2)}` : '';
  target.textContent = `[${time}] ${method} ${path}${input}\n< ${JSON.stringify(response, null, 2)}\n\n${target.textContent}`;
}

async function api(path, options = {}) {
  const method = options.method ?? 'GET';
  const payload = options.body ? JSON.parse(options.body) : null;
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) }, ...options });
  const data = await response.json();
  trace(method, path, payload, data);
  if (!response.ok) { const error = new Error(data.error ?? `${response.status}`); error.status = response.status; throw error; }
  return data;
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2800);
}

function applyLanguage() {
  const arabic = state.language === 'ar';
  document.documentElement.lang = state.language;
  document.documentElement.dir = arabic ? 'rtl' : 'ltr';
  $('#languageButton').textContent = arabic ? 'English' : 'العربية';
  document.querySelectorAll('a[href="/"], a[href^="/?"], a[href="/engine"], a[href^="/engine?"], a[href="/admin"], a[href^="/admin?"]').forEach(link => {
    const url = new URL(link.getAttribute('href'), location.origin); url.searchParams.set('lang', state.language);
    link.setAttribute('href', url.pathname + url.search);
  });
  document.querySelectorAll('[data-i18n]').forEach((element) => { element.textContent = t(element.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => { element.placeholder = t(element.dataset.i18nPlaceholder); });
  document.title = `ZONE | ${t('headline')}`;
  $('#engineNav')?.setAttribute?.('aria-label', t('workspaceMenu'));
  document.querySelector('.brand')?.setAttribute?.('aria-label', arabic ? 'الصفحة الرئيسية لمحرك ZONE' : 'ZONE Open Engine home');
  $('#metrics')?.setAttribute?.('aria-label', arabic ? 'حالة المحرك' : 'Engine status');
  document.querySelector('.studio-task-list')?.setAttribute?.('aria-label', t('creatorSpace'));
  renderAll();
}

function renderArchitecture(architecture) {
  const arabicFlow = ['واجهة الويب أو الموبايل', 'REST API v1', 'حالة استخدام', 'نواة الدومين', 'منفذ تعاقدي', 'محول تقني'];
  const arabicInfrastructure = ['PHP 8.5', 'مخطط PostgreSQL للإنتاج', 'محول SQLite للعرض', 'عقد Redis', 'مخطط العمال والمهام', 'نموذج تخزين الـAssets'];
  const flow = state.language === 'ar' ? arabicFlow : architecture.requestFlow;
  const infrastructure = state.language === 'ar' ? arabicInfrastructure : architecture.infrastructure;
  $('#architectureFlow').innerHTML = flow.map((label, index) => `<article class="flow-card"><span>0${index + 1}</span><strong>${escapeHtml(label)}</strong></article>`).join('');
  $('#infrastructure').innerHTML = infrastructure.map((label) => `<span>${escapeHtml(label)}</span>`).join('');
}

function renderModules() {
  const query = ($('#engineModuleSearch')?.value ?? '').trim().toLocaleLowerCase(state.language);
  const filter = $('#engineModuleFilter')?.value || 'all';
  const modules = state.modules.filter(module => {
    const matchesState = filter === 'all' || (filter === 'enabled' && module.installed && module.enabled) || (filter === 'disabled' && module.installed && !module.enabled) || (filter === 'available' && !module.installed);
    const searchText = `${module.name} ${module.name_ar ?? ''} ${module.id} ${module.description ?? ''} ${module.description_ar ?? ''}`.toLocaleLowerCase(state.language);
    return matchesState && (!query || searchText.includes(query));
  });
  const count = $('#engineModuleCount');
  if (count) count.textContent = `${modules.length} / ${state.modules.length} ${t('extensionCount')}`;
  $('#moduleList').innerHTML = modules.length ? modules.map((module) => {
    const statusText = !module.installed ? t('uninstalled') : module.enabled ? t('enabled') : t('disabled');
    const actions = !module.installed
      ? `<button data-module="${escapeHtml(module.id)}" data-action="install">${t('install')}</button>`
      : `<button data-module="${escapeHtml(module.id)}" data-action="${module.enabled ? 'disable' : 'enable'}">${module.enabled ? t('disable') : t('enable')}</button><button data-module="${escapeHtml(module.id)}" data-action="uninstall">${t('uninstall')}</button>`;
    return `<article class="package-card">
      <div class="package-top"><div><h3>${escapeHtml(state.language === 'ar' ? (module.name_ar || module.name) : module.name)}</h3><code dir="ltr">${escapeHtml(module.id)}@${escapeHtml(module.version)}</code></div><span class="status ${module.installed && module.enabled ? 'on' : ''}">${statusText}</span></div>
      <p>${escapeHtml(state.language === 'ar' ? module.description_ar : module.description)}</p>
      <div class="package-actions">${actions}</div>
      <details class="studio-package-details"><summary>${t('packageDetails')}</summary><div class="chips">${[...(module.provides ?? []), ...(module.subscribes ?? []).map((item) => `on:${item}`)].map((item) => `<span dir="ltr">${escapeHtml(item)}</span>`).join('')}</div></details>
    </article>`;
  }).join('') : `<div class="empty-state">${t('noExtensions')}</div>`;
  document.querySelectorAll('[data-module]').forEach((button) => button.addEventListener('click', () => changeModule(button.dataset.module, button.dataset.action)));
}

function renderThemes() {
  $('#themeList').innerHTML = state.themes.map((theme) => `<article class="package-card">
    <div class="package-top"><div><h3>${escapeHtml(state.language === 'ar' ? (theme.name_ar || theme.name) : theme.name)}</h3><code dir="ltr">${escapeHtml(theme.id)}@${escapeHtml(theme.version)}</code></div><span class="theme-swatch" aria-hidden="true" style="color:${escapeHtml(theme.preview)};background:${escapeHtml(theme.preview)}"></span></div>
    <p>${escapeHtml(state.language === 'ar' ? theme.description_ar : theme.description)}</p>
    <div class="package-actions">${theme.active ? `<span class="status on">${t('active')}</span>` : `<button data-theme="${escapeHtml(theme.id)}">${t('activate')}</button>`}</div>
  </article>`).join('');
  document.querySelectorAll('[data-theme]').forEach((button) => button.addEventListener('click', () => activateTheme(button.dataset.theme)));
}

function renderPlayer() {
  if (!state.player) { $('#playerCard').textContent = t('playerRequired'); return; }
  const resources = [
    [t('cash'), `$${Number(state.player.cash).toLocaleString()}`],
    [t('nerve'), `${state.player.nerve}/${state.player.max_nerve}`],
    [t('energy'), `${state.player.energy}/${state.player.max_energy}`],
    [t('level'), state.player.level],
  ];
  $('#playerCard').innerHTML = resources.map(([label, value]) => `<div class="resource"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
}

function renderCrimes() {
  const select = $('#crimeSelect');
  const selected = select.value;
  select.innerHTML = state.crimes.length
    ? state.crimes.map((crime) => `<option value="${escapeHtml(crime.id)}">${escapeHtml(state.language === 'ar' ? crime.name_ar : crime.name_en)} · ${crime.nerve_cost} N · ${crime.successRate}%</option>`).join('')
    : `<option value="">${state.language === 'ar' ? 'موديول الجرائم معطّل' : 'Crime module disabled'}</option>`;
  if ([...select.options].some((option) => option.value === selected)) select.value = selected;
  $('#attemptButton').disabled = state.crimes.length === 0 || !state.player;
  $('#runCrimeButton').disabled = state.crimes.length === 0 || !state.player;
}

function renderAudit() {
  $('#ledgerList').innerHTML = state.ledger.length ? state.ledger.map((entry) => `<div class="audit-row"><code dir="ltr">${Number(entry.amount) >= 0 ? '+' : ''}${Number(entry.amount).toLocaleString()} ${escapeHtml(entry.asset)}</code><span>${escapeHtml(entry.reason)} · <bdi>${escapeHtml(entry.correlation_id)}</bdi></span><span>${escapeHtml(entry.created_at)}</span></div>`).join('') : `<div class="empty-state">${t('noLedger')}</div>`;
  $('#eventList').innerHTML = state.events.length ? state.events.map((event) => `<div class="audit-row"><code>${escapeHtml(event.event_name)}</code><span>${escapeHtml(JSON.stringify(event.payload))}</span><span>${escapeHtml(event.occurred_at)}</span></div>`).join('') : `<div class="empty-state">${t('noEvents')}</div>`;
}

function renderMetrics() {
  if (!state.engine) return;
  $('#metricPhp').textContent = state.engine.php;
  $('#metricDb').textContent = state.engine.database.toUpperCase();
  $('#metricModules').textContent = state.engine.moduleCount;
  $('#metricEvents').textContent = state.events.length;
}

function renderAll() {
  if (state.architecture) renderArchitecture(state.architecture);
  renderMetrics();
  renderModules();
  renderThemes();
  renderPlayer();
  renderCrimes();
  renderAudit();
  updateControls();
}
function updateControls() {
  document.querySelectorAll('[data-module], [data-theme]').forEach(button => { button.disabled = !state.ready || state.busy || state.refreshing; });
  const blocked = !state.ready || state.busy || state.refreshing || !state.player || !state.crimes.length;
  $('#attemptButton').disabled = blocked; $('#runCrimeButton').disabled = blocked;
  $('#refreshEngineButton').disabled = state.busy || state.refreshing;
  const connection = $('#engineConnectionStatus');
  if (connection) connection.textContent = t(state.refreshing ? 'updating' : state.ready ? 'connected' : 'disconnected');
}
function beginAction() {
  if (!state.ready || state.busy || state.refreshing) { toast(t(state.ready ? 'operationBusy' : 'loadFailed')); return false; }
  state.busy = true; updateControls(); return true;
}
function endAction() { state.busy = false; updateControls(); }

async function refresh() {
  if (state.refreshing) return;
  state.refreshing = true; updateControls();
  try {
  const [engine, modules, themes, player, crimes, ledger, events, architecture] = await Promise.all([
    api('/api/v1/engine'), api('/api/v1/modules'), api('/api/v1/themes'), api('/api/v1/player').catch(error => { if (error.status === 401) return { player: null }; throw error; }), api('/api/v1/crimes'), api('/api/v1/ledger'), api('/api/v1/events'), api('/api/v1/architecture')
  ]);
  Object.assign(state, { engine, modules: modules.modules, themes: themes.themes, player: player.player, crimes: crimes.crimes, ledger: ledger.entries, events: events.events, architecture });
  state.ready = true;
  renderAll();
  } catch (error) { state.ready = false; throw error; }
  finally { state.refreshing = false; updateControls(); }
}

async function attemptCrime() {
  const id = $('#crimeSelect').value;
  if (!id || !state.player || !beginAction()) return;
  const button = $('#attemptButton');
  button.disabled = true;
  try {
    const result = await api(`/api/v1/crimes/${encodeURIComponent(id)}/attempt`, { method: 'POST', body: '{}' });
    const target = $('#crimeResult');
    target.className = `result ${result.success ? '' : 'bad'}`;
    target.textContent = `${result.success ? t('serverSuccess') : t('serverFailure')} | cash ${result.reward.cash} | XP ${result.reward.xp} | event ${result.serverProof.eventId} | ${result.serverProof.calculatedBy}`;
    try { await refresh(); } catch (_) { toast(t('evidenceUnavailable')); }
  } catch (error) {
    $('#crimeResult').className = 'result bad';
    $('#crimeResult').textContent = error.message;
    toast(error.message);
  } finally {
    endAction();
  }
}

async function changeModule(id, action) {
  if (!beginAction()) return;
  try {
    await api(`/api/v1/admin/modules/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: '{}' });
    toast(`${id}: ${t(action)}. ${t('configurationSaved')}`);
    try { await refresh(); } catch (_) { toast(t('evidenceUnavailable')); }
  } catch (error) { toast(error.message); }
  finally { endAction(); }
}

async function activateTheme(id) {
  if (!beginAction()) return;
  try {
    await api(`/api/v1/admin/themes/${encodeURIComponent(id)}/activate`, { method: 'POST', body: '{}' });
    toast(`${id}: ${t('active')}. ${t('configurationSaved')}`);
    try { await refresh(); } catch (_) { toast(t('evidenceUnavailable')); }
  } catch (error) { toast(error.message); }
  finally { endAction(); }
}

function setEngineMenu(open) {
  $('#engineMenuButton')?.setAttribute?.('aria-expanded', String(open));
  if (open) $('#engineNav')?.classList.add('is-open');
  else $('#engineNav')?.classList.remove('is-open');
}

function revealEngineSection(hash) {
  const permitted = ['start', 'extensions', 'appearance', 'testing', 'activity', 'architecture'];
  const id = String(hash || '#start').slice(1);
  if (!permitted.includes(id)) return;
  const section = document.getElementById?.(id);
  if (!section) return;
  const disclosure = section.querySelector('details.studio-disclosure');
  if (disclosure) disclosure.open = true;
  document.querySelectorAll('#engineNav a').forEach(link => {
    if (link.getAttribute('href') === `#${id}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  return section;
}

function engineSummary() {
  return {
    language: state.language,
    ready: state.ready,
    busy: state.busy,
    refreshing: state.refreshing,
    moduleCount: state.modules.length,
    enabledModuleCount: state.modules.filter(module => module.installed && module.enabled).length,
    crimeCount: state.crimes.length,
    hasPlayer: Boolean(state.player),
    eventCount: state.events.length,
    ledgerCount: state.ledger.length,
  };
}

function bindEngineNavigation() {
  $('#engineMenuButton')?.addEventListener('click', () => setEngineMenu($('#engineMenuButton').getAttribute('aria-expanded') !== 'true'));
  document.querySelectorAll('#engineNav a').forEach(link => link.addEventListener('click', () => {
    const section = revealEngineSection(link.getAttribute('href'));
    if (section) { section.tabIndex = -1; section.focus({ preventScroll: true }); }
    setEngineMenu(false);
  }));
  document.addEventListener?.('keydown', event => {
    if (event.key === 'Escape' && $('#engineMenuButton')?.getAttribute('aria-expanded') === 'true') {
      setEngineMenu(false);
      $('#engineMenuButton').focus();
    }
  });
  globalThis.addEventListener?.('hashchange', () => revealEngineSection(location.hash));
  revealEngineSection(location.hash);
}

$('#languageButton').addEventListener('click', () => {
  state.language = state.language === 'en' ? 'ar' : 'en';
  const url = new URL(location.href); url.searchParams.set('lang', state.language); history.replaceState(null, '', url.pathname + url.search + url.hash);
  applyLanguage();
});
$('#attemptButton').addEventListener('click', attemptCrime);
$('#runCrimeButton').addEventListener('click', () => { document.querySelector('.proof-panel').scrollIntoView({ behavior: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }); setTimeout(attemptCrime, 450); });
$('#clearTraceButton').addEventListener('click', () => { $('#apiTrace').textContent = ''; });
$('#refreshEngineButton').addEventListener('click', () => refresh().catch(() => toast(t('loadFailed'))));
$('#engineModuleSearch')?.addEventListener('input', () => { renderModules(); updateControls(); });
$('#engineModuleFilter')?.addEventListener('change', () => { renderModules(); updateControls(); });

applyLanguage();
bindEngineNavigation();
refresh().catch((error) => { toast(error.message); $('#apiTrace').textContent = error.stack ?? error.message; });
