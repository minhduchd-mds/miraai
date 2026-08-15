import { ServerTTS } from './server-tts';
import { WebSpeechTTS } from './webspeech-tts';

// Production neural voice gateway. /api/tts prefers OpenAI natural speech, then ElevenLabs.
// If neither provider is reachable, ServerTTS falls back to the browser's vi-VN Web Speech voice.
export class CloudTTS extends ServerTTS {
  constructor() {
    super({
      serverUrl: '/api',
      label: 'Mira Neural',
      fallbackVoice: { name: 'Mira Natural · Tự động', voiceURI: 'auto', lang: 'vi-VN' },
      sampleText: 'Em nghe anh. Giọng này được tối ưu để nói tự nhiên và gần với hội thoại hơn.',
      fallback: new WebSpeechTTS(),
    });
  }
}
