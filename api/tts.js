// Vercel serverless: proxy ElevenLabs TTS. Key đọc PHÍA SERVER (env elevenlabs_api_key) → KHÔNG lộ ra
// browser. App gọi POST /api/tts {text, voice?} → trả audio/mpeg. Khớp hợp đồng ServerTTS của client.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const key = process.env.elevenlabs_api_key || process.env.ELEVENLABS_API_KEY;
  if (!key) return res.status(500).json({ error: 'server thiếu elevenlabs_api_key' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const text = ((body && body.text) || '').toString().trim();
  if (!text) return res.status(400).json({ error: 'text rỗng' });
  if (text.length > 2000) return res.status(413).json({ error: 'text quá dài' });
  const voice = (body && body.voice) || 'EXAVITQu4vr4xnSDxMaL'; // Sarah (đa ngôn ngữ, đọc tiếng Việt tốt)

  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'xi-api-key': key },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.45, similarity_boost: 0.75 },
        }),
      },
    );
    if (!r.ok) {
      const detail = (await r.text()).slice(0, 300);
      return res.status(r.status).json({ error: `ElevenLabs ${r.status}: ${detail}` });
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('content-type', 'audio/mpeg');
    res.setHeader('cache-control', 'no-store');
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(502).json({ error: String(e && e.message ? e.message : e).slice(0, 200) });
  }
}
