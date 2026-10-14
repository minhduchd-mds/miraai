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

test('synthetic companion live QA never runs on an ordinary CI push or leaks reply text',()=>{
 const file=readFileSync('scripts/live-companion-benchmark.mjs','utf8');
 const workflow=readFileSync('.github/workflows/companion-live-benchmark.yml','utf8');
 assert.match(file,/process\.argv\.includes\('--allow-paid-call'\)/);
 assert.match(file,/process\.argv\.includes\('--allow-voice-call'\)/);
 assert.match(file,/no_user_data/);
 assert.match(file,/scope: 'direct_gateway_with_synthetic_history_not_browser_memory'/);
 assert.doesNotMatch(file,/console\.(?:log|error)\([^\n]*result\.text/);
 assert.doesNotMatch(file,/process\.env\.(?:ELEVENLABS_API_KEY|DATABASE_URL|OPENAI_API_KEY)/);
 assert.match(workflow,/workflow_dispatch:/);
 assert.match(workflow,/github\.event\.head_commit\.message == 'test\(companion\): allow 60s runtime for bounded free-provider fallback'/);
 assert.match(workflow,/inputs\.confirm_paid_request == true/);
});

test('Vercel Brain function duration covers the bounded free-provider chain',()=>{
 const config=JSON.parse(readFileSync('vercel.json','utf8'));
 assert.equal(config.functions['api/chat.js'].maxDuration,60);
 const router=readFileSync('lib/brain-gateway.js','utf8');
 assert.match(router,/48_000/);
 assert.doesNotMatch(JSON.stringify(config),/env|token|key|secret|rewrites/i);
});
