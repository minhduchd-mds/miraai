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

const presence = await importTypeScript('src/presence/presence-scene.ts');

test('v16 presence uses bedtime after 22:00 and before 06:00', () => {
  assert.equal(presence.resolvePresenceScene({ hour: 23 }), 'bedtime');
  assert.equal(presence.resolvePresenceScene({ hour: 3 }), 'bedtime');
});

test('v16 presence recognizes return-home context before clock defaults', () => {
  assert.equal(
    presence.resolvePresenceScene({ hour: 10, presenceCue: 'return' }),
    'welcome-home',
  );
  assert.equal(
    presence.resolvePresenceScene({ hour: 14, interactionState: 'returning' }),
    'welcome-home',
  );
});

test('v16 presence selects evening home context after work hours', () => {
  assert.equal(presence.resolvePresenceScene({ hour: 19 }), 'home-evening');
});

test('v16 manual presence scene wins without persistence', () => {
  assert.equal(
    presence.resolvePresenceScene({ hour: 12, override: 'bedtime' }),
    'bedtime',
  );
});
