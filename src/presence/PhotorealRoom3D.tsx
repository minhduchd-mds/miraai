import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { MiraPresenceScene } from './presence-scene';

type Controls = {yaw:number;pitch:number;x:number;z:number;keys:Set<string>};
const CLAMP=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
const MOVE_KEYS=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
const COMPANION_ROOM_SIZE={width:10,depth:12,height:3.8} as const;

export interface Room3DProps {
  scene: MiraPresenceScene;
  onReady:()=>void;
  onFailure:()=>void;
}

class RoomBoundary extends Component<{children:ReactNode;onFailure:()=>void},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){this.props.onFailure();}
  render(){return this.state.failed?null:this.props.children;}
}

function Box({at,size,color,roughness=.84,metalness=0}:{
  at:[number,number,number];size:[number,number,number];color:string;roughness?:number;metalness?:number;
}){
  return <mesh position={at} castShadow receiveShadow>
    <boxGeometry args={size}/>
    <meshStandardMaterial color={color} roughness={roughness} metalness={metalness}/>
  </mesh>;
}

function Plant({x,z}:{x:number;z:number}){
  return <group position={[x,0,z]}>
    <mesh position={[0,.27,0]} castShadow><cylinderGeometry args={[.23,.19,.53,10]}/><meshStandardMaterial color="#8a7260"/></mesh>
    <mesh position={[0,.96,0]}><cylinderGeometry args={[.055,.08,1.02,7]}/><meshStandardMaterial color="#45352c"/></mesh>
    <mesh position={[0,1.42,0]} castShadow><sphereGeometry args={[.54,9,7]}/><meshStandardMaterial color="#355844" roughness={.97}/></mesh>
    <mesh position={[-.28,1.16,.12]}><sphereGeometry args={[.32,8,6]}/><meshStandardMaterial color="#496b4d"/></mesh>
  </group>;
}

function WindowCity({night}:{night:boolean}){
  const towers=[.32,.61,.48,.75,.37,.57,.9,.54,.78,.43,.69,.36];
  return <group position={[-4.91,1.94,-2.1]} rotation={[0,Math.PI/2,0]}>
    <mesh position={[0,0,0]}><planeGeometry args={[4.45,2.4]}/>
      <meshBasicMaterial color={night?'#152947':'#91bdd0'} side={THREE.DoubleSide}/></mesh>
    {towers.map((h,i)=><Box key={i} at={[-2.06+i*.375,-.93+h*.78,.014]}
      size={[.26,h*1.5,.045]} color={night?'#293449':'#637789'}/>)}
    {night && towers.flatMap((h,i)=>Array.from({length:3},(_,j)=>
      <mesh key={`${i}-${j}`} position={[-2.08+i*.375,-.98+h*.57+j*.24,.04]}>
        <planeGeometry args={[.045,.063]}/><meshBasicMaterial color="#e6bd79"/>
      </mesh>))}
    <Box at={[0,0,.09]} size={[.045,2.55,.12]} color="#443a33"/>
    <Box at={[0,0,.1]} size={[4.57,.043,.12]} color="#443a33"/>
    <Box at={[0,-1.23,.13]} size={[4.7,.18,.28]} color="#6e5948"/>
  </group>;
}


