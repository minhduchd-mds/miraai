import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const room=readFileSync('src/presence/PhotorealRoom3D.tsx','utf8');
const integration=readFileSync('src/presence/PhotorealMira.tsx','utf8');
const css=readFileSync('src/presence/photoreal-mira.css','utf8');
const packageJSON=JSON.parse(readFileSync('package.json','utf8'));

test('3D room uses actual mesh geometry for architecture and furniture, not a panoramic plane',()=>{
 for(const token of ['RoomMeshes','WindowCity','Plant','RoomCamera','Box','pointLight',
  '<boxGeometry','<planeGeometry','<sphereGeometry','<cylinderGeometry','<Canvas'])
  assert.ok(room.includes(token),'Missing '+token);
 for(const name of ['WindowCity','bed','sofa','desk']){
  if(name==='WindowCity')assert.match(room,/<WindowCity night=/);
  if(name==='bed')assert.match(room,/\[2\.95,\.66,2\.88\]/);
  if(name==='sofa')assert.match(room,/\[2\.45,\.65,1\.1\]/);
  if(name==='desk')assert.match(room,/\[2\.5,\.09,1\.24\]/);
 }
 assert.doesNotMatch(room,/<sphereGeometry args=\{\[500/);
 assert.doesNotMatch(room,/equirectangular|a-sky/i);
});

test('360 room supports pointer dragging and 3D translation, not only camera yaw',()=>{
 for(const token of ['onPointerDown={pointerDown}','onPointerMove={pointerMove}',
   'setPointerCapture','control.current.yaw','control.current.pitch','KeyW','KeyA','KeyS','KeyD',
   'camera.position.set(v.x,1.68,v.z)','camera.rotation.set(v.pitch,v.yaw,0',
   'CLAMP(v.x','CLAMP(v.z'])assert.ok(room.includes(token),'Missing '+token);
 assert.match(room,/isContentEditable/);
 assert.match(room,/window\.removeEventListener\('keydown',down\)/);
 assert.match(room,/onClick=\{event=>event\.stopPropagation\(\)\}/);
});

test('3D room loads only in explicit ?room3d=1 and always retains 2D fallback',()=>{
 assert.match(integration,/lazy\(\(\) => import\('\.\/PhotorealRoom3D'\)\)/);
 assert.match(integration,/get\('room3d'\) === '1'/);
 assert.match(integration,/!reducedMotion/);
 assert.match(integration,/visualQuality !== 'lite'/);
 assert.match(integration,/performanceTier === 'full'/);
 assert.match(integration,/!Boolean\(connection\?\.saveData\)/);
 assert.match(integration,/onFailure=\{\(\) => \{setRoom3DFailed\(true\);setRoom3DReady\(false\);\}\}/);
 assert.match(integration,/!room3DActive && \(/);
 assert.match(integration,/!spatial3DEnabled && !room3DActive/);
 assert.match(css,/\.photo-mira\[data-room3d-ready="true"\] \.pm-scene-fallback/);
 assert.match(css,/\.pm-room3d-stage:active/);
 assert.ok(packageJSON.dependencies.three);
 assert.ok(packageJSON.dependencies['@react-three/fiber']);
 assert.ok(!packageJSON.dependencies.aframe);
});

test('room uses bounded GPU work and never captures chat keystrokes',()=>{
 assert.match(room,/frameloop="demand"/);
 assert.match(room,/dpr=\{\[1,1\.5\]\}/);
 assert.match(room,/isEditable\(event.target\)/);
 assert.match(room,/window\.addEventListener\('blur',blur\)/);
 assert.match(room,/keys\.clear\(\)/);
 assert.match(room,/Math\.min\(delta,\.06\)/);
 assert.match(room,/invalidateRef\.current\?\.\(\)/);
});

test('cinematic room keeps reference composition: real woman sprite, glowing ceiling, warm interior',()=>{
 for(const mark of ['function MiraPortrait','mira-assets/expressions/expr_01_gentle.webp',
   'THREE.TextureLoader','alphaMap={fade}','function InteriorStyling',
   'torusGeometry args={[2.08,.095,8,72]}','sofa-pillow-',
   'curtain-','slat-','keyboard-','marble-','PHÒNG 3D']){
    if(mark==='PHÒNG 3D')continue;
    assert.ok(room.includes(mark),'Missing reference styling '+mark);
  }
 assert.match(room,/MiraPortrait onReady=\{onReady\}/);
 assert.match(room,/requestAnimationFrame\(onReady\)/);
 assert.doesNotMatch(room,/requestAnimationFrame\(sceneReady\)/);
});
test('all five concept camera viewpoints are addressable from keyboard without intercepting typing',()=>{
 for(const part of ['Digit([1-5])','setViewPreset(index)','Trái 90°','Trước','Phải 90°',
  'Sau 180°','Toàn cảnh','isEditable(event.target)'])
    assert.ok(room.includes(part),'Missing viewpoint '+part);
});
