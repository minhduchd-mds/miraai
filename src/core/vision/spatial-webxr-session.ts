export interface WebXRJointSample {
  name: string;
  x: number;
  y: number;
  z: number;
  radius: number;
}

export interface WebXRHandSample {
  handedness: string;
  joints: WebXRJointSample[];
  indexTip: WebXRJointSample | null;
  thumbTip: WebXRJointSample | null;
  wrist: WebXRJointSample | null;
  pinching: boolean;
  pinchDistanceM: number;
}

export interface WebXRHitSample {
  x: number;
  y: number;
  z: number;
  confidence: number;
}

export interface WebXRViewSample {
  eye: string;
  projectionMatrix: number[];
  viewMatrix: number[];
}

export interface WebXRDepthSample {
  x: number;
  y: number;
  depthM: number;
  valid: boolean;
}

export interface WebXRDepthViewSample {
  eye: string;
  width: number;
  height: number;
  samples: WebXRDepthSample[];
}

export interface WebXRDepthSnapshot {
  available: boolean;
  usage: string;
  dataFormat: string;
  views: WebXRDepthViewSample[];
  frameAt: number;
}

export interface WebXRAnchorSample {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  tracked: boolean;
  persistentHandle: string;
  createdAt: number;
}

export interface WebXRSessionSnapshot {
  active: boolean;
  mode: 'inactive' | 'immersive-ar';
  enabledFeatures: string[];
  hands: WebXRHandSample[];
  views: WebXRViewSample[];
  depth: WebXRDepthSnapshot;
  anchors: WebXRAnchorSample[];
  hit: WebXRHitSample | null;
  frameAt: number;
  error: string;
}

const EMPTY: WebXRSessionSnapshot = {
  active: false,
  mode: 'inactive',
  enabledFeatures: [],
  hands: [],
  views: [],
  depth: {
    available: false,
    usage: '',
    dataFormat: '',
    views: [],
    frameAt: 0,
  },
  anchors: [],
  hit: null,
  frameAt: 0,
  error: '',
};

const PINCH_DISTANCE_M = 0.028;
const MAX_HANDS = 2;
const MAX_JOINTS = 25;
const DEPTH_GRID = [0.1, 0.3, 0.5, 0.7, 0.9];

interface InternalXRAnchor {
  id: string;
  label: string;
  anchor: any;
  persistentHandle: string;
  createdAt: number;
}

interface PendingAnchorRequest {
  id: string;
  label: string;
  requestPersistentHandle: boolean;
}

