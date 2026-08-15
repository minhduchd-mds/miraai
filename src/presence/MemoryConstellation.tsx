import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import type { MiraState } from '../core/types';
import {
  CONSTELLATIONS,
  getConstellation,
  scoreConstellations,
  type ConstellationDefinition,
  type ConstellationId,
} from './memory-constellation';
import './holographic-mira-constellation.css';

interface Props {
  state: MiraState;
  contextText: string;
}

function edgeStyle(definition: ConstellationDefinition, edge: [number, number]): CSSProperties {
  const from = definition.points[edge[0]];
  const to = definition.points[edge[1]];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return {
    left: `${from.x}%`,
    top: `${from.y}%`,
    width: `${length}%`,
    transform: `rotate(${angle}deg)`,
  };
}

function threadStyle(fromId: ConstellationId, toId: ConstellationId): CSSProperties {
  const from = getConstellation(fromId);
  const to = getConstellation(toId);
  const fromX = from.x + 9;
  const fromY = from.y + 7;
  const toX = to.x + 9;
  const toY = to.y + 7;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return {
    left: `${fromX}%`,
    top: `${fromY}%`,
    width: `${length}%`,
    transform: `rotate(${angle}deg)`,
  };
}

export default function MemoryConstellation({ state, contextText }: Props) {
  const scored = useMemo(() => scoreConstellations(contextText), [contextText]);
  const active = useMemo(() => {
    if (scored.length) return scored;
    if (state === 'thinking') return [{ id: 'memory' as const, score: 0.28 }];
    if (state === 'speaking') return [{ id: 'mira' as const, score: 0.24 }];
    return [];
  }, [scored, state]);
  const scoreMap = useMemo(() => new Map(active.map((item) => [item.id, item.score])), [active]);
  const threads = useMemo(() => {
    if (active.length < 2) return [];
    return active.slice(1).map((item, index) => ({
      id: `${active[0].id}-${item.id}-${index}`,
      from: active[0].id,
      to: item.id,
    }));
  }, [active]);

  return (
    <span
      className={`hm-memory-constellation state-${state}${active.length ? ' has-active-memory' : ''}`}
      aria-hidden="true"
    >
      <span className="hm-memory-threads">
        {threads.map((thread) => (
          <i key={thread.id} style={threadStyle(thread.from, thread.to)} />
        ))}
      </span>

      {CONSTELLATIONS.map((definition) => {
        const score = scoreMap.get(definition.id) ?? 0;
        const style = {
          left: `${definition.x}%`,
          top: `${definition.y}%`,
          '--mc-score': score.toFixed(3),
        } as CSSProperties;

        return (
          <span
            key={definition.id}
            className={`hm-constellation constellation-${definition.id}${score > 0 ? ' is-active' : ''}`}
            style={style}
            data-memory-topic={definition.id}
          >
            <span className="hm-constellation-lines">
              {definition.edges.map((edge, index) => (
                <i key={`${definition.id}-edge-${index}`} style={edgeStyle(definition, edge)} />
              ))}
            </span>
            <span className="hm-constellation-stars">
              {definition.points.map((point, index) => (
                <i
                  key={`${definition.id}-star-${index}`}
                  className={point.size && point.size > 1.2 ? 'major' : undefined}
                  style={{
                    left: `${point.x}%`,
                    top: `${point.y}%`,
                    transform: `scale(${point.size ?? 1})`,
                  }}
                />
              ))}
            </span>
            <span className="hm-constellation-label">{definition.label}</span>
            <span className="hm-constellation-core" />
          </span>
        );
      })}
    </span>
  );
}
