import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
async function tick() { await new Promise((resolve) => setTimeout(resolve, 0)); }

test('cancelled speech never plays a stale HTTP audio result after a newer utterance', async () => {
  const oldFetch = globalThis.fetch;
  const oldAudio = globalThis.Audio;
  const oldWindow = globalThis.window;
  const oldCreateObjectURL = URL.createObjectURL;
  const oldRevokeObjectURL = URL.revokeObjectURL;
  const calls = [];
  const played = [];
  try {
    const first = deferred();
    const second = deferred();
    let count = 0;
    globalThis.window = { setTimeout, clearTimeout };
    globalThis.fetch = async (url) => {
      if (url.endsWith('/health')) return { ok: true, json: async () => ({ ok: true, configured: true }) };
      if (url.endsWith('/voices')) return { ok: true, json: async () => ({ voices: [] }) };
      count += 1;
      return count === 1 ? first.promise : second.promise;
    };
    URL.createObjectURL = (blob) => 'blob:' + blob.label;
    URL.revokeObjectURL = () => {};
    globalThis.Audio = class {
      constructor(url) { this.url = url; this.paused = false; }
      play() { played.push(this.url); this.onplaying?.(); return Promise.resolve(); }
      pause() { this.paused = true; }
    };
    const source = readFileSync('src/core/tts/server-tts.ts', 'utf8')
      .replace("import { attachAnalyser } from '../audio-level';", 'const attachAnalyser = () => () => {};');
    const transpiled = ts.transpileModule(source, { compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    } }).outputText;
    const { ServerTTS } = await import('data:text/javascript;base64,' + Buffer.from(transpiled).toString('base64'));
    const speak = new ServerTTS({ serverUrl: 'https://voice.example', label: 'test', fallbackVoice: { name: 'v', voiceURI: 'v', lang: 'vi-VN' } });
    await tick();
    speak.speak({ text: 'old', lang: 'vi-VN', onStart: () => calls.push('old') });
    speak.speak({ text: 'new', lang: 'vi-VN', onStart: () => calls.push('new') });
    second.resolve({ ok: true, blob: async () => ({ size: 3, label: 'new' }) });
    await tick();
    first.resolve({ ok: true, blob: async () => ({ size: 3, label: 'old' }) });
    await tick();
    assert.deepEqual(played, ['blob:new']);
    assert.deepEqual(calls, ['new']);
    speak.cancel();
  } finally {
    globalThis.fetch = oldFetch;
    if (oldAudio === undefined) delete globalThis.Audio;
    else globalThis.Audio = oldAudio;
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
    URL.createObjectURL = oldCreateObjectURL;
    URL.revokeObjectURL = oldRevokeObjectURL;
  }
});
