import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const tsSource=readFileSync('src/presence/spatial-scene-depth.ts','utf8');
const js=ts.transpileModule(tsSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const depth=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const policySource=readFileSync('src/presence/spatial-scene-policy.ts','utf8');
const policyJS=ts.transpileModule(policySource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const policy=await import('data:text/javascript;base64,'+Buffer.from(policyJS).toString('base64'));
const spatial={...depth,...policy};
const scenes=['daytime','welcome-home','home-evening','bedtime'];

test('all four real Mira background photos have authored, stable relief depth',()=>{
 for(const scene of scenes){
  const background=spatial.sceneDepthAt(scene,.02,.96);
  const subject=spatial.sceneDepthAt(scene,.5,.5);
  const foreground=spatial.sceneDepthAt(scene,.5,.08);
  assert.ok(background<subject,scene+' middle is nearer than far backdrop');
  assert.ok(foreground>background,scene+' foreground is nearer than backdrop');
  assert.ok([background,subject,foreground].every(v=>v>=.08&&v<=.96&&Number.isFinite(v)));
  for(const u of [-9,0,.2,.7,1,99])for(const v of [-12,0,.2,.7,1,99])
   assert.ok(Number.isFinite(spatial.sceneDepthAt(scene,u,v)));
 }
});

test('3D stage is gated by visual quality, performance, accessibility and bandwidth',()=>{
 const defaults={quality:'ultra',performance:'full',reducedMotion:false,saveData:false,viewportWidth:1366,override:'auto'};
 assert.equal(spatial.shouldUseSpatial3D(defaults),true);
 assert.equal(spatial.shouldUseSpatial3D({...defaults,quality:'high'}),true);
 assert.equal(spatial.shouldUseSpatial3D({...defaults,quality:'balanced'}),false);
 assert.equal(spatial.shouldUseSpatial3D({...defaults,quality:'high',viewportWidth:390}),false);
 assert.equal(spatial.shouldUseSpatial3D({...defaults,quality:'balanced',override:'on'}),true);
 for(const changed of [{quality:'lite'},{performance:'reduced'},{performance:'minimal'},
  {reducedMotion:true},{saveData:true},{override:'off'}])
  assert.equal(spatial.shouldUseSpatial3D({...defaults,...changed}),false,JSON.stringify(changed));
 assert.equal(spatial.resolveSpatial3DOverride('?spatial3d=1'),'on');
 assert.equal(spatial.resolveSpatial3DOverride('?foo=x&spatial3d=0'),'off');
 assert.equal(spatial.resolveSpatial3DOverride('?foo=x'),'auto');
});

test('head pose and pointer drive a bounded perspective camera',()=>{
 const a=spatial.spatialCameraTarget(1,-1,.8,.7);
 const b=spatial.spatialCameraTarget(-1,1,-.8,-.7);
 assert.ok(a.x>b.x&&a.y>b.y);
 assert.ok(a.x<=.42&&a.y<=.26);
 assert.ok(b.x>=-.42&&b.y>=-.26);
});

test('spatial 3D runtime stays lazy and does not double mount WebGL renderers',()=>{
 const app=readFileSync('src/app/AppV2.tsx','utf8');
 assert.match(app,/const PhotorealMira = lazy\(\(\) => import\('\.\.\/presence\/PhotorealMira'\)\)/);
 assert.match(app,/<Suspense fallback=\{<div className="voice-presence-loading"/);
 const root=readFileSync('src/presence/PhotorealMira.tsx','utf8');
 const scene=readFileSync('src/presence/PhotorealSpatial3D.tsx','utf8');
 const css=readFileSync('src/presence/photoreal-mira.css','utf8');
 assert.match(root,/lazy\(\(\) => import\('\.\/PhotorealSpatial3D'\)\)/);
 assert.match(root,/visualProfile\.sharpness > 0 && !spatial3DEnabled/);
 assert.match(root,/!spatial3DEnabled && !room3DActive && presenceScene === 'bedtime'/);
 assert.match(root,/data-spatial3d-ready/);
 assert.match(root,/registerInvalidate=\{registerSpatialInvalidator\}/);
 assert.match(scene,/frameloop="demand"/);
 assert.match(scene,/new THREE\.PlaneGeometry\(18,10,64,40\)/);
 assert.match(scene,/camera\.lookAt\(0,0,0\)/);
 assert.match(scene,/SpatialErrorBoundary/);
 assert.match(css,/\.photo-mira\.scene-bedtime\[data-visual-quality="high"\] \.pm-depth-mid/);
 assert.match(css,/\[data-spatial3d-ready="true"\]/);
 assert.doesNotMatch(readFileSync('package.json','utf8'),/"aframe":/);
});