// Art direction grounded in the approved MiraAI room concept.
// The portrait below is a photographic billboard, NOT a reconstructed 3D human.
// Real facial likeness from every camera angle requires an authored VRM/GLB avatar.
function MiraPortrait({onReady}:{onReady:()=>void}){
  const src = `${import.meta.env.BASE_URL}mira-assets/reference/mira_concept_portrait.webp`;
  const image = useLoader(THREE.TextureLoader,src);
  const fade = useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
    const context=canvas.getContext('2d');
    if(context){
      const gradient=context.createRadialGradient(128,120,45,128,130,128);
      gradient.addColorStop(0,'#ffffff');gradient.addColorStop(.62,'#ffffff');
      gradient.addColorStop(.84,'#bfbfbf');gradient.addColorStop(1,'#000000');
      context.fillStyle=gradient;context.fillRect(0,0,256,256);
    }
    return new THREE.CanvasTexture(canvas);
  },[]);
  useEffect(()=>()=>fade.dispose(),[fade]);
  useEffect(()=>{
    image.colorSpace=THREE.SRGBColorSpace;image.needsUpdate=true;
    // Avoid hiding the photographic fallback before the actual Mira portrait loads.
    const id=requestAnimationFrame(onReady);
    return ()=>cancelAnimationFrame(id);
  },[image,onReady]);
  return <group position={[0,0,1.38]}>
    <mesh position={[0,1.05,-.20]} scale={[.98,.7,.47]}>
      <sphereGeometry args={[1,26,16]}/>
      <meshStandardMaterial color="#e9d6cf" roughness={.98}/>
    </mesh>
    <mesh position={[0,2.0,.07]}>
      <planeGeometry args={[2.38,2.22]}/>
      <meshBasicMaterial map={image} alphaMap={fade} side={THREE.DoubleSide}
        depthWrite={false} transparent toneMapped={false}/>
    </mesh>
    <mesh position={[0,.64,-.29]} scale={[.82,.55,.6]}>
      <sphereGeometry args={[1,26,16]}/>
      <meshStandardMaterial color="#e4d7c9" roughness={.92}/>
    </mesh>
  </group>;
}

