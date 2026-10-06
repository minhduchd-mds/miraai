import { desktopInvoke, isDesktopRuntime } from '../../desktop/bridge';
import type { MiraSkill } from './types';

export type DesktopMediaAction = 'open' | 'play' | 'pause' | 'next' | 'previous' | 'search' | 'recent' | 'contextual';

export interface DesktopMusicRequest {
  action: DesktopMediaAction;
  query?: string;
}

interface DesktopMediaActionResult {
  action: DesktopMediaAction;
  handled: boolean;
  detail: string;
  query?: string | null;
  source?: string | null;
}

function normalize(input: string): string {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function namedTrackQuery(input: string): string {
  const lower = input.toLocaleLowerCase('vi');
  const markers = ['mở lại bài ', 'bật lại bài ', 'phát lại bài ', 'mở bài ', 'bật bài ', 'phát bài ', 'play bài ', 'mở bài hát ', 'bật bài hát ', 'phát bài hát '];
  for (const marker of markers) {
    const index = lower.indexOf(marker);
    if (index < 0) continue;
    return input.slice(index + marker.length).replace(/[.!?]+$/g, '').replace(/\s+(đi|nhé|nha|em|giúp anh|cho anh)$/i, '').trim().slice(0, 180);
  }
  return '';
}

function wantsRecentTrack(q: string): boolean {
  const timeCue = /\b(hom truoc|gan day|vua nghe|vua nay|luc truoc|lan truoc|hom qua)\b/.test(q);
  const replayCue = /\b(bat lai|mo lai|phat lai|nghe lai)\b/.test(q);
  return /\b(bai|nhac|music)\b/.test(q) && (timeCue || replayCue && /\b(vua|gan|truoc|lai)\b/.test(q));
}

function contextualTrackQuery(q: string): string {
  if (!/\b(bai|nhac|music)\b/.test(q)) return '';
  if (!/\b(hay nghe|thuong nghe|nghe luc|nghe khi|hop luc|hop khi)\b/.test(q)) return '';
  const contexts = [
    'met', 'buon', 'cang thang', 'ap luc', 'lo lang', 'chan', 'co don',
    'vui', 'thu gian', 'lam viec', 'tap trung', 'hoc', 'lai xe',
  ];
  return contexts.find((context) => q.includes(context)) || '';
}

export function desktopMusicRequest(input: string): DesktopMusicRequest | null {
  const q = normalize(input);
  if (!q) return null;
  const mentionsMusic = /\b(nhac|music|bai hat|bai nhac|spotify|apple music)\b/.test(q);
  if (wantsRecentTrack(q)) return { action: 'recent' };
  const contextual = contextualTrackQuery(q);
  if (contextual) return { action: 'contextual', query: contextual };
  const track = namedTrackQuery(input);
  if (track) return { action: 'search', query: track };
  if (/\b(dung|tam dung|pause|ngung)\b/.test(q) && mentionsMusic) return { action: 'pause' };
  if (/\b(next|bai tiep|bai ke|bai khac|chuyen bai|qua bai)\b/.test(q)) return { action: 'next' };
  if (/\b(previous|bai truoc|quay lai bai)\b/.test(q)) return { action: 'previous' };
  if (/\b(mo|open)\b/.test(q) && mentionsMusic) return { action: 'open' };
  if (/\b(bat|play|phat|tiep tuc)\b/.test(q) && mentionsMusic) return { action: 'play' };
  return null;
}

export function desktopMusicAction(input: string): DesktopMediaAction | null { return desktopMusicRequest(input)?.action ?? null; }
export function isExplicitDesktopMusicCommand(input: string): boolean { return desktopMusicRequest(input) !== null; }

export const desktopMusicSkill: MiraSkill = {
  id: 'desktop.music',
  description: 'Điều khiển nhạc trên Mira Desktop: system player hoặc thư viện local do người dùng tự chọn, gồm tìm bài cụ thể và phát lại bài gần đây.',
  priority: 120,
  risk: 'write',
  requiresNetwork: false,
  supportsVoice: true,
  capabilities: ['host.write'],
  examples: ['Bật nhạc đi em.', 'Dừng nhạc một chút.', 'Chuyển bài khác.', 'Mở bài The Night I Found You.', 'Bật lại bài hôm trước anh nghe.', 'Bật bài anh hay nghe lúc mệt.'],
  match(input) { if (!isDesktopRuntime()) return 0; return isExplicitDesktopMusicCommand(input) ? 0.99 : 0; },
  async execute(input) {
    const request = desktopMusicRequest(input);
    if (!request) return null;
    const result = await desktopInvoke<DesktopMediaActionResult>('desktop_media_action', { action: request.action, query: request.query, context: input });
    const title = request.action === 'pause' ? 'Đã dừng nhạc'
      : request.action === 'next' ? 'Đã chuyển bài'
        : request.action === 'previous' ? 'Đã quay lại bài trước'
          : request.action === 'recent' ? (result.handled ? 'Đã mở lại bài gần đây' : 'Chưa có lịch sử nghe')
            : request.action === 'contextual' ? (result.handled ? 'Đã chọn theo bối cảnh' : 'Chưa đủ lịch sử theo bối cảnh')
              : request.action === 'search' ? (result.handled ? 'Đã xử lý bài anh yêu cầu' : 'Chưa mở được bài')
              : 'Đã gửi lệnh phát nhạc';
    return {
      skillId: 'desktop.music',
      speechHint: result.handled ? result.detail : 'Em chưa thực hiện được lệnh nhạc. ' + result.detail,
      content: { kind: 'card', data: { eyebrow: result.source === 'local-context-memory' ? 'Mira Desktop · Music Memory' : result.source === 'local-library' ? 'Mira Desktop · Local Music' : 'Mira Desktop · Music', title, body: result.detail } },
      data: result,
    };
  },
};
