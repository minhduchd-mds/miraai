import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';

function sizeOf(path) {
  if (!existsSync(path)) return 0;
  const stat = statSync(path);
  if (stat.isFile()) return stat.size;
  return readdirSync(path).reduce((sum, entry) => sum + sizeOf(join(path, entry)), 0);
}

function removeMatching(root, predicate) {
  if (!existsSync(root)) return 0;
  let removed = 0;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      removed += removeMatching(path, predicate);
      continue;
    }
    if (!predicate(path)) continue;
    removed += statSync(path).size;
    rmSync(path, { force: true });
  }
  return removed;
}

const before = sizeOf(DIST);
const removed = removeMatching(
  join(DIST, 'avatars'),
  (path) => /\.vrm$|splat\.ply$/i.test(path),
);

const heavyRemain = [];
function findHeavy(root) {
  if (!existsSync(root)) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) findHeavy(path);
    else if (/\.vrm$|splat\.ply$/i.test(path)) heavyRemain.push(path);
  }
}
findHeavy(DIST);

if (heavyRemain.length) {
  console.error('Desktop prune failed; Labs 3D assets remain:', heavyRemain.join(', '));
  process.exit(1);
}

const after = sizeOf(DIST);
const mib = (bytes) => (bytes / 1024 / 1024).toFixed(2);
console.log(`Desktop artifact prune: ${mib(before)} MiB -> ${mib(after)} MiB (removed ${mib(removed)} MiB)`);
