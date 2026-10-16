import {useMemo} from 'react';
import * as THREE from 'three';
import type {Point3} from './original-human-limb-pose';

type Props={
 from:Point3;to:Point3;
 startRadius:number;endRadius:number;
 color:string;roughness?:number;
};

/** Locally authored tapered, oriented capsule segment.
 * Unlike disconnected scaled spheres, every segment has a continuous surface
 * from its proximal to distal joint, with small circular joint blending.
 */
export default function OriginalMiraLimb({from,to,startRadius,endRadius,color,roughness=.84}:Props){
 const pose=useMemo(()=>{
   const start=new THREE.Vector3(...from),end=new THREE.Vector3(...to);
   const axis=end.clone().sub(start);
   const length=axis.length();
   const rotation=new THREE.Quaternion().setFromUnitVectors(
     new THREE.Vector3(0,1,0),axis.clone().normalize());
   return {center:start.add(end).multiplyScalar(.5),rotation,length};
 },[...from,...to]);
 return <mesh position={pose.center} quaternion={pose.rotation} castShadow receiveShadow>
   <cylinderGeometry args={[endRadius,startRadius,pose.length,18,1]}/>
   <meshStandardMaterial color={color} roughness={roughness} metalness={0}/>
 </mesh>;
}
