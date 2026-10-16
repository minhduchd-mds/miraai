import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const file='src/presence/original-human-face-motion.ts';
const code=readFileSync(file,'utf8');
const js=ts.transpileModule(code,{
 compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
}).outputText;
const {createOriginalFaceController,originalBlinkPulse}=await import(
 'data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const empty={aa:0,ih:0,ou:0,ee:0,oh:0};
const input=(overrides={})=>({seconds:0,dt:1/60,gaze:{x:0,y:0},
 visemes:empty,smile:0,speaking:false,...overrides});
test('original facial controller remains finite, bounded and deterministic through 4k frames',()=>{
 const a=createOriginalFaceController(),b=createOriginalFaceController();
 for(let n=0;n<4000;n++){
  const v=input({seconds:n/30,dt:1/30,speaking:n%55<24,
   gaze:{x:Math.sin(n*.13)*.12,y:Math.sin(n*.17)*.11},
   smile:(n%25)/25,
   visemes:{aa:Math.sin(n*.15),ih:.2,ou:.4,ee:.7,oh:.2}});
  const p=a.sample(v);
  assert.deepEqual(p,b.sample(v));
  assert.ok(Object.values(p).every(Number.isFinite));
  assert.ok(p.closure>=0&&p.closure<=1);
  assert.ok(Math.abs(p.irisX)<=.018&&Math.abs(p.irisY)<=.012);
  assert.ok(p.mouthHeight>=0&&p.mouthHeight<=.095);
  assert.ok(p.mouthWidth>=.04&&p.mouthWidth<=.11);
 }
});
test('8fps idle sampling captures a closed-eyelid pose across complete blink cycles',()=>{
 const blinks=[];
 for(let t=0;t<=45;t+=.125){
  if(originalBlinkPulse(t)>.80)blinks.push(t);
 }
 const cycles=new Set(blinks.map(t=>Math.floor(t/4.16)));
 for(let cycle=1;cycle<=9;cycle++)
  assert.ok(cycles.has(cycle),'Missed blink at idle cadence cycle '+cycle);
});
test('facial rig closes mouth when not speaking and respects weak visemes',()=>{
 const face=createOriginalFaceController();
 for(let i=0;i<20;i++)face.sample(input({seconds:i/60,speaking:true,visemes:{aa:1,ih:0,ou:0,ee:0,oh:.5}}));
 let after=face.sample(input({seconds:1,dt:.12,speaking:false}));
 for(let i=0;i<30;i++)after=face.sample(input({seconds:1+i*.05,dt:.05,speaking:false}));
 assert.ok(after.mouthHeight<.010,'mouth returns to neutral');
 assert.ok(after.mouthWidth>.06);
});
test('invalid times, broken amplitudes and interval spikes never create malformed geometry',()=>{
 const face=createOriginalFaceController();
 for(const time of [NaN,Infinity,-Infinity,-8,1e9,0]){
  const pose=face.sample(input({seconds:time,dt:Infinity,
   gaze:{x:NaN,y:-Infinity},smile:Infinity,
   visemes:{aa:NaN,ih:Infinity,ou:-2,ee:100,oh:0},speaking:true}));
  assert.ok(Object.values(pose).every(Number.isFinite));
 }
 face.reset();
 assert.deepEqual(face.sample(input()),createOriginalFaceController().sample(input()));
});
test('pupil, iris, catchlight all move under one eye group; seated hands reach chair arms',()=>{
 const character=readFileSync('src/presence/OriginalMiraLabAvatar.tsx','utf8');
 const interior=readFileSync('src/presence/RoomLuxuryInterior.tsx','utf8');
 assert.match(character,/createOriginalFaceController/);
 assert.match(character,/eye\.position\.x=facial\.irisX/);
 assert.match(character,/eye\.position\.y=-\.006\+facial\.irisY/);
 assert.match(character,/group ref=\{side<0\?irisLeft:irisRight\}/);
 assert.match(character,/mesh ref=\{side<0\?leftLid:rightLid\}/);
 assert.match(character,/mesh ref=\{side<0\?browLeft:browRight\}/);
 assert.match(character,/mesh position=\{\[side\*\.38,-\.50,-\.05\]\}/);
 assert.match(interior,/at=\{\[side\*\.69,\.61,1\.68\]\} size=\{\[\.13,\.17,\.60\]\}/);
 for(const forbidden of ['getUserMedia(','TextureLoader','GLTFLoader','fetch('])
  assert.ok(!code.includes(forbidden),'unexpected external/private dependency '+forbidden);
});
