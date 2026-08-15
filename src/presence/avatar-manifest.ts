import type { AvatarSel } from '../core/avatar-config';
import { lookImage } from '../core/avatar-config';

export interface AvatarPack {
  id: string;
  label: string;
  description: string;
  selection: AvatarSel;
}

// Only production-safe appearance packs are exposed in the main experience.
// Experimental/adult/demo looks remain available in Legacy/Labs for development.
export const AVATAR_PACKS: AvatarPack[] = [
  {
    id: 'mira-nova',
    label: 'Mira Nova',
    description: 'Gần gũi · mặc định',
    selection: { gender: 'female', scene: 'home', outfit: 'idol' },
  },
  {
    id: 'mira-aura',
    label: 'Mira Aura',
    description: 'Nhẹ nhàng · đời thường',
    selection: { gender: 'female', scene: 'home', outfit: 'sweater' },
  },
  {
    id: 'mira-pro',
    label: 'Mira Pro',
    description: 'Chuyên nghiệp · công việc',
    selection: { gender: 'male', scene: 'office', outfit: 'shirt' },
  },
  {
    id: 'mira-casual',
    label: 'Mira Casual',
    description: 'Tối giản · tự nhiên',
    selection: { gender: 'male', scene: 'home', outfit: 'casual' },
  },
];

export function avatarPackThumbnail(pack: AvatarPack): string {
  return lookImage(pack.selection);
}

export function sameAvatar(a: AvatarSel, b: AvatarSel): boolean {
  return a.gender === b.gender && a.scene === b.scene && a.outfit === b.outfit;
}
