import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {evaluateAvatarRights,auditAvatarRelease,sha256} from './check-avatar-release.mjs';

const bytes=Buffer.from('synthetic artwork bytes: NOT A REAL LICENSED 3D AVATAR');
const manifest={status:'approved',asset:'mira-human-v1.glb',license:'CC0-1.0',
  sourceUrl:'https://original-creator.test/models/mira',visualApproval:'approved'};
const rights=()=>({
 schemaVersion:1,asset:manifest.asset,sha256:sha256(bytes),
 creator:'Mira Original Artist',rightsHolder:'Mira Original Artist',
 sourceUrl:manifest.sourceUrl,evidenceUrl:'https://original-creator.test/licenses/mira',
 license:manifest.license,commercialUse:true,redistribution:true,modification:true,
 attribution:'',licenseNoticeUrl:'',
 review:{rightsReviewer:'Independent rights reviewer',rightsReviewedAt:'2026-10-16',
         visualReviewer:'3D visual reviewer',visualReviewedAt:'2026-10-16'},
 visualEvidence:['front','left45','right45','profile','back'].map(view=>({
  view,url:'https://visual-evidence.test/mira/'+view+'.png'
 }))
});
test('valid source claims, 5-view review and SHA256 can be structurally recorded',()=>{
 const r=evaluateAvatarRights(manifest,rights(),bytes);
 assert.deepEqual(r,{ok:true,failures:[]});
});
test('substituted binary, wrong asset and invented rights do not pass',()=>{
 const modified={...rights(),asset:'stolen-avatar.glb',
   evidenceUrl:'http://not-secure.test',commercialUse:false};
 const report=evaluateAvatarRights(manifest,modified,Buffer.from('unauthorized swap'));
 for(const violation of ['rights_asset_mismatch','binary_sha256_mismatch',
   'license_evidence_url_invalid','permission_scope_not_documented']){
  assert.ok(report.failures.includes(violation),violation);
 }
});
test('CC-BY requires both attribution and visible license notice URL',()=>{
 const m={...manifest,license:'CC-BY-4.0'};
 const r={...rights(),license:'CC-BY-4.0'};
 assert.ok(evaluateAvatarRights(m,r,bytes).failures.includes('cc_by_attribution_missing'));
 r.attribution='Artist Name — licensed under CC BY 4.0';
 r.licenseNoticeUrl='https://creativecommons.org/licenses/by/4.0/';
 assert.equal(evaluateAvatarRights(m,r,bytes).ok,true);
});
test('missing five-view visual evidence or signatures blocks release',()=>{
 const a=rights();
 a.visualEvidence.pop();
 a.review.visualReviewer='';
 const report=evaluateAvatarRights(manifest,a,bytes);
 assert.ok(report.failures.includes('five_view_evidence_missing'));
 assert.ok(report.failures.includes('two_step_review_missing'));
});
test('an unapproved production manifest stays safe without exposing a candidate',()=>{
 const root=mkdtempSync(join(tmpdir(),'mira-release-gate-'));
 try{
  const dir=join(root,'public/avatars/realistic');
  mkdirSync(dir,{recursive:true});
  writeFileSync(join(dir,'manifest.json'),JSON.stringify({...manifest,status:'pending',visualApproval:'pending'}));
  assert.deepEqual(auditAvatarRelease({root}),{status:'pending',errors:[]});
  writeFileSync(join(dir,'manifest.json'),JSON.stringify(manifest));
  assert.deepEqual(auditAvatarRelease({root}),{status:'failed',errors:['asset_missing']});
  writeFileSync(join(dir,manifest.asset),bytes);
  assert.deepEqual(auditAvatarRelease({root}),{status:'failed',errors:['rights_dossier_missing']});
  writeFileSync(join(dir,manifest.asset+'.rights.json'),JSON.stringify({...rights(),sha256:'0'.repeat(64)}));
  assert.ok(auditAvatarRelease({root}).errors.includes('binary_sha256_mismatch'));
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('production build requires release gate and quarantines pending GLB/VRM files',()=>{
 const pkg=JSON.parse(readFileSync('package.json','utf8'));
 assert.match(pkg.scripts.build,/^node scripts\/check-avatar-release\.mjs && /);
 const prune=readFileSync('scripts/prune-runtime-assets.mjs','utf8');
 assert.match(prune,/releaseAvatar/);
 assert.match(prune,/return !releaseAvatar \|\| file!==releaseAvatar/);
 const smoke=readFileSync('scripts/check-deploy-artifact.mjs','utf8');
 assert.match(smoke,/unapproved 3D human leaked into production build/);
});
