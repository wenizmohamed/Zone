const ACTIVE_CACHE = 'zone.platform.activeRelease';
const PREVIEW_CACHE = 'zone.platform.previewRelease';

const state = {
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
  territoryCatalog: { revision: '', factions: [], blocks: [], summary: {} },
  selectedTerritory: null,
  pendingTerritoryOwner: null,
  territorySearch: '',
  territoryOwnerFilter: 'all',
  territoryStateFilter: 'all',
  territorySectorFilter: 'all',
  territoryBusy: false,
  territoryError: '',
  territoryMapReady: false,
  dirty: false,
};

const translations = {
  en: {
    controlPlane: 'ADMIN CONTROL PLANE', engine: 'Engine', game: 'Open game', publish: 'Publish release', sourceOwned: 'FULL SOURCE OWNERSHIP',
    zonePlatform: 'ZONE PLATFORM', engineVersion: 'ENGINE 1.0', apiFirst: 'PHP 8.5 + API FIRST', controlCenter: 'CONTROL CENTER', visualBuilder: 'VISUAL BUILDER', extensionSystem: 'EXTENSION SYSTEM', contentStudio: 'CONTENT STUDIO', themePackages: 'THEME PACKAGES', tokens: 'TOKENS', mediaPipeline: 'MEDIA PIPELINE', auditableEconomy: 'AUDITABLE ECONOMY', ledger: 'LEDGER', resources: 'RESOURCES', eventBus: 'EVENT BUS', eventsLabel: 'EVENTS', audit: 'AUDIT', versionControl: 'VERSION CONTROL', history: 'HISTORY',
    overview: 'Platform overview', overviewSub: 'One control plane for the engine, modules, content, releases, and the live game.', releaseHistory: 'Release history', publishPipeline: 'Publishing pipeline', systemHealth: 'System health', recentEvents: 'Recent events',
    builder: 'Page builder', builderSub: 'Build bilingual responsive game pages from engine-registered blocks.', saveDraft: 'Save draft', preview: 'Refresh preview', pages: 'Pages', choosePage: 'Choose a page or create a new one.', titleEnglish: 'Title in English', titleArabic: 'Title in Arabic', slug: 'Slug', enabledInGame: 'Enabled in game', blocks: 'Registered blocks', addBlock: 'Add block', livePreview: 'Draft game preview', gamePreview: 'Game preview', desktop: 'Desktop', mobile: 'Mobile', blockHero: 'Hero', blockText: 'Text', blockCallout: 'Callout', blockStatGrid: 'Stat grid', blockActionGrid: 'Action grid',
    modules: 'Module manager', modulesSub: 'Install, update, enable, disable, and inspect independent game systems.', content: 'Game content', contentSub: 'Create and balance server-authoritative crimes and release-bound player content.', crimeCatalog: 'Crime catalog', contentDomains: 'Content domains', newCrime: 'New crime', crimeEditor: 'Crime editor', crimeId: 'Crime ID', crimeNameEn: 'English name', crimeNameAr: 'Arabic name', nerveCost: 'Nerve cost', successRate: 'Success percent', cashMinimum: 'Cash minimum', cashMaximum: 'Cash maximum', xpReward: 'XP reward', saveCrime: 'Save crime', domainEvents: 'Domain events', adminAudit: 'Admin audit',
    themes: 'Theme studio', themesSub: 'Change the presentation layer without changing game rules or player state.', releaseBranding: 'Release branding', brandEnglish: 'Brand in English', brandArabic: 'Brand in Arabic', accent: 'Accent color', announcementEnabled: 'Announcement enabled', announcementEnglish: 'Announcement in English', announcementArabic: 'Announcement in Arabic',
    assets: 'Asset library', assetsSub: 'One typed registry for images, thumbnails, animation, video, GLB, and GLTF.', economy: 'Economy and balance', economySub: 'Every reward and transfer is traceable through an immutable correlation trail.', economyLedger: 'Economy ledger', sharedSystems: 'Shared systems', events: 'Events and hooks', eventsSub: 'Modules react through contracts without editing the originating system.', releases: 'Releases and rollback', releasesSub: 'Draft changes, validate them, publish an immutable snapshot, and restore any prior release.', apiTrace: 'API trace', clearTrace: 'Clear trace',
    ready: 'READY', metricEngine: 'ENGINE', metricActiveRelease: 'ACTIVE RELEASE', metricModules: 'MODULES', metricContent: 'CONTENT', metricAuditEvents: 'AUDIT EVENTS', serverAuthoritative: 'server authoritative', enabledPackages: 'enabled packages', crimeDefinitions: 'crime definitions', recentHooks: 'recent hooks', healthPhp: 'PHP runtime', healthDatabase: 'Database adapter', healthCache: 'Cache adapter', healthApi: 'API', healthAuthority: 'Player authority', server: 'SERVER', unknown: 'UNKNOWN', blocksCount: 'BLOCKS', english: 'English', arabic: 'Arabic', moveUp: 'Move block up', moveDown: 'Move block down', removeBlock: 'Remove block', addPage: 'Add page', installed: 'INSTALLED', uninstalled: 'UNINSTALLED', enabled: 'ENABLED', disabled: 'DISABLED', install: 'INSTALL', enable: 'ENABLE', disable: 'DISABLE', uninstall: 'UNINSTALL', active: 'ACTIVE', available: 'AVAILABLE', activate: 'ACTIVATE', viewPackage: 'VIEW PACKAGE', noGameLogic: 'NO GAME LOGIC', crime: 'Crime', nerve: 'Nerve', success: 'Success', cash: 'Cash', xp: 'XP', action: 'Action', edit: 'EDIT', newLabel: 'NEW', disabledLabel: 'DISABLED', reason: 'Reason', amount: 'Amount', balance: 'Balance', player: 'Player', correlation: 'Correlation', event: 'Event', time: 'Time', module: 'Module', payload: 'Payload', eventBusLabel: 'EVENT BUS', rollback: 'ROLL BACK', noLedger: 'Run a server proof in the Engine to generate a ledger entry.', noEvents: 'No engine events have been emitted yet.', noAudit: 'No administrator mutations have been recorded yet.', noOverviewEvents: 'No events yet', noPages: 'No custom pages yet', noBlocks: 'Add the first registered block', noReleases: 'No release has been published yet', adminReady: 'ZONE ADMIN READY', contentEnglish: 'English content', contentArabic: 'Arabic content',
    territoryControl: 'CITY CONTROL', territories: 'City & Territories', territoriesSub: 'Inspect all 120 city blocks and apply live faction ownership through the server-authoritative territory engine.', refreshTerritories: 'Refresh live state', territoryMap: 'Live territory map', territoryBlocks: 'Territory blocks', searchBlocks: 'Search blocks', searchBlocksPlaceholder: 'ID, name, district, owner, or benefit', ownerFilter: 'Owner', stateFilter: 'State', sectorFilter: 'Sector', blockDetails: 'Selected block', chooseTerritory: 'Choose a block to inspect its live state and ownership.', allOwners: 'All owners', allStates: 'All states', allSectors: 'All sectors', neutral: 'Neutral', owned: 'Owned', contested: 'Contested', totalBlocks: 'Total blocks', ownedBlocks: 'Faction controlled', neutralBlocks: 'Neutral blocks', contestedBlocks: 'Contested blocks', sector: 'Sector', size: 'Size', density: 'Density', slots: 'Wall slots', dailyRespect: 'Daily respect', benefits: 'Benefits', neighbors: 'Neighbors', liveOwner: 'Live owner', stateVersion: 'State version', updatedAt: 'Updated', applyOwnership: 'Apply ownership', ownershipHelp: 'This changes live server state immediately and records an admin audit event.', ownershipUpdated: 'Territory ownership updated and verified from the server.', noTerritoryResults: 'No territory blocks match these filters.', territoryUnavailable: 'Territory data is currently unavailable.', loadingTerritories: 'Loading territory state...', results: 'results', control: 'Control', version: 'Version', district: 'District', noBenefits: 'No configured benefits', noNeighbors: 'No adjacent blocks', live: 'LIVE', apply: 'APPLY',
  },
  ar: {
    controlPlane: 'لوحة تحكم الإدارة', engine: 'المحرك', game: 'افتح اللعبة', publish: 'انشر الإصدار', sourceOwned: 'ملكية كاملة للسورس',
    zonePlatform: 'منصة ZONE', engineVersion: 'المحرك 1.0', apiFirst: 'PHP 8.5 + واجهة API أولا', controlCenter: 'مركز التحكم', visualBuilder: 'المصمم المرئي', extensionSystem: 'نظام الإضافات', contentStudio: 'استوديو المحتوى', themePackages: 'حزم الثيمات', tokens: 'المتغيرات', mediaPipeline: 'مسار الوسائط', auditableEconomy: 'اقتصاد قابل للتدقيق', ledger: 'السجل', resources: 'الموارد', eventBus: 'ناقل الأحداث', eventsLabel: 'الأحداث', audit: 'التدقيق', versionControl: 'إدارة الإصدارات', history: 'السجل',
    overview: 'نظرة عامة على المنصة', overviewSub: 'لوحة واحدة للمحرك والموديولات والمحتوى والإصدارات واللعبة المباشرة.', releaseHistory: 'سجل الإصدارات', publishPipeline: 'مسار النشر', systemHealth: 'حالة النظام', recentEvents: 'آخر الأحداث',
    builder: 'مصمم الصفحات', builderSub: 'أنشئ صفحات عربية وإنجليزية متجاوبة من بلوكات مسجلة في المحرك.', saveDraft: 'حفظ المسودة', preview: 'تحديث المعاينة', pages: 'الصفحات', choosePage: 'اختر صفحة أو أنشئ صفحة جديدة.', titleEnglish: 'العنوان بالإنجليزية', titleArabic: 'العنوان بالعربية', slug: 'المسار', enabledInGame: 'مفعلة داخل اللعبة', blocks: 'البلوكات المسجلة', addBlock: 'إضافة بلوك', livePreview: 'معاينة مسودة اللعبة', gamePreview: 'معاينة اللعبة', desktop: 'سطح المكتب', mobile: 'الهاتف', blockHero: 'واجهة رئيسية', blockText: 'نص', blockCallout: 'تنبيه', blockStatGrid: 'شبكة الإحصاءات', blockActionGrid: 'شبكة الإجراءات',
    modules: 'إدارة الموديولات', modulesSub: 'ركب وحدث وفعل وعطل أنظمة اللعبة المستقلة.', content: 'محتوى اللعبة', contentSub: 'أنشئ ووازن الجرائم المحسوبة في السيرفر والمحتوى المرتبط بالإصدار.', crimeCatalog: 'كتالوج الجرائم', contentDomains: 'مجالات المحتوى', newCrime: 'جريمة جديدة', crimeEditor: 'محرر الجرائم', crimeId: 'معرف الجريمة', crimeNameEn: 'الاسم بالإنجليزية', crimeNameAr: 'الاسم بالعربية', nerveCost: 'تكلفة الأعصاب', successRate: 'نسبة النجاح', cashMinimum: 'أقل مكافأة', cashMaximum: 'أعلى مكافأة', xpReward: 'مكافأة الخبرة', saveCrime: 'حفظ الجريمة', domainEvents: 'أحداث النطاق', adminAudit: 'سجل الإدارة',
    themes: 'استوديو الثيمات', themesSub: 'غير طبقة العرض من دون تغيير قوانين اللعب أو بيانات اللاعب.', releaseBranding: 'هوية الإصدار', brandEnglish: 'الاسم بالإنجليزية', brandArabic: 'الاسم بالعربية', accent: 'لون الهوية', announcementEnabled: 'تفعيل الإعلان', announcementEnglish: 'الإعلان بالإنجليزية', announcementArabic: 'الإعلان بالعربية',
    assets: 'مكتبة الملفات', assetsSub: 'سجل موحد للصور والمصغرات والأنيميشن والفيديو و GLB و GLTF.', economy: 'الاقتصاد والتوازن', economySub: 'كل مكافأة وتحويل قابل للتتبع عبر سجل ومعرف ترابط.', economyLedger: 'سجل الاقتصاد', sharedSystems: 'الأنظمة المشتركة', events: 'الأحداث والـ Hooks', eventsSub: 'الموديولات تتفاعل عبر عقود من دون تعديل النظام الأصلي.', releases: 'الإصدارات والرجوع', releasesSub: 'عدّل المسودة وافحصها وانشر نسخة ثابتة وارجع لأي إصدار سابق.', apiTrace: 'تتبع الـ API', clearTrace: 'مسح التتبع',
    ready: 'جاهز', metricEngine: 'المحرك', metricActiveRelease: 'الإصدار النشط', metricModules: 'الموديولات', metricContent: 'المحتوى', metricAuditEvents: 'سجلات التدقيق', serverAuthoritative: 'محسوب بالكامل في الخادم', enabledPackages: 'حزم مفعلة', crimeDefinitions: 'تعريفات الجرائم', recentHooks: 'أحداث حديثة', healthPhp: 'تشغيل PHP', healthDatabase: 'موصل قاعدة البيانات', healthCache: 'موصل التخزين المؤقت', healthApi: 'واجهة API', healthAuthority: 'سلطة اللاعب', server: 'الخادم', unknown: 'غير معروف', blocksCount: 'بلوكات', english: 'الإنجليزية', arabic: 'العربية', moveUp: 'نقل البلوك لأعلى', moveDown: 'نقل البلوك لأسفل', removeBlock: 'حذف البلوك', addPage: 'إضافة صفحة', installed: 'مثبت', uninstalled: 'غير مثبت', enabled: 'مفعل', disabled: 'معطل', install: 'تثبيت', enable: 'تفعيل', disable: 'تعطيل', uninstall: 'إزالة', active: 'نشط', available: 'متاح', activate: 'تفعيل', viewPackage: 'عرض الحزمة', noGameLogic: 'بلا منطق لعب', crime: 'الجريمة', nerve: 'الجرأة', success: 'النجاح', cash: 'النقود', xp: 'الخبرة', action: 'الإجراء', edit: 'تعديل', newLabel: 'جديد', disabledLabel: 'معطلة', reason: 'السبب', amount: 'المبلغ', balance: 'الرصيد', player: 'اللاعب', correlation: 'معرف الترابط', event: 'الحدث', time: 'الوقت', module: 'الموديول', payload: 'البيانات', eventBusLabel: 'ناقل الأحداث', rollback: 'رجوع', noLedger: 'شغل إثباتا من المحرك لإنشاء قيد اقتصادي.', noEvents: 'لم يصدر المحرك أي أحداث بعد.', noAudit: 'لم تسجل أي تعديلات إدارية بعد.', noOverviewEvents: 'لا توجد أحداث بعد', noPages: 'لا توجد صفحات مخصصة', noBlocks: 'أضف أول بلوك مسجل', noReleases: 'لم يتم نشر أي إصدار بعد', adminReady: 'لوحة إدارة ZONE جاهزة', contentEnglish: 'المحتوى بالإنجليزية', contentArabic: 'المحتوى بالعربية',
    territoryControl: 'السيطرة على المدينة', territories: 'المدينة والأراضي', territoriesSub: 'راقب قطاعات المدينة الـ120 وغيّر ملكية العصابات مباشرة عبر محرك الأراضي المحسوب في الخادم.', refreshTerritories: 'تحديث الحالة المباشرة', territoryMap: 'خريطة الأراضي المباشرة', territoryBlocks: 'قطاعات الأراضي', searchBlocks: 'البحث في القطاعات', searchBlocksPlaceholder: 'المعرف أو الاسم أو المنطقة أو المالك أو الميزة', ownerFilter: 'المالك', stateFilter: 'الحالة', sectorFilter: 'الحزام', blockDetails: 'القطاع المحدد', chooseTerritory: 'اختر قطاعا لعرض حالته وملكيته المباشرة.', allOwners: 'كل المالكين', allStates: 'كل الحالات', allSectors: 'كل الأحزمة', neutral: 'محايد', owned: 'مملوك', contested: 'متنازع عليه', totalBlocks: 'إجمالي القطاعات', ownedBlocks: 'تحت سيطرة العصابات', neutralBlocks: 'قطاعات محايدة', contestedBlocks: 'قطاعات متنازع عليها', sector: 'الحزام', size: 'الحجم', density: 'الكثافة', slots: 'خانات الدفاع', dailyRespect: 'الاحترام اليومي', benefits: 'المزايا', neighbors: 'القطاعات المجاورة', liveOwner: 'المالك المباشر', stateVersion: 'إصدار الحالة', updatedAt: 'آخر تحديث', applyOwnership: 'تطبيق الملكية', ownershipHelp: 'هذا الإجراء يغيّر حالة الخادم مباشرة ويسجل حدث تدقيق إداري.', ownershipUpdated: 'تم تحديث ملكية الأرض والتحقق منها من الخادم.', noTerritoryResults: 'لا توجد قطاعات تطابق عوامل التصفية.', territoryUnavailable: 'بيانات الأراضي غير متاحة حاليا.', loadingTerritories: 'جار تحميل حالة الأراضي...', results: 'نتيجة', control: 'السيطرة', version: 'الإصدار', district: 'المنطقة', noBenefits: 'لا توجد مزايا محددة', noNeighbors: 'لا توجد قطاعات مجاورة', live: 'مباشر', apply: 'تطبيق',
  },
};

