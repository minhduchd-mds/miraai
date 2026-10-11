import {readFileSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {readGlbJson,collectAvatarChecks} from './validate-realistic-avatar.mjs';

export function profileGLB(path){
 const gltf=readGlbJson(readFileSync(path));
 const materials=(gltf.materials||[]).map(m=>({
  name:m.name||'(unnamed)',pbr:!!m.pbrMetallicRoughness,
  color:!!m.pbrMetallicRoughness?.baseColorTexture,
  normal:!!m.normalTexture,unlit:!!m.extensions?.KHR_materials_unlit
 }));
 const names=[...new Set((gltf.meshes||[]).flatMap(mesh=>[
  ...(mesh.extras?.targetNames||[]),
  ...(mesh.primitives||[]).flatMap(p=>p.extras?.targetNames||[])
 ]))];
 const bones=(gltf.skins||[]).flatMap(s=>(s.joints||[])
   .map(j=>gltf.nodes?.[j]?.name||'')).filter(Boolean);
 return {
  bytes:statSync(path).size,meshes:gltf.meshes?.length||0,
  vertices:(gltf.meshes||[]).flatMap(x=>x.primitives||[])
    .reduce((n,x)=>n+(gltf.accessors?.[x.attributes?.POSITION]?.count||0),0),
  skins:gltf.skins?.length||0,bones:bones.slice(0,65),
  morphTargets:names.slice(0,150),morphCount:names.length,
  animations:(gltf.animations||[]).map(x=>x.name||'(unnamed)'),
  materials,
  images:(gltf.images||[]).map(x=>({name:x.name||'',uri:x.uri||'',bufferView:x.bufferView??null})),
  textures:gltf.textures?.length||0,
  mimeTypes:(gltf.images||[]).map(x=>x.mimeType||''),
  defaultCheck:collectAvatarChecks(gltf,{requireVrm:false}),
 };
}
if(process.argv[1]?.endsWith('probe-photoreal-vendor.mjs')){
 const dir=process.env.ASSET_DIR||'/tmp/vitruvian';
 let failed=false;
 for(const part of ['head','body','hair_rigged']){
  try{
   const r=profileGLB(join(dir,'vitruvian_'+part+'.glb'));
   console.log('[VITRUVIAN '+part+']',JSON.stringify(r));
   if(part==='head'&&r.morphCount===0)failed=true;
   if(part==='body'&&r.skins===0)failed=true;
  }catch(e){console.error('[VITRUVIAN '+part+'] ERROR:',String(e));failed=true;}
 }
 if(failed)process.exitCode=1;
}
