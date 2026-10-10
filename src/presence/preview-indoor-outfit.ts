import * as THREE from 'three';
import type {VRM} from '@pixiv/three-vrm';

const PREVIEW_TOP=/F00_008_01_Tops_01_CLOTH/i;

/**
 * Remove only the jacket-like sleeves and hem on the known preview VRM.
 * The Body.baked node can have MULTIPLE materials/groups: preserve every
 * skin, skirt and shoe triangle, trimming only the top material groups.
 * This is strictly a developer-preview workaround, not a generic outfit editor.
 */
export function trimPreviewOuterwear(vrm:VRM):number {
  let simplified=0;
  vrm.scene.traverse(node=>{
    if(!(node instanceof THREE.SkinnedMesh))return;
    const materials=Array.isArray(node.material)?node.material:[node.material];
    const trimSlots=new Set(materials.flatMap((m,i)=>m&&PREVIEW_TOP.test(m.name)?[i]:[]));
    if(!trimSlots.size)return;

    const geo=node.geometry;
    const pos=geo.getAttribute('position');
    const idx=geo.getIndex();
    if(!pos||!idx||pos.count<1500||pos.count>30000)return;
    if(!Array.isArray(node.material)&&geo.groups.length>1)return;
    if(Array.isArray(node.material)&&!geo.groups.length)return;
    const groups=geo.groups.length?geo.groups:[{start:0,count:idx.count,materialIndex:0}];

    const next:number[]=[];
    const nextGroups:Array<{start:number;count:number;materialIndex:number}>=[];
    let removed=0,remainingTop=0,originalTop=0;
    for(const group of groups){
      if(group.start<0||group.start+group.count>idx.count||
        group.start%3!==0||group.count%3!==0)return;
      const start=next.length;
      const trimming=trimSlots.has(group.materialIndex??0);
      if(trimming)originalTop+=group.count;
      for(let i=group.start;i+2<group.start+group.count;i+=3){
        const a=idx.getX(i),b=idx.getX(i+1),c=idx.getX(i+2);
        if([a,b,c].some(n=>n<0||n>=pos.count))return;
        if(trimming){
          const lowHem=[a,b,c].some(n=>pos.getY(n)<.90);
          const sleeve=[a,b,c].some(n=>Math.abs(pos.getX(n))>.36);
          if(lowHem||sleeve){removed++;continue;}
          remainingTop+=3;
        }
        next.push(a,b,c);
      }
      if(next.length>start)nextGroups.push({
        start,count:next.length-start,materialIndex:group.materialIndex??0,
      });
    }
    // Guard against unknown meshes or incorrectly aligned material groups.
    if(removed<200||remainingTop<300||remainingTop>=originalTop)return;
    const cropped=geo.clone();
    cropped.setIndex(next);
    cropped.clearGroups();
    if(geo.groups.length)for(const group of nextGroups)
      cropped.addGroup(group.start,group.count,group.materialIndex);
    node.geometry=cropped;
    simplified++;
  });
  return simplified;
}
