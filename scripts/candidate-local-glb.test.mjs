import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=readFileSync('src/presence/candidate-local-glb.ts','utf8');
const output=ts.transpileModule(code,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext
}}).outputText;
const {inspectLocalCandidateGLB}=await import(
 'data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
function makeFile({uri,triangles=2,version='2.0',name='trial.glb'}={}){
 const json={asset:{version},meshes:[{primitives:[{attributes:{POSITION:0},indices:1}]}],
   nodes:[{mesh:0}],accessors:[{count:4},{count:triangles*3}],
   ...(uri?{images:[{uri}]}:{})};
 const body=Buffer.from(JSON.stringify(json));const pad=Buffer.alloc((4-body.length%4)%4,32);
 const b=Buffer.alloc(20+body.length+pad.length);
 b.write('glTF');b.writeUInt32LE(2,4);b.writeUInt32LE(b.length,8);
 b.writeUInt32LE(body.length+pad.length,12);b.write('JSON',16);
 body.copy(b,20);pad.copy(b,20+body.length);
 return {name,size:b.length,slice:(start,end)=>new Blob([b.subarray(start,end)])};
}
test('GLB-only static local models can be inspected without uploading',async()=>{
 const i=await inspectLocalCandidateGLB(makeFile());
 assert.equal(i.meshes,1);assert.equal(i.vertices,4);assert.equal(i.triangles,2);
});
test('external URI, invalid GLB version and path are rejected',async()=>{
 await assert.rejects(inspectLocalCandidateGLB(makeFile({uri:'https://evil.example/log'})),/tài nguyên ngoài/);
 await assert.rejects(inspectLocalCandidateGLB(makeFile({version:'1.0'})),/glTF 2.0/);
 await assert.rejects(inspectLocalCandidateGLB(makeFile({name:'unsafe.gltf'})),/GLB 2.0/);
});
test('oversized GPU triangles are rejected before creating a blob URL',async()=>{
 await assert.rejects(inspectLocalCandidateGLB(makeFile({triangles:650001})),/phức tạp/);
});
test('browser lab is isolated from production approval and never invokes upload',()=>{
 const s=readFileSync('src/presence/PhotorealRoom3D.tsx','utf8');
 const r=readFileSync('src/presence/RoomMiraVRM.tsx','utf8');
 assert.match(s,/inspectLocalCandidateGLB\(file\)/);
 assert.match(s,/URL\.createObjectURL\(file\)/);
 assert.match(s,/URL\.revokeObjectURL/);
 assert.match(s,/candidate\s*\? <CandidateMiraAvatar/);
 assert.match(r,/validateRealisticHumanScene\(gltf\.scene\)/);
 assert.doesNotMatch(s,/fetch\([^)]*localAsset/);
});
