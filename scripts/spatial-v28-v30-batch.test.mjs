import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';

async function load(path) {
 const js=ts.transpileModule(readFileSync(path,'utf8'),{
  fileName:path,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
 }).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
}
const {VisionCameraRecoveryPolicy}=await load('src/core/vision/camera-recovery-policy.ts');
const {SpatialPerformanceProfiler}=await load('src/core/vision/spatial-performance.ts');

test('v28: retry is bounded, exponential and cannot storm indefinitely',()=>{
 const p=new VisionCameraRecoveryPolicy();
 assert.equal(p.canRetry(0),true);
 p.noteAttempt(0);assert.deepEqual(p.snapshot(),{attempts:1,exhausted:false});
 assert.equal(p.canRetry(999),false);assert.equal(p.canRetry(1000),true);
 p.noteAttempt(1000);assert.equal(p.canRetry(2999),false);
 assert.equal(p.canRetry(3000),true);p.noteAttempt(3000);
 assert.equal(p.exhausted,true);
 for(let now=3001;now<120000;now+=125){
   assert.equal(p.canRetry(now),false);p.noteAttempt(now);
 }
 assert.deepEqual(p.snapshot(),{attempts:3,exhausted:true});
});
test('v28: 15s uninterrupted live stream clears attempts, short bursts do not',()=>{
 const p=new VisionCameraRecoveryPolicy();
 p.noteAttempt(100);p.noteLive(200);p.noteLive(10000);
 assert.equal(p.snapshot().attempts,1);
 p.noteOffline();p.noteLive(11500);p.noteLive(26000);
 assert.equal(p.snapshot().attempts,1);
 p.noteLive(26501);assert.equal(p.snapshot().attempts,0);
 p.reset();assert.deepEqual(p.snapshot(),{attempts:0,exhausted:false});
});
test('v28: manual stop, hidden tab, camera ended and late promise guarded',()=>{
 const s=readFileSync('src/app/useVisionTransport.ts','utf8');
 for(const pat of [
  /visionWantedRef\.current = false/,
  /visionGenerationRef\.current \+= 1/,
  /document\.hidden/,/policy\.exhausted/,/policy\.noteAttempt\(now\)/,
  /if \(disposed \|\| request !== visionGenerationRef\.current \|\| !visionWantedRef\.current\)/,
  /track\.readyState === 'live'/,/window\.clearInterval\(timer\)/,
 ]) assert.match(s,pat);
 assert.doesNotMatch(s,/localStorage|indexedDB|fetch\(/);
});
test('v29: prepaint rejects future or aged frames and resets safely',()=>{
 const p=new SpatialPerformanceProfiler();
 p.notePrepaint(100,130);p.notePrepaint(100,451);p.notePrepaint(200,190);
 p.notePrepaint(0,320);p.notePrepaint(NaN,220);p.notePrepaint(300,345);
 assert.deepEqual(p.snapshot().inferenceToPrepaint,{count:2,p50Ms:45,p95Ms:45,maxMs:45});
 p.reset();assert.equal(p.snapshot().inferenceToPrepaint.count,0);
});
test('v29: browser paints sample once per camera frame and cancel pending rAF',()=>{
 const ui=readFileSync('src/app/useVisionSpatialRuntime.ts','utf8');
 const runtime=readFileSync('src/presence/vision-runtime.ts','utf8');
 assert.match(ui,/handFrameAt !== lastPrepaintFrame/);
 assert.match(ui,/window\.requestAnimationFrame\(\(\) =>/);
 assert.match(ui,/current\?\.noteSpatialPrepaint\(handFrameAt, performance\.now\(\)\)/);
 assert.match(ui,/window\.cancelAnimationFrame\(pendingPrepaint\)/);
 assert.match(runtime,/export function noteSpatialPrepaint/);
 assert.match(runtime,/spatialPerformanceProfiler\.notePrepaint/);
});
test('v30: 54,000 timestamp synthetic 30-minute soak is memory bounded',()=>{
 const p=new SpatialPerformanceProfiler();
 const policy=new VisionCameraRecoveryPolicy();
 const TOTAL=54_000;
 for(let i=0;i<TOTAL;i++){
   const now=1000+i*(1000/30),inferenceAt=now-27;
   p.notePoll(inferenceAt,now,true);
   p.notePrepaint(inferenceAt,now+8);
   p.noteUiWork(3+i%9);
   if(i===8000||i===16000||i===32000){
     policy.noteOffline();policy.noteAttempt(now);
   }
   if(i%1000===0) policy.noteLive(now);
 }
 const s=p.snapshot();
 assert.equal(s.uniqueHandFrames,TOTAL);
 assert.equal(s.repeatedUiPolls,0);
 assert.equal(s.inferenceToUi.count,128);
 assert.equal(s.inferenceToPrepaint.count,128);
 assert.equal(s.uiHandlerDuration.count,128);
 assert.ok(s.inferenceToPrepaint.p95Ms<80);
 assert.ok(JSON.stringify(s).length<850);
 assert.doesNotMatch(JSON.stringify(s),/landmarks|image|identity|cameraUrl/);
});
