import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import type { MiraState, Theme } from '../core/types';
import { audioLevel } from '../core/audio-level';

// Orb giọng nói kiểu Grok: cầu fresnel phát sáng, mặt biến dạng bằng simplex-noise,
// hai tông màu (lõi accent2 ấm → rìa accent sáng), nảy theo BIÊN ĐỘ ÂM THẬT (audioLevel)
// khi nghe/nói — fallback envelope theo state. Additive blending cho chất plasma.
const THEME_ACCENT: Record<Theme, string> = {
  nova: '#38E1FF',
  aura: '#9A7BFF',
  ember: '#2FD9C9',
  iris: '#7C8CFF',
};
const THEME_ACCENT2: Record<Theme, string> = {
  nova: '#B66BFF',
  aura: '#5FE7C4',
  ember: '#FFB23E',
  iris: '#C9B6FF',
};

// Ashima simplex noise 3D (public domain) — nguồn biến dạng đỉnh.
const SNOISE = `
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+1.0*C.xxx; vec3 x2=x0-i2+2.0*C.xxx; vec3 x3=x0-1.0+3.0*C.xxx;
  i=mod(i,289.0);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=1.0/7.0; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const VERTEX = `
uniform float uTime; uniform float uAmp;
varying float vDisp; varying vec3 vN; varying vec3 vView;
${SNOISE}
void main(){
  float base = snoise(position * 1.5 + uTime * 0.4);        // sóng nền chậm
  float ripple = snoise(position * 3.6 - uTime * 1.2) * uAmp; // gợn nhanh khi to tiếng
  float disp = base * (0.10 + uAmp * 0.55) + ripple * 0.13;
  vec3 pos = position + normal * disp;
  vDisp = disp;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vN = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const FRAGMENT = `
uniform vec3 uColor; uniform vec3 uColor2; uniform float uAmp;
varying float vDisp; varying vec3 vN; varying vec3 vView;
void main(){
  float fres = pow(1.0 - max(dot(vN, vView), 0.0), 2.0);
  vec3 base = mix(uColor2, uColor, fres);              // lõi ấm → rìa sáng
  float glow = 0.32 + vDisp * 1.9 + uAmp * 0.95;        // sáng dần theo biên độ + nếp gấp
  vec3 col = base * glow + uColor * fres * 0.6;         // rìa fresnel bồi thêm
  float alpha = clamp(0.28 + fres * 0.7 + uAmp * 0.25, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}`;

function OrbMesh({
  stateRef,
  accent,
  accent2,
}: {
  stateRef: MutableRefObject<MiraState>;
  accent: string;
  accent2: string;
}) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const grp = useRef<THREE.Group>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: 0.12 },
      uColor: { value: new THREE.Color(accent) },
      uColor2: { value: new THREE.Color(accent2) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    mat.current?.uniforms.uColor.value.set(accent);
    mat.current?.uniforms.uColor2.value.set(accent2);
  }, [accent, accent2]);

  useFrame((_, delta) => {
    const m = mat.current;
    if (!m) return;
    const d = Math.min(delta, 0.05);
    m.uniforms.uTime.value += d;
    const st = stateRef.current;
    const live = audioLevel.active ? audioLevel.value : -1;
    let target = 0.12;
    if (st === 'thinking') target = 0.28 + Math.abs(Math.sin(m.uniforms.uTime.value * 3)) * 0.14;
    else if (st === 'listening' || st === 'speaking') target = live >= 0 ? 0.25 + live * 1.1 : 0.55;
    else if (st === 'interrupted' || st === 'error') target = 0.05;
    m.uniforms.uAmp.value += (target - m.uniforms.uAmp.value) * Math.min(1, d * 6);
    if (grp.current) {
      grp.current.rotation.y += d * 0.25;
      const s = 1 + m.uniforms.uAmp.value * 0.06; // phình nhẹ theo biên độ
      grp.current.scale.setScalar(s);
    }
  });

  return (
    <group ref={grp}>
      <mesh>
        <icosahedronGeometry args={[1, 24]} />
        <shaderMaterial
          ref={mat}
          uniforms={uniforms}
          vertexShader={VERTEX}
          fragmentShader={FRAGMENT}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

interface Props {
  stateRef: MutableRefObject<MiraState>;
  theme: Theme;
}

export default function MiraOrb({ stateRef, theme }: Props) {
  const accent = THEME_ACCENT[theme];
  const accent2 = THEME_ACCENT2[theme];
  return (
    <Canvas
      className="avatar3d orb3d"
      dpr={[1, 2]} // chặn render >2x pixel trên màn retina
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0, 3.2], fov: 40, near: 0.1, far: 20 }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      style={{ opacity: 1 }}
    >
      <ambientLight intensity={0.9} />
      <OrbMesh stateRef={stateRef} accent={accent} accent2={accent2} />
    </Canvas>
  );
}