function InteriorStyling({night}:{night:boolean}){
  const brass='#b9986e',cream='#d3beb0',wood='#876549',walnut='#5a3c30';
  return <>
    {/* Crown ceiling and warm elliptical light, matching the concept's signature ring. */}
    <mesh position={[0,3.7,-.88]} rotation={[-Math.PI/2,0,0]}>
      <torusGeometry args={[2.08,.095,8,72]}/>
      <meshStandardMaterial color="#fff1c6" emissive="#ffb96d" emissiveIntensity={1.45}/>
    </mesh>
    <mesh position={[0,3.72,-.88]} rotation={[-Math.PI/2,0,0]}>
      <torusGeometry args={[2.33,.018,6,72]}/>
      <meshStandardMaterial color={brass} metalness={.64} roughness={.24}/>
    </mesh>
    {/* Vertical walnut slats and indirect light behind the bed. */}
    <Box at={[1.25,1.75,-5.91]} size={[4.8,2.64,.13]} color={walnut}/>
    {Array.from({length:27},(_,i)=><Box key={`slat-${i}`}
      at={[-1.08+i*.177,1.75,-5.78]} size={[.046,2.6,.05]} color={i%3===0?'#a47b57':'#755039'}/>)}
    <Box at={[1.25,2.80,-5.72]} size={[4.52,.045,.12]} color="#ffe0a1"/>
    {/* Tall side-window, curtains, distant navy city and warm interior trim. */}
    {Array.from({length:7},(_,i)=>
      <Box key={`curtain-${i}`} at={[-4.6+i*.09,1.86,-.5]}
        size={[.055,2.85,.14]} color="#c9b0a1"/>)}
    <Box at={[-4.83,3.2,-1.38]} size={[.13,.1,4.55]} color={brass}/>
    {/* Sofa and pink textiles on the left of camera. */}
    <Box at={[-3.03,.40,.55]} size={[2.25,.75,1.16]} color={cream}/>
    <Box at={[-3.03,.93,.04]} size={[2.29,.76,.18]} color="#bb9f91"/>
    <Box at={[-4.13,.67,.55]} size={[.27,.55,1.2]} color="#c6aca0"/>
    <Box at={[-1.92,.67,.55]} size={[.27,.55,1.2]} color="#c6aca0"/>
    {[-3.69,-3.03,-2.37].map((x,i)=>
      <Box key={`sofa-pillow-${i}`} at={[x,.95,.46]} size={[.53,.43,.23]}
        color={i===1?'#dfb9b0':'#dec9b8'}/>)}
    <Box at={[-3.05,.23,.63]} size={[2.53,.09,1.6]} color="#c4b1a3"/>
    {/* Small workstation behind Mira with a glowing monitor. */}
    <Box at={[-2.45,.8,-3.00]} size={[2.16,.11,1.08]} color={wood}/>
    <Box at={[-2.45,.37,-3.40]} size={[.12,.68,.13]} color={walnut}/>
    <Box at={[-1.55,.37,-3.40]} size={[.12,.68,.13]} color={walnut}/>
    <Box at={[-3.30,.37,-3.40]} size={[.12,.68,.13]} color={walnut}/>
    <Box at={[-2.45,1.33,-3.37]} size={[1.2,.76,.09]} color="#181d2e"/>
    <Box at={[-2.45,1.33,-3.31]} size={[1.08,.63,.015]} color="#203956" metalness={.11}/>
    <Box at={[-2.45,.99,-3.31]} size={[.7,.025,.02]} color="#d9afad"/>
    {/* Right wardrobe, decorative illuminated shelving and small neon heart. */}
    <Box at={[4.5,1.82,-3.25]} size={[.58,3.28,2.05]} color="#705144"/>
    {[.54,1.43,2.32].map((y,i)=><Box key={`closet-shelf-${i}`}
      at={[4.18,y,-3.13]} size={[.95,.08,2.0]} color={wood}/>)}
    <Box at={[4.11,1.67,-2.24]} size={[.04,2.7,.04]} color="#ffc980"/>
    <mesh position={[2.85,2.25,-5.62]} rotation={[0,0,Math.PI/4]}>
      <torusGeometry args={[.18,.032,6,40,Math.PI*1.2]}/>
      <meshBasicMaterial color="#ff91cd"/>
    </mesh>
    {/* Foreground marble desk, laptop, notebook and candle. */}
    <Box at={[.0,.80,2.68]} size={[4.1,.14,1.58]} color="#e9ded7" roughness={.23}/>
    <Box at={[-1.74,.39,2.67]} size={[.15,.77,1.34]} color={walnut}/>
    <Box at={[1.76,.39,2.67]} size={[.15,.77,1.34]} color={walnut}/>
    {Array.from({length:9},(_,i)=><Box key={`marble-${i}`}
      at={[-1.85+i*.47,.878,2.59+Math.sin(i*1.8)*.21]}
      size={[.23,.004,.008]} color="#a69898"/>)}
    <Box at={[.0,.87,2.79]} size={[1.20,.035,.43]} color="#aa8b9e"/>
    {Array.from({length:12},(_,i)=><Box key={`keyboard-${i}`}
      at={[-.54+i*.10,.895,2.69]} size={[.074,.01,.14]} color="#eee1ec"/>)}
    <Box at={[1.13,.88,2.98]} size={[.6,.035,.83]} color="#3e3a42"/>
    <Box at={[1.13,1.20,3.34]} size={[.62,.57,.035]} color="#504753"/>
    <mesh position={[-1.53,1.0,2.94]}>
      <cylinderGeometry args={[.13,.11,.19,12]}/>
      <meshStandardMaterial color="#f6ded4" roughness={.31}/>
    </mesh>
    <mesh position={[-1.53,1.17,2.94]}>
      <sphereGeometry args={[.042,10,8]}/>
      <meshBasicMaterial color="#ffe4a3"/>
    </mesh>
    <Box at={[-.83,.94,3.05]} size={[.36,.22,.27]} color="#f9e5da"/>
    {/* Layered textiles, rugs and warm bedside lamps. */}
    <mesh position={[1.42,.027,-2.60]} rotation={[-Math.PI/2,0,0]}>
      <circleGeometry args={[2.38,64]}/>
      <meshStandardMaterial color="#b39e94" roughness={1} side={THREE.DoubleSide}/>
    </mesh>
    {[-1.82,1.88].map((x,i)=><group key={`bedlamp-${i}`} position={[x,.98,-3.82]}>
      <mesh><sphereGeometry args={[.16,12,10]}/>
        <meshStandardMaterial color="#ffe7c4" emissive="#ffbf7e" emissiveIntensity={1.8}/>
      </mesh>
    </group>)}
    {/* Table-top props are geometry, not a static pasted panorama. */}
    <mesh position={[3.22,.75,1.2]}>
      <sphereGeometry args={[.19,12,8]}/>
      <meshStandardMaterial color="#efc7c6" roughness={.84}/>
    </mesh>
    {night&&<pointLight position={[0,3.1,-.9]} intensity={8} color="#ffc2ad" distance={9}/>} 
  </>;
}

