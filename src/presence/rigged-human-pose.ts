import * as THREE from 'three';

/** Optional pose adapter for Mixamo-compatible GLBs.
 * Only runs when the artist explicitly asks for the Mixamo seating preset.
 * Does not rotate arbitrary unknown skeleton axes or replace an authored pose.
 * Returns false, unchanged, if essential hip/knee joints were not found. */
export function poseMixamoHumanSeated(root: THREE.Object3D): boolean {
  const joints = new Map<string,THREE.Bone>();
  root.traverse(o=>{
    if(!(o instanceof THREE.Bone))return;
    const name=o.name.toLowerCase().replace(/[^a-z0-9]/g,'');
    const normalized=name.replace(/^mixamorig/,'');
    joints.set(normalized,o);
  });
  const patterns = {
    thighLeft:['leftupleg','leftupperleg','leftthigh'],
    thighRight:['rightupleg','rightupperleg','rightthigh'],
    shinLeft:['leftleg','leftlowerleg','leftshin'],
    shinRight:['rightleg','rightlowerleg','rightshin'],
    armLeft:['leftarm','leftupperarm'],
    armRight:['rightarm','rightupperarm'],
    elbowLeft:['leftforearm','leftlowerarm'],
    elbowRight:['rightforearm','rightlowerarm'],
    head:['head'],
  } as const;
  const find = (names:readonly string[])=>names.map(x=>joints.get(x)).find(Boolean);
  const leftThigh=find(patterns.thighLeft),rightThigh=find(patterns.thighRight);
  const leftShin=find(patterns.shinLeft),rightShin=find(patterns.shinRight);
  if(!leftThigh||!rightThigh||!leftShin||!rightShin)return false;
  // Rotations are applied on top of the author's bind pose only for this
  // recognized skeleton convention. Unknown orientation stays unchanged.
  for(const leg of [leftThigh,rightThigh])leg.rotation.x-=1.08;
  for(const shin of [leftShin,rightShin])shin.rotation.x+=1.16;
  find(patterns.armLeft)?.rotateZ(.52);
  find(patterns.armRight)?.rotateZ(-.61);
  find(patterns.elbowLeft)?.rotateX(-.57);
  find(patterns.elbowRight)?.rotateX(-.74);
  find(patterns.head)?.rotateZ(-.07);
  root.updateMatrixWorld(true);
  return true;
}
