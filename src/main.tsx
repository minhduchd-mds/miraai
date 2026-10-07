import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { startProductPerformanceMonitoring } from './runtime/product-performance';
import './ui/base-v2.css';
import './ui/v2.css';

// Web keeps Labs behind ?legacy=1. Desktop release sets VITE_MIRA_INCLUDE_LABS=0
// so Rollup can remove the whole Legacy/3D dynamic graph from the installer.
const AppV2 = lazy(() => import('./app/AppV2'));
const LABS_ENABLED = import.meta.env.VITE_MIRA_INCLUDE_LABS !== '0';
const LegacyApp = LABS_ENABLED
  ? lazy(async () => {
      await import('./ui/styles.css');
      return import('./App');
    })
  : null;
const legacy = Boolean(
  LABS_ENABLED &&
  LegacyApp &&
  new URLSearchParams(window.location.search).get('legacy') === '1',
);

const app = legacy && LegacyApp ? (
  <Suspense fallback={<div className="legacy-loading">Đang mở Mira Labs…</div>}>
    <LegacyApp />
  </Suspense>
) : (
  <Suspense fallback={<div className="mira-shell-loading" role="status" aria-live="polite">Mira</div>}>
    <AppV2 />
  </Suspense>
);

startProductPerformanceMonitoring();

// Không bọc StrictMode: Web Speech/rAF có side-effect và double-invoke trong dev dễ gây lặp mic/TTS.
createRoot(document.getElementById('root')!).render(app);
