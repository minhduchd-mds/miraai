import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const src=readFileSync('src/presence/original-human-limb-pose.ts','utf8');
const compiled=ts.transpileModule(src,{compilerOptions:{
  module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022
}}).outputText;
const pose=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));

test('original seated skeleton has bilateral contiguous shoulder, elbow, wrist and ankle points',()=>{
 assert.equal(pose.validSeatedRig(),true);
 const left=pose.seatedArm(-1),right=pose.seatedArm(1);
 const leftLeg=pose.seatedLeg(-1),rightLeg=pose.seatedLeg(1);
 for(const part of ['shoulder','elbow','wrist','hand']){
  assert.equal(left[part][0],-right[part][0],part);
  assert.equal(left[part][1],right[part][1]);
  assert.equal(left[part][2],right[part][2]);
 }
 for(const part of ['hip','knee','ankle','foot'])
  assert.equal(leftLeg[part][0],-rightLeg[part][0],part);
});
test('hand-bottom is tangent to padded chair arm top to within 12mm',()=>{
 for(const side of [-1,1]){
  const gap=pose.contactGapForChairArm(side);
  assert.ok(Math.abs(gap)<=.012,side+' hand-chair gap '+gap);
  const hand=pose.seatedArm(side).hand;
  assert.ok(Math.abs(Math.abs(hand[0])-pose.CHAIR_ARM.x)<.040);
  assert.ok(Math.abs(hand[2]+pose.AVATAR_ORIGIN[2]-pose.CHAIR_ARM.z)<.075);
 }
});
test('limbs remain within a finite seated joint and geometry budget',()=>{
 const lm=readFileSync('src/presence/OriginalMiraLimb.tsx','utf8');
 const actual=readFileSync('src/presence/OriginalMiraLabAvatar.tsx','utf8');
 assert.match(lm,/cylinderGeometry args=\{\[endRadius,startRadius,pose\.length,18,1\]\}/);
 assert.match(lm,/setFromUnitVectors/);
 assert.match(actual,/\[-1\.5,-\.5,\.5,1\.5\]\.map/);
 assert.match(actual,/seatedArm\(side\)/);
 assert.match(actual,/seatedLeg\(side\)/);
 assert.doesNotMatch(actual,/mesh position=\{\[side\*\.165,\.665,\.265\]\}/);
 const joints=[...[-1,1].flatMap(side=>Object.values(pose.seatedArm(side)).filter(Array.isArray)),
  ...[-1,1].flatMap(side=>Object.values(pose.seatedLeg(side)).filter(Array.isArray))];
 for(const p of joints) assert.ok(p.every(Number.isFinite));
});
