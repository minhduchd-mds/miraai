import {useEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {MiraState} from '../core/types';
import {ttsLevel} from '../core/audio-level';
import {createCharacterDirector} from './character-director';
import {createCharacterGaze} from './character-gaze';
import {createVisemeEnvelope} from './viseme-envelope';
import {humanMotionFrame,humanMotionCadence} from './realistic-human-motion';
import {visemesForSpeech} from './tts-visemes';
import {createOriginalFaceController} from './original-human-face-motion';
import OriginalMiraLimb from './OriginalMiraLimb';
import {seatedArm,seatedLeg} from './original-human-limb-pose';
import type {Point3} from './original-human-limb-pose';
import {createOriginalHeadGeometry} from './original-human-head-geometry';

type Props={
 state:MiraState;
 onReady:()=>void;
 onAssetStatus?:(status:'review')=>void;
};

/**
 * Mira-owned procedural geometry research avatar.
 *
 * This isn't photorealism and does not pretend to be an approved production
 * likeness. No downloaded mesh, photo texture, proprietary animation, camera
 * feed or reference artwork participates in this render.
 *
 * Developer preview: ?room3d=1&originalHumanLab=1
 */
export default function OriginalMiraLabAvatar({state,onReady,onAssetStatus}:Props){
 const head=useRef<THREE.Group>(null);
 const torso=useRef<THREE.Group>(null);
 const leftArm=useRef<THREE.Group>(null);
 const rightArm=useRef<THREE.Group>(null);
 const leftLid=useRef<THREE.Mesh>(null);
 const rightLid=useRef<THREE.Mesh>(null);
 const irisLeft=useRef<THREE.Group>(null);
 const irisRight=useRef<THREE.Group>(null);
 const browLeft=useRef<THREE.Mesh>(null);
 const browRight=useRef<THREE.Mesh>(null);
 const mouth=useRef<THREE.Mesh>(null);
 const innerLip=useRef<THREE.Mesh>(null);
 const director=useRef(createCharacterDirector());
 const gaze=useRef(createCharacterGaze());
 const lips=useRef(createVisemeEnvelope());
 const face=useRef(createOriginalFaceController());
 const originalHead=useMemo(()=>createOriginalHeadGeometry(),[]);
 useEffect(()=>()=>originalHead.dispose(),[originalHead]);
 const jaw=useRef(0);
 const invalidate=useThree(s=>s.invalidate);
 const ready=useRef(onReady);ready.current=onReady;
 const status=useRef(onAssetStatus);status.current=onAssetStatus;
 // All long locks are anchored beside or behind the face, never across the
 // central eyes, nose or mouth. This fixes the first six-view screenshot's
 // barcode-like forehead curtain and leaves the facial landmarks visible.
 const hairCurves=useMemo(()=>[-1,1].flatMap(side=>
   Array.from({length:5},(_,i)=>{
     const spread=i/4;
     const x=side*(.195+.048*spread);
     return new THREE.CatmullRomCurve3([
       new THREE.Vector3(x,.455,-.050),
       new THREE.Vector3(side*(.227+.025*spread),.355,-.065),
       new THREE.Vector3(side*(.232+.045*spread),.18,-.110),
       new THREE.Vector3(side*(.235+.050*spread),.035,-.155),
     ]);
   })
 ),[]);
 useEffect(()=>{
   status.current?.('review');
   ready.current();
 },[]);
 useEffect(()=>{
   const interval=window.setInterval(()=>{
     if(!document.hidden)invalidate();
   },humanMotionCadence(state));
   return ()=>window.clearInterval(interval);
 },[invalidate,state]);

 useFrame((_,delta)=>{
   const now=performance.now()*.001;
   const energy=state==='speaking'&&ttsLevel.active?ttsLevel.value:undefined;
   const motion=humanMotionFrame(now,state,energy);
   const cues=director.current.sample(now,state,energy);
   const gazeOffset=gaze.current.sample(now,state);
   const k=1-Math.exp(-Math.min(Math.max(delta,0),.12)*15);
   jaw.current+=(motion.mouthOpen-jaw.current)*k;
   const shapes=lips.current.update(visemesForSpeech(jaw.current,
     state==='speaking'&&ttsLevel.active?ttsLevel.bands:null),delta);
   if(head.current){
     head.current.rotation.set(motion.headPitch+cues.headPitch,
       motion.headYaw+cues.headYaw,cues.headRoll);
   }
   if(torso.current){
     torso.current.rotation.x=motion.breathing;
     torso.current.rotation.z=cues.chestRoll;
   }
   if(leftArm.current)leftArm.current.rotation.set(cues.leftArmX,0,cues.leftArmZ);
   if(rightArm.current)rightArm.current.rotation.set(cues.rightArmX,0,cues.rightArmZ);
   const facial=face.current.sample({
     seconds:now,dt:delta,gaze:gazeOffset,visemes:shapes,
     smile:motion.smile,speaking:state==='speaking',
   });
   for(const lid of [leftLid.current,rightLid.current]){
     if(!lid)continue;
     lid.position.y=.029-facial.closure*.023;
     lid.scale.y=.010+facial.closure*.032;
   }
   // Iris, pupil and catchlight share a parent: no detached pupils on eye turns.
   for(const eye of [irisLeft.current,irisRight.current]){
     if(!eye)continue;
     eye.position.x=facial.irisX;
     eye.position.y=-.006+facial.irisY;
   }
   for(const brow of [browLeft.current,browRight.current])
     if(brow)brow.position.y=.061+facial.eyebrowLift;
   if(mouth.current){
     mouth.current.scale.x=facial.mouthWidth;
     mouth.current.scale.y=facial.mouthHeight;
     mouth.current.position.y=.126+facial.smileLift*.4;
   }
   if(innerLip.current){
     innerLip.current.scale.x=facial.mouthWidth*.75;
     innerLip.current.scale.y=Math.max(.007,facial.mouthHeight*.72);
     innerLip.current.position.y=.114+facial.smileLift*.5;
   }
 });

 return <group name="mira-original-humanoid-lab-only" position={[0,0,1.78]}>
   {/* Neutral seated silhouette with independently authored shapes. */}
   <group ref={torso} position={[0,.84,0]}>
     <mesh position={[0,.25,-.015]} castShadow receiveShadow scale={[.268,.325,.185]}>
       <sphereGeometry args={[1,38,26]}/>
       <meshPhysicalMaterial color="#28232a" roughness={.79} metalness={.03}
         clearcoat={.08}/>
     </mesh>
     <mesh position={[0,.46,.157]} castShadow scale={[.105,.067,.034]}>
       <sphereGeometry args={[1,24,16]}/>
       <meshStandardMaterial color="#d6ab96" roughness={.92}/>
     </mesh>
     <mesh position={[0,.005,0]} castShadow scale={[.268,.155,.195]}>
       <sphereGeometry args={[1,28,20]}/>
       <meshStandardMaterial color="#202027" roughness={.87}/>
     </mesh>
   </group>
   <mesh position={[0,.93,.055]} castShadow scale={[.255,.12,.198]}>
     <sphereGeometry args={[1,24,18]}/>
     <meshStandardMaterial color="#25232a" roughness={.91}/>
   </mesh>
   {/* Shoulder, elbow, wrist and four fingers are physically connected.
        This replaces disconnected, rotated giant oval arm/leg placeholders. */}
   {([-1,1] as const).map((side)=>{
     const arm=seatedArm(side);
     const relative=(p:Point3):Point3=>[
       p[0]-arm.shoulder[0],p[1]-arm.shoulder[1],p[2]-arm.shoulder[2]
     ];
     const elbow=relative(arm.elbow),wrist=relative(arm.wrist),hand=relative(arm.hand);
     const ref=side<0?leftArm:rightArm;
     return <group key={side} ref={ref} position={arm.shoulder}>
       <OriginalMiraLimb from={[0,0,0]} to={elbow}
         startRadius={.088} endRadius={.073} color="#29242c"/>
       <mesh position={elbow} castShadow scale={[.075,.073,.078]}>
         <sphereGeometry args={[1,18,14]}/>
         <meshStandardMaterial color="#29242c" roughness={.87}/>
       </mesh>
       <OriginalMiraLimb from={elbow} to={wrist}
         startRadius={.073} endRadius={.052} color="#29242c"/>
       <mesh position={wrist} castShadow scale={[.057,.047,.055]}>
         <sphereGeometry args={[1,18,14]}/>
         <meshStandardMaterial color="#29242c" roughness={.86}/>
       </mesh>
       <OriginalMiraLimb from={wrist} to={hand}
         startRadius={.054} endRadius={.051} color="#d5aa94" roughness={.88}/>
       <mesh position={hand} castShadow scale={[.063,.055,.069]}>
         <sphereGeometry args={[1,20,16]}/>
         <meshStandardMaterial color="#d5aa94" roughness={.88}/>
       </mesh>
       {[-1.5,-.5,.5,1.5].map((index)=>
         <OriginalMiraLimb key={index}
           from={[hand[0]+index*.026,hand[1]-.018,hand[2]+.042]}
           to={[hand[0]+index*.027,hand[1]-.029,hand[2]+.110-Math.abs(index)*.012]}
           startRadius={.012} endRadius={.009} color="#d5aa94" roughness={.89}/>
       )}
     </group>;
   })}
   {/* Connected tapered thigh, knee, shin and ankle; measured against chair. */}
   {([-1,1] as const).map(side=>{
     const leg=seatedLeg(side);
     return <group key={side}>
       <OriginalMiraLimb from={leg.hip} to={leg.knee}
         startRadius={.132} endRadius={.102} color="#26232b" roughness={.88}/>
       <mesh position={leg.knee} castShadow scale={[.101,.098,.104]}>
         <sphereGeometry args={[1,18,14]}/>
         <meshStandardMaterial color="#26232b" roughness={.87}/>
       </mesh>
       <OriginalMiraLimb from={leg.knee} to={leg.ankle}
         startRadius={.095} endRadius={.069} color="#d0a38f" roughness={.91}/>
       <mesh position={leg.ankle} castShadow scale={[.070,.075,.069]}>
         <sphereGeometry args={[1,18,14]}/>
         <meshStandardMaterial color="#d0a38f" roughness={.89}/>
       </mesh>
       <mesh position={leg.foot} castShadow scale={[.12,.068,.175]}>
         <sphereGeometry args={[1,24,16]}/>
         <meshStandardMaterial color="#342a30" roughness={.76}/>
       </mesh>
     </group>;
   })}
   <mesh name="mira-neck" position={[0,1.326,.012]} castShadow>
     <cylinderGeometry args={[.070,.079,.190,28,1]}/>
     <meshStandardMaterial color="#d5a38c" roughness={.91}/>
   </mesh>
   <group ref={head} position={[0,1.33,.03]}>
     {/* Full head / jaw profile in true geometry. */}
     <mesh name="original-continuous-face" position={[0,.275,0]}
       geometry={originalHead} castShadow receiveShadow>
       <meshPhysicalMaterial color="#d5a38e" roughness={.86}
         clearcoat={.045} clearcoatRoughness={.88}/>
     </mesh>
     {([-1,1] as const).map(side=><group key={side}>
       <group position={[side*.102,.331,.163]}>
         <mesh scale={[.045,.025,.014]}>
           <sphereGeometry args={[1,24,20]}/>
           <meshPhysicalMaterial color="#efe5dc" roughness={.28} clearcoat={.45}/>
         </mesh>
         <group ref={side<0?irisLeft:irisRight} position={[0,-.006,0]}>
           <mesh position={[0,0,.017]} scale={[.016,.019,.006]}>
             <sphereGeometry args={[1,22,16]}/>
             <meshPhysicalMaterial color="#493832" roughness={.31} clearcoat={.55}/>
           </mesh>
           <mesh position={[0,0,.025]} scale={[.007,.009,.003]}>
             <sphereGeometry args={[1,16,12]}/>
             <meshBasicMaterial color="#19151a"/>
           </mesh>
           <mesh position={[-.005,.007,.029]} scale={[.003,.004,.002]}>
             <sphereGeometry args={[1,12,10]}/>
             <meshBasicMaterial color="#ffffff"/>
           </mesh>
         </group>
         <mesh ref={side<0?leftLid:rightLid} position={[0,.029,.022]}
           scale={[.050,.010,.014]}>
           <sphereGeometry args={[1,20,12]}/>
           <meshStandardMaterial color="#d4a08b" roughness={.85}/>
         </mesh>
         <mesh position={[0,-.026,.020]} scale={[.047,.007,.012]}>
           <sphereGeometry args={[1,20,12]}/>
           <meshStandardMaterial color="#c99282" roughness={.90}/>
         </mesh>
         <mesh ref={side<0?browLeft:browRight}
           position={[0,.061,.005]} rotation={[0,0,side*-.08]}
           scale={[.056,.007,.013]}>
           <sphereGeometry args={[1,16,10]}/>
           <meshStandardMaterial color="#34272b" roughness={.92}/>
         </mesh>
       </group>

       <mesh position={[side*.219,.257,.014]} scale={[.027,.050,.025]}>
         <sphereGeometry args={[1,20,12]}/>
         <meshStandardMaterial color="#d5a18c" roughness={.91}/>
       </mesh>
     </group>)}

     <mesh ref={mouth} position={[0,.126,.180]} scale={[.067,.009,.020]}>
       <sphereGeometry args={[1,26,16]}/>
       <meshStandardMaterial color="#875357" roughness={.82}/>
     </mesh>
     <mesh ref={innerLip} position={[0,.114,.181]} scale={[.050,.008,.018]}>
       <sphereGeometry args={[1,20,12]}/>
       <meshStandardMaterial color="#b77b78" roughness={.84}/>
     </mesh>
     {/* Original lightweight hair volume, individually modeled strands. */}
     <mesh position={[0,.451,-.077]} castShadow scale={[.241,.155,.221]}>
       <sphereGeometry args={[1,40,28]}/>
       <meshStandardMaterial color="#292029" roughness={.76}/>
     </mesh>
     <mesh position={[0,.262,-.165]} castShadow scale={[.222,.305,.142]}>
       <sphereGeometry args={[1,36,24]}/>
       <meshStandardMaterial color="#292028" roughness={.84}/>
     </mesh>
     {hairCurves.map((curve,i)=><mesh key={i} castShadow={i%3===0}>
       <tubeGeometry args={[curve,18,.009+(i%3)*.002,6,false]}/>
       <meshStandardMaterial color={i%4===0?'#44313a':'#2b212b'} roughness={.78}/>
     </mesh>)}
   </group>
 </group>;
}
