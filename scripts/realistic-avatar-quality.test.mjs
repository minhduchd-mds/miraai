import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {readGlbJson,collectAvatarChecks,qualityReport} from './validate-realistic-avatar.mjs';

const source=readFileSync('src/presence/realistic-avatar-source.ts','utf8');
const esm=ts.transpileModule(source,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext
}}).outputText;
const {chooseRealisticAvatar,PREVIEW_ASSET}=await import(
 'data:text/javascript;base64,'+Buffer.from(esm).toString('base64'));

const approved={
 status:'approved',asset:'mira-human-v1.vrm',
 license:'CC0',sourceUrl:'https://example.org/avatar-license',
 visualApproval:'approved',scale:1.2,position:[0,.1,2.5],rotationY:0,
};
const clone=(v)=>JSON.parse(JSON.stringify(v));
test('Real human manifest defaults to pending, never claims realistic assets in repo',()=>{
 const m=JSON.parse(readFileSync('public/avatars/realistic/manifest.json','utf8'));
 assert.equal(m.status,'pending');
 assert.equal(qualityReport(m,null).status,'pending');
 assert.equal(chooseRealisticAvatar(m).mode,'preview');
 assert.ok(PREVIEW_ASSET.path.endsWith('.vrm'));
});
test('Approved manifest allows ONLY local realistic VRM with verified provenance',()=>{
 const r=chooseRealisticAvatar(approved);
 assert.equal(r.mode,'realistic');
 assert.equal(r.path,'avatars/realistic/mira-human-v1.vrm');
 for(const bad of [
  {asset:'../../secret.vrm'},
  {asset:'https://outside.example/avatar.vrm'},
  {asset:'x.glb'},{license:''},{sourceUrl:'http://unsafe'},
  {visualApproval:'pending'},{poseMode:'invalid'},{poseMode:'mixamo-seated'},{scale:99},{position:[0,20,0]},{rotationY:11},
  {status:'pending'}
 ]) {
  const v=clone(approved);Object.assign(v,bad);
  assert.equal(chooseRealisticAvatar(v).mode,'preview',JSON.stringify(bad));
 }
});
function glb(json){
 const data=Buffer.from(JSON.stringify(json));
 const padding=(4-data.length%4)%4;
 const chunk=Buffer.concat([data,Buffer.alloc(padding,32)]);
 const out=Buffer.alloc(20+chunk.length);
 out.write('glTF',0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);
 out.writeUInt32LE(chunk.length,12);out.writeUInt32LE(0x4E4F534A,16);
 chunk.copy(out,20);return out;
}
test('Real avatar pipeline rejects cartoons, low-poly, unrigged or untextured input',()=>{
 const weak={asset:{version:'2.0'},meshes:[{primitives:[{attributes:{POSITION:0}}]}],
 accessors:[{count:1100}],images:[],materials:[],skins:[],nodes:[]};
 const report=qualityReport(approved,glb(weak));
 assert.equal(report.status,'failed');
 assert.ok(report.errors.some(x=>/VRM/i.test(x)));
 assert.ok(report.errors.some(x=>/30K/i.test(x)));
 assert.ok(report.errors.some(x=>/normal/i.test(x)));
});
test('Production loader must avoid recoloring PBR textures of approved human avatar',()=>{
 const loader=readFileSync('src/presence/RoomMiraVRM.tsx','utf8');
 assert.match(loader,/chooseRoomAvatar/);
 assert.match(loader,/allowedStyli|allowPreview/);
 assert.match(loader,/validateRealisticHumanScene\(gltf\.scene\)/);
 assert.match(loader,/realistic-human-not-yet-approved/);
 assert.match(loader,/source\.mode==='preview'\)adaptReferencePalette/);
 assert.match(loader,/VRMLoaderPlugin/);
 assert.match(loader,/avatars\/realistic\/manifest\.json/);
 assert.match(loader,/callback\.current\(\)/);
});

test('Real human GLB requires a validated explicit pose mode and textured PBR layers',()=>{
 const glbManifest={...approved,asset:'real-woman-v2.glb',poseMode:'mixamo-seated'};
 const v=chooseRealisticAvatar(glbManifest);
 assert.equal(v.mode,'realistic');
 assert.equal(v.poseMode,'mixamo-seated');
 assert.equal(v.format,'glb');
 const loader=readFileSync('src/presence/RoomMiraVRM.tsx','utf8');
 const pose=readFileSync('src/presence/rigged-human-pose.ts','utf8');
 assert.match(loader,/poseMixamoHumanSeated\(gltf\.scene\)/);
 assert.match(loader,/validateRealisticHumanScene\(gltf\.scene\)/);
 assert.match(pose,/root\.updateMatrixWorld\(true\)/);
 assert.match(pose,/if\(!leftThigh\|\|!rightThigh\|\|!leftShin\|\|!rightShin\)return false/);
 const bad={...glbManifest,poseMode:'unsafe'};
 assert.equal(chooseRealisticAvatar(bad).mode,'preview');
});
