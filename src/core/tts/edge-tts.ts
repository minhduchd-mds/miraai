import type { VoiceOption } from '../types';
import { ServerTTS } from './server-tts';
import { WebSpeechTTS } from './webspeech-tts';

// TTS Edge — giọng neural tiếng Việt của Microsoft (vi-VN-HoaiMyNeural / NamMinhNeural):
// tự nhiên, MIỄN PHÍ, không cần key, không GPU, không tải model.
// Microsoft CHẶN gọi WebSocket thẳng từ trình duyệt (CORS/Origin) → đi qua server nhẹ
// trong server/ (chỉ cần `pip install edge-tts`, nhẹ hơn hẳn VieNeu). Dữ liệu văn bản đi
// qua Microsoft → KHÔNG dùng cho vùng bảo mật cao; vùng đó dùng VieNeu self-host.
export const EDGE_DEFAULT_URL = 'http://localhost:8017';

const EDGE_FALLBACK: VoiceOption = {
  name: 'Hoài My (Edge · nữ)',
  voiceURI: 'vi-VN-HoaiMyNeural',
  lang: 'vi-VN',
};

export class EdgeTTS extends ServerTTS {
  constructor(serverUrl: string = EDGE_DEFAULT_URL) {
    super({
      serverUrl: serverUrl || EDGE_DEFAULT_URL,
      label: 'Edge',
      fallbackVoice: EDGE_FALLBACK,
      sampleText: 'Xin chào anh, em là Mira. Giọng tiếng Việt mới của em nghe tự nhiên hơn chứ ạ?',
      fallback: new WebSpeechTTS(), // server Edge (cổng 8017) tắt → nói bằng giọng hệ thống, không câm
    });
  }
}
