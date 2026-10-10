import * as THREE from 'three';
import type {VRM} from '@pixiv/three-vrm';

/**
 * Preview-only geometry trim for the *known* baked VRoid F00 top.
 * Sleeve islands and long overcoat hem are in the SAME Tops primitive
 * as the inner top, so hiding that entire material would erase the shirt.
 * We clip only the known preview's outer silhouette in rest-pose space.
 * An authored, jacket-free rig remains necessary for truly faithful clothes.
 */
export function trimPreviewOuterwear(vrm:VRM):number {
  let simplified=0;
  vrm.scene.traverse(node=>{
    if(!(node instanceof THREE.SkinnedMesh))return;
    const m=node.material;
    if(Array.isArray(m)||!m||!/F00_008_01_Tops_01_CLOTH/i.test(m.name))return;
    const geo=node.geometry;
    const pos=geo.getAttribute('position');
    const index=geo.getIndex();
    // Refuse other model layouts, shared multipart geometry or missing indices.
    if(!pos||!index||pos.count<1500||pos.count>20000||geo.groups.length>1)return;
    const kept:number[]=[];
    let deleted=0;
    for(let i=0;i+2<index.count;i+=3){
      const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2);
      const ys=[pos.getY(a),pos.getY(b),pos.getY(c)];
      const xs=[pos.getX(a),pos.getX(b),pos.getX(c)];
      const lowHem=ys.some(y=>y<.90);
      const sleeve=xs.some(x=>Math.abs(x)>.36);
      if(lowHem||sleeve){deleted++;continue;}
      kept.push(a,b,c);
    }
    // If a different baked source doesn't resemble the expected design,
    // fail closed rather than mutilating the avatar.
    if(deleted<200||kept.length<900||kept.length>=index.count)return;
    const cropped=geo.clone();
    cropped.setIndex(kept);
    cropped.clearGroups();
    node.geometry=cropped;
    simplified++;
  });
  return simplified;
}
