import { readGatewayJson } from './vercel-ai-gateway.js';

// Model IDs with a Google Gemini Developer API Free Tier (Oct 2026).
// A free-eligible model is NOT proof that the Google API project is unbilled.
export const GEMINI_FREE_CHAT_MODELS = Object.freeze([
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.5-flash-lite',
]);
const keyNames=['GEMINI_API_KEY','GOOGLE_API_KEY','GOOGLE_GENERATIVE_AI_API_KEY','GEMINI_KEY'];
const cooldowns=new Map();
const COOLDOWN_MS=30_000;

export function geminiKeyConfigured(env=process.env){
  return keyNames.some(name=>typeof env[name]==='string'&&env[name].trim().length>0);
}

export function geminiChatModels(env=process.env,now=Date.now()){
  const raw=String(env.GEMINI_MODEL||'').trim();
  // Unknown model names are never allowed in free-only mode, even if provided as env.
  const preferred=raw&&GEMINI_FREE_CHAT_MODELS.includes(raw)?[raw]:[];
  return [...new Set([...preferred,...GEMINI_FREE_CHAT_MODELS])]
    .filter(id=>(cooldowns.get(id)||0)<=now);
}

export async function generateGeminiFreeChat(system,messages,
  {maxTokens=500,deadlineAt=0}={},
  {env=process.env,fetcher=fetch,now=Date.now}={}){
  const key=keyNames.map(name=>env[name]).find(v=>typeof v==='string'&&v.trim());
  if(!key)return null;
  const models=geminiChatModels(env,now());
  const contents=(Array.isArray(messages)?messages:[]).slice(-40).filter(m=>m?.text)
    .map(m=>({role:['model','assistant','mira'].includes(m.role)?'model':'user',
      parts:[{text:String(m.text).slice(0,6000)}]}));
  if(!contents.length)throw new Error('gemini_messages_required');
  for(const model of models){
    const remaining=deadlineAt?deadlineAt-now()-250:12_000;
    if(remaining<700)break;
    try{
      const generationConfig={temperature:0.65,
        maxOutputTokens:Math.max(900,Math.min(2500,Math.trunc(maxTokens)||500)),
        thinkingConfig:{thinkingLevel:'low'}};
      const body={contents,generationConfig,
        ...(system?{systemInstruction:{parts:[{text:String(system).slice(0,12000)}]}}:{})};
      const response=await fetcher(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
          method:'POST',
          headers:{'content-type':'application/json','x-goog-api-key':key},
          body:JSON.stringify(body),
          signal:AbortSignal.timeout(Math.max(600,Math.min(12_000,remaining))),
        });
      if(!response.ok){
        await response.body?.cancel?.().catch(()=>{});
        if(response.status===401||response.status===403){
          // Invalid credential or forbidden project is shared across models.
          throw new Error('gemini_auth_unavailable');
        }
        cooldowns.set(model,now()+COOLDOWN_MS);
        continue;
      }
      const json=await readGatewayJson(response);
      const text=(json?.candidates?.[0]?.content?.parts||[])
        .filter(p=>p && p.thought!==true && typeof p.text==='string')
        .map(p=>p.text).join('').trim();
      if(!text){cooldowns.set(model,now()+COOLDOWN_MS);continue;}
      cooldowns.delete(model);
      return {text,provider:'gemini',model};
    }catch(error){
      if(String(error?.message||'')==='gemini_auth_unavailable')throw error;
      cooldowns.set(model,now()+COOLDOWN_MS);
    }
  }
  throw new Error('gemini_free_models_unavailable');
}
