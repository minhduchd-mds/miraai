import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

const manifestPath = 'dist/.vite/manifest.json';
if (!existsSync(manifestPath)) {
  console.error('Bundle budget: missing Vite manifest. Run npm run build first.');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const entries = Object.entries(manifest);
const entryPair = entries.find(([key, value]) => value?.isEntry && (key === 'src/main.tsx' || key.endsWith('/main.tsx')))
  || entries.find(([, value]) => value?.isEntry);
if (!entryPair) {
  console.error('Bundle budget: cannot find entry chunk.');
  process.exit(1);
}

const visited = new Set();
const initialFiles = new Set();
const initialCss = new Set();

function visit(key) {
  if (!key || visited.has(key)) return;
  visited.add(key);
  const chunk = manifest[key];
  if (!chunk) return;
  if (chunk.file) initialFiles.add(chunk.file);
  for (const css of chunk.css || []) initialCss.add(css);
  for (const imported of chunk.imports || []) visit(imported);
  // Deliberately do not visit dynamicImports: Presence/Labs/VAD are allowed to be heavy on demand.
}

visit(entryPair[0]);

const sizeOf = (file) => statSync(join('dist', file)).size;
const jsBytes = [...initialFiles].filter((file) => file.endsWith('.js')).reduce((sum, file) => sum + sizeOf(file), 0);
const cssBytes = [...initialCss].reduce((sum, file) => sum + sizeOf(file), 0);
const forbidden = [...initialFiles].filter((file) => /MiraStage|gaussian-splats|vision_bundle|(^|\/)App-/i.test(basename(file)));
const JS_BUDGET = 420 * 1024;
const CSS_BUDGET = 120 * 1024;
const failures = [];

if (jsBytes > JS_BUDGET) failures.push(`initial JS ${(jsBytes / 1024).toFixed(1)} KiB > ${JS_BUDGET / 1024} KiB budget`);
if (cssBytes > CSS_BUDGET) failures.push(`initial CSS ${(cssBytes / 1024).toFixed(1)} KiB > ${CSS_BUDGET / 1024} KiB budget`);
if (forbidden.length) failures.push(`heavy Labs/3D chunk leaked into initial graph: ${forbidden.join(', ')}`);

console.log(`Initial bundle: ${(jsBytes / 1024).toFixed(1)} KiB JS · ${(cssBytes / 1024).toFixed(1)} KiB CSS`);
console.log(`Initial files: ${[...initialFiles, ...initialCss].join(', ')}`);

if (failures.length) {
  console.error('\nMira bundle budget failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Mira initial bundle budget passed.');