const navItems = [
  ['overview', '01', 'Overview', 'نظرة عامة'], ['builder', '02', 'Page Builder', 'مصمم الصفحات'], ['modules', '03', 'Modules', 'الموديولات'],
  ['content', '04', 'Content', 'المحتوى'], ['territories', '05', 'City & Territories', 'المدينة والأراضي'], ['themes', '06', 'Themes', 'الثيمات'], ['assets', '07', 'Assets', 'الملفات'],
  ['economy', '08', 'Economy', 'الاقتصاد'], ['events', '09', 'Events', 'الأحداث'], ['releases', '10', 'Releases', 'الإصدارات'],
];

const contentDomains = [
  [{ en: 'Items', ar: 'العناصر' }, { en: 'Weapons, armor, medical, boosters', ar: 'الأسلحة والدروع والعلاج والمعززات' }], [{ en: 'Crimes', ar: 'الجرائم' }, { en: 'Odds, nerve, rewards, outcomes', ar: 'الاحتمالات والجرأة والمكافآت والنتائج' }], [{ en: 'Cities', ar: 'المدن' }, { en: 'Travel, maps, availability', ar: 'السفر والخرائط والتوفر' }],
  [{ en: 'Jobs', ar: 'الوظائف' }, { en: 'Ranks, wages, perks', ar: 'الرتب والرواتب والمزايا' }], [{ en: 'Education', ar: 'التعليم' }, { en: 'Courses, duration, bonuses', ar: 'الدورات والمدد والمكافآت' }], [{ en: 'Factions', ar: 'العصابات' }, { en: 'Wars, upgrades, territory', ar: 'الحروب والترقيات والمناطق' }],
  [{ en: 'Market', ar: 'السوق' }, { en: 'Listings, fees, transfers', ar: 'العروض والرسوم والتحويلات' }], [{ en: 'Combat', ar: 'القتال' }, { en: 'Opponents, weapons, results', ar: 'الخصوم والأسلحة والنتائج' }], [{ en: 'Missions', ar: 'المهام' }, { en: 'Objectives, conditions, rewards', ar: 'الأهداف والشروط والمكافآت' }],
];

