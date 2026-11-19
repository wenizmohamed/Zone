import { cpSync, existsSync, mkdirSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'public');
const runtimeFiles = ['index.html', 'admin.html', 'admin.css', 'admin.js', 'admin-studio.js', 'admin-assets.js', 'account.html', 'account.js', 'platform-runtime.js', 'owner-playtest.js', 'player-session.js', 'favicon.svg', 'favicon.ico', 'support.js', 'image-slot.js', 'manifest.webmanifest', 'sw.js', 'offline.html'];
const runtimeDirectories = ['art', 'assets', 'dist', 'lib'];
// Conversion tools remain in the full owner source checkout and cloud build,
// but are not browser assets. Raw acquisition archives are private research.
const privateAssetRoots = ['assets/weapons/source-tools', 'assets/weapons/sources/v99', 'art/source/launch105-environments', 'art/source/launch106-crimes'];
const publicAsset = (source) => {
  const path = relative(root, source).replaceAll('\\', '/');
  return !privateAssetRoots.some(privateRoot => path === privateRoot || path.startsWith(privateRoot + '/'));
};

if (output !== join(root, 'public') || relative(root, output) !== 'public') {
  throw new Error(`Refusing unsafe output path: ${output}`);
}

for (const entry of [...runtimeFiles, ...runtimeDirectories]) {
  const source = resolve(root, entry);
  if (!existsSync(source)) throw new Error(`Required runtime entry is missing: ${entry}`);
  if (relative(root, source).startsWith('..')) throw new Error(`Runtime entry escapes repository: ${entry}`);
}

if (existsSync(output)) {
  const resolvedOutput = realpathSync(output);
  if (resolvedOutput !== output || resolvedOutput === root) {
    throw new Error(`Refusing to clear unexpected output path: ${resolvedOutput}`);
  }
  for (const entry of readdirSync(output)) {
    const generatedPath = resolve(output, entry);
    if (dirname(generatedPath) !== output) throw new Error(`Refusing unsafe generated path: ${generatedPath}`);
    rmSync(generatedPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}
mkdirSync(output, { recursive: true });

for (const file of runtimeFiles) {
  cpSync(resolve(root, file), resolve(output, file));
}
for (const directory of runtimeDirectories) {
  cpSync(resolve(root, directory), resolve(output, directory), { recursive: true, filter: publicAsset });
}

const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const fullPath = join(directory, entry.name);
  return entry.isDirectory() ? walk(fullPath) : [fullPath];
});
const builtFiles = walk(output);
// The PHP function deliberately excludes artwork. Its private inventory is
// generated from the exact static build, so Admin can still validate images.
const imageAssets = Object.fromEntries(builtFiles
  .map(file => [relative(output, file).replaceAll('\\', '/'), statSync(file).size])
  .filter(([path, size]) => /^(?:art|assets)\/[A-Za-z0-9_/-]+\.(?:png|jpg|jpeg|webp)$/.test(path) && size > 0));
const inventoryPath = resolve(root, 'engine/config/image-assets.json');
mkdirSync(dirname(inventoryPath), { recursive: true });
writeFileSync(inventoryPath, JSON.stringify({ schemaVersion: 1, images: imageAssets }, null, 2) + '\n', 'utf8');
console.log(`Private PHP image inventory: ${Object.keys(imageAssets).length} shipped assets`);
const bytes = builtFiles.reduce((total, file) => total + statSync(file).size, 0);
console.log(`Built ${output}`);
console.log(`Runtime roots: ${runtimeFiles.length + runtimeDirectories.length}; files: ${builtFiles.length}; bytes: ${bytes}`);
