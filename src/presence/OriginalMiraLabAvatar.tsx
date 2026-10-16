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
     lid.position.y=.036-facial.closure*.035;
     lid.scale.y=.013+facial.closure*.034;
   }
   // Iris, pupil and catchlight share a parent: no detached pupils on eye turns.
   for(const eye of [irisLeft.current,irisRight.current]){
     if(!eye)continue;
     eye.position.x=facial.irisX;
     eye.position.y=-.006+facial.irisY;
   }
   for(const brow of [browLeft.current,browRight.current])
     if(brow)brow.position.y=.067+facial.eyebrowLift;
   if(mouth.current){
     mouth.current.scale.x=facial.mouthWidth;
     mouth.current.scale.y=facial.mouthHeight;
     mouth.current.position.y=.128+facial.smileLift*.4;
   }
   if(innerLip.current){
     innerLip.current.scale.x=facial.mouthWidth*.75;
     innerLip.current.scale.y=Math.max(.007,facial.mouthHeight*.72);
     innerLip.current.position.y=.103+facial.smileLift*.5;
   }
 });

 return <group name="mira-original-humanoid-lab-only" position={[0,0,1.78]}>
   {/* Neutral seated silhouette with independently authored shapes. */}
   <group ref={torso} position={[0,.84,0]}>
     <mesh position={[0,.28,-.015]} castShadow receiveShadow scale={[.315,.445,.205]}>
       <sphereGeometry args={[1,38,26]}/>
       <meshPhysicalMaterial color="#28232a" roughness={.79} metalness={.03}
         clearcoat={.08}/>
     </mesh>
     <mesh position={[0,.47,.156]} castShadow scale={[.20,.17,.048]}>
       <sphereGeometry args={[1,24,16]}/>
       <meshStandardMaterial color="#d6ab96" roughness={.92}/>
     </mesh>
     <mesh position={[0,.005,0]} castShadow scale={[.32,.18,.23]}>
       <sphereGeometry args={[1,28,20]}/>
       <meshStandardMaterial color="#202027" roughness={.87}/>
     </mesh>
   </group>
   <mesh position={[0,.93,.055]} castShadow scale={[.29,.14,.235]}>
     <sphereGeometry args={[1,24,18]}/>
     <meshStandardMaterial color="#25232a" roughness={.91}/>
   </mesh>
   {/* Arm pivots use the same verified state blending as the VRM route. */}
   {([-1,1] as const).map((side)=>{
     const ref=side<0?leftArm:rightArm;
     return <group key={side} ref={ref} position={[side*.285,1.26,.01]}>
       <mesh position={[side*.085,-.215,.055]} rotation={[.28,0,side*-.08]}
         castShadow scale={[.108,.29,.12]}>
         <sphereGeometry args={[1,20,14]}/>
         <meshStandardMaterial color="#29242c" roughness={.84}/>
       </mesh>
       <mesh position={[side*.24,-.46,-.035]} rotation={[-.25,0,side*-.30]}
         castShadow scale={[.084,.245,.096]}>
         <sphereGeometry args={[1,20,14]}/>
         <meshStandardMaterial color="#29242c" roughness={.84}/>
       </mesh>
       {/* Contact: hand centre x=±.665, y=.76, z=1.74; bottom tangent at armrest top y=.695. */}
       <mesh position={[side*.38,-.50,-.05]} castShadow scale={[.060,.057,.092]}>
         <sphereGeometry args={[1,20,14]}/>
         <meshStandardMaterial color="#d5aa94" roughness={.84}/>
       </mesh>
     </group>;
   })}
   {/* Lap and shins are genuine 3D geometry, not a photographic plane. */}
   {([-1,1] as const).map(side=><group key={side}>
     <mesh position={[side*.165,.665,.265]} rotation={[.90,0,side*.06]}
       castShadow scale={[.13,.285,.136]}>
       <sphereGeometry args={[1,24,18]}/>
       <meshStandardMaterial color="#25232a" roughness={.89}/>
     </mesh>
     <mesh position={[side*.171,.37,.48]} castShadow scale={[.105,.28,.107]}>
       <sphereGeometry args={[1,24,18]}/>
       <meshStandardMaterial color="#d0a38f" roughness={.92}/>
     </mesh>
     <mesh position={[side*.17,.09,.57]} castShadow scale={[.113,.068,.17]}>
       <sphereGeometry args={[1,22,16]}/>
       <meshStandardMaterial color="#342a30" roughness={.70}/>
     </mesh>
   </group>)}
   <mesh position={[0,1.315,.02]} castShadow scale={[.092,.145,.09]}>
     <sphereGeometry args={[1,22,16]}/>
     <meshStandardMaterial color="#d5a38c" roughness={.91}/>
   </mesh>
   <group ref={head} position={[0,1.33,.03]}>
     {/* Full head / jaw profile in true geometry. */}
     <mesh position={[0,.275,0]} castShadow receiveShadow
       scale={[.224,.29,.204]}>
       <sphereGeometry args={[1,48,36]}/>
       <meshPhysicalMaterial color="#d5a38e" roughness={.86}
         clearcoat={.045} clearcoatRoughness={.88}/>
     </mesh>
     <mesh position={[0,.091,.065]} castShadow scale={[.151,.092,.124]}>
       <sphereGeometry args={[1,32,24]}/>
       <meshStandardMaterial color="#d6a58f" roughness={.89}/>
     </mesh>
     {([-1,1] as const).map(side=><group key={side}>
       <group position={[side*.102,.331,.179]}>
         <mesh scale={[.054,.035,.025]}>
           <sphereGeometry args={[1,24,20]}/>
           <meshPhysicalMaterial color="#efe5dc" roughness={.28} clearcoat={.45}/>
         </mesh>
         <group ref={side<0?irisLeft:irisRight} position={[0,-.006,0]}>
           <mesh position={[0,0,.027]} scale={[.020,.024,.008]}>
             <sphereGeometry args={[1,22,16]}/>
             <meshPhysicalMaterial color="#493832" roughness={.31} clearcoat={.55}/>
           </mesh>
           <mesh position={[0,0,.037]} scale={[.009,.011,.005]}>
             <sphereGeometry args={[1,16,12]}/>
             <meshBasicMaterial color="#19151a"/>
           </mesh>
           <mesh position={[-.006,.008,.041]} scale={[.003,.004,.002]}>
             <sphereGeometry args={[1,12,10]}/>
             <meshBasicMaterial color="#ffffff"/>
           </mesh>
         </group>
         <mesh ref={side<0?leftLid:rightLid} position={[0,.036,.037]}
           scale={[.064,.013,.026]}>
           <sphereGeometry args={[1,20,12]}/>
           <meshStandardMaterial color="#d4a08b" roughness={.85}/>
         </mesh>
         <mesh position={[0,-.031,.031]} scale={[.052,.008,.020]}>
           <sphereGeometry args={[1,20,12]}/>
           <meshStandardMaterial color="#c99282" roughness={.90}/>
         </mesh>
         <mesh ref={side<0?browLeft:browRight}
           position={[0,.067,.011]} rotation={[0,0,side*-.13]}
           scale={[.067,.013,.027]}>
           <sphereGeometry args={[1,16,10]}/>
           <meshStandardMaterial color="#34272b" roughness={.92}/>
         </mesh>
       </group>
       <mesh position={[side*.155,.215,.145]} scale={[.041,.029,.047]}>
         <sphereGeometry args={[1,22,16]}/>
         <meshPhysicalMaterial color="#d29b88" roughness={.94}/>
       </mesh>
       <mesh position={[side*.219,.257,.014]} scale={[.037,.065,.031]}>
         <sphereGeometry args={[1,20,12]}/>
         <meshStandardMaterial color="#d5a18c" roughness={.91}/>
       </mesh>
     </group>)}
     <mesh position={[0,.248,.208]} castShadow scale={[.025,.047,.033]}>
       <sphereGeometry args={[1,22,16]}/>
       <meshStandardMaterial color="#d1a18b" roughness={.90}/>
     </mesh>
     <mesh ref={mouth} position={[0,.128,.204]} scale={[.07,.009,.029]}>
       <sphereGeometry args={[1,26,16]}/>
       <meshStandardMaterial color="#693b43" roughness={.77}/>
     </mesh>
     <mesh ref={innerLip} position={[0,.104,.224]} scale={[.052,.008,.024]}>
       <sphereGeometry args={[1,20,12]}/>
       <meshStandardMaterial color="#b7787e" roughness={.77}/>
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
