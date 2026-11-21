import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACK_PATH = resolve(root, 'assets/data/zone-batch-skill-pack.json');
const LIVEOPS_JS_PATH = resolve(root, 'assets/ui/zone-batch-liveops.js');
const PY_SCRIPT_PATH = resolve(root, 'scripts/gemini-batch-gamedev.py');
const VENV_PY = 'C:/Users/user/.gemini/.venv/Scripts/python.exe';

const SECRET_REGEXES = [
  /AIza[0-9A-Za-z_-]{35}/,
  /AQ\.[0-9A-Za-z_-]{30,}/,
  /sk-[0-9A-Za-z_-]{20,}/,
  /GEMINI_API_KEY\s*=\s*["']?[A-Za-z0-9._-]{16,}/,
];

const FORBIDDEN_MODELS = [
  /^gemini-1\.5/,
  /^gemini-2\.0/,
  /^gemini-2\.5/,
  /^gemini-3\.0/,
  /^gemini-3\.1/,
];

const ARABIC_RE = /[\u0600-\u06FF]/;
const REQUIRED_DISTRICTS = ['north', 'fin', 'res', 'red', 'west', 'center'];

/** Minimal deterministic DOM harness for testing zone-batch-liveops.js without external deps */
function createMiniDom() {
  class MiniElement {
    constructor(tagName, ownerDoc) {
      this.tagName = String(tagName || 'DIV').toUpperCase();
      this.ownerDocument = ownerDoc;
      this.attrs = new Map();
      this.children = [];
      this.parentElement = null;
      this._innerHTML = '';
      this._textContent = '';
      this.id = '';
      this.className = '';
      this.style = {};
      this.listeners = new Map();
    }
    setAttribute(k, v) {
      const val = String(v);
      this.attrs.set(k, val);
      if (k === 'id') this.id = val;
      if (k === 'class') this.className = val;
    }
    getAttribute(k) {
      if (k === 'id') return this.id || this.attrs.get('id') || null;
      if (k === 'class') return this.className || this.attrs.get('class') || null;
      return this.attrs.has(k) ? this.attrs.get(k) : null;
    }
    appendChild(child) {
      if (child.parentElement) child.parentElement.removeChild(child);
      child.parentElement = this;
      this.children.push(child);
      return child;
    }
    insertBefore(child, refNode) {
      if (child.parentElement) child.parentElement.removeChild(child);
      child.parentElement = this;
      const idx = refNode ? this.children.indexOf(refNode) : -1;
      if (idx >= 0) this.children.splice(idx, 0, child);
      else this.children.push(child);
      return child;
    }
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx >= 0) {
        this.children.splice(idx, 1);
        child.parentElement = null;
      }
      return child;
    }
    set innerHTML(html) {
      this._innerHTML = String(html || '');
      this._textContent = this._innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    get innerHTML() {
      return this._innerHTML;
    }
    set textContent(txt) {
      this._textContent = String(txt || '');
      this._innerHTML = this._textContent;
    }
    get textContent() {
      if (this._textContent) return this._textContent;
      return this.children.map((c) => c.textContent).join(' ');
    }
    matches(sel) {
      if (!sel) return false;
      const parts = sel.split(/\s+/);
      if (parts.length > 1) return this.matches(parts[parts.length - 1]);
      if (sel.startsWith('#')) return this.id === sel.slice(1);
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        return this.className.split(/\s+/).includes(cls);
      }
      const attrMatch = sel.match(/^\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]$/);
      if (attrMatch) {
        const cur = this.getAttribute(attrMatch[1]);
        if (attrMatch[2] !== undefined) return cur === attrMatch[2];
        return cur !== null;
      }
      return this.tagName === sel.toUpperCase();
    }
    closest(sel) {
      let cur = this;
      while (cur) {
        if (cur.matches(sel)) return cur;
        cur = cur.parentElement;
      }
      return null;
    }
    querySelectorAll(sel) {
      const out = [];
      const walk = (node) => {
        for (const ch of node.children) {
          if (ch.matches(sel)) out.push(ch);
          walk(ch);
        }
      };
      walk(this);
      return out;
    }
    querySelector(sel) {
      if (sel.includes(' ')) {
        const tokens = sel.trim().split(/\s+/);
        let pool = [this];
        for (const tok of tokens) {
          const next = [];
          for (const n of pool) next.push(...n.querySelectorAll(tok));
          pool = next;
        }
        return pool[0] || null;
      }
      return this.querySelectorAll(sel)[0] || null;
    }
  }

  const doc = {
    readyState: 'complete',
    documentElement: null,
    head: null,
    body: null,
    listeners: new Map(),
    createElement(tag) {
      return new MiniElement(tag, doc);
    },
    getElementById(id) {
      return doc.documentElement.querySelector('#' + id);
    },
    querySelector(sel) {
      return doc.documentElement.querySelector(sel);
    },
    querySelectorAll(sel) {
      return doc.documentElement.querySelectorAll(sel);
    },
    addEventListener(type, fn) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(fn);
    },
    dispatchClick(target) {
      const fns = this.listeners.get('click') || [];
      const ev = { target, preventDefault() {} };
      for (const fn of fns) fn(ev);
    },
  };
  doc.documentElement = new MiniElement('html', doc);
  doc.documentElement.dir = 'ltr';
  doc.documentElement.lang = 'en';
  doc.head = new MiniElement('head', doc);
  doc.body = new MiniElement('body', doc);
  doc.documentElement.appendChild(doc.head);
  doc.documentElement.appendChild(doc.body);

  const navigated = [];
  const win = {
    document: doc,
    __zoneGame: {
      state: { screen: 'home', lang: 'en' },
      go(scr) {
        navigated.push(scr);
        this.state.screen = scr;
      },
    },
    addEventListener() {},
    requestAnimationFrame(cb) {
      cb();
      return 1;
    },
  };
  return { window: win, document: doc, navigated };
}

