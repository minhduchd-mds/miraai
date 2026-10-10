import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {hidePreviewHairTufts} from '../src/presence/preview-hair-trim.ts';

const TUFT='F00_000_Hair_00_HAIR_06';
function tuft(side,material=TUFT){
 const positions=[];
 const x=side==='left' ? -.11 : .11;
 for(let i=0;i<18;i++){
  positions.push(x+(i%3-1)*.012,1.455+(i%6)*.024,.08+(i%4)*.01);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geo.setIndex(Array.from({length:18},(_,i)=>i));
 const mesh=new THREE.SkinnedMesh(geo,[
  new THREE.MeshStandardMaterial({name:material}),
  new THREE.MeshStandardMaterial({name:material+' (Outline)'}),
 ]);
 geo.addGroup(0,9,0);geo.addGroup(9,9,1);
 return mesh;
}
function sceneOf(...meshes){
 const scene=new THREE.Group();for(const mesh of meshes)scene.add(mesh);
 return {scene};
}

test('hide only four specific hair_06 crown meshes; retain crown, bangs and geometry',()=>{
 const four=[tuft('left'),tuft('left'),tuft('right'),tuft('right')];
 const bangs=tuft('right','F00_000_Hair_00_HAIR_03');
 const refs=four.map(m=>m.geometry);
 const count=hidePreviewHairTufts(sceneOf(...four,bangs));
 assert.equal(count,4);
 assert.ok(four.every(m=>m.visible===false));
 assert.equal(bangs.visible,true);
 for(let i=0;i<4;i++)assert.equal(four[i].geometry,refs[i]);
});

test('four-tuft hiding is all-or-nothing for unknown rigs',()=>{
 const three=[tuft('left'),tuft('right'),tuft('right')];
 assert.equal(hidePreviewHairTufts(sceneOf(...three)),0);
 assert.ok(three.every(m=>m.visible));
 const unbalanced=[tuft('left'),tuft('right'),tuft('right'),tuft('right')];
 assert.equal(hidePreviewHairTufts(sceneOf(...unbalanced)),0);
 assert.ok(unbalanced.every(m=>m.visible));
 const wrongHeight=[tuft('left'),tuft('left'),tuft('right'),tuft('right')];
 const pos=wrongHeight[0].geometry.getAttribute('position');
 for(let i=0;i<pos.count;i++)pos.setY(i,.9);
 assert.equal(hidePreviewHairTufts(sceneOf(...wrongHeight)),0);
 assert.ok(wrongHeight.every(m=>m.visible));
});

test('VRM preview loader gates hair trim; original hair query bypasses it',()=>{
 const source=readFileSync('src/presence/RoomMiraVRM.tsx','utf8');
 assert.match(source,/import \{hidePreviewHairTufts\} from '\.\/preview-hair-trim'/);
 assert.match(source,/if\(source\.mode==='preview' &&\s*new URLSearchParams\(window\.location\.search\)\.get\('hair'\)!=='original'\)/);
 assert.match(source,/hidePreviewHairTufts\(vrm\)/);
 assert.doesNotMatch(source,/if\(source\.mode==='realistic'\)\s*hidePreviewHairTufts/);
});

test('committed preview VRM contains exactly four isolated HAIR_06 primitives',()=>{
 const buf=readFileSync('public/avatars/female/mira_female_04_soft_rose.vrm');
 assert.equal(buf.toString('ascii',0,4),'glTF');
 const jsonLength=buf.readUInt32LE(12);
 const gltf=JSON.parse(buf.toString('utf8',20,20+jsonLength));
 const hair=gltf.meshes.find(m=>/Hair001/i.test(m.name));
 assert.ok(hair);
 const list=hair.primitives.filter(p=>/F00_000_Hair_00_HAIR_06/i.test(gltf.materials[p.material].name));
 assert.equal(list.length,4,'do not silently trim a different preview asset');
 assert.ok(list.every(p=>gltf.accessors[p.indices].count<1500));
});
