import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jsonPath = resolve(root, 'assets/data/zone-300-skills-encyclopedia.json');
const scriptPath = resolve(root, 'scripts/compile-300-gamedev-skills.py');
const uiPath = resolve(root, 'assets/ui/zone-world-encounters.js');
const skillsDir = 'C:/Users/user/.gemini/skills';
const ARABIC_RE = /[\u0600-\u06FF]/;
const SECRET_RE = /AIza[0-9A-Za-z_-]{35}|AQ\.[0-9A-Za-z_-]{30,}|sk-[0-9A-Za-z_-]{20,}|GEMINI_API_KEY\s*=/;

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

test('encyclopedia JSON exists with >= 300 real distinct skills, required schema fields, zero secrets, and live 2026 model', () => {
  assert.ok(existsSync(jsonPath), 'zone-300-skills-encyclopedia.json must exist');
  const raw = readFileSync(jsonPath, 'utf-8');
  assert.doesNotMatch(raw, SECRET_RE);

  const data = JSON.parse(raw);
  assert.equal(data.schemaVersion, 'zone-300-skills-encyclopedia.v157');
  assert.ok(data.skillsIndexed >= 300, `Expected skillsIndexed >= 300, got ${data.skillsIndexed}`);
  assert.ok(Array.isArray(data.skillsIndex) && data.skillsIndex.length >= 300);

  const model = String(data.batchJobMeta?.executedModel || '');
  assert.ok(model === 'gemini-3.5-flash' || model === 'gemini-3.8-flash', `Unexpected model: ${model}`);
  assert.doesNotMatch(model, /^gemini-(1\.5|2\.0|2\.5|3\.0|3\.1)/);
  assert.equal(data.batchJobMeta?.batchApiAttempted, true);

  const seen = new Set();
  for (const item of data.skillsIndex) {
    assert.ok(item.name && item.skillName && item.name === item.skillName, `Invalid skill name: ${item.name}`);
    assert.ok(!seen.has(item.name), `Duplicate skill: ${item.name}`);
    seen.add(item.name);
    assert.ok(existsSync(resolve(skillsDir, item.name, 'SKILL.md')), `Missing real SKILL.md for ${item.name}`);
    assert.ok(item.category && item.domain, `Missing category/domain on ${item.name}`);
    assert.ok(item.summary && item.zoneFeatureMapping, `Missing EN summary on ${item.name}`);
    assert.ok(item.summaryAr && item.zoneFeatureMappingAr && ARABIC_RE.test(item.summaryAr), `Missing AR summary on ${item.name}`);
    assert.ok(item.zoneModule && item.zoneModuleId, `Missing zoneModule on ${item.name}`);
    assert.ok(Array.isArray(item.extractedPrinciples) && item.extractedPrinciples.length >= 1);
  }
  assert.ok(seen.size >= 300);
  assert.equal(data.zoneModules.length, 12);
});

test('encyclopedia contains 12 education masterclasses, 12 job scenarios, 8 hospital & 8 jail encounters in EN + AR', () => {
  const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));

  assert.equal(data.educationCourses.length, 12);
  for (const c of data.educationCourses) {
    assert.ok(c.titleEn && c.titleAr && ARABIC_RE.test(c.titleAr));
    assert.ok(c.summaryEn && c.summaryAr && ARABIC_RE.test(c.summaryAr));
    assert.ok(c.principleEn && c.principleAr && ARABIC_RE.test(c.principleAr));
    assert.ok(c.quiz && c.quiz.questionEn && c.quiz.questionAr && ARABIC_RE.test(c.quiz.questionAr));
    assert.ok(Array.isArray(c.quiz.options) && c.quiz.options.length >= 3);
    assert.ok(c.quiz.options.some((o) => o.correct === true));
    for (const opt of c.quiz.options) {
      assert.ok(opt.labelEn && opt.labelAr && opt.feedbackEn && opt.feedbackAr);
    }
  }

  assert.equal(data.jobScenarios.length, 12);
  for (const s of data.jobScenarios) {
    assert.ok(s.roleEn && s.roleAr && ARABIC_RE.test(s.roleAr));
    assert.ok(s.dilemmaEn && s.dilemmaAr && ARABIC_RE.test(s.dilemmaAr));
    assert.ok(Array.isArray(s.choices) && s.choices.length >= 2);
    for (const ch of s.choices) {
      assert.ok(ch.labelEn && ch.labelAr && ch.outcomeEn && ch.outcomeAr && ch.statDeltaLabelEn && ch.statDeltaLabelAr);
    }
  }

  assert.equal(data.worldEncounters.hospital.length, 8);
  assert.equal(data.worldEncounters.jail.length, 8);
  for (const enc of [...data.worldEncounters.hospital, ...data.worldEncounters.jail]) {
    assert.ok(enc.npcNameEn && enc.npcNameAr && ARABIC_RE.test(enc.npcNameAr));
    assert.ok(enc.openerEn && enc.openerAr && ARABIC_RE.test(enc.openerAr));
    assert.ok(Array.isArray(enc.branches) && enc.branches.length >= 2);
    for (const br of enc.branches) {
      assert.ok(br.labelEn && br.labelAr && br.replyEn && br.replyAr && br.followUpEn && br.followUpAr);
    }
  }
});

