import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('production smoke requires a paid opt-in and sends one synthetic prompt only',()=>{
 const source=readFileSync('scripts/production-brain-smoke.mjs','utf8');
 assert.match(source,/process.argv.includes\('--allow-paid-call'\)/);
 assert.match(source,/if \(!paid\)/);
 assert.equal((source.match(/fetchBounded\('\/api\/chat'/g) || []).length,1);
 assert.match(source,/response.provider !== 'gateway'/);
 assert.doesNotMatch(source,/process.env\.(?:DATABASE_URL|AI_GATEWAY_API_KEY|ELEVENLABS_API_KEY)/);
});
test('CI cannot accidentally trigger paid model traffic on every push',()=>{
 const workflow=readFileSync('.github/workflows/brain-smoke.yml','utf8');
 assert.match(workflow,/workflow_dispatch:/);
 assert.doesNotMatch(workflow,/^\s+push:/m);
 assert.match(workflow,/if: inputs.confirm_paid_request == true/);
});
