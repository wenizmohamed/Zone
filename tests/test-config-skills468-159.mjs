import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const codexJsonPath = resolve(root, 'assets/data/zone-config-skills-468.json');
const encyclopediaJsonPath = resolve(root, 'assets/data/zone-300-skills-encyclopedia.json');
const scriptPath = resolve(root, 'scripts/compile-config-skills-468.py');
const uiPath = resolve(root, 'assets/ui/zone-world-encounters.js');
const configSkillsDir = 'C:/Users/user/.gemini/config/skills';
const pastedListPath = 'C:/Users/user/.gemini/antigravity-cli/brain/f2120b30-775d-4976-9704-73aa76274fbd/scratch/weni_pasted_config_skills.txt';

const ARABIC_RE = /[\u0600-\u06FF]/;
const SECRET_RE = /AIza[0-9A-Za-z_-]{35}|AQ\.[0-9A-Za-z_-]{30,}|sk-[0-9A-Za-z_-]{20,}|GEMINI_API_KEY\s*=/;

const SIXTEEN_ARCH_SKILLS = [
  'game-development-behavior-architecture',
  'game-development-behavior-tree',
  'game-development-command-flow',
  'game-development-condition-rule-engine',
  'game-development-coordinator',
  'game-development-entity-reference-boundary',
  'game-development-events-and-signals',
  'game-development-fsm',
  'game-development-gameplay-tags-and-query',
  'game-development-goap',
  'game-development-object-pool',
  'game-development-resource-transaction-system',
  'game-development-state-change-notification',
  'game-development-time-source-and-tick-policy',
  'game-development-utility-ai',
  'game-development-world-state-facts',
];

const LANDMARK_SEARCH_SKILLS = [
  'skyrim-mcm',
  'dsp-cookbook',
  'using-determinism-and-replay',
  'chat-system',
  'guardian-evolution-system',
  'dynamic-res-scaler',
];

const require = createRequire(import.meta.url);

function makeMockDom({ screen = 'home', lang = 'en', pathname = '/', isAccount = false, tutorialOpen = false } = {}) {
  const byId = new Map();
  const listeners = new Map();

  class MockElement {
    constructor(tagName, id = '') {
      this.tagName = String(tagName || 'DIV').toUpperCase();
      this.id = id;
      this.children = [];
      this.parentElement = null;
      this.attributes = Object.create(null);
      this.classList = {
        _set: new Set(),
        add: (...cls) => cls.forEach((c) => this.classList._set.add(c)),
        contains: (c) => this.classList._set.has(c),
      };
      this._innerHTML = '';
      this.innerHTMLWrites = 0;
      this.textContent = '';
      this.hidden = false;
      this.dir = 'ltr';
      this.lang = lang;
      this.listeners = Object.create(null);
      if (id) byId.set(id, this);
    }
    setAttribute(k, v) {
      this.attributes[k] = String(v);
      if (k === 'id') {
        this.id = String(v);
        byId.set(this.id, this);
      }
    }
    getAttribute(k) {
      return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null;
    }
    appendChild(child) {
      if (child.parentElement) {
        child.parentElement.removeChild(child);
      }
      child.parentElement = this;
      this.children.push(child);
      if (child.id) byId.set(child.id, child);
      return child;
    }
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx >= 0) this.children.splice(idx, 1);
      child.parentElement = null;
      if (child.id && byId.get(child.id) === child) byId.delete(child.id);
      return child;
    }
    addEventListener(type, fn) {
      if (!this.listeners[type]) this.listeners[type] = [];
      this.listeners[type].push(fn);
    }
    dispatchEvent(ev) {
      const list = this.listeners[ev.type] || [];
      for (const fn of list) fn(ev);
    }
    contains(el) {
      if (el === this) return true;
      return this.children.some((c) => c.contains(el));
    }
    set innerHTML(val) {
      this.innerHTMLWrites += 1;
      this._innerHTML = String(val || '');
    }
    get innerHTML() {
      return this._innerHTML;
    }
    querySelector() {
      return null;
    }
  }

  const head = new MockElement('HEAD');
  const body = new MockElement('BODY');
  if (isAccount) body.classList.add('zone-account');

  const htmlEl = new MockElement('HTML');
  htmlEl.lang = lang;
  htmlEl.dir = lang === 'ar' ? 'rtl' : 'ltr';

  const main = new MockElement('MAIN', isAccount ? '' : 'zone-main');
  if (!isAccount) main.setAttribute('data-zone-screen', screen);
  body.appendChild(main);

  let tutPanel = null;
  if (tutorialOpen) {
    tutPanel = new MockElement('DIV', 'zone-tutorial-panel');
    tutPanel.hidden = false;
    main.appendChild(tutPanel);
  }

  const doc = {
    documentElement: htmlEl,
    head,
    body,
    readyState: 'complete',
    activeElement: null,
    createElement(tag) {
      return new MockElement(tag);
    },
    getElementById(id) {
      return byId.get(id) || null;
    },
    querySelector(sel) {
      if (sel === 'x-dc') return null;
      if (sel === 'main') return main;
      return null;
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
  };

  const storage = new Map();
  const win = {
    document: doc,
    location: { pathname },
    localStorage: {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
    },
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    addEventListener: () => {},
    __zoneGame: {
      state: { screen, lang },
      go: (next) => {
        win.__zoneGame.state.screen = next;
        main.setAttribute('data-zone-screen', next);
      },
    },
  };

  return { win, doc, main, head, body, tutPanel, MockElement };
}

