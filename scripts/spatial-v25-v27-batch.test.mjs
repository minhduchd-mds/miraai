import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {readFileSync} from 'node:fs';

const geometryStub=[
 'const clampSpatial=(v,lo,hi)=>Math.max(lo,Math.min(hi,Number.isFinite(v)?v:0));',
 "const spatialWindowAvailable=(id)=>id==='camera'||id==='result';",
 "const spatialObjectAvailable=(id)=>id==='obj'||id==='a';",
 'const collectSpatialWorldAnchors=()=>[];',
 'const measureTwoHands=(a,b)=>({distance:Math.hypot(b.x-a.x,b.y-a.y),angleDeg:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI,center:{x:(a.x+b.x)/2,y:(a.y+b.y)/2}});',
 'const scaleFromDistance=(base,d0,d,lo,hi)=>clampSpatial(base*d/d0,lo,hi);',
 'const rotationFromAngles=(base,a0,a,lo,hi)=>clampSpatial(base+a-a0,lo,hi);',
 'const smoothValue=(a,b,alpha)=>a+(b-a)*alpha;',
 'const beginSpatialGroupTransform=()=>({fixture:true});',
 'const applySpatialGroupTransform=()=>({});',
].join('\n');
async function load(path){
 const js=ts.transpileModule(readFileSync(path,'utf8'),{
   fileName:path,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},
 }).outputText.replace(/import\s+\{[\s\S]*?\}\s+from\s+['"][^'"]+['"];\s*/g,'');
 assert.doesNotMatch(js,/^import\s/m);
 return import('data:text/javascript;base64,'+Buffer.from(geometryStub+js).toString('base64'));
}
const {updateSpatialWindowBimanual}=await load('src/app/spatial-window-bimanual.ts');
const {updateSpatialObjectBimanual}=await load('src/app/spatial-object-bimanual.ts');
const {handleSpatialWindowControl}=await load('src/app/spatial-window-control.ts');
const pair=(x=.7)=>[
 {handedness:'Left',pointerX:.3,pointerY:.5,pinching:true,score:.95},
 {handedness:'Right',pointerX:x,pointerY:.5,pinching:true,score:.95},
];
const transform=()=>({x:0,y:0,z:0,scale:1,rotation:0});

