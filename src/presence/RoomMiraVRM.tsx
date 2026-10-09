import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import {chooseRoomAvatar,PREVIEW_ASSET,type AvatarAssetSource} from './realistic-avatar-source';
import {poseMixamoHumanSeated} from './rigged-human-pose';
import {humanMotionFrame,humanMotionCadence} from './realistic-human-motion';
import {ttsLevel} from '../core/audio-level';
import {visemesForSpeech} from './tts-visemes';
import type { MiraState } from '../core/types';
import {validateRealisticHumanScene} from './realistic-human-quality';

/**
 * A real rigged VRM avatar inside the same 3D room, never an alpha-masked photo.
 * Existing model assets are already committed to /public/avatars/female.
 * This outfit/face is an available model, NOT a reconstruction of the concept portrait.
 */
// Closer warm wardrobe palette. This is still a stylized VRM, not a photo-exact model.
const MODEL = 'avatars/female/mira_female_04_soft_rose.vrm';
export type AvatarPresentationStatus = 'pending' | 'approved' | 'review' | 'preview' | 'rejected';
type Props = { onReady: () => void; state: MiraState;
  onAssetStatus?: (status: AvatarPresentationStatus) => void };
type Bone = 'leftUpperArm' | 'rightUpperArm' | 'leftLowerArm' | 'rightLowerArm'
  | 'leftUpperLeg' | 'rightUpperLeg' | 'leftLowerLeg' | 'rightLowerLeg'
  | 'head' | 'chest' | 'leftHand' | 'rightHand';

function seatedPose(vrm: VRM) {
  const bone = (name: Bone) => vrm.humanoid?.getNormalizedBoneNode(name);
  const rotate = (name: Bone, x: number, y: number, z: number) => {
    const node = bone(name);
    if (node) node.rotation.set(x, y, z);
  };
  // Seated legs, relaxing shoulder/forearm joints; the source VRM remains rigged.
  rotate('leftUpperLeg', -1.12, 0, .09);
  rotate('rightUpperLeg', -1.12, 0, -.09);
  rotate('leftLowerLeg', 1.34, 0, 0);
  rotate('rightLowerLeg', 1.34, 0, 0);
  // Relaxed, asymmetric portrait: elbow toward cheek and shoulders slightly tilted.
  rotate('leftUpperArm', -.23, .04, 1.14);
  rotate('rightUpperArm', -.31, -.04, -.80);
  rotate('leftLowerArm', -.90, -.07, .16);
  rotate('rightLowerArm', -.56, .04, -.09);
  rotate('head', .06, -.08, -.11);
  rotate('chest', -.10, .02, .04);
}

/** Recolor only explicitly named hair/garment slots to the approved dark-hair / cream-knit palette.
 * Never tint skin, eyes or unlabeled slots; actual fidelity still depends on the VRM asset. */
function adaptReferencePalette(vrm: VRM) {
  const done=new Set<THREE.Material>();
  vrm.scene.traverse(node=>{
    if (!(node instanceof THREE.Mesh)) return;
    const slots=Array.isArray(node.material)?node.material:[node.material];
    for(const raw of slots){
      if(!raw || done.has(raw))continue;
      done.add(raw);
      const mat=raw as THREE.MeshStandardMaterial;
      if(!(mat.color instanceof THREE.Color))continue;
      const name=(node.name+' '+raw.name).toLowerCase();
      if(/hair|fringe|bangs|hairstyle|髪|ヘア/.test(name)) {
        mat.color.set('#34242a');
        if('roughness' in mat)mat.roughness=.81;
      }else if(/cardigan|sweater|knit|top|shirt|blouse|clothing|outfit|衣装|服/.test(name)) {
        mat.color.set('#f1e8e1');
        if('roughness' in mat)mat.roughness=.92;
      }
    }
  });
}

