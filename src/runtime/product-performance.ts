export interface MiraProductPerformanceSnapshot {
  active: boolean;
  loafSupported: boolean;
  longAnimationFrames: number;
  totalLongFrameMs: number;
  worstLongFrameMs: number;
  lastLongFrameMs: number;
  startedAt: number;
}

const state: MiraProductPerformanceSnapshot = {
  active: false,
  loafSupported: false,
  longAnimationFrames: 0,
  totalLongFrameMs: 0,
  worstLongFrameMs: 0,
  lastLongFrameMs: 0,
  startedAt: 0,
};

let observer: PerformanceObserver | null = null;

export function startProductPerformanceMonitoring(): MiraProductPerformanceSnapshot {
  if (state.active) return productPerformanceSnapshot();

  const Observer = typeof PerformanceObserver === 'undefined' ? null : PerformanceObserver;
  const supported = Array.isArray(Observer?.supportedEntryTypes) &&
    Observer.supportedEntryTypes.includes('long-animation-frame');

  state.active = true;
  state.loafSupported = Boolean(supported);
  state.startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

  if (!supported || !Observer) return productPerformanceSnapshot();

  try {
    observer = new Observer((list) => {
      for (const entry of list.getEntries()) {
        const duration = Math.max(0, Number(entry.duration || 0));
        state.longAnimationFrames += 1;
        state.totalLongFrameMs += duration;
        state.worstLongFrameMs = Math.max(state.worstLongFrameMs, duration);
        state.lastLongFrameMs = duration;
      }
    });
    observer.observe({ type: 'long-animation-frame', buffered: true } as PerformanceObserverInit);
  } catch {
    state.loafSupported = false;
    observer = null;
  }

  return productPerformanceSnapshot();
}

export function stopProductPerformanceMonitoring(): MiraProductPerformanceSnapshot {
  try { observer?.disconnect(); } catch { /* noop */ }
  observer = null;
  state.active = false;
  return productPerformanceSnapshot();
}

export function productPerformanceSnapshot(): MiraProductPerformanceSnapshot {
  return { ...state };
}

export function resetProductPerformanceMonitoring(): void {
  stopProductPerformanceMonitoring();
  state.loafSupported = false;
  state.longAnimationFrames = 0;
  state.totalLongFrameMs = 0;
  state.worstLongFrameMs = 0;
  state.lastLongFrameMs = 0;
  state.startedAt = 0;
}
