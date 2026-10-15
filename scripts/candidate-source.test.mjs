import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const src=readFileSync('src/presence/candidate-avatar-source.ts','utf8');
const output=ts.transpileModule(src,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext
}}).outputText;
const {candidate3DFromSearch}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
test('both lab opt-in and whitelisted candidate name are necessary',()=>{
 assert.equal(candidate3DFromSearch('?candidate3d=sample'),null);
 assert.equal(candidate3DFromSearch('?humanLab=1'),null);
 assert.equal(candidate3DFromSearch('?humanLab=1&candidate3d=https://bad.example/evil.glb'),null);
 assert.equal(candidate3DFromSearch('?humanLab=1&candidate3d=sample').id,'sample');
 assert.equal(candidate3DFromSearch('?humanLab=1&candidate3d=white').id,'white');
});
test('static candidate never bypasses production rig or PBR visual gate',()=>{
 const loader=readFileSync('src/presence/RoomMiraVRM.tsx','utf8');
 const quality=readFileSync('src/presence/realistic-human-quality.ts','utf8');
 const source=readFileSync('src/presence/PhotorealRoom3D.tsx','utf8');
 assert.match(loader,/validateRealisticHumanScene\(gltf\.scene\)/);
 assert.match(loader,/chooseRoomAvatar\(manifest/);
 assert.match(quality,/rig_missing/);
 assert.match(quality,/missing_independent_face_hair_outfit_textures/);
 assert.match(source,/candidate3DFromSearch\(window\.location\.search\)/);
 assert.match(source,/\? <CandidateMiraAvatar candidate=\{candidate\}/);
});
