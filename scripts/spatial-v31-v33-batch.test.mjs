import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';

const holistic = readFileSync('src/core/vision/holistic-tracker.ts','utf8');
function harness() {
  const models=[];
  const cameras=[];
  const stats={closed:0,released:0,scheduled:0,modelCalls:0,cameraCalls:0};
  const prelude = [
    'let startupPromise=null, startupGeneration=0, inFlightGeneration=0;',
    'let stopped=true, lastError=null, activeDelegate="unknown", delegateFailoverPromise=null;',
    'let landmarker=null, video=null, consecutiveInferenceFailures=0;',
    'let governor={}; let lastWorkerSeq=0,firstWorkerFallbackDone=false,workerLastHealthyAt=0;',
    'let holisticRuntimeData={error:null,providerPlan:null,face:{},active:false,delegate:"unknown"};',
    'const faceData={active:false},handData={active:false},postureData={active:false};',
    'const frameGate={reset:()=>{}},postprocessWorker={start:()=>true,stop:()=>{}};',
    'const currentPerceptionRuntimePlan=()=>({});',
    'class VisionPerformanceGovernor {setPostprocess(){} snapshot(){return {};}}',
    'const cancelReadFrame=()=>{},scheduleReadFrame=()=>globalThis.fakeScheduled();',
    'const clearAllSignals=()=>{};',
  ].join('\n');
  const excerpt=holistic.slice(holistic.indexOf('export async function startHolisticTracking(): Promise<boolean> {'))
    .replace(/^export /gm,'');
  const text=ts.transpileModule(
    prelude+'\n'+excerpt+'\n'+
      'globalThis.exposed={startHolisticTracking,stopHolisticTracking,isActive:()=>!stopped};',
    {fileName:'mock-holistic.ts',compilerOptions:{
      target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None,
    }},
  ).outputText;
  const context={
    performance:{now:()=>500},
    console:{warn:()=>{}},
    fakeScheduled:()=>{stats.scheduled++},
    createLandmarker:()=>{
      stats.modelCalls++;
      return new Promise((resolve,reject)=>models.push({
        resolve:()=>resolve({close:()=>{stats.closed++}}),reject,
      }));
    },
    acquireVisionCamera:()=>{
      stats.cameraCalls++;
      return new Promise((resolve)=>cameras.push({resolve:()=>resolve({readyState:4})}));
    },
    releaseVisionCamera:()=>{stats.released++},
  };
  runInNewContext(text,context);
  return {api:context.exposed,models,cameras,stats};
}
async function flush(){for(let i=0;i<8;i++)await Promise.resolve();}
test('v31: stop during pending GPU setup disposes late landmarker and prevents camera reopen',async()=>{
  const h=harness();
  const first=h.api.startHolisticTracking();
  await flush();
  assert.equal(h.models.length,1);
  h.api.stopHolisticTracking();
  h.models[0].resolve();
  assert.equal(await first,false);
  assert.equal(h.stats.closed,1);
  assert.equal(h.stats.cameraCalls,0);
  assert.equal(h.api.isActive(),false);
});
test('v31: start after stop waits for cancelled in-flight GPU initialization',async()=>{
  const h=harness();
  const stale=h.api.startHolisticTracking();await flush();
  h.api.stopHolisticTracking();
  const fresh=h.api.startHolisticTracking();
  assert.equal(h.models.length,1);
  h.models[0].resolve();assert.equal(await stale,false);await flush();
  assert.equal(h.models.length,2);
  h.models[1].resolve();await flush();
  assert.equal(h.cameras.length,1);
  h.cameras[0].resolve();
  assert.equal(await fresh,true);
  assert.equal(h.api.isActive(),true);
  h.api.stopHolisticTracking();
  assert.equal(h.stats.closed,2);
  assert.equal(h.api.isActive(),false);
});
test('v32: disconnect while getUserMedia is pending never resurrects stale frame loop',async()=>{
  const h=harness();
  const old=h.api.startHolisticTracking();await flush();
  h.models[0].resolve();await flush();
  assert.equal(h.cameras.length,1);
  h.api.stopHolisticTracking();
  h.cameras[0].resolve();
  assert.equal(await old,false);
  assert.equal(h.stats.scheduled,0);
  assert.equal(h.api.isActive(),false);
  const newer=h.api.startHolisticTracking();await flush();
  h.models[1].resolve();await flush();
  h.cameras[1].resolve();
  assert.equal(await newer,true);
  assert.equal(h.stats.scheduled,1);
  h.api.stopHolisticTracking();
  assert.ok(h.stats.released>=3);
});
test('v32: transport cleanup cannot clear a newer generation in its stale finally',()=>{
 const source=readFileSync('src/app/useVisionTransport.ts','utf8');
 assert.match(source,/if \(request === visionGenerationRef\.current\) \{\s*visionStartingRef\.current = false/);
 assert.match(source,/visionGenerationRef\.current \+= 1;\s*visionStartingRef\.current = false/);
 assert.match(source,/visionWantedRef\.current = false/);
 assert.match(source,/document\.hidden/);
 assert.match(source,/policy\.exhausted/);
});
test('v33: 250 synthetic camera start-stop cycles bound active streams to one',async()=>{
  const h=harness();
  for(let i=0;i<250;i++){
    const first=h.api.startHolisticTracking();
    await flush();
    h.models[i].resolve();await flush();
    h.cameras[i].resolve();
    assert.equal(await first,true);
    h.api.stopHolisticTracking();
    assert.equal(h.api.isActive(),false);
  }
  assert.equal(h.stats.scheduled,250);
  assert.equal(h.stats.closed,250);
  assert.equal(h.stats.cameraCalls,250);
  assert.equal(h.stats.modelCalls,250);
});
