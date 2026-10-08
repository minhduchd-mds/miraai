import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync } from 'node:fs';

const path='src/app/spatial-two-hand.ts';
const src=readFileSync(path,'utf8');
const js=ts.transpileModule(src,{fileName:path,
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {selectStableBimanualHands:pair}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

test('bimanual selection is stable under left/right frame ordering changes',()=>{
 const left={handedness:'Left',pointerX:0.3,pointerY:0.45,pinching:true,score:0.9};
 const right={handedness:'Right',pointerX:0.7,pointerY:0.45,pinching:true,score:0.92};
 assert.deepEqual(pair([right,left]).map(x=>x.handedness),['Left','Right']);
 assert.deepEqual(pair([left,right]).map(x=>x.handedness),['Left','Right']);
});

test('two hand input rejects near-zero baseline, duplicate hand and weak confidence',()=>{
 const left={handedness:'Left',pointerX:0.3,pointerY:0.4,pinching:true,score:0.9};
 assert.deepEqual(pair([left,{...left,pointerX:0.31,handedness:'Right'}]),[]);
 assert.deepEqual(pair([left,{...left,pointerX:0.7}]),[]);
 assert.deepEqual(pair([left,{handedness:'Right',pointerX:0.75,pointerY:0.4,pinching:true,score:0.25}]),[]);
 assert.deepEqual(pair([left,{handedness:'Right',pointerX:NaN,pointerY:0.4,pinching:true,score:0.9}]),[]);
});

test('disabled settings overlay cannot receive spatial transforms or selection gestures',()=>{
 const runtime=readFileSync('src/app/useVisionSpatialRuntime.ts','utf8');
 assert.match(runtime,/settingsOpen[\s\S]*?: bimanualPairRef\.current\.update\(snapshot\?\.handSeen \? rawHands : \[\], now, handFrameAt\)/);
 assert.match(runtime,/settingsOpen \? null : applySpatialSelectionGesture\(/);
});

test('both web-camera two-hand transform paths require safe initial separation',()=>{
 for(const p of ['src/app/spatial-window-bimanual.ts','src/app/spatial-object-bimanual.ts']){
  const s=readFileSync(p,'utf8');
  assert.match(s,/geometry.distance < 0.08/);
 }
});

test('modal opening cancels spatial drag sessions without resetting on every render',()=>{
 const source=readFileSync('src/app/useVisionSpatialRuntime.ts','utf8');
 assert.match(source,/if \(!settingsOpen\) return;[\s\S]*?spatialGrabSessionRef.current = null;/);
 assert.match(source,/spatialDepthAnchorRef.current.reset\(\)/);
 assert.match(source,/return \(\) => window.clearInterval\(timer\)/);
});
