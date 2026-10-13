import { getSql } from '../lib/db.js';
import { markPrivateResponse } from '../lib/private-response.js';
import { requireTrustedWrite } from '../lib/request-security.js';
import { resolveMemoryScope } from '../lib/memory-scope.js';
import { enforceAiQuota } from '../lib/ai-quota.js';
import { validateProductFeedback } from '../lib/feedback-validation.js';

const RETENTION_DAYS = 90;
const MAX_BODY_CHARS = 6000;
let schemaPromise = null;
function ensureFeedbackSchema(sql) {
  if (!schemaPromise) schemaPromise = sql`create table if not exists mira_product_feedback (
    id bigserial primary key,
    scope_id text not null,
    rating text not null,
    reason text not null,
    note text not null default '',
    shared_context boolean not null default false,
    question text,
    answer text,
    first_audio_ms integer,
    created_at timestamptz not null default now()
  )`.catch(error => {schemaPromise=null;throw error;});
  return schemaPromise;
}

/** Deliberate user feedback only; there is NO automatic chat capture. */
export default async function handler(req,res) {
  markPrivateResponse(res);
  if (!requireTrustedWrite(req,res)) return;
  if (!['GET','POST','DELETE'].includes(req.method)) {
    return res.status(405).json({error:'method_not_allowed'});
  }
  const sql=getSql();
  if (!sql) return res.status(503).json({error:'feedback_store_unavailable'});
  try {
    if (req.method==='POST') {
      const size=Number(req.headers?.['content-length']||0);
      if (size>MAX_BODY_CHARS) return res.status(413).json({error:'payload_too_large'});
    }
    await ensureFeedbackSchema(sql);
    const scope=resolveMemoryScope(req,res);
    if (!scope) return res.status(503).json({error:'feedback_session_unavailable'});
    if (req.method==='GET') {
      const rows=await sql`
        select id, rating, reason, note, shared_context as "sharedContext",
          question, answer, first_audio_ms as "firstAudioMs",
          created_at as "createdAt" from mira_product_feedback
        where scope_id=${scope} and created_at>=now()-interval '90 days'
        order by id desc limit 100`;
      return res.status(200).json({feedback:rows, retentionDays:RETENTION_DAYS});
    }
    if (req.method==='DELETE') {
      await sql`delete from mira_product_feedback where scope_id=${scope}`;
      return res.status(200).json({ok:true});
    }
    const data=typeof req.body==='string' ? (()=>{try{return JSON.parse(req.body);}catch{return null;}})() : req.body;
    if (!data || JSON.stringify(data).length>MAX_BODY_CHARS) {
      return res.status(413).json({error:'invalid_payload'});
    }
    const parsed=validateProductFeedback(data);
    if (!parsed) return res.status(400).json({error:'invalid_or_unconsented_feedback'});
    // Bound feedback writes using the same DB-backed, concurrency-safe limiter
    // used for billable model calls. This is NOT a chat-content collection lane.
    if (!await enforceAiQuota(req,res,'feedback',sql)) return;
    await sql`delete from mira_product_feedback
      where created_at < now() - interval '90 days'`;
    await sql`insert into mira_product_feedback
      (scope_id,rating,reason,note,shared_context,question,answer,first_audio_ms)
      values (${scope},${parsed.rating},${parsed.reason},${parsed.note},
        ${parsed.sharedContext},${parsed.question},${parsed.answer},${parsed.firstAudioMs})`;
    return res.status(201).json({ok:true});
  } catch {
    // Never reflect personally submitted content or database internals.
    return res.status(500).json({error:'internal_error'});
  }
}
