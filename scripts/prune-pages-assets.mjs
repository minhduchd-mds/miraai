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
let removed = 0;

// 3D/Labs assets stay in the repository/local dev, but are not shipped by the
// lightweight GitHub Pages companion. Pages Labs falls back to 2D WebP.
removed += removeMatching(join(DIST, 'avatars'), (path) => path.endsWith('.vrm') || path.endsWith('splat.ply'));

for (const path of [
  join(DIST, 'looks'),
  join(DIST, 'scenes', 'home.png'),
  join(DIST, 'scenes', 'office.png'),
]) {
  if (!existsSync(path)) continue;
  removed += sizeOf(path);
  rmSync(path, { recursive: true, force: true });
}

const after = sizeOf(DIST);
const heavyRemain = [];
function findHeavy(root) {
  if (!existsSync(root)) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) findHeavy(path);
    else if (path.endsWith('.vrm') || path.endsWith('splat.ply')) heavyRemain.push(path);
  }
}
findHeavy(DIST);
if (heavyRemain.length) {
  console.error('Pages prune failed; heavy legacy assets remain:', heavyRemain.join(', '));
  process.exit(1);
}

const mib = (bytes) => (bytes / 1024 / 1024).toFixed(2);
console.log(`Pages artifact prune: ${mib(before)} MiB -> ${mib(after)} MiB (removed ${mib(removed)} MiB)`);
