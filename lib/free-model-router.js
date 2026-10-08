// Runtime free-model discovery and per-instance circuit breakers.
// Catalog pricing is checked for every short-lived refresh; NO arbitrary paid model.
export const FREE_CATALOG_URL='https://ai-gateway.vercel.sh/v1/models';
const CATALOG_TTL_MS=90_000;
const MAX_ATTEMPTS=3;
const COOLDOWN_MS=45_000;
const known=new Map();
let cached=null;
let discoveryPromise=null;

function nonnegativeZero(value){
 return (typeof value==='number'||typeof value==='string') &&
   String(value).trim()!=='' && Number(value)===0;
}
/** Require explicit $0 input/output, no alternative chargeable pricing paths. */
export function isVerifiedFreeTextModel(model){
 if(!model || typeof model.id!=='string'||
   !/^[a-z][a-z0-9-]{1,35}\/[a-zA-Z0-9._-]{2,95}-free$/.test(model.id))return false;
 if(model.type!=='language')return false;
 if(!model.modalities?.input?.includes('text')||!model.modalities?.output?.includes('text'))return false;
 if(!Number.isFinite(model.context_window)||model.context_window<8000)return false;
 const p=model.pricing;
 if(!p||typeof p!=='object'||!nonnegativeZero(p.input)||!nonnegativeZero(p.output))return false;
 // If pricing has optional charged modalities/tiers, reject the entry.
 return Object.keys(p).every(k=>k==='input'||k==='output');
}

export function rankFreeTextModels(models, preferred=''){
 const prefer=[...new Set(String(preferred).split(',').map(x=>x.trim()).filter(Boolean))];
 const positions=new Map(prefer.map((id,i)=>[id,i]));
 return [...new Map((Array.isArray(models)?models:[]).filter(isVerifiedFreeTextModel)
   .map(x=>[x.id,x])).values()]
   .sort((a,b)=>{
      const x=positions.has(a.id)?positions.get(a.id):1000;
      const y=positions.has(b.id)?positions.get(b.id):1000;
      if(x!==y)return x-y;
      const ar=Array.isArray(a.tags)&&a.tags.includes('reasoning')?1:0;
      const br=Array.isArray(b.tags)&&b.tags.includes('reasoning')?1:0;
      if(ar!==br)return br-ar;
      return (b.context_window||0)-(a.context_window||0)||a.id.localeCompare(b.id);
   }).map(x=>x.id);
}

async function getCatalog(fetcher){
 const r=await fetcher(FREE_CATALOG_URL,{method:'GET',
  headers:{accept:'application/json'},signal:AbortSignal.timeout(4000)});
 if(!r.ok)throw new Error('free_catalog_http_'+r.status);
 const size=Number(r.headers?.get?.('content-length')||0);
 if(size>4*1024*1024)throw new Error('free_catalog_too_large');
 // The official catalog is public and contains no request/user credentials.
 const data=await r.json();
 if(!Array.isArray(data?.data)||data.data.length>5000)throw new Error('free_catalog_invalid');
 return data.data;
}

/** Return only currently verified zero-priced text chat model IDs. */
export async function discoverFreeTextModels({fetcher=fetch,env=process.env,now=Date.now()}={}){
 if(!cached||now>=cached.until){
   if(!discoveryPromise){
     discoveryPromise=getCatalog(fetcher).then(data=>{
       cached={models:data,until:Date.now()+CATALOG_TTL_MS};
       return data;
     }).finally(()=>{discoveryPromise=null});
   }
   try{await discoveryPromise;}catch{
     // Fail closed. A stale 'free' price must not authorize paid requests.
     throw new Error('free_catalog_unavailable');
   }
 }
 const ranked=rankFreeTextModels(cached.models,env.MIRA_BRAIN_GATEWAY_FREE_MODELS);
 const available=ranked.filter(id=>(known.get(id)||0)<=now);
 // Do not hammer rate-limited models until their cooldown expires.
 return available.slice(0,MAX_ATTEMPTS);
}

export function recordFreeModelOutcome(model,{ok=false,status=0,now=Date.now()}={}){
 if(ok){known.delete(model);return;}
 const cooldown=status===429?75_000:status>=500?COOLDOWN_MS:25_000;
 known.set(model,now+cooldown);
 if(known.size>80){
   for(const [id,until] of known)if(until<=now)known.delete(id);
   if(known.size>80)known.delete(known.keys().next().value);
 }
}

export function freeRouterSnapshot(now=Date.now()){
 return {mode:'catalog-free-only',catalogFresh:Boolean(cached&&cached.until>now),
   available:cached?rankFreeTextModels(cached.models).filter(id=>(known.get(id)||0)<=now).length:0,
   checkedAt:cached?cached.until-CATALOG_TTL_MS:null};
}