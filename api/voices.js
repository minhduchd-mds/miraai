// Vercel serverless: danh sách giọng ElevenLabs cho client (ServerTTS gọi GET /api/voices lúc khởi tạo).
// Preset giọng nữ đa ngôn ngữ đọc tiếng Việt tốt. Không cần key (chỉ là metadata).
export default function handler(_req, res) {
  res.setHeader('cache-control', 'public, max-age=3600');
  res.status(200).json({
    voices: [
      { id: 'EXAVITQu4vr4xnSDxMaL', label: 'Sarah' },
      { id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel' },
      { id: 'XB0fDUnXU5powFXDhCwa', label: 'Charlotte' },
    ],
  });
}
