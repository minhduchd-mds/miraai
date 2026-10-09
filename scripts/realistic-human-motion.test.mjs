import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const raw=readFileSync('src/presence/realistic-human-motion.ts','utf8');
const code=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {humanMotionFrame,humanMotionCadence}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));

test('human eyelids blink briefly with natural nonuniform interval',()=>{
  const samples=Array.from({length:2600},(_,i)=>humanMotionFrame(i*.02,'idle').blink);
  assert.ok(samples.some(v=>v>.85));
  assert.ok(samples.filter(v=>v>.50).length<samples.length*.045);
  assert.ok(samples.every(v=>Number.isFinite(v)&&v>=0&&v<=1));
});
test('mouth articulation occurs only while speaking, never in idle/listening/error',()=>{
  for(const t of [.5,1,1.5,6.8,10]){
    assert.ok(humanMotionFrame(t,'speaking').mouthOpen>.09);
    for(const s of ['idle','listening','thinking','error','interrupted'])
      assert.equal(humanMotionFrame(t,s).mouthOpen,0);
  }
});
test('face and head motion remain subtle and finite even on invalid time inputs',()=>{
  for(const t of [NaN,Infinity,-Infinity,-3,0,1e6]){
    const f=humanMotionFrame(t,'speaking');
    assert.ok(Object.values(f).every(Number.isFinite));
    assert.ok(Math.abs(f.headYaw)<=.02&&Math.abs(f.headPitch)<=.013);
    assert.ok(Math.abs(f.breathing)<=.005);
  }
  assert.equal(humanMotionCadence('speaking'),50);
  assert.ok(humanMotionCadence('idle')>humanMotionCadence('speaking'));
});
test('motion scheduling works with one existing rigged human, not a 2D face cutout',()=>{
  const room=readFileSync('src/presence/PhotorealRoom3D.tsx','utf8');
  const loader=readFileSync('src/presence/RoomMiraVRM.tsx','utf8');
  assert.match(room,/state=\{state\}/);
  assert.match(loader,/humanMotionFrame\(/);
  assert.match(loader,/humanMotionCadence\(/);
  assert.match(loader,/document\.hidden/);
  assert.match(loader,/morphTargetInfluences/);
  assert.match(loader,/expressionManager/);
  assert.match(loader,/window\.setInterval/);
  assert.match(loader,/window\.clearInterval/);
  assert.doesNotMatch(loader,/mira_concept_.*\.webp/);
});
