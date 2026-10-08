import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  requestGatewayOidcToken, gatewayCredentials, gatewayIsConfigured, generateGatewayChat,
} from '../lib/vercel-ai-gateway.js';
import { providerOrder, generateBrainChat } from '../lib/brain-gateway.js';

const sample = 'header-only-oidc-test-token';
const req = { headers: { 'x-vercel-oidc-token': sample } };

test('runtime OIDC is per-request and rejected outside Vercel', () => {
  assert.equal(requestGatewayOidcToken(req, {}), '');
  assert.equal(requestGatewayOidcToken(req, { VERCEL: '1' }), sample);
  assert.equal(requestGatewayOidcToken({ headers: {} }, { VERCEL: '1' }), '');
  assert.equal(requestGatewayOidcToken({
    headers: { 'x-vercel-oidc-token': 'x'.repeat(12000) },
  }, { VERCEL: '1' }), '');
  assert.equal(gatewayCredentials({ AI_GATEWAY_API_KEY: 'private-key' }, sample), 'private-key');
  assert.equal(gatewayCredentials({ VERCEL_OIDC_TOKEN: 'env-token' }, sample), sample);
  assert.equal(gatewayIsConfigured({}, sample), true);
});

test('explicit gateway selection sees request OIDC without process.env mutation', () => {
  const keys=['VERCEL_OIDC_TOKEN','AI_GATEWAY_API_KEY','MIRA_BRAIN_PROVIDER',
    'GEMINI_API_KEY','GOOGLE_API_KEY','GOOGLE_GENERATIVE_AI_API_KEY','GEMINI_KEY',
    'OPENAI_API_KEY','OPENAI_MODEL','ANTHROPIC_API_KEY','ANTHROPIC_MODEL'];
  const prior=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  try {
    for(const k of keys)delete process.env[k];
    process.env.MIRA_BRAIN_PROVIDER='gateway';
    assert.deepEqual(providerOrder(),[]);
    assert.deepEqual(providerOrder({ runtimeOidcToken: sample }),['gateway']);
    assert.deepEqual(providerOrder(),[], 'runtime tokens must not leak between requests');
  } finally {
    for(const k of keys) {
      if(prior[k]===undefined)delete process.env[k];else process.env[k]=prior[k];
    }
  }
});

test('Vercel-issued request token reaches upstream only in Authorization header', async () => {
  const response = await generateGatewayChat('system', [{role:'user',text:'Xin chào'}], {
    runtimeOidcToken: sample, maxTokens: 60,
  }, {
    env: {},
    fetcher: async (url, init) => {
      assert.equal(url, 'https://ai-gateway.vercel.sh/v1/chat/completions');
      assert.equal(init.headers.authorization, 'Bearer ' + sample);
      assert.ok(!init.body.includes(sample));
      const payload=JSON.parse(init.body);
      assert.equal(payload.max_tokens,60);
      return new Response(JSON.stringify({ choices:[{ message:{ content:'Em nghe rõ anh.' } }] }));
    },
  });
  assert.equal(response.text,'Em nghe rõ anh.');
  assert.equal(response.provider,'gateway');
});

test('all paid server routes forward OIDC token without persisting it', () => {
  for(const path of ['api/chat.js','api/facts.js','api/identity-capsule.js','api/brain-health.js']){
    const src=readFileSync(path,'utf8');
    assert.match(src,/requestGatewayOidcToken\(req\)/);
    assert.doesNotMatch(src,/setHeader\(['"]x-vercel-oidc-token/);
  }
  const gateway=readFileSync('lib/brain-gateway.js','utf8');
  assert.match(gateway,/runtimeOidcToken/);
  assert.match(gateway,/providerOrder\(\{ runtimeOidcToken \}\)/);
  assert.match(gateway,/maxTokens, runtimeOidcToken/);
});
