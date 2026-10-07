import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env,
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const node = process.execPath;
// Invoke the same build stages directly: .cmd files cannot be spawned with
// shell:false on Windows. Keep the Labs flag scoped to the desktop build.
const desktopEnv = {
  ...process.env,
  VITE_MIRA_INCLUDE_LABS: '0',
};
run(node, ['scripts/restore-photoreal-assets.mjs'], desktopEnv);
run(node, [fileURLToPath(new URL('./bin/vite.js', import.meta.resolve('vite/package.json'))), 'build'], desktopEnv);
run(node, ['scripts/prune-runtime-assets.mjs'], desktopEnv);
run(node, ['scripts/prune-desktop-assets.mjs']);
