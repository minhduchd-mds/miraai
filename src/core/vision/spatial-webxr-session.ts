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

export interface WebXRSessionSnapshot {
  active: boolean;
  mode: 'inactive' | 'immersive-ar';
  enabledFeatures: string[];
  hands: WebXRHandSample[];
  views: WebXRViewSample[];
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
  hit: null,
  frameAt: 0,
  error: '',
};

const PINCH_DISTANCE_M = 0.028;
const MAX_HANDS = 2;
const MAX_JOINTS = 25;

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
      } catch {
        hit = null;
      }
    }

    this.current = {
      ...this.current,
      active: true,
      mode: 'immersive-ar',
      hands,
      views,
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
    this.current = cloneSnapshot(EMPTY);
  }
}
