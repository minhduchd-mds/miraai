import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join('public', 'mira-assets');
const MiB = 1024 * 1024;
const KiB = 1024;
const budgets = {
  total: 24 * MiB,
  scenes: 17.5 * MiB,
  expressions: 4.6 * MiB,
  maxScene: 2.1 * MiB,
  maxExpression: 450 * KiB,
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
}));
const groupBytes = (group) => records
  .filter((item) => item.rel.startsWith(group + '/'))
  .reduce((sum, item) => sum + item.bytes, 0);
const largestIn = (group) => records
  .filter((item) => item.rel.startsWith(group + '/'))
  .sort((a, b) => b.bytes - a.bytes)[0];

const total = records.reduce((sum, item) => sum + item.bytes, 0);
const sceneBytes = groupBytes('scenes');
const expressionBytes = groupBytes('expressions');
const largestScene = largestIn('scenes');
const largestExpression = largestIn('expressions');

if (total > budgets.total) failures.push(`total media ${(total / MiB).toFixed(2)} MiB > 24 MiB source budget`);
if (sceneBytes > budgets.scenes) failures.push(`scene media ${(sceneBytes / MiB).toFixed(2)} MiB > 17.5 MiB source budget`);
if (expressionBytes > budgets.expressions) failures.push(`expression media ${(expressionBytes / MiB).toFixed(2)} MiB > 4.6 MiB source budget`);
if (largestScene && largestScene.bytes > budgets.maxScene) failures.push(`scene ${largestScene.rel} ${(largestScene.bytes / MiB).toFixed(2)} MiB > 2.1 MiB/file`);
if (largestExpression && largestExpression.bytes > budgets.maxExpression) failures.push(`expression ${largestExpression.rel} ${(largestExpression.bytes / KiB).toFixed(0)} KiB > 450 KiB/file`);

console.log(`Mira media source: ${records.length} files · ${(total / MiB).toFixed(2)} MiB`);
console.log(`Scenes: ${(sceneBytes / MiB).toFixed(2)} MiB · largest=${largestScene?.rel || 'n/a'}`);
console.log(`Expressions: ${(expressionBytes / MiB).toFixed(2)} MiB · largest=${largestExpression?.rel || 'n/a'}`);
console.log('Current gate is a no-regression ceiling. Optimization target remains <10–12 MiB deployed Pages media.');

if (failures.length) {
  console.error('\nMira media budget failed:\n');
  failures.forEach((failure) => console.error('- ' + failure));
  process.exit(1);
}
console.log('Mira media budget passed.');
