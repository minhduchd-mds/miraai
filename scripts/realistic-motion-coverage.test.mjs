import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {auditHumanAssetRig,auditStagedHumanAsset} from './audit-realistic-motion.mjs';

function model(){
  return {
    asset:{version:'2.0'},
    materials:[
      {name:'Mira_Face_Skin',pbrMetallicRoughness:{baseColorTexture:{index:0}},
       normalTexture:{index:1}},
      {name:'Mira_Eye_Iris',pbrMetallicRoughness:{baseColorTexture:{index:2}}},
      {name:'Mira_Hair_Strands',pbrMetallicRoughness:{baseColorTexture:{index:3}}},
    ],
    meshes:[{primitives:[{material:0},{material:1},{material:2}],
      extras:{targetNames:['eyeBlinkLeft','eyeBlinkRight','jawOpen','mouthSmile']}}],
    nodes:['Head','Spine','LeftArm','RightArm','LeftUpLeg','RightUpLeg',
      'LeftLeg','RightLeg'].map(name=>({name})),
    skins:[{joints:[0,1,2,3,4,5,6,7]}],
  };
}
const copy=x=>JSON.parse(JSON.stringify(x));
function glb(document){
  const data=Buffer.from(JSON.stringify(document));
  const padding=(4-data.length%4)%4;
  const chunk=Buffer.concat([data,Buffer.alloc(padding,32)]);
  const b=Buffer.alloc(20+chunk.length);
  b.write('glTF',0);b.writeUInt32LE(2,4);b.writeUInt32LE(b.length,8);
  b.writeUInt32LE(chunk.length,12);b.writeUInt32LE(0x4e4f534a,16);
  chunk.copy(b,20);return b;
}

test('rigged GLB with separate PBR face, eye, hair and facial blendshapes passes structural audit',()=>{
  const report=auditHumanAssetRig(model());
  assert.equal(report.ready,true,JSON.stringify(report.errors));
  assert.deepEqual(report.materialRegions,{skin:1,eyes:1,hair:1});
  assert.ok(Object.values(report.rig).every(Boolean));
  assert.ok(Object.values(report.expressions).every(Boolean));
  assert.ok(report.warnings.includes('eye_gaze_requires_runtime_glb_mapping_or_vrm_lookat'));
});
test('anime preview cannot masquerade as PBR face just by having several materials',()=>{
  const sample=model();sample.materials=sample.materials.map((m,i)=>({...m,name:'Material_0'+i}));
  const report=auditHumanAssetRig(sample);
  assert.equal(report.ready,false);
  for(const role of ['skin','eyes','hair'])
    assert.ok(report.errors.includes(role+'_textured_pbr_missing'));
});
test('reject missing facial skin normals, unlit irises, expressions and seated pose bones',()=>{
  const sample=model();
  delete sample.materials[0].normalTexture;
  sample.materials[1].extensions={KHR_materials_unlit:{}};
  sample.meshes[0].extras.targetNames=['unused'];
  sample.skins[0].joints=[0,1,2];
  const report=auditHumanAssetRig(sample);
  for(const code of ['skin_normal_detail_missing','eye_unlit_material',
    'expression_blink_missing','expression_mouth_missing','expression_smile_missing',
    'rig_rightArm_missing','rig_leftLeg_missing','rig_rightKnee_missing'])
    assert.ok(report.errors.includes(code),code);
});
test('VRM1 expression presets and humanoid bone maps are understood',()=>{
  const sample=model();
  sample.meshes[0].extras.targetNames=[];
  sample.skins=[{joints:[]}];
  sample.extensions={VRMC_vrm:{
    humanoid:{humanBones:Object.fromEntries(['head','spine','leftUpperArm',
      'rightUpperArm','leftUpperLeg','rightUpperLeg','leftLowerLeg','rightLowerLeg']
      .map(n=>[n,{node:0}]))},
    expressions:{preset:{blink:{},aa:{},happy:{}}},
    lookAt:{type:'bone'},
  }};
  const report=auditHumanAssetRig(sample);
  assert.equal(report.ready,true,JSON.stringify(report.errors));
  assert.ok(!report.warnings.length);
});
test('staged GLB is checked against its own real bytes and a missing asset stays unapproved',()=>{
  const root=mkdtempSync(join(tmpdir(),'mira-motion-'));
  try{
    const dir=join(root,'public/avatars/realistic');mkdirSync(dir,{recursive:true});
    const manifest={status:'pending',asset:'mira-human-v1.glb'};
    writeFileSync(join(dir,'manifest.json'),JSON.stringify(manifest));
    assert.equal(auditStagedHumanAsset(root).status,'awaiting_asset');
    writeFileSync(join(dir,manifest.asset),glb(model()));
    const r=auditStagedHumanAsset(root);
    assert.equal(r.status,'ready_for_visual_review');
    assert.equal(r.ready,true);
    assert.equal(r.warnings.length,1);
    manifest.status='approved';writeFileSync(join(dir,'manifest.json'),JSON.stringify(manifest));
    rmSync(join(dir,manifest.asset));
    assert.equal(auditStagedHumanAsset(root).status,'failed');
  }finally{rmSync(root,{recursive:true,force:true});}
});