test('1. Batch synthesizer CLI enforces Hard Model Law, Strict Directory Law, and 50% cost estimator', () => {
  assert.ok(existsSync(PY_SCRIPT_PATH), 'scripts/gemini-batch-gamedev.py must exist');
  const estOut = execFileSync(VENV_PY, [PY_SCRIPT_PATH, '--estimate-only'], { encoding: 'utf8' });
  const est = JSON.parse(estOut);
  assert.ok(est.skillsCount >= 32, `Expected >= 32 skills in batch plan, got ${est.skillsCount}`);
  assert.ok(est.requests >= 8, `Expected >= 8 batch requests, got ${est.requests}`);
  assert.equal(est.estimatedCostTelemetry.discountPct, 50);
  assert.ok(
    Math.abs(est.estimatedCostTelemetry.batchCostUsd - est.estimatedCostTelemetry.standardCostUsd * 0.5) < 0.00001,
    'Batch cost must be exactly 50% of standard cost'
  );

  // Verify Hard Model Law rejects legacy gemini-2.5-flash
  assert.throws(
    () => execFileSync(VENV_PY, [PY_SCRIPT_PATH, '--estimate-only', '--model', 'gemini-2.5-flash'], { stdio: 'pipe' }),
    /HARD MODEL LAW VIOLATION/
  );
  // Verify Strict Directory Law rejects .claude
  assert.throws(
    () => execFileSync(VENV_PY, [PY_SCRIPT_PATH, '--estimate-only', '--skills-dir', 'C:/Users/user/.claude/skills'], { stdio: 'pipe' }),
    /STRICT DIRECTORY LAW VIOLATION/
  );
});

