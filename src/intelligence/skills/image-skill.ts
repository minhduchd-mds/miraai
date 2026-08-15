import { detectContent, pollinationsImage } from '../../core/content';
import type { MiraSkill } from './types';

export const imageSkill: MiraSkill = {
  id: 'image',
  description: 'Tạo bề mặt hình ảnh trực quan khi người dùng yêu cầu ảnh hoặc hình minh hoạ.',
  priority: 80,
  risk: 'external-read',
  requiresNetwork: true,
  supportsVoice: true,
  examples: ['Tạo cho anh hình một robot trợ lý.', 'Cho anh xem ảnh minh hoạ thành phố tương lai.'],
  match(input) {
    return detectContent(input)?.kind === 'image' ? 0.9 : 0;
  },
  async execute(input) {
    const intent = detectContent(input);
    if (intent?.kind !== 'image') return null;
    const url = pollinationsImage(intent.prompt);
    return {
      skillId: 'image',
      content: { kind: 'image', data: { prompt: intent.prompt, url } },
      data: { prompt: intent.prompt, url },
    };
  },
};
