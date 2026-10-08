import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';

/**
 * A real rigged VRM avatar inside the same 3D room, never an alpha-masked photo.
 * Existing model assets are already committed to /public/avatars/female.
 * This outfit/face is an available model, NOT a reconstruction of the concept portrait.
 */
const MODEL = 'avatars/female/mira_female_02_lavender_lounge.vrm';
type Props = { onReady: () => void };
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
  rotate('leftUpperArm', -.19, .02, 1.06);
  rotate('rightUpperArm', -.32, -.05, -1.08);
  rotate('leftLowerArm', -.60, -.05, .16);
  rotate('rightLowerArm', -.77, .06, -.13);
  rotate('head', .04, -.06, -.07);
  rotate('chest', -.08, .02, .04);
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

export default function RoomMiraVRM({onReady}:Props) {
  const [model,setModel] = useState<VRM | null>(null);
  const [failed,setFailed] = useState(false);
  const ref = useRef<VRM | null>(null);
  const callback = useRef(onReady);
  callback.current=onReady;
  const invalidate = useThree(s=>s.invalidate);
  const camera = useThree(s=>s.camera);

  useEffect(()=>{
    let cancelled=false;
    const loader=new GLTFLoader();
    loader.register(parser=>new VRMLoaderPlugin(parser));
    loader.load(`${import.meta.env.BASE_URL}${MODEL}`,gltf=>{
      const vrm=gltf.userData.vrm as VRM | undefined;
      if(!vrm){if(!cancelled)setFailed(true);return;}
      if(cancelled){VRMUtils.deepDispose(vrm.scene);return;}
      seatedPose(vrm);
      // The female VRM0 facing convention is already established in VRMAvatar.
      vrm.scene.rotation.y=Math.PI;
      vrm.scene.traverse(node=>{
        if('castShadow' in node) (node as {castShadow:boolean}).castShadow=true;
        if('receiveShadow' in node) (node as {receiveShadow:boolean}).receiveShadow=true;
      });
      ref.current=vrm;
      setModel(vrm);
      callback.current();
      invalidate();
    },undefined,()=>{
      if(cancelled)return;
      setFailed(true);
      callback.current();
      invalidate();
    });
    return ()=>{
      cancelled=true;
      const old=ref.current;
      ref.current=null;
      if(old)VRMUtils.deepDispose(old.scene);
    };
  },[invalidate]);

  useFrame((_,delta)=>{
    const vrm=ref.current;
    if(!vrm)return;
    // Only update springs/IK during requested renders; zero idle animation GPU loop.
    vrm.update(Math.min(delta,.05));
    const lookAt=vrm.lookAt;
    if(lookAt)lookAt.target=camera;
  });

  return <group>
    {model ? <group position={[0,.34,1.35]} scale={1.0}>
      <primitive object={model.scene}/>
    </group> : <GeometricFallback />}
    {failed && <group name="vrm-fallback-geometry"/>}
  </group>;
}
