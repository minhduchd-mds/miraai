import type { CSSProperties } from 'react';

export interface FaceLandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

export interface FaceMuscleActivation {
  brow: number;
  eyes: number;
  cheeks: number;
  mouth: number;
  jaw: number;
}

interface Props {
  points: FaceLandmarkPoint[];
  active: boolean;
  muscles: FaceMuscleActivation;
}

const PATHS = [
  [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109,10],
  [33,160,158,133,153,144,33],
  [362,385,387,263,373,380,362],
  [70,63,105,66,107],
  [336,296,334,293,300],
  [61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146,61],
] as const;

const MUSCLE_POINTS = {
  brow: [105, 334],
  eyes: [159, 386],
  cheeks: [50, 280],
  mouth: [13, 14],
  jaw: [152],
} as const;

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function faceBounds(points: FaceLandmarkPoint[]) {
  const xs = points.map((point) => clamp(point.x));
  const ys = points.map((point) => clamp(point.y));
  const minX = Math.max(0, Math.min(...xs) - 0.025);
  const maxX = Math.min(1, Math.max(...xs) + 0.025);
  const minY = Math.max(0, Math.min(...ys) - 0.035);
  const maxY = Math.min(1, Math.max(...ys) + 0.04);
  return {
    x: 1 - maxX,
    y: minY,
    width: Math.max(0.06, maxX - minX),
    height: Math.max(0.08, maxY - minY),
  };
}

export default function FaceMeshOverlay({ points, active, muscles }: Props) {
  if (!active || points.length < 100) return null;
  const bounds = faceBounds(points);
  const xy = (index: number) => {
    const point = points[index];
    return point ? String(1 - point.x) + ',' + String(point.y) : '';
  };

  return (
    <svg className="v2-face-mesh" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
      <g className="v2-face-lock">
        <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} rx="0.035" />
        <text x={bounds.x + 0.012} y={Math.max(0.045, bounds.y - 0.012)}>FACE LOCK</text>
      </g>
      <g className="v2-face-lines">
        {PATHS.map((path, index) => (
          <polyline key={index} points={path.map(xy).filter(Boolean).join(' ')} />
        ))}
      </g>
      <g className="v2-face-points">
        {points.filter((_, index) => index % 3 === 0).map((point, index) => (
          <circle key={index} cx={1 - point.x} cy={point.y} r="0.0027" />
        ))}
      </g>
      <g className="v2-face-muscle-map">
        {(Object.keys(MUSCLE_POINTS) as Array<keyof typeof MUSCLE_POINTS>).flatMap((region) =>
          MUSCLE_POINTS[region].map((index) => {
            const point = points[index];
            if (!point) return null;
            const level = clamp(muscles[region]);
            const style = { '--face-muscle': level.toFixed(3) } as CSSProperties;
            return (
              <circle
                key={region + '-' + index}
                className={'muscle-' + region}
                cx={1 - point.x}
                cy={point.y}
                r={0.012 + level * 0.024}
                style={style}
              />
            );
          }),
        )}
      </g>
    </svg>
  );
}
