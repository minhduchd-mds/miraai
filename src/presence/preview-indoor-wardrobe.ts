import * as THREE from 'three';
import type {VRM} from '@pixiv/three-vrm';

const TOP='F00_008_01_Tops_01_CLOTH';
const BODY='F00_000_00_Body_00_SKIN';

/**
 * Replace the single connected preview jacket+shirt mesh with a fitted indoor
 * crop top derived from the model's OWN skinned body surface.
 * Both the underlying skin and the new top use the original humanoid skeleton.
 * This deliberately only supports the audited VRoid Preview material layout.
 * Return false without hiding the jacket when that layout changes.
 */
export function dressPreviewForIndoors(vrm:Pick<VRM,'scene'>):boolean {
 const meshes:THREE.SkinnedMesh[]=[];
 vrm.scene.traverse(node=>{
  if(node instanceof THREE.SkinnedMesh)meshes.push(node);
 });
 const hasMaterial=(mesh:THREE.SkinnedMesh,name:string)=>{
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  return materials.some(m=>m?.name===name);
 };
 const jacket=meshes.find(m=>hasMaterial(m,TOP));
 const body=meshes.filter(m=>hasMaterial(m,BODY))
  .sort((a,b)=>(b.geometry.getIndex()?.count??0)-(a.geometry.getIndex()?.count??0))[0];
 if(!jacket||!body||!body.parent||!jacket.parent)return false;
 const geometry=body.geometry,index=geometry.getIndex();
 const position=geometry.getAttribute('position');
 const joints=geometry.getAttribute('skinIndex');
 const weights=geometry.getAttribute('skinWeight');
 if(!index||!position||!joints||!weights||!body.skeleton)return false;
 const materials=Array.isArray(body.material)?body.material:[body.material];
 const skinSlot=materials.findIndex(m=>m?.name===BODY);
 if(skinSlot<0)return false;
 const groups=geometry.groups.length?geometry.groups:
  [{start:0,count:index.count,materialIndex:0}];
 const indices:number[]=[];
 for(const group of groups){
  if(group.materialIndex!==skinSlot)continue;
  if(group.start<0||group.count<0||group.start%3||group.count%3||
    group.start+group.count>index.count)return false;
  for(let i=group.start;i+2<group.start+group.count;i+=3){
   const tri=[index.getX(i),index.getX(i+1),index.getX(i+2)];
   if(tri.some(k=>k<0||k>=position.count))return false;
   if(tri.every(k=>position.getY(k)>=1.02 &&
       position.getY(k)<=1.295 && Math.abs(position.getX(k))<.315))
     indices.push(...tri);
  }
 }
 // Fail closed: never expose the character if there is no safe replacement.
 if(indices.length<1200||indices.length>10000)return false;
 const shirtGeometry=geometry.clone();
 shirtGeometry.setIndex(indices);
 shirtGeometry.clearGroups();
 const material=new THREE.MeshPhysicalMaterial({
  name:'Mira_indoor_fitted_top',color:'#1c1821',roughness:.91,
  metalness:0,side:THREE.DoubleSide,
  polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
 });
 const shirt=new THREE.SkinnedMesh(shirtGeometry,material);
 shirt.name='Mira_indoor_rigged_crop_top';
 shirt.position.copy(body.position);
 shirt.quaternion.copy(body.quaternion);
 shirt.scale.copy(body.scale);
 shirt.bindMode=body.bindMode;
 shirt.bind(body.skeleton,body.bindMatrix);
 shirt.frustumCulled=false;
 body.parent.add(shirt);
 jacket.visible=false;
 return true;
}
