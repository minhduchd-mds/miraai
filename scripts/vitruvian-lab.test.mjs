import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {readGlbJson} from './validate-realistic-avatar.mjs';
import * as THREE from 'three';
import {applyHumanHairPresentation,HUMAN_HAIR_PRESENTATION} from '../src/presence/human-hair-presentation.ts';
import {roomAssetLocation,loadRoomAsset} from '../src/presence/room-asset-location.ts';

const base='public/avatars/realistic/vitruvian-lab';
const manifest=JSON.parse(readFileSync(join(base,'manifest.json'),'utf8'));

test('real-human research model remains explicitly unapproved and sourced to pinned CC0',()=>{
 assert.equal(manifest.status,'lab_only');
 assert.equal(manifest.approved,false);
 assert.equal(manifest.visualApproval,'pending');
 assert.equal(manifest.license,'CC0-1.0');
 assert.equal(manifest.owner,'ibrews/VitruvianGodot');
 assert.match(manifest.sourceCommit,/^[0-9a-f]{40}$/);
 assert.equal(JSON.parse(readFileSync('public/avatars/realistic/manifest.json')).status,'pending');
});

test('real staged head has FACS eyes, mouth and expression poses (actual GLB binary)',()=>{
 const h=readGlbJson(readFileSync(join(base,'head.glb')));
 const names=new Set((h.meshes||[]).flatMap(x=>x.extras?.targetNames||[]));
 for(const key of ['Eyes_Closed_Max','Mouth_Large_Opened','Happy','aa_02','ow_08'])
  assert.ok(names.has(key),key);
 assert.equal((h.animations||[]).length,0);
 assert.ok((h.meshes||[]).length>1);
});

test('actual staged humanoid rig is skinned and Adobe Mixamo clips are removed',()=>{
 const b=readGlbJson(readFileSync(join(base,'body.glb')));
 assert.ok(b.skins?.length>0);
 assert.equal((b.animations||[]).length,0);
 const boneNames=new Set((b.skins||[]).flatMap(s=>s.joints||[])
   .map(i=>String(b.nodes?.[i]?.name||'').toLowerCase()));
 for(const key of ['head','leftupleg','rightupleg','leftleg','rightleg'])
  assert.ok([...boneNames].some(n=>n.includes(key)),key);
});

