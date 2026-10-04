import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

async function importTypeScript(path) {
  const source = readFileSync(path, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    fileName: path,
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
}

const policy = await importTypeScript('src/runtime/host-action-policy.ts');
const audit = await importTypeScript('src/runtime/runtime-audit.ts');

const ctx = { id: 'test-host', product: 'Test' };
const action = (risk) => ({
  id: 'demo',
  title: 'Demo',
  description: 'Demo action',
  risk,
  supportsVoice: true,
});

test('read host actions stay backward-compatible without an authorizer', async () => {
  const out = await policy.authorizeHostAction({}, action('read'), 'x', ctx);
  assert.equal(out.allowed, true);
  assert.equal(out.reason, 'read-default');
});

test('write and sensitive host actions fail closed without explicit host authorization', async () => {
  for (const risk of ['write', 'sensitive']) {
    const out = await policy.authorizeHostAction({}, action(risk), 'x', ctx);
    assert.equal(out.allowed, false);
    assert.equal(out.reason, 'explicit-host-approval-required');
  }
});

test('host can explicitly authorize one write invocation', async () => {
  const host = {
    authorizeAction: async () => ({ allowed: true, reason: 'user-approved', approvalId: 'approval-1' }),
  };
  const out = await policy.authorizeHostAction(host, action('write'), 'x', ctx);
  assert.equal(out.allowed, true);
  assert.equal(out.reason, 'user-approved');
  assert.equal(out.approvalId, 'approval-1');
});

test('host authorizer can deny a read action', async () => {
  const host = { authorizeAction: async () => ({ allowed: false, reason: 'policy-deny' }) };
  const out = await policy.authorizeHostAction(host, action('read'), 'x', ctx);
  assert.equal(out.allowed, false);
  assert.equal(out.reason, 'policy-deny');
});

test('authorizer failure fails closed', async () => {
  const host = { authorizeAction: async () => { throw new Error('offline'); } };
  const out = await policy.authorizeHostAction(host, action('read'), 'x', ctx);
  assert.deepEqual(out, { allowed: false, reason: 'host-authorizer-failed' });
});

test('runtime audit trail is bounded and excludes raw input fields', () => {
  const trail = new audit.RuntimeAuditTrail(2);
  trail.record({ kind: 'host', id: 'a', outcome: 'allowed', reason: 'ok' });
  trail.record({ kind: 'host', id: 'b', outcome: 'executed', reason: 'ok' });
  trail.record({ kind: 'skill', id: 'c', outcome: 'blocked', reason: 'policy' });
  const snapshot = trail.snapshot();
  assert.equal(snapshot.length, 2);
  assert.deepEqual(snapshot.map((x) => x.id), ['b', 'c']);
  assert.equal('input' in snapshot[0], false);
});
