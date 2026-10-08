import type { CSSProperties } from 'react';
import type { SpatialTargetGeometry } from '../core/vision/spatial-ui-control';
import type { SpatialObjectPose, SpatialObjectState } from '../core/vision/spatial-object';
import type { XRBimanualTransform } from '../core/vision/spatial-xr-bimanual';
import type { XRSurfaceProbe } from '../core/vision/spatial-xr-surface';
import type { SpatialWorldAnchor } from '../core/vision/spatial-world';

export type SpatialWindowId = 'result' | 'camera';

export interface SpatialWindowTransform {
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
}

export interface SpatialGrabSession {
  id: SpatialWindowId;
  start: { x: number; y: number; z: number };
  base: SpatialWindowTransform;
}

export interface TwoHandSpatialSession {
  id: SpatialWindowId;
  since: number;
  active: boolean;
  startDistance: number;
  startAngle: number;
  baseScale: number;
  baseRotation: number;
}

export const DEFAULT_SPATIAL_WINDOWS: Record<SpatialWindowId, SpatialWindowTransform> = {
  result: { x: 0, y: 0, z: 0, scale: 1, rotation: 0 },
  camera: { x: 0, y: 0, z: 0, scale: 1, rotation: 0 },
};

export function clampSpatial(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}

export function spatialWindowStyle(
  transform: SpatialWindowTransform,
  xrDepthScale = 1,
  xrBimanual?: XRBimanualTransform | null,
): CSSProperties {
  return {
    '--spatial-x': `${transform.x}px`,
    '--spatial-y': `${transform.y}px`,
    '--spatial-z': `${transform.z}px`,
    '--spatial-scale': String(transform.scale),
    '--spatial-rotation': `${transform.rotation}deg`,
    '--xr-window-depth-scale': String(clampSpatial(xrDepthScale, 0.72, 1.42)),
    '--xr-window-bimanual-scale': String(clampSpatial(xrBimanual?.scaleRatio || 1, 0.58, 1.72)),
    '--xr-window-yaw': `${clampSpatial(xrBimanual?.yawDeg || 0, -72, 72)}deg`,
    '--xr-window-pitch': `${clampSpatial(xrBimanual?.pitchDeg || 0, -58, 58)}deg`,
    '--xr-window-roll': `${clampSpatial(xrBimanual?.rollDeg || 0, -95, 95)}deg`,
  } as CSSProperties;
}

export function setXRWindowSurfaceState(id: SpatialWindowId, probe: XRSurfaceProbe | null): void {
  if (typeof document === 'undefined') return;
  const element = document.querySelector<HTMLElement>(`[data-spatial-window="${id}"]`);
  if (!element) return;
  const state = probe?.occluded
    ? 'occluded'
    : probe?.touchingSurface
      ? 'touch'
      : probe?.nearSurface
        ? 'near'
        : 'clear';
  element.dataset.xrSurface = state;
  if (probe?.occluded) element.setAttribute('data-xr-occluded', 'true');
  else element.removeAttribute('data-xr-occluded');
}

export function collectSpatialTargets(): SpatialTargetGeometry[] {
  if (typeof document === 'undefined' || typeof window === 'undefined') return [];
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const targets: SpatialTargetGeometry[] = [];

  const push = (element: HTMLElement, id: string, label: string, kind: 'action' | 'window' | 'object', priority: number) => {
    if (!id || !label || element.offsetParent === null ||
        element.closest('[inert],[aria-hidden="true"],[disabled]')) return;
    const style = window.getComputedStyle(element);
    if (style.visibility === 'hidden' || style.pointerEvents === 'none') return;
    const rect = element.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2 ||
        rect.right <= 0 || rect.bottom <= 0 || rect.left >= width || rect.top >= height) return;
    targets.push({
      id,
      label,
      kind,
      left: clampSpatial(rect.left / width, 0, 1),
      top: clampSpatial(rect.top / height, 0, 1),
      right: clampSpatial(rect.right / width, 0, 1),
      bottom: clampSpatial(rect.bottom / height, 0, 1),
      z: Number.isFinite(Number(element.dataset.spatialDepth))
        ? Number(element.dataset.spatialDepth)
        : undefined,
      depthRadius: Number.isFinite(Number(element.dataset.spatialDepthRadius))
        ? Number(element.dataset.spatialDepthRadius)
        : undefined,
      priority,
    });
  };

  document.querySelectorAll<HTMLElement>('[data-spatial-action]').forEach((element) => {
    if (element.hasAttribute('disabled')) return;
    push(
      element,
      String(element.dataset.spatialAction || ''),
      String(element.dataset.spatialLabel || element.getAttribute('aria-label') || element.title || 'Điều khiển'),
      'action',
      0.14,
    );
  });

  document.querySelectorAll<HTMLElement>('[data-spatial-grab-handle]').forEach((element) => {
    push(
      element,
      String(element.dataset.spatialGrabHandle || ''),
      String(element.dataset.spatialLabel || 'Di chuyển cửa sổ'),
      'window',
      0.08,
    );
  });

  document.querySelectorAll<HTMLElement>('[data-spatial-object]').forEach((element) => {
    push(
      element,
      String(element.dataset.spatialObject || ''),
      String(element.dataset.spatialLabel || 'Vật thể không gian'),
      'object',
      0.18,
    );
  });

  return targets;
}

