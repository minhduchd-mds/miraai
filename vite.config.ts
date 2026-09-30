import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// host: true → mở ra LAN để test trên điện thoại cùng Wi-Fi.
// Camera & Web Speech STT cần secure context; dùng HTTPS tunnel khi test qua thiết bị khác.
export default defineConfig({
  // Relative base keeps one build portable across Vercel and GitHub Pages (/miraai/).
  base: './',
  plugins: [react()],
  resolve: {
    // @vitejs/plugin-react 6 no longer auto-dedupes React.
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5173,
    host: true,
    open: false,
    allowedHosts: true,
  },
  build: {
    // Modern production target keeps emitted JS compact; Mira already requires
    // secure-context browser APIs such as Web Speech, WebGL and MediaDevices.
    target: 'es2022',
    minify: 'esbuild',
    cssMinify: 'esbuild',
    modulePreload: { polyfill: false },
    // Manifest lets CI distinguish the initial graph from intentionally-heavy dynamic Labs/3D chunks.
    manifest: true,
  },
});
