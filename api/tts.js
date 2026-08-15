// Mira server-side neural TTS gateway.
// Priority: OpenAI natural speech -> ElevenLabs -> client-side Web Speech fallback.
// Provider keys stay on the server and are never returned to the browser.

const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini-tts';
const OPENAI_DEFAULT_VOICE = 'marin';
const ELEVEN_DEFAULT_VOICE = 'EXAVITQu4vr4xnSDxMaL';
const DEFAULT_VI_INSTRUCTIONS =
  'Nói tiếng Việt tự nhiên như một cuộc trò chuyện riêng tư. Giọng ấm, gần gũi, tự tin, nhịp vừa phải, phát âm rõ theo phong cách miền Bắc nhưng không cường điệu. Có ngắt nghỉ nhẹ theo ý nghĩa câu, thay đổi ngữ điệu tinh tế, tránh chất giọng phát thanh viên và tuyệt đối không đọc máy móc.';

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  return body && typeof body === 'object' ? body : {};
}

function parseVoice(raw) {
  const value = String(raw || '').trim();
  if (!value || value === 'auto') return { provider: '', voice: '' };
  const colon = value.indexOf(':');
  if (colon > 0) return { provider: value.slice(0, colon).toLowerCase(), voice: value.slice(colon + 1) };
  if (/^[A-Za-z0-9_-]{20,}$/.test(value)) return { provider: 'elevenlabs', voice: value };
  return { provider: 'openai', voice: value };
}

function chooseProvider(requested, openaiKey, elevenKey) {
  if (requested === 'openai' && openaiKey) return 'openai';
  if (requested === 'elevenlabs' && elevenKey) return 'elevenlabs';

  const preferred = String(process.env.MIRA_TTS_PROVIDER || 'auto').toLowerCase();
  if (preferred === 'openai' && openaiKey) return 'openai';
  if (preferred === 'elevenlabs' && elevenKey) return 'elevenlabs';
  if (openaiKey) return 'openai';
  if (elevenKey) return 'elevenlabs';
  return '';
}

function mergeInstructions(dynamicInstructions) {
  const base = String(process.env.OPENAI_TTS_INSTRUCTIONS || DEFAULT_VI_INSTRUCTIONS).trim();
  const dynamic = String(dynamicInstructions || '').trim().slice(0, 1400);
  return dynamic ? `${base}\n${dynamic}` : base;
}

async function openAISpeech({ key, text, voice, instructions }) {
  const model = process.env.OPENAI_TTS_MODEL || OPENAI_DEFAULT_MODEL;
  const selectedVoice = voice || process.env.OPENAI_TTS_VOICE || OPENAI_DEFAULT_VOICE;
  const payload = {
    model,
    voice: selectedVoice,
    input: text,
    response_format: 'mp3',
  };
  if (/gpt-4o-mini-tts/i.test(model)) payload.instructions = mergeInstructions(instructions);

  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 360);
    throw new Error(`OpenAI TTS ${response.status}: ${detail}`);
  }
  return { response, provider: 'openai', voice: selectedVoice };
}

async function elevenSpeech({ key, text, voice }) {
  const selectedVoice = voice || process.env.ELEVENLABS_TTS_VOICE || ELEVEN_DEFAULT_VOICE;
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(selectedVoice)}?output_format=mp3_44100_64`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'xi-api-key': key },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.32,
          similarity_boost: 0.78,
          style: 0.34,
          use_speaker_boost: true,
        },
      }),
    },
  );
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 360);
    throw new Error(`ElevenLabs TTS ${response.status}: ${detail}`);
  }
  return { response, provider: 'elevenlabs', voice: selectedVoice };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const body = parseBody(req);
  const text = String(body.text || '').trim();
  const instructions = String(body.instructions || '').trim().slice(0, 1400);
  if (!text) return res.status(400).json({ error: 'text rỗng' });
  if (text.length > 3500) return res.status(413).json({ error: 'text quá dài' });

  const openaiKey = process.env.OPENAI_API_KEY || '';
  const elevenKey = process.env.elevenlabs_api_key || process.env.ELEVENLABS_API_KEY || '';
  const requested = parseVoice(body.voice);
  const provider = chooseProvider(requested.provider, openaiKey, elevenKey);
  if (!provider) return res.status(503).json({ error: 'Chưa cấu hình neural TTS; client sẽ dùng giọng hệ thống.' });

  try {
    let result;
    if (provider === 'openai') {
      result = await openAISpeech({
        key: openaiKey,
        text,
        voice: requested.provider === 'openai' ? requested.voice : '',
        instructions,
      });
    } else {
      result = await elevenSpeech({
        key: elevenKey,
        text,
        voice: requested.provider === 'elevenlabs' ? requested.voice : '',
      });
    }

    const buf = Buffer.from(await result.response.arrayBuffer());
    if (!buf.length) throw new Error('empty_audio');
    res.setHeader('content-type', result.response.headers.get('content-type') || 'audio/mpeg');
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-mira-tts-provider', result.provider);
    res.setHeader('x-mira-tts-voice', result.voice);
    return res.status(200).send(buf);
  } catch (primaryError) {
    // If the preferred neural provider fails, try the other configured provider once.
    try {
      if (provider === 'openai' && elevenKey) {
        const result = await elevenSpeech({ key: elevenKey, text, voice: '' });
        const buf = Buffer.from(await result.response.arrayBuffer());
        res.setHeader('content-type', result.response.headers.get('content-type') || 'audio/mpeg');
        res.setHeader('cache-control', 'no-store');
        res.setHeader('x-mira-tts-provider', result.provider);
        res.setHeader('x-mira-tts-fallback', '1');
        return res.status(200).send(buf);
      }
      if (provider === 'elevenlabs' && openaiKey) {
        const result = await openAISpeech({ key: openaiKey, text, voice: '', instructions });
        const buf = Buffer.from(await result.response.arrayBuffer());
        res.setHeader('content-type', result.response.headers.get('content-type') || 'audio/mpeg');
        res.setHeader('cache-control', 'no-store');
        res.setHeader('x-mira-tts-provider', result.provider);
        res.setHeader('x-mira-tts-fallback', '1');
        return res.status(200).send(buf);
      }
    } catch (secondaryError) {
      return res.status(502).json({
        error: `Neural TTS lỗi: ${String(secondaryError && secondaryError.message ? secondaryError.message : secondaryError).slice(0, 240)}`,
      });
    }
    return res.status(502).json({
      error: `Neural TTS lỗi: ${String(primaryError && primaryError.message ? primaryError.message : primaryError).slice(0, 240)}`,
    });
  }
}
