import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('heavy Pages local language model adapter is loaded on demand', () => {
  const source = readFileSync('src/core/brain/index.ts', 'utf8');
  assert.match(source,/import\('\.\/local-webllm-brain'\)/);
  assert.doesNotMatch(source,/import \{ LocalWebLLMBrain \} from/);
  assert.match(source,/name: 'Mira Brain · local Qwen'/);
  assert.match(source,/return \(await engine\)\.reply/);
});
