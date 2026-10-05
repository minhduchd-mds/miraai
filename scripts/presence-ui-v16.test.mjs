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
const media = await importTypeScript('src/presence/presence-media.ts');
const visualTest = await importTypeScript('src/presence/presence-visual-test.ts');

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
  assert.equal(presence.PRESENCE_IMAGE.daytime, '/mira-assets/scenes/scene_home_main.webp');
  assert.equal(presence.PRESENCE_IMAGE['welcome-home'], '/mira-assets/scenes/scene_welcome_home.webp');
  assert.equal(presence.PRESENCE_IMAGE['home-evening'], '/mira-assets/scenes/scene_relax_sofa.webp');
  assert.equal(presence.PRESENCE_IMAGE.bedtime, '/mira-assets/scenes/scene_bedtime.webp');
  assert.equal(presence.expressionAssetUrl('gentle'), '/mira-assets/expressions/expr_01_gentle.webp');
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


test('v16.2 avoids speculative scene preload on Save-Data, 2G and hidden tabs', () => {
  assert.equal(media.shouldPrefetchPresenceAsset({ saveData: false, effectiveType: '4g', hidden: false }), true);
  assert.equal(media.shouldPrefetchPresenceAsset({ saveData: true, effectiveType: '4g', hidden: false }), false);
  assert.equal(media.shouldPrefetchPresenceAsset({ saveData: false, effectiveType: '2g', hidden: false }), false);
  assert.equal(media.shouldPrefetchPresenceAsset({ saveData: false, effectiveType: '4g', hidden: true }), false);
});

test('v16.2 loads expression cards only for meaningful reactions', () => {
  assert.equal(media.shouldRenderExpressionReaction({
    expression: 'gentle', state: 'listening', moodConfidence: 0.8, socialCue: 'none',
  }), false);
  assert.equal(media.shouldRenderExpressionReaction({
    expression: 'focus', state: 'thinking', moodConfidence: 0.2, socialCue: 'none',
  }), true);
  assert.equal(media.shouldRenderExpressionReaction({
    expression: 'smile', state: 'speaking', moodConfidence: 0.7, socialCue: 'none',
  }), true);
  assert.equal(media.shouldRenderExpressionReaction({
    expression: 'wink', state: 'idle', moodConfidence: 0.1, socialCue: 'wink_left',
  }), true);
});


test('v16.3 visual scene override is test-only and rejects unknown scenes', () => {
  assert.equal(visualTest.visualTestPresenceScene('?visual-test=1&scene=welcome-home'), 'welcome-home');
  assert.equal(visualTest.visualTestPresenceScene('?scene=welcome-home'), null);
  assert.equal(visualTest.visualTestPresenceScene('?visual-test=1&scene=unknown'), null);
});
