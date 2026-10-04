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

test('v16.1 bedtime follows minute-level local schedule', () => {
  assert.equal(presence.resolvePresenceScene({ now: new Date(2026, 9, 5, 22, 30) }), 'bedtime');
  assert.equal(presence.resolvePresenceScene({ now: new Date(2026, 9, 6, 5, 59) }), 'bedtime');
  assert.equal(presence.resolvePresenceScene({ now: new Date(2026, 9, 6, 6, 0) }), 'daytime');
});

test('v16.1 workday return scene follows learned expected arrival without a UI tab', () => {
  const expectedReturnMinute = 18 * 60 + 10;
  assert.equal(
    presence.resolvePresenceScene({ now: new Date(2026, 9, 5, 17, 50), expectedReturnMinute }),
    'welcome-home',
  );
  assert.equal(
    presence.resolvePresenceScene({ now: new Date(2026, 9, 5, 20, 0), expectedReturnMinute }),
    'home-evening',
  );
});

test('v16.1 weekend evening does not pretend the user just returned from work', () => {
  assert.equal(
    presence.resolvePresenceScene({ now: new Date(2026, 9, 4, 18, 15) }),
    'home-evening',
  );
});

test('v16.1 a real return event holds welcome-home outside the predicted window', () => {
  const arrivedAt = new Date(2026, 9, 5, 20, 20).getTime();
  assert.equal(
    presence.resolvePresenceScene({ now: new Date(2026, 9, 5, 20, 45), recentReturnAt: arrivedAt }),
    'welcome-home',
  );
  assert.equal(
    presence.resolvePresenceScene({ now: new Date(2026, 9, 5, 22, 5), recentReturnAt: arrivedAt }),
    'home-evening',
  );
});

test('v16.1 learns weekday return time locally and deduplicates one sample per day', () => {
  let samples = [];
  samples = presence.appendPresenceReturnSample(samples, new Date(2026, 9, 5, 18, 20));
  samples = presence.appendPresenceReturnSample(samples, new Date(2026, 9, 5, 18, 35));
  samples = presence.appendPresenceReturnSample(samples, new Date(2026, 9, 6, 18, 10));
  samples = presence.appendPresenceReturnSample(samples, new Date(2026, 9, 7, 18, 30));
  assert.equal(samples.length, 3);
  assert.equal(presence.learnedPresenceReturnMinute(samples), 18 * 60 + 30);
});

test('v16.1 maps presence and expression assets without bundling image bytes', () => {
  assert.equal(presence.PRESENCE_IMAGE.daytime, '/mira-assets/scenes/scene_home_main.png');
  assert.equal(presence.PRESENCE_IMAGE['welcome-home'], '/mira-assets/scenes/scene_welcome_home.png');
  assert.equal(presence.PRESENCE_IMAGE['home-evening'], '/mira-assets/scenes/scene_relax_sofa.png');
  assert.equal(presence.PRESENCE_IMAGE.bedtime, '/mira-assets/scenes/scene_bedtime.png');
  assert.equal(presence.expressionAssetUrl('gentle'), '/mira-assets/expressions/expr_01_gentle.png');
  assert.equal(presence.resolvePresenceExpression({ state: 'listening' }), 'gentle');
  assert.equal(presence.resolvePresenceExpression({ state: 'thinking' }), 'focus');
  assert.equal(presence.resolvePresenceExpression({ state: 'speaking', mood: 'happy' }), 'smile');
  assert.equal(presence.resolvePresenceExpression({ scene: 'bedtime' }), 'calm');
});

test('v16.1 ignores weekend and implausible return samples', () => {
  let samples = [];
  samples = presence.appendPresenceReturnSample(samples, new Date(2026, 9, 4, 18, 0));
  samples = presence.appendPresenceReturnSample(samples, new Date(2026, 9, 5, 12, 0));
  assert.equal(samples.length, 0);
});
