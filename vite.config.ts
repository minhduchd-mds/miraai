import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Web Speech API (STT) yêu cầu secure context → http://localhost được tính là secure.
// Đừng mở qua IP (vd 192.168.x.x) nếu không có https, nếu không STT sẽ bị chặn.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: 'localhost', open: false },
});
