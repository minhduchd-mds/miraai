import * as THREE from 'three';

/** Dedicated Vitruvian/CharMorph seated pose.
 * Rotating Mixamo local X by a guessed number made BOTH shins point upward.
 * Align anatomical limb segments to world-space seating directions instead.
 * Source character is authored facing +Z. No animations or user data involved.
 */
export function poseVitruvianSeated(root:THREE.Object3D):boolean {
 const bones=new Map<string,THREE.Bone>();
 root.traverse(node=>{
  if(!(node instanceof THREE.Bone))return;
  const name=node.name.toLowerCase().replace(/[^a-z0-9]/g,'').replace(/^mixamorig/,'');
  bones.set(name,node);
 });
 const get=(...names:string[])=>names.map(x=>bones.get(x)).find((b):b is THREE.Bone=>Boolean(b));
 const orient=(parent:THREE.Bone,child:THREE.Bone,vector:[number,number,number])=>{
  root.updateMatrixWorld(true);
  const a=parent.getWorldPosition(new THREE.Vector3());
  const b=child.getWorldPosition(new THREE.Vector3());
  const from=b.sub(a),to=new THREE.Vector3(...vector);
  if(from.lengthSq()<1e-8||to.lengthSq()<1e-8)return false;
  const worldDelta=new THREE.Quaternion().setFromUnitVectors(from.normalize(),to.normalize());
  const parentWorld=parent.parent?.getWorldQuaternion(new THREE.Quaternion())||new THREE.Quaternion();
  const localDelta=parentWorld.clone().invert().multiply(worldDelta).multiply(parentWorld);
  parent.quaternion.premultiply(localDelta).normalize();
  root.updateMatrixWorld(true);
  return true;
 };
 const leftThigh=get('leftupleg','leftupperleg','leftthigh');
 const rightThigh=get('rightupleg','rightupperleg','rightthigh');
 const leftKnee=get('leftleg','leftlowerleg','leftshin');
 const rightKnee=get('rightleg','rightlowerleg','rightshin');
 const leftFoot=get('leftfoot');
 const rightFoot=get('rightfoot');
 if(!leftThigh||!rightThigh||!leftKnee||!rightKnee||!leftFoot||!rightFoot)
  return false;
 // Both knees face in front of the cushion. Lower legs point toward the
 // floor and toes are not permitted to float above the thighs.
 if(!orient(leftThigh,leftKnee,[-.12,-.30,1]))return false;
 if(!orient(rightThigh,rightKnee,[.12,-.27,1]))return false;
 if(!orient(leftKnee,leftFoot,[-.02,-1,.13]))return false;
 if(!orient(rightKnee,rightFoot,[.02,-1,.11]))return false;
 const leftToe=get('lefttoebase','lefttoe');
 const rightToe=get('righttoebase','righttoe');
 if(leftToe)orient(leftFoot,leftToe,[0,-.07,1]);
 if(rightToe)orient(rightFoot,rightToe,[0,-.07,1]);
 const armSets=[
  {upper:get('leftarm','leftupperarm'),lower:get('leftforearm','leftlowerarm'),
   hand:get('lefthand'),upperDirection:[-.08,-1,.30] as [number,number,number],
   lowerDirection:[.50,-.22,.72] as [number,number,number]},
  {upper:get('rightarm','rightupperarm'),lower:get('rightforearm','rightlowerarm'),
   hand:get('righthand'),upperDirection:[.08,-1,.30] as [number,number,number],
   lowerDirection:[-.50,-.22,.72] as [number,number,number]}
 ];
 for(const a of armSets){
  if(!a.upper||!a.lower||!a.hand)return false;
  if(!orient(a.upper,a.lower,a.upperDirection))return false;
  if(!orient(a.lower,a.hand,a.lowerDirection))return false;
 }
 root.updateMatrixWorld(true);
 return true;
}
