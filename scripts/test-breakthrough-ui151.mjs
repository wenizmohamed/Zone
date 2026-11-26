import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readBytes = (rel) => readFileSync(resolve(root, rel));
const readUtf8 = (rel) => readFileSync(resolve(root, rel), 'utf8');
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

test('v151 Static & SHA-256 Gate: index.html <body> is 100% byte-identical, v151 assets wired, CSS braces balanced, JS syntax clean', () => {
  const rawHtml = readBytes('index.html');
  const bodyIdx = rawHtml.indexOf(Buffer.from('<body>'));
  assert.ok(bodyIdx > 0, 'index.html must contain <body>');
  assert.equal(
    sha256(rawHtml.subarray(bodyIdx)),
    '4c791309a03202d90db55efac2e9a8d02b4bda23914784672056e6abbb205d07',
    'index.html <body> onward must have 0 byte modifications'
  );

  const head = rawHtml.subarray(0, bodyIdx).toString('utf8');
  assert.match(head, /href="\.\/assets\/ui\/gym116\.css\?v=117"/, 'gym116.css?v=117 must remain untouched');
  const zabCssVer = Number(head.match(/href="\.\/assets\/ui\/zone-ascension-breakthrough\.css\?v=(\d+)"/)?.[1] || 0);
  const zabJsVer = Number(head.match(/src="\.\/assets\/ui\/zone-ascension-breakthrough\.js\?v=(\d+)"/)?.[1] || 0);
  assert.ok(zabCssVer >= 151, `zone-ascension-breakthrough.css v${zabCssVer} >= 151`);
  assert.ok(zabJsVer >= 151, `zone-ascension-breakthrough.js v${zabJsVer} >= 151`);
  assert.doesNotMatch(head, /\?v=150\b/, 'All ?v=150 head references must be bumped to >= 151');

  const swSrc = readUtf8('sw.js');
  const swShellVer = Number(swSrc.match(/SHELL_CACHE_NAME\s*=\s*['"]zone-shell-v(\d+)['"]/)?.[1] || 0);
  assert.ok(swShellVer >= 151, `SHELL_CACHE_NAME zone-shell-v${swShellVer} >= 151`);
  assert.ok(Number(swSrc.match(/zone-ascension-breakthrough\.css\?v=(\d+)/)?.[1] || 0) >= 151);
  assert.ok(Number(swSrc.match(/zone-ascension-breakthrough\.js\?v=(\d+)/)?.[1] || 0) >= 151);

  for (const cssRel of [
    'assets/ui/zone-ascension-breakthrough.css',
    'assets/ui/zone-torn-live.css',
    'assets/ui/zone-rpg-empire.css'
  ]) {
    const css = readUtf8(cssRel);
    const opens = (css.match(/\{/g) || []).length;
    const closes = (css.match(/\}/g) || []).length;
    assert.equal(opens, closes, `${cssRel} braces must be balanced`);
  }

  for (const jsRel of [
    'assets/ui/zone-ascension-breakthrough.js',
    'assets/ui/zone-instant-games.js',
    'assets/ui/zone-torn-live.js',
    'assets/ui/zone-rpg-empire.js',
    'sw.js'
  ]) {
    assert.ok(existsSync(resolve(root, jsRel)), `Expected file exists: ${jsRel}`);
    execFileSync(process.execPath, ['--check', resolve(root, jsRel)], { stdio: 'pipe' });
  }
});

test('v151 Breakthrough Progression UX Gate: Arcade->Casino, Origin Awakening, 6-Era Spine, Luna Comms, Nemesis, Crew, Sidebar Locks, Screen Unification, 0ms Bar Sync & Light/Dark EN/AR RTL', async () => {
  let playwrightMod = null;
  for (const candidate of [
    'playwright',
    'C:\\Users\\user\\AppData\\Roaming\\npm\\node_modules\\playwright\\index.mjs',
    'C:\\Users\\user\\.gemini\\node_modules\\playwright\\index.mjs'
  ]) {
    try {
      playwrightMod = await import(candidate);
      break;
    } catch (_) {}
  }
  assert.ok(playwrightMod, 'Playwright must be available');

  let browser = null;
  for (const opts of [{ headless: true, channel: 'msedge' }, { headless: true, channel: 'chrome' }, { headless: true }]) {
    try {
      browser = await playwrightMod.chromium.launch(opts);
      break;
    } catch (_) {}
  }
  assert.ok(browser, 'Headless Chromium/Edge must launch');

  const http = await import('node:http');
  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff2': 'font/woff2',
    '.glb': 'model/gltf-binary',
    '.obj': 'text/plain; charset=utf-8',
    '.mtl': 'text/plain; charset=utf-8'
  };

  const nowSec = Math.floor(Date.now() / 1000);
  const sim = {
    player: {
      id: 'op-7749',
      username: 'Guest_7749',
      level: 1,
      xp: 40,
      cash: 2500,
      bank_balance: 0,
      energy: 100,
      max_energy: 100,
      nerve: 15,
      max_nerve: 15,
      happy: 150,
      max_happy: 150,
      life: 100,
      max_life: 100,
      strength: 25,
      defense: 22,
      speed: 24,
      dexterity: 23,
      points: 10,
      merits: 2,
      city: 'Zone City'
    },
    originChosen: false,
    originId: null,
    directiveIndex: 1,
    directiveClaimable: false,
    nemesisIntel: 70,
    nemesisDefeated: false,
    lookoutRank: 0,
    pendingTribute: 0,
    eraClaimed: false
  };

  function buildAscensionPayload(resultObj = null) {
    const lv = sim.player.level;
    const eraIdx = lv >= 3 ? 2 : 1;
    const eraPct = lv >= 2 ? 100 : 45;
    const claimableEra = (lv >= 2 && !sim.eraClaimed)
      ? { eraIndex: 1, titleEn: 'Era I: Gutter Rat', titleAr: 'العصر الأول: جرذ الأزقة', cashReward: 5000, rewards: { cash: 5000, sp: 2, merits: 2 } }
      : null;

    const payload = {
      ok: true,
      player: { ...sim.player },
      originChosen: sim.originChosen,
      origin: sim.originId,
      originId: sim.originId,
      activeOrigin: sim.originChosen
        ? { id: sim.originId, nameEn: 'Harbor Ghost', nameAr: 'شبح المرفأ' }
        : null,
      origins: [
        { id: 'harbor_ghost', nameEn: 'Harbor Ghost', nameAr: 'شبح المرفأ', taglineEn: 'Silent dockside infiltrator.', taglineAr: 'متسلل صامت في المرفأ.', perksSummaryEn: '+8% Crime Success · +10% Stealth · Knife + $4,000', perksSummaryAr: '+8% نجاح الجرائم · +10% تخفٍ · سكين + 4,000$' },
        { id: 'cartel_bruiser', nameEn: 'Ex-Cartel Enforcer', nameAr: 'منفّذ الكارتل', taglineEn: 'Scarred heavy hitter.', taglineAr: 'مقاتل شرس.', perksSummaryEn: '+10% Combat Damage · +50 Max Life · $3,000', perksSummaryAr: '+10% ضرر قتالي · +50 صحة · 3,000$' },
        { id: 'disgraced_banker', nameEn: 'Fallen Financier', nameAr: 'المصرفي الساقط', taglineEn: 'Syndicate money architect.', taglineAr: 'مهندس غسيل الأموال.', perksSummaryEn: '+8% Bank APR · -20% Market Fee · $12,000', perksSummaryAr: '+8% عائد بنكي · 12,000$' },
        { id: 'street_chemist', nameEn: 'Underground Chemist', nameAr: 'الخيميائي السري', taglineEn: 'Back-alley synthesist.', taglineAr: 'كيميائي التركيبات السرية.', perksSummaryEn: '-20% OD Risk · +10 Max Energy · $3,500', perksSummaryAr: '-20% خطر الجرعة · +10 طاقة · 3,500$' }
      ],
      eraIndex: eraIdx,
      eraProgressPct: eraPct,
      currentEra: {
        eraIndex: eraIdx,
        roman: eraIdx === 1 ? 'I' : 'II',
        minLevel: eraIdx === 1 ? 1 : 3,
        maxLevel: eraIdx === 1 ? 2 : 6,
        breakthroughLevel: eraIdx === 1 ? 2 : 6,
        nameEn: eraIdx === 1 ? 'Gutter Rat' : 'Dockside Runner',
        nameAr: eraIdx === 1 ? 'جرذ الأزقة' : 'عدّاء الأرصفة',
        titleEn: eraIdx === 1 ? 'Era I: Gutter Rat' : 'Era II: Dockside Runner',
        titleAr: eraIdx === 1 ? 'العصر الأول: جرذ الأزقة' : 'العصر الثاني: عدّاء الأرصفة',
        safehouseEn: eraIdx === 1 ? 'Rusted Pier 4 Container' : 'Neon Alley Backroom',
        safehouseAr: eraIdx === 1 ? 'حاوية الرصيف الرابع الصدئة' : 'غرفة زقاق النيون الخلفية',
        progressPct: eraPct,
        claimable: Boolean(claimableEra),
        claimed: sim.eraClaimed
      },
      claimableEra,
      eras: [
        { eraIndex: 1, roman: 'I', minLevel: 1, maxLevel: 2, breakthroughLevel: 2, nameEn: 'Gutter Rat', nameAr: 'جرذ الأزقة', unlocked: true, current: eraIdx === 1, claimed: sim.eraClaimed },
        { eraIndex: 2, roman: 'II', minLevel: 3, maxLevel: 6, breakthroughLevel: 6, nameEn: 'Dockside Runner', nameAr: 'عدّاء الأرصفة', unlocked: lv >= 3, current: eraIdx === 2, claimed: false },
        { eraIndex: 3, roman: 'III', minLevel: 7, maxLevel: 11, breakthroughLevel: 11, nameEn: 'Street Enforcer', nameAr: 'منفّذ الشوارع', unlocked: false, current: false, claimed: false },
        { eraIndex: 4, roman: 'IV', minLevel: 12, maxLevel: 14, breakthroughLevel: 14, nameEn: 'District Capo', nameAr: 'كابو المقاطعة', unlocked: false, current: false, claimed: false },
        { eraIndex: 5, roman: 'V', minLevel: 15, maxLevel: 24, breakthroughLevel: 24, nameEn: 'Cartel Baron', nameAr: 'بارون الكارتل', unlocked: false, current: false, claimed: false },
        { eraIndex: 6, roman: 'VI', minLevel: 25, maxLevel: 100, breakthroughLevel: 25, nameEn: 'City Sovereign', nameAr: 'سيّد المدينة الأعلى', unlocked: false, current: false, claimed: false }
      ],
      nextUnlock: {
        level: lv < 3 ? 3 : 5,
        requiredLevel: lv < 3 ? 3 : 5,
        currentLevel: lv,
        xpRemaining: 85,
        progressPct: 62,
        featureEn: lv < 3 ? 'Casino Floor & Daily Spin Wheels' : 'Personal Bazaars & Direct Trades',
        featureAr: lv < 3 ? 'صالة الكازينو وعجلات الحظ اليومية' : 'البازار الشخصي والتبادل المباشر',
        targetRoute: lv < 3 ? 'casino' : 'market',
        allGatesUnlocked: false
      },
      lunaOracle: {
        persona: 'Luna · Syndicate Architect',
        personaAr: 'لونا · مهندسة النقابة المشفرة',
        channel: 'ENCRYPTED // PIER-4-OMEGA',
        transmissionEn: sim.originChosen
          ? 'Encrypted uplink locked, GhostWeni. Execute your street crime directive and squeeze Viktor off Pier 4.'
          : 'Rain on Pier 4, operative. I am Luna — choose your underworld origin below to wire your starter kit.',
        transmissionAr: sim.originChosen
          ? 'تم قفل القناة المشفرة. نفّذ توجيه الجرائم واقطع إتاوة فيكتور عن الرصيف الرابع.'
          : 'المطر يغمر الرصيف الرابع. أنا لونا — اختر أصلك الإجرامي بالأسفل لاستلام عتادك.'
      },
      activeDirective: {
        directiveIndex: sim.directiveIndex,
        titleEn: sim.directiveIndex === 1 ? 'Awaken Your Underworld Origin' : 'Execute First Street Crime',
        titleAr: sim.directiveIndex === 1 ? 'أيقظ أصلك في العالم السفلي' : 'نفّذ أول جريمة شارع',
        descEn: 'Build syndicate momentum across Zone City.',
        descAr: 'ابنِ زخم النقابة في شوارع الزون.',
        targetRoute: 'crimes',
        completed: sim.directiveClaimable,
        claimable: sim.directiveClaimable,
        progressPct: sim.directiveClaimable ? 100 : 50,
        progressLabelEn: sim.directiveClaimable ? '1/1 Ready to Claim' : '0/1 Crime executed',
        progressLabelAr: sim.directiveClaimable ? '1/1 جاهز للاستلام' : '0/1 جريمة منفذة',
        rewards: { cash: 1500, xp: 60, sp: 1, merits: 1 }
      },
      nemesis: {
        id: 'nem-1',
        nameEn: 'Viktor "Ironjaw" Kael',
        nameAr: 'فيكتور "الفك الحديدي" كايل',
        titleEn: 'Pier 4 Racket Enforcer',
        titleAr: 'بلطجي إتاوات الرصيف الرابع',
        tier: sim.nemesisDefeated ? 2 : 1,
        districtEn: 'Harbor Pier 4',
        districtAr: 'رصيف الميناء الرابع',
        heatTaxPct: sim.nemesisDefeated ? 0 : 4,
        heatCleared: sim.nemesisDefeated,
        intel: sim.nemesisIntel,
        lastMemoryEn: sim.nemesisDefeated
          ? 'You left me bleeding at Pier 4 - next time I bring hollow-points!'
          : 'My lookouts tax every crate on Pier 4.',
        lastMemoryAr: 'رجالي يفرضون الإتاوة على كل حاوية في الرصيف الرابع.',
        gatherIntelEnergyCost: 5,
        confrontEnergyCost: 15,
        nextBountyCash: 8000,
        canGatherIntel: sim.nemesisIntel < 100,
        canConfront: sim.nemesisIntel >= 100
      },
      crew: {
        slots: [
          { id: 'lookout', slotId: 'lookout', nameEn: 'Dockside Lookout', nameAr: 'مراقب الأرصفة', unlockLevel: 1, unlocked: true, recruited: sim.lookoutRank > 0, rank: sim.lookoutRank, maxRank: 5, perkEn: '+3% Crime Success / rank', perkAr: '+3% نجاح الجرائم', hourlyRate: sim.lookoutRank * 150, baseHourlyRate: 150, recruitCost: 1500, upgradeCost: 3500 },
          { id: 'wheelman', slotId: 'wheelman', nameEn: 'Getaway Wheelman', nameAr: 'سائق الهروب المحترف', unlockLevel: 3, unlocked: lv >= 3, recruited: false, rank: 0, maxRank: 5, perkEn: '-3% Flight Risk / rank', perkAr: '-3% مخاطر الطيران', hourlyRate: 0, baseHourlyRate: 300, recruitCost: 4500 },
          { id: 'chemist', slotId: 'chemist', nameEn: 'Backroom Chemist', nameAr: 'كيميائي المختبر السري', unlockLevel: 5, unlocked: lv >= 5, recruited: false, rank: 0, maxRank: 5, perkEn: '-4% OD Risk / rank', perkAr: '-4% خطر الجرعة', hourlyRate: 0, baseHourlyRate: 500, recruitCost: 9500 },
          { id: 'enforcer', slotId: 'enforcer', nameEn: 'Heavy Enforcer', nameAr: 'المنفّذ المسلح', unlockLevel: 8, unlocked: lv >= 8, recruited: false, rank: 0, maxRank: 5, perkEn: '+4% Combat Damage / rank', perkAr: '+4% ضرر قتالي', hourlyRate: 0, baseHourlyRate: 900, recruitCost: 22000 },
          { id: 'consigliere', slotId: 'consigliere', nameEn: 'Syndicate Consigliere', nameAr: 'مستشار النقابة الأعلى', unlockLevel: 12, unlocked: lv >= 12, recruited: false, rank: 0, maxRank: 5, perkEn: '+4% Bank/Vault Yield / rank', perkAr: '+4% عائد البنك', hourlyRate: 0, baseHourlyRate: 1600, recruitCost: 50000 }
        ],
        recruitedCount: sim.lookoutRank > 0 ? 1 : 0,
        maxSlots: 5,
        totalHourlyRate: sim.lookoutRank * 150,
        pendingTribute: sim.pendingTribute,
        canCollectTribute: sim.pendingTribute > 0
      }
    };
    if (resultObj) payload.result = resultObj;
    return payload;
  }

  function buildGameplayPayload(resultObj = null) {
    return {
      ok: true,
      player: { ...sim.player },
      state: {
        version: 4,
        points: sim.player.points,
        merits: sim.player.merits,
        prop: 'shack',
        inv: { glasses: 1, knife: 1 },
        plushies: {},
        eduDone: {},
        skill: { crime2_1: 42 },
        cooldowns: { drugUntil: 0, medicalUntil: 0, boosterUntil: 0, overdoseCount: 0 },
        addiction: 0,
        meritTree: {},
        claimedHonors: {},
        claimedMedals: {},
        fac: { chain: 4, best: 10, respect: 320, ups: {} },
        ctr: { crimes: 2, trains: 1, wins: 1, shifts: 0 },
        ascension: { nemesis: buildAscensionPayload().nemesis },
        market: [],
        inmates: [],
        patients: []
      },
      tornV2: {
        version: 'ZONE-TORN-151',
        cooldowns: { drugSeconds: 0, medicalSeconds: 0, boosterSeconds: 0, overdoseCount: 0 },
        addiction: 0,
        vaultBalance: 0,
        vaultCap: 1000000,
        stocks: [],
        crimes2CatalogWithSkill: [{ id: 1, skill: 42, enhancerId: 'glasses', enhancerOwned: true, nerve: 2 }]
      },
      ...(resultObj ? { result: resultObj } : {})
    };
  }

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    let rawBody = '';
    if (req.method === 'POST') {
      for await (const chunk of req) rawBody += chunk;
    }
    const body = rawBody ? JSON.parse(rawBody) : {};

    if (u.pathname === '/api/v1/auth/session') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, token: 'tok-151', playerId: sim.player.id, player: sim.player, session: { playerId: sim.player.id, mode: 'guest' }, expiresAt: nowSec + 3600 }));
      return;
    }
    if (u.pathname === '/api/v1/ascension') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(buildAscensionPayload()));
      return;
    }
    if (u.pathname === '/api/v1/ascension/action') {
      const act = body.action;
      let r = { action: act };
      if (act === 'origin.select') {
        sim.originChosen = true;
        sim.originId = body.originId || 'harbor_ghost';
        if (body.callsign) sim.player.username = body.callsign;
        sim.player.cash += 4000;
        sim.directiveClaimable = true;
        r = { action: act, originId: sim.originId, originNameEn: 'Harbor Ghost', cashAwarded: 4000 };
      } else if (act === 'luna.claimDirective') {
        sim.player.cash += 1500;
        sim.player.xp += 60;
        sim.directiveIndex = 2;
        sim.directiveClaimable = false;
        r = { action: act, cashAwarded: 1500, xpAwarded: 60 };
      } else if (act === 'nemesis.gatherIntel') {
        sim.player.energy = Math.max(0, sim.player.energy - 5);
        sim.nemesisIntel = 100;
        r = { action: act, intelAfter: 100 };
      } else if (act === 'nemesis.confront') {
        sim.player.energy = Math.max(0, sim.player.energy - 15);
        sim.player.cash += 8000;
        sim.player.level = 3;
        sim.player.xp += 220;
        sim.nemesisDefeated = true;
        sim.nemesisIntel = 0;
        r = { action: act, victory: true, bountyCash: 8000, cashAwarded: 8000 };
      } else if (act === 'crew.recruit') {
        sim.player.cash -= 1500;
        sim.lookoutRank = 1;
        sim.pendingTribute = 150;
        r = { action: act, slotId: 'lookout', nameEn: 'Dockside Lookout', rank: 1 };
      } else if (act === 'crew.collectTribute') {
        const pay = sim.pendingTribute;
        sim.player.cash += pay;
        sim.pendingTribute = 0;
        r = { action: act, cashAwarded: pay, tributeCollected: pay };
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(buildAscensionPayload(r)));
      return;
    }
    if (u.pathname === '/api/v1/gameplay') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(buildGameplayPayload()));
      return;
    }
    if (u.pathname === '/api/v1/gameplay/action') {
      sim.player.nerve = Math.max(0, sim.player.nerve - 2);
      sim.player.cash += 650;
      sim.player.xp += 25;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(buildGameplayPayload({ crimeTier: 'SUCCESS', cashDelta: 650, xpAwarded: 25, skillDelta: 2, nemesisSkimmed: 28 })));
      return;
    }
    if (u.pathname.startsWith('/api/v1/player-rpg')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        leveling: { level: sim.player.level, potentialLevel: sim.player.level, pendingLevels: 0, holdLevel: false },
        rank: { rankNumber: 2, titleEn: 'Harbor Operative', titleAr: 'عميل المرفأ', nextTitleEn: 'Runner', nextTitleAr: 'عدّاء', claimable: false, totalTriggers: 2, breakdown: {} },
        skillTree: { availableSp: 2, spentSp: 0, respecCount: 0, unlockedNodes: {} },
        masterySkills: { hunting: 10, racing: 10 },
        workStats: { man: 20, int: 20, end: 20 }
      }));
      return;
    }
    if (u.pathname.startsWith('/api/v1/faction-empire')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        currentFaction: { id: 'fac-1', name: 'Harbor Syndicate', tag: 'HRB', respect: 1450, vaultCash: 320000, membersCount: 8 },
        respectTree: { unlocked: { criminality_nerve_1: 2 } },
        organizedCrimes: [{ id: 'oc-1', type: 'armored_van', status: 'recruiting', slots: {} }],
        rankedWar: { status: 'enlisted', opponentName: 'Iron Lotus', ourScore: 14, enemyScore: 9 }
      }));
      return;
    }
    if (u.pathname === '/api/v1/faction-chain') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, chain: { count: 4, nextMilestone: 10, remainingSeconds: 210, best: 10, multiplier: 1.0 }, armory: {}, wall: { territoryId: 'ZC-046', attackerScore: 320, defenderScore: 410, targetScore: 1000 } }));
      return;
    }
    if (u.pathname === '/engine/theme.css') {
      res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
      res.end('/* theme */');
      return;
    }
    if (u.pathname.startsWith('/api/')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, events: [], players: [], patients: [], blocks: [], listings: [], operations: [], ranks: [], destinations: [], inventory: [] }));
      return;
    }

    const rel = decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname).replace(/^\/+/, '');
    const abs = resolve(root, rel);
    if (existsSync(abs) && statSync(abs).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[extname(abs).toLowerCase()] || 'application/octet-stream' });
      res.end(readBytes(rel));
      return;
    }
    res.writeHead(404);
    res.end('Not found');
  });

  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  try {
    // 1) Interactive New-Player Breakthrough Journey on Desktop (1440x900)
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

    await page.goto(`http://127.0.0.1:${port}/?screen=home&lang=en`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#zig-home-arcade', { timeout: 10000 });
    await page.waitForSelector('#zone-ascension-hub [data-z3d-stage="safehouse-empire"]', { timeout: 10000 });
    await page.waitForSelector('#zone-ascension-hub [data-zab-section="origin-awakening"]', { timeout: 10000 });
    await page.waitForSelector('#zone-topbar-hud', { timeout: 10000 });

    // Verify Syndicate Arcade IS restored at the top of Home ABOVE compact 2-column 3D Command Deck
    const initialHome = await page.evaluate(() => {
      const brief = document.querySelector('#zone-main .zone-home-brief');
      const arcade = document.getElementById('zig-home-arcade');
      const hub = document.getElementById('zone-ascension-hub');
      const arcadeRect = arcade ? arcade.getBoundingClientRect() : null;
      const hubRect = hub ? hub.getBoundingClientRect() : null;
      const briefRect = brief ? brief.getBoundingClientRect() : null;
      const lockPills = Array.from(document.querySelectorAll('#zone-area-navigation .zab-nav-lock-pill')).map((el) => el.textContent.trim());
      const opId = document.querySelector('#zone-operative-crest .zaaa-op-id')?.textContent.trim() || '';
      const topbar = document.querySelector('.zone-topbar').getBoundingClientRect();
      const strip = document.getElementById('zone-torn-hud-strip')?.getBoundingClientRect();
      const headerH = strip ? Math.max(topbar.bottom, strip.bottom) - Math.min(topbar.top, strip.top) : topbar.height;
      const drawer = hub?.querySelector('details.zab-dossier-drawer');
      return {
        arcadeOnHome: Boolean(arcade && getComputedStyle(arcade).display !== 'none' && arcadeRect.height > 80),
        arcadeGameCards: arcade ? arcade.querySelectorAll('[data-zig-launch]').length : 0,
        arcadeTop: arcadeRect ? arcadeRect.top : 0,
        hubTop: hubRect ? hubRect.top : 0,
        hubHeight: hubRect ? hubRect.height : 0,
        briefTop: briefRect ? briefRect.top : 0,
        hasSafehouse3D: Boolean(hub?.querySelector('[data-z3d-stage="safehouse-empire"]')),
        originCards: document.querySelectorAll('#zone-ascension-hub [data-zab-origin-card]').length,
        origin3DSlots: document.querySelectorAll('#zone-ascension-hub [data-zab-origin-card] .z3d-item-slot[data-z3d-item]').length,
        eraSteps: document.querySelectorAll('#zone-ascension-hub [data-zab-era-step]').length,
        hasLunaComms: Boolean(document.querySelector('#zone-ascension-hub [data-zab-section="luna-comms"]')),
        hasUploadAvatarBtn: Boolean(document.querySelector('#zone-ascension-hub [data-zab-upload-avatar="1"]')),
        dossierClosedByDefault: Boolean(drawer && drawer.open === false),
        crewSlots: document.querySelectorAll('#zone-ascension-hub [data-zab-crew-slot]').length,
        lockPills,
        opId,
        headerH,
        overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
      };
    });

    assert.equal(initialHome.arcadeOnHome, true, 'Syndicate Arcade (#zig-home-arcade) MUST be restored and visible on Home');
    assert.equal(initialHome.arcadeGameCards, 4, 'All 4 60fps instant arcade games rendered on Home');
    assert.ok(initialHome.arcadeTop < initialHome.hubTop, `Syndicate Arcade (${initialHome.arcadeTop}px) sits ABOVE #zone-ascension-hub (${initialHome.hubTop}px)`);
    assert.ok(initialHome.hubHeight <= 480, `Compact 2-column 3D Command Deck height (${initialHome.hubHeight.toFixed(1)}px) <= 480px (no 1,600px text wall!)`);
    assert.equal(initialHome.hasSafehouse3D, true, 'Safehouse-empire 3D viewport mounted in Column 1');
    assert.ok(initialHome.headerH <= 96, `Desktop header height ${initialHome.headerH}px <= 96px`);
    assert.equal(initialHome.originCards, 4, 'All 4 Underworld Origin tiles rendered');
    assert.equal(initialHome.origin3DSlots, 4, 'All 4 Origin tiles render 3D item meshes (knife, bat, gold_bullion, xanax)');
    assert.equal(initialHome.eraSteps, 6, 'All 6 compact Era Crest Badges rendered');
    assert.equal(initialHome.hasLunaComms, true, 'Luna · Syndicate Architect Holo-Card rendered');
    assert.equal(initialHome.hasUploadAvatarBtn, true, '[Upload Avatar] quick-trigger rendered in Luna Holo-Card');
    assert.equal(initialHome.dossierClosedByDefault, true, 'Full Crew Roster & 6-Era Dossier drawer is collapsed by default');
    assert.equal(initialHome.crewSlots, 5, 'All 5 Street Crew specialist slots accessible inside dossier drawer');
    assert.ok(initialHome.lockPills.includes('Lv 3') && initialHome.lockPills.includes('Lv 5') && initialHome.lockPills.includes('Lv 10') && initialHome.lockPills.includes('Lv 15'), `Lv 1 sidebar lock pills rendered: ${initialHome.lockPills.join(', ')}`);
    assert.notEqual(initialHome.opId, '#1042', `Operative ID replaced #1042 with real short ID (${initialHome.opId})`);
    assert.equal(initialHome.overflowX, 0, 'Zero horizontal overflow on Home');

    // Fill inline Callsign & Awaken as Harbor Ghost directly from 3D Action Strip -> verify 0ms Topbar Cash sync ($2,500 -> $6,500)
    await page.fill('#zab-callsign-input', 'GhostWeni');
    await page.click('#zone-ascension-hub [data-zab-action="origin.select"][data-zab-origin-id="harbor_ghost"]');
    await page.waitForFunction(() => Boolean(document.querySelector('#zone-ascension-hub [data-zab-section="nemesis-rival"]')), { timeout: 5000 });

    const afterOrigin = await page.evaluate(() => ({
      topbarCash: document.querySelector('#zone-topbar-hud .zaaa-hud-cash')?.textContent.trim(),
      sidebarCash: document.getElementById('zone-cash')?.textContent.trim(),
      opName: document.querySelector('#zone-operative-crest .zaaa-op-name')?.textContent.trim(),
      claimBtn: Boolean(document.querySelector('[data-zab-action="luna.claimDirective"]')),
      hasNemesisPill: Boolean(document.querySelector('[data-zab-section="nemesis-rival"]')),
      hasCrewCollectBtn: Boolean(document.querySelector('[data-zab-action="crew.collect"]'))
    }));
    assert.equal(afterOrigin.topbarCash, '$6,500', 'Topbar cash updated immediately to $6,500 after origin.select');
    assert.equal(afterOrigin.sidebarCash, '$6,500', 'Sidebar cash updated immediately to $6,500');
    assert.equal(afterOrigin.opName, 'GhostWeni', 'Callsign synced to operative crest');
    assert.equal(afterOrigin.claimBtn, true, 'Directive #1 Claim button unlocked');
    assert.equal(afterOrigin.hasNemesisPill, true, '3D Nemesis HUD pill active after awakening');
    assert.equal(afterOrigin.hasCrewCollectBtn, true, '3D Street Crew HUD pill [Collect] button mounted');

    // Claim Luna Directive #1 -> 1-Click Recruit Lookout -> Collect Turf Tribute -> 3D Stage Click Nemesis -> Confront Nemesis (Lv 1 -> Lv 3!)
    await page.click('[data-zab-action="luna.claimDirective"]');
    await page.waitForFunction(() => document.querySelector('#zone-topbar-hud .zaaa-hud-cash')?.textContent.trim() === '$8,000');

    await page.click('[data-zab-crew-quick="1"]');
    await page.waitForFunction(() => document.querySelector('#zone-topbar-hud .zaaa-hud-cash')?.textContent.trim() === '$6,500');
    await page.click('[data-zab-action="crew.collect"]');
    await page.waitForFunction(() => document.querySelector('#zone-topbar-hud .zaaa-hud-cash')?.textContent.trim() === '$6,650');

    // Verify clicking the 3D Nemesis inside Three.js stage (`zone:3d-stage-click`) dispatches real `nemesis.gatherIntel`
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('zone:3d-stage-click', { detail: { stage: 'safehouse-empire', target: 'nemesis' } }));
    });
    await page.waitForFunction(() => document.querySelector('[data-zab-nemesis-intel="1"]')?.textContent.trim() === '100%');
    const energyAfterIntel = await page.evaluate(() => document.querySelector('#zone-topbar-hud .zaaa-hud-energy')?.textContent.trim());
    assert.equal(energyAfterIntel, '95/100', 'Topbar Energy updated immediately after 3D Nemesis stage click (5E)');

    await page.click('[data-zab-action="nemesis.confront"]');
    await page.waitForSelector('#zone-levelup-milestone-banner:not([hidden])', { timeout: 5000 });
    const afterLevelUp = await page.evaluate(() => ({
      bannerText: document.getElementById('zone-levelup-milestone-banner')?.textContent || '',
      topbarCash: document.querySelector('#zone-topbar-hud .zaaa-hud-cash')?.textContent.trim(),
      casinoLockGone: !document.querySelector('#zone-area-navigation button[data-zone-screen="casino"] .zab-nav-lock-pill')
    }));
    assert.match(afterLevelUp.bannerText, /Level 1 -> Level 3/, '4.5s Level-Up Milestone Banner celebrates Lv 1 -> Lv 3');
    assert.equal(afterLevelUp.topbarCash, '$14,650', 'Nemesis bounty cash synced to Topbar immediately');
    assert.equal(afterLevelUp.casinoLockGone, true, 'Lv 3 lock pill removed from Casino once player reaches Level 3');

    // Click Luna Directive "Go Execute ->" to jump straight to Crimes & verify 3D Heist Stage + 3D Enhancers + Locked Crime Gates!
    sim.nemesisDefeated = false;
    await page.evaluate(() => window.ZoneAscension.refresh(true));
    await page.waitForTimeout(100);
    await page.click('[data-zab-go-route="crimes"]');
    await page.waitForSelector('#zone-torn-route-section[data-ztl-route="crimes"]', { timeout: 5000 });

    const crimesCheck = await page.evaluate(() => {
      const lockedCard13Btn = document.querySelector('[data-ztl-crime-card="13"] button[data-ztl-act="crime2"]');
      return {
        hasHeistStage: Boolean(document.querySelector('#zone-torn-route-section [data-z3d-stage="heist-breach"]')),
        crimeCards: document.querySelectorAll('[data-ztl-crime-card]').length,
        crime3DSlots: document.querySelectorAll('[data-ztl-crime-card] .z3d-item-slot[data-z3d-item]').length,
        lockedBtnDisabled: Boolean(lockedCard13Btn && lockedCard13Btn.disabled),
        lockedBtnLabel: lockedCard13Btn ? lockedCard13Btn.textContent.trim() : '',
        lockedBtnNotPrimary: lockedCard13Btn ? lockedCard13Btn.getAttribute('data-variant') !== 'primary' : false,
        legacyNavHidden: getComputedStyle(document.querySelector('.zone-crime-activity-nav')).display === 'none',
        nemesisWarn: Boolean(document.querySelector('[data-zab-crimes-nemesis="1"]')),
        overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
      };
    });
    assert.equal(crimesCheck.hasHeistStage, true, 'Crimes mounts live 3D heist-breach stage');
    assert.equal(crimesCheck.crimeCards, 13, 'Unified 13-Tier Crime Progression Ladder rendered');
    assert.equal(crimesCheck.crime3DSlots, 13, 'All 13 Crime cards display 3D enhancer tool meshes');
    assert.equal(crimesCheck.lockedBtnDisabled, true, 'Locked crime button (#13 at Lv 3) is disabled');
    assert.match(crimesCheck.lockedBtnLabel, /Locked · Lv 14/, 'Locked crime button shows Locked · Lv 14 instead of Commit');
    assert.equal(crimesCheck.lockedBtnNotPrimary, true, 'Locked crime button does NOT use bright green primary variant');
    assert.equal(crimesCheck.legacyNavHidden, true, 'Duplicate legacy crime picker collapsed cleanly');
    assert.equal(crimesCheck.nemesisWarn, true, 'Nemesis Heat-Tax skim warning displayed on Crimes');
    assert.equal(crimesCheck.overflowX, 0, 'Zero horizontal overflow on Crimes');

    await page.click('[data-ztl-act="crime2"][data-id="1"]');
    await page.waitForFunction(() => document.querySelector('#zone-topbar-hud .zaaa-hud-nerve')?.textContent.trim() === '13/15');
    const cashAfterCrime = await page.evaluate(() => document.querySelector('#zone-topbar-hud .zaaa-hud-cash')?.textContent.trim());
    assert.equal(cashAfterCrime, '$15,300', 'Topbar Nerve (13/15) & Cash ($15,300) synced in 0ms after committing Crime');

    // Navigate to Casino -> verify Syndicate Arcade IS ALSO mounted & visible on Casino + 3D Casino Royale stage!
    await page.evaluate(() => window.__zoneGame.go('casino'));
    await page.waitForSelector('#zone-main[data-zone-screen="casino"] #zig-home-arcade', { timeout: 5000 });
    const casinoCheck = await page.evaluate(() => {
      const arc = document.getElementById('zig-home-arcade');
      const r = arc ? arc.getBoundingClientRect() : { height: 0 };
      return {
        visible: Boolean(arc && getComputedStyle(arc).display !== 'none' && r.height > 80),
        hasCasinoStage: Boolean(document.querySelector('#zone-main [data-z3d-stage="casino-royale"]')),
        overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
      };
    });
    assert.equal(casinoCheck.visible, true, 'Syndicate Arcade cleanly mounted and visible on Casino');
    assert.equal(casinoCheck.hasCasinoStage, true, 'Casino mounts live 3D casino-royale stage');
    assert.equal(casinoCheck.overflowX, 0, 'Zero horizontal overflow on Casino');

    // Navigate to Attack -> verify #ztl-attack-3d-stage (combat-arena) is mounted while #zone-torn-route-section remains null!
    await page.evaluate(() => window.__zoneGame.go('attack'));
    await page.waitForSelector('#zone-main[data-zone-screen="attack"] #ztl-attack-3d-stage[data-z3d-stage="combat-arena"]', { timeout: 5000 });
    const attackCheck = await page.evaluate(() => ({
      hasArenaStage: Boolean(document.querySelector('#ztl-attack-3d-stage[data-z3d-stage="combat-arena"]')),
      noTornRouteSec: document.getElementById('zone-torn-route-section') === null
    }));
    assert.equal(attackCheck.hasArenaStage, true, 'Attack mounts live 3D combat-arena stage');
    assert.equal(attackCheck.noTornRouteSec, true, 'Attack keeps #zone-torn-route-section null');

    // Navigate to Faction -> verify ZERO contradictory "fixed for this beta" text visible & unified HQ rendered
    await page.evaluate(() => window.__zoneGame.go('faction'));
    await page.waitForSelector('#zone-torn-route-section[data-ztl-route="faction"]', { timeout: 5000 });
    await page.waitForSelector('#zone-rpg-route-section', { timeout: 5000 });
    const factionCheck = await page.evaluate(() => {
      const main = document.getElementById('zone-main');
      const visibleText = main ? main.innerText : '';
      return {
        hasBetaContradiction: /fixed for this beta|ثابت في هذه النسخة التجريبية/i.test(visibleText),
        tornH: document.getElementById('zone-torn-route-section')?.offsetHeight || 0,
        rpgH: document.getElementById('zone-rpg-route-section')?.offsetHeight || 0,
        overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
      };
    });
    assert.equal(factionCheck.hasBetaContradiction, false, 'Contradictory "fixed for this beta" card hidden on Faction');
    assert.ok(factionCheck.tornH > 40 && factionCheck.rpgH > 40, 'Unified Faction Chain/Armory/Wall + Faction HQ/Respect/OCs/Wars visible');
    assert.equal(factionCheck.overflowX, 0, 'Zero horizontal overflow on Faction');

    assert.equal(errors.length, 0, `Zero runtime page errors: ${errors.join('; ')}`);
    await ctx.close();

    // 2) 4-Way Light/Dark & EN/AR RTL + 390x844 Mobile Geometry & Visual Screenshot Sweep
    const snapDir = resolve(tmpdir(), 'zone-v151-ui-shots');
    mkdirSync(snapDir, { recursive: true });

    for (const cfg of [
      { key: 'desktop-light-en', width: 1440, height: 900, lang: 'en', theme: 'light' },
      { key: 'desktop-dark-ar', width: 1440, height: 900, lang: 'ar', theme: 'dark' },
      { key: 'mobile-light-en', width: 390, height: 844, lang: 'en', theme: 'light' },
      { key: 'mobile-dark-ar', width: 390, height: 844, lang: 'ar', theme: 'dark' }
    ]) {
      const mCtx = await browser.newContext({ viewport: { width: cfg.width, height: cfg.height } });
      const mPage = await mCtx.newPage();
      await mPage.goto(`http://127.0.0.1:${port}/?screen=home&lang=${cfg.lang}`, { waitUntil: 'domcontentloaded' });
      await mPage.waitForSelector('#zone-ascension-hub', { timeout: 10000 });
      await mPage.evaluate((th) => document.documentElement.setAttribute('data-theme', th), cfg.theme);
      await mPage.waitForTimeout(180);

      const geom = await mPage.evaluate(() => {
        const tb = document.querySelector('.zone-topbar').getBoundingClientRect();
        const st = document.getElementById('zone-torn-hud-strip')?.getBoundingClientRect();
        const headerH = st ? Math.max(tb.bottom, st.bottom) - Math.min(tb.top, st.top) : tb.height;
        const hub = document.getElementById('zone-ascension-hub')?.getBoundingClientRect();
        return {
          headerH,
          hubH: hub ? hub.height : 0,
          dir: document.documentElement.dir,
          overflowX: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth)
        };
      });

      assert.ok(geom.headerH <= 96, `[${cfg.key}] Header height ${geom.headerH}px <= 96px`);
      assert.ok(geom.hubH > 180, `[${cfg.key}] Ascension Hub visible (${geom.hubH}px)`);
      assert.equal(geom.dir, cfg.lang === 'ar' ? 'rtl' : 'ltr', `[${cfg.key}] Correct document direction`);
      assert.equal(geom.overflowX, 0, `[${cfg.key}] 0px horizontal overflow`);

      if (cfg.key === 'mobile-light-en' || cfg.key === 'mobile-dark-ar') {
        await mPage.screenshot({ path: resolve(snapDir, `${cfg.key}.png`) });
      }
      await mCtx.close();
    }
  } finally {
    await browser.close();
    if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    server.close();
  }
});
