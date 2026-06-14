import { ServerTTS } from './server-tts';
import { WebSpeechTTS } from './webspeech-tts';

// Engine MẶC ĐỊNH: ElevenLabs qua Vercel serverless (/api/tts) — key nằm phía server (elevenlabs_api_key),
// KHÔNG lộ ra browser. Danh sách giọng lấy từ /api/voices. Server không tới được (vd dev cục bộ không chạy
// `vercel dev`, hoặc thiếu key) → tự fallback sang giọng hệ thống (Web Speech) để không bao giờ câm.
export class CloudTTS extends ServerTTS {
  constructor() {
    super({
      serverUrl: '/api',
      label: 'Mira',
      fallbackVoice: { name: 'Sarah', voiceURI: 'EXAVITQu4vr4xnSDxMaL', lang: 'vi-VN' },
      sampleText: 'Xin chào anh, em là Mira. Đây là giọng nói của em ạ.',
      fallback: new WebSpeechTTS(),
    });
  }
}
