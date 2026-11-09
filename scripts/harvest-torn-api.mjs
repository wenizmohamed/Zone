#!/usr/bin/env node
/**
 * Torn API v2 Full-Stack Harvester & OpenAPI Schema Deconstructor for ZONE
 * Usage:
 *   1. Schema & Gap Audit (no key required, uses live openapi.json):
 *      node scripts/harvest-torn-api.mjs --schema-audit
 *   2. Full Live Torn API v2 Harvest (with 16-char Torn API key):
 *      TORN_API_KEY=YOUR_16_CHAR_KEY node scripts/harvest-torn-api.mjs
 *      or: node scripts/harvest-torn-api.mjs --key YOUR_16_CHAR_KEY
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'torn-harvest');

const args = process.argv.slice(2);
const keyIdx = args.indexOf('--key');
const API_KEY = (keyIdx !== -1 && args[keyIdx + 1]) ? args[keyIdx + 1] : (process.env.TORN_API_KEY || '');
const SCHEMA_AUDIT_ONLY = args.includes('--schema-audit') || !API_KEY;

const TORN_ENDPOINTS = [
  // Global Torn Catalog & World State
  { name: 'torn_items', path: '/v2/torn/items' },
  { name: 'torn_itemmods', path: '/v2/torn/itemmods' },
  { name: 'torn_itemammo', path: '/v2/torn/itemammo' },
  { name: 'torn_crimes', path: '/v2/torn/crimes' },
  { name: 'torn_organizedcrimes', path: '/v2/torn/organizedcrimes' },
  { name: 'torn_shoplifting', path: '/v2/torn/shoplifting' },
  { name: 'torn_searchforcash', path: '/v2/torn/searchforcash' },
  { name: 'torn_gyms', path: '/v2/torn/gyms' },
  { name: 'torn_education', path: '/v2/torn/education' },
  { name: 'torn_companies', path: '/v2/torn/companies' },
  { name: 'torn_properties', path: '/v2/torn/properties' },
  { name: 'torn_stocks', path: '/v2/torn/stocks' },
  { name: 'torn_bank', path: '/v2/torn/bank' },
  { name: 'torn_factiontree', path: '/v2/torn/factiontree' },
  { name: 'torn_cityshops', path: '/v2/torn/cityshops' },
  { name: 'torn_bounties', path: '/v2/torn/bounties' },
  { name: 'torn_merits', path: '/v2/torn/merits' },
  { name: 'torn_honors', path: '/v2/torn/honors' },
  { name: 'torn_medals', path: '/v2/torn/medals' },
  { name: 'torn_stats', path: '/v2/torn/stats' },
  // User State, Combat, Crimes 2.0, Bars, Cooldowns, Perks, Money, Travel
  { name: 'user_basic', path: '/v2/user/basic' },
  { name: 'user_profile', path: '/v2/user/profile' },
  { name: 'user_bars', path: '/v2/user/bars' },
  { name: 'user_cooldowns', path: '/v2/user/cooldowns' },
  { name: 'user_battlestats', path: '/v2/user/battlestats' },
  { name: 'user_attacks', path: '/v2/user/attacks?limit=25' },
  { name: 'user_money', path: '/v2/user/money' },
  { name: 'user_perks', path: '/v2/user/perks' },
  { name: 'user_equipment', path: '/v2/user/equipment' },
  { name: 'user_ammo', path: '/v2/user/ammo' },
  { name: 'user_gym', path: '/v2/user/gym' },
  { name: 'user_education', path: '/v2/user/education' },
  { name: 'user_jobranks', path: '/v2/user/jobranks' },
  { name: 'user_workstats', path: '/v2/user/workstats' },
  { name: 'user_travel', path: '/v2/user/travel' },
  { name: 'user_missions', path: '/v2/user/missions' },
  { name: 'user_merits', path: '/v2/user/merits' },
  { name: 'user_weaponexp', path: '/v2/user/weaponexp' },
  // Crimes 2.0 Per-Category Sub-Engines (1..12)
  { name: 'user_crime_1_searchforcash', path: '/v2/user/1/crimes' },
  { name: 'user_crime_2_bootlegging', path: '/v2/user/2/crimes' },
  { name: 'user_crime_3_graffiti', path: '/v2/user/3/crimes' },
  { name: 'user_crime_4_shoplifting', path: '/v2/user/4/crimes' },
  { name: 'user_crime_5_pickpocketing', path: '/v2/user/5/crimes' },
  { name: 'user_crime_6_cardskimming', path: '/v2/user/6/crimes' },
  { name: 'user_crime_7_burglary', path: '/v2/user/7/crimes' },
  { name: 'user_crime_8_hustling', path: '/v2/user/8/crimes' },
  { name: 'user_crime_9_disposal', path: '/v2/user/9/crimes' },
  { name: 'user_crime_10_cracking', path: '/v2/user/10/crimes' },
  { name: 'user_crime_11_forgery', path: '/v2/user/11/crimes' },
  { name: 'user_crime_12_scamming', path: '/v2/user/12/crimes' },
  // Faction & Syndicate Warfare (Public Faction #89 Natural Selection + #56798 Fody's Shack + Global Rackets)
  { name: 'faction_basic', path: '/v2/faction/89/basic' },
  { name: 'faction_chain', path: '/v2/faction/89/chain' },
  { name: 'faction_wars', path: '/v2/faction/89/wars' },
  { name: 'faction_territory', path: '/v2/faction/89/territory' },
  { name: 'faction_56798_basic', path: '/v2/faction/56798/basic' },
  { name: 'faction_56798_wars', path: '/v2/faction/56798/wars' },
  { name: 'faction_rackets', path: '/v2/faction/rackets' },
];

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'ZONE-Torn-Harvester/2.0',
      'Accept': 'application/json',
      ...headers,
    },
  });
  return res.json();
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('[ZONE Torn Harvester] Fetching Torn OpenAPI v2 specification...');
  const openApi = await fetchJson('https://www.torn.com/swagger/openapi.json');
  fs.writeFileSync(path.join(OUT_DIR, 'openapi.json'), JSON.stringify(openApi, null, 2));

  const paths = Object.keys(openApi.paths || {});
  const schemas = Object.keys(openApi.components?.schemas || {});
  console.log(`[ZONE Torn Harvester] Synced OpenAPI v${openApi.info?.version}: ${paths.length} endpoints, ${schemas.length} schemas.`);

  if (SCHEMA_AUDIT_ONLY) {
    console.log('[ZONE Torn Harvester] Schema audit complete. Pass --key <16_CHAR_TORN_KEY> or set TORN_API_KEY to harvest live account/world payloads.');
    return;
  }

  console.log(`[ZONE Torn Harvester] Harvesting ${TORN_ENDPOINTS.length} live endpoints with provided API key...`);
  const summary = {};
  const force = args.includes('--force');
  for (const ep of TORN_ENDPOINTS) {
    const outFile = path.join(OUT_DIR, `${ep.name}.json`);
    if (!force && fs.existsSync(outFile)) {
      try {
        const cached = JSON.parse(fs.readFileSync(outFile, 'utf8'));
        if (cached && !cached.error) {
          summary[ep.name] = 'OK';
          console.log(`  [CACHED OK] ${ep.path}`);
          continue;
        }
      } catch (_) {}
    }
    const sep = ep.path.includes('?') ? '&' : '?';
    const url = `https://api.torn.com${ep.path}${sep}key=${encodeURIComponent(API_KEY)}`;
    try {
      const data = await fetchJson(url, { Authorization: `ApiKey ${API_KEY}` });
      fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
      const hasErr = Boolean(data?.error);
      summary[ep.name] = hasErr ? `ERROR ${data.error.code}: ${data.error.error}` : 'OK';
      console.log(`  [${summary[ep.name]}] ${ep.path}`);
    } catch (err) {
      summary[ep.name] = `FETCH_ERR: ${err.message}`;
      console.log(`  [${summary[ep.name]}] ${ep.path}`);
    }
    // Polite 650ms spacing to stay well inside Torn's 100 req/min rate limit
    await new Promise((r) => setTimeout(r, 650));
  }
  fs.writeFileSync(path.join(OUT_DIR, 'harvest-summary.json'), JSON.stringify(summary, null, 2));
  console.log(`[ZONE Torn Harvester] Saved all harvested payloads to ${OUT_DIR}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
