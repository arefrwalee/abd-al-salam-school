import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// يُبنى التطبيق إلى ../web ويخدمه خادم Node.js مباشرة.
// أثناء التطوير (npm run dev) تُمرَّر طلبات /api إلى الخادم على المنفذ 8080.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: '../web', emptyOutDir: true, assetsDir: 'assets', chunkSizeWarningLimit: 900 },
  server: { port: 5173, proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: false } } }
});
