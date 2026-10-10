import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {dressPreviewForIndoors} from '../src/presence/preview-indoor-wardrobe.ts';

const BODY='F00_000_00_Body_00_SKIN';
const TOP='F00_008_01_Tops_01_CLOTH';
function fixture({eligible=true,withJacket=true}={}){
 const scene=new THREE.Group();
 const bone=new THREE.Bone();
 scene.add(bone);
 const skeleton=new THREE.Skeleton([bone]);
 const geo=new THREE.BufferGeometry();
 const positions=new Float32Array(900*3);
 for(let i=0;i<900;i++){
  positions[i*3]=i%2?.10:-.10;
  positions[i*3+1]=eligible?1.13:.62;
  positions[i*3+2]=i%3?.02:-.02;
 }
 geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const skinIndices=new Uint16Array(900*4),weights=new Float32Array(900*4);
 for(let i=0;i<900;i++)weights[i*4]=1;
 geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndices,4));
 geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
 geo.setIndex(Array.from({length:1800},(_,i)=>i%900));
 geo.addGroup(0,1800,0);
 const body=new THREE.SkinnedMesh(geo,[
  new THREE.MeshStandardMaterial({name:BODY}),
  new THREE.MeshStandardMaterial({name:BODY+' (Outline)'}),
 ]);
 body.bind(skeleton);
 scene.add(body);
 const jacket=new THREE.SkinnedMesh(geo.clone(),[
  new THREE.MeshStandardMaterial({name:withJacket?TOP:'different garment'}),
  new THREE.MeshStandardMaterial({name:TOP+' (Outline)'}),
 ]);
 scene.add(jacket);
 return {scene,body,jacket,geometry:geo};
}

test('rigged preview wardrobe replaces the whole linked jacket with a skinned top',()=>{
 const {scene,body,jacket,geometry}=fixture();
 const originalMaterials=body.material;
 assert.equal(dressPreviewForIndoors({scene}),true);
 assert.equal(jacket.visible,false);
 assert.equal(body.geometry,geometry,'skin geometry is never damaged');
 assert.equal(body.material,originalMaterials,'skin materials remain untouched');
 const tops=scene.children.filter(x=>x.name==='Mira_indoor_rigged_crop_top');
 assert.equal(tops.length,1);
 const shirt=tops[0];
 assert.ok(shirt instanceof THREE.SkinnedMesh);
 assert.equal(shirt.skeleton,body.skeleton,'indoor shirt must animate with original humanoid');
 assert.equal(shirt.geometry.getIndex().count,1800);
 assert.equal(shirt.material.name,'Mira_indoor_fitted_top');
});

test('wardrobe refuses unexpected or undressable previews without hiding clothes',()=>{
 for(const opts of [{eligible:false},{withJacket:false}]){
  const {scene,jacket}=fixture(opts);
  assert.equal(dressPreviewForIndoors({scene}),false);
  assert.equal(jacket.visible,true);
  assert.ok(!scene.getObjectByName('Mira_indoor_rigged_crop_top'));
 }
});

test('loader only dresses explicit preview and allows original or legacy outfit',()=>{
 const code=readFileSync('src/presence/RoomMiraVRM.tsx','utf8');
 assert.match(code,/if\(source\.mode==='preview'\)\{/);
 assert.match(code,/outfit==='legacy'/);
 assert.match(code,/outfit!=='original' && !dressPreviewForIndoors\(vrm\)/);
 assert.match(code,/trimPreviewOuterwear\(vrm\)/);
 assert.doesNotMatch(code,/if\(source\.mode==='realistic'\)\s*dressPreviewForIndoors/);
});

test('documented VRoid model has separate SKIN and connected TOPS groups',()=>{
 const buffer=readFileSync('public/avatars/female/mira_female_04_soft_rose.vrm');
 assert.equal(buffer.toString('ascii',0,4),'glTF');
 const n=buffer.readUInt32LE(12);
 const obj=JSON.parse(buffer.toString('utf8',20,20+n));
 const body=obj.meshes.find(x=>x.name==='Body.baked');
 assert.ok(body);
 assert.ok(body.primitives.some(p=>obj.materials[p.material].name===BODY));
 assert.ok(body.primitives.some(p=>obj.materials[p.material].name===TOP));
});
