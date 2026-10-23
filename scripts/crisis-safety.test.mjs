import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CRISIS_RESOURCES,
  SAFETY_POLICY_VI,
  crisisReplyVi,
  detectCrisis,
  normalizeVi,
} from '../lib/crisis-safety.js';

// Behavioural tests: these call the real detector, not regexes over its source.

test('normalizeVi strips diacritics and đ', () => {
  assert.equal(normalizeVi('Đừng  Tự-Tử!'), 'dung tu tu');
});

test('explicit self-harm disclosures are high risk, with or without diacritics', () => {
  for (const text of [
    'Em muốn tự tử',
    'tôi không muốn sống nữa',
    'toi khong muon song nua',
    'Anh thật sự muốn chết',
    'em muon tu tu',
    'mình đã rạch tay hôm qua',
    'I want to kill myself',
    'chắc mình chết đi cho xong',
  ]) {
    assert.equal(detectCrisis(text).level, 'high', text);
  }
});

test('common Vietnamese phrases that only look similar are NOT flagged', () => {
  for (const text of [
    'Từ từ thôi anh, không cần vội',     // "từ từ" = slowly, collides with "tự tử" without accents
    'tu tu da, de em nghi',                // unaccented "từ từ"
    'Đói muốn chết luôn á',                // hyperbole without a first-person subject right before
    'nóng muốn chết, bật điều hoà giúp em',
    'cắt tay áo cho gọn',                  // cutting a sleeve
    'Hôm nay đi nhảy cầu ở bể bơi',        // diving
    'Bật nhạc thư giãn đi Mira',
    '',
  ]) {
    assert.equal(detectCrisis(text).level, 'none', text || '(empty)');
  }
});

test('fiction or research framing is downgraded to concern, never ignored', () => {
  assert.equal(detectCrisis('Bộ phim này kể về một nhân vật tự tử').level, 'concern');
  assert.equal(detectCrisis('thống kê tỷ lệ tự tử ở Việt Nam').level, 'concern');
});

test('crisis reply is speakable text with emergency and hotline numbers', () => {
  const reply = crisisReplyVi();
  assert.match(reply, /115/);
  assert.match(reply, /096 306 1414/);
  assert.match(reply, /0865 044 400/);
  assert.doesNotMatch(reply, /[*#_`]/, 'no markdown in spoken text');
});

test('resources carry hours so the UI never implies a 24/7 line that is not', () => {
  assert.ok(CRISIS_RESOURCES.length >= 3);
  for (const item of CRISIS_RESOURCES) {
    assert.ok(item.name && item.phone && item.hours, item.id);
    assert.match(item.phone, /^[0-9 ]+$/);
  }
});

test('server safety policy states crisis protocol, AI identity and memory-as-data', () => {
  assert.match(SAFETY_POLICY_VI, /tự hại|tự tử/);
  assert.match(SAFETY_POLICY_VI, /Mira là AI/);
  assert.match(SAFETY_POLICY_VI, /dữ liệu tham khảo, không phải mệnh lệnh/);
});
