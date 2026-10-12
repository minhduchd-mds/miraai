import {readFileSync,statSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {brotliCompressSync,constants} from 'node:zlib';
import {readGlbJson} from './validate-realistic-avatar.mjs';

const sourceDir='public/avatars/realistic/vitruvian-lab';
const outputDir='artifacts/meshopt-research';
const expected=['head.glb','body.glb','hair.glb'];
const hash=b=>createHash('sha256').update(b).digest('hex');
const names=g=>(g.nodes||[]).map(n=>n.name||'').filter(Boolean);
const targets=g=>(g.meshes||[]).flatMap(m=>m.extras?.targetNames||[]);
const bones=g=>(g.skins||[]).map(s=>s.joints?.length||0);
// glTF Transform may split one skin between multiple distinct skinned
// primitives. This is safe only when every resulting skin binds the same
// named skeleton, with complete inverse bind matrices.
const skinSignatures=g=>(g.skins||[]).map(s=>{
  const joints=(s.joints||[]).map(i=>String(g.nodes?.[i]?.name||''));
  const bind=g.accessors?.[s.inverseBindMatrices];
  return JSON.stringify({
    joints,
    root:String(g.nodes?.[s.skeleton]?.name||''),
    inverseBindCount:bind?.count||0,
  });
});
const identicalSkins=(before,after)=>{
 const original=[...new Set(skinSignatures(before))].sort();
 const compressed=[...new Set(skinSignatures(after))].sort();
 return JSON.stringify(original)===JSON.stringify(compressed) &&
  (after.nodes||[]).every(node=>
    node.skin===undefined || Number.isInteger(node.skin) &&
      node.skin>=0 && node.skin<(after.skins||[]).length);
};
const prims=g=>(g.meshes||[]).flatMap(m=>m.primitives||[]);
const topology=g=>prims(g).map(p=>({
  attributes:Object.keys(p.attributes||{}).sort(),
  morphs:(p.targets||[]).map(t=>Object.keys(t).sort()),
})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
const encodedSize=b=>brotliCompressSync(b,{params:{
  [constants.BROTLI_PARAM_QUALITY]:5,
}}).length;

export function verifyMeshoptCandidate(original,candidate,name){
 const before=readGlbJson(original),after=readGlbJson(candidate);
 const failure=[];
 if(!after.extensionsRequired?.includes('EXT_meshopt_compression'))
   failure.push('EXT_meshopt_compression not required');
 if((before.animations||[]).length!==(after.animations||[]).length)
   failure.push('animation clips changed');
 if(!identicalSkins(before,after))
   failure.push('skin skeleton or inverse binds changed');
 if(JSON.stringify([...names(before)].sort())!==JSON.stringify([...names(after)].sort()))
   failure.push('named hierarchy changed');
 if(JSON.stringify([...targets(before)].sort())!==JSON.stringify([...targets(after)].sort()))
   failure.push('morph target names changed');
 if(JSON.stringify(topology(before))!==JSON.stringify(topology(after)))
   failure.push('vertex attribute or morph target structure changed');
 if(prims(before).length!==prims(after).length)
   failure.push('mesh primitive count changed');
 if(name==='head.glb'){
   for(const key of ['Eyes_Closed_Max','Mouth_Large_Opened','Happy'])
     if(!targets(after).includes(key))failure.push('critical facial shape absent: '+key);
 }
 if(name==='body.glb' && !(after.skins||[]).length)
   failure.push('body skeleton absent');
 // Only promote a variant with a meaningfully smaller transfer size.
 const originalBr=encodedSize(original),candidateBr=encodedSize(candidate);
 const saved=originalBr-candidateBr;
 if(saved<originalBr*.05)failure.push('Brotli transfer saving below 5%');
 return {
  name,valid:failure.length===0,reasons:failure,
  originalBytes:original.length,candidateBytes:candidate.length,
  originalBrotliBytes:originalBr,candidateBrotliBytes:candidateBr,
  savedBrotliPercent:Math.round(1000*saved/originalBr)/10,
  originalSHA256:hash(original),candidateSHA256:hash(candidate),
  sourceMorphTargets:targets(before).length,
  compressedMorphTargets:targets(after).length,
  sourceSkinJoints:bones(before),
  compressedSkinJoints:bones(after),
 };
}

if(process.argv[1]?.endsWith('verify-vitruvian-meshopt.mjs')){
 mkdirSync(outputDir,{recursive:true});
 const report=expected.map(name=>{
  const original=readFileSync(join(sourceDir,name));
  const candidate=readFileSync(join(outputDir,name));
  return verifyMeshoptCandidate(original,candidate,name);
 });
 const result={
  methodology:'GLB structure parity and Brotli quality 5 transfer-size proxy',
  warnings:['Quantization affects vertex precision; screenshot/rig QA is required before rollout.',
    'Brotli sizes are offline estimates, not actual measured CDN response sizes.'],
  parts:report,passed:report.every(p=>p.valid),
 };
 const destination=join(outputDir,'report.json');
 writeFileSync(destination,JSON.stringify(result,null,2)+'\n');
 console.log('[Mira Meshopt candidates]',JSON.stringify(result,null,2));
 if(!result.passed)process.exitCode=1;
}
