import type { TrackedObject } from '../core/vision/environment-model';

interface Props {
  objects: TrackedObject[];
  active: boolean;
}

function prettyLabel(label: string): string {
  return label
    .split(' ')
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : part)
    .join(' ');
}

export default function ObjectAwarenessOverlay({ objects, active }: Props) {
  if (!active || !objects.length) return null;

  return (
    <div className="v2-object-overlay" aria-hidden="true">
      {objects
        .filter((object) => object.stable && object.score >= 0.4)
        .slice(0, 6)
        .map((object) => {
          const left = (1 - (object.box.x + object.box.width)) * 100;
          const top = object.box.y * 100;
          const width = object.box.width * 100;
          const height = object.box.height * 100;
          return (
            <div
              key={object.id}
              className="v2-object-box"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${width}%`,
                height: `${height}%`,
              }}
            >
              <span>{prettyLabel(object.label)} · {Math.round(object.score * 100)}%</span>
            </div>
          );
        })}
    </div>
  );
}
