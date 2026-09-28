import type { CSSProperties } from 'react';
import type { SpatialControlFrame } from '../core/vision/spatial-ui-control';
import type { SpatialDirectTouchState } from '../core/vision/spatial-anchor';
import type { SpatialPlacementPreview } from '../core/vision/spatial-world';

interface Props {
  frame: SpatialControlFrame;
  touch: SpatialDirectTouchState;
  placementPreview?: SpatialPlacementPreview | null;
  visible: boolean;
  feedback?: string;
}

export default function SpatialControlOverlay({ frame, touch, placementPreview = null, visible, feedback = '' }: Props) {
  if (!visible || frame.pointer.source === 'none') return null;

  const focus = frame.focus;
  return (
    <div className="v2-spatial-input-layer" aria-hidden="true">
      <div
        className={[
          'v2-spatial-pointer',
          `source-${frame.pointer.source}`,
          focus?.ready ? 'locked' : '',
          frame.grabbing ? 'grabbing' : '',
          touch.ready ? 'touching' : '',
          touch.phase === 'holding' ? 'holding' : '',
        ].filter(Boolean).join(' ')}
        style={{
          left: `${frame.pointer.x * 100}%`,
          top: `${frame.pointer.y * 100}%`,
        }}
      >
        <i />
        {focus?.ready && <span>{touch.ready ? `Chạm · ${touch.label}` : focus.label}</span>}
      </div>
      {touch.ready && (
        <div
          className={`v2-spatial-contact ${touch.phase}`}
          style={{
            left: `${touch.point.x * 100}%`,
            top: `${touch.point.y * 100}%`,
          }}
        ><i /></div>
      )}
      {placementPreview && (
        <div
          className={`v2-spatial-placement kind-${placementPreview.anchorKind}`}
          style={{ '--placement-strength': placementPreview.strength } as CSSProperties}
        >
          <i />
          <span>{placementPreview.constrained ? 'Mặt phẳng' : 'Neo'} · {placementPreview.anchorLabel}</span>
        </div>
      )}
      {feedback && <div className="v2-spatial-feedback">{feedback}</div>}
    </div>
  );
}
