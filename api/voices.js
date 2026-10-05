import {
  MIRA_VI_FEMALE_VOICE_ID,
  RACHEL_VOICE_ID,
  applyCors,
  defaultElevenVoice,
  originAllowed,
} from '../server/tts-policy.mjs';

function safeVoice(voice) {
  if (!voice || typeof voice !== 'object' || !voice.voice_id) return null;
  const labels = voice.labels && typeof voice.labels === 'object' ? voice.labels : {};
  const verified = Array.isArray(voice.verified_languages) ? voice.verified_languages : [];
  const vi = verified.find((item) => {
    const lang = String(item?.language || '').toLowerCase();
    const locale = String(item?.locale || '').toLowerCase();
    return lang === 'vi' || lang === 'vie' || locale.startsWith('vi-');
  });

  return {
    id: `elevenlabs:${String(voice.voice_id)}`,
    label: `ElevenLabs · ${String(voice.name || 'Female Vietnamese')}`,
    name: String(voice.name || ''),
    gender: String(labels.gender || 'female').toLowerCase(),
    language: vi ? 'vi' : String(labels.language || '').toLowerCase(),
    accent: String(vi?.accent || labels.accent || '').toLowerCase(),
    category: String(voice.category || ''),
    recordingQuality: String(voice.recording_quality || ''),
    vietnameseVerified: Boolean(vi),
  };
}

function rankVoice(voice) {
  let score = 0;
  if (voice.vietnameseVerified) score += 100;
  if (voice.language === 'vi' || voice.language === 'vie') score += 60;
  if (/vietnam/.test(voice.accent)) score += 50;
  if (voice.gender === 'female') score += 25;
  if (/studio|high/.test(voice.recordingQuality)) score += 12;
  if (/professional|cloned|generated/.test(voice.category)) score += 8;
  return score;
}

async function accountVietnameseVoices(key) {
  const url = new URL('https://api.elevenlabs.io/v2/voices');
  url.searchParams.set('page_size', '30');
  url.searchParams.set('gender', 'female');
  url.searchParams.append('language', 'vi');
  url.searchParams.set('high_quality', 'true');

  const response = await fetch(url, {
    headers: { 'xi-api-key': key },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`voices_${response.status}`);
  const body = await response.json();
  return (Array.isArray(body?.voices) ? body.voices : [])
    .map(safeVoice)
    .filter(Boolean)
    .sort((a, b) => rankVoice(b) - rankVoice(a))
    .slice(0, 12);
}

export default async function handler(req, res) {
  applyCors(req, res, 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!originAllowed(req)) return res.status(403).json({ error: 'origin_not_allowed' });
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const key = process.env.elevenlabs_api_key || process.env.ELEVENLABS_API_KEY || '';
  const configured = Boolean(key);
  const currentVoice = defaultElevenVoice();

  let discovered = [];
  let discovery = configured ? 'empty' : 'not_configured';
  if (configured) {
    try {
      discovered = await accountVietnameseVoices(key);
      discovery = discovered.length ? 'account_vi_female' : 'no_vi_female_voice';
    } catch {
      discovery = 'unavailable';
    }
  }

  const fallback = {
    id: `elevenlabs:${MIRA_VI_FEMALE_VOICE_ID}`,
    label: 'ElevenLabs · Thanh Ngọc · Vietnamese female',
    name: 'Thanh Ngọc - Warm & Trusted Expert',
    gender: 'female',
    language: 'vi',
    accent: 'southern',
    category: 'professional',
    recordingQuality: '',
    vietnameseVerified: true,
  };

  const byId = new Map();
  for (const voice of [...discovered, fallback]) byId.set(voice.id, voice);
  const voices = [...byId.values()];

  res.setHeader('cache-control', 'private, max-age=60');
  return res.status(200).json({
    provider: 'elevenlabs',
    elevenLabsOnly: true,
    configured,
    currentVoice: `elevenlabs:${currentVoice}`,
    discovery,
    recommendedVoice: discovered[0]?.id || null,
    voices,
  });
}