function RoomMeshes({scene,onReady}:{scene:MiraPresenceScene;onReady:()=>void}){
  const night=scene==='home-evening'||scene==='bedtime';
  const warm=scene==='bedtime'?'#ffe0b4':'#fff1d9';
  return <>
    <color attach="background" args={[night?'#111a2b':'#9eb4bb']}/>
    <ambientLight intensity={night?.9:1.25} color={warm}/>
    <hemisphereLight intensity={.56} color="#d8e6ff" groundColor="#4a3a2c"/>
    <pointLight position={[0,3.05,-1.4]} intensity={night?18:12} distance={13} color="#f4c391"/>
    <pointLight position={[3.7,2.7,1.7]} intensity={10} distance={7} color="#ffdfb0"/>
    <mesh rotation={[-Math.PI/2,0,0]} receiveShadow>
      <planeGeometry args={[COMPANION_ROOM_SIZE.width,COMPANION_ROOM_SIZE.depth]}/>
      <meshStandardMaterial color="#655145" roughness={.88} side={THREE.DoubleSide}/>
    </mesh>
    <mesh rotation={[Math.PI/2,0,0]} position={[0,COMPANION_ROOM_SIZE.height,0]}>
      <planeGeometry args={[10,12]}/><meshStandardMaterial color="#c1aa92" side={THREE.DoubleSide}/>
    </mesh>
    <mesh position={[0,1.9,-6]}><planeGeometry args={[10,3.8]}/><meshStandardMaterial color="#273042" side={THREE.DoubleSide}/></mesh>
    <mesh position={[0,1.9,6]} rotation={[0,Math.PI,0]}><planeGeometry args={[10,3.8]}/>
      <meshStandardMaterial color="#544a44" side={THREE.DoubleSide}/></mesh>
    <mesh position={[5,1.9,0]} rotation={[0,-Math.PI/2,0]}><planeGeometry args={[12,3.8]}/>
      <meshStandardMaterial color="#584d49" side={THREE.DoubleSide}/></mesh>
    <mesh position={[-5,1.9,0]} rotation={[0,Math.PI/2,0]}><planeGeometry args={[12,3.8]}/>
      <meshStandardMaterial color="#303e4c" side={THREE.DoubleSide}/></mesh>
    <WindowCity night={night}/>
    {Array.from({length:11},(_,i)=><Box key={`floor-${i}`} at={[-4.5+i*.88,.013,0]}
      size={[.012,.023,11.93]} color="#8c6c50"/>)}
    <Box at={[0,.10,-2.5]} size={[4.15,.04,4.02]} color="#a49b90"/>
    <Box at={[0,.42,-2.8]} size={[2.95,.66,2.88]} color="#64544d"/>
    <Box at={[0,.84,-2.65]} size={[2.83,.24,2.74]} color="#e0d3c1"/>
    <Box at={[0,1.12,-4.13]} size={[3.1,1.0,.25]} color="#786053"/>
    <Box at={[-.7,1.02,-3.65]} size={[.73,.18,.54]} color="#f0ece3"/>
    <Box at={[.7,1.02,-3.65]} size={[.73,.18,.54]} color="#f0ece3"/>
    <Box at={[0,.985,-2.04]} size={[2.63,.08,1.38]} color="#b4aaa4"/>
    <Box at={[-1.8,.47,-3.83]} size={[.59,.72,.53]} color="#4a3933"/>
    <Box at={[1.8,.47,-3.83]} size={[.59,.72,.53]} color="#4a3933"/>
    <mesh position={[-1.8,.94,-3.83]}><sphereGeometry args={[.135,12,10]}/><meshStandardMaterial emissive="#ffcc82" emissiveIntensity={2.1} color="#fff3d2"/></mesh>
    <mesh position={[1.8,.94,-3.83]}><sphereGeometry args={[.135,12,10]}/><meshStandardMaterial emissive="#ffcc82" emissiveIntensity={2.1} color="#fff3d2"/></mesh>
    <Box at={[3.2,.34,1.20]} size={[2.45,.65,1.1]} color="#bbb0a1"/>
    <Box at={[3.2,.88,1.73]} size={[2.45,.71,.29]} color="#b9a99a"/>
    <Box at={[2.03,.66,1.2]} size={[.26,.5,1.1]} color="#b3a394"/>
    <Box at={[4.36,.66,1.2]} size={[.26,.5,1.1]} color="#b3a394"/>
    <Box at={[.98,.37,2.1]} size={[1.27,.27,.67]} color="#574638"/>
    <Box at={[.98,.18,2.1]} size={[.11,.37,.11]} color="#332d2a"/>
    <Box at={[-3.55,.83,1.1]} size={[2.5,.09,1.24]} color="#87694d"/>
    <Box at={[-3.55,.41,.45]} size={[.13,.78,.13]} color="#554339"/>
    <Box at={[-3.55,.41,1.68]} size={[.13,.78,.13]} color="#554339"/>
    <Box at={[-3.6,.55,2.29]} size={[.79,.23,.73]} color="#ad9c8a"/>
    <Box at={[-3.6,1.02,2.62]} size={[.82,.76,.18]} color="#ad9c8a"/>
    <Box at={[3.83,1.35,-3.88]} size={[1.57,2.7,.4]} color="#59483d"/>
    {[0,1,2].map(i=><Box key={`shelf-${i}`} at={[3.83,.4+i*.75,-3.60]} size={[1.43,.075,.53]} color="#aa8863"/>)}
    <Plant x={-3.65} z={-3.95}/>
    <Plant x={3.87} z={3.46}/>
    <InteriorStyling night={night}/>
    <Suspense fallback={null}><MiraPortrait onReady={onReady}/></Suspense>
    <Box at={[0,3.73,0]} size={[.28,.08,7.1]} color="#b8a68c"/>
  </>;
}

