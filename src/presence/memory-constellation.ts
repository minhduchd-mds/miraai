export type ConstellationId = 'owner' | 'mira' | 'soi' | 'design' | 'voice' | 'memory';

export interface ConstellationPoint {
  x: number;
  y: number;
  size?: number;
}

export interface ConstellationDefinition {
  id: ConstellationId;
  label: string;
  x: number;
  y: number;
  keywords: string[];
  points: ConstellationPoint[];
  edges: Array<[number, number]>;
}

export interface ConstellationScore {
  id: ConstellationId;
  score: number;
}

export const CONSTELLATIONS: ConstellationDefinition[] = [
  {
    id: 'owner',
    label: 'Đỗ Minh Đức',
    x: 13,
    y: 22,
    keywords: ['do minh duc', 'minh duc', 'chu so huu mira', 'nguoi phat trien mira', 'owner mira'],
    points: [
      { x: 12, y: 34, size: 1.2 }, { x: 30, y: 18 }, { x: 48, y: 42, size: 1.4 },
      { x: 67, y: 26 }, { x: 84, y: 48, size: 1.1 }, { x: 58, y: 72 }, { x: 28, y: 70 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [6, 0]],
  },
  {
    id: 'mira',
    label: 'Mira',
    x: 76,
    y: 18,
    keywords: ['mira', 'mira companion', 'voice companion', 'tro ly mira', 'ai companion'],
    points: [
      { x: 13, y: 50 }, { x: 29, y: 21, size: 1.3 }, { x: 49, y: 35 },
      { x: 68, y: 16 }, { x: 85, y: 43, size: 1.35 }, { x: 72, y: 73 }, { x: 40, y: 68 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 2]],
  },
  {
    id: 'soi',
    label: 'Soi',
    x: 8,
    y: 47,
    keywords: ['soi', 'design qa', 'design qa agent', 'ui auditor', 'audit ui', 'audit ux', 'visual qa'],
    points: [
      { x: 12, y: 24 }, { x: 31, y: 38, size: 1.3 }, { x: 51, y: 18 },
      { x: 73, y: 31 }, { x: 87, y: 57, size: 1.3 }, { x: 61, y: 72 }, { x: 29, y: 66 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1]],
  },
  {
    id: 'design',
    label: 'UI · UX',
    x: 79,
    y: 45,
    keywords: ['ui ux', 'ui/ux', 'user experience', 'giao dien', 'thiet ke', 'design system', 'figma', 'ux', 'ui design'],
    points: [
      { x: 10, y: 47 }, { x: 26, y: 19, size: 1.25 }, { x: 45, y: 35 },
      { x: 62, y: 17 }, { x: 84, y: 34, size: 1.4 }, { x: 77, y: 67 }, { x: 49, y: 76 }, { x: 25, y: 66 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [2, 6]],
  },
  {
    id: 'voice',
    label: 'Voice AI',
    x: 15,
    y: 72,
    keywords: ['voice ai', 'giong noi', 'nhan giong noi', 'am thanh', 'microphone', 'micro', 'tts', 'stt', 'speech', 'audio level', 'speech to text', 'text to speech'],
    points: [
      { x: 9, y: 55 }, { x: 24, y: 29 }, { x: 42, y: 48, size: 1.35 },
      { x: 57, y: 19 }, { x: 74, y: 39 }, { x: 89, y: 21 }, { x: 80, y: 68, size: 1.3 }, { x: 47, y: 76 }, { x: 22, y: 72 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [4, 6], [6, 7], [7, 8], [8, 0]],
  },
  {
    id: 'memory',
    label: 'Memory',
    x: 73,
    y: 72,
    keywords: ['memory', 'ky uc', 'ghi nho', 'bo nho', 'nho lai', 'lich su hoi thoai', 'memory constellation', 'constellation', 'ky niem'],
    points: [
      { x: 12, y: 37 }, { x: 28, y: 16 }, { x: 44, y: 41, size: 1.35 },
      { x: 61, y: 23 }, { x: 83, y: 31 }, { x: 88, y: 64, size: 1.25 }, { x: 62, y: 76 }, { x: 39, y: 63 }, { x: 19, y: 75 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 0], [2, 7]],
  },
];

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function scoreConstellations(input: string): ConstellationScore[] {
  const text = normalize(input);
  if (!text) return [];

  return CONSTELLATIONS
    .map((definition) => {
      let raw = 0;
      for (const keyword of definition.keywords) {
        const normalizedKeyword = normalize(keyword);
        if (!normalizedKeyword || !text.includes(normalizedKeyword)) continue;
        raw += normalizedKeyword.includes(' ') ? 1.4 : 1;
      }
      return { id: definition.id, score: Math.min(1, raw / 2.5) };
    })
    .filter((item) => item.score >= 0.18)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

export function getConstellation(id: ConstellationId): ConstellationDefinition {
  return CONSTELLATIONS.find((definition) => definition.id === id) ?? CONSTELLATIONS[1];
}
