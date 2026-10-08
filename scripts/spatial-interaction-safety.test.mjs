import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

async function load(path) {
  const raw=readFileSync(path,'utf8');
  const js=ts.transpileModule(raw,{compilerOptions:{
    module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,
  }}).outputText;
  return import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
}
const { SpatialUIController }=await load('src/core/vision/spatial-ui-control.ts');
const ray=await load('src/core/vision/spatial-ray.ts');
const geometry=[{id:'voice',label:'Voice',kind:'action',left:0.35,top:0.35,right:0.65,bottom:0.65},
{id:'panel',label:'Panel',kind:'window',left:0.35,top:0.35,right:0.65,bottom:0.65}];
const noFace={present:false,confidence:0,gazeX:0,gazeY:0,yaw:0,pitch:0,calibrationProgress:0};
function frame({now,hand=true,pinching=false,intent='none',confidence=0.8,kind='action',direct=true,
 face=noFace,gestureConfidence=0.82,headGesture='none',eventId=1}){
 return {now,input:{
  face,hand:{present:hand,confidence:hand?confidence:0,x:0.5,y:0.5,z:0,pinching,direct},
  gestureIntent:{intent,confidence:gestureConfidence,eventId,gesture:'None',stableMs:100,at:now},
  targets:geometry.filter(t=>t.kind===kind),headGesture,rayHit:null,
 }};
}
function advance(ctrl, args) { const {now,input}=frame(args);return ctrl.update(input,now); }

test('pinch activation requires a present confident hand and completed focus dwell',()=>{
 const ctrl=new SpatialUIController();
 assert.equal(advance(ctrl,{now:100}).events.length,0);
 assert.equal(advance(ctrl,{now:250,hand:false,pinching:true,intent:'pinch_down'}).events.length,0);
 advance(ctrl,{now:300});
 assert.deepEqual(advance(ctrl,{now:450,pinching:true,intent:'pinch_down',eventId:2}).events.map(x=>x.type),['activate']);
 assert.equal(advance(ctrl,{now:900,hand:false,pinching:true,intent:'pinch_down'}).events.length,0);
});

test('low-confidence pinch never triggers an action',()=>{
 const ctrl=new SpatialUIController();
 advance(ctrl,{now:100}); advance(ctrl,{now:280});
 assert.equal(advance(ctrl,{now:320,pinching:true,intent:'pinch_down',gestureConfidence:0.4}).events.length,0);
});

test('grab cancels exactly once after hand tracking drops and missing pinch-up',()=>{
 const ctrl=new SpatialUIController();
 advance(ctrl,{now:100,kind:'window'});
 advance(ctrl,{now:250,kind:'window'});
 assert.equal(advance(ctrl,{now:310,kind:'window',pinching:true,intent:'pinch_down'}).events[0]?.type,'grab_start');
 assert.equal(advance(ctrl,{now:380,kind:'window',hand:false}).events.length,0);
 assert.deepEqual(advance(ctrl,{now:580,kind:'window',hand:false}).events.map(e=>e.type),['cancel']);
 assert.equal(advance(ctrl,{now:820,kind:'window',hand:false}).events.length,0);
});

test('grab cancels immediately when target disappears and focus does not remain armed',()=>{
 const ctrl=new SpatialUIController();
 advance(ctrl,{now:100,kind:'window'});
 advance(ctrl,{now:260,kind:'window'});
 advance(ctrl,{now:300,kind:'window',pinching:true,intent:'pinch_down'});
 const lost=frame({now:320,kind:'window',pinching:true});
 lost.input.targets=[];
 const next=ctrl.update(lost.input,320);
 assert.deepEqual(next.events.map(e=>e.type),['cancel']);
 assert.equal(next.focus,null);
 assert.equal(next.grabbing,false);
});

test('face to hand source change restarts focus dwell and prevents stale activations',()=>{
 const ctrl=new SpatialUIController();
 const face={...noFace,present:true,confidence:0.9,calibrationProgress:1};
 advance(ctrl,{now:100,face,direct:false,hand:false});
 advance(ctrl,{now:460,face,direct:false,hand:false});
 assert.equal(advance(ctrl,{now:480,face,hand:true,direct:true,pinching:true,intent:'pinch_down'}).events.length,0);
 assert.deepEqual(advance(ctrl,{now:650,face,hand:true,direct:true,pinching:true,intent:'pinch_down',eventId:2}).events.map(e=>e.type),['activate']);
});

test('ray source rejects malformed landmarks and non-finite ray/target coordinates',()=>{
 assert.equal(ray.handRayFromLandmarks(Array(9).fill(null).map(()=>({x:NaN,y:0.2}))),null);
 assert.equal(ray.handRayFromLandmarks(Array(9).fill(null).map(()=>({x:2,y:0.2}))),null);
 assert.equal(ray.hitTestSpatialRay({origin:{x:0.5,y:0.5,z:0},direction:{x:NaN,y:0,z:1},confidence:0.9,source:'hand'},
 [{id:'target',label:'Target',z:0.5,left:0,top:0,right:1,bottom:1}]),null);
 assert.equal(ray.hitTestSpatialRay({origin:{x:0.5,y:0.5,z:0},direction:{x:0,y:0,z:1},confidence:0.9,source:'hand'},
 [{id:'target',label:'Target',z:NaN,left:0,top:0,right:1,bottom:1}]),null);
});

test('spatial target collector excludes inert/hidden, disabled and outside viewport elements',()=>{
 const text=readFileSync('src/app/spatial-ui-helpers.ts','utf8');
 assert.match(text,/element.closest\('\[inert\],\[aria-hidden="true"\],\[disabled\]'\)/);
 assert.match(text,/style.visibility === 'hidden'/);
 assert.match(text,/rect.left >= width/);
});

test('Visual QA watches settings and spatial controller edits',()=>{
 const yaml=readFileSync('.github/workflows/visual-qa.yml','utf8');
 assert.match(yaml,/src\/settings\/\*\*/);
 assert.match(yaml,/src\/core\/vision\/spatial-\*\.ts/);
});

test('vision Spatial controller is deferred until camera is enabled', () => {
  const app=readFileSync('src/app/AppV2.tsx','utf8');
  assert.match(app,/import\('\.\.\/core\/vision\/spatial-ui-control'\)/);
  assert.match(app,/if \(!visionOn\) return/);
  assert.doesNotMatch(app,/import \{ SpatialUIController \} from/);
  const runtime=readFileSync('src/app/useVisionSpatialRuntime.ts','utf8');
  assert.match(runtime,/if \(!spatialUiRef\.current\) \{[\s\S]*?\breturn;\s*\}/);
});
