import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

async function load(path) {
  const source=readFileSync(path,'utf8');
  const compiled=ts.transpileModule(source,{fileName:path,compilerOptions:{
    module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
  }}).outputText;
  return import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
}

const {StablePrimaryHandRuntime}=await load('src/app/spatial-primary-hand.ts');
const {StableBimanualPairRuntime}=await load('src/app/spatial-two-hand.ts');
const {SpatialUIController}=await load('src/core/vision/spatial-ui-control.ts');

const left=(x=0.3,pinching=false) => ({
  handedness:'Left',pointerX:x,pointerY:0.45,pinching,score:0.92,
});
const right=(x=0.7,pinching=false) => ({
  handedness:'Right',pointerX:x,pointerY:0.45,pinching,score:0.93,
});

test('primary hand survives frame ordering flips and does not always steal the Right hand',()=>{
 const tracker=new StablePrimaryHandRuntime();
 assert.equal(tracker.update([left()],100).hand?.handedness,'Left');
 assert.equal(tracker.update([right(),left()],220).hand?.handedness,'Left');
 assert.equal(tracker.update([left(),right()],340).hand?.handedness,'Left');
});

test('occlusion blocks stale pinch and a new controlling hand must release before activation',()=>{
 const tracker=new StablePrimaryHandRuntime();
 assert.equal(tracker.update([right(0.7,true)],100).pinchAllowed,true);
 assert.equal(tracker.update([],200).hand,null);
 assert.equal(tracker.update([right(0.7,true)],250).pinchAllowed,false);
 assert.equal(tracker.update([right(0.7,false)],370).pinchAllowed,false);
 assert.equal(tracker.update([right(0.7,true)],490).pinchAllowed,true);
 assert.equal(tracker.update([left(0.3,true)],520).hand,null,'brief occlusion must not switch hand');
 const changed=tracker.update([left(0.3,true)],800);
 assert.equal(changed.switched,true);
 assert.equal(changed.pinchAllowed,false);
 assert.equal(tracker.update([left(0.3,false)],920).pinchAllowed,false);
 assert.equal(tracker.update([left(0.3,true)],1040).pinchAllowed,true);
});

test('invalid primary hand telemetry cannot arm a spatial action',()=>{
 const tracker=new StablePrimaryHandRuntime();
 assert.equal(tracker.update([{...right(),pointerX:NaN}],0).hand,null);
 assert.equal(tracker.update([{...right(),pointerY:5}],200).hand,null);
 assert.equal(tracker.update([right()],300).hand?.handedness,'Right');
 tracker.reset();
 assert.equal(tracker.update([left()],310).hand?.handedness,'Left');
});

test('bimanual transforms start only after stable Left/Right dwell and survive frame ordering',()=>{
 const tracker=new StableBimanualPairRuntime();
 assert.deepEqual(tracker.update([right(),left()],100),[]);
 assert.deepEqual(tracker.update([left(),right()],240),[]);
 assert.deepEqual(tracker.update([right(),left()],300).map(x=>x.handedness),['Left','Right']);
 assert.deepEqual(tracker.update([right(0.78),left(0.26)],420).map(x=>x.handedness),['Left','Right']);
});

test('bimanual jitter, disappearance and large frame gaps disarm transforms',()=>{
 const tracker=new StableBimanualPairRuntime();
 tracker.update([left(),right()],0);
 assert.equal(tracker.update([left(),right()],240).length,2);
 assert.deepEqual(tracker.update([left(0.3),right(0.9)],360),[]);
 assert.deepEqual(tracker.update([left(),right()],500),[]);
 assert.equal(tracker.update([left(),right()],710).length,2);
 assert.deepEqual(tracker.update([left()],830),[]);
 assert.deepEqual(tracker.update([left(),right()],940),[]);
 assert.equal(tracker.update([left(),right()],1140).length,2);
 assert.deepEqual(tracker.update([left(),right()],1700),[],'long frame gap must re-arm');
});

test('bimanual one-hand duplicates and low confidence never arm',()=>{
 const tracker=new StableBimanualPairRuntime();
 assert.deepEqual(tracker.update([left(),left(0.7)],100),[]);
 assert.deepEqual(tracker.update([left(),{...right(),score:0.1}],300),[]);
 assert.deepEqual(tracker.update([left(),right()],500),[]);
});

test('Spatial controller cannot dispatch two activates for concurrent nod and pinch',()=>{
 const control=new SpatialUIController();
 const face={present:true,confidence:0.95,gazeX:0,gazeY:0,yaw:0,pitch:0,calibrationProgress:1};
 const hand={present:true,confidence:0.8,x:0.5,y:0.5,z:0,pinching:false,direct:false};
 const intent={eventId:1,intent:'none',gesture:'None',confidence:0.85,stableMs:100,at:0};
 const targets=[{id:'action',label:'Action',kind:'action',left:0.35,right:0.65,top:0.35,bottom:0.65}];
 control.update({face,hand,gestureIntent:intent,headGesture:'none',targets},100);
 control.update({face,hand,gestureIntent:intent,headGesture:'none',targets},500);
 const events=control.update({face,hand:{...hand,pinching:true},
   gestureIntent:{...intent,intent:'pinch_down',at:550},headGesture:'nod',targets},550).events;
 assert.deepEqual(events.map(e=>e.type),['activate']);
});

test('primary-hand intent derives from the selected hand rather than stale global gesture',()=>{
 const source=readFileSync('src/app/useVisionHandInput.ts','utf8');
 assert.match(source,/StablePrimaryHandRuntime/);
 assert.match(source,/pinching: primaryPinching/);
 assert.match(source,/selection\.pinchAllowed/);
 assert.doesNotMatch(source,/pinching: Boolean\(snapshot\?\.pinching\)/);
});
test('vision updates disable gesture interactions for hidden tabs',()=>{
 const source=readFileSync('src/app/useVisionSpatialRuntime.ts','utf8');
 assert.match(source,/document\.visibilityState === 'hidden'/);
 assert.match(source,/bimanualPairRef\.current\.reset\(\)/);
 assert.match(source,/StableBimanualPairRuntime/);
});
