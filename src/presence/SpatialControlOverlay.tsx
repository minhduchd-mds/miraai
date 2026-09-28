import type { SpatialControlFrame } from '../core/vision/spatial-ui-control';

interface Props {
  frame: SpatialControlFrame;
  visible: boolean;
  feedback?: string;
}

export default function SpatialControlOverlay({ frame, visible, feedback = '' }: Props) {
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
        ].filter(Boolean).join(' ')}
        style={{
          left: `${frame.pointer.x * 100}%`,
          top: `${frame.pointer.y * 100}%`,
        }}
      >
        <i />
        {focus?.ready && <span>{focus.label}</span>}
      </div>
      {feedback && <div className="v2-spatial-feedback">{feedback}</div>}
    </div>
  );
}
