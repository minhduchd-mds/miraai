import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {readGlbJson} from './validate-realistic-avatar.mjs';

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
 assert.match(source,/obj\\.position\\.z\\+=\\.0059/);
 assert.match(source,/irisesAdjusted!==2/);
});
