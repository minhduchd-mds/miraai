import { spawnSync } from 'node:child_process';

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env,
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const node = process.execPath;

run(npm, ['run', 'build'], {
  ...process.env,
  VITE_MIRA_INCLUDE_LABS: '0',
});
run(node, ['scripts/prune-desktop-assets.mjs']);
