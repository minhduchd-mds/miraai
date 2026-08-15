import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import AppV2 from './app/AppV2';
import './ui/styles.css';
import './ui/v2.css';

// Legacy/Labs được tách thành chunk riêng: camera/gesture/Splat/debug không nằm trên đường tải mặc định.
const LegacyApp = lazy(() => import('./App'));
const legacy = new URLSearchParams(window.location.search).get('legacy') === '1';

const app = legacy ? (
  <Suspense fallback={<div className="legacy-loading">Đang mở Mira Labs…</div>}>
    <LegacyApp />
  </Suspense>
) : (
  <AppV2 />
);

// Không bọc StrictMode: Web Speech/rAF có side-effect và double-invoke trong dev dễ gây lặp mic/TTS.
createRoot(document.getElementById('root')!).render(app);