test('python compiler enforces HARD MODEL LAW, .claude block, and zero secrets in source', () => {
  const pySrc = readFileSync(scriptPath, 'utf-8');
  assert.doesNotMatch(pySrc, SECRET_RE);
  const pyCheck = execFileSync(
    'C:/Users/user/.gemini/.venv/Scripts/python.exe',
    [
      '-c',
      'import importlib.util, pathlib; spec=importlib.util.spec_from_file_location("c300", r"' + scriptPath + '"); mod=importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); ' +
      'bad=False\n' +
      'for m in ("gemini-1.5-flash","gemini-2.0-flash","gemini-2.5-pro","gemini-3.0-flash","gemini-3.1-pro"):\n' +
      '  try: mod.validate_model_id(m); bad=True\n' +
      '  except ValueError: pass\n' +
      'assert not bad; assert mod.validate_model_id("gemini-3.5-flash")=="gemini-3.5-flash"\n' +
      'try: mod.validate_skills_dir(pathlib.Path("C:/Users/user/.claude/skills")); assert False\n' +
      'except (ValueError, FileNotFoundError): pass\n' +
      'print("MODEL_AND_DIR_LAWS_OK")',
    ],
    { encoding: 'utf-8' }
  );
  assert.match(pyCheck, /MODEL_AND_DIR_LAWS_OK/);
});

