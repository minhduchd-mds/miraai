import { createHash, createHmac } from 'node:crypto';
import { getSql, ensureAiQuotaSchema } from './db.js';

export const AI_QUOTAS = Object.freeze({
  brain: { maxPerClient: 18, maxGlobal: 500, windowMs: 10 * 60_000 },
  tts: { maxPerClient: 40, maxGlobal: 1200, windowMs: 5 * 60_000 },
  distill: { maxPerClient: 12, maxGlobal: 300, windowMs: 10 * 60_000 },
  capsule: { maxPerClient: 8, maxGlobal: 200, windowMs: 10 * 60_000 },
});
const local = new Map();
const localGlobal = new Map();
const MAX_LOCAL_ENTRIES = 2048;

export function quotaClientKey(req) {
  const headers = req?.headers || {};
  // Vercel overwrites forwarded IP headers; on other hosts do not trust caller-supplied XFF.
  const raw = process.env.VERCEL
    ? (headers['x-vercel-forwarded-for'] || headers['x-forwarded-for'])
    : req?.socket?.remoteAddress;
  const ip = String(raw || 'unknown').split(',')[0].trim().slice(0, 128);
  const secret = String(process.env.MIRA_QUOTA_HMAC_KEY || '');
  return secret ? createHmac('sha256', secret).update(ip).digest('hex')
    : createHash('sha256').update('mira-ai-quota:' + ip).digest('hex');
}

function localSlot(key, limit, isGlobal = false) {
  // Global budgets cannot be evicted by a flood of new per-client identities.
  const store = isGlobal ? localGlobal : local;
  const count = store.get(key) || 0;
  if (count >= limit) return false;
  if (!count && store.size >= MAX_LOCAL_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }
  store.set(key, count + 1);
  return true;
}

async function durableSlot(sql, key, lane, slot, limit) {
  const result = await sql`
    insert into ai_quota_windows (quota_key, lane, window_start, requests)
    values (${key}, ${lane}, ${slot}, 1)
    on conflict (quota_key, lane, window_start)
    do update set requests = ai_quota_windows.requests + 1
    where ai_quota_windows.requests < ${limit}
    returning requests
  `;
  return result.length !== 0;
}

function decline(res, status, reason, retrySeconds = 0) {
  if (retrySeconds) res.setHeader('Retry-After', String(retrySeconds));
  res.status(status).json({ error: reason });
  return false;
}

/** Concurrency-safe cross-instance quota when Neon is configured, weak bounded local fallback otherwise. */
export async function enforceAiQuota(req, res, lane, sql = getSql(), now = Date.now()) {
  const rule = AI_QUOTAS[lane];
  if (!rule) throw new Error('unknown_ai_quota_lane');
  const slot = Math.floor(now / rule.windowMs);
  const retry = Math.max(1, Math.ceil(((slot + 1) * rule.windowMs - now) / 1000));
  const client = quotaClientKey(req);
  if (!sql) {
    if (process.env.MIRA_AI_QUOTA_MODE === 'require-neon') return decline(res, 503, 'quota_store_required');
    res.setHeader('X-Mira-Quota-Mode', 'process-local');
    if (!localSlot(lane + ':' + client + ':' + slot, rule.maxPerClient)) return decline(res, 429, 'rate_limited', retry);
    if (!localSlot(lane + ':global:' + slot, rule.maxGlobal, true)) return decline(res, 429, 'global_rate_limited', retry);
    return true;
  }
  res.setHeader('X-Mira-Quota-Mode', 'neon');
  try {
    await ensureAiQuotaSchema(sql);
    if (!await durableSlot(sql, client, lane, slot, rule.maxPerClient)) return decline(res, 429, 'rate_limited', retry);
    if (!await durableSlot(sql, 'global', lane, slot, rule.maxGlobal)) return decline(res, 429, 'global_rate_limited', retry);
    return true;
  } catch {
    return decline(res, 503, 'quota_store_unavailable');
  }
}
