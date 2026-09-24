interface Props {
  visible: boolean;
  x: number;
  y: number;
  pinching: boolean;
  targetLabel?: string;
  feedback?: string;
}

export default function AirControlOverlay({ visible, x, y, pinching, targetLabel, feedback }: Props) {
  if (!visible) return null;

  return (
    <div className="v2-air-layer" aria-hidden="true">
      <div
        className={`v2-air-cursor${pinching ? ' pinching' : ''}${targetLabel ? ' targeting' : ''}`}
        style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      >
        <i />
        {targetLabel && <span>{targetLabel}</span>}
      </div>
      <div className="v2-air-legend">
        <b>Air Control</b>
        <span>Pinch · chọn / nắm</span>
        <span>↔ · theme</span>
        <span>✋ · dừng</span>
        <span>✌ · live voice</span>
      </div>
      {feedback && <div className="v2-air-feedback">{feedback}</div>}
    </div>
  );
}
