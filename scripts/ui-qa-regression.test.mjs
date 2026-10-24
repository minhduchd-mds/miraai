import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Guards for the defects found by the real-Chromium UI QA pass on 24/10/2026.
const read = (p) => readFileSync(p, 'utf8');
const dock = read('src/app/VoiceDock.tsx');
const mira = read('src/core/useMira.ts');
const app = read('src/app/AppV2.tsx');
const avatar = read('src/presence/live-avatar/LiveAvatarPresence.tsx');
const css = read('src/ui/v2.css');

test('P0: answers stay on screen in a session transcript (role=log on a wrapper, list inside)', () => {
  assert.match(mira, /const \[transcript, setTranscript\] = useState<TranscriptTurn\[\]>/);
  assert.match(dock, /className="voice-transcript-log" role="log"/);
  assert.match(dock, /<ol className="voice-transcript-list">/);
  assert.doesNotMatch(dock, /<ol[^>]*role="log"/, 'role=log on <ol> orphans the <li> items (axe listitem)');
});

test('P1: the avatar stage is not a button and never starts the mic', () => {
  assert.doesNotMatch(avatar, /<button|onClick|onActivate/);
  assert.doesNotMatch(app, /<LiveAvatarPresence[^>]*onActivate/);
});

test('P1: failed turns offer retry and the toast can be dismissed; header reflects the error', () => {
  assert.match(mira, /const retryLast = useCallback/);
  assert.match(mira, /setRetryText\(text\)/);
  assert.match(dock, /voice-turn-retry/);
  assert.match(app, /aria-label="Đóng thông báo"/);
  assert.match(app, /statusError \? 'Có lỗi'/);
});

test('P2: raw runtime errors and infra names never reach the UI', () => {
  assert.doesNotMatch(mira, /Bộ não lỗi: \$\{/);
  assert.doesNotMatch(read('src/settings/SettingsPanel.tsx'), /Kiểm tra cấu hình DATABASE_URL/);
});

test('P2: mobile status pill rule out-ranks .v2-session-details { position: relative }', () => {
  const fix = css.lastIndexOf('.v2-status.v2-session-details { position: absolute; }');
  const base = css.indexOf('.v2-session-details { position: relative');
  assert.ok(fix > base && base > 0);
});

test('P3: the end-call control only renders during a session', () => {
  assert.match(dock, /\{inSession && <button\s+type="button"\s+className="voice-end"/);
});
