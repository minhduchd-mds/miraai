import type { SpatialControlFrame } from '../core/vision/spatial-ui-control';
import type { SpatialDirectTouchState } from '../core/vision/spatial-anchor';

interface Props {
  frame: SpatialControlFrame;
  touch: SpatialDirectTouchState;
  visible: boolean;
  feedback?: string;
}

export default function SpatialControlOverlay({ frame, touch, visible, feedback = '' }: Props) {
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
      {feedback && <div className="v2-spatial-feedback">{feedback}</div>}
    </div>
  );
}
