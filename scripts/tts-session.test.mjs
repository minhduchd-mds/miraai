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
      .replace("import { attachAnalyser } from '../audio-level';", 'const attachAnalyser = () => () => {};')
      .replace("import { BrowserSpeech } from './browser-speech';", 'class BrowserSpeech { speaking = false; speak() { return false; } cancel() {} }');
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
      .replace("import { attachAnalyser } from '../audio-level';",'const attachAnalyser=()=>()=>{};')
      .replace("import { BrowserSpeech } from './browser-speech';",'class BrowserSpeech{speaking=false;speak(){return false;}cancel(){}}');
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
 assert.match(hook,/setFirstAudioLatencyMs\(firstAudioMs\)/);
 assert.match(hook,/if \(turnSeqRef\.current !== token\) return/);
 assert.match(hook,/firstAudioLatencyMs,/);
});

test('stable final voice endpoint credits only confirmed, repeated complete Vietnamese phrases',async()=>{
  const source=readFileSync('src/core/stt/endpointer.ts','utf8');
  const js=ts.transpileModule(source,{compilerOptions:{
    target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,
  }}).outputText;
  const mod=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  const {ENDPOINT,computeEndpointDelay,computeStableFinalEndpointDelay:stable}=mod;
  const phrase='Anh giúp em kiểm tra nhé';
  assert.equal(computeEndpointDelay(phrase),ENDPOINT.complete);
  assert.equal(stable(phrase,null,1000),ENDPOINT.complete);
  assert.equal(stable(phrase,{transcript:phrase,atMs:900},1000),ENDPOINT.complete);
  assert.equal(stable(phrase,{transcript:phrase,atMs:600},1000),320);
  assert.equal(stable(phrase+'.',{transcript:phrase,atMs:600},1000),320);
  assert.equal(stable('Anh giúp em kiểm tra tiếp nhé',{transcript:phrase,atMs:600},1000),ENDPOINT.complete);
  assert.equal(stable(phrase,{transcript:phrase,atMs:1005},1000),ENDPOINT.complete);
  assert.equal(stable(phrase,{transcript:phrase,atMs:-15000},1000),ENDPOINT.complete);
  // Never trim silence on an incomplete statement or a short acknowledgement.
  for(const statement of ['Anh cần kiểm tra cho','Anh cần kiểm tra vì','Anh cần kiểm tra phần này',
    'Vâng ạ','Em giúp anh nhé']) {
    const original=computeEndpointDelay(statement);
    const prior={transcript:statement,atMs:500};
    if(original!==ENDPOINT.complete || statement.trim().split(/\s+/).length<ENDPOINT.minWords)
      assert.equal(stable(statement,prior,1000),original);
  }
  assert.equal(stable('Anh cần kiểm tra phần này',{transcript:'Anh cần kiểm tra phần này',atMs:500},1000),ENDPOINT.base);
});

test('STT final endpoint overlap never replaces continuous turn merging or trailing safeguards',()=>{
  const runtime=readFileSync('src/core/useMira.ts','utf8');
  assert.match(runtime,/lastInterimRef\.current = \{ transcript: result\.transcript, atMs: receivedAt \}/);
  assert.match(runtime,/computeStableFinalEndpointDelay\(result\.transcript, lastInterimRef\.current, receivedAt\)/);
  assert.match(runtime,/if \(result\.isFinal\) lastInterimRef\.current = null/);
  assert.match(runtime,/clearEndpointTimer\(\);\s*const delay = result\.isFinal/);
  assert.match(runtime,/if \(stateRef\.current !== 'listening'\) return/);
});

