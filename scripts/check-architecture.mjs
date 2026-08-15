import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const mustExist = [
  'src/app/AppV2.tsx',
  'src/conversation/Composer.tsx',
  'src/presence/PresenceStage.tsx',
  'src/settings/SettingsPanel.tsx',
  'src/runtime/conversation-machine.ts',
  'src/runtime/speech-queue.ts',
  'src/runtime/turn-manager.ts',
  'src/intelligence/skills/registry.ts',
  'src/intelligence/memory/memory-service.ts',
  'src/host/index.ts',
  'src/core/useMira.ts',
  'src/ui/v2.css',
];

for (const path of mustExist) {
  if (!existsSync(path)) failures.push(`missing required file: ${path}`);
}

const entry = readFileSync('src/main.tsx', 'utf8');
if (!entry.includes("./app/AppV2")) failures.push('production entry does not import AppV2');
if (!entry.includes('lazy(() => import(\'./App\'))') && !entry.includes('lazy(() => import("./App"))')) {
  failures.push('Legacy/Labs shell must stay lazy-loaded');
}

const v2 = readFileSync('src/app/AppV2.tsx', 'utf8');
for (const token of ['SplatViewer', 'face-tracker', 'gesture-tracker', 'DevConsole', "../ui/MiraStage"]) {
  if (v2.includes(token)) failures.push(`AppV2 primary surface imports lab/heavy capability: ${token}`);
}
for (const token of ['Composer', 'PresenceStage', 'SettingsPanel']) {
  if (!v2.includes(token)) failures.push(`AppV2 missing production surface: ${token}`);
}

const runtime = readFileSync('src/core/useMira.ts', 'utf8');
for (const token of ['TurnManager', 'SpeechQueue', 'createDefaultSkillRegistry', 'sendText']) {
  if (!runtime.includes(token)) failures.push(`useMira runtime boundary missing: ${token}`);
}

const brain = readFileSync('src/core/brain/index.ts', 'utf8');
if (brain.includes('VITE_LLM_API_KEY')) failures.push('production brain source must not read VITE_LLM_API_KEY');
const prompt = readFileSync('src/core/brain/prompt.ts', 'utf8');
if (/trợ lý[^\n]{0,80}sản phẩm\s+Soi/i.test(prompt)) failures.push('Mira core persona must not be hardcoded to Soi');

if (existsSync('src/avatar/MiraOrb.tsx')) failures.push('unused production MiraOrb.tsx should not be present');
if (existsSync('.idea/workspace.xml')) failures.push('IDE workspace state must not be committed');

const machine = readFileSync('src/runtime/conversation-machine.ts', 'utf8');
for (const state of ['idle', 'listening', 'thinking', 'speaking', 'interrupted', 'error']) {
  if (!machine.includes(`${state}:`)) failures.push(`conversation machine missing state: ${state}`);
}

if (failures.length) {
  console.error('\nMira architecture guard failed:\n');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Mira architecture guard passed.');