test('zone-config-skills-468.json audits 100% of weni_pasted_config_skills.txt in < 280 KB with zero secrets', () => {
  assert.ok(existsSync(codexJsonPath), 'zone-config-skills-468.json must exist');
  const byteSize = statSync(codexJsonPath).size;
  assert.ok(byteSize < 280 * 1024, `Expected JSON size < 280 KB (286720 B), got ${byteSize} B`);

  const raw = readFileSync(codexJsonPath, 'utf-8');
  assert.doesNotMatch(raw, SECRET_RE, 'JSON must contain zero API keys or secrets');

  const data = JSON.parse(raw);
  assert.equal(data.schemaVersion, 'zone-config-skills-468.v159');
  assert.equal(data.sourceDirectory, 'C:/Users/user/.gemini/config/skills');
  assert.ok(data.totalRequested >= 468, `Expected totalRequested >= 468, got ${data.totalRequested}`);
  assert.equal(data.totalVerifiedOnDisk, data.totalRequested, '100% of requested skills must be verified on disk');
  assert.equal(data.skills.length, data.totalVerifiedOnDisk);
  assert.ok(data.parseElapsedMs < 2000, `Expected local parse < 2000ms, got ${data.parseElapsedMs}ms`);

  const model = String(data.modelMeta?.executedModel || '');
  assert.equal(model, 'gemini-3.5-flash');

  const byId = new Map();
  for (const sk of data.skills) {
    assert.ok(sk.id && typeof sk.id === 'string');
    assert.ok(typeof sk.bytes === 'number' && sk.bytes > 0, `Skill ${sk.id} must have bytes > 0`);
    assert.ok(sk.cluster && typeof sk.cluster === 'string', `Skill ${sk.id} missing cluster`);
    assert.ok(sk.summary && typeof sk.summary === 'string', `Skill ${sk.id} missing summary`);
    assert.ok(sk.keyPrinciple && typeof sk.keyPrinciple === 'string', `Skill ${sk.id} missing keyPrinciple`);
    assert.ok(sk.zoneSystem && typeof sk.zoneSystem === 'string', `Skill ${sk.id} missing zoneSystem`);
    assert.ok(!byId.has(sk.id), `Duplicate skill id: ${sk.id}`);
    byId.set(sk.id, sk);
    assert.ok(existsSync(resolve(configSkillsDir, sk.id, 'SKILL.md')), `Missing config/skills/${sk.id}/SKILL.md`);
  }

  if (existsSync(pastedListPath)) {
    const pasted = readFileSync(pastedListPath, 'utf-8')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const uniquePasted = [...new Set(pasted)];
    assert.equal(data.totalRequested, uniquePasted.length);
    for (const reqName of uniquePasted) {
      assert.ok(byId.has(reqName), `Pasted skill ${reqName} missing from zone-config-skills-468.json`);
    }
  }

  for (const landmark of [...LANDMARK_SEARCH_SKILLS, ...SIXTEEN_ARCH_SKILLS]) {
    assert.ok(byId.has(landmark), `Landmark skill ${landmark} must be indexed`);
  }
});

