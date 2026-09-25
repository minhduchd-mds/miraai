export interface PoseSkeletonPoint {
  x: number;
  y: number;
  visibility?: number;
}

interface Props {
  points: PoseSkeletonPoint[];
  active: boolean;
}

const CONNECTIONS: Array<[number, number]> = [
  [0,11],[0,12],[11,12],
  [11,13],[13,15],[12,14],[14,16],
  [11,23],[12,24],[23,24],
  [23,25],[25,27],[24,26],[26,28],
];

export default function PoseSkeletonOverlay({ points, active }: Props) {
  if (!active || points.length < 25) return null;
  const mapped = points.map((point) => ({
    x: (1 - Math.max(0, Math.min(1, point.x))) * 100,
    y: Math.max(0, Math.min(1, point.y)) * 100,
    visibility: Number.isFinite(point.visibility) ? Number(point.visibility) : 0.8,
  }));

  return (
    <svg className="v2-pose-skeleton" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <g className="v2-pose-bones">
        {CONNECTIONS.map(([a,b]) => {
          const p1 = mapped[a], p2 = mapped[b];
          if (!p1 || !p2 || Math.min(p1.visibility, p2.visibility) < 0.35) return null;
          return <line key={a + '-' + b} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />;
        })}
      </g>
      <g className="v2-pose-joints">
        {[0,11,12,13,14,15,16,23,24,25,26,27,28].map((index) => {
          const p = mapped[index];
          if (!p || p.visibility < 0.35) return null;
          return <circle key={index} cx={p.x} cy={p.y} r={index === 0 ? 1.35 : 1} />;
        })}
      </g>
    </svg>
  );
}
