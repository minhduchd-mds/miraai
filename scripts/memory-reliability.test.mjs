import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const browser = readFileSync('src/intelligence/memory/local-memory-store.ts', 'utf8');
const desktop = readFileSync('src/intelligence/memory/desktop-memory-store.ts', 'utf8');

test('browser memory reports failed count, backup, imports and destructive wipes', () => {
  const count = browser.slice(browser.indexOf('async countTurns()'), browser.indexOf('async exportSnapshot()'));
  const backup = browser.slice(browser.indexOf('async exportSnapshot()'), browser.indexOf('async importStructuredMemoryGraph('));
  const restore = browser.slice(browser.indexOf('async importTurns('), browser.indexOf('async loadRecent('));
  assert.match(count, /objectStore\('turns'\)\.count\(\)/);
  assert.doesNotMatch(count, /catch\s*\{/);
  assert.doesNotMatch(backup, /\.catch\(\(\) => \[\]\)/);
  assert.doesNotMatch(restore, /import is best-effort|catch\s*\{\s*\/\* noop/);
});

test('ordinary recall is bounded by index cursors, export still reads whole archive', () => {
  assert.match(browser, /index\('ts'\)\.openCursor\(null, 'prev'\)/);
  assert.match(browser, /readRecent<TurnRow>\('turns', 260\)/);
  assert.match(browser, /readRecent<EpisodeRow>\('episodes', 120\)/);
  assert.match(browser, /readRecent<AffectRow>\('affect', 1\)/);
  assert.match(browser, /readAll<TurnRow>\('turns'\)/);
  assert.match(browser, /db\.onversionchange =/);
});

test('Desktop capsule import retains the original UTC timestamps', () => {
  assert.match(desktop, /Date\.parse\(item\.createdAt\)/);
  assert.match(desktop, /await desktopInvoke\('desktop_memory_import_turns', \{ items: prepared \}\)/);
});
