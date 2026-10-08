import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
async function load(path){
 const source=readFileSync(path,'utf8');
 const output=ts.transpileModule(source,{fileName:path,compilerOptions:{
  module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,
 }}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
}
const {StableBimanualPairRuntime}=await load('src/app/spatial-two-hand.ts');
const {SpatialPerformanceProfiler}=await load('src/core/vision/spatial-performance.ts');
const pair=()=>[
 {handedness:'Left',pointerX:.3,pointerY:.5,pinching:true,score:.95},
 {handedness:'Right',pointerX:.7,pointerY:.5,pinching:true,score:.95},
];
test('cached camera frame does not mature a two-hand hold',()=>{
 const t=new StableBimanualPairRuntime();
 assert.deepEqual(t.update(pair(),100,100),[]);
 assert.deepEqual(t.update(pair(),240,100),[]);
 assert.deepEqual(t.update(pair(),300,100),[]);
 assert.deepEqual(t.update(pair(),310,220),[]);
 assert.equal(t.update(pair().reverse(),340,300).length,2);
 assert.equal(t.update(pair(),345,300).length,2);
 assert.deepEqual(t.update(pair(),660,300),[]);
});
test('reversed or missing tracking disarms and requires a new hold',()=>{
 const t=new StableBimanualPairRuntime();
 t.update(pair(),100,100);
 assert.equal(t.update(pair(),290,290).length,2);
 assert.deepEqual(t.update(pair(),300,260),[]);
 assert.deepEqual(t.update(pair(),320,320),[]);
 assert.equal(t.update(pair(),510,510).length,2);
 assert.deepEqual(t.update(pair().slice(0,1),520,520),[]);
 assert.deepEqual(t.update(pair(),521,521),[]);
});
test('v21 latency statistics are bounded and do not hold camera data',()=>{
 const p=new SpatialPerformanceProfiler();
 p.notePoll(100,125,true);p.notePoll(100,130,true);p.notePoll(200,235,true);
 p.notePoll(300,325,false);p.noteHandAction(200,240);p.noteHandAction(200,600);
 p.noteUiWork(8);p.noteUiWork(17);p.noteUiWork(NaN);
 let s=p.snapshot(10485760);
 assert.equal(s.uniqueHandFrames,2);assert.equal(s.repeatedUiPolls,1);
 assert.equal(s.noHandPolls,1);assert.equal(s.jsHeapMiB,10);
 assert.deepEqual(s.inferenceToUi,{count:2,p50Ms:25,p95Ms:35,maxMs:35});
 assert.deepEqual(s.inferenceToHandAction,{count:1,p50Ms:40,p95Ms:40,maxMs:40});
 assert.equal(s.uiHandlerDuration.count,2);assert.equal(p.snapshot().jsHeapMiB,null);
 assert.equal(JSON.stringify(s).includes('landmarks'),false);
 p.reset();s=p.snapshot();assert.equal(s.uniqueHandFrames,0);
});
test('rolling percentiles cap memory at 128 samples',()=>{
 const p=new SpatialPerformanceProfiler();for(let i=0;i<512;i++)p.noteUiWork(i);
 const s=p.snapshot().uiHandlerDuration;
 assert.equal(s.count,128);assert.equal(s.p50Ms,448);
 assert.equal(s.p95Ms,505);assert.equal(s.maxMs,511);
});
test('readout is wired and previous freshness check remains',()=>{
 const app=readFileSync('src/app/useVisionSpatialRuntime.ts','utf8');
 const runtime=readFileSync('src/presence/vision-runtime.ts','utf8');
 assert.match(app,/noteHandAction\(Number\(snapshot\?\.handFrameAt \|\| 0\), now\)/);
 assert.match(app,/notePoll\(/);assert.match(app,/noteUiWork\(/);
 assert.match(runtime,/spatialPerformance: spatialPerformanceProfiler\.snapshot/);
 assert.match(runtime,/now - handData\.lastFrameAt <= 350/);
});
