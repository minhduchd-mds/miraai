import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Private observations are supplied by the release operator, never fabricated
// by CI or committed to the repository. Do not log the secret payload.
if (!/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA || '')) throw new Error('Release commit SHA is required');
if (!process.env.DEVICE_LAB_RESULTS) throw new Error('DEVICE_LAB_RESULTS is required for release publication');
let results;
try { results = JSON.parse(process.env.DEVICE_LAB_RESULTS); }
catch { throw new Error('DEVICE_LAB_RESULTS must be valid JSON'); }
if (!Array.isArray(results) || results.length < 3 || results.length > 100) {
  throw new Error('DEVICE_LAB_RESULTS must contain 3–100 private empirical device results');
}
const root = process.env.RUNNER_TEMP || 'work';
mkdirSync(root, { recursive: true });
const dir = mkdtempSync(join(root, 'mira-device-release-'));
try {
  results.forEach((result, index) => writeFileSync(join(dir, `${index}.json`), JSON.stringify(result)));
  const env = { ...process.env };
  delete env.DEVICE_LAB_RESULTS;
  const run = spawnSync(process.execPath, [
    'scripts/device-lab-matrix.mjs', '--require=3', '--no-write',
    `--dir=${dir}`, `--release-sha=${process.env.GITHUB_SHA}`,
  ], { stdio: 'inherit', env });
  if (run.error) throw run.error;
  process.exitCode = run.status ?? 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}