export function spatialActionElement(id: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return Array.from(document.querySelectorAll<HTMLElement>('[data-spatial-action]'))
    .find((element) => element.dataset.spatialAction === id) || null;
}

export function spatialWindowAvailable(id: string): id is SpatialWindowId {
  if (id !== 'result' && id !== 'camera') return false;
  return typeof document !== 'undefined' &&
    Boolean(Array.from(document.querySelectorAll<HTMLElement>('[data-spatial-grab-handle]'))
      .find((element) => element.dataset.spatialGrabHandle === id && element.offsetParent !== null));
}

export function spatialObjectAvailable(id: string): boolean {
  return typeof document !== 'undefined' &&
    Boolean(Array.from(document.querySelectorAll<HTMLElement>('[data-spatial-object]'))
      .find((element) => element.dataset.spatialObject === id && element.offsetParent !== null));
}

export function spatialPoseStyle(pose: SpatialObjectPose | null | undefined): CSSProperties {
  return {
    '--spatial-object-x': `${(pose?.position.x || 0) * 100}vw`,
    '--spatial-object-y': `${(pose?.position.y || 0) * 100}vh`,
    '--spatial-object-z': `${(pose?.position.z || 0) * 180}px`,
    '--spatial-object-scale': String(pose?.scale || 1),
    '--spatial-object-rotation': `${pose?.rotation || 0}deg`,
  } as CSSProperties;
}

export function spatialObjectStyle(
  object: SpatialObjectState | null,
  xrDepthScale = 1,
  xrBimanual?: XRBimanualTransform | null,
): CSSProperties {
  return {
    ...spatialPoseStyle(object?.pose),
    '--xr-depth-scale': String(clampSpatial(xrDepthScale, 0.72, 1.42)),
    '--xr-bimanual-scale': String(clampSpatial(xrBimanual?.scaleRatio || 1, 0.58, 1.72)),
    '--xr-bimanual-yaw': `${clampSpatial(xrBimanual?.yawDeg || 0, -72, 72)}deg`,
    '--xr-bimanual-pitch': `${clampSpatial(xrBimanual?.pitchDeg || 0, -58, 58)}deg`,
    '--xr-bimanual-roll': `${clampSpatial(xrBimanual?.rollDeg || 0, -95, 95)}deg`,
  } as CSSProperties;
}

