import test from 'node:test';
import assert from 'node:assert/strict';
import {isVerifiedFreeTextModel,rankFreeTextModels,discoverFreeTextModels,recordFreeModelOutcome,FREE_CATALOG_URL,freeRouterSnapshot} from '../lib/free-model-router.js';
import {generateGatewayChat} from '../lib/vercel-ai-gateway.js';
import {providerOrder} from '../lib/brain-gateway.js';

function model(id,price='0',extra={}){return {id,type:'language',modalities:{input:['text'],output:['text']},
  context_window:256000,tags:['reasoning'],pricing:{input:price,output:price},...extra};}
const ling=model('inclusionai/ling-3.1-flash-free');
const laguna=model('poolside/laguna-s-2.1-free');
const tiny=model('inclusionai/ling-3.0-tiny-free');
const env={MIRA_BRAIN_FREE_ONLY:'1',MIRA_BRAIN_AUTO_ROUTER:'1',
  MIRA_BRAIN_GATEWAY_FREE_MODELS:'inclusionai/ling-3.1-flash-free,poolside/laguna-s-2.1-free',
  OPENAI_API_KEY:'synthetic-never-to-be-used',OPENAI_MODEL:'gpt-4.1-mini'};
test('Catalog strictly excludes paid, unrated and non-chat model entries',()=>{
 assert.equal(isVerifiedFreeTextModel(ling),true);
 assert.equal(isVerifiedFreeTextModel(laguna),true);
 assert.equal(isVerifiedFreeTextModel(model('openai/gpt-4.1-mini','0.000001')),false);
 assert.equal(isVerifiedFreeTextModel(model('unknown/unrated-free',null)),false);
 assert.equal(isVerifiedFreeTextModel(model('unknown/tiered-free','0',{
   pricing:{input:'0',output:'0',output_tiers:[{cost:'0.01'}]}})),false);
 assert.equal(isVerifiedFreeTextModel(model('fish-audio/audio-free','0',{
   type:'speech',modalities:{input:['text'],output:['audio']}})),false);
 assert.equal(isVerifiedFreeTextModel(model('evil/paid-model','0')),false);
 assert.equal(isVerifiedFreeTextModel(model('unknown/low-context-free','0',{context_window:1000})),false);
 assert.deepEqual(rankFreeTextModels([tiny,laguna,ling],env.MIRA_BRAIN_GATEWAY_FREE_MODELS),
   [ling.id,laguna.id,tiny.id]);
});
test('Automatic router discovers a NEW free language model and switches across 3 candidates',async()=>{
 let discoveryCount=0;
 const catalogFetcher=async(url,init)=>{
  assert.equal(url,FREE_CATALOG_URL);assert.equal(init.method,'GET');
  assert.equal(init.headers.authorization,undefined);discoveryCount++;
  return new Response(JSON.stringify({data:[ling,laguna,tiny,
    model('openai/gpt-5-mini','0.001'),model('other/ambiguous-free','0.004')]}));
 };
 const called=[];
 const response=await generateGatewayChat('System',[{role:'user',text:'Xin chào'}],
  {runtimeOidcToken:'per-request-token'},
  {env,catalogFetcher,fetcher:async(url,init)=>{
   assert.equal(url,'https://ai-gateway.vercel.sh/v1/chat/completions');
   assert.equal(init.headers.authorization,'Bearer per-request-token');
   const id=JSON.parse(init.body).model;called.push(id);
   if(id!==tiny.id)return new Response('overloaded',{status:503});
   return new Response(JSON.stringify({choices:[{message:{content:'Dạ, em đang nghe anh.'}}]}));
  }});
 assert.deepEqual(called,[ling.id,laguna.id,tiny.id]);
 assert.equal(response.model,tiny.id);
 assert.equal(response.text,'Dạ, em đang nghe anh.');
 assert.equal(discoveryCount,1);
 assert.match(await import('node:fs').then(m=>m.readFileSync('lib/vercel-ai-gateway.js','utf8')),
   /AbortSignal\.timeout\(autoFree \? 15_000 : 24_000\)/);
 assert.equal(freeRouterSnapshot().catalogFresh,true);
});
test('Free rate-limited candidates are cooled down and skipped automatically',async()=>{
 const available=await discoverFreeTextModels({env});
 assert.deepEqual(available,[tiny.id]);
 recordFreeModelOutcome(tiny.id,{ok:false,status:429});
 const blocked=await discoverFreeTextModels({env});
 assert.deepEqual(blocked,[]);
});
test('Per-provider auth errors do not fan out to other models',async()=>{
 // Cooling state cleared by recording an actual successful response for the test fixture.
 for(const id of [ling.id,laguna.id,tiny.id])recordFreeModelOutcome(id,{ok:true});
 let called=0;
 await assert.rejects(generateGatewayChat('System',[{role:'user',text:'Hello'}],
   {runtimeOidcToken:'per-request-token'},{env,fetcher:async()=>{
     called++;return new Response('credential issue',{status:401});
   }}),/gateway_free_models_unavailable/);
 assert.equal(called,1);
});
test('Free-only provider selection never invokes OpenAI even when the key exists',()=>{
 const names=['MIRA_BRAIN_FREE_ONLY','MIRA_BRAIN_PROVIDER','OPENAI_API_KEY','OPENAI_MODEL',
  'MIRA_BRAIN_GATEWAY_FREE_MODELS','AI_GATEWAY_API_KEY'];
 const prev=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 try {
   for(const k of names)delete process.env[k];
   Object.assign(process.env,env,{MIRA_BRAIN_PROVIDER:'openai',AI_GATEWAY_API_KEY:'test-token'});
   assert.deepEqual(providerOrder(),['gateway']);
 }finally{for(const k of names)if(prev[k]===undefined)delete process.env[k];else process.env[k]=prev[k];}
});
