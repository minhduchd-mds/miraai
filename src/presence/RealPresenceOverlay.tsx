import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { RealPresencePose } from '../core/vision/real-presence';
import type { ObservedMood } from '../intelligence/affect/mood-engine';
import './real-presence-overlay.css';

interface Props {
  active: boolean;
  stream: MediaStream | null;
  faceSeen: boolean;
  pose: RealPresencePose;
  mood: ObservedMood;
  moodConfidence: number;
}

const WASM_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const SEGMENT_MODEL =
  'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter_landscape/float16/latest/selfie_segmenter_landscape.tflite';

const LABELS: Record<string, string> = {
  near: 'Rất gần',
  conversation: 'Cạnh Mira',
  far: 'Hơi xa',
  unknown: 'Đang đo vị trí',
};

function smoothstep(min: number, max: number, value: number): number {
  const x = Math.max(0, Math.min(1, (value - min) / Math.max(0.0001, max - min)));
  return x * x * (3 - 2 * x);
}

export default function RealPresenceOverlay({
  active,
  stream,
  faceSeen,
  pose,
  mood,
  moodConfidence,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [segmentState, setSegmentState] = useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');
  const [seatLocked, setSeatLocked] = useState(false);
  const lockTimerRef = useRef<number | null>(null);
  const faceSeenRef = useRef(faceSeen);

  useEffect(() => {
    faceSeenRef.current = faceSeen;
    if (!faceSeen) {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [faceSeen]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    void video.play().catch(() => {});
    return () => {
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    const stableFace = active && faceSeen && pose.confidence >= 0.55;

    if (!stableFace) {
      setSeatLocked(false);
      if (lockTimerRef.current != null) {
        window.clearTimeout(lockTimerRef.current);
        lockTimerRef.current = null;
      }
      return;
    }

    if (!seatLocked && lockTimerRef.current == null) {
      lockTimerRef.current = window.setTimeout(() => {
        setSeatLocked(true);
        lockTimerRef.current = null;
      }, 720);
    }
  }, [active, faceSeen, pose.confidence, seatLocked]);

  useEffect(() => () => {
    if (lockTimerRef.current != null) {
      window.clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!active || !stream) {
      setSegmentState('idle');
      return;
    }

    let disposed = false;
    let raf = 0;
    let segmenter: any = null;
    let inFlight = false;
    let lastRun = 0;
    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    const width = isMobile ? 256 : 320;
    const height = isMobile ? 192 : 240;
    const interval = isMobile ? 125 : 82;
    const source = document.createElement('canvas');
    source.width = width;
    source.height = height;
    const sourceCtx = source.getContext('2d', { willReadFrequently: true });
    const output = canvasRef.current;
    const outputCtx = output?.getContext('2d');

    if (!sourceCtx || !output || !outputCtx) {
      setSegmentState('fallback');
      return;
    }
    output.width = width;
    output.height = height;

    const schedule = () => {
      if (!disposed) raf = requestAnimationFrame(frame);
    };

    const frame = (now: number) => {
      const video = videoRef.current;
      if (disposed || !video || !segmenter) return;
      if (!faceSeenRef.current || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        schedule();
        return;
      }
      if (inFlight || now - lastRun < interval) {
        schedule();
        return;
      }

      lastRun = now;
      inFlight = true;
      sourceCtx.save();
      sourceCtx.clearRect(0, 0, width, height);
      sourceCtx.translate(width, 0);
      sourceCtx.scale(-1, 1);
      sourceCtx.drawImage(video, 0, 0, width, height);
      sourceCtx.restore();

      try {
        segmenter.segmentForVideo(source, now, (result: any) => {
          if (disposed) {
            for (const item of result?.confidenceMasks || []) item?.close?.();
            result?.categoryMask?.close?.();
            return;
          }
          try {
            const maskObject = result?.confidenceMasks?.[0];
            const mask = maskObject?.getAsFloat32Array?.() as Float32Array | undefined;
            const frameData = sourceCtx.getImageData(0, 0, width, height);
            const pixels = frameData.data;

            if (mask?.length === width * height) {
              for (let i = 0; i < mask.length; i += 1) {
                pixels[i * 4 + 3] = Math.round(smoothstep(0.34, 0.72, mask[i]) * 255);
              }
              outputCtx.clearRect(0, 0, width, height);
              outputCtx.putImageData(frameData, 0, 0);
              setSegmentState('ready');
            } else {
              setSegmentState('fallback');
            }

            for (const item of result?.confidenceMasks || []) item?.close?.();
            result?.categoryMask?.close?.();
          } catch {
            setSegmentState('fallback');
          } finally {
            inFlight = false;
            schedule();
          }
        });
      } catch {
        inFlight = false;
        setSegmentState('fallback');
        schedule();
      }
    };

    const boot = async () => {
      setSegmentState('loading');
      try {
        const vision = await import('@mediapipe/tasks-vision');
        const resolver = await vision.FilesetResolver.forVisionTasks(WASM_CDN);
        const create = async (delegate: 'GPU' | 'CPU') => vision.ImageSegmenter.createFromOptions(resolver, {
          baseOptions: { modelAssetPath: SEGMENT_MODEL, delegate },
          runningMode: 'VIDEO',
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        } as any);

        try {
          segmenter = await create('GPU');
        } catch {
          segmenter = await create('CPU');
        }

        if (disposed) {
          segmenter?.close?.();
          return;
        }
        schedule();
      } catch (error) {
        console.warn('[Mira Real Presence] person segmentation unavailable.', error);
        if (!disposed) setSegmentState('fallback');
      }
    };

    void boot();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      try { segmenter?.close?.(); } catch { /* noop */ }
    };
  }, [active, stream]);

  const style = useMemo(() => ({
    '--rp-x': `${pose.sceneOffsetX.toFixed(1)}px`,
    '--rp-y': `${pose.sceneOffsetY.toFixed(1)}px`,
    '--rp-scale': pose.sceneScale.toFixed(3),
    '--rp-confidence': pose.confidence.toFixed(3),
  } as CSSProperties), [pose.confidence, pose.sceneOffsetX, pose.sceneOffsetY, pose.sceneScale]);

  if (!active || !stream) return null;

  const distance = pose.distanceM > 0 ? `${pose.distanceM.toFixed(2)} m` : '—';
  const mode = !faceSeen
    ? 'SCAN FACE'
    : seatLocked
      ? 'REAL SEAT · LOCKED'
      : 'CALIBRATING';

  return (
    <aside
      className={`real-presence ${seatLocked ? 'is-locked' : 'is-scanning'} segment-${segmentState}`}
      style={style}
      aria-label="Real Presence"
      aria-live="polite"
    >
      <div className="real-presence-seat" aria-hidden="true">
        <video
          ref={videoRef}
          className="real-presence-video"
          autoPlay
          muted
          playsInline
        />
        <canvas ref={canvasRef} className="real-presence-canvas" />
        <span className="real-presence-ground" />
      </div>

      <div className="real-presence-status">
        <span><i />{mode}</span>
        <small>{faceSeen ? `${LABELS[pose.proximity]} · ${distance}` : 'Đưa khuôn mặt vào camera'}</small>
      </div>

      {faceSeen && mood !== 'neutral' && moodConfidence >= 0.4 && (
        <span className="real-presence-affect">
          Biểu cảm: {mood} · {Math.round(moodConfidence * 100)}%
        </span>
      )}
    </aside>
  );
}
