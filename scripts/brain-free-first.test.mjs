import test from 'node:test';
import assert from 'node:assert/strict';
import {gatewayModels, gatewayIsConfigured, generateGatewayChat} from '../lib/vercel-ai-gateway.js';
import {providerOrder, generateBrainChat} from '../lib/brain-gateway.js';

const keys=['MIRA_BRAIN_FREE_ONLY','MIRA_BRAIN_PROVIDER','MIRA_BRAIN_FALLBACKS',
 'MIRA_BRAIN_GATEWAY_FREE_MODELS','MIRA_BRAIN_GATEWAY_MODEL','OPENAI_API_KEY',
 'OPENAI_MODEL','GEMINI_API_KEY','GOOGLE_API_KEY','GOOGLE_GENERATIVE_AI_API_KEY',
 'GEMINI_KEY','ANTHROPIC_API_KEY','ANTHROPIC_MODEL','VERCEL_OIDC_TOKEN','AI_GATEWAY_API_KEY'];
async function withEnvironment(config,run){
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 for(const k of keys)delete process.env[k];
 Object.assign(process.env,config);
 try{return await run();}finally{
  for(const k of keys)if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];
 }
}

const freeModels='inclusionai/ling-3.1-flash-free,poolside/laguna-s-2.1-free';
test('Free-only model selection uses explicit reviewed model allowlist',()=>{
 const env={MIRA_BRAIN_FREE_ONLY:'1',MIRA_BRAIN_GATEWAY_MODEL:'google/gemini-2.5-flash-lite',
  MIRA_BRAIN_GATEWAY_FREE_MODELS:freeModels+',openai/gpt-4.1-mini,stealth/glyph-cluster'};
 assert.deepEqual(gatewayModels(env),['inclusionai/ling-3.1-flash-free','poolside/laguna-s-2.1-free']);
 assert.deepEqual(gatewayModels({MIRA_BRAIN_FREE_ONLY:'1'}),[],'missing allowlist must fail closed');
 assert.equal(gatewayIsConfigured({...env,VERCEL_OIDC_TOKEN:'short-lived'}),true);
 assert.equal(gatewayIsConfigured({MIRA_BRAIN_FREE_ONLY:'1',VERCEL_OIDC_TOKEN:'t'}),false);
});
test('Free-only mode cannot auto-route to paid OpenAI even with all credentials',async()=>{
 await withEnvironment({MIRA_BRAIN_FREE_ONLY:'1',MIRA_BRAIN_PROVIDER:'gateway',
  MIRA_BRAIN_FALLBACKS:'openai,gemini,anthropic',
  MIRA_BRAIN_GATEWAY_FREE_MODELS:freeModels,
  OPENAI_API_KEY:'synthetic',OPENAI_MODEL:'gpt-4.1-mini',
  GEMINI_API_KEY:'synthetic',ANTHROPIC_API_KEY:'synthetic',ANTHROPIC_MODEL:'test'},()=>{
   assert.deepEqual(providerOrder({runtimeOidcToken:'ephemeral'}),['gateway']);
   assert.deepEqual(providerOrder(),[]);
 });
});
test('Free-only model chain skips failing Ling and invokes Laguna, not OpenAI',async()=>{
 await withEnvironment({MIRA_BRAIN_FREE_ONLY:'1',MIRA_BRAIN_PROVIDER:'gateway',
  MIRA_BRAIN_FALLBACKS:'openai',MIRA_BRAIN_GATEWAY_FREE_MODELS:freeModels,
  OPENAI_API_KEY:'synthetic',OPENAI_MODEL:'gpt-4.1-mini'},async()=>{
   const old=globalThis.fetch,called=[];
   try{
    globalThis.fetch=async(url,init)=>{
     assert.equal(url,'https://ai-gateway.vercel.sh/v1/chat/completions');
     const body=JSON.parse(init.body);called.push(body.model);
     assert.equal(init.headers.authorization,'Bearer ephemeral');
     if(body.model==='inclusionai/ling-3.1-flash-free')return new Response('unavailable',{status:503});
     return new Response(JSON.stringify({choices:[{message:{content:'Em đã nghe anh.'}}]}));
    };
    const result=await generateBrainChat('Mira',[{role:'user',text:'Xin chào'}],
      {runtimeOidcToken:'ephemeral',maxTokens:128});
    assert.deepEqual(called,freeModels.split(','));
    assert.equal(result.provider,'gateway');
    assert.equal(result.model,'poolside/laguna-s-2.1-free');
    assert.equal(result.text,'Em đã nghe anh.');
   }finally{globalThis.fetch=old}
 });
});
test('Free-only exhaustion fails closed and never reaches billable fallback',async()=>{
 await withEnvironment({MIRA_BRAIN_FREE_ONLY:'1',MIRA_BRAIN_PROVIDER:'gateway',
  MIRA_BRAIN_FALLBACKS:'openai',MIRA_BRAIN_GATEWAY_FREE_MODELS:freeModels,
  OPENAI_API_KEY:'synthetic',OPENAI_MODEL:'gpt-4.1-mini'},async()=>{
   const old=globalThis.fetch,called=[];
   try{
    globalThis.fetch=async(url,init)=>{
      called.push(JSON.parse(init.body).model);
      return new Response('quota depleted',{status:429});
    };
    await assert.rejects(generateBrainChat('Mira',[{role:'user',text:'hi'}],
      {runtimeOidcToken:'ephemeral'}),
      err=>/gateway\(request_failed\)/.test(err.message)&&!err.message.includes('quota depleted'));
    assert.deepEqual(called,freeModels.split(','));
   }finally{globalThis.fetch=old}
 });
});
test('Normal paid routing is preserved only if free-only flag is absent',async()=>{
 await withEnvironment({MIRA_BRAIN_PROVIDER:'gateway',MIRA_BRAIN_FALLBACKS:'openai',
  OPENAI_API_KEY:'synthetic',OPENAI_MODEL:'gpt-4.1-mini'},()=>{
   assert.deepEqual(providerOrder({runtimeOidcToken:'ephemeral'}),['gateway','openai']);
 });
});
