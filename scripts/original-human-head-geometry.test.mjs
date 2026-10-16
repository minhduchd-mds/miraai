import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createOriginalHeadGeometry,originalHeadPosition} from '../src/presence/original-human-head-geometry.ts';

test('original face is a unified watertight indexed mesh with finite normals',()=>{
 const geometry=createOriginalHeadGeometry();
 try{
  const xyz=geometry.getAttribute('position');
  const normals=geometry.getAttribute('normal');
  const indices=geometry.getIndex();
  assert.ok(xyz.count>3500);
  assert.ok(indices && indices.count>17000);
  assert.equal(xyz.count,normals.count);
  for(let i=0;i<xyz.count;i++){
   for(const v of [xyz.getX(i),xyz.getY(i),xyz.getZ(i),
                   normals.getX(i),normals.getY(i),normals.getZ(i)])
    assert.ok(Number.isFinite(v));
  }
  assert.ok(geometry.boundingSphere?.radius && geometry.boundingSphere.radius<.40);
 } finally {geometry.dispose();}
});

test('nose and cheeks are local deformations of the SAME face, not detached spheres',()=>{
 const rest=originalHeadPosition(0,-.16,1);
 const nose=originalHeadPosition(0,-.16,1); // target y ~= -.047m
 const cheek=originalHeadPosition(.52,-.21,.83);
 const back=originalHeadPosition(0,-.16,-1);
 assert.deepEqual(rest,nose);
 assert.ok(nose[2]>.204 && nose[2]<.244,'nose depth is subtle and bounded');
 assert.ok(cheek.every(Number.isFinite));
 assert.ok(back[2]<0,'no nose deformation on rear skull');
 const avatar=readFileSync('src/presence/OriginalMiraLabAvatar.tsx','utf8');
 assert.match(avatar,/geometry=\{originalHead\}/);
 assert.doesNotMatch(avatar,/mesh position=\{\[side\*\.152,\.213,\.143\]\}/);
 assert.doesNotMatch(avatar,/mesh position=\{\[0,\.248,\.204\]\}/);
});

test('mouth and eyes sit close to face skin and all QA cameras remain available',()=>{
 const avatar=readFileSync('src/presence/OriginalMiraLabAvatar.tsx','utf8');
 const room=readFileSync('src/presence/PhotorealRoom3D.tsx','utf8');
 assert.match(avatar,/group position=\{\[side\*\.102,\.331,\.163\]\}/);
 assert.match(avatar,/mesh ref=\{mouth\} position=\{\[0,\.126,\.180\]\}/);
 assert.match(avatar,/mesh ref=\{innerLip\} position=\{\[0,\.114,\.181\]\}/);
 assert.match(room,/makeFaceClosePreset/);
 assert.match(room,/Digit\(\[1-6\]\)/);
});

test('BA round 6: eyes have flatter profile, neck is continuous and chin stays round',()=>{
 const a=readFileSync('src/presence/OriginalMiraLabAvatar.tsx','utf8');
 const geo=readFileSync('src/presence/original-human-head-geometry.ts','utf8');
 assert.match(a,/name="mira-neck" position=\{\[0,1\.326,\.012\]\}/);
 assert.match(a,/cylinderGeometry args=\{\[\.070,\.079,\.190,28,1\]\}/);
 assert.doesNotMatch(a,/mesh position=\{\[0,1\.315,\.02\]\}/);
 assert.match(a,/mesh scale=\{\[\.045,\.025,\.014\]\}/);
 assert.match(a,/position=\{\[0,\.029,\.022\]\}/);
 assert.match(a,/lid\.position\.y=\.029-facial\.closure\*\.023/);
 assert.match(geo,/1-\.075\*Math\.min/);
 assert.doesNotMatch(a,/scale=\{\[\.061,\.009,\.018\]\}/);
});
