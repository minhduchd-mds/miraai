import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

async function load(path) {
 const source=readFileSync(path,'utf8');
 const js=ts.transpileModule(source,{fileName:path,compilerOptions:{
  module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
 }}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
}
const {SpatialUIController}=await load('src/core/vision/spatial-ui-control.ts');
const face={present:false,confidence:0,gazeX:0,gazeY:0,yaw:0,pitch:0,calibrationProgress:0};
const targets=[{id:'action',label:'Action',kind:'action',left:0.35,top:0.35,right:0.65,bottom:0.65}];
function step(c,now,intent='none',eventId=1,pinching=false,hand=true){
 return c.update({face,targets,headGesture:'none',
  hand:{present:hand,confidence:hand?0.95:0,x:0.5,y:0.5,z:0,pinching,direct:true},
  gestureIntent:{intent,eventId,gesture:'None',confidence:0.9,stableMs:100,at:now},
 },now);
}

test('a pinch event ID activates once, never repeats after cooldown',()=>{
 const ctrl=new SpatialUIController();
 step(ctrl,100);step(ctrl,250);
 assert.deepEqual(step(ctrl,320,'pinch_down',1,true).events.map(e=>e.type),['activate']);
 assert.deepEqual(step(ctrl,850,'pinch_down',1,true).events,[]);
 assert.deepEqual(step(ctrl,900,'pinch_down',2,true).events.map(e=>e.type),['activate']);
});

test('a pinch before dwell is consumed, so old event cannot activate late',()=>{
 const ctrl=new SpatialUIController();
 assert.deepEqual(step(ctrl,100,'pinch_down',5,true).events,[]);
 assert.deepEqual(step(ctrl,400,'pinch_down',5,true).events,[]);
 assert.deepEqual(step(ctrl,500,'pinch_down',6,true).events.map(e=>e.type),['activate']);
});

test('camera inference timestamp is not refreshed by UI polling',()=>{
 const legacy=readFileSync('src/core/face/gesture-tracker.ts','utf8');
 const holistic=readFileSync('src/core/vision/holistic-tracker.ts','utf8');
 const snapshot=readFileSync('src/presence/vision-runtime.ts','utf8');
 const hook=readFileSync('src/app/useVisionHandInput.ts','utf8');
 assert.match(legacy,/lastFrameAt: number/);
 assert.match(legacy,/handData.lastFrameAt = res \? now : 0/);
 assert.match(holistic,/handData.lastFrameAt = frameAt/);
 assert.match(holistic,/postprocessWorker.latestFresh\(lastWorkerSeq, now\)/);
 assert.match(snapshot,/now - handData.lastFrameAt <= 350/);
 assert.match(snapshot,/handSeen: Boolean\(handFresh && handData.active && handData.present\)/);
 assert.match(snapshot,/handFrameAt: handFresh \? handData.lastFrameAt : 0/);
 assert.match(hook,/frameAt > lastHandFrameRef.current/);
 assert.match(hook,/frameAt < lastHandFrameRef.current/);
});

test('hidden tab cannot retain hand edges or use a global stale pointer ray',()=>{
 const runtime=readFileSync('src/app/useVisionSpatialRuntime.ts','utf8');
 assert.match(runtime,/resetVisionHandInput\(\)/);
 assert.match(runtime,/const handRay = primaryHand\?\.ray \|\| null;/);
 assert.match(runtime,/document.visibilityState === 'hidden'/);
});


const {SpatialHandFrameCache}=await load('src/core/vision/spatial-hand-frame-cache.ts');

test('out-of-order camera frames never overwrite a newer hand snapshot or re-arm the action',()=>{
 const cache=new SpatialHandFrameCache();
 const builds=[],stale=[];
 const build=at=>{builds.push(at);return [{at}];};
 assert.deepEqual(cache.read(100,build,()=>stale.push(1)),[{at:100}]);
 assert.deepEqual(cache.read(170,build,()=>stale.push(1)),[{at:170}]);
 assert.deepEqual(cache.read(120,build,()=>stale.push(1)),[]);
 assert.deepEqual(cache.read(120,build,()=>stale.push(1)),[]);
 assert.deepEqual(cache.read(170,build,()=>stale.push(1)),[]);
 assert.deepEqual(builds,[100,170],'never rebuild hands from older timestamps');
 assert.equal(stale.length,1,'the tracker gets exactly one loss notification');
 assert.deepEqual(cache.read(220,build,()=>stale.push(1)),[{at:220}]);
 assert.deepEqual(builds,[100,170,220]);
 cache.read(0,build,()=>stale.push(1));
 assert.deepEqual(cache.read(190,build,()=>stale.push(1)),[],
   'a zero-frame dropout must not allow an earlier timestamp to re-arm the hand');
 assert.deepEqual(cache.read(240,build,()=>stale.push(1)),[{at:240}]);
});

test('a replayed older pinch event ID cannot reactivate after cooldown',()=>{
 const ctrl=new SpatialUIController();
 step(ctrl,100);step(ctrl,260);
 assert.deepEqual(step(ctrl,310,'pinch_down',12,true).events.map(e=>e.type),['activate']);
 assert.deepEqual(step(ctrl,820,'pinch_down',11,true).events,[]);
 assert.deepEqual(step(ctrl,850,'pinch_down',12,true).events,[]);
 assert.deepEqual(step(ctrl,880,'pinch_down',13,true).events.map(e=>e.type),['activate']);
});

test('expired or future intent timestamps never authorize a pinch, but fresh input still works',()=>{
 const ctrl=new SpatialUIController();
 step(ctrl,100);step(ctrl,270);
 function input(at,id,now,kind='action',pinching=true,intent='pinch_down') {
   return ctrl.update({
     face, targets:kind==='action'?targets:[{...targets[0],kind:'window'}],
     headGesture:'none',
     hand:{present:true,confidence:.94,x:.5,y:.5,z:0,pinching,direct:true},
     gestureIntent:{intent,eventId:id,gesture:'None',confidence:.9,stableMs:100,at},
   },now);
 }
 assert.deepEqual(input(90,10,510).events,[]);
 assert.deepEqual(input(600,11,520).events,[]);
 assert.deepEqual(input(530,12,530).events.map(e=>e.type),['activate']);
});

test('old pinch-up event cannot end a new grab or suppress loss cancellation',()=>{
 const ctrl=new SpatialUIController();
 const windowTarget=[{...targets[0],kind:'window'}];
 const call=(now,at,id,intent,hand=true,pinching=true)=>ctrl.update({
   face,targets:windowTarget,headGesture:'none',
   hand:{present:hand,confidence:hand?.94:0,x:.5,y:.5,z:0,pinching,direct:true},
   gestureIntent:{intent,eventId:id,gesture:'None',confidence:.9,stableMs:100,at},
 },now);
 call(100,100,1,'none',true,false);
 call(260,260,1,'none',true,false);
 assert.deepEqual(call(320,320,20,'pinch_down').events.map(e=>e.type),['grab_start','grab_move']);
 assert.equal(call(370,370,21,'pinch_up',true,false).events.at(-1)?.type,'grab_end');
 call(740,740,22,'none',true,false);
 assert.deepEqual(call(900,900,23,'pinch_down').events.map(e=>e.type),['grab_start','grab_move']);
 assert.equal(call(950,370,21,'pinch_up',true,true).events.some(e=>e.type==='grab_end'),false);
 assert.equal(call(980,980,22,'pinch_up',true,true).events.some(e=>e.type==='grab_end'),false,
   'an old release ID with a fresh timestamp cannot close the newer drag');
 assert.equal(call(1010,1010,24,'pinch_up',true,false).events.some(e=>e.type==='grab_end'),true);
});
