import { readGatewayJson } from './vercel-ai-gateway.js';

// Model IDs with a Google Gemini Developer API Free Tier (Oct 2026).
// A free-eligible model is NOT proof that the Google API project is unbilled.
export const GEMINI_FREE_CHAT_MODELS = Object.freeze([
  'gemini-3.8-flash',
  // 3.7 has been redirected by Google to 3.8 since 2026-10-08;
  // attempting both doubles timeout/quota work without changing the model.
  'gemini-3.5-flash-lite',
  // Older generation, still on the free tier; uses thinkingBudget instead of thinkingLevel.
  'gemini-2.5-flash',
]);
const LEGACY_THINKING_MODELS=new Set(['gemini-2.5-flash']);
const keyNames=['GEMINI_API_KEY','GOOGLE_API_KEY','GOOGLE_GENERATIVE_AI_API_KEY','GEMINI_KEY'];
const cooldowns=new Map();
// Models rejected as invalid (400/404/410/422) stay out; transient failures may be half-open probed.
const hardCooldowns=new Set();
// Quota and invalid-model failures should not be hammered during voice turns.
// These are process-local best-effort cooldowns; no user state is stored.
const COOLDOWN_MS=30_000;
const QUOTA_COOLDOWN_MS=90_000;
const INVALID_MODEL_COOLDOWN_MS=5*60_000;
const SLOW_MODEL_COOLDOWN_MS=2*60_000;
/**
 * Bound short spoken turns more aggressively than long-form explanations.
 * The preferred full Flash model is ALWAYS attempted first if healthy.
 * Slow/erroring providers are skipped briefly within the same warm instance;
 * no user state or prompt content enters the circuit breaker.
 * Costs: never start parallel or speculative provider calls.
 */
export function geminiAttemptBudgetMs(maxTokens, model, remaining = 12_000) {
  const budget = Number(maxTokens) || 500;
  const primary = model === 'gemini-3.8-flash';
  // 6s for the primary timed out in production (gemini(timeout) chains, Oct 2026) and the
  // resulting cooldowns left no candidates. Free-tier latency spikes need more headroom;
  // the whole chain stays inside brain-gateway's 48s deadline (browser waits 58s).
  const limit = budget <= 500
    ? (primary ? 12_000 : 10_000)
    : budget <= 1200
      ? (primary ? 14_000 : 12_000)
      : 18_000;
  return Math.max(600, Math.min(limit, Number.isFinite(remaining) ? remaining : limit));
}
function modelCooldownMs(status){
  if(status===429)return QUOTA_COOLDOWN_MS;
  if(status===400||status===404||status===410||status===422)return INVALID_MODEL_COOLDOWN_MS;
  return COOLDOWN_MS;
}

export function geminiKeyConfigured(env=process.env){
  return keyNames.some(name=>typeof env[name]==='string'&&env[name].trim().length>0);
}

export function geminiChatModels(env=process.env,now=Date.now()){
  const raw=String(env.GEMINI_MODEL||'').trim();
  // Unknown model names are never allowed in free-only mode, even if provided as env.
  // Maintain existing GEMINI_MODEL=gemini-3.7-flash installations while
  // avoiding a duplicate request to its 3.8 replacement.
  const canonical=raw==='gemini-3.7-flash'?'gemini-3.8-flash':raw;
  const preferred=canonical&&GEMINI_FREE_CHAT_MODELS.includes(canonical)?[canonical]:[];
  const ordered=[...new Set([...preferred,...GEMINI_FREE_CHAT_MODELS])];
  const ready=ordered.filter(id=>(cooldowns.get(id)||0)<=now);
  if(ready.length)return ready;
  // Half-open: never fail a user turn instantly just because every model had a transient
  // failure moments ago. Probe the model whose cooldown ends first (invalid models excluded).
  const probe=ordered.filter(id=>!hardCooldowns.has(id))
    .sort((a,b)=>(cooldowns.get(a)||0)-(cooldowns.get(b)||0))[0];
  return probe?[probe]:[];
}
function coolDown(model,until,hard=false){
  cooldowns.set(model,until);
  if(hard)hardCooldowns.add(model);else hardCooldowns.delete(model);
}
function clearCooldown(model){cooldowns.delete(model);hardCooldowns.delete(model);}

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
  let failureCode = models.length ? 'request_failed' : 'no_candidates';
  for(const model of models){
    const remaining=deadlineAt?deadlineAt-now()-250:12_000;
    if(remaining<700)break;
    try{
      const generationConfig={temperature:0.65,
        maxOutputTokens:Math.max(900,Math.min(2500,Math.trunc(maxTokens)||500)),
        thinkingConfig:LEGACY_THINKING_MODELS.has(model)?{thinkingBudget:0}:{thinkingLevel:'low'}};
      const body={contents,generationConfig,
        ...(system?{systemInstruction:{parts:[{text:String(system).slice(0,12000)}]}}:{})};
      const response=await fetcher(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
          method:'POST',
          headers:{'content-type':'application/json','x-goog-api-key':key},
          body:JSON.stringify(body),
          signal:AbortSignal.timeout(geminiAttemptBudgetMs(maxTokens,model,remaining)),
        });
      if(!response.ok){
        await response.body?.cancel?.().catch(()=>{});
        if(response.status===401||response.status===403){
          // Invalid credential or forbidden project is shared across models.
          throw new Error('gemini_auth_unavailable_http_' + response.status);
        }
        failureCode = response.status >= 400 && response.status <= 599
          ? 'http_' + response.status : 'request_failed';
        coolDown(model,now()+modelCooldownMs(response.status),
          modelCooldownMs(response.status)===INVALID_MODEL_COOLDOWN_MS);
        continue;
      }
      const json=await readGatewayJson(response);
      const text=(json?.candidates?.[0]?.content?.parts||[])
        .filter(p=>p && p.thought!==true && typeof p.text==='string')
        .map(p=>p.text).join('').trim();
      if(!text){failureCode='empty_response';coolDown(model,now()+COOLDOWN_MS);continue;}
      clearCooldown(model);
      return {text,provider:'gemini',model};
    }catch(error){
      if(/^gemini_auth_unavailable_http_(401|403)$/.test(String(error?.message||''))) throw error;
      failureCode = error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout'
        : error instanceof TypeError ? 'network_failure'
        : error instanceof SyntaxError || /^gateway_response_/.test(String(error?.message||''))
          ? 'invalid_response'
        : /^gemini_http_[45]\d{2}$/.test(String(error?.message||''))
          ? String(error.message).slice('gemini_'.length)
          : failureCode;
      // A timed-out primary should not burn another 6-8 seconds at every
      // subsequent turn on a warm instance. Re-probe after a bounded cooldown.
      coolDown(model,now()+(failureCode==='timeout'
        ? SLOW_MODEL_COOLDOWN_MS : COOLDOWN_MS));
    }
  }
  throw new Error('gemini_free_models_unavailable_' + failureCode);
}
