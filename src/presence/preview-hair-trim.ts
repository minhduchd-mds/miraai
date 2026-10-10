import * as THREE from 'three';
import type {VRM} from '@pixiv/three-vrm';

/**
 * The committed soft-rose VRoid preview has exactly four independent tuft
 * primitives (Hair001.baked primitives 44–47) using material HAIR_06.
 * Hide these four mesh nodes instead of cutting arbitrary head triangles.
 * Not called for approved realistic avatars.
 */
const PREVIEW_TUFT_MATERIAL=/^F00_000_Hair_00_HAIR_06(?: \(Outline\))?$/i;

function crownTuft(mesh:THREE.SkinnedMesh):{side:'left'|'right'}|null{
 const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
 if(!materials.some(m=>m && PREVIEW_TUFT_MATERIAL.test(m.name)))return null;
 const positions=mesh.geometry.getAttribute('position');
 const index=mesh.geometry.getIndex();
 if(!positions||!index||index.count<15||index.count>1500)return null;
 let minY=Infinity,maxY=-Infinity,minX=Infinity,maxX=-Infinity;
 for(let i=0;i<index.count;i++){
  const at=index.getX(i);
  if(at<0||at>=positions.count)return null;
  const x=positions.getX(at),y=positions.getY(at);
  if(!Number.isFinite(x)||!Number.isFinite(y))return null;
  minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  minX=Math.min(minX,x);maxX=Math.max(maxX,x);
 }
 // These bounds are specific to the four authored tufts in this preview
 // (not the shared hair vertex buffer, bangs, or long rear strands).
 if(minY<1.43||maxY<1.55||maxY>1.65)return null;
 if(maxX<-.025)return {side:'left'};
 if(minX>.025)return {side:'right'};
 return null;
}

/** Fail closed unless the four intended, balanced tufts are all found. */
export function hidePreviewHairTufts(vrm:Pick<VRM,'scene'>):number{
 const tufts:Array<{mesh:THREE.SkinnedMesh;side:'left'|'right'}>=[];
 vrm.scene.traverse(node=>{
  if(!(node instanceof THREE.SkinnedMesh))return;
  const target=crownTuft(node);
  if(target)tufts.push({mesh:node,side:target.side});
 });
 if(tufts.length!==4||
    tufts.filter(t=>t.side==='left').length!==2||
    tufts.filter(t=>t.side==='right').length!==2)return 0;
 for(const {mesh} of tufts)mesh.visible=false;
 return tufts.length;
}
