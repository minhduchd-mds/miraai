import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

test('CannedBrain marks every response as fallback, including greetings', async () => {
  const code=ts.transpileModule(readFileSync('src/core/brain/canned-brain.ts','utf8'), {
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
  }).outputText;
  const { CannedBrain }=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  const brain=new CannedBrain();
  assert.equal((await brain.reply('chào')).runtimeSource, 'fallback');
  const unknown=await brain.reply('Kiểm tra model AI');
  assert.equal(unknown.runtimeSource, 'fallback');
  assert.match(unknown.text,/chế độ phản hồi cơ bản/);
});

test('real model adapters declare model provenance on successful inference', () => {
  const server=readFileSync('src/core/brain/gemini-brain.ts','utf8');
  const local=readFileSync('src/core/brain/local-webllm-brain.ts','utf8');
  const byok=readFileSync('src/core/brain/llm-brain.ts','utf8');
  assert.match(server,/runtimeSource: 'provider'/);
  assert.match(local,/runtimeSource: 'local_model'/);
  assert.equal(byok.match(/runtimeSource: 'provider'/g)?.length,2);
});

test('Brain connection test does not treat canned fallback as successful model connection', () => {
  const s=readFileSync('src/core/useMira.ts','utf8');
  assert.match(s,/CHƯA KẾT NỐI MODEL/);
  assert.match(s,/result\.runtimeSource === 'fallback'/);
  assert.match(s,/OK MODEL/);
});

test('Fallback messages are not promoted into distilled user memory', () => {
  const s=readFileSync('src/runtime/turn-manager.ts','utf8');
  assert.match(s,/reply\.runtimeSource !== 'fallback'/);
});
