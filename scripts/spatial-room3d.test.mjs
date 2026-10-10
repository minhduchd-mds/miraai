import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isRoomWalkable,moveRoomCamera,ROOM_OBSTACLES} from '../src/presence/room-navigation.ts';

const room=readFileSync('src/presence/PhotorealRoom3D.tsx','utf8');
const vrm=readFileSync('src/presence/RoomMiraVRM.tsx','utf8');
const luxury=readFileSync('src/presence/RoomLuxuryInterior.tsx','utf8');
const integration=readFileSync('src/presence/PhotorealMira.tsx','utf8');
const css=readFileSync('src/presence/photoreal-mira.css','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));

test('room contains independently modeled curved furniture instead of coarse boxes',()=>{
 for(const required of ['RoundedBoxGeometry','meshPhysicalMaterial','RoomLighting',
   'SofaSet','BedSet','CityWindow','WardrobeSet','MiraChairSet',
   'torusGeometry','clearcoat','shadow-mapSize']) {
   assert.ok(luxury.includes(required),'Missing 3D feature '+required);
 }
 assert.match(luxury,/new THREE.PlaneGeometry\(2\.78,2\.75,22,20\)/);
 assert.match(luxury,/meshPhysicalMaterial color="#b7d6e7" transparent/);
 assert.doesNotMatch(room,/MiraPortrait|mira_concept_portrait|mira_concept_front/);
 assert.doesNotMatch(room,/pm-room3d-reference|referenceView|<img/);
});

test('existing rigged 3D Mira model is loaded without an alpha-masked portrait',()=>{
 assert.match(room,/lazy\(\(\) => import\('\.\/RoomMiraVRM'\)\)/);
 assert.match(room,/<RoomMiraVRM state=\{state\} onReady=\{sceneReady\}/);
 assert.match(vrm,/mira_female_04_soft_rose\.vrm/);
 assert.match(vrm,/VRMLoaderPlugin/);
 assert.match(vrm,/seatedPose\(vrm\)/);
 assert.match(vrm,/getNormalizedBoneNode/);
 assert.match(vrm,/vrm\.scene\.rotation\.y=source\.mode==='preview'\?Math\.PI:0/);
 assert.doesNotMatch(vrm,/TextureLoader|\.webp|<planeGeometry/);
 assert.match(vrm,/VRMUtils\.deepDispose/);
 assert.ok(pkg.dependencies['@pixiv/three-vrm']);
});

test('real room is the default for capable desktops, opt-out and motion gates remain',()=>{
 assert.match(integration,/get\('room3d'\)/);
 assert.match(integration,/window\.innerWidth >= 1024/);
 assert.match(integration,/room3DPreference !== '0'/);
 assert.match(integration,/!reducedMotion/);
 assert.match(integration,/visualQuality !== 'lite'/);
 assert.match(integration,/!Boolean\(connection\?\.saveData\)/);
 assert.match(integration,/data-room3d-active/);
 assert.match(integration,/!spatial3DEnabled && !room3DActive/);
 assert.match(css,/\.photo-mira\[data-room3d-active="true"\] \.pm-scene-fallback/);
 assert.doesNotMatch(css,/\.pm-room3d-reference\.is-visible/);
});

test('camera supports 360 orbit and genuine translation without stealing chat keystrokes',()=>{
 for(const token of ['onPointerDown={pointerDown}','onPointerMove={pointerMove}',
    'setPointerCapture','controls.current.yaw','controls.current.pitch','KeyW','KeyA','KeyS','KeyD',
    'camera.position.set(v.x,1.77,v.z)','camera.rotation.set(v.pitch,v.yaw,0',
    'moveRoomCamera({x:v.x,z:v.z}','closest(\'input,textarea,select','Digit([1-5])',
    'window.removeEventListener(\'keydown\',keydown)']) {
    assert.ok(room.includes(token),'Missing camera part '+token);
 }
 assert.match(room,/frameloop="demand"/);
 assert.match(room,/dpr=\{\[1,1\.5\]\}/);
 assert.match(room,/<Canvas frameloop="demand" shadows/);
 assert.match(room,/ACESFilmicToneMapping/);
 assert.match(room,/powerPreference:'high-performance'/);
});

test('VRM callback does not retrigger loader from normal React rerenders',()=>{
 assert.match(vrm,/const callback = useRef\(onReady\)/);
 assert.match(vrm,/callback\.current=onReady/);
 assert.match(vrm,/\},\[invalidate,allowPreview,allowReview\]\);/);
 assert.doesNotMatch(vrm,/\[invalidate,onReady\]/);
});

test('real 3D scene never gets covered by legacy 2D character or expression sprite',()=>{
 assert.match(integration,/presenceVisual\.character && !room3DActive/);
 assert.match(integration,/showExpressionReaction && !room3DActive/);
});

