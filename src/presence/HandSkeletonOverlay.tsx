import type { CSSProperties } from 'react';
import type { SpatialHandKinematicsState } from '../core/vision/spatial-hand-kinematics';
import type { SpatialHandContactState } from '../core/vision/spatial-hand-contact';
import type { SpatialHandIntentState } from '../core/vision/spatial-hand-intent';

export interface HandLandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

interface Props {
  points: HandLandmarkPoint[];
  active: boolean;
  kinematics?: SpatialHandKinematicsState | null;
  contact?: SpatialHandContactState | null;
  intent?: SpatialHandIntentState | null;
}

const CONNECTIONS: Array<[number, number]> = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17],
];

const PALM = [0, 5, 9, 13, 17];
const FINGERTIPS = new Set([4, 8, 12, 16, 20]);

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export default function HandSkeletonOverlay({
  points,
  active,
  kinematics = null,
  contact = null,
  intent = null,
}: Props) {
  if (!active || points.length < 21) return null;

  const raw = points.slice(0, 21).map((point) => ({
    x: (1 - clamp01(point.x)) * 100,
    y: clamp01(point.y) * 100,
    z: Number(point.z || 0),
  }));
  const zs = raw.map((point) => point.z);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const zSpan = Math.max(0.025, maxZ - minZ);
  const depthOf = (z: number) => clamp01((maxZ - z) / zSpan);
  const palmPoints = PALM.map((index) => raw[index].x + ',' + raw[index].y).join(' ');
  const primaryContact = contact?.contacts
    ?.filter((item) => item.targetId === contact.primaryTargetId)
    ?.sort((a, b) => b.pressure - a.pressure)[0] || null;

  return (
    <svg
      className={'v2-hand-skeleton depth-aware phase-' + (contact?.phase || 'away') + ' intent-' + (intent?.intent || 'none')}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden="true"
      data-hand-source={kinematics?.source || 'normalized'}
      data-hand-intent={intent?.intent || 'none'}
    >
      <defs>
        <filter id="mira-hand-soft-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="0.7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <polygon
        className="v2-hand-palm-surface"
        points={palmPoints}
        style={{
          '--palm-facing': String(kinematics?.palmFacingConfidence || 0),
          '--hand-stability': String(kinematics?.stability || 0),
        } as CSSProperties}
      />

      <g className="v2-hand-bones">
        {CONNECTIONS.map(([from, to]) => {
          const depth = (depthOf(raw[from].z) + depthOf(raw[to].z)) / 2;
          return (
            <line
              key={from + '-' + to}
              x1={raw[from].x}
              y1={raw[from].y}
              x2={raw[to].x}
              y2={raw[to].y}
              style={{ '--joint-depth': String(depth) } as CSSProperties}
            />
          );
        })}
      </g>

      <g className="v2-hand-joints">
        {raw.map((point, index) => {
          const depth = depthOf(point.z);
          const tip = FINGERTIPS.has(index);
          const radius = (index === 0 || index === 9 ? 1.55 : tip ? 1.45 : 1.05) * (0.78 + depth * 0.48);
          return (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={radius}
              data-joint={index}
              data-fingertip={tip ? 'true' : 'false'}
              style={{
                '--joint-depth': String(depth),
                '--joint-opacity': String(0.38 + depth * 0.58),
              } as CSSProperties}
            />
          );
        })}
      </g>

      <g className="v2-hand-fingertip-halos" filter="url(#mira-hand-soft-glow)">
        {[4, 8, 12, 16, 20].map((index) => {
          const depth = depthOf(raw[index].z);
          return (
            <circle
              key={index}
              cx={raw[index].x}
              cy={raw[index].y}
              r={2.2 + depth * 1.1}
              data-fingertip={index}
              style={{ '--joint-depth': String(depth) } as CSSProperties}
            />
          );
        })}
      </g>

      {primaryContact && (
        <g
          className={'v2-hand-contact-marker phase-' + primaryContact.phase}
          style={{ '--contact-pressure': String(primaryContact.pressure) } as CSSProperties}
        >
          <circle
            cx={clamp01(primaryContact.point.x) * 100}
            cy={clamp01(primaryContact.point.y) * 100}
            r={3.8 + primaryContact.pressure * 2.8}
          />
          <circle
            className="contact-core"
            cx={clamp01(primaryContact.point.x) * 100}
            cy={clamp01(primaryContact.point.y) * 100}
            r={1.2 + primaryContact.pressure * 1.4}
          />
        </g>
      )}
    </svg>
  );
}