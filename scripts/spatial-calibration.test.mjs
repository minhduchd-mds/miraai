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
 for(let i=0;i<20;i++)s.sample({at:120+i*195,now:120+i*195,hands:[]});
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
 assert.match(source,/engine\.current\.sample\(\{at:snapshot\.handFrameAt,now,hands:\[\]\}\)/);
 assert.doesNotMatch(source,/\.at\(-1\)/);
});

test('calibration preview reuses authorized camera stream, never opens or records a second one',()=>{
 const app=readFileSync('src/app/AppV2.tsx','utf8');
 const panel=readFileSync('src/settings/SpatialCalibrationPanel.tsx','utf8');
 assert.match(app,/getVisionStream=\{\(\) => visionModulesRef\.current\?\.visionStream\(\) \?\? null\}/);
 assert.match(panel,/video\.srcObject=stream/);
 assert.match(panel,/video\.srcObject=null/);
 assert.doesNotMatch(panel,/getUserMedia\(|MediaRecorder\(|canvas\.toDataURL\(/);
});


test('cached hand inference predating the Start action never counts as trial evidence',()=>{
 const s=new SpatialCalibrationSession();
 assert.equal(s.begin('left',1000),true);
 assert.equal(s.sample(l(995,1020)),null);
 assert.equal(s.sample(l(1010,1020)),null);
 assert.equal(s.sample(l(1190,1190)),null);
 const done=s.sample(l(1260,1270));
 assert.equal(done.passed,true);
 assert.equal(done.validFrames,3);
 assert.equal(done.rejectedFrames,1);
});
test('camera interruption and tab-background interruption fail closed, not counted as trial failures',()=>{
 const engine=readFileSync('src/settings/SpatialCalibrationPanel.tsx','utf8');
 assert.match(engine,/track\.readyState==='live'/);
 assert.match(engine,/engine\.current\.cancel\(\)/);
 assert.match(engine,/document\.addEventListener\('visibilitychange',onVisibility\)/);
 assert.match(engine,/không tính kết quả/);
 const s=new SpatialCalibrationSession();
 s.begin('zoom',100);
 s.sample({at:150,now:150,hands:[]});
 s.cancel();
 assert.equal(s.snapshot().completed,0);
 s.begin('zoom',500);
 assert.equal(s.tick(7500).passed,false);
 assert.equal(s.snapshot().completed,1);
});
test('video preview rebinds if the existing stream changes, without requesting new media',()=>{
 const src=readFileSync('src/settings/SpatialCalibrationPanel.tsx','utf8');
 assert.match(src,/if\(video\.srcObject!==stream\)/);
 assert.match(src,/window\.setInterval\(attach,750\)/);
 assert.match(src,/window\.clearInterval\(timer\)/);
 assert.doesNotMatch(src,/navigator\.mediaDevices\.getUserMedia|new MediaRecorder/);
});


test('idle cannot claim success from stale or insufficient inference samples',()=>{
 const s=new SpatialCalibrationSession();
 s.begin('idle',100);
 for(let i=0;i<10;i++)s.sample({at:120+i*190,now:120+i*190,hands:[]});
 const result=s.tick(4200);
 assert.equal(result.passed,false);
 assert.equal(result.inconclusive,true);
 assert.equal(s.snapshot().completed,0);
 assert.equal(s.snapshot().inconclusive,1);
 assert.equal(s.snapshot().passedRatePct,null);
});
test('idle finds an unexpected classification even without enough neutral coverage',()=>{
 const s=new SpatialCalibrationSession();
 s.begin('idle',100);
 s.sample(l(140));
 const result=s.tick(4200);
 assert.equal(result.passed,false);
 assert.equal(result.inconclusive,false);
 assert.equal(result.unexpectedFrames,1);
 assert.equal(s.snapshot().completed,1);
 assert.equal(s.snapshot().passedRatePct,0);
});
test('empty-hand calibration never invents frame timestamps from UI polls',()=>{
 const source=readFileSync('src/settings/SpatialCalibrationPanel.tsx','utf8');
 assert.match(source,/snapshot\.handFrameAt,now,hands:\[\]/);
 assert.doesNotMatch(source,/engine\.current\.sample\(\{at:now,now,hands:\[\]\}\)/);
 assert.match(source,/result\.inconclusive/);
});