const assets = [
  ['WEBP', { en: 'Crime artwork', ar: 'رسومات الجرائم' }, { en: 'Responsive image and thumbnail variants', ar: 'صور متجاوبة ونسخ مصغرة' }], ['AVIF', { en: 'City environments', ar: 'بيئات المدن' }, { en: 'High-efficiency scene delivery', ar: 'عرض مشاهد عالي الكفاءة' }],
  ['SVG', { en: 'Interface icon system', ar: 'نظام أيقونات الواجهة' }, { en: 'Theme-aware vector assets', ar: 'ملفات متجهة متوافقة مع الثيم' }], ['MP4', { en: 'Animated story content', ar: 'محتوى قصصي متحرك' }, { en: 'Streaming video asset', ar: 'ملف فيديو للبث' }],
  ['GLB', { en: 'Character model', ar: 'نموذج الشخصية' }, { en: 'Compressed 3D model with animation', ar: 'نموذج ثلاثي الأبعاد مضغوط مع حركة' }], ['GLTF', { en: 'Weapon catalogue', ar: 'كتالوج الأسلحة' }, { en: 'Materials, meshes, and metadata', ar: 'الخامات والمجسمات والبيانات الوصفية' }],
];

const resources = [
  [{ en: 'Energy', ar: 'الطاقة' }, { en: 'Actions, combat, training', ar: 'الإجراءات والقتال والتدريب' }], [{ en: 'Nerve', ar: 'الجرأة' }, { en: 'Crime attempts and regeneration', ar: 'محاولات الجرائم والتجدد' }], [{ en: 'Life', ar: 'الصحة' }, { en: 'Combat health and recovery', ar: 'صحة القتال والتعافي' }],
  [{ en: 'Happiness', ar: 'المعنويات' }, { en: 'Training multiplier and property cap', ar: 'مضاعف التدريب وحد العقار' }], [{ en: 'Cooldowns', ar: 'فترات الانتظار' }, { en: 'Shared time-based restrictions', ar: 'قيود زمنية مشتركة' }], [{ en: 'Buffs', ar: 'التعزيزات' }, { en: 'Typed temporary and permanent modifiers', ar: 'مؤثرات مؤقتة ودائمة محددة النوع' }],
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const t = (key) => translations[state.language][key] ?? translations.en[key] ?? key;
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const localized = (value) => value?.[state.language] ?? value?.en ?? '';
const stamp = () => new Date().toLocaleTimeString();
const blockLabel = (type) => t({ hero: 'blockHero', text: 'blockText', callout: 'blockCallout', 'stat-grid': 'blockStatGrid', 'action-grid': 'blockActionGrid' }[type] ?? type);
const safeColor = (value, fallback = '#68717b') => /^#[0-9a-f]{6}$/i.test(String(value ?? '')) ? String(value) : fallback;
const territoryStateLabel = (value) => t({ neutral: 'neutral', owned: 'owned', contested: 'contested' }[value] ?? value);

function normalizeTerritoryCatalog(payload) {
  const source = payload?.territories ?? payload?.map ?? payload ?? {};
  const factions = Array.isArray(source.factions) ? source.factions : [];
  const blocks = Array.isArray(source.blocks) ? source.blocks : [];
  return {
    revision: String(source.revision ?? ''),
    playerFactionId: source.playerFactionId ?? null,
    neutralColor: safeColor(source.neutralColor),
    factions,
    blocks,
    summary: source.summary && typeof source.summary === 'object' ? source.summary : {},
  };
}

function territoryBlockName(block) {
  return localized(block?.name) || block?.id || '';
}

function factionName(faction) {
  return localized(faction?.name) || faction?.id || '';
}

function formatTerritoryBenefit(benefit) {
  const value = Number(benefit?.value ?? 0);
  const unit = String(benefit?.unit ?? '');
  if (unit === 'basis-points') return `${(value / 100).toLocaleString(state.language, { maximumFractionDigits: 2 })}%`;
  if (unit === 'cash/hour') return `${value.toLocaleString(state.language)} ${state.language === 'ar' ? 'نقد / ساعة' : 'cash / hour'}`;
  if (unit === 'percent') return `${value.toLocaleString(state.language)}%`;
  return `${value.toLocaleString(state.language)}${unit ? ` ${unit}` : ''}`;
}

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
  const response = await fetch(path, {
    ...options,
    headers,
  });
  const data = await response.json().catch(() => ({ error: `Non-JSON response from ${path}` }));
  trace(method, path, payload, data, response.status);
  if (!response.ok) throw new Error(data.error ?? `${response.status} ${response.statusText}`);
  return data;
}

function deepCopy(value) { return JSON.parse(JSON.stringify(value)); }
function currentManifest() { return state.draft?.manifest; }
function runtimeContentSnapshot() {
  return {
    crimes: deepCopy(state.crimes.map(({ correlationId, ...crime }) => crime)),
    engineModules: deepCopy(state.modules),
    themes: deepCopy(state.themes),
    activeTheme: state.themes.find((theme) => theme.active)?.id ?? null,
    assets: assets.map(([type, name, detail]) => ({ type, name: deepCopy(name), detail: deepCopy(detail) })),
    capturedAt: new Date().toISOString(),
  };
}
function manifestWithRuntimeContent() {
  const manifest = deepCopy(currentManifest());
  manifest.content = runtimeContentSnapshot();
  return manifest;
}
function markDirty() {
  state.dirty = true;
  $('#pipelineStatus').textContent = state.language === 'ar' ? 'مسودة معدلة' : 'DRAFT CHANGED';
  $('#pipelineStatus').className = 'status warn';
  updatePreviewCache();
  clearTimeout(markDirty.previewTimer);
  markDirty.previewTimer = setTimeout(() => refreshViewPreview(state.view), 180);
}