test('ZoneWorldEncounters mounts strictly on education, job/jobs, hospital, jail, and tutorial/account (0 mounts on home)', () => {
  const uiSrc = readFileSync(uiPath, 'utf-8');
  assert.doesNotMatch(uiSrc, SECRET_RE);

  const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  const factory = require(uiPath);
  assert.equal(typeof factory, 'object');

  const prevWin = globalThis.window;
  const prevDoc = globalThis.document;
  try {
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
      env.win.ZoneWorldEncounters.setData(data);
      return env.win.ZoneWorldEncounters;
    };

    // 1. HOME must have 0 mounts (even if #zone-tutorial-panel is present on home!)
    for (const tutFlag of [false, true]) {
      const homeEnv = makeMockDom({ screen: 'home', lang: 'en', tutorialOpen: tutFlag });
      runWithEnv(homeEnv);
      assert.equal(homeEnv.doc.getElementById('zone-world-encounters-root'), null, `Home (tut=${tutFlag}) must have 0 encounter mounts`);
      assert.equal(homeEnv.doc.getElementById('zone-skills-matrix-root'), null, `Home (tut=${tutFlag}) must have 0 matrix mounts`);
    }

    // 2. EDUCATION mount + quiz interaction + 390px overflow-safe CSS + HTML memoization
    const eduEnv = makeMockDom({ screen: 'education', lang: 'en' });
    const eduApi = runWithEnv(eduEnv);
    const eduRoot = eduEnv.doc.getElementById('zone-world-encounters-root');
    assert.ok(eduRoot, 'Education card should mount');
    assert.match(eduRoot.innerHTML, /data-zwe-screen="education"/);
    assert.match(eduRoot.innerHTML, /ZN-101|Masterclass|Field Micro-Check/);
    const styleNode = eduEnv.doc.getElementById('zwe-sketchbook-styles');
    assert.ok(styleNode && styleNode.textContent.includes('max-width: 100%') && styleNode.textContent.includes('overflow-x: hidden'), '390px safe CSS present');

    const writesBeforeIdempotentRender = eduRoot.innerHTMLWrites;
    eduApi.render();
    assert.equal(eduRoot.innerHTMLWrites, writesBeforeIdempotentRender, 'Idempotent render must not rewrite innerHTML');

    const firstCourse = data.educationCourses[0];
    const correctOpt = firstCourse.quiz.options.find((o) => o.correct) || firstCourse.quiz.options[0];
    eduRoot.dispatchEvent({
      type: 'click',
      target: {
        closest: () => ({
          getAttribute: (k) => (k === 'data-zwe-act' ? 'quiz-pick' : k === 'data-course' ? firstCourse.id : k === 'data-opt' ? correctOpt.id : null),
        }),
      },
    });
    assert.equal(eduApi.getState().quizAnswers[firstCourse.id], correctOpt.id);
    assert.match(eduRoot.innerHTML, /MASTERED/);

    // Switch back to home -> must cleanly unmount
    eduEnv.main.setAttribute('data-zone-screen', 'home');
    eduApi.render();
    assert.equal(eduEnv.doc.getElementById('zone-world-encounters-root'), null, 'Navigating to home must unmount card');

    // 3. JOB / JOBS mount in Arabic RTL
    const jobEnv = makeMockDom({ screen: 'job', lang: 'ar' });
    const jobApi = runWithEnv(jobEnv);
    const jobRoot = jobEnv.doc.getElementById('zone-world-encounters-root');
    assert.ok(jobRoot && jobRoot.innerHTML.includes('data-zwe-screen="jobs"'));
    assert.match(jobRoot.innerHTML, /dir="rtl"/);
    assert.match(jobRoot.innerHTML, /مكتب المهن وشركات اللاعبين/);
    const firstJob = data.jobScenarios[0];
    jobRoot.dispatchEvent({
      type: 'click',
      target: {
        closest: () => ({
          getAttribute: (k) => (k === 'data-zwe-act' ? 'job-pick' : k === 'data-scenario' ? firstJob.id : k === 'data-choice' ? firstJob.choices[0].id : null),
        }),
      },
    });
    assert.equal(jobApi.getState().jobChoices[firstJob.id], firstJob.choices[0].id);

    // 4. HOSPITAL & JAIL branching dialogue mounts (EN & AR RTL)
    for (const [scr, langCode] of [['hospital', 'en'], ['jail', 'ar']]) {
      const env = makeMockDom({ screen: scr, lang: langCode });
      const api = runWithEnv(env);
      const r = env.doc.getElementById('zone-world-encounters-root');
      assert.ok(r && r.innerHTML.includes(`data-zwe-screen="${scr}"`), `${scr} card must mount`);
      const enc = data.worldEncounters[scr][0];
      r.dispatchEvent({
        type: 'click',
        target: {
          closest: () => ({
            getAttribute: (k) => (k === 'data-zwe-act' ? 'enc-pick' : k === 'data-enc' ? enc.id : k === 'data-branch' ? enc.branches[0].id : null),
          }),
        },
      });
      assert.equal(api.getState().dialogueBranches[enc.id], enc.branches[0].id);
    }

    // 5. TUTORIAL screen & ACCOUNT page 300+ Skills Matrix badge + toggle
    const tutEnv = makeMockDom({ screen: 'tutorial', lang: 'en' });
    const tutApi = runWithEnv(tutEnv);
    assert.equal(tutEnv.doc.getElementById('zone-world-encounters-root'), null);
    const tutMat = tutEnv.doc.getElementById('zone-skills-matrix-root');
    assert.ok(tutMat && tutMat.innerHTML.includes('Game-Dev Skills Applied Matrix'), 'Tutorial screen must mount matrix');
    tutMat.dispatchEvent({
      type: 'click',
      target: {
        closest: () => ({
          getAttribute: (k) => (k === 'data-zwe-act' ? 'matrix-toggle' : null),
        }),
      },
    });
    assert.equal(tutApi.getState().matrixOpen, true);
    assert.match(tutMat.innerHTML, /zwe-matrix-grid/);

    const accEnv = makeMockDom({ screen: 'home', lang: 'ar', pathname: '/account', isAccount: true });
    runWithEnv(accEnv);
    assert.equal(accEnv.doc.getElementById('zone-world-encounters-root'), null);
    const accMat = accEnv.doc.getElementById('zone-skills-matrix-root');
    assert.ok(accMat && ARABIC_RE.test(accMat.innerHTML));
  } finally {
    globalThis.window = prevWin;
    globalThis.document = prevDoc;
  }
});
