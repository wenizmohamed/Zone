import { cpSync, existsSync, mkdirSync, readdirSync, realpathSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'public');
const runtimeFiles = ['index.html', 'admin.html', 'admin.css', 'admin.js', 'platform-runtime.js', 'favicon.svg', 'favicon.ico', 'support.js', 'image-slot.js'];
const runtimeDirectories = ['art', 'assets', 'dist', 'lib'];

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
  cpSync(resolve(root, directory), resolve(output, directory), { recursive: true });
}

const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const fullPath = join(directory, entry.name);
  return entry.isDirectory() ? walk(fullPath) : [fullPath];
});
const builtFiles = walk(output);
const bytes = builtFiles.reduce((total, file) => total + statSync(file).size, 0);
console.log(`Built ${output}`);
console.log(`Runtime roots: ${runtimeFiles.length + runtimeDirectories.length}; files: ${builtFiles.length}; bytes: ${bytes}`);
