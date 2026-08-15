import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const mustExist = [
  'src/app/AppV2.tsx',
  'src/runtime/conversation-machine.ts',
  'src/core/useMira.ts',
  'src/ui/v2.css',
];

for (const path of mustExist) {
  if (!existsSync(path)) failures.push(`missing required file: ${path}`);
}

const entry = readFileSync('src/main.tsx', 'utf8');
if (!entry.includes("./app/AppV2")) failures.push('production entry does not import AppV2');
if (!entry.includes("legacy") || !entry.includes("LegacyApp")) failures.push('legacy/labs fallback is not explicit in main.tsx');

const v2 = readFileSync('src/app/AppV2.tsx', 'utf8');
const forbiddenPrimaryImports = [
  'SplatViewer',
  'face-tracker',
  'gesture-tracker',
  'DevConsole',
];
for (const token of forbiddenPrimaryImports) {
  if (v2.includes(token)) failures.push(`AppV2 primary surface imports lab capability: ${token}`);
}

if (existsSync('src/avatar/MiraOrb.tsx')) failures.push('unused production MiraOrb.tsx should not be present');
if (existsSync('.idea/workspace.xml')) failures.push('IDE workspace state must not be committed');

const machine = readFileSync('src/runtime/conversation-machine.ts', 'utf8');
for (const state of ['idle', 'listening', 'thinking', 'speaking', 'interrupted', 'error']) {
  if (!machine.includes(`${state}:`)) failures.push(`conversation machine missing state: ${state}`);
}

if (failures.length) {
  console.error('\nMira architecture guard failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Mira architecture guard passed.');
