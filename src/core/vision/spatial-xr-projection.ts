export interface XRProjectionView {
  eye: string;
  projectionMatrix: number[];
  viewMatrix: number[];
}

export interface XRMetricPoint {
  x: number;
  y: number;
  z: number;
}

export interface XRProjectedPoint {
  x: number;
  y: number;
  ndcX: number;
  ndcY: number;
  depth: number;
  visible: boolean;
  confidence: number;
}

export interface XRProjectionCalibration {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
}

const DEFAULT_CALIBRATION: XRProjectionCalibration = {
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

function mulMat4Vec4(matrix: number[], vector: [number, number, number, number]): [number, number, number, number] {
  if (matrix.length < 16) return [0, 0, 0, 0];
  return [
    matrix[0] * vector[0] + matrix[4] * vector[1] + matrix[8] * vector[2] + matrix[12] * vector[3],
    matrix[1] * vector[0] + matrix[5] * vector[1] + matrix[9] * vector[2] + matrix[13] * vector[3],
    matrix[2] * vector[0] + matrix[6] * vector[1] + matrix[10] * vector[2] + matrix[14] * vector[3],
    matrix[3] * vector[0] + matrix[7] * vector[1] + matrix[11] * vector[2] + matrix[15] * vector[3],
  ];
}

export function projectMetricPointToView(
  point: XRMetricPoint,
  view: XRProjectionView,
): XRProjectedPoint | null {
  const camera = mulMat4Vec4(view.viewMatrix, [point.x, point.y, point.z, 1]);
  const clip = mulMat4Vec4(view.projectionMatrix, camera);
  const w = clip[3];
  if (!Number.isFinite(w) || Math.abs(w) < 1e-6 || w <= 0) return null;

  const ndcX = clip[0] / w;
  const ndcY = clip[1] / w;
  const ndcZ = clip[2] / w;
  if (![ndcX, ndcY, ndcZ].every(Number.isFinite)) return null;

  const x = (ndcX + 1) / 2;
  const y = (1 - ndcY) / 2;
  const visible = ndcX >= -1.12 && ndcX <= 1.12 &&
    ndcY >= -1.12 && ndcY <= 1.12 &&
    ndcZ >= -1.2 && ndcZ <= 1.2;

  return {
    x,
    y,
    ndcX,
    ndcY,
    depth: camera[2],
    visible,
    confidence: visible ? 1 : 0.35,
  };
}

export function projectMetricPointAcrossViews(
  point: XRMetricPoint,
  views: XRProjectionView[],
): XRProjectedPoint | null {
  const projected = views
    .map((view) => projectMetricPointToView(point, view))
    .filter(Boolean) as XRProjectedPoint[];
  if (!projected.length) return null;

  const visible = projected.filter((sample) => sample.visible);
  const samples = visible.length ? visible : projected;
  const count = samples.length;
  return {
    x: samples.reduce((sum, sample) => sum + sample.x, 0) / count,
    y: samples.reduce((sum, sample) => sum + sample.y, 0) / count,
    ndcX: samples.reduce((sum, sample) => sum + sample.ndcX, 0) / count,
    ndcY: samples.reduce((sum, sample) => sum + sample.ndcY, 0) / count,
    depth: samples.reduce((sum, sample) => sum + sample.depth, 0) / count,
    visible: visible.length > 0,
    confidence: clamp(visible.length / Math.max(1, views.length), 0.35, 1),
  };
}

/**
 * Session-only XR-to-DOM calibration. The projection matrices remain the
 * authoritative perspective transform; calibration only corrects DOM overlay
 * offset/scale and never invents metric depth.
 */
export class SpatialXRProjectionRuntime {
  private calibration: XRProjectionCalibration = { ...DEFAULT_CALIBRATION };
  private smoothed: XRProjectedPoint | null = null;

  setCalibration(input: Partial<XRProjectionCalibration>): XRProjectionCalibration {
    this.calibration = {
      offsetX: clamp(Number(input.offsetX ?? this.calibration.offsetX), -0.25, 0.25),
      offsetY: clamp(Number(input.offsetY ?? this.calibration.offsetY), -0.25, 0.25),
      scaleX: clamp(Number(input.scaleX ?? this.calibration.scaleX), 0.65, 1.35),
      scaleY: clamp(Number(input.scaleY ?? this.calibration.scaleY), 0.65, 1.35),
    };
    return this.snapshotCalibration();
  }

  calibrateCenter(projected: { x: number; y: number }): XRProjectionCalibration {
    return this.setCalibration({
      offsetX: 0.5 - projected.x,
      offsetY: 0.5 - projected.y,
    });
  }

  project(point: XRMetricPoint, views: XRProjectionView[], smoothAlpha = 0.42): XRProjectedPoint | null {
    const raw = projectMetricPointAcrossViews(point, views);
    if (!raw) return null;

    const calibrated = {
      ...raw,
      x: clamp((raw.x - 0.5) * this.calibration.scaleX + 0.5 + this.calibration.offsetX, 0, 1),
      y: clamp((raw.y - 0.5) * this.calibration.scaleY + 0.5 + this.calibration.offsetY, 0, 1),
    };

    if (!this.smoothed) {
      this.smoothed = calibrated;
      return { ...calibrated };
    }

    const alpha = clamp(smoothAlpha, 0, 1);
    this.smoothed = {
      ...calibrated,
      x: this.smoothed.x + (calibrated.x - this.smoothed.x) * alpha,
      y: this.smoothed.y + (calibrated.y - this.smoothed.y) * alpha,
      depth: this.smoothed.depth + (calibrated.depth - this.smoothed.depth) * alpha,
    };
    return { ...this.smoothed };
  }

  snapshotCalibration(): XRProjectionCalibration {
    return { ...this.calibration };
  }

  reset(): void {
    this.calibration = { ...DEFAULT_CALIBRATION };
    this.smoothed = null;
  }
}
