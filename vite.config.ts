import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// host: true → mở ra LAN để test trên điện thoại cùng Wi-Fi.
// Camera & Web Speech STT cần secure context; dùng HTTPS tunnel khi test qua thiết bị khác.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    open: false,
    allowedHosts: true,
  },
  build: {
    // Manifest lets CI distinguish the initial graph from intentionally-heavy dynamic Labs/3D chunks.
    manifest: true,
  },
});