function RoomCamera({controls}:{controls:React.RefObject<Controls>}){
  const camera=useThree(s=>s.camera);
  const invalidate=useThree(s=>s.invalidate);
  useFrame((_,delta)=>{
    const v=controls.current;
    if(!v)return;
    const dt=Math.min(delta,.06),speed=2.4*dt;
    let f=0,side=0;
    if(v.keys.has('KeyW')||v.keys.has('ArrowUp'))f+=1;
    if(v.keys.has('KeyS')||v.keys.has('ArrowDown'))f-=1;
    if(v.keys.has('KeyD'))side+=1;
    if(v.keys.has('KeyA'))side-=1;
    if(v.keys.has('ArrowLeft'))v.yaw+=dt*.9;
    if(v.keys.has('ArrowRight'))v.yaw-=dt*.9;
    if(f||side){
      v.x=CLAMP(v.x+(Math.sin(v.yaw)*-f+Math.cos(v.yaw)*side)*speed,-4.4,4.4);
      v.z=CLAMP(v.z+(-Math.cos(v.yaw)*f+Math.sin(v.yaw)*side)*speed,-5.2,5.2);
    }
    camera.position.set(v.x,1.68,v.z);
    camera.rotation.set(v.pitch,v.yaw,0,'YXZ');
    if(v.keys.size)invalidate();
  });
  return null;
}

