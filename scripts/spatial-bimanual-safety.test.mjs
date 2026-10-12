import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

const path='src/app/spatial-two-hand.ts';
const src=readFileSync(path,'utf8');
const js=ts.transpileModule(src,{fileName:path,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {selectStableBimanualHands:pair}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

test('bimanual selection is stable under left/right frame ordering changes',()=>{
 const left={handedness:'Left',pointerX:0.3,pointerY:0.45,pinching:true,score:0.9};
 const right={handedness:'Right',pointerX:0.7,pointerY:0.45,pinching:true,score:0.92};
 assert.deepEqual(pair([right,left]).map(x=>x.handedness),['Left','Right']);
 assert.deepEqual(pair([left,right]).map(x=>x.handedness),['Left','Right']);
});

test('two hand input rejects near-zero baseline, duplicate hand and weak confidence',()=>{
 const left={handedness:'Left',pointerX:0.3,pointerY:0.4,pinching:true,score:0.9};
 assert.deepEqual(pair([left,{...left,pointerX:0.31,handedness:'Right'}]),[]);
 assert.deepEqual(pair([left,{...left,pointerX:0.7}]),[]);
 assert.deepEqual(pair([left,{handedness:'Right',pointerX:0.75,pointerY:0.4,pinching:true,score:0.25}]),[]);
 assert.deepEqual(pair([left,{handedness:'Right',pointerX:NaN,pointerY:0.4,pinching:true,score:0.9}]),[]);
});

test('disabled settings overlay cannot receive spatial transforms or selection gestures',()=>{
 const runtime=readFileSync('src/app/useVisionSpatialRuntime.ts','utf8');
 assert.match(runtime,/settingsOpen \|\| roomGestureEligible/);
 assert.match(runtime,/if\(roomGestureEligible\)bimanualPairRef\.current\.reset\(\)/);
 assert.match(runtime,/settingsOpen \? null : applySpatialSelectionGesture\(/);
});

test('both web-camera two-hand transform paths require safe initial separation',()=>{
 for(const p of ['src/app/spatial-window-bimanual.ts','src/app/spatial-object-bimanual.ts']){
  const s=readFileSync(p,'utf8');
  assert.match(s,/geometry.distance < 0.08/);
 }
});

test('modal opening cancels spatial drag sessions without resetting on every render',()=>{
 const source=readFileSync('src/app/useVisionSpatialRuntime.ts','utf8');
 assert.match(source,/if \(!settingsOpen\) return;[\s\S]*?spatialGrabSessionRef.current = null;/);
 assert.match(source,/spatialDepthAnchorRef.current.reset\(\)/);
 assert.match(source,/return \(\) => \{\s*window.clearInterval\(timer\);\s*if \(pendingPrepaint\) window.cancelAnimationFrame\(pendingPrepaint\);/);
});


const orbitPath='src/core/vision/spatial-room-gesture.ts';
const orbitSource=readFileSync(orbitPath,'utf8');
const orbitJs=ts.transpileModule(orbitSource,{fileName:orbitPath,
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {RoomGestureOrbit}=await import('data:text/javascript;base64,'+
 Buffer.from(orbitJs).toString('base64'));

const palm=(x=.4,y=.5)=>({handedness:'Right',score:.91,pinching:false,
 gesture:'Open_Palm',pointerX:x,pointerY:y});
const pinch=(handedness,x,y=.5)=>({handedness,score:.91,pinching:true,
 gesture:'Closed_Fist',pointerX:x,pointerY:y});
const steer=(controller,hands,at,enabled=true,now=at+35)=>
 controller.update({hands,now,frameAt:at,enabled});

test('one palm requires 240ms continuous fresh tracking before rotating the room',()=>{
 const c=new RoomGestureOrbit();
 assert.equal(steer(c,[palm()],100),null);
 assert.equal(steer(c,[palm(.41)],220),null);
 assert.equal(steer(c,[palm(.42)],330),null);
 const motion=steer(c,[palm(.49,.53)],450);
 assert.equal(motion?.mode,'rotate');
 assert.ok(motion.yawDelta>0 && motion.yawDelta<=.07);
 assert.ok(Math.abs(motion.pitchDelta)<=.055);
 assert.equal(motion.zoomFactor,1);
 // 120ms UI polls must not replay one MediaPipe observation.
 assert.equal(steer(c,[palm(.57)],450),null);
});

test('two genuine pinched hands zoom only after dwell with stable handedness',()=>{
 const c=new RoomGestureOrbit();
 const a=[pinch('Left',.25),pinch('Right',.7)];
 assert.equal(steer(c,a,100),null);
 assert.equal(steer(c,a.slice().reverse(),220),null);
 assert.equal(steer(c,a,340),null);
 const r=steer(c,[pinch('Left',.21),pinch('Right',.74)],460);
 assert.equal(r?.mode,'zoom');
 assert.ok(r.zoomFactor>1 && r.zoomFactor<=1.08);
 assert.equal(r.yawDelta,0);
 assert.equal(r.pitchDelta,0);
});

test('hand gesture rejects stale, duplicated, low-confidence and extreme jumps',()=>{
 const c=new RoomGestureOrbit();
 assert.equal(steer(c,[palm()],100),null);
 assert.equal(steer(c,[palm(.5)],220,false),null);
 assert.equal(steer(c,[palm(.51)],460),null);
 assert.equal(steer(c,[palm(.51)],700),null);
 assert.equal(steer(c,[{...palm(.52),score:.4}],820),null);
 assert.equal(steer(c,[palm(.51)],940),null);
 assert.equal(steer(c,[palm(.51)],1180),null);
 // Sudden jump is treated as unreliable tracking, not a giant camera spin.
 assert.equal(steer(c,[palm(.91)],1300),null);
 assert.equal(steer(c,[palm(.92)],1301,true,1800),null); // expired frame
 assert.equal(steer(c,[palm(.92)],1400),null);
 assert.equal(steer(c,[{...palm(.92),pointerX:NaN}],1600),null);
});

test('gesture controls never consume window/object interactions or shell commands',()=>{
 const hooks=readFileSync('src/app/useVisionSpatialRuntime.ts','utf8');
 const room=readFileSync('src/presence/PhotorealRoom3D.tsx','utf8');
 assert.match(hooks,/!spatialFrameNext\.focus/);
 assert.match(hooks,/!spatialFrameNext\.grabbing/);
 assert.match(hooks,/spatialFrameNext\.events\.length===0/);
 assert.match(hooks,/roomGestureRef\.current\.reset\(\)/);
 assert.match(hooks,/Exclusive gesture ownership/);
 assert.match(hooks,/new CustomEvent\('mira:room-gesture'/);
 assert.match(room,/moveRoomCamera\(\{x:c\.x,z:c\.z\}/);
 assert.match(room,/window\.removeEventListener\('mira:room-gesture'/);
 assert.doesNotMatch(orbitSource,/fetch\(|\.click\(|subprocess|localStorage/);
});
