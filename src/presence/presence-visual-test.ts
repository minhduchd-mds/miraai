import type { MiraPresenceScene } from './presence-scene';

const VISUAL_TEST_SCENES = new Set<MiraPresenceScene>([
  'daytime',
  'welcome-home',
  'home-evening',
  'bedtime',
]);

export function visualTestPresenceScene(search: string): MiraPresenceScene | null {
  try {
    const params = new URLSearchParams(search || '');
    if (params.get('visual-test') !== '1') return null;
    const scene = params.get('scene') as MiraPresenceScene | null;
    return scene && VISUAL_TEST_SCENES.has(scene) ? scene : null;
  } catch {
    return null;
  }
}