function GeometricFallback() {
  // Geometric figure appears only when the VRM file/loader is unavailable.
  // Kept volumetric at all angles; never insert a photographic billboard.
  return <group position={[0,.42,1.27]}>
    <mesh position={[0,.75,0]} castShadow scale={[.49,.62,.31]}>
      <sphereGeometry args={[1,28,20]} />
      <meshStandardMaterial color="#e8d2ce" roughness={.96} />
    </mesh>
    <mesh position={[0,1.59,0]} castShadow scale={[.27,.36,.26]}>
      <sphereGeometry args={[1,32,22]} />
      <meshPhysicalMaterial color="#eec5ac" roughness={.61} />
    </mesh>
    <mesh position={[0,1.82,-.095]} castShadow scale={[.29,.28,.23]}>
      <sphereGeometry args={[1,32,22]} />
      <meshStandardMaterial color="#3d2725" roughness={.92} />
    </mesh>
    {[-.48,.48].map((x,i)=><mesh key={i} position={[x,.96,.16]}
      rotation={[0,0,x>0?.38:-.38]} castShadow scale={[.19,.48,.22]}>
      <capsuleGeometry args={[1,1.2,8,14]}/>
      <meshStandardMaterial color="#e7d8d0" roughness={.97}/>
    </mesh>)}
  </group>;
}