test('2. zone-batch-skill-pack.json has honest verified batchJobMeta, >=32 skills, 50% cost telemetry & bilingual EN/AR completeness', () => {
  assert.ok(existsSync(PACK_PATH), 'assets/data/zone-batch-skill-pack.json must exist');
  const raw = readFileSync(PACK_PATH, 'utf8');
  const pack = JSON.parse(raw);

  assert.equal(pack.schemaVersion, 'zone-batch-skill-pack.v156');
  const meta = pack.batchJobMeta;
  assert.ok(meta && typeof meta === 'object', 'batchJobMeta must exist');
  assert.equal(meta.batchApiAttempted, true, 'client.batches.create must be attempted first');
  assert.ok(
    meta.state === 'JOB_STATE_SUCCEEDED' || meta.state === 'REALTIME_FALLBACK_SUCCEEDED',
    `Unexpected synthesis state: ${meta.state}`
  );
  assert.ok(meta.jobName && typeof meta.jobName === 'string' && meta.jobName.length >= 6, 'Non-empty jobName required');
  for (const badRe of FORBIDDEN_MODELS) {
    assert.ok(!badRe.test(String(meta.modelId)), `Forbidden legacy model used: ${meta.modelId}`);
    assert.ok(!badRe.test(String(meta.executedModel)), `Forbidden legacy executedModel used: ${meta.executedModel}`);
  }
  assert.ok(meta.requestCount >= 8, `Expected >= 8 synthesis requests, got ${meta.requestCount}`);
  assert.ok(meta.skillsSynthesized >= 32, `Expected >= 32 skillsSynthesized, got ${meta.skillsSynthesized}`);
  assert.ok(meta.skillsDigestedCount >= 32, `Expected >= 32 skills digested, got ${meta.skillsDigestedCount}`);
  assert.ok(Array.isArray(meta.skillsDigested) && meta.skillsDigested.length >= 32);
  if (meta.state === 'REALTIME_FALLBACK_SUCCEEDED') {
    assert.equal(meta.effectiveDollarCostUsd, 0, 'Free-tier fallback must record $0.00 effective cost');
    assert.ok(Array.isArray(meta.batchApiErrors) && meta.batchApiErrors.length >= 1, 'Honest batchApiErrors trace required on fallback');
  }

  // 50% Cost telemetry
  const cost = meta.costTelemetry;
  assert.equal(cost.discountPct, 50);
  assert.ok(cost.totalTokens > 0, 'Total tokens must be > 0');
  assert.ok(cost.savingsUsd > 0, 'Savings USD must be > 0');
  assert.ok(cost.batchCostUsd <= cost.standardCostUsd * 0.501, 'Batch cost must reflect 50% discount');

  // Item Provenance coverage across categories (weapons, armor, drugs, meds, boosters, enhancers)
  const prov = pack.itemProvenance;
  assert.ok(prov && Object.keys(prov).length >= 20, 'Need >= 20 item provenance entries');
  for (const requiredItem of ['ak', 'kevlar', 'xanax', 'medkit', 'edrink', 'lockpick']) {
    assert.ok(prov[requiredItem], `Missing provenance entry for ${requiredItem}`);
    const entry = prov[requiredItem];
    assert.ok(entry.originEn && entry.originAr && ARABIC_RE.test(entry.originAr), `Bilingual origin required for ${requiredItem}`);
    assert.ok(entry.makerEn && entry.makerAr && ARABIC_RE.test(entry.makerAr), `Bilingual maker required for ${requiredItem}`);
    assert.ok(entry.craftTier && entry.craftTierAr, `Craft tier required for ${requiredItem}`);
    assert.ok(entry.synergyEn && entry.synergyAr && ARABIC_RE.test(entry.synergyAr), `Bilingual synergy required for ${requiredItem}`);
  }

  // Rumor Wire coverage across all 6 Zone City districts
  assert.ok(Array.isArray(pack.rumorWire) && pack.rumorWire.length >= 12, 'Need >= 12 district rumors');
  const seenDistricts = new Set();
  for (const r of pack.rumorWire) {
    seenDistricts.add(r.district);
    assert.ok(r.headlineEn && r.headlineAr && ARABIC_RE.test(r.headlineAr), `Bilingual rumor headline required (${r.id})`);
    assert.ok(r.bodyEn && r.bodyAr && ARABIC_RE.test(r.bodyAr), `Bilingual rumor body required (${r.id})`);
    assert.ok(r.heatWarningEn && r.heatWarningAr && ARABIC_RE.test(r.heatWarningAr), `Bilingual heat warning required (${r.id})`);
    assert.ok(r.smugglingTipEn && r.smugglingTipAr && ARABIC_RE.test(r.smugglingTipAr), `Bilingual smuggling tip required (${r.id})`);
  }
  for (const d of REQUIRED_DISTRICTS) {
    assert.ok(seenDistricts.has(d), `Missing rumor coverage for district '${d}'`);
  }

  // Quest Hub flash contracts & Luna / Mayor Tariq comms
  const qh = pack.questHub;
  assert.ok(qh && Array.isArray(qh.flashContracts) && qh.flashContracts.length >= 4, 'Need >= 4 flash contracts');
  assert.ok(Array.isArray(qh.tacticalComms) && qh.tacticalComms.length >= 6, 'Need >= 6 tactical comms');
  const speakers = new Set(qh.tacticalComms.map((c) => c.speaker));
  assert.ok(speakers.has('luna') && speakers.has('mayor_tariq'), 'Tactical comms must include both luna and mayor_tariq');
  for (const ct of qh.flashContracts) {
    assert.ok(ct.titleEn && ct.titleAr && ARABIC_RE.test(ct.titleAr));
    assert.ok(ct.briefingEn && ct.briefingAr && ARABIC_RE.test(ct.briefingAr));
    assert.ok(Array.isArray(ct.branches) && ct.branches.length >= 2, `Contract ${ct.id} must have >= 2 branches`);
  }
});