function applyLanguage() {
  const arabic = state.language === 'ar';
  document.documentElement.lang = state.language;
  document.documentElement.dir = arabic ? 'rtl' : 'ltr';
  document.title = arabic ? 'ZONE | لوحة تحكم الإدارة' : 'ZONE Admin Control Plane';
  $('#languageButton').textContent = arabic ? 'English' : 'العربية';
  $('#languageButton').setAttribute('aria-label', arabic ? 'Switch the admin interface to English' : 'تغيير واجهة الإدارة إلى العربية');
  $('#addPageButton').setAttribute('aria-label', t('addPage'));
  $$('#previewFrame, .section-preview-frame').forEach((frame) => frame.setAttribute('title', arabic ? 'معاينة مباشرة للعبة ZONE' : 'Live preview of the ZONE game'));
  $('#territoryMapPreview')?.setAttribute('title', arabic ? 'خريطة أراضي ZONE المباشرة' : 'ZONE live territory map');
  $('#clearTraceButton').setAttribute('aria-label', arabic ? 'مسح تتبع واجهة API' : 'Clear API trace');
  if (!state.dirty) $('#pipelineStatus').textContent = t('ready');
  $$('[data-copy]').forEach((element) => { element.textContent = t(element.dataset.copy); });
  $$('[data-copy-placeholder]').forEach((element) => { element.placeholder = t(element.dataset.copyPlaceholder); });
  $$('[data-preview-toggle]').forEach(updatePreviewToggleLabel);
  renderAll();
  ensureTerritoryMapPreview();
  if (state.draft) refreshViewPreview(state.view);
}

const previewScreens = { overview: 'home', modules: 'crimes', content: 'crimes', themes: 'home', assets: 'items', economy: 'home', events: 'home', releases: 'home' };
function installSectionPreviews() {
  Object.entries(previewScreens).forEach(([view, screen]) => {
    const section = $(`.view[data-view="${view}"]`);
    if (!section || section.querySelector('[data-section-preview]')) return;
    section.insertAdjacentHTML('beforeend', `<article class="panel section-preview" data-section-preview data-preview-screen="${screen}"><div class="preview-toolbar"><strong data-copy="gamePreview">Game preview</strong><div><button class="viewport-button active" data-width="100%" type="button" data-copy="desktop">Desktop</button><button class="viewport-button" data-width="390px" type="button" data-copy="mobile">Mobile</button><button class="button ghost preview-refresh" data-preview-refresh type="button" data-copy="preview">Refresh preview</button><button class="preview-collapse" data-preview-toggle type="button" aria-expanded="true" aria-controls="sectionPreviewStage-${view}">Collapse preview</button></div></div><div class="preview-stage section-preview-stage" id="sectionPreviewStage-${view}"><iframe class="section-preview-frame" title="Live preview of the ZONE game"></iframe></div></article>`);
  });
}

function updatePreviewToggleLabel(button) {
  const expanded = button.getAttribute('aria-expanded') === 'true';
  const isMap = button.getAttribute('aria-controls') === 'territoryMapStage';
  const isTrace = button.getAttribute('aria-controls') === 'apiTrace';
  const label = state.language === 'ar'
    ? (expanded ? (isMap ? 'طي الخريطة' : isTrace ? 'طي التتبع' : 'طي المعاينة') : (isMap ? 'عرض الخريطة' : isTrace ? 'عرض التتبع' : 'عرض المعاينة'))
    : (expanded ? (isMap ? 'Collapse map' : isTrace ? 'Collapse trace' : 'Collapse preview') : (isMap ? 'Expand map' : isTrace ? 'Expand trace' : 'Expand preview'));
  button.textContent = label;
  button.setAttribute('aria-label', label);
}

function togglePreview(button) {
  const stage = document.getElementById(button.getAttribute('aria-controls'));
  if (!stage) return;
  const expanded = button.getAttribute('aria-expanded') !== 'true';
  stage.hidden = !expanded;
  button.closest('.builder-preview, .section-preview, .territory-map-panel')?.classList.toggle('preview-collapsed', !expanded);
  button.setAttribute('aria-expanded', String(expanded));
  updatePreviewToggleLabel(button);
  if (expanded && stage.querySelector('iframe') && !stage.querySelector('iframe').getAttribute('src')) {
    const view = button.closest('.view')?.dataset.view;
    if (view === 'territories') ensureTerritoryMapPreview();
    else if (view) refreshViewPreview(view);
  }
}

