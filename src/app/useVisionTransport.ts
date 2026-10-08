import { useCallback, useEffect, useRef, useState } from 'react';
import { VisionCameraRecoveryPolicy } from '../core/vision/camera-recovery-policy';

type VisionRuntimeModule = typeof import('../presence/vision-runtime');

export function useVisionTransport() {
  const cameraPreviewRef = useRef<HTMLVideoElement>(null);
  const visionModulesRef = useRef<VisionRuntimeModule | null>(null);
  const [visionOn, setVisionOn] = useState(false);
  const [visionBooting, setVisionBooting] = useState(false);
  const [visionError, setVisionError] = useState('');
  const visionWantedRef = useRef(false);
  const visionGenerationRef = useRef(0);
  const visionStartingRef = useRef(false);
  const recoveryPolicyRef = useRef(new VisionCameraRecoveryPolicy());

  const loadVisionModules = useCallback(async () => {
    if (visionModulesRef.current) return visionModulesRef.current;
    const [runtime] = await Promise.all([
      import('../presence/vision-runtime'),
      import('../ui/vision-v2.css'),
    ]);
    visionModulesRef.current = runtime;
    return runtime;
  }, []);

  const stopVisionTransport = useCallback(() => {
    visionWantedRef.current = false;
    visionGenerationRef.current += 1;
    recoveryPolicyRef.current.reset();
    visionStartingRef.current = false;
    visionModulesRef.current?.stopVision();
    if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null;
    setVisionOn(false);
    setVisionBooting(false);
  }, []);

  const startVisionTransport = useCallback(async () => {
    if (visionBooting || visionStartingRef.current) return false;
    const request = ++visionGenerationRef.current;
    visionWantedRef.current = true;
    visionStartingRef.current = true;
    recoveryPolicyRef.current.reset();
    setVisionBooting(true);
    setVisionError('');
    try {
      const modules = await loadVisionModules();
      if (request !== visionGenerationRef.current || !visionWantedRef.current) return false;
      const result = await modules.startVision();
      if (request !== visionGenerationRef.current || !visionWantedRef.current) {
        if (!visionWantedRef.current) modules.stopVision();
        return false;
      }
      const on = result.ok && Boolean(modules.visionStream());
      setVisionOn(on);
      if (!on) {
        visionWantedRef.current = false;
        setVisionError(result.error || 'Không mở được camera. Hãy kiểm tra quyền Camera của trình duyệt.');
      }
      return on;
    } catch (error) {
      if (request !== visionGenerationRef.current) return false;
      visionWantedRef.current = false;
      setVisionError(error instanceof Error ? error.message : 'Không mở được camera.');
      visionModulesRef.current?.stopVision();
      if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null;
      setVisionOn(false);
      return false;
    } finally {
      if (request === visionGenerationRef.current) {
        visionStartingRef.current = false;
        setVisionBooting(false);
      }
    }
  }, [loadVisionModules, visionBooting]);

  useEffect(() => {
    if (!visionOn) return;
    const preview = cameraPreviewRef.current;
    const stream = visionModulesRef.current?.visionStream();
    if (!preview || !stream) return;

    preview.srcObject = stream;
    preview.muted = true;
    preview.playsInline = true;
    void preview.play().catch(() => {});
  }, [visionOn]);

  useEffect(() => {
    if (!visionOn) return;
    let disposed = false;
    const inspect = async () => {
      if (disposed || !visionWantedRef.current || visionStartingRef.current || document.hidden) return;
      const runtime = visionModulesRef.current;
      if (!runtime) return;
      const currentStream = runtime.visionStream();
      const live = Boolean(currentStream?.getVideoTracks().some(track => track.readyState === 'live'));
      const now = performance.now();
      const policy = recoveryPolicyRef.current;
      if (live && currentStream) {
        policy.noteLive(now);
        const preview = cameraPreviewRef.current;
        if (preview && preview.srcObject !== currentStream) {
          preview.srcObject = currentStream;
          void preview.play().catch(() => {});
        }
        return;
      }

      policy.noteOffline();
      if (policy.exhausted) {
        visionWantedRef.current = false;
        runtime.stopVision();
        setVisionOn(false);
        setVisionError('Camera mất kết nối nhiều lần. Hãy kiểm tra thiết bị và bật lại camera.');
        return;
      }
      if (!policy.canRetry(now)) return;

      policy.noteAttempt(now);
      const request = ++visionGenerationRef.current;
      visionStartingRef.current = true;
      setVisionBooting(true);
      // Tear down all old inference workers before attempting a new stream.
      runtime.stopVision();
      if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null;
      try {
        const result = await runtime.startVision();
        if (disposed || request !== visionGenerationRef.current || !visionWantedRef.current) {
          if (!visionWantedRef.current) runtime.stopVision();
          return;
        }
        const nextStream = runtime.visionStream();
        if (!result.ok || !nextStream?.getVideoTracks().some(track => track.readyState === 'live')) {
          runtime.stopVision();
          setVisionError(result.error || 'Không kết nối lại được camera.');
          return;
        }
        policy.noteLive(performance.now());
        const preview = cameraPreviewRef.current;
        if (preview) {
          preview.srcObject = nextStream;
          void preview.play().catch(() => {});
        }
        setVisionError('');
      } catch (error) {
        if (request === visionGenerationRef.current) {
          runtime.stopVision();
          setVisionError(error instanceof Error ? error.message : 'Không kết nối lại được camera.');
        }
      } finally {
        if (request === visionGenerationRef.current) {
          visionStartingRef.current = false;
          setVisionBooting(false);
        }
      }
    };
    const timer = window.setInterval(() => { void inspect(); }, 1_200);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [visionOn]);

  useEffect(() => () => {
    visionWantedRef.current = false;
    visionGenerationRef.current += 1;
    visionStartingRef.current = false;
    visionModulesRef.current?.stopVision();
    if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null;
  }, []);

  return {
    cameraPreviewRef,
    visionModulesRef,
    visionOn,
    visionBooting,
    visionError,
    startVisionTransport,
    stopVisionTransport,
  };
}
