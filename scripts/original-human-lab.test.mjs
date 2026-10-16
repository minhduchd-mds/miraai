import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const original=readFileSync('src/presence/OriginalMiraLabAvatar.tsx','utf8');
const room=readFileSync('src/presence/PhotorealRoom3D.tsx','utf8');
const source=readFileSync('src/presence/realistic-avatar-source.ts','utf8');
const release=readFileSync('scripts/check-avatar-release.mjs','utf8');
const pkg=JSON.parse(readFileSync('package.json','utf8'));

test('original human lab uses only native Three geometry and Mira authored controls',()=>{
 for(const token of [
  'sphereGeometry','tubeGeometry','meshPhysicalMaterial','meshStandardMaterial',
  'createCharacterDirector','createCharacterGaze','createVisemeEnvelope',
  'humanMotionFrame','humanMotionCadence','visemesForSpeech',
  'ttsLevel.value','ttsLevel.bands'
 ]){
  assert.ok(original.includes(token),token);
 }
 assert.match(original,/new THREE\.CatmullRomCurve3/);
 assert.match(original,/group name="mira-original-humanoid-lab-only"/);
 assert.match(original,/status\.current\?\.\('review'\)/);
 assert.match(original,/onAssetStatus\?:\(status:'review'\)/);
});

test('lab never loads downloaded model, copies artwork or collects sensitive data',()=>{
 for(const forbidden of [
  'GLTFLoader','VRMLoaderPlugin','TextureLoader','imageTexture',
  'fetch(','getUserMedia(','localStorage','sessionStorage',
  'weelife','VitruvianGodot','mixamorig','Mira_female_'
 ])assert.ok(!original.includes(forbidden),'Unexpected external dependency: '+forbidden);
 assert.doesNotMatch(original,/https?:\/\//);
});

test('original lab cannot replace approved human without explicit opt-in',()=>{
 assert.match(room,/get\('originalHumanLab'\)==='1'/);
 assert.match(room,/lazy\(\(\) => import\('\.\/OriginalMiraLabAvatar'\)\)/);
 assert.match(room,/: originalHumanLab\s*\? <OriginalMiraLabAvatar/);
 assert.match(room,/: humanLab\s*\? <VitruvianLabAvatar/);
 assert.match(room,/: <RoomMiraVRM/);
 assert.match(source,/status:'approved'/);
 assert.match(release,/evaluateAvatarRights/);
 assert.match(release,/auditHumanAssetRig/);
});

test('visual prototype does not ship external model binaries',()=>{
 assert.ok(pkg.scripts.build.includes('node scripts/prune-runtime-assets.mjs'));
 const prune=readFileSync('scripts/prune-runtime-assets.mjs','utf8');
 assert.match(prune,/avatars', 'female'/);
 assert.match(prune,/avatars', 'male'/);
 assert.match(prune,/avatars', 'splat.ply'/);
 assert.match(prune,/realistic', 'vitruvian-lab'/);
});

test('geometry is bounded, mouth closes on audio silence, and render cadence sleeps',()=>{
 assert.match(original,/new THREE\.Vector3/);
 assert.match(original,/createOriginalFaceController/);
 assert.match(original,/facial\.mouthHeight/);
 assert.match(original,/facial\.closure/);
 assert.match(original,/state==='speaking'&&ttsLevel\.active/);
 assert.match(original,/if\(!document\.hidden\)invalidate\(\)/);
 assert.match(original,/window\.clearInterval\(interval\)/);
 assert.match(original,/gaze\.current\.sample/);
 assert.match(original,/leftLid/);
 assert.match(original,/rightLid/);
});
