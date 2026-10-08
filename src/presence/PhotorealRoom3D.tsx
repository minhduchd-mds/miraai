import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { MiraPresenceScene } from './presence-scene';
import RoomLuxuryInterior from './RoomLuxuryInterior';

// Rigged 3D human is a separate lazy chunk (VRM parser is deliberately not in AppV2).
const RoomMiraVRM = lazy(() => import('./RoomMiraVRM'));
type Controls={yaw:number;pitch:number;x:number;z:number;keys:Set<string>};
const CLAMP=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const KEYS=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
const PRESETS=[
 {yaw:-Math.PI/2,x:-1.8,z:3.8},
 {yaw:0,x:0,z:5.12},
 {yaw:Math.PI/2,x:1.8,z:3.8},
 {yaw:Math.PI,x:0,z:0},
 {yaw:0,x:0,z:5.48},
] as const;
interface Room3DProps {scene:MiraPresenceScene;onReady:()=>void;onFailure:()=>void;}

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
     const speed=2.15*dt;
     v.x=CLAMP(v.x+(-Math.sin(v.yaw)*forward+Math.cos(v.yaw)*strafe)*speed,-4.45,4.45);
     v.z=CLAMP(v.z+(-Math.cos(v.yaw)*forward+Math.sin(v.yaw)*strafe)*speed,-5.15,5.55);
   }
   camera.position.set(v.x,1.68,v.z);
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
export default function PhotorealRoom3D({scene,onReady,onFailure}:Room3DProps){
 const controls=useRef<Controls>({yaw:0,pitch:0,x:0,z:5.12,keys:new Set()});
 const last=useRef<{pointerId:number;x:number;y:number}|null>(null);
 const invalidateRef=useRef<(()=>void)|null>(null);
 const onReadyRef=useRef(onReady);
 onReadyRef.current=onReady;
 const [viewPreset,setViewPreset]=useState(1);
 const sceneReady=useCallback(()=>onReadyRef.current(),[]);

 useEffect(()=>{
   const editable=(target:EventTarget|null)=>target instanceof HTMLElement
     &&(target.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target.tagName));
   const keydown=(event:KeyboardEvent)=>{
     if(editable(event.target))return;
     const n=/^Digit([1-5])$/.exec(event.code);
     if(n){
       const index=Number(n[1])-1;
       Object.assign(controls.current,PRESETS[index],{pitch:0});
       setViewPreset(index);
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
   window.addEventListener('keydown',keydown);
   window.addEventListener('keyup',keyup);
   window.addEventListener('blur',blur);
   return ()=>{
     window.removeEventListener('keydown',keydown);
     window.removeEventListener('keyup',keyup);
     window.removeEventListener('blur',blur);
   };
 },[]);
 const pointerDown=(event:ReactPointerEvent<HTMLSpanElement>)=>{
   event.stopPropagation();
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
   if(last.current?.pointerId===event.pointerId)last.current=null;
   event.stopPropagation();
 };
 return <RoomBoundary onFailure={onFailure}>
   <span className="pm-room3d-stage" aria-label="Mira Home 3D. Kéo chuột xoay 360 độ, dùng WASD để di chuyển."
     onPointerDown={pointerDown} onPointerMove={pointerMove}
     onPointerUp={pointerEnd} onPointerCancel={pointerEnd}
     onClick={event=>event.stopPropagation()}>
     <Canvas frameloop="demand" shadows dpr={[1,1.5]}
       camera={{fov:63,near:.08,far:75,position:[0,1.68,5.12]}}
       gl={{alpha:false,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:false}}
       onCreated={({gl,invalidate})=>{
         invalidateRef.current=invalidate;
         gl.toneMapping=THREE.ACESFilmicToneMapping;
         gl.toneMappingExposure=1.35;
         gl.outputColorSpace=THREE.SRGBColorSpace;
         requestAnimationFrame(sceneReady);
       }}>
       <RoomCamera controls={controls}/>
       <RoomLuxuryInterior scene={scene}/>
       <Suspense fallback={null}>
         <RoomMiraVRM onReady={sceneReady}/>
       </Suspense>
     </Canvas>
     <span className="pm-room3d-hud" aria-hidden="true">MIRA HOME · PHÒNG 3D THẬT · KÉO XOAY · WASD · 1–5 GÓC NHÌN</span>
     <span className="pm-room3d-gallery" aria-hidden="true">
       {['Trái 90°','Chính diện','Phải 90°','Sau 180°','Toàn cảnh'].map((label,index)=>
         <span key={label} className={index===viewPreset?'is-selected':''}>{label}</span>)}
     </span>
   </span>
 </RoomBoundary>;
}
