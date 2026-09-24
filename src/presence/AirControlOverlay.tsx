interface Props {
  visible: boolean;
  x: number;
  y: number;
  pinching: boolean;
  targetLabel?: string;
  feedback?: string;
  mode?: 'air' | 'grab' | 'transform';
  scale?: number;
  rotation?: number;
}

export default function AirControlOverlay({
  visible,
  x,
  y,
  pinching,
  targetLabel,
  feedback,
  mode = 'air',
  scale = 1,
  rotation = 0,
}: Props) {
  if (!visible) return null;

  return (
    <div className={`v2-air-layer mode-${mode}`} aria-hidden="true">
      <div
        className={`v2-air-cursor${pinching ? ' pinching' : ''}${targetLabel ? ' targeting' : ''}`}
        style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      >
        <i />
        {targetLabel && <span>{targetLabel}</span>}
      </div>
      <div className="v2-air-legend">
        <b>{mode === 'transform' ? 'Spatial Transform' : mode === 'grab' ? 'Grab & Move' : 'Air Control'}</b>
        {mode === 'transform' ? (
          <>
            <span>2 tay mở · scale / rotate</span>
            <span>{Math.round(scale * 100)}%</span>
            <span>{rotation >= 0 ? '+' : ''}{Math.round(rotation)}°</span>
          </>
        ) : (
          <>
            <span>Pinch · chọn / nắm</span>
            <span>↔ · theme</span>
            <span>✋ · dừng</span>
            <span>✌ · live voice</span>
          </>
        )}
      </div>
      {mode === 'transform' && (
        <div className="v2-spatial-meter">
          <span style={{ transform: `rotate(${rotation}deg) scaleX(${Math.max(.55, Math.min(1.45, scale))})` }} />
        </div>
      )}
      {feedback && <div className="v2-air-feedback">{feedback}</div>}
    </div>
  );
}
