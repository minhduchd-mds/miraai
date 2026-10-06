import { desktopInvoke, isDesktopRuntime } from '../../desktop/bridge';
import type { MiraSkill } from './types';

export type DesktopMediaAction = 'open' | 'play' | 'pause' | 'next' | 'previous' | 'search';

export interface DesktopMusicRequest {
  action: DesktopMediaAction;
  query?: string;
}

interface DesktopMediaActionResult {
  action: DesktopMediaAction;
  handled: boolean;
  detail: string;
  query?: string | null;
}

function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function namedTrackQuery(input: string): string {
  const lower = input.toLocaleLowerCase('vi');
  const markers = [
    'mở bài ', 'bật bài ', 'phát bài ', 'play bài ',
    'mở bài hát ', 'bật bài hát ', 'phát bài hát ',
  ];
  for (const marker of markers) {
    const index = lower.indexOf(marker);
    if (index < 0) continue;
    return input.slice(index + marker.length)
      .replace(/[.!?]+$/g, '')
      .replace(/\s+(đi|nhé|nha|em|giúp anh|cho anh)$/i, '')
      .trim()
      .slice(0, 180);
  }
  return '';
}

export function desktopMusicRequest(input: string): DesktopMusicRequest | null {
  const q = normalize(input);
  if (!q) return null;
  const mentionsMusic = /\b(nhac|music|bai hat|bai nhac|spotify|apple music)\b/.test(q);
  const track = namedTrackQuery(input);

  if (track) return { action: 'search', query: track };
  if (/\b(dung|tam dung|pause|ngung)\b/.test(q) && mentionsMusic) return { action: 'pause' };
  if (/\b(next|bai tiep|bai ke|bai khac|chuyen bai|qua bai)\b/.test(q)) return { action: 'next' };
  if (/\b(previous|bai truoc|quay lai bai)\b/.test(q)) return { action: 'previous' };
  if (/\b(mo|open)\b/.test(q) && mentionsMusic) return { action: 'open' };
  if (/\b(bat|play|phat|tiep tuc)\b/.test(q) && mentionsMusic) return { action: 'play' };
  return null;
}

export function desktopMusicAction(input: string): DesktopMediaAction | null {
  return desktopMusicRequest(input)?.action ?? null;
}

export function isExplicitDesktopMusicCommand(input: string): boolean {
  return desktopMusicRequest(input) !== null;
}

export const desktopMusicSkill: MiraSkill = {
  id: 'desktop.music',
  description: 'Điều khiển media cục bộ trên Mira Desktop khi người dùng ra lệnh rõ ràng: mở/bật/dừng/chuyển bài hoặc tìm một bài cụ thể.',
  priority: 120,
  risk: 'write',
  requiresNetwork: false,
  supportsVoice: true,
  capabilities: ['host.write'],
  examples: [
    'Bật nhạc đi em.',
    'Dừng nhạc một chút.',
    'Chuyển bài khác.',
    'Mở bài The Night I Found You.',
  ],
  match(input) {
    if (!isDesktopRuntime()) return 0;
    return isExplicitDesktopMusicCommand(input) ? 0.99 : 0;
  },
  async execute(input) {
    const request = desktopMusicRequest(input);
    if (!request) return null;
    const result = await desktopInvoke<DesktopMediaActionResult>('desktop_media_action', {
      action: request.action,
      query: request.query,
    });
    const title = request.action === 'pause'
      ? 'Đã dừng nhạc'
      : request.action === 'next'
        ? 'Đã chuyển bài'
        : request.action === 'previous'
          ? 'Đã quay lại bài trước'
          : request.action === 'search'
            ? (result.handled ? 'Đã xử lý bài anh yêu cầu' : 'Chưa mở được bài')
            : 'Đã gửi lệnh phát nhạc';
    return {
      skillId: 'desktop.music',
      speechHint: result.handled ? result.detail : 'Em chưa điều khiển được trình phát nhạc trên máy. ' + result.detail,
      content: {
        kind: 'card',
        data: { eyebrow: 'Mira Desktop · Music', title, body: result.detail },
      },
      data: result,
    };
  },
};
