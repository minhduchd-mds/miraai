import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('macOS diagnostics independently show Brain provider and local SQLite state', () => {
  const settings = readFileSync('src/settings/SettingsPanel.tsx', 'utf8');
  const diagnostics = readFileSync('src/runtime/connectivity-diagnostics.ts', 'utf8');
  assert.match(settings, /checkMiraConnectivity\(\)/);
  assert.match(settings, /label="Brain model"/);
  assert.match(settings, /label="SQLite Desktop"/);
  assert.match(settings, /Chưa đọc được bộ nhớ/);
  assert.match(diagnostics, /miraApiUrl\('brain-health'\)/);
  assert.match(diagnostics, /desktop_memory_count/);
  assert.doesNotMatch(diagnostics, /desktop_memory_clear/);
});