function renderNavigation() {
  $('#adminNav').innerHTML = navItems.map(([id, number, en, ar]) => `<button class="nav-button ${state.view === id ? 'active' : ''}" type="button" data-nav="${id}"><span>${number}</span><b>${state.language === 'ar' ? ar : en}</b></button>`).join('');
  $$('[data-nav]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.nav)));
}

function setView(view) {
  state.view = view;
  $$('.view').forEach((element) => element.classList.toggle('active', element.dataset.view === view));
  renderNavigation();
  if (view === 'territories') {
    ensureTerritoryMapPreview();
    pushTerritoryMap();
  }
  refreshViewPreview(view);
}

function renderOverview() {
  const activeRelease = state.engine?.activeReleaseVersion ?? 0;
  const enabledModules = state.modules.filter((module) => module.installed && module.enabled).length;
  const metrics = [
    [t('metricEngine'), state.engine?.version ?? '...', t('serverAuthoritative')], [t('metricActiveRelease'), `v${activeRelease}`, state.engine?.activeReleaseId ?? (state.language === 'ar' ? 'الأساس' : 'foundation')],
    [t('metricModules'), `${enabledModules}/${state.modules.length}`, t('enabledPackages')], [t('metricContent'), state.crimes.length, t('crimeDefinitions')], [t('metricAuditEvents'), state.events.length, t('recentHooks')],
  ];
  $('#metrics').innerHTML = metrics.map(([label, value, detail]) => `<article class="metric"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(detail)}</small></article>`).join('');
  const steps = state.language === 'ar'
    ? [['01', 'مسودة', 'تعديلات معزولة'], ['02', 'فحص', 'المخطط والاعتماديات'], ['03', 'معاينة', 'سطح المكتب والهاتف'], ['04', 'نشر', 'نسخة ثابتة'], ['05', 'اللعبة', 'تقرأ الإصدار النشط']]
    : [['01', 'Draft', 'Isolated changes'], ['02', 'Validate', 'Schema and dependencies'], ['03', 'Preview', 'Desktop and mobile'], ['04', 'Publish', 'Immutable snapshot'], ['05', 'Game', 'Loads active release']];
  $('#pipeline').innerHTML = steps.map(([number, label, detail]) => `<article class="pipeline-step"><span>${number}</span><strong>${esc(label)}</strong><small>${esc(detail)}</small></article>`).join('');
  const health = [
    [t('healthPhp'), state.engine?.php ?? '...'], [t('healthDatabase'), state.engine?.database?.toUpperCase() ?? '...'], [t('healthCache'), state.engine?.cacheAdapter?.toUpperCase() ?? '...'],
    [t('healthApi'), state.engine?.api?.toUpperCase() ?? '...'], [t('healthAuthority'), state.engine?.serverAuthoritative ? t('server') : t('unknown')],
  ];
  $('#healthList').innerHTML = health.map(([label, value]) => `<div class="health-row"><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join('');
  $('#overviewEvents').innerHTML = state.events.slice(0, 7).map((event) => `<div class="compact-row"><div><code dir="ltr">${esc(event.event_name)}</code><small>${esc(event.occurred_at)}</small></div></div>`).join('') || `<div class="empty-state">${t('noOverviewEvents')}</div>`;
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
  $('#pageList').innerHTML = pages.map((page) => `<button class="page-item ${state.selectedPage === page.id ? 'active' : ''}" type="button" data-page-id="${esc(page.id)}"><strong>${esc(localized(page.title))}</strong><small dir="ltr">/${esc(page.slug)} · ${page.blocks.length} ${t('blocksCount')}</small></button>`).join('') || `<div class="empty-state">${t('noPages')}</div>`;
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
  $('#blockList').innerHTML = page.blocks.map((block, index) => `<article class="block-card" data-block-id="${esc(block.id)}"><div class="block-card-head"><code>${esc(blockLabel(block.type))}</code><button class="icon-button" data-move="up" data-index="${index}" type="button" aria-label="${esc(t('moveUp'))}">↑</button><button class="icon-button" data-move="down" data-index="${index}" type="button" aria-label="${esc(t('moveDown'))}">↓</button><button class="icon-button" data-remove-block="${index}" type="button" aria-label="${esc(t('removeBlock'))}">×</button></div><div class="block-fields"><label>${t('contentEnglish')}<textarea rows="3" dir="ltr" data-block-lang="en" data-index="${index}">${esc(block.content.en)}</textarea></label><label>${t('contentArabic')}<textarea rows="3" dir="rtl" data-block-lang="ar" data-index="${index}">${esc(block.content.ar)}</textarea></label></div></article>`).join('') || `<div class="empty-state">${t('noBlocks')}</div>`;
  $$('[data-block-lang]').forEach((input) => input.addEventListener('input', () => { page.blocks[Number(input.dataset.index)].content[input.dataset.blockLang] = input.value; markDirty(); }));
  $$('[data-remove-block]').forEach((button) => button.addEventListener('click', () => { page.blocks.splice(Number(button.dataset.removeBlock), 1); markDirty(); renderBuilder(); }));
  $$('[data-move]').forEach((button) => button.addEventListener('click', () => moveBlock(page, Number(button.dataset.index), button.dataset.move === 'up' ? -1 : 1)));
}

function renderPageListOnly() {
  const selected = state.selectedPage;
  const pages = currentManifest().pages;
  $('#pageList').innerHTML = pages.map((page) => `<button class="page-item ${selected === page.id ? 'active' : ''}" type="button" data-page-id="${esc(page.id)}"><strong>${esc(localized(page.title))}</strong><small dir="ltr">/${esc(page.slug)} · ${page.blocks.length} ${t('blocksCount')}</small></button>`).join('');
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
    const status = !module.installed ? t('uninstalled') : module.enabled ? t('enabled') : t('disabled');
    const actions = !module.installed
      ? `<button class="button secondary" data-module-action="install" data-module-id="${esc(module.id)}">${t('install')}</button>`
      : `<button class="button secondary" data-module-action="${module.enabled ? 'disable' : 'enable'}" data-module-id="${esc(module.id)}">${module.enabled ? t('disable') : t('enable')}</button><button class="button danger" data-module-action="uninstall" data-module-id="${esc(module.id)}">${t('uninstall')}</button>`;
    return `<article class="catalog-card"><div class="catalog-card-head"><div><h2>${esc(module.name)}</h2><code dir="ltr">${esc(module.id)}@${esc(module.version)}</code></div><span class="status ${module.enabled ? 'active' : ''}">${status}</span></div><p>${esc(state.language === 'ar' ? module.description_ar : module.description)}</p><div class="chips" dir="ltr">${[...module.provides, ...module.subscribes.map((name) => `on:${name}`)].map((name) => `<span>${esc(name)}</span>`).join('')}</div><div class="card-actions">${actions}</div></article>`;
  }).join('');
  $$('[data-module-action]').forEach((button) => button.addEventListener('click', () => mutateModule(button.dataset.moduleId, button.dataset.moduleAction)));
}

function renderThemes() {
  $('#themeGrid').innerHTML = state.themes.map((theme) => `<article class="catalog-card"><div class="catalog-card-head"><div><h2>${esc(theme.name)}</h2><code dir="ltr">${esc(theme.id)}@${esc(theme.version)}</code></div><span class="status ${theme.active ? 'active' : ''}">${theme.active ? t('active') : t('available')}</span></div><p>${esc(state.language === 'ar' ? theme.description_ar : theme.description)}</p><div class="chips"><span>${t('viewPackage')}</span><span dir="ltr">RTL</span><span dir="ltr">LTR</span><span>${t('noGameLogic')}</span></div><div class="card-actions"><button class="button secondary" type="button" data-theme-id="${esc(theme.id)}" ${theme.active ? 'disabled' : ''}>${theme.active ? t('active') : t('activate')}</button></div></article>`).join('');
  $$('[data-theme-id]').forEach((button) => button.addEventListener('click', () => activateTheme(button.dataset.themeId)));
  bindManifestInputs();
}

function renderContent() {
  const header = `<div class="table-row header"><span>${t('crime')}</span><span>${t('nerve')}</span><span>${t('success')}</span><span>${t('cash')}</span><span>${t('xp')}</span><span>${t('action')}</span></div>`;
  $('#crimeTable').innerHTML = header + state.crimes.map((crime) => `<div class="table-row ${crime.enabled ? '' : 'disabled'}"><strong>${esc(state.language === 'ar' ? crime.name_ar : crime.name_en)}<small>${crime.enabled ? '' : ` · ${t('disabledLabel')}`}</small></strong><code>${crime.nerve_cost}</code><code>${crime.successRate}%</code><code>${Number(crime.cash_min).toLocaleString()} - ${Number(crime.cash_max).toLocaleString()}</code><code>${crime.xp_reward}</code><button class="button ghost" type="button" data-edit-crime="${esc(crime.id)}">${t('edit')}</button></div>`).join('');
  $$('[data-edit-crime]').forEach((button) => button.addEventListener('click', () => { state.selectedCrime = button.dataset.editCrime; renderContent(); }));
  $('#contentDomains').innerHTML = contentDomains.map(([name, detail]) => `<div class="domain"><strong>${esc(localized(name))}</strong><span>${esc(localized(detail))}</span></div>`).join('');
  const crime = state.crimes.find((item) => item.id === state.selectedCrime) ?? null;
  $('#crimeEditorStatus').textContent = crime ? t('edit') : t('newLabel');
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

function territoryCounts() {
  const blocks = state.territoryCatalog.blocks;
  const neutral = blocks.filter((block) => block.ownerFactionId === null).length;
  const contested = blocks.filter((block) => block.state === 'contested').length;
  return { total: blocks.length, owned: blocks.length - neutral, neutral, contested };
}

function filteredTerritoryBlocks() {
  const query = state.territorySearch.trim().toLocaleLowerCase(state.language);
  return state.territoryCatalog.blocks.filter((block) => {
    if (state.territoryOwnerFilter === 'neutral' && block.ownerFactionId !== null) return false;
    if (!['all', 'neutral'].includes(state.territoryOwnerFilter) && block.ownerFactionId !== state.territoryOwnerFilter) return false;
    if (state.territoryStateFilter !== 'all' && block.state !== state.territoryStateFilter) return false;
    if (state.territorySectorFilter !== 'all' && String(block.sector) !== state.territorySectorFilter) return false;
    if (!query) return true;
    const benefitText = (block.benefits ?? []).flatMap((benefit) => [benefit.key, benefit.name?.en, benefit.name?.ar]).join(' ');
    const haystack = [block.id, block.name?.en, block.name?.ar, block.districtId, block.ownerName?.en, block.ownerName?.ar, benefitText].join(' ').toLocaleLowerCase(state.language);
    return haystack.includes(query);
  });
}

function renderTerritorySummary() {
  const counts = territoryCounts();
  const metrics = [
    [t('totalBlocks'), counts.total, '#a3d900'],
    [t('ownedBlocks'), counts.owned, '#55d6be'],
    [t('neutralBlocks'), counts.neutral, state.territoryCatalog.neutralColor],
    [t('contestedBlocks'), counts.contested, '#f06d5d'],
  ];
  $('#territorySummary').innerHTML = metrics.map(([label, value, color]) => `<article class="territory-metric" style="--territory-metric-color:${safeColor(color)}"><span>${esc(label)}</span><strong>${Number(value).toLocaleString(state.language)}</strong></article>`).join('');
}

function renderTerritoryGrid() {
  const blocks = filteredTerritoryBlocks();
  $('#territoryResultCount').textContent = `${blocks.length.toLocaleString(state.language)} / ${state.territoryCatalog.blocks.length.toLocaleString(state.language)}`;
  if (state.territoryError) {
    $('#territoryGrid').innerHTML = `<div class="territory-grid-empty"><strong>${esc(t('territoryUnavailable'))}</strong><span>${esc(state.territoryError)}</span></div>`;
    return;
  }
  $('#territoryGrid').innerHTML = blocks.map((block) => {
    const selected = block.id === state.selectedTerritory;
    const owner = localized(block.ownerName) || t('neutral');
    const color = safeColor(block.ownerColor, state.territoryCatalog.neutralColor);
    const stateClass = ['neutral', 'owned', 'contested'].includes(block.state) ? block.state : 'neutral';
    const aria = `${block.id}, ${territoryBlockName(block)}, ${owner}, ${territoryStateLabel(block.state)}`;
    return `<button class="territory-card ${selected ? 'selected' : ''} ${stateClass}" type="button" data-territory-id="${esc(block.id)}" style="--territory-color:${color}" aria-pressed="${selected}" aria-label="${esc(aria)}"><span class="territory-card-accent" aria-hidden="true"></span><span class="territory-card-top"><code dir="ltr">${esc(block.id)}</code><small>${esc(t('sector'))} ${Number(block.sector).toLocaleString(state.language)}</small></span><strong>${esc(territoryBlockName(block))}</strong><span class="territory-card-owner"><i aria-hidden="true"></i>${esc(owner)}</span><span class="territory-card-foot"><small>${esc(territoryStateLabel(block.state))}</small><b dir="ltr">v${Number(block.version)}</b></span></button>`;
  }).join('') || `<div class="territory-grid-empty">${esc(t('noTerritoryResults'))}</div>`;
  $$('[data-territory-id]', $('#territoryGrid')).forEach((button) => button.addEventListener('click', () => selectTerritoryBlock(button.dataset.territoryId)));
}

function renderTerritoryDetails() {
  const block = state.territoryCatalog.blocks.find((item) => item.id === state.selectedTerritory) ?? null;
  $('#territoryDetailEmpty').hidden = Boolean(block);
  $('#territoryDetails').hidden = !block;
  if (!block) {
    $('#territoryDetailState').textContent = '-';
    $('#territoryDetailState').className = 'status';
    return;
  }

  const owner = localized(block.ownerName) || t('neutral');
  const ownerColor = safeColor(block.ownerColor, state.territoryCatalog.neutralColor);
  const selectedOwner = state.pendingTerritoryOwner ?? block.ownerFactionId ?? '';
  const ownerOptions = [`<option value="" ${selectedOwner === '' ? 'selected' : ''}>${esc(t('neutral'))}</option>`, ...state.territoryCatalog.factions.map((faction) => `<option value="${esc(faction.id)}" ${selectedOwner === faction.id ? 'selected' : ''}>${esc(factionName(faction))} · ${esc(faction.id)}</option>`)].join('');
  const benefits = (block.benefits ?? []).map((benefit) => `<div class="territory-benefit"><span>${esc(localized(benefit.name) || benefit.key)}</span><strong dir="auto">${esc(formatTerritoryBenefit(benefit))}</strong></div>`).join('') || `<span class="territory-muted">${esc(t('noBenefits'))}</span>`;
  const neighbors = (block.neighbors ?? []).map((id) => `<button type="button" class="territory-neighbor" data-neighbor-id="${esc(id)}" dir="ltr">${esc(id)}</button>`).join('') || `<span class="territory-muted">${esc(t('noNeighbors'))}</span>`;
  const detailRows = [
    [t('district'), block.districtId],
    [t('sector'), Number(block.sector).toLocaleString(state.language)],
    [t('size'), Number(block.size).toLocaleString(state.language)],
    [t('density'), Number(block.density).toLocaleString(state.language)],
    [t('slots'), Number(block.slots).toLocaleString(state.language)],
    [t('dailyRespect'), Number(block.dailyRespect).toLocaleString(state.language)],
    [t('control'), `${Number(block.control).toLocaleString(state.language)}%`],
    [t('stateVersion'), `v${Number(block.version)}`],
  ];

  $('#territoryDetailState').textContent = territoryStateLabel(block.state);
  $('#territoryDetailState').className = `status ${block.state === 'contested' ? 'bad' : block.state === 'owned' ? 'active' : ''}`;
  $('#territoryDetails').innerHTML = `<div class="territory-detail-identity" style="--territory-color:${ownerColor}"><span class="territory-detail-color" aria-hidden="true"></span><div><code dir="ltr">${esc(block.id)}</code><h3>${esc(territoryBlockName(block))}</h3><p><span>${esc(t('liveOwner'))}</span><strong>${esc(owner)}</strong></p></div></div><div class="territory-control-track" aria-label="${esc(t('control'))}: ${Number(block.control)}%"><i style="width:${Math.max(0, Math.min(100, Number(block.control)))}%;background:${ownerColor}"></i></div><div class="territory-stat-grid">${detailRows.map(([label, value]) => `<div><span>${esc(label)}</span><strong dir="auto">${esc(value)}</strong></div>`).join('')}</div><section class="territory-detail-section"><h3>${esc(t('benefits'))}</h3><div class="territory-benefits">${benefits}</div></section><section class="territory-detail-section"><h3>${esc(t('neighbors'))}</h3><div class="territory-neighbors">${neighbors}</div></section><section class="territory-owner-editor"><label><span>${esc(t('liveOwner'))}</span><select id="territoryOwnerSelect">${ownerOptions}</select></label><p>${esc(t('ownershipHelp'))}</p><button class="button primary" id="applyTerritoryOwnerButton" type="button" ${state.territoryBusy || selectedOwner === (block.ownerFactionId ?? '') ? 'disabled' : ''}>${state.territoryBusy ? esc(t('loadingTerritories')) : esc(t('applyOwnership'))}</button></section><small class="territory-updated">${esc(t('updatedAt'))}: <bdi>${esc(block.updatedAt ?? '')}</bdi></small>`;

  $('#territoryOwnerSelect').addEventListener('change', (event) => {
    state.pendingTerritoryOwner = event.target.value;
    const apply = $('#applyTerritoryOwnerButton');
    if (apply) apply.disabled = state.territoryBusy || event.target.value === (block.ownerFactionId ?? '');
  });
  $('#applyTerritoryOwnerButton').addEventListener('click', applyTerritoryOwnership);
  $$('[data-neighbor-id]', $('#territoryDetails')).forEach((button) => button.addEventListener('click', () => selectTerritoryBlock(button.dataset.neighborId)));
}

function renderTerritories() {
  const catalog = state.territoryCatalog;
  if (state.selectedTerritory && !catalog.blocks.some((block) => block.id === state.selectedTerritory)) state.selectedTerritory = null;
  if (!state.selectedTerritory && catalog.blocks.length) {
    state.selectedTerritory = catalog.blocks[0].id;
    state.pendingTerritoryOwner = catalog.blocks[0].ownerFactionId ?? '';
  }
  renderTerritorySummary();
  $('#territoryRevision').textContent = catalog.revision ? `${t('live')} · ${catalog.revision.slice(0, 8)}` : t('live');

  const ownerFilter = $('#territoryOwnerFilter');
  ownerFilter.innerHTML = `<option value="all">${esc(t('allOwners'))}</option><option value="neutral">${esc(t('neutral'))}</option>${catalog.factions.map((faction) => `<option value="${esc(faction.id)}">${esc(factionName(faction))}</option>`).join('')}`;
  ownerFilter.value = state.territoryOwnerFilter;
  const states = [...new Set(catalog.blocks.map((block) => block.state))].sort();
  $('#territoryStateFilter').innerHTML = `<option value="all">${esc(t('allStates'))}</option>${states.map((value) => `<option value="${esc(value)}">${esc(territoryStateLabel(value))}</option>`).join('')}`;
  $('#territoryStateFilter').value = state.territoryStateFilter;
  const sectors = [...new Set(catalog.blocks.map((block) => Number(block.sector)))].sort((left, right) => left - right);
  $('#territorySectorFilter').innerHTML = `<option value="all">${esc(t('allSectors'))}</option>${sectors.map((value) => `<option value="${value}">${esc(t('sector'))} ${value.toLocaleString(state.language)}</option>`).join('')}`;
  $('#territorySectorFilter').value = state.territorySectorFilter;
  $('#territorySearch').value = state.territorySearch;

  $('#territorySearch').oninput = (event) => { state.territorySearch = event.target.value; renderTerritoryGrid(); };
  ownerFilter.onchange = (event) => { state.territoryOwnerFilter = event.target.value; renderTerritoryGrid(); };
  $('#territoryStateFilter').onchange = (event) => { state.territoryStateFilter = event.target.value; renderTerritoryGrid(); };
  $('#territorySectorFilter').onchange = (event) => { state.territorySectorFilter = event.target.value; renderTerritoryGrid(); };
  renderTerritoryGrid();
  renderTerritoryDetails();
  pushTerritoryMap();
}

function selectTerritoryBlock(id, notifyMap = true) {
  const block = state.territoryCatalog.blocks.find((item) => item.id === id);
  if (!block) return;
  state.selectedTerritory = block.id;
  state.pendingTerritoryOwner = block.ownerFactionId ?? '';
  renderTerritoryGrid();
  renderTerritoryDetails();
  pushTerritoryMap();
  if (notifyMap) $('#territoryMapPreview')?.contentWindow?.postMessage({ type: 'ZONE_MAP_SELECT_BLOCK', blockId: block.id }, '*');
  if (window.matchMedia('(max-width: 850px)').matches) $('#territoryDetails')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function territoryMapPayload() {
  const blocks = state.territoryCatalog.blocks.map((block) => ({
    ...block,
    _lngLat: true,
    name: territoryBlockName(block),
    faction: block.ownerFactionId,
    factionName: localized(block.ownerName) || t('neutral'),
    color: safeColor(block.ownerColor, state.territoryCatalog.neutralColor),
    contested: block.state === 'contested',
    eligible: Boolean(block.action),
    status: territoryStateLabel(block.state),
    benefit: block.benefits?.[0] ? { key: block.benefits[0].key, label: localized(block.benefits[0].name) || block.benefits[0].key, value: formatTerritoryBenefit(block.benefits[0]) } : null,
    respect: block.dailyRespect,
    blocks: 1,
    locations: 0,
    here: block.id === state.selectedTerritory,
  }));
  return {
    type: 'ZONE_MAP_DATA',
    revision: state.territoryCatalog.revision,
    playerFactionId: state.territoryCatalog.playerFactionId,
    blocks,
    factions: state.territoryCatalog.factions,
    districts: [...new Set(blocks.map((block) => block.districtId))].map((id) => ({ id })),
    zonePins: [],
    legend: [],
    copy: {
      places: state.language === 'ar' ? 'المواقع' : 'Locations', territories: t('territories'), searchPlaces: state.language === 'ar' ? 'ابحث في المواقع...' : 'Search locations...', searchTerritories: t('searchBlocksPlaceholder'), cityControl: t('territoryControl'), owner: t('ownerFilter'), control: t('control'), blocks: t('territoryBlocks'), block: t('blockDetails'), district: t('district'), respect: t('dailyRespect'), benefit: t('benefits'), neutral: t('neutral'), contested: t('contested'), controlled: t('owned'), adjacent: t('neighbors'), fullCity: state.language === 'ar' ? 'المدينة كاملة' : 'Full city', current: state.language === 'ar' ? 'محدد' : 'Selected', openFaction: t('liveOwner'), showPlaces: state.language === 'ar' ? 'عرض المواقع' : 'Show locations', versus: state.language === 'ar' ? 'ضد' : 'vs',
    },
    lang: state.language,
    dir: state.language === 'ar' ? 'rtl' : 'ltr',
    dark: true,
    bg: '#0e1116',
  };
}

function ensureTerritoryMapPreview() {
  const frame = $('#territoryMapPreview');
  if (!frame) return;
  frame.onload = () => { state.territoryMapReady = true; pushTerritoryMap(); };
  if (frame.dataset.language !== state.language || !frame.getAttribute('src')) {
    state.territoryMapReady = false;
    frame.dataset.language = state.language;
    frame.src = `/dist/city-map-torn.html?admin=territories&lang=${state.language}`;
  }
}

function pushTerritoryMap() {
  const frame = $('#territoryMapPreview');
  if (!frame?.contentWindow || !state.territoryCatalog.blocks.length) return;
  frame.contentWindow.postMessage(territoryMapPayload(), '*');
}

function renderAssets() {
  $('#assetGrid').innerHTML = assets.map(([type, name, detail]) => `<article class="asset-card" data-type="${esc(type)}"><span class="asset-icon" dir="ltr">${esc(type.slice(0, 2))}</span><div><strong>${esc(localized(name))}</strong><span>${esc(localized(detail))}</span></div></article>`).join('');
}

function renderEconomy() {
  const header = `<div class="table-row header"><span>${t('reason')}</span><span>${t('amount')}</span><span>${t('balance')}</span><span>${t('player')}</span><span>${t('correlation')}</span></div>`;
  $('#ledgerTable').innerHTML = header + (state.ledger.map((entry) => `<div class="table-row"><strong>${esc(entry.reason)}</strong><code dir="ltr">+${Number(entry.amount).toLocaleString()} ${esc(entry.asset)}</code><code dir="ltr">${Number(entry.balance_after).toLocaleString()}</code><code dir="ltr">${esc(entry.player_id)}</code><code dir="ltr">${esc(entry.correlation_id)}</code></div>`).join('') || `<div class="empty-state">${t('noLedger')}</div>`);
  $('#resourceGrid').innerHTML = resources.map(([name, detail]) => `<div class="domain"><strong>${esc(localized(name))}</strong><span>${esc(localized(detail))}</span></div>`).join('');
}

function renderEvents() {
  const header = `<div class="table-row header"><span>${t('event')}</span><span>${t('time')}</span><span>${t('module')}</span><span>${t('correlation')}</span><span>${t('payload')}</span></div>`;
  $('#eventTable').innerHTML = header + (state.events.map((event) => `<div class="table-row"><strong dir="ltr">${esc(event.event_name)}</strong><code dir="ltr">${esc(event.occurred_at)}</code><code>${t('eventBusLabel')}</code><code dir="ltr">${esc(event.payload?.correlationId ?? event.id)}</code><code dir="ltr">${esc(JSON.stringify(event.payload))}</code></div>`).join('') || `<div class="empty-state">${t('noEvents')}</div>`);
  $('#auditList').innerHTML = state.audit.map((entry) => `<article class="audit-entry"><strong dir="ltr">${esc(entry.action)} · ${esc(entry.target_type)}</strong><code dir="ltr">${esc(entry.target_id)}</code><small dir="ltr">${esc(entry.actor)} · ${esc(entry.created_at)}</small><small dir="ltr">${esc(entry.correlation_id)}</small></article>`).join('') || `<div class="empty-state">${t('noAudit')}</div>`;
}

function renderReleases() {
  $('#releaseList').innerHTML = state.releases.map((release) => `<article class="release-card ${release.active ? 'active' : ''}"><span class="release-version" dir="ltr">v${release.version}</span><div><strong>${esc(release.manifest.branding.name[state.language] ?? release.manifest.branding.name.en)}</strong><small dir="ltr">${esc(release.id)} · ${esc(release.publishedAt ?? '')}</small></div>${release.active ? `<span class="status active">${t('active')}</span>` : `<button class="button secondary" type="button" data-activate-release="${esc(release.id)}">${t('rollback')}</button>`}</article>`).join('') || `<div class="empty-state">${t('noReleases')}</div>`;
  $$('[data-activate-release]').forEach((button) => button.addEventListener('click', () => activateRelease(button.dataset.activateRelease)));
}

function renderAll() {
  renderNavigation();
  renderOverview();
  renderBuilder();
  renderModules();
  renderThemes();
  renderContent();
  renderTerritories();
  renderAssets();
  renderEconomy();
  renderEvents();
  renderReleases();
}

function updatePreviewCache() {
  if (!state.draft) return;
  localStorage.setItem(PREVIEW_CACHE, JSON.stringify({ id: 'draft-preview', version: 'draft', manifest: manifestWithRuntimeContent(), active: false, publishedBy: 'admin-panel', publishedAt: new Date().toISOString() }));
}

function refreshPreview() {
  updatePreviewCache();
  const frame = $('#previewFrame');
  if (!frame || $('#draftPreviewStage').hidden) return;
  const screen = state.selectedPage && currentManifest()?.pages.some((page) => page.id === state.selectedPage && page.enabled) ? state.selectedPage : 'home';
  frame.src = `/?zone-preview=1&lang=${state.language}&screen=${encodeURIComponent(screen)}&v=${Date.now()}`;
}

function refreshSectionPreview(view) {
  updatePreviewCache();
  const panel = $(`.view[data-view="${view}"] [data-section-preview]`);
  const frame = panel?.querySelector('.section-preview-frame');
  if (!frame || frame.closest('.preview-stage').hidden) return;
  frame.src = `/?zone-preview=1&lang=${state.language}&screen=${encodeURIComponent(panel.dataset.previewScreen || 'home')}&v=${Date.now()}`;
}

function refreshViewPreview(view) {
  if (view === 'builder') refreshPreview();
  else refreshSectionPreview(view);
}

async function saveDraft() {
  try {
    const response = await api('/api/v1/admin/draft', { method: 'PUT', body: JSON.stringify({ manifest: manifestWithRuntimeContent() }) });
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
    if (!(await saveDraft())) return;
    const release = await api('/api/v1/admin/releases/publish', { method: 'POST', body: '{}' });
    localStorage.setItem(ACTIVE_CACHE, JSON.stringify(release));
    localStorage.setItem('zone.platform.gameData', JSON.stringify(release.manifest.content ?? {}));
    localStorage.removeItem(PREVIEW_CACHE);
    state.releases = [release, ...state.releases.filter((item) => item.id !== release.id).map((item) => ({ ...item, active: false }))];
    state.engine.activeReleaseId = release.id;
    state.engine.activeReleaseVersion = release.version;
    $('#runtimeRelease').textContent = `RELEASE ${release.version}`;
    notify(`${state.language === 'ar' ? 'تم نشر الإصدار' : 'Published release'} v${release.version}`);
    renderAll();
    refreshViewPreview(state.view);
  } catch (error) { notify(error.message, true); }
}

async function activateRelease(id) {
  try {
    const release = await api(`/api/v1/admin/releases/${encodeURIComponent(id)}/activate`, { method: 'POST', body: '{}' });
    localStorage.setItem(ACTIVE_CACHE, JSON.stringify(release));
    localStorage.setItem('zone.platform.gameData', JSON.stringify(release.manifest.content ?? {}));
    state.releases = state.releases.map((item) => ({ ...item, active: item.id === release.id }));
    state.engine.activeReleaseId = release.id;
    state.engine.activeReleaseVersion = release.version;
    $('#runtimeRelease').textContent = `RELEASE ${release.version}`;
    notify(`${state.language === 'ar' ? 'تم الرجوع إلى الإصدار' : 'Rolled back to release'} v${release.version}`);
    renderAll();
    refreshViewPreview(state.view);
  } catch (error) { notify(error.message, true); }
}

async function mutateModule(id, action) {
  try {
    await api(`/api/v1/admin/modules/${encodeURIComponent(id)}/${action}`, { method: 'POST', body: '{}' });
    const response = await api('/api/v1/modules');
    state.modules = response.modules;
    markDirty();
    notify(`${id}: ${t(action)}`);
    renderAll();
    refreshViewPreview('modules');
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
    markDirty();
    notify(state.language === 'ar' ? 'تم حفظ الجريمة في المحرك' : 'Crime saved to the engine');
    renderAll();
    refreshViewPreview('content');
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
    markDirty();
    notify(`${id}: ${t('active')}`);
    renderAll();
    refreshViewPreview('themes');
  } catch (error) { notify(error.message, true); }
}

async function loadTerritories({ render = true } = {}) {
  const refreshButton = $('#refreshTerritoriesButton');
  if (refreshButton) refreshButton.disabled = true;
  state.territoryError = '';
  try {
    const response = await api('/api/v1/admin/territories');
    state.territoryCatalog = normalizeTerritoryCatalog(response);
    const selected = state.territoryCatalog.blocks.find((block) => block.id === state.selectedTerritory) ?? state.territoryCatalog.blocks[0] ?? null;
    state.selectedTerritory = selected?.id ?? null;
    state.pendingTerritoryOwner = selected?.ownerFactionId ?? '';
    if (render) renderTerritories();
    return state.territoryCatalog;
  } catch (error) {
    state.territoryError = error.message;
    if (render) renderTerritories();
    throw error;
  } finally {
    if (refreshButton) refreshButton.disabled = false;
  }
}

async function applyTerritoryOwnership() {
  const block = state.territoryCatalog.blocks.find((item) => item.id === state.selectedTerritory);
  if (!block || state.territoryBusy) return;
  const factionId = state.pendingTerritoryOwner || null;
  if (factionId === (block.ownerFactionId ?? null)) return;

  state.territoryBusy = true;
  renderTerritoryDetails();
  try {
    const path = `/api/v1/admin/territories/${encodeURIComponent(block.id)}/ownership`;
    const response = await api(path, { method: 'POST', body: JSON.stringify({ factionId }) });
    state.territoryCatalog = normalizeTerritoryCatalog(response);
    const verified = await api('/api/v1/admin/territories');
    state.territoryCatalog = normalizeTerritoryCatalog(verified);
    const updated = state.territoryCatalog.blocks.find((item) => item.id === block.id);
    state.selectedTerritory = updated?.id ?? state.territoryCatalog.blocks[0]?.id ?? null;
    state.pendingTerritoryOwner = updated?.ownerFactionId ?? '';
    const [events, audit] = await Promise.all([
      api('/api/v1/events').catch(() => null),
      api('/api/v1/admin/audit').catch(() => null),
    ]);
    if (events?.events) state.events = events.events;
    if (audit?.entries) state.audit = audit.entries;
    notify(t('ownershipUpdated'));
  } catch (error) {
    notify(error.message, true);
  } finally {
    state.territoryBusy = false;
    renderTerritories();
  }
}

async function load() {
  const [engine, modules, themes, crimes, ledger, events, audit, draft, releases, territories] = await Promise.all([
    api('/api/v1/engine'), api('/api/v1/modules'), api('/api/v1/themes'), api('/api/v1/admin/crimes'), api('/api/v1/ledger'), api('/api/v1/events'), api('/api/v1/admin/audit'), api('/api/v1/admin/draft'), api('/api/v1/admin/releases'),
    api('/api/v1/admin/territories').catch((error) => ({ __territoryError: error.message })),
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
  if (territories.__territoryError) state.territoryError = territories.__territoryError;
  else state.territoryCatalog = normalizeTerritoryCatalog(territories);
  state.selectedCrime = state.crimes[0]?.id ?? null;
  state.selectedTerritory = state.territoryCatalog.blocks[0]?.id ?? null;
  state.pendingTerritoryOwner = state.territoryCatalog.blocks[0]?.ownerFactionId ?? '';
  $('#runtimePhp').textContent = `PHP ${engine.php}`;
  $('#runtimeDatabase').textContent = engine.database.toUpperCase();
  $('#runtimeRelease').textContent = `RELEASE ${engine.activeReleaseVersion}`;
  $('#runtimeMode').textContent = engine.database === 'pgsql' ? 'PRODUCTION' : 'LOCAL';
  applyLanguage();
  updatePreviewCache();
}

installSectionPreviews();
$$('[data-preview-toggle]').forEach((button) => button.addEventListener('click', () => togglePreview(button)));
$('#languageButton').addEventListener('click', () => { state.language = state.language === 'en' ? 'ar' : 'en'; localStorage.setItem('zone.admin.language', state.language); applyLanguage(); });
$('#publishButton').addEventListener('click', publishRelease);
$('#releasePublishButton').addEventListener('click', publishRelease);
$('#saveDraftButton').addEventListener('click', saveDraft);
$('#previewButton').addEventListener('click', refreshPreview);
$('#addPageButton').addEventListener('click', addPage);
$('#addBlockButton').addEventListener('click', addBlock);
$('#newCrimeButton').addEventListener('click', newCrime);
$('#crimeForm').addEventListener('submit', saveCrime);
$('#refreshTerritoriesButton').addEventListener('click', () => loadTerritories().then(() => notify(state.language === 'ar' ? 'تم تحديث حالة الأراضي' : 'Territory state refreshed')).catch((error) => notify(error.message, true)));
$('#clearTraceButton').addEventListener('click', () => { $('#apiTrace').textContent = t('adminReady'); });
$$('[data-go]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.go)));
$$('.viewport-button').forEach((button) => button.addEventListener('click', () => {
  const preview = button.closest('.builder-preview, .section-preview');
  preview?.querySelectorAll('.viewport-button').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  const frame = preview?.querySelector('iframe');
  if (frame) frame.style.width = button.dataset.width;
}));
$$('[data-preview-refresh]').forEach((button) => button.addEventListener('click', () => refreshSectionPreview(button.closest('.view').dataset.view)));
window.addEventListener('message', (event) => {
  const frame = $('#territoryMapPreview');
  if (!frame || event.source !== frame.contentWindow || !event.data || typeof event.data !== 'object') return;
  if (event.data.zoneMapReady || event.data.type === 'ZONE_MAP_READY') {
    state.territoryMapReady = true;
    pushTerritoryMap();
    return;
  }
  const blockId = event.data.blockId ?? event.data.TERRITORY_CLICK;
  if ((event.data.type === 'ZONE_MAP_SELECT_BLOCK' || event.data.TERRITORY_CLICK) && blockId) selectTerritoryBlock(String(blockId), false);
});

load().catch((error) => {
  trace('BOOT', '/admin', null, { error: error.message }, 500);
  notify(error.message, true);
  $('#pipelineStatus').textContent = 'API ERROR';
  $('#pipelineStatus').className = 'status bad';
});
