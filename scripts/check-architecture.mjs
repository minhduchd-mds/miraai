import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const mustExist = [
  'src/app/AppV2.tsx',
  'src/presence/HolographicMira.tsx',
  'src/presence/MemoryConstellation.tsx',
  'src/presence/memory-constellation.ts',
  'src/presence/holographic-mira.css',
  'src/presence/holographic-mira-godmode.css',
  'src/presence/holographic-mira-life.css',
  'src/presence/holographic-mira-constellation.css',
  'public/assets/mira-holographic.webp',
  'src/core/audio-level.ts',
  'src/settings/SettingsPanel.tsx',
  'src/runtime/conversation-machine.ts',
  'src/runtime/speech-queue.ts',
  'src/runtime/turn-manager.ts',
  'src/intelligence/identity/owner-profile.ts',
  'src/intelligence/skills/registry.ts',
  'src/intelligence/memory/memory-service.ts',
  'src/host/index.ts',
  'src/core/useMira.ts',
  'src/ui/v2.css',
  'api/tts.js',
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
for (const token of ['SplatViewer', 'face-tracker', 'gesture-tracker', 'DevConsole', "../ui/MiraStage", 'PresenceStage', 'Composer', 'VoiceOrb']) {
  if (v2.includes(token)) failures.push(`AppV2 primary surface imports removed/heavy capability: ${token}`);
}
for (const token of ['HolographicMira', 'SettingsPanel', 'mira.history.slice(-6)', 'contextText={constellationContext}']) {
  if (!v2.includes(token)) failures.push(`AppV2 missing production surface: ${token}`);
}
if (v2.includes('sendText')) failures.push('voice-only production surface must not expose text composer flow');

const presence = readFileSync('src/presence/HolographicMira.tsx', 'utf8');
for (const token of [
  'audioLevel',
  'requestAnimationFrame',
  '--hm-level',
  '--hm-mouth',
  '/assets/mira-holographic.webp',
  'holographic-mira-godmode.css',
  'holographic-mira-life.css',
  'MemoryConstellation',
  'contextText',
  'hm-god-stars',
  'hm-speaking-pulse',
  'hm-activation-flash',
  'hm-voice-gravity',
  'hm-eyelid',
  'is-blinking',
  '--hm-look-x',
]) {
  if (!presence.includes(token)) failures.push(`HolographicMira missing approved visual/voice behavior: ${token}`);
}
if (presence.includes('<svg')) failures.push('production HolographicMira must use approved art, not a hand-drawn SVG face');

const godMode = readFileSync('src/presence/holographic-mira-godmode.css', 'utf8');
for (const token of ['hm-luxury-glints', 'hm-light-rays', 'hm-crown-halo', 'hm-speaking-pulse-near', 'hm-activation-flash']) {
  if (!godMode.includes(token)) failures.push(`Mira cinematic god mode missing: ${token}`);
}

const lifeMode = readFileSync('src/presence/holographic-mira-life.css', 'utf8');
for (const token of ['hm-micro-expression', 'hm-eyelid', 'hm-eye-spark', 'hm-voice-gravity', 'hm-gravity-in', 'hm-gravity-out']) {
  if (!lifeMode.includes(token)) failures.push(`Mira life layer missing: ${token}`);
}

const constellationModel = readFileSync('src/presence/memory-constellation.ts', 'utf8');
for (const token of ['CONSTELLATIONS', 'scoreConstellations', "id: 'owner'", "id: 'mira'", "id: 'soi'", "id: 'design'", "id: 'voice'", "id: 'memory'"]) {
  if (!constellationModel.includes(token)) failures.push(`Mira constellation model missing: ${token}`);
}

const constellationView = readFileSync('src/presence/MemoryConstellation.tsx', 'utf8');
for (const token of ['scoreConstellations', 'hm-memory-constellation', 'hm-memory-threads', 'hm-constellation-label', 'contextText']) {
  if (!constellationView.includes(token)) failures.push(`Mira constellation view missing: ${token}`);
}

const constellationCss = readFileSync('src/presence/holographic-mira-constellation.css', 'utf8');
for (const token of ['hm-memory-constellation', 'hm-memory-thread-flow', 'state-thinking', 'state-speaking', 'prefers-reduced-motion']) {
  if (!constellationCss.includes(token)) failures.push(`Mira constellation CSS missing: ${token}`);
}

const runtime = readFileSync('src/core/useMira.ts', 'utf8');
for (const token of ['TurnManager', 'SpeechQueue', 'createDefaultSkillRegistry']) {
  if (!runtime.includes(token)) failures.push(`useMira runtime boundary missing: ${token}`);
}

const turnManager = readFileSync('src/runtime/turn-manager.ts', 'utf8');
if (!turnManager.includes('ownerIdentityReply')) failures.push('TurnManager must preserve deterministic Mira owner identity');
const owner = readFileSync('src/intelligence/identity/owner-profile.ts', 'utf8');
if (!owner.includes('Đỗ Minh Đức')) failures.push('Mira owner identity is missing');

const tts = readFileSync('api/tts.js', 'utf8');
for (const token of ['gpt-4o-mini-tts', 'OPENAI_API_KEY', 'elevenlabs']) {
  if (!tts.includes(token)) failures.push(`neural TTS gateway missing: ${token}`);
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
