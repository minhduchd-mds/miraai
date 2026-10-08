import type { PhotorealVisualQuality } from './photoreal-depth';
import type { PhotorealPerformanceTier } from './photoreal-depth-warp';

export type Spatial3DOverride = 'auto' | 'on' | 'off';

export function resolveSpatial3DOverride(search: string): Spatial3DOverride {
  // Read-only diagnostic switch, not user data; omitted in normal URLs.
  const match=/(?:^|[?&])spatial3d=(1|0)(?:&|$)/.exec(search);
  return match?.[1]==='1'?'on':match?.[1]==='0'?'off':'auto';
}

export function shouldUseSpatial3D({quality,performance,reducedMotion,saveData,viewportWidth,override}: {
  quality: PhotorealVisualQuality;
  performance: PhotorealPerformanceTier;
  reducedMotion: boolean;
  saveData: boolean;
  viewportWidth: number;
  override: Spatial3DOverride;
}): boolean {
  if(reducedMotion||saveData||quality==='lite'||performance!=='full'||override==='off')return false;
  return override==='on'||((quality==='high'||quality==='ultra')&&viewportWidth>=900);
}
