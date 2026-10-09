import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { MiraPresenceScene } from './presence-scene';
import type { MiraState } from '../core/types';
import RoomLuxuryInterior from './RoomLuxuryInterior';
import {moveRoomCamera} from './room-navigation';

// Rigged 3D human is a separate lazy chunk (VRM parser is deliberately not in AppV2).
const RoomMiraVRM = lazy(() => import('./RoomMiraVRM'));
type Controls={yaw:number;pitch:number;x:number;z:number;keys:Set<string>};
const CLAMP=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const KEYS=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
const PRESETS=[
 {yaw:-Math.PI/2,x:-2.9,z:4.1},
 {yaw:0,x:0,z:4.79},
 {yaw:Math.PI/2,x:2.9,z:4.1},
 {yaw:Math.PI,x:0,z:0},
 {yaw:0,x:0,z:5.48},
] as const;
interface Room3DProps {scene:MiraPresenceScene;state:MiraState;onReady:()=>void;onFailure:()=>void;}

class RoomBoundary extends Component<{children:ReactNode;onFailure:()=>void},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(){this.props.onFailure();}
 render(){return this.state.failed?null:this.props.children;}
}

function RoomCamera({controls}:{controls:React.RefObject<Controls>}){
 const camera=useThree(s=>s.camera);
 const invalidate=useThree(s=>s.invalidate);
 useFrame((_,delta)=>{
   const v=controls.current;if(!v)return;
   const dt=Math.min(delta,.06);
   const forward=Number(v.keys.has('KeyW')||v.keys.has('ArrowUp'))
     -Number(v.keys.has('KeyS')||v.keys.has('ArrowDown'));
   const strafe=Number(v.keys.has('KeyD'))-Number(v.keys.has('KeyA'));
   if(v.keys.has('ArrowLeft'))v.yaw+=dt*.9;
   if(v.keys.has('ArrowRight'))v.yaw-=dt*.9;
   if(forward||strafe){
     const next=moveRoomCamera({x:v.x,z:v.z},v.yaw,forward,strafe,dt);
     v.x=next.x;v.z=next.z;
   }
   camera.position.set(v.x,1.77,v.z);
   camera.rotation.set(v.pitch,v.yaw,0,'YXZ');
   if(v.keys.size)invalidate();
 });
 return null;
}

/**
 * First frame is a genuine Three.js scene. No HTML photo, transparent billboard,
 * equirectangular environment or 2D overlay is mounted.
 * The rigged VRM is separate from the 3D architecture; if VRM fails, a fully
 * volumetric geometric avatar is retained (never an unshaded portrait plane).
 */
