import { detectContent, fetchWeather } from '../../core/content';
import type { MiraSkill } from './types';

export const weatherSkill: MiraSkill = {
  id: 'weather',
  description: 'Đọc và hiển thị thời tiết hiện tại theo địa điểm người dùng hỏi.',
  priority: 90,
  risk: 'external-read',
  requiresNetwork: true,
  supportsVoice: true,
  examples: ['Thời tiết Hà Nội hôm nay thế nào?', 'Ở Đà Nẵng đang nóng không?'],
  match(input) {
    return detectContent(input)?.kind === 'weather' ? 0.95 : 0;
  },
  async execute(input) {
    const intent = detectContent(input);
    if (intent?.kind !== 'weather') return null;
    const weather = await fetchWeather(intent.city);
    if (!weather) return null;
    return { skillId: 'weather', content: { kind: 'weather', data: weather }, data: weather };
  },
};
