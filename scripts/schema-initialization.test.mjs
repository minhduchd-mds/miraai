import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('memory schema cold starts share one pending initialization', async () => {
  // Isolate the module-level memoization across this test.
  const source = readFileSync('lib/db.js', 'utf8').replace(
    "import { neon } from '@neondatabase/serverless';",
    'const neon = () => null;',
  );
  const module = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  let calls = 0;
  let resolveGate;
  const gate = new Promise((resolve) => { resolveGate = resolve; });
  const query = (strings) => {
    calls++;
    if (calls === 1) return gate;
    return Promise.resolve([]);
  };
  const first = module.ensureSchema(query);
  const second = module.ensureSchema(query);
  assert.strictEqual(first, second);
  assert.equal(calls, 1);
  resolveGate([]);
  await Promise.all([first, second]);
  assert.equal(calls, 10);
  await module.ensureSchema(query);
  assert.equal(calls, 10);
});

test('failed schema initialization is retryable', async () => {
  const source = readFileSync('lib/db.js', 'utf8').replace(
    "import { neon } from '@neondatabase/serverless';",
    'const neon = () => null;',
  );
  const module = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64') + '#retry');
  let attempts = 0;
  const sql = () => { attempts++; return attempts === 1
    ? Promise.reject(new Error('temporary outage')) : Promise.resolve([]); };
  await assert.rejects(module.ensureSchema(sql), /temporary outage/);
  await module.ensureSchema(sql);
  assert.ok(attempts > 1);
});
