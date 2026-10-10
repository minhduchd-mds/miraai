import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFileSync} from 'node:fs';
import {trimPreviewOuterwear} from '../src/presence/preview-indoor-outfit.ts';

function fixture(name='F00_008_01_Tops_01_CLOTH'){
 const vertices=new Float32Array(1800*3);
 for(let i=0;i<1800;i++){
  vertices[3*i]=i<800?.1:i<1200?.55:.09;
  vertices[3*i+1]=i<800?1.13:i<1200?1.2:.62;
 }
 const indices=[];
 for(let i=0;i<380;i++)indices.push((i*3)%798,(i*3+1)%798,(i*3+2)%798);
 for(let i=0;i<250;i++)indices.push(800+i%390,801+i%390,802+i%390);
 for(let i=0;i<250;i++)indices.push(1200+i%590,1201+i%590,1202+i%590);
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(vertices,3));
 geometry.setIndex(indices);
 const skin=new THREE.SkinnedMesh(geometry,new THREE.MeshStandardMaterial({name}));
 const root=new THREE.Group();root.add(skin);
 return {root,skin,geometry};
}
test('VRoid baked indoor outfit removes only sleeve and coat-hem geometry, retaining inner top',()=>{
 const {root,skin,geometry}=fixture();
 const original=geometry.getIndex().count;
 assert.equal(trimPreviewOuterwear({scene:root}),1);
 assert.ok(skin.geometry.getIndex().count<original);
 assert.ok(skin.geometry.getIndex().count>=900);
 assert.equal(geometry.getIndex().count,original,'source is not mutated');
 for(let i=0;i<skin.geometry.getIndex().count;i++){
  const vertex=skin.geometry.getIndex().getX(i);
  const p=skin.geometry.getAttribute('position');
  assert.ok(Math.abs(p.getX(vertex))<=.36);
  assert.ok(p.getY(vertex)>=.9);
 }
});
test('indoor trim refuses other outfits and irregular/unrelated geometry',()=>{
 const other=fixture('hero-approved-realistic');
 assert.equal(trimPreviewOuterwear({scene:other.root}),0);
 assert.equal(other.skin.geometry,other.geometry);
 const tiny=fixture();tiny.skin.geometry.setIndex([0,1,2]);
 assert.equal(trimPreviewOuterwear({scene:tiny.root}),0);
});
test('VRM indoor crop is preview-only and reversible via query flag',()=>{
 const loader=readFileSync('src/presence/RoomMiraVRM.tsx','utf8');
 assert.match(loader,/if\(source\.mode==='preview' &&/);
 assert.match(loader,/trimPreviewOuterwear\(vrm\)/);
 assert.match(loader,/get\('outfit'\)!=='original'/);
 assert.doesNotMatch(loader,/if\(source\.mode==='realistic'\)trimPreviewOuterwear/);
});

test('baked body with a material array clips only clothing-group triangles',()=>{
 const {root,skin,geometry}=fixture();
 const original=geometry.getIndex().count;
 skin.material=[
  new THREE.MeshStandardMaterial({name:'F00_000_00_Body_00_SKIN'}),
  new THREE.MeshStandardMaterial({name:'F00_008_01_Tops_01_CLOTH'}),
 ];
 geometry.clearGroups();
 geometry.addGroup(0,90,0);
 geometry.addGroup(90,original-90,1);
 assert.equal(trimPreviewOuterwear({scene:root}),1);
 assert.ok(skin.geometry.getIndex().count<original);
 assert.equal(skin.geometry.groups[0].materialIndex,0);
 assert.equal(skin.geometry.groups[0].count,90);
 assert.equal(skin.geometry.groups[1].materialIndex,1);
 assert.ok(skin.geometry.groups[1].count<original-90);
 assert.equal(geometry.getIndex().count,original);
});
