import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stabilizePreviewHairPhysics} from '../src/presence/preview-hair-dynamics.ts';

test('preview VRM0 secondary animation is disabled only when a spring manager exists',()=>{
 let updates=0;
 const manager={update:()=>{updates++}};
 assert.equal(stabilizePreviewHairPhysics({springBoneManager:manager}),true);
 manager.update(0.016);
 assert.equal(updates,0);
 assert.equal(stabilizePreviewHairPhysics({springBoneManager:manager}),true,
   'repeat calls should be harmless');
 assert.equal(stabilizePreviewHairPhysics({springBoneManager:undefined}),false);
});

test('only preview models get static hair; realistic rigs retain physics and original mode',()=>{
 const source=readFileSync('src/presence/RoomMiraVRM.tsx','utf8');
 assert.match(source,/import \{stabilizePreviewHairPhysics\} from '\.\/preview-hair-dynamics'/);
 assert.match(source,/if\(source\.mode==='preview' &&\s*new URLSearchParams\(window\.location\.search\)\.get\('hairPhysics'\)!=='original'\)\s*stabilizePreviewHairPhysics\(vrm\)/);
 assert.match(source,/vrm\.update\(Math\.min\(delta,\.06\)\)/);
 assert.match(source,/if\(vrm\.lookAt&&vrm\.lookAt\.target!==camera\)/);
 assert.match(source,/hidePreviewHairTufts\(vrm\)/);
 assert.doesNotMatch(source,/if\(source\.mode==='realistic'\)\s*stabilizePreviewHairPhysics/);
});

test('VRM asset is legacy VRM0 with spring-bone hair (document why this workaround exists)',()=>{
 const buf=readFileSync('public/avatars/female/mira_female_04_soft_rose.vrm');
 const len=buf.readUInt32LE(12);
 const gltf=JSON.parse(buf.toString('utf8',20,20+len));
 const groups=gltf.extensions?.VRM?.secondaryAnimation?.boneGroups;
 assert.ok(Array.isArray(groups)&&groups.length>=4,
  'Preview asset spring-bone layout changed: visually reapprove this workaround');
 assert.ok(groups.some(g=>Array.isArray(g.bones)&&g.bones.length>0));
});
