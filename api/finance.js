const DESKTOP_ORIGINS = new Set(['tauri://localhost','http://tauri.localhost','https://tauri.localhost']);
const PUBLIC_ORIGINS = new Set(['https://minhduchd-mds.github.io']);
const buckets = new Map();
const WINDOW_MS = 60_000;
const LIMIT = 30;
const MAX_BUCKETS = 2048;

function requestOrigin(req){ return String(req.headers?.origin || '').trim(); }
function requestHost(req){ return String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').split(',')[0].trim(); }
function originAllowed(req){
  const origin=requestOrigin(req);
  if(!origin || DESKTOP_ORIGINS.has(origin) || PUBLIC_ORIGINS.has(origin)) return true;
  const host=requestHost(req);
  return Boolean(host && origin === `https://${host}`);
}
function applyCors(req,res){
  const origin=requestOrigin(req);
  if(origin && originAllowed(req)) res.setHeader('access-control-allow-origin',origin);
  res.setHeader('access-control-allow-methods','POST,OPTIONS');
  res.setHeader('access-control-allow-headers','content-type');
  res.setHeader('vary','Origin');
}
function clientKey(req){ return String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim().slice(0,96); }
function rateAllowed(req){
  const now=Date.now();
  for(const [key,bucket] of buckets){ if(bucket.resetAt <= now) buckets.delete(key); }
  const key=clientKey(req);
  const current=buckets.get(key);
  if(current && current.resetAt > now){ if(current.count >= LIMIT) return false; current.count += 1; return true; }
  if(buckets.size >= MAX_BUCKETS) buckets.delete(buckets.keys().next().value);
  buckets.set(key,{count:1,resetAt:now+WINDOW_MS});
  return true;
}
function parseBody(req){ if(typeof req.body === 'string'){ try{return JSON.parse(req.body);}catch{return {};}} return req.body && typeof req.body === 'object' ? req.body : {}; }
function code(value){ const v=String(value || '').trim().toUpperCase(); return /^[A-Z]{3}$/.test(v) ? v : ''; }
function symbol(value){ const v=String(value || '').trim().toUpperCase(); return /^[A-Z0-9.\-/:]{1,24}$/.test(v) ? v : ''; }

async function fx(body){
  const base=code(body.base), quote=code(body.quote);
  const amount=Number(body.amount ?? 1);
  if(!base || !quote || !Number.isFinite(amount) || amount < 0 || amount > 1e15) return {status:400,body:{error:'invalid_fx_request'}};
  const response=await fetch(`https://api.frankfurter.dev/v2/rate/${base.toLowerCase()}/${quote.toLowerCase()}`,{signal:AbortSignal.timeout(8000)});
  if(!response.ok) return {status:502,body:{error:'fx_upstream_failed'}};
  const data=await response.json();
  const rate=Number(data?.rate);
  if(!Number.isFinite(rate)) return {status:502,body:{error:'fx_invalid_response'}};
  return {status:200,body:{ok:true,kind:'fx',source:'Frankfurter',sourceUrl:'https://frankfurter.dev/',asOf:String(data?.date || ''),base,quote,rate,amount,converted:amount*rate,frequency:'reference/latest-available'}};
}

async function quote(body){
  const ticker=symbol(body.symbol);
  if(!ticker) return {status:400,body:{error:'invalid_symbol'}};
  const key=String(process.env.TWELVE_DATA_API_KEY || '').trim();
  if(!key) return {status:503,body:{error:'market_provider_not_configured',hint:'Chưa cấu hình nguồn market live. Mira sẽ không đoán giá hiện tại.'}};
  const url=new URL('https://api.twelvedata.com/quote');
  url.searchParams.set('symbol',ticker);
  url.searchParams.set('apikey',key);
  const response=await fetch(url,{signal:AbortSignal.timeout(9000)});
  if(!response.ok) return {status:502,body:{error:'market_upstream_failed'}};
  const data=await response.json();
  if(data?.status === 'error' || data?.code) return {status:502,body:{error:'market_provider_error',hint:String(data?.message || '').slice(0,180)}};
  const price=Number(data?.close ?? data?.price);
  if(!Number.isFinite(price)) return {status:502,body:{error:'market_invalid_response'}};
  const change=Number(data?.change), percentChange=Number(data?.percent_change);
  return {status:200,body:{ok:true,kind:'quote',source:'Twelve Data',sourceUrl:'https://twelvedata.com/',asOf:String(data?.datetime || data?.timestamp || ''),symbol:String(data?.symbol || ticker),price,change:Number.isFinite(change)?change:null,percentChange:Number.isFinite(percentChange)?percentChange:null,currency:data?.currency ? String(data.currency) : null,exchange:data?.exchange ? String(data.exchange) : null}};
}

export default async function handler(req,res){
  applyCors(req,res);
  if(!originAllowed(req)) return res.status(403).json({error:'origin_not_allowed'});
  if(req.method === 'OPTIONS') return res.status(204).end();
  if(req.method !== 'POST') return res.status(405).json({error:'method_not_allowed'});
  if(!rateAllowed(req)) return res.status(429).json({error:'rate_limited'});
  const body=parseBody(req);
  try{
    const result=body.kind === 'fx' ? await fx(body) : body.kind === 'quote' ? await quote(body) : {status:400,body:{error:'unsupported_finance_kind'}};
    return res.status(result.status).json(result.body);
  }catch(error){
    console.error('[Mira Finance]',error);
    return res.status(502).json({error:'finance_gateway_failed'});
  }
}
