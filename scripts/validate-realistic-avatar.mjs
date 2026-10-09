import {existsSync, readFileSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const avatarPath='public/avatars/realistic';
const manifestPath=resolve(avatarPath,'manifest.json');

/** Parse VRM as GLB 2.0; allows quality checks without a heavy renderer dependency. */
export function readGlbJson(buffer) {
  if(buffer.length<20||buffer.toString('ascii',0,4)!=='glTF')
    throw Error('Avatar is not a valid GLB/VRM');
  if(buffer.readUInt32LE(4)!==2)
    throw Error('Only glTF 2.0 / VRM is supported');
  const total=buffer.readUInt32LE(8);
  if(total!==buffer.length)throw Error('GLB length mismatch');
  const chunkSize=buffer.readUInt32LE(12),chunkType=buffer.readUInt32LE(16);
  if(chunkType!==0x4E4F534A || chunkSize<=0 || 20+chunkSize>buffer.length)
    throw Error('GLB missing JSON chunk');
  return JSON.parse(buffer.toString('utf8',20,20+chunkSize));
}

export function collectAvatarChecks(gltf,{requireVrm=true}={}) {
  const errors=[];
  const used=new Set([...(gltf.extensionsUsed||[]),...(gltf.extensionsRequired||[])]);
  const hasVrm=used.has('VRMC_vrm')||used.has('VRM')||
    Boolean(gltf.extensions?.VRMC_vrm||gltf.extensions?.VRM);
  if(requireVrm&&!hasVrm)errors.push('Missing VRM 0.x / 1.0 humanoid metadata');
  const primitives=(gltf.meshes||[]).flatMap(mesh=>mesh.primitives||[]);
  const vertices=primitives.reduce((sum,p)=>{
    const idx=p.attributes?.POSITION;
    return sum+(Number(gltf.accessors?.[idx]?.count)||0);
  },0);
  if(vertices<30000)errors.push('Character must have at least 30K vertices (geometry only)');
  if(!(gltf.skins||[]).length)errors.push('Skinned avatar skeleton is missing');
  if((gltf.images||[]).length<3)errors.push('Need face/skin/hair/garment texture assets');
  const materials=gltf.materials||[];
  if(materials.filter(m=>m.pbrMetallicRoughness?.baseColorTexture||m.extensions?.KHR_materials_unlit).length<3)
    errors.push('Need at least 3 named textured material layers');
  if(!materials.some(m=>m.normalTexture))
    errors.push('Missing surface normal detail map');
  const names=(gltf.nodes||[]).map(n=>String(n.name||'').toLowerCase());
  if(!names.some(n=>/head|face|neck|頭/.test(n)))
    errors.push('Head / face rig not identifiable');
  return {errors,stats:{vertices,meshes:gltf.meshes?.length||0,
    materials:materials.length,images:gltf.images?.length||0,
    skins:gltf.skins?.length||0}};
}
export function qualityReport(manifest,buffer) {
  if(manifest.status!=='approved')
    return {status:'pending',errors:[],stats:null};
  const errors=[];
  if(!/^[a-z0-9][a-z0-9_-]{1,70}\.(?:vrm|glb)$/.test(manifest.asset||''))errors.push('Unsafe asset filename');
  if(!/^https:\/\//.test(manifest.sourceUrl||''))errors.push('Missing provenance source URL');
  if(!manifest.license||manifest.license.length<3)errors.push('Missing declared license');
  if(manifest.visualApproval!=='approved')errors.push('Missing manual face/reference approval');
  let stats=null;
  if(!buffer)errors.push('Approved realistic model binary missing');
  else{
    if(buffer.length>50*1024*1024)errors.push('Avatar exceeds 50MiB web budget');
    try{
      const result=collectAvatarChecks(readGlbJson(buffer),{requireVrm:String(manifest.asset).endsWith('.vrm')});
      errors.push(...result.errors);stats=result.stats;
    }catch(e){errors.push(String(e.message||e));}
  }
  return {status:errors.length?'failed':'approved',errors,stats};
}
function main(){
  const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
  const name=String(manifest.asset||'');
  const filename=/^[a-z0-9][a-z0-9_-]{1,70}\.(?:vrm|glb)$/.test(name)
    ?resolve(avatarPath,name):null;
  const content=filename&&existsSync(filename)?readFileSync(filename):null;
  const report=qualityReport(manifest,content);
  console.log('[Mira realistic avatar]',JSON.stringify(report));
  if(report.errors.length)process.exitCode=1;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))
  main();
