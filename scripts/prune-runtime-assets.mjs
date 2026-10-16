import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const DIST = 'dist';

function sizeOf(path) {
  if (!existsSync(path)) return 0;
  const stat = statSync(path);
  if (stat.isFile()) return stat.size;
  return readdirSync(path).reduce((sum, entry) => sum + sizeOf(join(path, entry)), 0);
}

function removeTree(path) {
  if (!existsSync(path)) return 0;
  const bytes = sizeOf(path);
  rmSync(path, { recursive: true, force: true });
  return bytes;
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

// Source/reference media stays in git but never ships in normal Web/Desktop artifacts.
// Copyright-safe release boundary: do not ship unreviewed 3D binaries,
// portrait references or the source-declared CC0 lab's unreviewed derivatives.
// Existing source and its Git history remain public and require separate legal review.
removed += removeTree(join(DIST, 'avatars', 'female'));
removed += removeTree(join(DIST, 'avatars', 'male'));
removed += removeTree(join(DIST, 'avatars', 'mira.vrm'));
removed += removeTree(join(DIST, 'avatars', 'mira.webp'));
removed += removeTree(join(DIST, 'avatars', 'splat.ply'));
removed += removeTree(join(DIST, 'avatars', 'realistic', 'vitruvian-lab'));

// Files staged for HUMAN REVIEW are not licensed for production by default.
// The build preflight independently validates all rights evidence when approved.
let releaseAvatar = '';
try {
  const manifest = JSON.parse(readFileSync(join(DIST,'avatars','realistic','manifest.json'),'utf8'));
  if(manifest.status==='approved' && /^[a-z0-9][a-z0-9_-]{1,70}\.(?:glb|vrm)$/.test(manifest.asset))
    releaseAvatar = manifest.asset;
} catch { /* retain no unreviewed binary */ }
removed += removeMatching(join(DIST, 'avatars', 'realistic'), path => {
  const file = path.split(/[\\/]/).pop();
  if (!file) return false;
  if (/\.(?:glb|vrm)$/i.test(file)) return !releaseAvatar || file!==releaseAvatar;
  if (/\.(?:glb|vrm)\.rights\.json$/i.test(file)) return !releaseAvatar || file!==releaseAvatar+'.rights.json';
  return false;
});
removed += removeTree(join(DIST, 'mira-assets', 'reference'));
removed += removeTree(join(DIST, 'looks'));
removed += removeTree(join(DIST, 'mira-assets', 'poses'));
removed += removeTree(join(DIST, 'mira-assets', 'gestures'));
removed += removeTree(join(DIST, 'mira-assets', 'ui'));
removed += removeTree(join(DIST, 'scenes', 'home.png'));
removed += removeTree(join(DIST, 'scenes', 'office.png'));

removed += removeMatching(
  join(DIST, 'mira-assets', 'scenes'),
  (path) => extname(path).toLowerCase() === '.png',
);
removed += removeMatching(
  join(DIST, 'mira-assets', 'expressions'),
  (path) => extname(path).toLowerCase() === '.png',
);

const after = sizeOf(DIST);
const mib = (bytes) => (bytes / 1024 / 1024).toFixed(2);
console.log(`Runtime asset prune: ${mib(before)} MiB -> ${mib(after)} MiB (removed ${mib(removed)} MiB)`);
