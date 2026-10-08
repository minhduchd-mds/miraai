import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

async function load(path){
 const src=readFileSync(path,'utf8');
 const output=ts.transpileModule(src,{fileName:path,compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext
 }}).outputText;
 return import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
}
const failure=await load('src/core/brain/brain-failure.ts');
const voices=await load('src/core/voice-prefs.ts');
test('model failure classification distinguishes API, quota, model error, timeout and deployment',()=>{
 assert.equal(failure.classifyBrainFailure(429,'rate_limited'),'quota');
 assert.equal(failure.classifyBrainFailure(503,'quota_store_required'),'configuration');
 assert.equal(failure.classifyBrainFailure(404),'deployment');
 assert.equal(failure.classifyBrainFailure(502,'free_models_unavailable'),'provider');
 assert.equal(failure.classifyBrainFailure(0,'',Object.assign(new Error('slow'),{name:'TimeoutError'})),'timeout');
 assert.doesNotMatch(failure.brainFailureMessage('provider'),/kết nối dữ liệu/i);
});
test('browser timeout safely exceeds two sequential free model attempts plus memory',()=>{
 for (const mode of ['short','auto','detailed','deep'])
  assert.ok(voices.responseTimeoutMs(mode)>2*24000+4500,mode);
});
test('Memory retrieval is bounded, optional and runs concurrently',()=>{
 const s=readFileSync('src/intelligence/memory/memory-service.ts','utf8');
 assert.match(s,/boundedRecall\(this\.local\.recall\(query\)\)/);
 assert.match(s,/boundedRecall\(recallMemory\(query\)\)/);
 assert.match(s,/Promise\.all\(/);
 assert.match(s,/timeoutMs = 4000/);
});
test('server and browser preserve a safe, specific error instead of generic silent fallback',()=>{
 const a=readFileSync('api/chat.js','utf8');
 const b=readFileSync('src/core/brain/gemini-brain.ts','utf8');
 const c=readFileSync('src/core/useMira.ts','utf8');
 assert.match(a,/free_models_unavailable/);
 assert.match(b,/classifyBrainFailure\(response\.status, code\)/);
 assert.match(c,/brainFailureMessage\(result\.reply\.failureCode\)/);
});
