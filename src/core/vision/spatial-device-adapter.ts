export type SpatialDeviceMode = 'webcam-relative' | 'webxr-metric';

export interface SpatialDeviceCapabilities {
  mode: SpatialDeviceMode;
  handTracking: boolean;
  worldSpace: boolean;
  hitTest: boolean;
  anchors: boolean;
  depth: boolean;
  metric: boolean;
}

export interface SpatialDevicePoint {
  x: number;
  y: number;
  z: number;
  confidence: number;
  space: 'relative' | 'metric';
}

const WEBCAM_CAPABILITIES: SpatialDeviceCapabilities = {
  mode: 'webcam-relative',
  handTracking: true,
  worldSpace: false,
  hitTest: false,
  anchors: false,
  depth: false,
  metric: false,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

export class SpatialDeviceAdapterRuntime {
  private capabilities: SpatialDeviceCapabilities = { ...WEBCAM_CAPABILITIES };

  snapshot(): SpatialDeviceCapabilities {
    return { ...this.capabilities };
  }

  useWebcamFallback(): SpatialDeviceCapabilities {
    this.capabilities = { ...WEBCAM_CAPABILITIES };
    return this.snapshot();
  }

  async detectWebXR(environment: any = globalThis): Promise<SpatialDeviceCapabilities> {
    try {
      const xr = environment?.navigator?.xr;
      if (!xr || typeof xr.isSessionSupported !== 'function') return this.useWebcamFallback();
      const immersiveAr = await xr.isSessionSupported('immersive-ar');
      if (!immersiveAr) return this.useWebcamFallback();

      this.capabilities = {
        mode: 'webxr-metric',
        handTracking: true,
        worldSpace: true,
        hitTest: true,
        anchors: true,
        depth: true,
        metric: true,
      };
      return this.snapshot();
    } catch {
      return this.useWebcamFallback();
    }
  }

  webcamPoint(input: { x: number; y: number; z?: number; confidence?: number }): SpatialDevicePoint {
    return {
      x: clamp(Number(input.x), 0, 1),
      y: clamp(Number(input.y), 0, 1),
      z: clamp(Number(input.z || 0), -1, 1),
      confidence: clamp(Number(input.confidence ?? 1), 0, 1),
      space: 'relative',
    };
  }

  metricPoint(input: { x: number; y: number; z: number; confidence?: number }): SpatialDevicePoint | null {
    if (!this.capabilities.metric || !this.capabilities.worldSpace) return null;
    return {
      x: clamp(Number(input.x), -20, 20),
      y: clamp(Number(input.y), -20, 20),
      z: clamp(Number(input.z), -20, 20),
      confidence: clamp(Number(input.confidence ?? 1), 0, 1),
      space: 'metric',
    };
  }
}
