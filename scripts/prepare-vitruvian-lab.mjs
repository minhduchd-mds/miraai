import {copyFileSync,mkdirSync,readFileSync,writeFileSync,statSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {NodeIO} from '@gltf-transform/core';
import {readGlbJson} from './validate-realistic-avatar.mjs';

// This is NOT production approval. Body animation tracks are removed with
// glTF Transform, including their referenced data, before redistribution.
// The person is a licensed CC0 research candidate, not the portrait of Mira.
const SOURCE='ibrews/VitruvianGodot';
const REV='bdecdcd537b4031fdd0fb299b7e4f93f084fffa0';
const LICENSE='CC0-1.0';
export async function prepareVitruvianLab({sourceDir='/tmp/vitruvian',
 destDir='public/avatars/realistic/vitruvian-lab'}={}){
 const out=resolve(destDir);mkdirSync(out,{recursive:true});
 const io=new NodeIO();
 const originals=[['vitruvian_head.glb','head.glb'],
  ['vitruvian_body.glb','body.glb'],['hairtool_cards.glb','hair.glb']];
 for(const [input,output] of originals){
  const src=join(sourceDir,input),doc=await io.read(src);
  for(const clip of [...doc.getRoot().listAnimations()])clip.dispose();
  // Keep original mesh, morph target and skeleton relationships intact.
  await io.write(join(out,output),doc);
  const gltf=readGlbJson(readFileSync(join(out,output)));
  if((gltf.animations||[]).length)throw Error('Animations must be removed: '+output);
  if(output==='head.glb'){
   const names=(gltf.meshes||[]).flatMap(x=>x.extras?.targetNames||[]);
   if(!names.some(x=>/Eyes_Closed_Max/i.test(x))||
      !names.some(x=>/Mouth_Large_Opened/i.test(x)))
    throw Error('FACS blink/jaw lost during export');
  }
  if(output==='body.glb'&&!(gltf.skins||[]).length)
   throw Error('Character skin was lost during export');
  if(statSync(join(out,output)).size>40*1024*1024)
   throw Error('GLB exceeds per-part WebGL budget');
 }
 const record={status:'lab_only',approved:false,owner:SOURCE,sourceCommit:REV,
  license:LICENSE,sourceUrl:'https://github.com/'+SOURCE,
  rawParts:originals.map(x=>x[1]),textures:{
    face:['vit_face_bc.webp','vit_face_n.webp','vit_face_rough.webp'],
    body:['vit_body_bc.webp','vit_body_n.webp','vit_body_rough.webp'],
    hair:['vit_hair_diffuse.webp','vit_hair_normal.webp','vit_hair_opacity.webp'],
    eyes:['vit_iris.webp','vit_sclera.webp'],mouth:['vit_mouth.webp']
  },visualApproval:'pending'};
 writeFileSync(join(out,'manifest.json'),JSON.stringify(record,null,2)+'\n');
 return record;
}
if(process.argv[1]?.endsWith('prepare-vitruvian-lab.mjs')){
 await prepareVitruvianLab();
 console.log('[Mira human lab] authored CC0 candidate prepared, UNAPPROVED');
}
