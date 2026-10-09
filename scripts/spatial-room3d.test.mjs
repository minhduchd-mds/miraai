import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const room=readFileSync('src/presence/PhotorealRoom3D.tsx','utf8');
const vrm=readFileSync('src/presence/RoomMiraVRM.tsx','utf8');
const luxury=readFileSync('src/presence/RoomLuxuryInterior.tsx','utf8');
const integration=readFileSync('src/presence/PhotorealMira.tsx','utf8');
const css=readFileSync('src/presence/photoreal-mira.css','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));

test('room contains independently modeled curved furniture instead of coarse boxes',()=>{
 for(const required of ['RoundedBoxGeometry','meshPhysicalMaterial','RoomLighting',
   'SofaSet','BedSet','CityWindow','WorkspaceSet','WardrobeSet','MarbleDeskSet',
   'torusGeometry','clearcoat','THREE.CanvasTexture','shadow-mapSize']) {
   assert.ok(luxury.includes(required),'Missing 3D feature '+required);
 }
 assert.match(luxury,/new THREE.PlaneGeometry\(2\.78,2\.75,22,20\)/);
 assert.match(luxury,/meshPhysicalMaterial color="#b7d6e7" transparent/);
 assert.doesNotMatch(room,/MiraPortrait|mira_concept_portrait|mira_concept_front/);
 assert.doesNotMatch(room,/pm-room3d-reference|referenceView|<img/);
});

test('existing rigged 3D Mira model is loaded without an alpha-masked portrait',()=>{
 assert.match(room,/lazy\(\(\) => import\('\.\/RoomMiraVRM'\)\)/);
 assert.match(room,/<RoomMiraVRM onReady=\{sceneReady\}/);
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
    'CLAMP(v.x','CLAMP(v.z','isContentEditable','Digit([1-5])',
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
 assert.match(vrm,/\},\[invalidate\]\);/);
 assert.doesNotMatch(vrm,/\[invalidate,onReady\]/);
});

test('real 3D scene never gets covered by legacy 2D character or expression sprite',()=>{
 assert.match(integration,/presenceVisual\.character && !room3DActive/);
 assert.match(integration,/showExpressionReaction && !room3DActive/);
});

test('3D hero contains a spatial upholstered chair and a close foreground seated VRM',()=>{
 assert.match(luxury,/function MiraChairSet/);
 assert.match(luxury,/<MiraChairSet\/>/);
 assert.match(vrm,/position=\{\[0,\.17,2\.28\]\} scale=\{1\.55\}/);
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
 assert.match(vrm,/position=\{\[0,\.17,2\.28\]\} scale=\{1\.55\}/);
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
 assert.match(loader,/chooseRoomAvatar\(manifest,\{allowStylizedPreview:allowPreview\}\)/);
 assert.match(loader,/acceptedPBRGLB/);
 assert.match(loader,/source.mode==='realistic'&&allowPreview/);
 assert.match(loader,/realistic-human-not-yet-approved/);
});