test('3D hero contains a spatial upholstered chair and a close foreground seated VRM',()=>{
 assert.match(luxury,/function MiraChairSet/);
 assert.match(luxury,/<MiraChairSet\/>/);
 assert.match(vrm,/position=\{avatar\.position\} scale=\{avatar\.scale\}/);
 assert.match(css,/\.photo-mira\[data-room3d-active="true"\] \.pm-hero-copy/);
});

test('3D mode removes HUD, gallery and copy; AppV2 voice footer remains unchanged',()=>{
 assert.doesNotMatch(room,/pm-room3d-hud|pm-room3d-gallery|setViewPreset/);
 assert.match(room,/Digit\(\[1-5\]\)/);
 assert.match(integration,/!room3DActive && <span\s+key=\{`hero-/);
 assert.match(integration,/!room3DActive && <span className="pm-live-pill"/);
 assert.match(integration,/!room3DActive && <span className="pm-wave"/);
 const app=readFileSync('src/app/AppV2.tsx','utf8');
 assert.match(app,/voice-footer state-\$\{mira\.state\}/);
 assert.match(app,/className="voice-control-dock"/);
 assert.match(app,/className="voice-session-caption"/);
});
test('Mira seated pose, foreground composition and chair plush are present',()=>{
 assert.match(vrm,/rotate\('leftLowerArm', -\.90,/);
 assert.match(vrm,/vrm\.expressionManager\?\.setValue\('happy',\.22\)/);
 assert.match(vrm,/position=\{avatar\.position\} scale=\{avatar\.scale\}/);
 assert.match(luxury,/Soft key light at the avatar face/);
 assert.match(luxury,/Smiling companion plush/);
});

test('active room3d does not mount duplicate 2D scene, spatial gizmos or text overlays',()=>{
 const app=readFileSync('src/app/AppV2.tsx','utf8');
 assert.match(app,/voice-footer state-\$\{mira\.state\}/);
 assert.match(integration,/!room3DActive && <img[\s\S]*?pm-bedroom-scene pm-scene-fallback/);
 assert.doesNotMatch(css,/\.pm-room3d-hud|\.pm-room3d-gallery/);
 assert.match(integration,/!room3DActive && <span[\s\S]{0,70}pm-state-orb/);
 assert.match(integration,/showAffectionFx && !room3DActive/);
 assert.match(integration,/state === 'listening' && !room3DActive/);
});
test('VRM reference styling only touches named garment or hair material slots',()=>{
 assert.match(vrm,/adaptReferencePalette\(vrm\)/);
 assert.match(vrm,/hair\|fringe\|bangs/);
 assert.match(vrm,/cardigan\|sweater\|knit/);
 assert.match(luxury,/position=\{\[\.32,2\.51,3\.56\]\}/);
});

test('Realistic avatar is the default and stylized VRM is explicitly debug-only',()=>{
 const source=readFileSync('src/presence/realistic-avatar-source.ts','utf8');
 const loader=readFileSync('src/presence/RoomMiraVRM.tsx','utf8');
 assert.match(source,/chooseRoomAvatar/);
 assert.match(source,/allowStylizedPreview=false/);
 assert.match(loader,/get\('avatarPreview'\)==='1'/);
 assert.match(loader,/chooseRoomAvatar\(manifest,\{allowStylizedPreview:allowPreview,allowStagedRealisticReview:allowReview\}\)/);
 assert.match(loader,/validateRealisticHumanScene\(gltf\.scene\)/);
 assert.match(loader,/source.mode==='realistic'&&allowPreview/);
 assert.match(loader,/realistic-human-not-yet-approved/);
});

test('3D input ignores editable fields and modifiers, clears held keys on tab hiding, and releases pointer capture',()=>{
 assert.match(room,/closest\('input,textarea,select,\[contenteditable\]/);
 assert.match(room,/\[role="textbox"\],\[role="combobox"\]/);
 assert.match(room,/event\.altKey\|\|event\.ctrlKey\|\|event\.metaKey/);
 assert.match(room,/document\.addEventListener\('visibilitychange',visibility\)/);
 assert.match(room,/document\.removeEventListener\('visibilitychange',visibility\)/);
 assert.match(room,/releasePointerCapture\(event\.pointerId\)/);
});

test('room navigation footprints block existing furniture without closing the usable aisle',()=>{
 assert.ok(ROOM_OBSTACLES.length>=6);
 for(const [x,z] of [
   [0,-3],[-3,1],[1.4,-3],[4.3,-3],[0,1.5],[0,3.1]
 ])assert.equal(isRoomWalkable(x,z),false,'Furniture footprint should block '+x+','+z);
 for(const [x,z] of [
   [0,4.79],[-2.9,4.1],[2.9,4.1],[0,0],[0,5.48]
 ])assert.equal(isRoomWalkable(x,z),true,'Walkable preset/aisle '+x+','+z);
 for(const [x,z] of [[NaN,0],[Infinity,0],[0,-6],[5.1,0]])
   assert.equal(isRoomWalkable(x,z),false);
});

test('room camera collision prevents walking through the enlarged lounge beanbag',()=>{
 let position={x:0,z:4.79};
 for(let i=0;i<100;i++){
   position=moveRoomCamera(position,0,1,0,.06);
   assert.equal(isRoomWalkable(position.x,position.z),true);
 }
 assert.ok(position.z>=3.4&&position.z<4.79,'Walk should stop in front of lounge chair: '+position.z);
});

test('room movement normalizes diagonals, caps frame stalls and rejects corrupt inputs',()=>{
 const at={x:3.2,z:4.7};
 const straight=moveRoomCamera(at,0,1,0,.06);
 const diagonal=moveRoomCamera(at,0,1,1,.06);
 const length=(p)=>Math.hypot(p.x-at.x,p.z-at.z);
 assert.ok(Math.abs(length(straight)-length(diagonal))<1e-8);
 assert.deepEqual(moveRoomCamera(at,0,1,0,100),straight);
 assert.deepEqual(moveRoomCamera(at,NaN,1,0,.06),at);
 assert.deepEqual(moveRoomCamera(at,0,1,0,Infinity),at);
 assert.deepEqual(moveRoomCamera({x:0,z:3},0,1,0,.06),{x:0,z:3});
});

test('camera keyboard handling requires a focused 3D region with cleanup',()=>{
 assert.match(room,/document\.activeElement===stageRef\.current\?\.closest\('button\.photo-mira'\)/);
 assert.doesNotMatch(room,/className="pm-room3d-stage" tabIndex=\{0\}/);
 assert.match(room,/closest<HTMLButtonElement>\('button\.photo-mira'\)/);
 assert.match(room,/\.focus\(\{preventScroll:true\}\)/);
 assert.match(room,/document\.addEventListener\('pointerdown',outsidePointer,true\)/);
 assert.match(room,/document\.removeEventListener\('pointerdown',outsidePointer,true\)/);
 assert.match(room,/onLostPointerCapture=\{pointerEnd\}/);
});

test('WebGL loss restores the existing accessible scene instead of leaving a blank frame',()=>{
 assert.match(room,/gl\.domElement\.addEventListener\('webglcontextlost',contextLost/);
 assert.match(room,/gl\.domElement\.removeEventListener\('webglcontextlost',contextLost\)/);
 assert.match(room,/event\.preventDefault\(\);\s*onFailureRef\.current\(\)/);
 assert.match(room,/useEffect\(\(\)=>\(\)=>detachWebGLRef\.current\(\),\[\]\)/);
 assert.match(integration,/onFailure=\{\(\) => \{setRoom3DFailed\(true\);setRoom3DReady\(false\);\}\}/);
});

test('3D stage reuses its parent button focus and cannot create nested tab stops',()=>{
 assert.match(integration,/<button\s+ref=\{rootRef\}/);
 assert.match(room,/className="pm-room3d-stage" data-avatar-status/);
 assert.doesNotMatch(room,/className="pm-room3d-stage" tabIndex/);
 assert.doesNotMatch(room,/role="region"/);
 assert.match(room,/closest<HTMLButtonElement>\('button\.photo-mira'\)/);
});

test('full-room composition has no foreground or background computer desks',()=>{
 assert.doesNotMatch(luxury,/<MarbleDeskSet\/>|<WorkspaceSet\/>/);
 assert.doesNotMatch(luxury,/function MarbleDeskSet\(|function WorkspaceSet\(/);
 assert.match(luxury,/name="mira-indoor-lounge"/);
 assert.match(luxury,/circleGeometry args=\{\[2\.1,64\]\}/);
 assert.match(luxury,/mira-indoor-lounge[\s\S]*?sphereGeometry/);
 const source=readFileSync('src/presence/realistic-avatar-source.ts','utf8');
 assert.match(source,/position:\[0,-\.48,1\.92\]/);
 assert.match(vrm,/position=\{avatar\.position\} scale=\{avatar\.scale\}/);
 assert.match(room,/pitch:-\.05,x:0,z:4\.30/);
 assert.match(room,/position:\[0,1\.77,4\.30\]/);
 assert.ok(!ROOM_OBSTACLES.some(o=>o.id==='marble-desk'||o.id==='workspace'));
 assert.ok(ROOM_OBSTACLES.find(o=>o.id==='mira-chair').maxZ>=3.18);
});

test('preview human seated pose bends knees toward the viewer instead of inside the chair',()=>{
 for(const side of ['left','right']){
  assert.ok(vrm.includes("rotate('"+side+"UpperLeg', 1.12, 0,"),
    side+' thigh must extend forward after room-facing PI rotation');
  assert.ok(vrm.includes("rotate('"+side+"LowerLeg', -1.34, 0, 0)"),
    side+' shin must drop beneath the knee');
 }
 assert.match(vrm,/vrm\.scene\.rotation\.y=source\.mode==='preview'\?Math\.PI:0/);
});
