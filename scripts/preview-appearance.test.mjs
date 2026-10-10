import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const loader=readFileSync('src/presence/RoomMiraVRM.tsx','utf8');
const room=readFileSync('src/presence/RoomLuxuryInterior.tsx','utf8');

test('preview keeps tested muted hair tint instead of overbright MToon highlights',()=>{
 const blob=readFileSync('public/avatars/female/mira_female_04_soft_rose.vrm');
 assert.equal(blob.toString('ascii',0,4),'glTF');
 const len=blob.readUInt32LE(12);
 const metadata=JSON.parse(blob.toString('utf8',20,20+len));
 const hairs=metadata.materials.filter(m=>/^F00_000_Hair_00_HAIR_0[1-6]$/.test(m.name));
 assert.equal(hairs.length,6);
 for(const hair of hairs){
  assert.deepEqual(hair.pbrMetallicRoughness.baseColorFactor,[1,1,1,1]);
  assert.ok(hair.pbrMetallicRoughness.baseColorTexture,'author texture missing');
 }
 assert.match(loader,/mat\.color\.set\(['"]#34242a['"]\)/);
 assert.match(loader,/if\('roughness' in mat\)mat\.roughness=\.81/);
 assert.match(loader,/source\.mode==='preview'\)adaptReferencePalette\(vrm\)/);
});

test('natural head rest starts nearly centered and does not override 3D eye tracking',()=>{
 assert.match(loader,/rotate\('head', \.018, 0, -\.018\)/);
 assert.match(loader,/const head=vrm\?\.humanoid\?\.getNormalizedBoneNode\('head'\)/);
 assert.match(loader,/original\.y\+motion\.headYaw/);
 assert.match(loader,/if\(vrm\.lookAt&&vrm\.lookAt\.target!==camera\)vrm\.lookAt\.target=camera/);
 assert.match(loader,/vrm\.update\(Math\.min\(delta,\.06\)\)/);
});

test('3D chair is compact enough not to dwarf seated avatar',()=>{
 assert.match(room,/name="mira-indoor-lounge"/);
 assert.match(room,/position=\{\[0,\.94,1\.28\]\} castShadow receiveShadow scale=\{\[1\.12,\.73,\.29\]\}/);
 assert.match(room,/position=\{\[side\*1\.09,\.59,1\.86\]\}/);
 assert.doesNotMatch(room,/<MarbleDeskSet\/>|<WorkspaceSet\/>/);
});