/** A real world-space room, not a panorama projected onto a sphere. */
export default function PhotorealRoom3D({scene,onReady,onFailure}:Room3DProps){
  const control=useRef<Controls>({yaw:0,pitch:0,x:0,z:4.75,keys:new Set()});
  const [viewPreset,setViewPreset]=useState(1);
  const [referenceView,setReferenceView]=useState(true);
  const referenceImage=`${import.meta.env.BASE_URL}mira-assets/reference/mira_concept_front.webp`;
  const last=useRef<{pointerId:number;x:number;y:number}|null>(null);
  const invalidateRef=useRef<(() => void)|null>(null);
  const sceneReady=useCallback(()=>onReady(),[onReady]);
  useEffect(()=>{
    const isEditable=(element:EventTarget|null)=>element instanceof HTMLElement &&
      (element.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(element.tagName));
    const presets=[
      {yaw:-Math.PI/2,x:-1.8,z:3.9},
      {yaw:0,x:0,z:4.75},
      {yaw:Math.PI/2,x:1.8,z:3.9},
      {yaw:Math.PI,x:0,z:0},
      {yaw:0,x:0,z:5.25},
    ];
    const down=(event:KeyboardEvent)=>{
      const n=/^Digit([1-5])$/.exec(event.code);
      if(n&&!isEditable(event.target)){
        const index=Number(n[1])-1, preset=presets[index];
        Object.assign(control.current,preset,{pitch:0});
        setViewPreset(index);
        setReferenceView(index===1);
        invalidateRef.current?.();
        return;
      }
      if(isEditable(event.target)||!MOVE_KEYS.has(event.code))return;
      event.preventDefault();setReferenceView(false);
      control.current.keys.add(event.code);invalidateRef.current?.();
    };
    const up=(event:KeyboardEvent)=>{control.current.keys.delete(event.code);};
    const blur=()=>control.current.keys.clear();
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
    return ()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);};
  },[]);
  const pointerDown=(event:ReactPointerEvent<HTMLSpanElement>)=>{
    event.stopPropagation();setReferenceView(false);
    event.currentTarget.setPointerCapture(event.pointerId);
    last.current={pointerId:event.pointerId,x:event.clientX,y:event.clientY};
  };
  const pointerMove=(event:ReactPointerEvent<HTMLSpanElement>)=>{
    const previous=last.current;
    if(!previous||previous.pointerId!==event.pointerId)return;
    event.stopPropagation();
    control.current.yaw-=CLAMP(event.clientX-previous.x,-110,110)*.0058;
    control.current.pitch=CLAMP(control.current.pitch-(event.clientY-previous.y)*.0037,-.93,.93);
    last.current={pointerId:event.pointerId,x:event.clientX,y:event.clientY};
    invalidateRef.current?.();
  };
  const pointerEnd=(event:ReactPointerEvent<HTMLSpanElement>)=>{
    if(last.current?.pointerId===event.pointerId)last.current=null;
    event.stopPropagation();
  };
  return <RoomBoundary onFailure={onFailure}>
    <span className="pm-room3d-stage" aria-label="Phòng 3D. Kéo chuột để nhìn 360 độ; dùng WASD để di chuyển."
      onPointerDown={pointerDown} onPointerMove={pointerMove}
      onPointerUp={pointerEnd} onPointerCancel={pointerEnd}
      onClick={event=>event.stopPropagation()}>
      <Canvas frameloop="demand" dpr={[1,1.5]} camera={{fov:70,near:.08,far:70,position:[0,1.68,4.75]}}
        gl={{alpha:false,antialias:true,powerPreference:'low-power'}}
        onCreated={({invalidate})=>{invalidateRef.current=invalidate;}}>
        <RoomCamera controls={control}/>
        <RoomMeshes scene={scene} onReady={sceneReady}/>
      </Canvas>
      <span className={`pm-room3d-reference${referenceView?' is-visible':''}`} aria-hidden="true">
        <img src={referenceImage} alt="" draggable={false} decoding="async"/>
        <span className="pm-room3d-reference-label">ẢNH CHUẨN 2D · KÉO ĐỂ MỞ 3D</span>
      </span>
      <span className="pm-room3d-hud" aria-hidden="true">MIRA HOME · KÉO XOAY 360° · WASD DI CHUYỂN · 1–5 GÓC NHÌN</span>
      <span className="pm-room3d-gallery" aria-hidden="true">
        {['Trái 90°','Trước','Phải 90°','Sau 180°','Toàn cảnh'].map((label,index)=>
          <span key={label} className={index===viewPreset?'is-selected':''}>{label}</span>)}
      </span>
    </span>
  </RoomBoundary>;
}
