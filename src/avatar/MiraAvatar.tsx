import { Component, useEffect, useState, type ReactNode, type MutableRefObject } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import type { MiraState, Mood, Theme } from '../core/types';
import VRMAvatar from './VRMAvatar';

// Accent theo theme (khớp các biến --accent trong styles.css) để nhuộm hologram.
const THEME_ACCENT: Record<Theme, string> = {
  nova: '#38E1FF',
  aura: '#9A7BFF',
  ember: '#2FD9C9',
  iris: '#7C8CFF',
};

interface Props {
  stateRef: MutableRefObject<MiraState>;
  moodRef: MutableRefObject<Mood>;
  theme: Theme;
  avatarUrl: string | null; // null = bộ chưa có model 3D → hiện ảnh PNG (lookSrc)
  lookSrc: string; // ảnh "look" của bộ (hiện khi không có 3D / đang tải / lỗi WebGL)
  avatarOpacity: number; // "độ hiển thị" (0..1)
}

// Bắt lỗi WebGL/render → rớt về fallback 2D thay vì vỡ cả app.
class AvatarBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function CameraRig({ target }: { target: [number, number, number] }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.lookAt(target[0], target[1], target[2]);
  }, [camera, target]);
  return null;
}

export default function MiraAvatar({ stateRef, moodRef, theme, avatarUrl, lookSrc, avatarOpacity }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const accent = THEME_ACCENT[theme];

  // Bộ chưa có model 3D → hiện thẳng ảnh PNG "look" của bộ (poster 2D), không dựng Canvas.
  if (!avatarUrl) {
    return <img className="look2d breathe" id="avatar" alt="Mira" src={lookSrc} style={{ opacity: avatarOpacity }} />;
  }

  return (
    <>
      {/* Ảnh PNG của bộ làm nền chờ khi đang tải VRM / WebGL lỗi. */}
      {(!loaded || failed) && (
        <img className="look2d breathe" id="avatar" alt="Mira" src={lookSrc} style={{ opacity: avatarOpacity }} />
      )}

      {!failed && (
        <AvatarBoundary onError={() => setFailed(true)}>
          <Canvas
            className="avatar3d"
            dpr={[1, 2]} // chặn render >2x pixel trên màn retina (đỡ nóng/hao pin mobile)
            gl={{ alpha: true, antialias: true }}
            camera={{ position: [0, 0.85, 4.3], fov: 28, near: 0.1, far: 20 }}
            onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
            style={{ opacity: (loaded ? 1 : 0) * avatarOpacity }}
          >
            <CameraRig target={[0, 0.82, 0]} />
            <ambientLight intensity={1.8} />
            <directionalLight position={[1.5, 2.5, 2]} intensity={1.5} />
            <directionalLight position={[-2, 1, -1]} intensity={0.5} color={accent} />
            <VRMAvatar
              url={avatarUrl}
              stateRef={stateRef}
              moodRef={moodRef}
              accent={accent}
              onLoaded={() => setLoaded(true)}
              onError={() => setFailed(true)}
            />
          </Canvas>
        </AvatarBoundary>
      )}
    </>
  );
}
