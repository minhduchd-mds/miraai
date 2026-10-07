import { useCallback, useEffect, useRef, useState } from 'react';

type VisionRuntimeModule = typeof import('../presence/vision-runtime');

export function useVisionTransport() {
  const cameraPreviewRef = useRef<HTMLVideoElement>(null);
  const visionModulesRef = useRef<VisionRuntimeModule | null>(null);
  const [visionOn, setVisionOn] = useState(false);
  const [visionBooting, setVisionBooting] = useState(false);
  const [visionError, setVisionError] = useState('');

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
    visionModulesRef.current?.stopVision();
    if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null;
    setVisionOn(false);
  }, []);

  const startVisionTransport = useCallback(async () => {
    if (visionBooting) return false;

    setVisionBooting(true);
    setVisionError('');
    try {
      const modules = await loadVisionModules();
      const result = await modules.startVision();
      const on = result.ok;
      setVisionOn(on);
      if (!on) {
        setVisionError(result.error || 'Không mở được camera. Hãy kiểm tra quyền Camera của trình duyệt.');
      }
      return on;
    } catch (error) {
      setVisionError(error instanceof Error ? error.message : 'Không mở được camera.');
      visionModulesRef.current?.stopVision();
      if (cameraPreviewRef.current) cameraPreviewRef.current.srcObject = null;
      setVisionOn(false);
      return false;
    } finally {
      setVisionBooting(false);
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

  useEffect(() => () => {
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
