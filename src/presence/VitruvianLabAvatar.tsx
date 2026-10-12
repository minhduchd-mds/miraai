import {useEffect,useRef,useState} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import type {MiraState} from '../core/types';
import {ttsLevel} from '../core/audio-level';
import {faceData} from '../core/face/face-tracker';
import {visemesForSpeech} from './tts-visemes';
import {companionReaction} from './companion-reaction';
import {humanMotionFrame,humanMotionCadence} from './realistic-human-motion';
import {poseVitruvianSeated} from './vitruvian-seated-pose';

const LAB = 'avatars/realistic/vitruvian-lab/';
const FIGURE_SCALE = 1.30;
type Morph={mesh:THREE.Mesh;targets:Map<string,number>};
type Props={state:MiraState;onReady:()=>void;
  onAssetStatus?:(s:'review'|'rejected'|'pending')=>void};

/** CC0 LAB CANDIDATE. Never used as production identity or fallback.
 * Head, body, hair share original CharMorph world-space coordinates.
 * A rest-transform inverse keeps world-authored head/hair aligned under the rig head.
 * PBR maps are locally packaged, never fetched from arbitrary user-supplied URLs. */
export default function VitruvianLabAvatar({state,onReady,onAssetStatus}:Props){
 const [scene,setScene]=useState<THREE.Group|null>(null);
 const runtime=useRef<{scene:THREE.Group;headBone:THREE.Object3D;
    headRest:THREE.Euler;morphs:Morph[];textures:THREE.Texture[]}|null>(null);
 const invalidate=useThree(s=>s.invalidate);
 const callback=useRef(onReady);callback.current=onReady;
 const status=useRef(onAssetStatus);status.current=onAssetStatus;
 const jaw=useRef(0),smile=useRef(0);
 useEffect(()=>{
  let cancelled=false;
  const owned:THREE.Object3D[]=[];
  const maps:THREE.Texture[]=[];
  const root=new THREE.Group();
  const dispose=()=>{
   const visited=new Set<THREE.Material>();
   const geom=new Set<THREE.BufferGeometry>();
   root.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;
    if(o.geometry)geom.add(o.geometry);
    for(const mat of (Array.isArray(o.material)?o.material:[o.material]))
     if(mat)visited.add(mat);
   });
   geom.forEach(x=>x.dispose());
   visited.forEach(x=>x.dispose());
   maps.forEach(x=>x.dispose());
  };
  async function load(){
   const prefix=import.meta.env.BASE_URL+LAB;
   const loader=new GLTFLoader(),texLoader=new THREE.TextureLoader();
   try{
    // A pending researcher-provided file cannot silently become production Mira.
    const [manifestResponse,head,body,hair]=await Promise.all([
     fetch(prefix+'manifest.json',{credentials:'same-origin'}),
     loader.loadAsync(prefix+'head.glb'),loader.loadAsync(prefix+'body.glb'),
     loader.loadAsync(prefix+'hair.glb')]);
    owned.push(head.scene,body.scene,hair.scene);
    if(!manifestResponse.ok)throw Error('Human lab manifest missing');
    const manifest=await manifestResponse.json() as {status?:string;approved?:boolean;license?:string};
    if(manifest.status!=='lab_only'||manifest.approved!==false||
       manifest.license!=='CC0-1.0')throw Error('Unreviewed human asset blocked');
    const textures=await Promise.all([
     'vit_face_bc','vit_face_n','vit_face_rough','vit_body_bc','vit_body_n','vit_body_rough',
     'vit_hair_diffuse','vit_hair_normal','vit_hair_opacity','vit_iris','vit_sclera','vit_mouth'
    ].map(async key=>{
      const tex=await texLoader.loadAsync(prefix+key+'.webp');
      tex.flipY=false;tex.wrapS=THREE.RepeatWrapping;tex.wrapT=THREE.RepeatWrapping;
      if(/_(bc|diffuse)$|vit_iris|vit_sclera|vit_mouth/.test(key))
        tex.colorSpace=THREE.SRGBColorSpace;
      maps.push(tex);
      return [key,tex] as const;
    }));
    const tex=new Map<string,THREE.Texture>(textures);
    if(cancelled){dispose();return;}
    // Change only explicit author-named material slots. Never globally tint skin.
    function materialize(group:THREE.Object3D,kind:'head'|'body'|'hair'){
     group.traverse(obj=>{
      if(!(obj instanceof THREE.Mesh))return;
      obj.castShadow=true;obj.receiveShadow=true;
      const update=(m:THREE.Material):THREE.Material=>{
       const n=m.name.split('.')[0].toLowerCase();
       if(!(m instanceof THREE.MeshStandardMaterial))return m;
       const out=m.clone();
       if(n==='vitskin'){
        out.map=tex.get('vit_face_bc')||null;out.normalMap=tex.get('vit_face_n')||null;
        out.roughnessMap=tex.get('vit_face_rough')||null;
        out.normalScale.set(.18,.18);out.roughness=.9;
       }else if(n==='vitbody'){
        out.map=tex.get('vit_body_bc')||null;out.normalMap=tex.get('vit_body_n')||null;
        out.roughnessMap=tex.get('vit_body_rough')||null;
        out.normalScale.set(.4,.4);out.roughness=.91;
       }else if(n==='vitshirt'){
        // Wine-coloured satin tailoring replaces the flat black/white T-shirt
        // look without changing any scene or supplying a fake 2D overlay.
        out.map=null;out.color.set('#b37c87');out.roughness=.57;out.metalness=.025;
       }else if(n==='vitpants'){
        out.map=null;out.color.set('#65575f');out.roughness=.85;out.metalness=.012;
       }else if(n==='vitshoes'){
        out.map=null;out.color.set('#554448');out.roughness=.42;out.metalness=.04;
       }else if(kind==='hair'||n==='vithair'){
        out.map=tex.get('vit_hair_diffuse')||null;out.normalMap=tex.get('vit_hair_normal')||null;
        out.alphaMap=tex.get('vit_hair_opacity')||null;
        // Keep authored strands warm and legible; multiplying by near-black
        // destroyed the source albedo and made solid black hair curtains.
        out.color.set('#fff0e4');out.normalScale.set(.20,.20);
        out.side=THREE.DoubleSide;out.alphaTest=.63;out.transparent=false;out.depthWrite=true;
        out.roughness=.85;
       }else if(n.startsWith('vitcornea')){
        // Source cornea imported as an opaque white shell. It previously
        // obscured the iris and made both eyes look fluorescent white.
        out.map=null;out.color.set('#ffffff');out.roughness=.08;
        out.metalness=0;out.transparent=true;out.opacity=.09;
        out.depthWrite=false;out.side=THREE.FrontSide;
       }else if(n.startsWith('viteyeback')){
        out.map=null;out.color.set('#362c29');out.roughness=.64;
       }else if(n.startsWith('vitiris')){
        out.map=tex.get('vit_iris')||null;out.color.set('#f8f1e9');out.roughness=.36;
       }else if(n.startsWith('vitsclera')){
        out.map=tex.get('vit_sclera')||null;out.color.set('#e7d8cc');out.roughness=.56;
       }else if(n==='vitmouth'){
        out.map=tex.get('vit_mouth')||null;out.roughness=.72;
       }else return m;
       out.needsUpdate=true;return out;
      };
      obj.material=Array.isArray(obj.material)?obj.material.map(update):update(obj.material);
     });
    }
    materialize(head.scene,'head');
    materialize(body.scene,'body');
    materialize(hair.scene,'hair');
    body.scene.updateMatrixWorld(true);
    // GLTFLoader sanitizes ':' in Mixamo names and may add suffixes for
    // duplicates. Resolve from actual THREE.Bone instances, not raw glTF names.
    const headCandidates:THREE.Bone[]=[];
    body.scene.traverse(node=>{
      if(node instanceof THREE.Bone && /head/i.test(node.name))
        headCandidates.push(node);
    });
    const normalize=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]/g,'');
    const headBone=headCandidates.find(b=>/^mixamorighead(?:\\d+)?$/.test(normalize(b.name)))||
      headCandidates.find(b=>/^head(?:\\d+)?$/.test(normalize(b.name)))||
      headCandidates.find(b=>normalize(b.name).endsWith('head'));
    if(!headBone)throw Error('Human head bone missing: imported rig lacks Head bone');
    const restInverse=headBone.matrixWorld.clone().invert();
    const authored=new THREE.Group();
    // Applying the REST inverse prevents the head model double-translating
    // by its world-space height when mounted to the animated head joint.
    authored.matrixAutoUpdate=false;
    authored.matrix.copy(restInverse);
    authored.add(head.scene);authored.add(hair.scene);
    headBone.add(authored);
    if(!poseVitruvianSeated(body.scene))
     throw Error('Human seated rig incompatible');
    root.add(body.scene);
    // Place the ACTUAL pelvis in the lounge seat, rather than guessing a
    // whole-model offset. The old z=2.28 put hips in front of the chair
    // and left the legs folding over the cushion instead of sitting in it.
    const hips:THREE.Bone[]=[];
    body.scene.traverse(node=>{
      if(node instanceof THREE.Bone &&
         /^(?:mixamorig)?hips(?:\\d+)?$/i.test(node.name.replace(/[^a-z0-9]/gi,'')))
        hips.push(node);
    });
    if(!hips.length)throw Error('Human pelvis bone missing');
    body.scene.updateMatrixWorld(true);
    const pelvisWorld=new THREE.Vector3();
    hips[0].getWorldPosition(pelvisWorld);
    if(!Number.isFinite(pelvisWorld.y))throw Error('Human pelvis transform invalid');
    root.position.set(-pelvisWorld.x,.58/FIGURE_SCALE-pelvisWorld.y,1.70/FIGURE_SCALE-pelvisWorld.z);
    root.updateMatrixWorld(true);
    const morphs:Morph[]=[];
    head.scene.traverse(o=>{
     if(!(o instanceof THREE.Mesh)||!o.morphTargetDictionary||!o.morphTargetInfluences)return;
     morphs.push({mesh:o,targets:new Map(Object.entries(o.morphTargetDictionary))});
    });
    const all=new Set(morphs.flatMap(m=>[...m.targets.keys()]));
    if(!all.has('Eyes_Closed_Max')||!all.has('Mouth_Large_Opened')||
       !all.has('Happy'))throw Error('FACS channels missing');
    if(cancelled){dispose();return;}
    runtime.current={scene:root,headBone,headRest:headBone.rotation.clone(),morphs,textures:maps};
    setScene(root);status.current?.('review');
    callback.current();invalidate();
   }catch(error){
    // Developer-only lab diagnostics; never emit user conversation or sensor data.
    const reason=error instanceof Error?error.message:'unknown_asset_error';
    console.error('[Mira Human LAB]',String(reason).slice(0,240));
    dispose();if(cancelled)return;
    runtime.current=null;setScene(null);status.current?.('rejected');
    callback.current();invalidate();
   }
  }
  void load();
  return ()=>{
   cancelled=true;runtime.current=null;
   // Cleanup only on unmount / lab exit, never mid-render.
   dispose();
  };
 },[invalidate]);
 useEffect(()=>{
  if(!scene)return;
  const id=window.setInterval(()=>{if(!document.hidden)invalidate()},humanMotionCadence(state));
  return ()=>window.clearInterval(id);
 },[scene,state,invalidate]);
 useFrame((_,delta)=>{
  const r=runtime.current;if(!r)return;
  const t=performance.now()*.001;
  const motion=humanMotionFrame(t,state,
    state==='speaking'&&ttsLevel.active?ttsLevel.value:undefined);
  const easing=1-Math.exp(-Math.min(delta,.1)*13);
  jaw.current+=(motion.mouthOpen-jaw.current)*easing;
  const reaction=companionReaction(faceData);
  smile.current+=(Math.min(.32,motion.smile+reaction.smile)-smile.current)*easing;
  const visemes=visemesForSpeech(jaw.current,
    state==='speaking'&&ttsLevel.active?ttsLevel.bands:null);
  r.headBone.rotation.set(r.headRest.x+motion.headPitch,
   r.headRest.y+motion.headYaw,r.headRest.z+reaction.headTilt);
  const poses:Record<string,number>={
   Eyes_Closed_Max:motion.blink,
   Mouth_Large_Opened:jaw.current,
   Jaw_Lower:jaw.current*.22,
   Happy:smile.current,
   Smile_Lips_Closed:smile.current*.35,
   aa_02:visemes.aa,
   ow_08:visemes.oh,
   ey_eh_uh_04:visemes.ee,
   p_b_m_21:visemes.ou*.5,
  };
  for(const entry of r.morphs){
   const dst=entry.mesh.morphTargetInfluences;if(!dst)continue;
   for(const [name,value] of Object.entries(poses)){
    const idx=entry.targets.get(name);
    if(idx!==undefined&&idx<dst.length)dst[idx]=THREE.MathUtils.clamp(value,0,1);
   }
  }
 });
 // The source human faces +Z. Do NOT rotate by PI or the visitor sees its back.
 // Pose / position are computed from the real pelvis bone above.
 return scene?<group rotation={[0,0,0]} scale={FIGURE_SCALE}>
  <primitive object={scene}/>
 </group>:null;
}
