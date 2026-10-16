import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditDependencyLicenses} from './audit-dependency-licenses.mjs';

const entry=(license='MIT')=>({version:'1.0.0',license,integrity:'sha512-test'});
const snapshot=(license='MIT')=>({schemaVersion:1,packages:[
 {name:'example',version:'1.0.0',license,integrity:'sha512-test'}
]});
test('known license metadata and hashes are pinned but are not legal clearance',()=>{
 const r=auditDependencyLicenses({packages:{'node_modules/example':entry()}},snapshot());
 assert.equal(r.ok,true,JSON.stringify(r.failures));
 assert.equal(r.scanned,1);
});
test('new dependencies and changed version or integrity require review',()=>{
 const lock={packages:{'node_modules/example':entry(),
  'node_modules/surprise':entry()}};
 assert.ok(auditDependencyLicenses(lock,snapshot()).failures.some(x=>x.startsWith('new_dependency_requires_rights_review:')));
 const changed={packages:{'node_modules/example':{...entry(),version:'2.0.0'}}};
 assert.ok(auditDependencyLicenses(changed,snapshot()).failures.some(x=>x.startsWith('dependency_license_or_version_changed:')));
});
test('copyleft or missing SPDX metadata is not silently approved',()=>{
 const cases=['GPL-3.0','AGPL-3.0','SSPL-1.0',undefined];
 for(const license of cases){
  const lock={packages:{'node_modules/example':{...entry(),license}}};
  assert.ok(auditDependencyLicenses(lock,snapshot()).failures.some(x=>x.startsWith('manual_license_review_required:')));
 }
});
test('MPL is permitted only for recorded Lightning CSS platform packages',()=>{
 const good={packages:{'node_modules/lightningcss':entry('MPL-2.0')}};
 assert.equal(auditDependencyLicenses(good,{schemaVersion:1,packages:[{
  name:'lightningcss',...entry('MPL-2.0')
 }]}).ok,true);
 const bad={packages:{'node_modules/example':entry('MPL-2.0')}};
 assert.ok(auditDependencyLicenses(bad,snapshot('MPL-2.0')).failures.some(x=>x.startsWith('manual_license_review_required:')));
});
test('entire current lockfile matches rights snapshot exactly',()=>{
 const read=x=>JSON.parse(readFileSync(x,'utf8'));
 const r=auditDependencyLicenses(read('package-lock.json'),read('docs/MIRA-DEPENDENCY-LICENSE-INVENTORY.json'));
 assert.equal(r.ok,true,JSON.stringify(r.failures));
 assert.equal(r.scanned,115);
 assert.equal(r.counts['MPL-2.0'],12);
});
