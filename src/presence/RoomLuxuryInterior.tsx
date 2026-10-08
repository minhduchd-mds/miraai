import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { MiraPresenceScene } from './presence-scene';

type V3 = [number,number,number];
type RoundedProps = {
  at:V3; size:V3; color:string; radius?:number; roughness?:number;
  metalness?:number; emissive?:string; emissiveIntensity?:number;
  rotation?:V3; clearcoat?:number;
};

/** Shared curved, shaded geometric furniture; no axis-aligned placeholder cubes. */
function Rounded({at,size,color,radius=.11,roughness=.83,metalness=0,
 emissive='#000000',emissiveIntensity=0,rotation=[0,0,0],clearcoat=0}:RoundedProps){
  const geometry=useMemo(()=>new RoundedBoxGeometry(
    size[0],size[1],size[2],3,Math.min(radius,...size.map(x=>x*.48))
  ),[size[0],size[1],size[2],radius]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh position={at} rotation={rotation} geometry={geometry} castShadow receiveShadow>
    <meshPhysicalMaterial color={color} roughness={roughness} metalness={metalness}
      clearcoat={clearcoat} emissive={emissive} emissiveIntensity={emissiveIntensity}/>
  </mesh>;
}

function WoodSlats() {
  return <group>
    <Rounded at={[1.3,1.86,-5.89]} size={[5.0,2.72,.13]} color="#6a4436" roughness={.78} radius={.02}/>
    {Array.from({length:25},(_,i)=><Rounded key={i}
      at={[-1.0+i*.19,1.82,-5.76]} size={[.052,2.54,.052]}
      color={i%4===0?'#b98c66':'#80543d'} roughness={.58} radius={.012}/>)}
    <Rounded at={[1.24,3.22,-5.69]} size={[4.7,.034,.08]}
      color="#ffe5b1" emissive="#ffbb71" emissiveIntensity={2} radius={.012}/>
  </group>;
}

function CityWindow({night}:{night:boolean}){
  const heights=[1.65,2.17,1.39,2.54,1.83,2.79,2.19,1.48,2.25,1.76,2.5,1.88,2.72,2.04];
  return <group>
    {/* A wall with an actual opening: the city sits OUTSIDE, behind framed glazing. */}
    <mesh position={[-6.35,1.8,-2.0]} rotation={[0,Math.PI/2,0]}>
      <planeGeometry args={[5.35,3.6]}/>
      <meshBasicMaterial color={night?'#102341':'#93bac6'} side={THREE.DoubleSide}/>
    </mesh>
    {heights.map((h,i)=>{
      const z=-4.62+i*.37;
      return <group key={i}>
        <Rounded at={[-6.16,h*.47,z]} size={[.22,h*.92,.29]}
          color={night?'#27384b':'#637785'} radius={.015} roughness={.93}/>
        {night && Array.from({length:4},(_,j)=><mesh key={j}
          position={[-6.01,.28+j*(h*.72/4),z]}>
          <planeGeometry args={[.003,.07]}/>
          <meshBasicMaterial color={j%2===0?'#ffd58c':'#a3d6f0'} side={THREE.DoubleSide}/>
        </mesh>)}
      </group>;
    })}
    <mesh position={[-4.96,1.94,-1.95]} rotation={[0,Math.PI/2,0]}>
      <planeGeometry args={[5.12,2.63]}/>
      <meshPhysicalMaterial color="#b7d6e7" transparent opacity={.13}
        roughness={.055} metalness={.18} side={THREE.DoubleSide} depthWrite={false}/>
    </mesh>
    <Rounded at={[-4.91,1.94,-1.95]} size={[.10,2.73,.064]} color="#53443e" metalness={.48} radius={.018}/>
    <Rounded at={[-4.91,.58,-1.95]} size={[.11,.08,5.35]} color="#5d4941" metalness={.38} radius={.012}/>
    <Rounded at={[-4.91,3.27,-1.95]} size={[.1,.08,5.35]} color="#5d4941" metalness={.38} radius={.012}/>
    {[-4.68,-2.03,.59].map(z=><Rounded key={z} at={[-4.91,1.94,z]}
      size={[.10,2.63,.06]} color="#51443f" metalness={.43} radius={.012}/>)}
    {Array.from({length:7},(_,i)=><mesh key={i} position={[-4.8,2.01,-4.6+i*.14]}>
      <planeGeometry args={[.02,2.62]}/>
      <meshPhysicalMaterial color="#d9bcb0" side={THREE.DoubleSide} roughness={.98}/>
    </mesh>)}
    <pointLight position={[-3.76,2.78,-2.2]} intensity={night?9:4} distance={5.7} color="#93b7df"/>
  </group>;
}

function BedSet() {
  const duvet=useMemo(()=>{
    const plane=new THREE.PlaneGeometry(2.78,2.75,22,20);
    const xyz=plane.attributes.position as THREE.BufferAttribute;
    for(let i=0;i<xyz.count;i++){
      const x=xyz.getX(i),y=xyz.getY(i);
      xyz.setZ(i,.032*Math.sin(x*5.9+y*4.1)+.015*Math.sin(y*12.5));
    }
    plane.computeVertexNormals();return plane;
  },[]);
  useEffect(()=>()=>duvet.dispose(),[duvet]);
  return <group>
    <WoodSlats/>
    <Rounded at={[1.35,.42,-3.35]} size={[3.35,.63,3.7]} color="#795d52" radius={.17}/>
    <Rounded at={[1.35,.76,-3.35]} size={[3.34,.2,3.65]} color="#d6bbaa" radius={.13}/>
    <Rounded at={[1.35,.88,-3.38]} size={[3.21,.15,3.53]} color="#f0d8d0" radius={.1}/>
    <Rounded at={[1.35,1.25,-5.2]} size={[3.5,1.2,.33]} color="#b88982" roughness={.96} radius={.21}/>
    {[-.07,1.15,2.35].map((x,i)=><Rounded key={i}
      at={[x,1.05,-4.59]} size={[1.05,.25,.62]} color={i===1?'#faf0e3':'#ecddd4'}
      radius={.18} roughness={.98}/>)}
    <mesh position={[1.35,1.002,-2.98]} rotation={[-Math.PI/2,0,0]}
      geometry={duvet} castShadow receiveShadow>
      <meshStandardMaterial color="#d4a1a6" roughness={.97} side={THREE.DoubleSide}/>
    </mesh>
    {Array.from({length:13},(_,i)=><mesh key={i}
      position={[-.14+i*.25,.986,-1.99]} rotation={[-Math.PI/2,0,0]}>
      <planeGeometry args={[.04,.46]}/>
      <meshStandardMaterial color={i%2?'#c68f98':'#dfabb3'} side={THREE.DoubleSide} roughness={.99}/>
    </mesh>)}
    <Rounded at={[1.35,.11,-3.25]} size={[3.28,.053,3.5]} color="#ffdb9a"
      emissive="#ffaf65" emissiveIntensity={2.5} radius={.015}/>
    {[-.7,3.24].map((x,i)=><group key={i}>
      <Rounded at={[x,.53,-4.67]} size={[.58,.86,.51]} color="#735047" radius={.055}/>
      <mesh position={[x,.99,-4.67]}>
        <cylinderGeometry args={[.19,.30,.34,16]}/>
        <meshStandardMaterial color="#e8c8b5" roughness={.73}/>
      </mesh>
      <pointLight position={[x,1.06,-4.63]} intensity={2.5} distance={3.8} color="#ffe1b2"/>
    </group>)}
    <mesh position={[2.0,.027,-2.7]} rotation={[-Math.PI/2,0,0]}>
      <circleGeometry args={[2.7,60]}/>
      <meshStandardMaterial color="#d2b9ad" roughness={1}/>
    </mesh>
  </group>;
}

function SofaSet(){
  return <group>
    <Rounded at={[-3.14,.38,1.0]} size={[2.85,.56,1.34]} color="#cbb4a8" radius={.28}/>
    <Rounded at={[-3.14,.93,.46]} size={[2.85,.93,.25]} color="#dac7bd" radius={.23}/>
    {[-4.38,-1.90].map(x=><Rounded key={x} at={[x,.68,.96]}
      size={[.37,.8,1.4]} color="#dcc7bb" radius={.17}/>)}
    {[-3.96,-3.15,-2.34].map((x,i)=><Rounded key={x} at={[x,.75,1.13]}
      size={[.82,.24,1.18]} color={i===1?'#f0e1d9':'#e4d2c4'} radius={.2}/>)}
    {[-3.87,-3.01,-2.16].map((x,i)=><mesh key={x} position={[x,1.1,.56]}
      rotation={[.13,0,(i-1)*.14]} castShadow scale={[.35,.30,.13]}>
      <sphereGeometry args={[1,28,16]}/>
      <meshStandardMaterial color={i===1?'#d298a3':'#e8d0c9'} roughness={1}/>
    </mesh>)}
    <mesh position={[-2.86,.885,1.38]} rotation={[-Math.PI/2,0,.13]}>
      <planeGeometry args={[1.34,.7]}/>
      <meshStandardMaterial color="#bc8588" side={THREE.DoubleSide} roughness={1}/>
    </mesh>
    <Rounded at={[-3.08,.025,1.03]} size={[3.0,.035,1.83]} color="#e0d1c3" radius={.02}/>
  </group>;
}

function WorkspaceSet(){
  return <group>
    <Rounded at={[-2.5,.81,-3.02]} size={[2.6,.13,1.12]} color="#a47855" radius={.06}/>
    {[-3.6,-1.4].map(x=><Rounded key={x} at={[x,.43,-3.32]}
      size={[.10,.80,.13]} color="#5b3f33" radius={.016}/>)}
    {[-3.05,-2.00].map((x,i)=><group key={x}>
      <Rounded at={[x,1.33,-3.51]} size={[.96,.66,.055]} color="#2c2931" radius={.06} roughness={.29}/>
      <mesh position={[x,1.33,-3.474]}>
        <planeGeometry args={[.84,.54]}/>
        <meshBasicMaterial color={i?'#7a729f':'#345a7f'} side={THREE.DoubleSide}/>
      </mesh>
      <Rounded at={[x,.94,-3.51]} size={[.05,.16,.04]} color="#8f8c90" metalness={.9} radius={.01}/>
      <Rounded at={[x,.86,-3.50]} size={[.36,.018,.20]} color="#7c8189" radius={.008} metalness={.83}/>
    </group>)}
    <Rounded at={[-2.48,.86,-2.88]} size={[.84,.03,.27]} color="#d6b7ac" radius={.025}/>
    <Rounded at={[-3.0,.88,-2.66]} size={[.23,.028,.36]} color="#efe2d9" radius={.03}/>
    <Rounded at={[-2.46,2.08,-5.25]} size={[2.63,.075,.34]} color="#ae8865" radius={.025}/>
    <Rounded at={[-2.46,2.58,-5.25]} size={[2.63,.075,.34]} color="#ae8865" radius={.025}/>
    {[-3.35,-2.45,-1.55].map((x,i)=><mesh key={x} position={[x,2.19,-5.2]}>
      <cylinderGeometry args={[.12,.09,.21,11]}/>
      <meshStandardMaterial color={i===1?'#d7b8a6':'#7c7468'} roughness={.83}/>
    </mesh>)}
    <pointLight position={[-2.5,2.3,-4.95]} color="#ffc78c" intensity={5} distance={3.4}/>
  </group>;
}

function WardrobeSet(){
  return <group>
    <Rounded at={[4.67,1.87,-3.24]} size={[.60,3.56,3.23]} color="#674638" radius={.045}/>
    {[.40,1.41,2.42].map(y=><Rounded key={y}
      at={[4.19,y,-3.24]} size={[.34,.09,3.05]} color="#b68762" radius={.027}/>)}
    <Rounded at={[4.13,1.81,-4.79]} size={[.05,3.2,.05]} color="#ffdc9e"
      emissive="#ffc17d" emissiveIntensity={2} radius={.009}/>
    {[-4.48,-3.8,-3.12,-2.44].map((z,i)=><mesh key={z}
      position={[4.06,1.88,z]} scale={[.05,.28,.21]}>
      <sphereGeometry args={[1,12,10]}/>
      <meshStandardMaterial color={i%2?'#e1c0b1':'#7d7f78'} roughness={.86}/>
    </mesh>)}
    <mesh position={[4.09,1.58,-1.83]} rotation={[0,-Math.PI/2,0]}>
      <planeGeometry args={[.44,1.95]}/>
      <meshPhysicalMaterial color="#c7b6a9" metalness={.62} roughness={.13}/>
    </mesh>
  </group>;
}

function marbleTexture(){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const ctx=canvas.getContext('2d');
  if(ctx){
    ctx.fillStyle='#e9e1d9';ctx.fillRect(0,0,512,256);
    for(let i=0;i<31;i++){
      const offset=(i*191.3)%512,amp=(i%5+1)*2.6;
      ctx.beginPath();
      ctx.moveTo(offset-80,-8);
      for(let t=0;t<=16;t++){
        const y=t*18,xx=offset+t*7.5+Math.sin(t*.7+i)*amp;
        ctx.lineTo(xx,y);
      }
      ctx.lineWidth=i%5===0?2.0:.75;
      ctx.strokeStyle=i%4===0?'rgba(155,123,125,.22)':'rgba(123,111,111,.095)';
      ctx.stroke();
    }
  }
  const tex=new THREE.CanvasTexture(canvas);
  tex.colorSpace=THREE.SRGBColorSpace;
  tex.anisotropy=2;
  return tex;
}

function MarbleDeskSet(){
  const map=useMemo(marbleTexture,[]);
  const top=useMemo(()=>new RoundedBoxGeometry(4.52,.16,1.78,3,.07),[]);
  useEffect(()=>()=>{map.dispose();top.dispose();},[map,top]);
  return <group>
    <mesh geometry={top} position={[0,.84,2.82]} castShadow receiveShadow>
      <meshPhysicalMaterial map={map} roughness={.19} clearcoat={.9}
        clearcoatRoughness={.15} metalness={.03}/>
    </mesh>
    {[-1.9,1.9].map(x=><Rounded key={x} at={[x,.40,2.82]}
      size={[.12,.79,1.46]} color="#6a4b40" roughness={.56} radius={.025}/>)}
    <Rounded at={[-.3,.943,2.97]} size={[1.34,.046,.53]} color="#dcbcc9" roughness={.48} radius={.025}/>
    {Array.from({length:13},(_,i)=><Rounded key={i}
      at={[-.89+i*.098,.975,2.99]} size={[.070,.011,.19]}
      color={i%3===0?'#f4dfec':'#f6edf0'} radius={.007}/>)}
    <Rounded at={[1.07,.946,2.58]} size={[.74,.036,.98]} color="#3f3c43"
      roughness={.32} radius={.035}/>
    <Rounded at={[1.07,1.26,2.09]} size={[.73,.60,.045]} color="#534e5a"
      roughness={.37} radius={.025}/>
    <Rounded at={[-1.46,.946,2.58]} size={[.44,.036,.47]} color="#f6e4da" radius={.025}/>
    <mesh position={[-1.46,1.08,2.58]} castShadow>
      <cylinderGeometry args={[.16,.135,.27,24]}/>
      <meshPhysicalMaterial color="#f8d5d5" roughness={.34} clearcoat={.76}/>
    </mesh>
    <mesh position={[-1.46,1.29,2.58]}>
      <sphereGeometry args={[.057,14,10]}/>
      <meshBasicMaterial color="#ffd092"/>
    </mesh>
    <Rounded at={[.49,.94,3.4]} size={[.77,.04,.43]} color="#f5e5d7" radius={.03}/>
    <Rounded at={[.91,.972,3.4]} size={[.018,.018,.36]} color="#43343b" radius={.007}/>
  </group>;
}

function RoomLighting({night}:{night:boolean}){
  return <group>
    <mesh position={[0,3.72,-.9]} rotation={[-Math.PI/2,0,0]}>
      <torusGeometry args={[2.15,.082,10,72]}/>
      <meshStandardMaterial color="#ffebcf" emissive="#ffc17b" emissiveIntensity={2.2}/>
    </mesh>
    <mesh position={[0,3.73,-.9]} rotation={[-Math.PI/2,0,0]}>
      <torusGeometry args={[2.34,.02,8,72]}/>
      <meshStandardMaterial color="#b28b66" metalness={.81} roughness={.25}/>
    </mesh>
    <pointLight position={[0,3.40,-1.05]} color="#ffd1a5" intensity={night?15:11} distance={11}/>
    <spotLight position={[.7,3.47,2.34]} intensity={night?31:23}
      color="#ffe3c6" angle={.97} penumbra={.87} distance={11}
      castShadow shadow-bias={-.00035} shadow-mapSize={[1024,1024]}/>
    <pointLight position={[-3.45,2.73,-2]} intensity={night?8:5}
      distance={7} color="#ffc78d"/>
    <mesh position={[2.55,2.28,-5.63]} rotation={[0,0,Math.PI/4]}>
      <torusGeometry args={[.19,.026,6,48,Math.PI*1.15]}/>
      <meshBasicMaterial color="#ff8bb9"/>
    </mesh>
  </group>;
}

function Plant({x,z}:{x:number;z:number}){
  return <group position={[x,0,z]}>
    <mesh position={[0,.31,0]} castShadow>
      <cylinderGeometry args={[.24,.17,.53,18]}/>
      <meshStandardMaterial color="#b7a48c" roughness={.95}/>
    </mesh>
    {Array.from({length:7},(_,i)=><mesh key={i}
      position={[Math.cos(i*1.7)*.3,.85+(i%3)*.21,Math.sin(i*1.7)*.27]}
      rotation={[0,i*1.7,-.12]} castShadow scale={[.16,.46,.11]}>
      <sphereGeometry args={[1,10,10]}/>
      <meshStandardMaterial color={i%3===0?'#355743':'#506b4a'} roughness={.96}/>
    </mesh>)}
  </group>;
}

/** Distinct objects with real volume and light interaction, designed for walk-around. */
export default function RoomLuxuryInterior({scene}:{scene:MiraPresenceScene}){
  const night=scene==='home-evening'||scene==='bedtime';
  return <>
    <color attach="background" args={[night?'#13243b':'#8da9b8']}/>
    <ambientLight intensity={night?.83:1.06} color="#e9dcda"/>
    <hemisphereLight intensity={.66} color="#bed9ff" groundColor="#654c42"/>
    <mesh position={[0,-.022,0]} rotation={[-Math.PI/2,0,0]} receiveShadow>
      <planeGeometry args={[10.1,12.1]}/>
      <meshStandardMaterial color="#94745d" roughness={.75} side={THREE.DoubleSide}/>
    </mesh>
    {Array.from({length:18},(_,i)=><Rounded key={i}
      at={[-4.8+i*.57,.002,0]} size={[.014,.014,12]} radius={.003}
      color={i%2===0?'#6f513f':'#c49a77'}/>)}
    {/* Wall toward camera stays behind camera. Large left window has a true opening. */}
    <mesh position={[0,1.90,-6.02]} receiveShadow>
      <planeGeometry args={[10,3.8]}/><meshStandardMaterial color="#725c58" roughness={.96}/>
    </mesh>
    <mesh position={[5.01,1.90,0]} rotation={[0,-Math.PI/2,0]} receiveShadow>
      <planeGeometry args={[12,3.8]}/><meshStandardMaterial color="#76615b" roughness={.91}/>
    </mesh>
    <mesh position={[0,3.80,0]} rotation={[Math.PI/2,0,0]}>
      <planeGeometry args={[10,12]}/><meshStandardMaterial color="#eedfd2" side={THREE.DoubleSide}/>
    </mesh>
    <mesh position={[-5.02,3.52,0]} rotation={[0,Math.PI/2,0]}>
      <planeGeometry args={[12,.57]}/><meshStandardMaterial color="#756a67" side={THREE.DoubleSide}/>
    </mesh>
    <mesh position={[-5.02,.29,0]} rotation={[0,Math.PI/2,0]}>
      <planeGeometry args={[12,.58]}/><meshStandardMaterial color="#756a67" side={THREE.DoubleSide}/>
    </mesh>
    <mesh position={[-5.02,1.90,-5.18]} rotation={[0,Math.PI/2,0]}>
      <planeGeometry args={[1.64,2.68]}/><meshStandardMaterial color="#756a67" side={THREE.DoubleSide}/>
    </mesh>
    <mesh position={[-5.02,1.90,3.11]} rotation={[0,Math.PI/2,0]}>
      <planeGeometry args={[5.8,2.68]}/><meshStandardMaterial color="#756a67" side={THREE.DoubleSide}/>
    </mesh>
    <CityWindow night={night}/>
    <SofaSet/>
    <WorkspaceSet/>
    <BedSet/>
    <WardrobeSet/>
    <MarbleDeskSet/>
    <RoomLighting night={night}/>
    <Plant x={-3.63} z={-4.49}/>
    <Plant x={3.85} z={-1.41}/>
    <Plant x={-4.27} z={2.87}/>
  </>;
}