test('v25: window two-hand dwell and transform require a new inference frame',()=>{
 const sessionRef={current:null},windowsRef={current:{camera:transform(),result:transform()}};
 let writes=0,feedback=0;
 const call=(now,frameAt,hand=pair())=>updateSpatialWindowBimanual({
  pinchedHands:hand,focus:{id:'camera',kind:'window'},lastWindowId:'camera',
  now,frameAt,sessionRef,windowsRef,
  updateWindow:(id,fn)=>{writes++;windowsRef.current[id]=fn(windowsRef.current[id]);},
  showFeedback:()=>{feedback++;},
 });
 call(100,100);
 for(const now of [240,420,1200])call(now,100);
 assert.equal(sessionRef.current.active,false);
 assert.equal(writes,0);
 call(1250,200);assert.equal(sessionRef.current.active,false);
 call(1350,350);assert.equal(sessionRef.current.active,true);
 assert.equal(feedback,1);
 call(1400,400,pair(.85));
 assert.equal(writes,1);
 const after=windowsRef.current.camera.scale;
 call(1500,400,pair(.85));
 assert.equal(writes,1);assert.equal(windowsRef.current.camera.scale,after);
 call(1510,0,[]);assert.equal(sessionRef.current,null);
});
function objectFixture(group=false){
 const objectSessionRef={current:null},groupTransformRef={current:null},jointControlRef={current:null};
 let writes=0,feedback=0;
 const objectRuntime={
   get:()=>({pose:{scale:1,rotation:0}}),snapshot:()=>[],
   applyTransform:()=>{writes++;},setPose:()=>{writes++;},
 };
 const worldRuntime={
  clusterRootObjectId:id=>id,attachment:()=>null,clusterObjectIds:()=>['obj'],
  setAnchors:()=>{},detachObject:()=>{},resolveObjectPose:()=>null,
 };
 const jointRuntime={findForChild:()=>null,removeForChild:()=>{}};
 const call=(now,frameAt,hand=pair())=>updateSpatialObjectBimanual({
  pinchedHands:hand,focusObjectId:group?'a':'obj',now,frameAt,
  objectRuntime,worldRuntime,physicsRuntime:{stop:()=>({})},jointRuntime,
  selectionRuntime:{snapshot:()=>group?['a','b']:[]},
  groupTransformRef,objectSessionRef,jointControlRef,
  setPhysicsState:()=>{},setSpatialObjects:()=>{writes++;},
  showFeedback:()=>{feedback++;},
 });
 return {call,objectSessionRef,groupTransformRef,stats:()=>({writes,feedback})};
}
test('v26: single object transform cannot mature on repeated UI polls',()=>{
 const o=objectFixture();
 o.call(100,100);o.call(500,100);
 assert.equal(o.objectSessionRef.current.active,false);
 o.call(600,220);assert.equal(o.objectSessionRef.current.active,false);
 o.call(700,350);assert.equal(o.objectSessionRef.current.active,true);
 o.call(800,400,pair(.85));
 const writes=o.stats().writes;assert.ok(writes>0);
 o.call(1000,400,pair(.85));assert.equal(o.stats().writes,writes);
 o.call(1010,0,[]);assert.equal(o.objectSessionRef.current,null);
});
test('v26: group transform cannot mature or repeat on cached frames',()=>{
 const g=objectFixture(true);
 g.call(100,100);
 for(const now of [300,800,1400])g.call(now,100);
 assert.equal(g.groupTransformRef.current.active,false);
 g.call(1500,220);g.call(1600,360);
 assert.equal(g.groupTransformRef.current.active,true);
 const before=g.stats().writes;
 g.call(1650,400,pair(.85));assert.ok(g.stats().writes>before);
 const after=g.stats().writes;
 g.call(1700,400,pair(.85));assert.equal(g.stats().writes,after);
});
test('v27: window movement eases, clamps and stops on grab end',()=>{
 const grabSessionRef={current:null},windowsRef={current:{camera:transform(),result:transform()}};
 const depthRuntime={begin:()=>{},update:()=>({ready:false}),end:()=>{},reset:()=>{}};
 const lastWindowRef={current:'camera'},twoHandSessionRef={current:null},headRef={current:0};
 let writes=0;
 const call=(type,x)=>handleSpatialWindowControl({
  event:{type,targetId:'camera',targetKind:'window',source:'hand',
   point:{x,y:.5,z:0}},twoHandsActive:false,now:100,
  grabSessionRef,depthRuntime,windowsRef,lastWindowRef,twoHandSessionRef,
  spatialHeadConsumedAtRef:headRef,
  updateWindow:(id,fn)=>{writes++;windowsRef.current[id]=fn(windowsRef.current[id]);},
  showFeedback:()=>{},
 });
 globalThis.window={innerWidth:1000,innerHeight:800};
 try{
  assert.equal(call('grab_start',.5),true);
  call('grab_move',.6);
  const first=windowsRef.current.camera.x;
  assert.ok(first>0 && first<142);
  call('grab_move',.6);assert.ok(windowsRef.current.camera.x>first);
  call('grab_move',10);assert.ok(Math.abs(windowsRef.current.camera.x)<=560);
  const count=writes;
  call('grab_end',10);assert.equal(grabSessionRef.current,null);
  call('grab_move',10);assert.equal(writes,count);
 }finally{delete globalThis.window;}
});
test('v27: frame timestamp routed to window and object transforms',()=>{
 const hook=readFileSync('src/app/useVisionSpatialRuntime.ts','utf8');
 assert.equal((hook.match(/frameAt: handFrameAt/g)||[]).length,2);
 assert.match(hook,/document.visibilityState === 'hidden'/);
 assert.match(hook,/if \(!settingsOpen\) return/);
 for(const file of ['src/app/spatial-window-bimanual.ts','src/app/spatial-object-bimanual.ts']){
   const src=readFileSync(file,'utf8');
   assert.match(src,/lastSampleAt/);
   assert.match(src,/frameAt <=/);
   assert.match(src,/frameAt - .*\.since >= 240/);
 }
});
