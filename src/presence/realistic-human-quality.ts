/**
 * Runtime, renderer-independent validation of an APPROVED GLB.
 * This checks technical fidelity, not identity or photorealism itself.
 * License/provenance/manual visual approval happen before loading.
 */
export type HumanQualityReport={
  accepted:boolean;
  errors:string[];
  stats:{vertices:number;triangles:number;skinnedMeshes:number;texturedMaterials:number;
    normalMappedMaterials:number;headBones:number};
};
type HumanMaterial={name?:string;isMeshStandardMaterial?:boolean;isMeshPhysicalMaterial?:boolean;
  isMeshBasicMaterial?:boolean;map?:unknown;normalMap?:unknown};
type HumanNode={name?:string;isMesh?:boolean;isSkinnedMesh?:boolean;isBone?:boolean;
  geometry?:{attributes?:{position?:{count?:number}};index?:{count?:number}};
  material?:HumanMaterial|HumanMaterial[]};
type HumanScene={traverse:(callback:(node:HumanNode)=>void)=>void};
export function validateRealisticHumanScene(scene:HumanScene):HumanQualityReport{
  const materials=new Set<HumanMaterial>();
  const normals=new Set<HumanMaterial>();
  let vertices=0,triangles=0,skinnedMeshes=0,headBones=0,unlitCount=0;
  scene.traverse(node=>{
    if(node.isBone && /head|face|neck|mixamorighead|頭/i.test(node.name||''))headBones++;
    if(!node.isMesh)return;
    if(node.isSkinnedMesh)skinnedMeshes++;
    const n=Number(node.geometry?.attributes?.position?.count)||0;
    vertices+=n;
    triangles+=Math.floor((Number(node.geometry?.index?.count)||n)/3);
    const ms=Array.isArray(node.material)?node.material:[node.material];
    for(const mat of ms){
      if(!mat)continue;
      if(mat.isMeshBasicMaterial)unlitCount++;
      const pbr=mat.isMeshStandardMaterial||mat.isMeshPhysicalMaterial;
      if(!pbr)continue;
      if(mat.map)materials.add(mat);
      if(mat.normalMap)normals.add(mat);
    }
  });
  const errors:string[]=[];
  if(skinnedMeshes<1)errors.push('rig_missing');
  if(vertices<30_000)errors.push('insufficient_geometric_detail');
  if(triangles>1_250_000)errors.push('gpu_geometry_budget_exceeded');
  if(materials.size<3)errors.push('missing_independent_face_hair_outfit_textures');
  if(normals.size<1)errors.push('missing_surface_normal_detail');
  if(headBones<1)errors.push('no_humanoid_head_bone');
  if(unlitCount)errors.push('unlit_shaders_not_approved');
  return {accepted:errors.length===0,errors,stats:{
    vertices,triangles,skinnedMeshes,texturedMaterials:materials.size,
    normalMappedMaterials:normals.size,headBones,
  }};
}
