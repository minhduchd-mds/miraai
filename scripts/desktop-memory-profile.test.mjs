import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

test('local Desktop profile shows saved facts and preferences, not camera emotion guesses', async () => {
  const js = ts.transpileModule(readFileSync('src/intelligence/memory/desktop-profile.ts','utf8'),
    { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const { desktopProfileFacts } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
  const facts = desktopProfileFacts([
    { id: 9, kind: 'fact', text: 'Nói tiếng Việt', lastSeenTs: 1000 },
    { id: 10, kind: 'preference', text: 'Giọng dịu dàng', lastSeenTs: 2000 },
    { id: 11, kind: 'emotional_episode', text: 'Camera đoán buồn', lastSeenTs: 3000 },
    { id: 12, kind: 'active_thread', text: 'Đang phát triển Mira', lastSeenTs: 4000 },
    { id: -1, kind: 'fact', text: 'Invalid', lastSeenTs: 1 },
  ]);
  assert.deepEqual(facts.map(x => x.id), [9,10,12]);
  assert.equal(facts[0].updatedAt, new Date(1000).toISOString());
});

test('Desktop profile reads graph and supports native update/delete without cloud DB', () => {
  const s=readFileSync('src/intelligence/memory/profile-client.ts','utf8');
  assert.match(s,/desktopProfileFacts\(graph.nodes\)/);
  assert.match(s,/await updateDesktopStructuredMemory\(\{ id, text: fact \}\)/);
  assert.match(s,/await deleteDesktopStructuredMemory\(id\)/);
});

test('Desktop capsule importer surfaces native restore failures rather than lying about success', () => {
  const s=readFileSync('src/intelligence/memory/desktop-memory-store.ts','utf8');
  assert.match(s,/await desktopInvoke\('desktop_memory_import_turns'/);
  assert.match(s,/await desktopInvoke\('desktop_memory_import_structured'/);
  assert.doesNotMatch(s,/best effort merge-only import/);
});

test('Memory wipe failures have an explicit user-visible error', () => {
  const s=readFileSync('src/settings/SettingsPanel.tsx','utf8');
  assert.match(s,/Không xóa được ký ức/);
});
