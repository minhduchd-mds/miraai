// Voice metadata for Mira neural TTS. Only advertise providers configured on the server.
export default function handler(_req, res) {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasEleven = !!(process.env.elevenlabs_api_key || process.env.ELEVENLABS_API_KEY);
  const voices = [];

  if (hasOpenAI) {
    voices.push(
      { id: 'openai:marin', label: 'Mira Natural · Marin' },
      { id: 'openai:cedar', label: 'Mira Natural · Cedar' },
      { id: 'openai:coral', label: 'Mira Natural · Coral' },
      { id: 'openai:shimmer', label: 'Mira Natural · Shimmer' },
    );
  }

  if (hasEleven) {
    voices.push(
      { id: 'elevenlabs:EXAVITQu4vr4xnSDxMaL', label: 'ElevenLabs · Sarah' },
      { id: 'elevenlabs:21m00Tcm4TlvDq8ikWAM', label: 'ElevenLabs · Rachel' },
      { id: 'elevenlabs:XB0fDUnXU5powFXDhCwa', label: 'ElevenLabs · Charlotte' },
    );
  }

  if (!voices.length) voices.push({ id: 'auto', label: 'Tự động · Giọng hệ thống' });
  res.setHeader('cache-control', 'private, max-age=60');
  res.status(200).json({ voices });
}
