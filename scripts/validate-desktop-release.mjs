import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const dir = process.argv[2] || 'release';
const validation = JSON.parse(readFileSync(join(dir, 'release-validation.json'), 'utf8'));
assert.equal(validation.format, 'mira.desktop-release-validation');
assert.equal(validation.schemaVersion, 1);
assert.match(process.env.GITHUB_SHA || '', /^[a-f0-9]{40}$/);
assert.equal(validation.commit, process.env.GITHUB_SHA, 'artifact must match the release commit');
assert.equal(validation.platform, 'macos-intel');
assert.equal(validation.artifact, 'Mira-v0.1.0-macOS-Intel.dmg');
assert.equal(validation.signed, true, 'Developer ID validation is required');
assert.equal(validation.notarized, true, 'notarization and Gatekeeper validation are required');
const hash = createHash('sha256').update(readFileSync(join(dir, validation.artifact))).digest('hex');
assert.equal(validation.sha256, hash, 'artifact checksum does not match validation');
assert.equal(readFileSync(join(dir, `${validation.artifact}.sha256`), 'utf8').trim(), `${hash}  ${validation.artifact}`);
console.log(`Desktop release validation passed for ${validation.commit}`);
