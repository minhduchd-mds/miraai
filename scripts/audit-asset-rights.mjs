import {createHash} from 'node:crypto';
import {existsSync,readFileSync,readdirSync,lstatSync} from 'node:fs';
import {relative,resolve,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const MEDIA=/\.(?:vrm|glb|gltf|ply|fbx|obj|png|webp|jpe?g|gif|avif|svg|ico|woff2?|ttf|otf|mp[34]|ogg|wav|aac|flac|mov|ktx2?|exr|hdr|bin|pdf)$/i;
const slash=p=>p.split(sep).join('/');
export const isTrackedMedia=path=>path.startsWith('assets-source/') || MEDIA.test(path);
export function gitBlobHash(bytes){
 const b=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);
 return createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex');
}
export function listTrackedMedia(root){
 const files=[],errors=[];
 for(const folder of ['assets-source','public','src-tauri/icons']){
  const full=join(root,folder);
  if(!existsSync(full))continue;
  const visit=path=>{
   for(const entry of readdirSync(path,{withFileTypes:true})){
    const absolute=join(path,entry.name), rel=slash(relative(root,absolute));
    if(entry.isSymbolicLink()){errors.push('symlink_rejected:'+rel);continue;}
    if(entry.isDirectory())visit(absolute);
    else if(entry.isFile()&&isTrackedMedia(rel))files.push(rel);
   }
  };
  visit(full);
 }
 return {files:files.sort(),errors};
}
const safePath=v=>typeof v==='string'&&/^(assets-source|public|src-tauri\/icons)\//.test(v)&&
 !v.split('/').some(s=>s==='..'||s==='.'||s==='')&&!v.includes('\\');
export function auditAssetRights({root=process.cwd(),registry}={}){
 const failures=[],unresolved=[],counts={};
 if(!registry||registry.schemaVersion!==1||!registry.groups||!Array.isArray(registry.assets))
  return {ok:false,failures:['invalid_inventory'],unresolved,counts,scanned:0};
 const scan=listTrackedMedia(root);
 failures.push(...scan.errors);
 const known=new Map();
 for(const entry of registry.assets){
  if(!safePath(entry.path)||known.has(entry.path)){
   failures.push('invalid_or_duplicate_path:'+String(entry.path));continue;
  }
  known.set(entry.path,entry);
  const group=registry.groups[entry.group];
  if(!group||!['review_required','declared_cc0_lab_only','verified'].includes(group.status))
   failures.push('invalid_license_group:'+entry.path);
  if(!/^[0-9a-f]{40}$/.test(entry.gitBlobSha||''))
   failures.push('invalid_digest:'+entry.path);
  if(group?.status==='verified'&&(!group.license||group.license==='unknown'||
   typeof group.url!=='string'||!group.url.startsWith('https://')||
   typeof group.approvedBy!=='string'||!group.approvedBy.trim()))
   failures.push('unsubstantiated_approval:'+entry.path);
 }
 const actual=new Set(scan.files);
 for(const path of scan.files){
  const item=known.get(path);
  if(!item){failures.push('unregistered_media:'+path);continue;}
  const filename=join(root,path), info=lstatSync(filename);
  if(!info.isFile()){failures.push('not_a_regular_file:'+path);continue;}
  const bytes=readFileSync(filename);
  if(item.bytes!==bytes.length||item.gitBlobSha!==gitBlobHash(bytes))
   failures.push('changed_without_rights_review:'+path);
  const group=registry.groups[item.group];
  if(group){
   counts[item.group]=(counts[item.group]||0)+1;
   if(group.status!=='verified')unresolved.push({path,status:group.status,group:item.group});
  }
 }
 for(const path of known.keys())if(!actual.has(path))failures.push('missing_registered_asset:'+path);
 return {ok:failures.length===0,failures,unresolved,counts,scanned:scan.files.length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const registry=JSON.parse(readFileSync(resolve('docs/MIRA-ASSET-RIGHTS-INVENTORY.json'),'utf8'));
 const report=auditAssetRights({root:process.cwd(),registry});
 console.log('[Mira IP inventory]',JSON.stringify({
  scanned:report.scanned,tracked:registry.assets.length,unresolved:report.unresolved.length,
  groups:report.counts,failures:report.failures
 }));
 if(report.unresolved.length)console.warn('Asset copyrights NOT yet cleared. Hash snapshots are not licenses.');
 if(!report.ok)process.exitCode=1;
}
