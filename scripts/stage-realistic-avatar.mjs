import {readFileSync,writeFileSync,copyFileSync,existsSync,statSync} from 'node:fs';
import {basename,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {qualityReport,readGlbJson} from './validate-realistic-avatar.mjs';
import {auditHumanAssetRig} from './audit-realistic-motion.mjs';

const FILE_PATTERN=/^[a-z0-9][a-z0-9_-]{1,70}\.(vrm|glb)$/;
const LICENSES=new Set(['CC0-1.0','CC-BY-4.0']);
export function buildStageManifest({file,asset,license,sourceUrl,poseMode='authored',
    scale=1,position=[0,0,2.28],rotationY=Math.PI}={}){
  const name=asset||basename(file||'');
  if(!FILE_PATTERN.test(name))throw Error('Require a safe .vrm/.glb asset name');
  if(!LICENSES.has(license))throw Error('Only CC0-1.0 or CC-BY-4.0 3D assets are stageable');
  try {const u=new URL(sourceUrl);if(u.protocol!=='https:')throw Error();}
  catch{throw Error('Provide an HTTPS original asset/provenance URL');}
  if(!['authored','mixamo-seated'].includes(poseMode))throw Error('Unknown rig pose mode');
  if(poseMode==='mixamo-seated'&&!name.endsWith('.glb'))
    throw Error('Mixamo seating is only supported for .glb');
  if(!Number.isFinite(scale)||scale<.25||scale>3)throw Error('Scale out of range');
  if(!Array.isArray(position)||position.length!==3||
    !position.every(x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=10))
    throw Error('Invalid position');
  if(!Number.isFinite(rotationY)||Math.abs(rotationY)>Math.PI*2)
    throw Error('Invalid rotation');
  return {status:'pending',asset:name,license,sourceUrl,visualApproval:'pending',
    poseMode,scale,position,rotationY};
}
export function stageRealisticAsset(opts,{root=process.cwd()}={}){
  const manifest=buildStageManifest(opts);
  const src=resolve(opts.file);
  const base=resolve(root,'public/avatars/realistic');
  const dst=resolve(base,manifest.asset);
  if(!src||src===dst)throw Error('Source and destination cannot be identical');
  if(!existsSync(src)||!statSync(src).isFile())throw Error('Avatar binary missing');
  const size=statSync(src).size;
  if(size>50*1024*1024||size<20)throw Error('Avatar must be a valid GLB under 50MiB');
  if(existsSync(dst))throw Error('Asset already staged; refusing overwrite');
  const manifestFile=resolve(base,'manifest.json');
  const existing=JSON.parse(readFileSync(manifestFile,'utf8'));
  if(existing.status==='approved')throw Error('Cannot overwrite a previously approved avatar');
  const binary=readFileSync(src);
  const qa=qualityReport(manifest,binary);
  if(qa.status!=='review_required')throw Error('Avatar technical QA failed: '+qa.errors.join('; '));
  const motion=auditHumanAssetRig(readGlbJson(binary));
  if(!motion.ready)throw Error('Avatar facial PBR / motion QA failed: '+motion.errors.join('; '));
  // Only after all checks pass is the asset copied, still PENDING manual visual approval.
  copyFileSync(src,dst);
  writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');
  return {manifest,report:qa,motionReport:motion,assetPath:dst};
}
function main(args=process.argv.slice(2)){
  const input={};
  for(let i=0;i<args.length;i++){
    const key=args[i];if(!key.startsWith('--')||i+1>=args.length)throw Error('Use --file --license --source-url [--pose-mode]');
    const value=args[++i];
    switch(key){
      case '--file':input.file=value;break;
      case '--license':input.license=value;break;
      case '--source-url':input.sourceUrl=value;break;
      case '--pose-mode':input.poseMode=value;break;
      case '--asset':input.asset=value;break;
      default:throw Error('Unknown argument '+key);
    }
  }
  if(!input.file)throw Error('Missing --file');
  const r=stageRealisticAsset(input);
  console.log('[Mira human staged]',JSON.stringify(r.report));
  console.log('Review 5 camera angles and obtain explicit visual approval BEFORE changing manifest.status and visualApproval to approved.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{main();}catch(e){console.error('[Mira avatar] '+String(e.message||e));process.exitCode=1;}
}
