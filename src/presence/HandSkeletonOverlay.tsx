export interface HandLandmarkPoint {
  x: number;
  y: number;
}

interface Props {
  points: HandLandmarkPoint[];
  active: boolean;
}

const CONNECTIONS: Array<[number, number]> = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17],
];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export default function HandSkeletonOverlay({ points, active }: Props) {
  if (!active || points.length < 21) return null;

  const p = points.slice(0, 21).map((point) => ({
    x: (1 - clamp01(point.x)) * 100,
    y: clamp01(point.y) * 100,
  }));

  return (
    <svg
      className="v2-hand-skeleton"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g className="v2-hand-bones">
        {CONNECTIONS.map(([from, to]) => (
          <line
            key={`${from}-${to}`}
            x1={p[from].x}
            y1={p[from].y}
            x2={p[to].x}
            y2={p[to].y}
          />
        ))}
      </g>
      <g className="v2-hand-joints">
        {p.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={index === 0 || index === 9 ? 1.8 : 1.25}
            data-joint={index}
          />
        ))}
      </g>
    </svg>
  );
}