test('3. Zero leaked API keys or secrets across all 4 owned files', () => {
  const owned = [
    PY_SCRIPT_PATH,
    PACK_PATH,
    LIVEOPS_JS_PATH,
    resolve(root, 'tests/test-batch-liveops156.mjs'),
  ];
  for (const fp of owned) {
    assert.ok(existsSync(fp), `Owned file missing: ${fp}`);
    const txt = readFileSync(fp, 'utf8');
    for (const re of SECRET_REGEXES) {
      assert.ok(!re.test(txt), `Potential secret leak matched ${re} in ${fp}`);
    }
  }
});

test('4. zone-batch-liveops.js enriches 3D modal, items inspector, newspaper, city, missions & preserves Home 0px impact', () => {
  const pack = JSON.parse(readFileSync(PACK_PATH, 'utf8'));
  const code = readFileSync(LIVEOPS_JS_PATH, 'utf8');
  const { window, document } = createMiniDom();

  const main = document.createElement('main');
  main.setAttribute('id', 'zone-main');
  main.setAttribute('data-zone-screen', 'home');
  const arcade = document.createElement('section');
  arcade.setAttribute('id', 'zig-home-arcade');
  main.appendChild(arcade);
  document.body.appendChild(main);

  // Execute zone-batch-liveops.js in sandboxed VM
  vm.runInNewContext(code, { window, document, console, setTimeout, clearTimeout });
  assert.ok(window.ZoneBatchLiveOps, 'window.ZoneBatchLiveOps must be registered');
  window.ZoneBatchLiveOps.setPack(pack);

  // A. Home zero-clutter check (0px impact on #zig-home-arcade)
  assert.equal(document.getElementById('zbl-rumor-wire'), null, 'Rumor wire must NOT mount on Home');
  assert.equal(document.getElementById('zbl-quest-hub'), null, 'Quest hub must NOT mount on Home');
  assert.equal(main.children[0].id, 'zig-home-arcade', '#zig-home-arcade must stay #1 untouched on Home');

  // B. 3D Inspector Modal + Items screen inspector provenance (EN & AR RTL)
  const modal = document.createElement('div');
  modal.setAttribute('class', 'z3d-inspector-modal is-open');
  const card = document.createElement('div');
  card.setAttribute('class', 'z3d-inspector-card');
  const mTitle = document.createElement('h3');
  mTitle.setAttribute('class', 'z3d-inspector-title');
  mTitle.textContent = 'AK-47 Rifle';
  const mFoot = document.createElement('footer');
  mFoot.setAttribute('class', 'z3d-inspector-foot');
  card.appendChild(mTitle);
  card.appendChild(mFoot);
  modal.appendChild(card);
  document.body.appendChild(modal);

  main.setAttribute('data-zone-screen', 'items');
  const insp = document.createElement('div');
  insp.setAttribute('class', 'zone-item-inspector');
  const head = document.createElement('div');
  head.setAttribute('class', 'zone-panel-heading');
  const spName = document.createElement('span');
  spName.textContent = 'Kevlar Vest';
  const spMeta = document.createElement('span');
  spMeta.textContent = 'Armor';
  head.appendChild(spName);
  head.appendChild(spMeta);
  insp.appendChild(head);
  main.appendChild(insp);

  window.ZoneBatchLiveOps.render();
  const modalProv = card.querySelector('.zbl-modal-provenance');
  assert.ok(modalProv, '.zbl-modal-provenance must mount inside .z3d-inspector-card');
  assert.equal(modalProv.getAttribute('data-zbl-item-id'), 'ak');
  assert.ok(modalProv.innerHTML.includes(pack.itemProvenance.ak.craftTier));

  const inspProv = insp.querySelector('.zbl-inspector-provenance');
  assert.ok(inspProv, '.zbl-inspector-provenance must mount inside .zone-item-inspector');
  assert.equal(inspProv.getAttribute('data-zbl-item-id'), 'kevlar');

  // Switch to Arabic RTL and verify Arabic provenance renders
  document.documentElement.dir = 'rtl';
  document.documentElement.lang = 'ar';
  window.ZoneBatchLiveOps.render();
  assert.equal(inspProv.getAttribute('dir'), 'rtl');
  assert.ok(ARABIC_RE.test(inspProv.innerHTML), 'Items provenance must render Arabic text in RTL');

  // C. Newspaper & City Underworld Rumor Wire (all 6 districts)
  main.setAttribute('data-zone-screen', 'newspaper');
  window.ZoneBatchLiveOps.render();
  const wire = document.getElementById('zbl-rumor-wire');
  assert.ok(wire, '#zbl-rumor-wire must mount on newspaper');
  assert.equal(wire.getAttribute('dir'), 'rtl');
  assert.ok(ARABIC_RE.test(wire.innerHTML));

  window.ZoneBatchLiveOps.selectDistrict('red');
  assert.ok(wire.innerHTML.includes('data-zbl-district="red"'), 'Filtering to district red must show red district rumor');

  main.setAttribute('data-zone-screen', 'city');
  window.ZoneBatchLiveOps.render();
  assert.ok(document.getElementById('zbl-rumor-wire'), '#zbl-rumor-wire must also mount on city');

  // D. Missions Quest Hub & Flash Contracts (EN + AR, branch switching & comms cycling)
  document.documentElement.dir = 'ltr';
  document.documentElement.lang = 'en';
  main.setAttribute('data-zone-screen', 'missions');
  window.ZoneBatchLiveOps.render();
  const qhub = document.getElementById('zbl-quest-hub');
  assert.ok(qhub, '#zbl-quest-hub must mount on missions');
  assert.equal(document.getElementById('zbl-rumor-wire'), null, '#zbl-rumor-wire must unmount on missions');
  assert.ok(qhub.innerHTML.includes('Syndicate Flash Contracts'));
  const firstContract = pack.questHub.flashContracts[0];
  window.ZoneBatchLiveOps.selectBranch(firstContract.id, firstContract.branches[1].id);
  assert.ok(qhub.innerHTML.includes(firstContract.branches[1].hintEn), 'Selecting branch 2 must render branch 2 tactical hint');

  // Verify DOM memoization (re-rendering unchanged screen must NOT rewrite innerHTML / detach buttons)
  let innerHtmlWrites = 0;
  const origDesc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(qhub), 'innerHTML');
  Object.defineProperty(qhub, 'innerHTML', {
    get() { return origDesc.get.call(this); },
    set(v) { innerHtmlWrites += 1; origDesc.set.call(this, v); },
    configurable: true,
  });
  window.ZoneBatchLiveOps.render();
  window.ZoneBatchLiveOps.render();
  assert.equal(innerHtmlWrites, 0, 'Unchanged re-renders must NOT rewrite innerHTML or detach buttons');

  // Verify mobile 390px overflow-safe CSS injected
  const styleEl = document.getElementById('zbl-liveops-styles');
  assert.ok(styleEl && styleEl.textContent.includes('overflow-x:clip') && styleEl.textContent.includes('max-width:100%'));
});
