import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync,symlinkSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {gitBlobHash,auditAssetRights,listTrackedMedia} from './audit-asset-rights.mjs';

const fixture=()=>{
 const root=mkdtempSync(join(tmpdir(),'mira-ip-'));
 const path='public/mira-assets/scenes/example.webp',bytes=Buffer.from('synthetic test asset');
 mkdirSync(dirname(join(root,path)),{recursive:true});
 writeFileSync(join(root,path),bytes);
 const registry={schemaVersion:1,groups:{scenes:{status:'review_required',license:'unknown'}},
  assets:[{path,bytes:bytes.length,gitBlobSha:gitBlobHash(bytes),group:'scenes'}]};
 return {root,path,registry};
};
test('content hashes ensure integrity but do not claim copyright permission',()=>{
 const {root,registry}=fixture();
 try{
  const result=auditAssetRights({root,registry});
  assert.equal(result.ok,true,JSON.stringify(result.failures));
  assert.equal(result.scanned,1);
  assert.equal(result.unresolved.length,1);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('unregistered and silently replaced media cause hard failures',()=>{
 const {root,path,registry}=fixture();
 try{
  const newFile=join(root,'public/mira-assets/scenes/new.png');
  writeFileSync(newFile,'test');
  assert.ok(auditAssetRights({root,registry}).failures.some(x=>x.startsWith('unregistered_media:')));
  rmSync(newFile);
  writeFileSync(join(root,path),'changed');
  assert.ok(auditAssetRights({root,registry}).failures.some(x=>x.startsWith('changed_without_rights_review:')));
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('invented licenses and deleted media never count as verified',()=>{
 const {root,registry}=fixture();
 try{
  registry.groups.scenes.status='verified';
  assert.ok(auditAssetRights({root,registry}).failures.some(x=>x.startsWith('unsubstantiated_approval:')));
  registry.groups.scenes.status='review_required';
  registry.assets[0].path='public/mira-assets/scenes/missing.webp';
  assert.ok(auditAssetRights({root,registry}).failures.some(x=>x.startsWith('missing_registered_asset:')));
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('symbolic links in media directories are refused',()=>{
 const {root,registry}=fixture();
 try{
  symlinkSync(join(root,'public/mira-assets/scenes/example.webp'),join(root,'public/mira-assets/scenes/linked.webp'));
  assert.ok(listTrackedMedia(root).errors.some(x=>x.startsWith('symlink_rejected:')));
  assert.equal(auditAssetRights({root,registry}).ok,false);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('complete pinned media inventory is in repo; no copyrighted material is blindly approved',()=>{
 const reg=JSON.parse(readFileSync('docs/MIRA-ASSET-RIGHTS-INVENTORY.json','utf8'));
 const result=auditAssetRights({root:process.cwd(),registry:reg});
 assert.equal(result.ok,true,JSON.stringify(result.failures));
 assert.equal(result.scanned,reg.assets.length);
 assert.ok(result.unresolved.length>0);
 assert.ok(reg.assets.some(x=>x.path==='public/avatars/splat.ply'));
 assert.equal(reg.groups['vitruvian-lab'].status,'declared_cc0_lab_only');
 assert.equal(reg.groups['vroid-preview'].status,'review_required');
});