export function collectSpatialWorldAnchors(objects: SpatialObjectState[]): SpatialWorldAnchor[] {
  const identityPose = { position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: 0 };
  const anchors: SpatialWorldAnchor[] = [{
    id: 'workspace.root',
    label: 'Không gian Mira',
    kind: 'workspace',
    pose: identityPose,
    snapRadius: 0.025,
    priority: -1,
  }, {
    id: 'dock.home',
    label: 'Vị trí Mira Core',
    kind: 'dock',
    parentId: 'workspace.root',
    pose: identityPose,
    snapRadius: 0.13,
    priority: 0.35,
    acceptsObjectId: 'mira.core',
  }, {
    id: 'dock.node.home',
    label: 'Vị trí Mira Node',
    kind: 'dock',
    parentId: 'workspace.root',
    pose: {
      position: { x: -0.105, y: -0.085, z: 0.035 },
      scale: 1,
      rotation: 0,
    },
    snapRadius: 0.12,
    priority: 0.32,
    acceptsObjectId: 'mira.node',
  }];

  if (!objects.length || typeof document === 'undefined' || typeof window === 'undefined') return anchors;
  const primary = objects[0];
  const element = Array.from(document.querySelectorAll<HTMLElement>('[data-spatial-object]'))
    .find((node) => node.dataset.spatialObject === primary.id && node.offsetParent !== null);
  if (!element) return anchors;

  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  const rect = element.getBoundingClientRect();
  const objectScreen = {
    x: (rect.left + rect.right) / 2 / width,
    y: (rect.top + rect.bottom) / 2 / height,
  };

  const poseForScreenPoint = (x: number, y: number, z = primary.pose.position.z) => ({
    position: {
      x: clampSpatial(primary.pose.position.x + (x - objectScreen.x), -0.48, 0.48),
      y: clampSpatial(primary.pose.position.y + (y - objectScreen.y), -0.48, 0.48),
      z: clampSpatial(z, -0.7, 0.7),
    },
    scale: 1,
    rotation: 0,
  });

  objects.forEach((object) => {
    anchors.push({
      id: `object.${object.id}`,
      label: object.label,
      kind: 'object',
      parentId: 'workspace.root',
      pose: object.pose,
      snapRadius: 0.14,
      priority: 0.45,
      ownerObjectId: object.id,
    }, {
      id: `stack.${object.id}`,
      label: `Xếp trên ${object.label}`,
      kind: 'dock',
      parentId: `object.${object.id}`,
      pose: {
        position: {
          x: 0,
          y: -(object.collisionRadius * 2.05),
          z: object.collisionRadius * 0.55,
        },
        scale: 1,
        rotation: 0,
      },
      snapRadius: Math.max(0.08, object.collisionRadius * 2.35),
      priority: 0.58,
      ownerObjectId: object.id,
    }, {
      id: `slide.${object.id}`,
      label: `Trượt cạnh ${object.label}`,
      kind: 'dock',
      parentId: `object.${object.id}`,
      pose: {
        position: {
          x: object.collisionRadius * 2.35,
          y: 0,
          z: object.collisionRadius * 0.2,
        },
        scale: 1,
        rotation: 0,
      },
      snapRadius: Math.max(0.075, object.collisionRadius * 2.05),
      priority: 0.54,
      ownerObjectId: object.id,
    });
  });

  anchors.push({
    id: 'dock.center',
    label: 'Trung tâm không gian',
    kind: 'dock',
    parentId: 'workspace.root',
    pose: poseForScreenPoint(0.5, 0.5),
    snapRadius: 0.12,
    priority: 0.2,
  });

  document.querySelectorAll<HTMLElement>('[data-spatial-window]').forEach((windowElement) => {
    if (windowElement.offsetParent === null) return;
    const id = String(windowElement.dataset.spatialWindow || '');
    if (!id) return;
    const windowRect = windowElement.getBoundingClientRect();
    const cx = (windowRect.left + windowRect.right) / 2 / width;
    const cy = (windowRect.top + windowRect.bottom) / 2 / height;
    const handle = Array.from(document.querySelectorAll<HTMLElement>('[data-spatial-grab-handle]'))
      .find((node) => node.dataset.spatialGrabHandle === id);
    const surfaceZ = clampSpatial(Number(handle?.dataset.spatialDepth || primary.pose.position.z), -0.7, 0.7);
    const surfaceId = `surface.${id}`;

    anchors.push({
      id: surfaceId,
      label: id === 'camera' ? 'Mặt phẳng Camera' : 'Mặt phẳng Kết quả',
      kind: 'surface',
      parentId: 'workspace.root',
      pose: poseForScreenPoint(cx, cy, surfaceZ),
      snapRadius: 0.12,
      priority: -0.15,
      constraint: {
        axis: 'xy',
        halfExtents: {
          x: clampSpatial(windowRect.width / width / 2, 0.05, 0.45),
          y: clampSpatial(windowRect.height / height / 2, 0.04, 0.45),
          z: 0.04,
        },
        offset: 0,
      },
    }, {
      id: `dock.${id}`,
      label: id === 'camera' ? 'Neo cạnh Camera' : 'Neo cạnh Kết quả',
      kind: 'dock',
      parentId: surfaceId,
      pose: {
        position: { x: 0, y: -0.065, z: 0.025 },
        scale: 1,
        rotation: 0,
      },
      snapRadius: 0.16,
      priority: 0.5,
    });
  });

  return anchors;
}


export function spatialJointForAttachment(
  childObjectId: string,
  parentObjectId: string | null,
  anchorId: string,
) {
  if (!parentObjectId) return null;
  if (anchorId.startsWith('stack.')) {
    return {
      id: `joint.${childObjectId}`,
      kind: 'fixed' as const,
      parentObjectId,
      childObjectId,
      stiffness: 1,
    };
  }
  if (anchorId.startsWith('slide.')) {
    return {
      id: `joint.${childObjectId}`,
      kind: 'slider' as const,
      parentObjectId,
      childObjectId,
      axis: 'x' as const,
      min: -0.11,
      max: 0.11,
      stiffness: 0.9,
    };
  }
  if (anchorId.startsWith('object.')) {
    return {
      id: `joint.${childObjectId}`,
      kind: 'hinge' as const,
      parentObjectId,
      childObjectId,
      axis: 'z' as const,
      min: -42,
      max: 42,
      stiffness: 0.9,
    };
  }
  return null;
}


