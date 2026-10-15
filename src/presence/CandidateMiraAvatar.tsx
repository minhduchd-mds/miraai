import {useEffect,useRef,useState} from 'react';
import {useThree} from '@react-three/fiber';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import type {CandidateAsset} from './candidate-avatar-source';

type Props={
 candidate:CandidateAsset;
 localUrl?:string|null;
 onReady:()=>void;
 onAssetStatus?:(status:'review'|'rejected')=>void;
};
type Loaded={scene:THREE.Group;scale:number;center:THREE.Vector3;minY:number};
function disposeCandidate(root:THREE.Object3D){
 const geometries=new Set<THREE.BufferGeometry>();
 const materials=new Set<THREE.Material>();
 const textures=new Set<THREE.Texture>();
 root.traverse(node=>{
  if(!(node instanceof THREE.Mesh))return;
  geometries.add(node.geometry);
  for(const m of (Array.isArray(node.material)?node.material:[node.material])){
   if(!m)continue;materials.add(m);
   const p=m as THREE.MeshStandardMaterial;
   for(const key of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','alphaMap','aoMap'] as const){
    const tex=p[key] as THREE.Texture|null|undefined;
    if(tex)textures.add(tex);
   }
  }
 });
 geometries.forEach(g=>g.dispose());
 materials.forEach(m=>m.dispose());
 textures.forEach(t=>t.dispose());
}
/** Static, local-only GLB preview; unrigged scans have no real lip sync or gaze.
 * This code cannot activate an unreviewed GLB as Mira's main companion. */
export default function CandidateMiraAvatar({candidate,localUrl,onReady,onAssetStatus}:Props){
 const [loaded,setLoaded]=useState<Loaded|null>(null);
 const invalidate=useThree(s=>s.invalidate);
 const ready=useRef(onReady);ready.current=onReady;
 const status=useRef(onAssetStatus);status.current=onAssetStatus;
 useEffect(()=>{
  let cancelled=false;
  let owned:THREE.Group|null=null;
  setLoaded(null);
  const src=localUrl||`${import.meta.env.BASE_URL}${candidate.path}`;
  new GLTFLoader().load(src,gltf=>{
   if(cancelled){disposeCandidate(gltf.scene);return;}
   const bounds=new THREE.Box3().setFromObject(gltf.scene);
   const size=bounds.getSize(new THREE.Vector3());
   if(bounds.isEmpty()||![size.x,size.y,size.z].every(Number.isFinite)||
     size.y<.001||size.y>10000){
     disposeCandidate(gltf.scene);status.current?.('rejected');ready.current();invalidate();return;
   }
   const scale=Math.min(1.75/size.y,1.2/Math.max(size.x,size.z,.001));
   const center=bounds.getCenter(new THREE.Vector3());
   owned=gltf.scene;
   owned.traverse(node=>{
     if(!(node instanceof THREE.Mesh))return;
     node.castShadow=true;node.receiveShadow=true;
     if(candidate.id==='white'&&!localUrl){
       for(const m of (Array.isArray(node.material)?node.material:[node.material])){
         if(m instanceof THREE.MeshStandardMaterial){
           m.color.set('#ddd1cb');m.roughness=.91;m.metalness=0;
           m.side=THREE.DoubleSide;
         }
       }
     }
   });
   setLoaded({scene:owned,scale,center,minY:bounds.min.y});
   status.current?.('review');ready.current();invalidate();
  },undefined,()=>{
   if(cancelled)return;
   setLoaded(null);status.current?.('rejected');ready.current();invalidate();
  });
  return ()=>{
   cancelled=true;
   if(owned)disposeCandidate(owned);
  };
 },[candidate.id,candidate.path,localUrl,invalidate]);
 // Both original scans face -Z; rotate toward camera and auto-seat at floor height.
 return loaded?<group position={[0,-loaded.minY*loaded.scale,1.74]}
    rotation={[0,Math.PI,0]} scale={loaded.scale}>
   <group position={[-loaded.center.x,0,-loaded.center.z]}>
     <primitive object={loaded.scene}/>
   </group>
 </group>:null;
}
