import { ServerTTS } from './server-tts';

// Production voice path is intentionally ElevenLabs-only.
// If ElevenLabs is unavailable, Mira reports the TTS error instead of silently
// switching voice identity to browser/system/Piper/OpenAI.
export class CloudTTS extends ServerTTS {
  constructor(serverUrl: string = '/api') {
    super({
      serverUrl: serverUrl || '/api',
      label: 'ElevenLabs',
      fallbackVoice: {
        name: 'Mira · Thanh Ngọc · Vietnamese female',
        voiceURI: 'elevenlabs:Na15FlRRkMEDtEW4nVVP',
        lang: 'vi-VN',
      },
      sampleText: 'Anh nghe em nhé. Em sẽ nói mềm, tự nhiên và gần gũi hơn.',
      failureThreshold: 2,
      cooldownMs: 12_000,
    });
  }
}
