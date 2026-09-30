import type { CSSProperties } from 'react';
import {
  MIRA_BEDROOM_SEGMENTS,
  sceneSegmentPolygon,
} from './photoreal-scene-segmentation';

interface Props {
  src: string;
  className?: string;
}

export default function PhotorealSceneSegments({
  src,
  className = '',
}: Props) {
  return (
    <span
      className={`pm-scene-segments ${className}`.trim()}
      data-segment-count={MIRA_BEDROOM_SEGMENTS.length}
      aria-hidden="true"
    >
      {MIRA_BEDROOM_SEGMENTS.map((segment) => (
        <img
          key={segment.id}
          className={`pm-scene-segment pm-scene-segment-${segment.id}`}
          data-segment={segment.id}
          data-depth-rank={segment.depthRank.toFixed(2)}
          src={src}
          alt=""
          draggable={false}
          decoding="async"
          style={{
            clipPath: sceneSegmentPolygon(segment),
            WebkitClipPath: sceneSegmentPolygon(segment),
            transformOrigin: segment.transformOrigin,
            '--pm-segment-opacity': segment.opacity,
          } as CSSProperties}
        />
      ))}
    </span>
  );
}
