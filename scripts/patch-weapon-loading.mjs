import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Preserve the existing bundler manifest and all authored models. Like the
// established viewer patches, change the decoded template and serialize it back.
const path = fileURLToPath(new URL('../dist/weapon3d.html', import.meta.url));
const html = readFileSync(path, 'utf8');
const pattern = /(<script type="__bundler\/template">)([\s\S]*?)(<\/script>)/;
const match = html.match(pattern);
if (!match) throw new Error('Packed weapon viewer template was not found');
let template = JSON.parse(match[2]);
if (template.includes('const repeatedFailure =') && template.includes("qualityBadge.hidden = stage.dataset.zoneAssetState !== 'ready'")) {
  console.log('Weapon loading and sticky failure template already patched');
  process.exit(0);
}
function replace(before, after) {
  if (!template.includes(before)) throw new Error('Viewer patch source no longer matches: ' + before.slice(0, 100));
  template = template.replace(before, after);
}
if (!template.includes('function onItemMessage(e)')) {
replace("weapon-assets.js?v=99", "weapon-assets.js?v=102");
replace('  @media(max-width:640px){#asset-quality{bottom:64px}}', `  #asset-retry{position:absolute;inset-inline-end:12px;top:12px;z-index:2;padding:7px 12px;border:1px solid #706048;border-radius:4px;background:#28251f;color:#eee7d8;font:600 11px/1.4 system-ui,sans-serif;cursor:pointer}
  #asset-retry:focus-visible{outline:2px solid #c4a66e;outline-offset:2px}
  @media(max-width:640px){#asset-quality{bottom:64px}}`);
replace('<div id="asset-quality" hidden></div>', '<div id="asset-quality" hidden></div>\n<button id="asset-retry" type="button" hidden>Retry</button>');
replace("const qualityBadge = document.getElementById('asset-quality');", "const qualityBadge = document.getElementById('asset-quality');\nconst retryButton = document.getElementById('asset-retry');");
replace("  if (state === 'error') stage._err.textContent = arabic ? 'تعذر تحميل هذا العنصر. اختره مجدداً للمحاولة.' : 'This item could not be loaded. Select it again to retry.';", `  if (state === 'error') stage._err.textContent = arabic ? 'تعذر تحميل هذا العنصر. اضغط إعادة المحاولة.' : 'This item could not be loaded. Press Retry.';
  retryButton.hidden = state !== 'error' || !stage.dataset.zoneRequestedKey;
  retryButton.textContent = arabic ? 'إعادة المحاولة' : 'Retry';`);
replace("  if (stage._zoneDisposed) return;\n  const alias = ALIAS[key];", "  if (stage._zoneDisposed) return;\n  stage.dataset.zoneRequestedKey = String(key);\n  const alias = Object.hasOwn(ALIAS, key) ? ALIAS[key] : null;");
replace("  const id = WCAT[key] ? key : MODELS[key] ? key : (WCAT[alias] || MODELS[alias] ? alias : null);", "  const id = Object.hasOwn(WCAT, key) ? key : Object.hasOwn(MODELS, key) ? key : (alias && (Object.hasOwn(WCAT, alias) || Object.hasOwn(MODELS, alias)) ? alias : null);");
replace("      if (seq === showSeq) { current = null; itemStatus('error'); console.error('[ZONE item viewer]', error); }", `      if (seq === showSeq && !stage._zoneDisposed) {
        current = null;
        stage.dataset.zoneAssetError = JSON.stringify({ code: error.code || 'asset-load-failed', requestedKey: String(key), key: id, message: error.message });
        itemStatus('error'); console.error('[ZONE item viewer]', error);
      }`);
replace(`show(q.get('item') || 'revolver');
addEventListener('message', e => { if (e.source !== parent || e.origin !== location.origin || !e.data || typeof e.data !== 'object') return; const m = e.data;
  if (m.lang === 'ar' || m.lang === 'en') { document.documentElement.lang = m.lang; document.documentElement.dir = m.lang === 'ar' ? 'rtl' : 'ltr'; stage.setLanguage(m.lang); if(stage.dataset.zoneAssetState === 'error') itemStatus('error'); }
  if (m.bg) bg(m.bg);
  if (m.item) show(m.item); });`, `function onItemMessage(e) {
  if (e.source !== parent || e.origin !== location.origin || !e.data || typeof e.data !== 'object' || stage._zoneDisposed) return;
  const m = e.data;
  if (m.lang === 'ar' || m.lang === 'en') { document.documentElement.lang = m.lang; document.documentElement.dir = m.lang === 'ar' ? 'rtl' : 'ltr'; stage.setLanguage(m.lang); itemStatus(stage.dataset.zoneAssetState || 'idle'); }
  if (typeof m.bg === 'string' && m.bg) bg(m.bg);
  if (typeof m.item === 'string' && m.item) show(m.item);
}
addEventListener('message', onItemMessage);
retryButton.addEventListener('click', () => { if (stage.dataset.zoneRequestedKey) show(stage.dataset.zoneRequestedKey); });
// The parent passes its actual selection in the URL. An unselected embedded
// viewer waits for its own same-origin parent, without fetching an arbitrary gun.
if (q.get('item')) show(q.get('item')); else itemStatus('idle');`);
replace("  stage._zoneDisposed = true; ++showSeq; qualityObserver.disconnect();", "  stage._zoneDisposed = true; ++showSeq; removeEventListener('message', onItemMessage); qualityObserver.disconnect();");
}
replace("  if (typeof m.item === 'string' && m.item) show(m.item);", `  if (typeof m.item === 'string' && m.item) {
    // Parent rendering repeatedly sends its selection. A failed selection stays
    // failed until Retry is pressed or the parent selects a different item.
    const repeatedFailure = stage.dataset.zoneAssetState === 'error' && m.item === stage.dataset.zoneRequestedKey;
    if (!repeatedFailure) show(m.item);
  }`);
replace('  qualityBadge.hidden = !asset?.key;', "  qualityBadge.hidden = stage.dataset.zoneAssetState !== 'ready' || !asset?.key;");
replace('  stage.dataset.zoneAssetState = state;', "  stage.dataset.zoneAssetState = state;\n  qualityBadge.hidden = state !== 'ready' || !shownObject;");
const output = html.replace(pattern, (_, open, _template, close) => open + JSON.stringify(template).replaceAll('</script>', '<\\/script>') + close);
writeFileSync(path, output, 'utf8');
console.log('Patched selected weapon loading, sticky parent failures, visible retry and current-source badge; retained bundler manifest bytes');
