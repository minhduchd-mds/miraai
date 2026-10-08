import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  gatewayIsConfigured, gatewayModel, gatewayCredentials, generateGatewayChat, readGatewayJson,
} from '../lib/vercel-ai-gateway.js';
import { providerOrder } from '../lib/brain-gateway.js';

test('Vercel Brain gateway authenticates with deployment OIDC without a stored user API key', () => {
  const env = { VERCEL_OIDC_TOKEN: 'ephemeral-oidc', MIRA_BRAIN_GATEWAY_MODEL: 'google/gemini-2.5-flash-lite' };
  assert.equal(gatewayIsConfigured(env), true);
  assert.equal(gatewayCredentials(env), 'ephemeral-oidc');
  assert.equal(gatewayModel(env), 'google/gemini-2.5-flash-lite');
  assert.equal(gatewayIsConfigured({ MIRA_BRAIN_GATEWAY_MODEL: env.MIRA_BRAIN_GATEWAY_MODEL }), false);
  assert.equal(gatewayIsConfigured({ VERCEL_OIDC_TOKEN:'temporary', MIRA_BRAIN_GATEWAY_MODEL:'https://evil.test' }), false);
});

test('model request remains server-only and limits context and output', async () => {
  let invoked = 0;
  const env = { AI_GATEWAY_API_KEY:'secret-credential',
    VERCEL_OIDC_TOKEN:'oidc-lower-priority', MIRA_BRAIN_GATEWAY_MODEL:'google/gemini-2.5-flash-lite' };
  const response = await generateGatewayChat('system'.repeat(4000), [
    {role:'user',text:'Chào em'}, {role:'model',text:'Chào anh'},
    {role:'user',text:'Mira đang nghe không?'},
  ], {maxTokens:99999}, {env,fetcher:async(url,init)=>{
    invoked++;
    assert.equal(url,'https://ai-gateway.vercel.sh/v1/chat/completions');
    assert.equal(init.headers.authorization,'Bearer secret-credential');
    assert.ok(!JSON.stringify(init.body).includes('secret-credential'));
    const parsed=JSON.parse(init.body);
    assert.equal(parsed.model,'google/gemini-2.5-flash-lite');
    assert.equal(parsed.messages[0].content.length,12000);
    assert.deepEqual(parsed.messages.slice(1).map(x=>x.role), ['user','assistant','user']);
    assert.equal(parsed.max_tokens,2500);
    return new Response(JSON.stringify({choices:[{message:{content:'Dạ em đang nghe anh.'}}]}));
  }});
  assert.equal(invoked,1);
  assert.equal(response.text,'Dạ em đang nghe anh.');
  assert.equal(response.provider,'gateway');
});

test('gateway rejects oversized provider responses and sanitizes upstream failures', async () => {
  await assert.rejects(readGatewayJson(new Response('x'.repeat(2000)), 100), /gateway_response_too_large/);
  await assert.rejects(generateGatewayChat('',[{role:'user',text:'Hi'}],{},{
    env:{VERCEL_OIDC_TOKEN:'secret'},
    fetcher:async()=>new Response('sensitive provider metadata',{status:402}),
  }),/gateway_http_402/);
});

test('gateway is automatically available only with an explicit server credential', () => {
  const keys=['MIRA_BRAIN_PROVIDER','MIRA_BRAIN_GATEWAY_MODEL','AI_GATEWAY_API_KEY','VERCEL_OIDC_TOKEN',
  'GEMINI_API_KEY','GOOGLE_API_KEY','GOOGLE_GENERATIVE_AI_API_KEY','GEMINI_KEY',
  'OPENAI_API_KEY','OPENAI_MODEL','ANTHROPIC_API_KEY','ANTHROPIC_MODEL'];
  const prev=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  try {
    for(const k of keys)delete process.env[k];
    process.env.MIRA_BRAIN_PROVIDER='gateway';
    process.env.MIRA_BRAIN_GATEWAY_MODEL='google/gemini-2.5-flash-lite';
    assert.deepEqual(providerOrder(),[]);
    process.env.VERCEL_OIDC_TOKEN='runtime-only';
    assert.deepEqual(providerOrder(),['gateway']);
  } finally {
    for(const k of keys) if(prev[k]===undefined)delete process.env[k]; else process.env[k]=prev[k];
  }
});

test('provider routes keep credentials server-side',()=>{
  const source=readFileSync('lib/vercel-ai-gateway.js','utf8');
  assert.doesNotMatch(source,/console\.(log|error)\(/);
  assert.doesNotMatch(source,/https:\/\/[^']+\$\{/);
});
