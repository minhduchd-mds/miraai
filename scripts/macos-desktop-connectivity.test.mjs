import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import handler from '../api/brain-health.js';

async function bridgeModule() {
  const code = ts.transpileModule(readFileSync('src/desktop/bridge.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}

test('Tauri v2 desktop bridge supports public global and internal injected IPC', async () => {
  const bridge = await bridgeModule();
  const before = globalThis.window;
  try {
    globalThis.window = { __TAURI_INTERNALS__: { invoke: async (name) => {
      assert.equal(name, 'desktop_memory_count'); return 7;
    } } };
    assert.equal(bridge.isDesktopRuntime(), true);
    assert.equal(await bridge.desktopInvoke('desktop_memory_count'), 7);
    globalThis.window = { __TAURI__: { core: { invoke: async () => 9 } } };
    assert.equal(bridge.isDesktopRuntime(), true);
    assert.equal(await bridge.desktopInvoke('desktop_memory_count'), 9);
    globalThis.window = {};
    assert.equal(bridge.isDesktopRuntime(), false);
    await assert.rejects(bridge.desktopInvoke('desktop_memory_count'), /native bridge is unavailable/);
  } finally {
    if (before === undefined) delete globalThis.window; else globalThis.window = before;
  }
});

function response() {
  const r = {headers:{}, code:null, body:null};
  r.setHeader=(k,v)=>{r.headers[k.toLowerCase()]=v;};
  r.status=(code)=>{r.code=code;return r;};
  r.json=(body)=>{r.body=body;return r;};
  r.end=()=>r;
  return r;
}

test('brain readiness reports missing provider without running or exposing the model', () => {
  const keys=['GEMINI_API_KEY','GOOGLE_API_KEY','GOOGLE_GENERATIVE_AI_API_KEY','GEMINI_KEY',
    'OPENAI_API_KEY','OPENAI_MODEL','ANTHROPIC_API_KEY','ANTHROPIC_MODEL'];
  const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  try {
    for(const k of keys)delete process.env[k];
    const r=response();
    handler({method:'GET',headers:{host:'miraai-five.vercel.app',origin:'tauri://localhost'}},r);
    assert.equal(r.code,200);
    assert.equal(r.body.status,'unconfigured');
    assert.equal(r.body.configured,false);
    assert.equal(r.headers['access-control-allow-origin'],'tauri://localhost');
    assert.match(r.headers['cache-control'],/no-store/);
    assert.deepEqual(r.body.providers,[]);
  }finally{
    for(const k of keys)if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];
  }
});

test('Desktop SQLite storage errors are not represented as empty successful operations', () => {
  const s=readFileSync('src/intelligence/memory/desktop-memory-store.ts','utf8');
  assert.match(s,/return desktopInvoke<number>\('desktop_memory_count'\)/);
  assert.match(s,/await desktopInvoke\('desktop_memory_clear'\)/);
  assert.doesNotMatch(s,/countTurns\(\): Promise<number> \{\s*try/);
});
