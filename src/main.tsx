import { createRoot } from 'react-dom/client';
import LegacyApp from './App';
import AppV2 from './app/AppV2';
import './ui/styles.css';
import './ui/v2.css';

// UI V2 là mặc định. Giao diện cũ (camera/gesture/Splat/debug) vẫn giữ nguyên để dùng như Labs
// trong quá trình migrate, truy cập bằng ?legacy=1. Không bọc StrictMode vì Web Speech/rAF
// có lifecycle side-effect và double-invoke trong dev dễ gây lặp mic/TTS.
const legacy = new URLSearchParams(window.location.search).get('legacy') === '1';

createRoot(document.getElementById('root')!).render(legacy ? <LegacyApp /> : <AppV2 />);
