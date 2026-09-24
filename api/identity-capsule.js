import { createHash } from 'node:crypto';
import { getSql, ensureSchema } from '../lib/db.js';
import { resolveMemoryScope } from '../lib/memory-scope.js';
import { generateBrainJson } from '../lib/brain-gateway.js';

const FORMAT = 'mira.identity-capsule';
const SCHEMA_VERSION = 1;
const MAX_MESSAGES = 500;
const MAX_FACTS = 200;

const CONTINUITY_PROMPT = `Bạn tạo bản tóm tắt continuity cho Mira từ dữ liệu người dùng đã chủ động lưu.
Không suy diễn ý thức, cảm xúc bí mật hay sự kiện không có trong dữ liệu.
Tóm tắt ngắn gọn, hữu ích khi khởi tạo lại Mira trên thiết bị/model khác.
Trả JSON:
{
  "summary": "2-6 câu",
  "interactionContext": "1-3 câu về cách người dùng muốn tương tác",
  "priorities": ["tối đa 8 ưu tiên hoặc mục tiêu bền vững"]
}`;

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  return body && typeof body === 'object' ? body : {};
}

function shortString(value, max = 500) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeDate(value) {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function sanitizePreferences(input) {
  const value = input && typeof input === 'object' ? input : {};
  const voice = value.voice && typeof value.voice === 'object' ? value.voice : {};
  const avatar = value.avatar && typeof value.avatar === 'object' ? value.avatar : {};
  const responseLength = ['short', 'auto', 'detailed', 'deep'].includes(voice.responseLength)
    ? voice.responseLength
    : 'auto';
  const theme = ['nova', 'aura', 'ember', 'iris'].includes(value.theme) ? value.theme : 'nova';
  return {
    voice: {
      rate: typeof voice.rate === 'number' && voice.rate >= 0.5 && voice.rate <= 2 ? voice.rate : 1,
      persona: shortString(voice.persona, 40) || 'friendly',
      responseLength,
      voiceURI: shortString(voice.voiceURI, 300),
    },
    theme,
    smartTurn: value.smartTurn !== false,
    vad: value.vad === true,
    memoryEnabled: value.memoryEnabled !== false,
    avatar: {
      scene: ['office', 'home', 'intimate'].includes(avatar.scene) ? avatar.scene : 'home',
      gender: avatar.gender === 'male' ? 'male' : 'female',
      outfit: shortString(avatar.outfit, 80) || 'idol',
      twoD: avatar.twoD === true,
    },
  };
}

function payloadDigest(payload) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function withIntegrity(payload) {
  return {
    ...payload,
    integrity: {
      algorithm: 'sha256',
      digest: payloadDigest(payload),
    },
  };
}

function verifyCapsule(capsule) {
  if (!capsule || typeof capsule !== 'object') return false;
  if (capsule.format !== FORMAT || capsule.schemaVersion !== SCHEMA_VERSION) return false;
  const integrity = capsule.integrity;
  if (!integrity || integrity.algorithm !== 'sha256' || typeof integrity.digest !== 'string') return false;
  const { integrity: _ignored, ...payload } = capsule;
  return payloadDigest(payload) === integrity.digest;
}

async function buildCapsule(sql, device, preferences) {
  const facts = await sql`
    select fact, updated_at from user_facts
    where device_id = ${device}
    order by updated_at desc limit ${MAX_FACTS}`;
  const messages = await sql`
    select role, text, created_at from chat_messages
    where device_id = ${device}
    order by id asc limit ${MAX_MESSAGES}`;

  const normalizedFacts = facts.map((row) => ({
    fact: shortString(row.fact, 300),
    updatedAt: safeDate(row.updated_at),
  })).filter((item) => item.fact);

  const normalizedMessages = messages.map((row) => ({
    role: row.role === 'mira' ? 'mira' : 'user',
    text: shortString(row.text, 4000),
    createdAt: safeDate(row.created_at),
  })).filter((item) => item.text);

  let continuity = {
    summary: normalizedFacts.slice(0, 6).map((item) => item.fact).join(' '),
    interactionContext: '',
    priorities: [],
    generatedBy: null,
  };

  const modelInput = JSON.stringify({
    facts: normalizedFacts.map((item) => item.fact).slice(0, 100),
    recentConversation: normalizedMessages.slice(-40).map(({ role, text }) => ({ role, text })),
    preferences,
  });

  try {
    const generated = await generateBrainJson(CONTINUITY_PROMPT, modelInput, { maxTokens: 800 });
    if (generated?.json) {
      continuity = {
        summary: shortString(generated.json.summary, 2200),
        interactionContext: shortString(generated.json.interactionContext, 1200),
        priorities: Array.isArray(generated.json.priorities)
          ? generated.json.priorities.map((item) => shortString(item, 220)).filter(Boolean).slice(0, 8)
          : [],
        generatedBy: generated.provider && generated.model
          ? { provider: generated.provider, model: generated.model }
          : null,
      };
    }
  } catch {
    // A capsule is still useful without an LLM-generated summary.
  }

  return withIntegrity({
    format: FORMAT,
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    source: {
      app: 'Mira',
      purpose: 'Portable continuity record',
    },
    mira: {
      name: 'Mira',
      description: 'Voice-first AI companion. This capsule stores user-approved continuity data, not hidden inner state.',
    },
    continuity,
    facts: normalizedFacts,
    history: normalizedMessages,
    preferences,
  });
}

async function persistCapsule(sql, device, capsule) {
  const digest = capsule.integrity.digest;
  await sql`
    insert into identity_capsules (device_id, schema_version, capsule, digest, updated_at)
    values (${device}, ${SCHEMA_VERSION}, ${JSON.stringify(capsule)}::jsonb, ${digest}, now())
    on conflict (device_id) do update
    set schema_version = excluded.schema_version,
        capsule = excluded.capsule,
        digest = excluded.digest,
        updated_at = now()`;
}

export default async function handler(req, res) {
  const sql = getSql();
  if (!sql) return res.status(503).json({ error: 'chưa cấu hình DATABASE_URL' });

  const body = req.method === 'GET' ? {} : parseBody(req);
  const device = resolveMemoryScope(req, res, req.query?.device || body?.device);

  try {
    await ensureSchema(sql);

    if (req.method === 'GET') {
      const rows = await sql`
        select capsule, updated_at from identity_capsules
        where device_id = ${device} limit 1`;
      if (!rows.length) return res.status(404).json({ error: 'chưa có Identity Capsule' });
      return res.status(200).json({ capsule: rows[0].capsule, updatedAt: rows[0].updated_at });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

    const action = shortString(body.action, 20);
    if (action === 'snapshot') {
      const preferences = sanitizePreferences(body.preferences);
      const capsule = await buildCapsule(sql, device, preferences);
      await persistCapsule(sql, device, capsule);
      return res.status(200).json({ capsule });
    }

    if (action === 'import') {
      const capsule = body.capsule;
      if (!verifyCapsule(capsule)) return res.status(400).json({ error: 'Capsule không hợp lệ hoặc hash không khớp' });

      const facts = Array.isArray(capsule.facts)
        ? capsule.facts.map((item) => ({ fact: shortString(item?.fact, 300) })).filter((item) => item.fact).slice(0, MAX_FACTS)
        : [];
      const history = Array.isArray(capsule.history)
        ? capsule.history.map((item) => ({
            role: item?.role === 'mira' ? 'mira' : 'user',
            text: shortString(item?.text, 4000),
            created_at: safeDate(item?.createdAt),
          })).filter((item) => item.text).slice(0, MAX_MESSAGES)
        : [];

      if (facts.length) {
        const json = JSON.stringify(facts);
        await sql`
          insert into user_facts (device_id, fact)
          select ${device}, x.fact
          from jsonb_to_recordset(${json}::jsonb) as x(fact text)
          where not exists (
            select 1 from user_facts u
            where u.device_id = ${device} and lower(u.fact) = lower(x.fact)
          )`;
      }

      if (history.length) {
        const json = JSON.stringify(history);
        await sql`
          insert into chat_messages (device_id, role, text, created_at)
          select ${device}, x.role, x.text, x.created_at
          from jsonb_to_recordset(${json}::jsonb) as x(role text, text text, created_at timestamptz)
          where x.role in ('user', 'mira')
            and not exists (
              select 1 from chat_messages m
              where m.device_id = ${device} and m.role = x.role and m.text = x.text
            )`;
      }

      const preferences = sanitizePreferences(capsule.preferences);
      const normalized = withIntegrity({
        ...capsule,
        format: FORMAT,
        schemaVersion: SCHEMA_VERSION,
        preferences,
        importedAt: new Date().toISOString(),
      });
      await persistCapsule(sql, device, normalized);
      return res.status(200).json({
        ok: true,
        mergedFacts: facts.length,
        mergedMessages: history.length,
        preferences,
        continuity: normalized.continuity || null,
      });
    }

    return res.status(400).json({ error: 'action không hợp lệ' });
  } catch (error) {
    return res.status(500).json({ error: String(error?.message || error).slice(0, 240) });
  }
}
