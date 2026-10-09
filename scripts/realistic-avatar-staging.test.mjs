import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import ts from 'typescript';
import {buildStageManifest,stageRealisticAsset} from './stage-realistic-avatar.mjs';
import {qualityReport} from './validate-realistic-avatar.mjs';
function glb(){
 const doc={asset:{version:'2.0'},extensionsUsed:['VRMC_vrm'],
 meshes:[{primitives:[{attributes:{POSITION:0}}]}],accessors:[{count:41000}],
 skins:[{}],images:[{},{},{}],
 materials:[{pbrMetallicRoughness:{baseColorTexture:{index:0}},normalTexture:{index:0}},
 {pbrMetallicRoughness:{baseColorTexture:{index:1}}},
 {pbrMetallicRoughness:{baseColorTexture:{index:2}}}],nodes:[{name:'Head'}]};
 const raw=Buffer.from(JSON.stringify(doc)),chunk=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4,32)]);
 const b=Buffer.alloc(20+chunk.length);b.write('glTF',0);
 b.writeUInt32LE(2,4);b.writeUInt32LE(b.length,8);b.writeUInt32LE(chunk.length,12);
 b.writeUInt32LE(0x4e4f534a,16);chunk.copy(b,20);return b;
}
const args={file:'/tmp/mira-test.vrm',asset:'mira-human-v1.vrm',
 license:'CC0-1.0',sourceUrl:'https://example.org/model'};
test('staged model remains pending visual approval even after technical QA',()=>{
 const m=buildStageManifest(args);
 assert.equal(qualityReport(m,glb()).status,'review_required');
 assert.equal(m.status,'pending');assert.equal(m.visualApproval,'pending');
});
test('stage command copies only locally validated GLB/VRM and refuses overwrite',()=>{
 const tmp=mkdtempSync(join(tmpdir(),'mira-avatar-'));
 try{
  const root=join(tmp,'project'),folder=join(root,'public','avatars','realistic');
  mkdirSync(folder,{recursive:true});
  writeFileSync(join(folder,'manifest.json'),JSON.stringify({status:'pending'}));
  const src=join(tmp,'source.vrm');writeFileSync(src,glb());
  const out=stageRealisticAsset({...args,file:src},{root});
  assert.equal(out.report.status,'review_required');
  assert.ok(existsSync(join(folder,'mira-human-v1.vrm')));
  assert.equal(JSON.parse(readFileSync(join(folder,'manifest.json'))).status,'pending');
  assert.throws(()=>stageRealisticAsset({...args,file:src},{root}),/already staged/);
 }finally{rmSync(tmp,{recursive:true,force:true});}
});
test('stage rejects non-commercial license and unsafe filenames',()=>{
 for(const wrong of [{license:'CC-BY-NC-4.0'},{sourceUrl:'http://example.org'},
  {asset:'../../bad.vrm'},{asset:'avatar.fbx'},{poseMode:'mixamo-seated'}]){
  assert.throws(()=>buildStageManifest({...args,...wrong}));
 }
});
const s=readFileSync('src/presence/realistic-avatar-source.ts','utf8');
const code=ts.transpileModule(s,{compilerOptions:{target:99,module:99}}).outputText;
const {chooseRoomAvatar}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('pending human can be locally previewed, but never used in public by default',()=>{
 const m=buildStageManifest(args);
 assert.equal(chooseRoomAvatar(m),null);
 assert.equal(chooseRoomAvatar(m,{allowStagedRealisticReview:true}).mode,'realistic');
 const loader=readFileSync('src/presence/RoomMiraVRM.tsx','utf8');
 assert.match(loader,/get\('avatarReview'\)==='1'/);
});