test('bounded voice latency profiler stores numeric-only data and distinguishes fallback',async()=>{
 const source=readFileSync('src/runtime/response-latency.ts','utf8');
 const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 const {ResponseLatencyWindow}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 const profiler=new ResponseLatencyWindow(4);
 const sample=(n,source='provider')=>({memoryMs:n,hostMs:2,hostActionsMs:3,preBrainSkillMs:0,
  contextReadyMs:n+5,brainMs:n*2,totalMs:n*3,firstAudioMs:n*4,source,prompt:'PRIVATE_NOT_RETAINED'});
 for(let i=1;i<=5;i++)profiler.record(sample(i));
 profiler.record(sample(6,'fallback'));
 const report=profiler.snapshot();
 assert.equal(report.count,4);
 assert.equal(report.fallbackCount,1);
 assert.equal(report.firstAudio.count,3);
 assert.equal(report.firstAudio.p50Ms,16);
 assert.equal(report.firstAudio.p95Ms,20);
 assert.equal(JSON.stringify(report).includes('PRIVATE_NOT_RETAINED'),false);
 profiler.record({...sample(7),brainMs:Infinity});
 assert.equal(profiler.snapshot().count,4);
 profiler.reset();assert.equal(profiler.snapshot().brain.p95Ms,null);
});

test('initial history load requests local and remote concurrently and merges without dropped turns',async()=>{
 const src=readFileSync('src/intelligence/memory/memory-service.ts','utf8');
 const h="import { distillFacts, loadHistory, recallMemory, saveTurn } from '../../core/history-store';";
 const s="import { createRuntimeMemoryStore, isLocalOnlyMemoryRuntime } from './runtime-store';";
 const p="import { memoryEnabled } from './preferences';";
 const helperImport="import { mergeTurnHistory } from './merge-turn-history';";
 const helper=readFileSync('src/intelligence/memory/merge-turn-history.ts','utf8')
  .replace(/^import type .*;\s*/m,'')
  .replace('export function mergeTurnHistory','function mergeTurnHistory');
 assert.ok(src.includes(h)&&src.includes(s)&&src.includes(p));
 const rewritten=src
 .replace(h,"const loadHistory=()=>globalThis.__miraMemoryTest.remote(); const distillFacts=()=>{}; const recallMemory=async()=>''; const saveTurn=()=>{};")
 .replace(s,"const createRuntimeMemoryStore=()=>({loadRecent:()=>globalThis.__miraMemoryTest.local()}); const isLocalOnlyMemoryRuntime=()=>false;")
 .replace(p,"const memoryEnabled=()=>true;")
 .replace(helperImport,helper);
 const events=[];let doneLocal,doneRemote;
 globalThis.__miraMemoryTest={
  local:()=>{events.push('local');return new Promise(r=>{doneLocal=r;});},
  remote:()=>{events.push('remote');return new Promise(r=>{doneRemote=r;});}
 };
 try{
  const js=ts.transpileModule(rewritten,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  const {MemoryService}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  const pending=new MemoryService().loadRecent();
  assert.deepEqual(events,['local','remote']);
  doneRemote([{role:'mira',text:'same'},{role:'mira',text:'remote'}]);
  doneLocal([{role:'user',text:'local'},{role:'mira',text:'same'}]);
  assert.deepEqual(await pending,[{role:'user',text:'local'},{role:'mira',text:'same'},{role:'mira',text:'remote'}]);
 }finally{delete globalThis.__miraMemoryTest;}
});

test('voice performance stages wait for full context and first genuine answer audio',()=>{
 const turn=readFileSync('src/runtime/turn-manager.ts','utf8');
 const hook=readFileSync('src/core/useMira.ts','utf8');
 assert.match(turn,/memoryPromise,/);
 assert.match(turn,/preBrainPromise,/);
 assert.match(turn,/const reply = await this\.getBrain\(\)\.reply\(input, prior, context\)/);
 assert.match(turn,/timings\.brainMs = Math\.round\(now\(\) - brainAt\)/);
 assert.match(hook,/setFirstAudioLatencyMs\(firstAudioMs\)/);
 assert.match(hook,/if \(turnSeqRef\.current !== token\) return;/);
 assert.match(hook,/latencyWindowRef\.current\?\.record\(/);
});

test('streaming remains optional and the existing buffered voice path is unchanged',()=>{
 const client=readFileSync('src/core/tts/server-tts.ts','utf8');
 assert.match(client,/const canStream = !ready/);
 assert.match(client,/if \(canStream\) \{\s*void this\.speakProgressively/);
 assert.match(client,/this\.requestAudio\(opts, controller\.signal\)/);
 assert.match(client,/const isCurrent = \(\) => this\.utteranceId === utteranceId && !controller\.signal\.aborted/);
});
