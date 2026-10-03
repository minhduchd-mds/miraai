import type { TTSAdapter } from '../types';
import { ServerTTS } from './server-tts';
import { WebSpeechTTS } from './webspeech-tts';

// Production neural voice gateway. /api/tts prefers OpenAI natural speech, then ElevenLabs.
// If neither provider is reachable, ServerTTS falls back to the browser's vi-VN Web Speech voice.
export class CloudTTS extends ServerTTS {
  constructor(
    serverUrl: string = '/api',
    fallback: (TTSAdapter & { unlock?: () => void }) = new WebSpeechTTS(),
    fallbackLabel = 'Hệ thống',
  ) {
    super({
      serverUrl: serverUrl || '/api',
      label: 'Mira Neural',
      fallbackVoice: { name: 'Mira Natural · Tự động', voiceURI: 'auto', lang: 'vi-VN' },
      sampleText: 'Em nghe anh. Em sẽ nói chậm vừa đủ, mềm và gần anh hơn một chút nhé.',
      fallback,
      fallbackLabel,
      failureThreshold: 2,
      cooldownMs: 30_000,
    });
  }
}
