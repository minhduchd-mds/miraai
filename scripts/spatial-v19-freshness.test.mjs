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
 assert.match(holistic,/handData.lastFrameAt = performance.now\(\)/);
 assert.match(snapshot,/now - handData.lastFrameAt <= 350/);
 assert.match(snapshot,/handSeen: Boolean\(handFresh && handData.active && handData.present\)/);
 assert.match(snapshot,/handFrameAt: handFresh \? handData.lastFrameAt : 0/);
 assert.match(hook,/frameAt !== lastHandFrameRef.current/);
});

test('hidden tab cannot retain hand edges or use a global stale pointer ray',()=>{
 const runtime=readFileSync('src/app/useVisionSpatialRuntime.ts','utf8');
 assert.match(runtime,/resetVisionHandInput\(\)/);
 assert.match(runtime,/const handRay = primaryHand\?\.ray \|\| null;/);
 assert.match(runtime,/document.visibilityState === 'hidden'/);
});
