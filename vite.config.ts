import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// host: true → mở ra LAN để test trên điện thoại cùng Wi-Fi (http://<IP-máy>:5173).
// ⚠️ Camera (face-tracking) & Web Speech STT cần secure context → mở qua IP http sẽ bị CHẶN.
//    Muốn dùng camera/giọng trên iPhone: chạy qua HTTPS tunnel, ví dụ:
//      npx cloudflared tunnel --url http://localhost:5173   (cho URL https://*.trycloudflare.com)
// allowedHosts: true → cho domain tunnel (trycloudflare/ngrok/loca.lt) gọi vào dev server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    open: false,
    allowedHosts: true,
  },
});
