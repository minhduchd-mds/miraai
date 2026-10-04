export type VisionCameraProfile = 'quality' | 'balanced' | 'battery';

export function selectCameraProfile(
  nav: any = typeof navigator === 'undefined' ? null : navigator,
): VisionCameraProfile {
  const ua = String(nav?.userAgent || '');
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const memory = Math.max(0, Number(nav?.deviceMemory || 0));
  const cores = Math.max(0, Number(nav?.hardwareConcurrency || 0));

  if (mobile || (memory > 0 && memory <= 4) || (cores > 0 && cores <= 4)) return 'battery';
  if ((memory >= 8 || memory === 0) && (cores >= 8 || cores === 0)) return 'quality';
  return 'balanced';
}

export function cameraConstraintsForProfile(profile: VisionCameraProfile) {
  if (profile === 'quality') {
    return {
      width: { ideal: 960 },
      height: { ideal: 540 },
      frameRate: { ideal: 30, max: 30 },
    };
  }
  if (profile === 'battery') {
    return {
      width: { ideal: 480 },
      height: { ideal: 360 },
      frameRate: { ideal: 24, max: 24 },
    };
  }
  return {
    width: { ideal: 640 },
    height: { ideal: 480 },
    frameRate: { ideal: 30, max: 30 },
  };
}
