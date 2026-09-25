import type { SpatialSceneGraph } from '../core/vision/spatial-scene-graph';

interface Props {
  graph: SpatialSceneGraph;
  pointer: { x: number; y: number };
  active: boolean;
}

export default function SpatialSceneOverlay({ graph, pointer, active }: Props) {
  if (!active || !graph.focus) return null;

  const focus = graph.focus;
  const lineX1 = pointer.x * 100;
  const lineY1 = pointer.y * 100;
  const lineX2 = focus.centerX * 100;
  const lineY2 = focus.centerY * 100;

  return (
    <div className="v2-spatial-overlay" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1={lineX1} y1={lineY1} x2={lineX2} y2={lineY2} />
        <circle cx={lineX2} cy={lineY2} r="1.2" />
      </svg>
      <span
        className="v2-spatial-focus-label"
        style={{ left: `${lineX2}%`, top: `${lineY2}%` }}
      >
        TARGET · {focus.label}
      </span>
    </div>
  );
}
