import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync('src/presence/character-director.ts','utf8');
const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createCharacterDirector} = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));

const keys = ['headYaw','headPitch','headRoll','chestRoll','leftArmX','leftArmZ','rightArmX','rightArmZ'];
const states = ['idle','listening','thinking','speaking','interrupted','error'];

test('director produces bounded, finite, reproducible procedural micro-movements',()=>{
  const a=createCharacterDirector(), b=createCharacterDirector();
  for(let n=0;n<2000;n++) {
    const t=n/30, state=states[Math.floor(n/225)%states.length];
    const out=a.sample(t,state,0.4), copy=b.sample(t,state,0.4);
    assert.deepEqual(out,copy);
    assert.deepEqual(Object.keys(out).sort(),[...keys].sort());
    for(const [name,value] of Object.entries(out)){
      assert.ok(Number.isFinite(value),name);
      assert.ok(Math.abs(value)<0.07, `${name}: ${value}`);
    }
  }
});

test('state changes blend smoothly, unknown time and energy cannot break motion',()=>{
  const director=createCharacterDirector();
  for(let n=0;n<60;n++) director.sample(n/60,'idle');
  const before=director.sample(1,'idle');
  const after=director.sample(1+1/60,'speaking',1);
  for(const key of keys) assert.ok(Math.abs(after[key]-before[key])<0.025, key);
  for(const time of [NaN,Infinity,-Infinity,-1,0,1e8]) {
    const cues=director.sample(time,'speaking',NaN);
    assert.ok(Object.values(cues).every(Number.isFinite));
  }
  director.reset();
  const restart=director.sample(0,'speaking',0.4);
  assert.deepEqual(restart,createCharacterDirector().sample(0,'speaking',0.4));
});

test('idle and failed voice do not invent independent tracking or permissions',()=>{
  const dir=createCharacterDirector();
  assert.ok(Object.values(dir.sample(0,'idle')).every(v=>v===0));
  for(const forbidden of ['getUserMedia','fetch(', 'localStorage','Weelife']) {
    assert.ok(!source.includes(forbidden), forbidden);
  }
});

test('room uses the director for VRM and GLB without changing approval or camera policy',()=>{
  const room=readFileSync('src/presence/RoomMiraVRM.tsx','utf8');
  assert.match(room,/createCharacterDirector/);
  assert.match(room,/characterDirector\.current\.sample/);
  assert.match(room,/applyArmMotion/);
  assert.match(room,/chooseRoomAvatar\(manifest/);
  assert.match(room,/validateRealisticHumanScene/);
  assert.doesNotMatch(room,/getUserMedia\(|startFaceTracking\(/);
});
