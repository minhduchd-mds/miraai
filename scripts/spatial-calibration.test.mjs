import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
const path='src/core/vision/spatial-calibration.ts';
const js=ts.transpileModule(readFileSync(path,'utf8'),{fileName:path,compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext
}}).outputText;
const {SpatialCalibrationSession,CALIBRATION_TESTS}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const l=(at,now=at)=>({at,now,hands:[{handedness:'Left',gesture:'Open_Palm',pinching:false,score:.96}]});
const r=(at,now=at)=>({at,now,hands:[{handedness:'Right',gesture:'Open_Palm',pinching:false,score:.95}]});
test('all six guided trial kinds exposed, but no camera permission acquired by engine',()=>{
 assert.deepEqual(CALIBRATION_TESTS.map(x=>x.kind),['left','right','pinch','palm','zoom','idle']);
 const engine=readFileSync(path,'utf8');
 assert.doesNotMatch(engine,/getUserMedia|localStorage|fetch\(|sendBeacon|MediaRecorder/);
});
test('left hand needs 240ms of distinct camera timestamps and never accepts UI-poll repeats',()=>{
 const s=new SpatialCalibrationSession();
 assert.equal(s.begin('left',100),true);
 assert.equal(s.sample(l(120)),null);
 assert.equal(s.sample(l(120,250)),null);
 assert.equal(s.sample(l(210)),null);
 const result=s.sample(l(365));
 assert.equal(result.passed,true);
 assert.equal(result.detectedMs,265);
 assert.equal(result.validFrames,3);
 assert.equal(result.rejectedFrames,1);
 assert.equal(s.snapshot().passedRatePct,100);
});
test('right hand, pinch, open palm and bimanual zoom recognize reliable observed gestures',()=>{
 const specs=[
  ['right',(at)=>r(at)],
  ['pinch',at=>({at,now:at,hands:[{handedness:'Right',gesture:'None',score:.96,pinching:true}]})],
  ['palm',at=>l(at)],
  ['zoom',at=>({at,now:at,hands:[
   {handedness:'Left',score:.96,pinching:true},{handedness:'Right',score:.97,pinching:true}]})],
 ];
 for(const [kind,make] of specs){
  const s=new SpatialCalibrationSession();
  s.begin(kind,100);
  assert.equal(s.sample(make(100)),null);
  assert.equal(s.sample(make(225)),null);
  assert.equal(s.sample(make(365)).passed,true);
 }
});
test('bad confidence, reversed, old, future and frozen camera frames fail closed',()=>{
 const s=new SpatialCalibrationSession();s.begin('pinch',1000);
 const frame=(at,now=at,score=.9)=>({at,now,hands:[{handedness:'Left',score,pinching:true}]});
 assert.equal(s.sample(frame(1020)),null);
 assert.equal(s.sample(frame(1100,1200,.3)),null);
 assert.equal(s.sample(frame(1030,1210)),null);
 assert.equal(s.sample(frame(1220,1700)),null);
 assert.equal(s.sample(frame(2000,1800)),null);
 assert.equal(s.sample(frame(1800)),null);
 assert.equal(s.sample(frame(1930)),null);
 assert.equal(s.sample(frame(2030)),null); // 230ms is shorter than the 240ms hold
});
test('neutral idle records unexpected gesture frames but never claims click false positives',()=>{
 const s=new SpatialCalibrationSession();s.begin('idle',100);
 s.sample({at:110,now:110,hands:[]});
 s.sample({at:200,now:200,hands:[]});
 s.sample(l(300));
 const result=s.tick(4100);
 assert.equal(result.kind,'idle');
 assert.equal(result.passed,false);
 assert.equal(result.unexpectedFrames,1);
 assert.equal(s.snapshot().unexpectedFrames,1);
});
test('neutral idle passes after enough actual camera frames and can export bounded numeric results',()=>{
 const s=new SpatialCalibrationSession();s.begin('idle',100);
 for(let i=0;i<10;i++)s.sample({at:120+i*200,now:120+i*200,hands:[]});
 assert.equal(s.tick(4200).passed,true);
 const result=s.snapshot();
 assert.equal(result.completed,1);
 assert.equal(result.reactionAndRecognition.count,0);
 assert.doesNotMatch(JSON.stringify(result),/landmarks|face|recording|transcript/);
 for(let i=0;i<72;i++){s.begin('left',5000+i*1000);s.tick(5000+i*1000+6000);}
 assert.equal(s.snapshot().trials.length,60);
 s.reset();assert.equal(s.snapshot().completed,0);
});
test('camera calibration is lazy, opt-in, view-only and mounted in Settings with feedback intact',()=>{
 const settings=readFileSync('src/settings/SettingsPanel.tsx','utf8');
 const app=readFileSync('src/app/AppV2.tsx','utf8');
 const panel=readFileSync('src/settings/SpatialCalibrationPanel.tsx','utf8');
 assert.match(settings,/lazy\(\(\) => import\('\.\/SpatialCalibrationPanel'\)\)/);
 assert.match(settings,/tab === 'control'/);
 assert.match(app,/getVisionSnapshot=\{\(\) => visionModulesRef\.current\?\.visionSnapshot\(\) \?\? null\}/);
 assert.match(panel,/disabled=\{!props\.visionOn\}/);
 assert.match(panel,/getVisionSnapshot/);
 assert.doesNotMatch(panel,/spatialActionElement|dispatchEvent\(new CustomEvent\('mira:room-gesture'/);
 assert.match(panel,/data-spatial-calibration/);
});

test('idle mode counts camera-active no-hand observations without fabricating hand frames',()=>{
 const source=readFileSync('src/settings/SpatialCalibrationPanel.tsx','utf8');
 assert.match(source,/snapshot\.handSeen/);
 assert.match(source,/active\?\.kind==='idle'/);
 assert.match(source,/engine\.current\.sample\(\{at:now,now,hands:\[\]\}\)/);
 assert.doesNotMatch(source,/\.at\(-1\)/);
});
