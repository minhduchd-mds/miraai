import { ServerTTS } from './server-tts';

// TTS VieNeu — server self-host (server/ trong repo): vinorm + VieNeu-TTS, Apache-2.0,
// chạy real-time trên CPU, dữ liệu giọng KHÔNG ra ngoài (hợp vùng bảo mật cao của Soi).
// Logic phát/lipsync/chẩn đoán nằm ở lớp chung ServerTTS — đây chỉ là preset cấu hình.
export const VIENEU_DEFAULT_URL = 'http://localhost:8017';

export class VieNeuTTS extends ServerTTS {
  constructor(serverUrl: string = VIENEU_DEFAULT_URL) {
    super({
      serverUrl: serverUrl || VIENEU_DEFAULT_URL,
      label: 'VieNeu',
      fallbackVoice: { name: 'Giọng mặc định (VieNeu)', voiceURI: '', lang: 'vi-VN' },
      sampleText: 'Xin chào anh, em là Mira. Đây là giọng nói chạy trên máy của mình đó ạ.',
    });
  }
}
