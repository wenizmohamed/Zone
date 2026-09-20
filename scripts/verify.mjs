import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2] ? resolve(repoRoot, process.argv[2]) : repoRoot;
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

if (target !== repoRoot && relative(repoRoot, target) !== 'public') {
  console.error(`Unsupported verification target: ${target}`);
  process.exit(1);
}

const requiredRoots = ['index.html', 'admin.html', 'admin.css', 'admin.js', 'platform-runtime.js', 'favicon.svg', 'favicon.ico', 'support.js', 'image-slot.js', 'art', 'assets', 'dist', 'lib'];
for (const entry of requiredRoots) check(existsSync(join(target, entry)), `Missing runtime entry: ${entry}`);

const indexPath = join(target, 'index.html');
if (!existsSync(indexPath)) {
  console.error('Verification failed: index.html is missing.');
  process.exit(1);
}
const html = readFileSync(indexPath, 'utf8');

const screens = ['home', 'items', 'city', 'jobs', 'gym', 'properties', 'education', 'crimes', 'missions', 'newspaper', 'jail', 'hospital', 'casino', 'hof', 'faction', 'elimination', 'attack', 'market'];
for (const screen of screens) {
  check(new RegExp(`['\"]${screen}['\"]`).test(html), `Screen is missing from source registry: ${screen}`);
  check(html.includes(`is.${screen}`), `Screen template is missing: ${screen}`);
}
check(html.includes('data-zheaderbar'), 'Responsive header hook is missing.');
check(html.includes('data-zshell'), 'Responsive shell hook is missing.');
check(html.includes('data-znav'), 'Responsive navigation hook is missing.');
check((html.match(/@media\s*\(/g) || []).length >= 2, 'Mobile breakpoints are missing.');
check(html.includes('html[dir="rtl"]'), 'RTL stylesheet support is missing.');
check(html.includes("const LS = 'zone.v2.save'"), 'ZONE persistence key is missing.');
check(html.includes('platform-runtime.js'), 'Player release runtime is missing.');
check(html.includes('data-zone-custom-page'), 'Release-driven custom page surface is missing.');
check(html.includes('data-zone-screen'), 'Stable release navigation identifiers are missing.');
check(!/\sd=["']\{\{/.test(html), 'Dynamic SVG paths must use data-zone-path to avoid parse-time console errors.');
check(html.includes("attributeFilter: ['data-zone-path']"), 'Dynamic SVG path synchronizer is missing.');
for (const documentName of ['character3d.html', 'city-map.html', 'weapon3d.html', 'zone-maps-live.html']) {
  const documentPath = join(target, 'dist', documentName);
  if (!existsSync(documentPath)) continue;
  check(readFileSync(documentPath, 'utf8').includes('rel="icon"'), `Embedded document favicon is missing: dist/${documentName}`);
}
const renderedButtons = html.slice(0, html.indexOf('<script type="text/x-dc"')).match(/<button\b[^>]*>/g) || [];
for (const button of renderedButtons) check(button.includes('onClick='), `Button is missing an action binding: ${button.slice(0, 100)}`);

const templateEnd = html.indexOf('</x-dc>');
check(templateEnd >= 0, 'Closing x-dc template tag is missing.');
if (templateEnd >= 0) {
  const template = html.slice(0, templateEnd + 7);
  const stack = [];
  const tags = /<(\/?)(div|sc-if|sc-for|main|aside)(?:\s[^>]*)?>/gis;
  for (const match of template.matchAll(tags)) {
    const closing = match[1] === '/';
    const tag = match[2].toLowerCase();
    if (!closing) {
      stack.push(tag);
    } else if (stack.at(-1) !== tag) {
      const line = template.slice(0, match.index).split('\n').length;
      failures.push(`Template nesting mismatch at line ${line}: expected </${stack.at(-1) || 'none'}>, found </${tag}>.`);
      break;
    } else {
      stack.pop();
    }
  }
  check(stack.length === 0, `Unclosed template tags: ${stack.join(', ')}`);
}

const expectedArt = [
  'locked', 'search', 'graf', 'shop', 'pick', 'boot', 'skim', 'hustle', 'disp', 'crack', 'forge', 'scam', 'counter', 'burg', 'arson',
  'g_str', 'g_def', 'g_spd', 'g_dex',
  'j_grocer', 'j_casino', 'j_clinic', 'j_army', 'j_edu', 'j_firm',
  'bio', 'fit', 'law', 'biz', 'comb',
  'p_shack', 'p_trailer', 'p_apt', 'p_semi', 'p_house', 'p_villa', 'p_island',
  'c_slots', 'c_roulette', 'c_blackjack', 'c_poker', 'c_lottery', 'c_russian'
];
for (const name of expectedArt) check(existsSync(join(target, 'art', `${name}.jpg`)), `Missing generated art target: art/${name}.jpg`);

const adminPath = join(target, 'admin.html');
const adminJsPath = join(target, 'admin.js');
if (existsSync(adminPath) && existsSync(adminJsPath)) {
  const adminHtml = readFileSync(adminPath, 'utf8');
  const adminJs = readFileSync(adminJsPath, 'utf8');
  for (const view of ['overview', 'builder', 'modules', 'content', 'themes', 'assets', 'economy', 'events', 'releases']) {
    check(adminHtml.includes(`data-view="${view}"`), `Admin view is missing: ${view}`);
  }
  for (const endpoint of ['/api/v1/admin/draft', '/api/v1/admin/releases/publish', '/api/v1/admin/releases']) {
    check(adminJs.includes(endpoint), `Admin publishing endpoint is missing: ${endpoint}`);
  }
  check(adminJs.includes('zone.platform.previewRelease'), 'Admin draft preview cache is missing.');
  check(adminJs.includes('zone.platform.activeRelease'), 'Admin active release cache is missing.');
}

const literalResources = new Set();
for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) literalResources.add(match[1]);
for (const match of html.matchAll(/url\(["']?([^"')]+)["']?\)/g)) literalResources.add(match[1]);
for (const resource of literalResources) {
  if (/^(?:https?:|data:|blob:|#|\{\{)/.test(resource) || resource.includes('{{')) continue;
  const clean = resource.replace(/^\.\//, '').split(/[?#]/)[0];
  if (['/admin', '/engine', '/engine/theme.css'].includes(clean)) continue;
  check(existsSync(join(target, clean)), `Missing literal resource: ${clean}`);
}

const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const fullPath = join(directory, entry.name);
  return entry.isDirectory() ? walk(fullPath) : [fullPath];
});
const files = walk(target).filter((file) => !relative(target, file).startsWith('.git'));
const ignoredRuntimeRoots = new Set(['.git', '.tools', '.vercel', 'node_modules']);
const runtimeFiles = files.filter((file) => {
  const pathFromTarget = relative(target, file);
  const root = pathFromTarget.split(/[\\/]/)[0];
  if (ignoredRuntimeRoots.has(root)) return false;
  return !['.md', '.json'].includes(extname(file).toLowerCase()) || ['package.json', 'vercel.json'].includes(pathFromTarget);
});
check(runtimeFiles.every((file) => statSync(file).size > 0), 'One or more runtime files are empty.');

if (failures.length) {
  console.error(`ZONE verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`ZONE verification passed: ${screens.length} screens, ${expectedArt.length} generated art targets, ${literalResources.size} literal resources.`);
console.log(`Template structure balanced. Runtime files checked: ${runtimeFiles.length}. Target: ${target}`);
