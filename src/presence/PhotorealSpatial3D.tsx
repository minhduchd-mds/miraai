import { Component, Suspense, useEffect, useMemo } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { MiraPresenceScene } from './presence-scene';
import { sceneDepthAt, spatialCameraTarget } from './spatial-scene-depth';

interface View { x: number; y: number; headYaw: number; headPitch: number; }
interface Props {
  src: string;
  scene: MiraPresenceScene;
  viewRef: MutableRefObject<View>;
  onReady: () => void;
  onFailure: () => void;
  registerInvalidate: (invalidate: (() => void) | null) => void;
}

class SpatialErrorBoundary extends Component<{children:ReactNode;onFailure:()=>void},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){this.props.onFailure();}
  render(){return this.state.failed?null:this.props.children;}
}

function BasRelief({src,scene,onReady}:Pick<Props,'src'|'scene'|'onReady'>){
  const texture=useLoader(THREE.TextureLoader,src);
  const invalidate=useThree(s=>s.invalidate);
  const geometry=useMemo(()=>{
    // The source is ONE image: displace a textured mesh by authored depth,
    // never claim these are measured surfaces or invent unseen pixels.
    const mesh=new THREE.PlaneGeometry(18,10,64,40);
    const coords=mesh.attributes.position as THREE.BufferAttribute;
    const uvs=mesh.attributes.uv as THREE.BufferAttribute;
    // Preserve CSS object-fit:cover semantics across every photo aspect ratio.
    const image=texture.image as {width?:number;height?:number} | undefined;
    const sourceAspect=(Number(image?.width)||18)/Math.max(1,Number(image?.height)||10);
    const targetAspect=18/10;
    if(targetAspect>sourceAspect){
      const scaleY=sourceAspect/targetAspect;
      for(let i=0;i<uvs.count;i++)uvs.setY(i,.5+(uvs.getY(i)-.5)*scaleY);
    } else {
      const scaleX=targetAspect/sourceAspect;
      for(let i=0;i<uvs.count;i++)uvs.setX(i,(1-scaleX)*.30+uvs.getX(i)*scaleX);
    }
    uvs.needsUpdate=true;
    for(let i=0;i<coords.count;i++){
      coords.setZ(i,(sceneDepthAt(scene,uvs.getX(i),uvs.getY(i))-.5)*1.65);
    }
    coords.needsUpdate=true;
    mesh.computeVertexNormals();
    return mesh;
  },[scene,texture]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useEffect(()=>{
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
    texture.needsUpdate=true;
    invalidate();
    // Keep plain WebP visible until the texture has loaded and a frame renders.
    const id=requestAnimationFrame(()=>onReady());
    return ()=>cancelAnimationFrame(id);
  },[texture,invalidate,onReady]);
  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <meshBasicMaterial map={texture} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
}

function CameraRig({viewRef,registerInvalidate}:Pick<Props,'viewRef'|'registerInvalidate'>){
  const camera=useThree(s=>s.camera);
  const invalidate=useThree(s=>s.invalidate);
  useEffect(()=>{
    registerInvalidate(()=>invalidate());
    return ()=>registerInvalidate(null);
  },[registerInvalidate,invalidate]);
  useFrame(()=>{
    const v=viewRef.current;
    const target=spatialCameraTarget(v.x,v.y,v.headYaw,v.headPitch);
    camera.position.x+=(target.x-camera.position.x)*.18;
    camera.position.y+=(target.y-camera.position.y)*.18;
    camera.lookAt(0,0,0);
    if(Math.abs(target.x-camera.position.x)>.0015||Math.abs(target.y-camera.position.y)>.0015)
      invalidate();
  });
  return null;
}

/** Lazy alternative to 2.5D. One GPU renderer at a time; retain WebP fallback. */
export default function PhotorealSpatial3D(props:Props){
  return (
    <SpatialErrorBoundary onFailure={props.onFailure}>
      <Canvas
        className="pm-spatial3d-canvas"
        frameloop="demand"
        dpr={[1,1.45]}
        gl={{alpha:false,antialias:false,preserveDrawingBuffer:false,powerPreference:'low-power'}}
        camera={{position:[0,0,10.8],fov:48,near:.1,far:50}}
        style={{pointerEvents:'none'}}
        onCreated={({gl})=>{gl.setClearColor('#080717',1);}}
      >
        <CameraRig viewRef={props.viewRef} registerInvalidate={props.registerInvalidate} />
        <Suspense fallback={null}>
          <BasRelief src={props.src} scene={props.scene} onReady={props.onReady} />
        </Suspense>
      </Canvas>
    </SpatialErrorBoundary>
  );
}
