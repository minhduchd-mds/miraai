import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const load=async(path)=>{
 const source=readFileSync(path,'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return {source,module:await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))};
};
const gaze=await load('src/presence/character-gaze.ts');
const lips=await load('src/presence/viseme-envelope.ts');
const fields=['aa','ih','ou','ee','oh'];
const silent={aa:0,ih:0,ou:0,ee:0,oh:0};

test('camera-relative gaze is deterministic, quiet, bounded and smooth in all states',()=>{
 const a=gaze.module.createCharacterGaze(),b=gaze.module.createCharacterGaze();
 for(let i=0;i<2400;i++){
   const t=i/30;
   const state=['thinking','listening','speaking','idle','error','interrupted'][Math.floor(i/400)];
   const x=a.sample(t,state),y=b.sample(t,state);
   assert.deepEqual(x,y);
   assert.ok(Number.isFinite(x.x)&&Number.isFinite(x.y));
   assert.ok(Math.abs(x.x)<=.095&&Math.abs(x.y)<=.060);
 }
 a.reset();
 assert.deepEqual(a.sample(0,'thinking'),gaze.module.createCharacterGaze().sample(0,'thinking'));
});

test('gaze settles softly on state change and adverse clock values',()=>{
 const tracker=gaze.module.createCharacterGaze();
 for(let i=0;i<60;i++)tracker.sample(i/60,'listening');
 const from=tracker.sample(1,'listening');
 const to=tracker.sample(1+1/60,'thinking');
 assert.ok(Math.abs(to.x-from.x)<.01);
 assert.ok(Math.abs(to.y-from.y)<.01);
 for(const t of [NaN,Infinity,-Infinity,-1,1e9,0]){
   const value=tracker.sample(t,'speaking');
   assert.ok(Number.isFinite(value.x)&&Number.isFinite(value.y));
 }
});

test('viseme attack/release avoids discontinuous jumps and closes in silence',()=>{
 const env=lips.module.createVisemeEnvelope();
 let current=env.update({...silent,aa:1,ih:.6},1/60);
 assert.ok(current.aa>0&&current.aa<1);
 assert.ok(current.ih>0&&current.ih<.6);
 let previous=current.aa;
 for(let i=0;i<50;i++) {
   current=env.update(silent,1/60);
   assert.ok(current.aa<=previous);
   previous=current.aa;
 }
 assert.ok(current.aa<.001);
 assert.ok(fields.every(k=>current[k]===0||current[k]<.001));
 env.reset();
 assert.deepEqual(env.update(silent,1/60),silent);
});

test('viseme envelope clamps malformed frames and long frame gaps',()=>{
 const env=lips.module.createVisemeEnvelope();
 for(const target of [
   {aa:Infinity,ih:NaN,ou:-20,ee:200,oh:2},
   {aa:1,ih:1,ou:1,ee:1,oh:1}, silent
 ]){
   for(const dt of [-10,NaN,Infinity,100]){
     const v=env.update(target,dt);
     assert.ok(fields.every(k=>Number.isFinite(v[k])&&v[k]>=0&&v[k]<=1));
   }
 }
});

test('VRM gaze and GLB/VRM viseme envelope are wired without new surveillance or third-party assets',()=>{
 const room=readFileSync('src/presence/RoomMiraVRM.tsx','utf8');
 assert.match(room,/createCharacterGaze/);
 assert.match(room,/characterGaze\.current\.sample/);
 assert.match(room,/vrm\.lookAt\.target=gazeTarget\.current/);
 assert.match(room,/camera\.getWorldPosition/);
 assert.match(room,/createVisemeEnvelope/);
 assert.match(room,/visemeEnvelope\.current\.update/);
 assert.match(room,/visemeEnvelope\.current\.reset/);
 assert.match(room,/chooseRoomAvatar\(manifest/);
 for(const path of ['src/presence/character-gaze.ts','src/presence/viseme-envelope.ts']){
   const code=readFileSync(path,'utf8');
   for(const forbidden of ['getUserMedia(', 'localStorage.', 'sessionStorage.', 'fetch(', 'weelife.com']){
     assert.ok(!code.includes(forbidden),path+' '+forbidden);
   }
 }
});
