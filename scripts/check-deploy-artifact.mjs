import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';

const DIST = 'dist';
const pagesMode = process.argv.includes('--pages');
const desktopMode = process.argv.includes('--desktop');
const failures = [];

function mustExist(path, label = path) {
  if (!existsSync(path)) failures.push(`missing ${label}: ${path}`);
}

function walk(root, output = []) {
  if (!existsSync(root)) return output;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) walk(path, output);
    else output.push(path);
  }
  return output;
}

function localAssetRefs(html) {
  const refs = [];
  const re = /(?:src|href)="([^"]+)"/g;
  let match;
  while ((match = re.exec(html))) {
    const value = match[1];
    if (!value || /^(https?:|data:|mailto:|tel:|#)/.test(value)) continue;
    refs.push(value);
  }
  return refs;
}

mustExist(join(DIST, 'index.html'), 'built index');
mustExist(join(DIST, '.vite', 'manifest.json'), 'Vite manifest');
mustExist(join(DIST, 'manifest.webmanifest'), 'PWA manifest');
mustExist(join(DIST, 'sw.js'), 'service worker');
mustExist(join(DIST, 'scenes', 'mira-bedroom.webp'), 'photoreal bedroom scene');
if (existsSync(join(DIST, 'scenes', 'mira-bedroom.webp'))) {
  const sceneBytes = statSync(join(DIST, 'scenes', 'mira-bedroom.webp')).size;
  if (sceneBytes < 40_000) failures.push(`photoreal bedroom scene unexpectedly small: ${sceneBytes} bytes`);
}

if (existsSync(join(DIST, 'index.html'))) {
  const html = readFileSync(join(DIST, 'index.html'), 'utf8');
  if (html.includes('/src/main.tsx')) failures.push('built index still references source entry /src/main.tsx');
  if (!/<script[^>]+type="module"[^>]+src=/.test(html)) failures.push('built index has no module entry script');
  if (!html.includes('manifest.webmanifest')) failures.push('built index lost PWA manifest link');

  for (const ref of localAssetRefs(html)) {
    const clean = ref.split(/[?#]/)[0].replace(/^\.\//, '').replace(/^\//, '');
    if (!clean) continue;
    const path = normalize(join(DIST, clean));
    if (!path.startsWith(normalize(DIST))) {
      failures.push(`asset path escapes dist: ${ref}`);
      continue;
    }
    if (!existsSync(path)) failures.push(`HTML references missing local asset: ${ref}`);
  }
}

if (existsSync(join(DIST, 'manifest.webmanifest'))) {
  try {
    const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.webmanifest'), 'utf8'));
    if (manifest.start_url !== './') failures.push(`manifest start_url must stay relative, got ${manifest.start_url}`);
    if (manifest.scope !== './') failures.push(`manifest scope must stay relative, got ${manifest.scope}`);
    if (manifest.display !== 'standalone') failures.push(`manifest display must be standalone, got ${manifest.display}`);
  } catch (error) {
    failures.push(`invalid manifest.webmanifest: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const runtimeForbidden = [
  join(DIST, 'looks'),
  join(DIST, 'mira-assets', 'poses'),
  join(DIST, 'mira-assets', 'gestures'),
  join(DIST, 'mira-assets', 'ui'),
  join(DIST, 'scenes', 'home.png'),
  join(DIST, 'scenes', 'office.png'),
];
for (const path of runtimeForbidden) {
  if (existsSync(path)) failures.push(`runtime artifact contains source/reference asset: ${path}`);
}
for (const root of [join(DIST, 'mira-assets', 'scenes'), join(DIST, 'mira-assets', 'expressions')]) {
  for (const path of walk(root)) {
    if (/\.png$/i.test(path)) failures.push(`runtime artifact contains source PNG: ${path}`);
  }
}

const files = walk(DIST);
const heavy = files.filter((path) => /\.vrm$|splat\.ply$/i.test(path));
if (pagesMode && heavy.length) failures.push(`Pages artifact contains heavy 3D assets: ${heavy.join(', ')}`);
if (desktopMode && heavy.length) failures.push(`Desktop artifact contains Labs 3D assets: ${heavy.join(', ')}`);
if (pagesMode && existsSync(join(DIST, 'looks'))) failures.push('Pages artifact must not contain dist/looks');
if (pagesMode) {
  mustExist(join(DIST, '404.html'), 'SPA fallback');
  mustExist(join(DIST, '.nojekyll'), 'GitHub Pages .nojekyll');
  if (existsSync(join(DIST, 'index.html')) && existsSync(join(DIST, '404.html'))) {
    const index = readFileSync(join(DIST, 'index.html'), 'utf8');
    const fallback = readFileSync(join(DIST, '404.html'), 'utf8');
    if (index !== fallback) failures.push('404.html must match index.html for SPA fallback');
  }
}

if (desktopMode && existsSync(join(DIST, '.vite', 'manifest.json'))) {
  try {
    const manifest = JSON.parse(readFileSync(join(DIST, '.vite', 'manifest.json'), 'utf8'));
    const keys = Object.keys(manifest);
    const forbiddenEntries = [
      'src/App.tsx',
      'src/avatar/SplatViewer.tsx',
      'src/avatar/VRMAvatar.tsx',
      'src/ui/MiraStage.tsx',
      'src/ui/DevConsole.tsx',
      'src/ui/VoiceDock.tsx',
      'src/core/avatar-config.ts',
    ];
    for (const entry of forbiddenEntries) {
      if (keys.some((key) => key === entry || key.endsWith('/' + entry))) {
        failures.push(`Desktop manifest contains Labs entry: ${entry}`);
      }
    }
  } catch (error) {
    failures.push(`invalid desktop Vite manifest: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const totalBytes = files.reduce((sum, path) => sum + statSync(path).size, 0);
console.log(`Deploy artifact smoke: ${files.length} files · ${(totalBytes / 1024 / 1024).toFixed(2)} MiB · mode=${pagesMode ? 'pages' : desktopMode ? 'desktop' : 'build'}`);

if (failures.length) {
  console.error('\nMira deploy artifact smoke failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Mira deploy artifact smoke passed.');
