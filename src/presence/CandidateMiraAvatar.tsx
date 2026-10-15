import {useEffect,useRef,useState} from 'react';
import {useThree} from '@react-three/fiber';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import type {CandidateAsset} from './candidate-avatar-source';

type Props={
 candidate:CandidateAsset;
 onReady:()=>void;
 onAssetStatus?:(status:'review'|'rejected')=>void;
};
function disposeCandidate(root:THREE.Object3D){
 const geometries=new Set<THREE.BufferGeometry>();
 const materials=new Set<THREE.Material>();
 const textures=new Set<THREE.Texture>();
 root.traverse(node=>{
  if(!(node instanceof THREE.Mesh))return;
  geometries.add(node.geometry);
  for(const m of (Array.isArray(node.material)?node.material:[node.material])){
   if(!m)continue;
   materials.add(m);
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
/** Static lab preview only. These GLBs have no skeleton/morph channels:
 * never manufacture lip-sync, emotion tracking or motions for them. */
export default function CandidateMiraAvatar({candidate,onReady,onAssetStatus}:Props){
 const [model,setModel]=useState<THREE.Group|null>(null);
 const invalidate=useThree(s=>s.invalidate);
 const ready=useRef(onReady);ready.current=onReady;
 const status=useRef(onAssetStatus);status.current=onAssetStatus;
 useEffect(()=>{
  let cancelled=false;
  let owned:THREE.Group|null=null;
  setModel(null);
  new GLTFLoader().load(`${import.meta.env.BASE_URL}${candidate.path}`,gltf=>{
   if(cancelled){disposeCandidate(gltf.scene);return;}
   owned=gltf.scene;
   owned.traverse(node=>{
    if(!(node instanceof THREE.Mesh))return;
    node.castShadow=true;node.receiveShadow=true;
    if(candidate.id==='white'){
     for(const m of (Array.isArray(node.material)?node.material:[node.material])){
      if(m instanceof THREE.MeshStandardMaterial){
       m.color.set('#ddd1cb');m.roughness=.91;m.metalness=0;
       m.side=THREE.DoubleSide;
      }
     }
    }
   });
   setModel(owned);
   status.current?.('review');ready.current();invalidate();
  },undefined,()=>{
   if(cancelled)return;
   status.current?.('rejected');ready.current();invalidate();
  });
  return ()=>{
   cancelled=true;
   if(owned)disposeCandidate(owned);
  };
 },[candidate.id,candidate.path,invalidate]);
 // The incoming models are Y-centred and face -Z. Flip toward the room camera.
 return model?<group position={[0,.88,1.74]} rotation={[0,Math.PI,0]} scale={candidate.scale}>
  <primitive object={model}/>
 </group>:null;
}