function finite(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function distance3(a: WebXRJointSample | null, b: WebXRJointSample | null): number {
  if (!a || !b) return Infinity;
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function cloneSnapshot(snapshot: WebXRSessionSnapshot): WebXRSessionSnapshot {
  return {
    ...snapshot,
    enabledFeatures: [...snapshot.enabledFeatures],
    hands: snapshot.hands.map((hand) => ({
      ...hand,
      joints: hand.joints.map((joint) => ({ ...joint })),
      indexTip: hand.indexTip ? { ...hand.indexTip } : null,
      thumbTip: hand.thumbTip ? { ...hand.thumbTip } : null,
      wrist: hand.wrist ? { ...hand.wrist } : null,
    })),
    views: snapshot.views.map((view) => ({
      eye: view.eye,
      projectionMatrix: [...view.projectionMatrix],
      viewMatrix: [...view.viewMatrix],
    })),
    depth: {
      ...snapshot.depth,
      views: snapshot.depth.views.map((view) => ({
        ...view,
        samples: view.samples.map((sample) => ({ ...sample })),
      })),
    },
    anchors: snapshot.anchors.map((anchor) => ({ ...anchor })),
    hit: snapshot.hit ? { ...snapshot.hit } : null,
  };
}

function poseToJoint(name: string, pose: any): WebXRJointSample | null {
  const position = pose?.transform?.position;
  if (!position) return null;
  return {
    name,
    x: finite(position.x),
    y: finite(position.y),
    z: finite(position.z),
    radius: Math.max(0, finite(pose?.radius)),
  };
}

/**
 * Real WebXR session bridge.
 *
 * requestSession() must be called from user activation. This runtime never
 * auto-opens immersive XR and never synthesizes metric poses from webcam data.
 */
export class SpatialWebXRSessionRuntime {
  private session: any = null;
  private referenceSpace: any = null;
  private viewerSpace: any = null;
  private hitTestSource: any = null;
  private frameHandle = 0;
  private current: WebXRSessionSnapshot = cloneSnapshot(EMPTY);
  private ended = false;
  private anchors = new Map<string, InternalXRAnchor>();
  private pendingAnchor: PendingAnchorRequest | null = null;
  private anchorCreationPending = false;

  snapshot(): WebXRSessionSnapshot {
    return cloneSnapshot(this.current);
  }

  async start(environment: any = globalThis, domOverlayRoot?: Element | null): Promise<WebXRSessionSnapshot> {
    if (this.session) return this.snapshot();
    const xr = environment?.navigator?.xr;
    if (!xr || typeof xr.requestSession !== 'function') {
      this.current = { ...cloneSnapshot(EMPTY), error: 'WebXR không khả dụng trên trình duyệt này.' };
      return this.snapshot();
    }

    try {
      const optionalFeatures = ['hand-tracking', 'hit-test', 'anchors', 'depth-sensing', 'local-floor'];
      if (domOverlayRoot) optionalFeatures.push('dom-overlay');
      const options: any = {
        optionalFeatures,
        depthSensing: {
          usagePreference: ['cpu-optimized', 'gpu-optimized'],
          dataFormatPreference: ['float32', 'luminance-alpha'],
        },
      };
      if (domOverlayRoot) options.domOverlay = { root: domOverlayRoot };

      const session = await xr.requestSession('immersive-ar', options);
      this.session = session;
      this.ended = false;
      this.referenceSpace = await session.requestReferenceSpace('local');
      try {
        this.viewerSpace = await session.requestReferenceSpace('viewer');
      } catch {
        this.viewerSpace = null;
      }

      const enabledFeatures = Array.isArray(session.enabledFeatures)
        ? [...session.enabledFeatures]
        : Array.from(session.enabledFeatures || []);

      if (
        enabledFeatures.includes('hit-test') &&
        this.viewerSpace &&
        typeof session.requestHitTestSource === 'function'
      ) {
        try {
          this.hitTestSource = await session.requestHitTestSource({ space: this.viewerSpace });
        } catch {
          this.hitTestSource = null;
        }
      }

      this.current = {
        active: true,
        mode: 'immersive-ar',
        enabledFeatures,
        hands: [],
        views: [],
        depth: {
          available: false,
          usage: String(session.depthUsage || ''),
          dataFormat: String(session.depthDataFormat || ''),
          views: [],
          frameAt: performance.now(),
        },
        anchors: [],
        hit: null,
        frameAt: performance.now(),
        error: '',
      };

      session.addEventListener?.('end', () => {
        this.ended = true;
        this.cleanupAfterEnd();
      });

      this.frameHandle = session.requestAnimationFrame((time: number, frame: any) => this.onFrame(time, frame));
      return this.snapshot();
    } catch (error) {
      this.cleanupAfterEnd();
      this.current = {
        ...cloneSnapshot(EMPTY),
        error: error instanceof Error ? error.message : 'Không mở được WebXR session.',
      };
      return this.snapshot();
    }
  }

  requestAnchorAtCurrentHit(
    id: string,
    label: string,
    requestPersistentHandle = false,
  ): boolean {
    if (!id || !this.session || !this.current.enabledFeatures.includes('anchors')) return false;
    this.pendingAnchor = {
      id,
      label: label || id,
      requestPersistentHandle,
    };
    return true;
  }

  removeAnchor(id: string): boolean {
    const entry = this.anchors.get(id);
    if (!entry) return false;
    try { entry.anchor?.delete?.(); } catch { /* noop */ }
    this.anchors.delete(id);
    return true;
  }

  async stop(): Promise<WebXRSessionSnapshot> {
    const session = this.session;
    this.ended = true;
    this.hitTestSource?.cancel?.();
    this.hitTestSource = null;
    if (session && this.frameHandle) {
      try { session.cancelAnimationFrame?.(this.frameHandle); } catch { /* noop */ }
    }
    try {
      if (session && typeof session.end === 'function') await session.end();
    } catch {
      // Session may already be ending.
    }
    this.cleanupAfterEnd();
    return this.snapshot();
  }

  private onFrame(time: number, frame: any): void {
    const session = this.session;
    const referenceSpace = this.referenceSpace;
    if (!session || !referenceSpace || this.ended) return;

    const hands: WebXRHandSample[] = [];
    for (const source of Array.from(session.inputSources || []).slice(0, MAX_HANDS) as any[]) {
      const hand = source?.hand;
      if (!hand || typeof frame?.getJointPose !== 'function') continue;

      const joints: WebXRJointSample[] = [];
      const entries = typeof hand.entries === 'function'
        ? Array.from(hand.entries()).slice(0, MAX_JOINTS)
        : [];
      for (const entry of entries as any[]) {
        const [name, jointSpace] = entry;
        try {
          const pose = frame.getJointPose(jointSpace, referenceSpace);
          const joint = poseToJoint(String(name), pose);
          if (joint) joints.push(joint);
        } catch {
          // A joint can be temporarily unavailable in an otherwise valid frame.
        }
      }

      const byName = new Map(joints.map((joint) => [joint.name, joint]));
      const indexTip = byName.get('index-finger-tip') || null;
      const thumbTip = byName.get('thumb-tip') || null;
      const wrist = byName.get('wrist') || null;
      const pinchDistanceM = distance3(indexTip, thumbTip);
      hands.push({
        handedness: String(source?.handedness || 'none'),
        joints,
        indexTip,
        thumbTip,
        wrist,
        pinching: pinchDistanceM <= PINCH_DISTANCE_M,
        pinchDistanceM: Number.isFinite(pinchDistanceM) ? pinchDistanceM : 0,
      });
    }

    const viewerPose = typeof frame?.getViewerPose === 'function'
      ? frame.getViewerPose(referenceSpace)
      : null;
    const views: WebXRViewSample[] = Array.from(viewerPose?.views || [])
      .slice(0, 2)
      .map((view: any) => ({
        eye: String(view?.eye || 'none'),
        projectionMatrix: Array.from(view?.projectionMatrix || []).slice(0, 16).map(finite),
        viewMatrix: Array.from(view?.transform?.inverse?.matrix || []).slice(0, 16).map(finite),
      }))
      .filter((view) => view.projectionMatrix.length === 16 && view.viewMatrix.length === 16);

    const depthViews: WebXRDepthViewSample[] = [];
    if (
      this.current.enabledFeatures.includes('depth-sensing') &&
      typeof frame?.getDepthInformation === 'function'
    ) {
      const xrViews = Array.from(viewerPose?.views || []).slice(0, 2) as any[];
      for (const view of xrViews) {
        try {
          const info = frame.getDepthInformation(view);
          if (!info || typeof info.getDepthInMeters !== 'function') continue;
          const samples: WebXRDepthSample[] = [];
          for (const y of DEPTH_GRID) {
            for (const x of DEPTH_GRID) {
              let depthM = 0;
              try { depthM = finite(info.getDepthInMeters(x, y)); } catch { depthM = 0; }
              samples.push({
                x,
                y,
                depthM,
                valid: Number.isFinite(depthM) && depthM > 0,
              });
            }
          }
          depthViews.push({
            eye: String(view?.eye || 'none'),
            width: Math.max(0, finite(info.width)),
            height: Math.max(0, finite(info.height)),
            samples,
          });
        } catch {
          // Depth can be temporarily unavailable on an otherwise valid XR frame.
        }
      }
    }

    let hit: WebXRHitSample | null = null;
    if (this.hitTestSource && typeof frame?.getHitTestResults === 'function') {
      try {
        const result = frame.getHitTestResults(this.hitTestSource)?.[0];
        const pose = result?.getPose?.(referenceSpace);
        const position = pose?.transform?.position;
        if (position) {
          hit = {
            x: finite(position.x),
            y: finite(position.y),
            z: finite(position.z),
            confidence: 1,
          };
        }

        if (
          result &&
          this.pendingAnchor &&
          !this.anchorCreationPending &&
          typeof result.createAnchor === 'function'
        ) {
          const request = this.pendingAnchor;
          this.pendingAnchor = null;
          this.anchorCreationPending = true;
          Promise.resolve(result.createAnchor())
            .then(async (anchor: any) => {
              let persistentHandle = '';
              if (request.requestPersistentHandle && typeof anchor?.requestPersistentHandle === 'function') {
                try {
                  persistentHandle = String(await anchor.requestPersistentHandle());
                } catch {
                  persistentHandle = '';
                }
              }
              this.anchors.set(request.id, {
                id: request.id,
                label: request.label,
                anchor,
                persistentHandle,
                createdAt: performance.now(),
              });
            })
            .catch(() => {})
            .finally(() => {
              this.anchorCreationPending = false;
            });
        }
      } catch {
        hit = null;
      }
    }

    const trackedAnchors = frame?.trackedAnchors;
    const anchors: WebXRAnchorSample[] = [];
    for (const entry of this.anchors.values()) {
      let tracked = false;
      let x = 0;
      let y = 0;
      let z = 0;
      try {
        tracked = trackedAnchors?.has?.(entry.anchor) ?? true;
        const pose = tracked && entry.anchor?.anchorSpace && typeof frame?.getPose === 'function'
          ? frame.getPose(entry.anchor.anchorSpace, referenceSpace)
          : null;
        const position = pose?.transform?.position;
        if (position) {
          x = finite(position.x);
          y = finite(position.y);
          z = finite(position.z);
        } else {
          tracked = false;
        }
      } catch {
        tracked = false;
      }
      anchors.push({
        id: entry.id,
        label: entry.label,
        x,
        y,
        z,
        tracked,
        persistentHandle: entry.persistentHandle,
        createdAt: entry.createdAt,
      });
    }

    this.current = {
      ...this.current,
      active: true,
      mode: 'immersive-ar',
      hands,
      views,
      depth: {
        available: depthViews.some((view) => view.samples.some((sample) => sample.valid)),
        usage: String(session.depthUsage || ''),
        dataFormat: String(session.depthDataFormat || ''),
        views: depthViews,
        frameAt: finite(time, performance.now()),
      },
      anchors,
      hit,
      frameAt: finite(time, performance.now()),
      error: '',
    };

    this.frameHandle = session.requestAnimationFrame((nextTime: number, nextFrame: any) =>
      this.onFrame(nextTime, nextFrame)
    );
  }

  private cleanupAfterEnd(): void {
    this.hitTestSource?.cancel?.();
    this.hitTestSource = null;
    this.session = null;
    this.referenceSpace = null;
    this.viewerSpace = null;
    this.frameHandle = 0;
    for (const entry of this.anchors.values()) {
      try { entry.anchor?.delete?.(); } catch { /* noop */ }
    }
    this.anchors.clear();
    this.pendingAnchor = null;
    this.anchorCreationPending = false;
    this.current = cloneSnapshot(EMPTY);
  }
}
