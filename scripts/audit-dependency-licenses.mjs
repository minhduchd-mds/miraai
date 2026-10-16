import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const LOW_RISK=new Set(['MIT','Apache-2.0','BSD-3-Clause','ISC']);
const MPL='MPL-2.0';

export function auditDependencyLicenses(lock,registry){
 const failures=[],counts={};
 if(registry?.schemaVersion!==1||!Array.isArray(registry?.packages))
  return {ok:false,failures:['invalid_dependency_inventory'],counts};
 const expected=new Map();
 for(const p of registry.packages){
  if(typeof p?.name!=='string'||expected.has(p.name)){
   failures.push('bad_or_duplicate_snapshot_package:'+String(p?.name));continue;
  }
  expected.set(p.name,p);
 }
 const entries=Object.entries(lock?.packages||{}).filter(([path])=>path.startsWith('node_modules/'));
 const observed=new Set();
 for(const [key,p] of entries){
  const name=key.slice('node_modules/'.length);
  if(observed.has(name))failures.push('duplicate_lock_package:'+name);
  observed.add(name);
  if(!p.license || (!LOW_RISK.has(p.license) &&
      !(p.license===MPL && (name==='lightningcss'||name.startsWith('lightningcss-')))))
   failures.push('manual_license_review_required:'+name+':'+(p.license||'missing'));
  if(typeof p.integrity!=='string'||!p.integrity.startsWith('sha'))
   failures.push('missing_package_integrity:'+name);
  const old=expected.get(name);
  if(!old){failures.push('new_dependency_requires_rights_review:'+name);continue;}
  if(old.version!==p.version||old.license!==p.license||old.integrity!==p.integrity)
   failures.push('dependency_license_or_version_changed:'+name);
  counts[p.license]=(counts[p.license]||0)+1;
 }
 for(const name of expected.keys())if(!observed.has(name))
  failures.push('snapshot_package_missing:'+name);
 return {ok:failures.length===0,failures,counts,scanned:entries.length};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const read=p=>JSON.parse(readFileSync(p,'utf8'));
 const result=auditDependencyLicenses(read('package-lock.json'),read('docs/MIRA-DEPENDENCY-LICENSE-INVENTORY.json'));
 console.log('[Mira dependency rights]',JSON.stringify(result));
 console.warn('npm license metadata and integrities are not substitutes for distributed license texts and NOTICE compliance.');
 if(!result.ok)process.exitCode=1;
}