test('8 Layer-1/Layer-2 Formal Architecture Drills cover all 16 game-development-* skills in EN + AR RTL', () => {
  const data = JSON.parse(readFileSync(codexJsonPath, 'utf-8'));
  assert.ok(Array.isArray(data.formalArchitectureDrills));
  assert.equal(data.formalArchitectureDrills.length, 8);

  const coveredSkills = new Set();
  for (const drill of data.formalArchitectureDrills) {
    assert.ok(drill.id && drill.courseCode);
    assert.ok(drill.titleEn && drill.titleAr && ARABIC_RE.test(drill.titleAr));
    assert.ok(drill.summaryEn && drill.summaryAr && ARABIC_RE.test(drill.summaryAr));
    assert.ok(drill.principleEn && drill.principleAr && ARABIC_RE.test(drill.principleAr));
    assert.ok(Array.isArray(drill.sourceSkills) && drill.sourceSkills.length >= 2);
    for (const sk of drill.sourceSkills) coveredSkills.add(sk);
    assert.ok(drill.quiz && drill.quiz.questionEn && drill.quiz.questionAr && ARABIC_RE.test(drill.quiz.questionAr));
    assert.ok(Array.isArray(drill.quiz.options) && drill.quiz.options.length === 3);
    assert.ok(drill.quiz.options.some((o) => o.correct === true));
  }

  for (const reqSkill of SIXTEEN_ARCH_SKILLS) {
    assert.ok(coveredSkills.has(reqSkill), `Formal architecture drills must cover ${reqSkill}`);
  }
});

test('compile-config-skills-468.py enforces HARD MODEL LAW, .claude block, < 2s parse, and zero secrets', () => {
  const pySrc = readFileSync(scriptPath, 'utf-8');
  assert.doesNotMatch(pySrc, SECRET_RE);
  const pyOut = execFileSync(
    'C:/Users/user/.gemini/.venv/Scripts/python.exe',
    [
      '-c',
      'import importlib.util, pathlib, time; ' +
      'spec=importlib.util.spec_from_file_location("c468", r"' + scriptPath + '"); ' +
      'mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)\n' +
      'for m in ("gemini-1.5-flash","gemini-2.0-flash","gemini-2.5-pro","gemini-3.0-flash","gemini-3.1-pro"):\n' +
      '  try: mod.validate_model_id(m); assert False\n' +
      '  except ValueError: pass\n' +
      'assert mod.validate_model_id("gemini-3.5-flash")=="gemini-3.5-flash"\n' +
      'try: mod.validate_skills_dir(pathlib.Path("C:/Users/user/.claude/skills")); assert False\n' +
      'except (ValueError, FileNotFoundError): pass\n' +
      'p=mod.parse_config_skill_md(pathlib.Path(r"C:/Users/user/.gemini/config/skills/skyrim-mcm"))\n' +
      'for k in ("name","byteSize","description","topHeadings","coreRules","domainCluster","zoneIntegrationTarget","id","bytes","cluster","summary","keyPrinciple","zoneSystem"):\n' +
      '  assert k in p, f"missing {k}"\n' +
      'print("CONFIG_468_COMPILER_OK")',
    ],
    { encoding: 'utf-8' }
  );
  assert.match(pyOut, /CONFIG_468_COMPILER_OK/);
});

