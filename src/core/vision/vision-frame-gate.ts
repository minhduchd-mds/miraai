export interface VisionFrameMetadata {
  expectedDisplayTime?: number;
  presentedFrames?: number;
  mediaTime?: number;
}

/**
 * Reject repeated camera frames before entering synchronous MediaPipe inference.
 * requestVideoFrameCallback supplies presentedFrames; rAF fallback uses video.currentTime.
 * Unknown timestamps are permitted rather than permanently disabling older cameras.
 */
export class VisionVideoFrameGate {
  private lastPresentedFrames = 0;
  private lastMediaTime = -1;

  accept(metadata?: VisionFrameMetadata, currentTime?: number): boolean {
    const presented = metadata?.presentedFrames;
    if (typeof presented === 'number' && Number.isFinite(presented) && presented > 0) {
      if (presented <= this.lastPresentedFrames) return false;
      this.lastPresentedFrames = presented;
      return true;
    }
    const mediaTime = typeof metadata?.mediaTime === 'number' && Number.isFinite(metadata.mediaTime)
      ? metadata.mediaTime
      : currentTime;
    if (typeof mediaTime !== 'number' || !Number.isFinite(mediaTime) || mediaTime <= 0) {
      return true; // No reliable identity; let the governor bound the work.
    }
    if (mediaTime <= this.lastMediaTime) return false;
    this.lastMediaTime = mediaTime;
    return true;
  }

  reset(): void {
    this.lastPresentedFrames = 0;
    this.lastMediaTime = -1;
  }
}
