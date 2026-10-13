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


test('look-ahead reuses exact next ElevenLabs audio, preserving voice/direction and cancellation',async()=>{
  const oldFetch=globalThis.fetch,oldAudio=globalThis.Audio,oldWindow=globalThis.window;
  const oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL;
  const requests=[],played=[],abortSignals=[];
  try{
    globalThis.window={setTimeout,clearTimeout};
    globalThis.fetch=async(url,options={})=>{
      if(url.endsWith('/health'))return {ok:true,json:async()=>({ok:true,configured:true})};
      if(url.endsWith('/voices'))return {ok:true,json:async()=>({voices:[]})};
      const data=JSON.parse(options.body);
      requests.push(data);abortSignals.push(options.signal);
      return {ok:true,blob:async()=>({size:4,label:data.text})};
    };
    URL.createObjectURL=blob=>'blob:'+blob.label;
    URL.revokeObjectURL=()=>{};
    globalThis.Audio=class{
      constructor(url){this.url=url;this.paused=false;globalThis.__miraTestAudio=this;}
      play(){played.push(this.url);this.onplaying?.();return Promise.resolve();}
      pause(){this.paused=true;}
    };
    const source=readFileSync('src/core/tts/server-tts.ts','utf8')
      .replace("import { attachAnalyser } from '../audio-level';",'const attachAnalyser=()=>()=>{};');
    const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
    const {ServerTTS}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
    const tts=new ServerTTS({serverUrl:'https://voice.example',label:'test',fallbackVoice:{name:'v',voiceURI:'v',lang:'vi-VN'}});
    await tick();
    tts.speak({text:'Một',lang:'vi-VN'});
    await tick();
    assert.deepEqual(played,['blob:Một']);
    const next={text:'Hai',voiceURI:'sarah',instructions:'gentle'};
    tts.prefetch(next);
    await tick();
    assert.equal(requests.length,2);
    assert.deepEqual(requests[1],{text:'Hai',voice:'sarah',instructions:'gentle'});
    tts.speak({...next,lang:'vi-VN'});
    await tick();
    assert.deepEqual(played,['blob:Một','blob:Hai']);
    assert.equal(requests.length,2,'prefetched result must avoid duplicate API requests');
    tts.prefetch({text:'Ba',voiceURI:'sarah',instructions:'gentle'});
    await tick();
    assert.equal(requests.length,3);
    tts.cancel();
    assert.equal(abortSignals[2].aborted,true,'interruption must abort speculative audio');
    assert.equal(tts.diagnostics().speaking,false);
  }finally{
    delete globalThis.__miraTestAudio;
    globalThis.fetch=oldFetch;
    if(oldAudio===undefined)delete globalThis.Audio;else globalThis.Audio=oldAudio;
    if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;
    URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;
  }
});

test('prefetch never starts before first sound, and never plays mismatched audio',async()=>{
  const code=readFileSync('src/core/tts/server-tts.ts','utf8');
  const queue=readFileSync('src/runtime/speech-queue.ts','utf8');
  assert.match(code,/if \(!this.audio \|\| this.audio.paused \|\| this.cancelled/);
  assert.match(code,/const ready = this.prefetched\?\.key === this.speechKey\(opts\)/);
  assert.match(code,/this.prefetched\?\.controller.abort\(\)/);
  assert.match(queue,/onStart: \(\) => \{/);
  assert.match(queue,/const next = plannedChunks\[index \+ 1\]/);
  assert.match(queue,/tts.prefetch\?\.\(\{/);
});


test('voice response timing counts only first actually playing answer chunk, never thinking cues',()=>{
 const queue=readFileSync('src/runtime/speech-queue.ts','utf8');
 const hook=readFileSync('src/core/useMira.ts','utf8');
 assert.match(queue,/if \(index === 0\) options\.onFirstAudio\?\.\(\)/);
 assert.match(queue,/if \(token !== this\.sequence \|\| !options\.isActive\(\)\) return/);
 assert.match(hook,/const turnStartedAt = performance\.now\(\)/);
 assert.match(hook,/setFirstAudioLatencyMs\(Math\.max\(0, Math\.round\(performance\.now\(\) - turnStartedAt\)\)\)/);
 assert.match(hook,/if \(turnSeqRef\.current !== token\) return/);
 assert.match(hook,/firstAudioLatencyMs,/);
});
