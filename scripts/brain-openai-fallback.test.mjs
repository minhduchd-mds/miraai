import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateBrainChat, providerOrder } from '../lib/brain-gateway.js';

const keys = ['MIRA_BRAIN_PROVIDER','MIRA_BRAIN_FALLBACKS','OPENAI_API_KEY',
  'OPENAI_MODEL','GEMINI_API_KEY','GOOGLE_API_KEY','GOOGLE_GENERATIVE_AI_API_KEY','GEMINI_KEY',
  'ANTHROPIC_API_KEY','ANTHROPIC_MODEL','AI_GATEWAY_API_KEY','VERCEL_OIDC_TOKEN'];
async function withEnv(env, fn) {
 const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 for(const k of keys)delete process.env[k];
 Object.assign(process.env,env);
 try{return await fn()}finally{
   for(const k of keys)if(previous[k]===undefined)delete process.env[k];
   else process.env[k]=previous[k];
 }
}

test('Gateway is primary, OpenAI configured explicitly as backup',async()=>{
 await withEnv({MIRA_BRAIN_PROVIDER:'gateway',MIRA_BRAIN_FALLBACKS:'openai',
  OPENAI_API_KEY:'only-on-server',OPENAI_MODEL:'gpt-4.1-mini'},()=>{
   assert.deepEqual(providerOrder({runtimeOidcToken:'ephemeral'}),['gateway','openai']);
   assert.deepEqual(providerOrder(),['openai']);
 });
});
test('OpenAI Responses API fallback is server-only, store:false and uses bounded tokens',async()=>{
 await withEnv({MIRA_BRAIN_PROVIDER:'gateway',MIRA_BRAIN_FALLBACKS:'openai',
  OPENAI_API_KEY:'synthetic-secret-do-not-log',OPENAI_MODEL:'gpt-4.1-mini'},async()=>{
   const previousFetch=globalThis.fetch;
   const calls=[];
   try{
    globalThis.fetch=async(url,opts)=>{
     calls.push(url);
     if(String(url).includes('ai-gateway.vercel.sh')){
       assert.equal(opts.headers.authorization,'Bearer fake-request-oidc');
       return new Response('temporary unavailable',{status:503});
     }
     assert.equal(url,'https://api.openai.com/v1/responses');
     assert.equal(opts.headers.authorization,'Bearer synthetic-secret-do-not-log');
     const payload=JSON.parse(opts.body);
     assert.equal(payload.model,'gpt-4.1-mini');
     assert.equal(payload.store,false);
     assert.ok(!opts.body.includes('synthetic-secret-do-not-log'));
     assert.equal(payload.max_output_tokens,2500);
     assert.equal(payload.input[0].role,'user');
     assert.equal(payload.input[1].role,'assistant');
     return new Response(JSON.stringify({output:[{type:'message',content:[
       {type:'output_text',text:'Dạ, em luôn ở đây cùng anh.'},
     ]}]}));
    };
    const result=await generateBrainChat('System',[{role:'user',text:'Chào em'},
      {role:'model',text:'Chào anh'}],{
      maxTokens:100000,runtimeOidcToken:'fake-request-oidc',
    });
    assert.deepEqual(calls,['https://ai-gateway.vercel.sh/v1/chat/completions',
      'https://api.openai.com/v1/responses']);
    assert.equal(result.provider,'openai');
    assert.deepEqual(result.fallbacksTried,['gateway']);
    assert.equal(result.text,'Dạ, em luôn ở đây cùng anh.');
   }finally{globalThis.fetch=previousFetch}
 });
});
test('OpenAI provider errors are redacted and cannot enter server logs',async()=>{
 await withEnv({MIRA_BRAIN_PROVIDER:'openai',OPENAI_API_KEY:'synthetic-secret-xyz',
  OPENAI_MODEL:'gpt-4.1-mini'},async()=>{
  const previous=globalThis.fetch;
  try{
   globalThis.fetch=async()=>new Response('Private: synthetic-secret-xyz, user biometric data',
    {status:401});
   await assert.rejects(generateBrainChat('hi',[{role:'user',text:'Hi'}]),
     (err)=>/openai\(http_401\)/.test(err.message) &&
       !err.message.includes('synthetic-secret-xyz') &&
       !err.message.includes('biometric'));
  }finally{globalThis.fetch=previous}
 });
 const chat=readFileSync('api/chat.js','utf8');
 assert.doesNotMatch(chat,/console.error\('\[Mira Brain Gateway\]', error\)/);
});
test('Oversized response is rejected and fallback fails with a bounded error',async()=>{
 await withEnv({MIRA_BRAIN_PROVIDER:'openai',OPENAI_API_KEY:'synthetic-secret',
  OPENAI_MODEL:'gpt-4.1-mini'},async()=>{
   const previous=globalThis.fetch;
   try{
     globalThis.fetch=async()=>new Response('x'.repeat(150*1024),{
       headers:{'content-length':String(150*1024)},
     });
     await assert.rejects(generateBrainChat('sys',[{role:'user',text:'hi'}]),
       (error)=>/request_failed/.test(error.message) && error.message.length<180);
   }finally{globalThis.fetch=previous}
 });
});
test('OpenAI rejects malformed model IDs and does not call upstream',async()=>{
 await withEnv({MIRA_BRAIN_PROVIDER:'openai',OPENAI_API_KEY:'synthetic-secret',
  OPENAI_MODEL:'https://evil.example/api'},()=>{
   assert.deepEqual(providerOrder(),[]);
 });
});
