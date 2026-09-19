const state = { language: document.documentElement.lang === 'ar' ? 'ar' : 'en', engine: null, modules: [], themes: [], crimes: [], player: null, events: [], ledger: [], architecture: null };

const copy = {
  en: {
    engine: 'GAME ENGINE', runtime: 'PHP 8.5 RUNTIME', openGame: 'OPEN GAME', proof: 'EXECUTABLE PROOF',
    headline: 'A modular engine beneath the game.', subhead: 'PHP owns every result. Modules react through events. Themes change without touching gameplay. Every currency movement leaves a trail.',
    runProof: 'RUN SERVER PROOF', inspect: 'INSPECT ARCHITECTURE', php: 'PHP', authoritative: 'AUTHORITATIVE LOGIC', database: 'DATABASE', adapter: 'SWAPPABLE ADAPTER', modules: 'MODULES', discovered: 'DISCOVERED PACKAGES', events: 'EVENTS', audit: 'AUDITABLE HOOKS',
    architecture: 'Engine architecture', architectureCopy: 'Each dependency points inward. The game, database, Redis, workers, and future mobile apps connect through explicit ports.',
    moduleControl: 'Module control', moduleCopy: 'Install, remove, enable, or disable a package without editing the core.', themeControl: 'Theme control', themeCopy: 'Swap the view layer while modules and game state remain untouched.',
    liveProof: 'Live server proof', crime: 'Crime module action', attempt: 'ATTEMPT', resultWaiting: 'No client-selected reward. The server will calculate the result.', ledger: 'Economy ledger', eventLog: 'Event and hook log', footer: 'CORE + MODULES + THEMES + API + LEDGER + EVENTS',
    installed: 'INSTALLED', uninstalled: 'UNINSTALLED', enabled: 'ENABLED', disabled: 'DISABLED', install: 'INSTALL', uninstall: 'UNINSTALL', enable: 'ENABLE', disable: 'DISABLE', active: 'ACTIVE', activate: 'ACTIVATE',
    noLedger: 'Run a successful crime to produce an immutable currency record.', noEvents: 'Engine events will appear here.', serverSuccess: 'Server success', serverFailure: 'Server failure', cash: 'Cash', nerve: 'Nerve', energy: 'Energy', life: 'Life', level: 'Level'
  },
  ar: {
    engine: 'محرك اللعبة', runtime: 'بيئة PHP 8.5', openGame: 'افتح اللعبة', proof: 'نموذج تنفيذي حقيقي',
    headline: 'محرك قابل للتوسع تحت اللعبة.', subhead: 'PHP يحسب كل نتيجة على السيرفر. الموديولات تتفاعل عبر الأحداث. الثيم يتغير من دون لمس منطق اللعب. وكل حركة مالية تترك سجلاً قابلاً للتتبع.',
    runProof: 'شغّل إثبات السيرفر', inspect: 'افحص المعمارية', php: 'PHP', authoritative: 'منطق سيرفر موثوق', database: 'قاعدة البيانات', adapter: 'محول قابل للاستبدال', modules: 'الموديولات', discovered: 'حزم مكتشفة تلقائياً', events: 'الأحداث', audit: 'HOOKS قابلة للتدقيق',
    architecture: 'معمارية المحرك', architectureCopy: 'كل الاعتماديات تتجه نحو الداخل. اللعبة وقاعدة البيانات وRedis والعمال وتطبيقات الموبايل المستقبلية تتصل عبر منافذ واضحة.',
    moduleControl: 'إدارة الموديولات', moduleCopy: 'ركّب أو احذف أو فعّل أو عطّل أي حزمة بدون تعديل الـCore.', themeControl: 'إدارة الثيمات', themeCopy: 'غيّر طبقة الواجهة بينما تبقى الموديولات وحالة اللعبة بدون تغيير.',
    liveProof: 'إثبات حي من السيرفر', crime: 'عملية من موديول الجرائم', attempt: 'نفّذ', resultWaiting: 'الواجهة لا تختار الجائزة. السيرفر سيحسب النتيجة.', ledger: 'سجل الاقتصاد', eventLog: 'سجل الأحداث والـHooks', footer: 'CORE + MODULES + THEMES + API + LEDGER + EVENTS',
    installed: 'مركّب', uninstalled: 'محذوف', enabled: 'مفعّل', disabled: 'معطّل', install: 'تركيب', uninstall: 'حذف', enable: 'تفعيل', disable: 'تعطيل', active: 'نشط', activate: 'تفعيل',
    noLedger: 'نفّذ جريمة ناجحة لإنتاج سجل مالي غير قابل للتعديل.', noEvents: 'ستظهر أحداث المحرك هنا.', serverSuccess: 'نجاح من السيرفر', serverFailure: 'فشل من السيرفر', cash: 'النقد', nerve: 'الأعصاب', energy: 'الطاقة', life: 'الحياة', level: 'المستوى'
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
  if (!response.ok) throw new Error(data.error ?? `${response.status}`);
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
  document.querySelectorAll('[data-i18n]').forEach((element) => { element.textContent = t(element.dataset.i18n); });
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
  $('#moduleList').innerHTML = state.modules.map((module) => {
    const statusText = !module.installed ? t('uninstalled') : module.enabled ? t('enabled') : t('disabled');
    const actions = !module.installed
      ? `<button data-module="${escapeHtml(module.id)}" data-action="install">${t('install')}</button>`
      : `<button data-module="${escapeHtml(module.id)}" data-action="${module.enabled ? 'disable' : 'enable'}">${module.enabled ? t('disable') : t('enable')}</button><button data-module="${escapeHtml(module.id)}" data-action="uninstall">${t('uninstall')}</button>`;
    return `<article class="package-card">
      <div class="package-top"><div><h3>${escapeHtml(module.name)}</h3><code>${escapeHtml(module.id)}@${escapeHtml(module.version)}</code></div><span class="status ${module.enabled ? 'on' : ''}">${statusText}</span></div>
      <p>${escapeHtml(state.language === 'ar' ? module.description_ar : module.description)}</p>
      <div class="chips">${[...module.provides, ...module.subscribes.map((item) => `on:${item}`)].map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div>
      <div class="package-actions">${actions}</div>
    </article>`;
  }).join('');
  document.querySelectorAll('[data-module]').forEach((button) => button.addEventListener('click', () => changeModule(button.dataset.module, button.dataset.action)));
}

function renderThemes() {
  $('#themeList').innerHTML = state.themes.map((theme) => `<article class="package-card">
    <div class="package-top"><div><h3>${escapeHtml(theme.name)}</h3><code>${escapeHtml(theme.id)}@${escapeHtml(theme.version)}</code></div><span class="theme-swatch" style="color:${escapeHtml(theme.preview)};background:${escapeHtml(theme.preview)}"></span></div>
    <p>${escapeHtml(state.language === 'ar' ? theme.description_ar : theme.description)}</p>
    <div class="package-actions">${theme.active ? `<span class="status on">${t('active')}</span>` : `<button data-theme="${escapeHtml(theme.id)}">${t('activate')}</button>`}</div>
  </article>`).join('');
  document.querySelectorAll('[data-theme]').forEach((button) => button.addEventListener('click', () => activateTheme(button.dataset.theme)));
}

function renderPlayer() {
  if (!state.player) return;
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
  $('#attemptButton').disabled = state.crimes.length === 0;
}

function renderAudit() {
  $('#ledgerList').innerHTML = state.ledger.length ? state.ledger.map((entry) => `<div class="audit-row"><code>+${Number(entry.amount).toLocaleString()} ${escapeHtml(entry.asset)}</code><span>${escapeHtml(entry.reason)} · ${escapeHtml(entry.correlation_id)}</span><span>${escapeHtml(entry.created_at)}</span></div>`).join('') : `<div class="empty-state">${t('noLedger')}</div>`;
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
}

async function refresh() {
  const [engine, modules, themes, player, crimes, ledger, events, architecture] = await Promise.all([
    api('/api/v1/engine'), api('/api/v1/modules'), api('/api/v1/themes'), api('/api/v1/player'), api('/api/v1/crimes'), api('/api/v1/ledger'), api('/api/v1/events'), api('/api/v1/architecture')
  ]);
  Object.assign(state, { engine, modules: modules.modules, themes: themes.themes, player: player.player, crimes: crimes.crimes, ledger: ledger.entries, events: events.events, architecture });
  renderAll();
}

async function attemptCrime() {
  const id = $('#crimeSelect').value;
  if (!id) return;
  const button = $('#attemptButton');
  button.disabled = true;
  try {
    const result = await api(`/api/v1/crimes/${encodeURIComponent(id)}/attempt`, { method: 'POST', body: '{}' });
    const target = $('#crimeResult');
    target.className = `result ${result.success ? '' : 'bad'}`;
    target.textContent = `${result.success ? t('serverSuccess') : t('serverFailure')} | cash ${result.reward.cash} | XP ${result.reward.xp} | event ${result.serverProof.eventId} | ${result.serverProof.calculatedBy}`;
    await refresh();
  } catch (error) {
    $('#crimeResult').className = 'result bad';
    $('#crimeResult').textContent = error.message;
    toast(error.message);
  } finally {
    button.disabled = state.crimes.length === 0;
  }
}

async function changeModule(id, action) {
  try {
    await api(`/api/v1/admin/modules/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: '{}' });
    toast(`${id}: ${action}`);
    await refresh();
  } catch (error) { toast(error.message); }
}

async function activateTheme(id) {
  try {
    await api(`/api/v1/admin/themes/${encodeURIComponent(id)}/activate`, { method: 'POST', body: '{}' });
    document.querySelector('link[href^="/engine/theme.css"]').href = `/engine/theme.css?v=${Date.now()}`;
    toast(`${id}: active`);
    await refresh();
  } catch (error) { toast(error.message); }
}

$('#languageButton').addEventListener('click', () => { state.language = state.language === 'en' ? 'ar' : 'en'; applyLanguage(); });
$('#attemptButton').addEventListener('click', attemptCrime);
$('#runCrimeButton').addEventListener('click', () => { document.querySelector('.proof-panel').scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(attemptCrime, 450); });
$('#clearTraceButton').addEventListener('click', () => { $('#apiTrace').textContent = ''; });

refresh().then(applyLanguage).catch((error) => { toast(error.message); $('#apiTrace').textContent = error.stack ?? error.message; });
