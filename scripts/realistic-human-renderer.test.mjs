import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync('src/presence/realistic-human-quality.ts','utf8');
const transpiled=ts.transpileModule(source,{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext
}}).outputText;
const {validateRealisticHumanScene}=await import(
 'data:text/javascript;base64,'+Buffer.from(transpiled).toString('base64'));

function scene(nodes){return {traverse(fn){for(const n of nodes)fn(n);}}}
function material(i){return {name:'material_'+i,isMeshStandardMaterial:true,
  map:{id:i},normalMap:i===1?{id:2}:null};}
function realisticFixture(){
 const mats=[material(1),material(2),material(3)];
 return scene([
  {isBone:true,name:'Head'},
  ...mats.map((m,i)=>({isMesh:true,isSkinnedMesh:i===0,
    material:m,geometry:{attributes:{position:{count:12000}},index:{count:36000}}})),
 ]);
}
test('A complete rigged PBR human with face bone, normal and textured layers is technically eligible',()=>{
 const r=validateRealisticHumanScene(realisticFixture());
 assert.equal(r.accepted,true,JSON.stringify(r.errors));
 assert.deepEqual(r.stats,{vertices:36000,triangles:36000,skinnedMeshes:1,
  texturedMaterials:3,normalMappedMaterials:1,headBones:1});
});
test('Unrigged, flat/anime placeholder and low-detail glTF objects are refused',()=>{
 const failures=[
  {scene:scene([{isBone:true,name:'Head'},{isMesh:true,geometry:{attributes:{position:{count:1000}}},material:{isMeshBasicMaterial:true}}]),
   required:['rig_missing','insufficient_geometric_detail','unlit_shaders_not_approved']},
  {scene:scene([{isBone:true,name:'Spine'}]),required:['no_humanoid_head_bone']},
  {scene:scene([{isBone:true,name:'Head'},{isMesh:true,isSkinnedMesh:true,
    material:material(1),geometry:{attributes:{position:{count:42000}}}}]),
    required:['missing_independent_face_hair_outfit_textures']},
 ];
 for(const fixture of failures){
  const result=validateRealisticHumanScene(fixture.scene);
  for(const error of fixture.required)assert.ok(result.errors.includes(error),error);
  assert.equal(result.accepted,false);
 }
});
test('Runtime validator rejects heavy GPU geometry even if textured',()=>{
 const nodes=[{isBone:true,name:'mixamorigHead'}];
 for(let i=0;i<3;i++)nodes.push({isMesh:true,isSkinnedMesh:true,material:material(i+1),
  geometry:{attributes:{position:{count:500000}},index:{count:1_500_000}}});
 const result=validateRealisticHumanScene(scene(nodes));
 assert.ok(result.errors.includes('gpu_geometry_budget_exceeded'));
 assert.equal(result.accepted,false);
});
test('Avatar loading uses renderer-aware gate and keeps stylized models out of Production',()=>{
 const loader=readFileSync('src/presence/RoomMiraVRM.tsx','utf8');
 const manifest=JSON.parse(readFileSync('public/avatars/realistic/manifest.json','utf8'));
 assert.match(loader,/validateRealisticHumanScene\(gltf\.scene\)/);
 assert.match(loader,/chooseRoomAvatar\(manifest,\{allowStylizedPreview:allowPreview,allowStagedRealisticReview:allowReview\}\)/);
 assert.match(loader,/avatarPreview'\)==='1'/);
 assert.equal(manifest.status,'pending');
});

test('Every approved realistic human format is runtime-validated; VRM does not bypass GLB quality',()=>{
 const loader=readFileSync('src/presence/RoomMiraVRM.tsx','utf8');
 const branches=loader.match(/validateRealisticHumanScene\((?:gltf|vrm)\.scene\)/g)||[];
 assert.deepEqual(branches.sort(),[
   'validateRealisticHumanScene(gltf.scene)',
   'validateRealisticHumanScene(vrm.scene)',
 ]);
 assert.match(loader,/if\(source\.mode==='realistic'\)\{/);
 assert.match(loader,/if\(!quality\.accepted\)\{\s*VRMUtils\.deepDispose\(vrm\.scene\);\s*failure\(\);/);
 assert.match(loader,/source\.mode==='preview'\)adaptReferencePalette\(vrm\)/);
});

test('realistic avatar state stays invisible yet testable across all five views',()=>{
 const room=readFileSync('src/presence/PhotorealRoom3D.tsx','utf8');
 const loader=readFileSync('src/presence/RoomMiraVRM.tsx','utf8');
 assert.match(room,/data-avatar-status=\{avatarStatus\}/);
 assert.match(room,/onAssetStatus=\{recordAvatarStatus\}/);
 assert.match(loader,/statusCallback\.current\?\.\('rejected'\)/);
 assert.match(loader,/statusCallback\.current\?\.\('pending'\)/);
 assert.match(loader,/statusCallback\.current\?\.\(allowReview\?'review':'approved'\)/);
 // A DOM data-* attribute is allowed; visible JSX text content is not.
 assert.doesNotMatch(room,/>\s*\{avatarStatus\}\s*<\/span>/);
});

test('artist-authored realistic VRM pose and PBR palette are preserved',()=>{
 const loader=readFileSync('src/presence/RoomMiraVRM.tsx','utf8');
 assert.match(loader,/if\(source\.mode==='preview'\)seatedPose\(vrm\)/);
 assert.match(loader,/if\(source\.mode==='preview'\)adaptReferencePalette\(vrm\)/);
 assert.match(loader,/if\(source\.mode==='preview'\)vrm\.expressionManager\?\.setValue\('happy',\.22\)/);
 assert.doesNotMatch(loader,/^\s*seatedPose\(vrm\);/m);
 const target=loader.indexOf('if(vrm.lookAt&&vrm.lookAt.target!==camera)');
 const update=loader.indexOf('vrm.update(Math.min(delta,.06))');
 assert.ok(target>0&&update>target,'VRM must receive camera gaze target before its frame update');
 assert.match(loader,/const neutral=Math\.min\(1,Math\.max\(0,base\[index\]\|\|0\)\)/);
 assert.match(loader,/dst\[index\]=neutral\+\(1-neutral\)\*Math\.min/);
});
