import test from 'node:test';
import assert from 'node:assert/strict';
import { generateGeminiFreeChat, geminiKeyConfigured, geminiChatModels, GEMINI_FREE_CHAT_MODELS } from '../lib/gemini-chat-free.js';
import { providerOrder, generateBrainChat } from '../lib/brain-gateway.js';

const keys=['MIRA_BRAIN_FREE_ONLY','MIRA_BRAIN_PROVIDER','MIRA_BRAIN_FALLBACKS','MIRA_BRAIN_AUTO_ROUTER',
  'MIRA_BRAIN_GATEWAY_FREE_MODELS','OPENAI_API_KEY','OPENAI_MODEL','GEMINI_API_KEY',
  'GOOGLE_API_KEY','GOOGLE_GENERATIVE_AI_API_KEY','GEMINI_KEY','AI_GATEWAY_API_KEY',
  'VERCEL_OIDC_TOKEN','GEMINI_MODEL','ANTHROPIC_API_KEY','ANTHROPIC_MODEL'];
async function scopedEnv(next,fn){
 const before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 for(const k of keys)delete process.env[k];
 Object.assign(process.env,next);
 try{return await fn();}finally{
  for(const k of keys)if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k];
 }
}
const freeGateway='inclusionai/ling-3.1-flash-free,poolside/laguna-s-2.1-free';
test('Gemini Free Tier primary cannot be called before adding a server key',async()=>{
 await scopedEnv({MIRA_BRAIN_FREE_ONLY:'1',MIRA_BRAIN_PROVIDER:'gemini',
  MIRA_BRAIN_GATEWAY_FREE_MODELS:freeGateway,OPENAI_API_KEY:'synthetic',OPENAI_MODEL:'gpt-4.1-mini'},()=>{
  assert.deepEqual(providerOrder({runtimeOidcToken:'vercel-token'}),['gateway']);
  assert.deepEqual(providerOrder(),[]);
  assert.equal(geminiKeyConfigured(),false);
 });
});
test('Configured Gemini runs first, free Gateway second, never OpenAI',async()=>{
 await scopedEnv({MIRA_BRAIN_FREE_ONLY:'1',MIRA_BRAIN_PROVIDER:'gemini',
  MIRA_BRAIN_GATEWAY_FREE_MODELS:freeGateway,GEMINI_API_KEY:'gemini-server-only',
  OPENAI_API_KEY:'synthetic',OPENAI_MODEL:'gpt-4.1-mini'},()=>{
  assert.deepEqual(providerOrder({runtimeOidcToken:'vercel-token'}),['gemini','gateway']);
  assert.deepEqual(providerOrder(),['gemini']);
  assert.equal(geminiKeyConfigured(),true);
 });
});
test('Gemini free tier model allowlist ignores unknown or chargeable model override',()=>{
 assert.deepEqual(GEMINI_FREE_CHAT_MODELS,['gemini-3.8-flash','gemini-3.7-flash','gemini-3.5-flash-lite']);
 assert.deepEqual(geminiChatModels({GEMINI_MODEL:'other-paid-pro-preview'}),GEMINI_FREE_CHAT_MODELS);
});
test('Gemini direct API switches to second model on rate limit and keeps keys server-only',async()=>{
 const models=[];
 const result=await generateGeminiFreeChat('Chỉ trả lời ngắn',[{role:'user',text:'Em nghe thấy không?'}],
  {maxTokens:200,deadlineAt:Date.now()+20_000},{
  env:{GEMINI_API_KEY:'synthetic-private-key'},
  fetcher:async(url,init)=>{
    assert.equal(init.headers['x-goog-api-key'],'synthetic-private-key');
    assert.ok(!url.includes('synthetic-private-key'));
    assert.equal(init.method,'POST');
    const model=url.split('/models/')[1].split(':')[0];
    models.push(model);
    const body=JSON.parse(init.body);
    assert.equal(body.generationConfig.thinkingConfig.thinkingLevel,'low');
    assert.ok(body.generationConfig.maxOutputTokens>=900);
    if(model==='gemini-3.8-flash')return new Response('rate limited',{status:429});
    return new Response(JSON.stringify({candidates:[{content:{parts:[{text:'Em đang nghe anh.'}]}}]}));
  },
 });
 assert.deepEqual(models,['gemini-3.8-flash','gemini-3.7-flash']);
 assert.deepEqual(result,{text:'Em đang nghe anh.',provider:'gemini',model:'gemini-3.7-flash'});
});
test('Gemini authentication failure does not expose a provider error response',async()=>{
 await assert.rejects(generateGeminiFreeChat('',[{role:'user',text:'hi'}],{},
  {env:{GEMINI_API_KEY:'synthetic-private-key'},
   now:()=>Date.now()+120_000,
   fetcher:async()=>new Response('sensitive internal provider text',{status:403})}),
  err=>err.message==='gemini_auth_unavailable'&&!err.message.includes('sensitive'));
});
test('If free Gemini fails, router can safely use the existing free Gateway instead',async()=>{
 await scopedEnv({MIRA_BRAIN_FREE_ONLY:'1',MIRA_BRAIN_PROVIDER:'gemini',
  MIRA_BRAIN_GATEWAY_FREE_MODELS:freeGateway,GEMINI_API_KEY:'synthetic-private-key',
  OPENAI_API_KEY:'synthetic-openai',OPENAI_MODEL:'gpt-4.1-mini'},async()=>{
  const prior=globalThis.fetch;const urls=[];
  try{
    globalThis.fetch=async(url,init)=>{
      urls.push(String(url));
      if(String(url).includes('generativelanguage.googleapis.com'))
        return new Response('key invalid',{status:403});
      if(String(url).includes('ai-gateway.vercel.sh'))
        return new Response(JSON.stringify({choices:[{message:{content:'Gateway dự phòng.'}}]}));
      throw new Error('No paid OpenAI calls allowed');
    };
    const reply=await generateBrainChat('sys',[{role:'user',text:'Hello'}],
      {maxTokens:450,runtimeOidcToken:'short-lived'});
    assert.equal(reply.provider,'gateway');
    assert.equal(reply.text,'Gateway dự phòng.');
    assert.deepEqual(reply.fallbacksTried,['gemini']);
    assert.ok(!urls.some(url=>url.includes('api.openai.com')));
  }finally{globalThis.fetch=prior}
 });
});