export default function RoomMiraVRM({onReady,state,onAssetStatus}:Props) {
  const [model,setModel] = useState<VRM | null>(null);
  const [humanGLB,setHumanGLB] = useState<THREE.Group | null>(null);
  const allowPreview = typeof window!=='undefined' && new URLSearchParams(window.location.search).get('avatarPreview')==='1';
  const allowReview = typeof window!=='undefined' && new URLSearchParams(window.location.search).get('avatarReview')==='1';
  const [avatar,setAvatar] = useState<AvatarAssetSource>(PREVIEW_ASSET);
  const [failed,setFailed] = useState(false);
  const ref = useRef<VRM | null>(null);
  const glbRef = useRef<THREE.Group | null>(null);
  const restRotations = useRef(new WeakMap<THREE.Object3D,THREE.Euler>());
  const jawBlend=useRef(0);
  const morphSlots = useRef<Array<{mesh:THREE.Mesh; names:Map<string,number>; base:number[]}>>([]);
  const callback = useRef(onReady);
  callback.current=onReady;
  const statusCallback=useRef(onAssetStatus);
  statusCallback.current=onAssetStatus;
  const invalidate = useThree(s=>s.invalidate);
  const camera = useThree(s=>s.camera);

  useEffect(()=>{
    let cancelled=false;
    const disposeGLB=(scene:THREE.Group)=>{
      scene.traverse(node=>{
        if(!(node instanceof THREE.Mesh))return;
        node.geometry?.dispose();
        const materials=Array.isArray(node.material)?node.material:[node.material];
        for(const mat of materials){
          if(!mat)continue;
          const pbr=mat as THREE.MeshStandardMaterial;
          pbr.map?.dispose();pbr.normalMap?.dispose();mat.dispose();
        }
      });
    };
    const loader=new GLTFLoader();
    loader.register(parser=>new VRMLoaderPlugin(parser));
    const load=(source:AvatarAssetSource):void=>{
      if(cancelled)return;
      const failure=()=>{
        if(cancelled)return;
        // A missing/broken reviewed model NEVER silently becomes an anime avatar.
        if(source.mode==='realistic'&&allowPreview){load(PREVIEW_ASSET);return;}
        setModel(null);setHumanGLB(null);setFailed(true);
        statusCallback.current?.('rejected');
        callback.current();invalidate();
      };
      loader.load(`${import.meta.env.BASE_URL}${source.path}`,gltf=>{
        const vrm=gltf.userData.vrm as VRM | undefined;
        if(!vrm && source.mode==='realistic'&&source.format==='glb'){
          if(cancelled){disposeGLB(gltf.scene);return;}
          const quality=validateRealisticHumanScene(gltf.scene);
          if(!quality.accepted){
            // Never present an unrigged / low detail / untextured human as Mira.
            // No user data, URLs or asset bytes are emitted in error telemetry.
            disposeGLB(gltf.scene);
            failure();return;
          }
          if(source.poseMode==='mixamo-seated' && !poseMixamoHumanSeated(gltf.scene)){
            disposeGLB(gltf.scene);failure();return;
          }
          gltf.scene.traverse(node=>{
            if(node instanceof THREE.Mesh){node.castShadow=true;node.receiveShadow=true;}
          });
          glbRef.current=gltf.scene;
          // Cache facial morph slots once. Preserve authored neutral weights.
          const facial:Array<{mesh:THREE.Mesh;names:Map<string,number>;base:number[]}>=[];
          gltf.scene.traverse(node=>{
            if(!(node instanceof THREE.Mesh)||!node.morphTargetDictionary||!node.morphTargetInfluences)return;
            facial.push({mesh:node,
              names:new Map(Object.entries(node.morphTargetDictionary).map(([name,index])=>
                [name.toLowerCase().replace(/[^a-z0-9]/g,''),index])),
              base:[...node.morphTargetInfluences]});
          });
          morphSlots.current=facial;
          setModel(null);setHumanGLB(gltf.scene);setAvatar(source);setFailed(false);
          statusCallback.current?.(allowReview?'review':'approved');
          callback.current();invalidate();
          return;
        }
        if(!vrm){failure();return;}
        if(cancelled){VRMUtils.deepDispose(vrm.scene);return;}
        // A VRM extension does not guarantee human realism. Enforce the SAME
        // geometry, rig and independently textured PBR quality gate as GLB.
        // This is technical screening; explicit manual visual approval remains
        // mandatory and cannot be inferred from a high vertex count.
        if(source.mode==='realistic'){
          const quality=validateRealisticHumanScene(vrm.scene);
          if(!quality.accepted){
            VRMUtils.deepDispose(vrm.scene);
            failure();
            return;
          }
        }
        try{
          // Realistic VRMs arrive with an artist-authored seated pose. Never
          // overwrite their bind pose with the stylized preview's joint angles.
          if(source.mode==='preview')seatedPose(vrm);
          // Preserve the PBR skin/hair/garment maps of a reviewed human model.
          // Stylized preview recoloring is intentionally NOT applied to realistic assets.
          if(source.mode==='preview')adaptReferencePalette(vrm);
          if(source.mode==='preview')vrm.expressionManager?.setValue('happy',.22);
          vrm.scene.rotation.y=source.mode==='preview'?Math.PI:0;
          vrm.scene.traverse(node=>{
            if('castShadow' in node)(node as {castShadow:boolean}).castShadow=true;
            if('receiveShadow' in node)(node as {receiveShadow:boolean}).receiveShadow=true;
          });
          ref.current=vrm;
          setModel(vrm);setHumanGLB(null);setAvatar(source);setFailed(false);
          statusCallback.current?.(source.mode==='preview'?'preview':allowReview?'review':'approved');
          callback.current();invalidate();
        }catch{
          VRMUtils.deepDispose(vrm.scene);
          failure();
        }
      },undefined,failure);
    };
    // Only a same-origin, licensed and manually reviewed 3D human can be Mira.
    // Legacy VRoid preview requires the explicit developer flag ?avatarPreview=1.
    const applyManifest=(manifest:unknown)=>{
      if(cancelled)return;
      const source=chooseRoomAvatar(manifest,{allowStylizedPreview:allowPreview,allowStagedRealisticReview:allowReview});
      if(source)load(source);
      else{
        setModel(null);setHumanGLB(null);setFailed(true);
        statusCallback.current?.('pending');
        callback.current();invalidate();
      }
    };
    void fetch(`${import.meta.env.BASE_URL}avatars/realistic/manifest.json`,{
      credentials:'same-origin',cache:'no-cache'
    }).then(r=>r.ok?r.json():null)
      .then(applyManifest)
      .catch(()=>applyManifest(null));
    return ()=>{
      cancelled=true;
      morphSlots.current=[];
      const old=ref.current;ref.current=null;
      if(old)VRMUtils.deepDispose(old.scene);
      const scene=glbRef.current;glbRef.current=null;
      if(scene)disposeGLB(scene);
    };
  },[invalidate,allowPreview,allowReview]);

  // Demand-rendered cinematic idle: 8 fps at rest, 20 fps when speaking.
  // Never run an interval for a model that has not passed manual approval.
  useEffect(()=>{
    if(!model&&!humanGLB)return;
    const id=window.setInterval(()=>{
      if(!document.hidden)invalidate();
    },humanMotionCadence(state));
    return ()=>window.clearInterval(id);
  },[model,humanGLB,state,invalidate]);

  useFrame((_,delta)=>{
    const vrm=ref.current;
    const root=vrm?.scene||glbRef.current;
    if(!root)return;
    const motion=humanMotionFrame(performance.now()*.001,state,
      state==='speaking' && ttsLevel.active ? ttsLevel.value : undefined);
    // Smooth fast RMS fluctuations without forcing a mouth-open pose in silence.
    const k=1-Math.exp(-Math.min(Math.max(delta,0),.1)*15);
    jawBlend.current+=(motion.mouthOpen-jawBlend.current)*k;
    const mouthOpen=jawBlend.current;
    const visemes=visemesForSpeech(mouthOpen,
      state==='speaking' && ttsLevel.active ? ttsLevel.bands : null);
    const head=vrm?.humanoid?.getNormalizedBoneNode('head')||
      root.getObjectByName('mixamorigHead')||root.getObjectByName('Head')||null;
    if(head){
      let original=restRotations.current.get(head);
      if(!original){
        original=head.rotation.clone();
        restRotations.current.set(head,original);
      }
      head.rotation.set(original.x+motion.headPitch,
        original.y+motion.headYaw,original.z);
    }
    const torso=vrm?.humanoid?.getNormalizedBoneNode('chest')||
      root.getObjectByName('mixamorigSpine2')||null;
    if(torso){
      let original=restRotations.current.get(torso);
      if(!original){
        original=torso.rotation.clone();
        restRotations.current.set(torso,original);
      }
      torso.rotation.x=original.x+motion.breathing;
    }

    if(vrm){
      // Drive only expressions the approved VRM actually exports.
      const expressions=vrm.expressionManager;
      if(expressions){
        if(expressions.getExpression('blink')) expressions.setValue('blink',motion.blink);
        for(const name of ['aa','ih','ou','ee','oh'] as const){
          if(expressions.getExpression(name))expressions.setValue(name,visemes[name]);
        }
        if(expressions.getExpression('happy')) expressions.setValue('happy',motion.smile);
      }
      // VRM look-at is evaluated inside update(); set target first so gaze
      // follows camera motion on the same rendered frame.
      if(vrm.lookAt&&vrm.lookAt.target!==camera)vrm.lookAt.target=camera;
      vrm.update(Math.min(delta,.06));
      return;
    }
    // GLB morph names vary by author: use only present, named facial channels.
    for(const {mesh,names,base} of morphSlots.current){
      const dst=mesh.morphTargetInfluences;
      if(!dst)continue;
      for(const [name,index] of names){
        if(index<0||index>=dst.length)continue;
        let weight:number|undefined;
        if(/blink|eyeclose|eyesclosed/.test(name))weight=motion.blink;
        else if(/jawopen|mouthopen/.test(name))weight=mouthOpen;
        else if(/^(?:visemeaa|moutha|aa)$/.test(name))weight=visemes.aa;
        else if(/^(?:visemeih|mouthi|ih)$/.test(name))weight=visemes.ih;
        else if(/^(?:visemeou|mouthu|ou)$/.test(name))weight=visemes.ou;
        else if(/^(?:visemeee|mouthee|ee)$/.test(name))weight=visemes.ee;
        else if(/^(?:visemeoh|moutho|oh)$/.test(name))weight=visemes.oh;
        else if(/smile|mouthhappy/.test(name))weight=motion.smile;
        if(weight!==undefined){
          // Blend over authored neutral weights, without clipping small facial
          // motion just because the neutral shape was slightly nonzero.
          const neutral=Math.min(1,Math.max(0,base[index]||0));
          dst[index]=neutral+(1-neutral)*Math.min(1,Math.max(0,weight));
        }
      }
    }
  });

  return <group>
    {model ? avatar.mode==='realistic' ? <group
      position={avatar.position} scale={avatar.scale} rotation={[0,avatar.rotationY,0]}>
      <primitive object={model.scene}/>
    </group> : <group position={[0,.17,2.28]} scale={1.55}>
      <primitive object={model.scene}/>
    </group> : humanGLB && avatar.mode==='realistic' ? <group
      position={avatar.position} scale={avatar.scale} rotation={[0,avatar.rotationY,0]}>
      <primitive object={humanGLB}/>
    </group> : allowPreview ? <GeometricFallback/> : null}
    {failed && <group name="realistic-human-not-yet-approved"/>}
  </group>;
}
