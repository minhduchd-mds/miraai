import {
  applyCors,
  originAllowed,
} from '../server/tts-policy.mjs';

const VOICE_NAME = 'Mira Vietnamese Gentle';
const VOICE_DESCRIPTION = [
  'Native Vietnamese woman, late twenties to early thirties.',
  'Natural Northern Vietnamese / Hanoi accent.',
  'Warm, soft, gentle and intimate conversational tone.',
  'Calm breathing, smooth phrasing, subtle emotional warmth.',
  'Never sounds like a newsreader, announcer, advertisement or robotic assistant.',
  'Clear consonants, relaxed vowels, medium-low energy, natural pauses.',
  'Suitable for a close everyday AI companion speaking softly at home.',
].join(' ');

const PREVIEW_TEXT =
  'Anh về rồi à? Hôm nay chắc anh cũng mệt rồi. Ngồi nghỉ một chút nhé, em ở đây và đang nghe anh.';

function keyFromEnv() {
  return process.env.elevenlabs_api_key || process.env.ELEVENLABS_API_KEY || '';
}

export default async function handler(req, res) {
  applyCors(req, res, 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!originAllowed(req)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const token = String(req.query?.token || '');
  const expected = String(process.env.MIRA_VOICE_BOOTSTRAP_TOKEN || '');
  if (!expected || token !== expected) {
    return res.status(403).json({ error: 'bootstrap_not_authorized' });
  }

  const key = keyFromEnv();
  if (!key) return res.status(503).json({ error: 'elevenlabs_not_configured' });

  try {
    const designResponse = await fetch(
      'https://api.elevenlabs.io/v1/text-to-voice/design?output_format=mp3_44100_192&guidance_scale=3.5&should_enhance=true',
      {
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
        headers: {
          'content-type': 'application/json',
          'xi-api-key': key,
        },
        body: JSON.stringify({
          model_id: 'eleven_multilingual_ttv_v2',
          voice_description: VOICE_DESCRIPTION,
          text: PREVIEW_TEXT,
        }),
      },
    );

    if (!designResponse.ok) {
      const detail = (await designResponse.text()).slice(0, 1200);
      return res.status(502).json({
        error: 'voice_design_failed',
        status: designResponse.status,
        detail,
      });
    }

    const design = await designResponse.json();
    const previews = Array.isArray(design?.previews) ? design.previews : [];
    const selected = previews[0];
    const generatedVoiceId = String(selected?.generated_voice_id || '');
    if (!generatedVoiceId) {
      return res.status(502).json({ error: 'voice_design_missing_preview' });
    }

    const saveResponse = await fetch('https://api.elevenlabs.io/v1/text-to-voice', {
      method: 'POST',
      signal: AbortSignal.timeout(20_000),
      headers: {
        'content-type': 'application/json',
        'xi-api-key': key,
      },
      body: JSON.stringify({
        voice_name: VOICE_NAME,
        voice_description: VOICE_DESCRIPTION,
        generated_voice_id: generatedVoiceId,
        labels: {
          language: 'vi',
          accent: 'northern_vietnamese_hanoi',
          gender: 'female',
          age: 'young_adult',
          use_case: 'conversational_ai',
        },
      }),
    });

    if (!saveResponse.ok) {
      const detail = (await saveResponse.text()).slice(0, 1200);
      return res.status(502).json({
        error: 'voice_save_failed',
        status: saveResponse.status,
        generatedVoiceId,
        detail,
      });
    }

    const voice = await saveResponse.json();
    return res.status(200).json({
      ok: true,
      voiceId: String(voice?.voice_id || ''),
      name: String(voice?.name || VOICE_NAME),
      category: String(voice?.category || 'generated'),
      previewGeneratedVoiceId: generatedVoiceId,
      previewCount: previews.length,
    });
  } catch (error) {
    return res.status(502).json({
      error: 'voice_bootstrap_failed',
      detail: String(error && error.message ? error.message : error).slice(0, 500),
    });
  }
}
