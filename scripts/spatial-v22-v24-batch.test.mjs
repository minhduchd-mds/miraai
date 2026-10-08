import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

async function load(path) {
  const output = ts.transpileModule(readFileSync(path,'utf8'),{
    fileName:path,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
  }).outputText;
  return import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
}
const {SpatialAdaptivePointer}=await load('src/core/vision/spatial-adaptive-pointer.ts');

test('v22: suppress stationary screen jitter without slowing intentional motion',()=>{
  const f=new SpatialAdaptivePointer();
  let t=100, raw=.5, smooth=.5, rawMotion=0, filteredMotion=0;
  f.update('Right',.5,.5,t,.95);
  for(let i=0;i<30;i++){
    t+=33;
    const x=.5+(i%2===0?.009:-.009);
    const point=f.update('Right',x,.5,t,.95);
    rawMotion+=Math.abs(x-raw);
    filteredMotion+=Math.abs(point.x-smooth);
    raw=x;smooth=point.x;
  }
  assert.ok(filteredMotion<rawMotion*.55);
  assert.ok(f.update('Right',.56,.5,t+40,.95).x>.53);
});
test('v22: one-frame teleport rejected, corroborated relocation accepted',()=>{
 const f=new SpatialAdaptivePointer();
 assert.deepEqual(f.update('Left',.3,.4,100),{x:.3,y:.4});
 assert.deepEqual(f.update('Left',.96,.4,133),{x:.3,y:.4});
 assert.ok(f.update('Left',.305,.4,166).x<.34);
 f.update('Left',.93,.4,199);
 assert.ok(f.update('Left',.94,.4,232).x>.9);
});
test('v22: invalid/reversed frames and tracking loss fail safely; hands independent',()=>{
 const f=new SpatialAdaptivePointer();
 f.update('Left',.2,.2,100);f.update('Right',.8,.8,100);
 assert.deepEqual(f.update('Right',.8,.8,100),{x:.8,y:.8});
 assert.equal(f.update('Left',NaN,.3,120),null);
 assert.deepEqual(f.update('Left',.6,.5,150),{x:.6,y:.5});
 f.retain(['Left']);
 assert.deepEqual(f.update('Right',.9,.9,180),{x:.9,y:.9});
 assert.equal(f.update('Right',.3,.3,140),null);
 f.reset();
 assert.deepEqual(f.update('Right',.1,.1,200),{x:.1,y:.1});
});
test('v23: worker freshness contract and original source timestamps',()=>{
 const worker=readFileSync('src/core/vision/vision-worker-client.ts','utf8');
 const holistic=readFileSync('src/core/vision/holistic-tracker.ts','utf8');
 assert.match(worker,/latestFresh\(afterSeq: number, now: number, maxAgeMs = 350\)/);
 assert.match(worker,/candidate.seq <= afterSeq/);
 assert.match(worker,/now - candidate.at > maxAgeMs/);
 assert.match(holistic,/applyHands\(hands, result.at\)/);
 assert.match(holistic,/handData.lastFrameAt > frameAt/);
 assert.match(holistic,/firstWorkerFallbackDone = true/);
 assert.match(holistic,/now - workerLastHealthyAt > 1_500/);
 assert.match(holistic,/submitPostprocess\(result, performance.now\(\)\)/);
});
test('v24: lazy integration and synthetic 15k-frame soak',()=>{
 const runtime=readFileSync('src/presence/vision-runtime.ts','utf8');
 const app=readFileSync('src/app/useVisionSpatialRuntime.ts','utf8');
 assert.match(runtime,/adaptiveHandPointer.update/);
 assert.match(runtime,/adaptiveHandPointer.reset/);
 assert.match(runtime,/adaptiveHandPointer.retain/);
 assert.match(runtime,/handFrameCache.read/);
 assert.doesNotMatch(app,/SpatialAdaptivePointer/);
 const f=new SpatialAdaptivePointer();
 let now=100,last;
 for(let i=0;i<15000;i++){
    now+=33;
    if(i%200===0)f.retain([]);
    const x=.5+Math.sin(i/15)*.035+Math.sin(i*1.7)*.008;
    last=f.update('Right',x,.5,now,.92);
    assert.ok(last && last.x>=0 && last.x<=1);
 }
 assert.ok(Math.abs(last.x-.5)<.08);
});
