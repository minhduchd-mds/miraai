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
 assert.match(vrm,/mira_female_02_lavender_lounge\.vrm/);
 assert.match(vrm,/VRMLoaderPlugin/);
 assert.match(vrm,/seatedPose\(vrm\)/);
 assert.match(vrm,/getNormalizedBoneNode/);
 assert.match(vrm,/vrm\.scene\.rotation\.y=Math\.PI/);
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
    'camera.position.set(v.x,1.68,v.z)','camera.rotation.set(v.pitch,v.yaw,0',
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
