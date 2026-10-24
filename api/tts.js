import { markPrivateResponse } from '../lib/private-response.js';
import { readLimitedTtsAudio, streamLimitedTtsAudio } from '../server/tts-response.mjs';
import { enforceAiQuota } from '../lib/ai-quota.js';
import {
  applyCors,
  MIRA_TTS_MAX_TEXT_LENGTH,
  elevenDialoguePayload,
  elevenDialogueUrl,
  elevenDialogueStreamUrl,
  originAllowed,
  takeRateSlot,
} from '../server/tts-policy.mjs';

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  return body && typeof body === 'object' ? body : {};
}


export default async function handler(req, res) {
  applyCors(req, res, 'POST,OPTIONS');
  markPrivateResponse(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!originAllowed(req)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!takeRateSlot(req)) return res.status(429).json({ error: 'rate_limited' });

  const body = parseBody(req);
  const text = String(body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'text_required' });
  if (text.length > MIRA_TTS_MAX_TEXT_LENGTH) return res.status(413).json({ error: 'text_too_long' });

  const key = process.env.elevenlabs_api_key || process.env.ELEVENLABS_API_KEY || '';
  if (!key) return res.status(503).json({ error: 'elevenlabs_not_configured' });
  if (!await enforceAiQuota(req, res, 'tts')) return;

  // Production voice identity/model are server-controlled through the shared contract.
  const payload = elevenDialoguePayload(text, body.instructions);
  // Streaming is a client capability, never an instruction to switch model/voice.
  const streaming = new URL(req.url || '/api/tts', 'https://miraai.local').searchParams.get('stream') === '1';
  const controller = new AbortController();
  // On client interruption, stop generating and forwarding unused audio bytes.
  res.on?.('close', () => controller.abort());

  try {
    const response = await fetch(
      streaming ? elevenDialogueStreamUrl() : elevenDialogueUrl(),
      {
        method: 'POST',
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(18_000)]),
        headers: {
          'content-type': 'application/json',
          'xi-api-key': key,
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 360);
      throw new Error(`ElevenLabs TTS ${response.status}: ${detail}`);
    }

    res.setHeader('content-type', 'audio/mpeg');
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-mira-tts-provider', 'elevenlabs');
    res.setHeader('x-mira-tts-model', payload.model_id);
    res.setHeader('x-mira-tts-voice', payload.inputs[0].voice_id);
    if (streaming) {
      res.status(200);
      // No 2nd upstream request, no browser-provided voice/model, no audio storage.
      await streamLimitedTtsAudio(response, res);
      return;
    }
    const { audio, contentType } = await readLimitedTtsAudio(response);
    res.setHeader('content-type', contentType);
    return res.status(200).send(audio);
  } catch (error) {
    // Operator diagnostics: upstream status + provider message (no key, no user text).
    console.error('[tts] elevenlabs', String(error?.message || error).slice(0, 300));
    if (res.headersSent) {
      // Never append a JSON error to a partially streamed MP3.
      res.destroy?.();
      return;
    }
    return res.status(502).json({
      error: 'elevenlabs_tts_failed',
      detail: 'provider_unavailable',
    });
  }
}