test('experimental hair GLB and skin eye hair PBR maps are real, not fake posters',()=>{
 const hair=readGlbJson(readFileSync(join(base,'hair.glb')));
 assert.ok(hair.meshes?.length);
 const files=['head.glb','body.glb','hair.glb',
 'vit_face_bc.webp','vit_face_n.webp','vit_face_rough.webp',
 'vit_body_bc.webp','vit_body_n.webp','vit_body_rough.webp',
 'vit_hair_diffuse.webp','vit_hair_normal.webp','vit_hair_opacity.webp',
 'vit_iris.webp','vit_sclera.webp','vit_mouth.webp'];
 for(const f of files){
  assert.ok(existsSync(join(base,f)),f);
  assert.ok(statSync(join(base,f)).size>1000,f);
 }
 const source=readFileSync('src/presence/VitruvianLabAvatar.tsx','utf8');
 assert.match(source,/poseVitruvianSeated\(body\.scene\)/);
 assert.match(source,/visemesForSpeech\(/);
 assert.match(source,/materialize\(/);
 assert.doesNotMatch(source,/getUserMedia\(/);
 assert.doesNotMatch(source,/Eyes_Opened_Max_Left:\.64/);
 assert.match(source,/out\.alphaToCoverage=true/);
 assert.match(source,/out\.roughnessMap=null;out\.metalness=0/);
});


test('vendor eye geometry inspection reports actual iris, sclera, eyelid and cornea mesh slots',()=>{
 const gltf=readGlbJson(readFileSync(join(base,'head.glb')));
 const materials=gltf.materials||[],accessors=gltf.accessors||[];
 const matches=[];
 for(const [meshId,mesh] of (gltf.meshes||[]).entries()){
  for(const [part,primitive] of (mesh.primitives||[]).entries()){
   const name=String(materials[primitive.material]?.name||'');
   if(!/iris|sclera|cornea|eye|tearline|caruncle/i.test(name))continue;
   const accessor=accessors[primitive.attributes?.POSITION]||{};
   matches.push({meshId,part,name,verts:accessor.count||0,
     min:accessor.min||null,max:accessor.max||null,
     nodes:(gltf.nodes||[]).filter(n=>n.mesh===meshId).map(n=>({
      name:n.name||'',translation:n.translation||null,rotation:n.rotation||null}))});
  }
 }
 assert.ok(matches.some(x=>/iris/i.test(x.name)),'PBR iris geometry must exist');
 assert.ok(matches.some(x=>/sclera/i.test(x.name)),'Eye sclera geometry must exist');
 // Logging bounded, public vendor mesh geometry only; no user/sensor details.
 console.log('[Mira human-eye geometry]',JSON.stringify(matches).slice(0,6000));
});


test('the local iris depth correction clears the source sclera instead of shifting the whole eyeball',()=>{
 const gltf=readGlbJson(readFileSync(join(base,'head.glb')));
 let checked=0;
 for(const mesh of gltf.meshes||[]){
  const get=(prefix)=>{
   const p=(mesh.primitives||[]).find(x=>String(gltf.materials?.[x.material]?.name||'').toLowerCase().startsWith(prefix));
   return p===undefined?null:gltf.accessors?.[p.attributes?.POSITION]||null;
  };
  const iris=get('vitiris'),sclera=get('vitsclera');
  if(!iris||!sclera)continue;
  const margin=iris.max[2]+.0059-sclera.max[2];
  assert.ok(margin>.0008&&margin<.003, 'Iris must clear front of opaque sclera by 0.8–3 mm');
  checked++;
 }
 assert.equal(checked,2,'left/right eyes must be individually checked');
 const source=readFileSync('src/presence/VitruvianLabAvatar.tsx','utf8');
 assert.ok(source.includes('obj.position.z+=.0059'))
 assert.match(source,/irisesAdjusted!==2/);
});

test('head-shadow acne regression: fine hair cards cannot cast dot shadows over skin',()=>{
 const source=readFileSync('src/presence/VitruvianLabAvatar.tsx','utf8');
 assert.ok(source.includes("obj.castShadow=kind!=='hair'"));
 assert.ok(source.includes("obj.receiveShadow=kind!=='hair'"));
 assert.ok(source.includes("Eyes_Opened_Max_Left:.27*(1-motion.blink)"));
 assert.ok(source.includes("Eyes_Opened_Max_Right:.27*(1-motion.blink)"));
});

test('hair shoulder presentation shader remains alpha-tested and never changes source mesh',()=>{
 const mat=new THREE.MeshStandardMaterial();
 applyHumanHairPresentation(mat);
 assert.equal(mat.customProgramCacheKey(),HUMAN_HAIR_PRESENTATION.revision);
 const shader={
  vertexShader:'#include <common>\n#include <project_vertex>',
  fragmentShader:'#include <common>\n#include <alphatest_fragment>'
 };
 mat.onBeforeCompile(shader,{});
 assert.match(shader.vertexShader,/varying vec3 miraHairWorldPosition/);
 assert.match(shader.vertexShader,/modelMatrix\*vec4\(transformed,1\.0\)/);
 assert.match(shader.fragmentShader,/miraHairStart/);
 assert.match(shader.fragmentShader,/smoothstep\(miraHairStart,miraHairStart \+ 0\.190,miraHairWorldPosition\.y\)/);
 assert.ok(shader.fragmentShader.includes('0.028*sin('));
 assert.ok(shader.fragmentShader.indexOf('smoothstep')<shader.fragmentShader.indexOf('#include <alphatest_fragment>'));
 mat.dispose();
});
test('human lab cloth uses PBR fabric sheen and separately preserves skin texture',()=>{
 const src=readFileSync('src/presence/VitruvianLabAvatar.tsx','utf8');
 assert.ok(src.includes('new THREE.MeshPhysicalMaterial({'));
 assert.ok(!src.includes('MeshPhysicalMaterial().copy(m)'));
 assert.ok(src.includes('out.sheen=.44'));
 assert.ok(src.includes('applyHumanHairPresentation(out)'));
 assert.ok(src.includes("get('hairStyle')!=='long'"));
 assert.ok(src.includes('out.map=tex.get(\'vit_face_bc\')'));
 assert.ok(!src.includes('hair.geometry.scale('));
});


test('Human Lab requests only PBR textures actually sampled by current material slots',()=>{
 const code=readFileSync('src/presence/VitruvianLabAvatar.tsx','utf8');
 const section=code.match(/const textureResults=await Promise\.allSettled\(\[([\s\S]*?)\]\.map\(async key/);
 assert.ok(section,'Texture load list is explicit and auditable');
 for(const unused of ['vit_face_rough','vit_hair_diffuse','vit_sclera']){
   assert.ok(!section[1].includes("'"+unused+"'"),'Avoid redundant decode/GPU upload: '+unused);
 }
 const keys=[...section[1].matchAll(/'vit_[a-z0-9_]+'/g)].map(x=>x[0]);
 assert.equal(keys.length,9,'Only nine sampled PBR maps are needed');
 assert.equal(new Set(keys).size,9);
});

test('opt-in CDN origin must be HTTPS and fallback remains same-origin',async()=>{
 const local=roomAssetLocation('./');
 assert.deepEqual(local.candidates('head.glb'),['./avatars/realistic/vitruvian-lab/head.glb']);
 assert.equal(local.cdnRoot,null);
 const cloud=roomAssetLocation('/miraai/','https://cdn.example.test/3d/v1');
 assert.deepEqual(cloud.candidates('hair.glb'),[
  'https://cdn.example.test/3d/v1/hair.glb',
  '/miraai/avatars/realistic/vitruvian-lab/hair.glb',
 ]);
 assert.equal(roomAssetLocation('./','http://storage.example').cdnRoot,null);
 assert.equal(roomAssetLocation('./','https://user:pass@example.test/assets').cdnRoot,null);
 assert.equal(roomAssetLocation('./','garbage-url').cdnRoot,null);
 assert.throws(()=>cloud.candidates('../private.json'),/Unsupported 3D asset/);
 assert.throws(()=>cloud.candidates('other-user.glb?token=secret'),/Unsupported 3D asset/);
 const attempts=[];
 const asset=await loadRoomAsset(cloud.candidates('head.glb'),async url=>{
  attempts.push(url);
  if(url.includes('cdn.example.test'))throw Error('CDN temporarily unavailable');
  return {ok:true};
 });
 assert.equal(asset.ok,true);
 assert.equal(attempts.length,2);
});
test('failed or cancelled Human Lab assets use settled cleanup, never leave orphan GLBs',()=>{
 const source=readFileSync('src/presence/VitruvianLabAvatar.tsx','utf8');
 assert.match(source,/Promise\\.allSettled\\(\\[/);
 assert.ok(source.includes('for(const target of [root,...owned])'));
 assert.ok(source.includes('for(const part of [headResult,bodyResult,hairResult])'));
 assert.ok(source.includes("if(part.status==='fulfilled')owned.push(part.value.scene)"));
 assert.ok(source.includes("textureResults.some(result=>result.status==='rejected')"));
 assert.ok(source.includes('VITE_MIRA_3D_ASSET_BASE_URL'));
});
