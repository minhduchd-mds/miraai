#!/usr/bin/env node
/**
 * One-shot, synthetic-only real production probe.
 * No personal transcripts, cookies, user memory, session IDs, audio files,
 * credentials or provider answers are retained/logged.
 * Both inference and audio generation require explicit CLI flags.
 */
const paid = process.argv.includes('--allow-paid-call');
const voicePaid = process.argv.includes('--allow-voice-call');
const origin = process.env.MIRA_BENCHMARK_BASE_URL || 'https://miraai-five.vercel.app';
if (!['https://miraai-five.vercel.app', 'https://miraai-ten.vercel.app'].includes(origin)) {
  throw new Error('unapproved_production_origin');
}
const report = { kind: 'synthetic_production_gateway_probe', privacy: 'no_user_data',
  liveChat: false, liveVoice: false };
async function request(path, options = {}, timeout = 30000) {
  let response;
  try {
    response = await fetch(origin + path, {
      ...options, signal: AbortSignal.timeout(timeout),
      headers: { 'cache-control': 'no-store', ...(options.headers || {}) },
    });
  } catch { throw new Error(path.slice(1).replaceAll('/', '_') + '_network_failure'); }
  if (!response.ok) throw new Error(path.slice(1).replaceAll('/', '_') + '_http_' + response.status);
  return response;
}
async function json(path, options) {
  const response = await request(path, options);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > 32000) throw new Error('json_too_large');
  const text = await response.text();
  if (text.length > 32000) throw new Error('json_too_large');
  try { return JSON.parse(text); } catch { throw new Error('invalid_json'); }
}
function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(p * sorted.length) - 1];
}
async function main() {
  const brain = await json('/api/brain-health');
  report.brain = { configured: brain.configured === true,
    configuredProviderCount: Array.isArray(brain.providers) ? brain.providers.length : 0,
    inferenceVerifiedByHealth: brain.inferenceVerified === true,
    freeOnly: brain.freeOnly === true };
  const voices = await json('/api/voices');
  report.voices = { configured: voices.configured === true,
    elevenLabsOnly: voices.elevenLabsOnly === true };
  if (!paid) {
    report.note = 'readiness_only_paid_inference_not_attempted';
    return;
  }
  if (!report.brain.configured) {
    report.chatFailure = 'brain_not_configured';
  } else {
    try {
  const dialogue = [
    'Chào Mira. Mã kiểm thử giả lập của chúng ta là lá phong.',
    'Em nhắc lại mã kiểm thử giả lập anh vừa nói nhé.',
    'Đừng gọi anh là chồng yêu nữa. Nói bình thường nhé.',
    'Giúp anh kiểm tra một API giả lập báo lỗi HTTP 500. Nêu ba bước ngắn.',
    'Chốt lại, anh đang nhờ em kiểm tra loại lỗi nào?',
  ];
  const history = [];
  const durations = [];
  const markers = [];
  const providerKinds = new Set();
  for (let i = 0; i < dialogue.length; i++) {
    history.push({ role: 'user', text: dialogue[i] });
    const started = performance.now();
    const result = await json('/api/chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system: 'Bạn đang trả lời một kịch bản kiểm thử giả lập, không phải người dùng thật. Trả lời tiếng Việt ngắn và chính xác, không khẳng định quan hệ đời thực; tuân thủ yêu cầu xưng hô vừa được nói rõ.',
        messages: history, responseLength: 'short',
      }),
    });
    durations.push(Math.round(performance.now() - started));
    if (typeof result.text !== 'string' || !result.text.trim() || result.text.length > 10000) {
      throw new Error('invalid_inference_reply');
    }
    providerKinds.add(String(result.provider || 'unknown').slice(0, 30));
    markers.push({
      turn: i + 1,
      replyValid: true,
      continuityMarker: i === 1 ? /lá phong/iu.test(result.text) : null,
      avoidedForbiddenAddress: i === 2 || i === 3 || i === 4
        ? !/chồng yêu|vợ yêu/iu.test(result.text) : null,
      technicalTopic: i === 3 || i === 4 ? /api|http|500|máy chủ|server/iu.test(result.text) : null,
    });
    // Only synthetic replies remain in memory long enough to form this probe.
    history.push({ role: 'model', text: result.text });
  }
  report.liveChat = true;
  report.chat = { turns: dialogue.length, p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95), providers: [...providerKinds],
    heuristics: markers, scope: 'direct_gateway_with_synthetic_history_not_browser_memory' };
    } catch (error) {
      const code = String(error?.message || '');
      report.chatFailure = /^[a-z0-9_]+$/i.test(code) ? code.slice(0, 64) : 'chat_probe_failed';
    }
  }
  if (voicePaid) {
    try {
    if (!report.voices.configured || !report.voices.elevenLabsOnly) {
      throw new Error('elevenlabs_not_configured');
    }
    const started = performance.now();
    const response = await request('/api/tts', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'Chào anh. Em đang lắng nghe đây.' }),
    }, 30000);
    const audio = await response.arrayBuffer();
    if (audio.byteLength < 128 || audio.byteLength > 5000000 ||
        !String(response.headers.get('content-type') || '').startsWith('audio/')) {
      throw new Error('invalid_elevenlabs_audio');
    }
    report.liveVoice = true;
    report.voice = { provider: response.headers.get('x-mira-tts-provider') === 'elevenlabs'
      ? 'elevenlabs' : 'unconfirmed',
      roundTripMs: Math.round(performance.now() - started),
      bytes: audio.byteLength,
      scope: 'server_audio_generation_not_human_hearing_or_device_latency' };
    } catch (error) {
      const code = String(error?.message || '');
      report.voiceFailure = /^[a-z0-9_]+$/i.test(code) ? code.slice(0, 64) : 'voice_probe_failed';
    }
  }
  if (!report.liveChat || (voicePaid && !report.liveVoice)) process.exitCode = 1;
}
try {
  await main();
  console.log(JSON.stringify(report));
} catch (error) {
  report.failure = /^[a-z0-9_]+$/i.test(String(error?.message || ''))
    ? String(error.message).slice(0, 64) : 'probe_runtime_failure';
  console.log(JSON.stringify(report));
  process.exitCode = 1;
}
