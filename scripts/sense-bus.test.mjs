import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

async function senseBus() {
  const code = readFileSync('src/core/vision/sense-bus.ts','utf8');
  const result = ts.transpileModule(code,{compilerOptions:{
    module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022
  }}).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(result).toString('base64'));
}
test('SenseBus ignores stale, duplicated and future camera events', async () => {
  const { MiraSenseBus } = await senseBus();
  const bus = new MiraSenseBus();
  const signal = { source:'hand',kind:'tracked',trackId:'Left',confidence:0.9,atMs:1000 };
  assert.equal(bus.ingest(signal,1000),true);
  assert.equal(bus.ingest(signal,1000),false);
  assert.equal(bus.ingest({...signal,atMs:999},1000),false);
  assert.equal(bus.ingest({...signal,atMs:2000},1000),false);
  assert.equal(bus.ingest({...signal,atMs:1001},1001),true);
  assert.equal(bus.snapshot(1100).signalCount,1);
});
test('SenseBus forgets expired signals and decays confidence', async () => {
  const { MiraSenseBus } = await senseBus();
  const bus = new MiraSenseBus();
  bus.ingest({ source:'face',kind:'presence',confidence:1,atMs:1000,ttlMs:1000 },1000);
  const first = bus.snapshot(1000).signals[0];
  const second = bus.snapshot(1450).signals[0];
  assert.equal(first.effectiveConfidence,1);
  assert.ok(Math.abs(second.effectiveConfidence-0.5)<0.000001);
  assert.equal(bus.snapshot(2050).signalCount,0);
});
test('SenseBus bounds memory and keeps observations metadata only', async () => {
  const { MiraSenseBus } = await senseBus();
  const bus = new MiraSenseBus();
  for(let i=0;i<100;i++) {
    bus.ingest({ source:'scene',kind:'object',trackId:'t'+i,confidence:0.7,
      atMs:1000+i,payload:{rawCameraFrame:'do-not-retain'} },1100);
  }
  assert.equal(bus.snapshot(1100).signalCount,48);
  assert.equal(JSON.stringify(bus.snapshot(1100)).includes('rawCameraFrame'),false);
  bus.reset();
  assert.equal(bus.snapshot(1100).signalCount,0);
});
test('Vision runtime wires observer but does not delegate gesture actions to new SenseBus', () => {
  const code = readFileSync('src/presence/vision-runtime.ts','utf8');
  assert.match(code,/const senseBus = new MiraSenseBus/);
  assert.match(code,/senseBus.reset\(\)/);
  assert.match(code,/const sense = senseBus.snapshot\(now\)/);
  assert.doesNotMatch(code,/senseBus\.(?:click|dispatchAction|execute)\(/);
});
