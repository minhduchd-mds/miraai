import {createHash} from 'node:crypto';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {qualityReport,readGlbJson} from './validate-realistic-avatar.mjs';
import {auditHumanAssetRig} from './audit-realistic-motion.mjs';

/**
 * Release proof for a bespoke 3D human.
 * This checks source evidence, stored rights assertions and actual bytes.
 * It cannot establish legal ownership, likeness consent or visual fidelity.
 */
export const sha256=(bytes)=>createHash('sha256').update(bytes).digest('hex');
const FILE=/^[a-z0-9][a-z0-9_-]{1,70}\.(?:vrm|glb)$/;
const HASH=/^[0-9a-f]{64}$/;
const url=value=>{
 if(typeof value!=='string')return false;
 try{
  const u=new URL(value);
  return u.protocol==='https:' && Boolean(u.hostname) &&
    !/(^|\.)(?:example\.(?:org|com|net)|localhost|invalid)$/.test(u.hostname);
 }catch{return false;}
};
const name=value=>typeof value==='string'&&value.trim().length>=3;
const date=value=>typeof value==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(value)&&
 !Number.isNaN(Date.parse(value+'T00:00:00Z'));
const VIEWS=['front','left45','right45','profile','back'];

export function evaluateAvatarRights(manifest,rights,binary){
 const failures=[];
 if(!FILE.test(manifest?.asset||'')) failures.push('invalid_asset_name');
 if(!rights||typeof rights!=='object')return {ok:false,failures:[...failures,'rights_dossier_missing']};
 if(rights.schemaVersion!==1)failures.push('unsupported_dossier_version');
 if(rights.asset!==manifest.asset)failures.push('rights_asset_mismatch');
 if(!HASH.test(rights.sha256||'') || !binary ||
   (binary && sha256(binary)!==rights.sha256))failures.push('binary_sha256_mismatch');
 if(!name(rights.creator)||!name(rights.rightsHolder))
   failures.push('creator_or_rights_holder_missing');
 if(!url(rights.sourceUrl)||rights.sourceUrl!==manifest.sourceUrl)
   failures.push('rights_source_url_mismatch');
 if(!url(rights.evidenceUrl))failures.push('license_evidence_url_invalid');
 if(!['CC0-1.0','CC-BY-4.0','PROPRIETARY-OWNED'].includes(rights.license)||
   rights.license!==manifest.license)failures.push('license_not_approved');
 if(rights.commercialUse!==true||rights.redistribution!==true||rights.modification!==true)
   failures.push('permission_scope_not_documented');
 if(rights.license==='CC-BY-4.0'&&
    (!name(rights.attribution)||!url(rights.licenseNoticeUrl)))
   failures.push('cc_by_attribution_missing');
 const review=rights.review;
 if(!review||!name(review.rightsReviewer)||!name(review.visualReviewer)||
   !date(review.rightsReviewedAt)||!date(review.visualReviewedAt))
   failures.push('two_step_review_missing');
 if(!Array.isArray(rights.visualEvidence)||rights.visualEvidence.length!==VIEWS.length||
   VIEWS.some(view=>{
    const proof=rights.visualEvidence.find(v=>v?.view===view);
    return !proof||!url(proof.url);
   }))failures.push('five_view_evidence_missing');
 return {ok:failures.length===0,failures};
}

export function auditAvatarRelease({root=process.cwd()}={}){
 const directory=resolve(root,'public/avatars/realistic');
 const manifestPath=join(directory,'manifest.json');
 if(!existsSync(manifestPath))return {status:'failed',errors:['manifest_missing']};
 let m;
 try{m=JSON.parse(readFileSync(manifestPath,'utf8'));}
 catch{return {status:'failed',errors:['manifest_unreadable']};}
 if(m.status==='pending')return {status:'pending',errors:[]};
 if(m.status!=='approved')return {status:'failed',errors:['manifest_status_invalid']};
 if(!FILE.test(m.asset||''))return {status:'failed',errors:['invalid_asset_name']};
 const binPath=join(directory,m.asset),rightPath=binPath+'.rights.json';
 if(!existsSync(binPath)||!existsSync(rightPath))
   return {status:'failed',errors:[!existsSync(binPath)?'asset_missing':'rights_dossier_missing']};
 let rights,buffer;
 try{rights=JSON.parse(readFileSync(rightPath,'utf8'));buffer=readFileSync(binPath);}
 catch{return {status:'failed',errors:['dossier_or_asset_unreadable']};}
 const result=evaluateAvatarRights(m,rights,buffer);
 const errors=[...result.failures];
 // The provenance record alone cannot certify a visually or mechanically valid
 // model: keep the existing GLB/VRM structural gates mandatory at build time.
 const technical=qualityReport(m,buffer);
 if(technical.status!=='approved')errors.push(...technical.errors);
 try{
  const motion=auditHumanAssetRig(readGlbJson(buffer));
  if(!motion.ready)errors.push(...motion.errors);
 }catch{errors.push('rig_or_facial_audit_failed');}
 return {status:errors.length?'failed':'review_recorded',errors,
   asset:m.asset,sha256:sha256(buffer)};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const report=auditAvatarRelease();
 console.log('[Mira 3D release evidence]',JSON.stringify(report));
 if(report.status==='review_recorded')
  console.warn('Proof record matched; identity, copyright ownership and visual quality still require independent human/legal verification.');
 if(report.status==='failed')process.exitCode=1;
}
