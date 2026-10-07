import { useCallback, useEffect, useRef, useState } from 'react';
import { SpatialWebXRSessionRuntime } from '../core/vision/spatial-webxr-session';
import type { SpatialDeviceAdapterRuntime } from '../core/vision/spatial-device-adapter';

export function useWebXRTransport(deviceAdapter: SpatialDeviceAdapterRuntime) {
  const webXRRuntimeRef = useRef(new SpatialWebXRSessionRuntime());
  const [webXRAvailable, setWebXRAvailable] = useState(false);
  const [webXRSnapshot, setWebXRSnapshot] = useState(() =>
    webXRRuntimeRef.current.snapshot()
  );

  useEffect(() => {
    let cancelled = false;
    void deviceAdapter.detectWebXR().then((capabilities) => {
      if (!cancelled) setWebXRAvailable(capabilities.mode === 'webxr-metric');
    });
    return () => { cancelled = true; };
  }, [deviceAdapter]);

  useEffect(() => {
    if (!webXRSnapshot.active) return;
    const timer = window.setInterval(() => {
      const snapshot = webXRRuntimeRef.current.snapshot();
      setWebXRSnapshot(snapshot);
      if (!snapshot.active) setWebXRAvailable(true);
    }, 100);
    return () => window.clearInterval(timer);
  }, [webXRSnapshot.active]);

  const startWebXRTransport = useCallback(async () => {
    const snapshot = await webXRRuntimeRef.current.start(globalThis, document.body);
    setWebXRSnapshot(snapshot);
    setWebXRAvailable(snapshot.active);
    return snapshot;
  }, []);

  const stopWebXRTransport = useCallback(async () => {
    const snapshot = await webXRRuntimeRef.current.stop();
    setWebXRSnapshot(snapshot);
    setWebXRAvailable(true);
    return snapshot;
  }, []);

  useEffect(() => () => {
    void webXRRuntimeRef.current.stop();
  }, []);

  return {
    webXRRuntimeRef,
    webXRAvailable,
    webXRSnapshot,
    startWebXRTransport,
    stopWebXRTransport,
  };
}
