import { useEffect, useRef, useState } from 'react';

// Trình xem Gaussian Splat (.ply) — render TĨNH 3D, xoay/ngắm bằng chuột (kéo). Lazy-load lib (nặng).
// Tự quản WebGL riêng (KHÔNG qua R3F). sharedMemoryForWorkers:false → khỏi cần header COOP/COEP trên Vercel.
export default function SplatViewer({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let viewer: any = null;
    let disposed = false;
    (async () => {
      try {
        const GS = await import('@mkkellogg/gaussian-splats-3d');
        if (disposed || !ref.current) return;
        viewer = new GS.Viewer({
          rootElement: ref.current,
          cameraUp: [0, -1, 0], // 3DGS thường Y-down → lật; nếu ngược đầu thì đổi thành [0,1,0]
          initialCameraPosition: [0, 0, 2], // gần hơn → splat to bằng avatar cũ (chỉnh 1.5–2.5 nếu cần)
          initialCameraLookAt: [0, 0, 0],
          sharedMemoryForWorkers: false,
          gpuAcceleratedSort: false,
          useBuiltInControls: true,
          selfDrivenMode: true,
        });
        await viewer.addSplatScene(url, { showLoadingUI: true, splatAlphaRemovalThreshold: 5 });
        if (!disposed) viewer.start();
      } catch (e) {
        if (!disposed) setErr(e instanceof Error ? e.message : String(e));
        console.warn('[Mira Splat] load lỗi:', e);
      }
    })();
    return () => {
      disposed = true;
      try {
        viewer?.dispose?.();
      } catch {
        /* noop */
      }
    };
  }, [url]);

  return (
    <div className="splat-viewer" ref={ref}>
      {err && <div className="splat-err">Không tải được splat: {err}</div>}
    </div>
  );
}
