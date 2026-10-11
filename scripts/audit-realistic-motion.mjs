import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {readGlbJson} from './validate-realistic-avatar.mjs';

/**
 * Asset-level motion and facial PBR gate for an ACTUAL rigged GLB/VRM.
 * Structural quality cannot prove visual likeness; five-view human sign-off
 * remains mandatory. Scene interaction is not simulated by this JSON audit.
 */
export function auditHumanAssetRig(gltf){
  const errors=[], warnings=[];
  const names=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const meshes=Array.isArray(gltf.meshes)?gltf.meshes:[];
  const materials=Array.isArray(gltf.materials)?gltf.materials:[];
  const used=new Set(meshes.flatMap(m=>(m.primitives||[]).map(p=>p.material).filter(Number.isInteger)));
  const slots={skin:[],eyes:[],hair:[]};
  for(const index of used){
    const m=materials[index];
    if(!m)continue;
    const n=names(m.extras?.miraRegion||m.name);
    const role=/face|skin|epiderm|head|body/.test(n)?'skin':
      /iris|sclera|cornea|eyeball|pupil|eye(?!brow)/.test(n)?'eyes':
      /hair|strand|fringe|bang|scalp|braid/.test(n)?'hair':null;
    if(!role)continue;
    slots[role].push({index,baseColor:Boolean(m.pbrMetallicRoughness?.baseColorTexture),
      normal:Boolean(m.normalTexture),unlit:Boolean(m.extensions?.KHR_materials_unlit)});
  }
  for(const role of ['skin','eyes','hair']){
    if(!slots[role].some(s=>s.baseColor&&!s.unlit))errors.push(`${role}_textured_pbr_missing`);
  }
  if(!slots.skin.some(s=>s.baseColor&&s.normal&&!s.unlit))errors.push('skin_normal_detail_missing');
  if(slots.eyes.some(s=>s.unlit))errors.push('eye_unlit_material');
  const nodes=Array.isArray(gltf.nodes)?gltf.nodes:[];
  const joints=new Set((gltf.skins||[]).flatMap(s=>s.joints||[]).filter(Number.isInteger));
  const jointNames=[...joints].map(i=>names(nodes[i]?.name));
  const v1=gltf.extensions?.VRMC_vrm;
  const v0=gltf.extensions?.VRM;
  const vrmBones=Object.keys(v1?.humanoid?.humanBones||{});
  for(const x of v0?.humanoid?.humanBones||[])if(x.bone)vrmBones.push(x.bone);
  const available=[...jointNames,...vrmBones.map(names)];
  const has=(rx)=>available.some(n=>rx.test(n));
  const coverage={
    head:has(/head|neck/),
    torso:has(/spine|chest|upperbody/),
    leftArm:has(/left(upper)?arm|leftshoulder/),
    rightArm:has(/right(upper)?arm|rightshoulder/),
    leftLeg:has(/left(up|upper)?leg|leftthigh/),
    rightLeg:has(/right(up|upper)?leg|rightthigh/),
    leftKnee:has(/left(lower)?leg|leftshin|leftknee/),
    rightKnee:has(/right(lower)?leg|rightshin|rightknee/),
  };
  for(const [key,present] of Object.entries(coverage))
    if(!present)errors.push(`rig_${key}_missing`);
  const targets=new Set();
  for(const m of meshes){
    for(const n of m.extras?.targetNames||[])targets.add(names(n));
    for(const p of m.primitives||[])
      for(const n of p.extras?.targetNames||[])targets.add(names(n));
  }
  for(const key of Object.keys(v1?.expressions?.preset||{}))targets.add(names(key));
  for(const group of v0?.blendShapeMaster?.blendShapeGroups||[]){
    targets.add(names(group.presetName));targets.add(names(group.name));
  }
  const hasExpression=rx=>[...targets].some(x=>rx.test(x));
  const expressions={
    blink:hasExpression(/blink|eyeclose|eyesclosed/),
    mouth:hasExpression(/jawopen|mouthopen|^aa$|^a$|visemeaa|moutha|visemeih|^ih$/),
    smile:hasExpression(/happy|smile|joy|mouthhappy/),
  };
  for(const [key,present] of Object.entries(expressions))
    if(!present)errors.push(`expression_${key}_missing`);
  const eyeGaze=Boolean(v1?.lookAt||v0?.firstPerson?.lookAtTypeName);
  if(!eyeGaze)warnings.push('eye_gaze_requires_runtime_glb_mapping_or_vrm_lookat');
  if(!meshes.length)errors.push('no_renderable_meshes');
  return {ready:errors.length===0,errors,warnings,
    materialRegions:Object.fromEntries(Object.entries(slots).map(([k,v])=>[k,v.length])),
    rig:coverage,expressions};
}

export function auditStagedHumanAsset(root=process.cwd()){
  const dir=resolve(root,'public/avatars/realistic');
  const manifest=JSON.parse(readFileSync(resolve(dir,'manifest.json'),'utf8'));
  const name=String(manifest.asset||'');
  if(manifest.status==='pending'&&!existsSync(resolve(dir,name)))
    return {status:'awaiting_asset',ready:false,errors:[],warnings:['No licensed human asset is staged']};
  if(!/^[a-z0-9][a-z0-9_-]{1,70}\.(vrm|glb)$/.test(name))
    return {status:'failed',ready:false,errors:['unsafe_asset_name'],warnings:[]};
  const path=resolve(dir,name);
  if(!existsSync(path))
    return {status:'failed',ready:false,errors:['human_asset_file_missing'],warnings:[]};
  try{
    const report=auditHumanAssetRig(readGlbJson(readFileSync(path)));
    return {status:report.ready?'ready_for_visual_review':'failed',...report};
  }catch(e){
    return {status:'failed',ready:false,errors:[String(e.message||e)],warnings:[]};
  }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const report=auditStagedHumanAsset();
  console.log('[Mira facial PBR / motion asset gate]',JSON.stringify(report));
  if(report.status==='failed')process.exitCode=1;
}
