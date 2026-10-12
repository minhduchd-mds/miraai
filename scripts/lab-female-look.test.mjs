import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveFemaleLabLook} from '../src/presence/lab-female-look.ts';

test('human-lab wardrobe is a fixed local allowlist, never free-form shader input',()=>{
 assert.deepEqual(['classic','fair-rose','ivory-casual'].map(id=>resolveFemaleLabLook('?look='+id).id),
  ['classic','fair-rose','ivory-casual']);
 for(const query of ['','?look=unknown','?look=%23ffffff','?look=../../other',
  '?look=https://remote.example/item','?look=%3Cscript%3E'])
  assert.equal(resolveFemaleLabLook(query).id,'classic');
});
test('human-lab skin/light palette changes only the staged model and preserves defaults',()=>{
 const original=resolveFemaleLabLook('');
 const fair=resolveFemaleLabLook('?look=fair-rose');
 const casual=resolveFemaleLabLook('?look=ivory-casual');
 assert.equal(original.skin,null);
 assert.equal(original.skinAmbient,0);
 for(const item of [original,fair,casual]){
  assert.match(item.shirt,/^#[0-9a-f]{6}$/);
  assert.match(item.pants,/^#[0-9a-f]{6}$/);
  assert.match(item.shoes,/^#[0-9a-f]{6}$/);
  assert.ok(item.skinAmbient>=0 && item.skinAmbient<=.08);
 }
 assert.notEqual(fair.shirt,casual.shirt);
 assert.match(fair.skin,/^#[0-9a-f]{6}$/);
 const src=readFileSync('src/presence/VitruvianLabAvatar.tsx','utf8');
 assert.match(src,/resolveFemaleLabLook\(window.location.search\)/);
 assert.match(src,/out\.color\.set\(labLook.skin\)/);
 assert.match(src,/out\.color\.set\(labLook.shirt\)/);
 assert.match(src,/out\.color\.set\(labLook.pants\)/);
 assert.match(src,/out\.color\.set\(labLook.shoes\)/);
 assert.match(src,/manifest\.status!=='lab_only'/);
});
