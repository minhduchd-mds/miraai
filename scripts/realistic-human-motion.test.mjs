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

test('approved 3D avatars use measured TTS energy, not a timer when analyser is active',()=>{
 const times=[0,.33,1.4,3.1];
 for(const t of times){
   assert.equal(humanMotionFrame(t,'speaking',0).mouthOpen,0,'real silence must close jaw');
   const quiet=humanMotionFrame(t,'speaking',.15).mouthOpen;
   const normal=humanMotionFrame(t,'speaking',.5).mouthOpen;
   const loud=humanMotionFrame(t,'speaking',1).mouthOpen;
   assert.ok(quiet>0 && normal>quiet && loud>normal);
   assert.ok(loud<=.78);
   assert.equal(humanMotionFrame(t,'idle',1).mouthOpen,0);
   assert.equal(humanMotionFrame(t,'listening',1).mouthOpen,0);
   assert.ok(humanMotionFrame(t,'speaking',undefined).mouthOpen>.09);
   assert.ok(humanMotionFrame(t,'speaking',NaN).mouthOpen>.09);
 }
});

test('3D lip sync reads isolated TTS analyser and does not read microphone level',()=>{
 const audio=readFileSync('src/core/audio-level.ts','utf8');
 const avatar=readFileSync('src/presence/RoomMiraVRM.tsx','utf8');
 const playback=readFileSync('src/core/tts/server-tts.ts','utf8');
 assert.match(audio,/export const ttsLevel = \{ value: 0, active: false \}/);
 assert.match(audio,/ttsLevel\.value = outputLevel/);
 assert.match(audio,/ttsLevel\.active = false/);
 assert.match(playback,/this\.detach = attachAnalyser\(audio\)/);
 assert.match(avatar,/import \{ttsLevel\} from '\.\.\/core\/audio-level'/);
 assert.match(avatar,/state==='speaking' && ttsLevel\.active \? ttsLevel\.value : undefined/);
 assert.match(avatar,/jawBlend\.current\+=\(motion\.mouthOpen-jawBlend\.current\)\*k/);
 assert.match(avatar,/expressions\.setValue\('aa',mouthOpen\)/);
 assert.match(avatar,/weight=mouthOpen/);
 assert.doesNotMatch(avatar,/audioLevel\.value/);
});
