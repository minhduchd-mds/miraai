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

const policy = await importTypeScript('src/runtime/capability-policy.ts');

function skill(overrides = {}) {
  return {
    id: 'demo',
    description: 'demo skill',
    risk: 'local-read',
    requiresNetwork: false,
    supportsVoice: false,
    match: () => 1,
    execute: async () => null,
    ...overrides,
  };
}

function context(overrides = {}) {
  return {
    locale: 'vi-VN',
    host: {},
    ...overrides,
  };
}

test('legacy read-only skills remain allowed when no runtime policy is supplied', () => {
  const out = policy.evaluateSkillCapabilityPolicy(skill(), context());
  assert.equal(out.allowed, true);
  assert.deepEqual(out.required, ['storage.read']);
});

test('write and sensitive skills still require explicit per-skill approval', () => {
  const out = policy.evaluateSkillCapabilityPolicy(
    skill({ risk: 'write', capabilities: ['host.write'] }),
    context(),
  );
  assert.equal(out.allowed, false);
  assert.equal(out.reason, 'skill-approval-required');
});

test('capability allow-list blocks undeclared runtime access', () => {
  const out = policy.evaluateSkillCapabilityPolicy(
    skill({ risk: 'external-read', requiresNetwork: true }),
    context({ capabilityPolicy: { allowedCapabilities: ['storage.read'] } }),
  );
  assert.equal(out.allowed, false);
  assert.equal(out.reason, 'capability-not-allowed');
  assert.deepEqual(out.blocked, ['network.read']);
});

test('runtime policy adds a second approval key for side effects', () => {
  const out = policy.evaluateSkillCapabilityPolicy(
    skill({ risk: 'write', capabilities: ['network.write'], requiresNetwork: true }),
    context({
      approvedSkillIds: ['demo'],
      capabilityPolicy: { allowedCapabilities: ['network.write'] },
    }),
  );
  assert.equal(out.allowed, false);
  assert.equal(out.reason, 'capability-approval-required');
});

test('side effect runs only when both skill and capability are approved', () => {
  const out = policy.evaluateSkillCapabilityPolicy(
    skill({ risk: 'write', capabilities: ['network.write'], requiresNetwork: true }),
    context({
      approvedSkillIds: ['demo'],
      capabilityPolicy: {
        allowedCapabilities: ['network.write'],
        approvedCapabilities: ['network.write'],
      },
    }),
  );
  assert.equal(out.allowed, true);
});

test('network circuit breaker wins over an allow-list', () => {
  const out = policy.evaluateSkillCapabilityPolicy(
    skill({ risk: 'external-read', requiresNetwork: true }),
    context({
      capabilityPolicy: {
        allowedCapabilities: ['network.read'],
        denyNetwork: true,
      },
    }),
  );
  assert.equal(out.allowed, false);
  assert.equal(out.reason, 'network-disabled');
});