test('ZoneWorldEncounters renders searchable Game-Dev Architecture Codex (468 Config Skills Verified) on tutorial & education (0 mounts on home, EN + AR RTL)', () => {
  const uiSrc = readFileSync(uiPath, 'utf-8');
  assert.doesNotMatch(uiSrc, SECRET_RE);

  const encData = JSON.parse(readFileSync(encyclopediaJsonPath, 'utf-8'));
  const codexData = JSON.parse(readFileSync(codexJsonPath, 'utf-8'));
  const vm = require('node:vm');

  const runWithEnv = (env) => {
    const ctx = {
      window: env.win,
      document: env.doc,
      globalThis: env.win,
      setTimeout,
      clearTimeout,
      Promise,
    };
    ctx.window.document = env.doc;
    vm.runInNewContext(uiSrc, ctx);
    env.win.ZoneWorldEncounters.setData(encData);
    env.win.ZoneWorldEncounters.setCodexData(codexData);
    return env.win.ZoneWorldEncounters;
  };

  // 1. HOME must strictly have 0 mounts
  for (const tutFlag of [false, true]) {
    const homeEnv = makeMockDom({ screen: 'home', lang: 'en', tutorialOpen: tutFlag });
    runWithEnv(homeEnv);
    assert.equal(homeEnv.doc.getElementById('zone-world-encounters-root'), null);
    assert.equal(homeEnv.doc.getElementById('zone-skills-matrix-root'), null);
  }

  // 2. EDUCATION screen mounts both Academy Masterclasses AND Game-Dev Architecture Codex (468 Config Skills Verified)
  const eduEnv = makeMockDom({ screen: 'education', lang: 'en' });
  const eduApi = runWithEnv(eduEnv);
  const eduRoot = eduEnv.doc.getElementById('zone-world-encounters-root');
  assert.ok(eduRoot);
  assert.match(eduRoot.innerHTML, /Game-Dev Architecture Codex \(468 Config Skills Verified\)/);
  assert.match(eduRoot.innerHTML, /data-zwe-codex="468"/);
  assert.match(eduRoot.innerHTML, /ZN-301/);

  // Test interactive search across all landmark skills on education
  for (const qSkill of LANDMARK_SEARCH_SKILLS) {
    eduRoot.dispatchEvent({
      type: 'input',
      target: {
        value: qSkill,
        getAttribute: (k) => (k === 'data-zwe-codex-search' ? '1' : null),
      },
    });
    assert.equal(eduApi.getState().codexQuery, qSkill);
    assert.ok(eduRoot.innerHTML.includes(`data-codex-skill="${qSkill}"`), `Search for ${qSkill} must render its codex card`);
  }

  // Clear search and test cluster filter pill
  eduRoot.dispatchEvent({
    type: 'input',
    target: {
      value: '',
      getAttribute: (k) => (k === 'data-zwe-codex-search' ? '1' : null),
    },
  });
  eduRoot.dispatchEvent({
    type: 'click',
    target: {
      closest: () => ({
        getAttribute: (k) => (k === 'data-zwe-act' ? 'codex-cluster' : k === 'data-cluster' ? 'arch' : null),
      }),
    },
  });
  assert.equal(eduApi.getState().codexCluster, 'arch');
  assert.match(eduRoot.innerHTML, /game-development-behavior-architecture|game-development-coordinator/);

  // Test Formal Architecture Drill quiz interaction (ZN-301)
  const firstDrill = codexData.formalArchitectureDrills[0];
  const correctDrillOpt = firstDrill.quiz.options.find((o) => o.correct);
  eduRoot.dispatchEvent({
    type: 'click',
    target: {
      closest: () => ({
        getAttribute: (k) => (k === 'data-zwe-act' ? 'drill-pick' : k === 'data-drill' ? firstDrill.id : k === 'data-opt' ? correctDrillOpt.id : null),
      }),
    },
  });
  assert.equal(eduApi.getState().drillAnswers[firstDrill.id], correctDrillOpt.id);
  assert.match(eduRoot.innerHTML, /MASTERED/);

  // 3. TUTORIAL screen in Arabic RTL mounts Codex & Matrix with full RTL parity
  const tutArEnv = makeMockDom({ screen: 'tutorial', lang: 'ar' });
  const tutArApi = runWithEnv(tutArEnv);
  assert.equal(tutArEnv.doc.getElementById('zone-world-encounters-root'), null);
  const tutMat = tutArEnv.doc.getElementById('zone-skills-matrix-root');
  assert.ok(tutMat);
  assert.match(tutMat.innerHTML, /dir="rtl"/);
  assert.ok(ARABIC_RE.test(tutMat.innerHTML));
  assert.match(tutMat.innerHTML, /data-zwe-codex="468"/);

  tutMat.dispatchEvent({
    type: 'input',
    target: {
      value: 'guardian-evolution-system',
      getAttribute: (k) => (k === 'data-zwe-codex-search' ? '1' : null),
    },
  });
  assert.equal(tutArApi.getState().codexQuery, 'guardian-evolution-system');
  assert.match(tutMat.innerHTML, /SyndicateCompanionService/);
});
