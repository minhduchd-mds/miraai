import { getSql, ensureFeedbackSchema } from '../lib/db.js';
import { markPrivateResponse } from '../lib/private-response.js';
import { requireTrustedWrite } from '../lib/request-security.js';
import { resolveMemoryScope } from '../lib/memory-scope.js';
const RATINGS=['helpful','unhelpful'];
const REASONS=['accuracy','latency','voice','experience','other'];
const MAX_BODY=5000;
export function validateFeedback(body) {
  if(!body||typeof body!=='object'||Array.isArray(body))return null;
  if(!RATINGS.includes(body.rating)||!REASONS.includes(body.reason))return null;
  if(typeof body.note!=='string'||body.note.length>400)return null;
  if(typeof body.shareExchange!=='boolean')return null;
  if(!body.shareExchange&&(body.userExcerpt!=null||body.assistantExcerpt!=null))return null;
  if(body.shareExchange&&(
    typeof body.userExcerpt!=='string'||typeof body.assistantExcerpt!=='string'||
    !body.userExcerpt.trim()||!body.assistantExcerpt.trim()||
    body.userExcerpt.length>1200||body.assistantExcerpt.length>1200
  ))return null;
  return {rating:body.rating,reason:body.reason,note:body.note.trim(),
    shareExchange:body.shareExchange,
    userExcerpt:body.shareExchange?body.userExcerpt.trim():null,
    assistantExcerpt:body.shareExchange?body.assistantExcerpt.trim():null};
}
function parseBody(req) {
  let body=req.body;
  if(typeof body==='string') {
    if(body.length>MAX_BODY)return null;
    try{body=JSON.parse(body);}catch{return null;}
  }
  return body&&typeof body==='object'&&!Array.isArray(body)?body:null;
}
export default async function handler(req,res) {
  markPrivateResponse(res);
  if (!requireTrustedWrite(req, res)) return;
  if(!['GET','POST','DELETE'].includes(req.method))
    return res.status(405).json({error:'method_not_allowed'});
  if(Number(req.headers?.['content-length']||0)>MAX_BODY)
    return res.status(413).json({error:'payload_too_large'});
  const sql=getSql();
  if(!sql)return res.status(503).json({error:'feedback_storage_unavailable'});
  const device=resolveMemoryScope(req,res);
  if (!device) return res.status(503).json({error:'memory_session_unavailable'});
  try{
    await ensureFeedbackSchema(sql);
    // Opportunistic expiry purge. Deployment must add a scheduled purge for a
    // strict 90-day physical erasure guarantee.
    await sql`delete from mira_feedback where expires_at <= now()`;
    if(req.method==='GET'){
      const rows=await sql`select id,rating,reason,note,shared_exchange,created_at,expires_at
        from mira_feedback where device_id=${device} and expires_at>now()
        order by id desc limit 30`;
      return res.status(200).json({feedback:rows});
    }
    const body=parseBody(req);
    if(!body)return res.status(400).json({error:'invalid_payload'});
    if(req.method==='POST'){
      const entry=validateFeedback(body);
      if(!entry)return res.status(400).json({error:'invalid_feedback'});
      const rows=await sql`select count(*)::int as count from mira_feedback
        where device_id=${device} and created_at > now()-interval '24 hours'`;
      if(Number(rows[0]?.count||0)>=20)return res.status(429).json({error:'daily_feedback_limit'});
      const inserted=await sql`insert into mira_feedback
        (device_id,rating,reason,note,shared_exchange,user_excerpt,assistant_excerpt)
        values (${device},${entry.rating},${entry.reason},${entry.note},
          ${entry.shareExchange},${entry.userExcerpt},${entry.assistantExcerpt})
        returning id`;
      return res.status(201).json({ok:true,id:inserted[0]?.id});
    }
    if(body.all===true){
      await sql`delete from mira_feedback where device_id=${device}`;
      return res.status(200).json({ok:true,all:true});
    }
    const id=Number(body.id);
    if(!Number.isSafeInteger(id)||id<=0)return res.status(400).json({error:'invalid_id'});
    await sql`delete from mira_feedback where device_id=${device} and id=${id}`;
    return res.status(200).json({ok:true});
  }catch{
    return res.status(500).json({error:'internal_error'});
  }
}