export default function PhotorealRoom3D({scene,state,onReady,onFailure}:Room3DProps){
 const controls=useRef<Controls>({yaw:0,pitch:0,x:0,z:4.79,keys:new Set()});
 const last=useRef<{pointerId:number;x:number;y:number}|null>(null);
 const stageRef=useRef<HTMLSpanElement>(null);
 const invalidateRef=useRef<(()=>void)|null>(null);
 const detachWebGLRef=useRef<()=>void>(()=>{});
 const onFailureRef=useRef(onFailure);
 onFailureRef.current=onFailure;
 const contextLost=useCallback((event:Event)=>{
   // Unmount the WebGL room and return to the existing accessible photo path.
   event.preventDefault();
   onFailureRef.current();
 },[]);
 useEffect(()=>()=>detachWebGLRef.current(),[]);
 const onReadyRef=useRef(onReady);
 onReadyRef.current=onReady;
 const [avatarStatus,setAvatarStatus]=useState<'pending'|'approved'|'review'|'preview'|'rejected'>('pending');
 const recordAvatarStatus=useCallback((next:typeof avatarStatus)=>setAvatarStatus(next),[]);
 const sceneReady=useCallback(()=>onReadyRef.current(),[]);

 useEffect(()=>{
   const editable=(target:EventTarget|null)=>target instanceof HTMLElement
     &&Boolean(target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"]'));
   const canControl=()=>document.visibilityState==='visible'
     &&document.activeElement===stageRef.current?.closest('button.photo-mira');
   const keydown=(event:KeyboardEvent)=>{
     if(!canControl()||editable(event.target)||event.altKey||event.ctrlKey||event.metaKey)return;
     const n=/^Digit([1-5])$/.exec(event.code);
     if(n){
       event.preventDefault();
       const index=Number(n[1])-1;
       Object.assign(controls.current,PRESETS[index],{pitch:0});
       invalidateRef.current?.();
       return;
     }
     if(!KEYS.has(event.code))return;
     event.preventDefault();
     controls.current.keys.add(event.code);
     invalidateRef.current?.();
   };
   const keyup=(event:KeyboardEvent)=>controls.current.keys.delete(event.code);
   const blur=()=>controls.current.keys.clear();
   const visibility=()=>{if(document.hidden)blur();};
   const outsidePointer=(event:PointerEvent)=>{
     if(stageRef.current && !stageRef.current.contains(event.target as Node)){
       blur();
       stageRef.current.closest<HTMLButtonElement>('button.photo-mira')?.blur();
     }
   };
   window.addEventListener('keydown',keydown);
   document.addEventListener('pointerdown',outsidePointer,true);
   document.addEventListener('visibilitychange',visibility);
   window.addEventListener('keyup',keyup);
   window.addEventListener('blur',blur);
   return ()=>{
     window.removeEventListener('keydown',keydown);
     window.removeEventListener('keyup',keyup);
     window.removeEventListener('blur',blur);
     document.removeEventListener('visibilitychange',visibility);
     document.removeEventListener('pointerdown',outsidePointer,true);
   };
 },[]);
 const pointerDown=(event:ReactPointerEvent<HTMLSpanElement>)=>{
   if(event.pointerType==='mouse' && event.button!==0)return;
   event.stopPropagation();
   // The parent is already a semantic button. Never nest a second tab stop.
   stageRef.current?.closest<HTMLButtonElement>('button.photo-mira')
     ?.focus({preventScroll:true});
   event.currentTarget.setPointerCapture(event.pointerId);
   last.current={pointerId:event.pointerId,x:event.clientX,y:event.clientY};
 };
 const pointerMove=(event:ReactPointerEvent<HTMLSpanElement>)=>{
   const before=last.current;
   if(!before||before.pointerId!==event.pointerId)return;
   event.stopPropagation();
   controls.current.yaw-=CLAMP(event.clientX-before.x,-110,110)*.0058;
   controls.current.pitch=CLAMP(controls.current.pitch-(event.clientY-before.y)*.0037,-.91,.91);
   last.current={pointerId:event.pointerId,x:event.clientX,y:event.clientY};
   invalidateRef.current?.();
 };
 const pointerEnd=(event:ReactPointerEvent<HTMLSpanElement>)=>{
   if(last.current?.pointerId===event.pointerId){
     last.current=null;
     if(event.currentTarget.hasPointerCapture(event.pointerId))
       event.currentTarget.releasePointerCapture(event.pointerId);
   }
   event.stopPropagation();
 };
 return <RoomBoundary onFailure={onFailure}>
   <span ref={stageRef} className="pm-room3d-stage" data-avatar-status={avatarStatus}
     onPointerDown={pointerDown} onPointerMove={pointerMove}
     onPointerUp={pointerEnd} onPointerCancel={pointerEnd}
     onLostPointerCapture={pointerEnd}
     onClick={event=>event.stopPropagation()}>
     <Canvas frameloop="demand" shadows dpr={[1,1.5]}
       camera={{fov:59,near:.08,far:75,position:[0,1.77,4.79]}}
       gl={{alpha:false,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:false}}
       onCreated={({gl,invalidate})=>{
         detachWebGLRef.current();
         gl.domElement.addEventListener('webglcontextlost',contextLost,{passive:false});
         detachWebGLRef.current=()=>gl.domElement.removeEventListener('webglcontextlost',contextLost);
         invalidateRef.current=invalidate;
         gl.toneMapping=THREE.ACESFilmicToneMapping;
         gl.toneMappingExposure=1.35;
         gl.outputColorSpace=THREE.SRGBColorSpace;
         requestAnimationFrame(sceneReady);
       }}>
       <RoomCamera controls={controls}/>
       <RoomLuxuryInterior scene={scene}/>
       <Suspense fallback={null}>
         <RoomMiraVRM state={state} onReady={sceneReady} onAssetStatus={recordAvatarStatus}/>
       </Suspense>
     </Canvas>
   </span>
 </RoomBoundary>;
}
