import { existsSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const ROOT = join('public', 'mira-assets');
const MiB = 1024 * 1024;
const KiB = 1024;

const budgets = {
  sourcePngTotal: 24 * MiB,
  runtimeWebpTotal: 1.6 * MiB,
  runtimeSceneTotal: 1.35 * MiB,
  runtimeExpressionTotal: 300 * KiB,
  maxRuntimeScene: 180 * KiB,
  maxRuntimeExpression: 32 * KiB,
};

const failures = [];
if (!existsSync(ROOT)) {
  console.error('Media budget: missing public/mira-assets');
  process.exit(1);
}

function walk(root, output = []) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) walk(path, output);
    else output.push(path);
  }
  return output;
}

const records = walk(ROOT).map((path) => ({
  path,
  rel: relative(ROOT, path).replaceAll('\\', '/'),
  bytes: statSync(path).size,
  ext: extname(path).toLowerCase(),
}));
const sum = (items) => items.reduce((total, item) => total + item.bytes, 0);
const largest = (items) => [...items].sort((a, b) => b.bytes - a.bytes)[0];

const sourcePng = records.filter((item) => item.ext === '.png');
const runtimeWebp = records.filter((item) => item.ext === '.webp' && (
  item.rel.startsWith('scenes/') || item.rel.startsWith('expressions/')
));
const runtimeScenes = runtimeWebp.filter((item) => item.rel.startsWith('scenes/'));
const runtimeExpressions = runtimeWebp.filter((item) => item.rel.startsWith('expressions/'));

const sourcePngBytes = sum(sourcePng);
const runtimeWebpBytes = sum(runtimeWebp);
const runtimeSceneBytes = sum(runtimeScenes);
const runtimeExpressionBytes = sum(runtimeExpressions);
const largestScene = largest(runtimeScenes);
const largestExpression = largest(runtimeExpressions);

if (runtimeScenes.length !== 9) failures.push(`expected 9 WebP scenes, found ${runtimeScenes.length}`);
if (runtimeExpressions.length !== 12) failures.push(`expected 12 WebP expressions, found ${runtimeExpressions.length}`);
if (sourcePngBytes > budgets.sourcePngTotal) failures.push(`PNG source ${(sourcePngBytes / MiB).toFixed(2)} MiB > 24 MiB`);
if (runtimeWebpBytes > budgets.runtimeWebpTotal) failures.push(`runtime WebP ${(runtimeWebpBytes / MiB).toFixed(2)} MiB > 1.6 MiB`);
if (runtimeSceneBytes > budgets.runtimeSceneTotal) failures.push(`runtime scenes ${(runtimeSceneBytes / MiB).toFixed(2)} MiB > 1.35 MiB`);
if (runtimeExpressionBytes > budgets.runtimeExpressionTotal) failures.push(`runtime expressions ${(runtimeExpressionBytes / KiB).toFixed(0)} KiB > 300 KiB`);
if (largestScene && largestScene.bytes > budgets.maxRuntimeScene) failures.push(`scene ${largestScene.rel} ${(largestScene.bytes / KiB).toFixed(1)} KiB > 180 KiB/file`);
if (largestExpression && largestExpression.bytes > budgets.maxRuntimeExpression) failures.push(`expression ${largestExpression.rel} ${(largestExpression.bytes / KiB).toFixed(1)} KiB > 32 KiB/file`);

console.log(`Mira PNG source retained: ${sourcePng.length} files · ${(sourcePngBytes / MiB).toFixed(2)} MiB`);
console.log(`Runtime WebP: ${runtimeWebp.length} files · ${(runtimeWebpBytes / MiB).toFixed(2)} MiB`);
console.log(`Runtime scenes: ${(runtimeSceneBytes / MiB).toFixed(2)} MiB · largest=${largestScene?.rel || 'n/a'}`);
console.log(`Runtime expressions: ${(runtimeExpressionBytes / KiB).toFixed(0)} KiB · largest=${largestExpression?.rel || 'n/a'}`);

if (failures.length) {
  console.error('\nMira media budget failed:\n');
  failures.forEach((failure) => console.error('- ' + failure));
  process.exit(1);
}
console.log('Mira media budget passed.');
