import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

async function importTypeScript(path) {
  const source = readFileSync(path, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
    fileName: path,
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

const machine = await importTypeScript('src/runtime/conversation-machine.ts');
const speech = await importTypeScript('src/runtime/speech-utils.ts');

test('voice lifecycle follows the expected state path', () => {
  let state = 'idle';
  state = machine.transition(state, 'MIC_START');
  assert.equal(state, 'listening');
  state = machine.transition(state, 'STT_FINAL');
  assert.equal(state, 'thinking');
  state = machine.transition(state, 'SPEAK');
  assert.equal(state, 'speaking');
  state = machine.transition(state, 'TTS_DONE');
  assert.equal(state, 'idle');
});

test('text input enters the same thinking/speaking pipeline', () => {
  assert.equal(machine.transition('idle', 'TEXT_SUBMIT'), 'thinking');
  assert.equal(machine.transition('thinking', 'SPEAK'), 'speaking');
});

test('barge-in is deterministic from listening/thinking/speaking and resumes listening', () => {
  for (const state of ['listening', 'thinking', 'speaking']) {
    assert.equal(machine.transition(state, 'INTERRUPT'), 'interrupted');
  }
  assert.equal(machine.transition('interrupted', 'MIC_START'), 'listening');
});

test('unsupported events do not cause surprise transitions', () => {
  assert.equal(machine.transition('idle', 'TTS_DONE'), 'idle');
  assert.equal(machine.transition('error', 'TTS_DONE'), 'error');
});

test('canTransition reflects the declared state graph', () => {
  assert.equal(machine.canTransition('idle', 'listening'), true);
  assert.equal(machine.canTransition('idle', 'speaking'), true);
  assert.equal(machine.canTransition('idle', 'interrupted'), false);
  assert.equal(machine.canTransition('thinking', 'interrupted'), true);
});

test('speech cleanup removes markdown links, formatting and emoji', () => {
  assert.equal(
    speech.cleanForSpeech('**Mira** xem [báo cáo](https://example.com) nhé 😊'),
    'Mira xem báo cáo nhé',
  );
});

test('speech chunking emits the first sentence early and preserves content', () => {
  const input = 'Câu đầu tiên để nói sớm. Câu thứ hai dài hơn một chút để kiểm tra hàng đợi. Câu cuối.';
  const chunks = speech.chunkSpeech(input);
  assert.ok(chunks.length >= 2);
  assert.match(chunks[0], /^Câu đầu tiên/);
  assert.equal(chunks.join(' ').replace(/\s+/g, ' ').trim(), input);
});
