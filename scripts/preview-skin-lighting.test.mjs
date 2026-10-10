import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const room=readFileSync('src/presence/RoomLuxuryInterior.tsx','utf8');
const avatar=readFileSync('src/presence/RoomMiraVRM.tsx','utf8');

test('balanced room key light preserves nighttime/daytime scenes and has an original switch',()=>{
 assert.match(room,/get\('lighting'\)==='original'/);
 assert.match(room,/intensity=\{original\?4\.6:3\.1\}/);
 assert.match(room,/intensity=\{original\?1\.65:1\.35\}/);
 assert.match(room,/intensity=\{original\?\(night\?15:11\):\(night\?11:8\)\}/);
 assert.match(room,/intensity=\{original\?\(night\?31:23\):\(night\?15:12\)\}/);
 assert.match(room,/intensity=\{original\?\(night\?\.83:1\.06\):\(night\?\.75:\.86\)\}/);
 assert.match(room,/intensity=\{original\?\.66:\.54\}/);
 assert.match(room,/<RoomLighting night=\{night\}\/>/);
});

test('only the preview face/body skin gets warm tint and keeps original opt-out',()=>{
 const blob=readFileSync('public/avatars/female/mira_female_04_soft_rose.vrm');
 const n=blob.readUInt32LE(12);
 const model=JSON.parse(blob.toString('utf8',20,20+n));
 for(const name of ['F00_000_00_Face_00_SKIN','F00_000_00_Body_00_SKIN']){
  const material=model.materials.find(m=>m.name===name);
  assert.ok(material,'skin material missing: '+name);
  assert.ok(material.pbrMetallicRoughness.baseColorTexture);
  assert.deepEqual(material.pbrMetallicRoughness.baseColorFactor,[1,1,1,1]);
 }
 assert.match(avatar,/\^F00_000_00_\(\?:Face\|Body\)_00_SKIN\$/);
 assert.match(avatar,/get\('skin'\)!=='original'/);
 assert.match(avatar,/mat\.color\.set\('#f6e0d6'\)/);
 assert.match(avatar,/mat\.roughness=\.93/);
 assert.match(avatar,/if\(source\.mode==='preview'\)adaptReferencePalette\(vrm\)/);
 assert.match(avatar,/if\(source\.mode==='realistic'\)/);
 assert.doesNotMatch(avatar,/if\(source\.mode==='realistic'\)adaptReferencePalette\(vrm\)/);
});

test('keep original purple hair, four-tuft removal and skinned indoor shirt',()=>{
 assert.match(avatar,/mat\.color\.set\('#34242a'\)/);
 assert.match(avatar,/hidePreviewHairTufts\(vrm\)/);
 assert.match(avatar,/stabilizePreviewHairPhysics\(vrm\)/);
 assert.match(avatar,/dressPreviewForIndoors\(vrm\)/);
 assert.doesNotMatch(avatar,/mat\.color\.set\('#f6e0d6'\)[\s\S]{0,100}hidePreviewHairTufts/);
});
